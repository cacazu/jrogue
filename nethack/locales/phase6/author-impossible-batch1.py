#!/usr/bin/env python3
"""Japanese source frames for original impossible leaves; no runtime binding."""
import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRAMES = r'''0|リードが付いているのに、リードが見つからない怪物？
1|使用中のリードが何にも付いていない？
2|燭台にろうそくはあるのに、燃料がない？
3|奇妙な罠から跳び出そうとしている（{arg_1:%d}）？
4|缶詰作りに失敗した。
5|use_unicorn_horn: 不正な状態異常？（{arg_1:%d}）
6|fig_transform() の figurine が null
7|像が生命を得たのはどこ？（{arg_1:%d}）
8|found_artifact: アーティファクトのインデックスが不正！（{arg_1:%d}）
9|found_artifact: アーティファクトがまだ存在しない？（{arg_1:%d}）
10|アーティファクトの生成由来が不正: {arg_1:%4o}
11|武器の特殊攻撃が異常。
12|アーティファクトを発見済みにできなかった（{arg_1:%d}）
13|武器で自分自身を攻撃している？
14|arti_invoke に obj がない
15|不明な発動能力 {arg_1:%d}。
16|losestr: {arg_1:%d} - {arg_2:%d}
17|あなたの鉄球と鎖はどこにある？
18|bc はすでに配置されている？
19|unplacebc は拒否された。配置制限がある
20|unplacebc_and_covet_placebc は拒否された。すでに制限されている
21|bc はすでに配置されている？
22|Placebc: {arg_1:%s}:{arg_2:%d} で配置が衝突。すでに {arg_3:%s}:{arg_4:%d} が配置済み
23|Unplacebc_and_covet_placebc: {arg_1:%s}:{arg_2:%d} は拒否された。{arg_3:%s}:{arg_4:%d} が制限中
24|bc_order: 鉄球と鎖が同じ場所にない！
25|鎖の移動が不正
26|{arg_1:%s}{arg_2:%s}{arg_3:%s}がないのに Punished？
27|Punished ではないのに、{arg_1:%s}{arg_2:%s}{arg_3:%s}が付いている？
28|uball: 型 {arg_1:%d}（{arg_2:%s}）、where {arg_3:%d}、wornmask=0x{arg_4:%08lx}
29|uchain: 型 {arg_1:%d}（{arg_2:%s}）、where {arg_3:%d}、wornmask=0x{arg_4:%08lx}
30|b&c の距離: あなた@<{arg_1:%d},{arg_2:%d}>、chain@<{arg_3:%d},{arg_4:%d}>、ball@<{arg_5:%d},{arg_6:%d}>
31|完全初期化の status_initialize が二度目に呼ばれた。
32|init_blstats が複数回呼ばれた。
33|percentage: istat ポインターが不正 {arg_1:%s}, {arg_2:%s}
34|hl->behavior=percentage: rel のエラー
35|hl->behavior=updown: rel のエラー
36|hl->behavior=absolute: rel のエラー
37|hl->behavior=textmatch: rel または textmatch のエラー
38|hl->behavior=condition: rel のエラー
39|doextcmd() のメニューで拡張コマンド数 {arg_1:%d} を超えた。'extmenu' を無効にした。
40|extcmd_via_menu() に入力された文字が多すぎる（{arg_1:%d}）
41|getdir: コマンドキューに方向がない？
42|getpos は成功したが、返答が [.,;:] のどれでもない（{arg_1:%d}）
43|get_count: cmdcount_nht
44|yn_function() が '{arg_1:%s}' を返した。代わりに '{arg_2:%s}' を使う
45|create_drawbridge の方向が不正
46|object_detect: 不正なクラス {arg_1:%d}
47|mkcavepos が dist {arg_1:%d} で呼ばれた
48|digactualhole: この階では {arg_1:%s} を掘れない。
49|liquid_flow({arg_1:%d},{arg_2:%d},{arg_3:%s},{arg_4:%s}) が異常。
50|mdig_tunnel: ({arg_2:%d},{arg_3:%d}) の{arg_1:%s}は掘れない
51|display_monster: m_ap_type の値が不正 [ = {arg_1:%d} ]
52|display_warning が警告の種類と一致しなかった？
53|show_glyph: glyph {arg_3:%d} の座標 <{arg_1:%d},{arg_2:%d}> が不正 [{arg_4:%s} {arg_5:%d}]。
54|show_glyph: 座標 <{arg_3:%d},{arg_4:%d}> の glyph {arg_1:%d} が不正 [最大 {arg_2:%d}]。
55|db-under が異常: {arg_1:%d}
56|back_to_glyph: 不明な階の種類 [ = {arg_1:%d} ]
57|swallow_to_glyph: 飲み込み表示の位置が不正
58|zapdir_to_glyph: 光線の種類が不正
59|get_bkglyph_and_framecolor に渡された framecolor が null
60|wall_angle: 不明な T wall モード {arg_1:%d}
61|wall_angle: 不明な vwall モード {arg_1:%d}
62|wall_angle: 不明な hwall モード {arg_1:%d}
63|wall_angle: 不明な {arg_1:%s} モード {arg_2:%d}
64|wall_angle: crwall 検査の末尾まで到達
65|wall_angle: 不明な crosswall モード
66|wall_angle: 想定外の壁の種類 {arg_1:%d}
67|大岩ではない？
68|階への到着時に衝突: {arg_1:%s}？
69|goto_level: 破棄した階に戻ろうとしている？
70|goto_level: 対応するポータルがない！
71|存在しない容器から死体を蘇生させようとしている
72|revive_corpse: 死体を見失った @ {arg_1:%d}
73|obj_pmname otyp:{arg_1:%i},corpsenm:{arg_2:%i}
74|奇妙だ……そんな指輪を持っているとは知らなかった。
75|Blindf_off: 目に装着している品がない？
76|奇妙な装身具を外そうとしている: {arg_1:%s}
77|otmp がないのに呪われている
78|不明な防具を脱ごうとしている（{arg_1:%d}: {arg_2:%d}）、遅延 {arg_3:%d}
79|不明な防具を脱ごうとしている（{arg_1:%d}: {arg_2:%d}）、遅延なし
80|想定外の種類の装身具を着けようとしている: {arg_1:%s}
81|stuck_ring: 左でも右でもない？
82|select_off: {arg_1:%s}???
83|do_takeoff: {arg_1:%lx} を外そうとしている
84|take_off: {arg_1:%lx} を外そうとしている
85|startingpet_mid がすでに非ゼロなのに makedog() が呼ばれた？
86|mon_arrive: 対応するポータルがない？
87|現在から経過時間を処理しようとしている？
88|リードにつながれた怪物の経過時間を処理しようとしている？
89|乗騎を置き去りにした？
90|dog_eat: ペットの apport <= 0（{arg_1:%d}, {arg_2:%d}, {arg_3:%ld}, {arg_4:%ld}, {arg_5:%d}, {arg_6:%u}, {arg_7:%u}）
91|ペットではない怪物に dog_move が呼ばれた？
92|不明な手袋の種類（{arg_1:%d}）
93|奇妙な品を壊そうとしている（{arg_1:%d}）？
94|correct_branch_type: 不明な分岐の種類
95|flags[{arg_1:%i}] は文字列ではない
96|flags は配列でも文字列でもない
97|builds_up: ダンジョン {arg_1:%d} の分岐が見つからない
98|魔法使いの塔の境界がない？
99|同じ階に二つの分岐がある？
100|まだ見ていない階の分岐を記録できない（{arg_1:%d}, {arg_2:%d}）
101|recalc_wt: piece がない
102|floorfood: 不明な要求（{arg_1:%s}）
103|食べかけの食料（{arg_1:%ld}）の栄養価が、手つかずの食料（{arg_2:%ld}）より高い
104|oeaten: 栄養価 0 の食料（{arg_1:%s}）を食べかけに設定しようとしている
105|should_query_disclose_option: 開示インデックスが不正 {arg_1:%d} {arg_2:%c}
106|should_query_disclose_option: 分類が不正 {arg_1:%c}
107|dealloc_killer（#{arg_1:%d}）がリストにない
108|リストに単語がない
109|{arg_1:%s}が、とても奇妙な書き方で記されている。
110|刻字に使えない品で文字を刻もうとしている！
111|刃のない武器で文字を彫ろうとしている
112|マーカーではない筆記具で落書きしようとしている
113|<= -3 の武器が刻字用として有効になっている
114|乾きすぎたマーカーが落書き用として有効になっている？
115|engraving の整合性: 風の界または水の界にある
116|engraving の整合性: !isok <{arg_1:%i},{arg_2:%i}>
117|engraving の整合性: 表面が不正（{arg_1:%d}: "{arg_2:%s}"）
118|del_engr にエラー？
119|墓ではない場所で墓を荒らそうとしている？（{arg_1:%d}）
120|すでに荒らされた墓を荒らそうとしている？
121|爆発の種類 {arg_1:%d}？
122|explode: ワンドの zap の種類が不正（{arg_1:%d}）。
123|爆発の基本種類 {arg_1:%d}？
124|散乱した品 <{arg_1:%d},{arg_2:%d}> が散乱元 <{arg_3:%d},{arg_4:%d}> にない
125|火の付いていない油が爆発している
126|adtyp_to_expltype: 爆発の種類が不正 {arg_1:%d}
127|mon_explode の種類が不明 {arg_1:%d}
128|down: {arg_1:%d},{arg_2:%d} に壁がない？
129|{arg_1:%d},{arg_2:%d} の down door がどこにもつながらない？
130|up: {arg_1:%d},{arg_2:%d} に壁がない？
131|{arg_1:%d},{arg_2:%d} の right door がどこにもつながらない？
132|left: {arg_1:%d},{arg_2:%d} に壁がない？
133|廊下の方向が {arg_1:%d}？
134|{arg_1:%d}, {arg_2:%d} の left end が一度も接続されていない？
135|{arg_1:%d}, {arg_2:%d} の up end が一度も接続されていない？
136|指定された fqn_filename_buffer が不正: {arg_1:%d}
137|fqname が長すぎる: {arg_1:%s} + {arg_2:%s}
138|警告 - 閉じられていない structlevel ファイルを再初期化しようとしている'''

