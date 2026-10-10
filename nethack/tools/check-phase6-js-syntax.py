"""Run Node's syntax parser serially over the frozen acceptance inputs."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    if os.environ.get("NETHACK_PARENT_SERIAL_SLOT") != "phase6":
        raise SystemExit("Phase6 root serial slot required")
    config_path = (ROOT / (sys.argv[2] if len(sys.argv) > 2 else "build/phase6/acceptance-config.json")).resolve()
    config_path.relative_to(ROOT)
    config_hash = sha(config_path)
    config = json.loads(config_path.read_text(encoding="utf8"))
    rows = {}
    web = ROOT / config["web_root"]
    for name, expected in config["expected_runtime_sha256"].items():
        if Path(name).suffix in {".js", ".mjs", ".cjs"}:
            rows[(web / name).resolve()] = expected
    for row in config["test_sources"]:
        path = (ROOT / row["path"]).resolve()
        if path.suffix in {".js", ".mjs", ".cjs"}:
            rows[path] = row["sha256"]
    phase7 = config.get("phase7") or {}
    for name, row in phase7.items():
        if name.endswith((".js", ".mjs", ".cjs")):
            rows[(ROOT / row["path"]).resolve()] = row["sha256"]
    output = ROOT / config["report_directory"] / "syntax-verification.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf8", newline="\n") as stream:
        report = {"status": "failed", "config_sha256": config_hash,
                  "node": sys.argv[1], "checks": [], "runtime_invoked": False}
        try:
            for path, expected in sorted(rows.items()):
                path.relative_to(ROOT)
                if sha(path) != expected:
                    raise AssertionError(f"Frozen input mismatch: {path}")
                result = subprocess.run([sys.argv[1], "--max-old-space-size=128", "--check", str(path)],
                                        capture_output=True, text=True, encoding="utf8")
                row = {"path": path.relative_to(ROOT).as_posix(), "sha256": expected,
                       "exit_code": result.returncode, "stdout": result.stdout, "stderr": result.stderr}
                report["checks"].append(row)
                if result.returncode:
                    raise AssertionError(f"Node syntax failure: {path}: {result.stderr}")
                if sha(path) != expected:
                    raise AssertionError(f"Input changed during syntax check: {path}")
            if sha(config_path) != config_hash or any(sha(p) != h for p, h in rows.items()):
                raise AssertionError("Frozen inputs changed during gate")
            report["status"] = "passed"
            report["total_passed"] = len(rows)
        except BaseException as error:
            report["error"] = str(error)
            raise
        finally:
            json.dump(report, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
    print(json.dumps({"status": "passed", "checks": len(rows),
                      "report": output.relative_to(ROOT).as_posix()}))


if __name__ == "__main__":
    main()
