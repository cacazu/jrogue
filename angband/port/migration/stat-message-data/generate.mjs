// SPDX-License-Identifier: GPL-2.0-only
// Source-identified lexemes; no runtime English lookup or native execution.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const commit='f3082213b73f3e463e3d0d60bff4b00462beae6e';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const english={},japanese={},entries={},lexemes=[],bindings={stats:[],projections:[]};
function add(id,en,ja,parameters=[],sources=[]) {
 if(Object.hasOwn(english,id)&&english[id]!==en)throw Error('Conflicting source '+id);
 english[id]=en;japanese[id]=ja;entries[id]={parameters,sources};return id;
}
function lexical(id,en,ja,source) {add(id,en,ja,[],[source]);lexemes.push({id,english:en,japanese:ja,source});return id;}
const props=read('data/gamedata/object_property.txt').split(/\r?\n/);
const statNames=[...read('logic/list-stats.h').matchAll(/^STAT\(([^)]+)\)/gm)].map(v=>v[1]);
const positive=['力強さ','頭の冴え','賢明さ','器用さ','健康'];
const negative=['力の弱さ','頭の鈍さ','判断の浅はかさ','不器用さ','体調の悪さ'];
const projectEn=['strong','bright','wise','agile','hale'],projectJa=['力強さ','頭の冴え','賢明さ','機敏さ','丈夫さ'];
for(let index=0;index<statNames.length;index++) {
 const code=statNames[index],line=props.indexOf('code:'+code);
 if(line<0)throw Error('Missing property '+code);
 let end=props.findIndex((text,i)=>i>line&&text.startsWith('name:'));if(end<0)end=props.length;
 const record={index,code};
 for(const [field,role,ja]of [['neg-adjective','negative',negative[index]],['adjective','positive',positive[index]]]) {
  const at=props.findIndex((text,i)=>i>=line&&i<end&&text.startsWith(field+':'));
  if(at<0)throw Error('Missing '+field+' '+code);
  record[role+'_id']=lexical('game.stat.adjective.'+code.toLowerCase()+'.'+role,props[at].slice(field.length+1),ja,
   {file:'lib/gamedata/object_property.txt',line:at+1,field,code,value:props[at].slice(field.length+1)});
 }
 const native=read('logic/project-player.c'),needle='k = STAT_'+code+'; act = "'+projectEn[index]+'";';
 const at=native.indexOf(needle);if(at<0)throw Error('Missing original projected stat '+code);
 const census=JSON.parse(read('migration/residual-message-review.json')).groups.find(v=>v.role==='stat_effect_damage_probe').callsites.find(v=>v.source_index===194);
 const call=native.indexOf('msg("You\'re not as %s as you used to be...", act);',at);
 if(call<at)throw Error('Missing exact original projected-stat message');
 const upstreamLine=census.source.upstream_line-(native.slice(at,call).split('\n').length-1);
 record.project_id=lexical('game.stat.adjective.'+code.toLowerCase()+'.project',projectEn[index],projectJa[index],
  {file:'src/project-player.c',line:upstreamLine,field:'act',code,value:projectEn[index]});
 bindings.stats.push(record);
}
const translations={
 acid:'酸',lightning:'稲妻',fire:'炎',cold:'冷気',poison:'毒',light:'光',dark:'闇',sound:'音',shards:'破片',nexus:'因果',nether:'地獄',
 chaos:'混沌',disenchantment:'劣化',water:'水',ice:'氷',gravity:'重力',inertia:'慣性',force:'衝撃',time:'時間',plasma:'プラズマ',
 'a meteor':'隕石','a missile':'魔法の弾',mana:'魔力','a holy orb':'聖なる球','an arrow':'矢',darkness:'闇',
 'rock remover':'岩の破壊','destroys doors':'扉の破壊','disables traps':'罠の無効化','creates doors':'扉の生成','creates traps':'罠の生成',
 'teleports undead away':'アンデッドの転移','teleports evil monsters away':'邪悪なモンスターの転移',
 'teleports monsters with a spirit away':'魂のあるモンスターの転移','teleports monsters away':'モンスターの転移',
 'turns undead':'アンデッドへの恐怖','frightens evil monsters':'邪悪なモンスターへの恐怖','scares living monsters':'生きているモンスターへの恐怖',
 'causes monsters to flee':'モンスターへの恐怖','damages undead':'アンデッドへのダメージ','damages evil monsters':'邪悪なモンスターへのダメージ',
 'damages all monsters':'モンスターへのダメージ','attempts to put undead to sleep':'アンデッドへの眠り',
 'attempts to put evil monsters to sleep':'邪悪なモンスターへの眠り','attempts to put all monsters to sleep':'モンスターへの眠り',
 'hastes, heals and magically duplicates monsters':'モンスターの加速・回復・魔法による複製',
 'polymorphs monsters into other kinds of creatures':'モンスターの変身','heals monsters':'モンスターの回復',
 'hastes monsters':'モンスターの加速','attempts to slow monsters':'モンスターの減速',
 'attempts to confuse monsters':'モンスターの混乱','attempts to hold monsters still':'モンスターの麻痺',
 'attempts to stun monsters':'モンスターの朦朧','damages living monsters':'生きているモンスターへのダメージ',
 'kills monsters below a hitpoint threshold':'弱ったモンスターの抹殺',
 something:'何か',noise:'騒音','something sharp':'何か鋭いもの','something strange':'何か奇妙なもの',
 'something cold':'何か冷たいもの','something hard':'何か硬いもの'
};
const canonical=[...read('logic/list-elements.h').matchAll(/^ELEM\(([^)]+)\)/gm),...read('logic/list-projections.h').matchAll(/^PROJ\(([^)]+)\)/gm)].map(v=>v[1]);
const lines=read('data/gamedata/projection.txt').split(/\r?\n/),coalesced=new Map();
for(const [index,code]of canonical.entries()) {
 const start=lines.indexOf('code:'+code);if(start<0)throw Error('Missing projection '+code);
 let stop=lines.findIndex((text,i)=>i>start&&text.startsWith('code:'));if(stop<0)stop=lines.length;
 const record={index,code};
 for(const [field,role]of [['desc','description'],['blind-desc','blind']]) {
  const at=lines.findIndex((text,i)=>i>=start&&i<stop&&text.startsWith(field+':'));
  if(at<0)throw Error('Missing projection field '+code+' '+field);
  const en=lines[at].slice(field.length+1),ja=translations[en];if(ja===undefined)throw Error('Unreviewed lexical translation '+en);
  const key=role+'\0'+en,id=coalesced.get(key)??('game.stat.projection.'+role+'.'+en.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));
  const source={file:'lib/gamedata/projection.txt',line:at+1,field,code,value:en};
  if(!coalesced.has(key)){lexical(id,en,ja,source);coalesced.set(key,id);}else entries[id].sources.push(source);
  record[role+'_id']=id;
 }
 bindings.projections.push(record);
}
const text=(name,en,ja,params=[])=>add('game.stat.'+name,en,ja,params);
const adjective=[{name:'adjective',type:'localized_text'}],damage=[{name:'damage',type:'integer'}];
text('message.courage','{actor} recovers {possessive} courage.','{actor}は{possessive}勇気を取り戻した。',[{name:'actor',type:'MonsterDescription'},{name:'possessive',type:'MonsterDescription'}]);
text('message.restore','You feel less {adjective}.','{adjective}が和らいだ。',adjective);
text('message.sustained','You feel very {adjective} for a moment, but the feeling passes.','一瞬、{adjective}を強く感じたが、すぐに治まった。',adjective);
text('message.drain','You feel very {adjective}.','ひどい{adjective}を感じる。',adjective);
text('message.drain.with_damage','You feel very {adjective}. ({damage})','ひどい{adjective}を感じる。 ({damage})',[...adjective,...damage]);
text('message.lose','You feel very {adjective}.','ひどい{adjective}を感じる。',adjective);
text('message.gain','You feel very {adjective}!','{adjective}がぐんと増した！',adjective);
text('message.project_drain',"You're not as {adjective} as you used to be...",'以前ほどの{adjective}が感じられない……',adjective);
text('message.breathe','You breathe {projection}.','{projection}を吐いた。',[{name:'projection',type:'localized_text'}]);
text('message.projection_hit','You are hit by {projection}!','{projection}に襲われた！',[{name:'projection',type:'localized_text'}]);
text('summon.one','something','何か',[]);text('summon.many','many things','たくさんの何か',[]);
text('message.summon','You hear {subject} appear nearby.','近くに{subject}が現れる音がした。',[{name:'subject',type:'localized_text'}]);
for(const [key,en,ja]of [
 ['damage.crushed','You are severely crushed!','ひどく押し潰された！'],
 ['damage.uncursing','There is a bang and a flash!','爆発音と閃光が走った！'],
 ['damage.exertion','You cry out in sudden pain!','突然の痛みに悲鳴を上げた！'],
 ['damage.quake.empty','',''],['damage.quake.dodge','You nimbly dodge the blast!','爆発を素早く避けた！'],
 ['damage.quake.rubble','You are bashed by rubble!','瓦礫に打ち付けられた！'],
 ['damage.quake.squeezed','You are crushed between the floor and ceiling!','床と天井の間で押し潰された！']]) {
 text(key,en,ja);text(key+'.with_damage',en+' ({damage})',ja+' ({damage})',damage);
}
for(const plural of ['one','many'])text('message.probe.'+plural,'{actor} has {hp} hit point'+(plural==='many'?'s':'')+'.',
 '{actor}のヒットポイントは{hp}だ。',[{name:'actor',type:'MonsterDescription'},{name:'hp',type:'integer'}]);
