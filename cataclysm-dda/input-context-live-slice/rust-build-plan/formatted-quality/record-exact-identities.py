"""Preserve exact raw process identities as decimal strings; no process is run."""
from pathlib import Path
import hashlib,json
ROOT=Path.cwd()
QUALITY=ROOT/'input-context-live-slice/rust-build-plan/formatted-quality'
RAW=QUALITY/'execution/original-context-quality-initial'
def pin(p):
 b=p.read_bytes();return {'path':str(p.resolve()),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
terminal=json.loads((RAW/'terminal.json').read_bytes())
rows=[]
for stage in terminal['stages']:
 if stage['decision']!='launch':continue
 metrics=json.loads((RAW/(stage['stage']+'.json')).read_bytes())
 cleanup=json.loads((RAW/(stage['stage']+'.outer-cleanup.json')).read_bytes())
 identity=metrics['rootIdentity']
 rows.append({'stage':stage['stage'],'pid':identity['pid'],'creationFiletimeDecimal':str(identity['creationFiletime']),'processHandleDecimal':str(cleanup['rootsCreated'][0]['processHandle']),'metrics':pin(RAW/(stage['stage']+'.json')),'cleanup':pin(RAW/(stage['stage']+'.outer-cleanup.json')),'remainingOwnedPidsBeforeJobClose':metrics['remainingOwnedPidsBeforeJobClose'],'remainingOwnedJobHandles':cleanup['remainingOwnedJobHandles'],'errors':cleanup['errors']})
out=QUALITY/'EXACT-IDENTITY-CORRECTION.json'
assert not out.exists()
correction={'schemaVersion':1,'status':'raw-exact-identity-correction-no-execution','reason':'Prior commentary metric print projected raw JSON FILETIME integers through JavaScript Number (>2^53); first two values rounded. Raw immutable metrics retain authoritative exact integers. Existing compact proof omits FILETIME and stays unchanged.','originalCompactProof':pin(QUALITY/'QUALITY-VERIFICATION.json'),'rawTerminal':pin(RAW/'terminal.json'),'exactRawIdentities':rows,'gateCaptureUtcRecorded':False,'noExecutionOrRerun':True,'sameFiveTestsAdded':0,'commandAuthorization':'Denied(UntrackedNativeReaders)'}
out.write_text(json.dumps(correction,indent=2)+'\n',encoding='utf8')
print(json.dumps({'correction':pin(out),'exactIdentities':rows}))
