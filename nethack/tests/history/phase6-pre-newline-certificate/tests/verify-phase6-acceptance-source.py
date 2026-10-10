#!/usr/bin/env python3
"""Finite source-only checks; never imports JavaScript or starts any engine/process."""
import argparse
import ast
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OWNED = ["tests/prepare-phase6-acceptance-config.py", "tests/browser-host-phase6-stage.mjs",
    "tests/browser-host-phase6-cdp.mjs", "tests/browser-host-phase6-lifecycle.mjs",
    "tests/browser-host-phase6-browser.mjs", "tests/browser-host-phase6-name-producers.mjs",
    "tests/README-phase6-acceptance.md", "tests/verify-phase6-acceptance-source.py"]
SHARED = ["tools/serve-integration.mjs", "tests/browser-host-semantic-cdp.mjs", "tools/run-monitored.py",
    "tools/semantic-text/phase6-immutable-catalog/tests/registered-catalog-wasm.mjs",
    "tools/semantic-text/phase7-buffer-producers/tests/browser-host-phase7-stage.mjs",
    "tools/semantic-text/phase7-buffer-producers/tests/browser-host-phase7-scenarios.mjs",
    "tools/semantic-text/phase7-buffer-producers/tests/browser-host-phase7-compiled-format.mjs"]
