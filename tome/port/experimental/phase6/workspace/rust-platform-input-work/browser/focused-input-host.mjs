// SPDX-License-Identifier: GPL-3.0-or-later
import {PhysicalInputError} from './physical-input-wasm.mjs';
const encoder = new TextEncoder();
const modifiers = event => ({ctrl: !!event.ctrlKey, shift: !!event.shiftKey,
  alt: !!event.altKey, meta: !!event.metaKey,
  caps_lock: !!event.getModifierState?.('CapsLock'),
  num_lock: !!event.getModifierState?.('NumLock'),
  alt_graph: !!event.getModifierState?.('AltGraph'),
  scroll_lock: !!event.getModifierState?.('ScrollLock')});

// DOM collection only: all SDL symbols, modifier masks, coordinates, default
// policy and held-state releases come from the actual Rust WASM mapper.
export class FocusedInputHost {
  constructor({mapper, original, canvas, textTarget = null, onPreedit = () => {},
    onSettled = async () => {}, onError = () => {}}) {
    if (!(canvas instanceof HTMLCanvasElement) || !canvas.id ||
        (textTarget && !(textTarget instanceof HTMLTextAreaElement)))
      throw new PhysicalInputError('input.error.host');
    this.mapper = mapper;
    this.original = original;
    this.canvas = canvas;
    this.textTarget = textTarget;
    this.onPreedit = onPreedit;
    this.onSettled = onSettled;
    this.onError = onError;
    this.queue = [];
    this.queuedBytes = 0;
    this.accepting = true;
    this.failed = false;
    this.inFlight = null;
    this.frame = null;
    this.listeners = [];
    this.composing = false;
    this.compositionSerial = 0;
    this.committedSerial = -1;
    this.pendingComposition = null;
    this.lastModifiers = modifiers({});
    this.claimed = false;
  }
  get ownsFocus() {
    return document.activeElement === this.canvas ||
      (!!this.textTarget && document.activeElement === this.textTarget);
  }
  get busy() { return Boolean(this.inFlight || this.queue.length || this.original.busy); }
  fail(error) {
    this.failed = true;
    this.accepting = false;
    this.onError(error);
  }
  listen(target, name, callback, options = {capture: true}) {
    const guarded = event => { try { callback(event); } catch (error) { this.fail(error); } };
    target.addEventListener(name, guarded, options);
    this.listeners.push(() => target.removeEventListener(name, guarded, options));
  }
  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    const state = this.original.latest;
    return {client_x: event.clientX, client_y: event.clientY,
      rect: {left: rect.left + this.canvas.clientLeft, top: rect.top + this.canvas.clientTop,
        width: this.canvas.clientWidth, height: this.canvas.clientHeight},
      window_width: state?.window_width || 0, window_height: state?.window_height || 0};
  }
  eventModifiers(event) {
    if (typeof event.ctrlKey === 'boolean' || typeof event.getModifierState === 'function')
      this.lastModifiers = modifiers(event);
    return this.lastModifiers;
  }
  apply(input, event = null) {
    if (this.failed) return null;
    const mapped = this.mapper.map(input);
    if (event && mapped.prevent_default && event.cancelable) event.preventDefault();
    if (event && mapped.stop_propagation) event.stopImmediatePropagation();
    if (mapped.composition) this.onPreedit(mapped.composition);
    if (mapped.packets.length) {
      const bytes = encoder.encode(JSON.stringify(mapped.packets)).length;
      if (this.queue.length + mapped.packets.length > 512 || this.queuedBytes + bytes > 1048576) {
        // Rust's held-state has already observed this actual event. A queue
        // failure requires a fresh host, never a dropped/replayed game action.
        throw new PhysicalInputError('input.error.queue');
      }
      this.queue.push(...mapped.packets);
      this.queuedBytes += bytes;
      if (!this.frame && !this.inFlight) this.frame = requestAnimationFrame(() => {
        this.frame = null;
        this.flush().catch(error => this.fail(error));
      });
    }
    return mapped;
  }
  commit(text, event) {
    if (!this.accepting || !this.ownsFocus || !text) return;
    this.apply({kind: 'text', owned_focus: true, text, modifiers: this.eventModifiers(event)}, event);
    if (this.textTarget) this.textTarget.value = '';
  }
  start() {
    if (this.claimed) throw new PhysicalInputError('input.error.host');
    this.original.claim('#' + CSS.escape(this.canvas.id));
    this.claimed = true;
    if (this.canvas.tabIndex < 0) this.canvas.tabIndex = 0;
    const key = phase => event => {
      if (phase === 'down' && !event.isComposing && event.key !== 'Process') this.pendingComposition = null;
      this.apply({kind: 'key', phase, key: event.key || '', code: event.code || '',
        legacy_key_code: event.keyCode || 0, location: event.location || 0,
        repeat: !!event.repeat, composing: !!event.isComposing || this.composing,
        modifiers: this.eventModifiers(event), owned_focus: this.accepting && this.ownsFocus,
        // Our explicit native text proxy owns physical keys. Other editable
        // elements are outside this application's input ownership.
        editable: !this.ownsFocus && !!event.target?.closest?.('input,textarea,[contenteditable="true"]')}, event);
    };
    this.listen(window, 'keydown', key('down'));
    this.listen(window, 'keyup', key('up'));
    this.listen(window, 'keypress', event => {
      if (!this.accepting || document.activeElement !== this.canvas || this.composing || event.isComposing) return;
      // Exact original SDK keypress charCode. No guessed text from keydown.
      if (event.charCode > 0) this.commit(String.fromCodePoint(event.charCode), event);
    });
    this.listen(this.canvas, 'mousedown', event => {
      if (!this.accepting) return;
      this.canvas.focus({preventScroll: true});
      this.apply({kind: 'mouse_button', phase: 'down', button: event.button,
        point: this.point(event), modifiers: this.eventModifiers(event), owned_focus: this.ownsFocus}, event);
    });
    this.listen(document, 'mouseup', event => {
      this.apply({kind: 'mouse_button', phase: 'up', button: event.button,
        point: this.point(event), modifiers: this.eventModifiers(event),
        owned_focus: this.accepting && this.ownsFocus}, event);
    });
    this.listen(this.canvas, 'mousemove', event => {
      this.apply({kind: 'mouse_motion', point: this.point(event),
        relative: document.pointerLockElement === this.canvas,
        movement_x: event.movementX || 0, movement_y: event.movementY || 0,
        buttons: event.buttons || 0, modifiers: this.eventModifiers(event),
        owned_focus: this.accepting && this.ownsFocus}, event);
    });
    this.listen(this.canvas, 'wheel', event => {
      this.apply({kind: 'wheel', point: this.point(event), delta_x: event.deltaX,
        delta_y: event.deltaY, delta_mode: event.deltaMode, modifiers: this.eventModifiers(event),
        owned_focus: this.accepting && this.ownsFocus}, event);
    }, {capture: true, passive: false});
    this.listen(window, 'blur', () => { this.composing = false; this.apply({kind: 'blur'}); });
    this.listen(document, 'focusin', () => {
      if (!this.ownsFocus) { this.composing = false; this.apply({kind: 'blur'}); }
    });
    if (this.textTarget) this.installTextEvents();
    return this.original.latest;
  }
  installTextEvents() {
    const target = this.textTarget;
    this.listen(target, 'compositionstart', event => {
      this.composing = true;
      ++this.compositionSerial;
      this.apply({kind: 'composition', owned_focus: this.accepting && this.ownsFocus,
        text: event.data || '', start: 0, length: (event.data || '').length}, event);
    });
    this.listen(target, 'compositionupdate', event => {
      this.apply({kind: 'composition', owned_focus: this.accepting && this.ownsFocus,
        text: event.data || '', start: 0, length: (event.data || '').length}, event);
    });
    this.listen(target, 'compositionend', event => {
      this.composing = false;
      const serial = this.compositionSerial, committed = event.data || '';
      this.pendingComposition = {serial, text: committed};
      this.apply({kind: 'composition', owned_focus: this.accepting && this.ownsFocus,
        text: '', start: 0, length: 0}, event);
      // A committed input event normally follows in the same task. The fallback
      // uses the actual DOM compositionend commit, never a preedit prediction.
      queueMicrotask(() => {
        if (this.failed || !this.accepting || !this.ownsFocus || this.committedSerial === serial) return;
        this.committedSerial = serial;
        try { this.commit(committed, event); } catch (error) { this.fail(error); }
      });
    });
    this.listen(target, 'input', event => {
      if (!this.accepting || !this.ownsFocus || event.isComposing || this.composing) return;
      const pending = this.pendingComposition;
      if (event.inputType === 'insertFromComposition' ||
          (pending && event.inputType === 'insertText' && event.data === pending.text)) {
        const serial = pending?.serial ?? this.compositionSerial;
        this.pendingComposition = null;
        if (this.committedSerial === serial) { target.value = ''; return; }
        this.committedSerial = serial;
      }
      // Input's UTF-8 payload is forwarded unchanged. Cursor/deletion remains
      // original KeyBind; this hidden/proxy DOM buffer is not an actor field.
      if (event.inputType?.startsWith('insert')) this.commit(event.data ?? target.value, event);
      else target.value = '';
    });
  }
  updateFocus(status) {
    if (!this.ownsFocus || !this.accepting || !this.textTarget) return;
    if (status.focused_unicode === 1) this.textTarget.focus({preventScroll: true});
    else if (status.focused_unicode === 0 || status.dialog_count === 0) this.canvas.focus({preventScroll: true});
    // Unknown nested component/keyhandler stays unknown; no class/name guess.
  }
  async flush() {
    if (this.failed) throw new PhysicalInputError('input.error.host');
    if (this.inFlight) return this.inFlight;
    if (this.frame) { cancelAnimationFrame(this.frame); this.frame = null; }
    this.inFlight = (async () => {
      while (this.queue.length) {
        const packets = this.queue.splice(0);
        this.queuedBytes = 0;
        const status = await this.original.dispatch(packets);
        // Root may run one explicitly effectful original frame and refresh the
        // actual snapshot here. Keep input/save/native actions single-flight.
        await this.onSettled(status);
        this.updateFocus(this.original.status());
      }
    })();
    try { await this.inFlight; }
    catch (error) { this.fail(error); throw error; }
    finally { this.inFlight = null; }
    return this.original.latest;
  }
  async suspendAndDrain() {
    this.accepting = false;
    this.composing = false;
    this.apply({kind: 'blur'});
    await this.flush();
    if (this.original.busy) throw new PhysicalInputError('error.physical.busy');
    // Only now may the existing, stronger full-save controller acquire its
    // checkpoint gate and settle pending original display work/serialization.
    return this.original.latest;
  }
  resume() {
    const status = this.original.status();
    if (this.failed || status.busy || status.checkpoint_busy)
      throw new PhysicalInputError('error.physical.busy', status);
    this.accepting = true;
    this.updateFocus(status);
  }
  async dispose() {
    await this.suspendAndDrain();
    for (const remove of this.listeners.splice(0)) remove();
    // Native SDL callbacks stay claimed. Dispose does not silently reinstall
    // them; a fresh native module is required for another input owner.
  }
}
