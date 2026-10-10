// SPDX-License-Identifier: GPL-2.0-only
// Extract immutable source identities; never classifies a rendered preview.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {functionSpan} from '../stat-message-data/integrate.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const upstream=path.join(root,'migration/effect-description-data/upstream-snapshots');
const source=fs.readFileSync(path.join(upstream,'player-spell.c'),'utf8');
const list=fs.readFileSync(path.join(upstream,'list-effects.h'),'utf8');
const prefix='angband.effect_info.spell_preview.',en={},ja={},entries={},bindings=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const slots=s=>[...s.matchAll(/\{([a-z_]+)\}/g)].map(m=>m[1]).sort();
function split(s){let quote=false,escape=false,start=0,out=[];for(let i=0;i<s.length;i++){const c=s[i];if(escape){escape=false;continue;}if(quote&&c==='\\'){escape=true;continue;}if(c==='"')quote=!quote;else if(c===','&&!quote){out.push(s.slice(start,i).trim());start=i+1;}}out.push(s.slice(start).trim());return out;}
function add(id,english,japanese,parameters,sources){if(id in en)throw Error('Duplicate '+id);if(JSON.stringify(slots(english))!==JSON.stringify(slots(japanese)))throw Error('Placeholder parity '+id);en[id]=english;ja[id]=japanese;entries[id]={parameters,sources};}
function native(fn,literal){const [start,end]=functionSpan(source,fn),token=JSON.stringify(literal),at=source.slice(start,end).indexOf(token);if(at<0)throw Error('Missing native literal '+fn+' '+token);return {file:'src/player-spell.c',line:source.slice(0,start+at).split('\n').length,function:fn,value:literal};}
const translated={hurt:'被害',dam:'威力',heal:'回復',dur:'持続',range:'距離',rad:'半径',power:'効力',food:'栄養',blows:'打撃回数'};
const lines=list.split(/\r?\n/);
for(let i=0;i<lines.length;i++){if(!lines[i].startsWith('EFFECT('))continue;const line=i+1;let text=lines[i];while(!text.trimEnd().endsWith(')'))text+=' '+lines[++i].trim();const fields=split(text.match(/^EFFECT\((.*)\)\s*$/)[1]);if(fields.length!==7)throw Error('EFFECT field count');let id=null;if(fields[2]!=='NULL'){const info=JSON.parse(fields[2]);if(info){if(!(info in translated))throw Error('Unauthored native info label '+info);id=prefix+'label.'+info;if(!(id in en))add(id,info,translated[info],[],[]);entries[id].sources.push({file:'src/list-effects.h',line,code:fields[0],field:'info',value:info});}}bindings.push({code:fields[0],id});}
if(bindings.length!==112)throw Error('Canonical effects count');
const I='integer',L='localized_text';
for(const [role,english,japanese,names,fn,literal] of [
 ['label',' {label} ',' {label} ',[['label',L]],'spell_effect_append_value_info',' %s '],
 ['separator',';','；',[],'spell_effect_append_value_info',';'],
 ['dice.base','{base}','{base}',[['base',I]],'append_random_value_string','%d'],
 ['dice.plus','+','+',[],'append_random_value_string','+'],
 ['dice.single','d{sides}','d{sides}',[['sides',I]],'append_random_value_string','d%d'],
 ['dice.roll','{dice}d{sides}','{dice}d{sides}',[['dice',I],['sides',I]],'append_random_value_string','%dd%d'],
 ['special.heal','/{percent}%','/{percent}%',[['percent',I]],'spell_effect_append_value_info','/%d%%'],
 ['special.random','random','無作為',[],'spell_effect_append_value_info','random'],
 ['special.radius',', rad {radius}','、半径{radius}',[['radius',I]],'spell_effect_append_value_info',', rad %d'],
 ['special.sphere_default',', rad 2','、半径2',[],'spell_effect_append_value_info',', rad 2'],
 ['special.ball_default','rad 2','半径2',[],'spell_effect_append_value_info','rad 2'],
 ['special.length',', len {length}','、長さ{length}',[['length',I]],'spell_effect_append_value_info',', len %d'],
 ['special.swarm','x{count}','×{count}',[['count',I]],'spell_effect_append_value_info','x%d']
])add(prefix+role,english,japanese,names.map(([name,type])=>({name,type})),[native(fn,literal)]);
const [start,end]=functionSpan(source,'get_spell_info'),handoff=source.indexOf('spell_effect_append_value_info(effect, p, len, &ist);',start);if(handoff<0||handoff>=end)throw Error('Missing preview handoff');
add(prefix+'description','{description}','{description}',[{name:'description',type:'EffectDescription'}],[{file:'src/player-spell.c',line:source.slice(0,handoff).split('\n').length,function:'get_spell_info',field:'owned_source_graph_handoff',value:'spell_effect_append_value_info(effect, p, len, &ist);'}]);
const sorted=x=>Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)));
const outputs={'en.json':sorted(en),'ja.json':sorted(ja),'schema.json':{schema_version:1,upstream_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',status:'source_connected_unbuilt',entries:sorted(entries)},'source-bindings.json':{schema_version:1,effects:bindings},'source-manifest.json':{schema_version:1,upstream_commit:'f3082213b73f3e463e3d0d60bff4b00462beae6e',status:'source_connected_unbuilt',complete_game_translation:false,records:bindings,source_hashes:[{file:'src/player-spell.c',sha256:sha(source)},{file:'src/list-effects.h',sha256:sha(list)}]},'bindings.inc':['/* Canonical source field identities; indices stay private. */','static const struct ab_effect_preview_label ab_effect_preview_labels[] = {',...bindings.map(r=>' {EF_'+r.code+','+(r.id?JSON.stringify(r.id):'NULL')+'},'),'};',''].join('\n')};
const check=process.argv.includes('--check');for(const [file,value]of Object.entries(outputs)){const content=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',dest=path.join(here,file);if(check){if(fs.readFileSync(dest,'utf8')!==content)throw Error('Stale '+file);}else fs.writeFileSync(dest,content);}
console.log(JSON.stringify({ids:Object.keys(en).length,effects:bindings.length,check}));
