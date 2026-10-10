/** Source-only dependency audit. Comments/directives are lexed as source metadata;
 * this does not replace the native compiler's conditional evaluation. */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanSource} from '../port/tools/inventory-texts.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export function pascalUses(source){
 const ts=scanSource(source,'pascal').tokens,uses={interface:[],implementation:[]};let section=null;
 for(let i=0;i<ts.length;i++){
  const word=ts[i].raw.toLowerCase();if(word==='interface'||word==='implementation'){section=word;continue;}
  if(word!=='uses'||!section)continue;
  for(i++;i<ts.length&&ts[i].raw!==';';i++){
   if(ts[i].kind!=='identifier')continue;
   let name=ts[i].raw,at=ts[i].start,line=ts[i].line;
   while(ts[i+1]?.raw==='.'&&ts[i+2]?.kind==='identifier'){name+='.'+ts[i+2].raw;i+=2;}
   uses[section].push({name:name.toLowerCase(),offset:at,line});
   if(ts[i+1]?.raw.toLowerCase()==='in'){i+=2;}
  }
 }
 return uses;
}
export function auditPascalUses(directory=path.join(here,'overlay/src')){
 const units=[],duplicates=[];
 for(const f of readdirSync(directory).filter(f=>f.endsWith('.pas')).sort()){
  const uses=pascalUses(readFileSync(path.join(directory,f),'utf8'));units.push({file:f,uses});
  for(const dependency of uses.implementation){const original=uses.interface.find(x=>x.name===dependency.name);if(original)duplicates.push({file:f,name:dependency.name,interfaceLine:original.line,implementationLine:dependency.line});}
 }
 return{schema:1,compilerExecuted:false,units:units.length,duplicates,dependencies:units};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=auditPascalUses();writeFileSync(path.join(here,'pascal-uses-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({units:report.units,duplicates:report.duplicates}));
 if(report.duplicates.length)process.exitCode=1;
}
