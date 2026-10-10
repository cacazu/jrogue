// Run one disposable, source-controlled fixture per Chrome process.
// DCSS_ENGINE_MODE=jspi node tests/dynamic-startup-browser.mjs --language=ja [--named]
// Other --flow values: branch, death, victory. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from '../web/server.mjs';
import { verifyControlledSource, nativeFrameRows } from './controlled-gameplay-browser.mjs';
import { verifyNativeDynamicStartup } from './native-dynamic-startup-browser.mjs';

const selected=process.argv.slice(2);
assert(selected.length>=1&&selected.length<=2,'use --language=ja|en [--named]');
const language=selected[0].match(/^--language=(ja|en)$/)?.[1];assert(language);
const named=selected[1]==='--named';assert(selected.length===1||named);
const flow='startup-'+language+'-'+(named?'named':'unnamed');
const runtime = process.env.DCSS_ENGINE_MODE ?? 'jspi';
assert.equal(runtime,'jspi','dynamic native UI candidate requires the production JSPI runtime');
const directory = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(directory, '..');
const label = flow + '-' + new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(directory, 'output/native-startup-v2', label);
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
  scope: 'actual original-engine character menus/newgame/ordinary wait/native save/quit in local Chrome; no WIZARD',
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
  const coreQuery = '?reference=1';
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
  await until(()=>cdp.eval('Boolean(window.__dcssVerification?.call)&&__dcssVerification.mode==="reference"'),'explicit reference host ready without default engine');
  await cdp.eval('document.querySelector("#language").value='+JSON.stringify(language)+';document.querySelector("#language").dispatchEvent(new Event("change"))');
  const capture = async name => {
    assert.match(name, /^[a-z-]+$/);
    const filename = path.join(output, name + '.png');
    const result = await cdp.call('Page.captureScreenshot', { format: 'png' });
    await writeFile(filename, Buffer.from(result.data, 'base64')); evidence.screenshots.push(filename);
  };
  await verifyNativeDynamicStartup({cdp,until,language,named,evidence,capture});
  assert.equal(evidence.runtimeErrors.length, 0, 'real page must not have uncaught JavaScript errors');
  evidence.result = 'pass';
} catch (error) { evidence.result='fail';evidence.error=error.stack;process.exitCode=1;if(cdp)try{evidence.failure_native=await cdp.eval('({frame:__dcssVerification?.frame,waiting:window.__dcssDynamicCore?.waiting,error:window.__dcssDynamicCore?.error,completed:window.__dcssDynamicCore?.completed})');}catch(snapshotError){evidence.failure_snapshot_error=String(snapshotError);} }
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
