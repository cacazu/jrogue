// Copy the curated canonical catalog, preserving exact bytes and acquisition hashes.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'localization/manifest.json'), 'utf8'));
for (const [source, destination, expected] of [
  ['en.json','native-en.json',manifest.catalogs.englishSha256],
  ['ja.json','native-ja.json',manifest.catalogs.japaneseSha256],
  ['contract.json','native-contract.json',null],
]) {
  const bytes = await readFile(path.join(root,'localization',source));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expected && sha256 !== expected) throw new Error(`Canonical ${source} hash mismatch`);
  await writeFile(path.join(root,'port/locales',destination),bytes);
  process.stdout.write(`${destination} ${sha256}\n`);
}
for(const language of ['en','ja']){
  const canonical=JSON.parse(await readFile(path.join(root,'localization',language+'.json'),'utf8'));
  const ui=Object.fromEntries(Object.entries(canonical).filter(([id])=>id.startsWith('game.')));
  if(Object.keys(ui).length!==67||Object.values(ui).some(value=>typeof value!=='string'||value.includes('{{')))
    throw Error('Browser bootstrap ID coverage or static text contract changed');
  await writeFile(path.join(root,'port/locales','gameui-'+language+'.json'),JSON.stringify(ui,null,2)+'\n');
  process.stdout.write('gameui-'+language+'.json '+Object.keys(ui).length+' canonical IDs\n');
}
