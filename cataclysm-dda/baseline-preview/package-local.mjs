import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parsePackagingArgs, inspectEngineSelection, assertEngineSelectionUnchanged } from './engine-selection.mjs';

const taskRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ownerRoot = path.join(taskRoot, 'baseline-preview');
const webRoot = path.join(ownerRoot, 'web');
const upstream = 'C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const engineRoot = path.join(taskRoot, 'engine-build');
const rustBridgeRoot = path.join(taskRoot, 'rust-browser-bridge');
const rustBridgeDist = path.join(rustBridgeRoot, 'dist');
const rustBridgeWasm = path.join(rustBridgeDist, 'cdda_rust_browser_bridge.wasm');
const expectedRustBridgeHash = '0dadaa2a2d1f133b39f0ee3265c9ba65d4a601c6ce274ae6d4b83f1b40d9d835';
const expectedJapaneseMoHash = '336dc66ccd4d1e828832a38756cddcc165e0f1af917f546752b5655ff02705e7';
const executeFile = promisify(execFile);
const sdk = 'C:/Users/kit/emsdk';
const python = sdk + '/python/3.13.3_64bit/python.exe';
const packager = sdk + '/upstream/emscripten/tools/file_packager.py';
const commit = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const { mode, japaneseMo, engineDir, engineEvidence, explicitEngineSelection } = parsePackagingArgs(process.argv.slice(2), engineRoot);

function filesBelow(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesBelow(absolute, relative);
    if (!entry.isFile()) throw new Error('Non-regular asset requires review: ' + absolute);
    return [{ path: relative, bytes: fs.statSync(absolute).size }];
  });
}
function group(relative, virtual) {
  const files = filesBelow(path.join(upstream, relative));
  return { source: relative, virtual, files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0), entries: files };
}
const groups = [group('data', '/data'), group('gfx', '/gfx'), group('lang/json', '/lang/json')];
if(!fs.existsSync(rustBridgeWasm)||sha256(rustBridgeWasm)!==expectedRustBridgeHash)throw new Error('Bounded Rust bridge differs from the verified artifact; review it before packaging.');
const inventory = { sourceCommit: commit, upstreamTag: '0.I-1', baselineOnly: true,
  referenceOnly: true, completePort: false,
  delivery: { nodeLocalhostOnly: true, externalHostingRequested: false },
  exclusionsFromDataOrGfx: [], groups,
  totalFiles: groups.reduce((sum, item) => sum + item.files, 0),
  totalBytes: groups.reduce((sum, item) => sum + item.bytes, 0),
  audio: { compiledSDL_SOUND: false, bundledBasicSoundAssetsPreserved: true,
    externalSoundpackAcquired: false },
  locale: { default: 'ja', mechanism: 'new-profile USE_LANG=ja after original C++ IDBFS restore',
    runtimeCatalogVirtualPath: '/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo',
    sourceJapanesePo: 'lang/po/ja.po', semanticGameplayJsonIntegrated: false },
  fonts: filesBelow(path.join(upstream, 'data/font')),
  persistence: { mountOwner: 'original C++ main.cpp', mountPath: '/home/web_user/.cataclysm-dda',
    nativeSaveFormatUnchanged: true, shellExportContainer: 'cdda-original-files version 1' },
  rustBrowserBridge: { abi:1,scope:'bounded-shell-and-helper-input',defaultLocale:'ja',
    wasmBytes:fs.statSync(rustBridgeWasm).size,wasmSha256:expectedRustBridgeHash,
    gameplayCore:'original C++',fullGameplayUiMigration:false },
  publication: { localOnly: true, siteCreated: false, fullRustFrontendIntegrated: false,
    boundedRustShellBridgeIntegrated:true,browserValidation: 'pending' } };
fs.mkdirSync(ownerRoot, { recursive: true });
fs.writeFileSync(path.join(ownerRoot, 'asset-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify({ totalFiles: inventory.totalFiles, totalBytes: inventory.totalBytes,
  groups: groups.map(({source,virtual,files,bytes}) => ({source,virtual,files,bytes})) }));
if (mode === '--inventory') process.exit(0);

// No pack job starts until the actual linked original engine and MO exist.
for (const file of [python, packager, path.join(engineRoot, '.emscripten')]) {
  if (!fs.existsSync(file)) throw new Error('Required build artifact unavailable: ' + file);
}
const selectedEngine = inspectEngineSelection({ engineDir, engineEvidence, explicitEngineSelection,
  buildRoot: engineRoot, sourceCommit: commit });
