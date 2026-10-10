import {RegisteredCatalog} from './registered-catalog-host.mjs';
/* NetHack browser adapter, changed 2026-10-02.
 * Distributed under the NetHack General Public License; see ../LICENSE. */
export const SOURCE_COMMIT = '16ff59115315917b93185d026aeefea06db9b0f4';
export const HOST_ABI = 'nethack-shim-5.0.0-v1';
export const COLORS = ['#777777','#ef6a6a','#6acb76','#cda15d','#719cfa','#d988ec','#62cbd3','#c5c8ce','#c5c8ce','#ffad57','#a3ec83','#f0d978','#9cb9ff','#f4a8ff','#9aeaf0','#ffffff'];

// Source catalog IDs have English segments and may end in one exact hash.
const TEXT_ID = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*(?:\.[0-9][0-9a-f]{9})?$/;
const ARGUMENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const utf8Bytes = value => new TextEncoder().encode(value).length;
const SEMANTIC_JSON_LIMIT = 256 * 1024;
/** Own the source-selected values before native buffers can be reused. */
export function immutableTextEvent(event) {
  return ownTextEvent(event,0,new WeakSet(),{nodes:0,arguments:0,textBytes:0});
}
function chargeText(budget,value) {
  budget.textBytes += utf8Bytes(value);
  if (budget.textBytes > SEMANTIC_JSON_LIMIT) throw new Error('Semantic text tree exceeds byte limit');
}
function ownTextEvent(event,depth,active,budget) {
  if (depth > 8) throw new Error('Semantic event nesting exceeds depth limit');
  if (!event || typeof event !== 'object' || Array.isArray(event) || Object.keys(event).some(key => !['id','args'].includes(key)) || typeof event.id !== 'string' || !TEXT_ID.test(event.id) || utf8Bytes(event.id) > 160) throw new Error('Invalid semantic text event');
  if (active.has(event)) throw new Error('Cyclic semantic text event');
  if (++budget.nodes > 512) throw new Error('Semantic text tree exceeds node limit');
  chargeText(budget,event.id);
  const sourceArgs = event.args ?? {};
  if (!sourceArgs || typeof sourceArgs !== 'object' || Array.isArray(sourceArgs) || Object.keys(sourceArgs).length > 64) throw new Error('Invalid semantic text arguments');
  const args = Object.create(null);
  active.add(event);
  try {
  for (const [name,argument] of Object.entries(sourceArgs)) {
    if (++budget.arguments > 4096) throw new Error('Semantic text tree exceeds argument limit');
    chargeText(budget,name);
    if (!ARGUMENT_NAME.test(name) || !argument || typeof argument !== 'object' || Array.isArray(argument) || Object.keys(argument).length !== 2 || !Object.hasOwn(argument,'type') || !Object.hasOwn(argument,'value')) throw new Error('Invalid typed text argument');
    const {type,value} = argument;
    let ownedValue = value;
    if (type === 'text') {
      if (typeof value !== 'string' || utf8Bytes(value) > 65536) throw new Error('Invalid literal text argument');
      chargeText(budget,value);
    } else if (type === 'text_id') {
      if (typeof value !== 'string' || !TEXT_ID.test(value) || utf8Bytes(value) > 160) throw new Error('Invalid referenced text identifier');
      chargeText(budget,value);
    } else if (type === 'boolean') {
      if (typeof value !== 'boolean') throw new Error('Invalid boolean text argument');
    } else if (type === 'integer' || type === 'unsigned') {
      if (!(typeof value === 'bigint' || Number.isSafeInteger(value))) throw new Error('Inexact integer text argument');
      const exact = BigInt(value);
      const minimum = type === 'unsigned' ? 0n : -(1n << 63n);
      const maximum = type === 'unsigned' ? (1n << 64n)-1n : (1n << 63n)-1n;
      if (exact < minimum || exact > maximum) throw new Error('Integer text argument out of range');
    } else if (type === 'event') ownedValue = ownTextEvent(value,depth+1,active,budget);
    else throw new Error('Unsupported text argument type');
    Object.defineProperty(args,name,{value:Object.freeze({type,value:ownedValue}),enumerable:true});
  }
  return Object.freeze({id:event.id,args:Object.freeze(args)});
  } finally { active.delete(event); }
}
/** serde receives exact JSON integer tokens, including the full u64 range. */
export function serializeTextEvent(event) {
  const owned = immutableTextEvent(event);
  const json = serializeOwnedTextEvent(owned);
  if (utf8Bytes(json) > SEMANTIC_JSON_LIMIT) throw new Error('Semantic event JSON exceeds byte limit');
  return json;
}
function serializeOwnedTextEvent(owned) {
  const args = Object.entries(owned.args).map(([name,{type,value}]) => `${JSON.stringify(name)}:{"type":${JSON.stringify(type)},"value":${type === 'event' ? serializeOwnedTextEvent(value) : typeof value === 'bigint' ? value.toString() : JSON.stringify(value)}}`).join(',');
  return `{"id":${JSON.stringify(owned.id)},"args":{${args}}}`;
}
export function immutableGameplayEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || Object.keys(envelope).some(key => !['event','context'].includes(key))) throw new Error('Invalid gameplay envelope');
  const event = immutableTextEvent(envelope.event);
  const context = envelope.context;
  if (!context || typeof context !== 'object' || Array.isArray(context) || Object.keys(context).some(key => !['api','helperVariant','locationPrefix','quest'].includes(key)) || typeof context.api !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(context.api) || !['plain','dream','underwater','blind','quoted'].includes(context.helperVariant) || (context.locationPrefix !== undefined && (typeof context.locationPrefix !== 'string' || utf8Bytes(context.locationPrefix) > 65536))) throw new Error('Invalid source helper context');
  return Object.freeze({event,context:Object.freeze({api:context.api,helperVariant:context.helperVariant,...(context.locationPrefix === undefined ? {} : {locationPrefix:context.locationPrefix}),...(context.quest === undefined ? {} : {quest:immutableQuestContext(context.quest)})})});
}
export function immutableQuestContext(value) {
  const keys = ['sequence','lineIndex','lineCount','final','captureComplete','window','resolvedSection','resolvedMessageId','itemIndex','field','sourceTemplate','decodedLine'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value,key))) throw new Error('Invalid quest source context');
  const u32 = number => Number.isInteger(number) && number >= 0 && number <= 4294967295;
  if (!u32(value.sequence) || !value.sequence || !u32(value.lineCount) || value.lineCount < 1 || value.lineCount > 4096 || !u32(value.lineIndex) || value.lineIndex >= value.lineCount || typeof value.final !== 'boolean' || value.final !== (value.lineIndex+1 === value.lineCount) || typeof value.captureComplete !== 'boolean' || !Number.isInteger(value.window) || value.window < -2147483648 || value.window > 2147483647 || !u32(value.itemIndex) || !['text','item'].includes(value.field) || (value.field === 'text' ? value.itemIndex !== 0 : value.itemIndex < 1)) throw new Error('Invalid quest source coordinates');
  for (const key of ['resolvedSection','resolvedMessageId','sourceTemplate','decodedLine']) if (typeof value[key] !== 'string' || utf8Bytes(value[key]) > (key === 'resolvedSection' || key === 'resolvedMessageId' ? 160 : 65536)) throw new Error('Invalid quest source diagnostic');
  return Object.freeze(Object.fromEntries(keys.map(key => [key,value[key]])));
}
export function serializeGameplayEnvelope(envelope) {
  const owned = immutableGameplayEnvelope(envelope);
  const json = `{"event":${serializeOwnedTextEvent(owned.event)},"context":${JSON.stringify(owned.context)}}`;
  if (utf8Bytes(json) > SEMANTIC_JSON_LIMIT) throw new Error('Gameplay envelope JSON exceeds byte limit');
  return json;
}

