import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const baseCandidateRoot=path.join(root,'candidates','o1-conservative-asyncify');
const candidateRoot=process.argv[3]?path.resolve(process.argv[3]):baseCandidateRoot;
if(candidateRoot!==baseCandidateRoot&&candidateRoot!==path.join(baseCandidateRoot,'attempts','attempt-2'))throw new Error('Unapproved candidate directory');
const read=name=>JSON.parse(fs.readFileSync(path.join(candidateRoot,name),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hashFile=file=>hash(fs.readFileSync(file));
if(process.argv[2]!=='--execute')throw new Error('Explicit --execute required');
const candidate=read('link-candidate.json'),gate=read('launch-gate.json');
if(!gate.passed||gate.physicalFreeBytes<4294967296||gate.commitHeadroomBytes<6442450944||Date.now()-Date.parse(gate.timestampUtc)>15000)throw new Error('Fresh 4 GiB physical/6 GiB exact-commit launch gate missing');
const lock=path.join(candidateRoot,'candidate-started.flag');fs.writeFileSync(lock,new Date().toISOString(),{flag:'wx'});
const response=candidate.argv.find(arg=>arg.startsWith('@')).slice(1),responseBytes=fs.readFileSync(response);
if(hash(responseBytes)!==candidate.source.responseSha256)throw new Error('Candidate object response changed');
const objects=responseBytes.toString('utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
if(objects.length!==438||objects.some(file=>!fs.existsSync(file)))throw new Error('Whole-engine object set unavailable');
if(!candidate.argv.includes('-O1')||candidate.argv.includes('-Os')||!candidate.argv.includes('-sASYNCIFY')||candidate.argv.some(arg=>/ASYNCIFY_(IGNORE_INDIRECT|ONLY|REMOVE|ADD|IMPORTS)/.test(arg)))throw new Error('Reviewed conservative Asyncify flags changed');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'build-manifest.json'),'utf8'));
const results=JSON.parse(fs.readFileSync(path.join(root,'compile-results.json'),'utf8'));
const latest=new Map(results.map(result=>[result.source,result]));
const sources=[...manifest.cppSources,...manifest.cSources];
if(sources.length!==438||sources.some(source=>latest.get(source)?.code!==0))throw new Error('438 successful source results required');
const env={...process.env,...candidate.environmentOverrides};
for(const name of [...candidate.unsetEnvironment,'BINARYEN_PASS_DEBUG'])delete env[name];
const startedUtc=new Date().toISOString(),events=[];
const event=(name,data={})=>{events.push({timestampUtc:new Date().toISOString(),name,...data});fs.writeFileSync(path.join(candidateRoot,'stage-events.json'),JSON.stringify(events,null,2)+'\n');};
const runConfig={...candidate,status:'running',startedUtc,rootNodePid:process.pid,launchGate:gate,
  parentAuthorization:candidate.parentAuthorization||'Parent explicitly authorizes ONE same-object em++ LINK -O1 conservative Asyncify candidate while original PID39680/session4939 remain untouched. Launch 4GiB physical/6GiB exact commit. Guard every5s: stop ONLY candidate if physical or commit<2GiB or candidate private>4GiB. No JSPI, pass-debug, source/object edits or accepted-path replacement before real-game QA.',
};
fs.writeFileSync(path.join(candidateRoot,'run-config.json'),JSON.stringify(runConfig,null,2)+'\n');
const active=path.join(candidateRoot,'monitor-active.flag');fs.writeFileSync(active,'active\n');
const psQuote=value=>"'"+value.replaceAll("'","''")+"'";
const monitorCommand='& {\n'+fs.readFileSync(path.join(root,'monitor-candidate.ps1'),'utf8')+'\n} -CandidateRootPid '+process.pid+' -OriginalPid 39680 -RunDirectory '+psQuote(candidateRoot);
const monitor=spawn('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-Command',monitorCommand],{windowsHide:true,stdio:['ignore','ignore','pipe']});
monitor.stderr.on('data',data=>fs.appendFileSync(path.join(candidateRoot,'monitor-stderr.log'),data));
const monitorDone=new Promise(resolve=>{monitor.on('exit',resolve);monitor.on('error',error=>{fs.writeFileSync(path.join(candidateRoot,'monitor-error.json'),JSON.stringify({error:String(error)}));resolve(-1);});});
const logPath=path.join(candidateRoot,'link-engine.log'),log=fs.createWriteStream(logPath);
log.write(JSON.stringify({executable:candidate.executable,args:candidate.argv,cwd:candidate.cwd,environmentOverrides:candidate.environmentOverrides})+'\n');
const start=Date.now();event('emcc-driver-starting',{executable:candidate.executable,argv:candidate.argv});
const child=spawn(candidate.executable,candidate.argv,{cwd:candidate.cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
event('emcc-driver-spawned',{pythonPid:child.pid});console.log(JSON.stringify({status:'candidate-started',rootNodePid:process.pid,pythonPid:child.pid,startedUtc,outputDirectory:path.join(candidateRoot,'output'),gate}));
child.stdout.on('data',data=>log.write(data));child.stderr.on('data',data=>log.write(data));
let monitorFailsafe=false;
const guardTimer=setInterval(()=>{if(fs.existsSync(path.join(candidateRoot,'monitor-error.json'))&&!monitorFailsafe&&child.exitCode===null){monitorFailsafe=true;event('monitor-failed',{path:path.join(candidateRoot,'monitor-error.json')});spawn('C:/Windows/System32/taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}},1000);
const code=await new Promise(resolve=>{child.on('close',resolve);child.on('error',error=>{log.write(String(error));resolve(-1);});});
clearInterval(guardTimer);event('emcc-driver-exit',{code,elapsedSeconds:(Date.now()-start)/1000});
await new Promise(resolve=>log.end(resolve));fs.unlinkSync(active);await monitorDone;
const constraint=fs.existsSync(path.join(candidateRoot,'constraint-triggered.json'));
const monitorFailed=fs.existsSync(path.join(candidateRoot,'monitor-error.json'));
const outcome={result:constraint?'resource-constraint':monitorFailed?'monitor-failure':code===0?'link-completed':'link-failed',code,startedUtc,completedUtc:new Date().toISOString(),elapsedSeconds:(Date.now()-start)/1000,attemptNumber:candidate.attemptNumber||1,originalProcessState:candidate.originalProcessState||'running-preserved',originalArtifactsPreserved:true};
fs.writeFileSync(path.join(candidateRoot,'candidate-outcome.json'),JSON.stringify(outcome,null,2)+'\n');
console.log(JSON.stringify({terminal:outcome}));
if(code!==0||constraint||monitorFailed){process.exitCode=1;console.log(fs.readFileSync(logPath,'utf8').slice(-4000));}
else {
  const output=candidate.argv[candidate.argv.indexOf('-o')+1],wasm=output.replace(/\.js$/,'.wasm');
  const syntax=spawnSync(process.execPath,['--check',output],{encoding:'utf8',windowsHide:true});
  if(syntax.status!==0||!WebAssembly.validate(fs.readFileSync(wasm)))throw new Error('Candidate JS/WASM validation failed');
  const logText=fs.readFileSync(logPath,'utf8');
  const archives=[...new Set([...logText.matchAll(/([^\r\n]+?\.a)(?:\(|\r?$)/gm)].map(match=>match[1].trim()).filter(file=>fs.existsSync(file)))].map(file=>({path:file,bytes:fs.statSync(file).size,sha256:hashFile(file)}));
  if(!archives.length)throw new Error('Actual SDK archive trace missing');
  fs.writeFileSync(path.join(candidateRoot,'used-sdk-archives.json'),JSON.stringify({linkResult:code,archives},null,2)+'\n');
  const artifacts=[wasm,output].map(file=>({path:file,bytes:fs.statSync(file).size,sha256:hashFile(file)}));
  const provenance=JSON.parse(fs.readFileSync(path.join(root,'dependency-provenance.json'),'utf8'));
  if(provenance.length!==7||provenance.some(port=>!port.officialRecipeChecksumMatches))throw new Error('Official port checksum provenance incomplete');
  const evidence={schemaVersion:1,result:'pass',full_engine:true,generatedUtc:new Date().toISOString(),
    scope:'Entire original C++/SDL engine local reference milestone linked -O1 with conservative Asyncify; no completed Rust or semantic port claim.',
    milestone:'local-original-engine-reference',completePort:false,runtimeBrowserVerified:false,
    completionTarget:'HTML/browser and Node localhost verification only; no external publication.',
    upstream:{commit:manifest.upstreamCommit,tag:manifest.upstreamTag},sourceUnits:{cxx:manifest.cppSources.length,c:manifest.cSources.length,total:438,successful:438,unresolved:0},
    compiler:{officialRecipe:manifest.officialCompiler,installedUsed:manifest.actualCompiler,binaryen:'132 (version_132-16-g89a81ef9b)'},artifacts,
    buildManifestSha256:hashFile(path.join(root,'build-manifest.json')),linkOptimization:'-O1',launchGate:gate,outcome,
    checks:{wholeEngineCompilation:'pass',link:'pass',wasmBinaryValidation:'pass',generatedJavascriptSyntax:'pass',officialPortArchiveSha512:{passed:7,total:7},actualArchiveTraceCount:archives.length},
    actualLinkLogPath:logPath,provenanceHashes:{candidateConfigSha256:hashFile(path.join(candidateRoot,'link-candidate.json')),objectsResponseSha256:hashFile(response),runConfigSha256:hashFile(path.join(candidateRoot,'run-config.json')),emscriptenConfigSha256:hashFile(candidate.environmentOverrides.EM_CONFIG),actualLinkLogSha256:hashFile(logPath)},
    pending:['Real browser startup, callback/yield paths, complete gameplay, PC/mobile input and save/resume verification.','Gameplay/font/tile/Japanese MO packaging.','Rust presentation/input/platform and semantic JSON boundary integration.'],
    notes:['Same 438 existing -Os compiled source objects; only link optimization changed.','Original process state: '+outcome.originalProcessState+'. Pristine upstream/source/object and recovery artifacts preserved.','Sampled resource guard covers only candidate descendants and can stop only that candidate.'],
  };
  const evidenceDir=path.join(candidateRoot,'evidence');fs.mkdirSync(evidenceDir,{recursive:true});const evidencePath=path.join(evidenceDir,'full-engine-build.json');fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({evidence:evidencePath,artifacts}));
}
