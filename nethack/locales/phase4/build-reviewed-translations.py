#!/usr/bin/env python3
"""Build a separate, source-reviewed phase-four proposal; never edit phase three.

Literal dictionaries below are OFFLINE authoring inputs. Runtime emission must
tag the selected original C literal at its producer. English string matching,
predicate replay, or naming/RNG calls in a renderer are forbidden.
"""
import argparse
import hashlib
import importlib.util
import json
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PIN = "25adee135c4bbd43ac8567664f600b565332435c"
OFFICIAL_PIN = "16ff59115315917b93185d026aeefea06db9b0f4"

# source module, original function, original literal hash, whole Japanese frame,
# literal translations by ORIGINAL argument name. Exact original C slots remain.
# These were individually reviewed against source-pair-review + official C.
SPECS = [
    ("apply", "use_stethoscope", "c355ba8bd1", "あなたには手がない！", {}),
    ("apply", "use_stethoscope", "0d45a181dc", "特に何も聞こえない。", {}),
    ("dothrow", "ok_to_throw", "a5a77ed227", "手がないので、投げたり撃ったりできない。", {}),
    ("mthrowu", "m_throw", "78dd566f09", "毒で目が見えなくなった。", {}),
    ("muse", "use_misc", "a0661db808", "鞭がするりと外れた。", {}),
    ("o_init", "choose_disco_sort", "96ed631c7d", "注意：全体を名前順に並べる方法と、種類ごとに名前順に並べる方法は", {}),
    ("o_init", "choose_disco_sort", "109b253d77", "      一つの種類の発見物を表示するときは同じ結果になるが、", {}),
    ("o_init", "choose_disco_sort", "5c95451ce1", "      今後すべての発見物を表示するときには違いが生じる。", {}),
    ("pickup", "u_handsy", "c355ba8bd1", "あなたには手がない！", {}),
    ("potion", "djinni_from_bottle", "f20881fbf0", "中身は空だった。", {}),
    ("quest", "is_pure", "a07d6abc76", "現在の値は{arg_1:%d}で、必要な値は{arg_2:%d}だ。", {}),
    ("apply", "use_lamp", "8422d69c43", "ランプから油がこぼれ、あなたの{arg_1:%s}が油で覆われた。", {}),
    ("potion", "potionhit", "695f488d3f", "{arg_1:%s}が{arg_2:%s}にぶつかり、砕け散った。", {}),
    ("write", "dowrite", "fbd835a126", "魔法書が奇妙に反り返り、それから{arg_1:%s}になった。", {}),
    ("apply", "use_mirror", "3ffc64bb85", "{arg_1:%s}。", {"arg_1": {"give the fish a chance to fix their makeup": "魚に化粧を直す機会を与えた", "reflect the murky water": "濁った水を映した"}}),
    ("apply", "use_unicorn_horn", "08301580a6", "突然{arg_1:%s}。", {"arg_1": {"trippy": "幻覚に酔うような感じがした", "confused": "混乱した"}}),
    ("apply", "figurine_location_checks", "dea7581f6b", "{arg_1:%s}の中に人形は置けない！", {"arg_1": {"a tree": "木", "solid rock": "硬い岩"}}),
    ("apply", "doapply", "e921c6599a", "すでに{arg_1:%s}。", {"arg_1": {"covered by a towel": "タオルで覆われている", "wearing a blindfold": "目隠しを着けている", "wearing lenses": "レンズを着けている"}}),
    ("artifact", "invoke_healing", "b8753efcd2", "{arg_1:%s}気分がよくなった。", {"arg_1": {"slightly ": "少し", "": ""}}),
    ("artifact", "arti_invoke", "18d9ffd023", "あなたの体が{arg_1:%s}透明さを帯びた……", {"arg_1": {"normal": "普通の", "strange": "奇妙な"}}),
    ("eat", "eataccessory", "18d9ffd023", "あなたの体が{arg_1:%s}透明さを帯びた……", {"arg_1": {"normal": "普通の", "strange": "奇妙な"}}),
    ("attrib", "uchangealign", "403e18bcaf", "{arg_1:%s}新たな方向性を感じた。", {"arg_1": {"sudden ": "突然", "": ""}}),
    ("attrib", "uchangealign", "72a12475a4", "あなたの心は{arg_1:%s}。", {"arg_1": {"much of a muchness": "大して変わらない", "back in sync with your body": "再び体と調和している"}}),
    ("ball", "drag_ball", "e42f98fb34", "重い鉄球を{arg_1:%s}引きずれない。", {"arg_1": {"carry all that and also ": "その荷物をすべて持ったまま", "": ""}}),
    ("dbridge", "e_died", "cba0ce899d", "{arg_1:%s}力で、あなたは遠くへ瞬間移動した……", {"arg_1": {"normal": "普通の", "strange": "奇妙な"}}),
    ("detect", "openone", "3767bda03a", "爆発{arg_1:%s}！", {"arg_1": {"see": "を見た", "hear": "音を聞いた", "feel the shock of": "の衝撃を感じた"}}),
    ("dig", "mkcavearea", "cf6c441908", "不思議な力が、あなたの周りの洞窟を{arg_1:%s}！", {"arg_1": {"creates a": "作り出した", "extends the": "広げた"}}),
    ("priest", "intemple", "44beb5bdea", "{arg_1:%s}幽霊があなたのすぐそばに現れた{arg_2:%c}", {"arg_1": {"n enormous": "巨大な", "": ""}}),
    ("restore", "dorecover", "512eb0ddc3", "{arg_2:%s}のレベル{arg_1:%d}に戻った{arg_3:%s}。", {"arg_3": {" while in debug mode": "（デバッグモード中）", " while in explore mode": "（探索モード中）", "": ""}}),
    ("trap", "drown", "1f9d69542d", "{arg_2:%s}の中に{arg_1:%s}{arg_3:%c}", {"arg_1": {"plunge": "飛び込んだ", "fall": "落ちた"}}),
    ("weapon", "give_may_advance_msg", "ad496ad15a", "自分の{arg_1:%s}技能に、より自信が持てるようになった。", {"arg_1": {"": "", "weapon ": "武器の", "spell casting ": "呪文詠唱の", "fighting ": "戦闘の"}}),
    ("weapon", "mon_wield_item", "2f1abdedeb", "{arg_1:%s}光が輝き始めた。", {"arg_1": {"nearby": "近くで", "in the distance": "遠くで"}}),
    ("wield", "ready_weapon", "1cfffef391", "盾を装備している間は、両手持ちの{arg_1:%s}を構えられない。", {"arg_1": {"sword": "剣", "axe": "斧", "weapon": "武器"}}),
    ("write", "dowrite", "953863b910", "偉大なイェンダー小説を{arg_1:%s}が、ひらめきが{arg_2:%s}。", {"arg_1": {"prepare": "書く準備をした", "try": "書こうとした"}, "arg_2": {"lack": "足りない", "have too much": "多すぎる"}}),
    ("write", "dowrite", "2e0d6377c2", "本当に{arg_2:%s}二次創作を{arg_1:%s}。", {"arg_1": {"start to ": "作り始めた", "": "作った"}, "arg_2": {"lame": "つまらない", "awesome": "素晴らしい"}}),
    ("zap", "unturn_you", "4c3d960437", "恐ろしくなり、{arg_1:%s}くらくらした。", {"arg_1": {"even more ": "さらに", "": ""}}),
    ("zap", "stone_to_flesh_obj", "adb8ce8044", "人形が{arg_1:%s}動き出した！", {"arg_1": {"turns to flesh and ": "肉体に変わって", "": ""}}),
    ("zap", "zap_updown", "0636d54243", "あなたの下で{arg_1:%s}が渦を巻いた。", {"arg_1": {"frost": "霜", "dust": "ほこり"}}),
]

