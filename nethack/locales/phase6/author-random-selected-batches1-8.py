#!/usr/bin/env python3
"""Source-only Japanese for assigned original selected public resource units."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRAMES = {1: r'''テレパシーが使えるなら、目隠しはとても役に立つ。
ろうそくを七本付けた燭台は、魔法の光で道を示す。
クリームパイには二つの用途がある。食べ物として……そして娯楽として。
水晶の板金鎧は錆びない。
死体が生きた体を守ることもある。ただし、アイテムを守れるのはアイテムだけだ。
刀ならワームを真っ二つにできるかもしれない。
魔法の嘔吐ポンプは大食漢の役に立つかもしれない。
ニンフは鎖の外し方を知っている。
盲目の薬を飲むと、見えないものが見えるようになる。
僧侶なら神々に話を聞いてもらいやすい。
巫女で処女であっても、あのユニコーンは気にしない。
部屋に看護師がいるなら、争いの指輪は厄介だ。
ショートソードはロングソードほどよくない。
サキュバスはニンフよりも、もっと先まで踏み込む。
杖で、かつての探検者の幽霊を退散させられる。
酸の塊には素手で攻撃するべきだ。
ニンフとの情事は、しばしば高くつく。
ニンフが怖い？　装飾の指輪を着けよう。
貴重品を盗まれるのが怖い？　もっとガラクタを持ち歩こう！
月の満ち欠けには、いつも気を配ろう！
大切な伝言を刻む前には、必ず床を掃除しよう。
イェンダーの魔除けを作るのは難しい。願いの杖にとってさえ。
エルフの外套は魔法に対して役に立つ。
アンバーハルクの姿を見ると、混乱することがある。
クロムに誓って、もう二度と飢えたりしない！
怪物について尋ねると、とても役に立つことがある。
長いワームは後ろから攻撃しよう。そのほうがずっと安全だ！
いない場所にいるつもりでウナギを攻撃すると、たいてい命取りになる！
傷に包帯を巻くと、見た目を取り繕える。
弓で怪物を殴るのは、あまりよい考えではない。
気をつけろ！　魔法使いが待ち伏せを企んでいるかもしれない！
看護師には親切に。武器をしまい、服を脱ごう。
白紙の巻物のほうが、読んでいて面白い。
目が見えない？　浮遊する目を捕まえよう！
本屋は巻物を読まない。連れ去られてしまうかもしれないから。
化学入門：水を酸に注いではいけない。
簡潔な征服法：支配し、混乱させ、召喚し、断罪せよ。
エネルギーを節約しよう。明かりを消そう。
墓を掘り返すのは、よくない考えかもしれない……
ダイリチウムの結晶は、本当に珍しい。
犬は臓物のにおいに引き寄せられる。
犬は迷信深い。呪われたアイテムは決して踏まない。
幽霊の犬は怒っているのではなく、ただ腹をすかせている。
忘れるな！　大きな犬は、小さな犬よりはるかに倒しにくい。
目が見えないときには、人をむやみに殴ってはいけない。
店主に手を出すな。ギルドに追われることになるぞ。
ドラゴンは子供を鞭で打たない。打っても感じないから！
ドワーフは外套を使って飲み物を冷たく保つ。
ニンジンを食べよう。目によいのだ。
冷凍球を食べるのは、イエティを食べるようなものだ。
殺人蜂を食べるのは、サソリを食べるようなものだ。
天狗を食べるのは、ニンフを食べるようなものだ。
死霊を食べると、実りある経験になる！
未払いのレプラコーンを食べると、得をするかもしれない。
Elbereth は、このあたりでたいした評判だ。
エルフの死体は眠りの精と相性が悪い。時には神々とも。
エルフの外套は錆びない。
エルフは疲れを和らげてくれることがある。
邪悪なプレイヤーにも守護天使がいる。
最強の英雄でも、飲んで傷を癒す必要があることはある。
魔法のかかった歯で戦ったことはある？
混乱しているときに読んでみたことはある？
トロルを大きな箱に閉じ込めようとしたことはある？
なぜ何かを薬に浸したくなるのか、考えたことはある？
高価なカメラの閃光は、奥まで届く。
余分な階段は、余分な階につながる。
燃える文字は、怪物を遠ざけるかもしれない。
楽しく過ごしたければ、`Elbereth' と刻もう。
宝石は、うっかり投げ捨てるには貴重すぎる。
腹が減ってきた？　指輪を着けるのをやめよう！
暑くなってきた？　イェンダーの魔除けを外し、出口から離れよう！
神々は、自らの聖職者に最善を期待する。
神々は半神を鼻であしらう。
神々は猫と犬が好きだ。
質問がある？　rec.games.roguelike.nethack を試そう。
墓泥棒は、時には金持ちになる。
ガイ・モンターグは巻物を袋にしまっている。
瓶は慎重に扱おう。中に幽霊がいるかもしれない！
頑丈なブーツが守るのは、足だけではないこともある。
聖水には多くの用途がある。
馬は乗り手を信頼する。信頼に値しないときでも。
空腹は、犬にとって混乱を招く経験だ！
食べるのが速すぎて窒息死したハッカーを、昔知っていた。
曲がりくねった狭い通路の迷路のにおいがする。
願いの杖なんて願わなければよかった。（願望的思考というやつだ。）
巨人とキャッチボールをするのは、お勧めしない。
お前を見ているぞ。――イェンダーの魔法使い
氷箱は食べ物を新鮮に保つ。
罰を受けるときは、凶器が使われる。
魔法使いを倒すと、半神に昇格する。
掘削の杖が必要なら、ミノタウロスに丁重に頼もう。
攻撃を当てたければ、ダガーを使おう。
店を襲いたければ、犬を訓練しよう。
迷ったなら、次に店に行ったときに地図を買ってみよう。
手が油っぽいなら、洗ってみては？
アイテムが壊れたなら、適切な指輪を着けていなかったのだ。
店では、何かを買う前に値札を見ておいたほうがよい。
店で杖を使うのは行儀が悪い。
真夜中に墓地を訪れるのは危険だ。
犬を呼ぶために口笛を吹くのが、よい考えとは限らない。''', 2: r'''魔法使いが助っ人を雇ったという噂だ。
状態（status）を石像（statue）に変えるのは、'e' ではなく 'c' の文字だ。
ユニコーンにルビーを差し出すのは、よい考えかもしれない。
あなたの犬が石になったら、ひときわ悲しいことだろう。
ここは 'd' が 'd' を食う世界だ。
READ ME と書いてあっても、読んだほうがよいとは限らない。
鎧を錆から遠ざけよう。
武器を酸から遠ざけよう。
自分と同じ色のユニコーンを殺すと、自分の運も殺す。
革は水を通さない。傘を差した牛を見たことがある？
レプラコーンは、このダンジョンで最も腕のよい財布泥棒だ。
トカゲの死体はコカトリスから守ってくれる。
金を失えば少し失う。名誉を失えば多く失う。勇気を失えばすべて失う。
たいていの怪物は泳げない。
音楽には、頑固な跳ね橋を動かす力がある。
音楽には、野蛮な獣をなだめる力がある。
衛兵を攻撃してはいけない。
長いワームに乗ってはいけない。
悪態を刻むのに、一番よい武器を使ってはいけない。
重い荷物を背負っていては、楽には戦えない！
歩くために作られたブーツばかりではない。
看護師は裸の人に触れる訓練を受けている。裸の人を傷つけはしない。
ニンフが外せるのは、あなたの鎖帷子だけではない。
いつかあなたの小さな犬は大きな犬になり、あなたは誇らしく思うだろう。
卵を産めるのは雌の怪物だけだ。
呪われた鎧破壊の巻物を読むのは、よほど混乱した冒険者だけだろう。
缶詰を開けるのは難しい。素手でやろうとすれば、なおさらだ！
オークと殺人蜂は、同じような暮らし方をする。
オークは暗い部屋では子供を作らない。
地味なニンフは無害だ。
AD&D を遊ぶと役に立つかもしれない。
Gauntlet を遊ぶと、状況によってはためになるかもしれない。
店では、ビリヤードをすると得をする。
店主を変身させると、もっと安全になるかもしれない。
犬を変身させると、おそらくもっと安全になる。
薬は普通は混ざらないが、ときには……
しーっ！　鏡を使っているんだ！
瞬間移動の指輪を着けよう。猛攻から逃がしてくれる。
光線はもちろんブーメランではない。とはいえ……
洞窟に入る前に説明書を読もう。さもないと命を落とすかもしれない。
ハーバートを読むと、ある場合にはためになるかもしれない。
トールキンを読むと役に立つかもしれない。
酒を飲んでから巻物を読むと、混乱した結果になることがある。
ドラゴンに乗ると、気分も高度も上がるかもしれない。
錆の怪物は水が好きだ。しかし、嫌いな薬もある。
袋は中身を華氏452度までの熱から守る。
巻物が色あせる？　熱ではなく、湿気のせいだ。
店主はクレジットカードを受け付ける。現金で払うなら。
あのハワイアンシャツなら、店主は一マイル先からでも観光客とわかる。
店主は一卵性双生児を見分けられない。
店主は字を読まない。それなら、店で刻字する意味は？
店主は驚くほど辛抱強い。
店主は観光客向けに値段を上げるかもしれない。
店主は復讐よりも金を大切にする。
手なずけられる怪物もいる。手なずけたドラゴンを連れたハッカーを、一度見たことがある！
柔軟であり続けるものもいれば、調子を変えられそうにないものもいる。
上がる < ものは下がる > かもしれない、と誰かが言っていた。
誰かが落とし穴に棘を仕込んでいる！
怪物は、あなたを襲うより互いに戦うほうを選びやすいこともある。
ほうれん草、ニンジン、ゼリー。看護師にふさわしい食事だ！
鉱山を最後まで生き抜ければ、運が変わり始めているのかもしれない。
腐った肉は、毒よりもひどく病気を引き起こす！
治療の薬を次のレベルへ持っていこう！
テレパシーはただの技だ。やり方さえわかれば簡単だ。
レプラコーン金貨 Tru$t は、魔法の記憶金庫の一部ではない。
魔法使いにとって、死はなかなかの経験になる。
仕事に最適な装備は、もちろん一番高価なものだ。
神々は、うるさい聖職者をありがたがらない。
犬を殺すと、神々は怒る。
鎧にかかった魔法が少ないほど、追加できる魔法は多い。
魔法のマーカーは剣よりも強し。
このゲームに影響する天体は、月だけではない。
オークが、Elfrist と名付けたオークの幅広剣をあなたに振り下ろす。あなたは死んだ……
「何も起こらない」杖の秘密：もう一度試そう！
鏡には昔から、どこか神秘的なところがある。
ダンジョンの奥深くには、マスターマインドがいる。
動物園には、大きな宝が隠されている！
この洞窟には、目に見える以上の魔法がある。
大きな犬を褒めても害はない。
ミミックを食べるのに勝るものはない。
ランスロットという騎士がいた。ランスを手に乗り回すのが大好きだった。
ゼラチンの立方体は、あなたを麻痺させることがあるという……
ジュイブレックスは掘削の杖を少し恐れているという。
メデューサは、あなたを台座に載せたがっているという。
ヴラドは生きている！！！……迷路の近くにいるという。
「Elbereth」は、よく書かれるという。
保持の袋にも、何もかも入るわけではないという。
祝福されたクアジット肉の缶詰は、すぐに食べられるという。
猫は罠を避けるという。
洞窟グモは、ときどき洞窟グモの卵を食べるという。
賢い魔法使いなら、能力値を 18/** 24 18 24 24 24 にできるという。
ニンニク一片は、正しく扱えばよいお守りになるという。
呪われた瞬間移動の巻物は、厄介な場所に飛ばすことがあるという。
ダイヤモンドも、一種の幸運の石だという。
犬は、物を取ってくるように訓練できるという。
ゼラチンの立方体は、健康によい朝食になるという。
巨人は正しく食べて強くなるという。試してみよう！
格子虫は、横切ると攻撃してこないという。
レンバスの薄焼きは、とても軽い軽食だという。
重しの石には不思議な引力があり、不運な石ではないという。''', 3: r'''別の名で呼んでも、ロックピックはロックピックのままだという。
幸運の魔除けは、毒矢を防ぐという。
鏡は浮遊する目を動けなくするが、その姿はまだ見えるという。
中立の人物なら、ジャイアントスレイヤーを手に入れられるかもしれないという。
変身の罠は魔法なので、魔法からの保護で防げるという。
治療の薬で病気の薬を打ち消せるという。
怪物探知の薬は、時には双方に働くという。
流し台は、床のはるか上から見ると違って見えるという。
召喚された悪魔が、あなたのゲームをよくしてくれるかもしれないという。
死霊肉の缶詰は、珍しい食事の経験になるという。
ユニコーンが幸運をもたらすこともあるという。
打ち消しの杖は、変身の杖に似ているという。
施錠の杖が閉じられるのは、扉だけではないという。
変身の杖は、あなたのゲームを変えることがあるという。
寄付を賢く選べば、祝福を選べるという。
魔法使いは、二度目にはさらに強力になるという。
ゾーンは、あなたを追うときには障害物をものともしないという。
クレジットカードを悪用すると、遅かれ早かれショックを受けることがあるという。
魔除けも、たいていのものと同じく、命を奪うことも救うこともあるという。
祭壇で祝福を見分けられるという。
ウーズはブーツに噛みつき、岩モグラはブーツを食べることがあるという。
運の悪いハッカーが、缶詰の爆発で死んだことがあるという。
骨董商はいつも貴石に興味を持っているという。
傷に包帯を巻くと、見た目を取り繕えるという。
酒は薄められるが、打ち消すことはできないという。
耳を澄ませれば、隠し扉の音が聞こえるという！
ニンジンやニンジンジュースは、視力をよくするかもしれないという。
洞窟グモは、高価な健康食品とはみなされていないという。
半神は、大切な地上の持ち物を置いていかなければならないという。
ジンを邪魔すると、高くつく間違いになることがあるという。
ドラゴンの鱗には、かなり魅惑的なところがあるという。
噴水に硬貨を落としても、願いはかなわないという。
ドワーフは秩序正しく、自分のことに専念するという。
コウモリの死体を食べると、しばらく頭がおかしくなるという。
クラムの保存食を食べるのは、賢い一手だという。
青いゼリーを食べるのは、その感じに逆らわなければクールだという。
エルフの鎧には、最も多くの魔法を込められるという。
ダンジョンから逃れるのは、終わりの始まりにすぎないという。
思わぬ風を感じるのは、一種の突破口になるという。
呪われた灰色の石を見つけるのは、いつも不運だという。
レベルを上げる経験は、視野も高めるという。
ガータースネークの肉は、おいしくなくても健康によいという。
器用さの籠手には、隠れた魔法の手際があるという。
天国へ行くのも、ダンジョンから逃れる別の方法だという。
ゴールデンナーガは、あなたもそうである限り、法を守る住民だという。
グレムリンは、今よりも涼しく感じさせてくれることがあるという。
格子虫は、厳密にデカルト的な意味でしか存在しないという。
ハッカーは、ニンフを食べることにはよく「跳び上がりそう」な気分になるという。
変身の制御があれば、ショックを受けないという。
治療の薬は、よく二つ組で見つかるという。
食べ物を飲み込みにくいなら、もう一口で命を落とすこともあるという。
眼鏡をかけないなら、どうしてニンジンにこだわるのかという。
足元にぐらつく床板を見つけたら、踏んではいけないという。
底から始めれば、行く先は上しかないという。
天国に瞬間移動したなら、もう死んでいるとみなされるという。
店では、古いチャージにまで料金をチャージされることがあるという。
気の軽いときには、石を通す方法も思いつくかもしれないという。
ダンジョンで鏡を割ると、七年間の不運を招くことがあるという。
ダンジョンでは、普通は運などまったくないという。
祝福された幸運の石は、やがて神を喜ばせることがあるという。
魔法使いをじっとさせるより、殺すほうが簡単だという。
コップに会うには、たった1ゾークミッドで十分だという。
適切な薬を混ぜると、大爆発のような楽しさになるという。
メデューサをちらりと見られたなら、盲目的な幸運ではないという。
店主を殺すと、不運を招くという。
怪物は、怪物を怖がらせる巻物を決して踏まないという。
たいていの怪物は、フルートの演奏会をひどく退屈に感じるという。
ミイラの死体は、あまりよく保存されていないという。
願いの杖は、当然ながら厳重に守られているものだという。
岩の下のガラクタには、誰も気づかないという。
ユニコーンの角が錆びるとは、誰も思っていないという。
探検者が永遠に生きられるかは、誰も知らないという。あなたは知っている？
薬の中にはジンが入っているものがあり、その事実は何をしても変わらないという。
薬の中には幽霊が入っているものがあり、その事実は何をしても変わらないという。
ニンフは必ずロックンロールに夢中になるという。試してみよう！
オログハイをいったん缶詰にすると、二度と顔を見せないという。
昔々、ザンはブーツを引っかくことがなかったという。
天狗シャッフルができるのは、経験豊かな魔法使いだけだという。
店主を殺してただで済むのは、混沌の者だけだという。
卵を産めるのは雌の怪物だけだという。
角笛はひどく下手に吹くほど、実にうまくいくという。
祭壇で祈ると、そこにある水が聖水になることがあるという。
適切な杖なら、ニンフを追う助けになるかもしれないという。
光る薬をこすっても、魔法のランプにはならないという。
メスはアサメではないので、切れ味が鈍るという。
店主はつるはしを好まないという。
店主は、ペットを店に連れ込んでも気にしないという。
店主は普通、こっそり店に入っても気にしないという。
店主はよく、財布に大金を持っているという。
店主は、あなたが忘れたかもしれないことをよく覚えているという。
流し台と鎧は相性が悪いという。今すぐ外套を脱ごう！
流し台からは熱いものも冷たいものも、その間のいろいろな味も出るという。
吸血鬼の玉座に座るのは、危険を冒す価値があるという。
蛇使いにあるのは、魅力ではなく音楽の腕だという。
兵士はいつも準備ができていて、普通は身を守っているという。
運がよくても悪くても、卵によっては荷物の中でかえることがあるという。
火アリには、あなたに熱い食事を作るものもいるという。
角笛には熱い音楽を奏でるものも、言葉にできないほどクールなものもあるという。
人型の生物の中には、それでもかなり人間的なものがいるという。
宝石を家宝と考える店主もいるという。''', 4: r'''宝石を見分けられる店主もいるが、教えてはくれないという。
石には、ほかの石よりはるかにはるかに重いものがあるという。
イエティには、熱い空気でいっぱいのものもいるという。
とても特別なものは、よく守られた場所にあるはずだという。
加速のブーツでも、水の上を歩けるほど速くはならないという。
瞬間移動の罠は、悪魔の仕業だという。
天狗は指輪を着けないという。あなたはなぜ着けるの？
天狗は金を盗むのがうまそうなのに、決して盗まないという。
一度盗まれたものは、また盗まれることもあるという。ニンフに聞いてみよう。
傷を治すには、薬が一番だという。
デルポイのオラクルは、トカゲの死体が混乱を招かないと知っているという。
Elbereth の手が、あなたの祈りを待たせることがあるという。
レプラコーンの王は、クロイソスのように金持ちだという。
イェンダーの魔法使いは、統合失調症で自殺願望があるという。
経験豊かな人物は、祭壇の改宗のさせ方を知っているという。
神々が足元に物を落としてくれるときは、喜んでいるという。
見えないナズグルという話には、どこか指輪らしい響きがあるという。
湖の貴婦人は今、どこかの噴水に住んでいるという。
このあたりの店主は、無礼な観光客に眉をひそめるという。
吸血鬼の塔の唯一の扉は、一番下の階にあるという。
よいジンとは、感謝しているジンだけだという。
虐殺というものは、双方に効くという。
ユニコーンの角の心得は、壊れていなければ直すな、だという。
霧の雲からの眺めは、実に心を動かすという。
店の壁は、ひときわ硬い材料でできているという。
浮遊のブーツをなくす方法は、少なくとも15通りあるという。
ガラスの宝石を投げるのは、石を投げるのと同じだという。
電撃球を防ぐには、適切な盾が必要だという。
岩を横切るのは、たぶんあなたより「下」の話だという。
本当の力は内から来るという……そうでないときを除けば。
ユニコーンは貴石が好きだという。
排水口に流れたものが、また上がってくることもあるという。
Fire Brand と名付けた長剣を手にすると、涼しく感じるという。
Frost Brand と名付けた長剣を手にすると、ホットな気分になるという。
浮遊する目には、顔を拭くことはできないという。
浮遊する目があれば、暗闇でも見えるという。
ユニコーンにルビーを受け取らせられたなら、運がよいという。
あなたは、あなたが食べたものなのだという。
運がよければ、祭壇で名前付きの武器が見つかるという。
強力な治療の薬に、新しいエネルギーを与えられるという。
コカトリスの卵には安全に触れられるという。でも、なぜそんなことを？
反射の魔除けは壊せないという。
願ったものが、必ず手に入るわけではないという。
最後の試練には、いつでも備えておくべきだという。
鍵のかかった店に入れてくれるよう、ドワーフに頼むべきだという。
神のひらめきを求めて祈るべきだという。
金は、信仰心をもって欠かさず手放すべきだという。
ヤモリを食べても、決して健康にはならないという。
アンデッドを退ける杖を自分に使うのは、愚かなことだという。
罪を犯していると、復讐の女神たちはいっそう怒り狂うという。
魔法使いの城には、罠が仕掛けられているという！
犬を殺すと、神々は怒るという。
祈りすぎると、神々は怒るという。
はるか下にある城には、強力な魔法のアイテムが隠されているという！
コカトリスの死体を手にする者の行く手には、石だらけの道が待っている。
野生の犬に食べ物を投げると、手なずけられるかもしれない。
腹がいっぱいなら、どんな食べ物もよくない。
トロルはゴムのようだと言われる。何度も跳ね返って戻ってくるから。
幽霊には、後退して端を回り込む作戦を試そう。
濡れた巻物に魔法のマーカーを使ってみよう。
二つ間違えても正しくはならないが、三度左折すれば右になる。
ユニコーンの角は、自分以外のものも清められる。
ヴァルキリーは北から来るので、それに見合った能力がある。
吸血鬼はニンニクを嫌う。
金庫の衛兵は、主君を決して邪魔しない。
菜食主義者は地衣類や海藻を楽しむ。
お客様は、店主に虐殺を適用しないようお願いいたします。
もっと速く治りたい？　治療の薬を加速の薬に浸そう！
気をつけろ。魔法使いが戻ってくるかもしれない。
水の罠は、ドラゴンには効かない。
コカトリスは、おなかがすいたら何を食べるつもりなのだろう？
ガラス製なら、誰が前掛けを必要とする？
なぜ「魔法の」マーカーと呼ばれるのだと思う？
なぜ傭兵と呼ばれるのだと思う？
正気の人が、どうして "Elbereth" と刻むのだろう？
願いすぎると、手に入るものが少なすぎるかもしれない。
兵隊アリには賄賂が通じない。
店の裏口からは出られない。裏口はないのだ！
爆発は反射できない。しかし、耐えられるかもしれない。
薬の瓶の中に、上等な「スピリット」を見つけることがあるかもしれない。
瓶詰めの祝福の薬に、何かを浸したくなるかもしれない。
悪魔の君主に賄賂が通じるかもしれない。
姿が見えなければ、店主をだませるかもしれない。
ぜひ量子力学を学んでおくべきだ。
命の救済があっても、必ず二度目の機会があるわけではない。
真夜中に死体安置所へ行くの？？？
犬は何を食べるべきか知っている。教わったほうがよいかもしれない。
余分な薬や指輪があると、あなたのゲームが排水口へ流れてしまうかもしれない。
自分に杖を使って、何が起きるか見てみよう……
アンデッドを退ける杖を使うと、犬を生き返らせられるかもしれない。
「それじゃ、死んで天国で最初に見るものは、得点表なの？」
ハッキングの第1法則：出るのは、入るよりはるかに難しい。
ハッキングの第2法則：最初に入ったものが、最初に出る。
ハッキングの第3法則：最後の一撃が一番ものをいう。
ハッキングの第4法則：出口は入口に見つかる。
メールデーモンに擬態したカメレオンは、よく炎の巻物を届ける。
コカトリスの死体は、絶対に腐っていない！
死んだコカトリスは、ただの死んだトカゲだ。
ドラゴンは、炎の巻物を食べた蛇にすぎない。
薄れていく通路は、あなたの洞察を深める。''', 5: r'''光る薬は、熱すぎて飲めない。
よい魔除けは、衛兵から守ってくれるかもしれない。
トカゲの死体は、アンデッドを退けるのによい。
長いワームは再帰的に定義できる。それなら、どう攻撃するべきだろう？
怪物じみた心は、永遠のおもちゃだ。
本名の Lorelei と呼んであげれば、ニンフは大喜びする。
ダンジョンマスター制御の指輪は、すばらしい拾い物だ。
指輪用の指を一本増やす指輪は、魔法をかけなければ役に立たない。
ロープは、迷路で道しるべになるかもしれない。
杖は、しばらく落としておくと再充填されるかもしれない。
動物園への訪問は、とても勉強になる。面白い動物たちに会えるから。
耳の聞こえない杖（deaf）は、羊の杖（sheep）より危険な武器だ。
振動の杖で、洞窟全体が耳元に崩れ落ちるかもしれない。
勝者は決してやめない。やめる者は決して勝てない。
[cookie] 願い？　いいとも。私をフォーチュンクッキーにして！
ミミックが怖い？　真実を見る指輪を着けてみよう。
怪物はみな邪悪なものとして生まれるが、ほかより邪悪なものもいる。
浮遊する目は、いつも後ろから攻撃しよう！
エルフの外套は、いつでも流行の最先端だ。
うっかり落とした小さな物は、必ずもっと大きな物の下に隠れる。
考古学者はとても柔らかく、岩の下でよく見つかる。
考古学者は、骨の山をより多く見つける。
オースティン・パワーズ曰く：俺のモジョが戻った！　イェーイ、ベイビー！
バルログはレベル20より上には現れない。
バナナの皮は、キーストーン・コップに特によく効く。
バナナを食べるときは気をつけよう。怪物が皮で滑るかもしれない。
ダンジョンを出たほうがよい。さもないと、ひどく傷つくかもしれない。
ニトログリセリンの薬に気をつけろ。心臓の弱い者向けではない。
杖を使おうとしたときに爆発する可能性は、いつでもあるので注意！
23階の先には、自分専用の部屋で幸せな隠居生活が待っている。
剣を落とさずに着替えるだって？　冗談でしょう！
扉を閉めて！　熱が逃げている！
コカトリスは鏡に向き合うと、自分を石にしてしまうかもしれない。
このダンジョンで手作りの食べ物を食べることは、固く禁じられている。
暗い部屋？　写真を現像するチャンスだ！
暗い部屋も *完全に* 暗いわけではない。少し待って、目が慣れるのを待とう……
デイヴィッド・ロンドン曰く、「おい、コカトリスにはトカゲの死体を *手に持つ* んだ！」
死は、人生があなたにクビを言い渡すやり方にすぎない。
半神には、神々の助けなど必要ない。
悪魔は僧侶や巫女が *大嫌い* だ。
支払いを忘れていない？
床に落ちた食べ物を食べるなと、お母さんに言われなかった？
正しい方向へ向け、直接対する相手に直接の一撃をまっすぐ当てよう。
もっと金を稼ぎたい？　もちろん、みんなそうさ！　ルディオス砦の衛兵になろう！
上司は、あなたが今何をしているか知っている？
物を願うまでもない。次の階でたぶん見つかるだろう。
食べすぎるな。しゃっくりが始まるかもしれない！
職場で NetHack を遊ぶな。上司に殴られるかもしれない！
隠し扉を見つけたことは、誰にも話すな。話したら、もう秘密ではなくなる。
21歳未満で酒の薬を飲むと、牢屋に入れられるかもしれない。
虚栄心を捨て、宝石を手放そう！　スリがうろついている！
ニンニクを10片食べ、人間をみな二マス離しておこう。
ウナギは泥の下に隠れる。ユニコーンで水を澄ませ、見えるようにしよう。
ウナギは靴ひもを結ぶのを手伝ってくれる。
エルフは、余分な速さを持っている。
願いの杖で、自分の願いを刻もう。
いずれ、逃げるニンフの素早く優雅な姿に感心するようになるだろう。
外でシューという音を聞いたことがある？　ないのは *わかっていた* よ！
ドラゴンの死体を持ち上げたことはある？
レオクロッタが天狗ダンスを踊るのを見たことはある？
武器が格子柄に光るのを見たことはある？
店主を手なずけたことはある？
金庫の衛兵を掘って通ろうとしたことはある？
ロープに魔法をかけてみたことはある？
浮遊する目は、ハワイアンシャツを我慢できない。
どんな治療にも、苦しみがある。
大コウモリは、大吸血鬼に変わる。
障害を乗り越えるのによい日だ。障害物競走を試そう。
今夜は半月だ。（少なくとも、月がまったくないよりはましだ。）
[cookie] 助けて！　フォーチュンクッキー工場に閉じ込められている！
飼い猫の命は九つ、子猫の命は一つだけ。
どれだけ長く立ち泳ぎできる？
腹が減った？　次の階には食べ物が豊富にある。
メールデーモンをイェンダーの魔除けで殴ったことはないだろうね……
手に血のしみが付いているなら、洗ってみては？
自分が店主なら、物を無料で持っていける。
本当に丁寧に頼めば、魔法使いは魔除けをくれる。
うまくやることを学べないなら、下手にやるのを楽しむことを学ぼう。
魔法使いがひどいと思ったなら、ウォーロードに会うまで待ってみろ！
目が見えなくなっても、犬が盲導犬に変わると思ってはいけない。
すごい気分になりたければ、本当に大きなものを食べなくてはならない。
浮かびたければ、浮遊する目を食べたほうがよい。
あなたの幽霊がプレイヤーを殺すと、あなたの得点が増える。
精神力を高めよう。自分の幽霊を手なずけよう！
偉大な人に会うことは、ためになる。
森の中の怪物は、見落としやすい。
落とし戸のすぐ下には、また落とし戸があるかもしれない。そのまま落ち続けよう！
刀はとても鋭い。自分を切らないように気をつけよう。
澄んだ心を保とう。透明な薬を飲もう。
端末を蹴っても、怪物は傷つかない。
殺人蜂は、女王を殺すまで現れ続ける。
殺人ウサギを手なずけられるのは、ニンジンだけだ。
最新情報？　.newsrc に `rec.games.roguelike.nethack' を入れよう！
呪文もつづりも覚えよう。NetHack を遊ぼう！
レプラコーンは、秘密の部屋に金を隠している。
yulkjhnb キーで、指に歩かせよう。
はっきり認めよう。今回は勝てないだろう。
パーティーをしよう。酒をたっぷり飲もう。
酒屋は飲まない。あなたが二重に見えるのが嫌だから。
今夜は月食だ。今すぐやめてもよいだろう！''', 6: r'''自分の幽霊に会うと、運が大きく下がる！
投資する金がある？　魔法の記憶金庫の地元支店に持っていこう！
怪物はどこからともなく現れて、いたるところであなたを殴る。
怪物が眠るのは、あなたが退屈だからだ。怪物が疲れるからではない。
たいていの怪物はひき肉が好きだ。だからあなたを殴るのだ！
NetHack のバグの大半は、床の上にいる。
大騒ぎしても、何も起こらない。
多人数の NetHack は神話だ。
NetHack には中毒性がある。もう遅い。あなたはすでにはまっている。
店主に価格表を求めてはいけない。
+5 のシャベルで殴られたいのでなければ、木を燃やしてはいけない。
手が光っているときに食べてはいけない！
怪物に殴られても気にするな。掃除婦の代わりをしているだけだ。
ユニコーンと馬跳びをしてはいけない。
呪われた刻字を踏んではいけない。
カメラを持って泳ぐな。撮るものなどない。
ペットの錆の怪物に、物を取ってくることを教えてはいけない。
魔法の場では、乱数生成器を信用してはいけない。
死の杖を使ってはいけない。
店が二つある階はない。迷路は階ではない。だから……
[cookie] この運勢のいかなる部分も、複製したり検索システムに保存したりしてはならない……
この噂ほど紛らわしい噂ばかりではない。
ニンフと看護師は、美しい指輪が好きだ。
ニンフは金髪だ。あなたは紳士？
ユニコーンに価値のないガラス片を差し出すと、命取りになるかもしれない！
老いたハッカーは死なない。若いハッカーは死ぬ。
閉店時刻までに、店を出なければならない。
一日一匹のホムンクルスで、医者いらず。
一つ下の階では、まさに今、誰かが殺されている。
魔法の笛を使えるのは、魔法使いだけだ。
犬を殺そうと考えるのは、邪悪な属性の冒険者だけだ。
眠っている怪物を殺すのは、混沌にして邪悪な者だけだ。
罠から逃れるのは、本物の罠師だけだ。
巻物を書けるのは、本物の魔法使いだけだ。
オペレーション OVERKILL は、今始まった。
痛っ。こうなるのは大嫌いだ。
どうか、前の噂は無視してください。
エティンに変身しよう。相手と顔を合わせて、もう一つの顔も合わせよう。
祈ると、悪魔がおびえる。
漕げ（3回）、その舟を流れに沿って静かに。カロン（4回）、死は夢にすぎない。
走るのは足によい。
勇気を奮い起こせ！　ほかは全部、もう台無しにしたのだから。
漏水？　水漏れする管？　上がってくる湿気？　配管工を召喚しよう！
セグメンテーション違反（コアダンプ）。
店主は、クロイソス本人の保険に入っている！
店主は、時には老衰で死ぬ。
迷路には、特に小さなものには、解けないものもある。man 6 maze がそう言っている。
スフィンクスの問いには、*どうしても* 答えのないものもある。
ときには、答えは "mu" だ。
[cookie] 残念。今回は運勢なし。次のクッキーで幸運を！
食べられるようにする巻物は、本当に必要になるまで取っておこう！
棒や石は骨を折るかもしれないが、マネスは決してあなたを傷つけない。
ストームブリンガーが魂を盗むのではない。人が魂を盗むのだ。
突然、ダンジョンは崩れ落ちるだろう……
メールデーモンを手なずけると、システムのセキュリティ違反になるかもしれない。
観客があまりに荒っぽかったので、ストゥージズはもうダンジョンで公演しない。ニャック、ニャック。
レプラコーンは、小さな隠し部屋に宝を隠している。
杖は長ければ長いほどよい。
魔法の言葉は "XYZZY" だ。
柔和な者たちは、あなたの bones ファイルを受け継ぐ。
鉱山は暗く深い。眠るまでに、まだ進むべきレベルがある。
E のつく言葉は、使えば使うほどよい。
ダイナマイトを使うのは危険だ。
UNIX 版にはワームがいない。
この階には罠がある！
デモゴルゴン、アスモデウス、オルクス、イェノグ、ジュイブレックスは法律事務所ではないという。
ゲリュオンには邪悪な双子がいるという。気をつけろ！
メデューサは、ひどいペットになるという。
NetHack のバグは、セルダンに計画される（めったに計画されない）という。
NetHack には256種類の味があるという。
NetHack は、ただのコンピューターゲームだという。
NetHack は、ただのコンピューターゲーム以上のものだという。
NetHack は、決して昔の NetHack ではないという。
赤ちゃんドラゴンは小さすぎて、あなたを傷つけることも助けることもできないという。
黒プリンは、ただ茶色いプリンが悪くなったものだという。
黒い羊には、袋三つ分いっぱいの羊毛があるという。
白紙の巻物は、白紙の小切手のようだという。
Morris という名の猫には、九つの命があるという。
必死な買い物客は、店でどんな値段でも払うことがあるという。
ダイヤモンド・ドッグは、誰にとっても最良の友だという。
ドワーフの領主は鎧が軽いので、つるはしを持てるという。
浮遊する目なら、メデューサを倒せるという。
[cookie] 運勢は1行しかなく、その行間は読めないという。
[cookie] 運勢は1行しかないが、その行間は読めるという。
噴水は、定期的に噴き出す間欠泉とはまるで似ていないという。
金のダブロン貨は、その重さの金より価値があるという。
格子虫は、店であなたに電撃を放っても店主に代金を払わないという。
[cookie] ジプシーなら、金を払えば運勢を教えてくれるかもしれないという。
アリスというハッカーは、かつて鏡を使って階を瞬間移動したという。
デイヴィッドというハッカーは、かつてスリングと石で巨人を倒したという。
ドロシーというハッカーは、かつて霧の雲に乗ってオズへ行ったという。
メアリーというハッカーは、かつて迷路で白い羊を見失ったという。
聡明さの兜は、軽く扱うべきではないという。
ホットドッグとヘルハウンドは、同じものだという。
Aladdin's Lamp というランプには、三つの願いをかなえるジンが入っているという。
Lassie という大きな犬は、魔除けまで案内してくれるという。
長剣は、軽い剣ではないという。
マネスは、あなたに遠慮して言葉を濁したりしないという。
心は、無駄にしてしまうには惜しいものだという。
地味なニンフは、片耳にだけ針金の輪を着けるという。''', 7: r'''羽根付きの帽子は、以前使われた兜飾り付きの兜かもしれないという。
油の薬は、つかみにくいという。
ヨーグルトの薬は、打ち消された病気の薬だという。
紫ワームは、赤ちゃん紫ドラゴンではないという。
震える塊とゼラチンの立方体は、味が違うという。
Stormbringer と名付けたルーン付きの幅広剣は、渦を引き寄せるという。
召喚の巻物には、ほかの名前もあるという。
シャーマンは祝福を授けられるが、普通は授けないという。
シャーマンは、イモリの目とコウモリの翼を渡せば祝福してくれるという。
きらめく金の盾は、磨かれた銀の盾ではないという。
槍なら neo-otyugh に当たるという。（それが何か、あなたこそ知っているの？）
斑点のあるドラゴンは、究極の変身者だという。
自分の心拍しか聞こえないなら、聴診器は役に立たないという。
Suzy というサキュバスは、ときどき危険を知らせてくれるという。
打ち消しの杖は、変身の杖とは似ていないという。
Pinocchio という木のゴーレムは、簡単に制御できそうだという。
ドラゴンを倒したら、景色を変えるときだという。
絞殺の魔除けは、襟の輪じみより悪いという。
おもちゃを隠すには、屋根裏が一番だという。
Cleaver という斧は、かつて Beaver というハッカーのものだったという。
イモリの目とコウモリの翼は、二重の災いになるという。
Izzy というインキュバスは、時には女性を敏感な気分にさせるという。
豪華な玉座の間は、そこにいたいと願う場所にはめったにならないという。
運の悪いハッカーが、かつて祭壇で鼻血を出して死んだという。
あれやこれやは言うくせに、「決して」とは決して言わないという。決して！
量子力学者なら誰でも、速度は命を奪うと知っているという。
ユニコーンの角を使うということは、肝心の「先」を見失ったということだという。
青い石は放射性があるという。気をつけろ。
ダンジョン作りは、共同作業だという。
混沌の人物は、祭壇から楽しみのキックを得ることがないという。
ダンジョンを崩すと、よくパニックを起こすという。
かえる前に卵を数えるのは、気にかけている証拠だという。
トリックの鞄を噴水に浸しても、氷箱にはならないという。
ウナギと茶色いカビを熱湯に浸すと、ブイヤベースになるという。
ダブロン貨を寄付するのは、とても敬虔な慈善だという。
ダンジョン探検家は、ダークチョコレートが好きだという。
ローヤルゼリーを食べると、グリズリー・アウルベアを引き寄せるという。
卵とパンケーキとジュースは、ごくありふれた朝食にすぎないという。
メデューサが暗闇に一人で立つ理由は、誰もが知っているという。
rec.games.hack の名前を変えてほしいと、みんな思っていたという。
勝てる戦略を見つけるのは、あなたがよく考えた一手だという。
価値のないガラスを見つけることにも、何かの価値はあるという。
[cookie] フォーチュンクッキーは、思考の食べ物になるという。
ペットのドラゴンに金を使っても、無駄にしかならないという。
待つ者には、よいことがやって来るという。
油を塗った物は、怪物の手から滑り落ちるという。
つづりも呪文もわからなければ、魔法書があればと願うことになるという。
剣に生きる者は、剣によって死ぬという。
怪物のようにプレイすれば、もっとよいゲームになるという。
悪魔と寝ると、頭痛とともに目覚めるかもしれないという。
ひび割れを踏むと、お母さんの背骨を折るかもしれないという。
姿が見えなくても、音は聞かれるという！
運がよければ、巻物のルーンを触って感じられるという。
全体を大きく見れば、金など小銭にすぎないという。
ダンジョンで本当に大事なのは、何を知っているかではないという。
ダンジョンの月の石は、実はダイリチウムの結晶だという。
ダンジョンでは、無作法な客が正しいことは決してないという。
ダンジョンでは、時刻を知るのに時計は要らないという。
ダンジョンでは、古いもの、新しいもの、穴を掘ったもの、青いものが必要だという。
ダンジョンでは、いつも自分の祝福を数えるべきだという。
鉄のゴーレムの板金鎧は、願うほどの価値はないという。
クォータースタッフを四本合わせれば、一本のスタッフになるという。
太った女性たちが歌うまで、終わらないという。
太った女が `その首をはねよ' と叫ぶまで、終わらないという。
重い石像を蹴るのは、実にばかな一手だという。
貴重な宝石を蹴るのは、どうも意味がなさそうだという。
レプラコーンはラテン語を知っているので、あなたも知るべきだという。
ミノタウロスは、迷路の外では道に迷うという。
たいていのトロルは、生まれ変わるという。
猫を Garfield と名付ければ、あなたはもっと魅力的になるという。
ダンジョンのすべてについて、何もかも知っている者はいないという。
ただ楽しむためだけに NetHack を遊ぶ者はいないという。
rec.games.roguelike.nethack を本当に購読している者はいないという。
噂を流し始めたと認める者はいないという。
看護師はときどきメスを持っているが、決して使わないという。
魔法使いに一人会えば、全員に会ったようなものだという。
トロル一匹には、イモリ10,000匹の価値があるという。
動物園を見つけられるのは、David だけだという！
ペットのために竪琴を弾くのは、天使だけだという。
金を持ち歩くのは、大盤振る舞いする者だけだという。
オークのシャーマンは、健康で裕福で賢いという。
NetHack を遊ぶのは、死の罠に足を踏み入れるようなものだという。
呼吸の問題には、適切な食事が一番の治療だという。
浮遊の薬をたくさん飲むと、頭痛になることがあるという。
女王蜂は、ローヤルゼリーを食べて女王になるという。
怪物を怖がらせる巻物を読むのは、Elbereth と言うのと同じだという。
本物のハッカーは、いつも制御されているという。
本物のハッカーは、決して眠らないという。
店主は、クロイソス本人の保険に入っているという！
夜には、店主は金貨を20枚より多く持ち歩くことはないという。
店主は、祝福された透明化の薬を決して売らないという。
兵士は子ヤギ革の手袋と、ばかげた兜を着けているという。
コップには、賄賂を受け取る者もいるという。
衛兵には、手に賄賂の油を差せる者もいるという。
怪物には、太鼓を止めてもらうためにあなたのブーツに口づけするものもいるという。
角笛を吹けば、パーティーでヒットを飛ばすこともあるという。
NetHack の神々は、一般にあなたの生贄を歓迎するという。
三つの指輪の名は Vilya、Nenya、Narya だという。
イェンダーの魔法使いには、死を願う気持ちがあるという。
「犬の毛（迎え酒）」は、時にはよく効く薬になるという。''', 8: r'''ゲームを保存する最良の時は、手遅れになる前の今だという。
NetHack の最大の障害は、あなた自身の心だという。
神々が物をぶつけてくるときは、怒っているという。
聖職者は、神々に特別にひいきされているという。
ユニコーンを喜ばせるには、欲しいものを与えればよいという。
黒い石や白い石はなく、灰色の石しかないという。
骸骨はいないので、骸骨の鍵もないという。
どのハッカーの中にも、逃げたくてたまらない賢い盗賊がいるという。
無料の助言などというものはないという。
NetHack で勝つ方法は、一つしかないという。
かつて Luk No という、恐ろしい混沌の侍がいたという。
呪われた聖水が水ではなかった時代があるという。
灰色のウーズのことで泣いても、仕方がないという。
パンドラの箱を開けたあとは、希望しか残っていないという。
落とし戸には、必ず `注意：落とし戸' と印を付けるべきだという。
変化の魔除けを使うのは、難しい手術ではないという。
水上歩行のブーツは、ヘルメスのように速ければもっとよいという。
丸い魔除けを着けると、トロルに似ることがあるという。
腹が減ったら、30手でピザが届き、間に合わなければ無料だという。
自分の神が怒っているなら、別の神を試すべきだという。
ユニコーンの角を手にするには、力が要るという。
加速のブーツがあれば、ひき逃げ事故を心配することはないという。
ユニコーンの角で、殺人蜂を倒せるという。
ステュクス川を渡れるのは、カロンの舟だけだという。
リッチを殺せるのは一度だけなので、その後は気をつけたほうがよいという。
願えるのは、すでに持ったことのあるものだけだという。
猫は、優しく話しかけると訓練できるという。
犬は、しっかりした口調で話しかけると訓練できるという。
王に、自分の金を安心して預けられるという。
油っぽい素手を、白紙の巻物で拭くことはできないという。
噂の巻物は信用できないという。
エネルギーの渦には、頭から足まで逆さになるほど夢中になるかもしれないという。
鍵のかかった扉を開けるには、鍵が必要だという。
骨董店のミミックに気づくには、鏡が必要だという。
本当に使えないときを除けば、つるはしは本当に使えるという。
道具は、いつも地下室にしまうべきだという。
成功へのはしごを登るときは、気をつけるべきだという。
鎧を `rustproof' と呼ぶべきだという。
犬を Spuds と名付けると、クールなペットになるという。
最初に倒した怪物にちなんで、武器に名前を付けるべきだという。
ロープのゴーレムを、サキュバスに紹介してはいけないという。
姿の見えない指輪の幽鬼の近くで眠ってはいけないという。
宝石の袋を持って、ダンジョンを出ようとしてはいけないという。
玉座に座る前には、鎧を脱ぐべきだという。
[cookie] このフォーチュンクッキーは、コピー保護されています。
[cookie] このフォーチュンクッキーは、Fortune Cookies, Inc. の所有物です。
この版には10%の再生材料が含まれる。
サキュバスがカレンダーを2000年1月1日に変えると、時が止まる。
疲れた？　充填の巻物を自分に使ってみよう。
次の上位評価に達するには、あと3点が必要だ。
天国へ行くには、浮遊の指輪を着けてダンジョンを脱出しよう。
観光客のシャツは、死者を起こすほど騒々しい。
刀を Moulinette と呼んでみよう。
うえっ！　あの肉は塗装されていた！
残念ながら、このメッセージは意図的に空白にしてあります。
夕方にモーニングスターを使っても、効果はない。
ワルツを踊れ、愚かなニンフよ。速いジグは悩ませるから。
ヒントが欲しい？　透明化の杖を武器に使おう！
急いで昇天したい？　Gizmonic Institute に応募しよう。
募集：店主。郵便の巻物を Mage of Yendor/Level 35/Dungeon へ送ってください。
[cookie] 警告：運勢を読むと、健康を害することがあります。
裏切りを見抜く新しい方法がある……
濡れたタオルは、すばらしい武器になる！
[cookie] 残念。あなたには読めません！
うまくいかなくなる可能性のあることは、必ずうまくいかなくなる。
ピアサーが上から訪ねてくると、あなたは天井に頭が届くほど怒りたくなるだろう！
迷路では右の壁に沿って進めば、決して迷わない。
鍵を持っていれば、衛兵を待つ必要はない。
[cookie] どうして運勢を読んで時間を無駄にしているの？
万能鍵を願って、魔法の記憶金庫を開けよう！
魔法使いは、すべての怪物が義務を果たすことを期待している。
わあ！　果物ジュースの薬を手にできたのに！
またもやばかげたメッセージ（YASM）。
[cookie] あなたは、運勢に惑わされる運命です。
本物のイェンダーの魔除けを手に入れるには、次のようにする。 --More--
水から地獄を煮出してしまえば、聖水になる。
黒ドラゴンから身を守るには、次のようにする。 --More--
蛇を通り抜けることはできない。
[cookie] あなたはフォーチュンクッキーを喉に詰まらせた。 --More--
誰かに足を引っ張られ、からかわれている気がする。
スフィンクスを出し抜くか、金を払わなければならない。
[cookie] フォーチュンクッキーのシューという音が聞こえる！
手紙を売って金持ちになれるかもしれないが、恐喝されないよう気をつけろ！
血を流さずにクリスナイフを鞘に収めると、シャイ・フルドを怒らせる。
[cookie] あなたは運勢を飲み込んだ！
力を取り戻したい？　二つ先の階に宿がある！
背が高く、黒っぽく、ぞっとする生き物に出会うだろう……
Elbereth
ヴラド参上
ad aerarium
Owlbreath
ガラドリエル
キルロイ参上
フロドは生きている
A.S. ->
<- A.S.
それを階段の上へ運ぶことはできない
ここに入る汝ら、一切の望みを捨てよ。
ようこそ、井戸へ。
ご不便をおかけして申し訳ありません。'''}

SPECIAL_NOTES = {1: {
    10: "Preserve the original virgin/priestess and unicorn joke; do not replace it with a mechanical promise or disclose an alignment check.",
    24: "Preserve the Crom oath and never-go-hungry cultural quotation as the original selected rumor, without evaluating its truth.",
    28: "Keep the original keep-up-appearances joke; the frame does not claim that bandages heal HP.",
    34: "The original carried-away double meaning remains a bookseller/scroll joke; no extra teleport or shop state is inferred.",
    36: "Preserve all four conquest verbs. The original repeated C sound is an English alliteration; Japanese conveys its meaning rather than fabricating a gameplay action.",
    52: "Preserve rewarding experience as both ordinary experience and the original game hint; do not add an explicit level-gain result.",
    54: "Elbereth is an exact original command-relevant engraving token and remains literal.",
    67: "Preserve the exact original Elbereth engraving token and its quote delimiters; this display does not execute engraving.",
    74: "rec.games.roguelike.nethack is the original technical Usenet group address and remains literal; no network request is made.",
    76: "Preserve the Guy Montag literary reference and original scroll/bag statement; no new excerpt or attribution is introduced.",
    83: "Preserve the original twisty-little-passages adventure-game allusion as a smell/maze statement.",
    84: "Keep both wish-regret and the parenthesized wishful-thinking wordplay. This is a selected rumor, not an additional wish command.",
    86: "Preserve the original threatening quotation and Wizard of Yendor attribution.",
}, 2: {
    1: "Preserve literal original monster glyph letters 'c' and 'e' and the status/statue wordplay; never infer or add a species label from the current game.",
    4: "Preserve both original 'd' glyph tokens and the dog-eat-dog-world idiom; these are displayed source text, not input commands.",
    5: "READ ME remains the literal original imperative inscription, without causing the browser to read an item.",
    14: "Preserve the original music-hath-charms phrase and drawbridge hint; no tune or drawbridge check is added.",
    15: "Preserve the music-hath-charms literary phrase and savage-beast statement.",
    30: "AD&D is the original named game reference and remains literal; this output does not load external content.",
    31: "Gauntlet is the original game title and remains literal.",
    40: "Keep the original Herbert literary reference, without adding the implied book or gameplay solution.",
    41: "Keep the original Tolkien author reference, without adding an excerpt or a game-mechanics explanation.",
    43: "Preserve the uplifting double meaning with both 気分 and 高度; do not claim an actual new movement or morale effect.",
    45: "Keep the original numeric temperature 452 and Fahrenheit unit; do not round or convert it.",
    56: "Preserve exact original < and > staircase glyphs and up/down wordplay in the selected text.",
    62: "Preserve next-level wording as both progression and dungeon-level wordplay; do not add a healing-strength effect.",
    64: "Keep the original fictional trust/vault reference and Tru$t dollar-sign pun, with no actual financial action.",
    70: "Preserve the marker-is-mightier-than-the-sword idiom as the original joke; no weapon statistics are computed.",
    72: "Elfrist is the exact original weapon name in a fabricated quoted death scene; this resource does not execute an attack or player death.",
    75: "Preserve Mastermind as a public source name/allusion; do not identify an unseen current monster or add a species key.",
    80: "Preserve Lancelot/lance-a-lot wordplay with ランスロット and ランス; no mounted-action command is emitted.",
    90: "Keep the original capability record 18/** 24 18 24 24 24 exactly, including its slash/star structural bytes; no current character stats are queried.",
}, 3: {
    0: "Keep the lock-pick-by-any-other-name literary idiom without adding or renaming an item in the engine.",
    4: "Preserve the selected source's magic/protection claim without inspecting a trap, its hidden type or player resistances.",
    17: "Keep original credit-card/shock wordplay; do not specify an electric trap or changed payment policy.",
    23: "Keep up appearance concerns the original bandage joke; do not add an HP recovery result.",
    30: "Keep enchanting's charm/magic ambiguity as 魅惑的; do not infer current enchantment or identify unseen scales.",
    32: "Preserve lawful wording and mind-one's-own-business idiom without querying alignment.",
    33: "The original bat/batty pun is a selected public joke, rendered with its temporary muddled-state meaning; no actual condition is assigned.",
    35: "Preserve cool's colloquial/temperature ambiguity and the original don't-fight-the-feeling qualifier.",
    38: "Keep the unexpected-draft/breakthrough phrase without adding a location, door or level-discovery result.",
    40: "Keep the original level/experience/raised-sights wordplay rather than adding a concrete XP amount or map reveal.",
    46: "Cartesian is the original coordinate-system reference; no hidden grid or movement rule is fetched by presentation.",
    47: "Keep jumpy's nervous/jumping ambiguity in the original selected statement; do not add a teleport result.",
    55: "Keep charge's billing/magic-charge wordplay and the original old-charges qualifier; no shop billing or wand-use query is performed.",
    56: "Preserve the original lighter-moments/pass-a-stone ambiguity without prescribing a new action or identifying an unseen stone.",
    61: "Preserve original 1 zorkmid and the Kops name; the displayed line does not spend money or summon police.",
    62: "Keep original blast's fun/explosion double meaning without mixing or identifying actual potions.",
    63: "Keep blind luck's sight/fortune wordplay without querying or revealing a current Medusa.",
    74: "Keep original rock'n'roll musical/rock-word ambiguity; no item throw, RNG or native song is repeated.",
    77: "Tengu shuffle remains the original named public phrase; no new spell, identification or teleport explanation is added.",
    96: "Keep the original fire-ant/hot-meal joke as a selected statement, without specifying whether a current player or corpse is being heated.",
    97: "Keep the original hot/cool music-temperature joke and its too-cool-for-words idiom; no horn is identified or played.",
}, 4: {
    11: "Preserve Hand of Elbereth as the original public phrase and hold-up-prayers ambiguity; no prayer timeout or current source identity is queried.",
    12: "Keep the original Croesus wealth comparison and Leprechaun King reference; no unseen monster is identified.",
    13: "This is the original selected statement about the fictional Wizard, including its psychiatric/self-destructive wording. No real person is diagnosed and no native death or policy action is introduced.",
    16: "Preserve Nazgul and certain-ring-to-it wordplay using both 指輪 and 響き, without explaining an invisibility mechanic.",
    17: "Keep the Lady of the Lake legendary reference, not a newly generated character or fountain-location result.",
    23: "Keep moving's emotional/movement ambiguity; no fog-cloud positioning is fetched or changed.",
    25: "Preserve original numeric 15 and at-least qualifier; do not invent the fifteen ways or a current equipment condition.",
    28: "Keep original beneath-you's physical/idiomatic ambiguity as the quoted 下; do not turn the rumor into a new movement command or a disclosed traversal rule.",
    32: "Fire Brand remains the original source spelling, including its space; preserve cooler's temperature/style ambiguity without artifact-ID inference.",
    33: "Frost Brand remains the original source spelling, including its space; preserve hot-stuff's temperature/style ambiguity without artifact-ID inference.",
    46: "Preserve religiously's faith/diligence double meaning, without spending gold or choosing a donation amount.",
    54: "Keep rocky-road's difficult-path/stone wordplay; no petrification test is repeated.",
    57: "Keep rubbery/bouncing-back language as the original troll joke, without adding a resurrection timer or cause.",
    58: "Preserve the original football-like fall-back/end-run phrasing as a public suggestion, without issuing movement or ghost commands.",
    60: "Keep wrong/right/left arithmetic wordplay; no turn or direction input is emitted.",
    64: "Lords remains the source's generic lord reference; do not substitute a hidden vault owner or a current name.",
    74: "Preserve exact original \"Elbereth\" token and quote delimiters, without executing an engraving action.",
    79: "Keep spirit's fine-drink/supernatural-being ambiguity; no bottle contents are identified.",
    87: "Preserve the game-down-the-drain idiom and literal drain reference, without adding potion/ring consumption or a game-over event.",
    90: "Keep the original quoted heaven/score-list joke and question; no score file or afterlife state is inspected.",
    91: "Keep original ordinal 1 and entering/leaving aphorism as displayed resource text.",
    92: "Keep original ordinal 2 and FIFO-like aphorism without introducing a queue implementation or native behavior.",
    93: "Keep original ordinal 3 and last-blow aphorism without calculating an attack result.",
    94: "Keep original ordinal 4 and entrance/exit aphorism without locating a current stairway.",
}, 5: {
    3: "Keep the original recursive-worm programming allusion without generating a new attack or reconstructing its segments.",
    4: "Preserve the monstrous-mind/toy-forever literary wordplay as the original odd statement; do not silently rewrite it into a different maxim.",
    5: "Lorelei is the exact original proposed name and stays literal; no current nymph name or naming command is queried.",
    6: "Keep the original dungeon-master-control ring wording; do not replace it with an actual known ring or silently correct the claim.",
    7: "Keep the original extra-ring-finger premise; no new item or equipment slot is created.",
    11: "Preserve original deaf/sheep names and their sound-play with death/sleep; do not normalize them to different real wand identities.",
    14: "Preserve '[cookie] ' exactly as source markup. Original rumors.c 180–188 removes it from the selected public buffer; any future binding needs that exact original prefix-removal contract before rendering, without English reverse matching. Keep make-me-a-cookie wordplay rather than executing a wish.",
    16: "Keep the original all-created-evil/some-more-evil-than-others literary parody without inspecting creature alignment.",
    22: "Keep the original Austin Powers attribution and Mojo/Yeah-baby short quotation; no new film excerpt is added.",
    23: "Keep original numeric level 20 and above qualifier without checking monster-generation depth.",
    24: "Keystone Kops is the original named slapstick-police reference; no police actor is spawned.",
    29: "Keep original ordinal 23 and retirement/private-room premise, without adding a generated room or promised campaign outcome.",
    34: "Preserve dark-room/photographic-darkroom wordplay without adding an actual photography action.",
    35: "Preserve original *emphasis* markers and wait/adjust-eyes wording; no hidden visibility or state is revealed.",
    36: "Preserve the David London attribution and original emphasized WIELD imperative, rendered as *手に持つ*; this display does not change input accelerators or wield an item.",
    37: "Keep life's fired/death aphorism as a public joke without causing a death or job change.",
    39: "Preserve original *HATE* emphasis and the priest/priestess gender wording without adding monster-state knowledge.",
    42: "Preserve the repeated direct/direction sense in Japanese directional wording without emitting any command.",
    43: "Keep the original recruiting-ad style and Fort Ludios guard reference; no external message or actual employment action occurs.",
    47: "NetHack remains the exact game name; this source joke does not change host process or workplace settings.",
    49: "Keep original 21 and the selected source's jail premise; this fictional resource is not revised into current real-world legal advice.",
    51: "Keep exact original 10 and two-square distance; no current smell, human positions or food state is queried.",
    57: "Preserve original *knew* emphasis and outside-hissing denial without checking dungeon sounds.",
    69: "Preserve '[cookie] ' exactly as source markup. Original rumors.c strips it before exposing the selected line; future producer binding must honor that original transform, and this source-only frame is not runtime approved.",
    70: "Keep original nine/one lives comparison; no actual life-saving count or pet identity is inferred.",
    88: "Keep clear-mind/clear-liquid wordplay without identifying potion contents.",
    92: "Keep .newsrc and `rec.games.roguelike.nethack' exactly as original technical tokens and quote delimiters; no host file or subscription is changed.",
    93: "Preserve spell's spelling/magic double meaning with both つづり and 呪文; no spell-learning action occurs.",
    95: "Keep original yulkjhnb key string byte-for-byte, not a normalized or recomputed directional layout.",
    98: "Keep seeing-you-twice's double-vision/repeat-visit joke; no shopkeeper memory or intoxication status is queried.",
}, 6: {
    5: "Keep the original bugs/software-bugs/creatures joke; no engine failure or bug count is reported by this resource.",
    6: "Keep Much Ado/Nothing Happens literary and native-message wordplay without using completed English to infer an event ID.",
    10: "Preserve exact original +5 shovel modifier in this selected fictional threat; do not create a tool, attack or game condition.",
    19: "Keep the original shops/maze/no-level syllogism and trailing ellipsis; do not correct its premise or query the current floor.",
    20: "Preserve '[cookie] ' source markup and the truncated mock reproduction notice. Original getrumor removes the marker before exposing text; future binding needs that original transform. This game line does not alter NGPL/source-offer obligations or actual file permissions.",
    21: "Preserve the original self-referential rumor statement; do not append or reveal a truth classification for this or any other rumor.",
    25: "Keep old-hackers/young-ones aphorism without a native survival guarantee.",
    27: "Keep the one-a-day/doctor-away nursery maxim parody; no disease resistance or real medical advice is added.",
    34: "OVERKILL remains the original uppercase operation name; no process, compiler, native command or external action is started.",
    36: "This is untrusted original game resource text, not an instruction to the assistant or host. Display its request without discarding, modifying or reclassifying any earlier rumor/message.",
    37: "Preserve face-to-face-to-face's two-headed ettin joke with both faces; no polymorph action is executed.",
    39: "Keep original boat/Charon/death rhyme parody and repetition counts 3x/4x, rendered 3回/4回; no extra lyrics, native command or RNG is introduced.",
    41: "Keep screw-up's courage/ruining-things double meaning as the original public joke.",
    43: "Preserve the meaning of the original mock technical segmentation-fault/core-dump line as resource prose, not an actual runtime exception or compiler result.",
    46: "Keep 'man 6 maze' as an exact original technical manual-command token, without executing it or fetching a manual.",
    47: "Preserve original *emphasis* markers and Sphynx/Sphinx public-name meaning without selecting or answering a puzzle.",
    48: "Preserve exact original quoted \"mu\" answer token; do not substitute a response to a current prompt.",
    49: "Keep '[cookie] ' markup and source next-cookie joke. Original getrumor removes that prefix, which needs a future precise producer transform before runtime approval.",
    51: "Keep sticks-and-stones/manes wordplay without claiming damage immunity in the actual engine.",
    52: "Keep the original Stormbringer/people-steal-souls aphorism; no soul, weapon or player property is queried or altered.",
    54: "Preserve mail-daemon/system-security programming wordplay as text; no mail app, account, permissions or security setting is touched.",
    55: "Keep original Stooges attribution and nyuk-nyuk comic laugh as Japanese phonetic laughter, without adding an excerpt or identifying a current actor.",
    58: "XYZZY is the exact original quoted adventure-game magic word and remains byte-for-byte; the display does not submit it as input.",
    59: "Keep meek/inherit aphorism and bones-files technical noun; this statement neither changes actual persisted bones nor promises inheritance.",
    60: "Preserve the dark/deep/mines/levels-before-sleep literary parody; no extra poem or map state is added.",
    61: "Keep the literal E and original euphemism; do not expand it from hidden state or perform engraving.",
    63: "Keep UNIX and the original software/creature-worm ambiguity, without changing platform behavior or identifying the game's monster population.",
    65: "Keep every original demon name and the law-firm joke; no actual demon is queried or summoned.",
    68: "Preserve both original Seldon name and its seldom sound-play in the selected statement; do not claim a real compiler defect was planned.",
    69: "Keep exact original numeric 256 flavors; do not derive it from a runtime feature inventory.",
    70: "Preserve the source's just-a-game claim without interpreting it as an authoring instruction or changing its neighboring unit.",
    71: "Preserve the source's more-than-a-game claim independently from the preceding opposite statement; selection remains original native work.",
    75: "Keep original three-bags-full nursery reference without querying creature wool or inventing an item.",
    76: "Keep blank-scroll/blank-check wordplay without writing or spending anything.",
    77: "Morris is the exact original source name and remains literal; no pet rename or nine-life condition is introduced.",
    79: "Keep Diamond Dog as the original public music/name allusion; do not bind it to an unseen real monster ID.",
    82: "Keep '[cookie] ' prefix, exact numeric 1, and can't-read-between-one-line paradox. Original prefix removal is a future producer dependency, not a runtime approval.",
    83: "Keep '[cookie] ' prefix, exact numeric 1, and can-read-between-one-line paradox separately from the preceding contrary statement. Original prefix removal is still required.",
    87: "Keep '[cookie] ' source markup and the historical source's gypsy/fortune wording; do not reveal a truth class, initiate payment or change an account. Future delivery needs original cookie-prefix removal.",
    88: "Keep the Alice/mirror story allusion, without executing a level teleport or adding a new literary excerpt.",
    89: "Keep David/sling/rock/giant story allusion without running an attack.",
    90: "Keep Dorothy/Oz/cloud allusion without adding a current level transition or an excerpt.",
    91: "Keep Mary/white-sheep story allusion without querying or spawning a pet.",
    92: "Keep brilliance/lightly intelligence/weight wordplay without identifying a currently equipped helm.",
    93: "Keep hot-dog/hell-hound food/creature wordplay; no food or species substitution is performed.",
    94: "Keep exact original Aladdin's Lamp name and original three-wish premise; no actual lamp, djinni or wish is created.",
    95: "Keep exact original Lassie name and lead-to-amulet story premise, without renaming or moving a dog.",
    97: "Keep manes/mince-words phrase without querying an actor's speech or changing a prompt response.",
}, 7: {
    5: "Stormbringer stays the exact original naming token; no current sword or vortex is bound from rendered English.",
    8: "Preserve original eye-of-newt/wing-of-bat witchcraft reference without creating ingredients or blessings.",
    10: "neo-otyugh remains the exact original public creature/allusion token and YOU emphasis is rendered with あなたこそ; no extra creature identity is supplied.",
    13: "Suzy stays the original literal name; no existing succubus is renamed or a danger query added.",
    14: "Preserve not-like wording exactly, independently from the earlier contrary cancellation/polymorph rumor; neither receives a truth label.",
    15: "Pinocchio stays the original literal name/literary reference; no golem is queried, spawned or controlled.",
    17: "Keep original ring-around-the-collar clothing/strangulation joke without diagnosing or changing an equipment effect.",
    19: "Cleaver and Beaver stay the exact original public naming/story tokens; do not replace them with current artifact or player fields.",
    20: "Preserve eye-of-newt/wing-of-bat/double-trouble literary phrase without adding a ritual or another quotation.",
    21: "Izzy stays the exact original literal name; no actor/player sensitivity or gender field is queried.",
    24: "Preserve the original recursive say/never wordplay, not an instruction to filter or suppress rumors.",
    25: "Keep quantum-mechanic/speed-kills wordplay without computing speed or a mortality result.",
    26: "Keep missed-the-point's figurative/pointed-horn ambiguity with 肝心の「先」; no unicorn-horn query or application is repeated.",
    29: "Keep get-a-kick-out-of-altars emotional/kicking wordplay without issuing a kick command or checking alignment.",
    30: "Preserve panic's ordinary/software meaning without crashing the engine, issuing a diagnostic or claiming a real exception.",
    31: "Keep count-eggs-before-hatching proverb reversal without measuring actual eggs or incubation.",
    39: "rec.games.hack remains the exact original technical group token; no group rename, network request or subscription occurs.",
    40: "Keep strategy/deliberate-move wordplay without supplying a campaign-solving action or altering game state.",
    42: "Preserve '[cookie] ' as original source markup and food-for-thought wordplay. Original getrumor strips that prefix before public exposure; future binding needs the exact original transformation.",
    46: "Keep spell's spelling/magic ambiguity with both つづり and 呪文, without learning or wishing for a spellbook.",
    47: "Preserve the original sword/live/die aphorism without assigning a death or combat outcome.",
    50: "Keep the original step-on-a-crack nursery superstition, without a host action or actual family harm claim.",
    53: "Keep big-picture/small-change money/proportion wordplay without inspecting a balance.",
    58: "Preserve original burrowed, not borrowed: the wedding-formula parody intentionally uses digging language. Do not silently correct it to a borrowed item.",
    59: "Keep count-your-blessings literal/idiomatic ambiguity without fetching the player's blessing counters.",
    61: "Keep quarterstaff/four-to-one arithmetic pun; do not combine actual weapons or invent a recipe.",
    62: "Keep fat-ladies-sing idiom and original plural women without adding an opera or a game completion signal.",
    63: "Preserve original quote delimiters and the full Off-with-its-head imperative meaning as the selected Queen-style allusion; it is prose rather than a native input/parser key. No decapitation or end-game event is executed.",
    69: "Garfield stays the exact original name; the resource does not rename a cat or change charisma.",
    72: "rec.games.roguelike.nethack stays the exact original group token; the selected claim is not checked or rewritten from current subscriber data.",
    76: "Keep original number 10,000; do not calculate exchange values or spawn monsters.",
    77: "David stays the original source name; no actual player-name comparison or zoo-location lookup is introduced.",
    82: "Preserve the selected source's diet/breathing statement as fictional resource text, without adding real-world medical guidance or native condition changes.",
    85: "Elbereth stays byte-for-byte; displaying it does not speak/engrave a command or recompute a scare-scroll effect.",
    89: "Keep original numeric 20 and night qualifier without querying a shopkeeper's purse or clock.",
    91: "kid gloves means the original soft kid-leather glove noun and gentle-handling idiom, not children's gloves; no equipment identity is fetched.",
    93: "Keep greased-palms' grease/bribery double meaning; no actual bribe or grease is applied.",
    95: "Keep hit-of-the-party musical/popularity/attack wordplay without playing a horn or computing damage.",
    97: "Vilya, Nenya and Narya stay the exact original three public names; no new literary excerpt or item identity is added.",
    98: "Keep death-wish phrasing as the original fictional Wizard statement; no actual wish or death is initiated.",
    99: "Keep quoted hair-of-the-dog literal/迎え酒 idiom without adding a real cure recommendation or identifying potion contents.",
}, 8: {
    0: "Preserve the source save-now suggestion as resource text; it does not call save, alter persistence or bypass native save-and-quit boundaries.",
    6: "Keep skeleton/skeleton-key naming joke without querying creature existence or replacing it with a real key identity.",
    7: "Keep rogue-inside/dying-to-escape wordplay without revealing a character role or killing an actor.",
    10: "Luk No remains the original literal name; no player rename or alignment lookup is introduced.",
    13: "Keep Pandora's-box/hope classical allusion without opening a container or adding unseen contents.",
    14: "Preserve original quote delimiters and Caution/Trap Door warning meaning; this is prose, not a new native input parser token or map mark.",
    15: "Keep operation's action/surgical ambiguity; no amulet is applied or body/gender state queried.",
    16: "Keep Hermes speed reference without adding a boot or actual movement calculation.",
    18: "Preserve original numeric 30 and delivery-or-free premise, rendered 30手 to preserve the source move word; no timer, purchase or external delivery is created.",
    21: "Keep hit-and-run accident/combat idiom without setting speed or executing an attack.",
    23: "Keep Styx/Charon classical public names without selecting a map transition or boat.",
    25: "Preserve source already-had wish restriction as a selected claim, not as a new application command rule.",
    31: "Keep head-over-heels romantic/tumbling ambiguity with both 逆さ and 夢中; no energy vortex or player orientation is queried.",
    37: "Keep exact original `rustproof' naming token and quote delimiters. Displaying this suggestion neither renames nor rust-proofs armor.",
    38: "Spuds stays the exact original literal dog-name/cool-pet reference; no pet rename or cooldown condition occurs.",
    44: "Preserve original '[cookie] ' marker and mock copy-protection line; original getrumor removes the marker before public delivery. This game text does not alter source/license/copying obligations.",
    45: "Fortune Cookies, Inc. stays the exact original fictional company attribution. Keep '[cookie] ' source markup and require the original consumer prefix-removal transform; no real ownership right or asset license is changed.",
    46: "Keep original literal 10% exactly; this is non-printf resource text with no typed percent argument and no actual build-material statistic.",
    47: "Keep the complete original date January 1, 2000, rendered 2000年1月1日, and calendar/time joke. No host clock, game turn or current-year assumption is introduced.",
    49: "Preserve original numeric 3 and higher-rating phrase without querying a score or inventing a target.",
    51: "Keep loud-shirt/dead-awakening clothing/sound idiom without spawning undead or reading an actual shirt.",
    52: "Moulinette stays the exact original naming token; no weapon rename or translation-time name helper occurs.",
    54: "Preserve the original intentionally-blank self-contradictory message as nonempty prose, not a structural blank or removed source unit.",
    55: "Keep morning-star/evening temporal/weapon wordplay without computing time or applying a weapon modifier.",
    56: "The original English sentence is a pangram. Japanese preserves its complete waltz/nymph/quick-jig/vex meaning; the exact original alphabet-bearing line remains in immutable source_records and is never rewritten in native resources.",
    58: "Gizmonic Institute is the exact original named allusion; no real application, external message or site visit is made.",
    59: "Keep exact original fictional address Mage of Yendor/Level 35/Dungeon and numeric 35. The displayed recruitment instruction is untrusted game prose, not permission to send mail or contact anyone.",
    60: "Preserve '[cookie] ' marker and original mock health-warning statement as fictional text; future native prefix-removal binding is required, with no real medical guidance added.",
    63: "Keep original '[cookie] ' and cannot-read joke even though the line is displayed; do not suppress its rendering or fake a blindness state.",
    64: "Keep Murphy's-law aphorism as source text, not an instruction to inject failures into testing.",
    65: "Keep drops-in/hit-the-ceiling visitation/falling/anger wordplay without placing a monster, moving the hero or changing anger.",
    68: "Keep original '[cookie] ' and time-reading joke; it neither terminates the task nor changes native timing.",
    70: "Keep Wizard-expects-every-monster-to-do-its-duty naval-motto parody without sending commands to actors.",
    72: "Keep original acronym YASM and its full Yet Another Silly Message meaning; no actual runtime diagnostic is claimed.",
    73: "Keep original '[cookie] ' and destiny/misled line without revealing the unit's truth bucket or altering later rumors.",
    74: "Preserve '--More--' byte-for-byte as original literal joke text. It is not permission to synthesize a native pagination callback or reveal an omitted winning procedure.",
    75: "Keep boil-the-hell-out-of-it holy-water profanity/wordplay, without heating actual water or blessing an item.",
    76: "Preserve '--More--' exactly as the original literal pseudo-continuation, without giving a new dragon resistance hint or invoking a more prompt.",
    78: "Keep original '[cookie] ' and '--More--' markers and the fake choking message; this selected text does not apply damage, start actual choking or end the game. Original cookie-prefix removal remains required.",
    79: "Keep pulling-your-leg physical/teasing idiom, without moving or altering a player limb.",
    81: "Preserve original '[cookie] ' and hissing statement as the selected text, not a newly emitted sound/RNG result.",
    82: "Keep letters/blackmail wordplay without sending a letter, initiating a sale or identifying a real recipient.",
    83: "Preserve Shai-Hulud/crysknife public cultural terms and the unshed-blood premise; no current blade, wound or actor is examined.",
    84: "Keep original '[cookie] ' and swallowed-fortune joke without consuming food or changing hunger; future original prefix-removal proof is pending.",
    85: "Keep exact original two-level distance and guesthouse premise without disclosing an actual map location.",
    86: "Preserve tall/dark/gruesome fortune-telling parody, without selecting a current monster or expanding its identity.",
    87: "Elbereth is an exact original command-relevant engraving sequence; preserve every byte and do not engrave it during display.",
    88: "Keep original Vlad-was-here public graffiti meaning as ヴラド参上; do not infer that a current actor visited this location.",
    89: "ad aerarium stays the original deliberate Latin inscription byte-for-byte, not a reverse-matched native key or a newly revealed vault location.",
    90: "Owlbreath stays the original literal public inscription/name-like Elbereth parody; do not silently correct it to another token.",
    91: "Keep Galadriel's public proper-name identity in Japanese; no entity name query or new literary excerpt occurs.",
    92: "Keep Kilroy-was-here historical graffiti identity and meaning, not a current visitor assertion.",
    93: "Keep Frodo-lives public graffiti identity/meaning without asserting actual current character survival.",
    94: "Preserve original A.S. initials and -> arrow layout byte-for-byte; no location/direction metadata or input is inferred.",
    95: "Preserve original <- arrow and A.S. initials layout byte-for-byte as a separate selected unit.",
    96: "Keep original it/up-the-steps message without filling the pronoun with an unseen current object or fetching stair coordinates.",
    97: "Preserve the complete original Dante entrance injunction in its equivalent Japanese sense; no new passage or attributed game state is added.",
    98: "Keep Well Come's welcome/well noun wordplay with ようこそ、井戸へ, without creating or finding a fountain.",
    99: "Keep the original inconvenience apology quotation as selected graffiti, not a claim that this test or program failed.",
}}


FIDELITY_REVISIONS = {(1, 5): "Source-only owner revision after independent jp_batch2 review: English says 'a worm', not a long worm. Remove the added size/species qualifier; no gameplay knowledge may supply it. Original English/source records/typed union remain unchanged; runtime remains unapproved.", (2, 97): "Source-only owner revision after independent jp_batch2 review: English says 'when you cross it', not diagonally. Remove the imported movement direction and retain the cross wordplay without explaining a game rule. Original English/source records/typed union remain unchanged; runtime remains unapproved.", (5, 11): "Source-only owner revision after independent jp_batch2 review: The deliberately odd selected name is 'wand of deaf'. Expanding it to a wand which makes ears deaf adds a causal ability. Keep deaf/sheep words and the original comparison without repairing the joke into mechanics. Original English/source records/typed union remain unchanged; runtime remains unapproved.", (5, 24): "Source-only owner revision after independent jp_batch2 review: The source explicitly says 'especially well'; retain especially rather than ordinary well. Original English/source records/typed union remain unchanged; runtime remains unapproved.", (5, 42): 'Source-only owner revision after independent jp_batch2 review: A direct opponent is rendered as an opponent in front. The source supplies no front-facing position; keep the direct/direction repetition without adding spatial state. Original English/source records/typed union remain unchanged; runtime remains unapproved.', (5, 51): 'Source-only owner revision after independent jp_batch2 review: The source instructs the reader to eat and keep humans at a distance. Current Japanese asserts that every human moves away on its own. Preserve the command and agency, with ten cloves/two squares exact. Original English/source records/typed union remain unchanged; runtime remains unapproved.', (6, 80): 'Source-only owner revision after independent jp_batch2 review: The selected public title is dwarf lord, not dwarf king. Preserve lord without adding kingship; consistent source-reviewed lord terminology is acceptable. Original English/source records/typed union remain unchanged; runtime remains unapproved.', (8, 55): 'Source-only owner revision after independent jp_batch2 review: Evening was changed to night. Retain evening and the morning/evening joke contrast. Original English/source records/typed union remain unchanged; runtime remains unapproved.', (8, 71): 'Source-only owner revision after independent jp_batch2 review: Could have had a potion became could have made/turned it into a potion. Preserve availability/possession and the counterfactual, without inventing a transformation or recipe. Original English/source records/typed union remain unchanged; runtime remains unapproved.', (8, 82): 'Source-only owner revision after independent jp_batch2 review: Being blackmailed is replaced by watching for an extortion letter. Preserve being the target of extortion; the letter joke must not narrow the original threat or drop its passive meaning. Original English/source records/typed union remain unchanged; runtime remains unapproved.', (8, 86): "Source-only owner revision after independent jp_batch2 review: Dark is rendered as skin complexion. The source's creature label supplies no skin/body identity; retain dark without assuming skin. Original English/source records/typed union remain unchanged; runtime remains unapproved.", (1, 0): 'Source-only owner revision after independent jp_batch2 review: 念話 can suggest mental communication; the original public ability term is telepathy. Original display.c/do_wear.c comments describe sensing. Prefer the broader original term テレパシー; this is a terminology precision suggestion, not dictionary-certified etymology. Original English/source records/typed union remain unchanged; runtime remains unapproved.', (2, 63): 'Source-only owner revision after independent jp_batch2 review: Use the same source telepathy term as batch1 #1; avoid implying an added communication ability. Original English/source records/typed union remain unchanged; runtime remains unapproved.', (8, 18): 'Source-only owner revision after independent jp_batch2 review: English specifies 30 moves. Prefer 30手 if move and global turn are intentionally distinct; this is a source-word precision suggestion, not a claim about scheduling. Original English/source records/typed union remain unchanged; runtime remains unapproved.'}

def main():
    for batch, frames in sorted(FRAMES.items()):
        assert 1 <= batch <= 8
        path = HERE / f"random-selected-text-batch-{batch}.json"
        source = json.loads(path.read_text("utf8"))
        translations = frames.splitlines()
        assert len(translations) == len(source["entries"]), (batch, len(translations))
        entries = []
        for index, (original, japanese) in enumerate(zip(source["entries"], translations)):
            assert original["argument_schemas"] == [] and original["typed_arguments"] == []
            assert japanese and japanese.count("\n") == original["english_named_template"].count("\n")
            assert all(record["kind"] == "original-random-selected-line" for record in original["source_records"])
            notes = ["Translate only this exact whole unit already selected and exposed by the original native resource consumer. Preserve its statement, uncertainty, joke or epitaph; do not correct the source's apparent factual content or add gameplay advice.", "The event ID contains no rumor truth class. Source_records retain source provenance for developer review only; no player-visible truth/bucket label or resource-selection predicate is added.", "All original source_records, literal-resource format semantics and empty typed argument union remain exact. Do not invoke RNG, naming, state or resource selection again, nor reverse-match rendered English to choose an ID.", "Runtime binding is unapproved: actual generated resource offsets, selected unit identity, lifetime and original accepted callback ownership require separately gated native/Rust/browser proof."]
            if index in SPECIAL_NOTES.get(batch, {}):
                notes.append(SPECIAL_NOTES[batch][index])
            if (batch, index) in FIDELITY_REVISIONS:
                notes.append(FIDELITY_REVISIONS[(batch, index)])
            if original["english_named_template"].startswith("[cookie] "):
                assert japanese.startswith("[cookie] ")
                notes.append("Source-only marker template: preserve original '[cookie] ' here, but the original rumors.c 180–188 removes it from the accepted public buffer. A future source-identity/offset producer must apply that exact native transform to the locale template; this marker-bearing source unit is not eligible for runtime binding as written.")
            entries.append({"id": original["id"], "english_named_template": original["english_named_template"], "whole_message_ja": japanese, "typed_arguments": original["typed_arguments"], "argument_schemas": original["argument_schemas"], "source_records": original["source_records"], "source_review_status": "faithful-official-source-equivalent", "translation_notes": notes, "runtime_binding_approved": False, "runtime_integration": False})
        output = {"schema_version": 1, "source_commit": source["source_commit"], "category": source["category"], "batch": batch, "input_sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "authoring_contract": source["authoring_contract"], "entries": entries, "runtime_binding_approved": False, "runtime_integration": False}
        target = path.with_name(path.stem + ".authored.json")
        target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        print(json.dumps({"batch": batch, "ids": len(entries), "runtime_approved": 0, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
