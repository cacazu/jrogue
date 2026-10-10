"""Sequential validation of retained Rust source and its actual WASM mailbox."""
from pathlib import Path
import json
import subprocess
import time

WORK=Path(__file__).resolve().parent.parent
SOURCE=WORK/"rust-kernel-adapter-work"
OUT=SOURCE/"validation"
OUT.mkdir(exist_ok=True)
stages=[
    ("rust-tests",["cargo","test","--offline","--jobs","1"]),
    ("rust-clippy",["cargo","clippy","--offline","--all-targets","--jobs","1","--","-D","warnings"]),
    ("wasm-build",["cargo","build","--offline","--release","--target","wasm32-unknown-unknown","-p","tome-core-environment","--jobs","1"]),
    ("wasm-mailbox",[r"C:\Program Files\nodejs\node.exe","browser/bridge.test.mjs"]),
    ("native-host-contract",[r"C:\Program Files\nodejs\node.exe","browser/original-native-core.test.mjs"]),
    ("browser-session-contract",[r"C:\Program Files\nodejs\node.exe","browser/retained-browser-session.test.mjs"]),
]
results=[]
for name,command in stages:
    started=time.monotonic()
    result=subprocess.run(command,cwd=SOURCE,capture_output=True,text=True)
    log=OUT/(name+".log")
    log.write_text(result.stdout+result.stderr,encoding="utf-8")
    record={"stage":name,"exit_code":result.returncode,"elapsed_seconds":round(time.monotonic()-started,3),"command":command,"log":str(log)}
    results.append(record)
    (OUT/"results.json").write_text(json.dumps(results,indent=2),encoding="utf-8")
    print(json.dumps(record),flush=True)
    if result.returncode:
        print(result.stdout+result.stderr,flush=True)
        raise SystemExit(result.returncode)
