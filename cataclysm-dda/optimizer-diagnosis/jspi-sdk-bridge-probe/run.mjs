import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { root, receipt, memory, digest, pin } from './common.mjs';
import { cases } from './cases.mjs';
import { CDP, until } from '../../browser-qa/cdp.mjs';

const slot = await receipt('browser');
let chrome, cdp, server, guard, guardExit, stopPath, evidence, output;
try {
  const manifest = JSON.parse(await readFile(path.join(root, 'build/manifest.json'), 'utf8'));
  if (manifest.status !== 'built-not-browser-tested' || manifest.sdkVersion !== '6.0.8' || !manifest.legacyExceptionABI || manifest.nativeWasmExceptions) throw new Error('Build this exact isolated legacy-EH fixture before running it.');
  for (const record of [manifest.sourceAudit, ...manifest.sourceFiles, ...manifest.sdkFiles, ...manifest.variants.flatMap(variant => variant.files)]) if ((await pin(record.path)).sha256 !== record.sha256) throw new Error('Pinned fixture/SDK/build bytes changed: ' + record.path);
  const initialMemory = await memory();
  output = path.join(root, 'output', new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-'));
  await mkdir(output, { recursive: true }); await mkdir(path.join(root, 'profiles'), { recursive: true });
  const profile = await mkdtemp(path.join(root, 'profiles', 'sdk-jspi-'));
  evidence = { status: 'running', startedAt: new Date().toISOString(), scope: 'tiny-installed-sdk-legacy-eh-jspi-prerequisite', manifest, initialMemory, cases: [], fullGameExecuted: false, fullEngineReused: false };
  server = http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      const name = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!['index.html', 'browser-case.mjs', 'cases.mjs', 'build/default/probe.mjs', 'build/default/probe.wasm', 'build/explicit/probe.mjs', 'build/explicit/probe.wasm'].includes(name)) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': name.endsWith('.wasm') ? 'application/wasm' : name.endsWith('.mjs') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(await readFile(path.join(root, name)));
    } catch { response.writeHead(500).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}/`;
  const flags = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'];
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', flags, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  evidence.browser = { ownedPid: chrome.pid, profile, flags, base };
  let stderr = ''; chrome.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-6000); evidence.browser.stderr = stderr; });
  const guardPath = path.join(output, 'memory-guard.json'); stopPath = path.join(output, 'guard-stop');
  guard = spawn('powershell.exe', ['-NoProfile', '-File', path.join(root, 'resource-guard.ps1'), '-OwnedRootPid', String(chrome.pid), '-ExpectedMarker', profile, '-OutputPath', guardPath, '-StopPath', stopPath, '-MaximumSeconds', '90'], { windowsHide: true, stdio: 'ignore' });
  guardExit = new Promise(resolve => guard.on('exit', resolve));
  await until(async () => { try { const value = JSON.parse((await readFile(guardPath, 'utf8')).replace(/^\ufeff/, '')); if (value.status !== 'monitoring') throw new Error('Probe guard: ' + value.status); return value.samples.length > 0; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }, 'first bounded SDK-browser guard sample');
  const port = await until(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; } }, 'owned browser CDP port');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  cdp = await CDP.connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl); await cdp.call('Runtime.enable'); await cdp.call('Page.enable');
  evidence.browser.version = await cdp.call('Browser.getVersion');
  for (const variant of ['default', 'explicit']) for (const specification of cases) {
    const checked = JSON.parse((await readFile(guardPath, 'utf8')).replace(/^\ufeff/, '')); if (checked.status !== 'monitoring') throw new Error('Resource guard stopped the fixture.');
    const eventStart = cdp.events.length;
    await cdp.call('Page.navigate', { url: base + '?variant=' + variant + '&case=' + encodeURIComponent(specification.id) });
    const result = await until(() => cdp.evaluate('globalThis.jspiSdkCaseResult || null'), specification.id, 5000);
    result.runtimeExceptions = cdp.events.slice(eventStart).filter(event => event.method === 'Runtime.exceptionThrown');
    evidence.cases.push(result); await writeFile(path.join(output, variant + '-' + specification.id + '.json'), JSON.stringify(result, null, 2) + '\n');
  }
  const screenshot = await cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const bytes = Buffer.from(screenshot.data, 'base64');
  await writeFile(path.join(output, 'last-case.png'), bytes); evidence.screenshot = { bytes: bytes.length, sha256: digest(bytes) };
  evidence.status = evidence.cases.every(result => result.status === 'passed' && result.runtimeExceptions.length === 0) ? 'passed' : 'compatibility-blockers-observed';
} catch (error) { evidence ||= { status: 'failed', scope: 'sdk-prerequisite-only' }; evidence.status = 'failed'; evidence.error = error.stack || String(error); }
finally {
  if (stopPath) { await writeFile(stopPath, 'SDK probe finished.\n'); await guardExit; try { evidence.memoryGuard = JSON.parse((await readFile(path.join(output, 'memory-guard.json'), 'utf8')).replace(/^\ufeff/, '')); } catch {} }
  if (chrome && evidence.memoryGuard?.status !== 'completed') evidence.status = 'failed-resource-guard';
  if (cdp) { try { await cdp.call('Browser.close', {}, 5000); } catch {} cdp.socket.close(); }
  if (chrome?.exitCode === null) {
    const closer = spawn('powershell.exe', ['-NoProfile', '-File', path.join(root, 'resource-guard.ps1'), '-OwnedRootPid', String(chrome.pid), '-ExpectedMarker', evidence.browser.profile, '-OutputPath', path.join(output, 'cleanup.json'), '-StopPath', stopPath, '-AbortOwned'], { windowsHide: true, stdio: 'ignore' }); await new Promise(resolve => closer.on('exit', resolve));
  }
  if (server) await new Promise(resolve => server.close(resolve));
  evidence.finishedAt = new Date().toISOString(); if (output) await writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  await slot.release();
}
console.log(JSON.stringify({ status: evidence.status, output, cases: evidence.cases?.map(result => ({ variant: result.variant, id: result.specification.id, status: result.status, error: result.error })) }, null, 2));
if (evidence.status !== 'passed') process.exitCode = 1;
