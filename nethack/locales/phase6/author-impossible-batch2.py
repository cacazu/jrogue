#!/usr/bin/env python3
"""Reproducible source-only Japanese frames for original impossible leaves."""
import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRAMES = r'''0|警告 - 閉じられていない fieldlevel ファイルを再初期化しようとしている
1|bones ファイルの NHFILE * に異常な fd がある（{arg_1:%d}）
2|set_savefile_name() はオーバーフローせずに完了できなかった {arg_1:%d}
3|ロックを入れ子にしようとした
4|trapmove: 何もないのに罠に捕まっている？
5|trapmove: 不明な罠に捕まっている？（{arg_1:%d}）
6|handle_tip({arg_1:%i}) に不明なヒントがある
7|おかしい。mintrap の結果が不明！
8|主人公が「{arg_2:%s}」のために {arg_1:%d} HP を失っている？
9|snprintf の{arg_1:%s}: 関数 {arg_2:%s}、ファイルの行 {arg_3:%d}
10|不明なアイテム操作 {arg_1:%d}
11|uball がないのに Punished？
12|死なずに死んでいる？
13|実績 #{arg_1:%d} が範囲外。
14|唯一の生物「{arg_1:%d}: {arg_2:%s}」が虐殺済みになっている？
15|奇妙な装着状態のアイテムをまとめようとしている（{arg_1:%lx}）
16|すでに魔除けを持っている？
17|すでに燭台を持っている？
18|すでに銀のベルを持っている？
19|すでにその書を持っている？
20|すでにクエストのアーティファクトを持っている？
21|魔除けを持っていない？
22|燭台を持っていない？
23|銀のベルを持っていない？
24|その書を持っていない？
25|クエストのアーティファクトを持っていない？
26|getobj: 所持品のオーバーフロー
27|getobj のコールバックから不正な値が返された
28|{arg_1:%s}: {arg_2:%s}{arg_3:%s}{arg_4:%s}
29|new_light_source:  範囲が不正 {arg_1:%d}
30|del_light_source:type=none
31|del_light_source: 見つからない type={arg_1:%d}, id={arg_2:%s}
32|delete_ls が見つからない。ls={arg_1:%s}
33|一時光源: {arg_1:%s}{arg_2:%s}が{arg_4:%s}ではない？
34|save_light_sources: id がない！ [range={arg_1:%d}]
35|save_light_sources: type が不正（{arg_1:%d}） [range={arg_2:%d}]
36|maybe_write_ls: id がない！ [range={arg_1:%d}]
37|maybe_write_ls: type が不正（{arg_1:%d}） [range={arg_2:%d}]
38|write_ls: obj #{arg_1:%u} が見つからない！
39|write_ls: mon #{arg_2:%u} が見つからない{arg_1:%s}！
40|write_ls: 保存された monst ポインターがどの連結リストにもない
41|write_ls: type が不正（{arg_1:%d}）
42|obj_adjust_light_radius: {arg_1:%s} が見つからない
43|物体 {arg_1:%d} で錠を開けようとしている？
44|扉に魔法（{arg_1:%d}）を使おうとした。
45|偽のメール #{arg_1:%d} に未定義の置換がある
46|異常な傭兵 {arg_1:%d}？
47|clone_mon が <{arg_1:%d},{arg_2:%d}> に怪物を作ろうとしている？
48|makemon が <{arg_1:%d},{arg_2:%d}> に怪物を作ろうとしている？
49|rndmonst で mndx {arg_1:%d} の抽選の重みが不正
50|mkclass が不正なクラスで呼ばれた！
51|mkclass でクラス {arg_1:%d} の怪物が見つからない
52|トリックの鞄が不正
53|呪文を使う怪物があなたを見つけたのに、そのことを知らない？
54|{arg_1:%s}が近接用の呪文 {arg_2:%d} の非近接版を唱えている？
55|魔法使いの分身が不正？
56|怪物が姿を消す呪文を唱える理由がない？
57|怪物が盲目にする呪文を唱える理由がない？
58|怪物が負の dmg（{arg_2:%d}）で呪文（{arg_1:%d}）を唱えた？
59|dmg=0 で対象を狙う魔法使いの呪文（{arg_1:%d}）を唱えた？
60|mcastu: 魔法の呪文が不正（{arg_1:%d}）
61|{arg_1:%s}があなたの位置を知らずに攻撃している？
62|飲み込んだ怪物に包み込む攻撃がない？
63|何もないのに、その下に隠れている？
64|爆発する怪物のダメージの種類が不明 {arg_1:%d}
65|視線攻撃 {arg_1:%d}？
66|mdamageu で負のダメージ？（{arg_1:%d}）
67|指輪の交換
68|プレイヤーに属性がない？
69|finddpos: dir が不正
70|fill_ordinary_room: subroom が Null
71|補給箱のアイテムを生成できなかった
72|trycnt のオーバーフロー4
73|levl[{arg_1:%i}][{arg_2:%i}] の扉が不正
74|部屋 {arg_1:%i} がつながっていない？
75|ダンジョンをまだ初期化していないのに makelevel() が呼ばれた。
76|分岐を配置できない！
77|mkstairs:  <{arg_1:%d},{arg_2:%d}> に階段を配置する不正な試み
78|mkstairs:  <{arg_3:%d},{arg_4:%d}> の{arg_2:%s}に{arg_1:%s}階段を配置しようとしている
79|mkinvpos が dist {arg_1:%d} で呼ばれた
80|join_map に始点または終点の部屋の位置がない。
81|結合したマップに長方形の部屋がある
82|set_levltyp({arg_1:%d},{arg_2:%d},{arg_3:%d}){arg_4:%s}{arg_5:%s}
83|set_levltyp_lit({arg_1:%d},{arg_2:%d},{arg_3:%d},{arg_4:%d})
84|lregion の種類 {arg_1:%d} を配置できなかった！
85|「{arg_1:%s}」を読み込めなかった - 迷路を作る。
86|ポータルの上にポータルがある？
87|movebubbles: 位置が不正（{arg_1:%d},{arg_2:%d}）
88|復元する{arg_1:%s}がない？
89|set_wportal(): ポータルがない！
90|n が大きすぎる（mk_bubble）
91|mv_bubble: 泡の内容が不明
92|probtype のエラー。oclass={arg_1:%d} i={arg_2:%d}
93|変更の種類が不正（{arg_1:%d}）
94|start_glob_timeout が塊ではない物体に使われた [{arg_1:%d}: {arg_2:%s}]？
95|shrink_glob が塊ではない物体に使われた [{arg_1:%d}: {arg_2:%s}]？
96|{arg_1:%ld} 個の{arg_2:%s}の重さを計算している？
97|種類 {arg_1:%d} の corpstat を作ろうとしている
98|未払いの物体が別の階に移動している？ [{arg_1:%s}]
99|dealloc_obj: obj はすでに削除済み（type={arg_1:%d}）
100|dealloc_obj に hands_obj が渡された
101|恵みのホルンが不正
102|gm.mydogs の整合性検査 [空でない]
103|怪物（{arg_1:%s}: {arg_2:%u}）が、{arg_5:%s}所持品にない{arg_3:%s}（{arg_4:%u}）を手にしている
104|{arg_1:%s} obj {arg_2:%s} は容器 {arg_3:%s} に入っている。{arg_4:%s} ではない
105|obj_nexto: 検査する物体が渡されていない
106|obj_absorb: 実際の物体二つを渡して呼ばれていない
107|obj_meld: 実際の物体二つを渡して呼ばれていない
108|種類 {arg_1:%d} の部屋を作ろうとした。
109|rooms[] が -1 で終わっていない？
110|invalid_shop_shape: 扉の内側にマスがない？
111|異常なペット #{arg_1:%u} の droptime（{arg_2:%ld}）が現在（{arg_3:%ld}）より未来にある（{arg_4:%s}）
112|怪物 mnum={arg_1:%d}, monsndx={arg_2:%d}（{arg_3:%s}）
113|{arg_1:%s}: レベル {arg_2:%d} の{arg_3:%s} #{arg_4:%u} [{arg_5:%s}] の現在の HP は {arg_6:%d}、最大 HP は {arg_7:%d}
114|{arg_1:%s} に死んだ怪物がいる。<{arg_3:%d},{arg_4:%d}> の{arg_2:%s}
115|虐殺済みの{arg_1:%s}がゲーム中にいる（{arg_2:%s}）
116|手なずけた{arg_1:%s}がおとなしくない（{arg_2:%s}）
117|eshk がない shk（{arg_1:%s}）
118|epri がない僧侶（{arg_1:%s}）
119|egd がない衛兵（{arg_1:%s}）
120|emin がない従者（{arg_1:%s}）
121|edog がないペット（{arg_1:%s}）
122|乗騎: {arg_1:%s}{arg_2:%s}{arg_3:%s}（{arg_4:%s}）
123|罠がないのに捕まっている（{arg_1:%s}）
124|動けないはずの怪物 [{arg_1:%s}{arg_2:%s}] が移動できる（{arg_3:%s}）
125|隠れている怪物があなたにくっついている（{arg_1:%s}）
126|怪物が存在しない物体の下に隠れている（{arg_1:%s}）
127|ウナギが{arg_1:%s}隠れている（{arg_2:%s}）
128|天井に隠れる怪物が{arg_1:%s}隠れている（{arg_2:%s}）
129|落とし穴以外の罠に捕まったまま隠れている（{arg_1:%s}）
130|階を移動中の{arg_1:%s}が{arg_2:%s}に擬態している {arg_3:%s}
131|変身する怪物からの保護があるのに、ミミック{arg_1:%s}が{arg_2:%s}に擬態して隠れている {arg_3:%s}
132|ミミックではない怪物（{arg_1:%s}）が{arg_2:%s}の姿になっている（{arg_3:%s}）
133|ミミック{arg_1:%s}が立ち入れない場所に隠れている: {arg_2:%s}（{arg_3:%s}）
134|monst {arg_1:%u}: つながれているのに{arg_2:%s}用のひもがない
135|monst {arg_1:%u}: {arg_2:%s}がつながれているのに手なずけられていない
136|monst {arg_1:%u}: つながれているのにあなたの隣にいない（{arg_2:%d}）
137|mon（{arg_1:%s}）が <{arg_2:%d},{arg_3:%d}> にいることになっている？
138|乗騎（{arg_1:%s}）が <{arg_2:%d},{arg_3:%d}> にいることになっている？
139|<{arg_2:%d},{arg_3:%d}> の mon（{arg_1:%s}）がそこにいない！'''

