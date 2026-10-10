// Real-engine witnesses, invoked only by the owner's browser runner.
import assert from 'node:assert/strict';
import { STARTUP_TEXT_PIN } from '../web/startup-text.mjs';
const weaponLabels = Object.fromEntries(['en','ja'].map(language => [language, Object.fromEntries(Object.entries(STARTUP_TEXT_PIN.messages).map(([id,message]) => [id,message[language]]))]));
import { nativeFrameRows, classifyStartingWeaponMenu } from './controlled-gameplay-browser.mjs';

const prompts = { en: 'You have a choice of weapons.', ja: '\u6b66\u5668\u3092\u9078\u3079\u307e\u3059\u3002' };
const view = cdp => cdp.eval('({frame:__dcssVerification.frame,waiting:__dcssCore.waiting,frames:__dcssCore.frames,error:__dcssCore.error,completed:__dcssCore.completed})');
async function physical(cdp, key, code, modifiers = 0) {
  await cdp.eval('document.querySelector("#console").focus()');
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers });
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
}
async function after(cdp, until, before, label, predicate) {
  return until(async () => {
    const current = await view(cdp);
    if (current.error) throw Error(current.error);
    assert.equal(current.completed, false);
    return current.waiting && current.frames > before.frames && predicate(nativeFrameRows(current.frame)) ? current : false;
  }, label);
}

export function japaneseWeaponContinuationWitness(frame) {
  const characters = Array.from(prompts.ja);
  const first = frame.cells.findIndex((cell, index) => characters.every((character, ordinal) =>
    frame.cells[index + ordinal * 2]?.glyph === character.codePointAt(0)
      && frame.cells[index + ordinal * 2 + 1]?.glyph === 0));
  assert(first >= 0, 'actual Japanese weapon heading must use width2 leading/continuation cells');
  assert.equal(Math.floor(first / frame.columns), Math.floor((first + characters.length * 2 - 1) / frame.columns));
  return characters.map((character, ordinal) => ({ character, cell: first + ordinal * 2,
    glyph: frame.cells[first + ordinal * 2].glyph, continuation: frame.cells[first + ordinal * 2 + 1].glyph }));
}

export async function verifyRootStartup({ cdp, until, evidence, capture }) {
  await until(() => cdp.eval('Boolean(window.__dcssCore?.waiting)'), 'normal / original-engine startup input');
  const route = await cdp.eval('({href:location.href,path:location.pathname,query:location.search,mode:__dcssVerification.mode,runtime:__dcssCore.runtime,language:__dcssCore.nativeLanguage})');
  evidence.root_route = route;
  assert.equal(route.path, '/'); assert.equal(route.query, ''); assert.equal(route.mode, 'core');
  assert.equal(route.runtime, 'jspi'); assert.equal(route.language, 'ja');
  const startup = await view(cdp);
  assert.equal(startup.error, null); assert.equal(startup.completed, false);
  const rows = nativeFrameRows(startup.frame);
  const menu = classifyStartingWeaponMenu(rows, prompts, weaponLabels);
  assert(menu, 'actual normal-route startup must expose the genuine weapon-choice menu');
  assert.equal(menu.language, 'ja');
  evidence.root_startup = { menu, native_rows: rows, native_frame: startup.frame,
    cjk_continuations: japaneseWeaponContinuationWitness(startup.frame),
    input: { key: 'Enter', code: 'Enter', modifiers: 0, route: 'physical CDP keyboard through Rust normalization' } };
  await capture?.('root-startup-ja');
  await physical(cdp, 'Enter', 'Enter');
  await after(cdp, until, startup, 'ordinary keyboard accepts native default starting weapon', () => true);
  await until(() => cdp.eval('Boolean(window.__dcssCore?.waiting)&&__dcssVerification.frame?.cells.some(cell=>cell.glyph===64)'), 'normal / genuine player frame');
}

export async function verifyQuickstartHelp({ cdp, until, evidence, capture }) {
  const before = await cdp.eval('__dcssCore.state()'); assert.equal(before.rng.length, 45);
  const initial = await view(cdp);
  await physical(cdp, '?', 'Slash', 8);
  const menu = await after(cdp, until, initial, 'ordinary ? opens original help menu', rows => rows.join(' ').includes('Quickstart Guide'));
  evidence.native_quickstart_help = { before, menu_rows: nativeFrameRows(menu.frame),
    physical_input: [{ key: '?', code: 'Slash', modifiers: 8 }, { key: '^', code: 'Digit6', modifiers: 8 }, { key: 'Escape', code: 'Escape', modifiers: 0 }] };
  await physical(cdp, '^', 'Digit6', 8);
  const quickstart = await after(cdp, until, menu, 'ordinary ^ loads bundled native quickstart text', rows => {
    const text = rows.join(' '); return text.includes('Crawl Quick-Start Guide') && text.includes('Copyright 1999 Linley Henzell');
  });
  evidence.native_quickstart_help.resource_rows = nativeFrameRows(quickstart.frame);
  await capture?.('root-native-quickstart');
  await physical(cdp, 'Escape', 'Escape');
  await after(cdp, until, quickstart, 'Escape returns from native quickstart without a turn', rows => !rows.join(' ').includes('Crawl Quick-Start Guide'));
  const restored = await cdp.eval('__dcssCore.state()');
  evidence.native_quickstart_help.after = restored;
  assert.deepEqual(restored, before, 'native informational help must preserve exposed player state and all45 RNG states/counts');
  evidence.checks.push('Physical ? then ^ opens bundled native quickstart; Escape preserves player state and all45 PCG streams');
}
