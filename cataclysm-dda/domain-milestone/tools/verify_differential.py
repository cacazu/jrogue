"""Compare Rust damage state with untouched upstream C++ functions in Node/WASM."""
import argparse
import hashlib
import json
from pathlib import Path
import random
import subprocess
import time


def unit(kind, values, barrels=()):
    return " ".join([kind] + [format(value, ".9g") for value in values] + [str(len(barrels))] + [f"{length} {amount:.9g}" for length, amount in barrels])


def generate_vectors():
    lines = []
    counter = 0

    def emit(*commands):
        nonlocal counter
        lines.extend(commands)
        lines.append(f"dump case_{counter:05d}")
        counter += 1

    # Explicit boundary cases and source quirks, independent of random vectors.
    emit("add bash 10 0 1 1 1 1 0", "resist bash 12 0")
    emit("relative bash 2 3 1 1 1 1 0")
    emit("relative heat 5 0 1 1 1 1 0")
    emit("add bash 3 2 0.1 2 0.5 3 0")
    emit("resist bash 12 1")
    emit("resist bash 12 0", "multiply_type bash 0")
    emit("multiply 0 0")
    emit("add cut 3 1 0.5 1 2 3 1 100 7", "add cut 4 2 0.25 2 4 5 0")
    emit("relative_unit 0 cut 2 3 0.5 0.25 6 7 1 50 8")
    emit("multiply_unit 0 1.000000059604644775390625")
    emit("unit_equal 0 cut 3 1 0.5 1 2 3 0")
    emit("clear", "add bash 3 0 1 1 1 2 0", "unit_equal 0 bash 3 0 1 1 1 2 0")
    emit("unit_equal 0 bash 3 0 1 1 2 2 0")
    emit("resist cut 0 0", "resist_equal bash 12", "add_resist bash 3")
    emit("multiply_resist 0.3", "divide_resist 1.7")
    emit("divide_resist 0")
    emit("multiply_resist 0")
    emit("clear", "add bash 1 0 1 0 1 1 0", "add bash 2 1 1 0 1 1 0")
    emit("multiply -1 1")
    emit("add bash -0 0 1 1 1 1 0", "resist bash -0 0")
    emit("clear", "add bash 3.4028234e38 0 1 1 1 1 0", "multiply 2 1")
    emit("multiply 1e-300 1")
    emit("clear", "add bash 1.17549435e-38 0 1 1 1 1 0", "multiply 0.5 1")
    emit("clear", "add bash 1.40129846e-45 0 1 1 1 1 0", "multiply 0.5 1")
    emit("clear", "add_instance 2 bash 3 0 1 1 1 1 0 cut 4 2 0.5 1 1 1 0")
    emit("instance_equal 2 bash 3 0 1 1 1 1 0 cut 4 2 0.5 1 1 1 0")
    emit("instance_equal 1 bash 3 0 1 1 1 1 0")
    emit("clear", "instance_equal 0")

    rng = random.Random(0xCDDA0)
    kinds = ["bash", "cut", "stab", "heat", "electric", "biological"]
    # Reset before each sequence so prior NaN/inf boundary tests cannot hide errors.
    for sequence in range(128):
        lines.append("clear")
        for kind in kinds:
            lines.append(f"resist {kind} {rng.uniform(0, 100):.9g} {int(rng.random() < 0.15)}")
        active = []
        for step in range(24):
            kind = rng.choice(kinds)
            values = [rng.uniform(0, 200), rng.uniform(0, 30), rng.uniform(0, 2),
                      rng.uniform(0.1, 3), rng.uniform(0, 2), rng.uniform(0, 2)]
            barrels = [(100, rng.uniform(0, 20)), (200, rng.uniform(0, 30))] if rng.random() < 0.2 else []
            emit("add " + unit(kind, values, barrels))
            if kind not in active:
                active.append(kind)
            if step % 3 == 0:
                emit(f"multiply {rng.uniform(0.1, 2):.17g} {step % 2}")
            if step % 4 == 0:
                emit(f"multiply_type {kind} {rng.uniform(-0.1, 2):.17g}")
            if step % 5 == 0:
                emit("relative " + unit(kind, [rng.uniform(-2, 3), rng.uniform(-1, 2), 1, 1, 1, 1]))
            if step % 6 == 0:
                emit(f"multiply_unit {rng.randrange(len(active))} {rng.uniform(0.01, 1.5):.17g}")
            if step % 7 == 0:
                emit(f"add_resist {kind} {rng.uniform(-1, 1):.9g}", "multiply_resist 0.99", "divide_resist 1.001")
    return "\n".join(lines) + "\n", counter


