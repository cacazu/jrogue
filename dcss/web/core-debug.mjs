// Full official engine integration for local development only.
// C++ runs in a classic Worker; Rust still validates input, frames and native packs.
// A built bounded canned-message feed is localized; other native prose
// remains English. This development path is outside publication gates.
import { put, get } from './storage.mjs';
import { selectCoreRuntime } from './default-route.mjs';
import { createNativeSaveCoordinator } from './native-save-coordinator.mjs';

export async function startCore(harness) {
  // Native Text construction uses this boot locale for the entire session.
  const nativeLanguage = harness.language ?? 'ja';
  if (nativeLanguage !== 'ja' && nativeLanguage !== 'en') throw new Error('unsupported native startup locale');
  const runtime = selectCoreRuntime(location.href);
  if (runtime === 'jspi' && (typeof WebAssembly.Suspending !== 'function' || typeof WebAssembly.promising !== 'function')) {
    const error = new Error('browser does not support JSPI');
    error.code = 'jspi-unsupported';
    throw error;
  }
  let worker = null;
  const lifetime = new AbortController();
  const pending = new Map();
  const nativeKey = 'dcss.native-development.v1';
  let nextRequest = 1;
  let waiting = false;
  let frames = 0;
  let fatalError = null;
  let completedStatus = null;

  function fail(reason) {
    if (fatalError) return;
    fatalError = reason instanceof Error ? reason : new Error(String(reason));
    waiting = false;
    for (const { reject } of pending.values()) reject(fatalError);
    pending.clear();
    lifetime.abort(fatalError ?? new Error('engine session completed'));
    worker?.terminate();
    console.error('[DCSS worker]', fatalError.message);
    try {
      document.querySelector('#status').textContent = harness.call({
        op: 'text', message: { id: 'error.engine_unavailable', params: {} },
      }).text[0];
    } catch { /* Startup's caller also reports the localized failure. */ }
    window.dispatchEvent(new CustomEvent('dcss-core-error', {
      detail: { message: fatalError.message },
    }));
  }

  function complete(status) {
    if (status !== 0) { fail(new Error('invalid completed engine status')); return; }
    if (completedStatus !== null) return;
    completedStatus = status;
    waiting = false;
    for (const { reject } of pending.values()) reject(new Error('engine session completed'));
    pending.clear();
    lifetime.abort(fatalError ?? new Error('engine session completed'));
    worker?.terminate();
    try {
      document.querySelector('#status').textContent = harness.call({
        op: 'text', message: { id: 'status.game_ended', params: {} },
      }).text[0];
    } catch (error) { reportSemanticFailure(error); }
    window.dispatchEvent(new CustomEvent('dcss-core-completed', { detail: { status } }));
  }

  function reportSemanticFailure(reason) {
    try { harness.rejectCoreMessage(String(reason)); }
    catch (error) {
      // A display diagnostic must remain outside canonical engine failure.
      try { console.error('[DCSS semantic observer]', String(error)); }
      catch (_) { /* No error observer may throw into gameplay. */ }
    }
  }

  function request(op, value = {}) {
    if (fatalError) return Promise.reject(fatalError);
    if (completedStatus !== null) return Promise.reject(new Error('engine session completed'));
    const id = nextRequest++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, captureSemantic: op === 'save' });
      try { worker.postMessage({ type: 'request', id, op, ...value }); }
      catch (error) { fail(error); }
    });
  }

  function queue(key) {
    if (fatalError) throw fatalError;
    if (completedStatus !== null) return;
    if (!Number.isInteger(key) || key < -0x80000000 || key > 0x7fffffff) {
      throw new Error('core input must be a Rust-normalized integer key');
    }
    waiting = false;
    try { worker.postMessage({ type: 'key', key }); }
    catch (error) { fail(error); throw fatalError; }
  }

  function receive({ data }) {
    if (fatalError) return;
    try {
      if (data.type === 'response') {
        const operation = pending.get(data.id);
        if (!operation) return;
        pending.delete(data.id);
        if (data.ok) {
          // Worker messages are FIFO. Capture the display checkpoint in this
          // reply handler: earlier save observations are included; subsequent
          // queued-key observations cannot slip into this native checkpoint.
          try {
            operation.resolve(operation.captureSemantic ? {
              files: data.value, semantic: harness.semanticCheckpoint?.() ?? null,
            } : data.value);
          } catch (error) { operation.reject(error); }
        }
        else operation.reject(new Error(data.error || 'engine request failed'));
      } else if (data.type === 'waiting') {
        waiting = data.value === true;
      } else if (data.type === 'frame') {
        const words = new Uint32Array(data.buffer);
        const cells = [];
        for (let index = 0; index < words.length; index += 3) {
          cells.push({ glyph: words[index], foreground: words[index + 1] & 15,
            background: words[index + 2] & 15 });
        }
        const clusterCells = new Set();
        for (const cluster of data.clusters ?? []) {
          if (!Number.isInteger(cluster.cell) || cluster.cell < 0 || cluster.cell >= cells.length
              || typeof cluster.text !== 'string' || clusterCells.has(cluster.cell)) {
            throw new Error('invalid console text cluster');
          }
          clusterCells.add(cluster.cell);
          // Preserve the exact base/combining sequence; Rust checks cell text.
          cells[cluster.cell].text = cluster.text;
        }
        const { columns, rows, x, y, cursor } = data;
        harness.renderCoreFrame({ columns, rows, cells,
          cursor: cursor && x >= 0 && y >= 0 && x < columns && y < rows ? [x, y] : null });
        frames++;
      } else if (data.type === 'semantic') {
        // A rejected localization observation cannot abort canonical C++ play.
        try { harness.acceptCoreMessage(data.event); }
        catch (error) { reportSemanticFailure(error); }
      } else if (data.type === 'startup-text-error') {
        // Unlike an optional observer, a failed native display bridge rejects
        // the session. It does not enter the canned-message stream.
        fail(new Error(data.error || 'native startup localization failed'));
      } else if (data.type === 'semantic-error') {
        reportSemanticFailure(data.error || 'semantic transport failed');
      } else if (data.type === 'log') {
        const log = data.level === 'error' ? console.error : console.info;
        log('[DCSS]', data.line);
      } else if (data.type === 'completed') {
        complete(data.status);
      } else if (data.type === 'fatal') {
        fail(new Error(data.error || 'engine worker failed'));
      }
    } catch (error) { fail(error); }
  }

  const packSave = createNativeSaveCoordinator({
    capture: () => request('save'),
    pack: ({ files, semantic }) => harness.call({ op: 'pack_native', files, semantic }).value.save,
    commit: save => put(nativeKey, save, { signal: lifetime.signal }),
    signal: lifetime.signal,
  });

  const api = {
    state: () => request('state'),
    repaint: () => request('repaint'),
    files: () => request('files'),
    save: packSave,
    queue,
    get nativeLanguage() { return nativeLanguage; },
    get runtime() { return runtime; },
    get waiting() { return waiting; },
    get frames() { return frames; },
    get error() { return fatalError?.message ?? null; },
    get completed() { return completedStatus !== null; },
    terminate() { fail(new Error('engine worker terminated')); },
  };
  // No C++ module, heap, FS, or exported engine function is exposed here.

  try {
    let files = [];
    if (new URL(location.href).searchParams.get('resume') === '1') {
      const saved = await get(nativeKey);
      if (!saved) throw new Error('native development save missing');
      const restored = harness.call({ op: 'unpack_native', save: saved }).value;
      files = restored.files;
      if (restored.semantic && !harness.restoreCoreHistory) {
        throw new Error('semantic history restore boundary is missing');
      }
      harness.restoreCoreHistory?.(restored.semantic ?? null);
    } else {
      harness.restoreCoreHistory?.(null);
    }
    // Corrupt/future save and history rejection happens before Worker creation
    // or any native FS writes. A valid restore never calls a C++ observer.
    worker = new Worker('/web/core-worker.js', { name: 'dcss-official-core' });
    worker.onmessage = receive;
    worker.onerror = event => {
      event.preventDefault();
      fail(new Error(event.message || 'engine worker error'));
    };
    worker.onmessageerror = () => fail(new Error('engine worker response could not be decoded'));
    window.__dcssCore = api;
    await request('boot', { files, runtime, language: nativeLanguage });
    harness.setEngine({ dcssQueueKey: queue });
    await request('start', { arguments: [
      '-name', document.querySelector('#player').value,
      '-seed', document.querySelector('#seed').value,
      '-species', document.querySelector('#species').value,
      '-background', document.querySelector('#job').value,
    ] });
    document.querySelector('#console').focus();
    console.info('[DCSS integration] worker main suspended or returned');
    return api;
  } catch (error) {
    if (completedStatus !== null && !fatalError) return api;
    fail(error);
    throw fatalError;
  }
}
