import test from "node:test";
import assert from "node:assert/strict";
import {createEventQueue, createKeyPressQueue, createFrameTransport} from "../web/game.mjs";

const encoder = new TextEncoder(), decoder = new TextDecoder("utf-8",{fatal:true});
const externalName = "BrowserMarine_5489";
function textPacket(value) {
  const data = encoder.encode(value), packet = new Uint8Array(128), header = new DataView(packet.buffer);
  assert.ok(data.length <= 63,"fixture models an accepted Rust text packet");
  header.setUint32(0,1,true); header.setUint32(4,10,true); header.setUint32(60,data.length,true);
  packet.set(data,64); return packet;
}
function rustTextPackets(value) {
  const packets = []; let chunk = "";
  for (const codepoint of value) {
    if (encoder.encode(chunk + codepoint).length > 63) {packets.push(textPacket(chunk));chunk = "";}
    chunk += codepoint;
  }
  if (chunk) packets.push(textPacket(chunk));
  return packets;
}
function payload(packet) {
  const header = new DataView(packet.buffer,packet.byteOffset,packet.byteLength);
  return decoder.decode(packet.subarray(64,64 + header.getUint32(60,true)));
}
function keyPacket(phase) {
  const packet = new Uint8Array(128), header = new DataView(packet.buffer);
  header.setUint32(0,1,true); header.setUint32(4,phase === "down" ? 1 : 2,true);
  header.setUint32(8,13,true); header.setUint32(20,phase === "down" ? 1 : 0,true);
  return packet;
}
function nativeEditorFixture() {
  const queue = createEventQueue(), delivered = [], submitted = [];
  const keys = createKeyPressQueue(phase => ({captured:true,receipt:queue.append([keyPacket(phase)])}));
  let buffer = "", name = "", down = false, duration = -1;
  function drain() {
    let packet;
    while ((packet = queue.poll(false))) {
      const header = new DataView(packet.buffer), kind = header.getUint32(4,true);
      if (kind === 10) {
        const value = payload(packet); delivered.push(value);
        // Exact native AppendText capacity: 16 WChar slots, one terminator.
        buffer = (buffer + value).slice(0,15);
      } else {down = Boolean(header.getUint32(20,true) & 1);duration = -1;}
    }
  }
  function frame() {
    duration = down ? (duration < 0 ? 0 : duration + 1) : -1;
    // Original VTIG_Input's default character set and FName limit. Unicode
    // transport is tested separately; this native editor permits ASCII names.
    for (const unit of buffer) if (/^[A-Za-z0-9 '_]$/.test(unit) && name.length + 1 < 48) name += unit;
    buffer = ""; // TIOEventState.EndFrame clears the input after VTIG_Input.
    if (down && duration === 0) submitted.push(name);
    const receipt = queue.consumedReceipt;
    queue.presented(receipt); keys.presented(receipt);
  }
  return {queue,keys,delivered,submitted,drain,frame,get name() {return name;}};
}

test("18-character external ASCII name reaches original editor intact before following Enter", () => {
  assert.equal(externalName.length,18);
  assert.equal(externalName.slice(0,15),"BrowserMarine_5","observed original overflow prefix");
  const f = nativeEditorFixture();
  const finalTextReceipt = f.queue.append([textPacket(externalName)]);
  assert.equal(finalTextReceipt,2,"complete request receipt covers both native-capacity chunks");
  f.keys.begin({key:"Enter",code:"Enter"},true);
  f.frame(); f.drain();
  assert.equal(f.name,""); assert.equal(f.queue.consumedReceipt,1);
  assert.equal(f.queue.pending,false,"native drain stops after first text packet");
  f.frame(); f.drain();
  assert.equal(f.name,"BrowserMarine_5"); assert.deepEqual(f.submitted,[]);
  f.frame(); f.drain();
  assert.equal(f.name,externalName); assert.deepEqual(f.submitted,[]);
  f.frame(); f.drain(); f.frame();
  assert.deepEqual(f.delivered,["BrowserMarine_5","489"]);
  assert.deepEqual(f.submitted,[externalName]); assert.equal(f.keys.pending,0);
  assert.equal(f.queue.textDeliveryPending,false);
});

test("peek and repaint cannot acknowledge text; final chunk remains pending until real presentation", () => {
  const queue = createEventQueue();queue.append([textPacket(externalName)]);
  assert.equal(payload(queue.poll(true)),"BrowserMarine_5");
  assert.equal(queue.consumedPacketCount,0); assert.equal(queue.pending,true);
  queue.presented(0); assert.equal(payload(queue.poll(false)),"BrowserMarine_5");
  assert.equal(queue.poll(true),null); assert.equal(queue.poll(false),null);
  assert.equal(queue.pending,false); assert.equal(queue.length,1); assert.equal(queue.textDeliveryPending,true);
  queue.presented(0); assert.equal(queue.poll(false),null,"pre-consumption frame cannot acknowledge");
  const frames = createFrameTransport(() => ({presentation:{}}),() => {});
  frames.frame(new Uint8Array());frames.replay();frames.replay();
  assert.equal(queue.poll(false),null,"transport repaint is not a native receipt acknowledgement");
  queue.presented(1);assert.equal(payload(queue.poll(false)),"489");
  assert.equal(queue.length,0);assert.equal(queue.textDeliveryPending,true);
  queue.presented(2);assert.equal(queue.textDeliveryPending,false);
  assert.equal(queue.consumedPacketCount,2);
});

test("supplementary Unicode and committed IME text retain exact UTF-8/codepoint order across frames", () => {
  const values = ["𠮷🌸".repeat(9),"外部名_名前e\u0301_👩‍💻".repeat(3)];
  for (const value of values) {
    const queue = createEventQueue(), chunks = [];
    const finalReceipt = queue.append(rustTextPackets(value));
    while (queue.length) {
      const packet = queue.poll(false); assert.ok(packet);
      const chunk = payload(packet);chunks.push(chunk);
      assert.ok(chunk.length <= 15,"at most 15 UTF-16 units including surrogate pairs");
      assert.ok(encoder.encode(chunk).length <= 63);
      assert.ok(!/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(chunk),"codepoint boundary cannot split a surrogate pair");
      assert.equal(queue.poll(false),null,"one text packet per acknowledged native frame");
      queue.presented(queue.consumedReceipt);
    }
    assert.equal(chunks.join(""),value,"no translation, normalization or synthetic keyboard character route");
    assert.equal(queue.consumedReceipt,finalReceipt);assert.equal(queue.textDeliveryPending,false);
    assert.ok(chunks.length > 1);
  }
});

test("expanded text quota and malformed later packets reject an entire request without queued prefix", () => {
  const bounded = createEventQueue(1);
  assert.throws(() => bounded.append([textPacket(externalName)]),/event quota/);
  assert.equal(bounded.length,0);assert.equal(bounded.lastEnqueuedReceipt,0);
  assert.equal(bounded.textDeliveryPending,false);
  const queue = createEventQueue(4);queue.append([keyPacket("down")]);
  const invalid = textPacket("valid"); invalid[64] = 0xff;
  assert.throws(() => queue.append([textPacket(externalName),invalid]));
  assert.equal(queue.length,1);assert.equal(queue.lastEnqueuedReceipt,1);
  assert.equal(new DataView(queue.poll(false).buffer).getUint32(4,true),1);
  assert.equal(queue.poll(false),null);
  const badLength = textPacket("x");new DataView(badLength.buffer).setUint32(60,64,true);
  assert.throws(() => queue.append([textPacket("prefix"),badLength]),/text packet length/);
  assert.equal(queue.length,0);assert.equal(queue.lastEnqueuedReceipt,1);
});

test("new runtime clears an outstanding text barrier and resets receipt identity", () => {
  const queue = createEventQueue();queue.append([textPacket(externalName)]);queue.poll(false);
  assert.equal(queue.textDeliveryPending,true);queue.clear();
  assert.equal(queue.textDeliveryPending,false);assert.equal(queue.length,0);assert.equal(queue.consumedPacketCount,0);
  assert.equal(queue.append([textPacket("NewName")]),1);assert.equal(payload(queue.poll(false)),"NewName");
  assert.throws(() => queue.presented(2),/text presentation receipt/);
  queue.presented(1);assert.equal(queue.textDeliveryPending,false);
});
