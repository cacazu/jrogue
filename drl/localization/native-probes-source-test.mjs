/** Read-only source/dependency review; does not execute native Pascal or a game. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {scanSource} from '../port/tools/inventory-texts.mjs';
const root=new URL('../',import.meta.url),here=new URL('./',import.meta.url);
const read=f=>readFileSync(new URL(f,here),'utf8');
const hash=x=>createHash('sha256').update(x).digest('hex');
const prepared=JSON.parse(read('native-probes-preparation.json'));
for(const[file,lock]of Object.entries(prepared.files)){
 const source=read(file);assert.equal(hash(readFileSync(new URL(file,here))),lock.sha256);
 assert.equal(scanSource(source,'pascal').diagnostics.length,0,file);
 assert.match(source,/uses fpwidestring/i);assert.ok(source.includes('SetMultiByteConversionCodePage(CP_UTF8)'));
}
for(const[unit,sha]of Object.entries(prepared.frozenUnits)){
 assert.equal(hash(readFileSync(new URL(unit,here))),sha);
 assert.equal(hash(readFileSync(new URL('overlay/src/'+unit,here))),sha);
}
for(const[pkg,ppu]of [['rtl','fpwidestring.ppu'],['rtl','unicodedata.ppu'],['rtl','charset.ppu'],['fcl-json','fpjson.ppu'],['fcl-json','jsonscanner.ppu'],['fcl-json','jsonparser.ppu']])assert.ok(existsSync(new URL(`toolchain/fpc-win64-snapshot/units/x86_64-win64/${pkg}/${ppu}`,root)),`${pkg}/${ppu}`);
const item=read('native-item-name-probe.pas');
for(const name of ['drlsemanticitemnames','drlsemanticitemcatalog','drlsemanticregistry'])assert.ok(item.includes(name));
for(const call of ['DRLRememberItemNameAspect','DRLItemNamePresentation','DRLSaveSemanticItemNames(Filename)','DRLLoadSemanticItemNames(Filename)'])assert.ok(item.includes(call));
assert.ok(item.includes('not FileExists(Filename)'));assert.ok(!item.includes("DRLSaveSemanticItemNames('/user/"));
const canonicalJa=JSON.parse(read('ja.json'));
for(const match of item.matchAll(/(?:if|else if) ID = '([^']+)' then Template := B\('((?:[^']|'')*)'\)/g))assert.equal(match[2].replaceAll("''","'"),canonicalJa[match[1]],match[1]);
const history=read('native-history-probe.pas');assert.ok(history.includes('drlsemantichistorycatalog'));assert.ok(history.includes('DRLSaveSemanticHistory(CandidatePath)'));assert.ok(history.includes('FileExists(CandidatePath)'));
const diagnostic=read('native-json-contract-probe.pas');assert.ok(diagnostic.includes('DRLSemanticPreflightJSON(Data)'));assert.ok(diagnostic.includes('for I := 0 to 31'));assert.ok(diagnostic.includes("#92+#39"));
assert.equal(prepared.nativeCompilationOrExecutionPerformed,false);
console.log(JSON.stringify({sourceReviewPassed:true,fixtureFiles:Object.keys(prepared.files).length,frozenUnits:Object.keys(prepared.frozenUnits).length,nativeCompileOrExecution:false,historicalJSONStrictnessDefects:['raw unescaped string controls 20..31','backslash-apostrophe escape'],canonicalLexicalGuardIntegrated:true,nativeConfirmationEvidence:'native-execution-evidence.json',note:'This source review verifies canonical hashes and fixture links. Separate checked evidence records prior parent-run native results and the unchanged historical 13/46 failure witness.'}));
