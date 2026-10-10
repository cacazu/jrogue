import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const port=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const family=path.join(port,'migration/list-message-data');
const read=f=>readFileSync(path.join(port,f),'utf8');
const json=f=>JSON.parse(readFileSync(path.join(family,f),'utf8'));
const native=f=>readFileSync(path.join(family,'source-baseline',f),'utf8');
const en=json('en.json'),ja=json('ja.json'),schema=json('schema.json'),manifest=json('source-manifest.json');
const helper=read('logic/web-list-text.c'),header=read('logic/web-list-text.h');
const mon=read('logic/ui-mon-list.c'),obj=read('logic/ui-obj-list.c');
const naming=read('logic/web-naming.c');
const strip=s=>s.replace(/\/\* AB_LIST_TEXT_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_LIST_TEXT_INLINE_END \*\//g,'').replace(/\/\* AB_LIST_TEXT_BEGIN \*\/[\s\S]*?\/\* AB_LIST_TEXT_END \*\//g,'');
const placeholders=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
function body(source,name){
 const start=source.indexOf(name+'(');assert.ok(start>=0,name);const open=source.indexOf('{',start);let level=1,i=open+1;
 // This helper is for named functions without brace-containing strings in these test ranges.
 while(level&&i<source.length){const c=source[i++];if(c==='{')level++;else if(c==='}')level--;}
 assert.equal(level,0,name);return source.slice(open+1,i-1);
}

test('all33 authored templates have matching typed named parameters and intact Japanese',()=>{
 assert.equal(Object.keys(en).length,33);assert.deepEqual(Object.keys(en).sort(),Object.keys(ja).sort());
 assert.deepEqual(Object.keys(en).sort(),Object.keys(schema.entries).sort());
 for(const[id,entry]of Object.entries(schema.entries)){
  const slots=entry.parameters.map(p=>p.name).sort();assert.deepEqual(placeholders(en[id]),slots,id);assert.deepEqual(placeholders(ja[id]),slots,id);
  assert.ok(!ja[id].includes('\ufffd'),id);assert.ok(entry.sources.length>0,id);
 }
 assert.equal(schema.entries['angband.list.monster.row'].parameters[0].type,'MonsterDescription');
 assert.equal(schema.entries['angband.list.object.row'].parameters[0].type,'KnownObjectDescription');
 assert.equal(manifest.complete_game_translation,false);
});

test('all exact role-local provenance occurs at its pinned original source line',()=>{
 for(const[id,entry]of Object.entries(schema.entries))for(const source of entry.sources){
  const bytes=read(source.provenance_file),lineOffset=bytes.split('\n').slice(0,source.line-1).join('\n').length+(source.line>1?1:0),start=bytes.indexOf(source.original_call,lineOffset);
  assert.ok(start>=0,id+':'+source.file);assert.equal(bytes.slice(0,start).split('\n').length,source.line,id);
 }
 for(const source of manifest.format_call_boundaries)assert.ok(native(path.basename(source.file)).includes(source.original_call));
});

test('all13 native append sites are inventoried:9 visible and4 layout-only',()=>{
 assert.equal(manifest.append_producer_count,13);assert.equal(manifest.visible_append_producer_count,9);assert.equal(manifest.layout_only_append_count,4);
 const expected=manifest.append_producers.map(s=>s.file+':'+s.line).sort();let actual=[];
 for(const f of ['ui-mon-list.c','ui-obj-list.c']){
  const source=native(f);for(const match of source.matchAll(/\btextblock_append(?:_c)?\(/g))actual.push('logic/'+f+':'+source.slice(0,match.index).split('\n').length);
 }
 assert.deepEqual(actual.sort(),expected);
 for(const source of manifest.append_producers)assert.ok(native(path.basename(source.file)).includes(source.original_call));
 assert.equal(manifest.additional_sort_literal_producers,2);
});

test('all three C producers preserve every pre-integration byte including fixed terminal columns',()=>{
 for(const[name,facts]of Object.entries(json('integration-baseline.json').files)){
  const baseline=readFileSync(path.join(family,'source-baseline',name));
  assert.equal(createHash('sha256').update(baseline).digest('hex'),facts.sha256,name);assert.equal(baseline.length,facts.bytes,name);
  assert.deepEqual(Buffer.from(strip(read('logic/'+name))),baseline,name);
 }
});

test('naming modification preserves construction, cache and all prior code; only notices gain a guard',()=>{
 let s=naming;
 s=s.replace(/\n\/\* List formatting owns explicit rows; nesting-safe suppression affects notices only\. \*\/\nstatic uint32_t ab_naming_notice_depth;\nbool ab_naming_notice_suppress_begin\(void\)\n\{\n if\(ab_naming_notice_depth==UINT32_MAX\)return false;\n ab_naming_notice_depth\+\+;return true;\n\}\nvoid ab_naming_notice_suppress_end\(bool acquired\)\n\{\n if\(acquired&&ab_naming_notice_depth\)ab_naming_notice_depth--;\n\}/,'');
 s=s.replace(' if(ab_naming_notice_depth)return;\n','');
 const before=readFileSync(path.join(family,'naming-notice-baseline','web-naming.c'));
 assert.deepEqual(Buffer.from(s),before);
 assert.equal(createHash('sha256').update(before).digest('hex'),manifest.notice_baseline['web-naming.c'].sha256);
 const h=read('logic/web-naming.h').replace('/* Balanced token: false at saturation must not release an outer scope. */\nbool ab_naming_notice_suppress_begin(void);\nvoid ab_naming_notice_suppress_end(bool acquired);\n','');
 assert.deepEqual(Buffer.from(h),readFileSync(path.join(family,'naming-notice-baseline','web-naming.h')));
 assert.match(naming,/memset\(&s->value,0,sizeof\(s->value\)\);\n if\(ab_naming_notice_depth\)return;\n ab_semantic_event_begin/);
});

test('both formatters own a balanced suppression token at every normal or early exit',()=>{
 for(const[source,prefix,kind]of [[mon,'monster','AB_LIST_MONSTER'],[obj,'object','AB_LIST_OBJECT']]){
  const start=source.indexOf('static void '+prefix+'_list_format_textblock('),end=source.indexOf('\n/**',start+1),format=source.slice(start,end);
  assert.equal((format.match(/ab_naming_notice_suppress_begin\(\)/g)||[]).length,1);
  assert.equal((format.match(/return;/g)||[]).length,2);
  assert.equal((format.match(new RegExp('AB_LIST_FORMAT_END\\('+kind+',tb,ab_list_notice_guard\\)','g'))||[]).length,2);
  assert.equal((format.match(new RegExp('ab_list_format_end\\('+kind+',tb!=NULL,ab_list_notice_guard\\)','g'))||[]).length,1);
  assert.match(format,/bool ab_list_notice_guard=ab_naming_notice_suppress_begin\(\);\r?\nif\(tb!=NULL\)ab_list_begin/);
 }
 assert.match(helper,/if\(real_textblock\)ab_list_end\(kind\);\r?\n ab_naming_notice_suppress_end\(notice_guard\);/);
 assert.match(header,/#define AB_LIST_FORMAT_END\(k,t,g\) \(\(void\)0\)/); // native ignores browser-only tokens
 assert.match(naming,/static uint32_t ab_naming_notice_depth;/); // zero-initialized, not a persistent gameplay field
 assert.match(naming,/if\(ab_naming_notice_depth==UINT32_MAX\)return false;\n ab_naming_notice_depth\+\+;return true;/);
 assert.match(naming,/if\(acquired&&ab_naming_notice_depth\)ab_naming_notice_depth--;/); // saturated false token cannot pop outer scope
});

test('copied monster names come from the original producer before clipping; measurements copy no row',()=>{
 assert.match(mon,/get_mon_name\(line_buffer[\s\S]*?count\[section\]\);\/\* AB_LIST_TEXT_BEGIN \*\/[\s\S]*?if\(tb!=NULL\)ab_list_monster_name\(&ab_list_row,line_buffer\);[\s\S]*?utf8_clipto\(line_buffer, name_width\)/);
 assert.match(mon,/ab_list_row_emit\(AB_LIST_MONSTER,&ab_list_row,asleep_in_section\);\r?\nab_list_row_release\(&ab_list_row\);/);
 const copy=body(helper,'ab_list_monster_name');assert.match(copy,/ab_naming_copy_monster_snapshot/);assert.doesNotMatch(copy,/monster_desc|get_mon_name|strcmp|strstr/);
});

test('object snapshot freezes the original inner buffer before strtok, with bounded pending ownership',()=>{
 const source=read('logic/obj-list.c');
 assert.match(source,/object_desc\(name, sizeof\(name\), base_obj[\s\S]*?player\);\/\* AB_LIST_TEXT_BEGIN \*\/[\s\S]*?ab_list_object_name_capture\(name\);[\s\S]*?chunk = strtok\(name, " "\)/);
 assert.match(obj,/if\(tb!=NULL\)ab_list_object_name_begin\(&ab_list_row\);[\s\S]*?object_list_format_name\([\s\S]*?if\(tb!=NULL\)ab_list_object_name_end\(&ab_list_row\);[\s\S]*?utf8_clipto/);
 assert.match(obj,/ab_list_row_emit\(AB_LIST_OBJECT,&ab_list_row,0\);\r?\nab_list_row_release\(&ab_list_row\);/);
 assert.match(helper,/if\(pending_object\)ab_naming_copy_object_snapshot\(&pending_object->snapshot,original_buffer\);/);
 assert.match(helper,/if\(pending_object==row\)pending_object=NULL;/);
 assert.match(helper,/ab_naming_snapshot_release\(&row->snapshot\);/);
 assert.match(native('obj-list.c'),/char name\[80\]/);
});

test('counts, source-selected sleep roles, sign directions and original absolute values are captured once',()=>{
 assert.equal((mon.match(/abs\(list->entries\[index\]\.(?:dx|dy)\[section\]\)/g)||[]).length,2);
 assert.equal((obj.match(/abs\(list->entries\[entry_index\]\.(?:dx|dy)\)/g)||[]).length,2);
 assert.match(mon,/AB_LIST_INT\(&ab_list_header_count,[\s\S]*?list->total_monsters\[section\]/);
 assert.match(obj,/AB_LIST_INT\(&ab_list_header_count,[\s\S]*?list->total_entries\[section\]/);
 assert.match(obj,/remaining_object_total = total - entry_index;/);
 assert.match(mon,/if \(asleep_in_section > 0 && count_in_section > 1\)[\s\S]*?AB_LIST_SLEEP\(&ab_list_row,2\)/);
 assert.match(mon,/else if \(asleep_in_section == 1 && count_in_section == 1\)[\s\S]*?AB_LIST_SLEEP\(&ab_list_row,1\)/);
 for(const s of [mon,obj])assert.match(s,/AB_LIST_BOOL\(&ab_list_row.north,[\s\S]*?<= 0/);
 assert.doesNotMatch(helper,/\b(?:Rand_[A-Za-z0-9_]*|randint[0-9]*|one_in_|projectable|object_desc|monster_desc|get_mon_name|strtok|abs|strcmp|strstr)\s*\(/);
});

test('real formatting commits before native blocking input and exits reset owned contexts',()=>{
 assert.match(helper,/states\[kind\].cursor=1;/);assert.match(helper,/strnfmt\(out,size,"row\.%u\.label",states\[kind\].cursor\+\+\)/);
 assert.match(helper,/"__row:0"[\s\S]*?ab_semantic_json_int32\(&event,120\)/);
 assert.match(helper,/ab_semantic_event_emit_control\(&event\);ab_ui_scope_end\(\);/);
 assert.match(mon,/ab_list_sort_prompt\(true\);[\s\S]*?ab_list_sort_prompt\(false\);[\s\S]*?ch = textui_textblock_show/);
 assert.match(mon,/while \(ch.code == 'x'\);[\s\S]*?ab_list_reset\(AB_LIST_MONSTER\)/);
 assert.match(obj,/textui_textblock_show\(tb, r, NULL\);[\s\S]*?ab_list_reset\(AB_LIST_OBJECT\)/);
 assert.match(mon,/if \(tb != NULL\)[\s\S]*?AB_LIST_HALLUCINATION/);
 assert.equal(body(native('ui-obj-list.c'),'object_list_format_special').trim(),'return false;');
});

test('interactive list emits whole measured height, not only the24-row viewport',()=>{
 for(const source of manifest.format_call_boundaries){assert.ok(source.original_call.includes('max_height'));assert.ok(!source.original_call.includes('page_rows'));}
 assert.match(native('ui-mon-list.c'),/\*max_height_result = header_lines \+/);assert.match(native('ui-obj-list.c'),/\*max_height_result = header_lines \+/);
 assert.match(native('ui-mon-list.c'),/monster_list_format_textblock\(list, NULL, 1000, 1000/);
 assert.match(native('ui-obj-list.c'),/object_list_format_textblock\(list, NULL, 1000, 1000/);
 assert.match(read('logic/obj-list.h'),/#define MAX_ITEMLIST 2560/);
});

test('reported descriptor/event bounds are the actual hard limits, not the unused4096 macro',()=>{
 const h=read('logic/web-naming.h');assert.match(h,/#define AB_NAMING_SNAPSHOT_MAX_BYTES \(128U \* 1024U\)/);
 assert.match(naming,/if\(s->part_count>=32\)/);assert.match(h,/#define AB_NAMING_CACHE_ENTRIES 64U/);assert.match(h,/#define AB_NAMING_CACHE_MAX_BYTES \(1024U \* 1024U\)/);
 assert.equal(manifest.capture_limits.naming_snapshot_bytes,131072);assert.equal(manifest.capture_limits.naming_parts,32);
 assert.match(manifest.capture_limits.unforced_macro,/not enforced/);
});
