/**
 * SOURCE-AUTHORED wizard endgate fixture; parent runs the measured browser job.
 * Original commands only: TIMED_INC/INVULN protection, quest jumps 99/100,
 * native detection/target teleport, nearby banish/resummon and H projection.
 * No engine-memory writes, HP/money/winner assignments or synthetic quest flags.
 * BOTH Sauron and Morgoth must die through the original quest logic.
 * NOSCORE_DEBUG forbids ranked admission. This is not a 100-level normal campaign.
 * node tests/browser-victory.mjs
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
const evidenceRoot = join(root, 'tests', 'browser-victory-evidence');
const run = new Date().toISOString().replace(/[:.]/g, '-');
const out = join(evidenceRoot, `run-${run}`);
const port = Number(process.env.ANGBAND_VICTORY_PORT || 4284);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const ENTER = 0x9c, ESCAPE = 0xe000;
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
const result = { startedAt: new Date().toISOString(), checks: [], frames: [], errors: [], consoleErrors: [], notRun: [],
  sourceContracts: ['cmd-wizard.c original E/j/u/b/z/n/H', 'generate.c automatic quest placement',
    'mon-make.c uniqueness/deletion', 'player-quest.c all-quests winner gate', 'ui-death.c winner crown', 'score.c NOSCORE_DEBUG rejection'],
  outputDirectory: out };
let executable;
for (const candidate of [process.env.ANGBAND_CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean)) {
  try { await access(candidate); executable = candidate; break; } catch {}
}
if (!executable) throw new Error('Chrome or Edge executable not found');
let profile, server, browser;
let browserOutput = '', socket, session, sequence = 0;
const pending = new Map();

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
    await delay(100);
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}
async function send(key, ms = 120) { await evaluate(`__angbandTest.send(${JSON.stringify(key)},0)`); await delay(ms); await observe(); }
async function waitNative(pattern, timeout = 20000) {
  // Serializing RegExp source preserves escaped punctuation in CDP strings.
  return waitFor(`new RegExp(${JSON.stringify(pattern.source)},${JSON.stringify(pattern.flags)}).test(__angbandTest.text())`, timeout);
}
async function text() { return evaluate('__angbandTest.text()'); }
async function state() { return evaluate('__angbandTest.state'); }
async function screenshot(label) {
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(out, `${label}.png`), Buffer.from(shot.data, 'base64'));
}
async function screen(label) {
  const native = await text();
  const semantic = await evaluate('document.querySelector("#semantic-panels").textContent');
  result.frames.push({ label, native, semantic });
  await writeFile(join(out, `${label}.txt`), native, 'utf8');
  await screenshot(label);
  return native;
}
function check(name, evidence) { result.checks.push({ name, passed: true, evidence }); console.log(`PASS ${name}`); }
async function acknowledgeMore() {
  for (let page = 0; page < 16; page++) {
    if (!/-more-/i.test(await text())) return;
    await send(32, 200);
  }
  if (!/-more-/i.test(await text())) return;
  throw new Error('Native More paging exceeded 16 pages');
}
async function commandBoundary() {
  await acknowledgeMore();
  await waitFor('__angbandTest.running && __angbandTest.state?.command && __angbandTest.state.hp>0');
  return state();
}
async function submitLine(value) {
  // This is the ordinary browser text-entry input, not native-memory editing.
  await evaluate(`document.querySelector('#game-text').value=${JSON.stringify(String(value))};document.querySelector('#text-entry').requestSubmit()`);
  await delay(100);
  await send(ENTER);
}
async function buildEvidence() {
  const bytes = await readFile(join(root, 'build', 'manifest.json'));
  const manifest = JSON.parse(bytes.toString('utf8'));
  const outputs = [];
  for (const name of ['game.js', 'game.wasm', 'game.data']) {
    const hash = createHash('sha256'); let length = 0;
    for await (const chunk of createReadStream(join(root, 'build', name))) { hash.update(chunk); length += chunk.length; }
    const actual = { name, bytes: length, sha256: hash.digest('hex') };
    const expected = manifest.outputs.find(output => output.name === name);
    assert.ok(expected, `Manifest is missing ${name}`);
    assert.equal(actual.bytes, expected.bytes); assert.equal(actual.sha256, expected.sha256);
    outputs.push(actual);
  }
  return { manifest, manifestSha256: createHash('sha256').update(bytes).digest('hex'), outputs };
}
async function snapshot() {
  return evaluate('({state:__angbandTest.state,frame:__angbandTest.frame,semantic:__angbandTest.semantic,draft:document.querySelector("#game-text").value})');
}
async function checkpoint(label) {
  const previous = await evaluate('__angbandTest.saveRecord?.savedAt || null');
  await evaluate('__angbandTest.save()');
  await waitFor(`__angbandTest.saveRecord && __angbandTest.saveRecord.savedAt!==${JSON.stringify(previous)}`, 45000);
  const json = await evaluate('__angbandTest.exportSave()');
  assert.equal(Buffer.from(JSON.parse(json).payload, 'base64').readUInt16LE(8), 3, 'This flow requires exact v3 continuation');
  const at = await snapshot();
  await writeFile(join(out, `${label}.json`), json, 'utf8');
  return { json, at };
}
async function restore(saved, expression = '__angbandTest.state?.command && __angbandTest.state.hp>0') {
  // Exact import/write/reload procedure from browser-smoke.mjs. It changes
  // only this isolated profile's IndexedDB record, never the live C state.
  await evaluate(`(async()=>{const storage=await import('./storage.js');const db=await storage.openSaveDatabase();try{await storage.writeSave(db,storage.importRecord(${JSON.stringify(saved.json)}));}finally{db.close();}})()`);
  await call('Page.reload');
  await waitFor('window.__angbandTest?.ready && window.__angbandTest.saveRecord');
  await evaluate('__angbandTest.start(__angbandTest.saveRecord.seed,true)');
  await waitFor(`__angbandTest.running && (${expression})`, 60000);
  const actual = await snapshot();
  assert.deepEqual(actual, saved.at, 'Restored state/frame/source widgets/draft differs from exact checkpoint');
  return actual;
}
async function setSellingAtBirth(noSelling) {
  await send('=');
  await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.context==="birth-options")');
  const native = await text();
  const row = native.split('\n').find(line => line.includes('(birth_no_selling)'));
  assert.ok(row, 'Original birth_no_selling option is not visible');
  const key = row.match(/^\s*([a-zA-Z])\)\s/);
  assert.ok(key, `Cannot identify original option-selection tag: ${row}`);
  await send(key[1]); await send(noSelling ? 'y' : 'n');
  await waitFor(`__angbandTest.semantic.scopes.some(scope=>scope.context==='birth-options' && scope.widgets.some(p=>p.event.params.option_key?.value==='birth_no_selling' && p.event.params.value?.value.id===${JSON.stringify(noSelling ? 'birth.options.enabled' : 'birth.options.disabled')}))`);
  assert.match((await text()).split('\n').find(line => line.includes('(birth_no_selling)')), noSelling ? /:\s*yes\s/ : /:\s*no\s/);
  await send(ESCAPE);
  await waitFor('!__angbandTest.semantic.scopes.some(scope=>scope.context==="birth-options")');
}
async function freshMageTown(seed, noSelling, label) {
  await evaluate(`__angbandTest.start(${seed},false)`);
  await waitFor('__angbandTest.running && __angbandTest.frame?.cells.some(cell=>cell[0]!==32)', 45000);
  await setSellingAtBirth(noSelling);
  let choseMage = false, named = false;
  for (let stage = 0; stage < 18; stage++) {
    if (await evaluate('__angbandTest.state?.hp>0 && __angbandTest.state.x>0 && __angbandTest.state.y>0 && __angbandTest.state.command')) break;
    const native = await text();
    if (/Enter a name for your character/.test(native)) { await submitLine("Wizard Victory QA"); named = true; continue; }
    // Same original race/default-class stages as the accepted smoke flow:
    // choose Human then one keypad-down from Warrior to Mage, then Enter.
    if (stage === 1 && !choseMage) { await send('2'); choseMage = true; }
    await send(ENTER, 300);
  }
  await send(ESCAPE); await send(ESCAPE); await commandBoundary();
  const current = await state();
  assert.equal(current.depth, 0); assert.ok(current.hp > 0 && current.x > 0 && current.y > 0);
  assert.equal(current.rng.length, 38); assert.ok(choseMage && named);
  assert.match(await text(), /Mage/);
  const saved = await checkpoint(`${label}-fresh-town`);
  await restore(saved);
  check(`Fresh normal Mage town ${label} checkpoint restores exactly`, { state: saved.at.state, noSelling });
  return saved;
}

const winningIds = [
  "game.message.player_quest.quest_check.congratulations",
  "game.message.player_quest.quest_check.you_have_won_the_game",
  "game.message.player_quest.quest_check.you_may_retire_key_is_shift_q_when_you"
];
const seenIds = new Set();
let noScoreText = null, targetKeys = 0;
const MAX_TARGET_KEYS = 10000;
async function observe(label = "") {
  const item = await evaluate('({state:__angbandTest.state,native:__angbandTest.text(),cursor:__angbandTest.frame?.cursor,ids:__angbandTest.messageIds,widgetIds:__angbandTest.semantic.scopes.flatMap(scope=>scope.widgets.map(p=>p.event.id)),messageIds:__angbandTest.semantic.messages.map(p=>p.event.id)})');
  // Source-bound AB_STATIC_MSG uses typed message packets, independent of
  // the legacy message_ids list. Observe both owned histories and UI facts.
  for (const id of [...(item.ids || []), ...(item.messageIds || []), ...(item.widgetIds || [])]) if (typeof id === "string") seenIds.add(id);
  if (item.native.includes("Score not registered for wizards.")) noScoreText = item.native;
  const trace = { label, turn: item.state?.turn, depth: item.state?.depth, hp: item.state?.hp,
    x: item.state?.x, y: item.state?.y, cursor: item.cursor, top: item.native.split("\n").slice(0, 2).join("\n") };
  result.timeline ??= [];
  if (result.timeline.length < 4096) result.timeline.push(trace);
  else result.timelineTruncated = true;
  return item;
}
async function debug(key, expected = null) {
  await commandBoundary();
  await send(1, 120); await waitNative(/Debug Command:/);
  await send(key, 180);
  result.debugCommands ??= [];
  result.debugCommands.push({ key, label: "original Ctrl-A/" + key });
  for (let warning = 0; warning < 4; warning++) {
    await acknowledgeMore();
    const native = await text();
    if ((expected && expected.test(native)) || (await state())?.command) break;
    assert.match(native, /debug|cheat|sure|really|scor/i, "Unexpected original debug prerequisite");
    await send("y", 180);
  }
  if (expected) await waitNative(expected);
  else await commandBoundary();
}
async function originalInvulnerability() {
  const before = await state();
  await debug("E", /Do which effect/);
  await submitLine("TIMED_INC");
  await waitNative(/Enter damage dice/); await submitLine("99999");
  await waitNative(/effect subtype/); await submitLine("INVULN");
  for (const prompt of ["second parameter", "third parameter", "y parameter", "x parameter"]) {
    await waitFor('__angbandTest.text().includes(' + JSON.stringify(prompt) + ')');
    await submitLine("0");
  }
  await commandBoundary();
  const native = await screen("wizard-original-invulnerability");
  assert.match(native, /invulnerable|Invuln/i, "Original timed effect did not disclose invulnerability");
  assert.equal((await state()).hp, before.hp, "Fixture protection must not assign or heal HP");
  check("Explicit original effect-command fixture grants timed invulnerability without HP/money/winner writes",
    { fixture: "wizard_debug_commands", effect: "TIMED_INC", subtype: "INVULN", native });
}
async function jump(depth) {
  await debug("j", /Jump to level/); await submitLine(String(depth));
  await waitNative(/Choose cave profile/); await send("n", 180);
  await acknowledgeMore();
  await waitFor('__angbandTest.state?.command && __angbandTest.state.depth===' + depth + ' && __angbandTest.state.hp>0', 60000);
  assert.equal((await state()).depth, depth);
  await screen("wizard-original-jump-" + depth);
  check("Original debug jump generates actual quest dungeon level " + depth, await state());
}
async function targetKey(key, delayMs = 35) {
  if (++targetKeys > MAX_TARGET_KEYS) throw new Error("Native target search exceeded " + MAX_TARGET_KEYS + " original keys");
  await send(key, delayMs);
}
async function targetActive() {
  await waitFor('__angbandTest.running && __angbandTest.state.command===false');
  await waitNative(/Press '\?' for help\./);
}
async function inspectCurrentPanel(name) {
  const signatures = new Set();
  const maximum = (await evaluate('__angbandTest.frame.width*__angbandTest.frame.height')) + 1;
  for (let index = 0; index < maximum; index++) {
    const item = await observe("native-target-inspection");
    const header = item.native.split("\n")[0];
    // Native ui-target.c aux_reinit emits "You sense " for an obvious
    // living monster detected outside currently seen grids. Whole-level
    // Ctrl-A/u intentionally exposes that form; it is a valid boss location,
    // and Ctrl-A/b switches to free-location mode before selecting it.
    // Require an actual native observation prefix and the selected race name.
    if (header.includes(name) && /^You (?:see|sense|are on) /.test(header)) return item;
    const signature = JSON.stringify({ cursor: item.cursor, header });
    if (signatures.has(signature)) return null; // Completed this original cyclic panel list.
    signatures.add(signature);
    await targetKey("+", 70);
  }
  throw new Error("Native interesting-grid cycle failed to wrap within one screen's grid bound");
}
async function locateExistingQuestBoss(name, depth) {
  await debug("u"); // Original detection covers the whole dungeon (500x500).
  await debug("b", /Press '\?' for help\./);
  await targetActive();
  let found = await inspectCurrentPanel(name);
  const player = await state();
  // Official dungeon bounds are 198x66 (constants.txt); normal 100x32 ASCII
  // target view is 86x30, with 43x15 pan steps (ui-term/ui-target.c). Native
  // offsets can retain a far-edge phase. Move through interior (1,1) before
  // each sample so its origin is 0 or 1; the following three samples per axis
  // then overlap and include BOTH edges. Smaller profiles clamp natively.
  // Coordinates drive ONLY original cursor keys, never C state writes.
  const panels = [];
  for (const y of [1, 35, 64]) for (const x of [1, 100, 196]) panels.push({ x, y });
  for (const panel of panels) {
    if (found) break;
    // Native p verifies the panel but does not rebuild targets by itself.
    // Restart this original command so each viewport sweep owns a fresh
    // target list, including when recentering leaves the panel unchanged.
    await targetKey(ESCAPE, 120); await commandBoundary();
    await debug("b", /Press '\?' for help\./); await targetActive();
    await targetKey("p", 100); // Native p recenters on player AND selects free mode.
    for (let index = 1; index < player.x; index++) await targetKey("4", 20);
    for (let index = 1; index < player.y; index++) await targetKey("8", 20);
    for (let index = 1; index < panel.x; index++) await targetKey("6", 20);
    for (let index = 1; index < panel.y; index++) await targetKey("2", 20);
    await targetKey("m", 100); // Native m selects this viewport's interesting grids.
    found = await inspectCurrentPanel(name);
  }
  assert.ok(found, "Original detected quest boss not found by bounded native target panels: " + name);
  assert.equal((await state()).depth, depth);
  await screen("wizard-existing-boss-" + depth);
  const before = await state();
  // Interesting mode refuses a monster target outside projectable LOS.
  // Original o keeps the selected boss grid but chooses free-location mode;
  // t then selects that location for the native teleport command.
  await targetKey("o", 120); await targetKey("t", 200);
  await commandBoundary();
  const after = await state();
  assert.equal(after.depth, depth); assert.ok(after.hp > 0);
  check("Original detect/target/location teleport reaches the existing quest boss at level " + depth,
    { name, before, after, selectedNativeHeader: found.native.split("\n")[0], originalTargetKeys: targetKeys });
}
async function lookForNearbyBoss(name) {
  await commandBoundary(); await send("l", 150); await targetActive();
  const found = await inspectCurrentPanel(name);
  await targetKey(ESCAPE, 150); await commandBoundary();
  return found;
}
async function resummonNativeBoss(name, depth) {
  await locateExistingQuestBoss(name, depth);
  await debug("z", /Zap within what distance/); await submitLine("20"); await commandBoundary();
  const afterDeletion = await lookForNearbyBoss(name);
  assert.equal(afterDeletion, null, "Original nearby banish did not remove the selected boss");
  // Native z decrements cur_num without monster_death/quest_check. Original
  // level generation had already placed the unique, so this deletion must
  // precede n; never treat a failed duplicate summon as successful placement.
  const oldFailureIds = new Set(seenIds);
  await debug("n", /Summon which monster/); await submitLine(name);
  await commandBoundary();
  const native = await text();
  assert.doesNotMatch(native, /No monster found\.|Could not place monster\./);
  for (const id of ["game.message.cmd_wizard.wiz_summon_named.no_monster_found",
    "game.message.cmd_wizard.wiz_summon_named.could_not_place_monster"]) {
    assert.ok(oldFailureIds.has(id) || !seenIds.has(id), "Original named summon reported a failure");
  }
  const placed = await lookForNearbyBoss(name);
  assert.ok(placed, "Original named summon did not expose the selected living boss in the nearby native look UI");
  await screen("wizard-resummoned-boss-" + depth);
  check("Original nearby banish and named summon place the actual still-unfinished quest boss at level " + depth,
    { name, selectedNativeHeader: placed.native.split("\n")[0], noDirectNativeWrites: true });
}
async function killNativeBoss(name, depth) {
  await resummonNativeBoss(name, depth);
  const hits = [];
  for (let hit = 1; hit <= 8; hit++) {
    const before = await state();
    await debug("H"); // Original 10000 PROJECT_LOS/DISP_ALL, no second RNG roll.
    const reaction = await observe("native-H-reaction");
    await acknowledgeMore();
    const visible = await lookForNearbyBoss(name);
    hits.push({ hit, before, after: await state(), nativeReaction: reaction.native, remainsInNearbyLook: Boolean(visible) });
    if (!visible) break;
  }
  assert.ok(hits.length > 0 && hits.at(-1).remainsInNearbyLook === false, "Original H did not finish the selected boss within 8 hits");
  await screen("wizard-after-boss-" + depth);
  check("Original H projection removes the source-selected quest boss at level " + depth,
    { name, originalDamagePerProjection: 10000, hits,
      deathProofBoundary: "Final winner branch additionally proves BOTH original quests completed; absence alone is not that proof." });
  return hits;
}
async function retireOriginalWinner() {
  for (const id of winningIds) assert.ok(seenIds.has(id), "Original all-quests winner branch omitted semantic ID " + id);
  const before = await screen("wizard-original-all-quests-winner");
  await send("Q", 180); await waitNative(/Do you want to retire\?/);
  await screen("wizard-original-retire-confirmation");
  await send("y", 250);
  let crown = null;
  for (let step = 0; step < 48; step++) {
    const item = await observe("retirement-transition");
    if (item.native.includes("All Hail the Mighty Champion!")) { crown = item.native; break; }
    if (/-more-/i.test(item.native)) await send(32, 200);
    else await delay(100);
  }
  assert.ok(crown, "Original total-winner-only crown did not appear");
  await screen("wizard-original-victory-crown");
  assert.ok(seenIds.has("interface.death.display_winner.all_hail_the_mighty_champion"), "Crown lacks its actual source-bound semantic fact");
  // display_winner flushes input before pause_line. Submit a FRESH key only
  // after observing/capturing its crown wait, never a prefabricated queue.
  await send(32, 250); await acknowledgeMore();
  await waitFor('__angbandTest.text().includes("Magnificent") && __angbandTest.text().includes("Ripe Old Age") && __angbandTest.text().includes("View scores")');
  const tomb = await screen("wizard-original-winner-retirement-menu");
  assert.match(tomb, /Wizard Victory QA/); assert.match(tomb, /Magnificent/);
  assert.match(tomb, /Killed on Level 0/); assert.match(tomb, /by Ripe Old Age\./);
  const award = tomb.match(/AU:\s*(\d+)/); assert.ok(award && Number(award[1]) >= 10000000, "Original winner retirement reward is absent");
  assert.ok(seenIds.has("interface.death.display_exit_screen.magnificent"));
  assert.ok(noScoreText, "Original NOSCORE_DEBUG score-registration rejection was not observed");
  check("Explicit wizard fixture completes both real quests and reaches original winner crown/retirement",
    { fixture: "wizard_debug_commands", normalCampaignCompletion: false, winningIds,
      nativeBeforeRetirement: before, nativeCrown: crown, nativeRetirement: tomb, originalWinnerGold: Number(award[1]) });
  check("Original score registry rejects this debug fixture instead of fabricating ranked score admission",
    { fixture: "wizard_debug_commands", scoreEligible: false, nativeScoreRejection: noScoreText,
      sourceGate: "score.c: NOSCORE_WIZARD|NOSCORE_DEBUG returns before highscore_add/write" });
}

try {
  // Keep profile/server/browser allocation inside the owning finally block.
  await mkdir(out, { recursive: true });
  profile = await mkdtemp(join(out, 'profile-'));
  process.env.ANGBAND_PORT = String(port);
  ({ server } = await import('../web/server.mjs'));
  if (!server.listening) await once(server, 'listening');
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  browser.stderr.on('data', chunk => { browserOutput = (browserOutput + chunk).slice(-8192); });
  browser.on('error', error => { browserOutput += String(error); });
  const capturedBuild = await buildEvidence();
  result.engine = capturedBuild.manifest;
  result.engineManifestSha256 = capturedBuild.manifestSha256;
  result.engineHashes = capturedBuild.outputs;
  result.outputs = capturedBuild.outputs;
  result.engineCapturedAt = new Date().toISOString();
  assert.ok(result.engine.replayIdentity, 'Additional flows require the v3 production build');
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

  result.fixture = "wizard_debug_commands";
  result.normalCampaignCompletion = false;
  result.scoreEligible = false;
  result.sourceCommit = "f3082213b73f3e463e3d0d60bff4b00462beae6e";
  const town = await freshMageTown(123458, true, "wizard");
  await restore(town); await observe("fresh-town");
  await originalInvulnerability();
  await jump(99);
  result.sauronHits = await killNativeBoss("Sauron, the Sorcerer", 99);
  assert.ok(!seenIds.has(winningIds[1]), "Sauron-only fixture must not claim total victory while Morgoth's quest remains");
  await jump(100);
  result.morgothHits = await killNativeBoss("Morgoth, Lord of Darkness", 100);
  await observe("both-quest-completion");
  await retireOriginalWinner();
  result.observedSemanticIds = [...seenIds].sort();
  await evaluate('__angbandTest.inspectAdapters()');
  const diagnostics = await waitFor('__angbandTest.diagnostics');
  assert.deepEqual(diagnostics, { domain: 0, objects: 0, stats: 0, replay: 0 });
  check('Additional original flows leave every native semantic/replay adapter healthy', diagnostics);
  result.errors.push(...await evaluate('__angbandTest.errors'));
  assert.deepEqual(result.errors, []); assert.deepEqual(result.consoleErrors, []);
  assert.deepEqual(await buildEvidence(), capturedBuild, 'Engine artifacts changed while additional browser evidence was captured');
  result.engineStableDuringRun = true; result.engineVerifiedAt = new Date().toISOString(); result.passed = true; result.pass = true;
} catch (error) {
  result.passed = false; result.pass = false; result.errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error);
  if (socket && session) try {
    result.hostDiagnostics = await evaluate('({status:document.querySelector("#status")?.textContent,errors:window.__angbandTest?.errors,state:window.__angbandTest?.state,semantic:window.__angbandTest?.semantic,output:window.__angbandTest?.output,save:window.__angbandTest?.saveRecord})');
    await screen('failure');
  } catch (diagnosticError) { result.errors.push(`Failure capture: ${diagnosticError.message}`); }
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
  // Only this run's generated profile: never sweep other runs or user's data.
  if (profile && !resolve(profile).startsWith(`${resolve(out)}${sep}`)) throw new Error('Profile cleanup escaped this run directory');
  try { if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch (error) { console.warn(`Isolated profile cleanup: ${error.message}`); }
}
