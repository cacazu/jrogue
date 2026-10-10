import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),task=path.dirname(here);
const source=process.argv[2];if(!source)throw Error('pristine upstream path required');
const sha=b=>createHash('sha256').update(b).digest('hex');
const priorFile=path.join(task,'integration-overlay/build-plan/cpp-compile/compile-plan.json');
const priorBytes=await readFile(priorFile),prior=JSON.parse(priorBytes);
const prepBytes=await readFile(path.join(here,'SOURCE-PREPARATION.json')),prep=JSON.parse(prepBytes);
assert.equal(prep.source_commit,prior.sourceCommit);
const sourcePins=[];
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,entry.name),s=await lstat(f);if(s.isSymbolicLink())throw Error('source symlink rejected');if(s.isDirectory())await scan(f);else if(s.isFile()){const b=await readFile(f);sourcePins.push({file:path.relative(source,f).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)});}else throw Error('non-regular source rejected');}}
await scan(path.join(source,'src'));sourcePins.sort((a,b)=>a.file.localeCompare(b.file,'en'));
const headers=['src/input.h','src/input_context.h','src/help.h'];
const impacted=[];const dependencyPins=[];
for(const file of (await readdir(path.join(task,'engine-build/objects'))).filter(f=>f.endsWith('.d')).sort()){
  const b=await readFile(path.join(task,'engine-build/objects',file)),normal=b.toString('utf8').replaceAll('\\','/');
  const matches=headers.filter(header=>normal.includes('/'+header));
  if(matches.length){impacted.push({unit:file.replace(/\.d$/,'.cpp'),changed_headers:matches});dependencyPins.push({file:'engine-build/objects/'+file,bytes:b.length,sha256:sha(b)});}
}
const build=path.join(here,'build');await mkdir(build,{recursive:true});
const config=await readFile(prior.frozenSDK.config.path);assert.equal(sha(config),prior.frozenSDK.config.sha256);await writeFile(path.join(build,'.emscripten'),config);
const staged=path.join(build,'sources/src');const identity='cdda-semantic-help-compilecheck-v1-'+prep.patch_sha256.slice(0,20)+'-sdk6.0.8';
const parentCommand=prior.commands[0];const baseFlags=[];
for(let i=0;i<parentCommand.argv.length;i++){
  const arg=parentCommand.argv[i];if(i===0||arg==='-v')continue;
  if(arg.startsWith('-I')&&(arg.includes('sources')||arg.endsWith('/src')))continue;
  if(arg.startsWith('-DCDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID='))continue;
  if(arg==='-MMD'||arg==='-MP'||arg==='-c')break;
  baseFlags.push(arg);
}
const environment={...parentCommand.environment,EM_CONFIG:path.join(build,'.emscripten')};
const commands=['help.cpp','input.cpp','input_context.cpp','cdda_help_semantic.cpp','cdda_help_transport.cpp'].map(file=>({stage:'compile-'+file.replace('.cpp',''),executable:parentCommand.executable,argv:[parentCommand.argv[0],'-v','-I'+staged,...baseFlags,'-DCDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID="'+identity+'"','-MMD','-MP','-c',path.join(staged,file),'-o',path.join(build,'objects',file.replace('.cpp','.o'))],cwd:build,environment,outputObject:path.join(build,'objects',file.replace('.cpp','.o')),outputDependencyFile:path.join(build,'objects',file.replace('.cpp','.d')),scope:'Original consumer/module compilation only; no original lookup/loader execution or game acceptance'}));
const inheritedProtected=prior.protectedFiles;
const plan={schemaVersion:1,status:'source-prepared-not-runnable-until-staging-and-owner-review',sourceCommit:prep.source_commit,browserRecoveryHasPriority:true,compilerExecuted:false,CargoExecuted:false,browserExecuted:false,commands,buildIdentity:identity,
  preparation:{bytes:prepBytes.length,sha256:sha(prepBytes)},priorReviewedCompilePlan:{path:priorFile,bytes:priorBytes.length,sha256:sha(priorBytes)},
  sourceStaging:{destination:staged,required:true,performed:false,policy:'Copy every pinned src member into a new owned tree; validate originals then replace exact 11 generated source/header members. All quoted sibling headers resolve within this coherent tree; never mix original class headers via a lone -I overlay.',sourceFiles:sourcePins.length,sourceBytes:sourcePins.reduce((n,f)=>n+f.bytes,0),pins:sourcePins,generatedFiles:prep.files.filter(f=>f.file.startsWith('generated/src/'))},
  configuration:{path:path.join(build,'.emscripten'),bytes:config.length,sha256:sha(config),frozenCache:true},
  inheritedProtectedFiles:inheritedProtected,frozenSDK:prior.frozenSDK,installedTools:prior.installedTools,launchGate:prior.launchGate,ownedResourceGuard:prior.ownedResourceGuard,guard:prior.guard,removeInheritedEnvironment:prior.removeInheritedEnvironment,rustEnvironment:{},
  runnerBinding:{accepted:false,required:'Use unchanged fixed run_owned wrapper 0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb and inherited same-buffer CPP2 owner loader; adapt only staged plan/command paths. Independent owner/plan validation plus root single-window release before any command.'},
  syntheticModuleExecution:{fixture:'fixtures/transport.cpp',status:'source-only',steps:['Compile actual cdda_help_transport.cpp and synthetic fixture with coherent semantic/input enum headers','Mainless O0 Node WASM link with frozen exception SDK variant, exact four snapshot exports plus cdda_help_fixture_run','Execute prepared native assertions once and preserve raw serializer bytes for real existing Rust parse_owned_help/render_help tests'],originalProducerExecuted:false},
  fullRelinkClosure:{originalHeaderChanges:headers,existingAffectedUnits:impacted.length,units:impacted,actualBaselineDependencyPins:dependencyPins,newUnits:['cdda_help_semantic.cpp','cdda_help_transport.cpp'],policy:'Rebuild all units in actual dependency closure with coherent headers and coordinated live-input merge. Old class-layout-dependent objects are invalid. New MMD dependency evidence can expand this closure.'},
  realProducerExecution:{status:'not-yet-command-complete',blockingDependencies:['Original input/name tables, original JsonObject/translation/path factories and help loader must be linked without synthetic replacements','Shared input_context semantic and live-wait hooks need exact coordinated merge','Native short/long key-description rendering and nested key-edit republish remain required','Full original producer trace must compare turn/RNG/native English and current immutable records before live Rust/browser acceptance'],proposedChecks:['Actual official Movement and keybinding owner loading, changed/mod owner remains legacy','Current binding preference/empty-local/default precedence observed through original input_context','Original selected help construction and unavailable exit produce exact owned records','Allocation failure at unavailable/build-id construction invalidates through failure sink']},
  actualProducerConnected:false,actualRustAcceptance:false,wholeGameSemanticMigrationComplete:false};
await writeFile(path.join(here,'FOCUSED-COMPILE-PLAN.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({status:plan.status,commands:commands.length,sourceFiles:sourcePins.length,sourceBytes:plan.sourceStaging.sourceBytes,affectedOriginalCppUnits:impacted.length,compilerExecuted:false}));
