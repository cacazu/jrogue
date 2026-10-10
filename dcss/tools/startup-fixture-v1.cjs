// Shared native-fixture startup display gate. GPL-3.0-or-later.
// Reads only fixed local assets. It never calls a native engine export.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const EXPECTED = Object.freeze({
  schema_version:1, source:'startup-weapon-prompt-v1',
  upstream:'1eebc1a2892e1c89776a0d7a10691f8dac8d9796',
  ids:Object.freeze(['startup.weapon.prompt']),
  source_sha256:'b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c',
  transformed_source_sha256:'ef20867b4f3af194368217864b076a17828492665480753dda9a2d722e46ef11',
  bridge_sha256:'2bbbae4b169d62777409e897d22abee8d4493ca697e85a99c663efe39587d8f8',
  boundary_sha256:'b35e93f807923e5320ccb7d11d9edf84bc296d713a4cd6056c11306c31577f2c',
  boundary_bytes:701559, locale_mode:'session',
});
const TEXT = Object.freeze({en:'You have a choice of weapons.', ja:'\u6b66\u5668\u3092\u9078\u3079\u307e\u3059\u3002'});
const ASSETS = Object.freeze({
  '/build/boundary.wasm':'build/boundary.wasm',
  '/locales/startup/en.json':'locales/startup/en.json',
  '/locales/startup/ja.json':'locales/startup/ja.json',
  '/locales/startup/source-map.json':'locales/startup/source-map.json',
});
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function language(value='ja') {
  assert(value==='ja' || value==='en', 'DCSS_NATIVE_LANGUAGE must be ja or en');
  return value;
}
function manifestIdentity(manifest) {
  if (!Object.hasOwn(manifest, 'startup_text')) return null;
  assert.deepEqual(manifest.startup_text, EXPECTED,
    'Integrated startup metadata must match the reviewed one-ID source/artifact/locale contract');
  return JSON.parse(JSON.stringify(EXPECTED));
}
function fixedFetch(gameRoot, readFile=fs.readFileSync) {
  const absoluteRoot = path.resolve(gameRoot);
  return async (asset, options) => {
    assert(Object.hasOwn(ASSETS, asset), 'Startup preflight may read only its four fixed local assets');
    assert.deepEqual(options, {cache:'no-store'});
    const absolute = path.resolve(absoluteRoot, ASSETS[asset]);
    assert(absolute.startsWith(absoluteRoot+path.sep), 'Startup asset must stay inside the game root');
    const bytes = readFile(absolute);
    assert(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array, 'Local startup asset must be bytes');
    return {ok:true, arrayBuffer:async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength)};
  };
}

async function createStartupFixture(gameRoot, identity, requestedLanguage='ja', dependencies={}) {
  language(requestedLanguage);
  const receipt = {enabled:identity!==null, requestedLanguage,
    language:identity===null ? 'en' : requestedLanguage,
    mode:identity===null ? 'baseline-canonical-English' : 'integrated-session-locale',
    manifest:identity, preflightLanguages:[], formatCalls:0, errors:[]};
  if (identity===null) return {receipt, options:{}};
  assert.deepEqual(identity, EXPECTED);
  const readFile = dependencies.readFile ?? fs.readFileSync;
  // Verify source/module before importing any executable JS. The transformed
  // compile source may be in a separate incremental patch-source directory;
  // its exact hash is declared by the reviewed engine manifest, not a free path.
  const sourceFile = path.join(gameRoot,'upstream','crawl-ref','source','newgame.cc');
  assert.equal(hash(readFile(sourceFile)), EXPECTED.source_sha256);
  const bridgeFile = path.join(gameRoot,'web','startup-text.mjs');
  assert.equal(hash(readFile(bridgeFile)), EXPECTED.bridge_sha256);
  const importModule = dependencies.importModule ?? (url => import(url));
  const module = await importModule(pathToFileURL(bridgeFile).href);
  const pin = module.STARTUP_TEXT_PIN;
  assert.equal(pin.upstream, EXPECTED.upstream);
  assert.equal(pin.id, EXPECTED.ids[0]);
  assert.equal(pin.nativeSource, EXPECTED.source_sha256);
  assert.equal(pin.boundary.sha256, EXPECTED.boundary_sha256);
  assert.equal(pin.boundary.bytes, EXPECTED.boundary_bytes);
  assert.equal(pin.en, TEXT.en); assert.equal(pin.ja, TEXT.ja);
  assert.equal(typeof module.loadStartupTextBridge, 'function');
  const bridge = await module.loadStartupTextBridge(requestedLanguage, {
    fetcher:fixedFetch(gameRoot,readFile), crypto:crypto.webcrypto,
  });
  assert.equal(bridge.language, requestedLanguage);
  receipt.preflightLanguages = ['en','ja'];
  return {receipt, options:{
    dcssFormatStartup(id, params) {
      assert.equal(id, EXPECTED.ids[0]); assert.deepEqual(params, {});
      const text = bridge.format(id, params);
      assert.equal(text, TEXT[requestedLanguage], 'Native formatter must preserve the selected session locale');
      receipt.formatCalls++;
      return text;
    },
    dcssStartupTextError(reason) {
      const error = new Error('Native startup text failed: '+String(reason));
      receipt.errors.push(error.message);
      if (dependencies.onError) dependencies.onError(error);
    },
  }};
}

