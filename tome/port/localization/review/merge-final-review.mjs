#!/usr/bin/env node
// GPL-3.0-or-later. STAGED SOURCE: parent executes sequentially when permitted.
// Writes a separate reviewed overlay only. Never modifies the official catalogs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {sourceCommit,precisionOwners,printfSpecifiers,conversionTypes,markupTokens} from './precision-policy.mjs';

const directory=import.meta.dirname;
const catalogRoot=path.resolve(process.argv[2]??path.join(directory,'../localization-kernel-work'));
const output=path.resolve(process.argv[3]??path.join(directory,'final-review'));
// Even when a parent supplies a different read root, output remains this owned
// review workspace. This script never writes to tome/upstream or official JSON.
const normalizedDirectory=path.resolve(directory).toLowerCase()+path.sep;
assert.ok(output.toLowerCase().startsWith(normalizedDirectory),'Output must remain below localization-review-work');
const inputHashes=[],samples=[];
let sampledMaxRss=0,checks=0;
const sample=stage=>{const memory=process.memoryUsage();sampledMaxRss=Math.max(sampledMaxRss,memory.rss);samples.push({stage,...memory});};
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const check=(condition,message)=>{checks++;assert.ok(condition,message);};
const equal=(left,right,message)=>{checks++;assert.deepEqual(left,right,message);};
function load(file){
 const bytes=fs.readFileSync(file);
 inputHashes.push({file:path.relative(directory,file).replaceAll('\\','/'),absolute:file,bytes:bytes.length,sha256:sha256(bytes)});
 return JSON.parse(bytes.toString('utf8'));
}
function hashFile(file){
 const digest=crypto.createHash('sha256'),buffer=Buffer.allocUnsafe(131072),fd=fs.openSync(file,'r');
 try{let length;while((length=fs.readSync(fd,buffer,0,buffer.length,null))>0)digest.update(buffer.subarray(0,length));}
 finally{fs.closeSync(fd);}return digest.digest('hex');
}
sample('start');
const english=load(path.join(catalogRoot,'catalogs/en.json'));
const officialJapanese=load(path.join(catalogRoot,'catalogs/ja.json'));
sample('english_japanese_read');
const registry=load(path.join(catalogRoot,'catalogs/registry.json'));
equal(registry.schema_version,1,'Unexpected registry schema');
equal(registry.source_commit,sourceCommit,'Different original source commit');
sample('registry_read_once');
const existing=load(path.join(catalogRoot,'catalogs/ja-supplement.json'));
const existingRecords=load(path.join(catalogRoot,'supplement-provenance.json'));
const reviewedRecords=load(path.join(directory,'translation-reviewed.json'));
const precisionRecords=load(path.join(directory,'format-adjustment-proposals.json'));
equal(Object.keys(existing).length,307,'Baseline supplement no longer contains exactly 307 IDs');
equal(reviewedRecords.flatMap(row=>row.current_ids).length,170,'Reviewed supplement no longer contains exactly 170 IDs');
equal(precisionRecords.flatMap(row=>row.current_ids).length,2,'Expected exactly two authorized precision adjustments');

