#!/usr/bin/env python3
"""Author source-only Japanese frames; never infer an event from runtime English."""
import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent

# These whole frames are hand authored. A slot whose native value contains an
# English clause is deliberately NOT approved for runtime substitution: its
# source-owned public grammar producer must be implemented and proved first.
AUTHORED = r'''0|戻ってきたが、体の内側はまだ{arg_1:%s}と感じている。
1|{arg_1:%s}
2|{arg_1:%s}{arg_2:%s}の写真を撮った。
3|{arg_1:%s}の写真を撮った。
4|空いている{arg_1:%s}がない！
5|{arg_1:%s}を{arg_2:%s}押しずらした。
6|{arg_1:%s}を押して外した。
7|あなたの{arg_1:%s}は、すっかりきれいになったように感じる。
8|「{arg_1:%s}、ジム」と言う声が聞こえる。
9|{arg_1:%s}不幸な生き物は{arg_4:%s}死んでいるとわかった。
10|{arg_1:%s}は、像としては{arg_2:%s}な健康状態だ。
11|空いている{arg_1:%s}がない。
12|{arg_1:%s}が邪魔をしている。
13|{arg_1:%s}は十分に健康そうだ。
14|そこには{arg_1:%s}が隠れている。
15|そこには{arg_1:%s}がいる。
16|{arg_1:%s}を通して泡を吹いた。
17|吹き抜ける風があなたの{arg_1:%s}をくすぐるのを感じる。
18|{arg_1:%s}。
19|{arg_1:%s}ことに失敗した。
20|{arg_1:%s}には、リードを取り付けられる手足がない。
21|あなたのリードが{arg_1:%s}の首を絞め、死なせてしまった！
22|{arg_1:%s}リードが勢いよく外れた！
23|{arg_1:%s}は曇ってしまい、何も映さない！
24|{arg_1:%s}
25|自分の{arg_1:%s}{arg_2:%s}を見ることができない。
26|うわっ！ {arg_1:%s}がこちらを見返している！
27|あなたは{arg_1:%s}の姿をしている。
28|あなたは相変わらず{arg_1:%s}に見える。
29|{arg_1:%s}を映した。
30|{arg_1:%s}は疲れすぎていて、あなたの{arg_2:%s}を見ようとしない。
31|{arg_1:%s}は、今は何も見えない。
32|{arg_1:%s}はあなたの{arg_2:%s}に気づかない。
33|{arg_1:%s}の姿は鏡に映らない。
34|{arg_1:%s}は石になった！
35|{arg_1:%s}は自分の映った姿に凍りついた。
36|{arg_1:%s}が動きを止めるのが聞こえる。
37|{arg_1:%s}は自分自身を混乱させた！
38|{arg_1:%s}がそれを取った！
39|それはあなたの{arg_1:%s}を盗んだ！
40|{arg_1:%s}には、はっきりした反応がない。
41|{arg_1:%s}は自分の映った姿に怯えた。
42|{arg_1:%s}は自分の映った姿を無視した。
43|{arg_1:%s}を鳴らした。
44|{arg_1:%s}を呼び出した！
45|{arg_1:%s}粉々になった！
46|{arg_1:%s}不安を誘う甲高い音を立てた……
47|{arg_1:%s}が開いた……
48|{arg_1:%s}の火を消した。
49|この{arg_1:%s}には{arg_2:%s}がない。
50|{arg_1:%s}が急速に燃え尽きていく！
51|{arg_1:%s}不思議な暖かさを放った！
52|{arg_1:%s}不思議な光を放った！
53|新しい{arg_1:%s}が魔法の力で{arg_2:%s}！
54|{arg_1:%s}消えた。
55|{arg_1:%s}の火が消えた！
56|{arg_1:%s}が{arg_2:%s}{arg_3:%s}{arg_4:%s}。
57|{arg_1:%s}{arg_2:%s}は消灯した。
58|{arg_1:%s}の火を消した。
59|{arg_1:%s}
60|この{arg_1:%s}には油が入っていない。
61|{arg_1:%s}{arg_2:%s}は点灯した。
62|煙が{arg_1:%s}。
63|{arg_1:%s}から抜け出した。
64|{arg_1:%s}に捕まったまま、少し身をよじった！
65|{arg_1:%s}から逃れられない！
66|{arg_1:%s}は罠にかかって動けない。
67|{arg_1:%s}は、その場で跳ぶことができない。
68|{arg_1:%s}の上へ、自分の体を引き上げた！
69|跳び上がり、{arg_1:%s}下へ戻った。
70|{arg_1:%s}。
71|食べかけの{arg_1:%s}を缶詰にすることはできない。
72|{arg_1:%s}
73|{arg_1:%s}が突然消えた！
74|{arg_1:%s}にグリースを厚く塗った。
75|グリースの一部が、あなたの{arg_1:%s}にべったり付いた。
76|あなたの{arg_1:%s}にグリースを塗った。
77|{arg_1:%s}空だ。
78|{arg_1:%s}空のようだ。
79|{arg_1:%s}をそれ自身にこすりつけることはできない。
80|{arg_2:%s}に{arg_1:%s}筋が付くのが見える。
81|{arg_1:%s}罠を仕掛けることはできない！
82|{arg_1:%s}{arg_2:%s}を仕掛ける作業を再開した。
83|{arg_1:%s}に乗ったまま手を伸ばすのは、あまり得意ではない。
84|{arg_1:%s}を落とした！
85|{arg_1:%s}{arg_2:%s}を仕掛け始めた。
86|{arg_1:%s}の設置を終えた。
87|{arg_1:%s}から虫を払い落とした。
88|{arg_1:%s}を鞭で打った！
89|自分の牛追い鞭で、あなたの{arg_1:%s}を打った。
90|牛追い鞭があなたの{arg_1:%s}から滑り落ちた。
91|牛追い鞭を{arg_1:%s}に巻き付けた。
92|{arg_1:%s}を{arg_2:%s}へ引き落とした！
93|つかもうとした{arg_1:%s}が、あなたにぶつかった！
94|{arg_1:%s}をつかみ取った！
95|{arg_1:%s}に向けて牛追い鞭を振った。
96|あなたの{arg_1:%s}にべったり付いた粘つく汚れのせいで、何も見えない。
97|{arg_1:%s}にローヤルゼリーを塗りたくった。
98|{arg_1:%s}が弱々しく{arg_2:%s}。
99|{arg_1:%s}
100|{arg_1:%s}が一瞬{arg_2:%s}。
101|{arg_1:%s}から何かを引っ掛けて取った！
102|{arg_1:%s}を引き寄せた！
103|鉤が{arg_1:%s}を切り裂いた。
104|{arg_1:%s}へ引っ張られた！
105|手がなければ、{arg_1:%s}を折ることはできない！
106|あなたの{arg_1:%s}はふさがっている！
107|{arg_1:%s}を折るだけの力がない！
108|{arg_1:%s}が{arg_2:%s}色に光った。
109|{arg_1:%s}のページをめくった。
110|ページから不快な{arg_1:%s}音が聞こえる。
111|ページが{arg_1:%s}色にほのかに光るのが見える。
112|ページは{arg_1:%s}手触りだ。
113|この魔法書は{arg_1:%s}。
114|この魔法書の{arg_1:%s}インクは{arg_2:%s}。
115|{arg_1:%s}を弾いて裏返した。
116|それはあなたの{arg_1:%s}の間をすり抜けた。
117|{arg_1:%s}が出た。
118|{arg_1:%s}力の衝撃を受けた！
119|{arg_1:%s}あなたの手を逃れた！
120|{arg_1:%s}あなたには制御できない！
121|{arg_1:%s}を解放した！
122|その{arg_1:%s}は洞察に富んでいる。
123|{arg_1:%s}が{arg_2:%s}！
124|{arg_1:%s}を大きく切り開いた！
125|{arg_1:%s}を深く切りつけた！
126|{arg_1:%s}が{arg_2:%s}を真っ二つにした！
127|{arg_1:%s}があなたを深く切りつけた！
128|{arg_1:%s}があなたを真っ二つにした！
129|どういうわけか、{arg_1:%s}への攻撃は大きく外れた。
130|どういうわけか、{arg_1:%s}の攻撃は大きく外れた。
131|どういうわけか、{arg_1:%s}のあなたへの攻撃は大きく外れた。
132|{arg_1:%s}があなたの{arg_2:%s}を切断した。
133|{arg_2:%s}の{arg_1:%s}が硫黄の煙の中に{arg_3:%s}！
134|{arg_1:%s}
135|{arg_1:%s}
136|{arg_1:%s}：
137|{arg_1:%s}が{arg_3:%s}色に{arg_2:%s}{arg_4:%c}
138|鍵は{arg_1:%s}と感じる{arg_2:%c}
139|{arg_1:%s}{arg_2:%s}と感じる！
140|{arg_1:%s}と感じる！
141|{arg_1:%s}が以前ほどではないと感じる！
142|あなたの思考が{arg_1:%s}揺れ動いた。
143|鉄球があなたの{arg_1:%s}に落ちてきた。
144|{arg_1:%s}は、あなたを守ってくれない。
145|{arg_1:%s}を{arg_2:%s}手に合うように調整した。
146|「{arg_1:%s}」は、認識できる数値ではない。
147|フィールド '{arg_1:%s}' はパーセント値に対応していない。
148|'{arg_1:%s}{arg_2:%d}%' は有効なパーセント値ではない。
149|{arg_1:%s}「{arg_2:%s}{arg_3:%d}」{arg_4:%s}
150|{arg_1:%s}「{arg_2:%s}{arg_3:%ld}」{arg_4:%s}
151|強調表示 condition/{arg_1:%s}/{arg_2:%s} を追加した。
152|強調表示 {arg_1:%s} を追加した。
153|{arg_1:%s} へのアクセスが拒否された（{arg_2:%d}）。
154|指定された設定ファイル {arg_1:%s} を開けなかった（{arg_2:%d}）。
155|標準の設定ファイル {arg_1:%s} を開けなかった {arg_2:%s}（{arg_3:%d}）。
156|{arg_1:%s} に構文エラーがある。
157|{arg_1:%s}{arg_2:%s}{arg_3:%s}
158|\n{arg_1:%s}
159|{arg_1:%s} {arg_2:%s}{arg_3:%s}{arg_4:%s}
160|\n{arg_4:%s}で{arg_1:%d}件のエラー。\n
161|注意！ 探索モードからは{arg_1:%s}に戻れない。
162|{arg_1:%s}を続行する。
163|{arg_2:%s}{arg_3:%s}{arg_1:%s}。
164|{arg_1:%s}は{arg_2:%s}{arg_3:%s}だと推測した。
165|{arg_1:%s}場所の広さは推測できない。
166|{arg_1:%s}。
167|autocomplete の誤り：'{arg_1:%s}' は無効な拡張コマンドだ。
168|{arg_1:%s} コマンドには '{arg_2:%s}' 接頭コマンドを付けられない。
169|'{arg_1:%s}' 接頭コマンドの後には、{arg_2:%s}移動コマンドが必要だ。
170|未知のコマンド '{arg_1:%s}'。
171|{arg_1:%s}
172|{arg_1:%s}
173|{arg_1:%s} {arg_2:%s}
174|落とし格子は{arg_1:%s}に当たらなかった！
175|{arg_1:%s}跳ね橋の下で押しつぶされた。
176|{arg_1:%s}落下する落とし格子に押しつぶされた！
177|{arg_1:%s}跳ね橋の背後へ消えた。
178|{arg_1:%s}橋から落ちた。
179|{arg_1:%s}飛び散る破片でばらばらに吹き飛ばされた。
180|{arg_1:%s}ヘヴィメタルにハマった！
181|{arg_1:%s}巨大な金属片が当たった！
182|{arg_2:%s}が近くにあることを{arg_1:%s}。
183|{arg_2:%s}の{arg_1:%s}を感知した。
184|{arg_1:%s}と感じる。
185|あなたの{arg_1:%s}がむずむずする。
186|{arg_1:%s}理解しきれないほどのものだ！
187|{arg_1:%s}あなたを混乱させた！
188|{arg_1:%s}あなたの視力を損なった！
189|{arg_1:%s}あなたの視覚を襲った。
190|{arg_1:%s}あなたの精神を直撃した！
191|{arg_1:%s}！
192|{arg_1:%s}を明らかにした！
193|{arg_1:%s}を感知した！
194|疑い深さが{arg_1:%s}和らいだと感じる。
195|{arg_1:%s}が体を広げた！
196|何もない空間を{arg_1:%s}ことはできない。
197|ここには{arg_1:%s}だけの十分な空間がない。
198|階段は硬すぎて{arg_1:%s}ことができない。
199|ここの{arg_1:%s}は硬すぎて{arg_2:%s}ことができない。
200|{arg_1:%s}が跳ね、静まった。
201|手を滑らせて、{arg_1:%s}を落とした。
202|バン！ {arg_1:%s}の広い側面で叩いた！
203|自分の{arg_1:%s}を打った。
204|{arg_2:%s}で{arg_1:%s}を壊した。
205|{arg_1:%s}を力いっぱい打った。
206|隣に{arg_1:%s}を掘った。
207|{arg_3:%s}{arg_2:%s}{arg_1:%s}を掘った。
208|{arg_1:%s}が崩れ、{arg_2:%s}になった。
209|{arg_2:%s}に{arg_1:%s}が現れた。
210|{arg_1:%s}が{arg_2:%s}へ落ちた！
211|{arg_1:%s}は罠を避けた。
212|乱流によって、{arg_1:%s}試みは失敗した。
213|{arg_1:%s}に届かない。
214|{arg_1:%s}で自分自身を打った。
215|{arg_1:%s}蜘蛛の巣に絡まった。
216|何もない空間で{arg_1:%s}を振った。
217|{arg_1:%s}を始めた。
218|下に向かって{arg_1:%s}を始めた。
219|下に向かって{arg_1:%s}を続けた。'''

