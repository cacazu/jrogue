"""Update mutable evidence index; immutable proofs/blocked attempt records stay unchanged."""
from pathlib import Path
import hashlib,json
ROOT=Path.cwd();SLICE=ROOT/'input-context-live-slice';ADAPTER=SLICE/'browser-rust-adapter';BUILD=ADAPTER/'wasm-build'
def pin(p):
 b=Path(p).read_bytes();return {'path':str(Path(p).resolve()),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
out=SLICE/'CURRENT-EVIDENCE.json'
record=json.loads(out.read_bytes())
entry=record['functionalNativeRustWasmSourcePacket']
for key,source in [('plan',BUILD/'build-plan.json'),('owner',BUILD/'run-functional-window.py'),('sourceValidation',BUILD/'runner-source-validation.json'),('driver',ADAPTER/'test-actual-module.mjs')]:entry[key]=pin(source)
entry['driverAndOwnerIndependentReview']='clear'
entry['ownerSourceChecks']={'proof':pin(BUILD/'OWNER-SOURCE-CHECKS.json'),'checks':21,'actualExecutionTestsAdded':0,'nativeSnapshotPacketsSynthesized':False}
entry['permissionDeadlineBlocker']=pin(BUILD/'APPROVAL-DEADLINE-BLOCKER.json')
entry['requestedWindowStatus']='initial-and-one-identical-approval-retry-timeout-before-CreateProcess'
entry['furtherNativeRequestsHeld']=True
entry['nativeCompilerExecuted']=False;entry['actualRustWasmCompiled']=False;entry['actualRustWasmExecuted']=False;entry['originalClassExecutedInThisNewPacket']=False
out.write_bytes((json.dumps(record,indent=2)+'\n').encode('utf8'))
print(json.dumps({'manifest':pin(out),'blocker':entry['permissionDeadlineBlocker'],'functionalOwner':entry['owner'],'sourceAndRuntimeChecksRemainSeparate':True}))
