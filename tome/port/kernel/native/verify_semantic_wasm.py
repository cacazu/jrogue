"""Generate reviewed deltas and validate actual semantic Rust WASM sequentially."""
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parent
WORK=ROOT.parent
OUT=ROOT/"semantic-validation"
NODE=r"C:\Program Files\nodejs\node.exe"
CARGO=r"C:\Users\kit\.cargo\bin\cargo.exe"

def main():
    OUT.mkdir(exist_ok=True)
    stages=[
        ("reviewed-479-id-merge",[NODE,"--max-old-space-size=192","localization-review-work/merge-final-review.mjs"],WORK),
        ("exact-dream-producer-stage",[NODE,"localization-review-work/stage-dream-leaf.mjs"],WORK),
        ("semantic-rust-tests",[CARGO,"test","--offline","--jobs","1"],WORK/"localization-wasm-work"),
        ("semantic-rust-clippy",[CARGO,"clippy","--offline","--all-targets","--jobs","1","--","-D","warnings"],WORK/"localization-wasm-work"),
        ("semantic-wasm-build",[CARGO,"build","--offline","--release","--target","wasm32-unknown-unknown","--jobs","1"],WORK/"localization-wasm-work"),
        ("actual-semantic-wasm-fixture",[NODE,"tests/wasm-bridge.test.mjs"],WORK/"localization-wasm-work"),
        ("actual-semantic-wasm-full-catalog",[NODE,"tests/wasm-bridge.test.mjs","--full-catalog"],WORK/"localization-wasm-work"),
    ]
    first=next((n for n,(label,_,_) in enumerate(stages) if len(sys.argv)>1 and label==sys.argv[1]),0)
    previous_file=OUT/"results.json"
    previous=json.loads(previous_file.read_text(encoding="utf-8")) if first and previous_file.is_file() else []
    keep={label for label,_,_ in stages[:first]}
    results=[item for item in previous if item["stage"] in keep and item["exit"]==0]
    stages=stages[first:]
    for label,command,cwd in stages:
        start=time.monotonic()
        process=subprocess.run(command,cwd=cwd,capture_output=True,text=True,encoding="utf-8",errors="replace")
        log=OUT/(label+".log")
        log.write_text(process.stdout+process.stderr,encoding="utf-8")
        entry={"stage":label,"exit":process.returncode,"seconds":round(time.monotonic()-start,3),"log":str(log),"tail":(process.stdout+process.stderr)[-2500:]}
        results.append(entry)
        (OUT/"results.json").write_text(json.dumps(results,ensure_ascii=True,indent=2),encoding="utf-8")
        print(json.dumps(entry,ensure_ascii=True),flush=True)
        if process.returncode: raise SystemExit(process.returncode)

if __name__=="__main__": main()
