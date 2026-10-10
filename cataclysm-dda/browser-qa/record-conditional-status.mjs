import { readFile, writeFile } from 'node:fs/promises';
const samples = (await readFile('browser-qa/cheap-memory-checks.jsonl', 'utf8')).trim().split('\n').map(line => JSON.parse(line));
const current = JSON.parse(await readFile('browser-qa/current-results.json', 'utf8'));
const preparation = JSON.parse(await readFile('browser-qa/compilation-preparation-current.json', 'utf8'));
const heldByParent = process.argv.includes('--held-by-parent') || process.argv.includes('--held-presentation-parser');
const guardProofPending = process.argv.includes('--guard-proof-pending');
const counterFailed = process.argv.includes('--guard-counter-failed');
const heldReason = samples.at(-1).parentWindow || 'a small parent-coordinated verification window';
const conditionalRecovery = {
  status: counterFailed ? 'blocked-current-counter-precision-no-browser' : guardProofPending ? 'guard-readiness-pending-no-browser' : heldByParent ? 'awaiting-parent-heavy-slot-release-no-browser' : 'awaiting-fresh-resource-fit-no-browser', updatedAt: new Date().toISOString(),
  guardReadiness: counterFailed ? 'Actual Node prerequisite failed closed on CIM microsecond versus Get-Process 100ns precision; no Chrome before revised exact-identity proof.' : guardProofPending ? 'Source changes invalidate prior preparation pins until new guard regressions and source review pass.' : 'See current pinned preparation evidence.',
  candidateConsumed: false, mode: 'liftoff-only-lazy',
  exactChromeArgument: '--js-flags=--liftoff-only --wasm-lazy-compilation',
  launchGateBytes: { physical: 7516192768, commit: 9663676416 },
  ownedPrivateCapBytes: 5368709120, runningPhysicalAndCommitFloorBytes: 2147483648,
  latestReadOnlyMemory: samples.at(-1), cheapSampleCount: samples.length,
  largeHashPreflightRepeatedAfterNoFit: false, profileCreatedAfterNoFit: false, browserStarted: false,
  sourcePreparation: preparation,
  sourceStageClarification: 'browser-qa/source-stage-clarification.json',
  startupCoreLoadAddendum: 'browser-qa/startup-core-load-stage-addendum.json',
  independentSourceReview: 'browser-qa/source-stage-independent-review.json',
  hostRenderMetadataCommand: { path: 'browser-qa/commands/host-render-metadata.json', execution: 'unexecuted' },
  heavySlot: heldByParent ? 'Held by parent for ' + heldReason + '. Explicit parent release required before any Chrome launch, even if resources fit.' : 'Parent has released other native stages and reserved one conditional browser window. A later parent reservation overrides this record.',
  decisiveLaunchCheck: 'Only after a plausible cheap fit, stream unchanged package bytes and remeasure immediately before spawn. A source/preparation snapshot does not authorize launch without the fresh gate.',
  experimentalMemoryBenefitMeasured: false,
  fullGameSaveResumeMobileAcceptance: 'pending',
  historicalReportsEdited: false, automaticRetry: false
};
await writeFile('browser-qa/conditional-browser-recovery-status.json', JSON.stringify(conditionalRecovery, null, 2) + '\n');
current.conditionalRecovery = conditionalRecovery;
await writeFile('browser-qa/current-results.json', JSON.stringify(current, null, 2) + '\n');
console.log(JSON.stringify({ status: conditionalRecovery.status, candidateConsumed: false, latestSampleAt: samples.at(-1).at, cheapSampleCount: samples.length, browserStarted: false }));
