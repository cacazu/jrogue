// Classic Worker host for the complete official C++ engine.
// C++/FS/suspension stay here; Rust validates locale/input/frame/portable packs.
'use strict';

let engine = null;
let runtime = 'asyncify';
let startupText = null;
let booting = false;
let started = false;
let failure = null;
let completedStatus = null;
let nextSequence = 0;
let activeOperation = null;
let flushing = false;
const mainInput = { kind: 'main', wake: null };
const inputScopes = [mainInput];
const keys = [];
const suspendedRequests = [];
const pendingRequests = new Map();

function respond(id, ok, value) {
  // Terminal callbacks and late Promise continuations may reach the same id.
  if (!pendingRequests.delete(id)) return;
  if (ok) self.postMessage({ type: 'response', id, ok, value });
  else {
    const response = { type: 'response', id, ok, error: value?.message ?? String(value) };
    if (value?.code) response.code = value.code;
    self.postMessage(response);
  }
}

function terminal() { return failure !== null || completedStatus !== null; }
function currentInput() { return inputScopes[inputScopes.length - 1]; }
function expectedCompletedExit(reason) {
  return completedStatus === 0 && reason?.name === 'ExitStatus' && reason?.status === 0;
}
function clearOperations() {
  for (const scope of inputScopes) scope.wake = null;
  inputScopes.length = 1;
  activeOperation = null;
  keys.length = 0;
  suspendedRequests.length = 0;
  self.postMessage({ type: 'waiting', value: false });
}

function complete(status) {
  if (status !== 0) { fail(new Error('engine exited with status ' + status)); return; }
  if (terminal()) return;
  completedStatus = status;
  clearOperations();
  for (const [id, request] of pendingRequests) {
    // Preserve the existing synchronous callMain + ExitStatus0 start handshake.
    if (request.op !== 'start') respond(id, false, 'engine session completed');
  }
  // Let a synchronous expected ExitStatus unwind; other exceptions remain fatal.
  queueMicrotask(() => { if (!failure) self.postMessage({ type: 'completed', status }); });
}

function fail(reason) {
  if (expectedCompletedExit(reason) || failure) return;
  failure = reason instanceof Error ? reason : new Error(String(reason));
  clearOperations();
  for (const id of pendingRequests.keys()) respond(id, false, failure);
  const event = { type: 'fatal', error: failure.message };
  if (failure.code) event.code = failure.code;
  self.postMessage(event);
}

function filesIn(directory, relative = '') {
  if (terminal()) throw failure ?? new Error('engine session completed');
  const files = [];
  for (const entry of engine.FS.readdir(directory).sort()) {
    if (entry === '.' || entry === '..') continue;
    const absolute = directory + '/' + entry;
    const filePath = relative + entry;
    if (engine.FS.isDir(engine.FS.stat(absolute).mode)) {
      // Exact pinned regenerable cache directories; preserve all other bytes.
      if (filePath === 'saves/db' || filePath === 'saves/des') continue;
      files.push(...filesIn(absolute, filePath + '/'));
    } else {
      files.push({ path: filePath, bytes: Array.from(engine.FS.readFile(absolute)) });
    }
  }
  return files;
}

function restoreFiles(files) {
  if (!Array.isArray(files)) throw new Error('validated native files must be an array');
  const paths = new Set();
  for (const file of files) {
    const filePath = file.path;
    if (typeof filePath !== 'string' || !filePath.length || /[\\:\0]/.test(filePath)
        || filePath.split('/').some(part => !part || part === '.' || part === '..')
        || paths.has(filePath)) throw new Error('unsafe or duplicate native file path');
    if (!Array.isArray(file.bytes) || file.bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
      throw new Error('invalid native file bytes');
    }
    paths.add(filePath);
  }
  // Rust checked source, ABI, checksum, size and paths before this host check.
  for (const file of files) {
    const absolute = '/persist/' + file.path;
    engine.FS.mkdirTree(absolute.slice(0, absolute.lastIndexOf('/')));
    engine.FS.writeFile(absolute, Uint8Array.from(file.bytes));
  }
}

function observeEngine(callback) {
  if (terminal()) throw failure ?? new Error('engine session completed');
  try { return callback(); }
  catch (error) { fail(error); throw error; }
}

function executeSuspended(request) {
  if (!mainInput.wake || !engine || terminal() || activeOperation) {
    throw new Error('engine is not safely suspended for main input');
  }
  switch (request.op) {
    case 'state':
      return observeEngine(() => JSON.parse(engine.UTF8ToString(engine._dcss_snapshot_json())));
    case 'repaint':
      observeEngine(() => engine._dcss_repaint());
      return true;
    case 'files':
      return filesIn('/persist');
    case 'save':
      if (observeEngine(() => engine._dcss_save()) !== 1) {
        throw new Error('native game has not started or cannot be saved here');
      }
      return filesIn('/persist');
    default:
      throw new Error('unsupported suspended engine request');
  }
}

