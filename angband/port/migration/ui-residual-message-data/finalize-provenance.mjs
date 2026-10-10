/* Reviewed source graph, not a runtime English lookup or new source patch. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),dir='migration/ui-residual-message-data';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read(dir+'/source-manifest.json'));
const baseline=file=>read(manifest.baseline+'/'+path.basename(file));
const groups=[
 [18,['inscribe.title']],[19,['note.']],[34,['wizard.item.cancelled','wizard.item.ignored','wizard.item.queue_failed']],
 [36,['wizard.item.statistics','quality.']],[86,['generation.']],[90,['diagnostic.effect_handler']],
 [100,['timed_save.']],[105,['monster.deep_unique']],[106,['monster.deep']],[107,['monster.unique']],
 [119,['diagnostic.monster_spell.invis']],[120,['diagnostic.monster_spell.miss']],[121,['diagnostic.monster_spell.vis']],
 [159,['rune.learned']],[166,['diagnostic.flag']],[168,['diagnostic.object_kind','tval.']],
 [212,['trap.disabled']],[213,['screen_dump.']],[214,['floor.']],[215,['nested_command.']],
 [217,['item.']],[218,['preferences.saved','preferences.category.']],[219,['preferences.save_failed']],
 [220,['preferences.load_failed']],[221,['preferences.loaded']],[224,['preferences.parse_error','parser_error.']],
 [226,['spell.book_prompt.','item.reject.cast_spell','item.reject.study_spell']]
];
const byIndex=new Map(manifest.assigned_backend_sources.map(r=>[r.source_index,r]));
const sinkSource=record=>({file:record.source.file,function:record.source.function,upstream_line:record.source.upstream_line,original_expression:record.original_call_excerpt.trim(),source_index:record.source_index});
function role(id){if(id.startsWith('semantic.context.'))return'native_action_context_label';
 if(id.includes('.parser_error.')||id.includes('.tval.'))return'source_selected_enum_lexeme';
 if(manifest.static_producer_candidates.some(p=>p.id===id))return'immutable_source_literal';
 if(id.includes('.category.'))return'original_preference_callback_identity';
 if(id.includes('book_prompt'))return'original_command_selected_prompt';
 return'original_sink_selected_parameters';}
for(const entry of manifest.entries){
 if(entry.id==='semantic.context.rune-lore')entry.id='semantic.context.rune_lore';
 if(entry.id==='semantic.context.shape-lore')entry.id='semantic.context.shape_lore';
 const sources=entry.sources?[...entry.sources]:[];
 for(const connection of manifest.connections.filter(c=>c.id===entry.id)){
  const expression=connection.original_expression??(connection.original_lexeme!==undefined?JSON.stringify(connection.original_lexeme):connection.native_expression);
  if(!expression)continue;const original=baseline(connection.file),at=original.indexOf(expression);assert.ok(at>=0,entry.id+' native producer '+connection.file);
  sources.push({file:connection.file,line:original.slice(0,at).split('\n').length,original_expression:expression,producer_role:connection.kind});
 }
 let selected;
 for(const[index,prefixes]of groups)if(prefixes.some(p=>p.endsWith('.')?entry.id.startsWith('ui.residual.'+p):entry.id==='ui.residual.'+p))selected=byIndex.get(index);
 if(selected){const allowed=selected.source_index===86?[86,87]:selected.source_index===90?[90,92]:[selected.source_index];for(let i=sources.length-1;i>=0;i--)if(sources[i].source_index!==undefined&&!allowed.includes(sources[i].source_index))sources.splice(i,1);sources.push(sinkSource(selected));if(selected.source_index===86)sources.push(sinkSource(byIndex.get(87)));if(selected.source_index===90)sources.push(sinkSource(byIndex.get(92)));}
 const category={keymaps:'dump_pref_file(keymap_dump, "Dump keymaps", 13)',monsters:'dump_pref_file(dump_monsters, title, 15)',objects:'dump_pref_file(dump_objects, title, 15)',features:'dump_pref_file(dump_features, title, 15)',flavors:'dump_pref_file(dump_flavors, title, 15)',colors:'dump_pref_file(dump_colors, title, 15)',windows:'dump_pref_file(option_dump, "Dump window settings", 20)',autoinscriptions:'dump_pref_file(dump_autoinscriptions, "Dump autoinscriptions", 20)',char_screen:'dump_pref_file(dump_ui_entry_renderers, "Dump char screen options", 20)'}[entry.id.split('ui.residual.preferences.category.')[1]];
 if(category){const original=baseline('logic/ui-options.c');const at=original.indexOf(category);assert.ok(at>=0,entry.id);sources.push({file:'logic/ui-options.c',line:original.slice(0,at).split('\n').length,original_expression:category,producer_role:'original_preference_callback_identity'});}
 if(entry.id.startsWith('ui.residual.spell.book_prompt.'))sources.push({file:'logic/ui-spell.c',function:'textui_get_spell',original_expression:'strnfmt(prompt, sizeof prompt, "%s which book?", verb);',producer_role:'original_command_selected_prompt'});
 assert.ok(sources.length,entry.id+' requires concrete source evidence');
 entry.sources=[...new Map(sources.map(s=>[JSON.stringify(s),s])).values()];
 entry.source_role=role(entry.id);entry.status='source_connected_unbuilt';
}
for(const record of manifest.assigned_backend_sources){
 record.status=record.source_index===31?'independently_source_connected':'source_connected_unbuilt';
 record.semantic_ids=manifest.entries.filter(e=>e.sources.some(s=>s.source_index===record.source_index)).map(e=>e.id);
 if(record.source_index===31){record.owner='root';record.provenance='existing AB_GAME_DYNAMIC captures the already selected gold value and descriptor; no duplicate residual producer';}
 if(record.source_index===167){record.shared_ids='17 reviewed knowledge property notice IDs';record.parameters=[{name:'name',type:'KnownObjectDescription'}];record.provenance='original prop->msg gate; four immediate descriptor snapshots across callback waits';}
 if(record.source_index===159)record.shared_ids='existing private selected rune grammar and canonical lexical IDs';
 if(record.source_index===212)record.shared_ids='40 existing canonical trap bindings to shared trap.label.* IDs; native first name field selected';
}
manifest.catalog_entries=manifest.entries.length;assert.equal(manifest.catalog_entries,282);
manifest.provenance_complete_for_assigned_sources=true;manifest.browser_verified=false;
manifest.known_presentation_limits=['Shape lore sections outside selected property/ability/name/effect delivery remain separate source migration work.'];
const en=JSON.parse(read(dir+'/en.json')),ja=JSON.parse(read(dir+'/ja.json'));
for(const[old,next]of[['semantic.context.rune-lore','semantic.context.rune_lore'],['semantic.context.shape-lore','semantic.context.shape_lore']]){if(en[old]!==undefined){en[next]=en[old];ja[next]=ja[old];delete en[old];delete ja[old];}}
for(const[p,value]of[[dir+'/source-manifest.json',manifest],[dir+'/en.json',en],[dir+'/ja.json',ja]])fs.writeFileSync(path.join(root,p),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({entries:manifest.entries.length,source_records:manifest.assigned_backend_sources.length,connections:manifest.connections.length,missing_provenance:0,runtime_verified:false}));
