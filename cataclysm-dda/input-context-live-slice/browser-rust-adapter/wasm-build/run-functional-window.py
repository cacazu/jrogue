"""Four-stage owner reusing the frozen CPP2 wrapper/Windows guard. Default is source-only."""
from pathlib import Path
import argparse,ast,hashlib,json,os,re,shutil,struct,sys,time,types
from datetime import datetime,timezone
HERE=Path(__file__).resolve().parent
ADAPTER=HERE.parent
ROOT=HERE.parents[2]
PLAN_PATH=HERE/'build-plan.json'
PLAN_SHA='5b47d1118b6832f0629ba86856d1580ab42337aa43cc68ad739d4abdd3d8dc69'
CPP2=ROOT/'integration-overlay/build-plan/cpp-compile'
HELPER_SHA='0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395'
BASE_SHA='f5e5f97a1cd2c8540f73675cc3d0bf8fc4cc462d48fa5f55a1b983c2ae1f3f0e'
STAGES=['compile-original-context-browser-wait-leaf','link-original-context-browser-wait-leaf','build-actual-rust-browser-input-adapter','execute-original-context-real-rust-wasm-adapter']
EXPECTED_TESTS=['original-live-wait-native-four-export-rust-owned-lookup','original-live-nested-parent-current-bindings-through-rust','original-live-help-reset-timeout-through-rust','original-stored-raw-user-bytes-rust-owned-no-translation','original-held-wait-repeat-rust-publication-stale-owned-data','original-over-limit-and-post-wait-rust-fail-closed','actual-native-pin-rust-ffi-error-releases-and-denies','actual-native-pin-rust-ffi-reentry-clears-and-releases','actual-rust-wasm-refcell-trap-quarantined-native-pin-closed-original-scope-completes']
def require(ok,message):
 if not ok:raise RuntimeError(message)
def checked(p,sha):
 b=Path(p).read_bytes();require(hashlib.sha256(b).hexdigest()==sha,'fixed source changed: '+str(p));return b
