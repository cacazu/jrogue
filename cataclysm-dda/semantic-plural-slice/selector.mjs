import assert from 'node:assert/strict';
import {tokenize, validId} from '../semantic-runtime-catalog/model.mjs';

// This internal binder is a test/adapter identity, not an upstream translation.
export const DISPATCH_ID = 'cdda_internal_test.native_plural_leaf_dispatch';
export const INT_MIN = -2147483648, INT_MAX = 2147483647;

export function translatedIntSelector(value) {
  assert.ok(Number.isInteger(value) && value >= INT_MIN && value <= INT_MAX, 'requires the actual int32 passed to translation::translated');
  // For an int32 converted to the native unsigned size_t (at least32bits),
  // the native n==1 fallback is true exactly for signed num==1. Preserve the
  // category, not a guessed cast result or a displayed quantity.
  return value === 1 ? 'one' : 'other';
}
export function quantitySelector(quantity, route, resolvedPhase) {
  assert.ok(Number.isInteger(quantity) && quantity >= 0 && quantity <= 4294967295, 'requires actual uint32 quantity');
  if (route === 'itype-base-name') {
    assert.ok(['SOLID', 'LIQUID', 'GAS', 'PLASMA'].includes(resolvedPhase), 'requires live resolved itype phase');
    if (resolvedPhase === 'LIQUID') return translatedIntSelector(1);
  } else {
    assert.ok(['item-variant-name', 'mtype-name'].includes(route), 'unsupported quantity producer route');
  }
  assert.ok(quantity <= INT_MAX, 'out-of-int32 quantity requires original C++ frozen selector; no narrowing guess');
  // Original variant path goes directly to alt_name.translated(quantity),
  // without itype::nname's liquid clamp. Monster names have no liquid rule.
  return translatedIntSelector(quantity);
}
export function statisticSelector(route, frozenInt) {
  if (route === 'score-int-current-value' || route === 'achievement-int-target') return translatedIntSelector(frozenInt);
  assert.ok(['score-non-int-default-one', 'achievement-anything-default-one'].includes(route), 'unsupported statistic producer route');
  assert.equal(frozenInt, undefined, 'default-one producer has no integer value');
  return 'one';
}
export function termEvent(id, frozenSelector) {
  assert.ok(validId(id));
  assert.ok(frozenSelector === 'one' || frozenSelector === 'other', 'original C++ must freeze one/other');
  return {id: DISPATCH_ID, parameters: {leaf: {type: 'term', value: {id, count: frozenSelector === 'one' ? 1 : 0}}}};
}
export function modeledTermFormat(catalog, event) {
  assert.equal(event.id, DISPATCH_ID);
  assert.deepEqual(Object.keys(event.parameters), ['leaf']);
  const parameter = event.parameters.leaf;
  assert.equal(parameter.type, 'term');
  assert.ok(parameter.value.count === 0 || parameter.value.count === 1, 'count is a declared selector representative');
  const entry = catalog.entries[parameter.value.id];
  assert.ok(entry && parameter.value.id !== DISPATCH_ID, 'missing public leaf');
  assert.deepEqual(entry.parameters, {});
  assert.ok(!('plural_parameter' in entry));
  const template = catalog.locale === 'en' && parameter.value.count === 1 ? (entry.one ?? entry.other) : entry.other;
  return tokenize(template).map(token => { assert.ok('literal' in token); return token.literal; }).join('');
}
