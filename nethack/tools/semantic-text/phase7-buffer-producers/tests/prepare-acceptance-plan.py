"""NGPL, 2026-10-02: prepare pending isolated Phase7 acceptance, never run it."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
PROPOSAL = HERE.parent
catalog_path = PROPOSAL / "generated/prototype/catalog-fragment.json"
catalog_bytes = catalog_path.read_bytes()
catalog_hash = hashlib.sha256(catalog_bytes).hexdigest()
assert catalog_hash == "7e9fc87d9404f98f16e42edd5e2839d26e32507938a1c07cfffe7f137fc4af52"
entries = json.loads(catalog_bytes)["entries"]
assert len(entries) == 7

branches = []
for entry in entries:
    normal = entry["source"] == "src/cmd.c"
    branches.append({
        **entry,
        "source_review_status": "reviewed-source-only",
        "compiled_status": "not-run",
        "actual_native_browser_status": "not-run" if normal else "blocked-original-debug-policy",
        "browser_route": (
            "Original #? / doextlist; doc_extcmd_flagstr(menuwin,NULL) adds the menu-prefix footnote."
            if entry["producer_line"] == 536 else
            "Original ^ / #showtrap -> pager.c:2342 getdir(\"^\"); invalid p with original cmdassist enabled selects help_dir %c assistance."
            if normal else
            "Original getlev selected mismatched level-file branch, wizard display gate, and subsequent trickery. No core/save identity patch is authorized."
            if entry["source"] == "src/restore.c" else
            "Original #timeout command; its WIZMODECMD authorization and selected runtime conditional must actually admit this row. No wizard flag/identity bypass."
        ),
        "required_actual_evidence": [
            "Exact frozen isolated build/WASM/JS/catalog/prototype/combined-source hashes.",
            "Source-selected envelope read synchronously only during the accepted original callback with matching channel/window.",
            "Exact source EN replay and expected whole JA using the original captured typed union.",
            "Original callback attributes, native input bytes/accelerators and prompt/menu behavior preserved.",
            "Stable pending dialog: 100 locale/repaint cycles preserve state/raw/world/RNG checksums, owned descriptors, input counters and active drafts/selections.",
        ],
        "fixture_limit": "Compiled bridge values alone do not certify that this original native producer branch was reached.",
    })

compiled_cases = [
    ("all-seven-original-wrapper-formats", "Compile the exact generated per-file wrappers and private bridge against the composed six-field semantic ABI. Feed controlled public fixture scalars/key once; compare original C English bytes, full typed args and callback channel. These are seven bridge fixture cases, not seven original game branches."),
    ("signed-long-unsigned-and-character", "Exercise signed int extrema, wasm32 long extrema, UINT32_MAX as nonnegative unsigned, and promoted %c bytes including ASCII P. Compare exact C printf behavior and Rust format; do not display %c as decimal."),
    ("owned-key-before-original-write", "Change/reuse the technical key source only after the wrapper's capture and original format have completed. The delivered heap argument remains the originally consumed key. No name registration/query."),
    ("bounds-and-canaries", "For observer-only APIs, use actual guarded 128/256-byte destination arrays. Missing NUL, exact final-boundary length, invalid capacity/count, missing slot and partial UTF-8 must yield original-English fallback without canary changes. Never overflow original Sprintf to manufacture this case."),
    ("overlap-and-alias", "Original-input/destination overlap rejects metadata; identical bytes in another allocation cannot consume the owner's ticket. Preserve the actual original API call/result without asserting undefined upstream overlap formatting behavior."),
    ("unknown-write-barrier", "Invalidate before an unproven overwrite, including a same-byte overwrite. Reused generation and changed bytes cannot resurrect an old event. Byte equality alone is not proof of an unobserved same-byte write."),
    ("one-use-and-wrap", "A delivery consumes its ticket once; a second delivery is English. UINT64_MAX generation never wraps into a valid old generation. Null/invalid owner still executes original output."),
    ("allocation-failure-and-nested-owner", "Isolated test allocator faults only presentation nh_text_begin allocations. Inner failure cancels pending outer presentation ownership; original callback occurs once with no borrowed outer ID. Do not fault or alter game allocations."),
    ("native-filter-and-owner-precedence", "Use actual composed original add_menu/vpline entry claims and existing filter paths. No speculative getter or new row/history/sound output. Suppressed messages/rows remain suppressed; unrelated nested output cannot consume this source ID."),
    ("asyncify-owned-lifetime", "Pause an actual accepted menu/text callback across Asyncify. Native scope owns descriptor/text independently after local invalidation. Read-only repaint uses the frozen host event; descriptor is absent before/after actual emission and for wrong callback/window."),
    ("copied-returned-precision-fallback", "Copy/append/returned/opaque/precision paths are not supported by this seven-branch proposal. Exercise them as explicit whole-English negative cases until exact reviewed producer/copy tickets are implemented; never register a raw or immutable literal pointer."),
]

future_count_cases = [
    {"name": "count-menu-accepted-prompt", "route": "Original -X wishing and drop commands create at least two non-merging stacks with quantity >=2 on the same visible square; original 2, count-pickup follows pickup.c:766 -> query_objlist:768 -> end_menu:1166.", "assert": "Only the accepted end_menu prompt receives the source-selected count event/window; original item filters/sorting/display RNG/name calls execute once and no prompt ID attaches to item rows. Count remains original int. Cancel selection without fabricating a pickup."},
    {"name": "count-native-quantity-filter", "route": "Use original wishes/drop commands to leave a second stack below the requested count. n_or_more at pickup.c:460 excludes it by original quantity.", "assert": "No new query changes counts/knowledge; excluded objects stay excluded. If one qualifies, original AUTOSELECT_SINGLE returns without end_menu and without a prompt event."},
    {"name": "count-auto-select", "route": "Original 2, on a square with exactly one qualifying stack.", "assert": "query_objlist:1072 auto-selects and returns before creating a menu. Observe no count-prompt end_menu/event, allow original actual pickup/time changes, then test locale-only invariance at the next stable wait."},
    {"name": "count-none-early-return", "route": "Original 2, with no qualifying object or an empty original object list.", "assert": "query_objlist:1047/1069 returns before menu construction. No phantom prompt/event/ticket leaks into the next original output."},
    {"name": "cockatrice-before-end-menu", "route": "Pending authentic original gameplay setup for FEEL_COCKATRICE query path at pickup.c:1111-1116, distinct from count path which does not set this flag.", "assert": "Original destroy/look_here/unsortloot early return remains authoritative; no prompt emitted before accepted end_menu. Never add the flag or fabricate a corpse/native field for the test."},
    {"name": "copied-qstr-unsupported", "route": "Separate compiled owned-buffer fixture copies/changes qstr or invalidates caller storage before consumer; actual game copy paths need source contracts first.", "assert": "Unknown alias/copy remains exact English and cannot attach to unrelated menu/window. Do not count fixture fallback as actual pickup producer coverage."},
]

plan = {
    "schema_version": 1,
    "stage": "phase7-source-only-acceptance-preparation",
    "runtime_binding_approved": False,
    "compiled": False,
    "browser_executed": False,
    "input_catalog_sha256": catalog_hash,
    "scope": "Seven bounded formatter branches, six consumers; future pickup/copy cases are separate unimplemented contracts.",
    "counts": {"formatter_branches": 7, "consumer_sites": 6, "source_files": 3, "normal_browser_candidates": 2, "debug_browser_blocked": 5, "compiled_case_groups": len(compiled_cases), "future_count_cases": len(future_count_cases)},
    "branches": branches,
    "compiled_cases": [{"name": name, "requirements": text, "status": "not-run", "evidence_class": "isolated-compiled-bridge-and-native-boundary-fixture"} for name, text in compiled_cases],
    "future_count_cases": [{**case, "status": "pending-source-contract-and-authentic-fixture", "runtime_binding_approved": False} for case in future_count_cases],
    "execution_gate": [
        "Parent-approved serial heavy slot and measured memory headroom; preparing/importing the adapter is not permission to start a browser/compiler/server.",
        "Complete isolated Phase6+Phase7 composition frozen under build/, no active or historical web default.",
        "One owned Chrome tree and one active WASM page, sequential scenarios; close/drain processes and record memory before/peak/after.",
        "Explicit new report directory build/phase7-acceptance-* and separate native-producer/compiled-fixture/pending statuses. Never overwrite historical reports.",
        "Original -D remains blocked by libc getpw stubs. No uid/getpwnam/sysconf/WIZARDS/wizard/core-field/native save identity bypass.",
    ],
}
target = HERE / "browser-host-phase7-plan.json"
target.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"path": str(target), "counts": plan["counts"], "compiled": False, "browser_executed": False}))
