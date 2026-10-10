/* Original DRL browser shell. Gameplay remains in the Pascal/Lua module.
 * Rust owns text layout, physical input normalization and the virtual files.
 * This module transports DOM events and draws Rust-projected primitives. */
import {createCoreHost, createCoreStorage, rustPlatform} from "./core-host.mjs";

export const SOURCE_COMMIT = "a6f965072b3a25b768c91dbced00367f1b57d865";
export const ENGINE_COMMIT = "f89735a741a968997656c2d48a003ec569db7f22";
const encoder = new TextEncoder(), decoder = new TextDecoder("utf-8", {fatal:true});
const MAX_ASSET = 196608, MAX_TOTAL = 64 * 1024 * 1024;
const MAX_EVENTS = 2048, MAX_COMMANDS = 1024, MAX_TEXT = 65536;
const shaPattern = /^[0-9a-f]{64}$/;
const portablePath = /^(?:[a-zA-Z0-9_\-]+\/)*[a-zA-Z0-9_.\-]+$/;

function artifact(message) { throw new Error(`game.artifact_error: ${message}`); }
function relativePath(value) {
  return typeof value === "string" && portablePath.test(value)
    && value.split("/").every(part => part !== "." && part !== "..");
}
function fileDescriptor(value, expectedFile, maxSize = MAX_TOTAL) {
  if (!value || value.file !== expectedFile || !Number.isSafeInteger(value.size)
      || value.size < 8 || value.size > maxSize || !shaPattern.test(value.sha256)) {
    artifact(`invalid descriptor: ${expectedFile}`);
  }
  return {file:value.file, size:value.size, sha256:value.sha256};
}
export function validateBuild(value) {
  if (!value || value.schema_version !== 1) artifact("build version");
  const identity = value.identity;
  if (!identity || identity.format !== "drl-original-core"
      || identity.source_commit !== SOURCE_COMMIT || identity.engine_commit !== ENGINE_COMMIT
      || identity.engine_save !== "0.10.11" || identity.module !== "drl"
      || identity.module_save !== "0.10.11" || identity.platform_abi !== 1) artifact("build identity");
  // Reconstruct a stable key order rather than hashing arbitrary JSON input order.
  return {
    core:fileDescriptor(value.core, "drl-core.wasm"),
    adapter:fileDescriptor(value.adapter, "drl_web_port.wasm"),
    identity:{format:identity.format, source_commit:identity.source_commit,
      engine_commit:identity.engine_commit, engine_save:identity.engine_save,
      module:identity.module, module_save:identity.module_save, platform_abi:identity.platform_abi},
  };
}
export function validateManifest(value) {
  if (!value || value.schema !== 1 || value.source_commit !== SOURCE_COMMIT
      || value.engine_commit !== ENGINE_COMMIT || !Array.isArray(value.files)
      || value.files.length < 1 || value.files.length > 4096) artifact("asset manifest");
  let total = 0;
  const paths = new Set();
  for (const file of value.files) {
    if (!file || !relativePath(file.path) || !file.path.startsWith("data/")
        || file.url !== `assets/${file.path}` || !/\.(lua|hlp|asc)$/.test(file.path)
        || !["GPL-2.0", "CC-BY-SA-4.0"].includes(file.license)
        || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_ASSET
        || !shaPattern.test(file.sha256) || paths.has(file.path)) artifact("asset descriptor");
    paths.add(file.path);
    total += file.size;
    if (total > MAX_TOTAL) artifact("aggregate asset quota");
  }
  if (!paths.has("data/config-browser.lua") || !paths.has("data/config.lua")) artifact("configuration assets");
  return value;
}
export async function sha256(data, crypto = globalThis.crypto) {
  if (!crypto?.subtle?.digest) artifact("SHA-256 unavailable");
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
    byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function fetchVerified(descriptor, {fetch:fetcher = globalThis.fetch, crypto = globalThis.crypto} = {}) {
  const url = descriptor.url ?? descriptor.file;
  if (!relativePath(url) || !Number.isSafeInteger(descriptor.size) || descriptor.size < 0
      || descriptor.size > MAX_TOTAL || !shaPattern.test(descriptor.sha256)) artifact("download descriptor");
  const response = await fetcher(url, {cache:"no-store", credentials:"same-origin"});
  if (!response.ok) artifact(`HTTP ${response.status}: ${url}`);
  const data = new Uint8Array(descriptor.size);
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    let offset = 0;
    try {
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array) || value.length > data.length - offset) artifact(`download exceeds declared size: ${url}`);
        data.set(value, offset); offset += value.length;
      }
      if (offset !== data.length) artifact(`download size mismatch: ${url}`);
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
  } else {
    const value = new Uint8Array(await response.arrayBuffer());
    if (value.length !== data.length) artifact(`download size mismatch: ${url}`);
    data.set(value);
  }
  if (await sha256(data, crypto) !== descriptor.sha256) artifact(`SHA-256 mismatch: ${url}`);
  return data;
}
async function fetchJson(url, maxBytes = 1048576) {
  const response = await fetch(url, {cache:"no-store", credentials:"same-origin"});
  if (!response.ok) artifact(`HTTP ${response.status}: ${url}`);
  let data;
  if (response.body?.getReader) {
    const reader = response.body.getReader(), chunks = [];
    let total = 0;
    try {
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maxBytes) artifact(`JSON quota: ${url}`);
        chunks.push(value);
      }
      data = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
  } else {
    data = new Uint8Array(await response.arrayBuffer());
    if (data.length > maxBytes) artifact(`JSON quota: ${url}`);
  }
  return JSON.parse(decoder.decode(data));
}
export function createEventQueue(maximum = MAX_EVENTS) {
  const packets = [];
  let lastEnqueuedReceipt = 0, consumedReceipt = 0, consumedPacketCount = 0;
  let textReceipt = null;
  function copyPackets(packet) {
    if (!(packet instanceof Uint8Array) && !Array.isArray(packet)) throw new Error("game.input_error: packet type");
    if (packet.length !== 128 || Array.from(packet).some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error("game.input_error: packet bytes");
    const bytes = Uint8Array.from(packet), header = new DataView(bytes.buffer);
    if (header.getUint32(0, true) !== 1) throw new Error("game.input_error: packet version");
    if (header.getUint32(4, true) !== 10) return [bytes];
    const length = header.getUint32(60, true);
    if (length < 1 || length > 63) throw new Error("game.input_error: text packet length");
    const value = decoder.decode(bytes.subarray(64, 64 + length)), chunks = [];
    let chunk = "";
    function appendChunk() {
      const data = encoder.encode(chunk), result = new Uint8Array(128);
      result.set(bytes.subarray(0,64)); new DataView(result.buffer).setUint32(60,data.length,true);
      result.set(data,64); chunks.push(result); chunk = "";
    }
    // VIO_MAXINPUT=16 reserves one WChar terminator. JS string length counts
    // the same UTF-16 units; iteration keeps surrogate pairs/codepoints whole.
    for (const codepoint of value) {
      if (chunk.length + codepoint.length > 15) appendChunk();
      chunk += codepoint;
    }
    if (chunk) appendChunk();
    return chunks;
  }
  return {
    append(values) {
      if (!Array.isArray(values) || packets.length + values.length > maximum) throw new Error("game.input_error: event quota");
      // Validate and expand the complete accepted Rust request before mutating
      // receipts or the queue. Oversized pastes cannot leave a queued prefix.
      const copied = values.flatMap(copyPackets);
      if (packets.length + copied.length > maximum) throw new Error("game.input_error: event quota");
      for (const bytes of copied) packets.push({bytes, receipt:++lastEnqueuedReceipt});
      return copied.length ? lastEnqueuedReceipt : null;
    },
    poll(peek) {
      if (!packets.length || textReceipt !== null) return null;
      if (peek) return packets[0].bytes.slice();
      const packet = packets.shift();
      consumedReceipt = packet.receipt; consumedPacketCount++;
      if (new DataView(packet.bytes.buffer).getUint32(4, true) === 10) textReceipt = packet.receipt;
      return packet.bytes;
    },
    presented(receipt) {
      if (!Number.isSafeInteger(receipt) || receipt < 0 || receipt > consumedReceipt) throw new Error("game.input_error: text presentation receipt");
      if (textReceipt !== null && textReceipt <= receipt) textReceipt = null;
    },
    clear() { packets.length = 0; lastEnqueuedReceipt = 0; consumedReceipt = 0; consumedPacketCount = 0; textReceipt = null; },
    get pending() { return packets.length > 0 && textReceipt === null; },
    get length() { return packets.length; },
    get textDeliveryPending() { return textReceipt !== null || packets.some(packet => new DataView(packet.bytes.buffer).getUint32(4,true) === 10); },
    get lastEnqueuedReceipt() { return lastEnqueuedReceipt; },
    get consumedReceipt() { return consumedReceipt; },
    get consumedPacketCount() { return consumedPacketCount; },
  };
}
// Native modal loops render before draining input. A down/up pair in one drain
// erases VTIG's held state before its next Update. Virtual releases therefore
// follow a real presentation that acknowledges the down, never a timer/replay.
export function createKeyPressQueue(dispatch, maximum = MAX_EVENTS) {
  const jobs = [];
  let nextToken = 0, presentedReceipt = 0;
  function send(job, phase) {
    const response = dispatch(phase, job.event);
    if (!response?.captured) return false;
    if (!Number.isSafeInteger(response.receipt) || response.receipt <= 0) throw new Error("game.input_error: key receipt");
    job.stage = phase; job.receipt = response.receipt;
    return true;
  }
  function pump() {
    const firstTap = jobs.find(job => job.tap);
    for (const job of [...jobs]) {
      if (job.stage !== "pending") continue;
      // Touch holds on different keys can coexist; synthetic taps keep order.
      if (job.tap && job !== firstTap) continue;
      if (jobs.some(other => other !== job && other.event.code === job.event.code
          && (other.stage !== "pending" || other.token < job.token))) continue;
      if (!send(job, "down")) jobs.splice(jobs.indexOf(job), 1);
    }
  }
  function release(job) {
    job.released = true;
    if (job.stage === "down" && job.acknowledged) {
      if (!send(job, "up")) throw new Error("game.input_error: key release rejected");
    }
  }
  return {
    begin(event, tap = false) {
      if (jobs.length >= maximum) throw new Error("game.input_error: virtual key quota");
      const job = {token:++nextToken, event:Object.freeze({...event}), tap,
        released:tap, acknowledged:false, stage:"pending", receipt:null};
      jobs.push(job); pump();
      return jobs.includes(job) ? job.token : null;
    },
    release(token) { const job = jobs.find(job => job.token === token); if (job) release(job); },
    releaseHeld() { for (const job of jobs) if (!job.tap) release(job); },
    presented(receipt) {
      if (!Number.isSafeInteger(receipt) || receipt < presentedReceipt) throw new Error("game.input_error: presentation receipt");
      presentedReceipt = receipt;
      for (const job of [...jobs]) {
        if (job.stage === "pending" || job.receipt > receipt) continue;
        if (job.stage === "up") jobs.splice(jobs.indexOf(job), 1);
        else {
          job.acknowledged = true;
          if (job.released) release(job);
        }
      }
      pump();
    },
    reset() { jobs.length = 0; nextToken = 0; presentedReceipt = 0; },
    get pending() { return jobs.length; },
  };
}
export function createFrameTransport(project, present) {
  let commands = [], textBytes = 0, latest = null, failed = null;
  return {
    draw(header, text) {
      if (commands.length >= MAX_COMMANDS || textBytes + text.length > MAX_TEXT) throw new Error("game.runtime_error: drawing quota");
      commands.push({header:Array.from(header), text:Array.from(text)}); textBytes += text.length;
    },
    frame(bytes) {
      // The original renderer emits its commands, then exactly one DRLF.
      const batch = commands; commands = []; textBytes = 0;
      const request = {kind:"frame", bytes:Array.from(bytes), commands:batch};
      const value = project(request).presentation;
      if (!value) { failed = request; throw new Error("game.runtime_error: invalid Rust presentation"); }
      latest = value;
      present(value);
    },
    replay() { if (latest) present(latest); },
    get projection() { return latest; },
    get failedPresentation() { return failed; },
  };
}
export function projectUILocales(platform, bootstrap) {
  const projected = {en:{},ja:{}};
  for (const language of ["en","ja"]) {
    for (const id of Object.keys(bootstrap[language])) {
      const response = platform({kind:"native_text",id,parameters:{},english:language === "en"});
      const text = response?.semantic?.text;
      if (typeof text !== "string" || text !== bootstrap[language][id]) artifact(`UI catalog mismatch: ${id}`);
      projected[language][id] = text;
    }
  }
  return projected;
}
export function keyboardDTO(event, editableTarget = false) {
  return {
    key:event.key ?? "", code:event.code ?? "", location:event.location ?? 0,
    shiftKey:Boolean(event.shiftKey), ctrlKey:Boolean(event.ctrlKey), altKey:Boolean(event.altKey),
    metaKey:Boolean(event.metaKey), isComposing:Boolean(event.isComposing), repeat:Boolean(event.repeat),
    editableTarget, keyCode:event.keyCode ?? 0,
  };
}
/** Composition commits and ordinary text use one lossless delivery path. */
export function createTextCommitter(deliver, clear) {
  let composing = false, committedComposition = null;
  return {
    start() { composing = true; committedComposition = null; },
    end(text) {
      composing = false;
      if (text) deliver(text);
      committedComposition = text; clear();
    },
    input({data, inputType, isComposing}, value) {
      if (composing || isComposing) return;
      if ((inputType === "insertFromComposition" || inputType === "insertCompositionText")
          && data === committedComposition) { committedComposition = null; clear(); return; }
      committedComposition = null;
      if (inputType?.startsWith("insert")) {
        const text = data ?? value;
        if (text) deliver(text);
        clear();
      }
    },
    get composing() { return composing; },
  };
}
export function pointerCell(event, bounds) {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
  const x = Math.floor((event.clientX - bounds.left) * 80 / bounds.width);
  const y = Math.floor((event.clientY - bounds.top) * 25 / bounds.height);
  return x >= 0 && x < 80 && y >= 0 && y < 25 ? {x, y} : null;
}
export function drawProjection(context, projection, {fontSize = 18, pixelRatio = 1} = {}) {
  const cellWidth = Math.ceil(fontSize * .6), cellHeight = Math.ceil(fontSize * 1.34);
  const width = projection.width * cellWidth, height = projection.height * cellHeight;
  context.canvas.width = Math.ceil(width * pixelRatio);
  context.canvas.height = Math.ceil(height * pixelRatio);
  if (context.canvas.style) { context.canvas.style.width = `${width}px`; context.canvas.style.height = `${height}px`; }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.fillStyle = "#000000"; context.fillRect(0, 0, width, height);
  context.font = `${fontSize}px "Noto Sans Mono CJK JP", "MS Gothic", "Yu Gothic", monospace`;
  context.textBaseline = "middle";
  const rows = Array.from({length:projection.height}, () => Array(projection.width).fill(" "));
  function glyph(value) {
    const x = value.x * cellWidth, y = value.y * cellHeight, columns = value.columns;
    context.fillStyle = value.background; context.fillRect(x, y, columns * cellWidth, cellHeight);
    context.fillStyle = value.foreground;
    context.fillText(value.text, x, y + cellHeight / 2, columns * cellWidth);
    rows[value.y][value.x] = value.text;
    for (let column = 1; column < columns; column++) rows[value.y][value.x + column] = "";
  }
  for (const value of projection.glyphs) glyph(value);
  for (const command of projection.commands) {
    if (command.kind === "glyph") glyph(command);
    else if (command.kind === "clear") {
      context.fillStyle = command.background;
      context.fillRect(command.x * cellWidth, command.y * cellHeight, command.width * cellWidth, command.height * cellHeight);
      for (let y = command.y; y < command.y + command.height; y++) for (let x = command.x; x < command.x + command.width; x++) rows[y][x] = " ";
    } else throw new Error("game.runtime_error: unknown projected primitive");
  }
  if (projection.cursor) {
    context.strokeStyle = "#e3e6df"; context.lineWidth = 1;
    context.strokeRect(projection.cursor[0] * cellWidth + .5, projection.cursor[1] * cellHeight + .5, cellWidth - 1, cellHeight - 1);
  }
  return {width, height, text:rows.map(row => row.join("")).join("\n")};
}
export function captureProbe(api) {
  if (typeof api?.drl_probe_capture !== "function" || typeof api.drl_probe_buffer !== "function"
      || typeof api.drl_probe_capacity !== "function" || !(api.memory instanceof WebAssembly.Memory)) return null;
  const length = api.drl_probe_capture(), pointer = api.drl_probe_buffer(), capacity = api.drl_probe_capacity();
  if (length === -1) return null;
  if (!Number.isInteger(length) || length < 128 || length > capacity || capacity > 8192
      || !Number.isInteger(pointer) || pointer < 0 || pointer + length > api.memory.buffer.byteLength) throw new Error("game.runtime_error: probe bounds");
  const bytes = new Uint8Array(api.memory.buffer, pointer, length).slice(), view = new DataView(bytes.buffer);
  if (view.getUint32(0,true) !== 0x504c5244 || view.getUint32(4,true) !== 1
      || view.getUint32(8,true) !== 128 || view.getUint32(12,true) !== length - 128) throw new Error("game.runtime_error: probe header");
  let configuration;
  if(typeof api.drl_probe_run_delay === "function" && typeof api.drl_probe_multimove_active === "function"){
    const runDelayMs=api.drl_probe_run_delay(), active=api.drl_probe_multimove_active();
    if(!Number.isInteger(runDelayMs)||runDelayMs<0||runDelayMs>255||![-1,0,1].includes(active))
      throw new Error("game.runtime_error: native configuration probe");
    configuration={runDelayMs,multiMoveActive:active===-1?null:active===1};
  }
  return {...(configuration===undefined?{}:{configuration}),bytes:Array.from(bytes), state:view.getUint32(16,true), seed:view.getUint32(20,true),
    playerPresent:view.getUint32(32,true) === 1, x:view.getInt32(36,true), y:view.getInt32(40,true),
    hp:view.getInt32(44,true), level:view.getInt32(64,true), rng:Array.from(bytes.subarray(128))};
}

async function boot(document) {
  let language = "ja", locales, runtimeLabels = null, build, manifest, storage, cachedAssets = null;
  let platform, coreInstance, host, transport, started = false, paused = false, coreEntered = false;
  let lastCell = null, lastSavedGeneration = 0, savedAvailable = false;
  let lastStoredFilesGeneration = 0;
  let textInputActive = false;
  let selectedPad = null, padState = null, padFrame = null, fileCaptureError = null;
  let lastAttemptGeneration = null, retryStorage = false;
  let statusId = "game.loading", statusError = false;
  let frameGeneration = 0, lastPresentedReceipt = 0;
  const heldKeys = new Map(), heldMouse = new Set();
  const heldPointers = new Map();
  const queue = createEventQueue();
  const virtualKeys = createKeyPressQueue((phase, event) => key(phase, event));
  const element = id => document.getElementById(id);
  const canvas = element("game-screen"), context = canvas.getContext("2d", {alpha:false});
  const input = element("native-text"), status = element("status");
  const t = id => { const value = (runtimeLabels ?? locales)?.[language]?.[id]; if (typeof value !== "string") throw new Error(`UI semantic ID missing: ${id}`); return value; };
  function report(id, error = false) { statusId = id; statusError = error; status.textContent = locales ? t(id) : id; status.dataset.error = String(error); }
  function uiLocale() {
    document.documentElement.lang = language; document.title = t("game.title");
    for (const item of document.querySelectorAll("[data-text]")) if (item !== status) item.textContent = t(item.dataset.text);
    for (const item of document.querySelectorAll("[data-aria]")) item.setAttribute("aria-label", t(item.dataset.aria));
  }
  function fail(error, id = "game.runtime_error") { console.error(error); report(id, true); }
  function present(value) {
    const result = drawProjection(context, value, {fontSize:Number(element("font-size").value), pixelRatio:Math.min(globalThis.devicePixelRatio || 1, 3)});
    element("screen-text").textContent = result.text;
  }
  function normalize(event) {
    if (!platform || !host?.running) return false;
    const response = platform({kind:"native_input", event}).input;
    if (!response || !Array.isArray(response.packets) || typeof response.captured !== "boolean") throw new Error("Invalid Rust input response");
    const receipt = queue.append(response.packets);
    return {...response, receipt};
  }
  function key(phase, event, editableTarget = false) {
    return normalize({kind:"keyboard", phase, event:keyboardDTO(event, editableTarget)});
  }
  function press(keyValue, code, modifiers = {}) {
    if (!host?.running) return false;
    const event = {key:keyValue, code, location:code.startsWith("Numpad") ? 3 : 0, ...modifiers};
    return virtualKeys.begin(event, true) !== null;
  }
  function nativeFrame(bytes) {
    transport.frame(bytes);
    frameGeneration++; lastPresentedReceipt = queue.consumedReceipt;
    queue.presented(lastPresentedReceipt);
    virtualKeys.presented(lastPresentedReceipt);
  }
  function text(value) { if (value) normalize({kind:"text", text:value}); }
  function committedText(value) { text(value); input.value = ""; }
  const textCommitter = createTextCommitter(text, () => { input.value = ""; });
  function focusGame() { (textInputActive ? input : canvas).focus({preventScroll:true}); }
  function textInput(enabled) {
    if (textInputActive === enabled) return;
    textInputActive = enabled;
    element("text-entry").hidden = !enabled;
    if (enabled) input.focus({preventScroll:true}); else if (document.activeElement === input) canvas.focus({preventScroll:true});
  }
  async function verifiedAssets() {
    if (!cachedAssets) {
      const result = [];
      // Bounded sequential acquisition avoids a large simultaneous download peak.
      for (const descriptor of manifest.files) result.push({path:descriptor.path, bytes:await fetchVerified(descriptor)});
      cachedAssets = result;
    }
    return cachedAssets;
  }
  async function mountAssets(target) {
    const directory = target({kind:"file_system",operation:{op:"mkdir",dir_fd:3,path:"user"}}).filesystem;
    if (directory?.errno !== 0) throw new Error("Cannot create writable native user directory");
    for (const asset of await verifiedAssets()) {
      const result = target({kind:"file_system",operation:{op:"mount_asset",path:asset.path,bytes:Array.from(asset.bytes)}}).filesystem;
      if (result?.errno !== 0) throw new Error("Cannot mount verified immutable asset");
    }
  }
  let adapterBytes;
  async function createPlatform() {
    if (!adapterBytes) adapterBytes = await fetchVerified(build.adapter);
    const {instance} = await WebAssembly.instantiate(adapterBytes, {});
    const callback = rustPlatform(instance);
    // A fresh candidate is not made current until restore and all mounts succeed.
    Object.defineProperty(callback, "rustInstance", {value:instance});
    return callback;
  }
  async function persistCompletedFiles(force = false) {
    const generation = coreInstance.exports.drl_save_generation() >>> 0;
    const filesGeneration = coreInstance.exports.drl_user_files_generation() >>> 0;
    if (!force && filesGeneration === lastStoredFilesGeneration) return;
    if (!force && filesGeneration === lastAttemptGeneration && !retryStorage) return;
    const wasRetry = Boolean(fileCaptureError);
    lastAttemptGeneration = filesGeneration; retryStorage = false; element("retry-storage").disabled = true;
    try {
      await storage.save(platform);
      const nativeSaveCompleted = generation !== lastSavedGeneration;
      lastSavedGeneration = generation; lastStoredFilesGeneration = filesGeneration;
      fileCaptureError = null; element("retry-storage").hidden = true;
      if (nativeSaveCompleted) report("game.saved"); else if (wasRetry) report("game.files_synced");
    } catch (error) { fileCaptureError = error; element("retry-storage").hidden = false; fail(error, "game.storage_error"); }
    finally { element("retry-storage").disabled = false; }
  }
  async function suspendedSleep(milliseconds) {
    paused = true;
    try {
      await persistCompletedFiles();
      await new Promise(resolve => setTimeout(resolve, milliseconds));
    } finally { paused = false; }
  }
  function rumble(low, high, duration) {
    const pad = selectedPad === null ? null : navigator.getGamepads?.()[selectedPad];
    if (!pad?.vibrationActuator?.playEffect) return false;
    pad.vibrationActuator.playEffect("dual-rumble", {duration, strongMagnitude:low / 65535, weakMagnitude:high / 65535}).catch(() => {});
    return true;
  }
  function modifiers(event) { return {shift:Boolean(event.shiftKey), control:Boolean(event.ctrlKey), alt:Boolean(event.altKey)}; }
  function resetPad() {
    if (selectedPad !== null && padState) {
      for (let index = 0; index < 4; index++) normalize({kind:"pad_axis",which:selectedPad,axis:index,value:0});
      for (let index = 0; index < 17; index++) if (index !== 6 && index !== 7 && padState.buttons[index]) normalize({kind:"pad_button",which:selectedPad,button:index,pressed:false});
      for (const index of [6,7]) normalize({kind:"pad_trigger",which:selectedPad,button:index,value:0,was_down:padState.triggers[index]});
      normalize({kind:"pad_device",which:selectedPad,event:"removed"});
    }
    selectedPad = null; padState = null;
  }
  function pollPad() {
    if (!host?.running) { resetPad(); return; }
    try {
      if (document.visibilityState === "hidden" || !document.hasFocus()) { resetPad(); padFrame = requestAnimationFrame(pollPad); return; }
      const pads = navigator.getGamepads?.() ?? [];
      const current = selectedPad === null ? null : pads[selectedPad];
      if (selectedPad !== null && (!current || !current.connected)) resetPad();
      if (selectedPad === null) {
        const next = Array.from(pads).find(pad => pad?.connected && pad.mapping === "standard");
        if (next) {
          selectedPad = next.index; padState = {axes:[0,0,0,0],buttons:Array(17).fill(false),triggers:{6:false,7:false},values:{6:0,7:0}};
          normalize({kind:"pad_device",which:selectedPad,event:"added"});
        }
      }
      const pad = selectedPad === null ? null : pads[selectedPad];
      if (pad) {
        for (let index = 0; index < 4; index++) {
          const value = pad.axes[index] ?? 0;
          if (value !== padState.axes[index]) { normalize({kind:"pad_axis",which:selectedPad,axis:index,value}); padState.axes[index] = value; }
        }
        for (let index = 0; index < 17; index++) {
          if (index === 6 || index === 7) {
            const value = pad.buttons[index]?.value ?? 0;
            if (value !== padState.values[index]) {
              const result = normalize({kind:"pad_trigger",which:selectedPad,button:index,value,was_down:padState.triggers[index]});
              if (typeof result?.trigger_down === "boolean") padState.triggers[index] = result.trigger_down;
              padState.values[index] = value;
            }
          } else {
            const pressed = Boolean(pad.buttons[index]?.pressed);
            if (pressed !== padState.buttons[index]) { normalize({kind:"pad_button",which:selectedPad,button:index,pressed}); padState.buttons[index] = pressed; }
          }
        }
      }
    } catch (error) { fail(error, "game.input_error"); }
    padFrame = requestAnimationFrame(pollPad);
  }
  async function launch(resume) {
    if (started) return;
    if (typeof WebAssembly.Suspending !== "function" || typeof WebAssembly.promising !== "function") { report("game.jspi_error", true); return; }
    started = true; element("start").disabled = true; element("resume").disabled = true; report("game.starting");
    try {
      const candidate = resume ? await storage.restore({createPlatform,mountAssets}) : await createPlatform();
      if (!resume) await mountAssets(candidate);
      const coreBytes = await fetchVerified(build.core);
      const candidateLabels = projectUILocales(candidate, locales);
      platform = candidate; runtimeLabels = candidateLabels; virtualKeys.reset(); heldPointers.clear();
      queue.clear(); frameGeneration = 0; lastPresentedReceipt = 0; uiLocale();
      transport = createFrameTransport(platform, present);
      const stdoutDecoder = new TextDecoder(), stderrDecoder = new TextDecoder();
      host = createCoreHost({platform, language, sleep:suspendedSleep,
        stdout:bytes => console.info(stdoutDecoder.decode(bytes,{stream:true})), stderr:bytes => console.error(stderrDecoder.decode(bytes,{stream:true})),
        bridge:{pollEvent:peek => queue.poll(peek),eventPending:() => queue.pending,
          frame:nativeFrame,drawCommand:(header,text) => transport.draw(header,text),
          textInput,title:bytes => { document.title = decoder.decode(bytes); },rumble}});
      coreInstance = await host.instantiate(coreBytes);
      if (typeof coreInstance.exports.drl_save_generation !== "function"
          || typeof coreInstance.exports.drl_user_files_generation !== "function") artifact("completed native file witness missing");
      element("focus").disabled = false; element("save").disabled = false;
      canvas.focus({preventScroll:true}); report("game.running");
      coreEntered = true;
      const completion = host.start();
      padFrame = requestAnimationFrame(pollPad);
      const code = await completion;
      const tail = stdoutDecoder.decode(); if (tail) console.info(tail);
      const errorTail = stderrDecoder.decode(); if (errorTail) console.error(errorTail);
      paused = true;
      if (code === 0) await persistCompletedFiles(true);
      else throw new Error(`Original core exited with code ${code}`);
      report(fileCaptureError ? "game.storage_error" : "game.exited", Boolean(fileCaptureError));
    } catch (error) {
      if (!host?.running) paused = false;
      const id = error.code === "no_save" ? "game.no_save" : error.message.includes("game.artifact_error") ? "game.artifact_error" : "game.runtime_error";
      fail(error, id);
    } finally {
      virtualKeys.reset(); heldPointers.clear();
      if (padFrame !== null) cancelAnimationFrame(padFrame);
      element("save").disabled = true; element("focus").disabled = true;
      if (!coreEntered) { started = false; element("start").disabled = false; element("resume").disabled = !savedAvailable; }
    }
  }
  function safe(callback) { return event => { try { const result = callback(event); result?.catch?.(error => fail(error)); } catch (error) { fail(error, "game.input_error"); } }; }
  element("start").onclick = () => launch(false);
  element("resume").onclick = () => launch(true);
  element("focus").onclick = focusGame;
  element("save").onclick = safe(() => { press("Escape", "Escape"); report("game.save_pending"); focusGame(); });
  element("retry-storage").onclick = safe(async () => {
    if (host?.running) retryStorage = true;
    else if (paused && platform) await persistCompletedFiles(true);
  });
  element("language").onchange = safe(event => { language = event.target.value; uiLocale(); host?.setLanguage(language); if (started) report("game.locale_pending"); else report(statusId,statusError); });
  element("font-size").oninput = () => { element("font-value").value = element("font-size").value; transport?.replay(); };
  element("fit").onchange = () => element("screen-viewport").classList.toggle("fit", element("fit").checked);
  canvas.addEventListener("keydown", safe(event => { const response = key("down", event); if (response?.captured) { heldKeys.set(event.code,keyboardDTO(event)); event.preventDefault(); } }));
  canvas.addEventListener("keyup", safe(event => { const response = key("up", event); heldKeys.delete(event.code); if (response?.captured) event.preventDefault(); }));
  canvas.addEventListener("mousedown", safe(event => { focusGame(); const point = pointerCell(event, canvas.getBoundingClientRect()); if (point && normalize({kind:"mouse_button",...point,button:event.button,pressed:true,modifiers:modifiers(event)})?.captured) { heldMouse.add(event.button); event.preventDefault(); } lastCell = point; }));
  globalThis.addEventListener("mouseup", safe(event => { if (!heldMouse.has(event.button)) return; const point = pointerCell(event, canvas.getBoundingClientRect()) ?? lastCell; if (point && normalize({kind:"mouse_button",...point,button:event.button,pressed:false,modifiers:modifiers(event)})?.captured) event.preventDefault(); heldMouse.delete(event.button); lastCell = point; }));
  canvas.addEventListener("mousemove", safe(event => { const point = pointerCell(event, canvas.getBoundingClientRect()); if (point) normalize({kind:"mouse_move",...point,relative_x:lastCell ? point.x-lastCell.x : 0,relative_y:lastCell ? point.y-lastCell.y : 0,buttons:event.buttons,modifiers:modifiers(event)}); lastCell = point; }));
  canvas.addEventListener("wheel", safe(event => { const point = pointerCell(event, canvas.getBoundingClientRect()); if (point && normalize({kind:"wheel",...point,delta_y:event.deltaY,modifiers:modifiers(event)})?.captured) event.preventDefault(); }), {passive:false});
  canvas.addEventListener("contextmenu", event => { if (host?.running) event.preventDefault(); });
  for (const button of document.querySelectorAll("[data-key]")) {
    button.disabled = true;
    button.style.touchAction = "none";
    const buttonKey = () => ({key:button.dataset.key, code:button.dataset.code,
      location:button.dataset.code.startsWith("Numpad") ? 3 : 0,
      shiftKey:element("touch-shift").checked, ctrlKey:element("touch-control").checked});
    button.addEventListener("pointerdown", safe(event => {
      if (event.button !== 0 || !host?.running || heldPointers.has(event.pointerId)) return;
      const token = virtualKeys.begin(buttonKey());
      if (token === null) return;
      heldPointers.set(event.pointerId, token);
      try { button.setPointerCapture(event.pointerId); }
      catch (error) { virtualKeys.release(token); heldPointers.delete(event.pointerId); throw error; }
      event.preventDefault();
    }));
    const releasePointer = safe(event => {
      const token = heldPointers.get(event.pointerId);
      if (token === undefined) return;
      virtualKeys.release(token); heldPointers.delete(event.pointerId); event.preventDefault();
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, releasePointer);
    button.onclick = safe(event => {
      // Pointer presses already have a lifecycle. Keyboard/assistive clicks tap.
      if (event.detail === 0) {
        const key = buttonKey(); press(key.key, key.code, key);
      }
    });
  }
  // Text has exactly one route: committed DOM text, never key.ASCII plus text.
  input.addEventListener("compositionstart", () => textCommitter.start());
  input.addEventListener("compositionend", safe(event => textCommitter.end(event.data)));
  input.addEventListener("input", safe(event => textCommitter.input(event,input.value)));
  const editingKeys = new Set(["Enter","Escape","Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","Tab"]);
  for (const phase of ["down","up"]) input.addEventListener(`key${phase}`, safe(event => {
    if (textCommitter.composing || event.isComposing || event.keyCode === 229 || !editingKeys.has(event.key)) return;
    const response = key(phase, event, false); if (response?.captured) event.preventDefault();
  }));
  element("text-done").onclick = safe(() => { if (!textCommitter.composing) { if (input.value) committedText(input.value); press("Enter", "Enter"); } });
  globalThis.addEventListener("blur", safe(() => {
    virtualKeys.releaseHeld(); heldPointers.clear();
    for (const event of heldKeys.values()) key("up",{...event,repeat:false}); heldKeys.clear();
    if (lastCell) for (const button of heldMouse) normalize({kind:"mouse_button",...lastCell,button,pressed:false});
    heldMouse.clear(); resetPad();
  }));
  canvas.addEventListener("blur", safe(() => { for (const event of heldKeys.values()) key("up",{...event,repeat:false}); heldKeys.clear(); }));
  globalThis.addEventListener("resize", () => transport?.replay());
  // Read-only hooks for the real-core browser suite. Probes are only callable at
  // a suspended seam; they serialize original RNG bytes without drawing samples.
  globalThis.drlGame = Object.freeze({
    get running() { return Boolean(host?.running); },get paused() { return paused; },
    get locale() { return language; },get saveGeneration() { return lastSavedGeneration; },
    get filesGeneration() { return lastStoredFilesGeneration; },
    get queueLength() { return queue.length; },get unsupportedImports() { return host?.unsupportedImports() ?? []; },
    get frameGeneration() { return frameGeneration; },get lastPresentedReceipt() { return lastPresentedReceipt; },
    get lastEnqueuedReceipt() { return queue.lastEnqueuedReceipt; },get consumedReceipt() { return queue.consumedReceipt; },
    get consumedPacketCount() { return queue.consumedPacketCount; },
    get textDeliveryPending() { return queue.textDeliveryPending; },
    probe() { if (!paused) throw new Error("Original core is not paused"); return captureProbe(coreInstance?.exports); },
    replay() { transport?.replay(); },
    input:event => normalize(event),
    get projection() { return transport?.projection ?? null; },
    get failedPresentation() { return transport?.failedPresentation ?? null; },
    storedFiles() { return storage?.readSnapshot() ?? Promise.resolve(null); },
  });
  try {
    const [en, ja] = await Promise.all([fetchJson("gameui-en.json", 65536), fetchJson("gameui-ja.json", 65536)]);
    if (JSON.stringify(Object.keys(en).sort()) !== JSON.stringify(Object.keys(ja).sort())
        || [...Object.values(en),...Object.values(ja)].some(value => typeof value !== "string")) artifact("UI language coverage");
    locales = {en,ja}; uiLocale(); report("game.loading");
    [build,manifest] = await Promise.all([fetchJson("build.json").then(validateBuild),fetchJson("core-assets.json").then(validateManifest)]);
    const identity = `drl-original-core:v1:${await sha256(encoder.encode(JSON.stringify(build.identity)))}`;
    storage = createCoreStorage({identity});
    let saved = null;
    try { saved = await storage.readSnapshot(); }
    catch (error) { fileCaptureError = error; fail(error,"game.storage_read_error"); }
    savedAvailable = Boolean(saved);
    element("build-identity").textContent = `${SOURCE_COMMIT.slice(0,12)} · ${ENGINE_COMMIT.slice(0,12)} · ABI 1`;
    element("start").disabled = false; element("resume").disabled = !saved;
    for (const button of document.querySelectorAll("[data-key]")) button.disabled = false;
    if (!fileCaptureError) report("game.ready");
  } catch (error) { fail(error, "game.artifact_error"); }
}

if (typeof document !== "undefined") boot(document).catch(error => console.error(error));