const missingEngineFiles = selectedEngine.missingEngineFiles;
if (mode === '--package') assertEngineSelectionUnchanged(selectedEngine);
if (!japaneseMo || !fs.existsSync(japaneseMo)) throw new Error('Provide the reviewed, compiled Japanese MO with --ja-mo.');
const moBytes = fs.readFileSync(japaneseMo);
if(moBytes.length<28)throw new Error('Japanese catalog is too short for a GNU MO header.');
const moMagic = moBytes.readUInt32LE(0);
if (![0x950412de,0xde120495].includes(moMagic)) throw new Error('Japanese catalog is not a GNU MO file.');
const moWord = offset => moMagic===0x950412de ? moBytes.readUInt32LE(offset) : moBytes.readUInt32BE(offset);
const moEntryCount=moWord(8),moTranslationsTable=moWord(16);
if(moEntryCount<1||moTranslationsTable+moEntryCount*8>moBytes.length)throw new Error('Japanese MO translation table is invalid.');
const moHeaderLength=moWord(moTranslationsTable),moHeaderOffset=moWord(moTranslationsTable+4);
if(moHeaderOffset+moHeaderLength>moBytes.length)throw new Error('Japanese MO language header is invalid.');
const moHeader=moBytes.subarray(moHeaderOffset,moHeaderOffset+moHeaderLength).toString('utf8');
if(!/^Language:\s*ja\s*$/m.test(moHeader))throw new Error('MO header must explicitly declare Language: ja.');
const moSha256=crypto.createHash('sha256').update(moBytes).digest('hex');
if (moSha256 !== expectedJapaneseMoHash || moEntryCount !== 105004) {
  throw new Error('Japanese MO differs from the finalized reviewed 105004-entry current-source catalog.');
}
if(mode==='--preflight') {
  const preflight={sourceCommit:commit,assets:{files:inventory.totalFiles,bytes:inventory.totalBytes},
    japaneseMo:{language:'ja',entryCount:moEntryCount,bytes:moBytes.length,sha256:moSha256,coverageNotVerifiedByPackaging:true},
    trustedInstalledPackager:{path:packager,sha256:sha256(packager)},
    runtimeAssets:{files:inventory.totalFiles+1,bytes:inventory.totalBytes+moBytes.length},
    engineReady:selectedEngine.ready,missingEngineFiles,selectedEngine,
    referenceOnly:true,completePort:false,packJobStarted:false,localOnly:true};
  fs.writeFileSync(path.join(ownerRoot,'packaging-preflight.json'),JSON.stringify(preflight,null,2)+'\n');
  console.log(JSON.stringify(preflight));process.exit(0);
}
if(process.env.CDDA_PACKING_SLOT!=='parent-coordinated')throw new Error('A parent-coordinated heavy slot is required before file_packager/LZ4. Set CDDA_PACKING_SLOT=parent-coordinated only after the slot is explicitly granted.');
const memoryQuery='$packingMemory = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Memory; [pscustomobject]@{availableBytes=[double]$packingMemory.AvailableBytes; committedBytes=[double]$packingMemory.CommittedBytes; commitLimitBytes=[double]$packingMemory.CommitLimit} | ConvertTo-Json -Compress';
const memoryResult=await executeFile('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
  ['-NoProfile','-NonInteractive','-Command',memoryQuery],{windowsHide:true,timeout:20000});
const memory=JSON.parse(memoryResult.stdout.trim());
memory.commitHeadroomBytes=memory.commitLimitBytes-memory.committedBytes;
memory.observedAt=new Date().toISOString();memory.slot='parent-coordinated';
fs.writeFileSync(path.join(ownerRoot,'packaging-memory-launch.json'),JSON.stringify(memory,null,2)+'\n');
if(!Number.isFinite(memory.availableBytes)||!Number.isFinite(memory.commitHeadroomBytes)
  ||memory.availableBytes<4*1024**3||memory.commitHeadroomBytes<6*1024**3)
  throw new Error('Packing memory guard: require at least 4 GiB free physical RAM and 6 GiB commit headroom.');
fs.mkdirSync(webRoot, {recursive: true});
const lock = path.join(ownerRoot, '.packaging.lock');
let lockDescriptor;
try { lockDescriptor = fs.openSync(lock, 'wx'); }
catch { throw new Error('One packaging job is already active; inspect .packaging.lock before retrying.'); }
fs.writeFileSync(lockDescriptor, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));

