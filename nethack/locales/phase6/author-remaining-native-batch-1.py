"""Whole source-only Japanese configuration diagnostics, exact typed union."""
import importlib.util
import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("source_frame_author", ROOT.parent / "phase4/author-mixed-batch-2.py")
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)
author.ROOT = ROOT
author.INPUT = ROOT / "remaining-native-batch-1.json"
author.EXPECTED = "b584f2ac0bb7ee64c718c9f4d70a40fff0399c8562ab0b79669ee1376f41279f"
author.FRAMES = """
1 不明なステータス項目「{arg_1:%s}」
2 {arg_1:%s}'{arg_2:%s}{arg_3:%d}{arg_4:%s}'{arg_5:%s}
3 {arg_1:%s}'{arg_2:%s}{arg_3:%ld}'{arg_4:%s}
4 項目「{arg_1:%s}」は数値に対応していない
5 「{arg_1:%s}」にはパーセントを使えない
6 hilite_status：不正なパーセント値「{arg_1:%s}{arg_2:%d}%」
7 不正な色「{arg_1:%d} {arg_2:%d}」
8 不明な状態異常「{arg_1:%s}」
9 状態異常の指定がない
10 色と属性の指定がない
11 不正な色{arg_1:%d}
12 CHOOSEのないセクション「[{arg_1:%s}]」
13 SEDUCEの値が不正
14 MAXPLAYERSの値が不正（最大25）
15 PERSMAXの値が不正（最小1）
16 PERS_IS_UIDの値が不正（0または1でなければならない）
17 ENTRYMAXの値が不正（最小10）
18 POINTSMINの値が不正（最小1）
19 MAX_STATUENAME_RANKの値が不正（最小1）
20 LIVELOGの値が不正（0から0xFFFFの間でなければならない）。
21 PANICTRACE_LIBCの値が不正（0、1、2ではない）
22 PANICTRACE_GDBの値が不正（0、1、2ではない）
23 GDBPATHに指定されたファイルが存在しない
24 GREPPATHに指定されたファイルが存在しない
25 ACCESSIBILITYの値が不正（0、1ではない）
26 PORTABLE_DEVICE_PATHSの値が不正（0、1ではない）
27 PORTABLE_DEVICE_PATHSには対応していない
28 ROGUESYMBOLSの定義「{arg_1:%s}」にエラー
29 SYMBOLSの定義「{arg_1:%s}」にエラー
30 設定文ではない。「=」がない
31 不明な設定文
32 行が長すぎるため、読み飛ばす
33 書式はCHOOSE=section1,section2,...
34 選択する設定セクションがない
35 nethackrcファイル名「{arg_1:%.40s}」...が長すぎるため、既定を使う
36 マウスボタンが不正。有効な範囲は1-{arg_1:%i}
37 {arg_1:%s}
38 「{arg_1:%s}」にはパラメーターが必要
39 必須パラメーターは空にできない
40 「{arg_1:%s}」はパラメーターを取らない
41 {arg_1:%s}
42 不明な色「{arg_1:%.60s}」
43 不明なテキスト属性「{arg_1:%.50s}」
44 {arg_1:%s}：{arg_2:%s}
45 MENUCOLORの書式が不正
46 不明なオプション：{arg_1:%.60s}
47 許可されていない値：{arg_1:%.60s}
48 必須の値がない：{arg_1:%.60s}
49 不正なwizkitの品：「{arg_1:%.60s}」
50 シンボル集合「{arg_1:%s}」の終端指定がない
51 未実装のカスタマイズ機能のため、今は無視する
52 オプションが長すぎる。最大{arg_1:%i}文字
53 空の設定文
54 オプション{arg_1:%s}が曖昧。区別するには{arg_2:%d}文字必要
55 不正なオプション接尾辞の変種「{arg_1:%s}」
56 不明なオプション「{arg_1:%s}」
57 不明な{arg_1:%s}「{arg_2:%s}」
58 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
59 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
60 「{arg_1:%s}」の不正な値：「{arg_2:%s}」
61 「{arg_1:%s}」の値の組み合わせが不正：'none'と何かを併記
62 岩のシンボルには制御文字を使えない
63 不正なオプション - 岩のシンボル「{arg_1:%s}」は{arg_2:%s}のシンボルと衝突する
64 「{arg_1:%s}」にはもう対応していない。代わりにS_boulder:cを使う
65 crash_urlmaxの値{arg_1:%d}が不正。最小値は75。
66 シンボル集合{arg_1:%s}を読み込めなかった。
67 「{arg_1:%s}」にはもう対応していない。代わりに'symset:{arg_2:%s}'を使う
68 シンボル集合{arg_1:%s}を読み込めなかった。
69 「{arg_1:%s}」にはもう対応していない。代わりに'symset:{arg_2:%s}'を使う
70 {arg_1:%s}の不明なパラメーター「{arg_2:%c}」
71 不明な{arg_1:%s}「{arg_2:%s}」
72 hilite_statusには値が必須
73 「{arg_1:%s}」には対応していない
74 シンボル集合{arg_1:%s}を読み込めなかった。
75 「{arg_1:%s}」にはもう対応していない。代わりに'symset:{arg_2:%s}'を使う
76 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
77 {arg_1:%s}の不正なパラメーター「{arg_2:%s}」
78 {arg_1:%s}の不正なパラメーター「{arg_2:%s}」
79 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
80 {arg_1:%s}の不正なパラメーター「{arg_2:%s}」
81 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
82 {arg_1:%s}の不正なパラメーター「{arg_2:%s}」
83 パレットのパラメーター「{arg_1:%s}」にエラー
84 非推奨の{arg_1:%s}prayconfirmオプションはパラメーターを取らない（「{arg_2:%s}」を検出）
85 {arg_1:%s}prayconfirmオプションは非推奨。{arg_2:%s}:{arg_3:%c}prayに切り替える
86 !{arg_1:%s}は値を受け付けない
87 {arg_1:%s}には値が必要。すべて取り消すには'none'を使う
88 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
89 {arg_1:%s}：perm_inventモード「{arg_2:%s}」は利用できないため、「{arg_3:%s}」を使う
90 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
91 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
92 認識できないペットの種類「{arg_1:%s}」。
93 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
94 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
95 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
96 「{arg_1:%s}」の不正な値：{arg_2:%s}
97 不明な{arg_1:%s}「{arg_2:%s}」
98 「{arg_2:%s}」からシンボル集合「{arg_1:%s}」を読み込めない
99 不明な{arg_1:%s}「{arg_2:%s}」
100 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
101 {arg_1:%s}には値が必須
102 {arg_1:%s}:topと{arg_2:%s}:aroundの値は負にできない
103 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
104 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
105 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
106 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
107 「{arg_1:%s}」には対応していない
108 「{arg_1:%s}:{arg_2:%s}」は不正。2または3でなければならない
109 「{arg_2:%s}」からシンボル集合「{arg_1:%s}」を読み込めない
110 {arg_2:%s}のシンボル集合ハンドラー「{arg_1:%s}」は利用できない
111 不正な{arg_1:%s}：{arg_2:%ld}
112 不正な{arg_1:%s}：{arg_2:%ld}
113 「{arg_1:%s}」には値が必要。既定の{arg_2:%d}を使う
114 「{arg_1:%s}」は1、2、4、またはそれらの二つか三つすべての合計でなければならない
115 不明なエラー処理「{arg_1:%s}」
116 不明なエラー処理「{arg_1:%s}」
117 不明なエラー処理「{arg_1:%s}」
118 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
119 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
120 不正な{arg_1:%s}（0から4の範囲であるべき）：{arg_2:%s}
121 {arg_1:%s}を「{arg_2:%s}」に設定できなかった
122 曖昧な状態異常オプション{arg_1:%s}
123 不明な状態異常オプション{arg_1:%s}（{arg_2:%d}）
124 {arg_1:%s}の不明なパラメーター「{arg_2:%s}」
125 否定された真偽値「{arg_1:%s}」にパラメーターを指定すべきではない
126 「{arg_1:%s}」は真偽値として有効ではない
127 「{arg_1:%s}」は解剖学的に不可能。
128 「{arg_1:%s}」には対応していない。
129 「{arg_1:%s}」のパラメーターがない
130 「{arg_1:%c}」は品のクラスではない
131 品のクラス「{arg_1:%c}」は許可されていない
132 品のクラス「{arg_1:%c}」が重複している
133 {arg_1:%s}={arg_2:%s} 将来のバージョンへの不正な参照を無視した
134 マウスボタン{arg_1:%i}の割り当てにエラー
135 不明なキー割り当てのキー「{arg_1:%s}」
136 不正なメニューキー{arg_1:%s}:{arg_2:%s}
137 不明なキー割り当てのコマンド「{arg_1:%s}」
138 {arg_1:%s}：{arg_2:%s}
139 不明なメッセージ型「{arg_1:%s}」
140 MSGTYPEの書式が不正
141 {arg_1:%s}
"""
author.LITERALS = {"": "", "%": "%", "<": "<", "<=": "<=", ">": ">", ">=": ">=", "=": "=",
                   "unknown": "不明", "monster": "怪物", "warning": "警告", "!": "!", "font": "font"}
