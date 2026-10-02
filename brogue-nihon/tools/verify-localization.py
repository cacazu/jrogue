"""Verify native text handling, real SDL frames, and unchanged English exports."""
import csv
import hashlib
import json
import os
from pathlib import Path
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / '.build/validation'
OUTPUT.mkdir(parents=True, exist_ok=True)
EXECUTABLE = ROOT / 'bin/brogue-nihon.exe'
environment = os.environ.copy()
environment['PATH'] = str(ROOT / 'bin') + os.pathsep + environment.get('PATH', '')
SCENES = ('menu-en', 'menu-ja', 'game-en', 'game-ja', 'pickup-ja', 'history-en', 'history-ja', 'inventory-ja', 'help-ja', 'wrap-ja')

def run(arguments, directory=OUTPUT, executable=EXECUTABLE):
    process = subprocess.run([str(executable), *arguments], cwd=directory,
                             env=environment, capture_output=True, timeout=45)
    if process.returncode:
        raise RuntimeError(process.stderr.decode('utf-8', errors='replace') + '\n' + process.stdout.decode('utf-8', errors='replace'))
    return process

run(['--test-localization'])
report = {'text_checks': 'passed', 'frames': {}, 'english_exports': {}}
for backend in ('cpu', 'gpu'):
    directory = OUTPUT / backend
    directory.mkdir(exist_ok=True)
    arguments = ['--verify-localization', '--data-dir', str(ROOT / 'bin')]
    if backend == 'cpu': arguments.append('--no-gpu')
    process = run(arguments, directory)
    log = process.stderr.decode('utf-8', errors='strict')
    (directory / 'run.log').write_text(log, encoding='utf-8')
    assert '(software,' in log if backend == 'cpu' else '(software,' not in log, log
    game_report = json.loads((directory / 'verification.json').read_text())
    assert game_report['archive_unchanged'] and game_report['turn_unchanged'] and game_report['substantive_rng_unchanged']
    assert game_report['recording_unchanged']
    assert game_report['missing_glyphs'] == 0
    scenes = {}
    for scene in SCENES:
        rows = list(csv.DictReader((directory / (scene + '.cells.tsv')).open(), delimiter='\t'))
        cells = {(int(row['x']), int(row['y'])): int(row['glyph']) for row in rows}
        assert len(cells) == 100 * 34
        def cell_text(x1=0, y1=0, x2=100, y2=34):
            lines = []
            for y in range(y1, y2):
                line = ''
                for x in range(x1, x2):
                    value = cells[x, y]
                    if value == 0x110000: continue
                    line += chr(value - 0x110000) if value > 0x110000 else chr(value) if 32 <= value < 128 else ' '
                lines.append(line.strip())
            return '\n'.join(lines)
        expected = {
            'menu-ja': ['新しいゲーム [N]', '終了 [Q]'],
            'game-ja': ['体力', '満腹度'], 'pickup-ja': ['金貨を123枚見つけた。'],
            'history-ja': ['金貨を123枚見つけた。', '空腹になった。（2回）'],
            'history-en': ['You found 123 pieces of gold.', 'You are hungry.'],
            'inventory-ja': ['短剣', '革の鎧', '食料'], 'help-ja': ['操作一覧', 'F2'],
        }.get(scene, [])
        for text in expected: assert text in cell_text(), (scene, text, cell_text())
        if scene == 'wrap-ja':
            wrapped = cell_text(30, 10, 55, 18).replace('\n', '')
            assert 'イェンダーの魔除け' in wrapped and '脱出せよ' in wrapped, wrapped
        unicode_cells = [(x, y) for (x, y), glyph in cells.items() if glyph > 0x110000]
        for x, y in unicode_cells:
            cp = cells[x, y] - 0x110000
            if cp >= 0x2e80:
                assert x < 99 and cells[x + 1, y] == 0x110000, (scene, x, y, cp)
        if scene.endswith('-ja'): assert unicode_cells, scene
        picture = Image.open(directory / (scene + '.png')).convert('RGB')
        extrema = picture.getextrema()
        assert any(high - low > 20 for low, high in extrema), scene
        painted = 0
        for x, y in unicode_cells:
            region = picture.crop((x * picture.width // 100, y * picture.height // 34,
                                   (x + 2) * picture.width // 100, (y + 1) * picture.height // 34))
            if any(high - low > 20 for low, high in region.getextrema()): painted += 1
        assert not unicode_cells or painted > len(unicode_cells) / 2, (scene, painted, len(unicode_cells))
        scenes[scene] = {'unicode_glyphs': len(unicode_cells), 'painted_glyphs': painted, 'size': list(picture.size)}
    report['frames'][backend] = {'state': game_report, 'scenes': scenes, 'renderer_log': log.splitlines()[0]}
    print('Verified', backend, 'frames:', len(scenes))

baseline = ROOT / '.build/baseline.exe'
for variant in ('brogue', 'rapid_brogue', 'bullet_brogue'):
    options = [] if variant == 'brogue' else ['--variant', variant]
    options += ['--csv', '--print-seed-catalog', '42', '1', '2']
    english = run(['--language', 'en', *options]).stdout
    japanese = run(['--language', 'ja', *options]).stdout
    assert english and english == japanese, variant
    baseline_equal = None
    if baseline.exists():
        original = run(options, executable=baseline).stdout
        assert original == english, variant
        baseline_equal = True
    report['english_exports'][variant] = {'en_equals_ja': True, 'equals_baseline': baseline_equal,
        'sha256': hashlib.sha256(english).hexdigest()}
    print('Verified English export:', variant, '(baseline comparison:', baseline_equal, ')')
bad_language = subprocess.run([str(EXECUTABLE), '--language', 'invalid'], cwd=OUTPUT, env=environment, capture_output=True, timeout=10)
assert bad_language.returncode and b'--language requires en or ja' in bad_language.stderr
report['executable_sha256'] = hashlib.sha256(EXECUTABLE.read_bytes()).hexdigest()
(OUTPUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Localization verification passed:', OUTPUT / 'report.json')
