import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const GiB=1024**3, floor=2*GiB, margin=GiB;
const runs=[];
for(const id of ['2026-10-02T19-14-25-977Z','2026-10-02T19-30-37-264Z']){
 const directory='browser-qa/output/'+id+'/';
 const eBytes=await readFile(directory+'evidence.json');
 const gBytes=await readFile(directory+'memory-guard.json');
 const e=JSON.parse(eBytes),g=JSON.parse(gBytes.toString('utf8').replace(/^\ufeff/,''));
 const last=g.samples.at(-1),first=g.samples[0];
 runs.push({directory,evidenceSha256:createHash('sha256').update(eBytes).digest('hex'),guardSha256:createHash('sha256').update(gBytes).digest('hex'),
  actualPreSpawnMemory:e.startMemory,firstOwnedSample:first,lastOwnedSample:last,
  launchToStopPhysicalDrawdownBytes:e.startMemory.availableBytes-last.freePhysicalBytes,
  launchToStopCommitHeadroomDrawdownBytes:e.startMemory.freeCommitBytes-last.freeCommitBytes,
  ownedPrivateAtLaunchBeforeSpawnBytes:0,ownedPrivateAtStopBytes:last.ownedPrivateBytes,
  firstSampleToStopOwnedPrivateGrowthBytes:last.ownedPrivateBytes-first.ownedPrivateBytes,
  workingSet:'not recorded in these ended runs',perProcessPrivate:'not recorded; aggregate only',
  perProcessCpu:'not recorded',processTypeAndCompilerThreadAttribution:'not recorded; PID/creation identities alone cannot attribute renderer or V8 compiler work',
  actualSystemCommittedAtStop:'not recorded; do not infer from starting commit limit because endpoint limit was not logged',
  peakWasCensoredByGuard:true,fullGameplayPeakObserved:false});
}
const physicalDrawdown=Math.max(...runs.map(run=>run.launchToStopPhysicalDrawdownBytes));
const commitDrawdown=Math.max(...runs.map(run=>run.launchToStopCommitHeadroomDrawdownBytes));
const result={schema:'cdda-browser-resource-recovery-analysis',version:1,createdAt:new Date().toISOString(),scope:'read-only arithmetic on ended runs; no browser/compiler/server',
 runs,
 measuredLowerBoundsThroughObservedGuardStop:{physicalDrawdownBytes:physicalDrawdown,commitHeadroomDrawdownBytes:commitDrawdown,runningFloorBytes:floor,policyMarginBytes:margin,
  physicalRestartLowerBoundWithMarginBytes:physicalDrawdown+floor+margin,
  commitRestartLowerBoundWithMarginBytes:commitDrawdown+floor+margin,
  sufficientForCompletedGameplay:false,reason:'The original creation phase did not finish before either guard; further allocations and other global pressure remain unmeasured.'},
 parentSelectedConditionalGate:{actualPreSpawnPhysicalBytes:7*GiB,actualPreSpawnCommitBytes:9*GiB,ownedPrivateCapBytes:5*GiB,remainingPhysicalAndCommitFloorBytes:floor,
  marginBeyondObservedDrawdownAndFloorPhysicalBytes:7*GiB-physicalDrawdown-floor,
  marginBeyondObservedDrawdownAndFloorCommitBytes:9*GiB-commitDrawdown-floor,
  prepareSnapshotNotDecisive:true,freshActualPreSpawnCheckAfterStreamHashesRequired:true,noFitMeansNoChrome:true,automaticRetry:false},
 attributionLimits:['Global available physical drawdown is not an owned working-set measurement.','Global commit headroom drawdown is not solely attributable to owned private growth.','No ended-run data identifies renderer allocation versus V8 compiler threads.','No native/WASM allocation error or target crash was observed before controlled termination.'],
 proposedFutureInstrumentation:['Per-owned-process exact CIM creation identity plus matching Get-Process StartTime','Per-owned-process private bytes, working set, total CPU time and thread count','Process type from own --type flag and utility subtype; raw command lines are not persisted','Aggregate owned private/working-set/CPU plus exact overall committed bytes/commit limit','Explicit warning that summed working sets can double-count shared pages and process CPU cannot identify compiler threads']};
await writeFile('browser-qa/memory-recovery-analysis.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'read-only-analysis-written',physicalDrawdownBytes:physicalDrawdown,commitDrawdownBytes:commitDrawdown,minimumPhysicalWithOneGiBMargin:physicalDrawdown+floor+margin,minimumCommitWithOneGiBMargin:commitDrawdown+floor+margin,parentGate:result.parentSelectedConditionalGate},null,2));
