/** Draw-time projections only: no reconfiguration, constructor replay or simulation calls. */
import {createHash} from 'node:crypto';
export const localeRefreshSourcePins=Object.freeze({"src/drlhelp.pas":{"bytes":2045,"sha256":"c4abf490df6897bd0c5b9f3cdb9c8b4187f12fef658f5da575de00fd28c34531"},"src/drlhelpview.pas":{"bytes":4904,"sha256":"539f8d7e2f147eff684ca3c974429bcebd0ee083b9e944fe797f239fb9eab534"},"src/drlio.pas":{"bytes":49187,"sha256":"a0bb570acb545fad8ff2e2acc178a7005de39cc0b7457a900ef5f4b8b18bdd00"}});
const digest=x=>createHash('sha256').update(x).digest('hex');
const pas=s=>"'"+s.replaceAll("'","''")+"'";
export const helpTopicTitleRequests=Object.freeze([
 ['intro','Introduction'],['start','Getting started'],['gamepad','Gamepad controls'],
 ['keys','Keyboard controls'],['mouse','Mouse controls'],['feedback','Feedback'],
 ['disclaim','Disclaimer'],['credits','Credits'],
].map(([topic,english])=>({topic,id:'help.topic.'+topic,english})));
export const fixedInputSubstitutions=Object.freeze([
 ['keyboard','input_ok','view.input-key.enter','Enter'],
 ['keyboard','input_escape','view.input-key.escape','Escape'],
 ['keyboard','input_uidrop','view.input-key.backspace','Backspace'],
 ['keyboard','input_uialtdrop','view.input-key.shift-backspace','SHIFT+Backspace'],
 ['keyboard','input_uiswap','view.input-key.tab','Tab'],
 ['keyboard','input_left','view.input-key.left','Left'],
 ['keyboard','input_right','view.input-key.right','Right'],
 ['keyboard','input_up','view.input-key.up','Up'],
 ['keyboard','input_down','view.input-key.down','Down'],
 ['keyboard','input_pgup','view.input-key.page-up','PgUp'],
 ['keyboard','input_pgdn','view.input-key.page-down','PgDn'],
 ['keyboard','input_menu','view.input-key.escape','Escape'],
 ['gamepad','input_ok','view.input-button.a','A'],
 ['gamepad','input_escape','view.input-button.b','B'],
 ['gamepad','input_uidrop','view.input-button.y','Y'],
 ['gamepad','input_uialtdrop','view.input-button.right-trigger-y','RTrigger+Y'],
 ['gamepad','input_uiswap','view.input-button.x','X'],
 ['gamepad','input_left','view.input-key.left','Left'],
 ['gamepad','input_right','view.input-key.right','Right'],
 ['gamepad','input_up','view.input-key.up','Up'],
 ['gamepad','input_down','view.input-key.down','Down'],
 ['gamepad','input_pgup','view.input-key.page-up','PgUp'],
 ['gamepad','input_pgdn','view.input-key.page-down','PgDn'],
].map(([mode,input,id,english])=>({mode,input,id,english})));
export const helpTopicTitleDeclaration=
 'function DRLHelpTopicTitle(aTopic: Integer; const aOriginalTitle: AnsiString): AnsiString;';
