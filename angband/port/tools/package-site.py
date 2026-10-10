"""Stage local HTML and exact corresponding source; perform no deployment."""
from pathlib import Path
from datetime import datetime
import hashlib, json, re, shutil, zipfile
ROOT=Path(__file__).resolve().parent.parent
DIST=ROOT/'dist'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

# These immutable source fixtures are read by the shipped Node parity tests.
# Keep the whitelist separate from historical engine/browser snapshots so a new
# artifact in a snapshot directory cannot silently enter the source archive.
SOURCE_TEST_FIXTURES = {
    'accepted-source-snapshot': (
        'cmd-cave.c cmd-pickup.c manifest.json player-birth.c savefile.c '
        'ui-birth.c ui-display.c ui-help.c ui-input.c ui-options.c ui-player.c '
        'ui-spell.c web-semantic.c web-semantic.h'
    ).split(),
    'dynamic-message-source-snapshot': (
        'cmd-wizard.c effect-handler-attack.c effect-handler-general.c '
        'game-world.c gen-util.c message.c mon-attack.c mon-blows.c mon-lore.c '
        'mon-move.c mon-util.c obj-gear.c obj-ignore.c obj-knowledge.c obj-pile.c '
        'obj-properties.c player-attack.c player-util.c player.c project-player.c '
        'store.c trap.c ui-player.c ui-prefs.c'
    ).split(),
    'static-message-source-snapshot': (
        'cave-square.c cmd-misc.c cmd-obj.c cmd-wizard.c effect-handler-attack.c '
        'effect-handler-general.c effects-info.c effects.c game-input.c '
        'game-world.c gen-util.c mon-blows.c mon-make.c mon-move.c mon-util.c '
        'obj-chest.c obj-gear.c obj-knowledge.c obj-pile.c obj-power.c obj-randart.c '
        'player-attack.c player-birth.c player-calcs.c player-quest.c player-spell.c '
        'player-timed.c player-util.c player.c project-feat.c project-mon.c '
        'project-obj.c project-player.c store.c trap.c ui-command.c ui-context.c '
        'ui-death.c ui-display.c ui-effect.c ui-game.c ui-knowledge.c ui-options.c '
        'ui-player.c ui-spell.c ui-store.c ui-target.c'
    ).split(),
    'replay-source-snapshot': (
        'clock-sites.json mon-make.c player-util.c score.c ui-death.c '
        'ui-input.c z-file.c z-rand.c'
    ).split(),
}


