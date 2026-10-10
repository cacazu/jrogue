#!/usr/bin/env node
// Reads official source/build definitions and generates a compile plan; never executes Premake/Lua/game code.
import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const options = {};
for (let i = 2; i < process.argv.length; i += 2) options[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!options.source || !options.out || !options.emsdk) throw new Error('Usage: node make-build-manifest.mjs --source ROOT --emsdk ROOT --out DIR');
const source = path.resolve(options.source);
const out = path.resolve(options.out);
const emsdk = path.resolve(options.emsdk);
for (const input of [source, emsdk]) {
  const rel = path.relative(input, out);
  if (rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))) throw new Error('Outputs must be outside source and SDK inputs');
}
const read = relative => readFile(path.join(source, ...relative.split('/')), 'utf8');
const build = await read('build/te4core.lua');
const premake = await read('premake4.lua');
const optionText = await read('build/options.lua');
const te4coreVersion = Number(/TE4CORE_VERSION\s*=\s*(\d+)/.exec(optionText)?.[1]);
if (te4coreVersion !== 17) throw new Error('Unexpected core version; review version-specific manifest rules');
const commonIncludes = ['src', 'src/luasocket', 'src/fov', 'src/expat', 'src/lxp', 'src/libtcod_import', 'src/physfs', 'src/zlib', 'src/bzip2', 'src/lua'];
for (const include of commonIncludes) if (!premake.includes(`"${include}"`)) throw new Error(`Missing expected Premake include ${include}`);
const socketNames = ['auxiliar', 'buffer', 'except', 'inet', 'io', 'luasocket', 'options', 'select', 'tcp', 'timeout', 'udp', 'usocket', 'mime'];
const definitions = [
  { name: 'TEngine', language: 'C', patterns: ['src/*.c'], defines: ['_DEFAULT_VIDEOMODE_FLAGS_=SDL_HWSURFACE|SDL_DOUBLEBUF', 'TENGINE_HOME_PATH=".t-engine"', `TE4CORE_VERSION=${te4coreVersion}`], optimization: '-O3' },
  { name: 'physfs', language: 'C', patterns: ['src/physfs/*.c', 'src/zlib/*.c', 'src/physfs/archivers/*.c', 'src/physfs/platform/unix.c', 'src/physfs/platform/posix.c'], defines: ['PHYSFS_SUPPORTS_ZIP'], optimization: '-O2', configuration: 'POSIX/Unix source selection, not Windows host selection' },
  { name: 'luadefault', language: 'C', patterns: ['src/lua/*.c'], defines: [], optimization: '-O2', configuration: '_OPTIONS.lua="default", overriding original default jit2' },
  { name: 'luasocket', language: 'C', patterns: socketNames.map(name => `src/luasocket/${name}.c`), defines: [], optimization: '-O2', configuration: 'not windows; use usocket.c, exclude wsocket.c' },
  { name: 'fov', language: 'C', patterns: ['src/fov/*.c'], defines: [], optimization: '-O2' },
  { name: 'lpeg', language: 'C', patterns: ['src/lpeg/*.c'], defines: [], optimization: '-O2' },
  { name: 'luaprofiler', language: 'C', patterns: ['src/luaprofiler/*.c'], defines: [], optimization: '-O2' },
  { name: 'tcodimport', language: 'C', patterns: ['src/libtcod_import/*.c'], defines: [], optimization: '-O2' },
  { name: 'expatstatic', language: 'C', patterns: ['src/expat/*.c'], defines: ['HAVE_MEMMOVE'], optimization: '-O2' },
  { name: 'lxp', language: 'C', patterns: ['src/lxp/*.c'], defines: [], optimization: '-O2' },
  { name: 'luamd5', language: 'C', patterns: ['src/luamd5/*.c'], defines: [], optimization: '-O2' },
  { name: 'luazlib', language: 'C', patterns: ['src/lzlib/*.c'], defines: [], optimization: '-O2' },
  { name: 'luabitop', language: 'C', patterns: ['src/luabitop/*.c'], defines: [], optimization: '-O2' },
  { name: 'te4-bzip', language: 'C', patterns: ['src/bzip2/*.c'], defines: [], optimization: '-O2' },
  { name: 'te4-wfc', language: 'C++', patterns: ['src/wfc/*.cpp'], defines: [], optimization: '-O3', compileFlags: ['-std=c++11'] },
  { name: 'utf8proc', language: 'C', patterns: ['src/utf8proc/utf8proc.c'], defines: [], optimization: '-O2' },
];
async function expand(pattern) {
  if (!pattern.includes('*')) { await stat(path.join(source, ...pattern.split('/'))); return [pattern]; }
  const directory = path.posix.dirname(pattern);
  const mask = path.posix.basename(pattern);
  const regex = new RegExp(`^${mask.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  const files = (await readdir(path.join(source, ...directory.split('/')), { withFileTypes: true })).filter(entry => entry.isFile() && regex.test(entry.name)).map(entry => `${directory}/${entry.name}`).sort();
  if (!files.length) throw new Error(`No source files match ${pattern}`);
  return files;
}
const projects = [];
for (const definition of definitions) {
  if (!build.includes(`project "${definition.name}"`)) throw new Error(`Unknown Premake project ${definition.name}`);
  for (const pattern of definition.patterns) if (!build.includes(`"../${pattern}"`)) throw new Error(`Pattern not found in original project definitions: ${pattern}`);
  const sources = [...new Set((await Promise.all(definition.patterns.map(expand))).flat())].sort();
  projects.push({ ...definition, includeDirectories: commonIncludes, sources });
}
const allSources = projects.flatMap(project => project.sources);
if (new Set(allSources).size !== allSources.length) throw new Error('Duplicate translation unit across selected projects');
if (allSources.some(file => /(^|\/)(lua|luac)\.c$/.test(file))) throw new Error('Interpreter CLI accidentally included');
await mkdir(out, { recursive: true });
const earlyCommonDefines = ['GLEW_STATIC', 'NDEBUG=1'];
const earlyPortFlags = ['-sUSE_SDL=2', '-sUSE_SDL_IMAGE=2', '-sUSE_SDL_TTF=2', '-sSDL2_IMAGE_FORMATS=["png"]', '-sUSE_LIBPNG=1', '-sUSE_VORBIS=1', '-sUSE_OGG=1'];
const sourcesReady = {
  schemaVersion: 1,
  state: 'Exact source/project/includes/defines ready; final transitive header and registry report follows separately.',
  sourceRoot: source,
  compilers: { c: 'emcc', cxx: 'em++', finalLink: 'em++' },
  commonIncludes, commonDefines: earlyCommonDefines,
  rootMeasuredBrowserProbeDefines: ['SELFEXE_LINUX', '_GNU_SOURCE'],
  rootMeasuredKernelCompile: 'Root reports all 127 original translation units compiled (23 kernel plus 104 mandatory dependencies) with installed Emscripten 6.0.8; full runtime fidelity is not established.',
  projects,
  objectPlan: projects.flatMap(project => project.sources.map(file => ({
    project: project.name, source: file, sourceAbsolute: path.join(source, ...file.split('/')),
    compiler: project.language === 'C++' ? 'em++' : 'emcc',
    includes: commonIncludes.map(directory => path.join(source, ...directory.split('/'))),
    defines: [...earlyCommonDefines, ...project.defines],
    browserProbeDefines: ['SELFEXE_LINUX', '_GNU_SOURCE'],
    wasmPlatformDefines: project.name === 'physfs' ? ['PHYSFS_NO_CDROM_SUPPORT'] : [],
    compileFlags: [project.optimization, ...(project.compileFlags ?? [])],
    portFlags: earlyPortFlags,
    objectRelative: `objects/${project.name}/${path.posix.basename(file).replace(/\.(c|cpp)$/, '.o')}`,
  }))),
  summary: { projects: projects.length, sources: allSources.length, cSources: allSources.filter(file => file.endsWith('.c')).length, cxxSources: allSources.filter(file => file.endsWith('.cpp')).length, kernelSources: projects[0].sources.length, allSourceFilesExist: true, luaCliIncluded: false },
};
await writeFile(path.join(out, 'sources-ready.json'), `${JSON.stringify(sourcesReady, null, 2)}\n`, 'utf8');
await writeFile(path.join(out, 'source-list.txt'), `${allSources.join('\n')}\n`, 'utf8');
console.log(`Source manifest ready: ${path.join(out, 'sources-ready.json')}`);
console.log(JSON.stringify(sourcesReady.summary));
if (options['sources-only'] === 'true') process.exit(0);
const sourceTexts = new Map(await Promise.all(allSources.map(async file => [file, await read(file)])));
const main = sourceTexts.get('src/main.c');
function linesMatching(file, pattern, limit = 100) {
  const text = sourceTexts.get(file) ?? '';
  return text.split(/\r?\n/).flatMap((line, index) => pattern.test(line) ? [{ line: index + 1, text: line.trim() }] : []).slice(0, limit);
}
const mainRegistry = [];
const mainLines = main.split(/\r?\n/);
for (let index = 0; index < mainLines.length; index++) {
  const match = /^\s*(luaopen_[a-zA-Z0-9_]+)\(L\);/.exec(mainLines[index]);
  if (!match) continue;
  const symbol = match[1];
  const implementations = [...sourceTexts].flatMap(([file, text]) => new RegExp(`\\b(?:int|void)\\s+${symbol}\\s*\\([^;{}]*\\)\\s*\\{`).test(text) ? [file] : []);
  mainRegistry.push({ order: mainRegistry.length + 1, symbol, line: index + 1, conditional: symbol === 'luaopen_discord' ? 'DISCORD_TE4 (disabled)' : null, implementations });
}
const libraryRegistrations = [...sourceTexts].flatMap(([file]) => linesMatching(file, /\bluaL_(register|openlib)\s*\(/).map(evidence => ({ file, ...evidence })));
const sourceMetadata = await Promise.all(allSources.map(async file => {
  const bytes = await readFile(path.join(source, ...file.split('/')));
  return { path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
const seenFiles = new Set();
const includeEvidence = [];
async function scanIncludes(file) {
  if (seenFiles.has(file)) return;
  seenFiles.add(file);
  let text;
  try { text = await read(file); } catch { return; }
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const match = /^\s*#\s*include\s*(["<])([^">]+)[">]/.exec(lines[index]);
    if (!match) continue;
    const header = match[2];
    const candidates = match[1] === '"' ? [path.posix.join(path.posix.dirname(file), header), ...commonIncludes.map(directory => `${directory}/${header}`)] : commonIncludes.map(directory => `${directory}/${header}`);
    let resolvedLocal = null;
    for (const candidate of candidates) {
      try { if ((await stat(path.join(source, ...candidate.split('/')))).isFile()) { resolvedLocal = candidate; break; } } catch {}
    }
    includeEvidence.push({ file, line: index + 1, header, kind: match[1] === '"' ? 'quoted' : 'system', resolvedLocal, conditionalStatus: 'Raw include inventory; preprocessor branches are not evaluated.' });
    if (resolvedLocal) await scanIncludes(resolvedLocal);
  }
}
for (const file of allSources) await scanIncludes(file);
const sdkHeaders = ['SDL2/SDL.h', 'SDL2/SDL_image.h', 'SDL2/SDL_ttf.h', 'GL/gl.h', 'GL/glu.h', 'GL/glx.h', 'GL/glew.h', 'AL/al.h', 'AL/alc.h', 'vorbis/vorbisfile.h', 'png.h', 'pthread.h', 'sys/socket.h', 'unistd.h', 'pwd.h'];
const sdkIncludeRoot = path.join(emsdk, 'upstream/emscripten/cache/sysroot/include');
const sdkHeaderAvailability = await Promise.all(sdkHeaders.map(async header => {
  const file = path.join(sdkIncludeRoot, ...header.split('/'));
  try { const info = await stat(file); return { header, path: file, present: info.isFile(), bytes: info.size }; }
  catch { return { header, path: file, present: false }; }
}));
let sdkVersion = null;
try {
  const rawVersion = (await readFile(path.join(emsdk, 'upstream/emscripten/emscripten-version.txt'), 'utf8')).trim();
  sdkVersion = rawVersion.startsWith('"') ? JSON.parse(rawVersion) : rawVersion;
} catch {}
let actualPhysfsPlatformProbe = null;
try { actualPhysfsPlatformProbe = JSON.parse(await readFile(path.join(out, 'physfs-platform-probe.json'), 'utf8')); } catch {}
const originalLinks = ['physfs', 'luadefault', 'fov', 'luasocket', 'luaprofiler', 'lpeg', 'tcodimport', 'lxp', 'expatstatic', 'luamd5', 'luazlib', 'luabitop', 'te4-bzip', 'te4-wfc', 'utf8proc', 'm', 'stdc++'];
const portFlags = ['-sUSE_SDL=2', '-sUSE_SDL_IMAGE=2', '-sUSE_SDL_TTF=2', '-sSDL2_IMAGE_FORMATS=["png"]', '-sUSE_LIBPNG=1', '-sUSE_VORBIS=1', '-sUSE_OGG=1'];
const commonDefines = ['GLEW_STATIC', 'NDEBUG=1'];
const objectPlan = projects.flatMap(project => project.sources.map(file => ({
  project: project.name, source: file, sourceAbsolute: path.join(source, ...file.split('/')),
  compiler: project.language === 'C++' ? 'em++' : 'emcc',
  includes: commonIncludes.map(directory => path.join(source, ...directory.split('/'))),
  defines: [...commonDefines, ...project.defines],
  compileFlags: [project.optimization, ...(project.compileFlags ?? [])],
  browserProbeDefines: ['SELFEXE_LINUX', '_GNU_SOURCE'],
  wasmPlatformDefines: project.name === 'physfs' ? ['PHYSFS_NO_CDROM_SUPPORT'] : [],
  portFlags,
  objectRelative: `objects/${project.name}/${path.posix.basename(file).replace(/\.(c|cpp)$/, '.o')}`,
  readiness: 'Source/flag plan only; root owns actual compile results and portability adapters.',
})));
if (new Set(objectPlan.map(item => item.objectRelative)).size !== objectPlan.length) throw new Error('Object output path collision');
const archivePlan = originalLinks.filter(name => projects.some(project => project.name === name)).map(name => ({
  project: name,
  originalType: 'StaticLib',
  originalTargetName: name === 'luadefault' ? 'lua' : name,
  archiver: 'emar', argumentsPrefix: ['rcs'],
  archiveRelative: `archives/lib${name}.a`,
  objects: objectPlan.filter(item => item.project === name).map(item => item.objectRelative),
  resolution: 'Normal lazy archive member extraction; do not use --whole-archive.',
}));
const linkPlan = {
  compiler: 'em++',
  kernelObjects: objectPlan.filter(item => item.project === 'TEngine').map(item => item.objectRelative),
  archivesInOriginalLinkOrder: archivePlan.map(item => item.archiveRelative),
  graphicsAdapterObjects: ['graphics-adapter/tome_graphics_adapter.o', 'graphics-adapter/tome_glu_quadric.o'],
  graphicsAdapterFlags: ['-Wl,--wrap=glewInit', '-sLEGACY_GL_EMULATION=1'],
  portFlags, libraryFlags: ['-lopenal', '-lm'],
  rationale: 'Dependencies were StaticLib projects in Premake. Linking all dependency objects eagerly duplicates auxiliar symbols from src/auxiliar.c and src/luasocket/auxiliar.c; normal static-archive extraction preserves the original project behavior.',
  measuredBaseline: { allOriginalUnitsCompile: true, originalTranslationUnits: 127, kernelUnits: 23, dependencyUnits: 104, sdkVersion: '6.0.8', compileEvidence: 'native-core-work (parent-owned)', archiveLinkEvidence: 'native-core-work/logs/original-archive-link.txt', unresolvedOriginalGraphicsSymbols: ['glGetTexImage', 'glPushAttrib', 'glPopAttrib', 'gluNewQuadric', 'gluDeleteQuadric', 'gluQuadricNormals', 'gluQuadricTexture', 'gluSphere', 'glXGetClientString', 'glXGetProcAddressARB', 'glXQueryVersion'], adapterLinkStatus: 'Root owns actual combined link/browser results; compile success of adapter objects does not establish visual/gameplay fidelity.' },
};
const constraints = [
  { id: 'glew-native-loader', evidence: linesMatching('src/glew.c', /glxew\.h|define glewGetProcAddress|glXGetProcAddress/), requirement: 'Native GLEW selects the non-Apple/non-Windows GLX path. Header presence does not prove WebGL runtime support; retain original APIs for diagnostics and implement a browser graphics adapter as required by actual compile/link/runtime results.', status: 'source-evidence; not an observed compiler failure' },
  { id: 'blocking-main-loop', evidence: linesMatching('src/main.c', /while \(!exit_engine\)|SDL_WaitEvent|SDL_AddTimer|SDL_CreateThread/), requirement: 'Convert control ownership to an asynchronous browser loop; preserve on_event/on_tick simulation ordering. A successful native-style compile does not validate browser responsiveness.', status: 'source-evidence' },
  { id: 'texture-readback', evidence: linesMatching('src/core_lua.c', /glGetTexImage/), requirement: 'Verify/replace desktop texture readback in the presentation/platform adapter; emulated desktop GL support is incomplete.', status: 'source-evidence; runtime requirement' },
  { id: 'native-worker-services', evidence: ['src/music.c', 'src/particles.c', 'src/profile.c', 'src/serial.c'].flatMap(file => linesMatching(file, /SDL_CreateThread|SDL_CreateMutex|SDL_CreateCond|SDL_CondWait|SDL_WaitThread/).map(item => ({ file, ...item }))), requirement: 'Select real worker/pthread integration with hosting isolation or refactor services to a browser task adapter; do not silently replace serialization/gameplay semantics.', status: 'source-evidence' },
  { id: 'native-self-path', evidence: linesMatching('src/getself.c', /SELFEXE_|\/proc\/self\/exe|return NULL|return 1|GetModuleFileName|sysconf/), requirement: 'Avoid declaring a false native SELFEXE platform as a final browser solution. With all SELFEXE macros absent get_self_executable returns NULL and get_number_cpus returns 1; inspect callers and supply a browser VFS path adapter.', status: 'source-evidence' },
  { id: 'embedded-web-loader', evidence: linesMatching('src/web.c', /SELFEXE_|SDL_LoadObject|SDL_LoadFunction|void \*web/, 35), requirement: 'Optional Awesomium/CEF projects are excluded. Core web.c remains in the exact original wildcard source list; verify its native guarded loader under the selected browser macros and supply an explicitly disabled feature adapter if required.', status: 'source-evidence; not an observed compiler failure' },
  { id: 'luasocket-browser-network', evidence: ['src/luasocket/usocket.c', 'src/luasocket/inet.c', 'src/luasocket/tcp.c', 'src/luasocket/udp.c'].flatMap(file => linesMatching(file, /\b(socket|connect|select|gethostbyname|gethostbyaddr|recvfrom|sendto)\s*\(/, 8).map(item => ({ file, ...item }))), requirement: 'Socket source is retained. Browser networking requires explicit WebSocket/Fetch integration; POSIX socket build success does not establish direct TCP/UDP access or official-service compatibility.', status: 'source-evidence; browser API limitation' },
  { id: 'lua-physfs', evidence: linesMatching('src/lua/lauxlib.c', /physfs\.h|PHYSFS_(openRead|eof|read|close)/), requirement: 'Bundled Lua auxiliary loader is modified to use PhysFS; compile the real filesystem dependency or an explicitly tested source-preserving adapter, not an unmodified stand-alone Lua assumption.', status: 'source-evidence' },
];
const physfsPlatformHeader = await read('src/physfs/physfs_platforms.h');
const manifest = {
  schemaVersion: 1,
  upstream: { sourceRoot: source, version: '1.7.6', commit: '624a67329fe2ad440c5b344785a9c73fcf22ae63', archiveSha256: '989dea00803f8cdcade024f4647d480bb1ac0d437c254292c07549c272a4680c' },
  scope: 'Full original top-level C kernel plus all mandatory bundled dependency projects; Lua default explicitly selected; no source modifications or compilation performed by this generator.',
  originalBuildInputs: ['premake4.lua', 'build/options.lua', 'build/te4core.lua'].map(file => ({ file, sha256: createHash('sha256').update(file === 'premake4.lua' ? premake : file === 'build/options.lua' ? optionText : build).digest('hex') })),
  selectedOptions: { lua: 'default', steam: false, discord: false, webAwesomium: false, webCef3: false, noRwopsSize: false, te4coreVersion },
  exclusions: ['src/luajit2/**', 'steamworks/**', 'src/discord-rpc/**', 'src/web-awesomium/**', 'src/web-cef3/**', 'src/mac/**', 'src/windows/**', 'src/physfs/platform/windows.c', 'src/luasocket/wsocket.c'],
  optionalCoreWrappers: { 'src/discord-te4.c': 'Retained by src/*.c but DISCORD_TE4 is unset; no Discord implementation enabled.', 'src/web.c': 'Retained by src/*.c; optional embedded-browser libraries excluded, native loader still requires compile/runtime validation.' },
  compilers: { c: 'emcc', cxx: 'em++', finalLink: 'em++ (WFC is C++; do not compile C sources as C++ accidentally)' },
  commonIncludes, commonDefines, projects, sourceMetadata, objectPlan, archivePlan, linkPlan,
  rootMeasuredBrowserProbeDefines: ['SELFEXE_LINUX', '_GNU_SOURCE'],
  rootMeasuredKernelCompile: 'Root reports all 127 original translation units compiled with SDK 6.0.8 ports and POSIX/Linux selectors; no source/header compile failure is claimed. The original archive link exposed eleven graphics platform symbols addressed by a separate browser adapter.',
  links: { originalMandatory: originalLinks, portFlags, browserLibraryFlags: ['-lopenal', '-lm'], bundledZlib: 'Keep src/zlib/*.c from PhysFS project; do not add a second directly compiled zlib implementation.', nativeOnlyExcludedLinks: ['mingw32', 'SDL2main', 'OpenAL32', 'opengl32', 'glu32', 'wsock32', 'GL', 'GLU', 'dl', 'pthread as a plain native link flag'], graphicsDiagnosticOption: '-sLEGACY_GL_EMULATION=1 is an incomplete emulation candidate, not evidence of original visual fidelity.' },
  physfsWasmPlan: { sourceFiles: ['src/physfs/platform/unix.c', 'src/physfs/platform/posix.c'], platformHeader: physfsPlatformHeader, actualPhysfsPlatformProbe, targetGuard: 'unix or __unix__ selects PHYSFS_PLATFORM_UNIX and PHYSFS_PLATFORM_POSIX. The installed wasm32 Emscripten Clang probe confirms those macros and selection without a source patch or false Linux define.', recommendedPlatformDefines: ['PHYSFS_NO_CDROM_SUPPORT'], optionalSingleThreadDefine: 'PHYSFS_NO_THREAD_SUPPORT only when all users of this PhysFS instance are single-threaded.', noThreadSupportWarning: 'Original native kernel starts worker services; PHYSFS_NO_THREAD_SUPPORT is not a safe global substitute for a worker design.' },
  initialization: { source: 'src/main.c', luaOpen: linesMatching('src/main.c', /L = lua_open|luaL_openlibs/), moduleRegistry: mainRegistry, standardModulesUnconditional: mainRegistry.filter(item => !item.conditional).length, duplicateBitOpenPreserved: mainRegistry.filter(item => item.symbol === 'luaopen_bit').length, nativeBootstrapEvidence: linesMatching('src/main.c', /PHYSFS_init|PHYSFS_addToSearchPath|PHYSFS_setWriteDir|luaL_loadfile|lua_pcall|SDL_Init|TTF_Init|te4_web_load|te4_web_init/) },
  libraryRegistrations, includeEvidence,
  sdk: { root: emsdk, version: sdkVersion, includeRoot: sdkIncludeRoot, headerAvailability: sdkHeaderAvailability, observation: 'Snapshot of existing SDK header cache; missing port headers may be generated during an authorized standard port build. No SDK install/build was run by this generator.' },
  portabilityConstraints: constraints,
  references: ['https://emscripten.org/docs/tools_reference/settings_reference.html', 'https://emscripten.org/docs/porting/multimedia_and_graphics/OpenGL-support.html', 'https://emscripten.org/docs/porting/pthreads.html', 'https://emscripten.org/docs/porting/networking.html', 'https://emscripten.org/docs/porting/emscripten-runtime-environment.html'],
  summary: { projects: projects.length, sources: allSources.length, cSources: allSources.filter(file => file.endsWith('.c')).length, cxxSources: allSources.filter(file => file.endsWith('.cpp')).length, kernelSources: projects[0].sources.length, allSourceFilesExist: true, luaCliIncluded: false, actualCompileResults: 'Root measured all 127 original translation units successfully compiling with Emscripten 6.0.8. No browser runtime equivalence claim.' },
};
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'emcc-build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(path.join(out, 'source-list.txt'), `${allSources.join('\n')}\n`, 'utf8');
await writeFile(path.join(out, 'lua-registry.json'), `${JSON.stringify(manifest.initialization, null, 2)}\n`, 'utf8');
await writeFile(path.join(out, 'include-inventory.json'), `${JSON.stringify(includeEvidence, null, 2)}\n`, 'utf8');
await writeFile(path.join(out, 'archive-link-plan.json'), `${JSON.stringify({ archivePlan, linkPlan }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ...manifest.summary, sourcesByProject: Object.fromEntries(projects.map(project => [project.name, project.sources.length])), mainRegistry: mainRegistry.map(item => ({ symbol: item.symbol, implementations: item.implementations, conditional: item.conditional })), sdk: manifest.sdk }, null, 2));
