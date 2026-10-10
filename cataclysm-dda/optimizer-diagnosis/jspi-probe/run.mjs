import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CDP, until, delay } from '../../browser-qa/cdp.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
async function powershell(file, args = []) {
  const handle = spawn('powershell.exe', ['-NoProfile', '-File', file, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  handle.stdout.on('data', chunk => stdout += chunk);
  handle.stderr.on('data', chunk => stderr += chunk);
  const code = await new Promise((resolve, reject) => { handle.on('error', reject); handle.on('exit', resolve); });
  if (code !== 0) throw new Error('Read-only memory helper failed: ' + stderr);
  return JSON.parse(stdout.replace(/^\ufeff/, ''));
}
const startMemory = await powershell(path.join(directory, 'measure-memory.ps1'));
const output = path.join(directory, 'output', new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-'));
await mkdir(output, { recursive: true });
const evidence = { startedAt: new Date().toISOString(), status: 'preflight', startMemory,
  scope: 'tiny-raw-wasm-jspi-prerequisite-only', limits: { startPhysicalBytes: 4 * 1024 ** 3, startCommitBytes: 4 * 1024 ** 3, remainingFloorBytes: 3 * 1024 ** 3, ownedChromePrivateBudgetBytes: 1024 ** 3 },
  compiled: false, fullGameExecuted: false, chromeJSPIFlagEnabled: false, upstreamTouched: false,
  sources: ['https://v8.dev/blog/jspi', 'https://github.com/WebAssembly/js-promise-integration/blob/main/proposals/js-promise-integration/Overview.md'] };
const persist = () => writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
await persist();
if (startMemory.freePhysicalBytes < evidence.limits.startPhysicalBytes || startMemory.freeCommitBytes < evidence.limits.startCommitBytes) {
  evidence.status = 'blocked-memory'; evidence.finishedAt = new Date().toISOString(); await persist(); console.log(JSON.stringify({ status: evidence.status, startMemory, output })); process.exitCode = 2;
} else {
  await mkdir(path.join(directory, 'profiles'), { recursive: true });
  const profile = await mkdtemp(path.join(directory, 'profiles', 'jspi-'));
  const server = http.createServer(async (request, response) => {
    const name = request.url === '/' ? 'index.html' : request.url === '/probe.mjs' ? 'probe.mjs' : null;
    if (!name) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': name.endsWith('.mjs') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(await readFile(path.join(directory, name)));
  });
  await new Promise((resolve, reject) => { server.on('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}/`;
  const flags = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'];
  const handle = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', flags, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  handle.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-6000); });
  evidence.browserLaunch = { ownedPid: handle.pid, profile, flags, base };
  const guardPath = path.join(output, 'memory-guard.json');
  const stopPath = path.join(output, 'guard-stop');
  const guard = spawn('powershell.exe', ['-NoProfile', '-File', path.join(directory, 'guard.ps1'), '-OwnedRootPid', String(handle.pid), '-ExpectedProfile', profile, '-OutputPath', guardPath, '-StopPath', stopPath], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let guardStderr = ''; guard.stderr.on('data', chunk => { guardStderr = (guardStderr + chunk).slice(-2000); });
  const guardExit = new Promise(resolve => guard.on('exit', code => resolve(code)));
  let cdp;
  try {
    await until(async () => { try { const value = JSON.parse((await readFile(guardPath, 'utf8')).replace(/^\ufeff/, '')); if (value.status !== 'monitoring') throw new Error('Memory guard: ' + value.status); return value.samples.length > 0; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }, 'first owned Chrome memory guard sample');
    const port = await until(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; } }, 'owned probe Chrome debug port');
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    cdp = await CDP.connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await cdp.call('Runtime.enable'); await cdp.call('Page.enable');
    evidence.browserVersion = await cdp.call('Browser.getVersion');
    await cdp.call('Page.navigate', { url: base });
    const result = await until(() => cdp.evaluate('window.jspiProbeResult || null'), 'tiny actual JSPI probe result', 15000);
    evidence.result = result;
    const wasm = Buffer.from(result.wasmBytes);
    await writeFile(path.join(output, 'probe.wasm'), wasm);
    evidence.wasm = { bytes: wasm.length, sha256: createHash('sha256').update(wasm).digest('hex') };
    await delay(2000);
    evidence.runtimeExceptions = cdp.events.filter(event => event.method === 'Runtime.exceptionThrown');
    const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const bytes = Buffer.from(screenshot.data, 'base64'); await writeFile(path.join(output, 'probe.png'), bytes);
    evidence.screenshot = { file: 'probe.png', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    evidence.status = result.status === 'passed' && evidence.runtimeExceptions.length === 0 ? 'passed' : 'failed';
  } catch (error) { evidence.status = 'failed'; evidence.error = error.stack || String(error); }
  finally {
    await writeFile(stopPath, 'Probe finished.\n');
    try { await Promise.race([guardExit, delay(10000)]); evidence.memoryGuard = JSON.parse((await readFile(guardPath, 'utf8')).replace(/^\ufeff/, '')); } catch (error) { evidence.guardReadError = String(error); }
    if (cdp) { try { await cdp.call('Browser.close', {}, 5000); } catch {} cdp.socket.close(); }
    if (handle.exitCode === null) handle.kill();
    await new Promise(resolve => server.close(resolve));
    evidence.chromeStderr = stderr; evidence.guardStderr = guardStderr;
    if (evidence.memoryGuard?.status !== 'completed') evidence.status = 'failed';
    evidence.finishedAt = new Date().toISOString(); await persist();
  }
  console.log(JSON.stringify({ status: evidence.status, output, browser: evidence.browserVersion, result: evidence.result, memoryGuard: evidence.memoryGuard }, null, 2));
  if (evidence.status !== 'passed') process.exitCode = 1;
}
