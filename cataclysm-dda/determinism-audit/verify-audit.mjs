import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const here=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const root=path.resolve(here,'..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const products=['occurrences.jsonl','SOURCE-MANIFEST.json','SCAN-EVIDENCE.json','FINDINGS.json','REVIEW-EVIDENCE.json'];
const before=new Map(products.map(name=>[name,hash(fs.readFileSync(path.join(here,name)))]));
for (const script of ['scan-source.mjs','curate-findings.mjs']) {
  const syntax=spawnSync(process.execPath,['--check',path.join(here,script)],{cwd:root,encoding:'utf8'});
  assert.equal(syntax.status,0,syntax.stderr);
  const result=spawnSync(process.execPath,[path.join(here,script)],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
}
for (const name of products) assert.equal(hash(fs.readFileSync(path.join(here,name))),before.get(name),`${name} changed on identical-source regeneration`);
const scan=JSON.parse(fs.readFileSync(path.join(here,'SCAN-EVIDENCE.json')));
const review=JSON.parse(fs.readFileSync(path.join(here,'REVIEW-EVIDENCE.json')));
assert.equal(scan.inventory_sha256,before.get('occurrences.jsonl'));
assert.equal(scan.source_manifest_sha256,before.get('SOURCE-MANIFEST.json'));
assert.equal(review.findings_sha256,before.get('FINDINGS.json'));
assert.equal(scan.full_game_determinism_verified,false);
assert.equal(review.full_game_determinism_verified,false);
const deliverables=fs.readdirSync(here).filter(name=>name!=='VERIFY-EVIDENCE.json'&&fs.statSync(path.join(here,name)).isFile()).sort().map(name=>{
  const bytes=fs.readFileSync(path.join(here,name));
  return {path:`determinism-audit/${name}`,bytes:bytes.length,sha256:hash(bytes)};
});
const evidence={schema:1,status:'SOURCE_AUDIT_REGENERATION_PASS',upstream_commit:scan.upstream_commit,node_version:process.version,inventory_regeneration_byte_identical:true,regenerated_products:products,lexical_source_assertions:scan.lightweight_lexical_assertions,reviewed_source_assertions:review.lightweight_source_assertions,source_files:scan.source_files,source_bytes:scan.source_bytes,occurrences:scan.occurrences,reviewed_findings:review.reviewed_findings,source_references:review.source_references,deliverables,engine_source_changed:false,engine_build_executed:false,browser_executed:false,full_game_determinism_verified:false};
fs.writeFileSync(path.join(here,'VERIFY-EVIDENCE.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,node:evidence.node_version,inventory:deliverables.find(row=>row.path.endsWith('/occurrences.jsonl')),counts:{files:evidence.source_files,occurrences:evidence.occurrences,findings:evidence.reviewed_findings,references:evidence.source_references,assertions:evidence.lexical_source_assertions+evidence.reviewed_source_assertions},full_game_determinism_verified:false}));
