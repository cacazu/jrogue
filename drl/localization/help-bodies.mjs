/** Fully reviewed help-document paragraphs. External names/URLs stay verbatim.
 * This translates the pinned original help, including its historical guidance and
 * rights statements; it does not issue a new distribution permission. */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function helpSegments(source){
 const lines=source.split(/\r\n|\n|\r/);if(/(?:\r\n|\n|\r)$/.test(source))lines.pop();
 const result=[];let i=0;
 while(i<lines.length){
  const begin=i;
  if(!lines[i].trim()){while(i<lines.length&&!lines[i].trim())i++;result.push({kind:'blank',firstLine:begin,lines:lines.slice(begin,i)});continue;}
  if(lines[i].startsWith('{d---')){
   while(i<lines.length&&!lines[i].includes('{bThe Starting Screen}'))i++;
   if(i===lines.length)throw Error('Unterminated original help sample');i++;
  }else while(i<lines.length&&lines[i].trim())i++;
  result.push({kind:'text',firstLine:begin,lines:lines.slice(begin,i)});
 }
 return {lines,segments:result};
}
const translations={
 intro:[
  ['title','{r紹介}'],
  ['roguelike','{rDRL}（D, the Roguelike の略）は、その名のとおりローグライクゲームです。ローグライクが何かわからなければ、Wikipedia の {Bhttp://en.wikipedia.org/wiki/Roguelike} をご覧ください。'],
  ['premise','DRL は、1993 年の有名な地獄のような FPS に着想を得たゲームです。あなたは、フォボスの衛星基地からの救難信号を調査するために送られた海兵隊の、ただ一人の生存者です。その基地には、文字どおり地獄が解き放たれていました。'],
  ['mission','DRL での目的は、衛星基地の複合施設を降りていき、この邪悪な事件の原因を見つけ、何としてでも破壊することです。'],
  ['accessible-design','多くのローグライクと違い、DRL はシンプルで始めやすいゲームを目指しています。そのため、所持品の枠は少なく、マップは一画面に収まり、一つのマスに置けるアイテムは一つです。覚えるキーの数も、このジャンルの他の多くのゲームよりかなり少なくなっています。']
 ],
 start:[
  ['title','{r始め方}'],
  ['menu-introduction','初めて DRL を始めると、いくつかの選択肢のあるメニューが表示されます。'],
  ['menu-options','{Y新しいゲーム}では、もちろん新しいゲームを始めます！\n{Yチャレンジ}は最初は利用できません。伍長の階級に到達すると解放されます（そのためには 10 フロアを生き延びる必要があります）。チャレンジでは、近接武器しか使えないなど、決まった方法でのプレイを求められます。達成すると DRL のプレイヤー階級が上がります。階級が上がるほど、選べるチャレンジが増えます。\n{Yカスタムゲーム}では、モジュールを閲覧して読み込めます。モジュールはプレイヤーが作ったフロア、エピソード、あるいはまったく新しいゲームで、DRL エンジンに新たな体験を加えます。\n{Yハイスコア}では、その名のとおりスコア一覧を表示します。\n{Yプレイヤー情報}では、階級、倒した敵の数、勝利数などの統計を表示します。いくつかの画面があり、矢印キーで切り替えられます。\n{Yヘルプ}では、今読んでいる説明などを表示します。'],
  ['start-first-game','まず矢印キーで {Y新しいゲーム}を選び、ENTER を押して、初めての DRL を始めましょう！'],
  ['difficulty','始める前に、いくつか決めることがあります。最初は難易度です。初めは「死ぬには若すぎる（I\'m too young to die）」「手加減してくれ（Hey, Not Too Rough）」「たっぷり痛めつけてくれ（Hurt Me Plenty）」の三つだけが選べます。難易度が高いほど敵が増え、強い敵が早く現れます。「超暴力（Ultra-Violence）」と「悪夢！（Nightmare!）」はプレイヤー階級が上がると解放されます。悪夢！で生き残れるのは、とびきり無謀な DRL の戦士だけです！'],
  ['class','次にキャラクターのクラスを選びます。クラスごとに初期特典が異なり、一つの上級特性を基本特性として取得できます。また、それぞれ別のマスター特性があります。'],
  ['character-name','三つ目は、ゲーム中のあなたの名前です。それくらいは自分で決められますよね？ 空欄にすれば、伝説の戦士の名前がランダムに選ばれます。'],
  ['starting-trait','四つ目、そして最後は、最初の「特性」を選ぶことです。特性は、敵を倒してレベルが上がると得られる強化や特典です。最大体力を増やす、移動を速める、一発の威力を高めるなど、あなたをさらに強くします。一つの特性を複数回取得して強化できる場合もあります。'],
  ['advanced-master-traits','選べない特性もあります。「上級特性」は、先に基本特性を取得する必要があります。状況を選びますが、その分強力です。残りはマスター特性で、決まった組み合わせの特性が必要になり、一部の特性を取得できなくする代わりに、とても強力で独特な効果を得られます。最初から考えすぎず、気に入ったものを一つ選んで先に進みましょう。'],
  ['screen-introduction','これで準備は完了です！ 短い紹介のあと、次のような画面が現れます（ASCII 表示でプレイしている場合は ASCII マップが表示されます）。'],
  ['screen-example',null],
  ['first-floor','これはフォボスの衛星基地の最初のフロアです。フロア全体が、ちょうど一画面に収まります。矢印キーやテンキーで歩いて、操作に慣れましょう。くれぐれも死なないように！'],
  ['message-area','画面は三つの部分に分かれています。上部は二行の「メッセージ欄」です。よく注意して見てください。危険が迫っていることや、弾切れになったことを知らせてくれます。'],
  ['health-experience','下部は状態表示です。一番上の行には名前があり、その下には最も大切な数値、体力があります。これが 1% 未満になると死んでしまい、もう助かりません。右側には経験値の表示があります。最初の数値はキャラクターレベルで、高いほど強くなります。次の数値は経験値の割合です。各レベルへの到達には、決まった量の経験値が必要です。'],
  ['tactics','体力と経験値の下には「戦術」があります。初期状態は「慎重」で、利点も欠点もありません。X を一度押すと「疾走」に切り替わります（切り替えにはゲーム内の時間を使います）。疾走中は移動速度、回避率、防御が上がる代わりに、命中率と近接攻撃の威力が下がります。しばらく疾走するか、もう一度 X を押すと「疲労」状態になります。疲労にも利点や欠点はありませんが、再び疾走できなくなります。レベルアップ、ほとんどの回復手段、または次のフロアへ降りることで、慎重に戻れます。疾走にはこのような制限があるので、無駄に使わないようにしましょう。ただし、次のフロアへ持ち越して貯められるわけではありません。必要なときには使ってください。'],
  ['equipment-status','その右側には「防具」と「武器」があり、装備中のものを表示します。武器の丸括弧の数値は与えるダメージを示します。角括弧の二つの数値は装填済みの弾数と装弾数です。たとえば [4/6] は、6 発入る弾倉に 4 発入っていることを表します。'],
  ['map-symbols','状態表示とメッセージ欄の間にはマップがあります。カーソルのある「@」があなたです。近くに文字が見えたら、木かもしれませんが、たいていは敵です。倒してしまいましょう。「#」は壁、「+」は閉じたドア、「/」は開いたドアです。点は普通の床を表します。赤い点は、最初のフロアではフォボスの岩だらけの地面、それ以外では血です。'],
  ['inventory-equipment','「i」で所持品を開けます。最初はあまり入っていませんね。あなたは、頼れるピストル（装備済み）、いくらかの弾薬、そして医療パックを少し持っています。装備を確認するには「e」を押してください。ブーツと予備武器の枠を含む、装備の一覧が表示されます。'],
  ['pickup-consumables','ピストルと弾薬だけでは、長くは持ちません。「g」で、新しい武器（「}」）や弾薬（「|」）を拾いましょう。最初のフロアを歩けば、小型医療パック（赤い「+」）も見つかるはずです。拾うと所持品に入ります。後で見つかる別の消耗品も、すべて「+」で表示されます。「i」を押し、消耗品を選べば使えます。新しい武器やアイテムの場所を空けるなど、何かを落としたいときには、所持品画面で「Backspace」を押してください。'],
  ['levers-barrels','途中ではレバー（「&」）やドラム缶（「0」）も見つかります。レバーの上に立って「SPACE」を押すと操作できます。効果はランダムなので、危険は覚悟してください！ FPS を遊んだことがあれば、ドラム缶に何が起こるかはわかるでしょう。種類ごとに効果は違いますが、どれも派手に爆発します。レバーとアイテムを使う操作は同じボタンです。その場所で所持品のアイテムを使いたい場合は、所持品画面を開き、アイテムを選んで ENTER を押してください。'],
  ['powerups','基地の奥へ進むと、パワーアップ（「^」）も現れます。拾うとすぐに使われます。強力な効果を持つものもあるので、賢く使いましょう。'],
  ['fire-targeting','大事なことを忘れていました！ 「f」を押すと、現在の対象に射撃します。「TAB」で見えている対象を切り替えられます。「Ctrl」を押しながら矢印キーを使えば、照準を手動で動かせます。チェーンガンの連続射撃など、別の射撃モードを持つ武器もあります。「SHIFT-f」で使ってください。'],
  ['reload-melee','「弾がない！」ですか？ 慌てず「r」でリロードしましょう（「SHIFT-r」で別のリロードができる武器もあります）。必要な弾薬を持っていれば、自動で装填します。弾薬がないときには、拳や近接武器で敵を殴れます。敵のいるマスへ移動するだけです。バーサーク・パックやチェーンソー、せめてナイフを見つければ、近接攻撃でも大きなダメージを与えられます！'],
  ['dodging','敵に近づいたり逃げたりするときに、何度も撃たれますか？ 真っすぐ動かず、斜めに動いてみましょう。回避率が上がります。近づきも離れもしたくないなら、敵への方向と直角になるように横へ動いてください。斜め移動と同じ利点が得られます。危機的な状況では、疾走に切り替えてこの動き方を組み合わせると、普段よりずっと攻撃を避けやすくなります。'],
  ['prepared-weapon','「e」で開く装備画面には、主武器と予備武器があります。「z」で主武器と予備武器を交換できます。所持品から新たに装備するより速く、貴重な所持品の枠も節約できます。状況が一瞬で変わる撃ち合いでは、とても役立ちます！'],
  ['armor-durability','防具を見つけたから安心ですか？ そう簡単ではありません。防具には三つの数値があります。角括弧の二つは [現在の防御力／最大防御力] です。もう一つは防具の耐久度で、100% なら無傷、1% ならほぼ壊れています。傷むほど実際の防御力も下がります。よく確認してください！'],
  ['damage-resistance','さらに、それぞれの防具には、特定のダメージ属性への耐性がある場合があります。所持品画面や装備画面で確認できます。'],
  ['player-information','「p」でプレイヤー情報を見てみましょう。役立つ情報が載っています。まず、移動、射撃、リロードの速度や、装備中の武器を至近距離で使うときの命中率があります。次に、キャラクターとフロアのレベル、経過ターン数、現在のスコアなどの統計があります。下部には装備の性能があります。武器ならダメージ、射撃とリロードの速度、命中率です。防具とブーツなら防御力、耐久度、移動とノックバックへの補正です。防具やブーツは、移動速度や強い攻撃で吹き飛ばされる度合いにも影響します。'],
  ['item-types','ゲームには、五種類のアイテムがあります。'],
  ['common-items','1) {!通常} — ゲームのあちこちで見つかり、頼りになる基本のアイテムです。ほとんどはランダムに生成されますが、特別フロアの報酬など、決まった場所に必ずあるものもあります。通常の武器と防具に付けられる MOD の数は、Whizkid 特性のレベルに応じて、それぞれ 1/1、3/2、5/3 です。'],
  ['assemblies','2) {C組み立て品} — 普通のアイテムなどに、決まった組み合わせの MOD を付けて作ります。いろいろ試してください。一度組み立てたものはプレイヤーデータに記録され、ゲーム中に「A」で確認できます。'],
  ['exotic-items','3) {Vエキゾチック} — 通常より珍しく、強力なアイテムです。一回のゲームで複数現れることもありますが、特別フロアで見つかることが多いものです。武器と防具に付けられる MOD の数は、対応する通常品と同じです。'],
  ['unique-items','4) {Gユニーク} — 名前のとおり、一回のゲームで一つしか現れません。単に性能が高いものも、特別な能力を持つものもあり、すべて固有の名前を持っています。必ず手に入るものではありません。特別フロアに現れることもありますが、それ以外ではかなり珍しいものです。ほとんどは MOD を付けられず、付けられるものも技術兵クラスでプレイしている場合に限られます。'],
  ['artifacts','5) {Yアーティファクト} — ユニークに似ていますが、特定の特別フロアだけに現れ、ランダムには出現しません。見つけて集めるのは、ほとんどの場合、非常に難しい挑戦です。'],
  ['mod-packs','MOD（「\"」の記号）は、武器や防具を強化する小さなパックです。見つかる装備のほとんどに付けられるので、弱点を補うように改造してみましょう。'],
  ['look-help','知らないものを見たら「l」で観察モードを開いてください。矢印キーでカーソルを動かすと、その下にあるものがメッセージ欄に表示されます。ゲーム中に「h」を押せばヘルプも開けます。'],
  ['closing','楽しい戦いを！']
 ],
 keys:[
  ['title','{rキーボード操作}'],
  ['binding-notice','ほとんどのキー割り当ては、設定メニューで変更できます。以下は初期設定の操作です。自分で変更した割り当ては反映されません。'],
  ['navigation','  {!Escape}      -- メニューを閉じる／ゲームメニューを開く（セーブ、終了、ヘルプなど）\n  {!Arrows}      -- 移動（PgUp、PgDn、Home、End は斜め移動）\n  {!Arrows+Ctrl} -- 照準を手動で移動\n  {!TAB}         -- 対象を切り替える'],
  ['game-actions','  {!h}       -- ヘルプを開く\n  {!SPACE}   -- 行動：ドアの開閉、レバーやスイッチの操作、階段を降りる（戻れません！）\n  {!g}       -- 床のアイテムを拾う\n  {!SHIFT-g} -- 床のアイテムを使う／装備する、レバーやスイッチを操作\n  {!f}       -- 装備中の武器で射撃\n  {!SHIFT-f} -- 別モードで射撃（対応する武器のみ）\n  {!r}       -- 装備中の武器をリロード\n  {!SHIFT-r} -- 二丁持ちの両方をリロード／特殊リロード（対応する武器のみ）\n  {!m}       -- 対象の敵の詳しい情報\n  {!SHIFT-m} -- 自分の詳しい情報\n  {!z}       -- 予備武器と交換\n  {!w}       -- 待機\n  {!i}       -- 所持品を表示\n  {!e}       -- 装備の表示と変更／特性の表示\n  {!l}       -- 観察モードを切り替える（{!Escape} で終了）\n  {!u}       -- 所持品または床の武器から弾を抜く\n  {!p}       -- キャラクター情報（本人と装備の性能）\n  {!y}       -- キャラクターの特性\n  {!a}       -- 判明済みの組み立て品\n  {!s}       -- 過去のメッセージ\n  {!,}（カンマ）-- 連続移動（{!SHIFT} と方向キー、または {!SHIFT}-w でも可能）\n  {!x}       -- 戦術を切り替える\n  {!1}..{!9} -- 武器のクイックキー。所持品画面で割り当て'],
  ['inventory-title','{r所持品画面}'],
  ['inventory-default','アイテムを選んで Enter を押すと、そのアイテムの標準の操作を行います。身に着けるアイテムなら、現在の装備と交換します。'],
  ['inventory-keys','  {!Backspace} -- 選んだアイテムを落とす\n  {!1}..{!9}     -- すぐに使う／装備するクイックキーを割り当てる'],
  ['equipment-title','{r装備画面}'],
  ['equipment-default','装備中のアイテムを選ぶと外します。空いている枠を選ぶと、装備するアイテムを選べます。ただし、所持品画面から交換するほうが速くなります。'],
  ['equipment-keys','  {!Backspace} -- 選んだアイテムを落とす\n  {!Tab}       -- 所持品のアイテムと交換'],
  ['legacy-target-title','{r手動照準（旧来の設定）}'],
  ['legacy-target-keys','  {!t}       -- 装備中の武器で手動照準\n  {!SHIFT-r} -- 装備中の武器で別モードの手動照準（対応する武器のみ）'],
  ['target-title','{r手動照準中のキー}'],
  ['target-keys','  {!Arrows}      -- 照準の線を動かす\n  {!TAB}         -- 対象を切り替える\n  {!m}           -- 詳しい情報\n  {!f},{!SPACE},{!LMB} -- 射撃\n  {!RMB},{!Escape}  -- キャンセル']
 ],
 mouse:[
  ['title','{rマウス操作}'],
  ['button-definitions','LMB、MMB、RMB は、それぞれマウスの左、中央、右ボタンです。'],
  ['left-button','  {!LMB}             -- 指定した場所へ移動。隣のドアなら開き、隣の敵なら近接攻撃。移動先は探索済みのマスである必要があります。敵が見えていなければ自動で移動を続け、見えていれば一歩だけ移動します。\n  {!LMB} を {!自分}に -- 階段なら降りる、レバーなら操作、アイテムなら拾う。それ以外は所持品を開きます。\n  {!Alt-LMB} を {!自分}に -- 所持品を開く'],
  ['right-button','  {!RMB}             -- 対象のマスや敵に射撃。弾倉が空ならリロード。\n  {!RMB} を {!自分}に -- リロード'],
  ['middle-button','  {!MMB}             -- 押し続けて表示範囲を動かす\n  {!MMB} を {!自分}に -- 武器を交換'],
  ['wheel','  {!SCROLLWHEEL}     -- 武器を変更（武器のクイック選択を開く）']
 ],
 gamepad:[
  ['title','{rコントローラー}'],
  ['movement','{!左スティック}で方向を指定し、{!{$controller_gameplay_move}} ボタンで移動を確定します。'],
  ['actions-title','{r基本の行動}'],
  ['alternate-modifier','{!{$controller_gameplay_modifier_alt}} を押し続けると、以下の別の行動を使えます。また、対象のマスにヒントが表示されます。'],
  ['actions','{!{$controller_gameplay_move|5}} - 移動\n   （{!{$controller_gameplay_modifier_alt}} を押しながら）照準を移動\n{!{$controller_gameplay_action|5}} - アイテムを拾う／階段やレバーを使う\n   （{!{$controller_gameplay_modifier_alt}} を押しながら）床のアイテムを使う\n   （{!LStick} の方向を指定）行動（ドアの開閉）\n{!{$controller_gameplay_fire|5}} - 射撃\n   （{!{$controller_gameplay_modifier_alt}} を押しながら）別モードで射撃（対応時）\n{!{$controller_gameplay_reload|5}} - リロード\n   （{!{$controller_gameplay_modifier_alt}} を押しながら）別モード／二丁持ちをリロード（対応時）\n{!{$controller_gameplay_player|5}} - 所持品を開く（{!Left}／{!Right} またはショルダーボタンで画面を切り替え）。{!{$controller_gameplay_modifier_alt}} を押しながらなら装備画面を開く\n{!{$controller_gameplay_menu|5}} - ゲームメニュー\n{!{$controller_gameplay_target_prev|5}} - 前の対象\n{!{$controller_gameplay_target_next|5}} - 次の対象\n{!{$controller_gameplay_active|5}} - 押してクラスの発動型スキル（{!アドレナリン}など）を使う\n{!{$controller_gameplay_swap|5}} - 押して予備武器と交換\n   （{!{$controller_gameplay_modifier_alt}} を押しながら）床や所持品の武器から弾を抜く\n{!{$controller_gameplay_up},{$controller_gameplay_down},{$controller_gameplay_left},{$controller_gameplay_right}} - 照準を移動（将来削除される可能性があります）\n{!{$controller_gameplay_modifier_run|5}} -- 押し続けるとクイックスロットを表示\n   {!{$controller_gameplay_up},{$controller_gameplay_down},{$controller_gameplay_left},{$controller_gameplay_right}} の方向を指定して使う\n{!{$controller_gameplay_modifier_alt}+{$controller_gameplay_move}} -- 対象の敵の詳しい情報（対象がなければ自分の情報）。\n   {!{$controller_gameplay_modifier_run}+{$controller_gameplay_modifier_alt}} を押し続けると、必ず自分の情報を表示'],
  ['ui-title','{r画面操作}'],
  ['ui-controls','{!A} で決定、{!B} でキャンセル、{!D-Pad} で選択します。{!RShoulder} と {!LShoulder} でも画面を切り替えられます。'],
  ['equipment-title','{r所持品／装備}'],
  ['equipment-controls','{!RShoulder}／{!LShoulder} - 画面を切り替える\n{!Y} - 落とす（{!RTrigger} と一緒なら、武器から弾を抜いてから落とす）\n{!X} - 装備中のアイテムを交換\n{!LTrigger+DPad} - 方向にクイックスロットを割り当てる'],
  ['continuous-movement-title','{r連続した移動}'],
  ['continuous-movement','一度移動したあと、{!{$controller_gameplay_move}} ボタンを押し続け、{!左スティック}で方向を変えると、連続して移動できます。敵が見えていない場合に使え、敵が現れると自動で止まります。溶岩や酸などの危険な地形へも、自動では踏み込みません。']
 ],
 feedback:[
  ['title','{r意見と不具合報告}'],
  ['email','ご意見をお待ちしています！ admin@chaosforge.org にメールしてください。気に入ったこと、気に入らなかったこと、不具合の報告をお寄せください。{rDRL} の公式サイトはこちらです。'],
  ['website',null],['forum-description','DRL のフォーラムはこちらです。'],['forum',null],['discord-description','Jupiter Hell の Discord サーバーには、DRL 専用チャンネルがあります。'],['discord',null],['social-description','ChaosForge と作者の公式 X アカウントもあります。'],['social',null],['wiki-description','攻略、情報、ネタバレの主な情報源は DRL Wiki です。'],['wiki',null],['tutorials-description','Game Hunter の YouTube チャンネルには、すばらしい DRL の解説動画がたくさんあります。'],['tutorials',null],['release-news','新バージョンの告知は、公式サイト、X、Discord に掲載されます。'],['other-games-description','ChaosForge のサイトもご覧ください。作者のほかのローグライクゲームを試せます。'],['other-games',null],['classic-description','DRL には、Jupiter Hell の世界を舞台にした商用版があります。購入すると、無料版と商用版の両方の開発を支援できます。'],['classic',null],['successor-description','Jupiter Hell は、DRL の精神的な後継作です。'],['successor',null]
 ],
 disclaim:[
  ['title','{r免責事項}'],
  ['redistribution','このゲームはフリーウェアですが、いくつかの制限があります。雑誌付録 CD や他の Web サイトなどでの再配布は、作者（admin@chaosforge.org）に知らせることを条件として許可されています。紙の雑誌に収録する場合は、見本誌を一部送っていただければ幸いです。'],
  ['warranty','いかなる種類の保証もありません。本ソフトウェアによって生じたいかなる損害についても、作者は責任を負いません。自己の責任で使用してください。']
 ],
 credits:[
  ['title','{rクレジット}'],
  ['ilya-bely','この作品では、Ilya Bely に感謝します。意見、アイデア、そして熱意のおかげで、始めたものを本当に完成させ、なんと公開までできました。'],
  ['graphics','グラフィック版のタイルと画像を制作してくださった Derek Yu に、心より感謝します。追加のタイルセット、小物、アニメーションなど、大量の追加画像を制作してくださった Lukasz Sliwinski にも感謝します。'],
  ['beta-testers','最初のベータテスター、Joseph Hewitt、Igor Savin、Timo Viitanen、ABCGi、David Damerell、Andrzej Kosnikowski に感謝します。'],
  ['coding','特に AI と不具合修正など、コードの作成を直接手伝ってくださった tehtmi と Game Hunter に、特別の感謝を。'],
  ['music-tutorials','DRL の特別フロアの楽曲を制作した Simon Volpert と、YouTube で DRL の解説を公開した Game Hunter に、心より感謝します。'],
  ['sonic-clang-permission','グラフィック版で使われている、原作 D の音楽の高音質リミックスは、Sonic Clang（ http://sonicclang.ringdev.com/ ）のご厚意により、許可を得て使用しています。'],
  ['per-kristian-permission','グラフィック版で使われている、原作 D の効果音の高音質再現は、Per Kristian Risvik（ http://www.perkristian.net ）のご厚意により、許可を得て使用しています。'],
  ['id-software','元の MIDI 楽曲と効果音は、もちろん Id Software によるものです。'],
  ['forum-regulars','DRL フォーラムの常連の皆さんに、特別の感謝を。とりわけ Aki、Anticheese、Dervis、Derek Yu、jake250、Malek、Santiago Zapata、Thomas、Jorge Alonso、tehtmi、Game Hunter、UnderAPaleGreySky、Jered Cain、Turgor から、貴重なアイデアをいただきました。もちろん、この方々だけではありません。'],
  ['irc','#chaosforge IRC チャンネルの閲覧者と常連の皆さんにも、心より感謝します。'],
  ['trait-descriptions','特性の説明を書いてくださった Malek と Derek Yu に感謝します。'],
  ['marketing','マーケティングと広報を手伝ってくださった MaiZure にも、心より感謝します。'],
  ['gargulec','最後に Gargulec に大きな感謝を。広報、プレスリリース、アイデア、励まし、そしてさまざまなすばらしい働きをありがとうございます。'],
  ['original-game','そして、原作 D を生み出した会社に、もちろん大きな感謝を。公開から 30 年以上が過ぎた今も、このように多くの楽しみを与えてくれています。'],
  ['top-donors-description','寄付によって ChaosForge を支えてくださっている、上位 15 名の方々です。'],
  ['top-donors',null],
  ['donor-ties','同じ番号は同順位を表します。'],
  ['all-donors',null],
  ['community','{Brec.games.roguelike.development} の皆さんにも、長年の交流と、このゲームを温かく迎えてくださったことに感謝します。']
 ]
};
export function buildHelpCatalog(sourceRoot){
 const entries=[],documents=[];
 for(const [topic,rows]of Object.entries(translations)){
  const file=`bin/data/drl/help/${topic}.hlp`,bytes=readFileSync(path.join(sourceRoot,file)),source=bytes.toString('utf8'),parsed=helpSegments(source),text=parsed.segments.filter(s=>s.kind==='text');
  if(text.length!==rows.length)throw Error(`Help paragraph review mismatch ${topic}: ${text.length} vs ${rows.length}`);
  const segments=[];let reviewed=0;
  for(const segment of parsed.segments){
   if(segment.kind==='blank'){segments.push(segment);continue;}
   const [suffix,translation]=rows[reviewed++],id=`help.body.${topic}.${suffix}`,english=segment.lines.join('\n');let japanese=translation??english;
   if(topic==='start'&&suffix==='screen-example')japanese=english.replace('Welcome to DRL...','DRL へようこそ…').replace('Armor : ','防具：  ').replace('none','なし').replace('Health:','体力： ').replace(' Exp:',' 経験値：').replace('Weapon: ','武器：  ').replace('pistol','ピストル').replace('cautious','慎重    ').replace('Phobos Base Entry','フォボス基地入口').replace('The Starting Screen','最初の画面');
   if(topic==='credits'&&suffix==='all-donors')japanese=english.replace('The alphabetically sorted list of great people that have donated :','寄付してくださった皆さんの一覧です（アルファベット順）。');
   entries.push({id,en:english,ja:japanese,topic,sourceFile:file,firstLine:segment.firstLine+1,lineCount:segment.lines.length,identity:english===japanese,role:english===japanese?'external-links-or-usernames':'help-paragraph'});
   segments.push({...segment,id});
  }
  documents.push({topic,file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,lines:parsed.lines,segments});
 }
 return {schema:1,sourceCommit:'a6f965072b3a25b768c91dbced00367f1b57d865',allEightOriginalHelpBodiesReviewed:true,rightsStatements:'Translated as pinned upstream historical text; no new redistribution rights or bundled audio grant',entries,documents};
}
