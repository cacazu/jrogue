import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFileSync(path.join(root,file),'utf8');
const manifest=JSON.parse(read('migration/look-target-data/source-manifest.json'));
const baseline=JSON.parse(read('migration/look-target-data/integration-baseline.json'));
const en=Object.fromEntries(manifest.entries.map(entry=>[entry.id,entry.english]));
const ja=Object.fromEntries(manifest.entries.map(entry=>[entry.id,entry.japanese]));
const helper=read('logic/web-look-target.c'), header=read('logic/web-look-target.h');
const helperCode=helper.replace(/\/\*[\s\S]*?\*\//g,'');
const strip=source=>source.replace(/\/\* AB_LOOK_TARGET_(?:INLINE_)?BEGIN \*\/[\s\S]*?\/\* AB_LOOK_TARGET_(?:INLINE_)?END \*\//g,'');
const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
const format=(id,params,locale='en')=>(locale==='ja'?ja:en)[id].replace(/\{(\w+)\}/g,(_,key)=>{
 assert.ok(Object.hasOwn(params,key),id+':'+key);return String(params[key]);
});

test('132 reviewed source IDs declare identical EN/JA parameter contracts',()=>{
 assert.equal(manifest.entries.length,132);assert.equal(new Set(manifest.entries.map(e=>e.id)).size,132);
 for(const entry of manifest.entries){
  const fields=entry.parameters.map(p=>p.name).sort();
  assert.deepEqual(placeholders(entry.english),fields,entry.id+':en');
  assert.deepEqual(placeholders(entry.japanese),fields,entry.id+':ja');
  assert.ok(!entry.japanese.includes('\ufffd'),entry.id);
  assert.ok(entry.source.file&&entry.source.symbol,entry.id);
 }
 assert.deepEqual(manifest.entries.filter(e=>e.japanese==='').map(e=>e.id).sort(),[
  'angband.look.empty','angband.look.article.a','angband.look.article.an',
  'angband.look.terrain.prefix.a','angband.look.terrain.prefix.an',
  'angband.look.carry.first','angband.look.terrain.prefix.some'].sort());
});

test('all three edited C files reconstruct every pinned original byte',()=>{
 for(const [file,facts] of Object.entries(baseline.files)){
  const bytes=readFileSync(path.join(root,'migration/look-target-data/source-baseline',file));
  assert.equal(bytes.length,facts.bytes,file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),facts.sha256,file);
  assert.deepEqual(Buffer.from(strip(read('logic/'+file))),bytes,file);
 }
});

test('the complete visible native prose family remains covered at every sink',()=>{
 const source=read('logic/ui-target.c');
 assert.equal((source.match(/ab_look_emit\(/g)||[]).length,8);
 for(const role of ['STRANGE','MONSTER','OBJECT','CARRY','TRAP','PILE','TERRAIN'])assert.ok(source.includes('AB_LOOK_'+role),role);
 assert.match(source,/ab_look_emit\(&auxst->web,AB_LOOK_PILE,floor_num\);[\s\S]*?prt\(out_val, 0, 0\)/);
 // Source original handler precedence and all keyboard/mouse policies survive exact reconstruction.
 assert.match(strip(source),/aux_reinit,\s+aux_hallucinate,\s+aux_monster,\s+aux_trap,\s+aux_object,\s+aux_terrain,\s+aux_wrapup/);
});

test('all 40 normal and wizard trap identities follow native parser order and fields',()=>{
 const records=read('data/gamedata/trap.txt').split(/\r?\n/).map((line,index)=>({line,index})).filter(r=>r.line.startsWith('name:'));
 assert.equal(records.length,40);assert.equal(manifest.trap_records.length,40);
 for(let index=0;index<records.length;index++){
  const [,wizard,normal]=records[index].line.split(':'),record=manifest.trap_records[index];
  assert.equal(record.index,index);assert.equal(record.source_line,records[index].index+1);
  assert.equal(en[record.normal_id],normal);assert.equal(en[record.wizard_id],wizard);
  assert.equal(en[record.article_id],/^[aeiou]/i.test(normal)?'an ':'a ');
  assert.ok(helper.includes(JSON.stringify(record.normal_id)));assert.ok(helper.includes(JSON.stringify(record.wizard_id)));
 }
 const pit=manifest.trap_records[7];assert.equal(en[pit.normal_id],'spiked pit');assert.equal(en[pit.wizard_id],'pit');
 // Native wizard article is selected from desc, even for generic explosion naming.
 assert.equal(format('angband.look.subject.trap',{article:en[manifest.trap_records[27].article_id],name:en[manifest.trap_records[27].wizard_id]}),'a explosion');
 assert.equal(format('angband.look.subject.trap',{article:ja[pit.article_id],name:ja[pit.normal_id]},'ja'),'トゲ付き落とし穴');
});

test('25 canonical terrain bindings preserve explicit directive bytes and unknown/mimic boundaries',()=>{
 assert.equal(manifest.terrain_records.length,25);
 for(const terrain of manifest.terrain_records){
  const prefix=terrain['look-prefix']??(/^[aeiou]/i.test(terrain.name)?'an ':'a ');
  assert.equal(en[terrain.prefix_id],prefix,terrain.code);
  assert.equal(en[terrain.preposition_id],terrain['look-in-preposition']??'on ',terrain.code);
  assert.ok(helper.includes('FEAT_'+terrain.code+','),terrain.code);
 }
 const producer=read('logic/cave-square.c');
 assert.match(producer,/const struct feature \*fp = f_info\[actual\]\.mimic \?\s*f_info\[actual\]\.mimic : &f_info\[actual\];[\s\S]*?ab_look_feature_selected\(fp->fidx\);[\s\S]*?return fp->name;/);
 const terrain=manifest.terrain_records.find(t=>t.code==='NONE');assert.equal(terrain.name_id,'terrain.none.name');
 assert.equal(en[manifest.terrain_records.find(t=>t.code==='OPEN').preposition_id],'in');
 assert.equal(en[manifest.terrain_records.find(t=>t.code==='LAVA').prefix_id],'some');
});

test('perception policy is captured only in original selected branches',()=>{
 const source=read('logic/ui-target.c');
 for(const [text,role] of [['You are ',0],['You see ',1],['You sense ',2],['You recall ',3]]){
  const start=source.indexOf('auxst->phrase1 = '+JSON.stringify(text)+';');
  assert.ok(start>=0);assert.ok(source.slice(start,start+230).includes('auxst->web.intro='+role+';'));
 }
 // Pure helper never repeats hidden-info, naming, health, or RNG queries.
 assert.doesNotMatch(helperCode,/\b(?:square\w*|cave_monster|monster_is\w*|monster_desc|object_desc|get_lore|rand\w*|one_in_|damroll|dice_roll)\s*\(/);
 assert.doesNotMatch(helperCode,/\b(?:strcmp|strstr|strtok)\s*\(/);
 assert.doesNotMatch(helperCode,/\b(?:player|cave|mon|obj|trap)->/);
});

test('condition source selections retain exact health thresholds and eight native status branches',()=>{
 const source=read('logic/target.c'),native=strip(source);
 for(const boundary of ['mon->hp >= mon->maxhp','perc >= 60','perc >= 25','perc >= 10'])assert.ok(native.includes(boundary));
 assert.equal((source.match(/AB_LOOK_CONDITION_HEALTH\(buf,living,/g)||[]).length,5);
 assert.equal((source.match(/AB_LOOK_CONDITION_STATUS\(buf,/g)||[]).length,8);
 for(let i=0;i<8;i++)assert.equal((source.match(new RegExp('AB_LOOK_CONDITION_STATUS\\(buf,'+i+'\\)','g'))||[]).length,1);
 assert.match(helper,/buffer==condition_buffer && grade>=0 && grade<5/);
 assert.match(helper,/buffer==condition_buffer && status>=0 && status<8/);
 assert.match(helper,/state->condition.complete=state->condition.health!=NULL/);
});

test('source argument wrappers return their single original evaluation',()=>{
 assert.match(header,/#define AB_LOOK_INT\(destination,original\) ab_look_int\(\(destination\),\(original\)\)/);
 assert.match(helper,/int ab_look_int\(int \*destination,int original\)\s*\{if\(destination\)\*destination=original;return original;\}/);
 assert.match(helper,/bool ab_look_wizard\(struct ab_look_state \*state,bool original\)\s*\{if\(state\)state->wizard=original;return original;\}/);
 assert.match(header,/#else[\s\S]*#define AB_LOOK_INT\(destination,original\) \(original\)/);
 assert.match(read('logic/target.c'),/AB_LOOK_COORD_DISTANCE\(buf,true, [\s\S]*?ABS\(y - py\)/);
});

test('owned names are copied before additional native UI activity, then released on all exits',()=>{
 const source=read('logic/ui-target.c');
 assert.match(source,/monster_desc\(m_name,[\s\S]*?ab_look_name\(&auxst->web,m_name,false\);[\s\S]*?handle_stuff\(p\);/);
 assert.equal((source.match(/ab_look_name\(.*o_name,true\)/g)||[]).length,2);
 assert.match(helper,/ab_naming_snapshot_release\(destination\);[\s\S]*?ab_naming_copy_object_snapshot\(destination,buffer\)/);
 assert.match(source,/ab_look_release\(&auxst.web\);[\s\S]*?return auxst.press;/);
 assert.match(helper,/coordinate_owner=NULL;coordinate_buffer=NULL;coordinate_parts=0/);
 assert.match(helper,/condition_owner=NULL;condition_buffer=NULL/);
});

test('Japanese prose translates grammar and cardinal direction without changing opaque names',()=>{
 const name='a blade {猫}: %n ユーザー名';
 const coordinates=format('angband.look.coordinates',{vertical:0,north_south:ja['angband.look.direction.north'],horizontal:12,east_west:ja['angband.look.direction.west']},'ja');
 assert.equal(coordinates,'北に0、西に12');
 const text=format('angband.look.row.sense',{preposition:'',subject:name,condition:'（眠っている）',coordinates,diagnostics:''},'ja');
 assert.equal(text,'北に0、西に12にa blade {猫}: %n ユーザー名（眠っている）の存在を感じる。');
 assert.ok(!text.includes('You sense'));assert.ok(text.includes(name));
});

test('wizard diagnostics and carried objects cannot enter nonwizard prose',()=>{
 assert.match(helper,/if\(content==AB_LOOK_CARRY && \(!state->wizard \|\| state->gender<0 \|\| state->gender>2\)\)return;/);
 assert.match(helper,/if\(state->wizard\)\{[\s\S]*?ID\("diagnostics"\)[\s\S]*?\}else parameter_ref\(&event,"diagnostics",ID\("empty"\)\)/);
 assert.match(helper,/state->wizard\?lexical->wizard:lexical->normal/);
 assert.match(read('logic/ui-target.c'),/AB_LOOK_TRAP_ARTICLE\(&auxst->web, [\s\S]*?is_a_vowel\(trap->kind->desc\[0\]\)/);
 assert.match(helper,/state->article_an\?ID\("article.an"\):ID\("article.a"\)/);
});

test('every source-specific scope rejects incomplete handoffs instead of publishing stale text',()=>{
 assert.match(helper,/!state \|\| !state->coordinates \|\| state->intro<0 \|\| state->intro>3/);
 assert.match(helper,/coordinate_owner!=state\)return/);assert.match(helper,/coordinate_parts==15U/);
 assert.match(helper,/condition_owner!=state\)return/);
 assert.match(helper,/!state->condition.complete\)\{event->valid=false;return;/);
 assert.match(helper,/!state->terrain \|\| !terrain\)\{event->valid=false;return;/);
 assert.match(helper,/!name->json \|\| !name->length\)\{event->valid=false;return;/);
});
