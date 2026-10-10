/** Integrate only reviewed original presentation records, with source hashes and original offsets. */
import {buildPascalViewTranslations} from './pascal-view-translations.mjs';
import {pascalUses} from './audit-pascal-uses.mjs';
export function addPresentationUnits({file,patches},fileUnits){
 for(const [f,units]of Object.entries(fileUnits)){
  const source=file(f),u=source.indexOf('uses ',source.indexOf('implementation'));
  if(u<0)throw Error(`No implementation uses: ${f}`);
  const existing=[source.slice(u,source.indexOf(';',u)+1),...patches.filter(p=>p.file===f).map(p=>p.replacement)].join('\n');
  const declared=pascalUses(source),alreadyImported=new Set([...declared.interface,...declared.implementation].map(row=>row.name));
  const missing=units.filter(unit=>!alreadyImported.has(unit.toLowerCase())&&!new RegExp(`\\b${unit}\\b`,'i').test(existing));
  if(missing.length){
   const enclosing=patches.find(p=>p.file===f&&p.start<=u+5&&p.end>u+5&&/\buses\s/i.test(p.replacement));
   if(enclosing)enclosing.replacement=enclosing.replacement.replace(/\buses\s/i,m=>m+missing.join(', ')+', ');
   else patches.push({file:f,start:u+5,end:u+5,original:'',replacement:missing.join(', ')+', ',id:null,kind:'bridge-support'});
  }
 }
}
export function curateViewSites({file,exact,catalog,patches},sourceRoot){
 const result=buildPascalViewTranslations(sourceRoot,{manifest:{patches}}),fileUnits={};
 for(const r of result.records){
  file(r.file);catalog(r.id,r.english,r.japanese,r.parameters??{});
  for(const term of r.additionalCatalogTerms??[])catalog(term.id,term.english,term.japanese,term.parameters??{});
  patches.push({file:r.file,start:r.start,end:r.end,original:r.original,replacement:r.replacement,id:r.id,kind:'semantic-view'});
  fileUnits[r.file]=['drlsemantictext'];
 }
 for(const term of result.constantTerms??[])catalog(term.id,term.english,term.japanese,term.parameters??{});
 const helperFiles={DRLViewAssemblyTier:'src/drlassemblyview.pas',DRLViewBadgeTier:'src/dfhof.pas'};
 for(const helper of result.constantResolvers??[]){
  const f=helperFiles[helper.name];if(!f)throw Error(`Unreviewed view helper: ${helper.name}`);
  const source=file(f),u=source.indexOf('uses ',source.indexOf('implementation')),at=source.indexOf(';',u)+1;
  if(u<0||at<=0||source.includes(`function ${helper.name}(`))throw Error(`View helper injection guard failed: ${f}`);
  const newline=source.includes('\r\n')?'\r\n':'\n';
  patches.push({file:f,start:at,end:at,original:'',replacement:newline+newline+helper.implementation.replaceAll('\n',newline)+newline,id:null,kind:'indexed-view-resolver'});
  fileUnits[f]=[...new Set([...(fileUnits[f]??[]),'drlsemantictext'])];
 }
 for(const r of result.registryRecords??[]){
  file(r.file);patches.push({file:r.file,start:r.start,end:r.end,original:r.original,replacement:r.replacement,id:null,kind:'registry-view'});
  fileUnits[r.file]=['drlsemantictext','drlsemanticregistry'];
 }
 addPresentationUnits({file,patches},fileUnits);
 return result;
}
