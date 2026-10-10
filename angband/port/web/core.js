// Presentation and input mapping contain no simulation, clock, or RNG calls.
export const KEYS = Object.freeze({
  ArrowDown: 0x80, ArrowLeft: 0x81, ArrowRight: 0x82, ArrowUp: 0x83,
  F1: 0x84, F2: 0x85, F3: 0x86, F4: 0x87, F5: 0x88, F6: 0x89,
  F7: 0x8a, F8: 0x8b, F9: 0x8c, F10: 0x8d, F11: 0x8e, F12: 0x8f,
  Home: 0x94, PageUp: 0x95, End: 0x96, PageDown: 0x97, Insert: 0x98, Pause: 0x99,
  Enter: 0x9c, Tab: 0x9d, Delete: 0x9e, Backspace: 0x9f, Escape: 0xe000
});
export const PALETTE = Object.freeze([
  '#000000', '#ffffff', '#808080', '#ff8000', '#c00000', '#008040', '#0040ff', '#804000',
  '#606060', '#c0c0c0', '#ff00ff', '#ffff00', '#ff4040', '#00ff00', '#00ffff', '#c08040',
  '#900090', '#9020ff', '#00a0a0', '#6c6c30', '#ffff90', '#ff00a0', '#20ffdc', '#b8a8ff',
  '#ff8080', '#b4b400', '#a0c0d0', '#00b0ff', '#282828'
]);
export function packKey(code, mods = 0) {
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return null;
  if (!Number.isInteger(mods) || mods < 0 || mods > 31) return null;
  return code | (mods << 21);
}
export function keyboardInput(event) {
  if (event.isComposing || event.key === 'Process' || event.key === 'Dead') return null;
  let code = KEYS[event.key];
  if (code === undefined && [...(event.key || '')].length === 1) code = event.key.codePointAt(0);
  if (code === undefined) return null;
  let mods = (event.ctrlKey ? 1 : 0) | (event.altKey ? 4 : 0) | (event.metaKey ? 8 : 0);
  // Printable characters already contain Shift; special keys retain its modifier.
  if (event.shiftKey && (KEYS[event.key] !== undefined || event.location === 3)) mods |= 2;
  if (event.location === 3) mods |= 16;
  if (event.location !== 3 && (mods & 1) && ((code >= 0x40 && code <= 0x5f) || (code >= 0x61 && code <= 0x7a))) {
    code &= 31;
    mods &= ~1;
  }
  return packKey(code, mods);
}
export function immutableFrame(input) {
  if (typeof input === 'string') input = JSON.parse(input);
  const { width, height } = input || {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 255 || height > 255) throw new Error('Invalid terminal size');
  if (!Array.isArray(input.cells) || input.cells.length !== width * height) throw new Error('Invalid terminal cells');
  const cells = input.cells.map(cell => {
    if (!Array.isArray(cell) || !Number.isInteger(cell[0]) || cell[0] < 0 || cell[0] > 0x10ffff || !Number.isInteger(cell[1])) throw new Error('Invalid terminal cell');
    return Object.freeze([cell[0], cell[1]]);
  });
  const cursor = Array.isArray(input.cursor) && input.cursor.length >= 2 ? Object.freeze([input.cursor[0], input.cursor[1]]) : null;
  return Object.freeze({ width, height, cells: Object.freeze(cells), cursor });
}
export function immutableState(input) {
  const state = structuredClone(typeof input === 'string' ? JSON.parse(input) : input);
  const freeze = value => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  return freeze(state);
}
export function frameText(frame) {
  if (!frame) return '';
  const rows = [];
  for (let y = 0; y < frame.height; y++) {
    rows.push(frame.cells.slice(y * frame.width, (y + 1) * frame.width).map(([code]) => code >= 32 ? String.fromCodePoint(code) : ' ').join('').trimEnd());
  }
  return rows.join('\n');
}
export function drawFrame(canvas, frame, { fontSize = 16, pixelRatio = 1 } = {}) {
  if (!frame) return;
  const cellWidth = Math.ceil(fontSize * 0.625), cellHeight = Math.ceil(fontSize * 1.2);
  const width = frame.width * cellWidth, height = frame.height * cellHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${fontSize}px Consolas, "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    const [code, color] = frame.cells[y * frame.width + x];
    if (code <= 32) continue;
    ctx.fillStyle = PALETTE[((color % PALETTE.length) + PALETTE.length) % PALETTE.length];
    ctx.fillText(String.fromCodePoint(code), x * cellWidth, y * cellHeight + cellHeight / 2, cellWidth);
  }
  const [cx, cy] = frame.cursor || [-1, -1];
  if (cx >= 0 && cx < frame.width && cy >= 0 && cy < frame.height) {
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(cx * cellWidth, (cy + 1) * cellHeight - 2, cellWidth, 1);
  }
}
export function interpolate(template, params = {}) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (token, key) => Object.hasOwn(params, key) ? String(params[key]) : token);
}
export function parseSeed(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (!/^\d+$/.test(String(value))) return null;
  const seed = Number(value);
  return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff ? seed : null;
}

// Original Angband mouse policy: 1 left, 2 right/escape, 3 middle.
export function nativeMouseButton(domButton) {
  return domButton === 0 ? 1 : domButton === 2 ? 2 : domButton === 1 ? 3 : 0;
}
