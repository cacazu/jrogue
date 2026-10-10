// Controlled fixtures for the pinned, full official C++ engine. GPL-3.0-or-later.
// Install this file in dcss/tests. It never reads or writes the native heap.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLifecycleBrowser } from './lifecycle-browser.mjs';

const UPSTREAM = '1eebc1a2892e1c89776a0d7a10691f8dac8d9796';
const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proof = [
  ['cmd-keys.h', 124, "{'&', CMD_WIZARD},"],
  ['cmd-keys.h', 46, "{'g', CMD_PICKUP},"],
  ['cmd-keys.h', 94, "{'<', CMD_GO_UPSTAIRS},"],
  ['wizard.cc', 309, 'if (!confirm_prompt("wiz", "Do you really want to enter wizard mode?"))'],
  ['wizard.cc', 341, 'wiz_command = getchm();'],
  ['wizard.cc', 342, "if (wiz_command == '*')"],
  ['wizard.cc', 343, 'wiz_command = CONTROL(toupper_safe(getchm()));'],
  ['defines.h', 277, "#define CONTROL(xxx)          ((xxx) - 'A' + 1)"],
  ['wizard.cc', 121, "case 'M':"],
  ['wizard.cc', 122, "case 'm': wizard_create_spec_monster_name(); break;"],
  ['wizard.cc', 129, "case 'o': wizard_create_spec_object(); break;"],
  ['wizard.cc', 151, "case CONTROL('T'): debug_terp_dlua(); break;"],
  ['wizard.cc', 177, "case 'Z': wizard_unobtain_runes_and_orb(); break;"],
  ['wizard.cc', 192, "case '~': wizard_interlevel_travel(); break;"],
  ['wiz-mon.cc', 56, 'mprf(MSGCH_PROMPT, "Enter monster name (or MONS spec) (? for help): ");'],
  ['wiz-mon.cc', 102, 'coord_def place = find_newmons_square(type, you.pos(), 2, you.current_vision);'],
  ['wiz-mon.cc', 121, 'if (!dgn_place_monster(mspec, place, true, false))'],
  ['wiz-mon.cc', 482, 'mprf(MSGCH_PROMPT, "What monsters to dismiss (ENTER for all, "'],
  ['wiz-mon.cc', 485, 'bool validline = !cancellable_get_line_autohist(buf, sizeof buf);'],
  ['wiz-mon.cc', 494, 'int count = dismiss_monsters(buf);'],
  ['wiz-mon.cc', 495, 'mprf("Dismissed %i monster%s.", count, count == 1 ? "" : "s");'],
  ['wiz-dgn.cc', 167, 'load_level(stair_taken, LOAD_ENTER_LEVEL, old_level);'],
  ['wiz-dgn.cc', 184, 'prompt_translevel_target(TPF_ALLOW_UPDOWN | TPF_SHOW_ALL_BRANCHES, name);'],
  ['travel.cc', 2445, 'branches[br].travel_shortcut,'],
  ['travel.cc', 2803, 'if (single_level_branch(target.id.branch))'],
  ['travel.cc', 2804, 'return level_pos(level_id(target.id.branch, 1));'],
  ['travel.cc', 3549, 'if (with_number && brdepth[branch] != 1)'],
  ['branch-data.h', 28, '{ BRANCH_TEMPLE, BRANCH_DUNGEON, 4, 7, 1, 5,'],
  ['branch-data.h', 34, "'T', {}, branch_noise::normal, DEFAULT_MON_DIE_SIZE,"],
  ['luaterp.cc', 115, 'mpr("[Hit ESC to exit interpreter.]");'],
  ['luaterp.cc', 47, 'if (crawl_state.seen_hups || msgwin_get_line_autohist(prompt, buffer, sizeof(buffer)))'],
  ['luaterp.cc', 91, 'status = lua_pcall(ls, 0, LUA_MULTRET, 0);'],
  ['luaterp.cc', 102, 'mprf(MSGCH_ERROR, "%s", msg);'],
  ['l-you.cc', 111, 'LUARET1(you_wizard, boolean, you.wizard)'],
  ['l-you.cc', 1102, 'LUARET1(you_have_orb, boolean, player_has_orb())'],
  ['l-you.cc', 1679, 'LUAWRAP(_you_die,ouch(INSTANT_DEATH, KILLED_BY_SOMETHING))'],
  ['l-you.cc', 1921, '{ "die",                _you_die },'],
  ['l-you.cc', 1641, 'lua_pushboolean(ls, you_teleport_to(place, move_monsters));'],
  ['l-dgngrd.cc', 126, 'PLUARET(integer, env.grid(c));'],
  ['l-dgn.cc', 1977, 'luaL_setfuncs(ls, dgn_grid_dlib, 0);'],
  ['l-dgn.cc', 1980, 'luaL_setfuncs(ls, dgn_mons_dlib, 0);'],
  ['dlua.cc', 294, 'dlua.init_libraries();'],
  ['dlua.cc', 301, 'dluaopen_you(dlua);'],
  ['feature-data.h', 559, 'DNGN_EXIT_DUNGEON, "staircase leading out of the dungeon", "exit_dungeon",'],
  ['feature-data.h', 597, 'BRANCH_EXIT(DNGN_EXIT_TEMPLE, "staircase back to the Dungeon", "exit_temple"),'],
  ['l-dgnmon.cc', 198, 'monster* mon = monster_at(c);'],
  ['l-dgnmon.cc', 199, 'if (mon && mon->alive())'],
  ['l-mons.cc', 107, 'PLUARET(integer, int(mons->hit_points));'],
  ['l-mons.cc', 202, 'lua_pushboolean(ls, mons->wont_attack());'],
  ['mapdef.cc', 3926, 'mspec.generate_awake = strip_tag(mon_str, "generate_awake");'],
  ['mapdef.cc', 3932, 'mspec.attitude = ATT_HOSTILE;'],
  ['mapdef.cc', 3989, 'mspec.hp = strip_number_tag(mon_str, "hp:");'],
  ['mapdef.cc', 4124, 'mspec.monname = name;'],
  ['dungeon.cc', 5374, 'mg.behaviour = (m_generate_awake) ? BEH_WANDER : BEH_SLEEP;'],
  ['mon-place.cc', 1201, 'mon->flags |= MF_JUST_SUMMONED;'],
  ['mon-act.cc', 1779, 'if (testbits(mons.flags, MF_JUST_SUMMONED))'],
  ['mon-act.cc', 1781, 'mons.flags &= ~MF_JUST_SUMMONED;'],
  ['mon-act.cc', 1782, 'return;'],
  ['mon-act.cc', 4163, '&& check_awaken(*mi, stealth))'],
  ['mon-act.cc', 4165, 'behaviour_event(*mi, ME_ALERT, &you, you.pos(), false);'],
  ['shout.cc', 287, 'if (x_chance_in_y(mons_perc, stealth))'],
  ['melee-attack.cc', 334, 'mprf("%s %s %s attack.",'],
  ['melee-attack.cc', 338, ': atk_name(DESC_ITS).c_str());'],
  ['melee-attack.cc', 374, 'mprf("%s%s misses %s.",'],
  ['melee-attack.cc', 916, 'mprf("%s %s %s but %s no damage.",'],
  ['melee-attack.cc', 3631, 'mprf("%s %s%s %s%s%s%s%s",'],
  ['attack.cc', 735, 'return (ev_margin <= -20) ? " completely" :'],
  ['monster.cc', 2169, 'return mi.proper_name(desc)'],
  ['mon-info.cc', 1266, 'return apostrophise(mname);'],
  ['mon-info.cc', 1268, 'return mname;'],
  ['mon-info.cc', 1281, 'string s = mname + " the " + common_name();'],
  ['mon-death.cc', 3033, 'mprf(MSGCH_MONSTER_DAMAGE, MDAM_DEAD, "You %s %s!",'],
  ['mon-death.cc', 3037, 'mons.name(DESC_THE).c_str());'],
  ['dat/mons/rat.yaml', 7, '- {type: bite, damage: 3}'],
  ['newgame.cc', 1837, 'auto prompt = make_shared<Text>(formatted_string("You have a choice of weapons.", CYAN));'],
  ['newgame.cc', 1783, '_add_menu_sub_item(sub_items, 0, 0, "+ - Recommended random choice",'],
  ['newgame.cc', 1790, '_add_menu_sub_item(sub_items, 1, 0, "* - Random weapon",'],
  ['newgame.cc', 1792, '_add_menu_sub_item(sub_items, 1, 1, "Bksp - Return to character menu",'],
  ['wiz-item.cc', 104, "{'0', \"the Orb\"}"],
  ['wiz-item.cc', 123, 'item.base_type = OBJ_ORBS;'],
  ['wiz-item.cc', 124, 'item.sub_type  = ORB_ZOT;'],
  ['wiz-item.cc', 218, 'move_item_to_grid(&thing_created, you.pos());'],
  ['items.cc', 2022, 'mprf(MSGCH_ORB, "You pick up the Orb of Zot!");'],
  ['main.cc', 1572, 'if (!down && ygrd == DNGN_EXIT_DUNGEON && !player_has_orb())'],
  ['stairs.cc', 888, 'if (how == DNGN_EXIT_DUNGEON)'],
  ['stairs.cc', 892, 'ouch(INSTANT_DEATH, player_has_orb() ? KILLED_BY_WINNING'],
  ['stairs.cc', 893, ': KILLED_BY_LEAVING);'],
  ['ouch.cc', 1557, 'if (crawl_state.test || !yesno("Die?", false, \'n\'))'],
  ['prompt.cc', 272, '&& allow_lowercase)'],
  ['prompt.cc', 282, "else if (tmp == 'Y')"],
  ['ouch.cc', 1278, 'canned_msg(MSG_YOU_DIE);'],
  ['message.cc', 2054, 'mpr_nojoin(MSGCH_PLAIN, "You die...");'],
  ['message.cc', 1896, "while (keypress != ' ' && keypress != '\\r' && keypress != '\\n'"],
  ['hiscores.cc', 2430, 'desc += terse? "escaped" : "Escaped with the Orb";'],
  ['hiscores.cc', 2667, 'desc += terse? "died" : "Died";'],
  ['end.cc', 239, 'case KILLED_BY_WINNING:  return game_exit::win;'],
  ['end.cc', 333, 'more();'],
  ['end.cc', 336, 'display_inventory();'],
  ['end.cc', 431, 'game_ended(exit_reason);'],
];

