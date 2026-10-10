import {createHash} from 'node:crypto';
import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageAssets, SOURCE_COMMIT, ENGINE_COMMIT} from './package-core-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'port/dist');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const requiredCore = ['memory','_start','drl_save_generation','drl_user_files_generation','drl_probe_buffer','drl_probe_capacity','drl_probe_capture','drl_probe_run_delay','drl_probe_multimove_active'];
const requiredAdapter = ['memory','drl_request_pointer','drl_request_capacity','drl_dispatch','drl_output_pointer','drl_output_length','drl_text_columns','drl_text_fit'];
async function artifact(file, required) {
  const bytes = await readFile(path.join(dist, file));
  // Validate and inspect only locally compiled owned source. The browser suite
  // separately proves actual execution and ordinary JSPI wrappers.
  const module = new WebAssembly.Module(bytes);
  const exports = WebAssembly.Module.exports(module).map(entry => entry.name);
  for (const name of required) if (!exports.includes(name)) throw new Error(`Missing ${file} export: ${name}`);
  const imports = WebAssembly.Module.imports(module);
  if (file === 'drl_web_port.wasm' && imports.length) throw new Error('Rust adapter unexpectedly imports host capabilities');
  if (file === 'drl-core.wasm' && imports.some(entry => !['drl_host','wasi_snapshot_preview1'].includes(entry.module) || entry.kind !== 'function')) throw new Error('Original core has an unreviewed host capability');
  return {file,size:bytes.length,sha256:digest(bytes),imports,exports};
}

// This is a local integration candidate, never a publication command. An actual
// passing game verification record is required by the local completion workflow.
const core = await artifact('drl-core.wasm', requiredCore);
const adapter = await artifact('drl_web_port.wasm', requiredAdapter);
const assets = await packageAssets();
for (const file of ['game.html','game.mjs','game.css','core-host.mjs']) {
  await cp(path.join(root, 'port/web', file), path.join(dist, file));
}
// Both standard HTML entry names serve the already verified original engine.
await cp(path.join(root,'port/web/game.html'),path.join(dist,'index.html'));
for (const file of ['gameui-en.json','gameui-ja.json']) {
  await cp(path.join(root, 'port/locales', file), path.join(dist, file));
}
await mkdir(path.join(dist,'licenses'),{recursive:true});
await cp(path.join(root,'port/licenses'),path.join(dist,'licenses'),{recursive:true});
await cp(path.join(root,'upstream/drl/bin/data/drl/graphics/LICENSE'),path.join(dist,'licenses/DRL-Art-CC-BY-SA-4.0.txt'));
await writeFile(path.join(dist,'ATTRIBUTION.txt'),
  'DRL 0.10.11a by Kornel Kisielewicz / ChaosForge. Original Pascal and Lua code: GPL 2.0.\n' +
  'FPC Valkyrie by ChaosForge: MIT. Lua 5.1.5 by Lua.org / PUC-Rio: MIT.\n' +
  'Original ASCII art: CC BY-SA 4.0 under the upstream README art grant. Original art and sprites by Derek Yu; modifications/additions by Łukasz Śliwiński. The packaged ASCII files are unmodified.\n' +
  'Source: https://github.com/chaosforgeorg/drl/tree/0_10_11a ; engine: https://github.com/chaosforgeorg/fpcvalkyrie/tree/0_10_11 .\n' +
  'Browser display/input/storage adapters and Japanese translations are modifications. Native audio, FMOD, Steam, unreviewed fonts and closed commercial game assets are excluded. Trademark rights are not granted by the art license.\n');
const identity = {format:'drl-original-core',source_commit:SOURCE_COMMIT,engine_commit:ENGINE_COMMIT,
  engine_save:'0.10.11',module:'drl',module_save:'0.10.11',platform_abi:1};
const build = {schema_version:1,scope:'original-game integration candidate; verification required',
  full_port_complete:false,core,adapter,identity,
  assets:{file:'core-assets.json',size:(await readFile(path.join(dist,'core-assets.json'))).length,
    sha256:digest(await readFile(path.join(dist,'core-assets.json'))),files:assets.files.length,bytes:assets.total_bytes},
  created_at:new Date().toISOString()};
await writeFile(path.join(dist,'build.json'),JSON.stringify(build,null,2)+'\n');
console.log(JSON.stringify({core:core.sha256,adapter:adapter.sha256,assets:assets.files.length,publication:false}));
