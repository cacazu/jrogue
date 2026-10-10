import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=path.join(root,'tests',process.argv.includes('--review')?'browser-review-evidence':'browser-evidence');
const hash=b=>createHash('sha256').update(b).digest('hex');
async function blocks(filename){
 const record=JSON.parse(await readFile(path.join(evidence,filename),'utf8'));
 const bytes=Buffer.from(record.payload,'base64');
 if(bytes.subarray(0,8).toString('ascii')!=='ABRSAVE\0')throw Error('Invalid envelope magic');
 const schema=bytes.readUInt16LE(8),size=bytes.readUInt32LE(55);
 const start=schema===1?63:schema===2?65+4*bytes.readUInt16LE(63):NaN;
 if(!Number.isFinite(start)||start+size>bytes.length)throw Error('Invalid envelope lengths');
 const payload=bytes.subarray(start,start+size);
 if(payload.subarray(0,8).toString('ascii')!=='SaveVNLA')throw Error('Invalid native payload header');
 const result=new Map();
 for(let pos=8;pos<payload.length;){
  if(pos+28>payload.length)throw Error('Truncated native block header');
  const name=payload.subarray(pos,pos+16).toString('ascii').replace(/\0.*$/s,'');
  const version=payload.readUInt32LE(pos+16),length=payload.readUInt32LE(pos+20);
  if(pos+28+length>payload.length||result.has(name))throw Error('Invalid native block lengths/order');
  result.set(name,{version,bytes:payload.subarray(pos+28,pos+28+length)});
  pos+=28+Math.ceil(length/4)*4;
 }
 return result;
}
const reports=[];
for(const [scope,left,right] of [
 ['town','live-branch-save.json','resumed-branch-save.json'],
 ['dungeon','dungeon-live-branch-save.json','dungeon-resumed-branch-save.json']
]){
 if(process.argv.includes('--town-only')&&scope!=='town')continue;
 const [a,b]=await Promise.all([blocks(left),blocks(right)]);
 const records=[];
 for(const name of new Set([...a.keys(),...b.keys()])){
  const x=a.get(name),y=b.get(name);
  const identical=!!x&&!!y&&x.version===y.version&&x.bytes.equals(y.bytes);
  let firstDifference=null;
  if(x&&y&&!identical){let i=0;while(i<Math.min(x.bytes.length,y.bytes.length)&&x.bytes[i]===y.bytes[i])i++;firstDifference=i;}
  records.push({name,identical,leftBytes:x?.bytes.length,rightBytes:y?.bytes.length,leftSha256:x?hash(x.bytes):null,rightSha256:y?hash(y.bytes):null,firstDifference});
 }
 reports.push({scope,identical:records.every(r=>r.identical),blocks:records});
}
const report={comparedAt:new Date().toISOString(),passed:reports.every(r=>r.identical),reports};
await writeFile(path.join(evidence,'native-payload-comparison.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,reports:reports.map(r=>({scope:r.scope,blocks:r.blocks.length,modified:r.blocks.filter(b=>!b.identical).map(b=>b.name)}))}));
if(!report.passed)process.exitCode=1;
