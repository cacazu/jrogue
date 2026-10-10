"""Prepare exact four-stage original-class/Rust WASM window; no build tool is run."""
from pathlib import Path
import hashlib,json,os,tomllib,copy
HERE=Path(__file__).resolve().parent
ADAPTER=HERE.parent
SLICE=ADAPTER.parent
ROOT=SLICE.parent
STAGES=['compile-original-context-browser-wait-leaf','link-original-context-browser-wait-leaf','build-actual-rust-browser-input-adapter','execute-original-context-real-rust-wasm-adapter']
TESTS=['original-live-wait-native-four-export-rust-owned-lookup','original-live-nested-parent-current-bindings-through-rust','original-live-help-reset-timeout-through-rust','original-stored-raw-user-bytes-rust-owned-no-translation','original-held-wait-repeat-rust-publication-stale-owned-data','original-over-limit-and-post-wait-rust-fail-closed','actual-native-pin-rust-ffi-error-releases-and-denies','actual-native-pin-rust-ffi-reentry-clears-and-releases','actual-rust-wasm-refcell-trap-quarantined-native-pin-closed-original-scope-completes']
def pin(p):
 p=Path(p).resolve();b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def checked(p,sha):
 b=Path(p).read_bytes();assert hashlib.sha256(b).hexdigest()==sha;return json.loads(b)
def collect(value,result):
 if isinstance(value,dict):
  if all(k in value for k in ['path','bytes','sha256']):
   item={k:value[k]for k in ['path','bytes','sha256']};key=str(Path(item['path']).resolve()).casefold();assert key not in result or result[key]==item;result[key]=item
  for v in value.values():collect(v,result)
 elif isinstance(value,list):
  for v in value:collect(v,result)
