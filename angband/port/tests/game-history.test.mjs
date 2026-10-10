import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=n=>readFileSync(path.join(root,n),'utf8');
const json=n=>JSON.parse(read(n));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const base='migration/game-history-data/';
const manifest=json(base+'source-manifest.json');
const schema=json(base+'schema.json');const en=json(base+'en.json'),ja=json(base+'ja.json');
const core=read('logic/web-game-history.c');
const remove=t=>t.replace(/\/\* AB_GAME_HISTORY_BEGIN \*\/[\s\S]*?\/\* AB_GAME_HISTORY_END \*\//g,'');
test('game history catalog has identical typed source-owned EN/JA/schema keys',()=>{
 assert.equal(manifest.upstream_commit,'f3082213b73f3e463e3d0d60bff4b00462beae6e');assert.equal(manifest.entries.length,14);
 for(const keys of [Object.keys(en),Object.keys(ja),Object.keys(schema.entries)])assert.deepEqual(keys.sort(),manifest.entries.map(x=>x.id).sort());
 for(const entry of manifest.entries){assert.equal(en[entry.id],entry.english);assert.equal(ja[entry.id],entry.japanese);assert.deepEqual(schema.entries[entry.id].parameters,entry.parameters);
 const names=entry.parameters.map(x=>x.name).sort();for(const text of [entry.english,entry.japanese]){assert.deepEqual([...new Set([...text.matchAll(/\{([a-z_]+)\}/g)].map(x=>x[1]))].sort(),names);assert.ok(!text.includes('\0'));assert.ok(!text.includes('\uFFFD'));}}
});
for(const before of manifest.native_before)test(`game history annotations reconstruct exact native producer ${before.file}`,()=>{
 const snapshot=readFileSync(path.join(root,before.snapshot));assert.equal(hash(snapshot),before.sha256);assert.equal(remove(read(before.file)),snapshot.toString('utf8'));
});
test('history original storage and wire remain unmodified',()=>{
 assert.match(read('logic/player-history.h'),/char event\[80\]/);assert.doesNotMatch(read('logic/player-history.h'),/ab_game_history|gh_row|reference/);
 const save=read('logic/save.c');const load=read('logic/load.c');assert.doesNotMatch(save.slice(save.indexOf('void wr_history(')),/ab_game_history/);assert.doesNotMatch(load.slice(load.indexOf('int rd_history('),load.indexOf('int rd_null(')),/ab_game_history/);
 assert.equal(manifest.native_storage.original_history_save_block_unchanged,true);
});
test('nine source-selected event templates cap EN joined history bytes at79 and preserve Japanese reflow',()=>{
 const bounded=manifest.entries.filter(x=>x.native_output_max_bytes!==undefined);assert.equal(bounded.length,9);
 for(const entry of bounded){assert.equal(entry.native_output_max_bytes,79);assert.equal(entry.native_output_english_only,true);assert.equal(schema.entries[entry.id].native_output_max_bytes,79);assert.equal(schema.entries[entry.id].native_output_english_only,true);}
});
test('history sidecar digest binds authored source records and Japanese strings',()=>{
 const digest=hash(Buffer.from(JSON.stringify(manifest.entries)));const values=[...read(base+'catalog-digest.inc').matchAll(/\{([0-9,]+)\}/g)][0][1].split(',').map(Number);assert.equal(Buffer.from(values).toString('hex'),digest);
});
test('history source lifetimes copy descriptors before fake artifact cleanup and unique deletion',()=>{
 const ph=read('logic/player-history.c');assert.ok(ph.indexOf('ab_game_history_capture_artifact_name(buf)')>ph.indexOf('object_desc(buf'));assert.ok(ph.indexOf('ab_game_history_capture_artifact_name(buf)')<ph.indexOf('object_wipe(known_obj)'));
 const mon=read('logic/mon-util.c');assert.ok(mon.indexOf('ab_game_history_prepare_monster(unique_name,buf)')>mon.indexOf('strnfmt(buf, sizeof(buf), "Killed %s", unique_name)'));assert.ok(mon.indexOf('ab_game_history_prepare_monster(unique_name,buf)')<mon.indexOf('history_add(p, buf, HIST_SLAY_UNIQUE)'));
 assert.match(core,/ab_naming_copy_monster_snapshot\(&name,name_buffer\)/);assert.match(core,/ab_naming_copy_object_snapshot\(&artifact_name,name_buffer\)/);
});
test('history records copy exact already-stored native row before next ordinal increments',()=>{
 const p=read('logic/player-history.c');assert.ok(p.indexOf('ab_game_history_added(p,h->next,&h->entries[h->next],text)')>p.indexOf('my_strcpy(h->entries[h->next].event'));assert.ok(p.indexOf('ab_game_history_added(p,h->next,&h->entries[h->next],text)')<p.indexOf('h->next++'));
 assert.match(core,/pending\.event_buffer==event_buffer/);assert.match(core,/bind_native\(&out->native,row\)/);
});
test('user-note authored forms preserve opaque username/body and pending metadata across native message yield',()=>{
 const note=read('logic/cmd-misc.c');for(const hook of ['1,player->full_name,&tmp[5],note','2,player->full_name,&tmp[3],note','3,NULL,tmp,note'])assert.ok(note.includes('ab_game_history_prepare_note('+hook+')'));
 assert.ok(note.indexOf('ab_game_history_prepare_note')<note.indexOf('ab_ur_note_message()'));assert.ok(note.indexOf('ab_ur_note_message()')<note.indexOf('history_add(player, note, HIST_USER_INPUT)'));
 assert.match(core,/"name","character_name"/);assert.match(core,/"text","verbatim_user_text"/);assert.doesNotMatch(core,/strstr\([^\n]*(?:Found|Missed|Killed|Note:)/);
});
test('known/lost transitions preserve provenance and read the actual current flags',()=>{
 const binding=core.slice(core.indexOf('struct gh_binding'),core.indexOf('struct gh_row'));assert.doesNotMatch(binding,/type\[|bitflag/);
 assert.match(core,/hist_has\(row->type,HIST_ARTIFACT_LOST\)\?"angband\.game_history\.row_lost"/);
 for(const field of ['turn','dlev','clev','aidx'])assert.ok(core.includes('source->'+field));assert.match(core,/!strcmp\(source->event,row->event\)/);
});
test('legacy missing metadata and altered bindings stay explicit opaque native text',()=>{
 assert.match(core,/opaque_reference\(&event,row->event\)/);assert.match(core,/!strcmp\(context,"character-export"\)\)ab_character_export_reject\(\)/);assert.match(core,/"angband\.game_history\.opaque/);
 assert.equal(manifest.native_storage.legacy_absence,'opaque; no English reconstruction/inference');assert.doesNotMatch(core,/lookup_artifact|lookup_monster|object_desc\(|monster_desc\(/);
});
test('history optional block checks lengths, every read, digest, checksum and complete atomic commit',()=>{
 assert.match(core,/ab_web_save_bytes_remaining\(\)<1/);assert.match(core,/length>ab_web_save_bytes_remaining\(\)/);assert.match(core,/out->length>GH_MAX_TOTAL-bytes/);assert.match(core,/out->length>GH_MAX_REFERENCE/);
 assert.match(core,/count!=expected/);assert.match(core,/memcmp\(digest,game_history_catalog_digest/);assert.match(core,/checksum!=wire.checksum/);assert.match(core,/ab_web_save_bytes_remaining\(\)!=4/);
 const commit=core.indexOf('rows=loaded;');assert.ok(commit>core.indexOf('checksum!=wire.checksum'));assert.match(core,/release_rows\(loaded,loaded\?expected:0\)/);
 assert.match(core,/ab_rs_review_event\(/);assert.match(core,/ab_rs_review_status\(\)==0/);
});
test('history projection reuses selected rows and closes display/export boundaries before native input',()=>{
 const ui=read('logic/ui-history.c');assert.ok(ui.indexOf('ab_ui_scope_end()')<ui.indexOf('ch = inkey()'));assert.ok(ui.indexOf('ab_ui_reset("gameplay-history")')<ui.indexOf('screen_load()'));
 assert.match(ui,/ab_game_history_project_row\("gameplay-history",widget,&history_list_local\[i\],i\)/);assert.match(ui,/ab_game_history_project_row\("character-export",widget,&history_list_local\[i\],i\)/);
 assert.equal((ui.match(/history_get_list\(/g)||[]).length,2);assert.doesNotMatch(core,/\b(?:randint0|randint1|one_in_|Rand_simple|Rand_div|Rand_normal|history_get_list|effect_do)\s*\(/);
});
