/**
 * Separately labelled original-command perception fixture, not normal play.
 * Parent runs this against a frozen production engine. Original Ctrl-A/E
 * TIMED_INC IMAGE and Ctrl-A/n summon are the only fixture setup routes.
 * No production patch, engine-memory mutation, RNG setter, or invented save.
 * node tests/browser-native-perception.mjs
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
const evidenceRoot = join(root, 'tests', 'browser-native-perception-evidence');
const out = join(evidenceRoot, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const port = Number(process.env.ANGBAND_PERCEPTION_PORT || 4287);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const ENTER = 0x9c, ESCAPE = 0xe000, CTRL_A = 1, CTRL_R = 18, seed = 123459;
const delay = ms => new Promise(done => setTimeout(done, ms));
const result = { startedAt: new Date().toISOString(), fixture: 'wizard_original_perception_commands',
  normalPlay: false, normalCampaignCompletion: false, complete100Levels: false, scoreEligible: false,
  engineMemoryWrites: 0, syntheticNativeState: false, seed, checks: [], frames: [], actions: [], inputTrace: [],
  debugCommands: [], observedSemanticIds: [], errors: [], consoleErrors: [], outputDirectory: out,
  sourceCommit: 'f3082213b73f3e463e3d0d60bff4b00462beae6e',
  attributionLimit: 'Animation is observed through original visible RF_ATTR_MULTI cells and game turns; total turn RNG changes also include original monster/world processing.' };
let executable, profile, server, browser, socket, session, sequence = 0, browserOutput = '';
const pending = new Map(), seenIds = new Set();
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
  const at = await evaluate('({state:__angbandTest.state,frame:__angbandTest.frame,semantic:__angbandTest.semantic,draft:document.querySelector("#game-text").value})');
  assert.equal(at.state.rng.length, 38, 'Observe every native gameplay/perception RNG word');
  return at;
}
async function observe() {
  const at = await snapshot();
  for (const p of [...at.semantic.messages, ...at.semantic.scopes.flatMap(s => s.widgets)]) {
    if (!p.event.id) { assert.equal(p.text, null); continue; }
    assert.ok(!p.error && typeof p.text === 'string' && !/\[missing/i.test(p.text), `Invalid source packet: ${p.event.id}`);
    seenIds.add(p.event.id);
  }
  return at;
}
async function send(key, milliseconds = 120) {
  // Explicit fixture allowlist; arbitrary control chords and native setters
  // are unavailable. Debug command keys are further restricted by debug().
  assert.ok(typeof key === 'string' ? /^[\x20-\x7e]$/.test(key) && !['^', '\\'].includes(key) :
    [ENTER, ESCAPE, CTRL_A, CTRL_R, 32].includes(key), `Unsupported fixture input ${String(key)}`);
  assert.equal(await evaluate(`__angbandTest.send(${JSON.stringify(key)},0)`), true);
  result.inputTrace.push({ kind: 'key', key, mods: 0 });
  await delay(milliseconds);
}
async function waitNative(pattern, timeout = 20000) {
  return waitFor(`new RegExp(${JSON.stringify(pattern.source)},${JSON.stringify(pattern.flags)}).test(__angbandTest.text())`, timeout);
}
async function acknowledgeMore() {
  for (let page = 0; page < 24; page++) { if (!/-more-/i.test(await text())) return; await send(32, 120); }
  throw new Error('Original message paging exceeded 24 pages');
}
async function boundary() {
  await acknowledgeMore();
  await waitFor('__angbandTest.running && __angbandTest.state?.command && __angbandTest.state.hp>0');
  return observe();
}
async function transition(expression, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    await acknowledgeMore();
    if (await evaluate(expression)) return boundary();
    const error = await evaluate('__angbandTest.errors.at(-1)');
    if (error) throw new Error(`Host error during original transition: ${error}`);
    await delay(80);
  }
  throw new Error(`Original transition timed out: ${expression}`);
}
async function submitLine(value) {
  // Ordinary browser text input. The native command validates these names.
  result.inputTrace.push({ kind: 'text-input', value: String(value) });
  await evaluate(`document.querySelector('#game-text').value=${JSON.stringify(String(value))};document.querySelector('#text-entry').requestSubmit()`);
  await delay(120); await send(ENTER, 180);
}
async function screen(label) {
  const at = await snapshot(), native = await text();
  result.frames.push({ label, ...at, native });
  await writeFile(join(out, `${label}.txt`), native, 'utf8');
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(out, `${label}.png`), Buffer.from(shot.data, 'base64'));
  return at;
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
async function sourceEvidence() {
  const boundaryAudit = JSON.parse(await readFile(join(root, 'migration', 'perception-rng-boundary.json'), 'utf8'));
  const paths = ['logic/ui-map.c', 'logic/cave-map.c', 'logic/z-rand.h', 'logic/z-rand.c',
    'logic/ui-display.c', 'logic/game-world.c', 'logic/ui-command.c', 'logic/ui-game.c', 'logic/cmd-wizard.c',
    'logic/main-web.c', 'logic/z-color.h', 'logic/ui-target.c', 'logic/web-look-target.c',
    'logic/effect-handler-general.c', 'logic/player-timed.c', 'data/gamedata/monster.txt',
    'data/gamedata/monster_base.txt', 'data/gamedata/player_timed.txt'];
  const sources = [], bodies = {};
  for (const path of paths) {
    const bytes = await readFile(join(root, path));
    sources.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    bodies[path] = bytes.toString('utf8').replaceAll('\r\n', '\n');
  }
  for (const pristine of boundaryAudit.pristineSources) {
    const current = sources.find(p => p.path === pristine.path);
    assert.equal(current.sha256, pristine.sha256, `${pristine.path} must retain pristine perception rules`);
    assert.equal(current.bytes, pristine.bytes);
  }
  const display = bodies['logic/ui-display.c'], world = bodies['logic/game-world.c'];
  assert.match(display, /static void animate\([^]*?\{\s*do_animation\(\);\s*\}/);
  assert.match(display, /rf_has\(mon->race->flags, RF_ATTR_MULTI\)\)\s*attr = randint1\(BASIC_COLORS - 1\)/);
  assert.match(display, /event_add_handler\(EVENT_ANIMATE, animate, NULL\)/);
  assert.equal((world.match(/event_signal\(EVENT_ANIMATE\);\s*\/\* Process monster with even more energy first \*\/\s*process_monsters\(player->energy \+ 1\)/g) || []).length, 2);
  assert.match(bodies['logic/ui-game.c'], /"Redraw the screen", \{ KTRL\('R'\) \}, CMD_NULL, do_cmd_redraw/);
  assert.match(bodies['logic/ui-game.c'], /"Perform an effect", \{ 'E' \}, CMD_WIZ_PERFORM_EFFECT/);
  assert.match(bodies['logic/ui-game.c'], /"Summon specific", \{ 'n' \}, CMD_WIZ_SUMMON_NAMED/);
  assert.match(bodies['logic/ui-command.c'], /void do_cmd_redraw\(void\)[^]*?PR_MAP[^]*?handle_stuff\(player\)/);
  assert.match(bodies['logic/cmd-wizard.c'], /effect_simple\(index, source_player\(\), dice, p1, p2, p3, y, x, &ident\)/);
  assert.match(bodies['logic/effect-handler-general.c'], /bool effect_handler_TIMED_INC\(/);
  assert.match(bodies['data/gamedata/player_timed.txt'], /name:IMAGE\ndesc:hallucination\ngrade:o:10000:Halluc:You feel drugged!/);
  const eye = bodies['data/gamedata/monster.txt'].split('\nname:').find(s => s.startsWith('disenchanter eye\n'));
  assert.ok(eye); assert.match(eye, /flags:NEVER_MOVE/); assert.match(eye, /flags:ATTR_MULTI/); assert.match(eye, /base:eye/);
  assert.match(bodies['data/gamedata/monster_base.txt'], /name:eye\nglyph:e\n/);
  const basicColors = Number(bodies['logic/z-color.h'].match(/^#define BASIC_COLORS\s+(\d+)$/m)?.[1]);
  assert.ok(Number.isInteger(basicColors) && basicColors > 1);
  const nativeWait = bodies['logic/main-web.c'].split('case TERM_XTRA_EVENT: {')[1]?.split('case TERM_XTRA_DELAY:')[0];
  assert.ok(nativeWait); assert.match(nativeWait, /observe_wait\(observed, v\)/);
  assert.doesNotMatch(nativeWait, /idle_update\s*\(|do_animation\s*\(|map_info\s*\(|grid_data_as_text\s*\(/);
  assert.match(bodies['logic/ui-target.c'], /if \(!p->timed\[TMD_IMAGE\]\) return false/);
  assert.match(bodies['logic/ui-target.c'], /ab_look_emit\(&auxst->web,AB_LOOK_STRANGE,0\)/);
  return { upstream: boundaryAudit.upstream, sources, nativeConstants: { basicColors }, contracts: ['pristine native perception rules',
    'original TIMED_INC IMAGE', 'unconditional original EVENT_ANIMATE before monster processing',
    'stationary visible disenchanter eye ATTR_MULTI e', 'native Ctrl-R original PR_MAP and handle_stuff'] };
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
  await evaluate(`(async()=>{const storage=await import('./storage.js');const db=await storage.openSaveDatabase();try{await storage.writeSave(db,storage.importRecord(${JSON.stringify(saved.json)}));}finally{db.close();}})()`);
  await call('Page.reload'); await waitFor('window.__angbandTest?.ready && __angbandTest.saveRecord');
  await evaluate('__angbandTest.start(__angbandTest.saveRecord.seed,true)');
  await waitFor('__angbandTest.running && __angbandTest.state?.command && __angbandTest.state.hp>0', 90000);
  assert.deepEqual(await snapshot(), saved.at, 'Exact source-selected perception/frame/all38RNG/draft must resume unchanged');
}
function sourceFacts(at) {
  return { state: at.state, frame: at.frame, draft: at.draft,
    semantic: { messages: at.semantic.messages.map(p => p.event),
      scopes: at.semantic.scopes.map(s => ({ context: s.context, widgets: s.widgets.map(p => p.event) })) } };
}
async function locale(value) {
  await evaluate(`document.querySelector('#language').value=${JSON.stringify(value)};document.querySelector('#language').dispatchEvent(new Event('change'))`);
  await waitFor(`document.documentElement.lang===${JSON.stringify(value)} && __angbandTest.presentation.locale===${JSON.stringify(value)}`);
  return snapshot();
}
async function cachedPurity(label) {
  const before = await snapshot(), draws = await evaluate('__angbandTest.redrawCount');
  await evaluate(`for(let i=0;i<40;i++)__angbandTest.redraw();document.querySelector('#font-size').value='20';document.querySelector('#font-size').dispatchEvent(new Event('change'));window.dispatchEvent(new Event('resize'))`);
  const fontFixture=await evaluate('(()=>{const select=document.querySelector("#font-size"),canvas=document.querySelector("#terminal"),bounds=canvas.getBoundingClientRect();return {selected:select.value,options:Array.from(select.options,option=>option.value),width:canvas.width,height:canvas.height,cssWidth:bounds.width,cssHeight:bounds.height}})()');
  assert.equal(fontFixture.selected,'20');assert.ok(fontFixture.options.includes('20'));
  assert.ok(fontFixture.width>0&&fontFixture.height>0&&fontFixture.cssWidth>0&&fontFixture.cssHeight>0,'Supported font fixture must render a real nonzero canvas');
  await call('Emulation.setDeviceMetricsOverride', { width: 900, height: 1000, deviceScaleFactor: 1, mobile: false });
  // Elapsed browser idle must not add desktop idle_update() native animation.
  await delay(500);
  assert.ok((await evaluate('__angbandTest.redrawCount')) >= draws + 42);
  assert.deepEqual(await snapshot(), before, `${label}: cached frame/font/viewport/idle changed original continuation`);
  const english = await locale('en');
  assert.deepEqual(sourceFacts(english), sourceFacts(before), `${label}: EN locale changed native facts or any RNG word`);
  const japanese = await locale('ja');
  assert.deepEqual(japanese, before, `${label}: JA locale roundtrip changed selected perception`);
  assert.ok(japanese.semantic.messages.some(p => /[\u3040-\u30ff\u3400-\u9fff]/u.test(p.text || '')));
  check(`${label}: cached repaint/font/browser resize/idle/locale are pure for all38 RNG words and selected facts`,
    { beforeRng: before.state.rng, afterRng: japanese.state.rng, cachedDraws: (await evaluate('__angbandTest.redrawCount')) - draws, fontFixture });
  return { before, english, japanese };
}
async function freshTown() {
  await evaluate(`__angbandTest.start(${seed},false)`);
  await waitFor('__angbandTest.running && __angbandTest.semantic.scopes.some(s=>s.context==="birth" && s.widgets.some(p=>p.event.id==="birth.race.hint"))', 45000);
  let named = false;
  for (let stage = 0; stage < 20; stage++) {
    if (await evaluate('__angbandTest.state?.hp>0 && __angbandTest.state.x>0 && __angbandTest.state.command')) break;
    if (/Enter a name for your character/.test(await text())) { await submitLine('Perception Fixture QA'); named = true; }
    else await send(ENTER, 230);
  }
  await send(ESCAPE); await send(ESCAPE); const at = await boundary();
  assert.ok(named); assert.equal(at.state.depth, 0); assert.match(await text(), /Human/); assert.match(await text(), /Warrior/);
  check('Normal birth precedes explicitly labelled debug fixture', at.state);
}
async function debug(key, expected) {
  assert.ok(['E', 'n'].includes(key), 'Only original effect and named-summon fixture setup is allowed');
  await boundary(); await send(CTRL_A); await waitNative(/Debug Command:/); await send(key, 180);
  result.debugCommands.push({ key, route: `original Ctrl-A/${key}`, ranked: false });
  for (let warning = 0; warning < 4; warning++) {
    await acknowledgeMore(); const native = await text();
    if (expected.test(native)) break;
    assert.match(native, /debug|cheat|sure|really|scor/i, 'Unexpected original debug prerequisite');
    await send('y', 180);
  }
  await waitNative(expected);
}
async function originalTimedEffect(effect, subtype, amount) {
  assert.ok(['TIMED_INC', 'TIMED_DEC'].includes(effect));
  assert.ok(['IMAGE', 'INVULN'].includes(subtype));
  await debug('E', /Do which effect/); await submitLine(effect);
  await waitNative(/Enter damage dice/); await submitLine(String(amount));
  await waitNative(/effect subtype/); await submitLine(subtype);
  for (const prompt of ['second parameter', 'third parameter', 'y parameter', 'x parameter']) {
    await waitFor('__angbandTest.text().includes(' + JSON.stringify(prompt) + ')'); await submitLine('0');
  }
  await boundary();
  result.actions.push({ route: 'original Ctrl-A/E', effect, subtype, amount, after: (await snapshot()).state });
}
function rngDelta(before, after) {
  assert.equal(before.length, 38); assert.equal(after.length, 38);
  return before.flatMap((value, index) => value === after[index] ? [] : [{ index, before: value, after: after[index] }]);
}
async function hallucination() {
  const before = await boundary();
  await originalTimedEffect('TIMED_INC', 'IMAGE', 2000);
  assert.match(await text(), /Halluc/);
  assert.equal((await state()).hp, before.state.hp, 'Timed fixture must not set player HP');
  await screen('01-original-image-effect');
  const pure = await cachedPurity('Original hallucination');
  const onset = pure.english.semantic.messages.find(p => /You feel drugged!/.test(p.text || ''));
  assert.ok(onset?.event.id, 'Original IMAGE onset must have a source-bound English event');
  assert.equal(onset.event.id, 'domain.player_timed.image.grade.1.enter_message');
  const onsetJapanese = pure.japanese.semantic.messages.find(p => JSON.stringify(p.event) === JSON.stringify(onset.event));
  assert.ok(onsetJapanese && /[\u3040-\u30ff\u3400-\u9fff]/u.test(onsetJapanese.text));
  check('Original IMAGE onset retains the same semantic event in English and Japanese', { english: onset, japanese: onsetJapanese });
  await send('l'); await waitNative(/something strange/);
  await waitFor('__angbandTest.semantic.scopes.some(s=>s.context==="target-detail" && s.widgets.some(p=>p.event.params.subject?.value.id==="angband.look.subject.strange"))');
  await screen('01b-original-hallucination-look');
  await cachedPurity('Original hallucination look');
  await send(ESCAPE); await boundary();
  assert.ok(!(await snapshot()).semantic.scopes.some(s => s.context === 'target-detail'), 'Hallucination look scope must end with the original command');
  const saved = await checkpoint('original-image-before-native-redraw');
  await send(CTRL_R, 250);
  const first = await transition(`__angbandTest.state?.command && JSON.stringify(__angbandTest.state.rng)!==${JSON.stringify(JSON.stringify(saved.at.state.rng))}`);
  const delta = rngDelta(saved.at.state.rng, first.state.rng);
  assert.ok(delta.length > 0, 'Original Ctrl-R PR_MAP redraw under IMAGE must consume shared native perception RNG');
  assert.equal(first.state.turn, saved.at.state.turn, 'Native redraw is a zero-energy original command');
  assert.equal(first.state.hp, saved.at.state.hp); assert.equal(first.state.x, saved.at.state.x); assert.equal(first.state.y, saved.at.state.y);
  await screen('02-native-hallucination-redraw');
  await restore(saved); await send(CTRL_R, 250);
  const repeated = await transition(`__angbandTest.state?.command && JSON.stringify(__angbandTest.state.rng)!==${JSON.stringify(JSON.stringify(saved.at.state.rng))}`);
  assert.deepEqual(repeated, first, 'Identical original redraw from exact v3 continuation must reproduce all38 words, terminal cells and facts');
  result.nativeHallucination = { originalEffect: 'TIMED_INC IMAGE 2000', nativeRedraw: 'Ctrl-R',
    nativeDrawsObserved: true, replayMatched: true, before: saved.at.state, after: first.state, changedRngWords: delta };
  check('Original hallucination redraw consumes shared RNG and exact original replay reproduces every word/cell/fact', result.nativeHallucination);
  await cachedPurity('After original hallucination redraw');
  await originalTimedEffect('TIMED_DEC', 'IMAGE', 99999);
  assert.doesNotMatch(await text(), /Halluc/);
  const clearPure = await cachedPurity('Original IMAGE end');
  assert.ok(clearPure.english.semantic.messages.some(p => p.event.id === 'domain.player_timed.image.end_message' &&
    /You can see clearly again\./.test(p.text || '')),
    'Original TIMED_DEC must remove IMAGE before identifying a real animation race');
}
async function visibleOriginalEye() {
  await debug('n', /Summon which monster/); await submitLine('disenchanter eye'); await boundary();
  assert.doesNotMatch(await text(), /No monster found\.|Could not place monster\./);
  await send('l'); await waitNative(/Press '\?' for help\./);
  const signatures = new Set(); let selected = null;
  for (let index = 0; index < 100; index++) {
    const native = await text(), cursor = await evaluate('__angbandTest.frame.cursor'), header = native.split('\n')[0];
    if (/^You (?:see|are on) /.test(header) && /disenchanter eye/i.test(header)) { selected = { header, cursor }; break; }
    const signature = JSON.stringify({ header, cursor }); if (signatures.has(signature)) break;
    signatures.add(signature); await send('+', 100);
  }
  assert.ok(selected, 'Original named summon must expose an actually visible disenchanter eye through native look');
  const scoped = await snapshot();
  assert.ok(scoped.semantic.scopes.some(s => s.context === 'target-detail' && s.widgets.some(p =>
    p.event.params.subject?.value.id === 'angband.look.subject.monster' &&
    p.event.params.subject.value.params.monster?.type === 'MonsterDescription')),
    'Visible original eye must expose its original owned MonsterDescription');
  await screen('03-original-visible-multi-eye'); await send(ESCAPE); await boundary();
  const [x, y] = selected.cursor, at = await snapshot();
  assert.ok(x >= 13 && x < at.frame.width && y > 0 && y < at.frame.height - 1);
  assert.equal(at.frame.cells[y * at.frame.width + x][0], 'e'.codePointAt(0), 'Original eye base glyph must remain e after leaving look');
  check('Original named summon/look identifies the actual stationary RF_ATTR_MULTI eye', selected);
  return { x, y };
}
async function animation() {
  // The original protection effect changes timed state only; it never assigns
  // HP. The eye is immobile, so its original visible cell can be followed.
  await originalTimedEffect('TIMED_INC', 'INVULN', 2000);
  const cell = await visibleOriginalEye();
  await cachedPurity('Visible original multihued monster');
  const saved = await checkpoint('original-multi-eye-before-turns');
  const frames = [], colors = new Set();
  for (let turn = 0; turn < 12; turn++) {
    const before = await boundary(); await send(',', 170);
    const after = await transition(`__angbandTest.state?.command && __angbandTest.state.turn>${before.state.turn}`);
    assert.ok(after.state.turn > before.state.turn, 'Original hold must spend a real game turn');
    const pixel = after.frame.cells[cell.y * after.frame.width + cell.x];
    assert.equal(pixel[0], 'e'.codePointAt(0), 'Original NEVER_MOVE eye must remain visible at its selected grid');
    assert.ok(pixel[1] >= 1 && pixel[1] < result.source.nativeConstants.basicColors,
      'Original ATTR_MULTI uses its source BASIC_COLORS-1, not a browser palette RNG');
    assert.ok(rngDelta(before.state.rng, after.state.rng).length > 0, 'Original turn must retain its native entropy transition');
    colors.add(pixel[1]); frames.push(after);
    result.actions.push({ route: 'original hold comma', index: turn, before: before.state, after: after.state, eyeCell: { ...cell, glyph: pixel[0], attr: pixel[1] } });
  }
  assert.ok(colors.size > 1, 'Twelve original EVENT_ANIMATE turns must show native multihued color variation');
  await screen('04-original-game-animation');
  await restore(saved);
  for (let turn = 0; turn < frames.length; turn++) {
    const before = await state(); await send(',', 170);
    const replay = await transition(`__angbandTest.state?.command && __angbandTest.state.turn>${before.turn}`);
    assert.deepEqual(replay, frames[turn], `Original animation/world turn ${turn} differs after exact v3 continuation`);
  }
  result.nativeAnimation = { race: 'disenchanter eye', sourceFlags: ['ATTR_MULTI', 'NEVER_MOVE'],
    originalEvent: 'EVENT_ANIMATE before process_monsters(player.energy+1)', turns: frames.length,
    visibleColors: [...colors], allTurnReplaysMatched: true, totalTurnRngAlsoIncludesMonsterAndWorld: true };
  check('Original EVENT_ANIMATE multihued cells and all38-word turn continuations replay exactly', result.nativeAnimation);
  await cachedPurity('After original game animation');
}

try {
  await mkdir(out, { recursive: true }); profile = await mkdtemp(join(out, 'profile-'));
  process.env.ANGBAND_PORT = String(port); ({ server } = await import('../web/server.mjs'));
  if (!server.listening) await once(server, 'listening');
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  browser.stderr.on('data', chunk => { browserOutput = (browserOutput + chunk).slice(-8192); });
  browser.on('error', error => { browserOutput += String(error); });
  const capturedBuild = await buildEvidence(), capturedSource = await sourceEvidence();
  result.engine = capturedBuild.manifest; result.engineManifestSha256 = capturedBuild.manifestSha256;
  result.engineHashes = capturedBuild.outputs; result.outputs = capturedBuild.outputs;
  result.engineCapturedAt = new Date().toISOString(); result.source = capturedSource;
  assert.ok(result.engine.replayIdentity, 'Perception fixture requires the production v3 build');
  let debugInfo;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { debugInfo = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); break; } catch {}
    await delay(150);
  }
  if (!debugInfo) throw new Error(`Browser startup failed: ${browserOutput}`);
  socket = new WebSocket(`ws://127.0.0.1:${debugInfo[0]}${debugInfo[1]}`); await once(socket, 'open');
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id); if (!entry) return;
      clearTimeout(entry.timer); pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') result.consoleErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  });
  const target = await call('Target.createTarget', { url: 'about:blank' }, false);
  session = (await call('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false)).sessionId;
  await call('Page.enable'); await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1050, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: `http://127.0.0.1:${port}/web/` }); await waitFor('window.__angbandTest?.ready');
  assert.equal(await evaluate('document.documentElement.lang'), 'ja');
  await freshTown(); await hallucination(); await animation();
  await evaluate('__angbandTest.inspectAdapters()'); const diagnostics = await waitFor('__angbandTest.diagnostics');
  assert.deepEqual(diagnostics, { domain: 0, objects: 0, stats: 0, replay: 0 });
  check('Perception fixture leaves every original semantic/replay adapter healthy', diagnostics);
  const sourceDiagnostics = await waitFor('__angbandTest.sourceDiagnostics');
  assert.deepEqual(sourceDiagnostics, { history: 0, chests: 0 });
  check('Original history and chest source captures remain healthy during the perception fixture', sourceDiagnostics);
  result.observedSemanticIds = [...seenIds].sort(); result.errors.push(...await evaluate('__angbandTest.errors'));
  assert.deepEqual(result.errors, []); assert.deepEqual(result.consoleErrors, []);
  assert.deepEqual(await buildEvidence(), capturedBuild, 'Engine artifacts changed during perception evidence');
  assert.deepEqual(await sourceEvidence(), capturedSource, 'Native source or game data changed during perception evidence');
  result.engineStableDuringRun = true; result.sourceStableDuringRun = true;
  result.engineVerifiedAt = new Date().toISOString(); result.passed = true; result.pass = true;
} catch (error) {
  result.passed = false; result.pass = false; result.errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error);
  if (socket && session) try {
    result.hostDiagnostics = await evaluate('({status:document.querySelector("#status")?.textContent,errors:window.__angbandTest?.errors,state:window.__angbandTest?.state,semantic:window.__angbandTest?.semantic,output:window.__angbandTest?.output})');
    await screen('failure');
  } catch (error) { result.errors.push(`Failure capture: ${error.message}`); }
} finally {
  result.finishedAt = new Date().toISOString();
  try {
    await mkdir(out, { recursive: true });
    await writeFile(join(out, 'results.json'), JSON.stringify(result, null, 2), 'utf8');
    await writeFile(join(evidenceRoot, 'results.json'), JSON.stringify(result, null, 2), 'utf8');
    await writeFile(join(out, 'errors.json'), JSON.stringify({ errors: result.errors, consoleErrors: result.consoleErrors }, null, 2), 'utf8');
  } catch (error) { process.exitCode = 1; console.error(`Evidence write: ${error.message}`); }
  if (socket?.readyState === WebSocket.OPEN) { try { await Promise.race([call('Browser.close', {}, false), delay(2000)]); } catch {} socket.close(); }
  for (const entry of pending.values()) clearTimeout(entry.timer); pending.clear();
  browser?.kill();
  if (browser && browser.exitCode === null && browser.signalCode === null) await Promise.race([once(browser, 'exit'), delay(2000)]);
  browser?.stdout.destroy(); browser?.stderr.destroy(); browser?.unref(); server?.closeAllConnections(); server?.close();
  if (profile && !resolve(profile).startsWith(`${resolve(out)}${sep}`)) throw new Error('Profile cleanup escaped this run directory');
  try { if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch (error) { console.warn(`Isolated profile cleanup: ${error.message}`); }
}
