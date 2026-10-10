/** Guarded role review of untouched original DRL literals. GPL-2.0.
 * A partial checkpoint, not a claim that all ambiguous strings are internal or translated.
 * No source/catalog edits, execution of upstream code, or rendered-string replacement.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {scanSource} from '../port/tools/inventory-texts.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const digest=x=>createHash('sha256').update(x).digest('hex');
const key=x=>`${x.file}:${x.offset??x.start}`;
const defaultJson=file=>JSON.parse(readFileSync(path.join(here,file),'utf8'));
const registryNames=new Set(['items','beings','cells','chal','medals','badges','perks','mod_arrays','levels','itemsets','traits','diff','ranks','klasses','ais','requirements','rooms','being_groups','emitters']);
const registeredCalls=new Set(['register_item','register_being','register_cell','register_challenge','register_medal','register_badge','register_perk','register_mod_array','register_level','register_itemset','register_trait','register_difficulty','register_klass','register_ai','register_requirement','register_room','register_rank','register_being_group','register_emitter']);
const evidenceDefinitions={
 luaPath:{file:'upstream/fpcvalkyrie/src/vluasystem.pas',needles:['function Defined( const Path : array of Const )','function ProtectedCall( const Path : array of Const; const Args : array of Const )']},
 tableKey:{file:'upstream/fpcvalkyrie/src/vluatable.pas',needles:['function GetString( const aKey : AnsiString )','function GetString( const aKey : AnsiString; const aDefault : AnsiString )']},
 widget:{file:'upstream/fpcvalkyrie/src/vtig.pas',needles:['procedure VTIG_Begin( aName : Ansistring','procedure VTIG_ResetSelect( aName : AnsiString','procedure VTIG_BeginWindow( aName, aID : Ansistring']},
 registry:{file:'upstream/drl/bin/data/core/main.lua',needles:['register_medal      = core.register_storage( "medals", "medal" )','register_badge      = core.register_storage( "badges", "badge" )','register_perk       = core.register_storage( "perks", "perk"']},
 achievements:{file:'upstream/drl/bin/data/core/player.lua',needles:['function player:add_medal( medal )','function player:add_badge( badge )']},
 schema:{file:'upstream/drl/bin/data/core/blueprints.lua',needles:['core.register_blueprint "requirement"','req    = { true, core.TIDIN("requirements") }']},
 xml:{file:'upstream/drl/src/dfhof.pas',needles:['function THOF.GetCount(aXPathQuery: string','function THOF.GetCounted( const aRootID, aLeafID, aElementID : AnsiString )']},
 binding:{file:'upstream/fpcvalkyrie/src/vluasystem.pas',needles:['LuaL_Reg      = vlualibrary.luaL_Reg;','procedure Register( const libname : AnsiString; const lr : PluaL_Reg )']},
};
function evidenceLocks(workspaceRoot){
 return Object.fromEntries(Object.entries(evidenceDefinitions).map(([name,def])=>{
  const bytes=readFileSync(path.join(workspaceRoot,def.file)),source=bytes.toString('utf8');
  const signatures=def.needles.map(needle=>{const at=source.indexOf(needle);if(at<0)throw Error(`Literal role API evidence missing: ${name} ${needle}`);const end=source.indexOf('\n',at);const raw=source.slice(at,end<0?source.length:end).replace(/\r$/,'');return {start:at,end:at+raw.length,raw,sha256:digest(raw)};});
  return [name,{file:def.file,bytes:bytes.length,sha256:digest(bytes),signatures}];
 }));
}
function parseStructure(source,language){
 const scan=scanSource(source,language);if(scan.diagnostics.length)throw Error('Literal role lexical diagnostics require review');
 const ts=scan.tokens,pairs=new Map(),stack=[];
 const opening=new Set(['(','[','{']),closing={')':'(',']':'[','}':'{'};
 for(let i=0;i<ts.length;i++){
  if(ts[i].kind==='string'||ts[i].kind==='character-code')continue;
  if(opening.has(ts[i].raw))stack.push(i);
  else if(closing[ts[i].raw]){const j=stack.pop();if(j!==undefined&&ts[j].raw===closing[ts[i].raw]){pairs.set(j,i);pairs.set(i,j);}}
 }
 const nameBefore=index=>{
  let j=index-1;if(ts[j]?.kind!=='identifier')return null;
  let first=j;while(first>=2&&['.',':'].includes(ts[first-1]?.raw)&&ts[first-2]?.kind==='identifier')first-=2;
  if(['function','procedure','constructor','destructor'].includes(ts[first-1]?.raw?.toLowerCase()))return null;
  return {name:ts.slice(first,j+1).map(t=>t.raw).join(''),start:ts[first].start};
 };
 const calls=[];
 for(let i=0;i<ts.length;i++)if(ts[i].raw==='('&&pairs.has(i)){
  const named=nameBefore(i);if(!named||['if','while','for','function','case'].includes(named.name.toLowerCase()))continue;
  const last=pairs.get(i),args=[];let start=i+1,j=start;
  for(;j<last;j++){
   if(pairs.has(j)&&pairs.get(j)>j){j=pairs.get(j);continue;}
   if(ts[j].raw===','){args.push({start:ts[start]?.start??ts[j].start,end:ts[j].start,first:start,last:j-1});start=j+1;}
  }
  if(start<last)args.push({start:ts[start].start,end:ts[last].start,first:start,last:last-1});
  calls.push({callee:named.name,start:named.start,end:ts[last].end,args});
 }
 return {ts,pairs,calls,nameBefore};
}
function lineGuard(source,literal){
 const start=source.lastIndexOf('\n',literal.offset-1)+1;
 let end=source.indexOf('\n',literal.endOffset);if(end<0)end=source.length;
 if(source[end-1]==='\r')end--;
 const raw=source.slice(start,end);return {start,end,raw,sha256:digest(raw)};
}
function callRole(call,argIndex,arg,context){
 const name=call.callee,lower=name.toLowerCase(),terminal=lower.split(/[.:]/).at(-1);
 const raw=context.source.slice(arg.start,arg.end).trim();
 if(argIndex===0&&/^luasystem\.(get|defined|gettable|gettablesize|set|protectedcall)$/i.test(name))
  return {role:'lua-namespace-or-property-key',reason:'First argument is the original Lua lookup/callback path; literals address program tables/fields, not displayed values. Defaults and later arguments are not classified by this rule.',evidence:'luaPath'};
 if(argIndex===0&&/^(?:[ai]?table\.|table\.)?(?:getString|getInteger|getBoolean|getChar|getFlags|getFloat|getReal|getNumber|getVariant|getTable|isSet|isString|isNumber|isBoolean)$/i.test(name)&&
    (/\bTLuaTable\b|\bwith\s+LuaSystem\.GetTable/i.test(context.source)||/^(?:getString|getInteger|getBoolean|getChar|getFlags)$/i.test(name)))
  return {role:'Lua-table-property-key',reason:'Original TLuaTable accessor first argument is a field key; its returned value and optional default require independent presentation review.',evidence:'tableKey'};
 if(argIndex===0&&/^Configuration\.(GetString|GetInteger|GetBoolean|GetFloat|GetKey|SetString|SetInteger|SetBoolean)$/i.test(name))
  return {role:'configuration-property-key',reason:'Configuration accessor first argument names the stored option; label/default arguments are left pending.',evidence:'tableKey'};
 if(argIndex===0&&/\.(GetAttribute|SetAttribute|GetElement)$/i.test(name)||argIndex===0&&['GetCount','GetChildCount','GetCountStr','GetCounted','AddCounted','IncreaseXMLCount'].includes(name))
  return {role:'XML-path-or-attribute-key',reason:'First argument addresses the original persisted XML counter/path/attribute; it must stay stable across languages.',evidence:'xml'};
 if(argIndex===0&&['VTIG_Begin','VTIG_Reset','VTIG_ResetSelect','VTIG_ResetScroll','VTIG_ResetInput'].includes(name)||argIndex===1&&name==='VTIG_BeginWindow')
  return {role:'VTIG-widget-identity',reason:'This argument names internal retained UI state/window identity. VTIG_BeginWindow first argument remains a display title and is never classified by this rule.',evidence:'widget'};
 if(argIndex===0&&registeredCalls.has(name))
  return {role:'registry-registration-identity',reason:'Original registration first argument is the persistent prototype ID, distinct from its name/description fields.',evidence:'registry'};
 if(argIndex===0&&['core.declare','core.register_blueprint'].includes(name)||argIndex<2&&['core.register_storage','core.register_array_storage'].includes(name))
  return {role:'global-or-blueprint-identity',reason:'Declared global/storage/blueprint identity is a program symbol. Callback bodies, defaults and text fields are not covered.',evidence:name==='core.register_blueprint'?'schema':'registry'};
 if(argIndex===0&&['core.TIDIN','core.TARRAY'].includes(name))
  return {role:'blueprint-type-or-registry-key',reason:'Schema argument identifies a referenced registry/blueprint, rather than a runtime display label.',evidence:'schema'};
 if(argIndex===0&&/^[A-Za-z_][A-Za-z0-9_.]*:(add_badge|add_medal)$/.test(name))
  return {role:'achievement-registry-reference',reason:'Achievement API resolves its badge/medal argument as an original registry ID; visible titles come from separately reviewed metadata.',evidence:'achievements'};
 if(argIndex===0&&['require','dofile','io.open','FileExists','DirectoryExists'].includes(name))
  return {role:'resource-or-filesystem-path',reason:'This argument is a loader/file path. It is retained program data, independent of any file content or user-facing error.',evidence:'language-library-path'};
 if(name==='io.open'&&argIndex===1)
  return {role:'filesystem-open-mode',reason:'File-open mode is a language/library control argument, not text.',evidence:'language-library-path'};
 return null;
}
function structuralRole(literal,context){
 const {ts,pairs}=context;const index=context.byOffset.get(literal.offset);if(index===undefined)return null;
 const t=ts[index];
 if(literal.language==='lua'){
  const previous=ts[index-1],next=ts[index+1];
  if(previous?.kind==='identifier'){
   let first=index-1;while(first>=2&&['.',':'].includes(ts[first-1]?.raw)&&ts[first-2]?.kind==='identifier')first-=2;
   const name=ts.slice(first,index).map(x=>x.raw).join('');
   if(registeredCalls.has(name)||name==='core.register_blueprint')return {role:name==='core.register_blueprint'?'global-or-blueprint-identity':'registry-registration-identity',callee:name,argIndex:0,evidence:name==='core.register_blueprint'?'schema':'registry',reason:'Lua string-call syntax passes this exact literal as the prototype/blueprint ID. The following table name/description values remain independent.'};
  }
  if(previous?.raw==='['&&next?.raw===']'){
   const before=ts[index-2];
   if(before?.kind==='identifier'&&registryNames.has(before.raw))return {role:'registry-index-identity',callee:`${before.raw}[]`,argIndex:0,evidence:'registry',reason:'Exact string index selects a prototype in the named original registry. It is not the returned name/description.'};
   if(ts[index+2]?.raw==='='&&(/^[A-Za-z0-9_./:-]+$/.test(literal.value)||[...literal.value].length===1))return {role:'table-key-definition',callee:'Lua table keyed-field assignment',argIndex:0,evidence:'language-table-key',reason:'String is syntactically an identifier/path/glyph table key on the left of an assignment; no literal value or display operand is covered. Original English message-color wildcard patterns remain pending.'};
  }
 }
 const before=context.source.slice(Math.max(0,literal.offset-180),literal.offset);
 if(literal.language==='pascal'&&/\(\s*name\s*:\s*$/i.test(before)&&/^\s*;\s*func\s*:\s*@/i.test(context.source.slice(literal.endOffset,literal.endOffset+100))){
  const bindingArray=[...pairs.entries()].find(([a,b])=>a<b&&ts[a].raw==='('&&ts[a-1]?.raw==='='&&ts[a-2]?.raw.toLowerCase()==='lual_reg'&&ts[a].start<=literal.offset&&ts[b].end>=literal.endOffset);
  if(bindingArray)return {role:'native-Lua-binding-name',callee:'luaL_Reg.name',argIndex:0,evidence:'binding',reason:'Exact Name/Func record lies inside a declared luaL_Reg array and names a native Lua method binding; this is not a UI Name field.'};
 }
 const field=/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*$/.exec(before)?.[1];
 if(literal.language==='lua'&&field==='ascii'&&[...literal.value].length===1)
  return {role:'map-or-entity-glyph',callee:'blueprint ascii field',argIndex:null,evidence:'schema',reason:'The single-character ascii field is a renderer/map glyph. English Name/Desc fields are never treated as glyphs.'};
 if(literal.language==='lua'&&['id','ammo_id','ai_type','sound_id','color_id','corpse','destroyto','request_id'].includes(field)&&/^[a-z0-9_./-]+$/.test(literal.value))
  return {role:'blueprint-domain-reference',callee:`blueprint.${field}`,argIndex:null,evidence:'schema',reason:`Original ${field} field is a prototype/resource reference. Display name, description, quote and requirements prose fields are excluded.`};
 return null;
}
const onlyLayout=value=>value===''||/^[\s\d%.,:;!?+*/|_()\[\]<>#=\-]+$/.test(value)||/^(?:\{[!0-9A-Za-z]|\}|\s|[,.:;!?+*/|_()\[\]<>#=\-])+$/.test(value);

