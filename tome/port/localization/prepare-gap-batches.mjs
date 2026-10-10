#!/usr/bin/env node
// GPL-3.0-or-later. Prepare reviewable source-grounded Japanese gap batches.
import fs from 'node:fs';
import path from 'node:path';
const output = path.resolve(process.argv[2]);
const gaps = JSON.parse(fs.readFileSync(path.join(output, 'missing-official-ja.json'), 'utf8'));
const grouped = new Map();
for (const gap of gaps) {
  const key = gap.tag + '\0' + gap.english;
  const group = grouped.get(key) ?? { english: gap.english, tag: gap.tag, ids: [], owners: [], source_locations: [] };
  group.ids.push(gap.id); group.owners.push(gap.owner);
  for (const location of gap.source_locations) if (!group.source_locations.some(value => value.file === location.file && value.line === location.line)) group.source_locations.push(location);
  grouped.set(key, group);
}
const rows = [...grouped.values()].sort((a,b) => (a.tag+'\0'+a.english).localeCompare(b.tag+'\0'+b.english, 'en'));
const directory = path.join(output, 'gap-review'); fs.mkdirSync(directory, {recursive: true});
for (let index=0; index<4; index++) {
  const batch = rows.filter((_, position) => position % 4 === index);
  fs.writeFileSync(path.join(directory, `batch-${index}.json`), JSON.stringify({schema_version: 1, source_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63', scope:'Explicit literal runtime hooks without an official literal Japanese template; intentional empty templates are present', source_roots_manifest:'../../inventory-work/inventory-output/summary.json', entries:batch}, null, 2)+'\n');
}
console.log(JSON.stringify({missing_ids:gaps.length, distinct_source_tag_pairs:rows.length, batches:4, per_batch:Math.ceil(rows.length/4)}));
