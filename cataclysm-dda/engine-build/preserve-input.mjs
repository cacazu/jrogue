import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(root,'output','cataclysm-tiles.wasm');
const expectedSha256='6b65cb8bdeab5eca9b7f221e342547d19b77f8643c98e809d4bffcb1387c362a';
const expectedBytes=42382436;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const before=fs.statSync(source);
const input=fs.readFileSync(source);
const actualSha256=sha(input);
if(actualSha256!==expectedSha256||input.length!==expectedBytes){
  throw new Error('Current artifact changed; no pre-optimization backup written: '+JSON.stringify({bytes:input.length,sha256:actualSha256}));
}
const recoveryRoot=path.join(root,'output','recovery');
const backup=path.join(recoveryRoot,'cataclysm-tiles.pre-optimization.wasm');
fs.mkdirSync(recoveryRoot,{recursive:true});
if(fs.existsSync(backup)){
  const prior=fs.readFileSync(backup);
  if(prior.length!==expectedBytes||sha(prior)!==expectedSha256)throw new Error('Existing backup differs; preserving it without overwrite');
}else fs.writeFileSync(backup,input,{flag:'wx'});
const verified=fs.readFileSync(backup);
if(verified.length!==expectedBytes||sha(verified)!==expectedSha256)throw new Error('Backup verification failed');
const metadata={schemaVersion:1,capturedUtc:new Date().toISOString(),status:'verified-known-pre-optimization-input',
  source,backup,bytes:expectedBytes,sha256:expectedSha256,
  sourceMtimeBeforeReadUtc:before.mtime.toISOString(),currentSourceMtimeAfterCopyUtc:fs.statSync(source).mtime.toISOString(),
  notCompletionEvidence:true,originalSourceAndProcessUnmodified:true,
  preservedReferences:['build-manifest.json','compile-results.json','link-objects.rsp','.emscripten','logs/link-engine.log'].map(name=>({path:path.join(root,name),sha256:sha(fs.readFileSync(path.join(root,name)))})),
  objectsPath:path.join(root,'objects'),sourceUnits:438,
  upstreamCommit:'7b2efa5cea38e4d4d97dd0e63b28b9148623da59',compiler:'6.0.8',binaryen:'132 (version_132-16-g89a81ef9b)',
};
const metadataPath=path.join(recoveryRoot,'recovery-metadata.json');
fs.writeFileSync(metadataPath,JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({status:metadata.status,backup,bytes:metadata.bytes,sha256:metadata.sha256,metadata:metadataPath}));
