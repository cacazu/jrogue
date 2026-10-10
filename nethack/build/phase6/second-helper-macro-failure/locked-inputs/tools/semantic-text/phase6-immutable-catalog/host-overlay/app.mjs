/* Application lifecycle and browser platform wiring. Changed 2026-10-02. */
import { ShimHost, RustLayers, readGameFile } from './shim-host.mjs';
import { DomUI } from './dom-ui.mjs';
import { SaveStore, SAVE_DIRECTORY } from './save-store.mjs';

const catalog = await fetch('./browser-ui.json').then(response => {
  if (!response.ok) throw new Error('Browser UI catalog could not be loaded');
  return response.json();
});
const ui = new DomUI(catalog);
let phase = 'loading';
let module = null;
let host = null;
let layers = null;
let store = null;
let factory = null;
let startBusy = false;
let engineUsed = false;
let latestState = {latest:null,auxiliary:null};
let memoryStateAvailable = false;
let memoryCompletionPending = false;
let finalized = true;
let semanticCatalogStatus = 'unavailable';
let semanticCatalogError = null;
const callbackName = '__jrogueNetHackShim';

function reportError(kind,error) {
  console.error(error);
  ui.notice(ui.t(kind,{reason:error?.message ?? String(error)}));
}

async function createEngine() {
  // Release adapter-owned resources before replacing the original Wasm instance.
  if (layers) { layers.dispose(); layers = null; ui.layers = null; ui.host = null; }
  phase = 'loading';
  if (!factory) factory = (await import('./engine/nethack.js')).default;
  globalThis.nethackGlobal = {};
  module = await factory({
    noInitialRun:true,
    locateFile:path => new URL(`./engine/${path.split('/').at(-1)}`,import.meta.url).href,
    print:text => { if (host) host.message(text); else console.info(text); },
    printErr:text => console.error(text),
    onAbort:reason => { phase = 'error'; reportError('ui.load_error',new Error(String(reason))); },
    onExit:status => {
      phase = 'finalizing';
      // onExit follows native topten/score writes; exit_nhwindows can precede them.
      void host.finalize(status).catch(error => reportError(memoryCompletionPending ? 'ui.storage_failed_download' : 'ui.storage_error',error)).finally(() => {
        phase = status === 0 ? 'ended' : 'error';
        finalized = true;
      });
    }
  });
  const layout = JSON.parse(module.ccall('nh_abi_layout_json','string',[],[]));
  module.FS.mkdirTree(SAVE_DIRECTORY);
  // Upstream requires a writable score file even for a brand-new playground.
  for (const filename of ['/record','/logfile','/xlogfile','/perm']) {
    if (!module.FS.analyzePath(filename).exists) module.FS.writeFile(filename,'');
  }
  module.ENV.NETHACKOPTIONS = 'color,time,menustyle:full,!perm_invent,!tutorial';
  layers = new RustLayers(module,catalog);
  const nativeSemanticAvailable = typeof module._nh_abi_semantic_event === 'function';
  const gameplayFormatterAvailable = typeof module._nh_rust_catalog_register === 'function' && typeof module._nh_rust_catalog_release === 'function' && typeof module._nh_rust_format_registered === 'function';
  semanticCatalogStatus = nativeSemanticAvailable && gameplayFormatterAvailable ? 'loading' : 'unavailable';
  semanticCatalogError = null;
  if (nativeSemanticAvailable && gameplayFormatterAvailable) {
    try {
      const response = await fetch('./gameplay-core.json');
      if (!response.ok) throw new Error(`Gameplay catalog could not be loaded (${response.status})`);
      layers.setGameplayCatalog(await response.json());
      semanticCatalogStatus = 'loaded';
    } catch (error) {
      // The original engine remains playable with explicit source English.
      semanticCatalogStatus = 'error'; semanticCatalogError = error.message;
    }
  }
  store = new SaveStore(module);
  host = new ShimHost({module,layout,ui,
    questArguments:id => layers.gameplayCatalog?.argument_schemas?.[id] ?? null,
    semanticReader:nativeSemanticAvailable ? (name,window) => {
      // Read only at the actual native text callback, before any async wait.
      // Rendering and locale changes use owned records and never call this.
      // Current generated C arguments are text/int32/uint32. Unsafe Number
      // values from a future wider wire format are rejected by owned capture.
      const json = module.ccall('nh_abi_semantic_event','string',['string','number'],[name,window]);
      return json ? JSON.parse(json) : null;
    } : null,
    fileReader:async filename => {
      const pointer = module.ccall('nh_abi_readfile','number',['string'],[filename]);
      if (pointer) {
        try { return module.UTF8ToString(pointer); } finally { module._free(pointer); }
      }
      return readGameFile(module.FS,filename,'');
    },
    persist:async () => {
      const playerName = globalThis.nethackGlobal?.globals?.svp?.plname ?? 'Player';
      // Both envelopes are validated in memory before the single transaction.
      // A failed transaction preserves the complete emergency export.
      latestState = store.captureState(module.FS,playerName);
      memoryStateAvailable = true;
      memoryCompletionPending = true;
      await store.writeState(latestState);
      memoryCompletionPending = false;
      ui.notice(ui.t(latestState.latest ? 'ui.persisted' : 'ui.auxiliary_persisted'));
    }
  });
  globalThis[callbackName] = async (name,...args) => {
    try { return await host.callback(name,...args); }
    catch (error) { phase = 'error'; reportError('ui.load_error',error); throw error; }
  };
  module.ccall('shim_graphics_set_callback',null,['string'],[callbackName]);
  ui.bind(host,layers);
  engineUsed = false;
  phase = 'ready';
  ui.els['game-state'].textContent = ui.t('ui.loaded');
}

