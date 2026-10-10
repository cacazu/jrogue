# Reviewed Japanese terminology

This glossary governs the reviewed character, birth/sidebar and command text
catalogs for Angband 4.2.6. Semantic IDs and original C/data lookup strings stay
unchanged. Authored labels use these Japanese terms; external player names,
usernames and inscriptions remain verbatim typed values.

| Identity or concept | Japanese | Context |
|---|---|---|
| Angband | アングバンド | Game name; repository/parser name remains Angband |
| Warrior / Mage / Druid | 戦士 / 魔術師 / ドルイド | Class display names |
| Priest / Necromancer / Paladin | 僧侶 / 死霊術師 / 聖騎士 | Class display names |
| Rogue / Ranger / Blackguard | 盗賊 / 野伏 / 暗黒騎士 | Class display names |
| STR / INT / WIS | 腕力 / 知力 / 賢さ | Keep stat tokens STR/INT/WIS |
| DEX / CON | 器用さ / 耐久力 | Short sidebar labels 器用 / 耐久 are deliberate |
| HP / SP | HP / SP | Resource prose uses マナ; do not rename source fields |
| Armor class | AC / 防御値 | Short sidebar heading 防御 is deliberate |
| Acid / electricity / fire / cold | 酸 / 電撃 / 火炎 / 冷気 | Damage/resistance identity |
| Poison / light / dark / sound | 毒 / 光 / 暗黒 / 轟音 | Damage/resistance identity |
| Shards / nexus / nether | 破片 / 因果混乱 / 地獄 | Damage/resistance identity |
| Chaos / disenchantment | カオス / 劣化 | Damage/resistance identity |
| Water / ice / force | 水 / 氷 / 衝撃 | Damage/resistance identity |
| Gravity / inertia / time | 重力 / 慣性 / 時間 | Damage/resistance identity |
| Plasma / meteor / mana damage | プラズマ / 隕石 / 魔力 | MANA damage differs from resource マナ |
| Holy orb / magic missile | 聖なる力 / 魔法の矢 | Projection identity; spell names need not imply their projection |
| Confusion / stun / blindness | 混乱 / 朦朧 / 盲目 | Timed conditions; keep resistance types distinct |
| Haste / slow / see invisible | 加速 / 減速 / 透明視 | Timed conditions |
| Heroism / berserk / black breath | 英雄化 / 狂戦士化 / 黒の息 | Timed conditions |
| Free action / command / cover tracks | 自由行動 / 支配 / 痕跡隠し | COVERTRACKS affects noise, scent and visibility |
| Glyph of warding / decoy | 守りの刻印 / 囮 | Identify-rune remains ルーン鑑定; distinct concepts |
| Rubble | 瓦礫 | Command がれき is an outstanding spelling alignment |
| Undead / unique / artifact / ego | アンデッド / ユニーク・モンスター / アーティファクト / エゴアイテム | Do not collapse mechanical categories |

Descriptions must distinguish sensed **presence** (存在を察知) from fully
detected objects (感知). A translation never grants kind, artifact, ego, trap,
monster-health or other knowledge that the original visible producer withholds.
Apparent terrain is distinct from actual hidden terrain. Sleeping resistance
is not confusion resistance. Fixed healing and a percentage of **missing HP**
are distinct; timed reductions do not necessarily cure completely.

Use マス for grid distance/radius and ターン for game turns. Game turns are not
seconds, input presses or browser frames. Keep original ポンド, フィート,
インチ and ストーン rather than silently converting values. Preserve dice
notation `NdS`, signed modifiers, literal percentages and actual ASCII selection
keys. Qualify approximate/random teleport distances; do not turn a nominal
distance into a guaranteed maximum.

Book brackets are literal titles. Book lookup keys and shared object-kind
identity must remain English internally; object article/count/plural grammar
still requires separate typed descriptors. Original English descriptions remain
exact source values. `migration/character-data/wording-review.json` records
code-backed corrections where upstream English documentation conflicts with
the pinned rules; those changes affect presentation only.
