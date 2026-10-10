"""Pure parser/release/resource-boundary regressions; no guard or tool launch."""
from pathlib import Path
import hashlib
import json
import types

HERE = Path(__file__).resolve().parent
OWNER = HERE / "run-policy-window.py"
OWNER_SHA = "6a8a00b1fc20981c4ba6440c8be700aab8db3b49c69c9d9e3a1d182c661e07b9"
HELPER = HERE.parents[2] / "integration-overlay/build-plan/cpp-compile/run-compile-window.py"
HELPER_SHA = "0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395"


def load(path, expected):
    source = path.read_bytes()
    assert hashlib.sha256(source).hexdigest() == expected
    module = types.ModuleType("private_v5_source_regression")
    module.__file__ = str(path)
    exec(compile(source, str(path), "exec", dont_inherit=True, optimize=0), module.__dict__)
    return module


owner = load(OWNER, OWNER_SHA)
helper = load(HELPER, HELPER_SHA)
checks = []


def reject(name, function):
    try:
        function()
    except RuntimeError:
        checks.append({"name": name, "passed": True})
    else:
        raise AssertionError("failed closed regression: " + name)


names = ["tests::a", "tests::b", "tests::c", "tests::d", "tests::e"]
rows = "\n".join("test " + name + " ... ok" for name in names)
summary = "test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s"
text = rows + "\n" + summary + "\n"
assert [item["name"] for item in owner.exact_test_reports(text, names)] == names
checks.append({"name": "exact-five-test-report-accepted", "passed": True})
reject("missing-test-row", lambda: owner.exact_test_reports(text.replace("test tests::e ... ok\n", ""), names))
reject("duplicate-test-row", lambda: owner.exact_test_reports(text.replace("tests::e", "tests::a"), names))
reject("extra-test-row", lambda: owner.exact_test_reports(text + "test tests::f ... ok\n", names))
reject("failed-test-row", lambda: owner.exact_test_reports(text.replace("tests::a ... ok", "tests::a ... FAILED"), names))
reject("missing-summary", lambda: owner.exact_test_reports(rows + "\n", names))
reject("changed-count-summary", lambda: owner.exact_test_reports(text.replace("5 passed", "6 passed"), names))
reject("duplicate-summary", lambda: owner.exact_test_reports(text + summary + "\n", names))
# Both checks stop before owned-target/output creation or any Windows guard load.
no_release = types.SimpleNamespace(root_released_window=False, runner_sha256=OWNER_SHA)
wrong_hash = types.SimpleNamespace(root_released_window=True, runner_sha256="0" * 64)
reject("missing-explicit-root-window", lambda: owner.execute({}, [], helper, b"", b"", no_release))
reject("wrong-current-owner-hash", lambda: owner.execute({}, [], helper, b"", b"", wrong_hash))
for name, physical, commit, decision in [
    ("exact-small-window-boundary", 4 * helper.GIB, 6 * helper.GIB, "launch"),
    ("physical-one-byte-below", 4 * helper.GIB - 1, 6 * helper.GIB, "blocked-fresh-4-6-gate"),
    ("commit-one-byte-below", 4 * helper.GIB, 6 * helper.GIB - 1, "blocked-fresh-4-6-gate"),
    ("browser-exact-priority", 7 * helper.GIB, 9 * helper.GIB, "deferred-browser-priority"),
    ("browser-commit-one-byte-below", 7 * helper.GIB, 9 * helper.GIB - 1, "launch"),
]:
    assert helper.choose_launch({"physicalFreeBytes": physical, "exactCommitHeadroomBytes": commit}) == decision
    checks.append({"name": name, "passed": True})
reject("negative-resource-counter", lambda: helper.choose_launch({"physicalFreeBytes": -1, "exactCommitHeadroomBytes": 6 * helper.GIB}))
reject("boolean-resource-counter", lambda: helper.choose_launch({"physicalFreeBytes": True, "exactCommitHeadroomBytes": 6 * helper.GIB}))
assert len(checks) == 17 and len({item["name"] for item in checks}) == 17
result = {"schemaVersion": 1, "status": "seventeen-pure-owner-regressions-passed", "runnerSha256": OWNER_SHA,
          "helperSha256": HELPER_SHA, "checks": checks, "WindowsGuardLoaded": False, "CargoExecuted": False,
          "NativeRustTestsExecuted": False, "WasmBuildExecuted": False, "UnrelatedProcessesStopped": False}
(HERE / "runner-source-tests.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": result["status"], "checks": len(checks)}))
