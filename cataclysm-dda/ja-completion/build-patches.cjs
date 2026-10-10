'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { checkCatalog } = require('./checks.cjs');
const dir = __dirname;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const auditDir = path.resolve(dir, '..', 'inventory-tools', 'output');
const audits = {
  missing: read(path.join(auditDir, 'ja-missing.json')),
  rejected: read(path.join(auditDir, 'ja-rejected-placeholders.json'))
};
const hashFile = async file => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
function bindJsonSources(records) {
  const root = path.dirname(path.dirname(path.dirname(audits.missing.source)));
  const byFile = new Map();
  for (const record of records) {
    record.sourceBindings = [];
    for (const file of record.references.filter(ref => ref.endsWith('.json'))) {
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file).push(record);
    }
  }
  for (const [file, relevant] of byFile) {
    const wanted = new Map();
    for (const record of relevant) {
      if (!wanted.has(record.singular)) wanted.set(record.singular, []);
      wanted.get(record.singular).push(record);
    }
    const document = read(path.join(root, file));
    const walk = (value, pointer, owner) => {
      if (typeof value === 'string' && wanted.has(value)) {
        for (const record of wanted.get(value)) {
          record.sourceBindings.push({ file, jsonPointer: pointer, ...(owner || {}) });
        }
      } else if (value && typeof value === 'object') {
        let nextOwner = owner;
        if (!Array.isArray(value) && (Object.hasOwn(value, 'id') || Object.hasOwn(value, 'type'))) {
          nextOwner = {
            ...(typeof value.id === 'string' ? { ownerId: value.id } : {}),
            ...(Array.isArray(value.id) ? { ownerIds: value.id } : {}),
            ...(typeof value.type === 'string' ? { ownerType: value.type } : {})
          };
        }
        for (const [key, child] of Object.entries(value)) {
          walk(child, pointer + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'), nextOwner);
        }
      }
    };
    walk(document, '', null);
    for (const record of relevant) {
      if (!record.sourceBindings.some(binding => binding.file === file)) {
        record.sourceBindingWarnings ||= [];
        record.sourceBindingWarnings.push({
          file,
          reason: 'Audited PO msgid does not exactly occur as a string leaf in the referenced stable JSON. Catalog/source drift or extraction composition requires a separate integration review; the original audited key is retained.'
        });
      }
    }
  }
}
async function main() {
  const fragments = [
    { group: 'missing', records: read(path.join(dir, 'missing-a.json')).records },
    { group: 'missing', records: read(path.join(dir, 'missing-b.json')).records },
    { group: 'rejected', records: read(path.join(dir, 'repairs.json')).records }
  ];
  const records = fragments.flatMap(({ group, records: authored }) => authored.map(row => {
    const original = audits[group].entries[row.auditIndex];
    if (!original) throw new Error('Out of range audit index ' + row.auditIndex);
    return {
      semanticId: row.semanticId,
      auditGroup: group,
      auditIndex: row.auditIndex,
      catalogKey: original.catalogKey,
      context: original.context,
      singular: original.singular,
      plural: original.plural,
      translations: { '0': row.translation },
      originalTranslations: original.translations,
      references: original.references,
      flags: original.flags,
      comments: original.comments,
      poLine: original.line,
      action: row.action || 'translate-missing',
      validationBasis: row.validationBasis || 'singular',
      review: { explanation: row.explanation, ...(row.ambiguities ? { ambiguities: row.ambiguities } : {}) }
    };
  }));
  bindJsonSources(records);
  const patch = {
    schemaVersion: 1,
    language: 'ja',
    defaultLocale: 'ja',
    pluralForms: 'nplurals=1; plural=0;',
    sourceCommit: '7b2efa5cea38e4d4d97dd0e63b28b9148623da59',
    sourceVersion: '0.I-1',
    sourceCatalog: {
      path: 'lang/po/ja.po',
      sha256: await hashFile(audits.missing.source),
      missingAuditSha256: await hashFile(path.join(auditDir, 'ja-missing.json')),
      rejectedAuditSha256: await hashFile(path.join(auditDir, 'ja-rejected-placeholders.json'))
    },
    runtimeConnected: false,
    runtimeIntegration: 'Reviewable semantic patch records. Exact gettext context/singular/plural keys are retained for a future adapter. Semantic IDs are descriptive keys and are not connected to the reference engine or a Rust runtime by this file.',
    counts: { missing: 142, rejected: 22, actualPlaceholderRepairs: 18, pluralReviews: 3, literalPercentReviews: 1 },
    records
  };
  checkCatalog(patch, audits);
  fs.writeFileSync(path.join(dir, 'ja-reviewed-patches.json'), JSON.stringify(patch, null, 2) + '\n');
  console.log('Built and validated 164 reviewed records (142 missing, 18 actual repairs, 4 audit reviews).');
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
