import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintBuildInputs} from './build-inputs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bytes = file => readFile(path.join(root, file));
const json = async file => JSON.parse((await bytes(file)).toString('utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const positive = value => Number.isFinite(value) && value > 0;
const sameOutputs = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const browserPaths = {
  browser: 'tests/browser-review-evidence/results.json',
  gameFlows: 'tests/browser-gameflow-evidence/results.json',
  wizardEndgame: 'tests/browser-victory-evidence/results.json',
  packagedBrowser: 'dist/tests/browser-review-evidence/results.json',
  wasmDescriptors: 'tests/wasm-descriptor-evidence/results.json',
  normalPlay: 'tests/browser-normal-play-evidence/results.json',
  remainingPresentations: 'tests/browser-presentation-remaining-evidence/results.json',
  nativePerception: 'tests/browser-native-perception-evidence/results.json'
};
const browserEntries = await Promise.all(Object.entries(browserPaths).map(async ([name, file]) => [name, await json(file)]));
const evidence = Object.fromEntries(browserEntries);
const [engineBytes, schema, en, ja, pack, fingerprint, coverageAudit, perceptionBoundary] = await Promise.all([
  bytes('build/manifest.json'), json('locales/review-schema.json'), json('locales/review-en.json'),
  json('locales/review-ja.json'), json('build/package-manifest.json'), fingerprintBuildInputs(root),
  json('migration/coverage-audit.json'), json('migration/perception-rng-boundary.json')
]);
const engine = JSON.parse(engineBytes.toString('utf8'));
const engineManifestSha256 = sha256(engineBytes);
assert.equal(fingerprint.sha256, engine.inputFingerprint.sha256, 'current source differs from compiled engine inputs');
assert.ok(Array.isArray(engine.outputs) && engine.outputs.length > 0, 'engine output pins missing');
for (const output of engine.outputs) {
  const data = await bytes(`build/${output.name}`);
  assert.equal(data.length, output.bytes, `${output.name}: compiled output length changed`);
  assert.equal(sha256(data), output.sha256, `${output.name}: compiled output hash changed`);
}

// Browser acceptance is tied to the final artifact, including its source fingerprint.
// The isolated descriptor runner records its manifest hash inside engine instead.
for (const [name, result] of browserEntries) {
  assert.equal(result.passed, true, `${name}: harness did not pass`);
  assert.equal(result.engineStableDuringRun, true, `${name}: engine was not stable during the run`);
  assert.ok(Number.isFinite(Date.parse(result.finishedAt)), `${name}: harness has not finished`);
  assert.ok(Array.isArray(result.checks) && result.checks.length > 0, `${name}: checks missing`);
  assert.ok(result.checks.every(check => check.passed === true), `${name}: failed or pending checks`);
  assert.deepEqual(result.errors, [], `${name}: runtime errors`);
  assert.ok(sameOutputs(result.engine?.outputs, engine.outputs), `${name}: output pins differ from final engine`);
  assert.equal(result.engine?.inputFingerprint?.sha256, engine.inputFingerprint.sha256, `${name}: source fingerprint differs`);
  if (name === 'wasmDescriptors') {
    assert.equal(result.stable, true, 'descriptor fixture changed during its run');
    assert.equal(result.engine.stable, true, 'descriptor engine capture changed during its run');
    assert.equal(result.engine.manifest_sha256, engineManifestSha256, 'descriptor manifest hash differs');
    assert.equal(result.upstreamCommit, engine.upstreamCommit, 'descriptor upstream differs');
  } else {
    assert.deepEqual(result.consoleErrors, [], `${name}: browser console errors`);
    assert.equal(result.engineManifestSha256, engineManifestSha256, `${name}: manifest hash differs`);
    assert.equal(result.engine.upstreamCommit, engine.upstreamCommit, `${name}: upstream differs`);
    assert.ok(sameOutputs(result.engineHashes, engine.outputs), `${name}: loaded browser output hashes differ`);
    if ('outputs' in result) assert.ok(sameOutputs(result.outputs, engine.outputs), `${name}: additional output pins differ`);
  }
  if ('pass' in result) assert.equal(result.pass, true, `${name}: pass flag differs`);
  if ('notRun' in result) assert.deepEqual(result.notRun, [], `${name}: required paths were not run`);
}

const resourceNames = [
  'rust-native-review', 'node-review', 'build', 'browser-review', 'browser-gameflows',
  'browser-victory', 'browser-dist', 'wasm-descriptors', 'browser-normal',
  'browser-presentations', 'browser-native-perception', 'history-fixture', 'recall-fixture', 'look-fixture'
];
const jobs = Object.fromEntries(await Promise.all(resourceNames.map(async name => [name,
  await json(`tests/source-integration-evidence/${name}-resources.json`)])));
for (const [name, job] of Object.entries(jobs)) {
  assert.equal(job.exitCode, 0, `${name}: measured job failed or remains pending`);
  assert.equal(job.stoppedForCommitExhaustion, false, `${name}: resource exhaustion stopped the job`);
  assert.equal(job.concurrency, 1, `${name}: measured jobs must be serialized`);
  assert.ok(positive(job.wallSeconds) && positive(job.sampledPeakTreeWorkingSetBytes), `${name}: resource measurements missing`);
  assert.ok(Array.isArray(job.command) && job.command.length > 0 && Number.isFinite(Date.parse(job.startedAt)), `${name}: measured command missing`);
}
const browserJobs = {
  browser: 'browser-review', gameFlows: 'browser-gameflows', wizardEndgame: 'browser-victory',
  packagedBrowser: 'browser-dist', wasmDescriptors: 'wasm-descriptors', normalPlay: 'browser-normal',
  remainingPresentations: 'browser-presentations', nativePerception: 'browser-native-perception'
};
for (const [name, jobName] of Object.entries(browserJobs)) {
  const result = evidence[name], job = jobs[jobName];
  const start = Date.parse(result.startedAt), finish = Date.parse(result.finishedAt), measuredStart = Date.parse(job.startedAt);
  assert.ok(Number.isFinite(start) && start >= measuredStart && finish >= start &&
    finish <= measuredStart + job.wallSeconds * 1000 + 2000,
  `${name}: browser evidence does not belong to its measured job`);
}

const logs = Object.fromEntries(await Promise.all(['rust-native-review', 'node-review', 'history-fixture', 'recall-fixture', 'look-fixture']
  .map(async name => [name, (await bytes(`tests/source-integration-evidence/${name}.log`)).toString('utf8')])));
function summaryCounter(log, label) {
  const match = log.match(new RegExp(`^[^a-zA-Z0-9]*${label} (\\d+)\\s*$`, 'm'));
  assert.ok(match, `${label}: test log summary missing`);
  return Number(match[1]);
}
const rustResults = [...logs['rust-native-review'].matchAll(/test result: ok\. (\d+) passed; (\d+) failed/g)];
assert.ok(rustResults.length > 0 && rustResults.every(match => Number(match[2]) === 0), 'Rust test log failed or incomplete');
const rustCount = Math.max(...rustResults.map(match => Number(match[1])));
assert.ok(positive(rustCount), 'Rust test log contains no passing tests');
const nodeCount = summaryCounter(logs['node-review'], 'pass');
assert.ok(positive(nodeCount), 'Node test log contains no passing tests');
assert.equal(summaryCounter(logs['node-review'], 'tests'), nodeCount, 'Node tests were not all accepted');
for (const label of ['fail', 'cancelled', 'skipped', 'todo']) assert.equal(summaryCounter(logs['node-review'], label), 0, `Node ${label} tests`);
function logJson(log, field) {
  for (const line of log.split(/\r?\n/).reverse()) {
    if (!line.startsWith('{')) continue;
    let parsed;
    try { parsed = JSON.parse(line); } catch { continue; }
    if (Object.hasOwn(parsed, field)) return parsed;
  }
  assert.fail(`${field}: isolated fixture log result missing`);
}
async function checkPins(pins, label) {
  assert.ok(pins && typeof pins === 'object' && Object.keys(pins).length > 0, `${label}: input pins missing`);
  for (const [file, hash] of Object.entries(pins)) {
    assert.match(hash, /^[0-9a-f]{64}$/, `${label}: invalid pin for ${file}`);
    assert.equal(sha256(await bytes(file)), hash, `${label}: current input differs: ${file}`);
  }
}
const historyFixture = logJson(logs['history-fixture'], 'actualCHistoryWireChecks');
assert.ok(positive(historyFixture.actualCHistoryWireChecks) && positive(historyFixture.strictPrefixLengthsRejected), 'history fixture checks missing');
for (const key of ['nativeLedgerUnchanged', 'fixtureInputsStableDuringRun', 'rustReviewBoundaryStubbed', 'messageStorageBoundariesStubbed', 'testDriverOnly'])
  assert.equal(historyFixture[key], true, `history fixture: ${key}`);
assert.equal(historyFixture.fullEngineOrBrowserAcceptance, false, 'history fixture scope changed');
assert.equal(historyFixture.compilerTimeoutSeconds, 120, 'history compiler must remain bounded');
assert.equal(historyFixture.runtimeTimeoutSeconds, 30, 'history runtime must remain bounded');
assert.equal(historyFixture.nativeFormatterSourceUnmodified, true, 'history fixture did not execute the unmodified native formatter');
assert.ok(Number.isInteger(historyFixture.actualNativeFormatterOrdinals) && historyFixture.actualNativeFormatterOrdinals >= 240, 'history native formatter ordinal coverage missing');
assert.equal(historyFixture.unsupportedSizeModifierRejected, true, 'history fixture did not reject the original unsupported size modifier');
assert.equal(historyFixture.selectedHistoryFormatter?.path, 'logic/ui-history.c', 'history fixture selected source differs');
assert.equal(historyFixture.selectedHistoryFormatter?.sha256, sha256(await bytes('logic/ui-history.c')), 'history formatter fixture source is stale');
assert.equal(historyFixture.fixtureInputs?.['logic/ui-history.c'], historyFixture.selectedHistoryFormatter.sha256, 'history selected formatter/input pins differ');

await checkPins(historyFixture.fixtureInputs, 'history fixture');
assert.ok(Array.isArray(historyFixture.compiledActualSources) && historyFixture.compiledActualSources.length > 0, 'history compiled sources missing');
for (const source of historyFixture.compiledActualSources)
  assert.equal(source.sha256, historyFixture.fixtureInputs[source.path], `history source pin mismatch: ${source.path}`);

const recallFixture = logJson(logs['recall-fixture'], 'actualCFixtureAccepted');
assert.equal(recallFixture.actualCFixtureAccepted, true, 'recall C fixture failed');
assert.equal(recallFixture.nativeQueueAndSaveLoadUsed, true, 'recall fixture did not use native queue/save/load');
assert.equal(recallFixture.externalDeploymentPerformed, false, 'recall fixture publication scope changed');
assert.ok(positive(summaryCounter(logs['recall-fixture'], 'pass')), 'recall fixture tests missing');
assert.equal(summaryCounter(logs['recall-fixture'], 'tests'), summaryCounter(logs['recall-fixture'], 'pass'), 'recall fixture tests incomplete');
for (const label of ['fail', 'cancelled', 'skipped', 'todo']) assert.equal(summaryCounter(logs['recall-fixture'], label), 0, `recall fixture ${label} tests`);
const recallBuildFile = 'migration/message-recall-storage-data/fixture-build.json';
const recallBuild = await json(recallBuildFile);
assert.equal(recallBuild.sourceStableDuringBuild, true, 'recall fixture source changed during build');
assert.equal(recallFixture.inputFiles, Object.keys(recallBuild.inputs).length, 'recall fixture input inventory differs');
await checkPins(recallBuild.inputs, 'recall fixture');
assert.deepEqual(recallFixture.outputs, recallBuild.outputs, 'recall fixture log/build output pins differ');
for (const [file, hash] of Object.entries(recallBuild.outputs))
  assert.equal(sha256(await bytes(`migration/message-recall-storage-data/${file}`)), hash, `recall fixture output differs: ${file}`);

const lookFixture = logJson(logs['look-fixture'], 'eventContractsValidated');
assert.equal(lookFixture.passed, true, 'look C fixture failed');
assert.equal(lookFixture.sourceStableDuringRun, true, 'look fixture source changed during run');
for (const key of ['checks', 'conditionCases', 'coordinateCases', 'events', 'eventContractsValidated'])
  assert.ok(positive(lookFixture[key]), `look fixture: ${key} missing`);
assert.equal(lookFixture.events, lookFixture.eventContractsValidated, 'look event contracts incomplete');
assert.equal(lookFixture.liveSnapshots, 0, 'look fixture leaked captured snapshots');
assert.equal(lookFixture.compiledGameEngine, false, 'look fixture scope changed');
await checkPins(lookFixture.sourceHashes, 'look fixture');

const {normalPlay, remainingPresentations, nativePerception, wizardEndgame} = evidence;
for (const [name, result] of [['normalPlay', normalPlay], ['remainingPresentations', remainingPresentations]]) {
  assert.equal(result.normalPlay, true, `${name}: ordinary-command fixture expected`);
  for (const key of ['wizardCommands', 'cheatCommands', 'engineMemoryWrites']) assert.equal(result[key], 0, `${name}: ${key}`);
  assert.equal(result.syntheticNativeState, false, `${name}: synthetic native state`);
  assert.equal(result.campaign.complete100Levels, false, `${name}: unsupported full campaign claim`);
  assert.ok(Array.isArray(result.actions) && result.actions.length > 0, `${name}: actual command trace missing`);
}
assert.equal(normalPlay.campaign.normalDeath, true, 'normal play did not reach ordinary native death');
assert.ok(positive(normalPlay.campaign.maximumDepth), 'normal play did not enter a generated dungeon');
assert.equal(wizardEndgame.fixture, 'wizard_debug_commands', 'endgame fixture must remain explicitly wizard-assisted');
assert.equal(wizardEndgame.normalCampaignCompletion, false, 'wizard endgame is not normal campaign completion');
assert.equal(wizardEndgame.scoreEligible, false, 'wizard endgame must remain unranked');
assert.equal(nativePerception.fixture, 'wizard_original_perception_commands', 'perception fixture label changed');
for (const key of ['normalPlay', 'normalCampaignCompletion', 'complete100Levels', 'scoreEligible', 'syntheticNativeState'])
  assert.equal(nativePerception[key], false, `perception fixture: ${key}`);
assert.equal(nativePerception.engineMemoryWrites, 0, 'perception fixture wrote native engine memory');
assert.equal(nativePerception.sourceStableDuringRun, true, 'native perception sources changed during run');
assert.equal(nativePerception.sourceCommit, engine.upstreamCommit, 'native perception upstream differs');
assert.ok(Array.isArray(nativePerception.debugCommands) && nativePerception.debugCommands.length > 0, 'perception original debug command trace missing');
assert.equal(perceptionBoundary.noOriginalGameProcessingChange, true, 'original perception processing changed');
assert.equal(perceptionBoundary.upstream.commit, engine.upstreamCommit, 'perception audit upstream differs');
assert.deepEqual(nativePerception.source.upstream, perceptionBoundary.upstream, 'perception source provenance differs');
assert.ok(Array.isArray(nativePerception.source.sources) && nativePerception.source.sources.length > 0, 'perception source pins missing');
for (const source of nativePerception.source.sources) {
  const data = await bytes(source.path);
  assert.equal(data.length, source.bytes, `perception source bytes changed: ${source.path}`);
  assert.equal(sha256(data), source.sha256, `perception source hash changed: ${source.path}`);
}
for (const pristine of perceptionBoundary.pristineSources) {
  assert.equal(pristine.pristineUpstreamBytesEqual, true, `perception original source differs: ${pristine.path}`);
  const captured = nativePerception.source.sources.find(source => source.path === pristine.path);
  assert.ok(captured, `perception original source not captured: ${pristine.path}`);
  assert.equal(captured.sha256, pristine.sha256, `perception original source hash differs: ${pristine.path}`);
  assert.equal(captured.bytes, pristine.bytes, `perception original source bytes differ: ${pristine.path}`);
}
const hallucination = nativePerception.nativeHallucination, animation = nativePerception.nativeAnimation;
assert.equal(hallucination.nativeDrawsObserved, true, 'native hallucination RNG draws missing');
assert.equal(hallucination.replayMatched, true, 'native hallucination replay mismatch');
assert.ok(Array.isArray(hallucination.changedRngWords) && hallucination.changedRngWords.length > 0, 'hallucination must show original shared RNG consumption');
assert.equal(animation.allTurnReplaysMatched, true, 'native animation continuation mismatch');
assert.equal(animation.totalTurnRngAlsoIncludesMonsterAndWorld, true, 'animation evidence must retain shared native RNG limitation');
assert.ok(positive(animation.turns) && Array.isArray(animation.visibleColors) && animation.visibleColors.length > 1, 'native multihued animation not observed');

const keys = Object.keys(schema.entries).sort();
const textKeysEqual = JSON.stringify(keys) === JSON.stringify(Object.keys(en).sort()) && JSON.stringify(keys) === JSON.stringify(Object.keys(ja).sort());
assert.ok(textKeysEqual, 'English/Japanese/schema catalog keys differ');
assert.equal(coverageAudit.completeCoverage, false, 'source audit must not claim complete gameplay text coverage');
assert.equal(coverageAudit.upstreamCommit, engine.upstreamCommit, 'coverage audit upstream differs');
assert.equal(coverageAudit.catalogEntries, keys.length, 'coverage audit catalog count is stale');
for (const locale of ['en', 'ja', 'schema']) assert.equal(coverageAudit.catalogAgreement[locale], keys.length, `coverage audit ${locale} count is stale`);
assert.equal(coverageAudit.catalogAgreement.identicalKeys, true, 'coverage audit catalog agreement failed');
assert.equal(coverageAudit.nativePersistence.originalBlocksUnchanged, true, 'native persistence block bytes changed');
assert.ok(coverageAudit.sourceConnectedPresentationFamilies.length > 0 && coverageAudit.sourceConnectedPresentationFamilies.every(family => family.sourceConnected === true), 'source presentation families incomplete');
await checkPins(Object.fromEntries(coverageAudit.catalogAdditionManifests.map(manifest => [manifest.file, manifest.sha256])), 'coverage manifest');

assert.equal(pack.localPackageAccepted, true, 'local package guard failed');
assert.equal(pack.externalDeploymentPerformed, false, 'unexpected external publication');
assert.equal(pack.completeRequestedPort, false, 'package must retain full-port limitation');
assert.ok(sameOutputs(pack.engine?.outputs, engine.outputs), 'package contains a different engine');
assert.equal(pack.engine?.inputFingerprint?.sha256, engine.inputFingerprint.sha256, 'package source fingerprint differs');
assert.equal(pack.engine?.upstreamCommit, engine.upstreamCommit, 'package upstream differs');
for (const file of ['source.zip', 'dist/source.zip']) {
  const data = await bytes(file);
  assert.equal(data.length, pack.sourceZipBytes, `${file}: package source length differs`);
  assert.equal(sha256(data), pack.sourceZipSha256, `${file}: package source hash differs`);
}

const fixtureReports = {};
for (const [name, result] of [['history', historyFixture], ['recall', recallFixture], ['look', lookFixture]]) {
  const job = `${name}-fixture`;
  fixtureReports[name] = {accepted: true, evidence: result,
    log: `tests/source-integration-evidence/${job}.log`, logSha256: sha256(await bytes(`tests/source-integration-evidence/${job}.log`)),
    resources: `tests/source-integration-evidence/${job}-resources.json`,
    resourceSha256: sha256(await bytes(`tests/source-integration-evidence/${job}-resources.json`)),
    currentInputPinsMatched: true, fullEngineOrBrowserAcceptance: false};
}
fixtureReports.recall.buildManifest = {file: recallBuildFile, sha256: sha256(await bytes(recallBuildFile)), outputPinsMatched: true};
const checkCount = name => evidence[name].checks.length;
const report = {
  verifiedAt: new Date().toISOString(),
  milestone: 'Original Angband gameplay, source-selected Japanese presentation and version3 deterministic replay; local HTML/Node acceptance',
  milestoneVerified: true, completeRequestedPort: false, complete100Levels: false,
  upstream: {version: engine.engineVersion, commit: engine.upstreamCommit}, engine,
  sourceMatchesCompiledInputs: true,
  tests: {
    rustPassed: rustCount, hostAndSourcePassed: nodeCount,
    browserChecksPassed: checkCount('browser'), additionalGameFlowChecksPassed: checkCount('gameFlows'),
    wizardEndgameChecksPassed: checkCount('wizardEndgame'), packagedBrowserChecksPassed: checkCount('packagedBrowser'),
    wasmDescriptorChecksPassed: checkCount('wasmDescriptors'), normalPlayChecksPassed: checkCount('normalPlay'),
    remainingPresentationChecksPassed: checkCount('remainingPresentations'), nativePerceptionChecksPassed: checkCount('nativePerception'),
    exactEngineMatched: true, browserEvidence: browserPaths, isolatedCFixtures: fixtureReports
  },
  normalPlay: {accepted: true, fixture: 'ordinary original commands', normalDeath: true,
    maximumDepth: normalPlay.campaign.maximumDepth, complete100Levels: false,
    wizardCommands: 0, cheatCommands: 0, engineMemoryWrites: 0, syntheticNativeState: false},
  wizardEvidence: {
    endgame: {fixture: wizardEndgame.fixture, normalCampaignCompletion: false, scoreEligible: false},
    nativePerception: {fixture: nativePerception.fixture, normalCampaignCompletion: false, scoreEligible: false,
      sourceStableDuringRun: true, originalGameProcessingUnchanged: true,
      hallucination, animation, rngScope: 'Original native shared RNG; animation turn totals also include monster and world processing'}
  },
  text: {reviewedTypedCatalogIds: keys.length, catalogKeysEqual: textKeysEqual, completeCoverage: false,
    coverageAuditFile: 'migration/coverage-audit.json', coverageAudit,
    coverage: 'Source producer/lexeme bindings with matching final-browser paths. The source audit records its earlier runtime status; final runtime acceptance is evaluated separately above. Authored entries do not prove every native branch executed.'},
  localPackage: pack, resources: jobs,
  publication: {scope: 'local HTML served and tested with Node', externalDeploymentPerformed: false, localUrl: 'http://127.0.0.1:4173/web/'},
  saveEvidence: {version: 3,
    paths: 'Exact pending-input and town/dungeon continuations with all38 RNG words; source history/message sidecars and native persistence exercised by isolated C fixtures and matching browser flows.',
    nativePersistence: coverageAudit.nativePersistence,
    legacyNativeSaveBlockComparison: 'Original native save blocks remain unchanged. Version3 reconstructs the original process from genesis and the owned event journal; optional observational sidecars retain source identity.'},
  remaining: [
    'Complete text producer and branch coverage beyond reviewed source graphs and representative executed paths; preserve explicit inventories.',
    'Normal complete100-level campaigns, arena and optional adapters remain outside this acceptance. Normal native death and unranked wizard-assisted endgame/perception evidence are separate.',
    'Parent-coordinated shared-repository Git checkpoint.'
  ]
};
// Every guard above must pass before replacing the last accepted verification.
await writeFile(path.join(root, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({milestoneVerified: true, completeRequestedPort: false, complete100Levels: false,
  tests: report.tests, text: {reviewedTypedCatalogIds: keys.length, catalogKeysEqual: true, completeCoverage: false},
  externalDeploymentPerformed: false}));
