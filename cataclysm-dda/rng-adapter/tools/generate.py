"""Hash-locked storage-only overlay of the full official rng.cpp, not a rule rewrite."""
import argparse
import difflib
import hashlib
import json
from pathlib import Path

COMMIT = "7b2efa5cea38e4d4d97dd0e63b28b9148623da59"
EXPECTED = {
    "src/rng.cpp": "b0bc0aaf772430a4c2202bfd7d1006495d02cd94f66b02677da3ec75458d3074",
    "src/rng.h": "26400bb939e8beffd94241277ddfca51cf5db807a1f98dada7b7d31680f2bebe",
    "src/cata_utility.h": "0d80dd159b4bd8319f0282e111b2a6c7da00408cd5534cd4bb1a8a4c23617b0a",
}
DISTRIBUTIONS = [
    ("rng_bits", "std::uniform_int_distribution<unsigned int>", "rng_uint_dist"),
    ("rng", "std::uniform_int_distribution<int>", "rng_int_dist"),
    ("rng_float", "std::uniform_real_distribution<double>", "rng_real_dist"),
    ("normal_roll", "std::normal_distribution<double>", "rng_normal_dist"),
    ("exponential_roll", "std::exponential_distribution<double>", "rng_exponential_dist"),
    ("chi_squared_roll", "std::chi_squared_distribution<double>", "rng_chi_squared_dist"),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upstream", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    original = (args.upstream / "src/rng.cpp").read_text(encoding="utf-8")
    provenance = {
        "upstream_repository": "https://github.com/CleverRaven/Cataclysm-DDA",
        "upstream_version": "0.I-1", "upstream_commit": COMMIT,
        "license": "CC-BY-SA-3.0", "source_files": {}, "storage_edits": [],
        "unchanged_original_functions": [],
        "fixture_scaffolding": ["units angle representation", "calendar turn conversion",
                               "coordinate forward declaration", "debug diagnostic counter",
                               "assert macro"],
    }
    for name, expected in EXPECTED.items():
        actual = hashlib.sha256((args.upstream / name).read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f"unexpected original source hash: {name}: {actual}")
        provenance["source_files"][name] = actual
    adapted = original
    anchor = '#include "units.h"\n'
    assert adapted.count(anchor) == 1
    adapted = adapted.replace(anchor, anchor + '\n// Browser platform state hook; no RNG algorithms are changed.\n#include "rng_snapshot_internal.h"\n')
    for function, typename, name in DISTRIBUTIONS:
        before = f"    static {typename} {name};"
        after = f"    auto &{name} = cdda_rng_distributions().{name};"
        assert adapted.count(before) == 1, before
        adapted = adapted.replace(before, after)
        provenance["storage_edits"].append({
            "function": function, "upstream_line": original[:original.index(before)].count("\n") + 1,
            "original": before.strip(), "replacement": after.strip(),
        })
    # Verify the whole original body after reversing only the six declared edits
    # and the added include. This is stronger than selected function comparisons.
    reconstructed = adapted.replace(anchor + '\n// Browser platform state hook; no RNG algorithms are changed.\n#include "rng_snapshot_internal.h"\n', anchor)
    for _, typename, name in DISTRIBUTIONS:
        reconstructed = reconstructed.replace(f"    auto &{name} = cdda_rng_distributions().{name};",
                                               f"    static {typename} {name};")
    assert reconstructed == original, "unexpected gameplay source modification"
    overlay = root / "overlay/src"
    reference = root / "reference"
    reference.mkdir(exist_ok=True)
    (overlay / "rng.cpp").write_text(adapted, encoding="utf-8", newline="\n")
    (reference / "original_rng.cpp").write_bytes((args.upstream / "src/rng.cpp").read_bytes())
    (root / "fixtures/include/rng.h").write_bytes((args.upstream / "src/rng.h").read_bytes())
    utility = (args.upstream / "src/cata_utility.h").read_text(encoding="utf-8")
    start = utility.index("template<typename T>\nconstexpr T clamp(")
    end = utility.index("\n}", start) + 2
    clamp = utility[start:end]
    (root / "fixtures/include/cata_utility.h").write_text(
        '// Unchanged src/cata_utility.h:222-226. CC BY-SA 3.0.\n#pragma once\n#include <algorithm>\n' + clamp + '\n', encoding="utf-8", newline="\n")
    provenance["clamp"] = {"file": "src/cata_utility.h", "lines": [222, 226],
                             "sha256_lf": hashlib.sha256(clamp.encode()).hexdigest()}
    provenance["overlay_sha256_lf"] = hashlib.sha256(adapted.encode()).hexdigest()
    provenance["original_algorithm_body_roundtrip_exact"] = True
    # Every definition remains present; source line ranges refer to original.
    import re
    pattern = re.compile(r"^(?:unsigned int|int|double|float|bool|units::angle|cata_default_random_engine(?:::result_type| &)|std::vector<int>|std::string|void)\s*([A-Za-z_][A-Za-z_0-9]*)\([^;]*?\n\{", re.MULTILINE)
    for match in pattern.finditer(original):
        start = match.start()
        opening = original.index("{", start)
        balance = 1
        end = opening + 1
        while balance:
            balance += (original[end] == "{") - (original[end] == "}")
            end += 1
        block = original[start:end]
        provenance["unchanged_original_functions"].append({
            "name": match.group(1), "start_line": original[:start].count("\n") + 1,
            "end_line": original[:end].count("\n") + 1,
            "original_sha256_lf": hashlib.sha256(block.encode()).hexdigest(),
            "changed_only_storage_declaration": match.group(1) in [x[0] for x in DISTRIBUTIONS],
        })
    (root / "PROVENANCE.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8", newline="\n")
    patch = "".join(difflib.unified_diff(original.splitlines(True), adapted.splitlines(True),
                                       fromfile="a/src/rng.cpp", tofile="b/src/rng.cpp"))
    (root / "storage-only.patch").write_text(patch, encoding="utf-8", newline="\n")
    (root / "LICENSE-UPSTREAM.txt").write_bytes((args.upstream / "LICENSE.txt").read_bytes())
    print(json.dumps({"storage_edits": 6, "full_source_reverse_patch_exact": True,
                      "overlay_sha256_lf": provenance["overlay_sha256_lf"]}))


if __name__ == "__main__":
    main()
