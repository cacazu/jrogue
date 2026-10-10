// SPDX-License-Identifier: GPL-3.0-or-later
// Source candidate. It creates new objects; it never mutates base catalogues.
const commit = '624a67329fe2ad440c5b344785a9c73fcf22ae63';
const own = (object, key) => Object.hasOwn(object, key);
const fail = message => { throw new Error(message); };
const keys = object => Object.keys(object).sort();
const sameKeys = (left, right) => JSON.stringify(keys(left)) === JSON.stringify(keys(right));

// Reject duplicate keys before they can be hidden by JSON.parse. This reader is
// for the small reviewed delta/index or loader input, not a gameplay serializer.
export function parseUniqueJson(text) {
  if (typeof text !== 'string') fail('JSON text required');
  let at = 0;
  const white = () => { while (/[ \t\r\n]/.test(text[at] ?? '') && at < text.length) at++; };
  function string() {
    const begin = at++;
    let escaped = false;
    while (at < text.length) {
      const character = text[at++];
      if (!escaped && character === '"') return JSON.parse(text.slice(begin, at));
      if (!escaped && character === '\\') escaped = true;
      else escaped = false;
    }
    fail('unterminated JSON string');
  }
  function value(depth = 0) {
    if (depth > 256) fail('JSON depth limit');
    white();
    const character = text[at];
    if (character === '"') return string();
    if (character === '{') {
      at++; white(); const result = Object.create(null);
      if (text[at] === '}') { at++; return result; }
      while (true) {
        white(); if (text[at] !== '"') fail('JSON object key required');
        const key = string(); if (own(result, key)) fail('duplicate JSON key: ' + key);
        white(); if (text[at++] !== ':') fail('JSON colon required');
        result[key] = value(depth + 1); white();
        const delimiter = text[at++]; if (delimiter === '}') return result;
        if (delimiter !== ',') fail('JSON object delimiter required');
      }
    }
    if (character === '[') {
      at++; white(); const result = [];
      if (text[at] === ']') { at++; return result; }
      while (true) {
        result.push(value(depth + 1)); white();
        const delimiter = text[at++]; if (delimiter === ']') return result;
        if (delimiter !== ',') fail('JSON array delimiter required');
      }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(at));
    if (!token) fail('JSON value required');
    at += token[0].length;
    return JSON.parse(token[0]);
  }
  const result = value(); white(); if (at !== text.length) fail('trailing JSON data');
  return result;
}

export function validateDelta(delta) {
  if (delta?.schema_version !== 1 || delta.source_commit !== commit) fail('delta version/commit mismatch');
  const { english, japanese_base: japaneseBase, japanese_supplement: japanese, registry, route_index: index } = delta;
  if (!english || !japaneseBase || !japanese || !registry || !index || keys(english).length !== 20 ||
      !sameKeys(english, japaneseBase) || !sameKeys(english, japanese) || !sameKeys(english, registry.entries)) fail('delta ID coverage mismatch');
  if (registry.source_commit !== commit || registry.schema_version !== 1 || registry.routes?.length !== 20 ||
      registry.japanese_configuration?.length !== 0 || index.routes?.length !== 20) fail('delta registry/index mismatch');
  const sources = new Set(), pairs = new Set();
  for (const route of registry.routes) {
    const id = route.default_id, entry = registry.entries[id];
    if (!/^[a-z0-9_.]+$/.test(id) || !entry || !own(english, id) || english[id] !== route.source ||
        entry.tag !== route.tag || route.aliases?.length !== 1 || route.aliases[0] !== id || route.format_ambiguity !== false ||
        japaneseBase[id] !== null || typeof japanese[id] !== 'string' || japanese[id].length === 0 ||
        /%|\{[^}]*\}/.test(english[id]) || /%|\{[^}]*\}/.test(japanese[id]) ||
        entry.japanese_args_order?.length !== 0 || entry.special_tokens?.length !== 0 ||
        entry.parameters?.length !== 0 || entry.printf_contract?.safe !== true) fail('delta finite label/placeholder contract mismatch');
    const pair = JSON.stringify([route.source, route.tag]);
    if (pairs.has(pair) || sources.has(route.source)) fail('duplicate delta source/tag ownership');
    pairs.add(pair); sources.add(route.source);
    const indexed = index.routes.find(row => row.semantic_id === id);
    if (!indexed || indexed.source !== route.source || indexed.tag !== route.tag ||
        !indexed.original_consumer || !indexed.overlay_consumer || !Array.isArray(indexed.stable_short_names) ||
        indexed.stable_short_names.length < 1 || new Set(indexed.stable_short_names).size !== indexed.stable_short_names.length ||
        ![indexed.original_consumer, indexed.overlay_consumer].every(location =>
          typeof location.file === 'string' && ['game/engines/default/engine/interface/ActorTalents.lua', 'game/engines/default/engine/Faction.lua'].includes(location.file) &&
          Number.isInteger(location.line) && location.line > 0)) fail('delta producer/consumer index mismatch');
  }
  return true;
}

