// Copy only parent-reviewed formatter candidate bytes; no child process/tool launch.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const own = path.dirname(here);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pin = file => {
  const bytes = fs.readFileSync(file);
  return { path: file, bytes: bytes.length, sha256: sha(bytes) };
};
const require = (condition, message) => { if (!condition) throw Error(message); };
const args = process.argv.slice(2);
require(args.length === 8 && args[0] === '--attempt-name' && args[2] === '--preview-plan-sha256' &&
  args[4] === '--lib-sha256' && args[6] === '--tests-sha256', 'exact reviewed arguments required');
const [attempt, planHash, libHash, testsHash] = [args[1], args[3], args[5], args[7]];
require(/^[a-z0-9_-]{1,48}$/.test(attempt) && [planHash, libHash, testsHash].every(value => /^[a-f0-9]{64}$/.test(value)),
  'invalid attempt/hash');
const previewFile = path.join(here, 'preview-plan.json');
const previewBytes = fs.readFileSync(previewFile);
require(sha(previewBytes) === planHash, 'parent-reviewed preview plan changed');
const preview = JSON.parse(previewBytes);
const directory = path.join(here, 'execution', attempt);
const terminalFile = path.join(directory, 'terminal.json');
const terminal = JSON.parse(fs.readFileSync(terminalFile));
require(terminal.status === 'preview-ready-for-parent-diff-review' && terminal.actualInputFingerprintsUnchanged === true &&
  terminal.planSha256 === planHash, 'successful unchanged-source preview required');
const planFile = path.join(own, 'build-plan/parser-build-plan.json');
const planBytes = fs.readFileSync(planFile);
require(sha(planBytes) === preview.originalParserPlan.sha256, 'follow-up parser plan changed since preview');
const plan = JSON.parse(planBytes);
for (const record of preview.inputs) {
  const actual = pin(record.path);
  require(actual.bytes === record.bytes && actual.sha256 === record.sha256, 'protected preview input changed: ' + record.path);
}
const sources = ['lib.rs', 'tests.rs'].map((name, index) => {
  const original = path.join(own, 'rust/src', name);
  const record = preview.sourceFiles[index];
  require(record.name === name && path.resolve(record.path) === original, 'fixed two-source boundary changed');
  const before = fs.readFileSync(original);
  const archived = fs.readFileSync(path.join(directory, 'before', name));
  const after = fs.readFileSync(path.join(directory, 'work', name));
  const reviewedHash = [libHash, testsHash][index];
  require(sha(before) === record.sha256 && before.equals(archived), 'source/archive changed before reviewed copy');
  require(sha(after) === reviewedHash && terminal.candidates[index].name === name &&
    terminal.candidates[index].afterSha256 === reviewedHash, 'candidate differs from parent-reviewed hash');
  return { name, original, before, after, reviewedHash };
});
const applyFile = path.join(directory, 'APPLY-REVIEWED.json');
require(!fs.existsSync(applyFile), 'application already recorded; no automatic retry');
const manifestFile = path.join(own, 'FILE-MANIFEST.json');
const manifestBytes = fs.readFileSync(manifestFile);
fs.writeFileSync(path.join(directory, 'parser-plan-before-apply.json'), planBytes, { flag: 'wx' });
fs.writeFileSync(path.join(directory, 'manifest-before-apply.json'), manifestBytes, { flag: 'wx' });
try {
  for (const source of sources) fs.writeFileSync(source.original, source.after);
  plan.inputs = plan.inputs.map(record => sources.some(source => source.original === path.resolve(record.path)) ?
    { relative: record.relative, ...pin(record.path) } : record);
  for (const relative of ['format-window/rustfmt.toml', 'format-window/apply-reviewed.mjs']) {
    plan.inputs.push({ relative, ...pin(path.join(own, relative)) });
  }
  const fmt = plan.commands.find(command => command.stage === 'rust-parser-format-check');
  require(fmt && fmt.argv.at(-1) === '--check', 'unchanged read-only format command required');
  fmt.argv.push('--config-path', path.join(here, 'rustfmt.toml'));
  plan.status = 'REVIEWED_RUSTFMT_BYTES_APPLIED_FORMAT_TEST_CLIPPY_PENDING_NEW_RESERVATION_REQUIRED';
  plan.currentChangesSinceAcceptedRun = 'Comment corrections plus trusted rustfmt whitespace/trailing commas only; original C++/fixtures unchanged';
  plan.reviewedFormatting = { previewPlanSha256: planHash, previewAttempt: attempt,
    diff: path.join(directory, 'format-preview.patch'), candidates: sources.map(source =>
      ({ name: source.name, sha256: source.reviewedHash })) };
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2) + '\n');
  fs.writeFileSync(applyFile, JSON.stringify({ status: 'reviewed-two-source-bytes-applied-checks-pending',
    previewPlanSha256: planHash, parserPlan: pin(planFile),
    sources: sources.map(source => ({ name: source.name, ...pin(source.original) })),
    childProcessLaunched: false, originalCppEdited: false, fixturesEdited: false }, null, 2) + '\n');
  const oldManifest = JSON.parse(manifestBytes);
  const excluded = oldManifest.excluded_directories;
  const files = [];
  function visit(directory, relative = '') {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = relative + item.name;
      if (name === 'FILE-MANIFEST.json' || excluded.some(prefix => name === prefix.slice(0, -1) || name.startsWith(prefix))) continue;
      require(!item.isSymbolicLink(), 'curated path must be a regular owned file/directory: ' + name);
      if (item.isDirectory()) visit(path.join(directory, item.name), name + '/');
      else if (item.isFile()) { const record = pin(path.join(directory, item.name)); files.push({ path: name, bytes: record.bytes, sha256: record.sha256 }); }
    }
  }
  visit(own);
  files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
  fs.writeFileSync(manifestFile, JSON.stringify({ ...oldManifest,
    status: 'REVIEWED_RUSTFMT_BYTES_APPLIED_CHECKS_PENDING', curated_file_count: files.length,
    curated_total_bytes: files.reduce((total, file) => total + file.bytes, 0), files }, null, 2) + '\n');
} catch (error) {
  for (const source of sources) fs.writeFileSync(source.original, source.before);
  fs.writeFileSync(planFile, planBytes);
  fs.writeFileSync(manifestFile, manifestBytes);
  fs.writeFileSync(applyFile, JSON.stringify({ status: 'failed-restored-two-sources-plan-and-manifest',
    failure: String(error), childProcessLaunched: false }, null, 2) + '\n');
  throw error;
}
console.log(JSON.stringify({ parserPlan: pin(planFile), manifest: pin(manifestFile),
  sources: sources.map(source => ({ name: source.name, ...pin(source.original) })), commands: plan.commands }, null, 2));
