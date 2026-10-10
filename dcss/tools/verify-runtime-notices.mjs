// Independent DCSS notice receipt integrity check. Added 2026-10-02.
// GPL-3.0-or-later.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'licenses');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'runtime-packaging.json'), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let bytes = 0;
for (const receipt of manifest.receipts) {
  const file = path.resolve(directory, receipt.file);
  if (!file.startsWith(directory + path.sep)) throw new Error(`Notice path escapes licenses: ${receipt.file}`);
  const actual = fs.readFileSync(file);
  if (actual.length !== receipt.bytes || sha(actual) !== receipt.sha256) throw new Error(`Notice hash mismatch: ${receipt.file}`);
  if (receipt.extraction === 'verbatim installed text receipt' && !fs.readFileSync(receipt.acquired_from).equals(actual)) throw new Error(`Installed notice mismatch: ${receipt.file}`);
  bytes += actual.length;
}
if (manifest.missing.length || manifest.receipts.length !== manifest.copied_files || bytes !== manifest.copied_bytes) throw new Error('Missing receipt or inconsistent manifest totals');
if (manifest.crates.length !== 11 || manifest.crates.some(row => !row.archive_checksum_verified || row.archive_sha256 !== row.checksum)) throw new Error('Locked crate archive verification incomplete');
if (sha(fs.readFileSync(path.join(root, 'port', 'Cargo.lock'))) !== manifest.cargo_lock_sha256) throw new Error('Notice package uses a different Cargo.lock');
const report = { result: 'pass', verified_receipts: manifest.receipts.length, verified_receipt_bytes: bytes, verified_locked_crate_archives: manifest.crates.length, cargo_lock_sha256: manifest.cargo_lock_sha256, runtime_manifest_sha256: sha(fs.readFileSync(path.join(directory, 'runtime-packaging.json'))), gpl3_sha256: sha(fs.readFileSync(path.join(directory, 'GPL-3.0.txt'))), scope: 'Receipt integrity, exact installed-file copying, locked archive checksums recorded by packaging, and unchanged Cargo.lock; does not assert a final linked-symbol license-membership map or gameplay/publication readiness.' };
fs.writeFileSync(path.join(directory, 'runtime-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
