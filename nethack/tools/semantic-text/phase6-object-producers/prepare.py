"""Prepare isolated public doname composition; source-only, distributed NGPL.

No compiler/game/browser/apply command exists. Output is constrained to this
phase6 directory. Public transforms preserve incoming message/phase5 hooks.
"""
from __future__ import annotations

import argparse
from collections import Counter
import difflib
import hashlib
import json
from pathlib import Path
import runpy
import sys

sys.dont_write_bytecode = True
PHASE = Path(__file__).resolve().parent
ROOT = PHASE.parents[2]
BASE = ROOT / "tools/semantic-text"
UPSTREAM = ROOT / "upstream/NetHack-5.0.0/src/objnam.c"
COMMIT = "16ff59115315917b93185d026aeefea06db9b0f4"
PINNED_SOURCE = "445d0b8697ceeb93f1249599b16caffb101a832ee425d76f9eb3fd65088f1dd3"
PREFIX = "nethack.name.object.public."
GRAMMAR = runpy.run_path(str(BASE / "phase5-grammar/prepare.py"))
once = GRAMMAR["once"]
tokens = GRAMMAR["tokens"]
native_calls = GRAMMAR["native_calls"]

LITERALS = [
    ("prefix", 'Strcpy(prefix, "some ");', "some", "some ", "いくつかの", False, 1),
    ("prefix", 'Strcpy(prefix, "the ");', "definite", "the ", "", False, 1),
    ("prefix", 'Strcpy(prefix, "a ");', "article", "a ", "", True, 1),
    ("prefix", 'Strcat(prefix, "empty ");', "empty", "empty ", "空の", False, 1),
    ("prefix", 'Strcat(prefix, "cursed ");', "cursed", "cursed ", "呪われた", False, 1),
    ("prefix", 'Strcat(prefix, "blessed ");', "blessed", "blessed ", "祝福された", False, 1),
    ("prefix", 'Strcat(prefix, "uncursed ");', "uncursed", "uncursed ", "呪われていない", False, 1),
    ("prefix", 'Strcat(prefix,"trapped ");', "trapped", "trapped ", "罠のある", False, 1),
    ("prefix", 'Strcat(prefix, "broken ");', "broken", "broken ", "壊れた", False, 1),
    ("prefix", 'Strcat(prefix, "locked ");', "locked", "locked ", "鍵のかかった", False, 1),
    ("prefix", 'Strcat(prefix, "unlocked ");', "unlocked", "unlocked ", "鍵のかかっていない", False, 1),
    ("prefix", 'Strcat(prefix, "greased ");', "greased", "greased ", "油脂を塗った", False, 1),
    ("prefix", 'Strcat(prefix, "poisoned ");', "poisoned", "poisoned ", "毒を塗った", False, 1),
    ("prefix", 'Strcat(prefix, "partly used ");', "partly_used", "partly used ", "一部使用した", False, 1),
    ("prefix", 'Strcat(prefix, "partly eaten ");', "partly_eaten", "partly eaten ", "食べかけの", False, 1),
    ("suffix", 'Concat(bp, 0, " (being worn)");', "worn", " (being worn)", "（装着中）", False, 2),
    ("suffix", 'Concat(bp, 0, " (lit)");', "lit", " (lit)", "（点火中）", False, 2),
    ("suffix", 'Concat(bp, 0, " (wielded)");', "wielded", " (wielded)", "（手に持っている）", False, 1),
    ("suffix", 'Concat(bp, 0, " (no charge)");', "no_charge", " (no charge)", "（無料）", False, 1),
]
NUMBERS = [
    {
        "statement": 'Sprintf(prefix, "%ld ", obj->quan);',
        "zone": "prefix", "id": "quantity", "kind": "NH_OBJECT_QUANTITY",
        "wrappers": [("obj->quan", "nh_object_public_long(&nh_object_public, obj->quan)")],
        "ja": "{value:%ld} ", "union": ["original", "value"],
        "visible": "Exact original printed quantity only, inside dknown-or-not-vague branch.",
    },
    {
        "statement": 'Sprintf(eos(prefix), "%+d ", obj->spe);',
        "zone": "prefix", "id": "enchantment", "kind": "NH_OBJECT_ENCHANTMENT",
        "wrappers": [("obj->spe", "nh_object_public_int(&nh_object_public, 0, obj->spe)")],
        "ja": "{value:%+d} ", "union": ["original", "value"], "occurrences": 2,
        "visible": "Exact original printed signed enchantment only under original known guard.",
    },
    {
        "statement": 'ConcatF2(bp, 0, " (%d:%d)", (int) obj->recharged, obj->spe);',
        "zone": "suffix", "id": "charges", "kind": "NH_OBJECT_CHARGES",
        "wrappers": [("(int) obj->recharged", "nh_object_public_int(&nh_object_public, 0, (int) obj->recharged)"),
                     ("obj->spe", "nh_object_public_int(&nh_object_public, 1, obj->spe)")],
        "ja": "（{recharged:%d}:{charges:%d}）", "union": ["original", "recharged", "charges"],
        "visible": "Exact original recharge count and current charge count only when known prints them.",
    },
    {
        "statement": 'ConcatF2(bp, 0, " containing %ld item%s", itemcount, plur(itemcount));',
        "zone": "suffix", "id": "content_count", "kind": "NH_OBJECT_CONTENT_COUNT",
        "wrappers": [("itemcount, plur(itemcount)",
                      "nh_object_public_long(&nh_object_public, itemcount), nh_object_public_plural(&nh_object_public, plur(itemcount))")],
        "ja": "（中身 {count:%ld} 点）", "union": ["original", "count", "english_plural"],
        "visible": "Already computed original count_contents result and original plur return only. This counts stacks/inventory slots, not a newly queried total quantity.",
    },
]
PENDING = [
    {"range": [138, 159], "feature": "original static 12-slot obuf ownership",
     "status": "source-reuse-epoch-guard-prepared", "contract": "Existing nextobuf/releaseobuf invalidations carry the exact original static range. The separate bridge copy advances a bounded presentation-only epoch; source range reuse/release rejects a captured descriptor even if new bytes match."},
    {"range": [580, 1029], "feature": "xname known/unknown/shuffled appearance",
     "status": "existing-66-hooks-retained", "contract": "Only exact already selected OBJ_NAME/OBJ_DESCR pointer/index and generic native branches; no true identity or shuffled appearance query added."},
    {"range": [998, 1009], "feature": "custom/ONAME and special artifact names",
     "status": "whole-english-fallback", "contract": "Frozen xname hooks reject custom/artifact paths. A future producer must copy actual public ONAME/artifact source identity after the existing dknown/pname guard, preserve user bytes, and capture existing capitalization without extra lookups."},
    {"range": [1269, 1280], "feature": "poisoned offset / fruit artifact alias",
     "status": "whole-english-fallback", "contract": "Retain native strncmp, artifact_name and offset exactly once; unavailable base descriptor or changed base bytes rejects composition."},
    {"range": [1282, 1371], "feature": "quantity/articles/empty/BUC/lock/trap/grease",
     "status": "source-hooks-prepared", "contract": "Capture only inside original printed branch; never infer BUC or quantity from a later field read."},
    {"range": [1373, 1380], "feature": "visible contained stack count",
     "status": "source-hooks-prepared", "contract": "Keep count_contents and plur calls once; copy already public original printf arguments and complete native output."},
    {"range": [1382, 1425], "feature": "armor wear/doff/don/slippery/artifact light; erosion",
     "status": "partial-plain-worn-and-enchantment-only", "contract": "Unobserved conditional/overwrite/erosion additions change original bytes and force whole English; no doffing/donning/artifact_light/add_erosion_words replay."},
    {"range": [1431, 1454], "feature": "leash and candelabrum names/lighting",
     "status": "whole-english-fallback", "contract": "Original find_mid/name/plur inputs remain once. No separate public target/name/light descriptor has been approved here."},
    {"range": [1455, 1503], "feature": "lamp use/light, visible charges, ring hand descriptors",
     "status": "partial-literal-use-light-and-charges", "contract": "No peek_timer replay; hand/side/tense inputs need original public descriptor and unobserved writes fail whole English."},
    {"range": [1504, 1560], "feature": "corpse/egg/species/attached punishment/debug gender",
     "status": "whole-english-fallback", "contract": "Existing corpse_xname/releaseobuf and public species branches stay untouched. Any unsupported base or added prefix/suffix fails closed; no gender or egg knowledge query is added."},
    {"range": [1561, 1646], "feature": "wielded/alternate/quiver/hand/glow ownership",
     "status": "partial-plain-wielded-only", "contract": "No body_part/makeplural/glow/artifact helper replay; conditional/capitalized/ownership fragments require independent copied public producer events."},
    {"range": [1648, 1684], "feature": "unpaid/content/currency/price quote",
     "status": "partial-no-charge-literal-only", "contract": "unpaid_cost/get_cost/currency/record_price_quote remain once with original side effects. Any unobserved appended quote forces whole English."},
    {"range": [1686, 1693], "feature": "original just_an normalization",
     "status": "source-hooks-prepared-neutral-japanese", "contract": "Capture original completed a/an/empty prefix and intact remainder after just_an once; Japanese neutral article has no added proper-name or vowel query."},
    {"range": [1695, 1751], "feature": "debug weight / strprepend / truncation",
     "status": "integrity-guarded-with-weight-fallback", "contract": "Original weight, prepend, bounds, panic and menu clamp run unchanged. Missing output piece or any incomplete/truncated prefix/base/suffix rejects the entire descriptor."},
    {"range": [2358, 2420], "feature": "yname/ownership/capitalization wrappers",
     "status": "future-public-composition-required", "contract": "Outside this initial doname transform. Whole borrowed pointer is never reused as a semantic name after native copy/prefix/case changes without its own original public snapshot."},
]


