/* SPDX-License-Identifier: GPL-3.0-or-later
 * Source-faithful Node launch adapter for the actual original C/Lua engine.
 * Source and archives remain host files read through Emscripten's real NODEFS.
 * No asset preloading, game rule replacement, canvas, font, or SDL mock exists.
 * Runtime execution is owned by the parent, not by this source preparation.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const adapterDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(adapterDir, '..');
const workLayout = path.basename(adapterDir)==='bootstrap-work';
const portDir = path.resolve(adapterDir,'../..');

function optionsFrom(argv) {
  const options = {
    module: workLayout ? path.join(workspaceDir, 'native-core-work/browser-build/tome-native.mjs') : path.join(portDir,'dist/native/tome-native.mjs'),
    manifest: path.join(adapterDir, 'browser-vfs-inputs.json'),
    home: path.join(adapterDir, 'node-runtime-home', `session-${Date.now()}`),
    mountsOnly: false, commands: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--mounts-only') options.mountsOnly = true;
    else if (['--module', '--manifest', '--home', '--command'].includes(key)) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
      if (key === '--command') options.commands.push(value);
      else options[key.slice(2)] = path.resolve(value);
    } else throw new Error(`Unknown option: ${key}`);
  }
  return options;
}

function contained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function isolatedHome(target) {
  const root = fs.realpathSync(workspaceDir);
  const resolved = path.resolve(target);
  if (!contained(root, resolved) || resolved === root) throw new Error('Writable runtime home must be below the task workspace');
  let ancestor = resolved;
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error('Runtime home has no existing permitted ancestor');
    ancestor = parent;
  }
  if (!contained(root, fs.realpathSync(ancestor))) throw new Error('Runtime home ancestor resolves outside the task workspace');
  fs.mkdirSync(resolved, {recursive:true});
  if (!contained(root, fs.realpathSync(resolved))) throw new Error('Runtime home resolves outside the task workspace');
  return fs.realpathSync(resolved);
}

function readOnlyNodeFS(FS, NODEFS, metrics, {allowedRootNames=null, overlays=new Map()}={}) {
  const fail = (code) => { throw new FS.ErrnoError(NODEFS.convertNodeCode({code})); };
  const rejectWrite = () => fail('EROFS');
  const decorated = new WeakSet();
  function relative(node) {
    return path.relative(node.mount.opts.root, NODEFS.realPath(node)).split(path.sep).join('/');
  }
  function overlayFor(node) { return overlays.get(relative(node)); }
  function lock(node) {
    if (decorated.has(node)) return node;
    decorated.add(node);
    node.mode &= ~0o222;
    node.node_ops = {
      ...NODEFS.node_ops,
      getattr(current) {
        const replacement = overlayFor(current);
        const stat = replacement
          ? NODEFS.getattr(() => fs.lstatSync(replacement), current)
          : NODEFS.node_ops.getattr(current);
        stat.mode &= ~0o222;
        return stat;
      },
      lookup(parent, name) {
        if (allowedRootNames && parent.parent === parent && !allowedRootNames.has(name)) fail('ENOENT');
        const found = NODEFS.node_ops.lookup(parent, name);
        if (FS.isLink(found.mode)) fail('ENOENT');
        return lock(found);
      },
      readdir(current) {
        const names = NODEFS.node_ops.readdir(current);
        return allowedRootNames && current.parent === current
          ? names.filter((name) => allowedRootNames.has(name)) : names;
      },
      setattr:rejectWrite, mknod:rejectWrite, rename:rejectWrite,
      unlink:rejectWrite, rmdir:rejectWrite, symlink:rejectWrite,
    };
    node.stream_ops = {
      ...NODEFS.stream_ops,
      open(stream) {
        const flags = NODEFS.flagsForNode(stream.flags);
        const writes = fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_APPEND |
          fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_EXCL;
        if ((flags & writes) !== 0) rejectWrite();
        const replacement = overlayFor(stream.node);
        if (replacement) {
          stream.shared.refcount = 1;
          stream.nfd = fs.openSync(replacement, 'r');
        } else NODEFS.stream_ops.open(stream);
        metrics.openedFiles++;
      },
      read(stream, buffer, offset, length, position) {
        const count = NODEFS.stream_ops.read(stream, buffer, offset, length, position);
        metrics.readCalls++;
        metrics.readBytes += count;
        metrics.maxReadRequest = Math.max(metrics.maxReadRequest, length);
        if (/\.team$/i.test(stream.node.name)) metrics.archiveReadBytes += count;
        return count;
      },
      setattr:rejectWrite, write:rejectWrite, msync:rejectWrite, allocate:rejectWrite,
    };
    return node;
  }
  return {mount(mount) { return lock(NODEFS.mount(mount)); }};
}

function mountActualInputs(module, manifest, home, metrics, manifestDir) {
  const FS = module.FS;
  const NODEFS = module.NODEFS || FS?.filesystems?.NODEFS;
  if (!FS || !NODEFS) throw new Error('Link must provide actual FS and NODEFS: -lnodefs.js and exported runtime NODEFS/FS');
  if (typeof NODEFS.mount !== 'function' || typeof NODEFS.convertNodeCode !== 'function') {
    throw new Error('Expected the actual classic Emscripten NODEFS backend');
  }
  const fileGroups = new Map();
  let mounts = 0;
  for (const input of manifest.inputs) {
    const physical = fs.realpathSync(path.resolve(manifestDir,input.physical));
    const stat = fs.statSync(physical);
    if (input.type === 'file') {
      if (!stat.isFile()) throw new Error(`Input is not an original file: ${input.physical}`);
      const key = path.posix.dirname(input.virtual);
      const group = fileGroups.get(key) || {physical:path.dirname(physical), names:new Set()};
      if (group.physical !== path.dirname(physical)) throw new Error(`Mixed host directories at ${key}`);
      group.names.add(path.posix.basename(input.virtual));
      fileGroups.set(key, group);
      continue;
    }
    if (!stat.isDirectory()) throw new Error(`Input is not an original directory: ${input.physical}`);
    FS.mkdirTree(input.virtual);
    const overlays = new Map();
    const overlay = manifest.build_overlay;
    if (overlay && input.virtual === '/unpacked/game/modules/tome') {
      const patched = fs.realpathSync(path.resolve(manifestDir,overlay.staged));
      overlays.set('mod/class/AsciiMap.lua', patched);
    }
    FS.mount(readOnlyNodeFS(FS,NODEFS,metrics,{overlays}), {root:physical}, input.virtual);
    mounts++;
  }
  for (const [virtual, group] of fileGroups) {
    FS.mkdirTree(virtual);
    FS.mount(readOnlyNodeFS(FS,NODEFS,metrics,{allowedRootNames:group.names}), {root:group.physical}, virtual);
    mounts++;
  }
  FS.mkdirTree('/persist');
  FS.mount(NODEFS,{root:home},'/persist');
  for (const required of [
    '/original/bootstrap/boot.lua','/original/game/loader/pre-init.lua',
    '/original/game/thirdparty/config.lua','/original/game/addons','/unpacked/game/engines/default/engine/version.lua',
    '/unpacked/game/modules/tome/mod/init.lua','/adapter/real-core-probe.lua',
    '/original/game/modules/tome-1.7.6.team','/original/game/build-overlay/mod/class/AsciiMap.lua',
    '/original/game/engine-overlay/engine/SavefilePipe.lua',
    '/original/game/modules/tome-1.7.6-gfx.team',
  ]) FS.stat(required);
  return mounts;
}

function snapshotSummary(snapshot) {
  const player = snapshot.game?.player;
  const level = snapshot.game?.level;
  return {
    protocol:snapshot.protocol, ready:snapshot.ready, turn:snapshot.game?.turn,
    player:player && {uid:player.uid,name:player.name,x:player.x,y:player.y,level:player.level,life:player.life},
    level:level && {level:level.level,w:level.map?.w,h:level.map?.h,cells:level.map?.cells?.length},
  };
}

export async function launchActualEngine(options) {
  const manifest = JSON.parse(fs.readFileSync(options.manifest,'utf8'));
  const home = isolatedHome(options.home);
  const namespace = await import(pathToFileURL(options.module).href);
  if (typeof namespace.default !== 'function') throw new Error('Expected MODULARIZE/EXPORT_ES6 native module factory');
  const module = await namespace.default({
    noInitialRun:true,
    locateFile:(name) => path.join(path.dirname(options.module),name),
    print:(line) => {
      const match = String(line).match(/^(TOME_REAL_(?:BIRTH|BOOT)_JSON)=(.*)$/);
      if (match) console.log(`${match[1]}_SUMMARY=${JSON.stringify(snapshotSummary(JSON.parse(match[2])))}`);
      else console.log(line);
    },
    printErr:(line) => console.error(line),
  });
  const metrics = {openedFiles:0,readCalls:0,readBytes:0,archiveReadBytes:0,maxReadRequest:0};
  const mounts = mountActualInputs(module,manifest,home,metrics,path.dirname(options.manifest));
  console.log('TOME_NODE_VFS_READY='+JSON.stringify({mounts,home,sourceInputs:manifest.inputs.length,assetBytesPreloaded:0}));
  if (options.mountsOnly) return {phase:'actual-nodefs-mounted',metrics};
  if (typeof module.ccall !== 'function') throw new Error('Actual native module must export ccall');
  const nativeError = () => module.ccall('tome_native_last_error','string',[],[]);
  if (module.ccall('tome_native_init','number',[],[]) !== 1) {
    throw new Error(`Actual SDL/native initialization failed: ${nativeError()}`);
  }
  if (module.ccall('tome_native_start','number',[],[]) !== 1) {
    throw new Error(`Actual original game bootstrap failed: ${nativeError()}`);
  }
  const snapshotText = module.ccall('tome_native_snapshot','string',[],[]);
  if (!snapshotText) throw new Error(`Original snapshot failed: ${nativeError()}`);
  const snapshot = JSON.parse(snapshotText);
  const commands = [];
  for (const command of options.commands) {
    const text = module.ccall('tome_native_command','string',['string'],[command]);
    if (!text) throw new Error(`Original command ${command} failed: ${nativeError()}`);
    const result = JSON.parse(text);
    const before = result.before?.game?.player;
    const after = result.after?.game?.player;
    commands.push({command:result.command,ticks:result.ticks,
      moved:!!(before&&after&&(before.x!==after.x||before.y!==after.y)),
      before:snapshotSummary(result.before),after:snapshotSummary(result.after)});
  }
  return {phase:'original-loader-returned',snapshot:snapshotSummary(snapshot),commands,metrics};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await launchActualEngine(optionsFrom(process.argv.slice(2)));
    console.log('TOME_NODE_RESULT='+JSON.stringify(result));
  } catch (error) {
    console.error('TOME_NODE_FAILURE='+JSON.stringify({message:error.message,
      graphicsRequirement:'Native init creates a real SDL OpenGL window/context. Node requires a genuine compatible graphics environment; this harness supplies no graphics mock.'}));
    process.exitCode = 1;
  }
}
