import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = readJson('build-manifest.json');
const compileResults = readJson('compile-results.json');
const latestResults = new Map(compileResults.map(result => [result.source, result]));
const sources = [...manifest.cppSources, ...manifest.cSources];
const unresolved = sources.filter(source => latestResults.get(source)?.code !== 0);
if (sources.length !== 438 || unresolved.length) {
  throw new Error('Whole-engine compile evidence incomplete: ' + JSON.stringify(unresolved));
}
for (const source of sources) {
  const result = latestResults.get(source);
  const args = JSON.parse(fs.readFileSync(result.logPath, 'utf8').split('\n', 1)[0]).args;
  const expectedInput = manifest.upstream + '/' + source;
  if (!args.includes(expectedInput) || !args.includes('-DEMSCRIPTEN') || !args.includes('-DLOCALIZE')) {
    throw new Error('Unexpected source or platform/localization flags for ' + source);
  }
  if (!fs.existsSync(args[args.indexOf('-o') + 1])) throw new Error('Missing compiled object for ' + source);
}
const linked = readJson('artifact-evidence.json');
const files = linked.files.map(file => {
  const bytes = fs.readFileSync(file.path);
  const actual = {path:file.path, bytes:bytes.length, sha256:sha256(bytes)};
  if (actual.sha256 !== file.sha256 || actual.bytes !== file.bytes) throw new Error('Artifact hash changed: ' + file.path);
  if (file.path.endsWith('.wasm') && !WebAssembly.validate(bytes)) throw new Error('Invalid WASM artifact');
  return actual;
});
const javascript = files.find(file => file.path.endsWith('.js'));
const syntax = spawnSync(process.execPath, ['--check', javascript.path], {encoding:'utf8', windowsHide:true});
if (syntax.status !== 0) throw new Error('Generated JS syntax failed: ' + syntax.stderr);
const usedArchives = readJson('used-sdk-archives.json');
if (usedArchives.linkResult !== 0 || !usedArchives.archives.length) throw new Error('Successful archive trace evidence missing');
const provenance = readJson('dependency-provenance.json');
if (provenance.length !== 7 || provenance.some(port => !port.officialRecipeChecksumMatches)) throw new Error('Port checks incomplete');
const evidence = {
  schemaVersion:1, generatedUtc:new Date().toISOString(), result:'pass', full_engine:true,
  milestone:'local-original-engine-reference', completePort:false,
  completionTarget:'HTML/browser and Node localhost verification only; no external publication.',
  scope:'Entire original Cataclysm: DDA C++ gameplay/SDL browser baseline; no Rust frontend or RNG overlay is claimed by this build.',
  upstream:{tag:manifest.upstreamTag, commit:manifest.upstreamCommit, sourcePath:manifest.upstream},
  compiler:{officialRecipe:manifest.officialCompiler, installedUsed:manifest.actualCompiler},
  sourceUnits:{cxx:manifest.cppSources.length, c:manifest.cSources.length, total:sources.length, successful:sources.length, unresolved:0},
  checks:{wholeEngineCompilation:'pass', link:'pass', wasmBinaryValidation:'pass', generatedJavascriptSyntax:'pass',
    officialPortArchiveSha512:{passed:provenance.length,total:7}, actualArchiveTraceCount:usedArchives.archives.length},
  artifacts:files,
  buildManifestSha256:sha256(fs.readFileSync(path.join(root, 'build-manifest.json'))),
  memoryCheckpoint:readJson('link-memory-checkpoint.json'),
  retainedLicenseNotices:readJson('dependency-license-manifest.json').length,
  runtimeBrowserVerified:false,
  pending:['Real browser startup, complete gameplay, PC/mobile input and save/resume verification.',
    'Separate gameplay data, audited tile/font assets and Japanese MO catalog packaging.',
    'Rust presentation/input/platform integration and semantic JSON text boundary validation.'],
  notes:['Pristine upstream source was not edited; generated version/prefix headers are isolated overlays.',
    'All original source units are present. The baseline uses original rng.cpp without the optional snapshot overlay.',
    'SDL_mixer audio playback is disabled as in the official web recipe.',
    'Two memory-exhausted source units passed unchanged when retried with one compiler worker.',
    'Compiled using installed Emscripten 6.0.8; official stable recipe pins 3.1.51.'],
};
const evidenceDir = path.join(root, 'evidence');
fs.mkdirSync(evidenceDir, {recursive:true});
const destination = path.join(evidenceDir, 'full-engine-build.json');
fs.writeFileSync(destination, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({result:evidence.result, sourceUnits:sources.length, archives:usedArchives.archives.length,
  evidence:destination, artifacts:files}));