# Only C expressions whose returned literal is directly consumed by printf are
# included here. The original branch still chooses exactly once. This is not a
# runtime English lookup table and is NOT an executable producer binding.
LEAVES = {
    5: {"arg_2": {"cock-eyed": "いびつに", "crooked": "斜めに"}},
    9: {"arg_1": {"this": "この", "that": "あの", "these": "これらの", "those": "あれらの"},
        "arg_2": {"": "", "s": ""}, "arg_3": {"is": "", "are": ""},
        "arg_4": {" mostly": "ほとんど", "": ""}},
    19: {"arg_1": {"un": "何かからリードを外す", "": "何かにリードを付ける"}},
    54: {"arg_1": {"They go": "それらは", "It goes": "それは"}},
    56: {"arg_2": {"crackles": "ぱちぱちと鳴る", "": ""},
         "arg_3": {" and ": "うえ、", "": ""}, "arg_4": {"flickers": "ちらつく", "": ""}},
    62: {"arg_1": {"see a puff of": "ひと吹き見えた", "smell": "匂う"}},
    69: {"arg_1": {"come": "", "fly": "飛んで"}},
    70: {"arg_1": {"hop up and down a bit": "少しその場で跳ねた", "decide not to jump after all": "結局、跳ぶのをやめることにした"}},
    110: {"arg_1": {"chuckling": "くすくす笑うような", "rustling": "がさがさした"}},
    112: {"arg_1": {"freshly picked": "摘みたてのような", "rough and dry": "ざらざらして乾いた"}},
    113: {"arg_1": {"doesn't have much of a plot": "あまり筋書きがない", "has nothing written in it": "何も書かれていない"}},
    114: {"arg_1": {" magical": "魔法の", "": ""}},
    117: {"arg_1": {"heads": "表", "tails": "裏"}},
    133: {"arg_1": {"Most of the": "大半", "Some of the": "一部", "The": "すべて"}},
    135: {"arg_1": {"It is lit here now.": "辺りが明るくなった。"}},
    139: {"arg_1": {"very ": "とても", "": ""}},
    142: {"arg_1": {"wildly": "激しく", "briefly": "一瞬"}},
    145: {"arg_2": {"right": "右", "left": "左"}},
    157: {"arg_1": {"config_error_add: ": "config_error_add: ", "": ""}},
    159: {"arg_1": {"Error:": "エラー：", " *": " *"}},
    160: {"arg_3": {"on": "", "in": ""}},
    163: {"arg_1": {"are in": "にいる", "remember this as": "だと、この場所を記憶している", "remember that as": "だと、あの場所を記憶している"},
          "arg_3": {"room": "部屋", "area": "場所"}},
    164: {"arg_1": {"this": "この場所", "that": "あの場所"}, "arg_3": {"room": "部屋", "area": "場所"}},
    165: {"arg_1": {"this": "この", "that": "あの"}},
    169: {"arg_2": {" other than up or down": "上昇・下降以外の", "": ""}},
    182: {"arg_1": {"smell": "匂いで感じ取った", "sense": "感じ取った"}},
    183: {"arg_1": {"presence": "存在", "absence": "不在"}},
    184: {"arg_1": {"very greedy": "とても欲張りになった", "entrapped": "罠に捕らわれた"}},
    194: {"arg_1": {"somewhat ": "いくらか", "": ""}},
}

