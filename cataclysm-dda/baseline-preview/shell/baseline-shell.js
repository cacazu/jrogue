/* Local original-engine reference shell. No gameplay or RNG implementation. */
(() => {
  'use strict';
  const SOURCE_COMMIT = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
  const SAVE_ROOT = '/home/web_user/.cataclysm-dda';
  const JAPANESE_MO = '/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo';
  const JAPANESE_MO_BYTES = 20214890;
  const JAPANESE_MO_SHA256 = '336dc66ccd4d1e828832a38756cddcc165e0f1af917f546752b5655ff02705e7';
  const canvas = document.getElementById('canvas');
  const loading = document.getElementById('loading');
  const output = document.getElementById('diagnostic-output');
  const diagnostics = { baselineOnly: true, sourceCommit: SOURCE_COMMIT, sound: false,
    phase: 'loading', menuReady: false, idbfsMountedBy: 'original-cpp-main', events: [], logs: [] };
  window.cddaBaselineDiagnostics = diagnostics;
  let catalogs;
  let rustBridge;
  let language = 'ja';
  let statusId = 'runtime.loading';
  let statusParameters = {};
  let viewportScale = null;
  let viewportMode = 'readable';

  // Scale the canvas element itself, so SDL's pointer-coordinate mapping uses
  // the same rectangle as the displayed pixels on both desktop and mobile.
  function fitCanvas() {
    // SDL_CreateWindow probes the natural 1×1 canvas to decide whether CSS
    // owns its logical size. Do not style it until that native window exists.
    if (!diagnostics.menuReady) return;
    const stage = document.getElementById('stage');
    if (!stage.clientWidth || !stage.clientHeight || !canvas.width || !canvas.height) return;
    const fit = Math.min(stage.clientWidth / canvas.width, stage.clientHeight / canvas.height);
    // Native 16px CJK remains at least 12px by default. The full original
    // framebuffer stays scrollable; explicit overview can fit it all at once.
    const scale = viewportScale ?? (viewportMode === 'fit' ? fit : Math.max(0.75, Math.min(1, fit)));
    canvas.style.width = Math.floor(canvas.width * scale) + 'px';
    canvas.style.height = Math.floor(canvas.height * scale) + 'px';
    document.getElementById('view-scale').value = String(Math.round(scale * 100));
    document.getElementById('view-scale-value').textContent = Math.round(scale * 100) + '%';
    diagnostics.canvas = { width: canvas.width, height: canvas.height, scale,
      cssWidth: Math.floor(canvas.width * scale), cssHeight: Math.floor(canvas.height * scale),
      viewportMode, scrollLeft: stage.scrollLeft, scrollTop: stage.scrollTop };
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitCanvas).observe(document.getElementById('stage'));
  if (typeof MutationObserver !== 'undefined') new MutationObserver(fitCanvas).observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
  window.addEventListener('resize', fitCanvas);
  document.getElementById('view-scale').addEventListener('input', event => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    viewportScale = Math.min(1.5, Math.max(0.25, value / 100));
    viewportMode = 'manual';
    fitCanvas();
    record('viewport-scale', diagnostics.canvas);
  });
  document.getElementById('view-fit').addEventListener('click', () => {
    viewportScale = null;
    viewportMode = 'fit';
    fitCanvas();
    record('viewport-scale', diagnostics.canvas);
  });
  document.querySelectorAll('[data-pan]').forEach(button => {
    button.addEventListener('click', () => {
      const stage = document.getElementById('stage');
      const [x, y] = { left: [-1, 0], up: [0, -1], down: [0, 1], right: [1, 0] }[button.dataset.pan];
      stage.scrollLeft += x * stage.clientWidth * 0.75;
      stage.scrollTop += y * stage.clientHeight * 0.75;
      fitCanvas();
      record('viewport-pan', { direction: button.dataset.pan, scrollLeft: stage.scrollLeft, scrollTop: stage.scrollTop });
    });
  });

  function record(type, detail = {}) {
    diagnostics.events.push({ type, at: Date.now(), ...detail });
    if (diagnostics.events.length > 100) diagnostics.events.shift();
    output.textContent = JSON.stringify(diagnostics, null, 2);
  }
  function log(stream, values) {
    diagnostics.logs.push({ stream, text: values.map(String).join(' ') });
    if (diagnostics.logs.length > 80) diagnostics.logs.shift();
    output.textContent = JSON.stringify(diagnostics, null, 2);
  }
  function t(id, parameters = {}) {
    return rustBridge.formatText(language, id, parameters);
  }
  function setStatus(id, parameters = {}) {
    statusId = id;
    statusParameters = parameters;
    loading.textContent = t(id, parameters);
  }
  function setLanguage(next) {
    language = next;
    document.documentElement.lang = language;
    document.querySelectorAll('[data-text]').forEach(element => {
      element.textContent = t(element.dataset.text);
    });
    document.querySelectorAll('[data-aria]').forEach(element => {
      element.setAttribute('aria-label', t(element.dataset.aria));
    });
    document.title = t('baseline.title');
    setStatus(statusId, statusParameters);
    record('shell-language', { language });
  }
  function fail(reason) {
    diagnostics.phase = 'failed';
    loading.hidden = false;
    if (catalogs && rustBridge) setStatus('runtime.failure', { reason: String(reason) });
    else loading.textContent = String(reason);
    record('failure', { reason: String(reason) });
  }

  // TranslationDocument uses native mmap. Installed LZ4FS supports read/seek
  // but not mmap; materialize only the byte-identical finalized MO in MEMFS.
  async function prepareJapaneseCatalog(FS) {
    const bytes = FS.readFile(JAPANESE_MO, { encoding: 'binary' });
    if (bytes.byteLength !== JAPANESE_MO_BYTES) throw new Error('Japanese catalog size differs from its reviewed artifact.');
    const digest = async data => Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256', data)),
      byte => byte.toString(16).padStart(2, '0')).join('');
    if (await digest(bytes) !== JAPANESE_MO_SHA256) throw new Error('Japanese catalog hash differs from its reviewed artifact.');
    const node = FS.analyzePath(JAPANESE_MO).object;
    const materialized = typeof node?.stream_ops?.mmap !== 'function';
    if (materialized) {
      FS.unlink(JAPANESE_MO);
      FS.writeFile(JAPANESE_MO, bytes);
    }
    const mappedNode = FS.analyzePath(JAPANESE_MO).object;
    if (typeof mappedNode?.stream_ops?.mmap !== 'function') throw new Error('Japanese catalog still lacks native mmap support.');
    if (await digest(FS.readFile(JAPANESE_MO, { encoding: 'binary' })) !== JAPANESE_MO_SHA256) {
      throw new Error('Japanese catalog bytes changed during MEMFS materialization.');
    }
    diagnostics.japaneseCatalog = { path: JAPANESE_MO, bytes: bytes.byteLength, sha256: JAPANESE_MO_SHA256,
      mmapSupported: true, materializedFromCompressedFile: materialized };
    record('japanese-catalog-ready', diagnostics.japaneseCatalog);
  }

  // The C++ engine creates/mounts this directory and calls syncfs(true).
  // Seed only a new profile, after that initial restore and before main resumes.
  // In particular, never mkdir/mount SAVE_ROOT from this shell.
  function observeOriginalFilesystem() {
    const FS = window.Module.FS;
    if (!FS || typeof FS.syncfs !== 'function') throw new Error('Engine FS runtime export is unavailable.');
    const originalSyncfs = FS.syncfs.bind(FS);
    let initialRestoreObserved = false;
    FS.syncfs = function (populate, callback) {
      record('idbfs-sync-start', { populate: Boolean(populate) });
      return originalSyncfs(populate, async error => {
        record('idbfs-sync-finish', { populate: Boolean(populate), error: error ? String(error) : null });
        if (error || !populate || initialRestoreObserved) return callback(error);
        initialRestoreObserved = true;
        diagnostics.persistenceLoaded = true;
        const optionsPath = SAVE_ROOT + '/config/options.json';
        try {
          await prepareJapaneseCatalog(FS);
          if (FS.analyzePath(optionsPath).exists) {
            diagnostics.profileSeeded = false;
            return callback(null);
          }
          FS.mkdirTree(SAVE_ROOT + '/config');
          FS.writeFile(optionsPath, JSON.stringify([{ name: 'USE_LANG', value: 'ja' }]) + '\n');
          diagnostics.profileSeeded = true;
          record('new-profile-default', { option: 'USE_LANG', value: 'ja' });
          return originalSyncfs(false, seedError => {
            record('new-profile-persisted', { error: seedError ? String(seedError) : null });
            callback(seedError);
          });
        } catch (seedError) {
          fail(seedError);
          callback(seedError);
        }
      });
    };
    record('filesystem-observer-ready');
  }

  // A versioned container around unchanged native files; this is not a native
  // format migration or a proof of deterministic game save compatibility.
  function bytesToBase64(bytes) {
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
    }
    return btoa(chunks.join(''));
  }
  async function exportSaveFiles() {
    const FS = window.Module.FS;
    await new Promise((resolve, reject) => FS.syncfs(false, error => error ? reject(error) : resolve()));
    const files = [];
    let bytes = 0;
    function visit(directory, relative) {
      for (const entry of FS.readdir(directory).filter(name => name !== '.' && name !== '..').sort()) {
        const absolute = directory + '/' + entry;
        const path = relative ? relative + '/' + entry : entry;
        const stat = FS.stat(absolute);
        if (FS.isDir(stat.mode)) visit(absolute, path);
        else if (FS.isFile(stat.mode)) {
          const data = FS.readFile(absolute, { encoding: 'binary' });
          bytes += data.length;
          files.push({ path, encoding: 'base64', bytes: data.length, data: bytesToBase64(data) });
        }
      }
    }
    visit(SAVE_ROOT, '');
    const archive = { format: 'cdda-original-files', version: 1,
      upstream: { tag: '0.I-1', commit: SOURCE_COMMIT }, files };
    const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cdda-0.I-1-native-files.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    record('save-export', { count: files.length, bytes, containerVersion: archive.version });
    return { files: files.length, bytes };
  }
  window.cddaBaselineExportSaveFiles = exportSaveFiles;

  const keyCodes = { ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, ArrowRight: 39,
    Enter: 13, Escape: 27, Tab: 9, ' ': 32, '.': 190, '>': 190, ',': 188, '<': 188,
    '/': 191, '?': 191, '\\': 220, '|': 220, ';': 186, ':': 186, "'": 222, '"': 222,
    '[': 219, '{': 219, ']': 221, '}': 221, '-': 189, '_': 189, '=': 187, '+': 187,
    '`': 192, '~': 192, '!': 49, '@': 50, '#': 51, '$': 52, '%': 53, '^': 54,
    '&': 55, '*': 56, '(': 57, ')': 48, Backspace: 8, Home: 36, End: 35,
    PageUp: 33, PageDown: 34, Delete: 46 };
  const characterCodes = { ' ': 'Space', '.': 'Period', '>': 'Period', ',': 'Comma', '<': 'Comma',
    '/': 'Slash', '?': 'Slash', '\\': 'Backslash', '|': 'Backslash', ';': 'Semicolon', ':': 'Semicolon',
    "'": 'Quote', '"': 'Quote', '[': 'BracketLeft', '{': 'BracketLeft', ']': 'BracketRight',
    '}': 'BracketRight', '-': 'Minus', '_': 'Minus', '=': 'Equal', '+': 'Equal', '`': 'Backquote', '~': 'Backquote',
    '!': 'Digit1', '@': 'Digit2', '#': 'Digit3', '$': 'Digit4', '%': 'Digit5', '^': 'Digit6',
    '&': 'Digit7', '*': 'Digit8', '(': 'Digit9', ')': 'Digit0' };
  const shiftedPunctuation = new Set(['>','<','?','|',':','"','{','}','_','+','~','!','@','#','$','%','^','&','*','(',')']);
  // Keep browser form typing out of SDL's global keyboard listeners. The
  // listeners are registered before the engine installs its capture handlers.
  for (const type of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(type, event => {
      if (event.target && event.target.closest && event.target.closest('input, select, button')) {
        event.stopImmediatePropagation();
      }
    }, true);
  }
  function sendKey(key) {
    if (!diagnostics.menuReady) return;
    canvas.focus();
    const code = keyCodes[key] || key.toUpperCase().charCodeAt(0);
    const domCode = key.length === 1 ? characterCodes[key] ||
      (/^[0-9]$/.test(key) ? 'Digit' + key : 'Key' + key.toUpperCase()) : key;
    const properties = { key, code: domCode, keyCode: code, which: code, bubbles: true,
      cancelable: true, shiftKey: shiftedPunctuation.has(key) || (key.length === 1 && key !== key.toLowerCase()) };
    canvas.dispatchEvent(new KeyboardEvent('keydown', properties));
    if (key.length === 1) canvas.dispatchEvent(new KeyboardEvent('keypress', {
      ...properties, charCode: key.charCodeAt(0), keyCode: key.charCodeAt(0), which: key.charCodeAt(0) }));
    canvas.dispatchEvent(new KeyboardEvent('keyup', properties));
    record('input-helper', { key });
  }
  window.cddaBaselineSendKey = sendKey;
  document.querySelectorAll('[data-key]').forEach(button => {
    button.addEventListener('click', () => {
      if (!rustBridge) return;
      const resolved = rustBridge.resolveHelperKey(button.dataset.key, 'menu');
      sendKey(resolved.key);
      record('rust-helper-input', resolved);
    });
  });
  document.getElementById('text-input-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = document.getElementById('text-input');
    for (const key of input.value) sendKey(key);
    input.value = '';
  });
  document.getElementById('shell-language').addEventListener('change', event => setLanguage(event.target.value));
  document.getElementById('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) { record('fullscreen-error', { error: String(error) }); }
    finally { canvas.focus(); }
  });
  document.getElementById('export-saves').addEventListener('click', async () => {
    try {
      const result = await exportSaveFiles();
      record('message', { id: 'save.exported', text: t('save.exported', { count: result.files, bytes: result.bytes }) });
    } catch (error) { record('save-export-error', { text: t('save.failed', { reason: String(error) }) }); }
    finally { canvas.focus(); }
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    loading.hidden = false;
    setStatus('runtime.context_lost');
    record('webgl-context-lost');
  });
  canvas.addEventListener('pointerdown', () => canvas.focus());
  window.addEventListener('menuready', () => {
    diagnostics.phase = 'menu-ready';
    diagnostics.menuReady = true;
    loading.hidden = true;
    document.getElementById('export-saves').disabled = false;
    fitCanvas();
    canvas.focus();
    record('menu-ready');
  });
  window.addEventListener('error', event => fail(event.message || event.error));
  window.addEventListener('unhandledrejection', event => fail(event.reason));
  window.addEventListener('beforeunload', event => {
    if (window.game_unsaved) { event.preventDefault(); event.returnValue = ''; }
  });

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load ' + source));
      document.head.appendChild(script);
    });
  }
  async function start() {
    const { loadBridge } = await import('./rust-browser-bridge/browser-bridge.mjs');
    rustBridge = await loadBridge();
    window.cddaRustBridge = rustBridge;
    diagnostics.rustBridge = { abi: 1, scope: 'bounded-shell-and-helper-input',
      defaultLocale: rustBridge.defaultLocale };
    const locales = await Promise.all(['en', 'ja'].map(async name => {
      const response = await fetch('locales/' + name + '.json');
      if (!response.ok) throw new Error('Locale fetch failed: ' + response.status);
      return [name, await response.json()];
    }));
    catalogs = Object.fromEntries(locales);
    setLanguage('ja');
    window.Module = {
      canvas,
      preRun: [observeOriginalFilesystem],
      postRun: [() => record('engine-post-run')],
      print: (...values) => log('stdout', values),
      printErr: (...values) => log('stderr', values),
      setStatus: text => { record('engine-status', { text }); setStatus(text ? 'runtime.loading' : 'runtime.starting'); },
      totalDependencies: 0,
      monitorRunDependencies(left) {
        this.totalDependencies = Math.max(this.totalDependencies, left);
        diagnostics.remainingDependencies = left;
        setStatus(left ? 'runtime.preparing' : 'runtime.starting',
          left ? { completed: this.totalDependencies - left, total: this.totalDependencies } : {});
        record('run-dependencies', { remaining: left });
      },
      onRuntimeInitialized() { diagnostics.phase = 'runtime-ready'; fitCanvas(); record('runtime-ready'); },
      onAbort: reason => fail(reason)
    };
    await loadScript('cataclysm-tiles.data.js');
    await loadScript('cataclysm-tiles.js');
  }
  start().catch(fail);
})();
