import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = import.meta.dirname;
const task = path.dirname(root);
const run = path.join(root, 'candidates/o1-conservative-asyncify/attempts/attempt-2');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(run, name), 'utf8'));
const evidencePath = path.join(run, 'evidence/full-engine-build.json');
const evidence = read('evidence/full-engine-build.json');
if (evidence.result !== 'pass' || evidence.full_engine !== true || evidence.completePort !== false || evidence.runtimeBrowserVerified !== false || evidence.upstream.commit !== '7b2efa5cea38e4d4d97dd0e63b28b9148623da59' || evidence.sourceUnits.total !== 438 || evidence.sourceUnits.successful !== 438) throw new Error('Unexpected successful engine scope');
for (const artifact of evidence.artifacts) {
  if (fs.statSync(artifact.path).size !== artifact.bytes || sha(artifact.path) !== artifact.sha256) throw new Error('Artifact hash mismatch');
}
const provenanceFiles = {
  candidateConfigSha256: path.join(run, 'link-candidate.json'),
  objectsResponseSha256: path.join(run, 'objects.rsp'),
  runConfigSha256: path.join(run, 'run-config.json'),
  emscriptenConfigSha256: path.join(run, '.emscripten'),
  actualLinkLogSha256: path.join(run, 'link-engine.log'),
};
for (const [key, file] of Object.entries(provenanceFiles)) if (sha(file) !== evidence.provenanceHashes[key]) throw new Error('Provenance mismatch: ' + key);
const plan = read('link-candidate.json');
const executed = read('run-config.json');
if (JSON.stringify(plan.argv) !== JSON.stringify(executed.argv)) throw new Error('Reviewed/executed argv mismatch');
const lines = fs.readFileSync(path.join(run, 'objects.rsp'), 'utf8').split(/\r?\n/).filter(Boolean);
if (lines.length !== 438 || sha(path.join(run, 'objects.rsp')) !== sha(path.join(root, 'link-objects.rsp'))) throw new Error('Same-object response mismatch');
for (const change of read('metadata-correction.json').changes) {
  if (sha(change.priorBytesPath) !== change.priorSha256 || sha(change.file) !== change.updatedSha256) throw new Error('Metadata correction history mismatch');
}
const samples = fs.readFileSync(path.join(run, 'resource-samples.ndjson'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
const stages = read('stage-events.json');
const closure = read('evidence/terminal-process-resource.json');
if (!closure.allObservedCandidateIdentitiesEnded) throw new Error('Candidate identity remains active');
const optimizers = samples.flatMap(sample => sample.processes.filter(p => p.name === 'wasm-opt.exe').map(p => ({timestampUtc: sample.timestampUtc, ...p})));
const first = optimizers[0], last = optimizers.at(-1);
const report = {
  schemaVersion: 1, generatedUtc: new Date().toISOString(), attemptNumber: 2,
  result: 'pass', full_engine: true, completePort: false, runtimeBrowserVerified: false,
  outcome: evidence.outcome, driverStageEvents: stages,
  sampledResources: {sampleCount: samples.length, intervalTargetSeconds: 5,
    sampledPeakOwnedPrivateBytes: Math.max(...samples.map(s => s.ownedTreePrivateBytes)),
    sampledPeakOwnedWorkingSetBytes: Math.max(...samples.map(s => s.ownedTreeWorkingSetBytes)),
    minimumObservedPhysicalFreeBytes: Math.min(...samples.map(s => s.physicalFreeBytes)),
    minimumObservedExactCommitHeadroomBytes: Math.min(...samples.map(s => s.exactCommitHeadroomBytes)),
    firstOptimizerObservation: first, lastOptimizerObservation: last,
    optimizerTimingLimit: 'Optimizer start and sampled CPU/I/O are observed; exact subprocess exit and internal per-pass timing were not exposed. Driver elapsed includes linker, optimizer and final JS generation.',
    peaksAreSampledNotContinuous: true},
  terminalResourcePath: path.join(run, 'evidence/terminal-process-resource.json'),
  successfulEvidencePath: evidencePath, successfulEvidenceSha256: sha(evidencePath),
  originalTerminationPath: path.join(root, 'evidence/original-termination.json'),
  preservedAttempt1Manifest: path.join(root, 'candidates/o1-conservative-asyncify/attempts/attempt-1/archive-manifest.json'),
  metadataCorrectionPath: path.join(run, 'metadata-correction.json'),
};
const reportPath = path.join(run, 'evidence/terminal-resource-stage-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const canonical = {...evidence, canonicalGeneratedUtc: new Date().toISOString(),
  selectedReferenceEvidencePath: evidencePath, selectedReferenceEvidenceSha256: sha(evidencePath),
  terminalResourceStageReportPath: reportPath, terminalResourceStageReportSha256: sha(reportPath),
  canonicalVerification: {artifactsRehashed: true, provenanceRehashed: true, reviewedExecutedArgvEqual: true,
    same438ObjectResponseVerified: true, metadataStartupHistoryVerified: true, candidateProcessesEnded: true},
};
fs.mkdirSync(path.join(task, 'evidence'), {recursive: true});
const canonicalPath = path.join(task, 'evidence/full-engine-build.json');
fs.writeFileSync(canonicalPath, JSON.stringify(canonical, null, 2) + '\n');
console.log(JSON.stringify({canonicalPath, canonicalSha256: sha(canonicalPath), reportPath, sampledResources: report.sampledResources,
  terminalResources: {physicalFreeBytes: closure.physicalFreeBytes, exactCommitHeadroomBytes: closure.exactCommitHeadroomBytes, allCandidateIdentitiesEnded: true}}));
