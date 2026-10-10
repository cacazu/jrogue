import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile,copyFile,unlink} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const output=path.join(root,'build','look-target-fixture');
assert.ok(output.startsWith(path.join(root,'build')+path.sep));
await mkdir(output,{recursive:true});
const read=file=>readFile(path.join(root,file),'utf8');
const manifest=JSON.parse(await read('migration/look-target-data/source-manifest.json'));
const sourcePaths=['logic/web-semantic.h','logic/message.h','logic/list-message.h','logic/web-look-target.c','logic/web-look-target.h','logic/ui-target.c','logic/target.c','logic/cave-square.c','migration/look-target-data/source-manifest.json','tests/look-target-fixture/fixture.c','tests/look-target-fixture/mock.h','tests/look-target-fixture/run.mjs'];
const hash=async file=>createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
const before=Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,await hash(file)])));
function functionSource(source,name){
 const declaration=new RegExp('(?:void|const char \\*)\\s*'+name+'\\s*\\(').exec(source);
 assert.ok(declaration,name);const open=source.indexOf('{',declaration.index);let depth=1,index=open+1;
 // These exact producer functions contain no brace characters in strings/comments.
 while(depth&&index<source.length){const c=source[index++];if(c==='{')depth++;else if(c==='}')depth--;}
 assert.equal(depth,0,name);return source.slice(declaration.index,index);
}
const target=await read('logic/target.c'), nativeTarget=await read('migration/look-target-data/source-baseline/target.c');
const square=await read('logic/cave-square.c'),nativeSquare=await read('migration/look-target-data/source-baseline/cave-square.c');
const featureCodes=[...(await read('logic/list-terrain.h')).matchAll(/^FEAT\((\w+)\)/gm)].map(m=>m[1]);
assert.equal(featureCodes.length,25);
await writeFile(path.join(output,'feature-enum.h'),'enum {'+featureCodes.map(code=>'FEAT_'+code).join(',')+',FEAT_MAX};\n');
await writeFile(path.join(output,'feature-ids.h'),featureCodes.map(code=>JSON.stringify('terrain.'+code.toLowerCase()+'.name')+',').join('\n')+'\n');
await copyFile(path.join(here,'mock.h'),path.join(output,'angband.h'));
await writeFile(path.join(output,'cave.h'),'#include "angband.h"\n');
// Keep the actual message API/enum declarations pulled in by web-semantic.h.
// The fixture supplies only the basic scalar header boundary, not fake game behavior.
await writeFile(path.join(output,'h-basic.h'),'#include "angband.h"\n');
for(const file of ['message.h','list-message.h'])await copyFile(path.join(root,'logic',file),path.join(output,file));
await writeFile(path.join(output,'web-naming.h'),'#ifndef LOOK_NAMING_MOCK_H\n#define LOOK_NAMING_MOCK_H\n#include "angband.h"\n#define AB_NAMING_SNAPSHOT_MAX_BYTES (128U*1024U)\nstruct ab_naming_snapshot {char *json;uint32_t length;};\nbool ab_naming_copy_object_snapshot(struct ab_naming_snapshot *,const char *);\nbool ab_naming_copy_monster_snapshot(struct ab_naming_snapshot *,const char *);\nvoid ab_naming_snapshot_release(struct ab_naming_snapshot *);\n#endif\n');
await writeFile(path.join(output,'web-interface-text.h'),'const char *ab_if_feature_id(int feature);\n');
for(const file of ['web-look-target.c','web-look-target.h','web-semantic.h'])await copyFile(path.join(root,'logic',file),path.join(output,file));
const functions=[
 functionSource(nativeTarget,'look_mon_desc').replace('look_mon_desc(','original_look_mon_desc('),
 functionSource(nativeTarget,'coords_desc').replace('coords_desc(','original_coords_desc('),
 functionSource(nativeSquare,'square_apparent_name').replace('square_apparent_name(','original_square_apparent_name('),
 functionSource(target,'look_mon_desc'),functionSource(target,'coords_desc'),functionSource(square,'square_apparent_name')];
