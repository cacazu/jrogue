"""Final mixed source batch: Japanese frames with unbound native producers."""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("source_frame_author", ROOT / "author-mixed-batch-2.py")
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)
author.INPUT = ROOT / "english-primary-text-or-mixed-batch-7.json"
author.EXPECTED = "2a747cf695846d227fb678dff8844a43036840e27c24abae3085135a22d72c2b"
author.FRAMES = """
1 {arg_1:%s}が弱くなった！
2 {arg_1:%s}は{arg_2:%s}！
3 火は{arg_1:%s}を熱くしない！
4 {arg_1:%s}！
5 {arg_1:%s}は{arg_2:%s}！
6 火は{arg_1:%s}を焼かないようだ！
7 {arg_1:%s}が霜に覆われた！
8 霜は{arg_1:%s}を冷やさない！
9 {arg_1:%s}が霜に覆われた！
10 霜は{arg_1:%s}を冷やさないようだ！
11 {arg_1:%s}が電撃を受けた！
12 電撃は{arg_1:%s}を感電させない！
13 {arg_1:%s}が電撃を受けた！
14 {arg_1:%s}に覆われた！　焼ける！
15 {arg_1:%s}が{arg_2:%s}に覆われた！
16 {arg_1:%s}を焼く！
17 {arg_1:%s}の金貨をつかんだが、背負い袋に入れる余地がない。
18 {arg_1:%s}が{arg_2:%s}から金貨をいくらか盗んだ。
19 {arg_1:%s}が突然消えた！
20 {arg_1:%s}には効果がない。
21 {arg_1:%s}が突然消えた！
22 {arg_1:%s}には効果がない。
23 {arg_1:%s}の目が見えなくなった。
24 {arg_1:%s}があなたの目を見えなくした！
25 {arg_1:%s}。
26 {arg_1:%s}がくすくす笑った。
27 {arg_1:%s}が破壊された！
28 あなたの{arg_1:%s}に毒が付いていた！
29 {arg_1:%s}は傷ついていないようだ。
30 あなたのとげが{arg_1:%s}に刺さった！
31 {arg_1:%s}を溺れさせた……
32 {arg_1:%s}が押しつぶされている。
33 {arg_1:%s}に軽く触れた。
34 {arg_1:%s}があなたを溺れさせる……
35 {arg_1:%s}があなたに軽く触れた。
36 {arg_1:%s}が{arg_2:%s}に軽く触れた。
37 {arg_1:%s}があなたのせいで動けなくなった！
38 {arg_1:%s}のせいで動けなくなった！
39 {arg_1:%s}が{arg_2:%s}のせいで動けなくなった。
40 {arg_1:%s}があなたによって眠らされた！
41 {arg_1:%s}によって眠らされた！
42 {arg_1:%s}が{arg_2:%s}によって眠らされた。
43 {arg_1:%s}をスライムに変えた。
44 効き目が弱くなったように{arg_1:%s}。
45 {arg_1:%s}の動きが遅くなった。
46 {arg_1:%s}は混乱しているようだ。
47 {arg_1:%s}は変化しなかった。
48 {arg_1:%s}が致命的な接触をしようと手を伸ばした。
49 {arg_1:%s}が石になった！
50 {arg_1:%s}に攻撃されて分裂した！
51 {arg_1:%s}が{arg_2:%s}を攻撃した。
52 {arg_1:%s}から咳の音が聞こえる！
53 {arg_1:%s}がしゅうしゅうと鳴くのが聞こえる！
54 {arg_1:%s}は顔をしかめたようだ。
55 {arg_1:%s}があなたの{arg_2:%s}{arg_3:%s}に届こうとした！
56 {arg_1:%s}があなたの{arg_2:%s}{arg_3:%s}を刺した！
57 {arg_1:%s}が{arg_3:%s}から{arg_2:%s}を盗んだ！
58 {arg_1:%s}が突然消えた！
59 あなたの閃光で{arg_1:%s}の目が見えなくなった！
60 あなたの閃光が{arg_1:%s}に効いた！
61 {arg_2:%s}を{arg_1:%s}。
62 自分の{arg_1:%s}の中でじゅうじゅう鳴るものを、慌てて吐き戻した。
63 {arg_1:%s}を消化した。
64 {arg_1:%s}はあなたの水分で重くなっている。
65 {arg_1:%s}は傷ついていないようだ。
66 {arg_1:%s}があなたのべとべとした液に覆われた！
67 {arg_1:%s}には害がないようだ。
68 {arg_1:%s}はその中では見えない！
69 {arg_1:%s}の周囲の空気が電気でぱちぱち鳴った。
70 {arg_1:%s}は傷ついていないようだ。
71 {arg_1:%s}は少し寒そうだ。
72 {arg_1:%s}は凍え死にかけている！
73 {arg_1:%s}は少し熱そうだ。
74 {arg_1:%s}は黒焦げになりつつある！
75 {arg_1:%s}に友好的なふりをした。
76 {arg_1:%s}への攻撃を外した。
77 {arg_1:%s}びくともしない。
78 {arg_1:%s}はびくともしない。
79 {arg_1:%s}が{arg_5:%s}{arg_6:%s}で、{arg_3:%s}を{arg_4:%s}{arg_2:%s}！
80 {arg_1:%s}が{arg_2:%s}叩き出されるのを感じた！
81 あなたの触手が{arg_1:%s}を吸った。
82 {arg_1:%s}をつかんだ！
83 {arg_1:%s}を包み込もうとしたが、害を与えなかった。
84 {arg_1:%s}気分が悪くなった。
85 {arg_1:%s}の視線で動けなくなった！
86 {arg_1:%s}のせいで動けなくなった！
87 効き目が弱くなったように{arg_1:%s}。
88 あなたの{arg_1:%s}のうずきが止まった。
89 あなたの{arg_1:%s}が{arg_2:%s}に光らなくなった。
90 あなたの{arg_1:%s}のうずきが弱まった。
91 あなたの{arg_1:%s}は、もう{arg_2:%s}にあれほど明るく光らない。
92 その{arg_1:%s}は実に{arg_2:%s}{arg_3:%c}
93 閃光が{arg_1:%s}を目覚めさせた。
94 閃光が{arg_1:%s}を照らした。
95 {arg_1:%s}が照らされた。
96 {arg_1:%s}が光から身を引いた！
97 {arg_1:%s}が激怒した。
98 困惑した{arg_1:%s}は向きを変えて去った。
99 {arg_1:%s}は不満げに息を吐き、去ろうと向きを変えた。
100 {arg_1:%s}が別れの手を振った。
101 {arg_1:%s}が呪文をささやいた。
102 突然、{arg_1:%s}が消えた。
103 「{arg_1:%s}」
104 混乱した{arg_1:%s}が消えた。
105 {arg_1:%s}が金貨をいくらか拾った。
106 {arg_1:%s}があなたの金貨を金庫に送った。
107 {arg_1:%s}
108 {arg_1:%s}
109 ファイル「{arg_1:%s}」のバージョンが一致しない。
110 ファイル「{arg_1:%s}」の構成に互換性がない。
111 重要バイトの比較が位置{arg_1:%d}で一致しなかった（{arg_2:%s}）。
112 {arg_1:%s}が{arg_2:%s}を手に構えようとした。
113 {arg_1:%s}が{arg_2:%s}！
114 {arg_2:%s}の修練を{arg_1:%s}忘れた。
115 {arg_1:%s}が月に向かって遠吠えするのが聞こえる。
116 輝くことを{arg_1:%s}。
117 {arg_1:%s}。
118 すでに{arg_1:%s}。
119 {arg_1:%s}。
120 それを{arg_1:%s}ことはできない！
121 今は{arg_1:%s}。
122 {arg_1:%s}。
123 {arg_1:%s}を十分な力で握れない。
124 今は{arg_1:%s}を手に構えている。
125 {arg_1:%s}は同時に二つの武器を使えない。
126 {arg_1:%s}は片手用ではない。
127 あなたの{arg_2:%s}から{arg_1:%s}！
128 輝くことを{arg_1:%s}。
129 {arg_1:%s}。
130 {arg_1:%s}{arg_2:%s}。
131 {arg_1:%s}。
132 思いがけず{arg_1:%s}。
133 ウィンドウ処理系{arg_1:%s}は認識できない。選択肢：
134         {arg_1:%s}
135 {arg_1:%s}
136 {arg_1:%s}
137 {arg_1:%s} {arg_2:%s}
138 熱いと{arg_1:%s}！
139 とても温かいと{arg_1:%s}。
140 温かいと{arg_1:%s}。
141 「わしを{arg_1:%s}ことができると思ったか、愚か者め。」
142 自分を取り巻く{arg_1:%s}光に気付いた。
143 {arg_1:%s}が悪魔のように笑った。
144 「お守りを渡せ、{arg_1:%s}！」
145 「{arg_1:%s}{arg_2:%s}！」
146 {arg_1:%s}があなたの家系を中傷した。
147 {arg_1:%s}：
148 {arg_2:%s}を{arg_1:%s}！
149 {arg_1:%s}は{arg_2:%s}。
150 {arg_1:%s}
151 こっそり自分の{arg_1:%s}の下の匂いをかいだ。
152 匂いを出していないように{arg_1:%s}。
153 {arg_1:%s}の時間制限を{arg_3:%d}{arg_2:%s}。
154 現在の階層に待機中の怪物が{arg_1:%d}体、次の階層に{arg_3:%d}体、他の階層に{arg_4:%d}体いる。
155 このゲームのNHUUIDは{{ {arg_1:%s} }}である。
156 {arg_1:%s}の尾の一部を切り落とした。
157 {arg_1:%s}が真っ二つに切られた。
158 {arg_1:%s}を真っ二つに切った。
159 {arg_1:%s}の動きが遅くなっている。
160 突然、{arg_1:%s}が見えなくなった。
161 {arg_1:%s}の鞍が落ちた。
162 もう{arg_1:%s}には乗れない。
163 {arg_1:%s}に触れた。
164 {arg_1:%s}では点字を書けない。
165 その{arg_1:%s}は白紙ではない！
166 そのような{arg_1:%s}はない！
167 それを書くことについて{arg_1:%s}。
168 「{arg_1:%s}」と書くと、巻物が消えた。
169 {arg_1:%s}を崩壊させた！
170 {arg_1:%s}が身震いした！
171 {arg_1:%s}が透明になった！
172 {arg_1:%s}が消えた！
173 {arg_1:%s}が後ろへ弾き飛ばされた！
174 {arg_1:%s}はびくともしない。
175 {arg_1:%s}が外れた。
176 {arg_1:%s}{arg_2:%s}
177 {arg_1:%s}は突然弱くなったようだ！
178 {arg_1:%s}が口を開いた！
179 {arg_1:%s}を放した。
180 解放された{arg_1:%s}。
181 {arg_1:%s}が弱々しくぴくぴく動いた。
182 {arg_1:%s}が虹色に光った。
183 {arg_1:%s}が突然、元の体へ引き込まれた！
184 {arg_1:%s}が突然現れた！
185 {arg_1:%s}が怒った！
186 {arg_1:%s}が激怒している！
187 {arg_1:%s}罠にかかっている！
188 {arg_1:%s}空だ。
189 {arg_1:%s}が砕けた。
190 {arg_1:%s}が消えた。
191 {arg_1:%s}が生き返る音が聞こえる。
192 {arg_1:%s}が現れた。
193 {arg_1:%s}が突然爆発した！
194 {arg_1:%s}が光り、その光が消えた。
195 塵に{arg_1:%s}。
196 {arg_1:%s}の下がかなりかゆく感じた。
197 {arg_1:%s}気分がよくなった。
198 {arg_1:%s}に向かって探った。
199 {arg_1:%s}の下を探った。
200 あなたの足元の{arg_1:%s}が砕けた。
201 あなたの{arg_1:%s}に血がしたたった。
202 {arg_1:%s}を見つけた{arg_2:%c}
203 {arg_1:%s}が蜘蛛の巣に捕まった！
204 {arg_1:%s}が跳ねる音が聞こえる。
205 {arg_1:%s}は痛くない。
206 {arg_1:%s}が焼ける！
207 {arg_1:%s}が燃えた。
208 {arg_1:%s}が分解された！
209 {arg_1:%s}が分解された。
210 {arg_1:%s}が復活した！
211 {arg_1:%s}がそばをひゅっと通り過ぎた！
212 あなたの{arg_1:%s}がうずいた。
213 {arg_1:%s}が跳ね返った！
214 {arg_1:%s}
215 {arg_1:%s}が静まった……
216 {arg_1:%s}
217 {arg_1:%s}に氷の橋が架かった！
218 {arg_1:%s}が凍った。
219 煙の{arg_1:%s}。
220 {arg_1:%s}{arg_2:%s}を砕いた。
"""
author.LITERALS = {
    "": "", "acid": "酸", "seem": "見える", "englut": "飲み込んだ", "engulf": "包み込んだ",
    "knock": "叩き飛ばした", "forceful": "力強い", "powerful": "強力な", "blow": "一撃", "strike": "打撃",
    "very ": "とても", "Paste buffer copy is not available.\n": "貼り付けバッファへのコピーは利用できない。\n",
    "some of ": "一部", "stop": "やめた", "them": "それら", "it": "それ", "slip": "滑り落ちた",
    "faintly glow": "かすかに光った", "evaporate": "蒸発した", "suddenly vibrate": "突然震えた",
    "feel": "感じられる", "destroy": "破壊した", "kill": "殺した", "destroyed": "破壊された", "killed": "殺された",
    "You seem": "あなたは感じられる", "That monster seems": "その怪物は感じられる",
    "increased by": "増やした", "set to": "に設定した", "fail": "失敗した", "don't know how": "やり方がわからない",
    "are": "は", "turn": "変わった", "much ": "ずっと", "water": "水",
    "see a puff": "ひと吹きを見た", "smell a whiff": "かすかな匂いをかいだ",
}

