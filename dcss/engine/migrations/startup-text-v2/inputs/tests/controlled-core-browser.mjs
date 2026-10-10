// Run one disposable, source-controlled fixture per Chrome process.
// DCSS_ENGINE_MODE=jspi node tests/controlled-core-browser.mjs --flow=combat
// Other --flow values: branch, death, victory. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from '../web/server.mjs';
import { verifyControlledGameFlow, verifyControlledSource, nativeFrameRows, classifyStartingWeaponMenu } from './controlled-gameplay-browser.mjs';

const flowArgs = process.argv.slice(2);
assert.equal(flowArgs.length, 1, 'choose exactly one --flow=combat|branch|death|victory');
const flow = flowArgs[0].match(/^--flow=(combat|branch|death|victory)$/)?.[1];
assert(flow, 'unsupported controlled flow');
const runtime = process.env.DCSS_ENGINE_MODE ?? 'jspi';
assert(['asyncify', 'jspi'].includes(runtime), 'unsupported engine mode');
const directory = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(directory, '..');
const label = flow + '-' + new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(directory, 'output/core-gameflows', label);
await mkdir(output, { recursive: true });
const buildDirectory = path.join(gameRoot, 'engine', runtime === 'jspi' ? 'build-jspi' : 'build');
const manifestBytes = await readFile(path.join(buildDirectory, 'manifest.json'));
const build = JSON.parse(manifestBytes.toString('utf8'));
assert.equal(build.upstream_commit, '1eebc1a2892e1c89776a0d7a10691f8dac8d9796');
assert.equal(build.version, '0.34.1');
if (runtime === 'jspi') {
  assert.equal(build.runtime, 'jspi');
  assert.equal(build.exception_model, 'wasm', 'do not rerun the known constructor-incompatible JS-EH JSPI artifact');
}
const official = await verifyControlledSource();
const evidence = { time: new Date().toISOString(), flow, runtime,
  scope: 'controlled official C++ WIZARD fixtures in local Chrome; not a normal unassisted full playthrough',
  external_publication: false, compilation_settings: 'ordinary Chrome V8 settings; no baseline-only or single-compilation diagnostic flags',
  upstream: official.upstream, build, manifest_sha256: createHash('sha256').update(manifestBytes).digest('hex'),
  output, checks: [], runtimeErrors: [], console: [], screenshots: [] };
