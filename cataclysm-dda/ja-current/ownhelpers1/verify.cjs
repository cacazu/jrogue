const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const input = JSON.parse(fs.readFileSync(path.join(__dirname, '../../catalog-reconcile/output/current-source-gaps-1.json'), 'utf8'));
const output = JSON.parse(fs.readFileSync(path.join(__dirname, '../part-1.json'), 'utf8'));
assert.equal(output.sourceCommit, input.sourceCommit);
assert.equal(output.sourceVersion, input.sourceVersion);
assert.equal(output.count, 180);
assert.equal(output.records.length, input.records.length);
const ids = new Set();
let bindings = 0;
const preservedProperNames = [];
const reviewedAmbiguities = [];
const printf = /%(?:[1-9]\d*\$)?[-+#0 ']*(?:\*(?:[1-9]\d*\$)?|\d+)?(?:\.(?:\*(?:[1-9]\d*\$)?|\d+))?(?:hh|h|ll|l|j|z|t|L)?[diuoxXfFeEgGaAcspn%]/g;
const tokens = (text, pattern) => [...text.matchAll(pattern)].map(m => m[0]);
for (let i = 0; i < input.records.length; i++) {
  const source = input.records[i];
  const target = output.records[i];
  for (const key of Object.keys(source)) assert.deepEqual(target[key], source[key], `Source field changed: ${i}/${key}`);
  assert.deepEqual(Object.keys(target.translations), ['0']);
  assert.equal(typeof target.translations['0'], 'string');
  assert(target.translations['0'].trim().length, `Empty translation: ${i}`);
  assert.equal(typeof target.semanticId, 'string');
  assert(target.semanticId.length);
  assert(!ids.has(target.semanticId), `Duplicate semantic ID: ${i}`);
  ids.add(target.semanticId);
  const ja = target.translations['0'];
  assert.deepEqual(tokens(ja, printf).sort(), tokens(source.singular, printf).sort(), `printf mismatch: ${i}`);
  assert.deepEqual(tokens(ja, /<[^>\n]+>/g).sort(), tokens(source.singular, /<[^>\n]+>/g).sort(), `tag mismatch: ${i}`);
  assert.deepEqual(tokens(ja, /\n+/g), tokens(source.singular, /\n+/g), `newline mismatch: ${i}`);
  assert(!ja.includes('\ufffd'), `Replacement character: ${i}`);
  assert(!/TODO|FIXME|TBD/.test(ja), `Incomplete translation marker: ${i}`);
  if (ja === source.singular) {
    assert([139, 142, 146].includes(source.index), `Unexpected unchanged translation: ${i}`);
    preservedProperNames.push({index:source.index,name:ja});
  }
  if (target.reviewNotes) reviewedAmbiguities.push({index:source.index,reviewNotes:target.reviewNotes});
  bindings += target.sourceBindings.length;
}
const report = {file:'ja-current/part-1.json',inputFile:'catalog-reconcile/output/current-source-gaps-1.json',inputSha256:sha256(path.join(__dirname, '../../catalog-reconcile/output/current-source-gaps-1.json')),outputSha256:sha256(path.join(__dirname, '../part-1.json')),sourceCommit:output.sourceCommit,sourceVersion:output.sourceVersion,count:output.count,incomplete:0,unchangedSourceFields:true,sourceBindingCount:bindings,uniqueSemanticIdCount:ids.size,printfAndTagsPreserved:true,newlineRunsPreserved:true,preservedProperNames,reviewedAmbiguities};
fs.writeFileSync(path.join(__dirname, 'verification1.json'), JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report));
