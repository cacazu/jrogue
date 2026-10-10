"""Whole-message Japanese authoring for one frozen official-source queue."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "english-primary-zero-argument-batch-1.json"
EXPECTED = "39b2bdb8eea457d6091d5100edee8448233bd3fea7e0a9bc18b39ce034a48389"
PRIOR_OBSERVED_INPUT = "6708548944ca5416abc8c95b98b2f56d0e8f330061dde52d9af75ab6c14d0c96"
# One numbered, whole Japanese frame per exact input entry. SOURCE preserves
# empty strings and geometric diagram rows without changing their whitespace.
FRAMES = """
1 水中でカメラを使うと保証が無効になる。
2 身に着けている間は使えない！
3 べとべとした汚れを落とした。
4 何も聞こえない！
5 かすかな水しぶきの音が聞こえる。
6 地獄の業火がぱちぱちと燃える音が聞こえる。
7 自分の心臓の鼓動が聞こえる。
8 かすかなタイプの音が聞こえる。
9 透明な怪物は移動したに違いない。
10 笛を使うことができない。
11 笛を使うことができない。
12 引き綱がたるんだ。
13 これ以上ペットに引き綱を付けられない。
14 自分に引き綱を付ける？　面白い冗談だ……
15 そこには生き物がいない。
16 引き綱は外れてしまうだけだ。
17 この引き綱はその生き物に付いていない。
18 引き綱が外れない！
19 引き綱を引いた。
20 自分の視線を浴びて、一瞬体がこわばった。
21 うわっ！　自分自身を動けなくしてしまった！
22 鏡に自分が映らない。
23 あれ？　自分の姿には見えない！
24 だが、音はくぐもっている。
25 だが、音がしない。
26 周囲のものが開く……
27 水中では火を起こせない。
28 ランタンの電力が切れている。
29 火の付いた薬を消した。
30 火を燃やし続けるだけの酸素がない。
31 「もちろん、薬の代金とは別だ。」
32 手がなければ何もこすれない。
33 すまないが、その使い方はわからない。
34 電気ランプをこすっても、たいした成果はない。
35 ともかく、何も面白いことは起こらない。
36 その移動はできない！
37 遠すぎる！
38 そこへは跳べない！
39 着地する場所が見えない！
40 戸口から斜めには跳べない。
41 跳ぶのを妨げる障害物がある。
42 跳べない。脚がない！
43 それほど遠くへは跳べない。
44 少し跳ね回った。
45 冗談だろう！
46 少し水をかき回した。
47 ここでは跳ぶのでなく、泳ぐべきだ！
48 少し手足をばたつかせた。
49 跳ぶための足場がしっかりしていない。
50 荷物が重すぎて跳べない！
51 跳ぶだけの力がない！
52 どこへ跳びたい？
53 熊の罠から無理やり抜け出した！　痛い！
54 落とし穴から跳び出した！
55 抜け出すときに蜘蛛の巣を引き裂いた！
56 缶がなくなったようだ。
57 「そうだ……だが、戦争は敵を保存したりはしない……」
58 死体をつかみ損ねた。
59 実体が薄すぎて缶詰にできない。
60 ここには十分な空間がない。
61 そこに像を置くことはできない。
62 岩の上に像を置く余地がない。
63 何かが砕けたのを感じた。
64 おお、きれいな破片を見てよ。
65 罠を仕掛けようとしたが、失敗した。
66 外した。
67 鞭を振るだけの空間がない。
68 抵抗が大きすぎて鞭を振れない。
69 小さな水しぶきを上げた。
70 死んだ馬を叩いてどうする？
71 落とし穴から自分を引き上げた！
72 何もない空中で鞭を鳴らした。
73 遠すぎる！
74 何を叩けばよいかわからない。
75 近すぎる！
76 刃がそこまで届かない！
77 シャキーン！
78 外した。そこには攻撃する相手がいない。
79 自分の顔を手入れした。
80 遠すぎる！
81 何を狙う？
82 自分に鉤を引っかけた！
83 力の壁が周囲に激しく降り立った！
84 今の姿では道具を使えない。
85 呼び出し音が鳴った！……だが、誰も出ない。
86 すまないが、その使い方はわからない。
87 ページをこれ以上びしょぬれにしたくはないだろう？
88 ページが震えるのを感じた。
89 動く飾り文字を楽しんだ。
90 読むと面白そうだ。
91 転がり去った。
92 アーティファクト
93 アーティファクト
94 魔力を失った！
95 魔力を吸収した！
96 よくやった、ヘンリー。だが、あれはアンではなかった。
97 力が湧き上がるのを感じたが、何も起こらないようだ。
98 気分がよくなった。
99 活力が戻った。
100 どのダンジョンへのポータルを開く？
101 一瞬ひどく方向感覚を失った。
102 きらめく球体に包まれた！
103 一瞬体重がなくなったように感じた。
104 力が抜けるように感じた……
105 群衆を扇動したくなった。
106 周囲の緊張が和らいだように感じた。
107 体が再びはっきりしてくるようだ……
108 帽子が一瞬締まり、また緩んだ。
109 毒は効いていないようだ。
110 毒は致命的だった……
111 驚いて鉄球を落とした。
112 幸い、硬い兜をかぶっている。
113 鉄球に引かれるのを感じた。
114 鉄球に引き戻された！
115 蜘蛛の巣が壊れた！
116 鉄球をつかみ損ねた。
117 鉄球に引かれて階段を転げ落ちた！
118 鉄球が体にぶつかった！
119 古いボーンズファイルを削除できない。
120 使えないボーンズファイルを破棄する。慌てる必要はない……
121 切り替える状態異常を選択
122 強調表示する項目を選択：
123 試すのはもう十分だ。
124 パーセント値は想定していない。
125 それは透明な数字なのか？
126 SOURCE
127 SOURCE
128 ステータスの強調表示：
129 奇妙だ。設定ファイル名を特定できなかった。
130 警告：saveoptionsは実験的な機能です！
131 保存されない設定があります！
132 手作業での調整とコメントはすべてファイルから削除されます！
133 SYSCF_FILEを開けない。
134 SOURCE
135 内部のlevl[][].typコードを36進数で表示
136 36進数のlevl[][].typコードの凡例
137 SOURCE
138 SOURCE
139 デバッグモードのコマンド：
140 SOURCE
141 SOURCE
142 SOURCE
143 SOURCE
144 そのコマンドを使うには、<Ctrl>キーをシフトキーとして押しながら操作する
145 押しつぶす音が聞こえる。
146 閉じた落とし格子に向かって転がった！
147 それをすり抜けた！
148 跳ね橋が閉じてくる……
149 水しぶきの音が聞こえる。
150 鎖が鳴り、歯車が回る音が聞こえる。
151 砕ける音と押しつぶす音が聞こえる。
152 歯車が回り、鎖が鳴る音が聞こえる。
153 跳ね橋が崩壊した！
154 押しつぶす音が聞こえる。
155 SOURCE
156 ガラガラ！　周囲で天井が崩れた！
157 祭壇は硬すぎて壊せない。
158 梯子は壊そうとする力に耐えた。
159 玉座は硬すぎて壊せない。
160 この木は石になっているようだ。
161 振り下ろしたが、的を外した。
162 掘ってできた破片が動き出した！
163 ペットに引き戻された！
164 下へ落ちていく……
165 跳ね橋は硬すぎて掘れないようだ。
166 ドカーン！　岩が落ち込んだ！
167 玉座は硬すぎて壊せない。
168 祭壇は硬すぎて壊せない。
169 卑劣な墓荒らしになったように感じた！
170 尊き死者の眠りを妨げた！
171 この墓の神聖さを汚した！
172 死体を掘り出した。
173 墓には何も入っていない。奇妙だ……
174 てこの力が十分に働かない。
175 ガツン！
176 そこには蜘蛛の巣がある！
177 ガン！
178 バシャッ！
179 木を切り倒すには斧が必要だ。
180 岩を掘るにはつるはしが必要だ。
181 落とし穴の間にある破片を片付けた。
182 「止まれ、破壊者め！　逮捕する！」
183 岩が崩れる音が聞こえる。
184 思いがけない隙間風を感じた。
185 隙間風を感じた。
186 扉が完全に壊された！
187 壁が光り、その光が消えた。
188 木は震えたが、傷ついていない。
189 岩が光り、その光が消えた。
190 鉄球が埋まった！
191 罠に落ちるような感覚がした！
192 テレポートの呪文を唱えようとした。
193 ここにも隣接する場所にも、埋める物がない。
194 何も埋まっていない。
195 set_wall_type: 壁モードの問題がある位置： 
196 （怪物が行く手にいる）
197 どうせ見分けられないだろう。
198 そこには怪物が見えない。
199 怪物
200 持ち物にある特定の品
201 持ち物にある品の種類
202 床にある品の種類
203 発見一覧にある品の種類
204 現在の階層に注記を記録する
205 何に名前を付けたい？
206 別のものを見ても見分けられないだろう。
207 それについてはすでに十分知っている。
208 とても静かに移動している。
209 気付かれないほど静かに浮かんでいる。
210 とても静かに歩いている。
211 動きが遅くなった。
212 自分が自分でないように感じた。
213 お守りが崩れ去った！
214 喉を締め付ける！
215 飛び始めた。
216 毒ガスを吸っている！
217 突然、姿はそこにあるのに透明になった！
218 突然、自分の姿が見えなくなった。
219 もう見えない。
220 生まれて初めて、ものが見える！
221 ものが見える！
222 まだ見えない。
223 今は何も見えない！
224 また見えるようになった。
225 目的を果たす望みをすべて失うところを、かろうじて免れた。
226 突然恥ずかしさに襲われ、考えを変えた。
227 指輪を体に固定できない。
228 試すまでもない。
229 ……塵の山になった。
230 使い魔にできるものがないようだ。
231 嫌な予感がする。
232 引き綱がたるんだ。
233 解放された！
"""

# Exact original You_hear variants capture Underwater before Unaware. The
# presentation layer never evaluates either state. Each frame remains whole.
HEAR = {
    5: ("かすかな水しぶきの音が聞こえる夢を見ている。", "かすかな水しぶきの音がかろうじて聞こえる。"),
    6: ("地獄の業火がぱちぱちと燃える音が聞こえる夢を見ている。", "地獄の業火がぱちぱちと燃える音がかろうじて聞こえる。"),
    7: ("自分の心臓の鼓動が聞こえる夢を見ている。", "自分の心臓の鼓動がかろうじて聞こえる。"),
    8: ("かすかなタイプの音が聞こえる夢を見ている。", "かすかなタイプの音がかろうじて聞こえる。"),
    145: ("押しつぶす音が聞こえる夢を見ている。", "押しつぶす音がかろうじて聞こえる。"),
    149: ("水しぶきの音が聞こえる夢を見ている。", "水しぶきの音がかろうじて聞こえる。"),
    150: ("鎖が鳴り、歯車が回る音が聞こえる夢を見ている。", "鎖が鳴り、歯車が回る音がかろうじて聞こえる。"),
    151: ("砕ける音と押しつぶす音が聞こえる夢を見ている。", "砕ける音と押しつぶす音がかろうじて聞こえる。"),
    152: ("歯車が回り、鎖が鳴る音が聞こえる夢を見ている。", "歯車が回り、鎖が鳴る音がかろうじて聞こえる。"),
    154: ("押しつぶす音が聞こえる夢を見ている。", "押しつぶす音がかろうじて聞こえる。"),
    183: ("岩が崩れる音が聞こえる夢を見ている。", "岩が崩れる音がかろうじて聞こえる。"),
}
FEEL = {
    63: "何かが砕けたのを感じる夢を見ている。",
    88: "ページが震えるのを感じる夢を見ている。",
    97: "力が湧き上がるのを感じる夢を見ているが、何も起こらないようだ。",
    98: "気分がよくなる夢を見ている。",
    99: "活力が戻る夢を見ている。",
    101: "一瞬ひどく方向感覚を失う夢を見ている。",
    103: "一瞬体重がなくなったように感じる夢を見ている。",
    104: "力が抜けるように感じる夢を見ている……",
    105: "群衆を扇動したくなる夢を見ている。",
    106: "周囲の緊張が和らいだように感じる夢を見ている。",
    113: "鉄球に引かれるのを感じる夢を見ている。",
    169: "卑劣な墓荒らしになったように感じる夢を見ている！",
    184: "思いがけない隙間風を感じる夢を見ている。",
    185: "隙間風を感じる夢を見ている。",
    191: "罠に落ちるような感覚がする夢を見ている！",
}

def main() -> None:
    raw = SOURCE.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == EXPECTED, "Author queue changed"
    source = json.loads(raw)
    frames = {}
    for line in FRAMES.splitlines():
        if not line:
            continue
        number, text = line.split(" ", 1)
        assert int(number) not in frames
        frames[int(number)] = text
    assert set(frames) == set(range(1, 234))
    entries = []
    for index, original in enumerate(source["entries"], 1):
        assert not original["required_argument_union"]
        assert not original["typed_arguments"]
        frame = frames[index]
        if frame == "SOURCE":
            frame = original["english_whole_named_template"]
            assert not frame.strip() or index in (140, 141, 142)
        if index == 133:
            frame += "\n"  # Keep the original raw-print line break.
        variants = {}
        if index in HEAR:
            variants = dict(zip(("dream", "underwater"), HEAR[index]))
        if index in FEEL:
            variants = {"dream": FEEL[index]}
        assert set(variants) == set(original["required_helper_variants"])
        entries.append({
            "id": original["id"],
            "whole_message_ja": frame,
            "original_api": original["original_api"],
            "original_english_literal": original["original_english_literal"],
            "english_whole_named_template": original["english_whole_named_template"],
            "source_translation_review_status": "faithful-official-source-equivalent",
            "source_translation_approved": True,
            "source_argument_schema": original["typed_arguments"],
            "argument_schemas": original["required_argument_union"],
            "printf_conversions": original["printf_conversions"],
            "omitted_grammar_arguments": [],
            "helper_variant_templates_ja": variants,
            "required_source_literal_translations": [],
            "requires_public_name_or_grammar_producer": False,
            "source_capture_constraints": [
                "Use only the exact original source-selected call. No argument or core/name/RNG/state query is added.",
                "You_hear/You_feel variants use the context captured by their original helper; underwater retains priority over dreaming and original hearing suppression remains unchanged.",
                "Source-author approval does not imply native runtime integration. Original conditional and preprocessor guards remain unchanged.",
            ],
            "official_sites_reviewed": original["official_source_contracts"],
            "translation_notes": [
                "Whole Japanese frame translates only official English facts, including original jokes, indirect sensations and uncertainty.",
                "Empty messages and geometric diagram rows retain exact original bytes and whitespace. Technical identifiers and keyboard symbols remain literal.",
                "Quoted original speech retains Japanese quotation marks. No unseen entity identity or changed game rule is inferred.",
            ],
            "runtime_binding_approved": False,
            "runtime_integration": False,
            "structural_spacer": not original["english_whole_named_template"].strip(),
        })
    output = {
        "schema_version": 1,
        "category": "zero-argument",
        "batch": 1,
        "source_batch_sha256": EXPECTED,
        "provenance": source["provenance"],
        "input_regeneration_review": {
            "prior_observed_sha256": PRIOR_OBSERVED_INPUT,
            "accepted_current_sha256": EXPECTED,
            "reason": "Source-only broad engine metadata/partition regeneration; whole ordered official templates, helper variants and pinned source contracts are independently validated against original source.",
            "prior_complete_bytes_retained": False,
            "claims_byte_identical_except_provenance": False,
        },
        "authorship": "Direct whole-message Japanese translation of exact pinned official NetHack 5.0.0 source; no Japanese fork behavior.",
        "entries": entries,
        "runtime_binding_approved": False,
        "runtime_integration": False,
    }
    destination = ROOT / source["output_fragment_path"]
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"path": str(destination), "ids": len(entries), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}))

if __name__ == "__main__":
    main()
