"""Check every translated character against the font, without drawing a screen."""
import ctypes
import json
import os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
directory=os.add_dll_directory(str(ROOT/'bin'))
ttf=ctypes.CDLL(str(ROOT/'bin/SDL2_ttf.dll'))
ttf.TTF_OpenFont.argtypes=[ctypes.c_char_p,ctypes.c_int]
ttf.TTF_OpenFont.restype=ctypes.c_void_p
ttf.TTF_GlyphIsProvided32.argtypes=[ctypes.c_void_p,ctypes.c_uint32]
ttf.TTF_CloseFont.argtypes=[ctypes.c_void_p]
assert ttf.TTF_Init()==0
font_path=Path(os.environ.get('BROGUE_FONT','C:/Windows/Fonts/meiryo.ttc'))
font=ttf.TTF_OpenFont(str(font_path).encode('utf8'),22)
assert font,font_path
characters=set()
for path in (ROOT/'locales/ja').glob('*.json'):
    for entry in json.loads(path.read_text(encoding='utf8')).get('entries',{}).values():
        characters.update(c for c in entry['text'] if ord(c)>=128)
missing=[f'U+{ord(c):04X}' for c in sorted(characters) if not ttf.TTF_GlyphIsProvided32(font,ord(c))]
ttf.TTF_CloseFont(font)
ttf.TTF_Quit()
report={'font':str(font_path),'characters_checked':len(characters),'missing':missing}
(ROOT/'.build/font-code-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(f'Font character check: {len(characters)} characters, {len(missing)} missing')
assert not missing,missing
