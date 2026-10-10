from pathlib import Path
p=Path('input-context-live-slice/browser-rust-adapter/wasm-build/prepare-plan.py')
s=p.read_text(encoding='utf8')
assert "collect(rust['pins'],records)" in s
p.write_text(s.replace("collect(rust['pins'],records)","collect(rust,records)"),encoding='utf8')
