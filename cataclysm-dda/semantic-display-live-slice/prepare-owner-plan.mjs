import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),task=path.dirname(here),sha=b=>createHash('sha256').update(b).digest('hex');
const focus=JSON.parse(await readFile(path.join(here,'FOCUSED-COMPILE-PLAN.json'),'utf8'));
const staged=JSON.parse(await readFile(path.join(here,'COHERENT-SOURCE-STAGING.json'),'utf8'));
assert.equal(staged.fileCount,969);assert.equal(staged.status,'coherent-source-copied-no-compiler-execution');
const pins=new Map();
async function add(file){const b=await readFile(file),row={path:path.resolve(file),bytes:b.length,sha256:sha(b)};const old=pins.get(row.path);assert.ok(!old||JSON.stringify(old)===JSON.stringify(row));pins.set(row.path,row);return row;}
function walk(v){if(Array.isArray(v)){for(const x of v)walk(x);}else if(v&&typeof v==='object'){if(v.path&&Number.isInteger(v.bytes)&&v.sha256){const row={path:path.resolve(v.path),bytes:v.bytes,sha256:v.sha256};const old=pins.get(row.path);assert.ok(!old||JSON.stringify(old)===JSON.stringify(row));pins.set(row.path,row);}for(const x of Object.values(v))walk(x);}}
walk(focus);walk(staged);
for(const file of ['SOURCE-PREPARATION.json','SOURCE-CHECKS.json','semantic-help-transport.patch','COHERENT-SOURCE-STAGING.json','FOCUSED-COMPILE-PLAN.json','fixtures/original-producer.cpp','fixtures/transport.cpp','host-copy.mjs','prepare-owner-plan.mjs'])await add(path.join(here,file));
const cpp2=path.join(task,'integration-overlay/build-plan/cpp-compile');
walk(JSON.parse(await readFile(path.join(cpp2,'compile-plan.json'),'utf8')));
walk(JSON.parse(await readFile(path.join(cpp2,'runner-pins.json'),'utf8')));
await add(path.join(cpp2,'compile-plan.json'));
await add(path.join(cpp2,'runner-pins.json'));
const prep=JSON.parse(await readFile(path.join(here,'SOURCE-PREPARATION.json'),'utf8'));
for(const row of prep.inherited_pins)await add(path.resolve(task,row.path));
const helper=await add(path.join(cpp2,'run-compile-window.py'));
assert.equal(helper.sha256,'0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395');
const commands=focus.commands.map(x=>({...x,source:x.argv[x.argv.length-3]}));
const extra=structuredClone(commands[0]);extra.stage='compile-original-producer-fixture';extra.source=path.join(here,'fixtures/original-producer.cpp');extra.argv[extra.argv.length-3]=extra.source;extra.outputObject=path.join(here,'build/objects/original-producer-fixture.o');extra.outputDependencyFile=path.join(here,'build/objects/original-producer-fixture.d');extra.argv[extra.argv.length-1]=extra.outputObject;extra.scope='Compile actual-original-loader fixture declaration only; no fixture execution';commands.push(extra);
for(const row of [...pins.values()]){const b=await readFile(row.path);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);}
const baseFlags=commands[0].argv.slice(3,commands[0].argv.indexOf('-MMD'));
const result={schemaVersion:1,status:'source-prepared-six-compile-only-stages-not-executed',sourceCommit:focus.sourceCommit,browserRecoveryHasPriority:true,parentExclusiveSlotReleaseRequired:true,commands,pins:[...pins.values()].sort((a,b)=>a.path.localeCompare(b.path,'en')),cpp2Helper:helper,guard:focus.guard,frozenSDK:focus.frozenSDK,launchGate:focus.launchGate,ownedResourceGuard:focus.ownedResourceGuard,rustEnvironment:{},removeInheritedEnvironment:focus.removeInheritedEnvironment,buildIdentity:focus.buildIdentity,exactBaseFlags:baseFlags,stagedTree:{path:path.join(here,'build/sources/src'),fileCount:staged.fileCount,manifestSha256:sha(await readFile(path.join(here,'COHERENT-SOURCE-STAGING.json')))},affectedOriginalUnitsBeforeFullRelink:231,originalProducerExecuted:false,syntheticFixtureExecuted:false,RustExecuted:false,linkExecuted:false,browserExecuted:false,wholeGameAccepted:false};
await writeFile(path.join(here,'COMPILE-WINDOW-PLAN.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,stages:commands.length,pins:result.pins.length,planSha256:sha(await readFile(path.join(here,'COMPILE-WINDOW-PLAN.json')))}));
