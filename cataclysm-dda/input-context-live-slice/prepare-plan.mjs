import fs from 'node:fs';
import path from 'node:path';
import {HERE,ROOT,UPSTREAM,COMMIT,pin,require,sha,prepare} from './prepare-source.mjs';
const {report}=prepare();
const baseName=path.join(ROOT,'integration-overlay/build-plan/cpp-compile/compile-plan.json');
const baseBytes=fs.readFileSync(baseName);
require(sha(baseBytes)==='f5e5f97a1cd2c8540f73675cc3d0bf8fc4cc462d48fa5f55a1b983c2ae1f3f0e','CPP2 accepted plan changed');
const base=JSON.parse(baseBytes);
const oldName=path.join(ROOT,'integration-overlay/native-module-fixture/fixture-plan.json');
const oldBytes=fs.readFileSync(oldName);
require(sha(oldBytes)==='047c6aa89403d5be6bc69b8ee2b743b296089c6e1460341ebe5f137a284b759b','completed actual-module plan changed');
const old=JSON.parse(oldBytes);
const records=new Map();
function collect(value){
 if(value&&typeof value==='object'){
  if(typeof value.path==='string'&&Number.isSafeInteger(value.bytes)&&/^[0-9a-f]{64}$/.test(value.sha256)){
   const actual=pin(value.path);require(actual.bytes===value.bytes&&actual.sha256===value.sha256,'protected input changed: '+value.path);
   const key=path.resolve(value.path).toLowerCase();const prior=records.get(key);require(!prior||prior.sha256===actual.sha256,'conflicting case-insensitive input pins');records.set(key,actual);
  }
  for(const child of Object.values(value))collect(child);
 }
}
collect(base);
const supplementalName=path.join(ROOT,'integration-overlay/build-plan/cpp-compile/runner-pins.json');
const supplementalBytes=fs.readFileSync(supplementalName);
require(sha(supplementalBytes)==='8af61c2fafff3bb1f7ef33361293893a0a7d150c517c30653ff372e1760274db','CPP2 supplemental pins changed');
collect(JSON.parse(supplementalBytes));collect(report);collect(old.actualCompiledModule);
// The old fixture's initial Rust source pin is historical after authorized
// formatting. It is not an input to this new C++/Node executable. Reuse exactly
// the reviewed CPP2 native/tool pins, then add only concrete new inputs.
for(const filename of ['em++.py','src/settings.js','tools/system_libs.py','tools/building.py']){
 const toolRoot=path.dirname(old.commands[0].argv[1]);
 const r=pin(path.join(toolRoot,filename));records.set(r.path.toLowerCase(),r);
}
for(const filename of [old.commands[2].executable,path.join(path.dirname(old.commands[0].argv[1]),'../bin/wasm-ld.exe')]){
 const r=pin(filename);records.set(r.path.toLowerCase(),r);
}

for(const file of ['prepare-source.mjs','prepare-plan.mjs','fixture-leaves.cpp','test-wasm.mjs','SOURCE-SELECTION.json','LICENSE-UPSTREAM.txt']){const r=pin(path.join(HERE,file));records.set(r.path.toLowerCase(),r);}
const helper=path.join(ROOT,'integration-overlay/build-plan/cpp-compile/run-compile-window.py');
const helperPin=pin(helper);require(helperPin.sha256==='0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395','fixed CPP2 helper changed');records.set(helperPin.path.toLowerCase(),helperPin);
for(const filename of [baseName,oldName,supplementalName]){const r=pin(filename);records.set(r.path.toLowerCase(),r);}
fs.writeFileSync(path.join(HERE,'module-build-id.txt'),old.moduleBuildIdentity+'\n');
const identityPin=pin(path.join(HERE,'module-build-id.txt'));records.set(identityPin.path.toLowerCase(),identityPin);
const inherited=old.commands[0];
const python=inherited.executable,empp=inherited.argv[1],node=old.commands[2].executable;
const build=path.join(HERE,'build');
const flags=[...base.baseline.exactBaseFlagsPreserved];
const commandPrefix=['-B',empp,'-v'];
const compileArgs=[...commandPrefix,...flags,'-I'+path.join(ROOT,'integration-overlay/build-plan/cpp-compile/sources/src'),
 '-MMD','-MP','-MF',path.join(build,'original-context.d'),'-c',report.generatedSource.path,'-o',path.join(build,'original-context.o')];