def sha(data: str | bytes) -> str:
    return hashlib.sha256(data.encode("utf8") if isinstance(data, str) else data).hexdigest()


def body(source: str) -> tuple[int, int, str]:
    first = "staticfn char *\ndoname_base("
    last = "\nchar *\ndoname(struct obj *obj)"
    if source.count(first) != 1 or source.count(last) != 1:
        raise ValueError("Exact original doname boundaries unavailable")
    start, end = source.index(first), source.index(last)
    return start, end, source[start:end]


def transform_objects(source: str) -> tuple[str, list[dict]]:
    """Pure incoming-source transform; no working-copy or registry write."""
    if "nh_object_public_init" in source:
        raise ValueError("Public object hooks already present")
    if "nh_text_name_grammar_capture" not in source or "nh_object_recipe" not in source:
        raise ValueError("Composition requires existing ordinary object and phase5 article hooks")
    start, end, old = body(source)
    changed = once(old, "    size_t bpspaceleft;", "    size_t bpspaceleft;\n    struct nh_object_public_snapshot nh_object_public;")
    changed = once(changed, "    bp = xname(obj);", "    bp = xname(obj);\n    nh_object_public_init(&nh_object_public, bp);")
    operations = []
    wrappers = []
    for zone, statement, ident, english, ja, article, occurrences in LITERALS:
        if changed.count(statement) != occurrences:
            raise ValueError(f"Original literal anchor {ident} count changed")
        pointer = "prefix" if zone == "prefix" else "bp"
        czone = "NH_OBJECT_PREFIX" if zone == "prefix" else "NH_OBJECT_SUFFIX"
        capacity = "sizeof prefix" if zone == "prefix" else "(size_t) (bp_end - bp) + 1"
        observation = ("{ nh_object_public_begin(&nh_object_public, " + pointer + ", " + czone + ", " + capacity + "); "
                       + statement + " nh_object_public_literal(&nh_object_public, " + pointer
                       + f', "{PREFIX}{ident}", {len(english.encode("utf8"))}, {int(article)}); }}')
        changed = changed.replace(statement, observation)
        operations.append({"kind": "original-literal-output", "id": PREFIX + ident,
                           "statement": statement, "original_occurrences": occurrences,
                           "zone": zone, "native_call_arguments_unchanged": True,
                           "selected_source_identity_not_english_matching": True})
    for item in NUMBERS:
        statement = item["statement"]
        count = item.get("occurrences", 1)
        if changed.count(statement) != count:
            raise ValueError(f"Original numeric anchor {item['id']} count changed")
        captured = statement
        for original, wrapped in item["wrappers"]:
            captured = once(captured, original, wrapped)
            wrappers.append({"original": original, "wrapped": wrapped, "occurrences": count})
        pointer = "prefix" if item["zone"] == "prefix" else "bp"
        czone = "NH_OBJECT_PREFIX" if item["zone"] == "prefix" else "NH_OBJECT_SUFFIX"
        capacity = "sizeof prefix" if item["zone"] == "prefix" else "(size_t) (bp_end - bp) + 1"
        observation = ("{ nh_object_public_begin(&nh_object_public, " + pointer + ", " + czone + ", " + capacity + "); "
                       + captured + " nh_object_public_number(&nh_object_public, " + pointer
                       + f', "{PREFIX}{item["id"]}", {item["kind"]}); }}')
        changed = changed.replace(statement, observation)
        operations.append({"kind": "original-public-printf-input", "id": PREFIX + item["id"],
                           "statement": statement, "original_occurrences": count,
                           "zone": item["zone"], "source_contract": item["visible"],
                           "original_argument_expressions_evaluated_once": True,
                           "native_helper_calls_once": True})
    changed = once(changed, "        Strcat(prefix, tmpbuf);", "        Strcat(prefix, tmpbuf);\n        nh_object_public_article_finish(&nh_object_public, prefix);")
    changed = once(changed, "    return bp;\n}", "    nh_object_public_bind(&nh_object_public, bp);\n    return bp;\n}")
    result = source[:start] + changed + source[end:]
    include = '#include "hack.h"'
    new_include = include + '\n#include "nh-semantic-object-public.h"'
    result = once(result, include, new_include)
    return result, [{"kind": "body", "original": old, "changed": changed,
                     "capture_wrappers": wrappers, "hooks": operations},
                    {"kind": "include", "original": include, "changed": new_include}]


