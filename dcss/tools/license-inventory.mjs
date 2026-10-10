// License/attribution filename discovery, added 2026-10-02. GPL-2.0-or-later.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'docs', 'inventory');
const files = ['files.json', 'submodule-files.json'].flatMap(name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
const notices = files.filter(row => /^(?:license|licence|copying|copyright|notice|authors|credits)(?:[._-]|$)/i.test(path.basename(row.path)) || /\/docs\/license\//i.test(row.path));
const result = {
  schema_version: 1,
  upstream_commit: JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8')).upstream_commit,
  scope: 'Filename-discovered license and attribution receipts across the complete pinned source. Notices inside source headers and asset-specific contributor permissions still require separate review; this list is not universal asset clearance.',
  notice_file_count: notices.length,
  files: notices,
};
fs.writeFileSync(path.join(directory, 'license-notices.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ notice_file_count: notices.length, artifact: 'docs/inventory/license-notices.json' }));
