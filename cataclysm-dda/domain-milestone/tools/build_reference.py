"""Compile unchanged official damage.cpp functions in a minimal C++ fixture.

The fixture replaces data registry and debug logging only, with transparent stubs.
It does not compile a clone of the arithmetic written for this port.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import os

COMMIT = "7b2efa5cea38e4d4d97dd0e63b28b9148623da59"
EXPECTED_SOURCE_SHA256 = {
    "src/damage.cpp": "91d096c82780517f4be2327d2016fa14f5d90654d73aa652529f46b8ea5eaffa",
    "src/damage.h": "8a556e4561a2f0f10e569b4fa9705ae81f8ae3cb31678de90f4f7ec4c0e00647",
    "src/cata_utility.h": "0d80dd159b4bd8319f0282e111b2a6c7da00408cd5534cd4bb1a8a4c23617b0a",
}
SIGNATURES = [
    "bool damage_unit::operator==(",
    "damage_instance::damage_instance(",
    "void damage_instance::add_damage(",
    "void damage_instance::mult_damage(",
    "void damage_instance::mult_type_damage(",
    "float damage_instance::type_damage(",
    "float damage_instance::type_arpen(",
    "float damage_instance::total_damage(",
    "void damage_instance::clear(",
    "bool damage_instance::empty(",
    "void damage_instance::add( const damage_instance",
    "void damage_instance::add( const damage_unit",
    "std::vector<damage_unit>::iterator damage_instance::begin(",
    "std::vector<damage_unit>::const_iterator damage_instance::begin(",
    "std::vector<damage_unit>::iterator damage_instance::end(",
    "std::vector<damage_unit>::const_iterator damage_instance::end(",
    "bool damage_instance::operator==(",
    "damage_unit &damage_unit::operator*=(",
    "damage_unit &damage_unit::operator+=(",
    "damage_instance &damage_instance::operator+=(",
    "void resistances::set_resist(",
    "float resistances::type_resist(",
    "float resistances::get_effective_resist(",
    "bool resistances::operator==(",
    "resistances resistances::operator*(",
    "resistances resistances::operator/(",
]


def extract(text, signature):
    start = text.index(signature)
    opening = text.index("{", start)
    balance = 1
    end = opening + 1
    while balance:
        balance += (text[end] == "{") - (text[end] == "}")
        end += 1
    # These selected blocks contain no brace characters in comments/string literals.
    value = text[start:end]
    return value, text.count("\n", 0, start) + 1, text.count("\n", 0, end) + 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upstream", type=Path, required=True)
    parser.add_argument("--emsdk", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = root / "reference"
    output.mkdir(exist_ok=True)
    cpp = (args.upstream / "src/damage.cpp").read_text(encoding="utf-8")
    header = (args.upstream / "src/damage.h").read_text(encoding="utf-8")
    utility = (args.upstream / "src/cata_utility.h").read_text(encoding="utf-8")
    provenance = {"upstream_commit": COMMIT, "upstream_repository": "https://github.com/CleverRaven/Cataclysm-DDA", "license": "CC-BY-SA-3.0", "source_files": {}, "functions": []}
    for filename in ["src/damage.cpp", "src/damage.h", "src/cata_utility.h"]:
        provenance["source_files"][filename] = hashlib.sha256((args.upstream / filename).read_bytes()).hexdigest()
        if provenance["source_files"][filename] != EXPECTED_SOURCE_SHA256[filename]:
            raise ValueError(f"source hash differs from verified stable {COMMIT}: {filename}")
    blocks = []
    for signature in SIGNATURES:
        block, start, end = extract(cpp, signature)
        blocks.append(f'#line {start} "upstream/src/damage.cpp"\n' + block)
        provenance["functions"].append({"function": signature, "file": "src/damage.cpp", "start_line": start, "end_line": end, "sha256_lf": hashlib.sha256(block.encode()).hexdigest()})
    declarations = []
    for signature in ["struct barrel_desc {", "struct damage_unit {", "struct damage_instance {", "struct resistances {"]:
        block, start, end = extract(header, signature)
        declarations.append(block + ";")
        provenance["functions"].append({"function": signature, "file": "src/damage.h", "start_line": start, "end_line": end, "sha256_lf": hashlib.sha256(block.encode()).hexdigest()})
    lerp, start, end = extract(utility, "template<typename T>\nconstexpr T lerp(")
    provenance["functions"].append({"function": "lerp", "file": "src/cata_utility.h", "start_line": start, "end_line": end, "sha256_lf": hashlib.sha256(lerp.encode()).hexdigest()})
    fixture = (root / "tools/reference_scaffold.cpp").read_text(encoding="utf-8")
    fixture = fixture.replace("// ORIGINAL_DECLARATIONS", "\n".join(declarations))
    fixture = fixture.replace("// ORIGINAL_FUNCTIONS", lerp + "\n" + "\n\n".join(blocks))
    destination = output / "damage_reference.cpp"
    destination.write_text(f"// Unchanged functions extracted from official CDDA {COMMIT}. CC BY-SA 3.0.\n" + fixture, encoding="utf-8")
    (root / "PROVENANCE.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    python = args.emsdk / "python/3.13.3_64bit/python.exe"
    env = dict(os.environ, EM_CONFIG=str(args.emsdk / ".emscripten"),
               EM_CACHE=str(root / "build/emcache"), EMSDK_PYTHON=str(python),
               PATH=str(python.parent) + os.pathsep + os.environ["PATH"])
    command = [str(python), str(args.emsdk / "upstream/emscripten/emcc.py"), str(destination), "-x", "c++", "-std=c++17", "-O0", "-ffp-contract=off", "-sDEFAULT_TO_CXX=1", "-sENVIRONMENT=node", "-sEXIT_RUNTIME=1", "-o", str(output / "damage_reference.cjs")]
    subprocess.run(command, env=env, check=True)
    print(json.dumps({"extracted_functions": len(SIGNATURES), "reference": str(output / "damage_reference.cjs"), "wasm_sha256": hashlib.sha256((output / "damage_reference.wasm").read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
