import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const upstream=process.env.ANGBAND_UPSTREAM || 'C:\\Users\\kit\\gameme\\jnethack\\jrouge\\angband\\upstream\\angband-4.2.6';
async function walk(dir,prefix=''){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const rel=prefix+entry.name;if(entry.isDirectory())files.push(...await walk(path.join(dir,entry.name),rel+'/'));else if(/\.(c|h|m|inc|rc)$/.test(entry.name))files.push(rel);}return files;}
const hash=b=>createHash('sha256').update(b).digest('hex');
const records=[];
for(const name of await walk(path.join(upstream,'src'))){const original=await readFile(path.join(upstream,'src',name));let changed=null;try{changed=await readFile(path.join(root,'logic',name));}catch{}records.push({file:name,upstreamSha256:hash(original),portSha256:changed?hash(changed):null,identical:changed?original.equals(changed):false});}
const modified=records.filter(r=>!r.identical);
const report={upstreamCommit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',files:records.length,identicalFiles:records.length-modified.length,modifiedFiles:modified.map(r=>r.file),records};
await writeFile(path.join(root,'tests/source-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({files:report.files,identicalFiles:report.identicalFiles,modifiedFiles:report.modifiedFiles}));
