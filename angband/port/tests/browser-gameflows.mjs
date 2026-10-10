/**
 * Additional original Angband gameplay, run ONLY by the parent's measured job.
 * node tests/browser-gameflows.mjs [--no-debug-fixtures]
 * No engine-memory writes, native save editing, invented money/items/winner
 * flags, or production browser profile. Default damage/death is explicitly an
 * original Ctrl-A/E DAMAGE debug-command fixture, separate from normal play.
 * Infrastructure/IndexedDB restoration follows browser-smoke.mjs.
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
const evidenceRoot = join(root, 'tests', 'browser-gameflow-evidence');
const run = new Date().toISOString().replace(/[:.]/g, '-');
const out = join(evidenceRoot, `run-${run}`);
const debugFixtures = !process.argv.includes('--no-debug-fixtures');
const port = Number(process.env.ANGBAND_GAMEFLOW_PORT || 4283);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const ENTER = 0x9c, ESCAPE = 0xe000;
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
const result = { startedAt: new Date().toISOString(), checks: [], frames: [], errors: [], consoleErrors: [], notRun: [],
  sourceContracts: ['ui-store.c store_menu_handle/store_purchase/store_sell', 'ui-options.c option_toggle_handle',
    'player-attack.c do_cmd_throw', 'ui-game.c original command keys', 'cmd-wizard.c do_cmd_wiz_perform_effect'],
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
async function send(key, ms = 180) { await evaluate(`__angbandTest.send(${JSON.stringify(key)},0)`); await delay(ms); }
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
  throw new Error('Native More paging exceeded16 pages');
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
async function quantityLimit(label) {
  await waitFor('__angbandTest.presentation.input_max_bytes===6 && __angbandTest.semantic.scopes.some(scope=>scope.context==="quantity-editor")');
  const before = await snapshot();
  const beforeErrors = await evaluate('__angbandTest.errors');
  await evaluate('document.querySelector("#game-text").value="1234567";document.querySelector("#game-text").dispatchEvent(new Event("input"));document.querySelector("#text-entry").requestSubmit()');
  await waitFor('document.querySelector("#status").dataset.error==="true" && document.querySelector("#game-text").value==="1234567"');
  await delay(200);
  const after = await snapshot();
  assert.equal(after.draft, '1234567', 'Rejected seven-byte quantity group must remain an opaque browser draft');
  assert.deepEqual(after.state, before.state, 'Rejected group must not alter native state or any RNG word');
  assert.deepEqual(after.frame, before.frame, 'Rejected group must not alter the native quantity-editor frame');
  assert.deepEqual(after.semantic, before.semantic, 'Rejected group must not alter the owned semantic widgets');
  assert.deepEqual(await evaluate('__angbandTest.errors'), beforeErrors, 'A validation rejection must not be a host/runtime error');
  assert.equal(await evaluate('__angbandTest.presentation.input_max_bytes'), 6);
  check(`Original six-byte quantity editor rejects a seven-byte group atomically (${label})`,
    { maximumBytes: 6, rejectedBytes: 7, before, after, status: await evaluate('document.querySelector("#status").textContent') });
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
function letterRows(native) {
  // ui-object.c show_obj_list() right-aligns at a computed column and
  // preserves the player sidebar to its left. ui-menu.c paints its native
  // selection tag at that column; it need not be the first text on the line.
  return native.split('\n').flatMap(line => {
    const match = line.match(/(^|\s)([a-zA-Z0-9])\)\s+(.*)$/);
    return match ? [{ key: match[2], description: match[3].trim(),
      column: match.index + match[1].length, line }] : [];
  });
}
function ration(native) {
  const row = letterRows(native).find(row => /\bRations? of Food\b/.test(row.description));
  assert.ok(row, `Native ration row absent:\n${native}`);
  const count = row.description.match(/(?:^|\s)(\d+)\s+Rations? of Food\b/);
  const quantity = count ? Number(count[1]) : 1;
  // Store rows show object_weight_one(); inventory/selection rows show
  // quantity * object_weight_one(). Both use the original tenths-of-a-lb field.
  const weight = row.description.match(/(?:^|\s)(\d+)\.(\d)\s+lb(?=\s|$)/);
  assert.ok(weight, `Native ration weight absent: ${row.line}`);
  assert.ok(Number.isInteger(quantity) && quantity > 0, 'Native ration quantity must be positive');
  return { ...row, quantity, weightTenths: Number(weight[1]) * 10 + Number(weight[2]) };
}
function gold(native) {
  const match = native.match(/Gold Remaining:\s*(\d+)/);
  assert.ok(match, `Original store gold field absent:\n${native}`);
  return Number(match[1]);
}
function quote(native) {
  const match = native.match(/Price:\s*(\d+)/);
  assert.ok(match, `Original confirmation price absent:\n${native}`);
  return Number(match[1]);
}
async function inventory() {
  await commandBoundary(); await send('i');
  await waitFor('__angbandTest.text().includes("Inven") || __angbandTest.semantic.scopes.some(scope=>scope.context==="inventory")');
  const native = await text();
  const packets = await evaluate('__angbandTest.semantic.scopes.filter(scope=>scope.context==="inventory").flatMap(scope=>scope.widgets)');
  const named = packets.filter(packet => packet.event.id === 'interface.items.row.name');
  assert.ok(named.length > 0, 'Inventory must expose actual owned naming projections');
  assert.ok(named.every(packet => packet.text && !packet.error && !/\[missing/i.test(packet.text)), 'Inventory naming projection has an explicit failure');
  assert.ok(named.every(packet => /[\u3040-\u30ff\u3400-\u9fff]/.test(packet.text)), 'Japanese default must render the actual starter item names in Japanese');
  await send(ESCAPE); await commandBoundary();
  return { native, ration: ration(native), rows: named };
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
  // ui-options.c commits the semantic scope before menu_select() paints
  // its native rows. Observe both views together, rather than consuming
  // the previous birth-stage frame as soon as the scope exists.
  const option = await waitFor(`(()=>{
    const native=__angbandTest.text();
    const row=native.split('\\n').find(line=>line.includes('(birth_no_selling)'));
    const scope=__angbandTest.semantic.scopes.find(scope=>scope.context==='birth-options');
    const widget=scope?.widgets.find(p=>p.event.params.option_key?.value==='birth_no_selling');
    return /^Birth options\\n/.test(native) && native.includes("Set option (y/n/t)") && row && widget
      ? {row,value:widget.event.params.value?.value.id} : false;
  })()`);
  const key = option.row.match(/^\s*([a-zA-Z])\)\s/);
  assert.ok(key, `Cannot identify original option-selection tag: ${option.row}`);
  // Each fresh worker starts with the original default: no selling.
  // Assert that default before either retaining it or enabling selling.
  assert.equal(option.value, 'birth.options.enabled');
  assert.match(option.row, /:\s*yes\s/);
  await send(key[1]); await send(noSelling ? 'y' : 'n');
  const expected = noSelling ? 'birth.options.enabled' : 'birth.options.disabled';
  await waitFor(`(()=>{
    const row=__angbandTest.text().split('\\n').find(line=>line.includes('(birth_no_selling)'));
    const scope=__angbandTest.semantic.scopes.find(scope=>scope.context==='birth-options');
    const widget=scope?.widgets.find(p=>p.event.params.option_key?.value==='birth_no_selling');
    return widget?.event.params.value?.value.id===${JSON.stringify(expected)} && row
      && /:\\s*${noSelling ? 'yes' : 'no'}\\s/.test(row);
  })()`);
  await send(ESCAPE);
  await waitFor('!__angbandTest.semantic.scopes.some(scope=>scope.context==="birth-options") && !/^Birth options\\n/.test(__angbandTest.text())');
}
async function freshMageTown(seed, noSelling, label) {
  generalStoreDoor = null;
  await evaluate(`__angbandTest.start(${seed},false)`);
  await waitFor('__angbandTest.running && __angbandTest.semantic.scopes.some(scope=>scope.context==="birth" && scope.widgets.some(p=>p.event.id==="birth.race.hint")) && /Please select your character traits/.test(__angbandTest.text()) && /Human/.test(__angbandTest.text())', 45000);
  await setSellingAtBirth(noSelling);
  let choseMage = false, named = false;
  for (let stage = 0; stage < 18; stage++) {
    if (await evaluate('__angbandTest.state?.hp>0 && __angbandTest.state.x>0 && __angbandTest.state.y>0 && __angbandTest.state.command')) break;
    const native = await text();
    if (/Enter a name for your character/.test(native)) { await submitLine(`Gameflow ${label} QA`); named = true; continue; }
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

const moves = [{ key: '8', dx: 0, dy: -1 }, { key: '2', dx: 0, dy: 1 }, { key: '4', dx: -1, dy: 0 },
  { key: '6', dx: 1, dy: 0 }, { key: '7', dx: -1, dy: -1 }, { key: '9', dx: 1, dy: -1 },
  { key: '1', dx: -1, dy: 1 }, { key: '3', dx: 1, dy: 1 }];
function visibleMap(frame, current) {
  const actors = frame.cells.flatMap((cell, index) => cell[0] === 64 ? [index] : []);
  assert.equal(actors.length, 1, 'Expected one original visible @ on the native town map');
  const actor = { x: actors[0] % frame.width, y: Math.floor(actors[0] / frame.width) };
  return { actor, offset: { x: current.x - actor.x, y: current.y - actor.y },
    width: frame.width, height: frame.height, cells: frame.cells };
}
function routeToStore(map) {
  const targets = map.cells.flatMap((cell, index) => cell[0] === 49 && index % map.width >= 13 && Math.floor(index / map.width) > 0 && Math.floor(index / map.width) < map.height - 1 ? [index] : []);
  assert.equal(targets.length, 1, 'Original General Store1 must be uniquely visible');
  const start = map.actor.y * map.width + map.actor.x, target = targets[0];
  const queue = [start], previous = new Map([[start, null]]);
  for (let index = 0; index < queue.length && !previous.has(target); index++) {
    const node = queue[index], x = node % map.width, y = Math.floor(node / map.width);
    for (const move of moves) {
      const nx = x + move.dx, ny = y + move.dy;
      if (nx < 13 || nx >= map.width || ny < 1 || ny >= map.height - 1) continue;
      const next = ny * map.width + nx, code = map.cells[next]?.[0];
      // Avoid NPCs, unknown squares, walls and OTHER shop doors. Every hop is
      // a currently visible native '.', ':' or the actual target digit1.
      if (previous.has(next) || ![46, 58, 49].includes(code)) continue;
      previous.set(next, { from: node, move }); queue.push(next);
    }
  }
  assert.ok(previous.has(target), 'No bounded visible floor route to General Store1');
  const path = [];
  for (let node = target; node !== start;) { const step = previous.get(node); path.push(step.move); node = step.from; }
  return path.reverse();
}
let generalStoreDoor = null;
async function enterGeneralStore(label) {
  const trace = [];
  for (let step = 0; step < 180; step++) {
    if (/Gold Remaining:/.test(await text())) {
      assert.match(await text(), /General Store|General store/);
      const at = await state();
      if (generalStoreDoor) assert.deepEqual({x:at.x,y:at.y}, generalStoreDoor, 'Original General Store must reopen at its previously verified door');
      else generalStoreDoor = {x:at.x,y:at.y};
      check(`Normal original commands enter General Store1 (${label})`, trace);
      return;
    }
    const before = await commandBoundary(); assert.equal(before.depth, 0); assert.ok(before.hp > 0);
    if (generalStoreDoor && before.x === generalStoreDoor.x && before.y === generalStoreDoor.y) {
      // Exiting leaves @ drawn over the verified shop digit. ui-game.c maps
      // ',' to CMD_HOLD; cmd-cave.c do_cmd_hold() reenters the current shop.
      assert.match((await text()).split('\n').at(-1), /General Store/, 'Native terrain status must confirm the previously verified store door');
      await send(',');
      await waitNative(/Gold Remaining:/);
      const after = await state();
      assert.deepEqual({x:after.x,y:after.y}, generalStoreDoor, 'Original store reentry must not move the player');
      assert.ok(after.hp > 0);
      trace.push({key:',', nativeCommand:'CMD_HOLD enters square_isshop', verifiedDoor:generalStoreDoor,
        before:{turn:before.turn,x:before.x,y:before.y,hp:before.hp}, after:{turn:after.turn,x:after.x,y:after.y,hp:after.hp}});
      continue;
    }
    const frame = await evaluate('__angbandTest.frame');
    const map = visibleMap(frame, before), path = routeToStore(map);
    assert.ok(path.length > 0, 'Store entry failed at its original door');
    const direction = path[0];
    await send(direction.key, 130); await acknowledgeMore();
    await waitFor(`__angbandTest.text().includes('Gold Remaining:') || (__angbandTest.state.command && __angbandTest.state.turn>${before.turn})`);
    const after = await state(); assert.ok(after.hp > 0, 'Player died while following the bounded normal town route');
    trace.push({ key: direction.key, before: { turn: before.turn, x: before.x, y: before.y, hp: before.hp },
      after: { turn: after.turn, x: after.x, y: after.y, hp: after.hp }, viewportOffset: map.offset });
    if (!/Gold Remaining:/.test(await text())) {
      assert.ok(Math.abs(after.x - before.x) <= 1 && Math.abs(after.y - before.y) <= 1, 'Native walking teleported');
    }
  }
  throw new Error('General Store route exceeded180 original movement commands');
}
async function leaveStore() { await send(ESCAPE); await commandBoundary(); }
async function shopFlow(town, noSelling, label) {
  await restore(town);
  const starting = await inventory();
  await enterGeneralStore(label);
  const shop = await screen(`${label}-general-store`);
  const selected = ration(shop);
  const price = selected.description.match(/\s+(\d+)\s*$/);
  assert.ok(price, `Cannot read original ration unit price: ${selected.line}`);
  const unitPrice = Number(price[1]), beforeGold = gold(shop);
  assert.equal(starting.ration.weightTenths, starting.ration.quantity * selected.weightTenths,
    'Native inventory stack weight must match original store unit weight');
  assert.ok(unitPrice > 0 && unitPrice <= beforeGold, 'Normal starting gold cannot afford the selected original ration');
  await send('l'); await waitFor('__angbandTest.text().includes("Examine which item")'); await send(selected.key);
  const info = await screen(`${label}-store-object-info`);
  assert.match(info, /Ration of Food|Rations of Food/);
  assert.match(info, /nourish|eaten|turns/i, 'Object-info must show a native effect/body description beyond the ration heading');
  assert.notEqual(info, shop, 'Original object-info modal did not open');
  check(`Original store object-info describes the selected ration (${label})`, info);
  await send(ESCAPE); await waitFor('__angbandTest.text().includes("Gold Remaining:")');
  await send('p'); await waitFor('__angbandTest.text().includes("Purchase which item")'); await send(selected.key);
  await waitNative(/Buy how many/);
  await quantityLimit(`${label}-buy`);
  await submitLine('1');
  await waitNative(/Buy .*\?/);
  assert.match(await text(), /Price:/);
  assert.equal(quote(await text()), unitPrice, 'Quantity1 purchase quote changed from its native unit price');
  await send('y'); await acknowledgeMore();
  await waitFor(`__angbandTest.text().includes('Gold Remaining:') && /Gold Remaining:\\s*${beforeGold - unitPrice}(?:\\s|$)/.test(__angbandTest.text())`);
  const afterBuyGold = gold(await text());
  await leaveStore();
  const bought = await inventory();
  assert.equal(bought.ration.quantity, starting.ration.quantity + 1);
  assert.equal(bought.ration.weightTenths, starting.ration.weightTenths + selected.weightTenths);
  check(`Normal p/${selected.key}/quantity1/y purchase changes actual gold and inventory (${label})`,
    { beforeGold, afterBuyGold, unitPrice, beforeItems: starting.ration.quantity, afterItems: bought.ration.quantity });
  await enterGeneralStore(`${label}-return`);
  const beforeReturnGold = gold(await text());
  await send('s');
  await waitFor(`__angbandTest.text().includes(${JSON.stringify(noSelling ? 'Give which item' : 'Sell which item')})`);
  const returnItem = ration(await text()); await send(returnItem.key);
  // store_sell calls get_quantity(NULL, obj->number), whose original UI
  // default is "Quantity", rather than the purchase-specific "Buy how many".
  await waitNative(/Quantity|How many|(?:Give|Sell) .*\?/i);
  if (/Quantity|How many/i.test(await text())) {
    await quantityLimit(`${label}-${noSelling ? 'give' : 'sell'}`);
    await submitLine('1');
  }
  await waitFor(`/${noSelling ? 'Give' : 'Sell'} .*\\?/.test(__angbandTest.text())`);
  const returnPrice = noSelling ? 0 : quote(await text());
  assert.ok(noSelling || returnPrice > 0, 'Selling-enabled native quote must pay positive gold for a ration');
  await send('y'); await acknowledgeMore();
  await waitFor(`__angbandTest.text().includes('Gold Remaining:') && /Gold Remaining:\\s*${beforeReturnGold + returnPrice}(?:\\s|$)/.test(__angbandTest.text())`);
  const afterReturnGold = gold(await text()); await leaveStore();
  const returned = await inventory();
  assert.equal(returned.ration.quantity, bought.ration.quantity - 1);
  assert.equal(returned.ration.weightTenths, bought.ration.weightTenths - selected.weightTenths);
  assert.equal(afterReturnGold, beforeReturnGold + returnPrice);
  check(`Normal ${noSelling ? 'donation preserves gold' : 'sale earns quoted gold'} and removes exactly one item (${label})`,
    { beforeGold: beforeReturnGold, afterGold: afterReturnGold, price: returnPrice, beforeItems: bought.ration.quantity, afterItems: returned.ration.quantity });
}
async function wieldUseCast(town) {
  await restore(town);
  const original = await inventory();
  await send('E'); await waitFor('/Eat which|Use which/.test(__angbandTest.text())');
  const food = ration(await text()), beforeEat = await state();
  await send(food.key); await commandBoundary();
  const eaten = await inventory(); assert.equal(eaten.ration.quantity, original.ration.quantity - 1);
  assert.ok((await state()).turn > beforeEat.turn);
  check('Original eat command consumes exactly one carried ration and game time', { before: original.ration.quantity, after: eaten.ration.quantity });
  await send('t');
  await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.context==="equipment" && scope.widgets.some(p=>p.event.id==="ui.residual.item.prompt.takeoff")) && /^Take off or unwield which item/.test(__angbandTest.text().trimStart()) && /[a-zA-Z]\\)\\s+Wielding\\s+/.test(__angbandTest.text())');
  const equipment = letterRows(await text());
  // show_equip() uses the source weapon-slot label "Wielding". The actual
  // Mage starter kit supplies a Rapier, so an invented weapon-name whitelist
  // would reject this original selection even though the slot is populated.
  const weapons = equipment.filter(row => /^Wielding\s+/.test(row.description));
  assert.equal(weapons.length, 1, 'Original takeoff selection must expose exactly one populated Wielding slot');
  const weapon = weapons[0];
  const withoutWeight = description => description.replace(/\s+\d+\.\d\s+lb\s*$/, '').trim();
  const weaponDescription = withoutWeight(weapon.description.replace(/^Wielding\s+/, ''));
  assert.ok(weaponDescription, 'Original Wielding slot has no object description');
  await send(weapon.key); await commandBoundary();
  const unequipped = await inventory();
  const carriedWeapons = letterRows(unequipped.native).filter(row => withoutWeight(row.description) === weaponDescription);
  assert.equal(carriedWeapons.length, 1, 'Original takeoff must put the same described weapon in inventory');
  const carriedWeapon = carriedWeapons[0];
  await send('w'); await waitFor('/^Wear or wield which item/.test(__angbandTest.text().trimStart())');
  await send(carriedWeapon.key); await commandBoundary();
  await send('e');
  await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.context==="equipment" && scope.widgets.some(p=>p.event.id==="interface.items.row.name")) && /[a-zA-Z]\\)\\s+Wielding\\s+/.test(__angbandTest.text())');
  const wielded = await screen('normal-wielded-equipment');
  const reequipped = letterRows(wielded).filter(row => /^Wielding\s+/.test(row.description));
  assert.equal(reequipped.length, 1);
  assert.equal(withoutWeight(reequipped[0].description.replace(/^Wielding\s+/, '')), weaponDescription,
    'Original wield must restore the same actual weapon to the Wielding slot');
  await send(ESCAPE); await commandBoundary(); check('Original takeoff and wield return the actual starter weapon to equipment',
    {weaponDescription,takeoffRow:weapon,inventoryRow:carriedWeapon,reequippedRow:reequipped[0],native:wielded});
  await send('G'); await delay(150);
  if (/Study which book|Select a book/i.test(await text())) {
    const book = letterRows(await text()).find(row => row.description.includes('[First Spells]'));
    assert.ok(book, 'Original Mage study selection lacks First Spells'); await send(book.key);
  }
  await waitFor('__angbandTest.text().includes("Magic Missile")');
  const study = letterRows(await text()).find(row => /Magic Missile/.test(row.description));
  assert.ok(study, 'Original learn menu has no selected Magic Missile tag');
  await send(study.key); await commandBoundary();
  const studied = await screen('normal-mage-study');
  assert.match(studied, /learned.*Magic Missile/i, 'Original study must report actual spell acquisition');
  check('Original Mage study learns a source-selected spell', studied);
  const beforeCast = await state();
  const sp = (await text()).match(/SP\s+(\d+)\s*\/\s*(\d+)/);
  assert.ok(sp && Number(sp[1]) > 0, 'Original Mage has no visible mana for cast');
  await send('m'); await delay(150);
  if (/Cast which book|Select a book/i.test(await text())) {
    const book = letterRows(await text()).find(row => row.description.includes('[First Spells]'));
    assert.ok(book, 'Original cast selection lacks the carried spellbook'); await send(book.key);
  }
  await waitFor('__angbandTest.text().includes("Magic Missile")');
  const cast = letterRows(await text()).find(row => /Magic Missile/.test(row.description));
  assert.ok(cast, 'Original cast selection lacks the learned spell'); await send(cast.key);
  await waitFor('/Direction/.test(__angbandTest.text())'); await send('8'); await commandBoundary();
  const afterCast = await state(), castNative = await screen('normal-mage-cast');
  const afterSp = castNative.match(/SP\s+(\d+)\s*\/\s*(\d+)/);
  assert.ok(afterSp && Number(afterSp[1]) < Number(sp[1]), 'Original cast attempt did not spend mana');
  assert.ok(afterCast.turn > beforeCast.turn); assert.notDeepEqual(afterCast.rng, beforeCast.rng);
  // Failure is a valid original RNG outcome; never call it a successful hit.
  check('Original learned cast attempt spends mana/time and uses original RNG',
    { before: beforeCast, after: afterCast, manaBefore: Number(sp[1]), manaAfter: Number(afterSp[1]), failedConcentration: /failed to concentrate/i.test(castNative) });
}
async function pendingThrow(town) {
  await restore(town);
  const beforeInventory = await inventory();
  await send('v'); await waitFor('__angbandTest.text().includes("Throw which item")');
  const food = ration(await text()); await send(food.key);
  await waitFor('/Direction/.test(__angbandTest.text()) && __angbandTest.state.command===false');
  await evaluate('document.querySelector("#game-text").value="方向待ちの下書き";document.querySelector("#game-text").dispatchEvent(new Event("input"))');
  await delay(150);
  const saved = await checkpoint('throw-direction-pending-v3');
  assert.equal(saved.at.state.command, false); assert.match(await text(), /Direction/);
  await screen('throw-direction-before-save');
  async function finish() {
    await evaluate('document.querySelector("#game-text").value="";document.querySelector("#game-text").dispatchEvent(new Event("input"))');
    const oldTurn = (await state()).turn; await send('8');
    await commandBoundary(); await waitFor(`__angbandTest.state.turn>${oldTurn}`);
    const afterThrow = await snapshot();
    await send(','); await commandBoundary();
    await waitFor(`__angbandTest.state.turn>${afterThrow.state.turn}`);
    const afterWait = await snapshot();
    const remaining = await inventory();
    assert.equal(remaining.ration.quantity, beforeInventory.ration.quantity - 1);
    return { afterThrow, afterWait, remaining: remaining.ration.quantity };
  }
  const live = await finish();
  await restore(saved, '__angbandTest.state?.command===false && /Direction/.test(__angbandTest.text())');
  await screen('throw-direction-after-resume');
  const resumed = await finish(); assert.deepEqual(resumed, live);
  check('V3 pending throw/direction restores full state/frame/source widgets/opaque draft and exact next inputs',
    { pending: saved.at, uninterrupted: live, resumed });
}
async function debugDamageDeath(town) {
  await restore(town);
  const commands = [];
  async function debugEffect(amount) {
    await send(1); commands.push('original Ctrl-A');
    await acknowledgeMore();
    await waitFor('/Debug Command/.test(__angbandTest.text())'); await send('E'); commands.push('original E');
    for (let warning = 0; warning < 4; warning++) {
      await acknowledgeMore();
      const native = await text();
      if (/Do which effect/.test(native)) break;
      assert.match(native, /sure|debug|cheat|really|scor/i, 'Unexpected original debug prerequisite');
      await send('y'); commands.push('original debug prerequisite confirmation y');
    }
    await waitFor('__angbandTest.text().includes("Do which effect")'); await submitLine('DAMAGE'); commands.push('effect DAMAGE');
    await waitFor('__angbandTest.text().includes("Enter damage dice")'); await submitLine(String(amount)); commands.push(`constant damage dice ${amount}`);
    for (const prompt of ['effect subtype', 'second parameter', 'third parameter', 'y parameter', 'x parameter']) {
      await waitFor(`__angbandTest.text().includes(${JSON.stringify(prompt)})`); await submitLine('0');
    }
    await acknowledgeMore();
  }
  const before = await state(); assert.ok(before.hp >= 3);
  await debugEffect(1); await commandBoundary(); const damaged = await state();
  assert.equal(damaged.hp, before.hp - 1, 'Original DAMAGE effect did not reduce actual HP by1');
  check('Explicit original debug-command fixture exercises real take_hit damage without HP assignment', { fixture: 'original_debug_command', before, damaged, commands });
  await debugEffect(damaged.maxhp + 100);
  for (let wait = 0; wait < 20; wait++) {
    await acknowledgeMore(); const native = await text();
    if (/Information|View scores|Tomb|R\.I\.P\./i.test(native) && /Messages|File dump|Examine items/i.test(native)) break;
    if (/Die\?|Really die/i.test(native)) { await send('y'); commands.push('original die confirmation y'); }
    else await delay(150);
  }
  await waitFor('__angbandTest.semantic.scopes.some(scope=>scope.widgets.some(p=>p.event.id==="interface.death.table.information")) || (["Information","Messages","File dump"].every(word=>__angbandTest.text().includes(word)))');
  const death = await screen('original-debug-damage-death');
  assert.match(death, /Gameflow donation QA/); assert.match(death, /Information|Messages|View scores/);
  await send('i');
  await waitFor('document.querySelector(".semantic-stats") && ["Age","Height","Weight"].every(word=>__angbandTest.text().includes(word)) && __angbandTest.semantic.scopes.some(scope=>scope.context==="character" && scope.widgets.some(p=>p.event.id==="player.sheet.name.value" && p.event.params.name?.value==="Gameflow donation QA"))');
  const info = await screen('original-death-information');
  assert.notEqual(info, death, 'Original death Information command must actually leave the tombstone/menu frame');
  assert.match(info, /Mage/); assert.match(info, /Race\s+Human/);
  assert.match(info, /Age/); assert.match(info, /Height/); assert.match(info, /Weight/);
  const fullName = 'Gameflow donation QA';
  // Original ui-player.c display_panel(): max top-left label length5 +2,
  // panel x1 gives column8. The later Age panel at column21 erases the
  // suffix, leaving exactly13 native ASCII cells without changing full_name.
  const nameValueColumn = 1 + 'Class'.length + 2, agePanelColumn = 21;
  const nativeNameRow = info.split('\n')[1];
  assert.equal(nativeNameRow.slice(1, 5), 'Name');
  const nativeNameField = nativeNameRow.slice(nameValueColumn, agePanelColumn);
  assert.equal(nativeNameField, fullName.slice(0, agePanelColumn - nameValueColumn),
    'Native character sheet must preserve the exact original overlapping-panel name prefix');
  assert.equal(nativeNameRow.slice(agePanelColumn, agePanelColumn + 3), 'Age');
  const semanticName = await evaluate('__angbandTest.semantic.scopes.find(scope=>scope.context==="character").widgets.find(p=>p.event.id==="player.sheet.name.value")');
  assert.equal(semanticName.event.params.name.type, 'character_name');
  assert.equal(semanticName.event.params.name.value, fullName, 'Owned opaque character name must remain full and unchanged');
  assert.equal(semanticName.text, fullName, 'Japanese rendering must preserve the full opaque character name');
  assert.ok(!semanticName.error);
  const nativeHp = info.match(/^\s*HP\s+(-?\d+)\/(\d+)/m), fatalState = await state();
  assert.ok(nativeHp && Number(nativeHp[1]) < 0, 'Actual death Information must show fatal original HP');
  assert.equal(Number(nativeHp[1]), fatalState.hp);
  assert.equal(Number(nativeHp[2]), fatalState.maxhp);
  await send(ESCAPE);
  check('Explicit original debug-command fatal damage reaches original death and information UI',
    { fixture: 'original_debug_command', commands, nativeDeath: death, information: info,
      nativeNameField, semanticName, fatalState,
      semanticScopes: await evaluate('__angbandTest.semantic.scopes.map(scope=>({context:scope.context,ids:scope.widgets.map(p=>p.event.id)}))') });
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
  const donationTown = await freshMageTown(123456, true, 'donation');
  await shopFlow(donationTown, true, 'donation');
  await wieldUseCast(donationTown);
  await pendingThrow(donationTown);
  const sellingTown = await freshMageTown(123457, false, 'selling');
  await shopFlow(sellingTown, false, 'selling');
  if (debugFixtures) await debugDamageDeath(donationTown);
  else result.notRun.push({ name: 'Original debug-command damage/death fixture', reason: 'Explicit --no-debug-fixtures argument; normal gameplay checks still required', passed: false });
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
