import fs from 'node:fs';
import path from 'node:path';
const inventory = path.resolve(import.meta.dirname, '../inventory-work/inventory-output');
const gaps = JSON.parse(fs.readFileSync(path.join(inventory, 'ja-gaps.json'), 'utf8')).gaps;
const runtime = gaps.filter(row => row.gapKind === 'no_source_match' && row.sourceLocalization && row.sourceLocalization.hook !== '_nt_marker' && /game\/(engines|modules\/(?:boot|tome))\//.test(row.file));
const grouped = new Map();
for (const row of runtime) { const rows = grouped.get(row.file) ?? []; rows.push(row); grouped.set(row.file, rows); }
console.log(JSON.stringify({ runtime_count: runtime.length, by_file: [...grouped].map(([file, rows]) => ({file, count:rows.length})).sort((a,b)=>b.count-a.count).slice(0,35), memory_bytes:process.memoryUsage() },null,2));
console.log(JSON.stringify(runtime.filter(row => !row.file.includes('/debug/') && row.english.length > 2 && row.english.length < 180 && /[A-Za-z]{3}/.test(row.english) && !row.english.startsWith('#')).map(row => ({file:row.file,line:row.line,english:row.english,tag:row.sourceLocalization.tag,hook:row.sourceLocalization.hook})),null,2));
