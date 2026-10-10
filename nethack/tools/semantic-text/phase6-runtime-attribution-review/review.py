"""Inspect pinned Rust runtime attribution without executing toolchains or binaries.

Writes evidence only below this script's directory. Optional public HTTPS reads
are limited to immutable official Rust source files plus a referenced credits
file; downloaded bytes are never executed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import tomllib
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TOOLCHAIN = Path(r"C:\Users\kit\.rustup\toolchains\1.98.1-x86_64-pc-windows-gnu")
SOURCE = TOOLCHAIN / "lib/rustlib/src/rust"
COMMIT = "48a229ceaefd4985c50990b14116b6d856af0985"
RAW = f"https://raw.githubusercontent.com/rust-lang/rust/{COMMIT}/"
SELECTED = ROOT / "build/phase6-rust/target/wasm32-unknown-emscripten/release/libnethack_layers.a"
INSTALLED = TOOLCHAIN / "lib/rustlib/wasm32-unknown-emscripten/lib/libcompiler_builtins-299604ffea0f91fe.rlib"
FILES = [
    "library/compiler-builtins/compiler-builtins/Cargo.toml",
    "library/compiler-builtins/LICENSE.txt",
    "library/compiler-builtins/libm/LICENSE.txt",
    "library/compiler-builtins/compiler-builtins/src/math/mod.rs",
    "library/compiler-builtins/compiler-builtins/build.rs",
    "library/compiler-builtins/josh-sync.toml",
]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def record(path: Path) -> dict:
    data = path.read_bytes()
    return {"path": str(path), "bytes": len(data), "sha256": sha(data)}


def ar_members(path: Path) -> dict[str, bytes]:
    data = path.read_bytes()
    assert data[:8] == b"!<arch>\n", "Unexpected archive magic"
    offset = 8
    strings = b""
    members: dict[str, bytes] = {}
    while offset < len(data):
        header = data[offset:offset + 60]
        assert len(header) == 60 and header[58:] == b"`\n", "Invalid ar header"
        size = int(header[48:58].strip())
        raw_name = header[:16].decode("ascii").strip()
        payload = data[offset + 60:offset + 60 + size]
        assert len(payload) == size
        offset += 60 + size + (size % 2)
        if raw_name == "//":
            strings = payload
            continue
        if raw_name in {"/", "/SYM64/"}:
            continue
        if raw_name.startswith("#1/"):
            name_size = int(raw_name[3:])
            name = payload[:name_size].rstrip(b"\0").decode("utf-8")
            payload = payload[name_size:]
        elif re.fullmatch(r"/\d+", raw_name):
            name_start = int(raw_name[1:])
            name_end = strings.find(b"/\n", name_start)
            assert name_end >= 0
            name = strings[name_start:name_end].decode("utf-8")
        else:
            name = raw_name.rstrip("/")
        assert name not in members, "Duplicate archive member"
        members[name] = payload
    assert offset == len(data)
    return members


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "NetHack-Rust-attribution-read-only/1"})
    with urllib.request.urlopen(req, timeout=25) as response:
        assert response.status == 200
        data = response.read(512_001)
    assert len(data) <= 512_000, "Unexpected evidence size"
    return data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--online", action="store_true")
    parser.add_argument("--output", default="review.json")
    args = parser.parse_args()
    output = (HERE / args.output).resolve()
    assert output.parent == HERE and not output.exists(), "Fresh in-directory output required"
    provenance_path = ROOT / "licenses/RUNTIME-PROVENANCE.json"
    provenance = json.loads(provenance_path.read_text(encoding="utf-8-sig"))
    assert provenance["rust_version"] == "1.98.1" and provenance["rust_commit"] == COMMIT
    channel_path = TOOLCHAIN / "lib/rustlib/multirust-channel-manifest.toml"
    channel = tomllib.loads(channel_path.read_text(encoding="utf-8"))
    source_pkg = channel["pkg"]["rust-src"]
    std_pkg = channel["pkg"]["rust-std"]
    assert source_pkg["version"].startswith("1.98.1 (48a229cea ")
    assert std_pkg["version"].startswith("1.98.1 (48a229cea ")
    manifest_path = TOOLCHAIN / "lib/rustlib/manifest-rust-src"
    installed_manifest = set(manifest_path.read_text(encoding="utf-8").splitlines())
    for leaf in FILES:
        assert f"file:lib/rustlib/src/rust/{leaf}" in installed_manifest
    crate = tomllib.loads((SOURCE / FILES[0]).read_text(encoding="utf-8"))["package"]
    assert crate["name"] == "compiler_builtins" and crate["version"] == "0.1.160"
    assert crate["license"] == "MIT AND Apache-2.0 WITH LLVM-exception AND (MIT OR Apache-2.0)"
    selected = ar_members(SELECTED)
    installed = ar_members(INSTALLED)
    selected_builtins = {name: data for name, data in selected.items() if name.startswith("compiler_builtins-")}
    installed_builtins = {name: data for name, data in installed.items() if name.startswith("compiler_builtins-")}
    assert len(selected_builtins) == 269
    assert selected_builtins.keys() == installed_builtins.keys()
    member_records = []
    for name, data in selected_builtins.items():
        assert data == installed_builtins[name], name
        member_records.append({"name": name, "bytes": len(data), "sha256": sha(data), "selected_equals_installed": True})
    evidence = []
    for leaf in FILES:
        local = record(SOURCE / leaf)
        row = {"rust_source_path": leaf, "local": local, "official_url": RAW + leaf, "official_bytes_verified": False}
        if args.online:
            remote = fetch(RAW + leaf)
            assert remote == (SOURCE / leaf).read_bytes(), f"Installed and official bytes differ: {leaf}"
            row.update({"official_bytes_verified": True, "official_bytes": len(remote), "official_sha256": sha(remote)})
        evidence.append(row)
    credits = {
        "url_referenced_by_component_license": "https://github.com/llvm/llvm-project/blob/main/compiler-rt/CREDITS.TXT",
        "qualification": "Component license names this referenced author file; it is checked independently of the Emscripten runtime mapping.",
        "existing_bundle": record(ROOT / "licenses/runtime/LLVM-compiler-rt-CREDITS.txt"),
        "remote_verified": False,
    }
    if args.online:
        # Pin the mutable referenced URL to the actual official LLVM Git commit.
        commit_response = json.loads(fetch("https://api.github.com/repos/llvm/llvm-project/git/ref/heads/main"))
        llvm_commit = commit_response["object"]["sha"]
        assert re.fullmatch(r"[0-9a-f]{40}", llvm_commit)
        credits_url = f"https://raw.githubusercontent.com/llvm/llvm-project/{llvm_commit}/compiler-rt/CREDITS.TXT"
        remote = fetch(credits_url)
        credits.update({"remote_verified": True, "snapshot_commit": llvm_commit, "snapshot_url": credits_url,
                        "snapshot_bytes": len(remote), "snapshot_sha256": sha(remote),
                        "existing_bundle_equals_snapshot": remote == (ROOT / "licenses/runtime/LLVM-compiler-rt-CREDITS.txt").read_bytes()})
    # Inventory original comment blocks; preserve the entire original byte block,
    # including any notice's adjoining explanatory text. This is intentionally
    # broader than a final-link retention claim.
    notice_blocks = {}
    for prefix in ["library/compiler-builtins/compiler-builtins/src", "library/compiler-builtins/libm/src"]:
        for path in sorted((SOURCE / prefix).rglob("*.rs")):
            data = path.read_bytes()
            for match in re.finditer(rb"/\*.*?\*/|(?m:^\s*//[^\r\n]*(?:\r?\n\s*//[^\r\n]*)*)", data, re.S):
                block = match.group(0)
                if not re.search(rb"copyright|permission is hereby|SPDX-License|licensed under|license\s+grant", block, re.I):
                    continue
                digest = sha(block)
                item = notice_blocks.setdefault(digest, {"sha256": digest, "bytes": len(block), "occurrences": []})
                item["occurrences"].append({"rust_source_path": path.relative_to(SOURCE).as_posix(),
                                            "source_sha256": sha(data), "start_byte": match.start(), "end_byte": match.end()})
    report = {
        "schema_version": 1, "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "status": "passed", "scope": "Exact selected-input Rust runtime provenance and original notice mapping; no legal interpretation.",
        "rust": {"version": "1.98.1", "source_commit": COMMIT, "channel_date": channel["date"],
                 "source_package": source_pkg["target"]["*"],
                 "target_std_package": std_pkg["target"]["wasm32-unknown-emscripten"],
                 "channel_manifest": record(channel_path), "source_install_manifest": record(manifest_path)},
        "component": {"name": crate["name"], "version": crate["version"], "repository": crate["repository"],
                      "declared_license_expression": crate["license"], "authors": crate["authors"],
                      "source_revision": COMMIT, "standalone_upstream_revision": None,
                      "revision_qualification": "The immutable official Rust tree supplies the component's exact in-tree revision; no standalone compiler-builtins repository commit is inferred."},
        "selected_staticlib": record(SELECTED), "installed_target_rlib": record(INSTALLED),
        "archive_member_binding": {"matched_members": len(member_records), "failed_members": 0,
                                   "all_selected_compiler_builtins_members_equal_installed": True, "members": member_records},
        "source_evidence": evidence, "referenced_llvm_credits": credits,
        "original_embedded_notice_inventory": {"unique_blocks": len(notice_blocks),
            "occurrences": sum(len(item["occurrences"]) for item in notice_blocks.values()),
            "blocks": list(notice_blocks.values()),
            "qualification": "Byte-range inventory of installed pinned compiler-builtins and libm source comments. It records candidate original notices, not which functions survived the final link or a coverage/rights conclusion."},
        "recommended_original_notice_sources": [
            {"source_path": str(SOURCE / leaf), "official_url": RAW + leaf,
             "bytes": (SOURCE / leaf).stat().st_size, "sha256": sha((SOURCE / leaf).read_bytes()),
             "reason": reason}
            for leaf, reason in [(FILES[1], "Component-specific full license and third-party attribution text"),
                                 (FILES[2], "Original license/copyright text explicitly referenced for bundled libm math")]
        ],
        "limitations": [
            "Matching archive input members does not establish which members or routines survived the final linked WASM.",
            "No official distribution archive was downloaded or independently validated; installed package metadata and exact pinned source-file matches provide the recorded binding.",
            "Source comments may have specific notices; the finite original-byte inventory is not a final-link coverage conclusion.",
            "No compiler, linker, Node, browser, installer, unknown executable, credential or security setting was run or changed.",
            "Existing license bundles, locked build inputs, target workspace and source/runtime artifacts were unchanged.",
        ],
        "execution": {"compiler_or_node_or_browser": False, "installed_source_read_only": True,
                      "public_official_https_reads": args.online, "license_folder_modified": False},
    }
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(output), "sha256": sha(output.read_bytes()), "matched_archive_members": len(member_records),
                      "official_source_files_verified": sum(x["official_bytes_verified"] for x in evidence),
                      "original_notice_blocks": len(notice_blocks), "credits": credits}, ensure_ascii=False))


if __name__ == "__main__":
    main()
