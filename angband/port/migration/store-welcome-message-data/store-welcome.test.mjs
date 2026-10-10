import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {createHash}from'node:crypto';
import {fileURLToPath}from'node:url';
import path from'node:path';
import test from'node:test';
const here=path.dirname(fileURLToPath(import.meta.url)),port=path.resolve(here,'../..');
const json=n=>JSON.parse(readFileSync(path.join(here,n),'utf8'));
const en=json('en.json'),ja=json('ja.json'),schema=json('schema.json'),bindings=json('source-bindings.json');
function slots(text){
 const out=[];for(let i=0;i<text.length;i++){
  if((text[i]==='{'&&text[i+1]==='{')||(text[i]==='}'&&text[i+1]==='}')){i++;continue;}
  if(text[i]==='{'){const end=text.indexOf('}',i+1);assert.ok(end>i);out.push(text.slice(i+1,end));i=end;}
  else assert.notEqual(text[i],'}','unmatched template closing brace');
 }return out.sort();
}
const plain=text=>text.replaceAll('{{','{').replaceAll('}}','}');
const strip=s=>s.replace(/\r?\n\/\* AB_STORE_WELCOME_BEGIN \*\/\r?\n.*?\/\* AB_STORE_WELCOME_END \*\/\r?\n/gs,'').replace(/\/\* AB_STORE_WELCOME_INLINE_BEGIN \*\/.*?\/\* AB_STORE_WELCOME_INLINE_END \*\//gs,'');
test('six exact official source snapshots and111 catalog contracts',()=>{
 const pins=json('pinned-sources.json');assert.equal(pins.upstream_commit,'f3082213b73f3e463e3d0d60bff4b00462beae6e');assert.equal(pins.sources.length,6);
 for(const row of pins.sources){const b=readFileSync(path.join(port,row.file));assert.equal(b.length,row.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),row.sha256);}
 assert.equal(Object.keys(en).length,111);assert.deepEqual(Object.keys(en),Object.keys(ja));assert.deepEqual(Object.keys(en),Object.keys(schema.entries));
 for(const [id,e]of Object.entries(schema.entries)){assert.deepEqual(slots(en[id]),slots(ja[id]),id);assert.deepEqual([...new Set(slots(en[id]))],e.parameters.map(p=>p.name).sort(),id);assert.ok(!ja[id].includes('\uFFFD'),id);assert.equal(e.runtime_integrated,false);}
});
test('all99 hints bind exact raw H values, reverse parser order and literal braces',()=>{
 assert.equal(bindings.hints.length,99);
 const lines=readFileSync(path.join(here,'producer-snapshots/hints.txt'),'utf8').split(/\r?\n/);
 for(const h of bindings.hints){const e=schema.entries[h.id];assert.equal(e.identity.source_ordinal,h.source_ordinal);assert.equal(h.runtime_list_ordinal,98-h.source_ordinal);assert.equal(lines[e.sources[0].line-1],'H:'+h.raw_english);assert.equal(plain(en[h.id]),h.raw_english);assert.match(ja[h.id],/[\u3040-\u30ff\u3400-\u9fff]/u);}
 const parser=readFileSync(path.join(here,'producer-snapshots/init.c'),'utf8');assert.match(parser,/new->next = h;/);assert.match(parser,/hints = parser_priv\(p\);/);
 assert.equal(en['store.welcome.hint.inscribe_command'],"Inscribe items with the '{{' command.");
 assert.equal(plain(en['store.welcome.hint.inscribe_command']),"Inscribe items with the '{' command.");
});
test('native byte reconstruction retains all existing owner annotations',()=>{
 const base=readFileSync(path.join(here,'source-baseline.c'),'utf8'),current=readFileSync(path.join(port,'logic/ui-store.c'),'utf8'),proof=json('source-integration-proof.json');
 assert.equal(createHash('sha256').update(base).digest('hex'),proof.baseline_sha256);assert.equal(strip(current),base);assert.equal(proof.native_byte_reconstruction,true);
});
test('reservoir and greeting RNG are unchanged, without a second walk or comparison',()=>{
 const s=readFileSync(path.join(port,'logic/ui-store.c'),'utf8'),base=readFileSync(path.join(here,'source-baseline.c'),'utf8'),helper=readFileSync(path.join(port,'logic/web-store-welcome.c'),'utf8');
 const rng=s=>[...s.matchAll(/\b(?:one_in_|randint0)\([^)]*\)/g)].map(m=>m[0]);assert.deepEqual(rng(strip(s)),rng(base));
 assert.match(s,/AB_SW_HINT_WIN\(n-1,/);assert.match(s,/AB_SW_HINT_RESULT\(n-1,/);assert.equal((s.match(/AB_SW_HINT_MESSAGE\(i,/g)||[]).length,1);
 assert.doesNotMatch(helper,/one_in_|randint|strcmp|strstr|hints->|random_hint/);
 assert.match(helper,/native_count==\(int\)SW_COUNT\(ab_sw_hint_ids\)/);
 assert.match(s,/title\[\/\* AB_STORE_WELCOME_INLINE_BEGIN \*\/AB_SW_TITLE_RANK/);
});
test('customer data follows source slot counts and opaque name contracts',()=>{
 assert.equal(bindings.greetings.length,9);
 for(const g of bindings.greetings){const params=schema.entries[g.id].parameters;assert.equal(params[0].name,'owner');assert.equal(params[0].type,'verbatim_user_text');assert.equal(params.length,g.index<4?1:2);}
 assert.deepEqual(schema.entries['store.welcome.customer.player'].parameters,[{name:'name',type:'character_name'}]);
 assert.equal(en['store.welcome.customer.player'],'{name}');assert.equal(ja['store.welcome.customer.player'],'{name}');
 assert.equal(ja['store.welcome.customer.valued'],'お得意様');
 const helper=readFileSync(path.join(port,'logic/web-store-welcome.c'),'utf8');assert.match(helper,/if\(native_index>=4\)/);assert.match(helper,/AB_UI_OPAQUE\("name","character_name",native_customer\)/);assert.match(helper,/ab_ui_title_id\(\(int\)cidx,native_rank\)/);
});
test('no-greeting, Home, knowledge and exit paths clear current welcome only',()=>{
 const s=readFileSync(path.join(port,'logic/ui-store.c'),'utf8'),helper=readFileSync(path.join(port,'logic/web-store-welcome.c'),'utf8');
 assert.match(helper,/ab_semantic_event_begin\(&e,"","ui","store","__clear:welcome",0,-1\)/);
 assert.equal((s.match(/ab_sw_clear\(\);/g)||[]).length,2);
 assert.equal((s.match(/ab_sw_forget\(\);/g)||[]).length,2);
 const welcome=s.slice(s.indexOf('static void prt_welcome'),s.indexOf('/*** Display code ***/'));
 assert.ok(welcome.indexOf('ab_sw_clear();')<welcome.indexOf('one_in_(2)'));
 assert.match(s,/if \(store->feat != FEAT_HOME\)[\r\n\s]+prt_welcome\(store->owner\)/);
 assert.doesNotMatch(helper,/__begin_replace|ab_ui_scope_begin/);
});
test('hint emits one semantic timeline event and preserves original native msg',()=>{
 const helper=readFileSync(path.join(port,'logic/web-store-welcome.c'),'utf8');
 assert.equal((helper.match(/"message","store","welcome"/g)||[]).length,1);
 assert.equal((helper.match(/ab_ui_emit\("store","welcome","store.welcome.hint"/g)||[]).length,1);
 const native=strip(readFileSync(path.join(port,'logic/ui-store.c'),'utf8'));
 assert.match(native,/msg\(comment_hint\[i\], random_hint\(\)\)/);
 assert.match(native,/prt\(format\(comment_welcome\[i\], short_name, player_name\), 0, 0\)/);
});
test('wording retains important ratios, negations, conditions, key tokens and canonical terms',()=>{
 for(const [key,pattern]of [['basic_resistance_one_third',/3分の1/],['speed_ten_twice_normal',/\+10.*2倍/],['higher_resistance_reduction',/33%～50%/],['quiver_mixed_ammo_forty',/40.*1枠/],['empty_devices_sell_well',/0/],['hold_life_not_all_drain',/大部分.*すべて.*わけではない/],['wounded_spells_same_strength',/同じ強さ/],['time_not_mitigated_sustains',/軽減できない/],['held_monster_no_action',/切れるかダメージ.*まで/],['nexus_four_effects',/因果混乱.*引き寄せ.*遠方.*階層移動.*入れ替え/]])assert.match(ja['store.welcome.hint.'+key],pattern,key);
 for(const [key,token]of [['inscription_confirm_sell','!s'],['inscription_confirm_drop','!d'],['inscription_confirm_destroy','!k'],['inscription_confirm_throw','!v'],['inscription_confirm_all','!*'],['throw_weapon_inscription','@v0']])assert.ok(ja['store.welcome.hint.'+key].includes(token),key);
 assert.match(ja['store.welcome.hint.blackguard_open_wounds_recovery'],/暗黒戦士.*開いた傷口/);
 assert.match(ja['store.welcome.hint.shape_inspect_resume_commands'],/「I」.*「m」.*「p」/);
});