# Explicit dependencies for the eight remaining native-presentation families.
# This complements, and never replaces or broadens, the historical snapshot
# whitelist above. Generated storage fixture outputs are required by the shipped
# Node test; their driver and exact input hashes make them reproducible.
REMAINING_FAMILY_SOURCE_FILES = {
    'logic': (
        'web-character-matrix.c web-character-matrix.h '
        'web-chest-message.c web-chest-message.h '
        'web-context-menu.c web-context-menu.h web-menu-controller.h '
        'web-game-history.c web-game-history.h '
        'web-look-target.c web-look-target.h '
        'web-message-recall.c web-message-recall.h '
        'web-recall-knowledge.c web-recall-knowledge.h '
        'ui-entry.c ui-entry.h ui-entry-renderers.c list-terrain.h '
        'list-history-types.h player-history.h message.h '
        'web-semantic.c web-semantic.h web-ui-text.h'
    ).split(),
    'migration/character-matrix-data': (
        'source-manifest.json en.json ja.json README.md coverage.json '
        'checks.json wording-review.json native-baseline/ui-player.c '
        'native-baseline/ui-entry.c native-baseline/ui-entry.h '
        'native-baseline/ui-entry-renderers.c'
    ).split(),
    'migration/chest-message-data': (
        'source-manifest.json schema.json en.json ja.json '
        'chest-bindings.inc native-before/obj-chest.c'
    ).split(),
    'migration/context-menu-data': (
        'source-manifest.json source-evidence.json README.md native-parity.mjs '
        'command-bindings.inc command-source-snapshot.c '
        'producer-snapshot.c upstream-snapshot.c shortcut-contract.json'
    ).split(),
    'migration/game-history-data': (
        'source-manifest.json schema.json en.json ja.json catalog-digest.inc '
        'source-check-evidence.json run-wire-harness.py wire-harness-prefix.c '
        'wire-harness-tests.c native-before/cmd-misc.c native-before/mon-util.c '
        'native-before/player-history.c native-before/player.c native-before/ui-history.c'
    ).split(),
    'migration/look-target-data': (
        'source-manifest.json schema.json en.json ja.json README.md '
        'build-reviewed-look.py integration-baseline.json '
        'source-baseline/cave-square.c source-baseline/target.c '
        'source-baseline/ui-target.c'
    ).split(),
    'migration/message-recall-layout-data': (
        'source-manifest.json schema.json en.json ja.json'
    ).split(),
    'migration/message-recall-storage-data': (
        'source-manifest.json README.md baseline-message.c '
        'baseline-web-semantic.c baseline-web-semantic.h '
        'build-fixture.mjs fixture-api.h fixture.c '
        'fixture-build.json fixture.mjs fixture.wasm'
    ).split(),
    'migration/recall-knowledge-data': (
        'source-manifest.json schema.json en.json ja.json baseline-ui-knowledge.c'
    ).split(),
    'migration': ['perception-rng-boundary.json'],
    'docs': ['PERCEPTION-RNG-AUDIT.md', 'NATIVE-NAME-EDITOR-BOUNDARY.md'],
    'tests': (
        'native-annotations.mjs character-matrix.test.mjs '
        'character-export-adapter.test.mjs chest-message.test.mjs '
        'context-menu.test.mjs context-menu-adapter.test.mjs '
        'game-history.test.mjs look-target.test.mjs '
        'message-recall-storage.test.mjs recall-knowledge.test.mjs '
        'perception-rng.test.mjs presentation-input-byte-limit.test.mjs '
        'browser-normal-play.mjs browser-native-perception.mjs '
        'browser-presentation-remaining.mjs '
        'look-target-fixture/fixture.c look-target-fixture/mock.h '
        'look-target-fixture/run.mjs'
    ).split(),
    'tools': ['package-site.py', 'check-package.py'],
    'web': (
        'character-export.js core.js protocol.js semantic-view.js app.js worker.js'
    ).split(),
}

def remaining_family_source_paths():
    required = {Path(directory) / name
                for directory, names in REMAINING_FAMILY_SOURCE_FILES.items()
                for name in names}
    fixture = ROOT / 'migration/message-recall-storage-data/fixture-build.json'
    metadata = json.loads(fixture.read_text(encoding='utf-8'))
    assert metadata.get('sourceStableDuringBuild') is True, 'unstable storage fixture source'
    assert isinstance(metadata.get('inputs'), dict) and len(metadata['inputs']) >= 9, 'storage fixture input hashes missing'
    for name, expected in metadata['inputs'].items():
        relative = Path(name)
        assert not relative.is_absolute() and '..' not in relative.parts and relative.parts[0] in ('logic', 'migration'), 'unexpected storage fixture input: ' + name
        assert (ROOT / relative).is_file() and sha(ROOT / relative) == expected, 'stale storage fixture input: ' + name
        required.add(relative)
    assert set(metadata.get('outputs', {})) == {'fixture.mjs', 'fixture.wasm'}, 'storage fixture outputs missing'
    for name, expected in metadata['outputs'].items():
        relative = Path('migration/message-recall-storage-data') / name
        assert (ROOT / relative).is_file() and sha(ROOT / relative) == expected, 'stale storage fixture output: ' + name
    for relative in required:
        assert (ROOT / relative).is_file(), 'missing remaining-family source dependency: ' + relative.as_posix()
    return required

