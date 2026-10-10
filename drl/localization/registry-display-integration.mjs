/** Merge reviewed display-only registry seams without editing original domain getters. */
import {buildRegistryDisplaySites} from './registry-display-sites.mjs';
export function curateRegistryDisplaySites({file,catalog,patches},sourceRoot){
 const result=buildRegistryDisplaySites(sourceRoot,{manifest:{patches}});
 for(const term of result.catalogTerms??[])catalog(term.id,term.english,term.japanese,term.parameters??{});
 for(const r of result.records){
  file(r.file);if(r.id)catalog(r.id,r.english,r.japanese,r.parameters??{});
  patches.push({file:r.file,start:r.start,end:r.end,original:r.original,replacement:r.replacement,id:r.id??null,kind:r.kind});
 }
 for(const r of result.skippedOwned.filter(r=>r.kind==='registry-display-perk'&&r.file==='src/drlmoreview.pas'&&[380,392].includes(r.line))){
  const patch=patches.find(p=>p.file===r.file&&p.start<=r.start&&p.end>=r.end);
  const needle="DRLStringParam('description', Desc)";
  if(!patch||!patch.replacement.includes(needle)||patch.replacement.indexOf(needle)!==patch.replacement.lastIndexOf(needle))throw Error(`Perk description handoff guard: ${r.file}:${r.line}`);
  patch.replacement=patch.replacement.replace(needle,`DRLStringParam('description', ${r.replacement})`);
  result.requiredUnits[r.file]=[...new Set([...(result.requiredUnits[r.file]??[]),'drlsemanticperks'])];
  r.disposition='integrated-owned-typed-description-binding';
 }
 return result;
}
