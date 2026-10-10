import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {stripRecentAnnotations} from './native-annotations.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const manifest = JSON.parse(read('migration/history-data/source-manifest.json'));
const en = JSON.parse(read('migration/history-data/en.json'));
const ja = JSON.parse(read('migration/history-data/ja.json'));
const corpus = fs.readFileSync(path.join(root, manifest.source.file));
const lines = corpus.toString('utf8').split(/\r?\n/);
const graph = new Map();
for (const record of manifest.records) {
 if (!graph.has(record.chart)) graph.set(record.chart, []);
 graph.get(record.chart).push(record);
}
const starts = [1,4,5,7,10,13,16,19,21,23];
const core = read('logic/player-birth.c');
const ui = read('logic/ui-birth.c');
const helper = read('logic/web-history.c');
const header = read('logic/web-history.h');
const renderer = read('logic/web-ui-text.c');
const rust = read('rust/src/history.rs');
const captureMarker = /#ifdef __EMSCRIPTEN__ \/\* AB_HISTORY_CAPTURE \*\/[\s\S]*?#endif \/\* AB_HISTORY_CAPTURE \*\/(?:\r\n|\n)?/g;
const uiMarker = /#ifdef __EMSCRIPTEN__ \/\* AB_UI_PURE \*\/[\s\S]*?#endif \/\* AB_UI_PURE \*\/(?:\r\n|\n)?/g;
const staticMarker = /\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g;
const captures = [...core.matchAll(captureMarker)].map(match => match[0]).join('\n');
const entry = choice => manifest.records.find(row => row.chart === choice.chart && row.cutoff === choice.cutoff);
function defaultPath(start, chosen) {
 const result = []; let chart = start;
 while (chart) {
  const record = chosen?.chart === chart ? chosen : graph.get(chart)[0];
  result.push({ chart, cutoff: record.cutoff }); chart = record.successor;
 }
 return result;
}
function validPath(start, choices) {
 assert.ok(starts.includes(start)); assert.ok(choices.length > 0 && choices.length <= 32);
 let expected = start; const seen = new Set();
 for (const choice of choices) {
  const record = entry(choice); assert.ok(record); assert.equal(record.chart, expected);
  assert.ok(!seen.has(record.chart));seen.add(record.chart);expected = record.successor;
 }
 assert.equal(expected,0);
}
function renderPlan(start, choices, catalog) {
 validPath(start, choices);
 const selected = new Map(choices.map(choice => [choice.chart, entry(choice)]));
 let result = '';
 for (const part of manifest.composition_plans[start]) {
  if (part.fragment_chart) result += catalog[selected.get(part.fragment_chart).id];
  else result += catalog[part.grammar_id].replace(/\{([a-z_]+)\}/g, (_, name) => catalog[selected.get(part.parameters[name]).id]);
 }
 return result;
}

// Artifact/source checks only: no C/Rust engine code is compiled or executed.
test('165 source-identified fragments and 14 complete grammars exactly cover immutable history data', () => {
 assert.equal(crypto.createHash('sha256').update(corpus).digest('hex'),manifest.catalog_sha256);
 assert.deepEqual(manifest.coverage,{fragment_records:165,charts:44,grammar_templates:14,projection_templates:1,semantic_ids:180});
 assert.equal(manifest.records.length,165);assert.equal(graph.size,44);
 assert.equal(Object.keys(en).length,180);assert.deepEqual(Object.keys(en),Object.keys(ja));
 assert.equal(lines.filter(line => line.startsWith('phrase:')).length,165);
 for (const record of manifest.records) {
  assert.equal(lines[record.source_chart_line-1],`chart:${record.chart}:${record.successor}:${record.cutoff}`);
  assert.equal(record.english,record.source_phrase_lines.map(line => lines[line-1].slice(7)).join(''));
  assert.equal(en[record.id],record.english);assert.equal(ja[record.id],record.japanese);
  assert.match(record.id,/^history\.fragment\.[a-z_]+\.[a-z_]+$/);
  assert.ok(!/\{[^}]*\}|[A-Za-z]/.test(record.japanese),record.id);
 }
 for (const [chart, records] of graph) {
  assert.deepEqual(records.map(row=>row.cutoff),[...new Set(records.map(row=>row.cutoff))].sort((a,b)=>a-b),chart);
  assert.equal(records.at(-1).cutoff,100);assert.equal(new Set(records.map(row=>row.successor)).size,1);
 }
 for (const reviewed of manifest.entries) {
  const parameters = reviewed.parameters.map(parameter=>parameter.name).sort();
  assert.deepEqual([...new Set([...reviewed.english.matchAll(/\{([a-z_]+)\}/g)].map(match=>match[1]))].sort(),parameters,reviewed.id);
  assert.deepEqual([...new Set([...reviewed.japanese.matchAll(/\{([a-z_]+)\}/g)].map(match=>match[1]))].sort(),parameters,reviewed.id);
 }
});

