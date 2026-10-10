"""Compose the explicit diagnostic UI leaves without changing the default driver."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
bootstrap=ROOT/"bootstrap-work"
source=bootstrap/"real-core-probe.lua"
raw=source.read_text(encoding="utf-8")
anchor="\tlocal result = original_require(module_name)\n"
mount='''\tif (module_name == "engine.ui.Dialog" or module_name == "engine.Game") and not bridge.ui_overlay_mounted then
\t\tassert(not package.loaded["engine.ui.Dialog"], "UI metadata overlay must precede the first original Dialog require")
\t\tassert(fs.mount(settings.root_game.."/ui-engine-overlay", "/", false), "Actual Dialog metadata leaf mount failed")
\t\tbridge.ui_overlay_mounted = true
\tend
'''
assert raw.count(anchor)==1
raw=raw.replace(anchor,mount+anchor)
anchor='\tif module_name == "engine.Game" and not installed then\n'
assert raw.count(anchor)==1
raw=raw.replace(anchor,anchor+'\t\tassert(loadfile("/adapter/install_at_original_game_require.lua"))()(result, original_require)\n')
generated=bootstrap/"generated"
generated.mkdir(exist_ok=True)
driver=generated/"ui-roundtrip-driver.lua"
driver.write_text(raw,encoding="utf-8",newline="\n")
manifest=json.loads((bootstrap/"browser-vfs-inputs.json").read_text(encoding="utf-8"))
for item in manifest["inputs"]:
    item["physical"]=str((bootstrap/item["physical"]).resolve())
    if item["virtual"]=="/adapter/real-core-probe.lua":
        item["physical"]=str(driver);item["bytes"]=driver.stat().st_size
        item["role"]="Original birth driver with explicit original Dialog metadata integration diagnostic"
ui=ROOT/"mechanics-audit-work/ui-roundtrip"
for file,virtual in [
    (ui/"generated/engine/ui/Dialog.lua","/original/game/ui-engine-overlay/engine/ui/Dialog.lua"),
    (ui/"install_at_original_game_require.lua","/adapter/install_at_original_game_require.lua"),
    (ui/"original-yesno-roundtrip.lua","/adapter/original-yesno-roundtrip.lua"),
    (ui/"generated/ui-roundtrip-catalog.lua","/adapter/ui-roundtrip-catalog.lua"),
    (ROOT/"rust-kernel-adapter-work/lua/original-dialog-view.lua","/adapter/original-dialog-view.lua"),
]:
    assert file.is_file(),file
    assert not any(item["virtual"]==virtual for item in manifest["inputs"]),virtual
    manifest["inputs"].append({"physical":str(file),"virtual":virtual,"type":"file","bytes":file.stat().st_size,
        "role":"Explicit real original yesnoPopup metadata and typed UI diagnostic; original factory rules preserved"})
(bootstrap/"ui-browser-vfs-inputs.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"inputs":len(manifest["inputs"]),"driver_sha256":hashlib.sha256(driver.read_bytes()).hexdigest(),"default_driver_modified":False}))
