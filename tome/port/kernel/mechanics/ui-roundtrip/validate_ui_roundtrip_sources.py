"""Bounded source/JSON/reversal checks; does NOT execute Lua/C/browser/game."""
from __future__ import annotations
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import zipfile

HERE = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def main() -> None:
    spec = importlib.util.spec_from_file_location("dialog_overlay", HERE / "make_dialog_metadata_overlay.py")
    overlay = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(overlay)
    with zipfile.ZipFile(UPSTREAM / "game/engines/te4-1.7.6.teae") as archive:
        original = archive.read(overlay.MEMBER)
        generated = (HERE / "generated" / overlay.MEMBER).read_bytes()
        assert sha(original) == overlay.ORIGINAL_SHA256
        assert generated == overlay.transform(original)
        assert overlay.reverse(generated) == original
        member_count = excerpt_lines = 0
        unique_members = set()
        for name in ("source-evidence.json", "inheritance-source-evidence.json", "handler-source-evidence.json"):
            evidence = json.loads((HERE / "original-dialog-audit" / name).read_text(encoding="utf-8"))
            for member in evidence["members"]:
                if member.get("archive") == "tome":
                    with zipfile.ZipFile(UPSTREAM / "game/modules/tome-1.7.6.team") as module_archive:
                        content = module_archive.read(member["path"])
                else:
                    content = archive.read(member["path"])
                assert sha(content) == member["member_sha256"], member["path"]
                lines = content.decode("utf-8").splitlines()
                for excerpt in member["excerpts"]:
                    actual = lines[excerpt["start_line"]-1:excerpt["end_line"]]
                    assert actual == excerpt["lines"], member["path"]
                    excerpt_lines += len(actual)
                member_count += 1
                unique_members.add(member["path"])
    catalogs = {locale: json.loads((HERE / (locale + ".json")).read_text(encoding="utf-8")) for locale in ("en", "ja")}
    expected = {"ui.roundtrip.title", "ui.roundtrip.body", "ui.roundtrip.yes", "ui.roundtrip.no"}
    for locale, catalog in catalogs.items():
        assert set(catalog) == expected
        for key, value in catalog.items():
            assert isinstance(value, str) and value
            assert set(re.findall(r"\{([a-z_]+)\}", value)) == ({"character_name"} if key == "ui.roundtrip.body" else set())
    source = (HERE / "original-yesno-roundtrip.lua").read_text(encoding="utf-8")
    assert 'local Dialog = require "engine.ui.Dialog"' in source
    assert 'd=Dialog:yesnoPopup(' in source
    assert source.count('name=rawget(player,"name")') == 1
    assert not re.search(r"(?:math\.random|rng\.|updateFOV|canSee\(|game:tick\(|game\.dialogs\[[^\]]+\]\s*=)", source)
    assert 'key:triggerVirtual' not in source  # Actual commands go through the existing guarded original UI adapter.
    assert 'ui.command,record.dialog_handle,record.yes_handle,"ACCEPT"' in source
    assert 'rawget(Key,"current")' in source and 'rawget(Mouse,"current")' in source
    review = (HERE / "original-dialog-audit/REVIEW.md").read_text(encoding="utf-8")
    assert sha((HERE / "original-yesno-roundtrip.lua").read_bytes()) in review
    c = (HERE / "native_yesno_roundtrip.c").read_text(encoding="utf-8")
    assert 'tome_main_get_state()' in c and 'lua_settop(state,top)' in c
    assert 'lua_open(' not in c and 'luaL_newstate(' not in c
    exports = re.findall(r"EMSCRIPTEN_KEEPALIVE const char \*(tome_native_ui_roundtrip_[a-z_]+)\(", c)
    assert len(exports) == 6 and len(set(exports)) == 6
    provenance = json.loads((HERE / "dialog-overlay-provenance.json").read_text(encoding="utf-8"))
    assert provenance["generated_sha256"] == sha(generated)
    assert provenance["catalog"]["sha256"] == sha((HERE / "generated/ui-roundtrip-catalog.lua").read_bytes())
    owned_files = {}
    for path in HERE.rglob("*"):
        if path.is_file() and "__pycache__" not in path.parts and path.name not in ("source-validation.json",):
            owned_files[str(path.relative_to(HERE)).replace("\\", "/")] = {"bytes": path.stat().st_size, "sha256": sha(path.read_bytes())}
    report = {
        "mode": "Static source-only",
        "original_member_sha256": sha(original), "generated_member_sha256": sha(generated),
        "generated_member_bytes": len(generated), "reversal_recovers_original_bytes": True,
        "audited_member_records": member_count, "unique_original_members": len(unique_members),
        "verified_original_excerpt_lines": excerpt_lines,
        "locale_keys_each": len(expected), "body_parameters": {"character_name": "external"},
        "native_exports": exports, "files": owned_files,
        "not_executed": ["Lua syntax/runtime", "C compiler/linker", "native bootstrap", "browser", "original dialog callback", "Rust UI projection", "RNG/query purity", "CJK layout"],
    }
    (HERE / "source-validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "files"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
