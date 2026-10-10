/* Owned local facts survive original callbacks; original functions execute once. */
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';import{stripResidual}from'./native-parity.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),dir='migration/ui-residual-message-data';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read(dir+'/source-manifest.json')),pending=new Map(),connections=[];
const B='/* AB_UI_RESIDUAL_BEGIN */',E='/* AB_UI_RESIDUAL_END */';
const block=s=>B+'\n#ifdef __EMSCRIPTEN__\n'+s+'\n#endif\n'+E;
const wrap=(p,n,s=')')=>B+p+E+n+B+s+E;
function get(name){if(!pending.has(name)){const before=read('logic/'+name);pending.set(name,{before,source:before});}return pending.get(name);}
function lexMask(s){return s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,m=>m.replace(/[^\r\n]/g,' '));}
function callAt(s,at){const start=s.indexOf('(',at),mask=lexMask(s);let depth=1;for(let i=start+1;i<s.length;i++){if(mask[i]==='(')depth++;if(mask[i]===')'&&!--depth)return{at,end:i+1,native:s.slice(at,i+1)};}throw Error('unbalanced source call');}
function calls(s,name){const mask=lexMask(s),re=new RegExp('\\b'+name+'\\s*\\(','g');return[...mask.matchAll(re)].map(m=>callAt(s,m.index));}
function edit(name,needle,next,count=1){const f=get(name),n=f.source.split(needle).length-1;assert.equal(n,count,name+': '+needle);f.source=f.source.replaceAll(needle,typeof next==='function'?next(needle):next);}
function original(name,func,contains){const spans=calls(get(name).source,func).filter(c=>c.native.includes(contains));assert.equal(spans.length,1,name+': '+contains);return spans[0].native;}
function hook(name,call,effect){edit(name,call,n=>wrap('AB_UR_BEFORE(('+effect+'),',n));connections.push({file:'logic/'+name,native_expression:call,kind:'owned_source_consumer'});}
/* Only original inscription title producer; owned snapshot releases on all returns. */
const desc=original('cmd-obj.c','object_desc','ODESC_PREFIX | ODESC_FULL,\r\n\t\tplayer');
edit('cmd-obj.c',desc+';',n=>block('\tstruct ab_naming_snapshot ab_ur_title={0};')+n+block('\tab_ur_object_capture(&ab_ur_title,o_name);'));
const stringCall=original('cmd-obj.c','cmd_get_string','"inscription"');
edit('cmd-obj.c',stringCall,n=>wrap('AB_UR_TITLE(&ab_ur_title,prompt,',n));
hook('cmd-core.c',original('cmd-core.c','msg','"%s", title'),'ab_ur_title_message(title)');
/* The original source branch supplies raw user fields before native formatting. */
for(const[branch,format,text]of[[1,'-- %s says:','&tmp[5]'],[2,'-- %s%s','&tmp[3]'],[3,'-- Note:','tmp']]){
 const call=original('cmd-misc.c','strnfmt',format);edit('cmd-misc.c',call,n=>wrap('AB_UR_NOTE('+branch+','+(branch===3?'NULL':'player->full_name')+','+text+',',n));
}
hook('cmd-misc.c',original('cmd-misc.c','msg','"%s", &note[3]'),'ab_ur_note_message()');
/* Getter result captures the private rune selection once; helper consumes it. */
const rune='rune_name(i)';
edit('obj-knowledge.c',rune,n=>wrap('AB_UR_RUNE(i,',n));
connections.push({file:'logic/obj-knowledge.c',kind:'existing_private_rune_capture',native_expression:rune,source_index:159});
/* One deep owned object description per original producer function. */
function functionSpan(source,name){const mask=lexMask(source),re=new RegExp('(?:^|\\n)(?:static )?(?:bool|void) '+name+'\\([^;]*?\\)\\s*\\{','g'),matches=[...mask.matchAll(re)];assert.equal(matches.length,1,name);
 const at=matches[0].index,brace=mask.indexOf('{',at);let depth=1;for(let i=brace+1;i<mask.length;i++){if(mask[i]==='{')depth++;if(mask[i]==='}'&&!--depth)return{at,end:i+1,brace};}throw Error('unbalanced '+name);}
