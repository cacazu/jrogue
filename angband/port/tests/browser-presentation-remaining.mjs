/**
 * Original normal-birth presentation acceptance. Run by the parent's
 * measured browser job after freezing the final engine; this file does not
 * contain engine-memory writes, debug commands, generated saves, or RNG edits.
 * node tests/browser-presentation-remaining.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = join(root, 'tests', 'browser-presentation-remaining-evidence');
const out = join(evidenceRoot, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const port = Number(process.env.ANGBAND_PRESENTATION_PORT || 4286);
const maxExploration = Number(process.env.ANGBAND_NORMAL_PLAY_EXPLORATION || 1400);
const maxDeath = Number(process.env.ANGBAND_NORMAL_PLAY_DEATH || 1400);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
assert.ok(Number.isInteger(maxExploration) && maxExploration >= 50 && maxExploration <= 6000);
assert.ok(Number.isInteger(maxDeath) && maxDeath >= 50 && maxDeath <= 6000);
const ENTER = 0x9c, ESCAPE = 0xe000, seed = 123456;
// Original get_character_name() starts at column55 and askfor_aux_ext()
// clamps against80, so its32-byte buffer has24 input bytes plusNUL here.
// Exact24-byte quoted Japanese text still exceeds the sheet's13-cell prefix.
const characterName = 'Presentation "日本語"';
assert.equal(Buffer.byteLength(characterName,'utf8'),24);
const delay = ms => new Promise(done => setTimeout(done, ms));
const result = { startedAt: new Date().toISOString(), normalPlay: true,
  wizardCommands: 0, cheatCommands: 0, engineMemoryWrites: 0, syntheticNativeState: false,
  seed, checks: [], frames: [], actions: [], observedMessages: [], errors: [], consoleErrors: [],
  campaign: { complete100Levels: false, maximumDepth: 0, normalDeath: false },
  budgets: { explorationCommands: maxExploration, naturalDeathCommands: maxDeath }, outputDirectory: out };
let executable, profile, server, browser, socket, session, sequence = 0;
let browserOutput = '';
const pending = new Map(), messagePackets = new Map(), visits = new Map(), blocked = new Set();
let stationary = 0;
for (const candidate of [process.env.ANGBAND_CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean)) {
  try { await access(candidate); executable = candidate; break; } catch {}
}
if (!executable) throw new Error('Chrome or Edge executable not found');
function check(name, evidence) { result.checks.push({ name, passed: true, evidence }); console.log(`PASS ${name}`); }
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
    const value = await evaluate(expression); if (value) return value;
    const error = await evaluate('window.__angbandTest?.errors?.at(-1)');
    if (error) throw new Error(`Host error while waiting: ${error}`);
    await delay(80);
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}
async function text() { return evaluate('__angbandTest.text()'); }
async function state() { return evaluate('__angbandTest.state'); }
async function snapshot() {
  return evaluate('({state:__angbandTest.state,frame:__angbandTest.frame,semantic:__angbandTest.semantic,draft:document.querySelector("#game-text").value})');
}
async function observe() {
  const current = await state();
  if (current) { assert.equal(current.rng.length, 38); result.campaign.maximumDepth = Math.max(result.campaign.maximumDepth, current.depth); }
  const messages = await evaluate('__angbandTest.semantic?.messages || []');
  for (const packet of messages) {
    assert.ok(packet.event?.id, 'Every captured message must have its original semantic ID');
    assert.ok(!packet.error && packet.text && !/\[missing/i.test(packet.text), `Invalid source message: ${packet.event.id}`);
    assert.equal(packet.locale, 'ja');
    const key = JSON.stringify(packet.event);
    if (!messagePackets.has(key)) messagePackets.set(key, packet);
  }
  return current;
}
async function send(key, milliseconds = 65) {
  // Printable original UI keys plus Enter/Escape and normal Ctrl-P recall.
  // Manual control-prefix keys and all wizard/control chords are excluded.
  assert.ok(typeof key === 'string' ? /^[\x20-\x7e]$/.test(key) && !['^','\\'].includes(key) : [ENTER, ESCAPE, 32, 16].includes(key),
    `Normal-play input is not allowed: ${String(key)}`);
  assert.equal(await evaluate(`__angbandTest.send(${JSON.stringify(key)},0)`), true, 'Browser must accept the ordinary input');
  await delay(milliseconds);
}
async function acknowledgeMore() {
  for (let page = 0; page < 24; page++) { if (!/-more-/i.test(await text())) return; await send(32, 80); }
  throw new Error('Native message paging exceeded 24 pages');
}
async function boundary() {
  await acknowledgeMore();
  await waitFor('__angbandTest.running && __angbandTest.state?.command && __angbandTest.state.hp>0');
  return observe();
}
async function screen(label) {
  const at = await snapshot(), native = await text();
  result.frames.push({ label, ...at, native });
  await writeFile(join(out, `${label}.txt`), native, 'utf8');
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(out, `${label}.png`), Buffer.from(shot.data, 'base64'));
  return at;
}
async function submitLine(value) {
  await evaluate(`document.querySelector('#game-text').value=${JSON.stringify(String(value))};document.querySelector('#text-entry').requestSubmit()`);
  await delay(120); await send(ENTER, 180);
}
async function buildEvidence() {
  const bytes = await readFile(join(root, 'build', 'manifest.json'));
  const manifest = JSON.parse(bytes.toString('utf8')), outputs = [];
  for (const name of ['game.js', 'game.wasm', 'game.data']) {
    const hash = createHash('sha256'); let length = 0;
    for await (const chunk of createReadStream(join(root, 'build', name))) { hash.update(chunk); length += chunk.length; }
    const actual = { name, bytes: length, sha256: hash.digest('hex') }, expected = manifest.outputs.find(output => output.name === name);
    assert.ok(expected); assert.equal(actual.bytes, expected.bytes); assert.equal(actual.sha256, expected.sha256); outputs.push(actual);
  }
  return { manifest, manifestSha256: createHash('sha256').update(bytes).digest('hex'), outputs };
}
async function checkpoint(label) {
  const previous = await evaluate('__angbandTest.saveRecord?.savedAt || null');
  await evaluate('__angbandTest.save()');
  await waitFor(`__angbandTest.saveRecord && __angbandTest.saveRecord.savedAt!==${JSON.stringify(previous)}`, 45000);
  const json = await evaluate('__angbandTest.exportSave()');
  assert.equal(Buffer.from(JSON.parse(json).payload, 'base64').readUInt16LE(8), 3);
  const at = await snapshot(); await writeFile(join(out, `${label}.json`), json, 'utf8');
  return { json, at };
}
async function restore(saved) {
  // Restore only the exported original continuation, unchanged, into this
  // isolated browser's IndexedDB. No invented save payload or native writes.
  await evaluate(`(async()=>{const storage=await import('./storage.js');const db=await storage.openSaveDatabase();try{await storage.writeSave(db,storage.importRecord(${JSON.stringify(saved.json)}));}finally{db.close();}})()`);
  await call('Page.reload'); await waitFor('window.__angbandTest?.ready && __angbandTest.saveRecord');
  await evaluate('__angbandTest.start(__angbandTest.saveRecord.seed,true)');
  await waitFor('__angbandTest.running && __angbandTest.state?.command && __angbandTest.state.hp>0', 90000);
  assert.deepEqual(await snapshot(), saved.at, 'Normal save must restore every state/RNG word, cell, semantic widget and draft');
}
async function freshTown() {
  await evaluate(`__angbandTest.start(${seed},false)`);
  await waitFor('__angbandTest.running && __angbandTest.semantic.scopes.some(s=>s.context==="birth" && s.widgets.some(p=>p.event.id==="birth.race.hint")) && /Please select your character traits/.test(__angbandTest.text())', 45000);
  let named = false;
  for (let stage = 0; stage < 20; stage++) {
    if (await evaluate('__angbandTest.state?.hp>0 && __angbandTest.state.x>0 && __angbandTest.state.command')) break;
    const native = await text();
    if (/Enter a name for your character/.test(native)) { await submitLine(characterName); named = true; }
    else await send(ENTER, 230);
  }
  await send(ESCAPE); await send(ESCAPE); const current = await boundary();
  assert.ok(named); assert.equal(current.depth, 0); assert.match(await text(), /Human/); assert.match(await text(), /Warrior/);
  check('Fresh Human Warrior is born through ordinary original menus with all 38 RNG words observed', current);
  await screen('01-normal-town');
}

function widgets(context) { return `__angbandTest.semantic.scopes.find(s=>s.context===${JSON.stringify(context)})?.widgets`; }
async function scope(context, id = null) {
  return waitFor(`(()=>{const rows=${widgets(context)};return rows?.length && ${id ? `rows.some(p=>p.event.id===${JSON.stringify(id)})` : 'true'} ? rows : false})()`);
}
function checkedRows(rows) {
  assert.ok(rows.length>0);
  assert.ok(rows.every(p=>p.event && typeof p.event.id==='string' && !p.error &&
    (p.event.id ? typeof p.text==='string' && !/\[missing/i.test(p.text) : p.text===null && p.event.widget.startsWith('__'))),
    'Source-bound rows must render, and source controls must remain explicit reserved controls');
  assert.ok(rows.some(p=>p.event.id && /[\u3040-\u30ff\u3400-\u9fff]/u.test(p.text)), 'Japanese content must be rendered from the actual source facts');
}
async function noScope(context) { await waitFor(`!__angbandTest.semantic.scopes.some(s=>s.context===${JSON.stringify(context)})`); }
async function uiFacts() {
  return evaluate('({state:__angbandTest.state,frame:__angbandTest.frame,scopes:__angbandTest.semantic.scopes.map(s=>({context:s.context,widgets:s.widgets.map(p=>p.event)})),messages:__angbandTest.semantic.messages.map(p=>p.event),draft:document.querySelector("#game-text").value})');
}
async function pureUi(context) {
  const before=await uiFacts();
  await evaluate('for(let i=0;i<20;i++)__angbandTest.redraw();document.querySelector("#font-size").value="20";document.querySelector("#font-size").dispatchEvent(new Event("change"));window.dispatchEvent(new Event("resize"))');
  const fontFixture=await evaluate('(()=>{const select=document.querySelector("#font-size"),canvas=document.querySelector("#terminal"),bounds=canvas.getBoundingClientRect();return {selected:select.value,options:Array.from(select.options,option=>option.value),width:canvas.width,height:canvas.height,cssWidth:bounds.width,cssHeight:bounds.height}})()');
  assert.equal(fontFixture.selected,'20');assert.ok(fontFixture.options.includes('20'));
  assert.ok(fontFixture.width>0&&fontFixture.height>0&&fontFixture.cssWidth>0&&fontFixture.cssHeight>0,'Supported font fixture must render a real nonzero canvas');
  await delay(120);assert.deepEqual(await uiFacts(),before);
  await evaluate('document.querySelector("#language").value="en";document.querySelector("#language").dispatchEvent(new Event("change"))');
  await waitFor('__angbandTest.presentation.locale==="en"');const english=await scope(context);assert.ok(english.every(p=>!p.error));
  assert.deepEqual(await uiFacts(),before,'EN locale must render the same native facts and every RNG word');
  await evaluate('document.querySelector("#language").value="ja";document.querySelector("#language").dispatchEvent(new Event("change"))');
  await waitFor('__angbandTest.presentation.locale==="ja"');assert.deepEqual(await uiFacts(),before);
  check(`Source facts/all 38 RNG/native cells survive cached repaint/font/viewport/EN-JA roundtrip (${context})`,{before,english,fontFixture});
}
async function nativeChoice(label) {
  const native=await text(), line=native.split('\n').find(line=>line.includes(label));assert.ok(line,`Original native menu label absent: ${label}`);
  const key=line.match(/(?:^|\s)([a-zA-Z0-9])\)\s+/);assert.ok(key,`Original native menu selection tag absent: ${line}`);
  await send(key[1],160);return {line,key:key[1]};
}
async function clickCell(x,y,button='left') {
  await evaluate('document.querySelector("#terminal").scrollIntoView({block:"center",inline:"center"})');
  const geometry=await evaluate(`(()=>{const canvas=document.querySelector('#terminal'),b=canvas.getBoundingClientRect(),f=__angbandTest.frame,v=document.querySelector('#terminal-viewport'),point={x:b.left+(${x}+0.5)*b.width/f.width,y:b.top+(${y}+0.5)*b.height/f.height},hit=document.elementFromPoint(point.x,point.y);return {point,selectedFont:document.querySelector('#font-size').value,canvas:{width:canvas.width,height:canvas.height,left:b.left,top:b.top,widthCss:b.width,heightCss:b.height},viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY},container:{scrollLeft:v.scrollLeft,scrollTop:v.scrollTop,clientWidth:v.clientWidth,clientHeight:v.clientHeight},hit:{id:hit?.id||null,tag:hit?.tagName||null,onCanvas:hit===canvas},nativeCell:{x:Math.floor((point.x-b.left)*f.width/b.width),y:Math.floor((point.y-b.top)*f.height/b.height)}}})()`);
  const input={cell:{x,y},button,geometry,pointerDown:null};(result.mouseInputs??=[]).push(input);
  assert.equal(geometry.selectedFont,'20');assert.ok(geometry.canvas.width>0&&geometry.canvas.height>0&&geometry.canvas.widthCss>0&&geometry.canvas.heightCss>0);
  assert.deepEqual(geometry.nativeCell,{x,y});assert.ok(geometry.hit.onCanvas,'Real CDP mouse point must hit the native canvas, with visible nonzero geometry');
  await evaluate('window.__angbandHarnessPointerDown=null;document.querySelector("#terminal").addEventListener("pointerdown",event=>{const canvas=event.currentTarget,b=canvas.getBoundingClientRect(),f=__angbandTest.frame;window.__angbandHarnessPointerDown={isTrusted:event.isTrusted,pointerType:event.pointerType,button:event.button,buttons:event.buttons,clientX:event.clientX,clientY:event.clientY,target:event.target.id,nativeCell:{x:Math.floor((event.clientX-b.left)*f.width/b.width),y:Math.floor((event.clientY-b.top)*f.height/b.height)}}},{once:true,capture:true})');
  const buttons=button==='left'?1:button==='right'?2:4;
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button,buttons,pointerType:'mouse',clickCount:1,...geometry.point});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',button,buttons:0,pointerType:'mouse',clickCount:1,...geometry.point});await delay(160);
  input.pointerDown=await evaluate('window.__angbandHarnessPointerDown');
  assert.ok(input.pointerDown?.isTrusted);assert.equal(input.pointerDown.pointerType,'mouse');assert.equal(input.pointerDown.target,'terminal');
  assert.equal(input.pointerDown.button,button==='left'?0:button==='right'?2:1);assert.equal(input.pointerDown.buttons,buttons);assert.deepEqual(input.pointerDown.nativeCell,{x,y});
  return input;
}
async function nativeMouseRow(label) {
  const native=await text(),lines=native.split('\n'),y=lines.findIndex(line=>line.includes(label));assert.ok(y>=0,`Native mouse row absent: ${label}`);
  const x=lines[y].indexOf(label)+Math.min(4,label.length-1);const input=await clickCell(x,y);return {x,y,label,input};
}
async function clickSemanticRow(context,widget) {
  const selector=`[data-source-context="${context}"][data-source-widget="${widget}"]`;
  const point=await evaluate(`(()=>{const row=document.querySelector(${JSON.stringify(selector)});if(!row||row.tagName!=='BUTTON')throw new Error('Owned semantic mouse row absent');row.scrollIntoView({block:'center'});const b=row.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await delay(180);
}
async function restoreUi(saved,context) {
  await evaluate(`(async()=>{const storage=await import('./storage.js');const db=await storage.openSaveDatabase();try{await storage.writeSave(db,storage.importRecord(${JSON.stringify(saved.json)}));}finally{db.close();}})()`);
  await call('Page.reload');await waitFor('window.__angbandTest?.ready && __angbandTest.saveRecord');
  await evaluate('__angbandTest.start(__angbandTest.saveRecord.seed,true)');
  await waitFor(`__angbandTest.running && __angbandTest.semantic.scopes.some(s=>s.context===${JSON.stringify(context)})`,90000);
  assert.deepEqual(await snapshot(),saved.at,'Nested UI restore must reproduce native cells/all 38 RNG/source rows/opaque browser draft');
}
async function recallFlow() {
  const dictionaryFile=JSON.parse(await readFile(join(root,'locales','game-en.json'),'utf8')),dictionary=dictionaryFile.messages??dictionaryFile;
  const match=Object.entries(dictionary).find(([,text])=>typeof text==='string'&&text.includes('I see no up staircase here'));
  assert.ok(match);for(let i=0;i<3;i++){await send('<',150);await acknowledgeMore();}
  // A different, ordinary source message places the repeated staircase event
  // behind age zero. Finding it now requires a real older-row search match.
  await send(':');await waitFor('__angbandTest.text().includes("Note:" )');await submitLine('recall search marker');await acknowledgeMore();await boundary();
  await send(16,180);await waitFor('__angbandTest.text().includes("Message recall")');
  let rows=await scope('message-recall','ui.recall.header');checkedRows(rows);
  const recall=rows.find(p=>p.event.id===match[0]),repeat=rows.find(p=>p.event.id==='ui.recall.row.repeat');
  assert.ok(recall,'Actual failed staircase message must be recalled through its retained semantic event');
  assert.ok(repeat&&repeat.event.params.count.value>=3,'Original merged repeat count must be captured');
  const targetAge=Number(recall.event.widget.match(/^row\.(\d+)\.name$/)?.[1]);assert.ok(Number.isInteger(targetAge)&&targetAge>0);
  check('Normal Ctrl-P message recall includes actual Japanese source event, repeat count and original header facts',{recall,repeat,header:rows.find(p=>p.event.id==='ui.recall.header')});
  await pureUi('message-recall');
  const beforeOffset=rows.find(p=>p.event.id==='ui.recall.header').event.params.offset.value;
  await send('6');rows=await scope('message-recall','ui.recall.header');
  assert.equal(rows.find(p=>p.event.id==='ui.recall.header').event.params.offset.value,beforeOffset+(await evaluate('__angbandTest.frame.width'))/2);
  await send('4');await scope('message-recall','ui.recall.header');
  await send('=');await waitFor('__angbandTest.text().includes("Find:" )');
  const query='階段';await submitLine(query);rows=await scope('message-recall','ui.recall.search.current');
  const search=rows.find(p=>p.event.id==='ui.recall.search.current');assert.equal(search.event.params.query.type,'verbatim_user_text');assert.equal(search.event.params.query.value,query);
  assert.equal(rows.find(p=>p.event.id==='ui.recall.header').event.params.first.value,targetAge,'Japanese query must actually find the older original English staircase event');
  check('Original recall navigation and Japanese search select the older source-bound message with explicit parameters',{search,targetAge,rows});
  await screen('02-message-recall');await send(ESCAPE);await noScope('message-recall');await boundary();
}
async function matrixFlow() {
  await send('C');await scope('character','player.sheet.name.value');
  const bornName=await evaluate(`${widgets('character')}.find(p=>p.event.id==='player.sheet.name.value')`);
  assert.equal(bornName.event.params.name.value,characterName,'Normal birth must retain every byte within its original24-byte editor bound');
  await send('c');await scope('name-editor','birth.name.prompt');
  const nativeNameInput=await evaluate('({maximum:__angbandTest.presentation.input_max_bytes,frameWidth:__angbandTest.frame.width,cursor:__angbandTest.frame.cursor,native:__angbandTest.text()})');
  assert.equal(nativeNameInput.maximum,24,'Actual original rename must publish its55-column/80-column-clamp24-byte input bound');
  assert.deepEqual(nativeNameInput.cursor,[55,0],'Original name prompt must place the editor at native column55');
  assert.ok(nativeNameInput.frameWidth>=80);
  check('Actual original C/c rename publishes the native24-byte bound and accepts an exact24-byte opaque quoted Japanese name',
    {submitted:characterName,utf8Bytes:Buffer.byteLength(characterName,'utf8'),nativeNameInput,provenance:'docs/NATIVE-NAME-EDITOR-BOUNDARY.md'});
  await submitLine(characterName);await noScope('name-editor');await scope('character','player.sheet.name.value');
  const name=await evaluate(`${widgets('character')}.find(p=>p.event.id==='player.sheet.name.value')`);
  assert.equal(name.event.params.name.value,characterName);assert.equal(name.text,characterName);
  const native=await text(),nameRow=native.split('\n')[1];
  assert.equal(nameRow.slice(8,21),[...characterName].slice(0,13).join(''),'Native overlap must retain its original 13-cell name prefix');
  check('Character sheet retains full opaque Japanese name while preserving the original native overlapping-panel clip',{name,nativeNameRow:nameRow});
  await send('h');const rows=await scope('character-matrix','angband.character.matrix.cell');checkedRows(rows);
  const cells=rows.filter(p=>p.event.id==='angband.character.matrix.cell'),labels=rows.filter(p=>p.event.id==='angband.character.matrix.row');
  assert.ok(cells.length>0&&labels.length>0);assert.ok(cells.every(p=>p.event.params.state.type==='localized_text'));
  assert.ok(await evaluate('Array.from(document.querySelectorAll("#semantic-panels table")).some(table=>/[\\u3040-\\u30ff\\u3400-\\u9fff]/u.test(table.textContent))'),'Actual Japanese matrix must have a readable table');
  check('Original h mode change exposes known per-slot resistance/property/sustain facts and full Japanese labels',{labels,cells});
  await pureUi('character-matrix');
  const draft='ExternalPlayer draft 日本語';
  await evaluate(`document.querySelector('#game-text').value=${JSON.stringify(draft)};document.querySelector('#game-text').dispatchEvent(new Event('input'))`);await delay(120);
  const saved=await checkpoint('remaining-matrix-v3');await restoreUi(saved,'character-matrix');assert.equal((await snapshot()).draft,draft);
  check('Version3 restores the original second-sheet wait, all 38 RNG words, matrix facts, full frame and opaque unsent draft',saved.at);
  await evaluate('document.querySelector("#game-text").value="";document.querySelector("#game-text").dispatchEvent(new Event("input"))');await delay(120);
  await screen('03-character-matrix');await send('h');await noScope('character-matrix');await scope('character','player.sheet.name.value');
  await send(ESCAPE);await boundary();
}
async function commandMenuFlow() {
  await send(ENTER);let parent=await scope('context-menu.0');checkedRows(parent);
  assert.match(await text(),/Items|Action commands|Manage items/);await pureUi('context-menu.0');
  // Original parent menu has no fabricated row-letter shortcuts. Two native
  // down keys reach Manage items, then Enter opens its original child.
  await send('2');await send('2');await send(ENTER);let child=await scope('context-menu.1');checkedRows(child);
  assert.match(await text(),/Display inventory listing/);assert.ok(child.some(p=>p.event.id==='context.command.row'));
  await pureUi('context-menu.1');await screen('04-original-command-child');
  await send(ESCAPE);await noScope('context-menu.1');parent=await scope('context-menu.0');
  assert.ok(parent.every(p=>!p.event.params.shortcut),'Escaped child shortcuts must not leak into parent rows');
  check('Original Enter command parent/child/escape uses native navigation and releases child rows',{parent,child});
  await send(ENTER);child=await scope('context-menu.1');const mousePolicy=child.find(p=>p.event.widget==='__context_row:1');
  assert.ok(mousePolicy);assert.equal(mousePolicy.event.params.flags.value,0,'Original command child selects a valid row on one click');
  const mouseClicks=1,cell=await nativeMouseRow('Display inventory listing');
  await scope('inventory','interface.items.row.name');await noScope('context-menu.1');await noScope('context-menu.0');
  check('Actual native canvas mouse selection honors original menu cursor/select policy and opens inventory',{cell,mouseClicks,mousePolicy});
  await send(ESCAPE);await boundary();
  await send(ENTER);await scope('context-menu.0');await send(ENTER);child=await scope('context-menu.1');
  const inventory=child.find(p=>p.event.id==='context.command.row'&&p.event.params.shortcut?.value===' (i)');assert.ok(inventory);
  const block=await evaluate(`__angbandTest.presentation.sections.find(s=>s.key==='context-menu.1').blocks.find(b=>b.key===${JSON.stringify(inventory.event.widget)})`);
  assert.ok(block.activation_mouse);assert.equal(block.activation_mouse.button,1);assert.equal(block.activation_key,null,'Untagged original command rows must not invent a keyboard shortcut');
  let semanticClicks=1;await clickSemanticRow('context-menu.1',inventory.event.widget);
  if(!await evaluate('__angbandTest.semantic.scopes.some(s=>s.context==="inventory")')){await clickSemanticRow('context-menu.1',inventory.event.widget);semanticClicks++;}
  await scope('inventory','interface.items.row.name');await noScope('context-menu.1');await noScope('context-menu.0');
  check('Actual Japanese semantic menu click forwards the original selected native mouse coordinates and selection policy',{inventory,block,semanticClicks});
  await send(ESCAPE);await boundary();
  const button='right';
  const frame=await evaluate('__angbandTest.frame'),index=frame.cells.findIndex((cell,index)=>cell[0]===64&&index%frame.width>=13);
  assert.ok(index>=0);await clickCell(index%frame.width,Math.floor(index/frame.width),button);const mouse=await scope('context-menu.0');checkedRows(mouse);
  check('Actual PC mouse native button2 enters its original cave/player context menu',{browserButton:button,nativeButton:2,rows:mouse});
  await send(ESCAPE);await noScope('context-menu.0');await boundary();
}
function reference(packet,key) { return packet.event.params[key]?.value; }
async function lookFlow() {
  const before=await boundary();await send('l');await scope('target-detail');await send('p');
  let rows=await scope('target-detail','angband.look.row.self');checkedRows(rows);const self=rows.find(p=>p.event.id==='angband.look.row.self');
  const zero=reference(self,'coordinates');assert.equal(zero.params.vertical.value,0);assert.equal(zero.params.horizontal.value,0);
  assert.equal(reference(self,'subject')?.id,'angband.look.subject.terrain');
  await pureUi('target-detail');await send('6');rows=await scope('target-detail');const prose=rows.find(p=>/^angband\.look\.row\./.test(p.event.id));assert.ok(prose);
  const relative=reference(prose,'coordinates');assert.equal(relative.params.vertical.value,0);assert.equal(relative.params.horizontal.value,1);assert.equal(relative.params.east_west.value.id,'angband.look.direction.east');
  assert.equal((await state()).x,before.x);assert.equal((await state()).y,before.y);assert.deepEqual((await state()).rng,before.rng);
  check('Original look/player focus/free-cursor step emits Japanese selected terrain and exact relative coordinates without moving the player',{self,prose});
  await screen('05-look-coordinate');await send(ESCAPE);await noScope('target-detail');await boundary();
}
const userNote='記録 ExternalPlayer stays unchanged';
async function historyFlow() {
  await send(':');await waitFor('__angbandTest.text().includes("Note:" )');await submitLine(userNote);await acknowledgeMore();await boundary();
  await send('~');await waitFor('__angbandTest.text().includes("Display current knowledge")');
  await nativeChoice('Display character history');const rows=await scope('gameplay-history','angband.game_history.title');checkedRows(rows);
  const entries=rows.filter(p=>['angband.game_history.row','angband.game_history.row_lost'].includes(p.event.id));assert.ok(entries.length>=2);
  const birth=entries.find(p=>reference(p,'entry')?.id==='angband.game_history.birth'),note=entries.find(p=>reference(p,'entry')?.id==='angband.game_history.note'&&reference(p,'entry').params.text.value===userNote);
  assert.ok(birth&&note);assert.equal(reference(note,'entry').params.text.type,'verbatim_user_text');assert.equal(reference(note,'entry').params.text.value,userNote);assert.ok(note.text.includes('ExternalPlayer'));
  assert.ok(entries.every(p=>Number.isInteger(p.event.params.turn.value)&&Number.isInteger(p.event.params.depth.value)));
  check('Original chronological ledger captures birth plus actual opaque Japanese/English user note and native turn/depth',{entries});
  await pureUi('gameplay-history');await send('n');await scope('gameplay-history');await send('p');await scope('gameplay-history');await screen('06-gameplay-history');
  await send(ESCAPE);await noScope('gameplay-history');await send(ESCAPE);await boundary();
}
async function knowledgeFlow() {
  await send('~');await waitFor('__angbandTest.text().includes("Display current knowledge")');await nativeChoice('Display monster knowledge');
  const rows=await scope('knowledge-metadata');checkedRows(rows);const summary=rows.find(p=>p.event.id==='ui.knowledge.summary.creatures'||p.event.id==='ui.knowledge.summary.uniques');assert.ok(summary);
  const items=await scope('knowledge-items');assert.ok(items.some(p=>p.event.id==='interface.knowledge.row.kills'||/^ui\.knowledge\.monster\.status\./.test(p.event.id)));
  check('Original known-monster panel exposes source-selected kills/status and Japanese native group totals',{summary,items});
  await pureUi('knowledge-metadata');await screen('07-knowledge-metadata');await send(ESCAPE);await noScope('knowledge-metadata');await send(ESCAPE);await boundary();
}
async function exportFlow() {
  await send('C');await scope('character','player.sheet.name.value');await send('f');await waitFor('__angbandTest.text().includes("File name:" )');
  const filename='remaining-qa.txt',nativeConfirmation=`Saving as /Angband/${filename}.`;
  await submitLine(filename);await waitFor(`__angbandTest.text().split('\\n')[0]===${JSON.stringify(nativeConfirmation)}`);
  const acknowledgement={filename,nativeConfirmation,before:await state(),code:32,source:'logic/ui-input.c:1581-1585 get_file_text() anykey()'};
  assert.equal((await text()).split('\n')[0],nativeConfirmation);assert.equal(await evaluate('__angbandTest.characterExports.length'),0,'Native acknowledgement precedes the first completed export');
  await send(32,180);await waitFor(`__angbandTest.text().split('\\n')[0]!==${JSON.stringify(nativeConfirmation)}`);
  acknowledgement.after=await state();result.actions.push({key:32,reason:'Original get_file_text mandatory anykey acknowledgement',...acknowledgement});
  check('Original C/f filename route confirms the exact native save path and accepts one ordinary Space acknowledgement',acknowledgement);
  await acknowledgeMore();const rows=await scope('character-export','angband.character.export.title');checkedRows(rows);
  assert.ok(!rows.some(p=>p.event.id==='angband.character.export.capture_rejected'));
  assert.ok(rows.some(p=>p.event.id===''&&p.event.widget==='__export_ready'),'Original source completion must be retained explicitly');
  const payload=await waitFor('__angbandTest.characterExports.at(-1)');assert.equal(payload.locale,'ja');assert.equal(payload.filename,'angband-character-ja.txt');
  let file;
  for(let attempt=0;attempt<150;attempt++){file=(await readdir(join(out,'downloads'))).find(name=>name.endsWith('.txt'));if(file)break;await delay(100);}
  assert.ok(file,'Source-complete character dump must reach a real browser TXT download');
  const raw=await readFile(join(out,'downloads',file)),decoded=new TextDecoder('utf-8',{fatal:true}).decode(raw);
  assert.equal(decoded,payload.text,'Actual browser download must contain the exact completed Rust-owned UTF-8 text');
  assert.ok(raw.length>100);assert.ok(!decoded.includes('\ufffd'));assert.ok(/[\u3040-\u30ff\u3400-\u9fff]/u.test(decoded));assert.ok(decoded.includes(characterName));assert.ok(decoded.includes(userNote));
  assert.ok(rows.every(p=>!p.text||decoded.includes(p.text)),'Downloaded Japanese dump must contain every complete owned export row');
  check('Original character-file command downloads complete source-bound UTF-8 Japanese text with full opaque name/note',{file,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),rows});
  const downloadsBefore=await evaluate('__angbandTest.characterExports.length');await pureUi('character-export');await delay(120);
  assert.equal(await evaluate('__angbandTest.characterExports.length'),downloadsBefore,'Locale changes and cached redraw must not duplicate a completed export');
  check('Completed character download is consume-once across locale/cached redraw',downloadsBefore);
  await screen('08-native-character-export');await send(ESCAPE);await boundary();
}

try {
  await mkdir(out,{recursive:true}); profile=await mkdtemp(join(out,'profile-'));
  process.env.ANGBAND_PORT=String(port); ({server}=await import('../web/server.mjs')); if(!server.listening)await once(server,'listening');
  browser=spawn(executable,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check',
    '--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'about:blank'],
    {windowsHide:true,stdio:['ignore','pipe','pipe']});
  browser.stderr.on('data',chunk=>{browserOutput=(browserOutput+chunk).slice(-8192);}); browser.on('error',error=>{browserOutput+=String(error);});
  const capturedBuild=await buildEvidence(); result.engine=capturedBuild.manifest; result.engineManifestSha256=capturedBuild.manifestSha256;
  result.engineHashes=capturedBuild.outputs; result.outputs=capturedBuild.outputs; result.engineCapturedAt=new Date().toISOString();
  let debugInfo;
  for(let attempt=0;attempt<100;attempt++){try{debugInfo=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);break;}catch{}await delay(150);}
  if(!debugInfo)throw new Error(`Browser startup failed: ${browserOutput}`);
  socket=new WebSocket(`ws://127.0.0.1:${debugInfo[0]}${debugInfo[1]}`);await once(socket,'open');
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const entry=pending.get(message.id);if(!entry)return;
    clearTimeout(entry.timer);pending.delete(message.id);message.error?entry.reject(new Error(JSON.stringify(message.error))):entry.resolve(message.result);
  }else if(message.method==='Runtime.exceptionThrown')result.consoleErrors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);});
  const target=await call('Target.createTarget',{url:'about:blank'},false);session=(await call('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:1050,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:`http://127.0.0.1:${port}/web/`});await waitFor('window.__angbandTest?.ready');
  assert.equal(await evaluate('document.documentElement.lang'),'ja');
  await mkdir(join(out,'downloads'),{recursive:true});await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:join(out,'downloads'),eventsEnabled:true},false);
  await freshTown();await recallFlow();await matrixFlow();await commandMenuFlow();await lookFlow();await historyFlow();await knowledgeFlow();await exportFlow();
  await evaluate('__angbandTest.inspectAdapters()'); const diagnostics=await waitFor('__angbandTest.diagnostics');
  assert.deepEqual(diagnostics,{domain:0,objects:0,stats:0,replay:0});check('All remaining presentation semantic and replay adapters remain healthy',diagnostics);
  const sourceDiagnostics=await waitFor('__angbandTest.sourceDiagnostics');
  assert.deepEqual(sourceDiagnostics,{history:0,chests:0});check('Original history and chest source captures remain healthy across presentation flows',sourceDiagnostics);
  result.errors.push(...await evaluate('__angbandTest.errors'));assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);
  assert.deepEqual(await buildEvidence(),capturedBuild,'Engine changed during remaining-presentation acceptance');
  result.engineStableDuringRun=true;result.engineVerifiedAt=new Date().toISOString();result.passed=true;result.pass=true;
}catch(error){result.passed=false;result.pass=false;result.errors.push(error.stack||String(error));process.exitCode=1;console.error(error);
  if(socket&&session)try{result.hostDiagnostics=await evaluate('({status:document.querySelector("#status")?.textContent,errors:__angbandTest.errors,state:__angbandTest.state,semantic:__angbandTest.semantic,output:__angbandTest.output,nativeText:__angbandTest.text(),characterExports:__angbandTest.characterExports??[],sourceDiagnostics:__angbandTest.sourceDiagnostics??null,adapterDiagnostics:__angbandTest.diagnostics??null})');await screen('failure');}catch(failure){result.errors.push(failure.message);}
}finally{
  result.observedMessages=[...messagePackets.values()];result.finishedAt=new Date().toISOString();
  await mkdir(out,{recursive:true});await writeFile(join(out,'results.json'),JSON.stringify(result,null,2),'utf8');await writeFile(join(evidenceRoot,'results.json'),JSON.stringify(result,null,2),'utf8');
  if(socket?.readyState===WebSocket.OPEN){try{await Promise.race([call('Browser.close',{},false),delay(2000)]);}catch{}socket.close();}
  for(const entry of pending.values())clearTimeout(entry.timer);pending.clear();browser?.kill();
  if(browser&&browser.exitCode===null&&browser.signalCode===null)await Promise.race([once(browser,'exit'),delay(2000)]);
  browser?.stdout.destroy();browser?.stderr.destroy();browser?.unref();server?.closeAllConnections();server?.close();
  if(profile&&!resolve(profile).startsWith(`${resolve(out)}${sep}`))throw new Error('Profile cleanup escaped this run directory');
  try{if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch(error){console.warn(`Isolated profile cleanup: ${error.message}`);}
}
