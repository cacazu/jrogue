"""Source-only, reversible semantic provenance extension of ORIGINAL yesnoPopup.

No Lua execution. Preserve existing eight-argument calls and every original action.
Root may compose transform(original_bytes) with its separately audited i18n overlay.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

HERE = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
MEMBER = "engine/ui/Dialog.lua"
ORIGINAL_SHA256 = "c1fc95e83d7031073324d43fbdcfaef6a6cc1ace8bbd7cdb7ae31adaa3be60bd"
SIGNATURE = b"function _M:yesnoPopup(title, text, fct, yes_text, no_text, no_leave, escape, preexit_fct)"
EXTENDED_SIGNATURE = SIGNATURE[:-1] + b", web_text_tokens)"
MARKER = b"-- Explicit construction provenance; existing calls preserve original behavior.\n_M.__TOME_WEB_YESNO_METADATA_PROTOCOL = 1\n"
VALIDATE = b'''\n\tlocal web_ui
\tif web_text_tokens ~= nil then
\t\tweb_ui = assert(rawget(_G, "__TOME_WEB_UI"), "Original UI provenance seam is absent")
\t\tassert(type(web_ui.bind_text) == "function", "Original UI provenance binding is absent")
\t\tassert(type(web_text_tokens) == "table", "Original popup provenance must be a table")
\t\tfor _, role in ipairs({"title", "body", "yes", "no"}) do
\t\t\tlocal token = web_text_tokens[role]
\t\t\tassert(type(token) == "table" and token.kind == "semantic" and type(token.id) == "string" and token.id ~= "" and type(token.args) == "table", "Original popup requires explicit semantic provenance for " .. role)
\t\tend
\tend'''
BIND = b'''\tif web_ui then
\t\t-- Factory-owned identities, before the original registration/hooks.
\t\tweb_ui.bind_text(d, "title", web_text_tokens.title)
\t\tweb_ui.bind_text(d.uis[1].ui, "text", web_text_tokens.body)
\t\tweb_ui.bind_text(ok, "text", web_text_tokens.yes)
\t\tweb_ui.bind_text(cancel, "text", web_text_tokens.no)
\tend
'''
ANCHOR = b"\td:setFocus(ok)\n\td:setupUI(true, true)\n\n\tgame:registerDialog(d)\n\treturn d\nend"
REPLACEMENT = ANCHOR.replace(b"\tgame:registerDialog(d)", BIND + b"\tgame:registerDialog(d)")

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def transform(data: bytes, *, exact_upstream: bool = True) -> bytes:
    if exact_upstream and sha(data) != ORIGINAL_SHA256:
        raise ValueError("Original Dialog member hash changed")
    if data.count(SIGNATURE) != 1:
        raise ValueError("Exact original yesnoPopup construction anchors changed")
    if b"__TOME_WEB_YESNO_METADATA_PROTOCOL" in data:
        raise ValueError("Popup provenance extension already exists")
    start = data.index(SIGNATURE)
    end = data.index(b"\nfunction _M:yesnoLongPopup(", start)
    factory = data[start:end]
    if factory.count(ANCHOR) != 1:
        raise ValueError("Exact original short yesnoPopup registration anchor changed")
    factory = factory.replace(SIGNATURE, MARKER + EXTENDED_SIGNATURE + VALIDATE, 1)
    factory = factory.replace(ANCHOR, REPLACEMENT, 1)
    result = data[:start] + factory + data[end:]
    if reverse(result) != data:
        raise AssertionError("Original bytes were not preserved reversibly")
    return result

def reverse(data: bytes) -> bytes:
    data = data.replace(REPLACEMENT, ANCHOR, 1)
    return data.replace(MARKER + EXTENDED_SIGNATURE + VALIDATE, SIGNATURE, 1)

def generate_catalog() -> dict:
    catalogs = {lang: json.loads((HERE / (lang + ".json")).read_text(encoding="utf-8")) for lang in ("en", "ja")}
    if set(catalogs["en"]) != set(catalogs["ja"]):
        raise ValueError("Locale keys differ")
    # UTF-8 Lua strings use JSON-compatible escapes here; no control chars or \u escapes.
    lines = ["-- Generated from explicit EN/JA JSON; no rendered-string lookup.", "return {"]
    for lang, catalog in catalogs.items():
        lines.append("  " + lang + " = {")
        for key, value in sorted(catalog.items()):
            if any(ord(char) < 32 for char in key + value):
                raise ValueError("Catalog contains unsupported control character")
            lines.append("    [" + json.dumps(key, ensure_ascii=False) + "] = " + json.dumps(value, ensure_ascii=False) + ",")
        lines.append("  },")
    lines.append("}\n")
    output = HERE / "generated" / "ui-roundtrip-catalog.lua"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes("\n".join(lines).encode("utf-8"))
    return {"path": str(output.relative_to(HERE)), "bytes": output.stat().st_size, "sha256": sha(output.read_bytes())}

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Parent-composed semantic source; checks exact factory anchors rather than pristine hash")
    args = parser.parse_args()
    if args.input:
        original = args.input.read_bytes()
    else:
        with zipfile.ZipFile(UPSTREAM / "game/engines/te4-1.7.6.teae") as archive:
            original = archive.read(MEMBER)
    generated = transform(original, exact_upstream=not bool(args.input))
    output = HERE / "generated" / MEMBER
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(generated)
    report = {
        "upstream_version": "1.7.6", "original_member": MEMBER,
        "pristine_original_sha256": ORIGINAL_SHA256,
        "input_sha256": sha(original), "input_bytes": len(original),
        "generated_path": str(output.relative_to(HERE)),
        "generated_sha256": sha(generated), "generated_bytes": len(generated),
        "reversal_recovers_input_bytes": reverse(generated) == original,
        "extension": "Optional ninth argument attaches four explicit tokens before original registerDialog164; existing eight-argument calls remain unchanged",
        "catalog": generate_catalog(),
        "validation": "Static generation and byte reversal only; no Lua/native/browser execution",
    }
    (HERE / "dialog-overlay-provenance.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))

if __name__ == "__main__":
    main()
