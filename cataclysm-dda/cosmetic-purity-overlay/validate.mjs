import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { avalanche, weatherSeed, npcKey, acceptNpcColor, collisionColor, boundedWord,
  nativeStaticLocationMix, nativeWeightedIndex, staticWeatherChoices } from './model.mjs';

const own = path.dirname(fileURLToPath(import.meta.url));
const upstream = process.env.CDDA_PRISTINE_ROOT ??
  'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let assertions = 0;
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); ++assertions; }
function check(condition, label) { assert.ok(condition, label); ++assertions; }
const pins = JSON.parse(fs.readFileSync(path.join(own, 'source-pins.json')));
const preparation = JSON.parse(fs.readFileSync(path.join(own, 'SOURCE-PREPARATION.json')));
const originals = new Map();
for (const pin of pins.files) {
  const bytes = fs.readFileSync(path.join(upstream, pin.source));
  equal(bytes.length, pin.bytes, `${pin.source} bytes`);
  equal(sha(bytes), pin.sha256, `${pin.source} SHA-256`);
  originals.set(pin.source, bytes.toString('utf8'));
}
equal(pins.upstream_commit, '7b2efa5cea38e4d4d97dd0e63b28b9148623da59', 'source commit');
const patch = fs.readFileSync(path.join(own, 'cosmetic-purity.patch'), 'utf8');
equal(Buffer.byteLength(patch), preparation.patch.bytes, 'patch bytes');
equal(sha(patch), preparation.patch.sha256, 'patch SHA-256');

