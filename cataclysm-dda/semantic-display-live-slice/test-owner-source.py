"""Pure owner regressions. No Windows guard, process, compiler or native fixture runs."""
from pathlib import Path
import hashlib
import json
import tempfile
import types

HERE = Path(__file__).resolve().parent
source = (HERE / "run-compile-window.py").read_bytes()
owner = types.ModuleType("cdda_help_owner_pure_test")
owner.__file__ = str(HERE / "run-compile-window.py")
exec(compile(source, owner.__file__, "exec", dont_inherit=True, optimize=0), owner.__dict__)
plan, helper, records, _, _ = owner.load_sources()
checks = []

def check(name, fn):
    fn()
    checks.append(name)

def reject(fn):
    try:
        fn()
    except RuntimeError:
        return
    raise AssertionError("expected rejected source policy")

check("browser priority at exact seven/nine", lambda: owner.require(helper.choose_launch({"physicalFreeBytes":7*helper.GIB,"exactCommitHeadroomBytes":9*helper.GIB}) == "deferred-browser-priority", "decision"))
check("focused exact four/six accepted", lambda: owner.require(helper.choose_launch({"physicalFreeBytes":4*helper.GIB,"exactCommitHeadroomBytes":6*helper.GIB}) == "launch", "decision"))
check("physical one byte below launch blocked", lambda: owner.require(helper.choose_launch({"physicalFreeBytes":4*helper.GIB-1,"exactCommitHeadroomBytes":6*helper.GIB}) == "blocked-fresh-4-6-gate", "decision"))
check("commit one byte below launch blocked", lambda: owner.require(helper.choose_launch({"physicalFreeBytes":4*helper.GIB,"exactCommitHeadroomBytes":6*helper.GIB-1}) == "blocked-fresh-4-6-gate", "decision"))
check("booleans never accepted as exact counters", lambda: reject(lambda: helper.choose_launch({"physicalFreeBytes":True,"exactCommitHeadroomBytes":6*helper.GIB})))
check("negative exact counters rejected", lambda: reject(lambda: helper.choose_launch({"physicalFreeBytes":-1,"exactCommitHeadroomBytes":6*helper.GIB})))
with tempfile.TemporaryDirectory(prefix="help-owner-source-", dir=HERE) as folder:
    root = Path(folder)
    owner.require(root.resolve().is_relative_to(HERE.resolve()), "temporary cleanup containment")
    obj, dep, input_source = root / "synthetic.o", root / "synthetic.d", root / "synthetic.cpp"
    obj.write_bytes(b"\x00asm\x01\x00\x00\x00x")
    input_source.write_text("// Synthetic MMD parser input; never compiled.\n", encoding="utf-8")
    header = HERE / "build/sources/src/cdda_help_semantic.h"
    command = {"source":str(input_source),"outputObject":str(obj),"outputDependencyFile":str(dep)}
    known = [helper.pin(input_source), helper.pin(header)]
    dep.write_text(str(obj)+": "+str(input_source)+" "+str(header)+"\n", encoding="utf-8")
    check("reviewed MMD members accepted", lambda: owner.require(len(owner.verify_outputs(command,known,helper)) == 2, "members"))
    dep.write_text(str(obj)+": "+str(input_source)+" "+str(header)+" "+str(root / "unreviewed.h")+"\n", encoding="utf-8")
    check("unreviewed actual non-system dependency rejected", lambda: reject(lambda: owner.verify_outputs(command,known,helper)))
    dep.write_text(str(obj)+": "+str(input_source)+"\n", encoding="utf-8")
    check("missing semantic sibling header rejected", lambda: reject(lambda: owner.verify_outputs(command,known,helper)))
    obj.write_bytes(b"\x00asm\x02\x00\x00\x00x")
    check("wrong WASM object version rejected", lambda: reject(lambda: owner.verify_outputs(command,known,helper)))
    check("fixed source pin mismatch rejected", lambda: reject(lambda: owner.checked_bytes(input_source,"0"*64)))

result={"schemaVersion":1,"status":"pure-owner-regressions-passed","checks":len(checks),"names":checks,
        "ownerSha256":hashlib.sha256(source).hexdigest(),"planSha256":owner.PLAN_SHA,
        "sourceProtectedFiles":len(records),"WindowsGuardLoaded":False,"compilerExecuted":False,
        "originalProducerExecuted":False,"fixtureExecuted":False,"RustExecuted":False}
(HERE / "OWNER-SOURCE-REGRESSIONS.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result),flush=True)
