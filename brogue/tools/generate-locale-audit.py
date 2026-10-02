"""Generate all item/monster descriptions without a window or input automation."""
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
for variant in ('brogue','bullet_brogue','rapid_brogue'):
    destination = ROOT/'.build/game-text-audit'/variant
    destination.mkdir(parents=True,exist_ok=True)
    command = [str(ROOT/'bin/brogue-ja.exe'),'--audit-localization-game','--language','ja']
    if variant != 'brogue': command += ['--variant',variant]
    started = time.perf_counter()
    with (destination/'audit.log').open('wb') as log:
        subprocess.run(command,cwd=destination,stdout=log,stderr=log,check=True,timeout=600)
    count = len((destination/'generated-text.jsonl').read_text(encoding='utf8').splitlines())
    print(f'{variant}: {count} descriptions, {time.perf_counter()-started:.2f} seconds',flush=True)
