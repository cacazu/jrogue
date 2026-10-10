"""Read bounded original save/render sources; retain unchanged Lua evidence."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parent
SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
SELECTED = {
    "game/engines/te4-1.7.6.teae": ["engine/Savefile.lua", "engine/SavefilePipe.lua", "engine/Game.lua", "engine/Module.lua", "engine/class.lua", "engine/Entity.lua", "engine/interface/ActorTemporaryEffects.lua", "engine/GameEnergyBased.lua", "engine/GameTurnBased.lua", "engine/Map.lua", "engine/Particles.lua", "engine/interface/GameSound.lua", "engine/Level.lua", "engine/Zone.lua", "engine/interface/ActorFOV.lua"],
    "game/modules/tome-1.7.6.team": ["mod/class/Game.lua", "mod/class/World.lua", "mod/class/Actor.lua", "mod/class/Player.lua"],
}


def main():
    records = []
    for archive_path, names in SELECTED.items():
        with zipfile.ZipFile(SOURCE / archive_path) as archive:
            for name in names:
                data = archive.read(name)
                output = ROOT / "source" / name
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(data)
                records.append({"archive": archive_path, "source": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "unchanged": True})
                if "Savefile" in name or name == "mod/class/Game.lua":
                    functions = [{"line": index, "definition": line.strip()} for index, line in enumerate(data.decode("utf-8").splitlines(), 1) if re.search(r"function _M:(?:save|load|tick|display|waiting|process|close|open|newGame|setCurrent|changeLevel|level)", line)]
                    print(json.dumps({"source": name, "functions": functions}))
    for name in ["src/main.c", "src/core_lua.c", "src/serial.c", "src/particles.c", "src/particles.h", "src/map.c", "src/map.h", "src/wait.c", "src/wfc/lua_wfc.cpp", "src/wfc/wfc.hpp", "src/libtcod_import/noise_c.c"]:
        data = (SOURCE / name).read_bytes()
        records.append({"source": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "evidence": "pristine file read; not copied"})
    sdk_file = Path(r"C:\Users\kit\emsdk\upstream\emscripten\src\lib\libidbfs.js")
    data = sdk_file.read_bytes()
    records.append({"source": str(sdk_file), "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "evidence": "SDK 6.0.8 IDBFS transaction source read; not copied"})
    (ROOT / "source-provenance.json").write_text(json.dumps({"source_ref": "tome-1.7.6", "files": records}, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