export function buildLiteralRoleReview(sourceRoot,{
 inventory=JSON.parse(readFileSync(path.join(here,'../port/catalog/text-inventory.json'),'utf8')),
 manifest=defaultJson('manifest.json'),dispositions=defaultJson('text-dispositions.json'),
 sourceOverrides={},workspaceRoot=path.resolve(here,'..'),
}={}){
 if(inventory.source.commit!==manifest.sourceCommit||inventory.source.commit!==dispositions.sourceCommit)throw Error('Literal role source commit mismatch');
 const prior=new Map(dispositions.literals.map(x=>[key(x),x.disposition==='reviewed-explicit-source-role'&&x.priorDisposition?.startsWith('pending')?{...x,disposition:x.priorDisposition}:x]));
 const fileLocks=Object.fromEntries(inventory.manifest.filter(x=>x.language).map(x=>[x.file,{bytes:x.bytes,sha256:x.sha256,language:x.language}]));
 const contexts={};
 for(const [file,lock]of Object.entries(fileLocks)){
  const supplied=sourceOverrides[file],bytes=supplied===undefined?readFileSync(path.join(sourceRoot,file)):Buffer.isBuffer(supplied)?supplied:Buffer.from(supplied,'utf8');
  if(bytes.length!==lock.bytes||digest(bytes)!==lock.sha256)throw Error(`Literal role file hash guard: ${file}`);
  const source=bytes.toString('utf8'),structure=parseStructure(source,lock.language);
  contexts[file]={source,...structure,byOffset:new Map(structure.ts.map((t,i)=>[t.start,i]))};
 }
 const apiEvidence=evidenceLocks(workspaceRoot),adjudications=[],pendingVisible=[],pendingUnresolved=[];
 for(const literal of inventory.literals){
  const old=prior.get(key(literal));if(!old?.disposition.startsWith('pending'))continue;
  const context=contexts[literal.file],source=context.source;
  if(source.slice(literal.offset,literal.endOffset)!==literal.raw)throw Error(`Literal raw offset guard: ${literal.file}:${literal.line}`);
  const activePatch=(manifest.patches??[]).find(p=>p.file===literal.file&&p.start<=literal.offset&&p.end>=literal.endOffset);
  if(activePatch)continue;
  let role=null,call=null,argIndex=null;
  const containing=context.calls.filter(c=>c.start<=literal.offset&&c.end>=literal.endOffset).sort((a,b)=>(a.end-a.start)-(b.end-b.start));
  for(const candidate of containing){
   const index=candidate.args.findIndex(a=>a.start<=literal.offset&&a.end>=literal.endOffset);if(index<0)continue;
   const found=callRole(candidate,index,candidate.args[index],context);if(found){role=found;call=candidate;argIndex=index;break;}
  }
  role??=structuralRole(literal,context);
  if(!role&&onlyLayout(literal.value))role={role:'fixed-layout-or-control-literal',reason:'Exact literal contains only whitespace, punctuation, numeric/printf-layout characters or bare VTIG control prefixes. Any alphabetic display content outside a control prefix remains pending.',callee:null,argIndex:null,evidence:'exact-literal-character-role'};
  const guard=lineGuard(source,literal);
  const record={file:literal.file,line:literal.line,column:literal.column,start:literal.offset,end:literal.endOffset,
   raw:literal.raw,rawSha256:digest(literal.raw),value:literal.value,sourceSha256:fileLocks[literal.file].sha256,
   lexicalClassification:literal.classification,priorDisposition:old.disposition,sourceContextGuard:guard};
  if(role){adjudications.push({...record,...role,callee:role.callee??call?.callee??null,argIndex:role.argIndex??argIndex,
   callGuard:call?{start:call.start,end:call.end,raw:source.slice(call.start,call.end),sha256:digest(source.slice(call.start,call.end))}:null,
   evidenceGuard:apiEvidence[role.evidence]??{kind:role.evidence},translated:false,originalDomainModified:false});}
  else{
   const messagePattern=literal.file==='bin/config.lua'&&/^\s*\[/.test(guard.raw)&&/[A-Za-z]/.test(literal.value)&&/[\s*!]/.test(literal.value);
   const visible=containing.some(c=>/^(?:ui\.(msg|msg_enter|choice|confirm)|IO\.(Msg|MsgEnter)|VTIG_(Text|FreeLabel|Selectable|BeginWindow)|(?:[A-Za-z0-9_.]+\.)?Push|[A-Za-z0-9_.]+:add_history|mortem\.print)/i.test(c.callee))||literal.classification==='user-facing-candidate'||literal.classification==='text-fragment';
   const r={...record,role:messagePattern?'pending-English-message-color-pattern':visible?'pending-visible-or-composed-text':'pending-unknown-literal-role',
    reason:messagePattern?'Original message-color patterns match rendered English prose. Keep their matching semantics and migrate styling by semantic event identity; ordinary table-key classification would hide this runtime dependency.':visible?'Original display/prose candidate is not proved internal. Review actual consumer and complete producer before translation.':'No explicit guarded role rule applies; remains unreviewed instead of being blanket classified internal.',
    nearestCall:containing[0]?.callee??null,translated:false};
   (visible||messagePattern?pendingVisible:pendingUnresolved).push(r);
  }
 }
 const tally=values=>values.reduce((counts,value)=>(counts[value]=(counts[value]??0)+1,counts),{});
 return {schema:1,sourceCommit:inventory.source.commit,offsetUnit:'UTF-16-code-unit',
  fullGameLocalizationComplete:false,method:'Partial explicit call-argument and identity-symbol role adjudication; discovery classes are hints only. Unknown and display text stays pending.',
  sourceLocks:fileLocks,inputGuards:{inventorySha256:digest(JSON.stringify(inventory)),manifestSha256:digest(JSON.stringify(manifest)),dispositionsSha256:digest(JSON.stringify(dispositions))},
  apiEvidence,adjudications,pendingVisible,pendingUnresolved,
  counts:{adjudicated:adjudications.length,roles:tally(adjudications.map(x=>x.role)),pendingVisible:pendingVisible.length,pendingUnresolved:pendingUnresolved.length,
   sourceFiles:Object.keys(fileLocks).length,uiOrFragmentFalsePositives:adjudications.filter(x=>['user-facing-candidate','text-fragment'].includes(x.lexicalClassification)).length},
  exclusions:['Already reviewed semantic/source regions and existing excluded/support roles are not reclassified.','Optional defaults to property getters are not assumed keys.','Error/assert/log prose is not excluded merely because it is diagnostic.','No blanket classification of ambiguous/internal-candidate strings.'],
 };
}
export function verifyLiteralRoleReview(sourceRoot,options={}){
 const result=buildLiteralRoleReview(sourceRoot,options);
 for(const r of result.adjudications){
  if(!r.reason||!r.role||!r.sourceSha256||!r.sourceContextGuard.sha256||r.translated||r.originalDomainModified)throw Error('Incomplete explicit literal role guard');
  const lock=result.sourceLocks[r.file];if(lock.sha256!==r.sourceSha256||digest(r.raw)!==r.rawSha256||digest(r.sourceContextGuard.raw)!==r.sourceContextGuard.sha256)throw Error(`Literal role record hash guard ${r.file}:${r.line}`);
  if(r.callee==='VTIG_BeginWindow'&&r.argIndex===0)throw Error('Window display title cannot be an internal ID');
  if(r.role==='Lua-table-property-key'&&r.argIndex!==0)throw Error('Getter fallback cannot be classified a key');
 }
 return {...result.counts,guardedRecords:result.adjudications.length,fullGameLocalizationComplete:false,upstreamExecuted:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sourceRoot=path.resolve(here,'../upstream/drl');
 const result=buildLiteralRoleReview(sourceRoot);
 writeFileSync(path.join(here,'literal-role-review.json'),JSON.stringify(result,null,2)+'\n');
 process.stdout.write(JSON.stringify(result.counts)+'\n');
}
