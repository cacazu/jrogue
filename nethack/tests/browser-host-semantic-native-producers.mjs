/* Real Chrome + official NetHack WASM. No engine state is fabricated or edited. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveIntegration } from '../tools/serve-integration.mjs';
import { launchChrome, click, delay, key, waitFor } from './browser-host-semantic-cdp.mjs';

const results = resolve(dirname(fileURLToPath(import.meta.url)), '../build/browser-semantic-native-artifacts');
const reportPath = resolve(dirname(fileURLToPath(import.meta.url)), '../build/browser-semantic-native-verification.json');
await mkdir(results, { recursive: true });
const report = { measuredAt: new Date().toISOString(), scope: 'original-debug-native-semantic-producers', status: 'running', engine: 'Official NetHack 5.0.0 C WASM with compiled Rust semantic layers', requestedInitialSeed: '123456789', tests: [], errors: [], console: [], screenshots: [],native_callback_semantics_verified:false,compiled_pipeline_verified:false };
if (process.env.NETHACK_INTEGRATION_MEMORY_JSON) report.memoryBeforeLaunch = JSON.parse(process.env.NETHACK_INTEGRATION_MEMORY_JSON);
report.nodePid = process.pid;
report.maxConcurrentWasmPages = 1;
const started = Date.now();
const roles = ['Archeologist','Barbarian','Caveman','Healer','Knight','Monk','Priest','Ranger','Rogue','Samurai','Tourist','Valkyrie','Wizard'];
const commandReady = `window.netHackTest?.host?.pendingKind === 'command' && window.netHackTest.getFrame().cells.length > 0`;
let service, chrome, page;

async function step(name, operation) {
  const before = Date.now();
  try {
    const evidence = await operation();
    report.tests.push({ name, status: 'passed', durationMs: Date.now() - before, evidence });
    const summary = JSON.stringify(evidence ?? {});
    process.stdout.write(`PASS ${name} ${summary.slice(0, 800)}${summary.length > 800 ? '...' : ''}\n`);
    return evidence;
  } catch (error) {
    report.tests.push({ name, status: 'failed', durationMs: Date.now() - before, error: error.stack });
    throw error;
  } finally { await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
}

async function screenshot(label, target = page) {
  const image = await target.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const filename = `${label}.png`;
  await writeFile(resolve(results, filename), Buffer.from(image.data, 'base64'));
  report.screenshots.push(filename);
}

async function engineState(target = page) {
  return target.cdp.evaluate(`(() => {const m=window.netHackTest.module;return {state:JSON.parse(m.ccall('nh_abi_state_json','string',[],[])),rawStateChecksum:m.ccall('nh_abi_state_checksum','number',[],[])>>>0,worldChecksum:m.ccall('nh_abi_world_checksum','number',[],[])>>>0,rngChecksum:m.ccall('nh_abi_rng_checksum','number',[],[])>>>0};})()`);
}

function stableState(value) {
  return { state: value.state, worldChecksum: value.worldChecksum, rngChecksum: value.rngChecksum };
}

async function nativeAuxiliaryFiles(target = page) {
  return target.cdp.evaluate(`(() => {const m=window.netHackTest.module;return Object.fromEntries(['record','logfile','xlogfile','livelog'].map(name=>{const path='/'+name;return [name,m.FS.analyzePath(path).exists?m.FS.readFile(path,{encoding:'utf8'}):null];}));})()`);
}

async function dialogSnapshot(target = page) {
  return target.cdp.evaluate(`({phase:window.netHackTest?.phase,pending:window.netHackTest?.host?.pendingKind,title:document.querySelector('#modal-title')?.textContent,originalQuestion:window.__semanticQA?.lastQuestion,rows:Array.from(document.querySelectorAll('.menu-row')).map(el=>el.textContent),choices:Array.from(document.querySelectorAll('.choice')).map(el=>el.textContent),pickMode:document.querySelector('#modal')?.dataset.pickMode,open:document.querySelector('#modal')?.open,textEditor:!!document.querySelector('#modal-body .text-editor'),notice:document.querySelector('#notice')?.textContent,messages:document.querySelector('#messages')?.innerText.slice(-2000)})`);
}

async function instrumentSemantics(target) {
  await target.cdp.evaluate(`(() => {
    if (window.__semanticQA) return;
    const m=window.netHackTest.module,original=window.__jrogueNetHackShim;
    if(typeof original!=='function'||typeof m._nh_abi_semantic_event!=='function') throw Error('Compiled native semantic callback unavailable');
    const qa=window.__semanticQA={captures:[],lastQuestion:null,total:0};
    const surfaces={shim_putstr:2,shim_raw_print:0,shim_raw_print_bold:0,shim_add_menu:7,shim_end_menu:1,shim_yn_function:0,shim_getlin:0};
    const windows=new Set(['shim_putstr','shim_add_menu','shim_end_menu']);
    window.__jrogueNetHackShim=async(name,...args)=>{
      if(name==='shim_yn_function') qa.lastQuestion=args[0];
      if(Object.hasOwn(surfaces,name)) {
        const windowId=windows.has(name)?args[0]:-1;
        const json=m.ccall('nh_abi_semantic_event','string',['string','number'],[name,windowId]);
        if(json) { qa.total++; if(qa.captures.length<4096)qa.captures.push({callback:name,window:windowId,sourceText:String(args[surfaces[name]]??''),envelope:JSON.parse(json)}); }
      }
      return await original(name,...args);
    };
  })()`);
}

async function startup(target, { name = 'BrowserQA', role = 'Valkyrie', restore = false, touch = false } = {}) {
  await waitFor(target, `!!window.netHackTest && !!document.querySelector(${JSON.stringify(restore ? '#restore' : '#start')}) && !document.querySelector(${JSON.stringify(restore ? '#restore' : '#start')}).disabled`, { timeout: 60000, description: 'browser host ready' });
  await instrumentSemantics(target);
  await target.cdp.evaluate(`window.netHackTest.module.ENV.NETHACK_TEST_SEED = '123456789'`);
  await click(target, restore ? '#restore' : '#start', { touch });
  const dialogs = [], deadline = Date.now() + 90000;
  let observedRoles = [];
  while (Date.now() < deadline) {
    if (await target.cdp.evaluate(commandReady)) {
      const state = await engineState(target);
      if (!restore) assert.equal(state.state.roleName, role, 'Upstream started the role actually selected');
      return { dialogs, observedRoles, state };
    }
    const current = await dialogSnapshot(target);
    if (['error','failed','ended'].includes(current.phase)) throw new Error(`Engine startup failed: ${JSON.stringify(current)}`);
    if (current.open) {
      dialogs.push(current);
      report.activeStartup = { name, role, restore, dialogs };
      if (current.pending === 'text' || (current.phase === 'ready' && current.textEditor)) {
        await click(target, '.text-editor', { touch });
        await target.cdp.send('Input.insertText', { text: name });
        await key(target, 'Enter');
      } else if (current.pending === 'question') {
        const originalQuestion = current.originalQuestion ?? current.title;
        await key(target, /pick.*character|choose.*character|random/i.test(originalQuestion) ? 'n' : /Is this ok|Is this all right|accept/i.test(originalQuestion) ? 'y' : 'Enter');
      } else if (current.pending === 'menu') {
        if (current.pickMode === '0') { await key(target, 'Enter'); await delay(70); continue; }
        assert.ok(current.rows.length > 0, `Upstream selectable menu has no selectable UI rows: ${JSON.stringify(current)}`);
        const roleRows = current.rows.filter(text => roles.some(candidate => text.includes(candidate)));
        if (roleRows.length >= 10) observedRoles = roleRows;
        const desired = roleRows.length >= 10 ? current.rows.findIndex(text => text.includes(role)) : 0;
        assert.ok(desired >= 0, `Upstream role menu includes ${role}`);
        // This selector marker only locates a visible upstream row; it never changes engine data.
        await target.cdp.evaluate(`document.querySelectorAll('.menu-row')[${desired}].setAttribute('data-qa-menu-choice','true')`);
        const alreadySelected = await target.cdp.evaluate(`document.querySelector('[data-qa-menu-choice] input').checked`);
        if (alreadySelected && current.pickMode === '1') await key(target, 'Enter');
        else await click(target, '[data-qa-menu-choice] input', { touch });
      } else if (['more','display','history'].includes(current.pending)) await key(target, 'Enter');
      else throw new Error(`Unexpected startup modal: ${JSON.stringify(current)}`);
      await delay(70);
    } else await delay(50);
  }
  throw new Error(`Startup did not reach a real engine command wait: ${JSON.stringify(await dialogSnapshot(target))}`);
}

async function dismissUntilCommand(target = page) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await target.cdp.evaluate(commandReady)) return;
    const current = await dialogSnapshot(target);
    if (current.open) await key(target, 'Escape');
    else await delay(40);
    await delay(60);
  }
  throw new Error(`Did not return to command wait: ${JSON.stringify(await dialogSnapshot(target))}`);
}

// The shared harness prefix is copied below before this source is executed.

async function nativeInput(value, modifiers = 0) {
  await page.cdp.evaluate(`document.querySelector('#canvas').focus()`);
  await key(page,value,{modifiers});
}
async function chooseVisibleRow(pattern) {
  const dialog=await dialogSnapshot();
  const index=dialog.rows.findIndex(row=>pattern.test(row));
  assert.ok(index>=0,`Visible original menu contains ${pattern}: ${JSON.stringify(dialog)}`);
  await page.cdp.evaluate(`document.querySelectorAll('.menu-row')[${index}].setAttribute('data-qa-native-choice','true')`);
  await click(page,'[data-qa-native-choice] input');
  return dialog.rows[index];
}
async function drainNativeOutput({limit=20000}={}) {
  const deadline=Date.now()+limit,dialogs=[];
  while(Date.now()<deadline) {
    if(await page.cdp.evaluate(commandReady))return dialogs;
    const current=await dialogSnapshot();
    if(current.open) {
      dialogs.push(current);
      if(['more','display','history'].includes(current.pending)||current.pending==='menu'&&current.pickMode==='0')await key(page,'Enter');
      else throw Error(`Original command has an unanswered input: ${JSON.stringify(current)}`);
    } else await delay(40);
  }
  throw Error(`Native command did not finish: ${JSON.stringify(await dialogSnapshot())}`);
}
function eventIds(event) {
  const ids=[event.id];
  for(const arg of Object.values(event.args)) {
    if(arg.type==='event')ids.push(...eventIds(arg.value));
    else if(arg.type==='text_id')ids.push(arg.value);
  }
  return ids;
}
async function ballApply() {
  const before=await page.cdp.evaluate(`window.__semanticQA.captures.length`);
  await nativeInput('a');
  await waitFor(page,`['question','menu'].includes(window.netHackTest.host.pendingKind)&&document.querySelector('#modal').open`);
  let dialog=await dialogSnapshot();
  if(dialog.pending==='question') {
    await key(page,'?');
    await waitFor(page,`window.netHackTest.host.pendingKind==='menu'&&document.querySelector('#modal').open`);
  }
  const selected=await chooseVisibleRow(/glass orb|crystal ball/);
  await waitFor(page,`window.netHackTest.host.pendingKind==='question'&&document.querySelector('#modal').open`);
  dialog=await dialogSnapshot();
  assert.match(dialog.originalQuestion??dialog.title,/What do you look for/);
  await key(page,'$');
  const dialogs=await drainNativeOutput();
  const captures=await page.cdp.evaluate(`window.__semanticQA.captures.slice(${before})`);
  const capture=captures.find(c=>c.envelope.event.id.includes('.use_crystal_ball.you.peer_into'));
  assert.ok(capture,`Native crystal-ball peer message captured: ${JSON.stringify(captures)}`);
  const text=await page.cdp.evaluate(`Array.from(document.querySelectorAll('#messages [data-semantic-text-id]')).filter(el=>el.dataset.semanticTextId===${JSON.stringify(capture.envelope.event.id)}).at(-1)?.textContent`);
  await page.cdp.evaluate(`window.netHackTest.setLocale('en')`);
  const english=await page.cdp.evaluate(`Array.from(document.querySelectorAll('#messages [data-semantic-text-id]')).filter(el=>el.dataset.semanticTextId===${JSON.stringify(capture.envelope.event.id)}).at(-1)?.textContent`);
  assert.equal(english,capture.sourceText);
  await page.cdp.evaluate(`window.netHackTest.setLocale('ja')`);
  return {selected,capture,text,english,ids:eventIds(capture.envelope.event),dialogs};
}

try {
  const identitySources=[
    'C:/Users/kit/emsdk/upstream/emscripten/src/lib/libsyscall.js',
    'C:/Users/kit/emsdk/upstream/emscripten/system/lib/libc/musl/src/unistd/getlogin.c',
    'C:/Users/kit/emsdk/upstream/emscripten/system/lib/libc/musl/src/passwd/getpw_a.c',
    resolve(dirname(fileURLToPath(import.meta.url)),'../work/NetHack-5.0.0/sys/libnh/libnhmain.c'),
    resolve(dirname(fileURLToPath(import.meta.url)),'../work/NetHack-5.0.0/sys/libnh/sysconf')
  ];
  report.identitySources=await Promise.all(identitySources.map(async path=>{const bytes=await readFile(path);return {path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};}));
  report.virtualIdentityFixture={path:'/etc/passwd',data:'root:*:0:0:isolated virtual test:/nonexistent:/nonexistent\n',uidSource:'Original installed Emscripten non-NODERAWFS __syscall_getuid32 returns 0; no UID stub is installed.',policy:'Original WIZARDS=root games; unchanged. Original getlogin/getpwnam/getpwuid must match this virtual UID0.',scope:'Fresh isolated WASM MEMFS only. Locked password marker; inert home and shell. No host account/file/global environment/sysconf changes.'};
  report.artifacts=await Promise.all(['engine/nethack.js','engine/nethack.wasm','app.mjs','shim-host.mjs','dom-ui.mjs','save-store.mjs','browser-ui.json','gameplay-core.json','index.html','style.css'].map(async name=>{
    const bytes=await readFile(resolve(dirname(fileURLToPath(import.meta.url)),'../web',name));
    return {name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  }));
  service=await serveIntegration();chrome=await launchChrome();report.browser=chrome.version;report.chromePid=chrome.child.pid;
  page=await chrome.page(service.url);
  await step('Original debug startup and WIZKIT create the test inventory',async()=>{
    await waitFor(page,`!!window.netHackTest?.host&&!document.querySelector('#start').disabled`,{timeout:60000});
    const wishlist='uncursed crystal ball (0:0)\nuncursed potion of hallucination named SemanticHallucination\n';
    await page.cdp.evaluate(`(() => {
      const m=window.netHackTest.module,original=m.callMain.bind(m),ccall=m.ccall.bind(m);
      if(m.FS.analyzePath('/etc/passwd').exists)throw Error('Fresh virtual identity fixture unexpectedly already exists');
      m.FS.mkdirTree('/etc');m.FS.writeFile('/etc/passwd',${JSON.stringify(report.virtualIdentityFixture.data)});
      for(const name of ['USER','LOGNAME'])if(ccall('nh_abi_setenv','number',['string','string'],[name,'root'])!==0)throw Error('Virtual native identity environment failed');
      m.FS.writeFile('/semantic-test-wizkit',${JSON.stringify(wishlist)});
      if(ccall('nh_abi_setenv','number',['string','string'],['WIZKIT','/semantic-test-wizkit'])!==0)throw Error('Original WIZKIT environment failed');
      m.callMain=args=>{window.__nativeFixtureArgs=[...args,'-D'];return original(window.__nativeFixtureArgs);};
      m.ccall=(name,type,types,args)=>{if(name==='nh_abi_setenv'&&args?.[0]==='NETHACKOPTIONS')args=[args[0],args[1]+',accessiblemsg'];return ccall(name,type,types,args);};
    })()`);
    const value=await startup(page,{name:'wizard',role:'Wizard'});
    const flags=await page.cdp.evaluate(`({args:window.__nativeFixtureArgs,inventoryPath:window.netHackTest.module.FS.analyzePath('/semantic-test-wizkit').exists,status:window.netHackTest.getFrame().status,messages:document.querySelector('#messages').textContent,virtualPasswdExists:window.netHackTest.module.FS.analyzePath('/etc/passwd').exists})`);
    assert.ok(flags.args.includes('-D'));assert.equal(value.state.state.roleName,'Wizard');
    assert.doesNotMatch(flags.messages,/may access debug|cannot access debug|Entering explore/,'Original wizard policy must actually authorize this fixture');
    return {wishlist,...flags,state:value.state.state};
  });
  const unknown=await step('Original uncharged crystal-ball application exposes only its observed appearance',async()=>{
    const value=await ballApply();
    assert.ok(value.ids.some(id=>id.endsWith('.appearance')),`Actual unknown name uses appearance ID: ${JSON.stringify(value)}`);
    assert.ok(!value.ids.some(id=>id.endsWith('.name')),`Unknown source name does not expose hidden identity: ${JSON.stringify(value.ids)}`);
    assert.match(value.capture.sourceText,/glass orb/);assert.match(value.text,/[\u3040-\u30ff\u4e00-\u9fff]/);
    report.nativeUnknownAppearanceVerified=true;return value;
  });
  await step('Original wizard identify command changes actual public knowledge',async()=>{
    await nativeInput('i',2);
    const dialogs=await drainNativeOutput();
    await nativeInput('i');
    await waitFor(page,`document.querySelector('#modal').open&&window.netHackTest.host.pendingKind==='menu'`);
    const dialog=await dialogSnapshot();assert.ok(dialog.rows.some(row=>row.includes('crystal ball')));
    await key(page,'Enter');await drainNativeOutput();return {dialogs,inventory:dialog};
  });
  await step('The same original object now emits a known nested name event',async()=>{
    const value=await ballApply();
    assert.ok(value.ids.some(id=>id.endsWith('.name')),`Actual identified name uses name ID: ${JSON.stringify(value)}`);
    assert.match(value.capture.sourceText,/crystal ball/);assert.match(value.text,/[\u3040-\u30ff\u4e00-\u9fff]/);
    assert.equal(value.capture.envelope.event.id,unknown.capture.envelope.event.id);
    report.nativeNestedNameProducerVerified=true;report.nativeKnownNameVerified=true;return value;
  });
  await step('Original level-teleport dungeon menu reaches the role quest and captures accepted rows',async()=>{
    const before=await page.cdp.evaluate(`window.__semanticQA.captures.length`);
    await nativeInput('v',2);
    await waitFor(page,`window.netHackTest.host.pendingKind==='text'&&document.querySelector('#modal').open`);
    await click(page,'.text-editor');await page.cdp.send('Input.insertText',{text:'?'});await key(page,'Enter');
    await waitFor(page,`window.netHackTest.host.pendingKind==='menu'&&document.querySelector('#modal').open`);
    const menu=await dialogSnapshot();report.questDestinationMenu=menu;
    const destination=await chooseVisibleRow(/Wiz-strt|Wizard.*[Qq]uest|Quest.*start|[Qq]uest.*1/);
    const deadline=Date.now()+30000;
    let quest;
    while(Date.now()<deadline) {
      quest=await page.cdp.evaluate(`window.__semanticQA.captures.slice(${before}).filter(c=>c.envelope.context.quest)`);
      if(quest.some(c=>c.envelope.context.quest.final))break;
      const current=await dialogSnapshot();
      if(current.open&&['more','display'].includes(current.pending))await key(page,'Enter');
      else if(current.open&&current.pending==='menu'&&current.pickMode==='0')await key(page,'Enter');
      else await delay(40);
    }
    assert.ok(quest?.length,`Actual native quest events emitted: ${JSON.stringify(await dialogSnapshot())}`);
    const final=quest.find(c=>c.envelope.context.quest.final);assert.ok(final);
    const context=final.envelope.context.quest,rows=quest.filter(c=>c.envelope.context.quest.sequence===context.sequence);
    assert.equal(rows.length,context.lineCount);assert.equal(context.captureComplete,true);
    assert.deepEqual(rows.map(c=>c.envelope.context.quest.lineIndex),Array.from({length:context.lineCount},(_,i)=>i));
    assert.ok(rows.every(c=>c.callback==='shim_putstr'&&c.window===context.window));
    const shown=await page.cdp.evaluate(`({title:document.querySelector('#modal-title').textContent,document:document.querySelector('.document-lines')?.textContent,diagnostics:window.netHackTest.diagnostics,windows:Array.from(window.netHackTest.host.windows.values()).filter(w=>w.id===${context.window}).map(w=>({id:w.id,lines:w.lines}))})`);
    const expected=await page.cdp.evaluate(`(async()=>{const {RustLayers}=await import('./shim-host.mjs');const ui=await fetch('./browser-ui.json').then(r=>r.json()),catalog=await fetch('./gameplay-core.json').then(r=>r.json());const layers=new RustLayers(window.netHackTest.module,ui);layers.setGameplayCatalog(catalog);return layers.formatEvent(${JSON.stringify(final.envelope)},'ja');})()`);
    report.questExpected=expected;report.questShown=shown;
    assert.ok(shown.document,'Actual quest document is displayed');
    assert.equal(shown.document.trimEnd(),expected.text.trimEnd());assert.match(shown.document,/[\u3040-\u30ff\u4e00-\u9fff]/);
    await page.cdp.evaluate(`window.netHackTest.setLocale('en')`);
    const english=await page.cdp.evaluate(`document.querySelector('.document-lines').textContent`);
    assert.equal(english.trimEnd(),rows.map(c=>c.sourceText).join('\n').trimEnd());
    await page.cdp.evaluate(`window.netHackTest.setLocale('ja')`);await screenshot('native-quest-japanese');
    report.nativeQuestProducerVerified=true;report.native_callback_semantics_verified=true;
    await key(page,'Enter');await drainNativeOutput();
    return {destination,context,originalRows:rows,shown,expected,english};
  });
  await step('Captured quest and nested names repaint 100 times without native state, input, or RNG changes',async()=>{
    const before=await engineState();const input=await page.cdp.evaluate(`window.netHackTest.host.inbox.consumedTotal`);
    const calls=await page.cdp.evaluate(`(() => {const m=window.netHackTest.module,original=m.ccall,calls=[];m.ccall=(name,...args)=>{calls.push(name);return original(name,...args);};try{for(let i=0;i<100;i++){window.netHackTest.setLocale(i%2?'ja':'en');window.netHackTest.repaint();}}finally{m.ccall=original;}return calls;})()`);
    const after=await engineState();assert.deepEqual(after,before);assert.equal(await page.cdp.evaluate(`window.netHackTest.host.inbox.consumedTotal`),input);
    assert.ok(calls.every(name=>['nh_rust_format','nh_rust_format_fallback','nh_rust_format_gameplay','nh_rust_format_gameplay_fallback'].includes(name)),`Rendering called native producer: ${JSON.stringify([...new Set(calls)])}`);
    return {before,after,input,formatterCalls:calls.length,calledExports:[...new Set(calls)]};
  });
  await step('Original hallucination potion changes gameplay while locale rendering leaves its RNG untouched',async()=>{
    await nativeInput('q');await waitFor(page,`document.querySelector('#modal').open&&['question','menu'].includes(window.netHackTest.host.pendingKind)`);
    if((await dialogSnapshot()).pending==='question'){await key(page,'?');await waitFor(page,`window.netHackTest.host.pendingKind==='menu'&&document.querySelector('#modal').open`);}
    const selected=await chooseVisibleRow(/SemanticHallucination/);const dialogs=await drainNativeOutput();
    const before=await engineState(),status=await page.cdp.evaluate(`window.netHackTest.getFrame().status`);
    assert.ok(status.some(row=>/Hallu/i.test(String(row.value))),`Original public condition shows hallucination: ${JSON.stringify(status)}`);
    await page.cdp.evaluate(`for(let i=0;i<100;i++){window.netHackTest.setLocale(i%2?'ja':'en');window.netHackTest.repaint();}`);
    const after=await engineState();assert.deepEqual(after,before);report.nativeHallucinationRepaintVerified=true;
    return {selected,dialogs,status,before,after,monsterNameHallucinationProducerVerified:false};
  });
  await step('No browser failures or concurrent runtime changes in the native producer fixture',async()=>{
    report.errors=chrome.pages.flatMap(p=>p.errors);report.console=chrome.pages.flatMap(p=>p.console);report.logs=chrome.pages.flatMap(p=>p.logs);report.failedRequests=chrome.pages.flatMap(p=>p.failedRequests);
    assert.equal(report.errors.length,0);assert.equal(report.console.filter(r=>r.type==='error').length,0);assert.equal(report.failedRequests.length,0);
    for(const artifact of report.artifacts){const bytes=await readFile(resolve(dirname(fileURLToPath(import.meta.url)),'../web',artifact.name));assert.equal(createHash('sha256').update(bytes).digest('hex'),artifact.sha256);}
    return {exceptions:0,consoleErrors:0,failedRequests:0,unchangedArtifacts:report.artifacts.length};
  });
  report.status='passed';report.compiled_pipeline_verified=true;
  report.limits={fullCampaign:false,fullJapaneseCoverage:false,nativeMonsterHallucinationNameProducerVerified:false,nativeAccessibilityQualifierVerified:false,testFixture:'Original -D/WIZKIT/native commands only; production startup and gameplay were not edited.'};
} catch(error) {
  report.status='failed';report.blocker=error.stack;process.exitCode=1;process.stderr.write(`${error.stack}\n`);
  if(page){report.lastDialog=await dialogSnapshot().catch(()=>null);report.captures=await page.cdp.evaluate(`window.__semanticQA?.captures`).catch(()=>null);report.frame=await page.cdp.evaluate(`window.netHackTest?.getFrame()`).catch(()=>null);await screenshot('failure').catch(()=>{});}
} finally {
  report.durationMs=Date.now()-started;report.requests=service?.requests;
  await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
  if(chrome)await chrome.close();if(service)await service.close();report.ownedProcessesClosedAt=new Date().toISOString();
  await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
  process.stdout.write(`RESULT ${report.status}: ${report.tests.filter(t=>t.status==='passed').length} passed, ${report.tests.filter(t=>t.status==='failed').length} failed. ${reportPath}\n`);
}
