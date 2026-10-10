"""Copy selected verified upstream sources for a read-only bootstrap audit."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

HERE = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
FILES = {
    "engine": ("game/engines/te4-1.7.6.teae", [
        "engine/init.lua", "config.lua", "engine/Module.lua", "engine/Birther.lua",
        "engine/Game.lua", "engine/GameTurnBased.lua", "engine/GameEnergyBased.lua",
        "engine/Map.lua", "engine/Entity.lua", "engine/Tiles.lua", "engine/FontPackage.lua",
        "engine/I18N.lua", "engine/PlayerProfile.lua", "engine/SavefilePipe.lua",
        "engine/ui/Classic.lua", "engine/ui/Dialog.lua", "engine/ui/Base.lua",
        "engine/Zone.lua", "engine/Level.lua", "engine/interface/ActorLife.lua",
        "engine/interface/ActorTalents.lua", "engine/interface/ActorTemporaryEffects.lua",
    ]),
    "tome": ("game/modules/tome-1.7.6.team", [
        "mod/init.lua", "mod/load.lua", "mod/class/Game.lua", "mod/class/Player.lua",
        "mod/class/Actor.lua", "mod/class/World.lua", "mod/dialogs/Birther.lua",
        "mod/class/interface/PlayerExplore.lua", "mod/class/AsciiMap.lua",
        "data/birth/descriptors.lua", "data/birth/classes/warrior.lua",
        "data/birth/races/human.lua", "data/birth/worlds.lua",
    ]),
}
manifest = []
for kind, (archive, members) in FILES.items():
    with zipfile.ZipFile(UPSTREAM / archive) as z:
        for member in members:
            if member not in z.namelist():
                print("ABSENT", kind, member)
                continue
            data = z.read(member)
            target = HERE / "source" / kind / member
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            manifest.append({"archive": archive, "member": member,
                "copy": str(target.relative_to(HERE)), "sha256": hashlib.sha256(data).hexdigest(),
                "lines": len(data.decode("utf-8").splitlines())})
        if kind == "tome":
            print("BIRTH_FILES", [n for n in z.namelist() if n.startswith("data/birth/") and n.endswith(".lua")])
for original in (UPSTREAM / "game/loader").rglob("*.lua"):
    rel = original.relative_to(UPSTREAM)
    data = original.read_bytes()
    target = HERE / "source" / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    manifest.append({"original": str(rel), "copy": str(target.relative_to(HERE)),
        "sha256": hashlib.sha256(data).hexdigest(), "lines": len(data.decode("utf-8").splitlines())})
print("BOOT_FILES", [str(n.relative_to(UPSTREAM)) for n in UPSTREAM.rglob("boot.lua")])
(HERE / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print("COPIED", len(manifest))
