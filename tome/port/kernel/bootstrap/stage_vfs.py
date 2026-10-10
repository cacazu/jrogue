"""Record exact original physical -> browser VFS inputs; stage one Lua overlay.

Does not copy the large original asset trees, change pristine source, run game
code, or package/publish assets. The parent owns actual staging/file_packager.
"""
from pathlib import Path
import hashlib
import json
import re

WORK = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream")
RAW = UPSTREAM / "t-engine4-src-1.7.6" / "game"
UNPACKED = UPSTREAM / "unpacked" / "game"

inputs = [
    (UPSTREAM / "t-engine4-src-1.7.6/bootstrap", "/original/bootstrap", "required original earliest bootstrap executed by the parent's native initializer"),
    (RAW / "loader", "/original/game/loader", "required original first-stage Lua loader"),
    (RAW / "thirdparty", "/original/game/thirdparty", "required original Lua thirdparty/config/library tree; desktop CEF/JIT can be excluded after import audit"),
    (RAW / "addons", "/original/game/addons", "required genuine shipped addon directory: original bootstrap boot.lua:41 requires getRealPath('/addons/'); addon activation remains controlled by original set_addons"),
    (RAW / "profile-thread", "/original/game/profile-thread", "required original native profile worker scripts, retained offline"),
    (UNPACKED / "engines/default", "/unpacked/game/engines/default", "required original Lua engine including actual fonts, packages, engine UI images, sounds and shaders"),
    (UNPACKED / "modules/tome", "/unpacked/game/modules/tome", "required complete original ToME Lua/data module, with staged AsciiMap build overlay"),
    (UNPACKED / "modules/boot", "/unpacked/game/modules/boot", "original boot/menu module for full original boot and module enumeration"),
    (RAW / "modules/tome-1.7.6.team", "/original/game/modules/tome-1.7.6.team", "required genuine code archive for unchanged Module:listModules discovery: directory unpacking has mod/init.lua, while original directory discovery requires init.lua"),
    (RAW / "modules/tome-1.7.6-gfx.team", "/original/game/modules/tome-1.7.6-gfx.team", "required original ToME graphical assets, real font package and UI definitions; keep archive"),
    (RAW / "modules/tome-1.7.6-music.team", "/original/game/modules/tome-1.7.6-music.team", "original optional music assets; retain for full audio scope, may omit only for disclosed muted boot milestone"),
    (WORK / "build-overlay/modules/tome", "/original/game/build-overlay", "isolated exact AsciiMap unused-ffi build overlay, mounted after unchanged archived module setup so only this audited Lua leaf takes precedence"),
    (WORK.parent / "mechanics-audit-work/generated/engine/SavefilePipe.lua", "/original/game/engine-overlay/engine/SavefilePipe.lua", "exact retained SavefilePipe platform-pump leaf: mount before first engine.SavefilePipe require; original serial callbacks and completion remain authoritative"),
    (WORK / "real-core-probe.lua", "/adapter/real-core-probe.lua", "source-faithful boot/input characterization driver"),
]
original = UNPACKED / "modules/tome/mod/class/AsciiMap.lua"
source = original.read_bytes()
lines = source.splitlines(keepends=True)
matches = [(i, line) for i, line in enumerate(lines, 1) if re.search(rb"\bffi\b", line)]
if len(matches) != 1 or not re.fullmatch(rb"\s*local\s+ffi\s*=\s*require\s*[\"']ffi[\"']\s*(?:\r?\n)?", matches[0][1]):
    raise ValueError("Expected exactly the audited unused local ffi import; refuse a broad source replacement")
line_number = matches[0][0]
# Keep all source bytes other than the audited unused import line. Lua line
# numbers remain unchanged by substituting an equally terminated comment line.
ending = b"\r\n" if matches[0][1].endswith(b"\r\n") else b"\n" if matches[0][1].endswith(b"\n") else b""
lines[line_number - 1] = b"-- Browser build: remove the source-audited unused LuaJIT ffi import." + ending
patched = b"".join(lines)
overlay = WORK / "build-overlay/modules/tome/mod/class/AsciiMap.lua"
overlay.parent.mkdir(parents=True, exist_ok=True)
overlay.write_bytes(patched)