author.main(
    newline_suffix=(), newline_both=(), grammar_omissions=(154,), technical=(),
    compound=(44, 87, 116, 127, 128, 130, 131, 132, 138, 139, 140, 187, 188, 195),
    hallucination=(14, 15, 79, 205, 206, 218), decompression=(),
    extra_notes={
        37: ["Original frozen wording denotes immobility here, not an invented cold/ice damage effect. The same public actor/cause remains explicit."],
        79: ["Both rn2 selections occur only in original gameplay once. Preserve selected forceful/powerful and blow/strike wording without drawing another RNG value for Japanese."],
        108: ["Original literal newline belongs to the producer string, not this outer %s-only frame; preserve it at that original selected leaf."],
        134: ["Keep the original eight leading spaces and the native window-processor identifier literal."],
        138: ["The original object feels hot to the observer; do not make an inanimate object sense heat. This compound producer needs the same public object name with a passive Japanese feel realization."],
        139: ["The original object feels very warm to the observer, preserving its haptic observation and degree; it does not perform another observation or infer a hidden portal."],
        140: ["The original object feels warm to the observer; the absence of very/hot remains meaningful."],
        152: ["Original You/That monster is a source-selected grammatical subject for a no-smell inference, not a visually observed appearance. Japanese preserves the uncertain olfactory modality."],
        154: ["Japanese monster counts retain all three exact integer values. The original English mon suffix arg_2 is a source grammar morpheme omitted only from the Japanese frame; the full union and original evaluation remain."],
        155: ["NHUUID and the displayed UUID are technical identifiers. Exact literal braces and source public value are preserved."],
        219: ["Original visual puff and olfactory whiff are distinct branch-selected observations; Japanese retains the original modality and does not turn blindness into seeing."],
    },
)
