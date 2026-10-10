import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const naming=/\/\* AB_NAMING_BEGIN \*\/[\s\S]*?\/\* AB_NAMING_END \*\//g;
const strip=s=>s.replace(naming,'').replace(/\/\* AB_GAME_STATIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_STATIC_END \*\//g,'').replace(/\/\* AB_GAME_DYNAMIC_BEGIN \*\/[\s\S]*?\/\* AB_GAME_DYNAMIC_END \*\//g,'');
const objects=read('logic/obj-desc.c'),monsters=read('logic/mon-desc.c'),helper=read('logic/web-naming.c'),header=read('logic/web-naming.h'),data=read('logic/web-naming-data.h');
const bindings=JSON.parse(read('migration/naming-data/source-bindings.json'));
const grammar=JSON.parse(read('migration/naming-data/grammar.json'));
const en=JSON.parse(read('migration/naming-data/en.json')),ja=JSON.parse(read('migration/naming-data/ja.json'));
const body=(s,name)=>{const start=s.indexOf(name+'(');assert.ok(start>=0,name);return s.slice(start,s.indexOf('\n}',start)+2);};

test('whole native object/monster producers reconstruct pinned official bytes, not a rewritten model',()=>{
 for(const file of ['obj-desc.c','mon-desc.c']){
  const pristine=read('migration/naming-data/producer-snapshots/'+file);
  assert.deepEqual(Buffer.from(strip(read('logic/'+file))),Buffer.from(pristine),file);
  assert.ok(pristine.includes('\r\n'));
 }
 const chest=body(read('logic/obj-chest.c'),'chest_trap_name');
 assert.equal(strip(chest),body(read('migration/naming-data/producer-snapshots/obj-chest.c'),'chest_trap_name'));
 assert.equal(strip(body(read('logic/mon-util.c'),'steal_monster_item')),body(read('migration/naming-data/producer-snapshots/mon-util.c'),'steal_monster_item'));
});

test('all native knowledge, charge-count and gender predicates retain exactly their original evaluation count',()=>{
 for(const [file,names] of [['obj-desc.c',['object_is_known_artifact','object_flavor_is_aware','object_runes_known','number_charging','ignore_item_ok','quark_str','object_to_hit','object_to_dam','object_to_ac']],['mon-desc.c',['monster_is_visible','monster_is_shape_unique','is_a_vowel','panel_contains','plural_aux']]]){
  const original=read('migration/naming-data/producer-snapshots/'+file),current=read('logic/'+file);
  for(const name of names){const re=new RegExp('\\b'+name+'\\s*\\(','g');assert.equal([...current.matchAll(re)].length,[...original.matchAll(re)].length,file+':'+name);}
 }
 const noComments=helper.replace(/\/\*[\s\S]*?\*\//g,'');
 for(const name of ['object_desc','monster_desc','monster_is_visible','monster_is_shape_unique','ignore_item_ok','object_is_known_artifact','object_runes_known','quark_str','number_charging','randint0','randint1','one_in_','object_delete','drop_near','msg','msgt'])assert.doesNotMatch(noComments,new RegExp('\\b'+name+'\\s*\\('),name);
 assert.doesNotMatch(noComments,/(?:artifact|ego|race|kind|trap)->\w+\s*(?:=(?!=)|\+\+|--)/);
});

test('selected source branches cover native early returns, all naming modes and ordered annotations',()=>{
 assert.match(objects,/AB_NAMING_OBJECT_FINISH\([\s\S]*?strnfmt\(buf, max, "\(nothing\)"/);
 for(const role of ['object.unknown.prefixed','object.unknown.plain','object.annotation.empty','object.annotation.tried','object.annotation.cursed','object.annotation.ignore','object.annotation.unknown','object.store.unseen','object.store.unknown','object.store.cursed'])assert.ok(objects.includes('"'+role+'"'),role);
 assert.match(objects,/AB_NAMING_MONEY_IGNORE\([\s\S]*?ignore_item_ok\(p, obj\)/);
 assert.match(objects,/AB_NAMING_NUMBER\("charging", [\s\S]*?number_charging\(obj\)/);
 assert.match(objects,/u\[n\+\+\] = quark_str\(obj->note\)[\s\S]*?ab_naming_inscription_user\(u\[n - 1\]\)/);
 assert.match(objects,/obj_desc_combat\(obj->known, buf, max, end, mode, p\)/);
 assert.doesNotMatch(objects,/ab_naming_monster_capital|ab_naming_object_capital/,'object CAPITAL stays native no-op');
 assert.match(monsters,/ab_naming_monster_pronoun\(msex \+ \(mode & 0x07\)\)/);
 assert.match(monsters,/ab_naming_monster_race\(race, false, "explicit"\)/);
 assert.match(monsters,/ab_naming_monster_race\(race, false, "regular"\)/);
});

test('private table identities and hashes agree with reviewed catalogs; wire contains no numeric entity identity',()=>{
 assert.ok(data.includes('source-bindings sha256 '+digest('migration/naming-data/source-bindings.json')));
 assert.ok(data.includes('grammar sha256 '+digest('migration/naming-data/grammar.json')));
 for(const key of ['object_kinds','object_bases','flavors','artifacts','egos','monster_races','chest_traps'])for(const record of bindings[key]){
  for(const endpoint of ['name_id','modifier_id','plural_id','possessive_name_id'])if(record[endpoint]){
   assert.ok(data.includes(JSON.stringify(record[endpoint])),key+':'+record[endpoint]);
   assert.equal(typeof en[record[endpoint]],'string');assert.equal(typeof ja[record[endpoint]],'string');
  }
 }
 for(const role of grammar.rules)assert.ok(data.includes(JSON.stringify(role.role)),role.role);
 const emitted=[...helper.matchAll(/ab_field_(?:string|number|bool)\([^,]+,\s*"([^"]+)"/g)].map(m=>m[1]);
 for(const field of ['kidx','aidx','eidx','ridx','fidx','sval','subject_address','buffer_address','artifact_index','race_index'])assert.ok(!emitted.includes(field),field);
 assert.match(helper,/s->modifier_used&&modifier/);
 assert.match(helper,/id=strip\?b->stem:b->id/,'selected possessive stem only');
 assert.match(helper,/ab_field_bool\(s,"strip_appositive",false\)/);
 assert.match(helper,/if\(code>=0x24&&code<=0x26\)code-=0x10/,'someone does not disclose suppressed gender');
});

test('immutable buffer cache is bounded, invalidates stale writes and never examines native description contents',()=>{
 assert.match(header,/AB_NAMING_CACHE_ENTRIES 64U/);assert.match(header,/AB_NAMING_CACHE_MAX_BYTES \(1024U \* 1024U\)/);
 const begin=body(helper,'ab_begin');assert.match(begin,/ab_naming_invalidate_buffer\(buffer\)/);
 const finish=body(helper,'ab_finish');assert.match(finish,/while\(ab_cache_bytes\+s->value.length>AB_NAMING_CACHE_MAX_BYTES\)/);
 assert.match(finish,/ab_cache_remove\(ab_cache_oldest\(\)\)/);
 assert.ok(finish.indexOf('ab_object_session=s->previous')<finish.indexOf('ab_semantic_event_emit'));
 const copy=body(helper,'ab_copy');assert.match(copy,/memcpy\(out->json,found->json/);
 assert.doesNotMatch(copy,/->(?:known|race|artifact|ego|number)|strcmp\([^,]*(?:buffer|address)|strlen\([^)]*(?:buffer|address)/);
 assert.match(body(helper,'ab_naming_copy_json_for_buffer'),/ab_missing\(event\)/);
 assert.match(helper,/"reason\\":\\"NoDescriptorSnapshot/);
});

test('random names and user inscriptions remain explicitly owned proper-name inputs, never completed English substitutions',()=>{
 assert.match(helper,/generated_randart_name/);assert.match(helper,/"display_name"/);assert.match(helper,/"attachment"/);
 assert.match(helper,/generated_scroll_title/);assert.match(helper,/\\"origin\\":\\"user\\"/);
 const reference=body(helper,'ab_matches');assert.match(reference,/strcmp\(binding->raw,raw\)/,'source identity/content verification only');
 assert.doesNotMatch(helper,/(?:strstr|strcmp)\([^\n]*(?:native_buffer|native_result)/);
 const gen=read('logic/obj-randart.c');assert.match(gen,/strnfmt\(buf, sizeof\(buf\), "'%s'", word\)/);assert.match(gen,/strnfmt\(buf, sizeof\(buf\), "of %s", word\)/);
 const store=body(helper,'ab_naming_store_annotation');assert.match(store,/ab_part\(s,"store_annotation"\)/);
});

test('treasure branch acquires its own literal capture and never reuses an unrelated stack descriptor',()=>{
 const theft=body(read('logic/mon-util.c'),'steal_monster_item');
 const literal=theft.indexOf('(void)strnfmt(o_name, sizeof(o_name), "treasure");');
 const selected=theft.indexOf('ab_naming_literal_buffer(o_name, sizeof(o_name), "object.literal.treasure")');
 const message=theft.indexOf('you_fail_to_steal_object_from_actor');
 assert.ok(literal>=0&&selected>literal&&message>selected);
 assert.equal(en['angband.naming.grammar.object.literal.treasure'],'treasure');
 assert.equal(ja['angband.naming.grammar.object.literal.treasure'],'宝');
 const api=body(helper,'ab_naming_literal_buffer');assert.match(api,/ab_naming_object_begin/);assert.match(api,/ab_naming_literal\(role\)/);
 assert.doesNotMatch(api,/object_desc|strnfmt|object->/);
});
