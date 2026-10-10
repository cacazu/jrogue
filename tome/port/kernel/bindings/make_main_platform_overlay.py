"""Append a platform seam to pristine main.c; preserve every source byte."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    raw = args.source.read_bytes()
    for anchor in (b"static lua_State *L = NULL;", b"static void define_core(", b"int main(int argc, char *argv[])" ):
        if raw.count(anchor) != 1:
            raise ValueError("expected exact official main.c anchor: " + anchor.decode())
    newline = b"\r\n" if b"\r\n" in raw else b"\n"
    appendix = newline + b'#include "tome_main_platform.inc"' + newline
    generated = raw + appendix
    args.output.mkdir(parents=True, exist_ok=True)
    target = args.output / "main_platform_state.c"
    target.write_bytes(generated)
    adapter = Path(__file__).resolve().parent
    for filename in ("tome_main_platform.h", "tome_main_platform.inc"):
        shutil.copyfile(adapter / filename, args.output / filename)
    assert generated[:-len(appendix)] == raw
    report = {
        "source_ref": "tome-1.7.6",
        "source": str(args.source.resolve()),
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "generated": str(target.resolve()),
        "generated_sha256": hashlib.sha256(generated).hexdigest(),
        "original_body_byte_identical": True,
        "exports": ["tome_main_get_state", "tome_main_attach_state", "tome_main_initialize_core_metadata"],
        "required_compile_define": "main=tome_desktop_main",
        "scope": "platform entry/state access only; original event/tick/metadata functions retained",
    }
    (args.output / "main-overlay-provenance.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
