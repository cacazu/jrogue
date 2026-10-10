/* Actual original DRL browser gate. No reference-lab fallback is permitted.
 * This file may be syntax/self checked while shared compiler/browser jobs are
 * held. Running the default command starts one Chrome and one local server. */
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {readFile, writeFile, mkdir, mkdtemp, rm} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {createServer} from "../web/server.mjs";
import {originalHistoryLedger} from "./original-history-ledger.mjs";
import {INTRO_PHASE_IDS,createIntroClassifier,introConfirmationAllowed} from "./original-flow-phase.mjs";
import {SOURCE_COMMIT, ENGINE_COMMIT, validateBuild, validateManifest, pointerCell} from "../web/game.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = path.join(root, "port", "dist");
const output = path.join(root, "port", "tests", "output", "original-game");
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const sha = bytes => createHash("sha256").update(Array.isArray(bytes) ? Uint8Array.from(bytes) : bytes).digest("hex");
export const STATE = Object.freeze({start:0, menu:1, loading:2, crashLoading:3, playing:4, saving:5, nextLevel:6, quit:7, finished:8});
const SEED = 5489, NAME = "BrowserMarine_5489";

/** Strip only the original VTIG style braces on static test labels. The suite
 * does not replace any live game text, identifiers, or player names. */
export function plainLabel(text) {
  assert.equal(typeof text, "string");
  assert.ok(!text.includes("{{"), "The test label requires parameters");
  return text.replace(/\{[a-zA-Z!^]/g, "").replace(/[{}]/g, "").trim();
}

/** A native console wraps within its own window and pads rows to 80 cells.
 * Compare the text glyph sequence, leaving punctuation and names untouched. */
export function screenHasLabel(text,label) {
  const glyphs=value=>value.replace(/\s/g,'');
  return glyphs(label).length>0&&glyphs(text).includes(glyphs(label));
}
export function ammoWitness(text) {
  const match=text.match(/\[(\d+)\/(\d+)\]\s*\((\d+)\)/);
  assert.ok(match,'Original weapon HUD must expose magazine/capacity and reserve');
  return {loaded:Number(match[1]),capacity:Number(match[2]),reserve:Number(match[3])};
}

/** DRLP is a read-only diagnostic, not a complete save or whole game model. */
export function decodeProbe(probe) {
  assert.ok(probe && Array.isArray(probe.bytes), "Original-core paused DRLP probe required");
  const bytes = Uint8Array.from(probe.bytes);
  assert.ok(bytes.length >= 128 && bytes.length <= 8192);
  assert.ok(probe.bytes.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255));
  const data = new DataView(bytes.buffer);
  assert.equal(data.getUint32(0, true), 0x504c5244);
  assert.equal(data.getUint32(4, true), 1);
  assert.equal(data.getUint32(8, true), 128);
  assert.equal(data.getUint32(12, true), bytes.length - 128);
  return {
    bytes:Array.from(bytes), state:data.getUint32(16,true), seed:data.getUint32(20,true),
    difficulty:data.getUint32(24,true), seeded:Boolean(data.getUint32(28,true)),
    playerPresent:Boolean(data.getUint32(32,true)), x:data.getInt32(36,true), y:data.getInt32(40,true),
    hp:data.getInt32(44,true), hpMax:data.getUint32(48,true), exp:data.getInt32(52,true),
    expLevel:data.getUint32(56,true), score:data.getInt32(60,true), level:data.getInt32(64,true),
    klass:data.getUint32(68,true), inventorySize:data.getUint32(72,true),
    levelPresent:Boolean(data.getUint32(76,true)), levelTime:data.getUint32(80,true),
    rng:Array.from(bytes.subarray(128)),
  };
}
function compactProbe(probe) {
  if (!probe) return null;
  const {bytes, rng, ...values} = decodeProbe(probe);
  return {...values, diagnostic_sha256:sha(Uint8Array.from(bytes)), rng_bytes:rng.length, rng_sha256:sha(Uint8Array.from(rng))};
}
function sameDiagnostic(actual, expected, label) {
  assert.deepEqual(decodeProbe(actual).bytes, decodeProbe(expected).bytes, label);
}

