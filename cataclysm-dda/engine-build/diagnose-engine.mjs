import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Structural inspection only: never instantiate or optimize the module.
const root=path.dirname(fileURLToPath(import.meta.url));
const wasmPath=path.join(root,'output','cataclysm-tiles.wasm');
const bytes=fs.readFileSync(wasmPath);
if(bytes.subarray(0,8).toString('hex')!=='0061736d01000000')throw new Error('Unexpected WASM header');
const reader=(start,end=bytes.length)=>({p:start,end});
function byte(r){if(r.p>=r.end)throw new Error('Unexpected section end');return bytes[r.p++];}
function uleb(r){let value=0,shift=0,b;do{b=byte(r);value+=(b&127)*2**shift;shift+=7;if(shift>56)throw new Error('Oversized LEB');}while(b&128);return value;}
function sleb(r){while(byte(r)&128){} }
function str(r){const size=uleb(r),end=r.p+size;if(end>r.end)throw new Error('Invalid string');const value=bytes.toString('utf8',r.p,end);r.p=end;return value;}
function refType(r){const value=byte(r);if(value===0x63||value===0x64)sleb(r);return value;}
function limits(r){const flags=uleb(r),min=uleb(r),max=flags&1?uleb(r):undefined;return{flags,min,...(max===undefined?{}:{max})};}
function table(r){return{referenceType:refType(r),...limits(r)};}
function expr(r){for(;;){const op=byte(r);if(op===0x0b)return;if(op===0x41||op===0x42||op===0xd0)sleb(r);else if(op===0x23||op===0xd2)uleb(r);else if(op===0x43)r.p+=4;else if(op===0x44)r.p+=8;else throw new Error('Unsupported const-expression opcode '+op);}}
const imports=[],tables=[],memories=[],exports=[],sections=[],bodies=[],names=new Map(),elementCounts=[];
const functionsInTable=new Set();
let importedFunctions=0,definedFunctions=0,typeCount=0;
const moduleReader=reader(8);
while(moduleReader.p<moduleReader.end){
  const id=byte(moduleReader),size=uleb(moduleReader),start=moduleReader.p,end=start+size;
  if(end>bytes.length)throw new Error('Invalid section size');
  const r=reader(start,end);sections.push({id,bytes:size});
  if(id===0){
    const customName=str(r);sections.at(-1).customName=customName;
    if(customName==='name')while(r.p<r.end){const kind=byte(r),subsize=uleb(r),subend=r.p+subsize;
      if(kind===1){const count=uleb(r);for(let i=0;i<count;i++)names.set(uleb(r),str(r));}r.p=subend;}
  }else if(id===1)typeCount=uleb(r);
  else if(id===2){const count=uleb(r);for(let i=0;i<count;i++){
    const module=str(r),name=str(r),kind=byte(r),entry={module,name,kind};
    if(kind===0){entry.typeIndex=uleb(r);entry.functionIndex=importedFunctions++;}
    else if(kind===1){entry.table=table(r);tables.push({...entry.table,imported:true,module,name});}
    else if(kind===2){entry.memory=limits(r);memories.push({...entry.memory,imported:true,module,name});}
    else if(kind===3){refType(r);byte(r);}
    else if(kind===4){byte(r);uleb(r);}
    else throw new Error('Unsupported import kind '+kind);
    imports.push(entry);
  }}else if(id===3)definedFunctions=uleb(r);
  else if(id===4){const count=uleb(r);for(let i=0;i<count;i++)tables.push({...table(r),imported:false});}
  else if(id===5){const count=uleb(r);for(let i=0;i<count;i++)memories.push({...limits(r),imported:false});}
  else if(id===7){const count=uleb(r);for(let i=0;i<count;i++)exports.push({name:str(r),kind:byte(r),index:uleb(r)});}
  else if(id===9){const count=uleb(r);for(let i=0;i<count;i++){
    const flags=uleb(r);let tableIndex=0;
    if(flags===0||flags===4)expr(r);
    else if(flags===2||flags===6){tableIndex=uleb(r);expr(r);}
    if(flags===1||flags===2||flags===3)byte(r);
    else if(flags===5||flags===6||flags===7)refType(r);
    const entries=uleb(r);
    if(flags<=3)for(let j=0;j<entries;j++)functionsInTable.add(uleb(r));
    else for(let j=0;j<entries;j++)expr(r);
    elementCounts.push({flags,tableIndex,entries});
  }}else if(id===10){const count=uleb(r);for(let i=0;i<count;i++){
    const size=uleb(r);bodies.push({functionIndex:importedFunctions+i,bodyBytes:size});r.p+=size;if(r.p>end)throw new Error('Invalid code body');
  }}
  moduleReader.p=end;
}
if(bodies.length!==definedFunctions)throw new Error('Function/code count mismatch');
const allResults=JSON.parse(fs.readFileSync(path.join(root,'compile-results.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'build-manifest.json'),'utf8'));
const sources=[...manifest.cppSources,...manifest.cSources],latest=new Map(allResults.map(result=>[result.source,result]));
const estimates=sources.map(source=>{const result=latest.get(source),stat=fs.statSync(result.logPath);
  return{source,code:result.code,durationMilliseconds:result.milliseconds,estimatedLaunchMs:stat.mtimeMs-result.milliseconds,logCompletedMs:stat.mtimeMs};});
const first=estimates.reduce((a,b)=>a.estimatedLaunchMs<b.estimatedLaunchMs?a:b);
const last=estimates.reduce((a,b)=>a.logCompletedMs>b.logCompletedMs?a:b);
const historicalDirs=fs.readdirSync(root).filter(name=>/without-legacy-macro/.test(name));
const priorResults=JSON.parse(fs.readFileSync(path.join(root,'compile-results-without-legacy-macro.json'),'utf8'));
const archivedObjects=fs.readdirSync(path.join(root,'objects-without-legacy-macro')).filter(name=>name.endsWith('.o'));
const probeLines=fs.readFileSync(path.join(root,'logs','probe-version.log'),'utf8').split(/\r?\n/);
const diagnosis={
  schemaVersion:1,generatedUtc:new Date().toISOString(),status:'active-optimizer-diagnosis',notCompletionEvidence:true,
  wasm:{path:wasmPath,bytes:bytes.length,sections,typeCount,importedFunctions,definedFunctions,
    totalFunctions:importedFunctions+definedFunctions,tableDefinitions:tables,elementSegments:elementCounts,
    distinctFunctionIndicesInIndexBasedElements:functionsInTable.size,memories,imports,exports,
    largestBodies:bodies.sort((a,b)=>b.bodyBytes-a.bodyBytes).slice(0,25).map(body=>({...body,name:names.get(body.functionIndex)})),
    instrumentedFunctionCount:'Unavailable: input is pre-optimization, current optimizer provides no pass progress.'},
  compilerTimings:{sourceUnits:sources.length,latestSuccessful:estimates.filter(item=>item.code===0).length,
    recordedAttempts:allResults.length,recordedFailedAttempts:allResults.filter(result=>result.code!==0).length,
    successfulUnitAccumulatedSeconds:estimates.reduce((sum,item)=>sum+item.durationMilliseconds,0)/1000,
    allRecordedAttemptsAccumulatedSeconds:allResults.reduce((sum,item)=>sum+(item.milliseconds||0),0)/1000,
    inferredFirstLaunchUtc:new Date(first.estimatedLaunchMs).toISOString(),firstSource:first.source,
    lastLogCompletedUtc:new Date(last.logCompletedMs).toISOString(),lastSource:last.source,
    inferredWallSpanSeconds:(last.logCompletedMs-first.estimatedLaunchMs)/1000,
    timestampLimitation:'Launch UTC was not explicitly recorded. First launch is inferred from final log mtime minus recorded unit duration; log flush adds a small unmeasured delay. Wall span includes pauses/retries and overlaps from up to two compiler workers.',
    priorIncompatibleMacroAttempts:{retainedArtifacts:historicalDirs,recordedAttempts:priorResults.length,
      successful:priorResults.filter(result=>result.code===0).length,
      archivedObjects:archivedObjects.length,extraUntimedProbeObjects:archivedObjects.length-priorResults.length,
      accumulatedSeconds:priorResults.reduce((sum,result)=>sum+(result.milliseconds||0),0)/1000,
      historicalWallSpan:'Not established: per-attempt launch timestamps and distinct historical logs were not retained.',
      note:'Separate earlier macro-incompatible attempts; their objects are excluded from the browser build. Extra version.o came from the separate probe.'},
    ports:{recordedGenerationLines:probeLines.filter(line=>/cache:INFO: generating port:/.test(line)),
      separatelyRecordedDurations:null,note:'Port logs show generation and completion but no timestamps or elapsed timings.'},
    postCompilationToLinkLaunchGapSeconds:(Date.parse('2026-10-02T15:17:58.9096822Z')-last.logCompletedMs)/1000,
    gapNote:'Known elapsed gap while waiting for resource availability; lightweight provenance/documentation also ran during this gap, so it is not all idle time.',
    nonBuildWork:'Research, documentation, provenance checks and waiting outside this compiler-log span were not timed; no fabricated total is provided.'},
  asyncifySettings:{includeList:null,excludeList:null,ignoreIndirect:false,
    addImports:'SDK default asyncify imports; exact live optimizer command is separately captured.',
    exposedCurrentPass:null,callGraphLimitation:'Table entries and default conservative indirect-call handling do not prove every function is instrumented. No instrumented-function count or healthy pass progress is observable.'},
};
const destination=path.join(root,'evidence','long-optimizer-diagnosis.json');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(diagnosis,null,2)+'\n');
console.log(JSON.stringify({evidence:destination,wasm:{bytes:bytes.length,typeCount,importedFunctions,definedFunctions,totalFunctions:importedFunctions+definedFunctions,tables,elementSegments:elementCounts,distinctTableFunctionIndices:functionsInTable.size,invokeImports:imports.filter(item=>/^invoke_/.test(item.name)).length,asyncImports:imports.filter(item=>/sleep|poll|sync|async|idb|fiber|await/.test(item.name))},compilerTimings:diagnosis.compilerTimings},null,2));