DEFERS = [
    ("apply", "use_camera", "f695499c29", "missing-context", "Original s_suffix(mon_nam(...)) is a completed English possessive. Capture the original name base/possessive descriptor at that producer; Japanese mon_nam must not be called a second time."),
    ("apply", "use_towel", "95770e722b", "missing-context", "The original rn2(2) result selects cock-eyed/crooked once. A source literal tag is required; reevaluating rn2 or reverse-matching completed English is forbidden."),
    ("apply", "its_dead", "872", "missing-context", "Plural, distance, tense and mostly-dead qualifiers require a reviewed original public producer contract; the fork's two slots are not sufficient evidence."),
    ("artifact", "sting_effects", "4ec72cab3b", "missing-context", "Original otense/glow_verb and glow_color are already computed visible values. The Japanese branch calls different adjective/verb helpers; capture original semantic descriptors and retain the original integer %c punctuation."),
    ("dothrow", "throw_gold", "811", "rejected-extra-native-query", "Pinned Japanese calls digests(u.ustuck->data), an extra native fact not computed by the original English call. Do not import that query or reveal that descriptor."),
    ("do_wear", "armor_or_accessory_off", "ecd", "rejected-extra-arguments", "Pinned Japanese uses additional j/m arguments absent from the original why slot. Their original public provenance is unproved."),
    ("shk", "price_quote", "963ab691db", "rejected-extra-native-query", "Original contentsonly ? period : shk_embellish(...) suppresses the embellishment call on one branch. The Japanese branch calls shk_embellish unconditionally; do not invoke it to translate."),
]


