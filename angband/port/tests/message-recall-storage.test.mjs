import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = 'migration/message-recall-storage-data/';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const strip = source => source.replace(/\/\* AB_MESSAGE_RECALL_BEGIN \*\/[\s\S]*?\/\* AB_MESSAGE_RECALL_END \*\//g, '');

test('message queue and semantic serializer restore exact prior bytes, rejecting native changes', () => {
  for (const file of ['message.c', 'web-semantic.c', 'web-semantic.h']) {
    const source = read('logic/' + file);
    const baseline = fs.readFileSync(path.join(root, dir + 'baseline-' + file));
    assert.deepEqual(Buffer.from(strip(source)), baseline, file);
  }
  assert.notDeepEqual(Buffer.from(strip(read('logic/message.c').replace('messages->max = 2048', 'messages->max = 2047'))), fs.readFileSync(path.join(root, dir + 'baseline-message.c')));
});

test('C fixture uses current actual source, tests ownership/coalescing/eviction/save binding and all38 RNG fields', async () => {
  const metadataFile = path.join(root, dir + 'fixture-build.json');
  assert.ok(fs.existsSync(metadataFile), 'Root must compile the bounded actual-C fixture before this source test job.');
  const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
  assert.ok(metadata.inputs && Object.keys(metadata.inputs).length >= 9);
  for (const [file, hash] of Object.entries(metadata.inputs)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), hash, `stale fixture input: ${file}`);
  }
  const file = path.join(root, dir + 'fixture.mjs');
  assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'), metadata.outputs['fixture.mjs']);
  assert.equal(createHash('sha256').update(fs.readFileSync(file.replace(/\.mjs$/, '.wasm'))).digest('hex'), metadata.outputs['fixture.wasm']);
  const { default: createFixture } = await import(pathToFileURL(file).href);
  const module = await createFixture();
  assert.equal(module._ab_message_recall_fixture_run(), 0);
});