# These are direct selected result literals in the actual consumed expressions.
# Helper inputs such as otense(obj, "are") are deliberately absent.
LEAVES = {
    9: {"arg_1": {"format error": "書式エラー", "overflow": "オーバーフロー"}},
    28: {"arg_2": {"gold in wrong slots": "金貨が複数の誤った所持品枠にある", "gold in wrong slot": "金貨が誤った所持品枠にある", "": ""}, "arg_3": {" and ": "、さらに", "": ""}, "arg_4": {"multiple gold stacks": "金貨のまとまりが複数ある", "": ""}},
    33: {"arg_1": {"lit": "点灯している", "unlit": "点灯していない"}, "arg_4": {"a light source": "光源", "free": "どこにも所属しない状態"}},
    39: {"arg_1": {" because it's dead": "（死んでいるため）", "": ""}},
    78: {"arg_1": {"up": "上り", "down": "下り"}},
    82: {"arg_4": {" not isok()": " isok() ではない", "": ""}, "arg_5": {" bad type": " type が不正", "": ""}},
    88: {"arg_1": {"air bubbles": "空気の泡", "clouds": "雲", "air bubbles or clouds": "空気の泡または雲"}},
    122: {"arg_1": {"": ""}, "arg_2": {", ": "、", "": ""}, "arg_3": {"": ""}},
    124: {"arg_1": {"tame ": "手なずけた", "peaceful ": "おとなしい", "": ""}},
    127: {"arg_1": {"out of water": "水の外で", "on Plane of Water": "水の界で"}},
    128: {"arg_1": {"without ceiling": "天井がない場所で", "in solid stone": "固い岩の中で"}},
    130: {"arg_1": {"mimic": "ミミック", "monster": "怪物"}},
    131: {"arg_1": {"": "", "ker": "ではない擬態者"}},
    133: {"arg_1": {"": "", "ker": "ではない擬態者"}},
}
OPAQUE = {9: {"arg_2"}, 31: {"arg_2"}, 32: {"arg_1"}, 85: {"arg_1"}, 104: {"arg_2", "arg_3", "arg_4"}, 113: {"arg_5"}, 137: {"arg_1"}, 138: {"arg_1"}, 139: {"arg_1"}}
OMISSIONS = {33: [{"argument": "arg_3", "reason": "The original otense(obj, 'are') result supplies only English is/are number agreement. Japanese realizes the predicate with が…ではない without a number-inflected copula. The exact original object name and lit/free/light-source distinctions remain in the other consumed slots; the full arg_3 typed union is retained, and otense is never called again."}]}
TECHNICAL_ONLY = {30, 83}