async function start(restore = false) {
  if (startBusy) return;
  if (engineUsed && !host.exited) { ui.notice(ui.t('ui.active_game')); return; }
  startBusy = true;
  ui.els.start.disabled = true; ui.els.restore.disabled = true;
  try {
    if (!module || engineUsed || phase === 'error') await createEngine();
    // A failed read must not turn an existing save into a new empty playground.
    const state = memoryCompletionPending ? latestState : await store.readState();
    const envelope = state.latest;
    if (!restore && envelope) { ui.notice(ui.t('ui.new_save_exists')); return; }
    if (restore && !envelope) { ui.notice(ui.t('ui.no_save')); return; }
    store.hydrateAuxiliary(module.FS,state.auxiliary);
    latestState = state; memoryStateAvailable = true;
    let playerName;
    if (restore) playerName = store.hydrate(module.FS,envelope);
    else {
      playerName = await ui.text({id:'ui.player_name',maxBytes:layoutNameSize()});
      if (playerName === null) return;
      if (!playerName.trim()) playerName = 'Player';
    }
    ui.messages = []; ui.questPresentations = new WeakMap(); ui.lastFrame = {cells:[],status:[]}; ui.cursorPosition = null; ui.statusEvent = null;
    ui.renderMessages(); ui.drawMap(); ui.notice('');
    module.ENV.NETHACKOPTIONS = `color,time,menustyle:full,!perm_invent,${!restore && ui.els.tutorial.checked ? 'tutorial' : '!tutorial'}`;
    // Rust/libc constructors can cache environ before the factory resolves.
    // Update libc explicitly; assigning the exported JS ENV object alone is
    // insufficient after initialization.
    if (module.ccall('nh_abi_setenv','number',['string','string'],['NETHACKOPTIONS',module.ENV.NETHACKOPTIONS]) !== 0) throw new Error('Native game options could not be configured');
    const explicitTestSeed = module.ENV.NETHACK_TEST_SEED;
    if (explicitTestSeed !== undefined && explicitTestSeed !== '') {
      if (module.ccall('nh_abi_setenv','number',['string','string'],['NETHACK_TEST_SEED',String(explicitTestSeed)]) !== 0) throw new Error('Explicit test seed could not be configured');
    }
    engineUsed = true; finalized = false; phase = 'playing';
    ui.els.export.disabled = true;
    ui.els.tutorial.disabled = true;
    // Commands and actual game RNG remain wholly in the official engine.
    module.callMain(['-u',playerName]);
  } catch (error) { phase = 'error'; reportError('ui.load_error',error); }
  finally {
    startBusy = false;
    if (!engineUsed || host?.exited || phase === 'error') { ui.els.start.disabled = false; ui.els.restore.disabled = false; }
    if (!engineUsed) { ui.els.tutorial.disabled = false; ui.els.export.disabled = false; }
  }
}
function layoutNameSize() { return host.memory.layout.playerNameSize; }

