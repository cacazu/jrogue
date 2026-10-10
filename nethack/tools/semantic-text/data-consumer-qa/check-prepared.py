#!/usr/bin/env python3
"""Read-only source check, without any compiler, preprocessor, or Node run."""
import hashlib
import importlib.util
import json
from pathlib import Path

own = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("data_consumer_qa", own / "prepare.py")
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
report_path = qa.BUILD / "phase4" / "prepared.json"
prepared = json.loads(report_path.read_text("utf-8"))
pristine = (qa.OFFICIAL / "src/rumors.c").read_text("utf-8")
working = (qa.WORKING / "src/rumors.c").read_text("utf-8")
checks = []


def check(label, condition):
    checks.append({"check": label, "passed": bool(condition)})


for name in qa.FUNCTIONS:
    snippet, _, _ = qa.body(pristine, name, pristine=True)
    record = next(v for v in prepared["official_functions"] if v["function"] == name)
    check(name + " extracted original exact bytes", qa.sha(snippet.encode()) == record["sha256"])
for fragment in [
    'while (dlb_fgets(line, COLNO, oracles) && strcmp(line, "---\\n"))',
    "if ((newl = strchr(buf, '\\n')) != 0)",
    "if (padlength)\n        unpadline(buf);",
]:
    check("Phase4 original consumer control " + fragment,
          fragment in pristine and fragment in working)
check("Phase4 original dlb.c byte identity",
      (qa.OFFICIAL / "src/dlb.c").read_bytes() == (qa.WORKING / "src/dlb.c").read_bytes())
types = (qa.OFFICIAL / "include/wintype.h").read_text("utf-8")
check("original wintype declarations", "typedef int winid;" in types and "#define NHW_TEXT 5" in types)
for name in qa.FUNCTIONS[:-1]:
    original, _, _ = qa.body(pristine, name, pristine=True)
    candidate, _, _ = qa.body(working, name, pristine=True)
    check(name + " complete Phase4 original-function identity", original == candidate)
check("isolated archive byte identity",
      qa.sha((qa.BUILD / "phase4/assets/nhdat").read_bytes()) == prepared["archive_sha256"])
check("generated probe source hash bound",
      qa.sha((qa.BUILD / "phase4/original-consumer.c").read_bytes()) == prepared["probe_c_sha256"])
report = {"status": "passed" if all(c["passed"] for c in checks) else "failed",
          "source_only": True, "compiler_node_preprocessor_runs": 0,
          "assertions": checks, "assertion_count": len(checks),
          "prepared_sha256": qa.sha(report_path.read_bytes()),
          "reproducer_sha256": qa.sha(Path(__file__).read_bytes())}
qa.write_json(qa.BUILD / "source-checks.json", report)
print(json.dumps({k: report[k] for k in ("status", "source_only", "assertion_count", "prepared_sha256")}))
raise SystemExit(0 if report["status"] == "passed" else 1)
