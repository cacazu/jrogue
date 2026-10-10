import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// One compiler process at a time, task-local output. Never starts the game.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'native-adapter';
if (!['native-adapter', 'native-geometry', 'native-core', 'wasm-core'].includes(mode)) throw Error('Unknown core probe mode');
const wasm = mode === 'wasm-core';
const output = path.join(root, 'core-adapted', 'build', mode);
fs.mkdirSync(output, { recursive: true });
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const compiler = path.join(root, 'toolchain', wasm ? 'fpc-src/compiler/ppcwasm32.exe' : 'fpc-win64-snapshot/bin/i386-win32/ppcrossx64.exe');
const units = wasm
  ? [path.join(root, 'toolchain/rtl-exnref'), ...['rtl-objpas', 'rtl-generics', 'rtl-unicode', 'rtl-extra', 'hash', 'paszlib', 'fcl-base', 'fcl-xml', 'fcl-json'].map(p => path.join(root, `toolchain/packages-exnref/${p}/units/wasm32-wasip1`))]
  : fs.readdirSync(path.join(root, 'toolchain/fpc-win64-snapshot/units/x86_64-win64')).map(p => path.join(root, 'toolchain/fpc-win64-snapshot/units/x86_64-win64', p));
const executableProbe=['native-adapter','native-geometry'].includes(mode);
const name = mode === 'native-adapter' ? 'drl_browser_adapter_probe' : mode==='native-geometry'?'geometry-probe':'drl_browser';
const source = path.join(root,mode==='native-geometry'?'experiments/vtig-cjk/geometry-probe.pas':`core-adapted/drl/src/${name}.lpr`);
const args = ['-n', '-Sc', '-B', ...units.map(p => `-Fu${p}`),
  ...['drl/src', 'fpcvalkyrie/src', 'fpcvalkyrie/libs'].map(p => `-Fu${path.join(root, 'core-adapted', p)}`),
  `-Fi${path.join(root, 'core-adapted/fpcvalkyrie/src')}`, `-FU${output}`, `-FE${output}`];
if (!executableProbe) args.push('-Cn');
if (mode !== 'native-adapter') args.push('-dDRL_BROWSER');
if (wasm) args.push('-Twasip1', '-dDRL_WASM', '-CTwasmexceptions');
args.push(source);
const evidence = { schema: 1, mode, at: new Date().toISOString(), compiler, compiler_sha256: sha(compiler),
  args, source_sha256: sha(source), full_game_started: false, full_port_complete: false };
const compiled = spawnSync(compiler, args, { cwd: root, encoding: 'utf8', timeout: 240_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
fs.writeFileSync(path.join(output, 'compile.log'), (compiled.stdout ?? '') + (compiled.stderr ?? ''));
evidence.compile = { status: compiled.status, signal: compiled.signal, error: compiled.error?.message ?? null };
if (executableProbe && compiled.status === 0) {
  const exe = path.join(output, `${name}.exe`);
  const run = spawnSync(exe, [], { cwd: root, encoding: 'utf8', timeout: 15_000, maxBuffer: 65536, windowsHide: true });
  evidence.adapter_probe = { status: run.status, stdout: run.stdout, stderr: run.stderr, executable_sha256: sha(exe) };
}
fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({mode,compile:evidence.compile,adapter_probe:evidence.adapter_probe??null,evidence:path.join(output,'evidence.json')}));
process.exitCode = compiled.status ?? 1;
if (evidence.adapter_probe?.status) process.exitCode = evidence.adapter_probe.status;