function sameArgument(left,right) {
  if (left.type !== right.type) return false;
  if (left.type === 'integer' || left.type === 'unsigned') return BigInt(left.value) === BigInt(right.value);
  if (left.type !== 'event') return left.value === right.value;
  if (left.value.id !== right.value.id) return false;
  const keys = Object.keys(left.value.args);
  return keys.length === Object.keys(right.value.args).length && keys.every(key => Object.hasOwn(right.value.args,key) && sameArgument(left.value.args[key],right.value.args[key]));
}

/** Groups source-issued quest rows without using their displayed English. */
export class QuestGroupTracker {
  constructor({argumentsFor = () => null,complete = () => {},invalidate = () => {}} = {}) {
    this.argumentsFor = argumentsFor; this.complete = complete; this.onInvalidated = invalidate;
    this.groups = new Map(); this.lastSequence = 0; this.retainedRows = 0; this.retainedBytes = 0;
  }
  release(group) {
    this.retainedRows -= group.rows.size; this.retainedBytes -= group.bytes;
    group.rows.clear(); group.args.clear(); group.bytes = 0; group.ready = null;
  }
  rejectSequence(sequence) {
    if (Number.isInteger(sequence) && sequence > 0 && sequence <= 4294967295) this.lastSequence = Math.max(this.lastSequence,sequence);
    const group = this.groups.get(sequence);
    if (group && !group.invalid) { group.invalid = true; this.release(group); this.onInvalidated(group.token); }
  }
  discardWindow(window) {
    for (const [sequence,group] of this.groups) if (group.identity.window === window && !group.published) this.rejectSequence(sequence);
  }
  capture(envelope,delivery,text,channel,attr = 0) {
    const quest = envelope.context.quest;
    let group = this.groups.get(quest.sequence);
    if (!group) {
      group = {token:Object.freeze({sequence:quest.sequence}),identity:{callback:delivery.callbackName,window:delivery.window,id:envelope.event.id,lineCount:quest.lineCount,field:quest.field,itemIndex:quest.itemIndex,section:quest.resolvedSection,messageId:quest.resolvedMessageId,api:envelope.context.api,variant:envelope.context.helperVariant,location:envelope.context.locationPrefix,attr},rows:new Map(),args:new Map(),bytes:0,invalid:quest.sequence <= this.lastSequence,ready:null,published:false};
      this.lastSequence = Math.max(this.lastSequence,quest.sequence);
      this.groups.set(quest.sequence,group);
      // Recent message history itself is capped at 1000. Evict only completed
      // or rejected tracker state; UI presentation sidecars use weak tokens.
      if (this.groups.size > 1000) {
        for (const [sequence,old] of this.groups) {
          if (old !== group && (old.published || old.invalid)) { this.groups.delete(sequence); break; }
        }
        if (this.groups.size > 1000) { group.invalid = true; this.groups.delete(quest.sequence); }
      }
    }
    const row = Object.freeze({id:envelope.event.id,args:envelope.event.args,context:envelope.context,channel,semantic:true,sourceText:text,translated:false,questGroup:group.token,questComplete:false});
    const expected = group.identity;
    if (group.invalid) return row;
    if (group.published || delivery.callbackName !== 'shim_putstr' || quest.window !== delivery.window || (quest.lineCount > 1 && envelope.context.locationPrefix) || expected.callback !== delivery.callbackName || expected.window !== delivery.window || expected.id !== envelope.event.id || expected.lineCount !== quest.lineCount || expected.field !== quest.field || expected.itemIndex !== quest.itemIndex || expected.section !== quest.resolvedSection || expected.messageId !== quest.resolvedMessageId || expected.api !== envelope.context.api || expected.variant !== envelope.context.helperVariant || expected.location !== envelope.context.locationPrefix || expected.attr !== attr || group.rows.has(quest.lineIndex)) {
      this.rejectSequence(quest.sequence); return row;
    }
    // Bounded presentation staging. Oversized or numerous unfinished groups
    // remain their original rows; they cannot retain unbounded native metadata.
    let bytes;
    try { bytes = utf8Bytes(serializeGameplayEnvelope({event:envelope.event,context:envelope.context}))+utf8Bytes(text); }
    catch { this.rejectSequence(quest.sequence); return row; }
    if (this.retainedRows >= 4096 || this.retainedBytes+bytes > 8*1024*1024) { this.rejectSequence(quest.sequence); return row; }
    for (const [name,argument] of Object.entries(envelope.event.args)) {
      if (group.args.has(name) && !sameArgument(group.args.get(name),argument)) { this.rejectSequence(quest.sequence); return row; }
      group.args.set(name,argument);
    }
    group.rows.set(quest.lineIndex,Object.freeze({event:row,attr}));
    this.retainedRows++; this.retainedBytes += bytes; group.bytes += bytes;
    if (quest.final) {
      const declared = this.argumentsFor(envelope.event.id);
      if (!quest.captureComplete || group.rows.size !== quest.lineCount || !Array.isArray(declared) || new Set(declared).size !== declared.length || declared.length !== group.args.size || declared.some(name => !group.args.has(name))) { this.rejectSequence(quest.sequence); return row; }
      const originals = Array.from({length:quest.lineCount},(_,index) => group.rows.get(index));
      if (originals.some(original => !original)) { this.rejectSequence(quest.sequence); return row; }
      try {
        const event = immutableTextEvent({id:envelope.event.id,args:Object.fromEntries(group.args)});
        const originalText = originals.map(original => original.event.sourceText).join('\n');
        if (utf8Bytes(originalText) > SEMANTIC_JSON_LIMIT) throw new Error('Quest source paragraph exceeds limit');
        group.ready = Object.freeze({...event,context:envelope.context,channel,semantic:true,sourceText:originalText,translated:false,questGroup:group.token,questComplete:true,originalRows:Object.freeze(originals)});
      } catch { this.rejectSequence(quest.sequence); }
    }
    return row;
  }
  delivered(row) {
    const group = row?.context?.quest ? this.groups.get(row.context.quest.sequence) : null;
    if (group?.ready && !group.invalid && !group.published) { const ready = group.ready; group.published = true; this.release(group); this.complete(group.token,ready); }
  }
}

