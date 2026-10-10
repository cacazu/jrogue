"""Normalize removable additions and verify unchanged original savefile bytes."""
from pathlib import Path
import re
import difflib
ROOT=Path(__file__).resolve().parent.parent
path=ROOT/'logic/savefile.c'
baseline=(ROOT/'tests/accepted-source-snapshot/savefile.c').read_bytes()
source=path.read_bytes()
source=source.replace(b'\tok = try_load(f, loaders);\n',b'\tok = try_load(f, loaders);\r\n')
pattern=re.compile(rb'/\* AB_WEB_HISTORY_BEGIN \*/[\s\S]*?/\* AB_WEB_HISTORY_END \*/')
if pattern.sub(b'',source)!=baseline:
 source=re.sub(rb'/\* AB_WEB_HISTORY_END \*/(\r?\n)',rb'\1/* AB_WEB_HISTORY_END */',source)
 source=re.sub(rb'(/\* AB_WEB_HISTORY_BEGIN \*/(?:(?!/\* AB_WEB_HISTORY_END \*/)[\s\S])*ab_web_save_bytes_remaining(?:(?!/\* AB_WEB_HISTORY_END \*/)[\s\S])*)/\* AB_WEB_HISTORY_END \*/(\r?\n)',rb'\1\2/* AB_WEB_HISTORY_END */',source)
if pattern.sub(b'',source)!=baseline:
 print('newline_counts',baseline.count(b'\r\n'),source.count(b'\r\n'))
 print('tails',repr(baseline[-80:]),repr(pattern.sub(b'',source)[-80:]))
 stripped=pattern.sub(b'',source)
 mismatch=next((i for i,(a,b) in enumerate(zip(baseline,stripped)) if a!=b),min(len(baseline),len(stripped)))
 print('first_byte_difference',mismatch,repr(baseline[max(0,mismatch-50):mismatch+80]),repr(stripped[max(0,mismatch-50):mismatch+80]))
 for line in list(difflib.unified_diff(baseline.decode().splitlines(),pattern.sub(b'',source).decode().splitlines()))[:40]:print(line)
 raise AssertionError('History save adapter must reconstruct accepted savefile bytes')
path.write_bytes(source)
print('History save adapter reconstructs accepted native savefile bytes.')
