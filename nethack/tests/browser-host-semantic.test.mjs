/* Phase 3 pure/mock semantic adapter checks. No compiled engine is loaded.
 * Compiled ABI/browser acceptance remains pending parent heavy-job release. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { immutableTextEvent, serializeTextEvent, immutableGameplayEnvelope, immutableQuestContext, serializeGameplayEnvelope, QuestGroupTracker, ShimHost, RustLayers } from '../web/shim-host.mjs';
import { DomUI } from '../web/dom-ui.mjs';

const makeEnvelope = () => ({event:{id:'nh.message.you_notice.20eac40c70',args:{arg_1:{type:'text',value:'名 % {literal}'}}},context:{api:'You_see',helperVariant:'blind'}});
function fixture() {
  const bytes = new Uint8Array(8192);
  const view = new DataView(bytes.buffer);
  const calls = [];
  const module = {HEAPU8:bytes,next:2048,
    _malloc(size) { const ptr = this.next; this.next += Math.max(8,size); return ptr; },_free() {},
    getValue(ptr,type) { return type === 'i16' ? view.getInt16(ptr,true) : view.getInt32(ptr,true); },
    setValue(ptr,value,type) { if (type === 'i16') view.setInt16(ptr,value,true); else view.setInt32(ptr,value,true); },
    UTF8ToString(ptr) { let end = ptr; while (bytes[end]) end++; return new TextDecoder().decode(bytes.subarray(ptr,end)); },
    ccall() { return 0; }
  };
  const ui = {messages:[],frames:[],initialized() {},waiting() {},message(event,attr) { this.messages.push({event,attr}); },frame(frame) { this.frames.push(frame); },async menu(request) { this.menuRequest = request; return []; },async question(request) { this.questionRequest = request; return 121; },async text(request) { this.textRequest = request; return null; }};
  let envelope = makeEnvelope();
  const host = new ShimHost({module,layout:{anythingSize:8,menuItemSize:16,menuCountOffset:8,menuFlagsOffset:12,lineBufferSize:256},ui,globals:() => ({constants:{ATTR:{ATR_NOHISTORY:32,ATR_URGENT:16},STATUS_FIELD:{BL_CONDITION:22}}}),questArguments:() => ['arg_1','arg_2'],semanticReader:(name,window) => { calls.push({name,window}); return envelope; }});
  return {module,host,ui,calls,get envelope() { return envelope; },set envelope(value) { envelope = value; }};
}

test('typed events own all argument kinds and serialize i64/u64 without rounding',() => {
  const source = {id:'game.observation.20eac40c70',args:{arg_1:{type:'text',value:'自由 % {name}'},arg_2:{type:'integer',value:-(1n<<63n)},arg_3:{type:'unsigned',value:(1n<<64n)-1n},arg_4:{type:'boolean',value:true},arg_5:{type:'text_id',value:'entity.orc'}}};
  const owned = immutableTextEvent(source);
  source.args.arg_1.value = 'changed';
  assert.equal(owned.args.arg_1.value,'自由 % {name}');
  assert(Object.isFrozen(owned) && Object.isFrozen(owned.args) && Object.isFrozen(owned.args.arg_1));
  const json = serializeTextEvent(owned);
  assert.match(json,/"type":"integer","value":-9223372036854775808/);
  assert.match(json,/"type":"unsigned","value":18446744073709551615/);
  assert.match(json,/"type":"boolean","value":true/); assert.match(json,/"type":"text_id","value":"entity.orc"/);
});

test('unknown metadata and inexact typed integers fail rather than silently change values',() => {
  for (const [type,value] of [['integer',1.5],['unsigned',-1],['integer',Number.MAX_SAFE_INTEGER+1],['unsigned',1n<<64n],['boolean','false'],['text_id','invalid.123'],['text',4]]) assert.throws(() => immutableTextEvent({id:'game.test',args:{arg_1:{type,value}}}));
  assert.throws(() => immutableTextEvent({id:'game.test',args:{},effectIndex:1}));
  assert.throws(() => immutableTextEvent({id:'game.20eac40c7',args:{}}));
  assert.throws(() => immutableTextEvent({id:'game.20eac40c70.not_terminal',args:{}}));
});

test('nested public-name events are deeply owned and serialize typed integers exactly',() => {
  const inner = {id:'grammar.public_name',args:{base:{type:'text_id',value:'entity.orc'},owner:{type:'text',value:'名 % {owner}'},count:{type:'unsigned',value:(1n<<64n)-1n}}};
  const source = {id:'game.public_observation',args:{arg_1:{type:'event',value:inner}}};
  const owned = immutableTextEvent(source); inner.args.owner.value = 'later';
  assert.equal(owned.args.arg_1.type,'event'); assert.equal(owned.args.arg_1.value.args.owner.value,'名 % {owner}');
  assert(Object.isFrozen(owned.args.arg_1.value) && Object.isFrozen(owned.args.arg_1.value.args.owner));
  const json = serializeTextEvent(owned);
  assert.match(json,/"type":"event","value":\{"id":"grammar.public_name"/);
  assert.match(json,/"type":"unsigned","value":18446744073709551615/);
  assert.match(json,/名 % \{owner\}/);
});

test('nested event depths zero through eight are valid, while depth nine and cycles reject',() => {
  const chain = depth => {
    let event = {id:'entity.name',args:{}};
    for (let index=0;index<depth;index++) event = {id:'grammar.name',args:{name:{type:'event',value:event}}};
    return event;
  };
  assert.doesNotThrow(() => immutableTextEvent(chain(8))); assert.throws(() => immutableTextEvent(chain(9)),/depth/);
  const cycle = {id:'grammar.name',args:{}}; cycle.args.name = {type:'event',value:cycle};
  assert.throws(() => immutableTextEvent(cycle),/Cyclic/);
  assert.throws(() => immutableTextEvent({id:'grammar.name',args:{name:{type:'event',value:{id:'entity.name',args:{},hiddenState:4}}}}),/Invalid semantic/);
});

test('nested trees enforce aggregate node, argument, text and serialized-envelope bounds',() => {
  const names = count => Array.from({length:count},(_,index) => `arg_${index}`);
  const leaf = {id:'entity.name',args:{}};
  const branch = {id:'grammar.name',args:Object.fromEntries(names(64).map(name => [name,{type:'event',value:leaf}]))};
  const nodes = {id:'game.tree',args:Object.fromEntries(names(64).map(name => [name,{type:'event',value:branch}]))};
  assert.throws(() => immutableTextEvent(nodes),/node limit/);
  const numeric = {id:'grammar.values',args:Object.fromEntries(names(64).map(name => [name,{type:'integer',value:0}]))};
  const slots = {id:'game.tree',args:Object.fromEntries(names(64).map(name => [name,{type:'event',value:numeric}]))};
  assert.throws(() => immutableTextEvent(slots),/argument limit/);
  const literal = 'a'.repeat(65536);
  const text = {id:'game.text',args:Object.fromEntries(names(4).map(name => [name,{type:'text',value:literal}]))};
  assert.throws(() => immutableTextEvent(text),/byte limit/);
  const escaped = {id:'game.text',args:{arg_1:{type:'text',value:'"'.repeat(65536)},arg_2:{type:'text',value:'"'.repeat(65536)}}};
  assert.doesNotThrow(() => immutableTextEvent(escaped)); assert.throws(() => serializeTextEvent(escaped),/JSON exceeds/);
});

test('invalid nested native metadata preserves exact original-English callback and history',async () => {
  const data = fixture();
  data.envelope = {event:{id:'game.name',args:{arg_1:{type:'event',value:{id:'INVALID',args:{}}}}},context:{api:'pline',helperVariant:'plain'}};
  await data.host.callback('shim_raw_print','Exact original named object % {text}');
  assert.equal(data.ui.messages[0].event.id,'upstream.untranslated'); assert.equal(data.host.semanticCaptureFailures,1);
  assert.equal(await data.host.callback('shim_getmsghistory',true),'Exact original named object % {text}');
});

test('helper and accessibility context are owned separately from serde TextEvent',() => {
  const source = makeEnvelope(); source.context.locationPrefix = '(4, 8) 名 % {literal}: ';
  const owned = immutableGameplayEnvelope(source); source.context.helperVariant = 'plain';
  assert.equal(owned.context.helperVariant,'blind'); assert(Object.isFrozen(owned.context));
  const decoded = JSON.parse(serializeGameplayEnvelope(owned));
  assert.deepEqual(Object.keys(decoded.event).sort(),['args','id']); assert.equal(decoded.context.locationPrefix,'(4, 8) 名 % {literal}: ');
  assert.throws(() => immutableGameplayEnvelope({...source,context:{...source.context,hiddenState:1}}));
});

test('actual callback captures immutable semantic metadata while native saved history stays English',async () => {
  const data = fixture(); const {host,ui,calls} = data;
  const id = await host.callback('shim_create_nhwindow',1);
  await host.callback('shim_putstr',id,0,'You see source English.');
  data.envelope.event.args.arg_1.value = 'later native buffer';
  assert.equal(ui.messages[0].event.args.arg_1.value,'名 % {literal}'); assert.equal(ui.messages[0].event.sourceText,'You see source English.');
  assert.deepEqual(calls,[{name:'shim_putstr',window:id}]);
  assert.equal(await host.callback('shim_getmsghistory',true),'You see source English.');
  await host.callback('shim_putstr',id,32,'Transient source prompt.');
  assert.equal(host.history.length,1); assert.equal(ui.messages.length,2);
  assert.equal(await host.callback('shim_getmsghistory',false),null);
  for (let index = 0; index < 100; index++) host.redraw();
  assert.equal(calls.length,2); assert.equal(host.inbox.consumedTotal,0);
});

test('menu prompt is captured at native end_menu and accelerators/count ABI remain original',async () => {
  const data = fixture(); const {host,module,ui,calls} = data;
  const id = await host.callback('shim_create_nhwindow',4);
  module.setValue(128,1,'i32');
  await host.callback('shim_start_menu',id,0);
  await host.callback('shim_add_menu',id,0,128,97,65,0,7,'source item',0);
  await host.callback('shim_end_menu',id,'source prompt');
  data.envelope = null;
  await host.callback('shim_select_menu',id,1,256);
  assert.equal(ui.menuRequest.prompt.semantic,true); assert.equal(ui.menuRequest.prompt.sourceText,'source prompt');
  assert.equal(ui.menuRequest.items[0].accelerator,97); assert.equal(ui.menuRequest.items[0].groupAccelerator,65);
  assert.deepEqual(calls,[{name:'shim_add_menu',window:id},{name:'shim_end_menu',window:id}]);
});

test('semantic prompts preserve original response bytes; invalid metadata falls back explicitly',async () => {
  const data = fixture(); const {host,ui,calls} = data;
  assert.equal(await host.callback('shim_yn_function','source question','ynq',110),121);
  assert.equal(ui.questionRequest.responses,'ynq'); assert.equal(ui.questionRequest.defaultCode,110); assert.equal(ui.questionRequest.prompt.semantic,true);
  assert.deepEqual(calls,[{name:'shim_yn_function',window:-1}]);
  data.envelope = {event:{id:'INVALID',args:{}},context:{api:'pline',helperVariant:'plain'}};
  await host.callback('shim_raw_print','unchanged source English');
  assert.equal(ui.messages[0].event.id,'upstream.untranslated'); assert.equal(ui.messages[0].event.args.text,'unchanged source English'); assert.equal(host.semanticCaptureFailures,1);
});

test('status descriptors own source-selected labels/values while condition masks stay numeric',async () => {
  const data = fixture(); const {host,module,calls} = data;
  module.HEAPU8.set(new TextEncoder().encode('hit points'),512);
  module.HEAPU8.set(new TextEncoder().encode('%s'),768);
  module.HEAPU8.set(new TextEncoder().encode('16'),1024);
  await host.callback('shim_status_enablefield',18,512,768,true);
  await host.callback('shim_status_update',18,1024,1,100,7,0);
  const row = host.frame().status[0];
  data.envelope.event.args.arg_1.value = 'later metadata'; module.HEAPU8[1024] = 49;
  assert.equal(row.value,'16'); assert.equal(row.event.sourceText,'16'); assert.equal(row.event.args.arg_1.value,'名 % {literal}'); assert(Object.isFrozen(row));
  module.setValue(128,3,'i32'); await host.callback('shim_status_update',22,128,0,0,7,0);
  assert.equal(host.frame().status[1].condition,true); assert.equal(host.frame().status[1].value,3); assert.equal(host.frame().status[1].event,null);
  for (let index=0;index<100;index++) host.redraw();
  assert.deepEqual(calls,[{name:'shim_status_enablefield',window:-1},{name:'shim_status_update',window:-1}]);
});

test('transient and urgent attributes retain visible message but exclude it from UI history',() => {
  const ui = Object.create(DomUI.prototype); ui.messages = []; ui.renderMessages = () => {};
  const event = text => Object.freeze({id:'upstream.untranslated',args:Object.freeze({text}),translated:false});
  ui.message(event('normal source'),0); ui.message(event('transient one'),32); ui.message(event('urgent transient'),49);
  assert.equal(ui.messages.length,2); assert.equal(ui.messages[1].urgent,true); assert.equal(ui.messages[1].noHistory,true); assert(Object.isFrozen(ui.messages[1]));
  assert.deepEqual(ui.messages.filter(row => !row.noHistory).map(row => row.event.args.text),['normal source']);
  ui.message(event('next normal'),0); assert.deepEqual(ui.messages.map(row => row.event.args.text),['normal source','next normal']);
});

test('Rust gameplay adapter passes whole typed envelope to additive pure formatter ABI',() => {
  const bytes = new Uint8Array(16384); let next = 1024; const calls = [];
  const module = {HEAPU8:bytes,_malloc(size) { const at=next; next += Math.max(8,size); return at; },_free() {},ccall(name,_result,_types,args) { calls.push({name,args:[...args]}); if (name.endsWith('_fallback')) return 1; if (!args[5]) return 3; bytes.set(new TextEncoder().encode('abc'),args[5]); return 3; }};
  const layers = new RustLayers(module,{en:{'ui.test':'UI'},ja:{'ui.test':'画面'}});
  const schemas = {'nh.message.you_notice.20eac40c70':['arg_1','arg_2']};
  layers.setGameplayCatalog({en:{'nh.message.you_notice.20eac40c70':'You see {arg_1:%s}.'},ja:{'nh.message.you_notice.20eac40c70':'{arg_1:%s}が見える。'},argument_schemas:schemas});
  schemas['nh.message.you_notice.20eac40c70'].push('later_mutation');
  assert.deepEqual(layers.gameplayCatalog.argument_schemas['nh.message.you_notice.20eac40c70'],['arg_1','arg_2']);
  const source = makeEnvelope(); source.event.args.arg_2 = {type:'unsigned',value:4294967295};
  const result = layers.formatEvent(source,'ja');
  assert.deepEqual(result,{text:'abc',usedFallback:true,locale:'ja'});
  assert.deepEqual(calls.map(call => call.name),['nh_rust_format_gameplay','nh_rust_format_gameplay_fallback','nh_rust_format_gameplay']);
  const args = calls[0].args;
  const envelope = JSON.parse(new TextDecoder().decode(bytes.subarray(args[2],args[2]+args[3])));
  assert.equal(envelope.event.args.arg_1.type,'text'); assert.equal(envelope.context.helperVariant,'blind');
  assert.deepEqual(envelope.event.args.arg_2,{type:'unsigned',value:4294967295});
});

test('locale repaint updates active immutable observations and preserves draft/selection/input handler',() => {
  const prior = globalThis.document;
  globalThis.document = {documentElement:{},querySelectorAll:() => []};
  try {
    const ui = Object.create(DomUI.prototype); ui.locale = 'ja'; ui.semanticFormattingFailures = 0; ui.failedSemanticRecords = new WeakSet();
    ui.layers = {formatEvent:(_event,locale) => ({text:locale === 'ja' ? '日本語' : 'English',usedFallback:false,locale})};
    ui.els = {locale:{}}; ui.activeDialog = {bindings:[]}; ui.renderStatus = () => {}; ui.drawMap = () => {}; ui.renderMessages = () => {};
    const field = {value:'未確定 % {text}'}; const selected = new Map([[3,-1]]); const handler = () => {};
    ui.modalKey = handler;
    const element = {textContent:'',dataset:{}};
    const envelope = immutableGameplayEnvelope(makeEnvelope());
    const event = Object.freeze({...envelope.event,context:envelope.context,semantic:true,sourceText:'source English'});
    ui.bindEventText(element,event,'a  '); assert.equal(element.textContent,'a  日本語');
    ui.locale = 'en'; ui.translateUI(); assert.equal(element.textContent,'a  English');
    assert.equal(field.value,'未確定 % {text}'); assert.deepEqual([...selected],[[3,-1]]); assert.equal(ui.modalKey,handler);
  } finally { if (prior === undefined) delete globalThis.document; else globalThis.document = prior; }
});

test('missing semantic formatter/template preserves exact original English and visible fallback status',() => {
  const ui = Object.create(DomUI.prototype); ui.locale = 'ja'; ui.semanticFormattingFailures = 0; ui.failedSemanticRecords = new WeakSet();
  ui.layers = {formatEvent() { throw new Error('pending compiled ABI'); }};
  const envelope = immutableGameplayEnvelope(makeEnvelope());
  const event = Object.freeze({...envelope.event,context:envelope.context,semantic:true,sourceText:'Exact source % {text}'});
  for (let index=0;index<100;index++) assert.equal(ui.renderEvent(event).text,'Exact source % {text}');
  assert.equal(ui.renderEvent(event).translation,'semantic-unavailable-fallback'); assert.equal(ui.semanticFormattingFailures,1);
});

const questEnvelope = (lineIndex = 0,lineCount = 2,sequence = 1,args = {}) => ({event:{id:'quest.wizard.assignquest',args},context:{api:'pline',helperVariant:'plain',quest:{sequence,lineIndex,lineCount,final:lineIndex+1 === lineCount,captureComplete:true,window:1,resolvedSection:'Wiz',resolvedMessageId:'assignquest',itemIndex:0,field:'text',sourceTemplate:'Source %p paragraph.',decodedLine:`decoded diagnostic ${lineIndex}`}}});
function questFixture(names = ['arg_1','arg_2']) {
  const completed = [], invalidated = [];
  const tracker = new QuestGroupTracker({argumentsFor:() => names,complete:(token,event) => completed.push({token,event}),invalidate:token => invalidated.push(token)});
  const capture = (source,text = 'Native English row.',attr = 0,delivery = {callbackName:'shim_putstr',window:1}) => {
    const row = tracker.capture(immutableGameplayEnvelope(source),delivery,text,'message',attr);
    tracker.delivered(row); return row;
  };
  return {tracker,completed,invalidated,capture};
}
const typedText = value => ({type:'text',value});

test('quest coordinates are exactly validated and owned without using diagnostic text as identity',() => {
  const source = questEnvelope(); const owned = immutableGameplayEnvelope(source);
  source.context.quest.decodedLine = 'changed'; assert.equal(owned.context.quest.decodedLine,'decoded diagnostic 0');
  assert(Object.isFrozen(owned.context.quest));
  for (const patch of [{sequence:0},{sequence:4294967296},{lineCount:0},{lineCount:4097},{lineIndex:2},{final:true},{captureComplete:1},{window:2147483648},{field:'other'},{itemIndex:1},{field:'item',itemIndex:0},{resolvedSection:'a'.repeat(161)},{sourceTemplate:'a'.repeat(65537)},{unknown:1}]) assert.throws(() => immutableQuestContext({...owned.context.quest,...patch}));
  const missing = {...owned.context.quest}; delete missing.decodedLine; assert.throws(() => immutableQuestContext(missing));
  assert.equal(JSON.parse(serializeGameplayEnvelope(owned)).context.quest.sequence,1);
});

test('quest completion requires every delivered row and exact public union, then releases staging ownership',() => {
  const data = questFixture();
  const first = data.capture(questEnvelope(0,2,1,{arg_1:typedText('Public hero')}),'First original English.');
  assert.equal(data.completed.length,0); assert.equal(data.tracker.retainedRows,1);
  const final = immutableGameplayEnvelope(questEnvelope(1,2,1,{arg_1:typedText('Public hero'),arg_2:{type:'unsigned',value:4}}));
  const last = data.tracker.capture(final,{callbackName:'shim_putstr',window:1},'Second original English.','message',0);
  assert.equal(data.completed.length,0,'capture precedes actual window delivery');
  data.tracker.delivered(last); data.tracker.delivered(last);
  assert.equal(data.completed.length,1); const paragraph = data.completed[0].event;
  assert.equal(paragraph.questComplete,true); assert.equal(paragraph.context.quest.final,true);
  assert.equal(paragraph.sourceText,'First original English.\nSecond original English.');
  assert.equal(paragraph.originalRows[0].event,first); assert.equal(paragraph.originalRows[1].event,last);
  assert.equal(paragraph.args.arg_2.type,'unsigned'); assert(Object.isFrozen(paragraph.originalRows));
  assert.equal(data.tracker.retainedRows,0); assert.equal(data.tracker.retainedBytes,0);
});

test('missing, unknown, incomplete or conflicting quest arguments retain original rows',() => {
  for (const mode of ['missing-line','unknown-schema','missing-union','extra-union','incomplete','conflict']) {
    const data = questFixture(mode === 'unknown-schema' ? null : ['arg_1','arg_2']);
    if (mode !== 'missing-line') data.capture(questEnvelope(0,2,1,{arg_1:typedText('Public hero')}),'Original one.');
    const args = {arg_1:typedText(mode === 'conflict' ? 'Different hero' : 'Public hero')};
    if (mode !== 'missing-union') args.arg_2 = {type:'integer',value:2};
    if (mode === 'extra-union') args.extra = typedText('undeclared');
    const source = questEnvelope(1,2,1,args); if (mode === 'incomplete') source.context.quest.captureComplete = false;
    const row = data.capture(source,'Exact original final.');
    assert.equal(data.completed.length,0,mode); assert.equal(row.sourceText,'Exact original final.'); assert.equal(data.tracker.retainedRows,0);
  }
});

test('quest repeated nested arguments compare typed trees exactly, including integer token representations',() => {
  const name = value => ({type:'event',value:{id:'grammar.public_name',args:{base:{type:'text_id',value:'entity.orc'},count:{type:'unsigned',value}}}});
  const equal = questFixture(['arg_1']); equal.capture(questEnvelope(0,2,1,{arg_1:name(4)})); equal.capture(questEnvelope(1,2,1,{arg_1:name(4n)}));
  assert.equal(equal.completed.length,1); assert.equal(equal.completed[0].event.args.arg_1.type,'event');
  const different = questFixture(['arg_1']); different.capture(questEnvelope(0,2,1,{arg_1:name(4)})); different.capture(questEnvelope(1,2,1,{arg_1:name(5)}));
  assert.equal(different.completed.length,0); assert.equal(different.tracker.retainedRows,0);
});

test('quest identity rejects changed native associations, helpers, attributes and duplicate indexes',() => {
  for (const mode of ['window','callback','id','count','section','message','field','api','helper','attr','duplicate']) {
    const data = questFixture([]); data.capture(questEnvelope(),'Original first.');
    const source = questEnvelope(1); let attr = 0, delivery = {callbackName:'shim_putstr',window:1};
    if (mode === 'window') { source.context.quest.window = 2; delivery.window = 2; }
    if (mode === 'callback') delivery.callbackName = 'shim_raw_print';
    if (mode === 'id') source.event.id = 'quest.wizard.other';
    if (mode === 'count') { source.context.quest.lineCount = 3; source.context.quest.final = false; }
    if (mode === 'section') source.context.quest.resolvedSection = 'Val';
    if (mode === 'message') source.context.quest.resolvedMessageId = 'other';
    if (mode === 'field') { source.context.quest.field = 'item'; source.context.quest.itemIndex = 1; }
    if (mode === 'api') source.context.api = 'You';
    if (mode === 'helper') source.context.helperVariant = 'dream';
    if (mode === 'attr') attr = 16;
    if (mode === 'duplicate') { source.context.quest.lineIndex = 0; source.context.quest.final = false; }
    data.capture(source,'Original next.',attr,delivery);
    assert.equal(data.completed.length,0,mode); assert.equal(data.invalidated.length,1,mode); assert.equal(data.tracker.retainedRows,0);
  }
});

test('multi-line accessibility qualification fails closed, while a single line preserves its captured prefix',() => {
  for (const index of [0,1]) {
    const data = questFixture([]); const first = questEnvelope(0),last = questEnvelope(1);
    (index ? last : first).context.locationPrefix = '(4, 8): ';
    data.capture(first,'Qualified native first.'); data.capture(last,'Native final.');
    assert.equal(data.completed.length,0); assert.equal(data.tracker.retainedRows,0);
  }
  const single = questFixture([]), source = questEnvelope(0,1); source.context.locationPrefix = '(4, 8): ';
  single.capture(source,'(4, 8): Exact native single.');
  assert.equal(single.completed[0].event.context.locationPrefix,'(4, 8): ');
});

test('quest overlay renders a complete contiguous group once and preserves every immutable native row',() => {
  const data = questFixture([]), first = data.capture(questEnvelope(0),'Native first.',16), last = data.capture(questEnvelope(1),'Native last.',16);
  const ui = Object.create(DomUI.prototype); ui.questPresentations = new WeakMap(); ui.locale = 'ja'; ui.failedSemanticRecords = new WeakSet(); ui.semanticFormattingFailures = 0;
  ui.renderMessages = () => {}; const binding = () => {}; ui.activeDialog = {bindings:[binding]};
  const formats = []; ui.layers = {formatEvent(envelope,locale) { formats.push(envelope); return {text:locale === 'ja' ? '日本語の段落。' : 'English paragraph.',usedFallback:false,locale}; }};
  const rows = [Object.freeze({event:first,attr:16,urgent:true}),Object.freeze({event:last,attr:16,urgent:true})];
  assert.equal(ui.renderEvent(first).text,'Native first.'); assert.equal(formats.length,0);
  ui.questGroupCompleted(data.completed[0].token,data.completed[0].event);
  const visible = ui.presentationRows(rows); assert.equal(visible.length,1); assert.equal(visible[0].rendered.text,'日本語の段落。'); assert.equal(visible[0].urgent,true);
  ui.locale = 'en'; assert.equal(ui.presentationRows(rows)[0].rendered.text,'English paragraph.');
  assert.equal(first.sourceText,'Native first.'); assert.equal(last.sourceText,'Native last.'); assert(Object.isFrozen(first));
  assert.equal(ui.presentationRows([rows[1]]).length,1); assert.equal(ui.renderEvent(ui.presentationRows([rows[1]])[0].event).text,'Native last.');
  const unrelated = {event:{id:'upstream.untranslated',args:{text:'Interleaved original'},translated:false}};
  assert.equal(ui.presentationRows([rows[0],unrelated,rows[1]]).length,3);
  ui.layers.formatEvent = () => { throw new Error('Uncompiled gameplay formatter'); };
  assert.deepEqual(ui.presentationRows(rows).map(row => ui.textOf(row.event)),['Native first.','Native last.']);
  ui.questGroupInvalidated(data.completed[0].token); assert.equal(ui.questPresentations.has(data.completed[0].token),false);
});

test('actual quest callback overlay preserves native English saved history and rejects late duplicates',async () => {
  const data = fixture(); const completed = [], invalidated = [];
  data.ui.questGroupCompleted = (token,event) => completed.push({token,event}); data.ui.questGroupInvalidated = token => invalidated.push(token);
  const window = await data.host.callback('shim_create_nhwindow',1);
  data.envelope = questEnvelope(0,2,1,{arg_1:typedText('Observed hero')}); data.envelope.context.quest.window = window;
  await data.host.callback('shim_putstr',window,16,'Original quest first.');
  data.envelope = questEnvelope(1,2,1,{arg_1:typedText('Observed hero'),arg_2:{type:'integer',value:4}}); data.envelope.context.quest.window = window;
  await data.host.callback('shim_putstr',window,16,'Original quest last.');
  assert.equal(completed.length,1); assert.equal(data.ui.messages.length,2);
  assert.equal(await data.host.callback('shim_getmsghistory',true),'Original quest first.');
  assert.equal(await data.host.callback('shim_getmsghistory',false),'Original quest last.');
  await data.host.callback('shim_putstr',window,16,'Duplicate original final.');
  assert.equal(invalidated.length,1); assert.equal(completed.length,1); assert.equal(data.host.history.at(-1).sourceText,'Duplicate original final.');
  assert.equal(data.calls.length,3); for (let index=0;index<100;index++) data.host.redraw(); assert.equal(data.calls.length,3);
});

test('quest collection rejects cleared windows and old sequences, and bounds unfinished staging',() => {
  const discarded = questFixture([]); discarded.capture(questEnvelope(0),'Original first.'); discarded.tracker.discardWindow(1);
  discarded.capture(questEnvelope(1),'Original after clear.'); assert.equal(discarded.completed.length,0);
  const old = questFixture([]); old.tracker.rejectSequence(10); old.capture(questEnvelope(0,1,10),'Rejected sequence.'); assert.equal(old.completed.length,0);
  const bound = questFixture([]);
  for (let sequence=1;sequence<=1001;sequence++) bound.capture(questEnvelope(0,2,sequence),'Bounded original.');
  assert.equal(bound.tracker.groups.size,1000); assert.equal(bound.tracker.retainedRows,1000); assert.equal(bound.completed.length,0);
  const bytes = questFixture([]);
  for (let index=0;index<64;index++) {
    const source = questEnvelope(index,128); source.context.quest.sourceTemplate = 's'.repeat(65536); source.context.quest.decodedLine = 'd'.repeat(65536);
    bytes.capture(source,'e'.repeat(65536));
    assert(bytes.tracker.retainedBytes <= 8*1024*1024);
  }
  assert.equal(bytes.tracker.retainedBytes,0); assert.equal(bytes.tracker.retainedRows,0); assert.equal(bytes.completed.length,0);
});
