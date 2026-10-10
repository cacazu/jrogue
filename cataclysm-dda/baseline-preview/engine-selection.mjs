import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const engineNames = ['cataclysm-tiles.js', 'cataclysm-tiles.wasm'];
const hash = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
const samePath = (left, right) => {
  const normalize = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
  return normalize(left) === normalize(right);
};

export function parsePackagingArgs(argv, buildRoot) {
  const args = [...argv];
  const mode = args.shift() || '--inventory';
  if (!['--inventory', '--preflight', '--package'].includes(mode)) {
    throw new Error('Use --inventory, --preflight, or --package with --ja-mo <compiled-ja.mo>.');
  }
  const values = new Map();
  while (args.length) {
    const flag = args.shift();
    if (!['--ja-mo', '--engine-dir', '--engine-evidence'].includes(flag)) throw new Error('Unknown packaging argument: ' + flag);
    if (values.has(flag)) throw new Error('Duplicate packaging argument: ' + flag);
    const value = args.shift();
    if (!value || value.startsWith('--')) throw new Error('A path is required after ' + flag);
    values.set(flag, path.resolve(value));
  }
  if (values.has('--engine-dir') !== values.has('--engine-evidence')) {
    throw new Error('Explicit engine selection requires both --engine-dir and --engine-evidence; no fallback is allowed.');
  }
  return {
    mode,
    japaneseMo: values.get('--ja-mo') || null,
    engineDir: values.get('--engine-dir') || path.join(buildRoot, 'output'),
    engineEvidence: values.get('--engine-evidence') || path.join(buildRoot, 'evidence', 'full-engine-build.json'),
    explicitEngineSelection: values.has('--engine-dir'),
  };
}

// This inspects build-owner evidence and exact artifacts. It never links, packs,
// executes an engine, changes its outputs, or substitutes another engine.
export function inspectEngineSelection({ engineDir, engineEvidence, explicitEngineSelection, buildRoot, sourceCommit }) {
  engineDir = path.resolve(engineDir);
  engineEvidence = path.resolve(engineEvidence);
  const candidate = !samePath(engineDir, path.join(buildRoot, 'output'));
  const originalCandidateRoot = path.join(buildRoot, 'candidates', 'o1-conservative-asyncify');
  const allowedCandidates = [
    { root: originalCandidateRoot, attempt: 'initial', number: 1 },
    { root: path.join(originalCandidateRoot, 'attempts', 'attempt-2'), attempt: 'attempt-2', number: 2 },
  ];
  const selectedCandidate = allowedCandidates.find(item => samePath(engineDir, path.join(item.root, 'output')));
  if (candidate && !selectedCandidate) {
    throw new Error('Only the explicitly authorized isolated o1-conservative-asyncify candidate or its attempt-2 may be selected.');
  }
  if (candidate && (!explicitEngineSelection || !samePath(engineEvidence, path.join(selectedCandidate.root, 'evidence', 'full-engine-build.json')))) {
    throw new Error('Candidate selection requires explicit engine flags and the matching attempt-local full-engine evidence path.');
  }
  const artifacts = engineNames.map(name => ({ name, path: path.join(engineDir, name) }));
  const missingEngineFiles = artifacts.filter(file => !fs.existsSync(file.path) || fs.statSync(file.path).size === 0).map(file => file.name);
  const reasons = missingEngineFiles.map(name => 'Selected engine artifact unavailable: ' + name);
  if (!fs.existsSync(engineEvidence)) reasons.push('Selected full-engine evidence unavailable: ' + engineEvidence);
  const provenanceFiles = [];
  const selection = {
    engineDir, evidencePath: engineEvidence, explicitSelection: explicitEngineSelection,
    kind: candidate ? 'isolated-candidate' : 'original-build-output',
    ...(candidate ? { candidateAttempt: selectedCandidate.attempt, candidateAttemptNumber: selectedCandidate.number } : {}),
    referenceOnly: true, completePort: false, acceptedForCompletePort: false,
    runtimeBrowserAcceptance: 'pending actual original-game flows',
    ready: false, missingEngineFiles, reasons, artifacts, provenanceFiles,
  };
  if (!fs.existsSync(engineEvidence)) return selection;
  const evidence = readJson(engineEvidence);
  if (evidence.result !== 'pass' || evidence.full_engine !== true || evidence.completePort !== false) {
    throw new Error('Selected evidence must verify a full engine reference and explicitly retain completePort=false.');
  }
  if (evidence.upstream?.commit !== sourceCommit || evidence.sourceUnits?.total !== 438
      || evidence.sourceUnits.successful !== 438 || evidence.sourceUnits.unresolved !== 0) {
    throw new Error('Selected evidence does not verify this source commit and all 438 original units.');
  }
  const manifestPath = path.join(buildRoot, 'build-manifest.json');
  const buildManifest = readJson(manifestPath);
  if (buildManifest.upstreamCommit !== sourceCommit || buildManifest.cppSources?.length !== 412
      || buildManifest.cSources?.length !== 26 || hash(manifestPath) !== evidence.buildManifestSha256) {
    throw new Error('Selected evidence does not match the actual full-engine build manifest.');
  }
  if (!Array.isArray(evidence.artifacts)) throw new Error('Selected evidence has no artifact hash manifest.');
  for (const artifact of artifacts) {
    const entry = evidence.artifacts.find(file => typeof file.path === 'string' && samePath(file.path, artifact.path));
    if (!entry || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) {
      throw new Error('Selected artifact is not explicitly pinned by evidence: ' + artifact.path);
    }
    artifact.bytes = entry.bytes;
    artifact.sha256 = entry.sha256;
    if (!missingEngineFiles.includes(artifact.name)) {
      if (!fs.lstatSync(artifact.path).isFile() || fs.statSync(artifact.path).size !== entry.bytes || hash(artifact.path) !== entry.sha256) {
        throw new Error('Selected engine artifact differs from the verified hash manifest: ' + artifact.path);
      }
    }
  }
  selection.evidenceSha256 = hash(engineEvidence);
  selection.buildManifestSha256 = evidence.buildManifestSha256;
  selection.sourceCommit = sourceCommit;
  selection.sourceUnits = evidence.sourceUnits;
  provenanceFiles.push({ path: engineEvidence, name: 'full-engine-build.json', sha256: selection.evidenceSha256 });
  provenanceFiles.push({ path: manifestPath, name: 'build-manifest.json', sha256: evidence.buildManifestSha256 });
  if (candidate) verifyCandidate(selection, evidence, sourceCommit, buildRoot);
  selection.ready = reasons.length === 0;
  return selection;
}