try {
  const environment = { ...process.env, EM_CONFIG: path.join(engineRoot, '.emscripten'),
    EM_CACHE: path.join(engineRoot, 'cache'), EM_PORTS: path.join(engineRoot, 'ports'),
    ...selectedEngine.packagerEnvironment, EMCC_CORES: '1' };
  delete environment.EMSDK; delete environment.EMSDK_NODE; delete environment.EMSDK_PYTHON;
  const command = [packager, 'cataclysm-tiles.data', '--js-output=cataclysm-tiles.data.js', '--no-node',
    '--preload', ...groups.map(item => path.join(upstream, item.source).replaceAll('\\','/') + '@' + item.virtual),
    japaneseMo.replaceAll('\\','/') + '@/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo', '--lz4'];
  const started = new Date().toISOString();
  fs.writeFileSync(path.join(ownerRoot, 'packaging-command.json'), JSON.stringify({
    executable: python, arguments: command, cwd: webRoot, environment: {
      EM_CONFIG: environment.EM_CONFIG, EM_CACHE: environment.EM_CACHE, EM_PORTS: environment.EM_PORTS, EMCC_CORES: '1'
    }, sourceCommit: commit, selectedEngine, referenceOnly:true,completePort:false,started }, null, 2) + '\n');
  const log = fs.createWriteStream(path.join(ownerRoot, 'packaging.log'));
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(python, command, { cwd: webRoot, env: environment,
      windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    child.stdout.on('data', data => log.write(data)); child.stderr.on('data', data => log.write(data));
    child.once('error', reject); child.once('close', resolve);
  }).finally(() => log.end());
  if (exitCode !== 0) throw new Error('Emscripten file_packager failed; see packaging.log. Exit ' + exitCode);
  if(sha256(japaneseMo)!==moSha256)throw new Error('Japanese catalog changed during packaging; wait for its finalized review artifact.');
  assertEngineSelectionUnchanged(selectedEngine);
  const packageJs=fs.readFileSync(path.join(webRoot,'cataclysm-tiles.data.js'),'utf8');
  const metadataMatch=packageJs.match(/loadPackage\((\{"files":.*\})\);/);
  if(!metadataMatch)throw new Error('Cannot verify actual file-packager metadata.');
  const metadata=JSON.parse(metadataMatch[1]);
  const expectedFiles=groups.flatMap(item=>item.entries.map(file=>({filename:item.virtual+'/'+file.path,bytes:file.bytes})));
  expectedFiles.push({filename:'/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo',bytes:fs.statSync(japaneseMo).size});
  const actualFiles=new Map(metadata.files.map(file=>[file.filename,file.end-file.start]));
  if(actualFiles.size!==expectedFiles.length)throw new Error('Packaged asset count differs from full source inventory.');
  for(const file of expectedFiles)if(actualFiles.get(file.filename)!==file.bytes)throw new Error('Packaged asset missing or size mismatch: '+file.filename);
  fs.writeFileSync(path.join(ownerRoot,'packaging-verification.json'),JSON.stringify({passed:true,
    metadataEntries:metadata.files.length,expectedEntries:expectedFiles.length,
    allDataAndGfxFilesPresent:true,allSourceAssetSizesMatched:true,
    compiledJapaneseMoPresent:true,sourceCommit:commit},null,2)+'\n');
  for (const artifact of selectedEngine.artifacts) {
    fs.copyFileSync(artifact.path, path.join(webRoot, artifact.name));
    if (sha256(path.join(webRoot, artifact.name)) !== artifact.sha256) throw new Error('Copied selected engine hash differs: ' + artifact.name);
  }
  fs.cpSync(rustBridgeDist,path.join(ownerRoot,'shell/rust-browser-bridge'),{recursive:true});
  fs.cpSync(path.join(ownerRoot, 'shell'), webRoot, { recursive: true });
  fs.copyFileSync(path.join(upstream, 'data/cataicon.ico'), path.join(webRoot, 'favicon.ico'));
  const notices = path.join(webRoot, 'notices');
  fs.mkdirSync(notices, {recursive: true});
  const noticeManifest = [];
  function copyNotice(source, relative) {
    const destination = path.join(notices, relative);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(source, destination);
    noticeManifest.push({ path: relative.replaceAll('\\','/'), sha256: sha256(source), bytes: fs.statSync(source).size });
  }
  for (const name of fs.readdirSync(upstream).filter(name => /^LICENSE|^AUTHORS|^COPYING|^NOTICE/.test(name))) {
    if (fs.statSync(path.join(upstream,name)).isFile()) copyNotice(path.join(upstream,name), name);
  }
  for (const base of ['src/third-party','gfx','data/sound']) {
    for (const entry of filesBelow(path.join(upstream,base))) {
      if (/(?:^|\/)(?:licen[sc]e|copying|notice|credits?)(?:\.[^/]*)?$/i.test(entry.path)
        || entry.path.endsWith('tileset.txt')) copyNotice(path.join(upstream,base,entry.path), base + '/' + entry.path);
    }
  }
  // Preserve compiled components whose notices live inline in their sources.
  for (const relative of ['src/colony.h','src/list.h','src/wcwidth.cpp',
    'src/third-party/flatbuffers/flatbuffers.h',
    'src/third-party/imgui/imstb_rectpack.h','src/third-party/imgui/imstb_textedit.h',
    'src/third-party/imgui/imstb_truetype.h']) copyNotice(path.join(upstream,relative), 'inline/' + relative);
  const dependencyNotices = JSON.parse(fs.readFileSync(path.join(engineRoot,'dependency-license-manifest.json'),'utf8'));
  for (const dependency of dependencyNotices) copyNotice(dependency.SourcePath, 'compiler-ports/' + dependency.LicenseFile);
  for (const name of ['build-manifest.json','dependency-archive-hashes.json','dependency-license-manifest.json']) {
    fs.copyFileSync(path.join(engineRoot,name), path.join(notices,name));
  }
  for (const entry of selectedEngine.provenanceFiles) {
    if (sha256(entry.path) !== entry.sha256) throw new Error('Engine provenance changed before notice copy: ' + entry.name);
    copyNotice(entry.path, 'selected-engine/' + entry.name);
  }
  for(const name of ['dist-manifest.json','catalog-provenance.json','source-hashes.json','wasm-runtime.json','build-checks.json']) {
    copyNotice(path.join(rustBridgeRoot,'evidence',name),'rust-browser-bridge/'+name);
  }
  for(const relative of ['NOTICE.md','LICENSE-UPSTREAM.txt','dependency-licenses.json']) {
    copyNotice(path.join(rustBridgeDist,relative),'rust-browser-bridge/'+relative);
  }
  const noticeLinks = noticeManifest.map(item => `<li><a href="notices/${encodeURI(item.path).replaceAll('+','%2B')}">${item.path}</a></li>`).join('\n');
  fs.writeFileSync(path.join(webRoot,'attribution.html'), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ライセンスと出典</title><style>body{font:16px/1.5 system-ui;max-width:70rem;margin:2rem auto;padding:0 1rem}li{overflow-wrap:anywhere}</style><h1>ライセンスと出典</h1><p>Cataclysm: Dark Days Ahead 0.I-1。CleverRaven およびコントリビューター。<a href="https://github.com/CleverRaven/Cataclysm-DDA/tree/${commit}">元のソース</a>。コミット ${commit}。</p><p>ゲーム本体とデータの基本ライセンスは CC BY-SA 3.0。個別のフォント、画像、外部ライブラリーの通知は以下に保持しています。</p><p>変更: オリジナルの C++ エンジンを Emscripten 6.0.8 で構築。日本語の新規プロファイル、ローカルの検証用ブラウザー操作、元の保存ファイルの書き出しを追加。元のゲームルールは維持。音声は無効。ブラウザーの表示テキストと入力補助の限定範囲に Rust WASM を統合しました。ゲーム全体の表示・入力の移行は未完了です。</p><p>追加シェルと翻訳パッチは CC BY-SA 3.0。<a href="rust-browser-bridge/NOTICE.md">Rust ブリッジの出典とライセンス</a>。本パッケージはローカル検証用で、公開版ではありません。</p><ul>${noticeLinks}</ul></html>\n`);
  fs.writeFileSync(path.join(webRoot,'notice-manifest.json'), JSON.stringify(noticeManifest,null,2)+'\n');
  const packageFiles = filesBelow(webRoot).filter(file=>file.path!=='package-manifest.json')
    .map(file => ({...file, sha256:sha256(path.join(webRoot,file.path))}));
  const manifest = { ...inventory, groups: inventory.groups.map(({entries,...summary}) => summary),
    selectedEngine, referenceOnly:true,completePort:false,
    runtimeAssets:{files:expectedFiles.length,bytes:expectedFiles.reduce((sum,file)=>sum+file.bytes,0)},
    compiledJapaneseMo: {bytes:fs.statSync(japaneseMo).size,sha256:moSha256,entryCount:moEntryCount,
      language:'ja',coverageNotVerifiedByPackaging:true},
    compiler: '6.0.8', officialCompiler: '3.1.51', packagerSha256:sha256(packager),
    completed:new Date().toISOString(), files:packageFiles, totalPackageBytes:packageFiles.reduce((sum,file)=>sum+file.bytes,0) };
  fs.writeFileSync(path.join(webRoot,'package-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({ packaged:true, webRoot, totalPackageBytes:manifest.totalPackageBytes,
    files:packageFiles.length, dataBytes:fs.statSync(path.join(webRoot,'cataclysm-tiles.data')).size,
    delivery:'NODE LOCALHOST ONLY; reference engine, original-game browser and full Rust integration gates pending' }));
} finally {
  fs.closeSync(lockDescriptor);
  fs.unlinkSync(lock);
}
