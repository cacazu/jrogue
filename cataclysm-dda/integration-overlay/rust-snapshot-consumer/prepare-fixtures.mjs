// Lightweight local source preparation. Never invokes Cargo/compilers/engine.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const own = path.dirname(fileURLToPath(import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const writeJson = (name,value) => writeFile(path.join(own,name),JSON.stringify(value,null,2)+'\n');
const binding = (type,sequence,modifiers=[],text='',edit='',edit_refresh=false) =>
  ({type,modifiers,sequence,text,edit,edit_refresh});
const sourceCommit = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const base = {schema_version:1,interface:'cdda-live-input-snapshot/1',source_commit:sourceCommit,
  engine_build_id:'source-fixture-only-not-an-engine-build',publication_sequence:'9007199254740993',
  context_epoch:'7',parent_context_epoch:'0',depth:1,phase:'input_wait',category:'DEFAULTMODE',
  text_policy:'native_context',preferred_keyboard_mode:'keycode',effective_timeout_ms:125,
  registered_any_input:false,coordinate_input_enabled:true,iso_mode:false,
  binding_authority:'original_action_contexts_const_lookup',actions:[
    {index:0,id:'pause',origin:'context',bindings:[binding('keyboard_char',[46])]},
    {index:1,id:'wait',origin:'context',bindings:[binding('keyboard_char',[124])]},
    {index:2,id:'save',origin:'context',bindings:[binding('keyboard_char',[83]),binding('keyboard_code',[115],['shift'])]},
    {index:3,id:'FIXTURE.LOCAL_EMPTY',origin:'context',bindings:[]},
    {index:4,id:'FIXTURE.MISSING',origin:'missing',bindings:[]}
  ]};
const text = {...base,publication_sequence:'9007199254740994',context_epoch:'8',
  parent_context_epoch:'7',depth:2,category:'STRING_INPUT',text_policy:'raw_utf8',
  preferred_keyboard_mode:'keychar',registered_any_input:true,coordinate_input_enabled:false,
  actions:[{index:0,id:'TEXT.CONFIRM',origin:'default',bindings:[
    binding('keyboard_char',[10],[],'kit_日本🙂','編集中',true)]},
    {index:1,id:'TEXT.QUIT',origin:'default',bindings:[binding('keyboard_char',[27])]},
    {index:2,id:'ANY_INPUT',origin:'missing',bindings:[]}]};
const allTypes = {...base,publication_sequence:'18446744073709551615',actions:[
  {index:0,id:'FIXTURE.ALL_TYPES',origin:'default',bindings:[
    binding('error',[]),binding('timeout',[]),
    binding('keyboard_char',[0,-2147483648,2147483647]),
    binding('keyboard_code',[115],['ctrl','alt','shift']),
    binding('gamepad',[0,1]),binding('mouse',[1])]}]};
await mkdir(path.join(own,'fixtures'),{recursive:true});
for (const [name,value] of Object.entries({'base-context.json':base,'text-context.json':text,
  'all-binding-types.json':allTypes})) await writeJson(`fixtures/${name}`,value);

// Reuse exact registry package records already locked/cached in rust-contracts.
// This is lock source preparation, not Cargo resolution verification.
const lockBytes = await readFile(path.resolve(own,'../../rust-contracts/Cargo.lock'));
const lockText = lockBytes.toString('utf8');
const packageBlocks = lockText.split('[[package]]').slice(1);
const blocks = new Map(packageBlocks.map(block => {
  const name = /^\s*name = "([^"]+)"/m.exec(block)?.[1];
  if (!name) throw Error('Unexpected original lock package');
  return [name,block];
}));
const needed = new Set();
function requirePackage(name) {
  if (needed.has(name)) return;
  const block = blocks.get(name);
  if (!block || !block.includes('source = "registry+')) throw Error(`Missing locked registry dependency ${name}`);
  needed.add(name);
  const dependencyBlock = /dependencies = \[([\s\S]*?)\]/.exec(block)?.[1] ?? '';
  for (const dependency of dependencyBlock.matchAll(/"([^"]+)"/g)) requirePackage(dependency[1]);
}
requirePackage('serde'); requirePackage('serde_json');
const rootBlock = '\nname = "cdda-live-input-snapshot-consumer"\nversion = "0.1.0"\ndependencies = [\n "serde",\n "serde_json",\n]\n\n';
const preparedLock = '# Source-prepared from existing rust-contracts/Cargo.lock.\n# Cargo --offline --locked verification remains pending; no resolver was run.\nversion = 4\n\n'+
  '[[package]]'+rootBlock+[...needed].sort().map(name=>'[[package]]'+blocks.get(name)).join('');
await writeFile(path.join(own,'Cargo.lock'),preparedLock);
await writeJson('DEPENDENCY-PREPARATION.json',{schemaVersion:1,
  sourceLock:'rust-contracts/Cargo.lock',sourceLockSha256:sha256(lockBytes),
  preparedLockSha256:sha256(Buffer.from(preparedLock)),
  registryPackages:[...needed].sort().map(name=>({name,
    version:/version = "([^"]+)"/.exec(blocks.get(name))[1],
    checksum:/checksum = "([^"]+)"/.exec(blocks.get(name))[1]})),
  registryVersionsChanged:false,newRegistryPackages:false,cargoResolutionPerformed:false,
  compilationPerformed:false,rustTestsExecuted:false});
console.log(JSON.stringify({status:'source_preparation_only',syntheticFixtures:3,
  reusedRegistryPackages:needed.size,preparedLockSha256:sha256(Buffer.from(preparedLock)),
  cargoResolutionPerformed:false,compilationPerformed:false,rustTestsExecuted:false}));
