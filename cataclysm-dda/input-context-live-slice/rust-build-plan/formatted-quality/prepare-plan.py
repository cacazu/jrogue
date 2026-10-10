"""Source-only four-stage quality packet. No Rust tool is executed."""
from pathlib import Path
import hashlib,json,os
HERE=Path(__file__).resolve().parent
RUST=HERE.parent
SLICE=RUST.parent
ROOT=SLICE.parent

def pin(path):
 path=Path(path).resolve();b=path.read_bytes();return {'path':str(path),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def checked(path,sha):
 b=Path(path).read_bytes();assert hashlib.sha256(b).hexdigest()==sha;return json.loads(b)
def collect(v,r):
 if isinstance(v,dict):
  if all(k in v for k in ['path','bytes','sha256']):
   item={k:v[k] for k in ['path','bytes','sha256']};key=str(Path(item['path']).resolve());assert key not in r or r[key]==item;r[key]=item
  for x in v.values():collect(x,r)
 elif isinstance(v,list):
  for x in v:collect(x,r)
base=checked(RUST/'rust-consumer-plan.json','30ff0efe8bc5c16f44cc980e9bf9a89f9ba748b426400ccca8a62f1ff4cf5481')
proof=checked(SLICE/'ORIGINAL-CONTEXT-RUST-VERIFICATION.json','c6e26b1b161428d0c3743895421fcf888af67fea39f63ae266590d03c4903d00')
preview=checked(RUST/'format-preview/PREVIEW-VERIFICATION.json','5a160ba1c3c88f9bea0ce9f3af5b3d15fdd96125bdd56c072815738d87923a21')
provenance=json.loads((HERE/'SOURCE-PROVENANCE.json').read_bytes())
assert provenance['derivedSource']['sha256']=='19eb28b1819dcded592f7921a9dbab29aa6f45b142e28112723e6685f6a971e1'
assert provenance['acceptedOriginalSource']['sha256']=='5e6f74b1bfcd056f5991fec6a2d5e078fea0706c95a5ce5fbf0ffde5c21413c8'
assert len(provenance['nativeRecordCopies'])==24 and all(x['original']['sha256']==x['copied']['sha256'] for x in provenance['nativeRecordCopies'])
command=base['commands'][0];cargo=Path(command['executable']);tools={'cargo':pin(cargo),'rustfmt':pin(cargo.parent/'rustfmt.exe'),'cargoClippy':pin(cargo.parent/'cargo-clippy.exe'),'clippyDriver':pin(cargo.parent/'clippy-driver.exe')}
wasm_lld=cargo.parent.parent/'lib/rustlib/x86_64-pc-windows-gnu/bin/rust-lld.exe';assert wasm_lld.is_file();tools['wasmLld']=pin(wasm_lld)
assert (cargo.parent.parent/'lib/rustlib/wasm32-unknown-unknown/lib').is_dir()
manifest=str(HERE/'package/Cargo.toml');common=['--manifest-path',manifest,'--package','cdda-original-context-consumer'];target=str(HERE/'target')
stages=['original-context-package-format-check','original-context-same-five-tests-formatted','original-context-package-clippy','original-context-wasm-five-tests-no-run']
argv=[['fmt',*common,'--','--check','--config-path',str(HERE/'rustfmt.toml')],['test','--offline','--locked','--jobs','1',*common,'--target','x86_64-pc-windows-gnu','--target-dir',target,'--lib','--','--test-threads=1'],['clippy','--offline','--locked','--jobs','1',*common,'--target','x86_64-pc-windows-gnu','--target-dir',target,'--lib','--tests','--no-deps','--','-D','warnings'],['test','--offline','--locked','--jobs','1',*common,'--target','wasm32-unknown-unknown','--target-dir',target,'--no-run','--lib']]
commands=[{'stage':name,'executable':str(cargo),'argv':args,'cwd':str(HERE/'package')}for name,args in zip(stages,argv)]
records={};collect([base,proof,preview,provenance,tools],records)
for path in [RUST/'rust-consumer-plan.json',RUST/'run-rust-window.py',SLICE/'ORIGINAL-CONTEXT-RUST-VERIFICATION.json',RUST/'format-preview/PREVIEW-VERIFICATION.json',HERE/'SOURCE-PROVENANCE.json',HERE/'rustfmt.toml',Path(__file__),ROOT/'integration-overlay/build-plan/cpp-compile/run-compile-window.py',ROOT/'integration-overlay/native-module-fixture/rust-build-plan/formatted-quality/run-quality-window.py',ROOT/'integration-overlay/native-module-fixture/rust-build-plan/formatted-quality/quality-plan.json']:
 collect(pin(path),records)
for item in records.values():assert pin(item['path'])==item
result={'schemaVersion':1,'status':'source-only-four-package-quality-stages-not-executed','sourceCommit':base['sourceCommit'],'pins':[records[k] for k in sorted(records)],'preparedUniquePinCount':len(records),'cpp2Helper':pin(ROOT/'integration-overlay/build-plan/cpp-compile/run-compile-window.py'),'installedTools':tools,'newOwnedTarget':target,'initialExecutedTargetMustRemainUnchanged':str(RUST/'target'),'commands':commands,'launchGate':base['launchGate'],'ownedResourceGuard':base['ownedResourceGuard'],'browserPriorityGate':base['browserPriorityGate'],'guard':base['guard'],'removeInheritedEnvironment':base['removeInheritedEnvironment'],'rustEnvironment':{**command['environment'],'PATH':str(cargo.parent)+os.pathsep+os.environ['PATH'],'RUSTFMT':tools['rustfmt']['path'],'RAYON_NUM_THREADS':'1'},'config':pin(HERE/'rustfmt.toml'),'derivedPackageSource':provenance,'expectedOrderedTests':base['expectedOrderedTests'],'actualNativeJsonPins':[x['copied'] for x in provenance['nativeRecordCopies']],'acceptedOriginalProof':pin(SLICE/'ORIGINAL-CONTEXT-RUST-VERIFICATION.json'),'distinctTestsAdded':0,'WasmTestHarnessCompileOnly':True,'RustBrowserAdapterExecuted':False,'wholeGameVerified':False,'commandAuthorization':'Denied(UntrackedNativeReaders)','policy':'New ordinary package/copies only; accepted source/module/records/proof remain exact. Format/native same-five/Clippy/WASM no-run sequential owned jobs; no new test credit or browser/liveengine claim. Offline/locked/single worker, fresh target, exact handles, no retries.'}
(HERE/'quality-plan.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps({'plan':pin(HERE/'quality-plan.json'),'preparedPins':len(records),'finalPins':len(records)+2,'stages':stages}))
