// Parent runs this serially after the active browser gate. Authoring/checking
// this wrapper starts no browser and changes no current runtime artifact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const task = fileURLToPath(new URL('../', import.meta.url));
const receiptPath = path.join(task, 'docs/CLEAN-SOURCE-BROWSER-EVIDENCE.json');
assert.equal(fs.existsSync(receiptPath), false, 'New receipt must not overwrite existing evidence');
const pinned = {
  archive: '881cff21b198f6f9cfe3f24ed9674586d719c18147f1b99978667be64b9b45b2',
  core: '20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60',
  deployedAdapter: '54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e',
  cleanAdapter: 'dbec616a8d1a9021eb75242121e99b37c45fde280a760cc63518e2730dc3c02e',
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
async function hashFile(file) {
  const digest = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}
function noAncestorLinks(file) {
  const absolute = path.resolve(file), parsed = path.parse(absolute);
  let current = parsed.root;
  for (const component of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    assert.equal(fs.lstatSync(current).isSymbolicLink(), false, `Ancestor link: ${current}`);
  }
}
function confinedRoot(candidate) {
  assert.equal(path.isAbsolute(candidate), true);
  const temporaryRoot = fs.realpathSync.native(os.tmpdir());
  noAncestorLinks(temporaryRoot);
  noAncestorLinks(candidate);
  const real = fs.realpathSync.native(candidate);
  const relative = path.relative(temporaryRoot, real).split(path.sep);
  assert.equal(relative.length, 2, 'Clean root must be immediately under a GUID temporary extraction');
  assert.match(relative[0], /^drl-source-verify-[0-9a-f]{32}$/i);
  assert.equal(relative[1], 'drl-original-core');
  assert.equal(real.toLowerCase(), path.resolve(candidate).toLowerCase(), 'Root path must resolve literally');
  return real;
}
function checkedTree(directory) {
  noAncestorLinks(directory);
  const files = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    assert.equal(item.isSymbolicLink(), false, `Tree link: ${file}`);
    if (item.isDirectory()) files.push(...checkedTree(file));
    else { assert.equal(item.isFile(), true, `Non-file: ${file}`); files.push(file); }
  }
  return files;
}
const record = {
  schema: 1, result: 'pending', started_utc: new Date().toISOString(),
  scope: 'Isolated actual Chrome primary 15-check game-flow suite on freshly compiled Pascal core and Rust adapter; complete campaign and full toolchain bootstrap remain separate',
  pins: pinned, current_runtime_changed: false, original_archive_changed: false,
  source_zip_served_in_temporary_browser_fixture: false, full_port_complete: false,
};
try {
  const compile = readJson(path.join(task, 'docs/SOURCE-CLEAN-BUILD-EVIDENCE.json'));
  assert.equal(compile.clean_compile_verified, true);
  assert.equal(compile.cargo_vendors_verified, true);
  assert.equal(compile.core_byte_exact, true);
  assert.equal(compile.compiled_sources, 139);
  assert.ok(['pass', 'compiled-artifact-differs'].includes(compile.result));
  assert.equal(compile.archive_sha256, pinned.archive);
  assert.equal(compile.core_sha256, pinned.core);
  assert.equal(compile.rebuilt_core_sha256, pinned.core);
  assert.equal(compile.adapter_sha256, pinned.deployedAdapter);
  assert.equal(compile.rebuilt_adapter_sha256, pinned.cleanAdapter);
  assert.equal(compile.authenticated_source?.result, 'pass');
  assert.equal(compile.authenticated_source?.archive_sha256, pinned.archive);
  const cleanRoot = confinedRoot(compile.root);
  assert.equal(cleanRoot.toLowerCase(), confinedRoot(compile.authenticated_source.extracted_root).toLowerCase());
  record.root = cleanRoot;
  record.archive_sha256_verified = await hashFile(path.join(task, 'port/dist/source.zip'));
  assert.equal(record.archive_sha256_verified, pinned.archive);
  const currentDist = path.join(task, 'port/dist'), cleanDist = path.join(cleanRoot, 'port/dist');
  assert.equal(fs.existsSync(cleanDist), false, 'No existing temporary dist is permitted');
  const files = checkedTree(currentDist).filter(file => path.relative(currentDist, file).toLowerCase() !== 'source.zip');
  const harnessRelative = 'port/tests/original-game-browser.mjs';
  const currentHarness = fs.readFileSync(path.join(task, harnessRelative));
  const cleanHarness = fs.readFileSync(path.join(cleanRoot, harnessRelative));
  assert.ok(currentHarness.equals(cleanHarness), 'Archived primary browser harness differs from current harness');
  record.primary_harness_sha256 = hash(currentHarness);
  for (const relative of ['port/tests/original-history-ledger.mjs', 'port/tests/original-flow-phase.mjs', 'port/web/server.mjs', 'port/web/game.mjs']) {
    assert.ok(fs.readFileSync(path.join(task, relative)).equals(fs.readFileSync(path.join(cleanRoot, relative))), `Archived harness helper differs: ${relative}`);
  }
  const currentBuildBytes = fs.readFileSync(path.join(currentDist, 'build.json'));
  const build = JSON.parse(currentBuildBytes);
  assert.equal(build.core.sha256, pinned.core);
  assert.equal(build.adapter.sha256, pinned.deployedAdapter);
  assert.equal(build.core.file, 'drl-core.wasm');
  assert.equal(build.adapter.file, 'drl_web_port.wasm');
  assert.equal(await hashFile(path.join(currentDist, build.core.file)), pinned.core);
  assert.equal(await hashFile(path.join(currentDist, build.adapter.file)), pinned.deployedAdapter);
  const coreFile = path.join(cleanRoot, 'core-adapted/build/browser-core/drl-core.wasm');
  const adapterFile = path.join(cleanRoot, '.clean-rust-target/wasm32-unknown-unknown/release/drl_web_port.wasm');
  noAncestorLinks(coreFile); noAncestorLinks(adapterFile);
  const coreBytes = fs.readFileSync(coreFile), adapterBytes = fs.readFileSync(adapterFile);
  assert.equal(hash(coreBytes), pinned.core);
  assert.equal(hash(adapterBytes), pinned.cleanAdapter);
  assert.equal(coreBytes.length, build.core.size);
  const adapterModule = new WebAssembly.Module(adapterBytes);
  const imports = WebAssembly.Module.imports(adapterModule);
  const exports = WebAssembly.Module.exports(adapterModule).map(item => item.name);
  assert.deepEqual(imports, build.adapter.imports);
  assert.deepEqual(exports, build.adapter.exports);
  const immutable = { core: JSON.stringify(build.core), identity: JSON.stringify(build.identity), assets: JSON.stringify(build.assets) };
  fs.mkdirSync(cleanDist);
  for (const file of files) {
    const destination = path.join(cleanDist, path.relative(currentDist, file));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file, destination, fs.constants.COPYFILE_EXCL);
  }
  fs.writeFileSync(path.join(cleanDist, build.core.file), coreBytes);
  fs.writeFileSync(path.join(cleanDist, build.adapter.file), adapterBytes);
  build.adapter = { ...build.adapter, size: adapterBytes.length, sha256: pinned.cleanAdapter, imports, exports };
  assert.equal(JSON.stringify(build.core), immutable.core);
  assert.equal(JSON.stringify(build.identity), immutable.identity);
  assert.equal(JSON.stringify(build.assets), immutable.assets);
  fs.writeFileSync(path.join(cleanDist, 'build.json'), JSON.stringify(build, null, 2) + '\n');
  assert.equal(fs.existsSync(path.join(cleanDist, 'source.zip')), false);
  assert.ok(fs.readFileSync(path.join(currentDist, 'build.json')).equals(currentBuildBytes), 'Current build descriptor changed');
  record.fixture = { files_copied: files.length, core: build.core, adapter: build.adapter, identity: build.identity, assets: build.assets };
  const command = [process.execPath, path.join(cleanRoot, harnessRelative)];
  const run = spawnSync(command[0], command.slice(1), { cwd: cleanRoot, windowsHide: true, encoding: 'utf8', maxBuffer: 16777216, timeout: 180000, env: { ...process.env, DRL_ORIGINAL_BROWSER_SKIP: '0' } });
  record.browser_command = command;
  record.browser_run = { exit_code: run.status, signal: run.signal, error: run.error?.message ?? null, stdout: run.stdout, stderr: run.stderr };
  assert.equal(run.error, undefined, 'Browser harness invocation failed');
  assert.equal(run.status, 0, 'Browser harness failed');
  const browserPath = path.join(cleanRoot, 'port/tests/output/original-game/evidence.json');
  const browser = readJson(browserPath);
  assert.equal(browser.result, 'pass');
  assert.equal(browser.checks.length, 15);
  assert.ok(browser.checks.every(check => check.result === 'pass'));
  assert.deepEqual(browser.browser_errors, []);
  assert.ok(!browser.console.some(entry => entry.type === 'error'), 'Browser console error');
  assert.equal(browser.artifacts[build.core.file].sha256, pinned.core);
  assert.equal(browser.artifacts[build.adapter.file].sha256, pinned.cleanAdapter);
  assert.equal(browser.artifacts.manifest_sha256, await hashFile(path.join(currentDist, 'core-assets.json')));
  assert.deepEqual(browser.last_state?.errors ?? [], []);
  assert.deepEqual(browser.last_state?.unsupported ?? [], []);
  record.browser_evidence_file = browserPath;
  record.browser_evidence_sha256 = await hashFile(browserPath);
  record.browser = browser;
  assert.equal(await hashFile(path.join(currentDist, build.core.file)), pinned.core);
  assert.equal(await hashFile(path.join(currentDist, 'drl_web_port.wasm')), pinned.deployedAdapter);
  assert.ok(fs.readFileSync(path.join(currentDist, 'build.json')).equals(currentBuildBytes), 'Current descriptor changed during isolation');
  record.result = 'pass';
} catch (error) {
  record.result = 'fail'; record.error = error.stack ?? String(error); process.exitCode = 1;
}
record.completed_utc = new Date().toISOString();
fs.writeFileSync(receiptPath, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ result: record.result, root: record.root, checks: record.browser?.checks?.length ?? 0, core_sha256: pinned.core, adapter_sha256: pinned.cleanAdapter, error: record.error ?? null }));