def load_module(path, name):
    import sys
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def choose(rows, module, function, suffix):
    found = []
    prefix = f"nethack.message.{module}.{function}."
    for row in rows:
        for ident in row["official_ids"]:
            if ident.startswith(prefix) and ident.rsplit(".", 1)[-1].startswith(suffix):
                found.append((row, ident))
    # A repeated identical ID may have multiple JNetHack blocks; all source sites
    # remain attached to that original ID. No index/order heuristic chooses one.
    ids = {ident for _, ident in found}
    if len(ids) != 1:
        raise ValueError(f"Not one exact official ID: {module}/{function}/{suffix}: {ids}")
    first, ident = found[0]
    if any(r["english"] != first["english"] for r, _ in found[1:]):
        # JNetHack line numbers differ but API/literal/args must remain exact.
        for other, _ in found[1:]:
            for field in ("api", "literal", "argument_expressions", "format_semantics"):
                if other["english"][field] != first["english"][field]:
                    raise ValueError(f"Multiple distinct source contracts: {ident}")
    return first, ident


def source_context(official, site, radius=7):
    data = (official / site["source"]).read_bytes()
    lines = data.decode("utf8").splitlines()
    start, end = max(1, site["line"] - radius), min(len(lines), site["line"] + radius)
    return {"source": site["source"], "line": site["line"], "blob_sha256": hashlib.sha256(data).hexdigest(),
            "context_start_line": start, "context_end_line": end,
            "context": "\n".join(f"{i}: {lines[i - 1]}" for i in range(start, end + 1))}


def literals(scanner, expression):
    result = []
    for token in scanner.c_tokens(expression):
        if token.kind == "string":
            result.append((scanner.decode_c_string(token.text), token.start, token.end))
    return result


