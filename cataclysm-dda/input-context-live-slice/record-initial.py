"""Read-only artifact/closure consolidation; never launches a process."""
from pathlib import Path
import hashlib
import json

HERE=Path(__file__).resolve().parent
ATTEMPT=HERE/'execution/original-context-initial'
def pin(p):
    p=Path(p).resolve();data=p.read_bytes()
    return {'path':str(p),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def demand(ok,message):
    if not ok: raise RuntimeError(message)
def read(p): return json.loads(Path(p).read_bytes())
def main():
    terminal=read(ATTEMPT/'terminal.json')
    demand(terminal['status']=='failed-stopped-owned-window' and terminal['fixtureCompilePassed'] is True and
           terminal['fixtureLinkPassed'] is False and terminal['WasmTestsPassed'] is False,'unexpected initial outcome')
    demand(terminal['protectedPinnedBytesUnchanged'] is True and terminal['frozenMetadataUnchanged'] is True and
           terminal['ownedJobsClosedAndRootsWaited'] is True and terminal['ownedRootCount']==2,'initial ownership/input audit failed')
    rows=[]
    for name in ['compile-selected-original-members','link-selected-original-context-and-actual-snapshot']:
        raw_path=ATTEMPT/(name+'.json');raw=read(raw_path)
        cleanup_path=ATTEMPT/(name+'.outer-cleanup.json');cleanup=read(cleanup_path)
        demand(raw['remainingOwnedPidsBeforeJobClose']==[] and cleanup['passed'] is True and
               cleanup['remainingOwnedJobHandles']==[] and cleanup['errors']==[],'initial stage closure failed')
        root=raw['rootIdentity'];created=cleanup['rootsCreated']
        demand(len(created)==1 and created[0]['pid']==root['pid'] and
               {'processHandle':created[0]['processHandle'],'action':'close-owned-process-handle'} in cleanup['outerActions'],
               'exact owned root handle not closed')
        identities=sorted({(item['pid'],item['creationFiletime']) for item in raw['identities']})
        rows.append({'stage':name,'passed':raw['passed'],'exitCode':raw['exitCode'],'durationSeconds':raw['durationSeconds'],
          'jobPeakPrivateBytes':raw['jobPeakPrivateBytes'],
          'maximumSampledWorkingSetBytes':max(row['ownedWorkingSetBytes'] for row in raw['samples']),
          'minimumPhysicalFreeBytes':min(row['physicalFreeBytes'] for row in raw['samples']),
          'minimumExactCommitHeadroomBytes':min(row['exactCommitHeadroomBytes'] for row in raw['samples']),
          'root':{'pid':root['pid'],'creationFiletimeDecimal':str(root['creationFiletime']),
                  'processHandle':created[0]['processHandle'],'explicitlyClosed':True},
          'exactOwnedIdentities':[{'pid':pid,'creationFiletimeDecimal':str(created)} for pid,created in identities],
          'remainingOwnedPids':[],'remainingOwnedJobHandles':[],'cleanupErrors':[],
          'raw':pin(raw_path),'cleanup':pin(cleanup_path)})
    source=read(HERE/'SOURCE-SELECTION.json')
    proof={'schemaVersion':1,'status':'original-member-compile-passed-interner-link-dependency-blocked',
      'sourceCommit':source['sourceCommit'],'selectedOriginalDefinitions':len(source['selectedOriginalDefinitions']),
      'compilePassed':True,'linkPassed':False,'NodeWasmExecuted':False,'nativeJsonRecords':0,
      'originalSelectedMembersExecuted':False,'originalActionContextsLookupExecuted':False,
      'commandAuthorization':'Denied(UntrackedNativeReaders)','liveEngineIntegrated':False,'wholeGameVerified':False,
      'blockingSymbol':'string_identity_static::string_id_intern(std::string&&)',
      'diagnosis':'Official game-header static string_id initializers require the actual original interner object; no synthetic implementation is substituted.',
      'stages':rows,'terminal':pin(ATTEMPT/'terminal.json'),'sourceSelection':pin(HERE/'SOURCE-SELECTION.json'),
      'compiledObject':pin(HERE/'build/original-context.o'),'dependencyFile':pin(HERE/'build/original-context.d'),
      'all233ProtectedFilesUnchanged':True,'frozenSdkCacheAndPortsUnchanged':True,'allOwnedRootsAndJobsClosed':True,
      'initialAttemptPreserved':True,'automaticRetry':False}
    (HERE/'INITIAL-NATIVE-VERIFICATION.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':proof['status'],'roots':[row['root'] for row in rows],'proof':pin(HERE/'INITIAL-NATIVE-VERIFICATION.json')}))
if __name__=='__main__':main()
