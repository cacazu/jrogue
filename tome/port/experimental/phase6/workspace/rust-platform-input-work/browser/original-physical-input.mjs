// SPDX-License-Identifier: GPL-3.0-or-later
import {PhysicalInputError} from './physical-input-wasm.mjs';
const numeric = count => Array(count).fill('number');
const nextTurn = () => new Promise(resolve => setTimeout(resolve, 0));

export class OriginalPhysicalInput {
  constructor(module, {onStatus = () => {}, yieldTurn = nextTurn} = {}) {
    if (typeof module.ccall !== 'function') throw new PhysicalInputError('input.error.abi');
    this.module = module;
    this.onStatus = onStatus;
    this.yieldTurn = yieldTurn;
    this.sequence = 0;
    this.running = false;
    this.latest = null;
  }
  call(name, types = [], values = []) {
    // ccall copies this C-owned borrowed/reused buffer immediately. No pointer
    // is retained, freed, or read after another original bridge call.
    const raw = this.module.ccall('tome_physical_' + name, 'string', types, values);
    let status;
    try { status = JSON.parse(raw); }
    catch { throw new PhysicalInputError('input.error.abi'); }
    if (status.protocol !== 1 || typeof status.phase !== 'string' || typeof status.busy !== 'boolean')
      throw new PhysicalInputError('input.error.abi');
    this.latest = status;
    this.onStatus(status);
    if (status.error_id) throw new PhysicalInputError(status.error_id, status);
    return status;
  }
  prepare() { return this.call('prepare'); }
  claim(canvasSelector) { return this.call('claim', ['string'], [canvasSelector]); }
  status() { return this.call('status'); }
  backendState() {
    let state;
    try { state = JSON.parse(this.module.ccall('tome_physical_backend_state', 'string', [], [])); }
    catch { throw new PhysicalInputError('input.error.abi'); }
    if (state.protocol !== 1 || state.error_id || !Array.isArray(state.pressed_scancodes))
      throw new PhysicalInputError(state.error_id || 'input.error.abi');
    return state;
  }
  get busy() { return this.running || Boolean(this.latest?.busy); }
  async collect(status, sequence) {
    while (status.phase === 'draining') {
      await this.yieldTurn();
      status = this.call('pump', numeric(2), [sequence, 16]);
    }
    if (status.phase !== 'collecting') throw new PhysicalInputError('input.error.abi', status);
    return status;
  }
  packet(sequence, p) {
    switch (p.kind) {
      case 'key': return this.call('key', numeric(5), [sequence, +p.down, p.scancode, p.keycode, p.modifiers]);
      case 'text': return this.call('text', ['number', 'string', 'number'], [sequence, p.text, p.modifiers]);
      case 'mouse_motion': return this.call('motion', numeric(5), [sequence, +p.relative, p.x, p.y, p.modifiers]);
      case 'mouse_button': return this.call('button', numeric(6), [sequence, +p.down, p.button, p.x, p.y, p.modifiers]);
      case 'wheel': return this.call('wheel', numeric(6), [sequence, p.x, p.y, p.mouse_x, p.mouse_y, p.modifiers]);
      default: throw new PhysicalInputError('input.error.abi');
    }
  }
  async dispatch(packets) {
    if (this.busy) throw new PhysicalInputError('error.physical.busy', this.latest);
    if (!Array.isArray(packets) || !packets.length || packets.length > 512)
      throw new PhysicalInputError('input.error.queue');
    if (this.sequence >= 0xffffffff) throw new PhysicalInputError('input.error.sequence');
    const sequence = ++this.sequence;
    this.running = true;
    try {
      let status = await this.collect(this.call('begin', numeric(1), [sequence]), sequence);
      for (const packet of packets) status = await this.collect(this.packet(sequence, packet), sequence);
      status = this.call('end', numeric(1), [sequence]);
      let pumps = 0;
      while (status.phase === 'ticking') {
        if (++pumps > 12000) throw new PhysicalInputError('input.error.pump_budget', status);
        await this.yieldTurn();
        status = this.call('pump', numeric(2), [sequence, 16]);
      }
      if (status.phase !== 'complete' || status.busy || status.tick_end_pending !== 0 || !status.tick_paused)
        throw new PhysicalInputError('input.error.abi', status);
      return status;
    } finally { this.running = false; }
  }
}
