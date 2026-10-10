// Source preparation only: keep cleared v1 immutable and create a distinct v2.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { weatherSeed, npcKey, acceptNpcColor } from '../cosmetic-purity-overlay/model.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), task = path.dirname(here);
const sha = b => createHash('sha256').update(b).digest('hex');
const v1File = path.join(here, 'FULL-INTEGRATION-PLAN.json');
const v1Bytes = fs.readFileSync(v1File);
assert.equal(sha(v1Bytes), '0367b240d5c36234f4e9ce8ea77dd6d55c44a90b0ac1033ae98b6476ed368b11');
const v1 = JSON.parse(v1Bytes);
const cosmeticFile = path.join(task, 'cosmetic-purity-overlay/SOURCE-PREPARATION.json');
const cosmeticBytes = fs.readFileSync(cosmeticFile);
assert.equal(sha(cosmeticBytes), '1df3a12cb7381f2de78ad8dd246b030e6486606533de56fdf11ffd0c1d694c6b');
const cosmetic = JSON.parse(cosmeticBytes);
const patchBytes = fs.readFileSync(path.join(task, 'cosmetic-purity-overlay/cosmetic-purity.patch'));
assert.equal(sha(patchBytes), 'f590a1252e64fd32ad7072748229da6e9e7512094682608974309ea0c6db0ba8');
const header = fs.readFileSync(path.join(task, 'cosmetic-purity-overlay/cpp/cdda_presentation_hash.h'));
assert.equal(sha(header), '0890d1f7d5f71e4c350bac4de826ed20145984d6fd57e8683d0b0a56c8e377b2');
assert.equal(cosmetic.upstream_commit, v1.sourceCommit);
const fixturesFile = path.join(task, 'cosmetic-purity-overlay/fixtures.json');
const fixturesBytes = fs.readFileSync(fixturesFile);
assert.equal(sha(fixturesBytes), '311260307c3f524978601d4098d1bce61060dcb280b95958312d1797a114f835');
const fixtures = JSON.parse(fixturesBytes);
const buffers = new Map();
for (const row of v1.staging.pins) {
  const b = fs.readFileSync(row.path); assert.equal(b.length, row.bytes); assert.equal(sha(b), row.sha256);
  buffers.set(row.file, b);
}
const pristine = JSON.parse(fs.readFileSync(path.join(task, 'engine-build/build-manifest.json'))).upstream;
const cosmeticGenerated = new Map();
for (const row of cosmetic.generated) {
  assert.ok(v1.dependencyClosure.rebuiltExistingSources.includes(row.source));
  const original = fs.readFileSync(path.join(pristine, row.source));
  assert.equal(sha(buffers.get(row.source)), sha(original), 'v1 must contain pristine cosmetic owner');
  const b = fs.readFileSync(path.join(task, 'cosmetic-purity-overlay/generated', row.source));
  assert.equal(b.length, row.bytes); assert.equal(sha(b), row.sha256);
  cosmeticGenerated.set(row.source, b);
}
cosmeticGenerated.set('src/cdda_presentation_hash.h', header);
function sourceLines(bytes) {
  const text = bytes.toString('utf8'); assert.ok(text.endsWith('\n') && !text.includes('\r'));
  return text.slice(0, -1).split('\n');
}
const blocks = patchBytes.toString('utf8').split(/(?=^diff --git )/m).filter(Boolean);
const reversals = [];
for (const block of blocks) {
  const lines = block.trimEnd().split('\n');
  const name = lines[0].match(/^diff --git a\/(.+) b\/\1$/)?.[1];
  assert.ok(cosmeticGenerated.has(name), 'exact three cosmetic patch members');
  const before = buffers.get(name) ?? Buffer.alloc(0);
  const oldLines = before.length ? sourceLines(before) : [];
  const nextLines = sourceLines(cosmeticGenerated.get(name));
  function apply(input, reverse) {
    let out = [], offset = 0, i = lines.findIndex(line => line.startsWith('@@'));
    assert.ok(i >= 0);
    while (i < lines.length) {
      const hunk = lines[i++].match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/);
      assert.ok(hunk, 'exact supported cosmetic hunk');
      const from = Math.max(0, Number(hunk[reverse ? 3 : 1]) - 1);
      assert.ok(from >= offset);
      out.push(...input.slice(offset, from)); offset = from;
      let consumed = 0, produced = 0;
      while (i < lines.length && !lines[i].startsWith('@@')) {
        const line = lines[i++], mark = line[0], text = line.slice(1);
        assert.ok([' ', '+', '-'].includes(mark));
        const removal = reverse ? '+' : '-', addition = reverse ? '-' : '+';
        if (mark === ' ' || mark === removal) { assert.equal(input[offset++], text); consumed++; }
        if (mark === ' ' || mark === addition) { out.push(text); produced++; }
      }
      assert.equal(consumed, Number(hunk[reverse ? 4 : 2]));
      assert.equal(produced, Number(hunk[reverse ? 2 : 4]));
    }
    out.push(...input.slice(offset)); return out;
  }
  assert.deepEqual(apply(oldLines, false), nextLines);
  assert.deepEqual(apply(nextLines, true), oldLines);
  buffers.set(name, cosmeticGenerated.get(name));
  reversals.push({ file: name, beforeBytes: before.length, beforeSha256: sha(before), afterBytes: cosmeticGenerated.get(name).length, afterSha256: sha(cosmeticGenerated.get(name)), forwardAndReverseExact: true });
}
assert.equal(blocks.length, 3);
assert.equal(buffers.size, 974);
const short = sha(JSON.stringify({ v1BuildIdentity: v1.buildIdentity, cosmeticPatchSha256: sha(patchBytes), generated: cosmetic.generated, headerSha256: sha(header), compileOptimization: '-Os', linkOptimization: '-O1', fullLinkedUnits: 442 })).slice(0,24);
const identity = 'cdda-authoritative-observers-cosmetic-v2-' + short + '-sdk6.0.8';
assert.ok(Buffer.byteLength(identity) <= 256);
const v2 = path.join(here, 'v2'), candidate = path.join(v2, 'candidate-' + short);
assert.ok(!fs.existsSync(v2), 'fresh v2 required; never overwrite an existing plan');
fs.mkdirSync(candidate, { recursive: true });
const pins = [];
for (const [file, b] of [...buffers].sort(([a],[b])=>a.localeCompare(b,'en'))) {
  const target = path.join(candidate, 'sources', file);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, b, { flag:'wx' });
  assert.equal(sha(fs.readFileSync(target)), sha(b));
  pins.push({ file, path: target, bytes: b.length, sha256: sha(b), origin: cosmeticGenerated.has(file) ? { source: 'cosmetic-purity-overlay', purpose: 'authorized three cosmetic draws separated from original shared RNG; native rules retained' } : v1.staging.pins.find(row=>row.file===file).origin });
}
for (const folder of ['generated','objects','output','logs','evidence']) fs.mkdirSync(path.join(candidate,folder));
for (const file of ['.emscripten','generated/version.h','generated/prefix.h']) fs.copyFileSync(path.join(v1.candidateDirectory,file),path.join(candidate,file));
function rebind(value) {
  if (typeof value === 'string') return value.replaceAll(v1.candidateDirectory,candidate).replaceAll(v1.candidateDirectory.replaceAll('\\','/'),candidate.replaceAll('\\','/')).replaceAll(v1.buildIdentity,identity);
  if (Array.isArray(value)) return value.map(rebind);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,rebind(child)]));
  return value;
}
const plan = rebind(v1);
plan.status = 'coherent-v2-cosmetic-source-and-command-plan-prepared-no-build-or-launch';
plan.generatedUtc = new Date().toISOString();
plan.buildIdentity = identity; plan.candidateDirectory = candidate;
plan.authority.gameplay = 'original authoritative C++ rules; exactly three authorized cosmetic shared-RNG draws removed, with distinct replay baseline required';
plan.staging.pins = pins; plan.staging.files = pins.length; plan.staging.bytes = pins.reduce((n,row)=>n+row.bytes,0);
plan.staging.changedOriginalFiles = [...v1.staging.changedOriginalFiles,...cosmetic.generated.map(row=>row.source)].sort();
plan.staging.additions = [...v1.staging.additions,'src/cdda_presentation_hash.h'].sort();
plan.dependencyClosure.recordsAndExactDependencies = plan.dependencyClosure.recordsAndExactDependencies.map(row=>({...row,dependentChangedFiles:plan.staging.changedOriginalFiles.filter(file=>row.dependencies.includes(path.resolve(pristine,file).replaceAll('\\','/')))}));
const independentlyAffected = plan.dependencyClosure.recordsAndExactDependencies.filter(row=>row.dependentChangedFiles.length).map(row=>row.source);
assert.deepEqual(independentlyAffected,v1.dependencyClosure.rebuiltExistingSources);
const priority = [...v1.compileCommands.slice(0,8).map(row=>row.source),'src/cata_tiles.cpp','src/overmap_ui.cpp'];
plan.compileCommands = [...priority,...v1.compileCommands.map(row=>row.source).filter(file=>!priority.includes(file))].map((file,index)=>({...plan.compileCommands.find(row=>row.source===file),index}));
assert.equal(plan.compileCommands.length,235);
const response = fs.readFileSync(v1.linkResponse.path,'utf8').split('\n').map(value=>JSON.stringify(rebind(JSON.parse(value)).replaceAll('\\','/'))).join('\n');
fs.writeFileSync(plan.linkResponse.path,response,{flag:'wx'});plan.linkResponse.bytes=Buffer.byteLength(response);plan.linkResponse.sha256=sha(Buffer.from(response));
let patch='';
for (const file of [...plan.staging.changedOriginalFiles,...plan.staging.additions].sort()) {
  const next=sourceLines(buffers.get(file));patch+=`diff --git a/${file} b/${file}\n`;
  if(plan.staging.changedOriginalFiles.includes(file)){
    const before=sourceLines(fs.readFileSync(path.join(pristine,file)));
    patch+=`--- a/${file}\n+++ b/${file}\n@@ -1,${before.length} +1,${next.length} @@\n`+before.map(line=>'-'+line+'\n').join('')+next.map(line=>'+'+line+'\n').join('');
  }else patch+=`new file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${next.length} @@\n`+next.map(line=>'+'+line+'\n').join('');
}
fs.writeFileSync(path.join(v2,'combined-source.patch'),patch,{flag:'wx'});
plan.combinedPatch={...plan.combinedPatch,path:path.join(v2,'combined-source.patch'),bytes:Buffer.byteLength(patch),sha256:sha(Buffer.from(patch)),cosmeticForwardAndReverseExact:true};
function filePin(file){const b=fs.readFileSync(file);return{path:path.resolve(file),bytes:b.length,sha256:sha(b)};}
const extraPins=[v1File,path.join(here,'VALIDATION.json'),path.join(here,'SOURCE-STAGING.json'),cosmeticFile,path.join(task,'cosmetic-purity-overlay/source-pins.json'),path.join(task,'cosmetic-purity-overlay/cosmetic-purity.patch'),path.join(task,'cosmetic-purity-overlay/cpp/cdda_presentation_hash.h'),fixturesFile,path.join(task,'cosmetic-purity-overlay/model.mjs'),path.join(task,'cosmetic-purity-overlay/rust/src/lib.rs'),path.join(task,'cosmetic-purity-overlay/rust/src/tests.rs'),...cosmetic.generated.map(row=>path.join(task,'cosmetic-purity-overlay/generated',row.source))].map(filePin);
plan.evidencePins=[...v1.evidencePins,...extraPins,...v1.staging.pins.map(({path,bytes,sha256})=>({path,bytes,sha256}))];
const unique=new Map();for(const row of plan.evidencePins){const key=path.resolve(row.path).toLowerCase();if(unique.has(key))assert.deepEqual(unique.get(key),row);else unique.set(key,row);}
plan.evidencePins=[...unique.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
const weather=fixtures.weather.map(row=>({...row,cppExpectedSeed:weatherSeed(row.input)}));
for(const row of weather)assert.equal(row.cppExpectedSeed,row.expected.seed);
const npc=[];for(const pass of [1,2])for(const row of fixtures.npc_cases){const input={...fixtures.npc_base,native_chance:row.native_chance,pass};const record={input,key:npcKey(input),accepted:acceptNpcColor(input)};if(pass===1){assert.equal(record.key,row.key);assert.equal(record.accepted,row.accepted);}npc.push(record);}
const golden={schemaVersion:1,scope:'Synthetic complete exact-header parity cases; original callers and engine/save/RNG not executed',weather,npc,rejection:fixtures.rejection_cases,realCppExecuted:false,realRustExecuted:false};
fs.mkdirSync(path.join(v2,'native-parity'));
fs.writeFileSync(path.join(v2,'native-parity/expected.json'),JSON.stringify(golden,null,2)+'\n',{flag:'wx'});
const pos=values=>'{ '+values.map(value=>value===-2147483648?'INT32_MIN':String(value)).join(', ')+' }';
let cpp='#include "cdda_presentation_hash.h"\n#include <cstdio>\n#include <cinttypes>\nusing namespace cdda_presentation_v1;\nint main() {\n unsigned failed=0; unsigned checks=0;\n';
weather.forEach((row,index)=>{const b=Buffer.from(row.input.resolved_tile_id,'utf8');cpp+=` const char text_${index}[] = { ${b.length?[...b].map(byte=>'static_cast<char>('+byte+')').join(', '):'0'} };\n const auto weather_${index}=weather_seed(std::string_view(text_${index}, ${b.length}), ${pos(row.input.tile_position)}, ${pos(row.input.screen_position)});\n ++checks; if(weather_${index} != UINT32_C(${row.cppExpectedSeed})) ++failed;\n std::printf("{\\"weather\\":${index},\\"seed\\":%" PRIu32 "}\\n",weather_${index});\n`;});
npc.forEach((row,index)=>{const x=row.input,pass=x.pass===1?'nearby':'followers';cpp+=` const auto key_${index}=npc_key(${pos(x.origin)},${pos(x.cursor)},${pos(x.position)},${x.npc_id},${x.native_chance===-2147483648?'INT32_MIN':x.native_chance},npc_pass::${pass});\n const bool accepted_${index}=accept_npc_color(${x.native_chance===-2147483648?'INT32_MIN':x.native_chance},${pos(x.origin)},${pos(x.cursor)},${pos(x.position)},${x.npc_id},npc_pass::${pass});\n ++checks;if(key_${index}!=UINT32_C(${row.key}) || accepted_${index}!=${row.accepted?'true':'false'})++failed;\n std::printf("{\\"npc\\":${index},\\"key\\":%" PRIu32 ",\\"accepted\\":%s}\\n",key_${index},accepted_${index}?"true":"false");\n`;});
fixtures.rejection_cases.forEach((row,index)=>{cpp+=` const auto bounded_${index}=bounded_word(UINT32_C(${row.key}),UINT32_C(${row.bound}));\n ++checks;if(bounded_${index}!=UINT32_C(${row.value}))++failed;\n std::printf("{\\"rejection\\":${index},\\"value\\":%" PRIu32 "}\\n",bounded_${index});\n`;});
cpp+=' const auto repeated=weather_seed("weather_rain",{7,-9,0},{30,14});\n for(int chance=2;chance<80;++chance) { (void)accept_npc_color(chance,{15,-8,0},{16,-7,0},{20,-4,0},123,npc_pass::followers); if(weather_seed("weather_rain",{7,-9,0},{30,14})!=repeated)++failed; }\n ++checks;std::printf("{\\"summary\\":true,\\"checks\\":%u,\\"failed\\":%u}\\n",checks,failed);\n return failed ? 1 : 0;\n}\n';
fs.writeFileSync(path.join(v2,'native-parity/fixture.cpp'),cpp,{flag:'wx'});
plan.cosmetic={sourcePreparation:filePin(cosmeticFile),patchSha256:sha(patchBytes),header:filePin(path.join(candidate,'sources/src/cdda_presentation_hash.h')),sourceOwners:['src/cata_tiles.cpp','src/overmap_ui.cpp'],nativeSites:cosmetic.native_rng_sites_replaced,cosmeticDiffReversals:reversals,originalAdditionalRebuilds:0,newTranslationUnits:0,newHeader:1,sourceConflicts:[],sharedGameplayRngTraceDeliberatelyChanged:true,pristineReplayCompatible:false,nativeSaveFormatChanged:false,standaloneRngCapsuleTransplant:false,helperNativeExecuted:false,actualOriginalCallersExecuted:false,fullRenderPurity:false,nativeParityFixture:{source:filePin(path.join(v2,'native-parity/fixture.cpp')),expected:filePin(path.join(v2,'native-parity/expected.json')),expectedChecks:23,weatherCases:3,npcNearbyCases:8,npcFollowerCases:8,rejectionCases:3,repetitionCheck:1,plannedCompiler:plan.compileCommands[0].executable,plannedCompilerArgv:[plan.compileCommands[0].argv[0],'-O0','-std=c++17','-fsigned-char','-fexceptions','-I'+path.join(candidate,'sources/src'),path.join(v2,'native-parity/fixture.cpp'),'-sENVIRONMENT=node','-sALLOW_MEMORY_GROWTH','-Wl,--threads=1','-o',path.join(v2,'native-parity/fixture.cjs')],environment:plan.compileCommands[0].environment,compilerRun:false,requiresSeparateReviewedOwned4_6Window:true,linkCacheVariantMustAlreadyExist:true,acceptance:['Execute actual frozen header under original signed-char/int32 assumptions; require all23 named checks and raw exact C++ records','Compare all native records with the genuine Rust helper, including empty-ID weather, exact npc_key and follower goldens absent from the previous five-test subset','Check original native cata_tiles/overmap caller admission/order/count/equality and unchanged sprite mixing/weighted/animation branches in real engine','Serialize already-initialized rng_get_engine std::minstd_rand0 around selected actual draws without drawing RNG; engine-only check does not cover persistent distribution caches','Create distinct modified-build replay baseline and test original native save/resume/full state; never import standalone capsule format into game saves']}};
plan.blockers=[...v1.blockers,'V2 three cosmetic replacements are source-reviewed only. Exact native header parity, genuine complete Rust parity and original caller/RNG/new replay/native save/browser evidence remain unexecuted.'];
plan.nextOperations.unshift('Review the distinct v2 cosmetic provenance/reversal and unchanged231/207 closure. Run the bounded exact-header native parity milestone and genuine complete Rust comparison before claiming cosmetic correctness; original caller and save/RNG checks remain separate.');
const volume=fs.statfsSync(path.parse(candidate).root,{bigint:true});
const baselineObjects=v1.dependencyClosure.recordsAndExactDependencies.map(row=>{const object=path.join(task,'engine-build/objects',row.source.slice(4).replace(/\.(cpp|c)$/,'.o'));return{source:row.source,bytes:fs.statSync(object).size};});
const originalAffectedBytes=baselineObjects.filter(row=>v1.dependencyClosure.rebuiltExistingSources.includes(row.source)).reduce((n,row)=>n+row.bytes,0);
const originalAffectedMmdBytes=v1.dependencyClosure.recordsAndExactDependencies.filter(row=>v1.dependencyClosure.rebuiltExistingSources.includes(row.source)).reduce((n,row)=>n+row.dependencyFile.bytes,0);
plan.disk={checkedAt:new Date().toISOString(),volume:path.parse(candidate).root,availableBytes:(volume.bsize*volume.bavail).toString(),filesystemBlockBytes:volume.bsize.toString(),all438OriginalObjectBytes:baselineObjects.reduce((n,row)=>n+row.bytes,0),affected231OriginalObjectBytes:originalAffectedBytes,affected231OriginalMmdBytes:originalAffectedMmdBytes,referenceEngineOutputBytes:134832388+498522,originalObservedPreOptimizationBytes:42382436,newHelperSizesUnmeasured:true,metadataOnlyNoDeletion:true,minimumMeasuredPayloadReserveBytes:2*(originalAffectedBytes+originalAffectedMmdBytes+134832388+498522)+42382436,formula:'Two copies for candidate plus preserved archives of affected object/MMD/reference final output, plus observed preoptimization output. New helper growth, logs, source/SDK pin snapshots and temporary driver files still need measured allowances before a full released build; this is a lower bound, not a guaranteed total disk peak.',freshDiskRecaptureBeforeFullBuildRequired:true};
const fullV2File=path.join(v2,'FULL-INTEGRATION-PLAN.json');
fs.writeFileSync(fullV2File,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(v2,'SOURCE-STAGING.json'),JSON.stringify({schemaVersion:2,status:plan.status,sourceCommit:plan.sourceCommit,buildIdentity:identity,candidateDirectory:candidate,fileCount:pins.length,totalBytes:plan.staging.bytes,pins,v1Unchanged:true,compilerExecuted:false},null,2)+'\n',{flag:'wx'});
// Rebind the exact owner source, retaining its reviewed guard primitives and all235 fixed command indices.
const owner=fs.readFileSync(path.join(here,'run-owner-window.py'),'utf8').replace('ROOT = HERE.parent','ROOT = HERE.parents[1]').replace('PLAN_SHA = "0367b240d5c36234f4e9ce8ea77dd6d55c44a90b0ac1033ae98b6476ed368b11"','PLAN_SHA = "'+sha(fs.readFileSync(fullV2File))+'"');
assert.ok(owner.includes('0 <= options.index < 235'));
fs.writeFileSync(path.join(v2,'run-owner-window.py'),owner,{flag:'wx'});
for(const row of v1.staging.pins){assert.equal(sha(fs.readFileSync(row.path)),row.sha256);}
assert.equal(sha(fs.readFileSync(v1File)),sha(v1Bytes));
console.log(JSON.stringify({status:plan.status,sourceFiles:pins.length,sourceBytes:plan.staging.bytes,affectedOriginalUnits:231,reusedOriginalObjects:207,compileCommands:235,fullLinkedUnits:442,buildIdentity:identity,planSha256:sha(fs.readFileSync(fullV2File)),nativeParityPreparedChecks:23,availableDiskBytes:plan.disk.availableBytes,measuredMinimumPayloadReserveBytes:plan.disk.minimumMeasuredPayloadReserveBytes,v1Unchanged:true,compilerExecuted:false}));
