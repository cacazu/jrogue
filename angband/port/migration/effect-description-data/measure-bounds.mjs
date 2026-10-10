// SPDX-License-Identifier: GPL-2.0-only
// Independent static corpus upper bounds; never executes game code or RNG.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const load=f=>JSON.parse(fs.readFileSync(path.join(here,f),'utf8'));
const manifest=load('source-manifest.json'),schema=load('schema.json').entries,bindings=load('source-bindings.json');
const prefix='angband.effect_info.',corpus=[];
for(const file of fs.readdirSync(path.join(root,'data/gamedata')).filter(f=>f.endsWith('.txt'))){
 const raw=fs.readFileSync(path.join(root,'data/gamedata',file),'utf8');let count=0,label='',max=0,record='';
 for(const line of raw.split(/\r?\n/)){if(/^(name|spell):/.test(line)){if(count>max){max=count;record=label;}count=0;label=line;}if(/^effect:/.test(line))count++;}
 if(count>max){max=count;record=label;}if(max)corpus.push({file:'lib/gamedata/'+file,maximum_linked_effects:max,record,sha256:crypto.createHash('sha256').update(raw).digest('hex')});
}
corpus.sort((a,b)=>b.maximum_linked_effects-a.maximum_linked_effects||a.file.localeCompare(b.file));
const maximum=corpus[0].maximum_linked_effects;
const int=value=>({type:'integer',value}),ref=(id,params={})=>({kind:'ref',id,params});
const graph=parts=>({schema_version:1,parts}),bound=(n,parts)=>({kind:'bounded',native_max_bytes:n,parts});
const descriptor=parts=>({type:'EffectDescription',value:graph(parts)}),lexical=id=>({type:'localized_text',value:{id}});
const integer=-2147483648,gram=name=>prefix+'grammar.'+name;
function wireDepth(value){if(!value||typeof value!=='object')return 0;return 1+Math.max(0,...Object.values(value).map(wireDepth));}
const dice=descriptor([bound(20,[ref(gram('dice.multiplied_base'),{base:int(integer),multiplier:int(integer),dice:int(integer),sides:int(integer)})])]);
function renderNode(node,dictionary,locale){if(node.kind==='bounded'){const text=node.parts.map(n=>renderNode(n,dictionary,locale)).join('');return locale==='en'?Buffer.from(text).subarray(0,node.native_max_bytes-1).toString('ascii'):text;}return renderReference(node.id,node.params,dictionary,locale);}
function renderReference(id,params,dictionary,locale){const template=dictionary[id];if(template===undefined)throw Error('Missing '+id);const values={};for(const [name,p]of Object.entries(params)){values[name]=p.type==='integer'?String(p.value):p.type==='localized_text'?renderReference(p.value.id,p.value.params??{},dictionary,locale):p.value.parts.map(n=>renderNode(n,dictionary,locale)).join('');}return template.replace(/\{([a-z_]+)\}/g,(_,name)=>{if(!(name in values))throw Error('Undeclared '+name);return values[name];});}
const measure=[];
for(const locale of ['en','ja']){
 const dictionary=load(locale+'.json'),longest=ids=>ids.filter(Boolean).reduce((best,id)=>Buffer.byteLength(dictionary[id])>Buffer.byteLength(dictionary[best])?id:best,ids.find(Boolean));
 const projectionPlayer=longest(bindings.projections.map(r=>r.player_id));
 const projectionDesc=longest(bindings.projections.map(r=>r.description_id));
 const projectionLash=longest(bindings.projections.map(r=>r.lash_id));
 const condition=longest(bindings.timed.map(r=>r.id)),stat=longest(bindings.stats.map(r=>r.id)),summon=longest(bindings.summons.map(r=>r.id));
 let maxLeaf=0,largest='',maxGraphWire=0,maxIndependentWire=0,maxWireDepth=0;
 const fixtures=[];
 for(const record of manifest.records.filter(r=>r.description_id)){
  const params={};for(const {name,type}of schema[record.description_id].parameters){
   if(type==='integer')params[name]=int(integer);
   else if(['dice','duration','turns','percent'].includes(name))params[name]=dice;
   else if(name==='minimum')params[name]=descriptor([bound(50,[ref(gram('healing.minimum'),{percent:int(integer)})])]);
   else if(name==='distance')params[name]=descriptor([bound(32,[ref(gram('teleport.grids'),{distance:int(integer)})])]);
   else if(name==='projection'&&type==='EffectDescription'){
    const alternatives=[];for(let n=0;n<maximum;n++){if(n)alternatives.push(ref(gram(n===maximum-1?'join.oxford_or':'join.comma')));alternatives.push(ref(projectionPlayer));}params[name]=descriptor([bound(120,alternatives)]);
   }else params[name]=lexical(name==='condition'?condition:name==='stat'?stat:name==='target'?summon:name==='subject'?gram('teleport.monster'):name==='food_action'?gram('food.use'):name==='projection'?(record.flag==='LASH'?projectionLash:['BALL','SPOT','SHORT'].includes(record.flag)?projectionPlayer:projectionDesc):gram('empty'));
  }
  let parts=[ref(record.description_id,params)];
  if(['BALL','SPOT','BREATH','BOLTD'].includes(record.flag))parts.push(ref(gram('damage.boost'),{percent:int(integer)}),ref(gram('damage.average'),{whole:int(integer),tenth:int(integer)}));
  const native=record.flag==='BREATH'?200:250,node=bound(native,parts);
  // A condensed breath fixture consumes all fourteen source effects. Use a
  // single-element projection for the independent-leaf chain upper bound.
  const independent=structuredClone(node);if(record.flag==='BREATH')independent.parts[0].params.projection=descriptor([ref(projectionPlayer)]);
  const bytes=Buffer.byteLength(renderNode(independent,dictionary,locale));if(bytes>maxLeaf){maxLeaf=bytes;largest=record.code;}
  maxIndependentWire=Math.max(maxIndependentWire,Buffer.byteLength(JSON.stringify(graph([independent]))));
  maxWireDepth=Math.max(maxWireDepth,wireDepth(graph([node])));
  fixtures.push(node);maxGraphWire=Math.max(maxGraphWire,Buffer.byteLength(JSON.stringify(graph([node]))));
 }
 const maxPrefix=Math.max(...Object.entries(dictionary).filter(([id])=>id.startsWith(gram('prefix.'))).map(([,text])=>Buffer.byteLength(text)));
 const maxJoin=Math.max(...['join.comma','join.and','join.or','join.oxford_or'].map(k=>Buffer.byteLength(dictionary[gram(k)])));
 const wholeUpper=maxPrefix+maximum*maxLeaf+(maximum-1)*maxJoin+Buffer.byteLength(dictionary[gram('statement_end')]);
 const condensedMax=Math.max(...fixtures.map(node=>Buffer.byteLength(renderNode(node,dictionary,locale))));
 measure.push({locale,maximum_independent_leaf_bytes:maxLeaf,largest_recipe:largest,linked_chain_output_upper_bytes:wholeUpper,condensed_recipe_upper_bytes:condensedMax,maximum_single_recipe_capture_bytes:maxGraphWire,maximum_independent_recipe_capture_bytes:maxIndependentWire,measured_maximum_wire_depth:maxWireDepth});
 if(maxIndependentWire>2048||maxWireDepth>18)throw Error('Recipe fixture exceeds declared capture/depth source bound');
 if(wholeUpper>8192||condensedMax>8192)throw Error('Actual source upper bound exceeds reviewed value limit');
}
const result={schema_version:1,upstream_commit:manifest.upstream_commit,method:'Conservative physical linked-effect count per immutable source record; every native dice integer varied to the full i32 width, longest reviewed lexical family selected, eligible damage clauses both included. No game execution, extra dice evaluation, or completed-English classification.',maximum_linked_effects:maximum,maximum_wire_depth:18,maximum_semantic_depth:6,conservative_semantic_nodes_upper:maximum*33+2,conservative_capture_bytes_upper:maximum*2048+1024,output_limits:{parameter_bytes:8192,graph_bytes:32768,capture_bytes:131072,json_depth:32,semantic_nodes:512},locales:measure,corpus};
if(result.conservative_semantic_nodes_upper>512||result.conservative_capture_bytes_upper>131072)throw Error('Static graph bound exceeded');
const content=JSON.stringify(result,null,2)+'\n',dest=path.join(here,'bounds-evidence.json');if(process.argv.includes('--check')){if(fs.readFileSync(dest,'utf8')!==content)throw Error('Stale corpus evidence');}else fs.writeFileSync(dest,content);
console.log(JSON.stringify(result));