// Keep the existing DEATH_DREAM extension as the existing separate stage 6.
// This delta is merged into fresh stage 1/2/3 inputs and its supplement into
// fresh stage 4. Do not try to pass this file to the hardcoded dream loader.
export function mergeReviewedDelta(base, delta) {
  validateDelta(delta);
  const { english, japanese, registry, supplements = {} } = base;
  if (!english || !japanese || !registry || !sameKeys(english, japanese) || !sameKeys(english, registry.entries) ||
      registry.schema_version !== 1 || registry.source_commit !== commit) fail('base ID/commit mismatch');
  const beforeIds = keys(english);
  const deltaSources = new Set(Object.values(delta.english));
  for (const id of keys(delta.english)) {
    if (own(english, id) || own(japanese, id) || own(registry.entries, id) || own(supplements, id)) fail('delta/base semantic ID collision: ' + id);
  }
  // Any existing other-tag route must be reviewed before introducing a new
  // source. Exact guards must not shadow an existing base meaning silently.
  if (registry.routes.some(route => deltaSources.has(route.source))) fail('delta/base source route collision');
  const merged = {
    english: { ...english, ...delta.english },
    japanese: { ...japanese, ...delta.japanese_base },
    registry: { ...registry, entries: { ...registry.entries, ...delta.registry.entries }, routes: [...registry.routes, ...delta.registry.routes] },
    supplements: { ...supplements, ...delta.japanese_supplement },
    route_index: structuredClone(delta.route_index),
    loader_status: { base_ids: beforeIds.length, delta_ids: 20, base_routes: registry.routes.length, delta_routes: 20,
      requires_exact_route_guard: true, original_dream_extension_preserved_separately: true, runtime_verified: false },
  };
  for (const id of beforeIds) {
    if (merged.english[id] !== english[id] || merged.japanese[id] !== japanese[id] || merged.registry.entries[id] !== registry.entries[id]) fail('base semantic value modified');
  }
  return merged;
}

function pathMatches(actual, expected) {
  if (typeof actual !== 'string') return false;
  actual = actual.replace(/^@/, '').replaceAll('\\', '/').replace(/^\/+/, '');
  const virtual = expected.replace(/^game\/engines\/default\//, '');
  return actual === expected || actual.endsWith('/' + expected) || actual === virtual || actual.endsWith('/' + virtual);
}

// Install on the actual SemanticTextWasm object before its native bridge is
// registered. The native bridge calls resolver.resolve; the raw request()
// method is not guarded and must not be used as a native resolve path.
export function applyExactRouteGuard(resolver, index, { variant = 'original' } = {}) {
  if (!resolver || typeof resolver.resolve !== 'function' || !['original', 'overlay'].includes(variant)) fail('resolver/guard variant required');
  if (index?.schema_version !== 1 || index.source_commit !== commit || index.routes?.length !== 20) fail('exact route index required');
  const rows = new Map(index.routes.map(row => [row.source, row]));
  if (rows.size !== 20) fail('duplicate indexed source');
  const previous = resolver.resolve;
  function guarded(source, tag, file, line, locale) {
    const row = rows.get(source);
    if (row) {
      const location = row[variant + '_consumer'];
      if (tag !== row.tag || !pathMatches(file, location.file) || line !== location.line) return { ok: false, reason: 'unknown_source_tag' };
    }
    return previous.call(this, source, tag, file, line, locale);
  }
  resolver.resolve = guarded;
  return {
    uninstall() { if (resolver.resolve !== guarded) fail('guard ownership changed'); resolver.resolve = previous; },
  };
}
