"""Expose retained core_lua.c Gaussian state without rewriting its algorithm.

Writes only to the supplied adapter output directory. The upstream remains
pristine. All original bytes are reconstructed/verified after reversing the
three-local relocation and removing the appended snapshot adapter.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def generate(source: Path, output: Path) -> dict:
    raw = source.read_bytes()
    text = raw.decode("utf-8")
    newline = "\r\n" if "\r\n" in text else "\n"
    function_anchor = "static int rng_normal_float(lua_State *L)"
    if text.count(function_anchor) != 1:
        raise ValueError("expected exactly one official normalFloat function")
    local_expression = re.compile(
        r"\tstatic bool stored = FALSE;\r?\n"
        r"\tstatic double z0;\r?\n"
        r"\tstatic double z1;\r?\n"
    )
    matches = list(local_expression.finditer(text))
    if len(matches) != 1:
        raise ValueError("expected the exact three original cached locals once")
    match = matches[0]
    if not text.index(function_anchor) < match.start() < text.index("static const struct luaL_Reg rnglib"):
        raise ValueError("cached locals are outside the expected original function")
    local_block = match.group()
    file_block = "".join(line.removeprefix("\t") for line in local_block.splitlines(keepends=True))
    removed = text[:match.start()] + text[match.end():]
    retained = removed.replace(function_anchor, file_block + newline + function_anchor, 1)
    reversed_body = retained.replace(file_block + newline + function_anchor, function_anchor, 1)
    # Reinsertion at the original byte offset proves all non-cache source bytes
    # are retained, including rng_seed's unchanged cache-reset semantics.
    reversed_body = reversed_body[:match.start()] + local_block + reversed_body[match.start():]
    if reversed_body.encode("utf-8") != raw:
        raise AssertionError("overlay does not reconstruct the pristine source")
    appendix = newline + '#include "tome_normal_snapshot.inc"' + newline
    emitted = (retained + appendix).encode("utf-8")
    output.mkdir(parents=True, exist_ok=True)
    target = output / "core_lua_rng_state.c"
    target.write_bytes(emitted)
    adapter_root = Path(__file__).resolve().parent
    for filename in ("tome_normal_snapshot.h", "tome_normal_snapshot.inc"):
        if (adapter_root / filename).resolve() != (output / filename).resolve():
            shutil.copyfile(adapter_root / filename, output / filename)
    report = {
        "source_ref": "tome-1.7.6",
        "source": str(source.resolve()),
        "source_sha256": digest(raw),
        "generated": str(target.resolve()),
        "generated_sha256": digest(emitted),
        "original_reconstruction_exact": True,
        "normal_float_algorithm_changed": False,
        "seed_cache_reset_changed": False,
        "relocated_original_locals": ["static bool stored = FALSE;", "static double z0;", "static double z1;"],
        "cache_snapshot_bytes": 36,
        "scope": "Gaussian cache only; combine with the retained SFMT snapshot between commands",
    }
    (output / "overlay-provenance.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(generate(args.source, args.output)))


if __name__ == "__main__":
    main()
