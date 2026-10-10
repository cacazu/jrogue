from pathlib import Path
import hashlib,json,ast
h=Path('input-context-live-slice/browser-rust-adapter/wasm-build')
plan=h/'build-plan.json';sha=hashlib.sha256(plan.read_bytes()).hexdigest()
owner=h/'run-functional-window.py';s=owner.read_text(encoding='utf8')
old="PLAN_SHA='eae598434d36c7b1d61909d159952cbddf92a21b40865714375b0755cec628b1'"
assert old in s;s=s.replace(old,"PLAN_SHA='"+sha+"'");owner.write_text(s,encoding='utf8');ast.parse(s)
print(json.dumps({'planSha256':sha,'ownerSha256':hashlib.sha256(owner.read_bytes()).hexdigest(),'ownerBytes':owner.stat().st_size}))
