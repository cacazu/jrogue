/**
 * Original, unassisted Angband normal-play acceptance. Run by the parent's
 * measured browser job after freezing the final engine; this file does not
 * contain engine-memory writes, debug commands, generated saves, or RNG edits.
 * node tests/browser-normal-play.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = join(root, 'tests', 'browser-normal-play-evidence');
const out = join(evidenceRoot, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const port = Number(process.env.ANGBAND_NORMAL_PLAY_PORT || 4285);
const maxExploration = Number(process.env.ANGBAND_NORMAL_PLAY_EXPLORATION || 1400);
const maxDeath = Number(process.env.ANGBAND_NORMAL_PLAY_DEATH || 1400);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
assert.ok(Number.isInteger(maxExploration) && maxExploration >= 50 && maxExploration <= 6000);
assert.ok(Number.isInteger(maxDeath) && maxDeath >= 50 && maxDeath <= 6000);
const ENTER = 0x9c, ESCAPE = 0xe000, seed = 123456;
const characterName = 'Normal Play QA';
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
  // This allowlist excludes all control chords, wizard/menu entry points,
  // arbitrary function calls, and direct native state access.
  assert.ok(typeof key === 'string' ? /^[a-z12346789,.><ER ]$/.test(key) : [ENTER, ESCAPE, 32].includes(key),
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
  return { ...at, native };
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
function letterRows(native) {
  return native.split('\n').flatMap(line => { const match = line.match(/(^|\s)([a-zA-Z0-9])\)\s+(.*)$/);
    return match ? [{ key: match[2], description: match[3].trim(), line }] : []; });
}
async function inventory() {
  await boundary(); await send('i');
  await waitFor('__angbandTest.semantic.scopes.some(s=>s.context==="inventory")');
  const native = await text();
  const names = await evaluate('__angbandTest.semantic.scopes.filter(s=>s.context==="inventory").flatMap(s=>s.widgets).filter(p=>p.event.id==="interface.items.row.name")');
  assert.ok(names.length > 0 && names.every(p=>p.text && !p.error && !/\[missing/i.test(p.text)));
  assert.ok(names.some(p=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(p.text)));
  const row = letterRows(native).find(row=>/\bRations? of Food\b/.test(row.description));
  assert.ok(row, `Original starter ration is absent: ${native}`);
  const count = row.description.match(/(?:^|\s)(\d+)\s+Rations? of Food\b/);
  const ration = { ...row, quantity: count ? Number(count[1]) : 1 };
  await send(ESCAPE); await boundary(); return { native, ration, names };
}
async function normalFood() {
  const beforeItems = await inventory(), before = await boundary();
  await send('E');
  await waitFor('__angbandTest.semantic.scopes.some(s=>s.widgets.some(p=>p.event.id==="ui.residual.item.prompt.eat")) && __angbandTest.text().includes("Eat which food?")');
  const selected = letterRows(await text()).find(row=>/\bRations? of Food\b/.test(row.description));
  assert.ok(selected); await send(selected.key); await acknowledgeMore(); await boundary();
  const after = await state(), afterItems = await inventory();
  assert.equal(afterItems.ration.quantity, beforeItems.ration.quantity - 1);
  assert.ok(after.turn > before.turn);
  check('Normal eat command consumes one original starter ration and actual game time', { before, after, beforeItems, afterItems });
}
const moves = [{ key: '8', dx: 0, dy: -1 }, { key: '2', dx: 0, dy: 1 }, { key: '4', dx: -1, dy: 0 },
  { key: '6', dx: 1, dy: 0 }, { key: '7', dx: -1, dy: -1 }, { key: '9', dx: 1, dy: -1 },
  { key: '1', dx: -1, dy: 1 }, { key: '3', dx: 1, dy: 1 }];
function nativeMap(frame, current) {
  const actors = frame.cells.flatMap((cell, index) => cell[0] === 64 && index % frame.width >= 13 &&
    Math.floor(index / frame.width) > 0 && Math.floor(index / frame.width) < frame.height - 1 ? [index] : []);
  assert.equal(actors.length, 1, 'The actual native play map must have one visible player @');
  const actor = { x: actors[0] % frame.width, y: Math.floor(actors[0] / frame.width) };
  return { frame, current, actor, offset: { x: current.x - actor.x, y: current.y - actor.y } };
}
function coordinate(map, index) { return { x: index % map.frame.width + map.offset.x, y: Math.floor(index / map.frame.width) + map.offset.y }; }
function positionKey(depth, position) { return `${depth}:${position.x}:${position.y}`; }
function isMonster(code) { return /^[a-zA-Z]$/.test(String.fromCodePoint(code || 32)); }
function traversable(code) { return code >= 33 && ![35, 37, 94, 64].includes(code); }
function pathCandidates(map) {
  const { frame, actor, current } = map, start = actor.y * frame.width + actor.x;
  const queue = [start], previous = new Map([[start, null]]), distances = new Map([[start, 0]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const node = queue[cursor], x = node % frame.width, y = Math.floor(node / frame.width);
    for (const move of moves) {
      const nx = x + move.dx, ny = y + move.dy;
      if (nx < 13 || nx >= frame.width || ny < 1 || ny >= frame.height - 1) continue;
      const next = ny * frame.width + nx, code = frame.cells[next]?.[0];
      if (previous.has(next) || !traversable(code) || blocked.has(positionKey(current.depth, coordinate(map, next)))) continue;
      previous.set(next, { node, move }); distances.set(next, distances.get(node) + 1); queue.push(next);
    }
  }
  const path = index => { const steps = []; for (let node = index; node !== start;) { const step = previous.get(node); steps.push(step.move); node = step.node; } return steps.reverse(); };
  return queue.filter(index=>index!==start).map(index=>({ index, code:frame.cells[index][0], distance:distances.get(index), path:path(index),
    position:coordinate(map,index), visits:visits.get(positionKey(current.depth,coordinate(map,index))) || 0,
    frontier:moves.some(move=>{ const x=index%frame.width+move.dx,y=Math.floor(index/frame.width)+move.dy;
      return x>=13 && x<frame.width && y>=1 && y<frame.height-1 && frame.cells[y*frame.width+x]?.[0]===32; }) }));
}
function decision(map, phase) {
  const candidates = pathCandidates(map), monsters = candidates.filter(item=>isMonster(item.code)).sort((a,b)=>a.distance-b.distance);
  const stairs = candidates.filter(item=>item.code===62).sort((a,b)=>a.distance-b.distance);
  if (phase === 'town') { assert.ok(stairs.length, 'No original down staircase is visible on the town map'); return { key:stairs[0].path[0].key, reason:'visible town staircase', target:stairs[0].position }; }
  if (phase === 'death' && monsters[0]?.distance===1 && stationary < 100) { stationary++; return {key:',',reason:'ordinary hold while a visible natural monster acts',target:monsters[0].position}; }
  if (phase === 'death' && stairs.length && (stationary>=100 || !monsters.length)) { stationary=0; return {key:stairs[0].path[0].key,reason:'visible original down staircase',target:stairs[0].position}; }
  if (monsters.length) { stationary=0; return {key:monsters[0].path[0].key,reason:'visible native monster',target:monsters[0].position}; }
  const ranked = candidates.sort((a,b)=>(a.visits*24 + a.distance*2 - Number(a.frontier)*18) - (b.visits*24 + b.distance*2 - Number(b.frontier)*18));
  assert.ok(ranked.length, 'No reachable native remembered floor remains inside this viewport');
  return {key:ranked[0].path[0].key,reason:'visible/remembered native map exploration',target:ranked[0].position};
}
async function action(key, reason, target) {
  const before = await boundary();
  await send(key); await acknowledgeMore();
  await waitFor('__angbandTest.state?.hp<=0 || __angbandTest.state?.command',4000);
  const after = await observe();
  visits.set(positionKey(after.depth,after),(visits.get(positionKey(after.depth,after)) || 0)+1);
  if (before.turn===after.turn && before.x===after.x && before.y===after.y && /^[12346789]$/.test(key)) {
    const move=moves.find(move=>move.key===key); blocked.add(positionKey(before.depth,{x:before.x+move.dx,y:before.y+move.dy}));
  }
  result.actions.push({ key, reason, target, before, after });
  return after;
}
async function enterDungeon() {
  for (let step = 0; step < 180; step++) {
    const current = await boundary();
    if (current.depth > 0) break;
    if (/down staircase/i.test((await text()).split('\n').at(-1))) await action('>','actual original town down staircase');
    else { const map=nativeMap(await evaluate('__angbandTest.frame'),current), next=decision(map,'town'); await action(next.key,next.reason,next.target); }
  }
  const current = await boundary(); assert.equal(current.depth, 1);
  const feeling = [...messagePackets.values()].find(packet=>['game.level.feeling.monster','game.level.feeling.combined'].includes(packet.event.id));
  assert.ok(feeling, 'Actual native level entry must emit its source-bound feeling'); assert.ok(/[\u3040-\u30ff\u3400-\u9fff]/u.test(feeling.text));
  check('Original staircase creates a normal first dungeon with a source-bound Japanese feeling', { current, feeling });
  await screen('02-normal-dungeon');
}
async function cachedPurity(label) {
  await boundary(); const before=await snapshot();
  await evaluate('for(let i=0;i<30;i++)__angbandTest.redraw();document.querySelector("#font-size").value="20";document.querySelector("#font-size").dispatchEvent(new Event("change"));window.dispatchEvent(new Event("resize"))');
  const fontFixture=await evaluate('(()=>{const select=document.querySelector("#font-size"),canvas=document.querySelector("#terminal"),bounds=canvas.getBoundingClientRect();return {selected:select.value,options:Array.from(select.options,option=>option.value),width:canvas.width,height:canvas.height,cssWidth:bounds.width,cssHeight:bounds.height}})()');
  assert.equal(fontFixture.selected,'20');assert.ok(fontFixture.options.includes('20'));
  assert.ok(fontFixture.width>0&&fontFixture.height>0&&fontFixture.cssWidth>0&&fontFixture.cssHeight>0,'Supported font fixture must render a real nonzero canvas');
  await delay(120); assert.deepEqual(await snapshot(), before);
  await evaluate('document.querySelector("#language").value="en";document.querySelector("#language").dispatchEvent(new Event("change"))');
  await waitFor('__angbandTest.presentation.locale==="en"');
  assert.deepEqual(await state(), before.state); assert.deepEqual(await evaluate('__angbandTest.frame'),before.frame);
  await evaluate('document.querySelector("#language").value="ja";document.querySelector("#language").dispatchEvent(new Event("change"))');
  await waitFor('__angbandTest.presentation.locale==="ja"'); assert.deepEqual(await snapshot(),before);
  check(`Cached frame redraw, CSS font/viewport repaint and EN/JA locale preserve all native facts (${label})`,
    { redraws:30, rngWords:38, nativeTerminalResize:false, before, fontFixture });
}
async function normalCombat() {
  const initial=await boundary();
  for (let step=0;step<maxExploration;step++) {
    const current=await boundary();
    const hit=[...messagePackets.values()].find(packet=>/^angband\.monster_action\.melee\.(hit|critical)(?:_damage)?$/.test(packet.event.id));
    if(hit) {
      assert.ok(current.hp>0); assert.ok(current.turn>initial.turn);
      assert.ok(result.actions.some(action=>action.after.depth>0 && (action.after.x!==action.before.x || action.after.y!==action.before.y)), 'Normal dungeon exploration must physically move');
      assert.ok(/[\u3040-\u30ff\u3400-\u9fff]/u.test(hit.text));
      check('Normal visible-map exploration reaches real original melee and Japanese typed combat output', {current,hit,commands:step});
      await screen('03-normal-combat'); return;
    }
    const map=nativeMap(await evaluate('__angbandTest.frame'),current), next=decision(map,'combat');
    const after=await action(next.key,next.reason,next.target);
    assert.ok(after.hp>0, 'The normal character died before the required successful melee checkpoint');
  }
  throw new Error(`No original melee hit occurred within ${maxExploration} visible-map commands; exact native state/map/actions were captured`);
}
async function continuation() {
  await cachedPurity('combat continuation'); const saved=await checkpoint('normal-combat-checkpoint');
  const keys=[',',',',',',','], uninterrupted=[];
  for(const key of keys) { await action(key,'normal continuation branch'); const at=await snapshot(); assert.ok(at.state.hp>0); uninterrupted.push(at); }
  await restore(saved); const resumed=[];
  for(const key of keys) { await action(key,'resumed identical normal continuation branch'); resumed.push(await snapshot()); }
  assert.deepEqual(resumed,uninterrupted,'Normal next-command continuation must reproduce all 38 RNG words, frame and semantic facts');
  check('Normal combat save/reload/resume and four actual turns reproduce exact uninterrupted native continuation',
    { rngWords:38, checkpoint:saved.at, keys, uninterrupted, resumed });
  await screen('04-normal-resumed');
}
async function normalDeath() {
  const started=await boundary(); let last=started;
  for(let step=0;step<maxDeath;step++) {
    await acknowledgeMore(); last=await observe(); if(last.hp<=0) break;
    const current=await boundary(), native=await text();
    let next;
    if(/down staircase/i.test(native.split('\n').at(-1)) && current.depth<20) next={key:'>',reason:'normal original deeper-level staircase'};
    else next=decision(nativeMap(await evaluate('__angbandTest.frame'),current),'death');
    last=await action(next.key,next.reason,next.target);
  }
  assert.ok(last.hp<0, `Natural death was not reached within ${maxDeath} original visible-map/hold commands; reached depth${result.campaign.maximumDepth}, HP${last.hp}, turn${last.turn}`);
  await acknowledgeMore();
  await waitFor('__angbandTest.semantic.scopes.some(s=>s.widgets.some(p=>p.event.id==="interface.death.table.information")) || (["Information","Messages","File dump"].every(word=>__angbandTest.text().includes(word)))');
  const dead=await screen('05-normal-death');
  assert.match(dead.native,/R\.I\.P\.|Information|Messages/);
  const damaged=result.actions.filter(action=>action.after.hp<action.before.hp && action.after.depth>0);
  assert.ok(damaged.length>0,'Normal fatal branch must include actual original damage');
  assert.ok(messagePackets.size>0);
  result.campaign.normalDeath=true;
  check('Ordinary generated dungeon play and original monster/world actions reach native fatal HP and death UI',
    { started,last,damageTransitions:damaged,maximumDepth:result.campaign.maximumDepth,wizardCommands:0 });
  await send('i');
  await waitFor('__angbandTest.semantic.scopes.some(s=>s.context==="character" && s.widgets.some(p=>p.event.id==="player.sheet.name.value"))');
  const name=await evaluate('__angbandTest.semantic.scopes.find(s=>s.context==="character").widgets.find(p=>p.event.id==="player.sheet.name.value")');
  assert.equal(name.event.params.name.value,characterName); assert.equal(name.text,characterName);
  const info=await screen('06-normal-death-information'); assert.match(info.native,/HP\s+-\d+\/\d+/);
  check('Normal death Information retains original fatal HP and unchanged opaque character name',name);
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
  await freshTown(); await normalFood(); await cachedPurity('normal town'); await enterDungeon(); await normalCombat(); await continuation(); await normalDeath();
  await evaluate('__angbandTest.inspectAdapters()'); const diagnostics=await waitFor('__angbandTest.diagnostics');
  assert.deepEqual(diagnostics,{domain:0,objects:0,stats:0,replay:0});check('All original normal-play semantic and replay adapters remain healthy',diagnostics);
  const sourceDiagnostics=await waitFor('__angbandTest.sourceDiagnostics');
  assert.deepEqual(sourceDiagnostics,{history:0,chests:0});check('Original history and chest source captures remain healthy during normal play',sourceDiagnostics);
  result.errors.push(...await evaluate('__angbandTest.errors'));assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);
  assert.deepEqual(await buildEvidence(),capturedBuild,'Engine changed during normal acceptance');
  result.engineStableDuringRun=true;result.engineVerifiedAt=new Date().toISOString();result.passed=true;result.pass=true;
}catch(error){result.passed=false;result.pass=false;result.errors.push(error.stack||String(error));process.exitCode=1;console.error(error);
  if(socket&&session)try{result.hostDiagnostics=await evaluate('({status:document.querySelector("#status")?.textContent,errors:__angbandTest.errors,state:__angbandTest.state,semantic:__angbandTest.semantic,output:__angbandTest.output})');await screen('failure');}catch(failure){result.errors.push(failure.message);}
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
