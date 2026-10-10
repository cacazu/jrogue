// Source-only inspection. No engine execution or catalogue mutation.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const root = path.resolve(import.meta.dirname, '..');
const needles = /^(?:Infusion:|Rune:|Taint:)|^(?:Heave|Slow Motion|Heat|Phase Shot|Unerring Shot|Perfect Aim|Quick Shot|Activate an object|Activate Object|Players|Enemies)$|^Heat Beam$|^Sun$/;
const input = path.join(root, 'inventory-work/inventory-output/upstream-ja-catalogue.jsonl');
const rows = [];
let scanned = 0;
for await (const line of readline.createInterface({ input: fs.createReadStream(input, { encoding: 'utf8' }), crlfDelay: Infinity })) {
  if (!line) continue;
  const row = JSON.parse(line);
  scanned++;
  const source = row.source ?? row.text ?? row.english;
  if (typeof source === 'string' && (needles.test(source) || row.tag === 'talent name' && /Phase|Telepathy|Vision|Poison|Invisibility|Sun|Speed|Frozen|Heat|Aim|Shot|Lightning|Slow Motion/.test(source))) rows.push({file:row.file,line:row.line,section:row.section,source,target:row.translated,tag:row.tag});
}
const summary = JSON.parse(fs.readFileSync(path.join(root, 'unknown-runtime-audit-work/reviewed-summary.json'), 'utf8'));
console.log(JSON.stringify({ scanned, rows }, null, 2));