test('every source fragment participates once in a complete plan with exact native English', () => {
 for (const chosen of manifest.records) {
  const start = starts.find(start=>defaultPath(start).some(choice=>choice.chart===chosen.chart));
  assert.ok(start,chosen.id);
  const choices = defaultPath(start,chosen);validPath(start,choices);
  const sourceEnglish = choices.map(choice=>entry(choice).english).join('');
  assert.equal(renderPlan(start,choices,en),sourceEnglish,chosen.id);
  const japanese = renderPlan(start,choices,ja);
  assert.ok(japanese.endsWith('。'),chosen.id);assert.doesNotMatch(japanese,/[A-Za-z{}]/,chosen.id);
  const planCharts = manifest.composition_plans[start].flatMap(part=>part.fragment_chart ? [part.fragment_chart] : Object.values(part.parameters));
  assert.deepEqual([...planCharts].sort((a,b)=>a-b),choices.map(choice=>choice.chart).sort((a,b)=>a-b));
 }
 const longest = new Map([[0,0]]);
 const maxBytes = chart => {
  if (longest.has(chart)) return longest.get(chart);
  const value = Math.max(...graph.get(chart).map(row=>Buffer.byteLength(row.english)+maxBytes(row.successor)));
  longest.set(chart,value);return value;
 };
 assert.equal(Math.max(...starts.map(maxBytes)),221);
 assert.ok(starts.every(start=>maxBytes(start)<250));
});

test('Japanese statements reorder family, litter and appearance roles without losing selected meaning', () => {
 const human = 'あなたは農奴の婚外子で、親から認知されていません。あなたは一族の厄介者です。あなたは濃い茶色の目と、まっすぐな黒色の髪、非常に浅黒い肌をしています。';
 assert.equal(renderPlan(1,defaultPath(1),ja),human);
 assert.equal(renderPlan(4,defaultPath(4),ja),'あなたの母親はアヴァリの出身です。'+human);
 assert.equal(renderPlan(5,defaultPath(5),ja),'あなたはアヴァリの野伏の子どもの一人です。あなたは薄い灰色の目と、まっすぐな黒色の髪と色白の肌をしています。');
 assert.equal(renderPlan(7,defaultPath(7),ja),'あなたはテレリの野伏の子どもの一人です。あなたは薄い灰色の目と、まっすぐな黒色の髪と色白の肌をしています。');
 assert.equal(renderPlan(16,defaultPath(16),ja),'あなたはドワーフの盗人の二人の子どもの一人です。あなたは一族の厄介者です。あなたは濃い茶色の目と、まっすぐな黒色の髪、長さ1フィートのひげ、浅黒い肌をしています。');
 assert.equal(renderPlan(21,defaultPath(21),ja),'あなたの母親は岩トロルの料理人でした。あなたは粘液のような緑色の目と、汚れた海藻のような緑色の髪、緑色で潰瘍のある肌をしています。');
 assert.equal(renderPlan(23,defaultPath(23),ja),'あなたは3匹きょうだいの中で最も小柄な子です。あなたの父親はキノコ農家で、母親は戦争捕虜でした。あなたは黒色の目と、濃い茶色の皮膚、大きく平たい歯をしています。');
});

