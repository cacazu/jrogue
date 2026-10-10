"""Generate reversible, exact-source ToME render scheduling seams; no execution."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
ARCHIVE = "game/modules/tome-1.7.6.team"
MEMBER = "mod/class/Game.lua"
EXPECTED_SHA256 = "dcd6dc85d9b2cf74741e82ac9156128b782193d23a459d53f7cda324b099092a"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    with zipfile.ZipFile(UPSTREAM / ARCHIVE) as archive:
        original = archive.read(MEMBER)
    assert digest(original) == EXPECTED_SHA256, "source mismatch; do not adapt unknown source"
    source = original.decode("utf-8")
    wasd = "\tif self.wasd_state and self.wasd_state.cnt > 0 then\n\t\tself.wasd_state.cd = self.wasd_state.cd - nb_keyframes\n\t\tif self.wasd_state.cd <= 0 then\t\t\t\n\t\t\tself.wasd_state.cd = self.wasd_state.base_cd\n\t\t\tself:onTickEnd(function() self:executeWASD() end)\n\t\tend\n\tend"
    replacements = [
        {
            "id": "game.displayMap.shake_x_visual_rng",
            "line": 1850,
            "before": "self.shake_x = self.shake_x + rng.range(-self.shake_force, self.shake_force)",
            "after": "self.shake_x = self.shake_x + ((__TOME_WEB_RENDER_BOUNDARY and __TOME_WEB_RENDER_BOUNDARY:enabled(self)) and __TOME_WEB_RENDER_BOUNDARY:visualRange(self, -self.shake_force, self.shake_force) or rng.range(-self.shake_force, self.shake_force))",
        },
        {
            "id": "game.displayMap.shake_y_visual_rng",
            "line": 1851,
            "before": "self.shake_y = self.shake_y + rng.range(-self.shake_force, self.shake_force)",
            "after": "self.shake_y = self.shake_y + ((__TOME_WEB_RENDER_BOUNDARY and __TOME_WEB_RENDER_BOUNDARY:enabled(self)) and __TOME_WEB_RENDER_BOUNDARY:visualRange(self, -self.shake_force, self.shake_force) or rng.range(-self.shake_force, self.shake_force))",
        },
        {
            "id": "game.displayMap.fov_application_preparation",
            "line": 1857,
            "before": "if changed then self:updateFOV() end",
            "after": "if changed then\n\t\t\tif __TOME_WEB_RENDER_BOUNDARY and __TOME_WEB_RENDER_BOUNDARY:enabled(self) then\n\t\t\t\t__TOME_WEB_RENDER_BOUNDARY:assertPrepared(self, map)\n\t\t\telse self:updateFOV() end\n\t\tend",
        },
        {
            "id": "game.display.wasd_application_input_repeat",
            "line": 1986,
            "before": wasd,
            "after": "\tif __TOME_WEB_RENDER_BOUNDARY and __TOME_WEB_RENDER_BOUNDARY:enabled(self) then\n\t\t__TOME_WEB_RENDER_BOUNDARY:assertPrepared(self, self.level and self.level.map)\n\telse\n" + wasd + "\n\tend",
        },
    ]
    result = source
    for replacement in replacements:
        assert source.count(replacement["before"]) == 1, replacement["id"]
        assert source[:source.index(replacement["before"])].count("\n") + 1 == replacement["line"], replacement["id"]
        result = result.replace(replacement["before"], replacement["after"], 1)
    reverted = result
    for replacement in reversed(replacements):
        assert reverted.count(replacement["after"]) == 1, replacement["id"]
        reverted = reverted.replace(replacement["after"], replacement["before"], 1)
    assert reverted.encode("utf-8") == original, "overlay reversibility failed"
    generated = ROOT / "generated"
    (generated / "mod/class").mkdir(parents=True, exist_ok=True)
    output = generated / MEMBER
    output.write_bytes(result.encode("utf-8"))
    # This is the verbatim original block, merely enclosed as a callable scheduling
    # function. It invokes the retained executeWASD method through onTickEnd.
    scheduler = ("-- SPDX-License-Identifier: GPL-3.0-or-later\n"
                 "-- Original mod/class/Game.lua:1986-1992 block, unchanged.\n"
                 "-- Invoke only for a recorded application input-repeat delta.\n"
                 "return function(self, nb_keyframes)\n" + wasd + "\nend\n").encode("utf-8")
    (generated / "original_wasd_schedule.lua").write_bytes(scheduler)
    manifest = {
        "source_ref": "tome-1.7.6", "archive": ARCHIVE, "member": MEMBER,
        "original_sha256": digest(original), "generated_sha256": digest(output.read_bytes()),
        "source_bytes": len(original), "generated_bytes": output.stat().st_size,
        "reverse_overlay_recovers_original_bytes": True,
        "original_wasd_block_bytes": len(wasd.encode("utf-8")),
        "original_wasd_block_sha256": digest(wasd.encode("utf-8")),
        "scheduler_sha256": digest(scheduler), "replacements": replacements,
        "original_gameplay_methods_changed": [],
        "mode": "explicit per-game enablement; original baseline remains when disabled",
        "verification": "source hashes/anchors/reversibility only; no Lua runtime/browser execution",
        "scope": "four identified sites; unclassified display hooks remain stateful",
    }
    (ROOT / "game-render-overlay-provenance.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"original_sha256": digest(original), "generated_sha256": manifest["generated_sha256"], "replacement_sites": len(replacements), "reversible": True, "runtime_tested": False}))


if __name__ == "__main__":
    main()
