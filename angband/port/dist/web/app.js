import { drawFrame, frameText, immutableFrame, immutableState, interpolate, keyboardInput, packKey, parseSeed, nativeMouseButton } from './core.js';
import { MAX_SAVE_BYTES, SaveError, exportRecord, importRecord, makeSaveRecord, openSaveDatabase, readSave, validateSaveRecord, writeSave } from './storage.js';
import { EMPTY_PRESENTATION_MODEL, parsePresentationModel, renderPresentationModel, renderPresentationMessages } from './semantic-view.js';

const $ = id => document.getElementById(id);
const canvas = $('terminal');
$('font-size').value = window.matchMedia('(max-width: 700px)').matches ? '12' : '16';
const errors = [];
const runtimeOutput = [];
const characterExports = [];
let dictionaries, gameDictionaries = { en: {}, ja: {} }, build, database, saveRecord;
let locale = 'ja';
let worker = null, active = false, loading = false, currentSeed = 1, latestFrame = null, latestState = null, epoch = 0;
let startRequest = 0;
let statusMessage = { id: 'status.ready', params: {}, error: false };
let latestPresentation = EMPTY_PRESENTATION_MODEL;
let saveQueue = Promise.resolve();
let pendingSave = null;
let textComposing = false, textUsedIme = false, pendingText = null;
let redrawCount = 0;
let adapterDiagnostics = null;
let sourceDiagnostics = null;
const t = (id, params = {}) => interpolate(dictionaries?.[locale]?.[id] || dictionaries?.en?.[id] || id, params);