export function utf8Limit(value, capacity) {
  const encoder = new TextEncoder();
  let result = '';
  let used = 0;
  for (const char of String(value)) {
    const bytes = encoder.encode(char).length;
    if (used + bytes >= capacity) break;
    result += char;
    used += bytes;
  }
  return result;
}

/** A consumed input queue. Redraws have no reference to this queue. */
export class InputInbox {
  constructor() { this.queue = []; this.pending = null; this.consumed = []; this.consumedTotal = 0; }
  record(value) {
    this.consumedTotal++;
    this.consumed.push(value);
    if (this.consumed.length > 4096) this.consumed.splice(0,1024);
  }
  send(input) {
    const value = Object.freeze({ ...input });
    if (this.pending) {
      const resolve = this.pending;
      this.pending = null;
      this.record(value);
      resolve(value);
    } else if (this.queue.length < 256) this.queue.push(value);
    else return false;
    return true;
  }
  async read() {
    if (this.pending) throw new Error('Concurrent input wait is forbidden');
    if (this.queue.length) {
      const next = this.queue.shift();
      this.record(next);
      return next;
    }
    return new Promise(resolve => { this.pending = resolve; });
  }
  clear() { this.queue.length = 0; }
}

/** Thin memory adapter. Struct layouts come from compiled C, never guessed. */
export class EngineMemory {
  constructor(module, layout) {
    this.module = module;
    this.layout = layout;
    for (const key of ['anythingSize','menuItemSize','menuCountOffset','menuFlagsOffset']) {
      if (!Number.isInteger(layout[key]) || layout[key] <= 0) throw new Error(`Missing engine ABI layout: ${key}`);
    }
  }
  string(ptr) { return ptr ? this.module.UTF8ToString(ptr) : ''; }
  i32(ptr) { return this.module.getValue(ptr, 'i32'); }
  u32(ptr) { return this.i32(ptr) >>> 0; }
  writeString(ptr, text, capacity) {
    this.module.stringToUTF8(utf8Limit(text, capacity), ptr, capacity);
  }
  identifier(ptr) {
    return Array.from(this.module.HEAPU8.subarray(ptr, ptr + this.layout.anythingSize));
  }
  glyph(ptr) {
    if (!ptr) return Object.freeze({ glyph: -1, char: ' ', color: 7, flags: 0, frameColor: 0 });
    const l = this.layout;
    const code = this.u32(ptr + l.glyphCharOffset);
    return Object.freeze({ glyph: this.i32(ptr + l.glyphIdOffset), char: String.fromCodePoint(code <= 0x10ffff ? code : 32),
      color: this.i32(ptr + l.glyphColorOffset), flags: this.u32(ptr + l.glyphFlagsOffset),
      frameColor: this.u32(ptr + l.glyphFrameOffset), customColor: this.u32(ptr + l.glyphCustomColorOffset) });
  }
  menuResult(outputPtr, rows) {
    this.module.setValue(outputPtr, 0, '*');
    if (!rows.length) return 0;
    const l = this.layout;
    const ptr = this.module._malloc(rows.length * l.menuItemSize);
    if (!ptr) throw new Error('Could not allocate upstream menu result');
    this.module.HEAPU8.fill(0, ptr, ptr + rows.length * l.menuItemSize);
    rows.forEach((row, index) => {
      const entry = ptr + index * l.menuItemSize;
      this.module.HEAPU8.set(row.identifier, entry);
      this.module.setValue(entry + l.menuCountOffset, row.count ?? -1, 'i32');
      this.module.setValue(entry + l.menuFlagsOffset, row.flags, 'i32');
    });
    // Ownership passes to upstream; the game frees selected menu_item arrays.
    this.module.setValue(outputPtr, ptr, '*');
    return rows.length;
  }
  extendedCommands(pointer) {
    const l = this.layout;
    const rows = [];
    for (let index = 0; index < 1024; index++) {
      const entry = pointer + index * l.extCommandSize;
      const namePtr = this.i32(entry + l.extNameOffset);
      if (!namePtr) return rows;
      const flags = this.u32(entry + l.extFlagsOffset);
      // Same visibility mask as normal-mode upstream extended-command menus.
      if ((flags & (0x4 | 0x10 | 0x40)) === 0) {
        rows.push(Object.freeze({ index, name: this.string(namePtr), description: this.string(this.i32(entry + l.extDescriptionOffset)), flags }));
      }
    }
    throw new Error('Extended-command table is not terminated');
  }
}

