import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const read=n=>readFileSync(path.join(root,n),'utf8');const json=n=>JSON.parse(read(n));const hash=b=>createHash('sha256').update(b).digest('hex');
const base='migration/chest-message-data/';const m=json(base+'source-manifest.json');const c=read('logic/web-chest-message.c'),producer=read('logic/obj-chest.c');
test('six pinned chest trap records bind five distinct complete EN/JA trigger templates',()=>{
 assert.equal(m.upstream_commit,'f3082213b73f3e463e3d0d60bff4b00462beae6e');assert.equal(m.records.length,6);assert.equal(m.entries.length,5);
 const en=json(base+'en.json'),ja=json(base+'ja.json'),schema=json(base+'schema.json');for(const v of [en,ja,schema.entries])assert.deepEqual(Object.keys(v).sort(),m.entries.map(x=>x.id).sort());
 for(const e of m.entries){assert.equal(en[e.id],e.english);assert.equal(ja[e.id],e.japanese);assert.ok(e.japanese.length);assert.ok(!e.japanese.includes('\uFFFD'));assert.deepEqual(e.parameters,[]);assert.deepEqual(schema.entries[e.id].parameters,[]);}
 const needles=m.records.filter(x=>x.code.startsWith('LOSE_'));assert.equal(needles.length,2);assert.equal(needles[0].id,needles[1].id);assert.notEqual(needles[0].pval,needles[1].pval);
});
test('chest producer annotations reconstruct exact native bytes including trap selection and all effects',()=>{
 const b=m.native_before[0],before=readFileSync(path.join(root,b.snapshot));assert.equal(hash(before),b.sha256);
 assert.equal(producer.replace(/\/\* AB_CHEST_MESSAGE_BEGIN \*\/[\s\S]*?\/\* AB_CHEST_MESSAGE_END \*\//g,''),before.toString('utf8'));
});
test('chest parser identity and immutable source text are grounded in actual gamedata rows',()=>{
 const lines=read('data/gamedata/chest_trap.txt').split(/\r?\n/);assert.deepEqual(m.records.map(x=>x.pval),[2,4,8,16,32,64]);
 for(const record of m.records){assert.equal(lines[record.source_code_line-1],'code:'+record.code);assert.equal(lines[record.source_msg_line-1],'msg:'+record.msg);const row=m.entries.find(x=>x.id===record.id);assert.equal(row.english,record.msg);assert.ok(read(base+'chest-bindings.inc').includes(`{${record.pval},"${record.code}",`));}
});
test('selected chest capture occurs after native trap mask and before original message/effect/destruction',()=>{
 const trap=producer.slice(producer.indexOf('static void chest_trap('),producer.indexOf('bool do_cmd_open_chest('));
 assert.ok(trap.indexOf('if (trap->pval & traps)')<trap.indexOf('ab_chest_message_selected(trap)'));assert.ok(trap.indexOf('ab_chest_message_selected(trap)')<trap.indexOf('msg(trap->msg)'));assert.ok(trap.indexOf('msg(trap->msg)')<trap.indexOf('effect_do(trap->effect'));assert.ok(trap.indexOf('effect_do(trap->effect')<trap.indexOf('if (trap->destroy)'));
 assert.equal((trap.match(/ab_chest_message_selected\(trap\)/g)||[]).length,1);assert.match(trap,/obj->pval = 0;\s*break;/);
});
test('chest runtime identity uses selected trap and parsed message addresses, not English lookup or fresh queries',()=>{
 const selected=c.slice(c.indexOf('void ab_chest_message_selected('));assert.match(selected,/source->trap!=trap \|\| source->message!=trap->msg/);assert.doesNotMatch(selected,/strcmp|strstr|chest_traps|pval &|effect_do|rand/);
 assert.match(selected,/source->binding->id,"message","chest-trap"/);assert.doesNotMatch(c,/\b(?:randint0|randint1|one_in_|Rand_div|effect_do|object_desc|monster_desc)\s*\(/);
});
test('chest immutable registry verifies source corpus and releases addresses before native teardown',()=>{
 assert.ok(producer.indexOf('ab_chest_message_register(chest_traps)')<producer.indexOf('parser_destroy(p)',producer.indexOf('static errr finish_parse_chest_trap')));
 const clean=producer.slice(producer.indexOf('static void cleanup_chest_trap'),producer.indexOf('struct file_parser chest_trap_parser'));assert.ok(clean.indexOf('ab_chest_message_reset()')<clean.indexOf('string_free(trap->msg)'));
 assert.match(c,/trap->pval!=b->pval \|\| !trap->code \|\| strcmp\(trap->code,b->code\)/);assert.match(c,/strcmp\(trap->msg,b->english\)/);assert.match(c,/seen!=N_ELEMENTS\(chest_bindings\)/);
});
