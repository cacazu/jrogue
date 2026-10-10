/** Explicit reviewed Lua presentation callsites, preserving original mechanics and registry fields. */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanMessageCalls} from './message-inventory.mjs';
import {staticBaseMessageRows,plotParagraphs} from './lua-base-message-translations.mjs';
import {staticLevelMessages,verifyStaticLevelMessages} from './lua-level-message-translations.mjs';
import {curateCoreLuaSites} from './lua-core-sites.mjs';
import {curateDynamicLuaSites} from './lua-dynamic-sites.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const quote=s=>JSON.stringify(s);
export function curateLuaSites({file,exact,catalog,patches}){
 const reviewed=[],cache=new Map();
 function at(f,line){if(!cache.has(f))cache.set(f,scanMessageCalls(file(f),'lua',f));const calls=cache.get(f).filter(c=>c.line===line);if(calls.length!==1)throw Error(`Expected one Lua message ${f}:${line}`);return calls[0];}
 function replace(c,replacement,ids){patches.push({file:c.file,start:c.start,end:c.end,original:c.original,replacement,id:ids[0],kind:'semantic-message'});reviewed.push({key:c.key,id:ids[0],variantIds:ids,source:c.original,replacement});}
 const io='src/drlio.pas';
 exact(io,'function lua_ui_msg(L: Plua_State): Integer; cdecl;',readFileSync(path.join(here,'lua-semantic-adapter.pas'),'utf8')+'\r\nfunction lua_ui_msg(L: Plua_State): Integer; cdecl;');
 exact(io,'const lua_ui_lib : array[0..20] of luaL_Reg = (','const lua_ui_lib : array[0..31] of luaL_Reg = (');
 exact(io,"( name : 'msg';           func : @lua_ui_msg ),","( name : 'msg';           func : @lua_ui_msg ),\r\n      ( name : 'semantic_text'; func : @lua_ui_semantic_text ),\r\n      ( name : 'registry_text'; func : @lua_ui_registry_text ),\r\n      ( name : 'being_name'; func : @lua_ui_being_name ),\r\n      ( name : 'item_description'; func : @lua_ui_item_description ),\r\n      ( name : 'remember_semantic_feeling'; func : @lua_ui_remember_semantic_feeling ),\r\n      ( name : 'repeat_semantic_feeling'; func : @lua_ui_repeat_semantic_feeling ),\r\n      ( name : 'clear_semantic_feelings'; func : @lua_ui_clear_semantic_feelings ),");
 const uses=file(io).indexOf('uses ',file(io).indexOf('implementation'));
 patches.push({file:io,start:uses+5,end:uses+5,original:'',replacement:'drlsemanticregistry, drlsemanticfeelings, drlsemanticfeelcatalog, drlsemanticitemnames, drlsemanticitemcatalog, drlsemantichistory, drlsemantichistorycatalog, ',id:null,kind:'bridge-support'});
 const errors=[
  ['request','Semantic text ID and English template are required','テキスト ID と英語の文型が必要です'],
  ['parameter-table','Semantic text parameters must be a table','テキストの引数はテーブルで指定してください'],
  ['parameter-limit','Semantic text parameter limit exceeded','テキストの引数が上限を超えています'],
  ['integer','Semantic integer parameter must be a signed decimal Int64','整数の引数は符号付き 64 ビット整数の十進文字列で指定してください'],
  ['parameter-kind','Unknown semantic text parameter kind','不明なテキスト引数の型です'],
  ['registry-request','Registry text requires category, ID, scope, field and English guard','用語の表示には分類、ID、範囲、項目、元の英語が必要です']
 ];
 for(const [suffix,en,ja]of errors)catalog('error.text.lua.'+suffix,en,ja);
 catalog('error.text.lua.presentation-pad','Presentation padding requires text and an integer width from 0 to 512','表示用の余白には、テキストと0から512までの整数の幅を指定してください');
 exact(io,"( name : 'msg_enter';     func : @lua_ui_msg_enter ),","( name : 'msg_enter';     func : @lua_ui_msg_enter ),\r\n      ( name : 'presentation_pad'; func : @lua_ui_presentation_pad ),");
 exact(io,"( name : 'msg_history';   func : @lua_ui_msg_history ),","( name : 'msg_history';   func : @lua_ui_msg_history ),\r\n      ( name : 'remember_item_name_aspect'; func : @lua_ui_remember_item_name_aspect ),\r\n      ( name : 'remember_semantic_history'; func : @lua_ui_remember_semantic_history ),\r\n      ( name : 'presentation_history'; func : @lua_ui_presentation_history ),");
 exact(io,"State.Register( 'ui', lua_ui_lib );","State.Register( 'ui', lua_ui_lib );\r\n  DRLSemanticHistorySource := @DRLReadOriginalHistory;\r\n  DRLSemanticHistoryCurrentSource := @DRLReadCurrentOriginalHistory;");
 const staticRows=[
  ['bin/data/core/being.lua',375,'mod-no-suitable-item','改造できるアイテムがない！'],
  ['bin/data/core/being.lua',425,'mod-item-limit','この MOD では、これ以上このアイテムを改造できない！'],
  ['bin/data/core/item.lua',125,'overcharge-declined','怖じ気づいたか。'],
  ['bin/data/core/level.lua',452,'push-cannot-move','そちらへは動かせないようだ。'],
  ['bin/data/core/level.lua',459,'push-stupid','ああ、なんて愚かなことを！'],
  ['bin/data/core/level.lua',466,'push-cannot-move','そちらへは動かせないようだ。'],
  ['bin/data/drl/main.lua',60,'welcome-drl','{RDRL} へようこそ……']
 ];
 for(const [f,line,suffix,japanese]of staticRows){
  const c=at(f,line);if(!c.arguments[0].singleLiteral)throw Error('Reviewed Lua message is not a single literal');
  const english=c.arguments[0].strings[0].value,id='message.'+suffix;catalog(id,english,japanese);
  replace(c,`${c.callee}(ui.semantic_text(${quote(id)}, ${quote(english)}))`,[id]);
 }
 for(const [f,rows]of Object.entries(staticBaseMessageRows))for(const [line,suffix,japanese]of rows){
  const c=at(f,line);if(c.classification!=='static_literal'||!c.arguments[0].singleLiteral)throw Error(`Not a reviewed static Lua message ${c.key}`);
  const english=c.arguments[0].strings[0].value,id='message.'+suffix;catalog(id,english,japanese);
  const args=c.arguments.map((a,n)=>n===0?`ui.${c.callee==='ui.msg_feel'?'semantic_feeling':'semantic_text'}(${quote(id)}, ${quote(english)})`:a.source);
  replace(c,`${c.callee}(${args.join(', ')})`,[id]);
 }
 for(const [line,[suffix,japanese]]of Object.entries(plotParagraphs)){
  const c=at('bin/data/drl/plot.lua',Number(line));if(!c.arguments[0].singleLiteral)throw Error('Plot body is not a single literal');
  const english=c.arguments[0].strings[0].value,id='message.plot.'+suffix;catalog(id,english,japanese);
  const args=c.arguments.map((a,n)=>n===0?`ui.${c.callee==='ui.msg_feel'?'semantic_feeling':'semantic_text'}(${quote(id)}, ${quote(english)})`:a.source);
  replace(c,`${c.callee}(${args.join(', ')})`,[id]);
 }
 verifyStaticLevelMessages();
 for(const {file:f,line,id,english,japanese}of staticLevelMessages){
  const c=at(f,line);if(c.arguments[0].strings[0].value!==english)throw Error(`Level source guard mismatch ${c.key}`);
  catalog(id,english,japanese);
  const args=c.arguments.map((a,n)=>n===0?`ui.${c.callee==='ui.msg_feel'?'semantic_feeling':'semantic_text'}(${quote(id)}, ${quote(english)})`:a.source);
  replace(c,`${c.callee}(${args.join(', ')})`,[id]);
 }
 // Labels are display values only: value/cancel/escape and command behavior remain unchanged.
 const ui='bin/data/core/ui.lua';
 for(const [name,id,japanese]of [['Cancel','ui.cancel','キャンセル'],['Confirm','ui.confirm','確認'],['Continue','ui.continue','続ける']]){
  catalog(id,name,japanese);
  const needle=`name = ${quote(name)}`,count=file(ui).split(needle).length-1;
  for(let n=0;n<count;n++)exact(ui,needle,`name = ui.semantic_text(${quote(id)}, ${quote(name)})`,id,n);
 }
 return reviewed.concat(curateCoreLuaSites({file,exact,catalog,patches}),curateDynamicLuaSites({file,exact,catalog,patches}));
}
