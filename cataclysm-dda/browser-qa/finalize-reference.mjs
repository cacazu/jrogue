import { readFile, writeFile, mkdir, copyFile, constants } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Parent explicitly assigned this new root evidence artifact after both browser
// runs ended. This script reads archived evidence and creates immutable copies;
// it never launches a browser, server, compiler or process-control helper.
const qa = path.dirname(fileURLToPath(import.meta.url)), root = path.dirname(qa);
const destination = path.join(root, 'evidence/local-browser-reference');
const referencePath = path.join(root, 'evidence/local-browser-reference.json');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const relative = filename => path.relative(root, filename).replaceAll('\\', '/');
async function artifact(filename) {const bytes=await readFile(filename);return {path:relative(filename),bytes:bytes.length,sha256:digest(bytes)};}
const manifestPath=path.join(root,'baseline-preview/web/package-manifest.json');
const manifestBytes=await readFile(manifestPath);
if(digest(manifestBytes)!=='eb09bac0ddaf7373b411bcfe7a60d21e4fd4775689e4e7437e07be0283360f39') throw new Error('Latest corrected package changed; parent review required before archiving it.');
const manifest=JSON.parse(manifestBytes);
if(manifest.sourceCommit!=='7b2efa5cea38e4d4d97dd0e63b28b9148623da59') throw new Error('Unexpected original source.');
await mkdir(destination,{recursive:true});
await copyFile(manifestPath,path.join(destination,'package-manifest.json'),constants.COPYFILE_EXCL);
const runs=[];
for(const [name,id] of [['attempt-1','2026-10-02T19-14-25-977Z'],['clean-retry','2026-10-02T19-30-37-264Z']]) {
  const directory=path.join(qa,'output',id);
  const evidence=JSON.parse(await readFile(path.join(directory,'evidence.json'),'utf8'));
  const guard=JSON.parse((await readFile(path.join(directory,'memory-guard.json'),'utf8')).replace(/^\ufeff/,''));
  const teardown=JSON.parse((await readFile(path.join(directory,'teardown.json'),'utf8')).replace(/^\ufeff/,''));
  if(evidence.status!=='failed-resource-guard'||!teardown.allRecordedOwnedProcessesExited) throw new Error('Require actual ended guard failure and verified owned teardown.');
  const last=guard.samples.at(-1),limits=evidence.memoryLimits;
  const triggers=[];
  if(last.ownedPrivateBytes>limits.privateBudgetBytes)triggers.push('owned-private-cap');
  if(last.freePhysicalBytes<limits.remainingFloorBytes)triggers.push('available-physical-floor');
  if(last.freeCommitBytes<limits.remainingFloorBytes)triggers.push('remaining-commit-floor');
  const keys=evidence.commands.filter(item=>['key','keys'].includes(item.command?.op));
  const metrics=evidence.commands.find(item=>item.command?.op==='metrics')?.result;
  runs.push({name,directory:relative(directory),status:evidence.status,browserVersion:evidence.browserVersion,
    startedAt:evidence.startedAt,teardownCheckedAt:teardown.checkedAt,
    ownedRoot:{pid:evidence.ownedChrome.pid,createdAt:guard.rootCreatedAt,profile:evidence.ownedChrome.profile},
    launchMemory:evidence.startMemory,limits,lastSample:last,
    peakSampledOwnedPrivateBytes:Math.max(...guard.samples.map(sample=>sample.ownedPrivateBytes)),
    minimumSampledPhysicalBytes:Math.min(...guard.samples.map(sample=>sample.freePhysicalBytes)),
    minimumSampledCommitBytes:Math.min(...guard.samples.map(sample=>sample.freeCommitBytes)),
    immediateGuardTriggers:triggers,engineCrashObserved:false,
    runtimeExceptionOrTargetCrashEvents:evidence.runtimeEvents.filter(event=>['Runtime.exceptionThrown','Inspector.targetCrashed'].includes(event.method)),
    attemptedNativeInputs:keys.map(item=>({at:item.at,command:item.command,error:item.error||null})),
    preDataMetrics:metrics||null,allocationStepMetrics:'unavailable while native creation held page execution before guard termination',cpuMetrics:'not captured',
    network:{observedPageRequests:evidence.requests.length,allPageRequestsExactLoopback:evidence.requests.every(request=>new URL(request.url).origin==='http://127.0.0.1:8878'),
      externalPageRequests:evidence.requests.filter(request=>!request.loopback),
      processWideIsolationProven:false,chromeBackgroundEvidence:'Chrome stderr retained Google registration/update-service attempts; distinct from observed game-page requests.'},
    teardown,
    supportingArtifacts:await Promise.all(['evidence.json','memory-guard.json','teardown.json','pre-launch.json','REPORT.md'].map(filename=>artifact(path.join(directory,filename))))});
}
const copies=[
 ['2026-10-02T19-30-37-264Z','01-corrected-native-ja-menu.png','corrected-native-ja-menu.png'],
 ['2026-10-02T19-14-25-977Z','03-native-help.png','native-help-before-catalog-correction.png'],
 ['2026-10-02T19-14-25-977Z','05-native-settings.png','native-settings-before-catalog-correction.png'],
 ['2026-10-02T19-14-25-977Z','06-native-literal-name-input.png','native-cjk-literal-before-catalog-correction.png'],
 ['2026-10-02T19-14-25-977Z','07-mobile-portrait-native-input.png','failed-mobile-portrait-before-canvas-correction.png']
];
const copiedScreenshots=[];
for(const [id,filename,copyName] of copies){const source=path.join(qa,'output',id,filename),target=path.join(destination,copyName);await copyFile(source,target,constants.COPYFILE_EXCL);copiedScreenshots.push({source:await artifact(source),copy:await artifact(target),visuallyInspected:true});}
const report=`# Bounded original-game browser reference\n\nActual original C++0.I-1 Japanese menu and native framebuffer rendered in Chrome154.0.8037.97 at http://127.0.0.1:8878/. Source: ${manifest.sourceCommit}. This is a reference milestone; completePort=false.\n\nTwo isolated actual-browser runs ended under their selected resource guards. Attempt1 crossed its4GiB owned-private cap at4,536,401,920B; the fresh corrected-package retry stayed below5GiB private but crossed its2GiB physical floor at2,078,232,576B. The latter trigger had3,578,896,384B owned private and2,574,352,384B remaining commit. Native custom-world Enter did not complete. No engine/runtime crash or WASM allocation error was observed before these controlled stops. All16 recorded owned PID/creation identities across the two runs exited; the separate game server was preserved.\n\nThe finalized same-bytes Japanese MO adapter passed its hash/mmap proof and native Japanese menu rendered. Fresh native framebuffer640×384 and pre-data WASM512MiB were recorded; full metrics and precise timestamps are in local-browser-reference.json. Earlier native help/settings and literal QA_Kit_日本 input were inspected before the catalog/canvas corrections; that literal was not saved. Earlier portrait390×844 cropped native content; the revised canvas adapter/mobile scale and pan controls remain untested after the retry's desktop resource stop.\n\nFull world/character completion, movement, inventory/item actions, gameplay save/version/archive download/reload/resume, current mobile input/layout and physical-device acceptance remain pending. No full Rust migration, complete semantic text coverage, rendering purity or RNG determinism claim follows. Sound is disabled and GPU uses software SwiftShader. All observed game-page requests were loopback; Chrome background attempts were separately retained, so process-wide isolation is not claimed.\n\nLatest package manifest SHA256: eb09bac0ddaf7373b411bcfe7a60d21e4fd4775689e4e7437e07be0283360f39. Immutable copied manifest/screenshots accompany this report. Full evidence remains in the two browser-qa/output run directories. No additional browser/compiler/server was launched while archiving.\n`;
await writeFile(path.join(destination,'REPORT.md'),report,{flag:'wx'});
const reference={schema:'cdda-local-browser-reference',version:1,createdAt:new Date().toISOString(),
  status:'partial-native-reference-game-start-resource-blocked',actualOriginalEngineBrowserRun:true,completePort:false,referenceOnly:true,
  fullGameplayAcceptance:false,sourceCommit:manifest.sourceCommit,selectedEngine:manifest.selectedEngine,
  latestManifest:{original:await artifact(manifestPath),immutableCopy:await artifact(path.join(destination,'package-manifest.json'))},
  localUrl:'http://127.0.0.1:8878/',boundedObservedPasses:['actual original native menu rendering','pinned Japanese MO/mmap adapter and native Japanese main menu','fresh native640x384 framebuffer','original native help/settings and visible CJK literal input in earlier run','original IDBFS options restoration/periodic callbacks','all owned PID/creation identities exited'],
  pending:['complete world/character creation','movement','inventory/item actions','native gameplay save/version','exact native save archive download','gameplay reload/resume','current mobile viewport/pan/scale/native touch acceptance','fresh mobile-first startup','full Rust presentation/input/platform migration','complete semantic text coverage','render purity','RNG determinism'],
  noObservedEngineCrashQualification:'Both runs were stopped by their explicit owned resource guards; native Enter could not complete and CDP subsequently closed. This does not establish that engine/gameplay work would finish without a guard.',
  activeQaChromeProcesses:0,qaControlServersStopped:true,separatePackageServerPreserved:true,retriesAfterCleanRetry:0,
  limitations:['Desktop mobile emulation is not a physical device.','Software SwiftShader, not hardware GPU acceptance.','Original C++ reference frontend with bounded Rust shell/helpers.','Sound disabled.','No saved-name roundtrip or gameplay save/RNG/render acceptance.'],
  runs,copiedScreenshots,report:await artifact(path.join(destination,'REPORT.md'))};
await writeFile(referencePath,JSON.stringify(reference,null,2)+'\n',{flag:'wx'});
await writeFile(path.join(qa,'current-results.json'),JSON.stringify({status:reference.status,completeGameplayFlows:false,completePort:false,actualGameRuntime:true,sourceCommit:reference.sourceCommit,immutableReference:await artifact(referencePath),activeQaChromeProcesses:0,fullGameplayAcceptance:false,pending:reference.pending,attemptDirectories:runs.map(run=>run.directory)},null,2)+'\n');
console.log(JSON.stringify({status:'immutable-reference-written',reference:await artifact(referencePath),copiedScreenshots:copiedScreenshots.length,runs:runs.map(run=>({name:run.name,trigger:run.immediateGuardTriggers,allOwnedExited:run.teardown.allRecordedOwnedProcessesExited}))},null,2));