function decodeFrame(cells, columns=80, rows=30) {
  assert(Number.isInteger(columns) && columns>0 && Number.isInteger(rows) && rows>0);
  assert.equal(cells.length, columns*rows*3, 'Native frame must retain its exact cell dimensions');
  let text = '';
  for (let index=0; index<columns*rows; index++) {
    const glyph = cells[index*3];
    assert(Number.isInteger(glyph) && glyph>=0 && glyph<=0x10ffff && !(glyph>=0xd800 && glyph<=0xdfff));
    // platform_console.cc:108-110 uses glyph0 solely for wide continuations.
    // Keep actual space glyph32; do not insert spaces between Japanese glyphs.
    if (glyph!==0) text += String.fromCodePoint(glyph);
    if ((index+1)%columns===0) text += '\n';
  }
  return text;
}
function observeStartupPrompt(screen, receipt, requirePrompt) {
  const english = screen.includes(TEXT.en), japanese = screen.includes(TEXT.ja);
  if (!requirePrompt) {
    assert(!english && !japanese, 'Resume must load the native character rather than any new weapon menu');
    return false;
  }
  if (receipt.enabled) {
    assert(!(receipt.language==='ja' ? english : japanese), 'Integrated native prompt must not fall back to the other language');
  }
  return receipt.language==='ja' ? japanese : english;
}
function promptFrame(cells, receipt, columns=80, rows=30) {
  decodeFrame(cells,columns,rows); // Validate dimensions/scalars before indexing.
  const characters=Array.from(TEXT[receipt.language]);
  const width=receipt.language==='ja' ? 2 : 1;
  for(let first=0;first<columns*rows;first++){
    if(first%columns+characters.length*width>columns)continue;
    let match=true;
    for(let i=0;i<characters.length;i++){
      const cell=first+i*width;
      if(cells[cell*3]!==characters[i].codePointAt(0)
          || (width===2 && cells[(cell+1)*3]!==0)){match=false;break;}
    }
    if(!match)continue;
    const foreground=cells[first*3+1],background=cells[first*3+2],witness=[];
    for(let offset=0;offset<characters.length*width;offset++){
      const cell=first+offset;
      assert.equal(cells[cell*3+1],foreground,'Native prompt colour must remain consistent across glyphs/continuations');
      assert.equal(cells[cell*3+2],background);
      witness.push({glyph:cells[cell*3],foreground:cells[cell*3+1],background:cells[cell*3+2]});
    }
    return {language:receipt.language,text:TEXT[receipt.language],row:Math.floor(first/columns),
      column:first%columns,columns,rows,cellWidth:characters.length*width,
      sourceColour:'CYAN',cells:witness};
  }
  assert.fail('Genuine prompt requires exact native glyphs and Japanese wide-cell continuations inside one row');
}
function localePlan(env) {
  const original=language(env.DCSS_NATIVE_ORIGINAL_LANGUAGE ?? env.DCSS_NATIVE_LANGUAGE ?? 'ja');
  const resumed=language(env.DCSS_NATIVE_RESUME_LANGUAGE ?? original);
  return {original,resumed,crossLocale:original!==resumed};
}
module.exports = {EXPECTED,TEXT,language,localePlan,manifestIdentity,fixedFetch,createStartupFixture,decodeFrame,observeStartupPrompt,promptFrame};
