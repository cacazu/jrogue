"""Generate exact-source native map FOV guard/read-only callback seams."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UPSTREAM = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    original = (UPSTREAM / "src/map.c").read_bytes()
    recorded = json.loads((ROOT / "source-provenance.json").read_text(encoding="utf-8"))
    expected = next(record["sha256"] for record in recorded["files"] if record["source"] == "src/map.c")
    assert sha(original) == expected, "native map source mismatch"
    source = original.decode("utf-8")
    block = '\t\tlua_getglobal(L, "game");\n\t\tlua_pushliteral(L, "updateFOV");\n\t\tlua_gettable(L, -2);\n\t\tif (lua_isfunction(L, -1)) {\n\t\t\tlua_pushvalue(L, -2);\n\t\t\tlua_call(L, 1, 0);\n\t\t\tlua_pop(L, 1);\n\t\t}\n\t\telse lua_pop(L, 2);'
    replacements = [
        {"id": "native.map.prepare_header", "before": '#include "map.h"', "after": '#include "map.h"\n#include "tome_map_prepare.h"'},
        {"id": "native.map.tail_fov_guard", "line": 1924, "before": block,
         "after": '\t\tif (!tome_map_fov_prepared_guard(L)) {\n' + block + '\n\t\t}'},
        {"id": "native.map.callback_readonly_getters", "before": '\t{"zCallback", map_set_z_callback},',
         "after": '\t{"zCallback", map_set_z_callback},\n\t{"webCallbackInventory", tome_map_callback_summary_lua},\n\t{"webCallbackRef", tome_map_callback_ref_lua},'},
    ]
    result = source
    for change in replacements:
        assert source.count(change["before"]) == 1, change["id"]
        if "line" in change: assert source[:source.index(change["before"])].count("\n") + 1 == change["line"]
        result = result.replace(change["before"], change["after"], 1)
    suffix = '\n/* Browser source-only prepared-map boundary; original source above retained. */\n#include "tome_map_prepare.inc"\n'
    result += suffix
    reversed_source = result[:-len(suffix)]
    for change in reversed(replacements):
        assert reversed_source.count(change["after"]) == 1
        reversed_source = reversed_source.replace(change["after"], change["before"], 1)
    assert reversed_source.encode("utf-8") == original
    output = ROOT / "generated/src/map_prepared.c"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(result.encode("utf-8"))
    provenance = {"source_ref": "tome-1.7.6", "source": "src/map.c",
                  "original_sha256": sha(original), "generated_sha256": sha(output.read_bytes()),
                  "original_bytes": len(original), "generated_bytes": output.stat().st_size,
                  "reverse_overlay_recovers_original_bytes": True,
                  "replacements": replacements, "append_suffix": suffix,
                  "helper_sha256": sha((ROOT / "tome_map_prepare.inc").read_bytes()),
                  "header_sha256": sha((ROOT / "tome_map_prepare.h").read_bytes()),
                  "runtime_tested": False, "compile_tested": False,
                  "scope": "native tail FOV guard + read-only callback diagnostics; not full purity"}
    (ROOT / "native-map-overlay-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "original_sha256": sha(original),
                      "generated_sha256": provenance["generated_sha256"], "reversible": True, "runtime_tested": False}))


if __name__ == "__main__":
    main()
