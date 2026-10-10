#!/usr/bin/env node
// GPL-3.0-or-later. Supplements stay separate from the pristine official catalog.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { specs } from './build-catalogs.mjs';
const output = path.resolve(process.argv[2]);
const load = name => JSON.parse(fs.readFileSync(path.join(output,name),'utf8'));
const english = load('catalogs/en.json'), officialJapanese = load('catalogs/ja.json');
const registry = load('catalogs/registry.json');
const routes = new Map(registry.routes.map(route=>[route.tag+'\0'+route.source,route]));
const overlays = Object.create(null), provenance = [], review = [], retainedOfficial = [];
const markup = text => (text.match(/#[A-Za-z0-9_]+#|#\{[^}]*\}#/g)??[]).sort();
// A plain `_t` tooltip such as "200% global speed" has no printf argument:
// "% g" belongs to the literal percentage. Real tformat conversions always
// retain strict Lua printf parsing, including the supported space flag.
const supplementSpecs = (text,tag) => tag === 'tformat' ? specs(text) : [...text.replace(/%%/g,'').matchAll(/%(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[cdiouxXeEfgGqsaA]/g)].filter(match => !(match[0].includes(' ') && /[0-9]/.test(text.replace(/%%/g,'')[match.index-1]??''))).map(match=>match[0]);
let entries = 0, assertions = 0, sourcePairs = new Set();
for(let batchIndex=0;batchIndex<4;batchIndex++) {
  const batch=load(`gap-review/batch-${batchIndex}.json`);
  const translated=load(`gap-review/translation-${batchIndex}.json`);
  const rows=Array.isArray(translated) ? translated : translated.entries;
  assert.equal(rows.length,batch.entries.length,`Incomplete batch ${batchIndex}`);
  for(let index=0;index<rows.length;index++) {
    const row=rows[index], original=batch.entries[index];
    assert.equal(row.english,original.english,`Changed English in batch ${batchIndex}:${index}`);
    assert.equal(row.tag,original.tag);
    assert.deepEqual(row.ids,original.ids);
    assert.deepEqual(row.source_locations,original.source_locations);
    assert.equal(typeof row.japanese,'string');
    assert.ok(['reviewed','translated','review_required'].includes(row.review_status),`Missing review status ${batchIndex}:${index}`);
    assert.deepEqual(supplementSpecs(row.japanese,row.tag),supplementSpecs(row.english,row.tag),`Changed printf conversions/order: ${batchIndex}:${index}`);
    assert.equal((row.japanese.match(/%%/g)??[]).length,(row.english.match(/%%/g)??[]).length,`Changed escaped percent: ${batchIndex}:${index}`);
    assert.deepEqual(markup(row.japanese),markup(row.english),`Changed named markup: ${batchIndex}:${index}`);
    assert.equal(row.japanese.includes('\ufffd'),false,`Replacement character in Japanese: ${batchIndex}:${index}`);
    const pair=row.tag+'\0'+row.english;
    assert.ok(!sourcePairs.has(pair),'Duplicate review source/tag');sourcePairs.add(pair);
    const route=routes.get(pair);assert.ok(route,`No current source route ${batchIndex}:${index}`);
    const record={batch:batchIndex,index,source:row.english,tag:row.tag,japanese:row.japanese,review_status:row.review_status,notes:row.notes??'',source_locations:row.source_locations,current_ids:route.aliases};
    const missing=route.aliases.filter(id=>officialJapanese[id]===null);
    if(!missing.length) {
      retainedOfficial.push({...record,reason:'Existing official Japanese, including intentional empty templates, stays authoritative'});
    } else if(row.review_status==='review_required') {
      review.push(record);
    } else {
      for(const id of missing){assert.equal(english[id],row.english);overlays[id]=row.japanese;}
      provenance.push({...record,current_ids:missing});
    }
    entries++;assertions+=12;
  }
}
fs.writeFileSync(path.join(output,'catalogs/ja-supplement.json'),JSON.stringify(overlays,null,2)+'\n');
fs.writeFileSync(path.join(output,'supplement-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
fs.writeFileSync(path.join(output,'supplement-review-required.json'),JSON.stringify(review,null,2)+'\n');
fs.writeFileSync(path.join(output,'supplement-official-retained.json'),JSON.stringify(retainedOfficial,null,2)+'\n');
const result={schema_version:1,source_commit:registry.source_commit,reviewed_batch_entries:entries,distinct_source_tag_pairs:sourcePairs.size,contract_assertions_passed:assertions,approved_supplement_ids:Object.keys(overlays).length,approved_source_tag_pairs:provenance.length,review_required_source_tag_pairs:review.length,official_source_tag_pairs_preserved:retainedOfficial.length,remaining_missing_ids_after_approved_overlay:Object.keys(officialJapanese).filter(id=>officialJapanese[id]===null&&!Object.hasOwn(overlays,id)).length,official_catalog_modified:false,original_source_modified:false,native_runtime_integration_verified:false,complete_translation_coverage_claimed:false};
fs.writeFileSync(path.join(output,'supplement-validation-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
