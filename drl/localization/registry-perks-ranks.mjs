/** Reviewed DRL perk/rank/requirement presentation metadata, GPL-2.0-only.
 * Original chaosforgeorg/drl tag0_10_11a, a6f965072b3a25b768c91dbced00367f1b57d865.
 * Original English fields, registry IDs, rank array ordering and progress mechanics
 * remain authoritative. This module neither executes Lua nor modifies game files.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanRegistrySource} from './registry-terms.mjs';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {render} from './render.mjs';
export const sourceCommit='a6f965072b3a25b768c91dbced00367f1b57d865';
const here=path.dirname(fileURLToPath(import.meta.url));
const ranksFile='bin/data/drl/ranks.lua';
const field=(english,japanese)=>({english,japanese,...(english===''?{identity:true}:{})});

const reviewedPerkFields={
  tired:{short:field('tired','疲労')},
  running:{short:field('running','走行')},
  berserk:{short:field('berserk','バーサーク')},
  inv:{short:field('invulnerable','無敵')},
  enviro:{short:field('enviro','環境防護')},
  light:{short:field('light','視界強化')},
  event_ice:{name:field('Frozen Hell','凍てつく地獄'),desc:field('The walls of this level have turned to ice.','この階の壁が氷に変わっている。')},
  event_perma:{name:field('Bulwark','堅牢な壁'),desc:field('The walls on this level are reinforced and cannot be destroyed.','この階の壁は補強されており、破壊できない。')},
  event_alarm:{name:field('Alarm','警報'),desc:field('An alarm has been triggered, all enemies are hunting you.','警報が作動し、すべての敵があなたを追っている。')},
  event_deadly_air:{name:field('Deadly Air','死の大気'),desc:field('The atmosphere is toxic, dealing damage over time to beings with more than 25% health.','大気が有毒で、体力が25%を超える生物は継続的にダメージを受ける。')},
  event_nuke:{name:field('Armed Nuke','起動した核爆弾'),desc:field('A thermonuclear bomb has been deployed on this level.','この階に熱核爆弾が設置されている。')},
  event_flood_acid:{name:field('Acid Flood','酸の洪水'),desc:field('Acid is flooding the level from one side.','この階の片側から酸があふれてくる。')},
  event_flood_lava:{name:field('Lava Flood','溶岩の洪水'),desc:field('Lava is flooding the level from one side.','この階の片側から溶岩があふれてくる。')},
  event_flood_blood:{name:field('Blood Flood','血の洪水'),desc:field('Blood is flooding the level from one side.','この階の片側から血があふれてくる。')},
  event_targeted:{name:field('Targeted','狙われた獲物'),desc:field('Enemies periodically teleport towards your position.','敵が定期的にあなたの位置へ向けてテレポートしてくる。')},
  event_explosion:{name:field('Bombardment','砲撃'),desc:field('The level is being bombarded with hellish mortars.','この階は地獄の迫撃砲による砲撃を受けている。')},
  event_explosion_lava:{name:field('Lava Bombardment','溶岩の砲撃'),desc:field('The level is being bombarded with napalm.','この階はナパーム弾による砲撃を受けている。')},
  event_darkness:{name:field('Pitch Black','漆黒'),desc:field('This floor is shrouded in darkness, reducing vision.','この階は闇に包まれ、視界が狭くなっている。')},
  perk_utrans_altfire:{name:field('',''),short:field('self-target','自分を標的'),desc:field('teleport yourself randomly','自分をランダムな場所へテレポートさせる')},
  perk_usubtle_altfire:{name:field('',''),short:field('invoke','力を解放'),desc:field('damage all visible enemies, at the costs health and tired','体力を消耗し、疲労状態になる代わりに、視界内のすべての敵にダメージを与える')},
  perk_uni_trigun_altreload:{short:field('Angel Arm','エンジェル・アーム'),desc:field('It will probably kill you','おそらく自分も命を落とす')},
  perk_uberetta_altreload:{short:field('fire mode','射撃モード'),desc:field('switch between single/burst/auto fire modes','単発・バースト・自動の射撃モードを切り替える')},
  perk_usjack_altreload:{short:field('trigger','引き金'),desc:field('switch between single/burst fire modes','単発・バーストの射撃モードを切り替える')},
  perk_udragon_altfire:{short:field('whirlwind','旋風'),desc:field('attack all adjacent enemies','隣接するすべての敵を攻撃する')},
  perk_spear_altfire:{short:field('holy flame','聖なる炎'),desc:field('explosion around self','自分の周囲に爆発を起こす')},
  perk_uscythe_altfire:{short:field('whisper of death','死のささやき'),desc:field('damage all enemies, at the cost of max health','最大体力を消耗する代わりに、すべての敵にダメージを与える')},
  perk_cursed:{name:field('',''),short:field('cursed','呪い'),desc:field('cannot be unequipped','装備を外せない')},
  perk_altfire_throw:{name:field('',''),short:field('throw','投擲'),desc:field('throws the melee weapon at a target','標的に近接武器を投げつける')},
  perk_altfire_rocketjump:{name:field('',''),short:field('rocketjump','ロケットジャンプ'),desc:field('fire at your feet with less damage and more knockback','足元に発射する。ダメージが減る代わりに、吹き飛ばす力が強くなる')},
  perk_altfire_single:{name:field('',''),short:field('single','単発'),desc:field('fires a single shot','一発だけ発射する')},
  perk_altfire_aimed:{name:field('',''),short:field('aimed','狙い撃ち'),desc:field('fires an aimed shot with +3 to hit, but double time taken','狙いを定めて命中率+3で撃つが、かかる時間は2倍になる')},
  perk_altfire_chainfire:{name:field('',''),short:field('chainfire','連続射撃'),desc:field('spins up to fire longer bursts','回転を上げて、より長いバースト射撃を行う')},
  perk_altreload_full:{name:field('',''),short:field('full','全装填'),desc:field('fully reloads the weapon (max 2.5s)','武器を満タンまで装填する（最大2.5秒）')},
  perk_altreload_nuke:{name:field('',''),short:field('overload','過負荷'),desc:field('overloads the nuclear reactor','原子炉を過負荷にする')},
  perk_altreload_overcharge:{name:field('',''),short:field('overcharge','過充電'),desc:field('boosts the weapon and destroys it after the next shot','武器を強化するが、次の一発を撃つと武器が壊れる')},
};

// Array identities are presentation-qualified keys, never replacement registry IDs.
const skillRanks=[
  ['private','Private','二等兵',82],
  ['private-first-class','Private FC','一等兵',88],
  ['lance-corporal','Lance Corporal','上等兵',94],
  ['corporal','Corporal','伍長',102],
  ['sergeant','Sergeant','軍曹',110],
  ['sergeant-major','Sergeant Major','曹長',119],
  ['warrant-officer','Warrant Officer','准尉',128],
  ['second-lieutenant','2nd Lieutenant','少尉',137],
  ['first-lieutenant','1st Lieutenant','中尉',146],
  ['captain','Captain','大尉',155],
  ['major','Major','少佐',164],
  ['lieutenant-colonel','Lt. Colonel','中佐',173],
  ['colonel','Colonel','大佐',182],
  ['brigadier-general','Br. General','准将',192],
  ['major-general','Mjr General','少将',201],
  ['lieutenant-general','Lt. General','中将',210],
  ['general','General','大将',219],
  ['marshal','Marshal','元帥',229],
  ['chaos-major','Chaos Major','混沌の少佐',238],
  ['chaos-lieutenant-colonel','Chaos Lt. Colonel','混沌の中佐',246],
  ['chaos-colonel','Chaos Colonel','混沌の大佐',254],
  ['chaos-brigadier-general','Chaos Br. General','混沌の准将',262],
  ['chaos-major-general','Chaos Mjr General','混沌の少将',270],
  ['chaos-lieutenant-general','Chaos Lt. General','混沌の中将',278],
  ['chaos-general','Chaos General','混沌の大将',286],
  ['chaos-marshal','Chaos Marshal','混沌の元帥',294],
  ['no-life-king','No-Life King','廃人王',302],
];
const experienceRanks=[
  ['human','Human','人間',312],
  ['former-human','Former Human','元人間',318],
  ['imp','Imp','インプ',324],
  ['demon','Demon','デーモン',333],
  ['cacodemon','Cacodemon','カコデーモン',343],
  ['mancubus','Mancubus','マンキュバス',353],
  ['hell-knight','Hell Knight','ヘルナイト',363],
  ['hell-baron','Hell Baron','バロン・オブ・ヘル',373],
  ['arch-vile','Arch-Vile','アーチヴァイル',383],
  ['cyberdemon','Cyberdemon','サイバーデーモン',393],
  ['apostle','Apostle','使徒',402],
];
const rankTokenOffsets={
  skill:[[2270,2279],[2332,2344],[2447,2463],[2571,2581],[2689,2699],[2860,2876],[3039,3056],[3218,3234],[3395,3411],[3573,3582],[3744,3751],[3912,3925],[4087,4096],[4291,4304],[4465,4478],[4639,4652],[4813,4822],[5017,5026],[5188,5201],[5309,5328],[5437,5452],[5561,5580],[5688,5707],[5815,5834],[5942,5957],[6066,6081],[6190,6204]],
  exp:[[6386,6393],[6444,6458],[6565,6570],[6719,6726],[6936,6947],[7169,7179],[7415,7428],[7661,7673],[7871,7882],[8077,8089],[8249,8258]],
};
const rankRecord=(kind,row,index)=>{
  const [meaning,english,japanese,line]=row;
  const [offset,endOffset]=rankTokenOffsets[kind][index];
  return {category:'rank',presentationKey:`${kind}:${index+1}`,originalRegistryId:kind,registryId:kind,registryIndex:index+1,scope:'base_game',field:'name',semanticId:`term.rank.${kind}.${meaning}.name`,english,japanese,source:{file:ranksFile,line,offset,endOffset,raw:JSON.stringify(english)}};
};
export const reviewedRankArrayFields=[...skillRanks.map((r,i)=>rankRecord('skill',r,i)),...experienceRanks.map((r,i)=>rankRecord('exp',r,i))];
export const reviewedMiscRegistryFields={
  perk:reviewedPerkFields,
  rank:Object.fromEntries(reviewedRankArrayFields.map(r=>[r.presentationKey,{name:field(r.english,r.japanese)}])),
  requirement:{}, // All four description fields are functions, represented below.
};

const parameter=(name,type,originalExpression,presentationExpression=originalExpression)=>({name,type,originalExpression,presentationExpression,evaluation:'once'});
const targetParameter=()=>parameter('target','string','core.being_plural( param, amount )',
  "ui.registry_text('being',param,'base_game',amount == 1 and 'name' or 'name_plural',core.being_plural(param,amount))");
const branch=(line,id,condition,originalReturnExpression,english,japanese,bindings)=>({line,id,condition,originalReturnExpression,english,japanese,bindings});

export const reviewedBadgeTierNames=[
  ['bronze','Bronze','銅'],['silver','Silver','銀'],['gold','Gold','金'],
  ['platinum','Platinum','プラチナ'],['diamond','Diamond','ダイヤモンド'],['angelic','Angelic','天使'],
].map(([meaning,english,japanese],i)=>({index:i+1,id:`term.badge-tier.${meaning}.name`,english,japanese,source:{file:ranksFile,line:69}}));
const tierExpression="ui.text(({'term.badge-tier.bronze.name','term.badge-tier.silver.name','term.badge-tier.gold.name','term.badge-tier.platinum.name','term.badge-tier.diamond.name','term.badge-tier.angelic.name'})[param],names[param])";
const tierParameter=()=>parameter('tier','string','names[param]',tierExpression);

/** Whole-function SHA/offset guards include every original branch and local value.
 * Return sites are the only presentation edits. In particular progress functions,
 * amount/param, condition semantics and original plural/tier English stay untouched.
 */