await writeFile(path.join(output,'fixture.c'),'#include "angband.h"\n#include "web-look-target.h"\n'+functions.join('\n\n')+'\n'+await read('tests/look-target-fixture/fixture.c'));
if(process.argv.includes('--prepare-only')){
 console.log(JSON.stringify({prepared:true,output,sourceHashes:before,compilerRun:false}));process.exit(0);
}
const sdk=process.env.ANGBAND_SDK||'C:\\Users\\kit\\emsdk';
const python=path.join(sdk,'python','3.13.3_64bit','python.exe'),emcc=path.join(sdk,'upstream','emscripten','emcc.py');
const env={...process.env,EM_CONFIG:path.join(sdk,'.emscripten'),EM_CACHE:path.join(root,'build','em-cache'),EMSDK_PYTHON:path.join(sdk,'python','3.13.3_64bit','python.exe'),EMCC_CORES:'1',BINARYEN_CORES:'1'};
function run(command,args,timeout){return new Promise((resolve,reject)=>{
 let stdout='',stderr='';const child=spawn(command,args,{cwd:output,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>{child.kill();reject(new Error('fixture command timed out'));},timeout);
 child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>2*1024*1024){child.kill();reject(new Error('fixture output exceeded bound'));}});
 child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>2*1024*1024){child.kill();reject(new Error('fixture stderr exceeded bound'));}});
 child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('exit',code=>{clearTimeout(timer);code===0?resolve({stdout,stderr}):reject(new Error('fixture command exit '+code+'\n'+stderr+'\n'+stdout));});
});}
await run(python,[emcc,'fixture.c','web-look-target.c','-I'+output,'-std=c11','-O0','-fwrapv','-sENVIRONMENT=node','-sEXIT_RUNTIME=1','-sASSERTIONS=1','-o','fixture.js'],120000);
const result=await run(process.execPath,['fixture.js'],15000);
const lines=result.stdout.trim().split(/\r?\n/),summary=JSON.parse(lines.find(line=>line.startsWith('RESULT ')).slice(7));
assert.equal(summary.passed,true);assert.equal(summary.conditionCases,22528);assert.equal(summary.coordinateCases,625);assert.equal(summary.events,8);assert.equal(summary.liveSnapshots,0);
const events=lines.filter(line=>line.startsWith('EVENT ')).map(line=>JSON.parse(line.slice(6)));
const schemas=new Map(manifest.entries.map(entry=>[entry.id,entry]));
const externalTerrainIds=new Set(manifest.terrain_records.map(entry=>entry.name_id));
function validate(event){
 const schema=schemas.get(event.id);if(!schema&&externalTerrainIds.has(event.id)){assert.deepEqual(Object.keys(event.params||{}),[]);return;}assert.ok(schema,event.id);assert.deepEqual(Object.keys(event.params||{}).sort(),schema.parameters.map(p=>p.name).sort(),event.id);
 for(const parameter of schema.parameters){const captured=event.params[parameter.name];assert.equal(captured.type,parameter.type,event.id+':'+parameter.name);if(captured.type==='localized_text')validate(captured.value);else if(captured.type==='integer')assert.ok(Number.isInteger(captured.value));else assert.ok(captured.value&&typeof captured.value==='object');}
}
for(const event of events)validate(event);
assert.equal(events[0].params.subject.value.params.object.value.mock_name,'a blade {猫}: %n ユーザー名');
assert.equal(events[0].params.diagnostics.value.id,'angband.look.empty');
assert.equal(events[1].params.diagnostics.value.id,'angband.look.diagnostics');
assert.equal(events[2].params.subject.value.params.name.value.id,'angband.look.trap.kind_7.normal');
assert.equal(events[3].params.subject.value.params.name.value.id,'angband.look.trap.kind_7.wizard');
assert.equal(events[4].id,'angband.look.row.carry');assert.equal(events[5].params.subject.value.params.count.value,2);
assert.equal(events[6].params.condition.value.params.condition.value.params.health.value.id,'angband.look.condition.health.living.4');
assert.equal(events[6].params.condition.value.params.condition.value.params.sleep.value.id,'angband.look.condition.status.sleep');
assert.equal(events[6].params.condition.value.params.condition.value.params.fear.value.id,'angband.look.condition.status.fear');
assert.equal(events[6].params.condition.value.params.condition.value.params.fast.value.id,'angband.look.empty');
assert.equal(events[7].params.subject.value.params.name.value.id,'terrain.none.name');
const after=Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,await hash(file)])));assert.deepEqual(after,before,'fixture sources changed during execution');
const report={...summary,sourceStableDuringRun:true,sourceHashes:before,eventContractsValidated:events.length,scope:'actual helper and selected producers with mocked semantic sink/naming allocator; no game/browser run',compiledGameEngine:false};
await writeFile(path.join(here,'report.json'),JSON.stringify(report,null,2)+'\n');
// Only generated artifacts in the checked constant fixture build directory are removed.
for(const name of ['fixture.js','fixture.wasm'])await unlink(path.join(output,name));
console.log(JSON.stringify(report));
