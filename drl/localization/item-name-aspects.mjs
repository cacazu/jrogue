/** Structured, presentation-only DRL item-name transitions, GPL-2.0.
 * Original source: tag 0_10_11a, a6f965072b3a25b768c91dbced00367f1b57d865.
 * This authoring module never executes Lua or mutates upstream/domain item names.
 * Runtime adapters own UID-keyed records, validation, replay and persistence.
 */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {scanMessageCalls} from './message-inventory.mjs';
import {render,tokens as templateTokens} from './render.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const digest=b=>createHash('sha256').update(b).digest('hex');
const quote=JSON.stringify;
export const itemNameAspectSourceCommit='a6f965072b3a25b768c91dbced00367f1b57d865';
export const itemNameAspectSourceLocks=Object.freeze({
 'bin/data/drl/assemblies.lua':{bytes:22876,sha256:'666d1f40f8dc87def3752f0de737d8a6b55424738ed3ba9c429f00bacdc367ad'},
 'bin/data/core/item.lua':{bytes:6066,sha256:'4da4eec22528f1efb1c1fe214c4d7ddc0658e9dc5728b0416c0a8ee778a4d2e5'},
 'bin/data/drl/items/uitems.lua':{bytes:30475,sha256:'c8d7f3526fd7bca122007c0507246df7ba27d78efbb3d2554b6b5941a1b6f2fc'},
 'bin/data/drl/levels/armory.lua':{bytes:6536,sha256:'11773662a130ef0afa39553e00887656b269d8d4c65632c8bb68da11a6e67f0e'},
 'bin/data/drl/levels/centralprocessing.lua':{bytes:14586,sha256:'5686a37c281cd4a6e87a47391f5fba16e18b3fcf2306150598361bb4d11bc1fb'},
 'bin/data/drl/levels/deimoslab.lua':{bytes:7069,sha256:'2e0200a7c54747c49e949b4018a3bb4375a3a9fb63c55066bf8418fe0410dd3e'},
 'bin/data/drl/levels/house.lua':{bytes:6850,sha256:'ff1924092d1c0902cab479714d7e0097f5d0274ddc0a5e08082af614b34165db'},
 'bin/data/drl/levels/toxinrefinery.lua':{bytes:11062,sha256:'a967c16302c3db6745eef9ebad3b76285bf4e093cc7d5f47170d087181941364'},
 'bin/data/drl/levels/vaults.lua':{bytes:6702,sha256:'e383e6e1ae7b11622c5ee1ac380032ba2d3854e4e726967f9aeb43ed507246ee'},
});
const assemblies='bin/data/drl/assemblies.lua',coreItem='bin/data/core/item.lua',uniqueItems='bin/data/drl/items/uitems.lua';
const row=(line,assemblyRegistryId,kind,english,japanese,variant='')=>({line,assemblyRegistryId,kind,english,japanese,variant});
/** Complete reviewed list: 42 assemblies, 44 actual assignment statements. */
export const reviewedAssemblyNameProducers=Object.freeze([
 row(12,'chainsword','fixed','chainsword','チェーンソード'),
 row(26,'pblade','prefix','piercing ','貫通型の{{name}}'),
 row(41,'speedloader','fixed','speedloader pistol','スピードローダーピストル'),
 row(55,'elephant','fixed','elephant gun','エレファントガン'),
 row(69,'gatling','fixed','gatling gun','ガトリングガン'),
 row(84,'micro','fixed','micro launcher','小型ランチャー'),
 row(101,'tarmor','fixed','tactical armor','戦術アーマー'),
 row(126,'tboots','fixed','tactical boots','戦術ブーツ'),
 row(150,'nanofiber','prefix','nanofiber ','ナノファイバー製の{{name}}'),
 row(176,'high','prefix','high power ','高威力の{{name}}'),
 row(198,'power','prefix','powered ','動力強化型の{{name}}'),
 row(236,'tshotgun','fixed','tactical shotgun','戦術ショットガン'),
 row(255,'plate','fixed','tower shield','タワーシールド'),
 row(276,'fparmor','prefix','fireproof ','耐火仕様の{{name}}'),
 row(294,'fpboots','prefix','fireproof ','耐火仕様の{{name}}'),
 row(310,'balarmor','prefix','ballistic ','耐弾仕様の{{name}}'),
 row(334,'plasmatic','prefix','plasmatic ','プラズマ化した{{name}}'),
 row(347,'gboots','prefix','grappling ','グラップリング仕様の{{name}}'),
 row(361,'grarmor','prefix','grappling ','グラップリング仕様の{{name}}'),
 row(378,'lavboots','prefix','lava ','溶岩耐性の{{name}}'),
 row(397,'double','fixed','double chainsaw','ダブルチェーンソー'),
 row(412,'tacticalrl','fixed','tactical rocket launcher','戦術ロケットランチャー'),
 row(431,'storm','prefix','storm ','ストーム仕様の{{name}}'),
 row(455,'rifle','prefix','assault ','アサルト仕様の{{name}}'),
 row(477,'energy','prefix','energy ','エネルギー式の{{name}}'),
 row(499,'assault','prefix','burst ','バースト射撃式の{{name}}'),
 row(522,'vbfg9000','fixed','nuclear VBFG9000','核 VBFG9000','nuclear'),
 row(524,'vbfg9000','fixed','VBFG9000','VBFG9000','regular'),
 row(543,'envboots','prefix','environmental ','環境防護仕様の{{name}}'),
 row(565,'fireshield','fixed','fire shield','ファイアシールド'),
 row(586,'nanoskin','prefix','nanoskin ','ナノスキン仕様の{{name}}'),
 row(618,'gravity','prefix','antigrav ','反重力仕様の{{name}}'),
 row(632,'hyperblaster','fixed','hyperblaster','ハイパーブラスター'),
 row(650,'fdshotgun','fixed','focused double shotgun','集束ダブルショットガン'),
 row(675,'nanomanufacture','prefix','nanomachic ','ナノ製造式の{{name}}'),
 row(697,'nsharpnel','prefix','nano ','ナノ仕様の{{name}}'),
 row(719,'demolition','prefix','demolition ','爆破解体用の{{name}}'),
 row(741,'cybernano','prefix','cybernano ','サイバーナノ仕様の{{name}}'),
 row(764,'biggest','fixed','biggest fucking nuclear gun','クソでかい核銃','nuclear'),
 row(766,'biggest','fixed','biggest fucking gun','クソでかい銃','regular'),
 row(785,'ripper','fixed','ripper','リッパー'),
 row(801,'cerboots','prefix','cerberus ','ケルベロス仕様の{{name}}'),
 row(820,'cerarmor','prefix','cerberus ','ケルベロス仕様の{{name}}'),
 row(840,'mother','fixed','Mother-In-Law','マザー・イン・ロー'),
].map(Object.freeze));
const schematicRows=[
 ['armory',168,'schematic_1'],['centralprocessing',271,'schematic_0'],['deimoslab',169,'schematic_1'],
 ['house',124,'schematic_2'],['toxinrefinery',190,'schematic_0'],['vaults',133,'schematic_2'],
];
const semanticId=r=>'item.name.assembly.'+r.assemblyRegistryId.replaceAll('_','-')+(r.variant?'.'+r.variant:'');
export const reviewedItemNameAspectTerms=Object.freeze([
 ...reviewedAssemblyNameProducers.map(r=>Object.freeze({id:semanticId(r),english:r.kind==='prefix'?r.english+'{{name}}':r.english,japanese:r.japanese,parameters:r.kind==='prefix'?{name:'string'}:{}})),
 Object.freeze({id:'item.name.overcharged',english:'overcharged {{name}}',japanese:'過充填した{{name}}',parameters:{name:'string'}}),
 Object.freeze({id:'item.name.schematic',english:'{{assembly}} schematics',japanese:'{{assembly}}の設計図',parameters:{assembly:'string'}}),
]);
const terms=Object.fromEntries(reviewedItemNameAspectTerms.map(t=>[t.id,t]));
/** The native adapter must treat rejected custom transitions as a harmless false result.
 * It must never add properties or invoke simulation hooks while remembering or replaying.
 */
