const encoder = new TextEncoder(), decoder = new TextDecoder();
const wasm = await WebAssembly.instantiateStreaming(fetch("drl_web_port.wasm"), {}).catch(async () => WebAssembly.instantiate(await (await fetch("drl_web_port.wasm")).arrayBuffer(), {}));
const api = wasm.instance.exports;
let frame = null, language = "ja", lastEnvelope = null;
let composing = false;
const status = document.querySelector("#status");
function request(payload) {
  const bytes = encoder.encode(JSON.stringify(payload));
  if (bytes.length > api.drl_request_capacity()) throw new Error("lab.invalid_save");
  const pointer = api.drl_request_pointer();
  new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
  api.drl_dispatch(bytes.length);
  const value = JSON.parse(decoder.decode(new Uint8Array(api.memory.buffer, api.drl_output_pointer(), api.drl_output_length())));
  if (value.error_id) throw new Error(value.error_id);
  return value;
}
function template(id) {
  const source = frame.labels[id];
  if (source === undefined) throw new Error("Missing semantic ID: " + id);
  return source;
}
function drawFrame() {
  for (const element of document.querySelectorAll("[data-text]")) element.textContent = template(element.dataset.text);
  document.documentElement.lang = language;
  document.title = template("lab.title");
  document.querySelector("#value").textContent = template("lab.last_value");
  document.querySelector("#count").textContent = template("lab.draw_count");
  document.querySelector("#command").textContent = template("lab.command");
  const canvas = document.querySelector("#state");
  canvas.width = 312; canvas.height = 72;
  const ctx = canvas.getContext("2d");
  // This renders the copied MT words only. Drawing never calls domain RNG.
  for (let index = 0; index < 624; index++) {
    const word = frame.checkpoint.rng.words[index];
    ctx.fillStyle = `rgb(${(word >>> 24) & 255},${(word >>> 16) & 255},${(word >>> 8) & 255})`;
    ctx.fillRect((index % 78) * 4, Math.floor(index / 78) * 9, 4, 9);
  }
}
function redraw() { frame = request({ kind: "redraw", english: language === "en" }); drawFrame(); }
function act(payload) { request(payload); redraw(); }
function report(id) { status.textContent = template(id); }
function guarded(callback) { return async (...args) => { try { await callback(...args); } catch (error) { report(frame.labels[error.message] ? error.message : "lab.runtime_error"); } }; }
document.querySelector("#reset").onclick = guarded(() => {
  const seed = Number(document.querySelector("#seed").value);
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("lab.invalid_save");
  act({kind:"reset", seed});
});
document.querySelector("#draw").onclick = guarded(() => act({kind:"draw"}));
document.querySelector("#dice").onclick = guarded(() => act({kind:"dice",number:2,sides:4}));
document.querySelector("#redraw").onclick = guarded(redraw);
document.querySelector("#language").onchange = guarded(event => { language = event.target.value; redraw(); });
function database() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("drl-rust-migration", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("checkpoints");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(new Error("lab.storage_error"));
  });
}
async function save() {
  const envelope = request({kind:"save"}).save;
  const db = await database();
  try { await new Promise((resolve, reject) => {
    const transaction = db.transaction("checkpoints", "readwrite");
    transaction.objectStore("checkpoints").put(envelope, "latest");
    transaction.oncomplete = resolve;
    transaction.onerror = transaction.onabort = () => reject(new Error("lab.storage_error"));
  }); } finally { db.close(); }
  lastEnvelope = envelope;
  report("lab.saved");
  return envelope;
}
async function resume() {
  const db = await database();
  let envelope;
  try { envelope = await new Promise((resolve, reject) => {
    const transaction = db.transaction("checkpoints", "readonly");
    const get = transaction.objectStore("checkpoints").get("latest");
    get.onsuccess = () => resolve(get.result);
    get.onerror = () => reject(new Error("lab.storage_error"));
  }); } finally { db.close(); }
  if (!envelope) throw new Error("lab.no_save");
  act({kind:"load",envelope});
  report("lab.loaded");
}
document.querySelector("#save").onclick = guarded(save);
document.querySelector("#resume").onclick = guarded(resume);
function keyboard(event) {
  const editable = event.target?.closest?.("input,select,textarea,[contenteditable=true]") !== null && Boolean(event.target?.closest);
  const payload = { key:event.key, code:event.code ?? "", location:event.location ?? 0, shiftKey:Boolean(event.shiftKey), ctrlKey:Boolean(event.ctrlKey), altKey:Boolean(event.altKey), metaKey:Boolean(event.metaKey), isComposing:composing || Boolean(event.isComposing), repeat:Boolean(event.repeat), editableTarget:editable, keyCode:event.keyCode ?? 0 };
  const before = frame.checkpoint.last_input_id;
  act({kind:"keyboard",event:payload});
  if (before !== frame.checkpoint.last_input_id && event.preventDefault) event.preventDefault();
}
document.addEventListener("compositionstart", () => { composing = true; });
document.addEventListener("compositionend", () => { composing = false; });
document.querySelector("#surface").addEventListener("keydown", keyboard);
for (const button of document.querySelectorAll("[data-key]")) button.onclick = () => keyboard({key:button.dataset.key,code:button.dataset.key,target:button});
redraw();
window.__drlVerification = {
  request, redraw, save, resume,
  checkpoint: () => structuredClone(frame.checkpoint),
  envelope: () => lastEnvelope,
  keyboard,
  scope: "migration verification, no campaign simulation"
};
