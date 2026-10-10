import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const recipeRoot = 'C:/Users/kit/emsdk/upstream/emscripten/tools/ports';
const names = ['zlib', 'freetype', 'harfbuzz', 'libpng', 'sdl2', 'sdl2_image', 'sdl2_ttf'];
const archives = fs.readdirSync(path.join(root, 'ports')).filter(n => /\.(zip|gz|xz)$/.test(n));
const digest = (bytes, algorithm) => crypto.createHash(algorithm).update(bytes).digest('hex');
const records = names.map(name => {
  const recipePath = path.join(recipeRoot, name + '.py');
  const recipe = fs.readFileSync(recipePath, 'utf8');
  const values = {};
  for (const match of recipe.matchAll(/^(VERSION|TAG|PKG_VERSION) = (f?)'([^']+)'/gm)) {
    values[match[1]] = match[3].replace(/\{(\w+)\}/g, (_, key) => values[key]);
  }
  const expectedSha512 = recipe.match(/^HASH = '([a-f0-9]+)'/m)[1];
  const urlTemplate = recipe.match(/ports\.fetch_project\('[^']+', f'([^']+)'/)[1];
  const acquisitionUrl = urlTemplate.replace(/\{(\w+)\}/g, (_, key) => values[key]);
  const archiveName = archives.find(n => n.startsWith(name + '.'));
  if (!archiveName) throw new Error('Missing task-local archive for ' + name);
  const archivePath = path.join(root, 'ports', archiveName);
  const bytes = fs.readFileSync(archivePath);
  const actualSha512 = digest(bytes, 'sha512');
  if (actualSha512 !== expectedSha512) throw new Error('Official recipe checksum mismatch for ' + name);
  return {name, ...values, acquisitionUrl, archiveName, bytes:bytes.length,
    sha256:digest(bytes, 'sha256'), sha512:actualSha512, officialRecipeChecksumMatches:true,
    recipePath, recipeSha256:digest(Buffer.from(recipe), 'sha256')};
});
fs.writeFileSync(path.join(root, 'dependency-provenance.json'), JSON.stringify(records, null, 2) + '\n');
console.log(JSON.stringify({ports:records.length, officialSha512ChecksPassed:records.length,
  manifest:path.join(root, 'dependency-provenance.json')}));
