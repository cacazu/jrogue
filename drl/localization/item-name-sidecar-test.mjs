/** Lightweight adversarial reference oracle; does not execute Pascal or original Lua. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildItemNameAspects,verifyItemNameAspects} from './item-name-aspects.mjs';
import {buildItemNameCatalog} from './item-name-catalog.mjs';
import {render} from './render.mjs';
const read=f=>JSON.parse(readFileSync(new URL(f,import.meta.url),'utf8'));
const registry=read('./registration-term-catalog.json'),aspects=buildItemNameAspects(),en=read('./en.json'),ja=read('./ja.json'),contracts=read('./contract.json').parameters;
const rules=new Map(aspects.rules.map(r=>[r.eventID,r]));
const bases=new Map(registry.metadata.filter(r=>r.category==='item'&&r.fields.name).map(r=>[r.registryId,r.fields.name]));
const copy=structuredClone;let passed=0;const check=(label,fn)=>{fn();passed++;};
function text(s,limit=32768){assert.equal(typeof s,'string');assert.ok(Buffer.byteLength(s,'utf8')<=limit);for(const c of s){const v=c.codePointAt(0);assert.ok(v!==0&&!(v>=0xd800&&v<=0xdfff));}return s;}
function fields(o,keys){assert.ok(o&&typeof o==='object'&&!Array.isArray(o));assert.deepEqual(Object.keys(o).sort(),keys.toSorted());}
function parseStrict(data){
 const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);assert.ok(bytes.length>0&&bytes.length<=1048576);
 const source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);assert.ok(!source.startsWith('\ufeff'));let n=0,tokens=0;
 const ws=()=>{while(/[\t\r\n ]/.test(source[n]??'!'))n++;};
 function string(){const start=n++;while(n<source.length){const c=source[n++];if(c==='\\'){n++;continue;}if(c==='"')return text(JSON.parse(source.slice(start,n)));assert.ok(c.charCodeAt(0)>=32);}throw Error('Incomplete JSON string');}
 function value(depth=0){assert.ok(depth<=8&&++tokens<=100000);ws();const c=source[n];
  if(c==='"')return string();
  if(c==='{'){n++;const o=Object.create(null);ws();if(source[n]==='}'){n++;return o;}while(true){ws();assert.equal(source[n],'"');const k=string();assert.ok(!Object.hasOwn(o,k));ws();assert.equal(source[n++],':');o[k]=value(depth+1);ws();if(source[n]==='}'){n++;return o;}assert.equal(source[n++],',');}}
  if(c==='['){n++;const a=[];ws();if(source[n]===']'){n++;return a;}while(true){a.push(value(depth+1));ws();if(source[n]===']'){n++;return a;}assert.equal(source[n++],',');}}
  for(const [s,v]of [['true',true],['false',false],['null',null]])if(source.startsWith(s,n)){n+=s.length;return v;}
  const m=/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(source.slice(n));assert.ok(m&&m.index===0);n+=m[0].length;return{number:m[0]};
 }
 const result=value();ws();assert.equal(n,source.length);return result;
}
function valid(rows){
 assert.ok(Array.isArray(rows)&&rows.length<=4096);const ids=new Set;let retained=0;
 for(const r of rows){fields(r,['uid','prototypeId','baseEnglish','steps']);assert.match(r.uid,/^[1-9][0-9]*$/);assert.ok(BigInt(r.uid)<=(1n<<64n)-1n);assert.ok(!ids.has(r.uid));ids.add(r.uid);
  assert.ok(bases.has(r.prototypeId));assert.equal(text(r.baseEnglish),bases.get(r.prototypeId).english);assert.ok(Array.isArray(r.steps)&&r.steps.length>0&&r.steps.length<=16);
  let previous=r.baseEnglish;retained+=Buffer.byteLength(r.prototypeId+r.baseEnglish)+8;
  for(const step of r.steps){fields(step,['aspectId','beforeEnglish','afterEnglish']);const rule=rules.get(step.aspectId);assert.ok(rule);assert.equal(text(step.beforeEnglish),previous);text(step.afterEnglish);
   if(rule.requiredPrototypeId)assert.equal(r.prototypeId,rule.requiredPrototypeId);
   assert.equal(step.afterEnglish,rule.kind==='prefix'?rule.prefix+step.beforeEnglish:rule.fixedEnglish);
   retained+=Buffer.byteLength(step.aspectId+step.beforeEnglish+step.afterEnglish);assert.ok(retained<=1048576);previous=step.afterEnglish;
  }
 }
 return rows;
}
class Oracle{
 constructor(){this.rows=[];}
 remember(uid,prototypeId,aspectId,beforeEnglish,afterEnglish){try{const found=this.rows.find(r=>r.uid===uid);const last=found?.steps.at(-1);if(found?.prototypeId===prototypeId&&last?.aspectId===aspectId&&last.beforeEnglish===beforeEnglish&&last.afterEnglish===afterEnglish)return true;
  const rows=copy(this.rows);let r=rows.find(r=>r.uid===uid);if(!r){r={uid,prototypeId,baseEnglish:beforeEnglish,steps:[]};rows.push(r);}assert.equal(r.prototypeId,prototypeId);r.steps.push({aspectId,beforeEnglish,afterEnglish});valid(rows);this.rows=rows;return true;}catch{return false;}}
 replay(uid,prototypeId,currentEnglish,locale='ja'){const r=this.rows.find(r=>r.uid===uid&&r.prototypeId===prototypeId);if(!r||r.steps.at(-1).afterEnglish!==currentEnglish)return currentEnglish;
  let output=(locale==='ja'?registry.japaneseCatalog:registry.englishCatalog)[bases.get(prototypeId).semanticId];
  for(const s of r.steps){const rule=rules.get(s.aspectId),params=rule.kind==='prefix'?{name:output}:rule.kind==='schematic'?{assembly:(locale==='ja'?registry.japaneseCatalog:registry.englishCatalog)[registry.metadata.find(r=>r.category==='mod_array'&&r.registryId===rule.assemblyRegistryId).fields.name.semanticId]}:{};
   output=render(locale==='ja'?ja:en,contracts,rule.semanticID,params);
  }return output;
 }
 save(){return JSON.stringify({schema:1,format:'drl.semantic-item-names',records:valid(this.rows)});}
 load(data){this.rows=[];try{const root=parseStrict(data);fields(root,['schema','format','records']);assert.equal(root.schema.number,'1');assert.equal(root.format,'drl.semantic-item-names');this.rows=copy(valid(root.records));return true;}catch{return false;}}
}
const overcharge=aspects.rules.find(r=>r.eventID.includes('overcharge')),fixed=aspects.rules.find(r=>r.kind==='fixed');
function populated(){const o=new Oracle;assert.ok(o.remember('18446744073709551615','pistol',fixed.eventID,'pistol',fixed.fixedEnglish));assert.ok(o.remember('18446744073709551615','pistol',overcharge.eventID,fixed.fixedEnglish,overcharge.prefix+fixed.fixedEnglish));return o;}
check('QWord extrema, locale switching and exact guards',()=>{const o=populated(),expected=overcharge.prefix+fixed.fixedEnglish;assert.equal(o.replay('18446744073709551615','pistol',expected,'en'),expected);assert.match(o.replay('18446744073709551615','pistol',expected,'ja'),/[\u3040-\u9fff]/u);assert.equal(o.replay('1','pistol',expected),expected);assert.equal(o.replay('18446744073709551615','custom',expected),expected);assert.equal(o.replay('18446744073709551615','pistol','changed'),'changed');});
check('idempotent events, deep copy and atomic rejection',()=>{const o=populated(),before=o.save(),last=o.rows[0].steps.at(-1);assert.ok(o.remember(o.rows[0].uid,'pistol',last.aspectId,last.beforeEnglish,last.afterEnglish));assert.equal(o.save(),before);assert.equal(o.remember(o.rows[0].uid,'pistol','unknown',last.afterEnglish,'changed'),false);assert.equal(o.save(),before);});
check('fixed name reset then repeated prefix chain',()=>{const o=populated(),r=o.rows[0];assert.ok(o.remember(r.uid,'pistol',fixed.eventID,r.steps.at(-1).afterEnglish,fixed.fixedEnglish));assert.ok(o.remember(r.uid,'pistol',overcharge.eventID,fixed.fixedEnglish,overcharge.prefix+fixed.fixedEnglish));assert.equal(o.replay(r.uid,'pistol',overcharge.prefix+fixed.fixedEnglish,'en'),overcharge.prefix+fixed.fixedEnglish);});
check('all six source schematic routes and42 assembly IDs',()=>{for(const rule of aspects.rules.filter(r=>r.kind==='schematic')){const o=new Oracle,base=bases.get(rule.requiredPrototypeId).english;assert.ok(o.remember('1',rule.requiredPrototypeId,rule.eventID,base,rule.fixedEnglish));assert.equal(o.replay('1',rule.requiredPrototypeId,rule.fixedEnglish,'en'),rule.fixedEnglish);assert.match(o.replay('1',rule.requiredPrototypeId,rule.fixedEnglish,'ja'),/[\u3040-\u9fff]/u);}});
check('save/load original-English transition chain',()=>{const o=populated(),saved=o.save(),loaded=new Oracle;assert.ok(loaded.load(saved));assert.equal(loaded.save(),saved);assert.equal(loaded.replay(o.rows[0].uid,'pistol',o.rows[0].steps.at(-1).afterEnglish),o.replay(o.rows[0].uid,'pistol',o.rows[0].steps.at(-1).afterEnglish));});
const mutations=[
 ['schema',r=>r.schema=2],['format',r=>r.format='other'],['root-extra',r=>r.extra=true],['record-extra',r=>r.records[0].extra=true],['step-extra',r=>r.records[0].steps[0].extra=true],
 ['unknown-prototype',r=>r.records[0].prototypeId='unknown'],['changed-base',r=>r.records[0].baseEnglish='other'],['uid-zero',r=>r.records[0].uid='0'],['uid-numeric',r=>r.records[0].uid=1],['uid-leading-zero',r=>r.records[0].uid='01'],['uid-plus',r=>r.records[0].uid='+1'],['uid-overflow',r=>r.records[0].uid='18446744073709551616'],['duplicate-uid',r=>r.records.push(copy(r.records[0]))],
 ['unknown-aspect',r=>r.records[0].steps[0].aspectId='unknown'],['changed-before',r=>r.records[0].steps[0].beforeEnglish='changed'],['changed-after',r=>r.records[0].steps[0].afterEnglish='changed'],['broken-chain',r=>r.records[0].steps[1].beforeEnglish='pistol'],['empty-steps',r=>r.records[0].steps=[]],['too-many-steps',r=>r.records[0].steps=Array(17).fill(r.records[0].steps[0])],['nul',r=>r.records[0].baseEnglish+='\0'],['surrogate',r=>r.records[0].baseEnglish+='\ud800'],['oversized',r=>r.records[0].baseEnglish='a'.repeat(32769)],
];
for(const [label,mutate]of mutations)check('reject '+label+' and invalidate previous replay',()=>{const o=populated(),r=JSON.parse(o.save());mutate(r);assert.equal(o.load(JSON.stringify(r)),false);assert.equal(o.rows.length,0);});
for(const [label,data]of [['duplicate-key','{"schema":1,"schema":1,"format":"drl.semantic-item-names","records":[]}'],['fraction-schema','{"schema":1.0,"format":"drl.semantic-item-names","records":[]}'],['trailing','{"schema":1,"format":"drl.semantic-item-names","records":[]}x'],['trailing-comma','{"schema":1,"format":"drl.semantic-item-names","records":[],}'],['invalid-utf8',Buffer.from([0xff])],['empty',''],['depth','['.repeat(10)+']'.repeat(10)]])check('strict JSON '+label,()=>{const o=populated();assert.equal(o.load(data),false);assert.equal(o.rows.length,0);});
check('Pascal source implements shared strict parser, bounded IO, atomic commit and exact guard',()=>{const s=readFileSync(new URL('./drlsemanticitemnames.pas',import.meta.url),'utf8');for(const token of ['DRLSemanticPreflightJSON(data)','TryStrToQWord(uid','UIntToStr(candidate[i].UID) <> uid','candidate[i].Steps','FItemNames := candidate','stream.Free','DRL_ITEM_NAME_MAX_RECORDS = 4096','DRL_ITEM_NAME_MAX_STEPS = 16','Steps[High(Steps)].AfterEnglish <> aCurrentEnglish'])assert.ok(s.includes(token),token);assert.doesNotMatch(s,/\bName\s*:=|\bRandom\(/);const c=buildItemNameCatalog(aspects,registry);assert.equal(c.whitelistRules,297);assert.equal(c.baseNames,172);});
check('all51 source producers keep original English assignments and mechanics comparisons',()=>{const proof=verifyItemNameAspects();assert.equal(proof.originalNameAssignmentsReviewed,51);assert.equal(proof.whitelistRules,297);assert.equal(proof.transitionCases,372);});
console.log(JSON.stringify({passed,failed:0,evidence:'Node reference-oracle/adversarial/source-contract tests; native Pascal and actual Lua execution not run',sidecarSha256:createHash('sha256').update(readFileSync(new URL('./drlsemanticitemnames.pas',import.meta.url))).digest('hex')}));
