/** Reviewed DRL special-level presentation messages, GPL-2.0-only.
 * Upstream chaosforgeorg/drl tag0_10_11a, a6f965072b3a25b768c91dbced00367f1b57d865.
 * This metadata does not execute Lua or modify original gameplay/domain strings.
 * Each English value is an exact decoded original first-argument literal guard.
 */
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanMessageCalls} from './message-inventory.mjs';

export const sourceCommit = 'a6f965072b3a25b768c91dbced00367f1b57d865';
const here = path.dirname(fileURLToPath(import.meta.url));
const levelFile = name => `bin/data/drl/levels/${name}.lua`;
const entry = (file,level,line,event,english,japanese) => ({
  file:levelFile(file), line, id:`message.level.${level}.${event}`, english, japanese,
});
const group = (file,level,rows) => rows.map(row => entry(file,level,...row));

export const staticLevelMessages = [
  ...group('abyssal','abyssal-plains',[
    [87,'beasts-slain-comment','"Ugly motherfuckers."','「醜いクソどもめ。」'],
    [112,'trap-closes',"Suddenly you're trapped in!",'突然、閉じ込められた！'],
    [118,'agony-howl','You hear a howl of agony!','苦悶の叫びが聞こえる！'],
    [128,'trap-walls-retract','Finally, the walls retract into the ground.','ようやく、壁が地面へと沈んでいく。'],
    [137,'exit-cleared-comment','Sure can make a guy miss the REAL plains...','本物の平原が恋しくなるぜ……'],
    [143,'exit-escaped-comment','Damn, that was way too close for comfort!.','くそっ、危うく死ぬところだった！'],
  ]),
  ...group('arena','hells-arena',[
    [194,'welcome-announcement','A devilish voice announces:\n{R"Welcome to Hell\'s Arena, mortal! You are either very foolish, or very brave. Either way I like it!"}','悪魔のような声が告げる：\n{R「地獄の闘技場へようこそ、人間よ！　愚か者か、それとも勇者か。どちらにせよ気に入ったぞ！」}'],
    [195,'welcome-crowd','{R"And so do the crowds!"}\nSuddenly you hear screams everywhere!\n{R"Blood! Blood! BLOOD!"}','{R「観客たちも同じようだ！」}\n突然、あちこちから叫び声が上がる！\n{R「血を！　血を！　血を見せろ！」}'],
    [196,'first-round-objective','The voice booms again:\n{R"Kill all enemies and I shall reward thee!"}','再び声が響き渡る：\n{R「すべての敵を殺せば、褒美を授けよう！」}'],
    [208,'crowd-blood-frenzy','The crowds go wild! "BLOOD! BLOOD!"','観客たちが熱狂する！　「血だ！　血だ！」'],
    [209,'crowd-blood-cheer','The crowds cheer! "Blood! Blood!"','観客たちが歓声を上げる！　「血を！　血を！」'],
    [210,'crowd-kill-cheer','The crowds cheer! "Kill! Kill!"','観客たちが歓声を上げる！　「殺せ！　殺せ！」'],
    [216,'first-round-cleared','The voice booms:\n{R"Not bad mortal! For the weakling that you are, you show some determination."}\nYou hear screams everywhere!\n{R"More Blood! More BLOOD!"}','声が響き渡る：\n{R「悪くないぞ、人間よ！　弱いくせに、なかなか根性がある。」}\nあちこちから叫び声が上がる！\n{R「もっと血を！　もっと血を見せろ！」}'],
    [217,'second-round-choice','The voice continues:\n{R"I can now let you go free, or you may try to complete the challenge!\nDo you want to continue the fight?"}','声は続く：\n{R「ここで解放してやってもよい。あるいは、この試練を最後まで挑むか！\n戦いを続けるか？」}'],
    [219,'second-round-accepted','The voice booms, "I like it! Let the show go on!"','声が響き渡る。「気に入った！　見世物を続けよう！」'],
    [220,'second-round-crowd','You hear screams everywhere! "More Blood! More BLOOD!"','あちこちから叫び声が上がる！　「もっと血を！　もっと血を見せろ！」'],
    [226,'second-round-refused','The voice booms, "Coward!" ','声が響き渡る。「臆病者め！」 '],
    [227,'coward-crowd','You hear screams everywhere! "Coward! Coward! COWARD!"','あちこちから叫び声が上がる！　「臆病者！　臆病者！　臆病者め！」'],
    [234,'second-round-cleared','The voice booms:\n{R"Impressive mortal! Your determination to survive makes me excited!"}\nYou hear screams everywhere!\n{R"More Blood! More BLOOD!"}','声が響き渡る：\n{R「見事だ、人間よ！　その生への執念、実に血が騒ぐ！」}\nあちこちから叫び声が上がる！\n{R「もっと血を！　もっと血を見せろ！」}'],
    [235,'final-round-choice','The voice continues:\n{R"I can let you go now, and give you a small reward, or you can choose to fight the final challenge!\nDo you want to continue the fight?"}','声は続く：\n{R「ささやかな褒美を与えて、ここで解放してやってもよい。あるいは、最後の試練に挑むか！\n戦いを続けるか？」}'],
    [237,'final-round-accepted','The voice booms, "Excellent! May the fight begin!!!"','声が響き渡る。「すばらしい！　戦いを始めよう！！！」'],
    [238,'final-round-crowd','You hear screams everywhere! "Kill, Kill, KILL!"','あちこちから叫び声が上がる！　「殺せ、殺せ、殺せ！」'],
    [253,'final-round-refused','The voice booms, "Too bad, you won\'t make it far then...!" ','声が響き渡る。「残念だ。それでは先が知れているな……！」 '],
    [254,'final-refusal-crowd','You hear screams everywhere! "Boooo..."','あちこちから叫び声が上がる！　「ブーッ……」'],
    [265,'champion-announcement','The voice booms:\n{R"Congratulations mortal! A pity you came to destroy us, for you would make a formidable Hell warrior!"}\nYou hear screams everywhere!\n{R"Champion! Blood! Champion! More BLOOD!"}\nThe voice continues:\n{R"I grant you the title of Hell\'s Arena Champion!\nAnd a promise is a promise... Search the arena again!"}','声が響き渡る：\n{R「おめでとう、人間よ！　我らを滅ぼしに来たとは惜しい。お前なら地獄の恐るべき戦士になれたものを！」}\nあちこちから叫び声が上がる！\n{R「王者！　血を！　王者！　もっと血を見せろ！」}\n声は続く：\n{R「地獄の闘技場の王者の称号を授けよう！\n約束は約束だ……もう一度、闘技場を探すがよい！」}'],
    [294,'exit-rejected-game','"To hell with your damn game."','「こんなクソ遊び、付き合ってられるか。」'],
    [300,'exit-taunt','The voice laughs, "Flee mortal, flee! There\'s no hiding in hell!"','声が嘲笑う。「逃げろ、人間よ、逃げるがいい！　地獄に隠れ場所はないぞ！」'],
  ]),
  ...group('armory','hells-armory',[
    [44,'shambler-wail','You hear a loud wail!','大きな悲鳴が聞こえる！'],
    [141,'lab-cache-opened','The lab cache opens.','研究室の保管庫が開く。'],
    [175,'heavy-machinery-sound','You hear the sounds of heavy machinery.','重機の作動音が聞こえる。'],
    [181,'exit-nuked-comment','Cleansed with fire.','炎で浄化してやった。'],
    [184,'exit-unopened-comment','Let it lie, that which is eternally dead...','永遠に死せるものは、そのまま眠らせておこう……'],
    [187,'exit-shambler-escaped-comment','This is madness!','こんなの正気の沙汰じゃない！'],
    [191,'exit-completed-comment','Gotta love the craft...','職人芸には惚れ惚れするぜ……'],
  ]),
  ...group('boss','phobos-anomaly',[
    [59,'hellgate-entered',"You feel yanked in a non-existing direction!",'存在しない方向へ引きずられる感覚がする！'],
    [137,'arrival-tension','You sense a certain tension.','張り詰めた気配を感じる。'],
    [142,'bruisers-slain-comment',"Why do they have to come in pairs? And what's that shimmering thing?",'どうして二体ずつ出てくるんだ？　それに、あのきらめくものは何だ？'],
    [157,'ambush-walls-lowered','Suddenly the walls lower!','突然、壁が下がる！'],
    [164,'inner-walls-disappeared','Suddenly the walls disappear!','突然、壁が消える！'],
  ]),
  ...group('boss','dis',[
    [307,'nuke-survived-praise',"You ingenious son of a gun! You're as smart as Hell itself!",'なんて頭の切れる奴だ！　地獄そのものに負けない知恵者だぜ！'],
    [308,'nuke-survived-unease',"But... something's wrong!",'だが……何かがおかしい！'],
    [309,'nuke-survived-menace','You sense a menace, a threat so evil it kills your mind!','恐ろしい気配を感じる。その邪悪さは、精神をも殺しかねない！'],
    [310,'nuke-survived-question','Was not all evil destroyed???','すべての悪を滅ぼしたはずではなかったのか？？？'],
    [322,'mastermind-defeated','Congratulations! You defeated the Spider Mastermind!','おめでとう！　スパイダー・マスターマインドを倒した！'],
  ]),
  ...group('centralprocessing','central-processing',[
    [35,'north-door-unlocked','North door unlocked.','北の扉のロックが解除された。'],
    [59,'central-area-unlocked','Central area unlocked.','中央区域のロックが解除された。'],
    [86,'processing-area-unlocked','Processing area unlocked.','処理区域のロックが解除された。'],
    [110,'east-door-unlocked','East door unlocked.','東の扉のロックが解除された。'],
    [133,'exit-unlocked','Exit unlocked.','出口のロックが解除された。'],
    [329,'machinery-stopped','The machinery falls silent.','機械が静まり返る。'],
    [386,'exit-cleared-comment','No meat left to process.','処理する肉は、もう残っていない。'],
    [389,'exit-incomplete-comment','Just too many to count.','多すぎて、とても数えきれない。'],
  ]),
  ...group('chained','chained-court',[
    [28,'staff-use-tired',"You're too tired to use the staff now.",'疲れすぎて、今は杖を使えない。'],
    [32,'staff-raised','You raise your arms!','両腕を掲げる！'],
    [34,'staff-vaults-incantation','With a sudden inspiration you yell "OPEN SESAME!"!','突然ひらめき、「開けゴマ！」と叫ぶ！'],
    [43,'staff-vaults-rumble','You hear a loud rumble!','大きな地響きが聞こえる！'],
    [47,'staff-house-recognition','You brandish the staff. The voice echoes: "So, it seems that ','杖を振りかざす。声が響く。「なるほど、どうやら '],
    [48,'staff-house-victory-recognition','you have bested one of my offspring. Very well, you are allowed ','我が子の一人を倒したようだな。よかろう、お前がここを通る間は '],
    [49,'staff-house-access-granted','full access to my domain as you traverse through it."','我が領域のどこへでも立ち入ることを許そう。」'],
    [84,'first-cage-raised','The cage rises!','檻が上がる！'],
    [113,'second-cage-raised','The cage rises!','檻が上がる！'],
    [143,'third-cage-raised','The cage rises!','檻が上がる！'],
    [314,'arena-master-defeated-comment','So much for hellish fair-play.','地獄のフェアプレーなんて、こんなものか。'],
    [323,'arena-master-announcement','A devilish voice booms:','悪魔のような声が響き渡る：'],
    [324,'arena-master-threat','"Come to think of it... I\'d rather see you dead, mortal... prepare yourself!"','「考えてみれば……お前には死んでもらいたいな、人間よ……覚悟しろ！」'],
  ]),
  ...group('containment','containment-area',[
    [77,'ambush-enemies-slain-comment','I guess I prefered the Wall. The air seems less claustrophic now.','「壁」のほうがよかった気もするな。これで少しは息苦しさも薄れた。'],
    [94,'ambush-prelude-comment','"This is too easy..."','「簡単すぎる……」'],
    [98,'ambush-revealed-comment','"It\'s a trap!"','「罠だ！」'],
    [125,'exit-unopened-comment','I guess this tincan will stay closed...','このブリキ缶は閉じたままでいいか……'],
    [128,'exit-ambush-escaped-comment',"It's way too hairy down here!",'ここは危なすぎる！'],
    [132,'exit-completed-comment',"Luckily it's not as bad as tricks and traps...",'ありがたいことに、あの仕掛けと罠ほどひどくはなかった……'],
  ]),
  ...group('deimoslab','deimos-lab',[
    [36,'walls-raised','The walls rise!','壁がせり上がる！'],
    [41,'vault-opened','The vault opens!','保管庫が開く！'],
    [43,'shamblers-wail','You hear a loud wail!','大きな悲鳴が聞こえる！'],
    [156,'lab-caches-opened','The lab caches open.','研究室の保管庫が開く。'],
    [181,'exit-nuked-comment','Cleansed with fire.','炎で浄化してやった。'],
    [184,'exit-unopened-comment','Let it lie, that which is eternally dead...','永遠に死せるものは、そのまま眠らせておこう……'],
    [187,'exit-reward-abandoned-comment','Better safe than sorry.','用心するに越したことはない。'],
    [190,'exit-shamblers-escaped-comment','This is madness!','こんなの正気の沙汰じゃない！'],
    [194,'exit-completed-comment','Gotta love the craft...','職人芸には惚れ惚れするぜ……'],
  ]),
  ...group('fortress','unholy-cathedral',[
    [25,'longinus-invoke-tired','You are too tired to invoke the Spear!','疲れすぎて、槍の力を呼び起こせない！'],
    [59,'longinus-holy-aura','You perceive an aura of holiness around this weapon!','この武器を包む聖なる気配を感じる！'],
    [76,'azrael-invoke-tired','You are too tired to invoke the Scythe!','疲れすぎて、大鎌の力を呼び起こせない！'],
    [79,'azrael-life-drained','You feel your life energy draining away!','生命力が吸い取られていくのを感じる！'],
    [115,'azrael-evil-aura','You perceive an aura of evil around this weapon!','この武器を包む邪悪な気配を感じる！'],
    [203,'angel-slain-collapse-prelude','As you kill the Angel of Death the cathedral suddenly','死の天使を倒すと、大聖堂は突然'],
    [204,'angel-slain-collapse','starts to fall apart!','崩れ始める！'],
    [211,'ranged-weapon-disabled','You pull the trigger... nothing happens!','引き金を引く……何も起こらない！'],
    [219,'exit-escaped-poem-regret','...Or wonder, till it drives you mad,','……さもなくば、気が狂うまで思い悩むがいい、'],
    [220,'exit-escaped-poem-possibility','What would have followed if you had....','もし踏み出していたなら、何が待っていたのかと……'],
    [224,'exit-completed-comment','Never again...','二度とごめんだ……'],
  ]),
  ...group('house','house-of-pain',[
    [16,'teleport-forbidden','Hey, no teleporting in the House!','おい、この館でテレポートはお断りだ！'],
    [88,'doors-unlocked','The doors unlock.','扉のロックが解除される。'],
    [96,'reward-invitation','The voice wails:\n{R"I\'m impressed! Why don\'t you come back to the first room and we\'ll see if I can\'t give you a just reward."}','声が甲高く響く：\n{R「感心したぞ！　最初の部屋に戻ってきたらどうだ。ふさわしい褒美を用意できるか、見てみよう。」}'],
    [118,'reward-trap-announcement','The voice laughs: "Allow me to present you your just reward!"','声が笑う。「お前にふさわしい褒美を贈ろう！」'],
    [140,'doors-slammed','The doors shut violently!','扉が勢いよく閉まる！'],
    [148,'access-choice','A deathly high-pitched voice cackles!\n{R"Well, who do we have here?"} it begins. {R"It seems that you\'ve stumbled into my luxurious home. Would you care to have access?"}','死を思わせる甲高い声が、けたたましく笑う！\n{R「おやおや、誰が来たのかな？」}声は言う。{R「どうやら、我が豪華な屋敷に迷い込んだようだね。中を見ていくかい？」}'],
    [150,'access-accepted',"Well then, enjoy yourself. Just be wary of my other guests!",'それでは、楽しんでいくがいい。ただし、他の客には気をつけろよ！'],
    [153,'access-refused',"No? All right, I'll see you out then.",'嫌かい？　わかった、それなら出口へ案内しよう。'],
    [162,'exit-incomplete-comment','Better show myself out...','自分で退散するほうがよさそうだ……'],
    [165,'exit-first-room-comment','Enough!','もうたくさんだ！'],
    [169,'exit-completed-comment','My house, my rules.','俺の家では、俺がルールだ。'],
  ]),
  ...group('lavapits','lava-pits',[
    [80,'elemental-arrival-prelude','That seems to be all of them... wait! Something is moving there, or is it just lava glow?','これで全部のようだ……待て！　何かが動いている。いや、溶岩の光か？'],
    [85,'elemental-slain-comment','Tough son of a bitch... now to get that shiny object he left behind...','しぶといクソ野郎だった……さて、あいつが残した光るものを拾うか……'],
    [93,'exit-incomplete-comment',"Too hot dammit, I'm leaving this party...",'くそっ、暑すぎる。この宴からは退散だ……'],
    [96,'exit-elemental-escaped-comment',"There goes my beard... at least I'm still alive.",'ひげが焼けちまった……まあ、生きているだけましか。'],
    [100,'exit-completed-comment',"Lava elementals my ass. I don't care.",'溶岩のエレメンタルが何だってんだ。知ったことか。'],
  ]),
  ...group('limbo','limbo',[
    [33,'west-bridges-raised','The west bridges rise!','西の橋がせり上がる！'],
    [59,'east-bridges-raised','The east bridges rise!','東の橋がせり上がる！'],
    [132,'arrival-blood-stench','The smell of blood! You can barely believe this living hell...','血の臭いだ！　この生き地獄は、とても信じられない……'],
    [134,'arch-viles-arrived','Suddenly with a wail, arch-viles appear!','突然、悲鳴とともにアーチヴァイルが現れる！'],
    [142,'all-enemies-slain','Suddenly everything is peaceful. Rest in peace, damned souls...','突然、あたりが静まり返る。呪われた魂よ、安らかに眠れ……'],
    [147,'cursed-reward-sensed','A presence! Of something cursed. How could that be?','気配がする！　何か呪われたものの気配だ。どういうことだ？'],
    [150,'holy-reward-sensed','A presence! Of something holy! Here in this hell?','気配がする！　何か聖なるものの気配だ！　この地獄に？'],
    [154,'reward-under-corpses','Find it under the corpses!','死体の下を探せ！'],
    [161,'exit-enemies-returned',"As you descend the stairs you hear a wail. They're back...",'階段を下りると悲鳴が聞こえる。奴らが戻ってきた……'],
    [162,'exit-final-resolution',"There's only one way to end this...",'これを終わらせる方法は、一つしかない……'],
    [180,'exit-escaped-comment','You flee! You flee like hell from this cursed place!','逃げ出す！　この呪われた場所から、必死で逃げ出す！'],
  ]),
  ...group('milibase','military-base',[
    [75,'all-enemies-slain','They can all rest easy now...','これでみんな、安らかに眠れる……'],
    [97,'exit-incomplete-comment','Too many memories to go destroying them all...','みんなを殺すには、思い出が多すぎる……'],
    [101,'exit-completed-comment','Better to end their tortured bodies here and now.','苦しめられたその体を、ここで終わらせてやるのがいい。'],
  ]),
  ...group('mortuary','mortuary',[
    [72,'arrival-blood-stench','The smell of blood! Can this be real?? The floor is','血の臭いだ！　こんなことが本当にあるのか？？　床は'],
    [73,'arrival-corpses-everywhere','covered in blood, and there are corpses everywhere!','血で覆われ、至るところに死体がある！'],
    [76,'arch-viles-arrived','Suddenly with a wail, arch-viles appear!','突然、悲鳴とともにアーチヴァイルが現れる！'],
    [83,'all-enemies-slain','Suddenly everything is peaceful. Rest in peace, damned souls...','突然、あたりが静まり返る。呪われた魂よ、安らかに眠れ……'],
    [88,'cursed-reward-sensed','A presence! Of something cursed. How could that be?','気配がする！　何か呪われたものの気配だ。どういうことだ？'],
    [91,'holy-reward-sensed','A presence! Of something holy! Here in this hell?','気配がする！　何か聖なるものの気配だ！　この地獄に？'],
    [95,'reward-under-corpses','Find it under the corpses!','死体の下を探せ！'],
    [101,'exit-enemies-returned',"As you descend the stairs you hear a wail. They're back...",'階段を下りると悲鳴が聞こえる。奴らが戻ってきた……'],
    [102,'exit-final-resolution',"There's only one way to end this...",'これを終わらせる方法は、一つしかない……'],
    [121,'exit-escaped-comment','You flee! You flee like hell from this cursed place!','逃げ出す！　この呪われた場所から、必死で逃げ出す！'],
  ]),
  ...group('mterebus','mt-erebus',[
    [130,'elemental-arrival-prelude','That seems to be all of them... wait! Something is moving there, or is it just lava glow?','これで全部のようだ……待て！　何かが動いている。いや、溶岩の光か？'],
    [139,'elemental-slain-comment','Tough son of a bitch... now to get that shiny object he left behind...','しぶといクソ野郎だった……さて、あいつが残した光るものを拾うか……'],
    [147,'exit-incomplete-comment','Better leave, before this thing blows!','噴き出す前に退散したほうがよさそうだ！'],
    [150,'exit-elemental-escaped-comment',"There goes my beard... at least I'm still alive.",'ひげが焼けちまった……まあ、生きているだけましか。'],
    [154,'exit-completed-comment',"Lava elementals my ass. I don't care.",'溶岩のエレメンタルが何だってんだ。知ったことか。'],
  ]),
  ...group('phoboslab','phobos-lab',[
    [30,'green-access-granted','Green access granted, west doors unlocked.','緑の区域へのアクセスが許可され、西の扉のロックが解除された。'],
    [59,'blue-access-granted','Blue access granted, east doors unlocked.','青の区域へのアクセスが許可され、東の扉のロックが解除された。'],
    [147,'lab-cleared-comment','"This lab won\'t do any more experiments... I wonder if there are others?"','「この研究所で実験が行われることは、もうない……他にもあるのか？」'],
    [155,'western-trap-walls-lowered','The walls lower!','壁が下がる！'],
    [164,'eastern-trap-walls-lowered','The walls lower!','壁が下がる！'],
    [182,'exit-lab-comment','"So much for the lab, next time I\'ll use neurotoxin..."','「研究所はこんなものか。次は神経毒を使ってやる……」'],
  ]),
  ...group('skulls','city-of-skulls',[
    [64,'first-wave-slain-comment','That seems to be all of them, hopefully...','これで全部のはずだ。そう願いたいが……'],
    [70,'final-wave-slain-comment','That had damn well better be all of them!','くそっ、これで全部だろうな！'],
    [75,'lost-souls-arrived','Suddenly lost souls appear out of nowhere!','突然、どこからともなくロストソウルが現れる！'],
    [79,'pain-elementals-arrived','Suddenly pain elementals appear out of nowhere!','突然、どこからともなくペイン・エレメンタルが現れる！'],
    [83,'agony-howl','You hear a howl of agony!','苦悶の叫びが聞こえる！'],
  ]),
  ...group('spider','spiders-lair',[
    [89,'webs-cleared-items-revealed','Suddenly the webs fade. From under the webs, items emerge...','突然、クモの巣が消える。巣の下からアイテムが姿を現す……'],
    [106,'exit-incomplete-comment','Arachnophobia!','クモ恐怖症になっちまう！'],
    [110,'exit-completed-comment','Silence rules the spidery lands...','クモの住処を、静寂が支配する……'],
  ]),
  ...group('toxinrefinery','toxin-refinery',[
    [34,'east-door-unlocked','Eastern door unlocked.','東の扉のロックが解除された。'],
    [57,'smoking-area-unlocked','Smoking area unlocked.','喫煙区域のロックが解除された。'],
    [81,'shortcut-unlocked','Shortcut unlocked.','近道のロックが解除された。'],
    [234,'toxin-stench-dissipated','The acrid smell begins to dissipate.','鼻を刺す臭いが薄れ始める。'],
    [274,'exit-cleared-comment','You were a green machine.','緑の殺戮マシンとして暴れ回った。'],
    [277,'exit-incomplete-comment',"That'll set them back a bit.",'これで奴らも、少しは困るだろう。'],
  ]),
  ...group('vaults','vaults',[
    [143,'cleared-vaults-loot-comment','You would think there would be an easier way in. At least I got the loot!','もっと楽に入る方法があってもよさそうなものだ。まあ、お宝は手に入れた！'],
    [146,'opened-vaults-loot-comment',"Well, they sure opened up. Now to see if there's anything left worth taking...",'確かに開いたな。さて、持ち帰る価値のあるものが残っているか……'],
    [160,'exit-no-loot-comment','All these treasures left behind...','こんなに宝を残していくことになるとは……'],
    [163,'exit-loot-obtained-comment','At least I got something!','少なくとも、手ぶらではない！'],
    [168,'exit-completed-treasure-warning','Eternal death awaits any who would seek to steal the treasures secured within the Vaults...','この宝物庫に守られた財宝を盗もうとする者には、永遠の死が待っている……'],
  ]),
  ...group('wall','wall',[
    [70,'all-enemies-slain','Peace comes back to this evil place. Cracks begin to appear as if in deference to your achievement.','この邪悪な場所に静けさが戻る。功績に敬意を表するかのように、ひびが入り始める。'],
    [84,'exit-unopened-comment','Hearing them scream soothes the soul...','奴らの悲鳴を聞くと、心が安らぐ……'],
    [87,'exit-incomplete-comment','This must be madness!','こんなの正気の沙汰じゃない！'],
    [91,'exit-completed-brick-comment',"All in all, we're just another brick in the wall.",'結局のところ、俺たちも壁の中の一枚のレンガにすぎない。'],
  ]),
];