export const itemNameAspectApiContract=Object.freeze({
 luaFunction:'ui.remember_item_name_aspect',arity:4,
 arguments:['item','aspectID','beforeEnglish','afterEnglish'],returnValue:'boolean; caller ignores it',
 itemIdentity:'Runtime adapter reads the original item UID as canonical QWord decimal text and original prototype ID; neither is localized or modified.',
 exactGuards:'A whitelisted eventID, original prototype base guard and the complete beforeEnglish -> afterEnglish transition must match. Custom or stale values fall back to current original English.',
 prefixReplay:'Derive {{name}} from the existing validated chain, or an exact original prototype-name registry guard. Never translate by parsing a rendered name.',
 fixedReplay:'Render the fixed semantic ID and reset the display base; retain complete original English transition records for later locale changes.',
 schematicReplay:"eventID selects original assemblyRegistryId; validate afterEnglish = assemblyEnglish + ' schematics'; derive {{assembly}} through DRLRegistryText('mod_array', assemblyRegistryId, 'base_game', 'name', assemblyEnglish).",
 persistence:'Separate versioned presentation sidecar; original Pascal item Name/save fields remain English. UID/prototype/base guards and whitelisted steps are mandatory on load.',
 failures:'Unknown/custom event or guard rejection returns false without raising a gameplay error; source callers discard the result.',
});
function sourceData(sourceRoot,sourceOverrides={}){
 const data={};for(const[file,lock]of Object.entries(itemNameAspectSourceLocks)){
  const bytes=Object.hasOwn(sourceOverrides,file)?Buffer.from(sourceOverrides[file],'utf8'):readFileSync(path.join(sourceRoot,file));
  if(bytes.length!==lock.bytes||digest(bytes)!==lock.sha256)throw Error(`Item name aspect source provenance mismatch: ${file}`);
  const source=bytes.toString('utf8'),scanned=scanSource(source,'lua');
  if(scanned.diagnostics.length||!Buffer.from(source,'utf8').equals(bytes))throw Error(`Item name aspect source is not lossless lexical UTF-8: ${file}`);
  data[file]={source,tokens:scanned.tokens,lines:source.split('\n')};
 }return data;
}
function exactLine(data,file,line){
 const source=data[file].source,raw=data[file].lines[line-1];if(raw===undefined)throw Error(`Missing item name aspect line: ${file}:${line}`);
 const start=data[file].lines.slice(0,line-1).join('\n').length+(line>1?1:0),original=raw.replace(/\r$/,'');
 return{file,line,start,end:start+original.length,original,sourceSha256:itemNameAspectSourceLocks[file].sha256};
}
function assemblyRegistrations(data){
 const ts=data[assemblies].tokens,registrations=[];
 for(let i=0;i<ts.length;i++)if(ts[i].raw==='register_mod_array'){
  const id=ts[i+1],open=ts[i+2];if(id?.kind!=='string'||open?.raw!=='{')throw Error('Original assembly registration syntax changed');
  let depth=0,end=-1;for(let j=i+2;j<ts.length;j++){if(ts[j].raw==='{')depth++;if(ts[j].raw==='}'&&!--depth){end=j;break;}}
  if(end<0)throw Error('Unclosed original assembly registration');
  const top=ts.slice(i+3,end),nameAt=top.findIndex(t=>t.raw==='name');
  if(nameAt<0||top[nameAt+1]?.raw!=='='||top[nameAt+2]?.kind!=='string')throw Error(`Missing original assembly name: ${id.value}`);
  registrations.push({registryId:id.value,english:top[nameAt+2].value,start:ts[i].start,end:ts[end].end,nameSource:{file:assemblies,line:top[nameAt+2].line,offset:top[nameAt+2].start,endOffset:top[nameAt+2].end,raw:top[nameAt+2].raw}});
 }if(registrations.length!==42||new Set(registrations.map(r=>r.registryId)).size!==42)throw Error('Original assembly registration coverage changed');return registrations;
}
function assignmentTokens(data,record,receiver){
 const ts=data[record.file].tokens.filter(t=>t.start>=record.start&&t.end<=record.end);
 if(ts[0]?.raw!==receiver||ts[1]?.raw!=='.'||ts[2]?.raw!=='name'||ts[3]?.raw!=='=')throw Error(`Original item Name assignment changed: ${record.file}:${record.line}`);
 return ts.slice(4);
}
function assignmentInventory(data,file,receiver){
 const ts=data[file].tokens,assignments=[];
 for(let i=0;i<ts.length-3;i++)if(ts[i].raw===receiver&&ts[i+1].raw==='.'&&ts[i+2].raw==='name'&&ts[i+3].raw==='=')assignments.push({offset:ts[i].start,line:ts[i].line});
 return assignments;
}
function producerPatch(data,r,receiver,eventIdExpression){
 const indentation=r.original.match(/^\s*/)[0],capture='drl_name_before_'+r.eventID.replaceAll(/[^a-z0-9]/g,'_');
 if(data[r.file].tokens.some(t=>t.raw===capture))throw Error(`Item aspect capture name collides: ${capture}`);
 const newline=data[r.file].source.includes('\r\n')?'\r\n':'\n';
 return {...r,kind:'semantic-item-name-aspect',captureVariable:capture,id:r.semanticID??'item.name.schematic',replacement:
  `${indentation}local ${capture} = ${receiver}.name${newline}${r.original}${newline}${indentation}ui.remember_item_name_aspect(${receiver}, ${eventIdExpression}, ${capture}, ${receiver}.name)`,
  originalAssignmentPreserved:true,beforeEnglish:{expression:`${receiver}.name`,captureVariable:capture,kind:'original-English-current-Name'},afterEnglish:{expression:`${receiver}.name`,evaluation:'after original assignment',template:r.englishTemplate??'{{assembly}} schematics'},
 };
}
/** Mode inventory is intentionally separate: this baseline never renames unique weapons. */
function modeInventory(data,messageSites=[]){
 const source=data[uniqueItems].source,ts=data[uniqueItems].tokens,calls=scanMessageCalls(source,'lua',uniqueItems);
 const messageAt=line=>{const c=calls.find(c=>c.line===line);return c?{line,callKey:c.key,semanticId:messageSites.find(r=>r.key===c.key)?.id??null,original:c.original}:null;};
 const morphStart=source.indexOf('local morph ='),morphEnd=source.indexOf('local final = morph[ damage ] or morph[ DAMAGE_BULLET ]',morphStart);
 if(morphStart<0||morphEnd<morphStart)throw Error('Mega Buster morph producer changed');
 const morphTokens=ts.filter(t=>t.start>=morphStart&&t.end<morphEnd);
 if(morphTokens.some(t=>t.raw==='name'))throw Error('Mega Buster morph now changes Name; explicit name event review required');
 const rows=[
  {registryId:'umega',sourcePerk:'perk_umega_kill',kind:'damage-type-morph',selector:'morph[damage] or morph[DAMAGE_BULLET]',alternatives:['DAMAGE_BULLET','DAMAGE_FIRE','DAMAGE_ACID','DAMAGE_PLASMA'],default:'DAMAGE_BULLET',guard:'local final = morph[ damage ] or morph[ DAMAGE_BULLET ]',message:messageAt(425)},
  {registryId:'uberetta',sourcePerk:'perk_uberetta_altreload',kind:'accuracy-fire-mode',selector:'self.acc',alternatives:[{before:5,after:3,mode:'burst',message:messageAt(487)},{before:3,after:1,mode:'full-auto',message:messageAt(493)},{before:1,after:5,mode:'single',message:messageAt(499)}],guard:'if self.acc == 5 then'},
  {registryId:'usjack',sourcePerk:'perk_usjack_altreload',kind:'shot-count-trigger-mode',selector:'self.shots',alternatives:[{before:3,after:1,mode:'single',message:messageAt(561)},{before:1,after:3,mode:'burst',message:messageAt(564)}],guard:'if self.shots == 3 then'},
 ];
 for(const r of rows){if(!source.includes(r.guard))throw Error(`Unique weapon mode selector changed: ${r.registryId}`);r.source={file:uniqueItems,sha256:itemNameAspectSourceLocks[uniqueItems].sha256,originalGuard:r.guard};r.nameRenamed=false;r.namePresentation={category:'item',registryId:r.registryId,scope:'base_game',field:'name',semanticId:`term.item.${r.registryId}.name`};}
 if(assignmentInventory(data,uniqueItems,'self').length)throw Error('Original unique weapon Name assignment coverage changed');
 return rows;
}
/** Build the executable whitelist and exact source insertion proposals. */
export function buildItemNameAspects(sourceRoot=path.resolve(here,'../upstream/drl'),{manifest={patches:[]},sourceOverrides={},messageSites=[]}={}){
 const data=sourceData(sourceRoot,sourceOverrides),registrations=assemblyRegistrations(data),rules=[],producerRecords=[],alreadyPatched=[];
 const add=r=>{const overlap=(manifest.patches??[]).filter(p=>p.file===r.file&&p.start<r.end&&p.end>r.start);if(overlap.length){alreadyPatched.push({...r,existingPatches:overlap.map(p=>p.id??p.kind)});return;}producerRecords.push(r);};
 for(const row of reviewedAssemblyNameProducers){
  const source=exactLine(data,assemblies,row.line),registration=registrations.find(r=>r.start<=source.start&&r.end>=source.end);
  if(!registration||registration.registryId!==row.assemblyRegistryId)throw Error(`Assembly name producer registry ID changed: ${row.line}`);
  const rhs=assignmentTokens(data,source,'item'),expected=row.kind==='fixed'?[row.english]:[row.english,'..','item','.','name'];
  if(rhs.length!==expected.length||rhs.some((t,i)=>(t.kind==='string'?t.value:t.raw)!==expected[i]))throw Error(`Assembly original English rename expression changed: ${row.line}`);
  const semanticID=semanticId(row),eventID='item.name.aspect.assembly.'+row.assemblyRegistryId+(row.variant?'.'+row.variant:''),t=terms[semanticID];
  const rule={eventID,semanticID,kind:row.kind,englishTemplate:t.english,EnglishTemplate:t.english,parameters:t.parameters,scope:'base_game',assemblyRegistryId:row.assemblyRegistryId,assemblyEnglish:registration.english,source:{file:assemblies,line:row.line,offset:source.start,endOffset:source.end,raw:source.original,sha256:itemNameAspectSourceLocks[assemblies].sha256},...(row.kind==='fixed'?{fixedEnglish:row.english}:{prefix:row.english})};
  if(row.variant){rule.branch={kind:'original-English-name-comparison',guard:'if item.name == "nuclear BFG 9000" then',outcome:row.variant};const before=data[assemblies].lines.slice(row.line-3,row.line).join('\n');if(!before.includes(row.variant==='nuclear'?rule.branch.guard:'else'))throw Error(`Assembly nuclear/non-nuclear branch guard changed: ${row.line}`);}
  rules.push(rule);add(producerPatch(data,{...source,...rule},'item',quote(eventID)));
 }
 const assemblyAssignments=assignmentInventory(data,assemblies,'item');
 if(assemblyAssignments.length!==44||assemblyAssignments.some(a=>!reviewedAssemblyNameProducers.some(r=>r.line===a.line)))throw Error('Assembly Name assignment inventory is not fully reviewed');
 const overchargeSource=exactLine(data,coreItem,131),rhs=assignmentTokens(data,overchargeSource,'self');
 if(rhs.length!==5||rhs[0]?.value!=='overcharged '||rhs.slice(1).map(t=>t.raw).join('')!=='..self.name'||assignmentInventory(data,coreItem,'self').length!==1)throw Error('Original overcharge Name producer changed');
 const overchargeRule={eventID:'item.name.aspect.overcharge',semanticID:'item.name.overcharged',kind:'prefix',prefix:'overcharged ',englishTemplate:terms['item.name.overcharged'].english,EnglishTemplate:terms['item.name.overcharged'].english,parameters:{name:'string'},scope:'base_game',source:{file:coreItem,line:131,offset:overchargeSource.start,endOffset:overchargeSource.end,raw:overchargeSource.original,sha256:itemNameAspectSourceLocks[coreItem].sha256}};
 rules.push(overchargeRule);add(producerPatch(data,{...overchargeSource,...overchargeRule},'self',quote(overchargeRule.eventID)));
 for(const [site,line,prototypeId]of schematicRows){
  const file='bin/data/drl/levels/'+site+'.lua',source=exactLine(data,file,line),rhs=assignmentTokens(data,source,'item');
  if(rhs.length!==5||rhs.slice(0,4).map(t=>t.raw).join('')!=='ma.name..'||rhs[4]?.value!==' schematics'||assignmentInventory(data,file,'item').length!==1)throw Error(`Original schematic Name producer changed: ${site}`);
  const context=data[file].lines.slice(line-5,line).join('\n');
  if(!context.includes(`level:drop_item("${prototypeId}"`)||!context.includes('local ma   = mod_arrays[id]')||!context.includes('item.ammo  = ma.nid'))throw Error(`Original schematic assembly/item identity context changed: ${site}`);
  const eventPrefix='item.name.aspect.schematic.'+site+'.';
  for(const assembly of registrations)rules.push({eventID:eventPrefix+assembly.registryId,semanticID:'item.name.schematic',kind:'schematic',englishTemplate:'{{assembly}} schematics',EnglishTemplate:'{{assembly}} schematics',parameters:{assembly:'string'},scope:'base_game',requiredPrototypeId:prototypeId,assemblyRegistryId:assembly.registryId,assemblyEnglish:assembly.english,fixedEnglish:assembly.english+' schematics',source:{file,line,offset:source.start,endOffset:source.end,raw:source.original,sha256:itemNameAspectSourceLocks[file].sha256},registrySource:assembly.nameSource});
  add(producerPatch(data,{...source,eventID:eventPrefix+'<assembly-id>',semanticID:'item.name.schematic',englishTemplate:'{{assembly}} schematics',selectedRegistry:{category:'mod_array',expression:'ma.id',sourceExpression:'mod_arrays[id]',prototypeId},eventPrefix},'item',quote(eventPrefix)+'..ma.id'));
 }
 const ordered=producerRecords.toSorted((a,b)=>a.file.localeCompare(b.file)||a.start-b.start);
 for(let i=1;i<ordered.length;i++)if(ordered[i].file===ordered[i-1].file&&ordered[i].start<ordered[i-1].end)throw Error('Overlapping item name aspect proposals');
 if(new Set(rules.map(r=>r.eventID)).size!==rules.length)throw Error('Duplicate item name aspect event ID');
 const uniqueWeaponModes=modeInventory(data,messageSites);
 return{schema:1,sourceCommit:itemNameAspectSourceCommit,sourceLocks:itemNameAspectSourceLocks,api:itemNameAspectApiContract,terms:reviewedItemNameAspectTerms,rules,producerRecords,alreadyPatched,assemblyRegistrations:registrations,uniqueWeaponModes,originalNameAssignments:51,originalNameAssignmentsReviewed:51,originalUniqueWeaponNameRenames:0,originalDomainModified:false,nativeOrBrowserExecuted:false};
}
/** The source overlay authoring entrypoint; it does not register the runtime API. */
export function curateItemNameAspectSites({file,catalog,patches,messageSites=[]}){
 const result=buildItemNameAspects(undefined,{manifest:{patches},sourceOverrides:Object.fromEntries(Object.keys(itemNameAspectSourceLocks).map(f=>[f,file(f)])),messageSites});
 for(const t of result.terms)catalog(t.id,t.english,t.japanese,t.parameters);
 for(const r of result.producerRecords)patches.push({file:r.file,start:r.start,end:r.end,original:r.original,replacement:r.replacement,id:r.id,kind:r.kind});
 return result;
}
/** English transitions and opaque parameters are validated without Lua/native execution. */
export function verifyItemNameAspects(sourceRoot,options={}){
 const result=buildItemNameAspects(sourceRoot,options),en=Object.fromEntries(result.terms.map(t=>[t.id,t.english])),ja=Object.fromEntries(result.terms.map(t=>[t.id,t.japanese])),contracts=Object.fromEntries(result.terms.map(t=>[t.id,t.parameters]));
 let transitionCases=0,parameterCases=0;
 for(const t of result.terms){const params=s=>Array.from(new Set(templateTokens(s).filter(t=>t.parameter).map(t=>t.parameter))).sort();if(JSON.stringify(params(t.english))!==JSON.stringify(params(t.japanese))||JSON.stringify(params(t.english))!==JSON.stringify(Object.keys(t.parameters).sort()))throw Error(`Item name aspect placeholder contract changed: ${t.id}`);}
 for(const r of result.rules){
  const inputs=r.kind==='prefix'?['pistol','nuclear BFG 9000','名前%{{opaque}}😀','overcharged plasma rifle']:['original item name'];
  for(const before of inputs){
   const params=r.kind==='prefix'?{name:before}:r.kind==='schematic'?{assembly:r.assemblyEnglish}:{},expected=r.kind==='prefix'?r.prefix+before:r.fixedEnglish;
   if(render(en,contracts,r.semanticID,params)!==expected)throw Error(`Item aspect original English reconstruction changed: ${r.eventID}`);
   const localized=render(ja,contracts,r.semanticID,params);
   if(r.kind==='prefix'&&!localized.includes(before))throw Error(`Item aspect base name parameter was rewritten: ${r.eventID}`);
   if(r.kind==='schematic'&&!localized.includes(r.assemblyEnglish))throw Error(`Schematic assembly parameter was rewritten: ${r.eventID}`);
   transitionCases++;
  }
 }
 for(const t of result.terms)if(Object.keys(t.parameters).length){const key=Object.keys(t.parameters)[0],value='外部名%{{unresolved}} {x}😀';for(const catalog of [en,ja]){if(!render(catalog,contracts,t.id,{[key]:value}).includes(value))throw Error('Item aspect parameter changed');parameterCases++;}}
 // Pure English reference chaining: a prefix can follow a fixed assembly, without re-parsing it.
 const fixed=result.rules.find(r=>r.eventID==='item.name.aspect.assembly.vbfg9000.nuclear'),overcharge=result.rules.find(r=>r.eventID==='item.name.aspect.overcharge');
 const fixedName=render(en,contracts,fixed.semanticID,{}),chained=render(en,contracts,overcharge.semanticID,{name:fixedName});
 if(chained!=='overcharged nuclear VBFG9000')throw Error('Assembly -> overcharge English chain changed');
 const producers=[...result.producerRecords,...result.alreadyPatched];
 for(const r of producers){if(!r.replacement.includes(r.original)||/\b(?:math\.random|random_pick|CallHook|call_hook|add_property|remove_property)\s*\(/.test(r.replacement))throw Error(`Item aspect changed a simulation producer: ${r.eventID}`);const scanned=scanSource(r.replacement,'lua');if(scanned.diagnostics.length)throw Error('Generated item aspect producer has a lexical error');}
 return{assemblyRegistrations:42,assemblyRenameStatements:44,overchargeRenameStatements:1,schematicRenameStatements:6,originalNameAssignmentsReviewed:51,proposedProducerPatches:result.producerRecords.length,alreadyPatched:result.alreadyPatched.length,whitelistRules:result.rules.length,semanticIds:result.terms.length,prefixRules:result.rules.filter(r=>r.kind==='prefix').length,fixedRules:result.rules.filter(r=>r.kind==='fixed').length,schematicRules:result.rules.filter(r=>r.kind==='schematic').length,transitionCases,opaqueParameterCases:parameterCases,uniqueWeaponModeGroups:result.uniqueWeaponModes.length,uniqueWeaponNameRenames:0,sourceFiles:Object.keys(result.sourceLocks).length,originalDomainModified:false,nativeOrBrowserExecuted:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyItemNameAspects()));
