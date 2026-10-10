import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewMode = process.argv.includes('--review');
const out = join(root, 'tests', reviewMode ? 'browser-review-evidence' : 'browser-evidence');
const candidates = [process.env.ANGBAND_CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean);
let executable;
for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch {} }
if (!executable) throw new Error('Chrome or Edge executable not found');
await mkdir(out, { recursive: true });
const profile = await mkdtemp(join(out, 'profile-'));
process.env.ANGBAND_PORT = '4273';
const { server } = await import('../web/server.mjs');
if (!server.listening) await once(server, 'listening');
const browser = spawn(executable, [
  '--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
  '--no-default-browser-check', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`, 'about:blank'
], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let browserOutput = '';
browser.stderr.on('data', chunk => { browserOutput = (browserOutput + chunk).slice(-8192); });
browser.on('error', error => { browserOutput += String(error); });
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
const result = { startedAt: new Date().toISOString(), checks: [], frames: [], errors: [], consoleErrors: [] };
let socket, session;
let sequence = 0;
const pending = new Map();
async function captureEngineBuild() {
  const manifestBytes = await readFile(join(root, 'build', 'manifest.json'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const outputs = [];
  for (const name of ['game.js', 'game.wasm', 'game.data']) {
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const chunk of createReadStream(join(root, 'build', name))) {
      bytes += chunk.length;
      hash.update(chunk);
    }
    const actual = { name, bytes, sha256: hash.digest('hex') };
    const expected = manifest.outputs.find(output => output.name === name);
    assert.ok(expected, `Engine manifest is missing ${name}`);
    assert.equal(actual.bytes, expected.bytes, `${name} byte count differs from engine manifest`);
    assert.equal(actual.sha256, expected.sha256, `${name} hash differs from engine manifest`);
    outputs.push(actual);
  }
  return { manifest, manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'), outputs };
}
function call(method, params = {}, scoped = true) {
  const id = ++sequence;
  return new Promise((resolveCall, rejectCall) => {
    const timer = setTimeout(() => { pending.delete(id); rejectCall(new Error(`CDP timed out: ${method}`)); }, 20000);
    pending.set(id, { resolve: resolveCall, reject: rejectCall, timer });
    socket.send(JSON.stringify({ id, method, params, ...(scoped && session ? { sessionId: session } : {}) }));
  });
}
async function evaluate(expression) {
  const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}
async function waitFor(expression, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await evaluate(expression);
    if (value) return value;
    const hostError = await evaluate('window.__angbandTest?.errors?.at(-1)');
    if (hostError) throw new Error(`Host error while waiting: ${hostError}`);
    await delay(120);
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}
async function screen(label) {
  const text = await evaluate('window.__angbandTest?.text() || ""');
  result.frames.push({ label, text });
  await writeFile(join(out, `${label}.txt`), text, 'utf8');
  console.log(`${label}: ${text.replace(/\n/g, ' | ').slice(-1600)}`);
  return text;
}
async function send(key, mods = 0, milliseconds = 200) {
  await evaluate(`__angbandTest.send(${JSON.stringify(key)},${mods})`);
  await delay(milliseconds);
}
async function acknowledgeMore() {
  // Native message paging is a UI boundary, not another gameplay command.
  for (let page = 0; page < 8; page++) {
    if (!await evaluate('__angbandTest.text().includes("-more-")')) return;
    await send(32, 0, 250);
  }
  if (await evaluate('__angbandTest.text().includes("-more-")')) {
    throw new Error('Native message pager did not finish within eight pages');
  }
}
async function screenshot(label) {
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(out, `${label}.png`), Buffer.from(shot.data, 'base64'));
}
const check = (name, evidence) => { result.checks.push({ name, passed: true, evidence }); console.log(`PASS ${name}`); };
async function commandTrace(commands, startTurn) {
  const states = [];
  let turn = startTurn;
  for (const command of commands) {
    await send(command);
    const state = await waitFor(`__angbandTest.state.turn>${turn} && __angbandTest.state.command && __angbandTest.state`);
    states.push(state); turn = state.turn;
  }
  return states;
}
async function dungeonContinuation() {
  const previousSave = await evaluate('__angbandTest.saveRecord.savedAt');
  await evaluate('__angbandTest.save()');
  await waitFor(`__angbandTest.saveRecord.savedAt!==${JSON.stringify(previousSave)}`);
  const checkpoint = await evaluate('({state:__angbandTest.state,save:__angbandTest.saveRecord})');
  const checkpointJson = await evaluate('__angbandTest.exportSave()');
  await writeFile(join(out, 'dungeon-checkpoint-save.json'), checkpointJson, 'utf8');
  const uninterrupted = await commandTrace([',', ',', ',', 'n'], checkpoint.state.turn);
  await evaluate('__angbandTest.save()');
  await waitFor(`__angbandTest.saveRecord.savedAt!==${JSON.stringify(checkpoint.save.savedAt)}`);
  await writeFile(join(out, 'dungeon-live-branch-save.json'), await evaluate('__angbandTest.exportSave()'), 'utf8');
  await evaluate(`(async()=>{const storage=await import('./storage.js');const db=await storage.openSaveDatabase();await storage.writeSave(db,storage.importRecord(${JSON.stringify(checkpointJson)}));db.close()})()`);
  await call('Page.reload');
  await waitFor('window.__angbandTest?.ready && window.__angbandTest.saveRecord');
  await evaluate('__angbandTest.start(__angbandTest.saveRecord.seed,true)');
  await waitFor('__angbandTest.running && __angbandTest.state?.hp>0 && __angbandTest.state.command', 45000);
  const resumedCheckpoint = await evaluate('__angbandTest.state');
  const resumed = await commandTrace([',', ',', ',', 'n'], checkpoint.state.turn);
  try {
    assert.deepEqual(resumedCheckpoint, checkpoint.state);
    assert.deepEqual(resumed, uninterrupted);
    check('Dungeon save/resume and four commands including repeat reproduce uninterrupted state and RNG', { checkpoint: resumedCheckpoint, trace: resumed });
  } catch (error) {
    result.checks.push({ name: 'Dungeon save/resume and four commands including repeat reproduce uninterrupted state and RNG', passed: false, evidence: { saved: checkpoint.state, resumedCheckpoint, uninterrupted, resumed } });
    result.errors.push('Dungeon continuation player state or RNG mismatch');
    console.error('FAIL dungeon deterministic continuation', error.message);
  }
  await evaluate('__angbandTest.save()');
  await waitFor(`__angbandTest.saveRecord.savedAt!==${JSON.stringify(checkpoint.save.savedAt)}`);
  await writeFile(join(out, 'dungeon-resumed-branch-save.json'), await evaluate('__angbandTest.exportSave()'), 'utf8');
}
async function reviewedHelpFlow() {
  await send('?');
  await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.context==="help" && scope.widgets.some(p=>p.event.id==="help.index.menu.commands"))');
  const menu = await evaluate('document.querySelector("#semantic-panels").textContent');
  assert.match(menu, /コマンド/);
  await send('a');
  await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.context==="help" && scope.widgets.some(p=>p.event.id.startsWith("help.original.command.")))');
  await send('/');
  await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.context==="help" && scope.widgets.some(p=>p.event.widget==="__input:query"))');
  await send('杖');
  await send(0x9c);
  await waitFor('__angbandTest.presentation.sections.some(section=>section.key==="help" && section.blocks.some(block=>block.runs?.some(run=>run.highlighted)))');
  const match = await evaluate('__angbandTest.presentation.sections.find(section=>section.key==="help")');
  assert.ok(match.blocks.some(block=>block.text.includes('杖') && block.runs?.some(run=>run.highlighted && run.text.includes('杖'))));
  check('Original help menu, Japanese search and Rust-owned highlight runs work in the browser', match);
  await screenshot('help-japanese-search');
  await send('?');
  await waitFor('!__angbandTest.semantic.scopes.some(scope=>scope.context==="help")');
}
async function mobileChecks() {
  await call('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true });
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const beforeMobileDraw = await evaluate('JSON.stringify(__angbandTest.state)');
  await evaluate('document.querySelector("#font-size").value="12";document.querySelector("#font-size").dispatchEvent(new Event("change"));__angbandTest.redraw()');
  await delay(250);
  assert.equal(await evaluate('JSON.stringify(__angbandTest.state)'), beforeMobileDraw);
  check('Mobile resize and font change preserve complete RNG state', true);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  check('Mobile page has no horizontal overflow', await evaluate('({page:document.documentElement.scrollWidth,viewport:innerWidth,terminal:document.querySelector("#terminal-viewport").scrollWidth})'));
  const beforeIsolation = await evaluate('JSON.stringify(__angbandTest.state)');
  await evaluate('document.querySelector("#seed").focus()');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: '2', code: 'Digit2', text: '2', windowsVirtualKeyCode: 50 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: '2', code: 'Digit2', windowsVirtualKeyCode: 50 });
  await evaluate('document.querySelector("#terminal").dispatchEvent(new KeyboardEvent("keydown",{key:"Process",isComposing:true,bubbles:true})); document.querySelector("#terminal").dispatchEvent(new KeyboardEvent("keydown",{key:"あ",isComposing:true,bubbles:true}))');
  await delay(250);
  assert.equal(await evaluate('JSON.stringify(__angbandTest.state)'), beforeIsolation);
  check('IME and inputs outside terminal leave simulation unchanged', true);
  const touchTurn = await evaluate('__angbandTest.state.turn');
  const touchTarget = await evaluate(`(()=>{let b=document.querySelector('[data-code="44"]');b.scrollIntoView({block:"center"});let r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touchTarget, radiusX: 3, radiusY: 3, force: 1 }] });
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitFor(`__angbandTest.state.turn>${touchTurn}`);
  check('Real mobile touch wait advances original engine', await evaluate('__angbandTest.state'));
  await evaluate('document.querySelector("#terminal-viewport").scrollLeft=200');
  assert.ok(await evaluate('document.querySelector("#terminal-viewport").scrollLeft>0'));
  check('Mobile terminal can pan horizontally', true);
  await screenshot('mobile');
  result.errors.push(...await evaluate('__angbandTest.errors'));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.consoleErrors, []);
}
try {
  // Capture before the page loads any engine asset; verify again after the flow.
  const capturedBuild = await captureEngineBuild();
  result.engine = capturedBuild.manifest;
  result.engineManifestSha256 = capturedBuild.manifestSha256;
  result.engineHashes = capturedBuild.outputs;
  result.engineCapturedAt = new Date().toISOString();
  let debugInfo;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { debugInfo = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); break; } catch {}
    await delay(150);
  }
  if (!debugInfo) throw new Error(`Browser startup failed: ${browserOutput}`);
  socket = new WebSocket(`ws://127.0.0.1:${debugInfo[0]}${debugInfo[1]}`);
  await once(socket, 'open');
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer); pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') result.consoleErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  });
  const target = await call('Target.createTarget', { url: 'about:blank' }, false);
  const attached = await call('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false);
  session = attached.sessionId;
  await call('Page.enable'); await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1050, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: 'http://127.0.0.1:4273/web/' });
  await waitFor('window.__angbandTest?.ready');
  assert.equal(await evaluate('document.documentElement.lang'), 'ja');
  check('Japanese host default', await evaluate('document.querySelector("#new-game").textContent'));
  if (process.argv.includes('--mobile-only')) {
    const fixture = await readFile(join(out, 'dungeon-resumed-branch-save.json'), 'utf8');
    await evaluate(`(async()=>{const storage=await import('./storage.js');const db=await storage.openSaveDatabase();await storage.writeSave(db,storage.importRecord(${JSON.stringify(fixture)}));db.close()})()`);
    await call('Page.reload');
    await waitFor('window.__angbandTest?.ready && window.__angbandTest.saveRecord');
    await evaluate('__angbandTest.start(__angbandTest.saveRecord.seed,true)');
    await waitFor('__angbandTest.running && __angbandTest.state?.depth>0 && __angbandTest.state.command', 45000);
    check('Native dungeon fixture resumed for focused mobile QA', await evaluate('__angbandTest.state'));
    await mobileChecks();
  } else {
  await evaluate('__angbandTest.start(123456,false)');
  await waitFor('__angbandTest.running && __angbandTest.frame?.cells.some(cell=>cell[0]!==32)', 45000);
  await screen('01-initial');
  if (reviewMode) {
    await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.widgets.some(p=>p.event.id==="birth.menu.instructions" && p.text))');
    assert.ok(await evaluate('/[\\u3040-\\u30ff\\u3400-\\u9fff]/u.test(document.querySelector("#semantic-panels").textContent)'));
    check('Original birth producers display Rust Japanese before input', await evaluate('__angbandTest.semantic.scopes.map(scope=>({context:scope.context,count:scope.widgets.length}))'));
    await send('=');
    await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.context==="birth-options" && scope.widgets.length>10)');
    check('Birth options Japanese descriptions and choices are visible while menu waits', await evaluate('document.querySelector("#semantic-panels").textContent'));
    await send(0xe000);
    await waitFor('!__angbandTest.semantic.scopes.some(scope=>scope.context==="birth-options")');
  }
  if (process.argv.includes('--inspect-only')) {
    await screenshot('01-initial');
    check('Original engine startup', await evaluate('__angbandTest.errors'));
  } else {
    // Original birth uses Enter to select defaults and accept each stage.
    let changedClass = false;
    let checkedName = false;
    for (let stage = 0; stage < 14; stage++) {
      if (await evaluate('__angbandTest.state?.hp>0 && __angbandTest.state?.x>0 && __angbandTest.state?.y>0 && !__angbandTest.text().includes("Please select your character traits")')) break;
      if (await evaluate('__angbandTest.text().includes("Enter a name for your character")')) {
        if (reviewMode) {
          await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.context==="name-editor" && scope.widgets.some(p=>p.event.id==="birth.name.prompt"))');
          checkedName = true;
          check('Name prompt appears before interactive input, with an opaque draft', await evaluate('document.querySelector("#semantic-panels").textContent'));
        }
        await evaluate(`document.querySelector("#game-text").value=${JSON.stringify(reviewMode ? '山田 QA' : 'Browser QA')};document.querySelector("#text-entry").requestSubmit()`);
      }
      if (reviewMode && !changedClass && stage === 1) {
        await send('2');
        changedClass = true;
      }
      await send(0x9c, 0, 400);
      await screen(`birth-${String(stage).padStart(2, '0')}`);
    }
    await waitFor('__angbandTest.state?.hp>0 && __angbandTest.state?.x>0 && __angbandTest.state?.y>0 && !__angbandTest.text().includes("Please select your character traits")', 10000);
    await send(0xe000);
    await send(0xe000);
    await screen('02-town');
    check('Original character creation and town', await evaluate('__angbandTest.state'));
    if (result.engine.replayIdentity) {
      await evaluate('__angbandTest.inspectAdapters()');
      const diagnostics = await waitFor('__angbandTest.diagnostics');
      assert.deepEqual(diagnostics,{domain:0,objects:0,stats:0,replay:0});
      check('Native source adapters and deterministic recorder report no capture failure',diagnostics);
    }
    if (reviewMode) {
      assert.ok(checkedName && changedClass);
      assert.ok(await evaluate('__angbandTest.text().includes("Mage")'));
      await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.context==="sidebar" && scope.widgets.some(p=>p.event.params.class?.value.id==="angband.player_class.mage.name"))');
      assert.ok(!await evaluate('__angbandTest.semantic.scopes.some(scope=>["birth-options","name-editor"].includes(scope.context))'));
      check('Canonical race/class bindings and transient menu cleanup reach original town', await evaluate('__angbandTest.semantic.scopes.map(scope=>({context:scope.context,widgets:scope.widgets.map(p=>p.event.id)}))'));
      await send('C');
      await waitFor('document.querySelector(".semantic-stats")');
      assert.equal(await evaluate('document.querySelectorAll(".semantic-stats tr").length'), 6);
      assert.ok(await evaluate('document.querySelector("#semantic-panels").textContent.includes("山田 QA")'));
      check('Original character sheet shows all five typed stat bonus rows and external Japanese name', await evaluate('document.querySelector(".semantic-stats").textContent'));
      await screenshot('character-japanese');
      const history = await evaluate('__angbandTest.semantic.scopes.flatMap(scope=>scope.widgets).find(p=>p.event.id==="player.sheet.generated_history.value")');
      assert.ok(history?.text && /[\u3040-\u30ff\u3400-\u9fff]/u.test(history.text));
      assert.ok(!history.text.includes('missing'));
      check('Generated biography renders selected source history in Japanese', history);
      await send(0xe000);
      await send('b');
      if (await evaluate('__angbandTest.text().includes("Browse which book")')) {
        const bookKey = await evaluate('(()=>{const row=__angbandTest.text().split("\\n").find(line=>line.includes("[First Spells]"));return row?.match(/([a-z])\\)/)?.[1]})()');
        await send(bookKey || 'a');
      }
      await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.context==="spells" && scope.widgets.some(p=>p.event.id.endsWith("magic_missile.name")))');
      assert.ok(await evaluate('document.querySelector("#semantic-panels").textContent.includes("魔法の矢")'));
      check('Original readable spell menu shows Rust Japanese name and typed level/mana/fail metadata', await evaluate('document.querySelector("#semantic-panels").textContent'));
      await screenshot('spells-japanese');
      await send(0xe000);
      await waitFor('!__angbandTest.semantic.scopes.some(scope=>scope.context==="spells")');
      await reviewedHelpFlow();
    }
    if (process.argv.includes('--final')) {
      assert.equal(await evaluate('__angbandTest.state.rng?.length'), 38);
      check('Full original RNG snapshot exported', 38);
    }
    const beforeDraw = await evaluate('JSON.stringify({state:__angbandTest.state,frame:__angbandTest.frame})');
    await evaluate('for(let i=0;i<20;i++)__angbandTest.redraw()');
    assert.equal(await evaluate('JSON.stringify({state:__angbandTest.state,frame:__angbandTest.frame})'), beforeDraw);
    check('Cached redraw leaves terminal, state and RNG unchanged', 20);
    const beforeLocale = await evaluate('JSON.stringify(__angbandTest.state)');
    await evaluate('document.querySelector("#language").value="en";document.querySelector("#language").dispatchEvent(new Event("change"))');
    await delay(150);
    assert.equal(await evaluate('JSON.stringify(__angbandTest.state)'), beforeLocale);
    await evaluate('document.querySelector("#language").value="ja";document.querySelector("#language").dispatchEvent(new Event("change"))');
    await delay(150);
    assert.equal(await evaluate('JSON.stringify(__angbandTest.state)'), beforeLocale);
    check('Language changes preserve simulation and RNG', true);
    if (process.argv.includes('--final')) {
      const catalog = JSON.parse(await readFile(join(root, 'locales', 'game-en.json'), 'utf8'));
      const expected = Object.entries(catalog.messages ?? catalog).find(([, text]) => typeof text === 'string' && text.includes('I see no up staircase here'));
      assert.ok(expected, 'No-upstairs semantic ID is present in English catalog');
      await send('<');
      await waitFor(`__angbandTest.messageIds.includes(${JSON.stringify(expected[0])})`);
      const japaneseCatalog = JSON.parse(await readFile(join(root, 'locales', 'game-ja.json'), 'utf8'));
      const expectedJapanese = (japaneseCatalog.messages ?? japaneseCatalog)[expected[0]];
      assert.ok(await evaluate(`document.querySelector("#localized-log").textContent.includes(${JSON.stringify(expectedJapanese)})`));
      check('Actual original upstairs command renders semantic Japanese gameplay message', { id: expected[0], text: expectedJapanese });
      await send(0xe000);
    }
    await send('i');
    assert.match(await screen('03-inventory'), /Inven|Inventory|Select Item|Ration|Potion/i);
    if (reviewMode) {
      try {
        const rows = await waitFor('__angbandTest.semantic.scopes.find(scope=>scope.context==="inventory")?.widgets.filter(p=>p.event.id==="interface.items.row.name" && p.text)', 1500);
        assert.ok(rows.length > 0);
        assert.ok(rows.some(row=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(row.text)));
        assert.ok(rows.every(row=>!row.text.includes('missing') && !row.error));
        check('Actual inventory descriptions use owned Japanese object grammar', rows);
      } catch(error) {
        result.checks.push({name:'Actual inventory descriptions use owned Japanese object grammar',passed:false,evidence:await evaluate('__angbandTest.semantic.scopes.map(scope=>({context:scope.context,ids:scope.widgets.map(p=>p.event.id)}))')});
        result.errors.push('Actual inventory selection lacks complete Japanese object rows: '+error.message);
      }
    }
    if (result.engine.replayIdentity) {
      await evaluate('document.querySelector("#game-text").value="未送信の下書き";document.querySelector("#game-text").dispatchEvent(new Event("input"))');
      await delay(120);
      const pendingInventory = await evaluate('({state:__angbandTest.state,frame:__angbandTest.frame,semantic:__angbandTest.semantic,draft:document.querySelector("#game-text").value})');
      const previous = await evaluate('__angbandTest.saveRecord?.savedAt || null');
      await evaluate('__angbandTest.save()');
      await waitFor(`__angbandTest.saveRecord && __angbandTest.saveRecord.savedAt!==${JSON.stringify(previous)}`);
      const pendingSave = await evaluate('__angbandTest.exportSave()');
      assert.equal(Buffer.from(JSON.parse(pendingSave).payload,'base64').readUInt16LE(8),3);
      await writeFile(join(out,'inventory-pending-v3-save.json'),pendingSave,'utf8');
      await evaluate('__angbandTest.start(__angbandTest.saveRecord.seed,true)');
      await waitFor('__angbandTest.running && __angbandTest.semantic.scopes.some(scope=>scope.context==="inventory")');
      const restoredInventory = await evaluate('({state:__angbandTest.state,frame:__angbandTest.frame,semantic:__angbandTest.semantic,draft:document.querySelector("#game-text").value})');
      assert.deepEqual(restoredInventory,pendingInventory);
      check('Version3 restores nested inventory wait, complete frame, source widgets, all RNG words and unsent draft',restoredInventory);
      await evaluate('document.querySelector("#game-text").value="";document.querySelector("#game-text").dispatchEvent(new Event("input"))');
    } else {
      await evaluate('__angbandTest.save()');
      await waitFor('document.querySelector("#status").dataset.error==="true"');
      check('Legacy nested inventory prompt refuses save', await evaluate('document.querySelector("#status").textContent'));
    }
    await send(0xe000);
    await send('e');
    assert.match(await screen('04-equipment'), /Wielding|Equip|Light source/i);
    await send(0xe000);
    const oldTurn = await evaluate('__angbandTest.state.turn');
    await call('Runtime.evaluate', { expression: 'document.querySelector("#terminal").focus()' });
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: ',', code: 'Comma', text: ',', unmodifiedText: ',', windowsVirtualKeyCode: 188 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: ',', code: 'Comma', windowsVirtualKeyCode: 188 });
    await waitFor(`__angbandTest.state.turn>${oldTurn}`);
    check('Real PC keyboard advances original engine', await evaluate('__angbandTest.state'));
    const previousTownSave = await evaluate('__angbandTest.saveRecord?.savedAt || null');
    await evaluate('__angbandTest.save()');
    await waitFor(`__angbandTest.saveRecord && __angbandTest.saveRecord.savedAt!==${JSON.stringify(previousTownSave)}`);
    const saved = await evaluate('({state:__angbandTest.state,save:__angbandTest.saveRecord})');
    check('Native game save wrapped and persisted', saved);
    await writeFile(join(out, 'checkpoint-save.json'), await evaluate('__angbandTest.exportSave()'), 'utf8');
    await screenshot('desktop');
    const traceCommands = [',', ',', ',', 'n'];
    const nextUninterrupted = [];
    let traceTurn = saved.state.turn;
    for (const key of traceCommands) {
      await send(key);
      const traceState = await waitFor(`__angbandTest.state.turn>${traceTurn} && __angbandTest.state.command && __angbandTest.state`);
      nextUninterrupted.push(traceState); traceTurn = traceState.turn;
    }
    await evaluate('__angbandTest.save()');
    await waitFor(`__angbandTest.saveRecord.savedAt!==${JSON.stringify(saved.save.savedAt)}`);
    await writeFile(join(out, 'live-branch-save.json'), await evaluate('__angbandTest.exportSave()'), 'utf8');
    // Restore the original checkpoint to IndexedDB, leaving the live game unchanged.
    const checkpointJson = await readFile(join(out, 'checkpoint-save.json'), 'utf8');
    await evaluate(`(async()=>{const storage=await import('./storage.js');const db=await storage.openSaveDatabase();await storage.writeSave(db,storage.importRecord(${JSON.stringify(checkpointJson)}));db.close()})()`);
    await call('Page.reload');
    await waitFor('window.__angbandTest?.ready && window.__angbandTest.saveRecord');
    await evaluate('__angbandTest.start(__angbandTest.saveRecord.seed,true)');
    await waitFor('__angbandTest.running && __angbandTest.state?.hp>0 && __angbandTest.state.command', 45000);
    const resumed = await evaluate('__angbandTest.state');
    try {
      assert.deepEqual(resumed, saved.state);
      check('Reload and resume preserve full diagnostic state and RNG hash', resumed);
    } catch (error) {
      result.checks.push({ name: 'Reload and resume preserve full diagnostic state and RNG hash', passed: false, evidence: { saved: saved.state, resumed } });
      result.errors.push('Resume diagnostic state or full RNG mismatch');
      console.error('FAIL exact save/resume state and RNG', error.message);
    }
    const nextResumed = [];
    traceTurn = saved.state.turn;
    for (const key of traceCommands) {
      await send(key);
      const traceState = await waitFor(`__angbandTest.state.turn>${traceTurn} && __angbandTest.state.command && __angbandTest.state`);
      nextResumed.push(traceState); traceTurn = traceState.turn;
    }
    try {
      assert.deepEqual(nextResumed, nextUninterrupted);
      check('Four identical commands including repeat reproduce uninterrupted gameplay and RNG', nextResumed);
    } catch (error) {
      result.checks.push({ name: 'Four identical commands including repeat reproduce uninterrupted gameplay and RNG', passed: false, evidence: { uninterrupted: nextUninterrupted, resumed: nextResumed } });
      result.errors.push('Resumed next-command gameplay or RNG diverges from uninterrupted branch');
      console.error('FAIL resumed next-command determinism', error.message);
    }
    await evaluate('__angbandTest.save()');
    await waitFor(`__angbandTest.saveRecord.savedAt!==${JSON.stringify(saved.save.savedAt)}`);
    await writeFile(join(out, 'resumed-branch-save.json'), await evaluate('__angbandTest.exportSave()'), 'utf8');
    await send('>');
    await acknowledgeMore();
    await waitFor('__angbandTest.state.depth>0 && __angbandTest.state.command', 30000);
    const dungeonEvidence = await evaluate('__angbandTest.state');
    if (reviewMode) {
      // Original game-world.c announces this dynamic feeling during level entry.
      const feeling = await waitFor('__angbandTest.semantic.messages.slice().reverse().find(packet=>["game.level.feeling.monster","game.level.feeling.combined"].includes(packet.event.id))');
      assert.equal(feeling.locale, 'ja');
      assert.equal(feeling.event.schema_version, 1);
      assert.equal(feeling.event.channel, 'message');
      assert.equal(feeling.event.context, 'command');
      assert.equal(feeling.event.widget, 'log');
      const combined = feeling.event.id === 'game.level.feeling.combined';
      const clauseContext = combined ? 'combined_clause' : 'standalone_clause';
      assert.deepEqual(Object.keys(feeling.event.params).sort(), combined ? ['conjunction', 'monster_feeling', 'object_feeling'] : ['monster_feeling']);
      const grade = feeling.event.params.monster_feeling?.value?.grade;
      assert.ok(Number.isInteger(grade) && grade >= 0 && grade <= 9, 'Original monster feeling grade is within its ten-entry table');
      assert.deepEqual(feeling.event.params.monster_feeling, {
        type: 'MonsterFeeling', value: { grade, context: clauseContext }
      });
      // This order follows original mon_feeling_text[] and the reviewed Rust binding.
      const grades = ['uncertain', 'death_omens', 'murderous', 'terribly_dangerous', 'anxious', 'nervous', 'not_too_risky', 'reasonably_safe', 'sheltered', 'peaceful'];
      const japanese = JSON.parse(await readFile(join(root, 'locales', 'review-ja.json'), 'utf8'));
      const dictionary = japanese.messages ?? japanese;
      const clause = dictionary[`game.level.feeling.monster.${grades[grade]}`];
      assert.equal(typeof clause, 'string');
      let expected = dictionary[feeling.event.id].replace('{monster_feeling}', clause);
      if (combined) {
        const objectGrade = feeling.event.params.object_feeling?.value?.grade;
        assert.ok(Number.isInteger(objectGrade) && objectGrade >= 0 && objectGrade <= 10);
        assert.deepEqual(feeling.event.params.object_feeling, {
          type: 'ObjectFeeling', value: { grade: objectGrade, context: 'combined_clause' }
        });
        const conjunction = (grade <= 5 && objectGrade > 6) || (grade > 5 && objectGrade <= 6) ? 'yet' : 'and';
        assert.deepEqual(feeling.event.params.conjunction, { type: 'FeelingConjunction', value: conjunction });
        const objectGrades = ['ordinary', 'wondrous', 'superb', 'excellent', 'very_good', 'good', 'worthwhile', 'uninteresting', 'few', 'junk', 'cobwebs'];
        const objectClause = dictionary[`game.level.feeling.object.${objectGrades[objectGrade]}`];
        assert.equal(typeof objectClause, 'string');
        expected = expected.replace('{conjunction}', dictionary[`game.level.feeling.join.${conjunction}`]).replace('{object_feeling}', objectClause);
      }
      assert.equal(feeling.text, expected, 'Runtime Rust output matches the captured native grade in Japanese');
      assert.ok(await evaluate(`document.querySelector("#localized-log").textContent.includes(${JSON.stringify(expected)})`));
      dungeonEvidence.levelFeeling = feeling;
    }
    check('Original staircase generates first dungeon level', dungeonEvidence);
    const beforeMovement = await evaluate('({x:__angbandTest.state.x,y:__angbandTest.state.y})');
    let moved = false;
    for (const direction of ['6', '4', '2', '8', '3', '1', '9', '7']) {
      await send(direction, 0, 250);
      await acknowledgeMore();
      moved = await evaluate(`__angbandTest.state.x!==${beforeMovement.x} || __angbandTest.state.y!==${beforeMovement.y}`);
      if (moved) break;
    }
    assert.ok(moved, 'Original movement changes dungeon position');
    check('Original dungeon movement changes position', await evaluate('__angbandTest.state'));
    await screen('05-dungeon');
    await dungeonContinuation();
    await mobileChecks();
    result.sourceArchive = await evaluate(`(async()=>{
      const link=document.querySelector('[data-i18n="source.modified"]');
      const head=await fetch(link.href,{method:'HEAD'});
      if(!head.ok)return {status:head.status,ready:false};
      const response=await fetch(link.href);
      const reader=response.body.getReader();
      const first=await reader.read();await reader.cancel();
      return {ready:true,size:Number(head.headers.get('Content-Length')),magic:Array.from(first.value?.slice(0,4)??[])};
    })()`);
    if (result.sourceArchive.ready) {
      assert.ok(result.sourceArchive.size > 0);
      assert.deepEqual(result.sourceArchive.magic, [80, 75, 3, 4]);
      check('Modified source ZIP download is reachable', result.sourceArchive);
    }
  }
  }
  assert.deepEqual(await captureEngineBuild(), {
    manifest: result.engine, manifestSha256: result.engineManifestSha256, outputs: result.engineHashes
  }, 'Engine artifacts changed while browser evidence was recorded');
  result.engineStableDuringRun = true;
  result.engineVerifiedAt = new Date().toISOString();
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.errors.push(error.stack || String(error));
  console.error(error);
  if (socket && session) { try {
    await evaluate('__angbandTest.inspectAdapters()');
    await delay(100);
    result.hostDiagnostics = await evaluate('({status:document.querySelector("#status")?.textContent,errors:window.__angbandTest?.errors,state:window.__angbandTest?.state,semantic:window.__angbandTest?.semantic,save:window.__angbandTest?.saveRecord,output:__angbandTest.output,adapters:__angbandTest.diagnostics})');
    console.error('Host diagnostics', JSON.stringify(result.hostDiagnostics));
    await screen('failure'); await screenshot('failure');
  } catch {} }
  process.exitCode = 1;
} finally {
  result.finishedAt = new Date().toISOString();
  await writeFile(join(out, 'results.json'), JSON.stringify(result, null, 2), 'utf8');
  if (socket?.readyState === WebSocket.OPEN) { try { await Promise.race([call('Browser.close', {}, false), delay(2000)]); } catch {} socket.close(); }
  for (const entry of pending.values()) clearTimeout(entry.timer);
  pending.clear();
  browser.kill();
  if (browser.exitCode === null && browser.signalCode === null) await Promise.race([once(browser, 'exit'), delay(2000)]);
  browser.stdout.destroy(); browser.stderr.destroy(); browser.unref();
  server.closeAllConnections();
  server.close();
  // This is an isolated, generated test profile, never the user's browser profile.
  if (!resolve(profile).startsWith(`${resolve(out)}${sep}`)) throw new Error('Test profile cleanup escaped evidence directory');
  try { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (error) { console.warn(`Test profile cleanup: ${error.message}`); }
  for (const entry of await readdir(out, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('profile-')) continue;
    const oldProfile = resolve(out, entry.name);
    if (!oldProfile.startsWith(`${resolve(out)}${sep}`)) throw new Error('Stale profile cleanup escaped evidence directory');
    try { await rm(oldProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (error) { console.warn(`Stale test profile cleanup: ${error.message}`); }
  }
}
