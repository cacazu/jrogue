import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import * as protocol from '../web/protocol.js';
import {stripRecentAnnotations} from './native-annotations.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const replay = /\/\* AB_REPLAY_BEGIN \*\/[\s\S]*?\/\* AB_REPLAY_END \*\//g;
// The historical replay snapshot includes three LF residues introduced by
// tagged death insertions. The later death byte-parity repair restored the
// original CRLF. Keep both immutable pins and repair only those exact three
// snapshot boundaries in the test: current production receives no repair.
const historicalScoreSha='9b1e2832196fa50119412872076bd71178c1b99b6c7c4e553b02c246e7f91a9c';
const originalScoreSha='f6352dead463e3738a7857e0ddae0d5e8e0c84973169bb2d43cf01bd414509ba';
function replayBaseline(file, suppliedBytes) {
  const bytes=suppliedBytes??fs.readFileSync(path.join(root,'tests/replay-source-snapshot',file));
  let source=stripRecentAnnotations(bytes.toString('utf8')).replace(replay,'');
  if(file!=='score.c')return Buffer.from(source);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),historicalScoreSha,'immutable historical score snapshot');
  const original=fs.readFileSync(path.join(root,'tests/first-naming-build-snapshot/source/logic/score.c'));
  assert.equal(crypto.createHash('sha256').update(original).digest('hex'),originalScoreSha,'immutable original native score pin');
  const raw=bytes.toString('utf8');
  assert.ok(raw.includes('#include "angband.h"\n#include "web-death-cause.h" /* AB_DEATH_INCLUDE */\n#include "buildid.h"'));
  assert.ok(raw.includes('highscore_add(&entry, scores, N_ELEMENTS(scores));\n#ifdef __EMSCRIPTEN__ /* AB_DEATH */\n'));
  assert.ok(raw.includes('#endif /* AB_DEATH */\n\t\thighscore_write(scores, N_ELEMENTS(scores));\n\t}'));
  const boundaries=[
    '#include "angband.h"\n#include "buildid.h"',
    '\t\thighscore_add(&entry, scores, N_ELEMENTS(scores));\n\t\thighscore_write(scores, N_ELEMENTS(scores));',
    '\t\thighscore_write(scores, N_ELEMENTS(scores));\n\t}'
  ];
  assert.equal([...source.matchAll(/(?<!\r)\n/g)].length,3,'only the three identified insertion residues');
  for(const boundary of boundaries){
    assert.equal(source.split(boundary).length-1,1,'unique tagged native boundary');
    source=source.replace(boundary,boundary.replace('\n','\r\n'));
  }
  assert.deepEqual(Buffer.from(source),original,'zero other historical/native byte changes');
  return Buffer.from(source);
}

const scalarDraft = text => ({text,composing:false,selectionStart:text.length,selectionEnd:text.length,selectionDirection:'none',focused:true});
function worker() {
  const messages = [], calls = [];
  const memory = new ArrayBuffer(1024 * 1024);
  let allocated = 4096;
  const engine = {HEAPU8:new Uint8Array(memory),HEAPU32:new Uint32Array(memory),
    _malloc:length => { const pointer = allocated; allocated += Math.ceil(length / 4) * 4; return pointer; },
    _free:() => {},
    ccall:(name, result, types, args) => { calls.push({name,args}); return 0; }};
  const context = vm.createContext({self:{postMessage:message => messages.push(message)},TextEncoder,TextDecoder,
    Uint8Array,Uint32Array,URL,console,__protocol:protocol,__engine:engine});
  vm.runInContext(read('web/worker.js'),context);
  vm.runInContext('protocol=__protocol;engine=__engine;acceptingInput=true;',context);
  return {context,messages,calls,engine,send:message => context.self.onmessage({data:message}),
    queue:() => JSON.parse(vm.runInContext('JSON.stringify(pendingEvents.map(v=>Array.from(v)))',context)),
    value:source => vm.runInContext(source,context)};
}

