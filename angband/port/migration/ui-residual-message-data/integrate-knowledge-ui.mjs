/* One-shot source-selected UI consumers. Preserve every original native byte. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {stripResidual} from './native-parity.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir='migration/ui-residual-message-data';
const file='logic/ui-knowledge.c';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const before=read(file);let source=before;
const B='/* AB_UI_RESIDUAL_BEGIN */',E='/* AB_UI_RESIDUAL_END */';
const block=s=>B+'\n#ifdef __EMSCRIPTEN__\n'+s+'\n#endif\n'+E;
const records=[];
function fn(name){const begin=source.indexOf('static void '+name+'(');assert.ok(begin>=0,name);const end=source.indexOf('\r\n}',begin)+3;assert.ok(end>begin);return{begin,end,text:source.slice(begin,end)};}
function update(name,change){const f=fn(name),next=change(f.text);assert.equal(stripResidual(next),stripResidual(f.text),name+' exact native bytes');source=source.slice(0,f.begin)+next+source.slice(f.end);records.push({file,function:name,kind:'source_selected_ui_consumer',native_expression:stripResidual(f.text)});}
function insert(text,needle,added){assert.equal(text.split(needle).length-1,1,needle);return text.replace(needle,needle+block(added));}
update('display_rune',s=>insert(s,'c_prt(attr, rune_name(oid), row, col);','\tchar ab_rune_widget[48];\n\tsnprintf(ab_rune_widget,sizeof(ab_rune_widget),"row.%d.name",oid);\n\tab_knowledge_emit_last_rune("knowledge-items",ab_rune_widget,oid,false);'));
update('rune_lore',s=>{
 s=insert(s,'textblock *tb = textblock_new();','\tab_domain_info_begin("rune-lore");');
 s=insert(s,'char *title = string_make(rune_name(oid));','\tab_knowledge_info_last_rune(oid,false);');
 s=insert(s,'textblock_append(tb, "%s", rune_desc(oid));','\tab_knowledge_info_last_rune(oid,true);');
 const wait='textui_textblock_show(tb, SCREEN_REGION, NULL);';assert.equal(s.split(wait).length-1,1);
 return s.replace(wait,block('\tab_domain_info_tag(tb,"rune-lore");\n\tab_domain_info_commit();\n\tab_domain_info_close();')+wait);
});
update('shape_lore_append_misc_flags',s=>{
 s=insert(s,'\t\t\t\tprop->desc);','\tab_knowledge_info_property(OBJ_PROPERTY_FLAG,prop->index);');
 return insert(s,'\t\t\t\tability->desc);','\tab_knowledge_info_ability(ability);');
});
update('shape_lore',s=>{
 s=insert(s,'textblock *tb = textblock_new();','\tab_domain_info_begin("shape-lore");');
 s=insert(s,'textblock_append(tb, "%s", s->name);','\tab_domain_info_selected(AB_DOMAIN_SHAPE,s->sidx,AB_DOMAIN_NAME,0);');
 const wait='textui_textblock_show(tb, SCREEN_REGION, NULL);';assert.equal(s.split(wait).length-1,1);
 return s.replace(wait,block('\tab_domain_info_tag(tb,"shape-lore");\n\tab_domain_info_commit();\n\tab_domain_info_close();')+wait);
});
const include='#include "web-ui-residual-text.h"';assert.equal(source.split(include).length-1,1);
source=source.replace(include,include+'\n#include "web-domain-text.h"\n#include "web-knowledge-text.h"');
assert.equal(stripResidual(source),stripResidual(before));
assert.equal(read(file),before,'concurrent ui-knowledge edit');
const manifest=JSON.parse(read(dir+'/source-manifest.json'));
const en=JSON.parse(read(dir+'/en.json')),ja=JSON.parse(read(dir+'/ja.json'));
for(const[context,english,japanese]of[['rune-lore','Display rune knowledge','ルーンの知識を表示'],['shape-lore','Display shapechange effects','変身の効果を表示']]){
 const id='semantic.context.'+context.replaceAll('-','_'),expression='{ "'+english+'", do_cmd_knowledge_'+(context==='rune-lore'?'runes':'shapechange')+' }';
 const native=stripResidual(source);assert.ok(native.includes(expression));
 en[id]=english;ja[id]=japanese;manifest.entries.push({id,english,japanese,parameters:[],source_role:'native_action_context_label',sources:[{file,function:'reset_main_knowledge_menu',line:native.slice(0,native.indexOf(expression)).split('\n').length,original_expression:expression}],status:'source_connected_unbuilt'});
}
manifest.connections.push(...records);manifest.catalog_entries=manifest.entries.length;
manifest.knowledge_ui={source_connected:true,browser_verified:false,contexts:['rune-lore','shape-lore'],rune_getters:'unchanged original getter once, immediate private capture consumption',ability_gate:'original selected player ability predicate only',remaining_shape_sections:'basic/skills/modifiers/resistances/protections/sustains/triggering-spell composition remain independent migration work'};
fs.writeFileSync(path.join(root,file),source);
for(const[p,v]of[[dir+'/source-manifest.json',manifest],[dir+'/en.json',en],[dir+'/ja.json',ja]])fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
console.log(JSON.stringify({file,consumers:records.length,entries:manifest.entries.length,exact_native_bytes:true}));
