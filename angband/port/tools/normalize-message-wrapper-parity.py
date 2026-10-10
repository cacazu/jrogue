"""Keep every added wrapper byte inside removable source-projection tags."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'logic/message.c'
baseline=(ROOT/'tests/dynamic-message-source-snapshot/message.c').read_bytes()
text=source.read_bytes()
tag=re.compile(rb'/\* AB_GAME_DYNAMIC_BEGIN \*/[\s\S]*?/\* AB_GAME_DYNAMIC_END \*/')
blocks=tag.findall(text)
assert len(blocks)==2
nl=b'\r\n' if b'\r\n' in baseline else b'\n'
header=blocks[0]
body=blocks[1]
# Rewrite from the immutable baseline, not from a guess about newline removal.
insertion=baseline.index(b'#include "player.h"')+len(b'#include "player.h"')
rewritten=baseline[:insertion]+header+baseline[insertion:]+body
assert tag.sub(b'',rewritten)==baseline
source.write_bytes(rewritten)
print('Native message wrapper reconstructs immutable original bytes.')
