import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),candidate=path.join(root,'candidates','o1-conservative-asyncify');
const read=name=>JSON.parse(fs.readFileSync(path.join(candidate,name),'utf8'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const plan=read('link-candidate.json'),run=read('run-config.json'),outcome=read('candidate-outcome.json'),constraint=read('constraint-triggered.json'),closure=read('evidence/closure-and-original.json');
if(JSON.stringify(plan.argv)!==JSON.stringify(run.argv))throw new Error('Reviewed/executed argv changed');
if(!closure.allObservedCandidateProcessesEnded||!closure.original.alive)throw new Error('Process closure/original preservation not confirmed');
const response=run.argv.find(arg=>arg.startsWith('@')).slice(1),originalResponse=path.join(root,'link-objects.rsp');
if(sha(response)!==sha(originalResponse))throw new Error('Same-object response changed');
const output=run.argv[run.argv.indexOf('-o')+1],wasm=output.replace(/\.js$/,'.wasm');
const evidence={schemaVersion:1,generatedUtc:new Date().toISOString(),result:'resource-constrained',full_engine:false,completePort:false,runtimeBrowserVerified:false,
  upstream:{commit:plan.source.upstreamCommit,tag:plan.source.tag},sourceUnits:{total:438,compiledSuccessful:438},
  scope:'One same-object em++ -O1 conservative Asyncify attempt; stopped by the required memory guard before completed JS/WASM output.',
  outcome,launchGate:run.launchGate,trigger:{timestampUtc:constraint.observed.timestampUtc,physicalFreeBytes:constraint.observed.physicalFreeBytes,exactCommitHeadroomBytes:constraint.observed.exactCommitHeadroomBytes,minimumPhysicalAndCommitBytes:constraint.minimumPhysicalAndCommitBytes,sampledPeakOwnedPrivateBytes:constraint.observed.sampledPeakPrivateBytes,maximumCandidatePrivateBytes:constraint.maximumCandidatePrivateBytes},
  processes:closure,actualLinkLogPath:path.join(candidate,'link-engine.log'),
  provenanceHashes:{candidateConfigSha256:sha(path.join(candidate,'link-candidate.json')),runConfigSha256:sha(path.join(candidate,'run-config.json')),objectsResponseSha256:sha(response),emscriptenConfigSha256:sha(run.environmentOverrides.EM_CONFIG),actualLinkLogSha256:sha(path.join(candidate,'link-engine.log')),resourceSamplesSha256:sha(path.join(candidate,'resource-samples.ndjson'))},
  reviewedAndExecutedArgvIdentical:true,sourceObjectsUnchanged:true,
  intermediate:{path:wasm,bytes:fs.statSync(wasm).size,sha256:sha(wasm),completedJavascriptExists:fs.existsSync(output),notAcceptedOrRunnableCompletionEvidence:true},
  recovery:{path:path.join(root,'output','recovery','cataclysm-tiles.pre-optimization.wasm'),sha256:sha(path.join(root,'output','recovery','cataclysm-tiles.pre-optimization.wasm'))},
  resourceNotes:['Commit headroom, not the private-usage cap, caused the candidate-only failsafe. Original optimizer and all unrelated processes were left untouched.',
    'A future attempt requires a parent-coordinated quiet memory window, fresh >=4 GiB physical and >=6 GiB exact commit headroom, and the unchanged running 2 GiB floor/4 GiB private guard. No retry is authorized here.',
    'Observed candidate peak plus running commit floor is '+(constraint.observed.sampledPeakPrivateBytes+constraint.minimumPhysicalAndCommitBytes)+' bytes; this is a measured lower bound for a quiet window, not a guarantee of the later peak or completion.'],
};
const destination=path.join(candidate,'evidence','resource-constrained-attempt.json');fs.writeFileSync(destination,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({evidence:destination,result:evidence.result,full_engine:false,elapsedSeconds:outcome.elapsedSeconds,trigger:evidence.trigger,allCandidateProcessesEnded:closure.allObservedCandidateProcessesEnded,originalAlive:closure.original.alive,provenanceHashes:evidence.provenanceHashes}));