LEAVES = {
    26:{"arg_1":{"iron ball":"鉄球","":""},"arg_2":{" and ":"と","":""},"arg_3":{"attached chain":"取り付けられた鎖","":""}},
    27:{"arg_1":{"chain":"鎖","":""},"arg_2":{" and ":"と","":""},"arg_3":{"iron ball":"鉄球","":""}},
    49:{"arg_3":{"no trap":"罠なし"},"arg_4":{"no mesg":"メッセージなし"}},
    50:{"arg_1":{"wall":"壁","tree":"木","stone":"石"}},
    68:{"arg_1":{"no monster":"怪物がいない","steed is on map":"乗騎がマップ上にいる","monster not co-located":"怪物が同じ位置にいない"}},
}
OPAQUE = {22:{"arg_1","arg_3"},23:{"arg_1","arg_3"},33:{"arg_1","arg_2"},44:{"arg_1","arg_2"},137:{"arg_1","arg_2"}}


def main():
    path=HERE/"impossible-diagnostic-batch-1.json"
    original=json.loads(path.read_text("utf8"))
    frames={}
    for line in FRAMES.splitlines():
        index,text=line.split("|",1);assert int(index) not in frames;frames[int(index)]=text
    assert set(frames)==set(range(len(original["entries"])))
    entries=[]
    for index,source in enumerate(original["entries"]):
        ja=frames[index]
        names=set(re.findall(r"\{(arg_[0-9]+):",ja))
        assert names==set(source["required_argument_union"])
        assert ja.count("\n")==source["english_whole_named_template"].count("\n")
        assert source["original_api"]=="impossible" and not source["required_helper_variants"]
        dependencies=[];literals=[]
        for contract in source["official_source_contracts"]:
            for arg in contract["arguments"]:
                name=arg["id_candidate"];typed=next(a for a in source["typed_arguments"] if a["name"]==name)
                mapping=LEAVES.get(index,{}).get(name)
                if typed["type"]!="text":
                    kind="original-consumed-typed-numeric-or-character-value"
                    requirement="Preserve the original signed/unsigned C value and exact printf flags/width/precision/length/base. %c is the original promoted integer byte, never its decimal code. No new numeric state query or recomputation."
                elif name in OPAQUE.get(index,set()):
                    kind="opaque-original-technical-function-pointer-control-byte-or-path"
                    requirement="The exact original source expression proves this is a function breadcrumb, formatted pointer, visctrl response byte or filename/path. Preserve the consumed technical token exactly, not an English translation key. Do not call fmt_ptr/visctrl/path construction again or change fallback response/parser behavior."
                elif mapping:
                    kind="confirmed-selected-output-literal-with-other-source-branches-unbound"
                    requirement="Only recorded direct returned literal branches are source-reviewed. Capture the original branch once. A nonliteral alternate branch (trapname or fillmsg) still needs its original producer and complete English fallback until proved. Do not select from completed English, reread flags/traps or rerun original naming."
                else:
                    kind="original-diagnostic-public-label-buffer-or-name-producer-required"
                    requirement="Capture only the exact already-consumed diagnostic label/name/table/buffer construction and public knowledge from this original error path. Preserve ownership, original appearance/type/quantity and source grammar; a variable or lexical candidate alone is not a producer proof. Never rerun doname/safe_typename/trapname/surface or disclose additional state. Unsupported producer keeps this complete original diagnostic leaf in English."
                dependencies.append({"argument":name,"type":typed["type"],"source":contract["source"],"line":contract["line"],"source_expression":arg["source_expression"],"blob_sha256":contract["blob_sha256"],"kind":kind,"required_contract":requirement,"original_selected_value_only":True,"additional_native_queries_allowed":False,"runtime_english_reverse_matching_allowed":False,"producer_runtime_verified":False,"runtime_binding_approved":False})
                if mapping:
                    for literal in arg["source_literal_candidates"]:
                        assert literal["english_literal"] in mapping
                        literals.append({"source":contract["source"],"line":contract["line"],"argument":name,"source_expression":arg["source_expression"],"consumer_source_expression":arg["source_expression"],"original_call_site":{"source":contract["source"],"line":contract["line"]},"source_literal_ordinal":literal["ordinal"],"source_expression_literal_start":literal["start"],"source_expression_literal_end":literal["end"],"english_source_literal":literal["english_literal"],"role":"selected-output-literal","japanese":mapping[literal["english_literal"]],"blob_sha256":contract["blob_sha256"],"selection_proof":"This literal is a direct returned branch of the original consumed diagnostic argument, not a predicate comparison or helper input. Preserve the original once-selected branch; other nonliteral branches remain unbound.","runtime_binding_approved":False})
        notes=["Whole Japanese impossible frame translated directly from the pinned official English diagnostic, with every original consumed typed slot and technical token retained. Source-schema approval does not establish compiled/native delivery.","Only the first actually accepted original impossible diagnostic leaf owns this ID. Ancillary reporting/advisory/history/log rows remain their original output and never inherit this identity. No renderer creates an error callback, suppresses an error, repeats diagnostic/repair/naming/RNG work or changes original recovery/exit control flow.","Preserve original preprocessor guards and channel/window eligibility. The lexical inventory has not established preprocessor applicability, and this source authoring does not activate a dormant error branch.","Function/field names, C operators, option names, addresses, paths and response/control bytes are retained only where the original source contract identifies them as technical data. Human diagnostic explanations are Japanese; raw compound English clauses remain whole-leaf fallback until their original source producer is proved."]
        if index in [16,43,73]:notes.append("This leaf consists only of an exact original technical identifier/value/operator record; that source syntax is language-independent and remains byte for byte, rather than fabricating gameplay prose.")
        if index in [28,29,90,103,105,106]:notes.append("Preserve original long/unsigned-long widths and hexadecimal/octal/decimal bases and promoted-character punctuation. This authoring never narrows a native value or treats a character's integer code as prose.")
        if index == 6:notes.append("figurine is the exact original local struct obj pointer identifier in fig_transform; this null diagnostic preserves that technical identifier.")
        if index == 7:notes.append("The original diagnostic asks which object location code the figurine used. The Japanese question preserves that uncertainty and its original numeric where value; it does not assert that the figurine lacked a location.")
        if index == 87:notes.append("The pinned dog.c source encloses this diagnostic in #if defined(DEBUG) || NH_DEVEL_STATUS != NH_STATUS_RELEASED. This authoring preserves that guard and does not claim the released runtime can reach it.")
        if index == 98:notes.append("Wizard's Tower is the public geographic proper name in the original diagnostic, rendered as 魔法使いの塔; it is not a C field/function token or a newly queried location.")
        if index == 104:notes.append("The consumed itembuf is the original already-built public diagnostic type label plus corpsenm or otyp bracketed code. That compound buffer remains producer-unbound; no renderer rebuilds or rereads either field.")
        if index in [112,114]:notes.append("marker is the ordinary English tool noun in this diagnostic frame and is rendered マーカー. The original MAGIC_MARKER/stylus/spe checks are not changed or repeated.")
        if index in [136,137]:notes.append("The pinned fqname source compiles these diagnostics only in the PREFIXES_IN_USE branch. The historical WASM configuration has PREFIXES_IN_USE absent; this source-only frame does not claim actual callback delivery in that configuration.")
        entries.append({"id":source["id"],"whole_message_ja":ja,"original_api":source["original_api"],"original_english_literal":source["original_english_literal"],"english_whole_named_template":source["english_whole_named_template"],"source_translation_review_status":"faithful-official-source-equivalent-unbound-first-impossible-leaf","source_translation_approved":True,"source_argument_schema":source["typed_arguments"],"argument_schemas":source["required_argument_union"],"printf_conversions":source["printf_conversions"],"omitted_grammar_arguments":[],"helper_variant_templates_ja":{},"required_source_literal_translations":literals,"source_presentation_dependencies":dependencies,"requires_public_name_or_grammar_producer":any(d["type"]=="text" and d["kind"]!="opaque-original-technical-function-pointer-control-byte-or-path" for d in dependencies),"localization_disposition":"preserved-language-independent-code" if index in [16,43,73] else "authored-official-Japanese-first-diagnostic-leaf-runtime-unbound","source_capture_constraints":["Only original first accepted impossible leaf; exact callback/window/API/attributes/urgency/nohistory and source-selected args. Ancillary rows remain original and cannot inherit the ID.","Keep original C error collection, logging, repair/exit/recovery and preprocessor flow unchanged; no extra state, repair, diagnostics, RNG or original name-helper queries from rendering.","Whole native English fallback for an unsupported public buffer/table/name/grammar producer or ambiguous owner. Never infer source identity from English strings.","All runtime, compiled delivery and producer binding claims remain false pending independent gated native/Rust/Node/browser proof."],"official_sites_reviewed":source["official_source_contracts"],"translation_notes":notes,"runtime_binding_approved":False,"runtime_integration":False})
    output={"schema_version":1,"category":original["category"],"batch":original["batch"],"source_batch_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"provenance":original["provenance"],"authorship":{"kind":"direct-official-English-equivalent-Japanese-first-impossible-leaves","date":"2026-10-02"},"entries":entries,"runtime_binding_approved":False,"runtime_integration":False}
    target=HERE/original["output_fragment_path"]
    target.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"path":target.name,"ids":len(entries),"sites":sum(len(e["official_sites_reviewed"]) for e in entries),"literal_records":sum(len(e["required_source_literal_translations"]) for e in entries),"argument_dependencies":sum(len(e["source_presentation_dependencies"]) for e in entries),"runtime_approved":0,"sha256":hashlib.sha256(target.read_bytes()).hexdigest()}))


if __name__=="__main__":main()
