/** Reviewed original DRL mortem presentation overlay, GPL-2.0-only.
 * Do not alter GetResultDescription: THOF.Add persists its English return.
 * Narrow print/view adapters project already selected original values once.
 * Unknown custom-module values retain their original fallback. No Lua executes.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {render} from './render.mjs';
import {reviewedChallengeFields,reviewedChallengeMechanics,verifyChallengeFields} from './registry-challenges.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const core='bin/data/core/mortem.lua',main='bin/data/drl/main.lua';
const digest=value=>createHash('sha256').update(value).digest('hex');
export const sourceCommit='a6f965072b3a25b768c91dbced00367f1b57d865';
const bind=(name,type,originalExpression,presentationExpression=originalExpression)=>({name,type,originalExpression,presentationExpression,evaluation:'once'});
const integer=(name,expression)=>bind(name,'integer',expression);
const string=(name,expression,presentation)=>bind(name,'string',expression,presentation);
const pronoun=()=>string('subject','mortem.Pronoun',`(mortem.Pronoun == "He" and ui.semantic_text("mortem.subject.he", "He", {}) or mortem.Pronoun)`);
const registry=(category,object,field='name',expression=`${object}.${field}`)=>`ui.registry_text("${category}", ${object}.id, "base_game", "${field}", ${expression})`;
const call=(file,line,id,english,japanese,originalArgument,bindings=[],extra={})=>({file,line,callee:'player:mortem_print',id,english,japanese,originalArgument,bindings,integration:'replace-only-print-argument',...extra});

export const staticMortemMessages=[
  call(core,117,'mortem.awards.none','  None','  なし','"  None"'),
  call(core,244,'mortem.resistances.none','    None','    なし','"    None"'),
  ...[
    [421,'ruler.open','{r--------------------------------------------------------------}','{r--------------------------------------------------------------}'],
    [427,'ruler.header-end','{r--------------------------------------------------------------}','{r--------------------------------------------------------------}'],
    [453,'location.custom',' in a custom location...',' カスタムの場所で……。'],
    [461,'kills.all',' This ass-kicking marine killed all of them!',' この凄腕の海兵隊員は敵をすべて倒した！'],
    [463,'kills.all-but-one',' He missed one kill to totally be ass-kicking.',' 完全無欠の凄腕になるには、あと1体の撃破が足りなかった。'],
    [465,'kills.zero'," Poor pacifist, didn't even get a single kill...",' 気の毒な平和主義者は、1体も倒せなかった……。'],
    [467,'kills.one',' Somehow, he managed only *one* kill.',' どういうわけか、倒せた敵はたった1体だった。'],
    [469,'kills.under-ten-percent'," My, wasn't he a wimpy chump.",' まったく、とんだ腰抜けだった。'],
    [471,'kills.under-thirty-percent',' Who gave him the ticket to Hell, anyway?',' そもそも、誰がこんな者に地獄行きの切符を渡したのだ？'],
    [473,'kills.over-ninety-nine-point-nine-percent',' A natural born killer!',' 生まれながらの殺し屋だ！'],
    [475,'kills.over-ninety-nine-percent',' He was a real killing machine...',' まさに殺人機械だった……。'],
    [477,'kills.over-ninety-percent',' He held his right to remain violent.',' 最後まで暴力を振るう権利を行使した。'],
    [483,'heading.special-levels','{r-- {ySpecial levels} --------------------------------------------}','{r-- {y特別階} --------------------------------------------}'],
    [487,'heading.awards','{r-- {yAwards} ----------------------------------------------------}','{r-- {y栄誉} ----------------------------------------------------}'],
    [492,'heading.graveyard','{r-- {yGraveyard} -------------------------------------------------}','{r-- {y墓場} -------------------------------------------------}'],
    [496,'heading.statistics','{r-- {yStatistics} ------------------------------------------------}','{r-- {y統計} ------------------------------------------------}'],
    [501,'heading.traits','{r-- {yTraits} ----------------------------------------------------}','{r-- {y特性} ----------------------------------------------------}'],
    [505,'heading.equipment','{r-- {yEquipment} -------------------------------------------------}','{r-- {y装備} -------------------------------------------------}'],
    [509,'heading.inventory','{r-- {yInventory} -------------------------------------------------}','{r-- {y所持品} -------------------------------------------------}'],
    [513,'heading.resistances','{r-- {yResistances} -----------------------------------------------}','{r-- {y耐性} -----------------------------------------------}'],
    [517,'heading.kills','{r-- {yKills} -----------------------------------------------------}','{r-- {y撃破数} -----------------------------------------------------}'],
    [526,'heading.history','{r-- {yHistory} ---------------------------------------------------}','{r-- {y履歴} ---------------------------------------------------}'],
    [531,'history.final-evil','  Then finally in Hell itself, he killed the final EVIL.','  そしてついに地獄そのもので、最後の邪悪を倒した。'],
    [537,'heading.messages','{r-- {yMessages} --------------------------------------------------} ','{r-- {yメッセージ} --------------------------------------------------} '],
    [543,'heading.general','{r-- {yGeneral} ---------------------------------------------------} ','{r-- {y全体の記録} ---------------------------------------------------} '],
    [577,'general.first-soul',"  He's the {!first} brave soul to have ventured into Hell...",'  地獄へ踏み込んだ、{!最初}の勇敢な魂だった……。'],
    [581,'ruler.close','{r--------------------------------------------------------------} ','{r--------------------------------------------------------------} '],
  ].map(([line,suffix,english,japanese])=>call(main,line,'mortem.'+suffix,english,japanese,JSON.stringify(english),[],{identity:english===japanese})),
];

export const dynamicMortemMessages=[
  call(core,36,'mortem.summary.turns-score',' {{subject}} survived {!{{turns}}} turns and scored {!{{score}}} points. ',
    ' {{subject}}は{!{{turns}}}ターン生き延び、{!{{score}}}点を獲得した。 ',
    '" "..mortem.Pronoun.." survived {!"..statistics.game_time.."} turns and scored {!"..player.score.."} points. "',
    [pronoun(),integer('turns','statistics.game_time'),integer('score','player.score')]),
  call(core,37,'mortem.summary.duration',' {{subject}} played for {!{{duration}}}. ',
    ' {{subject}}のプレイ時間は{!{{duration}}}だった。 ',
    '" "..mortem.Pronoun.." played for {!"..core.seconds_to_string(math.floor(statistics.real_time)).."}. "',
    [pronoun(),string('duration','core.seconds_to_string(math.floor(statistics.real_time))','ui.mortem_duration(math.floor(statistics.real_time))')],{requiresAdapter:'ui.mortem_duration'}),
  call(core,38,'mortem.summary.difficulty',' {{description}}',' {{description}}','" "..diff[DIFFICULTY].description',
    [string('description','diff[DIFFICULTY].description',registry('difficulty','diff[DIFFICULTY]','description'))],{identity:true}),
  call(core,39,'mortem.summary.seed',' Game seed was {!{{seed}}}.',' ゲームのシードは{!{{seed}}}だった。',
    '" Game seed was {!"..GAME_SEED.."}."',[integer('seed','GAME_SEED')]),
  call(core,49,'mortem.summary.unique-kills',' {{subject}} killed {!{{killed}}} out of {!{{encountered}}} encountered hellspawn. ({!{{percent}}%})',
    ' {{subject}}は遭遇した{!{{encountered}}}体の地獄の魔物のうち{!{{killed}}}体を倒した。（{!{{percent}}%）',
    '" "..mortem.Pronoun.." killed {!"..uk.."} out of {!"..muk.."} encountered hellspawn. ({!"..math.floor(ratio*100).."%})"',
    [pronoun(),integer('killed','uk'),integer('encountered','muk'),integer('percent','math.floor(ratio*100)')]),
  call(core,51,'mortem.summary.total-spawns',' {{subject}} killed {!{{killed}}} out of {!{{spawned}}} enemy spawns total.',
    ' {{subject}}は出現した敵の総数{!{{spawned}}}体のうち{!{{killed}}}体を倒した。',
    '" "..mortem.Pronoun.." killed {!"..k.."} out of {!"..mk.."} enemy spawns total."',
    [pronoun(),integer('killed','k'),integer('spawned','mk')]),
  ...[
    [58,'archangel','chal[CHALLENGE].arch_name','chal[CHALLENGE]','arch_name',' was an {!'],
    [60,'angel','chal[CHALLENGE].name','chal[CHALLENGE]','name',' was an {!'],
    [63,'secondary','chal[SCHALLENGE].name','chal[SCHALLENGE]','name',' was also an {!'],
  ].map(([line,suffix,original,object,field,phrase])=>call(core,line,'mortem.challenge.'+suffix,
    ` {{subject}}${phrase}{{challenge}}}!`,suffix==='secondary'?' {{subject}}は{!{{challenge}}}にも挑んだ！':' {{subject}}は{!{{challenge}}}に挑んだ！',
    `" "..mortem.Pronoun..${JSON.stringify(phrase)}..${original}.."}!"`,[pronoun(),string('challenge',original,registry('challenge',object,field))])),
  call(core,76,'mortem.summary.crashes',' The world crashed {!{{frequency}}}.',' 世界が{!{{frequency}}}クラッシュした。',
    '" The world crashed {!"..times( statistics.crash_count ).."}."',
    [string('frequency','times( statistics.crash_count )','ui.mortem_times(statistics.crash_count)')],{requiresAdapter:'ui.mortem_times'}),
  call(core,79,'mortem.summary.saves',' {{subject}} saved {!{{frequency}}}.',' {{subject}}は{!{{frequency}}}セーブした。',
    '" "..mortem.Pronoun.." saved {!"..times( statistics.save_count ).."}."',
    [pronoun(),string('frequency','times( statistics.save_count )','ui.mortem_times(statistics.save_count)')],{requiresAdapter:'ui.mortem_times'}),
  ...[
    [85,'generated','Levels generated : ','生成された階数 : ','statistics.bonus_levels_count'],
    [86,'visited','Levels visited   : ','訪れた階数     : ','statistics.bonus_levels_visited'],
    [87,'completed','Levels completed : ','攻略した階数   : ','statistics.bonus_levels_completed'],
  ].map(([line,suffix,english,japanese,expression])=>call(core,line,'mortem.special-levels.'+suffix,
    `  ${english}{!{{count}}}`,`  ${japanese}{!{{count}}}`,`${JSON.stringify('  '+english+'{!')}..${expression}.."}"`,[integer('count',expression)])),
  ...[[96,'medal'],[103,'badge']].map(([line,category])=>call(core,line,'mortem.awards.'+category,
    '  {!{{name}}} {{description}}','  {!{{name}}} {{description}}',
    '"  {!"..mortem.padded( v.name, 26 ).."} "..v.desc',
    [string('name','mortem.padded( v.name, 26 )',`ui.mortem_pad(${registry(category,'v')},26)`),
      string('description','v.desc',registry(category,'v','desc'))],{identity:true,requiresAdapter:'ui.mortem_pad'})),
  call(core,111,'mortem.awards.rank','  {!{{name}}} ({!{{tier}}})','  {!{{name}}}（{!{{tier}}}）',
    '"  {!"..v.name.."} ({!"..v.levels[ player:get_award( v.id ) ].name.."})"',
    [string('name','v.name',registry('award','v')),
      string('tier','v.levels[ player:get_award( v.id ) ].name','ui.mortem_award_tier(v,player:get_award(v.id))')],{requiresAdapter:'ui.mortem_award_tier'}),
  call(core,149,'mortem.statistics.health-experience','  Health {!{{health}}}/{!{{maximum_health}}}   Experience {!{{experience}}}/{!{{level}}}',
    '  体力 {!{{health}}}/{!{{maximum_health}}}   経験値 {!{{experience}}}/{!{{level}}}',
    '"  Health {!"..player.hp.."}/{!"..player.hpmax.."}   Experience {!"..player.exp.."}/{!"..player.explevel.."}"',
    [integer('health','player.hp'),integer('maximum_health','player.hpmax'),integer('experience','player.exp'),integer('level','player.explevel')]),
  call(core,150,'mortem.statistics.combat-bonuses','  ToHit Ranged {{ranged_hit}}  ToHit Melee {{melee_hit}}  ToDmg Ranged {{ranged_damage}}  ToDmg Melee {{melee_damage}}',
    '  射撃命中 {{ranged_hit}}  近接命中 {{melee_hit}}  射撃ダメージ {{ranged_damage}}  近接ダメージ {{melee_damage}}',
    '"  ToHit Ranged "..bonus( player:get_tohit() )..\n\t\t\t\t\t\t"  ToHit Melee "..bonus( player:get_tohit(true) )..\n\t\t\t\t\t\t"  ToDmg Ranged "..bonus( player:get_todam() )..\n\t\t\t\t\t\t"  ToDmg Melee "..bonus( player:get_todam(true) )',
    [string('ranged_hit','bonus( player:get_tohit() )'),string('melee_hit','bonus( player:get_tohit(true) )'),string('ranged_damage','bonus( player:get_todam() )'),string('melee_damage','bonus( player:get_todam(true) )')]),
  ...[
    [158,'damage-taken','Damage taken       : ','被ダメージ         : ','statistics.damage_taken'],
    [159,'longest-kill-spree','Longest kill spree : ','最長無傷連続撃破   : ','statistics.kills_non_damage'],
  ].map(([line,suffix,english,japanese,expression])=>call(core,line,'mortem.statistics.'+suffix,
    `  ${english}{!{{count}}}`,`  ${japanese}{!{{count}}}`,`${JSON.stringify('  '+english+'{!')}..${expression}.."}"`,[integer('count',expression)])),
  call(core,164,'mortem.traits.class','  Class : {!{{klass}}}','  クラス : {!{{klass}}}',
    '"  Class : {!"..klasses[player.klass].name.."}"',[string('klass','klasses[player.klass].name',registry('klass','klasses[player.klass]'))]),
  call(core,171,'mortem.traits.entry','    {{trait}} (Level {!{{level}}})','    {{trait}}（レベル {!{{level}}}）',
    '"    "..mortem.padded(traits[i].name,16).." (Level {!"..value.."})"',
    [string('trait','mortem.padded(traits[i].name,16)',`ui.mortem_pad(${registry('trait','traits[i]')},16)`),integer('level','value')],{requiresAdapter:'ui.mortem_pad'}),
  call(core,177,'mortem.traits.history','  {{history}}','  {{history}}','"  "..player:get_trait_hist()',
    [string('history','player:get_trait_hist()','ui.mortem_trait_history(player,player:get_trait_hist())')],{identity:true}),
  call(core,193,'mortem.equipment.item','    {{slot}}   {!{{item}}}','    {{slot}}   {!{{item}}}',
    '"    "..slot_name[i+1].."   {!"..item_desc( it ).."}"',
    [string('slot','slot_name[i+1]','ui.mortem_slot(i,slot_name[i+1])'),
      string('item','item_desc( it )','(item_desc == mortem.item_desc and ui.item_description(it) or item_desc(it))')],
    {identity:true,requiresAdapter:'ui.mortem_slot',customFallback:'A custom item_desc callback executes once and its result is preserved; project only the known default callback.'}),
  call(core,195,'mortem.equipment.empty','    {{slot}}   nothing','    {{slot}}   なし',
    '"    "..slot_name[i+1].."   nothing"',[string('slot','slot_name[i+1]','ui.mortem_slot(i,slot_name[i+1])')],{requiresAdapter:'ui.mortem_slot'}),
  call(core,211,'mortem.inventory.item','    {{description}}','    {{description}}',
    '"    "..v.desc',[string('description','v.desc','v.presentation_desc or v.desc')],{identity:true}),
  call(core,224,'mortem.resistances.entry','    {{damage}} - internal {!{{internal}}} torso {!{{torso}}} feet {!{{feet}}}',
    '    {{damage}} - 基礎 {!{{internal}}} 胴体 {!{{torso}}} 足 {!{{feet}}}',
    '"    "..mortem.padded( name, 10 ).." - "..\n    "internal {!"..mortem.padded( internal.."%", 5 ).."} "..\n    "torso {!"..mortem.padded( torso.."%", 5 ).."} "..\n    "feet {!"..mortem.padded( feet.."%", 5 ).."}"',
    [string('damage','mortem.padded( name, 10 )','ui.mortem_pad(ui.mortem_damage_name(name),10)'),
      string('internal','mortem.padded( internal.."%", 5 )'),string('torso','mortem.padded( torso.."%", 5 )'),string('feet','mortem.padded( feet.."%", 5 )')],
    {requiresAdapter:['ui.mortem_pad','ui.mortem_damage_name'],parameterNote:'Percent formatting and original signed/padded numerical strings remain unchanged.'}),
  call(core,253,'mortem.kills.singular','    {!1} {{enemy}}','    {!1} {{enemy}}',
    '"    {!1} "..b.name',[string('enemy','b.name',registry('being','b'))],{identity:true}),
  call(core,255,'mortem.kills.plural','    {!{{count}}} {{enemy}}','    {!{{count}}} {{enemy}}',
    '"    {!"..kills.."} "..b.name_plural',[integer('count','kills'),string('enemy','b.name_plural',registry('being','b','name_plural'))],{identity:true}),
  call(core,265,'mortem.kills.weapon-group','    {{group}}{!{{count}}}','    {{group}}{!{{count}}}',
    '"    "..names[index].."{!"..count.."}"',[string('group','names[index]','ui.mortem_weapon_group(groups[index],names[index])'),integer('count','count')],
    {identity:true,requiresAdapter:'ui.mortem_weapon_group',customFallback:'Unknown/custom group and label pair is returned verbatim; original groups drive kill counts.'}),
  call(core,276,'mortem.kills.unarmed','    Unarmed kills  : {!{{count}}}','    素手の撃破数   : {!{{count}}}',
    '"    Unarmed kills  : {!"..unarmed.."}"',[integer('count','unarmed')]),
  call(core,280,'mortem.kills.other','    Other kills    : {!{{count}}}','    その他の撃破数 : {!{{count}}}',
    '"    Other kills    : {!"..other.."}"',[integer('count','other')]),

  call(main,422,'mortem.report.version',' {RDRL} {!{{module_version}}} (Engine {!{{engine_version}}}) roguelike post-mortem dump',
    ' {RDRL} {!{{module_version}}}（エンジン {!{{engine_version}}}）ローグライクの戦闘記録',
    '" {RDRL} {!"..VERSION_MODULE.."} (Engine {!"..VERSION_ENGINE.."}) roguelike post-mortem dump"',
    [string('module_version','VERSION_MODULE'),string('engine_version','VERSION_ENGINE')]),
  call(main,440,'mortem.report.player-short-name',' {!{{name}}}, {{description}}',' {!{{name}}}、{{description}}',
    '" {!"..player.name.."}, "..player_description',[string('name','player.name'),string('description','player_description','player_description_presentation or player_description')],{identityNames:['player.name']}),
  call(main,442,'mortem.report.player-long-name',' {!{{name}}},',' {!{{name}}}、',
    '" {!"..player.name.."},"',[string('name','player.name')],{identityNames:['player.name']}),
  call(main,443,'mortem.report.player-description',' {{description}}',' {{description}}',
    '" "..player_description',[string('description','player_description','player_description_presentation or player_description')],{identity:true}),
  call(main,446,'mortem.report.result-location',' {{result}} at {!{{location}}}.',' {!{{location}}}で{{result}}。',
    '" "..death_reason.." at {!"..epi_name.."}."',
    [string('result','death_reason','ui.mortem_result(result_id,death_reason)'),string('location','epi_name','ui.mortem_location(player.episode[player.level_index],epi_name)')],
    {requiresAdapter:['ui.mortem_result','ui.mortem_location'],domainGuard:'GetResultDescription, original episode name/deathname, history and native score text remain English.'}),
  call(main,451,'mortem.report.custom-player',' {!{{name}}}, level {!{{level}}  {{klass}}}, {{result}}',' {!{{name}}}、レベル {!{{level}}  {{klass}}}、{{result}}',
    '" {!"..player.name.."}, level {!"..player.explevel.." "\n\t\t.." "..klasses[player.klass].name.."}, "..death_reason',
    [string('name','player.name'),integer('level','player.explevel'),string('klass','klasses[player.klass].name',registry('klass','klasses[player.klass]')),string('result','death_reason','ui.mortem_result(result_id,death_reason)')],
    {requiresAdapter:'ui.mortem_result',identityNames:['player.name'],customFallback:'Custom module OnMortemPrint override is still called by original branch; unknown result text remains original.'}),
  call(main,533,'mortem.history.final-result','  On level {!{{level}}} he finally {{result}}.','  第{!{{level}}}階で、ついに{{result}}。',
    '"  On level {!"..player.level_index.."} he finally "..death_reason.."."',[integer('level','player.level_index'),string('result','death_reason','ui.mortem_result(result_id,death_reason)')],{requiresAdapter:'ui.mortem_result'}),
  call(main,558,'mortem.general.deaths',' {{count}} brave souls have ventured into Phobos:',' {{count}}人の勇敢な魂がフォボスへ踏み込んだ：',
    '" "..deaths.." brave souls have ventured into Phobos:"',[integer('count','deaths')]),
  call(main,571,'mortem.general.wins',' {!{{count}}} souls destroyed the Mastermind...',' {!{{count}}}人の魂がマスターマインドを倒した……。',
    '" {!"..wins.."} souls destroyed the Mastermind..."',[integer('count','wins')]),
  call(main,572,'mortem.general.sacrifice',' {!{{count}}} sacrificed itself for the good of mankind.',' {!{{count}}}人は人類のために自らを犠牲にした。',
    '" {!"..sacrifice.."} sacrificed itself for the good of mankind."',[integer('count','sacrifice')]),
  call(main,573,'mortem.general.surviving-win',' {!{{count}}} killed the bitch and survived.',' {!{{count}}}人はあの忌々しい女を倒し、生き延びた。',
    '" {!"..win.."} killed the bitch and survived."',[integer('count','win')]),
  call(main,574,'mortem.general.full-win',' {!{{count}}} showed that it can outsmart Hell itself.',' {!{{count}}}人は地獄そのものを出し抜けることを示した。',
    '" {!"..fullwin.."} showed that it can outsmart Hell itself."',[integer('count','fullwin')]),
];

// These producer literals are translated only in the owned presentation helper.
// Their original storage/function returns are retained byte-for-byte.
export const mortemProducerTexts=[
  {file:core,line:3,id:'mortem.subject.he',english:'He',japanese:'彼',role:'pronoun',originalExpression:'mortem.Pronoun = "He"'},
  {file:core,line:70,id:'mortem.frequency.once',english:'once',japanese:'1回',role:'frequency-branch',originalExpression:'if n <= 1 then return "once" else return n.." times" end'},
  {file:core,line:70,id:'mortem.frequency.multiple',english:'{{count}} times',japanese:'{{count}}回',role:'frequency-branch',originalExpression:'n.." times"',bindings:[integer('count','n')]},
  ...[
    ['armor','[ Armor      ]','[ アーマー   ]'],['weapon','[ Weapon     ]','[ 武器       ]'],['boots','[ Boots      ]','[ ブーツ     ]'],['prepared','[ Prepared   ]','[ 予備       ]'],['relic','[ Relic      ]','[ 遺物       ]'],
  ].map(([suffix,english,japanese])=>({file:core,line:187,id:'mortem.slot.'+suffix,english,japanese,role:'equipment-slot',identityKey:suffix})),
  ...[
    ['bullet','弾丸',235],['melee','近接',236],['shrapnel','散弾',237],['acid','酸',238],['fire','火炎',239],['cold','冷気',240],['poison','毒',241],['plasma','プラズマ',242],
  ].map(([english,japanese,line])=>({file:core,line,id:'mortem.damage.'+english,english,japanese,role:'damage-label',identityKey:english})),
  ...[
    ['melee','Melee kills    : ','近接の撃破数       : '],['pistol','Pistol kills   : ','ピストルの撃破数   : '],['shotgun','Shotgun kills  : ','ショットガン撃破数 : '],['chain','Chaingun kills : ','チェーンガン撃破数 : '],['rocket','Rocket kills   : ','ロケットの撃破数   : '],['plasma','Plasma kills   : ','プラズマの撃破数   : '],['bfg','BFG kills      : ','BFGの撃破数        : '],
  ].map(([identityKey,english,japanese])=>({file:main,line:523,id:'mortem.weapon-group.'+identityKey,english,japanese,role:'weapon-group-label',identityKey})),
  ...[
    ['unknown','was killed by something','正体不明の何かに殺された',376],
    ['win','defeated the Mastermind','マスターマインドを倒した',378],
    ['final','nuked the Mastermind','マスターマインドを核で吹き飛ばした',379],
    ['nuke','nuked himself','自分を核で吹き飛ばした',380],
    ['sacrifice.mortem','sacrificed himself to kill the Mastermind','マスターマインドを倒すため自らを犠牲にした',382],
    ['suicide.mortem','committed a stupid suicide','愚かな自殺をした',384],
    ['sacrifice.highscore','won by sacrifice','犠牲を払って勝利した',382],
    ['suicide.highscore','committed suicide','自殺した',384],
  ].map(([suffix,english,japanese,line])=>({file:main,line,id:'mortem.result.'+suffix,english,japanese,role:'result-display',preserveOriginalFunction:'drl.GetResultDescription'})),
];

export const mortemDurationTexts=[
  {file:'bin/data/core/functions.lua',line:12,id:'mortem.duration.zero',english:'0 seconds',japanese:'0秒',parameters:{}},
  ...[['second','秒',14],['minute','分',15],['hour','時間',16],['day','日',17]].flatMap(([unit,japanese,line])=>[
    {file:'bin/data/core/functions.lua',line,id:'mortem.duration.'+unit+'.singular',english:`{{count}} ${unit}`,japanese:`{{count}}${japanese}`,parameters:{count:'integer'},unit,branch:'value<=1; omit exactly-zero units'},
    {file:'bin/data/core/functions.lua',line,id:'mortem.duration.'+unit+'.plural',english:`{{count}} ${unit}s`,japanese:`{{count}}${japanese}`,parameters:{count:'integer'},unit,branch:'value>1'},
  ]),
  {file:'bin/data/core/functions.lua',line:25,id:'mortem.duration.and',english:' and ',japanese:'、',parameters:{}},
  {file:'bin/data/core/functions.lua',line:28,id:'mortem.duration.separator',english:', ',japanese:'、',parameters:{}},
];

export const mortemReasonBranches=[
  {file:main,line:559,reasonId:'killed',id:'mortem.general.reason.killed',original:' {!@1} of those @was killed.',englishSingular:' {!{{count}}} of those was killed.',englishPlural:' {!{{count}}} of those were killed.',japanese:' そのうち{!{{count}}}人が殺された。'},
  {file:main,line:560,reasonId:'unknown',id:'mortem.general.reason.unknown',original:' {!@1} of those @was killed by something unknown.',englishSingular:' {!{{count}}} of those was killed by something unknown.',englishPlural:' {!{{count}}} of those were killed by something unknown.',japanese:' そのうち{!{{count}}}人が正体不明の何かに殺された。'},
  {file:main,line:561,reasonId:'nuke',id:'mortem.general.reason.nuke',original:" {!@1} didn't read the thermonuclear bomb manual.",englishSingular:" {!{{count}}} didn't read the thermonuclear bomb manual.",englishPlural:" {!{{count}}} didn't read the thermonuclear bomb manual.",japanese:' {!{{count}}}人が熱核爆弾の説明書を読まなかった。'},
  {file:main,line:562,reasonId:'suicide',id:'mortem.general.reason.suicide',original:" And {!@1} couldn't handle the stress and committed a stupid suicide.",englishSingular:" And {!{{count}}} couldn't handle the stress and committed a stupid suicide.",englishPlural:" And {!{{count}}} couldn't handle the stress and committed a stupid suicide.",japanese:' そして{!{{count}}}人がストレスに耐えられず、愚かな自殺をした。'},
].map(branch=>({...branch,bindings:[integer('count','count')],integration:'Branch on existing count at the reason() print sink; retain its XPath/count/zero-return and original @was/@1 producer strings.'}));

export const mortemCompositeTexts=[
  ...[
    ['acid','melted in acid','酸に溶かされた',336],
    ['barrel','was blown up by a barrel','樽の爆発に巻き込まれた',337],
    ['blood','drowned in blood','血の海で溺れた',338],
    ['lava','was consumed by lava','溶岩に飲み込まれた',339],
    ['phase','was torn apart by phasing','位相移動で引き裂かれた',340],
  ].map(([reason,english,japanese,line])=>({file:main,line,id:'mortem.death.'+reason,english,japanese,parameters:{},reason,sourceLiteral:english})),
  {file:core,line:31,id:'mortem.death.by-enemy',english:'killed by {{enemy}}',japanese:'{{enemy}}に殺された',parameters:{enemy:'string'},sourceGuard:'return "killed by "..killer.name'},
  {file:main,line:436,id:'mortem.player.description',english:'level {!{{level}} {{experience_rank}} {{skill_rank}} {{klass}}},',japanese:'レベル {!{{level}} {{experience_rank}} {{skill_rank}} {{klass}}}、',parameters:{level:'integer',experience_rank:'string',skill_rank:'string',klass:'string'},sourceGuard:'local player_description = "level {!"..player.explevel.." "\n\t\t\t..ranks.exp[ ui.get_rank("exp") + 1].name.." "..ranks.skill[ui.get_rank("skill") + 1].name\n\t\t\t.." "..klasses[player.klass].name.."},"'},
  {file:main,line:445,id:'mortem.location.unknown',english:'an Unknown Location',japanese:'所在不明の場所',parameters:{},sourceLiteral:'an Unknown Location'},
  ...[
    ['phobos',' of the Phobos base','フォボス基地の第{{level}}階',604],
    ['deimos',' of the Deimos base','ダイモス基地の第{{level}}階',607],
    ['hell',' of Hell','地獄の第{{level}}階',610],
    ['beyond',' of Beyond','彼方の第{{level}}階',1137],
  ].map(([region,suffix,japanese,line])=>({file:region==='beyond'?'bin/data/drl/challenge.lua':main,line,id:'mortem.location.'+region,english:'level {{level}}'+suffix,japanese,parameters:{level:'integer'},region,suffix,sourceLiteral:suffix})),
  ...[
    ['hellgate','the Hellgate','地獄の門',612],
    ['tower_of_babel','the Tower of Babel','バベルの塔',613],
    ['dis','the City of Dis','ディスの都',614],
    ['hell_fortress','the Hell Fortress','地獄の要塞',615],
  ].map(([script,english,japanese,line])=>({file:main,line,id:'mortem.location.'+script,english,japanese,parameters:{},script,sourceLiteral:english})),
];

// Presentation labels of saved trait-order entries. Original registry abbr,
// FOrder/FCount and English GetHistory bytes remain unchanged. Japanese uses
// the reviewed canonical trait title while English retains the abbreviation.
export const mortemTraitHistoryTexts=[
  ['trait_marine','', '',6],['ironman','Iro','鉄人',16],['finesse','Fin','技巧',34],
  ['hellrunner','HR','地獄の走者',46],['nails','TaN','鉄の体',62],['bitch','SoB','容赦なき攻撃',77],
  ['gun','SoG','銃の申し子',93],['reloader','Rel','装填手',119],['eagle','EE','鷹の目',131],
  ['brute','Bru','怪力',143],['juggler','Jug','ジャグラー',169],['berserker','Ber','バーサーカー',182],
  ['dualgunner','DG','二丁拳銃',236],['dodgemaster','DM','回避の達人',255],['intuition','Int','直感',268],
  ['whizkid','WK','神童',305],['badass','Bad','不屈',318],['shottyman','SM','ショットガンの達人',335],
  ['triggerhappy','TH','乱射魔',358],['blademaster','MBm','剣の達人',379],['vampyre','MVm','吸血鬼',398],
  ['malicious','MMB','邪悪な刃',417],['bulletdance','MBD','弾丸の舞',457],['gunkata','MGK','ガン＝カタ',486],
  ['sharpshooter','MSs','狙撃の達人',528],['armydead','MAD','死者の軍団',571],['shottyhead','MSh','ショットガン狂',584],
  ['fireangel','MFa','炎の天使',603],['ammochain','MAc','無限弾帯',618],['cateye','MCe','猫の目',637],
  ['entrenchment','MEn','陣地防御',650],['survivalist','MSv','生存の達人',676],['runningman','MRM','走り続ける者',691],
  ['gunrunner','MGr','駆ける射手',705],['scavenger','MSc','回収屋',734],
].map(([registryId,english,japanese,line])=>({file:'bin/data/drl/traits.lua',line,registryId,id:'mortem.trait-history.'+registryId.replaceAll('_','-')+'.abbreviation',english,japanese,parameters:{}}));

// Explicit pending sites distinguish untranslated producers from layout/data
// passthrough. Blank rows remain original; no call is silently omitted.
export const pendingMortemSites=[
  {file:core,line:142,originalArgument:'line',role:'graveyard-layout',reason:'Preserve generated ASCII map line and X marker verbatim; no prose translation target.'},
  {file:core,line:286,originalArgument:'"  "..v',role:'saved-history',reason:'Stored English history needs typed semantic records and exact guards at its producer sites; do not use whole-string translation or rewrite saved history.'},
  {file:core,line:293,originalArgument:'" ".. msg',role:'message-history',reason:'Replay available semantic message records, otherwise keep unknown/custom original message fallback. Preserve history order and 15..0 indexing.'},
];

export const requiredMortemNativeApis=[
  {name:'ui.presentation_pad',reason:'Native renderer-width helper requested from parent: append spaces to 10/16/26 display columns without truncation; ignore VTIG markup and count CJK/combining glyphs using renderer advances. The defined Lua wrapper falls back to ASCII padding and leaves non-ASCII text intact until this helper is installed.'},
  {name:'player:get_trait_history_ids()',reason:'Read-only dense ordered trait-ID getter from existing TTraits.FOrder, mirroring GetHistory zero/out-of-range filters and retaining repetitions. The complete Lua helper validates ID/abbr contracts and original whole English guard; absent getter returns original. Native GetHistory and stream bytes stay unchanged.'},
];
// Parent authored both APIs in the native overlay. Standalone use still falls
// back safely before initialization; actual native compilation is a parent gate.
export const pendingMortemPresentationAdapters=[];

function canonical(expression){
  const scan=scanSource(expression,'lua');if(scan.diagnostics.length)throw Error(`Mortem expression lexical diagnostics: ${expression} ${JSON.stringify(scan.diagnostics)}`);
  return JSON.stringify(scan.tokens.map(token=>token.kind==='string'?['string',token.value]:[token.kind,token.raw]));
}
export function scanMortemPrintCalls(source,file){
  const scan=scanSource(source,'lua');if(scan.diagnostics.length)throw Error(`Mortem source diagnostics: ${file}`);
  const tokens=scan.tokens,calls=[];
  for(let index=0;index<tokens.length;index++){
    if(tokens[index].raw!=='player'||tokens[index+1]?.raw!==':'||tokens[index+2]?.raw!=='mortem_print'||tokens[index+3]?.raw!=='(')continue;
    let depth=0,end=index+3;
    for(;end<tokens.length;end++){if(tokens[end].raw==='(')depth++;if(tokens[end].raw===')'&&!--depth)break;}
    if(end>=tokens.length)throw Error('Unclosed original mortem print');
    const argumentTokens=tokens.slice(index+4,end),originalArgument=source.slice(tokens[index+3].end,tokens[end].start).trim();
    calls.push({file,line:tokens[index].line,originalArgument,source:{file,line:tokens[index].line,offset:tokens[index+3].end,endOffset:tokens[end].start,raw:source.slice(tokens[index+3].end,tokens[end].start)},
      classification:argumentTokens.length===0?'blank-line':argumentTokens.length===1&&argumentTokens[0].kind==='string'?'static':'dynamic',
      literal:argumentTokens.length===1&&argumentTokens[0].kind==='string'?argumentTokens[0].value:undefined});
  }
  return calls;
}
function parameters(value){return [...value.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)].map(match=>match[1]).sort();}
function markup(value){return [...value.replace(/\{\{[a-z][a-z0-9_]*\}\}/g,'').matchAll(/\{([a-zA-Z!])/g)].map(match=>match[1]).sort().join(',');}
function reconstruct(expression,bindings,values){
  const tokens=scanSource(expression,'lua').tokens,pieces=[];let start=0,parens=0,brackets=0;
  for(let index=0;index<=tokens.length;index++){
    const token=tokens[index];
    if(index===tokens.length||(token?.raw==='..'&&parens===0&&brackets===0)){
      const part=tokens.slice(start,index);
      if(part.length===1&&part[0].kind==='string')pieces.push(part[0].value);
      else{
        const raw=part.map(token=>token.raw).join(' '),binding=bindings.find(binding=>canonical(binding.originalExpression)===canonical(raw));
        if(!binding)throw Error(`Uncaptured original mortem parameter: ${raw}`);
        pieces.push(String(values[binding.name]));
      }
      start=index+1;continue;
    }
    if(token?.raw==='(')parens++;if(token?.raw===')')parens--;
    if(token?.raw==='[')brackets++;if(token?.raw===']')brackets--;
  }
  return pieces.join('');
}

const q=JSON.stringify;
const luaParam=(name,expression,kind='string')=>`{name=${q(name)},kind=${q(kind)},value=${expression}}`;
const luaText=(id,english,bindings=[])=>`ui.semantic_text(${q(id)},${q(english)},{${bindings.map(([name,expression,kind])=>luaParam(name,expression,kind)).join(',')}})`;
const entryById=id=>[...mortemProducerTexts,...mortemDurationTexts,...mortemCompositeTexts,...mortemTraitHistoryTexts].find(record=>record.id===id);
const textById=(id,bindings=[])=>{const entry=entryById(id);if(!entry)throw Error('Unknown mortem helper ID '+id);return luaText(id,entry.english,bindings);};

/** Complete Lua definitions: no ui.mortem_* call is an unresolved adapter.
 * All writes below are to helper functions or report-local temporary tables.
 * No helper changes player/prototype fields, RNG, score or native save bytes.
 */
