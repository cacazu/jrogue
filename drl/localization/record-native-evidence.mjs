/** Reconcile existing parent-run native artifacts; never compile or execute code. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const digest=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
const read=f=>JSON.parse(readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const verificationPath=path.join(here,'verification.json'),verification=read(verificationPath);
const compilerSha='fc3a8184a70722be726264faac4357fe11851e3edb899be8ced0aea82d4e9cb0';
const jobs=[
 ['semantic','native-semantic-probe-33b662c6b1fb41dfb8de3eea64eb3cf0',22,/Semantic Pascal checks: (\d+)/],
 ['json-contract','native-json-contract-probe-752a34498fef4e7ebaaa655e20466cda',46,/Native JSON contract checks: (\d+); failures: 0/,'native-json-contract-fixed-memory.json'],
 ['feeling','native-feeling-probe-1e02745f32514270b3118034c20bb8c2',90,/Native feeling checks: (\d+)/,'native-feeling-memory.json'],
 ['item','native-item-name-probe-b194f8f80d0d4a5eb2a07c433d5d2599',174,/Native item-name checks: (\d+)/,'native-item-memory.json'],
 ['history','native-history-probe-5341dcf3c3d14467a12701f2b3ce7df0',363,null,'native-history-memory.json']
];
const expectedUnits={};
for(const unit of ['drlsemantictext.pas','drlsemanticfeelings.pas','drlsemanticitemnames.pas','drlsemantichistory.pas'])expectedUnits[unit]=verification.files[unit].sha256;
Object.assign(expectedUnits,{'drlsemanticfeelcatalog.pas':verification.feelings.validatorUnitSha256,'drlsemanticitemcatalog.pas':verification.itemNames.catalogUnitSha256,'drlsemantichistorycatalog.pas':verification.history.catalogUnitSha256,'drlsemanticregistry.pas':verification.registry.semanticUnitSha256});
const fixtures={};
for(const [probe,directory,checks,pattern,memoryName]of jobs){
 const relative=`native-probe-build/${directory}/result.json`,resultPath=path.join(here,relative),result=read(resultPath);
 assert.equal(result.sourceCommit,verification.sourceCommit);assert.equal(result.probe,probe);
 assert.equal(result.passed,true);assert.equal(result.compilation.exitCode,0);assert.equal(result.execution.exitCode,0);
 assert.equal(result.fullOriginalGameExecuted,false);assert.equal(result.browserExecuted,false);
 assert.equal(digest(result.source),result.sourceSha256);assert.equal(digest(result.compiledSource),result.sourceSha256);
 assert.equal(result.compilerSha256,compilerSha);assert.equal(digest(result.compiler),compilerSha);
 assert.equal(digest(result.execution.command[0]),result.executableSha256);
 assert.equal(readFileSync(path.join(path.dirname(resultPath),'run.stdout.log'),'utf8'),result.execution.stdout);
 let rejectedLoads;
 if(pattern)assert.equal(Number(pattern.exec(result.execution.stdout)?.[1]),checks);
 else{
  const output=JSON.parse(result.execution.stdout);assert.equal(output.native_history_checks,checks);assert.equal(output.rejected_loads,43);
  assert.equal(output.actual_history_unit,true);assert.equal(output.actual_generated_catalog,true);rejectedLoads=output.rejected_loads;
 }
 const unitHashes=result.unitSourceSha256??{};
 if(probe!=='semantic')assert.deepEqual(unitHashes,expectedUnits);
 for(const [unit,sha]of Object.entries(unitHashes))assert.equal(digest(path.join(here,'overlay/src',unit)),sha);
 const entry={status:'passed',passed:checks,failed:0,...rejectedLoads===undefined?{}:{rejectedLoads},result:relative,resultSha256:digest(resultPath),fixtureSha256:result.sourceSha256,compilerSha256:compilerSha,executableSha256:result.executableSha256,startedUtc:result.execution.startedUtc,finishedUtc:result.execution.finishedUtc,unitSourceSha256:unitHashes,fullOriginalGameExecuted:false,browserExecuted:false};
 if(probe==='semantic')entry.unitHashRecordingLimitation='The older result predates unit-hash recording; only its exact fixture/compiler/executable are witnessed.';
 if(memoryName){
  const memoryPath=path.join(here,'native-probe-build',memoryName),memory=read(memoryPath);assert.equal(memory.exit_code,0);
  const log=readFileSync(memory.stdout_log,'utf8');assert.ok(log.includes(resultPath));assert.ok(log.includes(result.execution.stdout.trim()));
  entry.measuredJob={result:`native-probe-build/${memoryName}`,sha256:digest(memoryPath),stdoutLog:`native-probe-build/${memoryName}.stdout.log`,stdoutSha256:digest(memory.stdout_log),exactPeakCommitBytes:memory.exact_job_peak_commit_bytes};
 }
 fixtures[probe]=entry;
}
const failureRelative='native-probe-build/native-json-contract-probe-83106b31212d4a9bb29890ed32ca943d/result.json';
const failurePath=path.join(here,failureRelative),failure=read(failurePath);
assert.equal(failure.passed,false);assert.equal(failure.execution.exitCode,1);assert.match(failure.execution.stdout,/Native JSON contract checks: 46; failures: 13/);
const evidence={schema:1,sourceCommit:verification.sourceCommit,recorderExecutedNativeCode:false,executor:'parent agent /root',fixtureCount:5,totalNativeChecks:Object.values(fixtures).reduce((n,x)=>n+x.passed,0),fixtures,historicalRegression:{status:'retained pre-fix failure',checks:46,failed:13,result:failureRelative,resultSha256:digest(failurePath),originalUnitSha256:digest(path.join(here,'strict-json-proposal/original-drlsemanticfeelings.pas'))},fullGameLocalizationComplete:false,fullOriginalGameExecuted:false,browserExecuted:false};
writeFileSync(path.join(here,'native-execution-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
verification.executedNativeFixtures=evidence;
verification.authoredPascalBoundaryChecks={passed:22,failed:0,nativeExecuted:true,result:fixtures.semantic.result,resultSha256:fixtures.semantic.resultSha256,scope:'Actual native semantic fixture only; no complete original game or browser.'};
verification.feelings.actualNativeFixture={passed:90,failed:0,result:fixtures.feeling.result};
verification.itemNames.actualNativeFixture={passed:174,failed:0,result:fixtures.item.result};
verification.history.actualNativeFixture={passed:363,failed:0,rejectedLoads:43,result:fixtures.history.result};
verification.files['record-native-evidence.mjs']={sha256:digest(fileURLToPath(import.meta.url))};
verification.files['native-execution-evidence.json']={sha256:digest(path.join(here,'native-execution-evidence.json'))};
writeFileSync(verificationPath,JSON.stringify(verification,null,2)+'\n');
console.log(JSON.stringify({recordedNativeFixtures:5,checks:evidence.totalNativeChecks,nativeExecutedByRecorder:false,fullOriginalGameExecuted:false,browserExecuted:false}));
