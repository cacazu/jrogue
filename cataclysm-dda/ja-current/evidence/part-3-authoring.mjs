import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { checkText, printfSignature } = require('../../ja-completion/checks.cjs');
const taskRoot = path.resolve(import.meta.dirname, '../..');
const chunkPath = path.join(taskRoot, 'catalog-reconcile/output/current-source-gaps-3.json');
const chunkBytes = fs.readFileSync(chunkPath);
const chunk = JSON.parse(chunkBytes.toString('utf8').replace(/^\uFEFF/, ''));
const rows = [];
const add = (index, semanticSuffix, translation) => rows.push({ index, semanticId: 'cdda.' + semanticSuffix, translation });
const mod = 'mod.aftershock_exoplanet.';
const datum = (index, suffix, text) => add(index, mod + suffix, text);
const exoIntro = '外骨格スーツの操縦者が着用する、身体にぴったり沿うウェアです。外骨格スーツの操作に必須ではありませんが、触覚フィードバックシステムによって操作性と快適性を向上させます。';
const armorOnly = '防具の外での使用は想定されていません。';
const passiveTemperature = '\n\n温度制御ユニットは、稼働中のフレームまたは独立したバッテリーポートから電力を供給できます。';
const activeTemperature = '\n\n温度制御ユニットは稼働中で、独立したバッテリーポートから電力を供給しています。';

