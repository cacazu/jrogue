import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {webcrypto} from "node:crypto";
import {
  SOURCE_COMMIT, ENGINE_COMMIT, validateBuild, validateManifest, fetchVerified, sha256,
  createEventQueue, createFrameTransport, projectUILocales, createTextCommitter, keyboardDTO, pointerCell, drawProjection, captureProbe,
} from "../web/game.mjs";

const identity = {format:"drl-original-core",source_commit:SOURCE_COMMIT,engine_commit:ENGINE_COMMIT,
  engine_save:"0.10.11",module:"drl",module_save:"0.10.11",platform_abi:1};
const descriptor = file => ({file,size:8,sha256:"0".repeat(64)});
const build = () => ({schema_version:1,identity:{...identity},core:descriptor("drl-core.wasm"),adapter:descriptor("drl_web_port.wasm")});
const packet = value => { const bytes = new Uint8Array(128);new DataView(bytes.buffer).setUint32(0,1,true);bytes[8] = value;return bytes; };

test("original-core UI manifests pin sources, native save ABI and safe immutable asset types", async () => {
  const value = validateBuild(build());
  assert.deepEqual(value.identity,identity);
  const reordered = build();reordered.identity = Object.fromEntries(Object.entries(identity).reverse());
  assert.equal(JSON.stringify(validateBuild(reordered).identity),JSON.stringify(value.identity));
  for (const corrupt of [() => { const v = build();v.core.file = "other.wasm";return v; },
    () => { const v = build();v.identity.module_save = "0.10.12";return v; },
    () => { const v = build();v.core.sha256 = "a";return v; }]) assert.throws(() => validateBuild(corrupt()),/game.artifact_error/);
  const manifest = JSON.parse(await readFile(new URL("../dist/core-assets.json",import.meta.url),"utf8"));
  assert.equal(validateManifest(manifest),manifest);
  assert.ok(manifest.files.length >= 90);
  for (const patch of [{path:"data/../user/save"},{url:"https://example.com/data.lua"},
    {license:"proprietary"},{size:196609},{path:"data/audio.wav",url:"assets/data/audio.wav"}]) {
    const corrupt = structuredClone(manifest);Object.assign(corrupt.files[0],patch);
    assert.throws(() => validateManifest(corrupt),/game.artifact_error/);
  }
});

test("verified streaming fetch rejects truncation, excess bytes and wrong hashes before execution", async () => {
  const bytes = Uint8Array.of(0,97,115,109,1,0,0,0),hash = await sha256(bytes,webcrypto);
  const value = {file:"drl-core.wasm",size:bytes.length,sha256:hash};
  const fetcher = data => async () => new Response(data);
  assert.deepEqual(await fetchVerified(value,{fetch:fetcher(bytes),crypto:webcrypto}),bytes);
  await assert.rejects(fetchVerified(value,{fetch:fetcher(bytes.subarray(0,7)),crypto:webcrypto}),/size mismatch/);
  await assert.rejects(fetchVerified(value,{fetch:fetcher(new Uint8Array(9)),crypto:webcrypto}),/exceeds declared size/);
  await assert.rejects(fetchVerified({...value,sha256:"0".repeat(64)},{fetch:fetcher(bytes),crypto:webcrypto}),/SHA-256 mismatch/);
  await assert.rejects(fetchVerified({...value,file:"../drl-core.wasm"},{fetch:fetcher(bytes),crypto:webcrypto}),/download descriptor/);
});

test("input packets are copied, bounded and atomically queued with native peek semantics", () => {
  const queue = createEventQueue(2),one = packet(7),two = packet(8);
  queue.append([one]);one[8] = 99;
  const peek = queue.poll(true);assert.equal(peek[8],7);peek[8] = 55;
  assert.equal(queue.poll(true)[8],7);
  assert.throws(() => queue.append([two,packet(9)]),/event quota/);
  assert.equal(queue.length,1);
  assert.throws(() => queue.append([new Uint8Array(128)]),/packet version/);
  assert.equal(queue.length,1);
  queue.append([two]);assert.equal(queue.poll(false)[8],7);assert.equal(queue.poll(false)[8],8);
  assert.equal(queue.poll(false),null);assert.equal(queue.pending,false);
});

test("one original DRLF consumes exactly its preceding ordered draw commands", () => {
  const calls = [],presented = [],state = {rng:[1,2,3]};
  const projection = {width:80,height:25,cursor:null,glyphs:[],commands:[]};
  const frames = createFrameTransport(value => {calls.push(value);return {presentation:projection};},value => presented.push(value));
  frames.draw(Uint8Array.of(1),Uint8Array.of(2));frames.draw(Uint8Array.of(3),Uint8Array.of(4));
  frames.frame(Uint8Array.of(5));frames.frame(Uint8Array.of(6));
  assert.deepEqual(calls[0].commands,[{header:[1],text:[2]},{header:[3],text:[4]}]);
  assert.deepEqual(calls[1].commands,[]);
  const before = JSON.stringify(state);frames.replay();frames.replay();
  assert.equal(calls.length,2);assert.equal(presented.length,4);assert.equal(JSON.stringify(state),before);
});

test("runtime UI labels use strict Rust NativeText projection and match bootstrap coverage", () => {
  const calls = [],bootstrap = {en:{"game.title":"DRL","game.start":"Launch"},ja:{"game.title":"DRL","game.start":"起動"}};
  const platform = request => {calls.push(request);return {semantic:{text:bootstrap[request.english ? "en" : "ja"][request.id]}};};
  const result = projectUILocales(platform,bootstrap);
  assert.deepEqual(result,bootstrap);assert.notEqual(result,bootstrap);
  assert.equal(calls.length,4);
  for (const request of calls) {assert.equal(request.kind,"native_text");assert.deepEqual(request.parameters,{});}
  assert.equal(calls.filter(request => request.english).length,2);
  assert.throws(() => projectUILocales(() => ({semantic:{text:null}}),bootstrap),/UI catalog mismatch/);
  assert.throws(() => projectUILocales(() => ({semantic:{text:"wrong"}}),bootstrap),/UI catalog mismatch/);
});