def restore(changed: str, operations: list[dict]) -> str:
    for operation in reversed(operations):
        changed = once(changed, operation["changed"], operation["original"])
    return changed


def verify(source: str, changed: str, operations: list[dict]) -> dict:
    if restore(changed, operations) != source:
        raise ValueError("Incoming source/peer-hook restoration failed")
    _, _, before = body(source)
    _, _, after = body(changed)
    for wrapper in operations[0]["capture_wrappers"]:
        if after.count(wrapper["wrapped"]) != wrapper["occurrences"]:
            raise ValueError("Original capture expression count changed")
        after = after.replace(wrapper["wrapped"], wrapper["original"])
    if native_calls(before) != native_calls(after):
        raise ValueError("Original native call/argument tokens changed or repeated")
    if before.count("xname(obj)") != 1 or after.count("xname(obj)") != 1:
        raise ValueError("Original xname must remain exactly once")
    if changed.index("nh_object_public_init(&nh_object_public, bp);") > changed.index("    bp_end = gx.xnamep + BUFSZ - 1;"):
        raise ValueError("Base snapshot is not before original formatting")
    return {"exact_incoming_source_restoration": True,
            "original_native_calls_and_argument_tokens_preserved": True,
            "original_argument_expressions_evaluated_once": True,
            "base_snapshot_before_original_prefix_suffix_and_buffers": True,
            "all_original_knowledge_guards_and_side_effects_preserved": True,
            "full_native_output_must_equal_captured_piece_sequence": True}