export function mortemPresentationLua(){
 const slots=mortemProducerTexts.filter(record=>record.role==='equipment-slot');
 const damages=mortemProducerTexts.filter(record=>record.role==='damage-label');
 const groups=mortemProducerTexts.filter(record=>record.role==='weapon-group-label');
 const reasons=mortemCompositeTexts.filter(record=>record.reason);
 const results=mortemProducerTexts.filter(record=>record.role==='result-display');
 const reasonBranches=mortemReasonBranches.map(branch=>`  [${q(branch.reasonId)}]={singular=${q(branch.englishSingular)},plural=${q(branch.englishPlural)},id=${q(branch.id)}}`).join(',\n');
 const resultRows=results.map(record=>`  [${q(record.id.slice('mortem.result.'.length))}]={id=${q(record.id)},english=${q(record.english)}}`).join(',\n');
 return `
-- DRL semantic presentation overlay; original mortem functions above are retained.
do
 local function semantic(id,english,params)
  return ui.semantic_text(id,english,params or {})
 end
 function ui.mortem_pad(text,columns)
  if ui.presentation_pad then return ui.presentation_pad(text,columns) end
  -- ASCII fallback only. UTF-8 text is never measured in bytes or truncated.
  if not string.find(text,"[^%z\\1-\\127]") then return mortem.padded(text,columns) end
  return text
 end
 function ui.mortem_times(count)
  if count <= 1 then return ${textById('mortem.frequency.once')} end
  return ${textById('mortem.frequency.multiple',[['count','count','integer']])}
 end
 local trait_history_records={${mortemTraitHistoryTexts.map(record=>`[${q(record.registryId)}]={english=${q(record.english)},id=${q(record.id)}}`).join(',')}}
 function ui.mortem_trait_history(subject,english)
  local getter=subject.get_trait_history_ids
  if not getter then return english end
  local ids=getter(subject)
  local original_parts,records={},{}
  for _,index in ipairs(ids) do
   local trait=traits[index]
   local record=trait and trait_history_records[trait.id]
   if not record or record.english~=trait.abbr then return english end
   table.insert(original_parts,record.english.."->")
   table.insert(records,record)
  end
  if table.concat(original_parts,"")~=english then return english end
  local presentation_parts={}
  for _,record in ipairs(records) do table.insert(presentation_parts,semantic(record.id,record.english).."->") end
  return table.concat(presentation_parts,"")
 end
 function ui.mortem_duration(seconds)
  local original=core.seconds_to_string(seconds)
  if seconds <= 0 then
   if original == "0 seconds" then return ${textById('mortem.duration.zero')} end
   return original
  end
  local counts={math.floor(seconds/(60*60*24)),math.floor(seconds/(60*60))%24,math.floor(seconds/60)%60,seconds%60}
  local units={"day","hour","minute","second"}
  local original_parts,presentation_parts={},{}
  for index,count in ipairs(counts) do
   if count ~= 0 then
    local unit=units[index]
    local plural=count>1
    local english="{{count}} "..unit..(plural and "s" or "")
    table.insert(original_parts,count.." "..unit..(plural and "s" or ""))
    table.insert(presentation_parts,semantic("mortem.duration."..unit..(plural and ".plural" or ".singular"),english,{{name="count",kind="integer",value=count}}))
   end
  end
  if #original_parts>1 then
   original_parts[#original_parts-1]=original_parts[#original_parts-1].." and "..original_parts[#original_parts]
   presentation_parts[#presentation_parts-1]=presentation_parts[#presentation_parts-1]..${textById('mortem.duration.and')}..presentation_parts[#presentation_parts]
   table.remove(original_parts);table.remove(presentation_parts)
  end
  if table.concat(original_parts,", ") ~= original then return original end
  return table.concat(presentation_parts,${textById('mortem.duration.separator')})
 end
 local slot_records={${slots.map(record=>`{english=${q(record.english)},id=${q(record.id)}}`).join(',')}}
 function ui.mortem_slot(index,english)
  local record=slot_records[index+1]
  if record and record.english==english then return semantic(record.id,english) end
  return english
 end
 local damage_records={${damages.map(record=>`[${q(record.english)}]=${q(record.id)}`).join(',')}}
 function ui.mortem_damage_name(english)
  local id=damage_records[english]
  if id then return semantic(id,english) end
  return english
 end
 local group_records={${groups.map(record=>`[${q(record.identityKey)}]={english=${q(record.english)},id=${q(record.id)}}`).join(',')}}
 function ui.mortem_weapon_group(group,english)
  local record=group_records[group]
  if record and record.english==english then return semantic(record.id,english) end
  return english
 end
 function ui.mortem_award_tier(award,index)
  local english=award.levels[index].name
  -- Shipped DRL has no register_award definitions. External module tiers keep
  -- their original fallback unless an exact scoped registry record exists.
  return ui.registry_text("award",award.id,"base_game","tier:"..index..".name",english)
 end
 local death_records={${reasons.map(record=>`[${q(record.reason)}]={english=${q(record.english)},id=${q(record.id)}}`).join(',')}}
 local result_records={
${resultRows}
 }
 function ui.mortem_result(result,english,highscore)
  -- Projection only: the original GetResultDescription and THOF.Add stay English.
  if result=="win" or result=="final" or result=="sacrifice" then
   local field=highscore and (ARCHANGEL and "arch_win_highscore" or "win_highscore") or (ARCHANGEL and "arch_win_mortem" or "win_mortem")
   local challenge
   if SCHALLENGE~="" and chal[SCHALLENGE][field] then challenge=chal[SCHALLENGE]
   elseif CHALLENGE~="" and chal[CHALLENGE][field] then challenge=chal[CHALLENGE] end
   if challenge and challenge[field]==english then return ui.registry_text("challenge",challenge.id,"base_game",field,english) end
  end
  if result=="killed" then
   local reason=death_records[player.killedby]
   if reason then
    if reason.english==english then return semantic(reason.id,english) end
    return english
   end
   local killer=beings[player.killedby]
   if killer then
    local field=player.killedmelee and "kill_desc_melee" or "kill_desc"
    if not highscore and killer[field] then
     if killer[field]==english then return ui.registry_text("being",killer.id,"base_game",field,english) end
     return english
    end
    local name=killer.name
    if "killed by "..name==english then return ${textById('mortem.death.by-enemy',[['enemy','ui.registry_text("being",killer.id,"base_game","name",name)']])} end
   end
  end
  local key=result
  if result=="sacrifice" or result=="suicide" then key=result..(highscore and ".highscore" or ".mortem") end
  local record=result_records[key]
  if record and record.english==english then return semantic(record.id,english) end
  local unknown=result_records.unknown
  if english==unknown.english then return semantic(unknown.id,english) end
  return english
 end
 local scripted_locations={${mortemCompositeTexts.filter(record=>record.script).map(record=>`[${q(record.script)}]={english=${q(record.english)},id=${q(record.id)}}`).join(',')}}
 local regions={
  {name="Phobos L",suffix=" of the Phobos base",id="mortem.location.phobos"},
  {name="Deimos L",suffix=" of the Deimos base",id="mortem.location.deimos"},
  {name="Hell L",suffix=" of Hell",id="mortem.location.hell"},
  {name="Beyond L",suffix=" of Beyond",id="mortem.location.beyond"}
 }
 function ui.mortem_location(episode,english)
  if english=="an Unknown Location" then return ${textById('mortem.location.unknown')} end
  if not episode then return english end
  local script=episode.script
  local scripted=script and scripted_locations[script]
  if scripted and scripted.english==english then return semantic(scripted.id,english) end
  if script and levels[script] and levels[script].name==english then
   return ui.registry_text("level",script,"base_game","name",english)
  end
  -- Finite original producer metadata, with a whole English guard. This does
  -- not translate by replacing fragments in stored episode names/deathnames.
  local index=player.level_index
  local a100=CHALLENGE=="challenge_a100" or SCHALLENGE=="challenge_a100"
  local region,count
  if script=="intro" and index==1 then region=regions[1];count=1
  elseif index>=1 and index<=8 then region=regions[1];count=index
  elseif index>=9 and index<=16 then region=regions[2];count=a100 and index or index-8
  elseif index>=17 and (a100 or index<=23) then
   if a100 and index>=25 and index~=(ARCHANGEL and 666 or 100) then region=regions[4] else region=regions[3] end
   count=a100 and index or index-16
  end
  if region and (episode.name==region.name..count or (script=="intro" and index==1)) and english=="level "..count..region.suffix then
   return semantic(region.id,"level {{level}}"..region.suffix,{{name="level",kind="integer",value=count}})
  end
  return english
 end
 local reason_records={
${reasonBranches}
 }
 function ui.mortem_reason(reason,count,english)
  local record=reason_records[reason]
  if not record then return english end
  local plural=count>1
  local template=plural and record.plural or record.singular
  local expected=string.gsub(template,"{{count}}",tostring(count))
  if expected~=english then return english end
  return semantic(record.id..(plural and ".plural" or ".singular"),template,{{name="count",kind="integer",value=count}})
 end
end
`;
}

