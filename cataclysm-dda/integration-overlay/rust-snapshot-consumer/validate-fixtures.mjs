// Fixture/source provenance validation only. Does NOT execute the Rust library.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const own = path.dirname(fileURLToPath(import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let assertions = 0;
function check(value,message) { assertions++; assert.ok(value,message); }
function equal(actual,expected,message) { assertions++; assert.deepEqual(actual,expected,message); }
const names = ['base-context.json','text-context.json','all-binding-types.json'];
const fixtures = [];
const topKeys = ['schema_version','interface','source_commit','engine_build_id','publication_sequence',
  'context_epoch','parent_context_epoch','depth','phase','category','text_policy','preferred_keyboard_mode',
  'effective_timeout_ms','registered_any_input','coordinate_input_enabled','iso_mode','binding_authority','actions'];
const eventTypes = ['error','timeout','keyboard_char','keyboard_code','gamepad','mouse'];
for (const name of names) {
  const bytes = await readFile(path.join(own,'fixtures',name));
  const value = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  check(bytes.length <= 262144,'fixture raw byte bound');
  equal(Object.keys(value),topKeys,'fixture exact wire fields');
  equal(value.schema_version,1,'fixture schema');
  equal(value.interface,'cdda-live-input-snapshot/1','fixture interface');
  equal(value.source_commit,'7b2efa5cea38e4d4d97dd0e63b28b9148623da59','fixture source identity');
  equal(value.engine_build_id,'source-fixture-only-not-an-engine-build','synthetic identity explicitly labeled');
  for (const key of ['publication_sequence','context_epoch','parent_context_epoch']) {
    check(/^(0|[1-9][0-9]*)$/.test(value[key]),'canonical decimal-string fixture counter');
    check(BigInt(value[key]) <= 18446744073709551615n,'fixture counter u64 range');
  }
  check(BigInt(value.publication_sequence)>0n && BigInt(value.context_epoch)>0n,'ready fixture counters nonzero');
  check(value.depth>=1 && value.depth<=64,'fixture scope bound');
  check((value.depth===1)===(value.parent_context_epoch==='0'),'fixture parent/root relationship');
  check(BigInt(value.parent_context_epoch)<BigInt(value.context_epoch),'fixture parent epoch older');
  equal(value.text_policy,value.category==='STRING_INPUT'?'raw_utf8':'native_context','exact text category recognition');
  check(value.actions.length<=2048,'fixture action bound');
  for (const [index,action] of value.actions.entries()) {
    equal(Object.keys(action),['index','id','origin','bindings'],'fixture action fields');
    equal(action.index,index,'fixture ordered action index');
    check(['context','default','missing'].includes(action.origin),'fixture origin');
    check(action.bindings.length<=128,'fixture binding bound');
    check(action.origin!=='missing'||action.bindings.length===0,'missing remains unbound');
    for (const binding of action.bindings) {
      equal(Object.keys(binding),['type','modifiers','sequence','text','edit','edit_refresh'],'fixture binding fields');
      check(eventTypes.includes(binding.type),'source enum retained');
      check(binding.sequence.length<=64 && binding.sequence.every(key=>
        Number.isInteger(key)&&key>=-2147483648&&key<=2147483647),'exact i32 fixture sequences');
      const order = binding.modifiers.map(modifier=>['ctrl','alt','shift'].indexOf(modifier));
      check(order.every((rank,index)=>rank>=0&&(index===0||order[index-1]<rank)),'source modifier order');
      check(typeof binding.edit_refresh==='boolean','fixture edit refresh type');
      for (const text of [binding.text,binding.edit,action.id]) {
        check(typeof text==='string' && Buffer.byteLength(text)<=16384,'UTF-8 fixture field bound');
      }
    }
  }
  fixtures.push({path:`fixtures/${name}`,bytes:bytes.length,sha256:sha256(bytes),value});
}
equal(fixtures[0].value.actions.slice(0,3).map(action=>[action.id,action.bindings[0].sequence[0]]),
  [['pause',46],['wait',124],['save',83]],'pause/wait/uppercase save fixture distinction');
equal(fixtures[1].value.actions[0].bindings[0].text,'kit_日本🙂','owned raw binding text fixture unchanged');
equal(fixtures[2].value.actions[0].bindings.map(binding=>binding.type),eventTypes,'all event types represented');
equal(BigInt(fixtures[0].value.publication_sequence),9007199254740993n,'fixture exceeds JS exact integer number range');
equal(BigInt(fixtures[2].value.publication_sequence),18446744073709551615n,'fixture covers u64 maximum');

