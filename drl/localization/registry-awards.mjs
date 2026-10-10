/** Reviewed original DRL award presentation fields (GPL-2.0).
 * This authoring sidecar is keyed by original category, registry ID and field.
 * It never changes registry values, award conditions, tiers or saved IDs.
 * Source: DRL 0_10_11a, a6f965072b3a25b768c91dbced00367f1b57d865.
 */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const tiers={1:['Bronze','銅'],2:['Silver','銀'],3:['Gold','金'],4:['Platinum','プラチナ'],5:['Diamond','ダイヤモンド'],6:['Angelic','天使']};
const reviewed={badge:{},medal:{}};
function add(category,id,englishName,japaneseName,englishDesc,japaneseDesc){
 if(reviewed[category][id])throw Error(`Duplicate reviewed award: ${category}:${id}`);
 reviewed[category][id]={name:{english:englishName,japanese:japaneseName},desc:{english:englishDesc,japanese:japaneseDesc}};
}
// Tier interpolation is authoring by explicit registry ID, never rendered-English replacement.
function badges(prefix,englishFamily,japaneseFamily,rows){
 for(const[tier,englishDesc,japaneseDesc]of rows){
  const[en,ja]=tiers[tier];
  add('badge',`${prefix}${tier}`,`${englishFamily} ${en} Badge`,`${japaneseFamily}・${ja}バッジ`,englishDesc,japaneseDesc);
 }
}
badges('technician','Technician','技術者',[
 [1,'Discover an assembly','組立品を1種類発見する'],
 [2,'Discover an advanced assembly','上級組立品を1種類発見する'],
 [3,'Discover {!all} basic assemblies','基本組立品を{!すべて}発見する'],
 [4,'Discover {!all} advanced assemblies','上級組立品を{!すべて}発見する'],
 [5,'Discover {!all} assemblies','組立品を{!すべて}発見する'],
]);
badges('armorer','Armorer','武具職人',[
 [1,'Discover 10 exotics/uniques','エキゾチック／ユニーク装備を10種類発見する'],
 [2,'Discover 30 exotics/uniques','エキゾチック／ユニーク装備を30種類発見する'],
 [3,'Discover {!all} exotics/uniques','エキゾチック／ユニーク装備を{!すべて}発見する'],
 [4,'Find {!1,000} exotics/uniques','エキゾチック／ユニーク装備を{!1,000}個発見する'],
 [5,'Find 3 of {!each} exotic/unique','エキゾチック／ユニーク装備を{!各種類}3個発見する'],
]);
badges('heroic','Heroic','英雄',[
 [1,'Receive 8 unique medals','異なる勲章を8種類獲得する'],
 [2,'Receive 16 unique medals','異なる勲章を16種類獲得する'],
 [3,'Receive 24 unique medals','異なる勲章を24種類獲得する'],
 [4,'Receive 32 unique medals','異なる勲章を32種類獲得する'],
 [5,'Receive {!all} medals','勲章を{!すべて}獲得する'],
]);
badges('buac','UAC','UAC',[
 [1,'Win {!standard} game on any difficulty','難易度を問わず{!通常}ゲームで勝利する'],
 [2,'Win {!standard} game on Hurt Me Plenty','「たっぷり痛めつけてくれ」で{!通常}ゲームに勝利する'],
 [3,'Win {!standard} game on Ultra-Violence','「超暴力」で{!通常}ゲームに勝利する'],
 [4,'Win {!standard} game on N!','N!で{!通常}ゲームに勝利する'],
 [5,'Win {!standard} N! game under 20 min','N!の{!通常}ゲームで20分未満で勝利する'],
 [6,'Win {!standard} N! damageless','N!の{!通常}ゲームでダメージを受けずに勝利する'],
]);
badges('veteran','Veteran','歴戦の兵',[
 [1,'Win game on any difficulty w/100% kills','難易度を問わず撃破率100%で勝利する'],
 [2,'Win game on Hurt Me Plenty w/100% kills','「たっぷり痛めつけてくれ」で撃破率100%の勝利を収める'],
 [3,'Win game on UV/100% kills','UVで撃破率100%の勝利を収める'],
 [4,'Fully win the game on UV','UVで完全勝利する'],
 [5,'Fully win the game on N!','N!で完全勝利する'],
 [6,'Fully win on N!/100%','N!で撃破率100%の完全勝利を収める'],
]);
badges('strongman','Strongman','豪傑',[
 [1,'Win {!standard} game using basic melee weapons','基本近接武器を使って{!通常}ゲームで勝利する'],
 [2,'Win {!standard} game using knives/fists','ナイフ／拳を使って{!通常}ゲームで勝利する'],
 [3,'Win {!standard} game using knives/fists HMP','HMPの{!通常}ゲームでナイフ／拳を使って勝利する'],
 [4,'Win {!standard} game using only fists HMP','HMPの{!通常}ゲームで拳だけを使って勝利する'],
 [5,'Win {!standard} game fist-only HMP/100% kills','HMPの{!通常}ゲームで拳だけを使い、撃破率100%で勝利する'],
 [6,'Win {!standard} game fist-only N!/90% kills','N!の{!通常}ゲームで拳だけを使い、撃破率90%で勝利する'],
]);
badges('speedrunner','Speedrunner','最速走者',[
 [1,'Win {!standard} game under 30 minutes','{!通常}ゲームで30分未満で勝利する'],
 [2,'Win {!standard} HNTR game under 25 minutes','HNTRの{!通常}ゲームで25分未満で勝利する'],
 [3,'Win {!standard} HMP game under 20 minutes','HMPの{!通常}ゲームで20分未満で勝利する'],
 [6,'Win {!standard} N! game under 4 minutes','N!の{!通常}ゲームで4分未満で勝利する'],
]);
badges('elite','Elite','精鋭',[
 [4,'Win {!standard} UV game as Conqueror','UVの{!通常}ゲームで征服者として勝利する'],
 [5,'Win {!standard} N!/90% kills','N!の{!通常}ゲームで撃破率90%の勝利を収める'],
 [6,'Win {!standard} N!/100% as Conqueror','N!の{!通常}ゲームで撃破率100%の征服者として勝利する'],
]);
badges('demonic','Demonic','悪魔',[
 [4,'Win {!standard} N! as Explorer','N!の{!通常}ゲームで探検者として勝利する'],
 [5,'Win {!standard} N! with Untouchable Medal','N!の{!通常}ゲームで無傷の勲章を獲得して勝利する'],
 [6,'Win {!standard} N!/100% damageless','N!の{!通常}ゲームでダメージを受けず、撃破率100%で勝利する'],
]);
badges('lava','Lava','溶岩',[
 [1,'Clear the Lava Pits/Mt. Erebus','溶岩の穴／エレバス山を制圧する'],
 [2,'Clear the Lava Pits/Mt. Erebus on AoI','AoIで溶岩の穴／エレバス山を制圧する'],
]);
badges('reaper','Reaper','死神',[
 [1,'Enter the Mortuary/Limbo','死体安置所／リンボに入る'],
 [2,'Enter the Mortuary/Limbo and exit alive','死体安置所／リンボに入り、生きて脱出する'],
 [3,'Complete the Mortuary/Limbo','死体安置所／リンボをクリアする'],
 [4,'Complete the Mortuary/Limbo on N!','N!で死体安置所／リンボをクリアする'],
 [5,'Complete the Mortuary/Limbo on N! AoCn','N!のAoCnで死体安置所／リンボをクリアする'],
]);
badges('wall','Brick','煉瓦',[
 [1,'Clear The Wall/Containment Area','壁／封鎖区域を制圧する'],
 [2,'Clear The Wall/Containment on AoB/AoMr/AoSh','AoB／AoMr／AoShで壁／封鎖区域を制圧する'],
]);
badges('skull','Skull','髑髏',[
 [1,'Clear City of Skulls/Abyssal Plains','髑髏の都／深淵の平原を制圧する'],
 [2,'Clear City of Skulls/Abyssal Plains on AoRA','AoRAで髑髏の都／深淵の平原を制圧する'],
]);
badges('berserker','Berserker','バーサーカー',[
 [1,'Reach level 9 on Angel of Berserk','狂戦士の天使（Angel of Berserk）で第9階に到達する'],
 [2,'Complete Angel of Berserk (AoB)','狂戦士の天使（Angel of Berserk、AoB）をクリアする'],
 [3,'Complete AoB on HMP','HMPでAoBをクリアする'],
 [4,'Complete AoB on UV/75% kills','UVで撃破率75%のAoBをクリアする'],
 [5,'Complete AoB on N!/60% kills','N!で撃破率60%のAoBをクリアする'],
 [6,'Complete AoB+AoMs on N!','N!でAoB+AoMsをクリアする'],
]);
badges('marksman','Marksman','射撃の達人',[
 [1,'Reach level 16 on Angel of Marksmanship','射撃の天使（Angel of Marksmanship）で第16階に到達する'],
 [2,'Complete Angel of Marksmanship (AoMr)','射撃の天使（Angel of Marksmanship、AoMr）をクリアする'],
 [3,'Complete AoMr on UV','UVでAoMrをクリアする'],
 [4,'Complete AoMr on UV/100% kills','UVで撃破率100%のAoMrをクリアする'],
 [5,'Complete AoMr on N!','N!でAoMrをクリアする'],
 [6,'Complete AoMr+AoD on N!/75% kills','N!で撃破率75%のAoMr+AoDをクリアする'],
]);
badges('shotgun','Shottyman','ショットガンの達人',[
 [1,'Reach level 16 on Angel of Shotgunnery','散弾銃の天使（Angel of Shotgunnery）で第16階に到達する'],
 [2,'Complete Angel of Shotgunnery (AoSh)','散弾銃の天使（Angel of Shotgunnery、AoSh）をクリアする'],
 [3,'Complete AoSh on UV','UVでAoShをクリアする'],
 [4,'Complete AoSh on N!','N!でAoShをクリアする'],
 [5,'Complete AoSh on N!/80% kills','N!で撃破率80%のAoShをクリアする'],
 [6,'Complete AoSh+AoOC on N!/75% kills','N!で撃破率75%のAoSh+AoOCをクリアする'],
]);
badges('lightfoot','Lightfoot','軽快な足取り',[
 [1,'Reach level 9 on Angel of Light Travel','身軽な旅の天使（Angel of Light Travel）で第9階に到達する'],
 [2,'Complete Angel of Light Travel (AoLT)','身軽な旅の天使（Angel of Light Travel、AoLT）をクリアする'],
 [3,'Complete AoLT on HMP','HMPでAoLTをクリアする'],
 [4,'Complete AoLT on UV+ w/<20,000 turns','UV以上で20,000ターン未満のAoLTをクリアする'],
 [5,'Complete AoLT on N! w/o melee kills','N!で近接攻撃による撃破をせずにAoLTをクリアする'],
 [6,'Complete ArchAoLT on N! w/o melee kills','N!で近接攻撃による撃破をせずにArchAoLTをクリアする'],
]);
badges('impatient','Eagerness','せっかち',[
 [1,'Reach level 9 on Angel of Impatience','焦燥の天使（Angel of Impatience）で第9階に到達する'],
 [2,'Complete Angel of Impatience (AoI)','焦燥の天使（Angel of Impatience、AoI）をクリアする'],
 [3,'Complete AoI on HMP','HMPでAoIをクリアする'],
 [4,'Complete AoI on UV as non-Marine','海兵隊員以外でUVのAoIをクリアする'],
 [5,'Complete AoI on N! as Technician','技術者でN!のAoIをクリアする'],
 [6,'Complete AoI+AoRA on N!/90% kills','N!で撃破率90%のAoI+AoRAをクリアする'],
]);
badges('confident','Daredevil','命知らず',[
 [1,'Reach level 9 on Angel of Confidence','自信の天使（Angel of Confidence）で第9階に到達する'],
 [2,'Complete Angel of Confidence (AoCn)','自信の天使（Angel of Confidence、AoCn）をクリアする'],
 [3,'Complete Angel of Overconfidence (AoOC)','過信の天使（Angel of Overconfidence、AoOC）をクリアする'],
 [4,'Complete AoCn on UV/100% kills','UVで撃破率100%のAoCnをクリアする'],
 [5,'Complete AoOC on N!/80% kills','N!で撃破率80%のAoOCをクリアする'],
]);
badges('purity','Inquisitor','審問官',[
 [3,'Complete Angel of Purity (AoP)','純潔の天使（Angel of Purity、AoP）をクリアする'],
 [4,'Complete AoP on UV','UVでAoPをクリアする'],
 [5,'Complete AoP on N! as Marine','海兵隊員でN!のAoPをクリアする'],
 [6,'Complete AoP+AoRA on N!','N!でAoP+AoRAをクリアする'],
]);
badges('redalert','Quartermaster','兵站係',[
 [1,'Reach level 16 on Angel of Red Alert','緊急警報の天使（Angel of Red Alert）で第16階に到達する'],
 [2,'Complete Angel of Red Alert (AoRA)','緊急警報の天使（Angel of Red Alert、AoRA）をクリアする'],
 [3,'Complete AoRA with 100% kills','撃破率100%でAoRAをクリアする'],
 [4,'Complete AoRA on N!','N!でAoRAをクリアする'],
 [5,'Complete AoRA on UV/100% kills','UVで撃破率100%のAoRAをクリアする'],
 [6,'Complete ArchAoRA on UV/80% kills','UVで撃破率80%のArchAoRAをクリアする'],
]);
badges('darkness','Hunter','狩人',[
 [1,'Reach level 9 on Angel of Darkness','暗闇の天使（Angel of Darkness）で第9階に到達する'],
 [2,'Complete Angel of Darkness (AoD)','暗闇の天使（Angel of Darkness、AoD）をクリアする'],
 [3,'Complete AoD on HMP/80% kills','HMPで撃破率80%のAoDをクリアする'],
 [4,'Complete AoD on N!','N!でAoDをクリアする'],
 [5,'Complete AoD on N! w/Explorer Pin','N!で探検者の記章を獲得してAoDをクリアする'],
]);
badges('carnage','Destroyer','破壊者',[
 [1,'Reach level 16 in Angel of Max Carnage','大殺戮の天使（Angel of Max Carnage）で第16階に到達する'],
 [2,'Complete Angel of Max Carnage (AoMC)','大殺戮の天使（Angel of Max Carnage、AoMC）をクリアする'],
 [3,'Complete AoMC on HMP w/Untouchable Pin','HMPで無傷の記章を獲得してAoMCをクリアする'],
 [4,'Complete AoMC on UV w/Untouchable Medal','UVで無傷の勲章を獲得してAoMCをクリアする'],
 [5,'Complete AoMC on N! w/Untouchable Cross','N!で無傷の十字章を獲得してAoMCをクリアする'],
]);
badges('masochism','Masochist','苦痛を愛する者',[
 [3,'Complete Angel of Masochism (AoMs)','被虐の天使（Angel of Masochism、AoMs）をクリアする'],
 [4,'Complete AoMs on HMP w/o Bad','HMPで不屈（Bad）を取得せずにAoMsをクリアする'],
 [5,'Complete AoMs on N! w/o Iro/Bad','N!で鉄人（Iro）／不屈（Bad）を取得せずにAoMsをクリアする'],
 [6,'Complete ArchAoMs on N!','N!でArchAoMsをクリアする'],
]);
badges('century','Centurial','百階踏破',[
 [1,'Reach level 16 on Angel of 100','100階の天使（Angel of 100）で第16階に到達する'],
 [2,'Reach level 51 on Angel of 100','100階の天使（Angel of 100）で第51階に到達する'],
 [3,'Complete Angel of 100 (Ao100)','100階の天使（Angel of 100、Ao100）をクリアする'],
 [4,'Complete Ao100 on UV','UVでAo100をクリアする'],
 [5,'Complete Ao100 on N!','N!でAo100をクリアする'],
 [6,'Complete ArchAo666 on N!','N!でArchAo666をクリアする'],
]);
badges('pacifism','Pacifist','平和主義者',[
 [1,'Reach level 16 on Angel of Pacifism','平和主義の天使（Angel of Pacifism）で第16階に到達する'],
 [2,'Complete Angel of Pacifism (AoPc)','平和主義の天使（Angel of Pacifism、AoPc）をクリアする'],
 [3,'Complete AoPc in under 10 minutes','10分未満でAoPcをクリアする'],
 [6,'Complete ArchAoPc game with @<1 kill@>','@<撃破数1@>でArchAoPcをクリアする'],
]);
badges('everyman','Everyman','普通の人',[
 [3,'Complete Angel of Humanity (AoHu)','人間性の天使（Angel of Humanity、AoHu）をクリアする'],
 [4,'Complete AoHu as Conqueror','征服者としてAoHuをクリアする'],
 [5,'Complete AoHu on UV as Conqueror','UVで征服者としてAoHuをクリアする'],
 [6,'Complete ArchAoHu on N!','N!でArchAoHuをクリアする'],
]);
badges('arena','Arena','闘技場',[
 [1,"Complete Hell's Arena",'地獄の闘技場をクリアする'],
 [2,"Complete Hell's Arena on UV",'UVで地獄の闘技場をクリアする'],
 [3,"Complete Hell's Arena on AoMr on UV",'UVのAoMrで地獄の闘技場をクリアする'],
 [4,"Complete Hell's Arena on Nightmare!",'「悪夢！」で地獄の闘技場をクリアする'],
 [5,"Complete Hell's Arena on AoB on N!",'N!のAoBで地獄の闘技場をクリアする'],
]);
badges('hellgate','Gatekeeper','門番',[
 [1,'Clear out the Anomaly','フォボスの異変を制圧する'],
 [2,'Clear the Anomaly w/o taking damage','ダメージを受けずにフォボスの異変を制圧する'],
 [3,'Clear Babel on HNTR w/o taking damage','HNTRでダメージを受けずにバベルの塔を制圧する'],
 [4,'Pass the Anomaly on N! w/o taking damage','N!でダメージを受けずにフォボスの異変を通過する'],
 [5,'Clear Anomaly+Babel on UV w/o taking damage','UVでダメージを受けずにフォボスの異変とバベルの塔を制圧する'],
]);
badges('death','Longinus','ロンギヌス',[
 [3,'Complete Unholy Cathedral','冒涜の大聖堂をクリアする'],
 [4,'Complete Unholy Cathedral on N!','N!で冒涜の大聖堂をクリアする'],
 [5,'Complete Unholy Cathedral on N! w/o Bru','N!で怪力（Bru）を取得せずに冒涜の大聖堂をクリアする'],
]);
badges('arachno','Arachno','蜘蛛',[
 [1,"Clear Spider's Lair",'蜘蛛の巣を制圧する'],
 [2,"Clear Spider's Lair on AoD",'AoDで蜘蛛の巣を制圧する'],
]);
badges('vaults','Scavenger','回収屋',[
 [1,'Find The Vaults','金庫室を発見する'],
 [2,'Scavenge The Vaults','金庫室の物資を回収する'],
 [3,'Clear The Vaults','金庫室を制圧する'],
 [4,'Clear The Vaults by luck','運だけで金庫室を制圧する'],
 [5,'Clear The Vaults by luck on UV+','UV以上で運だけで金庫室を制圧する'],
]);
const medals=[
 ['killall','Medal of Prejudice','偏見の勲章','Won with 100% kills','撃破率100%で勝利した'],
 ['killfew','Medal of Pacifism','平和主義の勲章','Won with 10% or less kills','撃破率10%以下で勝利した'],
 ['shotguns','Shotgunnery Cross','ショットガン十字章','Won & killed only with shotguns/fists','ショットガン／拳だけで敵を倒し、勝利した'],
 ['pistols','Marksmanship Cross','射撃十字章','Won & killed only with pistols/fists','ピストル／拳だけで敵を倒し、勝利した'],
 ['knives','Malicious Knives Cross','邪悪な刃の十字章','Won & killed only with knives/fists','ナイフ／拳だけで敵を倒し、勝利した'],
 ['fist','Sunrise Iron Fist','暁の鉄拳','Won & killed only with your bare hands','素手だけで敵を倒し、勝利した'],
 ['zen',"Zen Master's Cross",'禅師の十字章','Won & killed w/o using fists/weapons','拳／武器を使わずに敵を倒し、勝利した'],
 ['uac1','UAC Star (bronze cluster)','UAC 星章（銅の飾り）','25+ kills without taking damage','ダメージを受けずに25体以上倒した'],
 ['uac2','UAC Star (silver cluster)','UAC 星章（銀の飾り）','50+ kills without taking damage','ダメージを受けずに50体以上倒した'],
 ['uac3','UAC Star (gold cluster)','UAC 星章（金の飾り）','100+ kills without taking damage','ダメージを受けずに100体以上倒した'],
 ['icarus1','Minor Icarus Cross','小イカロス十字章','Won the game in less than 40,000 turns','40,000ターン未満で勝利した'],
 ['icarus2','Major Icarus Cross','大イカロス十字章','Won the game in less than 20,000 turns','20,000ターン未満で勝利した'],
 ['gambler',"Gambler's Shield",'賭博師の盾','Pulled at least 25 levers in one game','1ゲームで25回以上レバーを引いた'],
 ['aurora','Aurora Medallion','オーロラのメダリオン','Found more than 3 uniques in one game','1ゲームでユニーク装備を3個より多く発見した'],
 ['explorer','Explorer Pin','探検者の記章','Visited all generated levels','生成されたすべての階を訪れた'],
 ['conqueror','Conqueror Pin','征服者の記章','Completed all generated levels','生成されたすべての階をクリアした'],
 ['competn1','Compet-n Silver Cross','Compet-n 銀十字章','Won the game in under 30 minutes','30分未満で勝利した'],
 ['competn2','Compet-n Gold Cross','Compet-n 金十字章','Won the game in under 20 minutes','20分未満で勝利した'],
 ['competn3','Compet-n Platinum Cross','Compet-n プラチナ十字章','Won the game in under 10 minutes','10分未満で勝利した'],
 ['fallout1','Fallout Gold Cross','放射性降下物の金十字章','Nuked at least 3 levels in one game','1ゲームで3階以上を核爆破した'],
 ['fallout2','Fallout Platinum Cross','放射性降下物のプラチナ十字章','Nuked at least 6 levels in one game','1ゲームで6階以上を核爆破した'],
 ['fallout3','Klear Cross','Klear 十字章','Nuked at least 12 levels in one game','1ゲームで12階以上を核爆破した'],
 ['ironskull1','Iron Skull','鉄の髑髏','Took 5,000+ damage in one game','1ゲームで5,000以上のダメージを受けた'],
 ['untouchable1','Untouchable Pin','無傷の記章','Won taking less than 500 damage','受けたダメージが500未満で勝利した'],
 ['untouchable2','Untouchable Medal','無傷の勲章','Won taking less than 200 damage','受けたダメージが200未満で勝利した'],
 ['untouchable3','Untouchable Cross','無傷の十字章','Won taking less than 50 damage','受けたダメージが50未満で勝利した'],
 ['experience1','Experience Medal','経験の勲章','Reach experience level 20+','経験レベル20以上に到達する'],
 ['experience2','Experience Cross','経験の十字章','Reach experience level 25','経験レベル25に到達する'],
 ['purple','Purple Heart','パープルハート','Reach experience level 20+ and die','経験レベル20以上に到達して死亡する'],
 ['mortuary',"Grim Reaper's Pin",'死神の記章','Clear the Mortuary/Limbo','死体安置所／リンボを制圧する'],
 ['mortuary2','Angelic Pin','天使の記章','Clear the Mortuary/Limbo w/o taking damage','ダメージを受けずに死体安置所／リンボを制圧する'],
 ['armory1','Hell Armorer Pin','地獄の武具職人の記章',"Clear Hell's Armory/Deimos Lab",'地獄の武器庫／ダイモス研究所を制圧する'],
 ['armory2',"Shambler's Head",'シャンブラーの首',"Clear Hell's Armory/Deimos Lab w/o taking damage",'ダメージを受けずに地獄の武器庫／ダイモス研究所を制圧する'],
 ['everysoldier',"Every Soldier's Medal",'すべての兵士の勲章','Clear The Wall/Containment Area on AoHu','AoHuで壁／封鎖区域を制圧する'],
 ['cyberdemon1',"Cyberdemon's Head",'サイバーデーモンの首','Killing the Cyberdemon w/o taking damage','ダメージを受けずにサイバーデーモンを倒す'],
 ['mastermind1',"Mastermind's Brain",'マスターマインドの脳','Killing the Mastermind w/o taking damage','ダメージを受けずにマスターマインドを倒す'],
 ['dragonslayer2','Apostle Insignia','使徒の徽章','Awarded for killing the Apostle','使徒を倒した者に授与される'],
 ['gargulec1','Gargulec Medal','Gargulec の勲章','Complete AoB/100% kills','撃破率100%でAoBをクリアする'],
 ['gargulec2','Gargulec Cross','Gargulec の十字章','Win Angel of Berserk on UV/100% kills','UVの狂戦士の天使（Angel of Berserk）で撃破率100%の勝利を収める'],
 ['dervis',"Dervis' Medallion",'Dervis のメダリオン','Win Angel of 100 on Nightmare!','「悪夢！」の100階の天使（Angel of 100）で勝利する'],
 ['thomas',"Thomas's Medal",'Thomas の勲章','Win AoHu as Conqueror','征服者としてAoHuで勝利する'],
 ['cleric','Grammaton Cleric Cross','グラマトン・クレリック十字章','Mastermind killed with the Cleric Beretta','クレリック・ベレッタでマスターマインドを倒した'],
 ['dragonslayer',"Gutts' Heart",'Gutts の心','Awarded for winning with the Dragonslayer','ドラゴンスレイヤーを持って勝利した者に授与される'],
 ['dragonslayed',"Gutts' Sorrow",'Gutts の悲嘆','Awarded for dying with the Dragonslayer','ドラゴンスレイヤーを持って死亡した者に授与される'],
 ['chessmaster1',"Chessmaster's Token",'チェスの達人の証',"Complete Hell's Arena on AoMs/AoI on UV",'UVのAoMs／AoIで地獄の闘技場をクリアする'],
 ['chessmaster2',"Chessmaster's Cross",'チェスの達人の十字章',"Complete Hell's Arena on AoMs/AoI on N!",'N!のAoMs／AoIで地獄の闘技場をクリアする'],
 ['hellchampion','Hell Champion Medal','地獄の王者の勲章',"Clear Hell's Arena",'地獄の闘技場を制圧する'],
 ['hellchampion2','Hell Arena Key','地獄の闘技場の鍵',"Clear Hell's Arena w/o damage",'ダメージを受けずに地獄の闘技場を制圧する'],
 ['hellchampion3','Hell Arena Pwnage Medal','地獄の闘技場の圧勝勲章',"Clear Hell's Arena w/o damage on N!",'N!でダメージを受けずに地獄の闘技場を制圧する'],
 ['everyspider','Spider-Killer Cross','蜘蛛殺しの十字章',"Clear Spider's Lair on AoHu",'AoHuで蜘蛛の巣を制圧する'],
];
for(const row of medals)add('medal',...row);
for(const entries of Object.values(reviewed)){
 for(const fields of Object.values(entries)){for(const term of Object.values(fields))Object.freeze(term);Object.freeze(fields);}
 Object.freeze(entries);
}
/** category -> original registry ID -> field -> {english,japanese}. */
export const reviewedAwardFields=Object.freeze(reviewed);
/** No nonliteral award fields exist in the pinned source. Verify instead of assuming. */
export const pendingAwardFields=Object.freeze([]);
export function reviewedAwardField(category,registryId,field,english){
 const term=reviewedAwardFields[category]?.[registryId]?.[field];
 return term?.english===english?term.japanese:undefined;
}
const markupShape=s=>Array.from(s.matchAll(/\{([!A-Za-z])[^{}]*\}|@<|@>/g),m=>m[1]?`{${m[1]}}`:m[0]);
const namedParams=s=>Array.from(s.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g),m=>m[1]).sort();
const requirements=s=>Array.from(s.matchAll(/(?:ArchAo[A-Za-z0-9]+|Ao[A-Za-z0-9]+|\b(?:HNTR|HMP|UV|N!)|[0-9][0-9,]*(?:%|\+)?)/g),m=>m[0]);
/** Independent read-only verification; imports the lexer lazily to avoid integration cycles. */
export async function verifyReviewedAwardFields(sourceRoot,{scanRegistrySource:providedScanner,sourceOverrides={}}={}){
 const scanner=providedScanner??(await import('./registry-terms.mjs')).scanRegistrySource;
 const lock=JSON.parse(readFileSync(path.join(here,'registry-sources.lock.json'),'utf8'));
 const original=[],sources={};
 for(const[file,locked]of Object.entries(lock.sources)){
  if(file.includes('..')||path.isAbsolute(file)||!file.endsWith('.lua'))throw Error('Unsafe award source lock path');
  const data=Object.hasOwn(sourceOverrides,file)?Buffer.from(sourceOverrides[file],'utf8'):readFileSync(path.join(sourceRoot,file));
  if(data.length!==locked.bytes||sha(data)!==locked.sha256)throw Error(`Award source provenance mismatch: ${file}`);
  const entries=scanner(data.toString('utf8'),file).filter(e=>['badge','medal'].includes(e.category));
  if(entries.length)sources[file]={sha256:locked.sha256,bytes:locked.bytes};
  original.push(...entries);
 }
 const seen=new Set(),unresolved=[];let fields=0,markupFields=0;
 for(const entry of original){
  if(entry.pending.length)unresolved.push(...entry.pending.map(p=>({...p,category:entry.category,registryId:entry.registryId,file:entry.file})));
  for(const[field,token]of Object.entries(entry.fields)){
   const key=`${entry.category}:${entry.registryId}:${field}`;
   if(seen.has(key))throw Error(`Duplicate original award field: ${key}`);
   seen.add(key);
   const term=reviewedAwardFields[entry.category]?.[entry.registryId]?.[field];
   if(!term||term.english!==token.value)throw Error(`Award English guard mismatch: ${key}`);
   if(!/[\u3040-\u30ff\u3400-\u9fff]/u.test(term.japanese))throw Error(`Award lacks Japanese presentation: ${key}`);
   if(JSON.stringify(markupShape(term.english))!==JSON.stringify(markupShape(term.japanese)))throw Error(`Award markup topology mismatch: ${key}`);
   if(JSON.stringify(namedParams(term.english))!==JSON.stringify(namedParams(term.japanese)))throw Error(`Award named parameter mismatch: ${key}`);
   // Names translate tier words, not tier mechanics. Requirement numbers and abbreviations must survive.
   if(field==='desc')for(const requirement of requirements(term.english)){
    const literal=requirement.endsWith('+')?requirement.slice(0,-1):requirement;
    if(!term.japanese.includes(literal))throw Error(`Award requirement lost (${requirement}): ${key}`);
   }
   fields++;if(markupShape(term.english).length)markupFields++;
  }
 }
 for(const[category,entries]of Object.entries(reviewedAwardFields))for(const[id,terms]of Object.entries(entries))for(const field of Object.keys(terms))if(!seen.has(`${category}:${id}:${field}`))throw Error(`Reviewed award absent from pinned source: ${category}:${id}:${field}`);
 if(unresolved.length!==pendingAwardFields.length)throw Error('Unrecorded nonliteral original award fields');
 if(fields!==394||original.length!==197)throw Error(`Pinned award coverage changed: ${fields} fields/${original.length} entries`);
 return{sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',reviewedFields:fields,registrations:original.length,badgeFields:seen.size-Object.keys(reviewedAwardFields.medal).length*2,medalFields:Object.keys(reviewedAwardFields.medal).length*2,markupFields,placeholderFields:0,unresolved,sources,originalDomainModified:false,runtimeAdapterConnected:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await verifyReviewedAwardFields(path.resolve(here,'../upstream/drl')),null,2));
