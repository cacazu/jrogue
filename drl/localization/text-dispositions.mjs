/** Account for every original lexical candidate without treating discovery as translation.
 * Covered source spans and reviewed registry metadata are separate from runtime coverage.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildLiteralRoleReview} from './literal-role-review.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../upstream/drl');
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(readFileSync(path.resolve(here,f),'utf8'));
const count=rows=>{const counts={};for(const r of rows)counts[r.disposition]=(counts[r.disposition]??0)+1;return Object.fromEntries(Object.entries(counts).sort());};
const unshipped=f=>f==='bin/godmode.lua'||f.startsWith('bin/modules/');
export function buildTextDispositions(){
 const inventoryBytes=readFileSync(path.resolve(here,'../port/catalog/text-inventory.json'));
 const inventory=JSON.parse(inventoryBytes),manifest=read('manifest.json'),registry=read('registration-term-catalog.json'),help=read('help-catalog.json');
 if(inventory.source.commit!==manifest.sourceCommit)throw Error('Full text inventory pin differs');
 const sources={};
 for(const lock of inventory.manifest){
  const bytes=readFileSync(path.join(root,lock.file));
  if(bytes.length!==lock.bytes||hash(bytes)!==lock.sha256)throw Error(`Stale text inventory: ${lock.file}`);
  sources[lock.file]={sha256:lock.sha256,bytes:lock.bytes};
 }
 const patches=new Map,fields=new Map;
 for(const p of manifest.patches){const list=patches.get(p.file)??[];list.push(p);patches.set(p.file,list);}
 for(const record of registry.metadata)for(const [field,term]of Object.entries(record.fields)){
  const list=fields.get(term.source.file)??[];list.push({category:record.category,registryId:record.registryId,field,semanticId:term.semanticId,...term.source});fields.set(term.source.file,list);
 }
 const reasons={
  'reviewed-semantic-source-region':'Exact original source span belongs to a reviewed semantic overlay. This accounts for the source region; internal literals and retained English fallback inside the region are not separately claimed translated.',
  'reviewed-registry-field-with-original-domain-value':'Exact category/ID/field/source guard has EN/JA semantic metadata. Original English domain value is preserved; actual display consumers and runtime connection require separate verification.',
  'presentation-support-source-region':'Exact source region is a bridge/helper/registry-consumer change. Original literals may remain for domain values, exact guards or custom compatibility; this is not a blanket translation claim.',
  'excluded-unshipped-debug-or-classic-module':'Developer godmode or bundled classic module is outside the current original DRL production asset scope. Translate before offering that module.',
  'retained-empty-or-layout-literal':'Original lexical empty/layout value is preserved. This category is a lexical disposition, not a gameplay translation.',
  'machine-identified-internal-literal':'Discovery marks an internal literal (ID/key/path/control). Preserve original mechanics and protocol values. The lexical classifier does not establish whole-game display coverage.',
  'pending-visible-or-composed-text-review':'Untouched literal is a display or composed-text candidate. Needs a reviewed producer/consumer semantic seam; no global rendered-string matching.',
  'pending-ambiguous-literal-role-review':'Untouched candidate has no authoritative presentation/domain disposition yet. Manual source-role review is required before a full coverage claim.',
  'reviewed-official-help-paragraph':'Entire original pinned help line belongs to a reviewed semantic paragraph; controls, rights statements and external identities are preserved.',
  'retained-help-blank-line':'Original empty help line is retained in the validated document sequence.',
  'support-document-outside-game-ui':'Repository workflow, changelog, license or other source/support document remains an original source artifact. It is not an in-game UI translation claim.',
  'pending-dynamic-producer-review':'Dynamic name/plural/format/history producer candidate still needs source-role review, even if a contained literal belongs to a reviewed span.',
  'reviewed-dynamic-source-region':'Dynamic producer candidate lies in a reviewed original source span; runtime/domain semantics still require integration tests.',
  'pending-unrecognized-file-text-audit':'Unrecognized/binary file may contain embedded text. Asset/license and presentation audit must account for it separately.',
  'audited-original-binary-or-support-file':'Independent byte/header/source-use audit records actual format, original production roles and remaining painted/opaque text uncertainty. Original production inclusion is separate from the current browser raw-console asset pack.'
 };
 reasons['reviewed-explicit-source-role']='Exact source offset, byte hash and enclosing call/context prove a key, identity, path, schema, glyph or layout role. Original value is retained; this is an explicit source role adjudication, not a translation.';
 const literals=inventory.literals.map(r=>{
  const spans=(patches.get(r.file)??[]).filter(p=>p.start<=r.offset&&p.end>=r.endOffset&&p.end>p.start);
  const term=(fields.get(r.file)??[]).find(t=>t.offset===r.offset&&t.endOffset===r.endOffset);
  let disposition;
  if(unshipped(r.file))disposition='excluded-unshipped-debug-or-classic-module';
  else if(term)disposition='reviewed-registry-field-with-original-domain-value';
  else if(spans.some(p=>p.id))disposition='reviewed-semantic-source-region';
  else if(spans.length)disposition='presentation-support-source-region';
  else if(r.classification==='empty-or-layout')disposition='retained-empty-or-layout-literal';
  else if(r.classification==='internal')disposition='machine-identified-internal-literal';
  else if(['user-facing-candidate','text-fragment'].includes(r.classification)||r.dynamicAssembly.requiresMigrationReview)disposition='pending-visible-or-composed-text-review';
  else disposition='pending-ambiguous-literal-role-review';
  return{file:r.file,line:r.line,offset:r.offset,endOffset:r.endOffset,rawSha256:hash(r.raw),lexicalClassification:r.classification,disposition,...(term?{semanticIds:[term.semanticId],registry:{category:term.category,id:term.registryId,field:term.field}}:spans.length?{semanticIds:[...new Set(spans.filter(p=>p.id).map(p=>p.id))],patchKinds:[...new Set(spans.map(p=>p.kind))]}:{} )};
 });
 const roles=buildLiteralRoleReview(root,{inventory,manifest,dispositions:{sourceCommit:manifest.sourceCommit,literals}});
 const literalBySite=new Map(literals.map(r=>[r.file+':'+r.offset+':'+r.endOffset,r]));
 for(const role of roles.adjudications){
  const r=literalBySite.get(role.file+':'+role.start+':'+role.end);
  if(!r||r.rawSha256!==role.rawSha256||!r.disposition.startsWith('pending')||sources[r.file].sha256!==role.sourceSha256)throw Error(`Role adjudication guard mismatch: ${role.file}:${role.line}`);
  r.priorDisposition=r.disposition;r.disposition='reviewed-explicit-source-role';
  r.role=role.role;r.roleReason=role.reason;r.roleEvidence=role.evidenceGuard;r.sourceContextGuard=role.sourceContextGuard;
 }
 const pendingVisibleSites=new Set(roles.pendingVisible.map(r=>r.file+':'+r.start+':'+r.end));
 for(const pending of [...roles.pendingVisible,...roles.pendingUnresolved]){
  const r=literalBySite.get(pending.file+':'+pending.start+':'+pending.end);
  if(!r||r.rawSha256!==pending.rawSha256||!r.disposition.startsWith('pending'))throw Error('Pending role guard mismatch');
  r.disposition=pendingVisibleSites.has(pending.file+':'+pending.start+':'+pending.end)?'pending-visible-or-composed-text-review':'pending-ambiguous-literal-role-review';
  r.roleReason=pending.reason;r.nearestCall=pending.nearestCall;
 }
 const helpMap=new Map(help.documents.map(d=>[d.file,d])),documents=[];
 for(const doc of inventory.documents)for(const line of doc.lines){
  const official=helpMap.get(doc.file),segment=official?.segments.find(s=>line.line-1>=s.firstLine&&line.line-1<s.firstLine+s.lines.length);
  if(official&&!segment)throw Error(`Unaccounted official help line ${doc.file}:${line.line}`);
  const disposition=unshipped(doc.file)?'excluded-unshipped-debug-or-classic-module':official?segment.kind==='blank'?'retained-help-blank-line':'reviewed-official-help-paragraph':'support-document-outside-game-ui';
  documents.push({file:doc.file,line:line.line,offset:line.offset,endOffset:line.endOffset,rawSha256:hash(line.raw),disposition,...(segment?.id?{semanticId:segment.id}:{} )});
 }
 const dynamicSources=inventory.dynamicSources.map(r=>({file:r.file,line:r.line,offset:r.offset,symbol:r.symbol,disposition:unshipped(r.file)?'excluded-unshipped-debug-or-classic-module':(patches.get(r.file)??[]).some(p=>p.start<=r.offset&&p.end>r.offset)?'reviewed-dynamic-source-region':'pending-dynamic-producer-review'}));
 const audit=read('unrecognized-files-audit.json'),assetPack=read('../port/dist/core-assets.json');
 if(audit.files.length!==72)throw Error('Unrecognized-file audit coverage changed');
 const packed=new Set(assetPack.files.map(f=>'bin/'+f.path)),auditMap=new Map;
 for(const r of audit.files){const bytes=readFileSync(path.join(root,r.file));if(hash(bytes)!==r.sha256||bytes.length!==r.bytes)throw Error(`Unrecognized audit provenance: ${r.file}`);auditMap.set(r.file,r);}
 const unscannedFiles=inventory.unscannedFiles.map(r=>{const a=auditMap.get(r.file);if(!a)throw Error(`Missing unrecognized audit: ${r.file}`);return{...r,disposition:unshipped(r.file)?'excluded-unshipped-debug-or-classic-module':'audited-original-binary-or-support-file',sha256:a.sha256,bytes:a.bytes,actualFormat:a.actualFile.type,originalProductionScope:a.productionAssetInclusion.scope,browserRawConsoleAssetPacked:packed.has(r.file),textAudit:a.localizationDisposition};});
 return{schema:1,sourceCommit:manifest.sourceCommit,fullGameLocalizationComplete:false,method:'All original lexical candidates are accounted by pinned source offsets; discovery classifications are hints, not translated IDs. Source-region, registry-field, document and dynamic-producer dispositions are independent.',inventorySha256:hash(inventoryBytes),sources,literalRoleReview:roles,binaryAudit:{sha256:hash(readFileSync(path.join(here,'unrecognized-files-audit.json'))),summary:audit.summary,currentBrowserPackedUnrecognizedFiles:unscannedFiles.filter(r=>r.browserRawConsoleAssetPacked).length,originalGraphicsPreservedOutsideBrowserRawConsoleScope:true},counts:{literalCandidates:literals.length,literalDispositions:count(literals),documentNonemptyLines:documents.length,documentDispositions:count(documents),dynamicProducerCandidates:dynamicSources.length,dynamicDispositions:count(dynamicSources),unscannedFiles:unscannedFiles.length,unscannedDispositions:count(unscannedFiles)},reasons,literals,documents,dynamicSources,unscannedFiles};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=buildTextDispositions();writeFileSync(path.join(here,'text-dispositions.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.counts));
}
