/* Dependency-free Chrome DevTools transport for actual NetHack browser tests. */
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      } else for (const handler of this.handlers.get(message.method) ?? []) handler(message.params);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Chrome DevTools connection closed'));
      }
      this.pending.clear();
    });
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new Cdp(socket);
  }
  on(event, handler) {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }
  send(method, params = {}, timeout = 30000) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome DevTools timed out: ${method}`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, timeout = 30000) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout }, timeout + 1000);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  close() { this.socket.close(); }
}

export async function launchChrome({ executable = process.env.NETHACK_CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' } = {}) {
  const profileRoot = fileURLToPath(new URL('../build/browser-profiles/',import.meta.url));
  await mkdir(profileRoot,{recursive:true});
  const temporaryRoot = await realpath(profileRoot);
  const profile = await mkdtemp(join(temporaryRoot, 'nethack-integration-'));
  const stderr = [];
  const child = spawn(executable, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--metrics-recording-only',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', data => { if (stderr.length < 200) stderr.push(data.toString()); });
  let spawnError;
  child.once('error', error => { spawnError = error; });
  const started = Date.now();
  let port;
  while (Date.now() - started < 20000) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Chrome exited early: ${child.exitCode}\n${stderr.join('')}`);
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { /* Chrome is starting. */ }
    if (port) break;
    await delay(100);
  }
  if (!port) { child.kill(); throw new Error(`Chrome did not expose DevTools\n${stderr.join('')}`); }
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const browser = await Cdp.connect(version.webSocketDebuggerUrl);
  const pages = [];
  return { browser, version, profile, stderr, child, pages,
    async page(url) {
      const target = await browser.send('Target.createTarget', { url: 'about:blank' });
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const entry = targets.find(value => value.id === target.targetId);
      const cdp = await Cdp.connect(entry.webSocketDebuggerUrl);
      const errors = [], console = [], failedRequests = [], logs = [];
      cdp.on('Runtime.exceptionThrown', value => errors.push(value.exceptionDetails));
      cdp.on('Runtime.consoleAPICalled', value => console.push({ type: value.type, args: value.args.map(arg => arg.value ?? arg.description) }));
      cdp.on('Network.loadingFailed', value => failedRequests.push(value));
      cdp.on('Log.entryAdded', value => logs.push(value.entry));
      await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Network.enable'), cdp.send('Log.enable')]);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Page.navigate', { url });
      const page = { cdp, targetId: target.targetId, errors, console, failedRequests, logs,
        close: async () => { await browser.send('Target.closeTarget', { targetId: target.targetId }); cdp.close(); } };
      pages.push(page);
      return page;
    },
    async close() {
      for (const page of pages) page.cdp.close();
      try { await browser.send('Browser.close', {}, 5000); } catch { child.kill(); }
      browser.close();
      if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(3000)]);
      if (child.exitCode === null) child.kill();
      // Verify the resolved exact target is a direct task-created child of the temp root.
      const resolvedProfile = resolve(profile);
      const fromTemp = relative(temporaryRoot, resolvedProfile);
      if (!isAbsolute(fromTemp) && !fromTemp.includes(sep) && fromTemp !== '..'
          && basename(resolvedProfile).startsWith('nethack-integration-')) {
        await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
      }
    },
  };
}

export async function waitFor(page, expression, { timeout = 20000, description = expression } = {}) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    try { last = await page.cdp.evaluate(expression); } catch (error) { last = error.message; }
    if (last === true) return;
    await delay(40);
  }
  const diagnostic = await page.cdp.evaluate(`({readyState:document.readyState,text:document.body?.innerText?.slice(-4000),phase:window.netHackTest?.phase,pending:window.netHackTest?.host?.pendingKind})`).catch(() => null);
  throw new Error(`Timed out waiting for ${description}: ${JSON.stringify({ last, diagnostic, errors: page.errors })}`);
}

export async function click(page, selector, { touch = false } = {}) {
  const point = await page.cdp.evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing selector');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();if(!r.width||!r.height)throw new Error('Invisible selector');return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if (touch) {
    await page.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, radiusX: 2, radiusY: 2, force: 1, id: 0 }] });
    await page.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  }
}

export async function key(page, value, { modifiers = 0, code } = {}) {
  const virtual = { Enter: 13, Escape: 27, Backspace: 8, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Tab: 9 };
  const printable = value.length === 1;
  const args = { key: value, code: code ?? (printable && /[a-z]/i.test(value) ? `Key${value.toUpperCase()}` : value), modifiers,
    windowsVirtualKeyCode: virtual[value] ?? (printable ? value.toUpperCase().charCodeAt(0) : 0) };
  if (printable && !(modifiers & 2)) args.text = value;
  await page.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...args });
  await page.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...args, text: undefined });
}