const exports=['_cdda_browser_snapshot_pin','_cdda_browser_snapshot_data','_cdda_browser_snapshot_size','_cdda_browser_snapshot_release',
 '_cdda_context_run','_cdda_context_record_data','_cdda_context_record_size','_cdda_context_record_count','_cdda_context_record_timeout','_cdda_context_record_defaults',
 '_cdda_context_action_data','_cdda_context_action_size','_cdda_context_text_data','_cdda_context_text_size','_cdda_context_edit_data','_cdda_context_edit_size',
 '_cdda_context_failure_data','_cdda_context_failure_size','_cdda_context_metric'];
const linkArgs=[...commandPrefix,path.join(build,'original-context.o'),old.actualCompiledModule.path,'-O0','-fexceptions','--no-entry','-Wl,--threads=1',
 '-sDISABLE_EXCEPTION_CATCHING=0','-sMODULARIZE=1','-sEXPORT_ES6=1','-sENVIRONMENT=node','-sINVOKE_RUN=0','-sEXIT_RUNTIME=0','-sFILESYSTEM=0',
 '-sDYNAMIC_EXECUTION=0','-sASSERTIONS=1','-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=16777216','-sMAXIMUM_MEMORY=67108864','-sSTACK_SIZE=1048576',
 '-sEXPORTED_FUNCTIONS='+JSON.stringify(exports),'-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]','-o',path.join(build,'original-input-context.mjs')];
const common={cwd:HERE,environment:{...inherited.environment},timeoutSeconds:180};
const commands=[
 {...common,stage:'compile-selected-original-members',executable:python,argv:compileArgs,outputs:[path.join(build,'original-context.o'),path.join(build,'original-context.d')]},
 {...common,stage:'link-selected-original-context-and-actual-snapshot',executable:python,argv:linkArgs,outputs:[path.join(build,'original-input-context.mjs'),path.join(build,'original-input-context.wasm')]},
 {...common,stage:'execute-selected-original-input-context',executable:node,argv:['--max-old-space-size=128','--unhandled-rejections=strict',path.join(HERE,'test-wasm.mjs')],outputs:[path.join(HERE,'execution/wasm-results/verification.json')]}
];
const plan={schemaVersion:1,status:'source-prepared-no-native-compiler-link-or-module-run',sourceCommit:COMMIT,
 selectedOriginalDefinitions:report.selectedOriginalDefinitions,sourceSelection:pin(path.join(HERE,'SOURCE-SELECTION.json')),
 moduleBuildIdentity:old.moduleBuildIdentity,actualCompiledModule:old.actualCompiledModule,
 pins:[...records.values()].sort((a,b)=>a.path.localeCompare(b.path)),frozenSDK:old.frozenSDK,guard:old.guard,
 launchGate:base.launchGate,ownedResourceGuard:base.ownedResourceGuard,removeInheritedEnvironment:base.removeInheritedEnvironment,rustEnvironment:base.rustEnvironment,
 resourcePolicy:{...old.resourcePolicy,compileLinkAndNodePeakUnmeasured:true},commands,requiredExports:exports,
 pointObjectIncluded:false,requiredWasmChecks:15,requiredNativeRecords:24,
 originalFullTranslationUnitIncluded:false,officialClassHeadersUnmodified:true,replacementInputContextClass:false,
 selectedOriginalMemberExecutionVerified:false,originalActionContextLookupVerified:false,scriptedPlatformAndMenuLeaves:true,
 originalFullKeybindingsUiVerified:false,languageToggleVerified:false,liveEngineIntegrated:false,commandAuthorization:'Denied(UntrackedNativeReaders)',wholeGameVerified:false,
 scope:'Genuine selected original C++ class members with one previously compiled observer; explicit hardware/menu/capability/UI leaves. No full input_context.o or replacement input_context class. Actual hardware/IME, turn/RNG/save and full engine remain unverified.',
 nextLaunchGate:'Root release of sole heavy slot plus independently reviewed exact thin owner; browser 7/9 priority, otherwise fresh 4/6 and unchanged existing 1 GiB caps/2 GiB floors/180 seconds. No automatic retry.'};
fs.writeFileSync(path.join(HERE,'fixture-plan.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({status:plan.status,pins:plan.pins.length,commands:commands.length,plan:pin(path.join(HERE,'fixture-plan.json')),generated:report.generatedSource}));
