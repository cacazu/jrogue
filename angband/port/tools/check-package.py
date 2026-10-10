"""Lightweight static/source package verification; no build or browser."""
from pathlib import Path
import hashlib
import json
from importlib.util import module_from_spec, spec_from_file_location
import zipfile

ROOT = Path(__file__).resolve().parent.parent

def digest(data):
    return hashlib.sha256(data).hexdigest()

def source_package_guard():
    # Load only the trusted local guard definitions; its main() is never called.
    spec = spec_from_file_location('_angband_source_package_guard', ROOT / 'tools/package-site.py')
    assert spec and spec.loader, 'source package guard unavailable'
    guard = module_from_spec(spec)
    spec.loader.exec_module(guard)
    return guard

def main():
    package = json.loads((ROOT / "build/package-manifest.json").read_text(encoding="utf-8"))
    archive_path = ROOT / "source.zip"
    guard = source_package_guard()
    engine = json.loads((ROOT / 'build/manifest.json').read_text(encoding='utf-8'))
    assert package['engine'] == engine, 'package engine differs from current build'
    remaining_browsers, remaining_jobs = guard.remaining_acceptance_evidence(engine)
    assert package.get('remainingBrowserChecks') == {name: len(row['checks']) for name, row in remaining_browsers.items()}, 'remaining browser acceptance count mismatch'
    assert package.get('remainingMeasuredJobs') == sorted(remaining_jobs), 'remaining measured jobs missing'
    required_test_fixtures, required_remaining_sources = guard.source_test_fixture_paths(), guard.remaining_family_source_paths()
    assert package["sourceTestFixtureFiles"] == len(required_test_fixtures), "source-test fixture count mismatch"
    assert package["remainingFamilySourceFiles"] == len(required_remaining_sources), "remaining-family source count mismatch"
    assert digest(archive_path.read_bytes()) == package["sourceZipSha256"]
    assert digest((ROOT / "dist/source.zip").read_bytes()) == package["sourceZipSha256"]
    with zipfile.ZipFile(archive_path) as archive:
        assert archive.testzip() is None
        manifest = json.loads(archive.read("source-manifest.json"))
        for record in manifest["files"]:
            assert digest(archive.read(record["file"])) == record["sha256"], record["file"]
        assert "README.md" in archive.namelist()
        names = set(archive.namelist())
        for relative in sorted(required_test_fixtures | required_remaining_sources):
            name = relative.as_posix()
            assert name in names, 'required source dependency omitted: ' + name
            assert digest(archive.read(name)) == digest((ROOT / relative).read_bytes()), 'required source dependency changed: ' + name
        runtime_files = [name for name in archive.namelist() if name.startswith("licenses/emscripten-runtime/")]
        assert len(runtime_files) == 15, runtime_files
        assert "licenses/rust-runtime/compiler-builtins-LICENSE.txt" in archive.namelist()
        assert "licenses/rust-runtime/libm-LICENSE.txt" in archive.namelist()
        assert "web/protocol.js" in archive.namelist()
        assert "logic/web-checkpoint.c" in archive.namelist()
    for output in package["engine"]["outputs"]:
        assert digest((ROOT / "dist/build" / output["name"]).read_bytes()) == output["sha256"]
    assert (ROOT / "dist/index.html").is_file()
    assert (ROOT / "dist/web/index.html").is_file()
    result = {"passed": True, "zipCrcVerified": True, "allSourceHashesVerified": True,
              "matchingEngineOutputsVerified": True, "sdkRuntimeNoticeFiles": len(runtime_files),
              "sourceZipSha256": package["sourceZipSha256"], "sourceZipBytes": archive_path.stat().st_size,
              "sourceTestFixtureFiles": len(required_test_fixtures),
              "remainingFamilySourceFiles": len(required_remaining_sources),
              "remainingBrowserChecks": {name: len(row['checks']) for name, row in remaining_browsers.items()},
              "remainingMeasuredJobs": sorted(remaining_jobs),
              "deployed": False}
    (ROOT / "tests/package-verification.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))

if __name__ == "__main__":
    main()