class CDP {
  constructor(socket, events) {
    this.socket = socket; this.pending = new Map(); this.next = 0;
    socket.addEventListener("message", event => {
      const packet = JSON.parse(event.data);
      if (!packet.id) { events(packet); return; }
      const item = this.pending.get(packet.id);
      if (!item) return;
      clearTimeout(item.timer); this.pending.delete(packet.id);
      packet.error ? item.reject(new Error(JSON.stringify(packet.error))) : item.resolve(packet.result);
    });
    socket.addEventListener("close", () => {
      for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(new Error("Chrome debugger closed")); }
      this.pending.clear();
    });
  }
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.next;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
      this.pending.set(id, {resolve, reject, timer});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }
  async evaluate(expression) {
    const result = await this.call("Runtime.evaluate", {expression, returnByValue:true, awaitPromise:true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
}

async function artifacts(evidence) {
  const raw = JSON.parse(await readFile(path.join(dist, "build.json"), "utf8"));
  const build = validateBuild(raw);
  const manifest = validateManifest(JSON.parse(await readFile(path.join(dist, "core-assets.json"), "utf8")));
  for (const descriptor of [build.core, build.adapter]) {
    const bytes = await readFile(path.join(dist, descriptor.file));
    assert.equal(bytes.length, descriptor.size, `${descriptor.file}: byte count`);
    assert.equal(sha(bytes), descriptor.sha256, `${descriptor.file}: hash`);
    const module = new WebAssembly.Module(bytes);
    const exports = WebAssembly.Module.exports(module).map(item => item.name);
    const required = descriptor === build.core
      ? ["memory", "_start", "drl_save_generation", "drl_user_files_generation", "drl_probe_buffer", "drl_probe_capacity", "drl_probe_capture"]
      : ["memory", "drl_request_pointer", "drl_request_capacity", "drl_dispatch", "drl_output_pointer", "drl_output_length", "drl_text_columns", "drl_text_fit"];
    for (const name of required) assert.ok(exports.includes(name), `${descriptor.file}: missing ${name}`);
    const imports = WebAssembly.Module.imports(module);
    if (descriptor === build.adapter) assert.deepEqual(imports, [], "Rust adapter must have no host imports");
    else for (const entry of imports) assert.ok(["drl_host", "wasi_snapshot_preview1"].includes(entry.module), `Unknown original-core import ${entry.module}.${entry.name}`);
    evidence.artifacts[descriptor.file] = {...descriptor, imports, exports};
  }
  for (const descriptor of manifest.files) {
    const bytes = await readFile(path.join(dist, ...descriptor.url.split("/")));
    assert.equal(bytes.length, descriptor.size, descriptor.path);
    assert.equal(sha(bytes), descriptor.sha256, descriptor.path);
  }
  await readFile(path.join(dist, "game.html"));
  evidence.artifacts.asset_count = manifest.files.length;
  evidence.artifacts.manifest_sha256 = sha(await readFile(path.join(dist, "core-assets.json")));
  return build;
}

async function suite() {
  await mkdir(output, {recursive:true});
  const evidence = {schema:1, scope:"Original Pascal/Lua DRL in real Chrome; core game-flow gate, not a complete campaign proof",
    source_commit:SOURCE_COMMIT, engine_commit:ENGINE_COMMIT, seed:SEED, character:NAME,
    started_at:new Date().toISOString(), result:"pending", artifacts:{}, checks:[], actions:[],
    console:[], browser_errors:[], localization_findings:[], screenshots:[], complete_campaign:false};
  let server, chrome, profile, socket, cdp, chromeErrors = "";
  const check = (name, detail = {}) => evidence.checks.push({name, result:"pass", ...detail});
  const saveEvidence = async () => writeFile(path.join(output, "evidence.json"), JSON.stringify(evidence, null, 2));
  try {
    if (process.env.DRL_ORIGINAL_BROWSER_SKIP === "1") {
      evidence.result = "skipped";
      evidence.reason = "Explicit DRL_ORIGINAL_BROWSER_SKIP=1; no browser or gameplay evidence produced";
      return evidence;
    }
    await artifacts(evidence); // Missing/old lab artifacts fail before a browser starts.
    const locales = {}, shellLocales = {};
    for (const language of ["en", "ja"]) locales[language] = JSON.parse(await readFile(path.join(root, "localization", `${language}.json`), "utf8"));
    for (const language of ["en","ja"]) shellLocales[language] = JSON.parse(await readFile(path.join(root,"port/locales",`gameui-${language}.json`),"utf8"));
    const classifyIntro = createIntroClassifier(locales.ja);
    const label = (english, preferredId) => {
      const ids = [...new Set([preferredId, ...Object.keys(locales.en).filter(key => plainLabelSafe(locales.en[key]) === english)].filter(Boolean))];
      const translations = [...new Set(ids.map(id => plainLabelSafe(locales.ja[id])).filter(Boolean))];
      return {english, id:ids[0] ?? null, ids, translations};
    };
    function plainLabelSafe(text) { return typeof text === "string" && !text.includes("{{") ? plainLabel(text) : null; }
    const translatedLabelVisible = (value, text) => value.translations.some(translation => {
      const label = ['menu.main.new','menu.main.continue'].includes(value.id)
        ? translation.replace(/^[-=\s]+|[-=\s]+$/g, '') : translation;
        return screenHasLabel(text,label);
    });
    const labels = {
      new:label("----- New game -----", "menu.main.new"), continue:label("-- Continue game ---", "menu.main.continue"),
      regular:label("Regular game", "menu.new.regular.name"), seeded:label("Seeded game", "menu.new.seeded.name"),
      seedPrompt:label("Enter a seed (1..999999)", "menu.seed.prompt"), seedInvalid:label("Seed not in range!", "menu.seed.invalid"),
      difficulty:label("I'm Too Young To Die!", "term.difficulty.too-young.name"), marine:label("Marine", "term.klass.marine.name"),
      trait:label("Select trait to upgrade"), ironman:label("Ironman", "term.trait.ironman.name"),
      name:label("Type a name for your character", "menu.name.prompt"), inventory:label("Inventory"), equipment:label("Equipment"),
      help:label("Help topics", "help.title"), settings:label("Settings", "settings.title.general"),
      gameplaySettings:label("Settings (Gameplay)", "settings.title.gameplay"),
      displayCategory:label("Display", "settings.category.display.name"),
      save:label("Save & Quit"), exit:label("------ Exit --------","menu.main.exit"),
    };
    server = createServer();
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const base = `http://127.0.0.1:${server.address().port}/`;
    profile = await mkdtemp(path.join(os.tmpdir(), "drl-original-browser-"));
    chrome = spawn(process.env.DRL_CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], {windowsHide:true, stdio:["ignore", "ignore", "pipe"]});
    let spawnFailure;
    chrome.once("error", error => { spawnFailure = error; });
    chrome.stderr.on("data", bytes => { chromeErrors = (chromeErrors + bytes.toString()).slice(-8192); });
    async function until(callback, description, timeout = 45000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (spawnFailure) throw spawnFailure;
        const result = await callback();
        if (result) return result;
        await delay(50);
      }
      throw new Error(`Timeout: ${description}; Chrome: ${chromeErrors.slice(-500)}`);
    }
    const port = await until(async () => {
      try { return Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); }
      catch { return false; }
    }, "Chrome debugger");
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = pages.find(value => value.type === "page");
    assert.ok(page, "Chrome page target");
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, {once:true}); socket.addEventListener("error", reject, {once:true}); });
    cdp = new CDP(socket, packet => {
      if (packet.method === "Runtime.consoleAPICalled") evidence.console.push({type:packet.params.type, values:packet.params.args.map(value => value.value ?? value.description)});
      if (packet.method === "Runtime.exceptionThrown") evidence.browser_errors.push(packet.params.exceptionDetails);
    });
    await cdp.call("Page.enable"); await cdp.call("Runtime.enable");
    evidence.chrome = await cdp.call("Browser.getVersion");
    await cdp.call("Page.addScriptToEvaluateOnNewDocument", {source:"window.__originalBootErrors=[];addEventListener('error',e=>__originalBootErrors.push(String(e.error||e.message)));addEventListener('unhandledrejection',e=>__originalBootErrors.push(String(e.reason)));"});
    await cdp.call("Emulation.setDeviceMetricsOverride", {width:1280, height:960, deviceScaleFactor:1, mobile:false});
    const sample = () => cdp.evaluate(`(() => {
      const game = window.drlGame;
      let probe = null; if (game?.paused) probe = game.probe();
      return {ready:!!game, running:game?.running??false, paused:game?.paused??false, locale:game?.locale,
        queueLength:game?.queueLength??0, saveGeneration:game?.saveGeneration??0, filesGeneration:game?.filesGeneration??0,
        frameGeneration:game?.frameGeneration??0, consumedPacketCount:game?.consumedPacketCount??0,
        lastEnqueuedReceipt:game?.lastEnqueuedReceipt??0, lastPresentedReceipt:game?.lastPresentedReceipt??0,
        textDeliveryPending:game?.textDeliveryPending??false,
        failedPresentation:game?.failedPresentation??null,
        unsupported:game?.unsupportedImports??[], probe, text:document.querySelector('#screen-text')?.textContent??'',
        error:document.querySelector('#status')?.dataset.error==='true', status:document.querySelector('#status')?.textContent,
        startEnabled:!document.querySelector('#start')?.disabled, resumeEnabled:!document.querySelector('#resume')?.disabled,
        textActive:document.querySelector('#text-entry')?.hidden===false, errors:window.__originalBootErrors??[]};
    })()`);
    async function healthy() {
      const current = await sample(); evidence.last_state = {...current, probe:compactProbe(current.probe)};
      assert.equal(current.error, false, `Browser status error: ${current.status}`);
      assert.deepEqual(current.errors, [], "Browser startup/runtime exceptions");
      assert.deepEqual(current.unsupported, [], "Original game exercised unsupported platform imports");
      return current;
    }
    async function settle(description = "Original loop paused with drained input") {
      let last = null, repeats = 0;
      return until(async () => {
        const current = await healthy();
        if (!current.running || !current.paused || current.queueLength || current.textDeliveryPending || !current.probe) { last = null; repeats = 0; return false; }
        const fingerprint = JSON.stringify(current.probe.bytes);
        repeats = fingerprint === last ? repeats + 1 : 0; last = fingerprint;
        return repeats >= 2 ? current : false;
      }, description);
    }
    async function expectLabel(value, description = value.id ?? value.english) {
      const current = await until(async () => {
        const current = await healthy();
        if (current.locale === "ja" && translatedLabelVisible(value, current.text)) return current;
        if (screenHasLabel(current.text,value.english)) return current;
        return false;
      }, `Native screen: ${description}`);
      if (current.locale === "ja" && !translatedLabelVisible(value, current.text)) {
        const finding = {id:value.id, english:value.english, screen:description};
        if (!evidence.localization_findings.some(item => JSON.stringify(item) === JSON.stringify(finding))) evidence.localization_findings.push(finding);
      }
      return current;
    }
    async function key(key, code = key, modifiers = 0) {
      const before = await settle();
      await cdp.evaluate("document.querySelector(document.querySelector('#text-entry').hidden ? '#game-screen' : '#native-text').focus({preventScroll:true})");
      const vk = {Enter:13, Escape:27, Home:36, End:35, ArrowLeft:37, ArrowUp:38, ArrowRight:39, ArrowDown:40, PageUp:33, PageDown:34, Backspace:8, Delete:46, Tab:9, ' ':32}[key] ?? key.toUpperCase().charCodeAt(0);
      await cdp.call("Input.dispatchKeyEvent", {type:"keyDown", key, code, modifiers, windowsVirtualKeyCode:vk, nativeVirtualKeyCode:vk});
      const downReceipt = await cdp.evaluate("drlGame.lastEnqueuedReceipt");
      assert.ok(downReceipt > before.lastEnqueuedReceipt,"Physical key-down is captured by the actual Rust input adapter");
      // The original loop renders before draining events. Only a later native
      // presentation acknowledging the consumed down proves the view observed
      // activation; DOM timing or replayed frames cannot acknowledge it.
      const downPresented = await until(async()=>{const current=await healthy();return !current.running||
        current.lastPresentedReceipt>=downReceipt ? current:false;},"Original UI presents consumed physical key-down");
      await cdp.call("Input.dispatchKeyEvent", {type:"keyUp", key, code, modifiers, windowsVirtualKeyCode:vk, nativeVirtualKeyCode:vk});
      await delay(60);
      const released = await healthy();
      const after = released.running ? await settle() : released;
      evidence.actions.push({kind:"physical_key", key, code, modifiers, down_receipt:downReceipt, down_presented_frame:downPresented.frameGeneration, before:compactProbe(before.probe), after:compactProbe(after.probe)});
      return after;
    }
    async function select(index) {
      await key("Home");
      for (let position = 0; position < index; position++) await key("ArrowDown");
      return key("Enter");
    }
    async function click(selector, touch = false) {
      await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',inline:'nearest'})`);
      const point = await cdp.evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}; })()`);
      assert.ok(point.width >= 1 && point.height >= 1, `${selector}: clickable bounds`);
      if (touch) {
        await cdp.call("Input.dispatchTouchEvent", {type:"touchStart", touchPoints:[{x:point.x, y:point.y}]});
        await cdp.call("Input.dispatchTouchEvent", {type:"touchEnd", touchPoints:[]});
      } else {
        await cdp.call("Input.dispatchMouseEvent", {type:"mousePressed", x:point.x, y:point.y, button:"left", clickCount:1});
        await cdp.call("Input.dispatchMouseEvent", {type:"mouseReleased", x:point.x, y:point.y, button:"left", clickCount:1});
      }
      await delay(60);
    }
    async function type(text) {
      await until(async () => (await healthy()).textActive, "Original native text field enables DOM entry");
      await cdp.evaluate("document.querySelector('#native-text').focus({preventScroll:true})");
      await cdp.call("Input.insertText", {text});
      await settle("Committed DOM text delivered once to native VTIG input");
      await until(async () => (await healthy()).text.includes(text), `Native text contains exact ${JSON.stringify(text)}`);
      evidence.actions.push({kind:"committed_dom_text", text});
    }
    async function navigate() {
      const result = await cdp.call("Page.navigate", {url:`${base}game.html`});
      assert.ok(!result.errorText, result.errorText);
      await until(async () => { const current = await healthy(); return current.ready && current.startEnabled; }, "Original-game build and catalog load", 90000);
      assert.equal(await cdp.evaluate("document.documentElement.lang"), "ja");
      assert.equal(await cdp.evaluate("typeof WebAssembly.Suspending+' '+typeof WebAssembly.promising"), "function function");
    }
    async function mainMenu(resume = false) {
      const value = resume ? labels.continue : labels.new;
      for (let attempts = 0; attempts < 10; attempts++) {
        const current = await settle();
        if (translatedLabelVisible(value, current.text) || screenHasLabel(current.text,value.english)) return expectLabel(value);
        evidence.actions.push({kind:'first_run_confirmation',screen:current.text,probe:compactProbe(current.probe)});
        await key("Enter"); // Original first-run/credits screens require confirmation.
      }
      throw new Error(`Original main menu did not expose ${value.id}; no blind gameplay inputs sent`);
    }
    async function screenshot(name) {
      const data = await cdp.call("Page.captureScreenshot", {format:"png", captureBeyondViewport:false});
      const filename = `${name}.png`, bytes = Buffer.from(data.data, "base64");
      await writeFile(path.join(output, filename), bytes);
      evidence.screenshots.push({file:filename, size:bytes.length, sha256:sha(bytes), inspected:false});
    }
    async function snapshot() {
      return cdp.evaluate(`(async()=>{const value=await drlGame.storedFiles();return value?{...value,entries:value.entries.map(e=>({...e,bytes:Array.from(e.bytes)}))}:null})()`);
    }
    async function restoreFixture(value) {
      // Restore an exact snapshot already produced by the original Save & Quit.
      // Only the browser file store is written; no live native memory is changed.
      await cdp.evaluate(`(async()=>{const value=${JSON.stringify(value)};for(const e of value.entries)e.bytes=Uint8Array.from(e.bytes);
        const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('drl-original-core',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
        try{await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(value,'latest');tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error)})}finally{db.close()}})()`);
    }
    async function resume() {
      await navigate();
      assert.equal((await healthy()).resumeEnabled, true, "Committed file snapshot enables saved-game launch");
      await click("#resume"); await mainMenu(true); await select(0);
      return until(async () => { const current = await settle(); return current.probe.state === STATE.playing && current.probe.playerPresent ? current : false; }, "Original LoadSaveFile resumes play");
    }

    await navigate();
    check("Real browser loads pinned original-core artifacts; Japanese default; modern JSPI without experimental feature flags");
    await click("#start"); await mainMenu(); await select(0);
    await expectLabel(labels.seeded); await select(2); await expectLabel(labels.seedPrompt);
    await type("0"); await key("Enter"); await expectLabel(labels.seedInvalid);
    await key("Home"); await key("Delete"); await type(String(SEED)); await key("Enter");
    await expectLabel(labels.regular); await select(0);
    await expectLabel(labels.difficulty); await select(0);
    await expectLabel(labels.marine); await select(0);
    await expectLabel(labels.trait); await expectLabel(labels.ironman); await select(0);
    await expectLabel(labels.name); await type(NAME); await key("Enter");
    // Inputs are authorized only by the exact currently rendered intro ID.
    // UTF8 glyph reveal and original byte-count boost thresholds can differ;
    // a second confirmation requires a later real native frame of the same page.
    for (let index=0;index<INTRO_PHASE_IDS.length;index++) {
      const id=INTRO_PHASE_IDS[index];
      const page=await until(async()=>{const current=await healthy();const witness=classifyIntro(current.text);
        return witness.kind==='plot'&&witness.id===id&&witness.complete&&current.paused&&!current.queueLength?current:false;
      },'Complete Japanese original intro page '+id);
      assert.equal(introConfirmationAllowed(classifyIntro(page.text),{expectedId:id,confirmations:0,frameGeneration:page.frameGeneration}),true);
      evidence.actions.push({kind:'witnessed_intro_page',id,text:page.text,frame_generation:page.frameGeneration});
      await key('Enter');
      let activationFrame=evidence.actions.at(-1).down_presented_frame;
      let confirmations=1;
      await until(async()=>{
        const current=await healthy();
        if(current.probe?.state===STATE.playing){assert.equal(index,INTRO_PHASE_IDS.length-1,'Gameplay cannot precede all three intro pages');return current;}
        const witness=classifyIntro(current.text);
        if(witness.kind==='plot'&&witness.id!==id){assert.equal(witness.id,INTRO_PHASE_IDS[index+1],'Original intro phases stay ordered');return current;}
        if(witness.kind==='plot'&&witness.id===id&&witness.complete&&current.paused&&!current.queueLength&&current.frameGeneration>activationFrame){
          assert.equal(introConfirmationAllowed(witness,{expectedId:id,confirmations,frameGeneration:current.frameGeneration,activationFrame}),true);
          confirmations++;await key('Enter');activationFrame=evidence.actions.at(-1).down_presented_frame;
        }
        return false;
      },'Original intro phase closes '+id);
    }
    const initial=await until(async()=>{const current=await settle();return current.probe.state===STATE.playing&&current.probe.playerPresent?current:false;},'Original intro reaches play');
    assert.ok(initial, "Original intro reaches Phobos Base Entry with original player placement");
    const decoded = decodeProbe(initial.probe);
    assert.equal(decoded.seed, SEED); assert.equal(decoded.seeded, true); assert.equal(decoded.difficulty, 1);
    assert.ok(decoded.rng.length >= 2496, "Original serialized 624-word MT state present");
    assert.ok(initial.text.includes(NAME), "External ASCII character name survives exactly");
    check("Original menus validate invalid seed, accept seed 5489, easiest difficulty, Marine, Ironman and exact external name", {probe:compactProbe(initial.probe)});
    await screenshot("pc-initial");

    const pure = initial.probe;
    await cdp.evaluate("for(let i=0;i<50;i++)drlGame.replay();document.querySelector('#font-size').value='28';document.querySelector('#font-size').dispatchEvent(new Event('input'))");
    await cdp.call("Emulation.setDeviceMetricsOverride", {width:1024, height:768, deviceScaleFactor:1, mobile:false});
    sameDiagnostic((await settle()).probe, pure, "Replay/font/viewport changes preserve complete DRLP bytes and original RNG");
    await cdp.evaluate("document.querySelector('#language').value='en';document.querySelector('#language').dispatchEvent(new Event('change'))");
    await until(async () => (await healthy()).locale === "en", "English host locale");
    sameDiagnostic((await settle()).probe, pure, "English display does not advance rules/RNG");
    await cdp.evaluate("document.querySelector('#language').value='ja';document.querySelector('#language').dispatchEvent(new Event('change'));document.querySelector('#font-size').value='18';document.querySelector('#font-size').dispatchEvent(new Event('input'))");
    sameDiagnostic((await settle()).probe, pure, "Japanese display does not advance rules/RNG");
    check("50 replay draws, font resize, PC viewport change and EN/JA changes preserve every bounded DRLP field and all original MT bytes");

    await key("i", "KeyI"); await expectLabel(labels.inventory);
    sameDiagnostic((await settle()).probe, pure, "Opening inventory is pure");
    await key("ArrowRight"); await expectLabel(labels.equipment);
    sameDiagnostic((await settle()).probe, pure, "Inventory panel navigation is pure");
    await key("Escape");
    await key("h", "KeyH"); await expectLabel(labels.help);
    await select(0);
    const helpOrigin = await settle(), helpPacket = helpOrigin.probe;
    const helpBodyId = "help.body.start.menu-introduction";
    function helpLanguageVisible(current, language, requireFirstBody=true){
      const catalog=locales[language], title=plainLabel(catalog["help.body.start.title"]);
      const body=plainLabel(catalog[helpBodyId]);
      const keys=plainLabel(catalog["view.input-key.up"])+","+plainLabel(catalog["view.input-key.down"]);
      return current.locale===language&&screenHasLabel(current.text,keys)
        &&screenHasLabel(current.text,plainLabel(catalog["help.topic.start"]))
        &&(!requireFirstBody||(screenHasLabel(current.text,title)&&body.split(/\r?\n/).filter(line=>line.trim()).every(line=>screenHasLabel(current.text,line))));
    }
    assert.ok(helpLanguageVisible(helpOrigin,"ja"),"First original Help page has Japanese title, body, and fixed-key footer");
    async function changeOpenHelp(language,before,requireFirstBody=true){
      await cdp.evaluate("document.querySelector('#language').value="+JSON.stringify(language)+";document.querySelector('#language').dispatchEvent(new Event('change'))");
      const current=await until(async()=>{
        const current=await healthy();
        return current.paused&&!current.queueLength&&!current.textDeliveryPending
          &&current.frameGeneration>before.frameGeneration&&helpLanguageVisible(current,language,requireFirstBody)?current:false;
      },"Same open native Help redraws in "+language);
      sameDiagnostic(current.probe,helpPacket,"Same open Help language projection preserves complete DRLP/MT bytes");
      evidence.actions.push({kind:"same_open_help_language",locale:language,
        frame_before:before.frameGeneration,frame_after:current.frameGeneration,body_id:requireFirstBody?helpBodyId:null,
        configuration:current.probe.configuration??null,diagnostic_sha256:sha(current.probe.bytes)});
      return current;
    }
    const englishHelp=await changeOpenHelp("en",helpOrigin);
    await screenshot("pc-help-English");
    const returnedHelp=await changeOpenHelp("ja",englishHelp);
    assert.equal(returnedHelp.text,helpOrigin.text,"JA returns the same native Help topic and page projection");
    check("Same open original Help refreshes Japanese-English-Japanese body, title, and fixed keys on later native frames without DRLP/MT changes");
    const helpBefore = returnedHelp.text;
    await key("PageDown"); const scrolledHelp=await settle(), helpAfter=scrolledHelp.text;
    const scrolledEnglish=await changeOpenHelp("en",scrolledHelp,false);
    const scrolledJapanese=await changeOpenHelp("ja",scrolledEnglish,false);
    assert.equal(scrolledJapanese.text,helpAfter,"Same native Help scroll presentation returns after JA-EN-JA");
    check("Scrolled original Help retains its page projection across language changes without reopening or resetting scroll");
    assert.notEqual(helpAfter, helpBefore, "Original help scrollbar responds to PageDown");
    sameDiagnostic((await settle()).probe, pure, "Help open/scroll is pure");
    await screenshot("pc-help-scrolled");
    await key("Escape"); await expectLabel(labels.help); await key("Escape");
    check("Original inventory/equipment and help page scrolling render without simulation/RNG changes");

    const settingsGeneration = (await settle()).filesGeneration;
    await key("Escape"); await select(2); await expectLabel(labels.settings); await expectLabel(labels.displayCategory);
    await select(2); await expectLabel(labels.gameplaySettings); await key("Escape"); await expectLabel(labels.settings);
    await key("End"); await key("Enter");
    sameDiagnostic((await settle()).probe, pure, "Settings apply with unchanged values is pure");
    await until(async () => (await healthy()).filesGeneration > settingsGeneration, "Closed native settings write committed to IndexedDB");
    const settingsFiles = await snapshot();
    assert.ok(settingsFiles.entries.some(entry => entry.kind === "file" && entry.path.endsWith("/settings.lua")), "Original settings file persisted");
    check("Original settings categories, return/apply and completed settings-file commit work without RNG draws");

    const moved = await key("ArrowRight");
    assert.equal(moved.probe.x, 5); assert.equal(moved.probe.y, 10);
    assert.ok(decodeProbe(moved.probe).levelTime > decoded.levelTime, "Movement advances original simulation ticks");
    const waited = await key("w", "KeyW");
    assert.equal(waited.probe.x, 5); assert.equal(waited.probe.y, 10);
    assert.ok(decodeProbe(waited.probe).levelTime > decodeProbe(moved.probe).levelTime, "Wait advances original simulation ticks");
    check("Physical keyboard movement and wait execute original rules", {before:compactProbe(initial.probe), after:compactProbe(waited.probe)});

    const fireLabel=label('Choose fire target:','view.target.fire');
    const loaded=ammoWitness(waited.text);
    assert.deepEqual(loaded,{loaded:6,capacity:6,reserve:40},'Original Marine starting pistol and explicit reserve');
    const beforeTarget=waited.probe;
    await key('t','KeyT'); await expectLabel(fireLabel); await key('ArrowRight'); await key('Escape');
    const cancelled=await settle();
    sameDiagnostic(cancelled.probe,beforeTarget,'Manual target movement/cancellation does not spend a shot or simulation tick');
    assert.deepEqual(ammoWitness(cancelled.text),loaded);
    await key('t','KeyT'); await expectLabel(fireLabel); await key('ArrowRight');
    const fired=await key('Enter');
    const spent=ammoWitness(fired.text);
    assert.deepEqual(spent,{loaded:5,capacity:6,reserve:40},'One confirmed native shot spends exactly one pistol round');
    assert.ok(decodeProbe(fired.probe).levelTime>decodeProbe(beforeTarget).levelTime,'Confirmed fire executes the original command');
    const reloaded=await key('r','KeyR');
    assert.deepEqual(ammoWitness(reloaded.text),{loaded:6,capacity:6,reserve:39},'Original reload fills one round from reserve');
    assert.ok(decodeProbe(reloaded.probe).levelTime>decodeProbe(fired.probe).levelTime);
    check('Native manual targeting/cancel, confirmed pistol fire and reload preserve original ammo accounting',
      {before:loaded,after_fire:spent,after_reload:ammoWitness(reloaded.text),hostile_damage_or_kill_verified:false});

    await cdp.call("Emulation.setDeviceMetricsOverride", {width:390, height:844, deviceScaleFactor:2, mobile:true});
    await cdp.call("Emulation.setTouchEmulationEnabled", {enabled:true, maxTouchPoints:1});
    await click('[data-key="ArrowRight"]', true);
    const mobile = await settle(); assert.equal(mobile.probe.x, 6); assert.equal(mobile.probe.y, 10);
    assert.equal(await cdp.evaluate("document.documentElement.scrollWidth<=innerWidth"), true, "390px page has no horizontal overflow");
    const geometry = await cdp.evaluate("(()=>{const c=document.querySelector('#game-screen'),r=c.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,canvasWidth:c.width,canvasHeight:c.height,viewportWidth:document.querySelector('#screen-viewport').clientWidth}})()");
    assert.ok(geometry.width > geometry.viewportWidth, "Raw 80-column game remains scrollable on narrow screens");
    assert.deepEqual(pointerCell({clientX:geometry.left + geometry.width * .5, clientY:geometry.top + geometry.height * .5}, geometry), {x:40, y:12});
    await screenshot("mobile-touch");
    const mobilePure = mobile.probe;
    await cdp.evaluate("document.documentElement.style.fontSize='200%';document.querySelector('#fit').checked=true;document.querySelector('#fit').dispatchEvent(new Event('change'))");
    assert.equal(await cdp.evaluate("document.documentElement.scrollWidth<=innerWidth"), true, "200% UI font has no page overflow");
    sameDiagnostic((await settle()).probe, mobilePure, "Mobile fit/zoom only alter presentation");
    await screenshot("mobile-fit-zoom");
    check("Actual mobile touch moves once; original 80×25 geometry survives scrolling, fit and 200% UI font without rules/RNG changes", {geometry});

    // Original Save & Quit is the sole source of an in-progress native save.
    const preSave = (await settle()).probe, oldGeneration = (await healthy()).saveGeneration;
    await click("#save"); await expectLabel(labels.save); await key("End"); await key("Enter");
    await until(async () => (await healthy()).saveGeneration > oldGeneration, "Original Save & Quit closes native save then IndexedDB transaction commits");
    const saved = await snapshot();
    assert.equal(saved.format, "drl-original-core-files"); assert.equal(saved.version, 2);
    const saveEntries = saved.entries.filter(entry => entry.kind === "file" && entry.path.endsWith("/save"));
    assert.equal(saveEntries.length, 1, "Exactly one original native module save");
    const nativeSave = saveEntries[0]; assert.ok(nativeSave.bytes.length > 32);
    assert.equal(sha(nativeSave.bytes), nativeSave.sha256, "Committed native save byte hash");
    check("Original Save & Quit witness precedes browser commit; native save bytes have committed SHA-256", {native_save:{path:nativeSave.path,size:nativeSave.bytes.length,sha256:nativeSave.sha256}});
    const savedHistory=originalHistoryLedger(saved);
    check("Actual original Lua intro callback records the semantic history ID with its unchanged English guard",{semantic_history:savedHistory});
    await writeFile(path.join(output, "native-save-snapshot.json"), JSON.stringify(saved));
    await mainMenu(true);await expectLabel(labels.exit);await key('End');await key('Enter');
    await until(async()=>{const current=await healthy();return !current.running&&current.paused&&current.status===shellLocales[current.locale]['game.exited']?current:false;},'Original Exit completes final browser storage commit');
    const closed=await snapshot(),closedSave=closed.entries.find(entry=>entry.path===nativeSave.path);
    assert.ok(closedSave,'Native save survives the original main-menu Exit');
    assert.deepEqual(closedSave.bytes,nativeSave.bytes);assert.equal(closedSave.sha256,nativeSave.sha256);
    assert.deepEqual(originalHistoryLedger(closed),savedHistory);
    check("Original main-menu Exit and final storage commit preserve native save and semantic-history bytes");
    const resumed = await resume();
    sameDiagnostic(resumed.probe, preSave, "Fresh Rust/Pascal instances restore exact diagnostic fields and full original RNG");
    assert.ok(resumed.text.includes(NAME), "External name survives native serialization/load");
    assert.deepEqual(originalHistoryLedger(await snapshot()),savedHistory,"Fresh original native load retains the exact semantic-history ledger");
    await until(async () => !(await snapshot()).entries.some(entry => entry.path === nativeSave.path), "Original consumed-save deletion committed");
    check("Fresh page and Wasm instances execute original Continue game; exact DRLP/RNG restored and native consumed-save deletion persists", {probe:compactProbe(resumed.probe)});
    const futureA = [];
    for (const [keyValue, code] of [["ArrowRight","ArrowRight"],["w","KeyW"]]) futureA.push((await key(keyValue, code)).probe);
    await restoreFixture(saved);
    const replayed = await resume(); sameDiagnostic(replayed.probe, preSave, "Reinstated exact native file fixture loads unchanged");
    const futureB = [];
    for (const [keyValue, code] of [["ArrowRight","ArrowRight"],["w","KeyW"]]) futureB.push((await key(keyValue, code)).probe);
    for (let index = 0; index < futureA.length; index++) sameDiagnostic(futureB[index], futureA[index], `Native save continuation command ${index+1} is deterministic`);
    check("Two fresh native-save loads followed by the same physical commands produce identical complete diagnostics and original RNG continuation");
    await screenshot("resumed-continuation");
    evidence.remaining_gates = ["Observed hostile damage and kill outcomes", "RunDelay=0 automatic movement cancellation", "Full campaign/death/win/post-mortem flow", "Every challenge/special level/award system", "Independent screenshot inspection and complete corresponding-source/license bundle"];
    assert.deepEqual(evidence.browser_errors, [], "CDP runtime errors");
    assert.deepEqual(evidence.localization_findings, [], "Default Japanese native game screens still contain unlocalized menu labels");
    evidence.result = "pass";
  } catch (error) {
    evidence.result = "fail"; evidence.error = error.stack; process.exitCode = 1;
    if (cdp) {
      try { const data = await cdp.call("Page.captureScreenshot", {format:"png"}); await writeFile(path.join(output, "failure.png"), Buffer.from(data.data,"base64")); }
      catch { /* Preserve the original failure if Chrome is already gone. */ }
    }
  } finally {
    if (cdp) await cdp.call("Browser.close").catch(() => {});
    socket?.close();
    if (chrome) {
      for (let attempts = 0; attempts < 20 && chrome.exitCode === null; attempts++) await delay(100);
      if (chrome.exitCode === null) chrome.kill();
    }
    if (server) await new Promise(resolve => server.close(resolve));
    if (profile) {
      const absolute = path.resolve(profile), temporary = path.resolve(os.tmpdir()) + path.sep;
      assert.ok(absolute.startsWith(temporary) && path.basename(absolute).startsWith("drl-original-browser-"), "Temporary profile cleanup stays under temp");
      await rm(absolute, {recursive:true, force:true, maxRetries:8, retryDelay:200}).catch(error => { evidence.cleanup_error = error.code; });
    }
    evidence.finished_at = new Date().toISOString(); await saveEvidence();
  }
  return evidence;
}

function selfTest() {
  assert.deepEqual(ammoWitness('武: ピストル (2d4) [6/6] (40)'),{loaded:6,capacity:6,reserve:40});
  assert.throws(()=>ammoWitness('No magazine data'));
  assert.equal(screenHasLabel('    キャラクターの名前を入力してくだ  \n  さい    ','キャラクターの名前を入力してください'),true);
  assert.equal(screenHasLabel('    キャラクターの名前を入力してくだ  \n  さい    ','キャラクターの番号を入力してください'),false);
  assert.equal(screenHasLabel(' Enter a character\n name ','Enter a character name'),true);
  assert.equal(plainLabel(" {b-----} New game {b-----}"), "----- New game -----");
  assert.equal(plainLabel("{R日本語}{! 名前}"), "日本語 名前");
  assert.throws(() => plainLabel("Seed {{seed}}"), /parameters/);
  assert.deepEqual(pointerCell({clientX:210, clientY:145}, {left:10,top:20,width:400,height:250}), {x:40,y:12});
  assert.equal(pointerCell({clientX:410, clientY:20}, {left:10,top:20,width:400,height:250}), null);
  const bytes = new Uint8Array(132), view = new DataView(bytes.buffer);
  view.setUint32(0,0x504c5244,true); view.setUint32(4,1,true); view.setUint32(8,128,true); view.setUint32(12,4,true);
  view.setUint32(16,STATE.playing,true); view.setUint32(20,SEED,true); view.setUint32(28,1,true); view.setUint32(80,123,true);
  bytes.set([0,128,254,255],128);
  const original = {bytes:Array.from(bytes)};
  assert.equal(decodeProbe(original).levelTime,123); assert.deepEqual(decodeProbe(original).rng,[0,128,254,255]);
  assert.equal(compactProbe(original).diagnostic_sha256,sha(bytes));
  assert.equal(sha([0,128,254,255]),sha(Uint8Array.from([0,128,254,255])));
  const changed = structuredClone(original); changed.bytes[131] = 254;
  assert.throws(() => sameDiagnostic(changed,original,"RNG change detected"));
  assert.throws(() => decodeProbe({bytes:[0]}));
  console.log(JSON.stringify({result:"pass",scope:"source-only helper checks; no browser or game executed",checks:16}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--self-test")) selfTest();
  else { const result = await suite(); console.log(JSON.stringify({result:result.result,checks:result.checks.length,scope:result.scope,error:result.error,reason:result.reason,evidence:path.join(output,"evidence.json")})); }
}
