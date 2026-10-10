"""Cheap adversarial result/ordinary-path checks. No native/Rust/WASM code or guard runs."""
from pathlib import Path
import hashlib,json,types
HERE=Path(__file__).resolve().parent
owner_path=HERE/'run-functional-window.py'
before=owner_path.read_bytes()
assert hashlib.sha256(before).hexdigest()=='acf14f250bcc39adfe174c69d4af450a1319e2318696d2205f84e41e233c98e7'
owner=types.ModuleType('source_only_owner_checks');owner.__file__=str(owner_path)
exec(compile(before,str(owner_path),'exec',dont_inherit=True,optimize=0),owner.__dict__)
plan,records,helper,*_=owner.load_sources()
fields=['actualSelectedOriginalClassExecuted','trueNativeFourExportsExecuted','actualRustWasmConsumerExecuted','scriptedHardwareLeaf','synchronousTestObservationLeaf','productionDeferredReadyNoticeProved','SDLOrIMEProved','AsyncifyProved','liveEngineIntegrated','wholeGameVerified']
valid={'schemaVersion':1,'status':'source-schema-probe-only','expectedIdentity':'source-probe','commandAuthorization':'Denied(UntrackedNativeReaders)','tests':[{'name':n,'passed':False,**({'nativeSDLOrIME':False}if i==3 else{})}for i,n in enumerate(owner.EXPECTED_TESTS)],**{k:False for k in fields}}
encode=lambda x:json.dumps(x,separators=(',',':')).encode('utf8')
results=[]
def reject(name,data):
 try:owner.strict_result_bytes(data)
 except (RuntimeError,UnicodeDecodeError,json.JSONDecodeError):results.append({'name':name,'passed':True})
 else:raise AssertionError('accepted invalid source result: '+name)
assert owner.strict_result_bytes(encode(valid))==valid;results.append({'name':'exact-shaped-source-only-false-metadata-accepted','passed':True})
reject('duplicate-top-level-key',b'{"schemaVersion":1,'+encode(valid)[1:])
reject('nested-duplicate-key',encode(valid).replace(b'"passed":false',b'"passed":false,"passed":false',1))
reject('nonfinite-nan',encode(valid).replace(b'"actualSelectedOriginalClassExecuted":false',b'"actualSelectedOriginalClassExecuted":NaN'))
reject('nonfinite-infinity',encode(valid).replace(b'"actualSelectedOriginalClassExecuted":false',b'"actualSelectedOriginalClassExecuted":Infinity'))
reject('overflowed-numeric-boolean',encode(valid).replace(b'"actualSelectedOriginalClassExecuted":false',b'"actualSelectedOriginalClassExecuted":1e500'))
reject('invalid-utf8',b'\xff')
reject('result-byte-cap',b' '*65537)
reject('non-object-top-level',b'[]')
for key,value,name in [('schemaVersion',True,'bool-schema-rejected'),('schemaVersion',1.0,'float-schema-rejected'),('status',None,'null-status-rejected'),('unexpected',False,'extra-field-rejected')]:
 p=json.loads(encode(valid));p[key]=value;reject(name,encode(p))
p=json.loads(encode(valid));p.pop('status');reject('missing-field-rejected',encode(p))
p=json.loads(encode(valid));p['tests'].pop();reject('wrong-row-count-rejected',encode(p))
p=json.loads(encode(valid));p['tests'][0]['passed']=1;reject('integer-row-boolean-rejected',encode(p))
p=json.loads(encode(valid));p['tests'][0]['nativeSDLOrIME']=False;reject('unexpected-row-key-rejected',encode(p))
p=json.loads(encode(valid));p['tests'][3]['nativeSDLOrIME']=True;reject('raw-row-native-sdl-overclaim-rejected',encode(p))
checks=HERE/'source-checks'
owner.fresh_directory(checks,helper)
bad_parent=checks/'ordinary-file-parent';bad_parent.write_bytes(b'source-only')
try:owner.ordinary_ancestry(bad_parent/'output',helper)
except RuntimeError:results.append({'name':'ordinary-file-as-output-parent-rejected','passed':True})
else:raise AssertionError('ordinary-file ancestor accepted')
try:owner.fresh_directory(checks,helper)
except RuntimeError:results.append({'name':'existing-owned-output-root-rejected','passed':True})
else:raise AssertionError('existing fresh root accepted')
try:owner.ordinary_ancestry(HERE.parents[2]/'other-title-output',helper)
except RuntimeError:results.append({'name':'out-of-adapter-output-rejected','passed':True})
else:raise AssertionError('escaped output accepted')
assert owner_path.read_bytes()==before
def pin(p):
 b=Path(p).read_bytes();return {'path':str(Path(p).resolve()),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
driver=HERE.parent/'test-actual-module.mjs'
proof={'schemaVersion':1,'status':'source-only-result-and-path-checks-passed','checks':results,'owner':pin(owner_path),'plan':pin(HERE/'build-plan.json'),'driver':pin(driver),'nativeCompilerExecuted':False,'RustCompilerExecuted':False,'actualRustWasmExecuted':False,'actualOriginalClassExecuted':False,'WindowsGuardLoaded':False,'nativeSnapshotPacketsSynthesized':False,'distinctActualTestsAdded':0}
out=HERE/'OWNER-SOURCE-CHECKS.json';assert not out.exists();out.write_text(json.dumps(proof,indent=2)+'\n',encoding='utf8')
print(json.dumps({'proof':pin(out),'checks':len(results),'driver':pin(driver)}))
