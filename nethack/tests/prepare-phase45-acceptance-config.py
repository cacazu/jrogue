#!/usr/bin/env python3
"""Pin a complete isolated runtime after Root's build gate; load no game/runtime."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def inside(root, path):
    assert path.is_relative_to(root), f"Path escaped intended subtree: {path}"
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-root", default="build/phase4/web")
    parser.add_argument("--catalog-path", default="gameplay-core.json")
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--report-directory", default="build/phase4/acceptance")
    parser.add_argument("--native-source-root", default="work/phase4/NetHack-5.0.0")
    parser.add_argument("--output", default="build/phase4/acceptance-config.json")
    opts = parser.parse_args()
    build = (ROOT / "build").resolve(strict=True)
    web = inside(build, (ROOT / opts.web_root).resolve(strict=True))
    assert web != (ROOT / "web").resolve(strict=True), "Frozen historical runtime must not be used"
    report = inside(build, (ROOT / opts.report_directory).resolve())
    assert report != build
    target = inside(build, (ROOT / opts.output).resolve())
    native_source = inside(ROOT, (ROOT / opts.native_source_root).resolve(strict=True))
    assert 0 <= opts.port <= 65535
    names = ["engine/nethack.js", "engine/nethack.wasm", "app.mjs", "shim-host.mjs", "dom-ui.mjs", "save-store.mjs", "browser-ui.json", opts.catalog_path, "index.html", "style.css"]
    assert len(names) == len(set(names))
    runtime = {name:digest(inside(web,(web/name).resolve(strict=True))) for name in names}
    metadata = []
    for name in ["locales/gameplay-core.metadata.json", "work/phase4/semantic-generated/phase4-inputs/metadata.json", "work/phase4/semantic-generated/phase4-inputs/diagnostic-wrappers/metadata.json"]:
        path = inside(ROOT,(ROOT/name).resolve(strict=True))
        metadata.append({"path":name,"sha256":digest(path)})
    config = {"schema_version":1,"stage":"phase4-5-isolated-candidate","runtime_status":"installed-frozen-candidate",
        "web_root":web.relative_to(ROOT).as_posix(),"native_source_root":native_source.relative_to(ROOT).as_posix(),
        "catalog_path":opts.catalog_path,"port":opts.port,"report_directory":report.relative_to(ROOT).as_posix(),
        "expected_runtime_sha256":runtime,"metadata_paths":metadata,
        "producer_audit":{"path":"work/phase4/semantic-generated/audit.json","sha256":digest(ROOT/"work/phase4/semantic-generated/audit.json")},
        "execution_note":"Hashing/config preparation loads no engine and grants no runtime slot. Parent must explicitly gate each measured serial Node/Chrome run with fresh physical/commit headroom. Historical edec runtime/reports remain untouched."}
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(config,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"config":target.relative_to(ROOT).as_posix(),"sha256":digest(target),"runtime_files":len(runtime),
        "wasm_sha256":runtime["engine/nethack.wasm"],"catalog_sha256":runtime[opts.catalog_path],
        "browser_server_wasm_compiler_invoked":False}))


if __name__ == "__main__":
    main()