export const reviewedRequirementDescriptions=[
  {
    category:'requirement',registryId:'kill_total',scope:'base_game',field:'description',
    source:{file:ranksFile,line:12,endLine:18,offset:291,endOffset:484,sha256:'ee66630c5e0f4b86fd5f985794a5d3e5dec2ef6b25dd0ba4cc1dc336cfcdfd26'},
    signature:'function( amount, param )',
    branches:[
      branch(14,'requirement.kill-total.specific','param and param ~= ""','"kill {!"..amount.."} "..core.being_plural( param, amount )','kill {!{{amount}}} {{target}}','{{target}}を{!{{amount}}}体倒す',[parameter('amount','integer','amount'),targetParameter()]),
      branch(16,'requirement.kill-total.any','else','"kill {!"..amount.."} enemies"','kill {!{{amount}}} enemies','敵を{!{{amount}}}体倒す',[parameter('amount','integer','amount')]),
    ],
  },
  {
    category:'requirement',registryId:'kill_melee',scope:'base_game',field:'description',
    source:{file:ranksFile,line:30,endLine:36,offset:808,endOffset:1023,sha256:'c1562fa0662b8c18ce2a9b011f0ad35534e151b6b6f380ba4b9178b019159319'},
    signature:'function( amount, param )',
    branches:[
      branch(32,'requirement.kill-melee.specific','param and param ~= ""','"kill {!"..amount.."} "..core.being_plural( param, amount ).." in melee"','kill {!{{amount}}} {{target}} in melee','近接攻撃で{{target}}を{!{{amount}}}体倒す',[parameter('amount','integer','amount'),targetParameter()]),
      branch(34,'requirement.kill-melee.any','else','"kill {!"..amount.."} enemies in melee"','kill {!{{amount}}} enemies in melee','近接攻撃で敵を{!{{amount}}}体倒す',[parameter('amount','integer','amount')]),
    ],
  },
  {
    category:'requirement',registryId:'kill_pistol',scope:'base_game',field:'description',
    source:{file:ranksFile,line:48,endLine:54,offset:1350,endOffset:1575,sha256:'4c574cf99ea90d91a997f2b2c6e9ba1eda805155121cf0b5a45d4e754fae1523'},
    signature:'function( amount, param )',
    branches:[
      branch(50,'requirement.kill-pistol.specific','param and param ~= ""','"kill {!"..amount.."} "..core.being_plural( param, amount ).." with a pistol"','kill {!{{amount}}} {{target}} with a pistol','ピストルで{{target}}を{!{{amount}}}体倒す',[parameter('amount','integer','amount'),targetParameter()]),
      branch(52,'requirement.kill-pistol.any','else','"kill {!"..amount.."} enemies with a pistol"','kill {!{{amount}}} enemies with a pistol','ピストルで敵を{!{{amount}}}体倒す',[parameter('amount','integer','amount')]),
    ],
  },
  {
    category:'requirement',registryId:'aquire_badges',scope:'base_game',field:'description',
    source:{file:ranksFile,line:68,endLine:75,offset:1876,endOffset:2154,sha256:'f43f39d1c00098ece2a2ae80751f68ce0187b76cc121530531e849c74b644e74'},
    signature:'function( amount, param )',
    branches:[
      branch(71,'requirement.acquire-badges.one','amount == 1','"acquire {!one} "..names[param].." badge"','acquire {!one} {{tier}} badge','{!1}個の{{tier}}バッジを獲得する',[tierParameter()]),
      branch(73,'requirement.acquire-badges.total','else','"acquire a total of {!"..amount.."} "..names[param].." badges"','acquire a total of {!{{amount}}} {{tier}} badges','{{tier}}バッジを合計{!{{amount}}}個獲得する',[parameter('amount','integer','amount'),tierParameter()]),
    ],
  },
];

