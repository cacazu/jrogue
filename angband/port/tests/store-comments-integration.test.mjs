import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {stripRecentAnnotations} from './native-annotations.mjs';
const read = file => fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const manifest = JSON.parse(read('migration/store-comment-data/source-manifest.json'));
const source = read('logic/store.c');
const marker = /\/\* AB_STORE_TEXT_BEGIN \*\/[\s\S]*?\/\* AB_STORE_TEXT_END \*\//g;
test('all five original random store comment selections retain the same native bytes',()=>{
  const baseline = read('migration/store-comment-data/source-baseline.c');
  assert.equal(createHash('sha256').update(baseline).digest('hex'),manifest.baseline_sha256);
  assert.equal(stripRecentAnnotations(source.replace(marker,'')),stripRecentAnnotations(baseline));
  assert.equal(manifest.callsites,5);
  for(const [name,sound]of[['worthless',1],['bad',2],['good',3],['great',4],['accept',5]]) {
    assert.equal(source.split(`ONE_OF(comment_${name})`).length-1,1);
    assert.ok(source.includes(`AB_STORE_COMMENT(comment_${name},MSG_STORE${sound},`));
  }
});
test('selected pointers identify every reviewed source table entry without another random call',()=>{
  const en=JSON.parse(read('locales/review-en.json')),ja=JSON.parse(read('locales/review-ja.json'));
  assert.equal(manifest.entries.length,26);
  for(const entry of manifest.entries) {
    assert.equal(en[entry.id],entry.english); assert.equal(ja[entry.id],entry.japanese);
    assert.ok(Number.isInteger(entry.source.ordinal));assert.deepEqual(entry.parameters,[]);
    assert.ok(source.includes('"'+entry.id+'"'));
  }
  const helper=source.match(/static const char \*ab_store_comment\([^]*?\n\}/)[0];
  assert.match(helper,/table\[i\]==selected/);
  assert.doesNotMatch(helper,/\b(?:randint0|randint1|one_in_|strcmp|strstr|msg|msgt)\s*\(/);
});
