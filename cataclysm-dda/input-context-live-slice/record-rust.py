"""Freeze genuine selected-original-context Rust acceptance; no toolchain launch."""
from pathlib import Path
import hashlib
import json
import re
HERE=Path(__file__).resolve().parent
B=HERE/'rust-build-plan'
A=B/'execution/original-context-rust-initial'
STAGE='actual-original-context-rust-consumer'
def demand(ok,message):
    if not ok: raise RuntimeError(message)
def read(path): return json.loads(Path(path).read_bytes())
def pin(path):
    path=Path(path).resolve();data=path.read_bytes()
    return {'path':str(path),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def main():
    plan=read(B/'rust-consumer-plan.json');terminal=read(A/'terminal.json')
    demand(terminal['allFiveRustTestsPassed'] and terminal['RustActualOriginalRecordConsumersExecuted'] and terminal['allOwnedJobsAndExactRootHandlesClosed'] and terminal['protectedPinnedBytesUnchanged'] and terminal['protectedPinnedFileCount']==540,'five-test terminal incomplete')
    demand((A/'input-fingerprints-before.json').read_bytes()==(A/'input-fingerprints-after.json').read_bytes(),'protected bytes changed')
    names=plan['expectedOrderedTests'];stdout=(A/(STAGE+'.stdout.log')).read_text(encoding='utf-8')
    reports=re.findall(r'^test ([a-zA-Z0-9_:]+) \.\.\. (ok|FAILED|ignored)$',stdout,re.MULTILINE)
    demand(reports==[(n,'ok') for n in names] and len(names)==5,'exact five reports missing')
    demand(re.search(r'^test result: ok\. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in [0-9.]+s$',stdout,re.MULTILINE),'five-test summary missing')
    raw=read(A/(STAGE+'.json'));cleanup=read(A/(STAGE+'.outer-cleanup.json'))
    demand(raw['passed'] and raw['exitCode']==0 and not raw['remainingOwnedPidsBeforeJobClose'] and cleanup['passed'] and not cleanup['remainingOwnedJobHandles'] and not cleanup['errors'],'resource closure missing')
    root=raw['rootIdentity'];created=cleanup['rootsCreated'];demand(len(created)==1 and created[0]['pid']==root['pid'] and {'processHandle':created[0]['processHandle'],'action':'close-owned-process-handle'} in cleanup['outerActions'],'exact returned root closure missing')
    for record in plan['actualNativeJsonPins']: demand(pin(record['path'])==record,'actual record changed')
    binaries=list((B/'target/x86_64-pc-windows-gnu/debug/deps').glob('cdda_original_context_consumer-*.exe'))
    demand(len(binaries)==1,'exact one root test binary required')
    proof={'schemaVersion':1,'status':'five-actual-original-context-rust-tests-passed','sourceCommit':plan['sourceCommit'],'moduleBuildIdentity':plan['moduleBuildIdentity'],
        'priorActualOriginalNativeProof':pin(HERE/'ORIGINAL-CONTEXT-VERIFICATION.json'),'actualNativeRecords':plan['actualNativeJsonPins'],'nativeRecordCount':24,
        'tests':[{'name':n,'passed':True} for n in names],'distinctTestCount':5,'actualCompiledTestSource':pin(HERE/'rust-consumer/src/lib.rs'),'manifest':pin(HERE/'rust-consumer/Cargo.toml'),'lock':pin(HERE/'rust-consumer/Cargo.lock'),'testBinary':pin(binaries[0]),
        'plan':pin(B/'rust-consumer-plan.json'),'owner':pin(B/'run-rust-window.py'),'terminal':pin(A/'terminal.json'),'rawMetrics':pin(A/(STAGE+'.json')),'cleanup':pin(A/(STAGE+'.outer-cleanup.json')),'stdout':pin(A/(STAGE+'.stdout.log')),'stderr':pin(A/(STAGE+'.stderr.log')),
        'durationSeconds':raw['durationSeconds'],'jobPeakPrivateBytes':raw['jobPeakPrivateBytes'],'maximumSampledWorkingSetBytes':max(s['ownedWorkingSetBytes'] for s in raw['samples']),
        'freshCounters':raw['freshGate'],'minimumPhysicalFreeBytes':min(s['physicalFreeBytes'] for s in raw['samples']),'minimumExactCommitHeadroomBytes':min(s['exactCommitHeadroomBytes'] for s in raw['samples']),
        'root':{'pid':root['pid'],'processHandle':created[0]['processHandle'],'creationFiletimeDecimal':str(root['creationFiletime']),'explicitlyClosed':True},
        'exactOwnedIdentities':[{'pid':pid,'creationFiletimeDecimal':str(stamp)} for pid,stamp in sorted({(x['pid'],x['creationFiletime']) for x in raw['identities']})],
        'remainingOwnedPids':[],'remainingOwnedJobHandles':[],'cleanupErrors':[],'all540ProtectedFilesUnchanged':True,'allOwnedRootsAndJobsClosed':True,'ordinaryCargoMetadataAllowed':True,
        'actualFrozenRustParserAndTypesExecuted':True,'selectedOriginalClassExecutionProvedInPriorNativeWindow':True,'originalInputContextExecutedInThisRustWindow':False,
        'nativeRecordsSubstituted':False,'commandAuthorization':'Denied(UntrackedNativeReaders)','rawUsernameScope':plan['rawUsernameScope'],
        'RustWasmBrowserAdapterExecuted':False,'realBrowserRustInputConsumerVerified':False,'liveEngineIntegrated':False,'wholeGameVerified':False}
    (HERE/'ORIGINAL-CONTEXT-RUST-VERIFICATION.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':proof['status'],'tests':5,'records':24,'root':proof['root'],'proof':pin(HERE/'ORIGINAL-CONTEXT-RUST-VERIFICATION.json')}))
if __name__=='__main__':main()