OMISSIONS = {
    9: {"arg_2": "English being/being+s number inflection is absent from Japanese. The exact singular/plural public distinction remains in arg_1 this/these or that/those; the full source union is retained.",
        "arg_3": "English singular/plural is/are auxiliary is realized by the invariant Japanese predicate 死んでいる; no identity, number or state is recomputed."},
    42: {"arg_2": "Native mhis refers to the same already-public subject's own reflection. Japanese 自分の preserves this relation without English gendered his/her/its inflection; arg_1 subject and full source union remain."},
    50: {"arg_2": "vtense(s,are) only agrees the English being-consumed auxiliary with the already-public candle quantity. Japanese 燃え尽きていく has no agreement auxiliary; source subject/quantity and all typed args remain."},
    55: {"arg_2": "otense(obj,go) conjugates the fixed English go out idiom. Japanese 火が消えた preserves extinguishing; the source-selected object/quantity stays in arg_1 and no new tense or state query is performed."},
    160: {"arg_2": "plur(n) is the English error/errors suffix. Japanese 件のエラー is invariant and the exact numeric count is kept in arg_1.",
          "arg_3": "English on/in distinguishes the preposition appropriate to command line versus file. Japanese uses the shared で locative already in this whole frame; original public source label/path remains arg_4."},
}

