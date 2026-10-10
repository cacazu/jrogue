#!/usr/bin/env python3
"""Source-only whole Japanese frames for prepared English zero-argument batch 3."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUTHORED = r"""0|落とし穴の縁越しには手が届かない。
1|あなたが邪魔になっている！
2|跳ね橋はすでに閉まっている。
3|跳ね橋を閉じる方法は見当たらない。
4|この出入口には扉がない。
5|この扉は壊れている。
6|この扉はすでに閉まっている。
7|体が小さすぎて、扉を押して閉められない。
8|扉が閉まった。
9|扉はびくともしない！
10|ゴトン！
11|カチッ！
12|壁に扉が現れた！
13|シュッという音が聞こえる。
14|出入口が消えた！
15|ドカーン！！ 扉が爆発するのが見えた。
16|扉が激しい音を立てて開いた！
17|激しくぶつかる音が聞こえる。
18|「すみません。」
19|「ここは混みすぎだ。もう出ていく！」
20|「受け取って！」
21|残念ながら、何と書いてあるか見えない。
22|全部でたらめな文字に見える。
23|int mongen_order[] = {{
24|
25|}};
26|炎に包まれた。
27|しかし、その効果に抵抗した。
28|霜に覆われた。
29|飛び道具の雨が降り注いできた！
30|飛び道具は跳ね返った！
31|生命力が抜けていくのを感じる……
32|以前より死んでいるわけではないようだ。
33|幽体離脱を体験した。
34|幸運なことに、効果はなかった！
35|災難が二倍に……
36|力の場があなたを取り囲んだ！
37|皮膚がかゆい。
38|一瞬、弱くなった気がする。
39|突然、弱くなった気がする！
40|一瞬、方向感覚を失った気がする。
41|突然、どこからともなく噴き出した間欠泉があなたを直撃した！
42|火柱があなたの周囲一帯を襲った！
43|頭上から稲妻が落ちてきた！
44|脳が燃えている！
45|一瞬、皮膚がひどくかゆくなった。
46|体に傷が現れた！
47|体にひどい傷が現れた！
48|体が痛々しい傷に覆われた！
49|一瞬、体がこわばった。
50|その場で体が動かなくなった！
51|一瞬、めまいを感じる。
52|怪物たちに自分の存在を気づかれたような気がする。
53|助けが必要な気がする。
54|しかし何も起こらない。
55|しかし、誰も来ない。
56|誰か、そろそろヘビの髪を刈ったほうがよさそうだ。
57|火が熱く感じられない！
58|誰かがあなたを愛撫する……
59|そして、それをあなたの指にはめた。
60|エネルギーが抜けていくのを感じる。
61|気分が落ち込んでいる。
62|感覚が鈍くなった。
63|体力が落ちた気がする。
64|妙な感じがする……
65|疲れ果てた気がする。
66|持てる力がすべて引き出された気がする。
67|もう一度できそうなくらい調子がいい。
68|とても勉強になる経験だった。
69|健康を取り戻した気がする！
70|「サービスだ！」
71|代金は不要だ。
72|あなたは爆発した！
73|「汝、その軽率な行いの代償を払うがよい！」
74|緊張が高まるのを感じる。
75|あなたは拒んだ。
76|「争いを望むのなら、もっとくれてやろう！」
77|声が轟いた：
78|轟くような声を感じる：
79|「汝の争いへの望みは満たされるであろう！」
80|声がささやいた：
81|静かな声を感じる：
82|「汝は我にふさわしい者であった！」
83|近くに天使が現れた。
84|近くに友好的な天使がいるのを感じる。
85|足元の床が激しく揺れた！
86|周囲の壁が曲がり、崩れ始めた！
87|下に続く階段の一番上に立っている！
88|水の乱れがあなたの動きに影響している。
89|床の一部が溶けているのが見える！
90|背負い袋が手を伸ばし、何かをつかんだ！
91|かすかな水音が聞こえる。
92|バリバリとかむ音が聞こえる。
93|すする音が聞こえる。
94|むしゃむしゃとかむ音が聞こえる。
95|しかし、待った……
96|メダリオンが砕けて塵になった！
97|一瞬、悲しい気持ちになったが、すぐに消えた。
98|爆発音が聞こえる。
99|そうでもないかもしれない……
100|一瞬、悲しい気持ちになったが、すぐに消えた。
101|人殺しめ！
102|罪悪感を感じる……
103|たぶん、まずい考えだった……
104|おっとっと！
105|遠くで雷が鳴る音が聞こえる……
106|スタジオの観客が拍手する音が聞こえる！
107|……そして元に戻った。
108|包囲されているような気がする。
109|「止まれ！ お前を逮捕する！」
110|そして逃げ始めた。
111|自分が偽善者のように感じられる。
112|足元の刻印が薄れていく。
113|それには変化できない。
114|牛のにおいに気づいた。
115|体臭がする。
116|動物の巣を思わせるにおいがする。
117|蒸気のにおいがする。
118|キノコのにおいがする。
119|犬のにおいに気づいた。
120|ドラゴンのにおいがする！
121|腐った肉のにおいがする。
122|魚のにおいがする。
123|魅力的なにおいに気づいた。
124|悪臭で少し吐き気がする。
125|ドカーン！！ 扉が爆発するのが見えた。
126|誰かが叫ぶ声が聞こえる：
127|大岩が崩れた。
128|解放された！
129|「まぶしい光だ！」
130|かすかな精神エネルギーの波を感じる。
131|精神エネルギーの波があなたに押し寄せた！
132|とても心地よく感じられる。
133|扉が解錠されて開くのが見える。
134|扉が解錠されて開く音が聞こえる。
135|扉が開くのが見える。
136|扉が開く音が聞こえる。
137|扉が激しい音を立てて開くのが見える。
138|扉が激しい音を立てて開くのが聞こえる。
139|「遅刻だ！」
140|外れた。
141|あなたを傷つけた様子はない。
142|銀があなたの肉を焼く！
143|焼けるように痛い！
144|それには命中しなかった。
145|毒は致命的だった……
146|それは焼かれた！
147|うえっ！ クリームまみれになった。
148|パチンという大きな音が聞こえる！
149|近くでカラカラと乾いた音が聞こえる。
150|せきが聞こえる。
151|鉄格子が溶けた！
152|鉄格子を壊してばらばらにした！
153|「自由にしてくれたんだね！」
154|「ようやくだ。」
155|ごくごく飲む音が聞こえる。
156|起床ラッパが鳴るのが聞こえる！
157|掘削光線は効果がない。
158|ボヨーン！
159|ワンドがあなたに当たった！
160|ワンドはあなたに当たらなかった。
161|「はい、チーズ！」
162|閃光で目が見えなくなった！
163|おお、なんてきれいな火だ！
164|巻物が炎の柱を噴き上げた！
165|あなたは無傷だ。
166|おお、なんてきれいな火だ！
167|悲鳴が聞こえる！
168|それは破壊された！
169|あなたの鎖が切れた！
170|足元に裂け目が開いた！
171|中には落ちなかった！
172|裂け目に落ちた！
173|激しく揺さぶられた！
174|ドスンという音が聞こえる。
175|隠し通路が現れた。
176|隠し扉が現れた。
177|扉が崩れ落ちた。
178|不快なブーンという音を響かせた。
179|単調な振動を感じる。
180|騒々しい音を立てた。
181|不快な振動を感じる。
182|漂う蝶の、万華鏡のような光景を広げた。
183|あなたの演奏は音楽とはほど遠い……
184|角笛を吹いた。
185|ラッパを吹いた。
186|とても心地よい振動を感じる。
187|心地よい振動を感じる。
188|重々しく、雷のようにとどろく音を立てた！
189|太鼓をたたいた。
190|水中では音楽を演奏できない！
191|即興で演奏する？
192|合言葉の旋律を演奏する？
193|どんな旋律を演奏する？［5音、A～G］
194|
195|発見済みアイテムの並び順
196|
197|まだ何も発見していない……
198|発見済みアイテム
199|すべてのアーティファクトの情報を出力する？
200|まだ何も発見していない……
201|名前をつけられる発見済みアイテムはない……
202|名づけるアイテムの種類を選択
203|玉座だ。
204|流し台だ。
205|ここには墓を置けない。
206|木だ。
207|鉄格子だ。
208|雲だ。
209|壁だ。
210|隠し通路だ。
211|隠し通路には、通路の場所が必要だ。
212|部屋の床だ。
213|ここでは room、floor、ground は指定できない。
214|塊の重量制限を無視する？
215|はい、チュートリアルを行う
216|いいえ、そのままプレイを始める
217|
218|（'y' か 'n' を選んでください。）
219|チュートリアルを行う？
220|'idlecheckpoint' を支える機能はコンパイルされていない。
221|メニュー形式を選択：
222|変更する開示オプションの項目：
223|確認せず、常に開示しない
224|確認せず、常に開示する
225|常に開示し、並び順をメニューから選ぶ
226|確認する（既定の返答は「いいえ」）
227|確認する（既定の返答は「はい」）
228|確認する（既定の返答は「尋ねる」、並び順メニューを要求）
229|メニュー内のアイテム記号を何に設定する？
230|メッセージ履歴の表示方式を選択：
231|number_pad の方式を選択：
232|追加の確認が必要な操作：
233|常時表示する所持品一覧の方式を選択："""


def main():
    path = HERE / "english-primary-zero-argument-batch-3.json"
    original = json.loads(path.read_text("utf8"))
    lines = AUTHORED.splitlines()
    authored = {}
    for line in lines:
        index, text = line.split("|", 1)
        assert int(index) not in authored
        authored[int(index)] = text
    assert set(authored) == set(range(len(original["entries"])))
    entries = []
    for index, source in enumerate(original["entries"]):
        ja = authored[index]
        assert not source["typed_arguments"] and not source["required_argument_union"] and not source["printf_conversions"]
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
        notes = ["Whole Japanese frame authored against the exact official English sentence and supplied source evidence. No Japanese-fork behavior, guessed entity, hidden identity, extra native name/RNG/state query, or runtime English matching is introduced.", "Source selected helper context is immutable: dream preserves the original dreamed sensation; underwater preserves barely-heard attenuation, not a newly inferred location; blind preserves sense rather than sight. Every variant is stored as a complete Japanese sentence."]
        disposition = "authored-source-equivalent-Japanese"
        if index in [24, 194, 196, 217]:
            assert source["original_english_literal"] == source["english_whole_named_template"] == ja == ""
            disposition = "preserved-structural-spacer"
            notes.append("An exact zero-length native output row is structural layout, not missing prose. It stays empty in both locales; adding a placeholder or Japanese label would change the original output.")
        elif index in [23, 25]:
            assert ja == source["english_whole_named_template"]
            disposition = "preserved-language-independent-code"
            notes.append("Literal C initializer syntax, including catalog-escaped brace tokens, is preserved byte for byte as code. It is not invented gameplay prose.")
        if index in [218, 220, 231]:
            notes.append("Original command/option bytes y/n, idlecheckpoint or number_pad remain literal. Translation changes only the visible explanation; it never replaces native response keys, accelerators, or option identifiers.")
        if index == 56:
            notes.append("The original hallucination joke substitutes serpent for haircut. Japanese retains the snake-hair joke and unnamed 'someone'; it does not add the underlying monster identity or consult state.")
        if index == 70:
            notes.append("'On the house' is the source's free-service idiom in doseduce. Japanese states the waived charge without inventing a shop, building or new speaker identity.")
        entries.append({"id":source["id"],"whole_message_ja":ja,"original_api":source["original_api"],"original_english_literal":source["original_english_literal"],"english_whole_named_template":source["english_whole_named_template"],"source_translation_review_status":"faithful-official-source-equivalent","source_translation_approved":True,"source_argument_schema":source["typed_arguments"],"argument_schemas":source["required_argument_union"],"printf_conversions":source["printf_conversions"],"omitted_grammar_arguments":[],"helper_variant_templates_ja":variants,"required_source_literal_translations":[],"requires_public_name_or_grammar_producer":False,"localization_disposition":disposition,"source_capture_constraints":["Bind only the exact source-issued ID at the actual original output callback. Keep original C prompt choices, menu accelerators, filters/history, callback/window identity and attributes unchanged.","Capture the original selected helper variant at emission; repaint never consults current Unaware/Underwater/Blind flags. Unsupported/unproven callback binding remains exact native English fallback.","Source authoring only. Native C/Rust build and browser delivery require independent verification before any runtime approval."],"official_sites_reviewed":source["official_source_contracts"],"translation_notes":notes,"runtime_binding_approved":False,"runtime_integration":False})
    output = {"schema_version":1,"category":original["category"],"batch":original["batch"],"source_batch_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"provenance":original["provenance"],"authorship":{"kind":"authored-official-English-equivalent-Japanese","date":"2026-10-02"},"entries":entries,"runtime_binding_approved":False,"runtime_integration":False}
    target = HERE / original["output_fragment_path"]
    target.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"path":target.name,"ids":len(entries),"helper_variants":sum(len(e["helper_variant_templates_ja"]) for e in entries),"structural_spacers":4,"language_independent_code":2,"runtime_approved":0,"sha256":hashlib.sha256(target.read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
