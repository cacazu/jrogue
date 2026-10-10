/** Reviewed complete core Lua events; original names/prototypes and mechanics remain English. */
import {scanMessageCalls} from './message-inventory.mjs';
const q=JSON.stringify;
const param=(name,expression,kind='string')=>`{name=${q(name)},kind=${q(kind)},value=${expression}}`;
const request=(id,en,bindings=[])=>`ui.semantic_text(${q(id)}, ${q(en)}, {${bindings.map(([n,e,k])=>param(n,e,k)).join(', ')}})`;
const itemName=(object,english=`${object}.name`)=>`ui.registry_text("item", ${object}.id, "base_game", "name", ${english})`;
const assemblyName=object=>`ui.registry_text("mod_array", ${object}.id, "base_game", "name", ${object}.name)`;
export function curateCoreLuaSites({file,exact,catalog,patches}){
 const reviewed=[],cache=new Map();
 function at(f,line){if(!cache.has(f))cache.set(f,scanMessageCalls(file(f),'lua',f));const c=cache.get(f).filter(c=>c.line===line);if(c.length!==1)throw Error(`Expected one core Lua message ${f}:${line}`);return c[0];}
 function replace(f,line,replacement,ids){const c=at(f,line);patches.push({file:f,start:c.start,end:c.end,original:c.original,replacement,id:ids[0],kind:'semantic-message'});reviewed.push({key:c.key,id:ids[0],variantIds:ids,source:c.original,replacement});}
 function event(f,line,suffix,en,ja,bindings=[]){const id='message.'+suffix;catalog(id,en,ja,Object.fromEntries(bindings.map(([n,e,k])=>[n,k??'string'])));const c=at(f,line);replace(f,line,`${c.callee}(${request(id,en,bindings)})`,[id]);}
 const being='bin/data/core/being.lua',item='bin/data/core/item.lua',level='bin/data/core/level.lua';
 event(being,419,'assembly-completed','You assemble the {{assembly}}.','{{assembly}}を組み立てた。',[['assembly',assemblyName('ma')]]);
 event(being,472,'weapon-already-fully-loaded','Your {{item}} is already fully loaded.','{{item}}はすでに満タンだ。',[['item',itemName('weapon')]]);
 for(const line of [480,489])event(being,line,'weapon-no-more-ammo','You have no more ammo for the {{item}}!','{{item}}用の弾薬がもうない！',[['item',itemName('weapon')]]);
 const reload=[['message.full-load','You fully load the {{item}}.','{{item}}に弾薬を満タンまで装填した。'],['message.full-load-quick','You quickly fully load the {{item}}.','{{item}}に素早く弾薬を満タンまで装填した。'],['message.full-load-observer','{{subject}} fully loads the {{item}}.','{{subject}}が{{item}}に弾薬を満タンまで装填した。']];
 for(const [id,en,ja]of reload)catalog(id,en,ja,id.endsWith('observer')?{subject:'string',item:'string'}:{item:'string'});
 const params=`{${param('item',itemName('weapon'))}}`;
 const player=`ui.semantic_text(pack and ${q(reload[1][0])} or ${q(reload[0][0])}, pack and ${q(reload[1][1])} or ${q(reload[0][1])}, ${params})`;
 replace(being,496,`self:msg(${player}, ${request(reload[2][0],reload[2][1],[['subject','ui.being_name(self, true, true)'],['item',itemName('weapon')]])})`,reload.map(r=>r[0]));
 event(item,117,'weapon-already-overcharged','The {{item}} is already overcharged!','{{item}}はすでに過充填されている！',[['item',itemName('self')]]);
 event(item,121,'overcharge-needs-full-magazine','You need a full magazine to overcharge the {{item}}!','{{item}}を過充填するには弾倉を満タンにする必要がある！',[['item',itemName('self')]]);
 event(item,124,'overcharge-confirm','Are you sure you want to overcharge the {{item}}? {{warning}}','本当に{{item}}を過充填する？ {{warning}}',[['item',itemName('self')],['warning','msg']]);
 event(item,130,'weapon-overcharged','You overcharge the {{item}}!','{{item}}を過充填した！',[['item',itemName('self')]]);
 const perks='bin/data/drl/perks.lua';
 for(const [en,ja,suffix]of [['This will overload the nuclear reactor...','核反応炉が過負荷になる……','overcharge-reactor-warning'],['This will destroy the weapon after the next shot...','次の一発を撃つと、この武器は壊れる……','overcharge-destroy-warning']]){
  const id='message.'+suffix;catalog(id,en,ja);exact(perks,`self:can_overcharge(${q(en)})`,`self:can_overcharge(${request(id,en)})`,id);
 }
 event(level,473,'feature-push-blocked',"Something's blocking the {{item}}.",'{{item}}を何かが塞いでいる。',[['item',`ui.registry_text("item", item_id, "base_game", "name", name)`]]);
 event(level,478,'feature-pushed','You push the {{item}}.','{{item}}を押した。',[['item',`ui.registry_text("item", item_id, "base_game", "name", name)`]]);
 event('bin/data/core/main.lua',391,'first-pickup-quote','"{{quote}}"','「{{quote}}」',[['quote','ui.registry_text("item", ip.id, "base_game", "firstmsg", ip.firstmsg)']]);
 const lever='message.lever-description';catalog(lever,'lever ({{description}})','レバー（{{description}}）',{description:'string'});
 catalog('message.lever-name','lever','レバー');
 exact(item,'if sense > 1 then return "lever ("..full..")" end',`if sense > 1 then return ${request(lever,'lever ({{description}})',[['description','ui.registry_text("item", self.id, "base_game", "desc", full)']])} end`,lever);
 exact(item,'return "lever ("..good..")"',`return ${request(lever,'lever ({{description}})',[['description','ui.registry_text("item", self.id, "base_game", "good", good)']])}`,lever);
 exact(item,'return "lever"',`return ${request('message.lever-name','lever')}`,'message.lever-name');
 return reviewed;
}
