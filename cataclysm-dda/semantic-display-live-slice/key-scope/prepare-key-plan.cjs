const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve('semantic-display-live-slice'),own=path.join(root,'key-scope');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const basePath=path.join(root,'PRODUCER-WINDOW-PLAN.json'),base=JSON.parse(fs.readFileSync(basePath,'utf8'));
assert.strictEqual(hash(basePath),'8201d92d59328e02c2f74400627f2e0218085ab3f9b44c81148f2caee006882f');
const compile=JSON.parse(fs.readFileSync(path.join(root,'COMPILE-WINDOW-PLAN.json'),'utf8'));
const scope=JSON.parse(fs.readFileSync(path.join(own,'KEY-SCOPE-SOURCE-PLAN.json'),'utf8'));
assert.strictEqual(scope.expectedChecksPerCall,36);
const clone=x=>JSON.parse(JSON.stringify(x));
const out=path.join(root,'build/key-scope-run');
assert(!fs.existsSync(out),'fresh future output directory');
const sourceSupport=path.join(own,'generated-selected-key-support.cpp'),sourceFixture=path.join(own,'original-key-help.cpp');
const support=clone(base.commands[0]);
function compileCommand(template,stage,source,stem) {
  const c=clone(template),obj=path.join(out,stem+'.o'),dep=path.join(out,stem+'.d');
  assert(c.source&&c.outputObject);
  c.argv=c.argv.map(x=>x===c.source?source:x===c.outputObject?obj:x);
  c.stage=stage;c.source=source;c.outputObject=obj;c.outputDependencyFile=dep;c.outputs=[obj,dep];
  c.scope='Compile only pinned original-code key/help fixture scope; no engine/UI execution';
  assert(c.argv.includes(source)&&c.argv.includes(obj));
  return c;
}
const c1=compileCommand(support,'compile-selected-original-key-support',sourceSupport,'selected-key-support');
const c2=compileCommand(compile.commands.find(x=>x.stage==='compile-original-producer-fixture'),'compile-original-key-help-fixture',sourceFixture,'original-key-help-fixture');
const reusedNames=['help','input','input_context','cdda_help_semantic','cdda_help_transport'];
const reused=reusedNames.map(n=>compile.commands.find(x=>x.stage==='compile-'+n));
assert(reused.every(Boolean));
const objects=base.commands[1].argv.filter(x=>x.endsWith('.o'));
assert.strictEqual(objects.length,27);
const originals=objects.filter(x=>x.startsWith(path.resolve('engine-build')+path.sep));
assert.strictEqual(originals.length,23);
const coherentObjects=reused.map(x=>x.outputObject);
for(const p of coherentObjects)assert(fs.existsSync(p),p);
const allObjects=originals.concat(coherentObjects,c1.outputObject,c2.outputObject);
assert.strictEqual(allObjects.length,30);
const link=clone(base.commands[1]);
const firstFlag=link.argv.indexOf('-O0');assert(firstFlag>0);
const flags=link.argv.slice(firstFlag);
const originalModule=base.commands[1].outputs[0],modulePath=path.join(out,'original-key-help.mjs');
link.argv=link.argv.slice(0,2).concat(allObjects,flags.map(x=>x===originalModule?modulePath:x.includes('_cdda_original_help_fixture_run')?x.replace('_cdda_original_help_fixture_run','_cdda_original_key_help_fixture_run'):x));
link.stage='strict-link-original-key-help-scope';
link.outputs=[modulePath,path.join(out,'original-key-help.wasm')];
link.scope='Strict 30-object link of actual original loader/translation/key formatting/help scope/transport; no undefined-symbol suppression';
assert(link.argv.includes('-sERROR_ON_UNDEFINED_SYMBOLS=1'));
assert(!link.argv.some(x=>/IGNORE_UNDEFINED|ERROR_ON_UNDEFINED_SYMBOLS=0/.test(x)));
const expected={status:'selected-original-key-help-scope-passed',originalChecksPerRun:36,runs:2,totalActualNativeChecks:72,diagnosticCalls:0,selectedOriginalSupportDefinitions:10,originalCoreObjects:23,originalKeynameExecuted:true,originalGetDescExecuted:true,originalSelectedHelpScopeExecuted:true,originalTransportPinOwnershipExecuted:true,englishGettextFallbackOnly:true,JapaneseCatalogLoaded:false,helpDisplayExecuted:false,RustAcceptanceExecuted:false,fullEngineLinked:false,browserExecuted:false,wholeGameAccepted:false};
const driver=[
"import assert from 'node:assert/strict';",
"import {readFile} from 'node:fs/promises';",
"import {fileURLToPath} from 'node:url';",
"const wasmUrl=new URL('../build/key-scope-run/original-key-help.wasm',import.meta.url);",
"const {default:createModule}=await import('../build/key-scope-run/original-key-help.mjs');",
"const module=await createModule({wasmBinary:await readFile(fileURLToPath(wasmUrl))});",
"assert.equal(typeof module._cdda_original_key_help_fixture_run,'function');",
"assert.equal(typeof module._cdda_fixture_diagnostic_call_count,'function');",
"assert.equal(module._cdda_fixture_diagnostic_call_count(),0);",
"const first=module._cdda_original_key_help_fixture_run();",
"assert.equal(first,36);",
"assert.equal(module._cdda_fixture_diagnostic_call_count(),0);",
"const second=module._cdda_original_key_help_fixture_run();",
"assert.equal(second,36);",
"assert.equal(module._cdda_fixture_diagnostic_call_count(),0);",
"console.log(JSON.stringify("+JSON.stringify(expected)+"));",
""
].join('\n');
const driverPath=path.join(own,'run-original-key-help.mjs');
fs.writeFileSync(driverPath,driver);
const execute=clone(base.commands[2]);
assert.strictEqual(execute.argv.length,1);
execute.stage='execute-original-key-help-scope';
execute.argv=[driverPath];execute.outputs=[];
execute.scope='Run only actual original fixture twice; 36 checks each and zero aborting diagnostic calls; Node/MEMFS only';
const filePins=[sourceSupport,sourceFixture,driverPath,path.join(own,'prepare-key-scope.cjs'),path.join(own,'KEY-SCOPE-SOURCE-PLAN.json'),path.join(own,'HELP-SOURCE-PATH-VERIFICATION.json'),path.join(root,'COMPILE-VERIFICATION.json')].concat(coherentObjects).map(p=>({path:p,bytes:fs.statSync(p).size,sha256:hash(p)}));
const plan={schemaVersion:1,status:'four_exact_commands_prepared_no_owner_or_native_release',upstreamCommit:base.sourceCommit,buildIdentity:base.buildIdentity,baseReviewedProducerPlanSha256:hash(basePath),baseReviewedProducerOwnerSha256:hash(path.join(root,'run-producer-window.py')),sourcePlanSha256:hash(path.join(own,'KEY-SCOPE-SOURCE-PLAN.json')),sourcePathProofSha256:hash(path.join(own,'HELP-SOURCE-PATH-VERIFICATION.json')),commands:[c1,c2,link,execute],pinnedFreshScopeFilesAndCoherentObjects:filePins,baseline23ObjectsAndSuccessLogsAndMMDsFromSourcePacket:{path:path.join(root,'PRODUCER-SOURCE-PACKET.json'),sha256:hash(path.join(root,'PRODUCER-SOURCE-PACKET.json')),freshRevalidationRequired:true},coherentObjectMMDRevalidationRequired:true,outputDirectory:out,linkObjects:allObjects,cpp2Helper:base.cpp2Helper,guard:base.guard,frozenSDK:base.frozenSDK,launchGate:base.launchGate,ownedResourceGuard:base.ownedResourceGuard,rustEnvironment:base.rustEnvironment,removeInheritedEnvironment:base.removeInheritedEnvironment,browserRecoveryHasPriority:true,parentExclusiveSlotReleaseRequired:true,expectedRuntimeResult:expected,acceptanceRequirement:'Use the existing reviewed exact one-record typed JSON parser; reject duplicate keys/non-finite/trailing output/type coercion.',scopeClarification:'Seven new exact support methods plus exact SDL timeout initializer; inherited three exact support definitions. jsondir/core loader bodies are source identity proofs only, not compiled support. gamepad_available is an explicit false fixture platform leaf; diagnostic leaves abort.',affectedOriginalUnitsBeforeFullRelink:231,independentSourceReviewPending:true,boundedOwnerPrepared:false,nativeCompilerExecuted:false,strictLinkClosureProven:false,originalProducerExecuted:false,RustExecuted:false,browserExecuted:false,fullEngineLinked:false,wholeGameAccepted:false};
assert.strictEqual(plan.commands.length,4);
assert.deepStrictEqual(plan.commands.map(x=>x.outputs.length),[2,2,2,0]);
assert(allObjects.every(p=>p.endsWith('.o')));
assert.strictEqual(new Set(allObjects).size,allObjects.length);
assert.strictEqual(plan.expectedRuntimeResult.totalActualNativeChecks,2*scope.expectedChecksPerCall);
fs.writeFileSync(path.join(own,'KEY-SCOPE-WINDOW-PREPARED.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({status:plan.status,stages:4,strictLinkObjects:30,coherentReusedObjects:5,baselineOriginalObjects:23,expectedChecksPerCall:36,planSha256:hash(path.join(own,'KEY-SCOPE-WINDOW-PREPARED.json')),driverSha256:hash(driverPath),executed:false}));