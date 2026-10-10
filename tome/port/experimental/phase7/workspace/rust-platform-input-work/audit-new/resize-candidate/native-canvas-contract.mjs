/* GPL-3.0-or-later. Source-only fresh-canvas identity/admission candidate. */
const activeLeases = new WeakMap();
function fault(id) {
  const error = new Error(id);
  error.textId = id;
  throw error;
}
function canvasInCurrentDocument(canvas) {
  return typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined'
    && canvas instanceof HTMLCanvasElement && canvas.ownerDocument === document;
}

/** Establish the SDK's real selector identity BEFORE factory/native init.
 * This deliberately changes only a fresh DOM element's id. Keep the captured
 * canvas object for factory/host references; update variant CSS selectors too.
 */
export function prepareFreshNativeCanvas(canvas, {freshDocument} = {}) {
  if (freshDocument !== true || !canvasInCurrentDocument(canvas) || activeLeases.has(canvas)) fault('platform.resize.fresh');
  const originalId = canvas.getAttribute('id');
  const matches = [...document.querySelectorAll('#canvas')];
  if (matches.length > 1 || (matches.length === 1 && matches[0] !== canvas)) fault('platform.resize.selector');
  let initStarted = false;
  const token = {};
  activeLeases.set(canvas, token);
  canvas.id = 'canvas';
  if (document.querySelector('#canvas') !== canvas) fault('platform.resize.selector');
  return Object.freeze({
    canvas, originalId,
    beforeNativeInit(module) {
      if (initStarted || activeLeases.get(canvas) !== token || !module || module.canvas !== canvas || document.querySelector('#canvas') !== canvas) fault('platform.resize.fresh');
      if (module.ccall('tome_platform_canvas_fresh', 'number', [], []) !== 1) fault('platform.resize.fresh');
      // Lock before calling native init, including a partially failed initializer.
      initStarted = true;
    },
    rollbackBeforeInit() {
      if (initStarted || activeLeases.get(canvas) !== token || document.querySelector('#canvas') !== canvas) fault('platform.resize.fresh');
      if (originalId === null) canvas.removeAttribute('id'); else canvas.setAttribute('id', originalId);
      activeLeases.delete(canvas);
    },
  });
}

export function readNativeDisplayContract(module) {
  const text = module.ccall('tome_platform_display_contract', 'string', [], []);
  if (!text) fault('platform.resize.unavailable');
  let contract;
  try { contract = JSON.parse(text); } catch { fault('platform.resize.unavailable'); }
  if (!contract || contract.protocol !== 1 || contract.error_id) fault('platform.resize.unavailable');
  return Object.freeze(contract);
}

const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
// Exact original C float division, then promotion to Lua number. Do not hide
// mismatches behind an arbitrary geometric tolerance or integer rounding.
const logicalSize = (physical, zoom) => Math.fround(Math.fround(physical) / Math.fround(zoom));

/** Pointer admission at a completed ORIGINAL root-frame boundary only.
 * Queries never resize the buffer/window, dispatch input, draw, tick, or repair
 * original Game fields. Use outside the independent Rust-only purity bracket.
 */
export function assertNativeDisplayContract(canvas, contract, physicalStatus) {
  if (!canvasInCurrentDocument(canvas) || canvas.id !== 'canvas'
      || document.querySelector('#canvas') !== canvas || contract.selector_matches !== true) fault('platform.resize.selector');
  if (contract.input_busy !== false || contract.checkpoint_busy !== false) fault('platform.resize.busy');
  const widths = [contract.window_width, contract.screen_width, contract.canvas_width,
    contract.drawing_buffer_width, canvas.width];
  const heights = [contract.window_height, contract.screen_height, contract.canvas_height,
    contract.drawing_buffer_height, canvas.height];
  if (!widths.every(positiveInteger) || !heights.every(positiveInteger)
      || !widths.every(value => value === widths[0]) || !heights.every(value => value === heights[0])) fault('platform.resize.dimensions');
  const viewport = contract.viewport;
  if (contract.context_matches !== true || contract.framebuffer_default !== true
      || !Array.isArray(viewport) || viewport.length !== 4 || viewport[0] !== 0 || viewport[1] !== 0
      || viewport[2] !== widths[0] || viewport[3] !== heights[0]) fault('platform.resize.viewport');
  if (!Number.isFinite(contract.screen_zoom) || contract.screen_zoom <= 0
      || contract.logical_width !== logicalSize(widths[0], contract.screen_zoom)
      || contract.logical_height !== logicalSize(heights[0], contract.screen_zoom)
      || contract.game_known !== true || contract.game_width !== contract.logical_width
      || contract.game_height !== contract.logical_height) fault('platform.resize.logical');
  if (!physicalStatus || physicalStatus.protocol !== 1 || physicalStatus.busy !== false
      || physicalStatus.checkpoint_busy !== false || physicalStatus.window_width !== widths[0]
      || physicalStatus.window_height !== heights[0]) fault('platform.resize.busy');
  return Object.freeze({width:widths[0], height:heights[0], zoom:contract.screen_zoom});
}

/** Supply the existing physical host's unchanged point mapper as `mapPoint`.
 * The gate invokes it once after proving the dimensions from actual native
 * state. Do not add an extra SDL motion/button or synthetic resize here.
 */
export function admittedPointerPoint({module, canvas, physicalStatus}, mapPoint) {
  if (typeof mapPoint !== 'function') fault('platform.resize.unavailable');
  assertNativeDisplayContract(canvas, readNativeDisplayContract(module), physicalStatus);
  return mapPoint();
}