# These are clauses generated by the ORIGINAL formatter. A future semantic
# producer must preserve subject/public name and source-selected predicate;
# stripping an English suffix or reparsing the assembled output is prohibited.
PREFIX_RECIPES = {
    45: "Japanese public subject + が; fixed whole frame realizes original have shattered perfect result.",
    46: "Japanese public subject + が; original issue is realized by 音を立てた in the whole frame.",
    51: "Japanese public subject + が; original radiate is realized by 暖かさを放った.",
    52: "Japanese public subject + が; original glow is realized by 光を放った.",
    77: "Japanese public subject + は; original are + empty is realized by 空だ.",
    78: "Japanese public subject + は; original seem + to be empty is realized by 空のようだ.",
    108: "Japanese public object name only; fixed whole frame realizes original Yobjnam2 glow verb and arg_2 preserves the source-selected public/hallucinated color.",
    119: "Japanese public subject + が; original evade + your grasp is realized by あなたの手を逃れた.",
    120: "Japanese public subject + は; original are + beyond your control is realized by あなたには制御できない.",
    136: "Japanese public subject + がささやく; keep original whisper predicate and colon framing.",
    175: "Japanese original public entity subject + が; original are + crushed passive is realized by 押しつぶされた.",
    176: "Japanese original public entity subject + が; original are + crushed passive is realized by 押しつぶされた.",
    177: "Japanese original public entity subject + が; original disappear is realized by 背後へ消えた.",
    178: "Japanese original public entity subject + が; original fall is realized by 橋から落ちた.",
    179: "Japanese original public entity subject + が; original are + blown apart passive is realized by ばらばらに吹き飛ばされた.",
    180: "Japanese original public entity subject + が; original hallucination-only get into some heavy metal music idiom is realized by ヘヴィメタルにハマった. Preserve this source joke instead of substituting the real impact or hidden monster identity.",
    181: "Japanese original public entity subject + に; original are hit passive is realized by 巨大な金属片が当たった (entity struck, not attacker).",
    186: "Japanese public subject + は; original are + too much is realized by 理解しきれないほどのものだ.",
    187: "Japanese public subject + が; original confuse is realized by あなたを混乱させた.",
    188: "Japanese public subject + が; original damage is realized by あなたの視力を損なった.",
    189: "Japanese public subject + が; original assault is realized by あなたの視覚を襲った; do not change the target to a physical eyeball injury.",
    190: "Japanese public subject + が; original zap is realized by あなたの精神を直撃した.",
    191: "Complete Japanese clause with public subject and actual source-site-selected explode OR implode predicate. The two distinct original sites must not collapse into one guessed verb.",
    215: "Japanese public object subject + が; original become entangled is realized by 蜘蛛の巣に絡まった.",
}

OPAQUE = {
    146: {"arg_1"}, 147: {"arg_1"}, 148: {"arg_1"},
    149: {"arg_2"}, 150: {"arg_2"}, 151: {"arg_1", "arg_2"}, 152: {"arg_1"},
    153: {"arg_1"}, 154: {"arg_1"}, 155: {"arg_1"}, 156: {"arg_1"},
    158: {"arg_1"}, 167: {"arg_1"}, 168: {"arg_1", "arg_2"},
    169: {"arg_1"}, 170: {"arg_1"}, 173: {"arg_2"},
}

CONTAINERS = {1, 18, 24, 59, 70, 72, 99, 134, 135, 157, 159, 166, 171, 172, 173, 191}

