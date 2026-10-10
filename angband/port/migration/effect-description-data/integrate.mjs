// SPDX-License-Identifier: GPL-2.0-only
// Additive pure browser captures; original byte reconstruction is required.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {functionSpan} from '../stat-message-data/integrate.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const B='/* AB_EFFECT_BEGIN */',E='/* AB_EFFECT_END */';
export const stripEffect=s=>s.replace(/\/\* AB_EFFECT_BEGIN \*\/[\s\S]*?\/\* AB_EFFECT_END \*\//g,'');
const tag=s=>B+s+E;
const wrap=(macro,args,value)=>tag(macro+'('+args+',')+value+tag(')');
const integer=(b,n,v)=>wrap('AB_EFFECT_INT',b+',"'+n+'"',v);
const buffer=(b,n,v)=>wrap('AB_EFFECT_BUFFER',b+',"'+n+'"',v);
const lex=(b,n,f,i,v)=>wrap('AB_EFFECT_LEX',b+',"'+n+'",AB_EFFECT_'+f+','+i,v);
const selected=(b,n,v)=>wrap('AB_EFFECT_SELECTED',b+',"'+n+'"',v);
const prefix=(id,v)=>wrap('AB_EFFECT_PREFIX','"angband.effect_info.grammar.'+id+'"',v);
function one(s,old,next){const i=s.indexOf(old);if(i<0||s.indexOf(old,i+old.length)>=0)throw Error('Unique native anchor '+old);return s.slice(0,i)+next+s.slice(i+old.length);}
function block(s,nl){return tag(nl+'#ifdef __EMSCRIPTEN__'+nl+s+nl+'#endif'+nl);}
const before=(s,old,hook,nl)=>one(s,old,block(hook,nl)+old);
const after=(s,old,hook,nl)=>one(s,old,old+block(hook,nl));
const G='ab_effect_graph';
function graphEnter(s,nl,anchor){return after(s,anchor,' struct ab_effect_graph '+G+';'+nl+' ab_effect_graph_begin(&'+G+');',nl);}
function graphReturn(s,nl,value){return before(s,'return '+value+';',' ab_effect_graph_result(&'+G+','+value+');',nl);}
// C call argument spans, including nested expression commas and string quotes.
function callSpans(s,name){let out=[];const re=new RegExp('\\b'+name+'\\(','g');for(let m;(m=re.exec(s));){const open=m.index+name.length;let depth=1,mode='',escape=false,start=open+1,args=[];for(let i=start;i<s.length;i++){let c=s[i],n=s[i+1];if(mode==='/*'){if(c==='*'&&n==='/'){mode='';i++;}continue;}if(mode==='//'){if(c==='\n')mode='';continue;}if(mode==='"'||mode==="'"){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===mode)mode='';continue;}if(c==='/'&&(n==='*'||n==='/')){mode=c+n;i++;continue;}if(c==='"'||c==="'"){mode=c;continue;}if(c==='(')depth++;else if(c===')'){if(!--depth){args.push([start,i]);out.push({start:m.index,end:i+1,args});re.lastIndex=i+1;break;}}else if(c===','&&depth===1){args.push([start,i]);start=i+1;}}}return out;}
function patchCalls(s,name,select){const calls=callSpans(s,name);for(const call of calls.reverse()){const vals=call.args.map(([a,b])=>s.slice(a,b).trim()),change=select(vals,call,s);if(!change)continue;let snippet=s.slice(call.start,call.end);for(const [index,fn]of Object.entries(change.args??{}).map(([i,f])=>[Number(i),f]).sort(([a],[b])=>b-a)){const [a,b]=call.args[index],raw=s.slice(a,b),left=raw.match(/^\s*/)[0],right=raw.match(/\s*$/)[0],value=raw.trim();snippet=snippet.slice(0,a-call.start)+left+fn(value)+right+snippet.slice(b-call.start);}let start=call.start,end=call.end,assignment='';if(change.before&&s.slice(0,start).endsWith('len = ')){start-=6;assignment='len = ';}if(change.after){if(s[end]!==';')throw Error('Finish hook requires complete native statement '+name);snippet+=';';end++;}s=s.slice(0,start)+(change.before?tag(change.before):'')+assignment+snippet+(change.after?tag(change.after):'')+s.slice(end);}return s;}
const hook=(s,nl)=>nl+'#ifdef __EMSCRIPTEN__'+nl+s+nl+'#endif'+nl;
function dice(s,nl){
 const forms={'"%d+%dd%d"':['dice.base_roll',['base','dice','sides']], '"%d+%d*(%dd%d)"':['dice.multiplied_base',['base','multiplier','dice','sides']], '"%dd%d"':['dice.roll',['dice','sides']], '"%d*(%dd%d)"':['dice.multiplied',['multiplier','dice','sides']], '"%d"':['dice.base',['base']]};
 return patchCalls(s,'strnfmt',a=>{const f=forms[a[2]];if(!f)throw Error('Unknown native dice format');return {before:hook(' ab_effect_buffer_begin(dice_string,len,"angband.effect_info.grammar.'+f[0]+'");',nl),args:Object.fromEntries(f[1].map((n,i)=>[i+3,v=>integer('dice_string',n,v)])),after:hook(' ab_effect_buffer_end_ref(dice_string);',nl)};});
}
function damage(s,nl){
 s=before(s,'if (dev_skill_boost != 0) {',' ab_effect_buffer_end_ref(buffer);',nl);
 s=patchCalls(s,'format',a=>{let name,names;if(a[0].includes('device skill')){name='damage.boost';names=['percent'];}else{name='damage.average';names=['whole','tenth'];}return {before:hook(' ab_effect_buffer_append(buffer,"angband.effect_info.grammar.'+name+'");',nl),args:Object.fromEntries(names.map((n,i)=>[i+1,v=>integer('buffer',n,v)]))};});
 // Statement-level prepend, never a preprocessor directive within an expression.
 let moved=0;s=s.replace(/my_strcat\(buffer, (\/\* AB_EFFECT_BEGIN \*\/[\s\S]*?\/\* AB_EFFECT_END \*\/)format\(/g,(_,capture)=>{moved++;return capture+'my_strcat(buffer, format(';});if(moved!==2)throw Error('Damage setup statement hooks '+moved);
 return s;
}
function description(s,nl){
 s=graphEnter(s,nl,'bool value_set = false;');
 // Every selected native literal registers its own ID at the winning branch.
 for(const [text,id]of [['"uses enough food value"','food.use'],['"leaves you nourished"','food.leave'],['"feeds you"','food.feed']])s=one(s,text,prefix(id,text));
 s=one(s,'(e->index == EF_RANDOM) ? "randomly " : NULL',wrap('AB_EFFECT_RANDOM_PREFIX','', '(e->index == EF_RANDOM) ? "randomly " : NULL').replace('AB_EFFECT_RANDOM_PREFIX(,','AB_EFFECT_RANDOM_PREFIX('));
 s=patchCalls(s,'strnfmt',(a,call,body)=>{
  if(a[0]==='min_string'){let yes=a[2].includes('whichever');return {before:hook(' ab_effect_buffer_begin(min_string,sizeof(min_string),"angband.effect_info.grammar.'+(yes?'healing.minimum':'empty')+'");',nl),args:yes?{3:v=>integer('min_string','percent',v)}:{},after:hook(' ab_effect_buffer_end_ref(min_string);',nl)};}
  if(a[0]==='dist'){let level=a[2].includes('level-dependent');return {before:hook(' ab_effect_buffer_begin(dist,sizeof(dist),"angband.effect_info.grammar.teleport.'+(level?'level_distance':'grids')+'");',nl),args:level?{}:{3:v=>integer('dist','distance',v)},after:hook(' ab_effect_buffer_end_ref(dist);',nl)};}
  if(a[0]!=='desc')return null;
  let flag=[...body.slice(0,call.start).matchAll(/case EFINFO_([A-Z]+):/g)].at(-1)?.[1];
  if(!flag)throw Error('Missing native formatting case');
  const attrs={};let names=[];
  const put=(i,fn)=>attrs[i]=fn;
  switch(flag){
   case'DICE':put(2,v=>wrap('AB_EFFECT_DICE_FORMAT','e->index',v));names=['dice'];break;
   case'HEAL':names=['dice','minimum'];break;
   case'CONST':put(3,v=>integer('desc','experience',v));break;
   case'FOOD':put(3,v=>selected('desc','food_action',v));put(4,v=>buffer('desc','turns',v));put(5,v=>buffer('desc','percent',v));break;
   case'CURE':put(3,v=>lex('desc','condition','TIMED','e->subtype',v));break;
   case'TIMED':put(3,v=>lex('desc','condition','TIMED','e->subtype',v));put(4,v=>buffer('desc','duration',v));break;
   case'STAT':put(3,v=>lex('desc','stat','STAT','stat',v));break;
   case'SEEN':case'BOLT':case'TOUCH':put(3,v=>lex('desc','projection','PROJECTION_DESC','e->subtype',v));break;
   case'SUMM':put(3,v=>lex('desc','target','SUMMON','e->subtype',v));break;
   case'TELE':put(3,v=>selected('desc','subject',v.replace('"a monster"',prefix('teleport.monster','"a monster"')).replace('"you"',prefix('teleport.player','"you"'))));put(4,v=>buffer('desc','distance',v));break;
   case'QUAKE':put(3,v=>integer('desc','radius',v));break;
   case'BALL':case'SPOT':put(3,v=>lex('desc','projection','PROJECTION_PLAYER','e->subtype',v));put(4,v=>integer('desc','radius',v));if(flag==='SPOT')put(5,v=>integer('desc','full_radius',v));put(flag==='SPOT'?6:5,v=>buffer('desc','dice',v));break;
   case'BREATH':put(3,v=>buffer('desc','projection',v));put(4,v=>integer('desc','width',v));put(5,v=>buffer('desc','dice',v));break;
   case'SHORT':put(3,v=>lex('desc','projection','PROJECTION_PLAYER','e->subtype',v));put(4,v=>integer('desc','length',v));put(5,v=>buffer('desc','dice',v));break;
   case'LASH':put(3,v=>lex('desc','projection','PROJECTION_LASH','e->subtype',v));put(4,v=>integer('desc','length',v));break;
   case'BOLTD':put(3,v=>lex('desc','projection','PROJECTION_DESC','e->subtype',v));put(4,v=>buffer('desc','dice',v));break;
   case'NONE':break;
   default:return null;
  }
  names.forEach((n,i)=>put(i+3,v=>buffer('desc',n,v)));
  // BREATH single projection enters as a one-ref owned graph, not a live identity.
  if(flag==='BREATH')put(3,v=>wrap('AB_EFFECT_GRAPH_LEX','desc,"projection",AB_EFFECT_PROJECTION_PLAYER,e->subtype',v));
  return {before:hook(' ab_effect_buffer_begin(desc,sizeof(desc),ab_effect_description_id(e->index,false));',nl),args:attrs,after:hook(' ab_effect_buffer_end_ref(desc);',nl)};
 });
 // Native concatenation branch selection, including raw-next punctuation.
 s=after(s,'e ? ", " : " and ");',' ab_effect_graph_ref(&'+G+',e?"angband.effect_info.grammar.join.comma":"angband.effect_info.grammar.join.and");',nl);
 s=after(s,'textblock_append_textblock(tb, tbe);',' ab_effect_graph_child(&'+G+',tbe);',nl);
 s=after(s,'tb = tbe;',' ab_effect_graph_child(&'+G+',tbe);',nl);
 s=after(s,'textblock_append(tb, ", ");',' ab_effect_graph_ref(&'+G+',"angband.effect_info.grammar.join.comma");',nl);
 s=after(s,'textblock_append(tb, " and ");',' ab_effect_graph_ref(&'+G+',"angband.effect_info.grammar.join.and");',nl);
 s=after(s,'textblock_append(tb, "%s", prefix);',' ab_effect_graph_prefix(&'+G+',prefix);',nl);
 s=after(s,'copy_to_textblock_with_coloring(tb, desc);',' ab_effect_graph_buffer(&'+G+',desc);',nl);
 return graphReturn(s,nl,'tb');
}
function nested(s,nl){
 s=graphEnter(s,nl,'textblock *res = NULL;');
 s=before(s,'return false;',' ab_effect_graph_result(&'+G+',NULL);',nl);
 s=patchCalls(s,'strnfmt',a=>{
  if(a[0]==='breaths')return {before:hook(' ab_effect_buffer_list_begin(breaths,sizeof(breaths));'+nl+' ab_effect_buffer_list_lexeme(breaths,AB_EFFECT_PROJECTION_PLAYER,efirst->subtype);',nl)};
  if(a[0]==='desc')return {before:hook(' ab_effect_buffer_begin(desc,sizeof(desc),ab_effect_description_id(efirst->index,false));',nl),args:{3:v=>buffer('desc','projection',v),4:v=>integer('desc','width',v),5:v=>buffer('desc','dice',v)},after:hook(' ab_effect_buffer_end_ref(desc);',nl)};
  return null;
 });
 s=one(s,'(nvalid > 2) ? ", or " : " or "','(nvalid > 2) ? '+wrap('AB_EFFECT_LIST','breaths,"angband.effect_info.grammar.join.oxford_or"','", or "')+' : '+wrap('AB_EFFECT_LIST','breaths,"angband.effect_info.grammar.join.or"','" or "'));
 s=after(s,'my_strcat(breaths, ", ", sizeof(breaths));',' ab_effect_buffer_list_ref(breaths,"angband.effect_info.grammar.join.comma");',nl);
 s=after(s,'my_strcat(breaths, projections[e->subtype].player_desc,'+nl+'\t\t\t\tsizeof(breaths));',' ab_effect_buffer_list_lexeme(breaths,AB_EFFECT_PROJECTION_PLAYER,e->subtype);',nl);
 s=s.replaceAll('textblock_append(res, "%s", prefix);','textblock_append(res, "%s", prefix);'+block(' ab_effect_graph_prefix(&'+G+',prefix);',nl));
 s=after(s,'textblock_append(res, "%s", type_prefix);',' ab_effect_graph_prefix(&'+G+',type_prefix);',nl);
 s=after(s,'copy_to_textblock_with_coloring(res, desc);',' ab_effect_graph_buffer(&'+G+',desc);',nl);
 s=s.replaceAll('textblock_append_textblock(res, tb);','textblock_append_textblock(res, tb);'+block(' ab_effect_graph_child(&'+G+',tb);',nl));
 s=s.replaceAll('res = tb;','res = tb;'+block(' ab_effect_graph_child(&'+G+',tb);',nl));
 s=after(s,'" or " : ", ");',' ab_effect_graph_ref(&'+G+',ivalid==nvalid-1?"angband.effect_info.grammar.join.or":"angband.effect_info.grammar.join.comma");',nl);
 return graphReturn(s,nl,'res');
}
function menu(s,nl){
 for(const [text,id]of [['"feed"','food.menu.feed'],['"yourself"','food.menu.yourself'],['"increase"','food.menu.increase'],['"hunger"','food.menu.hunger'],['"become"','food.menu.become'],['"leave"','food.menu.leave']])s=one(s,text,prefix(id,text));
 for(const [text,id]of [['"bloated"','food.menu.bloated'],['"satisfied"','food.menu.satisfied'],['"hungry"','food.menu.hungry'],['"nourished"','food.menu.nourished']])s=s.replaceAll(text,prefix(id,text));
 s=patchCalls(s,'strnfmt',(a,call,body)=>{
  if(a[0]==='dist'){const fixed=a[2].includes('some distance');return {before:hook(' ab_effect_buffer_begin(dist,sizeof(dist),"angband.effect_info.grammar.teleport.'+(fixed?'some_distance':'grids')+'");',nl),args:fixed?{}:{3:v=>integer('dist','distance',v)},after:hook(' ab_effect_buffer_end_ref(dist);',nl)};}
  if(a[0]!=='buf')return null;
  const flag=[...body.slice(0,call.start).matchAll(/case EFINFO_([A-Z]+):/g)].at(-1)?.[1],attrs={};
  if(a[2]==='fmt')switch(flag){
   case'FOOD':attrs[3]=v=>selected('buf','action',v);attrs[4]=v=>selected('buf','argument',v);break;
   case'TIMED':attrs[3]=v=>lex('buf','condition','TIMED','e->subtype',v);break;
   case'STAT':attrs[3]=v=>lex('buf','stat','STAT','e->subtype',v);break;
   case'TOUCH':attrs[3]=v=>lex('buf','projection','PROJECTION_DESC','e->subtype',v);break;
   case'SUMM':attrs[3]=v=>lex('buf','target','SUMMON','e->subtype',v);break;
   case'TELE':attrs[3]=v=>selected('buf','subject',v.replace('"other"',prefix('teleport.other','"other"')).replace('"you"',prefix('teleport.player','"you"')));attrs[4]=v=>buffer('buf','distance',v);break;
   case'SHORT':attrs[3]=v=>lex('buf','projection','PROJECTION_PLAYER','e->subtype',v);break;
   case'LASH':attrs[3]=v=>lex('buf','projection','PROJECTION_LASH','e->subtype',v);break;
  }
  return {before:hook(' ab_effect_buffer_begin(buf,max,ab_effect_description_id(e->index,true));',nl),args:attrs,after:hook(' ab_effect_buffer_end_ref(buf);',nl)};
 });
 return s;
}
const edits=new Map([
 ['format_dice_string',dice],['append_damage',damage],['effect_describe',description],['create_nested_effect_description',nested],['effect_get_menu_name',menu],
 ['describe_effect',(s,nl)=>{
  for(const [text,id]of [['"When eaten, it "','prefix.eaten'],['"When quaffed, it "','prefix.quaffed'],['"When read, it "','prefix.read'],['"When aimed, it "','prefix.aimed'],['"When activated, it "','prefix.activated']]){const old='prefix = '+text+';';if(!s.includes(old))throw Error('Missing prefix '+old);s=s.replaceAll(old,'prefix = '+prefix(id,text)+';');}
  return after(s,'textblock_append_textblock(tb, tbe);',' ab_effect_emit_result(tbe);',nl);
 }],
 ['shape_lore_append_change_effects',(s,nl)=>after(one(s,'"Changing into the shape "',prefix('prefix.shape','"Changing into the shape "')),'if (tbe) {',' ab_effect_emit_result(tbe);',nl)],
 ['effect_menu_new',(s,nl)=>{
  s=after(s,'char buf[80];',' ab_effect_menu_begin();',nl);
  s=after(s,'string_make("one of the following at random");',' ab_effect_menu_random((unsigned)ms_count);',nl);
  s=after(s,'ms[ms_count] = string_make(buf);',' ab_effect_emit_menu(buf,(unsigned)ms_count);',nl);
  s=before(s,'return NULL;',' ab_effect_menu_end();',nl);
  return s;
 }],
 ['effect_menu_destroy',(s,nl)=>before(s,'if (m) {',' ab_effect_menu_end();',nl)]
]);
const files={'logic/effects-info.c':['format_dice_string','append_damage','create_nested_effect_description','effect_describe','effect_get_menu_name'],'logic/obj-info.c':['describe_effect'],'logic/ui-knowledge.c':['shape_lore_append_change_effects'],'logic/ui-effect.c':['effect_menu_new','effect_menu_destroy']};
export function integrate(){let snapshots=[],prepared=[];for(const [file,names]of Object.entries(files)){const target=path.join(root,file),current=fs.readFileSync(target,'utf8'),original=stripEffect(current);let source=original,nl=original.includes('\r\n')?'\r\n':'\n';for(const name of names){let [start,end]=functionSpan(source,name),body=source.slice(start,end);snapshots.push({file,function:name,sha256:sha(body),base64:Buffer.from(body).toString('base64')});let changed=edits.get(name)(body,nl);if(stripEffect(changed)!==body)throw Error('Native function bytes '+name);source=source.slice(0,start)+changed+source.slice(end);}source=tag('#include "web-effect-description.h"'+nl)+source;if(stripEffect(source)!==original)throw Error('Native file bytes '+file);prepared.push({target,current,source});}
 for(const {target,current}of prepared)if(fs.readFileSync(target,'utf8')!==current)throw Error('Concurrent owner mutation '+target);
 for(const {target,source}of prepared)fs.writeFileSync(target,source);
 fs.writeFileSync(path.join(here,'producer-snapshots.json'),JSON.stringify({schema_version:1,upstream_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',snapshots},null,2)+'\n');console.log(JSON.stringify({functions:snapshots.length,files:Object.keys(files).length,native_byte_parity:true}));}
export function integrateMenuPrompt(){
 const file='logic/ui-effect.c',name='effect_menu_select',target=path.join(root,file),current=fs.readFileSync(target,'utf8'),[start,end]=functionSpan(current,name),body=current.slice(start,end),native=stripEffect(body),nl=body.includes('\r\n')?'\r\n':'\n';
 const changed=before(native,'prt((prompt) ? prompt : "Which effect? ", 0, 0);',' ab_effect_menu_prompt(prompt);',nl);
 if(stripEffect(changed)!==native)throw Error('Menu prompt native byte mismatch');
 const out=current.slice(0,start)+changed+current.slice(end);if(fs.readFileSync(target,'utf8')!==current)throw Error('Concurrent menu producer mutation');
 fs.writeFileSync(target,out);
 const records=JSON.parse(fs.readFileSync(path.join(here,'producer-snapshots.json'),'utf8'));records.snapshots=records.snapshots.filter(s=>s.function!==name);records.snapshots.push({file,function:name,sha256:sha(native),base64:Buffer.from(native).toString('base64')});
 fs.writeFileSync(path.join(here,'producer-snapshots.json'),JSON.stringify(records,null,2)+'\n');console.log(JSON.stringify({menu_prompt:true,native_byte_parity:true}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv.includes('--menu-prompt-only'))integrateMenuPrompt();else integrate();}
