/** Reviewed original DRL challenge presentation fields. GPL-2.0-only.
 * chaosforgeorg/drl tag0_10_11a, a6f965072b3a25b768c91dbced00367f1b57d865.
 * This module only reads/tokenizes original source. Never execute Lua, replace
 * registry/domain strings, change unlock rules, or translate challenge IDs,
 * abbreviation letters, dual-challenge lists, named rating labels or usernames.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanSource} from '../port/tools/inventory-texts.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const challengeFile='bin/data/drl/challenge.lua';
const ranksFile='bin/data/drl/ranks.lua';
const digest=value=>createHash('sha256').update(value).digest('hex');
export const sourceCommit='a6f965072b3a25b768c91dbced00367f1b57d865';

// The blueprint and actual consumers use arch_description, not arch_desc.
// Neither short nor a separate short challenge-name field exists upstream.
export const challengeFieldRoles=[
  'name','description','rating','arch_name','arch_description','arch_rating',
  'win_mortem','win_highscore','arch_win_mortem','arch_win_highscore',
];
export const challengeFieldMeanings={
  name:'Ordinary challenge display name',
  description:'Complete ordinary challenge rules and flavor paragraph',
  rating:'Ordinary challenge difficulty rating label; named labels retain English',
  arch_name:'Archangel variant display name',
  arch_description:'Complete Archangel variant rules and flavor paragraph',
  arch_rating:'Archangel difficulty rating label; named labels retain English',
  win_mortem:'Challenge victory phrase in a post-game mortem',
  win_highscore:'Challenge victory phrase in the high-score display',
  arch_win_mortem:'Archangel victory phrase in a post-game mortem',
  arch_win_highscore:'Archangel victory phrase in the high-score display',
};
const field=(english,japanese)=>({english,japanese,...(english===japanese?{identity:true}:{})});
const ratings={EASY:'易しい',MEDIUM:'普通',HARD:'難しい','VERY HARD':'非常に難しい',BLADE:'BLADE',SEREG:'SEREG',TORMUSE:'TORMUSE'};
const ordinary=(english,japanese,description,japaneseDescription,rating)=>({
  name:field(english,japanese),description:field(description,japaneseDescription),rating:field(rating,ratings[rating]),
});
const archangel=(english,japanese,description,japaneseDescription,rating)=>({
  arch_name:field(english,japanese),arch_description:field(description,japaneseDescription),arch_rating:field(rating,ratings[rating]),
});

export const reviewedChallengeFields={
  challenge_aob:ordinary('Angel of Berserk','狂戦士の天使',
    "A challenge for the true berserker! You don't have a gun at the start and can't use weapons except melee weapons! To make things a little easier, large health globes will act like berserk packs for you.",
    '真の狂戦士のためのチャレンジ！開始時に銃はなく、近接武器以外の武器は使えない！少しだけ楽になるよう、大型の体力オーブがバーサーク・パックと同じ効果を発揮する。','MEDIUM'),
  challenge_aomr:ordinary('Angel of Marksmanship','射撃の天使',
    "Fans of pistols, unite! This challenge doesn't allow you to use any weapon besides a pistol (or two if you know how)!",
    'ピストル好きよ、集まれ！このチャレンジではピストル以外の武器は使えない（扱い方を知っていれば2丁でもいい）！','MEDIUM'),
  challenge_aosh:ordinary('Angel of Shotgunnery','散弾銃の天使',
    "It's time to kick ass and chew bubblegum -- only shotguns and fists are the true weapons of the Army of the Dead!",
    '敵をぶっ飛ばしてガムをかむ時間だ――「死者の軍団」にふさわしい真の武器は、ショットガンと拳だけだ！','EASY'),
  challenge_aolt:{
    ...ordinary('Angel of Light Travel','身軽な旅の天使',
      'Who needs all that junk? Try to complete the game only using 5 inventory slots! To help you out, you get a +20% speed bonus.',
      'そんな荷物が全部必要か？所持品の枠を5つだけ使ってクリアしてみよう！助けとして、速度に+20%のボーナスを得る。','HARD'),
    ...archangel('Archangel of Travel','旅の大天使',
      'Who needs all that junk? Try to complete the game only using 2 inventory slots! You get a +30% speed bonus this time.',
      'そんな荷物が全部必要か？所持品の枠を2つだけ使ってクリアしてみよう！今回は速度に+30%のボーナスを得る。','BLADE'),
  },
  challenge_aoi:ordinary('Angel of Impatience','焦燥の天使',
    'You need to kill NOW! No time to carry all those medkits and phase devices, you use them immediately on pickup!',
    '今すぐ殺さなければ！医療パックやフェーズ装置を持ち歩く暇などない。拾った瞬間に使ってしまう！','HARD'),
  challenge_aocn:ordinary('Angel of Confidence','自信の天使',
    'Are three episodes too much of a grind? Try beating the game in just two! Having seen the destruction of Phobos beforehand, you asked to be dropped off at the Deimos base to save yourself the trouble. At least they were nice enough to give you some more gear.',
    '3つのエピソードを進むのは面倒すぎるか？2つだけでクリアしてみよう！フォボスの惨状を前もって見ていたあなたは、手間を省くためダイモス基地に降ろしてもらうよう頼んだ。せめてもの親切で、装備は少し多めに渡してくれた。','VERY HARD'),
  challenge_aop:ordinary('Angel of Purity','純潔の天使',
    'Who needs those powerups anyway? Try to finish DRL without them. But remember that health globes are also a powerup!',
    'そもそもパワーアップなど必要か？使わずにDRLをクリアしてみよう。ただし、体力オーブもパワーアップの一種だと忘れるな！','BLADE'),
  challenge_aora:{
    ...ordinary('Angel of Red Alert','緊急警報の天使',
      "You've been ordered to clear out Hell, no matter what. Every time you enter a level, a nuke is dropped and armed, with countdown of 5 minutes (around 240 moves). Warning, the areas can't be scouted!",
      '何があろうと地獄を一掃せよ、との命令だ。階に入るたびに核爆弾が投下され、5分（約240回の移動）の時限装置が作動する。警告：エリアを事前に偵察することはできない！','MEDIUM'),
    ...archangel('Archangel of Red Alert','緊急警報の大天使',
      "You've been ordered to clear out Hell, no matter what. Every time you enter a level, a nuke is dropped and armed, with countdown of 2.5 minutes (around 120 moves). Warning, the areas can't be scouted!",
      '何があろうと地獄を一掃せよ、との命令だ。階に入るたびに核爆弾が投下され、2.5分（約120回の移動）の時限装置が作動する。警告：エリアを事前に偵察することはできない！','BLADE'),
  },
  challenge_aod:ordinary('Angel of Darkness','暗闇の天使',
    'You think the DRL levels are dark? Try this challenge, and feel a bit of painful claustrophobia! As a bonus to all that is unjust in this challenge, you level up twice as fast.',
    'DRLの階は暗いと思うか？このチャレンジで、息苦しい閉塞感を味わってみよう！この理不尽な挑戦へのおまけとして、レベルアップの速さは2倍になる。','VERY HARD'),
  challenge_aomc:ordinary('Angel of Max Carnage','大殺戮の天使',
    'You hate chance, you hate games of chance, you hate dice so much that you crush them when you see them. As a result, your guns do max damage and you are guaranteed to hit visible targets. However this also applies to your enemies...',
    '偶然が嫌いだ。運任せのゲームも嫌いだ。サイコロは見るだけで握りつぶしたくなるほど嫌いだ。その結果、あなたの銃は常に最大ダメージを与え、視界内の標的には必ず命中する。ただし、敵にも同じことが当てはまる……。','EASY'),
  challenge_aoms:{
    ...ordinary('Angel of Masochism','被虐の天使',
      'Okay, this one is for masochists -- healing globes, supercharge, and medkits will *not* work on you! As a small compensation you heal up to 200% at level up. Now beat this!',
      'よし、これは被虐趣味の人向けだ――体力オーブ、スーパーチャージ、医療パックは一切効かない！ささやかな埋め合わせとして、レベルアップ時に体力が200%まで回復する。さあ、クリアしてみろ！','BLADE'),
    ...archangel('Archangel of Masochism','被虐の大天使',
      'Okay, this one is for TRUE masochists -- healing globes, supercharge, and medkits will *not* work on you! And yeah, no compensation. Now beat THIS!',
      'よし、これは真の被虐趣味の人向けだ――体力オーブ、スーパーチャージ、医療パックは一切効かない！もちろん、埋め合わせもない。さあ、こいつをクリアしてみろ！','BLADE'),
  },
  challenge_a100:{
    ...ordinary('Angel of 100','100階の天使',
      '100 levels, and you win. No Cybie, no Spidey, no JC, no special levels, just 100 normal levels. And yes, there are more and more enemies after level 25...',
      '100階を進めば勝利だ。サイバーデーモンもスパイダー・マスターマインドもJCも、特別階もない。通常の階が100階あるだけだ。そしてもちろん、第25階を過ぎると敵はどんどん増えていく……。','HARD'),
    win_mortem:field('completed 100 levels of torture','苦難の100階を踏破した'),
    win_highscore:field('completed 100 levels','100階を踏破した'),
    ...archangel('Archangel of 666','666階の大天使',
      "This one is *not* supposed to be fun. This is just a GRIND. You've been warned.",
      'これは楽しめるようにはできていない。ただひたすら延々と進む苦行だ。警告はしたぞ。','BLADE'),
    arch_win_mortem:field('completed 666 levels of torture','苦難の666階を踏破した'),
    arch_win_highscore:field('completed 666 levels','666階を踏破した'),
  },
  challenge_aopc:{
    ...ordinary('Angel of Pacifism','平和主義の天使',
      "The monsters are beings too! They don't deserve to be killed! It's all the fault of that damn Spider Mastermind, she should be NUKED! You start with a Thermie, and due to your pacifistic beliefs you gain a level every third dungeon level. Of course - *no* weapon usage.",
      '怪物たちも生き物だ！殺されるいわれなどない！悪いのはすべて、あの忌々しいスパイダー・マスターマインドだ。あいつこそ核で吹き飛ばすべきだ！熱核爆弾を持って開始し、平和主義の信念によりダンジョンの3階ごとに1レベル上がる。もちろん、武器の使用は一切禁止だ。','EASY'),
    ...archangel('Archangel of Pacifism','平和主義の大天使',
      "The monsters are beings too! They don't deserve to be killed! It's all the fault of that damn Spider Mastermind, she should be NUKED! You start with a Thermie, and... that's it -- no freebies for pacifists. Of course - *no* weapon usage.",
      '怪物たちも生き物だ！殺されるいわれなどない！悪いのはすべて、あの忌々しいスパイダー・マスターマインドだ。あいつこそ核で吹き飛ばすべきだ！熱核爆弾を持って開始し……それだけだ。平和主義者へのおまけはない。もちろん、武器の使用は一切禁止だ。','BLADE'),
  },
  challenge_aohu:{
    ...ordinary('Angel of Humanity','人間性の天使',
      "You're no hero. Try beating the game with a mere 20% of your HP. Oh, and don't count on Ironman, it will only give you +2 HP per level. To ease your suffering a little, you gain some useful junk at start. Yes, you will get instakilled a lot, go ahead and cry.",
      'あなたは英雄ではない。わずか20%のHPでクリアしてみよう。「鉄人」にも期待するな。特性1レベルにつきHPが+2増えるだけだ。苦しみを少し和らげるため、開始時には役立つ道具がいくつか手に入る。そう、何度も即死するだろう。泣いてもいいぞ。','BLADE'),
    ...archangel('Archangel of Humanity','人間性の大天使',
      "You're no hero. Try beating the game with a mere 20% of your HP. Oh, and don't count on Ironman, it will only give you +2 HP per level. To ease your suffering a little, you gain some useful junk at start. Actually, traits are so unrealistic, take just one at the start.",
      'あなたは英雄ではない。わずか20%のHPでクリアしてみよう。「鉄人」にも期待するな。特性1レベルにつきHPが+2増えるだけだ。苦しみを少し和らげるため、開始時には役立つ道具がいくつか手に入る。そもそも特性など現実離れしている。開始時に1つだけ取れ。','TORMUSE'),
  },
  challenge_aooc:ordinary('Angel of Overconfidence','過信の天使',
    "Not three episodes, not even two: now we're down to a single count! You were so ready to face the legions of Hell that you were sent directly to their home turf. Good thing you snuck some extra supplies!",
    '3つのエピソードでも2つでもない。今度はたった1つだ！地獄の軍団に挑む準備が万全すぎたあなたは、連中の本拠地へ直接送り込まれた。余分な物資をこっそり持ち込んでおいてよかった！','SEREG'),
};

const secondary9=['AoCn','AoOC','A100','AoLT','AoI','AoP','AoRA','AoD','AoMs'];
const secondary6=['AoCn','AoOC','A100','AoLT','AoRA','AoD'];
// These data are guards/documentation, never replacements for game values.
// Absence of a secondary list prevents selection as a Dual-angel primary.
export const reviewedChallengeMechanics={
  challenge_aob:{rank:1,abbr:'AoB',let:'B',secondary:secondary9},
  challenge_aomr:{rank:1,abbr:'AoMr',let:'R',secondary:secondary9},
  challenge_aosh:{rank:2,abbr:'AoSh',let:'S',secondary:secondary9},
  challenge_aolt:{rank:2,abbr:'AoLT',let:'L',arch_rank:5},
  challenge_aoi:{rank:3,abbr:'AoI',let:'I',secondary:secondary6},
  challenge_aocn:{rank:4,abbr:'AoCn',let:'N'},
  challenge_aop:{rank:4,abbr:'AoP',let:'P',secondary:secondary6},
  challenge_aora:{rank:4,abbr:'AoRA',let:'A',arch_rank:6},
  challenge_aod:{rank:5,abbr:'AoD',let:'D',secondary:['AoCn','AoOC','A100','AoLT','AoI','AoP','AoRA','AoMs']},
  challenge_aomc:{rank:5,abbr:'AoMC',let:'C',secondary:secondary9},
  challenge_aoms:{rank:5,abbr:'AoMs',let:'M',arch_rank:6},
  challenge_a100:{rank:5,abbr:'A100',let:'O',arch_rank:7},
  challenge_aopc:{rank:5,abbr:'AoPc',let:'F',arch_rank:7,secondary:['AoCn','AoOC','A100','AoI','AoP','AoD','AoMs']},
  challenge_aohu:{rank:6,abbr:'AoHu',let:'U',arch_rank:9,secondary:['AoCn','AoOC','A100','AoI','AoP','AoRA','AoD','AoMs']},
  challenge_aooc:{rank:6,abbr:'AoOC',let:'V'},
};

// Current menu uses HOF.GetRank('skill') >= Req, and ranks.skill[Req+1].name.
// Requirements are distinct badge types at each tier, not repeated copies.
export const reviewedChallengeUnlockRanks={
  1:{registryIndex:2,english:'Private FC',japanese:'一等兵',requirements:[{req:'aquire_badges',param:1,amount:1}]},
  2:{registryIndex:3,english:'Lance Corporal',japanese:'上等兵',requirements:[{req:'aquire_badges',param:1,amount:3}]},
  3:{registryIndex:4,english:'Corporal',japanese:'伍長',requirements:[{req:'aquire_badges',param:1,amount:6}]},
  4:{registryIndex:5,english:'Sergeant',japanese:'軍曹',requirements:[{req:'aquire_badges',param:1,amount:9},{req:'aquire_badges',param:2,amount:1}]},
  5:{registryIndex:6,english:'Sergeant Major',japanese:'曹長',requirements:[{req:'aquire_badges',param:1,amount:12},{req:'aquire_badges',param:2,amount:3}]},
  6:{registryIndex:7,english:'Warrant Officer',japanese:'准尉',requirements:[{req:'aquire_badges',param:1,amount:15},{req:'aquire_badges',param:2,amount:6}]},
  7:{registryIndex:8,english:'2nd Lieutenant',japanese:'少尉',requirements:[{req:'aquire_badges',param:2,amount:9},{req:'aquire_badges',param:3,amount:1}]},
  9:{registryIndex:10,english:'Captain',japanese:'大尉',requirements:[{req:'aquire_badges',param:2,amount:15},{req:'aquire_badges',param:3,amount:6}]},
};
export const challengeModeGates=[
  {mode:'angel',minimumSkillRank:1,englishRank:'Private FC',japaneseRank:'一等兵',originalAllow:"ChallengeType[1].Allow := (iSkill > 0) or (GodMode) or (Setting_UnlockAll);"},
  {mode:'dual_angel',minimumSkillRank:4,englishRank:'Sergeant',japaneseRank:'軍曹',originalAllow:"ChallengeType[2].Allow := (iSkill > 3) or (GodMode) or (Setting_UnlockAll);"},
  {mode:'archangel',minimumSkillRank:5,englishRank:'Sergeant Major',japaneseRank:'曹長',originalAllow:"ChallengeType[3].Allow := (iSkill > 4) or (GodMode) or (Setting_UnlockAll);"},
];

export const pendingChallengeNonliteralFields=[];
export const excludedHistoricalChallengeIds=['challenge_aocq','challenge_aoh','challenge_aodd','challenge_aopw'];
export const pendingChallengeRuntimeSites=[
  {file:'src/drlmainmenuview.pas',consumer:'ReloadChallenge',fields:['name','description','rating','arch_name','arch_description','arch_rating'],reason:'Project only iEntry display fields by current iPrefix; preserve iEntry.ID, NID, Req, Allow and underlying chal fields.'},
  {file:'src/drlmainmenuview.pas',consumer:'UpdateChallenge',semanticId:'menu.challenge.unlock',reason:'Resolve ranks.skill[Req+1].name through qualified rank presentation metadata; threshold and GodMode/Setting_UnlockAll bypass remain original.'},
  {file:'src/drlmainmenuview.pas',consumer:'ReloadChallenge',reason:'UNRATED is a native fallback literal, outside challenge registration fields; preserve empty/missing rating behavior.'},
  {file:'bin/data/core/mortem.lua',consumer:'mortem.print_challenge',fields:['name','arch_name'],reason:'Mortem sentence templates require presentation-only challenge names; preserve original CHALLENGE/SCHALLENGE identifiers and primary-only high-score accounting.'},
  {file:'bin/data/drl/main.lua',consumer:'drl.GetResultDescription / drl.RunPrintMortem',fields:['win_mortem','arch_win_mortem'],reason:'Project victory text at final mortem output. GetResultDescription also serves the persisted high-score description; keep its highscore=true result English.'},
  {file:'src/dfhof.pas',consumer:'THOF.Add, line 926',fields:['win_highscore','arch_win_highscore'],reason:'THOF.Add persists GetResultDescription(result,true) in the score record; resolve these phrases only when rendering a score, preserving original English native score/XML compatibility.'},
];

function closingBrace(tokens,start){
  let depth=0;
  for(let index=start;index<tokens.length;index++){
    if(tokens[index].raw==='{')depth++;
    else if(tokens[index].raw==='}'&&!--depth)return index;
  }
  throw Error('Unclosed original registration table');
}
// Independent registration-field scanner. Only top-level assignments count;
// nested functions, tables, controls, comments and string contents never do.
function topFields(tokens,start,end){
  const fields={},pending=[],assignments={};
  let braces=0,parens=0,brackets=0;const blocks=[];
  for(let index=start;index<=end;index++){
    const token=tokens[index],raw=token.raw;
    if(token.kind==='punctuation'){
      if(raw==='{')braces++;if(raw==='}')braces--;
      if(raw==='(')parens++;if(raw===')')parens--;
      if(raw==='[')brackets++;if(raw===']')brackets--;
    }
    if(braces===1&&parens===0&&brackets===0&&blocks.length===0&&
      token.kind==='identifier'&&tokens[index+1]?.raw==='='){
      if(Object.hasOwn(assignments,raw))throw Error(`Duplicate top-level registration field ${raw}`);
      assignments[raw]={fieldToken:token,valueIndex:index+2,valueToken:tokens[index+2]};
      const value=tokens[index+2],next=tokens[index+3];
      if(value?.kind==='string'&&[',',';','}'].includes(next?.raw))fields[raw]=value;
      else pending.push({field:raw,line:token.line,offset:token.start,reason:value?.kind==='string'?'literal followed by an expression':'nonliteral field value'});
    }
    if(token.kind==='identifier'){
      if(['function','if','for','while','repeat'].includes(raw))blocks.push({type:raw,awaitDo:raw==='for'||raw==='while'});
      else if(raw==='do'){
        const loop=blocks.findLast(block=>block.awaitDo);
        if(loop)loop.awaitDo=false;else blocks.push({type:'do'});
      }else if(raw==='end'||raw==='until')blocks.pop();
    }
  }
  return {fields,pending,assignments};
}
export function scanChallengeSource(source,file=challengeFile){
  const scanned=scanSource(source,'lua');
  if(scanned.diagnostics.length)throw Error(`Original Lua lexical diagnostics: ${file}`);
  const tokens=scanned.tokens,entries=[];
  for(let index=0;index<tokens.length;index++){
    if(tokens[index].raw!=='register_challenge'||tokens[index-1]?.raw==='function'||tokens[index+1]?.raw==='=')continue;
    let cursor=index+1;if(tokens[cursor]?.raw==='(')cursor++;
    if(tokens[cursor]?.kind!=='string')continue;
    const identity=tokens[cursor++];if(tokens[cursor]?.raw===')')cursor++;
    if(tokens[cursor]?.raw!=='{')continue;
    const end=closingBrace(tokens,cursor),parsed=topFields(tokens,cursor,end);
    entries.push({category:'challenge',registryId:identity.value,file,line:tokens[index].line,
      source:{offset:tokens[index].start,endOffset:tokens[end].end},
      fields:Object.fromEntries(Object.entries(parsed.fields).filter(([name])=>challengeFieldRoles.includes(name))),
      pending:parsed.pending.filter(item=>challengeFieldRoles.includes(item.field)),
      assignments:parsed.assignments,tokens,
    });
  }
  return entries;
}

// Finite literal-only Lua table reader for unlock/secondary documentation. It
// rejects function calls, operators and variable expressions; it executes none.
function literalData(tokens,start){
  const token=tokens[start];
  if(token?.kind==='string')return {value:token.value,next:start+1};
  if(token?.kind==='number'&&/^(?:0|[1-9][0-9]*)$/.test(token.raw)){
    const value=Number(token.raw);if(!Number.isSafeInteger(value))throw Error('Unsafe original literal integer');
    return {value,next:start+1};
  }
  if(token?.raw!=='{')throw Error(`Nonliteral metadata at ${token?.line}`);
  const array=[],object={};let index=start+1,named=false,positional=false;
  while(tokens[index]?.raw!=='}'){
    if(index>=tokens.length)throw Error('Unclosed finite literal metadata');
    if(tokens[index].kind==='identifier'&&tokens[index+1]?.raw==='='){
      named=true;const key=tokens[index].raw;if(Object.hasOwn(object,key))throw Error('Duplicate literal metadata key');
      const parsed=literalData(tokens,index+2);object[key]=parsed.value;index=parsed.next;
    }else{
      positional=true;const parsed=literalData(tokens,index);array.push(parsed.value);index=parsed.next;
    }
    if(tokens[index]?.raw===','||tokens[index]?.raw===';')index++;
    else if(tokens[index]?.raw!=='}')throw Error('Expression in finite literal metadata');
  }
  if(named&&positional)throw Error('Mixed table metadata');
  return {value:named?object:array,next:index+1};
}
function tokenSource(file,token){return {file,line:token.line,offset:token.start,endOffset:token.end,raw:token.raw};}
function equal(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(`Challenge ${label} guard mismatch`);}
const roleSet=new Set(challengeFieldRoles);

export function verifyChallengeFields(upstreamRoot=path.resolve(here,'../upstream/drl'),reviewed=reviewedChallengeFields){
  const lock=JSON.parse(readFileSync(path.join(here,'registry-sources.lock.json'),'utf8'));
  if(lock.sourceCommit!==sourceCommit||Object.keys(lock.sources).length!==83)throw Error('Original 83-Lua source lock identity mismatch');
  const sources=new Map(),sourceFiles={};let entries=[];
  for(const [file,guard]of Object.entries(lock.sources)){
    const bytes=readFileSync(path.join(upstreamRoot,file));
    if(bytes.length!==guard.bytes||digest(bytes)!==guard.sha256)throw Error(`Original source hash mismatch: ${file}`);
    const source=bytes.toString('utf8');sourceFiles[file]={sha256:guard.sha256,bytes:guard.bytes};sources.set(file,source);
    entries.push(...scanChallengeSource(source,file));
  }
  if(entries.length!==15||entries.some(entry=>entry.file!==challengeFile))throw Error('Challenge shipped baseline registration mismatch');
  equal(Object.keys(reviewed).sort(),entries.map(entry=>entry.registryId).sort(),'registration IDs');
  const outputFields=[],mechanics=[],unlockSources=[],seen=new Set();
  for(const entry of entries){
    if(seen.has(entry.registryId))throw Error('Duplicate original challenge ID');seen.add(entry.registryId);
    if(entry.pending.length)throw Error(`Unreviewed nonliteral challenge display field: ${entry.registryId}`);
    equal(Object.keys(reviewed[entry.registryId]).sort(),Object.keys(entry.fields).sort(),`${entry.registryId} field coverage`);
    for(const [name,review]of Object.entries(reviewed[entry.registryId])){
      if(!roleSet.has(name)||entry.fields[name]?.value!==review.english)throw Error(`Challenge English field mismatch: ${entry.registryId}/${name}`);
      if(typeof review.japanese!=='string'||review.japanese.includes('\0')||(!review.identity&&!/[\u3040-\u30ff\u3400-\u9fff]/u.test(review.japanese)))throw Error(`Unreviewed Japanese challenge field: ${entry.registryId}/${name}`);
      if(review.identity&&review.english!==review.japanese)throw Error('Identity challenge field changed');
      for(const number of review.english.match(/\d+(?:\.\d+)?%?/g)??[])
        if(!review.japanese.includes(number))throw Error(`Challenge numeric threshold lost: ${entry.registryId}/${name}/${number}`);
      if(/\{\{|\}\}/.test(review.english)||/\{\{|\}\}/.test(review.japanese))throw Error('Unexpected dynamic challenge registry placeholder');
      outputFields.push({category:'challenge',registryId:entry.registryId,field:name,
        semanticId:`term.challenge.${entry.registryId}.${name}`,english:review.english,japanese:review.japanese,
        identity:review.identity===true,source:tokenSource(entry.file,entry.fields[name])});
    }
    const reviewedMechanics=reviewedChallengeMechanics[entry.registryId];
    if(!reviewedMechanics)throw Error('Unreviewed challenge mechanics guard');
    const metadata={};
    for(const name of ['rank','abbr','let','arch_rank','secondary']){
      const assignment=entry.assignments[name];
      if(assignment){
        const parsed=literalData(entry.tokens,assignment.valueIndex);
        if(![',',';','}'].includes(entry.tokens[parsed.next]?.raw))throw Error('Expression after challenge metadata');
        metadata[name]=parsed.value;
      }
    }
    equal(metadata,reviewedMechanics,`${entry.registryId} immutable unlock/duality metadata`);
    mechanics.push({registryId:entry.registryId,...metadata,
      source:Object.fromEntries(Object.keys(metadata).map(name=>[name,tokenSource(entry.file,entry.assignments[name].valueToken)]))});
  }
  if(outputFields.length!==67||outputFields.filter(field=>field.field==='arch_name').length!==6)throw Error('Challenge baseline visible-field count mismatch');
  // Blueprint field schema is separately inspected to detect new omitted display
  // roles instead of silently filtering them away with the curated role list.
  const blueprint=scanSource(sources.get('bin/data/core/blueprints.lua'),'lua').tokens;
  const blueprintIndex=blueprint.findIndex((token,index)=>token.value==='challenge'&&blueprint[index-1]?.value===undefined&&blueprint[index-1]?.raw==='register_blueprint');
  if(blueprintIndex<0||blueprint[blueprintIndex+1]?.raw!=='{')throw Error('Original challenge blueprint identity mismatch');
  const blueprintEnd=closingBrace(blueprint,blueprintIndex+1),schema=topFields(blueprint,blueprintIndex+1,blueprintEnd);
  const stringFields=Object.entries(schema.assignments).filter(([,assignment])=>{
    const at=assignment.valueIndex;return blueprint[at]?.raw==='{'&&blueprint.slice(at,at+7).some(token=>token.raw==='TSTRING');
  }).map(([name])=>name).sort();
  equal(stringFields,[...challengeFieldRoles,'id','abbr','let'].sort(),'blueprint string-field coverage');
  if(Object.hasOwn(schema.assignments,'short')||Object.hasOwn(schema.assignments,'arch_desc'))throw Error('Unexpected challenge field variation');

  const rankTokens=scanSource(sources.get(ranksFile),'lua').tokens,skillRanks=[];
  for(let index=0;index<rankTokens.length;index++){
    if(rankTokens[index].raw!=='register_rank'||rankTokens[index+1]?.value!=='skill'||rankTokens[index+2]?.raw!=='{')continue;
    const start=index+2,end=closingBrace(rankTokens,start),rank=topFields(rankTokens,start,end);
    const reqs=rank.assignments.reqs;
    if(!rank.fields.name||!reqs)throw Error('Original skill-rank literal identity mismatch');
    skillRanks.push({name:rank.fields.name.value,requirements:literalData(rankTokens,reqs.valueIndex).value,
      nameSource:tokenSource(ranksFile,rank.fields.name),requirementSource:tokenSource(ranksFile,reqs.valueToken)});
  }
  if(skillRanks.length!==27)throw Error('Original skill-rank ordering mismatch');
  for(const [minimum,rank]of Object.entries(reviewedChallengeUnlockRanks)){
    const index=Number(minimum)+1,actual=skillRanks[index-1];
    if(rank.registryIndex!==index||actual?.name!==rank.english)throw Error('Current challenge unlock-rank name mismatch');
    equal(actual.requirements,rank.requirements,`skill ${minimum} complete badge thresholds`);
    unlockSources.push({minimumSkillRank:Number(minimum),...rank,source:{name:actual.nameSource,requirements:actual.requirementSource}});
  }
  for(const entry of mechanics)for(const rank of [entry.rank,entry.arch_rank].filter(value=>value!==undefined))
    if(!reviewedChallengeUnlockRanks[rank])throw Error('Undocumented current challenge unlock threshold');
  const menuBytes=readFileSync(path.join(upstreamRoot,'src/drlmainmenuview.pas'));
  if(digest(menuBytes)!=='ede8d5958854ab375e117086cccb35c7d3bc6d4bbbc0830b8182b53ec5a5066e')throw Error('Original challenge presentation consumer hash mismatch');
  const menu=menuBytes.toString('utf8'),menuLines=menu.split('\n');
  for(const gate of challengeModeGates){
    if(menuLines.filter(line=>line.trim()===gate.originalAllow).length!==1)throw Error(`Current ${gate.mode} gate source mismatch`);
    const rank=reviewedChallengeUnlockRanks[gate.minimumSkillRank];
    if(rank?.english!==gate.englishRank||rank?.japanese!==gate.japaneseRank)throw Error('Challenge mode gate rank mismatch');
  }
  for(const expression of [
    "iEntry.Name  := GetString(iPrefix+'name');","iEntry.Desc  := GetString(iPrefix+'description');",
    "iEntry.Extra := GetString(iPrefix+'rating');","iEntry.Req   := GetInteger(iPrefix+'rank',0);",
    "iEntry.Allow := (HOF.GetRank('skill') >= iEntry.Req) or (GodMode) or (Setting_UnlockAll);",
    "iRank := LuaSystem.Get( ['ranks','skill',FArrayChal[iSelect].Req+1,'name'] );",
  ])if(menuLines.filter(line=>line.trim()===expression).length!==1)throw Error('Challenge presentation/rank seam source mismatch');
  for(const id of excludedHistoricalChallengeIds)if(seen.has(id))throw Error('Commented historical challenge counted as shipped');
  return {sourceCommit,lockedLuaSources:83,reviewedChallenges:entries.length,reviewedArchangelVariants:6,
    reviewedDisplayFields:outputFields.length,identityNamedRatings:outputFields.filter(field=>field.identity).length,
    literalDescriptions:outputFields.filter(field=>['description','arch_description'].includes(field.field)).length,
    winResultFields:outputFields.filter(field=>field.field.includes('win_')).length,
    currentUnlockRanks:unlockSources.length,modeGates:challengeModeGates.length,
    pendingNonliteralFields:pendingChallengeNonliteralFields.length,pendingRuntimeRoutes:pendingChallengeRuntimeSites.length,
    sourceFiles,outputFields,mechanics,unlockSources,
    originalGameplayExecuted:false,originalDomainModified:false,runtimeAdapterConnected:false};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyChallengeFields();
  const fail=(label,mutate)=>{
    const changed=structuredClone(reviewedChallengeFields);mutate(changed);
    let rejected=false;try{verifyChallengeFields(undefined,changed);}catch{rejected=true;}
    if(!rejected)throw Error(`Mutation accepted: ${label}`);
    return label;
  };
  const mutations=[
    fail('English guard',fields=>{fields.challenge_aob.description.english+=' changed';}),
    fail('missing field',fields=>{delete fields.challenge_aolt.arch_description;}),
    fail('missing challenge',fields=>{delete fields.challenge_aoi;}),
    fail('historical comment registration',fields=>{fields.challenge_aoh=structuredClone(fields.challenge_a100);}),
    fail('mechanical field accidentally localized',fields=>{fields.challenge_aob.abbr=field('AoB','狂戦士');}),
    fail('numeric inventory limit lost',fields=>{fields.challenge_aolt.description.japanese=fields.challenge_aolt.description.japanese.replace('5','6');}),
    fail('Archangel nuclear countdown lost',fields=>{fields.challenge_aora.arch_description.japanese=fields.challenge_aora.arch_description.japanese.replace('2.5','5');}),
    fail('named external rating changed',fields=>{fields.challenge_aooc.rating.japanese='過信の名人';}),
    fail('unreviewed Japanese field',fields=>{fields.challenge_aomr.description.japanese='TODO';}),
  ];
  const scannerProbe='register_challenge "probe" { name="visible", description="literal"..tail, rating="EASY", OnCreate=function() local nested={name="not a field"}; if true then local x="text" end end } -- register_challenge "comment" {name="comment"}\n--[[ register_challenge "long_comment" {name="comment"} ]]';
  const probe=scanChallengeSource(scannerProbe,'probe.lua');
  if(probe.length!==1||Object.keys(probe[0].fields).sort().join(',')!=='name,rating'||probe[0].pending[0]?.field!=='description')throw Error('Independent challenge scanner scope/static guard test failed');
  console.log(JSON.stringify({...result,sourceFiles:undefined,outputFields:undefined,mechanics:undefined,unlockSources:undefined,
    mutationChecks:mutations.length,mutationCases:mutations,independentScannerProbe:true},null,2));
}