const producers=JSON.parse(read('migration/residual-message-review.json')).groups.find(v=>v.role==='stat_effect_damage_probe').callsites;
const messageSources=[
 ['message.courage',[41,44]],['message.restore',[60]],['message.sustained',[61]],['message.drain',[62]],
 ['message.lose',[63]],['message.gain',[64]],['message.project_drain',[194]],['message.breathe',[46]],
 ['message.projection_hit',[195]],['message.summon',[68]],['summon.one',[68]],['summon.many',[68]],
 ['damage.crushed',[47]],['damage.uncursing',[57]],['damage.exertion',[184]],['damage.quake',[48]],['message.probe',[71]]
];
for(const [id,entry]of Object.entries(entries))if(!entry.sources.length) {
 const mapping=messageSources.find(([prefix])=>id==='game.stat.'+prefix||id.startsWith('game.stat.'+prefix+'.'));
 if(!mapping)throw Error('Missing exact producer provenance '+id);
 entry.sources=mapping[1].map(index=>{
  const call=producers.find(v=>v.source_index===index);if(!call)throw Error('Missing source-index '+index);
  return {file:call.source.file.replace(/^logic\//,'src/'),line:call.source.upstream_line,field:'message',
   value:call.original_english,source_index:index,branch:id,
   notes:'Source-index and original printf identify the unchanged native call; normalized template grammar is selected by the tagged source branch, never by matching formatted text.'};
 });
}
const sorted=object=>Object.fromEntries(Object.entries(object).sort(([a],[b])=>a.localeCompare(b)));
const outputs={
 'en.json':sorted(english),'ja.json':sorted(japanese),
 'schema.json':{schema_version:1,upstream_commit:commit,status:'source_connected_unbuilt',complete_game_translation:false,catalog_entries:Object.keys(entries).length,entries:sorted(entries)},
 'source-bindings.json':{schema_version:1,upstream_commit:commit,privacy_policy:'Blind projection lexemes coalesce across all exact source-equal fields. Numeric stat/projection identity remains private.',...bindings},
 'source-manifest.json':{schema_version:1,upstream_commit:commit,status:'source_connected_unbuilt',complete_game_translation:false,
  producers,lexemes,
  sources:['data/gamedata/object_property.txt','data/gamedata/projection.txt','logic/list-stats.h','logic/list-elements.h','logic/list-projections.h'].map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))}
};
const c=['/* Source-generated private canonical identities. Never serialized. */',
 'static const char *const ab_stat_adjectives[3][STAT_MAX] = {',
 ...['negative','positive','project'].map(role=>' {'+bindings.stats.map(v=>JSON.stringify(v[role+'_id'])).join(',')+'},'),'};',
 'static const char *ab_stat_projection_id(int type,bool blind) { switch(type) {',
 ...bindings.projections.map(v=>' case PROJ_'+v.code+': return blind?'+JSON.stringify(v.blind_id)+':'+JSON.stringify(v.description_id)+';'),
 ' default:return NULL; } }',''].join('\n');
outputs['bindings.inc']=c;
const check=process.argv.includes('--check');
const provenanceOnly=process.argv.includes('--provenance-only');
for(const [file,value]of Object.entries(outputs)) {
 const data=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',target=path.join(here,file);
 if(check||(provenanceOnly&&!['schema.json','source-manifest.json'].includes(file))){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==data)throw Error('Stale source-derived '+file);}
 else fs.writeFileSync(target,data,'utf8');
}
console.log(JSON.stringify({catalog_entries:Object.keys(entries).length,stats:bindings.stats.length,projections:bindings.projections.length,producers:16,check}));
