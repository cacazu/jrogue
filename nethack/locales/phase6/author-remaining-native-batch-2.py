"""Exact source-only configuration, chronicle, dump, exit and panic frames."""
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("source_frame_author", ROOT.parent / "phase4/author-mixed-batch-2.py")
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)
author.ROOT = ROOT
author.INPUT = ROOT / "remaining-native-batch-2.json"
author.EXPECTED = "e9844c324b1dfe7e3d3206a94e63afccbc7fdfbe22ff096c4ec132fe1bebf884"
author.FRAMES = """
1 {arg_1:%s}：{arg_2:%s}
2 「{arg_1:%s}」では何も否定されていない
3 「{arg_1:%s}{arg_2:%s}」の否定の混在は不正
4 複数の職業の値を指定できるのは、一覧が否定されている場合のみ
5 不正な{arg_1:%s}「{arg_2:%s}」
6 「{arg_1:%s}」は予約済みのメニューコマンドキー
7 メニューコマンドキー「{arg_1:%s}」は品のクラス
8 {arg_1:%s}
9 {arg_1:%s}：{arg_2:%s}
10 {arg_1:%s}ウィンドウのwindowcolorsが複数回指定されている
11 windowcolorsに指定されたウィンドウの種類を認識できない：{arg_1:%s}
12 Soundlibの種類{arg_1:%s}を認識できない。選択肢は{arg_2:%s}のみ。
13 Soundlibの種類{arg_1:%s}を認識できない。選択肢は{arg_2:%s}。
14 "finish"がない
15 不明なsymキーワード
16 ウィンドウの種類{arg_1:%s}を認識できない。選択肢は{arg_2:%s}のみ。
17 ウィンドウの種類{arg_1:%s}を認識できない。選択肢は{arg_2:%s}。
18 
19 ゲーム終了：
20 また会おう…
21 {arg_1:%s}を発見した{arg_2:%s}
22 {arg_1:%s}へ永続的に改宗した
23 兜を使って{arg_1:%s}に転じた
24 祭壇に{arg_1:%s}を落として、無神論を捨てた
25 {arg_1:%s}に入った
26 {arg_1:%s}に名前を付けて、読み書きをした
27 {arg_1:%s}に「{arg_2:%s}」という名前を選んだ
28 {arg_1:%s}初めてのペット（{arg_2:%s}）を得た
29 初めて食べた――{arg_1:%s}
30 初めて動物性のもの（{arg_1:%s}）を摂取した
31 初めて肉（{arg_1:%s}）を口にした
32 {arg_1:%s}をまねて、初めて姿を変えた
33 初めて食べた（ほうれん草）
34 {arg_1:%s}を食べて、初めて動物性のものを摂取した
35 {arg_1:%s}を食べて、初めて肉を口にした
36 クッキーの中のおみくじを読んで、読み書きをした
37 初めて食べた（{arg_1:%s}）
38 {arg_1:%s}を食べて、初めて動物性のものを摂取した
39 {arg_1:%s}を食べて、初めて肉の副産物を口にした
40 初めて食べた――{arg_1:%s}
41 {arg_1:%s}を食べて、初めて動物性のものを摂取した
42 {arg_1:%s}を食べて、初めて肉を口にした
43 初めて動物性のもの（{arg_1:%s}）を摂取した
44 死を免れた（{arg_1:%s}）
45 {arg_1:%s}
46 「{arg_1:%s}」と刻んで、読み書きをした
47 経験レベル{arg_1:%d}を失った
48 すべての経験を失った
49 {arg_1:%s}経験レベル{arg_2:%d}に上がった
50 {arg_1:%s}を与えられなかった！{arg_2:%s}が{arg_3:%s}をふさわしくないと判断した
51 {arg_2:%s}から{arg_1:%s}を授かった
52 {arg_1:%s}をかじって通り抜け、初めて食べた
53 初めて殺した
54 {arg_1:%s}の位に達した（レベル{arg_2:%d}）
55 {arg_1:%s} {arg_2:%s}
56 {arg_1:%s}
57 巻物のラベルを解読して、読み書きをした
58 安全に通るため、{arg_1:%s}に{arg_2:%ld}{arg_3:%s}を渡して買収した
59 {arg_2:%s}{arg_3:%s}を{arg_1:%s}{arg_4:%s}
60 {arg_1:%s}{arg_2:%s}が{arg_3:%s}{arg_4:%s}
61 初めて殺した
62 {arg_1:%s}{arg_2:%s}{arg_3:%s}忠実な{arg_4:%s}を殺害した
63 {arg_1:%s}を倒した。{arg_2:%s}かつての{arg_3:%s}
64 LUASTATS PCAL {arg_1:%d}:{arg_2:%s} {arg_3:%ld}
65 LUASTATS PMEM {arg_1:%d}:{arg_2:%s} {arg_3:%lu}
66 LUASTATS DONE {arg_1:%d}:{arg_2:%s} {arg_3:%ld}
67 LUASTATS DMEM {arg_1:%d}:{arg_2:%s} {arg_3:%lu}
68 たった今、{arg_1:%s}保持の袋を爆発させた
69 たった今、{arg_1:%s}保持の袋を傾けて爆発させた
70 {arg_2:%s}へ{arg_1:%s}
71 新たな{arg_2:%s}として経験レベル{arg_1:%d}になった
72 {arg_1:%s}になって、初めて姿を変えた
73 {arg_1:%s}初めての品を変化させた
74 {arg_1:%s}から「エルベレスの御手」の称号を授かった
75 {arg_1:%s}均衡の使者になった
76 {arg_2:%s}の栄光のために{arg_1:%s}よう選ばれた
77 {arg_1:%s}を授かった
78 {arg_1:%s}手にしていた{arg_2:%s}が{arg_3:%s}へと変化した
79 {arg_2:%s}から{arg_1:%s}を授かった
80 {arg_2:%s}の祭壇に{arg_1:%s}を捧げて、無神論を捨てた
81 祈って、無神論を捨てた
82 アンデッドを退散させて、無神論を捨てた
83 {arg_1:%s}に相談して、無神論を捨てた
84 {arg_1:%s}からクエストを追放された
85 {arg_1:%s}からクエストの奥へ進む許可を得た
86 おみくじクッキーを読んで、読み書きをした
87 {arg_1:%s}を読んで、読み書きをした
88 クレジットカードを読んで、読み書きをした
89 魔法のマーカーを読んで、読み書きをした
90 硬貨の刻印を読んで、読み書きをした
91 オーディンの神聖な署名を読んで、読み書きをした
92 キャンディーの包み紙を読んで、読み書きをした
93 クラス単位の虐殺を断った
94 {arg_1:%s}初めての虐殺を行った（クラス{arg_2:%c}）
95 クラス{arg_1:%c}を虐殺した
96 虐殺を断った
97 {arg_1:%s}初めての虐殺を行った（{arg_2:%s}）
98 {arg_1:%s}を虐殺した
99 {arg_3:%s}{arg_4:%s}から{arg_1:%ld}{arg_2:%s}相当の商品を盗んだ
100 {arg_1:%s}を読んで、読み書きをした
101 倉庫番の{arg_1:%d}番目の階をクリアした
102 初めて手にした武器（{arg_1:%s}）で当てた
103 {arg_1:%s}を書いて、読み書きをした
104 {arg_1:%s}初めての物を変化させた
105 願いを断った
106 {arg_1:%s}初めての願いをした――{arg_2:%s}
107 {arg_1:%s}初めてのアーティファクトの願いをした――{arg_2:%s}
108 {arg_1:%s}を願った
109 メモリ割り当て失敗。{arg_1:%u}バイトを確保できない
110 メモリ割り当て失敗。{arg_1:%u}バイトまで拡張できない
111 {arg_3:%s}の{arg_2:%d}行目で{arg_1:%u}バイトを確保できない
112 {arg_3:%s}の{arg_2:%d}行目で{arg_1:%u}バイトまで拡張できない
113 nhdupstr：文字列長のオーバーフロー（{arg_2:%s}の{arg_1:%d}行目）
114 dupstr：文字列長のオーバーフロー
115 dupstr_n：文字列が長すぎる
116 {arg_1:%s}:{arg_2:%d}でオーバーフロー
117 {arg_1:%s}:{arg_2:%d}でオーバーフロー
118 bot2：第2ステータス行がMAXCOを超えている（{arg_1:%u} > {arg_2:%d}）
119 初期化前のbot
120 初期化前のstatus 'reassess'
121 compare_blstat：不正なistatポインター{arg_1:%s}、{arg_2:%s}
122 compare_blstat：無効なポインター{arg_1:%s}、{arg_2:%s}
123 {arg_1:%s}：{arg_3:%d}バイト中{arg_2:%zu}バイトの位置でバッファを切り詰めた
124 tmp_at：tglyphが初期化されていない
125 flooreffects：objが解放状態ではない
126 鎧として着用されていない鎧を着ている？[{arg_1:%08lx}]
127 未来の時刻からのcatchup？
128 階の情報数（{arg_1:%d}）が割り当て済みサイズを超えている
129 ダンジョン記述ファイルが途中でEOFになった！<CRLF>{arg_1:%d}バイトを期待したが、{arg_2:%d}バイトだった。
130 名前「{arg_1:%s}」に対応するダンジョン番号を解決できなかった。
131 find_branch：{arg_1:%s}が見つからない
132 parent_dnum：分岐を解決できなかった。
133 level_range：連結先の階が空！
134 level_range：基準値が範囲外
135 insert_branch：見つからない
136 pick_level：有効な階を使い果たした
137 階{arg_1:%s}を{arg_2:%s}に連結できなかった
138 dungeon[{arg_1:%i}].levels[{arg_2:%i}]はハッシュではない
139 init_dungeon：特別な階が多すぎる
140 分岐{arg_1:%s}を階{arg_2:%s}に連結できなかった
141 dungeon[{arg_1:%i}].branches[{arg_2:%i}]はハッシュではない
"""
author.LITERALS = {
    "": "", "!": "!", "re": "再び", "a boulder": "岩塊", "a tree": "木", "rock": "岩",
    "iron bars": "鉄格子", "a door": "扉", "zorkmid": "ゾークミッド", "zorkmids": "ゾークミッド",
    ", ": "、", "the": "", "and": "そして", "polymorphed": "変身した", "transformed": "変化した",
    "a T-shirt": "Tシャツ", "an apron": "エプロン", "a dunce cap": "劣等生の帽子",
    "a cornuthaum": "魔法使いの帽子", "a book": "本", "a scroll": "巻物", "config_error_add": "config_error_add",
}
author.main(newline_suffix=(), newline_both=(), grammar_omissions=(), technical=(), compound=(),
            hallucination=(), decompression=(), extra_notes={
                18: ["An exact empty dump spacer remains empty; it is not a missing Japanese message."],
                55: ["The achievement table clause and selected public object label require separate source-selected producer events. An opaque achievement phrase remains whole English."],
                59: ["Preserve source-selected killed/destroyed verb, shopkeeper detail and extra qualifier. Japanese verb at sentence end needs completed inflection provenance, not a raw English lemma."],
                60: ["Passive Japanese must retain original killed/destroyed choice and qualifier. Unsupported original completed verb remains whole English."],
                62: ["Original monster given name is a literal already logged public value. Preserve empty/name and comma selection, ownership and visible species; add no naming query."],
                63: ["Original ghost versus living former adventurer branch chooses the/and. Preserve former rank, public selected name, and conjunction without querying ghost status again."],
                64: ["LUASTATS PCAL is structured technical log syntax; separators and counters remain exact."],
                65: ["LUASTATS PMEM is structured technical log syntax; separators and counters remain exact."],
                66: ["LUASTATS DONE is structured technical log syntax; separators and counters remain exact."],
                67: ["LUASTATS DMEM is structured technical log syntax; separators and counters remain exact."],
                75: ["arg_1 is the original completed s_suffix deity phrase. It already carries Japanese possession, so this frame adds no second possessive marker."],
                99: ["arg_3 is the original completed shopkeeper possessive; preserve it once. Currency and shop-kind producers require exact original accepted log fields."],
                101: ["arg_2 is English ordinal suffix from original ordin(sokonum). Japanese 番目 realizes ordinal grammar; keep full original consumed numeric/suffix union and evaluation."],
                123: ["The exact original %zu is retained for source review. Future wasm32 catalog normalization requires explicit source/target width proof; never truncate native 64-bit size_t."],
                129: ["Preserve the original embedded CRLF, expected byte count and actual byte count. No new read or error recovery action."],
            })

