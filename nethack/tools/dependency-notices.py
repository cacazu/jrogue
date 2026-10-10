"""Record pinned, vendored Rust licenses for corresponding-source distribution."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import tomllib

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    lock = tomllib.loads((ROOT / "rust" / "Cargo.lock").read_text(encoding="utf-8"))
    packages = []
    for item in lock["package"]:
        if item["name"] == "nethack-layers":
            continue
        directory = ROOT / "rust" / "vendor" / (item["name"] + "-" + item["version"])
        manifest = tomllib.loads((directory / "Cargo.toml").read_text(encoding="utf-8"))["package"]
        if manifest["name"] != item["name"] or manifest["version"] != item["version"]:
            raise SystemExit("vendored dependency identity mismatch")
        license_files = sorted({p for pattern in ("LICENSE*", "COPYING*", "NOTICE*", "UNICODE*") for p in directory.glob(pattern) if p.is_file()})
        if not license_files:
            raise SystemExit(f"missing license text: {item['name']}")
        files = []
        for p in license_files:
            with p.open("rb") as stream:
                sha = hashlib.file_digest(stream, "sha256").hexdigest()
            files.append({"path": p.relative_to(ROOT).as_posix(), "sha256": sha})
        packages.append({"name": item["name"], "version": item["version"], "source": item["source"], "registry_checksum": item["checksum"], "license": manifest.get("license"), "source_path": directory.relative_to(ROOT).as_posix(), "license_files": files})
    output = {"result": "pass", "scope": "all locked Rust dependencies vendored offline with original license texts", "package_count": len(packages), "packages": packages}
    (ROOT / "build").mkdir(exist_ok=True)
    (ROOT / "build" / "rust-dependencies.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"result": "pass", "package_count": len(packages), "manifest": "build/rust-dependencies.json"}))


if __name__ == "__main__":
    main()
