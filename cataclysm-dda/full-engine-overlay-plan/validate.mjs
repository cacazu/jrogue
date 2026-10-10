// Low-load validation only. No compiler, WASM, browser or process mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const task = path.dirname(here);
const sha = b => createHash('sha256').update(b).digest('hex');
const normalized = p => path.resolve(p).replaceAll('\\', '/');
const planBytes = fs.readFileSync(path.join(here, 'FULL-INTEGRATION-PLAN.json'));
const plan = JSON.parse(planBytes);
assert.equal(plan.status, 'combined-source-and-command-plan-prepared-no-build-or-launch');
assert.equal(plan.sourceCommit, '7b2efa5cea38e4d4d97dd0e63b28b9148623da59');
assert.equal(plan.compilerExecuted, false);
assert.equal(plan.CargoExecuted, false);
assert.equal(plan.NodeWasmExecuted, false);
assert.equal(plan.browserExecuted, false);
assert.equal(plan.originalEngineIntegrated, false);
assert.equal(plan.completePort, false);
assert.equal(plan.staging.files, 973);
assert.equal(plan.dependencyClosure.records, 438);
assert.equal(plan.dependencyClosure.rebuiltExistingUnits, 231);
assert.equal(plan.compatibleObjectReuse.units, 207);
assert.equal(plan.compileCommands.length, 235);
assert.equal(plan.linkResponse.totalObjects, 442);
assert.equal(new Set(plan.compileCommands.map(command => command.source)).size, 235);
const before = [];
for (const row of plan.evidencePins) {
  const bytes = fs.readFileSync(row.path);
  assert.equal(bytes.length, row.bytes, row.path + ' size');
  assert.equal(sha(bytes), row.sha256, row.path + ' digest');
  before.push({ path: row.path, bytes: row.bytes, sha256: row.sha256 });
}
const sourceMap = new Map();
for (const row of plan.staging.pins) {
  assert.ok(normalized(row.path).startsWith(normalized(plan.staging.coherentSiblingTree) + '/'));
  const bytes = fs.readFileSync(row.path);
  assert.equal(bytes.length, row.bytes);
  assert.equal(sha(bytes), row.sha256);
  assert.ok(!sourceMap.has(row.file));
  sourceMap.set(row.file, row);
}
const originalHeaders = ['src/help.h', 'src/input.h', 'src/input_context.h'];
assert.deepEqual([...plan.dependencyClosure.changedHeaders].sort(), originalHeaders);
const rebuild = new Set(plan.dependencyClosure.rebuiltExistingSources);
const originalModified = new Set(plan.staging.changedOriginalFiles);
const originalBuild = JSON.parse(fs.readFileSync(path.join(task, 'engine-build/build-manifest.json')));
const originalPath = normalized(originalBuild.upstream);
for (const row of plan.dependencyClosure.recordsAndExactDependencies) {
  const independentReasons = [...originalModified].filter(file => row.dependencies.includes(originalPath + '/' + file));
  assert.deepEqual([...row.dependentChangedFiles].sort(), independentReasons.sort());
  assert.equal(rebuild.has(row.source), independentReasons.length !== 0);
}
for (const row of plan.compatibleObjectReuse.objects) {
  assert.ok(!rebuild.has(row.source));
  assert.equal(row.success.code, 0);
  assert.ok(row.unchangedDependencies.length > 0);
  for (const dependency of row.unchangedDependencies) {
    if (!dependency.file) continue;
    assert.ok(!originalModified.has(dependency.file));
    const staged = sourceMap.get(dependency.file);
    assert.equal(staged?.bytes, dependency.bytes);
    assert.equal(staged?.sha256, dependency.sha256);
  }
}
const expectedMacros = [
  '-DCDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID="' + plan.buildIdentity + '"',
  '-DCDDA_TEXT_SNAPSHOT_BUILD_ID="' + plan.buildIdentity + '"',
];
for (const command of plan.compileCommands) {
  assert.equal(normalized(command.executable), 'C:/Users/kit/emsdk/python/3.13.3_64bit/python.exe');
  assert.ok(normalized(command.cwd).startsWith(normalized(here) + '/'));
  assert.equal(normalized(command.argv[0]), 'C:/Users/kit/emsdk/upstream/emscripten/em++.py');
  assert.ok(command.argv.includes('-Os'));
  assert.ok(!command.argv.includes('-O1'));
  for (const macro of expectedMacros) assert.equal(command.argv.filter(arg => arg === macro).length, 1);
  const c = command.argv.indexOf('-c'), o = command.argv.indexOf('-o');
  assert.equal(normalized(command.argv[c + 1]), normalized(sourceMap.get(command.source).path));
  assert.equal(command.argv[o + 1], command.outputObject);
  assert.ok(!fs.existsSync(command.outputObject));
  assert.ok(!fs.existsSync(command.outputDependencyFile));
  assert.ok(!command.argv.some(arg => arg.startsWith('-I') && normalized(arg.slice(2)).startsWith(originalPath)));
  assert.equal(command.environment.EMCC_CORES, '1');
  assert.equal(command.environment.BINARYEN_CORES, '1');
  assert.equal(command.environment.EMCC_BATCH_BUILD, '0');
  assert.equal(command.automaticRetry, false);
}
const link = plan.linkCommand;
assert.equal(link.executableOwnerReady, false);
assert.equal(link.argv.filter(arg => arg === '-O1').length, 1);
assert.equal(link.argv.filter(arg => arg === '-sASYNCIFY').length, 1);
assert.ok(link.argv.includes('-Wl,--threads=1'));
assert.ok(!link.argv.some(arg => /JSPI|ASYNCIFY_(ONLY|REMOVE|IGNORE_INDIRECT|IMPORTS)/.test(arg)));
assert.ok(link.argv.includes('-sEXPORTED_RUNTIME_METHODS=["FS","stackTrace","jsStackTrace"]'));
const exports = JSON.parse(link.argv.find(arg => arg.startsWith('-sEXPORTED_FUNCTIONS=')).slice('-sEXPORTED_FUNCTIONS='.length));
assert.deepEqual(exports, plan.exportContract.explicitExports);
assert.equal(exports.length, 13);
assert.equal(new Set(exports).size, 13);
assert.ok(exports.includes('_main'));
assert.ok(!fs.existsSync(link.outputWasm));
assert.ok(!fs.existsSync(link.outputJavascript));
const responseBytes = fs.readFileSync(plan.linkResponse.path);
assert.equal(responseBytes.length, plan.linkResponse.bytes);
assert.equal(sha(responseBytes), plan.linkResponse.sha256);
const objects = responseBytes.toString('utf8').split('\n').map(value => normalized(JSON.parse(value)));
assert.equal(objects.length, 442);
assert.equal(new Set(objects).size, 442);
const compileMap = new Map(plan.compileCommands.map(command => [command.source, command.outputObject]));
const reusedMap = new Map(plan.compatibleObjectReuse.objects.map(row => [row.source, row.object.path]));
const sourceOrder = [...originalBuild.cppSources, ...originalBuild.cSources, ...plan.dependencyClosure.newUnits];
assert.deepEqual(objects, sourceOrder.map(file => normalized(compileMap.get(file) ?? reusedMap.get(file))));
const semanticBase = fs.readFileSync(path.join(task, 'semantic-display-live-slice/generated/src/input_context.cpp'), 'utf8');
const merged = fs.readFileSync(sourceMap.get('src/input_context.cpp').path, 'utf8');
const hook = fs.readFileSync(path.join(task, 'integration-overlay/hook-input-wait.inc'), 'utf8');
assert.equal(merged.split(hook).length, 2);
assert.equal(merged.replace('#include "browser_input_snapshot.h"\n', '').replace(hook, ''), semanticBase);
assert.equal(plan.resources.compilation.launchGate.minimumPhysicalFreeBytes, 4 * 1024 ** 3);
assert.equal(plan.resources.compilation.launchGate.minimumExactCommitHeadroomBytes, 6 * 1024 ** 3);
assert.equal(plan.resources.compilation.ownedResourceGuard.maximumOwnedTreePrivateBytes, 1024 ** 3);
assert.equal(plan.resources.compilation.ownedResourceGuard.maximumStageSeconds, 180);
assert.equal(plan.resources.fullLinkProposalNotApprovedForExecution.maximumOwnedPrivateBytes, 4 * 1024 ** 3);
assert.equal(plan.localPackage.externalPublication, false);
assert.ok(plan.localPackage.noticesVerified.length >= 60);
const result = {
  schemaVersion: 1,
  result: 'pass',
  checkedAt: new Date().toISOString(),
  scope: 'Actual coherent source bytes, original dependency/object evidence, command/export/order consistency and unchanged accepted source/package; no full-engine or runtime acceptance',
  plan: { path: path.join(here, 'FULL-INTEGRATION-PLAN.json'), bytes: planBytes.length, sha256: sha(planBytes) },
  allPinnedEvidenceUnchanged: true,
  evidenceFilesVerified: before.length,
  sourceFilesVerified: sourceMap.size,
  originalMmdRecordsVerified: plan.dependencyClosure.records,
  originalRebuildUnits: rebuild.size,
  originalReusableObjectsVerified: reusedMap.size,
  genuineNewObjectsPresent: 0,
  generatedCompileCommands: compileMap.size,
  linkResponseObjects: objects.length,
  semanticInputMergeReversedExactly: true,
  currentCompilationGatePreserved: true,
  fullLinkOwnerStillUnprepared: true,
  acceptedNodeRuntimeUnmodified: true,
  copiedSoftwareNoticesVerified: plan.localPackage.noticesVerified.length,
  actualCompilerLaunched: false,
  actualRustWasmAccepted: false,
  actualOriginalEngineLinked: false,
  browserStarted: false,
  completePort: false,
};
fs.writeFileSync(path.join(here, 'VALIDATION.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result));