def run(command, content, cwd):
    result = subprocess.run(command, input=content, text=True, capture_output=True, check=True, cwd=cwd)
    return result.stdout.replace("\r\n", "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--node", default="node")
    parser.add_argument("--cargo", default="cargo")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    evidence = root / "evidence"
    evidence.mkdir(exist_ok=True)
    vectors, snapshots = generate_vectors()
    (evidence / "vectors.txt").write_text(vectors, encoding="utf-8")
    start = time.monotonic()
    subprocess.run([args.cargo, "fmt", "--check"], cwd=root, check=True)
    subprocess.run([args.cargo, "test", "--offline"], cwd=root, check=True)
    subprocess.run([args.cargo, "clippy", "--offline", "--all-targets", "--", "-D", "warnings"], cwd=root, check=True)
    subprocess.run([args.cargo, "build", "--offline", "--bin", "damage-vectors"], cwd=root, check=True)
    subprocess.run([args.cargo, "build", "--offline", "--release", "--bin", "damage-vectors"], cwd=root, check=True)
    reference = run([args.node, str(root / "reference/damage_reference.cjs")], vectors, root)
    debug = run([str(root / "target/debug/damage-vectors.exe")], vectors, root)
    release = run([str(root / "target/release/damage-vectors.exe")], vectors, root)
    repeat = run([str(root / "target/release/damage-vectors.exe")], vectors, root)
    for label, value in [("cpp-wasm", reference), ("rust-debug", debug), ("rust-release", release), ("rust-repeat", repeat)]:
        (evidence / f"{label}.txt").write_text(value, encoding="utf-8")
    if reference != debug or reference != release or release != repeat:
        for index, group in enumerate(zip(reference.splitlines(), debug.splitlines(), release.splitlines())):
            if len(set(group)) != 1:
                raise AssertionError(f"differential mismatch at output line {index + 1}: {group}")
        raise AssertionError("differential output lengths differ")
    report = {
        "result": "passed",
        "upstream_commit": "7b2efa5cea38e4d4d97dd0e63b28b9148623da59",
        "snapshots": snapshots,
        "command_count": len(vectors.splitlines()),
        "output_lines": len(reference.splitlines()),
        "comparison": "exact f32 bit patterns, ordered state, diagnostic counts, and equality outputs; all NaN payloads normalized to the nan class",
        "native_profiles": ["debug", "release"],
        "repeated_release_identical": True,
        "unit_tests": 9,
        "cargo_fmt_check": "passed",
        "cargo_clippy_warnings_denied": "passed",
        "vector_seed": "0xCDDA0",
        "vectors_sha256": hashlib.sha256(vectors.encode()).hexdigest(),
        "cpp_wasm_sha256": hashlib.sha256((root / "reference/damage_reference.wasm").read_bytes()).hexdigest(),
        "output_sha256": hashlib.sha256(reference.encode()).hexdigest(),
        "tool_versions": {"rustc": subprocess.check_output([str(Path(args.cargo).with_name("rustc.exe")), "--version"], text=True).strip(), "node": subprocess.check_output([args.node, "--version"], text=True).strip()},
        "elapsed_seconds": round(time.monotonic() - start, 2),
    }
    (evidence / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
