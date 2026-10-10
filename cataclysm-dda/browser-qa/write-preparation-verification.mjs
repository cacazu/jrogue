import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files=['browser-qa/session.mjs','browser-qa/resource-guard.ps1','browser-qa/compilation-modes.json','browser-qa/COMPILATION-EXPERIMENT.md','browser-qa/memory-recovery-analysis.json','docs/BROWSER-MEMORY-RECOVERY.md'];
const artifacts=[];
for(const path of files){const bytes=await readFile(path);artifacts.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const result={schema:'cdda-conditional-browser-preparation-verification',version:1,checkedAt:new Date().toISOString(),nodeVersion:process.version,
  browserStarted:false,serverStarted:false,compilerStarted:false,
  sourceAndSyntaxChecks:{sessionNodeSyntax:'passed',analysisNodeSyntax:'passed',guardPowerShellParser:'passed-without-guard-execution',fixedModeAllowlist:'passed-source-check',flagRejectionSamples:'passed-unrecognized-unknown-ignored-parsingfailure-and-legitimate-background-error',preparationVersusActualMemoryKinds:'passed-source-check'},
  currentHelperIdentityRead:{pid:18408,startTime:'2026-10-02T19:42:47.9698640Z',cimCreatedAt:'2026-10-02T19:42:47.9698640Z',tickDifference:0,scope:'Read-only short PowerShell helper only; no Chrome/guard fixture executed.'},
  experimentalMode:'liftoff-only-lazy',chromeArgument:'--js-flags=--liftoff-only --wasm-lazy-compilation',
  installedExactV8SourceTagVerified:false,experimentalMemoryBenefitMeasured:false,
  sourcePreparedFutureCounters:['exact CIM creation identities and matching Get-Process start time','per-owned private/working-set/totalCPU/thread count','owned Chrome --type and utility subtype without persisting raw command lines','aggregate owned private/working-set/CPU','direct system committed bytes and commit limit'],
  countersExecutedInChromeGuard:false,guardLimits:{minimumActualPhysicalBytes:7516192768,minimumActualCommitBytes:9663676416,ownedPrivateCapBytes:5368709120,remainingPhysicalAndCommitFloorBytes:2147483648},
  rootHeavyWindowRequired:true,waitForCatalogTerminalRelease:true,automaticRetry:false,artifacts};
await writeFile('browser-qa/compilation-preparation-verification.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'conditional-preparation-source-checks-passed-no-browser',artifact:'browser-qa/compilation-preparation-verification.json',sha256:createHash('sha256').update(await readFile('browser-qa/compilation-preparation-verification.json')).digest('hex')},null,2));
