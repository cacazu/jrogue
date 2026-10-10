"""Read-only SDK/provenance checks and small supplemental pins; never compile."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PLAN_SHA = "f5e5f97a1cd2c8540f73675cc3d0bf8fc4cc462d48fa5f55a1b983c2ae1f3f0e"


def digest(path):
    state = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            state.update(block)
    return state.hexdigest()


def pin(path):
    return {"path": str(path.resolve()), "bytes": path.stat().st_size, "sha256": digest(path)}


def main():
    plan_path = HERE / "compile-plan.json"
    if digest(plan_path) != PLAN_SHA:
        raise RuntimeError("accepted compile plan changed")
    plan = json.loads(plan_path.read_bytes())
    sdk = Path(plan["installedTools"][0]["path"]).parents[2]
    emscripten = sdk / "upstream/emscripten"
    records = [pin(emscripten / name) for name in
               ["emcc.py", "tools/cache.py", "tools/config.py", "tools/ports/__init__.py"]]
    records.append(pin(sdk / "node/24.19.0_64bit/node.exe"))
    provenance = json.loads(Path(plan["frozenSDK"]["provenance"]["path"]).read_bytes())
    ports = Path(plan["frozenSDK"]["ports"])
    port_details = []
    for item in provenance:
        recipe = pin(Path(item["recipePath"]))
        if recipe["sha256"] != item["recipeSha256"]:
            raise RuntimeError("official port recipe changed: " + item["name"])
        archive = pin(ports / item["archiveName"])
        if archive["bytes"] != item["bytes"] or archive["sha256"] != item["sha256"]:
            raise RuntimeError("previously verified official archive changed: " + item["name"])
        marker = pin(ports / item["name"] / ".emscripten_url")
        if Path(marker["path"]).read_text(encoding="utf-8").strip() != item["acquisitionUrl"]:
            raise RuntimeError("official port acquisition marker changed: " + item["name"])
        records.extend([recipe, archive, marker])
        port_details.append({"name": item["name"], "acquisitionUrl": item["acquisitionUrl"],
                             "markerPath": marker["path"], "archivePath": archive["path"]})
    result = {"schemaVersion": 1, "acceptedCompilePlanSha256": PLAN_SHA,
              "purpose": "Additional read-only SDK freeze implementation, official recipes/archives/URL markers and configured Node pins; no replacement of accepted plan",
              "pins": records, "portDetails": port_details,
              "coverageLimit": "These explicit byte pins are not a complete SDK Python import graph or every transitive system header. Runtime also compares cache/ports metadata; only pinned contents receive SHA-256 proof.",
              "compilerExecuted": False, "browserExecuted": False}
    (HERE / "runner-pins.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"pins": len(records), "officialPorts": len(port_details),
                      "runnerPinsSha256": digest(HERE / "runner-pins.json"), "compilerExecuted": False}))


if __name__ == "__main__":
    main()
