// Source analysis only: inspect reviewed EN/JA token contracts without WASM,
// original engine, compilation, browser, or runtime tests.
import {readFile,writeFile} from 'node:fs/promises';
import {printfSpecifiers,markupTokens} from '../../localization-review-work/precision-policy.mjs';
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const english=await json('../../localization-kernel-work/catalogs/en.json');
const supplement=await json('../../localization-review-work/final-review/ja-supplement-complete.json');
const policies=await json('../../localization-review-work/final-review/format-policy.json');
const provenance=await json('../../localization-review-work/final-review/supplement-provenance-complete.json');
const tags=new Map(provenance.flatMap(row=>row.current_ids.map(id=>[id,row.tag])));
function rustPrintf(text,tag='tformat'){
 const tokens=[];
 for(let index=0;index<text.length;){
  if(text[index]!=='%'){index++;continue;}
  const start=index++;
  if(text[index]==='%'){tokens.push(text.slice(start,++index));continue;}
  while(index<text.length&&(/[0-9]/.test(text[index])||'-+ #0.*$'.includes(text[index])))index++;
  if(index<text.length&&'cdiouxXeEfgGqsaA'.includes(text[index])){
   const token=text.slice(start,++index);
   if(!(tag!=='tformat'&&start>0&&/[0-9]/.test(text[start-1])&&token.includes(' ')))tokens.push(token);
  }
 }
 return tokens;
}
function rustMarkup(text){
 const tokens=[];let offset=0;
 while(offset<text.length){
  const start=text.indexOf('#',offset);if(start<0)break;
  const end=text.indexOf('#',start+1);if(end<0)break;
  const name=text.slice(start+1,end);
  if(name.length&&(/^[A-Za-z_]+$/.test(name)||/^[0-9a-fA-F]{6}$/.test(name)||name.startsWith('{')&&name.endsWith('}'))){tokens.push(text.slice(start,end+1));offset=end+1;}
  else offset=start+1;
 }
 return tokens;
}
const mismatches=[],alignedMismatches=[];
for(const [id,target] of Object.entries(supplement)){
 if(policies.policies[id])continue;
 const source=english[id],tag=tags.get(id);
 const sourcePrintf=rustPrintf(source),targetPrintf=rustPrintf(target),sourceMarkup=rustMarkup(source),targetMarkup=rustMarkup(target);
 if(JSON.stringify(sourcePrintf)!==JSON.stringify(targetPrintf)||JSON.stringify(sourceMarkup)!==JSON.stringify(targetMarkup)){
  mismatches.push({id,source,tag,target,rust:{sourcePrintf,targetPrintf,sourceMarkup,targetMarkup},reviewed:{sourcePrintf:printfSpecifiers(source,tag),targetPrintf:printfSpecifiers(target,tag),sourceMarkup:markupTokens(source),targetMarkup:markupTokens(target)}});
 }
 if(JSON.stringify(rustPrintf(source,tag))!==JSON.stringify(rustPrintf(target,tag))||JSON.stringify(sourceMarkup)!==JSON.stringify(targetMarkup))alignedMismatches.push(id);
}
const report={scope:'source_only_scanner_comparison',reviewed_supplement_ids:Object.keys(supplement).length,mismatch_count:mismatches.length,aligned_mismatch_count:alignedMismatches.length,aligned_mismatch_ids:alignedMismatches,mismatches};
await writeFile(new URL('../source-contract-diagnosis.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
await writeFile(new URL('percentage-prose-fixture.json',import.meta.url),JSON.stringify(mismatches.map(({id,source,tag,target})=>({id,source,tag,target})),null,2)+'\n');
console.log(JSON.stringify(report).replace(/[^\x00-\x7f]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0')));
