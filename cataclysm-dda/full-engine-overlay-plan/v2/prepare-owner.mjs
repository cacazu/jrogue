// Pin preparation only. No launch or Windows guard execution.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), task = path.dirname(path.dirname(here));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fullFile = path.join(here, 'FULL-INTEGRATION-PLAN.json');
const fullBytes = fs.readFileSync(fullFile);
assert.equal(sha(fullBytes), '208c9b5dffb6822752dc155e80fb7ad187fd9735fccb80ab9eb0264655546b03');
const full = JSON.parse(fullBytes);
const priorFile = path.join(task, 'integration-overlay/build-plan/cpp-compile/compile-plan.json');
const prior = readJson(priorFile);
const extraFile = path.join(task, 'integration-overlay/build-plan/cpp-compile/runner-pins.json');
const extraBytes = fs.readFileSync(extraFile);
assert.equal(sha(extraBytes), '8af61c2fafff3bb1f7ef33361293893a0a7d150c517c30653ff372e1760274db');
const cpp2 = path.join(task, 'integration-overlay/build-plan/cpp-compile/run-compile-window.py');
assert.equal(sha(fs.readFileSync(cpp2)), '0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395');
const records = new Map();
const portablePins = [];
function collect(item) {
  if (Array.isArray(item)) { for (const child of item) collect(child); return; }
  if (!item || typeof item !== 'object') return;
  if (typeof item.path === 'string' && Number.isSafeInteger(item.bytes) && typeof item.sha256 === 'string') {
    if (!path.isAbsolute(item.path)) {
      portablePins.push({ path: item.path, bytes: item.bytes, sha256: item.sha256 });
      for (const child of Object.values(item)) collect(child);
      return;
    }
    const file = path.resolve(item.path), key = file.toLowerCase();
    const row = { path: file, bytes: item.bytes, sha256: item.sha256 };
    if (records.has(key)) assert.deepEqual(records.get(key), row);
    else records.set(key, row);
  }
  for (const child of Object.values(item)) collect(child);
}
collect(full); collect(prior); collect(JSON.parse(extraBytes));
function pin(file) {
  const b = fs.readFileSync(file);
  collect({ path: path.resolve(file), bytes: b.length, sha256: sha(b) });
}
for (const file of [fullFile, priorFile, extraFile, cpp2, path.join(here, 'run-owner-window.py'),
                    path.join(here, 'SOURCE-STAGING.json'), path.join(here, 'combined-source.patch'),
                    path.join(full.candidateDirectory, '.emscripten'),
                    path.join(full.candidateDirectory, 'generated/version.h'),
                    path.join(full.candidateDirectory, 'generated/prefix.h'),
                    path.join(full.candidateDirectory, 'objects.rsp')]) pin(file);
const portablePinBindings = portablePins.map(row => {
  const suffix = '/' + row.path.replaceAll('\\', '/').replace(/^\.\//, '');
  const matches = [...records.values()].filter(record => record.bytes === row.bytes && record.sha256 === row.sha256 &&
    record.path.replaceAll('\\', '/').toLowerCase().endsWith(suffix.toLowerCase()));
  assert.ok(matches.length > 0, 'portable metadata pin lacks matching absolute protected evidence: ' + row.path);
  return { portable: row, verifiedAbsoluteEvidence: matches.map(record => record.path).sort() };
});
for (const row of records.values()) {
  const b = fs.readFileSync(row.path);
  assert.equal(b.length, row.bytes); assert.equal(sha(b), row.sha256, row.path);
}
const packet = { schemaVersion: 1, status: 'exact-single-command-owner-pins-prepared-no-launch',
  buildIdentity: full.buildIdentity,
  fullPlanSha256: sha(fullBytes), runnerSha256: sha(fs.readFileSync(path.join(here, 'run-owner-window.py'))),
  cpp2Sha256: sha(fs.readFileSync(cpp2)), orderedCompileIndices: Array.from({length:235},(_,i)=>i),
  oneCommandPerRootRelease: true, fullLinkRequires235SuccessfulGenuineCompileReceipts: true,
  newHelperCompileTuplesRequiredFresh: full.compileCommands.slice(0, 4).map((command, index) => ({ index, command })),
  resourceProposalRequiresIndependentReviewAndRootRelease: true,
  portablePinBindings,
  pins: [...records.values()].sort((a,b) => a.path.localeCompare(b.path, 'en')),
  compilerExecuted: false, WindowsGuardLoaded: false, browserExecuted: false };
const file = path.join(here, 'OWNER-PINS.json');
fs.writeFileSync(file, JSON.stringify(packet, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: packet.status, protectedFiles: records.size,
  runnerSha256: packet.runnerSha256, packetSha256: sha(fs.readFileSync(file)) }));
