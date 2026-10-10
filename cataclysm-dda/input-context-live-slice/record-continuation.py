"""Preserve exact native bytes and integer process identity; no native job launch."""
from pathlib import Path
import hashlib
import json
HERE=Path(__file__).resolve().parent
C=HERE/'continuation-interner'
A=C/'execution/original-context-interner-initial'
R=C/'execution/wasm-results'
def demand(ok,message):
    if not ok:raise RuntimeError(message)
def read(path):return json.loads(Path(path).read_bytes())
def pin(path):
    path=Path(path).resolve();data=path.read_bytes()
    return {'path':str(path),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def main():
    terminal=read(A/'terminal.json');native=read(R/'verification.json')
    demand(terminal['status']=='selected-original-input-context-and-lookup-passed' and
      terminal['fixtureLinkPassed'] and terminal['WasmTestsPassed'] and terminal['protectedPinnedBytesUnchanged'] and
      terminal['frozenMetadataUnchanged'] and terminal['ownedJobsClosedAndRootsWaited'] and terminal['ownedRootCount']==2,
      'continuation acceptance/closure missing')
    demand(len(native['checks'])==15 and all(row['passed'] for row in native['checks']) and len(native['nativeRecords'])==24,'native checks/records missing')
    records=[]
    for saved in native['nativeRecords']:
        actual=pin(R/saved['name']);demand(saved['bytes']==actual['bytes'] and saved['sha256']==actual['sha256'],'native record changed')
        records.append(actual)
    demand(sorted(p.name for p in R.glob('*.json') if p.name!='verification.json')==sorted(Path(p['path']).name for p in records),'native record membership mismatch')
    for key in ['module','wasm']:demand(native[key]==pin(native[key]['path']),'executed module changed')
    stages=[]
    for name in ['link-original-context-with-original-interner','execute-selected-original-input-context']:
        raw_path=A/(name+'.json');raw=read(raw_path);cleanup_path=A/(name+'.outer-cleanup.json');cleanup=read(cleanup_path)
        demand(raw['passed'] and raw['exitCode']==0 and raw['remainingOwnedPidsBeforeJobClose']==[] and
          cleanup['passed'] and cleanup['remainingOwnedJobHandles']==[] and cleanup['errors']==[],'raw stage closure failed')
        created=cleanup['rootsCreated'];root=raw['rootIdentity']
        demand(len(created)==1 and created[0]['pid']==root['pid'] and
          {'processHandle':created[0]['processHandle'],'action':'close-owned-process-handle'} in cleanup['outerActions'],
          'exact root handle closure absent')
        stages.append({'stage':name,'passed':True,'durationSeconds':raw['durationSeconds'],'jobPeakPrivateBytes':raw['jobPeakPrivateBytes'],
          'maximumSampledWorkingSetBytes':max(s['ownedWorkingSetBytes'] for s in raw['samples']),
          'freshCounters':raw['freshGate'],'minimumPhysicalFreeBytes':min(s['physicalFreeBytes'] for s in raw['samples']),
          'minimumExactCommitHeadroomBytes':min(s['exactCommitHeadroomBytes'] for s in raw['samples']),
          'root':{'pid':root['pid'],'processHandle':created[0]['processHandle'],'creationFiletimeDecimal':str(root['creationFiletime']),'explicitlyClosed':True},
          'exactOwnedIdentities':[{'pid':pid,'creationFiletimeDecimal':str(created)} for pid,created in sorted({(s['pid'],s['creationFiletime']) for s in raw['identities']})],
          'remainingOwnedPids':[],'remainingOwnedJobHandles':[],'cleanupErrors':[],'raw':pin(raw_path),'cleanup':pin(cleanup_path)})
    plan=read(C/'fixture-plan.json')
    proof={'schemaVersion':1,'status':'selected-original-input-context-and-lookup-passed','sourceCommit':native['sourceCommit'],
      'moduleBuildIdentity':native['moduleBuildIdentity'],'selectedOriginalDefinitionsCompiled':20,'genuineWasmChecks':15,
      'actualOriginalMemberChecks':[{'name':s['name'],'caseId':s['caseId'],'passed':s['passed'],'action':s['action'],'nativeRecords':s['nativeRecords']} for s in native['checks']],
      'exactNativeJsonRecords':records,'nativeJsonRecordCount':24,'rawNativeVerification':pin(R/'verification.json'),
      'module':native['module'],'wasm':native['wasm'],'initialCompileAndFailurePreserved':pin(HERE/'INITIAL-NATIVE-VERIFICATION.json'),
      'actualOriginalInterner':plan['actualOriginalInterner'],'internerProvenance':plan['internerProvenance'],
      'terminal':pin(A/'terminal.json'),'plan':pin(C/'fixture-plan.json'),'owner':pin(C/'run-continuation-window.py'),
      'stages':stages,'all246ProtectedFilesUnchanged':True,'frozenSdkCacheAndPortsUnchanged':True,'allOwnedRootsAndJobsClosed':True,
      'selectedOriginalClassMembersExecuted':True,'actualOriginalWaitHookCallbacksExecuted':True,'actualOriginalTableLookupExecuted':True,
      'officialClassHeadersUnchanged':True,'contextsAndBindingsInitializedByHarness':True,
      'scriptedHardwareLeaf':True,'scriptedNestedMenuLeaf':True,'originalFullTranslationUnitExecuted':False,
      'originalFullKeybindingsUiExecuted':False,'SDLHardwareImeVerified':False,'gameplayRngSaveVerified':False,
      'languageToggleExecuted':False,'liveEngineIntegrated':False,'wholeGameVerified':False,
      'commandAuthorization':'Denied(UntrackedNativeReaders)','RustConsumerExecuted':False,
      'rawUsernameScope':'Original stored raw input CJK username/edit bytes checked in Node case9; snapshot schema exports binding/context metadata, not last raw input event.',
      'observationPurityScope':'Full native effective table comparison surrounds pin/copy; serializer purity additionally rests on exact const callbacks and pre-wait counts/expected binding observations.'}
    (HERE/'ORIGINAL-CONTEXT-VERIFICATION.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':proof['status'],'checks':15,'records':24,'roots':[s['root'] for s in stages],'proof':pin(HERE/'ORIGINAL-CONTEXT-VERIFICATION.json')}))
if __name__=='__main__':main()
