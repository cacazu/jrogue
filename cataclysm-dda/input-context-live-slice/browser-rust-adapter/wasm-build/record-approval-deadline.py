"""Record tool-reported permission deadlines and verify absent native output roots."""
from pathlib import Path
import hashlib,json,os
ROOT=Path.cwd();SLICE=ROOT/'input-context-live-slice';ADAPTER=SLICE/'browser-rust-adapter';BUILD=ADAPTER/'wasm-build'
message='The automatic permission approval review did not finish before its deadline. Do not assume the action is unsafe based on the timeout alone. You may retry once, or ask the user for guidance or explicit approval.'
paths=[ADAPTER/'original-wait-leaf/build',BUILD/'target',BUILD/'results',BUILD/'execution/original-context-browser-rust-initial']
absence=[{'path':str(p),'lexists':os.path.lexists(p)}for p in paths]
assert all(not row['lexists']for row in absence)
def pin(p):
 b=Path(p).read_bytes();return {'path':str(Path(p).resolve()),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
out=BUILD/'APPROVAL-DEADLINE-BLOCKER.json';assert not out.exists()
record={'schemaVersion':1,'status':'both-permission-reviews-deadline-before-CreateProcess','initialCall':'functions.exec cell129','sameRequestRetry':'functions.exec cell130','exactToolMessage':message,'toolFailureStage':'CreateProcess','safetyRejection':False,'nativeProcessCreated':False,'returnedSessionId':None,'actualNativeCompilerExecuted':False,'actualRustCompilerExecuted':False,'actualRustWasmExecuted':False,'ownerAttemptCreated':False,'filesystemAbsenceChecked':absence,'plan':pin(BUILD/'build-plan.json'),'owner':pin(BUILD/'run-functional-window.py'),'driver':pin(ADAPTER/'test-actual-module.mjs'),'permittedOneSameRequestRetryUsed':True,'furtherNativeRequestsHeld':True,'allPreviouslyAcceptedEvidencePreserved':True,'commandAuthorization':'Denied(UntrackedNativeReaders)','liveEngineIntegrated':False,'wholeGameVerified':False}
out.write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
print(json.dumps({'blocker':pin(out),'absence':absence}))