def catalog() -> dict:
    en, ja, schemas = {}, {}, {}
    for _, _, name, _, japanese, _, _ in LITERALS:
        ident = PREFIX + name
        en[ident], ja[ident], schemas[ident] = "{original}", japanese, ["original"]
    for item in NUMBERS:
        ident = PREFIX + item["id"]
        en[ident], ja[ident], schemas[ident] = "{original}", item["ja"], item["union"]
    for n in range(1, 26):
        ident = PREFIX + f"sequence_{n}"
        parts = [f"part_{i}" for i in range(1, n + 1)]
        en[ident], ja[ident], schemas[ident] = "{original}", "".join("{" + p + "}" for p in parts), ["original", *parts]
    return {"en": en, "ja": ja, "argument_schemas": schemas}


def extend_registry(source: str) -> str:
    """Compose once into a read-only caller-provided phase5 registry copy."""
    if "nh_object_public_pool_invalidate" in source:
        raise ValueError("Object public registry hooks already present")
    if "nh_text_name_grammar_capture" not in source or "uint64_t generation;" not in source:
        raise ValueError("Registry composition requires the phase5 owned snapshot/generation extension")
    source = once(source, '#include "hack.h"', '#include "hack.h"\n#include "nh-semantic-object-public.h"')
    anchor = ("void nh_text_name_invalidate_range(const char *pointer, size_t length) {\n"
              "    unsigned i;\n    uintptr_t start = (uintptr_t)pointer;\n")
    source = once(source, anchor, anchor + "    nh_object_public_pool_invalidate(pointer, length);\n")
    return source + "\n" + (PHASE / "bridge-extension.c.in").read_text("utf8")


