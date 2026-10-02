"""Audit actual game-generated English text with the native display implementation."""
import ctypes
import json
from pathlib import Path
import re
import time
import argparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--failures-only',action='store_true')
parser.add_argument('--from-game',action='store_true',help='Inspect the Japanese text emitted by the freshly built game')
options = parser.parse_args()

ROOT = Path(__file__).resolve().parents[1]
library = ctypes.CDLL(str(ROOT/'.build/locale-probe.dll'))
library.localeDisplay.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_char_p]
library.localeSetLanguage.argtypes = [ctypes.c_char_p]
library.localeWrap.argtypes = [ctypes.c_void_p,ctypes.c_size_t,ctypes.c_char_p,ctypes.c_int]
allowed = {'esc','return','space','tab','ctrl','shift','enter','alt','hjklyubn'}
failures = []
checked = 0
started = time.perf_counter()
maximum_rows = 0
maximum_bytes = 0
groups = [(p.parent.name,[json.loads(line) for line in p.read_text(encoding='utf8').splitlines()])
          for p in sorted((ROOT/'.build/game-text-audit').glob('*/generated-text.jsonl'))]
if options.failures_only:
    groups = [('previous-failures',json.loads((ROOT/'.build/game-text-failures.json').read_text(encoding='utf8')))]
for variant, rows in groups:
    for row in rows:
        output = ctypes.create_string_buffer(32768)
        original = row['english'].encode('utf8')
        library.localeSetLanguage(b'en')
        library.localeDisplay(output,len(output),original)
        assert output.value == original, row
        if options.from_game: actual = row['japanese']
        else:
            library.localeSetLanguage(b'ja')
            library.localeDisplay(output,len(output),original)
            actual = output.value.decode('utf8',errors='strict')
        maximum_bytes = max(maximum_bytes,len(actual.encode('utf8')))
        if row['kind'].endswith('description'):
            wrapped = ctypes.create_string_buffer(32768)
            lines = library.localeWrap(wrapped,len(wrapped),actual.encode('utf8'),98)
            maximum_rows = max(maximum_rows,lines)
            if lines > 30:
                failures.append({**row,'japanese':actual,'remaining':['tooltip_exceeds_viewport'],'rows':lines})
        plain = re.sub('\x19...','',actual)
        words = [w for w in re.findall('[A-Za-z]+',plain) if len(w)>1 and w.lower() not in allowed]
        if words:
            failures.append({**row, 'variant':row.get('variant',variant), 'japanese':actual, 'remaining':words})
        checked += 1
report = {'checked':checked,'failures':failures,'seconds':round(time.perf_counter()-started,2),
          'from_game':options.from_game,'maximum_tooltip_rows_at_98_cells':maximum_rows,'maximum_display_bytes':maximum_bytes,
          'english_mode_unchanged':True}
(ROOT/'.build/game-text-failures.json').write_text(json.dumps(failures,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(ROOT/'.build/generated-text-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(f'Generated text: {checked} cases, {len(failures)} failures, {report["seconds"]} seconds')
for failure in failures[:8]: print(json.dumps(failure,ensure_ascii=False))
raise SystemExit(bool(failures))