output = ROOT / "remaining-native-batch-2.authored.json"
result = json.loads(output.read_text(encoding="utf-8"))
for number, entry in enumerate(result["entries"], 1):
    entry["whole_message_ja"] = entry["whole_message_ja"].replace("<CRLF>", "\r\n")
    entry["source_translation_review_status"] = "faithful-official-source-equivalent-unbound-native-channel"
    entry["translation_notes"].append("Native formatting, error collection, dump forwarding, terminal exit and chronicle filters remain original. A descriptor may reach only the original accepted public delivery; no extra UI row, log replay, history write or public hidden field is created.")
    if number == 101:
        entry["omitted_grammar_arguments"] = [{"argument": "arg_2", "reason": "Japanese 番目 realizes the ordinal suffix. Retain full original consumed argument union and original ordin evaluation."}]
    if number in (59, 60):
        entry["source_translation_approved"] = False
        entry["translation_notes"].append("Whole-frame wording is a source-only composition draft. Completed killed/destroyed tense and passive morphology must be certified before this Japanese binding may be enabled.")
result["authorship"] = "Direct Japanese source review of exact configuration, accepted chronicle, dump, exit and panic frames; no runtime approval."
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"final_ids": len(result["entries"]), "final_sha256": hashlib.sha256(output.read_bytes()).hexdigest()}))
