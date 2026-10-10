/* Pure witnesses only: no Chrome, server, compiler, or original game runs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {INTRO_PHASE_IDS, createIntroClassifier, introConfirmationAllowed} from './original-flow-phase.mjs';

const catalogs = {};
for (const language of ['en', 'ja']) {
  catalogs[language] = JSON.parse(await readFile(new URL(`../../localization/${language}.json`, import.meta.url), 'utf8'));
}

for (const language of ['en', 'ja']) {
  test(`${language}: all three exact original intro IDs survive wrapping and padding`, () => {
    const classify = createIntroClassifier(catalogs[language]);
    for (const [index, id] of INTRO_PHASE_IDS.entries()) {
      const wrapped = Array.from(catalogs[language][id]).join('\n  ');
      assert.deepEqual(classify(`    ${wrapped}   `), {kind:'plot', id, index, complete:true});
    }
  });
}

test('Japanese classifier rejects English intro text and unrelated native screens', () => {
  const classify = createIntroClassifier(catalogs.ja);
  assert.deepEqual(classify(catalogs.en[INTRO_PHASE_IDS[0]]), {kind:'unknown'});
  assert.deepEqual(classify('射撃対象を選択: BrowserMarine_5489'), {kind:'unknown'});
  assert.deepEqual(classify(''), {kind:'unknown'});
});

test('Known partially revealed page is identified but cannot be confirmed', () => {
  const id = INTRO_PHASE_IDS[0];
  const witness = createIntroClassifier(catalogs.ja)(Array.from(catalogs.ja[id]).slice(0, 12).join(''));
  assert.equal(witness.id, id);
  assert.equal(witness.complete, false);
  assert.equal(introConfirmationAllowed(witness, {expectedId:id, confirmations:0, frameGeneration:50}), false);
});

test('Complete plot preserves punctuation and external names as part of its witness', () => {
  const id = INTRO_PHASE_IDS[2], classify = createIntroClassifier(catalogs.ja);
  assert.equal(classify(catalogs.ja[id]).complete, true);
  assert.equal(classify(catalogs.ja[id].replace('Jake', 'Jade')).complete, false);
  assert.equal(classify(catalogs.ja[id].replace('静寂。', '静寂！')).complete, false);
});

test('Merged plot pages fail closed instead of selecting an arbitrary phase', () => {
  assert.throws(() => createIntroClassifier(catalogs.ja)(
    catalogs.ja[INTRO_PHASE_IDS[0]] + catalogs.ja[INTRO_PHASE_IDS[1]]), /Ambiguous/);
});

test('Second confirm requires the same full page in a newer real native frame', () => {
  const id = INTRO_PHASE_IDS[0], witness = createIntroClassifier(catalogs.ja)(catalogs.ja[id]);
  const base = {expectedId:id, confirmations:1, activationFrame:100};
  assert.equal(introConfirmationAllowed(witness, {...base, frameGeneration:100}), false);
  assert.equal(introConfirmationAllowed(witness, {...base, frameGeneration:101}), true);
  assert.throws(() => introConfirmationAllowed(witness,
    {expectedId:id, confirmations:1, frameGeneration:101}), /presentation frame/);
});

test('Wrong phase and third confirmation fail closed; unknown screen sends no input', () => {
  const id = INTRO_PHASE_IDS[0], classify = createIntroClassifier(catalogs.ja);
  const settings = {expectedId:id, confirmations:0, frameGeneration:100};
  assert.throws(() => introConfirmationAllowed(classify(catalogs.ja[INTRO_PHASE_IDS[1]]), settings), /Unexpected/);
  assert.throws(() => introConfirmationAllowed(classify(catalogs.ja[id]), {...settings, confirmations:2}), /Two confirms/);
  assert.equal(introConfirmationAllowed({kind:'unknown'}, settings), false);
});

test('Missing, dynamic, short, or duplicate catalog witnesses cannot manufacture a phase', () => {
  const bad = {...catalogs.ja}; delete bad[INTRO_PHASE_IDS[0]];
  assert.throws(() => createIntroClassifier(bad), /Missing/);
  assert.throws(() => createIntroClassifier({...catalogs.ja, [INTRO_PHASE_IDS[0]]:'{{name}}'}), /Invalid/);
  assert.throws(() => createIntroClassifier({...catalogs.ja, [INTRO_PHASE_IDS[0]]:'abc'}), /short/);
  assert.throws(() => createIntroClassifier({...catalogs.ja,
    [INTRO_PHASE_IDS[1]]:catalogs.ja[INTRO_PHASE_IDS[0]]}), /distinct/);
});