export async function verifyControlledSource({ root = gameRoot } = {}) {
  const files = new Map();
  for (const [name, line, required] of proof) {
    if (!files.has(name)) files.set(name, await readFile(path.join(root, 'upstream/crawl-ref/source', name), 'utf8'));
    assert.equal(files.get(name).split('\n')[line - 1].trim(), required,
      'pinned fixture source changed: ' + name + ':' + line);
  }
  const ended = {};
  for (const language of ['ja', 'en']) {
    ended[language] = JSON.parse(await readFile(path.join(root, 'locales/' + language + '.json'), 'utf8'))['status.game_ended'];
    assert.equal(typeof ended[language], 'string');
  }
  const startupWeaponPrompts = {};
  for (const [language, expected] of [['en', 'You have a choice of weapons.'], ['ja', '\u6b66\u5668\u3092\u9078\u3079\u307e\u3059\u3002']]) {
    const catalog = JSON.parse(await readFile(path.join(root, 'locales/startup/' + language + '.json'), 'utf8'));
    assert.equal(catalog['startup.weapon.prompt'], expected, 'reviewed startup weapon prompt changed');
    startupWeaponPrompts[language] = expected;
  }
  return { upstream: UPSTREAM, receipts: proof.map(([file, line, required]) => ({ file: 'crawl-ref/source/' + file, line, required })),
    hashes: Object.fromEntries([...files].map(([name, text]) => [name, createHash('sha256').update(text).digest('hex')])), ended,
    startup_weapon_prompts: startupWeaponPrompts,
    startup_weapon_labels: Object.fromEntries(await Promise.all(["en", "ja"].map(async language => [language, JSON.parse(await readFile(path.join(root, "locales/startup/" + language + ".json"), "utf8"))]))) };
}

