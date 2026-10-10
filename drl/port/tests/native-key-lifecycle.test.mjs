import test from "node:test";
import assert from "node:assert/strict";
import {createEventQueue, createKeyPressQueue, createFrameTransport} from "../web/game.mjs";

const enter = {key:"Enter",code:"Enter",location:0};
const escape = {key:"Escape",code:"Escape",location:0};
function packet(phase, event) {
  const bytes = new Uint8Array(128), header = new DataView(bytes.buffer);
  header.setUint32(0,1,true); header.setUint32(4,phase === "down" ? 1 : 2,true);
  header.setUint32(8,event.code === "Enter" ? 13 : 27,true);
  header.setUint32(20,phase === "down" ? 1 : 0,true);
  return bytes;
}
function fixture() {
  const queue = createEventQueue(), sent = [];
  const presses = createKeyPressQueue((phase, event) => {
    sent.push({phase,event});
    return {captured:true,receipt:queue.append([packet(phase,event)])};
  });
  // Faithful source regression seam: vio.pas WaitForLayer renders before
  // HandleEvents drains; vioeventstate.pas SetState resets duration and the
  // next Update promotes a held duration to zero. Activated rejects key-up.
  const states = new Map(); let confirms = 0, frames = 0;
  function frame() {
    for (const state of states.values()) state.duration = state.down ? (state.duration < 0 ? 0 : state.duration + 1) : -1;
    const confirm = states.get(13);
    if (confirm?.down && confirm.duration === 0) confirms++;
    frames++; presses.presented(queue.consumedReceipt);
  }
  function drain() {
    let bytes;
    while ((bytes = queue.poll(false))) {
      const header = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      states.set(header.getUint32(8,true),{down:Boolean(header.getUint32(20,true) & 1),duration:-1});
    }
  }
  return {queue,presses,sent,frame,drain,get confirms() {return confirms;},get frames() {return frames;}};
}

test("a rapid original down/up drain loses confirm; acknowledged tap advances exactly once", () => {
  const lost = fixture();
  lost.queue.append([packet("down",enter),packet("up",enter)]);
  lost.frame(); lost.drain(); lost.frame();
  assert.equal(lost.confirms,0,"up erased native held state before next frame");

  const fixed = fixture(); fixed.presses.begin(enter,true);
  fixed.frame();
  assert.equal(fixed.sent.length,1,"frame before consumption must not release");
  fixed.drain();
  assert.equal(fixed.queue.consumedReceipt,1);
  assert.equal(fixed.sent.length,1,"consumption alone must not release");
  fixed.frame();
  assert.equal(fixed.confirms,1);
  assert.deepEqual(fixed.sent.map(value => value.phase),["down","up"]);
  fixed.drain(); fixed.frame(); fixed.frame();
  assert.equal(fixed.confirms,1); assert.equal(fixed.presses.pending,0);
});

test("rapid synthetic taps retain order through down and up presentation acknowledgements", () => {
  const f = fixture();
  f.presses.begin(enter,true); f.presses.begin(escape,true); f.presses.begin(enter,true);
  assert.equal(f.queue.length,1);
  for (let index = 0; index < 8; index++) { f.frame(); f.drain(); }
  f.frame();
  assert.deepEqual(f.sent.map(value => [value.event.code,value.phase]),[
    ["Enter","down"],["Enter","up"],["Escape","down"],["Escape","up"],["Enter","down"],["Enter","up"],
  ]);
  assert.equal(f.confirms,2); assert.equal(f.presses.pending,0);
});

test("touch quick release waits for presentation, different-key holds coexist, cancellation releases once", () => {
  const f = fixture(), first = f.presses.begin(enter), second = f.presses.begin(escape);
  assert.equal(f.queue.length,2,"different keys may be held concurrently");
  f.presses.release(first); f.presses.release(first);
  f.frame(); assert.equal(f.queue.length,2);
  f.drain(); f.frame();
  assert.equal(f.confirms,1);
  assert.deepEqual(f.sent.map(value => value.phase),["down","down","up"]);
  f.presses.release(second); f.presses.releaseHeld();
  assert.deepEqual(f.sent.map(value => value.phase),["down","down","up","up"]);
  f.drain(); f.frame(); assert.equal(f.presses.pending,0);
});

test("same-key touch presses serialize without dropping a release before its queued down", () => {
  const f = fixture(), first = f.presses.begin(enter), second = f.presses.begin(enter);
  f.presses.release(second); f.presses.release(first);
  for (let index = 0; index < 6; index++) { f.frame(); f.drain(); }
  assert.equal(f.confirms,2);
  assert.deepEqual(f.sent.map(value => value.phase),["down","up","down","up"]);
  assert.equal(f.presses.pending,0);
});

test("packet receipts count actual dequeue, exclude peek and reset only for a new runtime", () => {
  const queue = createEventQueue(2);
  assert.equal(queue.append([]),null); assert.equal(queue.lastEnqueuedReceipt,0);
  assert.equal(queue.append([packet("down",enter)]),1);
  assert.equal(queue.poll(true)[8],13); assert.equal(queue.consumedReceipt,0); assert.equal(queue.consumedPacketCount,0);
  assert.throws(() => queue.append([packet("up",enter),new Uint8Array(128)]),/event quota/);
  assert.equal(queue.lastEnqueuedReceipt,1);
  assert.throws(() => queue.append([new Uint8Array(128)]),/packet version/);
  assert.equal(queue.lastEnqueuedReceipt,1);
  queue.poll(false); assert.equal(queue.consumedReceipt,1); assert.equal(queue.consumedPacketCount,1);
  queue.poll(false); assert.equal(queue.consumedPacketCount,1);
  assert.equal(queue.append([packet("up",enter)]),2);
  queue.clear(); assert.equal(queue.length,0); assert.equal(queue.lastEnqueuedReceipt,0);
  assert.equal(queue.consumedReceipt,0); assert.equal(queue.consumedPacketCount,0);
});

test("repaint replay never acknowledges input; press snapshots modifiers and reset drops only virtual jobs", () => {
  const f = fixture(), event = {...enter,shiftKey:true};
  f.presses.begin(event,true); event.shiftKey = false;
  assert.equal(f.sent[0].event.shiftKey,true);
  const projection = {width:80,height:25,glyphs:[],commands:[],cursor:null};
  const frames = createFrameTransport(() => ({presentation:projection}),() => {});
  frames.frame(new Uint8Array()); f.drain();
  frames.replay(); frames.replay();
  assert.equal(f.sent.length,1); assert.equal(f.queue.consumedPacketCount,1);
  f.presses.reset(); assert.equal(f.presses.pending,0);
  assert.equal(f.queue.consumedPacketCount,1,"reset does not mutate hardware/queue receipt state");
});

test("virtual press quotas and invalid acknowledgements fail explicitly", () => {
  const queue = createKeyPressQueue(() => ({captured:true,receipt:1}),1);
  queue.begin(enter,true);
  assert.throws(() => queue.begin(escape,true),/virtual key quota/);
  assert.throws(() => queue.presented(-1),/presentation receipt/);
  const rejected = createKeyPressQueue(() => ({captured:false}));
  assert.equal(rejected.begin(enter,true),null); assert.equal(rejected.pending,0);
  const badReceipt = createKeyPressQueue(() => ({captured:true,receipt:null}));
  assert.throws(() => badReceipt.begin(enter,true),/key receipt/);
});
