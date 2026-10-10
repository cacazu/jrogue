"""Source-only extraction of unchanged v1 immutable-baseline/payload guards."""
from pathlib import Path
import hashlib

HERE = Path(__file__).resolve().parent
original = HERE / 'audit/v1-reproduce-font-free-package.py'
assert hashlib.sha256(original.read_bytes()).hexdigest() == 'fd1ab92947f9404f4690091d52b0450c4cc60ae81191850b85815cdd35986252'
text = original.read_text(encoding='utf-8')
start = text.index('def validate_startup_candidate(')
end = text.index('def metadata(', start)
main = text.index('def main():', end)
baseline = text[:start] + text[end:main]
baseline = baseline[baseline.index('from __future__ import annotations'):]
for line in ('import argparse\n', 'from datetime import datetime, timezone\n', 'import shutil\n', 'import subprocess\n'):
    baseline = baseline.replace(line, '')
(HERE / 'immutable_baseline.py').write_text(
    '"""Unchanged immutable native-EH and payload guards extracted from reviewed v1.\n'
    'No startup-candidate acceptance or execution path is retained. GPL-3.0-or-later.\n"""\n'
    + baseline, encoding='utf-8')
print('Extracted baseline and payload guards; no game/build execution.')
