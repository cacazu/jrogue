// SPDX-License-Identifier: GPL-3.0-or-later
// Actual native lifecycle + Rust transport integration. There is no JS tick loop.
import { RetainedCoreAdapter, keyInput } from './retained-core-adapter.mjs';
import { NativeCoreError, OriginalNativeCore } from './original-native-core.mjs';

const phaseText = {
  fresh: 'ui.core.loading', mounting: 'ui.core.mounting',
  initializing: 'ui.core.initializing', starting: 'ui.core.starting',
  observing: 'ui.core.loading', waiting: 'ui.core.loading',
  ready: 'ui.core.ready', failed: 'error.core.failed',
};

export async function createRetainedBrowserSession({
  nativeFactory, canvas, rustWasmBytes, mountBeforeInit, locateFile,
  nativeOptions = {}, onPresentation = () => {}, beforeStart = null,
}) {
  if (typeof nativeFactory !== 'function' || typeof mountBeforeInit !== 'function' ||
      typeof onPresentation !== 'function' || (beforeStart !== null && typeof beforeStart !== 'function') || !canvas) {
    throw new NativeCoreError('error.core.request', 'factory');
  }
  const { instance } = await WebAssembly.instantiate(rustWasmBytes, {});
  const session = new RetainedBrowserSession(instance.exports, onPresentation, {beforeStart});
  session.show(); // All visible text comes from Rust's default Japanese labels.
  try {
    // Emscripten needs the real canvas before SDL/OpenGL initialization. Asset
    // access remains the VFS adapter's responsibility, with no preload here.
    const module = await nativeFactory({ ...nativeOptions, canvas, noInitialRun: true,
      ...(locateFile ? { locateFile } : {}) });
    session.phase = 'mounting';
    session.show();
    await mountBeforeInit(module);
    session.attach(new OriginalNativeCore(module));
  } catch (error) {
    session.fail(error, 'error.core.native_mount');
  }
  return session;
}

export class RetainedBrowserSession {
  constructor(wasmExports, onPresentation = () => {}, {beforeStart = null} = {}) {
    this.original = null;
    this.phase = 'fresh';
    this.failure = null;
    this.started = null;
    this.onPresentation = onPresentation;
    this.beforeStart = beforeStart;
    // The callbacks are fulfilled only after attach/start. No generated Lua,
    // actors, native savefiles, RNG, or gameplay formulas live in this session.
    this.adapter = new RetainedCoreAdapter(wasmExports, {
      snapshotJson: () => this.requireOriginal().snapshotJson(),
      commandJson: key => this.requireOriginal().commandJson(key),
      uiSnapshotJson: () => this.requireOriginal().uiSnapshotJson(),
      uiCommandJson: command => this.requireOriginal().uiCommandJson(command),
    });
    this.response = this.adapter.request({ op: 'locale', locale: 'ja' });
  }

  attach(original) {
    if (this.original || this.failure) throw new NativeCoreError('error.core.busy', 'attach');
    this.original = original;
  }

  requireOriginal() {
    if (!this.original) throw new NativeCoreError('error.core.not_ready', this.phase);
    return this.original;
  }

  start() {
    if (this.started) return this.started;
    if (this.failure) return Promise.resolve(this.show());
    // Queue the lifecycle before running it so concurrent callers join one
    // startup, including when a native callback synchronously throws.
    this.started = Promise.resolve().then(async () => {
      try {
        this.phase = 'initializing'; this.show();
        this.requireOriginal().initialize();
        // One original VM has now been initialized, but its module/config and
        // character birth have not started. Semantic callbacks belong here.
        if (this.beforeStart) await this.beforeStart({session:this,original:this.original,module:this.original.module});
        this.phase = 'starting'; this.show();
        this.original.start();
        this.phase = 'observing'; this.show();
        if (this.original.uiAvailable) await this.dispatch({ op: 'ui_snapshot' }).completion;
        await this.dispatch({ op: 'snapshot' }).completion;
      } catch (error) {
        this.fail(error);
      }
      return this.show();
    });
    return this.started;
  }

