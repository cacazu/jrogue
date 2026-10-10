"""Read only official cached port archives; never extract, import or build ports."""
from pathlib import Path
import hashlib
import json
import re
import tarfile
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SDK = Path(r"C:\Users\kit\emsdk\upstream\emscripten")
EVIDENCE = HERE / "METADATA-DELTA-index000-SCOPED.json"

def digest(data, algorithm="sha256"):
    return hashlib.new(algorithm, data).hexdigest()

def ordinary(path):
    for member in (path, *path.parents):
        info = member.lstat()
        if info.st_file_attributes & 0x400:
            raise RuntimeError("reparse member: " + str(member))
    return path.stat()

def pin(path):
    before = ordinary(path)
    data = path.read_bytes()
    after = ordinary(path)
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise RuntimeError("changed while reading: " + str(path))
    return {"path": str(path), "bytes": len(data), "sha256": digest(data),
            "mtimeNs": str(after.st_mtime_ns)}, data

raw = EVIDENCE.read_bytes()
delta = json.loads(raw)
rows = delta["phases"]["beforeFixedHelperImports"]["ports"]["changes"]
all_results = []
specs = [
    ("harfbuzz", "3.2.0", "harfbuzz.2.0.tar.xz", "COPYING"),
    ("libpng", "1.6.58", "libpng.6.58.tar.gz", "LICENSE"),
    ("zlib", "1.3.2", "zlib.3.2.tar.gz", "LICENSE"),
]
for name, version, archive_name, license_name in specs:
    definition = SDK / "tools" / "ports" / (name + ".py")
    definition_pin, source = pin(definition)
    text = source.decode("utf-8")
    declared_version = re.search(r"^VERSION\s*=\s*['\"]([^'\"]+)['\"]", text, re.M).group(1)
    declared_hash = re.search(r"^HASH\s*=\s*['\"]([^'\"]+)['\"]", text, re.M).group(1)
    if declared_version != version:
        raise RuntimeError("unexpected SDK version for " + name)
    archive = ROOT / "engine-build" / "ports" / archive_name
    archive_pin, archive_bytes = pin(archive)
    actual_sha512 = digest(archive_bytes, "sha512")
    if actual_sha512 != declared_hash:
        raise RuntimeError("archive disagrees with official SDK SHA-512: " + name)
    root_name = name + "-" + version
    expected = {r["member"][len(name) + 1:]: r for r in rows
                if r["member"].startswith(name + "/") and r["afterBytes"] is not None}
    compared = []
    with tarfile.open(archive, "r:*") as tar:
        archive_files = {m.name.removeprefix("./"): m for m in tar.getmembers() if m.isfile()}
        for relative, row in sorted(expected.items()):
            path = Path(row["path"])
            file_pin, content = pin(path)
            if file_pin["bytes"] != row["afterBytes"]["bytes"] or file_pin["sha256"] != row["afterBytes"]["sha256"]:
                raise RuntimeError("added file changed after scoped audit: " + str(path))
            counterpart = archive_files.get(relative)
            if counterpart is None:
                raise RuntimeError("file absent from verified archive: " + relative)
            stream = tar.extractfile(counterpart)
            archive_content = stream.read()
            archive_sha = digest(archive_content)
            if archive_sha == file_pin["sha256"]:
                producer = "byte-exact official archive member"
                producer_pin = {"member": relative, "bytes": len(archive_content), "sha256": archive_sha}
            elif name == "zlib" and relative == root_name + "/zconf.h":
                template_pin, template = pin(SDK / "tools" / "ports" / "zlib" / "zconf.h")
                if template != content:
                    raise RuntimeError("zconf.h is neither archive member nor exact SDK override")
                producer = "byte-exact official SDK zlib.py documented zconf.h override"
                producer_pin = template_pin
            else:
                raise RuntimeError("file differs from verified archive: " + relative)
            compared.append({"file": file_pin, "producer": producer, "producerPin": producer_pin})
    license_path = ROOT / "engine-build" / "ports" / name / root_name / license_name
    license_pin, license_bytes = pin(license_path)
    all_results.append({"name": name, "version": version,
                        "definition": definition_pin,
                        "officialFetchLines": [line.strip() for line in text.splitlines() if "fetch_project" in line],
                        "archive": {**archive_pin, "sha512": actual_sha512,
                                    "matchesOfficialSDKHash": True},
                        "license": {**license_pin, "text": license_bytes.decode("utf-8")},
                        "comparedFileCount": len(compared),
                        "comparedFileBytes": sum(r["file"]["bytes"] for r in compared),
                        "files": compared})

result = {"status": "scoped-added-ports-official-archive-and-sdk-override-verified",
          "utc": datetime.now(timezone.utc).isoformat(),
          "sourceAudit": {"path": str(EVIDENCE), "bytes": len(raw), "sha256": digest(raw)},
          "scope": "require_escalated; source-only read; no compiler, port import, archive extraction or network",
          "ports": all_results,
          "writer": "Unidentified; archive/source equality establishes content provenance, not writer identity.",
          "publication": "No port sources/test assets are added to any web payload by this audit."}
output = HERE / "SCOPED-PORTS-PROVENANCE.json"
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": result["status"], "output": str(output),
                  "ports": [{k: p[k] for k in ("name", "version", "comparedFileCount", "comparedFileBytes", "archive")}
                            for p in all_results]}, indent=2))
