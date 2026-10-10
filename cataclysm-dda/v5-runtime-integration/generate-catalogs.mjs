import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const catalogs = Object.fromEntries(['en', 'ja'].map(language => [language,
  JSON.parse(fs.readFileSync(path.join(root, 'locales', language + '.json'), 'utf8'))]));
const ids = Object.keys(catalogs.en).sort();
if (JSON.stringify(ids) !== JSON.stringify(Object.keys(catalogs.ja).sort())) throw new Error('Locale ID sets differ.');
const placeholders = text => [...text.matchAll(/\{([a-z]+)\}/g)].map(match => match[1]).sort();
for (const id of ids) {
  for (const language of ['en', 'ja']) {
    if (typeof catalogs[language][id] !== 'string' || !catalogs[language][id]) throw new Error('Empty message: ' + id);
  }
  if (JSON.stringify(placeholders(catalogs.en[id])) !== JSON.stringify(placeholders(catalogs.ja[id]))) {
    throw new Error('Locale placeholders differ: ' + id);
  }
}
const source = '// Generated from the two semantic JSON catalogs; do not edit.\n' +
  'export const catalogs = ' + JSON.stringify(catalogs, null, 2) + ';\n';
fs.writeFileSync(path.join(root, 'catalogs.mjs'), source);
console.log(JSON.stringify({ ids: ids.length, languages: ['en', 'ja'], placeholderCoverage: true }));