/** One active dispatch is not a literal first-argument call. Translate its assignments
 * through separately reviewed event sites; never match the resulting English globally. */
export const pendingLevelMessages = [{
  file:levelFile('mterebus'), line:193,
  reason:'ui.msg(msg) dispatches a local variable selected by terrain/status branches; its three assignment literals need separate semantic event sites.',
  sourceAlternatives:[
    {line:172,english:'The molten cliffs give way leaving you tremendously exposed.'},
    {line:179,english:'A violent earthquake shakes your being.'},
    {line:187,english:'The safety of the earth dissolves in front of you.'},
  ],
}];
export const pairedLevelMessages = [];

/** Read-only independent callsite verification, suitable for integration tests. */
export function verifyStaticLevelMessages(sourceRoot = path.resolve(here,'../upstream/drl')) {
  const inventory = JSON.parse(readFileSync(path.join(here,'message-inventory.json'),'utf8'));
  if (inventory.sourceCommit !== sourceCommit) throw Error('DRL source commit lock mismatch');
  const dir = path.join(sourceRoot,'bin/data/drl/levels');
  const calls = [];
  const sourceFiles = {};
  for (const fileName of readdirSync(dir).filter(f=>f.endsWith('.lua')).sort()) {
    const file = `bin/data/drl/levels/${fileName}`;
    const bytes = readFileSync(path.join(sourceRoot,file));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const found = scanMessageCalls(bytes.toString('utf8'),'lua',file);
    if (found.length) {
      if (inventory.sourceFiles[file]?.sha256 !== sha256) throw Error(`Source hash mismatch: ${file}`);
      sourceFiles[file] = {sha256,bytes:bytes.length};
    }
    calls.push(...found);
  }
  const staticCalls = calls.filter(c=>c.classification==='static_literal');
  if (staticCalls.length !== staticLevelMessages.length) throw Error('Static level coverage count mismatch');
  const seenIds = new Set(), seenSites = new Set();
  for (const message of staticLevelMessages) {
    const key = `${message.file}:${message.line}`;
    if (seenSites.has(key)) throw Error(`Duplicate level site: ${key}`);
    if (seenIds.has(message.id)) throw Error(`Duplicate semantic ID: ${message.id}`);
    if (!/^message\.level\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(message.id)) throw Error(`Invalid semantic ID: ${message.id}`);
    seenSites.add(key); seenIds.add(message.id);
    const matches = staticCalls.filter(c=>c.file===message.file&&c.line===message.line);
    if (matches.length !== 1 || matches[0].arguments[0].strings[0].value !== message.english) throw Error(`Original literal guard mismatch: ${key}`);
    if (!message.japanese || !/[\u3040-\u30ff\u3400-\u9fff]/u.test(message.japanese)) throw Error(`Missing Japanese translation: ${key}`);
    // Single-brace VTIG opener/control tokens and closing braces are syntax, not prose.
    const markup = s => JSON.stringify(s.match(/\{(?:\$[^}]*\}|\^\d+|[A-Za-z!])|\}/g)??[]);
    if (markup(message.english) !== markup(message.japanese)) throw Error(`VTIG markup mismatch: ${key}`);
    if (message.english.split('\n').length !== message.japanese.split('\n').length) throw Error(`Paragraph line topology mismatch: ${key}`);
  }
  const pending = calls.filter(c=>c.classification!=='static_literal');
  if (pending.length !== pendingLevelMessages.length) throw Error('Pending level coverage count mismatch');
  for (const p of pendingLevelMessages) {
    const c = pending.find(c=>c.file===p.file&&c.line===p.line);
    if (!c || c.arguments[0]?.source !== 'msg' || !p.reason) throw Error('Pending dispatch guard mismatch');
    const sourceLines = readFileSync(path.join(sourceRoot,p.file),'utf8').split(/\r?\n/);
    for (const alternative of p.sourceAlternatives) {
      const assignment = sourceLines[alternative.line-1];
      if (!assignment?.includes(`msg = ${JSON.stringify(alternative.english)}`)) throw Error(`Pending assignment guard mismatch: ${p.file}:${alternative.line}`);
    }
  }
  return {sourceCommit,staticLiteralCalls:staticCalls.length,reviewedMessages:staticLevelMessages.length,pendingCalls:pending.length,pairedCalls:0,sourceFiles,originalGameplayExecuted:false,runtimeAdapterConnected:false};
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verifyStaticLevelMessages(),null,2));
}
