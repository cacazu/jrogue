"""Coordinate one Angband job; measure its own process tree and OS headroom."""
import ctypes
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

import psutil

# Engine/browser evidence contains CJK and arbitrary external Unicode. The
# Windows console code page must not turn a successful job into a print error.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

root = Path(__file__).resolve().parent.parent
evidence = root / "tests" / "source-integration-evidence"
evidence.mkdir(exist_ok=True)
mode = sys.argv[1]
commands = {
    "rust-compile-check": [shutil.which("cargo"), "test", "--offline", "--manifest-path", str(root / "rust/Cargo.toml"), "--lib", "--no-run", "--jobs", "1", "--target-dir", str(root / "rust/target-review-next")],
    "rust-native-review": [shutil.which("cargo"), "test", "--offline", "--manifest-path", str(root / "rust/Cargo.toml"), "--lib", "--jobs", "1", "--target-dir", str(root / "rust/target-review-next")],
    "build": [shutil.which("node"), str(root / "tools/build.mjs")],
    "build-safety": [shutil.which("node"), str(root / "tools/build.mjs"), "--skip-rust"],
    "adapter-syntax": [shutil.which("node"), str(root / "tools/build.mjs"), "--check-adapters"],
    "browser-review": [shutil.which("node"), str(root / "tests/browser-smoke.mjs"), "--final", "--review"],
    "browser-safety": [shutil.which("node"), str(root / "tests/browser-smoke.mjs"), "--final", "--review"],
    "browser-gameflows": [shutil.which("node"), str(root / "tests/browser-gameflows.mjs"), "--final", "--review"],
    "browser-dist": [shutil.which("node"), str(root / "dist/tests/browser-smoke.mjs"), "--final", "--review"],
    "wasm-descriptors": [shutil.which("node"), str(root / "tests/wasm-descriptor-probe.mjs")],
    "browser-victory": [shutil.which("node"), str(root / "tests/browser-victory.mjs"), "--final", "--review"],
    "recall-fixture": [shutil.which("node"), str(root / "migration/message-recall-storage-data/build-fixture.mjs")],
    "look-fixture": [shutil.which("node"), str(root / "tests/look-target-fixture/run.mjs")],
    "history-fixture": [sys.executable, "-X", "utf8", str(root / "migration/game-history-data/run-wire-harness.py")],
    "browser-native-perception": [shutil.which("node"), str(root / "tests/browser-native-perception.mjs")],
    "browser-normal": [shutil.which("node"), str(root / "tests/browser-normal-play.mjs")],
    "browser-presentations": [shutil.which("node"), str(root / "tests/browser-presentation-remaining.mjs")],
    "node-review": [shutil.which("node"), "--test", "--test-concurrency=1", "--test-reporter=tap", *[str(path) for path in sorted((root / "tests").glob("*.test.mjs"))]],
}
if mode not in commands:
    raise SystemExit("unknown measured job")

class MemoryStatus(ctypes.Structure):
    _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong),
                *[(name, ctypes.c_ulonglong) for name in (
                    "totalPhysical", "availablePhysical", "totalCommit", "availableCommit",
                    "totalVirtual", "availableVirtual", "extendedVirtual")]]

def headroom():
    status = MemoryStatus()
    status.length = ctypes.sizeof(status)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        raise ctypes.WinError()
    return {"availablePhysicalBytes": status.availablePhysical, "availableCommitBytes": status.availableCommit}

command = commands[mode]
start_memory = headroom()
report = {"startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "command": command, "concurrency": 1, "initialHeadroom": start_memory,
          "samplingIntervalMs": 20, "measurementLimit": "20ms sampled aggregate working set; brief peaks may be missed"}
print(json.dumps({"jobStarted": mode, **report}), flush=True)
peak = 0
names = set()
minimum = dict(start_memory)
critical_samples = 0
stopped = False
start = time.monotonic()
next_memory = start
with (evidence / (mode + ".log")).open("w", encoding="utf-8") as log:
    process = subprocess.Popen(command, cwd=root, stdout=log, stderr=subprocess.STDOUT,
                               env={**os.environ, "ANGBAND_BUILD_JOBS": "1", "CARGO_BUILD_JOBS": "1"},
                               creationflags=subprocess.CREATE_NO_WINDOW)
    while process.poll() is None:
        children = []
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
        if time.monotonic() >= next_memory:
            current = headroom()
            for key, value in current.items():
                minimum[key] = min(minimum[key], value)
            # Respond to actual sustained OS commit exhaustion. This is not a
            # speculative prelaunch reservation, nor a stop of another task.
            critical_samples = critical_samples + 1 if current["availableCommitBytes"] < 256 * 1024 * 1024 else 0
            if critical_samples >= 2:
                stopped = True
                for child in reversed(children):
                    try:
                        child.kill()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                process.kill()
                break
            next_memory = time.monotonic() + 1
        time.sleep(0.02)
    process.wait()
report.update({"exitCode": process.returncode, "wallSeconds": round(time.monotonic() - start, 3),
               "sampledPeakTreeWorkingSetBytes": peak, "processNames": sorted(names),
               "minimumHeadroom": minimum, "finalHeadroom": headroom(), "stoppedForCommitExhaustion": stopped})
(evidence / (mode + "-resources.json")).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report), flush=True)
job_log = (evidence / (mode + ".log")).read_text(encoding="utf-8")
if len(job_log) <= 16000:
    print(job_log, flush=True)
else:
    print(json.dumps({"fullLog": str(evidence / (mode + ".log")), "characters": len(job_log), "consoleTailCharacters": 8000}), flush=True)
    print(job_log[-8000:], flush=True)
raise SystemExit(process.returncode)
