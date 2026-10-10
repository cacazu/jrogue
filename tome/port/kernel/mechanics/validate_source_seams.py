"""Independent source/hash/reversibility checks, explicitly not Lua execution."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    source_manifest = json.loads((ROOT / "source-provenance.json").read_text(encoding="utf-8"))
    checked = 0
    for item in source_manifest["files"]:
        if "archive" in item:
            with zipfile.ZipFile(UPSTREAM / item["archive"]) as archive:
                original = archive.read(item["source"])
            copy = (ROOT / "source" / item["source"]).read_bytes()
            assert copy == original, item["source"]
        else:
            path = Path(item["source"])
            original = (path if path.is_absolute() else UPSTREAM / path).read_bytes()
        assert sha(original) == item["sha256"] and len(original) == item["bytes"], item["source"]
        checked += 1
    game = json.loads((ROOT / "game-render-overlay-provenance.json").read_text(encoding="utf-8"))
    savepipe = json.loads((ROOT / "savepipe-platform-overlay-provenance.json").read_text(encoding="utf-8"))
    for manifest in [game, savepipe]:
        with zipfile.ZipFile(UPSTREAM / manifest["archive"]) as archive:
            original = archive.read(manifest["member"])
        generated = (ROOT / "generated" / manifest["member"]).read_bytes()
        assert sha(original) == manifest["original_sha256"]
        assert sha(generated) == manifest["generated_sha256"]
        reverted = generated.decode("utf-8")
        changes = game["replacements"] if manifest is game else [{"before": manifest["original_before"], "after": manifest["platform_after"]}]
        for change in reversed(changes):
            assert reverted.count(change["after"]) == 1
            reverted = reverted.replace(change["after"], change["before"], 1)
        assert reverted.encode("utf-8") == original
    scheduler = (ROOT / "generated/original_wasd_schedule.lua").read_bytes()
    assert sha(scheduler) == game["scheduler_sha256"]
    wasd = game["replacements"][3]["before"].encode("utf-8")
    assert scheduler.count(wasd) == 1 and sha(wasd) == game["original_wasd_block_sha256"]
    # Check only source API contracts. These assertions do not establish syntax,
    # runtime callbacks, thread quiescence, original gameplay or browser durability.
    adapter = (ROOT / "save_boundary.lua").read_text(encoding="utf-8")
    assert "state.game:saveGame()" in adapter and "coroutine.resume(co)" in adapter
    assert "pcall(self.state.serial.browserPump, 1, 65536)" in adapter
    assert "native_status.completions ~= 0" in adapter
    assert "core.serial.popSaveReturn()" not in adapter
    assert "game:tick()" in adapter  # explanatory comment, never an executable call
    assert not any(line.strip().startswith("game:tick(") for line in adapter.splitlines())
    boundary = (ROOT / "render_boundary.lua").read_text(encoding="utf-8")
    assert boundary.count("game:updateFOV()") == 2  # primary and original native-tail invocation
    assert "original_wasd_schedule(game, recorded_repeat_keyframes)" in boundary
    assert "function self:beforeFrame(game)" in boundary
    assert "host.simulation_revision(game)" in boundary
    native = json.loads((ROOT / "native-map-overlay-provenance.json").read_text(encoding="utf-8"))
    native_original = (UPSTREAM / native["source"]).read_bytes()
    native_generated = (ROOT / "generated/src/map_prepared.c").read_bytes()
    assert sha(native_original) == native["original_sha256"]
    assert sha(native_generated) == native["generated_sha256"]
    native_text = native_generated.decode("utf-8")
    assert native_text.endswith(native["append_suffix"])
    native_reversed = native_text[:-len(native["append_suffix"])]
    for change in reversed(native["replacements"]):
        assert native_reversed.count(change["after"]) == 1
        native_reversed = native_reversed.replace(change["after"], change["before"], 1)
    assert native_reversed.encode("utf-8") == native_original
    assert sha((ROOT / "tome_map_prepare.inc").read_bytes()) == native["helper_sha256"]
    assert sha((ROOT / "tome_map_prepare.h").read_bytes()) == native["header_sha256"]
    catalogs = [json.loads((ROOT / f"{locale}.save-platform.json").read_text(encoding="utf-8")) for locale in ["en", "ja"]]
    assert set(catalogs[0]) == set(catalogs[1]) and len(catalogs[0]) == 4
    sites = json.loads((ROOT / "save-platform-text-manifest.json").read_text(encoding="utf-8"))
    assert {site["id"] for site in sites} == set(catalogs[0])
    for site in sites:
        assert site["en"] == catalogs[0][site["id"]]
        assert f'_t"{site["en"]}"' in savepipe["platform_after"]
        assert site["placeholders"] == []
    callback_ledger = json.loads((ROOT / "lua-hooks-audit-work/display-callbacks.json").read_text(encoding="utf-8"))
    callback_evidence = json.loads((ROOT / "lua-hooks-audit-work/source-evidence.json").read_text(encoding="utf-8"))
    excerpt_lines = 0
    for member in callback_evidence["members"]:
        if member["archive"] == "native":
            data = (UPSTREAM / member["path"]).read_bytes()
        else:
            with zipfile.ZipFile(UPSTREAM / callback_ledger["archives"][member["archive"]]) as archive:
                data = archive.read(member["path"])
        assert sha(data) == member["member_sha256"] and len(data) == member["member_bytes"]
        lines = data.decode("utf-8").splitlines()
        assert len(lines) == member["line_count"]
        for excerpt in member["excerpts"]:
            assert lines[excerpt["start_line"]-1:excerpt["end_line"]] == excerpt["lines"]
            excerpt_lines += len(excerpt["lines"])
    report = {"scope": "source-only verification", "pass": True,
              "pristine_sources_verified": checked, "reversible_overlays": 3,
              "game_site_relocations": len(game["replacements"]),
              "verbatim_original_wasd_schedule": True,
              "native_tail_fov_guard": "explicit original preparation token; no side-effect omission",
              "native_callback_getter": "read-only bounded FNV/opaque-ref diagnostics; not purity proof",
              "callback_evidence_members": len(callback_evidence["members"]),
              "unchanged_callback_excerpt_lines": excerpt_lines,
              "literal_level_hook_entries": len(callback_ledger["level_hooks"]),
              "save_platform_text_ids": len(catalogs[0]),
              "lua_syntax_checked": False, "native_compile_or_link": False,
              "original_lua_executed": False, "browser_tested": False,
              "deterministic_checkpoint_proven": False, "full_render_purity_proven": False}
    (ROOT / "source-validation-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
