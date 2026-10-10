"""Close independent owner path/result-reader gaps; source-only."""
from pathlib import Path
import ast,hashlib,json
HERE=Path(__file__).resolve().parent
p=HERE/'run-functional-window.py';s=p.read_text(encoding='utf8')
helpers='''def ordinary_ancestry(path,helper,include_target=False):
 path=Path(path);require(helper.within(path,ADAPTER),'owned path escaped adapter')
 current=path if include_target else path.parent
 while True:
  if os.path.lexists(current):
   require(current.is_dir()and not current.is_symlink()and not(getattr(current.lstat(),'st_file_attributes',0)&0x400),'nonordinary/reparse directory ancestor')
  if current.resolve()==ROOT.resolve():break
  require(current.parent!=current,'workspace ancestry missing');current=current.parent
def ordinary_output_file(path,helper):
 path=Path(path);ordinary_ancestry(path,helper)
 require(os.path.lexists(path)and path.is_file()and not path.is_symlink()and not(getattr(path.lstat(),'st_file_attributes',0)&0x400),'nonordinary/reparse output file')
 return path
def fresh_directory(path,helper):
 path=Path(path);ordinary_ancestry(path,helper);require(not os.path.lexists(path),'fresh directory already exists including dangling link')
 path.mkdir(parents=True,exist_ok=False);ordinary_ancestry(path,helper,True)
def strict_pairs(pairs):
 result={}
 for key,value in pairs:
  require(key not in result,'duplicate result JSON key');result[key]=value
 return result
def reject_nonfinite(value):raise RuntimeError('nonfinite result JSON value: '+value)
def strict_result_bytes(data):
 require(len(data)<=65536,'result exceeds64KiB')
 result=json.loads(data.decode('utf8'),object_pairs_hook=strict_pairs,parse_constant=reject_nonfinite)
 required={'schemaVersion','status','tests','expectedIdentity','actualSelectedOriginalClassExecuted','trueNativeFourExportsExecuted','actualRustWasmConsumerExecuted','scriptedHardwareLeaf','synchronousTestObservationLeaf','productionDeferredReadyNoticeProved','SDLOrIMEProved','AsyncifyProved','liveEngineIntegrated','wholeGameVerified','commandAuthorization'}
 require(type(result)is dict and set(result)==required,'exact result top-level keys')
 require(type(result['schemaVersion'])is int and result['schemaVersion']==1,'result schema integer1')
 require(type(result['status'])is str and type(result['expectedIdentity'])is str and type(result['commandAuthorization'])is str,'typed result strings')
 for key in required-{'schemaVersion','status','tests','expectedIdentity','commandAuthorization'}:require(type(result[key])is bool,'typed result boolean')
 require(type(result['tests'])is list and len(result['tests'])==9,'exact nine result rows')
 for index,row in enumerate(result['tests']):
  fields={'name','passed'}|({'nativeSDLOrIME'}if index==3 else set())
  require(type(row)is dict and set(row)==fields and type(row['name'])is str and type(row['passed'])is bool,'exact result-row keys/types')
  if index==3:require(row['nativeSDLOrIME']is False,'raw echo cannot claim native SDL/IME')
 return result
def read_strict_result(path,helper):
 path=ordinary_output_file(path,helper);require(path.stat().st_size<=65536,'result file exceeds64KiB')
 with path.open('rb')as stream:data=stream.read(65537)
 return strict_result_bytes(data)
'''
assert 'def archive(command,destination,helper):'in s
s=s.replace('def archive(command,destination,helper):',helpers+'\ndef archive(command,destination,helper):')
s=s.replace("target=destination/'outputs'/command['stage'];target.mkdir(parents=True,exist_ok=False);result=[]","target=destination/'outputs'/command['stage'];fresh_directory(target,helper);result=[]")
s=s.replace("if source.exists():\n   require(source.is_file()","if os.path.lexists(source):\n   ordinary_output_file(source,helper)\n   require(source.is_file()")
s=s.replace("proof=json.loads(Path(command['outputs'][0]).read_bytes())","proof=read_strict_result(command['outputs'][0],helper)")
s=s.replace("for key in ['newOwnedNativeBuild','newOwnedRustTarget','newOwnedResults']:require(not Path(plan[key]).exists(),'fresh output required; no retry')","for key in ['newOwnedNativeBuild','newOwnedRustTarget','newOwnedResults']:\n  ordinary_ancestry(plan[key],helper);require(not os.path.lexists(plan[key]),'fresh output required including dangling link; no retry')")
s=s.replace("destination.mkdir(parents=True,exist_ok=False)","fresh_directory(destination,helper)")
s=s.replace("(destination/'temporary').mkdir();","fresh_directory(destination/'temporary',helper);")
s=s.replace("for command in plan['commands']:\n   helper.validate_pin_records(records);","for command in plan['commands']:\n   ordinary_ancestry(destination,helper,True)\n   for output in command['outputs']:ordinary_ancestry(output,helper)\n   for output in derived:ordinary_output_file(output,helper)\n   helper.validate_pin_records(records);")
s=s.replace("if command['stage']==STAGES[0]:Path(plan['newOwnedNativeBuild']).mkdir(parents=True,exist_ok=False)","if command['stage']==STAGES[0]:fresh_directory(plan['newOwnedNativeBuild'],helper)\n   if command['stage']==STAGES[2]:fresh_directory(plan['newOwnedRustTarget'],helper)")
s=s.replace("if command['stage']==STAGES[3]:Path(plan['newOwnedResults']).mkdir(parents=True,exist_ok=False)","if command['stage']==STAGES[3]:fresh_directory(plan['newOwnedResults'],helper)")
s=s.replace("for p in artifacts(command):derived[str(p.resolve())]=helper.pin(p)","for p in artifacts(command):ordinary_output_file(p,helper);derived[str(p.resolve())]=helper.pin(p)")
assert "not Path(plan[key]).exists()"not in s and "proof=json.loads(Path(command['outputs'][0])"not in s
p.write_text(s,encoding='utf8',newline='\n');ast.parse(s)
print(json.dumps({'ownerSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'ownerBytes':p.stat().st_size,'sourceOnly':True}))