def source_test_fixture_paths():
    fixtures = {Path('tests') / directory / name
                for directory, names in SOURCE_TEST_FIXTURES.items()
                for name in names}
    death = json.loads((ROOT / 'migration/death-data/source-manifest.json').read_text(encoding='utf-8'))
    baseline = Path('tests/first-naming-build-snapshot/source')
    assert death['baseline'] == baseline.as_posix(), 'unexpected death baseline'
    for name in death['source_files']:
        relative = Path(name)
        assert relative.parts[0] == 'logic' and len(relative.parts) == 2 and relative.suffix == '.c', name
        fixtures.add(baseline / relative)
    fixtures.update({baseline / 'logic/score.h', baseline / 'data/gamedata/trap.txt'})
    for relative in fixtures:
        assert (ROOT / relative).is_file(), 'missing immutable source-test fixture: ' + relative.as_posix()
    return fixtures

# These inputs precede packaging. Do not depend on verification.json or the
# packaged-browser run: both are produced only after the local package exists.
REMAINING_BROWSER_EVIDENCE = {
    'browser-normal-play-evidence': 'browser-normal',
    'browser-presentation-remaining-evidence': 'browser-presentations',
    'browser-native-perception-evidence': 'browser-native-perception',
}
REMAINING_FIXTURE_JOBS = ('history-fixture', 'recall-fixture', 'look-fixture')
NATIVE_PERCEPTION_SOURCE_FILES = {
    'logic/ui-map.c', 'logic/cave-map.c', 'logic/z-rand.h', 'logic/z-rand.c',
    'logic/ui-display.c', 'logic/game-world.c', 'logic/ui-command.c', 'logic/ui-game.c',
    'logic/cmd-wizard.c', 'logic/main-web.c', 'logic/z-color.h', 'logic/ui-target.c',
    'logic/web-look-target.c', 'logic/effect-handler-general.c', 'logic/player-timed.c',
    'data/gamedata/monster.txt', 'data/gamedata/monster_base.txt',
    'data/gamedata/player_timed.txt',
}

def evidence_time(value, label):
    assert isinstance(value, str), label + ': timestamp missing'
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise AssertionError(label + ': invalid timestamp') from None
    assert parsed.tzinfo is not None, label + ': timestamp timezone missing'
    return parsed.timestamp()

def evidence_positive(value):
    return type(value) in (int, float) and value > 0 and value < float('inf')

def evidence_pins(pins, label):
    assert isinstance(pins, dict) and pins, label + ': source pins missing'
    for name, expected in pins.items():
        relative = Path(name)
        assert not relative.is_absolute() and '..' not in relative.parts, label + ': unexpected source path'
        assert isinstance(expected, str) and re.fullmatch(r'[0-9a-f]{64}', expected), label + ': invalid source hash'
        assert (ROOT / relative).is_file() and sha(ROOT / relative) == expected, label + ': stale source: ' + name

def fixture_log_result(name, field):
    log = (ROOT / 'tests/source-integration-evidence' / (name + '.log')).read_text(encoding='utf-8')
    for line in reversed(log.splitlines()):
        if not line.startswith('{'):
            continue
        try:
            result = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(result, dict) and field in result:
            return result
    raise AssertionError(name + ': C fixture result missing')

