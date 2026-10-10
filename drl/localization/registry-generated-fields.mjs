/** Reviewed original generated corpse/natural-attack metadata, never domain mutation. */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {scanSource} from '../port/tools/inventory-texts.mjs';
function closeTable(ts,start){let d=0;for(let n=start;n<ts.length;n++){if(ts[n].raw==='{')d++;if(ts[n].raw==='}'&&!--d)return n;}throw Error('Generated registry table is incomplete');}
export function appendGeneratedRegistryFields(sourceRoot,metadata,en,ja,sourceFiles,sourceLock,parseFields){
 const producerFile='bin/data/core/main.lua',producer=readFileSync(path.join(sourceRoot,producerFile),'utf8');
 const locate=raw=>{const start=producer.indexOf(raw);if(start<0||producer.indexOf(raw,start+1)>=0)throw Error(`Generated registry producer guard: ${raw}`);return{file:producerFile,offset:start,endOffset:start+raw.length,raw};};
 const corpseProducer=locate('name = being_proto.name.." corpse";'),naturalProducer=locate('ip.name     = ip.name or "ranged attack"');
 const sources=new Map,generated=[];
 for(const being of metadata.filter(r=>r.category==='being'&&r.fields.name)){
  const file=being.fields.name.source.file;
  if(!sources.has(file))sources.set(file,scanSource(readFileSync(path.join(sourceRoot,file),'utf8'),'lua').tokens);
  const ts=sources.get(file),at=ts.findIndex((t,n)=>t.raw==='register_being'&&ts[n+1]?.kind==='string'&&ts[n+1].value===being.registryId&&ts[n+2]?.raw==='{');
  if(at<0)throw Error(`Generated being producer registration missing: ${being.registryId}`);
  const end=closeTable(ts,at+2),parsed=parseFields(ts,at+2,end),top=field=>{
   const t=parsed.fields[field]??ts.find(t=>t.start===parsed.pending.find(p=>p.field===field)?.offset);
   if(!t)return null;const index=ts.indexOf(t);return parsed.fields[field]?{literal:t}:{key:t,value:ts[index+2],valueIndex:index+2};
  };
  const corpse=top('corpse');
  if(corpse&&!corpse.literal&&(['true','{'].includes(corpse.value.raw)||corpse.value.kind==='number')){
   const id=`term.cell.${being.registryId.replaceAll('_','-')}corpse.name`,english=being.fields.name.english+' corpse',japanese=ja[being.fields.name.semanticId]+'の死体';
   en[id]=english;ja[id]=japanese;
   generated.push({category:'cell',registryId:being.registryId+'corpse',scope:being.scope,fields:{name:{semanticId:id,english,identity:false,source:{...being.fields.name.source},derivation:{kind:'guarded-generated-corpse-name',sourceEnglish:being.fields.name.english,sourceSemanticId:being.fields.name.semanticId,producer:corpseProducer,registrationField:{file,offset:corpse.key.start,raw:corpse.key.raw,valueRaw:corpse.value.raw}}}}});
  }
  const weapon=top('weapon');
  if(weapon&&!weapon.literal&&weapon.value.raw==='{'){
   const fields=parseFields(ts,weapon.valueIndex,closeTable(ts,weapon.valueIndex));
   if(fields.pending.some(p=>['name','hitdesc'].includes(p.field)))throw Error(`Nonliteral generated natural-attack presentation field: ${being.registryId}`);
   if(fields.fields.name)throw Error(`Unreviewed explicit natural-attack name: ${being.registryId}`);
   const id=`term.item.nat-${being.registryId.replaceAll('_','-')}.name`,english='ranged attack';en[id]=english;ja[id]='遠距離攻撃';
   const natural={category:'item',registryId:'nat_'+being.registryId,scope:being.scope,fields:{name:{semanticId:id,english,identity:false,source:{...being.fields.name.source},derivation:{kind:'guarded-generated-default-natural-attack-name',sourceEnglish:being.fields.name.english,sourceSemanticId:being.fields.name.semanticId,producer:naturalProducer,registrationField:{file,offset:weapon.key.start,raw:weapon.key.raw,valueRaw:'{'}}}}};
   if(fields.fields.hitdesc){const token=fields.fields.hitdesc;if(token.value!=='You are engulfed in flames!')throw Error(`Unreviewed natural attack hit description: ${being.registryId}`);
    const hitId=`term.item.nat-${being.registryId.replaceAll('_','-')}.hitdesc`;en[hitId]=token.value;ja[hitId]='炎に包まれた！';natural.fields.hitdesc={semanticId:hitId,english:token.value,identity:false,source:{file,line:token.line,offset:token.start,endOffset:token.end,raw:token.raw}};
   }
   generated.push(natural);
  }
 }
 const corpseNames=generated.filter(r=>r.category==='cell').length,naturalAttackNames=generated.filter(r=>r.category==='item').length;
 if(corpseNames!==23||naturalAttackNames!==21)throw Error(`Pinned original generated registry coverage changed: ${corpseNames} corpse names, ${naturalAttackNames} natural attacks`);
 sourceFiles[producerFile]={...sourceLock.sources[producerFile]};metadata.push(...generated);
 return{corpseNames:23,naturalAttackNames:21,naturalHitDescriptions:3,domainFieldsMutated:false,customGeneratedNamesCovered:false};
}