const f=get('obj-knowledge.c');
for(const name of['object_curses_find_flags','object_learn_on_wield','equip_learn_flag','equip_learn_after_time']){
 const span=functionSpan(f.source,name);let fn=f.source.slice(span.at,span.end);
 const nativeDescriptions=calls(fn,'object_desc');assert.ok(nativeDescriptions.length,name);
 for(const c of nativeDescriptions.reverse()){assert.equal(fn[c.end],';');fn=fn.slice(0,c.end+1)+block('\tab_ur_object_capture(&ab_ur_property,o_name);')+fn.slice(c.end+1);}
 const notices=calls(fn,'flag_message');assert.ok(notices.length,name);
 for(const c of notices.reverse())fn=fn.slice(0,c.at)+wrap('AB_UR_PROPERTY(&ab_ur_property,o_name,',c.native)+fn.slice(c.end);
 const returns=[...lexMask(fn).matchAll(/\breturn\b[^;]*;/g)];
 for(const ret of returns.reverse()){const native=fn.slice(ret.index,ret.index+ret[0].length);fn=fn.slice(0,ret.index)+wrap('AB_UR_RETURN(&ab_ur_property,',native,');')+fn.slice(ret.index+ret[0].length);}
 const brace=fn.indexOf('{');fn=fn.slice(0,brace+1)+block('\tstruct ab_naming_snapshot ab_ur_property={0};')+fn.slice(brace+1);
 fn=fn.slice(0,-1)+block('\tab_naming_snapshot_release(&ab_ur_property);')+fn.slice(-1);
 f.source=f.source.slice(0,span.at)+fn+f.source.slice(span.end);
 connections.push({file:'logic/obj-knowledge.c',function:name,kind:'immediate_owned_property_snapshot',native_descriptions:nativeDescriptions.length,original_notice_calls:notices.length});
}
hook('obj-properties.c',original('obj-properties.c','msg','"%s", buf'),'ab_ur_property_message(flag,name)');
/* Original single-floor-item branches and original two descriptor modes. */
const floor=get('ui-display.c'),floorSpan=functionSpan(floor.source,'see_floor_items');let floorFn=floor.source.slice(floorSpan.at,floorSpan.end);
for(const[word,id]of[['see','ui.residual.floor.see'],['have no room for','ui.residual.floor.no_room'],['feel','ui.residual.floor.feel']]){
 const needle='"'+word+'"';assert.equal(floorFn.split(needle).length-1,1);floorFn=floorFn.replace(needle,wrap('AB_UR_SOURCE("'+id+'",',needle));
}
const one=floorFn.indexOf('if (floor_num == 1) {');assert.ok(one>=0);
floorFn=floorFn.slice(0,one+'if (floor_num == 1) {'.length)+block('\tstruct ab_naming_snapshot ab_ur_floor={0};')+floorFn.slice(one+'if (floor_num == 1) {'.length);
for(const c of calls(floorFn,'object_desc').reverse()){assert.equal(floorFn[c.end],';');floorFn=floorFn.slice(0,c.end+1)+block('\tab_ur_object_capture(&ab_ur_floor,o_name);')+floorFn.slice(c.end+1);}
const floorMsg=calls(floorFn,'msg').filter(c=>c.native.includes('"You %s %s."'));assert.equal(floorMsg.length,1);const c=floorMsg[0];
floorFn=floorFn.slice(0,c.at)+wrap('AB_UR_BEFORE((ab_ur_message_object(ab_dc_source_message_id(p),MSG_GENERIC,"object",&ab_ur_floor,NULL,0)),',c.native)+floorFn.slice(c.end);
const messageEnd=floorFn.indexOf('msg("You %s %s.", p, o_name)')+'msg("You %s %s.", p, o_name)'.length;
const endAnnotation=floorFn.indexOf(E,messageEnd)+E.length;assert.equal(floorFn[endAnnotation],';');floorFn=floorFn.slice(0,endAnnotation+1)+block('\tab_naming_snapshot_release(&ab_ur_floor);')+floorFn.slice(endAnnotation+1);
floor.source=floor.source.slice(0,floorSpan.at)+floorFn+floor.source.slice(floorSpan.end);
connections.push({file:'logic/ui-display.c',kind:'original_floor_branch_and_pre_flush_owned_snapshot',source_index:214});
/* New compilation units get the same whole fenced includes as the first batch. */
for(const[name,value]of pending){if(!value.source.includes('#include "web-ui-residual-text.h"')){const inc=value.source.match(/^#include [^\r\n]+/m);assert.ok(inc,name);const at=inc.index+inc[0].length;value.source=value.source.slice(0,at)+block('\n#include "web-ui-residual-text.h"\n#include "web-death-cause.h"')+value.source.slice(at);}
 assert.equal(stripResidual(value.source),stripResidual(value.before),name+' added-only byte proof');
 const baseline=path.join(root,dir,'source-baseline',name);if(fs.existsSync(baseline))assert.equal(stripResidual(value.source),fs.readFileSync(baseline,'utf8'),name+' immutable whole-phase baseline');
 assert.equal(read('logic/'+name),value.before,'concurrent source write '+name);
}
for(const[name,value]of pending){const baseline=path.join(root,dir,'source-baseline',name);if(!fs.existsSync(baseline)){fs.writeFileSync(baseline,value.before);manifest.source_before_sha256['logic/'+name]=createHash('sha256').update(value.before).digest('hex');}
 assert.equal(read('logic/'+name),value.before,'concurrent source write '+name);fs.writeFileSync(path.join(root,'logic',name),value.source);if(!manifest.source_files.includes('logic/'+name))manifest.source_files.push('logic/'+name);}
manifest.connections.push(...connections);manifest.remaining_assigned_source_indices=[];manifest.status='source_connected_unbuilt';manifest.assigned_source31_gold='already independently bound; no duplicate hook';
fs.writeFileSync(path.join(root,dir,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({files:manifest.source_files.length,connections:manifest.connections.length,remaining_assigned_sources:[]}));
