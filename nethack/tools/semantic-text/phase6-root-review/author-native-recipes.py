"""Source-only Japanese composition overlay; added 2026-10-02, NGPL.

No native state, data, rendering, browser or compiled source is changed.
"""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "tools/semantic-text/phase6-integration/native-recipes.json"
OUTPUT = ROOT / "locales/phase6/native-recipes.root-reviewed.json"
REVIEW = ROOT / "build/phase6/native-recipes.root-review.json"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    original = json.loads(SOURCE.read_text("utf-8"))
    ja = {
        "nethack.native.config.plain": "{label}{message}{punct}",
        "nethack.native.config.framed": "{label} {line}{message}{punct}",
        "nethack.native.config.line": "{number:%d}行目: ",
        "nethack.native.config.label.empty": "",
        "nethack.native.config.label.early": "config_error_add: ",
        "nethack.native.config.label.secure": "エラー:",
        "nethack.native.config.label.marker": " *",
        "nethack.native.config.punct.none": "",
        "nethack.native.config.punct.period": "。",
        "nethack.native.chronicle.line": "{turn:%5ld}: {message}",
    }
    assert set(ja) == set(original["en"]) == set(original["argument_schemas"])
    for text_id, template in ja.items():
        placeholders = re.findall(r"\{([a-z_0-9]+)(?::[^{}]+)?\}", template)
        assert set(placeholders) == set(original["argument_schemas"][text_id])
        assert len(placeholders) == len(original["argument_schemas"][text_id])
        english_specs = re.findall(r"\{([a-z_0-9]+):([^{}]+)\}", original["en"][text_id])
        assert english_specs == re.findall(r"\{([a-z_0-9]+):([^{}]+)\}", template)
    overlay = {"en": original["en"], "ja": ja, "argument_schemas": original["argument_schemas"]}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(overlay, ensure_ascii=False, indent=2) + "\n", "utf-8")
    REVIEW.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "schema_version": 1,
        "status": "source-reviewed-not-runtime-approved",
        "source_recipe_sha256": sha(SOURCE),
        "overlay_sha256": sha(OUTPUT),
        "entries": len(ja),
        "runtime_binding_approved": False,
        "original_source_sha256": {
            name: sha(ROOT / "upstream/NetHack-5.0.0" / name)
            for name in ("src/cfgfiles.c", "src/insight.c")
        },
        "review": [
            "Preserves all original line/turn numeric printf types and widths and every composition argument.",
            "Keeps technical function identifier, native diagnostic markers, empty branches and accepted chronicle ordering.",
            "Only source-selected public labels and final punctuation change language; message ownership/filtering remains original C.",
            "A missing or unsupported nested producer requires whole original English; no English recognition or native repaint query is introduced.",
            "No restored chronicle semantic provenance or full Japanese coverage is established by this overlay.",
        ],
    }
    REVIEW.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps({"entries": len(ja), "overlay_sha256": report["overlay_sha256"], "runtime": False}))


if __name__ == "__main__":
    main()
