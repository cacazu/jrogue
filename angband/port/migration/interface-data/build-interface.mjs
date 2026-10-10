import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'migration/interface-data');
const inventory=JSON.parse(fs.readFileSync(path.join(dir,'inventory.json'),'utf8'));
const translations={...JSON.parse(fs.readFileSync(path.join(dir,'review-translations.json'),'utf8')),...JSON.parse(fs.readFileSync(path.join(dir,'review-extra-translations.json'),'utf8'))};
const entries=[], ids=new Map(), english={}, japanese={};
const slug=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').split('_').slice(0,8).join('_')||'label';
function add(id,en,ja,parameters=[],sources=[],role='interface_text') {
 if(ids.has(id)){const old=ids.get(id);if(old.english!==en||old.japanese!==ja)throw Error(id);old.sources.push(...sources);return id;}
 if(id.length>127)throw Error('ID too long '+id);
 const record={id,english:en,japanese:ja,parameters,sources,role,status:'reviewed_source_catalog'};
 entries.push(record);ids.set(id,record);english[id]=en;japanese[id]=ja;return id;
}
for(const item of inventory.entries) {
 if(['include_path','parser_key_or_file_identity','layout_spacing','export_markup','numeric_render_format'].includes(item.classification))continue;
 if(['msg','msgt'].includes(item.call)||item.printf.length||!Object.hasOwn(translations,item.original_english))continue;
 const area=path.basename(item.source.file,'.c').replace(/^ui-/,'').replaceAll('-','_');
 const en=item.original_english.startsWith('{light green}Movement keys{/}')?'Movement keys scroll the list\nESC returns to the previous menu\nEnter toggles the current setting.':item.original_english;
 item.semantic_id=add(`interface.${area}.${slug(item.function??'table')}.${slug(item.original_english)}`,en,translations[item.original_english],[],[item.source]);
 item.translation_status='reviewed_source_catalog';
}
const contexts={'ui-store.c':'store','ui-object.c':'item-menu','ui-knowledge.c':'knowledge','ui-target.c':'target','ui-death.c':'death','ui-score.c':'score','ui-options.c':'options','ui-command.c':'command','ui-curse.c':'item-menu','ui-keymap.c':'keymap','ui-visuals.c':'visuals','ui-menu.c':'command'};
const renderCalls=new Set(['prt','c_prt','put_str','c_put_str','put_str_centred','Term_putstr','get_check','get_string','get_com','get_com_ex','get_char']);
function endCall(source,start) {
 let level=0,quoted=null;
 for(let i=start;i<source.length;i++) {
  const c=source[i];
  if(quoted){if(c==='\\'){i++;continue;}if(c===quoted)quoted=null;continue;}
  if(c==='"'||c==="'"){quoted=c;continue;}
  if(c==='(')level++;else if(c===')'&&!--level)return i+1;
 }
 throw Error('unclosed original call');
}
const connections=[],tables=[];
for(const file of inventory.files) {
 const name=path.basename(file),baseline=fs.readFileSync(path.join(dir,'source-baseline',name),'utf8');
 let source=baseline;
 const relevant=inventory.entries.filter(item=>item.source.file===file&&item.semantic_id);
 const patches=[];
 const tokens=[...baseline.matchAll(/\b(prt|c_prt|put_str|c_put_str|put_str_centred|Term_putstr|get_check|get_string|get_com|get_com_ex|get_char)\s*\(/g)];
 for(const token of tokens) {
  const start=token.index,end=endCall(baseline,start),call=baseline.slice(start,end);
  if(!renderCalls.has(token[1]))continue;
  const literals=[...call.matchAll(/"(?:[^"\\]|\\.)*"/g)].map(m=>{try{return JSON.parse(m[0]);}catch{return null;}});
  const matches=relevant.filter(item=>item.call===token[1]&&literals.includes(item.original_english));
  if(!matches.length)continue;
  const line=baseline.slice(0,start).split('\n').length;
  const closest=matches.sort((a,b)=>Math.abs(a.source.line-line)-Math.abs(b.source.line-line))[0];
  // The source marker names the semantic producer; the native call, arguments,
  // original literal and surrounding conditional remain a single expression.
  patches.push({start,end,text:`AB_IF_TEXT("${closest.semantic_id}","${contexts[name]}","${slug(closest.function??token[1])}.${slug(closest.original_english)}", ${call})`});
  connections.push({id:closest.semantic_id,file,baseline_line:line,call:token[1],kind:'native_call_once',original_call:call});
 }
 // Exact static menu_action table rows retain their source-array ordinal,
 // including separators. Runtime binding is by table/menu identity only.
 for(const match of baseline.matchAll(/static\s+(?:const\s+)?menu_action\s+(\w+)\s*\[\s*\]\s*=\s*\{([\s\S]*?)\};/g)) {
  const rowIds=[];
  for(const row of match[2].matchAll(/\{\s*[^,]+,\s*(?:'(?:[^'\\]|\\.)*'|0)\s*,\s*("(?:[^"\\]|\\.)*"|NULL)\s*,[^}]*\}/g)) {
   if(row[1]==='NULL'){rowIds.push(null);continue;}
   const en=JSON.parse(row[1]),item=relevant.find(item=>item.original_english===en);
   rowIds.push(item?.semantic_id??null);
  }
  const array=`ab_if_${match[1]}_ids`;
  const generated=`\r\n#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */\r\nstatic const char *const ${array}[] = {${rowIds.map(id=>id?JSON.stringify(id):'NULL').join(',')}};\r\n#endif /* AB_INTERFACE */\r\n`;
  patches.push({start:match.index+match[0].length,end:match.index+match[0].length,text:generated});
  const context=name==='ui-death.c'?'death-menu':contexts[name];
  tables.push({file,array,source_array:match[1],row_ids:rowIds,context});
  const pattern=new RegExp('(\\w+)\\s*=\\s*menu_new_action\\(\\s*'+match[1]+'\\s*,[\\s\\S]*?\\);','g');
  for(const call of baseline.matchAll(pattern)) {
   const variable=call[1],titleId=name==='ui-options.c'&&match[1]==='option_actions'?relevant.find(i=>i.original_english==='Options Menu')?.semantic_id:null;
   const add=`\r\n#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */\r\n ab_if_menu_bind(${variable},"${context}",${titleId?JSON.stringify(titleId):'NULL'},NULL,${array},N_ELEMENTS(${array}));\r\n#endif /* AB_INTERFACE */\r\n`;
   patches.push({start:call.index+call[0].length,end:call.index+call[0].length,text:add});
  }
 }
 for(const patch of patches.sort((a,b)=>b.start-a.start))source=source.slice(0,patch.start)+patch.text+source.slice(patch.end);
 if(patches.length)source=source.replace('#include "angband.h"','#include "angband.h"\r\n#include "web-interface-text.h" /* AB_INTERFACE_INCLUDE */');
 fs.writeFileSync(path.join(root,file),source);
}
add('interface.options.value_and_key','{value} ({option_key})','{value}（{option_key}）',[{name:'value',type:'localized_text'},{name:'option_key',type:'canonical_identity'}],[],'option_state');
add('interface.options.state.enabled','yes','有効',[],[],'option_state');
add('interface.options.state.disabled','no','無効',[],[],'option_state');
const optionJa={rogue_like_commands:'ローグ風のコマンドキーを使う',autoexplore_commands:'自動探索コマンドを使う',use_sound:'効果音を使う',show_damage:'モンスターに与えたダメージを表示する',use_old_target:'前の標的を既定の標的にする',pickup_always:'品物を常に拾う',pickup_inven:'所持品と同じ種類の品物を常に拾う',show_flavors:'品物の説明に未識別の外見を表示する',show_target:'カーソルで標的を強調する',highlight_player:'ターンの合間にカーソルでプレイヤーを強調する',disturb_near:'視認できるモンスターが動くと行動を中断する',solid_walls:'壁を塗りつぶした記号で表示する',hybrid_walls:'壁の背景に陰影を付ける',view_yellow_light:'松明の光を黄色で表示する',animate_flicker:'多色のものを明滅させる',center_player:'常にプレイヤーを地図の中央に表示する',purple_uniques:'ユニーク・モンスターを紫色で表示する',auto_more:'「続く」の確認待ちを自動で進める',hp_changes_color:'残りHPの割合に応じてプレイヤーの色を変える',mouse_movement:'マウスのクリックでプレイヤーを移動できるようにする',notify_recharge:'品物の再充填が終わると通知する',effective_speed:'実効速度を倍率で表示する',cheat_hear:'チート：モンスターの生成を確認する',score_hear:'得点記録：モンスターの生成確認を使用',cheat_room:'チート：ダンジョンの生成を確認する',score_room:'得点記録：ダンジョンの生成確認を使用',cheat_xtra:'チート：その他の内部情報を確認する',score_xtra:'得点記録：その他の内部情報の確認を使用',cheat_live:'チート：プレイヤーが死を回避できるようにする',score_live:'得点記録：死の回避を使用'};
const optionSource=fs.readFileSync(path.join(dir,'source-baseline/list-options.h'),'utf8'),optionRows=[];
for(const match of optionSource.matchAll(/OP\((\w+),\s*"((?:[^"\\]|\\.)*)",\s*(\w+),\s*(true|false)\)/g)) {
 const[,code,en,type,initial]=match;if(code==='none')continue;
 const id=code.startsWith('birth_')?`birth.options.${code.slice(6)}.description`:`interface.options.setting.${code}.description`;
 const line=optionSource.slice(0,match.index).split('\n').length;
 if(!code.startsWith('birth_'))add(id,en,optionJa[code]??(()=>{throw Error('unreviewed option '+code)})(),[],[{file:'logic/list-options.h',line}], 'option_description');
 optionRows.push({code,id,option_type:type,default:initial==='true',source:{file:'logic/list-options.h',line}});
}
fs.writeFileSync(path.join(dir,'option-bindings.inc'),`/* SPDX-License-Identifier: GPL-2.0-only */\nstatic const struct { int option;const char *id; } ab_if_options[] = {\n${optionRows.map(r=>` { OPT_${r.code}, "${r.id}" },`).join('\n')}\n};\n`);
const final={schema_version:1,upstream_commit:inventory.upstream_commit,status:'source_connected_unbuilt',complete_game_translation:false,entries,connections,tables,options:optionRows,source_files:inventory.files};
for(const[file,value]of[['source-manifest.json',final],['en.json',english],['ja.json',japanese],['inventory.json',inventory]])fs.writeFileSync(path.join(dir,file),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({entries:entries.length,static_native_connections:connections.length,action_tables:tables.length,option_identities:optionRows.length}));