def generate(output: Path, composed: Path | None = None) -> dict:
    output = output.resolve()
    if not output.is_relative_to(PHASE):
        raise ValueError("Output must remain in assigned phase6-object-producers")
    if sha(UPSTREAM.read_bytes()) != PINNED_SOURCE:
        raise ValueError("Pinned official object source changed")
    pristine = UPSTREAM.read_text("utf8")
    if composed:
        source = composed.read_text("utf8")
    else:
        object_hook = runpy.run_path(str(ROOT / "tools/instrument-semantic-objects.py"))["instrument_text"]
        source, existing = object_hook(pristine)
        if len(existing) != 66:
            raise ValueError("Expected frozen 66 ordinary object hooks")
        source, articles = GRAMMAR["transform_articles"](source)
    changed, operations = transform_objects(source)
    proof = verify(source, changed, operations)
    base_registry = (BASE / "nh-semantic-name.c").read_text("utf8")
    if sha(base_registry) != GRAMMAR["PINNED"]["nh-semantic-name.c"]:
        raise ValueError("Frozen base registry changed")
    if sha((BASE / "nh-semantic-name.h").read_bytes()) != GRAMMAR["PINNED"]["nh-semantic-name.h"]:
        raise ValueError("Frozen registry header changed")
    bridge = extend_registry(GRAMMAR["extend_registry"](base_registry))
    fragment = json.dumps(catalog(), ensure_ascii=False, indent=2) + "\n"
    deliverables = {
        "src/objnam.c": changed,
        "src/nh-semantic-name.c": bridge,
        "include/nh-semantic-name.h": (BASE / "nh-semantic-name.h").read_text("utf8"),
        "include/nh-semantic-name-grammar.h": (BASE / "phase5-grammar/bridge-extension.h.in").read_text("utf8"),
        "include/nh-semantic-object-public.h": (PHASE / "bridge-extension.h.in").read_text("utf8"),
        "catalog-fragment.json": fragment,
        "object-public-only.patch": "".join(difflib.unified_diff(source.splitlines(True), changed.splitlines(True), fromfile="a/src/objnam.c", tofile="b/src/objnam.c")),
    }
    output.mkdir(parents=True, exist_ok=True)
    for relative, text in deliverables.items():
        path = output / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf8", newline="\n")
    lines = pristine.splitlines()
    coverage = []
    for item in PENDING:
        a, z = item["range"]
        coverage.append({**item, "source": "src/objnam.c", "source_blob_sha256": PINNED_SOURCE,
                         "source_evidence": [{"line": i + 1, "text": lines[i]} for i in range(a - 1, min(z, len(lines)))],
                         "runtime_binding_approved": False})
    audit = {"schema_version": 1, "official_commit": COMMIT,
             "status": "source-prepared-uncompiled", "compiled": False, "runtime_verified": False,
             "source": "src/objnam.c", "source_sha256": PINNED_SOURCE,
             "composed_input_sha256": sha(source), "native_source_proof": proof,
             "composition_order": "Frozen ordinary object hooks -> phase5 articles -> this pure doname_base transform; preserve all incoming message/native hooks. Bridge extension appends after phase5 registry extension; integrate once in next explicitly authorized build.",
             "hooks": operations[0]["hooks"],
             "numeric_recipe_contracts": [{"id": PREFIX + item["id"],
                 "original_statement": item["statement"],
                 "original_public_argument_wrappers": item["wrappers"],
                 "full_declared_argument_union": item["union"],
                 "whole_message_ja": item["ja"], "knowledge_guard": item["visible"],
                 "omitted_grammar_arguments": ([{"argument": "english_plural", "reason": "Original plur supplies only English item/items agreement. Japanese retains the already publicly printed contained-stack count and noun; full original source union is preserved."}] if item["id"] == "content_count" else []),
                 "runtime_binding_approved": False} for item in NUMBERS],
             "counts": {"original_output_sites": sum(h["original_occurrences"] for h in operations[0]["hooks"]), "catalog_ids": len(catalog()["en"]), "max_original_piece_count": 24, "base_plus_piece_argument_count": 26},
             "bounds": {"registry_slots": 32, "pool_epoch_ranges": 32, "registry_event_bytes": 4096, "owned_piece_pool_bytes": 4096, "owned_base_event_bytes": 4096, "name_bytes": "BUFSZ including NUL; prefix reads use sizeof prefix, body reads use original bp_end - bp + 1", "generation": "uint64_t registry and native-pool epochs, overflow fails closed", "part_count": 24, "max_formatter_arguments": 26, "tree": "flat parts plus existing bounded base event"},
             "snapshot_lifetime": "Caller-owned stack snapshot copies completed base event/bytes while original registry generation is live. Original range invalidations advance isolated presentation-only pool epochs; any native source slot reuse/release rejects the owned observation even if recycled bytes match. No borrowed temporary/event pointer escapes. Observers verify copied prefix/body/suffix before each recorded mutation; final completed output must match every copied public byte. Registry generation, current pool epoch and output integrity bind only the final returned pointer.",
             "whole_english_fallback": "Missing/stale/unknown base, extra unobserved output piece, truncation, overwrite, unsupported custom/artifact/species/pricing/erosion/name fragment, JSON overflow, or incomplete numeric captures emits no descriptor; native original English and original control flow remain.",
             "coverage_and_pending_contracts": coverage,
             "output_sha256": {name: sha(text) for name, text in deliverables.items()},
             "remaining_checks": ["Independent source review of composition and public knowledge guards", "C compilation/linking and strict warnings", "Native/browser descriptor and full English fallback paths", "State/world/RNG checksums and original call counts", "Registry wrap/reuse, canary, truncation, custom names and full gameplay save/load", "Public erosion, ownership, artifact, corpse/custom, price/currency and conditional wear/hand/light producers"]}
    (output / "source-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    return audit


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=PHASE / "generated")
    parser.add_argument("--source", type=Path, help="Read-only incoming objnam already composed with original object hooks and phase5 articles")
    args = parser.parse_args()
    report = generate(args.output, args.source)
    print(json.dumps({"status": report["status"], "counts": report["counts"], "native_source_proof": report["native_source_proof"]}, indent=2))
