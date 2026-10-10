#!/usr/bin/env python3
"""Grounded numeric/ASCII-byte Japanese frames, with original source contracts."""
import hashlib
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
TEMPLATES=[
 "エラーが発生し、データの一部しか書き込めなかった（{arg_1:%u}/{arg_2:%u}）。",
 "ダンジョンの地形「{arg_1:%c}」が見つからない。",
 "それほど多くは持っていない！　{arg_1:%ld}しか持っていない。",
 "「{arg_1:%c}」は一つも持っていない。",
 "cnt={arg_1:%d}、使用値={arg_2:%d}、cnttmp={arg_3:%d}、cntdiv={arg_4:%d}",
 "泡の xmin：x = {arg_1:%d}、xmin = {arg_2:%d}",
 "泡の ymin：y = {arg_1:%d}、ymin = {arg_2:%d}",
 "泡の xmax：x = {arg_1:%d}、xmax = {arg_2:%d}",
 "泡の ymax：y = {arg_1:%d}、ymax = {arg_2:%d}",
 "うまい{arg_1:%c}",
 "時刻をターン #{arg_1:%ld} に戻す。",
 "宝石が足りない？ — first={arg_1:%d} j={arg_2:%d} LAST_GEM={arg_3:%d}",
 "「{arg_1:%c}」は一つも持っていない。",
 "{arg_2:%u}バイトのはずが、{arg_1:%d}バイト読み込んだ。",
 "部屋は（{arg_1:%d},{arg_2:%d}）、（{arg_3:%d},{arg_4:%d}）にある。",
 "doormax={arg_1:%d} doorct={arg_2:%d} fdoor={arg_3:%d}",
 "扉 [{arg_1:%d},{arg_2:%d}]",
 "prscore：不正な引数（{arg_1:%d}）",
 "重要なバイト数が一致しない。file:{arg_1:%d}、critical_sizes:{arg_2:%d}。",
 "うっ、この光は痛い{arg_1:%c}",
]


def main():
    path=HERE/"english-primary-numeric-only-batch-1.json"
    original=json.loads(path.read_text("utf8"))
    assert len(original["entries"])==len(TEMPLATES)
    entries=[]
    for e,ja in zip(original["entries"],TEMPLATES):
        assert not e["required_helper_variants"]
        notes=["Japanese translates only the actual official English frame. Original numeric values, ASCII punctuation/class-symbol bytes and source argument order remain immutable; no core/name/RNG/state calls added.","Developer diagnostics retain original symbolic variable identifiers. They are not replaced by guessed gameplay names."]
        if any(a.get("catalog_target_length_normalization") for a in e["typed_arguments"]):
            notes.append("Official source remains %zu and size_t; the prepared WASM32 named template explicitly uses %u for uint32 size_t. This source-only proposal is valid only for that target. Native64 size_t must never be truncated or silently treated as uint32; it needs a separate correctly sized formatter/binding.")
        entries.append({"id":e["id"],"whole_message_ja":ja,"original_api":e["original_api"],"original_english_literal":e["original_english_literal"],"english_whole_named_template":e["english_whole_named_template"],"source_translation_review_status":"faithful-official-source-equivalent","source_translation_approved":True,"source_argument_schema":e["typed_arguments"],"argument_schemas":e["required_argument_union"],"printf_conversions":e["printf_conversions"],"omitted_grammar_arguments":[],"helper_variant_templates_ja":{},"required_source_literal_translations":[],"requires_public_name_or_grammar_producer":False,"source_capture_constraints":["Capture each numeric/unsigned/original character argument once at the exact original source call. %c is the original promoted integer byte, ASCII only; unsupported nonASCII remains exact native English fallback.","This is source authoring only. Runtime binding, compilation and browser behavior require separate verification before acceptance."],"official_sites_reviewed":e["official_source_contracts"],"translation_notes":notes,"runtime_binding_approved":False,"runtime_integration":False})
    output={"schema_version":1,"category":"numeric-only","batch":1,"source_batch_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"provenance":original["provenance"],"authorship":{"kind":"authored-official-English-equivalent-Japanese","date":"2026-10-02"},"entries":entries,"runtime_binding_approved":False,"runtime_integration":False}
    target=HERE/original["output_fragment_path"]
    target.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"path":target.name,"ids":len(entries),"runtime_approved":0,"sha256":hashlib.sha256(target.read_bytes()).hexdigest()}))


if __name__=="__main__":
    main()