# Explicitly reviewed original producer -> original consumer chains. These
# outputs are still NOT runtime-bound. The helper is never called again by
# display code; a future bridge must capture its existing return value.
PRODUCERS = {
    (0, "arg_1"): {"source":"src/polyself.c","line":2279,"declaration_line":2273,
        "expression":'!nonliving(gy.youmonst.data) ? "dead" : !weirdnonliving(gy.youmonst.data) ? "condemned" : "empty"',
        "consumer":"udeadinside()","japanese":{"dead":"死んでいる","condemned":"破滅を宣告されている","empty":"空っぽだ"},
        "dataflow":"The original udeadinside function directly returns exactly one of these three strings. allmain.c:865 directly consumes that one return value; do not rerun nonliving/weirdnonliving or disclose a form/species ID."},
    (5, "arg_1"): {"source":"src/apply.c","line":144,"declaration_line":142,
        "expression":'(ublindf->otyp == LENSES) ? "lenses" : (obj->otyp == ublindf->otyp) ? "other towel" : "blindfold"',
        "consumer":"what","japanese":{"lenses":"レンズ","other towel":"別のタオル","blindfold":"目隠し"},
        "dataflow":"Original const-char-pointer local what is assigned at 144-147, then directly consumed by the cursed branch at 149, with no intervening overwrite; preserve that original selected label, no additional object lookup."},
    (6, "arg_1"): {"source":"src/apply.c","line":144,"declaration_line":142,
        "expression":'(ublindf->otyp == LENSES) ? "lenses" : (obj->otyp == ublindf->otyp) ? "other towel" : "blindfold"',
        "consumer":"what","japanese":{"lenses":"レンズ","other towel":"別のタオル","blindfold":"目隠し"},
        "dataflow":"Original const-char-pointer local what is assigned at 144-147, then directly consumed by the noncursed branch at 153, with no intervening overwrite; preserve that original selected label, no additional object lookup."},
    (207, "arg_2"): {"source":"src/dig.c","line":702,"declaration_line":702,
        "expression":'(ttyp == HOLE ? "through" : "in")',"consumer":"in_thru",
        "japanese":{"through":"を貫通する","in":"に"},
        "dataflow":"Original in_thru assignment at 702 directly precedes the original madeby_u callback at 707; no overwrite occurs. Capture the original selected hole-versus-other-trap relation once; never infer it from English or reread ttyp."},
}
for _index in [196, 197, 198, 199]:
    PRODUCERS[(_index, "arg_2" if _index == 199 else "arg_1")] = {
        "source":"src/dig.c","line":258,"declaration_line":258,
        "expression":'(madeby == BY_YOU && uwep && is_axe(uwep)) ? "chop" : "dig in"',
        "consumer":"verb","japanese":{"chop":"切り刻む","dig in":"掘る"},
        "dataflow":"Original digfeedback const-char-pointer verb initialized at 258-259 is directly consumed by this switch arm, with no reassignment in the function. Do not inspect uwep/is_axe again from the renderer."}

INK_TABLE = {"fresh":"鮮明だ","slightly faded":"少し色あせている","very faded":"かなり色あせている",
             "extremely faded":"ひどく色あせている","barely visible":"かろうじて見える"}

SPECIAL_ROLES = {
    (0, "arg_1"): "Japanese descriptor of the original udeadinside() sensation, preserving its dead/condemned/empty return and pending doomed-form source branch; no psychological diagnosis, future demise certainty or hidden genocide/form lookup added.",
    (2, "arg_1"): "Original s_suffix public monster name as Japanese possessive prefix, including の where appropriate. Do not append another possessive suffix in the frame or consult species anew.",
    (2, "arg_2"): "Original selected public monster body-part label, not a new normal-human stomach assumption.",
    (22, "arg_1"): "Original public monster-name possessive prefix; Japanese grammar includes the same owner relation and no second の is supplied by the frame.",
    (25, "arg_1"): "Original uvisage adjective as Japanese prenominal descriptor with correct inflection; capture its original selected value before output, never guess face/body identity.",
    (57, "arg_1"): "Original Shk_Your ownership/shop prefix, in Japanese prefix grammar. Preserve the original owner rather than hardcoding あなたの.",
    (61, "arg_1"): "Original Shk_Your ownership/shop prefix, in Japanese prefix grammar. Preserve the original owner rather than hardcoding あなたの.",
    (80, "arg_1"): "Original public streak-color descriptor as Japanese prenominal color phrase. No true gem/color revelation or second original color-helper call.",
    (82, "arg_1"): "Original shk_your ownership prefix, not a reconstructed owner or price/shop query.",
    (85, "arg_1"): "Original shk_your ownership prefix, not a reconstructed owner or price/shop query.",
    (111, "arg_1"): "Original already-selected hcolor public/hallucinated color stem; faintness belongs to the glow intensity in the whole frame, not a changed/paler color identity.",
    (114, "arg_2"): "Original fadeness[findx] public ink condition selected by source min(spestudied,MAX_SPELL_STUDY). Its pinned table/declaration/consumer needs a semantic producer; do not reread study count or infer spell identity.",
    (118, "arg_1"): "Original s_suffix(the(xname)) public artifact/object possessive prefix in Japanese, including の. The blast indicates harmful power, not invented forced displacement.",
    (137, "arg_2"): "Original glow_verb/newstr predicate already selected and conjugated by otense; preserve exact glow/flicker degree/verb as Japanese predicate, not a new current-state selection.",
    (139, "arg_2"): "Original source-selected attrstr property/sensation as Japanese predicate suitable before と感じる. Preserve change direction and degree without querying attributes again.",
    (140, "arg_1"): "Original chosen abil gainstr OR losestr whole property/sensation as Japanese predicate. Both sites retain exact original ability-table identity and selected change direction.",
    (141, "arg_1"): "The same public property expressed by original abil->gainstr as Japanese property noun/nominalized state for 以前ほどではない; preserve LESS, not complete loss/negation or a new ability-state test.",
    (149, "arg_1"): "Original public threshold_value prefix as Japanese label; exact native operator and numeric input remain arg_2/arg_3, original out-of-range conclusion remains arg_4.",
    (150, "arg_1"): "Original public threshold_value prefix as Japanese label; exact native operator and signed long remain arg_2/arg_3, original out-of-range conclusion remains arg_4.",
    (163, "arg_2"): "Original public selection_size_description an() adjective rendered as complete Japanese prenominal size phrase, including its own correct な/い inflection. The frame adds no English-like article or guessed room dimensions.",
    (164, "arg_2"): "Original public selection_size_description an() adjective rendered as complete Japanese prenominal size phrase, including its own correct な/い inflection. The frame adds no English-like article or guessed room dimensions.",
    (191, "arg_1"): PREFIX_RECIPES[191],
    (196, "arg_1"): "Original digfeedback verb selection chop versus dig in as Japanese dictionary-form action appropriate before こと; preserve the original axe/dig branch without inspecting the held weapon again.",
    (197, "arg_1"): "Original digfeedback verb selection chop versus dig in as Japanese dictionary-form action appropriate before だけの; retain original space limitation.",
    (198, "arg_1"): "Original digfeedback chop versus dig in action as Japanese dictionary form; retain hardness limitation rather than a different ladder/stair state.",
    (199, "arg_2"): "Original digfeedback chop versus dig in action as Japanese dictionary form; preserve the original public selected surface arg_1.",
    (207, "arg_2"): "Original local in_thru selected from ttyp==HOLE: Japanese を貫通する for through, に for in. Must bind its exact original producer before printf, never infer it from English or query the trap again.",
    (212, "arg_1"): "Original action gerund as Japanese prenominal action phrase, including の/する where required; turbulence defeats that original attempt, not a newly selected action.",
    (217, "arg_1"): "Original d_action[dig_target] action gerund as Japanese action noun suitable before を始めた; retain original dig/chop target selection.",
    (218, "arg_1"): "Original verbing as Japanese action noun suitable before を始めた; source downward direction stays in the whole frame.",
    (219, "arg_1"): "Original verbing as Japanese action noun suitable before を続けた; continuation and downward direction must not become a new start.",
}