def buffer_pin(p,b):return {'path':str(Path(p).resolve()),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def load_sources():
 plan_data=checked(PLAN_PATH,PLAN_SHA);helper_path=CPP2/'run-compile-window.py';helper_data=checked(helper_path,HELPER_SHA);base_data=checked(CPP2/'compile-plan.json',BASE_SHA)
 helper=types.ModuleType('cdda_browser_adapter_verified_cpp2');helper.__file__=str(helper_path)
 exec(compile(helper_data,str(helper_path),'exec',dont_inherit=True,optimize=0),helper.__dict__)
 plan=json.loads(plan_data);base=json.loads(base_data)
 require([c['stage']for c in plan['commands']]==STAGES and len(plan['pins'])==855,'exact four commands/855 protected pins')
 require(plan['expectedCheckNames']==EXPECTED_TESTS and plan['expectedCheckCount']==9,'exact nine acceptance names')
 require(plan['resourcePolicy']['jobs']==1 and plan['commandAuthorization']=='Denied(UntrackedNativeReaders)','scope/one worker')
 require(plan['guard']['currentWrapper']['sha256']==helper.WRAPPER_SHA256 and plan['guard']['historicalHelper']['sha256']==helper.GUARD_SHA256,'fixed guard hashes')
 for key in ['launchGate','ownedResourceGuard']:require(plan[key]==base[key],'fixed resource policy changed')
 bounds=plan['ownedResourceGuard']
 require(bounds['maximumOwnedTreePrivateBytes']==helper.GIB and bounds['maximumOwnedTreeWorkingSetBytes']==helper.GIB and bounds['minimumPhysicalFreeBytes']==2*helper.GIB and bounds['minimumExactCommitHeadroomBytes']==2*helper.GIB and bounds['maximumStageSeconds']==180,'owned 1GiB/2-2/180s bounds')
 require(plan['launchGate']['minimumPhysicalFreeBytes']==4*helper.GIB and plan['launchGate']['minimumExactCommitHeadroomBytes']==6*helper.GIB,'fresh4/6 gate')
 require(plan['originalMemberBodiesUnchanged']and plan['originalClassHeadersUnmodified'],'focused genuine original source')
 require(plan['commands'][1]['argv'].count('--no-entry')==1 and plan['genuineOriginalInterner']['path']in plan['commands'][1]['argv'] and plan['acceptedObserverObject']['path']in plan['commands'][1]['argv'],'real original interner/observer')
 require(all(value in plan['commands'][2]['argv']for value in ['--offline','--locked','--jobs','1','wasm32-unknown-unknown','--lib']),'offline single-worker actual WASM')
 require(plan['nativeImports']==6 and plan['rustFunctionExports']==11 and plan['abiVersion']==1,'fixed transfer ABI')
 require(all(plan[k]is False for k in ['productionDeferredReadyNoticeProved','SDLOrIMEProved','AsyncifyProved','liveEngineIntegrated','wholeGameVerified','initialAcceptedModulesRecordsProofsChanged']),'unsupported fullengine/suspension claim')
 for command in plan['commands']:
  require(helper.within(command['cwd'],ADAPTER),'cwd escapes fresh adapter')
  for p in command['outputs']:require(helper.within(p,ADAPTER),'output escapes adapter')
 helper.validate_inherited_environment()
 records=list(plan['pins'])+[buffer_pin(PLAN_PATH,plan_data),buffer_pin(helper_path,helper_data),helper.pin(__file__)]
 unique={}
 for item in records:
  key=str(Path(item['path']).resolve()).casefold();require(key not in unique or unique[key]==item,'conflicting pin');unique[key]=item
 records=list(unique.values());require(len(records)==857,'857 final unique inputs');helper.validate_pin_records(records)
 return plan,records,helper,plan_data,helper_data,base_data
def artifacts(command):return [Path(p)for p in command['outputs']]
def ordinary_ancestry(path,helper,include_target=False):
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

def archive(command,destination,helper):
 target=destination/'outputs'/command['stage'];fresh_directory(target,helper);result=[]
 for source in artifacts(command):
  if os.path.lexists(source):
   ordinary_output_file(source,helper)
   require(source.is_file()and not source.is_symlink()and not(getattr(source.lstat(),'st_file_attributes',0)&0x400)and helper.within(source,ADAPTER),'unsafe output')
   copied=target/source.name;shutil.copyfile(source,copied);require(helper.digest(source)==helper.digest(copied),'archive mismatch')
   result.append({**helper.pin(source),'archive':helper.pin(copied)})
 return result
def wasm_header(p):
 with Path(p).open('rb')as stream:require(stream.read(8)==b'\x00asm\x01\x00\x00\x00','actual wasm v1 required')
def verify(command,records,derived,plan,helper):
 stage=command['stage']
 if stage==STAGES[0]:
  return {'actualNonSystemDependencies':helper.verify_outputs({**command,'outputObject':command['outputs'][0],'outputDependencyFile':command['outputs'][1]},records)}
 if stage==STAGES[1]:
  js,wasm=map(Path,command['outputs']);require(js.is_file()and js.stat().st_size>0,'actual Emscripten JS missing');wasm_header(wasm)
  return {'realNativeModuleLinked':True,'nativeRuntimeExecuted':False}
 if stage==STAGES[2]:
  wasm,rlib=map(Path,command['outputs']);wasm_header(wasm);require(rlib.is_file()and rlib.stat().st_size>0,'real Rust rlib missing')
  return {'actualRustWasmCompiled':True,'RustRuntimeExecuted':False}
 proof=read_strict_result(command['outputs'][0],helper)
 require(proof['status']=='actual-original-context-rust-wasm-leaf-tests-passed'and proof['expectedIdentity']==plan['expectedIdentity'],'actual module status/identity')
 require([x['name']for x in proof['tests']]==EXPECTED_TESTS and all(x['passed']is True for x in proof['tests']),'actual nine assertions')
 require(all(proof[k]is True for k in ['actualSelectedOriginalClassExecuted','trueNativeFourExportsExecuted','actualRustWasmConsumerExecuted','scriptedHardwareLeaf','synchronousTestObservationLeaf']),'actual bounded execution scope')
 require(all(proof[k]is False for k in ['productionDeferredReadyNoticeProved','SDLOrIMEProved','AsyncifyProved','liveEngineIntegrated','wholeGameVerified'])and proof['commandAuthorization']=='Denied(UntrackedNativeReaders)','wholeengine/ownership overclaim')
 return {'actualSelectedOriginalClassExecuted':True,'trueNativeFourExportsExecuted':True,'actualRustWasmConsumerExecuted':True,'genuineIntegrationChecks':9}
def execute(plan,records,helper,plan_data,helper_data,base_data,options):
 require(__debug__ and sys.platform=='win32'and struct.calcsize('P')==8,'unoptimized64-bitWindows')
 require(options.parent_released_window and options.runner_sha256==helper.digest(__file__),'root sole-slot release/exact owner')
 for key in ['newOwnedNativeBuild','newOwnedRustTarget','newOwnedResults']:
  ordinary_ancestry(plan[key],helper);require(not os.path.lexists(plan[key]),'fresh output required including dangling link; no retry')
 destination=HERE/'execution'/options.attempt_name;require(helper.within(destination,HERE/'execution'),'attempt scope');fresh_directory(destination,helper)
 fresh_directory(destination/'temporary',helper);(destination/'accepted-plan.json').write_bytes(plan_data);(destination/'accepted-cpp2-helper.py').write_bytes(helper_data);(destination/'accepted-cpp2-base-plan.json').write_bytes(base_data);shutil.copyfile(__file__,destination/'accepted-owner.py')
 terminal={'schemaVersion':1,'status':'preparing-owned-window','planSha256':PLAN_SHA,'runnerSha256':helper.digest(__file__),'stages':[],'nativeCompilePassed':False,'nativeLinkPassed':False,'rustWasmCompilePassed':False,'actualIntegrationTestsPassed':False,'actualSelectedOriginalClassExecuted':False,'actualRustWasmConsumerExecuted':False,'productionDeferredReadyNoticeProved':False,'SDLOrIMEProved':False,'AsyncifyProved':False,'liveEngineIntegrated':False,'wholeGameVerified':False,'commandAuthorization':'Denied(UntrackedNativeReaders)'}
 before=None;trees=None;derived={}
 controlled={**helper.CONTROLLED_INHERITED,'TEMP':str(destination/'temporary'),'TMP':str(destination/'temporary')};previous={k:os.environ.get(k)for k in controlled}
 try:
  before=helper.fingerprints(records);trees={k:helper.metadata_tree(plan['frozenSDK'][k])for k in ['cache','ports']};helper.write_json(destination/'input-fingerprints-before.json',before);helper.write_json(destination/'frozen-tree-metadata-before.json',trees)
  os.environ.update(controlled);wrapper,guard=helper.load_wrapper(plan)
  for command in plan['commands']:
   ordinary_ancestry(destination,helper,True)
   for output in command['outputs']:ordinary_ancestry(output,helper)
   for output in derived:ordinary_output_file(output,helper)
   helper.validate_pin_records(records);helper.validate_pin_records(list(derived.values()));require(all(helper.metadata_tree(plan['frozenSDK'][k])==trees[k]for k in trees),'frozen SDK cache/ports changed')
   captured=time.monotonic();capture_utc=datetime.now(timezone.utc).isoformat();counters=guard.counters();decision=helper.choose_launch(counters)
   stage={'stage':command['stage'],'decision':decision,'capturedUTC':capture_utc,'captureMonotonicSeconds':captured,'freshCounters':counters,'argv':[command['executable'],*command['argv']]};terminal['stages'].append(stage);helper.write_json(destination/(command['stage']+'.launch-decision.json'),stage)
   if decision!='launch':terminal['status']=decision;break
   require(time.monotonic()-captured<=15,'fresh counter measurement stale')
   if command['stage']==STAGES[0]:fresh_directory(plan['newOwnedNativeBuild'],helper)
   if command['stage']==STAGES[2]:fresh_directory(plan['newOwnedRustTarget'],helper)
   if command['stage']==STAGES[3]:fresh_directory(plan['newOwnedResults'],helper)
   try:
    metrics=wrapper.run_owned(guard,command,destination);cleanup=json.loads((destination/(command['stage']+'.outer-cleanup.json')).read_bytes())
    require(metrics['passed']and metrics['exitCode']==0 and not metrics['remainingOwnedPidsBeforeJobClose'],'owned stage failed/not empty')
    require(cleanup['passed']and not cleanup['remainingOwnedJobHandles']and not cleanup['errors'],'owned closure incomplete')
    roots=cleanup['rootsCreated'];require(len(roots)==1 and any(a.get('processHandle')==roots[0]['processHandle']and a['action']=='close-owned-process-handle'for a in cleanup['outerActions']),'exact returned-root handle not closed')
    helper.validate_pin_records(list(derived.values()));stage.update(verify(command,records,derived,plan,helper))
    stage.update(status='passed',durationSeconds=metrics['durationSeconds'],jobPeakPrivateBytes=metrics['jobPeakPrivateBytes'],maximumSampledWorkingSetBytes=max((x['ownedWorkingSetBytes']for x in metrics['samples']),default=0),exactRootIdentity={'pid':metrics['rootIdentity']['pid'],'processHandleDecimal':str(roots[0]['processHandle']),'creationFiletimeDecimal':str(metrics['rootIdentity']['creationFiletime'])})
    for p in artifacts(command):ordinary_output_file(p,helper);derived[str(p.resolve())]=helper.pin(p)
    terminal[{STAGES[0]:'nativeCompilePassed',STAGES[1]:'nativeLinkPassed',STAGES[2]:'rustWasmCompilePassed',STAGES[3]:'actualIntegrationTestsPassed'}[command['stage']]]=True
   except BaseException as error:stage.update(status='failed-stopped',failure=repr(error));raise
   finally:stage['artifacts']=archive(command,destination,helper);helper.write_json(destination/(command['stage']+'.verdict.json'),stage)
   require(helper.fingerprints(records)==before,'protected bytes changed')
  else:
   terminal.update(status='actual-original-context-rust-wasm-leaf-tests-passed',actualSelectedOriginalClassExecuted=True,actualRustWasmConsumerExecuted=True)
 except BaseException as error:terminal.update(status='failed-stopped-owned-window',failure=repr(error))
 finally:
  for k,v in previous.items():
   if v is None:os.environ.pop(k,None)
   else:os.environ[k]=v
  try:
   after=helper.fingerprints(records);after_trees={k:helper.metadata_tree(plan['frozenSDK'][k])for k in ['cache','ports']};helper.write_json(destination/'input-fingerprints-after.json',after);helper.write_json(destination/'frozen-tree-metadata-after.json',after_trees)
   terminal['all857ProtectedPinnedBytesUnchanged']=before is not None and before==after;terminal['frozenSdkMetadataUnchanged']=trees is not None and trees==after_trees;require(terminal['all857ProtectedPinnedBytesUnchanged']and terminal['frozenSdkMetadataUnchanged'],'terminal input audit');helper.validate_pin_records(list(derived.values()))
  except BaseException as error:terminal.update(status='failed-terminal-audit',terminalAuditFailure=repr(error))
  cleanups=[]
  for stage in terminal['stages']:
   if stage['decision']!='launch':continue
   try:
    p=destination/(stage['stage']+'.outer-cleanup.json');c=json.loads(p.read_bytes());m=json.loads((destination/(stage['stage']+'.json')).read_bytes());roots=c['rootsCreated']
    require(c['passed']and not c['errors']and not c['remainingOwnedJobHandles']and not m['remainingOwnedPidsBeforeJobClose']and len(roots)==1 and any(a.get('processHandle')==roots[0]['processHandle']and a['action']=='close-owned-process-handle'for a in c['outerActions']),'full exact-root closure')
    cleanups.append({'stage':stage['stage'],'passed':True,'exactRootIdentity':{'pid':m['rootIdentity']['pid'],'processHandleDecimal':str(roots[0]['processHandle']),'creationFiletimeDecimal':str(m['rootIdentity']['creationFiletime'])},'remainingOwnedJobHandles':[],'remainingOwnedPidsBeforeJobClose':[],'errors':[],'evidence':helper.pin(p)})
   except BaseException as error:cleanups.append({'stage':stage['stage'],'passed':False,'failure':repr(error)})
  terminal['ownedCleanupRecords']=cleanups;terminal['allOwnedJobsAndExactRootHandlesClosed']=all(c['passed']for c in cleanups)
  if not terminal['allOwnedJobsAndExactRootHandlesClosed']:terminal['status']='failed-owned-cleanup-uncertain'
  terminal['derivedArtifactPins']=list(derived.values());terminal['ordinaryCargoCacheMetadataAllowed']=True;terminal['evidenceFiles']=[helper.pin(p)for p in sorted(destination.rglob('*'))if p.is_file()and 'temporary'not in p.relative_to(destination).parts and p.name!='terminal.json'];helper.write_json(destination/'terminal.json',terminal)
 print(json.dumps({k:terminal[k]for k in ['status','nativeCompilePassed','nativeLinkPassed','rustWasmCompilePassed','actualIntegrationTestsPassed','allOwnedJobsAndExactRootHandlesClosed']}),flush=True)
 require(terminal['status']in ['actual-original-context-rust-wasm-leaf-tests-passed','deferred-browser-priority','blocked-fresh-4-6-gate'],'stopped; preserve diagnostics; no automatic retry')
def main():
 p=argparse.ArgumentParser();p.add_argument('--run',action='store_true');p.add_argument('--parent-released-window',action='store_true');p.add_argument('--runner-sha256');p.add_argument('--attempt-name',default='validation-only');options=p.parse_args();require(re.fullmatch(r'[a-z0-9_-]{1,48}',options.attempt_name),'fresh bounded attempt name')
 ast.parse(Path(__file__).read_bytes(),filename=__file__);plan,records,helper,plan_data,helper_data,base_data=load_sources()
 if not options.run:
  result={'schemaVersion':1,'status':'functional-owner-source-validated-no-guard-loaded','planSha256':PLAN_SHA,'ownerSha256':helper.digest(__file__),'protectedUniqueFiles':len(records),'stageCount':4,'preparedAcceptanceChecks':9,'nativeCompilerExecuted':False,'rustCompilerExecuted':False,'actualRustWasmExecuted':False,'actualOriginalClassExecuted':False,'WindowsGuardLoaded':False};helper.write_json(HERE/'runner-source-validation.json',result);print(json.dumps(result));return
 execute(plan,records,helper,plan_data,helper_data,base_data,options)
if __name__=='__main__':main()
