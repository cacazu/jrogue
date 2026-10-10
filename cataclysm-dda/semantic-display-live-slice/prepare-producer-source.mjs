import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url)), task=path.dirname(here);
const sha=b=>createHash('sha256').update(b).digest('hex');
const pins=new Map();
async function pin(file,expected){
  const bytes=await readFile(file), row={path:path.resolve(file),bytes:bytes.length,sha256:sha(bytes)};
  if(expected){assert.equal(row.bytes,expected.bytes);assert.equal(row.sha256,expected.sha256);}
  const old=pins.get(row.path);assert.ok(!old||JSON.stringify(old)===JSON.stringify(row));pins.set(row.path,row);return row;
}
const compiled=JSON.parse(await readFile(path.join(here,'COMPILE-VERIFICATION.json'),'utf8'));
assert.equal(sha(await readFile(path.join(here,'COMPILE-VERIFICATION.json'))),'78fda00342ab9681ebfd633b9199cecd0d2c4c30989655c4aa8297138f26b1bf');
const old=JSON.parse(await readFile(path.join(here,'COMPILE-WINDOW-PLAN.json'),'utf8'));
assert.equal(sha(await readFile(path.join(here,'COMPILE-WINDOW-PLAN.json'))),'d9023bbce0f8a4b567c71fb630e0db8b3af29ca3a37c19122e7757c32cbf1379');
assert.equal(old.sourceCommit,'7b2efa5cea38e4d4d97dd0e63b28b9148623da59');
const staged=JSON.parse(await readFile(path.join(here,'COHERENT-SOURCE-STAGING.json'),'utf8'));
assert.equal(staged.fileCount,969);
const selection=[];
async function selectedFile(name){
  const file=path.join(here,'build/sources/src',name), expected=staged.pins.find(x=>x.path===file);
  assert.ok(expected&&expected.origin==='pristine');await pin(file,expected);
  return (await readFile(file,'utf8')).replace(/\r\n/g,'\n');
}
function selectedFunction(file,source,signature){
  const start=source.indexOf(signature);assert.ok(start>=0);assert.equal(source.indexOf(signature,start+signature.length),-1);
  const finish=source.indexOf('\n}\n',start);assert.ok(finish>start);
  const body=source.slice(start,finish+3);
  selection.push({source:file,signature,normalizedDefinitionSha256:sha(body),normalizedDefinitionBytes:Buffer.byteLength(body),definition:body});return body;
}
const translation=await selectedFile('translations.cpp'), output=await selectedFile('output.cpp');
const generation='static int current_language_version = INVALID_LANGUAGE_VERSION + 1;';
assert.equal(translation.split(generation).length,2);
const version=selectedFunction('src/translations.cpp',translation,'int detail::get_current_language_version()');
const tags=selectedFunction('src/output.cpp',output,'std::vector<size_t> get_tag_positions( std::string_view s )');
const strip=selectedFunction('src/output.cpp',output,'std::string remove_color_tags( std::string_view s )');
const source='// Focused support only: exact selected original definitions; not whole translations/output TUs.\n'+
  '// Diagnostic leaves below abort on every call and cannot silently pass producer checks.\n'+
  '#include "translations.h"\n#include "output.h"\n#include "debug.h"\n'+
  '#include <algorithm>\n#include <cstdint>\n#include <cstdlib>\n#include <string>\n#include <string_view>\n#include <vector>\n\n'+
  generation+'\n'+version+'\n'+tags+'\n'+strip+'\n'+
  'namespace { std::uint32_t fixture_diagnostic_calls = 0; }\n'+
  'void realDebugmsg( const char *, const char *, const char *, const std::string & )\n'+
  '{ ++fixture_diagnostic_calls; std::abort(); }\n'+
  'std::ostream &DebugLog( DebugLevel, DebugClass )\n'+
  '{ ++fixture_diagnostic_calls; std::abort(); }\n'+
  'extern "C" std::uint32_t cdda_fixture_diagnostic_call_count()\n'+
  '{ return fixture_diagnostic_calls; }\n';
