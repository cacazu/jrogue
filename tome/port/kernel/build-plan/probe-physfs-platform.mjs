#!/usr/bin/env node
// Preprocess only: standard installed Clang reads trusted headers; no game code executes.
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const [source, sdk, output] = process.argv.slice(2);
if (!source || !sdk || !output) throw new Error('Usage: node probe-physfs-platform.mjs SOURCE_ROOT EMSDK_ROOT OUTPUT_JSON');
const compiler = path.join(sdk, 'upstream/bin/clang.exe');
const args = ['--target=wasm32-unknown-emscripten', `--sysroot=${path.join(sdk, 'upstream/emscripten/cache/sysroot')}`, '-I', path.join(source, 'src/physfs'), '-x', 'c', '-dM', '-E', '-'];
const input = '#define __PHYSICSFS_INTERNAL__\n#include "physfs_platforms.h"\n';
const result = spawnSync(compiler, args, { input, encoding: 'utf8', shell: false, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
const relevantMacros = (result.stdout ?? '').split(/\r?\n/).filter(line => /\b(?:__EMSCRIPTEN__|__unix__|__unix|unix|__linux__|__linux|PHYSFS_PLATFORM_[A-Z_]+|PHYSFS_NO_CDROM_SUPPORT)\b/.test(line));
const report = {
  schemaVersion: 1,
  compiler, args, input,
  exitCode: result.status,
  error: result.error?.message ?? null,
  stderr: result.stderr ?? '',
  relevantMacros,
  unixPlatformSelected: relevantMacros.some(line => line.includes('PHYSFS_PLATFORM_UNIX')),
  posixPlatformSelected: relevantMacros.some(line => line.includes('PHYSFS_PLATFORM_POSIX')),
  observation: 'Actual installed Clang target preprocessor result. This is not a source compile, link, or browser runtime test. Root emcc may add more macros but uses the same wasm32 Emscripten target.',
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (result.status !== 0 || result.error) process.exitCode = 1;