/** Calls the pure Rust display/input layer; no gameplay functions are exposed. */
export class RustLayers {
  constructor(module, catalog) {
    this.module = module;
    const json = JSON.stringify(catalog);
    this.catalogBytes = new TextEncoder().encode(json);
    this.uiRegistered = new RegisteredCatalog(module,json);
    this.gameplayRegistered = null;
    this.gameplayCatalog = null;
    this.gameplayCatalogBytes = null;
  }
  setGameplayCatalog(catalog) {
    if (!catalog || !catalog.en || !catalog.ja || typeof catalog.en !== 'object' || typeof catalog.ja !== 'object' || Array.isArray(catalog.en) || Array.isArray(catalog.ja) || Object.keys(catalog).some(key => !['en','ja','argument_schemas'].includes(key))) throw new Error('Invalid gameplay text catalog');
    const owned = {en:{...catalog.en},ja:{...catalog.ja}};
    if (Object.entries(owned.en).some(([id,text]) => !TEXT_ID.test(id) || utf8Bytes(id) > 160 || typeof text !== 'string' || utf8Bytes(text) > 65536) || Object.entries(owned.ja).some(([id,text]) => !Object.hasOwn(owned.en,id) || typeof text !== 'string' || utf8Bytes(text) > 65536)) throw new Error('Invalid gameplay catalog entry');
    if (catalog.argument_schemas !== undefined) {
      if (!catalog.argument_schemas || typeof catalog.argument_schemas !== 'object' || Array.isArray(catalog.argument_schemas)) throw new Error('Invalid declared gameplay arguments');
      const schemas = Object.create(null);
      for (const [id,names] of Object.entries(catalog.argument_schemas)) {
        if (!Object.hasOwn(owned.en,id) || !Array.isArray(names) || names.length > 64 || names.some(name => typeof name !== 'string' || !ARGUMENT_NAME.test(name)) || new Set(names).size !== names.length) throw new Error('Invalid declared gameplay argument schema');
        Object.defineProperty(schemas,id,{value:Object.freeze([...names]),enumerable:true});
      }
      owned.argument_schemas = Object.freeze(schemas);
    }
    const bytes = new TextEncoder().encode(JSON.stringify(owned));
    if (bytes.length > 16*1024*1024) throw new Error('Gameplay catalog exceeds Rust limit');
    const candidate = new RegisteredCatalog(this.module,JSON.stringify(owned));
    try { this.gameplayRegistered?.dispose(this.module); }
    catch (error) { candidate.dispose(this.module); throw error; }
    this.gameplayRegistered = candidate;
    this.gameplayCatalog = Object.freeze({...owned,en:Object.freeze(owned.en),ja:Object.freeze(owned.ja)});
    this.gameplayCatalogBytes = bytes;
  }
  withBytes(value, callback) {
    const bytes = new TextEncoder().encode(value);
    const ptr = this.module._malloc(Math.max(1, bytes.length));
    this.module.HEAPU8.set(bytes, ptr);
    try { return callback(ptr, bytes.length); } finally { this.module._free(ptr); }
  }
  format(id, args = {}, locale = 'ja') {
    const typed = Object.fromEntries(Object.entries(args).map(([key,value]) => [key,{type:Number.isInteger(value) ? 'integer' : 'text',value}]));
    return this.renderTyped({id,args:typed},locale).text;
  }
  formatEvent(event,locale = 'ja') {
    if (!this.gameplayRegistered) throw new Error('Gameplay catalog is not loaded');
    const owned = immutableGameplayEnvelope(event);
    return this.gameplayRegistered.renderJSON(this.module,serializeGameplayEnvelope(owned),locale,1);
  }
  renderTyped(event,locale = 'ja') {
    return this.uiRegistered.renderJSON(this.module,serializeTextEvent(event),locale,0);
  }
  dispose() {
    const gameplay = this.gameplayRegistered;
    this.gameplayRegistered = null;
    try { gameplay?.dispose(this.module); }
    finally { this.uiRegistered.dispose(this.module); }
  }
  keycode(key, modifiers, context = 0) {
    return this.withBytes(key,(ptr,len) => this.module.ccall('nh_rust_keycode','number',Array(4).fill('number'),[ptr,len,modifiers,context]));
  }
  direction(dx,dy,run = false,context = 0,layout = 0) {
    return this.module.ccall('nh_rust_direction_pad','number',Array(5).fill('number'),[dx,dy,run ? 1 : 0,context,Number(layout)]);
  }
  textInsert(text) {
    return this.withBytes(text,(ptr,len) => {
      const params = [ptr,len,4,0,0];
      const size = this.module.ccall('nh_rust_text_insert','number',Array(5).fill('number'),params);
      if (size < 0 || size > 1048576) throw new Error(`Invalid text input (${size})`);
      const output = this.module._malloc(Math.max(1,size));
      try {
        params[3] = output; params[4] = size;
        const written = this.module.ccall('nh_rust_text_insert','number',Array(5).fill('number'),params);
        if (written !== size) throw new Error('Text input length mismatch');
        return new TextDecoder('utf-8',{fatal:true}).decode(this.module.HEAPU8.subarray(output,output+size));
      } finally { this.module._free(output); }
    });
  }
}