const wantedPairs=new Set([...existingRecords,...reviewedRecords,...precisionRecords].map(row=>JSON.stringify([row.source,row.tag])));
const routes=new Map();
for(const route of registry.routes){
 const key=JSON.stringify([route.source,route.tag]);
 if(wantedPairs.has(key)){check(!routes.has(key),'Duplicate current source/tag route');routes.set(key,route);}
}
const overlay=Object.create(null),policies=Object.create(null),provenance=[],seenIds=new Set(),seenPairs=new Set();
let baselineIds=0,newIds=0,precisionIds=0;
function addRecord(row,stage){
 check(typeof row.source==='string'&&typeof row.tag==='string','Exact source/tag required');
 check(typeof row.japanese==='string','Japanese must be a string; empty is valid, null stays missing');
 check(!row.japanese.includes('\ufffd'),'Replacement character in Japanese');
 check(Array.isArray(row.current_ids)&&row.current_ids.length>0,'Exact reviewed semantic IDs required');
 const pair=JSON.stringify([row.source,row.tag]),route=routes.get(pair);
 check(route!==undefined,'Reviewed pair has no current route');
 check(!seenPairs.has(pair),'Duplicate source/tag review records');seenPairs.add(pair);
 const sourceSpecs=printfSpecifiers(row.source,row.tag),targetSpecs=printfSpecifiers(row.japanese,row.tag);
 equal(conversionTypes(targetSpecs),conversionTypes(sourceSpecs),'Typed conversion order changed');
 equal(markupTokens(row.japanese),markupTokens(row.source),'Markup/substitution sequence changed');
 equal((row.japanese.match(/%%/g)??[]).length,(row.source.match(/%%/g)??[]).length,'Escaped-percent count changed');
 if(stage!=='precision')equal(targetSpecs,sourceSpecs,'Unapproved printf width/precision/conversion change');
 else equal(row.current_ids.length,1,'Precision adjustment must be owned by one exact ID');

 for(const id of row.current_ids){
  check(!seenIds.has(id),'Duplicate semantic ID across overlays');seenIds.add(id);
  const entry=registry.entries[id];
  check(Object.hasOwn(english,id)&&entry!==undefined,'Reviewed ID absent from current EN/registry');
  equal(english[id],row.source,'Current EN differs from reviewed source');
  equal(entry.tag,row.tag,'Current semantic tag differs from reviewed tag');
  check(route.aliases.includes(id),'Reviewed semantic ID is not a current route alias');
  check(Object.hasOwn(officialJapanese,id)&&officialJapanese[id]===null,'Attempt to override existing official Japanese (including empty)');
  check(Array.isArray(row.source_locations)&&row.source_locations.length>0,'Source locator provenance missing');
  for(const location of entry.source_locations??[])check(row.source_locations.some(candidate=>candidate.file===location.file&&candidate.line===location.line),'Current source locator absent from review provenance');
  if(stage==='baseline'){
   check(Object.hasOwn(existing,id),'Baseline provenance ID absent from baseline overlay');
   equal(existing[id],row.japanese,'Baseline overlay differs from approved provenance');baselineIds++;
  }else if(stage==='new'){equal(row.review_status,'reviewed','New record is not reviewed');newIds++;}
  else{
   const authorized=precisionOwners.get(id);
   check(authorized!==undefined,'Precision policy ID outside the two exact reviewed owners');
   equal(row.source,authorized.source,'Precision policy source differs');
   equal(row.tag,authorized.tag,'Precision policy tag differs');
   equal(row.japanese,authorized.target,'Precision policy Japanese differs');
   equal(sourceSpecs,authorized.source_specifiers,'Precision policy source specifiers differ');
   equal(targetSpecs,authorized.target_specifiers,'Precision policy target specifiers differ');
   equal(conversionTypes(sourceSpecs),authorized.source_types,'Precision policy source types differ');
   equal(conversionTypes(targetSpecs),authorized.target_types,'Precision policy target types differ');
   equal(sourceSpecs[authorized.argument_index-1],'%-8.8s','Only exact byte-string precision owner is allowed');
   equal(targetSpecs[authorized.argument_index-1],'%s','Only reviewed locale-specific string layout is allowed');
   equal(entry.japanese_args_order,[],'Precision policy cannot bypass a reordered native argument contract');
   equal(entry.special_tokens,[],'Precision policy cannot bypass native special semantics');
   policies[id]={kind:'removeByteStringPrecision',review_status:'reviewed',...authorized,
    semantic_id:id,delegate_native_format_review:false,argument_order:'preserved',
    native_special_and_effective_order_checks_required:true,
    removed_layout:{left_justification:true,minimum_byte_width:8,byte_precision:8},
    source_locations:entry.source_locations,
    review_basis:'Original C sprintf %.8s splits official Japanese resource names. Exact per-ID %s layout preserves complete UTF-8; no numeric or other string contract is relaxed.'};
   precisionIds++;
  }
  overlay[id]=row.japanese;
 }
 provenance.push({...row,review_status:'reviewed',review_stage:stage,
  ...(stage==='precision'?{format_adjustment:{kind:'removeByteStringPrecision',approved_for_merge:true,policy_ids:row.current_ids}}:{}),
  official_catalogue_unchanged:true});
}
for(const row of existingRecords)addRecord(row,'baseline');
for(const row of reviewedRecords)addRecord(row,'new');
for(const row of precisionRecords)addRecord(row,'precision');
equal(baselineIds,307,'Baseline semantic coverage differs');
equal(newIds,170,'New reviewed semantic coverage differs');
equal(precisionIds,2,'Reviewed precision semantic coverage differs');
equal(Object.keys(overlay).length,479,'Complete known official-gap overlay must contain exactly 479 IDs');
const currentMissing=Object.keys(officialJapanese).filter(id=>officialJapanese[id]===null);
equal(currentMissing.length,479,'Current official gap inventory changed');
equal([...seenIds].sort(),currentMissing.sort(),'Overlay does not cover exactly the current official gaps');
equal(Object.keys(policies).sort(),[...precisionOwners.keys()].sort(),'Unexpected format policy coverage');
sample('strict_479_id_validation');

// Current catalogues are READ ONLY, and their complete-byte hashes are checked
// again in bounded chunks before any output is made reviewable.
for(const input of inputHashes)equal(hashFile(input.absolute),input.sha256,'An input changed during source-only merge');
fs.mkdirSync(output,{recursive:true});
const write=(name,value)=>{
 const target=path.join(output,name),temporary=target+'.tmp';
 fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');fs.renameSync(temporary,target);
};
write('ja-supplement-complete.json',overlay);
write('supplement-provenance-complete.json',provenance);
write('format-policy.json',{schema_version:1,source_commit:sourceCommit,default_action:'preserve_exact_native_format_contract',policies});
const missingAfter=currentMissing.filter(id=>!Object.hasOwn(overlay,id));
write('remaining-known-runtime-gaps.json',missingAfter);
sample('separate_overlay_written');
const report={schema_version:1,source_commit:sourceCommit,baseline_ids:baselineIds,new_reviewed_ids:newIds,reviewed_precision_ids:precisionIds,
 approved_overlay_ids:Object.keys(overlay).length,reviewed_source_tag_pairs:provenance.length,
 intentional_empty_overlay_ids:Object.values(overlay).filter(target=>target==='').length,
 remaining_known_official_gap_ids:missingAfter.length,format_policy_ids:Object.keys(policies),contract_checks:checks,
 inputs:inputHashes.map(({absolute,...record})=>record),sampled_max_rss_bytes:sampledMaxRss,memory_samples:samples,
 official_catalog_modified:false,original_source_modified:false,gameplay_or_rng_called:false,
 runtime_formatter_tests_run:false,native_runtime_integration_verified:false,complete_campaign_text_coverage_claimed:false,
 separate_deltas_not_counted:['DEATH_DREAM contextual damage label','new platform/particle diagnostic IDs']};
write('merge-final-review-result.json',report);
console.log(JSON.stringify({approved_overlay_ids:report.approved_overlay_ids,remaining_known_official_gap_ids:missingAfter.length,contract_checks:checks,sampled_max_rss_bytes:sampledMaxRss,output}));
