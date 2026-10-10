import { EventEmitter } from 'node:events';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function until(callback, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await callback();
    if (result) return result;
    await delay(250);
  }
  throw new Error('Timed out: ' + label);
}

export class CDP extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    socket.addEventListener('message', event => {
      const packet = JSON.parse(event.data);
      if (packet.id) {
        const pending = this.pending.get(packet.id);
        if (!pending) return;
        this.pending.delete(packet.id);
        clearTimeout(pending.timer);
        packet.error ? pending.reject(new Error(JSON.stringify(packet.error))) : pending.resolve(packet.result);
      } else {
        this.events.push(packet);
        if (this.events.length > 5000) this.events.shift();
        this.emit(packet.method, packet.params);
      }
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Owned Chrome CDP connection closed.'));
      }
      this.pending.clear();
    });
  }
  call(method, params = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP timeout: ' + method));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, timeout = 30000) {
    const value = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeout);
    if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails));
    return value.result.value;
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new CDP(socket);
  }
}

// Deliver actual browser input to SDL; synthetic shell helpers are tested separately.
export async function key(cdp, value) {
  const specials = {
    Enter: ['Enter', 13], Escape: ['Escape', 27], Tab: ['Tab', 9],
    ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38],
    ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40],
    Backspace: ['Backspace', 8], ' ': ['Space', 32],
    '.': ['Period', 190], '?': ['Slash', 191], '/': ['Slash', 191],
    '<': ['Comma', 188], ',': ['Comma', 188], '>': ['Period', 190],
    '|': ['Backslash', 220], '\\': ['Backslash', 220],
    Home: ['Home', 36], End: ['End', 35], Delete: ['Delete', 46],
    PageUp: ['PageUp', 33], PageDown: ['PageDown', 34],
    ':': ['Semicolon', 186], ';': ['Semicolon', 186],
    '_': ['Minus', 189], '-': ['Minus', 189], '+': ['Equal', 187], '=': ['Equal', 187],
    '&': ['Digit7', 55], '*': ['Digit8', 56], '!': ['Digit1', 49],
    '@': ['Digit2', 50], '#': ['Digit3', 51], '$': ['Digit4', 52], '%': ['Digit5', 53]
  };
  const shifted = value.length === 1 && value !== value.toLowerCase() || ['?', '<', '>', '|', ':', '_', '+', '&', '*', '!', '@', '#', '$', '%'].includes(value);
  const [code, vk] = specials[value] || [/^[0-9]$/.test(value) ? 'Digit' + value : 'Key' + value.toUpperCase(), value.toUpperCase().charCodeAt(0)];
  const params = { key: value, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: shifted ? 8 : 0 };
  if (value.length === 1 || value === 'Enter') params.text = value === 'Enter' ? '\r' : value;
  await cdp.call('Input.dispatchKeyEvent', { ...params, type: 'keyDown' });
  await cdp.call('Input.dispatchKeyEvent', { ...params, type: 'keyUp', text: undefined });
}
