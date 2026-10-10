// Text-only licensing receipts for the DCSS distribution. Added 2026-10-02.
// GPL-3.0-or-later. No upstream code, installers or build tools are executed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'licenses');
const registry = 'C:/Users/kit/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f';
const registryCache = 'C:/Users/kit/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f';
const sysroot = 'C:/Users/kit/.rustup/toolchains/1.98.1-x86_64-pc-windows-gnu';
const sdk = 'C:/Users/kit/emsdk/upstream/emscripten';
const lockPath = path.join(root, 'port', 'Cargo.lock');
const lockBytes = fs.readFileSync(lockPath);
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const receipts = [], missing = [];
fs.mkdirSync(destination, { recursive: true });
function copy(source, target, component, scope, url) {
  if (!fs.existsSync(source)) { missing.push({ source, component, scope }); return; }
  const bytes = fs.readFileSync(source);
  const file = path.join(destination, target);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(source, file);
  if (sha(fs.readFileSync(file)) !== sha(bytes)) throw new Error(`Notice copy mismatch ${target}`);
  receipts.push({ file: target.replaceAll('\\', '/'), component, scope, acquired_from: source, primary_reference: url, bytes: bytes.length, sha256: sha(bytes), extraction: 'verbatim installed text receipt' });
}
const gpl = fs.readFileSync(path.join(destination, 'GPL-3.0.txt'));
if (!gpl.toString('utf8').includes('Version 3, 29 June 2007') || gpl.length < 30000) throw new Error('Missing/incomplete official GPLv3 text');
receipts.push({ file: 'GPL-3.0.txt', component: 'DCSS combined derivative', scope: 'distribution license', acquired_from: 'https://www.gnu.org/licenses/gpl-3.0.txt', primary_reference: 'https://www.gnu.org/licenses/gpl-3.0.txt', bytes: gpl.length, sha256: sha(gpl), extraction: 'verbatim official GNU license text downloaded as data' });

const runtimeCrates = new Set(['serde', 'serde_core', 'serde_json', 'itoa', 'memchr', 'zmij']);
const packages = lockBytes.toString('utf8').split('[[package]]').slice(1).map(block => {
  const field = name => new RegExp(`^${name} = "([^"]+)"`, 'm').exec(block)?.[1];
  return { name: field('name'), version: field('version'), checksum: field('checksum'), source: field('source') };
}).filter(row => row.source?.startsWith('registry+'));
const crates = [];
for (const row of packages) {
  if (!/^[A-Za-z0-9_-]+$/.test(row.name) || !/^[A-Za-z0-9.+-]+$/.test(row.version)) throw new Error('Unexpected locked crate path');
  const crateDirectory = path.join(registry, `${row.name}-${row.version}`);
  if (!fs.existsSync(crateDirectory)) { missing.push({ component: `${row.name}-${row.version}`, scope: 'locked crate', source: crateDirectory }); continue; }
  const metadata = fs.readFileSync(path.join(crateDirectory, 'Cargo.toml'), 'utf8');
  const license = /^license = "([^"]+)"/m.exec(metadata)?.[1] ?? null;
  const repository = /^repository = "([^"]+)"/m.exec(metadata)?.[1] ?? `https://crates.io/crates/${row.name}/${row.version}`;
  const scope = runtimeCrates.has(row.name) ? 'runtime-capable Rust WASM dependency' : 'compile-only derive/procedural-macro dependency';
  const archive = path.join(registryCache, `${row.name}-${row.version}.crate`);
  const archive_sha256 = fs.existsSync(archive) ? sha(fs.readFileSync(archive)) : null;
  if (archive_sha256 && archive_sha256 !== row.checksum) throw new Error(`Locked archive checksum mismatch: ${row.name}`);
  const notices = fs.readdirSync(crateDirectory).filter(name => /^(LICENSE|LICENCE|UNLICENSE|COPYING|COPYRIGHT|NOTICE)(?:[._-]|$)/i.test(name) && fs.statSync(path.join(crateDirectory, name)).isFile());
  if (!notices.length) missing.push({ component: `${row.name}-${row.version}`, scope, source: crateDirectory, reason: 'No top-level notice receipt found' });
  for (const name of notices) copy(path.join(crateDirectory, name), `rust/crates/${row.name}-${row.version}/${name}`, `${row.name} ${row.version}`, scope, repository);
  crates.push({ ...row, license_expression: license, repository, scope, archive_sha256, archive_checksum_verified: archive_sha256 ? true : null, notice_files: notices.map(name => `rust/crates/${row.name}-${row.version}/${name}`) });
}