/** Nonliteral does not mean untranslated: all four bodies/branches above are reviewed.
 * These candidates remain separate from literal registry fields until their return
 * expression overlays and plural-aware registry projection are connected. */
export const pendingMiscRegistryFields=reviewedRequirementDescriptions.map(r=>({
  category:r.category,registryId:r.registryId,field:r.field,file:r.source.file,line:r.source.line,
  reason:'nonliteral function field; all complete guarded branch translations are available in reviewedRequirementDescriptions; function-overlay integration and derived name_plural metadata remain pending',
}));

// Four additional visible group/title strings are outside register_rank table fields.
export const reviewedRankGroupTexts=[
  {category:'rank_group',registryId:'skill',field:'name',id:'term.rank-group.skill.name',english:'Skill',japanese:'腕前',source:{file:ranksFile,line:408}},
  {category:'rank_group',registryId:'exp',field:'name',id:'term.rank-group.experience.name',english:'Experience',japanese:'経験',source:{file:ranksFile,line:410}},
  {category:'rank_group',registryId:'skill',field:'award',id:'message.rank.skill.promoted',englishOriginal:'You have amazing skill and advance to {!%s} rank!',english:'You have amazing skill and advance to {!{{rank}}} rank!',japanese:'見事な腕前が認められ、{!{{rank}}}に昇格した！',parameters:{rank:'string'},requiresRankArrayProjection:true,source:{file:ranksFile,line:409}},
  {category:'rank_group',registryId:'exp',field:'award',id:'message.rank.experience.promoted',englishOriginal:'You have fierceful determination and advance to {!%s} rank!',english:'You have fierceful determination and advance to {!{{rank}}} rank!',japanese:'強い決意が認められ、{!{{rank}}}に昇格した！',parameters:{rank:'string'},requiresRankArrayProjection:true,source:{file:ranksFile,line:411}},
];

