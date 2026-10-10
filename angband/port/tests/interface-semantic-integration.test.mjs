import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
import{reconstructInterface}from'../migration/interface-data/native-parity.mjs';
import{stripChecks}from'../migration/check-data/native-parity.mjs';
import{stripRecentAnnotations}from'./native-annotations.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const manifest=JSON.parse(read('migration/interface-data/source-manifest.json'));
test('all interface native statements/control flow reconstruct byte-for-byte',()=>{for(const file of manifest.source_files)assert.equal(stripRecentAnnotations(reconstructInterface(read(file))),stripRecentAnnotations(read('migration/interface-data/source-baseline/'+path.basename(file))),file);});
test('complete reviewed interface catalog has matching IDs and named placeholders',()=>{const en=JSON.parse(read('migration/interface-data/en.json')),ja=JSON.parse(read('migration/interface-data/ja.json'));assert.deepEqual(Object.keys(en).sort(),Object.keys(ja).sort());assert.equal(Object.keys(en).length,manifest.entries.length);for(const r of manifest.entries){assert.match(r.id,/^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/);assert.ok(r.id.length<=127);const names=r.parameters.map(p=>p.name).sort();for(const text of [en[r.id],ja[r.id]])assert.deepEqual([...text.matchAll(/(?<!\{)\{([a-z][a-z0-9_]*)\}(?!\})/g)].map(m=>m[1]).sort(),names,r.id);}});
test('static connections retain exact native call and catalog identity',()=>{const all=new Set(manifest.entries.map(r=>r.id));for(const c of manifest.connections){assert.ok(all.has(c.id));assert.ok(stripRecentAnnotations(read(c.file)).includes(c.original_call));assert.ok(read(c.file).includes('"'+c.id+'"'));}for(const table of manifest.tables)for(const id of table.row_ids)if(id)assert.ok(all.has(id));});
test('settings use enum identity and existing Boolean state, never rendered English',()=>{const helper=read('logic/web-interface-text.c'),options=read('logic/ui-options.c');assert.ok(helper.includes('ab_if_options[i].option==option'));assert.ok(options.includes('options[oid]?"interface.options.state.enabled"'));assert.ok(!helper.includes('option_desc('));assert.equal(manifest.options.length,45);assert.equal(manifest.options.filter(r=>r.option_type!=='SCORE').length,41);});
test('menu refresh commits before waiting; hidden/filtered decision is original',()=>{const menu=read('logic/ui-menu.c');assert.ok(menu.indexOf('ab_if_menu_begin(menu)')<menu.indexOf('menu->skin->display_list(menu'));assert.ok(menu.indexOf('ab_if_menu_end(menu)')>menu.indexOf('menu->skin->display_list(menu'));assert.ok(menu.indexOf('if (row_valid == MN_ROW_HIDDEN)')<menu.indexOf('ab_if_menu_row(menu,oid'));assert.equal((menu.match(/ab_if_menu_leave\(menu\)/g)||[]).length,4);});
test('source projections never repeat RNG, descriptor or original command effects',()=>{const helper=read('logic/web-interface-text.c');assert.ok(!/\b(?:randint[01]|dice_roll|object_desc|monster_desc|spell_chance|cmdq_push)\s*\(/.test(helper));assert.ok(helper.includes('bindings[64]'));assert.ok(helper.includes('row_count>512'));});
test('direct item selector captures names before menu wait and clears its own lifetime',()=>{
 const s=read('logic/ui-object.c'),begin=s.indexOf('static struct object *item_menu('),end=s.indexOf('bool textui_get_item(',begin),fn=s.slice(begin,end);
 assert.ok(fn.indexOf('ab_if_items_begin(ab_item_context')<fn.indexOf('set_obj_names(false, player)'));
 assert.ok(fn.indexOf('ab_ui_scope_commit()')<fn.indexOf('evt = menu_select(m'));
 assert.ok(fn.indexOf('ab_if_items_end();ab_ui_reset(ab_item_context)')>fn.indexOf('evt = menu_select(m'));
 assert.ok(fn.indexOf('ab_if_items_end();ab_ui_reset(ab_item_context)')<fn.indexOf('mem_free(m->inscriptions)'));
 assert.ok(!fn.includes('ab_if_menu_bind(m'));
 for(const context of['inventory','equipment','quiver','floor-items','throwing-items'])assert.ok(fn.includes('"'+context+'"'));
});
test('direct item prompts and keyboard actions use source identities with nested context restoration',()=>{
 const k=read('logic/ui-knowledge.c'),s=read('logic/ui-object.c'),helper=read('logic/web-interface-text.c');
 for(const name of['inven','equip','quiver'])assert.ok(k.includes('AB_IF_ITEM_PROMPT("interface.knowledge.do_cmd_'+name+'.select_item", "Select Item:")'));
 for(const[name,key]of[['inventory','/'],['equipment','/'],['quiver','|'],['floor','-']])assert.ok(s.includes('AB_IF_ITEM_ACTION("'+name+'", "interface.items.switch.'+name+'", \''+key+'\''));
 assert.ok(s.includes('"interface.items.switch.escape", ESCAPE'));
 assert.ok(helper.includes('item_context_stack[16]'));assert.ok(helper.includes('item_context=item_context_stack[--item_context_depth]'));
 assert.ok(helper.includes('"__action:%s"'));assert.ok(helper.includes('"activation_key","integer"'));
});
test('menu C/Rust ABI field order and original event bits match across the boundary',()=>{
 const c=read('logic/web-menu-controller.h'),rust=read('rust/src/application_menu.rs');
 const types={'uint32_t':'u32','int32_t':'i32','struct ab_menu_event':'Event','struct ab_menu_facts':'Facts','struct ab_menu_policy':'PolicySpans'};
 for(const[native,owned]of[['ab_menu_event','Event'],['ab_menu_facts','Facts'],['ab_menu_effect','Effect'],['ab_menu_reply','ReplyCapture']]){
  const body=c.match(new RegExp('struct '+native+' \\{([^}]+)\\};'))?.[1];assert.ok(body,native);
  const fields=body.split(';').map(s=>s.trim()).filter(Boolean).flatMap(s=>{const m=s.match(/^(uint32_t|int32_t|struct ab_menu_event|struct ab_menu_facts|struct ab_menu_policy)\s+(.+)$/);assert.ok(m,s);return m[2].split(',').map(name=>[name.trim(),types[m[1]]]);});
  const ownedBody=rust.match(new RegExp('pub struct '+owned+' \\{([\\s\\S]*?)\\n\\}'))?.[1];assert.ok(ownedBody,owned);
  assert.deepEqual([...ownedBody.matchAll(/pub\s+(\w+):\s*(u32|i32|Event|Facts|PolicySpans)/g)].map(m=>[m[1],m[2]]),fields,owned);
 }
 const original=read('logic/ui-event.h');for(const event of ['EVT_NONE','EVT_KBRD','EVT_MOUSE','EVT_RESIZE','EVT_ESCAPE','EVT_MOVE','EVT_SELECT','EVT_SWITCH']){
  const native=Number(original.match(new RegExp(event+'\\s*=\\s*(0x[0-9a-f]+|[0-9]+)'))?.[1]);
  const owned=Number(rust.match(new RegExp('pub const '+event+': u32 = (0x[0-9a-f]+|[0-9]+)'))?.[1]);assert.equal(owned,native,event);
 }
});
test('curse names and descriptions preserve native reverse data indices and share exact reviewed IDs',()=>{
 const domain=JSON.parse(read('migration/domain-text-data/inventory.json')),ja=JSON.parse(read('migration/domain-text-data/ja-authored-curse-review.json'));
 const names=read('data/gamedata/curse.txt').split(/\r?\n/).filter(line=>line.startsWith('name:')).map(line=>line.slice(5));assert.equal(names.length,27);
 assert.equal(Object.keys(ja).length,54);
 for(const record of domain.records.curse){assert.equal(record.canonical.curse_index,names.length-record.source_ordinal);assert.equal(record.identity,names[record.source_ordinal]);
  for(const role of ['name','description']){const entry=domain.entries.find(e=>e.id.startsWith('domain.curse.')&&e.canonical.curse_index===record.canonical.curse_index&&e.role===role);assert.ok(entry);assert.match(ja[entry.id],/[\u3040-\u30ff\u3400-\u9fff]/);assert.ok(read('logic/ui-curse.c').includes(JSON.stringify(entry.id)));}
 }
 const source=read('logic/ui-curse.c');assert.equal((source.match(/player_knows_curse\(player, i\)/g)||[]).length,1);assert.ok(source.indexOf('ab_if_menu_bind(m,"curse-menu"')>source.indexOf('if (!count)'));
});