def slot_names(template):
    return set(re.findall(r"\{(arg_[0-9]+):", template))


def dependency(index, source, contract, arg):
    name = arg["id_candidate"]
    expression = arg["source_expression"]
    typed = next(a for a in source["typed_arguments"] if a["name"] == name)
    lexical = arg["source_literal_candidates"]
    confirmed = bool(lexical) and name in LEAVES.get(index, {})
    if typed["type"] != "text":
        kind = "original-typed-numeric-or-character-value"
        role = "Preserve exact original numeric value and original printf conversion; %c remains a promoted C integer byte rendered as its original punctuation, never a decimal number."
    elif name in OPAQUE.get(index, set()):
        kind = "opaque-public-user-text-or-native-symbol"
        role = "Retain the exact public input/path/command/option/comparison/operator/notation text. It is data, not an English translation key; UTF-8, literal % and braces are never reparsed."
    elif confirmed:
        kind = "confirmed-source-selected-output-literal"
        role = "Japanese selected-literal records specify this whole frame's slot. Capture the ORIGINAL once-selected branch before formatting; do not choose it again or reverse-match English."
    elif (index, name) in PRODUCERS:
        kind = "confirmed-pinned-original-selected-output-producer"
        role = "Pinned original producer/consumer source chain is recorded for these selected output literals. Capture the original return/assignment once; source review does not prove a native event producer or permit a new helper/state call. " + PRODUCERS[(index, name)]["dataflow"]
    elif index in PREFIX_RECIPES and name == "arg_1":
        kind = "public-name-and-conjugated-clause-semantic-producer-required"
        role = PREFIX_RECIPES[index]
    elif index in CONTAINERS:
        kind = "public-composite-frame-pending-source-producer"
        role = "Capture the original source-producing public phrase/message ID, typed union, public subject and grammar before C printf; this container alone does not translate its assembled English value. Exact native English fallback until producer is proved."
    elif re.search(r"\b(?:vtense|otense|glow_verb)\s*\(", expression):
        kind = "original-public-verb-and-agreement-producer-required"
        role = "Preserve the source-selected predicate/degree and original public quantity. A Japanese predicate or explicit English-only agreement omission needs a pure semantic recipe at the original producer, not suffix stripping."
    elif re.search(r"\b(?:hcolor|hliquid)\s*\(", expression):
        kind = "original-selected-public-or-hallucinated-descriptor-required"
        role = "Only the descriptor already selected by original hcolor/hliquid is public. Its literal function input is NOT the consumed output and must not reveal the true color/liquid or invoke the helper/RNG again."
    elif re.search(r"(?:[Mm]on_?nam|[Mm]onnam|[mM](?:his|he)\(|[TtYyAa]?(?:objnam|name)|xname|pmname|s_suffix|Shk_Your|shk_your|body_part|mbodypart|makeplural|fingers_or_gloves|singular|surface\(|ceiling\(|An\(|an\(|the\(|e_nam|E_phrase)", expression):
        kind = "original-public-name-appearance-ownership-body-or-terrain-producer-required"
        role = "Preserve only the original public name/appearance, supplied nickname, pronoun, ownership, known quantity, visible body/form or terrain selected by C. Preserve articles/possessive relation in Japanese grammar without hidden species/object queries or hallucination re-rolls."
    else:
        kind = "original-public-table-buffer-or-phrase-dataflow-required"
        role = "A static declaration/assignment and every original overwrite/branch/consumer lifetime must be proved before binding this public descriptor/buffer. A lexical candidate or variable name alone does not prove a translated producer."
    if index in OMISSIONS and name in OMISSIONS[index]:
        role += " Japanese whole-frame omission: " + OMISSIONS[index][name]
    if (index, name) in SPECIAL_ROLES:
        role += " Source-specific Japanese grammar contract: " + SPECIAL_ROLES[(index, name)]
    return {"argument": name, "type": typed["type"], "source": contract["source"], "line": contract["line"],
            "source_expression": expression, "blob_sha256": contract["blob_sha256"], "kind": kind,
            "japanese_slot_role": role, "source_literal_roles": [{"ordinal": l["ordinal"], "english_source_literal": l["english_literal"],
                "role": "selected-output-literal" if confirmed else "producer-input-literal",
                "runtime_binding_approved": False} for l in lexical],
            "original_selected_value_only": True, "additional_native_queries_allowed": False,
            "runtime_english_reverse_matching_allowed": False, "producer_runtime_verified": False, "runtime_binding_approved": False}


