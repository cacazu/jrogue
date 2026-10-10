// SPDX-License-Identifier: GPL-2.0-only
// Add source branch facts without changing original bytes or evaluations.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {functionSpan} from '../stat-message-data/integrate.mjs';
import {stripEffect} from '../effect-description-data/integrate.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const tag=s=>'/* AB_EFFECT_BEGIN */'+s+'/* AB_EFFECT_END */';
const block=(s,nl)=>tag(nl+'#ifdef __EMSCRIPTEN__'+nl+s+nl+'#endif'+nl);
function one(s,a,b){if(s.split(a).length!==2)throw Error('Non-unique native anchor '+a);return s.replace(a,b);}
function after(s,a,b,nl){return one(s,a,a+block(b,nl));}
function before(s,a,b,nl){return one(s,a,block(b,nl)+a);}
function callSpans(s,name){const out=[],re=new RegExp('\\b'+name+'\\(','g');for(let m;(m=re.exec(s));){const open=m.index+name.length;let depth=1,mode='',escape=false,start=open+1,args=[];for(let i=start;i<s.length;i++){const c=s[i],n=s[i+1];if(mode==='/*'){if(c==='*'&&n==='/'){mode='';i++;}continue;}if(mode==='//'){if(c==='\n')mode='';continue;}if(mode==='"'||mode==="'"){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===mode)mode='';continue;}if(c==='/'&&(n==='*'||n==='/')){mode=c+n;i++;continue;}if(c==='"'||c==="'"){mode=c;continue;}if(c==='(')depth++;else if(c===')'){if(!--depth){args.push([start,i]);out.push({start:m.index,end:i+1,args});re.lastIndex=i+1;break;}}else if(c===','&&depth===1){args.push([start,i]);start=i+1;}}}return out;}
function afterCalls(s,name,select,nl){for(const call of callSpans(s,name).reverse()){const args=call.args.map(([a,b])=>s.slice(a,b).trim()),hook=select(args);if(!hook)continue;if(s[call.end]!==';')throw Error('Native call is not a complete statement');s=s.slice(0,call.end+1)+block(hook,nl)+s.slice(call.end+1);}return s;}
const id=role=>'angband.effect_info.spell_preview.'+role;
const leaf=(role,first=null,value='0',second=null,secondValue='0')=>' ab_spell_preview_leaf('+JSON.stringify(id(role))+','+(first?JSON.stringify(first):'NULL')+','+value+','+(second?JSON.stringify(second):'NULL')+','+secondValue+');';
function dice(s,nl){return afterCalls(s,'strnfmt',a=>{if(a[2]==='"%d"')return leaf('dice.base','base',a[3]);if(a[2]==='"+"')return leaf('dice.plus');if(a[2]==='"d%d"')return leaf('dice.single','sides',a[3]);if(a[2]==='"%dd%d"')return leaf('dice.roll','dice',a[3],'sides',a[4]);throw Error('Unknown original dice branch '+a[2]);},nl);}
function effect(s,nl){
 s=after(s,'size_t offset = strlen(p);',' ab_spell_preview_special("angband.effect_info.grammar.empty",NULL,0,sizeof(special));',nl);
 s=afterCalls(s,'my_strcpy',a=>{if(a[0]!=='special')return null;const role={'"random"':'special.random','", rad 2"':'special.sphere_default','"rad 2"':'special.ball_default'}[a[1]];if(!role)throw Error('Unknown native special literal '+a[1]);return ' ab_spell_preview_special('+JSON.stringify(id(role))+',NULL,0,sizeof(special));';},nl);
 s=afterCalls(s,'strnfmt',a=>{
  if(a[0]==='special'){const f={'"/%d%%"':['special.heal','percent'],'", rad %d"':['special.radius','radius'],'", len %d"':['special.length','length'],'"x%d"':['special.swarm','count']}[a[2]];if(!f)throw Error('Unknown native special format '+a[2]);return ' ab_spell_preview_special('+JSON.stringify(id(f[0]))+','+JSON.stringify(f[1])+','+a[3]+',sizeof(special));';}
  if(a[0]!=='p + offset')return null;
  if(a[2]==='";"')return leaf('separator');
  if(a[2]==='" %s "')return ' ab_spell_preview_label(effect->index);';
  if(a[2]==='"%s"')return ' ab_spell_preview_append_special();';
  throw Error('Unknown native preview append '+a[2]);
 },nl);return s;
}
function info(s,nl){s=before(s,"p[0] = '\\0';",' ab_spell_preview_begin(spell_index,len);',nl);const at=s.lastIndexOf('}');return s.slice(0,at)+block(' ab_spell_preview_finish();',nl)+s.slice(at);}
function row(s,nl){const old='ab_semantic_event_emit_control(&event);';return after(s,old,
 ' if(state==AB_SPELL_WORKED){'+nl+'  snprintf(widget,sizeof(widget),"row.%d.info",spell->sidx);'+nl+'  ab_semantic_event_begin(&event,"'+id('description')+'","ui","spells",widget,0,-1);'+nl+'  ab_spell_preview_emit(&event,spell->sidx);'+nl+' }else{'+nl+'  snprintf(widget,sizeof(widget),"__clear:row.%d.info",spell->sidx);'+nl+'  ab_spell_control(widget);'+nl+'  ab_spell_preview_reset();'+nl+' }',nl);}
const files={'logic/player-spell.c':[['append_random_value_string',dice],['spell_effect_append_value_info',effect],['get_spell_info',info]],'logic/web-spell-text.c':[['ab_spell_row',row],['ab_spell_menu_end',(s,nl)=>after(s,'ab_spell_control("__reset");',' ab_spell_preview_reset();',nl)]]};
const snapshots=[],prepared=[];
for(const [file,edits]of Object.entries(files)){const target=path.join(root,file),current=fs.readFileSync(target,'utf8'),baseline=stripEffect(current);let source=baseline;const nl=baseline.includes('\r\n')?'\r\n':'\n';for(const [fn,edit]of edits){const [start,end]=functionSpan(source,fn),body=source.slice(start,end);snapshots.push({file,function:fn,sha256:sha(body),base64:Buffer.from(body).toString('base64')});const changed=edit(body,nl);if(stripEffect(changed)!==body)throw Error('Native function parity '+fn);source=source.slice(0,start)+changed+source.slice(end);}source=tag('#include "web-spell-preview.h"'+nl)+source;if(stripEffect(source)!==baseline)throw Error('Native whole-file parity '+file);prepared.push({target,current,source});}
for(const p of prepared)if(fs.readFileSync(p.target,'utf8')!==p.current)throw Error('Concurrent owner mutation '+p.target);
for(const p of prepared)fs.writeFileSync(p.target,p.source);
fs.writeFileSync(path.join(here,'producer-snapshots.json'),JSON.stringify({schema_version:1,upstream_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',snapshots},null,2)+'\n');
console.log(JSON.stringify({files:prepared.length,functions:snapshots.length,native_byte_parity:true}));
