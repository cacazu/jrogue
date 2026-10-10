/** Source-only fixture preparation. Never compiles or starts a game/browser.
 * It consumes the exact frozen fixture export without executing its Node oracle.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanSource} from '../port/tools/inventory-texts.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
const read=f=>readFileSync(path.join(here,f),'utf8');
function once(text,from,to){const n=text.indexOf(from);if(n<0||text.indexOf(from,n+1)>=0)throw Error('Native fixture source guard changed: '+from);return text.slice(0,n)+to+text.slice(n+from.length);}
const frozen=JSON.parse(read('verification.json'));
for(const f of ['drlsemantictext.pas','drlsemanticfeelings.pas','drlsemanticitemnames.pas','drlsemantichistory.pas']){
 if(hash(readFileSync(path.join(here,f)))!==frozen.files[f]?.sha256)throw Error('Frozen native unit changed: '+f);
 if(readFileSync(path.join(here,f)).compare(readFileSync(path.join(here,'overlay/src',f)))!==0)throw Error('Generated overlay differs from frozen native unit: '+f);
}
const exporter=read('feeling-sidecar-test.mjs');
const opening='export const nativePascalHarness = String.raw`',closing='`;\n\nconst emitIndex = process.argv.indexOf';
const start=exporter.indexOf(opening),finish=exporter.indexOf(closing,start);
if(start<0||finish<0||exporter.indexOf(opening,start+1)>=0)throw Error('Feeling fixture export guard changed');
let feeling=exporter.slice(start+opening.length,finish);
if(feeling.includes('`')||feeling.includes('${'))throw Error('Unexpected interpolated/raw fixture content');
feeling=once(feeling,'uses Classes, SysUtils, drlsemantictext, drlsemanticfeelings;','uses fpwidestring, Classes, SysUtils, drlsemantictext, drlsemanticfeelings;');
feeling=once(feeling,'var Filename, Guard, Saved: AnsiString; Stream: TFileStream;','var Checks: Integer = 0; Filename, Guard, Saved: AnsiString; Stream: TFileStream;');
feeling=once(feeling,"begin if not Value then raise Exception.Create('FAIL: ' + LabelText); end;","begin if not Value then raise Exception.Create('FAIL: ' + LabelText); Inc(Checks); end;");
feeling=once(feeling,"begin\n  Check(ParamCount = 1, 'pass one temporary JSON filename'); Filename := ParamStr(1);","begin\n  SetMultiByteConversionCodePage(CP_UTF8);\n  Check(ParamCount = 1, 'pass one temporary JSON filename'); Filename := ParamStr(1);\n  Check(not FileExists(Filename), 'refuse an existing nonisolated file');");
feeling=once(feeling,"  Check(DRLRepeatSemanticFeeling(Guard) = B('静かだ。 3体の影。'), 'resume repeat');","  Check(DRLRepeatSemanticFeeling(Guard) = B('静かだ。 3体の影。'), 'resume repeat');\n  WriteRaw(' ' + #9 + #13 + #10 + Saved + #10 + #13 + #9 + ' ');\n  Check(DRLLoadSemanticFeelings(Filename, Guard), 'valid leading/trailing JSON whitespace');\n  WriteRaw(Saved);");
feeling=once(feeling,"  WriteLn('PASS: actual Pascal feeling sidecar persistence, guards, typed parameters, strict parser, UTF8 and fallback');","  WriteLn('PASS: actual Pascal feeling sidecar persistence, guards, typed parameters, parser rejection fixtures, UTF8 and fallback');\n  WriteLn('Native feeling checks: ', Checks);");
let semantic=read('semantic-probe.pas').replaceAll('\r\n','\n');
semantic=once(semantic,'{$mode objfpc}{$H+}','{$mode objfpc}{$H+}{$codepage utf8}');
semantic=once(semantic,'uses SysUtils, drlsemantictext;','uses fpwidestring, SysUtils, drlsemantictext;');
semantic=once(semantic,'var Checks: Integer = 0;','var Checks: Integer = 0;\nfunction B(const Value: RawByteString): AnsiString;\nbegin SetLength(Result, Length(Value));\n  if Length(Value) > 0 then Move(Value[1], Result[1], Length(Value)); end;');
semantic=once(semantic,"begin\n  Check(DRLText('test.id','{RWarning} {$input_ok} {^3}')","begin\n  SetMultiByteConversionCodePage(CP_UTF8);\n  Check(DRLText('test.id','{RWarning} {$input_ok} {^3}')");
semantic=once(semantic,"  DRLSemanticTextResolver := nil;\n  Writeln('Semantic Pascal checks: ',Checks);",`  Check(DRLEnglishText('test.utf8','{{name}}',[DRLStringParam('name',B('日本語'))]),B('日本語'));
  if Length(DRLEnglishText('test.utf8','{{name}}',[DRLStringParam('name',B('日本語'))])) <> 9 then
    raise Exception.Create('UTF8 byte length mismatch');
  Inc(Checks);
  DRLSemanticTextResolver := nil;
  Check(DRLText('test.utf8','{{name}}',[DRLStringParam('name',B('漢字 {!raw} {{opaque}}'))]),B('漢字 {!raw} {{opaque}}'));
  Check(DRLEnglishText('test.extreme','{{number}}',[DRLIntegerParam('number',Low(Int64))]),'-9223372036854775808');
  Check(DRLEnglishText('test.extreme','{{number}}',[DRLIntegerParam('number',High(Int64))]),'9223372036854775807');
  Writeln('Semantic Pascal checks: ',Checks);`);
const files=[['native-semantic-probe.pas',semantic],['native-feeling-probe.pas',feeling],['native-item-name-probe.pas',read('native-item-name-probe.pas')],['native-history-probe.pas',read('native-history-probe.pas')],['native-json-contract-probe.pas',read('native-json-contract-probe.pas')]];
for(const[file,source]of files){
 if(scanSource(source,'pascal').diagnostics.length)throw Error('Native fixture lexical diagnostics: '+file);
 if(!source.includes('SetMultiByteConversionCodePage(CP_UTF8)')||!source.includes('uses fpwidestring'))throw Error('Missing actual runtime UTF8 setup: '+file);
 if(file==='native-feeling-probe.pas'&&!source.includes('DRLSaveSemanticFeelings(Filename)'))throw Error('Fixture does not call actual Pascal save');
 writeFileSync(path.join(here,file),source.endsWith('\n')?source:source+'\n');
}
const result={schema:1,nativeCompilationOrExecutionPerformed:false,sourceCommit:frozen.sourceCommit,
 frozenUnits:Object.fromEntries(['drlsemantictext.pas','drlsemanticfeelings.pas','drlsemanticitemnames.pas','drlsemantichistory.pas'].map(f=>[f,frozen.files[f].sha256])),
 files:Object.fromEntries(files.map(([f])=>[f,{sha256:hash(readFileSync(path.join(here,f)))}])),
 fixtureExporterSha256:hash(readFileSync(path.join(here,'feeling-sidecar-test.mjs'))),
 coverage:'Actual Pascal semantic/feeling/item units; real generated item registry/transition whitelist. Fixture resolver is an explicit tiny locale, not a replacement sidecar implementation. History fixture is independently prepared.'};
writeFileSync(path.join(here,'native-probes-preparation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
