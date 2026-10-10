"""Run one dependency-free Rust adapter test job and sample its process tree.

This does not compile/link Angband C, build WASM, package assets, or start browsers.
The peak is a 20ms sampled sum of process working sets, not an OS peak counter.
"""
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

import psutil

root = Path(__file__).resolve().parent.parent
evidence = root / "tests" / "source-integration-evidence"
evidence.mkdir(exist_ok=True)
command = [shutil.which("cargo"), "test", "--manifest-path", str(root / "rust" / "Cargo.toml"),
           "--offline", "--lib", "--jobs", "1", "--target-dir", str(root / "rust" / "target-review-check")]
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
peak = 0
names = set()
start = time.monotonic()
with (evidence / "rust-test.log").open("w", encoding="utf-8") as log:
    process = subprocess.Popen(command, cwd=root, stdout=log, stderr=subprocess.STDOUT,
                               env={**os.environ, "CARGO_BUILD_JOBS": "1"}, creationflags=subprocess.CREATE_NO_WINDOW)
    while process.poll() is None:
        try:
            parent = psutil.Process(process.pid)
            children = parent.children(recursive=True)
            rss = 0
            for child in [parent, *children]:
                try:
                    rss += child.memory_info().rss
                    names.add(child.name())
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            peak = max(peak, rss)
        except psutil.NoSuchProcess:
            pass
        time.sleep(0.02)
report = {"startedAt": started, "command": command, "exitCode": process.returncode,
          "wallSeconds": round(time.monotonic() - start, 3), "sampledPeakTreeWorkingSetBytes": peak,
          "samplingIntervalMs": 20, "processNames": sorted(names),
          "scope": "dependency-free native Rust library tests; no C engine or WASM/browser",
          "measurementLimit": "20ms sampled aggregate working set; brief process peaks may be missed"}
(evidence / "rust-test-resources.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report))
print((evidence / "rust-test.log").read_text(encoding="utf-8"))
raise SystemExit(process.returncode)
