import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const build=path.resolve(root,'../engine-build');
const link=JSON.parse(fs.readFileSync(path.join(build,'logs/link-engine.log'),'utf8').split('\n',1)[0]);
const manifest=JSON.parse(fs.readFileSync(path.join(build,'build-manifest.json'),'utf8'));
if(link.args.filter(a=>a==='-Os').length!==1)throw new Error('Expected one link Os argument');
const proposed=[...link.args];
proposed[proposed.indexOf('-Os')]='-O1';
const out=proposed.indexOf('-o');
if(out<0||out===proposed.length-1)throw new Error('Expected output option');
proposed[out+1]=path.join(root,'proposed-output/cataclysm-tiles.js');
const result={status:'SOURCE_ONLY_PLAN_NOT_EXECUTED',generatedUTC:new Date().toISOString(),
  tool:link.tool,currentArguments:link.args,proposedArguments:proposed,
  exactDifferences:[{old:'-Os',proposed:'-O1',reason:'Emscripten link-only level; conservative Asyncify retained'},
    {old:link.args[out+1],proposed:proposed[out+1],reason:'Isolated output; retain existing active artifacts'}],
  preservedEnvironment:{EMCC_CORES:link.EMCC_CORES,EMCC_BATCH_BUILD:link.EMCC_BATCH_BUILD,BINARYEN_CORES:link.BINARYEN_CORES},
  sourceCommit:manifest.upstreamCommit,objectCount:manifest.cppSources.length+manifest.cSources.length,
  objectResponse:{path:link.args[0].slice(1),sha256:crypto.createHash('sha256').update(fs.readFileSync(link.args[0].slice(1))).digest('hex')},
  compileFlagsUnchanged:manifest.commonFlags,
  preservedSemanticsSettings:['-sASYNCIFY','-fexceptions','-lidbfs.js','-sFORCE_FILESYSTEM','-lembind','-sASYNCIFY_STACK_SIZE=16384','-sSTACK_SIZE=262144','-sWASM_BIGINT'],
  noOverrideOf:['ASYNCIFY_ONLY','ASYNCIFY_REMOVE','ASYNCIFY_ADD','ASYNCIFY_IGNORE_INDIRECT'],
  limitations:['Candidate not launched or benchmarked.','Actual generated Binaryen/JS flags must be captured from candidate invocation.','No full browser/callback/save/control validation for this candidate.','Requires parent coordinated resource window and preservation decision; not a command to run concurrently.']};
for(const required of result.preservedSemanticsSettings)if(!proposed.includes(required))throw new Error('Missing required setting '+required);
fs.writeFileSync(path.join(root,'candidate-link-diff.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,objectCount:result.objectCount,exactDifferences:result.exactDifferences}));