test('tagged history capture leaves original selection, native text and RNG calls byte-exact', () => {
 const baseline = fs.readFileSync(path.join(root,'tests/accepted-source-snapshot/player-birth.c'));
 assert.deepEqual(Buffer.from(stripRecentAnnotations(core).replace(staticMarker,'').replace(captureMarker,'')),Buffer.from(stripRecentAnnotations(baseline.toString('utf8'))));
 const uiBaseline=fs.readFileSync(path.join(root,'tests/accepted-source-snapshot/ui-birth.c'));
 assert.deepEqual(Buffer.from(stripRecentAnnotations(ui).replace(uiMarker,'')),Buffer.from(stripRecentAnnotations(uiBaseline.toString('utf8'))));
 const accepted=JSON.parse(read('tests/accepted-source-snapshot/manifest.json'));
 for(const [file,bytes]of [['player-birth.c',baseline],['ui-birth.c',uiBaseline]]){
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),accepted.files.find(row=>row.file===file).sha256,file);
 }
 assert.equal([...core.matchAll(captureMarker)].length,12);
 const original=baseline.toString('utf8');
 assert.equal((core.match(/randint1\(100\)/g)??[]).length,(original.match(/randint1\(100\)/g)??[]).length);
 assert.match(core,/assert\(entry\);[\s\S]*?ab_history_capture_choice\(&source,chart,entry\);[\s\S]*?res = string_append\(res, entry->text\);/);
 assert.doesNotMatch(captures+helper,/\b(?:randint\w*|Rand\w*|one_in_|rand_range|dice_roll|effect_do|handle_stuff|update_stuff|msg|text_out)\s*\(/);
 assert.doesNotMatch(captures+helper,/player->history\s*=(?!=)|p->history\s*=(?!=)/);
 assert.match(captures,/ab_history_current_snapshot\(&tosave->history_source\)/);
 assert.match(captures,/ab_history_set_current\(&saved->history_source,player->history\)/);
 assert.match(helper,/record->successor!=entry->isucc/);
 assert.match(helper,/strcmp\(entry->text,record->english\)/,'English comparison verifies immutable source identity; it does not select a translation');
});