def build(official):
    source = json.loads((HERE / "source-pair-review.json").read_text("utf8"))
    core = load_module(ROOT / "locales/build-gameplay-catalog.py", "phase4_core_reader")
    scanner = load_module(ROOT / "tools/inventory_source.py", "phase4_source_reader")
    frozen = {name: digest(ROOT / name) for name in source["frozen_phase3_sha256"]}
    if frozen != source["frozen_phase3_sha256"]:
        raise ValueError("Frozen phase-three files differ from the review input checkpoint")
    catalog = {"en": {}, "ja": {}}
    entries, leaves, defers, excluded = [], [], [], []
    imported_paths = set()
    for module, function, suffix, japanese, leaf_maps in SPECS:
        row, ident = choose(source["rows"], module, function, suffix)
        if ident in row["already_in_phase3_ids"]:
            excluded.append({"id": ident, "reason": "frozen-phase3-overlap"})
            continue
        if ident in catalog["en"]:
            raise ValueError("Duplicate authored ID")
        e = row["english"]
        eng, args, conversions = core.convert_printf(e["literal"], e["format_semantics"] == "printf-like")
        eng, japanese = core.whole_message(e["api"], eng, japanese)
        names = {a["name"] for a in args}
        if core.names(eng) != names or core.names(japanese) != names:
            raise ValueError(f"Not the exact original argument set: {ident}")
        # Japanese preserves each original printf conversion verbatim, including
        # integer byte %c. Reordering names changes presentation only.
        for conversion in conversions:
            token = "{" + conversion["argument"] + ":" + conversion["catalog_specifier"] + "}"
            if japanese.count(token) != eng.count(token):
                raise ValueError(f"Printf conversion changed: {ident}: {token}")
        selected = []
        for argname, authored in leaf_maps.items():
            position = int(argname.removeprefix("arg_")) - 1
            expression = e["argument_expressions"][position]
            tokens = literals(scanner, expression)
            if not tokens or set(authored) != {value for value, _, _ in tokens}:
                raise ValueError(f"Not the complete exact original literal union: {ident}/{argname}")
            for ordinal, (english, start, end) in enumerate(tokens):
                leaf_id = scanner.semantic_candidate(
                    f"nethack.fragment.{module}.{function}.{argname}.leaf_{ordinal}", english)
                if leaf_id in catalog["en"]:
                    raise ValueError(f"Duplicate fragment identity: {leaf_id}")
                catalog["en"][leaf_id] = core.escape(english)
                catalog["ja"][leaf_id] = core.escape(authored[english])
                leaf = {"id": leaf_id, "message_id": ident, "argument_name": argname,
                        "source_expression": expression, "source_literal_ordinal": ordinal,
                        "source_expression_literal_start": start, "source_expression_literal_end": end,
                        "english_source_literal": english, "japanese": authored[english],
                        "capture_contract": "tag the selected original C literal at its existing producer; evaluate original predicate/argument once; no rendered-English lookup",
                        "runtime_binding_approved": False}
                leaves.append(leaf)
                selected.append(leaf_id)
        catalog["en"][ident] = eng
        catalog["ja"][ident] = japanese
        imported_paths.add(row["source"])
        contexts = [source_context(official, s) for s in row["official_call_sites"] if s["english_id_candidate"] == ident]
        if not contexts or any(c["blob_sha256"] != row["official_blob_sha256"] for c in contexts):
            raise ValueError("Official source blob/site evidence differs")
        raw = [a["name"] for a in args if a["type"] == "text" and a["name"] not in leaf_maps]
        for a in args:
            a["source_expression"] = e["argument_expressions"][int(a["name"].removeprefix("arg_")) - 1]
            a["requires_original_source_literal_identity"] = a["name"] in leaf_maps
            a["presentation_argument_type"] = "text_id" if a["name"] in leaf_maps else a["type"]
        entries.append({"id": ident, "source_translation_approved": True,
                        "source_contract_status": "requires-original-source-literal-descriptors" if leaf_maps else "direct-original-public-argument-contract",
                        "runtime_binding_approved": False, "runtime_integration": False,
                        "whole_message_en": eng, "whole_message_ja": japanese,
                        "original_api": e["api"], "original_english_literal": e["literal"],
                        "arguments": args, "printf_conversions": conversions,
                        "source_selected_literal_ids": selected, "raw_visible_fallback_arguments": raw,
                        "knowledge_guard": "only capture values the original C emission computes and exposes; no extra field, naming, modifier, or RNG query",
                        "missing_capture_behavior": "retain exact native English when a required source literal identity is unavailable",
                        "japanese_origin": "human-authored official-English-equivalent adaptation after pinned Japanese/source review",
                        "authored_date": "2026-10-02", "source_evidence": contexts,
                        "pinned_japanese_evidence": {"source": row["source"], "english_line": e["line"],
                            "japanese_candidates": row["japanese_candidates"], "blob_sha256": row["pinned_blob_sha256"]}})
        for variant, (ven, vja) in core.variants(e["api"], eng.removeprefix(core.PREFIX.get(e["api"], "")), japanese).items():
            key = f"variant.{variant}.{ident}"
            if core.names(ven) != names or core.names(vja) != names:
                raise ValueError("Helper variant changed source arguments")
            catalog["en"][key], catalog["ja"][key] = ven, vja
    for module, function, suffix, status, reason in DEFERS:
        row, ident = choose(source["rows"], module, function, suffix)
        defers.append({"id": ident, "review_status": status, "source_translation_approved": False,
                       "runtime_binding_approved": False, "reason": reason, "original": row["english"],
                       "pinned_japanese_candidates": row["japanese_candidates"],
                       "source_evidence": [source_context(official, s) for s in row["official_call_sites"] if s["english_id_candidate"] == ident]})
        imported_paths.add(row["source"])
    counts = Counter({"approved_message_ids": len(entries), "source_literal_fragment_ids": len(leaves),
                      "helper_variant_ids": sum(k.startswith("variant.") for k in catalog["en"]),
                      "catalog_ids_per_locale": len(catalog["en"]), "runtime_binding_approved_ids": 0,
                      "rejected_or_missing_context_ids": len(defers), "excluded_frozen_ids": len(excluded)})
    counts.update(e["source_contract_status"] for e in entries)
    counts.update(d["review_status"] for d in defers)
    metadata = {"schema_version": 1, "purpose": "separate phase-four human-reviewed source proposal, not a runtime coverage claim",
                "counts": dict(counts), "runtime_integration": False, "full_japanese_gameplay": False,
                "frozen_phase3_sha256": frozen, "provenance": {"official": {"pinned_commit": OFFICIAL_PIN},
                  "jnethack": {"pinned_commit": PIN, "origin": source["provenance"]["jnethack"]["origin"],
                     "authors": source["provenance"]["jnethack"]["authors"], "license": "NetHack General Public License",
                     "imported_paths": sorted(imported_paths),
                     "input_blobs": {p: source["provenance"]["jnethack"]["input_blobs"][p] for p in sorted(imported_paths)}}},
                "entries": entries, "source_literal_fragments": leaves, "rejected_or_missing_context": defers,
                "excluded_frozen_phase3": excluded,
                "guards": ["No native source changes, gameplay fork logic, runtime reverse mapping, state/RNG replay, or catalog integration is performed.",
                           "Source translation approval means exact facts/slots were reviewed; it does not prove native emission, formatting tests, or browser gameplay.",
                           "Raw public dynamic names/descriptions remain exact original English with explicit fallback until their original semantic producer is bound.",
                           "Literal IDs are selected from original producer positions, never by matching completed English strings."]}
    if {n: digest(ROOT / n) for n in frozen} != frozen:
        raise ValueError("Frozen phase-three inputs were modified")
    return catalog, metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--official-source", type=Path, default=ROOT.parent / "official-source-audit/NetHack-5.0.0")
    options = parser.parse_args()
    catalog, metadata = build(options.official_source)
    dump(HERE / "reviewed-translations.json", catalog)
    dump(HERE / "reviewed-translations.metadata.json", metadata)
    print(json.dumps(metadata["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