const evaluate = (cdp, fn, ...args) => cdp.eval('(' + fn.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
export function nativeFrameRows(frame) {
  if (!frame) return [];
  // A CJK continuation is glyph0, not an inserted ASCII space. Preserve the
  // complete text cluster on its leading cell; the physical cells stay intact.
  return Array.from({ length: frame.rows }, (_, row) => frame.cells.slice(row * frame.columns, (row + 1) * frame.columns)
    .map(cell => cell.text ?? (cell.glyph ? String.fromCodePoint(cell.glyph) : '')).join(''));
}
export function classifyStartingWeaponMenu(rows, prompts, labels = null) {
  const normalize = text => text.replace(/\s+/g, ' ').trim(), lines = rows.map(normalize);
  const roles = ['recommended','aptitudes','help','random','back'];
  const legacy = ['+ - Recommended random choice','* - Random weapon','Bksp - Return to character menu'];
  for (const language of ['en','ja']) {
    if (!lines.some(line=>line.includes(prompts[language]))) continue;
    const expected = labels ? roles.map(role=>labels[language]['startup.weapon.'+role+'.label']) : legacy;
    if (expected.some(label=>typeof label!=='string')) throw Error('incomplete source-bound weapon controls');
    if (!expected.every(label=>lines.some(line=>line.includes(normalize(label))))) continue;
    if (labels && roles.some(role=>labels[language]['startup.weapon.'+role+'.label']!==labels[language==='en'?'ja':'en']['startup.weapon.'+role+'.label']
      && lines.some(line=>line.includes(normalize(labels[language==='en'?'ja':'en']['startup.weapon.'+role+'.label']))))) continue;
    return {kind:'weapon',language,semantic_id:'startup.weapon.prompt',prompt:prompts[language],
      display_schema:labels?2:1,control_ids:labels?roles.map(role=>'startup.weapon.'+role+'.label'):[],controls:expected};
  }
  return null;
}


export function classifyWizardPrompt(view) {
  // Native message history remains visible after wizard entry. Classify the
  // current input row instead of treating an old confirmation as active.
  const classify = line => {
    const text = String(line ?? '').replace(/\s+/g, ' ').trim();
    if (text.includes('Enter Wizard Command (? - help):')) return { kind: 'command', text };
    if (text.includes('Do you really want to enter wizard mode?')
        && text.includes('Confirm with "wiz".')) return { kind: 'confirmation', text };
    return null;
  };
  const cursor = view.cursor;
  if (Array.isArray(cursor) && Number.isInteger(cursor[1]) && cursor[1] >= 0 && cursor[1] < view.rows.length) {
    const result = classify(view.rows[cursor[1]]);
    if (result) return { ...result, row: cursor[1], selected_by: 'native cursor row' };
  }
  for (let row = view.rows.length - 1; row >= 0; row--) {
    if (!view.rows[row].trim()) continue;
    const result = classify(view.rows[row]);
    return result ? { ...result, row, selected_by: 'last nonblank native row' } : null;
  }
  return null;
}
export function nativeRatCombatMessages(rows) {
  // Pin messages to the actual named actor and player. Monster-list full_name
  // adds "the rat"; the combat source uses proper_name for DESC_THE/DESC_ITS.
  // Message history, Lua echoes, generic turn advancement and HP loss alone
  // cannot establish that this particular native rat attacked the player.
  const result = { attacks: [], kills: [] };
  for (const row of rows) {
    const message = row.trim().replace(/^_/, '').trim().replace(/\s+/g, ' ');
    let kind;
    if (/^You block DcssCombatFixture's attack\.$/.test(message)) kind = 'shield_block';
    else if (/^DcssCombatFixture(?: completely| closely| barely)? misses you\.$/.test(message)) kind = 'miss';
    else if (/^DcssCombatFixture bites you but does no damage\.$/.test(message)) kind = 'bite_no_damage';
    else if (/^DcssCombatFixture bites you[.!]+$/.test(message)) kind = 'bite';
    if (kind) result.attacks.push({ kind, message });
    if (/^You (?:kill|destroy) DcssCombatFixture!$/.test(message)) result.kills.push(message);
  }
  return result;
}
async function snapshot(cdp) {
  return evaluate(cdp, function () {
    const frame = __dcssVerification.frame;
    const rows = frame ? Array.from({ length: frame.rows }, (_, row) => frame.cells.slice(row * frame.columns, (row + 1) * frame.columns)
      .map(cell => cell.text ?? (cell.glyph ? String.fromCodePoint(cell.glyph) : '')).join('')) : [];
    return { rows, text: rows.join('\n'), plain: rows.join('\n').replace(/\s+/g, ' '), frames: __dcssCore.frames, waiting: __dcssCore.waiting,
      completed: __dcssCore.completed, error: __dcssCore.error,
      player: document.querySelector('#player').value, status: document.querySelector('#status').textContent,
      messages: __dcssVerification.semanticMessages, semanticErrors: __dcssVerification.semanticErrors,
      cursor: frame?.cursor ?? null, probe: window.__dcssControlledFlowProbe ? {
        completed: __dcssControlledFlowProbe.completed, errors: __dcssControlledFlowProbe.errors,
        nativeFrames: __dcssControlledFlowProbe.nativeFrames,
        key_transport: __dcssControlledFlowProbe.key_transport,
      } : null };
  });
}
async function physical(cdp, key, code, { modifiers = 0, text = key } = {}) {
  await evaluate(cdp, function () { document.querySelector('#console').focus(); });
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, text });
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
}
async function asciiLine(cdp, text) {
  assert.match(text, /^[\x20-\x7e]+$/);
  // Fixture setup enters real native line-editing UI through the Worker key
  // queue. This is not a heap write or a claim of physical text/IME coverage.
  await evaluate(cdp, function (value) {
    for (const character of value) __dcssCore.queue(character.codePointAt(0));
    __dcssCore.queue(13);
  }, text);
}
function logical(state) { return JSON.parse(JSON.stringify(state, (key, value) => ['count', 'draws'].includes(key) ? undefined : value)); }

