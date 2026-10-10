/** Explicit registry field roles; read-only lexical extraction, no Lua execution.
 * Original IDs and English Name fields remain authoritative gameplay values. */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {reviewedExtraField,reviewedExtraSemanticId} from './registry-extra-fields.mjs';
import {reviewedStoryField} from './registry-story-fields.mjs';
import {reviewedChallengeFields,challengeFieldRoles,verifyChallengeFields} from './registry-challenges.mjs';
import {appendGeneratedRegistryFields} from './registry-generated-fields.mjs';
import {reviewedAwardFields} from './registry-awards.mjs';
import {reviewedMiscRegistryFields,reviewedRankArrayFields,reviewedRequirementDescriptions,reviewedRankGroupTexts} from './registry-perks-ranks.mjs';
import {scanSource} from '../port/tools/inventory-texts.mjs';
import {itemDescriptions,assemblyRequirements,bloodiedCellNames,traitDescriptions} from './registry-descriptions.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const digest=b=>createHash('sha256').update(b).digest('hex');
export const fieldRoles={
 being:['name','name_plural','desc','kill_desc','kill_desc_melee'],item:['name','desc','good','firstmsg','warning','hitdesc'],cell:['name','blname'],klass:['name','desc'],difficulty:['name','description','desc','desc_unlock'],
 level:['name','entry','welcome'],trait:['name','desc','quote'],mod_array:['name','request_desc'],itemset:['name'],badge:['name','desc'],medal:['name','desc'],rank:['name'],rank_group:['name'],perk:['name','short','desc'],requirement:['description'],challenge:challengeFieldRoles
};
function matchingBrace(tokens,start){let depth=0;for(let i=start;i<tokens.length;i++){if(tokens[i].raw==='{')depth++;if(tokens[i].raw==='}'&&!--depth)return i;}throw Error('Unclosed registry table');}
export function topLiteralFields(tokens,start,end){
 const result={},pending=[];let braces=0,parens=0,brackets=0;const blocks=[];
 for(let k=start;k<=end;k++){
  const t=tokens[k],v=t.raw;
  if(t.kind==='punctuation'){if(v==='{')braces++;if(v==='}')braces--;if(v==='(')parens++;if(v===')')parens--;if(v==='[')brackets++;if(v===']')brackets--;}
  if(braces===1&&parens===0&&brackets===0&&blocks.length===0&&t.kind==='identifier'&&tokens[k+1]?.raw==='='){
    const val=tokens[k+2],next=tokens[k+3];
    if(val?.kind==='string'&&[',',';','}'].includes(next?.raw))result[v]=val;
    else pending.push({field:v,offset:t.start,reason:val?.kind==='string'?'literal followed by an expression':'nonliteral field value'});
  }
  if(t.kind==='identifier'){
    if(['function','if','for','while','repeat'].includes(v))blocks.push({type:v,awaitDo:v==='for'||v==='while'});
    else if(v==='do'){const b=blocks.findLast(b=>b.awaitDo);if(b)b.awaitDo=false;else blocks.push({type:'do'});}
    else if(v==='end'||v==='until')blocks.pop();
  }
 }
 return {fields:result,pending};
}
export function scanRegistrySource(source,file){
 const scanned=scanSource(source,'lua');if(scanned.diagnostics.length)throw Error(`Source lexical diagnostics: ${file}`);
 const ts=scanned.tokens,entries=[];
 for(let i=0;i<ts.length;i++){
   const m=/^register_([a-z_]+)$/.exec(ts[i].raw);
   if(!m||!fieldRoles[m[1]]||ts[i-1]?.raw==='function'||ts[i+1]?.raw==='=')continue;
   let j=i+1;if(ts[j]?.raw==='(')j++;if(ts[j]?.kind!=='string')continue;
   const identity=ts[j++];if(ts[j]?.raw===')')j++;if(ts[j]?.raw!=='{')continue;
   const end=matchingBrace(ts,j),fields=topLiteralFields(ts,j,end),category=m[1];
   entries.push({category,registryId:identity.value,file,line:ts[i].line,scope:file.startsWith('bin/data/drl/')?'base_game':file.startsWith('bin/data/core/')?'engine_core':file.startsWith('bin/modules/classic.module/')?'bundled_classic':'tooling',fields:Object.fromEntries(Object.entries(fields.fields).filter(([k])=>fieldRoles[category].includes(k))),pending:fields.pending.filter(p=>fieldRoles[category].includes(p.field))});
 }
 return entries;
}
const nameTranslations={
 being:{former:'元人間',sergeant:'元軍曹',captain:'元大尉',commando:'元コマンドー',imp:'インプ',demon:'デーモン',lostsoul:'ロストソウル',cacodemon:'カコデーモン',knight:'ヘルナイト',baron:'バロン・オブ・ヘル',arachno:'アラクノトロン',pain:'ペイン・エレメンタル',revenant:'レヴナント',mancubus:'マンキュバス',arch:'アーチヴァイル',eformer:'精鋭の元人間',esergeant:'精鋭の元軍曹',ecaptain:'精鋭の元大尉',ecommando:'精鋭の元コマンドー',nimp:'悪夢のインプ',ndemon:'悪夢のデーモン',nlostsoul:'悪夢のソウル',ncacodemon:'悪夢のカコデーモン',nknight:'悪夢のヘルナイト',narachno:'悪夢のアラクノトロン',npain:'悪夢のエレメンタル',nrevenant:'悪夢のレヴナント',nmancubus:'悪夢のマンキュバス',narch:'悪夢のアーチヴァイル',bruiser:'ブルーザー・ブラザー',shambler:'シャンブラー',lava_elemental:'溶岩のエレメンタル',agony:'アゴニー・エレメンタル',angel:'死の天使',cyberdemon:'サイバーデーモン',mastermind:'スパイダー・マスターマインド',jc:'John Carmack',apostle:'使徒',arenamaster:'闘技場の主',soldier:'兵士'},
 cell:{floor:'床',wall_destroyed:'瓦礫',wall:'基地の壁',rwall:'血石',iwall:'氷の壁',cwall:'洞窟の壁',cfloor:'床',gwall:'緑の壁',crate:'木箱',ycrate:'木箱',door:'閉じたドア',odoor:'開いたドア',ldoor:'施錠されたドア',stairs:'下り階段',rstairs:'下り階段',ystairs:'下り階段',water:'水',mud:'泥',acid:'酸',lava:'溶岩',blood:'血',bridge:'橋',rock:'フォボスの岩',nukecell:'核爆弾！',crate_ammo:'木箱',crate_armor:'木箱',bloodpool:'血だまり',corpse:'血まみれの死体'},
 klass:{marine:'海兵隊員',scout:'偵察兵',technician:'技術兵',soldat:'兵士'},
 difficulty:{ITYTD:'死ぬには若すぎる！',HNTR:'手加減してくれ',HMP:'たっぷり痛めつけてくれ',UV:'超暴力','N!':'悪夢！'},
 item:{chainsaw:'チェーンソー',bfg9000:'BFG 9000',ublaster:'ブラスター',ucpistol:'コンバットピストル',uashotgun:'アサルトショットガン',upshotgun:'プラズマショットガン',udshotgun:'スーパーショットガン',ulaser:'レーザーライフル',utristar:'トライスターブラスター',uminigun:'ミニガン',umbazooka:'ミサイルランチャー',unplasma:'核プラズマライフル',unbfg9000:'核 BFG 9000',utrans:'戦闘用転送装置',unapalm:'ナパームランチャー',uoarmor:'オニキスアーマー',uparmor:'フェーズシフトアーマー',upboots:'フェーズシフトブーツ',ugarmor:'ゴシックアーマー',ugboots:'ゴシックブーツ',umedarmor:'医療アーマー',uduelarmor:'決闘者のアーマー',ubulletarmor:'防弾ベスト',uballisticarmor:'耐弾ベスト',ueshieldarmor:'エネルギー遮蔽ベスト',uplasmashield:'プラズマシールド',uenergyshield:'エネルギーシールド',ubalshield:'弾道シールド',uacidboots:'耐酸ブーツ',ubloodboots:'血のブーツ',umod_firestorm:'ファイアストーム武器パック',umod_sniper:'スナイパー武器パック',umod_nano:'ナノパック',umod_onyx:'オニキス防具パック',uswpack:'衝撃波パック',ubskull:'血の髑髏',ufskull:'炎の髑髏',uhskull:'憎悪の髑髏',knife:'コンバットナイフ',garmor:'緑のアーマー',barmor:'青のアーマー',rarmor:'赤のアーマー',sboots:'鋼鉄ブーツ',pboots:'保護ブーツ',psboots:'プラスチールブーツ',shglobe:'小型体力オーブ',bpack:'バーサーク・パック',iglobe:'無敵オーブ',scglobe:'スーパーチャージ・オーブ',lhglobe:'大型体力オーブ',msglobe:'メガスフィア',map:'コンピューターマップ',pmap:'追跡マップ',gpack:'暗視ゴーグル',backpack:'バックパック',ashard:'防具の破片',ammo:'10mm 弾薬',shell:'ショットガンの散弾',rocket:'ロケット弾',cell:'パワーセル',pammo:'10mm 弾帯',pshell:'散弾の弾薬箱',procket:'ロケット弾の弾薬箱',pcell:'パワーバッテリー',pistol:'ピストル',shotgun:'ショットガン',dshotgun:'ダブルショットガン',ashotgun:'コンバットショットガン',bazooka:'ロケットランチャー',chaingun:'チェーンガン',plasma:'プラズマライフル',smed:'小型医療パック',lmed:'大型医療パック',phase:'フェーズ装置',hphase:'帰還フェーズ装置',epack:'環境防護スーツ・パック',nuke:'熱核爆弾',mod_power:'威力 MOD パック',mod_tech:'技術 MOD パック',mod_agility:'機敏 MOD パック',mod_bulk:'大型 MOD パック',barrel:'燃料ドラム缶',barrela:'酸のドラム缶',barreln:'ナパームのドラム缶',tree:'フォボスの木',lever_flood_water:'レバー',lever_flood_acid:'レバー',lever_flood_lava:'レバー',lever_kill:'レバー',lever_explode:'レバー',lever_walls:'レバー',lever_summon:'レバー',lever_repair:'レバー',lever_medical:'レバー',lever_ammo:'レバー',schematic_0:'設計図',schematic_1:'設計図',schematic_2:'設計図',lava_element:'溶岩のエレメント',unullpointer:'Charch のヌルポインター',umodstaff:'地獄の杖',ubutcher:'ブッチャーの肉切り包丁',umjoll:'ミョルニル',usubtle:'神秘の短剣',utrigun:'トライガン',ujackal:'対化け物用ジャッカル',umega:'メガバスター',uberetta:'グラマトン・クラリック・ベレッタ',usjack:'ジャックハンマー',ufshotgun:'フラグショットガン',urbazooka:'レヴナントのランチャー',uacid:'アシッドスピッター',ubfg10k:'BFG 10K',urailgun:'レールガン',umarmor:'Malek のアーマー',ucarmor:'サイバネティックアーマー',unarmor:'ネクロアーマー',umedparmor:'医療パワーアーマー',ulavaarmor:'溶岩のアーマー',uenviroboots:'環境防護ブーツ',unboots:'ニャルラトテップのブーツ',ushieldarmor:'シールドアーマー',uhwpack:'ヘルウェーブ・パック',aarmor:'天使のアーマー',uberarmor:'バーサーカーアーマー',udragon:'ドラゴンスレイヤー',lever_spec3:'レバー',hellportal:'地獄の門',dis_switch:'レバー',lever_centralprocessing1:'レバー',lever_centralprocessing2:'レバー',lever_centralprocessing3:'レバー',lever_centralprocessing4:'レバー',lever_centralprocessing5:'レバー',uarenastaff:'闘技場の主の杖',lever_chain1:'レバー',lever_chain2:'レバー',lever_chain3:'レバー',lever_deimoslab:'レバー',spear:'ロンギヌスの槍',uscythe:'アズラエルの大鎌',lever_limbow:'レバー',lever_limboe:'レバー',lever_erebus:'レバー',lever_phoboslab1:'レバー',lever_phoboslab2:'レバー',lever_toxinrefinery1:'レバー',lever_toxinrefinery2:'レバー',lever_toxinrefinery3:'レバー',stubitem:'ダミーアイテム',teleport:'転送装置'},
 mod_array:{chainsword:'チェーンソード',pblade:'貫通の刃',speedloader:'スピードローダーピストル',elephant:'エレファントガン',gatling:'ガトリングガン',micro:'小型ランチャー',tarmor:'戦術アーマー',tboots:'戦術ブーツ',nanofiber:'ナノファイバーアーマー',high:'高威力武器',power:'パワーアーマー',tshotgun:'戦術ショットガン',plate:'タワーシールド',fparmor:'耐火アーマー',fpboots:'耐火ブーツ',balarmor:'耐弾アーマー',plasmatic:'プラズマ散弾',gboots:'グラップリングブーツ',grarmor:'グラップリングアーマー',lavboots:'溶岩のブーツ',double:'ダブルチェーンソー',tacticalrl:'戦術ロケットランチャー',storm:'ストームボルターピストル',rifle:'アサルトライフル',energy:'エネルギーピストル',assault:'バーストキャノン',vbfg9000:'VBFG9000',envboots:'環境防護ブーツ',fireshield:'ファイアシールド',nanoskin:'ナノファイバースキンアーマー',gravity:'反重力ブーツ',hyperblaster:'ハイパーブラスター',fdshotgun:'集束ダブルショットガン',nanomanufacture:'ナノ製造弾薬',nsharpnel:'ナノ散弾',demolition:'爆破解体弾薬',cybernano:'サイバーナノアーマー',biggest:'クソでかい銃',ripper:'リッパー',cerboots:'ケルベロスブーツ',cerarmor:'ケルベロスアーマー',mother:'マザー・イン・ロー'},
 trait:{trait_marine:'',ironman:'鉄人',finesse:'技巧',hellrunner:'地獄の走者',nails:'鉄の体',bitch:'容赦なき攻撃',gun:'銃の申し子',reloader:'装填手',eagle:'鷹の目',brute:'怪力',juggler:'ジャグラー',berserker:'バーサーカー',dualgunner:'二丁拳銃',dodgemaster:'回避の達人',intuition:'直感',whizkid:'神童',badass:'不屈',shottyman:'ショットガンの達人',triggerhappy:'乱射魔',blademaster:'剣の達人',vampyre:'吸血鬼',malicious:'邪悪な刃',bulletdance:'弾丸の舞',gunkata:'ガン＝カタ',sharpshooter:'狙撃の達人',armydead:'死者の軍団',shottyhead:'ショットガン狂',fireangel:'炎の天使',ammochain:'無限弾帯',cateye:'猫の目',entrenchment:'陣地防御',survivalist:'生存の達人',runningman:'走り続ける者',gunrunner:'駆ける射手',scavenger:'回収屋'},
 level:{abyssal_plains:'深淵の平原',hells_arena:'地獄の闘技場',hells_armory:'地獄の武器庫',hellgate:'フォボスの異変',tower_of_babel:'バベルの塔',dis:'ディス',hell_fortress:'地獄の要塞',halls_of_carnage:'殺戮の大広間',central_processing:'中央処理施設',the_chained_court:'鎖の広場',containment_area:'封鎖区域',deimos_lab:'ダイモス研究所',unholy_cathedral:'冒涜の大聖堂',house_of_pain:'苦痛の館',intro:'フォボス基地入口',the_lava_pits:'溶岩の穴',limbo:'リンボ',military_base:'軍事基地',the_mortuary:'死体安置所',mt_erebus:'エレバス山',phobos_lab:'フォボス研究所',city_of_skulls:'髑髏の都',spiders_lair:'蜘蛛の巣',toxin_refinery:'毒素精製所',the_vaults:'金庫室',the_wall:'壁',phobos_arena:'フォボスの闘技場'},
 itemset:{gothic:'ゴシック装備',phaseshift:'フェーズシフト装備',angelic:'天使の装備',inquisitor:'審問官の装備'}
};
const classDescriptions={
 marine:'海兵隊員は UAC の中核を担う、頑強な兵士です。体力が 10 高く、炎・酸・プラズマへの耐性が +10% あります。使ったパワーアップの持続時間は +50%（悪夢では +25%）延長されます。',
 scout:'偵察兵は身軽で、優れた情報収集力があります。通常より 10% 速く、どのフロアでも階段の場所が初めからわかります。',
 technician:'技術兵は装備の扱いと改造の達人です。消耗品をほぼ瞬時に使い、コンピューターマップから追跡データを取り出せます。一部のユニークな装備を改造できるのも技術兵だけです。',
 soldat:'兵士には名前もなく、誰にも知られていません。兵士になることを選ぶのではありません。あなたは、ただ兵士なのです…'
};
const difficultyDescriptions={ITYTD:'彼は死ぬには若すぎた！',HNTR:'彼は厳しすぎる戦いを好まなかった。',HMP:'彼はたっぷり痛めつけられることを恐れなかった。',UV:'彼は超暴力の男だった！','N!':'彼は悪夢に立ち向かった！'};
const beingDescriptions={
 former:'悪魔の影響で正気を失った、かつての仲間たち。もはや救う望みはない……その腐った魂を癒やせるのは鉛の弾丸だけだ……',
 sergeant:'元人間の兵士と同じだが、もっと凶暴で頑丈だ。油断すれば体に穴を増やされる。必ずショットガンを携えているので警戒せよ！',
 captain:'かつては鍛え抜かれた海兵隊員で、地球の精鋭部隊を支えていた。今では悪魔の側に立ち、速射するチェーンガンで君を蜂の巣にする気満々だ……',
 commando:'こいつらは最初から邪悪だった。地獄の力に歪められて、さらに始末が悪くなった。殺傷力の高いプラズマ兵器を振るうので、慎重に対処せよ……鉛の弾丸で。',
 imp:'地獄に仕える茶色の悪魔。インプは火球を投げてくる。頑丈で凶暴、力も強く、君を消し去ることしか考えていない……',
 demon:'ピンク色はかわいいと思っていたか？　こいつに会えば、その考えは変わる。力強く頑丈で、君の首を引きちぎりたがっている……',
 lostsoul:'炎をまとって素早く飛ぶ頭蓋骨。地獄で迷った魂だ。安らかに眠らせてやれ。いや、粉々にしてやれ……',
 cacodemon:'角の生えた巨大な赤い頭が空を飛ぶ。爆発する大きなプラズマ球を吐く。対抗できる武器がないなら、逃げたほうがいい……',
 knight:'地獄の軍を戦いへと率いる将軍。バロンほど頑丈ではないが、それでも厄介な相手だ……',
 baron:'最悪の悪夢から現れた、巨大で人型に近い怪物。酸の球を投げつける、地獄の貴族だ。',
 arachno:'これほど純粋な邪悪はない。速射プラズマ砲を備えた蜘蛛型の悪魔。機械と肉体が一つになっている。見つけ次第、倒せ……',
 pain:'苦痛、苦痛、苦痛。それだけがこいつらの生きる理由で、相手にも苦痛しか与えない。待て、よく見ろ。ロストソウルまで送り出している！',
 revenant:'悪魔が死ぬと、拾ってほこりを払い、戦闘装備を取り付けて戦場へ戻すらしい。悪党に休みはないというわけか。君のミサイルにも、こいつのような芸当ができればいいのに。',
 mancubus:'大きくて凶暴、そのうえロケットランチャーが二門。これ以上ひどい相手がいるだろうか？',
 arch:'遭遇しうる最悪の敵。理解を超えた不浄な力で地獄の炎を浴びせ、苦労して倒した敵を呼び戻してしまう！',
 eformer:'元人間たちの精鋭。普通の連中と同じくらい愚かだが、もっと頑丈で攻撃も強烈だ。残念ながら、武器は持ち主が死ぬと自壊するように設定されている。',
 esergeant:'元軍曹たちの精鋭。火力もたっぷり備えている！　残念ながら、武器は持ち主が死ぬと自壊するように設定されている。',
 ecaptain:'元大尉たちの精鋭。強力な火力に注意せよ！　残念ながら、武器は持ち主が死ぬと自壊するように設定されている。',
 ecommando:'予想どおり、この元人間の兵士たちは精鋭中の精鋭だ！　装甲をまとい、頑丈で、火力も優れている！　残念ながら、武器は持ち主が死ぬと自壊するように設定されている。',
 nimp:'見間違いか？　なぜ色が違う？　しかも、なぜ倒すのにこんなに時間がかかるんだ！？',
 ndemon:'ピンク色だったころのほうが、まだましだった。さらに強く、頑丈で、しぶとくなった死神のお出ましだ。',
 nlostsoul:'青みがかった空飛ぶ頭蓋骨。こんな悪夢じみた奴が大群でなければ、大した問題ではないのだが……',
 ncacodemon:'地獄が悪魔の戦術に加えた最新の改良。これまで以上に強く、頑丈で、怒りに満ちている。',
 nknight:'ヘルナイトとバロンの系統から生まれた悪夢の姿。これ以上ひどくならないことを願う。願うしかない……',
 narachno:'悪夢そのものの蜘蛛。こんな奴ら、いてほしくなかった……',
 npain:'苦痛、苦痛、苦痛、悪夢の苦痛。それに悪夢のソウルまで……',
 nrevenant:'このレヴナントは、ほこりを払われて装備を取り付けられる回数が一度多すぎた。その結果は一目瞭然だ……',
 nmancubus:'青くてロケットランチャーが二門あるものは何だ？　さらにひどい何かだ。',
 narch:'ああ、神よ……なぜ、こいつにまで悪夢版があるんだ？',
 bruiser:'ダンプカー並みに頑丈で、大きさもそれに迫る巨体。ティラノサウルス以来、二本足で歩くものの中でも最悪の部類だ。',
 shambler:'ほかの怪物すら恐れる相手だ。ひどい目に遭う覚悟をしろ。爆発にもびくともしない。幸運を祈る。',
 lava_elemental:'巨大な火の玉……',
 agony:'ペイン・エレメンタルたちの大きな母親らしい！',
 angel:'本当に必要なときに、なぜ BFG が効かない？　忘れかけた悪夢から現れたような、死の先触れと遭遇した……',
 cyberdemon:'怪物と機械が一つになった存在。ロケットランチャーを備えたこの悪夢こそ、地獄で見つかる最悪の敵だ。少なくとも、そうであってほしい……',
 mastermind:'アラクノトロンにも生みの親がいるはずだ。やあ、母さん。プラズマ銃がないだけでもありがたい。代わりに、スーパー・チェーンガンを備えている。',
 jc:'やはりそうだった。侵略の背後にいる真の邪悪！　地獄の真の黒幕だ！　慈悲を知らないこいつを殺せ！　殺せ！！　今すぐ殺せ！！！',
 apostle:'まるで別の物語から来たかのようで、現実とは思えない……',
 arenamaster:'これまでに見た中で、最も凶悪で、醜く、強大なアーチヴァイル……',
 soldier:'君は兵士だ。悪魔の侵略に対し、この世界が送り出せる最高の一人だ。'
};
function semanticRegistryId(category,id){if(category==='difficulty')return {ITYTD:'too-young',HNTR:'not-too-rough',HMP:'hurt-me-plenty',UV:'ultra-violence','N!':'nightmare'}[id];return id.replaceAll('_','-').toLowerCase();}
export function verifyRegistrySources(sourceRoot,lock=JSON.parse(readFileSync(path.join(here,'registry-sources.lock.json'),'utf8'))){
 for(const [file,locked]of Object.entries(lock.sources)){
  if(file.includes('..')||path.isAbsolute(file)||!file.endsWith('.lua'))throw Error('Unsafe registry source lock path');
  const bytes=readFileSync(path.join(sourceRoot,file));
  if(bytes.length!==locked.bytes||digest(bytes)!==locked.sha256)throw Error(`Registry source provenance mismatch: ${file}`);
 }
 return lock;
}
export function lookupRegistryTerm(data,{category,registryId,scope='base_game',field,english},locale='ja'){
 if(!['ja','en'].includes(locale))throw Error('Unsupported registry locale');
 if(typeof english!=='string')throw Error('Registry English guard must be a string');
 const record=data.metadata.find(e=>e.category===category&&e.registryId===registryId&&e.scope===scope);
 const term=record?.fields[field];
 if(!term||term.english!==english)return english;
 const catalog=locale==='ja'?data.japaneseCatalog:data.englishCatalog;
 if(!Object.hasOwn(catalog,term.semanticId))throw Error('Missing reviewed registry text');
 return catalog[term.semanticId];
}
export function buildRegistryTerms(sourceRoot){
 const sourceLock=verifyRegistrySources(sourceRoot);
 verifyChallengeFields(sourceRoot);
 const files=[];function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(e.name==='.git')continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.lua'))files.push(p);}}walk(sourceRoot);
 const actualPaths=files.map(f=>path.relative(sourceRoot,f).replaceAll('\\','/')).sort();
 if(JSON.stringify(actualPaths)!==JSON.stringify(Object.keys(sourceLock.sources).sort()))throw Error('Registry Lua source set differs from pinned source');
 const registrations=[],sourceFiles={};
 for(const f of files.toSorted()){
  const bytes=readFileSync(f),file=path.relative(sourceRoot,f).replaceAll('\\','/'),entries=scanRegistrySource(bytes.toString('utf8'),file);
  if(entries.length){sourceFiles[file]={sha256:digest(bytes),bytes:bytes.length};registrations.push(...entries);}
 }
 const en={},ja={},metadata=[],pending=[];const used=new Set();
 for(const entry of registrations){
  const fields={};
  const rank=entry.category==='rank'?reviewedRankArrayFields.find(r=>r.source.file===entry.file&&r.source.offset===entry.fields.name?.start):null;
  for(const [field,token]of Object.entries(entry.fields)){
   let japanese;
   if(field==='name')japanese=nameTranslations[entry.category]?.[entry.registryId];
   if(entry.category==='klass'&&field==='desc')japanese=classDescriptions[entry.registryId];
   if(entry.category==='difficulty'&&field==='description')japanese=difficultyDescriptions[entry.registryId];
   if(entry.category==='cell'&&field==='blname'&&token.value==='blood')japanese='血';
   if(entry.category==='being'&&field==='name_plural')japanese=nameTranslations.being[entry.registryId];
   if(entry.category==='being'&&field==='desc')japanese=beingDescriptions[entry.registryId];
   if(entry.category==='item'&&field==='desc')japanese=itemDescriptions[entry.registryId];
   if(entry.category==='item'&&['good','firstmsg','warning'].includes(field))japanese=reviewedExtraField(entry.registryId,field,token.value);
   if(entry.category==='mod_array'&&field==='request_desc')japanese=assemblyRequirements[entry.registryId];
   if(entry.category==='cell'&&field==='blname'&&bloodiedCellNames[entry.registryId]!==undefined)japanese=bloodiedCellNames[entry.registryId];
   if(entry.category==='trait'&&field==='desc')japanese=traitDescriptions[entry.registryId];
   if(['being','level','trait'].includes(entry.category))japanese=reviewedStoryField(entry.category,entry.registryId,field,token.value)??japanese;
   const award=reviewedAwardFields[entry.category]?.[entry.registryId]?.[field];
   if(award){if(award.english!==token.value)throw Error(`Award source guard mismatch ${entry.registryId}.${field}`);japanese=award.japanese;}
   const misc=reviewedMiscRegistryFields[entry.category]?.[rank?.presentationKey??entry.registryId]?.[field];
   if(misc){if(misc.english!==token.value)throw Error(`Miscellaneous source guard mismatch ${entry.registryId}.${field}`);japanese=misc.japanese;}
   const challenge=entry.category==='challenge'?reviewedChallengeFields[entry.registryId]?.[field]:null;
   if(challenge){if(challenge.english!==token.value)throw Error(`Challenge source guard mismatch ${entry.registryId}.${field}`);japanese=challenge.japanese;}
   if(japanese===undefined){pending.push({category:entry.category,registryId:entry.registryId,file:entry.file,line:token.line,field,english:token.value,reason:'not yet curated'});continue;}
   const id=rank?.semanticId??(entry.category==='item'?reviewedExtraSemanticId(entry.registryId,field):undefined)??`term.${entry.category}.${semanticRegistryId(entry.category,entry.registryId)}.${field.replaceAll('_','-')}`;
   if(Object.hasOwn(en,id)&&en[id]!==token.value)throw Error(`Duplicate semantic registry field ${id}`);
   en[id]=token.value;ja[id]=japanese;used.add(`${entry.category}:${entry.registryId}`);
   fields[field]={semanticId:id,english:token.value,source:{file:entry.file,line:token.line,offset:token.start,endOffset:token.end,raw:token.raw},identity:token.value===japanese};
  }
  for(const p of entry.pending)pending.push({category:entry.category,registryId:entry.registryId,file:entry.file,...p});
  if(entry.category==='being'&&fields.name&&!entry.fields.name_plural&&!entry.pending.some(p=>p.field==='name_plural')){
   const producerFile='bin/data/core/main.lua',source=readFileSync(path.join(sourceRoot,producerFile),'utf8');
   const original='bp.name_plural = bp.name_plural or bp.name.."s"',start=source.indexOf(original);
   if(start<0||source.indexOf(original,start+1)>=0)throw Error('Default being plural producer guard mismatch');
   const id=`term.being.${semanticRegistryId('being',entry.registryId)}.name-plural`;
   en[id]=fields.name.english+'s';ja[id]=nameTranslations.being[entry.registryId];
   fields.name_plural={semanticId:id,english:en[id],source:{...fields.name.source},identity:en[id]===ja[id],derivation:{kind:'guarded-original-default-plural',sourceEnglish:fields.name.english,sourceSemanticId:fields.name.semanticId,producer:{file:producerFile,line:265,offset:start,endOffset:start+original.length,raw:original}}};
   sourceFiles[producerFile]={...sourceLock.sources[producerFile]};
  }
  if(Object.keys(fields).length)metadata.push({category:entry.category,registryId:rank?.presentationKey??entry.registryId,...(rank?{originalRegistryId:entry.registryId,registryIndex:rank.registryIndex,presentationOnlyQualifiedKey:true}:{}),scope:entry.scope,fields});
 }
 for(const [category,entries]of Object.entries(nameTranslations))for(const id of Object.keys(entries))if(!used.has(`${category}:${id}`))throw Error(`Reviewed name not found: ${category}:${id}`);
 for(const group of reviewedRankGroupTexts.filter(r=>r.field==='name')){
  const source=readFileSync(path.join(sourceRoot,group.source.file),'utf8'),matches=scanSource(source,'lua').tokens.filter(t=>t.kind==='string'&&t.line===group.source.line&&t.value===group.english);
  if(matches.length!==1)throw Error(`Rank group source guard mismatch ${group.registryId}`);const token=matches[0];
  en[group.id]=group.english;ja[group.id]=group.japanese;
  metadata.push({category:'rank_group',registryId:group.registryId,scope:'base_game',fields:{name:{semanticId:group.id,english:group.english,source:{file:group.source.file,line:token.line,offset:token.start,endOffset:token.end,raw:token.raw},identity:false}}});
 }
 const generatedRegistry=appendGeneratedRegistryFields(sourceRoot,metadata,en,ja,sourceFiles,sourceLock,topLiteralFields);
 return {schema:1,sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',preserveOriginalEnglishDomainStrings:true,sourceLockSha256:digest(readFileSync(path.join(here,'registry-sources.lock.json'))),sourceFiles,fieldRoles,englishCatalog:en,japaneseCatalog:ja,metadata,pending,reviewedNonliteralFieldBranches:reviewedRequirementDescriptions,generatedRegistry,generatedNamesAndRuntimeOverridesCovered:false,runtimeAdapterConnected:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const data=buildRegistryTerms(path.resolve(here,'../upstream/drl'));
 writeFileSync(path.join(here,'registration-term-catalog.json'),JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({reviewedRegistryFields:Object.keys(data.englishCatalog).length,registryEntries:data.metadata.length,pendingLiteralFields:data.pending.length,originalDomainModified:false}));
}
