/* Source-identified additive migration. Never normalizes or restores C files. */
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir='migration/ui-residual-message-data';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read(dir+'/source-manifest.json'));
const pending=new Map(),connections=[];
const BEGIN='/* AB_UI_RESIDUAL_BEGIN */',END='/* AB_UI_RESIDUAL_END */';
export const stripResidual=s=>s.replace(/\/\* AB_UI_RESIDUAL_BEGIN \*\/[\s\S]*?\/\* AB_UI_RESIDUAL_END \*\//g,'');
const block=code=>BEGIN+'\n#ifdef __EMSCRIPTEN__\n'+code+'\n#endif\n'+END;
const wrap=(prefix,native,suffix=')')=>BEGIN+prefix+END+native+BEGIN+suffix+END;
function file(name){if(!pending.has(name)){const source=read('logic/'+name);assert.ok(!source.includes(BEGIN),'non-idempotent phase already applied: '+name);pending.set(name,{before:source,source});}return pending.get(name);}
function matchText(source,needle){const re=new RegExp(needle.replaceAll('\r\n','\n').replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replaceAll('\n','\\r?\\n'),'g');return [...source.matchAll(re)];}
function replace(name,needle,build,count=1){const f=file(name),matches=matchText(f.source,needle);assert.equal(matches.length,count,name+': '+needle);
 for(const m of matches.reverse())f.source=f.source.slice(0,m.index)+(typeof build==='function'?build(m[0]):build)+f.source.slice(m.index+m[0].length);}
function before(name,native,code,count=1){assert.ok(native.endsWith(';'));assert.ok(code.endsWith(';'));replace(name,native,m=>wrap('AB_UR_BEFORE(('+code.slice(0,-1)+'),',m.slice(0,-1))+m.slice(-1),count);connections.push({file:'logic/'+name,kind:'original_sink_selected_facts',native_expression:native});}
function literal(name,lexeme,id,count){const q=JSON.stringify(lexeme),f=file(name),matches=matchText(f.source,q);if(count!==undefined)assert.equal(matches.length,count,name+': '+q);assert.ok(matches.length,name+': '+q);
 for(const m of matches.reverse()){assert.ok(!f.source.slice(Math.max(0,m.index-90),m.index).includes('AB_UR_SOURCE('),'already bound literal');f.source=f.source.slice(0,m.index)+wrap('AB_UR_SOURCE('+JSON.stringify(id)+',',m[0])+f.source.slice(m.index+m[0].length);}
 connections.push({file:'logic/'+name,id,kind:'immutable_literal_address',original_lexeme:lexeme,occurrences:matches.length});}
function argsAt(s,offset){let start=s.indexOf('(',offset),last=start+1,depth=1,quote=null,args=[];
 for(let i=start+1;i<s.length;i++){const c=s[i];if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}if(c==='"'||c==="'"){quote=c;continue;}
  if(s.slice(i,i+2)==='/*'){i=s.indexOf('*/',i+2)+1;continue;}if(s.slice(i,i+2)==='//'){i=s.indexOf('\n',i+2);continue;}
  if(c==='('||c==='['||c==='{')depth++;if(c===')'||c===']'||c==='}'){if(!--depth){args.push(s.slice(last,i));return{args,start,end:i+1};}}
  if(c===','&&depth===1){args.push(s.slice(last,i));last=i+1;}}
 throw Error('unbalanced native call');}
