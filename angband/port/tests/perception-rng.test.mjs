import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const base = new URL('../', import.meta.url);
const bytes = async path => readFile(new URL(path, base));
const source = async path => (await bytes(path)).toString('utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const audit = JSON.parse(await source('migration/perception-rng-boundary.json'));
function body(text, name) {
  // Match a real declaration rather than a function name in a preceding
  // source comment. Braces inside strings/comments are not C block braces.
  const match = new RegExp(`^[ \\t]*[A-Za-z_][\\w \\t*]*?\\b${name}\\s*\\([^;{}]*\\)\\s*\\{`, 'm').exec(text);
  assert.ok(match, `Function is absent: ${name}`);
  const start = match.index + match[0].indexOf(name), opening = match.index + match[0].length - 1;
  let depth = 1, quote = null, block = false, line = false;
  for (let cursor = opening + 1; cursor < text.length; cursor++) {
    const c = text[cursor], next = text[cursor + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && next === '/') { block = false; cursor++; } continue; }
    if (quote) { if (c === '\\') cursor++; else if (c === quote) quote = null; continue; }
    if (c === '/' && next === '/') { line = true; cursor++; continue; }
    if (c === '/' && next === '*') { block = true; cursor++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return text.slice(start, cursor + 1);
  }
  assert.fail(`Unclosed audited function: ${name}`);
}
function ordered(text, fragments) {
  let cursor = 0;
  for (const fragment of fragments) { const next = text.indexOf(fragment, cursor); assert.ok(next >= cursor, `Missing or reordered: ${fragment}`); cursor = next + fragment.length; }
}

test('Native map/perception macros retain exact pristine upstream bytes and generator bodies', async () => {
  assert.equal(audit.upstream.commit, 'f3082213b73f3e463e3d0d60bff4b00462beae6e');
  assert.equal(audit.pristineSources.length, 3);
  for (const record of audit.pristineSources) { const actual = await bytes(record.path); assert.equal(actual.length, record.bytes); assert.equal(sha256(actual), record.sha256); assert.equal(record.pristineUpstreamBytesEqual, true); }
  const native = (await source(audit.pristineGeneratorBodies.path)).replace(/\r\n/g, '\n');
  assert.equal(audit.pristineGeneratorBodies.wholeFilePristine, false);
  for (const record of audit.pristineGeneratorBodies.bodies) assert.equal(sha256(body(native, record.function)), record.sha256);
});

test('Hallucination checks preserve shared stream, short circuit, permanent-wall ordering and rejection loops', async () => {
  const header = await source('logic/z-rand.h'), native = await source('logic/z-rand.c');
  assert.match(header, /#define randint0\(M\) \(\(int32_t\) Rand_div\(M\)\)/);
  assert.match(header, /#define randint1\(M\) \(\(int32_t\) Rand_div\(M\) \+ 1\)/);
  assert.match(header, /#define one_in_\(x\) \(!randint0\(x\)\)/);
  const random = body(native, 'Rand_div');
  ordered(random, ['if (Rand_quick)', 'Rand_value = LCRNG(Rand_value)', 'if (r < m) break;', 'WELLRNG1024a()', 'if (r < m) break;']);
  const map = body(await source('logic/cave-map.c'), 'map_info');
  assert.match(map, /g->hallucinate && g->m_idx == 0 && g->first_kind == 0/);
  ordered(map, ['if (one_in_(128) && (int) g->f_idx != FEAT_PERM)', 'g->m_idx = 1;', 'else if (one_in_(128) && (int) g->f_idx != FEAT_PERM)', 'g->first_kind = k_info;', 'g->hallucinate = false;']);
  const ui = await source('logic/ui-map.c');
  const monster = body(ui, 'hallucinatory_monster'), object = body(ui, 'hallucinatory_object');
  ordered(monster, ['while (1)', 'randint0(z_info->r_max)', 'if (!race->name) continue;', '*a = monster_x_attr[race->ridx]', '*c = monster_x_char[race->ridx]', 'return;']);
  ordered(object, ['while (1)', 'randint0(z_info->k_max - 1) + 1', 'if (!kind->name) continue;', '*a = kind_x_attr[kind->kidx]', '*c = kind_x_char[kind->kidx]', 'if (*a == 0 || *c == 0) continue;', 'return;']);
  for (const audited of [map, monster, object]) assert.doesNotMatch(audited, /Rand_simple|Rand_quick\s*=|Rand_value\s*=|snapshot_rng|restore.*rng/i);
});

test('Native map events select perception in original order and do not become immutable queries', async () => {
  const cave = await source('logic/cave-map.c'), ui = await source('logic/ui-map.c'), display = await source('logic/ui-display.c');
  assert.match(body(cave, 'square_light_spot'), /event_signal_point\(EVENT_MAP, grid\.x, grid\.y\)/);
  const update = body(display, 'update_maps');
  ordered(update, ['if (data->point.x == -1 && data->point.y == -1)', 'prt_map();', 'map_info(data->point, &g);', 'grid_data_as_text(&g, &a, &c, &ta, &tc);', 'Term_queue_char(t, vx, vy, a, c, ta, tc);', 'Term_fresh();']);
  assert.match(display, /event_add_handler\(EVENT_MAP, update_maps, angband_term\[0\]\)/);
  const grid = body(ui, 'grid_data_as_text');
  ordered(grid, ['hallucinatory_object(&a, &c)', 'hallucinatory_monster(&a, &c)', 'mon->attr = a;']);
  const map = body(ui, 'display_map');
  assert.ok((map.match(/grid_data_as_text\(&g, &a, &c, &ta, &tc\)/g) || []).length >= 3, 'Minimap traversal includes original repeated perception selection');
});

test('Native animation is shared-stream stateful and remains before each higher-energy monster pass', async () => {
  const display = await source('logic/ui-display.c'), world = await source('logic/game-world.c');
  const animation = body(display, 'do_animation');
  ordered(animation, ['!monster_is_visible(mon)', 'RF_ATTR_MULTI', 'randint1(BASIC_COLORS - 1)', 'RF_ATTR_FLICKER', 'mon->attr = attr;', 'PR_MAP | PR_MONLIST', 'flicker++;']);
  assert.match(body(display, 'animate'), /do_animation\(\)/);
  assert.match(display, /event_add_handler\(EVENT_ANIMATE, animate, NULL\)/);
  assert.equal((body(world, 'run_game_loop').match(/event_signal\(EVENT_ANIMATE\);\s*\/\* Process monster with even more energy first \*\/\s*process_monsters\(player->energy \+ 1\)/g) || []).length, 2);
  assert.match(world, /if \(player->timed\[TMD_IMAGE\]\)\s*player->upkeep->redraw \|= \(PR_MAP\)/);
});

test('Browser native wait observes all 38 RNG words and adds no elapsed-idle animation', async () => {
  const native = await source('logic/main-web.c');
  assert.match(native, /_Static_assert\(RAND_DEG == 32/);
  ordered(body(native, 'snapshot_rng'), ['out[0] = (uint32_t)Rand_quick;', 'out[1] = Rand_value;', 'out[2] = state_i;', 'out[3] = z0;', 'out[4] = z1;', 'out[5] = z2;', 'out[6 + i] = STATE[i];']);
  assert.match(body(native, 'observe_wait'), /snapshot_rng\(out \+ 16\)/);
  ordered(body(native, 'web_xtra'), ['case TERM_XTRA_EVENT:', 'emit_state();', 'observe_wait(observed, v);', 'ab_rs_replay_wait', 'process_save();', 'ab_host_event', 'emscripten_sleep(16)', 'dispatch_event(words)', 'ab_rs_replay_commit']);
  assert.doesNotMatch(native, /\bidle_update\s*\(|\bdo_animation\s*\(|\bmap_info\s*\(|\bgrid_data_as_text\s*\(/);
  assert.match(native, /browser_term\.never_bored = true/);
  const desktop = await source('logic/main-gcu.c'); assert.match(desktop, /idle_update\(\)/);
});

test('Cached browser draw/font/viewport/locale boundaries cannot request native perception', async () => {
  const app = await source('web/app.js'), core = await source('web/core.js'), worker = await source('web/worker.js');
  const paint = core.slice(core.indexOf('export function drawFrame('), core.indexOf('export function interpolate('));
  assert.match(paint, /frame\.cells/); assert.match(paint, /ctx\.fillText/);
  assert.doesNotMatch(paint, /postMessage|worker|ccall|ab_|Math\.random|randint|map_info|grid_data_as_text/);
  const redraw = app.slice(app.indexOf('function redraw()'), app.indexOf('function send('));
  assert.match(redraw, /drawFrame\(canvas, latestFrame/); assert.doesNotMatch(redraw, /postMessage|send\(|resize\(/);
  assert.match(app, /\$\('font-size'\)\.addEventListener\('change', redraw\)/);
  assert.match(app, /window\.addEventListener\('resize', redraw\)/);
  const locale = worker.slice(worker.lastIndexOf("if (type === 'locale')"));
  assert.ok(locale.length > 0, 'Worker locale branch must be found');
  assert.match(locale, /ab_rs_set_locale/); assert.match(locale, /ab_rs_present_locale/);
  assert.doesNotMatch(locale, /pendingEvents\.push|ab_run|TERM_XTRA|map_info|grid_data_as_text/);
});

test('Terminal resize and browser CSS resize remain separate, and v3 save does not call native draw/writer', async () => {
  const native = await source('logic/main-web.c'), app = await source('web/app.js');
  const dispatch = body(native, 'dispatch_event');
  ordered(dispatch, ['case 3:', 'Term_resize((int)words[6], (int)words[7])', 'ab_rs_resize(words[6], words[7])']);
  assert.match(app, /resize: \(width, height\).*kind:'resize',width,height/s);
  const save = body(native, 'process_save');
  const v3 = save.slice(save.indexOf('if (ab_rs_replay_enabled())'), save.indexOf('if (!character_generated'));
  assert.match(v3, /ab_rs_replay_save\(\)/); assert.match(v3, /return;/);
  assert.doesNotMatch(v3, /savefile_save\s*\(|snapshot_rng\s*\(|map_info\s*\(|grid_data_as_text\s*\(|Term_redraw\s*\(/);
});

test('Monster descriptions do not invent a new hallucination race and replay wrappers preserve original clock observations', async () => {
  const description = body(await source('logic/mon-desc.c'), 'monster_desc');
  assert.doesNotMatch(description, /randint\d?\s*\(|one_in_\s*\(|Rand_div\s*\(|TMD_IMAGE/);
  assert.match(description, /monster_is_visible\(mon\)/); assert.match(description, /mon->race->name/);
  const native = await source('logic/z-rand.c'), environment = await source('logic/web-replay-environment.c');
  assert.match(native, /ab_web_replay_time\("z_rand\.Rand_init\.time",NULL\)/);
  assert.match(native, /ab_web_replay_pid\("z_rand\.Rand_init\.pid"\)/);
  assert.match(body(environment, 'ab_web_replay_time'), /else \{ result=time\(out\);/);
  assert.match(body(environment, 'ab_web_replay_pid'), /else \{ result=\(int\)getpid\(\);/);
});

test('Normal-play acceptance is bounded, source-observed, and requires real combat/restore/death rather than wizard state', async () => {
  const harness = await source('tests/browser-normal-play.mjs');
  assert.match(harness, /complete100Levels: false/); assert.match(harness, /wizardCommands: 0/);
  assert.match(harness, /maxExploration <= 6000/); assert.match(harness, /maxDeath <= 6000/);
  assert.match(harness, /typeof key === 'string' \? \//);
  assert.match(harness, /__angbandTest\.send\(\$\{JSON\.stringify\(key\)\},0\)/);
  assert.doesNotMatch(harness, /send\(\s*(?:1|0x0*1|0x12)\b|\bHEAP(?:U8|32|U32)\b|_ab_|ccall\(/);
  assert.match(harness, /nativeMap\(await evaluate\('__angbandTest\.frame'\),current\)/);
  assert.match(harness, /Normal next-command continuation must reproduce all 38 RNG words, frame and semantic facts/);
  assert.match(harness, /assert\.ok\(last\.hp<0/);
  assert.match(harness, /assert\.deepEqual\(await buildEvidence\(\),capturedBuild/);
});
