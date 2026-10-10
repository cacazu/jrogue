"""Added 2026-10-02, NGPL: isolated source review/proof; no compiler/runtime."""
from __future__ import annotations
import hashlib
import importlib.util
import json
from pathlib import Path
import runpy
import sys
import unittest
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]


def module(path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    result=importlib.util.module_from_spec(spec);sys.modules[name]=result;spec.loader.exec_module(result)
    return result


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


tests=module(HERE/"test_prepare.py","native_contract_source_tests")
result=unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromModule(tests))
if not result.wasSuccessful():raise SystemExit(1)
monster_path=ROOT/"tools/semantic-text/phase6-monster-producers/prepare.py"
monster=module(monster_path,"independent_monster_source_review")
original=(ROOT/"upstream/NetHack-5.0.0/src/do_name.c").read_text("utf8")
stock=runpy.run_path(str(ROOT/"tools/instrument-semantic-names.py"))["transform"](original)[0]
changed,operations=monster.transform(stock)
monster_proof=monster.verify(stock,changed,operations)
inputs=[path for path in HERE.iterdir() if path.is_file()]
inputs += [ROOT/"tools/instrument-semantic-phase4.py",ROOT/"tools/instrument-semantic-names.py",
           monster_path,ROOT/"tools/semantic-text/phase6-monster-producers/bridge-extension.c.in",
           ROOT/"tools/semantic-text/phase6-monster-producers/bridge-extension.h.in"]
generated=[path for path in (HERE/"generated").rglob("*") if path.is_file() and
           path.name not in ("source-proof.json","source-manifest.json")]
manifest={"schema_version":1,"date":"2026-10-02","source_only":True,"applied":False,
          "compiled":False,"runtime_verified":False,
          "source_inputs":[{"path":str(path.relative_to(ROOT)).replace("\\","/"),"sha256":sha(path)} for path in sorted(set(inputs))],
          "generated_files":[{"path":str(path.relative_to(HERE/"generated")).replace("\\","/"),"sha256":sha(path),"bytes":path.stat().st_size}
                             for path in sorted(generated)],
          "foundation_bridge_sha256":sha(ROOT/"work/phase4/semantic-generated/src/nh-semantic.c")}
(HERE/"generated/source-manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf8",newline="\n")
proof={"schema_version":1,"date":"2026-10-02","source_only":True,"tests":result.testsRun,
       "passed":True,"applied":False,"compiled":False,"runtime_verified":False,
       "native_counts":tests.NativeSourceContracts.audit["counts"],
       "independent_monster_review":{"original_call_argument_and_restoration_checks":monster_proof,
          "concrete_source_blockers_found":[],"integration_conditions":[
              "immutable helper/literal results require caller-owned producer values, never persistent name-registry insertion",
              "missing creator certificates for MGIVENNAME/priest/rank/adjectives retain whole native English",
              "source-only checks do not establish compiled ABI, runtime memory safety or localized gameplay coverage"]},
       "source_manifest_sha256":sha(HERE/"generated/source-manifest.json")}
(HERE/"generated/source-proof.json").write_text(json.dumps(proof,indent=2),encoding="utf8",newline="\n")
print(json.dumps({"status":"source-only","tests":result.testsRun,"native_counts":proof["native_counts"],
                  "monster_functions_reviewed":len(monster_proof),"manifest_sha256":proof["source_manifest_sha256"]}))