function originalCall(name,prefix){const s=file(name).source,at=s.indexOf(prefix);assert.ok(at>=0,name+': '+prefix);assert.equal(s.indexOf(prefix,at+1),-1);const end=argsAt(s,at).end;assert.equal(s[end],';');return s.slice(at,end+1);}
const itemFiles=['cmd-obj.c','cmd-wizard.c','effect-handler-general.c','player-attack.c','ui-knowledge.c','ui-object.c','ui-spell.c','cmd-pickup.c','ui-death.c','ui-store.c'];
const candidateByLexeme=new Map(manifest.static_producer_candidates.filter(x=>x.kind.startsWith('item_')).map(x=>[x.lexeme,x]));
for(const name of itemFiles){const f=file(name),s=f.source,spans=[];const re=/\b(cmd_get_item|get_item|cmd_get_spell)\s*\(/g;let m;
 while((m=re.exec(s))){const call=argsAt(s,m.index);const positions=m[1]==='cmd_get_item'?[3,4]:m[1]==='get_item'?[1,2]:[6,8];
  for(const index of positions){const arg=call.args[index];if(!arg)throw Error('wrong original signature');
   if(arg.includes('AB_IF_ITEM_PROMPT('))continue;
   for(const str of arg.matchAll(/"(?:[^"\\]|\\.)*"/g)){const lexeme=JSON.parse(str[0]),record=candidateByLexeme.get(lexeme);if(!record)throw Error('unreviewed item producer '+name+': '+str[0]);
    const argOffset=s.indexOf(arg,call.start+1),at=argOffset+str.index;spans.push({at,end:at+str[0].length,id:record.id,native:str[0]});}}
 }
 for(const span of spans.sort((a,b)=>b.at-a.at)){f.source=f.source.slice(0,span.at)+wrap('AB_UR_SOURCE('+JSON.stringify(span.id)+',',span.native)+f.source.slice(span.end);connections.push({file:'logic/'+name,id:span.id,kind:'item_literal_argument',original_expression:span.native});}
}
/* Local immutable prompt/rejection assignments, shared by command and direct paths. */
for(const[name,lexemes]of[
 ['effect-handler-general.c',['Enchant which item? ','You have nothing to enchant.','Uncurse which item? ','You have no curses to remove.','Identify which item? ','You have nothing to identify.','Recharge which item? ','You have nothing to recharge.','Brand which kind of ammunition? ','You have nothing to brand.','Brand which bolts? ','You have no bolts to brand.','Make arrows from which staff? ','You have no staff to use.','Drain charges from which item? ','You have nothing to drain charges from.']],
 ['cmd-pickup.c',['Get which item?','You see nothing there.']],['ui-death.c',['Examine which item? ','You have nothing to examine.']],
 ['ui-object.c',['Ignore which item? ','You have nothing to ignore.']],['ui-store.c',['You have nothing that I want. ','Give which item? ','Sell which item? ','Drop which item? ']],
])for(const lexeme of lexemes)literal(name,lexeme,candidateByLexeme.get(lexeme).id,1);
before('ui-object.c','msg("%s", str);','ab_ur_message_source(str,MSG_GENERIC);');
before('ui-spell.c','msg("%s", error);','ab_ur_message_source(error,MSG_GENERIC);');
replace('ui-spell.c','my_strcap(prompt);',m=>m+block('\tab_if_item_prompt(cmd==CMD_CAST?"ui.residual.spell.book_prompt.cast":cmd==CMD_STUDY?"ui.residual.spell.book_prompt.study":NULL,prompt);'),1);
/* Deferred immutable wizard and timed-save literals are resolved by address. */
for(const[lexeme,id]of[
 ['Bailed out.  Changes to item lost.','ui.residual.wizard.item.cancelled'],['Changes ignored.','ui.residual.wizard.item.ignored'],["Couldn't queue command.  Changes lost.",'ui.residual.wizard.item.queue_failed'],
])literal('cmd-wizard.c',lexeme,id,1);
before('cmd-wizard.c','msg("%s", done_msg);','ab_ur_message_source(done_msg,MSG_GENERIC);');
for(const[key,word]of[['normal','normal'],['good','good'],['excellent','excellent']])literal('cmd-wizard.c',word,'ui.residual.quality.'+key,1);
before('cmd-wizard.c','msg("Creating a lot of %s items.  Base level = %d.", quality, level);','ab_ur_message("ui.residual.wizard.item.statistics",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_REF("quality",ab_dc_source_message_id(quality)),AB_UI_INT("level",level)},2);');
literal('mon-blows.c','You stand your ground!','ui.residual.timed_save.fear',1);
literal('mon-blows.c','You resist the effects!','ui.residual.timed_save.paralysis',1);
before('mon-blows.c','msg("%s", save_msg);','ab_ur_message_source(save_msg,MSG_GENERIC);');
/* Every native generation error production is identified before the builder returns. */
for(const record of manifest.static_producer_candidates.filter(x=>x.kind==='generation_error')){
 let hits=0;for(const name of['generate.c','gen-cave.c']){const count=matchText(file(name).source,JSON.stringify(record.lexeme)).length;if(count){literal(name,record.lexeme,record.id,count);hits+=count;}}
 assert.ok(hits,record.id);
}
before('generate.c','msg("Generation restarted: %s.", error);','ab_ur_generation(error);',2);
/* Diagnostics retain original selected canonical fields; no lookup is rerun. */
before('mon-attack.c','msg("ERROR: Effect handler not found for %s.", effect->name);','ab_ur_message("ui.residual.diagnostic.effect_handler",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_OPAQUE("effect","canonical_identity",effect->name)},1);',2);
for(const[key,english]of[['deep_unique','Deep unique (%s).'],['deep','Deep monster (%s).'],['unique','Unique (%s).']])
 before('mon-make.c','msg('+JSON.stringify(english)+', race->name);','ab_ur_message("ui.residual.monster.'+key+'",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_REF("race",ab_naming_monster_name_id(race))},1);');