test('random-finish and edited command producers carry explicit provenance through the same queue slot', () => {
 assert.match(ui,/buf = get_history\(pr->history\);[\s\S]*?ab_history_last_generation\(&history_source\)/);
 assert.match(ui,/if\(cmds\[ncmd\].code==CMD_HISTORY_CHOICE\)[\s\S]*?ab_history_tag_generated\(cmdq_peek\(\),&history_source\)/);
 assert.match(ui,/cmd_set_arg_string\(cmdq_peek\(\), "history", history\);[\s\S]*?ab_history_tag_edit\(cmdq_peek\(\),history,player->history\)/);
 assert.match(captures,/ab_history_apply_command\(cmd,player->history\)/);
 assert.match(helper,/pending_history\[i\]\.argument==argument/);
 assert.match(helper,/edited && previous && !strcmp\(edited,previous\)/);
 assert.match(helper,/edited && previous && strcmp\(edited,previous\)/);
 assert.match(helper,/source.origin=AB_HISTORY_AUTHORED/);
 assert.match(helper,/memset\(&pending_history\[i\],0,sizeof\(pending_history\[i\]\)\)/);
 assert.match(header,/#define AB_HISTORY_MAX_CHOICES 32U/);
 assert.match(helper,/#define AB_HISTORY_PENDING_LIMIT 20U/);
});

test('only valid captured source identities reach generated formatter; authored text stays opaque', () => {
 const body = renderer.slice(renderer.indexOf('void ab_ui_history('),renderer.indexOf('struct ui_key_id'));
 assert.ok(body.indexOf('ab_history_snapshot_matches(&source,text)')<body.indexOf('AB_HISTORY_GENERATED'));
 assert.match(body,/"GeneratedHistory"/);assert.match(body,/"player.sheet.generated_history.value"/);
 assert.match(body,/source\.choices\[i\]\.chart/);assert.match(body,/source\.choices\[i\]\.cutoff/);
 assert.match(body,/else if\(source.origin==AB_HISTORY_AUTHORED\)/);
 assert.match(body,/AB_UI_OPAQUE\("history","verbatim_user_text",text\)/);
 assert.match(body,/__unsupported:%s/);
 assert.doesNotMatch(body,/ui_history_is_edited|ab_semantic_json_string\(&event,text\)/);
 assert.doesNotMatch(rust,/\b(?:unsafe|rand|randint|random|ffi|extern)\s*[!({]/);
 for(const check of ['history.grammar_version != GRAMMAR_VERSION','history.catalog_sha256 != CATALOG_SHA256','record.chart != expected','expected != 0'])assert.ok(rust.includes(check),check);
 assert.match(rust,/Locale::English[\s\S]*?self\.text\(record.id, locale\)/);
});

// Independent byte-contract examples, not execution of the C reader. Parent
// browser tests must exercise these malformed cases against compiled WASM.
function fnv(bytes) { let hash=2166136261;for(const byte of bytes)hash=Math.imul(hash^byte,16777619)>>>0;return hash; }
function wire(history, native, origin=1) {
 const payload=Buffer.alloc(60+history.length*4);let offset=0;
 const u32=value=>{payload.writeUInt32LE(value>>>0,offset);offset+=4;};
 const u16=value=>{payload.writeUInt16LE(value,offset);offset+=2;};
 u32(1);u32(1);payload[offset++]=origin;offset+=3;
 u16(origin===1?history[0].chart:0);u16(history.length);
 Buffer.from(manifest.catalog_sha256,'hex').copy(payload,offset);offset+=32;
 u32(origin===0?0:Buffer.byteLength(native));u32(origin===0?0:fnv(Buffer.from(native)));
 for(const choice of history){u16(choice.chart);u16(choice.cutoff);}
 u32(fnv(payload.subarray(0,offset)));assert.equal(offset,payload.length);return payload;
}
function verifyWire(payload,native) {
 assert.ok(payload.length>=60);assert.equal(payload.readUInt32LE(0),1);assert.equal(payload.readUInt32LE(4),1);
 const origin=payload[8],start=payload.readUInt16LE(12),count=payload.readUInt16LE(14);
 assert.ok(origin<=2 && count<=32);assert.ok(payload.subarray(9,12).every(byte=>byte===0));
 assert.equal(payload.length,60+count*4);assert.equal(payload.subarray(16,48).toString('hex'),manifest.catalog_sha256);
 assert.equal(payload.readUInt32LE(payload.length-4),fnv(payload.subarray(0,payload.length-4)));
 if(origin===0){assert.equal(start,0);assert.equal(count,0);assert.equal(payload.readUInt32LE(48),0);assert.equal(payload.readUInt32LE(52),0);return;}
 assert.equal(payload.readUInt32LE(48),Buffer.byteLength(native));assert.equal(payload.readUInt32LE(52),fnv(Buffer.from(native)));
 if(origin===2){assert.equal(start,0);assert.equal(count,0);return;}
 const choices=Array.from({length:count},(_,i)=>({chart:payload.readUInt16LE(56+i*4),cutoff:payload.readUInt16LE(58+i*4)}));
 validPath(start,choices);assert.equal(choices.map(choice=>entry(choice).english).join(''),native);
}
test('versioned save contract rejects malformed spans, choices, source/text binding and checksums', () => {
 const history=defaultPath(4),native=history.map(choice=>entry(choice).english).join(''),valid=wire(history,native);
 assert.equal(valid.length%4,0);verifyWire(valid,native);verifyWire(wire([],null,0),null);verifyWire(wire([],'外部で編集した経歴',2),'外部で編集した経歴');
 for(let size=0;size<valid.length;size++)assert.throws(()=>verifyWire(valid.subarray(0,size),native));
 for(const offset of [0,4,8,9,12,14,16,48,52,56,58,valid.length-1]){
  const invalid=Buffer.from(valid);invalid[offset]^=1;assert.throws(()=>verifyWire(invalid,native));
  if(offset<valid.length-4){invalid.writeUInt32LE(fnv(invalid.subarray(0,invalid.length-4)),invalid.length-4);assert.throws(()=>verifyWire(invalid,native));}
 }
 assert.throws(()=>verifyWire(valid,native+'x'));assert.throws(()=>verifyWire(Buffer.concat([valid,Buffer.from('xxx')]),native));
 const reader=helper.slice(helper.indexOf('int rd_web_biography('));
 assert.match(helper,/ab_web_save_bytes_remaining\(\)<1/);
 assert.match(reader,/version!=AB_BIOGRAPHY_WIRE_VERSION \|\| grammar!=AB_HISTORY_GRAMMAR_VERSION/);
 assert.match(reader,/source.origin>AB_HISTORY_AUTHORED \|\| source.count>AB_HISTORY_MAX_CHOICES/);
 assert.match(reader,/history_read_byte\(&wire\)!=0/);
 assert.match(reader,/ab_web_save_bytes_remaining\(\)!=\(size_t\)source.count\*4\+4/);
 assert.match(reader,/checksum!=wire.checksum/);
 assert.ok(reader.indexOf('ab_history_snapshot_matches(&source,player->history)')<reader.indexOf('current_history=source'));
 assert.ok(reader.indexOf('source.start_chart!=player->race->history->idx')<reader.indexOf('current_history=source'));
});