function verifyCandidate(selection, evidence, sourceCommit, buildRoot) {
  // Candidate provenance is supplied by the build owner, not inferred from a
  // .wasm file merely appearing in an output directory.
  const candidateRoot = path.dirname(selection.engineDir);
  const required = [
    ['candidateConfigSha256', 'link-candidate.json'],
    ['runConfigSha256', 'run-config.json'],
    ['objectsResponseSha256', 'objects.rsp'],
  ];
  for (const [key, name] of required) {
    const expected = evidence.provenanceHashes?.[key];
    const filename = path.join(candidateRoot, name);
    if (!/^[a-f0-9]{64}$/.test(expected || '') || !fs.existsSync(filename) || hash(filename) !== expected) {
      throw new Error('Candidate provenance is absent or changed: ' + name);
    }
    selection.provenanceFiles.push({ path: filename, name, sha256: expected });
  }
  const plan = readJson(path.join(candidateRoot, 'link-candidate.json'));
  const run = readJson(path.join(candidateRoot, 'run-config.json'));
  if (selection.candidateAttemptNumber === 2 && (plan.attemptNumber !== 2 || run.attemptNumber !== 2)) {
    throw new Error('Authorized attempt-2 must have matching reviewed and executed attempt metadata.');
  }
  if (plan.source?.upstreamCommit !== sourceCommit || plan.source.totalUnits !== 438
      || plan.source.objectsRecompiled !== false || plan.source.sourceAndObjectsUnmodified !== true
      || plan.source.responseSha256 !== hash(path.join(candidateRoot, 'objects.rsp'))
      || plan.source.responseSha256 !== hash(path.join(buildRoot, 'link-objects.rsp'))) {
    throw new Error('Candidate source or identical 438-object response provenance differs.');
  }
  const requiredTrue = ['asyncify', 'conservativeIndirectCalls', 'defaultAsyncifyImports', 'exceptions', 'idbfs'];
  const requiredFalse = ['includeListChanged', 'excludeListChanged', 'ignoreIndirectEnabled', 'initialAndMaximumMemoryChanged'];
  if (requiredTrue.some(key => plan.retained?.[key] !== true) || requiredFalse.some(key => plan.retained?.[key] !== false)) {
    throw new Error('Candidate changes conservative Asyncify, exception, IDBFS or memory contracts.');
  }
  if (!Array.isArray(plan.argv) || !Array.isArray(run.argv) || JSON.stringify(plan.argv) !== JSON.stringify(run.argv)
      || run.executable !== plan.executable || !samePath(run.cwd || '', plan.cwd || '')) {
    throw new Error('Candidate executed link arguments differ from the reviewed candidate plan.');
  }
  const flags = run.argv;
  if (!flags.includes('-O1') || flags.some(flag => /^-O(?:0|2|3|s|z)$/.test(flag))
      || !flags.includes('-sASYNCIFY') || !flags.includes('-lidbfs.js') || !flags.includes('-fexceptions')
      || flags.some(flag => /^-sASYNCIFY_(?:IGNORE_INDIRECT|ONLY|REMOVE|IMPORTS)/.test(flag))
      || !samePath(flags[flags.indexOf('-o') + 1] || '', path.join(selection.engineDir, 'cataclysm-tiles.js'))) {
    throw new Error('Candidate executed flags or output path violate the isolated conservative O1 plan.');
  }
  const response = fs.readFileSync(path.join(candidateRoot, 'objects.rsp'), 'utf8').split(/\r?\n/).filter(Boolean);
  if (response.length !== 438) throw new Error('Candidate response must retain all 438 objects.');
  const configPath = run.environmentOverrides?.EM_CONFIG;
  const frozenAssignments = typeof configPath === 'string' && fs.existsSync(configPath)
    ? [...fs.readFileSync(configPath, 'utf8').matchAll(/^\s*FROZEN_CACHE\s*=\s*(True|False)\s*$/gm)].map(match => match[1]) : [];
  if (typeof configPath !== 'string' || !samePath(configPath, path.join(candidateRoot, '.emscripten'))
      || !fs.existsSync(configPath) || hash(configPath) !== evidence.provenanceHashes.emscriptenConfigSha256
      || frozenAssignments.at(-1) !== 'True'
      || !samePath(run.environmentOverrides.EM_CACHE || '', path.join(buildRoot, 'cache'))
      || !samePath(run.environmentOverrides.EM_PORTS || '', path.join(buildRoot, 'ports'))) {
    throw new Error('Candidate must use its verified frozen config and the existing shared cache/ports.');
  }
  selection.provenanceFiles.push({ path: configPath, name: 'candidate.emscripten', sha256: hash(configPath) });
  const logPath = evidence.actualLinkLogPath;
  const relativeLog = typeof logPath === 'string' ? path.relative(candidateRoot, path.resolve(logPath)) : '..';
  if (typeof logPath !== 'string' || relativeLog.startsWith('..') || path.isAbsolute(relativeLog)
      || !fs.existsSync(logPath) || hash(logPath) !== evidence.provenanceHashes.actualLinkLogSha256) {
    throw new Error('Candidate actual link log is absent or differs from recorded provenance.');
  }
  selection.provenanceFiles.push({ path: logPath, name: 'actual-link.log', sha256: hash(logPath) });
  selection.packagerEnvironment = { EM_CONFIG: configPath, EM_CACHE: run.environmentOverrides.EM_CACHE,
    EM_PORTS: run.environmentOverrides.EM_PORTS };
  selection.candidate = { id: 'o1-conservative-asyncify', attempt:selection.candidateAttempt,
    attemptNumber:selection.candidateAttemptNumber,linkOptimization: '-O1', compileOptimization: plan.source.existingCompileOptimization,
    allOriginalObjectsRetained: true, conservativeAsyncify: true, idbfsRetained: true,
    actualBrowserVerifiedByPackaging: false };
}

export function assertEngineSelectionUnchanged(selection) {
  if (!selection.ready) throw new Error('Selected full engine is not ready: ' + selection.reasons.join('; '));
  for (const entry of [...selection.artifacts, ...selection.provenanceFiles]) {
    if (!fs.existsSync(entry.path) || hash(entry.path) !== entry.sha256) {
      throw new Error('Selected engine or provenance changed during packaging: ' + entry.path);
    }
  }
}
