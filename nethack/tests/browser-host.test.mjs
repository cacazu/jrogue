import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ShimHost, EngineMemory, InputInbox, SHIM_CALLBACKS, utf8Limit, SOURCE_COMMIT, HOST_ABI } from '../web/shim-host.mjs';
import { SaveStore, validatePayload, validateAuxiliaryPayload, bytesToBase64, base64ToBytes, snapshotSaveFiles, snapshotAuxiliaryFiles, isAuxiliaryName, AUXILIARY_FORMAT } from '../web/save-store.mjs';

const layout = {anythingSize:8,menuItemSize:16,menuCountOffset:8,menuFlagsOffset:12,glyphIdOffset:0,glyphCharOffset:4,glyphFrameOffset:8,glyphFlagsOffset:12,glyphColorOffset:16,glyphCustomColorOffset:24,extCommandSize:24,extNameOffset:4,extDescriptionOffset:8,extFlagsOffset:16,playerNameSize:32,lineBufferSize:256};
function fixture() {
  const buffer = new ArrayBuffer(65536);
  const view = new DataView(buffer);
  const module = {HEAPU8:new Uint8Array(buffer),next:4096,allocations:[],calls:[],
    _malloc(size) { const ptr = this.next; this.next += Math.ceil(Math.max(1,size)/8)*8; this.allocations.push({ptr,size}); return ptr; },
    _free() {},
    getValue(ptr,type) { return type === 'i16' ? view.getInt16(ptr,true) : view.getInt32(ptr,true); },
    setValue(ptr,value,type) { if (type === 'i16') view.setInt16(ptr,value,true); else view.setInt32(ptr,value,true); },
    UTF8ToString(ptr) { let end = ptr; while (this.HEAPU8[end]) end++; return new TextDecoder().decode(this.HEAPU8.subarray(ptr,end)); },
    stringToUTF8(text,ptr,capacity) { const bytes = new TextEncoder().encode(utf8Limit(text,capacity)); this.HEAPU8.set(bytes,ptr); this.HEAPU8[ptr+bytes.length] = 0; },
    ccall(name,returnType,types,args) { this.calls.push({name,args}); return name === 'nh_abi_input_layout' ? 2 : name === 'nh_abi_input_state' ? 1 : 0; }
  };
  const globals = {globals:{iflags:{},svp:{}},constants:{STATUS_FIELD:{BL_CONDITION:22}},pointers:{extcmdlist:512}};
  const ui = {frames:[],messages:[],kind:null,exits:0,
    initialized() {}, waiting(kind) { this.kind = kind; }, frame(frame) { this.frames.push(frame); },
    message(event,attr) { this.messages.push({event,attr}); }, exited() { this.exits++; },
    async text() { return this.textResult ?? ''; }, async question() { return this.questionResult ?? 110; },
    async menu(request) { this.menuRequest = request; return this.menuResult ?? []; },
    async document(request) { this.documentRequest = request; }, async more() { return 32; },
    async extended(commands) { this.commands = commands; return this.extResult ?? -1; },async history(events) { this.historyEvents = events; }
  };
  let persisted = 0;
  const host = new ShimHost({module,layout,ui,globals:() => globals,fileReader:async name => `official file ${name}\nline 2`,persist:async () => { persisted++; }});
  return {module,globals,ui,host,get persisted() { return persisted; }};
}

