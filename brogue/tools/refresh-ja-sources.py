"""Refresh Japanese source locations, refusing any new untranslated display text."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('locale_source',ROOT/'tools/locale-source.py')
source = importlib.util.module_from_spec(spec);spec.loader.exec_module(source)
known = {}
for path in (ROOT/'locales/ja').glob('*.json'):
    for entry in json.loads(path.read_text(encoding='utf8')).get('entries',{}).values():
        if 'pattern' in entry: known.setdefault(entry['pattern'].lower(),entry)
        elif 'source' in entry: known[entry['source'].lower()] = entry
missing = []
for category in source.DISPLAY_CATEGORIES:
    path = ROOT/f'locales/ja/{category}.json'
    document = json.loads(path.read_text(encoding='utf8'))
    english = json.loads((ROOT/f'locales/en/{category}.json').read_text(encoding='utf8'))['entries']
    updated = {}
    for key, original in english.items():
        pattern,args = source.display_pattern(original)
        previous = document['entries'].get(key) or known.get(pattern.lower())
        if previous:
            entry = {**previous,'source':original['text'],'pattern':pattern,'sources':original['sources'],
                     'arguments':[fmt for _,fmt in args]}
        elif not any(c.isascii() and c.isalpha() for c in pattern):
            entry = {'source':original['text'],'pattern':pattern,'text':pattern,'sources':original['sources'],
                     'arguments':[fmt for _,fmt in args], 'preserve':'already_localized'}
        elif pattern == 'bログ':
            entry = {'source':original['text'],'pattern':pattern,'text':pattern,'sources':original['sources'],
                     'arguments':[],'preserve':'already_localized'}
        else:
            missing.append((key,pattern));continue
        kinds,_ = source.runtime_arguments(entry,pattern,args)
        entry['omitted_arguments'] = sorted(set(entry.get('omitted_arguments',[])) | {
            i for i,kind in enumerate(kinds) if kind=='e' and '{'+str(i)+'}' not in entry['text']})
        updated[key] = entry
    document['entries'] = updated
    path.write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
if missing:
    for key,pattern in missing: print(key,repr(pattern))
    raise SystemExit('New untranslated display text; fill the Japanese catalog before compiling.')
print('Japanese source locations refreshed.')
