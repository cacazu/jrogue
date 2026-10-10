import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const own = path.dirname(fileURLToPath(import.meta.url));
const nativeLog = await readFile(path.join(own,'evidence','native-final.log'),'utf8');
const clippyLog = await readFile(path.join(own,'evidence','clippy-final.log'),'utf8');
if (!/5 passed; 0 failed/.test(nativeLog) || !/Finished `dev` profile/.test(clippyLog)) {
  throw Error('Final native test/clippy evidence is incomplete');
}
const matches = [...nativeLog.matchAll(/target\\debug\\deps\\(cdda_rust_browser_bridge-[a-f0-9]+\.exe)/g)];
const filename = matches.at(-1)?.[1];
if (!filename || !(await readdir(path.join(own,'target','debug','deps'))).includes(filename)) {
  throw Error('The tested native executable is not available');
}
const executable = await readFile(path.join(own,'target','debug','deps',filename));
const source = JSON.parse(await readFile(path.join(own,'evidence','source-hashes.json')));
const result = {schemaVersion:1, nativeTests:{passed:5,failed:0},clippy:{passed:true,warningsAsErrors:true},
  executable:{path:`target/debug/deps/${filename}`,bytes:executable.length,
    sha256:createHash('sha256').update(executable).digest('hex')},
  finalSourceManifestSha256:createHash('sha256').update(await readFile(path.join(own,'evidence','source-hashes.json'))).digest('hex'),
  recordedSourceFiles:source.length,scope:'Bounded native scalar/input/text bridge only'};
await writeFile(path.join(own,'evidence','native-final.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
