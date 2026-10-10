#!/usr/bin/env node
// GPL-3.0-or-later. Read-only provenance audit; never evaluates Lua source.
import fs from 'node:fs';
import path from 'node:path';
const [output, inventory] = process.argv.slice(2).map(value => path.resolve(value));
if (!output || !inventory) throw new Error('Use audit-source-locations.mjs OUTPUT INVENTORY');
const registry = JSON.parse(fs.readFileSync(path.join(output, 'catalogs/registry.json'), 'utf8'));
const roots = JSON.parse(fs.readFileSync(path.join(inventory, 'summary.json'), 'utf8')).sourceRoots;
const exists = new Map(), missing = new Map();
let checkedLocations = 0, missingCandidateLocations = 0, missingDeclaredLocations = 0;
for (const [id, entry] of Object.entries(registry.entries)) for (const location of entry.source_locations) {
  checkedLocations++;
  const key = `${location.source_root_id}:${location.file}`;
  let present = exists.get(key);
  if (present === undefined) {
    const root = roots[Number(location.source_root_id.replace('root_', '')) - 1];
    present = !!root && fs.existsSync(path.join(root, location.file)); exists.set(key, present);
  }
  if (present) continue;
  if (location.line === null) missingDeclaredLocations++; else missingCandidateLocations++;
  const item = missing.get(key) ?? { source_root_id: location.source_root_id, file: location.file, semantic_ids: [], declared_only: true };
  item.semantic_ids.push(id); if (location.line !== null) item.declared_only = false; missing.set(key, item);
}
const result = { checked_locations: checkedLocations, distinct_source_files: exists.size, missing_candidate_locations: missingCandidateLocations, missing_declared_locations: missingDeclaredLocations, missing_distinct_files: missing.size, unresolved_files: [...missing.values()], original_source_modified: false };
fs.writeFileSync(path.join(output, 'source-location-audit.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, unresolved_files: result.unresolved_files.slice(0, 10).map(file => ({ ...file, semantic_ids: file.semantic_ids.slice(0, 2) })) }));
