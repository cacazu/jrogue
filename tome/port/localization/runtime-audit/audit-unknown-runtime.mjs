#!/usr/bin/env node
// GPL-3.0-or-later. Read-only source/runtime evidence audit; no gameplay executes.
// No catalogue/runtime mutation, reverse string replacement or translation is used.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import assert from 'node:assert/strict';

const directory=import.meta.dirname,project=path.dirname(directory);
const evidencePath=path.join(project,'native-core-work/semantic-browser-probe/evidence.json');
const output=path.resolve(process.argv[2]??directory);
assert.ok(output===directory||output.startsWith(directory+path.sep),'Audit output must remain in its owned folder');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const evidenceBytes=fs.readFileSync(evidencePath),evidenceHash=hash(evidenceBytes);
const proof=JSON.parse(evidenceBytes.toString('utf8'));
const before=proof.scenario?.coverageBefore;
assert.ok(before,'Exact before snapshot is required; do not silently switch to a different coverage phase');
const inventory=before.unknown_callsite_inventory;
const entries=Array.isArray(inventory?.entries)?inventory.entries:[];
assert.equal(entries.length,inventory.retained_distinct_count,'Recorded inventory count differs');
assert.equal(entries.reduce((sum,row)=>sum+row.occurrences,0),inventory.retained_occurrences,'Recorded occurrence count differs');
const originalRoots=JSON.parse(fs.readFileSync(path.join(project,'inventory-work/inventory-output/summary.json'),'utf8')).sourceRoots;
const unpacked=originalRoots[1];
let sampledPeakRss=process.memoryUsage().rss;
const sample=()=>{sampledPeakRss=Math.max(sampledPeakRss,process.memoryUsage().rss);};
const japanesePattern=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const isAscii=value=>/^[\x00-\x7f]*$/.test(value);
const sources=new Set(entries.map(row=>row.source)),asciiNames=new Set(entries.filter(row=>isAscii(row.source)).map(row=>row.source));
const officialTargets=new Map(),officialEnglish=new Map(),literalCandidates=new Map(),declarations=new Map();
async function scanJsonl(file,visit){
 let rows=0;const stream=readline.createInterface({input:fs.createReadStream(file,{encoding:'utf8',highWaterMark:65536}),crlfDelay:Infinity});
 for await(const line of stream){if(!line)continue;visit(JSON.parse(line));if(++rows%1000===0)sample();}
 return rows;
}
const registrationRows=await scanJsonl(path.join(project,'inventory-work/inventory-output/upstream-ja-catalogue.jsonl'),row=>{
 const locator={file:row.file,line:row.line,section:row.section,english:row.english,translated:row.translated,tag:row.tag};
 if(sources.has(row.translated)){const list=officialTargets.get(row.translated)??[];list.push(locator);officialTargets.set(row.translated,list);}
 if(asciiNames.has(row.english)){const list=officialEnglish.get(row.english)??[];list.push(locator);officialEnglish.set(row.english,list);}
});
const candidateRows=await scanJsonl(path.join(project,'inventory-work/inventory-output/text-candidates.jsonl'),row=>{
 if(asciiNames.has(row.value)){const list=literalCandidates.get(row.value)??[];list.push(row);literalCandidates.set(row.value,list);}
});
const declarationRows=await scanJsonl(path.join(project,'inventory-work/inventory-output/declarations.jsonl'),row=>{
 if(typeof row.fields?.name==='string'&&asciiNames.has(row.fields.name)){
  const list=declarations.get(row.fields.name)??[];list.push(row);declarations.set(row.fields.name,list);
 }
});