const hash=b=>createHash('sha256').update(b).digest('hex');
const canonicalExpression=s=>{
  const scan=scanSource(s,'lua');if(scan.diagnostics.length)throw Error('Expression lexical diagnostics');
  return JSON.stringify(scan.tokens.map(t=>t.kind==='string'?['string',t.value]:[t.kind,t.raw]));
};
const params=s=>[...s.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)].map(m=>m[1]).sort();
const markup=s=>JSON.stringify(s.replace(/\{\{[a-z][a-z0-9_]*\}\}/g,'').match(/\{(?:\$[^}]*\}|\^\d+|[A-Za-z!])|\}/g)??[]);
function originalSyntheticDescription(expression,bindings,values){
  const tokens=scanSource(expression,'lua').tokens,chunks=[];
  let depth=0,brackets=0,first=0;
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i];if(t.raw==='(')depth++;if(t.raw===')')depth--;
    if(t.raw==='[')brackets++;if(t.raw===']')brackets--;
    if(t.raw==='..'&&depth===0&&brackets===0){chunks.push(tokens.slice(first,i));first=i+1;}
  }
  chunks.push(tokens.slice(first));
  const captured=new Map(bindings.map(b=>[canonicalExpression(b.originalExpression),values[b.name]]));
  return chunks.map(chunk=>{
    if(chunk.length===1&&chunk[0].kind==='string')return chunk[0].value;
    const key=canonicalExpression(expression.slice(chunk[0].start,chunk.at(-1).end));
    if(!captured.has(key))throw Error('Unaccounted requirement source fragment');
    return String(captured.get(key));
  }).join('');
}

