/* Classic worker: Asyncify yields without blocking the browser UI. */
'use strict';
let engine = null, started = false, protocol = null;
const pendingEvents = [];
let requestedLocale = 'ja', catchingUp = false, acceptingInput = false;
let nextGroup = 1n;
let draft = {text:'',composing:false,selectionStart:0,selectionEnd:0,selectionDirection:'none',focused:false};
let lastFrame = null, lastState = null, lastPresentation = null;
const emit = (type, payload) => self.postMessage({type,payload});
const jsonValue = value => typeof value === 'string' ? JSON.parse(value) : value;
function call(name, values = []) { return engine.ccall(name,'number',values.map(() => 'number'),values); }
function withBytes(bytes, use) {
  if (!(bytes instanceof Uint8Array)) throw new Error('Invalid owned bridge bytes');
  if (!bytes.length) return use(0);
  const pointer = engine._malloc(bytes.length);
  if (!pointer) throw new Error('Replay input allocation failed');
  try { engine.HEAPU8.set(bytes,pointer); return use(pointer); } finally { engine._free(pointer); }
}
function getterBytes(prefix, cap) {
  const pointer = call(prefix + '_data') >>> 0, length = call(prefix + '_len') >>> 0;
  if (length > cap || (!pointer && length) || pointer > engine.HEAPU8.length - length) throw new Error('save.corrupt');
  return engine.HEAPU8.slice(pointer,pointer + length);
}
let characterExportRejected=false;
function presentation(name, args = []) {
  const pointer = call(name,args);
  if (call('ab_rs_present_status')) { if (!catchingUp) emit('semantic-error','Rust presentation capture failed'); return false; }
  if (pointer) {
    lastPresentation = engine.UTF8ToString(pointer,8 * 1024 * 1024 + 1);
    if (!catchingUp) emit('presentation',lastPresentation);
  }
  return true;
}
function capturedPresentation(name, capture) {
  const bytes = new TextEncoder().encode(capture);
  const accepted = withBytes(bytes,pointer => presentation(name,[pointer,bytes.length]));
  if (!accepted && !catchingUp) emit('semantic-error',`Rejected source ${name}: ${capture.slice(0,8192)}`);
  return accepted;
}
function bytesToBase64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i,i + 8192));
  return btoa(result);
}
function base64ToBytes(value) {
  const raw = atob(value), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (bytesToBase64(bytes) !== value) throw new Error('save.corrupt');
  return bytes;
}
function snapshotEnvironment() {
  const fs = engine.FS, entries = [];
  let bytes = 0;
  function visit(path) {
    if (path === '/data/save/browser') return;
    const stat = fs.lstat(path), directory = fs.isDir(stat.mode);
    if (!directory && !fs.isFile(stat.mode)) throw new Error('save.environment_unsupported');
    const entry = {path,kind:directory ? 'directory' : 'file',mode:stat.mode & 0o7777,
      atime:Math.trunc(Number(stat.atime)),mtime:Math.trunc(Number(stat.mtime))};
    if (!directory) {
      const data = fs.readFile(path,{encoding:'binary'});
      bytes += data.length;
      if (bytes > protocol.MAX_ENVIRONMENT_BYTES) throw new Error('save.environment_too_large');
      entry.data = bytesToBase64(data);
    }
    entries.push(entry);
    if (entries.length > 16384) throw new Error('save.environment_too_large');
    if (directory) for (const name of fs.readdir(path)) if (name !== '.' && name !== '..') visit(path + '/' + name);
  }
  for (const root of protocol.MUTABLE_ROOTS) if (fs.analyzePath(root).exists) visit(root);
  return protocol.encodeEnvironment({schema_version:1,roots:protocol.MUTABLE_ROOTS,entries});
}
function installEnvironment(bytes) {
  // Validate all paths, entries and owned bytes before changing isolated MEMFS.
  const value = protocol.decodeEnvironment(bytes);
  const owned = value.entries.map(entry => entry.kind === 'file' ? {...entry,bytes:base64ToBytes(entry.data)} : {...entry});
  const fs = engine.FS;
  function remove(path) {
    const stat = fs.lstat(path);
    if (fs.isDir(stat.mode)) {
      for (const name of fs.readdir(path)) if (name !== '.' && name !== '..') remove(path + '/' + name);
      fs.rmdir(path);
    } else fs.unlink(path);
  }
  for (const root of protocol.MUTABLE_ROOTS) if (fs.analyzePath(root).exists) remove(root);
  for (const entry of owned) {
    if (entry.kind === 'directory') fs.mkdirTree(entry.path); else fs.writeFile(entry.path,entry.bytes);
    fs.chmod(entry.path,entry.mode);
  }
  // Child creation changes directory timestamps; restore parents last.
  for (let i = owned.length - 1; i >= 0; i--) fs.utime(owned[i].path,owned[i].atime,owned[i].mtime);
}
function syncPending() {
  try {
    if (pendingEvents.length > protocol.MAX_PENDING || pendingEvents.some(v => !protocol.validPacket(v))) throw new Error('input.rejected');
    const words = new Uint32Array(pendingEvents.length * protocol.EVENT_WORDS);
    pendingEvents.forEach((packet,i) => words.set(packet,i * protocol.EVENT_WORDS));
    const context = protocol.encodeContext(nextGroup,draft);
    return withBytes(new Uint8Array(words.buffer),queuePointer => withBytes(context,contextPointer =>
      call('ab_rs_replay_pending_set',[queuePointer,pendingEvents.length,contextPointer,context.length])));
  } catch (error) {
    // A failed snapshot is explicit, never replaced with an assumed empty queue.
    // Poison Rust recording even if JS validation/allocation failed before FFI.
    try { call('ab_rs_replay_pending_set',[0,protocol.MAX_PENDING + 1,0,0]); } catch {}
    if (!catchingUp) emit('save-error','save.replay_unavailable');
    return 45;
  }
}
function ready() { acceptingInput = true; emit('ready',null); }
function reachedTarget() {
  if (!catchingUp) throw new Error('Unexpected replay target');
  const count = call('ab_rs_replay_target_pending_count') >>> 0;
  const pointer = call('ab_rs_replay_target_pending_data') >>> 0, length = count * protocol.EVENT_WORDS * 4;
  if (count > protocol.MAX_PENDING || (count && (!pointer || pointer % 4)) || pointer > engine.HEAPU8.length - length) throw new Error('save.corrupt');
  const words = new Uint32Array(count * protocol.EVENT_WORDS);
  const view = new DataView(engine.HEAPU8.buffer,pointer,length);
  for(let i=0;i<words.length;i++)words[i]=view.getUint32(i*4,true);
  const context = protocol.decodeContext(getterBytes('ab_rs_replay_target_context',protocol.MAX_CONTEXT_BYTES));
  const queue = [];
  for (let i = 0; i < count; i++) {
    const packet = words.slice(i * protocol.EVENT_WORDS,(i + 1) * protocol.EVENT_WORDS);
    if (!protocol.validPacket(packet) || (packet[8] >= 2 &&
        (BigInt(packet[9]) | BigInt(packet[10]) << 32n) >= context.nextGroup)) throw new Error('save.corrupt');
    queue.push(packet);
  }
  pendingEvents.splice(0,pendingEvents.length,...queue);
  nextGroup = context.nextGroup; draft = context.draft; catchingUp = false;
  // Pure Rust snapshot: no native redraw, simulation or RNG draw.
  const framePointer = call('ab_rs_frame');
  if (framePointer) lastFrame = JSON.parse(engine.UTF8ToString(framePointer,8 * 1024 * 1024 + 1));
  ready();
  if (lastFrame) emit('frame',lastFrame);
  if (lastState) emit('state',lastState);
  if (lastPresentation) emit('presentation',lastPresentation);
  emit('draft',{...draft});
}
async function run(payload) {
  if (started) return;
  started = true;
  requestedLocale = payload?.locale === 'en' ? 'en' : 'ja';
  try {
    protocol = await import('./protocol.js');
    const {collectCharacterExport}=await import('./character-export.js');
    if (!payload || !Number.isInteger(payload.seed) || payload.seed < 0 || payload.seed > 0xffffffff) throw new Error('save.invalid');
    const response = await fetch(new URL('../build/manifest.json',self.location.href),{cache:'no-store'});
    if (!response.ok) throw new Error('save.identity_missing');
    const identity = protocol.replayIdentity(await response.json());
    const envelope = payload.resume ? new Uint8Array(payload.save) : null;
    const version = envelope ? protocol.envelopeVersion(envelope) : 0;
    catchingUp = version === 3;
    importScripts('../build/game.js');
    const options = {
      noInitialRun:true,noExitRuntime:true,
      locateFile:path => new URL('../build/' + path,self.location.href).href,
      print:text => { if (!catchingUp) emit('output',String(text)); },
      printErr:text => { if (!catchingUp) emit('output',String(text)); },
      abEvent:() => pendingEvents.shift() || null,
      abFlush:() => { pendingEvents.length = 0; },
      abSyncPending:syncPending,abReplayTarget:reachedTarget,
      abFrame:frame => { lastFrame = jsonValue(frame); if (!catchingUp) emit('frame',lastFrame); },
      abState:state => {
        lastState = jsonValue(state);
        capturedPresentation('ab_rs_present_state',JSON.stringify(lastState));
        if (!catchingUp) emit('state',lastState);
      },
      abMessage:message => {
        try { capturedPresentation('ab_rs_present_message',typeof message === 'string' ? message : message.id); }
        catch (error) { if (!catchingUp) emit('semantic-error',String(error?.message || error)); }
      },
      abSemanticEvent:json => {
        try {
          const event=JSON.parse(json);
          const exporting=event.channel==='ui' && event.context==='character-export';
          if(exporting && event.widget==='__begin_replace') characterExportRejected=false;
          const accepted=capturedPresentation('ab_rs_present_event',json);
          if(exporting && !accepted) characterExportRejected=true;
          if(accepted && !catchingUp && exporting && event.widget==='__export_ready') {
            if(characterExportRejected) throw new Error('export.capture_rejected');
            emit('character-export',collectCharacterExport(JSON.parse(lastPresentation)));
          }
        }
        catch (error) { if (!catchingUp) emit('semantic-error',String(error?.message || error)); }
      },
      abSaveError:id => { if (!catchingUp) emit('save-error',String(id)); },
      abSave:value => {
        if (catchingUp) throw new Error('Replay attempted external persistence');
        const bytes = new Uint8Array(value);
        self.postMessage({type:'save',payload:bytes.buffer},[bytes.buffer]);
      }
    };
    engine = await createAngbandModule(options);
    for (const key of ['abEvent','abFlush','abSyncPending','abReplayTarget','abFrame','abState','abMessage','abSemanticEvent','abSaveError','abSave']) engine[key] = options[key];
    for (const name of ['event','message','boundary','state','locale','reset','status']) {
      if (typeof engine['_ab_rs_present_' + name] !== 'function') throw new Error('Rust presentation export unavailable: ' + name);
    }
    presentation('ab_rs_present_reset');
    call('ab_rs_set_locale',[requestedLocale === 'en' ? 0 : 1]);
    presentation('ab_rs_present_locale',[requestedLocale === 'en' ? 0 : 1]);
    let seed = payload.seed >>> 0, resume = Boolean(payload.resume);
    let nativeBytes = new Uint8Array(), rngBytes = new Uint8Array(), nativeLoadMode = 0;
    if (version === 3) {
      const status = withBytes(envelope,input => withBytes(identity,identityPointer =>
        call('ab_rs_replay_unwrap',[input,envelope.length,identityPointer,identity.length])));
      if (status) throw new Error('save.replay_invalid:' + status);
      const kind = call('ab_rs_replay_bootstrap_kind');
      if (kind !== 0 && kind !== 1) throw new Error('save.corrupt');
      resume = kind === 1; seed = call('ab_rs_replay_bootstrap_seed') >>> 0;
      nativeLoadMode = call('ab_rs_replay_bootstrap_native_load_mode');
      if (nativeLoadMode !== 0 && nativeLoadMode !== 1) throw new Error('save.corrupt');
      nativeBytes = getterBytes('ab_rs_replay_bootstrap_native',16 * 1024 * 1024);
      installEnvironment(getterBytes('ab_rs_replay_bootstrap_environment',protocol.MAX_ENVIRONMENT_BYTES));
    } else {
      if (resume) {
        nativeBytes = withBytes(envelope,input => {
          const pointer = call('ab_rs_save_unwrap',[input,envelope.length]), length = call('ab_rs_save_len');
          if (!pointer || !length || call('ab_rs_save_status') || pointer > engine.HEAPU8.length - length) throw new Error('save.corrupt');
          return engine.HEAPU8.slice(pointer,pointer + length);
        });
        // Copy the validated optional legacy RNG; prepare reinstalls it exactly.
        withBytes(new Uint8Array(38 * 4),pointer => {
          const status = call('ab_rs_take_restored_rng',[pointer,38]);
          if (!status) { nativeLoadMode = 1; rngBytes = engine.HEAPU8.slice(pointer,pointer + 38 * 4); }
          else if (status !== 1) throw new Error('save.corrupt');
        });
      }
      const environment = snapshotEnvironment();
      if (nativeBytes.length <= 16 * 1024 * 1024) {
        const status = withBytes(identity,identityPointer => withBytes(nativeBytes,nativePointer =>
          withBytes(rngBytes,rngPointer => withBytes(environment,environmentPointer =>
            call('ab_rs_replay_prepare',[identityPointer,identity.length,resume ? 1 : 0,seed,nativeLoadMode,
              nativePointer,nativeBytes.length,rngPointer,rngBytes.length ? 38 : 0,environmentPointer,environment.length])))));
        if (status) throw new Error('save.replay_unavailable:' + status);
      } else {
        // Original-cap legacy payload remains directly readable, without v3.
        withBytes(envelope,input => call('ab_rs_save_unwrap',[input,envelope.length]));
      }
    }
    if (resume) {
      if (!nativeBytes.length) throw new Error('save.corrupt');
      engine.FS.mkdirTree('/data/save'); engine.FS.writeFile('/data/save/browser',nativeBytes);
    } else if (nativeBytes.length) throw new Error('save.corrupt');
    if (!catchingUp) ready();
    const result = await engine.ccall('ab_run','number',['number','number'],[seed,resume ? 1 : 0],{async:true});
    if (catchingUp) throw new Error('Replay ended before saved continuation');
    acceptingInput = false; emit('ended',result);
  } catch (error) {
    acceptingInput = false;
    if (!catchingUp && (error?.name === 'ExitStatus' || error?.message === 'unwind')) emit('ended',error.status || 0);
    else emit('error',error?.message || String(error));
  }
}
self.onmessage = event => {
  const {type,payload,origin} = event.data || {};
  if (type === 'start') { void run(payload); return; }
  if (type === 'diagnostics' && engine && !catchingUp) {
    emit('source-diagnostics',{history:call('ab_game_history_status'),chests:call('ab_chest_message_status')});
    emit('diagnostics',{domain:call('ab_domain_status'),objects:call('ab_object_message_status'),
      stats:call('ab_stat_message_status'),replay:call('ab_rs_replay_status')});
    return;
  }
  if (['key','event','text','draft'].includes(type)) {
    try {
      if (!acceptingInput || catchingUp || !protocol) throw new Error('input.rejected');
      if (type === 'draft') { draft = protocol.validateDraft(payload); return; }
      if (type === 'text') {
        if (!payload || Object.keys(payload).length !== 2 || !Object.hasOwn(payload,'text') || !Object.hasOwn(payload,'origin') ||
            nextGroup === 0xffffffffffffffffn) throw new Error('input.rejected');
        const packets = protocol.textPackets(payload.text,payload.origin,nextGroup,protocol.MAX_PENDING - pendingEvents.length);
        pendingEvents.push(...packets); nextGroup++; emit('text-accepted',null);
      } else {
        if (pendingEvents.length >= protocol.MAX_PENDING) throw new Error('input.rejected');
        pendingEvents.push(type === 'key' ? protocol.keyPacket(payload,origin === 'touch') : protocol.nativePacket(payload));
      }
    } catch (error) { emit('input-error',error?.message || 'input.rejected'); }
    return;
  }
  if (type === 'save' && engine) {
    if (!acceptingInput || catchingUp) { emit('save-error','save.not_ready'); return; }
    try { call('ab_request_save'); } catch (error) { emit('error',error?.message || String(error)); }
  }
  if (type === 'locale') {
    requestedLocale = payload === 'en' ? 'en' : 'ja';
    if (engine) {
      call('ab_rs_set_locale',[requestedLocale === 'en' ? 0 : 1]);
      // Cached Rust facts only: no C redraw, event, or RNG draw.
      presentation('ab_rs_present_locale',[requestedLocale === 'en' ? 0 : 1]);
    }
  }
};
