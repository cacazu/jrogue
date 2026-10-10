"""Pure protocol and negative scope checks; no Windows guard or child process."""
from pathlib import Path
import hashlib
import json
import types
import unittest

HERE = Path(__file__).resolve().parent
OWNER_PATH = HERE / "run-quality-window.py"
OWNER_SHA = "eff148bd2557c7018d19a6bc34e9be1e91c412aba60dfa28b5737aa79615e51d"
PLAN_PATH = HERE / "quality-plan.json"
PLAN_SHA = "504c67c4e405cf373941e121686941b77fc2a8037287161a38b5be5249d39895"


def private_module(path, expected=None):
    data = path.read_bytes()
    if expected is not None and hashlib.sha256(data).hexdigest() != expected:
        raise RuntimeError("source pin changed")
    module = types.ModuleType("source_only_native_quality_checks")
    module.__file__ = str(path)
    exec(compile(data, str(path), "exec", dont_inherit=True, optimize=0), module.__dict__)
    return module, data


OWNER, SOURCE = private_module(OWNER_PATH, OWNER_SHA)
PLAN_DATA = PLAN_PATH.read_bytes()
if hashlib.sha256(PLAN_DATA).hexdigest() != PLAN_SHA:
    raise RuntimeError("plan pin changed")
PLAN = json.loads(PLAN_DATA)
LEGACY_PATH = HERE.parent / "test-owner-source.py"
LEGACY, LEGACY_DATA = private_module(LEGACY_PATH)
LEGACY_PROOF = HERE.parent / "runner-source-tests.json"
LEGACY_PROOF_BEFORE = LEGACY_PROOF.read_bytes()


class QualityScopeTests(unittest.TestCase):
    def reject_mutated_plan(self, change, diagnostic):
        candidate = json.loads(PLAN_DATA)
        change(candidate)
        original = OWNER.checked_bytes

        def in_memory_plan(path, expected):
            if Path(path) == PLAN_PATH:
                return json.dumps(candidate).encode("utf-8")
            return original(path, expected)

        OWNER.checked_bytes = in_memory_plan
        try:
            with self.assertRaisesRegex(RuntimeError, diagnostic):
                OWNER.load_sources()
        finally:
            OWNER.checked_bytes = original

    def test_preserved_initial_target_cannot_be_reused(self):
        self.reject_mutated_plan(lambda plan: plan.update(newOwnedTarget=plan["initialExecutedTargetMustRemainUnchanged"]),
                                 "fresh target must be distinct")

    def test_workspace_formatting_cannot_replace_package_scope(self):
        self.reject_mutated_plan(lambda plan: plan["commands"][0]["argv"].insert(1, "--all"),
                                 "exact package-only command required")


if __name__ == "__main__":
    suite = unittest.TestSuite([
        unittest.defaultTestLoader.loadTestsFromTestCase(LEGACY.OwnerSourceTests),
        unittest.defaultTestLoader.loadTestsFromTestCase(QualityScopeTests),
    ])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    unchanged = LEGACY_PROOF.read_bytes() == LEGACY_PROOF_BEFORE
    proof = {"schemaVersion": 1, "runnerSha256": OWNER_SHA, "planSha256": PLAN_SHA,
             "sourceTestsRun": result.testsRun, "reusedPureProtocolTests": 8,
             "currentQualityNegativeScopeTests": 2, "passed": result.wasSuccessful() and unchanged,
             "initialSourceTestProofUnchanged": unchanged,
             "initialSourceTestScriptSha256": hashlib.sha256(LEGACY_DATA).hexdigest(),
             "CargoExecuted": False, "FormatterExecuted": False, "ClippyExecuted": False,
             "WindowsGuardLoaded": False, "ChildProcessStarted": False}
    (HERE / "runner-source-tests.json").write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    raise SystemExit(0 if proof["passed"] else 1)