const spellCalls=[
 ['invis','msg("No message-invis for monster "\n\t\t\t\t\t\t"spell %d cast by %s.  "\n\t\t\t\t\t\t"Please report this bug.",\n\t\t\t\t\t\t(int)spell->index, mon->race->name);'],
 ['miss','msg("No message-miss for monster spell %d "\n\t\t\t\t\t"cast by %s.  Please report this bug.",\n\t\t\t\t\t(int)spell->index, mon->race->name);'],
 ['vis','msg("No message-vis for monster spell %d "\n\t\t\t\t\t"cast by %s.  Please report this bug.",\n\t\t\t\t\t(int)spell->index, mon->race->name);'],
];
for(const[role]of spellCalls){const source=file('mon-spell.c').source,prefix='msg("No message-'+role+' for monster ',at=source.indexOf(prefix);assert.ok(at>=0,role);const end=argsAt(source,at).end;assert.equal(source[end],';');
 before('mon-spell.c',source.slice(at,end+1),'ab_ur_message("ui.residual.diagnostic.monster_spell.'+role+'",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_INT("spell",spell->index),AB_UI_REF("race",ab_naming_monster_name_id(mon->race))},2);');}
before('obj-properties.c','msg("Bug: flag \'%s\' (index %d) noticed but has "\n\t\t\t\t"no entry in object_property.txt.",\n\t\t\t\tlist_obj_flag_names[flag], flag);','ab_ur_message("ui.residual.diagnostic.flag",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_OPAQUE("flag","canonical_identity",list_obj_flag_names[flag]),AB_UI_INT("index",flag)},2);');
before('obj-util.c','msg("No object: %d:%d (%s)", tval, sval, tval_find_name(tval));','ab_ur_message("ui.residual.diagnostic.object_kind",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_INT("tval",tval),AB_UI_INT("sval",sval),AB_UI_REF("type",ab_ur_tval_name(tval))},3);');
before('trap.c','msg("You have disabled the %s.",\n\t\t\t\tcurrent_trap->kind->name);','ab_ur_message("ui.residual.trap.disabled",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_OPAQUE("trap","TrapName",ab_ur_trap_name(current_trap->kind))},1);');
before('ui-command.c','msg("%s screen dump saved.", mode ? "Forum text" : "HTML");','ab_ur_message("ui.residual.screen_dump.saved",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_REF("format",mode?"ui.residual.screen_dump.forum":"ui.residual.screen_dump.html")},1);');
before('ui-options.c','msg("Saved %s.", strstr(title, " ") + 1);','ab_ur_preferences_message(true);');
before('ui-options.c','msg("Failed to save %s.", strstr(title, " ") + 1);','ab_ur_preferences_message(false);');
for(const[category,call]of[
 ['keymaps','dump_pref_file(keymap_dump, "Dump keymaps", 13)'],['monsters','dump_pref_file(dump_monsters, title, 15)'],['objects','dump_pref_file(dump_objects, title, 15)'],['features','dump_pref_file(dump_features, title, 15)'],['flavors','dump_pref_file(dump_flavors, title, 15)'],['colors','dump_pref_file(dump_colors, title, 15)'],['windows','dump_pref_file(option_dump, "Dump window settings", 20)'],['autoinscriptions','dump_pref_file(dump_autoinscriptions, "Dump autoinscriptions", 20)'],['char_screen','dump_pref_file(dump_ui_entry_renderers, "Dump char screen options", 20)'],
])replace('ui-options.c',call,m=>wrap('AB_UR_PREF("ui.residual.preferences.category.'+category+'",',m));
before('ui-options.c','msg("Failed to load \'%s\'!", ftmp);','ab_ur_message("ui.residual.preferences.load_failed",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_OPAQUE("path","opaque_file_path",ftmp)},1);');
before('ui-options.c','msg("Loaded \'%s\'.", ftmp);','ab_ur_message("ui.residual.preferences.loaded",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_OPAQUE("path","opaque_file_path",ftmp)},1);');
before('ui-prefs.c',originalCall('ui-prefs.c','msg("Parse error in %s line %d column %d:'),'ab_ur_message("ui.residual.preferences.parse_error",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_OPAQUE("path","opaque_file_path",name),AB_UI_INT("line",s.line),AB_UI_INT("column",s.col),AB_UI_OPAQUE("token","opaque_parser_token",s.msg),AB_UI_REF("error",ab_ur_parser_error(s.error))},5);');
/* One current literal field in the original nested debug table. */
replace('ui-game.c','const char* em =\n\t\t\t\t\t\t\tcmd->nested_error;',m=>m+block('\t\t\t\t\t\tif(em && cmd->nested_keymap==1)ab_ur_source("ui.residual.nested_command.debug_invalid",em);'));
before('ui-game.c','msg("%s", em ? em : "That is not a valid nested command.");','ab_ur_message(em?ab_dc_source_message_id(em):"ui.residual.nested_command.invalid",MSG_GENERIC,NULL,0);');
/* Includes are fenced as whole insertions; original neighboring line endings survive. */
for(const[name,f]of pending){const include='#include "angband.h"';let at=f.source.indexOf(include);if(at>=0)f.source=f.source.slice(0,at+include.length)+block('\n#include "web-ui-residual-text.h"\n#include "web-death-cause.h"\n#include "web-interface-text.h"')+f.source.slice(at+include.length);
 else{const first=f.source.match(/^#include [^\r\n]+/m);assert.ok(first,name);at=first.index+first[0].length;f.source=f.source.slice(0,at)+block('\n#include "web-ui-residual-text.h"\n#include "web-death-cause.h"\n#include "web-interface-text.h"')+f.source.slice(at);}
 assert.equal(stripResidual(f.source),f.before,name+' exact added-only reconstruction');
}
const baseline=path.join(root,dir,'source-baseline');fs.mkdirSync(baseline,{recursive:true});
for(const[name,f]of pending){assert.equal(read('logic/'+name),f.before,'concurrent source write '+name);assert.ok(!fs.existsSync(path.join(baseline,name)),'immutable phase baseline already exists');}
for(const[name,f]of pending){fs.writeFileSync(path.join(baseline,name),f.before);fs.writeFileSync(path.join(root,'logic',name),f.source);}
manifest.status='source_connected_partial_unbuilt';manifest.connections=connections;manifest.source_files=[...pending.keys()].map(x=>'logic/'+x);manifest.baseline=dir+'/source-baseline';
manifest.source_before_sha256=Object.fromEntries([...pending].map(([name,f])=>['logic/'+name,createHash('sha256').update(f.before).digest('hex')]));
manifest.remaining_assigned_source_indices=[18,19,159,167,214];
fs.writeFileSync(path.join(root,dir,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({files:pending.size,connections:connections.length,remaining_assigned_sources:manifest.remaining_assigned_source_indices}));
