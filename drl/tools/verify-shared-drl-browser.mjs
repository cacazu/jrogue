// Author/check only while another browser gate is active. The parent runs this
// serially after copying the verified checkpoint into the shared checkout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const task = fileURLToPath(new URL('../', import.meta.url));
const shared = 'C:\\Users\\kit\\gameme\\jnethack\\jrouge\\drl';
const dist = path.join(shared, 'port/dist');
const receipt = path.join(task, 'docs/SHARED-LOCAL-BROWSER-EVIDENCE.json');
const output = path.join(task, 'docs/shared-local-browser');
assert.equal(fs.existsSync(receipt), false, 'New evidence must not overwrite an existing receipt');
assert.equal(fs.existsSync(output), false, 'Screenshot directory must be new');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const deadline = Date.now() + 115000;
const evidence = {
  schema: 1, result: 'pending', started_utc: new Date().toISOString(), cwd: shared,
  scope: 'Actual shared-checkout HTTP/browser handoff smoke: authenticated aliases/assets, Japanese native logo/main menu, and 390px shell layout. No gameplay selection, campaign, or public deployment proof.',
  shared_checkout_mutated: false, source_or_gameplay_mutated: false,
  checks: [], actions: [], browser_errors: [], console: [], screenshots: [],
  full_port_complete: false, campaign_started: false,
};
let serverProcess, chrome, profile, socket, cdp, serverLog = '', serverError = '', chromeError = '';
const emergency = setTimeout(() => { socket?.close(); chrome?.kill(); serverProcess?.kill(); }, 120000);
emergency.unref();
function remaining(cap = 10000) {
  const left = deadline - Date.now();
  assert.ok(left > 0, 'Shared smoke exceeded its bounded deadline');
  return Math.max(1, Math.min(cap, left));
}
function noLinks(file) {
  const absolute = path.resolve(file), parsed = path.parse(absolute);
  let current = parsed.root;
  for (const component of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    assert.equal(fs.lstatSync(current).isSymbolicLink(), false, `Unexpected ancestor link: ${current}`);
  }
}
async function fileHash(file) {
  noLinks(file);
  const digest = createHash('sha256');
  for await (const bytes of fs.createReadStream(file)) { remaining(); digest.update(bytes); }
  return digest.digest('hex');
}
async function sameSharedFile(relative) {
  const a = path.join(task, relative), b = path.join(shared, relative);
  const [current, copied] = await Promise.all([fileHash(a), fileHash(b)]);
  assert.equal(copied, current, `Shared bytes differ: ${relative}`);
  return { file: relative, size: fs.statSync(b).size, sha256: copied };
}
async function until(callback, label, cap = 30000) {
  const stop = Date.now() + remaining(cap);
  while (Date.now() < stop) {
    const value = await callback();
    if (value) return value;
    await pause(50);
  }
  throw new Error(`Timeout: ${label}; server=${serverError.slice(-1000)}; Chrome=${chromeError.slice(-1000)}`);
}
class CDP {
  constructor(ws, onEvent) {
    this.ws = ws; this.next = 0; this.pending = new Map();
    ws.addEventListener('message', event => {
      const packet = JSON.parse(event.data);
      if (!packet.id) { onEvent(packet); return; }
      const item = this.pending.get(packet.id); if (!item) return;
      clearTimeout(item.timer); this.pending.delete(packet.id);
      packet.error ? item.reject(new Error(JSON.stringify(packet.error))) : item.resolve(packet.result);
    });
    ws.addEventListener('close', () => {
      for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(new Error('Owned Chrome debugger closed')); }
      this.pending.clear();
    });
  }
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.next;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, remaining());
      this.pending.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const value = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    assert.ok(!value.exceptionDetails, JSON.stringify(value.exceptionDetails));
    return value.result.value;
  }
}
// Static test-label projection only; live game text/names are never rewritten.
const glyphs = text => text.replace(/\s/gu, '');
const staticText = text => {
  assert.equal(typeof text, 'string');
  return glyphs(text.replace(/\{[a-zA-Z!^]/g, '').replace(/[{}]/g, ''));
};
const contains = (screen, label) => label.length > 0 && glyphs(screen).includes(label);

try {
  noLinks(shared); assert.equal(fs.realpathSync.native(shared).toLowerCase(), path.resolve(shared).toLowerCase());
  const expectedBuild = JSON.parse(await readFile(path.join(task, 'port/dist/build.json'), 'utf8'));
  const expectedSource = JSON.parse(await readFile(path.join(task, 'port/dist/source-bundle.json'), 'utf8'));
  evidence.artifacts = {};
  for (const file of ['build.json', 'core-assets.json', 'source-bundle.json', 'source.zip', 'game.html', 'index.html', 'game.mjs', 'game.css', 'core-host.mjs', 'gameui-en.json', 'gameui-ja.json', expectedBuild.core.file, expectedBuild.adapter.file]) {
    evidence.artifacts[file] = await sameSharedFile(path.join('port/dist', file));
  }
  evidence.server_source = await sameSharedFile('port/web/server.mjs');
  const catalogs = {};
  for (const locale of ['en', 'ja']) {
    await sameSharedFile(`localization/${locale}.json`);
    catalogs[locale] = JSON.parse(await readFile(path.join(shared, `localization/${locale}.json`), 'utf8'));
  }
  assert.equal(evidence.artifacts[expectedBuild.core.file].sha256, expectedBuild.core.sha256);
  assert.equal(evidence.artifacts[expectedBuild.adapter.file].sha256, expectedBuild.adapter.sha256);
  assert.equal(evidence.artifacts['core-assets.json'].sha256, expectedBuild.assets.sha256);
  assert.equal(evidence.artifacts['source.zip'].sha256, expectedSource.sha256);
  assert.equal(evidence.artifacts['source.zip'].size, expectedSource.size);
  assert.equal(expectedSource.core_sha256, expectedBuild.core.sha256);
  assert.equal(evidence.artifacts['index.html'].sha256, evidence.artifacts['game.html'].sha256);
  evidence.core_sha256 = expectedBuild.core.sha256; evidence.adapter_sha256 = expectedBuild.adapter.sha256;
  evidence.source_archive_sha256 = expectedSource.sha256; evidence.identity = expectedBuild.identity;

  const chooser = net.createServer();
  await new Promise((resolve, reject) => { chooser.once('error', reject); chooser.listen(0, '127.0.0.1', resolve); });
  const port = chooser.address().port;
  await new Promise((resolve, reject) => chooser.close(error => error ? reject(error) : resolve()));
  const base = `http://127.0.0.1:${port}/`;
  evidence.actual_url = base; evidence.source_download_url = `${base}source.zip`;
  evidence.server_command = [process.execPath, path.join(shared, 'port/web/server.mjs')];
  serverProcess = spawn(evidence.server_command[0], evidence.server_command.slice(1), {
    cwd: shared, env: { ...process.env, DRL_PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  evidence.server_pid = serverProcess.pid;
  let serverFailure; serverProcess.once('error', error => { serverFailure = error; });
  serverProcess.stdout.on('data', bytes => { serverLog = (serverLog + bytes.toString()).slice(-16384); });
  serverProcess.stderr.on('data', bytes => { serverError = (serverError + bytes.toString()).slice(-16384); });
  await until(async () => {
    if (serverFailure) throw serverFailure;
    assert.equal(serverProcess.exitCode, null, 'Owned shared server exited; no foreign server fallback');
    return serverLog.includes(`Original DRL: ${base}game.html`);
  }, 'Owned shared server bind', 10000);
  async function fetched(relative, expectedHash) {
    const url = new URL(relative, base).href;
    const response = await fetch(url, { signal: AbortSignal.timeout(remaining()), cache: 'no-store' });
    assert.equal(response.status, 200, `Shared HTTP status: ${url}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const digest = sha(bytes); assert.equal(digest, expectedHash, `Shared HTTP bytes: ${url}`);
    return { url, status: response.status, size: bytes.length, sha256: digest };
  }
  evidence.http = [];
  for (const alias of ['', 'index.html', 'game.html']) evidence.http.push(await fetched(alias, evidence.artifacts['game.html'].sha256));
  for (const file of ['build.json', 'core-assets.json', 'source-bundle.json', expectedBuild.core.file, expectedBuild.adapter.file]) evidence.http.push(await fetched(file, evidence.artifacts[file].sha256));
  const manifest = JSON.parse(await readFile(path.join(dist, 'core-assets.json'), 'utf8'));
  for (const descriptor of manifest.files) {
    assert.ok(!descriptor.url.split('/').includes('..') && !descriptor.url.startsWith('/'));
    const response = await fetched(descriptor.url, descriptor.sha256);
    assert.equal(response.size, descriptor.size);
  }
  evidence.http_asset_count = manifest.files.length;
  evidence.checks.push({ name: 'Shared checkpoint and all HTTP aliases/core/adapter/source descriptors/assets authenticate against task artifacts', result: 'pass' });

  profile = await mkdtemp(path.join(os.tmpdir(), 'drl-shared-browser-'));
  chrome = spawn(process.env.DRL_CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  evidence.chrome_pid = chrome.pid;
  let chromeFailure; chrome.once('error', error => { chromeFailure = error; });
  chrome.stderr.on('data', bytes => { chromeError = (chromeError + bytes.toString()).slice(-16384); });
  const debuggerPort = await until(async () => {
    if (chromeFailure) throw chromeFailure;
    assert.equal(chrome.exitCode, null);
    try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; }
  }, 'Isolated Chrome debugger', 15000);
  const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`, { signal: AbortSignal.timeout(remaining()) })).json();
  const page = targets.find(target => target.type === 'page'); assert.ok(page);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const networkResponses = new Map();
  cdp = new CDP(socket, packet => {
    if (packet.method === 'Runtime.exceptionThrown') evidence.browser_errors.push(packet.params.exceptionDetails);
    if (packet.method === 'Runtime.consoleAPICalled') evidence.console.push({ type: packet.params.type, values: packet.params.args.map(arg => arg.value ?? arg.description) });
    if (packet.method === 'Network.responseReceived') networkResponses.set(packet.params.response.url, { requestId: packet.params.requestId, status: packet.params.response.status });
  });
  await cdp.call('Page.enable'); await cdp.call('Runtime.enable');
  await cdp.call('Network.enable', { maxTotalBufferSize: 16777216, maxResourceBufferSize: 8388608 });
  evidence.chrome = await cdp.call('Browser.getVersion');
  await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: "window.__sharedBootErrors=[];addEventListener('error',e=>__sharedBootErrors.push(String(e.error||e.message)));addEventListener('unhandledrejection',e=>__sharedBootErrors.push(String(e.reason)));" });
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 960, deviceScaleFactor: 1, mobile: false });
  const navigation = await cdp.call('Page.navigate', { url: base }); assert.ok(!navigation.errorText);
  async function healthy() {
    const sample = await cdp.evaluate(`(() => {
      const game=window.drlGame;let probe=null;if(game?.paused)probe=game.probe();
      return {ready:!!game,running:game?.running??false,paused:game?.paused??false,locale:game?.locale,
        lang:document.documentElement.lang,queueLength:game?.queueLength??0,textDeliveryPending:game?.textDeliveryPending??false,
        frameGeneration:game?.frameGeneration??0,lastEnqueuedReceipt:game?.lastEnqueuedReceipt??0,lastPresentedReceipt:game?.lastPresentedReceipt??0,
        unsupported:game?.unsupportedImports??[],failedPresentation:game?.failedPresentation??null,
        error:document.querySelector('#status')?.dataset.error==='true',status:document.querySelector('#status')?.textContent,
        startEnabled:!document.querySelector('#start')?.disabled,text:document.querySelector('#screen-text')?.textContent??'',
        errors:window.__sharedBootErrors??[],probe};})()`);
    evidence.last_state = sample;
    assert.equal(sample.error, false, sample.status); assert.deepEqual(sample.errors, []);
    assert.deepEqual(sample.unsupported, []); assert.equal(sample.failedPresentation, null);
    assert.deepEqual(evidence.browser_errors, []);
    return sample;
  }
  await until(async () => { const value = await healthy(); return value.ready && value.startEnabled ? value : false; }, 'Shared root HTML ready', 45000);
  assert.equal((await healthy()).lang, 'ja'); assert.equal((await healthy()).locale, 'ja');
  async function click(selector) {
    await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',inline:'nearest'})`);
    const box = await cdp.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}})()`);
    assert.ok(box.width > 0 && box.height > 0);
    await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  async function settled() {
    let previous = '', repeats = 0;
    return until(async () => {
      const value = await healthy();
      if (!value.running || !value.paused || value.queueLength || value.textDeliveryPending || !value.probe) { repeats = 0; previous = ''; return false; }
      const fingerprint = JSON.stringify(value.probe.bytes); repeats = fingerprint === previous ? repeats + 1 : 0; previous = fingerprint;
      return repeats >= 2 ? value : false;
    }, 'Native paused seam and drained inputs', 20000);
  }
  await click('#start');
  const firstRunPrefix = staticText(catalogs.ja['startup.first-run'].split('\n')[0]);
  const logoPrefix = staticText(catalogs.ja['startup.logo-text'].split('{{version}}')[0]);
  const newLabel = staticText(catalogs.ja['menu.main.new']).replace(/^[-=]+|[-=]+$/g, '');
  const exitLabel = staticText(catalogs.ja['menu.main.exit']).replace(/^[-=]+|[-=]+$/g, '');
  assert.ok(firstRunPrefix && logoPrefix && newLabel && exitLabel);
  let firstRunWitnessed = false, logoWitnessed = false, confirms = 0, current = await settled();
  while (!contains(current.text, newLabel)) {
    assert.ok(confirms < 3, 'Bounded native startup confirmations exhausted');
    const firstRun = contains(current.text, firstRunPrefix);
    const logo = contains(current.text, logoPrefix);
    assert.ok(firstRun || logo, 'Only the source-witnessed native first-run welcome or logo may receive Enter');
    if (firstRun) {
      assert.equal(firstRunWitnessed, false, 'First-run welcome cannot repeat');
      assert.equal(logoWitnessed, false, 'First-run welcome must precede the logo');
      firstRunWitnessed = true;
    } else {
      logoWitnessed = true;
    }
    const introBytes = Uint8Array.from(current.probe.bytes);
    const introState = new DataView(introBytes.buffer);
    assert.equal(introState.getUint32(16, true), 2, 'Startup confirmations require original DSIntro');
    assert.equal(introState.getUint32(32, true), 0, 'No player may exist at a startup confirmation');
    evidence.actions.push({ kind: firstRun ? 'witnessed-native-first-run-welcome' : 'witnessed-native-startup-logo', frame_generation: current.frameGeneration, text: current.text });
    await cdp.evaluate("document.querySelector('#game-screen').focus({preventScroll:true})");
    const before = current.lastEnqueuedReceipt;
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    const down = await cdp.evaluate('drlGame.lastEnqueuedReceipt'); assert.ok(down > before);
    await until(async () => { const value = await healthy(); return value.lastPresentedReceipt >= down ? value : false; }, 'Native presentation acknowledges logo confirmation', 15000);
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    confirms++; current = await settled();
  }
  assert.equal(firstRunWitnessed, true); assert.equal(logoWitnessed, true); assert.equal(current.locale, 'ja');
  assert.ok(contains(current.text, newLabel) && contains(current.text, exitLabel), 'Actual Japanese main-menu entries required');
  const nativeBytes = Uint8Array.from(current.probe.bytes);
  assert.ok(nativeBytes.length >= 128); const native = new DataView(nativeBytes.buffer);
  assert.equal(native.getUint32(0, true), 0x504c5244); assert.equal(native.getUint32(16, true), 1);
  assert.equal(native.getUint32(32, true), 0, 'No native player/gameplay was started');
  evidence.native_menu = { text: current.text, first_run_witnessed: firstRunWitnessed, logo_witnessed: logoWitnessed, confirmations: confirms, state: 1, player_present: false, frame_generation: current.frameGeneration, diagnostic_sha256: sha(nativeBytes) };
  evidence.browser_loaded_artifacts = [];
  for (const descriptor of [expectedBuild.core, expectedBuild.adapter]) {
    const url = new URL(descriptor.file, base).href;
    const loaded = networkResponses.get(url); assert.ok(loaded, `Browser did not load ${url}`); assert.equal(loaded.status, 200);
    const body = await cdp.call('Network.getResponseBody', { requestId: loaded.requestId });
    const bytes = Buffer.from(body.body, body.base64Encoded ? 'base64' : 'utf8');
    assert.equal(bytes.length, descriptor.size); assert.equal(sha(bytes), descriptor.sha256);
    evidence.browser_loaded_artifacts.push({ url, size: bytes.length, sha256: sha(bytes) });
  }
  evidence.checks.push({ name: 'Actual shared Japanese page starts pinned original modules, witnesses native logo, and reaches native main menu without starting a game', result: 'pass' });
  await mkdir(output);
  async function screenshot(name) {
    const captured = await cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const bytes = Buffer.from(captured.data, 'base64'), file = path.join(output, name + '.png');
    await writeFile(file, bytes, { flag: 'wx' }); evidence.screenshots.push({ file, size: bytes.length, sha256: sha(bytes), inspected: false });
  }
  await screenshot('shared-pc-native-menu');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await cdp.evaluate("window.scrollTo(0,0);document.querySelector('#fit').checked=false;document.querySelector('#fit').dispatchEvent(new Event('change'))");
  const viewport = await cdp.evaluate(`(()=>{const e=document.querySelector('#screen-viewport');const c=document.querySelector('#game-screen');const r=e.getBoundingClientRect();return{width:innerWidth,bodyWidth:document.documentElement.scrollWidth,client:e.clientWidth,scroll:e.scrollWidth,canvas:c.getBoundingClientRect().width,viewport:{left:r.left,right:r.right,width:r.width},overflowX:getComputedStyle(e).overflowX}})()`);
  assert.equal(viewport.width, 390); assert.ok(viewport.bodyWidth <= 391, 'Shell causes horizontal body overflow');
  assert.ok(viewport.scroll > viewport.client && ['auto', 'scroll'].includes(viewport.overflowX), 'Native canvas must scroll inside mobile viewport');
  const scrolled = await cdp.evaluate("(()=>{const e=document.querySelector('#screen-viewport');e.scrollLeft=80;return{scrollLeft:e.scrollLeft,max:e.scrollWidth-e.clientWidth}})()");
  assert.ok(scrolled.scrollLeft > 0 && scrolled.max > 0);
  await cdp.evaluate("document.querySelector('#screen-viewport').scrollLeft=0");
  await screenshot('shared-mobile-native-menu');
  const controls = [];
  for (const selector of ['#language', '[data-key="Enter"]', '[data-key="Escape"]']) {
    await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',inline:'nearest'})`);
    const control = await cdp.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{label:e.textContent,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,display:s.display,visibility:s.visibility,disabled:!!e.disabled}})()`);
    assert.ok(control.width >= 40 && control.height >= 40 && control.left >= -1 && control.right <= 391);
    assert.ok(control.top >= -1 && control.bottom <= 845 && control.display !== 'none' && control.visibility !== 'hidden');
    assert.equal(control.disabled, false); controls.push({ selector, ...control });
  }
  evidence.mobile = { viewport, scroll: scrolled, controls };
  current = await healthy(); assert.ok(contains(current.text, newLabel));
  assert.deepEqual(evidence.browser_errors, []); assert.ok(!evidence.console.some(entry => entry.type === 'error'));
  evidence.checks.push({ name: '390px shared page keeps shell controls usable and native screen horizontally scrollable within the page', result: 'pass' });
  // Recheck immutable handoff files after the browser. Browser storage is only
  // inside the owned temporary profile, never a shared fixture or save.
  for (const file of ['build.json', 'source-bundle.json', 'game.html', 'index.html', expectedBuild.core.file, expectedBuild.adapter.file]) await sameSharedFile(path.join('port/dist', file));
  evidence.result = 'pass';
} catch (error) {
  evidence.result = 'fail'; evidence.error = error.stack ?? String(error); process.exitCode = 1;
} finally {
  clearTimeout(emergency);
  if (cdp && socket?.readyState === WebSocket.OPEN) { try { await cdp.call('Browser.close'); } catch {} }
  socket?.close();
  for (const child of [chrome, serverProcess]) {
    if (!child || child.exitCode !== null) continue;
    const exited = new Promise(resolve => child.once('exit', resolve)); child.kill();
    await Promise.race([exited, pause(1500)]);
  }
  if (profile) {
    const tempRoot = fs.realpathSync.native(os.tmpdir());
    const relative = path.relative(tempRoot, path.resolve(profile));
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.match(path.basename(profile), /^drl-shared-browser-/);
    noLinks(profile);
    await rm(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
  }
  evidence.server_stdout = serverLog; evidence.server_stderr = serverError;
  evidence.temporary_server_closed = !serverProcess || serverProcess.exitCode !== null;
  evidence.completed_utc = new Date().toISOString();
  await writeFile(receipt, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: evidence.result, cwd: shared, actual_url: evidence.actual_url, checks: evidence.checks.length, core_sha256: evidence.core_sha256, adapter_sha256: evidence.adapter_sha256, source_archive_sha256: evidence.source_archive_sha256, error: evidence.error ?? null }));
}
