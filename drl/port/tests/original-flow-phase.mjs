/* Read-only browser-test witnesses for the three original DRL intro pages.
 * These helpers classify rendered catalog text; they never send an input,
 * evaluate Lua, read live native memory, or change gameplay state. */
import assert from 'node:assert/strict';

export const INTRO_PHASE_IDS = Object.freeze([
  'message.plot.intro-wait',
  'message.plot.intro-contact',
  'message.plot.intro-silence',
]);

/** Native wrapping and row padding may insert whitespace. Punctuation,
 * Unicode glyphs, and the external name Jake remain part of the witness. */
export function introGlyphs(text) {
  assert.equal(typeof text, 'string');
  return text.replace(/\s/gu, '');
}

/** Bind only the current locale's three exact semantic IDs. Accepting an
 * English fallback in Japanese would conceal an actual localization gap. */
export function createIntroClassifier(catalog) {
  assert.ok(catalog && typeof catalog === 'object' && !Array.isArray(catalog));
  const pages = INTRO_PHASE_IDS.map((id, index) => {
    assert.ok(Object.hasOwn(catalog, id), `Missing original intro ID: ${id}`);
    const full = introGlyphs(catalog[id]);
    assert.ok(full.length && !full.includes('{{'), `Invalid original intro text: ${id}`);
    const prefix = Array.from(full).slice(0, 8).join('');
    assert.equal(Array.from(prefix).length, 8, `Intro prefix is too short: ${id}`);
    return {id, index, full, prefix};
  });
  assert.equal(new Set(pages.map(page => page.prefix)).size, pages.length,
    'The three original intro prefixes must be distinct');
  return text => {
    const glyphs = introGlyphs(text);
    const matches = pages.filter(page => glyphs.includes(page.prefix));
    assert.ok(matches.length <= 1, 'Ambiguous original intro screen');
    if (!matches.length) return {kind: 'unknown'};
    const {id, index, full} = matches[0];
    return {kind: 'plot', id, index, complete: glyphs.includes(full)};
  };
}

/** The finishing plot can still be drawn in the frame that acknowledges its
 * confirm. Before a second press, require a later real native frame to show
 * the same full page. Replay draws do not increase frameGeneration. The caller
 * records activationFrame from the key-down receipt's first presented frame. */
export function introConfirmationAllowed(witness, {
  expectedId, confirmations, frameGeneration, activationFrame = null,
}) {
  assert.ok(INTRO_PHASE_IDS.includes(expectedId), 'Unknown expected intro phase');
  assert.ok(Number.isInteger(confirmations) && confirmations >= 0 && confirmations <= 2,
    'Invalid intro confirmation count');
  assert.ok(Number.isSafeInteger(frameGeneration) && frameGeneration >= 0,
    'Invalid real native frame generation');
  if (witness.kind !== 'plot') return false;
  assert.equal(witness.id, expectedId, 'Unexpected original intro phase before confirm');
  if (!witness.complete) return false;
  assert.ok(confirmations < 2, 'Two confirms did not close the witnessed original plot');
  if (confirmations === 0) return true;
  assert.ok(Number.isSafeInteger(activationFrame) && activationFrame >= 0,
    'First confirm requires its actual key-down presentation frame');
  return frameGeneration > activationFrame;
}
