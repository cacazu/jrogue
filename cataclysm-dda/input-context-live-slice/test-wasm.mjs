import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import createModule from './build/original-input-context.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(here,'execution/wasm-results');
assert.equal(fs.existsSync(out),false,'refuse replacing an existing accepted or partial run');
fs.mkdirSync(out,{recursive:true});
const identity=fs.readFileSync(path.join(here,'module-build-id.txt'),'utf8').trim();
const commit='7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
const names=[
 'actual original registration and local/default/missing observation',
 'actual native resolver lazily inserts only after observation',
 'actual explicitly empty local override suppresses default key',
 'actual registered action order resolves colliding keys',
 'actual unmatched mouse is ignored despite ANY_INPUT',
 'actual no-argument handler timeout returns and restores',
 'actual nested original wait restores parent and current bindings',
 'actual original help branch retains intermediate help timeout',
 'actual STRING_INPUT preserves raw CJK username and edit bytes',
 'actual binding equality uses modifiers while ignoring raw text',
 'actual COORDINATE permits unmatched mouse with ANY_INPUT',
 'actual capability query and negative timeout remain separate from polling',
 'actual platform exception clears observer but retains native timeout limitation',
 'actual repeated original-table observation and retained pins are immutable',
 'actual over-limit original context keeps native input usable without snapshot'
];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const notifications=[];
globalThis.cddaInputSnapshotAvailable=notice=>{
 assert.equal(Object.isFrozen(notice),true);
 assert.equal(notice.kind,1);
 assert.equal(Number.isInteger(notice.publicationLow)&&notice.publicationLow>=0,true);
 assert.equal(Number.isInteger(notice.publicationHigh)&&notice.publicationHigh>=0,true);
 notifications.push({...notice});
};
const module=await createModule();
function bytes(pointer,size){
 const heap=module.HEAPU8;
 assert.equal(Number.isInteger(pointer)&&pointer>0,true);
 assert.equal(Number.isInteger(size)&&size>0&&size<=262144,true);
 assert.equal(pointer<=heap.byteLength&&size<=heap.byteLength-pointer,true);
 return Buffer.from(heap.slice(pointer,pointer+size));
}
function text(prefix){const size=module['_cdda_context_'+prefix+'_size']();if(size===0)return '';return new TextDecoder('utf-8',{fatal:true}).decode(bytes(module['_cdda_context_'+prefix+'_data'](),size));}
const a=(v,id)=>v.actions.find(action=>action.id===id);
const rows=[],recordFiles=[];
let lastGeneration=0n;
for(let id=1;id<=15;id++){
 const oldNotices=notifications.length;
 assert.equal(module._cdda_context_run(id),1,'focused original case '+id+': '+text('failure'));
 const records=[];
 for(let index=0;index<module._cdda_context_record_count();index++){
  const raw=bytes(module._cdda_context_record_data(index),module._cdda_context_record_size(index));
  const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  assert.equal(v.schema_version,1);assert.equal(v.interface,'cdda-live-input-snapshot/1');
  assert.equal(v.source_commit,commit);assert.equal(v.engine_build_id,identity);
  assert.equal(v.binding_authority,'original_action_contexts_const_lookup');
  assert.equal(a(v,'toggle_language_to_en').bindings.length,0);
  assert.equal(v.actions.filter(x=>x.id==='OPEN').length,id===7||id===8?Number(v.category!=='KEYBINDINGS'):1);
  assert.equal(v.effective_timeout_ms,module._cdda_context_record_timeout(index));
  const name='case-'+String(id).padStart(2,'0')+'-wait-'+String(index).padStart(2,'0')+'.json';
  fs.writeFileSync(path.join(out,name),raw);
  recordFiles.push({name,bytes:raw.length,sha256:digest(raw),generatedByActualOriginalMembers:true});
  records.push({v,raw,defaults:module._cdda_context_record_defaults(index)});
 }
 const action=text('action'),metric=i=>module._cdda_context_metric(i);
 const first=records[0]?.v;
 switch(id){
  case 1:
   assert.equal(action,'OPEN');assert.equal(records.length,1);
   assert.equal(a(first,'OPEN').origin,'context');assert.deepEqual(a(first,'OPEN').bindings[0].sequence,['q'.charCodeAt(0)]);
   assert.equal(a(first,'PAUSE').origin,'default');assert.equal(a(first,'LOCAL_EMPTY').origin,'context');assert.deepEqual(a(first,'LOCAL_EMPTY').bindings,[]);
   assert.equal(a(first,'MISSING_NATIVE_ACTION').origin,'missing');assert.deepEqual(a(first,'MISSING_NATIVE_ACTION').bindings,[]);
   assert.equal(metric(0),metric(1));assert.equal(metric(7),0);assert.equal(first.actions.filter(x=>x.id==='OPEN').length,1);break;
  case 2:
   assert.equal(action,'ANY_INPUT');assert.equal(records[0].defaults,metric(0));assert.equal(a(first,'MISSING_NATIVE_ACTION').origin,'missing');
   assert.equal(metric(7),1);assert.equal(metric(1)>metric(0),true);break;
  case 3:
   assert.equal(action,'ANY_INPUT');assert.equal(a(first,'LOCAL_EMPTY').origin,'context');assert.equal(a(first,'LOCAL_EMPTY').bindings.length,0);break;
  case 4:
   assert.equal(action,'FIRST_COLLISION');assert.equal(a(first,'FIRST_COLLISION').index<a(first,'SECOND_COLLISION').index,true);break;
  case 5:
   assert.equal(action,'OPEN');assert.equal(metric(2),2);assert.equal(records.length,2);assert.deepEqual(records[0].raw,records[1].raw);break;
  case 6:
   assert.equal(action,'TIMEOUT');assert.equal(first.effective_timeout_ms,0);assert.equal(metric(4),0);break;
  case 7: case 8: {
   assert.equal(action,id===7?'OPEN':'HELP_KEYBINDINGS');assert.equal(records.length,3);assert.equal(metric(3),1);
   const nested=records[1].v,restored=records[2].v;
   assert.equal(nested.category,'KEYBINDINGS');assert.equal(nested.depth,2);assert.equal(nested.parent_context_epoch,first.context_epoch);
   assert.equal(restored.depth,1);assert.equal(restored.context_epoch,first.context_epoch);
   assert.equal(BigInt(restored.publication_sequence)>BigInt(nested.publication_sequence),true);
   assert.equal(nested.effective_timeout_ms,7);assert.equal(restored.effective_timeout_ms,id===7?9:-1);
   assert.deepEqual(a(restored,'OPEN').bindings[0].sequence,[id===7?'r'.charCodeAt(0):'q'.charCodeAt(0)]);break;
  }
  case 9:
   assert.equal(action,'TEXT.CONFIRM');assert.equal(first.category,'STRING_INPUT');assert.equal(first.text_policy,'raw_utf8');
   assert.equal(first.preferred_keyboard_mode,'keychar');assert.equal(text('text'),'QA_Kit_日本🐈');assert.equal(text('edit'),'編集中');assert.equal(metric(6),1);break;
  case 10:
   assert.equal(action,'OPEN');assert.deepEqual(a(first,'OPEN').bindings[0].modifiers,['ctrl','shift']);assert.equal(text('text'),'raw text ignored for equality');break;
  case 11:
   assert.equal(action,'ANY_INPUT');assert.equal(first.coordinate_input_enabled,true);assert.equal(metric(4),1);assert.equal(metric(2),1);break;
  case 12:
   assert.equal(action,'OPEN');assert.equal(first.effective_timeout_ms,41);assert.equal(first.preferred_keyboard_mode,'keycode');break;
  case 13:
   assert.equal(action,'SCRIPTED_PLATFORM_EXCEPTION');assert.equal(first.effective_timeout_ms,9);assert.equal(metric(5),9);break;
  case 14:
   assert.equal(action,'OPEN');assert.equal(records.length,6);for(const record of records){assert.deepEqual(record.raw,records[0].raw);assert.equal(record.defaults,metric(0));}
   assert.equal(metric(0),metric(1));break;
  case 15:
   assert.equal(action,'OPEN');assert.equal(records.length,0);assert.equal(metric(2),1);break;
 }
 assert.equal(module._cdda_browser_snapshot_pin(1),0,'no context authorization survives outer scope');
 assert.equal(metric(5),id===13?9:41);
 await new Promise(resolve=>queueMicrotask(resolve));
 const notices=notifications.slice(oldNotices);
 const expected=id===7||id===8?[1,1,1,0]:id===15?[3,0]:[1,0];
 assert.deepEqual(notices.map(x=>x.availability),expected);
 for(const notice of notices){const n=(BigInt(notice.publicationHigh)<<32n)|BigInt(notice.publicationLow);assert.equal(n>lastGeneration,true);lastGeneration=n;}
 rows.push({name:names[id-1],passed:true,caseId:id,action,nativeRecords:records.length,notifications:notices});
}
assert.equal(recordFiles.length,24);
const pin=f=>{const b=fs.readFileSync(f);return{path:f,bytes:b.length,sha256:digest(b)};};
const report={schemaVersion:1,status:'selected-original-input-context-and-lookup-passed',sourceCommit:commit,moduleBuildIdentity:identity,
 checks:rows,nativeRecords:recordFiles,module:pin(path.join(here,'build/original-input-context.mjs')),wasm:pin(path.join(here,'build/original-input-context.wasm')),
 selectedOriginalClassMembersExecuted:true,originalWaitHookCallbacksExecuted:true,originalActionContextsLookupExecuted:true,
 scriptedHardwareLeaf:true,scriptedNestedHelpLeaf:true,originalFullKeybindingsUiExecuted:false,SDLHardwareImeVerified:false,
 languageToggleExecuted:false,turnStateRngSaveVerified:false,liveEngineIntegrated:false,commandAuthorization:'Denied(UntrackedNativeReaders)',wholeGameVerified:false};
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:rows.length,nativeRecords:recordFiles.length,wholeGameVerified:false}));
