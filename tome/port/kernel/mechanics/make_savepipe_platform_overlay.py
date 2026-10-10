"""Generate the retained-source browser SavefilePipe forceWait pump seam."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
ARCHIVE = "game/engines/te4-1.7.6.teae"
MEMBER = "engine/SavefilePipe.lua"
EXPECTED = "f1fe572b414dc9626c33fd71a7891d8cfaed2741a1cea405cc30e12dc0376e70"


def main():
    with zipfile.ZipFile(UPSTREAM / ARCHIVE) as archive:
        original = archive.read(MEMBER)
    assert hashlib.sha256(original).hexdigest() == EXPECTED, "unexpected original SavefilePipe"
    source = original.decode("utf-8")
    old = "\twhile coroutine.status(self.co) ~= \"dead\" do\n\t\tcnt = cnt + 1\n\t\tif cnt == 1000 then core.display.forceRedraw() if game:getPlayer() then game:getPlayer().changed = true end cnt = 0 end\n\t\tcoroutine.resume(self.co)\n\tend"
    new = """\twhile coroutine.status(self.co) ~= "dead" do
\t\tcnt = cnt + 1
\t\t-- Browser platform service progresses the retained native ZIP queue here.
\t\t-- forceWait blocks the host event loop, so an external poll cannot do this.
\t\tif not core.serial.browserWorkerReady or not core.serial.browserPump or not core.serial.browserError then
\t\t\terror(_t"Browser save service is unavailable.")
\t\tend
\t\tif not core.serial.browserWorkerReady() then
\t\t\terror(core.serial.browserError() or _t"Browser save service is not ready.")
\t\tend
\t\tlocal pump = core.serial.browserPump(1, 65536)
\t\tif pump == -1 then error(core.serial.browserError() or _t"Browser save operation failed.") end
\t\tif pump ~= 0 and pump ~= 1 then error(_t"Browser save service returned an invalid status.") end
\t\tif cnt == 1000 then core.display.forceRedraw() if game:getPlayer() then game:getPlayer().changed = true end cnt = 0 end
\t\tlocal ok, err = coroutine.resume(self.co)
\t\tif not ok then error(err) end
\tend"""
    assert source.count(old) == 1, "original forceWait loop mismatch"
    assert source[:source.index(old)].count("\n") + 1 == 258, "original line mismatch"
    result = source.replace(old, new, 1)
    assert result.replace(new, old, 1).encode("utf-8") == original, "not reversible"
    target = ROOT / "generated" / MEMBER
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(result.encode("utf-8"))
    manifest = {"source_ref": "tome-1.7.6", "archive": ARCHIVE, "member": MEMBER,
                "original_sha256": EXPECTED, "generated_sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "original_line": 258, "original_bytes": len(original), "generated_bytes": target.stat().st_size,
                "reverse_overlay_recovers_original_bytes": True,
                "native_service": "serial-platform-work/serial_browser.c actual browserPump(1,65536)",
                "sole_completion_consumer": "original SavefilePipe:doThread -> core.serial.popSaveReturn",
                "original_before": old, "platform_after": new,
                "runtime_tested": False, "wall_time_guarantee": False,
                "scope": "browser-only platform overlay; original upstream unchanged"}
    (ROOT / "savepipe-platform-overlay-provenance.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    en = {"platform.save.worker_unavailable": "Browser save service is unavailable.",
          "platform.save.worker_not_ready": "Browser save service is not ready.",
          "platform.save.operation_failed": "Browser save operation failed.",
          "platform.save.invalid_status": "Browser save service returned an invalid status."}
    ja = {"platform.save.worker_unavailable": "ブラウザーの保存機能を利用できません。",
          "platform.save.worker_not_ready": "ブラウザーの保存機能の準備ができていません。",
          "platform.save.operation_failed": "ブラウザーでの保存に失敗しました。",
          "platform.save.invalid_status": "ブラウザーの保存機能から不正な状態が返されました。"}
    for locale, catalog in [("en", en), ("ja", ja)]:
        (ROOT / f"{locale}.save-platform.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sites = [{"id": key, "en": value, "source": MEMBER, "output": "error(_t literal) -> original Lua error dialog",
              "placeholders": [], "binding": "original _t literal; root semantic catalog must register source-to-ID mapping"}
             for key, value in en.items()]
    (ROOT / "save-platform-text-manifest.json").write_text(json.dumps(sites, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"generated": str(target), "original_sha256": EXPECTED,
                      "generated_sha256": manifest["generated_sha256"], "reversible": True, "runtime_tested": False}))


if __name__ == "__main__":
    main()