datum(360, 'achievement.afs_achievement_ruins.requirement.visit_ruin', '遺跡を訪れる');
datum(361, 'achievement.afs_achievement_many_ruins.name', 'オリオンの遺跡');
datum(362, 'achievement.afs_achievement_many_ruins.description', 'それが実際には何を意味するのか、考えないようにしている。みんなそうさ。そうしなきゃ、悲しみで気が狂っちまう。[笑い] それでも狂っちまう奴はいるけどな。\n<color_c_dark_gray>  - 「テネラス辺境での生活」、サルベージ業者ギルドの職人へのインタビュー、2514年頃。');
datum(363, 'achievement.afs_achievement_many_ruins.requirement.visit_many_ruins', '多くの遺跡を訪れる。');
datum(364, 'achievement.afs_achievement_discontinous.name', '断絶');
datum(365, 'achievement.afs_achievement_discontinous.description', '[ エラー: ハイパーネットの圏外です ]');
datum(366, 'achievement.afs_achievement_discontinous.requirement.survive_single_attack', '一度の攻撃で2500ダメージを受け、生き延びる(任意)。');
datum(367, 'achievement.afs_achievement_chimera.description', '生体改造の後、まれに原因不明の本能的な衝動が現れることがあります。そのような場合は、以下の方法で心を落ち着けることをお勧めします…\n<color_c_dark_gray>  - アフターケアのパンフレット、マーキュリアル・ジェノミクス社。');
datum(368, 'achievement.afs_achievement_chimera.requirement.cross_threshold', 'ジーンテックテンプレートを使って変異の閾値を超える。');
datum(369, 'achievement.achievement_psion.name', '新たな太陽');
datum(370, 'achievement.achievement_psion.description', '仲間の中には、すべて夢なのではないかと問う者もいた。これまで聞いたことも、見たことも、想像したことすらないものを垣間見た経験を、他にどう説明できようか。\n<color_c_dark_gray>  - ESSファイアバードの航海日誌から回収された記録。');
datum(371, 'achievement.achievement_psion.requirement.gain_psionic_powers', '超能力を得る。');
datum(372, 'event_statistic.num_avatar_enters_crashed_ship.description', '墜落した宇宙船を訪れた');
datum(373, 'event_statistic.num_avatar_enters_ruins.description', '遺跡を訪れた');
datum(374, 'event_statistic.avatar_max_damage.description', '一瞬で受けたダメージの最大値。');
datum(375, 'item.afs_titanium_vest.description', 'チタンの小片を縫い合わせ、着心地を良くするため布の詰め物を入れた軽量の防護ベストです。実戦ではそれほど有効ではありません。');
datum(376, 'item.afs_augustmoon_kit_box.name', 'サバイバルキット');
datum(377, 'item.afs_augustmoon_kit_box.description', '宇宙船の脱出ポッドに積まれていたものを転用したと分かる、サバイバルキットの箱です。惑星上で生き延びるための様々な物資が入っています。');
datum(378, 'item.gold_small.description', '柔らかく光沢のある金属です。人類のほぼすべての文化圏で価値を持ち、非常時の通貨として宇宙船に積まれていることもよくあります。');
datum(379, 'item.nanomaterial.description', '原子単位で特別に設計された構造の炭素、鉄、チタン、銅などの元素が入った、鋼鉄製のキャニスターです。現代の工業生産で広く使われる原料であり、ナノ加工装置で実用品へと組み立てられます。');
datum(380, 'item.afs_ruined_laser_pistol.name', '朽ちたエネルギーピストル');
datum(381, 'item.afs_ruined_laser_pistol.description', '腐食した金属とプラスチックの塊です。大まかな形状からかろうじてピストルだと分かります。一部の部品はまだ回収して使えるかもしれません。');
datum(382, 'item.afs_ruined_laser_rifle.name', '朽ちたエネルギーライフル');
datum(383, 'item.afs_ruined_laser_rifle.description', '表面が腐食で穴だらけになっており、かろうじてライフルと見分けられる武器です。一部の部品はまだ回収して使えるかもしれません。');
datum(384, 'item.afs_ruined_rifle.name', '朽ちた長銃');
datum(385, 'item.afs_ruined_rifle.description', 'ほとんど原形をとどめていない武器です。せいぜい扉のつっかえ棒に使う程度でしょう。');
datum(386, 'item.afs_ruined_magazine.name', '朽ちた弾倉');
datum(387, 'item.afs_ruined_magazine.description', 'ひどく腐食した小さな金属製の箱です。壊れやすい内部の部品は、とっくに朽ち果てています。');
datum(388, 'item.afs_thi_deed.name', '古い宇宙船の権利証');
datum(389, 'item.afs_thi_deed.description', '『断絶』より前の古い文書です。高祖父によるヴァニシング・アークの購入について記されており、はるか昔に消滅した地球の政体が署名し、有効性を認めています。\n\n実質的な価値のない、法律上の珍品にすぎません。この船の真の所有権を保証しているのは、あなたが主反応炉に組み込んだ自爆機構です。');
datum(390, 'item.afs_old_ship_medal.name', '古い勲章');
datum(391, 'item.afs_old_ship_medal.description', 'ヴァン・マーネン探査海軍での模範的な勤務に対して授与された、古い勲章です。ヴァン・マーネン海軍が何だったのか、なぜこれが陳列ケースに入っているのかも分かりませんが、捨てるのは気が引けます。');
datum(392, 'item.afs_ship_ids.name', '偽造識別コード');
datum(393, 'item.afs_ship_ids.description', 'ニッシア、アストラン、ルジャンなど、銀河の回転方向にある辺境の様々な政体の識別コードです。すべて偽造ですが、大半はまだ使えるだろうと思います。');
datum(394, 'material.afs_plastic_armor.name', '高密度ポリエチレン(HDPE)');
datum(395, 'item.g_shovel.description', '氷の塊を削り取るのに最適な、小さく鋭いシャベルです。');
datum(396, 'item.shovel.use_action.harvest_ice.menu_text', '氷を採取する');
datum(397, 'item.shovel.description', '鋼鉄製の刃が付いたシャベルです。');
datum(398, 'item.shovel_snow.description', '雪をすくって別の場所へ移すための、頑丈な金属製のシャベルです。');
datum(399, 'item.afs_leather_jacket.variant.fur.name', '毛皮襟のジャケット');
datum(400, 'item.afs_leather_jacket.variant.fur.description', '大きな毛皮の襟が付いた、クリーム色のジャケットです。サルスIVの寒さには耐えられず、おしゃれ着としてしか役に立ちません。');
datum(401, 'item.afs_leather_jacket.variant.uica_surplus.name', '軍放出品のジャケット');
datum(402, 'item.afs_leather_jacket.variant.uica_surplus.description', '惑星開拓戦争の終結後に余剰品として売り払われた、くすんだオレンジ色の軍用ジャケットです。UICAで支給されることはなく、工場からそのまま廃棄されました。');
datum(403, 'item.afs_leather_jacket.variant.transparent.name', '透明なジャケット');
datum(404, 'item.afs_leather_jacket.variant.transparent.description', '透明なプラスチックでできたジャケットです。身を隠すのには向いていません。');
datum(405, 'item.afs_leather_jacket.variant.old.name', '古いジャケット');
datum(406, 'item.afs_leather_jacket.variant.old.description', 'あまりに古く使い込まれているため、本物の革でできているのかもしれないと思います。');
datum(407, 'item.afs_exo_standard_underlayer.description', exoIntro + armorOnly + 'この標準モデルは、プラスチックの円盤を重ねた鱗状の防護層を備え、軽微な危険から身を守ります。' + passiveTemperature);
datum(408, 'item.afs_exo_standard_underlayer_on.name', '外骨格スーツ用ウェア(オン)');
datum(409, 'item.afs_exo_standard_underlayer_on.description', exoIntro + armorOnly + 'この標準モデルは、プラスチックの円盤を重ねた鱗状の防護層を備え、軽微な危険から身を守ります。' + activeTemperature);
datum(410, 'item.afs_exo_combat_underlayer.description', exoIntro + armorOnly + 'このモデルは、装甲の破片から身を守るため頑丈なケブラーを組み込んでいます。' + passiveTemperature);
datum(411, 'item.afs_exo_combat_underlayer_on.name', '外骨格スーツ用戦闘ウェア(オン)');
datum(412, 'item.afs_exo_combat_underlayer_on.description', exoIntro + armorOnly + 'このモデルは、装甲の破片から身を守るため頑丈なケブラーを組み込んでいます。' + activeTemperature);
datum(413, 'item.afs_exo_eva_underlayer.description', exoIntro + 'このモデルは船外活動向けに設計されており、気密が破られた際に身を守ります。' + passiveTemperature);
datum(414, 'item.afs_exo_eva_underlayer_on.name', '外骨格スーツ用環境防護ウェア(オン)');
datum(415, 'item.afs_exo_hazard_underlayer_on.description', exoIntro + 'このモデルは危険な環境向けに設計されており、機動性を犠牲にして防護性能を高めています。' + activeTemperature);
datum(416, 'item.afs_exo_hazard_underlayer.description', exoIntro + 'このモデルは危険な環境向けに設計されており、機動性を犠牲にして防護性能を高めています。' + passiveTemperature);
datum(417, 'item.afs_exo_hazard_underlayer_on.name', '外骨格スーツ用多目的ウェア(オン)');
datum(418, 'item.fish.variant.synth.name', '合成魚肉');
datum(419, 'item.fish.variant.synth.description', '培養槽で育てられた、実在しない魚種のピンク色の肉です。特に品質が高く、生でも十分おいしく食べられます。');
datum(420, 'item.fish.variant.insect.name', '節足動物の肉');
datum(421, 'item.fish.variant.insect.description', '異星の昆虫の胸部から取れた、大きな白い切り身です。かすかに甘みがあり、栄養価に優れています。多くの料理で魚肉の代わりに使われます。');
datum(422, 'item.alien_jerky.name', '乾燥した異星生物の肉');
datum(423, 'item.alien_jerky.description', '何らかの異星生物のものと分かる、病的なほど白っぽい肉を細長く切ったものです。非常に強い味があり、かなり噛み応えがあります。');
datum(424, 'item.afs_streetfood_meat.name', '宇宙港のロースト肉');
datum(425, 'item.afs_streetfood_meat.description', 'サルス宇宙港の屋台料理です。細く切った白い肉を焼き、酸っぱいソースをたっぷりかけてあります。何の肉かは分かりませんが、なかなかおいしいです。');
datum(426, 'item.afs_streetfood_veggy.name', '宇宙港の酵母ケーキ');
datum(427, 'item.afs_streetfood_veggy.description', 'サルス宇宙港の屋台料理です。大きな四角い揚げ生地に赤いソースがかかっています。');
datum(428, 'item.afs_light_cannon_mon.name', 'レーザーキャノン');
datum(429, 'item.afs_graf337.name', 'Graf 335L');
datum(430, 'item.afs_graf337.description', '標的だけでなく自分自身も溶かしかねない、凄まじい威力のレーザーピストルです。重い軍用装甲を貫けるほど強力で、3発以内に決着を付けられるなら、大抵の銃撃戦に勝てるでしょう。');
datum(431, 'item.afs_explosive_pumped_laser.description', '旧ソ連の設計局が生み出したPLC-75は、大型レーザー兵器の設計上の制約に対する、粗野で荒々しい回答です。旧式のフラッシュランプ励起レーザー技術を使うため取り回しが悪く、現代の装備との互換性もまったくありません。それが射線上の標的にとって有利になるかどうかは、今も激しい論争の種です。');
datum(432, 'overmap_terrain.afs_shuttlepad_salvors_old_pad.name', '古い発着パッド');
datum(433, 'overmap_terrain.afs_ruins_dynamic.name', '朽ちた建物');
datum(434, 'overmap_terrain.afs_player_ship.name', 'ヴァニシング・アーク');
datum(435, 'overmap_terrain.afs_vehicle_bay.name', '車両格納庫');
datum(436, 'furniture.f_spaceship_kitchenette.description', 'IH調理器を置くのがやっとの小さな調理台です。上下に多数の収納が組み込まれています。曲がりなりにも調理できる最小限の空間です。');
datum(437, 'furniture.f_spaceship_fridge.description', '小型の冷蔵冷凍庫です。宇宙船の電源につながっているため、非常に長い間使えるはずです。');
datum(438, 'furniture.f_landing_hydraulic.name', '油圧シリンダー');
datum(439, 'furniture.f_landing_hydraulic.description', '宇宙船の着陸装置を伸ばしたり引き込んだりする、大きな円筒形のアクチュエーターです。');
datum(440, 'furniture.f_landing_skid.name', '着陸用スキッド');
datum(441, 'furniture.f_landing_skid.description', '油圧で動く、宇宙船用の引き込み式着陸装置です。着陸時の衝撃を吸収するよう設計されています。');
datum(442, 'furniture.f_snow_bowl.name', '雪の器');
datum(443, 'furniture.f_snow_bowl.description', 'おおむねきれいな雪を掘って作った小さなくぼみです。少量の液体を入れられます。');
datum(444, 'terrain.starship_hull.name', '宇宙船の船殻');
datum(445, 'terrain.t_afs_space_ship_hull_wall.description', '民間宇宙船の船殻の一部です。宇宙空間の真空と放射線に耐えるだけの防護しかありませんが、本来は外側にそれ以上の危険などないはずです。');
datum(446, 'terrain.t_afs_starcrane_control.name', 'THI-14 StarCraneの計器盤');
datum(447, 'terrain.t_afs_starcrane_control.description', '計器盤や操縦装置を備えた大きなコンソールです。ここから宇宙船を操縦できます。');
datum(448, 'terrain.t_bay_ramp_control.name', '貨物室ランプの操作盤');
datum(449, 'terrain.t_bay_ramp_control.description', '貨物室のランプを上げ下げするための大きなコンソールです。離陸するにはランプを格納する必要があります。');
datum(450, 'terrain.t_afs_ship_retracted_bay_ramp.name', '格納された貨物室ランプ');
datum(451, 'terrain.t_afs_ship_retracted_bay_ramp.description', '閉じた状態の宇宙船の貨物室ランプです。船を降りるには、まずランプを下ろす必要があります。');
datum(452, 'terrain.t_landing_stair_control.name', '乗降階段の操作盤');
datum(453, 'terrain.t_landing_stair_control.description', '宇宙船の乗降階段を操作する、壁に取り付けられたパネルです。船長がこの階段ではなく貨物室ランプから降りるのは、伝統的に体裁が悪いとされています。');
datum(454, 'terrain.t_afs_ship_canopy.name', 'ダイヤモンド複合材のキャノピー');
datum(455, 'terrain.t_afs_ship_canopy.description', 'ほぼ破壊不可能な、巨大な宇宙船のキャノピーです。現在では、大半のナノ加工装置でも代わりのものを作るのは難しいでしょう。');
datum(456, 'terrain.t_afs_ship_canopy_floor.name', 'ダイヤモンド複合材のキャノピー(床)');
datum(457, 'terrain.t_afs_ship_canopy_floor.description', '宇宙船の船底側を見渡せるよう斜めに取り付けられた、巨大なダイヤモンド複合ガラスの板です。');
datum(458, 'terrain.t_bay_rap_down.name', '下りの貨物室ランプ');
datum(459, 'terrain.t_bay_rap_down.description', '下ろされた貨物室のランプです。下へ進むと船外に出られます。');
datum(460, 'terrain.t_bay_rap_up.name', '貨物室ランプ');
datum(461, 'terrain.t_bay_rap_up.description', '下ろされた貨物室のランプです。上へ進むと船内に入れます。');
datum(462, 'terrain.t_ship_stairs_down.description', '宇宙船の下方の船外へと続く階段です。');
datum(463, 'terrain.t_ship_stairs_up.description', '宇宙船の上方の船内へと続く階段です。');
datum(464, 'terrain.t_afs_gun_ship_hull_wall.description', '戦闘対応の民間宇宙船の船殻の一部です。兵器による攻撃をある程度防げます。');
datum(465, 'terrain.starship_hatch.closed.name', '閉じた宇宙船のハッチ');
datum(466, 'terrain.t_ship_floor_heated.name', '宇宙船の通路');
datum(467, 'terrain.t_ship_floor_heated.description', '下に隠れた配管にアクセスするためのパネルが付いた、大きな金属板です。');
datum(468, 'terrain.t_ship_bay_heated.name', '宇宙船の貨物室');
datum(469, 'terrain.t_ship_bay_heated.description', '一体成形で製造された、巨大な炭化物の板です。何世紀もの酷使に耐えられ、実際に耐えてきました。');
datum(470, 'terrain.t_starcrane_engine.name', 'VENTRエアロスパイク');
datum(471, 'terrain.t_starcrane_engine.description', 'StarCraneを軌道まで到達させる、8基の強力なエアロスパイクエンジンのうちの1基です。');
datum(472, 'terrain.t_starcrane_nacelle.name', 'StarCraneのナセル');
datum(473, 'terrain.t_starcrane_nacelle.description', '左右のナセルには、それぞれ独立した反応炉と燃料供給装置が収まっています。22世紀には数十万機のStarCraneが建造され、当時は故障したナセルをわずか数時間で簡単に新品と交換できました。');
datum(474, 'terrain.t_afs_space_ship_hatch_l.name', '施錠された宇宙船のハッチ');
datum(475, 'terrain.t_afs_space_ship_hatch_l.description', '装甲と気密性を備えた宇宙船のハッチです。施錠されており、操作パネルからしか開けられません。');
datum(476, 'terrain.t_spaceship_sink.description', 'ステンレス製のキッチンシンクです。宇宙船の給水設備につながっています。');
datum(477, 'terrain.t_afs_space_ship_hatch_o.name', '開いた宇宙船のハッチ');
datum(478, 'overmap_terrain.outer_space.name', '宇宙空間');
datum(479, 'overmap_terrain.high_orbit_salus_4.name', 'サルスIVの高軌道');
datum(480, 'monster_attack.android_drop.player.hit', '%1$sは腕であなたを持ち上げ、地面に叩き付けた！');
datum(481, 'monster_attack.android_drop.npc.hit', '%1$sは難なく<npcname>を持ち上げ、地面に叩き付けた！');
datum(482, 'monster_attack.android_drop.player.dodge', '%sが腕を伸ばしてきたが、あなたは身をかわした！');
datum(483, 'monster_attack.android_drop.npc.dodge', '%sは<npcname>を掴もうとしたが、相手は身をかわした！');
datum(484, 'monster_attack.android_drop.player.armor_slip', '%1$sはあなたを掴もうとしたが、防具に手が掛からなかった！');
datum(485, 'monster_attack.android_drop.npc.armor_slip', '%1$sは<npcname>を掴もうとしたが、防具に手が掛からなかった！');
datum(486, 'monster.afs_mon_sentinel_lx.description', '黒と金の装甲をまとった、贅沢な戦闘用ヒューマノイドです。社会の最富裕層の護衛を務めるために作られました。手首の剣を伸ばしたまま永久の警戒を続ける姿は、古の騎士のようです。');
datum(487, 'monster.mon_old_imaginifer.name', 'Parallax-3A セクトール');
datum(488, 'monster.mon_old_imaginifer.description', '守るべき者が容赦ない寒さに命を奪われて久しい今も、腐食した鋼鉄とシリコンは揺るぎなく務めを続けています。一つだけの青い目が、見慣れぬものと化した宇宙の廃墟に、冷酷で計算高い視線を向けています。');
datum(489, 'monster.mon_old_imaginifer_laser.name', 'Parallax-3E ウェレス');
datum(490, 'monster.mon_old_imaginifer_laser.description', '重々しく歩くたび、錆に侵された躯体の重みが足音に響きます。一つだけの青い目は獲物を求めるように周囲を探り、わずかな動きにも、取り付けられたレーザーキャノンの破壊的な視線で応じます。');
datum(491, 'npc_class.nc_salvor_street_food.name', '屋台商人 ');
datum(492, 'npc_class.nc_salvor_street_food.description', '屋台料理を売る商人です。');
datum(493, 'npc.salvor_street_food.name_unique', 'トレス・ランドウェル');
datum(494, 'npc.salvor_street_food.name_suffix', '屋台商人');
datum(495, 'talk_topic.nc_salvor_street_food.dynamic_line.arrival', '&屋台には色とりどりの料理が並び、香辛料と焼けた肉の匂いが凍てつく空気の中でもはっきりと漂っています。近づくと、商人は忙しそうに食事を準備しています。\n「おお、お客さん。気に入ったものはあるかい？」');
datum(496, 'talk_topic.nc_salvor_street_food.response.order_current_dish', '今作っているものをもらおう。');
datum(497, 'talk_topic.nc_salvor_street_food.response.ask_food_safety', 'これ、食べても大丈夫なのか？');
datum(498, 'talk_topic.nc_salvor_street_food_safe.dynamic_line.reassurance', '&商人はあなたの質問にくすっと笑い、エプロンで手を拭きます。\n安全かって？ ああ、とても安全だよ、お客さん。雪は乾いていてきれいなんだ、お客さん。故郷にはこんなに雪はなかったが、ここの雪は料理にとても良いんだ。');
datum(499, 'talk_topic.talk_augustmoon_shipping_chief.dynamic_line.first_arrival', 'サルスIVの軌道へようこそ。まずは歓迎の言葉を申し上げます。私はステーションのこの区域を担当する港湾管理局の職員で、お客様とお荷物の惑星への移送を手配できます」相手はデスクのコンソールにちらりと目をやり、慣れた笑顔で続けます。「おや、システムによると初めてのお越しのようですね。この惑星の環境についてはご存じですか？ ご存じなければ、惑星上で最初の数日間を生き延びるためのスターターキットをご用意できます。');
datum(500, 'talk_topic.talk_augustmoon_shipping_chief.response.book_passage', 'よし、惑星に降りる便について聞こう。');
datum(501, 'talk_topic.talk_augustmoon_shipping_chief.response.ask_starting_kit', 'そのスターターキットに興味がある。');
datum(502, 'talk_topic.talk_augustmoon_kit.dynamic_line.offer', 'このキットはお一人様一度限り、3660USDでご購入いただけます。生存に必要な基本的な防寒着一式、バックパック、簡単な調理器具と物資、護身用の武器、基本的な医療用品が入っています。惑星上で最初の数日間を生き延びるためのものですが、長期的な生存に必要なものがすべて揃っているわけではありません。');
datum(503, 'talk_topic.talk_augustmoon_kit.response.purchase', '買おう。');
datum(504, 'talk_topic.talk_augustmoon_kit.response.consider', '少し考えさせてくれ。');
datum(505, 'talk_topic.thi_control_start.dynamic_line.welcome', '&●◐ トライスター重工\nTHI-14 StarCrane\n\n**ようこそ、船長。**\n');
datum(506, 'talk_topic.thi_control_start.response.plot_known', '> 既知の目的地への航路を設定する。');
datum(507, 'talk_topic.thi_control_start.response.plot_manual', '> 手動で航路を設定する。');
datum(508, 'talk_topic.thi_control_start.response.close_ramp', '> 貨物室ランプを閉じる。');
datum(509, 'talk_topic.thi_control_ready.dynamic_line.success', '&************************************************\n\n整合性確認 : ███████████████ 100% (完了)\n航法データ転送 :  ███████████████ 100% (完了)\n\n************************************************\n*  操作に成功しました                         *\n************************************************');
datum(510, 'talk_topic.thi_control_manual_ready.response.pilot', '宇宙船を操縦する');
datum(511, 'talk_topic.thi_control_navigation.response.cancel', 'キャンセルする。');
datum(512, 'talk_topic.thi_control_bay_ramp_status.dynamic_line.clear', '貨物室ランプの状態: 正常');
datum(513, 'talk_topic.thi_control_bay_ramp_status.dynamic_line.camera', 'コンソールには、閉じていくランプのカメラ映像が表示されています。');
datum(514, 'talk_topic.thi_control_bay_ramp_status.dynamic_line.obstructed', '**警告: ランプ周辺に障害物があります。手動での対応が必要です。エラー。**');
datum(515, 'talk_topic.thi_control_plot_known.dynamic_line.destinations', '**既知の近隣経由地を表示: **');
datum(516, 'talk_topic.thi_control_plot_known.response.salus_high_orbit', 'サルスIVの高軌道');
datum(517, 'talk_topic.thi_control_plot_known.response.salus_spaceport', 'サルスIV宇宙港');
datum(518, 'talk_topic.thi_control_control_ready.response.pilot', '宇宙船を操縦する。');
datum(519, 'profession.afs_han.male.name', '密輸業者');
const smugglerDescription = '何世紀も前に造られた密輸船ヴァニシング・アークの船長として、あなたは何十年も密輸品を運んできました。交渉か銃撃で切り抜けられなかった問題にはまだ出会っておらず、ここでも出会うつもりはありません。運が良ければ、この惑星で身を潜めながら、割の良い仕事を見つけられるでしょう。';
datum(520, 'profession.afs_han.male.description', smugglerDescription);
datum(521, 'profession.afs_han.female.name', '密輸業者');
datum(522, 'profession.afs_han.female.description', smugglerDescription);
add(523, 'data.effect_on_condition.eoc_evac_board.u_message', '掲示板を確認しました。「営業時間」や「身分証として認められるもの」といった、社会が崩壊した今となっては気にする必要のない細かな事柄しか書かれていません。様々な電話番号も載っていますが、たとえ電話に出る人が残っていたとしても、停電中では大して役に立たないでしょう。');
add(524, 'input.keybinding.debug_hour_timer.name', 'デバッグ: 時間タイマーを切り替える');
add(525, 'game.movement.confirm_dangerous_field', '移動先には危険な地形があるようです。続けますか？');
add(526, 'game.ui.curses_mode_unsupported', 'cursesモードには対応していません');
add(527, 'game.movement.dangerous_field_named', '移動先には危険な<color_red>%s</color>があるようです。');
add(528, 'main_menu.version.stable_release', 'バージョン: 0.I-1 (Ito-1) 安定版リリース');
add(529, 'character_creation.profession.requirement_completed', '「%s」を達成済み\n');
add(530, 'character_creation.scenario.requirement_completed', '「%s」を達成済み');
add(531, 'npc.recruitment.insufficient_faction_trust', '<npc_faction>派閥からの信頼が足りません。');
add(532, 'overmap.travel.fast_travel_status', '高速移動中');
add(533, 'player_info.action.upgrade_stat', '能力値を強化する');
add(534, 'profession.achievement_unlock_only', '\nこの職業は実績の達成によってのみ解禁できます。');
add(535, 'ranged.reach_attack.no_hostile_target', '届く範囲に敵対生物がいません。');
add(536, 'ranged.aiming.action.unload_on_exit', '[%s]で、照準を終了した際に%sを弾抜きする設定に切り替えます。');
add(537, 'ranged.aiming.action.keep_loaded_on_exit', '[%s]で、照準を終了した際も%sに弾を込めたままにする設定に切り替えます。');
add(538, 'scenario.achievement_unlock_only', '\nこのシナリオは実績の達成によってのみ解禁できます。');

