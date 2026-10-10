import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, sdk, python, receipt, bounded, pin } from './common.mjs';

const slot = await receipt('build');
try {
  const version = (await readFile(path.join(sdk, 'emscripten-version.txt'), 'utf8')).trim().replaceAll('"', '');
  if (version !== '6.0.8') throw new Error('This fixture is pinned to installed Emscripten 6.0.8.');
  const auditPath = path.resolve(root, '../JSPI-SOURCE-AUDIT.json');
  const audit = JSON.parse(await readFile(auditPath, 'utf8'));
  if (audit.sdk.version !== version) throw new Error('Installed SDK and source prerequisite audit disagree.');
  const sdkPins = audit.sourcePins.filter(record => record.group === 'SDK');
  for (const record of sdkPins) if ((await pin(record.path)).sha256 !== record.sha256) throw new Error('Audited SDK bytes changed: ' + record.path);
  const build = path.join(root, 'build'); await mkdir(build, { recursive: true });
  const config = path.join(build, '.emscripten');
  await writeFile(config, "NODE_JS = 'C:/Users/kit/emsdk/node/24.19.0_64bit/node.exe'\nPYTHON = 'C:/Users/kit/emsdk/python/3.13.3_64bit/python.exe'\nLLVM_ROOT = 'C:/Users/kit/emsdk/upstream/bin'\nBINARYEN_ROOT = 'C:/Users/kit/emsdk/upstream'\nEMSCRIPTEN_ROOT = 'C:/Users/kit/emsdk/upstream/emscripten'\nCACHE = 'C:/Users/kit/emsdk/upstream/emscripten/cache'\nFROZEN_CACHE = True\n");
  const env = { ...process.env, EM_CONFIG: config, EMCC_CORES: '1', EMCC_BATCH_BUILD: '0' };
  const compiler = path.join(sdk, 'em++.py');
  const flags = ['-std=c++17', '-Os', '-fexceptions', '-sDISABLE_EXCEPTION_CATCHING=0'];
  const commands = [];
  for (const name of ['fixture', 'targets']) commands.push(await bounded(python, [compiler, ...flags, '-c', path.join(root, name + '.cpp'), '-o', path.join(build, name + '.o')], { prefix: path.join(build, name), marker: root, env }));
  const exports = ['_main', '_probe_plain', '_probe_plain_async', '_probe_direct', '_probe_async', '_probe_indirect', '_probe_callback', '_probe_stats', '_probe_reset'];
  const link = ['-Os', '-fexceptions', '-sDISABLE_EXCEPTION_CATCHING=0', '-sJSPI=1', '-sWASM_BIGINT=1', '-sASSERTIONS=1', '-sEXCEPTION_STACK_TRACES=0', '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=web', '-sEXIT_RUNTIME=0', '-sINITIAL_MEMORY=16MB', '-sMAXIMUM_MEMORY=64MB', '-sALLOW_MEMORY_GROWTH=1', '-sSTACK_SIZE=65536', '-sEXPORTED_FUNCTIONS=' + JSON.stringify(exports), '-sEXPORTED_RUNTIME_METHODS=["callMain"]', '-Wl,--threads=1'];
  const variants = [];
  for (const variant of ['default', 'explicit']) {
    const output = path.join(build, variant); await mkdir(output, { recursive: true });
    const selection = variant === 'explicit' ? ['-sJSPI_EXPORTS=["main","probe_plain","probe_plain_async","probe_direct","probe_async","probe_indirect"]'] : [];
    commands.push(await bounded(python, [compiler, path.join(build, 'fixture.o'), path.join(build, 'targets.o'), ...link, ...selection, '-o', path.join(output, 'probe.mjs')], { prefix: path.join(output, 'link'), marker: root, env }));
    const js = await readFile(path.join(output, 'probe.mjs'), 'utf8');
    const invokes = [...new Set([...js.matchAll(/function (invoke_[A-Za-z0-9_]+)\(/g)].map(match => match[1]))];
    if (!invokes.includes('invoke_iii')) throw new Error('Fixture did not retain the required legacy invoke_iii bridge; no compatibility assertion is valid.');
    variants.push({ variant, invokeWrappers: invokes, files: await Promise.all(['probe.mjs', 'probe.wasm'].map(file => pin(path.join(output, file)))) });
  }
  const manifest = { schemaVersion: 1, status: 'built-not-browser-tested', sdkVersion: version, legacyExceptionABI: true, nativeWasmExceptions: false, sourceAudit: await pin(auditPath), sourceFiles: await Promise.all(['fixture.h', 'fixture.cpp', 'targets.cpp'].map(file => pin(path.join(root, file)))), sdkFiles: sdkPins, flags, linkFlags: link, commands, variants };
  await writeFile(path.join(build, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ status: manifest.status, manifest: path.join(build, 'manifest.json') }));
} finally { await slot.release(); }