async function executeJspiSave(request) {
  // mainInput.wake stays untouched on the bottom of this resolver stack.
  const operation = { request, input: { kind: 'save', wake: null } };
  activeOperation = operation;
  inputScopes.push(operation.input);
  self.postMessage({ type: 'waiting', value: false });
  try {
    let result;
    try {
      // JSPI_EXPORTS wraps this existing export with WebAssembly.promising.
      // It can suspend in Lua getch, mpr or delay; never call another export here.
      const pendingSave = engine._dcss_save();
      if (!pendingSave || typeof pendingSave.then !== 'function') {
        throw new Error('JSPI save export did not return a Promise');
      }
      result = await pendingSave;
    } catch (error) {
      fail(error);
      return;
    }
    if (terminal() || activeOperation !== operation) return;
    if (operation.input.wake) {
      fail(new Error('native save completed with unresolved helper input'));
      return;
    }
    if (result !== 1) {
      respond(request.id, false, 'native game has not started or cannot be saved here');
    } else {
      // Never capture partial bytes while the Promise is still suspended.
      respond(request.id, true, filesIn('/persist'));
    }
  } catch (error) {
    respond(request.id, false, error);
  } finally {
    if (!terminal() && activeOperation === operation) {
      inputScopes.pop();
      activeOperation = null;
      self.postMessage({ type: 'waiting', value: Boolean(mainInput.wake) });
      queueMicrotask(drain);
    }
  }
}

function flushSuspendedRequests() {
  if (flushing || activeOperation || terminal()) return;
  flushing = true;
  try {
    while (mainInput.wake && !terminal() && !activeOperation && suspendedRequests.length
        && (!keys.length || suspendedRequests[0].sequence < keys[0].sequence)) {
      const request = suspendedRequests.shift();
      if (runtime === 'jspi' && request.op === 'save') {
        // executeJspiSave owns/catches its whole asynchronous lifetime.
        void executeJspiSave(request);
        break;
      }
      try { respond(request.id, true, executeSuspended(request)); }
      catch (error) { respond(request.id, false, error); }
    }
  } finally { flushing = false; }
}

function deliverKey() {
  if (terminal() || flushing || !keys.length) return;
  if (!activeOperation) flushSuspendedRequests();
  if (terminal()) return;
  const scope = currentInput();
  if (!scope.wake) return;
  // An active save prompt owns input. Observations queued during that helper
  // cannot block a prompt's later key, or the helper would never complete.
  const callback = scope.wake;
  scope.wake = null;
  self.postMessage({ type: 'waiting', value: false });
  try { callback(keys.shift().key); }
  catch (error) { fail(error); }
}

function drain() {
  if (terminal()) return;
  flushSuspendedRequests();
  deliverKey();
}

