"""Validate current authored browser modules and retained host ABI contracts."""
from pathlib import Path
import json
import subprocess

WORK=Path(__file__).resolve().parent.parent
NODE=r"C:\Program Files\nodejs\node.exe"
OUT=WORK/"native-core-work/browser-source-validation"
OUT.mkdir(exist_ok=True)
commands=[(f"syntax-{file.stem}",[NODE,"--check",str(file)]) for file in [
    WORK/"bootstrap-work/play-browser.mjs",
    WORK/"bootstrap-work/run-local.mjs",
    WORK/"save-resume-work/baseline_server.mjs",
    WORK/"rust-kernel-adapter-work/browser/retained-browser-session.mjs",
]]
commands += [(f"contract-{name}",[NODE,str(WORK/"rust-kernel-adapter-work/browser"/name)]) for name in
    ["bridge.test.mjs","original-native-core.test.mjs","retained-browser-session.test.mjs"]]
results=[]
for name,command in commands:
    result=subprocess.run(command,cwd=WORK/"rust-kernel-adapter-work",capture_output=True,text=True)
    (OUT/(name+".log")).write_text(result.stdout+result.stderr,encoding="utf-8")
    results.append({"stage":name,"exit_code":result.returncode,"command":command})
    (OUT/"results.json").write_text(json.dumps(results,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(results[-1]),flush=True)
    if result.returncode:
        print(result.stdout+result.stderr,flush=True)
        raise SystemExit(result.returncode)