METADATA = ["locales/gameplay-core.metadata.json", "work/phase4/semantic-generated/phase4-inputs/metadata.json",
    "work/phase4/semantic-generated/phase4-inputs/diagnostic-wrappers/metadata.json",
    "tools/semantic-text/phase6-native-api/generated/metadata.json"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="build/phase6-acceptance-source-preparation.json")
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    assert output.is_relative_to(ROOT / "build")
    assert not output.is_relative_to(ROOT / "build/phase6/acceptance")
    assert not output.exists(), "Preserve source checkpoints; choose a fresh --output"
    checks = []
    def check(label, condition):
        checks.append({"name": label, "passed": bool(condition)})
    sources = {name: (ROOT / name).read_text("utf8") for name in OWNED + SHARED}
    cfg = sources[OWNED[0]]
    stage = sources[OWNED[1]]
    cdp = sources[OWNED[2]]
    lifecycle = sources[OWNED[3]]
    normal = sources[OWNED[4]]
    native = sources[OWNED[5]]
    p7 = sources[SHARED[5]]
    compiled = sources[SHARED[3]]
    for name in [OWNED[0], OWNED[7], SHARED[2]]:
        ast.parse(sources[name], filename=name)
        check("Python AST: " + name, True)
    guards = [
        ("fresh scoped config/report roots", cfg, ['assert not output.exists()', 'assert not reports.exists()', 'reports.is_relative_to(build / "phase6")']),
        ("exact source-owner API", stage, ['capture.envelope.context.api,api', "assert.equal(entry.api,api)"]),
        ("captured exact original typed union", stage, ['required_argument_union', 'argument.accepted_types', "actualNative.has('src/nh-semantic-name.c')"]),
        ("all runtime source hashes rechecked", stage, ['verifyUnchanged()', 'await runtimeHashes()', 'await verifyNative()', 'for(const ref of references)await bound(ref)']),
        ("canonical consumer binding fields", stage, ['candidate_engine_wasm_sha256', 'consumer_report_sha256', 'generator_manifest_sha256', 'datafile_expected_actual_bytes']),
        ("prepared raw archive identity", stage, ['prepared.archive_sha256', 'prepared.archive_bytes', 'realpath(prepared.actual_archive)']),
        ("prepared raw archive config identity", cfg, ['prepared["archive_sha256"]', 'prepared["archive_bytes"]', 'prepared["actual_archive"]']),
        ("separate binary consumer proofs", stage, ['consumer.consumer_js_sha256', 'consumer.consumer_wasm_sha256', 'original-consumer.cjs', 'original-consumer.wasm', 'await bound(ref)']),
        ("prepared reader and target evidence", stage, ['prepared.candidate_manifest_sha256', 'prepared.generator_manifest_sha256', 'prepared.working_headers', 'prepared.official_functions', 'normalizeFlags', 'engine.target_macros']),
        ("actual embedded payload proof", stage, ['embedded.datafile_entry.actual_bytes', 'embedded.datafile_entry.actual_sha256', 'embedded.emitted_js.loader_sha256', 'embedded.link.embed_argument']),
        ("one successful unit for each compiled input", stage, ['unitSources.has(name)', 'unitSources.add(name)', '[...unitSources].sort()', 'engine.compiled_input_hashes.map']),
        ("compiler unit set config guard", cfg, ['name not in unit_sources', 'unit_sources.add(name)', 'assert unit_sources ==']),
        ("typed duplicate metadata guard", stage, ["'arguments','required_argument_union'", 'existing[field]=structuredClone(entry[field])']),
        ("explicit execution permission remains separate", stage, ["NETHACK_PARENT_SERIAL_SLOT", "'phase6'", "requireExecution()"]),
        ("bounded DevTools transport", cdp, ['AbortSignal.timeout', 'WebSocket handshake timed out']),
        ("transparent metadata-only lifecycle overlay", lifecycle, ['Reflect.apply(original,this,args)', 'expected.sha256', 'text.split(appAnchor).length,2', 'exactPatch', 'servedOverlaySha256']),
        ("catalog release before new registration", lifecycle, ['Both old catalogs release before replacement registrations', 'oldReleases', 'replacement:assertStartupTrace(trace,2)']),
        ("guard both initial locale preparations", lifecycle, ['baseline=owned(),state=native(),focusBefore=focus()', 'Initial locale switch changed', 'preparationCalledExports']),
        ("complete controls retained before baseline and every transition", lifecycle, ["selectionStart", "selectionEnd", "drafts:Array.from(document.querySelectorAll('input,textarea,select'))"]),
        ("full DOM/fallback/canvas/scroll proof", lifecycle, ['document.documentElement.outerHTML', 'toDataURL()', 'modalBody:', 'fullDomAndFallbackEveryTransition:true']),
        ("exact100 bounded ten-step batches", lifecycle, ['start<100;start+=10', 'transitions:10', 'iterations:100']),
        ("registered-only repaint whitelist", lifecycle, ['stage.renderExport', 'calls.every(name=>name===stage.renderExport)', 'nh_rust_format_registered']),
        ("earliest expectation paints guarded", lifecycle, ['export async function paintLocale', 'focus:focus()', 'Exact-frame locale paint changed C/world/RNG']),
        ("normal acceptance uninstrumented", normal, ['report.lifecycleInstrumentation = false', 'guardedLocale', 'sourceOwner']),
        ("exact public glass appearance identity", native, ['nethack.public.appearance.glass_orb.97eda687ce', 'appearanceSource', 'crystal_ball', 'source_enum']),
        ("known native source ownership", native, ['nethack.message.lock.pick_lock.pline.i_don_t_think_s_would_appreciate.96869543af', 'sourceOwner', 'expiredGetter,0']),
        ("numerical wrong-callback/window and QUESTION alternate menu probes", native, ["windowId+0x400000])!==0", "phase6_wrong_callback", "alternateWindow of [-1,0,1,7]", "QUESTION getter inherited an uncertified alternate menu window"]),
        ("protected original hallucination fallback", native, ['originalC', 'upstream-english', 'nativeHallucination']),
        ("same-page catalog lifecycle and retained output", native, ['assertReplacementTrace', 'endedReplay', 'nativeKnownNameEvidence', 'storagePending']),
        ("all Phase7 stress checks use shared full-history hook", native, ['stage.repaintInvariant=', 'report.repaintMeasurements??[]).reduce']),
        ("Phase7 hook assertions are mandatory", p7, ['stage.repaintInvariant', 'initialSwitchInvariantVerified', 'fullDomAndFallbackEveryTransition']),
        ("compiled boundary fixtures separate native producer claims", compiled, ["native_callback_semantics_verified:false", "game_loop_started:false", "compiled_pipeline_verified:false", "MAX_OUTPUT=128*1024", "MAX_GAMEPLAY=256*1024"]),
        ("QUESTION alternate menu limitation recorded", sources[OWNED[6]], ['shim_yn_function', 'yn_menu', 'shim_end_menu', 'pending']),
    ]
    for label, source, tokens in guards:
        check(label, all(token in source for token in tokens))
    check("compiled evidence exclusively reserved before factory", compiled.index("const reservation=await reserveReport") < compiled.index("const factory=") and "open(reportPath,'wx')" in compiled and "mkdir(stage.results,{recursive:false})" in compiled)
    check("compiled adapter retains32 grouped fixtures", compiled.count("await check(") == 32)
    check("both owned snapshots preserve control values/carets", lifecycle.count("drafts:Array.from(document.querySelectorAll('input,textarea,select'))") == 2)
    entries = {}
    conflicts = []
    metadata_refs = []
    for name in METADATA:
        path = ROOT / name
        data = json.loads(path.read_text('utf8'))
        metadata_refs.append({"path": name, "sha256": sha(path), "entries": len(data['entries'])})
        for entry in data['entries']:
            previous = entries.setdefault(entry['id'], {})
            for field in ['api', 'category', 'source_field', 'source_english_literal', 'arguments', 'required_argument_union']:
                if field in previous and field in entry and previous[field] != entry[field]:
                    conflicts.append({"id": entry['id'], "field": field})
                elif field in entry:
                    previous[field] = entry[field]
    check("frozen source metadata union has no conflicts", not conflicts)
    historical = []
    for name in ["build/phase4/acceptance-config.json", "build/phase4/acceptance/acceptance-handoff.json", "build/phase4/acceptance/native-name-verification.json"]:
        path = ROOT / name
        if path.exists():
            historical.append({"path": name, "sha256": sha(path), "read_only_observation": True})
    failed = [item['name'] for item in checks if not item['passed']]
    report = {"schema_version": 1, "status": "source-structural-checks-passed" if not failed else "source-structural-checks-failed",
        "created_at": datetime.now(timezone.utc).isoformat(), "checks_passed": len(checks) - len(failed), "checks_failed": len(failed),
        "checks": checks, "failures": failed, "metadata_unique_ids": len(entries), "metadata_conflicts": conflicts,
        "source_files": [{"path": name, "sha256": sha(ROOT / name)} for name in OWNED + SHARED],
        "metadata_files": metadata_refs, "historical_read_only_observations": historical,
        "python_ast_verified": True, "javascript_syntax_verified": False, "node_invoked": False,
        "wasm_invoked": False, "browser_invoked": False, "compiler_invoked": False,
        "native_callback_semantics_verified": False, "compiled_pipeline_verified": False,
        "execution_permission": "Parent serial slot still required after final build plus data gate",
        "scope": "Python AST, exact source hashes, source guard structure and frozen metadata union only; no JavaScript syntax or runtime result"}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')
    print(json.dumps({"report": output.relative_to(ROOT).as_posix(), "sha256": sha(output), "passed": report['checks_passed'], "failed": len(failed), "failures": failed, "runtime_invoked": False}))
    raise SystemExit(bool(failed))


if __name__ == '__main__':
    main()