records = []
for physical, virtual, role in inputs:
    if not physical.exists():
        raise FileNotFoundError(physical)
    records.append({
        "physical": str(physical), "virtual": virtual,
        "type": "directory" if physical.is_dir() else "file", "role": role,
        "bytes": physical.stat().st_size if physical.is_file() else None,
    })

manifest = {
    "version": 1,
    "upstream_commit": "624a67329fe2ad440c5b344785a9c73fcf22ae63",
    "source_archive_sha256": "989dea00803f8cdcade024f4647d480bb1ac0d437c254292c07549c272a4680c",
    "inputs": records,
    "physfs_mounts_before_lua_loader": [
        {"real": "/original/bootstrap", "mountpoint": "/bootstrap", "append": True},
        {"real": "/adapter", "mountpoint": "/adapter", "append": True},
        {"real": "/original/game/thirdparty", "mountpoint": "/", "append": True},
        {"real": "/original/game", "mountpoint": "/", "append": True},
        {"real": "/unpacked/game", "mountpoint": "/", "append": False},
    ],
    "original_runtime_mounts": [
        "loader/init.lua mounts selected /unpacked/game/engines/default at /",
        "engine/Module.lua discovers and mounts genuine /original/game/modules/tome-1.7.6.team at /",
        "original module teams loader discovers and mounts /original/game/modules/tome-1.7.6-gfx.team at /",
        "original module teams loader optionally mounts tome-1.7.6-music.team at /",
        "adapter mounts /original/game/build-overlay at / only after original tome mod.load('setup'), preserving the audited AsciiMap leaf overlay over archive source",
        "adapter mounts /original/game/engine-overlay at / before first engine.SavefilePipe require, preserving original save completion while pumping actual native worker queue",
    ],
    "writable_home": "Create browser MEMFS/IDBFS home under /persist; configure actual native fs user/home paths before original engine initialization; do not use the user's native saves.",
    "build_overlay": {
        "original": str(original), "staged": str(overlay),
        "replace_in_build_copy": "modules/tome/mod/class/AsciiMap.lua",
        "virtual": "/unpacked/game/modules/tome/mod/class/AsciiMap.lua",
        "line": line_number, "reason": "Only ffi occurrence is an unused local require. Actual core/default Lua needs no FFI in this source file.",
        "original_sha256": hashlib.sha256(source).hexdigest(),
        "overlay_sha256": hashlib.sha256(patched).hexdigest(),
        "instruction": "Overlay this file in an isolated full module build copy before packaging. Do not modify upstream/unpacked. Do not rely on duplicate --preload-file virtual paths having a defined overwrite order.",
    },
    "engine_platform_overlay": {
        "original": str(UNPACKED / "engines/default/engine/SavefilePipe.lua"),
        "staged": str(WORK.parent / "mechanics-audit-work/generated/engine/SavefilePipe.lua"),
        "virtual": "/original/game/engine-overlay/engine/SavefilePipe.lua",
        "mount_root": "/original/game/engine-overlay",
        "original_sha256": "f1fe572b414dc9626c33fd71a7891d8cfaed2741a1cea405cc30e12dc0376e70",
        "overlay_sha256": "3fb1cb1682b70e2549c1f32b3b82c0d2bb9505e53447062476b27b1bd06671a2",
        "instruction": "Mount only this emitted engine leaf before the first original require; do not expose the sibling opt-in Game overlay. Actual browserPump and original completion/callback behavior are required.",
    },
    "publication": "Local HTML + Node verification only. No external deployment or source upload is authorized. Asset existence is not license permission.",
    "memory": "The retained gfx and music ZIPs alone total 450441318 bytes. Include the compressed archive data plus Lua/native heap/textures in browser memory assessment; no mobile or full-game boot claim follows from this manifest.",
}
(WORK / "browser-vfs-inputs.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(WORK / "browser-preload-arguments.txt").write_text("\n".join(f"--preload-file {r['physical']}@{r['virtual']}" for r in records) + "\n", encoding="utf-8")
print(json.dumps({"inputs": len(records), "ffi_line": line_number,
                  "original_sha256": manifest['build_overlay']['original_sha256'],
                  "overlay_sha256": manifest['build_overlay']['overlay_sha256'],
                  "manifest": str(WORK / 'browser-vfs-inputs.json')}))