author.main(newline_suffix=(), newline_both=(), grammar_omissions=(), technical=(), compound=(),
            hallucination=(), decompression=(), extra_notes={
                35: ["Original %.40s exposes only its byte-bounded filename prefix. No full undisplayed filename may be serialized; unsupported prefix capture stays native English."],
                42: ["Original %.60s exposes only its byte-bounded supplied color token. No hidden suffix is serialized."],
                43: ["Original %.50s exposes only its byte-bounded attribute token. Preserve exact public substring or whole English fallback."],
                63: ["Only the original clash result selects monster/warning. Do not recompute symbol conflicts or infer a hidden creature."],
                84: ["Negation mark and supplied parameters are configuration syntax; preserve original tokens and parse behavior."],
                85: ["The original deprecated-option migration occurs only in original C. Japanese describes the same selected !/empty prefix and command character, without changing settings."],
                124: ["font is the native option identifier and remains literal; it is not a translatable game-world noun."],
            })

# These diagnostics contain configuration tokens, not general monster/object
# naming requests. Their text producers still require source provenance.
output = ROOT / "remaining-native-batch-1.authored.json"
result = json.loads(output.read_text(encoding="utf-8"))
for entry in result["entries"]:
    entry["source_translation_review_status"] = "faithful-official-source-equivalent-unbound-diagnostic"
    entry["translation_notes"].append("Option identifiers, filenames, command keys and supplied values remain literal configuration syntax. Explanatory diagnostic fragments require source-selected IDs; complete native %s buffers must be traced to original construction, never translated by matching completed English.")
    for producer in entry["required_public_name_or_grammar_producers"]:
        producer["required_contract"] = "Capture the original consumed public configuration token/value or source-selected explanatory fragment once. Raw command identifiers/user input remain exact. A complete diagnostic buffer requires its original construction events, not a live-English lookup. Preserve original line/quote/byte precision, error collection, parser state and eventual window owner; no new parse, field or name query. Unsupported capture uses complete original English."
        producer["japanese_rendering_requirement"] = "Preserve the original public syntax tokens and values verbatim. Translate only source-identified explanatory clauses and selected diagnostic labels into the whole Japanese frame."
result["authorship"] = "Direct Japanese translation of exact official configuration diagnostics; parser tokens and typed contracts unchanged."
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"final_ids": len(result["entries"]), "final_sha256": hashlib.sha256(output.read_bytes()).hexdigest()}))