test('unchanged reserved files reconstruct exact bytes and all12 native clock expressions remain unchanged', () => {
  // Other owners subsequently added source hooks in player-util, ui-death and
  // ui-input. Their own parity suites reconstruct those independent phases.
  for (const file of ['mon-make.c','z-rand.c','score.c','z-file.c']) {
    assert.deepEqual(Buffer.from(stripRecentAnnotations(read('logic/' + file)).replace(replay,'')),
      replayBaseline(file),file);
  }
  const sites = JSON.parse(read('tests/replay-source-snapshot/clock-sites.json'));
  assert.equal(sites.length,12);
  for (const site of sites) {
    const source = read('logic/' + site.file);
    assert.equal(source.split(site.replacement).length - 1,1,site.replacement);
    const at = source.indexOf(site.replacement), window = source.slice(at,at + site.replacement.length + 180);
    assert.ok(window.includes('#else') && window.includes(site.original),site.replacement);
  }
});

test('score bridge refuses any changed historical bytes instead of normalizing source generally', () => {
  const raw=fs.readFileSync(path.join(root,'tests/replay-source-snapshot/score.c'));
  const changed=Buffer.from(raw);changed[100]^=1;
  assert.throws(()=>replayBaseline('score.c',changed),/immutable historical score snapshot/);
  assert.throws(()=>replayBaseline('score.c',Buffer.concat([raw,Buffer.from('\n')])),/immutable historical score snapshot/);
});