  // The immediate result is needed by key handlers before the first await.
  // Pure view/locale operations do not call the original runtime.
  dispatch(request) {
    if (this.failure && !['locale', 'view'].includes(request?.op)) {
      const immediate = this.show();
      return { immediate, completion: Promise.resolve(immediate) };
    }
    this.response = this.adapter.request(request);
    if (this.failure) {
      this.response = { ...this.response, error_id: this.failure instanceof NativeCoreError ?
        this.failure.textId : 'error.core.failed' };
    }
    const immediate = this.show();
    const pendingKind = this.response.pending_kind;
    const completion = this.response.pending_kind === 0 ? Promise.resolve(immediate) :
      this.adapter.fulfill().then(async response => {
        this.response = response;
        if (this.adapter.lastCoreError instanceof NativeCoreError) {
          this.response = { ...response, error_id: this.adapter.lastCoreError.textId };
        }
        if (!this.failure && !this.response.error_id && this.response.view) {
          this.phase = this.response.view.ready ? 'ready' : 'waiting';
        }
        const shown = this.show();
        if (!this.failure && !this.response.error_id && this.original?.uiAvailable) {
          if (pendingKind === 1 || pendingKind === 2) return this.dispatch({ op: 'ui_snapshot' }).completion;
          if (pendingKind === 4) return this.dispatch({ op: 'snapshot' }).completion;
        }
        return shown;
      }).catch(error => this.fail(error));
    return { immediate, completion };
  }

  fail(error, fallbackId = 'error.core.failed') {
    this.failure = error;
    this.phase = 'failed';
    this.response = { ...this.response, error_id: error instanceof NativeCoreError ? error.textId : fallbackId };
    return this.show();
  }

  show() {
    const presentation = { ...this.response, phase: this.phase,
      status_id: this.response.error_id || phaseText[this.phase] };
    this.onPresentation(presentation);
    return presentation;
  }

  // Rust maps physical keys. Browser touch buttons carry exact original virtual
  // IDs; button captions and all status text are semantic catalog IDs.
  bindControls({ keyTarget = globalThis.window, controlsRoot, ownHandledInput = true, canDispatch = () => true } = {}) {
    const keyHandler = event => {
      // Host save/lifecycle gates may suspend input before Rust can queue it.
      // This predicate must not map keys, advance the core or render a frame.
      if (!canDispatch({kind:'key',event})) return;
      const { immediate } = this.dispatch({ op: 'key', input: keyInput(event) });
      if (immediate.handled) {
        event.preventDefault();
        // Avoid sending one owned key into a separate original SDL input path.
        // The host must also keep any native main-loop/drain path inactive.
        if (ownHandledInput) event.stopImmediatePropagation();
      }
    };
    const clickHandler = event => {
      const button = event.target?.closest?.('[data-tome-command],[data-tome-op],[data-tome-locale],[data-tome-ui-key]');
      if (!button || !controlsRoot.contains(button) || button.disabled) return;
      let request;
      if (button.dataset.tomeUiKey) request = { op: 'ui', command: {
        dialog: button.dataset.tomeUiDialog, target: button.dataset.tomeUiTarget || null, key: button.dataset.tomeUiKey,
      } };
      else if (button.dataset.tomeCommand) request = { op: 'touch', key: button.dataset.tomeCommand };
      else if (button.dataset.tomeLocale) request = { op: 'locale', locale: button.dataset.tomeLocale };
      else if (button.dataset.tomeOp === 'snapshot') request = { op: 'snapshot' };
      else return;
      if (!canDispatch({kind:'control',event,request})) return;
      event.preventDefault();
      this.dispatch(request);
    };
    keyTarget?.addEventListener('keydown', keyHandler, { capture: true });
    controlsRoot?.addEventListener('click', clickHandler);
    return () => {
      keyTarget?.removeEventListener('keydown', keyHandler, { capture: true });
      controlsRoot?.removeEventListener('click', clickHandler);
    };
  }
}