def remaining_acceptance_evidence(manifest):
    jobs = {}
    for name in (*REMAINING_BROWSER_EVIDENCE.values(), *REMAINING_FIXTURE_JOBS):
        row = json.loads((ROOT / 'tests/source-integration-evidence' / (name + '-resources.json')).read_text(encoding='utf-8'))
        assert type(row.get('exitCode')) is int and row['exitCode'] == 0, name + ': measured job failed or pending'
        assert row.get('stoppedForCommitExhaustion') is False, name + ': resource exhaustion stopped job'
        assert type(row.get('concurrency')) is int and row['concurrency'] == 1, name + ': measured jobs must be serialized'
        assert evidence_positive(row.get('wallSeconds')) and evidence_positive(row.get('sampledPeakTreeWorkingSetBytes')), name + ': resource measurements missing'
        assert isinstance(row.get('command'), list) and row['command'] and all(isinstance(part, str) and part for part in row['command']), name + ': measured command missing'
        evidence_time(row.get('startedAt'), name)
        jobs[name] = row
    browsers = {}
    manifest_hash = sha(ROOT / 'build/manifest.json')
    for directory, job_name in REMAINING_BROWSER_EVIDENCE.items():
        row = json.loads((ROOT / 'tests' / directory / 'results.json').read_text(encoding='utf-8'))
        assert row.get('passed') is True, directory + ': browser acceptance missing'
        checks = row.get('checks')
        assert isinstance(checks, list) and checks and all(isinstance(check, dict) and check.get('passed') is True for check in checks), directory + ': failed or pending checks'
        assert row.get('errors') == [] and row.get('consoleErrors') == [], directory + ': runtime or console errors'
        assert row.get('engineStableDuringRun') is True, directory + ': engine changed during run'
        engine = row.get('engine')
        assert isinstance(engine, dict) and engine.get('outputs') == manifest['outputs'], directory + ': different engine outputs'
        assert engine.get('inputFingerprint', {}).get('sha256') == manifest['inputFingerprint']['sha256'], directory + ': source fingerprint differs'
        assert engine.get('upstreamCommit') == manifest['upstreamCommit'], directory + ': upstream differs'
        assert row.get('engineManifestSha256') == manifest_hash and row.get('engineHashes') == manifest['outputs'], directory + ': captured engine provenance differs'
        if 'outputs' in row:
            assert row['outputs'] == manifest['outputs'], directory + ': additional output pins differ'
        assert row.get('pass') is True, directory + ': pass flag missing or differs'
        if 'notRun' in row:
            assert row['notRun'] == [], directory + ': required paths were not run'
        start = evidence_time(row.get('startedAt'), directory)
        finish = evidence_time(row.get('finishedAt'), directory)
        measured_start = evidence_time(jobs[job_name]['startedAt'], job_name)
        assert measured_start <= start <= finish <= measured_start + jobs[job_name]['wallSeconds'] + 2, directory + ': evidence does not belong to measured job'
        if directory == 'browser-native-perception-evidence':
            assert row.get('sourceStableDuringRun') is True and row.get('sourceCommit') == manifest['upstreamCommit'], directory + ': source provenance differs'
            source = row.get('source')
            assert isinstance(source, dict) and source.get('upstream', {}).get('commit') == manifest['upstreamCommit'], directory + ': source upstream missing'
            sources = source.get('sources')
            assert isinstance(sources, list) and sources, directory + ': source capture missing'
            pins = {}
            for selected in sources:
                assert isinstance(selected, dict) and isinstance(selected.get('path'), str), directory + ': invalid captured source'
                assert selected['path'] not in pins, directory + ': duplicate captured source'
                pins[selected['path']] = selected.get('sha256')
            assert set(pins) == NATIVE_PERCEPTION_SOURCE_FILES, directory + ': source capture incomplete or unexpected'
            evidence_pins(pins, directory)
            for selected in sources:
                assert type(selected.get('bytes')) is int and (ROOT / selected['path']).stat().st_size == selected['bytes'], directory + ': source length differs'
        browsers[directory] = row
    history = fixture_log_result('history-fixture', 'actualCHistoryWireChecks')
    assert evidence_positive(history['actualCHistoryWireChecks']) and history.get('nativeLedgerUnchanged') is True and history.get('fixtureInputsStableDuringRun') is True, 'history-fixture: C fixture failed or source changed'
    evidence_pins(history.get('fixtureInputs'), 'history-fixture')
    recall = fixture_log_result('recall-fixture', 'actualCFixtureAccepted')
    assert recall.get('actualCFixtureAccepted') is True and recall.get('nativeQueueAndSaveLoadUsed') is True, 'recall-fixture: C fixture failed'
    fixture = json.loads((ROOT / 'migration/message-recall-storage-data/fixture-build.json').read_text(encoding='utf-8'))
    assert fixture.get('sourceStableDuringBuild') is True, 'recall-fixture: source changed during build'
    evidence_pins(fixture.get('inputs'), 'recall-fixture')
    assert recall.get('inputFiles') == len(fixture['inputs']) and recall.get('outputs') == fixture.get('outputs'), 'recall-fixture: compiled provenance differs'
    look = fixture_log_result('look-fixture', 'eventContractsValidated')
    assert look.get('passed') is True and look.get('sourceStableDuringRun') is True and evidence_positive(look['eventContractsValidated']) and look.get('events') == look['eventContractsValidated'], 'look-fixture: C fixture failed or source changed'
    evidence_pins(look.get('sourceHashes'), 'look-fixture')
    return browsers, jobs

