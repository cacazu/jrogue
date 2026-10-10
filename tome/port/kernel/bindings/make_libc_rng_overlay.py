"""Append a seed snapshot seam to the exact local Emscripten musl rand.c."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("copyright", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    raw = args.source.read_bytes()
    for anchor in (b"static uint64_t seed;", b"void srand(unsigned s)", b"int rand(void)", b"seed = 6364136223846793005ULL*seed + 1;", b"return seed>>33;"):
        if raw.count(anchor) != 1:
            raise ValueError("unexpected local SDK musl source: " + anchor.decode())
    copyright_bytes = args.copyright.read_bytes()
    newline = b"\r\n" if b"\r\n" in raw else b"\n"
    appendix = newline + b'#include "tome_libc_rng_snapshot.inc"' + newline
    emitted = raw + appendix
    args.output.mkdir(parents=True, exist_ok=True)
    target = args.output / "musl_rand_state.c"
    target.write_bytes(emitted)
    adapter = Path(__file__).resolve().parent
    for filename in ("tome_libc_rng_snapshot.h", "tome_libc_rng_snapshot.inc"):
        shutil.copyfile(adapter / filename, args.output / filename)
    (args.output / "musl-COPYRIGHT").write_bytes(copyright_bytes)
    assert emitted[:-len(appendix)] == raw
    report = {
        "sdk": "local Emscripten 6.0.8 musl libc",
        "source": str(args.source.resolve()),
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "generated": str(target.resolve()),
        "generated_sha256": hashlib.sha256(emitted).hexdigest(),
        "original_body_byte_identical": True,
        "copyright": str(args.copyright.resolve()),
        "copyright_sha256": hashlib.sha256(copyright_bytes).hexdigest(),
        "copyright_copy": str((args.output / "musl-COPYRIGHT").resolve()),
        "snapshot_bytes": 28,
        "scope": "libc rand/srand uint64 state only; combine with original SFMT and Gaussian cache",
    }
    (args.output / "libc-overlay-provenance.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