let chrome, socket, server, cdp;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(callback, labelValue) {
  evidence.step = labelValue;
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) { const value = await callback(); if (value) return value; await delay(100); }
  throw Error('Timed out: ' + labelValue + ' ' + (evidence.chrome_stderr ?? '').slice(-500));
}
class CDP {
  constructor(connected) {
    this.socket = connected; this.id = 0; this.pending = new Map();
    connected.addEventListener('message', event => {
      const packet = JSON.parse(event.data);
      if (packet.method === 'Runtime.exceptionThrown') evidence.runtimeErrors.push(packet.params);
      if (packet.method === 'Runtime.consoleAPICalled') {
        evidence.console.push({ type: packet.params.type, args: packet.params.args.map(arg => arg.value ?? arg.description) });
        if (evidence.console.length > 100) evidence.console.shift();
      }
      if (packet.id) {
        const waiting = this.pending.get(packet.id); this.pending.delete(packet.id);
        if (waiting) { clearTimeout(waiting.timer); packet.error ? waiting.reject(Error(JSON.stringify(packet.error))) : waiting.resolve(packet.result); }
      }
    });
    connected.addEventListener('close', () => {
      for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(Error('CDP disconnected')); }
      this.pending.clear();
    });
  }
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id, timer = setTimeout(() => { this.pending.delete(id); reject(Error('CDP timeout ' + method + ' at ' + evidence.step)); }, 60000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
}
try {
  server = createPreviewServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const coreQuery = '?core=1&species=Hu&job=Fi&seed=42' + (runtime === 'jspi' ? '&runtime=jspi' : '');
  evidence.base = base; evidence.url = base + coreQuery;
  const profile = await mkdtemp(path.join(os.tmpdir(), 'dcss-controlled-' + flow + '-'));
  evidence.chrome_profile = profile;
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  evidence.chrome_pid = chrome.pid; evidence.chrome_started = new Date().toISOString();
  let launchError;
  chrome.on('error', error => { launchError = error; });
  chrome.stderr.on('data', chunk => { evidence.chrome_stderr = ((evidence.chrome_stderr ?? '') + chunk.toString()).slice(-20000); });
  const port = await until(async () => { if (launchError) throw launchError; try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return null; } }, 'owned Chrome debug port');
  const browserVersion = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json();
  evidence.browser_version = browserVersion.Browser;
  const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  cdp = new CDP(socket); await cdp.call('Runtime.enable'); await cdp.call('Page.enable');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.call('Page.navigate', { url: base + coreQuery });
  await until(() => cdp.eval('Boolean(window.__dcssCore?.waiting)'), 'native normal-game startup input');
  if (!await cdp.eval('__dcssVerification.frame?.cells.some(cell=>cell.glyph===64)')) {
    // Genuine starting-weapon menu: confirm its existing default, do not skip
    // character generation or inject an equipped weapon into native state.
    evidence.startup_rows = await cdp.eval('(' + nativeFrameRows.toString() + ')(__dcssVerification.frame)');
    evidence.startup_prompt = evidence.startup_rows.join('\n');
    evidence.startup_menu = classifyStartingWeaponMenu(evidence.startup_rows, official.startup_weapon_prompts, official.startup_weapon_labels);
    assert(evidence.startup_menu, 'only the source-verified EN/JA weapon-choice menu may receive startup Enter');
    evidence.native_startup_language = await cdp.eval('__dcssCore.nativeLanguage ?? null');
    if (evidence.native_startup_language !== null) assert.equal(evidence.startup_menu.language, evidence.native_startup_language);
    await cdp.eval('__dcssCore.queue(13)');
  }
  await until(() => cdp.eval('Boolean(window.__dcssCore?.waiting)&&__dcssVerification.frame?.cells.some(cell=>cell.glyph===64)'), 'authentic Human Fighter normal player frame');
  evidence.initial = await cdp.eval('__dcssCore.state()');
  assert(evidence.initial.hp > 0); assert.equal(evidence.initial.branch, 0); assert.equal(evidence.initial.depth, 1); assert.equal(evidence.initial.rng.length, 45);
  assert.equal(await cdp.eval('document.documentElement.lang'), 'ja');
  const capture = async name => {
    assert.match(name, /^[a-z-]+$/);
    const filename = path.join(output, name + '.png');
    const result = await cdp.call('Page.captureScreenshot', { format: 'png' });
    await writeFile(filename, Buffer.from(result.data, 'base64')); evidence.screenshots.push(filename);
  };
  await verifyControlledGameFlow({ cdp, until, evidence, flow, base, coreQuery, capture });
  assert.equal(evidence.runtimeErrors.length, 0, 'real page must not have uncaught JavaScript errors');
  evidence.result = 'pass';
} catch (error) { evidence.result = 'fail'; evidence.error = error.stack; process.exitCode = 1; }
finally {
  if (cdp && socket?.readyState === WebSocket.OPEN) await cdp.call('Browser.close').catch(() => {});
  if (socket) socket.close();
  if (chrome && chrome.exitCode === null) {
    // This unique test child only. Never target other games or global Chrome.
    const ended = new Promise(resolve => chrome.once('exit', resolve));
    const drained = await Promise.race([ended.then(() => true), delay(5000).then(() => false)]);
    if (!drained && chrome.exitCode === null) chrome.kill();
  }
  if (server) { server.closeAllConnections(); server.close(); }
  evidence.finished = new Date().toISOString();
  await writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  process.stdout.write(JSON.stringify({ result: evidence.result, flow, runtime, output, step: evidence.step, checks: evidence.checks, error: evidence.error }, null, 2) + '\n');
}
