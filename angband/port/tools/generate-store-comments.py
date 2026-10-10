"""Capture an original ONE_OF result once by its selected table pointer."""
import ast
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
directory = root / "migration/store-comment-data"
directory.mkdir(exist_ok=True)
source_path = root / "logic/store.c"
baseline_path = directory / "source-baseline.c"
marker = re.compile(r"/\* AB_STORE_TEXT_BEGIN \*/.*?/\* AB_STORE_TEXT_END \*/", re.S)
source = source_path.read_bytes().decode("utf-8")
baseline = marker.sub("", source)
translations = json.loads((root / "migration/store-comment-input.json").read_text(encoding="utf-8"))
entries = []
tables = {}
for table, japanese in translations.items():
    match = re.search(r"static const char \*comment_" + table + r"\[\] =\s*\{(.*?)\};", baseline, re.S)
    if not match:
        raise ValueError("missing canonical source table " + table)
    words = list(re.finditer(r'"(?:\\.|[^"\\])*"', match[1]))
    if len(words) != len(japanese):
        raise ValueError("source/translation cardinality " + table)
    ids = []
    for ordinal, (word, ja) in enumerate(zip(words, japanese)):
        en = ast.literal_eval(word[0])
        slug = re.sub(r"[^a-z0-9]+", "_", en.lower()).strip("_")
        identity = "game.store.comment." + table + "." + slug
        if identity in ids or len(identity) > 127:
            raise ValueError("ambiguous source comment identity")
        ids.append(identity)
        entries.append({"id": identity, "english": en, "japanese": ja, "parameters": [],
            "role": "selected_store_comment", "source": {"file": "src/store.c",
                "line": baseline[:match.start(1) + word.start()].count("\n") + 1,
                "table": "comment_" + table, "ordinal": ordinal},
            "selection": "original ONE_OF executes once; selected native pointer only"})
    tables[table] = ids

def block(value):
    return "/* AB_STORE_TEXT_BEGIN */" + value + "/* AB_STORE_TEXT_END */"

helper = ['\n#ifdef __EMSCRIPTEN__\n#include "web-static-text.h"\n']
for table, ids in tables.items():
    helper.append("static const char *const ab_comment_" + table + "[] = {" + ",".join(json.dumps(i) for i in ids) + "};\n")
helper += ["static const char *ab_store_comment(const char *const *table,const char *const *ids,size_t count,int sound,const char *selected) {\n",
    " for(size_t i=0;i<count;i++) if(table[i]==selected) {ab_static_message(ids[i],sound);return selected;}\n",
    " return selected;\n}\n",
    "#define AB_STORE_COMMENT(table,sound,selected) ab_store_comment(table,ab_##table,N_ELEMENTS(table),sound,selected)\n",
    "#else\n#define AB_STORE_COMMENT(table,sound,selected) (selected)\n#endif\n"]
position = baseline.index("static void purchase_analyze(")
updated = baseline[:position] + block("".join(helper)) + baseline[position:]
for table, sound in [("worthless", "MSG_STORE1"), ("bad", "MSG_STORE2"), ("good", "MSG_STORE3"), ("great", "MSG_STORE4"), ("accept", "MSG_STORE5")]:
    original = "ONE_OF(comment_" + table + ")"
    if updated.count(original) != 1:
        raise ValueError("original ONE_OF cardinality " + table)
    updated = updated.replace(original, block("AB_STORE_COMMENT(comment_" + table + "," + sound + ",") + original + block(")"))
if marker.sub("", updated) != baseline:
    raise ValueError("original native byte reconstruction failed")
if baseline_path.exists() and baseline_path.read_bytes() != baseline.encode("utf-8"):
    raise ValueError("immutable store baseline changed")
baseline_path.write_bytes(baseline.encode("utf-8"))
source_path.write_bytes(updated.encode("utf-8"))
manifest = {"schema_version": 1, "upstream_commit": "f3082213b73f3e463e3d0d60bff4b00462beae6e",
    "source_connected": True, "runtime_accepted": False, "callsites": 5, "entries": entries,
    "baseline_sha256": hashlib.sha256(baseline.encode("utf-8")).hexdigest(),
    "modified_sha256": hashlib.sha256(updated.encode("utf-8")).hexdigest(),
    "native_byte_reconstruction_exact": True}
(directory / "source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"comments": len(entries), "callsites": 5, "original_native_bytes_preserved": True}))
