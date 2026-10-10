"""Authored Japanese for original impossible diagnostic frames; source-only."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OFFICIAL = ROOT.parent / "official-source-audit/NetHack-5.0.0"
TEMPLATES = [
 "床上のモンスター（{arg_1:%s}）の mstate が 0x{arg_2:%08lx} に設定されている",
 "マップの <{arg_2:%d},{arg_3:%d}> にいるモンスター（{arg_1:%s}）が fmon リストにない！",
 "乗騎（{arg_1:%s}）がマップの <{arg_2:%d},{arg_3:%d}> にいる！",
 "マップの <{arg_2:%d},{arg_3:%d}> にいるモンスター（{arg_1:%s}）が <{arg_4:%d},{arg_5:%d}> に見つかる？",
 "移動中のモンスター（{arg_1:%s}）の mstate が 0x{arg_2:%08lx} に設定されている",
 "モンスターが、種類 {arg_1:%d} の非常に奇妙な罠を調べた。",
 "dmonsfree：削除した数 {arg_1:%d} が、{arg_3:%s} で保留中の数 {arg_2:%d} と一致しない",
 "replmon：minvent の不整合",
 "m_detach：{arg_1:%s} はすでに切り離されている？",
 "distu {arg_2:%d} で {arg_1:%s} にくっついている？",
 "{arg_1:%s} に石化による変身を適用できない！",
 "Resists_Elem({arg_1:%d})：予期しない属性の種類",
 "'Blnd_resist' なのに resists_blnd() ではない？",
 "shk/gd/pri_move の不明な戻り値（{arg_1:%d}）",
 "不正な mplayer モンスター",
 "モンスターが種類 {arg_1:%d} の卵を投げている",
 "spitmm 内の攻撃の種類が不正",
 "ブレス攻撃 {arg_1:%d} が使われた",
 "モンスターが残り回数 {arg_1:%d} の杖を振っている？",
 "ユニコーンの角は必要ない？",
 "{arg_1:%s} が行動 {arg_2:%d} を実行しようとしていた？",
 "{arg_1:%s} が行動 {arg_2:%d} を実行しようとしていた？",
 "{arg_1:%s} が行動 {arg_2:%d} を実行しようとしていた？",
 "なんて奇妙な楽器だ（{arg_1:%d}）！",
 "l_nhcore_init に失敗した",
 "{arg_1:%s}",
 "nh_lua_variables は Lua のテーブルではない",
 "nh.callback の数が不正",
 "nhl_gamestate：状態が一致しない（{arg_1:%s} と {arg_2:%s}）",
 "nhl_set_package_path 内で package がテーブルではない",
 "Lua エラー：{arg_1:%d}:{arg_2:%s} {arg_3:%s}",
 "nhl_loadlua：{arg_1:%s} を開く際にエラーが発生した",
 "（{arg_1:%s}）行が長すぎる",
 "luaL_loadbuffer：{arg_1:%s} の読み込み中にエラーが発生した：{arg_2:%s}",
 "steps と perpcall が両方ともゼロではない",
 "オブジェクト #{arg_1:%d}（{arg_2:%s}）：別の説明{arg_4:%s}のに、名前が{arg_3:%s}",
 "oclass {arg_3:%d} の確率の合計が{arg_1:%s}（{arg_2:%d}）",
 "objdescr_is：obj が null",
 "名前の付いたオブジェクトが disco にない",
 "doclassdisco：無効なオブジェクトクラス '{arg_1:%s}'",
 "PREFIX が短すぎる（{arg_1:%d} に対して）。",
 "safe_typename: {arg_1:%s}",
 "reorder_fruit：果物のインデックス（{arg_1:%d}）が範囲外",
 "reorder_fruit：果物のインデックス（{arg_1:%d}）が重複している",
 "果物 #{arg_1:%d} が不正？",
 "xname_flags: {arg_1:%s}",
 "綱を付けた {arg_1:%s} #{arg_2:%u} が死んでいる",
 "綱を付けたモンスター #{arg_1:%u} が見つからない",
 "文字列がめちゃくちゃ：'an({arg_1:%s})'。",
 "文字列がめちゃくちゃ：'the({arg_1:%s})'。",
 "null の複数形？",
 "null の単数形？",
 "不明な防具の分類（{arg_1:%s} => {arg_2:%u}）",
 "safe_qbuf：接頭辞が長すぎる（{arg_1:%u} 文字）。",
 "safe_qbuf：接尾辞が長すぎる（{arg_1:%u} + {arg_2:%u} 文字）。",
 "safe_qbuf：補完用の文字列が長すぎる（{arg_1:%u} + {arg_2:%u} + {arg_3:%u} 文字）。",
 "不正な開示インデックス {arg_1:%d} {arg_2:%c}",
 "oc_to_str：不正なオブジェクトクラス {arg_1:%d}",
 "set_option_mod_status：status が範囲外 {arg_1:%d}。",
 "set_wc_option_mod_status：status が範囲外 {arg_1:%d}。",
 "set_wc2_option_mod_status：status が範囲外 {arg_1:%d}。",
 "append_str：'buf' に {arg_1:%lu} 文字入っている。",
 "lookat：モンスターを見る方法が不明",
 "不正な do_look バッファが渡された（{arg_1:%s}）！",
 "'data' ファイルの先頭に移動できない",
 "'data' ファイルを読み込めない",
 "'data' ファイルの形式が不正、または破損している",
 'cmdhelp：{arg_2:%d} 行目の &{arg_1:%c} 条件指定が不明："{arg_3:%.20s}"',
 "cmdhelp：&? &: &. の条件指定が対応していない。",
 "simple_look(null)",
 "query_category：分類が多すぎる",
 "pickup_object：count {arg_1:%ld} > quan {arg_2:%ld}？",
 "<in> gc.current_container がない？",
 "<out> gc.current_container がない？",
 "ファイル '{arg_2:%s}' の {arg_3:%d} 行目で nhassert({arg_1:%s}) に失敗した",
 "不正なブレス攻撃？",
 "不正な唾吐き攻撃？",
 "dospit 内の攻撃の種類が不正",
 "飲み込んだ相手に飲み込み攻撃がない？",
 "種類 {arg_1:%d} の罠の上に蜘蛛の巣を張る？",
 "視線攻撃 {arg_1:%d}？",
 "uunstick：ustuck がない？",
 "mbodypart：不正な部位 {arg_1:%d}",
 "なんて奇妙な薬だ！（{arg_1:%u}）",
 "dip_into：薬はどこにある？",
 "fix_curse_trouble：解呪するものがない。",
 "fix_worst_trouble：手の問題を解決できなかった。",
 "混乱した神！",
 "不明な属性。",
 "halu_gname 内で rn2 が壊れているのか？！",
 "ランダムな神の名前がない？",
 "僧侶ではない相手の神殿データを操作しようとしている？",
 "クエストのポータルがすでになくなっている？",
 "quest_chat：不明なクエストの人物 {arg_1:%s}。",
 "quest_info({arg_1:%d})",
 "com_pager：nhl_init() に失敗した",
 "com_pager：{arg_1:%s} が見つからない。",
 "com_pager：{arg_1:%s} 内の questtext は Lua のテーブルではない",
 "com_pager：{arg_2:%s} 内の questtext[{arg_1:%s}] は Lua のテーブルではない",
 "com_pager：{arg_3:%s} 内の questtext[{arg_1:%s}][{arg_2:%s}] は Lua のテーブルではない",
 "com_pager：{arg_4:%s} 内の questtext[{arg_1:%s}][{arg_2:%s}] と [][{arg_3:%s}] は Lua のテーブルではない",
 "com_pager：{arg_3:%s} 内の questtext[{arg_1:%s}][{arg_2:%s}] は文字列の配列ではない",
 "これはなんて奇妙な効果だ？（{arg_1:%u}）",
 "n_rects が小さすぎるかもしれない。",
 "add_mon_to_reg：{arg_1:%s} [#{arg_2:%u}] はすでに領域内にいる。",
 "create_gas_cloud：雲が大きすぎる（{arg_1:%d}）！",
 "Restobjchn：objchn の読み込み中にエラーが発生した。",
 "モンスターの武器の復元が不正",
 "Restmonchn：monchn の読み込み中にエラーが発生した。",
 "以前の果物がない？",
 "restgamestate：鉄球と鎖が失われた",
 "rn2({arg_1:%d}) を呼び出そうとした",
 "rnl({arg_1:%d}) を呼び出そうとした",
 "rnd({arg_1:%d}) を呼び出そうとした",
 "d({arg_1:%d},{arg_2:%d}) を呼び出そうとした",
 "rolefilterstring：不正な職業指定の種別（{arg_1:%d}）",
 "role_menu_extra：不正な引数（{arg_1:%d}）",
 "噂の真偽指定の値が不正",
 "クッキーの噂以外の噂が見つからない？",
 "'{arg_1:%s}' ファイルを開けない。",
 "不明な勾配の種類！　既定の放射状に切り替える……",
 "fd がリストにない（{arg_1:%d}）？",
 "money2mon で{arg_1:%s}の支払い！",
 "{arg_1:%s}金貨がないのに支払おうとしている？",
 "money2u で{arg_1:%s}の支払い！",
 "{arg_1:%s} が{arg_2:%s}金貨がないのに支払おうとしている？",
 "same_price：オブジェクトがどの請求書にも載っていなかった！",
 '{arg_1:%s}？（rmno={arg_2:%d}, rtype={arg_3:%d}, mnum={arg_4:%d}, "{arg_5:%s}"）',
 "onbill：支払い済みのオブジェクトが請求書に載っている？",
 "onbill：未払いのオブジェクトについて、{arg_1:%s}？",
 "obfree：請求書に載っていない、{arg_1:%s} = ({arg_2:%d},{arg_3:%d},{arg_4:%ld},{arg_5:%d}) ({arg_6:%d},{arg_7:%d},{arg_8:%ld},{arg_9:%d})？",
 "obfree：装備中のオブジェクトを削除している（{arg_1:%d}: {arg_2:%ld}）",
 "#{arg_1:%d} の店の請求明細が見つからない",
 "dopay：店主への支払いではない？",
 "支払い済みのオブジェクトが請求書に載っている？？",
 "容器の中の品物が店の請求書に見つからない（#{arg_1:%d}）。",
 "{arg_1:%s} の中身の購入：品物 #{arg_2:%u} が請求書から消えた。",
 "{arg_1:%s} の中身の購入が予期せず失敗した（#{arg_2:%u} {arg_3:%d}）。",
 "finish_paybill：不正な位置 <{arg_1:%d},{arg_2:%d}>。",
 "不正なガラスの宝石 {arg_1:%d}？",
]

# Indexes are one-based and retain exactly the originally selected source leaf.
LEAVES = {
 36: {"pre-known": "既知", "not known": "未知", "": "がある", " no": "がない"},
 37: {"zero": "ゼロ", "negative": "負"},
 123: {"negative": "負の金額", "zero": "ゼロの金額"},
 124: {"enough": "十分な", "": ""},
 125: {"negative": "負の金額", "zero": "ゼロの金額"},
 126: {"enough": "十分な", "": ""},
 128: {"shopkeeper career change": "店主が職業を変えた", "shop resident not shopkeeper": "店の住人が店主ではない", "anonymous": "匿名"},
 130: {"without shopkeeper": "店主がいない", "not on shk's bill": "店主の請求書に載っていない"},
 131: {"otyp,where,quan,unpaid": "otyp,where,quan,unpaid"},
}
SPECIAL = {
 11: "Official mon_to_stone is a stone-polymorph helper (src/mon.c:3745-3762). Translation describes that operation without inventing a successful petrification, new form or hidden identity.",
 26: "Entire message comes from luaL_checkstring. Identical envelope is not Japanese content coverage: original Lua source-origin ID/typed composition must be supplied; no rendered-English reverse matching.",
 36: "Original oc_name_known selection supplies both pre-known/not-known and alternate-description/no-alternate-description leaves. Capture both original selected results once; do not inspect knowledge or description again.",
 39: "disco is the original discovered-object list, not a disco/dance location. Named object means the object represented by original undiscover_object state.",
 42: "Original res is the diagnostic glorkum[%d] builder result; function identifier and diagnostic token stay literal. This does not reconstruct a real object name.",
 46: "Original buf is the diagnostic glorkum class/type/spe builder result; exact symbolic data stays literal and no object knowledge is invented.",
 68: "Original cmdhelp parser lies inside #if 0. It is only lexical/source coverage. Original %.20s is a native precision-bounded byte slice; binding fails closed until that public substring is captured without exposing the full buffer.",
 69: "Original cmdhelp parser lies inside #if 0; retain its &? &: &. syntax verbatim and never create an active runtime callback for it.",
 87: "Hands trouble includes nohands or no freehand; translation says the hands problem was not resolved, without inventing wounds or healing a body part.",
 118: "Diagnostic describes an invalid native truth selector, not the truth/falsity of a selected rumor. No bucket or hidden truth classification is added to normal rumor events.",
 128: "Keep original room index/type/monster index and original has_mgivenname-selected custom-name/anonymous result; never query shopkeeper identity or true name again.",
 131: "otyp,where,quan,unpaid is emitted as technical field labels for two original numeric records. Names/order/widths stay exact; no invented gameplay interpretation.",
}

def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value

def main():
    path = HERE / "impossible-diagnostic-batch-3.json"
    raw = path.read_bytes()
    batch = json.loads(raw)
    assert len(batch["entries"]) == len(TEMPLATES) == 140
    scanner = module(ROOT / "tools/inventory_source.py", "impossible3_scanner")
    helper = module(ROOT / "locales/phase4/build-reviewed-translations.py", "impossible3_helper")
    entries = []
    for index, (source, japanese) in enumerate(zip(batch["entries"], TEMPLATES), 1):
        assert not source["required_helper_variants"]
        dependencies, leaves, unresolved = [], [], []
        for call in source["official_source_contracts"]:
            sha = hashlib.sha256((OFFICIAL / call["source"]).read_bytes()).hexdigest()
            assert sha == call["blob_sha256"]
            for arg in call["arguments"]:
                typed = next(value for value in source["typed_arguments"] if value["name"] == arg["id_candidate"])
                expr = arg["source_expression"]
                if typed["type"] == "text":
                    dependencies.append({"source": call["source"], "line": call["line"],
                        "argument": arg["id_candidate"], "source_expression": expr,
                        "source_blob_sha256": sha, "source_type": typed["type"],
                        "knowledge_guard": "Only original native diagnostic's already-emitted field. Capture once at original branch; no new naming, knowledge, RNG, Lua, pointer, state or buffer queries.",
                        "japanese_slot_role": "original public selected diagnostic/name/grammar/technical/user/path field",
                        "runtime_binding_approved": False})
                for ordinal, (english, start, end) in enumerate(helper.literals(scanner, expr)):
                    if english not in LEAVES.get(index, {}):
                        unresolved.append({"source": call["source"], "line": call["line"],
                            "argument": arg["id_candidate"], "source_expression": expr,
                            "english_literal": english, "reason": "Exact original producer/predicate identity required; no arbitrary literal translation or native replay."})
                        continue
                    leaves.append({"source": call["source"], "line": call["line"],
                        "original_call_site": {"source": call["source"], "line": call["line"], "api": source["original_api"]},
                        "argument": arg["id_candidate"], "source_expression": expr,
                        "source_literal_ordinal": ordinal, "source_expression_literal_start": start,
                        "source_expression_literal_end": end, "english_source_literal": english,
                        "japanese": LEAVES[index][english], "literal_role": "selected-output-literal",
                        "blob_sha256": sha, "contextual_component_recipe": True,
                        "runtime_binding_approved": False})
        constraints = ["Original impossible channel, argument evaluation, native control flow, diagnostic recovery and preprocessor branch are unchanged; no error is hidden or reclassified as routine gameplay.",
                       "Keep full original typed union/printf widths/precision. Capture original selected public fields and source descriptors once. Missing producers preserve exact native fallback, never reverse-match English."]
        if index in SPECIAL:
            constraints.append(SPECIAL[index])
        if any(value.get("c_conversion") == "c" for value in source["typed_arguments"]):
            constraints.append("%c is the original promoted integer cast to a byte, ASCII only; nonASCII errors preserve exact native fallback, not an invented Unicode character.")
        producer = bool(dependencies or unresolved)
        disposition = "pending-original-Lua-message-content" if index == 26 else "preserved-technical-identifier-frame" if index in {42,46,70,95} else "translated-whole-source-frame"
        entries.append({"id": source["id"], "whole_message_ja": japanese,
            "original_api": source["original_api"], "original_english_literal": source["original_english_literal"],
            "english_whole_named_template": source["english_whole_named_template"],
            "source_translation_review_status": "requires-source-producer-contract" if producer else "faithful-official-source-equivalent",
            "source_translation_approved": index != 26, "localization_disposition": disposition,
            "source_argument_schema": source["typed_arguments"], "argument_schemas": source["required_argument_union"],
            "printf_conversions": source["printf_conversions"], "omitted_grammar_arguments": [],
            "helper_variant_templates_ja": {}, "required_source_literal_translations": leaves,
            "unresolved_source_literal_context": unresolved,
            "requires_public_name_or_grammar_producer": producer,
            "source_presentation_dependencies": dependencies, "source_capture_constraints": constraints,
            "official_sites_reviewed": source["official_source_contracts"],
            "translation_notes": ["Japanese follows the exact official diagnostic and original source context; technical API/field names, pointers, file paths and actual values retain their source consumer contract.",
                "A Japanese diagnostic envelope does not claim Japanese dynamic content. Name/grammar/raw-buffer source capture remains explicit, with no new public or hidden fact."] + ([SPECIAL[index]] if index in SPECIAL else []),
            "runtime_binding_approved": False, "runtime_integration": False})
    output = {"schema_version": 1, "category": "impossible-diagnostic", "batch": 3,
        "source_batch_sha256": hashlib.sha256(raw).hexdigest(), "provenance": batch["provenance"],
        "authorship": {"kind": "authored-official-English-equivalent-Japanese", "date": "2026-10-02"},
        "entries": entries, "runtime_binding_approved": False, "runtime_integration": False}
    target = HERE / batch["output_fragment_path"]
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ids": len(entries), "source_approved_frames": sum(entry["source_translation_approved"] for entry in entries),
        "pending_whole_content": 1, "literal_records": sum(len(entry["required_source_literal_translations"]) for entry in entries),
        "producer_dependencies": sum(entry["requires_public_name_or_grammar_producer"] for entry in entries),
        "runtime_approved": 0, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}))

if __name__ == "__main__":
    main()