export function verifyMiscRegistryFields(sourceRoot=path.resolve(here,'../upstream/drl')){
  const lock=JSON.parse(readFileSync(path.join(here,'registry-sources.lock.json'),'utf8'));
  if(lock.sourceCommit!==sourceCommit||Object.keys(lock.sources).length!==83)throw Error('Registry source lock mismatch');
  const sources=new Map(),registrations=[],sourceFiles={};
  for(const [file,pinned] of Object.entries(lock.sources)){
    if(file.includes('..')||path.isAbsolute(file)||!file.endsWith('.lua'))throw Error('Unsafe source lock path');
    const bytes=readFileSync(path.join(sourceRoot,file));
    if(bytes.length!==pinned.bytes||hash(bytes)!==pinned.sha256)throw Error(`Source hash mismatch: ${file}`);
    sourceFiles[file]={sha256:pinned.sha256,bytes:pinned.bytes};
    // All83 original Lua files are hashed; lexical work is limited to relevant units.
    if(!['bin/data/drl/affects.lua','bin/data/drl/events.lua','bin/data/drl/items/eitems.lua','bin/data/drl/items/uitems.lua','bin/data/drl/levels/fortress.lua','bin/data/drl/perks.lua',ranksFile].includes(file))continue;
    const text=bytes.toString('utf8'),scan=scanSource(text,'lua');
    if(scan.diagnostics.length)throw Error(`Source lexical diagnostics: ${file}`);
    sources.set(file,{text,scan,lines:text.split(/\r?\n/)});
    registrations.push(...scanRegistrySource(text,file));
  }
  const perkEntries=registrations.filter(r=>r.category==='perk'),perkFields=[];
  for(const [registryId,fields]of Object.entries(reviewedMiscRegistryFields.perk)){
    for(const [name,reviewed]of Object.entries(fields)){
      const matches=perkEntries.filter(e=>e.registryId===registryId&&e.fields[name]);
      if(matches.length!==1||matches[0].fields[name].value!==reviewed.english)throw Error(`Perk field guard mismatch: ${registryId}/${name}`);
      if(reviewed.english===''?(reviewed.japanese!==''||reviewed.identity!==true):!/[\u3040-\u30ff\u3400-\u9fff]/u.test(reviewed.japanese))throw Error(`Unreviewed perk field: ${registryId}/${name}`);
      const token=matches[0].fields[name];
      perkFields.push({category:'perk',registryId,field:name,english:reviewed.english,japanese:reviewed.japanese,source:{file:matches[0].file,line:token.line,offset:token.start,endOffset:token.end,raw:token.raw}});
    }
  }
  const allPerkFields=perkEntries.flatMap(e=>Object.keys(e.fields).map(field=>`${e.registryId}/${field}`));
  if(perkFields.length!==75||allPerkFields.length!==75||allPerkFields.some(key=>!perkFields.some(p=>`${p.registryId}/${p.field}`===key)))throw Error('Perk baseline coverage mismatch');
  const rankEntries=registrations.filter(r=>r.category==='rank');
  if(rankEntries.length!==38||reviewedRankArrayFields.length!==38)throw Error('Rank baseline count mismatch');
  const rankCounters={skill:0,exp:0},rankFields=[];
  for(const entry of rankEntries){
    if(!Object.hasOwn(rankCounters,entry.registryId))throw Error('Unknown rank array kind');
    const registryIndex=++rankCounters[entry.registryId];
    const reviewed=reviewedRankArrayFields.find(r=>r.originalRegistryId===entry.registryId&&r.registryIndex===registryIndex);
    const token=entry.fields.name;
    if(!reviewed||token?.value!==reviewed.english||token.line!==reviewed.source.line||token.start!==reviewed.source.offset||token.end!==reviewed.source.endOffset||token.raw!==reviewed.source.raw)throw Error(`Rank identity/name guard mismatch: ${entry.registryId}:${registryIndex}`);
    const mapField=reviewedMiscRegistryFields.rank[reviewed.presentationKey]?.name;
    if(mapField?.english!==reviewed.english||mapField?.japanese!==reviewed.japanese)throw Error('Qualified rank map mismatch');
    rankFields.push({...reviewed,source:{file:entry.file,line:token.line,offset:token.start,endOffset:token.end,raw:token.raw}});
  }
  if(rankCounters.skill!==27||rankCounters.exp!==11)throw Error('Rank array ordering mismatch');
  const requirements=registrations.filter(r=>r.category==='requirement');
  if(requirements.length!==4||reviewedRequirementDescriptions.length!==4)throw Error('Requirement count mismatch');
  const seenIds=new Set(rankFields.map(r=>r.semanticId));
  const checkTemplate=(id,english,japanese,contracts)=>{
    if(seenIds.has(id))throw Error(`Duplicate semantic ID: ${id}`);seenIds.add(id);
    if(JSON.stringify(params(english))!==JSON.stringify(params(japanese)))throw Error(`Placeholder mismatch: ${id}`);
    if(markup(english)!==markup(japanese))throw Error(`VTIG mismatch: ${id}`);
    const parameterNames=[...new Set(params(english))].sort();
    if(JSON.stringify(parameterNames)!==JSON.stringify(Object.keys(contracts).sort()))throw Error(`Typed parameter mismatch: ${id}`);
    const values=Object.fromEntries(Object.entries(contracts).map(([name,type])=>[name,type==='integer'?23:`<${name}>{R{{verbatim}}}`]));
    render({[id]:english},{[id]:contracts},id,values);render({[id]:japanese},{[id]:contracts},id,values);
  };
  for(const requirement of reviewedRequirementDescriptions){
    const entry=requirements.find(e=>e.registryId===requirement.registryId);
    const descriptionField=entry?.pending.find(p=>p.field==='description'&&p.reason==='nonliteral field value');
    if(!descriptionField)throw Error(`Nonliteral requirement field guard mismatch: ${requirement.registryId}`);
    const source=sources.get(requirement.source.file),raw=source.text.slice(requirement.source.offset,requirement.source.endOffset);
    const fieldIndex=source.scan.tokens.findIndex(t=>t.start===descriptionField.offset);
    if(source.scan.tokens[fieldIndex+1]?.raw!=='='||source.scan.tokens[fieldIndex+2]?.raw!=='function'||source.scan.tokens[fieldIndex+2]?.start!==requirement.source.offset)throw Error(`Requirement registry/function identity mismatch: ${requirement.registryId}`);
    if(hash(raw)!==requirement.source.sha256||!raw.startsWith('function(')||!raw.endsWith('end'))throw Error(`Whole requirement function guard mismatch: ${requirement.registryId}`);
    for(const branch of requirement.branches){
      const sourceLine=source.lines[branch.line-1]?.trim();
      if(!sourceLine?.startsWith('return ')||canonicalExpression(sourceLine.slice(7))!==canonicalExpression(branch.originalReturnExpression))throw Error(`Requirement return guard mismatch: ${requirement.registryId}:${branch.line}`);
      checkTemplate(branch.id,branch.english,branch.japanese,Object.fromEntries(branch.bindings.map(b=>[b.name,b.type])));
      const contract=Object.fromEntries(branch.bindings.map(b=>[b.name,b.type]));
      const values=Object.fromEntries(branch.bindings.map(b=>[b.name,b.type==='integer'?23:`<${b.name}>{R{{verbatim}}}`]));
      if(render({[branch.id]:branch.english},{[branch.id]:contract},branch.id,values)!==originalSyntheticDescription(branch.originalReturnExpression,branch.bindings,values))throw Error(`Complete original requirement reconstruction mismatch: ${branch.id}`);
      for(const b of branch.bindings){
        if(!['integer','string'].includes(b.type)||b.evaluation!=='once'||!b.presentationExpression)throw Error('Invalid requirement binding');
        if(/\b(?:math\.random|table\.random_pick|player_data|add_badge|kill)\s*[.(]/.test(b.presentationExpression))throw Error('Gameplay operation in requirement display binding');
      }
    }
  }
  for(const tier of reviewedBadgeTierNames){
    const matches=sources.get(tier.source.file).scan.tokens.filter(t=>t.kind==='string'&&t.line===tier.source.line&&t.value===tier.english);
    if(matches.length!==1)throw Error(`Badge tier source guard mismatch: ${tier.english}`);
    checkTemplate(tier.id,tier.english,tier.japanese,{});
  }
  for(const group of reviewedRankGroupTexts){
    const englishGuard=group.englishOriginal??group.english;
    const matches=sources.get(group.source.file).scan.tokens.filter(t=>t.kind==='string'&&t.line===group.source.line&&t.value===englishGuard);
    if(matches.length!==1)throw Error(`Rank group literal guard mismatch: ${group.id}`);
    checkTemplate(group.id,group.english,group.japanese,group.parameters??{});
  }
  return {sourceCommit,lockedLuaSources:Object.keys(sourceFiles).length,reviewedPerkRegistries:Object.keys(reviewedPerkFields).length,reviewedPerkFields:perkFields.length,identityEmptyPerkNames:perkFields.filter(p=>p.english==='').length,reviewedRankNames:rankFields.length,rankArraySizes:rankCounters,reviewedRequirementFunctions:requirements.length,reviewedRequirementBranchTemplates:reviewedRequirementDescriptions.reduce((n,r)=>n+r.branches.length,0),reviewedBadgeTierNames:reviewedBadgeTierNames.length,additionalRankGroupTexts:reviewedRankGroupTexts.length,pendingNonliteralFields:pendingMiscRegistryFields.length,sourceFiles,perkFields,rankFields,originalGameplayExecuted:false,runtimeAdapterConnected:false};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyMiscRegistryFields();
  console.log(JSON.stringify({...result,sourceFiles:undefined,perkFields:undefined,rankFields:undefined},null,2));
}