cpp=checked(SLICE/'fixture-plan.json','1eba4f012fa418c0fd5bf6848e5ef0626924805e7a708168e2d68ddf8978e993')
interner=checked(SLICE/'continuation-interner/fixture-plan.json','fbd8e9d21869cfadcc1cc59169e0d1bd74302c85e86a78b6e83932bf13f00581')
rust=checked(SLICE/'rust-build-plan/rust-consumer-plan.json','30ff0efe8bc5c16f44cc980e9bf9a89f9ba748b426400ccca8a62f1ff4cf5481')
quality=checked(SLICE/'rust-build-plan/formatted-quality/quality-plan.json','e550a5d2674bd803e6804b6acd9b6077b607b9d3b5e1d4d822800255b5525faa')
native_proof=checked(SLICE/'ORIGINAL-CONTEXT-VERIFICATION.json','dbc812584b6d7bd26e3e752be84dada30ddf1851b7b4daa88f7736844356fd53')
change=json.loads((ADAPTER/'original-wait-leaf/SOURCE-CHANGE.json').read_bytes())
assert change['originalMemberSource']['sha256']==change['selectedOriginalMemberSource']['sha256']=='7d820ff7e003ab40a9a2fa8c4ad6d8d8bc3484dce5f3c4734401180958e3946b'
assert '#include "../fixture-leaves.cpp"' in (ADAPTER/'original-wait-leaf/generated/original-members.cpp').read_text(encoding='utf8')
assert (ADAPTER/'host.mjs').stat().st_size==9555
assert pin(ADAPTER/'host.mjs')['sha256']=='e9bc0b70574e6c2c4fae3b5dfa257be34e6846f0625aee4c4f7042aed4a02f65'
assert pin(ADAPTER/'host-v2.mjs')['sha256']=='2a2d70f7faa3895666ca03e9ab987e0914ad4077768d42fd10746fab0fd77658'
assert not (ADAPTER/'original-wait-leaf/build').exists() and not (HERE/'target').exists() and not (HERE/'results').exists()
native_build=ADAPTER/'original-wait-leaf/build'
compile_command=copy.deepcopy(cpp['commands'][0])
old_source=compile_command['argv'][compile_command['argv'].index('-c')+1]
new_source=str(ADAPTER/'original-wait-leaf/generated/original-members.cpp')
new_object=str(native_build/'original-context.o');new_dependency=str(native_build/'original-context.d')
compile_command.update(stage=STAGES[0],cwd=str(ADAPTER/'original-wait-leaf'),outputs=[new_object,new_dependency])
compile_command['argv'][compile_command['argv'].index('-c')+1]=new_source
compile_command['argv'][compile_command['argv'].index('-o')+1]=new_object
compile_command['argv'][compile_command['argv'].index('-MF')+1]=new_dependency
link=copy.deepcopy(interner['commands'][0]);old_context=interner['successfulOriginalMemberCompile']['path'];link['argv']=[new_object if a==old_context else a for a in link['argv']]
js=str(native_build/'original-context-browser-leaf.mjs');wasm=str(native_build/'original-context-browser-leaf.wasm')
link['argv'][link['argv'].index('-o')+1]=js
link.update(stage=STAGES[1],cwd=str(ADAPTER/'original-wait-leaf'),outputs=[js,wasm])
cargo=rust['commands'][0]['executable']
rust_wasm=HERE/'target/wasm32-unknown-unknown/debug/cdda_browser_input_adapter.wasm'
rust_rlib=HERE/'target/wasm32-unknown-unknown/debug/libcdda_browser_input_adapter.rlib'
build={'stage':STAGES[2],'executable':cargo,'argv':['build','--offline','--locked','--jobs','1','--manifest-path',str(ADAPTER/'Cargo.toml'),'--package','cdda-browser-input-adapter','--target','wasm32-unknown-unknown','--target-dir',str(HERE/'target'),'--lib'],'cwd':str(ADAPTER),'timeoutSeconds':180,'outputs':[str(rust_wasm),str(rust_rlib)]}
result_path=HERE/'results/verification.json'
test={'stage':STAGES[3],'executable':cpp['commands'][2]['executable'],'argv':['--max-old-space-size=128','--unhandled-rejections=strict',str(ADAPTER/'test-actual-module.mjs')],'cwd':str(ADAPTER),'timeoutSeconds':180,'outputs':[str(result_path)]}
records={};collect(interner['pins'],records);collect(rust,records);collect(change,records)
source_files=[ADAPTER/'Cargo.toml',ADAPTER/'Cargo.lock',*sorted((ADAPTER/'src').glob('*.rs')),ADAPTER/'host-v2.mjs',ADAPTER/'host.mjs',ADAPTER/'test-actual-module.mjs',ADAPTER/'en.json',ADAPTER/'ja.json',ADAPTER/'SOURCE-DESIGN.json',ADAPTER/'IMPLEMENTATION-NOTES.json',ADAPTER/'HOST-V2-SOURCE-CHANGE.json',ADAPTER/'TRANSPORT-SOURCE-CHECKS.json',ADAPTER/'test-transport.mjs',ADAPTER/'original-wait-leaf/SOURCE-CHANGE.json',Path(__file__),SLICE/'ORIGINAL-CONTEXT-VERIFICATION.json',SLICE/'ORIGINAL-CONTEXT-RUST-VERIFICATION.json',SLICE/'rust-build-plan/formatted-quality/QUALITY-VERIFICATION.json',SLICE/'rust-build-plan/formatted-quality/EXACT-IDENTITY-CORRECTION.json',SLICE/'fixture-plan.json',SLICE/'continuation-interner/fixture-plan.json',SLICE/'rust-build-plan/rust-consumer-plan.json',SLICE/'continuation-interner/module-build-id.txt']
for p in source_files:collect(pin(p),records)
sysroot=Path(cpp['frozenSDK']['cache'])/'sysroot/include/emscripten'
for p in [sysroot/'em_js.h',sysroot/'emscripten.h']:assert p.is_file();collect(pin(p),records)
rustroot=Path(cargo).parent.parent
for p in sorted((rustroot/'lib/rustlib/wasm32-unknown-unknown/lib').glob('*')):
 if p.is_file():collect(pin(p),records)
