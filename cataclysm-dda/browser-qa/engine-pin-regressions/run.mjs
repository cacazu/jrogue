import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { acceptedEngineFiles, assertAcceptedEngineFiles, assertAcceptedManifestBytes, assertAcceptedEngineManifest } from '../accepted-engine-files.mjs';
const cases = [];
function check(name, run) { run(); cases.push(name); }
const clone = () => acceptedEngineFiles.map(file => ({...file}));
check('accepted four exact artifact identities pass', () => assert.doesNotThrow(() => assertAcceptedEngineFiles(clone())));
check('accepted pins and records are immutable', () => { assert(Object.isFrozen(acceptedEngineFiles)); assert(acceptedEngineFiles.every(Object.isFrozen)); });
for (const file of acceptedEngineFiles) {
  check(file.filename + ': changed digest rejects', () => { const files=clone(); files.find(value=>value.filename===file.filename).sha256='0'.repeat(64); assert.throws(()=>assertAcceptedEngineFiles(files),/size.digest mismatch/); });
  check(file.filename + ': changed byte size rejects', () => { const files=clone(); files.find(value=>value.filename===file.filename).bytes++; assert.throws(()=>assertAcceptedEngineFiles(files),/size.digest mismatch/); });
}
check('missing artifact rejects',()=>assert.throws(()=>assertAcceptedEngineFiles(clone().slice(1)),/exactly four/));
check('duplicate identity rejects',()=>{const files=clone();files[3]={...files[0]};assert.throws(()=>assertAcceptedEngineFiles(files),/duplicate/);});
check('unknown identity rejects',()=>{const files=clone();files[2].filename='unreviewed.js';assert.throws(()=>assertAcceptedEngineFiles(files),/Unexpected/);});
check('non-array rejects',()=>assert.throws(()=>assertAcceptedEngineFiles(null),/exactly four/));
const source=await readFile('browser-qa/session-v3-pinned.mjs','utf8');
const before=await readFile('browser-qa/session-v3.mjs','utf8');
check('startup calls the tested verifier after streaming and before fresh gate/profile/Chrome',()=>{const call=source.indexOf('assertAcceptedEngineFiles(packageFiles);');assert(call>source.indexOf("sha256: hash.digest('hex')"));for(const marker of ['const packageResponse = await fetch','const startMemory = await readMemory();','if (!profile) { profile = await mkdtemp','const handle = spawn(chrome']) assert(call<source.indexOf(marker));});
const manifestBytes=await readFile('baseline-preview/web/package-manifest.json');
const manifest=JSON.parse(manifestBytes.toString('utf8'));
check('exact accepted manifest bytes and records pass',()=>{assert.doesNotThrow(()=>assertAcceptedManifestBytes(manifestBytes));assert.doesNotThrow(()=>assertAcceptedEngineManifest(manifest));});
check('manifest whitespace byte change rejects before parsing',()=>assert.throws(()=>assertAcceptedManifestBytes(Buffer.concat([manifestBytes,Buffer.from(' ')])),/byte digest mismatch/));
check('malformed manifest bytes reject before JSON parse',()=>assert.throws(()=>assertAcceptedManifestBytes(Buffer.from('{')),/byte digest mismatch/));
check('manifest files missing rejects',()=>assert.throws(()=>assertAcceptedEngineManifest({}),/missing or malformed/));
check('duplicate manifest record rejects',()=>assert.throws(()=>assertAcceptedEngineManifest({...manifest,files:[...manifest.files,manifest.files[0]]}),/Duplicate/));
check('missing required manifest engine record rejects',()=>assert.throws(()=>assertAcceptedEngineManifest({...manifest,files:manifest.files.filter(file=>file.path!=='cataclysm-tiles.wasm')}),/exactly four/));
for(const property of ['path','bytes','sha256'])check('malformed manifest '+property+' rejects',()=>{const changed={...manifest.files[0],[property]:null};assert.throws(()=>assertAcceptedEngineManifest({...manifest,files:[changed,...manifest.files.slice(1)]}),/Malformed/);});
for(const file of acceptedEngineFiles)check(file.filename+': manifest digest disagreement rejects',()=>{const changed=manifest.files.map(record=>record.path===file.filename?{...record,sha256:'0'.repeat(64)}:record);assert.throws(()=>assertAcceptedEngineManifest({...manifest,files:changed}),/size\/digest mismatch/);});
check('manifest byte check precedes parsing and all large engine reads',()=>{const call=source.indexOf('assertAcceptedManifestBytes(manifestBytes);');assert(call<source.indexOf('const manifest = JSON.parse'));assert(call<source.indexOf('for (const filename of'));});
check('live manifest byte check precedes live parsing and fresh gate',()=>{const call=source.indexOf('assertAcceptedManifestBytes(liveManifestBytes);');assert(call<source.indexOf('JSON.parse(liveManifestBytes'));assert(call<source.indexOf('const startMemory = await readMemory();'));});
const restore=source.replace("\nimport { assertAcceptedEngineFiles, assertAcceptedManifestBytes, assertAcceptedEngineManifest } from './accepted-engine-files.mjs';",'').replace("const manifestBytes = await readFile(path.join(packageRoot, 'package-manifest.json'));\nassertAcceptedManifestBytes(manifestBytes);\nconst manifest = JSON.parse(manifestBytes.toString('utf8'));\nassertAcceptedEngineManifest(manifest);","const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package-manifest.json'), 'utf8'));").replace('assertAcceptedEngineFiles(packageFiles);\n','').replace("if (!packageResponse.ok) throw new Error('The live package server must serve the verified local manifest.');\nconst liveManifestBytes = Buffer.from(await packageResponse.arrayBuffer());\nassertAcceptedManifestBytes(liveManifestBytes);\nif (JSON.stringify(JSON.parse(liveManifestBytes.toString('utf8'))) !== JSON.stringify(manifest)) throw new Error('The live package server must serve the verified local manifest.');","if (!packageResponse.ok || JSON.stringify(await packageResponse.json()) !== JSON.stringify(manifest)) throw new Error('The live package server must serve the verified local manifest.');");
check('preserved session differs only by local/live manifest and four-artifact pin checks',()=>assert.equal(restore,before));
const paths=['browser-qa/accepted-engine-files.mjs','browser-qa/session-v3-pinned.mjs','browser-qa/session-v3.mjs'];const pins=[];for(const path of paths){const raw=await readFile(path);pins.push({path,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')});}
const report={checkedAt:new Date().toISOString(),scope:'Pure accepted-artifact fixtures and source-order checks; no large file hashes or browser/runtime workload',status:'passed',cases:cases.length,checks:cases,pins,chromeStarted:false,profileCreated:false,engineBytesRead:false};
const directory='browser-qa/engine-pin-regressions/output/'+report.checkedAt.replaceAll(':','-');await mkdir(directory,{recursive:true});await writeFile(directory+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({report:directory+'/report.json',cases:cases.length,status:report.status,pins}));
