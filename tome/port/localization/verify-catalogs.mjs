#!/usr/bin/env node
// GPL-3.0-or-later. Structural/coverage checks only; original rules never run.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { specs, placeholderSafety, sectionFile } from './build-catalogs.mjs';

const output = path.resolve(process.argv[2] ?? path.dirname(new URL(import.meta.url).pathname));
const load = name => JSON.parse(fs.readFileSync(path.join(output, name), 'utf8'));
const en = load('catalogs/en.json'), ja = load('catalogs/ja.json'), registry = load('catalogs/registry.json');
const summary = load('catalog-build-result.json');
const keys = Object.keys(en).sort(), translated = Object.keys(ja).sort();
assert.deepEqual(keys, translated, 'English/Japanese semantic IDs differ');
assert.deepEqual(keys, Object.keys(registry.entries).sort(), 'Registry/catalog semantic IDs differ');
assert.equal(registry.default_locale, 'ja_JP');
assert.equal(registry.source_commit, '624a67329fe2ad440c5b344785a9c73fcf22ae63');
assert.equal(registry.schema_version, 1);

let missing = 0, identicalOfficial = 0, parameterized = 0, sourceLocations = 0, assertions = 5;
const routed = new Set(), pairs = new Set();
for (const id of keys) {
  const entry = registry.entries[id];
  assert.match(id, /^[a-z0-9_.]+$/, `Invalid semantic ID ${id}`);
  assert.equal(typeof en[id], 'string');
  assert.ok(ja[id] === null || typeof ja[id] === 'string');
  assert.equal(entry.native_effective_metadata_validation_required, true);
  assert.equal(entry.owner + '.', id.slice(0, entry.owner.length + 1));
  assert.equal(entry.japanese_status === 'missing_official_translation', ja[id] === null);
  assert.ok(Array.isArray(entry.declared_metadata_variants) && entry.declared_metadata_variants.length > 0);
  const calculated = placeholderSafety(en[id], ja[id], entry.japanese_args_order, entry.special_tokens);
  assert.equal(entry.printf_contract.safe, calculated.safe, `Printf contract differs: ${id}`);
  assert.equal(entry.printf_contract.status, calculated.status, `Printf status differs: ${id}`);
  const count = specs(en[id]).length;
  if (count) parameterized++;
  for (const index of entry.japanese_args_order) {
    assert.ok(Number.isSafeInteger(index) && index > 0 && index <= count, `Invalid argument order: ${id}`);
    assertions++;
  }
  if (ja[id] === null) missing++;
  else if (en[id] === ja[id]) identicalOfficial++;
  for (const location of entry.source_locations) {
    assert.ok(location.file.startsWith('game/'), `Unexpected source location: ${id}`);
    assert.ok(location.line === null || Number.isSafeInteger(location.line) && location.line > 0);
    sourceLocations++; assertions += 2;
  }
  assertions += 9;
}
for (const route of registry.routes) {
  const pair = route.tag + '\0' + route.source;
  assert.ok(!pairs.has(pair), 'Duplicate source/tag route'); pairs.add(pair);
  assert.ok(route.aliases.length > 0);
  assert.equal(new Set(route.aliases).size, route.aliases.length);
  assert.ok(route.default_id === null || route.aliases.includes(route.default_id));
  for (const alias of route.aliases) {
    assert.ok(Object.hasOwn(en, alias), `Unknown alias ${alias}`);
    assert.equal(en[alias], route.source);
    assert.equal(registry.entries[alias].tag, route.tag);
    routed.add(alias); assertions += 3;
  }
  assertions += 4;
}
assert.equal(routed.size, keys.length, 'An entry has no original text route');
assert.equal(summary.semantic_ids, keys.length);
assert.equal(summary.source_tag_routes, pairs.size);
assert.equal(summary.missing_official_japanese_ids, missing);
assert.equal(load('missing-official-ja.json').length, missing);
assert.equal(sectionFile('tome-possessors/data/talents/psionic/possession.lua', 'game/addons/tome-possessors/data/locales/ja_JP.lua'), 'game/addons/tome-possessors/data/talents/psionic/possession.lua');
assert.equal(sectionFile('tome-items-vault/overload/mod/dialogs/ItemsVault.lua', 'game/addons/tome-items-vault/data/locales/ja_JP.lua'), 'game/addons/tome-items-vault/overload/mod/dialogs/ItemsVault.lua');
assertions += 7;
const result = {
  schema_version: 1, source_commit: registry.source_commit, structural_assertions_passed: assertions,
  semantic_ids: keys.length, source_tag_routes: pairs.size, source_locations: sourceLocations,
  parameterized_ids: parameterized, missing_official_japanese_ids: missing,
  identical_official_translations_preserved: identicalOfficial,
  unknown_aliases: 0, missing_route_ids: 0, placeholder_contract_mismatches: 0,
  maximum_id_characters: Math.max(...keys.map(id => id.length)),
  memory_rss_bytes: process.memoryUsage().rss,
  gameplay_or_rng_called: false, native_runtime_effective_metadata_check_required: true,
  complete_translation_coverage_claimed: false, native_game_boot_or_browser_verified: false,
};
fs.writeFileSync(path.join(output, 'catalog-validation-result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