/** Parent integration seam, operates on pristine source only and returns all
 * reviewed overlays. Catalog records are independent of source mutation.
 */
export function curateMortemSites({file,exact,catalog,patches}){
 const checked=verifyMortemTranslations(),reviewed=[];
 const templates=[...checked.validated,...mortemProducerTexts,...mortemDurationTexts,...mortemCompositeTexts,...mortemTraitHistoryTexts];
 for(const record of templates){
  const parameters=record.parameters??Object.fromEntries((record.bindings??[]).map(binding=>[binding.name,binding.type]));
  catalog(record.id,record.english,record.japanese,parameters);
 }
 for(const branch of mortemReasonBranches)for(const [suffix,english]of [['singular',branch.englishSingular],['plural',branch.englishPlural]])catalog(branch.id+'.'+suffix,english,branch.japanese,{count:'integer'});
 for(const record of checked.validated){
  const source=file(record.file),guard=record.source;
  if(source.slice(guard.offset,guard.endOffset)!==guard.raw)throw Error('Mortem print patch guard mismatch '+record.id);
  const params=record.bindings.map(binding=>[binding.name,binding.presentationExpression,binding.type]);
  const replacement=luaText(record.id,record.english,params);
  patches.push({file:record.file,start:guard.offset,end:guard.endOffset,original:guard.raw,replacement,id:record.id,kind:'semantic-mortem-print'});
  reviewed.push({id:record.id,source:guard,replacement});
 }
 const inventoryOriginal='table.insert( items, { itype = it.itype, nid = it.__proto.nid, desc = item_desc( it ) } )';
 const inventoryReplacement=`local _mortem_itype,_mortem_nid=it.itype,it.__proto.nid
        local _mortem_desc=item_desc(it)
        local _mortem_presentation_desc=_mortem_desc
        if item_desc==mortem.item_desc then _mortem_presentation_desc=ui.item_description(it) end
        table.insert(items,{itype=_mortem_itype,nid=_mortem_nid,desc=_mortem_desc,presentation_desc=_mortem_presentation_desc})`;
 exact(core,inventoryOriginal,inventoryReplacement,'mortem.inventory.item');
 const playerOriginal=entryById('mortem.player.description').sourceGuard;
 const playerReplacement=`local _mortem_level=player.explevel
        local _mortem_exp_index=ui.get_rank("exp")+1
        local _mortem_exp_name=ranks.exp[_mortem_exp_index].name
        local _mortem_skill_index=ui.get_rank("skill")+1
        local _mortem_skill_name=ranks.skill[_mortem_skill_index].name
        local _mortem_klass=klasses[player.klass]
        local _mortem_klass_name=_mortem_klass.name
        local player_description="level {!".._mortem_level.." ".._mortem_exp_name.." ".._mortem_skill_name.." ".._mortem_klass_name.."},"
        local player_description_presentation=${textById('mortem.player.description',[
          ['level','_mortem_level','integer'],
          ['experience_rank','ui.registry_text("rank","exp:".._mortem_exp_index,"base_game","name",_mortem_exp_name)'],
          ['skill_rank','ui.registry_text("rank","skill:".._mortem_skill_index,"base_game","name",_mortem_skill_name)'],
          ['klass','ui.registry_text("klass",_mortem_klass.id,"base_game","name",_mortem_klass_name)'],
        ])}`;
 exact(main,playerOriginal,playerReplacement,'mortem.player.description');
 exact(main,'player:mortem_print( desc:gsub( "@1", count.."" ) )','player:mortem_print( ui.mortem_reason(id,count,desc:gsub( "@1", count.."" )) )','mortem.general.reason.killed.singular');
 const originalCore=file(core),helper=mortemPresentationLua();
 if(digest(Buffer.from(originalCore,'utf8'))!==checked.sourceFiles[core].sha256)throw Error('Original core mortem helper insertion hash mismatch');
 patches.push({file:core,start:originalCore.length,end:originalCore.length,original:'',replacement:helper,id:null,kind:'semantic-mortem-helper-definitions'});
 return {reviewed,helperFunctions:[...helper.matchAll(/function ui\.(mortem_[a-z_]+)\(/g)].map(match=>'ui.'+match[1]),
  catalogTemplates:checked.catalogTemplates,pending:pendingMortemSites,pendingNativeAdapters:pendingMortemPresentationAdapters,requiredNativeApis:requiredMortemNativeApis,
  customFallbacks:['Custom item_desc callback executes once; report ordering retained.','External award modules have no shipped DRL tier catalog; exact scoped registry fallback is English.','Unknown result/location/group/slot values and external player names remain verbatim.'],
  originalGetResultDescriptionUnchanged:true};
}

export const mortemScoreSourceGuard={file:'src/dfhof.pas',sha256:'3808caeaaa8d530cd4ec8b66d2b56a2b588836a7326b00da7e1537c2794a667d',displayLine:694,original:'iString += Padded(iKill,34);',persistedAttributeLine:941};
export const mortemScoreBeingGuards=[
 ['former','former human',7],['sergeant','former sergeant',32],['captain','former captain',59],['commando','former commando',85],
 ['imp','imp',115],['demon','demon',159],['lostsoul','lost soul',184],['cacodemon','cacodemon',211],['knight','hell knight',253],
 ['baron','baron of hell',301],['arachno','arachnotron',348],['pain','pain elemental',391],['revenant','revenant',424],
 ['mancubus','mancubus',473],['arch','arch-vile',521],['eformer','elite former human',570],['esergeant','elite former sergeant',606],
 ['ecaptain','elite former captain',644],['ecommando','elite former commando',681],['nimp','nightmare imp',720],['ndemon','nightmare demon',766],
 ['nlostsoul','nightmare soul',790],['ncacodemon','nightmare cacodemon',816],['nknight','nightmare knight',861],
 ['narachno','nightmare arachnotron',912],['npain','nightmare elemental',955],['nrevenant','nightmare revenant',987],
 ['nmancubus','nightmare mancubus',1037],['narch','nightmare arch-vile',1089],['bruiser','bruiser brother',1140],['shambler','shambler',1195],
 ['lava_elemental','lava elemental',1255],['agony','agony elemental',1321],['angel','Angel of Death',1358],['cyberdemon','Cyberdemon',1398],
 ['mastermind','Spider Mastermind',1453],['jc','John Carmack',1512],['apostle','Apostle',1571],
].map(([registryId,english,line])=>({file:'bin/data/drl/beings.lua',registryId,english,line}));

/** Bounded legacy score-column decoder. The historical XML does not contain
 * killedby/result IDs; interpret only complete known source-produced values.
 * This is deliberately isolated to the owned HOF column, with exact source ID,
 * abbreviation/prototype name and full English reconstruction guards. Neither
 * current-player state nor arbitrary substring replacement is used. Ambiguous,
 * malformed, changed or custom legacy values retain their original bytes.
 */
export function mortemScorePresentationLua(){
 const staticRecords=[...mortemProducerTexts.filter(record=>record.role==='result-display'&&!record.id.endsWith('.mortem')),...mortemCompositeTexts.filter(record=>record.reason)];
 const abbreviationToId=Object.fromEntries(Object.entries(reviewedChallengeMechanics).map(([id,record])=>[record.abbr,id]));
 const challengeRecords=Object.entries(reviewedChallengeMechanics).map(([id,record])=>({id,abbr:record.abbr,archRank:record.arch_rank,
  allowed:[id,...(record.secondary??[]).map(abbr=>abbreviationToId[abbr]).filter(Boolean)]}));
 const challengeWins=Object.entries(reviewedChallengeFields).flatMap(([id,fields])=>['win_highscore','arch_win_highscore'].filter(field=>fields[field]).map(field=>({id,field,english:fields[field].english,abbr:reviewedChallengeMechanics[id].abbr})));
 return `
-- Original Hall-of-Fame English column compatibility projection (source guarded).
do
 local score_literals={${staticRecords.map(record=>`{id=${q(record.id)},english=${q(record.english)}}`).join(',')}}
 local score_beings={${mortemScoreBeingGuards.map(record=>`{id=${q(record.registryId)},english=${q(record.english)}}`).join(',')}}
 local score_challenges={${challengeRecords.map(record=>`[${q(record.abbr)}]={id=${q(record.id)},arch_rank=${record.archRank??'nil'},allowed={${record.allowed.map(id=>`[${q(id)}]=true`).join(',')}}}`).join(',')}}
 local score_wins={${challengeWins.map(record=>`{id=${q(record.id)},abbr=${q(record.abbr)},field=${q(record.field)},arch=${record.field==='arch_win_highscore'},english=${q(record.english)}}`).join(',')}}
 function ui.mortem_score_result(english,challenge_abbreviation)
  if type(english)~="string" or #english>32768 or string.find(english,"%z") then return english end
  if type(challenge_abbreviation)~="string" or #challenge_abbreviation>128 or string.find(challenge_abbreviation,"%z") then return english end
  local translated,found,ambiguous
  local function offer(value)
   if not found then translated=value;found=true
   elseif translated~=value then ambiguous=true end
  end
  for _,record in ipairs(score_literals) do
   if record.english==english then offer(ui.semantic_text(record.id,record.english,{})) end
  end
  local challenge_guard=score_challenges[challenge_abbreviation]
  local challenge=challenge_guard and chal[challenge_guard.id]
  if challenge and challenge.abbr==challenge_abbreviation then
   for _,record in ipairs(score_wins) do
    local winner=chal[record.id]
    if challenge_guard.allowed[record.id] and (not record.arch or (challenge_guard.arch_rank and challenge.arch_rank==challenge_guard.arch_rank)) and winner and winner.abbr==record.abbr and winner[record.field]==record.english and english==record.english then
     offer(ui.registry_text("challenge",record.id,"base_game",record.field,record.english))
    end
   end
  end
  for _,record in ipairs(score_beings) do
   local killer=beings[record.id]
   if killer and killer.name==record.english and english=="killed by "..record.english then
    local name=ui.registry_text("being",record.id,"base_game","name",record.english)
    offer(${textById('mortem.death.by-enemy',[['enemy','name']])})
   end
  end
  if found and not ambiguous then return translated end
  return english
 end
end
`;
}

export function curateMortemScoreSites({file,exact,patches}){
 const checked=verifyMortemTranslations();verifyChallengeFields();
 const hof=file(mortemScoreSourceGuard.file),coreSource=file(core);
 if(digest(Buffer.from(hof,'utf8'))!==mortemScoreSourceGuard.sha256)throw Error('Original archive score source hash mismatch');
 if(digest(Buffer.from(coreSource,'utf8'))!==checked.sourceFiles[core].sha256)throw Error('Original score helper insertion source mismatch');
 const originalProducer="VS := LuaSystem.ProtectedCall([CoreModuleID,'GetResultDescription'],[iGameResultID,true]);";
 const originalSave="iScoreEntry.SetAttribute('killed', VS );";
 if(!hof.includes(originalProducer)||!hof.includes(originalSave))throw Error('Original persisted score English producer/attribute mismatch');
 const beingSource=file('bin/data/drl/beings.lua');
 if(digest(Buffer.from(beingSource,'utf8'))!==checked.sourceFiles['bin/data/drl/beings.lua'].sha256)throw Error('Original archive killer source hash mismatch');
 const beingTokens=scanSource(beingSource,'lua').tokens;
 let id='';const guards=[];
 for(let index=0;index<beingTokens.length;index++){
  const token=beingTokens[index];
  if(token.raw==='register_being'&&beingTokens[index+1]?.kind==='string')id=beingTokens[index+1].value;
  if(token.raw==='name'&&beingTokens[index+1]?.raw==='='&&beingTokens[index+2]?.kind==='string')guards.push({id,token:beingTokens[index+2]});
 }
 for(const record of mortemScoreBeingGuards)if(guards.filter(guard=>guard.id===record.registryId&&guard.token.line===record.line&&guard.token.value===record.english).length!==1)throw Error('Archive killer ID/name guard mismatch '+record.registryId);
 const replacement=`iString += AnsiString(LuaSystem.ProtectedCall(['ui','presentation_pad'],[LuaSystem.ProtectedCall(['ui','mortem_score_result'],[iKill,iChal]),34]));`;
 exact(mortemScoreSourceGuard.file,mortemScoreSourceGuard.original,replacement,null);
 patches.push({file:core,start:coreSource.length,end:coreSource.length,original:'',replacement:mortemScorePresentationLua(),id:null,kind:'semantic-mortem-score-compatibility'});
 return {newCatalogIds:0,requiredCatalogIds:['mortem.death.by-enemy',...mortemProducerTexts.filter(record=>record.role==='result-display'&&!record.id.endsWith('.mortem')).map(record=>record.id),...mortemCompositeTexts.filter(record=>record.reason).map(record=>record.id)],
  reviewedBeingNames:38,reviewedChallengeAbbreviations:15,displayFile:mortemScoreSourceGuard.file,displayLine:694,sourceSha256:mortemScoreSourceGuard.sha256,
  bounds:{storedEnglishBytes:32768,challengeAbbreviationBytes:128,beingCandidates:38,challengeCandidates:15,winFields:2,staticResultCandidates:11},
  originalPersistenceUnchanged:true,currentPlayerStateUsed:false,unknownLegacyFallback:'verbatim',ambiguousLegacyFallback:'verbatim',runtimeExecuted:false};
}

export function verifyMortemTranslations(upstreamRoot=path.resolve(here,'../upstream/drl'),records=[...staticMortemMessages,...dynamicMortemMessages]){
  const lock=JSON.parse(readFileSync(path.join(here,'registry-sources.lock.json'),'utf8'));
  if(lock.sourceCommit!==sourceCommit||Object.keys(lock.sources).length!==83)throw Error('Original mortem 83-Lua source lock mismatch');
  const sources=new Map(),sourceFiles={},allCalls=[];
  for(const [file,guard]of Object.entries(lock.sources)){
    const bytes=readFileSync(path.join(upstreamRoot,file));
    if(bytes.length!==guard.bytes||digest(bytes)!==guard.sha256)throw Error(`Original mortem source hash mismatch: ${file}`);
    const text=bytes.toString('utf8'),scan=scanSource(text,'lua');if(scan.diagnostics.length)throw Error('Original source scanner error');
    sources.set(file,{text,tokens:scan.tokens,lines:text.split('\n')});sourceFiles[file]=guard;
    allCalls.push(...scanMortemPrintCalls(text,file));
  }
  const shipped=allCalls.filter(call=>call.file.startsWith('bin/data/core/')||call.file.startsWith('bin/data/drl/'));
  if(shipped.length!==112||shipped.filter(call=>call.file===core).length!==44||shipped.filter(call=>call.file===main).length!==68)throw Error('Original shipped mortem print topology mismatch');
  const claimed=new Set(),ids=new Set(),validated=[];
  function check(id,english,japanese,bindings){
    if(ids.has(id))throw Error(`Duplicate mortem semantic ID: ${id}`);ids.add(id);
    if(JSON.stringify(parameters(english))!==JSON.stringify(parameters(japanese)))throw Error(`Mortem placeholder mismatch: ${id}`);
    if(markup(english)!==markup(japanese))throw Error(`Mortem VTIG color tags changed: ${id}`);
    const contracts=Object.fromEntries(bindings.map(binding=>[binding.name,binding.type]));
    if(JSON.stringify([...new Set(parameters(english))].sort())!==JSON.stringify(Object.keys(contracts).sort()))throw Error(`Mortem typed contract mismatch: ${id}`);
    const values=Object.fromEntries(bindings.map(binding=>[binding.name,binding.type==='integer'?23:`<${binding.name}>{R{{verbatim}}}`]));
    render({[id]:english},{[id]:contracts},id,values);render({[id]:japanese},{[id]:contracts},id,values);
    for(const binding of bindings){
      if(!['integer','string'].includes(binding.type)||binding.evaluation!=='once'||!binding.presentationExpression)throw Error('Invalid mortem binding');
      if(/\b(?:math\.random|math\.randomseed|table\.random_pick|add_badge|add_history|set_|kill\s*\()/.test(binding.presentationExpression))throw Error('Gameplay operation in mortem presentation binding');
    }
    return {contracts,values};
  }
  for(const record of records){
    const matches=shipped.filter(call=>call.file===record.file&&call.line===record.line);
    if(matches.length!==1||canonical(matches[0].originalArgument)!==canonical(record.originalArgument))throw Error(`Mortem exact print argument guard mismatch: ${record.file}:${record.line}`);
    const key=`${record.file}:${record.line}`;if(claimed.has(key))throw Error('Mortem print claimed twice');claimed.add(key);
    const {contracts,values}=check(record.id,record.english,record.japanese,record.bindings);
    if(matches[0].classification==='static'){
      if(matches[0].literal!==record.english)throw Error('Mortem static English guard mismatch');
    }else if(reconstruct(record.originalArgument,record.bindings,values)!==render({[record.id]:record.english},{[record.id]:contracts},record.id,values))throw Error(`Incomplete original mortem English reconstruction: ${record.id}`);
    validated.push({...record,source:matches[0].source});
  }
  for(const pending of pendingMortemSites){
    const matches=shipped.filter(call=>call.file===pending.file&&call.line===pending.line);
    if(matches.length!==1||canonical(matches[0].originalArgument)!==canonical(pending.originalArgument))throw Error('Pending mortem source guard mismatch');
    const key=`${pending.file}:${pending.line}`;if(claimed.has(key))throw Error('Pending mortem call overlaps reviewed');claimed.add(key);
  }
  const reasonSink=shipped.find(call=>call.file===main&&call.line===556);
  if(!reasonSink||canonical(reasonSink.originalArgument)!==canonical('desc:gsub( "@1", count.."" )'))throw Error('Finite reason sink guard mismatch');
  claimed.add(`${main}:556`);
  const blanks=shipped.filter(call=>call.classification==='blank-line');
  if(blanks.length!==34||shipped.some(call=>call.classification!=='blank-line'&&!claimed.has(`${call.file}:${call.line}`)))throw Error('Uninventoried mortem print call');
  const producerSources=[];
  for(const producer of mortemProducerTexts){
    const source=sources.get(producer.file),tokens=source.tokens.filter(token=>token.line===producer.line&&token.kind==='string');
    const guard=producer.english==='{{count}} times'?' times':producer.english;
    const matches=tokens.filter(token=>token.value===guard);
    if(matches.length!==1)throw Error(`Mortem producer literal guard mismatch: ${producer.id}`);
    check(producer.id,producer.english,producer.japanese,producer.bindings??[]);
    producerSources.push({...producer,source:{file:producer.file,line:matches[0].line,offset:matches[0].start,endOffset:matches[0].end,raw:matches[0].raw}});
  }
  for(const record of mortemDurationTexts){
    const source=sources.get(record.file);
    const guard=record.unit??record.english;
    const token=source.tokens.find(token=>token.line===record.line&&token.kind==='string'&&token.value===guard);
    if(!token)throw Error(`Mortem duration source guard mismatch: ${record.id}`);
    check(record.id,record.english,record.japanese,Object.entries(record.parameters).map(([name,type])=>bind(name,type,'v')));
    producerSources.push({...record,source:{file:record.file,line:token.line,offset:token.start,endOffset:token.end,raw:token.raw}});
  }
  for(const branch of mortemReasonBranches){
    const source=sources.get(branch.file),tokens=source.tokens.filter(token=>token.line===branch.line&&token.kind==='string');
    if(!tokens.some(token=>token.value===branch.reasonId)||!tokens.some(token=>token.value===branch.original))throw Error(`Finite mortem reason source guard mismatch: ${branch.reasonId}`);
    for(const [suffix,english]of [['singular',branch.englishSingular],['plural',branch.englishPlural]]){
      check(branch.id+'.'+suffix,english,branch.japanese,branch.bindings);
      const original=branch.original.replace('@1','{{count}}').replace('@was',suffix==='singular'?'was':'were');
      if(original!==english)throw Error('Finite mortem reason English/plural reconstruction mismatch');
    }
  }
  for(const record of mortemCompositeTexts){
    const source=sources.get(record.file);
    let guard;
    if(record.sourceLiteral){
      const tokens=source.tokens.filter(token=>token.line===record.line&&token.kind==='string'&&token.value===record.sourceLiteral);
      if(tokens.length!==1)throw Error('Mortem composite literal guard mismatch '+record.id);
      guard={file:record.file,line:record.line,offset:tokens[0].start,endOffset:tokens[0].end,raw:tokens[0].raw};
    }else{
      const offset=source.text.indexOf(record.sourceGuard);
      if(offset<0||source.text.indexOf(record.sourceGuard,offset+1)>=0)throw Error('Mortem composite producer source mismatch '+record.id);
      guard={file:record.file,line:record.line,offset,endOffset:offset+record.sourceGuard.length,raw:record.sourceGuard};
    }
    check(record.id,record.english,record.japanese,Object.entries(record.parameters).map(([name,type])=>bind(name,type,name)));
    producerSources.push({...record,source:guard});
  }
  const traitTokens=sources.get('bin/data/drl/traits.lua').tokens;
  let traitId='';
  const traitAbbreviations=[];
  for(let index=0;index<traitTokens.length;index++){
    const token=traitTokens[index];
    if(token.raw==='register_trait'&&traitTokens[index+1]?.kind==='string')traitId=traitTokens[index+1].value;
    if(token.raw==='abbr'&&traitTokens[index+1]?.raw==='='&&traitTokens[index+2]?.kind==='string')traitAbbreviations.push({registryId:traitId,token:traitTokens[index+2]});
  }
  if(traitAbbreviations.length!==35||mortemTraitHistoryTexts.length!==35)throw Error('Trait abbreviation inventory mismatch');
  for(const record of mortemTraitHistoryTexts){
    const matches=traitAbbreviations.filter(entry=>entry.registryId===record.registryId&&entry.token.line===record.line&&entry.token.value===record.english);
    if(matches.length!==1)throw Error('Trait ID/abbreviation source guard mismatch '+record.id);
    check(record.id,record.english,record.japanese,[]);
    const token=matches[0].token;
    producerSources.push({...record,source:{file:record.file,line:token.line,offset:token.start,endOffset:token.end,raw:token.raw}});
  }
  const hof=readFileSync(path.join(upstreamRoot,'src/dfhof.pas'),'utf8');
  if(!hof.includes("LuaSystem.ProtectedCall([CoreModuleID,'GetResultDescription'],[iGameResultID,true])"))throw Error('Persisted English result call seam mismatch');
  return {sourceCommit,lockedLuaSources:83,shippedPrintCalls:shipped.length,reviewedStaticPrints:staticMortemMessages.length,reviewedDynamicPrints:dynamicMortemMessages.length,
    reviewedPrintTemplates:validated.length,reviewedProducerTexts:mortemProducerTexts.length,reviewedDurationTexts:mortemDurationTexts.length,reviewedCompositeTexts:mortemCompositeTexts.length,reviewedTraitHistoryLabels:mortemTraitHistoryTexts.length,reviewedFiniteReasonBranches:4,reviewedReasonTemplates:8,
    catalogTemplates:ids.size,unchangedBlankLines:blanks.length,pendingPrintSites:pendingMortemSites.length,pendingPresentationAdapters:pendingMortemPresentationAdapters.length,
    sourceFiles,validated,producerSources,originalGameplayExecuted:false,originalDomainModified:false,runtimeAdapterConnected:false};
}

export function verifyMortemOverlay(upstreamRoot=path.resolve(here,'../upstream/drl')){
 const patches=[],en={},ja={},contracts={},cache=new Map(),checks=[];
 const file=f=>{if(!cache.has(f))cache.set(f,readFileSync(path.join(upstreamRoot,f),'utf8'));return cache.get(f);};
 const exact=(f,original,replacement,id)=>{
  const source=file(f),start=source.indexOf(original);
  if(start<0||source.indexOf(original,start+1)>=0)throw Error('Mortem overlay exact seam mismatch '+id);
  patches.push({file:f,start,end:start+original.length,original,replacement,id});
 };
 const catalog=(id,english,japanese,parameters={})=>{
  if(en[id]!==undefined)throw Error('Duplicate overlay catalog ID '+id);
  en[id]=english;ja[id]=japanese;contracts[id]=parameters;
 };
 const result=curateMortemSites({file,exact,catalog,patches}),overlays=new Map();
 for(const f of new Set(patches.map(patch=>patch.file))){
  const source=file(f),sorted=patches.filter(patch=>patch.file===f).sort((a,b)=>a.start-b.start);
  for(let index=0;index<sorted.length;index++){
   const patch=sorted[index];
   if(patch.start<0||patch.end<patch.start||patch.end>source.length||source.slice(patch.start,patch.end)!==patch.original)throw Error('Invalid mortem patch guard');
   if(index&&sorted[index-1].end>patch.start)throw Error('Overlapping mortem source patches');
  }
  let overlay=source;for(const patch of [...sorted].reverse())overlay=overlay.slice(0,patch.start)+patch.replacement+overlay.slice(patch.end);
  const lexical=scanSource(overlay,'lua');if(lexical.diagnostics.length)throw Error('Generated mortem Lua lexical diagnostics '+JSON.stringify(lexical.diagnostics));
  overlays.set(f,overlay);
 }
 checks.push('78 guarded nonoverlapping patches in two original Lua files');
 const helper=mortemPresentationLua(),scan=scanSource(helper,'lua'),blocks=[],delimiters=[];
 for(const token of scan.tokens){
  const v=token.raw;
  if(['(', '[','{'].includes(v))delimiters.push(v);
  if([')',']','}'].includes(v)&&delimiters.pop()!==({')':'(',']':'[','}':'{'}[v]))throw Error('Unbalanced generated Lua delimiter');
  if(['function','if','for','while','repeat'].includes(v)&&token.kind!=='string')blocks.push({kind:v,awaitDo:v==='for'||v==='while'});
  else if(v==='do'){
   const owner=blocks.findLast(block=>block.awaitDo);if(owner)owner.awaitDo=false;else blocks.push({kind:'do'});
  }else if(v==='end'||v==='until'){
   const owner=blocks.pop();if(!owner||((v==='until')!==(owner.kind==='repeat')))throw Error('Unbalanced generated Lua block');
  }
 }
 if(blocks.length||delimiters.length)throw Error('Unclosed generated Lua helper syntax');
 const helperDefinitions=new Set(result.helperFunctions);
 for(const overlay of overlays.values())for(const match of overlay.matchAll(/ui\.(mortem_[a-z_]+)\s*\(/g))if(!helperDefinitions.has('ui.'+match[1]))throw Error('Undefined Lua presentation helper '+match[1]);
 checks.push('all 11 ui.mortem helper calls have complete definitions and balanced Lua syntax');
 const source=file(main),overlay=overlays.get(main);
 const resultStart=source.indexOf('function drl.GetResultDescription('),resultEnd=source.indexOf('\nfunction drl.RunPrintMortem()',resultStart);
 if(!overlay.includes(source.slice(resultStart,resultEnd)))throw Error('Persisted English result function changed');
 for(const original of [
  'table.sort( items, function(a,b) if (a.itype ~= b.itype) then return a.itype < b.itype else return a.nid < b.nid end end )',
  'if n <= 1 then return "once" else return n.." times" end',
  'function mortem.item_desc( item )\n\treturn item.desc\nend',
 ])if(!overlays.get(core).includes(original))throw Error('Original mortem order/callback/frequency producer changed');
 if(scan.tokens.some(token=>['random','randomseed','add_history','kill','set_name'].includes(token.raw)))throw Error('Gameplay operation in mortem helper');
 checks.push('original persisted result, item callback, report sort and frequency branches unchanged; no RNG/domain mutation helper');
 const capture=overlays.get(core).slice(overlays.get(core).indexOf('local _mortem_itype'),overlays.get(core).indexOf('table.sort( items'));
 if((capture.match(/item_desc\(it\)/g)??[]).length!==1)throw Error('Inventory callback evaluated more than once');
 const description=overlay.slice(overlay.indexOf('local _mortem_level'),overlay.indexOf('if string.len(player.name)'));
 for(const expression of ['ui.get_rank("exp")','ui.get_rank("skill")'])if(description.split(expression).length!==2)throw Error('Rank producer evaluated more than once');
 if((helper.match(/core\.seconds_to_string\(seconds\)/g)??[]).length!==1)throw Error('Original duration producer evaluated more than once');
 checks.push('custom inventory callback, both rank getters and original duration producer evaluate once');
 for(const branch of mortemReasonBranches)for(const count of [1,2,23,2147483647]){
  const suffix=count>1?'plural':'singular',id=branch.id+'.'+suffix;
  const original=branch.original.replace('@was',count>1?'were':'was').replace('@1',String(count));
  if(render(en,contracts,id,{count})!==original)throw Error('Mortem reason branch differs from original');
  if(!render(ja,contracts,id,{count}).includes(String(count)))throw Error('Japanese reason omits count');
 }
 checks.push('16 finite singular/plural report branch examples reconstruct exact English');
 const durationCases=[0,-1,1,2,59,60,61,3599,3600,3661,86400,90061,315576000];
 for(const seconds of durationCases){
  if(seconds<=0){if(render(en,contracts,'mortem.duration.zero',{})!=='0 seconds')throw Error('Duration zero mismatch');continue;}
  const counts=[Math.floor(seconds/86400),Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60],units=['day','hour','minute','second'];
  const original=[],english=[],japanese=[];
  for(let index=0;index<4;index++)if(counts[index]){
   const count=counts[index],unit=units[index],plural=count>1,id='mortem.duration.'+unit+(plural?'.plural':'.singular');
   original.push(count+' '+unit+(plural?'s':''));english.push(render(en,contracts,id,{count}));japanese.push(render(ja,contracts,id,{count}));
  }
  for(const parts of [original,english,japanese])if(parts.length>1){parts[parts.length-2]+=parts===japanese?ja['mortem.duration.and']:en['mortem.duration.and'];parts[parts.length-2]+=parts.pop();}
  if(original.join(', ')!==english.join(en['mortem.duration.separator']))throw Error('Duration English decomposition changed');
  if(!japanese.join(ja['mortem.duration.separator']).length)throw Error('Japanese duration empty');
 }
 checks.push('13 duration cases preserve original zero/unit/order/conjunction rules');
 for(const record of mortemTraitHistoryTexts)if(en[record.id]!==record.english||ja[record.id]!==record.japanese)throw Error('Trait history label mismatch');
 checks.push('all 35 trait abbreviations remain original English and Japanese canonical labels');
 const externalName='外部User{RName}\\literal';
 const playerLine=render(ja,contracts,'mortem.report.player-short-name',{name:externalName,description:'説明'});
 if(!playerLine.includes(externalName))throw Error('External player name changed');
 checks.push('external usernames preserved verbatim through typed parameters');
 return {catalogTemplates:Object.keys(en).length,sourcePatches:patches.length,helperFunctions:helperDefinitions.size,overlayFiles:overlays.size,sourceOnlyChecks:checks.length,checks,
  originalGameplayExecuted:false,luaRuntimeExecuted:false,requiredNativeApis:result.requiredNativeApis.map(record=>record.name),pendingNativeAdapters:result.pendingNativeAdapters.map(record=>record.name),pendingPrintSites:result.pending.map(record=>({file:record.file,line:record.line,role:record.role}))};
}

export function verifyMortemScoreOverlay(upstreamRoot=path.resolve(here,'../upstream/drl')){
 const patches=[],en={},ja={},contracts={},cache=new Map();
 const file=f=>{if(!cache.has(f))cache.set(f,readFileSync(path.join(upstreamRoot,f),'utf8'));return cache.get(f);};
 const exact=(f,original,replacement,id)=>{
  const source=file(f),start=source.indexOf(original);
  if(start<0||source.indexOf(original,start+1)>=0)throw Error('Archive score exact display seam mismatch');
  patches.push({file:f,start,end:start+original.length,original,replacement,id});
 };
 const catalog=(id,english,japanese,parameters={})=>{en[id]=english;ja[id]=japanese;contracts[id]=parameters;};
 curateMortemSites({file,exact,catalog,patches});
 const result=curateMortemScoreSites({file,exact,patches}),helper=mortemScorePresentationLua(),scanned=scanSource(helper,'lua');
 if(scanned.diagnostics.length)throw Error('Archive score Lua lexical diagnostics');
 for(const token of scanned.tokens)if(token.kind!=='string'&&['player','random','randomseed','add_history','set_name','GetResultDescription','SetAttribute'].includes(token.raw))throw Error('Current player, RNG, hook or storage mutation used by archive compatibility helper');
 const source=file(mortemScoreSourceGuard.file),scorePatches=patches.filter(patch=>patch.file===mortemScoreSourceGuard.file);
 if(scorePatches.length!==1||scorePatches[0].original!==mortemScoreSourceGuard.original)throw Error('Archive score changed more than display expression');
 const patch=scorePatches[0],overlay=source.slice(0,patch.start)+patch.replacement+source.slice(patch.end);
 for(const guard of ["VS := LuaSystem.ProtectedCall([CoreModuleID,'GetResultDescription'],[iGameResultID,true]);","iScoreEntry.SetAttribute('killed', VS );","iKill  := iElement.GetAttribute('killed');"])
  if(!overlay.includes(guard))throw Error('Original stored score English read/producer/write changed');
 const projected=[];
 for(const record of [...mortemProducerTexts.filter(record=>record.role==='result-display'&&!record.id.endsWith('.mortem')),...mortemCompositeTexts.filter(record=>record.reason)]){
  if(render(en,contracts,record.id,{})!==record.english)throw Error('Legacy result whole English candidate guard mismatch');projected.push(record.english);
 }
 for(const record of mortemScoreBeingGuards){
  const complete='killed by '+record.english;
  if(render(en,contracts,'mortem.death.by-enemy',{enemy:record.english})!==complete)throw Error('Legacy killer whole English producer reconstruction mismatch');
  projected.push(complete);
 }
 const challengeCases=[];
 for(const [id,fields]of Object.entries(reviewedChallengeFields))for(const field of ['win_highscore','arch_win_highscore'])if(fields[field]){
  const original=fields[field].english;
  for(const [primaryId,mechanics]of Object.entries(reviewedChallengeMechanics))if((primaryId===id||(mechanics.secondary??[]).includes(reviewedChallengeMechanics[id].abbr))&&(field!=='arch_win_highscore'||mechanics.arch_rank!==undefined))challengeCases.push({primaryId,abbr:mechanics.abbr,id,field,original,japanese:fields[field].japanese});
 }
 if(challengeCases.length!==13)throw Error('Original eligible primary/secondary score result topology changed');
 const known=new Set(projected.concat(challengeCases.map(record=>record.original)));
 for(const unknown of ['','killed by custom enemy','mod won elsewhere','xdefeated the Mastermind','defeated the Mastermindx','completed 100 levels!','defeated the Mastermind\0'])if(known.has(unknown))throw Error('Custom/substring/malformed legacy candidate accepted');
 if(Object.keys(en).length!==175||result.newCatalogIds!==0)throw Error('Archive score projection unexpectedly changes frozen catalog IDs');
 return {...result,combinedCatalogTemplates:175,combinedSourcePatches:patches.length,combinedOverlayFiles:new Set(patches.map(patch=>patch.file)).size,
  completeEnglishCandidateChecks:projected.length,eligibleChallengeCases:challengeCases.length,unknownOrMalformedRejections:7,
  sourceOnlyChecks:['native patch confined to original display expression','historical XML read and English producer/save unchanged','no current-player/RNG/hook/save references in Lua helper','49 complete English result/killer candidates reconstructed','13 source-eligible primary/secondary challenge cases','unknown/custom/substring/NUL fallbacks excluded','frozen 175 catalog IDs unchanged'],luaRuntimeExecuted:false};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyMortemTranslations();
  const mutations=[];
  for(const [label,mutate]of [
    ['source English expression',records=>{records[0].originalArgument='"tampered"';}],
    ['typed parameter missing',records=>{records.find(record=>record.id==='mortem.summary.turns-score').bindings.pop();}],
    ['Japanese placeholder missing',records=>{records.find(record=>record.id==='mortem.summary.turns-score').japanese='全部訳した。';}],
    ['VTIG color tag changed',records=>{records[0].japanese='{Rなし}';}],
    ['RNG in presentation binding',records=>{records.find(record=>record.id==='mortem.summary.seed').bindings[0].presentationExpression='math.random(100)';}],
  ]){
    const changed=structuredClone([...staticMortemMessages,...dynamicMortemMessages]);mutate(changed);
    let rejected=false;try{verifyMortemTranslations(undefined,changed);}catch{rejected=true;}
    if(!rejected)throw Error(`Mortem mutation accepted: ${label}`);mutations.push(label);
  }
  console.log(JSON.stringify({...result,sourceFiles:undefined,validated:undefined,producerSources:undefined,overlay:verifyMortemOverlay(),archiveScore:verifyMortemScoreOverlay(),mutationChecks:mutations.length,mutationCases:mutations},null,2));
}