function parsePatch(text) {
  const files = [];
  let file, hunk;
  for (const line of text.slice(0, -1).split('\n')) {
    if (line.startsWith('diff --git ')) {
      const match = /^diff --git a\/(\S+) b\/(\S+)$/.exec(line);
      check(match && match[1] === match[2], 'patch path');
      file = { source: match[1], hunks: [], created: false };
      files.push(file); hunk = undefined;
    } else if (line === 'new file mode 100644') {
      file.created = true;
    } else if (line.startsWith('@@ ')) {
      const match = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/.exec(line);
      check(match, 'hunk header');
      hunk = { oldStart: +match[1], oldCount: +match[2], newStart: +match[3], newCount: +match[4], lines: [] };
      file.hunks.push(hunk);
    } else if (/^(---|\+\+\+) /.test(line)) {
      hunk = undefined;
    } else if (hunk && /^[ +\-]/.test(line)) {
      hunk.lines.push(line);
    } else throw new Error(`unsupported patch line: ${line}`);
  }
  return files;
}
function apply(source, file, reverse) {
  const sourceLines = source ? source.slice(0, -1).split('\n') : [];
  const output = []; let cursor = 0;
  for (const hunk of file.hunks) {
    const start = reverse ? hunk.newStart : hunk.oldStart;
    const count = reverse ? hunk.newCount : hunk.oldCount;
    const targetCount = reverse ? hunk.oldCount : hunk.newCount;
    const at = start === 0 ? 0 : start - 1;
    const removed = hunk.lines.filter(line => line[0] === ' ' || line[0] === (reverse ? '+' : '-')).map(line => line.slice(1));
    const added = hunk.lines.filter(line => line[0] === ' ' || line[0] === (reverse ? '-' : '+')).map(line => line.slice(1));
    equal(removed.length, count, 'hunk source line count');
    equal(added.length, targetCount, 'hunk target line count');
    check(at >= cursor, 'nonoverlapping patch hunks');
    equal(sourceLines.slice(at, at + count), removed, 'exact original hunk bytes');
    output.push(...sourceLines.slice(cursor, at), ...added);
    cursor = at + count;
  }
  output.push(...sourceLines.slice(cursor));
  return output.length ? output.join('\n') + '\n' : '';
}
const files = parsePatch(patch);
equal(files.map(file => file.source), ['src/cata_tiles.cpp', 'src/overmap_ui.cpp', 'src/cdda_presentation_hash.h'], 'exact patch footprint');
const generated = new Map();
for (const file of files) {
  const original = file.created ? '' : originals.get(file.source);
  check(original !== undefined, 'only pinned source edited');
  const result = apply(original, file, false);
  const expected = fs.readFileSync(path.join(own, file.created ? 'cpp/cdda_presentation_hash.h' : `generated/${file.source}`), 'utf8');
  equal(result, expected, 'forward patch exact');
  equal(apply(result, file, true), original, 'reverse patch exact');
  generated.set(file.source, result);
}
for (const output of preparation.generated) {
  equal(sha(generated.get(output.source)), output.sha256, 'prepared CPP hash');
  equal(Buffer.byteLength(generated.get(output.source)), output.bytes, 'prepared CPP bytes');
}
const tiles = originals.get('src/cata_tiles.cpp'), patchedTiles = generated.get('src/cata_tiles.cpp');
const overmap = originals.get('src/overmap_ui.cpp'), patchedOvermap = generated.get('src/overmap_ui.cpp');
const count = (source, expression) => [...source.matchAll(expression)].length;
equal(count(tiles, /\brng_bits\s*\(/g) - count(patchedTiles, /\brng_bits\s*\(/g), 1, 'one tile RNG site only');
equal(count(overmap, /\bone_in\s*\(/g) - count(patchedOvermap, /\bone_in\s*\(/g), 2, 'two NPC RNG sites only');
equal(count(patchedTiles, /cdda_presentation_v1::weather_seed\s*\(/g), 1, 'one bound WEATHER call');
equal(count(patchedOvermap, /cdda_presentation_v1::accept_npc_color\s*\(/g), 2, 'two bound NPC calls');
check(patchedTiles.includes('{ pos.x(), pos.y(), pos.z() }, { screen_pos.x, screen_pos.y }'), 'existing tile/screen input values');
equal(count(patchedOvermap, /static_cast<int>\( iter->second.count \)/g), 2, 'native signed chance conversion preserved');
equal(count(patchedOvermap, /iter->second\.color != np_color &&/g), 2, 'color short circuit preserved');
for (const tag of ['nearby', 'followers']) check(patchedOvermap.includes(`npc_pass::${tag}`), 'native branch domain retained');
for (const anchor of ['iter->second.count++;', 'npc_color[pos] = { np_color, 1 };', 'if( np->guaranteed_hostile() )',
  'if( has_debug_vision || overmap_buffer.seen_more_than( pos, om_vision_level::details ) )',
  'for( npc * const &np : followers )', 'const int om_map_width = OVERMAP_WINDOW_WIDTH;',
  'const int om_map_height = OVERMAP_WINDOW_HEIGHT;', 'oter_opts.npc_color', 'ret.first = "@";']) {
  equal(patchedOvermap.split(anchor).length, overmap.split(anchor).length, `native admission/grid/output: ${anchor}`);
}
const unchangedSelection = tiles.slice(tiles.indexOf('    // make sure we aren\'t going to rotate'), tiles.indexOf('\nbool cata_tiles::draw_sprite_at'));
check(patchedTiles.includes(unchangedSelection), 'entire native rotate/mix/clock/weighted output block byte unchanged');
check(originals.get('src/weighted_list.h').includes('const int picked = ( randi % ( this->total_weight ) ) + 1;'), 'exact native weighted modulo');
check(originals.get('src/overmap.h').includes('size_t count = 0;'), 'native count is size_t');
check(originals.get('src/character_id.h').includes('int get_value() const'), 'native character_id value is int');
check(originals.get('src/character.h').includes('character_id getID() const;'), 'NPC ID accessor const declaration');
check(originals.get('src/character.cpp').includes('character_id Character::getID() const\n{\n    return this->id;\n}'), 'NPC ID accessor returns existing scalar only');
check(originals.get('src/rng.cpp').includes('return rng_uint_dist( rng_get_engine() );'), 'original WEATHER advances shared engine');
check(originals.get('src/rng.cpp').includes('return chance <= 1 || rng( 0, chance - 1 ) == 0;'), 'native acceptance bound');

const cpp = generated.get('src/cdda_presentation_hash.h');
const rust = fs.readFileSync(path.join(own, 'rust/src/lib.rs'), 'utf8');
const rustSelection = fs.readFileSync(path.join(own, 'rust/src/selection.rs'), 'utf8');
for (const text of [cpp, rust, rustSelection]) {
  check(!/\b(rng_bits|rng_get_engine|rng_set_engine_seed|random_device|steady_clock|system_clock|get_map|get_avatar|get_player_character|SDL_GetTicks)\s*\(/.test(text), 'helpers have no world/engine/clock calls');
  check(!/\b(thread_local|static\s+mut|static\s+(?:const\s+)?(?:std::|unsigned|int|float|double))/g.test(text), 'no retained RNG state');
}
for (const literal of ['0x7feb352d', '0x846ca68b', '0x9e3779b9', '2166136261', '16777619',
  'cdda.presentation.weather.v1', 'cdda.presentation.npc-color.v1']) {
  check(cpp.includes(literal) && rust.includes(literal), 'C++/Rust algorithm literals agree');
}
check(cpp.includes('native_chance <= 1') && rust.includes('frame.native_chance <= 1'), 'native one_in branch source parity');
check(cpp.includes('word >= threshold') && rust.includes('word >= threshold'), 'rejection source parity');
check(rustSelection.includes('loc_rand % total + 1') && rustSelection.includes('accumulated >= picked'), 'Rust consumer native weighted rule');

// Independent BigInt arithmetic oracle catches signed JS shift/multiply errors.
const mask = 0xffff_ffffn;
function bigAvalanche(word) {
  word &= mask; word = ((word ^ (word >> 16n)) * 0x7feb352dn) & mask;
  word = ((word ^ (word >> 15n)) * 0x846ca68bn) & mask;
  return (word ^ (word >> 16n)) & mask;
}
function bigTranscript(frame, npc) {
  const bytes = [];
  const word = value => { const n = BigInt.asUintN(32, BigInt(value)); for (let shift = 0n; shift < 32n; shift += 8n) bytes.push(Number((n >> shift) & 255n)); };
  const text = value => { const encoded = Buffer.from(value, 'utf8'); word(encoded.length); word(0); bytes.push(...encoded); };
  text(npc ? 'cdda.presentation.npc-color.v1' : 'cdda.presentation.weather.v1');
  if (npc) {
    for (const name of ['origin', 'cursor', 'position']) for (const component of frame[name]) word(component);
    for (const name of ['npc_id', 'native_chance', 'pass']) word(frame[name]);
  } else {
    text(frame.resolved_tile_id);
    for (const component of [...frame.tile_position, ...frame.screen_position]) word(component);
  }
  let value = 2166136261n;
  for (const byte of bytes) value = ((value ^ BigInt(byte)) * 16777619n) & mask;
  return Number(bigAvalanche(value));
}
function bigMix(seed) {
  const rot = (word, bits) => ((word << bits) | (word >> (32n - bits))) & mask;
  let a = BigInt(seed), b = (-a) & mask, c = (a * a) & mask;
  for (const [target, source, shift] of [['c','b',14n],['a','c',11n],['b','a',25n],['c','b',16n],['a','c',4n],['b','a',14n],['c','b',24n]]) {
    const values = {a,b,c}; values[target] = ((values[target] ^ values[source]) - rot(values[source], shift)) & mask;
    ({a,b,c} = values);
  }
  return Number(c);
}
const fixtures = JSON.parse(fs.readFileSync(path.join(own, 'fixtures.json')));
for (const fixture of fixtures.weather) {
  equal(staticWeatherChoices(fixture.input, fixture.foreground_weights, fixture.background_weights), fixture.expected, 'weather golden static native rule');
  equal(weatherSeed(fixture.input), bigTranscript(fixture.input, false), 'weather canonical transcript independent oracle');
  equal(nativeStaticLocationMix(fixture.expected.seed), bigMix(fixture.expected.seed), 'lookup3 independent arithmetic oracle');
}
for (const fixture of fixtures.npc_cases) {
  const frame = {...fixtures.npc_base, native_chance: fixture.native_chance};
  equal(npcKey(frame), fixture.key, 'NPC key golden');
  equal(npcKey(frame), bigTranscript(frame, true), 'NPC canonical transcript independent oracle');
  equal(acceptNpcColor(frame), fixture.accepted, 'native signed acceptance golden');
  equal(collisionColor('green', 'green', frame), 'green', 'same color unchanged');
  equal(collisionColor('green', 'red', frame), fixture.accepted ? 'red' : 'green', 'collision selection');
}
for (const {key, bound, ...expected} of fixtures.rejection_cases) equal(boundedWord(key, bound), expected, 'golden rejection path');
for (const bound of [2, 3, 7, 11, 257, 65537, 1073741825, 2147483647]) {
  const accepted = 2n ** 32n - BigInt(((-bound) >>> 0) % bound);
  equal(accepted % BigInt(bound), 0n, 'accepted 32-bit interval is an exact bound multiple');
  for (let key = 0; key < 96; ++key) {
    const result = boundedWord(key * 44444443 >>> 0, bound);
    check(result.value >= 0 && result.value < bound, 'native range bounds');
    check(result.word >= result.threshold, 'incomplete residue interval rejected');
    equal(result.value, result.word % bound, 'native zero residue uses exact bound');
    equal(avalanche(key * 44444443 >>> 0), Number(bigAvalanche(BigInt(key * 44444443 >>> 0))), 'hash independent arithmetic');
  }
}
// Exhaustive reduced-width residue populations demonstrate the rejection rule,
// not stochastic uniformity of real frame inputs or native runtime execution.
for (const bound of [2, 3, 5, 7, 11, 17, 31, 63, 127]) {
  const threshold = (256 - bound) % bound, populations = Array(bound).fill(0);
  for (let word = threshold; word < 256; ++word) ++populations[word % bound];
  check(populations.every(value => value === (256 - threshold) / bound), 'reduced-width accepted residues equal');
}
const sample = fixtures.weather[0].input;
const before = JSON.stringify(sample), seed = weatherSeed(sample);
for (let repeat = 0; repeat < 96; ++repeat) {
  const collision = {...fixtures.npc_base, native_chance: repeat + 2, pass: repeat % 2 + 1};
  const saved = JSON.stringify(collision), accepted = acceptNpcColor(collision);
  equal(weatherSeed(sample), seed, 'unchanged frame repeat/interleave');
  equal(acceptNpcColor(collision), accepted, 'no retained state between calls');
  equal(JSON.stringify(collision), saved, 'NPC input immutable');
  equal(JSON.stringify(sample), before, 'weather input immutable');
}
equal(staticWeatherChoices(sample, [1], []), {seed, loc_rand: 0, foreground: 0, background: null}, 'native single-sprite no location mixing');
equal(nativeWeightedIndex([0, 0], 0xffffffff), null, 'zero weights produce no sprite');
equal(nativeWeightedIndex([0, 1, 0], 0), 1, 'zero-weight slots skipped');
equal(nativeWeightedIndex([3, 1, 5], 0), 0, 'native modulo first boundary');
equal(nativeWeightedIndex([3, 1, 5], 3), 1, 'native modulo middle boundary');
equal(nativeWeightedIndex([3, 1, 5], 8), 2, 'native modulo last boundary');
equal(nativeWeightedIndex([3, 1, 5], 9), 0, 'native modulo wrap');
// Synthetic *admitted presentation* trace, not simulation: a duplicate follower
// contributes again, and equal-color collisions still increment native count.
const candidates = [{id:123,color:'green',pass:1},{id:124,color:'green',pass:1},
  {id:125,color:'red',pass:1},{id:123,color:'green',pass:2}];
let selected, nativeCount = 0, decisionCounts = [];
for (const candidate of candidates) {
  ++nativeCount;
  if (selected === undefined) selected = candidate.color;
  else if (selected !== candidate.color) {
    decisionCounts.push(nativeCount);
    selected = collisionColor(selected, candidate.color, {...fixtures.npc_base, native_chance:nativeCount,
      npc_id:candidate.id,pass:candidate.pass});
  }
}
equal(nativeCount, 4, 'duplicate follower retained in admitted count');
equal(decisionCounts[0], 3, 'same-color candidate increments count before next decision');
for (const name of ['native_compiled','rust_compiled','native_rust_connected','browser_tested','full_game_render_purity_verified','pristine_rng_trace_compatible']) {
  equal(preparation[name], false, 'pending verification remains explicit');
}
const evidence = { schema: 1, status: 'SOURCE_AND_LIGHT_NODE_CHECKS_PASS', upstream_commit: pins.upstream_commit,
  assertions, source_files_pinned: pins.files.length, reviewed_native_cosmetic_rng_sites: 3,
  original_cpp_files_in_patch: 2, original_headers_in_patch: 0,
  forward_and_reverse_patch_verified_in_memory: true, independent_bigint_reference_checked: true,
  synthetic_fixtures_only: true, native_compiled: false, rust_compiled: false, rust_tests_executed: false,
  native_rust_connected: false, browser_tested: false, full_game_render_purity_verified: false,
  pristine_sources_unchanged: true, existing_build_untouched: true,
  patch_sha256: sha(patch), fixture_sha256: sha(fs.readFileSync(path.join(own,'fixtures.json'))) };
fs.writeFileSync(path.join(own, 'SOURCE-CHECKS.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
