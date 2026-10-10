'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { checkCatalog } = require('./checks.cjs');
const dir = __dirname;
const auditDir = path.resolve(dir, '..', 'inventory-tools', 'output');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  const fileArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  const file = fileArg ? path.resolve(fileArg) : path.join(dir, 'ja-reviewed-patches.json');
  const bytes = fs.readFileSync(file);
  const patch = JSON.parse(bytes.toString('utf8'));
  const audits = {};
  for (const [group, name, hashName] of [
    ['missing', 'ja-missing.json', 'missingAuditSha256'],
    ['rejected', 'ja-rejected-placeholders.json', 'rejectedAuditSha256']
  ]) {
    const auditBytes = fs.readFileSync(path.join(auditDir, name));
    audits[group] = JSON.parse(auditBytes.toString('utf8'));
    assert.equal(hash(auditBytes), patch.sourceCatalog[hashName], 'Audit input fingerprint changed');
  }
  const counts = checkCatalog(patch, audits);
  let pristineCatalogHash;
  if (process.argv.includes('--check-upstream')) {
    const state = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(audits.missing.source)) state.update(chunk);
    pristineCatalogHash = state.digest('hex');
    assert.equal(pristineCatalogHash, patch.sourceCatalog.sha256, 'Pristine upstream catalog changed');
    const root = path.dirname(path.dirname(path.dirname(audits.missing.source)));
    const sourceDocuments = new Map();
    for (const record of patch.records) {
      for (const binding of record.sourceBindings) {
        assert.ok(record.references.includes(binding.file), 'JSON binding must refer to an audited source file');
        if (!sourceDocuments.has(binding.file)) sourceDocuments.set(binding.file, read(path.join(root, binding.file)));
        const components = binding.jsonPointer.slice(1).split('/').map(key => key.replaceAll('~1', '/').replaceAll('~0', '~'));
        let value = sourceDocuments.get(binding.file);
        for (const component of components) {
          assert.ok(value && typeof value === 'object' && Object.hasOwn(value, component), 'JSON binding pointer cannot be resolved');
          value = value[component];
        }
        assert.equal(value, record.singular, 'JSON source binding no longer points to the exact English text');
      }
    }
  }
  const report = {
    schemaVersion: 1,
    status: 'passed',
    sourceCommit: patch.sourceCommit,
    patchSha256: hash(bytes),
    ...(pristineCatalogHash ? { pristineCatalogHash } : {}),
    records: patch.records.length,
    sourceBindings: {
      withExactJsonBinding: patch.records.filter(record => record.sourceBindings.length > 0).length,
      withSourceDriftOrCompositionWarnings: patch.records.filter(record => record.sourceBindingWarnings?.length).length,
      cxxReferenced: patch.records.filter(record => record.references.some(ref => ref.startsWith('src/'))).length
    },
    counts,
    checked: [
      'Exhaustive 142 missing + 22 rejected audit coverage, no duplicate indices or semantic IDs',
      'Unchanged context, English singular/plural, catalog keys, original forms, references, flags, comments and source lines',
      'Exactly one nonempty Japanese form per record',
      'Printf argument positions and types, including dynamic * width/precision and positional specifiers',
      'Exact dynamic/markup angle tags and brace placeholders with multiplicity',
      'Dialogue action prefixes, asterisk markup counts, paragraph breaks and fixed payment annotation',
      'Three individually allowlisted count-bearing plural signatures with inspected source-call evidence',
      'One individually allowlisted unformatted literal-percent help paragraph preserving 50% and 1%',
      'Patch declares no runtime connection; upstream files are only read',
      ...(pristineCatalogHash ? ['Pristine catalog SHA-256 and every JSON source pointer rechecked against upstream'] : [])
    ]
  };
  fs.writeFileSync(path.join(dir, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
