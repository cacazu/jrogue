// Lightweight independent presentation reference; native/Rust execution pending.
const encoder = new TextEncoder();
export const constants = Object.freeze({ offset: 2166136261, prime: 16777619,
  mixA: 0x7feb352d, mixB: 0x846ca68b, stride: 0x9e3779b9 });
export function avalanche(value) {
  value >>>= 0;
  value = Math.imul(value ^ (value >>> 16), constants.mixA) >>> 0;
  value = Math.imul(value ^ (value >>> 15), constants.mixB) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}
const byte = (value, part) => Math.imul(value ^ part, constants.prime) >>> 0;
export function appendWord(value, word) {
  for (let shift = 0; shift < 32; shift += 8) value = byte(value, (word >>> shift) & 255);
  return value;
}
function text(value, data) {
  const encoded = encoder.encode(data);
  value = appendWord(value, encoded.length >>> 0);
  value = appendWord(value, Math.floor(encoded.length / 2 ** 32));
  for (const part of encoded) value = byte(value, part);
  return value;
}
const position = (value, data) => data.reduce(appendWord, value);
export function weatherSeed(frame) {
  let value = text(constants.offset, 'cdda.presentation.weather.v1');
  value = text(value, frame.resolved_tile_id);
  value = position(value, frame.tile_position);
  value = position(value, frame.screen_position);
  return avalanche(value);
}
export function npcKey(frame) {
  let value = text(constants.offset, 'cdda.presentation.npc-color.v1');
  for (const field of ['origin', 'cursor', 'position']) value = position(value, frame[field]);
  for (const field of ['npc_id', 'native_chance', 'pass']) value = appendWord(value, frame[field]);
  return avalanche(value);
}
export function boundedWord(key, bound) {
  if (!Number.isInteger(bound) || bound < 2 || bound > 0x7fffffff) throw new RangeError('native chance');
  const threshold = ((0 - bound) >>> 0) % bound;
  for (let ordinal = 0; ; ordinal = (ordinal + 1) >>> 0) {
    const word = avalanche((key + Math.imul(ordinal, constants.stride)) >>> 0);
    if (word >= threshold) return { value: word % bound, ordinal, word, threshold };
  }
}
export function acceptNpcColor(frame) {
  return frame.native_chance <= 1 || boundedWord(npcKey(frame), frame.native_chance).value === 0;
}
export function collisionColor(current, candidate, frame) {
  return current !== candidate && acceptNpcColor(frame) ? candidate : current;
}
export function nativeStaticLocationMix(seed) {
  const rot = (word, bits) => ((word << bits) | (word >>> (32 - bits))) >>> 0;
  let a = seed >>> 0, b = (-seed) >>> 0, c = Math.imul(seed, seed) >>> 0;
  c = ((c ^ b) - rot(b, 14)) >>> 0;
  a = ((a ^ c) - rot(c, 11)) >>> 0;
  b = ((b ^ a) - rot(a, 25)) >>> 0;
  c = ((c ^ b) - rot(b, 16)) >>> 0;
  a = ((a ^ c) - rot(c, 4)) >>> 0;
  b = ((b ^ a) - rot(a, 14)) >>> 0;
  return ((c ^ b) - rot(b, 24)) >>> 0;
}
export function nativeWeightedIndex(weights, locRand) {
  if (weights.some(weight => !Number.isInteger(weight) || weight < 0)) throw new RangeError('weight');
  const total = weights.reduce((a, b) => a + b, 0);
  if (total > 0x7fffffff) throw new RangeError('native total overflow');
  if (!total) return null;
  if (weights.length === 1) return 0;
  const picked = (locRand >>> 0) % total + 1;
  let accumulated = 0;
  for (let i = 0; i < weights.length; ++i) {
    accumulated += weights[i];
    if (accumulated >= picked) return i;
  }
  throw new Error('weight invariant');
}
export function staticWeatherChoices(frame, foregroundWeights, backgroundWeights) {
  const seed = weatherSeed(frame);
  const locRand = foregroundWeights.length > 1 || backgroundWeights.length > 1 ? nativeStaticLocationMix(seed) : 0;
  return { seed, loc_rand: locRand, foreground: nativeWeightedIndex(foregroundWeights, locRand),
    background: nativeWeightedIndex(backgroundWeights, locRand) };
}
