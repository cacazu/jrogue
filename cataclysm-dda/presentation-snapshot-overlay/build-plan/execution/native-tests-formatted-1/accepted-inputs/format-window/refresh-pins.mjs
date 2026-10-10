// Source/evidence bookkeeping only; never launches a process or modifies Rust/C++/fixtures.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const own = path.dirname(here);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pin = file => { const bytes = fs.readFileSync(file); return { path: file, bytes: bytes.length, sha256: sha(bytes) }; };
const require = (condition, message) => { if (!condition) throw Error(message); };
require(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--manifest-only'), 'unsupported arguments');
const manifestOnly = process.argv[2] === '--manifest-only';
const planFile = path.join(own, 'build-plan/parser-build-plan.json');
if (!manifestOnly) {
  const plan = JSON.parse(fs.readFileSync(planFile));
  for (const record of plan.inputs) {
    if (record.relative === 'format-window/apply-reviewed.mjs') continue;
    const actual = pin(record.path);
    require(actual.sha256 === record.sha256 && actual.bytes === record.bytes, 'protected input changed: ' + record.path);
  }
  const oldHelper = plan.inputs.find(record => record.relative === 'format-window/apply-reviewed.mjs');
  const usedHelper = pin(path.join(here, 'execution/preview-1/application-helper-used.mjs'));
  require(usedHelper.sha256 === oldHelper.sha256, 'archived actually-used helper differs from application plan');
  plan.inputs = plan.inputs.map(record => record.relative === 'format-window/apply-reviewed.mjs' ?
    { relative: record.relative, ...pin(record.path) } : record);
  for (const relative of ['format-window/refresh-pins.mjs', 'format-window/execution/preview-1/application-helper-used.mjs'])
    plan.inputs.push({ relative, ...pin(path.join(own, relative)) });
  plan.reviewedFormatting.applicationHelperUsed = usedHelper;
  plan.reviewedFormatting.applicationReport = pin(path.join(here, 'execution/preview-1/APPLY-REVIEWED.json'));
  plan.reviewedFormatting.helperReportingCorrectionAfterSuccessfulCopy = 'No second copy; current helper records success after manifest and independently records all rollback outcomes';
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2) + '\n');
}
const manifestFile = path.join(own, 'FILE-MANIFEST.json');
const old = JSON.parse(fs.readFileSync(manifestFile));
const files = [];
function visit(directory, relative = '') {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = relative + item.name;
    if (name === 'FILE-MANIFEST.json' || old.excluded_directories.some(prefix => name === prefix.slice(0, -1) || name.startsWith(prefix))) continue;
    require(!item.isSymbolicLink(), 'curated owned path must not be a symlink: ' + name);
    if (item.isDirectory()) visit(path.join(directory, item.name), name + '/');
    else if (item.isFile()) { const record = pin(path.join(directory, item.name)); files.push({ path: name, bytes: record.bytes, sha256: record.sha256 }); }
  }
}
visit(own);
files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
fs.writeFileSync(manifestFile, JSON.stringify({ ...old, curated_file_count: files.length,
  curated_total_bytes: files.reduce((total, file) => total + file.bytes, 0), files }, null, 2) + '\n');
console.log(JSON.stringify({ plan: pin(planFile), correctedCopier: pin(path.join(here, 'apply-reviewed.mjs')),
  manifest: pin(manifestFile), curatedFilesIncludingManifest: files.length + 1,
  curatedTotalBytesExcludingManifest: files.reduce((total, file) => total + file.bytes, 0) }, null, 2));