const support=path.join(here,'fixtures/generated-original-support.cpp');
await writeFile(support,source);await pin(support);
const full=JSON.parse(await readFile(path.join(task,'full-engine-overlay-plan/FULL-INTEGRATION-PLAN.json'),'utf8'));
assert.equal(full.sourceCommit,old.sourceCommit);assert.equal(full.compatibleObjectReuse.units,207);
const names=['json_loader','flexbuffer_json','json','translation','path_info','cata_bitset','filesystem','catacharset','string_formatter','flexbuffer_cache','text_style_check_reader','translation_manager','translation_manager_impl','translation_document','translation_plural_evaluator','demangle','wcwidth','cata_utility','mmap_file','system_locale','cached_options','third-party/flatbuffers/idl_parser','third-party/flatbuffers/util'];
const reusable=[];
for(const name of names){
  const object=path.join(task,'engine-build/objects',name+'.o'), dependencyFile=path.join(task,'engine-build/objects',name+'.d');
  const accepted=full.compatibleObjectReuse.objects.find(x=>x.object.path===object);assert.ok(accepted);assert.equal(accepted.success.code,0);
  await pin(object,accepted.object);await pin(accepted.successfulCommandLog.path,accepted.successfulCommandLog);const depPin=await pin(dependencyFile);
  const line=(await readFile(dependencyFile,'utf8')).replace(/\\\r?\n/g,' ').split(/\r?\n/)[0], separator=line.indexOf(': ');assert.ok(separator>0);
  const dependencies=[...new Set(line.slice(separator+2).trim().split(/\s+/).map(x=>path.resolve(x)))];
  assert.equal(dependencies.some(x=>['input.h','input_context.h','help.h'].includes(path.basename(x))),false);
  for(const row of accepted.unchangedDependencies){
    const original=path.join('C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59',row.file);
    await pin(original,row);
  }
  for(const file of dependencies)await pin(file);
  reusable.push({...accepted,dependencyFile:depPin,actualMmdPaths:dependencies});
}
// MMD excludes system headers: retain all coherent source pins and original FlatBuffers includes.
for(const row of old.pins)await pin(row.path,row);
for(const row of compiled.currentOutputs??[])if(row.path)await pin(row.path,row);
const acceptedOutputs={help:{bytes:267270,sha256:'8197a39862c57096abee1f6d1c8d7dd3fb2ea795d2708681436f22a6724ad56f'},cdda_help_semantic:{bytes:153948,sha256:'17ca8fc98560b7c33b2699f13e22fbfbaac09cf08418086084d405d29cd3bd46'},'original-producer-fixture':{bytes:73533,sha256:'4a5136f7e3c0f1f88c0b010459aa7515d1695c9123d9c7eb957db2bad67e9660'}};
for(const name of ['help','cdda_help_semantic','original-producer-fixture']){
  await pin(path.join(here,'build/objects',name+'.o'),acceptedOutputs[name]);await pin(path.join(here,'build/objects',name+'.d'));
}
for(const file of ['COMPILE-VERIFICATION.json','COMPILE-WINDOW-PLAN.json','run-compile-window.py','prepare-producer-source.mjs','fixtures/run-original-producer.mjs'])await pin(path.join(here,file));
const result={schemaVersion:1,status:'source-prepared-strict-link-closure-not-executed',sourceCommit:old.sourceCommit,
  support:{path:support,initializer:generation,initializerSource:'src/translations.cpp',selectedOriginalDefinitions:selection,
    diagnosticLeaves:['realDebugmsg','DebugLog'],diagnosticPolicy:'Every call increments the fixture count then aborts; no successful no-op or replacement producer behavior'},
  originalCoreReuse:{objects:reusable,count:reusable.length,changedClassHeaderDependencies:[],strictLinkClosureProven:false},
  currentCompiledProducerScope:{methods:['help::load','help::reset','get_help','help::observe_loaded_topic','cdda_help_semantic::bind_keybinding_name'],
    originalJsonAndTranslationObjects:true,originalFixtureChecks:34,originalProducerExecuted:false,getKeyDescriptionExecuted:false,helpDisplayExecuted:false,selectedHelpScopeExecuted:false,nativeKeyLookupExecuted:false},
  pins:[...pins.values()].sort((a,b)=>a.path.localeCompare(b.path,'en')),
  RustExecuted:false,browserExecuted:false,fullEngineLinked:false,wholeGameAccepted:false};
await writeFile(path.join(here,'PRODUCER-SOURCE-PACKET.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,selectedOriginalDefinitions:selection.length,originalCoreObjects:reusable.length,pins:result.pins.length,supportSha256:sha(source),packetSha256:sha(await readFile(path.join(here,'PRODUCER-SOURCE-PACKET.json')))}));