const rustDocs = path.join(sysroot, 'share', 'doc', 'rust');
const libraryReport = path.join(rustDocs, 'COPYRIGHT-library.html');
copy(libraryReport, 'rust/COPYRIGHT-library.html', 'Rust 1.98.1 standard libraries', 'installed standard-library license report; covers multiple targets/components, not a symbol-level link map', 'https://github.com/rust-lang/rust/tree/48a229ceaefd4985c50990b14116b6d856af0985/library');
if (fs.existsSync(libraryReport)) {
  const report = fs.readFileSync(libraryReport, 'utf8');
  const referenced = [...new Set([...report.matchAll(/(?:href=["'])?licenses\/([A-Za-z0-9_.+-]+\.txt)/g)].map(match => match[1]))];
  // This Rust release embeds license texts in its HTML report rather than
  // linking all generic files. Preserve only support texts named in that report.
  for (const name of fs.readdirSync(path.join(rustDocs, 'licenses')).filter(name => name.endsWith('.txt'))) {
    const identifier = name.slice(0, -4);
    if (report.includes(identifier) && !referenced.includes(name)) referenced.push(name);
  }
  if (!referenced.length && (!report.includes('Permission is hereby granted') || !report.includes('Apache License'))) missing.push({ component: 'Rust standard-library license report', source: libraryReport, reason: 'Neither referenced generic licenses nor embedded MIT/Apache terms detected; inspect report directly' });
  for (const name of referenced) copy(path.join(rustDocs, 'licenses', name), `rust/licenses/${name}`, 'Rust standard-library report license reference', 'standard-library receipt support text', 'https://github.com/rust-lang/rust/tree/48a229ceaefd4985c50990b14116b6d856af0985');
}

const sdkVersion = fs.readFileSync(path.join(sdk, 'emscripten-version.txt'), 'utf8').trim().replaceAll('"', '');
const sdkUrl = relative => `https://github.com/emscripten-core/emscripten/blob/${sdkVersion}/${relative}`;
for (const [relative, target, component, scope] of [
  ['LICENSE', 'emscripten/LICENSE.txt', 'Emscripten generated JS/runtime support', 'runtime and compiler-driver dual MIT/NCSA notices, including bundled Node path-code notice'],
  ['AUTHORS', 'emscripten/AUTHORS.txt', 'Emscripten authors', 'attribution referenced by Emscripten LICENSE'],
  ['system/lib/libc/musl/COPYRIGHT', 'emscripten/musl-COPYRIGHT.txt', 'musl libc', 'C standard runtime aggregate copyright/license and subsidiary origin notices'],
  ['system/lib/libcxx/LICENSE.TXT', 'emscripten/libcxx-LICENSE.txt', 'LLVM libc++', 'C++ standard runtime; Apache-2.0 with LLVM exceptions and historical notices'],
  ['system/lib/libcxxabi/LICENSE.TXT', 'emscripten/libcxxabi-LICENSE.txt', 'LLVM libc++abi', 'C++ ABI/exception runtime; Apache-2.0 with LLVM exceptions and historical notices'],
  ['system/lib/compiler-rt/LICENSE.TXT', 'emscripten/compiler-rt-LICENSE.txt', 'LLVM compiler-rt', 'compiler builtins/support code that may be included in generated WASM'],
  ['system/lib/libunwind/LICENSE.TXT', 'emscripten/libunwind-LICENSE.txt', 'LLVM libunwind', 'conservative exception-support receipt; inclusion depends on actual exception configuration'],
  ['system/lib/llvm-libc/LICENSE.TXT', 'emscripten/llvm-libc-LICENSE.txt', 'LLVM libc portable functions', 'conservative standard-runtime receipt; actual replacement function inclusion is target/configuration dependent'],
  ['system/lib/libcxx/CREDITS.TXT', 'emscripten/libcxx-CREDITS.txt', 'LLVM libc++ authors', 'attribution referenced by historical standard-runtime notices'],
  ['system/lib/libcxxabi/CREDITS.TXT', 'emscripten/libcxxabi-CREDITS.txt', 'LLVM libc++abi authors', 'attribution referenced by historical C++ ABI runtime notices'],
  ['system/lib/compiler-rt/CREDITS.TXT', 'emscripten/compiler-rt-CREDITS.txt', 'LLVM compiler-rt authors', 'runtime-support attribution'],
]) copy(path.join(sdk, relative), target, component, scope, sdkUrl(relative));

// musl's aggregate COPYRIGHT refers to individual math/regex/source notices.
// Preserve applicable portable-source notice blocks, without copying source
// bodies, architecture assembly, binaries, fonts or example media.
const muslSource = path.join(sdk, 'system', 'lib', 'libc', 'musl', 'src');
const muslNotices = [];
for (const directory of fs.readdirSync(muslSource, { withFileTypes: true }).filter(row => row.isDirectory())) {
  const local = path.join(muslSource, directory.name);
  for (const name of fs.readdirSync(local).filter(name => /\.[ch]$/.test(name))) {
    const file = path.join(local, name);
    if (!fs.statSync(file).isFile()) continue;
    const bytes = fs.readFileSync(file), content = bytes.toString('utf8');
    const blocks = [...content.slice(0, 16384).matchAll(/\/\*[\s\S]*?\*\//g)].filter(match => /copyright|permission is hereby|redistribution and use|SPDX-License-Identifier|public domain/i.test(match[0]));
    if (!blocks.length) continue;
    muslNotices.push({ source: `system/lib/libc/musl/src/${directory.name}/${name}`, source_sha256: sha(bytes), blocks: blocks.map(match => ({ offset: match.index, text: match[0] })) });
  }
}
let muslText = '# Portable musl source notice receipts\n\n';
muslText += 'Verbatim notice comments from the installed Emscripten musl portable C/header sources. This conservative receipt set is not a claim that every listed function is linked. See musl-COPYRIGHT.txt for the aggregate MIT terms and subsidiary origins. Architecture-specific assembly is excluded.\n\n';
for (const row of muslNotices) muslText += `## ${row.source}\n\n${row.blocks.map(block => block.text).join('\n\n')}\n\n`;
fs.writeFileSync(path.join(destination, 'emscripten', 'musl-PORTABLE-SOURCE-NOTICES.txt'), muslText);
receipts.push({ file: 'emscripten/musl-PORTABLE-SOURCE-NOTICES.txt', component: 'musl portable-source subsidiary notices', scope: 'conservative portable runtime notice receipts; not a linked-symbol inventory', bytes: Buffer.byteLength(muslText), sha256: sha(Buffer.from(muslText)), extraction: 'verbatim notice comments from first 16 KiB of portable source files', source_files: muslNotices });
const allocator = path.join(sdk, 'system', 'lib', 'dlmalloc.c');
if (fs.existsSync(allocator)) {
  const bytes = fs.readFileSync(allocator), content = bytes.toString('utf8');
  const blocks = [...content.slice(0, 32768).matchAll(/\/\*[\s\S]*?\*\//g)].filter(match => /copyright|public domain|permission is hereby|SPDX-License-Identifier/i.test(match[0]));
  if (blocks.length) {
    const notice = blocks.map(match => match[0]).join('\n\n') + '\n';
    fs.writeFileSync(path.join(destination, 'emscripten', 'dlmalloc-NOTICES.txt'), notice);
    receipts.push({ file: 'emscripten/dlmalloc-NOTICES.txt', component: 'dlmalloc allocator', scope: 'SDK default allocator receipt; SDK settings.js declares MALLOC=dlmalloc', acquired_from: allocator, primary_reference: sdkUrl('system/lib/dlmalloc.c'), bytes: Buffer.byteLength(notice), sha256: sha(Buffer.from(notice)), source_sha256: sha(bytes), extraction: 'verbatim copyright/public-domain header comments' });
  } else missing.push({ component: 'dlmalloc', source: allocator, reason: 'No allocator notice detected in header region' });
} else missing.push({ component: 'dlmalloc', source: allocator, reason: 'Installed SDK default allocator source not found at expected path' });

if (sha(fs.readFileSync(lockPath)) !== sha(lockBytes)) throw new Error('Cargo.lock changed while notices were packaged');
const result = {
  schema_version: 1, generated_by: 'tools/package-runtime-notices.mjs', acquired_on: '2026-10-02',
  cargo_lock_sha256: sha(lockBytes), rust_release: '1.98.1', rust_commit: '48a229ceaefd4985c50990b14116b6d856af0985', rust_host: 'x86_64-pc-windows-gnu', rust_wasm_target: 'wasm32-unknown-unknown',
  emscripten_release: sdkVersion, emscripten_engine_target: 'wasm32-emscripten',
  scope: 'Text notices for locked Rust dependencies, installed Rust standard-library report, and installed Emscripten C/C++/JS runtime support. Compiler binaries, tools, SDK installers, unrelated artwork/fonts/audio and optional media libraries are not copied. Runtime-capable means the dependency graph permits inclusion, not that every symbol survives linking.',
  limitations: 'Installed receipts are preserved with exact hashes. The Rust library report and portable musl set conservatively cover additional library components; no final linked-symbol/license-membership map is claimed. Future build options/dependency changes require updating this package.',
  crates, receipts, missing,
  copied_files: receipts.length, copied_bytes: receipts.reduce((sum, row) => sum + row.bytes, 0),
  result: missing.length ? 'receipts_preserved_with_gaps' : 'receipts_preserved',
};
fs.writeFileSync(path.join(destination, 'runtime-packaging.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ result: result.result, copied_files: result.copied_files, copied_bytes: result.copied_bytes, crates: crates.length, archive_checksums_verified: crates.filter(row => row.archive_checksum_verified).length, missing }, null, 2));
