import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {stripResidual} from '../migration/ui-residual-message-data/native-parity.mjs';
import {stripRecentAnnotations} from './native-annotations.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir='migration/ui-residual-message-data';
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));
const manifest=json(dir+'/source-manifest.json'),helper=read('logic/web-ui-residual-text.c');
test('all30 immutable phase baselines retain exact SHA and native bytes after composed independent annotations',()=>{
 assert.equal(manifest.source_files.length,30);
 for(const file of manifest.source_files){const original=read(manifest.baseline+'/'+path.basename(file));assert.equal(createHash('sha256').update(original).digest('hex'),manifest.source_before_sha256[file],file+' immutable baseline');
 const actual=stripRecentAnnotations(stripResidual(read(file))),expected=stripRecentAnnotations(original);let at=0;while(actual[at]===expected[at]&&at<actual.length)at++;
 assert.equal(actual,expected,file+' first differing byte '+at);}
});
test('287 reviewed EN/JA entries have strict IDs, identical placeholder sets and concrete per-entry source evidence',()=>{
 const en=json(dir+'/en.json'),ja=json(dir+'/ja.json');assert.equal(manifest.entries.length,287);assert.deepEqual(Object.keys(en).sort(),Object.keys(ja).sort());assert.equal(Object.keys(en).length,287);
 for(const e of manifest.entries){assert.match(e.id,/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/);assert.equal(en[e.id],e.english);assert.equal(ja[e.id],e.japanese);assert.ok(e.source_role);assert.ok(e.sources.length,e.id);assert.equal(e.status,'source_connected_unbuilt');
 const expected=e.parameters.map(p=>p.name).sort();for(const text of[e.english,e.japanese])assert.deepEqual([...text.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map(m=>m[1]).sort(),expected,e.id);}
 assert.equal(en['semantic.context.rune_lore'],'Display rune knowledge');assert.equal(en['semantic.context.shape_lore'],'Display shapechange effects');
});
test('all31 backend sink records are connected conservatively and gold is independently covered without another hook',()=>{
 assert.equal(manifest.assigned_backend_sources.length,31);assert.deepEqual(manifest.remaining_assigned_source_indices,[]);
 for(const r of manifest.assigned_backend_sources){assert.ok(r.semantic_ids.length||r.shared_ids||r.source_index===31,'source'+r.source_index);assert.match(r.status,/source_connected/);}
 const gold=manifest.assigned_backend_sources.find(r=>r.source_index===31);assert.equal(gold.owner,'root');assert.ok(!manifest.connections.some(c=>c.source_index===31));assert.equal(manifest.browser_verified,false);const unique=manifest.entries.find(e=>e.id==='ui.residual.monster.deep_unique');assert.deepEqual(unique.sources.filter(s=>s.source_index!==undefined).map(s=>s.source_index),[105]);assert.ok(unique.sources.every(s=>s.original_expression.includes('Deep unique')));
});
test('parser64 and tval36 enums plus native unknown fallback derive from exact source expressions',()=>{
 const lexical=manifest.lexical_sources;assert.equal(lexical.parser_error_rows.length,64);assert.equal(lexical.tval_rows.length,36);assert.equal(lexical.tval_fallback_rows.length,1);
 for(const r of [...lexical.parser_error_rows,...lexical.tval_rows,...lexical.tval_fallback_rows]){assert.ok(read(r.source.file).includes(r.source.original_expression),r.id);assert.equal(json(dir+'/en.json')[r.id],r.en);assert.ok(read('logic/web-ui-residual-bindings.h').includes('"'+r.id+'"')||r.id==='ui.residual.tval.unknown');}
 const parser=read('logic/ui-prefs.c');assert.ok(parser.includes('AB_UI_OPAQUE("token","opaque_parser_token",s.msg)'));assert.ok(parser.includes('ab_ur_parser_error(s.error)'));
});
test('static fields register original literal addresses and consumers never use completed-English lookup',()=>{
 assert.ok(helper.includes('ab_dc_register_source_message(native_source,id)'));assert.ok(helper.includes('ab_dc_source_message_id(native_source)'));
 const lookup=helper.slice(helper.indexOf('const char *ab_ur_source'),helper.indexOf('const char *ab_ur_trap_name'));assert.ok(!/\b(?:strcmp|strstr)\s*\(/.test(lookup));
 assert.ok(!/\b(?:object_desc|monster_desc|rune_name|rune_desc|randint[01]|dice_roll|player_knows_rune|lookup_obj_property)\s*\(/.test(helper));
 const items=manifest.connections.filter(c=>c.kind==='item_literal_argument'||(c.kind==='immutable_literal_address'&&c.id?.startsWith('ui.residual.item.')));assert.ok(items.length>=80);
 const generations=manifest.connections.filter(c=>c.id?.startsWith('ui.residual.generation.error.'));assert.equal(generations.reduce((n,c)=>n+c.occurrences,0),28);
 assert.ok(read('logic/web-interface-text.c').includes('ab_dc_source_message_id(native_prompt)'));
});
test('title, property and floor snapshots are copied once before callback waits and release on original paths',()=>{
 assert.ok(helper.includes('titles[16]')&&helper.includes('properties[16]'));assert.ok(helper.includes('titles[title_depth-1].address!=native_title'));assert.ok(helper.includes('properties[property_depth-1].address!=native_name'));
 const code=read('logic/ui-display.c'),capture=code.indexOf('ab_ur_object_capture(&ab_ur_floor,o_name)');assert.ok(capture>=0);assert.ok(capture<code.indexOf('event_signal(EVENT_MESSAGE_FLUSH)',capture));assert.ok(code.indexOf('ab_naming_snapshot_release(&ab_ur_floor)',capture)>code.indexOf('msg("You %s %s.", p, o_name)',capture));
 const knowledge=read('logic/obj-knowledge.c');assert.equal((knowledge.match(/ab_ur_object_capture\(&ab_ur_property,o_name\)/g)||[]).length,4);assert.match(knowledge,/AB_UR_RETURN\(&ab_ur_property,\/\* AB_UI_RESIDUAL_END \*\/return;/);
 assert.ok(read('logic/cmd-obj.c').includes('AB_UR_TITLE(&ab_ur_title,prompt,'));assert.ok(helper.includes('ab_ur_title_result(int native_result){ab_ur_title_end();return native_result;}'));
});
test('rune and ability consumers use original getters and predicates with ordered independent modal lifetimes',()=>{
 const s=read('logic/ui-knowledge.c'),get=s.indexOf('c_prt(attr, rune_name(oid), row, col);');assert.ok(s.indexOf('ab_knowledge_emit_last_rune("knowledge-items",ab_rune_widget,oid,false)',get)>get);
 for(const context of['rune-lore','shape-lore']){const begin=s.indexOf('ab_domain_info_begin("'+context+'")');assert.ok(begin>=0);const tag=s.indexOf('ab_domain_info_tag(tb,"'+context+'")',begin),commit=s.indexOf('ab_domain_info_commit()',tag),close=s.indexOf('ab_domain_info_close()',commit),wait=s.indexOf('textui_textblock_show(tb, SCREEN_REGION, NULL)',close);assert.ok(begin<tag&&tag<commit&&commit<close&&close<wait);}
 assert.ok(s.includes('ab_knowledge_info_last_rune(oid,false)')&&s.includes('ab_knowledge_info_last_rune(oid,true)'));assert.ok(s.includes('ab_knowledge_info_ability(ability)'));
 assert.ok(read('logic/obj-knowledge.c').includes('AB_UR_RUNE(i,')&&helper.includes('ab_knowledge_param_last_rune(&event,"rune",oid,false)'));
});
test('all40 trap bindings preserve native first-name/second-description selection and reuse reviewed shared IDs',()=>{
 const rows=json(dir+'/trap-source-bindings.json');assert.equal(rows.length,40);assert.deepEqual(rows.map(r=>r.index),Array.from({length:40},(_,i)=>i));
 const pinned=read('tests/first-naming-build-snapshot/source/data/gamedata/trap.txt');
 for(const row of rows){assert.ok(pinned.includes('name:'+row.name+':'+row.desc),row.index);assert.ok(!manifest.entries.some(e=>e.id===row.id));}
 assert.equal(rows[7].name,'pit');assert.equal(rows[7].desc,'spiked pit');assert.equal(rows[7].id,'trap.label.pit');assert.ok(helper.includes('ab_ur_trap_ids[i].index==kind->tidx'));
});
test('confirmation depth and context guards prevent a failed begin from popping another active scope',()=>{
 const s=read('logic/web-ui-text.c');assert.ok(s.includes('ui_depth>=N_ELEMENTS(ui_scopes)'));assert.ok(s.includes('Confirmation presentation scope capacity exceeded'));const end=s.slice(s.indexOf('void ab_ui_check_end'),s.indexOf('void ab_ui_check_end')+700);assert.ok(end.includes('ab_ui_in("confirmation")'));
 const header=read('logic/web-ui-residual-text.h');assert.ok(header.includes('#define AB_UR_BEFORE(effect,call) ((effect),(call))'));assert.ok(header.includes('#define AB_UR_RETURN(o,call) do {ab_naming_snapshot_release(o);call} while(0)'));
});


test('common dialogs consume exact producer facts with original maximum/editor/choice policies intact',()=>{
 const ui=read('logic/ui-input.c'),native=stripResidual(ui);
 assert.ok(native.includes('if (max != 1)'));assert.ok(native.includes('get_string(prompt, buf, 7)'));assert.ok(native.includes("if ((buf[0] == '*') || isalpha((unsigned char)buf[0])) amt = max;"));
 assert.ok(native.includes("if (key.code >= 'A' && key.code <= 'Z') key.code += 32;"));assert.ok(native.includes('if (!strchr(options, (char)key.code))'));
 assert.ok(ui.indexOf('ab_ur_quantity_capture(&ab_quantity,prompt,max,amt)')<ui.indexOf('ab_ur_quantity_begin(&ab_quantity)'));
 const helper=read('logic/web-ui-residual-text.c');assert.ok(helper.includes('owned.address!=address'));assert.ok(helper.includes('memset(pending,0,sizeof(*pending))'));assert.ok(helper.includes('call->active=true'));
 assert.ok(ui.includes('AB_UR_QUANTITY_RESULT(&ab_quantity,')&&ui.includes('AB_UR_QUANTITY_RETURN(&ab_quantity,'));assert.ok(helper.includes('ab_semantic_json_int32(&e,(int32_t)limit-1)'));
 const store=read('logic/ui-store.c');assert.ok(store.includes('AB_UR_QUANTITY_WORD(&ab_qty,1,')&&store.includes('AB_UR_QUANTITY_WORD(&ab_qty,0,'));assert.ok(store.includes('AB_UR_QUANTITY_OWNED(&ab_qty,true,num,')&&store.includes('AB_UR_QUANTITY_OWNED(&ab_qty,false,0,'));
 assert.equal(manifest.dialog_phase.quantity_calls,13);assert.equal(manifest.dialog_phase.choice_calls,2);assert.equal(manifest.dialog_phase.native_text_max_bytes,6);
});
test('only three note templates declare the original90 minusNUL1 minusprefix3 scalar display budget',()=>{
 const entries=manifest.entries.filter(e=>e.native_output_max_bytes!==undefined);assert.deepEqual(entries.map(e=>e.id).sort(),['ui.residual.note.action','ui.residual.note.plain','ui.residual.note.say']);
 for(const e of entries){const proof=e.native_output_budget_source;assert.equal(e.native_output_max_bytes,86);assert.equal(proof.buffer_bytes-proof.nul_bytes-proof.prefix_bytes,86);assert.ok(stripResidual(read(proof.file)).includes(proof.buffer_expression));assert.ok(stripResidual(read(proof.file)).includes(proof.omitted_prefix_expression));}
});

test('five follow-up score/shape producers reconstruct exact prehook bytes and bind one reviewed event per original sink',()=>{
 const proof=json(dir+'/score-shape-followup-proof.json');assert.equal(proof.records.length,5);assert.equal(manifest.connections.length,157);assert.deepEqual(manifest.five_sink_followup.ids,proof.ids);
 for(const f of proof.files){const baseline=read(f.baseline);assert.equal(createHash('sha256').update(baseline).digest('hex'),f.before_sha256,f.file);let actual=read(f.file);for(const a of proof.additions.filter(a=>a.file===f.file)){assert.equal(actual.split(a.block).length,2,a.id||a.role);actual=actual.replace(a.block,'');}assert.equal(actual,baseline,f.file+' exact follow-up inverse');}
 for(const r of proof.records){const live=read(r.sources[0].file);assert.equal(live.split(r.sources[0].original_expression).length,2,r.id+' original sink once');const added=proof.additions.find(a=>a.id===r.id);assert.equal((added.block.match(/ab_ur_message\(/g)||[]).length,1,r.id+' one semantic event');assert.ok(added.block.includes('#ifdef __EMSCRIPTEN__'));assert.ok(!/randint|one_in_|dice_roll|object_desc|monster_desc|lookup_player_shape\(/.test(added.block));assert.deepEqual(manifest.entries.find(e=>e.id===r.id),r);}
});
test('all four original score rejection gates and flushes remain native with no Borg hook',()=>{
 const s=read('logic/score.c'),native=stripResidual(s);for(const gate of['option_type(j) != OP_SCORE','!p->opts.opt[j]','p->noscore & (NOSCORE_WIZARD | NOSCORE_DEBUG)','!p->total_winner && streq(p->died_from, "Interrupting")','!p->total_winner && streq(p->died_from, "Retiring")'])assert.ok(native.includes(gate),gate);
 const p=json(dir+'/score-shape-followup-proof.json');assert.equal(p.records.filter(r=>r.sources[0].file==='logic/score.c').length,4);assert.ok(!p.records.some(r=>/borg/i.test(r.id)));assert.ok(native.includes('msg("Score not registered for borgs.");'));for(const r of p.records.filter(r=>r.sources[0].file==='logic/score.c')){const source=r.sources[0];assert.deepEqual(r.parameters,[]);assert.match(source.upstream_sha256,/^[a-f0-9]{64}$/);assert.ok(source.upstream_line>0);assert.ok(native.includes(source.original_expression));}
});
test('invalid/custom shape diagnostic preserves its opaque original token and NULL return without a naming lookup',()=>{
 const p=json(dir+'/score-shape-followup-proof.json'),r=p.records.find(e=>e.id==='ui.residual.shape.lookup_failed');assert.deepEqual(r.parameters,[{name:'shape',type:'canonical_identity'}]);assert.equal(r.sources[0].source_index,186);const b=p.additions.find(a=>a.id===r.id).block;assert.ok(b.includes('AB_UI_OPAQUE("shape","canonical_identity",name)'));assert.ok(!/ShapeName|shape_by|naming|strcmp|strstr/.test(b));
 const native=stripResidual(read('logic/player-util.c'));assert.ok(native.includes('msg("Could not find %s shape!", name);'));assert.match(native,/msg\("Could not find %s shape!", name\);\r?\n\treturn NULL;/);const rows=read('inventory/source_strings.jsonl').trim().split(/\r?\n/).map(l=>JSON.parse(l));for(const e of p.records){const source=e.sources[0];assert.ok(rows.some(i=>i.path===source.upstream_file&&i.line===source.upstream_line&&i.function===source.function&&i.source_context.trim()===source.original_expression),e.id+' original-source provenance');}
});