test('environment veneers call each original provider once live and consume owned replay facts', () => {
  const source = read('logic/web-replay-environment.c').replace(/\/\*[\s\S]*?\*\//g,'');
  for (const native of ['time(out)','localtime(value)','ctime(value)','getpid()']) assert.equal(source.split(native).length - 1,1,native);
  assert.doesNotMatch(source,/\b(?:randint\w*|Rand\w*|one_in_|Term_\w*|msg|msgt|object_desc|monster_desc)\s*\(/);
  assert.match(source,/if\(replay && result\) ab_replay_bad\(\)/);
  assert.match(source,/memcmp\(p,context,n\) \|\| p\[n\]>1/);
  assert.match(source,/memchr\(p,0,len-1\)/);
  const adapter = read('logic/main-web.c');
  const branch = adapter.slice(adapter.indexOf('if (ab_rs_replay_enabled()) {'),adapter.indexOf('if (!character_generated ||'));
  assert.doesNotMatch(branch,/savefile_save|snapshot_rng|Term_|fopen|Rand/);
  assert.ok(branch.indexOf('ab_host_sync_pending') < branch.indexOf('ab_rs_replay_save'));
  assert.ok(adapter.indexOf('mode = ab_rs_replay_wait') < adapter.indexOf('if (mode == 2) ab_host_replay_target'));
  assert.match(adapter,/memset\(words, 0, sizeof\(words\)\);[\s\S]*?!ab_host_event\(words/);
});

test('version-aware cap and exact four-part identity reject unknown or mixed contracts', () => {
  assert.equal(protocol.MAX_ENVELOPE_BYTES,40 * 1024 * 1024);
  assert.equal(protocol.LEGACY_MAX_ENVELOPE_BYTES,36_700_381);
  const bytes = new TextEncoder().encode('ABRSAVE\0\x03\0');
  assert.equal(protocol.envelopeVersion(bytes),3);
  bytes[8]=4;assert.throws(() => protocol.envelopeVersion(bytes));
  assert.throws(() => protocol.replayIdentity({replayIdentity:{engine:'00'.repeat(32)}}));
  const identity = protocol.replayIdentity({replayIdentity:{engine:'01'.repeat(32),data:'02'.repeat(32),input:'03'.repeat(32),semantic:'04'.repeat(32)}});
  assert.deepEqual(Array.from(identity),[...Array(32).fill(1),...Array(32).fill(2),...Array(32).fill(3),...Array(32).fill(4)]);
});

test('exact16 packet facts preserve native key normalization, pointer-grid and resize bounds', () => {
  assert.equal(protocol.keyPacket(0x65e5,true)[8],1);
  assert.equal(protocol.keyPacket(0x1f409)[1],0x1f409);
  assert.throws(() => protocol.keyPacket(0xd800));
  assert.throws(() => protocol.keyPacket(97 | 1 << 21),'unnormalized control letter');
  assert.equal(protocol.keyPacket(1)[1],1);
  const mouse = protocol.nativePacket({kind:'mouse',x:255,y:0,button:3,mods:15});
  assert.equal(protocol.validPacket(mouse),true);
  assert.throws(() => protocol.nativePacket({kind:'mouse',x:256,y:0,button:1,mods:0}));
  assert.throws(() => protocol.nativePacket({kind:'mouse',x:0.5,y:0,button:1,mods:0}));
  assert.equal(protocol.validPacket(protocol.nativePacket({kind:'resize',width:255,height:1})),true);
  assert.throws(() => protocol.nativePacket({kind:'resize',width:0,height:32}));
  const none = new Uint32Array(16);
  assert.equal(protocol.validPacket(none,false),true);assert.equal(protocol.validPacket(none,true),false);
  mouse[13]=1;assert.equal(protocol.validPacket(mouse),false);
});

test('atomic committed IME groups retain supplementary scalars and refuse whole overflow', () => {
  const value = worker();
  value.send({type:'text',payload:{text:'日🐉A',origin:3}});
  assert.deepEqual(value.queue().map(v=>v[1]),[0x65e5,0x1f409,65]);
  assert.deepEqual(value.queue().map(v=>v.slice(8,13)),[[3,1,0,0,3],[3,1,0,1,3],[3,1,0,2,3]]);
  assert.equal(value.messages[0].type,'text-accepted');
  const before = value.queue();
  value.send({type:'text',payload:{text:'z'.repeat(254),origin:2}});
  assert.deepEqual(value.queue(),before);assert.equal(value.messages.at(-1).type,'input-error');
  assert.equal(value.value('nextGroup'),2n);
  for (const text of ['\ud800','\udc00','\0','', 'あ'.repeat(22000)]) assert.throws(() => protocol.textPackets(text,2,2n,256));
  assert.throws(() => protocol.textPackets('x',2,0n,256));
});

test('catch-up never accepts external input, draft changes or persistence requests', () => {
  const value = worker();value.value('catchingUp=true;acceptingInput=false');
  for (const message of [{type:'key',payload:97},{type:'event',payload:{kind:'resize',width:120,height:40}},
    {type:'text',payload:{text:'opaque',origin:2}},{type:'draft',payload:scalarDraft('opaque')},{type:'save'}]) value.send(message);
  assert.deepEqual(value.queue(),[]);
  assert.equal(value.calls.length,0);
  assert.deepEqual(value.messages.map(v=>v.type),['input-error','input-error','input-error','input-error','save-error']);
});

test('pending snapshot copies full exact queue and opaque draft before shared buffers change', () => {
  const value = worker();
  value.send({type:'key',payload:97,origin:'touch'});
  value.send({type:'text',payload:{text:'名前',origin:2}});
  value.send({type:'draft',payload:{...scalarDraft('日🐉本'),composing:true}});
  let owned;
  value.engine.ccall=(name,result,types,args)=>{
    if(name==='ab_rs_replay_pending_set') {
      const [p,count,c,n]=args;
      owned={queue:Array.from(value.engine.HEAPU32.slice(p/4,p/4+count*16)),context:protocol.decodeContext(value.engine.HEAPU8.slice(c,c+n))};
    }
    return 0;
  };
  assert.equal(value.value('syncPending()'),0);
  value.engine.HEAPU8.fill(255);
  assert.equal(owned.queue.length,48);assert.equal(owned.queue[8],1);
  assert.equal(owned.context.nextGroup,2n);assert.equal(owned.context.draft.text,'日🐉本');assert.equal(owned.context.draft.composing,true);
  value.value('draft={text:"bad"}');assert.equal(value.value('syncPending()'),45);
  assert.equal(owned.queue.length,48,'failure cannot substitute an empty snapshot');
});

test('filesystem environment is isolated, bounded, parent-ordered and excludes duplicate native payload', () => {
  const value = {schema_version:1,roots:protocol.MUTABLE_ROOTS,entries:[
    {path:'/data/user',kind:'directory',mode:493,atime:1000,mtime:1001},
    {path:'/data/user/prefs.prf',kind:'file',mode:420,atime:1000,mtime:1001,data:'5pel5pys'}]};
  assert.deepEqual(protocol.decodeEnvironment(protocol.encodeEnvironment(value)),value);
  for (const path of ['/data/gamedata/monster.txt','/data/user/../save/browser','/data/user//bad','/data/save/browser','/dev/random']) {
    const bad=structuredClone(value);bad.entries[1].path=path;assert.throws(() => protocol.encodeEnvironment(bad),path);
  }
  const bad=structuredClone(value);bad.entries.reverse();assert.throws(() => protocol.encodeEnvironment(bad));
  const extra=structuredClone(value);extra.entries[1].code='untrusted';assert.throws(() => protocol.encodeEnvironment(extra));
  const zero=protocol.encodeContext(1n,scalarDraft('日本🐉'));
  assert.equal(protocol.decodeContext(zero).draft.text,'日本🐉');
  const context=JSON.parse(new TextDecoder().decode(zero));context.next_group=[0,0];
  assert.throws(() => protocol.decodeContext(new TextEncoder().encode(JSON.stringify(context))));
});

test('verified target restores owned queue/draft and reads current pure cells without native redraw', () => {
  const value=worker(),packet=protocol.textPackets('日',3,8n,256)[0];
  const bytes=protocol.encodeContext(9n,{...scalarDraft('入力🐉'),composing:true});
  value.engine.HEAPU32.set(packet,256);
  value.engine.HEAPU8.set(bytes,2048);
  const frame={width:1,height:1,cells:[[65,1]],cursor:[0,0]};
  value.engine.UTF8ToString=()=>JSON.stringify(frame);
  value.engine.ccall=(name)=>{
    value.calls.push({name});
    return ({ab_rs_replay_target_pending_count:1,ab_rs_replay_target_pending_data:1024,
      ab_rs_replay_target_context_data:2048,ab_rs_replay_target_context_len:bytes.length,ab_rs_frame:512})[name]??0;
  };
  value.value('catchingUp=true;acceptingInput=false;reachedTarget()');
  value.engine.HEAPU8.fill(255);
  assert.equal(value.value('catchingUp'),false);assert.equal(value.value('acceptingInput'),true);
  assert.equal(value.value('nextGroup'),9n);assert.equal(value.value('draft.text'),'入力🐉');
  assert.deepEqual(value.queue(),[Array.from(packet)]);
  assert.deepEqual(value.messages.map(v=>v.type),['ready','frame','draft']);
  assert.deepEqual(JSON.parse(JSON.stringify(value.messages[1].payload)),frame);
  assert.doesNotMatch(value.calls.map(v=>v.name).join(','),/redraw|ab_run|input/);
});

test('C/JS/Rust replay exports and ownership remain aligned across the source-only boundary', () => {
  const c=read('logic/web-replay-environment.h'),rust=read('rust/src/replay_bridge.rs'),js=read('web/worker.js'),library=read('web/library.js');
  for(const symbol of new Set([...c.matchAll(/\b(ab_rs_replay_[a-z_]+)\s*\(/g)].map(v=>v[1]))) assert.ok(rust.includes('fn '+symbol+'('),symbol);
  for(const symbol of new Set([...js.matchAll(/['"](ab_rs_replay_[a-z_]+)['"]/g)].map(v=>v[1]))) {
    if(!symbol.endsWith('_context')&&!symbol.endsWith('_native')&&!symbol.endsWith('_environment')) assert.ok(rust.includes('fn '+symbol+'('),symbol);
  }
  for(const symbol of ['ab_host_event','ab_host_sync_pending','ab_host_replay_target']) assert.ok(library.includes(symbol+':'),symbol);
  assert.match(library,/HEAPU32\.set\(packet, p >>> 2\)/);
  assert.match(js,/if \(catchingUp\) throw new Error\('Replay attempted external persistence'\)/);
  assert.match(js,/const framePointer = call\('ab_rs_frame'\)/,'target uses pure cached cells');
  assert.doesNotMatch(js,/Term_redraw|ab_host_key|pendingKeys|Date\.now|Math\.random/);
});