function status(id, params = {}, error = false) {
  statusMessage = { id, params, error };
  $('status').textContent = t(id, params);
  $('status').dataset.error = String(error);
}
function recordError(error, id = 'status.error') {
  const detail = error?.message || String(error);
  errors.push(detail);
  status(error instanceof SaveError ? error.id : id, { detail }, true);
}
function updateControls() {
  $('new-game').disabled = loading || !build;
  $('resume').disabled = loading || !saveRecord;
  $('save').disabled = !active || loading || !database || Boolean(pendingSave);
  $('export-save').disabled = !saveRecord;
  document.querySelectorAll('[data-code]').forEach(button => { button.disabled = !active || loading || Boolean(pendingSave); });
  $('text-entry').querySelector('button').disabled = !active || loading || Boolean(pendingSave);
  $('game-text').disabled = Boolean(pendingSave);
}
function renderSaveInfo() {
  $('save-info').textContent = saveRecord ? t('save.info', {
    date: new Date(saveRecord.savedAt).toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US'),
    bytes: saveRecord.payloadLength
  }) : t('save.none');
}
function renderState() {
  $('game-state').textContent = latestPresentation.locale === locale ? latestPresentation.state_summary : '';
}
function renderMessages() {
  const dictionary = gameDictionaries[locale];
  renderPresentationMessages($('localized-log'), latestPresentation.locale === locale ? latestPresentation : EMPTY_PRESENTATION_MODEL);
  $('message-coverage').textContent = t('messages.coverage', { count: Object.keys(dictionary).length, missing: latestPresentation.missing_ids.length });
}
function renderSemantic() {
  renderPresentationModel($('semantic-panels'), latestPresentation.locale === locale ? latestPresentation : EMPTY_PRESENTATION_MODEL, send, document, sendNativeMouse);
}
function renderLanguage() {
  document.documentElement.lang = locale;
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-title]').forEach(element => { element.title = t(element.dataset.i18nTitle); });
  status(statusMessage.id, statusMessage.params, statusMessage.error);
  renderState();
  renderSaveInfo();
  renderMessages();
  renderSemantic();
}
function redraw() {
  drawFrame(canvas, latestFrame, { fontSize: Number($('font-size').value), pixelRatio: Math.min(window.devicePixelRatio || 1, 3) });
  redrawCount++;
}
function send(code, mods = 0, origin = 'keyboard') {
  if (!active || loading || pendingSave || !worker) return false;
  if (typeof code === 'string') {
    if ([...code].length === 1) code = code.codePointAt(0);
    else return false;
  }
  const packed = packKey(code, mods);
  if (packed === null) return false;
  worker.postMessage({ type: 'key', payload: packed, origin });
  return true;
}
function sendNativeMouse(mouse) {
  if (!active || loading || pendingSave || !worker || !latestFrame || mouse.x<0 || mouse.x>=latestFrame.width || mouse.y<0 || mouse.y>=latestFrame.height || mouse.button!==1 || mouse.mods!==0) return false;
  worker.postMessage({type:'event',payload:{kind:'mouse',...mouse}});return true;
}
function downloadCharacter(payload) {
  if (!payload || !['en','ja'].includes(payload.locale) || typeof payload.text!=='string' || payload.text.includes('\0') ||
      new TextEncoder().encode(payload.text).length>8*1024*1024 || payload.filename!==`angband-character-${payload.locale}.txt`) throw new Error('export.capture_rejected');
  characterExports.push(Object.freeze({...payload}));if(characterExports.length>8)characterExports.shift();
  const url=URL.createObjectURL(new Blob([payload.text],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=payload.filename;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);status('export.character_saved');
}
async function acceptSave(payload, sessionSeed, originatingEpoch) {
  try {
    const record = await makeSaveRecord(payload, build, sessionSeed);
    await writeSave(database, record);
    saveRecord = record;
    if (originatingEpoch === epoch) status('status.saved');
    renderSaveInfo();
    updateControls();
  } catch (error) { recordError(error, 'save.unavailable'); }
}
function cancelPendingSave() {
  pendingSave?.resolve(null);
  pendingSave = null;
}
async function start(seed, resume = false) {
  if (loading || !build) return false;
  if (seed === null || seed < 0 || seed > 0xffffffff || !Number.isInteger(seed)) {
    status('session.invalid_seed', {}, true);
    return false;
  }
  const request = ++startRequest;
  loading = true;
  updateControls();
  let bytes;
  if (resume) {
    const selectedSave = saveRecord;
    try { bytes = (await validateSaveRecord(selectedSave, build)).slice(); }
    catch (error) {
      if (request === startRequest) { loading = false; updateControls(); recordError(error); }
      return false;
    }
    seed = selectedSave.seed;
    $('seed').value = String(seed);
  }
  if (request !== startRequest) return false;
  epoch++;
  const runEpoch = epoch;
  cancelPendingSave();
  worker?.terminate();
  currentSeed = seed;
  $('seed').value = String(seed);
  active = false;
  loading = true;
  latestState = null;
  latestPresentation = EMPTY_PRESENTATION_MODEL;
  latestFrame = immutableFrame({ width: 100, height: 32, cells: Array.from({ length: 3200 }, () => [32, 1]), cursor: [-1, -1] });
  redraw();
  renderState();
  renderMessages();
  renderSemantic();
  status('status.loading');
  updateControls();
  worker = new Worker(new URL('./worker.js', import.meta.url));
  worker.onerror = event => {
    if (runEpoch !== epoch) return;
    active = loading = false;
    cancelPendingSave();
    recordError(new Error(event.message || 'Worker error'), 'status.failed');
    updateControls();
  };
  worker.onmessage = event => {
    if (runEpoch !== epoch) return;
    const { type, payload } = event.data;
    try {
      if (type === 'ready') {
        active = true;
        loading = false;
        status('status.running');
        updateControls();
        canvas.focus({ preventScroll: true });
      } else if (type === 'frame') {
        latestFrame = immutableFrame(payload);
        $('terminal-text').textContent = frameText(latestFrame);
        redraw();
      } else if (type === 'state') {
        latestState = immutableState(payload);
        renderState();
      } else if (type === 'source-diagnostics') {
        sourceDiagnostics = Object.freeze({...payload});
      } else if (type === 'diagnostics') {
        adapterDiagnostics = Object.freeze({...payload});
      } else if (type === 'output') {
        runtimeOutput.push(String(payload).slice(0,8192));
        if(runtimeOutput.length>128)runtimeOutput.shift();
      } else if (type === 'presentation') {
        latestPresentation = parsePresentationModel(payload);
        renderState();
        renderSemantic();
        renderMessages();
      } else if (type === 'character-export') {
        downloadCharacter(payload);
      } else if (type === 'semantic-error') {
        // Developer evidence is retained without replacing native gameplay.
        errors.push(`semantic: ${String(payload)}`);
      } else if (type === 'save') {
        if (pendingSave?.epoch === runEpoch) {
          pendingSave.resolve({ payload, seed, epoch: runEpoch });
          pendingSave = null;
        } else saveQueue = saveQueue.then(() => acceptSave(payload, seed, runEpoch));
        updateControls();
      } else if (type === 'save-error') {
        cancelPendingSave();
        status(payload in dictionaries.en ? payload : 'save.failed', {}, true);
        updateControls();
      } else if (type === 'error') {
        active = loading = false;
        cancelPendingSave();
        const id = payload.startsWith('save.') ? payload : 'status.failed';
        recordError(new Error(payload), id);
        updateControls();
      } else if (type === 'text-accepted') {
        if ($('game-text').value === pendingText) $('game-text').value = '';
        pendingText = null; textUsedIme = false;
        sendDraft();
      } else if (type === 'input-error') {
        pendingText = null;
        status(payload in dictionaries.en ? payload : 'input.rejected', {}, true);
      } else if (type === 'draft') {
        restoreDraft(payload);
      } else if (type === 'ended') {
        active = loading = false;
        cancelPendingSave();
        status('status.ended');
        updateControls();
      }
    } catch (error) { recordError(error); }
  };
  const payload = { seed, resume, locale, save: bytes?.buffer };
  worker.postMessage({ type: 'start', payload }, bytes ? [bytes.buffer] : []);
  return true;
}
function requestSave() {
  if (!active || loading || !database || pendingSave) return false;
  let resolveSave;
  const response = new Promise(resolve => { resolveSave = resolve; });
  pendingSave = { resolve: resolveSave, epoch };
  // Reserve persistence order now, before the worker finishes creating the save.
  saveQueue = saveQueue.then(async () => {
    const packet = await response;
    if (packet) await acceptSave(packet.payload, packet.seed, packet.epoch);
  });
  status('status.saving');
  updateControls();
  worker.postMessage({ type: 'save' });
  return true;
}
canvas.addEventListener('keydown', event => {
  const packed = keyboardInput(event);
  if (packed === null || !active || loading || pendingSave) return;
  // Shift+Tab remains available to leave the terminal using the keyboard.
  if (event.key === 'Tab' && event.shiftKey) return;
  event.preventDefault();
  worker.postMessage({ type: 'key', payload: packed });
});
canvas.addEventListener('pointerdown', event => {
  canvas.focus({ preventScroll: true });
  if (event.pointerType !== 'mouse' || !active || loading || pendingSave || !latestFrame) return;
  const bounds = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - bounds.left) * latestFrame.width / bounds.width);
  const y = Math.floor((event.clientY - bounds.top) * latestFrame.height / bounds.height);
  if (x < 0 || x >= latestFrame.width || y < 0 || y >= latestFrame.height) return;
  const button = nativeMouseButton(event.button);
  if (button) worker.postMessage({type: 'event', payload: {kind: 'mouse', x, y, button,
    mods: (event.ctrlKey ? 1 : 0) | (event.shiftKey ? 2 : 0) | (event.altKey ? 4 : 0) | (event.metaKey ? 8 : 0)}});
});
document.querySelectorAll('[data-code]').forEach(button => button.addEventListener('click', () => send(Number(button.dataset.code), 0, 'touch')));
function sendDraft() {
  if (!worker || !active || loading || pendingSave) return;
  const field = $('game-text');
  worker.postMessage({type: 'draft', payload: {text: field.value, composing: textComposing,
    selectionStart: field.selectionStart, selectionEnd: field.selectionEnd,
    selectionDirection: field.selectionDirection, focused: document.activeElement === field}});
}
function restoreDraft(draft) {
  if (!draft || typeof draft.text !== 'string' || new TextEncoder().encode(draft.text).length > 65536) return;
  const field = $('game-text');
  field.value = draft.text;
  textComposing = false;
  textUsedIme = Boolean(draft.composing);
  if (Number.isInteger(draft.selectionStart) && Number.isInteger(draft.selectionEnd))
    field.setSelectionRange(draft.selectionStart, draft.selectionEnd, draft.selectionDirection ?? 'none');
  if (draft.focused) field.focus({preventScroll: true});
}
$('game-text').addEventListener('compositionstart', () => {textComposing = true; textUsedIme = true; sendDraft();});
$('game-text').addEventListener('compositionend', () => {textComposing = false; sendDraft();});
for (const name of ['input', 'select', 'focus', 'blur']) $('game-text').addEventListener(name, sendDraft);
$('text-entry').addEventListener('submit', event => {
  event.preventDefault();
  if (!active || loading || pendingSave || textComposing || pendingText !== null) return;
  const draftText = $('game-text').value;
  if (latestPresentation.input_max_bytes !== undefined && latestPresentation.input_max_bytes !== null && new TextEncoder().encode(draftText).length > latestPresentation.input_max_bytes) {
    status('input.too_long', {}, true);
    return;
  }
  pendingText = draftText;
  worker.postMessage({type: 'text', payload: {text: pendingText, origin: textUsedIme ? 3 : 2}});
});
$('new-game').addEventListener('click', () => {
  if (active && !window.confirm(t('session.confirm_new'))) return;
  void start(parseSeed($('seed').value));
});
$('resume').addEventListener('click', () => {
  if (active && !window.confirm(t('session.confirm_new'))) return;
  void start(saveRecord.seed, true);
});
$('save').addEventListener('click', requestSave);
$('language').addEventListener('change', () => {
  locale = $('language').value === 'en' ? 'en' : 'ja';
  try { localStorage.setItem('angband.language', locale); } catch {}
  worker?.postMessage({ type: 'locale', payload: locale });
  renderLanguage();
});
$('font-size').addEventListener('change', redraw);
window.addEventListener('resize', redraw);
$('export-save').addEventListener('click', () => {
  if (!saveRecord) return;
  const url = URL.createObjectURL(new Blob([exportRecord(saveRecord)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `angband-${build.engineVersion}-${saveRecord.savedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import-save').addEventListener('change', async () => {
  const file = $('import-save').files[0];
  if (!file) return;
  saveQueue = saveQueue.then(async () => {
    try {
      if (file.size > MAX_SAVE_BYTES * 1.4 + 4096) throw new SaveError('save.too_large');
      const record = importRecord(await file.text());
      await validateSaveRecord(record, build);
      if (!database) throw new Error('IndexedDB unavailable');
      await writeSave(database, record);
      saveRecord = record;
      status('status.imported');
      renderSaveInfo();
      updateControls();
    } catch (error) { recordError(error); }
  });
  await saveQueue;
  $('import-save').value = '';
});
window.__angbandTest = {
  get frame() { return latestFrame; }, get state() { return latestState; },
  get errors() { return [...errors]; }, get ready() { return Boolean(build && dictionaries); },
  get running() { return active; }, get redrawCount() { return redrawCount; },
  get saveRecord() { return saveRecord ? { ...saveRecord, payload: undefined } : null; },
  get messageIds() { return latestPresentation.message_ids; },
  get semantic() { return latestPresentation.semantic; },
  get presentation() { return latestPresentation; },
  get diagnostics() { return adapterDiagnostics; },
  get sourceDiagnostics() { return sourceDiagnostics; },
  get output() { return [...runtimeOutput]; },
  get characterExports() { return characterExports.map(value=>({...value})); },
  inspectAdapters: () => { adapterDiagnostics=null;sourceDiagnostics=null;worker?.postMessage({type:'diagnostics'}); },
  redraw, send, start, save: requestSave, text: () => frameText(latestFrame),
  resize: (width, height) => { if (worker && active && !pendingSave) worker.postMessage({type:'event',payload:{kind:'resize',width,height}}); },
  exportSave: () => saveRecord ? exportRecord(saveRecord) : null
};
async function loadJson(path, optional = false) {
  const response = await fetch(path);
  if (optional && response.status === 404) return {};
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
try {
  const values = await Promise.all([
    loadJson('./i18n/en.json'), loadJson('./i18n/ja.json'), loadJson('./build-info.json'),
    loadJson('../locales/game-en.json', true), loadJson('../locales/game-ja.json', true)
  ]);
  dictionaries = { en: values[0], ja: values[1] };
  build = Object.freeze(values[2]);
  gameDictionaries = { en: values[3].messages ?? values[3], ja: values[4].messages ?? values[4] };
  try { locale = localStorage.getItem('angband.language') === 'en' ? 'en' : 'ja'; } catch {}
  $('language').value = locale;
  $('build-version').textContent = build.engineVersion;
  $('source-commit').textContent = `${build.upstreamCommit.slice(0, 12)}`;
  renderLanguage();
  try {
    database = await openSaveDatabase();
    const stored = await readSave(database);
    if (stored) { await validateSaveRecord(stored, build); saveRecord = stored; }
    renderSaveInfo();
  } catch (error) { recordError(error, 'save.unavailable'); }
  updateControls();
} catch (error) { recordError(error, 'status.failed'); }
