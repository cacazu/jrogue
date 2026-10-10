// Exact reviewed native V2 fixture contract. GPL-3.0-or-later.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const legacy=require('./startup-fixture-v1.cjs');
const REVIEWED_PIN_SHA256='e05f9c90ae5be2d9c18593f1f2da6e130e50c717aef2336c38ef360f740e670a';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const pinBytes=fs.readFileSync(path.join(__dirname,'startup-fixture-v2-pin.json'));
assert.equal(hash(pinBytes),REVIEWED_PIN_SHA256,'V2 fixture requires an independently reviewed immutable pin');
const reviewed=JSON.parse(pinBytes);
const EXPECTED=Object.freeze(reviewed.identity),PIN=reviewed.pin;
assert.equal(EXPECTED.schema_version,2);assert.equal(EXPECTED.source,'startup-text-v2');
assert.deepEqual(EXPECTED.ids,PIN.ids);assert.equal(EXPECTED.ids.length,45);
assert.equal(EXPECTED.boundary_sha256,PIN.boundary.sha256);assert.equal(EXPECTED.boundary_bytes,PIN.boundary.bytes);
const ASSETS=Object.freeze(Object.fromEntries([PIN.boundary,...PIN.catalogs].map(p=>[p.path,p])));
const promptCalls=r=>r.formatCallsById?.['startup.weapon.prompt']??0;
function manifestIdentity(manifest){
  if(!Object.hasOwn(manifest,'startup_text'))return null;
  assert.deepEqual(manifest.startup_text,EXPECTED,'Native metadata must match the reviewed V2 source/artifact contract');
  return JSON.parse(JSON.stringify(EXPECTED));
}
function fixedFetch(gameRoot,readFile=fs.readFileSync){
  const root=path.resolve(gameRoot);
  return async(asset,options)=>{
    assert(Object.hasOwn(ASSETS,asset),'V2 formatter may read only exact reviewed assets');
    assert.deepEqual(options,{cache:'no-store'});
    const filename=path.resolve(root,'.'+asset);assert(filename.startsWith(root+path.sep));
    const bytes=readFile(filename),pin=ASSETS[asset];
    assert(Buffer.isBuffer(bytes)||bytes instanceof Uint8Array);
    assert.equal(hash(bytes),pin.sha256);if(pin.bytes!==undefined)assert.equal(bytes.length,pin.bytes);
    return{ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
  };
}
function expectedText(id,params,locale){
  assert(Object.hasOwn(PIN.messages,id));const message=PIN.messages[id];
  assert(params!==null&&typeof params==='object'&&!Array.isArray(params));
  assert.deepEqual(Object.keys(params).sort(),Object.keys(message.parameters).sort());
  const values={};
  for(const[key,schema]of Object.entries(message.parameters)){
    const value=params[key];assert(value!==null&&typeof value==='object'&&!Array.isArray(value));
    if(schema.type==='entity_label'){
      assert.deepEqual(Object.keys(value).sort(),['domain','form','id','kind','upstream','version']);
      assert.equal(value.kind,'entity_label');assert.equal(value.version,1);assert.equal(value.upstream,PIN.upstream);
      assert.equal(value.domain,schema.role);assert.equal(value.form,'name');
      assert(Object.hasOwn(PIN.entityRegistry[schema.role],value.id));values[key]=PIN.entityRegistry[schema.role][value.id][locale];
    }else{
      assert.equal(schema.type,'actor_label');assert.deepEqual(Object.keys(value).sort(),['form','identity','kind','upstream','version']);
      assert.equal(value.kind,'actor_label');assert.equal(value.version,1);assert.equal(value.upstream,PIN.upstream);assert.equal(value.form,'name');
      assert.deepEqual(Object.keys(value.identity).sort(),['name','visibility']);assert.equal(value.identity.visibility,'external');
      assert.equal(typeof value.identity.name,'string');assert(value.identity.name.length>0);assert(!/\p{Cc}/u.test(value.identity.name));
      assert(Buffer.byteLength(value.identity.name)<=128);values[key]=value.identity.name;
    }
  }
  const text=message[locale].replace(/\{([a-z][a-z0-9_]*)\}/g,(_,key)=>{assert(Object.hasOwn(values,key));return values[key];});
  assert(!text.includes('\0'));assert(Buffer.byteLength(text)<=511);return text;
}
async function createStartupFixture(gameRoot,identity,requestedLanguage='ja',dependencies={}){
  legacy.language(requestedLanguage);
  if(identity===null){const result=await legacy.createStartupFixture(gameRoot,null,requestedLanguage,dependencies);result.receipt.formatCallsById={};return result;}
  assert.deepEqual(identity,EXPECTED);const readFile=dependencies.readFile??fs.readFileSync;
  assert.deepEqual(Object.keys(PIN.nativeSources).sort(),['crawl-ref/source/newgame.cc','crawl-ref/source/output.cc']);
  for(const[source,sha]of Object.entries(PIN.nativeSources))assert.equal(hash(readFile(path.join(gameRoot,'upstream',source))),sha);
  const bridgeFile=path.join(gameRoot,'web/startup-text.mjs');assert.equal(hash(readFile(bridgeFile)),EXPECTED.bridge_sha256);
  const module=await(dependencies.importModule??(url=>import(url)))(pathToFileURL(bridgeFile).href);
  assert.deepEqual(module.STARTUP_TEXT_PIN,PIN);
  const bridge=await module.loadStartupTextBridge(requestedLanguage,{fetcher:fixedFetch(gameRoot,readFile),crypto:crypto.webcrypto});
  assert.equal(bridge.language,requestedLanguage);
  const receipt={enabled:true,requestedLanguage,language:requestedLanguage,mode:'integrated-session-locale',manifest:identity,
    preflightLanguages:['en','ja'],formatCalls:0,formatCallsById:{},descriptors:[],errors:[]};
  return{receipt,options:{
    dcssFormatStartup(id,params){
      const expected=expectedText(id,params,requestedLanguage),text=bridge.format(id,params);assert.equal(text,expected);
      receipt.formatCalls++;receipt.formatCallsById[id]=(receipt.formatCallsById[id]??0)+1;
      // Bounded descriptor evidence prevents HUD redraw frequency growing receipts indefinitely.
      if(receipt.descriptors.length<256)receipt.descriptors.push({id,params:structuredClone(params),text});
      return text;
    },
    dcssStartupTextError(reason){const error=new Error('Native V2 text failed: '+String(reason));receipt.errors.push(error.message);dependencies.onError?.(error);},
  }};
}
module.exports={...legacy,EXPECTED,manifestIdentity,fixedFetch,createStartupFixture,expectedText,promptCalls};
