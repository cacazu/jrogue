"""Source-only Japanese fatal diagnostics; original native effects unchanged."""
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("source_frame_author", ROOT.parent / "phase4/author-mixed-batch-2.py")
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)
author.ROOT = ROOT
author.INPUT = ROOT / "remaining-native-batch-3.json"
author.EXPECTED = "89b90a1bb3d98f251198f8f728c503ef4ebc4c17ef8c45193483ad71677adc33"
author.FRAMES = """
1 init_dungeon：分岐が多すぎる
2 dungeon[{arg_1:%i}].levelsはハッシュの配列ではない
3 dungeon[{arg_1:%i}].branchesはハッシュの配列ではない
4 dungeonはLuaテーブルではない
5 init_dungeons：ダンジョンが多すぎる
6 dungeon[{arg_1:%i}]はLuaテーブルではない
7 init_dungeon：階を配置できなかった
8 階番号が範囲外 [ledger_to_dnum({arg_1:%d})]
9 get_level：親ダンジョンが見つからない
10 dgn_entrance：{arg_1:%s}への入口が見つからない
11 docompress_fileでエラー{arg_1:%d}
12 zlibのdocompress_fileでエラー{arg_1:%s}、{arg_2:%d}
13 glyphid_cacheが満杯
14 parse_id：buf[0]がオーバーフローした
15 rounddivでゼロ除算
16 文字列が長すぎる
17 addinv：objが解放状態ではない
18 addinv：矢筒の統合後にobjがnull otyp={arg_1:%d}
19 addinv：統合後にobjがnull otyp={arg_1:%d}
20 光源を{arg_1:%d}個数えたが、{arg_2:%d}個書き込んだ！[range={arg_3:%d}]
21 relink_light_sources：IDの対応がない
22 relink_light_sources：{arg_1:%c}_id {arg_2:%u}が見つからない
23 relink_light_sources：不正な種類（{arg_1:%d}）
24 光源の整合性異常：IDがない！
25 光源の整合性異常：obj #{arg_1:%u}が見つからない！
26 光源の整合性異常：mon #{arg_1:%u}が見つからない！
27 光源の整合性異常：不正なlsの種類{arg_1:%d}
28 武器が統合された？
29 階に部屋が多すぎる
30 階に副部屋が多すぎる
31 部屋に副部屋が多すぎる
32 mz_move：不正な方向{arg_1:%d}
33 wall_cleanup：不正な境界（{arg_1:%d},{arg_2:%d}）から（{arg_3:%d},{arg_4:%d}）
34 wall_extends：不正な境界（{arg_1:%d},{arg_2:%d}）から（{arg_3:%d},{arg_4:%d}）
35 walkfromでオーバーフロー
36 mazexy：場所が見つからない！
37 movebubbles：cons != null
38 setup_waterlevel()：[{arg_1:%d}:{arg_2:%d}]は'Water'でも'Air'でもない
39 bmaskのサイズがMAX_BMASKを超えている
40 splitobj [cobj={arg_1:%s} num={arg_2:%ld} quan={arg_3:%ld}]
41 replace_object：objの位置
42 mksobjが種類{arg_1:%d}、クラス{arg_2:%d}を作ろうとした。
43 place_object：obj「{arg_1:%s}」[{arg_2:%d}]が解放状態ではない
44 remove_object：obj where={arg_1:%d}、床の上ではない
45 obj_extract_self, where={arg_1:%d}
46 extract_nobj：物が失われた
47 extract_nexthere：物が失われた
48 add_to_minv：obj where={arg_1:%d}、解放状態ではない
49 add_to_container：obj where={arg_1:%d}、解放状態ではない
50 add_to_migration：obj where={arg_1:%d}、解放状態ではない
51 add_to_buried：obj where={arg_1:%d}、解放状態ではない
52 dealloc_obj：objが解放状態ではない（type={arg_1:%d}, where={arg_2:%d}）
53 nobjを持つdealloc_obj
54 cobjを持つdealloc_obj
55 dobjsfree：obj where={arg_1:%d}、OBJ_DELETEDではない
56 整合性検査に失敗：容器が自分自身を入れている
57 整合性検査に失敗：容器が親を入れている
58 不正なmonデータ{arg_1:%s}；mnum={arg_2:%d}（{arg_3:%s}）
59 relmon：fmonが存在しない。
60 relmon：monが一覧にない。
61 {arg_1:%s}上のnmonを持つdealloc_monst
62 thitu：nameとobjが両方null？
63 nh luacoreが初期化されていない
64 nh luacoreが初期化されていない
65 nh luacoreが初期化されていない
66 Luaの制限時間を超えた{arg_1:%d}:{arg_2:%s}
67 Luaエラー{arg_1:%d}:{arg_2:%s} {arg_3:%s}
68 サンドボックスが認識できないLuaバージョン：this={arg_1:%d} != expected={arg_2:%d}<SPACE>
69 start_luapat：{arg_1:%d}
70 io.openをフックできない
71 Lua API呼び出し中の保護されていないエラー（{arg_1:%s}）
72 lua_newstateがNULL
73 init_objects：汎用品#{arg_1:%d}のクラスが一致しない（{arg_2:%d}）
74 objects[{arg_1:%d}]のクラス#{arg_2:%d}が順序どおりではない！
75 xcalled：接頭辞の領域が足りない（{arg_1:%d} > {arg_2:%d}）
76 xname：名前の追加前にバッファがオーバーフロー。
77 doname：長い品の説明がオーバーフロー。
78 不正なインデックスroleoptvals[{arg_1:%d}][{arg_2:%d}]
79 delta_cwt：objが容器の中にない？
80 in_container：袋が見つからない。
81 plineが{arg_1:%d}文字を出力しようとしている！
82 impossibleがimpossibleを呼び出した
83 {arg_1:%s}
84 convert_line：オーバーフロー
85 rectを割り当てられなかった
86 restlevelfile：{arg_1:%s}
87 getlev：必要な転移門が見つからない
88 restore_gamelog：メッセージが大きすぎる（{arg_1:%d}）
89 restore_msghistory：メッセージが大きすぎる（{arg_1:%d}）
90 init_isaac64()に不正なrng関数が渡された。
91 職業選択ウィンドウを作成できなかった
92 savelev：今どこにいる？
93 不正なファイルへの保存！
94 バッファリングはすでに有効
95 ファイル{arg_1:%d}のバッファリングに失敗
96 保存ファイルのフラッシュに失敗！
97 ファイル#{arg_2:%d}に{arg_1:%u}バイトを書き込めない
98 階ファイルの読み込みエラー。
99 add_to_billobjs：objが解放状態ではない
100 {arg_2:%s}の店の品の確率の合計が{arg_1:%d}！
101 店の確率の合計が{arg_1:%d}！
102 shkveg：野菜の品がない
103 shkveg：probtypeエラー、oclass={arg_1:%d} i={arg_2:%d}
104 shkname：店主「{arg_1:%s}」に'eshk'データがない。
105 activate_chosen_soundlib：不正なsoundlib（{arg_1:%d}）
106 assign_soundlib：不正なsoundlib（{arg_1:%d}）
107 get_soundlib_name：不正なactive_soundlib（{arg_1:%d}）
108 mapfragの外（{arg_1:%i},{arg_2:%i}）、求めたのは（{arg_3:%i},{arg_4:%i}）
109 get_room_loc：場所が見つからない！
110 get_free_room_loc：場所が見つからない！
111 create_monster：不明な怪物のクラス'{arg_1:%c}'
112 create_object：予期しない品のクラス'{arg_1:%c}'
113 search_door：不正な壁！
114 部屋の入れ子が深すぎる？！
115 鞍が統合された？
116 {arg_1:%s}:{arg_2:%d} 文字列が長すぎる
117 設定エラー：PERS_IS_UIDは0か1でなければならない
118 start_timer（{arg_1:%s}: {arg_2:%d}）
119 obj_move_timers
120 write_timer
121 obj_is_local
122 timer_is_local
123 relink_timers 1
124 o_id {arg_1:%d}が見つからない
125 relink_timers：怪物のタイマーは実装されていない
126 relink_timers 2
127 rest_track：ptの数があり得ない
128 deltrap：先行する罠がない！
129 職業の技能が見つからない
130 steal_it：着用中の鎧が複数ある
131 fakecorrのオーバーフロー
132 view_fromが範囲{arg_1:%d}で呼び出された
133 do_clear_area：不正な範囲{arg_1:%d}
134 lose_weapon_skill（{arg_1:%d}）
135 drain_weapon_skill（{arg_1:%d}）
136 choose_classes_menu：不正なmonclass '{arg_1:%c}'
137 choose_classes_menu：不正なobjclass '{arg_1:%c}'
138 choose_classes_menu：不正なcategory {arg_1:%d}
139 クラッシュテスト（#panic）。
140 reviveの既定ケース{arg_1:%d}
141 'nhl_init'に失敗。続行できない。
"""
author.LITERALS = {"(null)": "(null)", "(unknown)": "（不明）", "non-empty container": "中身のある容器"}
author.main(newline_suffix=(71,), newline_both=(), grammar_omissions=(), technical=(),
            compound=(), hallucination=(), decompression=(), extra_notes={
                38: ["Water/Air are the original dungeon level identifiers, retained exactly; no gameplay region query is added."],
                40: ["cobj/num/quan are technical diagnostic field labels. Preserve exact brackets, public selected values and numeric signedness."],
                68: ["The original terminal space remains a terminal space. Lua version validation is unchanged."],
                71: ["Preserve the original final newline; Lua API error behavior, exit and reporting stay original."],
                83: ["Opaque formatted panic buffers require their original construction event chain. Never match completed English to a translation."],
                104: ["Original already selected shopkeeper name stays literal or comes from its public producer. Do not call shkname again or expose a new hidden field."],
                119: ["Original message consists solely of a code identifier, retained exactly to identify the failed operation."],
                120: ["Original message consists solely of a code identifier, retained exactly to identify the failed operation."],
                121: ["Original message consists solely of a code identifier, retained exactly to identify the failed operation."],
                122: ["Original message consists solely of a code identifier, retained exactly to identify the failed operation."],
                123: ["Original message is an operation identifier and diagnostic stage number, both retained exactly."],
                126: ["Original message is an operation identifier and diagnostic stage number, both retained exactly."],
                139: ["The original #panic crash test remains an explicit native action. Translation does not execute or suppress it."],
            })

output = ROOT / "remaining-native-batch-3.authored.json"
result = json.loads(output.read_text(encoding="utf-8"))
for entry in result["entries"]:
    entry["whole_message_ja"] = entry["whole_message_ja"].replace("<SPACE>", " ")
    entry["source_translation_review_status"] = "faithful-official-source-equivalent-unbound-fatal-diagnostic"
    entry["translation_notes"].append("Preserve original fatal-error ownership, shutdown, recovery/reporting, file operations and selected code identifiers. Emit only at the original accepted raw_print/delivery leaf, with exact consumed fields and native truncation guard. No new diagnostic row, state query or repair operation.")
result["authorship"] = "Direct Japanese review of exact official fatal diagnostics; original technical identifiers and channel preserved."
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"final_ids": len(result["entries"]), "final_sha256": hashlib.sha256(output.read_bytes()).hexdigest()}))