async function exportSave() {
  if (!store) throw new Error('Engine has not loaded');
  if (engineUsed && !host.exited) throw new Error('Save and quit the active game before exporting');
  // Export committed native files only; the live Asyncify stack is never serialized.
  let state;
  if (memoryCompletionPending) state = latestState;
  else {
    try { state = await store.readState(); }
    catch (error) { if (memoryStateAvailable) state = latestState; else throw error; }
  }
  const envelope = store.exportState(state);
  if (!envelope) { ui.notice(ui.t('ui.no_persisted_data')); return null; }
  return envelope;
}
async function importSave(envelope) {
  if (engineUsed && !host.exited) throw new Error('Active game');
  // A legacy game-only import retains existing local auxiliary files.
  const previous = memoryCompletionPending ? latestState : await store.readState();
  const state = store.importState(envelope,previous);
  await store.writeState(state);
  latestState = state; memoryStateAvailable = true; memoryCompletionPending = false;
  return state;
}
ui.els.start.addEventListener('click',() => start(false));
ui.els.restore.addEventListener('click',() => start(true));
ui.els.export.addEventListener('click',async () => {
  try {
    const envelope = await exportSave();
    if (!envelope) return;
    const url = URL.createObjectURL(new Blob([envelope],{type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'nethack-5.0.0-save.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  } catch (error) { reportError('ui.storage_error',error); }
});
ui.els.import.addEventListener('change',async () => {
  const file = ui.els.import.files[0];
  ui.els.import.value = '';
  if (!file) return;
  if (engineUsed && !host.exited) { ui.notice(ui.t('ui.active_game')); return; }
  try {
    if (file.size > 32*1024*1024+4096) throw new Error('Save import is too large');
    const envelope = await file.text();
    const state = await importSave(envelope);
    ui.notice(ui.t(state.latest ? 'ui.imported' : 'ui.imported_auxiliary'));
  } catch (error) { reportError('ui.invalid_save',error); }
});

// Public boundary-only diagnostics for real-browser regression checks.
// Reading or repainting these values cannot consume an input or advance a turn.
globalThis.netHackTest = {
  get module() { return module; }, get host() { return host; }, get phase() { return phase; }, get locale() { return ui.locale; },
  setLocale(locale) { if (!['ja','en'].includes(locale)) throw new Error('Invalid locale'); ui.locale = locale; ui.translateUI(); },
  repaint() { ui.frame(host.frame()); }, getFrame() { return host?.frame(); },
  sendKey(key,modifiers = 0) { const code = layers.keycode(key,modifiers,0); if (code >= 0) return host.inbox.send({type:'key',code}); return false; },
  sendDirection(dx,dy,run = false) { const code = layers.direction(dx,dy,run,0,host.inputLayout); if (code >= 0) return host.inbox.send({type:'key',code}); return false; },
  get diagnostics() { return {phase,finalized,storagePending:memoryCompletionPending,pending:host?.pendingKind,consumedInputs:host?.inbox.consumedTotal,retainedInputs:host?.inbox.consumed.length,queuedInputs:host?.inbox.queue.length,untranslatedTextEvents:host?.missingSemanticTexts,semanticTextEvents:host?.semanticTextEvents,semanticCaptureFailures:host?.semanticCaptureFailures,semanticFormattingFailures:ui.semanticFormattingFailures,semanticCatalogStatus,semanticCatalogError,callbacks:host?.trace.slice(),rustUi:Boolean(layers)}; },
  exportSave,
  importSave,
  start, get latestEnvelope() { return latestState.latest; }
};

try {
  ui.els.start.disabled = true; ui.els.restore.disabled = true;
  await createEngine();
  ui.els.start.disabled = false; ui.els.restore.disabled = false;
} catch (error) { phase = 'error'; reportError('ui.load_error',error); }