// Registry routes are streamed individually instead of parsing/copying its
// full 30 MB entries object. JSON object values are tracked through strings,
// escapes and nested delimiters; no textual replacement occurs.
async function* registryRoutes(file){
 let found=false,tail='',value='',depth=0,inString=false,escape=false;
 for await(const chunk of fs.createReadStream(file,{encoding:'utf8',highWaterMark:65536})){
  let input=chunk;
  if(!found){const combined=tail+chunk,match=/"routes"\s*:\s*\[/.exec(combined);
   if(!match){tail=combined.slice(-256);continue;}found=true;input=combined.slice(match.index+match[0].length);tail='';}
  for(const character of input){
   if(!depth){if(character===']')return;if(/[\s,]/.test(character))continue;
    assert.equal(character,'{','Unexpected non-object registry route');depth=1;value='{';inString=false;escape=false;continue;}
   value+=character;
   if(inString){if(escape)escape=false;else if(character==='\\')escape=true;else if(character==='"')inString=false;continue;}
   if(character==='"')inString=true;else if(character==='{'||character==='[')depth++;else if(character==='}'||character===']')depth--;
   if(!depth){yield JSON.parse(value);value='';sample();}
   if(value.length>2*1024*1024)throw Error('Unexpected oversized individual registry route');
  }
 }
 throw Error('Missing/unterminated top-level generated registry routes');
}
const matchingRoutes=new Map();let routeRows=0;
for await(const route of registryRoutes(path.join(project,'localization-kernel-work/catalogs/registry.json'))){
 routeRows++;if(sources.has(route.source)){const list=matchingRoutes.get(route.source)??[];list.push(route);matchingRoutes.set(route.source,list);}
}

function physicalConsumer(file){
 const virtual=file.replace(/^@/,'').replaceAll('\\','/').replace(/^\/+/,'');
 if(virtual.startsWith('engine/'))return 'game/engines/default/'+virtual;
 if(virtual.startsWith('mod/')||virtual.startsWith('data/'))return 'game/modules/tome/'+virtual;
 if(virtual.startsWith('game/'))return virtual;
 throw Error('Unreviewed runtime consumer mapping: '+file);
}
const fileEvidence=new Map();
function readEvidence(file,line,margin=4){
 let cached=fileEvidence.get(file);
 if(!cached){const bytes=fs.readFileSync(path.join(unpacked,file));cached={file,sha256:hash(bytes),bytes:bytes.length,lines:bytes.toString('utf8').split(/\r?\n/)};fileEvidence.set(file,cached);}
 const first=Math.max(1,line-margin),last=Math.min(cached.lines.length,line+margin);
 return {file,line,sha256:cached.sha256,context:cached.lines.slice(first-1,last).map((text,index)=>({line:first+index,text}))};
}
// This name is assigned through a class constant, so the literal inventory's
// newTalent/name heuristics cannot attribute the producer. Keep the actual
// generated-talent identity seam as explicit reviewed evidence instead.
const objectActivationFile='game/modules/tome/mod/class/interface/ActorObjectUse.lua';
const opaquePrototypeNames=new Set(['azdadazdazdazd','ervevev','zeczczeczec','Indiscernible Anatomyblabla']);
function producerReview(row,locators){
 if(row.source==='Activate Object')return {
  owner_kind:'generated_object_activation_talent',display_exposure:'Base template has hide="always"; actual display_name already uses translated activation text and the object name.',
  required_followup:'Add only the exact source/tag display route after reviewed semantic ownership; retain the base constant and explicit generated tid/short_name unchanged.',
  identity_guard:'base_object_talent_name feeds useObjectTalentId before newTalent; replacing the constant would change T_ACTIVATE_OBJECT_<n> identity/save compatibility.',
  evidence:[73,78,81,126,130,134,260,262].map(line=>readEvidence(objectActivationFile,line,2))};
 if(row.source==='Players')return {owner_kind:'builtin_faction',required_followup:'Add an exact Players/faction name semantic display route; preserve the original players short_name and external actor/user names.',identity_evidence:readEvidence('game/engines/default/engine/Faction.lua',38,3)};
 if(opaquePrototypeNames.has(row.source))return {owner_kind:'opaque_upstream_prototype_label',required_followup:'Resolve intended label semantics before authoring a Japanese replacement; retain this exact upstream value until a faithful display policy is reviewed.',blocker:'The original label contains placeholder text; a meaningful translated talent name cannot be inferred from the label alone.',player_exposure:'Observed during registration; current player access/display was not established.'};
 if(locators.some(locator=>locator.file.endsWith('/misc/inscriptions.lua')))return {owner_kind:'legacy_inscription',required_followup:'Add an exact source/tag semantic display route and reviewed Japanese name; preserve original inscription short_name used by compatibility/NPC definitions.',legacy_evidence:readEvidence('game/modules/tome/data/talents/misc/inscriptions.lua',1155,1),player_exposure:'Source excludes these from drop tables but retains compatibility and occasional NPC use.'};
 return {owner_kind:'original_talent_declaration',required_followup:'Add an exact source/tag semantic display route from the declaration owner and review Japanese terminology; do not change the English name before native short_name generation.',player_exposure:'Observed during registration; this snapshot does not prove current learnability or rendered display.'};
}
function category(row,file){
 const jp=japanesePattern.test(row.source);
 if(file.endsWith('/ActorTemporaryEffects.lua')&&row.line===57&&jp)return 'already_japanese_effect_label_reentered_translation';
 if(file.endsWith('/ActorTalents.lua')&&row.line===57&&jp)return 'already_japanese_talent_type_label_reentered_translation';
 if(file.endsWith('/ActorTalents.lua')&&row.line===88)return jp?'decorated_japanese_evolution_talent_label':'unmapped_english_talent_name';
 if(file.endsWith('/Faction.lua')&&row.line===40&&row.source==='Players')return 'unmapped_builtin_faction_display_name';
 if(file.endsWith('/Zone.lua')||file.endsWith('/GameState.lua')||file.endsWith('/Object.lua')||file.endsWith('/ObjectIdentify.lua'))return jp?'japanese_object_or_randart_name_reentered_translation':'object_name_review_required';
 if(file.endsWith('/font-life.lua')&&jp)return 'decorated_japanese_terrain_name_reentered_translation';
 return 'unclassified_requires_owner_review';
}
const categoryCounts={},consumerGroups=new Map(),audited=[];
for(const row of entries){
 const file=physicalConsumer(row.file),kind=category(row,file),routes=matchingRoutes.get(row.source)??[];
 const current=categoryCounts[kind]??={entries:0,occurrences:0};current.entries++;current.occurrences+=row.occurrences;
 const key=JSON.stringify([file,row.line,row.tag]);
 const group=consumerGroups.get(key)??{file,line:row.line,tag:row.tag,entries:0,occurrences:0,categories:{},source_evidence:readEvidence(file,row.line)};
 group.entries++;group.occurrences+=row.occurrences;group.categories[kind]=(group.categories[kind]??0)+1;consumerGroups.set(key,group);
 const candidates=literalCandidates.get(row.source)??[];
 const producerCandidates=[...candidates.filter(candidate=>candidate.field==='name'||candidate.declaration?.kind==='newTalent'||candidate.declaration?.kind==='newFaction')];
 const explicitDeclarations=declarations.get(row.source)??[];
 const sourceLocators=new Map();
 for(const candidate of [...producerCandidates,...explicitDeclarations]){
  if(!candidate.file.startsWith('game/modules/tome/')&&!candidate.file.startsWith('game/engines/default/'))continue;
  const key=JSON.stringify([candidate.file,candidate.line]);
  sourceLocators.set(key,{...readEvidence(candidate.file,candidate.line,6),kind:candidate.kind??candidate.declaration?.kind??'potential_name_literal',
   identity:candidate.identity??candidate.declaration?.identity??null,field:candidate.field??null,
   semantic_owner_suggestion:candidate.semanticContextSuggestion??candidate.declaration?.semanticContextSuggestion??candidate.semanticIdSuggestion??null});
 }
 if(row.source==='Activate Object')sourceLocators.set(JSON.stringify([objectActivationFile,73]),{
  ...readEvidence(objectActivationFile,73,6),kind:'class_constant_then_generated_talent',identity:'ACTIVATE_OBJECT_<n>',field:'base_object_talent_name',semantic_owner_suggestion:'object_activation/base_talent/name'});
 const exactRoutes=routes.filter(route=>route.tag===row.tag);
 audited.push({...row,physical_consumer:file,classification:kind,contains_japanese:japanesePattern.test(row.source),ascii_only:isAscii(row.source),
  official_target_equality_matches:officialTargets.get(row.source)??[],
  official_english_registration_matches:officialEnglish.get(row.source)??[],
  current_exact_source_tag_routes:exactRoutes,current_other_tag_routes:routes.filter(route=>route.tag!==row.tag),
  producer_candidates:[...sourceLocators.values()],
  producer_review:isAscii(row.source)?producerReview(row,[...sourceLocators.values()]):null,
  native_semantics:'Original _t falls back to the unchanged input when no active source/tag registration exists; Japanese input equality is audit evidence only, never a reverse replacement.'});
}
const english=audited.filter(row=>row.ascii_only),japanese=audited.filter(row=>row.contains_japanese);
const summary={schema_version:1,source_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63',
 evidence:{file:path.relative(project,evidencePath).replaceAll('\\','/'),sha256:evidenceHash,phase:'scenario.coverageBefore',proof_passed:proof.passed,proof_started_at:proof.started_at},
 retained_callsite_keys:entries.length,retained_occurrences:inventory.retained_occurrences,omitted_occurrences:inventory.omitted_occurrences,
 retained_distinct_is_lower_bound:inventory.distinct_count_is_lower_bound,truncated_sources:entries.filter(row=>row.source_truncated).length,
 reasons:Object.fromEntries([...new Set(entries.map(row=>row.reason))].map(reason=>[reason,entries.filter(row=>row.reason===reason).length])),
 source_language_observations:{japanese_containing_callsite_keys:japanese.length,ascii_only_callsite_keys:english.length,
  unclassified_other_script_callsite_keys:audited.filter(row=>!row.contains_japanese&&!row.ascii_only).length,
  japanese_inputs_with_exact_official_target_equality:japanese.filter(row=>row.official_target_equality_matches.length).length,
  ascii_inputs_with_official_source_registration:english.filter(row=>row.official_english_registration_matches.length).length},
 route_audit:{streamed_current_routes:routeRows,unknown_keys_with_exact_current_route:audited.filter(row=>row.current_exact_source_tag_routes.length).length,
  unknown_keys_with_any_current_source_route:audited.filter(row=>row.current_exact_source_tag_routes.length||row.current_other_tag_routes.length).length,
  raw_japanese_second_pass_is_not_a_new_english_catalogue_gap:true},
 category_counts:categoryCounts,consumer_groups:[...consumerGroups.values()],
 english_runtime_labels:english.map(row=>({source:row.source,tag:row.tag,consumer:row.physical_consumer,line:row.line,
  classification:row.classification,producer_candidates:row.producer_candidates,producer_review:row.producer_review,official_matches:row.official_english_registration_matches})),
 actionable_followups:{
  exact_english_source_tag_pairs:english.length,meaningful_labels_requiring_reviewed_semantic_extensions:english.filter(row=>!opaquePrototypeNames.has(row.source)).length,
  opaque_upstream_prototype_labels_requiring_label_policy:english.filter(row=>opaquePrototypeNames.has(row.source)).map(row=>({source:row.source,tag:row.tag,producer_candidates:row.producer_candidates})),
  identity_generation_evidence:readEvidence('game/engines/default/engine/interface/ActorTalents.lua',71,18),
  already_japanese_reentry:'Trace the producer/consumer registration ownership and preserve native unchanged-input fallback. Do not reverse-map translated Japanese values to English IDs.',
  dynamic_name_followup:'Record original producer IDs and composition parameters at object/randart/terrain/evolution construction seams before adding semantic routes; preserve random-name generation and external actor names.',
  help_followup:'Exercise dynamic talent/effect/object help in a separate actual-runtime flow; zero help callsites here is an observation, not a coverage proof.'},
 inventory_streams_scanned:{registrationRows,candidateRows,declarationRows},
 important_limits:['Consumer locators identify the second lookup, not necessarily the declaration that first translated a label.',
  'Japanese characters or exact official target equality alone do not establish translation quality or producer ownership.',
  'Legacy inscriptions are absent from normal drop tables but retained for compatibility and occasional NPC use; registration does not establish current player access.',
  'No help consumer was observed in this snapshot; full dynamic help/dialog/campaign coverage is not established.',
  'These runtime unknown keys are distinct from the 479 known static official gaps already supplemented.',
  'No runtime/catalog changes, reverse substitutions or new translations were applied.'],
 original_source_modified:false,catalog_modified:false,runtime_modified:false,gameplay_or_rng_called:false,complete_translation_coverage_claimed:false,
 memory:{sampled_peak_rss_bytes:sampledPeakRss,final:process.memoryUsage()}};
// Ensure the read-only input represents one completed proof, not a changing
// parent run. A change requires this audit to be regenerated after quiescence.
assert.equal(hash(fs.readFileSync(evidencePath)),evidenceHash,'Browser proof changed during audit');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'unknown-callsite-classification.json'),JSON.stringify(audited,null,2)+'\n');
fs.writeFileSync(path.join(output,'reviewed-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({retained_keys:entries.length,occurrences:inventory.retained_occurrences,languages:summary.source_language_observations,
 route_audit:summary.route_audit,categories:categoryCounts,english_labels:english.map(row=>({source:row.source,producer_candidates:row.producer_candidates.map(candidate=>({file:candidate.file,line:candidate.line,identity:candidate.identity}))})),
 sampled_peak_rss_bytes:sampledPeakRss}).replace(/[\u0080-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')));
