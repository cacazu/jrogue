// SPDX-License-Identifier: GPL-2.0-only
// Source-identity extraction only. No runtime matching of English output.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {functionSpan} from '../stat-message-data/integrate.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const commit='f3082213b73f3e463e3d0d60bff4b00462beae6e';
const en={},ja={},entries={},records=[],maps={effects:[],projections:[],timed:[],stats:[],summons:[]};
const prefix='angband.effect_info.';
function split(s){let quote=false,escape=false,start=0,out=[];for(let i=0;i<s.length;i++){const c=s[i];if(escape){escape=false;continue;}if(quote&&c==='\\'){escape=true;continue;}if(c==='"')quote=!quote;else if(c===','&&!quote){out.push(s.slice(start,i).trim());start=i+1;}}out.push(s.slice(start).trim());return out;}
const literal=s=>JSON.parse(s);
const fields={DICE:['dice'],HEAL:['dice','minimum'],CONST:['experience'],FOOD:['food_action','turns','percent'],CURE:['condition'],TIMED:['condition','duration'],STAT:['stat'],SEEN:['projection'],SUMM:['target'],TELE:['subject','distance'],QUAKE:['radius'],BALL:['projection','radius','dice'],SPOT:['projection','radius','full_radius','dice'],BREATH:['projection','width','dice'],SHORT:['projection','length','dice'],LASH:['projection','length'],BOLT:['projection'],BOLTD:['projection','dice'],TOUCH:['projection'],NONE:[]};
const menus={FOOD:['action','argument'],CURE:['condition'],TIMED:['condition'],STAT:['stat'],SEEN:['projection'],SUMM:['target'],TELE:['subject','distance'],BALL:['projection'],SPOT:['projection'],BREATH:['projection'],SHORT:['projection'],LASH:['projection'],BOLT:['projection'],BOLTD:['projection'],TOUCH:['projection']};
const numeric=new Set(['experience','radius','full_radius','width','length']);
function normalized(s,names){let at=0;const text=s.replace(/%%|%[sd]/g,token=>token==='%%'?'%':'{'+names[at++]+'}');if(at!==names.length)throw Error('printf/schema disagreement '+s);return text;}
const slots=s=>[...s.matchAll(/\{([a-z_]+)\}/g)].map(m=>m[1]).sort();
function add(id,english,japanese,parameters=[],sources=[]){if(id in en)throw Error('Duplicate '+id);if(JSON.stringify(slots(english))!==JSON.stringify(slots(japanese)))throw Error('JA slots '+id);en[id]=english;ja[id]=japanese;entries[id]={parameters,sources};}
const author=json('migration/effect-description-data/ja-authored.json');
const lines=read('logic/list-effects.h').split(/\r?\n/);
for(let i=0;i<lines.length;i++){
 if(!lines[i].startsWith('EFFECT('))continue;const sourceLine=i+1;let source=lines[i];while(!source.trimEnd().endsWith(')'))source+=' '+lines[++i].trim();
 const m=source.match(/^EFFECT\((.*)\)\s*$/);if(!m)throw Error('Unparsed EFFECT '+sourceLine);
 const a=split(m[1]);if(a.length!==7)throw Error('EFFECT fields '+(i+1));
 const code=a[0],key=code.toLowerCase(),flag=a[4].replace('EFINFO_','');
 const description=literal(a[5]),menu=literal(a[6]),translated=author[key];
 if(!translated)throw Error('Missing authored '+code);
 const descNames=description?fields[flag]:[],menuNames=menu?(menus[flag]??[]):[];
 const descId=description?prefix+'description.'+key:null,menuId=menu?prefix+'menu.'+key:null;
 const repair=['MOVE_ATTACK','MELEE_BLOWS','SWEEP'].includes(code);
 for(const [role,value,names,id]of [['description',description,descNames,descId],['menu',menu,menuNames,menuId]])if(id){
  const nestedBuffers=new Set(role==='description'?['dice','minimum','duration','turns','percent','distance','projection']:['distance']);
  const params=names.map(name=>({name,type:numeric.has(name)?'integer':nestedBuffers.has(name)&&!(name==='projection'&&flag!=='BREATH')?'EffectDescription':'localized_text'}));
  const source={file:'src/list-effects.h',line:sourceLine,field:role,code,value};
  if(repair&&role==='description')source.browser_presentation_fix='EFINFO_DICE passes an already-computed char dice_string; replace its invalid %d slot with %s by exact EF enum only. Native original remains unchanged.';
  add(id,normalized(value,names),translated[role],params,[source]);
 }
 records.push({code,flag,args:Number(a[3]),description,menu,source_line:sourceLine,description_id:descId,menu_id:menuId,presentation_fix:repair});
 maps.effects.push({code,description_id:descId,menu_id:menuId});
}
if(records.length!==112)throw Error('Expected112 canonical effects');
function codeRecords(file,field){const out=[];let current=null;for(const [i,line]of read(file).split(/\r?\n/).entries()){if(line.startsWith(field+':')){current={code:line.slice(field.length+1),fields:{},source_line:i+1};out.push(current);}else if(current&&!line.startsWith('#')&&line.includes(':')){const at=line.indexOf(':');current.fields[line.slice(0,at)]={value:line.slice(at+1),line:i+1};}}return out;}
const statBindings=json('migration/stat-message-data/source-bindings.json'),statJa=json('migration/stat-message-data/ja.json');
const domain=json('migration/domain-text-data/bindings.json'),domainJa=json('migration/domain-text-data/ja.json');
const knowledge=json('migration/knowledge-text-data/source-bindings.json'),knowledgeJa=json('migration/knowledge-text-data/ja.json');
// Each exact source record is selected by its canonical code, not its English spelling.
const extraProjection={
 'frost':'冷気','holy power':'聖なる力','arrows':'矢','meteor':'隕石','magical energy':'魔力','weak light':'弱い光','poison gas':'毒ガス','the elements':'諸元素',
 'venom':'毒液','icicles':'氷柱','living fire':'生ける炎','brightness':'輝き','blackness':'暗黒','razors':'刃','withering':'衰弱','ruination':'崩壊','dislocation':'転位','lassitude':'倦怠','confusion':'混乱','meteoric iron':'隕鉄','raw magic':'生の魔力','unmagic':'魔力消散','impact':'衝撃'
};
const coalesced=new Map();
function lexical(role,raw,translation,source){if(translation===undefined)throw Error('Unauthored '+role+' '+raw);if(!raw)return prefix+'grammar.empty';const identity=role+'\0'+raw;let id=coalesced.get(identity);if(id){entries[id].sources.push(source);return id;}id=prefix+'lexeme.'+role+'.'+raw.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');add(id,raw,translation,[],[source]);coalesced.set(identity,id);return id;}
for(const record of codeRecords('data/gamedata/projection.txt','code')){
 const old=statBindings.projections.find(p=>p.code===record.code);if(!old)throw Error('Unmapped PROJ '+record.code);
 const row={code:record.code,index:old.index};
 for(const [role,field]of [['description','desc'],['player','player-desc'],['lash','lash-desc']]){
  const f=record.fields[field];if(!f){row[role+'_id']=prefix+'grammar.empty';continue;}
  let translated=role==='description'?statJa[old.description_id]:extraProjection[f.value];
  if(translated===undefined){const other=statBindings.projections.find(p=>read('migration/stat-message-data/en.json')&&JSON.parse(read('migration/stat-message-data/en.json'))[p.description_id]===f.value);if(other)translated=statJa[other.description_id];}
  row[role+'_id']=lexical('projection_'+role,f.value,translated,{file:'lib/gamedata/projection.txt',line:f.line,field,code:record.code,value:f.value});
 }
 maps.projections.push(row);
}
for(const record of codeRecords('data/gamedata/player_timed.txt','name')){
 const native=domain.records.player_timed.find(p=>p.identity===record.code),f=record.fields.desc;
 if(!native||!f)throw Error('Unmapped timed '+record.code);
 const selected=native.fields.description;
 if(!selected)throw Error('No timed desc '+record.code);
 const id=lexical('timed',f.value,domainJa[typeof selected==='string'?selected:selected.id],{file:'lib/gamedata/player_timed.txt',line:f.line,field:'desc',code:record.code,value:f.value});
 maps.timed.push({code:record.code,id});
}
for(const row of statBindings.stats){
 const props=codeRecords('data/gamedata/object_property.txt','name'),record=props.find(p=>p.fields.type?.value==='stat'&&p.fields.code?.value===row.code);
 const binding=knowledge.object_properties.find(p=>p.type==='stat'&&p.type_index===row.index);
 if(!record||!binding)throw Error('Unmapped stat name '+row.code);
 const selected=binding.fields.name,oldId=typeof selected==='string'?selected:selected?.id;
 const id=lexical('stat',record.code,knowledgeJa[oldId],{file:'lib/gamedata/object_property.txt',line:record.source_line,field:'name',code:row.code,value:record.code});
 maps.stats.push({code:row.code,id});
}
const summonJa=['モンスター1体','同族のモンスター','モンスター1体','モンスター','動物','蜘蛛','ハウンド','ヒドラ','アイヌア','デーモン','アンデッド','ドラゴン','上位デーモン','上位アンデッド','古代ドラゴン','指輪の幽鬼','ユニーク・モンスター'];
for(const [index,record]of codeRecords('data/gamedata/summon.txt','name').entries()){
 const f=record.fields.desc;if(!f)throw Error('No summon desc');
 const id=lexical('summon',f.value,summonJa[index],{file:'lib/gamedata/summon.txt',line:f.line,field:'desc',code:record.code,value:f.value});maps.summons.push({index,code:record.code,id});
}
const nativeFormats={
 'dice.base':'%d','dice.roll':'%dd%d','dice.base_roll':'%d+%dd%d','dice.multiplied':'%d*(%dd%d)','dice.multiplied_base':'%d+%d*(%dd%d)',
 'healing.minimum':' (or %d%%, whichever is greater)','damage.boost':', which your device skill increases by %d%%','damage.average':' for an average of %d.%d damage','teleport.grids':'%d grids'
};
function grammarSource(role,english,nativeFunction){
 let file='effects-info.c',fn=nativeFunction;
 if(role.startsWith('prefix.')){file=role==='prefix.shape'?'ui-knowledge.c':'obj-info.c';fn=role==='prefix.shape'?'shape_lore_append_change_effects':'describe_effect';}
 else if(role==='statement_end'){file='obj-info.c';fn='describe_effect';}
 else if(role.startsWith('menu.')){file='ui-effect.c';fn=role==='menu.prompt'?'effect_menu_select':'effect_menu_new';}
 else if(role.startsWith('food.menu.')||['teleport.some_distance','teleport.other'].includes(role)){fn='effect_get_menu_name';}
 else if(['join.or','join.oxford_or'].includes(role))fn='create_nested_effect_description';
 const raw=nativeFormats[role]??english,source=fs.readFileSync(path.join(here,'upstream-snapshots',file),'utf8'),[start,end]=functionSpan(source,fn),body=source.slice(start,end),token=JSON.stringify(raw);
 let at=body.indexOf(token);if(at<0)throw Error('Missing exact grammar native literal '+role+' '+token);
 return [{file:'src/'+file,line:source.slice(0,start+at).split('\n').length,function:fn,field:'selected_format_or_lexeme',value:raw}];
}
function grammar(role,english,japanese,names=[],nativeFunction='effect_describe'){add(prefix+'grammar.'+role,english,japanese,names.map(([name,type])=>({name,type})),grammarSource(role,english,nativeFunction));}
const I='integer',L='localized_text';
grammar('empty','','');
grammar('dice.base','{base}','{base}',[['base',I]],'format_dice_string');
grammar('dice.roll','{dice}d{sides}','{dice}d{sides}',[['dice',I],['sides',I]],'format_dice_string');
grammar('dice.base_roll','{base}+{dice}d{sides}','{base}+{dice}d{sides}',[['base',I],['dice',I],['sides',I]],'format_dice_string');
grammar('dice.multiplied','{multiplier}*({dice}d{sides})','{multiplier}×({dice}d{sides})',[['multiplier',I],['dice',I],['sides',I]],'format_dice_string');
grammar('dice.multiplied_base','{base}+{multiplier}*({dice}d{sides})','{base}+{multiplier}×({dice}d{sides})',[['base',I],['multiplier',I],['dice',I],['sides',I]],'format_dice_string');
grammar('healing.minimum',' (or {percent}%, whichever is greater)','（または最大HPの{percent}%のうち大きい方）',[['percent',I]]);
grammar('damage.boost',', which your device skill increases by {percent}%','（魔道具技能により{percent}%増加）',[['percent',I]],'append_damage');
grammar('damage.average',' for an average of {whole}.{tenth} damage','、平均ダメージ{whole}.{tenth}',[['whole',I],['tenth',I]],'append_damage');
for(const [key,english,japanese]of [
 ['join.comma',', ','、'],['join.and',' and ','、さらに'],['join.or',' or ','、または'],['join.oxford_or',', or ','、または'],['random','randomly ','無作為に'],
 ['food.feed','feeds you','栄養を与える'],['food.use','uses enough food value','栄養を消費する'],['food.leave','leaves you nourished','栄養状態を維持する'],
 ['food.menu.feed','feed','栄養補給'],['food.menu.increase','increase','増加'],['food.menu.become','become','状態変更'],['food.menu.leave','leave','状態維持'],
 ['food.menu.yourself','yourself','自分'],['food.menu.hunger','hunger','空腹'],['food.menu.bloated','bloated','食べ過ぎ'],['food.menu.satisfied','satisfied','満腹'],['food.menu.hungry','hungry','空腹'],['food.menu.nourished','nourished','良好な栄養'],
 ['teleport.player','you','自分'],['teleport.monster','a monster','モンスター1体'],['teleport.other','other','他者'],['teleport.level_distance','a level-dependent distance','階層に応じた距離'],['teleport.some_distance','some distance','一定の距離'],
 ['prefix.eaten','When eaten, it ','食べると、'],['prefix.quaffed','When quaffed, it ','飲むと、'],['prefix.read','When read, it ','読むと、'],['prefix.activated','When activated, it ','発動すると、'],['prefix.aimed','When aimed, it ','狙いを定めて使うと、'],['prefix.shape','Changing into the shape ','この姿に変身すると、'],
 ['statement_end','.\n','。\n'],
 ['menu.random','one of the following at random','以下の効果から無作為に1つ'],['menu.prompt','Which effect? ','どの効果にしますか？ ']
])grammar(key,english,japanese);
grammar('teleport.grids','{distance} grids','{distance}マス',[['distance',I]]);
const objOriginal=fs.readFileSync(path.join(here,'upstream-snapshots/obj-info.c'),'utf8'),handoff='textblock_append_textblock(tb, tbe);',handoffStart=functionSpan(objOriginal,'describe_effect')[0],handoffAt=objOriginal.indexOf(handoff,handoffStart);
add(prefix+'description','{description}','{description}',[{name:'description',type:'EffectDescription'}],[{file:'src/obj-info.c',line:objOriginal.slice(0,handoffAt).split('\n').length,function:'describe_effect',field:'owned_source_graph_handoff',value:handoff,notes:'Adapter envelope is normalized; the unchanged source textblock append supplies the selected graph, not a completed English template.'}]);
const sorted=x=>Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)));
const c=['/* Source-generated canonical identities; numeric identities stay private. */','static const struct ab_effect_identity ab_effect_identities[] = {',...maps.effects.map(r=>' {EF_'+r.code+','+JSON.stringify(r.description_id)+','+JSON.stringify(r.menu_id)+'},'),'};','static const struct ab_effect_projection_identity ab_effect_projection_ids[] = {',...maps.projections.map(r=>' {PROJ_'+r.code+','+JSON.stringify(r.description_id)+','+JSON.stringify(r.player_id)+','+JSON.stringify(r.lash_id)+'},'),'};','static const struct ab_effect_lexical_identity ab_effect_timed_ids[] = {',...maps.timed.map(r=>' {TMD_'+r.code+','+JSON.stringify(r.id)+'},'),'};','static const struct ab_effect_lexical_identity ab_effect_stat_ids[] = {',...maps.stats.map(r=>' {STAT_'+r.code+','+JSON.stringify(r.id)+'},'),'};','static const char *const ab_effect_summon_ids[] = {',...maps.summons.map(r=>' '+JSON.stringify(r.id)+','),'};',''].join('\n').replace(/\bnull\b/g,'NULL');
const outputs={'en.json':sorted(en),'ja.json':sorted(ja),'schema.json':{schema_version:1,upstream_commit:commit,status:'source_connected_unbuilt',complete_game_translation:false,catalog_entries:Object.keys(en).length,entries:sorted(entries)},'source-bindings.json':{schema_version:1,upstream_commit:commit,...maps},'source-manifest.json':{schema_version:1,upstream_commit:commit,status:'source_connected_unbuilt',complete_game_translation:false,records,format_cases:Object.keys(fields),description_count:records.filter(r=>r.description).length,menu_count:records.filter(r=>r.menu).length,sources:['logic/list-effects.h','logic/effects-info.c','data/gamedata/projection.txt','data/gamedata/player_timed.txt','data/gamedata/summon.txt','data/gamedata/object_property.txt'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))})),official_sources:json('migration/effect-description-data/upstream-source-lock.json').records},'bindings.inc':c};
const check=process.argv.includes('--check');for(const [file,value]of Object.entries(outputs)){const text=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',dest=path.join(here,file);if(check){if(fs.readFileSync(dest,'utf8')!==text)throw Error('Stale '+file);}else fs.writeFileSync(dest,text);}
console.log(JSON.stringify({effects:records.length,descriptions:records.filter(r=>r.description).length,menus:records.filter(r=>r.menu).length,ids:Object.keys(en).length,check}));
