import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const directory=path.dirname(fileURLToPath(import.meta.url)),qa=path.dirname(directory);
const output=path.join(directory,'output',new Date().toISOString().replaceAll(':','-').replaceAll('.','-'));await mkdir(output,{recursive:true});
const stamp='2026-10-02T12:00:00.1234560Z',later='2026-10-02T12:00:01.1234560Z',earlier='2026-10-02T11:59:59.1234560Z';
const root={pid:100,parentPid:1,createdAt:stamp,commandLine:'mock --user-data-dir=mock-profile'},child={pid:101,parentPid:100,createdAt:later,commandLine:'mock --type=renderer'};
let assertions=0;const results=[];
function check(condition,message){assert.ok(condition,message);assertions++;}
async function run(name,fixture,record=null,cleanup=null){
  const fixturePath=path.join(output,name+'.fixture.json'),resultPath=path.join(output,name+'.result.json');
  await writeFile(fixturePath,JSON.stringify(fixture,null,2)+'\n',{flag:'wx'});
  const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(directory,'mock-os.ps1'),'-FixturePath',fixturePath,'-OutputPath',resultPath,'-ProductionPath',path.join(qa,fixture.operation==='verify'?'verify-teardown-v2.ps1':'resource-guard-v2.ps1')];
  if(record){const rp=path.join(output,name+'.guard-record.json');await writeFile(rp,JSON.stringify(record)+'\n',{flag:'wx'});args.push('-GuardRecordPath',rp);}
  if(cleanup){const cp=path.join(output,name+'.cleanup-record.json');await writeFile(cp,JSON.stringify(cleanup)+'\n',{flag:'wx'});args.push('-CleanupRecordPath',cp);}
  const p=spawn('powershell.exe',args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  const exitCode=await new Promise((r,j)=>{p.on('exit',r);p.on('error',j)});
  let data;try{data=JSON.parse((await readFile(resultPath,'utf8')).replace(/^\ufeff/,''));}catch(e){throw new Error(name+' missing result: '+stderr+' '+e);}
  let stops=[];try{const s=JSON.parse((await readFile(resultPath+'.stops.json','utf8')).replace(/^\ufeff/,''));stops=Array.isArray(s)?s:[s];}catch(e){if(e.code!=='ENOENT')throw e;}
  results.push({name,exitCode,status:data.status||'verification',stdout,stderr,resultPath,stops});return {exitCode,data,stops};
}
const normal={initialRoot:root,snapshots:[[root,child]],metrics:[],stopImmediately:true};
for(const kind of ['null-private','private-throws','throw','start-mismatch']){
  const r=await run('live-'+kind,{...normal,metrics:[{pid:101,kind}]});
  check(r.exitCode===2,'live '+kind+' must abort');check(r.data.status==='incomplete-private-accounting','distinct accounting failure');check(!r.data.samples[0].privateAccountingComplete,'no false complete aggregate');check(r.stops.includes(100)&&r.stops.includes(101),'only original owned cleanup requested');
  if(kind==='start-mismatch')check(r.data.samples[0].ownedProcesses[1].getProcessStartTime==='2026-10-02T12:00:01.1234561Z','100ns mismatch recorded without tolerance');
}
for(const replacement of [null,{...child,createdAt:'2026-10-02T12:00:02.1234560Z'}]){
 const r=await run(replacement?'reused-during-sample':'exited-during-sample',{...normal,races:[{pid:101,replacement}]});check(r.exitCode===0,'exit/reuse benign');check(r.data.samples[0].privateAccountingComplete,'all live identities accounted');check(r.data.samples[0].ownedProcesses[1].accountingStatus==='exited-or-pid-reused-during-sample','race recorded');check(r.data.samples[0].ownedPrivateBytes===50000000,'reused process never substituted');
}
{
 const r=await run('root-reused-at-enumeration',{...normal,snapshots:[[{...root,createdAt:later},child]]});check(r.exitCode===1,'root reuse fails closed');check(r.data.samples.length===0,'unrelated tree never sampled');check(r.stops.length===0,'reused root and unproven child never stopped');check(r.data.cleanupChecks[0].status==='pid-reused-not-stopped','original identity checked');
}
{
 const r=await run('child-predates-parent',{...normal,snapshots:[[root,{...child,createdAt:earlier}]]});check(r.exitCode===0,'normal root monitor succeeds');check(r.data.recordedOwnedIdentities.length===1,'stale ParentPID child excluded');
}
{
 const r=await run('root-exit-descendant-survives',{...normal,stopImmediately:false,stopAfterGeneration:1,snapshots:[[root,child],[child]]});check(r.data.samples.length===2,'child sampled after root exit');check(r.data.samples[1].ownedProcessIds.includes(101),'earlier descendant remains live ledger');check(r.data.recordedOwnedIdentities.length===2,'root+descendant retained');
 const closed=await run('close-surviving-descendant',{operation:'close',snapshots:[[child]]},r.data);check(closed.stops.includes(101)&&!closed.stops.includes(100),'close exact child after root gone');
}
{
 const r=await run('optional-errors-cap',{...normal,snapshots:[[root]],metrics:[{pid:100,kind:'optional-throws',privateBytes:1073741825}]});check(r.exitCode===2,'valid private enforces cap despite optional errors');check(r.data.samples[0].privateAccountingComplete,'optional errors preserve complete private');check(r.data.samples[0].ownedPrivateBytes===1073741825,'valid private preserved');check(r.data.samples[0].ownedProcesses[0].optionalMetricErrors.length===3,'optional errors separately recorded');check(r.data.stopReasons.includes('owned-private-cap'),'precise cap reason');
}
const recorded={ownedRootPid:100,profile:'mock-profile',rootCreatedAt:stamp,samples:[{ownedProcesses:[{pid:100,createdAt:stamp},{pid:101,createdAt:later}]},{ownedProcesses:[{pid:100,createdAt:stamp}]}]};
{
 const r=await run('snapshot-missing-live-root',{...normal,snapshots:[[child]],alwaysLiveOverrides:[root]});check(r.exitCode===1&&r.data.status==='guard-error','snapshot inconsistency aborts');check(r.data.samples.length===0,'no false tree-exit sample');check(r.data.recordedOwnedIdentities.length===1,'no unverified child adopted');
 const p=await run('parent-disappears-during-discovery',{...normal,filterDisappearAfter:{pid:100,call:3}});check(p.exitCode===1,'parent recheck loss aborts');check(p.data.recordedOwnedIdentities.length===1,'unverified child omitted from cleanup ledger');check(!p.stops.includes(101),'unverified child not stopped');
 const c=await run('identity-recheck-unreadable',{...normal,races:[{pid:101,throwOnRead:true}]});check(c.exitCode===1&&c.data.status==='guard-error','unreadable identity aborts');check(c.data.cleanupChecks.some(x=>x.pid===101&&x.status==='cleanup-read-or-stop-error'),'indeterminate cleanup not silently passed');
 const bad=await run('verify-nonpositive-root',{operation:'verify',snapshots:[[]]},{ownedRootPid:0,rootCreatedAt:stamp,samples:[]});check(!bad.data.allRecordedOwnedProcessesExited,'nonpositive root cannot produce empty-ledger pass');
}
{
 const r=await run('close-reused-recorded-child',{operation:'close',snapshots:[[{...child,createdAt:'2026-10-02T12:00:02.1234560Z'}]]},recorded);check(!r.stops.includes(101),'reused cleanup pid not stopped');check(r.data.cleanupChecks.some(c=>c.pid===101&&c.status==='pid-reused-not-stopped'),'reuse cleanup evidence');
 const verify=await run('verify-earlier-child',{operation:'verify',snapshots:[[child]]},recorded);check(verify.data.checkedIdentities.length===2,'all sample union');check(!verify.data.allRecordedOwnedProcessesExited&&verify.data.remaining[0].pid===101,'earlier live child prevents false teardown');
 const zero=await run('verify-zero-sample-live-root',{operation:'verify',snapshots:[[root]]},{...recorded,samples:[]});check(zero.data.checkedIdentities.length===1,'zero-sample original root examined');check(!zero.data.allRecordedOwnedProcessesExited,'live root no false pass');
 const missing=await run('verify-missing-root-identity',{operation:'verify',snapshots:[[]]},{ownedRootPid:100,profile:'mock-profile',samples:[]});check(!missing.data.allRecordedOwnedProcessesExited,'missing identity is unverified');
 const extra={recordedOwnedIdentities:[{pid:102,createdAt:later}]};const v=await run('verify-cleanup-union',{operation:'verify',snapshots:[[{...child,pid:102}]]},recorded,extra);check(v.data.checkedIdentities.length===3,'cleanup identities included');check(!v.data.allRecordedOwnedProcessesExited,'cleanup live child prevents false pass');
 const close=await run('close-without-record',{operation:'close',snapshots:[[root,child]]});check(close.exitCode===1&&close.stops.length===0,'no fresh profile-only cleanup');
}
const artifacts=[];for(const name of ['resource-guard-v2.ps1','owned-identities.ps1','verify-teardown-v2.ps1','session.mjs']){const bytes=await readFile(path.join(qa,name));artifacts.push({path:'browser-qa/'+name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await writeFile(path.join(output,'report.json'),JSON.stringify({checkedAt:new Date().toISOString(),scope:'Production guard control flow under mocked OS only; no Chrome/compiler/native process inspection or stop',assertions,cases:results.length,results,artifacts},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'passed-mocked-guard-regressions',assertions,cases:results.length,output}));
