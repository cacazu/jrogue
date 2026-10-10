import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, writeFile, stat, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CDP, until, delay, key } from './cdp.mjs';
import { assertAcceptedEngineFiles, assertAcceptedManifestBytes, assertAcceptedEngineManifest } from './accepted-engine-files.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
if (process.env.CDDA_BROWSER_SLOT !== 'parent-coordinated') throw new Error('Wait for the parent-coordinated real-game browser window before starting this session.');
const compilationModes = Object.freeze({
  'default-v8': { experimental: false, jsFlags: [], minimumPhysicalBytes: 4 * 1024 ** 3, minimumCommitBytes: 6 * 1024 ** 3 },
  'liftoff-only-lazy': { experimental: true, jsFlags: ['--liftoff-only', '--wasm-lazy-compilation'], minimumPhysicalBytes: 7 * 1024 ** 3, minimumCommitBytes: 9 * 1024 ** 3 }
});
const compilationMode = process.env.CDDA_BROWSER_COMPILATION_MODE || 'default-v8';
if (!Object.hasOwn(compilationModes, compilationMode)) throw new Error('Only the fixed default-v8 or parent-reviewed liftoff-only-lazy compilation modes are allowed.');
const compilation = compilationModes[compilationMode];
const privateBudget = Number(process.env.CDDA_BROWSER_PRIVATE_BUDGET_BYTES);
const remainingFloor = Number(process.env.CDDA_BROWSER_REMAINING_FLOOR_BYTES);
if (!Number.isSafeInteger(privateBudget) || privateBudget < 1024 ** 3 || !Number.isSafeInteger(remainingFloor) || remainingFloor < 2 * 1024 ** 3) throw new Error('The parent must explicitly select the real-browser private budget and remaining-memory floor.');
if (compilation.experimental && (privateBudget !== 5 * 1024 ** 3 || remainingFloor !== 2 * 1024 ** 3)) throw new Error('The conditional Liftoff/lazy experiment retains exactly the parent-selected 5 GiB cap and 2 GiB floors.');
async function readMemory() {
  const helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(directory, 'memory.ps1')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = ''; helper.stdout.on('data', chunk => stdout += chunk); helper.stderr.on('data', chunk => stderr += chunk);
  const code = await new Promise((resolve, reject) => { helper.on('exit', resolve); helper.on('error', reject); });
  if (code !== 0) throw new Error('Read-only memory helper failed: ' + stderr);
  return JSON.parse(stdout.replace(/^\ufeff/, ''));
}
const base = new URL(process.argv[2] || 'http://127.0.0.1:8878/');
if (base.hostname !== '127.0.0.1' || base.protocol !== 'http:') throw new Error('Only the confirmed loopback package URL is allowed.');
const packageRoot = path.resolve(directory, '../baseline-preview/web');
const manifestBytes = await readFile(path.join(packageRoot, 'package-manifest.json'));
assertAcceptedManifestBytes(manifestBytes);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
assertAcceptedEngineManifest(manifest);
if (!manifest.baselineOnly || !manifest.publication.localOnly) throw new Error('Expected the original-engine local reference package.');
const packageFiles = [];
for (const filename of ['cataclysm-tiles.js', 'cataclysm-tiles.wasm', 'cataclysm-tiles.data.js', 'cataclysm-tiles.data']) {
  const full = path.join(packageRoot, filename); const hash = createHash('sha256');
  for await (const bytes of createReadStream(full)) hash.update(bytes);
  packageFiles.push({ filename, bytes: (await stat(full)).size, sha256: hash.digest('hex') });
}
assertAcceptedEngineFiles(packageFiles);
const packageResponse = await fetch(new URL('package-manifest.json', base));
if (!packageResponse.ok) throw new Error('The live package server must serve the verified local manifest.');
const liveManifestBytes = Buffer.from(await packageResponse.arrayBuffer());
assertAcceptedManifestBytes(liveManifestBytes);
if (JSON.stringify(JSON.parse(liveManifestBytes.toString('utf8'))) !== JSON.stringify(manifest)) throw new Error('The live package server must serve the verified local manifest.');
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const preparedIndex = process.argv.indexOf('--prepared');
const prepared = preparedIndex < 0 ? null : JSON.parse(await readFile(process.argv[preparedIndex + 1], 'utf8'));
if (prepared && (prepared.base !== String(base) || JSON.stringify(prepared.packageFiles) !== JSON.stringify(packageFiles) || prepared.compilationMode !== compilationMode)) throw new Error('Prepared launch and actual package bytes/allowlisted compilation mode differ.');
const output = prepared?.output || path.join(directory, 'output', stamp);
if (!path.resolve(output).startsWith(directory + path.sep)) throw new Error('QA output must remain in its owned directory.');
await mkdir(output, { recursive: true });
await mkdir(path.join(directory, 'profiles'), { recursive: true });
let profile = prepared?.profile || null;
if (profile && !path.resolve(profile).startsWith(path.join(directory, 'profiles') + path.sep)) throw new Error('Use only the isolated QA profile.');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
await stat(chrome);
const compilationRecordBytes = await readFile(path.join(directory, 'compilation-modes.json'));
const startMemory = await readMemory();
const recordFields = { base: String(base), output, profile, packageFiles, selectedEngine: manifest.selectedEngine, sourceCommit: manifest.sourceCommit, compilationMode, compilationModeRecordSha256: createHash('sha256').update(compilationRecordBytes).digest('hex'), experimentalCompilation: compilation.experimental, chromeJsFlags: compilation.jsFlags, minimumLaunchBytes: { physical: compilation.minimumPhysicalBytes, commit: compilation.minimumCommitBytes }, privateBudgetBytes: privateBudget, remainingFloorBytes: remainingFloor };
if (startMemory.availableBytes < compilation.minimumPhysicalBytes || startMemory.freeCommitBytes < compilation.minimumCommitBytes) {
  const noFit = { status: 'no-resource-fit-no-browser', checkedAt: new Date().toISOString(), requestedOperation: process.argv.includes('--prepare-only') ? 'prepare-only' : 'actual-pre-spawn', freshMemory: startMemory, ...recordFields };
  await writeFile(path.join(output, 'no-resource-fit-' + stamp + '.json'), JSON.stringify(noFit, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(noFit, null, 2)); process.exit(0);
}
if (!profile) { profile = await mkdtemp(path.join(directory, 'profiles', 'cdda-')); recordFields.profile = profile; }
if (process.argv.includes('--prepare-only')) {
  const preparationRecord = { preparedAt: new Date().toISOString(), memoryKind: 'prepare-only-snapshot-not-launch-evidence', preparationMemory: startMemory, ...recordFields };
  await writeFile(path.join(output, 'preparation.json'), JSON.stringify(preparationRecord, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: 'prepared-no-browser', ...preparationRecord }, null, 2)); process.exit(0);
}
const launchRecord = { preparedAt: prepared?.preparedAt || null, preparationMemory: prepared?.preparationMemory || null, actualPreSpawnAt: new Date().toISOString(), memoryKind: 'fresh-actual-pre-spawn-decisive-after-stream-hashes', startMemory, ...recordFields };
await writeFile(path.join(output, 'pre-launch.json'), JSON.stringify(launchRecord, null, 2) + '\n', { flag: 'wx' });
const handle = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions',
  '--remote-debugging-port=0', '--user-data-dir=' + profile,
  '--enable-unsafe-swiftshader', '--use-angle=swiftshader', ...(compilation.jsFlags.length ? ['--js-flags=' + compilation.jsFlags.join(' ')] : []), 'about:blank'],
{ windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let chromeErrors = '';
let rejectedChromeFlags = null;
handle.stderr.on('data', chunk => { chromeErrors = (chromeErrors + chunk.toString()).slice(-16000); if (/unrecogni[sz]ed flag|unknown flag|remaining arguments were ignored|flag parsing.*failed/i.test(chromeErrors)) rejectedChromeFlags = 'Installed Chrome/V8 rejected an allowlisted experiment flag: ' + chromeErrors; });
let cdp;
let closing = false;
const evidence = { startedAt: new Date().toISOString(), status: 'running', scope: 'original-cpp-local-reference',
  publicationAuthorized: false, base: String(base), package: manifest, packageFiles,
  startMemory, preparationMemory: prepared?.preparationMemory || null, compilationMode, experimentalCompilation: compilation.experimental, chromeJsFlags: compilation.jsFlags,
  memoryLimits: { privateBudgetBytes: privateBudget, remainingFloorBytes: remainingFloor, minimumPhysicalLaunchBytes: compilation.minimumPhysicalBytes, minimumCommitLaunchBytes: compilation.minimumCommitBytes },
  limitations: ['Desktop Chrome mobile emulation; no physical mobile device.', 'Software SwiftShader WebGL; no hardware GPU acceptance.', 'Original C++ reference frontend plus bounded Rust shell/helpers; full Rust UI migration unverified.', 'Sound disabled in reference engine.', 'Native save/resume does not prove deterministic RNG continuation.', ...(compilation.experimental ? ['Experimental per-process Liftoff/lazy compilation; potentially slower execution and unproved memory benefit.', 'Installed V8 source tag is unpinned; no default product/browser/security/site configuration change.'] : [])],
  ownedChrome: { pid: handle.pid, profile, executable: chrome }, commands: [], screenshots: [], blockers: [], requests: [], downloads: [] };
const guardPath = path.join(output, 'memory-guard.json'), stopPath = path.join(output, 'guard-stop');
const guard = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(directory, 'resource-guard-v3.ps1'), '-OwnedRootPid', String(handle.pid), '-ExpectedProfile', profile, '-OutputPath', guardPath, '-StopPath', stopPath, '-PrivateBudgetBytes', String(privateBudget), '-RemainingFloorBytes', String(remainingFloor)], { windowsHide: true, stdio: 'ignore' });
const guardExit = new Promise(resolve => guard.on('exit', resolve));
let cleanupStarted = false;
guardExit.then(async code => {
  if (!cleanupStarted) { evidence.status = 'failed-resource-guard'; evidence.blockers.push({ at: new Date().toISOString(), reason: 'Owned memory monitor ended during active browser QA', exitCode: code }); await cleanup(); console.log(JSON.stringify({ status: evidence.status, output })); }
}).catch(error => { console.error('Guard cleanup failed: ' + String(error)); });
const persist = async () => {
  evidence.chromeStderr = chromeErrors;
  try { evidence.memoryGuard = JSON.parse((await readFile(guardPath, 'utf8')).replace(/^\ufeff/, '')); } catch {}
  if (cdp) evidence.runtimeEvents = cdp.events.filter(event =>
    ['Runtime.exceptionThrown', 'Network.loadingFailed', 'Inspector.targetCrashed', 'Runtime.consoleAPICalled', 'Log.entryAdded'].includes(event.method)).slice(-120);
  await writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(path.join(directory, 'active-session.json'), JSON.stringify({ output, profile, chromePid: handle.pid, controlUrl: 'http://127.0.0.1:8890/' }, null, 2) + '\n');
};
const diagnosticsExpression = `(() => {
  const canvas = document.getElementById('canvas');
  const rect = canvas?.getBoundingClientRect();
  const stage = document.getElementById('stage')?.getBoundingClientRect();
  return { diagnostics: window.cddaBaselineDiagnostics || null, documentLanguage: document.documentElement.lang,
    title: document.title, loading: document.getElementById('loading')?.textContent,
    loadingHidden: document.getElementById('loading')?.hidden, gameUnsaved: window.game_unsaved,
    wasmHeapBytes: (typeof HEAPU8 !== 'undefined' ? HEAPU8?.byteLength : window.Module?.HEAPU8?.byteLength) || null,
    canvas: rect ? { width: canvas.width, height: canvas.height, x: rect.x, y: rect.y, cssWidth: rect.width, cssHeight: rect.height } : null,
    stage: stage ? { x: stage.x, y: stage.y, width: stage.width, height: stage.height } : null,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight };
})()`;
async function nativeFiles() {
  return await cdp.evaluate(String.raw`(async () => {
    const FS = window.Module?.FS;
    if (!FS) return { available: false };
    const root = '/home/web_user/.cataclysm-dda';
    if (!FS.analyzePath(root).exists) return { available: true, rootExists: false };
    const files = [];
    async function visit(dir, relative) {
      for (const name of FS.readdir(dir).filter(name => name !== '.' && name !== '..').sort()) {
        const full = dir + '/' + name, rel = relative ? relative + '/' + name : name;
        const stat = FS.stat(full);
        if (FS.isDir(stat.mode)) await visit(full, rel);
        else if (FS.isFile(stat.mode)) {
          const bytes = FS.readFile(full);
          const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
          const record = { path: rel, bytes: bytes.length, sha256: Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('') };
          if (/options\.json$|worldoptions\.json$|master\.gsav$|\.sav$/.test(rel) && bytes.length < 2000000) {
            try { const text = new TextDecoder().decode(bytes); const first = text.indexOf('{');
              record.versionLine = text.slice(0, first < 0 ? 200 : first);
              if (/options\.json$/.test(rel)) record.options = JSON.parse(text).filter(option => ['USE_LANG','USE_TILES','TILES','TERMINAL_X','TERMINAL_Y','DEF_CHAR_NAME'].includes(option.name));
              else if (first >= 0) { const value = JSON.parse(text.slice(first));
                record.summary = { name: value.name, savegame_loading_version: value.savegame_loading_version, turn: value.turn, calendar_start: value.calendar_start,
                  initial_season: value.initial_season, player: value.player ? { name: value.player.name,
                    pos: value.player.pos, posx: value.player.posx, posy: value.player.posy, posz: value.player.posz,
                    moves: value.player.moves } : undefined }; }
            } catch (error) { record.summaryError = String(error); }
          }
          files.push(record);
        }
      }
    }
    await visit(root, '');
    return { available: true, rootExists: true, files };
  })()`, 60000);
}
async function capture(name) {
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(name)) throw new Error('Use a simple bounded screenshot name.');
  const result = await cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 60000);
  const bytes = Buffer.from(result.data, 'base64');
  const filename = name + '.png';
  await writeFile(path.join(output, filename), bytes);
  const record = { at: new Date().toISOString(), filename, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), diagnostics: await cdp.evaluate(diagnosticsExpression) };
  evidence.screenshots.push(record);
  return record;
}
async function pointerTarget(command) {
  if (command.selector) return cdp.evaluate(`(() => {const element=document.querySelector(${JSON.stringify(command.selector)});if(!element)throw new Error('Pointer target missing');const rect=element.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};})()`);
  if (!Number.isFinite(command.x) || !Number.isFinite(command.y)) throw new Error('Use a selector or viewport coordinates.');
  return { x: command.x, y: command.y };
}
async function exportArchive() {
  const unsaved = await cdp.evaluate('Boolean(window.game_unsaved)');
  if (unsaved) throw new Error('Use the original game save/quit flow before testing archive export.');
  const before = await nativeFiles();
  const previousDownloads = new Set(await readdir(path.join(output, 'downloads')));
  await cdp.evaluate('window.cddaBaselineExportSaveFiles()');
  const download = await until(async () => {
    const names = await readdir(path.join(output, 'downloads'));
    const filename = names.find(name => !previousDownloads.has(name) && /^cdda-0\.I-1-native-files.*\.json$/.test(name));
    return filename && !names.some(name => name.endsWith('.crdownload')) ? filename : false;
  }, 'native-file archive download', 30000);
  const bytes = await readFile(path.join(output, 'downloads', download));
  const archive = JSON.parse(bytes);
  if (archive.format !== 'cdda-original-files' || archive.version !== 1 || archive.upstream?.commit !== manifest.sourceCommit || !Array.isArray(archive.files)) throw new Error('Export container format/version/source mismatch.');
  const actual = archive.files.map(file => {
    if (file.encoding !== 'base64' || typeof file.path !== 'string' || file.path.startsWith('/') || file.path.split('/').includes('..')) throw new Error('Unexpected native-file path or encoding.');
    const data = Buffer.from(file.data, 'base64');
    if (data.length !== file.bytes) throw new Error('Exported native byte length mismatch: ' + file.path);
    return { path: file.path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  }).sort((a,b) => a.path.localeCompare(b.path));
  const expected = before.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })).sort((a,b) => a.path.localeCompare(b.path));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Native archive differs from its preceding file snapshot; atomic export fidelity remains unverified.');
  const record = { filename: download, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), version: archive.version, sourceCommit: archive.upstream.commit, files: actual, nativeFileRoundtrip: 'matched exact paths and bytes' };
  evidence.downloads.push(record); return record;
}
async function operation(command) {
  if (cleanupStarted) throw new Error('The owned browser session has closed.');
  switch (command.op) {
    case 'status': return cdp.evaluate(diagnosticsExpression);
    case 'metrics': { const heap = await cdp.call('Runtime.getHeapUsage'); const layout = await cdp.call('Page.getLayoutMetrics');
      const native = await cdp.evaluate(`(() => {const canvas=document.getElementById('canvas'),rect=canvas?.getBoundingClientRect();return {linearMemoryBytes:typeof HEAPU8!=='undefined'?HEAPU8.byteLength:null,performanceMemory:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit}:null,canvas:{backingWidth:canvas?.width,backingHeight:canvas?.height,cssWidth:rect?.width,cssHeight:rect?.height,externalCssOwnership:canvas?.external_size},emscriptenBrowser:typeof Browser!=='undefined'?{resizeCanvas:!!Browser.resizeCanvas,resizeListeners:Browser.resizeListeners?.length}:null,nativeWindowExportAvailable:false,diagnostics:window.cddaBaselineDiagnostics?{phase:window.cddaBaselineDiagnostics.phase,menuReady:window.cddaBaselineDiagnostics.menuReady,logs:window.cddaBaselineDiagnostics.logs?.slice(-12),events:window.cddaBaselineDiagnostics.events?.slice(-8)}:null};})()`);
      return { at: new Date().toISOString(), heap, layout, native }; }
    case 'eval': return cdp.evaluate(command.expression, Math.min(command.timeout || 30000, 60000));
    case 'key': await cdp.evaluate("document.getElementById('canvas').focus()"); await key(cdp, command.key); await delay(command.delay || 500); return cdp.evaluate(diagnosticsExpression);
    case 'keys': for (const value of command.keys) { await cdp.evaluate("document.getElementById('canvas').focus()"); await key(cdp, value); await delay(command.delay || 200); } return cdp.evaluate(diagnosticsExpression);
    case 'capture': return capture(command.name);
    case 'viewport': await cdp.call('Emulation.setDeviceMetricsOverride', { width: command.width, height: command.height, deviceScaleFactor: command.dpr || 1, mobile: !!command.mobile });
      await cdp.call('Emulation.setTouchEmulationEnabled', { enabled: !!command.mobile, maxTouchPoints: 1 }); await delay(600); return cdp.evaluate(diagnosticsExpression);
    case 'reload': await cdp.call('Page.reload', { ignoreCache: true }); await delay(1000); return cdp.evaluate(diagnosticsExpression);
    case 'dialog': await cdp.call('Page.handleJavaScriptDialog', { accept: !!command.accept, promptText: command.promptText || '' }); return { handled: true, accepted: !!command.accept };
    case 'files': return nativeFiles();
    case 'text': await cdp.evaluate("document.getElementById('canvas').focus()");
      for (const character of command.text) await cdp.call('Input.dispatchKeyEvent', { type: 'char', text: character });
      await delay(400); return { sentText: command.text, delivery: 'native CDP character events; verify visible/native save result separately' };
    case 'compose': await cdp.evaluate("document.getElementById('canvas').focus()");
      await cdp.call('Input.imeSetComposition', { text: command.text, selectionStart: 0, selectionEnd: command.text.length });
      await cdp.call('Input.insertText', { text: command.text }); return { sentText: command.text, delivery: 'emulated composition; no physical IME acceptance claim' };
    case 'click': { const position = await pointerTarget(command); await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...position }); await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...position }); await delay(500); return cdp.evaluate(diagnosticsExpression); }
    case 'tap': { const position = await pointerTarget(command); await cdp.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...position, radiusX: 2, radiusY: 2, force: 1, id: 1 }] }); await cdp.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await delay(500); return cdp.evaluate(diagnosticsExpression); }
    case 'export': return exportArchive();
    case 'network': return { requests: evidence.requests, external: evidence.requests.filter(record => !record.loopback && /^https?:/.test(record.url)) };
    case 'record': evidence.commands.push({ at: new Date().toISOString(), verifiedObservation: command.observation, screenshots: command.screenshots || [], status: command.status || 'observed' }); return { recorded: true };
    case 'close': closing = true; evidence.status = command.status || 'stopped'; evidence.finishedAt = new Date().toISOString(); return { closed: true };
    default: throw new Error('Unknown operation.');
  }
}
const server = http.createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/') { response.writeHead(404).end(); return; }
  const chunks = [];
  let length = 0;
  for await (const chunk of request) { length += chunk.length; if (length > 100000) { response.writeHead(413).end(); return; } chunks.push(chunk); }
  const entry = { at: new Date().toISOString() };
  try {
    const command = JSON.parse(Buffer.concat(chunks).toString()); entry.command = command;
    entry.result = await operation(command); evidence.commands.push(entry); await persist();
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(entry.result));
    if (closing) await cleanup();
  } catch (error) {
    entry.error = error.stack || String(error); evidence.commands.push(entry); await persist();
    response.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: entry.error }));
  }
});
async function cleanup() {
  if (cleanupStarted) return; cleanupStarted = true;
  await writeFile(stopPath, 'Owned browser QA closed.\n'); await guardExit;
  try { evidence.memoryGuard = JSON.parse((await readFile(guardPath, 'utf8')).replace(/^\ufeff/, '')); } catch {}
  if (cdp) { try { await cdp.call('Browser.close', {}, 5000); } catch {} cdp.socket.close(); }
  // Recorded descendants may outlive their root; never rediscover ownership from a fresh PID/profile.
  const cleanupPath = path.join(output, 'cleanup.json');
  const closer = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(directory, 'resource-guard-v3.ps1'), '-OwnedRootPid', String(handle.pid), '-ExpectedProfile', profile, '-OutputPath', cleanupPath, '-StopPath', stopPath, '-RecordedGuardPath', guardPath, '-CloseOwned'], { windowsHide: true, stdio: 'ignore' });
  evidence.recordedIdentityCleanupExitCode = await new Promise(resolve => closer.on('exit', resolve));
  server.close();
  await delay(1000);
  const teardown = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(directory, 'verify-teardown-v3.ps1'), '-GuardPath', guardPath, '-CleanupPath', cleanupPath, '-OutputPath', path.join(output, 'teardown.json')], { windowsHide: true, stdio: 'ignore' }); await new Promise(resolve => teardown.on('exit', resolve));
  try { evidence.teardown = JSON.parse((await readFile(path.join(output, 'teardown.json'), 'utf8')).replace(/^\ufeff/, '')); } catch {}
  if (evidence.status === 'passed' && (!evidence.teardown?.allRecordedOwnedProcessesExited || evidence.memoryGuard?.status !== 'completed')) evidence.status = 'failed-teardown-or-resource-guard';
  await persist();
}
process.on('SIGINT', async () => { evidence.status = 'interrupted'; evidence.finishedAt = new Date().toISOString(); await persist(); await cleanup(); });
try {
  await until(async () => { try { const data = JSON.parse((await readFile(guardPath, 'utf8')).replace(/^\ufeff/, '')); if (data.status !== 'monitoring') throw new Error('Owned browser guard: ' + data.status); return data.samples.length > 0; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }, 'first real-game browser memory sample');
  const port = await until(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; } }, 'owned Chrome debugging port');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  cdp = await CDP.connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await cdp.call('Runtime.enable'); await cdp.call('Page.enable'); await cdp.call('Network.enable'); await cdp.call('Log.enable');
  await delay(300);
  if (rejectedChromeFlags) throw new Error(rejectedChromeFlags);
  cdp.on('Network.requestWillBeSent', data => { let loopback = false; try { loopback = new URL(data.request.url).hostname === base.hostname; } catch {} evidence.requests.push({ at: new Date().toISOString(), url: data.request.url, method: data.request.method, type: data.type, loopback }); });
  cdp.on('Page.javascriptDialogOpening', data => { evidence.commands.push({ at: new Date().toISOString(), browserDialog: data }); });
  const downloads = path.join(output, 'downloads'); await mkdir(downloads, { recursive: true });
  await cdp.call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  evidence.browserVersion = await cdp.call('Browser.getVersion');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.call('Page.navigate', { url: String(base) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8890, '127.0.0.1', resolve); });
  await persist();
  console.log(JSON.stringify({ status: 'browser-started', output, ownedChromePid: handle.pid, controlUrl: 'http://127.0.0.1:8890/' }));
} catch (error) {
  evidence.status = 'failed'; evidence.error = error.stack || String(error); evidence.finishedAt = new Date().toISOString(); await persist(); await cleanup(); throw error;
}
