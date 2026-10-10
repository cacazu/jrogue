"""NGPL, 2026-10-02: finite JSON/source-provenance checks, no JS/test execution."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
PROPOSAL = HERE.parent
ROOT = HERE.parents[3]
SOURCE = ROOT.parent / "official-source-audit/NetHack-5.0.0"
sha = lambda b: hashlib.sha256(b).hexdigest()
plan = json.loads((HERE / "browser-host-phase7-plan.json").read_text(encoding="utf-8"))
catalog_bytes = (PROPOSAL / "generated/prototype/catalog-fragment.json").read_bytes()
catalog = json.loads(catalog_bytes)["entries"]
checks = []

def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append({"name": name, "passed": True, "scope": "JSON/source-provenance-only"})

check("frozen-seven-frame-catalog-hash", sha(catalog_bytes) == plan["input_catalog_sha256"] == "7e9fc87d9404f98f16e42edd5e2839d26e32507938a1c07cfffe7f137fc4af52")
check("all-seven-IDs-exactly-once", len(plan["branches"]) == 7 and len({b["id"] for b in plan["branches"]}) == 7 and {b["id"] for b in plan["branches"]} == {b["id"] for b in catalog})
by_id = {b["id"]: b for b in plan["branches"]}
check("all-frozen-EN-JA-unions-source-contracts-retained", all(all(by_id[b["id"]][field] == b[field] for field in b) for b in catalog))
check("all-runtime-bindings-and-execution-claims-false", plan["compiled"] is False and plan["browser_executed"] is False and plan["runtime_binding_approved"] is False and all(b["runtime_binding_approved"] is False and b["compiled_status"] == "not-run" for b in plan["branches"]))
check("two-normal-five-original-debug-blocked-not-passed", sum(b["actual_native_browser_status"] == "not-run" for b in plan["branches"]) == 2 and sum(b["actual_native_browser_status"] == "blocked-original-debug-policy" for b in plan["branches"]) == 5)
check("all-three-original-file-hashes-still-exact", all(sha((SOURCE / b["source"]).read_bytes()) == b["source_sha256"] for b in plan["branches"]))
cmd = (SOURCE / "src/cmd.c").read_text(encoding="utf-8")
pager = (SOURCE / "src/pager.c").read_text(encoding="utf-8")
pickup = (SOURCE / "src/pickup.c").read_text(encoding="utf-8")
check("actual-normal-key-and-native-search-routes-source-confirmed", 'M(\'?\'), "?", "list all extended commands"' in cmd and 'doc_extcmd_flagstr(menuwin, (struct ext_func_tab *) 0)' in cmd and 'if (*searchbuf && !n)' in cmd)
check("percent-c-route-requires-original-showtrap-caret-prompt", 'getdir("^")' in pager and "(s && *s == '^') ? dirsym : '\\0'" in cmd and 'static const char wiz_only_list[] = "EFGIVW";' in cmd)
check("count-prompt-original-filter-autoselect-end-menu-source-confirmed", all(token in pickup for token in ['Sprintf(qbuf, "Pick %d of what?", count);', 'n_or_more);', 'if (n == 1 && (qflags & AUTOSELECT_SINGLE))', 'end_menu(win, qstr);', 'if ((qflags & FEEL_COCKATRICE)']))
check("future-count-contracts-explicitly-unimplemented", len(plan["future_count_cases"]) == 6 and all(case["status"] == "pending-source-contract-and-authentic-fixture" and case["runtime_binding_approved"] is False for case in plan["future_count_cases"]))
check("compiled-C-ownership-groups-remain-unrun", len(plan["compiled_cases"]) == 11 and all(case["status"] == "not-run" for case in plan["compiled_cases"]))
modules = [HERE / f"browser-host-phase7-{name}.mjs" for name in ("stage", "scenarios", "compiled-format")]
module_text = "\n".join(p.read_text(encoding="utf-8") for p in modules)
check("adapters-have-no-launch-factory-core-field-or-identity-bypass", all(token not in module_text for token in ["launchChrome(", "serveIntegration(", "createNetHackModule(", "callMain=", "FS.writeFile(", "HEAP32[", "wizard =", "_getuid", "getpwnam="]))
check("actual-native-and-synthetic-compiled-evidence-distinguished", "synthetic-typed-envelope-with-actual-compiled-Rust" in module_text and "actual_native_buffer_producer_verified:false" in module_text and "blocked-original-debug-policy" in module_text)
check("getter-observed-only-at-original-callback-for-source-capture", "window.__jrogueNetHackShim=async(name,...args)" in module_text and "return await original(name,...args)" in module_text and "100" in module_text and "wrong callback" in module_text)
check("Phase6-registered-only-repaint-and-explicit-registered-fixture-lifecycle", "shared.calledExports,[stage.renderExport]" in module_text and "config.render_export,'nh_rust_format_registered'" in module_text and "nh_rust_catalog_register" in module_text and "nh_rust_catalog_release" in module_text and all(old not in module_text for old in ["nh_rust_format_gameplay", "nh_rust_format_fallback", "gameplayCatalogPtr"]))
check("mandatory-one-shared100-hook-with-exact-ten10-batches", "typeof stage.repaintInvariant,'function'" in module_text and "const shared=await stage.repaintInvariant(page,label)" in module_text and "shared.iterations,100" in module_text and "shared.batches.length,10" in module_text and "[index*10,10]" in module_text and "count+batch.transitions,0),100" in module_text)
check("shared-first-baselines-DOM-history-fallback-and-native-observers-required", all(token in module_text for token in ["shared.fullDomAndFallbackEveryTransition,true", "shared.completeOwnedHistoryRetained,true", "shared.initialSwitchInvariantVerified,true", "const before=await state(page)", "const after=await state(page)", "actual callback/window", "history:JSON.stringify(t.host.history)"]))
check("exact-frame-first-two-paints-bracketed-before-source-baseline", all(token in module_text for token in ["framePreparationBefore=await state(page)", "result.calls.every(name=>name===stage.renderExport)", "assert.deepEqual(after,framePreparationBefore", "framePreparationPaints:2", "activeControl:focus()", "document.activeElement"]))
check("source-owner-existence-checked-before-hash-claim", "actualNative.has(branch.source)" in module_text and "staged_native_source_sha256:actualNative.get(branch.source)" in module_text)
artifacts = [HERE / "prepare-acceptance-plan.py", HERE / "verify-acceptance-plan.py", HERE / "browser-host-phase7-plan.json", HERE / "ACCEPTANCE-PREPARATION.md", *modules]
report = {"schema_version": 1, "status": "prepared-plan-source-consistency-passed", "checks_passed": len(checks), "checks": checks,
          "compiled": False, "browser_executed": False, "Node_syntax_checked": False,
          "runtime_binding_approved": False,
          "scope": "Frozen JSON/source provenance and explicit classifications; textual adapter guard inspection is not a JavaScript parse, test run, native/C/ABI/allocator/Asyncify proof.",
          "artifacts": [{"path": str(path.relative_to(PROPOSAL)).replace("\\", "/"), "bytes": path.stat().st_size, "sha256": sha(path.read_bytes())} for path in artifacts]}
(HERE / "acceptance-plan-source-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"checks_passed": len(checks), "compiled": False, "browser_executed": False, "Node_syntax_checked": False}))
