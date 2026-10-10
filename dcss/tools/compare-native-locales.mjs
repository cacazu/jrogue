// Read-only paired native fixture evidence. Never loads a game or WASM module.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const startupFixture=require('./startup-fixture.cjs');
const {EXPECTED,TEXT}=startupFixture;
const promptCalls=receipt=>typeof startupFixture.promptCalls==='function' ? startupFixture.promptCalls(receipt) : receipt.formatCalls;
const PIN='1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const U64_MAX=(1n<<64n)-1n;
const FIELDS=['engine','x','y','hp','maxHp','turn','xl','branch','depth','seed','rng'];
const PHASES=['fresh','throwing','normal','wait','afterSave'];
const IDENTITY=['upstreamCommit','engineMode','manifestRuntime','runtimeMetadata','manifestSha256','artifacts','startupTextManifest'];
const hash=value=>typeof value==='string' && /^[0-9a-f]{64}$/.test(value);
function u64(value,label){
  assert.equal(typeof value,'string',label+' must retain decimal u64 precision');
  assert(/^(0|[1-9][0-9]*)$/.test(value),label+' must be canonical');
  const number=BigInt(value);assert(number<=U64_MAX,label+' exceeds u64');return number;
}
export function validateSnapshot(value,label){
  assert(value && typeof value==='object');
  assert.deepEqual(Object.keys(value).sort(),[...FIELDS].sort(),label+' observer schema changed; review every field before comparison');
  assert.equal(value.engine,'dcss-0.34.1');u64(value.seed,label+'.seed');
  for(const field of FIELDS.filter(name=>!['engine','seed','rng'].includes(name)))assert(Number.isSafeInteger(value[field]),label+'.'+field);
  assert.equal(value.rng.length,45,label+' requires all 45 ordered PCG streams');
  for(const [i,generator]of value.rng.entries()){
    assert.deepEqual(Object.keys(generator).sort(),['draws','sequence','state']);
    u64(generator.state,label+'.rng['+i+'].state');u64(generator.draws,label+'.rng['+i+'].draws');
    assert.equal(u64(generator.sequence,label+'.rng['+i+'].sequence')&1n,1n);
  }
  return value;
}
function logical(value){return {...value,rng:value.rng.map(({draws,...generator})=>generator)};}
function identity(value){
  const selected=Object.fromEntries(IDENTITY.map(key=>[key,value[key]]));
  assert.equal(selected.upstreamCommit,PIN);assert.equal(selected.engineMode,'jspi');
  assert.equal(selected.manifestRuntime,'jspi');assert(hash(selected.manifestSha256));
  assert.deepEqual(selected.startupTextManifest,EXPECTED,'The comparator requires the reviewed startup source/formatter candidate');
  assert.equal(selected.artifacts.length,3);
  assert.deepEqual(selected.artifacts.map(file=>file.name).sort(),['dcss.data','dcss.js','dcss.wasm']);
  selected.artifacts.forEach(file=>{assert(Number.isSafeInteger(file.bytes)&&file.bytes>0);assert(hash(file.sha256));});
  return selected;
}
function passReceipt(value,count){
  assert(!Object.hasOwn(value,'error'),'Failed runtime evidence cannot pass locale comparison');
  assert.equal(value.tests.length,count);value.tests.forEach(test=>assert.equal(test.pass,true,test.name));
  identity(value);
}
function startup(value,language,newCharacter){
  assert.equal(value.enabled,true);assert.equal(value.requestedLanguage,language);assert.equal(value.language,language);
  assert.equal(value.errors.length,0);assert.deepEqual(value.preflightLanguages,['en','ja']);
  assert(Number.isSafeInteger(value.formatCalls));
  const promptCount=promptCalls(value);assert(Number.isSafeInteger(promptCount)&&promptCount>=0);
  assert.equal(promptCount>0,newCharacter,'Only genuine weapon selection may construct its source prompt');
}
function frame(value,language){
  assert.equal(value.language,language);assert.equal(value.text,TEXT[language]);
  assert.equal(value.cellWidth,Array.from(TEXT[language]).length*(language==='ja'?2:1));assert.equal(value.cells.length,value.cellWidth);
  assert.equal(value.sourceColour,'CYAN');
}
function smoke(value,language){
  passReceipt(value,8);startup(value.startupText,language,true);frame(value.weaponPromptFrame,language);
  assert.equal(value.startup.weaponPromptSeen,true);assert.equal(value.startup.nativeLanguage,language);
  assert.deepEqual(Object.keys(value.gameplayTrace).sort(),[...PHASES].sort());
  PHASES.forEach(phase=>validateSnapshot(value.gameplayTrace[phase],language+'.smoke.'+phase));
  assert.deepEqual(value.gameplayTrace.wait,value.gameplayTrace.afterSave);
  assert.equal(value.gameplayTrace.fresh.turn,value.gameplayTrace.throwing.turn);
  assert.equal(value.gameplayTrace.throwing.turn,value.gameplayTrace.normal.turn);
  assert(value.gameplayTrace.wait.turn>value.gameplayTrace.normal.turn);
  for(const test of value.tests.filter(test=>test.redraws!==undefined))assert.equal(test.redraws,25);
  assert.equal(value.tests.filter(test=>test.redraws===25).length,3);
  const commands=value.tests.filter(test=>test.events!==undefined);
  assert.equal(commands.length,2);
  for(const test of commands){assert.equal(test.events.length,1);assert.equal(test.drawDeltas.length,45);test.drawDeltas.forEach(draw=>u64(draw,'command delta'));}
  return commands.map(test=>({events:test.events,drawDeltas:test.drawDeltas}));
}
function files(value){
  assert(Array.isArray(value));const paths=new Set();
  for(const file of value){
    assert(typeof file.path==='string'&&file.path.startsWith('/persist/'));
    assert(!paths.has(file.path));paths.add(file.path);
    assert(Number.isSafeInteger(file.bytes)&&file.bytes>=0);assert(hash(file.sha256));
  }
}
function resume(value,original,resumed){
  passReceipt(value,5);
  assert.deepEqual(value.localePlan,{original,resumed,crossLocale:original!==resumed});
  startup(value.startupText,original,true);startup(value.resumedStartupText,resumed,false);
  frame(value.startup.weaponFrame,original);
  assert.equal(value.startup.weaponPromptSeen,true);assert.equal(value.resumedStartup.weaponPromptSeen,false);
  assert.equal(value.phase,'resumed-complete');assert.equal(value.coordinator.sequential,true);
  assert.equal(value.coordinator.children.length,2);
  assert.deepEqual(value.coordinator.children.map(child=>child.nativeLanguage),[original,resumed]);
  assert.notEqual(value.coordinator.children[0].processId,value.coordinator.children[1].processId);
  assert.deepEqual(value.phases.map(phase=>phase.phase),['original-complete','resumed-complete']);
  for(const child of value.coordinator.children){assert.equal(child.exitCode,0);assert(child.execArgs.includes('--wasm-num-compilation-tasks=1'));assert(child.execArgs.includes('--experimental-wasm-jspi'));}
  for(const key of ['fresh','checkpoint','resumedState'])validateSnapshot(value[key],original+'->'+resumed+'.'+key);
  assert.deepEqual(logical(value.resumedState),logical(value.checkpoint));
  for(const key of ['continuationSnapshots','resumedContinuationSnapshots']){
    assert.equal(value[key].length,3);value[key].forEach((state,i)=>validateSnapshot(state,key+'['+i+']'));
  }
  assert.equal(value.continuation.length,3);
  value.continuationSnapshots.forEach((state,i)=>{
    assert.deepEqual(logical(state),value.continuation[i]);
    assert.deepEqual(logical(value.resumedContinuationSnapshots[i]),value.continuation[i]);
  });
  files(value.files);files(value.allNativeFiles);files(value.restoredFiles);
  assert.deepEqual(value.restoredFiles,value.files,'Each run must restore its own native bytes exactly');
  assert(value.files.some(file=>file.path.endsWith('.cs')&&file.bytes>0));
  const caches=value.regenerableCaches;files(caches.files);files(caches.regeneratedFiles);
  assert.equal(caches.hashesComparedOnRegeneration,false);
  assert.deepEqual([...value.files,...caches.files].sort((a,b)=>a.path.localeCompare(b.path)),value.allNativeFiles);
  assert(caches.files.some(file=>file.path.startsWith('/persist/saves/db/')&&file.bytes>0));
  assert(caches.files.some(file=>file.path.startsWith('/persist/saves/des/')&&file.bytes>0));
  for(const old of caches.files){const regenerated=caches.regeneratedFiles.find(file=>file.path===old.path);assert(regenerated);if(old.bytes>0)assert(regenerated.bytes>0);}
}
export function compareNativeLocales({jaSmoke,enSmoke,jaResume,enResume,crossResume}){
  const commandsJa=smoke(jaSmoke,'ja'),commandsEn=smoke(enSmoke,'en');
  resume(jaResume,'ja','ja');resume(enResume,'en','en');
  const base=identity(jaSmoke);
  for(const value of [enSmoke,jaResume,enResume])assert.deepEqual(identity(value),base,'Locale runs require byte-identical native/bridge/boundary artifacts');
  const comparisons=[];
  function equal(label,left,right){assert.deepEqual(left,right,label);comparisons.push(label);}
  PHASES.forEach(phase=>equal('JA/EN smoke '+phase+' exact snapshot including all 45 counts',jaSmoke.gameplayTrace[phase],enSmoke.gameplayTrace[phase]));
  equal('JA/EN source-tagged no-spells events and all 45 command draw deltas',commandsJa,commandsEn);
  for(const key of ['fresh','checkpoint','resumedState','continuationSnapshots','resumedContinuationSnapshots'])equal('JA/EN resume '+key+' exact snapshot(s) including counts',jaResume[key],enResume[key]);
  if(crossResume){
    const plan=crossResume.localePlan;assert(plan && plan.original!==plan.resumed);
    assert(['ja','en'].includes(plan.original)&&['ja','en'].includes(plan.resumed));
    resume(crossResume,plan.original,plan.resumed);equal('Crosslocale artifact identity',identity(crossResume),base);
    const origin=plan.original==='ja'?jaResume:enResume,destination=plan.resumed==='ja'?jaResume:enResume;
    for(const key of ['fresh','checkpoint','continuationSnapshots'])equal('Crosslocale original '+key+' exact snapshots including counts',crossResume[key],origin[key]);
    for(const key of ['resumedState','resumedContinuationSnapshots'])equal('Crosslocale restored '+key+' exact snapshots including counts',crossResume[key],destination[key]);
  }
  return {ok:true,schema_version:1,source:PIN,comparison_count:comparisons.length,comparisons,
    snapshot_fields:FIELDS,streams:45,state_words_per_snapshot:90,draw_counts_compared:true,
    ignored_snapshot_fields:[],cross_locale:crossResume?.localePlan??null,
    scope:'Exact exported player/position/turn/depth fields and every ordered PCG state/increment/count; no claim of a full native save-tag parser or whole-game localization.',
    native_save_policy:'Each fixture restores all transported native bytes exactly; independent generated save/cache bytes are not compared across runs because native receipts document clock-bearing data. Only diagnostic counts are excluded inside each fresh-restore gameplay gate; paired same-phase locale comparisons include them.'};
}
function cli(){
  const args=process.argv.slice(2),values={};
  const names={'--ja-smoke':'jaSmoke','--en-smoke':'enSmoke','--ja-resume':'jaResume','--en-resume':'enResume','--cross-resume':'crossResume','--out':'out'};
  for(let i=0;i<args.length;i+=2){assert(Object.hasOwn(names,args[i]),'Unknown comparison argument');assert(args[i+1]);assert(!Object.hasOwn(values,names[args[i]]));values[names[args[i]]]=args[i+1];}
  for(const key of ['jaSmoke','enSmoke','jaResume','enResume'])assert(values[key],'Missing '+key);
  const inputs=Object.fromEntries(Object.entries(values).filter(([key])=>key!=='out').map(([key,file])=>[key,JSON.parse(readFileSync(resolve(file),'utf8'))]));
  const report=compareNativeLocales(inputs);if(values.out)writeFileSync(resolve(values.out),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)cli();
