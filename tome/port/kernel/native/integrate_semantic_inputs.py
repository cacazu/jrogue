"""Add explicit immutable localization sources to the owned browser VFS manifest."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
manifest_file=ROOT/"bootstrap-work/browser-vfs-inputs.json"
manifest=json.loads(manifest_file.read_text(encoding="utf-8"))
files={
    "/adapter/localization/native_semantic_bootstrap.lua":ROOT/"localization-wasm-work/lua/native_semantic_bootstrap.lua",
    "/adapter/localization/native_semantic_options.lua":ROOT/"localization-wasm-work/lua/native_semantic_options.lua",
    "/adapter/localization/native_semantic_diagnostics.lua":ROOT/"localization-wasm-work/lua/native_semantic_diagnostics.lua",
    "/adapter/localization/semantic_i18n.lua":ROOT/"localization-kernel-work/lua/semantic_i18n.lua",
    "/adapter/localization/native_i18n_install.lua":ROOT/"localization-native-plan-work/native_i18n_install.lua",
    "/original/game/build-overlay/data/timed_effects/other.lua":ROOT/"localization-review-work/dream-stage/overlay/game/modules/tome/data/timed_effects/other.lua",
}
for virtual,physical in files.items():
    if not physical.is_file():raise SystemExit("Required reviewed source absent: "+str(physical))
    entry={"physical":str(physical),"virtual":virtual,"type":"file",
        "role":"Reviewed optional semantic presentation adapter; original rules and official catalogs retained separately",
        "bytes":physical.stat().st_size}
    existing=next((i for i in manifest["inputs"] if i["virtual"]==virtual),None)
    if existing is None:manifest["inputs"].append(entry)
    else:existing.update(entry)
for item in manifest["inputs"]:
    if item["virtual"]=="/adapter/real-core-probe.lua":item["bytes"]=Path(item["physical"]).stat().st_size
manifest_file.write_text(json.dumps(manifest,ensure_ascii=True,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"inputs":len(manifest["inputs"]),"optional_semantic_sources":len(files),"original_source_modified":False}))
