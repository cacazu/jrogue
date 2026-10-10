// Refresh an authenticated source selection by a small declared post-archive delta.
// This does not rescan dependencies, build, package, deploy, or stage Git files.
// Run only after all explicitly selected source/evidence files are frozen.
import {createHash} from 'node:crypto';
import {lstat, readFile, writeFile, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const planPath=path.join(root,'docs/core-source-package-plan.json');
const expectedPlanHash='803ae5c90270e62009d289b16e3ac9ad1c52440c59b8552b90dfa5b2f9e2d8a0';
const expectedArchiveHash='881cff21b198f6f9cfe3f24ed9674586d719c18147f1b99978667be64b9b45b2';
const expectedCore='20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60';
const expectedFiles=27630,expectedBytes=545460758;
const hash=b=>createHash('sha256').update(b).digest('hex');
const replacements=[
  {path:'tools/prepare-clean-source-toolchain.mjs',previous:'1aff93ad5f26615b4257066688f686e8e67c07b55b351d05a07906897879bd93',current:'ca75fa715024ff5823e6f17ed6ac0a67ad739bdb3ec83349a437080bad45909c'},
  {path:'tools/verify-clean-source-build.mjs',previous:'e80271ff653d5ecc0c20a4fff0905738c6ba22f7f08d86289174888c2818ed76',current:'25aa78cac3060c21942b6c01692d3afe4c8e5e4b3ea9cc92b83c14dd2ea16739'},
];
// Only these eleven authored writers/status/prose records may change beyond
// the two exact helper fixes. Their old hashes come from the authenticated base
// plan; current bytes are captured after the coordinator freezes its evidence.
const authoredUpdates=[
  {path:'tools/write-runtime-status.mjs',previous:'f2f889407b40fddc68ec7a5b930821841a2ecdb9314a3ef195ccb209583a102d'},
  {path:'tools/write-delivery-status.mjs',previous:'fd7a1bb78e756f868f1c28b14d667f92cc3460bf79679a4d266f4d48f0c94e10'},
  {path:'tools/write-status-readme.mjs',previous:'e01693118f26262f175ab1d170c4778a970c720a20e6138001a99d130d2b53f1'},
  {path:'docs/CURRENT-CHECKPOINT.json',previous:'4f755b9d845973671f0fe44d8d23bf5fe4b42dc79b260b6401a087ea73a3b5dc'},
  {path:'README.md',previous:'d787c86124835c47cafd23c828b6733c9d3e85ce74294159989c0a1656d70aad'},
  {path:'docs/SOURCE-PACKAGING.md',previous:'2d72724641f262c84a0f46075202c53f790aaf5494b076d87c5021a33a7fb126'},
  {path:'docs/LOCAL-RUN.md',previous:'c49a29a4667ee63f927c95d9f0216aef4a311ff07ce6e5e915de3c468cc15250'},
  {path:'docs/ORIGINAL-GAME-TESTS.md',previous:'b3e5b8205d822d9b6948ba0dec5a1ef1136b45620454e67591fd8460e5dc273f'},
  {path:'docs/MIGRATION-STATUS.md',previous:'6814f267ab396fc0ce3f661ffe0d698eafc1a87f7df85f93f417b3fbbe86a791'},
  {path:'docs/CORE-BRIDGE.md',previous:'9e9121b2e84443200eb3a740031e5619a63f6f37c38dde219d0e9c89069fb731'},
  {path:'docs/FINAL-SOURCE-LICENSE-AUDIT.md',previous:'85259361f202303afe8e76724ab2d4f879fcd970e58527241a7712ec5135945e'},
];
const requiredAdditions=[
  // This root status JSON was not selected by the baseline source planner.
  'delivery.json',
  'tools/refresh-core-source-plan.mjs',
  'tools/sync-complete-local-evidence.mjs',
  'port/tests/original-death-browser.mjs',
  'port/tests/original-death-phase.mjs',
  'port/tests/original-death-phase.test.mjs',
  'docs/SOURCE-CLEAN-BUILD-EVIDENCE.json',
  'docs/source-clean-build-memory.json',
];
// Each optional path is selected explicitly, without walking a source/output tree.
const optionalAdditions=[
  'docs/source-clean-build-memory.json.stdout.log',
  'docs/source-clean-build-memory.json.stderr.log',
  'docs/source-bundle-cargo-metadata-20e21daf.json',
  'docs/source-bundle-fast-verify-20e21daf-6ec7a4a638014112a25607fda0b9eb89.json',
  'docs/source-clean-toolchain-20e21daf.json',
  ...['fresh-source-and-fpc','cargo-vendor-restore','external-standard-prerequisites',
    'original-game-clean-build','empty-cache-offline-cargo-metadata','rust-adapter-clean-build']
    .flatMap(name=>['stdout','stderr'].map(stream=>'docs/source-clean-build-20e21daf/'+name+'.'+stream+'.log')),
];
const extras=process.argv.slice(2).map(arg=>arg.startsWith('--extra=')?arg.slice(8):arg);
if(extras.some(arg=>!arg||arg.startsWith('-')))throw Error('Use only exact positional relative paths or --extra=path');
function canonical(value){
  if(typeof value!=='string'||!value||value.includes('\\')||value.startsWith('/')||/[\x00-\x1f\x7f]/.test(value))throw Error('Invalid relative archive path');
  const parts=value.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||/[<>:"|?*]/.test(p)||/[. ]$/.test(p)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw Error('Unsafe Windows/archive path: '+value);
  if(path.posix.normalize(value)!==value)throw Error('Noncanonical archive path: '+value);
  return value;
}
function confined(relative){
  const result=path.resolve(root,...canonical(relative).split('/'));
  if(!result.toLowerCase().startsWith((root+path.sep).toLowerCase()))throw Error('Source path escaped task root');
  return result;
}
const checkedAncestors=new Set();
async function noLinks(file){
  const absolute=path.resolve(file),base=path.parse(root).root;
  if(absolute.toLowerCase()!==root.toLowerCase()&&!absolute.toLowerCase().startsWith((root+path.sep).toLowerCase()))throw Error('File escaped task root');
  for(let q=absolute;;q=path.dirname(q)){
    const key=q.toLowerCase();
    if(!checkedAncestors.has(key)){
      const stat=await lstat(q);
      if(stat.isSymbolicLink())throw Error('Source/ancestor symlink rejected: '+q);
      if(q!==absolute&&!stat.isDirectory())throw Error('Ancestor is not a directory: '+q);
      if(q!==absolute)checkedAncestors.add(key);
    }
    if(q.toLowerCase()===base.toLowerCase())break;
    if(path.dirname(q)===q)throw Error('Ancestor traversal did not reach filesystem root');
  }
}
function allowedNew(relative){
  const p=canonical(relative),parts=p.toLowerCase().split('/');
  if(p.toLowerCase()==='docs/core-source-package-plan.json')throw Error('The plan cannot select itself');
  if(parts.some(x=>['.git','.agents','.codex','node_modules','output','tests-output','target','dist','build','upstream','native','core-adapted'].includes(x)))throw Error('Excluded source/output directory: '+p);
  if(!/^(?:delivery\.json|README\.md|docs\/[^/].*\.(?:json|md|txt|log)|tools\/[^/]+\.mjs|port\/tests\/[^/]+\.mjs)$/.test(p))throw Error('New selection must be explicit docs/tool/test text: '+p);
  if(/\.(?:exe|dll|so|dylib|a|o|ppu|wasm|zip|crate|png|jpe?g|gif|webp|ogg|mp3|wav|ttf|otf|fon)$/i.test(p))throw Error('Binary new selection rejected');
  return p;
}
async function newRecord(relative,{expected=null,maxBytes=8*1024*1024}={}){
  allowedNew(relative);const source=confined(relative);await noLinks(source);
  const first=await lstat(source);
  if(!first.isFile()||first.isSymbolicLink()||first.size>maxBytes)throw Error('Selected file must be ordinary bounded text: '+relative);
  const bytes=await readFile(source),sha256=hash(bytes);
  if(bytes.length!==first.size||bytes.includes(0))throw Error('Selected text size/NUL check failed: '+relative);
  new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(relative.endsWith('.json'))JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  if(expected&&sha256!==expected)throw Error('Expected frozen replacement hash differs: '+relative);
  const second=await lstat(source);
  if(!second.isFile()||second.isSymbolicLink()||second.size!==first.size||hash(await readFile(source))!==sha256)throw Error('Selected file changed while hashing: '+relative);
  return {path:relative,source,size:bytes.length,sha256};
}
await noLinks(planPath);
const originalBytes=await readFile(planPath);
if(hash(originalBytes)!==expectedPlanHash)throw Error('Base source plan hash differs; no implicit rebase is allowed');
const original=JSON.parse(originalBytes.toString('utf8'));
const receiptPath=confined('port/dist/source-bundle.json');await noLinks(receiptPath);
const baseReceipt=JSON.parse((await readFile(receiptPath)).toString('utf8'));
if(baseReceipt.schema!==1||baseReceipt.sha256!==expectedArchiveHash||baseReceipt.core_sha256!==expectedCore||baseReceipt.source_files!==expectedFiles||baseReceipt.publication!==false)throw Error('Base archive receipt differs from declared provenance');
if(original.schema!==1||original.blockers?.length||original.core?.sha256!==expectedCore||original.core.selectedUnits?.length!==139||original.core.sourceMappings?.length!==13776||original.files?.length!==expectedFiles)throw Error('Base source-closure identity differs');
const byPath=new Map(),folded=new Set();let originalTotal=0;
for(const record of original.files){
  const name=canonical(record.path),lower=name.toLowerCase();
  if(folded.has(lower)||typeof record.source!=='string'||!path.isAbsolute(record.source)||!Number.isSafeInteger(record.size)||record.size<0||!/^[a-f0-9]{64}$/.test(record.sha256))throw Error('Malformed/duplicate existing plan record: '+name);
  folded.add(lower);byPath.set(name,record);originalTotal+=record.size;
}
if(originalTotal!==expectedBytes)throw Error('Base source-byte count differs');
// External cache/toolchain source paths in the authenticated base plan retain
// their exact original records. The normal ZIP writer hashes every old source
// before/after copying and hashes every decompressed entry; this delta never
// treats a changed old input as an approved replacement.
const beforeNonFiles=JSON.stringify({...original,files:undefined});
const updated=[],added=[],selection=new Set();
for(const patch of replacements){
  const previous=byPath.get(patch.path);
  if(!previous||previous.sha256!==patch.previous||path.resolve(previous.source).toLowerCase()!==confined(patch.path).toLowerCase())throw Error('Pinned old helper record differs: '+patch.path);
  const record=await newRecord(patch.path,{expected:patch.current});
  byPath.set(patch.path,record);updated.push({path:patch.path,previous:{size:previous.size,sha256:previous.sha256},current:{size:record.size,sha256:record.sha256}});
}
const declaredOldUpdates=new Set(replacements.map(p=>p.path));
for(const patch of authoredUpdates){
  if(declaredOldUpdates.has(patch.path))throw Error('Duplicate declared authored update');
  declaredOldUpdates.add(patch.path);
  const previous=byPath.get(patch.path);
  if(!previous||previous.sha256!==patch.previous||path.resolve(previous.source).toLowerCase()!==confined(patch.path).toLowerCase())throw Error('Pinned old authored record differs: '+patch.path);
  if(original.core.selectedUnits.some(u=>u.path===patch.path)||original.core.sourceMappings.some(m=>m.sourcePath===patch.path||m.buildPath===patch.path)||original.sourceDependencies.some(d=>patch.path===d.directory||patch.path.startsWith(d.directory+'/')))throw Error('Authored update is a source-closure input: '+patch.path);
  const record=await newRecord(patch.path);
  if(record.sha256===previous.sha256){if(record.size!==previous.size)throw Error('Unchanged authored hash has inconsistent size');continue;}
  byPath.set(patch.path,record);
  updated.push({path:patch.path,kind:'authorized-authored-status-or-prose',previous:{size:previous.size,sha256:previous.sha256},current:{size:record.size,sha256:record.sha256}});
}
async function add(relative,{optional=false,maxBytes}={}){
  allowedNew(relative);const lower=relative.toLowerCase();
  if(selection.has(lower)||folded.has(lower))throw Error('Duplicate/existing requested new record: '+relative);
  selection.add(lower);
  try{const record=await newRecord(relative,{maxBytes});byPath.set(relative,record);folded.add(lower);added.push({path:relative,size:record.size,sha256:record.sha256});}
  catch(error){if(optional&&error.code==='ENOENT')return;throw error;}
}
for(const name of requiredAdditions)await add(name);
for(const name of optionalAdditions)await add(name,{optional:true,maxBytes:256*1024});
for(const name of extras)await add(name);
const output={...original,files:[...byPath.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'))};
if(JSON.stringify({...output,files:undefined})!==beforeNonFiles)throw Error('Source-closure metadata changed');
for(const prior of original.files){
  if(declaredOldUpdates.has(prior.path))continue;
  if(JSON.stringify(byPath.get(prior.path))!==JSON.stringify(prior))throw Error('An undeclared base record changed: '+prior.path);
}
output.sourceFiles=output.files.length;output.sourceBytes=output.files.reduce((n,r)=>n+r.size,0);
if(!Number.isSafeInteger(output.sourceBytes))throw Error('Source-byte sum overflow');
output.archiveDelta={schema:1,created_utc:new Date().toISOString(),base_plan_sha256:expectedPlanHash,
  base_archive_sha256:expectedArchiveHash,base_core_sha256:expectedCore,base_source_files:expectedFiles,
  base_source_bytes:expectedBytes,updated,added,authorized_authored_paths:authoredUpdates.map(p=>p.path),unchanged_record_count:expectedFiles-updated.length,
  dependency_rescan_performed:false,unchanged_input_hash_recheck:'Required by the normal ZIP writer before/after copying and full decompressed readback',
  core_source_metadata_unchanged:true,compiled_source_records:139,source_mappings:13776};
// Recheck the base and every declared delta before the only mutation. A unique
// sibling is atomically renamed over this one explicit plan; no tree is moved.
if(hash(await readFile(planPath))!==expectedPlanHash)throw Error('Concurrent source-plan change');
for(const r of [...updated.map(v=>byPath.get(v.path)),...added.map(v=>byPath.get(v.path))]){
  await noLinks(r.source);if(hash(await readFile(r.source))!==r.sha256)throw Error('Frozen delta source changed: '+r.path);
}
await noLinks(planPath);
const candidate=planPath+'.delta-'+process.pid+'-'+Date.now()+'.candidate';
let created=false;
try{await writeFile(candidate,JSON.stringify(output,null,2)+'\n',{flag:'wx'});created=true;
  if(hash(await readFile(planPath))!==expectedPlanHash)throw Error('Concurrent plan change before replacement');
  await rename(candidate,planPath);created=false;
}catch(error){if(created)await unlink(candidate);throw error;}
console.log(JSON.stringify({result:'pass',plan:'docs/core-source-package-plan.json',base_archive_sha256:expectedArchiveHash,
  core_sha256:expectedCore,source_files:output.sourceFiles,source_bytes:output.sourceBytes,
  updated:updated.map(x=>x.path),added:added.map(x=>x.path),unchanged_records:expectedFiles-updated.length,
  source_closure_metadata_preserved:true,archive_built:false}));
