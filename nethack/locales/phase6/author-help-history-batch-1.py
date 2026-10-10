"""Original help lines: Japanese explanations, exact ASCII controls/indentation."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "help-history-batch-1.json"
EXPECTED = "bdb3272b6c925faadc66f585213482facd4e320207dca50f36b4d5f80dd55a10"
FRAMES = """
1 NetHackへようこそ！                （バージョン3.6の説明）
2 NetHackはダンジョンズ＆ドラゴンズに似たゲームだ。あなた（冒険者）は、
3 イェンダーの魔除けを探して迷宮の奥深くへ降りていく。
4 魔除けは20階より下のどこかに隠されているという。あなたは、
5 様々な形で助けになり、いろいろなことをするよう訓練もできるペットと共に、
6 冒険を始める。途中では、役に立つ（または役に立たない）
7 品、おそらく魔法の性質を持つ品や、様々な怪物が見つかる。怪物がいる
8 場所に移動しようとすれば、その怪物を攻撃できる（だが多くの場合は、
9 放っておく方がずっと賢明だ）。
10 現在地を言葉で説明するほとんどの冒険ゲームと違い、
11 NetHackは、今いる迷宮の階を視覚的な形で
12 表示する。
13 NetHackは次の記号を使う：
14 - と |   部屋の壁。開いた扉や墓の場合もある。
15 .        部屋の床や出入口。
16 #        通路、鉄格子、木、または台所の
17          流し（その迷宮に流しがあれば）、あるいは跳ね橋。
18 >        下り階段。次の階への道。
19 <        上り階段。前の階への道。
20 @        通常はあなた。または別の人間。
21 )        何らかの武器。
22 [        一式または一部の防具。
23 %        食べられるもの（必ずしも体によいとは限らない）。
24 /        杖。
25 =        指輪。
26 ?        巻物。
27 !        薬。
28 (        その他の便利な道具（つるはし、鍵、ランプなど）。
29 $        金の山。
30 *        宝石や石（価値がある場合も、ない場合もある）。
31 +        閉じた扉、または覚えられる魔法を
32          記した魔法書。
33 ^        罠（見つけた後）。
34 "        護符、または蜘蛛の巣。
35 0        鉄球。
36 _        祭壇、または鉄の鎖。
37 {{        泉。
38 }}        水たまり、堀、または溶岩だまり。
39 \\        豪華な玉座。
40 `        岩塊、または像。
41 A～Z、a～z、およびその他の記号：怪物。
42 I        透明な怪物や見えていない怪物が最後にいた場所。
43 '/'を押して案内に従い、調べたい記号へ
44 カーソルを移動すれば、その記号が何を表すか
45 分かる。例えば'd'を調べると、
46 犬だと分かるかもしれない。
47 y k u   7 8 9   移動コマンド：
48  \\|/     \\|/            yuhjklbn: 指定した方向へ1歩進む
49 h-.-l   4-.-6           YUHJKLBN: 指定した方向へ進み、壁に
50  /|\\     /|\\                        当たるか、何かに出くわすまで続ける
51 b j n   1 2 3           g<dir>:   <dir>の方向へ走り、興味深いものが
52      テンキー                       見えるまで続ける
53 G<dir>,   同じだが、通路の分岐は興味深いものとは
54 <  上                  ^<dir>:     見なさない（ここでの^は、キャレット
55                                    記号ではなくControlキーを表す）
56 >  下                  m<dir>:   品を拾わずに移動する
57 F<dir>:   怪物を感知していなくても戦う
58 number_padオプションが設定されていれば、代わりに数字キーで移動する。
59 環境に応じて、Shiftとテンキーの数字、
60 Metaと数字、またはAltと数字でYUHJKLBNコマンドを実行できる。
61 number_padが有効な場合、Control <dir>が使えるかどうかは、
62 その環境の機能による。
63 数字'5'は'G'の接頭辞として働く。ただしnumber_padが2なら、
64 代わりに'g'として働く。
65 number_padが3なら、1,2,3と7,8,9の役割が
66 入れ替わる。4なら、3と2を組み合わせた動作になる。
67 number_padが-1なら、英字の移動コマンドを使うが、
68 'y'と'z'が入れ替わる。
69 コマンド：
70 NetHackは次のコマンドを使える：
71 ?       ヘルプメニュー。
72 /       記号が何を表すか調べる。場所を
73         指定するか、記号を引数として指定できる。autodescribeを
74         有効にすると、カーソルを移動するたびに、その場所の
75         記号についての情報が表示される。
76 &       コマンドが何をするか調べる。
77 <       階段を上る（その階段の上にいる場合）。
78 >       階段を下りる（その階段の上にいる場合）。
79 .       休む。1ターン何もしない。
80 _       最短経路の算法で地図上の地点へ移動する。
81 a       道具を使う（つるはし、鍵、ランプなど）。
82 A       すべての防具を脱ぐ。
83 ^A      前のコマンドを繰り返す。
84 c       扉を閉める。
85 C       怪物、個々の品、または品の種類に名前を付ける。
86 d       品を落とす。d7aなら、所持枠aの品を7個落とす。
87 D       複数の品を落とす。このコマンドには二つの
88         異なる方式がある。一つ目は次の通り：
89         "D"で所持品すべての一覧を表示し、その中から
90         落とす品を選ぶ。品の横の"+"は、その品を
91         落とすことを、"-"は落とさないことを
92         表す。品の説明の隣にある文字を押すと、
93         選択と選択解除が切り替わる。
94         "+"ですべて選択し、"="ですべて選択を解除する。<SPACEBAR>で
95         一覧の次のページへ進む。
96         もう一つの方式は次の通り：
97         "D"で「どんな種類の品を
98         落としたい？[!%= au]」と尋ねられる。品の記号を0個以上入力し、
99         必要ならその後に'a'や'u'を付ける。
100         Da - 確認せず、すべての品を落とす。
"""

raw = INPUT.read_bytes()
assert hashlib.sha256(raw).hexdigest() == EXPECTED
source = json.loads(raw)
frames = {int(line.split(" ", 1)[0]): line.split(" ", 1)[1] for line in FRAMES.splitlines() if line}
assert set(frames) == set(range(1, len(source["entries"]) + 1))
entries = []
for number, original in enumerate(source["entries"], 1):
    english = original["english_named_template"]
    prefix = re.match(r"[ \t]*", english).group()
    # The source line's complete leading indentation is an immutable layout token.
    japanese = prefix + frames[number].lstrip(" \t")
    notes = ["Japanese explanation of this exact original help line. Source leading indentation is retained byte-for-byte; original command letters, glyphs, Control notation, option names and argument placeholders are native syntax.", "Only the original display_file consumer may issue the selected line event. Resource percent signs are literal, braces remain escaped for the catalog; no new command, game time, state or RNG action."]
    if number == 1:
        notes.append("The pinned official help still says version 3.6. Retain that exact historical description; the runtime release provenance remains NetHack 5.0.0.")
    if number in range(47, 58):
        notes.append("Original direction diagram and adjacent command syntax are preserved. Japanese explanation never changes movement mapping or number_pad behavior.")
    entries.append({**original, "whole_message_ja": japanese, "source_review_status": "faithful-official-source-equivalent", "translation_notes": notes, "runtime_binding_approved": False})
result = {"schema_version": 1, "input_sha256": EXPECTED, "category": source["category"], "authorship": "Direct exact-source Japanese help explanations with immutable original ASCII control syntax.", "entries": entries, "runtime_binding_approved": False}
output = INPUT.with_name(INPUT.stem + ".authored.json")
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ids": len(entries), "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}))