async function boot(request) {
  if (booting || engine) throw new Error('engine worker is already booted');
  runtime = request.runtime === undefined ? 'asyncify' : request.runtime;
  if (runtime !== 'asyncify' && runtime !== 'jspi') throw new Error('unsupported engine runtime');
  if (runtime === 'jspi' && (typeof WebAssembly !== 'object'
      || typeof WebAssembly.Suspending !== 'function' || typeof WebAssembly.promising !== 'function')) {
    const error = new Error('This browser does not support the required WebAssembly JSPI runtime');
    error.code = 'jspi-unsupported';
    throw error;
  }
  booting = true;
  // This native widget locale is pinned for the session. Main-thread log/label
  // language changes do not relocalize already constructed C++ Text widgets.
  const { loadStartupTextBridge } = await import('/web/startup-text.mjs');
  if (terminal()) throw failure ?? new Error('engine session completed');
  startupText = await loadStartupTextBridge(request.language ?? 'ja');
  if (terminal()) throw failure ?? new Error('engine session completed');
  const build = runtime === 'jspi' ? '/engine/build-jspi/' : '/engine/build/';
  importScripts(build + 'dcss.js');
  if (typeof self.createDcssEngine !== 'function') throw new Error('official engine factory was not loaded');
  engine = await self.createDcssEngine({
    noInitialRun: true,
    locateFile: name => build + name,
    dcssFormatStartup(id, params) {
      if (terminal()) throw failure ?? new Error('engine session completed');
      return startupText.format(id, params);
    },
    dcssStartupTextError(reason) {
      // The native helper subsequently follows end(1); never inject a key or
      // reinterpret this as user cancellation. This is a separate diagnostic.
      self.postMessage({ type: 'startup-text-error', error: String(reason) });
    },
    dcssFrame(words, columns, rows, x, y, cursor, clusters = []) {
      if (terminal()) return;
      const buffer = Uint32Array.from(words).buffer;
      const textClusters = clusters.map(cluster => ({ cell: cluster.cell, text: cluster.text }));
      self.postMessage({ type: 'frame', buffer, columns, rows, x, y, cursor,
        clusters: textClusters }, [buffer]);
    },
    dcssSemantic(event) {
      if (!terminal()) self.postMessage({ type: 'semantic', event });
    },
    dcssSemanticError(reason) {
      if (!terminal()) self.postMessage({ type: 'semantic-error', error: String(reason) });
    },
    dcssHasKey: () => !terminal() && keys.length > 0,
    dcssReadKey(callback) {
      if (terminal()) throw failure ?? new Error('engine session completed');
      const scope = currentInput();
      if (scope.wake) throw new Error('engine registered overlapping input resolvers');
      if (keys.length && (activeOperation || !suspendedRequests.length
          || keys[0].sequence < suspendedRequests[0].sequence)) {
        self.postMessage({ type: 'waiting', value: false });
        callback(keys.shift().key);
      } else {
        scope.wake = callback;
        self.postMessage({ type: 'waiting', value: true });
        // Allow the import's suspension/unwind to finish before any export.
        queueMicrotask(drain);
      }
    },
    print: line => self.postMessage({ type: 'log', level: 'info', line: String(line) }),
    printErr: line => self.postMessage({ type: 'log', level: 'error', line: String(line) }),
    onAbort: reason => fail(new Error('engine aborted: ' + reason)),
    onExit: complete,
  });
  if (terminal()) throw failure ?? new Error('engine session completed');
  engine.FS.mkdirTree('/persist');
  restoreFiles(request.files ?? []);
  respond(request.id, true, true);
}

self.onmessage = async ({ data }) => {
  if (data?.type === 'key') {
    if (terminal()) return;
    if (!Number.isInteger(data.key) || data.key < -0x80000000 || data.key > 0x7fffffff) {
      fail(new Error('worker received an invalid normalized key'));
      return;
    }
    keys.push({ key: data.key, sequence: nextSequence++ });
    deliverKey();
    return;
  }
  if (data?.type !== 'request' || !Number.isSafeInteger(data.id)) return;
  if (pendingRequests.has(data.id)) { fail(new Error('duplicate pending engine request id')); return; }
  pendingRequests.set(data.id, data);
  if (failure) { respond(data.id, false, failure); return; }
  if (completedStatus !== null) { respond(data.id, false, 'engine session completed'); return; }
  try {
    if (data.op === 'boot') {
      await boot(data);
    } else if (data.op === 'start') {
      if (!engine || started) throw new Error('engine must be booted and started exactly once');
      if (!Array.isArray(data.arguments) || data.arguments.some(argument => typeof argument !== 'string')) {
        throw new Error('invalid engine startup arguments');
      }
      started = true;
      const lifetime = engine.callMain([...data.arguments]);
      if (runtime === 'jspi') {
        if (!lifetime || typeof lifetime.then !== 'function') throw new Error('JSPI main did not return a lifetime Promise');
        // Immediate handlers avoid an unhandled game-lifetime rejection. Start
        // responds now, so input can arrive while promising main is suspended.
        Promise.resolve(lifetime).then(status => {
          if (!terminal()) complete(status);
        }, fail);
      }
      if (failure) throw failure;
      respond(data.id, true, true);
    } else if (['state', 'repaint', 'files', 'save'].includes(data.op)) {
      if (!engine || !started) throw new Error('engine has not started');
      suspendedRequests.push({ ...data, sequence: nextSequence++ });
      flushSuspendedRequests();
    } else {
      throw new Error('unsupported engine worker operation');
    }
  } catch (error) {
    if (expectedCompletedExit(error)) { respond(data.id, true, true); return; }
    respond(data.id, false, error);
    if (data.op === 'boot' || data.op === 'start') fail(error);
  }
};

self.addEventListener('error', event => {
  if (expectedCompletedExit(event.error)) { event.preventDefault(); return; }
  fail(event.error || new Error(event.message || 'uncaught engine worker error'));
});
self.addEventListener('unhandledrejection', event => {
  event.preventDefault();
  fail(event.reason || new Error('unhandled engine worker rejection'));
});
