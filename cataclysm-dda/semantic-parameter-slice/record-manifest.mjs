// Own deliverables only; exclude generated build artifacts and this manifest.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const own = path.dirname(fileURLToPath(import.meta.url));
const rows = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const relative = path.relative(own, file).replaceAll('\\', '/');
    if (relative === 'FILE-MANIFEST.json' || relative.startsWith('rust-verification/target/')) continue;
    if (entry.isDirectory()) { if (relative !== 'rust-verification/target') walk(file); continue; }
    if (!entry.isFile()) throw new Error('unexpected owned filesystem entry: ' + relative);
    const bytes = fs.readFileSync(file);
    rows.push({ path: relative, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
}
walk(own);
rows.sort((a, b) => a.path.localeCompare(b.path));
const report = { schemaVersion: 1, sourceCommit: '7b2efa5cea38e4d4d97dd0e63b28b9148623da59',
  scope: 'owned parameter-slice deliverables only; manifest itself and generated Rust target excluded',
  listedFiles: rows.length, listedBytes: rows.reduce((sum, item) => sum + item.bytes, 0), files: rows };
const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(own, 'FILE-MANIFEST.json'), bytes);
console.log(JSON.stringify({ listedFiles: report.listedFiles, listedBytes: report.listedBytes,
  manifestSha256: crypto.createHash('sha256').update(bytes).digest('hex') }));
