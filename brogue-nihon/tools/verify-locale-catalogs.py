"""Code-based audit: source inventory, runtime translations, and composed text."""
import ctypes
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('locale_source', ROOT/'tools/locale-source.py')
source = importlib.util.module_from_spec(spec); spec.loader.exec_module(source)
library = ctypes.CDLL(str(ROOT/'.build/locale-probe.dll'))
library.localeDisplay.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_char_p]
library.localeSetLanguage.argtypes = [ctypes.c_char_p]
library.localeSetLanguage(b'ja')

def display(text):
    output = ctypes.create_string_buffer(16384)
    library.localeDisplay(output, len(output), text.encode('utf8'))
    return output.value.decode('utf8', errors='strict')

def instantiate(entry, overrides=None):
    kinds, domains = source.runtime_arguments(entry,entry['pattern'],list(enumerate(entry['arguments'])))
    def argument(match):
        index = int(match[1]); kind = kinds[index]
        if overrides and index in overrides: return overrides[index]
        if kind == 'e': return ''
        if domains[index]: return domains[index].split('\x1f')[0]
        if kind == 'g': return 'n'
        if kind == 'r': return 'th' if entry['pattern'][match.end():].startswith(' floor') else 's'
        if kind == 'p': return 'he'
        if kind == 'c': return 'j'
        if kind in ('n','i'): return '42'
        # Bare concatenation formats contain no display phrase of their own.
        if not re.sub(r'\{\d+\}', '', entry['pattern']).strip() and index: return ''
        if entry['pattern'][match.end():match.end()+1].isalpha(): return ''
        return 'jackal'
    result = re.sub(r'\{(\d+)\}', argument, entry['pattern'])
    return re.sub(r'\$(?:HIMSELFHERSELF|HISHER|HIMHER|HESHE)\b','he',result)

allowed = {'esc','return','space','tab','ctrl','shift','enter','alt','hjklyubn','x'}
failures = []; checked = 0
for category in source.DISPLAY_CATEGORIES:
    english = json.loads((ROOT/f'locales/en/{category}.json').read_text(encoding='utf8'))['entries']
    japanese = json.loads((ROOT/f'locales/ja/{category}.json').read_text(encoding='utf8'))['entries']
    assert set(english) == set(japanese), category
    for key, entry in japanese.items():
        assert entry['source'] == english[key]['text'], key
        if entry.get('preserve'): continue
        inputs = {instantiate(entry)}
        kinds,domains = source.runtime_arguments(entry,entry['pattern'],list(enumerate(entry['arguments'])))
        for i,kind in enumerate(kinds):
            alternatives = domains[i].split('\x1f') if domains[i] else ['he','she','it'] if kind=='p' else []
            for alternative in alternatives:
                inputs.add(instantiate(entry,{i:alternative}))
        for text in sorted(inputs):
            actual = display(text)
            remaining = [w for w in source.display_words(actual) if len(w) > 1 and w.lower() not in allowed]
            if remaining: failures.append({'id':key, 'input':text,'output':actual,'remaining':remaining})
            checked += 1

cases = {
    'Brogue': ['brogue-nihon'],
    'brogue-nihon': ['brogue-nihon'],
    'Brogue - Optimizing tile 1 / 3 ...': ['brogue-nihon', 'タイル'],
    "You're not hungry enough to fully enjoy the food. Eat it anyway?": ['空腹','食料','食べ'],
    "You're not hungry enough to fully enjoy the mango. Eat it anyway?": ['空腹','マンゴー','食べ'],
    'You defeated the jackal': ['ジャッカル','倒した'],
    'The jackal bites you, catching you unaware': ['ジャッカル','あなた'],
    'This spindly plant grows seed pods famous for their healing properties.': ['植物','治癒','莢'],
    'a potion of healing (ready)': ['薬','治癒'],
    'The jackal has a 65% chance to hit you, typically hits for 20% of your current health, and at worst, could defeat you in 5 hits.': ['ジャッカル','65','20','5'],
    'Your dagger (a) will hit the jackal for between 10% and 30% of its current health.': ['短剣','ジャッカル','10','30'],
    'The oak staff has 2 charges remaining out of a maximum of 3 charges, and, with your current rings, recovers a charge in approximately 50 turns.': ['杖','2','3','50'],
}
for text, required in cases.items():
    actual = display(text)
    remaining = [w for w in source.display_words(actual) if len(w)>1 and w.lower() not in allowed]
    if remaining or any(word not in actual for word in required):
        failures.append({'id':'composition','input':text,'output':actual,'remaining':remaining,'required':required})
    checked += 1

# Combat is assembled from names, verb arrays and situational clauses.
composed = json.loads((ROOT/'locales/ja/composed.json').read_text(encoding='utf8'))['entries']
for key,entry in composed.items():
    if not re.fullmatch(r'combat\.[0-9a-f]+',key): continue
    base = re.sub(r'\{(\d+)\}',lambda m:'the jackal' if m[1]=='0' else 'his' if entry['arguments'][int(m[1])].startswith('$') else 'you',entry['source'])
    for suffix in ('',', catching you unaware',' while you dangle helplessly',' while you are paralyzed',' in your sleep',' with a vicious lunge attack',' but does no damage'):
        actual = display(base+suffix)
        words = [w for w in source.display_words(actual) if len(w)>1 and w.lower() not in allowed]
        if words: failures.append({'id':key,'input':base+suffix,'output':actual,'remaining':words})
        checked += 1

library.localeSetLanguage(b'en')
for text in cases: assert display(text) == text, text
report = {'source_entries_checked':checked, 'failures':failures, 'english_mode_unchanged':True}
(ROOT/'.build/locale-code-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(f'Code-based localization audit: {checked} cases, {len(failures)} failures')
for failure in failures[:20]: print(json.dumps(failure,ensure_ascii=False))
raise SystemExit(bool(failures))