for p in [rustroot/'lib/rustlib/x86_64-pc-windows-gnu/bin/rust-lld.exe',Path(cargo).parent/'rustc.exe']:collect(pin(p),records)
original_lock=tomllib.loads((ROOT/'integration-overlay/rust-snapshot-consumer/Cargo.lock').read_text(encoding='utf8'))
new_lock=tomllib.loads((ADAPTER/'Cargo.lock').read_text(encoding='utf8'))
assert [p for p in new_lock['package'] if p['name']!='cdda-browser-input-adapter']==original_lock['package']
manifest=tomllib.loads((ADAPTER/'Cargo.toml').read_text(encoding='utf8'))
assert manifest['package']['publish'] is False and manifest['lib']['crate-type']==['cdylib','rlib']
consumer=(ADAPTER/manifest['dependencies']['cdda-live-input-snapshot-consumer']['path']).resolve()
assert consumer==(ROOT/'integration-overlay/rust-snapshot-consumer').resolve()
en=json.loads((ADAPTER/'en.json').read_bytes());ja=json.loads((ADAPTER/'ja.json').read_bytes());assert set(en)==set(ja) and len(en)==12
environment={**compile_command['environment'],**quality['rustEnvironment'],'CDDA_ADAPTER_RESULT':str(result_path)}
for item in records.values():assert pin(item['path'])==item
result={'schemaVersion':1,'status':'source-only-functional-four-stage-not-launched','sourceCommit':cpp['sourceCommit'],'pins':[records[k] for k in sorted(records)],'preparedUniquePinCount':len(records),'commands':[compile_command,link,build,test],'cpp2Helper':pin(ROOT/'integration-overlay/build-plan/cpp-compile/run-compile-window.py'),'cpp2BasePlan':pin(ROOT/'integration-overlay/build-plan/cpp-compile/compile-plan.json'),'guard':cpp['guard'],'launchGate':quality['launchGate'],'ownedResourceGuard':quality['ownedResourceGuard'],'browserPriorityGate':quality['browserPriorityGate'],'removeInheritedEnvironment':list(dict.fromkeys([*cpp['removeInheritedEnvironment'],*quality['removeInheritedEnvironment']])),'rustEnvironment':environment,'frozenSDK':cpp['frozenSDK'],'resourcePolicy':{'jobs':1},'newOwnedNativeBuild':str(native_build),'newOwnedRustTarget':str(HERE/'target'),'newOwnedResults':str(HERE/'results'),'expectedCheckNames':TESTS,'expectedCheckCount':9,'expectedIdentity':(SLICE/'continuation-interner/module-build-id.txt').read_text(encoding='utf8').strip(),'originalSelectedMembers':cpp['selectedOriginalDefinitions'],'originalMemberBodiesUnchanged':True,'originalClassHeadersUnmodified':True,'genuineOriginalInterner':interner['actualOriginalInterner'],'acceptedObserverObject':pin(ROOT/'integration-overlay/build-plan/cpp-compile/objects/browser_input_snapshot.o'),'nativeSourceChange':change,'hostRevision':pin(ADAPTER/'host-v2.mjs'),'frozenConsumerPath':str(consumer),'nativeInputCap':262144,'responseCap':528384,'identityAndRawCap':16384,'nativeImports':6,'rustFunctionExports':11,'abiVersion':1,'productionDeferredReadyNoticeProved':False,'SDLOrIMEProved':False,'AsyncifyProved':False,'liveEngineIntegrated':False,'wholeGameVerified':False,'commandAuthorization':'Denied(UntrackedNativeReaders)','initialAcceptedModulesRecordsProofsChanged':False,'scope':'Recompile unchanged selected original20 member bodies with one transparent synchronous scripted hardware capture leaf; real original interner and accepted observer object. Actual separate Rust WASM frozen consumer, actual native four exports, current dual-memory bounded owned UTF8, strict one-time host identity, typed denial/lifecycle and true Rust nested RefCell trap quarantine. No original SDL/IME, Asyncify, deferred live-ready browser or fullengine claim.'}
(HERE/'build-plan.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
actual=SLICE/'continuation-interner/execution/wasm-results/case-01-wait-00.json'
native=json.loads(actual.read_bytes());print(json.dumps({'plan':pin(HERE/'build-plan.json'),'preparedPins':len(records),'stages':STAGES,'nativeU64FieldTypes':{k:type(native[k]).__name__ for k in ['publication_sequence','context_epoch','parent_context_epoch']}}))
