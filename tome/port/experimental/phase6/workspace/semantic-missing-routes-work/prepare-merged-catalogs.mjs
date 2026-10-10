#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Source candidate. Parent runs sequentially after reviewing the new delta.
// Writes only fresh derived JSON inside this agent's own working directory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { finished } from 'node:stream/promises';
import { once } from 'node:events';
import { parseUniqueJson, validateDelta } from './merge-delta.mjs';
import { streamMergeJson } from './stream-merge.mjs';

const directory = import.meta.dirname, project = path.dirname(directory), candidate = path.join(directory, 'candidate');
const output = path.join(directory, 'merged-candidate');
const read = name => parseUniqueJson(fs.readFileSync(path.join(candidate, name), 'utf8'));
const manifest = read('source-manifest.json');
const deltaBytes = fs.readFileSync(path.join(candidate, 'semantic-route-delta.json'));
const deltaArtifact = manifest.artifacts?.find(item => item.file === 'semantic-route-delta.json');
if (!deltaArtifact || deltaBytes.length !== deltaArtifact.bytes ||
    crypto.createHash('sha256').update(deltaBytes).digest('hex') !== deltaArtifact.sha256) throw Error('Reviewed delta SHA mismatch');
const delta = parseUniqueJson(deltaBytes.toString('utf8'));
validateDelta(delta);
if (!Array.isArray(manifest.base_catalogue_inputs) || manifest.base_catalogue_inputs.length !== 4) throw Error('Reviewed base catalogue inputs required');
fs.mkdirSync(output, { recursive: true });
const inserts = {
  english: { root: delta.english },
  japanese: { root: delta.japanese_base },
  registry: { entries: delta.registry.entries, routes: delta.registry.routes },
  supplements: { root: delta.japanese_supplement },
};
const results = [];
for (const item of manifest.base_catalogue_inputs) {
  const finalPath = path.join(output, item.kind + '.json'), temporaryPath = finalPath + '.partial';
  const writer = fs.createWriteStream(temporaryPath, { flags: 'w' });
  const completion = finished(writer); completion.catch(() => {});
  try {
    const result = await streamMergeJson(fs.createReadStream(path.join(project, item.file), { highWaterMark: 65536 }), async bytes => {
      if (!writer.write(bytes)) await once(writer, 'drain');
    }, inserts[item.kind], item.sha256);
    writer.end(); await completion;
    fs.renameSync(temporaryPath, finalPath);
    results.push({ kind: item.kind, file: path.basename(finalPath), ...result });
  } catch (error) {
    writer.destroy();
    // The unverified .partial remains unselected for diagnostics, never loaded.
    throw error;
  }
}
const result = { source_commit: delta.source_commit, base_ids: manifest.base_catalogue_semantic_ids, delta_ids: 20,
  merged_base_ids: manifest.base_catalogue_semantic_ids + 20, dream_extension_preserved_as_separate_original_stage6: true,
  requires_exact_route_guard: true, runtime_verified: false, results, memory: process.memoryUsage() };
fs.writeFileSync(path.join(output, 'merge-result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