test("DOM coordinates remain zero based and physical keyboard metadata reaches Rust unchanged", () => {
  const bounds = {left:10,top:20,width:400,height:250};
  assert.deepEqual(pointerCell({clientX:10,clientY:20},bounds),{x:0,y:0});
  assert.deepEqual(pointerCell({clientX:409,clientY:269},bounds),{x:79,y:24});
  assert.equal(pointerCell({clientX:410,clientY:20},bounds),null);
  assert.equal(pointerCell({clientX:9,clientY:20},bounds),null);
  const dto = keyboardDTO({key:"1",code:"Numpad1",location:3,shiftKey:true,isComposing:true,keyCode:229},true);
  assert.equal(dto.code,"Numpad1");assert.equal(dto.location,3);assert.equal(dto.shiftKey,true);
  assert.equal(dto.isComposing,true);assert.equal(dto.editableTarget,true);assert.equal(dto.keyCode,229);
});

test("committed ASCII and IME text have one transport path and failed commits retain editable text", () => {
  const sent = [];let clears = 0;
  const commit = createTextCommitter(text => { if (text === "too large") throw new Error("rejected"); sent.push(text); },() => clears++);
  commit.input({data:"a",inputType:"insertText",isComposing:false},"a");
  commit.start();commit.input({data:"に",inputType:"insertCompositionText",isComposing:true},"に");
  commit.input({data:"日本",inputType:"insertCompositionText",isComposing:true},"日本");
  assert.deepEqual(sent,["a"]);assert.equal(commit.composing,true);
  commit.end("日本");commit.input({data:"日本",inputType:"insertFromComposition",isComposing:false},"");
  commit.input({data:null,inputType:"insertFromPaste",isComposing:false},"name_123");
  assert.deepEqual(sent,["a","日本","name_123"]);assert.equal(commit.composing,false);
  const before = clears;
  assert.throws(() => commit.input({data:"too large",inputType:"insertText",isComposing:false},"too large"),/rejected/);
  assert.equal(clears,before);
});

test("canvas renderer consumes Rust CJK columns and ordered primitives without width inference", () => {
  const calls = [];
  const context = {canvas:{style:{}},setTransform:(...args) => calls.push(["transform",...args]),
    fillRect:(...args) => calls.push(["rect",...args]),fillText:(...args) => calls.push(["text",...args]),
    strokeRect:(...args) => calls.push(["cursor",...args])};
  const glyph = (x,y,text,columns = 1) => ({x,y,text,columns,foreground:"#ffffff",background:"#000000"});
  const projection = {width:80,height:25,cursor:[2,3],glyphs:[glyph(0,0,"A")],
    commands:[{kind:"glyph",...glyph(1,0,"日本",4)},{kind:"glyph",...glyph(5,0,"e\u0301")}]};
  const frozen = JSON.stringify(projection);
  const result = drawProjection(context,projection,{fontSize:18,pixelRatio:2});
  assert.equal(result.width,880);assert.equal(result.height,625);
  assert.ok(result.text.startsWith("A日本e\u0301"));
  assert.deepEqual(calls.find(call => call[0] === "text" && call[1] === "日本"),["text","日本",11,12.5,44]);
  assert.equal(context.canvas.width,1760);assert.equal(context.canvas.height,1250);
  assert.equal(JSON.stringify(projection),frozen);
});

test("diagnostic capture copies original RNG bytes with strict DRLP range validation", () => {
  const memory = new WebAssembly.Memory({initial:1}),buffer = new Uint8Array(memory.buffer,128,132),view = new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);
  view.setUint32(0,0x504c5244,true);view.setUint32(4,1,true);view.setUint32(8,128,true);view.setUint32(12,4,true);
  view.setUint32(20,123,true);buffer.set([9,8,7,6],128);
  const api = {memory,drl_probe_capture:() => 132,drl_probe_buffer:() => 128,drl_probe_capacity:() => 8192};
  const result = captureProbe(api);assert.equal(result.seed,123);assert.deepEqual(result.rng,[9,8,7,6]);
  buffer[128] = 0;assert.deepEqual(result.rng,[9,8,7,6]);
  view.setUint32(12,5,true);assert.throws(() => captureProbe(api),/probe header/);
  assert.equal(captureProbe({...api,drl_probe_capture:() => -1}),null);
});

test("Japanese default and both UI catalogs cover every declared HTML semantic label", async () => {
  const [en,ja,html] = await Promise.all([readFile(new URL("../locales/gameui-en.json",import.meta.url),"utf8").then(JSON.parse),
    readFile(new URL("../locales/gameui-ja.json",import.meta.url),"utf8").then(JSON.parse),
    readFile(new URL("../web/game.html",import.meta.url),"utf8")]);
  assert.deepEqual(Object.keys(en).sort(),Object.keys(ja).sort());
  assert.match(html,/<html lang="ja">/);
  for (const match of html.matchAll(/data-(?:text|aria)="([^"]+)"/g)) {
    assert.equal(typeof en[match[1]],"string",match[1]);assert.equal(typeof ja[match[1]],"string",match[1]);
  }
  assert.ok(Object.keys(en).length >= 60);
});
