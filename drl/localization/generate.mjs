import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyRegistrySources} from './registry-terms.mjs';
import {buildSemanticFeelingCatalog} from './semantic-feeling-sites.mjs';
import {registryDisplayPresentationUnit,registryDisplayTermPresentationUnit} from './registry-display-sites.mjs';
import {buildItemNameCatalog} from './item-name-catalog.mjs';
import {buildSemanticHistoryCatalog} from './history-presentation.mjs';
import {helpTopicTitleDeclaration,helpTopicTitleImplementation} from './locale-refresh-sites.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export function applyPatches(bytes,locked,patches){
  if(sha256(bytes)!==locked.sha256||bytes.length!==locked.bytes)throw Error('Source provenance mismatch');
  const source=bytes.toString('utf8');
  if(!Buffer.from(source,'utf8').equals(bytes))throw Error('Source is not lossless UTF-8');
  const ordered=patches.toSorted((a,b)=>a.start-b.start||a.end-b.end),seen=new Set();let end=0;
  for(const p of ordered){
    const identity=JSON.stringify([p.start,p.end,p.original,p.replacement]);
    if(seen.has(identity))throw Error('Overlapping or duplicate localization patch');seen.add(identity);
    if(!Number.isSafeInteger(p.start)||!Number.isSafeInteger(p.end)||p.start<end||p.end<p.start||p.end>source.length)throw Error('Overlapping or out-of-bounds localization patch');
    if(source.slice(p.start,p.end)!==p.original)throw Error('Localization source-site mismatch');
    end=p.end;
  }
  let result=source;
  for(const p of ordered.toReversed())result=result.slice(0,p.start)+p.replacement+result.slice(p.end);
  return result;
}
export function verifyCatalogs(manifest,english,japanese){
 if(sha256(english)!==manifest.catalogs.englishSha256||sha256(japanese)!==manifest.catalogs.japaneseSha256)throw Error('Catalog provenance mismatch');
 const en=JSON.parse(english),ja=JSON.parse(japanese),keys=Object.keys(en).sort();
 if(JSON.stringify(keys)!==JSON.stringify(Object.keys(ja).sort()))throw Error('Locale IDs differ');
 if(JSON.stringify(keys)!==JSON.stringify(Object.keys(manifest.parameters).sort()))throw Error('Catalog contracts differ');
 for(const id of keys){
   const expected=Object.keys(manifest.parameters[id]).sort();
   for(const text of [en[id],ja[id]]){
     if(typeof text!=='string'||text.length>32768)throw Error('Invalid localized value');
     const matches=Array.from(text.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g),m=>m[1]);
     if(JSON.stringify([...new Set(matches)].sort())!==JSON.stringify(expected))throw Error(`Placeholder mismatch: ${id}`);
     if(text.replace(/\{\{[a-z][a-z0-9_]*\}\}/g,'').includes('{{'))throw Error(`Malformed placeholder: ${id}`);
   }
   const controls=s=>Array.from(s.matchAll(/\{\$[^{}]+\}/g),m=>m[0]).sort();
   if(JSON.stringify(controls(en[id]))!==JSON.stringify(controls(ja[id])))throw Error(`Input-control markup mismatch: ${id}`);
 }
 return {en,ja};
}
function pascalString(s){return s.split(/([\x00-\x1f])/).filter(Boolean).map(p=>p.length===1&&p.charCodeAt(0)<32?`#${p.charCodeAt(0)}`:`'${p.replaceAll("'","''")}'`).join('')||"''";}
export function buildSemanticHelpUnit(help){
 const lines=[],blocks=[],ranges=[];
 for(const doc of help.documents){
   const firstLine=lines.length,firstBlock=blocks.length;lines.push(...doc.lines);
   for(const s of doc.segments)if(s.kind==='blank')for(const line of s.lines)blocks.push({id:'',english:line});else blocks.push({id:s.id,english:s.lines.join('\n')});
   ranges.push({topic:doc.topic,firstLine,lineCount:doc.lines.length,firstBlock,blockCount:blocks.length-firstBlock});
 }
 return `{ Generated reviewed DRL help presentation mapping, GPL-2.0.\n  Original source line sequence is retained for exact runtime identity checking. }\nunit drlsemantichelp;\n{$mode objfpc}{$H+}\ninterface\nfunction DRLHelpTopicIndex(const aID: AnsiString): Integer;\nfunction DRLHelpSourceLineCount(aTopic: Integer): Integer;\nfunction DRLHelpSourceLine(aTopic, aLine: Integer): AnsiString;\nfunction DRLHelpParagraphCount(aTopic: Integer): Integer;\nfunction DRLHelpParagraphText(aTopic, aParagraph: Integer): AnsiString;\n${helpTopicTitleDeclaration}\nimplementation\nuses SysUtils, drlsemantictext;\ntype THelpDocumentRange = record\n  ID: AnsiString;\n  FirstLine, LineCount, FirstBlock, BlockCount: Integer;\nend;\nconst CHelpDocuments: array[0..${ranges.length-1}] of THelpDocumentRange = (\n${ranges.map(r=>`  (ID: ${pascalString(r.topic)}; FirstLine: ${r.firstLine}; LineCount: ${r.lineCount}; FirstBlock: ${r.firstBlock}; BlockCount: ${r.blockCount})`).join(',\n')}\n);\nconst CHelpSourceLines: array[0..${lines.length-1}] of AnsiString = (\n${lines.map(l=>'  '+pascalString(l)).join(',\n')}\n);\nconst CHelpBlocks: array[0..${blocks.length-1}] of record ID, English: AnsiString; end = (\n${blocks.map(b=>`  (ID: ${pascalString(b.id)}; English: ${pascalString(b.english)})`).join(',\n')}\n);\nfunction DRLHelpTopicIndex(const aID: AnsiString): Integer;\nvar i: Integer;\nbegin\n  for i := 0 to High(CHelpDocuments) do\n    if CHelpDocuments[i].ID = aID then Exit(i);\n  Exit(-1);\nend;\nfunction DRLHelpSourceLineCount(aTopic: Integer): Integer;\nbegin\n  if (aTopic < 0) or (aTopic > High(CHelpDocuments)) then Exit(0);\n  Exit(CHelpDocuments[aTopic].LineCount);\nend;\nfunction DRLHelpSourceLine(aTopic, aLine: Integer): AnsiString;\nbegin\n  if (aTopic < 0) or (aTopic > High(CHelpDocuments)) then\n    raise EArgumentException.Create('Unknown DRL help topic');\n  if (aLine < 0) or (aLine >= CHelpDocuments[aTopic].LineCount) then\n    raise EArgumentException.Create('DRL help source line out of bounds');\n  Exit(CHelpSourceLines[CHelpDocuments[aTopic].FirstLine + aLine]);\nend;\nfunction DRLHelpParagraphCount(aTopic: Integer): Integer;\nbegin\n  if (aTopic < 0) or (aTopic > High(CHelpDocuments)) then Exit(0);\n  Exit(CHelpDocuments[aTopic].BlockCount);\nend;\nfunction DRLHelpParagraphText(aTopic, aParagraph: Integer): AnsiString;\nvar iBlock: Integer;\nbegin\n  if (aTopic < 0) or (aTopic > High(CHelpDocuments)) then\n    raise EArgumentException.Create('Unknown DRL help topic');\n  if (aParagraph < 0) or (aParagraph >= CHelpDocuments[aTopic].BlockCount) then\n    raise EArgumentException.Create('DRL help paragraph out of bounds');\n  iBlock := CHelpDocuments[aTopic].FirstBlock + aParagraph;\n  if CHelpBlocks[iBlock].ID = '' then Exit(CHelpBlocks[iBlock].English);\n  Exit(DRLText(CHelpBlocks[iBlock].ID, CHelpBlocks[iBlock].English));\nend;\n${helpTopicTitleImplementation}\nend.\n`;
}
export function buildSemanticRegistryUnit(registry){
 const entries=registry.metadata.flatMap(record=>Object.entries(record.fields).map(([field,term])=>({category:record.category,registryId:record.registryId,scope:record.scope,field,...term})));
 return `{ Generated reviewed DRL registry presentation mapping, GPL-2.0.\n  Gameplay English names and properties remain unchanged. Unknown or overridden fields fall back. }\nunit drlsemanticregistry;\n{$mode objfpc}{$H+}\ninterface\nfunction DRLRegistryText(const aCategory, aRegistryID, aScope, aField, aEnglish: AnsiString): AnsiString;\nimplementation\nuses drlsemantictext;\ntype TRegistryPresentationField = record\n  Category, RegistryID, Scope, Field, ID, English: AnsiString;\nend;\nconst CRegistryFields: array[0..${entries.length-1}] of TRegistryPresentationField = (\n${entries.map(e=>`  (Category: ${pascalString(e.category)}; RegistryID: ${pascalString(e.registryId)}; Scope: ${pascalString(e.scope)}; Field: ${pascalString(e.field)}; ID: ${pascalString(e.semanticId)}; English: ${pascalString(e.english)})`).join(',\n')}\n);\nfunction DRLRegistryText(const aCategory, aRegistryID, aScope, aField, aEnglish: AnsiString): AnsiString;\nvar i: Integer;\nbegin\n  for i := 0 to High(CRegistryFields) do\n    with CRegistryFields[i] do\n      if (Category = aCategory) and (RegistryID = aRegistryID) and\n         (Scope = aScope) and (Field = aField) then\n      begin\n        if English <> aEnglish then Exit(aEnglish);\n        Exit(DRLText(ID, aEnglish));\n      end;\n  Exit(aEnglish);\nend;\nend.\n`;
}
export function generateOverlay({sourceRoot=path.resolve(here,'../upstream/drl'),outputRoot=path.join(here,'overlay')}={}){
 const manifest=JSON.parse(readFileSync(path.join(here,'manifest.json'),'utf8'));
 const {en}=verifyCatalogs(manifest,readFileSync(path.join(here,'en.json')),readFileSync(path.join(here,'ja.json')));
 const src=realpathSync(sourceRoot),out=path.resolve(outputRoot);
 // Refuse to overwrite pristine sources, an ancestor of sources, or any existing symlinked path.
 let existing=out;while(!existsSync(existing))existing=path.dirname(existing);
 const resolvedExisting=realpathSync(existing);
 if(resolvedExisting.toLowerCase()!==existing.toLowerCase())throw Error('Output traverses a symlink');
 const relation=path.relative(src,out),reverse=path.relative(out,src);
 if(!relation||!relation.startsWith('..')||!reverse||!reverse.startsWith('..'))throw Error('Output must be outside upstream and its ancestors');
 const results=[];
 const helpBytes=readFileSync(path.join(here,'help-catalog.json'));
 if(sha256(helpBytes)!==manifest.catalogs.helpCatalogSha256)throw Error('Help catalog provenance mismatch');
 const help=JSON.parse(helpBytes);
 for(const doc of help.documents){
   const bytes=readFileSync(path.join(src,doc.file));
   if(sha256(bytes)!==doc.sha256||bytes.length!==doc.bytes)throw Error(`Help provenance mismatch: ${doc.file}`);
 }
 const registryBytes=readFileSync(path.join(here,'registration-term-catalog.json'));
 if(sha256(registryBytes)!==manifest.catalogs.registryCatalogSha256)throw Error('Registry catalog provenance mismatch');
 const registry=JSON.parse(registryBytes);verifyRegistrySources(src);
 const feelingUnit=readFileSync(path.join(here,'drlsemanticfeelings.pas'));
 const feelingCatalog=buildSemanticFeelingCatalog(manifest,en,registry,JSON.parse(readFileSync(path.join(here,'gameplay-sites.json'),'utf8')),src,f=>readFileSync(path.join(src,f),'utf8'));
 const itemAspectBytes=readFileSync(path.join(here,'item-name-aspects.json'));
 if(sha256(itemAspectBytes)!==manifest.catalogs.itemNameAspectSha256)throw Error('Item name aspect provenance mismatch');
 const itemCatalog=buildItemNameCatalog(JSON.parse(itemAspectBytes),registry);
 const historyBytes=readFileSync(path.join(here,'history-sites.json'));
 if(sha256(historyBytes)!==manifest.catalogs.historySitesSha256)throw Error('History catalog provenance mismatch');
 const historyCatalog=buildSemanticHistoryCatalog(JSON.parse(historyBytes));
 for(const [file,lock]of Object.entries(manifest.sources)){
   if(file.includes('..')||path.isAbsolute(file)||!(file.startsWith('src/')&&file.endsWith('.pas')||file.startsWith('bin/data/core/')&&file.endsWith('.lua')||file.startsWith('bin/data/drl/')&&file.endsWith('.lua')))throw Error('Unsafe manifest path');
   const bytes=readFileSync(path.join(src,file));
   const transformed=applyPatches(bytes,lock,manifest.patches.filter(p=>p.file===file));
   results.push({file,transformed,sourceSha256:lock.sha256,outputSha256:sha256(Buffer.from(transformed))});
 }
 // Validate everything before writing any output.
 for(const r of results){const target=path.join(out,r.file);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,r.transformed);}
 const unit=readFileSync(path.join(here,'drlsemantictext.pas'));
 mkdirSync(path.join(out,'src'),{recursive:true});writeFileSync(path.join(out,'src/drlsemantictext.pas'),unit);
 const helpUnit=buildSemanticHelpUnit(help);writeFileSync(path.join(out,'src/drlsemantichelp.pas'),helpUnit);
 const registryUnit=buildSemanticRegistryUnit(registry);writeFileSync(path.join(out,'src/drlsemanticregistry.pas'),registryUnit);
 writeFileSync(path.join(out,'src/drlsemanticfeelings.pas'),feelingUnit);
 writeFileSync(path.join(out,'src/drlsemanticfeelcatalog.pas'),feelingCatalog.unit);
 writeFileSync(path.join(out,registryDisplayPresentationUnit.file),registryDisplayPresentationUnit.implementation);
 writeFileSync(path.join(out,registryDisplayTermPresentationUnit.file),registryDisplayTermPresentationUnit.implementation);
 writeFileSync(path.join(out,'src/drlsemanticitemnames.pas'),readFileSync(path.join(here,'drlsemanticitemnames.pas')));
 writeFileSync(path.join(out,'src/drlsemanticitemcatalog.pas'),itemCatalog.unit);
 writeFileSync(path.join(out,'src/drlsemantichistory.pas'),readFileSync(path.join(here,'drlsemantichistory.pas')));
 writeFileSync(path.join(out,'src/drlsemantichistorycatalog.pas'),historyCatalog.unit);
 const report={schema:1,sourceCommit:manifest.sourceCommit,fullGameLocalizationComplete:false,catalogIds:Object.keys(manifest.parameters).length,sourceFiles:results.length,sourceSites:manifest.patches.filter(p=>p.id!==null).length,patches:manifest.patches.length,files:results.map(({transformed,...r})=>r),semanticUnitSha256:sha256(unit),help:{documents:help.documents.length,paragraphs:help.entries.length,semanticUnitSha256:sha256(Buffer.from(helpUnit)),copyrightNamesUrlsPreserved:true},registry:{reviewedFields:Object.keys(registry.englishCatalog).length,registryEntries:registry.metadata.length,pendingFields:registry.pending.length,semanticUnitSha256:sha256(Buffer.from(registryUnit)),domainNamesUnchanged:true,runtimeAdapterConnected:false},grammar:'native-vtig-markup+double-brace-named-parameters',browserRustResolverConnected:false};
 report.feelings={reviewedReplayIds:feelingCatalog.ids.length,validatorUnitSha256:sha256(Buffer.from(feelingCatalog.unit)),sidecarUnitSha256:sha256(feelingUnit),originalEnglishNativeSaveFieldsPreserved:true,nativeFullUnitCompiled:false,parentSaveLoadWiringRequired:true};
 report.itemNames={baseNames:itemCatalog.baseNames,whitelistRules:itemCatalog.whitelistRules,semanticIds:itemCatalog.semanticIds,sidecarUnitSha256:sha256(readFileSync(path.join(here,'drlsemanticitemnames.pas'))),catalogUnitSha256:sha256(Buffer.from(itemCatalog.unit)),originalEnglishNativeSaveFieldsPreserved:true,nativeFullUnitCompiled:false,parentSaveLoadWiringRequired:true};
 report.history={reviewedHistoryIds:historyCatalog.ids.length,registryParameterProjections:historyCatalog.registryProjections,sidecarUnitSha256:sha256(readFileSync(path.join(here,'drlsemantichistory.pas'))),catalogUnitSha256:sha256(Buffer.from(historyCatalog.unit)),originalEnglishNativeSaveFieldsPreserved:true,nativeFullUnitCompiled:false,parentSaveLoadWiringRequired:true};
 mkdirSync(out,{recursive:true});writeFileSync(path.join(out,'generation.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);let sourceRoot,outputRoot;
 for(let i=0;i<args.length;i++){if(args[i]==='--source')sourceRoot=args[++i];else if(args[i]==='--out')outputRoot=args[++i];else throw Error(`Unknown argument ${args[i]}`);}
 console.log(JSON.stringify(generateOverlay({sourceRoot,outputRoot}),null,2));
}
