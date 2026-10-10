// SPDX-License-Identifier: GPL-2.0-only
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import{fileURLToPath}from'node:url';
import{scoped}from'../domain-text-data/integrate.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url)),logic=path.resolve(directory,'../../logic');
const review=JSON.parse(fs.readFileSync(path.resolve(directory,'../residual-message-review.json'),'utf8')).groups.find(g=>g.role==='object_device_equipment').callsites;
const block=text=>'/* AB_OBJECT_BEGIN */\n#ifdef __EMSCRIPTEN__\n'+text+'\n#endif\n/* AB_OBJECT_END */\n';
const inline=text=>'/* AB_OBJECT_INLINE_BEGIN */'+text+'/* AB_OBJECT_INLINE_END */';
export const stripObjects=source=>source.replace(/\/\* AB_OBJECT_BEGIN \*\/[\s\S]*?\/\* AB_OBJECT_END \*\/\r?\n?/g,'').replace(/\/\* AB_OBJECT_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_OBJECT_INLINE_END \*\//g,'');
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');
function once(source,needle,replacement){let actual=needle,p=source.indexOf(actual);if(p<0&&needle.includes('\n')){actual=needle.replaceAll('\n','\r\n');p=source.indexOf(actual);replacement=replacement.replace(needle,actual);}if(p<0||source.indexOf(actual,p+actual.length)>=0)throw Error('Unique source anchor missing '+needle);return source.slice(0,p)+replacement+source.slice(p+actual.length);}
function after(source,needle,capture){return once(source,needle,needle+block(capture));}
function afterLast(source,needle,capture){let actual=needle,p=source.lastIndexOf(actual);if(p<0&&needle.includes('\n')){actual=needle.replaceAll('\n','\r\n');p=source.lastIndexOf(actual);}if(p<0)throw Error('Missing source anchor '+needle);return source.slice(0,p+actual.length)+block(capture)+source.slice(p+actual.length);}
function word(source,literal,id){return source.replaceAll('"'+literal+'"',inline('AB_OBJECT_WORD("object.'+id+'",')+'"'+literal+'"'+inline(')'));}
function declare(body){return body.replace('{','{'+block(' struct ab_naming_snapshot ab_object_name={0};'));}
const capture=' ab_object_snapshot(&ab_object_name,o_name);';
function emit(id,params=[],owned='&ab_object_name',sound='MSG_GENERIC'){
 return 'ab_object_message('+id+','+sound+','+owned+','+(params.length?'(const struct ab_ui_param[]){'+params.join(',')+'}':'NULL')+','+params.length+');';
}
const id=name=>'"object.'+name+'"';
const ref=(name,value)=>'AB_UI_REF("'+name+'",'+value+')';
const key='AB_UI_OPAQUE("key","canonical_identity",ab_object_key_text)';
function variant(prefix,test){return '('+test+' ? '+id(prefix+'.singular')+' : '+id(prefix+'.plural')+')';}
function wrapCall(body,index,statements,changes=[]){
 const row=review.find(r=>r.source_index===index),literal=JSON.stringify(row.original_english),where=body.indexOf(literal);
 if(where<0 || body.indexOf(literal,where+literal.length)>=0)throw Error('Unique original literal missing '+index);
 const start=body.lastIndexOf('msg',where);
 let depth=0,quote=false,escaped=false,stop=-1;
 for(let p=body.indexOf('(',start);p<body.length;p++){
  const c=body[p];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quote=false;continue;}
  if(c==='"'){quote=true;continue;}if(c==='(')depth++;else if(c===')'&&--depth===0){stop=body.indexOf(';',p)+1;break;}
 }
 if(stop<=start)throw Error('Unclosed original call '+index);
 const native=body.slice(start,stop);let wasm=native;
 for(const[from,to]of changes)wasm=wasm.replaceAll(from,to);
 const replacement='/* AB_OBJECT_BEGIN */\n#ifdef __EMSCRIPTEN__\n{\n'+statements+'\n'+wasm+'\n}\n#else\n/* AB_OBJECT_END */'+native+'/* AB_OBJECT_BEGIN */\n#endif\n/* AB_OBJECT_END */\n';
 return body.slice(0,start)+replacement+body.slice(stop);
}
function nativeKey(expression){return 'char ab_object_key='+expression+';char ab_object_key_text[2]={ab_object_key,0};\n';}
const edits=new Map();
edits.set('cmd-obj.c',source=>{
 source=scoped(source,'static int check_devices(',body=>{
  for(const[literal,name]of [['zap the rod','action.device.rod'],['use the wand','action.device.wand'],['use the staff','action.device.staff'],['activate it','action.device.activation'],['wand','device.wand'],['staff','device.staff']])body=word(body,literal,name);
  body=wrapCall(body,20,emit(id('message.device.no_charges'),[ref('device','ab_object_word_id(what,false)')],'NULL'));
  return wrapCall(body,21,emit(id('message.device.failed'),[ref('action','ab_object_word_id(action,false)')],'NULL'));
 });
 source=scoped(source,'void do_cmd_wield(',body=>{
  body=declare(body);
  body=after(body,'object_desc(o_name, sizeof(o_name), equip_obj, ODESC_BASE,\n\t\t\tplayer);',capture);
  body=afterLast(body,'ODESC_PREFIX | ODESC_FULL, player);',capture);
  for(const[literal,name]of [['You were wielding','wielding'],['You were holding','holding'],['You were wearing','wearing']])body=word(body,literal,'action.removal.'+name);
  body=wrapCall(body,22,'const char *ab_object_relation=equip_describe(player,slot);\n'+emit(id('message.equipment.cannot_remove'),['ab_object_relation_parameter()']),[['equip_describe(player, slot)','ab_object_relation']]);
  return wrapCall(body,23,nativeKey('gear_to_label(player, equip_obj)')+emit(id('message.equipment.took_off'),[ref('action','ab_object_word_id(act,false)'),key],undefined,'MSG_WIELD'),[['gear_to_label(player, equip_obj)','ab_object_key']]);
 });
 source=scoped(source,'static bool use_aux(',body=>{
  body=declare(body);
  body=after(body,'-1 : 0)) << 16), player);',' ab_object_snapshot(&ab_object_name,name);');
  body=wrapCall(body,26,emit(id('message.use.floor_remainder')));
  body=wrapCall(body,27,nativeKey('label')+emit(id('message.use.first_remainder'),[key]));
  return wrapCall(body,28,nativeKey('label')+emit(id('message.use.remainder'),[key]));
 });
 return source;
});
edits.set('effect-handler-general.c',source=>{
 source=scoped(source,'static bool enchant_spell(',body=>{
  body=declare(body);body=after(body,'object_desc(o_name, sizeof(o_name), obj, ODESC_BASE, player);',capture);
  return wrapCall(body,58,'bool ab_object_carried=object_is_carried(player,obj);int ab_object_number=obj->number;\n'+emit(variant('message.enchant.glow','ab_object_number <= 1'),[ref('owner','ab_object_carried?"object.owner.carried":"object.owner.floor"')]),[['object_is_carried(player, obj)','ab_object_carried'],['obj->number','ab_object_number']]);
 });
 source=scoped(source,'static void brand_object(',body=>{
  body=declare(body);body=after(body,'object_desc(o_name, sizeof(o_name), obj, ODESC_BASE, player);',capture);
  return wrapCall(body,59,'int ab_object_number=obj->number;\n'+emit(variant('message.brand.aura','ab_object_number <= 1'),[ref('brand','ab_object_word_id(name,false)')]),[['obj->number','ab_object_number']]);
 });
 source=scoped(source,'bool effect_handler_DISENCHANT(',body=>{
  body=declare(body);body=after(body,'object_desc(o_name, sizeof(o_name), obj, ODESC_BASE, player);',capture);
  for(const[index,prefix]of [[66,'message.disenchant.resisted'],[67,'message.disenchant.happened']])
   body=wrapCall(body,index,nativeKey('gear_to_label(player, obj)')+'int ab_object_number=obj->number;\n'+emit(variant(prefix,'ab_object_number == 1'),[key]),[['gear_to_label(player, obj)','ab_object_key'],['obj->number','ab_object_number']]);
  return body;
 });
 for(const[functionName,index,prefix]of [['CURSE_ARMOR',73,'curse_armor'],['CURSE_WEAPON',75,'curse_weapon']])source=scoped(source,'bool effect_handler_'+functionName+'(',body=>{
  body=declare(body);body=after(body,'object_desc(o_name, sizeof(o_name), obj, ODESC_FULL, player);',capture);
  body=wrapCall(body,index,emit(id('message.'+prefix+'.resisted')));
  return body.replaceAll('return (true);','return '+inline('(AB_OBJECT_CAPTURE(ab_naming_snapshot_release(&ab_object_name)), ')+'(true)'+inline(')')+';');
 });
 source=scoped(source,'bool effect_handler_TAP_DEVICE(',body=>{
  body=word(word(body,'staff','device.staff'),'wand','device.wand');
  body=wrapCall(body,77,emit(id('message.tap_device.no_energy'),[ref('device','ab_object_word_id(item,false)')],'NULL'));
  return wrapCall(body,78,emit(id('message.tap_device.mana_full'),[ref('device','ab_object_word_id(item,true)')],'NULL'));
 });
 for(const suffix of ['WEAPON','AMMO','BOLTS'])source=scoped(source,'bool effect_handler_BRAND_'+suffix+'(',body=>{
  for(const wordName of ['Flame','Frost','Venom'])body=word(body,wordName,'brand.'+wordName.toLowerCase());return body;
 });
 return source;
});
edits.set('obj-curse.c',source=>scoped(source,'bool remove_object_curse(',body=>wrapCall(body,138,emit(id('message.curse.removed'),[ref('curse','ab_domain_curse_name_id(pick)')],'NULL'))));
edits.set('obj-gear.c',source=>{
 source=scoped(source,'const char *equip_describe(',body=>{
  for(const[expression,heavy,named]of [['slot_table[type].heavy_describe',true,false],['format(slot_table[type].describe, p->body.slots[slot].name)',false,true],['slot_table[type].describe',false,false]])
   body=once(body,'return '+expression+';','return '+inline('(AB_OBJECT_CAPTURE(ab_object_relation_capture(p->race->body,slot,type,'+heavy+','+named+')), ')+expression+inline(')')+';');
  return body;
 });
 source=scoped(source,'void inven_item_charges(',body=>wrapCall(body,145,'int ab_object_charges=obj->pval;\n'+emit(variant('message.charges.inventory','ab_object_charges == 1'),['AB_UI_INT("charges",ab_object_charges)'],'NULL'),[['obj->pval','ab_object_charges']]));
 source=scoped(source,'void inven_takeoff(',body=>{
  body=declare(body);body=after(body,'ODESC_PREFIX | ODESC_FULL,\n\t\tplayer);',capture);
  for(const[literal,name]of [['You were wielding','wielding'],['You were holding','holding'],['You were wearing','wearing']])body=word(body,literal,'action.removal.'+name);
  return wrapCall(body,148,nativeKey('gear_to_label(player, obj)')+emit(id('message.equipment.took_off'),[ref('action','ab_object_word_id(act,false)'),key],undefined,'MSG_WIELD'),[['gear_to_label(player, obj)','ab_object_key']]);
 });return source;
});
edits.set('obj-pile.c',source=>{
 source=scoped(source,'static void floor_carry_fail(',body=>{
  body=declare(body);body=after(body,'object_desc(o_name, sizeof(o_name), drop, ODESC_BASE, player);',capture);
  for(const[wordName,idName]of [['breaks','break.singular'],['break','break.plural'],['disappears','disappear.singular'],['disappear','disappear.plural']])body=word(body,wordName,'verb.'+idName);
  return wrapCall(body,163,emit(id('message.drop.lost'),[ref('verb','ab_object_word_id(verb,false)')]));
 });
 return scoped(source,'void floor_item_charges(',body=>wrapCall(body,164,'int ab_object_charges=obj->pval;\n'+emit(variant('message.charges.floor','ab_object_charges == 1'),['AB_UI_INT("charges",ab_object_charges)'],'NULL'),[['obj->pval','ab_object_charges']]));
});
edits.set('project-obj.c',source=>{
 source=scoped(source,'int inven_damage(',body=>{
  body=declare(body);body=after(body,'ODESC_BASE, p);',capture);
  const quantity='(ab_object_number > 1 ? (amt == ab_object_number ? "all" : (amt > 1 ? "some" : "one")) : "single")';
  const statement=nativeKey('gear_to_label(p, obj)')+'int ab_object_number=obj->number;const char *ab_object_quantity='+quantity+';\nchar ab_object_event_id[128];snprintf(ab_object_event_id,sizeof(ab_object_event_id),"object.message.inventory_damage.%s.%s",ab_object_quantity,amt > 1 ? "plural" : "singular");\n'+emit('ab_object_event_id',[key,ref('result','damage?"object.damage.result.damaged":"object.damage.result.destroyed"')],undefined,'MSG_DESTROY');
  return wrapCall(body,191,statement,[['gear_to_label(p, obj)','ab_object_key'],['obj->number','ab_object_number']]);
 });
 for(const signature of ['static void project_object_handler_ACID(','static void project_object_handler_ELEC(','static void project_object_handler_FIRE(','static void project_object_handler_COLD(','static void project_object_handler_SOUND(','static void project_object_handler_SHARD(','static void project_object_handler_ICE(','static void project_object_handler_FORCE(','static void project_object_handler_PLASMA(','static void project_object_handler_METEOR(','static void project_object_handler_MANA('])source=scoped(source,signature,body=>{
  for(const[wordName,idName]of [['melts','melt.singular'],['melt','melt.plural'],['is destroyed','destroy.singular'],['are destroyed','destroy.plural'],['burns up','burn.singular'],['burn up','burn.plural'],['shatters','shatter.singular'],['shatter','shatter.plural']])body=word(body,wordName,'verb.'+idName);
  return body;
 });
 source=scoped(source,'bool project_o(',body=>{
  body=after(body,'char o_name[80];',' struct ab_naming_snapshot ab_object_name={0};');
  body=after(body,'ODESC_BASE, player);',capture);
  body=wrapCall(body,192,'int ab_object_number=obj->number;\n'+emit(variant('message.projection.unaffected','ab_object_number == 1')), [['obj->number','ab_object_number']]);
  body=wrapCall(body,193,emit(id('message.projection.destroyed'),[ref('verb','ab_object_word_id(note_kill,false)')],undefined,'MSG_DESTROY'));
  const anchor='\n\t\t}\n\n\t\t/* Next object */';
  return once(body,anchor,block(' ab_naming_snapshot_release(&ab_object_name);')+anchor);
 });return source;
});
export function integrate(){
const planned=[];
for(const[file,edit]of edits){
 const filename=path.join(logic,file),original=fs.readFileSync(filename,'utf8');
 if(original.includes('AB_OBJECT_BEGIN'))throw Error('Already applied '+file);
 let source=edit(original);const inc=source.match(/^#include [^\r\n]+[\r\n]+/m);
 if(!inc)throw Error('Missing include '+file);
 const includes='/* AB_OBJECT_BEGIN */\n#include "web-object-messages.h"\n#include "web-domain-text.h"\n#include <stdio.h>\n/* AB_OBJECT_END */\n';
 source=once(source,inc[0],includes+inc[0]);
 if(stripObjects(source)!==original)throw Error('Exact native reconstruction failed '+file);
 planned.push({file,filename,original,source});
}
for(const item of planned)if(fs.readFileSync(item.filename,'utf8')!==item.original)throw Error('Concurrent source mutation '+item.file);
fs.mkdirSync(path.join(directory,'source-baseline'),{recursive:true});
for(const item of planned){fs.writeFileSync(path.join(directory,'source-baseline',item.file),item.original);fs.writeFileSync(item.filename,item.source);}
const expression=/\/\* AB_OBJECT_BEGIN \*\/[\s\S]*?\/\* AB_OBJECT_END \*\/\r?\n?|\/\* AB_OBJECT_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_OBJECT_INLINE_END \*\//g;
const files=planned.map(item=>{let removed=0;const insertions=[...item.source.matchAll(expression)].map(match=>{const entry={offset_chars:match.index-removed,source:match[0]};removed+=match[0].length;return entry});return{file:item.file,baseline_sha256:sha(item.original),modified_sha256:sha(item.source),native_reconstruction_exact:true,insertions}});
fs.writeFileSync(path.join(directory,'integration-evidence.json'),JSON.stringify({schema_version:1,upstream_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',source_indices:review.filter(r=>![98,99].includes(r.source_index)).map(r=>r.source_index),files},null,2)+'\n');
console.log(JSON.stringify({sourceProducers:23,modifiedFiles:files.length,exactNativeReconstruction:true}));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))integrate();
