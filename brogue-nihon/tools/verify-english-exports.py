"""Verify that display language changes neither generated dungeons nor English CSV data."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
environment = os.environ.copy()
environment['PATH'] = str(ROOT/'bin') + os.pathsep + environment.get('PATH','')
report = {}
for variant in ('brogue','rapid_brogue','bullet_brogue'):
    directory = ROOT/'.build/export-audit'/variant
    directory.mkdir(parents=True,exist_ok=True)
    options = [] if variant=='brogue' else ['--variant',variant]
    options += ['--csv','--print-seed-catalog','42','1','2']
    def run(executable,arguments):
        return subprocess.run([str(executable),*arguments],cwd=directory,env=environment,
                              capture_output=True,check=True,timeout=60).stdout
    english = run(ROOT/'bin/brogue-nihon.exe',['--language','en',*options])
    japanese = run(ROOT/'bin/brogue-nihon.exe',['--language','ja',*options])
    assert english and english==japanese,variant
    baseline = ROOT/'.build/baseline.exe'
    equals_baseline = None
    if baseline.exists():
        assert run(baseline,options)==english,variant
        equals_baseline=True
    report[variant]={'en_equals_ja':True,'equals_baseline':equals_baseline,'sha256':hashlib.sha256(english).hexdigest()}
    print(f'English export verified: {variant}, baseline={equals_baseline}',flush=True)
(ROOT/'.build/english-export-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