def main():
    manifest=json.loads((ROOT/'build/manifest.json').read_text(encoding='utf-8'))
    for row in manifest['outputs']: assert sha(ROOT/'build'/row['name'])==row['sha256'],row['name']
    for row in manifest['inputFingerprint']['inputs']: assert sha(ROOT/row['file'])==row['sha256'],'source changed since build: '+row['file']
    browser=json.loads((ROOT/'tests/browser-review-evidence/results.json').read_text(encoding='utf-8'))
    assert browser.get('passed') and all(c['passed'] for c in browser['checks']),'browser acceptance missing'
    assert browser['engine']['outputs']==manifest['outputs'] and browser['engineStableDuringRun'],'browser tested different engine'
    jobs={}
    for name in ['rust-native-review','node-review','build','browser-review','browser-gameflows','browser-victory','wasm-descriptors']:
        p=ROOT/'tests/source-integration-evidence'/(name+'-resources.json')
        row=json.loads(p.read_text(encoding='utf-8'));assert row['exitCode']==0 and not row['stoppedForCommitExhaustion'],name
        jobs[name]=row
    remaining_browsers, remaining_jobs = remaining_acceptance_evidence(manifest)
    jobs.update(remaining_jobs)
    flows=json.loads((ROOT/'tests/browser-gameflow-evidence/results.json').read_text(encoding='utf-8'))
    assert flows.get('passed') and all(c['passed'] for c in flows['checks']),'additional game flow acceptance missing'
    assert flows['engine']['outputs']==manifest['outputs'] and flows['engineStableDuringRun'],'game flows tested different engine'
    victory=json.loads((ROOT/'tests/browser-victory-evidence/results.json').read_text(encoding='utf-8'))
    assert victory.get('passed') and all(c['passed'] for c in victory['checks']),'native wizard-victory acceptance missing'
    assert victory['engine']['outputs']==manifest['outputs'] and victory['engineStableDuringRun'],'victory tested different engine'
    descriptors=json.loads((ROOT/'tests/wasm-descriptor-evidence/results.json').read_text(encoding='utf-8'))
    assert descriptors.get('passed') and all(c['passed'] for c in descriptors['checks']),'compiled graph acceptance missing'
    assert descriptors['engine']['outputs']==manifest['outputs'] and descriptors['engineStableDuringRun'],'compiled graph tested different engine'
    required_test_fixtures=source_test_fixture_paths()
    required_remaining_sources=remaining_family_source_paths()
    required_sources=required_test_fixtures | required_remaining_sources
    records=[];source=ROOT/'source.zip'
    directories=['rust','logic','data','locales','migration','licenses','tools','web','docs','inventory','tests']
    omitted={'node_modules','__pycache__','browser-evidence','browser-review-evidence','browser-gameflow-evidence','browser-victory-evidence','browser-normal-play-evidence','browser-presentation-remaining-evidence','browser-native-perception-evidence','wasm-descriptor-evidence','source-integration-evidence'}
    with zipfile.ZipFile(source,'w',compression=zipfile.ZIP_DEFLATED) as archive:
        for directory in directories:
            for p in sorted((ROOT/directory).rglob('*')):
                if not p.is_file():continue
                rel=p.relative_to(ROOT)
                if (directory=='rust' and any(part=='target' or part.startswith('target-') for part in rel.parts[1:-1])) or any(part in omitted or part.startswith('profile-') for part in rel.parts):continue
                if any(part.endswith('-snapshot') for part in rel.parts) and rel not in required_sources:continue
                if directory=='logic' and p.suffix.lower() not in ('.c','.h','.m','.inc','.rc') and p.name!='Makefile.src':continue
                archive.write(p,rel.as_posix());records.append({'file':rel.as_posix(),'sha256':sha(p)})
        archive.write(ROOT/'README.md','README.md');records.append({'file':'README.md','sha256':sha(ROOT/'README.md')})
        bundled={r['file']:r['sha256'] for r in records}
        for r in manifest['inputFingerprint']['inputs']:assert bundled.get(r['file'])==r['sha256'],'missing corresponding source: '+r['file']
        for relative in sorted(required_test_fixtures):assert bundled.get(relative.as_posix())==sha(ROOT/relative),'missing immutable source-test fixture: '+relative.as_posix()
        for relative in sorted(required_remaining_sources):assert bundled.get(relative.as_posix())==sha(ROOT/relative),'missing remaining-family source dependency: '+relative.as_posix()
        archive.writestr('source-manifest.json',json.dumps({'upstreamCommit':manifest['upstreamCommit'],'engineOutputs':manifest['outputs'],'buildInputFingerprint':manifest['inputFingerprint']['sha256'],'files':records},ensure_ascii=False,indent=2))
    resolved_root=ROOT.resolve()
    assert DIST.resolve()==resolved_root/'dist' and DIST.resolve().parent==resolved_root,'local package target escaped own workspace'
    assert not DIST.is_symlink() and not DIST.is_junction(),'unexpected package link'
    if DIST.exists():shutil.rmtree(DIST)
    DIST.mkdir(exist_ok=True)
    for directory in ['web','locales','licenses']:shutil.copytree(ROOT/directory,DIST/directory,dirs_exist_ok=True)
    (DIST/'build').mkdir(exist_ok=True)
    for name in [*[r['name'] for r in manifest['outputs']],'manifest.json']:shutil.copyfile(ROOT/'build'/name,DIST/'build'/name)
    shutil.copyfile(source,DIST/'source.zip')
    (DIST/'index.html').write_text('<!doctype html><html lang="ja"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./web/"><title>Angband</title><a href="./web/">Angbandを開く</a></html>\n',encoding='utf-8')
    (DIST/'tests').mkdir(exist_ok=True)
    shutil.copyfile(ROOT/'tests/browser-smoke.mjs',DIST/'tests/browser-smoke.mjs')
    report={'localPackageAccepted':True,'externalDeploymentPerformed':False,'scope':'HTML served and verified with local Node','completeRequestedPort':False,'sourceFiles':len(records),'sourceTestFixtureFiles':len(required_test_fixtures),'remainingFamilySourceFiles':len(required_remaining_sources),'sourceZipBytes':source.stat().st_size,'sourceZipSha256':sha(source),'engine':manifest,'browserChecks':len(browser['checks']),'gameFlowChecks':len(flows['checks']),'wizardEndgameChecks':len(victory['checks']),'wasmDescriptorChecks':len(descriptors['checks'])}
    report['remainingBrowserChecks'] = {name: len(row['checks']) for name, row in remaining_browsers.items()}
    report['remainingMeasuredJobs'] = sorted(remaining_jobs)
    (ROOT/'build/package-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='engine'},ensure_ascii=False))
if __name__=='__main__':main()
