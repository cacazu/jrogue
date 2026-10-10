"""Preserve an independently hashed engine and the exact inputs that built it."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

root = Path(__file__).resolve().parent.parent
label = sys.argv[1]
if not re.fullmatch(r"[a-z0-9-]+", label):
    raise SystemExit("invalid milestone label")
target = root / "tests" / (label + "-snapshot")
manifest_bytes = (root / "build/manifest.json").read_bytes()
manifest = json.loads(manifest_bytes)
copies = [("build/" + row["name"], row["sha256"])
          for row in manifest["outputs"]]
copies += [(row["file"], row["sha256"])
           for row in manifest["inputFingerprint"]["inputs"]]
for relative, expected in copies:
    source = (root / relative).resolve()
    if not source.is_relative_to(root):
        raise SystemExit("milestone input outside port")
    content = source.read_bytes()
    if hashlib.sha256(content).hexdigest() != expected:
        raise SystemExit("milestone source changed: " + relative)
    destination = target / "source" / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if destination.read_bytes() != content:
            raise SystemExit("refusing to overwrite milestone: " + relative)
    else:
        destination.write_bytes(content)
for relative in ["web/index.html", "web/app.js", "web/core.js", "web/worker.js",
                 "web/protocol.js", "web/storage.js", "web/semantic-view.js",
                 "tests/browser-smoke.mjs", "tests/source-integration-evidence/build.log",
                 "tests/source-integration-evidence/build-resources.json"]:
    source = root / relative
    if source.is_file():
        destination = target / "source" / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copyfile(source, destination)
destination = target / "manifest.json"
if destination.exists() and destination.read_bytes() != manifest_bytes:
    raise SystemExit("refusing to overwrite manifest")
destination.write_bytes(manifest_bytes)
print(json.dumps({"snapshot":str(target),"builtAt":manifest["builtAt"],
                  "verifiedInputsAndOutputs":len(copies),"sourceHash":manifest["inputFingerprint"]["sha256"]}))
