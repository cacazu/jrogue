import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const sdk = process.env.ANGBAND_SDK || 'C:\\Users\\kit\\emsdk';
const python = path.join(sdk, 'python', '3.13.3_64bit', 'python.exe');
const emcc = path.join(sdk, 'upstream', 'emscripten', 'emcc.py');
const env = { ...process.env, EM_CONFIG: path.join(sdk, '.emscripten'), EM_CACHE: path.join(root, 'build', 'em-cache'), EMCC_CORES: '1', BINARYEN_CORES: '1' };
const sources = ['logic/message.c', 'logic/save.c', 'logic/load.c', 'logic/web-semantic.c', 'logic/web-message-recall.c',
  'logic/z-virt.c', 'logic/z-util.c', 'logic/z-form.c', 'logic/z-rand.c', 'migration/message-recall-storage-data/fixture.c'];
const flags = ['-I' + path.join(root, 'logic'), '-std=c11', '-O0', '-fwrapv', '-DHAVE_VERSION_H', '--no-entry',
  '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=node', '-sALLOW_MEMORY_GROWTH=1', '-sASSERTIONS=2',
  '-sINITIAL_MEMORY=67108864', '-sSTACK_SIZE=2097152', "-sEXPORTED_FUNCTIONS=['_ab_message_recall_fixture_run','_malloc','_free']"];
const inputs = [...sources, 'migration/message-recall-storage-data/build-fixture.mjs', 'migration/message-recall-storage-data/fixture-api.h'];
for (const name of await fs.readdir(path.join(root, 'logic'))) if (name.endsWith('.h')) inputs.push('logic/' + name);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function identities() {
  const result = {};
  for (const name of [...new Set(inputs)].sort()) result[name] = hash(await fs.readFile(path.join(root, name)));
  return result;
}
function run(command, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: root, env, windowsHide: true, stdio: 'inherit' });
    const timeout = setTimeout(() => child.kill(), 120000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(`Bounded fixture command exited ${code}`)); });
  });
}
const before = await identities();
await run(python, [emcc, ...sources.map(name => path.join(root, name)), ...flags, '-o', path.join(here, 'fixture.mjs')]);
const after = await identities();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Fixture source changed during compilation.');
const outputs = {};
for (const name of ['fixture.mjs', 'fixture.wasm']) outputs[name] = hash(await fs.readFile(path.join(here, name)));
await fs.writeFile(path.join(here, 'fixture-build.json'), JSON.stringify({ schema_version: 1, sources, flags, inputs: before, outputs, sourceStableDuringBuild: true }, null, 2) + '\n');
await run(process.execPath, ['--test', path.join(root, 'tests/message-recall-storage.test.mjs')]);
console.log(JSON.stringify({ actualCFixtureAccepted: true, nativeQueueAndSaveLoadUsed: true, externalDeploymentPerformed: false, inputFiles: Object.keys(before).length, outputs }));
