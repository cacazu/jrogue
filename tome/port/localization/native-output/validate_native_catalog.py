"""Independent low-memory checks of selected native catalog/evidence outputs."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parent
SOURCE = Path(r"C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6")
FIELDS = re.compile(r"\{([a-z_][a-z0-9_]*)\}")


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result: raise ValueError("duplicate JSON key: " + key)
        result[key] = value
    return result


def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"), object_pairs_hook=unique_pairs)


def main():
    en, ja = read("en.native.json"), read("ja.native.json")
    manifest = read("native-callsite-manifest.json")
    assert set(en) == set(ja) == {message["id"] for message in manifest["messages"]}
    assert len(manifest["messages"]) == len(en)
    source_hashes = read("source-hashes.json")
    for relative, expected in source_hashes.items():
        assert hashlib.sha256((SOURCE / relative).read_bytes()).hexdigest() == expected
    c_cache = {}
    count, dynamic_examples = 0, []
    for message in manifest["messages"]:
        identity, names = message["id"], message["parameter_names"]
        assert re.fullmatch(r"native\.error\.[a-z0-9_.]+", identity)
        assert sorted(FIELDS.findall(en[identity])) == sorted(FIELDS.findall(ja[identity])) == sorted(names)
        assert re.search(r"[\u3040-\u30ff\u3400-\u9fff]", ja[identity])
        assert message["sites"]
        values = {name: 42 if name in ("font_size", "source_line", "size", "alignment", "argument_index", "stack_level") else "q" if name == "option" else name + ":外部名{保護}%s/値" for name in names}
        rendered_en, rendered_ja = en[identity].format_map(values), ja[identity].format_map(values)
        for value in values.values():
            assert str(value) in rendered_en and str(value) in rendered_ja
        if names:
            dynamic_examples.append({"id": identity, "parameters": values, "en": rendered_en, "ja": rendered_ja})
        for site in message["sites"]:
            relative = site["source"]
            if relative not in c_cache:
                raw = (SOURCE / relative).read_bytes()
                try: c_cache[relative] = raw.decode("utf-8")
                except UnicodeDecodeError: c_cache[relative] = raw.decode("latin-1")
            text = c_cache[relative]
            assert site["source_expression"] in text
            offset = text.find(site["source_expression"], sum(len(line) for line in text.splitlines(keepends=True)[:site["line"]-1]))
            assert offset >= 0 and text.count("\n", 0, offset) + 1 == site["line"]
            assert [parameter["name"] for parameter in site["parameters"]] == names
            assert site["function"] not in ("if", "while", "for", "switch", "<translation-unit>")
            assert site["output_api"] in site["source_expression"]
            assert site["lua_ui_route"]["display"]
            count += 1
    route_hashes = {}
    with zipfile.ZipFile(SOURCE / "game/engines/te4-1.7.6.teae") as archive:
        for path in (ROOT / "source-routes").rglob("*.lua"):
            name = path.relative_to(ROOT / "source-routes").as_posix()
            assert path.read_bytes() == archive.read(name)
            route_hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    console = read("console-output-manifest.json")
    assert not console["translated_into_ui_catalog"]
    assert all(row["api"] in ("printf", "fprintf", "puts", "new_lua_error") for row in console["records"])
    report = {"status": "pass", "semantic_ids": len(en), "source_call_sites_verified": count, "source_hashes_verified": len(source_hashes), "unchanged_lua_consumer_copies": len(route_hashes), "named_placeholder_and_argument_binding_checks": "pass", "verbatim_external_parameter_examples": len(dynamic_examples), "console_candidates_separate": len(console["records"]), "runtime_browser_CJK_checks": "not performed"}
    (ROOT / "independent-validation-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (ROOT / "source-route-hashes.json").write_text(json.dumps(route_hashes, indent=2) + "\n", encoding="utf-8")
    (ROOT / "parameter-fixtures.json").write_text(json.dumps(dynamic_examples, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
