/** Source-backed presentation tests. No Pascal/browser execution or gameplay-state witness. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {render} from './render.mjs';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {curateLocaleRefreshSites,localeRefreshSourcePins,helpTopicTitleRequests,
 fixedInputSubstitutions,helpTopicTitleImplementation,fixedInputSubstitutionImplementation,
 helpEntryPresentationImplementation} from './locale-refresh-sites.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const manifest=JSON.parse(read('localization/manifest.json'));
const contracts=JSON.parse(read('localization/contract.json')).parameters;
const locales={en:JSON.parse(read('localization/en.json')),ja:JSON.parse(read('localization/ja.json'))};
const help=JSON.parse(read('localization/help-catalog.json'));
const report=JSON.parse(read('localization/locale-refresh-sites.json'));
function author(overrides={},en=locales.en,typed=contracts){
 const patches=[],file=f=>overrides[f]??read('upstream/drl/'+f);
 const exact=(f,original,replacement)=>{
  const source=file(f),nl=source.includes('\r\n')?'\r\n':'\n';
  original=original.replaceAll('\r\n',nl);replacement=replacement.replaceAll('\r\n',nl);
  const start=source.indexOf(original);assert.ok(start>=0,original);
  assert.equal(source.indexOf(original,start+1),-1,original);
  patches.push({file:f,start,end:start+original.length,original,replacement,id:null,kind:'bridge-support'});
 };
 return {metadata:curateLocaleRefreshSites({file,exact,patches,en,contracts:typed}),patches};
}
function helpSnapshot(topic,lines){
 const doc=help.documents.find(d=>d.topic===topic);
 const matched=doc&&JSON.stringify(doc.lines)===JSON.stringify(lines);
 return {topic:matched?topic:null,rawLines:[...lines]};
}
function helpBlocks(snapshot,language){
 if(snapshot.topic===null)return [...snapshot.rawLines];
 const doc=help.documents.find(d=>d.topic===snapshot.topic);
 return doc.segments.flatMap(s=>s.kind==='blank'?[...s.lines]:[
  render(locales[language],contracts,s.id,{})]);
}
function title(snapshot,original,language){
 const row=helpTopicTitleRequests.find(r=>r.topic===snapshot.topic&&r.english===original);
 return row?render(locales[language],contracts,row.id,{}):original;
}
function input(mode,id,fallback,language){
 const r=fixedInputSubstitutions.find(r=>r.mode===mode&&r.input===id);
 return r?render(locales[language],contracts,r.id,{}):fallback;
}
test('locale projection authoring has exact original hashes, 12 source guards and zero new IDs',()=>{
 assert.deepEqual(author().metadata,report);assert.equal(report.counts.guardedPatches,12);
 assert.equal(report.counts.newSemanticIds,0);assert.equal(report.counts.fixedInputSourceAssignments,23);
 assert.equal(new Set(fixedInputSubstitutions.map(r=>r.id)).size,16);
 for(const r of [...helpTopicTitleRequests,...fixedInputSubstitutions]){
  assert.equal(locales.en[r.id],r.english);assert.deepEqual(contracts[r.id],{});
 }
 for(const p of report.guardedPatches)assert.equal(
  read('upstream/drl/'+p.file).slice(p.start,p.end),p.original);
 for(const p of report.inputSourceGuards)assert.equal(
  read('upstream/drl/'+p.file).slice(p.start,p.end),p.original);
});
test('all eight official Help snapshots reproject JA EN JA without changing retained original bytes',()=>{
 for(const doc of help.documents){
  const snapshot=helpSnapshot(doc.topic,doc.lines),before=JSON.stringify(snapshot);
  const first=helpBlocks(snapshot,'ja'),english=helpBlocks(snapshot,'en'),last=helpBlocks(snapshot,'ja');
  assert.deepEqual(first,last);assert.notDeepEqual(first,english,doc.topic);
  assert.deepEqual(snapshot.rawLines,doc.lines);assert.equal(JSON.stringify(snapshot),before);
  const row=helpTopicTitleRequests.find(r=>r.topic===doc.topic);
  assert.equal(title(snapshot,row.english,'en'),row.english);
  assert.equal(title(snapshot,row.english,'ja'),locales.ja[row.id]);
 }
});
test('unknown or changed Help source and overridden topic titles remain exact literal fallbacks',()=>{
 const doc=help.documents[0],changed=[...doc.lines];changed[1]+=' custom content';
 for(const snapshot of [helpSnapshot('custom-help',['External name: Alice {x}']),
  helpSnapshot(doc.topic,changed)]){
  assert.equal(snapshot.topic,null);
  for(const language of ['ja','en'])assert.deepEqual(helpBlocks(snapshot,language),snapshot.rawLines);
  assert.equal(title(snapshot,'Custom help title','ja'),'Custom help title');
 }
 const exact=helpSnapshot(doc.topic,doc.lines);
 assert.equal(title(exact,'Overridden introduction','ja'),'Overridden introduction');
});
test('fixed substitution IDs bypass stale cache language while configured and unknown bindings remain verbatim',()=>{
 for(const row of fixedInputSubstitutions){
  const previous=locales.ja[row.id];
  assert.equal(input(row.mode,row.input,previous,'en'),row.english);
  assert.equal(input(row.mode,row.input,row.english,'ja'),locales.ja[row.id]);
 }
 assert.deepEqual(['ja','en','ja'].map(lang=>input('keyboard','input_left','cached label',lang)),
  ['左','Left','左']);
 for(const language of ['ja','en']){
  assert.equal(input('keyboard','input_fire','Ctrl+K',language),'Ctrl+K');
  assert.equal(input('gamepad','input_fire','RTrigger',language),'RTrigger');
  assert.equal(input('keyboard','custom_external','Alice {{name}}',language),'Alice {{name}}');
 }
});
test('emitted methods preserve original Help storage and modal flow and add no simulation calls',()=>{
 const loader=read('localization/overlay/src/drlhelp.pas');
 const view=read('localization/overlay/src/drlhelpview.pas');
 const io=read('localization/overlay/src/drlio.pas');
 assert.ok(loader.includes(helpEntryPresentationImplementation));
 assert.match(loader,/if iMatches then iEntry\.FSemanticTopic := iTopic;/);
 assert.doesNotMatch(loader,/FText\.Clear|FText\.Push\(DRLHelp/);
 assert.match(view,/FEntries\.Push\( iTable\.GetValue\(2\) \)/);
 assert.match(view,/PresentationBlockCount - 1/);assert.match(view,/PresentationBlockText\(iBlock\)/);
 assert.match(view,/FList\[FCurrent\]\.PresentationTitle\(FEntries\[FCurrent\]\)/);
 assert.match(view,/FList\[i\]\.PresentationTitle\(FEntries\[i\]\)/);
 assert.ok(io.includes(fixedInputSubstitutionImplementation));
 assert.match(io,/iGamepad := IsGamepad;/);
 assert.match(io,/DRLTryFixedInputSubstitution\(iGamepad, aID, iText\)/);
 const pure=[helpEntryPresentationImplementation,helpTopicTitleImplementation,
  fixedInputSubstitutionImplementation].join('\n');
 assert.doesNotMatch(pure,/Statistics|ReadCharacter|Reconfigure|ResetCommands|Reload|Random|GameRNG|ProtectedCall|OnDescribe|VTIG_Event|VTIG_Reset|FMode|FCurrent/);
 for(const file of Object.keys(localeRefreshSourcePins))
  assert.equal(scanSource(read('localization/overlay/'+file),'pascal').diagnostics.length,0,file);
 assert.ok(read('localization/overlay/src/drlsemantichelp.pas').includes(helpTopicTitleImplementation));
 for(const p of author().patches)assert.doesNotMatch(p.replacement,/Statistics\.Update|GameRNG|Random\(|ResetCommands|VTIG_EventClear|VTIG_ResetScroll|VTIG_ResetSelect/);
});
test('locale projection rejects modified source or altered existing catalog/parameter contracts',()=>{
 const f='src/drlhelp.pas',s=read('upstream/drl/'+f);
 assert.throws(()=>author({[f]:s+' '}),/source provenance/);
 assert.throws(()=>author({}, {...locales.en,'help.topic.intro':'changed'}),/catalog contract/);
 assert.throws(()=>author({},locales.en,{...contracts,'view.input-key.left':{name:'string'}}),/catalog contract/);
});
