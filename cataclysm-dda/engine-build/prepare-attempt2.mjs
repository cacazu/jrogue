import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),base=path.join(root,'candidates','o1-conservative-asyncify');
const archive=path.join(base,'attempts','attempt-1'),next=path.join(base,'attempts','attempt-2');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const template=JSON.parse(fs.readFileSync(path.join(base,'link-candidate.json'),'utf8'));
const frozen=fs.readFileSync(template.environmentOverrides.EM_CONFIG);
const originalResponse=fs.readFileSync(path.join(root,'link-objects.rsp'));
const objectPaths=originalResponse.toString('utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
if(objectPaths.length!==438||objectPaths.some(file=>!fs.existsSync(file)))throw new Error('438 original objects not preserved');
if(fs.existsSync(path.join(archive,'archive-manifest.json')))throw new Error('Immutable attempt1 archive already exists');
const files=[];
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  if(directory===base&&entry.name==='attempts')continue;
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())walk(file);else if(entry.isFile())files.push(file);else throw new Error('Unexpected linked artifact');
}}
walk(base);
const entries=[];
for(const source of files){
  const relative=path.relative(base,source),destination=path.resolve(archive,relative);
  if(relative.startsWith('..')||!destination.startsWith(archive+path.sep))throw new Error('Archive scope escape');
  if(fs.existsSync(destination))throw new Error('Refusing overwrite of archived artifact');
  const bytes=fs.readFileSync(source),sha256=hash(bytes);
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.renameSync(source,destination);
  if(hash(fs.readFileSync(destination))!==sha256)throw new Error('Archive verification failed');
  entries.push({originalPath:source,archivedPath:destination,bytes:bytes.length,sha256});
}
fs.writeFileSync(path.join(archive,'archive-manifest.json'),JSON.stringify({schemaVersion:1,archivedUtc:new Date().toISOString(),immutableAttempt:1,entries},null,2)+'\n');
fs.mkdirSync(path.join(next,'output'),{recursive:true});
const config=path.join(next,'.emscripten'),response=path.join(next,'objects.rsp');
fs.writeFileSync(config,frozen);fs.writeFileSync(response,originalResponse);
const args=[...template.argv];args[args.findIndex(arg=>arg.startsWith('@'))]='@'+response;
args[args.indexOf('-o')+1]=path.join(next,'output','cataclysm-tiles.js');
const plan={...template,attemptNumber:2,createdUtc:new Date().toISOString(),argv:args,environmentOverrides:{...template.environmentOverrides,EM_CONFIG:config},
  originalProcessState:'parent-authorized-ended-after-identity-verification',originalTerminationRecord:path.join(root,'evidence','original-termination.json'),
  archivedAttempt1:path.join(archive,'archive-manifest.json'),
  parentAuthorization:'Parent explicitly authorized identity-checked termination ONLY of original owned CDDA optimizer, preservation of input/recovery/438 objects and immutable attempt1, then ONE same-object em++ -O1 conservative Asyncify retry after fresh4GiB physical/6GiB exact commit gate. Same5s candidate-only guard2GiB free floor/4GiB private cap; no JSPI, pass-debug or unrelated process manipulation.',
};
fs.writeFileSync(path.join(next,'link-candidate.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({archive,archivedFiles:entries.length,next,objectsPreserved:objectPaths.length,objectResponseSha256:hash(originalResponse),originalProcessState:plan.originalProcessState}));