export async function verifyControlledGameFlow({ cdp, until, evidence, flow, base, coreQuery, capture }) {
  assert(['combat', 'branch', 'death', 'victory'].includes(flow), 'one explicit controlled flow is required');
  const official = await verifyControlledSource();
  const record = evidence.controlledGameFlow = { flow, result: 'running', upstream: UPSTREAM,
    controlled_wizard_fixture: true, normal_manual_full_game: false, local_browser_only: true,
    native_heap_or_state_injection: false, fixture_ascii_input: 'normalized ASCII integers through real Worker/native line editor',
    gameplay_input: 'physical CDP keys through Rust translation', source_receipts: official.receipts,
    source_hashes: official.hashes, commands: [], observations: [], checks: [] };
  const check = label => { record.checks.push(label); evidence.checks.push(label); };
  let markerNumber = 0;

  async function inputAfter(previous, label, predicate = () => true) {
    return until(async () => {
      const value = await snapshot(cdp);
      if (value.error) throw Error(value.error);
      assert.equal(value.completed, false, 'engine ended before the native outcome was inspected');
      return value.waiting && value.frames > previous.frames && predicate(value) ? value : false;
    }, label);
  }
  async function key(keyValue, code, label, predicate, options) {
    const before = await snapshot(cdp); record.commands.push({ key: keyValue, code, label });
    await physical(cdp, keyValue, code, options);
    return inputAfter(before, label, predicate);
  }
  async function clearObservedMores(context, current = null) {
    current ??= await snapshot(cdp);
    for (let ordinal = 0; ordinal < 8 && current.text.includes('--more--'); ordinal++) {
      assert(current.waiting && !current.completed && current.error === null);
      assert(!/\b(?:Inventory|Gear):.*Left\/Right to switch category/.test(current.plain), 'never treat an inventory overlay as a message-more input');
      (record.observed_mores ??= []).push({ context, native_rows: current.rows, key: 'Space', ordinal });
      current = await key(' ', 'Space', 'observed native message-more in ' + context, undefined, { text: ' ' });
    }
    assert(!current.text.includes('--more--'), 'bounded native more count exceeded in ' + context);
    return current;
  }
  async function wizardMenu() {
    await clearObservedMores('before ordinary wizard command');
    let current = await key('&', 'Digit7', 'wizard command prompt', value => classifyWizardPrompt(value) !== null, { modifiers: 8 });
    const active = classifyWizardPrompt(current);
    (record.wizard_active_prompts ??= []).push(active);
    if (active.kind === 'confirmation') {
      record.wizard_confirmation_rows = current.rows;
      await asciiLine(cdp, 'wiz');
      current = await inputAfter(current, 'accepted full typed wiz confirmation', value => classifyWizardPrompt(value)?.kind === 'command');
      record.wizard_active_prompts.push(classifyWizardPrompt(current));
    }
    assert.equal(classifyWizardPrompt(current)?.kind, 'command');
    return current;
  }
  async function wizard(command, predicate = () => true) {
    await wizardMenu();
    return key(command, /^[A-Za-z]$/.test(command) ? 'Key' + command.toUpperCase() : command === '~' ? 'Backquote' : 'Digit0',
      'official wizard ' + command, predicate, { modifiers: /[A-Z~]/.test(command) ? 8 : 0 });
  }
  async function openDlua() {
    await clearObservedMores('before the exact DLua key sequence');
    const transportBefore = await evaluate(cdp, function () { return window.__dcssControlledFlowProbe?.key_transport.length ?? null; });
    await wizardMenu();
    const before = await snapshot(cdp);
    record.commands.push({ key: '*', code: 'Digit8', modifiers: 8, native_key: 42, label: 'official alternate Control prefix' });
    await physical(cdp, '*', 'Digit8', { modifiers: 8 });
    // The official alternate Control prefix reads its second key immediately.
    record.commands.push({ key: 't', code: 'KeyT', modifiers: 0, native_key: 116, converted_wizard_command: 20, label: 'plain t converted by CONTROL(toupper_safe(t))' });
    await physical(cdp, 't', 'KeyT');
    const result = await inputAfter(before, 'official dungeon Lua interpreter', value => value.plain.includes('[Hit ESC to exit interpreter.]'));
    if (transportBefore !== null) {
      const keys = await evaluate(cdp, function (offset) { return __dcssControlledFlowProbe.key_transport.slice(offset); }, transportBefore);
      assert.deepEqual(keys, [38, 42, 116], 'physical &,*,plain t must deliver the exact source Control-substitute sequence');
      (record.dlua_physical_sequences ??= []).push({ keys, native_wizard_command: 20,
        conversion: "defines.h277 CONTROL(toupper_safe('t')) = 'T' - 'A' + 1 = 20", direct_alternative_not_used: 'physical & then Ctrl+T without *' });
    }
    return result;
  }
  async function luaObservation(body, suffixPattern, label, pure = false) {
    await clearObservedMores('before the authored Lua observation');
    const before = pure ? await cdp.eval('__dcssCore.state()') : null;
    const prefix = 'GF' + String(++markerNumber).padStart(5, '0');
    const prompt = await openDlua();
    const line = body.replaceAll('$PREFIX', prefix);
    record.commands.push({ official_dlua_line: line, label });
    await asciiLine(cdp, line);
    const matcher = new RegExp(prefix + '\\|' + suffixPattern);
    let result = await inputAfter(prompt, label, value => matcher.test(value.text) || value.text.includes('--more--'));
    for (let ordinal = 0; ordinal < 8 && !matcher.test(result.text); ordinal++) {
      assert(result.text.includes('--more--'), 'unknown native prompt while awaiting authored Lua result');
      result = await clearObservedMores('awaiting authored Lua observation', result);
      // clearObservedMores returns at the next genuine native input boundary.
      assert(matcher.test(result.text), 'authored Lua observation missing after its native message-more boundary');
    }
    assert(matcher.test(result.text), 'authored Lua observation missing');
    const matched = result.text.match(matcher);
    record.observations.push({ label, marker: matched[0], native_rows: result.rows });
    // A printed marker can itself be followed by a force-more pause. Complete
    // that source-supported pause before Escape is used to exit the interpreter.
    result = await clearObservedMores('after authored Lua observation', result);
    await physical(cdp, 'Escape', 'Escape', { text: '' });
    await inputAfter(result, 'return from dungeon interpreter');
    if (pure) {
      const after = await cdp.eval('__dcssCore.state()');
      assert.deepEqual(after, before, 'read-only official Lua query must preserve exposed player and all45 persistent RNG words/counts');
      record.observations.at(-1).state_before = before;
      record.observations.at(-1).state_after = after;
      record.observations.at(-1).exposed_state_and_rng_neutral = true;
    }
    return matched;
  }
  async function passivePlayer() {
    const match = await luaObservation('crawl.mpr("$PREFIX|W="..tostring(you.wizard()).."|O="..tostring(you.have_orb()).."|L="..you.where())',
      'W=(true|false)\\|O=(true|false)\\|L=([A-Za-z0-9:]+)', 'official wizard/Orb/level observation', true);
    return { wizard: match[1] === 'true', orb: match[2] === 'true', level: match[3] };
  }
  async function moveToExistingFeature(feature) {
    // Setup uses only an already generated feature, never a synthetic exit.
    const body = 'local a,b=dgn.max_bounds();local fx,fy=-1,-1;for x=0,a-1 do for y=0,b-1 do if dgn.in_bounds(x,y) and dgn.feature_name(dgn.grid(x,y))=="' + feature + '" then fx,fy=x,y end end end;assert(fx>=0,"generated feature missing");local ok=you.teleport_to(fx,fy);crawl.mpr("$PREFIX|F="..dgn.feature_name(dgn.grid(you.pos())).."|T="..tostring(ok).."|X="..fx.."|Y="..fy)';
    const m = await luaObservation(body, 'F=(' + feature + ')\\|T=(true)\\|X=(\\d+)\\|Y=(\\d+)', 'official teleport to generated ' + feature);
    const state = await cdp.eval('__dcssCore.state()');
    assert.equal(state.x, Number(m[3])); assert.equal(state.y, Number(m[4]));
    record.generated_feature = { feature, x: state.x, y: state.y, native_state: state,
      approach_bypassed_with_official_wizard_teleport: true };
  }
  async function readMonster() {
    const body = 'local a,b=dgn.max_bounds();local n,mx,my,h,w,att,typ=0,-1,-1,0,true,-1,"none";for x=0,a-1 do for y=0,b-1 do if dgn.in_bounds(x,y) then local m=dgn.mons_at(x,y);if m and m.name=="DcssCombatFixture" then n=n+1;mx,my,h,w,att,typ=x,y,m.hp,m.wont_attack,m.get_info():attitude(),m.type_name end end end end;crawl.mpr("$PREFIX|M="..n..","..mx..","..my..","..h..","..tostring(w)..","..att..","..typ)';
    const m = await luaObservation(body, 'M=(\\d+),(-?\\d+),(-?\\d+),(\\d+),(true|false),(-?\\d+),(rat|none)', 'read fresh native monster wrapper', true);
    return { count: Number(m[1]), x: Number(m[2]), y: Number(m[3]), hp: Number(m[4]), wontAttack: m[5] === 'true', attitude: Number(m[6]), type: m[7] };
  }
  async function dismissMonsters() {
    const prompt = await wizard('G', value => value.plain.includes('What monsters to dismiss (ENTER for all,'));
    record.dismiss_prompt_rows = prompt.rows;
    const result = await key('Enter', 'Enter', 'official empty dismissal line selects all native monsters', value => /Dismissed \d+ monsters?\./.test(value.plain), { text: '\r' });
    record.dismiss_result_rows = result.rows;
  }
  async function ending(current, expected, afterSequence) {
    record.ending_prompts = [];
    for (let ordinal = 0; ordinal < 12 && !current.text.includes('Goodbye, ' + current.player + '.'); ordinal++) {
      const text = current.text.replace(/\s+/g, ' ');
      let keyValue, code, kind;
      // Final inventory may overlay the preceding --more-- text. Classify it first.
      if (/\b(?:Inventory|Gear):\s+.*Left\/Right to switch category/.test(text)
          || /\b(?:Potions|Scrolls|Evocable Items):\s+.*Left\/Right to switch category/.test(text)) {
        keyValue = 'Escape'; code = 'Escape'; kind = 'official identified final inventory';
      } else if (text.includes('--more--')) { keyValue = ' '; code = 'Space'; kind = 'official ending more'; }
      else throw Error('Unrecognized native ' + expected + ' ending screen: ' + JSON.stringify(current.rows));
      record.ending_prompts.push({ kind, native_rows: current.rows, key: keyValue });
      current = await key(keyValue, code, expected + ' ending prompt ' + (ordinal + 1), value => value.text !== current.text,
        { text: keyValue === 'Escape' ? '' : keyValue });
    }
    assert(current.text.includes('Goodbye, ' + current.player + '.'));
    assert(current.text.includes('Best Crawlers -'));
    assert(current.text.includes(expected === 'victory' ? 'Escaped with the Orb' : 'Died'), 'actual native score popup must identify the source-controlled ending');
    const deaths = current.messages.filter(event => BigInt(event.sequence) > BigInt(afterSequence)
      && event.message.id === 'game.canned.you_die');
    if (expected === 'death') {
      assert.equal(deaths.length, 1); assert.equal(deaths[0].nojoin, true); assert.equal(deaths[0].source, 'canned-v1'); assert.equal(deaths[0].upstream, UPSTREAM);
      record.actual_death_event = deaths[0];
      check('Official you.die() accepts uppercase Y and emits exactly one genuine nojoin typed death message');
    } else assert.equal(deaths.length, 0, 'actual winning non-death path must not produce a death canned message');
    record.goodbye_native_rows = current.rows;
    record.pre_completion_semantics = current.messages;
    await capture?.(expected + '-native-goodbye');
    await physical(cdp, 'Enter', 'Enter', { text: '\r' });
    const completed = await until(async () => { const value = await snapshot(cdp); if (value.error) throw Error(value.error); return value.completed ? value : false; }, expected + ' real status0 completion');
    assert.equal(completed.error, null); assert.equal(completed.waiting, false);
    assert.equal(completed.status, official.ended.ja); assert.equal(completed.semanticErrors, 0);
    assert.deepEqual(completed.probe.completed, [{ status: 0 }]); assert.deepEqual(completed.probe.errors, []);
    assert.deepEqual(completed.messages, current.messages);
    const rejected = await evaluate(cdp, async function () {
      return Promise.all(['state', 'repaint', 'save', 'files'].map(async op => {
        try { await __dcssCore[op](); return { op, status: 'fulfilled' }; }
        catch (error) { return { op, status: 'rejected', error: error.message }; }
      }));
    });
    assert(rejected.every(result => result.status === 'rejected' && /engine session completed/.test(result.error)));
    record.post_completion_helpers = rejected; record.normal_exit_status = 0;
    record.exit_status_is_generic = true; record.outcome_evidence = 'source-controlled command path, actual native score popup, and pre-teardown descriptors; not inferred from status0';
    check('Controlled ' + expected + ' reaches its actual native score popup and clean generic browser completion');
  }

  async function installProbe() { await evaluate(cdp, function () {
    if (window.__dcssControlledFlowProbe) throw Error('controlled probe already installed');
    const probe = { completed: [], errors: [], nativeFrames: [], key_transport: [] };
    const render = __dcssVerification.renderCoreFrame;
    const postMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (data, ...rest) {
      if (data?.type === 'key') probe.key_transport.push(data.key);
      return postMessage.call(this, data, ...rest);
    };
    __dcssVerification.renderCoreFrame = function (frame) {
      const result = render.call(this, frame);
      // Passive observation only; no native export or RNG is called from draw.
      const rows = Array.from({ length: frame.rows }, (_, row) => frame.cells.slice(row * frame.columns, (row + 1) * frame.columns)
        .map(cell => cell.text ?? (cell.glyph ? String.fromCodePoint(cell.glyph) : '')).join(''));
      const text = rows.join('\n');
      if (probe.nativeFrames.at(-1)?.text !== text) {
        probe.nativeFrames.push({ frames: __dcssCore.frames + 1, text });
        if (probe.nativeFrames.length > 64) probe.nativeFrames.shift();
      }
      return result;
    };
    const completed = event => probe.completed.push({ status: event.detail.status });
    const failed = event => probe.errors.push({ message: event.detail.message });
    window.addEventListener('dcss-core-completed', completed); window.addEventListener('dcss-core-error', failed);
    probe.restore = () => { __dcssVerification.renderCoreFrame = render; Worker.prototype.postMessage = postMessage;
      window.removeEventListener('dcss-core-completed', completed); window.removeEventListener('dcss-core-error', failed); };
    window.__dcssControlledFlowProbe = probe;
  }); }
  await installProbe();
  try {
    const initial = await cdp.eval('__dcssCore.state()'); record.initial = initial;
    assert.equal(initial.branch, 0); assert.equal(initial.depth, 1); assert(initial.hp > 0);
    assert.equal(initial.rng.length, 45);
    // All flows enter wizard mode through its ordinary typed confirmation.
    await wizardMenu();
    await key('Escape', 'Escape', 'cancel wizard command after authentic entry', undefined, { text: '' });
    const player = await passivePlayer(); assert.equal(player.wizard, true); assert.equal(player.orb, false);
    record.wizard_verified = player;
    check('Controlled fixture enters real wizard mode with typed wiz and native you.wizard() proof');
    const error = await luaObservation('error("$PREFIX"..string.char(124).."EXPECTED-LUA-ERROR")', 'EXPECTED-LUA-ERROR', 'genuine Lua pcall error is rendered by original console', true);
    record.lua_error_marker = error[0];
    const beforeErrorCommand = await cdp.eval('__dcssCore.state()');
    const errorRecovered = await key('.', 'Period', 'ordinary gameplay command after caught Lua error');
    const afterErrorCommand = await cdp.eval('__dcssCore.state()');
    assert(afterErrorCommand.turn > beforeErrorCommand.turn); assert(afterErrorCommand.hp > 0);
    assert.equal(errorRecovered.error, null); assert.equal(errorRecovered.completed, false);
    record.lua_error_recovery = { before: beforeErrorCommand, after: afterErrorCommand, native_rows: errorRecovered.rows };
    check('Genuine DLua error()/pcall renders the expected native error and resumes an ordinary keyboard turn');

    if (flow === 'combat') {
      await dismissMonsters();
      await wizard('m', value => value.text.includes('Enter monster name (or MONS spec)'));
      const prompt = await snapshot(cdp);
      const spec = 'rat hp:1 att:hostile generate_awake name:DcssCombatFixture';
      record.monster_spec = spec; await asciiLine(cdp, spec);
      await inputAfter(prompt, 'original named hostile rat placement');
      let monster = await readMonster(); assert.equal(monster.count, 1); assert.equal(monster.hp, 1); assert.equal(monster.wontAttack, false); assert.equal(monster.attitude, 0); assert.equal(monster.type, 'rat');
      record.created_monster = monster;
      // Official test setup places the player on an existing adjacent floor.
      // The attack and monster retaliation are normal game commands thereafter.
      const body = 'local tx,ty=' + monster.x + ',' + monster.y + ';local ok=false;for dx=-1,1 do for dy=-1,1 do if not ok and (dx~=0 or dy~=0) and dgn.in_bounds(tx+dx,ty+dy) and dgn.feature_name(dgn.grid(tx+dx,ty+dy))=="floor" and not dgn.mons_at(tx+dx,ty+dy) then ok=you.teleport_to(tx+dx,ty+dy) end end end;crawl.mpr("$PREFIX|T="..tostring(ok))';
      await luaObservation(body, 'T=(true)', 'official adjacency fixture teleport');
      record.approach_bypassed_with_official_wizard_teleport = true;
      // Wizard-created monsters retain MF_JUST_SUMMONED: the first ordinary
      // world turn clears it and skips their action. Awake means BEH_WANDER;
      // ordinary stealth/awareness checks then alert the rat. Wait within a
      // fixed bound rather than asserting it attacks on that skipped turn.
      // Only an actor-specific native attack result counts, including a real
      // shield block; the fixture never assigns AI, energy, damage or RNG.
      record.monster_wait_trace = [];
      record.monster_wait_bound = 12;
      for (let ordinal = 0; ordinal < record.monster_wait_bound; ordinal++) {
        const beforeWait = await cdp.eval('__dcssCore.state()');
        const retaliation = await key('.', 'Period', 'ordinary wait allowing original hostile monster turn ' + (ordinal + 1));
        const afterWait = await cdp.eval('__dcssCore.state()');
        const native = nativeRatCombatMessages(retaliation.rows);
        const step = { ordinal: ordinal + 1, before: beforeWait, after: afterWait, native_rows: retaliation.rows, native_attacks: native.attacks };
        record.monster_wait_trace.push(step); // Preserve the decisive frame even on assertion failure.
        assert(afterWait.turn > beforeWait.turn); assert(afterWait.hp > 0);
        if (native.attacks.length) { record.monster_turn = step; break; }
        const actual = await readMonster(); step.monster_after = actual;
        assert.equal(actual.count, 1, 'actual native fixture rat must remain alive until its attack is observed');
        assert.equal(actual.attitude, 0); assert.equal(actual.wontAttack, false);
      }
      assert(record.monster_turn, 'within 12 ordinary waits the actual native rat must bite, miss or have its attack shield-blocked');
      await capture?.('combat-native-retaliation');
      monster = await readMonster(); assert.equal(monster.count, 1);
      record.attack_trace = [];
      for (let ordinal = 0; ordinal < 24 && monster.count; ordinal++) {
        const before = await cdp.eval('__dcssCore.state()');
        const dx = Math.sign(monster.x - before.x), dy = Math.sign(monster.y - before.y);
        assert(Math.max(Math.abs(monster.x - before.x), Math.abs(monster.y - before.y)) <= 1, 'native rat must remain adjacent');
        const letter = { '-1,-1': 'y', '0,-1': 'k', '1,-1': 'u', '-1,0': 'h', '1,0': 'l', '-1,1': 'b', '0,1': 'j', '1,1': 'n' }[dx + ',' + dy];
        assert(letter, 'player and native rat cannot occupy one tile');
        const screen = await key(letter, 'Key' + letter.toUpperCase(), 'ordinary directional melee ' + (ordinal + 1));
        const after = await cdp.eval('__dcssCore.state()'); assert(after.turn > before.turn); assert(after.hp > 0);
        const native = nativeRatCombatMessages(screen.rows);
        if (native.kills.length) await capture?.('combat-native-kill');
        const actual = await readMonster();
        record.attack_trace.push({ key: letter, before, after, monster_after: actual, native_rows: screen.rows, native_kills: native.kills });
        monster = actual;
      }
      assert.equal(monster.count, 0, 'normal directional combat must remove the actual native monster');
      assert(record.attack_trace.some(step => step.native_kills.length), 'actual original player kill message must accompany removal');
      assert(record.attack_trace.some(step => JSON.stringify(step.before.rng) !== JSON.stringify(step.after.rng)), 'real combat must execute native RNG');
      check('Controlled named rat retaliates on a real turn and dies to ordinary keyboard melee with native RNG/state evidence');
      await verifyLifecycleBrowser({ cdp, until, evidence });
    } else if (flow === 'branch') {
      assert(base && coreQuery, 'branch resume requires the same local preview URL');
      const menu = await wizard('~', value => value.text.includes('Where to?') && value.text.includes('Temple'));
      record.branch_menu_rows = menu.rows;
      await key('T', 'KeyT', 'official one-level Temple selection', undefined, { modifiers: 8 });
      const entered = await cdp.eval('__dcssCore.state()'); assert.equal(entered.branch, 1); assert.equal(entered.depth, 1);
      await capture?.('branch-native-temple');
      const label = await passivePlayer(); assert.equal(label.level, 'Temple');
      record.temple_state = entered; check('Official wizard level chooser loads the genuine Temple branch and new native frame');
      await cdp.eval('__dcssCore.save()'); const saved = await cdp.eval('__dcssCore.state()');
      record.native_files = await cdp.eval('(async()=> (await __dcssCore.files()).map(file=>({path:file.path,bytes:file.bytes.length})))()');
      await cdp.call('Page.navigate', { url: base + coreQuery + '&resume=1' });
      await until(() => cdp.eval('(async()=>Boolean(window.__dcssCore?.waiting)&&(await __dcssCore.state()).branch===1&&(await __dcssCore.state()).depth===1)()'), 'native Temple save reload');
      const restored = await cdp.eval('__dcssCore.state()'); assert.deepEqual(logical(restored), logical(saved));
      await installProbe();
      record.branch_save = saved; record.branch_restored = restored;
      check('Native save/resume in a genuine second branch preserves player state and every persistent PCG word');
      await moveToExistingFeature('exit_temple');
      const before = await cdp.eval('__dcssCore.state()');
      const stairFrame = await key('<', 'Comma', 'ordinary generated Temple exit stairs', undefined, { modifiers: 8 });
      const after = await cdp.eval('__dcssCore.state()'); assert.equal(after.branch, 0); assert(after.depth >= 4 && after.depth <= 7); assert(after.turn > before.turn);
      record.normal_branch_exit = { before, after, native_rows: stairFrame.rows };
      await capture?.('branch-native-exit');
      check('Ordinary physical < traverses the already generated Temple exit and returns to its actual Dungeon parent');
      await verifyLifecycleBrowser({ cdp, until, evidence });
    } else if (flow === 'death') {
      await openDlua(); const prompt = await snapshot(cdp);
      record.commands.push({ official_dlua_line: 'you.die()', label: 'official instant-death fixture' });
      await asciiLine(cdp, 'you.die()');
      const confirm = await inputAfter(prompt, 'real wizard Die? confirmation', value => value.text.includes('Die?'));
      record.death_confirmation_rows = confirm.rows;
      await capture?.('death-native-confirmation');
      record.test_mode_short_circuit_excluded = 'actual Die? UI evaluated; crawl_state.test would skip yesno';
      const beforeSequence = confirm.messages.at(-1)?.sequence ?? '0';
      const current = await key('Y', 'KeyY', 'uppercase unsafe death confirmation', undefined, { modifiers: 8 });
      // buffer.add can suspend in an earlier --more-- before the accepted
      // canned callback. Verify the complete event once native goodbye arrives.
      await ending(current, 'death', beforeSequence);
    } else {
      await dismissMonsters(); await moveToExistingFeature('exit_dungeon');
      const before = await cdp.eval('__dcssCore.state()'); assert.equal(before.branch, 0); assert.equal(before.depth, 1);
      const menu = await wizard('o', value => value.text.includes('Which item class') && value.text.includes('the Orb'));
      record.orb_class_menu_rows = menu.rows;
      await key('0', 'Digit0', 'official OBJ_ORBS creation');
      const pickup = await key('g', 'KeyG', 'ordinary Orb pickup', value => value.text.includes('You pick up the Orb of Zot!'));
      record.orb_pickup_rows = pickup.rows;
      await capture?.('victory-native-orb-pickup');
      const actual = await passivePlayer(); assert.equal(actual.orb, true); assert.equal(actual.level, 'D:1');
      record.native_orb_proof = actual;
      const atExit = await luaObservation('crawl.mpr("$PREFIX|F="..dgn.feature_name(dgn.grid(you.pos())))', 'F=(exit_dungeon)', 'verify genuine D:1 exit after actual Orb pickup', true);
      assert.equal(atExit[1], 'exit_dungeon');
      const beforeSequence = (await snapshot(cdp)).messages.at(-1)?.sequence ?? '0';
      const current = await key('<', 'Comma', 'ordinary D:1 exit with real Orb', undefined, { modifiers: 8 });
      assert(current.text.includes('You have escaped!') || current.text.includes('Escaped with the Orb'));
      assert(!current.messages.some(event => BigInt(event.sequence) > BigInt(beforeSequence) && event.message.id === 'game.canned.you_die'));
      check('Native Orb creation is followed by ordinary pickup, actual you.have_orb() and generated exit traversal');
      await ending(current, 'victory', beforeSequence);
    }
    assert.equal(await cdp.eval('__dcssCore.completed'), true, 'disposable flow must finish through native ending before browser shutdown');
    record.result = 'pass'; return record;
  } catch (error) {
    record.result = 'fail'; record.error = error.stack;
    // Capture read-only native UI/probe evidence before finally restores the
    // passive probe. A diagnostic error must not replace the original failure.
    try { record.failure_native_view = await snapshot(cdp); }
    catch (diagnosticError) { record.failure_snapshot_error = diagnosticError.stack; }
    throw error;
  }
  finally {
    await evaluate(cdp, function () { window.__dcssControlledFlowProbe?.restore(); delete window.__dcssControlledFlowProbe; });
  }
}
