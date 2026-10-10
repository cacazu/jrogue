import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parsePackagingArgs, inspectEngineSelection, assertEngineSelectionUnchanged } from './engine-selection.mjs';

// Tiny guard fixtures only: these files are not a compiled game or completion
// evidence. No compiler, file_packager, server, browser or SDK cache is used.
const ownerRoot = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = fs.mkdtempSync(path.join(ownerRoot, '.engine-selection-fixtures-'));
const buildRoot = path.join(fixtureRoot, 'engine-build');
const candidateRoot = path.join(buildRoot, 'candidates', 'o1-conservative-asyncify');
const engineDir = path.join(candidateRoot, 'output');
const engineEvidence = path.join(candidateRoot, 'evidence', 'full-engine-build.json');
const sourceCommit = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
let assertions = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
const rejects = (fn, pattern) => { assert.throws(fn, pattern); assertions++; };
const hash = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const write = (filename, content) => { fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, content); };
const json = (filename, value) => write(filename, JSON.stringify(value, null, 2) + '\n');

try {
  const defaults = parsePackagingArgs([], buildRoot);
  check(defaults.mode, '--inventory');
  check(defaults.engineDir, path.join(buildRoot, 'output'));
  check(defaults.engineEvidence, path.join(buildRoot, 'evidence', 'full-engine-build.json'));
  const explicit = parsePackagingArgs(['--preflight', '--engine-dir', engineDir, '--ja-mo', 'reviewed catalog.mo', '--engine-evidence', engineEvidence], buildRoot);
  check(explicit.engineDir, engineDir);
  check(explicit.explicitEngineSelection, true);
  rejects(() => parsePackagingArgs(['--preflight', '--engine-dir', engineDir], buildRoot), /both --engine-dir/);
  rejects(() => parsePackagingArgs(['--preflight', '--engine-evidence', engineEvidence], buildRoot), /both --engine-dir/);
  rejects(() => parsePackagingArgs(['--package', '--ja-mo'], buildRoot), /path is required/);
  rejects(() => parsePackagingArgs(['--package', '--ja-mo', '--engine-dir'], buildRoot), /path is required/);
  rejects(() => parsePackagingArgs(['--preflight', '--ja-mo', 'a', '--ja-mo', 'b'], buildRoot), /Duplicate/);
  rejects(() => parsePackagingArgs(['--preflight', '--unknown', 'a'], buildRoot), /Unknown/);
  rejects(() => parsePackagingArgs(['--build'], buildRoot), /Use --inventory/);

  const options = { engineDir, engineEvidence, explicitEngineSelection: true, buildRoot, sourceCommit };
  const pending = inspectEngineSelection(options);
  check(pending.ready, false);
  check(pending.missingEngineFiles, ['cataclysm-tiles.js', 'cataclysm-tiles.wasm']);
  rejects(() => assertEngineSelectionUnchanged(pending), /not ready/);
  rejects(() => inspectEngineSelection({ ...options, engineDir: path.join(buildRoot, 'unknown-output') }), /Only the explicitly authorized/);
  rejects(() => inspectEngineSelection({ ...options, engineDir: path.join(candidateRoot, 'attempts', 'attempt-1', 'output') }), /Only the explicitly authorized/);
  rejects(() => inspectEngineSelection({ ...options, engineDir: path.join(candidateRoot, 'attempts', 'attempt-3', 'output') }), /Only the explicitly authorized/);
  rejects(() => inspectEngineSelection({ ...options, explicitEngineSelection: false }), /explicit engine flags/);

  const buildManifest = { upstreamCommit: sourceCommit,
    cppSources: Array.from({ length: 412 }, (_, i) => 'fixture-' + i + '.cpp'),
    cSources: Array.from({ length: 26 }, (_, i) => 'fixture-' + i + '.c') };
  const manifestPath = path.join(buildRoot, 'build-manifest.json');
  json(manifestPath, buildManifest);
  const responsePath = path.join(candidateRoot, 'objects.rsp');
  const response = Array.from({ length: 438 }, (_, i) => 'fixture-' + i + '.o').join('\n') + '\n';
  write(responsePath, response);
  write(path.join(buildRoot, 'link-objects.rsp'), response);
  const argv = ['em++.py', '@' + responsePath, '-O1', '-sASYNCIFY', '-lidbfs.js', '-fexceptions', '-o', path.join(engineDir, 'cataclysm-tiles.js')];
  const plan = { argv, executable: 'fixture-python', cwd: buildRoot,
    source: { upstreamCommit: sourceCommit, totalUnits: 438, objectsRecompiled: false,
      sourceAndObjectsUnmodified: true, responseSha256: hash(responsePath), existingCompileOptimization: '-Os' },
    retained: { asyncify: true, conservativeIndirectCalls: true, defaultAsyncifyImports: true, exceptions: true, idbfs: true,
      includeListChanged: false, excludeListChanged: false, ignoreIndirectEnabled: false, initialAndMaximumMemoryChanged: false } };
  const planPath = path.join(candidateRoot, 'link-candidate.json');
  const runPath = path.join(candidateRoot, 'run-config.json');
  const configPath = path.join(candidateRoot, '.emscripten');
  const logPath = path.join(candidateRoot, 'logs', 'fixture-link.log');
  const run = { argv, executable: plan.executable, cwd: plan.cwd,
    environmentOverrides: { EM_CONFIG: configPath, EM_CACHE: path.join(buildRoot, 'cache'), EM_PORTS: path.join(buildRoot, 'ports') } };
  json(planPath, plan); json(runPath, run);
  write(configPath, 'FROZEN_CACHE = True\n'); write(logPath, 'FIXTURE ONLY: no compiler was executed.\n');
  write(path.join(engineDir, 'cataclysm-tiles.js'), '/* isolated hash fixture, not a game */\n');
  write(path.join(engineDir, 'cataclysm-tiles.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
  const evidence = { result: 'pass', full_engine: true, completePort: false, upstream: { commit: sourceCommit },
    sourceUnits: { total: 438, successful: 438, unresolved: 0 }, buildManifestSha256: hash(manifestPath),
    artifacts: ['cataclysm-tiles.js', 'cataclysm-tiles.wasm'].map(name => {
      const filename = path.join(engineDir, name); return { path: filename, bytes: fs.statSync(filename).size, sha256: hash(filename) };
    }), actualLinkLogPath: logPath, provenanceHashes: {
      candidateConfigSha256: hash(planPath), runConfigSha256: hash(runPath), objectsResponseSha256: hash(responsePath),
      emscriptenConfigSha256: hash(configPath), actualLinkLogSha256: hash(logPath) } };
  const saveEvidence = () => json(engineEvidence, evidence);
  saveEvidence();
  const ready = inspectEngineSelection(options);
  check(ready.ready, true);
  check(ready.completePort, false);
  check(ready.referenceOnly, true);
  check(ready.candidate.conservativeAsyncify, true);
  check(ready.packagerEnvironment.EM_CONFIG, configPath);
  check(ready.provenanceFiles.length, 7);
  assertEngineSelectionUnchanged(ready); assertions++;

  const failurePath = path.join(candidateRoot, 'evidence', 'resource-constrained-attempt.json');
  json(failurePath, { fixtureOnly: true, result: 'resource-constrained', full_engine: false });
  const failureHash = hash(failurePath);
  const retryRoot = path.join(candidateRoot, 'attempts', 'attempt-2');
  const retryDir = path.join(retryRoot, 'output');
  const retryEvidencePath = path.join(retryRoot, 'evidence', 'full-engine-build.json');
  const retryOptions = { ...options, engineDir: retryDir, engineEvidence: retryEvidencePath };
  const retryPending = inspectEngineSelection(retryOptions);
  check(retryPending.ready, false);
  check(retryPending.candidateAttempt, 'attempt-2');
  check(retryPending.artifacts.every(file => file.path.startsWith(retryDir + path.sep)), true);
  rejects(() => inspectEngineSelection({ ...retryOptions, engineEvidence }), /matching attempt-local/);
  rejects(() => inspectEngineSelection({ ...options, engineEvidence: retryEvidencePath }), /matching attempt-local/);

  const retryResponse = path.join(retryRoot, 'objects.rsp');
  const retryConfigPath = path.join(retryRoot, '.emscripten');
  const retryPlanPath = path.join(retryRoot, 'link-candidate.json');
  const retryRunPath = path.join(retryRoot, 'run-config.json');
  const retryLogPath = path.join(retryRoot, 'link-engine.log');
  const retryPlan = structuredClone(plan);
  retryPlan.attemptNumber = 2;
  retryPlan.argv = plan.argv.map(flag => flag === '@' + responsePath ? '@' + retryResponse
    : flag === path.join(engineDir, 'cataclysm-tiles.js') ? path.join(retryDir, 'cataclysm-tiles.js') : flag);
  const retryRun = structuredClone(run);
  retryRun.attemptNumber = 2; retryRun.argv = [...retryPlan.argv];
  retryRun.environmentOverrides.EM_CONFIG = retryConfigPath;
  json(retryPlanPath, retryPlan); json(retryRunPath, retryRun);
  write(retryResponse, response); write(retryConfigPath, fs.readFileSync(configPath));
  write(retryLogPath, 'FIXTURE ONLY: isolated retry; no compiler was executed.\n');
  const retryEvidence = structuredClone(evidence);
  retryEvidence.artifacts = evidence.artifacts.map(file => {
    const filename = path.join(retryDir, path.basename(file.path));
    write(filename, fs.readFileSync(file.path));
    return { path: filename, bytes: fs.statSync(filename).size, sha256: hash(filename) };
  });
  retryEvidence.actualLinkLogPath = retryLogPath;
  retryEvidence.provenanceHashes = { candidateConfigSha256: hash(retryPlanPath), runConfigSha256: hash(retryRunPath),
    objectsResponseSha256: hash(retryResponse), emscriptenConfigSha256: hash(retryConfigPath), actualLinkLogSha256: hash(retryLogPath) };
  json(retryEvidencePath, retryEvidence);
  const retryReady = inspectEngineSelection(retryOptions);
  check(retryReady.ready, true);
  check(retryReady.referenceOnly, true);
  check(retryReady.completePort, false);
  check(retryReady.candidate.id, 'o1-conservative-asyncify');
  check(retryReady.candidate.attemptNumber, 2);
  check(retryReady.packagerEnvironment.EM_CONFIG, retryConfigPath);
  assertEngineSelectionUnchanged(retryReady); assertions++;
  retryRun.attemptNumber = 3; json(retryRunPath, retryRun);
  retryEvidence.provenanceHashes.runConfigSha256 = hash(retryRunPath); json(retryEvidencePath, retryEvidence);
  rejects(() => inspectEngineSelection(retryOptions), /matching reviewed and executed attempt metadata/);
  retryRun.attemptNumber = 2; json(retryRunPath, retryRun);
  retryEvidence.provenanceHashes.runConfigSha256 = hash(retryRunPath); json(retryEvidencePath, retryEvidence);
  retryEvidence.artifacts[0].sha256 = '0'.repeat(64); json(retryEvidencePath, retryEvidence);
  rejects(() => inspectEngineSelection(retryOptions), /differs from the verified hash/);
  fs.unlinkSync(retryEvidencePath);
  check(inspectEngineSelection(retryOptions).ready, false);
  check(hash(failurePath), failureHash);

  const originalEvidence = JSON.stringify(evidence);
  const resetEvidence = () => { Object.keys(evidence).forEach(key => delete evidence[key]); Object.assign(evidence, JSON.parse(originalEvidence)); saveEvidence(); };
  const tamperEvidence = (mutate, pattern) => { mutate(evidence); saveEvidence(); rejects(() => inspectEngineSelection(options), pattern); resetEvidence(); };
  tamperEvidence(value => { value.result = 'pending'; }, /must verify a full engine/);
  tamperEvidence(value => { value.completePort = true; }, /completePort=false/);
  tamperEvidence(value => { value.sourceUnits.successful = 437; }, /all 438/);
  tamperEvidence(value => { value.upstream.commit = '0'.repeat(40); }, /source commit/);
  tamperEvidence(value => { value.buildManifestSha256 = '0'.repeat(64); }, /build manifest/);
  tamperEvidence(value => { value.artifacts[0].path = path.join(buildRoot, 'output', 'cataclysm-tiles.js'); }, /not explicitly pinned/);
  tamperEvidence(value => { value.artifacts[1].sha256 = '0'.repeat(64); }, /differs from the verified hash/);
  tamperEvidence(value => { delete value.provenanceHashes.runConfigSha256; }, /provenance is absent/);
  tamperEvidence(value => { value.provenanceHashes.emscriptenConfigSha256 = '0'.repeat(64); }, /verified frozen config/);
  tamperEvidence(value => { value.actualLinkLogPath = manifestPath; }, /actual link log/);

  const originalPlan = JSON.stringify(plan), originalRun = JSON.stringify(run);
  const tamperConfig = (mutate, pattern) => {
    mutate(plan, run); json(planPath, plan); json(runPath, run);
    evidence.provenanceHashes.candidateConfigSha256 = hash(planPath);
    evidence.provenanceHashes.runConfigSha256 = hash(runPath); saveEvidence();
    rejects(() => inspectEngineSelection(options), pattern);
    Object.keys(plan).forEach(key => delete plan[key]); Object.assign(plan, JSON.parse(originalPlan));
    Object.keys(run).forEach(key => delete run[key]); Object.assign(run, JSON.parse(originalRun));
    json(planPath, plan); json(runPath, run); resetEvidence();
  };
  tamperConfig(value => { value.retained.ignoreIndirectEnabled = true; }, /conservative Asyncify/);
  tamperConfig((value, executed) => { executed.argv = [...executed.argv, '-sASYNCIFY_IGNORE_INDIRECT']; }, /executed link arguments differ/);
  tamperConfig((value, executed) => { value.argv = [...value.argv, '-sASYNCIFY_ONLY=main']; executed.argv = [...value.argv]; }, /executed flags/);
  tamperConfig((value, executed) => { value.argv = value.argv.map(flag => flag === '-O1' ? '-Os' : flag); executed.argv = [...value.argv]; }, /executed flags/);
  tamperConfig((value, executed) => { executed.environmentOverrides.EM_CACHE = path.join(candidateRoot, 'new-cache'); }, /existing shared cache/);
  tamperConfig((value, executed) => { executed.executable = 'unreviewed-tool'; }, /executed link arguments differ/);
  write(configPath, 'FROZEN_CACHE = False\n');
  evidence.provenanceHashes.emscriptenConfigSha256 = hash(configPath); saveEvidence();
  rejects(() => inspectEngineSelection(options), /verified frozen config/);
  write(configPath, 'FROZEN_CACHE = True\nFROZEN_CACHE = False\n');
  evidence.provenanceHashes.emscriptenConfigSha256 = hash(configPath); saveEvidence();
  rejects(() => inspectEngineSelection(options), /verified frozen config/);
  write(configPath, 'FROZEN_CACHE = True\n'); resetEvidence();
  write(path.join(buildRoot, 'link-objects.rsp'), 'changed original response');
  rejects(() => inspectEngineSelection(options), /identical 438-object response/);
  write(path.join(buildRoot, 'link-objects.rsp'), response);

  const originalJs = fs.readFileSync(path.join(engineDir, 'cataclysm-tiles.js'));
  write(path.join(engineDir, 'cataclysm-tiles.js'), 'changed');
  rejects(() => inspectEngineSelection(options), /differs from the verified hash/);
  rejects(() => assertEngineSelectionUnchanged(ready), /changed during packaging/);
  write(path.join(engineDir, 'cataclysm-tiles.js'), originalJs);
  fs.unlinkSync(engineEvidence);
  // An original output exists; explicitly selecting a missing candidate evidence
  // still cannot fall back to those unrelated files.
  write(path.join(buildRoot, 'output', 'cataclysm-tiles.js'), 'unselected original fixture');
  write(path.join(buildRoot, 'output', 'cataclysm-tiles.wasm'), 'unselected original fixture');
  const noFallback = inspectEngineSelection(options);
  check(noFallback.ready, false);
  check(noFallback.artifacts.every(file => file.path.startsWith(engineDir + path.sep)), true);
  const report = { result: 'pass', scope: 'isolated_engine_selection_guard_fixtures', assertions,
    actualFullEngineVerified: false, packJobStarted: false, compilerExecuted: false, browserStarted: false,
    recordedAt: new Date().toISOString() };
  json(path.join(ownerRoot, 'engine-selection-verification.json'), report);
  console.log(JSON.stringify(report));
} finally {
  const resolved = path.resolve(fixtureRoot);
  if (!resolved.startsWith(ownerRoot + path.sep) || !path.basename(resolved).startsWith('.engine-selection-fixtures-')) {
    throw new Error('Fixture cleanup target is outside the owned directory.');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