def main():
    path = HERE / "english-primary-text-or-mixed-batch-1.json"
    original = json.loads(path.read_text("utf8"))
    authored = {}
    for line in AUTHORED.splitlines():
        index, text = line.split("|", 1)
        assert int(index) not in authored
        authored[int(index)] = text.replace(r"\n", "\n")
    assert set(authored) == set(range(len(original["entries"])))
    entries = []
    upstream = HERE.parents[1] / "upstream/NetHack-5.0.0"
    for index, source in enumerate(original["entries"]):
        ja = authored[index]
        union = set(source["required_argument_union"])
        omissions = [{"argument": name, "reason": reason} for name, reason in OMISSIONS.get(index, {}).items()]
        assert union - slot_names(ja) == {o["argument"] for o in omissions}, (index, union, slot_names(ja))
        variants = {}
        for variant in source["required_helper_variants"]:
            if variant == "dream":
                variants[variant] = "夢の中で、" + ja
            elif variant == "underwater":
                assert source["original_api"] == "You_hear" and "聞こえる" in ja
                variants[variant] = ja.replace("聞こえる", "かろうじて聞こえる")
            elif variant == "blind":
                assert source["original_api"] == "You_see" and "のが見える" in ja
                variants[variant] = ja.replace("のが見える", "のを感じる")
            else:
                raise AssertionError(variant)
        literals = []
        dependencies = []
        for contract in source["official_source_contracts"]:
            for arg in contract["arguments"]:
                dependencies.append(dependency(index, source, contract, arg))
                producer = PRODUCERS.get((index, arg["id_candidate"]))
                if producer:
                    assert arg["source_expression"] == producer["consumer"]
                    producer_path = upstream / producer["source"]
                    blob = hashlib.sha256(producer_path.read_bytes()).hexdigest()
                    found = []
                    for ordinal, match in enumerate(re.finditer(r'"(?:\\.|[^"\\])*"', producer["expression"])):
                        english = json.loads(match.group())
                        found.append(english)
                        literals.append({"source":producer["source"],"line":producer["line"],"argument":arg["id_candidate"],
                            "source_expression":producer["expression"],"consumer_source_expression":arg["source_expression"],
                            "original_call_site":{"source":contract["source"],"line":contract["line"]},
                            "additional_source_producer_evidence":True,"producer_declaration_start_line":producer["declaration_line"],
                            "source_literal_ordinal":ordinal,"source_expression_literal_start":match.start(),"source_expression_literal_end":match.end(),
                            "english_source_literal":english,"role":"selected-output-literal","japanese":producer["japanese"][english],
                            "blob_sha256":blob,"consumer_blob_sha256":contract["blob_sha256"],"selection_proof":producer["dataflow"],
                            "producer_dataflow_review_status":"exact-original-selected-output-source-chain-reviewed-runtime-unbound",
                            "japanese_frame_composition_required":True,"runtime_binding_approved":False})
                    assert set(found) == set(producer["japanese"])
                mapping = LEAVES.get(index, {}).get(arg["id_candidate"])
                if mapping is None or not arg["source_literal_candidates"]:
                    continue
                candidates = arg["source_literal_candidates"]
                assert {l["english_literal"] for l in candidates} <= set(mapping), (index, arg)
                for leaf in candidates:
                    literals.append({"source":contract["source"],"line":contract["line"],"argument":arg["id_candidate"],
                        "source_expression":arg["source_expression"],"consumer_source_expression":arg["source_expression"],
                        "original_call_site":{"source":contract["source"],"line":contract["line"]},
                        "source_literal_ordinal":leaf["ordinal"],"source_expression_literal_start":leaf["start"],"source_expression_literal_end":leaf["end"],
                        "english_source_literal":leaf["english_literal"],"role":"selected-output-literal","japanese":mapping[leaf["english_literal"]],
                        "blob_sha256":contract["blob_sha256"],"selection_proof":"The literal is a direct returned branch of the exact original C printf argument expression; no helper return value or predicate-comparison token is substituted.",
                        "japanese_frame_composition_required":True,"runtime_binding_approved":False})
        tables = []
        if index == 114:
            table_path = upstream / "src/apply.c"
            text = table_path.read_text("utf8")
            marker = 'static const char *const fadeness[] = {'
            region_start = text.index(marker)
            region_end = text.index('};', region_start)
            matches = list(re.finditer(r'"(?:\\.|[^"\\])*"', text[region_start:region_end]))
            assert len(matches) == len(INK_TABLE)
            for ordinal, match in enumerate(matches):
                english = json.loads(match.group())
                start, end = region_start+match.start(), region_start+match.end()
                tables.append({"source":"src/apply.c","line":text.count("\n",0,start)+1,
                    "source_file_literal_start":start,"source_file_literal_end":end,"original_quoted_token":match.group(),
                    "english_source_literal":english,"japanese":INK_TABLE[english],"source_table":"fadeness","source_table_index":ordinal,
                    "argument":"arg_2","consumer_source_expression":"fadeness[findx]",
                    "original_call_site":{"source":"src/apply.c","line":4518},
                    "selection_proof":"The pinned static fadeness table at 4509-4515 is indexed by original findx=min(obj->spestudied,MAX_SPELL_STUDY) at 4516, then directly consumed by the original message at 4518-4520. No reassignment intervenes. Capture the original selected public ink descriptor; never reread obj->spestudied or infer spell identity.",
                    "blob_sha256":hashlib.sha256(table_path.read_bytes()).hexdigest(),
                    "producer_dataflow_review_status":"exact-original-table-selection-source-chain-reviewed-runtime-unbound",
                    "runtime_binding_approved":False})
        notes = ["Whole Japanese frame authored against pinned official English and all recorded source sites. Source-schema approval is not an assertion that public buffers/names/grammar are translated or runtime-bound.",
                 "All original typed arguments, original printf widths/precision/lengths and the exact public union are retained. Runtime English reverse matching, newly inferred identity, extra original helper/RNG/name/state calls, and translated input bytes are prohibited.",
                 "Selected-output literal translations are attached only to confirmed direct branch results. Quoted helper inputs are not selected output. Independent native producer/binding and callback tests remain required before rollout.",
                 "Every helper variant is a complete immutable Japanese sentence. Dream, barely-heard underwater and blind sensing follow original pline.c priorities; no live-state query or invented water location is used during rendering."]
        if index in PREFIX_RECIPES:
            notes.append("Native argument combines a public subject and English finite verb: " + PREFIX_RECIPES[index] + " This is an unimplemented source-semantic grammar dependency, not permission to strip English or query the entity again.")
        if index in CONTAINERS:
            notes.append("A generic %s clause/container alone supplies no translated identity. It remains exact original English until every source producer, selected public argument and callback association has independent evidence.")
        if index == 195:
            notes.append("Independent source review: this original detect.c:1916 site is inside #if 0 (lines 1913-1917), despite the prepared inventory's generic active-source flag. It is dormant source text only; no current native callback/runtime binding is claimed or permitted without a new explicit preprocessor applicability review.")
        if index in [25, 27, 28, 68, 80, 108, 110, 111, 112, 113, 139, 140, 141, 142, 200]:
            notes.append("Preserve original selected hallucinated/public descriptor or changed-body sensation; neither the real identity nor the normal non-hallucinated input label may replace it.")
        if index == 19:
            notes.append("Empty/un is a source-selected prefix of leash, not an empty message. Japanese expands the exact prefix+fixed leash-something frame into attach/remove action; both branches and the indefinite something stay explicit.")
        if index in [62, 69, 163, 164, 165, 182, 183]:
            notes.append("Preserve original perception/action/memory/deictic/polarity branch exactly. The source-selected Japanese slot may move in this whole sentence, but must not assert current visibility for remembered terrain, flying for ordinary descent, sight for smell, or presence for absence.")
        if index in [137, 138]:
            notes.append("%c stays the original promoted integer punctuation (! or .), rendered as one original byte; preserve intensity/heat/glow/color as source-selected public output, never decimal character codes.")
        if index in [146, 147, 148, 151, 152, 153, 154, 155, 156, 157, 158, 167, 168, 169, 170, 173]:
            notes.append("Native input, command/option/field identifiers, notation, diagnostic function name, path, count and errno are literal public data. Japanese changes the surrounding explanation only; accelerators, response keys and original parser behavior remain unchanged.")
        entries.append({"id":source["id"],"whole_message_ja":ja,"original_api":source["original_api"],
            "original_english_literal":source["original_english_literal"],"english_whole_named_template":source["english_whole_named_template"],
            "source_translation_review_status":"faithful-official-source-frame-with-explicit-unbound-argument-dependencies",
            "source_translation_approved":True,"source_argument_schema":source["typed_arguments"],"argument_schemas":source["required_argument_union"],
            "printf_conversions":source["printf_conversions"],"omitted_grammar_arguments":omissions,
            "helper_variant_templates_ja":variants,"required_source_literal_translations":literals,
            "required_source_table_translations":tables,
            "source_presentation_dependencies":dependencies,
            "requires_public_name_or_grammar_producer":any(d["type"] == "text" and d["kind"] != "opaque-public-user-text-or-native-symbol" for d in dependencies),
            "localization_disposition":"public-composite-frame-pending-source-producer" if index in CONTAINERS else "authored-source-frame-with-unbound-argument-dependencies",
            "source_capture_constraints":["Bind only the exact source-issued ID at the actual original accepted UI callback, with original attrs, urgent/nohistory, filters, history, callback/window, and public accessibility prefix preserved.",
                "Capture each original argument expression/selected branch exactly once before C printf. No extra name/appearance/hallucination/RNG/state query, synthesized hidden identity, suffix stripping or runtime English matching.",
                "Public-name, table, buffer, conjugation, ownership and whole-phrase dependencies require source-owned semantic producers and independent proof. Until every dependency/callback is supported, preserve exact native English fallback.",
                "All runtime_binding_approved, producer_runtime_verified and runtime_integration flags remain false; no production runtime/catalog/compiler/browser mutation is authorized by this source authoring."],
            "official_sites_reviewed":source["official_source_contracts"],"translation_notes":notes,
            "runtime_binding_approved":False,"runtime_integration":False})
    output = {"schema_version":1,"category":original["category"],"batch":original["batch"],
        "source_batch_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"provenance":original["provenance"],
        "authorship":{"kind":"authored-official-English-equivalent-Japanese-with-source-producer-dependencies","date":"2026-10-02"},
        "entries":entries,"runtime_binding_approved":False,"runtime_integration":False}
    target = HERE / original["output_fragment_path"]
    target.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"path":target.name,"ids":len(entries),"source_sites":sum(len(e["official_sites_reviewed"]) for e in entries),
        "helper_variants":sum(len(e["helper_variant_templates_ja"]) for e in entries),
        "confirmed_selected_literal_records":sum(len(e["required_source_literal_translations"]) for e in entries),
        "source_table_records":sum(len(e["required_source_table_translations"]) for e in entries),
        "source_presentation_dependencies":sum(len(e["source_presentation_dependencies"]) for e in entries),
        "runtime_approved":0,"sha256":hashlib.sha256(target.read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
