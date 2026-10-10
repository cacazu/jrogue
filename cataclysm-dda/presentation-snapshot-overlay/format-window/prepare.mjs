// Read/hash source preparation only; no formatter/compiler/process launch.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const own = path.dirname(here);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pin = file => {
  const bytes = fs.readFileSync(file);
  return { path: file, bytes: bytes.length, sha256: hash(bytes) };
};
const baseFile = path.join(own, 'build-plan/parser-build-plan.json');
const base = JSON.parse(fs.readFileSync(baseFile));
const core = path.join(own, 'run-parser-window.py');
const coreHash = '0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb';
if (pin(core).sha256 !== coreHash) throw Error('reviewed fixed owned cleanup source changed');
for (const key of ['rustfmt', 'python']) {
  const actual = pin(base.installedTools[key].path);
  if (actual.sha256 !== base.installedTools[key].sha256) throw Error('installed tool changed: ' + key);
}
const sourceFiles = ['lib.rs', 'tests.rs'].map(name => ({ name, ...pin(path.join(own, 'rust/src', name)) }));
const paths = [...base.inputs.map(record => record.path), path.join(here, 'rustfmt.toml'),
  path.join(here, 'run-preview.py'), path.join(here, 'prepare.mjs')];
const plan = {
  schemaVersion: 1, status: 'PREVIEW_SOURCE_PLAN_ONLY_PARENT_RESERVATION_REQUIRED',
  sourceCommit: base.sourceCommit,
  scope: 'trusted rustfmt only on two owned workcopies; actual Rust/C++/fixture files stay unchanged',
  guard: base.guard, originalGuardPlan: base.originalGuardPlan,
  exercisedEvidence: base.exercisedEvidence, ownedCleanup: pin(core), originalParserPlan: pin(baseFile),
  installedTools: { rustfmt: base.installedTools.rustfmt, python: base.installedTools.python },
  sourceFiles,
  inputs: [...new Set(paths)].map(pin),
  rustEnvironment: base.rustEnvironment,
  removeInheritedEnvironment: base.removeInheritedEnvironment,
  launchGate: base.launchGate,
  ownedResourceGuard: base.ownedResourceGuard,
  config: pin(path.join(here, 'rustfmt.toml')),
  command: { stage: 'rust-format-workcopy-preview', executable: base.installedTools.rustfmt.path,
    argvTemplate: ['--edition', '2021', '--config-path', path.join(here, 'rustfmt.toml'),
      '--emit', 'files', '{work_lib}', '{work_tests}'] },
  executionDirectory: path.join(here, 'execution'),
  originalsMayChange: false,
  applyRequiresParentReviewOfCandidateHashesAndNormalDiff: true,
  subsequentSequence: ['review exact workcopy diff/hashes', 'copy only reviewed two source bytes',
    'refresh parser plan/pins/manifest', 'guarded Cargo fmt --check with same config',
    'guarded exact five actual parser tests', 'guarded Clippy warnings denied'],
  noOriginalCppHostBrowserOrExternalPublication: true,
};
const file = path.join(here, 'preview-plan.json');
fs.writeFileSync(file, JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({ plan: pin(file), runner: pin(path.join(here, 'run-preview.py')),
  reusedCleanup: plan.ownedCleanup, rustfmt: plan.installedTools.rustfmt,
  command: plan.command, sourceFiles: plan.sourceFiles }, null, 2));