const dependency = JSON.parse(await readFile(path.join(own,'DEPENDENCY-PREPARATION.json'),'utf8'));
equal(dependency.cargoResolutionPerformed,false,'no Cargo resolution claimed');
const preparedLock = await readFile(path.join(own,'Cargo.lock'));
equal(sha256(preparedLock),dependency.preparedLockSha256,'prepared lock hash');
const originalLock = await readFile(path.resolve(own,'../../rust-contracts/Cargo.lock'));
equal(sha256(originalLock),dependency.sourceLockSha256,'original cached dependency lock unchanged');
const original = new Map(originalLock.toString('utf8').split('[[package]]').slice(1).map(block=>
  [/^\s*name = "([^"]+)"/m.exec(block)[1],block]));
const preparedBlocks = preparedLock.toString('utf8').split('[[package]]').slice(1);
for (const block of preparedBlocks) {
  const name = /^\s*name = "([^"]+)"/m.exec(block)[1];
  if (name==='cdda-live-input-snapshot-consumer') continue;
  equal(block,original.get(name),'registry record copied byte-exact from existing lock');
}
const modulePaths = ['src/lib.rs','src/model.rs','src/wire.rs','src/transport.rs','src/consumer.rs','tests/contract.rs'];
const sources = [];
let tests = [];
for (const name of modulePaths) {
  const bytes = await readFile(path.join(own,name));
  sources.push({path:name,bytes:bytes.length,sha256:sha256(bytes)});
  if (name==='tests/contract.rs') tests = [...bytes.toString('utf8').matchAll(/#\[test\]\s*fn ([a-z0-9_]+)/g)].map(match=>match[1]);
}
check(tests.length>=19,'meaningful pending Rust tests are present');
const productionText = (await Promise.all(modulePaths.filter(name=>name.startsWith('src/'))
  .map(name=>readFile(path.join(own,name),'utf8')))).join('\n');
check(!/\bunsafe\s+(?:fn|impl|\{)/.test(productionText),'no unsafe implementation');
check(!/std::(?:time|fs|thread)|\b(?:SystemTime|Instant|rand|rng_get_engine|do_turn)\b/.test(productionText),
  'consumer source contains no clock/RNG/simulation/storage operation');
check(!productionText.includes('CommandAuthorization::Allowed'),'no command authorization path');
const evidence = {schemaVersion:1,status:'source_and_fixture_checks_only_rust_uncompiled_unconnected',
  fixtureAssertions:assertions,syntheticFixtures:fixtures.map(({value,...item})=>item),
  rustSource:sources,pendingRustTests:tests,rustTestsExecuted:0,
  cargoResolutionPerformed:false,compilationPerformed:false,rustRuntimeValidationPerformed:false,
  cppEngineRuntimeValidationPerformed:false,alreadyCompiledBridgeChanged:false};
await writeFile(path.join(own,'SOURCE-PREPARATION.json'),JSON.stringify(evidence,null,2)+'\n');
const manifestPaths = [...modulePaths,...names.map(name=>`fixtures/${name}`),
  'Cargo.toml','Cargo.lock','README.md','SOURCE-REVIEW.md','prepare-fixtures.mjs',
  'validate-fixtures.mjs','DEPENDENCY-PREPARATION.json','SOURCE-PREPARATION.json'].sort();
const manifestFiles = [];
for (const name of manifestPaths) {
  const bytes = await readFile(path.join(own,name));
  manifestFiles.push({path:name,bytes:bytes.length,sha256:sha256(bytes)});
}
const producerPreparation = JSON.parse(await readFile(path.resolve(own,'../SOURCE-PREPARATION.json'),'utf8'));
const manifest = {schemaVersion:1,status:'rust_source_only_uncompiled_unconnected',
  files:manifestFiles,producerPatchSha256:producerPreparation.patch.sha256,
  rustTestsPrepared:tests.length,rustTestsExecuted:0,compilerArtifactsIncluded:false,
  alreadyCompiledBridgeChanged:false};
const manifestBytes = Buffer.from(JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(own,'FILE-MANIFEST.json'),manifestBytes);
console.log(JSON.stringify({status:evidence.status,fixtureAssertions:assertions,syntheticFixtures:fixtures.length,
  pendingRustTests:tests.length,rustTestsExecuted:0,compilationPerformed:false,
  sourceManifestSha256:sha256(manifestBytes),sourceFiles:manifestFiles.length}));
