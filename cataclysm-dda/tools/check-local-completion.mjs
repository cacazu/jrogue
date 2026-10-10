import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// Completion means the requested game is verified through a local Node server.
// Missing full-game evidence fails closed. This checker performs no hosting action.
const [root = process.cwd(), output = path.join(root, 'completion-gates.json')] = process.argv.slice(2);
const required = [
  ['pristine_source', 'upstream-integrity.json', evidence => evidence.result === 'pass' && evidence.matched_files === evidence.expected_files],
  ['source_provenance', 'acquisition.json', evidence => evidence.acquisition_completed === true && /^[a-f0-9]{64}$/.test(evidence.source_archive_sha256 ?? '')],
  ['full_engine_build', 'evidence/full-engine-build.json', evidence => evidence.result === 'pass' && evidence.full_engine === true],
  ['four_layer_integration', 'evidence/four-layer-integration.json', evidence => evidence.result === 'pass' && evidence.connected_to_original_engine === true],
  ['full_semantic_translation', 'evidence/full-translation.json', evidence => evidence.result === 'pass' && evidence.missing_ids === 0 && evidence.untranslated === 0 && evidence.placeholder_mismatches === 0 && evidence.scope === 'entire_game_and_content'],
  ['deterministic_simulation', 'evidence/full-game-determinism.json', evidence => evidence.result === 'pass' && evidence.game_state_and_rng_verified === true],
  ['render_purity', 'evidence/full-game-render-purity.json', evidence => evidence.result === 'pass' && evidence.original_engine_rng_verified === true],
  ['save_compatibility', 'evidence/full-game-save.json', evidence => evidence.result === 'pass' && evidence.rng_distribution_caches_verified === true && evidence.version_failures_verified === true],
  ['desktop_and_mobile_browser', 'evidence/full-browser-flows.json', evidence => evidence.result === 'pass' && evidence.desktop === true && evidence.mobile === true && evidence.full_game_flows === true],
  ['licenses_and_source_availability', 'evidence/local-delivery-notices.json', evidence => evidence.result === 'pass' && evidence.asset_manifest_audited === true && evidence.port_source_available === true],
  ['local_node_delivery', 'evidence/local-node-delivery.json', evidence => evidence.result === 'pass' && evidence.served_by_node === true && evidence.loopback_only === true && evidence.html_served === true && evidence.wasm_mime_verified === true && evidence.runtime_assets_verified === true && evidence.no_external_runtime_requests === true],
];
const gates = [];
for (const [gate, file, predicate] of required) {
  try {
    const evidence = JSON.parse((await readFile(path.join(root, file), 'utf8')).replace(/^\uFEFF/, ''));
    const passed = predicate(evidence);
    gates.push({ gate, file, result: passed ? 'pass' : 'blocked', reason: passed ? 'verified evidence' : 'evidence does not establish required scope' });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    gates.push({ gate, file, result: 'blocked', reason: 'required evidence has not been produced' });
  }
}
const result = {
  schema_version: 1,
  checked_at: new Date().toISOString(),
  completion_scope: 'node_localhost_only',
  result: gates.every(gate => gate.result === 'pass') ? 'ready' : 'blocked',
  passed: gates.filter(gate => gate.result === 'pass').length,
  pending: gates.filter(gate => gate.result !== 'pass').length,
  gates,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (result.result !== 'ready') process.exitCode = 2;