def main():
    path = HERE / "impossible-diagnostic-batch-2.json"
    original = json.loads(path.read_text("utf8"))
    frames = {}
    for line in FRAMES.splitlines():
        index, text = line.split("|", 1)
        assert int(index) not in frames
        frames[int(index)] = text
    assert set(frames) == set(range(len(original["entries"])))
    entries = []
    for index, source in enumerate(original["entries"]):
        ja = frames[index]
        omissions = OMISSIONS.get(index, [])
        names = set(re.findall(r"\{(arg_[0-9]+):", ja))
        assert names | {o["argument"] for o in omissions} == set(source["required_argument_union"])
        assert ja.count("\n") == source["english_whole_named_template"].count("\n")
        assert source["original_api"] == "impossible" and not source["required_helper_variants"]
        dependencies, literals = [], []
        for contract in source["official_source_contracts"]:
            for arg in contract["arguments"]:
                name = arg["id_candidate"]
                typed = next(a for a in source["typed_arguments"] if a["name"] == name)
                mapping = LEAVES.get(index, {}).get(name)
                if typed["type"] != "text":
                    kind = "original-consumed-typed-numeric-or-character-value"
                    requirement = "Keep the original signed/unsigned C value, printf flags, width, precision, length and base. Preserve promoted integer %c as the actual character byte, not decimal prose. No new state query or numeric recomputation."
                elif name in OPAQUE.get(index, set()):
                    kind = "opaque-original-technical-function-pointer-or-filename"
                    requirement = "The exact consumed expression identifies an original function breadcrumb, fmt_ptr address or prototype filename. Keep these original bytes as technical data; never translate by English reverse lookup or call pointer/path formatting again."
                elif any(o["argument"] == name for o in omissions):
                    kind = "original-English-number-agreement-helper-result-retained-union"
                    requirement = omissions[0]["reason"]
                elif mapping:
                    kind = "confirmed-selected-output-literal-with-other-source-branches-unbound"
                    requirement = "Only recorded direct result literals are source-approved. Preserve the original once-selected branch; any variable/nonliteral alternate still requires its original public producer and whole English fallback. Never inspect a current predicate or invoke a name helper again to select these leaves."
                else:
                    kind = "original-diagnostic-public-label-buffer-name-or-grammar-producer-required"
                    requirement = "Capture only the original already-consumed diagnostic label/name/buffer/table/grammar result and its original public knowledge. A raw variable or helper input is not a producer proof. Unsupported compound frames retain exact whole original English; no renderer reruns pmname/Monnam/simpleonames/safe_typename/mhis/otense or discloses additional fields."
                dependencies.append({"argument": name, "type": typed["type"], "source": contract["source"], "line": contract["line"], "source_expression": arg["source_expression"], "blob_sha256": contract["blob_sha256"], "kind": kind, "required_contract": requirement, "original_selected_value_only": True, "additional_native_queries_allowed": False, "runtime_english_reverse_matching_allowed": False, "producer_runtime_verified": False, "runtime_binding_approved": False})
                if mapping:
                    for literal in arg["source_literal_candidates"]:
                        assert literal["english_literal"] in mapping
                        literals.append({"source": contract["source"], "line": contract["line"], "argument": name, "source_expression": arg["source_expression"], "consumer_source_expression": arg["source_expression"], "original_call_site": {"source": contract["source"], "line": contract["line"]}, "source_literal_ordinal": literal["ordinal"], "source_expression_literal_start": literal["start"], "source_expression_literal_end": literal["end"], "english_source_literal": literal["english_literal"], "role": "selected-output-literal", "japanese": mapping[literal["english_literal"]], "blob_sha256": contract["blob_sha256"], "selection_proof": "This literal is the direct selected result of the original consumed expression, not an English-match key, predicate comparison or helper input. Nonliteral alternate branches remain producer-unbound.", "runtime_binding_approved": False})
        notes = ["The whole Japanese frame preserves the pinned official impossible diagnostic's meaning, uncertainty, original typed union and technical identifiers. Source approval does not prove compiled delivery.", "Only the first actually accepted original impossible leaf owns this ID. Ancillary advisory/history/log/error rows remain original and must not inherit it; rendering never invokes, suppresses, repeats or repairs an error or alters native effects/control flow.", "Preserve all original conditional compilation, callback/window/API, attributes, urgency and nohistory. A lexical site does not prove that the current compiled configuration can reach it.", "Original public names, number, pronouns, grammar, hallucination and type/appearance distinctions are source-selected once. Missing producer or ambiguous ownership fails closed to the complete original English leaf, with no additional native name/state/RNG query."]
        if index in TECHNICAL_ONLY:
            notes.append("This leaf is exclusively the original technical function/field/value syntax and stays byte-identical; no fabricated diagnostic prose is added.")
        if index in {8, 9, 133}:
            notes.append("The pinned source explicitly encloses this site in #if 0. Keep it dormant; this source-authoring approval is not a current native callback claim.")
        if index == 1:
            notes.append("The pinned source encloses this fd diagnostic in #if defined(WIN32) && defined(DEBUG). Preserve that exact native guard; this frame does not establish delivery in the UNIX WASM configuration.")
        if index == 2:
            notes.append("The pinned source encloses this overflow diagnostic in #if (NH_DEVEL_STATUS != NH_STATUS_RELEASED). Preserve the original development-only guard, overflow code and normal release behavior.")
        if index == 28:
            notes.append("The frame is an exact original composite container. The why source breadcrumb remains producer-unbound, while direct selected gold-slot/stack clauses are reviewed separately. Do not infer the calling function from completed English.")
        if index == 33:
            notes.append("The free alternative is the original OBJ_FREE membership state, not free price or free agency. Only English copular number agreement is omitted from the Japanese template; arg_3 remains in the consumed union. The public object name still needs its original producer.")
        if index == 49:
            notes.append("weight in rndmonst is the original monster-selection probability weight, not a creature's physical mass; the Japanese 抽選の重み preserves that distinction.")
        if index in {52, 101}:
            notes.append("The named object uses the existing paired catalog's source terminology: bag of tricks=トリックの鞄; horn of plenty=恵みのホルン. This frame does not perform a runtime entity-name lookup.")
        if index == 78:
            notes.append("Original up/down yields 上り/下り from the selected literal. The original defsyms explanation remains a separate public terrain producer dependency, not a current map query.")
        if index == 81:
            notes.append("regular refers to !croom->irregular in the original room geometry check, hence 長方形; it does not mean the ordinary OROOM room type. Preserve the original partial-overlap check and room removal behavior.")
        if index == 82:
            notes.append("set_levltyp and its original parameter record stay literal. Conditional trailing error clauses alone are Japanese; original isok/type tests are not repeated.")
        if index == 122:
            notes.append("The original ns/nt variables are assigned no saddle/saddle not worn/not tame in the pinned local producer, then consumed once. Those nonempty variable values still require a precise producer; only direct empty/separator branches are currently leaf-approved.")
        if index in {130, 131, 132}:
            notes.append("The original what variable is assigned from furniture/a monster/an object/something strange in this pinned function. Those local selected labels need their original producer, not predicate reevaluation or a reverse match of their eventual English bytes.")
        if index in {131, 133}:
            notes.append("Original mimic + the selected empty/ker suffix distinguishes a true mimic from another mimicker. The Japanese fixed ミミック plus empty/ではない擬態者 preserves that exact original distinction; never query monster species to reconstruct the suffix.")
        entries.append({"id": source["id"], "whole_message_ja": ja, "original_api": source["original_api"], "original_english_literal": source["original_english_literal"], "english_whole_named_template": source["english_whole_named_template"], "source_translation_review_status": "faithful-official-source-equivalent-unbound-first-impossible-leaf", "source_translation_approved": True, "source_argument_schema": source["typed_arguments"], "argument_schemas": source["required_argument_union"], "printf_conversions": source["printf_conversions"], "omitted_grammar_arguments": omissions, "helper_variant_templates_ja": {}, "required_source_literal_translations": literals, "source_presentation_dependencies": dependencies, "requires_public_name_or_grammar_producer": any(d["type"] == "text" and d["kind"] not in {"opaque-original-technical-function-pointer-or-filename", "original-English-number-agreement-helper-result-retained-union"} for d in dependencies), "localization_disposition": "preserved-language-independent-code" if index in TECHNICAL_ONLY else "authored-official-Japanese-first-diagnostic-leaf-runtime-unbound", "source_capture_constraints": ["Only original first accepted impossible diagnostic leaf; preserve source-selected args and exact callback/window/API/attribute ownership. Ancillary rows remain original.", "Keep native C errors, logging, repair/recovery/exit and preprocessor flow unchanged. No extra diagnostics, world/RNG calls or original name/grammar queries during rendering.", "Whole exact original English fallback for unsupported public labels/names/buffers/grammar and ambiguous native ownership. No English reverse matching.", "All compiled/native producer and runtime binding claims remain false pending separately gated native/Rust/Node/browser proof."], "official_sites_reviewed": source["official_source_contracts"], "translation_notes": notes, "runtime_binding_approved": False, "runtime_integration": False})
    output = {"schema_version": 1, "category": original["category"], "batch": original["batch"], "source_batch_sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "provenance": original["provenance"], "authorship": {"kind": "direct-official-English-equivalent-Japanese-first-impossible-leaves", "date": "2026-10-02"}, "entries": entries, "runtime_binding_approved": False, "runtime_integration": False}
    target = HERE / original["output_fragment_path"]
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"path": target.name, "ids": len(entries), "sites": sum(len(e["official_sites_reviewed"]) for e in entries), "literal_records": sum(len(e["required_source_literal_translations"]) for e in entries), "argument_dependencies": sum(len(e["source_presentation_dependencies"]) for e in entries), "grammar_omission_entries": sum(bool(e["omitted_grammar_arguments"]) for e in entries), "runtime_approved": 0, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
