"""Source-only formatter workcopy plan. Never launch or copy back."""
from pathlib import Path
import hashlib,json,tomllib
HERE=Path(__file__).resolve().parent
RUST=HERE.parent
SLICE=RUST.parent
ROOT=SLICE.parent

def pin(path):
    path=Path(path).resolve();data=path.read_bytes()
    return {'path':str(path),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def load(path,sha):
    data=Path(path).read_bytes();assert hashlib.sha256(data).hexdigest()==sha
    return json.loads(data)
def collect(value,records):
    if isinstance(value,dict):
        if all(k in value for k in ['path','bytes','sha256']):
            item={k:value[k] for k in ['path','bytes','sha256']};key=str(Path(item['path']).resolve())
            assert key not in records or records[key]==item;records[key]=item
        for child in value.values():collect(child,records)
    elif isinstance(value,list):
        for child in value:collect(child,records)
base=load(RUST/'rust-consumer-plan.json','30ff0efe8bc5c16f44cc980e9bf9a89f9ba748b426400ccca8a62f1ff4cf5481')
proof=load(SLICE/'ORIGINAL-CONTEXT-RUST-VERIFICATION.json','c6e26b1b161428d0c3743895421fcf888af67fea39f63ae266590d03c4903d00')
accepted_path=RUST/'accepted-initial-inputs.json';accepted=json.loads(accepted_path.read_bytes())
assert proof['distinctTestCount']==5 and proof['allOwnedRootsAndJobsClosed']
source=pin(SLICE/'rust-consumer/src/lib.rs');assert source==proof['actualCompiledTestSource']
source_copy=next(c['acceptedCopy'] for c in accepted['copies'] if c['original']==source)
assert pin(source_copy['path'])==source_copy
cargo=Path(base['commands'][0]['executable']);rustfmt=pin(cargo.parent/'rustfmt.exe')
records={}
collect([base,proof,accepted],records)
reference=ROOT/'integration-overlay/native-module-fixture/rust-build-plan/format-preview'
for file in [RUST/'rust-consumer-plan.json',RUST/'run-rust-window.py',SLICE/'ORIGINAL-CONTEXT-RUST-VERIFICATION.json',accepted_path,HERE/'rustfmt.toml',Path(__file__),reference/'run-preview.py',reference/'preview-plan.json',ROOT/'integration-overlay/build-plan/cpp-compile/run-compile-window.py']:
    collect(pin(file),records)
collect(rustfmt,records);collect(pin('C:/Users/kit/emsdk/python/3.13.3_64bit/python.exe'),records)
for record in records.values():assert pin(record['path'])==record
result={'schemaVersion':1,'status':'source-only-one-workcopy-format-preview-not-executed','sourceCommit':base['sourceCommit'],'sourceFile':source,'acceptedInitialSourceCopy':source_copy,'sourceEdition':'2024','installedRustfmt':rustfmt,'installedPython':pin('C:/Users/kit/emsdk/python/3.13.3_64bit/python.exe'),'config':pin(HERE/'rustfmt.toml'),'pins':[records[k] for k in sorted(records)],'preparedUniquePinCount':len(records),'originalInitialRustProof':pin(SLICE/'ORIGINAL-CONTEXT-RUST-VERIFICATION.json'),'acceptedInitialCopiesManifest':pin(accepted_path),'cpp2Helper':pin(ROOT/'integration-overlay/build-plan/cpp-compile/run-compile-window.py'),'referencePattern':{'owner':pin(reference/'run-preview.py'),'plan':pin(reference/'preview-plan.json'),'usedForSourcePatternOnlyNotExecuted':True},'command':{'stage':'actual-original-context-rustfmt-workcopy-preview','executable':rustfmt['path'],'argvTemplate':['--edition','2024','--config-path',str(HERE/'rustfmt.toml'),'{work_lib}'],'cwdTemplate':'{work}'},'launchGate':base['launchGate'],'ownedResourceGuard':base['ownedResourceGuard'],'browserPriorityGate':base['browserPriorityGate'],'guard':base['guard'],'removeInheritedEnvironment':base['removeInheritedEnvironment'],'rustEnvironment':{'CARGO_NET_OFFLINE':'true','CARGO_BUILD_JOBS':'1','RUST_TEST_THREADS':'1','RAYON_NUM_THREADS':'1'},'originalsMayChange':False,'copybackAuthorized':False,'initialProofMayChange':False,'RustfmtExecuted':False,'CargoExecuted':False,'ClippyExecuted':False,'originalInputContextExecutedInThisWindow':False,'wholeGameVerified':False,'policy':'One exact trusted rustfmt process on fresh workcopy under fixed run_owned; preserve every source/native/initial proof byte. Diff and candidate reviewed before scoped copyback and new final quality plan.'}
(HERE/'preview-plan.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps({'plan':pin(HERE/'preview-plan.json'),'preparedPins':len(records),'finalPins':len(records)+2,'RustfmtExecuted':False}))
