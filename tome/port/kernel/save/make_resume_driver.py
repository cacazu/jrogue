"""Generate a separate original-load driver; do not edit the existing birth driver.

Only exact adapter anchors are changed. Original Module owns world/loadGame,
the two return values, delayed callbacks, close/prerun/run and module/addon setup.
This generator executes no Lua, engine, browser, compiler or tests.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
source = ROOT.parent / "bootstrap-work/real-core-probe.lua"
raw = source.read_bytes()
text = raw.decode("utf-8")
newline = "\r\n" if "\r\n" in text else "\n"
normalized = text.replace("\r\n", "\n")

def replace_once(old, new):
    global normalized
    if normalized.count(old) != 1:
        raise ValueError("driver anchor absent or ambiguous: " + old[:80])
    normalized = normalized.replace(old, new, 1)

replace_once('local name = settings.player_name or ("web_probe_"..tostring(seed))\n'
             'assert(type(name) == "string" and #name <= 25 and name:match("^[a-zA-Z0-9_-]+$"), "Use a safe, fresh proof character name")',
    'local resume = assert(rawget(_G, "__TOME_WEB_RESUME"), "save.resume.request_missing")\n'
    'local name = resume.save_name\n'
    'assert(type(name) == "string" and #name >= 1 and #name <= 128 and not name:find("[%z\\1-\\31]"), "save.resume.invalid_save_name")\n'
    'local resume_control = assert(loadfile("/adapter/resume-support.lua"))().acquire(resume)')
replace_once('\tlocal result = original_require(module_name)\n',
    '\tlocal result = original_require(module_name)\n'
    '\tif module_name == "engine.Savefile" then resume_control:observeSavefile(result) end\n')
replace_once('\t\t\tif dialog.actor_base and dialog.descriptors_by_type and dialog.makeDefault and not bridge.birth_automated then\n'
    '\t\t\t\tbridge.birth_automated = true\n'
    '\t\t\t\tbridge.stage = "original-birther-input"\n'
    '\t\t\t\tdialog:makeDefault()\n'
    '\t\t\tend\n',
    '\t\t\tif dialog.actor_base and dialog.descriptors_by_type and dialog.makeDefault then\n'
    '\t\t\t\terror("save.resume.unexpected_birth")\n'
    '\t\t\tend\n')
birth_start = normalized.index('function bridge.birth_done()\n')
birth_end = normalized.index('\nend\n', birth_start) + len('\nend\n')
birth = normalized[birth_start:birth_end]
replace_once(birth, 'function bridge.birth_done() error("save.resume.unexpected_birth") end\n')
old_loader = 'local extra = \'no_birth_popup=true;set_addons={};birth_done_script="__TOME_WEB.birth_done()"\'\n' \
             'assert(loadfile("/loader/init.lua"))("te4", "1.7.6", "tome", name, true, extra, "default")\n' \
             'bridge.stage = bridge.ready and "original-game-running" or "original-game-awaiting-birth"\n' \
             'native_print("TOME_REAL_BOOT_JSON="..bridge.snapshot_json())\nreturn bridge'
new_loader = 'local extra = resume.extra_module_info or "no_birth_popup=true"\n' \
             'assert(type(extra) == "string" and #extra <= 65536, "save.resume.invalid_original_extras")\n' \
             'assert(loadfile("/loader/init.lua"))("te4", "1.7.6", "tome", name, false, extra, resume.profile_name or "default")\n' \
             'bridge.stage = "original-load-returned"\n' \
             'resume_control:install(bridge, encode_json)\n' \
             'assert(loadfile("/adapter/baseline-checkpoint.lua"))().install(bridge, encode_json, {engine="te4",version="1.7.6",module="tome",profile_name=resume.profile_name or "default",extra_module_info=extra})\n' \
             'native_print("TOME_REAL_RESUME_LOADED_JSON="..bridge.snapshot_json())\nreturn bridge'
replace_once(old_loader, new_loader)

destination = ROOT / "generated"
destination.mkdir(exist_ok=True)
emitted = normalized.replace("\n", newline).encode("utf-8")
(destination / "original-resume-driver.lua").write_bytes(emitted)
birth_text = raw.decode("utf-8")
birth_anchor = "return bridge"
if not birth_text.endswith(birth_anchor + newline):
    raise ValueError("final birth-driver return anchor changed")
addition = 'assert(loadfile("/adapter/baseline-checkpoint.lua"))().install(bridge, encode_json, {engine="te4",version="1.7.6",module="tome",profile_name="default",extra_module_info=extra})' + newline
birth_emitted = birth_text[:-len(birth_anchor + newline)] + addition + birth_anchor + newline
(destination / "baseline-birth-driver.lua").write_bytes(birth_emitted.encode("utf-8"))
report = {
    "source_driver": str(source),
    "source_driver_sha256": hashlib.sha256(raw).hexdigest(),
    "generated_sha256": hashlib.sha256(emitted).hexdigest(),
    "baseline_birth_driver_sha256": hashlib.sha256(birth_emitted.encode("utf-8")).hexdigest(),
    "mode": "baseline_original_resume",
    "original_loader_new_game": False,
    "original_module_load_sequence_reimplemented": False,
    "changes": ["validated separate resume request", "fresh VM/native gate", "observe original world/game/delayed loads", "reject unexpected birth", "original loader false", "post-load settling/restore API", "add baseline checkpoint API"],
    "validation": "source generation only; no compile, Lua, browser or runtime tests run",
}
(ROOT / "resume-driver-provenance.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report))