export const helpTopicTitleImplementation=[
 helpTopicTitleDeclaration,'begin',
 '  if (aTopic < 0) or (aTopic > High(CHelpDocuments)) then Exit(aOriginalTitle);',
 ...helpTopicTitleRequests.map(r=>
 '  if (CHelpDocuments[aTopic].ID = '+pas(r.topic)+') and'+
 '\n     (aOriginalTitle = '+pas(r.english)+') then'+
 '\n    Exit(DRLText('+pas(r.id)+', aOriginalTitle));'),
 '  Exit(aOriginalTitle);','end;'
].join('\n');
export const fixedInputSubstitutionImplementation=[
 'function DRLTryFixedInputSubstitution(aGamepad: Boolean;',
 '  const aInputID: AnsiString; out aText: AnsiString): Boolean;',
 'begin','  Result := False;','  aText := '+pas('')+';',
 ...['gamepad','keyboard'].flatMap((mode,index)=>[
 index===0?'  if aGamepad then':'  else','  begin',
 ...fixedInputSubstitutions.filter(r=>r.mode===mode).map(r=>
 '    if aInputID = '+pas(r.input)+' then begin'+
 '\n      aText := DRLText('+pas(r.id)+', '+pas(r.english)+');'+
 '\n      Exit(True);'+
 '\n    end;'),
 index===0?'  end':'  end;']),
 'end;'
].join('\n');
export const helpEntryPresentationImplementation=[
 'function THelpEntry.PresentationBlockCount: Integer;','begin',
 '  if FSemanticTopic >= 0 then Exit(DRLHelpParagraphCount(FSemanticTopic));',
 '  if FText = nil then Exit(0);','  Exit(FText.Size);','end;','',
 'function THelpEntry.PresentationBlockText(aIndex: Integer): AnsiString;','begin',
 '  if FSemanticTopic >= 0 then Exit(DRLHelpParagraphText(FSemanticTopic, aIndex));',
 '  Exit(FText[aIndex]);','end;','',
 'function THelpEntry.PresentationTitle(const aOriginalTitle: AnsiString): AnsiString;','begin',
 '  Exit(DRLHelpTopicTitle(FSemanticTopic, aOriginalTitle));','end;'
].join('\n');
export function curateLocaleRefreshSites({file,exact,patches,en,contracts}){
 const sources={};
 for(const [f,expected]of Object.entries(localeRefreshSourcePins)){
  const source=file(f),bytes=Buffer.from(source);
  if(bytes.length!==expected.bytes||digest(bytes)!==expected.sha256)
   throw Error('Locale refresh source provenance mismatch: '+f);
  sources[f]={...expected};
 }
 for(const r of [...helpTopicTitleRequests,...fixedInputSubstitutions]){
  if(en[r.id]!==r.english||JSON.stringify(contracts[r.id])!=='{}')
   throw Error('Locale refresh existing catalog contract mismatch: '+r.id);
 }
 const help='src/drlhelp.pas',view='src/drlhelpview.pas',io='src/drlio.pas';
 const addedStart=patches.length;
 exact(help,'uses SysUtils, vutil, vtig;','uses SysUtils, vutil, vtig, drlsemantichelp;');
 exact(help,'  FText  : TIOStringArray;','  FText  : TIOStringArray;\r\n  FSemanticTopic : Integer;');
 exact(help,'  property Text : TIOStringArray read FText;',
  '  function PresentationBlockCount: Integer;\r\n'+
  '  function PresentationBlockText(aIndex: Integer): AnsiString;\r\n'+
  '  function PresentationTitle(const aOriginalTitle: AnsiString): AnsiString;\r\n'+
  '  property Text : TIOStringArray read FText;');
 exact(help,'  FText := nil;','  FText := nil;\r\n  FSemanticTopic := -1;');
 exact(help,'constructor THelp.Create;',
  helpEntryPresentationImplementation.replaceAll('\n','\r\n')+'\r\n\r\nconstructor THelp.Create;');
 exact(help,'var iEntry : THelpEntry;',
  'var iEntry : THelpEntry;\r\n    iTopic, iLine : Integer;\r\n    iMatches : Boolean;');
 exact(help,"iEntry.FID    := ChangeFileExt( aName, '' );",
  "iEntry.FID    := ChangeFileExt( aName, '' );\r\n"+
  '  { Keep exact original help bytes; store provenance, project only at display. }\r\n'+
  '  iTopic := DRLHelpTopicIndex(iEntry.FID);\r\n'+
  '  iMatches := (iTopic >= 0) and\r\n'+
  '    (iEntry.FText.Size = DRLHelpSourceLineCount(iTopic));\r\n'+
  '  if iMatches then\r\n'+
  '    for iLine := 0 to iEntry.FText.Size - 1 do\r\n'+
  '      if iEntry.FText[iLine] <> DRLHelpSourceLine(iTopic, iLine) then\r\n'+
  '        iMatches := False;\r\n'+
  '  if iMatches then iEntry.FSemanticTopic := iTopic;');
 exact(view,'var iText : Ansistring;','var iBlock : Integer;');
 exact(view,"VTIG_BeginWindow( FEntries[FCurrent], 'help_view_read', FSize );",
  "VTIG_BeginWindow( FList[FCurrent].PresentationTitle(FEntries[FCurrent]), 'help_view_read', FSize );");
 exact(view,'  for iText in FList[FCurrent].Text do\r\n    VTIG_Text( iText );',
  '  for iBlock := 0 to FList[FCurrent].PresentationBlockCount - 1 do\r\n'+
  '    VTIG_Text(FList[FCurrent].PresentationBlockText(iBlock));');
 exact(view,"VTIG_Selectable( '      '+FEntries[i] )",
  "VTIG_Selectable( '      '+FList[i].PresentationTitle(FEntries[i]) )");
 const resolve='function TDRLIO.ResolveSub( const aID : Ansistring ) : Ansistring;';
 exact(io,resolve+'\r\nbegin\r\n  if IsGamepad\r\n'+
  "    then Exit( FPadSubMap.Get(aID, '') )\r\n"+
  "    else Exit( FKeySubMap.Get(aID, '') );\r\nend;",
  fixedInputSubstitutionImplementation.replaceAll('\n','\r\n')+'\r\n\r\n'+resolve+
  '\r\nvar iGamepad: Boolean; iText: AnsiString;\r\nbegin\r\n'+
  '  iGamepad := IsGamepad;\r\n'+
  '  if DRLTryFixedInputSubstitution(iGamepad, aID, iText) then Exit(iText);\r\n'+
  "  if iGamepad then Exit(FPadSubMap.Get(aID, ''))\r\n"+
  "    else Exit(FKeySubMap.Get(aID, ''));\r\nend;");
 const inputSourceGuards=fixedInputSubstitutions.map(r=>{
  const map=r.mode==='gamepad'?'FPadSubMap':'FKeySubMap';
  const escape=s=>s.replace(/[.*+?^\x24{}()|[\]\\]/g,'\\$&');
  const pattern=map+'\\['+escape(pas(r.input))+
   '\\]\\s*:=\\s*'+escape(pas(r.english))+';';
  const matches=[...file(io).matchAll(new RegExp(pattern,'g'))];
  if(matches.length!==1)throw Error('Fixed input source assignment mismatch: '+r.input);
  const [m]=matches;
  return {...r,file:io,start:m.index,end:m.index+m[0].length,original:m[0],sha256:digest(m[0])};
 });
 const owned=patches.slice(addedStart);
 return {schema:1,sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',
  scope:'Official Help and fixed input substitutions only; other presentation caches pending',
  sources,inputSourceGuards,helpTopicTitleRequests,
  counts:{officialHelpDocuments:8,existingHelpParagraphIds:116,existingHelpTopicTitleIds:8,
   fixedInputSourceAssignments:23,existingFixedInputIds:16,newSemanticIds:0,guardedPatches:owned.length},
  guardedPatches:owned.map(p=>({file:p.file,start:p.start,end:p.end,original:p.original,
   originalSha256:digest(p.original),replacementSha256:digest(p.replacement)})),
  keepsRawHelpBytes:true,unknownOrModifiedHelpFallback:true,
  inputBindingMapsRebuiltForLocale:false,configurationAndGameplayCallsAdded:false,
  actualNativeCompiled:false,actualBrowserLocaleRefreshVerified:false};
}