assert.equal(chunk.count, 179);
assert.equal(rows.length, 179);
const map = new Map(rows.map(row => [row.index, row]));
assert.equal(map.size, rows.length, 'Authoring indices are unique');
const semanticIds = new Set();
const records = chunk.records.map(source => {
  const row = map.get(source.index);
  assert.ok(row, `Missing translation ${source.index}`);
  assert.match(row.semanticId, /^[a-z][a-z0-9_.]+$/);
  assert.ok(!semanticIds.has(row.semanticId), `Duplicate semantic ID ${row.semanticId}`);
  semanticIds.add(row.semanticId);
  const record = { ...source, semanticId: row.semanticId, translations: { '0': row.translation } };
  checkText(record, { ...source, flags: [] });
  assert.deepEqual(printfSignature(row.translation).tokens.sort(), printfSignature(source.singular).tokens.sort(), `Exact printf tokens ${source.index}`);
  const originalFields = Object.fromEntries(Object.keys(source).map(key => [key, record[key]]));
  assert.deepEqual(originalFields, source, 'Every original source field is preserved');
  return record;
});
const semanticReviews = [
  { indices: [368, 379, 455, 525], decision: 'The pristine official Japanese catalog supplies ジーンテックテンプレート, ナノ加工装置, and 危険な地形; reuse these established terms.' },
  { indices: [360, 363, 366, 368, 371], decision: 'Requirement IDs describe the event/objective rather than the requirement array position.' },
  { indices: [396, 444, 446, 447, 462, 465, 509, 511], decision: 'A single exact gettext key is shared by several owners; the human ID names its common gameplay meaning, and every source binding remains unchanged.' },
  { indices: [399, 400, 401, 402, 403, 404, 405, 406, 418, 419, 420, 421], decision: 'Variant IDs use the actual stable source variant IDs fur, uica_surplus, transparent, old, synth, and insect.' },
  { indices: [364, 366, 375, 391, 406, 488], decision: 'Upstream English spelling and grammar are preserved in the source identity; Japanese conveys the intended meaning. Van Maneen and Van Maanen in the same medal description are rendered as the same named navy.' },
  { indices: [415], decision: 'The upstream active EVA and active hazardous underlayers share a hazardous-environment description. Translate that exact description, keep both source bindings, and choose the hazard owner for the canonical human ID; do not silently rewrite the EVA gameplay data.' },
  { indices: [428, 490], decision: 'Light cannon is a laser weapon, not a lightweight ballistic cannon; laser.json and the grafted laser special attack supply the context.' },
  { indices: [431], decision: 'The line about advantages to downrange targets is ironic; preserve that targets, rather than the gun user, could benefit from the obsolete weapon.' },
  { indices: [488], decision: 'Its charge means the person guarded by the robot, not an electrical charge; the person has died in the cold.' },
  { indices: [491, 494], decision: 'The noun hawker refers to a street-food vendor; preserve the intentional trailing space of the NPC-class name in index 491.' },
  { indices: [493], decision: 'Trés Landwell is an authored NPC proper name, not an external username. Transliterate it into Japanese.' },
  { indices: [495, 498], decision: 'Steemd is used repeatedly as a form of customer address in vendor dialogue. Render it as お客さん while retaining the vendor’s repeated and informal wording.' },
  { indices: [499], decision: 'Planetside is passage from orbital station to planet, not travel between planets. Preserve the source’s embedded quotation boundaries and neutral narrative pronouns.' },
  { indices: [509], decision: '100% occurs as literal terminal-status prose, not a printf argument. Preserve both literal percentages, all frame asterisks, and line breaks.' },
  { indices: [519, 520, 521, 522], decision: 'Male/female gettext contexts remain distinct even though Japanese wording is identical; semantic IDs carry the source context.' },
  { indices: [529, 530], decision: 'These belong to profession and scenario achievement requirements respectively, not completed crafting or missions. IDs retain the separate owners and the profession trailing newline.' },
  { indices: [536, 537], decision: 'The inspected ranged.cpp help belongs to the targeting UI’s reload-and-shoot unload toggle. Quitting means leaving aiming, not terminating the game. Both printf arguments remain exact and ordered.' }
];
const output = {
  schemaVersion: 1,
  language: 'ja',
  pluralForms: 'nplurals=1; plural=0;',
  sourceCommit: chunk.sourceCommit,
  sourceVersion: chunk.sourceVersion,
  sourceChunk: path.relative(taskRoot, chunkPath).replaceAll('\\', '/'),
  sourceChunkSha256: crypto.createHash('sha256').update(chunkBytes).digest('hex'),
  count: records.length,
  runtimeConnected: false,
  reviewMethod: 'All 179 assigned current-source records translated individually; nearby official Japanese terminology and selected immutable upstream call sites/definitions inspected. All original metadata is preserved.',
  semanticReviews,
  records
};
const outputPath = path.join(taskRoot, 'ja-current/part-3.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
const outputBytes = fs.readFileSync(outputPath);
const roundtrip = JSON.parse(outputBytes);
assert.deepEqual(roundtrip, output);
const evidence = {
  sourceChunkSha256: output.sourceChunkSha256,
  outputSha256: crypto.createHash('sha256').update(outputBytes).digest('hex'),
  sourceCommit: chunk.sourceCommit,
  recordCount: 179,
  uniqueSourceKeys: new Set(records.map(record => record.catalogKey)).size,
  uniqueSemanticIds: semanticIds.size,
  emptyTranslations: records.filter(record => !record.translations['0'].trim()).length,
  preservedSourceMetadata: true,
  exactPrintfTokens: true,
  typedPrintfArguments: true,
  tagsAndMarkupAndNewlines: true,
  jsonRoundtrip: true,
  runtimeConnected: false,
  semanticReviewGroups: semanticReviews.length
};
fs.writeFileSync(path.join(import.meta.dirname, 'part-3-validation.json'), JSON.stringify(evidence, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify(evidence) + '\n');
