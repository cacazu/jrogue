/** Reproducible lexical inventory of original presentation messages. It executes no DRL/Lua code.
 * Inventory callsite keys identify source positions; only separately reviewed IDs are translations. */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanSource} from '../port/tools/inventory-texts.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const luaFunctions=new Set(['msg','msg_enter','msg_feel','confirm','query','continue','plot_screen']);
const pascalFunctions=new Set(['msg','msgenter','fail','success','emote']);
function argumentsAt(tokens,start,source){
 let depth=0,brackets=0,braces=0,first=start+1;const argumentsList=[];
 for(let i=start;i<tokens.length;i++){
  const t=tokens[i];if(t.kind!=='punctuation')continue;
  if(t.raw==='(')depth++;
  if(t.raw===')'){
   if(--depth===0){if(i>first)argumentsList.push(tokens.slice(first,i));return {argumentsList,end:tokens[i].end};}
  }
  if(t.raw==='[')brackets++;if(t.raw===']')brackets--;
  if(t.raw==='{')braces++;if(t.raw==='}')braces--;
  if(t.raw===','&&depth===1&&brackets===0&&braces===0){argumentsList.push(tokens.slice(first,i));first=i+1;}
 }
 throw Error('Unclosed presentation call');
}
export function scanMessageCalls(source,language,file){
 const scan=scanSource(source,language);if(scan.diagnostics.length)throw Error(`Message lexical diagnostics: ${file}`);
 const ts=scan.tokens,calls=[];
 for(let i=0;i<ts.length;i++){
  const t=ts[i],name=t.raw.toLowerCase();if(t.kind!=='identifier'||ts[i+1]?.raw!=='(')continue;
  if(language==='lua'){
   if(ts.slice(Math.max(0,i-4),i).some(v=>v.line===t.line&&v.raw==='function'))continue;
   if(!luaFunctions.has(name)||ts[i-2]?.raw!=='ui'||ts[i-1]?.raw!=='.'){
    if(!(name==='msg'&&ts[i-1]?.raw===':'))continue;
   }
  }else{
   if(!pascalFunctions.has(name))continue;
   if(name==='msg'||name==='msgenter'){if(ts[i-2]?.raw.toLowerCase()!=='io'||ts[i-1]?.raw!=='.')continue;}
   if(ts.slice(Math.max(0,i-5),i).some(v=>v.line===t.line&&['function','procedure','constructor'].includes(v.raw.toLowerCase())))continue;
  }
  const call=argumentsAt(ts,i+1,source);let start=t.start;
  if(['.',':'].includes(ts[i-1]?.raw))start=ts[i-2].start;
  const args=call.argumentsList.map(a=>({source:a.length?source.slice(a[0].start,a.at(-1).end):'',start:a[0]?.start??null,end:a.at(-1)?.end??null,strings:a.filter(v=>v.kind==='string').map(v=>({value:v.value,raw:v.raw,line:v.line,start:v.start,end:v.end})),singleLiteral:a.length===1&&a[0].kind==='string'}));
  const first=args[0],hasLiteral=first?.strings.length>0;
  let classification='runtime_value_or_dispatch';
  if(hasLiteral){
   if(name==='emote'||name==='success'&&args[1]?.singleLiteral||language==='lua'&&name==='msg'&&ts[i-1]?.raw===':'&&args.length>1)classification='paired_subject_event';
   else if(first.singleLiteral&&!/%(?:\d+\$)?[-+0 #]*\d*(?:\.\d+)?[sdifguxXpe]/.test(first.strings[0].value))classification='static_literal';
   else classification='formatted_or_composed';
  }
  calls.push({key:`${file}:${start}`,file,line:t.line,language,callee:source.slice(start,t.end),start,end:call.end,original:source.slice(start,call.end),arguments:args,classification,reviewedSemanticId:null});
 }
 return calls;
}
export function buildMessageInventory(sourceRoot){
 const files=[];function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(e.name==='.git')continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(lua|pas)$/i.test(p))files.push(p);}}walk(sourceRoot);
 const sourceFiles={},calls=[];
 for(const f of files.toSorted()){
  const bytes=readFileSync(f),file=path.relative(sourceRoot,f).replaceAll('\\','/'),language=f.endsWith('.lua')?'lua':'pascal';
  const found=scanMessageCalls(bytes.toString('utf8'),language,file);if(found.length){sourceFiles[file]={sha256:hash(bytes),bytes:bytes.length};calls.push(...found);}
 }
 const countBy=(key)=>Object.fromEntries([...new Set(calls.map(key))].sort().map(k=>[k,calls.filter(c=>key(c)===k).length]));
 return {schema:1,sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',offsetUnit:'UTF-16-code-unit',allTextsCovered:false,originalGameplayExecuted:false,sourceFiles,counts:{calls:calls.length,literalBearingCalls:calls.filter(c=>c.arguments[0]?.strings.length).length,byLanguage:countBy(c=>c.language),byClassification:countBy(c=>c.classification),byCallee:countBy(c=>c.callee)},calls};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const inventory=buildMessageInventory(path.resolve(here,'../upstream/drl'));
 writeFileSync(path.join(here,'message-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
 console.log(JSON.stringify(inventory.counts));
}