export const SHIM_CALLBACKS = Object.freeze([
  'shim_init_nhwindows','shim_player_selection_or_tty','shim_askname','shim_get_nh_event',
  'shim_exit_nhwindows','shim_suspend_nhwindows','shim_resume_nhwindows','shim_create_nhwindow',
  'shim_clear_nhwindow','shim_display_nhwindow','shim_destroy_nhwindow','shim_curs','shim_putstr',
  'shim_display_file','shim_start_menu','shim_add_menu','shim_end_menu','shim_select_menu',
  'shim_message_menu','shim_mark_synch','shim_wait_synch','shim_cliparound','shim_update_positionbar',
  'shim_print_glyph','shim_raw_print','shim_raw_print_bold','shim_nhgetch','shim_nh_poskey',
  'shim_nhbell','shim_doprev_message','shim_yn_function','shim_getlin','shim_get_ext_cmd',
  'shim_number_pad','shim_delay_output','shim_change_color','shim_change_background','set_shim_font_name',
  'shim_get_color_string','shim_preference_update','shim_getmsghistory','shim_putmsghistory',
  'shim_status_init','shim_status_enablefield','shim_status_update'
]);

/** Full official windowport adapter. UI methods resolve only after real user input. */
export class ShimHost {
  constructor({ module, layout, ui, globals = () => globalThis.nethackGlobal, fileReader, semanticReader = null, questArguments = () => null, persist = async () => {} }) {
    this.module = module;
    this.memory = new EngineMemory(module,layout);
    this.ui = ui;
    this.global = globals;
    this.fileReader = fileReader;
    this.semanticReader = semanticReader;
    this.questTracker = new QuestGroupTracker({argumentsFor:questArguments,complete:(token,event) => this.ui.questGroupCompleted?.(token,event),invalidate:token => this.ui.questGroupInvalidated?.(token)});
    this.persist = persist;
    this.inbox = new InputInbox();
    this.windows = new Map();
    this.nextWindow = 1;
    this.history = [];
    this.historyCursor = 0;
    this.status = new Map();
    this.map = new Map();
    this.pendingKind = null;
    this.exited = false;
    this.windowClosed = false;
    this.finalization = null;
    this.numberPad = false;
    this.inputLayout = 0;
    this.trace = [];
    this.missingSemanticTexts = 0;
    this.semanticTextEvents = 0;
    this.semanticCaptureFailures = 0;
    this.callback = this.callback.bind(this);
  }
  window(id) {
    const win = this.windows.get(id);
    if (!win) throw new Error(`Unknown upstream window ${id}`);
    return win;
  }
  finalize(status = 0) {
    if (!this.finalization) this.finalization = (async () => {
      try { if (status === 0) await this.persist(); }
      finally {
        this.exited = true;
        this.pendingKind = null;
        this.inbox.clear();
        this.ui.exited();
      }
    })();
    return this.finalization;
  }
  readSemantic(callbackName,window = -1) {
    if (!this.semanticReader) return null;
    let envelope;
    try {
      envelope = this.semanticReader(callbackName,window);
      if (!envelope) return null;
      const owned = immutableGameplayEnvelope(envelope);
      if (owned.context.quest && (callbackName !== 'shim_putstr' || owned.context.quest.window !== window)) throw new Error('Quest callback/window association mismatch');
      return Object.freeze({...owned,delivery:Object.freeze({callbackName,window})});
    } catch {
      // Malformed localization metadata must not alter a native interaction.
      this.semanticCaptureFailures++;
      if (Number.isInteger(envelope?.context?.quest?.sequence)) this.questTracker.rejectSequence(envelope.context.quest.sequence);
      return null;
    }
  }
  gameText(text, channel = 'game', semantic = null, attr = 0) {
    if (semantic) {
      this.semanticTextEvents++;
      if (semantic.context.quest) {
        try { return this.questTracker.capture(semantic,semantic.delivery,String(text),channel,attr); }
        catch { this.questTracker.rejectSequence(semantic.context.quest.sequence); this.semanticCaptureFailures++; return this.gameText(text,channel); }
      }
      return Object.freeze({...semantic.event,context:semantic.context,channel,semantic:true,sourceText:String(text),translated:false});
    }
    // Explicit unlocalized upstream surface. Never infer semantic IDs from English.
    const event = Object.freeze({ id:'upstream.untranslated',args:Object.freeze({text:String(text)}),channel,translated:false });
    if (text) this.missingSemanticTexts++;
    return event;
  }
  message(text, attr = 0, semantic = null) {
    if (!text && !semantic?.context.quest) return;
    const event = this.gameText(text,'message',semantic,attr);
    const noHistory = !!(attr & (this.global()?.constants?.ATTR?.ATR_NOHISTORY ?? 32));
    if (text && !noHistory) {
      this.history.push(event);
      if (this.history.length > 1000) this.history.shift();
    }
    this.ui.message(event,attr);
    this.questTracker.delivered(event);
  }
  async wait(kind, operation) {
    if (this.pendingKind) throw new Error(`Reentrant UI wait: ${kind} during ${this.pendingKind}`);
    this.pendingKind = kind;
    this.ui.waiting(kind);
    try { return await operation(); }
    finally { this.pendingKind = null; this.ui.waiting(null); }
  }
  async readKey(kind = 'key') {
    return this.wait(kind,async () => {
      while (true) {
        const input = await this.inbox.read();
        if (input.type === 'key') return input.code;
      }
    });
  }
  frame() {
    return Object.freeze({ cells:Object.freeze(Array.from(this.map.values())),status:Object.freeze(Array.from(this.status.values())) });
  }
  redraw() { this.ui.frame(this.frame()); }
  async callback(name,...args) {
    this.trace.push(name);
    if (this.trace.length > 2000) this.trace.shift();
    switch (name) {
    case 'shim_init_nhwindows': {
      this.global().globals.iflags.window_inited = true;
      this.ui.initialized(); return;
    }
    case 'shim_player_selection_or_tty': return true; // Official genl_player_setup rules and menus.
    case 'shim_askname': {
      const name = await this.wait('text',() => this.ui.text({id:'ui.player_name',maxBytes:this.memory.layout.playerNameSize}));
      this.global().globals.svp.plname = utf8Limit(name ?? 'Player',this.memory.layout.playerNameSize);
      return;
    }
    case 'shim_create_nhwindow': {
      const id = this.nextWindow++;
      this.windows.set(id,{id,type:args[0],lines:[],items:[],prompt:null,behavior:0}); return id;
    }
    case 'shim_clear_nhwindow': {
      const win = this.window(args[0]); win.lines = []; win.items = [];
      if (win.type !== 1) this.questTracker.discardWindow(args[0]);
      if (win.type === 3) { this.map.clear(); this.redraw(); }
      if (win.type === 1) this.ui.clearMessage?.(); return;
    }
    case 'shim_destroy_nhwindow': this.questTracker.discardWindow(args[0]); this.windows.delete(args[0]); return;
    case 'shim_curs': {
      this.window(args[0]).cursor = Object.freeze({x:args[1],y:args[2]});
      if (this.window(args[0]).type === 3) this.ui.cursor?.(args[1],args[2]); return;
    }
    case 'shim_putstr': {
      const [id,attr,text] = args;
      const win = this.window(id);
      const semantic = this.readSemantic(name,id);
      if (win.type === 1) this.message(text,attr,semantic);
      else {
        const event = this.gameText(text,win.type === 2 ? 'status' : 'window',semantic,attr);
        if (win.type === 2) this.ui.statusText?.(event);
        else win.lines.push(Object.freeze({event,attr}));
        this.questTracker.delivered(event);
      }
      return;
    }
    case 'shim_display_nhwindow': {
      const [id,blocking] = args; const win = this.window(id);
      this.redraw();
      if (win.type === 4 || win.type === 5) {
        await this.wait('display',() => this.ui.document({title:win.prompt,lines:win.lines,items:win.items}));
      } else if (blocking) await this.wait('more',() => this.ui.more());
      return;
    }
    case 'shim_display_file': {
      const [filename,complain] = args;
      try {
        const content = await this.fileReader(filename);
        const lines = content.split(/\r?\n/).map(text => Object.freeze({event:this.gameText(text,'file'),attr:0}));
        await this.wait('display',() => this.ui.document({title:filename,lines,items:[]}));
      } catch (error) { if (complain) this.message(`Cannot open ${filename}: ${error.message}`); }
      return;
    }
    case 'shim_start_menu': {
      this.questTracker.discardWindow(args[0]);
      const win = this.window(args[0]); win.lines = []; win.items = []; win.behavior = args[1]; return;
    }
    case 'shim_add_menu': {
      const [id,glyphPtr,identifierPtr,ch,gch,attr,color,text,flags] = args;
      const identifier = this.memory.identifier(identifierPtr);
      // Native ports define selectability by a_void (a wasm32 pointer), even
      // though this release enlarged anything to eight bytes for 64-bit data.
      this.window(id).items.push(Object.freeze({identifier:Object.freeze(identifier),selectable:this.memory.i32(identifierPtr) !== 0,
        glyph:this.memory.glyph(glyphPtr),accelerator:ch & 255,groupAccelerator:gch & 255,attr,color,
        event:this.gameText(text,'menu',this.readSemantic(name,id)),flags,selected:!!(flags & 1)})); return;
    }
    case 'shim_end_menu': this.window(args[0]).prompt = this.gameText(args[1] ?? '','menu_prompt',this.readSemantic(name,args[0])); return;
    case 'shim_select_menu': {
      const [id,how,outputPtr] = args;
      this.module.setValue(outputPtr,0,'*');
      const win = this.window(id);
      const selection = await this.wait('menu',() => this.ui.menu({how,prompt:win.prompt,items:win.items,lines:win.lines}));
      if (selection === null) return -1;
      if (how === 0) return 0;
      if (how === 1 && selection.length > 1) throw new Error('PICK_ONE returned multiple items');
      const rows = selection.map(({index,count}) => {
        const item = win.items[index];
        if (!item?.selectable || (count !== -1 && (!Number.isInteger(count) || count < 1 || count > 2147483647))) throw new Error('Invalid menu selection');
        return {...item,count};
      });
      return this.memory.menuResult(outputPtr,rows);
    }
    case 'shim_message_menu': {
      const [letter,how,text] = args;
      this.message(text,0,this.readSemantic(name));
      const code = await this.wait('more',() => this.ui.more());
      return how === 0 ? 0 : code === (letter & 255) ? (letter & 255) : 0;
    }
    case 'shim_print_glyph': {
      const [,x,y,ptr,bgPtr] = args;
      if (x > 0 && x < 80 && y >= 0 && y < 21) {
        this.map.set(`${x},${y}`,Object.freeze({x,y,...this.memory.glyph(ptr),background:this.memory.glyph(bgPtr)}));
      }
      this.ui.dirty?.(); return;
    }
    case 'shim_raw_print': this.message(args[0],0,this.readSemantic(name)); return;
    case 'shim_raw_print_bold': this.message(args[0],1,this.readSemantic(name)); return;
    case 'shim_nhgetch': this.redraw(); return this.readKey();
    case 'shim_nh_poskey': {
      const [xp,yp,mp] = args; this.redraw();
      const inputState = this.module.ccall('nh_abi_input_state','number',[],[]);
      return this.wait(inputState === 1 ? 'command' : 'position',async () => {
        const input = await this.inbox.read();
        if (input.type === 'click') {
          this.module.setValue(xp,input.x,'i16'); this.module.setValue(yp,input.y,'i16'); this.module.setValue(mp,input.mod ?? 1,'i32'); return 0;
        }
        return input.code;
      });
    }
    case 'shim_yn_function': {
      const [query,responses,def] = args;
      const prompt = this.gameText(query,'question',this.readSemantic(name));
      const response = await this.wait('question',() => this.ui.question({prompt,responses,defaultCode:def & 255}));
      if (typeof response === 'object' && response !== null) {
        if (response.code !== 35 || !Number.isInteger(response.count) || response.count < 0 || response.count > 2147483647) throw new Error('Invalid numeric question response');
        this.module.ccall('nh_abi_set_yn_number',null,['number'],[response.count]);
        return response.code;
      }
      return response;
    }
    case 'shim_getlin': {
      const [query,ptr] = args;
      const prompt = this.gameText(query,'getlin',this.readSemantic(name));
      const text = await this.wait('text',() => this.ui.text({prompt,maxBytes:this.memory.layout.lineBufferSize}));
      this.memory.writeString(ptr,text === null ? '\u001b' : text,this.memory.layout.lineBufferSize); return;
    }
    case 'shim_get_ext_cmd': {
      const commands = this.memory.extendedCommands(this.global().pointers.extcmdlist);
      return this.wait('extended',() => this.ui.extended(commands));
    }
    case 'shim_getmsghistory': {
      if (args[0]) this.historyCursor = 0;
      const event = this.history[this.historyCursor++];
      // Original engine message history/save data remain in their source text.
      return event?.sourceText ?? event?.args.text ?? null;
    }
    case 'shim_putmsghistory': {
      const [text] = args;
      if (text) { this.history.push(this.gameText(text,'message',this.readSemantic(name))); if (this.history.length > 1000) this.history.shift(); }
      return;
    }
    case 'shim_doprev_message': await this.wait('history',() => this.ui.history(this.history)); return 0;
    case 'shim_status_init': this.status.clear(); return;
    case 'shim_status_enablefield': {
      const [index,namePtr,formatPtr,enabled] = args;
      const label = this.memory.string(namePtr);
      this.status.set(index,Object.freeze({index,name:label,labelEvent:this.gameText(label,'status_label',this.readSemantic(name)),format:this.memory.string(formatPtr),enabled,value:''})); return;
    }
    case 'shim_status_update': {
      const [index,ptr,change,percent,color,masksPtr] = args;
      if (index < 0) { this.redraw(); return; }
      const old = this.status.get(index) ?? {index,name:'',enabled:true};
      const conditionIndex = this.global().constants.STATUS_FIELD.BL_CONDITION;
      const condition = index === conditionIndex;
      const value = condition ? this.memory.u32(ptr) : this.memory.string(ptr);
      const semantic = condition ? null : this.readSemantic(name);
      const event = semantic ? this.gameText(value,'status',semantic) : null;
      const masks = condition && masksPtr ? Array.from({length:24},(_,i) => this.memory.u32(masksPtr+i*4)) : [];
      this.status.set(index,Object.freeze({...old,value,event,condition,color,change,percent,masks:Object.freeze(masks)})); return;
    }
    case 'shim_exit_nhwindows': {
      // NetHack may still append scores after closing its windows.
      // Only the final native exit can complete browser persistence.
      this.windowClosed = true; this.inbox.clear();
      if (args[0]) this.message(args[0]);
      return;
    }
    case 'shim_suspend_nhwindows': if (args[0]) this.message(args[0]); this.ui.suspended?.(); return;
    case 'shim_resume_nhwindows': this.redraw(); return;
    case 'shim_cliparound': this.ui.clip?.(args[0],args[1]); return;
    case 'shim_update_positionbar': this.ui.positionbar?.(args[0]); return;
    case 'shim_number_pad': this.numberPad = args[0] !== 0; this.inputLayout = this.module.ccall('nh_abi_input_layout','number',[],[]); this.ui.numberPad?.(this.numberPad); return;
    case 'shim_nhbell': this.ui.bell?.(); return;
    case 'shim_delay_output': await this.ui.delay?.(); return;
    case 'shim_change_color': this.ui.color?.(...args); return;
    case 'shim_change_background': this.ui.background?.(...args); return;
    case 'set_shim_font_name': this.ui.font?.(...args); return 0;
    case 'shim_get_color_string': return '';
    case 'shim_mark_synch': case 'shim_wait_synch': this.redraw(); return;
    case 'shim_get_nh_event': case 'shim_preference_update': return;
    default: throw new Error(`Unsupported upstream callback: ${name}`);
    }
  }
}

export function readGameFile(FS,filename,gameDir = '/nethack') {
  if (!/^[A-Za-z0-9_.-]+$/.test(filename)) throw new Error('Invalid game data filename');
  for (const path of [`${gameDir}/${filename}`,`${gameDir}/dat/${filename}`]) {
    try { return FS.readFile(path,{encoding:'utf8'}); } catch { /* Try next explicit game-data path. */ }
  }
  throw new Error('Game data file was not preloaded');
}
