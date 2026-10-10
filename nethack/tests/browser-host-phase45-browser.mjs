/* Isolated phase4/5 candidate acceptance. SOURCE PREPARATION ONLY until parent gated runtime execution.
 * Original gameplay commands only; frozen edec runtime/reports are never served or overwritten. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveIntegration } from '../tools/serve-integration.mjs';
import { launchChrome, click, delay, key, waitFor } from './browser-host-semantic-cdp.mjs';
import { loadStageConfig } from './browser-host-phase45-stage.mjs';

const stage = await loadStageConfig('browser');
const { results, reportPath } = stage;
await mkdir(results, { recursive: true });
const report = { measuredAt: new Date().toISOString(), scope: process.argv.includes('--single-role') ? 'debug-single-role-semantic' : 'full-browser-semantic', status: 'running', engine: 'Official NetHack 5.0.0 C WASM with compiled Rust semantic layers', requestedInitialSeed: '123456789', tests: [], errors: [], console: [], screenshots: [],native_callback_semantics_verified:false,compiled_pipeline_verified:false };
if (process.env.NETHACK_INTEGRATION_MEMORY_JSON) report.memoryBeforeLaunch = JSON.parse(process.env.NETHACK_INTEGRATION_MEMORY_JSON);
report.nodePid = process.pid;
report.stage = stage.provenance;
report.sourceMetadataVerified = true;
report.maxConcurrentWasmPages = 1;
const started = Date.now();
const roles = ['Archeologist','Barbarian','Caveman','Healer','Knight','Monk','Priest','Ranger','Rogue','Samurai','Tourist','Valkyrie','Wizard'];
const commandReady = `window.netHackTest?.host?.pendingKind === 'command' && window.netHackTest.getFrame().cells.length > 0`;
let service, chrome, page;

async function step(name, operation) {
  const before = Date.now();
  try {
    const evidence = await operation();
    report.tests.push({ name, status: 'passed', durationMs: Date.now() - before, evidence });
    const summary = JSON.stringify(evidence ?? {});
    process.stdout.write(`PASS ${name} ${summary.slice(0, 800)}${summary.length > 800 ? '...' : ''}\n`);
    return evidence;
  } catch (error) {
    report.tests.push({ name, status: 'failed', durationMs: Date.now() - before, error: error.stack });
    throw error;
  } finally { await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
}

async function screenshot(label, target = page) {
  const image = await target.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const filename = `${label}.png`;
  await writeFile(resolve(results, filename), Buffer.from(image.data, 'base64'));
  report.screenshots.push(filename);
}

async function engineState(target = page) {
  return target.cdp.evaluate(`(() => {const m=window.netHackTest.module;return {state:JSON.parse(m.ccall('nh_abi_state_json','string',[],[])),rawStateChecksum:m.ccall('nh_abi_state_checksum','number',[],[])>>>0,worldChecksum:m.ccall('nh_abi_world_checksum','number',[],[])>>>0,rngChecksum:m.ccall('nh_abi_rng_checksum','number',[],[])>>>0};})()`);
}

function stableState(value) {
  return { state: value.state, worldChecksum: value.worldChecksum, rngChecksum: value.rngChecksum };
}

async function nativeAuxiliaryFiles(target = page) {
  return target.cdp.evaluate(`(() => {const m=window.netHackTest.module;return Object.fromEntries(['record','logfile','xlogfile','livelog'].map(name=>{const path='/'+name;return [name,m.FS.analyzePath(path).exists?m.FS.readFile(path,{encoding:'utf8'}):null];}));})()`);
}

async function dialogSnapshot(target = page) {
  return target.cdp.evaluate(`({phase:window.netHackTest?.phase,pending:window.netHackTest?.host?.pendingKind,title:document.querySelector('#modal-title')?.textContent,originalQuestion:window.__semanticQA?.lastQuestion,rows:Array.from(document.querySelectorAll('.menu-row')).map(el=>el.textContent),choices:Array.from(document.querySelectorAll('.choice')).map(el=>el.textContent),pickMode:document.querySelector('#modal')?.dataset.pickMode,open:document.querySelector('#modal')?.open,textEditor:!!document.querySelector('#modal-body .text-editor'),notice:document.querySelector('#notice')?.textContent,messages:document.querySelector('#messages')?.innerText.slice(-2000)})`);
}

async function instrumentSemantics(target) {
  await target.cdp.evaluate(`(() => {
    if (window.__semanticQA) return;
    const m=window.netHackTest.module,original=window.__jrogueNetHackShim;
    if(typeof original!=='function'||typeof m._nh_abi_semantic_event!=='function') throw Error('Compiled native semantic callback unavailable');
    const qa=window.__semanticQA={captures:[],lastQuestion:null,total:0};
    const surfaces={shim_putstr:2,shim_raw_print:0,shim_raw_print_bold:0,shim_add_menu:7,shim_end_menu:1,shim_yn_function:0,shim_getlin:0};
    const windows=new Set(['shim_putstr','shim_add_menu','shim_end_menu']);
    window.__jrogueNetHackShim=async(name,...args)=>{
      if(name==='shim_yn_function') qa.lastQuestion=args[0];
      if(Object.hasOwn(surfaces,name)) {
        const windowId=windows.has(name)?args[0]:-1;
        const json=m.ccall('nh_abi_semantic_event','string',['string','number'],[name,windowId]);
        if(json) { qa.total++; if(qa.captures.length<4096)qa.captures.push({callback:name,window:windowId,sourceText:String(args[surfaces[name]]??''),envelope:JSON.parse(json)}); }
      }
      return await original(name,...args);
    };
  })()`);
}

async function startup(target, { name = 'BrowserQA', role = 'Valkyrie', restore = false, touch = false } = {}) {
  await waitFor(target, `!!window.netHackTest && !!document.querySelector(${JSON.stringify(restore ? '#restore' : '#start')}) && !document.querySelector(${JSON.stringify(restore ? '#restore' : '#start')}).disabled`, { timeout: 60000, description: 'browser host ready' });
  await instrumentSemantics(target);
  await target.cdp.evaluate(`window.netHackTest.module.ENV.NETHACK_TEST_SEED = '123456789'`);
  await click(target, restore ? '#restore' : '#start', { touch });
  const dialogs = [], deadline = Date.now() + 90000;
  let observedRoles = [];
  while (Date.now() < deadline) {
    if (await target.cdp.evaluate(commandReady)) {
      const state = await engineState(target);
      if (!restore) assert.equal(state.state.roleName, role, 'Upstream started the role actually selected');
      return { dialogs, observedRoles, state };
    }
    const current = await dialogSnapshot(target);
    if (['error','failed','ended'].includes(current.phase)) throw new Error(`Engine startup failed: ${JSON.stringify(current)}`);
    if (current.open) {
      dialogs.push(current);
      report.activeStartup = { name, role, restore, dialogs };
      if (current.pending === 'text' || (current.phase === 'ready' && current.textEditor)) {
        await click(target, '.text-editor', { touch });
        await target.cdp.send('Input.insertText', { text: name });
        await key(target, 'Enter');
      } else if (current.pending === 'question') {
        const originalQuestion = current.originalQuestion ?? current.title;
        await key(target, /pick.*character|choose.*character|random/i.test(originalQuestion) ? 'n' : /Is this ok|Is this all right|accept/i.test(originalQuestion) ? 'y' : 'Enter');
      } else if (current.pending === 'menu') {
        if (current.pickMode === '0') { await key(target, 'Enter'); await delay(70); continue; }
        assert.ok(current.rows.length > 0, `Upstream selectable menu has no selectable UI rows: ${JSON.stringify(current)}`);
        const roleRows = current.rows.filter(text => roles.some(candidate => text.includes(candidate)));
        if (roleRows.length >= 10) observedRoles = roleRows;
        const desired = roleRows.length >= 10 ? current.rows.findIndex(text => text.includes(role)) : 0;
        assert.ok(desired >= 0, `Upstream role menu includes ${role}`);
        // This selector marker only locates a visible upstream row; it never changes engine data.
        await target.cdp.evaluate(`document.querySelectorAll('.menu-row')[${desired}].setAttribute('data-qa-menu-choice','true')`);
        const alreadySelected = await target.cdp.evaluate(`document.querySelector('[data-qa-menu-choice] input').checked`);
        if (alreadySelected && current.pickMode === '1') await key(target, 'Enter');
        else await click(target, '[data-qa-menu-choice] input', { touch });
      } else if (['more','display','history'].includes(current.pending)) await key(target, 'Enter');
      else throw new Error(`Unexpected startup modal: ${JSON.stringify(current)}`);
      await delay(70);
    } else await delay(50);
  }
  throw new Error(`Startup did not reach a real engine command wait: ${JSON.stringify(await dialogSnapshot(target))}`);
}

async function dismissUntilCommand(target = page) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await target.cdp.evaluate(commandReady)) return;
    const current = await dialogSnapshot(target);
    if (current.open) await key(target, 'Escape');
    else await delay(40);
    await delay(60);
  }
  throw new Error(`Did not return to command wait: ${JSON.stringify(await dialogSnapshot(target))}`);
}

try {
  report.artifacts = stage.artifacts;
  service = await serveIntegration({root:stage.webRoot,port:stage.port}); report.localUrl=service.url;
  chrome = await launchChrome();
  report.browser = chrome.version;
  report.chromePid = chrome.child.pid;
  page = await chrome.page(service.url);
  await step('Japanese default and semantic shell IDs', async () => {
    await waitFor(page, `!!window.netHackTest?.host && !document.querySelector('#start').disabled`, { timeout: 60000, description: 'completed engine and gameplay catalog initialization' });
    const evidence = await page.cdp.evaluate(`({lang:document.documentElement.lang,locale:window.netHackTest.locale,ids:Array.from(document.querySelectorAll('[data-text-id]')).map(el=>({id:el.dataset.textId,text:el.textContent})),errors:window.netHackTest.diagnostics})`);
    assert.equal(evidence.lang, 'ja'); assert.equal(evidence.locale, 'ja');
    assert.equal(evidence.errors.semanticCatalogStatus,'loaded'); assert.equal(evidence.errors.semanticCatalogError,null);
    assert.ok(evidence.ids.length >= 10); assert.ok(evidence.ids.every(row => row.id.startsWith('ui.') && row.text));
    assert.ok(evidence.ids.some(row => /[\u3040-\u30ff\u4e00-\u9fff]/.test(row.text)));
    return evidence;
  });
  // Release the initial shell before role/mobile fixtures: only one WASM instance at a time.
  await page.close();
  if (!process.argv.includes('--single-role')) {
    await step('All 13 roles start through actual upstream menus', async () => {
      const starts = [];
      for (const role of roles) {
        const rolePage = await chrome.page(service.url);
        const value = await startup(rolePage, { name: `QA${role}`, role });
        assert.ok(value.state.state.hp > 0);
        assert.equal(value.observedRoles.length, 13);
        const title = await rolePage.cdp.evaluate(`window.netHackTest.getFrame().status.find(row=>row.index===0)?.value`);
        starts.push({ role, title, state: value.state.state, dialogs: value.dialogs.map(dialog => dialog.title) });
        await rolePage.close();
      }
      return starts;
    });
  }
  await step('Fresh mobile game starts through touch role menus and name input', async () => {
    const mobilePage = await chrome.page(service.url);
    await mobilePage.cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await mobilePage.cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const value = await startup(mobilePage, { name: 'MobileQA', role: 'Wizard', touch: true });
    assert.equal(value.state.state.roleName, 'Wizard');
    const viewport = await mobilePage.cdp.evaluate(`({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth})`);
    assert.equal(viewport.width, 390); assert.equal(viewport.height, 844); assert.ok(viewport.documentWidth <= 390);
    await screenshot('mobile-touch-start', mobilePage);
    await mobilePage.close();
    return { viewport, state: value.state.state, dialogs: value.dialogs.map(dialog => ({title:dialog.title,pickMode:dialog.pickMode})) };
  });
  page = await chrome.page(service.url);
  const start = await step('Official role menus and real new-game startup', async () => {
    const value = await startup(page);
    assert.equal(value.observedRoles.length, 13);
    assert.ok(roles.every(role => value.observedRoles.some(text => text.includes(role))));
    assert.ok(value.state.state.hp > 0 && value.state.state.moves >= 1);
    return value;
  });
  await step('Full upstream map, glyphs and status', async () => {
    const frame = await page.cdp.evaluate(`window.netHackTest.getFrame()`);
    // The official windowport emits sparse discovered glyph updates; untouched cells stay blank.
    assert.ok(frame.cells.length > 1 && frame.cells.length <= 79 * 21, `Observed map cells: ${frame.cells.length}`);
    assert.equal(new Set(frame.cells.map(cell => `${cell.x},${cell.y}`)).size, frame.cells.length);
    assert.ok(frame.cells.every(cell => cell.x >= 1 && cell.x <= 79 && cell.y >= 0 && cell.y <= 20));
    assert.ok(frame.cells.some(cell => cell.char === '@'));
    assert.ok(frame.cells.every(cell => Number.isInteger(cell.glyph) && Number.isInteger(cell.color)));
    assert.ok(frame.status.some(row => row.index === 18 && row.value !== ''));
    assert.ok(frame.status.some(row => row.index === 20 && row.value !== ''));
    const rendered = await page.cdp.evaluate(`(() => {const canvas=document.querySelector('#canvas');const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let ink=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]!==13||pixels[i+1]!==17||pixels[i+2]!==21)ink++;}return {width:canvas.width,height:canvas.height,ink,hp:document.querySelector('#status [data-field="18"]')?.textContent,location:document.querySelector('#status [data-field="20"]')?.textContent};})()`);
    assert.ok(rendered.ink > 50 && rendered.width > 0 && rendered.height > 0);
    assert.equal(rendered.width % 79, 0); assert.equal(rendered.height % 21, 0);
    assert.ok(rendered.hp && rendered.location);
    await screenshot('desktop-start');
    return { viewportColumns: 79, viewportRows: 21, observedGlyphCells: frame.cells.length, glyphs: [...new Set(frame.cells.map(cell => cell.glyph))].length, rendered, status: frame.status };
  });
  await step('Actual native accepted source ID renders Japanese and exact original English without reverse matching',async () => {
    const consumed=await page.cdp.evaluate(`window.netHackTest.host.inbox.consumedTotal`);
    const captures=await page.cdp.evaluate(`window.__semanticQA.captures.length`);
    await page.cdp.evaluate(`document.querySelector('#canvas').focus()`); await key(page,',');
    await waitFor(page,`(${commandReady}) && window.netHackTest.host.inbox.consumedTotal>${consumed}`);
    const observed=await page.cdp.evaluate(`(() => {const captures=window.__semanticQA.captures.slice(${captures});const history=window.netHackTest.host.history;const record=captures.find(c=>c.callback==='shim_putstr'&&history.some(h=>h.semantic&&h.id===c.envelope.event.id&&h.sourceText===c.sourceText));return {record,diagnostics:window.netHackTest.diagnostics,ja:Array.from(document.querySelectorAll('#messages [data-semantic-text-id]')).map(el=>({id:el.dataset.semanticTextId,text:el.textContent,translation:el.dataset.translation}))};})()`);
    assert(observed.record,'Real original C callback provided a source-selected semantic message');
    const sourceOwner=stage.sourceOwner(observed.record,observed.record.envelope.context.api);
    const japanese=observed.ja.find(row=>row.id===observed.record.envelope.event.id); assert(japanese);
    assert.match(japanese.text,/[\u3040-\u30ff\u4e00-\u9fff]/); assert.equal(japanese.translation,'semantic-ja');
    await page.cdp.evaluate(`window.netHackTest.setLocale('en')`);
    const english=await page.cdp.evaluate(`Array.from(document.querySelectorAll('#messages [data-semantic-text-id]')).find(el=>el.dataset.semanticTextId===${JSON.stringify(observed.record.envelope.event.id)}).textContent`);
    assert.equal(english,observed.record.sourceText);
    await page.cdp.evaluate(`window.netHackTest.setLocale('ja')`);
    report.native_callback_semantics_verified=true;
    return {originalC:observed.record,sourceOwner,ja:japanese,en:english,semanticCaptureFailures:observed.diagnostics.semanticCaptureFailures};
  });
  await step('Wait input consumes an actual upstream turn', async () => {
    const before = await engineState();
    await page.cdp.evaluate(`document.querySelector('#canvas').focus()`);
    const measuredBefore = await engineState();
    await key(page, '.');
    await waitFor(page, `(${commandReady}) && JSON.parse(window.netHackTest.module.ccall('nh_abi_state_json','string',[],[])).moves > ${measuredBefore.state.moves}`);
    const after = await engineState();
    assert.equal(after.state.moves, measuredBefore.state.moves + 1);
    return { before: measuredBefore, after, focusBefore: before };
  });
  await step('Movement changes actual hero position and consumes a turn', async () => {
    const before = await engineState();
    const candidate = await page.cdp.evaluate(`(() => {const s=JSON.parse(window.netHackTest.module.ccall('nh_abi_state_json','string',[],[]));const f=window.netHackTest.getFrame();return f.cells.filter(c=>Math.abs(c.x-s.x)<=1&&Math.abs(c.y-s.y)<=1&&(c.x!==s.x||c.y!==s.y)&&['.','#','<','>'].includes(c.char)).map(c=>({dx:c.x-s.x,dy:c.y-s.y,x:c.x,y:c.y})).sort((a,b)=>(Math.abs(a.dx)+Math.abs(a.dy))-(Math.abs(b.dx)+Math.abs(b.dy)))[0];})()`);
    assert.ok(candidate, 'Visible passable neighbor exists');
    const directions = { '-1,-1': 'y', '0,-1': 'k', '1,-1': 'u', '-1,0': 'h', '1,0': 'l', '-1,1': 'b', '0,1': 'j', '1,1': 'n' };
    await key(page, directions[`${candidate.dx},${candidate.dy}`]);
    await waitFor(page, `(${commandReady}) && JSON.parse(window.netHackTest.module.ccall('nh_abi_state_json','string',[],[])).moves > ${before.state.moves}`);
    const after = await engineState();
    assert.equal(after.state.x, candidate.x); assert.equal(after.state.y, candidate.y);
    assert.equal(after.state.moves, before.state.moves + 1);
    return { direction: candidate, before, after };
  });
  await step('Inventory and help use actual upstream windows', async () => {
    const before = await engineState();
    await key(page, 'i');
    await waitFor(page, `!!document.querySelector('#modal')?.open`);
    const inventory = await dialogSnapshot();
    const inventoryText = await page.cdp.evaluate(`document.querySelector('#modal-body').textContent`);
    assert.match(inventoryText, /sword|dagger|armor|food|ration|coin|shield/i);
    await dismissUntilCommand();
    await key(page, '?');
    await waitFor(page, `!!document.querySelector('#modal')?.open`);
    const help = await dialogSnapshot();
    assert.ok(help.rows.length > 5 || await page.cdp.evaluate(`document.querySelector('#modal-body').textContent.length > 100`));
    await screenshot('desktop-help');
    await dismissUntilCommand();
    const after = await engineState();
    assert.deepEqual(stableState(after), stableState(before));
    return { inventory, inventoryText, help, unchangedState: after };
  });
  await step('Question and extended-command prompts use upstream choices', async () => {
    const before = await engineState();
    await key(page, 'S');
    await waitFor(page, `window.netHackTest.host.pendingKind === 'question' && document.querySelector('#modal').open`);
    const saveQuestion = await dialogSnapshot();
    assert.ok(saveQuestion.choices.some(text=>text.includes('(y)'))&&saveQuestion.choices.some(text=>text.includes('(n)')),'Original yes/no choices preserved');
    await key(page, 'n');
    await waitFor(page, commandReady);
    await key(page, '#');
    await waitFor(page, `window.netHackTest.host.pendingKind === 'extended' && document.querySelectorAll('.extended-row').length > 20`);
    const commands = await page.cdp.evaluate(`Array.from(document.querySelectorAll('.extended-row')).map(el=>el.textContent)`);
    assert.ok(commands.some(text => text.startsWith('#pray')));
    await key(page, 'Escape');
    await waitFor(page, commandReady);
    assert.deepEqual(stableState(await engineState()), stableState(before));
    return { saveQuestion, commandsCount: commands.length, sample: commands.slice(0, 8) };
  });
  await step('100 locale changes and repaints preserve C world and RNG', async () => {
    const before = await engineState();
    const inputBefore = await page.cdp.evaluate(`({queued:window.netHackTest.host.inbox.queue.length,consumed:window.netHackTest.host.inbox.consumed.length})`);
    const nativeCalls=await page.cdp.evaluate(`(() => {const m=window.netHackTest.module,original=m.ccall,calls=[];m.ccall=function(name,...args){calls.push(name);return original.call(m,name,...args);};try{for(let i=0;i<100;i++){window.netHackTest.setLocale(i%2 ? 'ja':'en');window.netHackTest.repaint();}}finally{m.ccall=original;}return Array.from(new Set(calls));})()`);
    const after = await engineState();
    const inputAfter = await page.cdp.evaluate(`({queued:window.netHackTest.host.inbox.queue.length,consumed:window.netHackTest.host.inbox.consumed.length})`);
    assert.deepEqual(after, before); assert.deepEqual(inputAfter, inputBefore);
    assert(nativeCalls.length>0); assert(nativeCalls.every(name=>name==='nh_rust_format'||name==='nh_rust_format_fallback'||name==='nh_rust_format_gameplay'||name==='nh_rust_format_gameplay_fallback'),JSON.stringify(nativeCalls));
    assert.equal(await page.cdp.evaluate(`document.documentElement.lang`), 'ja');
    return { iterations: 100, before, after, inputBefore, inputAfter,onlyPureRustFormattingCalls:nativeCalls };
  });
  await step('PICK_ANY menu validates invalid count without aborting engine', async () => {
    const before = await engineState();
    await key(page, 'D');
    await waitFor(page, `window.netHackTest.host.pendingKind === 'menu' && document.querySelector('#modal').dataset.pickMode === '2'`);
    const menu = await dialogSnapshot();
    await click(page, '.menu-row input[type="checkbox"]');
    await click(page, '.menu-count');
    await page.cdp.send('Input.insertText', { text: '0' });
    await click(page, '#modal-actions button');
    await delay(100);
    assert.equal(await page.cdp.evaluate(`document.querySelector('#modal').open && window.netHackTest.host.pendingKind === 'menu'`), true);
    assert.notEqual(await page.cdp.evaluate(`window.netHackTest.phase`), 'error');
    await key(page, 'Escape');
    await waitFor(page, commandReady);
    assert.deepEqual(stableState(await engineState()), stableState(before));
    return { pickMode: menu.pickMode, rows: menu.rows.length, invalidCount: 0, remainedOpen: true, cancelledState: before };
  });
  await step('Mobile 390x844 touch controls, menus, and text entry', async () => {
    await page.cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await delay(100);
    const heroVisibility = await page.cdp.evaluate(`(() => {const s=JSON.parse(window.netHackTest.module.ccall('nh_abi_state_json','string',[],[]));const canvas=document.querySelector('#canvas').getBoundingClientRect();const viewport=document.querySelector('#map-viewport').getBoundingClientRect();const heroX=canvas.left+(s.x-0.5)*canvas.width/79;return {heroX,viewportLeft:viewport.left,viewportRight:viewport.right,visible:heroX>=viewport.left&&heroX<=viewport.right};})()`);
    await screenshot('mobile-before-input');
    assert.equal(heroVisibility.visible, true, `Hero visible after viewport resize: ${JSON.stringify(heroVisibility)}`);
    const before = await engineState();
    await click(page, '.direction[aria-label="0, 0"]', { touch: true });
    await waitFor(page, `(${commandReady}) && JSON.parse(window.netHackTest.module.ccall('nh_abi_state_json','string',[],[])).moves > ${before.state.moves}`);
    const afterTouch = await engineState();
    assert.equal(afterTouch.state.moves, before.state.moves + 1);
    await click(page, '[data-text-id="ui.inventory"].action', { touch: true });
    await waitFor(page, `document.querySelector('#modal').open`);
    const inventory = await dialogSnapshot();
    await screenshot('mobile-inventory');
    await click(page, '#modal-actions button', { touch: true });
    await dismissUntilCommand();
    await click(page, '[data-text-id="ui.open"].action', { touch: true });
    await waitFor(page, `window.netHackTest.host.pendingKind === 'question' && document.querySelectorAll('.question-directions .direction').length === 9`);
    const directionPrompt = await dialogSnapshot();
    await click(page, '.question-directions .direction[aria-label="0, -1"]', { touch: true });
    await waitFor(page, commandReady, { description: 'mobile direction accepted by original getdir' });
    const consumedBeforeRaw = await page.cdp.evaluate(`window.netHackTest.host.inbox.consumed.length`);
    await click(page, '#raw-command', { touch: true });
    await page.cdp.send('Input.insertText', { text: ':' });
    await click(page, '#raw-form button[type="submit"]', { touch: true });
    await waitFor(page, `(${commandReady}) && window.netHackTest.host.inbox.consumed.length > ${consumedBeforeRaw}`, { description: 'mobile raw-command text consumed by original engine' });
    const viewport = await page.cdp.evaluate(`({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,mapWidth:document.querySelector('#map-viewport').clientWidth,touchButtons:document.querySelectorAll('#touch-directions .direction').length,rawEmpty:document.querySelector('#raw-command').value === ''})`);
    assert.equal(viewport.width, 390); assert.equal(viewport.height, 844);
    assert.ok(viewport.documentWidth <= 390, `Page overflow: ${viewport.documentWidth}`);
    assert.equal(viewport.touchButtons, 9); assert.equal(viewport.rawEmpty, true);
    await screenshot('mobile-game');
    return { viewport, heroVisibility, before, afterTouch, inventory, directionPrompt, consumedBeforeRaw, consumedAfterRaw: await page.cdp.evaluate(`window.netHackTest.host.inbox.consumed.length`) };
  });
  const saved = await step('Save and quit persists a real upstream save', async () => {
    const before = await engineState();
    const frame = await page.cdp.evaluate(`window.netHackTest.getFrame()`);
    await click(page, '#save', { touch: true });
    await waitFor(page, `window.netHackTest.host.pendingKind === 'question' && document.querySelector('#modal').open`);
    await key(page, 'y');
    const confirmations = [], deadline = Date.now() + 30000;
    while (Date.now() < deadline && !await page.cdp.evaluate(`window.netHackTest.host.exited === true && !document.querySelector('#restore').disabled`)) {
      const current = await dialogSnapshot();
      if (current.open && ['more','display'].includes(current.pending)) {
        confirmations.push({ title: current.title, pending: current.pending });
        await click(page, '#modal-actions button', { touch: true });
      } else if (current.phase === 'error') throw new Error(`Native save failed: ${JSON.stringify(current)}`);
      else await delay(40);
    }
    assert.equal(await page.cdp.evaluate(`window.netHackTest.host.exited === true && !document.querySelector('#restore').disabled`), true, 'Original save-and-quit completed all UI confirmations');
    const save = await page.cdp.evaluate(`window.netHackTest.exportSave()`);
    assert.ok(save && JSON.stringify(save).length > 1000, 'Real save export contains persistent bytes');
    return { state: before, frame, saveBytes: JSON.stringify(save).length, confirmations };
  });
  await step('Fresh WASM instance restores hero stats, checked current-level digest and glyph map', async () => {
    await page.close();
    page = await chrome.page(service.url);
    const value = await startup(page, { restore: true });
    assert.deepEqual(value.state.state, saved.state.state);
    // Raw same-instance checksums include C addresses and are not portable across WASM instances.
    assert.equal(value.state.worldChecksum, saved.state.worldChecksum);
    const frame = await page.cdp.evaluate(`window.netHackTest.getFrame()`);
    const visible = value => value.cells.filter(cell => cell.char !== ' ').map(({x,y,glyph,char,color}) => ({x,y,glyph,char,color})).sort((a,b)=>a.y-b.y||a.x-b.x);
    assert.deepEqual(visible(frame), visible(saved.frame));
    return { before: saved.state, after: value.state, restoredVisibleCells: visible(frame).length, digestScope: 'Hero scalar stats, current terrain, selected monster and floor/inventory object fields; native completed save covers wider engine state.', dialogs: value.dialogs };
  });
  await step('Native quit score and logs persist on a fresh game', async () => {
    const quitState = (await engineState()).state;
    await key(page,'#');
    await waitFor(page, `window.netHackTest.host.pendingKind === 'extended'`);
    await page.cdp.evaluate(`Array.from(document.querySelectorAll('.extended-row')).find(el=>el.textContent.startsWith('#quit ')).setAttribute('data-qa-quit','true')`);
    await click(page,'[data-qa-quit]');
    await waitFor(page, `window.netHackTest.host.pendingKind === 'question' && document.querySelector('#modal').open`);
    const quitQuestion = await dialogSnapshot();
    assert.ok(quitQuestion.choices.some(text=>text.includes('(y)')),'Original quit confirmation response byte preserved');
    await key(page,'y');
    const confirmations = [], deadline = Date.now()+30000;
    while (Date.now()<deadline && !await page.cdp.evaluate(`window.netHackTest.diagnostics.finalized === true`)) {
      const current = await dialogSnapshot();
      if (current.open && current.pending === 'question') { confirmations.push(current.title); await key(page,'n'); }
      else if (current.open && ['display','more','menu'].includes(current.pending)) { confirmations.push(current.title); await key(page,'Enter'); }
      else if (!current.open && current.pending === 'key') { confirmations.push('Native end-game key acknowledgement'); await key(page,'Enter'); }
      else if (current.phase === 'error') throw new Error(`Native quit failed: ${JSON.stringify(current)}`);
      else await delay(40);
    }
    assert.equal(await page.cdp.evaluate(`window.netHackTest.diagnostics.finalized`),true,'Final native quit and auxiliary persistence completed');
    assert.equal(await page.cdp.evaluate(`window.netHackTest.diagnostics.storagePending`),false,'Native auxiliary files committed to browser storage');
    const written = await nativeAuxiliaryFiles();
    assert.equal(typeof written.record,'string');
    // Upstream topten legitimately omits a zero-score quit from its high-score record.
    if (written.record.length) assert.match(written.record,/BrowserQA/);
    assert.match(written.logfile,/BrowserQA/); assert.match(written.logfile,/quit/);
    assert.match(written.xlogfile,/BrowserQA/); assert.match(written.xlogfile,/quit/);
    await page.close();
    page = await chrome.page(service.url);
    const fresh = await startup(page,{name:'ScoreReload',role:'Knight'});
    const restored = await nativeAuxiliaryFiles();
    for (const name of ['record','logfile','xlogfile']) assert.equal(restored[name],written[name],`Native ${name} survives a fresh WASM game`);
    return { quitState, quitQuestion, confirmations, written, recordEntry:written.record.length ? 'Native qualifying score recorded' : 'Native zero-score quit omitted from high-score record', freshHero:fresh.state.state, checkedFiles:['record','logfile','xlogfile'], bones:'This quit lifecycle creates no bones; no synthetic bones file was inserted.' };
  });
  await step('No unexpected browser errors, exceptions or failed requests', async () => {
    report.errors = chrome.pages.flatMap(page => page.errors);
    report.console = chrome.pages.flatMap(page => page.console);
    report.logs = chrome.pages.flatMap(page => page.logs);
    report.failedRequests = chrome.pages.flatMap(page => page.failedRequests);
    assert.equal(report.errors.length, 0);
    const errors = report.console.filter(row => row.type === 'error');
    assert.equal(errors.length, 0, JSON.stringify(errors));
    const browserErrors = report.logs.filter(entry => entry.level === 'error' && !entry.url?.endsWith('/favicon.ico'));
    assert.equal(browserErrors.length, 0, JSON.stringify(browserErrors));
    assert.equal(report.failedRequests.length, 0, JSON.stringify(report.failedRequests));
    assert.equal(service.requests.filter(request => request.status >= 400 && !request.path.startsWith('/favicon.ico')).length, 0);
    return { exceptions: report.errors.length, consoleErrors: errors.length, unexpectedBrowserLogErrors: browserErrors.length, ignoredKnownFavicon404:report.logs.filter(entry=>entry.level==='error'&&entry.url?.endsWith('/favicon.ico')).length, failedRequests: report.failedRequests.length, requestCount: service.requests.length };
  });
  await step('Tested browser bundle remained unchanged during full suite', async () => {
    await stage.verifyUnchanged();
    assert.ok(service.requests.some(request=>request.path.split('?')[0]===`/${stage.catalogPath}`),'Hash the exact gameplay catalog actually fetched by the staged browser host');
    return report.artifacts;
  });
  report.status = 'passed';
  report.compiled_pipeline_verified=report.native_callback_semantics_verified;
  report.semanticLimits={fullJapaneseTextCoverage:false,nativeQuestProducerVerified:false,nativeNestedNameProducerVerified:false,nativeAccessibilityQualifierVerified:false,explanation:'This full normal-adventure suite verifies actual native message IDs/Japanese replay and gameplay/mobile/save/RNG. Quest/name/a11y producer coverage requires the separate legitimate debug fixture; synthetic ABI formatter fixtures do not establish it.'};
} catch (error) {
  report.status = 'failed';
  report.blocker = error.stack;
  if (page) {
    report.errors = chrome.pages.flatMap(page => page.errors);
    report.console = chrome.pages.flatMap(page => page.console);
    report.logs = chrome.pages.flatMap(page => page.logs);
    report.failedRequests = chrome.pages.flatMap(page => page.failedRequests);
    report.lastDialog = await dialogSnapshot().catch(() => null);
    report.engineDiagnostics = await page.cdp.evaluate(`({diagnostics:window.netHackTest?.diagnostics,layout:window.netHackTest?.host?.memory.layout,windows:Array.from(window.netHackTest?.host?.windows.values()??[]).map(win=>({id:win.id,type:win.type,prompt:win.prompt,items:win.items.map(({identifier,selectable,accelerator,event,flags})=>({identifier,selectable,accelerator,event,flags}))}))})`).catch(() => null);
    report.resourceDiagnostics = await page.cdp.evaluate(`(() => {const m=window.netHackTest?.module;if(!m)return null;return {cwd:m.FS.cwd(),root:m.FS.readdir('/'),files:['nhlib.lua','help'].map(name=>{const ptr=m.ccall('nh_abi_readfile','number',['string'],[name]);try{const text=ptr?m.UTF8ToString(ptr):'';return {name,opened:!!ptr,chars:text.length,head:text.slice(0,40)};}finally{if(ptr)m._free(ptr);}})};})()`).catch(error => ({ error: error.message }));
    await screenshot('failure').catch(() => {});
  }
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
} finally {
  report.durationMs = Date.now() - started;
  report.requests = service?.requests;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (chrome) await chrome.close();
  if (service) await service.close();
  report.ownedProcessesClosedAt = new Date().toISOString();
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`RESULT ${report.status}: ${report.tests.filter(test => test.status === 'passed').length} passed, ${report.tests.filter(test => test.status === 'failed').length} failed. ${reportPath}\n`);
}
