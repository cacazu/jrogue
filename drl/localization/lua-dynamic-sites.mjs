/** Source-guarded integration of complete events and finite producer identities. */
import {scanMessageCalls} from './message-inventory.mjs';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {dynamicMessageCalls,producerMessages,finiteDispatchMessages,verifyDynamicMessages} from './lua-dynamic-message-translations.mjs';
const q=JSON.stringify;
const params=m=>`{${m.bindings.map(b=>`{name=${q(b.name)},kind=${q(b.type)},value=${b.type==='integer'?`tostring(${b.presentationExpression})`:b.presentationExpression}}`).join(', ')}}`;
const request=(m,feeling=false)=>`ui.${feeling?'semantic_feeling':'semantic_text'}(${q(m.id)}, ${q(m.english)}, ${params(m)})`;
export function curateDynamicLuaSites({file,exact,catalog,patches}){
 verifyDynamicMessages();
 const reviewed=[],cache=new Map();
 const at=(f,line)=>{if(!cache.has(f))cache.set(f,scanMessageCalls(file(f),'lua',f));const cs=cache.get(f).filter(c=>c.line===line);if(cs.length!==1)throw Error(`Expected one dynamic call ${f}:${line}`);return cs[0];};
 const replace=(c,replacement,ids,producerOnly=false)=>{patches.push({file:c.file,start:c.start,end:c.end,original:c.original,replacement,id:ids[0],kind:producerOnly?'semantic-producer-dispatch':'semantic-message'});reviewed.push({key:c.key,id:ids[0],variantIds:ids,source:c.original,replacement,producerOnly});};
 const register=m=>catalog(m.id,m.english,m.japanese,Object.fromEntries((m.bindings??[]).map(b=>[b.name,b.type])));
 for(const row of dynamicMessageCalls){
  const c=at(row.file,row.line);for(const m of row.messages)register(m);
  const args=c.arguments.map((a,index)=>{
   const messages=row.messages.filter(m=>m.argumentIndex===index);if(!messages.length)return a.source;
   if(messages.length===1)return request(messages[0],c.callee==='ui.msg_feel');
   if(!row.selection||messages.length!==2)throw Error(`No whole-message selection ${c.key}`);
   const selected=row.selection.cases.map(s=>messages.find(m=>m.variant===s.variant));
   if(selected.some(m=>!m)||JSON.stringify(selected[0].bindings)!==JSON.stringify(selected[1].bindings))throw Error(`Variant binding mismatch ${c.key}`);
   const [yes,no]=selected;
   return `(function() local id, english; if ${row.selection.originalExpression} then id=${q(yes.id)}; english=${q(yes.english)} else id=${q(no.id)}; english=${q(no.english)} end; return ui.semantic_text(id, english, ${params(yes)}) end)()`;
  });
  replace(c,`${c.callee}(${args.join(', ')})`,row.messages.map(m=>m.id));
 }
 for(const p of producerMessages)register(p);
 for(const p of producerMessages.filter(p=>p.producerKind==='local-message-assignment')){
  exact(p.file,p.sourceGuard,`${p.variable} = ui.semantic_text(${q(p.id)}, ${q(p.english)})`,p.id);
 }
 // Keep selected cave data and English text fields; add only the reviewed presentation ID.
 for(const p of producerMessages.filter(p=>p.producerKind==='selected-table-field')){
  exact(p.file,`feeling = ${q(p.english)}`,`feeling = ${q(p.english)}, feeling_text_id = ${q(p.id)}`,p.id);
 }
 for(const line of [286,318]){
  const producers=producerMessages.filter(p=>p.producerKind==='local-presentation-table-field'&&p.generatorId===(line===286?'gen_single':'gen_single_plus'));
  const f='bin/data/drl/generators.lua',source=file(f),first=scanSource(source,'lua').tokens.find(t=>t.kind==='string'&&t.line===producers[0].line&&t.value===producers[0].english);
  const close=source.indexOf('\n\t\t\t}',first.end);if(close<0)throw Error('Intro producer table closing guard missing');
  patches.push({file:f,start:close+5,end:close+5,original:'',replacement:`\n\t\t\tlocal intro_text_ids = {${producers.map(p=>`${p.key}=${q(p.id)}`).join(', ')}}`,id:null,kind:'semantic-producer-metadata'});
 }
 for(const d of finiteDispatchMessages){
  const c=at(d.file,d.line);let replacement;
  if(d.line===193&&d.file.endsWith('mterebus.lua'))replacement=c.original;
  else if(d.file.endsWith('/generator.lua')){
   const fallback=producerMessages.find(p=>p.producerKind==='fallback-literal'&&p.file===d.file);
   replacement=`${c.callee}((function() if set.feeling then return ui.semantic_feeling(set.feeling_text_id, set.feeling) end; return ui.semantic_feeling(${q(fallback.id)}, ${q(fallback.english)}) end)())`;
  }else if(d.file.endsWith('/generators.lua'))replacement=`${c.callee}(ui.semantic_feeling(intro_text_ids[monster], intro[monster]))`;
  else if(d.presentationExpression){
   const source=d.presentationExpression,ps=producerMessages.filter(p=>p.producerKind==='registry-presentation-field');
   // Scope/field/English guards stay in the generated registry function; capture a typed record instead of translated prose.
   replacement=`${c.callee}(ui.registry_feeling('item',lid,'base_game','warning',proto.warning))`;
  }
  else if(d.line===219){
   const ps=producerMessages.filter(p=>p.producerKind==='random-choice-literal');
   const choices=ps.map(p=>`{id=${q(p.id)},english=${q(p.english)}}`).join(', ');
   replacement=`${c.callee}((function(selected) return ui.semantic_feeling(selected.id, selected.english) end)(table.random_pick{${choices}}))`;
  }else throw Error(`Unimplemented finite dispatcher ${c.key}`);
  replace(c,replacement,d.producerIds,true);
 }
 // Reviewed original special-stair producers feed the preserved generic core dispatcher.
 const stairRows=[['breeze','You feel a breeze of morbid air...','不気味な風が吹き抜ける……'],['passage','You sense a passage to a place beyond...','ここから別の場所へ通じる道を感じる……'],['cold','You shiver from cold...','寒さに身震いする……']];
 for(const [suffix,en,ja]of stairRows){
  const id='message.generator.special-stairs.'+suffix;catalog(id,en,ja);
  exact('bin/data/drl/generator.lua',q(en),`ui.semantic_feeling(${q(id)}, ${q(en)})`,id);
  if(suffix==='cold')exact('bin/data/drl/generators.lua',`generator.generate_special_stairs( "rstairs", ${q(en)} )`,`generator.generate_special_stairs( "rstairs", {ui.semantic_feeling(${q(id)}, ${q(en)})} )`,id);
 }
 // Capture the original blueprint fields at their existing producers; names and spawn count stay English/domain values.
 const ai='bin/data/drl/ai.lua';
 const offspring=[['message.ai.spawner.offspring-singular','The {{subject}} spawns a {{offspring}}!','{{subject}}が{{offspring}}を生み出した！'],['message.ai.spawner.offspring-plural','The {{subject}} spawns {{offspring}}!','{{subject}}が{{offspring}}の群れを生み出した！']];
 for(const [id,en,ja]of offspring)catalog(id,en,ja,{subject:'string',offspring:'string'});
 exact(ai,'local spawnname = "a "..beings[whom].name',`local spawn_name_snapshot = beings[whom].name\n\t\t\t\tlocal spawnname = "a "..spawn_name_snapshot\n\t\t\t\tlocal spawn_display = ui.registry_text("being", whom, "base_game", "name", spawn_name_snapshot)\n\t\t\t\tlocal spawn_text_id, spawn_text_english = ${q(offspring[0][0])}, ${q(offspring[0][1])}`);
 exact(ai,'spawnname = beings[whom].name_plural',`spawnname = beings[whom].name_plural\n\t\t\t\t\tspawn_display = ui.registry_text("being", whom, "base_game", "name_plural", spawnname)\n\t\t\t\t\tspawn_text_id, spawn_text_english = ${q(offspring[1][0])}, ${q(offspring[1][1])}`);
 const spawning=at(ai,233);
 replace(spawning,`self:msg("", ui.semantic_text(spawn_text_id, spawn_text_english, {{name="subject",kind="string",value=ui.registry_text("being", self.id, "base_game", "name", self.name)}, {name="offspring",kind="string",value=spawn_display}}))`,offspring.map(r=>r[0]));
 return reviewed;
}