test('host callback inventory covers every official DECLCB/VDECLCB pathway',() => {
  const source = readFileSync(new URL('../upstream/NetHack-5.0.0/win/shim/winshim.c',import.meta.url),'utf8');
  const names = [...source.matchAll(/\b(?:VDECLCB|DECLCB)\s*\(\s*(?:(?:boolean|winid|int|char\s*\*?|short|win_request_info\s*\*)\s*,\s*)?((?:shim_\w+|set_shim_font_name))/g)].map(match => match[1]);
  const wasmNames = names.filter(name => !['shim_player_selection','shim_update_inventory','shim_ctrl_nhwindow'].includes(name));
  assert.deepEqual([...new Set(wasmNames)].sort(),[...SHIM_CALLBACKS].sort());
});
test('compiled integration source fixes the upstream anything pointer marshalling defect',() => {
  const source = readFileSync(new URL('../work/NetHack-5.0.0/win/shim/winshim.c',import.meta.url),'utf8');
  assert.match(source,/"vipp00iisi"/);
  assert.doesNotMatch(source,/"vipi00iisi"/);
});
test('every callback returns a Promise and unsupported calls fail loudly',async () => {
  const {host,globals} = fixture();
  const result = host.callback('shim_init_nhwindows');
  assert.equal(typeof result.then,'function'); await result;
  assert.equal(globals.globals.iflags.window_inited,true);
  assert.equal(await host.callback('shim_player_selection_or_tty'),true);
  await assert.rejects(host.callback('unknown_callback'),/Unsupported/);
});
test('menu identifiers are copied; ABI result preserves all union bytes and count',async () => {
  const {host,module,ui} = fixture();
  const id = await host.callback('shim_create_nhwindow',4);
  await host.callback('shim_start_menu',id,0);
  const identifier = [1,2,3,4,5,6,7,8]; module.HEAPU8.set(identifier,128);
  await host.callback('shim_add_menu',id,0,128,97,0,0,3,'three items',1);
  module.HEAPU8.fill(0,128,136);
  ui.menuResult = [{index:0,count:3}];
  const selected = await host.callback('shim_select_menu',id,2,256);
  assert.equal(selected,1);
  const ptr = module.getValue(256,'i32');
  assert.deepEqual(Array.from(module.HEAPU8.subarray(ptr,ptr+8)),identifier);
  assert.equal(module.getValue(ptr+8,'i32'),3); assert.equal(module.getValue(ptr+12,'i32'),1);
  assert.equal(ui.menuRequest.items[0].selected,true);
});
test('PICK_NONE and cancellation return correct empty ownership and sentinel',async () => {
  const {host,module,ui} = fixture(); const id = await host.callback('shim_create_nhwindow',4);
  module.setValue(256,999,'*'); assert.equal(await host.callback('shim_select_menu',id,0,256),0); assert.equal(module.getValue(256,'*'),0);
  ui.menu = async () => null; assert.equal(await host.callback('shim_select_menu',id,1,256),-1); assert.equal(module.getValue(256,'*'),0);
  assert.equal(module.allocations.length,0);
});
test('explanatory menu rows follow native a_void selectability despite union high-byte padding',async () => {
  const {host,module} = fixture(); const id = await host.callback('shim_create_nhwindow',4);
  module.HEAPU8.set([0,0,0,0,1,2,3,4],128);
  await host.callback('shim_add_menu',id,0,128,0,0,0,7,'heading',0);
  assert.equal(host.window(id).items[0].selectable,false);
  assert.deepEqual(host.window(id).items[0].identifier,[0,0,0,0,1,2,3,4]);
});
test('invalid menu counts and PICK_ONE cardinality fail before allocating or mutation',async () => {
  const {host,module,ui} = fixture(); const id = await host.callback('shim_create_nhwindow',4); module.setValue(128,1,'i32');
  await host.callback('shim_add_menu',id,0,128,97,0,0,7,'item',0);
  ui.menuResult = [{index:0,count:0}]; await assert.rejects(host.callback('shim_select_menu',id,2,256),/Invalid menu/);
  ui.menuResult = [{index:0,count:-1},{index:0,count:-1}]; await assert.rejects(host.callback('shim_select_menu',id,1,256),/PICK_ONE/);
  assert.equal(module.allocations.length,0); assert.equal(module.getValue(256,'*'),0);
});
test('map snapshots survive reused upstream buffers and 100 redraws consume no input',async () => {
  const {host,module,ui} = fixture(); const id = await host.callback('shim_create_nhwindow',3);
  module.setValue(128,100,'i32'); module.setValue(132,64,'i32'); module.setValue(140,16,'i32'); module.setValue(144,2,'i32');
  await host.callback('shim_print_glyph',id,40,10,128,0);
  const frame = host.frame(); module.setValue(132,88,'i32');
  for (let i = 0; i < 100; i++) host.redraw();
  assert.equal(frame.cells[0].char,'@'); assert.equal(frame.cells[0].color,2);
  assert(Object.isFrozen(frame) && Object.isFrozen(frame.cells[0]));
  assert.equal(host.inbox.consumed.length,0); assert.equal(module.calls.length,0); assert.equal(ui.frames.length,100);
});
test('nh_poskey writes coordxy shorts and click modifier, regular keys are consumed once',async () => {
  const {host,module} = fixture();
  const waiting = host.callback('shim_nh_poskey',128,132,136);
  assert.equal(host.pendingKind,'command'); host.inbox.send({type:'click',x:79,y:20,mod:2});
  assert.equal(await waiting,0); assert.equal(module.getValue(128,'i16'),79); assert.equal(module.getValue(132,'i16'),20); assert.equal(module.getValue(136,'i32'),2);
  host.inbox.send({type:'key',code:104}); assert.equal(await host.callback('shim_nhgetch'),104); assert.equal(host.inbox.consumed.length,2);
});
test('UTF8 line writes preserve literals, codepoint boundaries, cancellation and name size',async () => {
  const {host,module,ui,globals} = fixture();
  ui.textResult = '日本語 % {name}'; await host.callback('shim_getlin','name?',128); assert.equal(module.UTF8ToString(128),ui.textResult);
  ui.textResult = '界'.repeat(100); await host.callback('shim_getlin','long?',128); assert.equal(new TextEncoder().encode(module.UTF8ToString(128)).length,255);
  ui.text = async () => null; await host.callback('shim_getlin','cancel?',128); assert.equal(module.UTF8ToString(128),'\u001b');
  ui.text = async () => '界'.repeat(20); await host.callback('shim_askname'); assert.equal(globals.globals.svp.plname,'界'.repeat(10));
});
test('numeric yn responses write gn.yn_number through the compiled helper',async () => {
  const {host,module,ui} = fixture(); ui.questionResult = {code:35,count:42};
  assert.equal(await host.callback('shim_yn_function','how many?','yn#',110),35);
  assert.deepEqual(module.calls.at(-1),{name:'nh_abi_set_yn_number',args:[42]});
});
test('extended-command table retains exact indices and hides wizard/internal/unavailable',async () => {
  const {module,host,ui} = fixture();
  const names = ['apply','wizard','internal','disabled','pray'];
  names.forEach((name,index) => {
    const namePtr = 1024+index*64, descPtr = namePtr+24;
    module.stringToUTF8(name,namePtr,24); module.stringToUTF8(`desc ${name}`,descPtr,32);
    module.setValue(512+index*24+4,namePtr,'*'); module.setValue(512+index*24+8,descPtr,'*'); module.setValue(512+index*24+16,[0,4,64,16,2][index],'i32');
  });
  ui.extResult = 4; assert.equal(await host.callback('shim_get_ext_cmd'),4); assert.deepEqual(ui.commands.map(row => row.index),[0,4]);
});
test('status copies strings and condition masks, no private game entity reads',async () => {
  const {host,module} = fixture(); module.stringToUTF8('7',128,16);
  await host.callback('shim_status_update',18,128,1,70,2,0); module.stringToUTF8('1',128,16);
  module.setValue(160,3,'i32'); module.setValue(200,3,'i32'); await host.callback('shim_status_update',22,160,1,0,7,200);
  assert.equal(host.frame().status[0].value,'7'); assert.equal(host.frame().status[1].value,3); assert.equal(host.frame().status[1].masks[0],3);
});
test('display/help/history callbacks surface original text as explicit untranslated events',async () => {
  const {host,ui} = fixture(); await host.callback('shim_display_file','help',true);
  assert.equal(ui.documentRequest.lines[0].event.args.text,'official file help'); assert.equal(ui.documentRequest.lines[0].event.translated,false);
  await host.callback('shim_raw_print','hello'); assert.equal(await host.callback('shim_getmsghistory',true),'hello'); assert.equal(await host.callback('shim_getmsghistory',false),null);
  assert.equal(ui.messages[0].event.id,'upstream.untranslated');
});
test('window close preserves post-window score writes; final native exit persists exactly once',async () => {
  const fixtureData = fixture(); const {host,ui} = fixtureData;
  await host.callback('shim_number_pad',1); assert.equal(host.numberPad,true); assert.equal(host.inputLayout,2);
  await host.callback('shim_exit_nhwindows','Goodbye'); assert.equal(fixtureData.persisted,0); assert.equal(host.windowClosed,true); assert.equal(host.exited,false); assert.equal(ui.exits,0);
  await host.callback('shim_raw_print','post-window score'); assert.equal(ui.messages.at(-1).event.args.text,'post-window score');
  await host.finalize(0); await host.finalize(0); assert.equal(fixtureData.persisted,1); assert.equal(host.exited,true); assert.equal(ui.exits,1);
});
test('input ring bounds and journal count only consumed values',async () => {
  const inbox = new InputInbox(); for (let i = 0; i < 256; i++) assert.equal(inbox.send({type:'key',code:i}),true);
  assert.equal(inbox.send({type:'key',code:0}),false); assert.equal(inbox.consumed.length,0);
  assert.equal((await inbox.read()).code,0); assert.equal(inbox.consumed.length,1); inbox.clear(); assert.equal(inbox.queue.length,0);
});
test('long adventures retain bounded input diagnostics while total consumption remains exact',async () => {
  const inbox = new InputInbox();
  for (let i = 0; i < 12000; i++) { inbox.send({type:'key',code:i & 255}); await inbox.read(); }
  assert.equal(inbox.consumedTotal,12000); assert(inbox.consumed.length <= 4096); assert.equal(inbox.consumed.at(-1).code,11999 & 255);
});
test('save-file imports accept UTF8 basenames and reject traversal, duplicates and mismatched source',() => {
  const make = files => ({format:'nethack-completed-save-files-v1',source:SOURCE_COMMIT,abi:HOST_ABI,playerName:'日本語',files});
  const row = {name:'0日本語',data:bytesToBase64(Uint8Array.from([0,255,10]))};
  assert.deepEqual(Array.from(validatePayload(make([row])).files[0].bytes),[0,255,10]);
  for (const name of ['../outside','..','.','a/b','a\\b','nul\u0000']) assert.throws(() => validatePayload(make([{...row,name}])));
  assert.throws(() => validatePayload(make([row,row])),/duplicate/); assert.throws(() => validatePayload({...make([row]),source:'old'}),/source/);
  assert.throws(() => base64ToBytes('%%%'),/encoding/);
});
test('save snapshots contain only completed save files, never live memory or locks',() => {
  const FS = {readdir:() => ['.','..','0Player','directory'],stat:path => ({mode:path.endsWith('directory') ? 0 : 1}),isFile:mode => mode === 1,readFile:() => new Uint8Array([1,2,3])};
  const payload = snapshotSaveFiles(FS,'Player'); assert.equal(payload.files.length,1); assert.equal(payload.files[0].name,'0Player');
  assert.deepEqual(Object.keys(payload).sort(),['abi','files','format','playerName','source']);
});
test('auxiliary allowlist follows pinned native bones grammar and excludes temporary/data files',() => {
  for (const name of ['record','logfile','xlogfile','bonD0.5','bonM0.T','bonQVal.L','bon3QBar.3','bonG0.Y','bonD0.32']) assert.equal(isAuxiliaryName(name),true,name);
  for (const name of ['perm','nhdat','nhdat500','license','options','livelog','0Player.1','0Player.bn','bonD0.0','bonD0.33','bonD0.05','bonD0.5.gz','bonD0.5.bones','bonV0.5','bonM0.R','bonQFoo.3','bonQVal.T','bonD0.5/../record','../record']) assert.equal(isAuxiliaryName(name),false,name);
  const source = readFileSync(new URL('../upstream/NetHack-5.0.0/src/files.c',import.meta.url),'utf8');
  assert.match(source,/set_bonesfile_name\(char \*file, d_level \*lev\)/); assert.match(source,/set_bonestemp_name/);
});
test('auxiliary capture and hydrate preserve exact bytes, exclude locks, and validate before mutation',() => {
  const entries = new Map([['record',new Uint8Array()],['logfile',new Uint8Array([97,10])],['bonD0.5',new Uint8Array([0,255,128])],['0Player.bn',new Uint8Array([1])],['nhdat',new Uint8Array([2])],['bonQVal.L',null]]);
  const FS = {readdir:() => [...entries.keys()],stat:path => ({mode:entries.get(path.slice(1)) === null ? 0 : 1}),isFile:mode => mode === 1,readFile:path => entries.get(path.slice(1)),unlink:path => { entries.delete(path.slice(1)); },writeFile:(path,bytes) => { entries.set(path.slice(1),bytes); }};
  const payload = snapshotAuxiliaryFiles(FS);
  assert.deepEqual(payload.files.map(file => file.name),['bonD0.5','logfile','record']);
  assert.deepEqual(Array.from(validateAuxiliaryPayload(payload).files[0].bytes),[0,255,128]);
  const store = new SaveStore(null); store.unwrap = value => JSON.parse(value);
  const before = [...entries.keys()];
  assert.throws(() => store.hydrateAuxiliary(FS,JSON.stringify({...payload,files:[...payload.files,{name:'nhdat',data:'AQ=='}]})),/Unsafe/);
  assert.deepEqual([...entries.keys()],before);
  store.hydrateAuxiliary(FS,JSON.stringify({...payload,files:[{name:'record',data:'Qg=='}]}));
  assert.equal(entries.has('bonD0.5'),false); assert.equal(entries.has('0Player.bn'),true); assert.equal(entries.has('nhdat'),true); assert.deepEqual(Array.from(entries.get('record')),[66]);
});
test('save and auxiliary envelopes share one awaited IndexedDB transaction and invalid state cannot write',async () => {
  const store = new SaveStore(null);
  store.decode = value => { assert.equal(value,'completed'); return {}; };
  store.decodeAuxiliary = value => { assert.equal(value,'history'); return {}; };
  const operations = [];
  let transaction;
  store.database = async () => ({transaction(name,mode) { assert.equal(name,'saves'); assert.equal(mode,'readwrite'); transaction = {objectStore:() => ({put:(value,key) => operations.push(['put',key,value]),delete:key => operations.push(['delete',key])})}; return transaction; }});
  let resolved = false;
  const write = store.writeState({latest:'completed',auxiliary:'history'}).then(() => { resolved = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(resolved,false); assert.deepEqual(operations,[['put','latest','completed'],['put','auxiliary','history']]);
  transaction.oncomplete(); await write; assert.equal(resolved,true);
  const failed = store.writeState({latest:null,auxiliary:'history'});
  await new Promise(resolve => setImmediate(resolve)); transaction.error = new Error('quota'); transaction.onabort(); await assert.rejects(failed,/quota/);
  const count = operations.length; await assert.rejects(store.writeState({latest:'invalid',auxiliary:'history'})); assert.equal(operations.length,count);
});
test('browser catalogs have matching semantic IDs, typed argument placeholders, and Japanese default copy',() => {
  const catalog = JSON.parse(readFileSync(new URL('../web/browser-ui.json',import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(catalog.en).sort(),Object.keys(catalog.ja).sort());
  for (const [id,en] of Object.entries(catalog.en)) {
    const placeholders = text => [...text.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort();
    assert.match(id,/^ui\.[a-z][a-z0-9_]+$/); assert.deepEqual(placeholders(en),placeholders(catalog.ja[id]),id);
  }
  assert.match(catalog.ja['ui.translation_notice'],/画面操作は日本語、ゲーム本文は英語/);
});
