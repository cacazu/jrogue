"""Prepare additive read-only HTTP/VFS inputs; execute no upstream/game/build code."""
import hashlib
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent
base = ROOT.parent / "bootstrap-work/browser-vfs-inputs.json"
data = json.loads(base.read_text(encoding="utf-8"))
for item in data["inputs"]:
    item["physical"] = str((base.parent / item["physical"]).resolve())
    if item["virtual"] == "/adapter/real-core-probe.lua":
        item["physical"] = str(ROOT / "generated/baseline-birth-driver.lua")
        item["bytes"] = (ROOT / "generated/baseline-birth-driver.lua").stat().st_size
        item["role"] = "Existing actual original birth driver plus additive comparison-only full-save API; no original rule change"
for path, virtual in [
    ("baseline_checkpoint.lua", "/adapter/baseline-checkpoint.lua"),
    ("resume_support.lua", "/adapter/resume-support.lua"),
    ("generated/original-resume-driver.lua", "/adapter/original-resume-driver.lua"),
]:
    if any(item["virtual"] == virtual for item in data["inputs"]):
        raise ValueError("duplicate save adapter VFS path " + virtual)
    data["inputs"].append({"physical":str(ROOT / path),"virtual":virtual,"type":"file",
        "bytes":(ROOT/path).stat().st_size,"role":"Source-only actual original full-save/resume platform adapter"})
data["writable_home"] = "Existing /persist is isolated runtime MEMFS; /checkpoint-store is the single durable IDBFS generation mount. Native original save paths stay in runtime home."
data["checkpoint_scope"] = "Comparison-only baseline original full-save/durable reload candidate; source-ready, no save/resume runtime validation yet"
(ROOT / "browser-vfs-inputs.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"inputs":len(data["inputs"]),"output":str(ROOT / "browser-vfs-inputs.json"),
    "base_sha256":hashlib.sha256(base.read_bytes()).hexdigest()}))
