import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const directory=path.dirname(fileURLToPath(import.meta.url)),qa=path.dirname(directory);
if(process.env.CDDA_GUARD_PROBE_SLOT!=='parent-reviewed-counter-probe-v3')throw new Error('Wait for parent review and explicit tiny-probe slot; this never authorizes Chrome.');
const output=path.join(directory,'output',new Date().toISOString().replaceAll(':','-').replaceAll('.','-'));await mkdir(output,{recursive:true});
async function ps(args){const p=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass',...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);const code=await new Promise((r,j)=>{p.on('exit',r);p.on('error',j)});if(code!==0)throw new Error('Probe helper failed '+code+': '+stderr);return stdout;}
const sources=[];for(const name of ['resource-guard-v3.ps1','owned-identities-v3.ps1','verify-teardown-v3.ps1','guard-counter-probe-v3/owned-node.mjs','guard-counter-probe-v3/run.mjs']){const b=await readFile(path.join(qa,name));sources.push({path:'browser-qa/'+name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}
const memory=JSON.parse((await ps(['-File',path.join(qa,'memory.ps1')])).replace(/^\ufeff/,''));
const report={startedAt:new Date().toISOString(),status:'prepared-not-run',scope:'Tiny authored Node root and one child; actual revised guard counter/identity precision only. No Chrome/game/browser candidate consumed.',launchGateBytes:{physical:4*1024**3,commit:6*1024**3},limits:{ownedPrivateBytes:1024**3,runningFloorsBytes:2*1024**3,maximumSeconds:180},preSpawnMemory:memory,sources,chromeStarted:false};
async function save(){await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
if(memory.availableBytes<4*1024**3||memory.freeCommitBytes<6*1024**3){report.status='no-resource-fit-no-node-root';await save();console.log(JSON.stringify({status:report.status,output,memory}));process.exit(0);}
const token=path.join(output,'owned-node-token');
const root=spawn(process.execPath,[path.join(directory,'owned-node.mjs'),'--user-data-dir='+token],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
report.ownedNode={pid:root.pid,childPid:null,identityToken:token};
let rootError='';root.stderr.on('data',b=>rootError=(rootError+b).slice(-2000));
const rootExit=new Promise(resolve=>root.once('exit',resolve));
const guardPath=path.join(output,'memory-guard.json'),stopPath=path.join(output,'guard-stop');
const guard=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(qa,'resource-guard-v3.ps1'),'-OwnedRootPid',String(root.pid),'-ExpectedProfile',token,'-OutputPath',guardPath,'-StopPath',stopPath,'-PrivateBudgetBytes',String(1024**3),'-RemainingFloorBytes',String(2*1024**3),'-MaximumSeconds','180'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let guardError='';guard.stderr.on('data',b=>guardError=(guardError+b).slice(-4000));
let ended=false;const guardExit=new Promise(resolve=>{guard.once('exit',code=>{ended=true;resolve(code)});guard.once('error',error=>{ended=true;guardError+=String(error);resolve(1)});});
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Authored root/child readiness timeout')),10000);root.on('message',m=>{if(m.ready){report.ownedNode.childPid=m.childPid;clearTimeout(timer);resolve();}else if(m.error){clearTimeout(timer);reject(new Error(m.error));}});root.once('error',reject);});
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
    if(ended)throw new Error('Revised guard ended early: '+guardError);
    try{const record=JSON.parse((await readFile(guardPath,'utf8')).replace(/^\ufeff/,''));if(record.samples.length>=2){report.memoryGuard=record;break;}}catch(e){if(e.code!=='ENOENT')throw e;}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(report.memoryGuard?.samples.length>=2,'two real guarded samples');
  const sample=report.memoryGuard.samples.at(-1);
  for(const pid of [root.pid,report.ownedNode.childPid]){const entry=sample.ownedProcesses.find(x=>x.pid===pid);assert.ok(entry,'actual root/child discovered');assert.equal(entry.accountingStatus,'complete');assert.equal(entry.getProcessCimQuantumStartTime,entry.createdAt);assert.ok(entry.privateBytes>0);}
  assert.ok(sample.privateAccountingComplete);assert.ok(sample.ownedPrivateBytes<1024**3);
  report.status='passed-real-counter-and-exact-identity-probe';report.assertions=11;
}catch(error){report.status='failed-real-counter-probe';report.error=error.stack||String(error);}
finally{
  await writeFile(stopPath,'Close tiny owned guard fixture.\n');report.guardExitCode=await guardExit;
  if(root.connected)root.send({close:true});
  await Promise.race([rootExit,new Promise(r=>setTimeout(r,3000))]);
  // Recorded identity cleanup runs even after root exit, catching its surviving recorded child.
  try{await ps(['-File',path.join(qa,'resource-guard-v3.ps1'),'-OwnedRootPid',String(root.pid),'-ExpectedProfile',token,'-OutputPath',path.join(output,'cleanup.json'),'-StopPath',stopPath,'-RecordedGuardPath',guardPath,'-CloseOwned']);}catch(e){report.cleanupError=String(e);}
  try{await ps(['-File',path.join(qa,'verify-teardown-v3.ps1'),'-GuardPath',guardPath,'-CleanupPath',path.join(output,'cleanup.json'),'-OutputPath',path.join(output,'teardown.json')]);report.teardown=JSON.parse((await readFile(path.join(output,'teardown.json'),'utf8')).replace(/^\ufeff/,''));}catch(e){report.teardownError=String(e);}
  try{report.memoryGuard=JSON.parse((await readFile(guardPath,'utf8')).replace(/^\ufeff/,''));}catch(e){report.guardReadError=String(e);}
  if(report.status.startsWith('passed')&&(!report.teardown?.allRecordedOwnedProcessesExited||report.guardExitCode!==0||report.memoryGuard.status!=='completed'))report.status='failed-guard-or-teardown';
  report.rootStderr=rootError;report.guardStderr=guardError;report.finishedAt=new Date().toISOString();await save();
}
console.log(JSON.stringify({status:report.status,output,ownedNode:report.ownedNode,guardExitCode:report.guardExitCode,teardown:report.teardown?.allRecordedOwnedProcessesExited}));
if(!report.status.startsWith('passed'))process.exitCode=1;
