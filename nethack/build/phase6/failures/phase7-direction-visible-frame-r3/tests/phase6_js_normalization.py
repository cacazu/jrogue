"""Read-only certificate for the frozen Phase6 collector's two CRLF hash difference."""
import hashlib
import json
import re
from pathlib import Path


def verify_js_normalization(root, proof_name, engine, engine_ref, generator_ref, runtime, web):
    root = root.resolve()
    def digest(data):
        return hashlib.sha256(data).hexdigest()
    def scoped(name):
        path = (root / name).resolve(strict=True)
        assert path.is_relative_to(root)
        return path
    def bound(ref):
        data = scoped(ref["path"]).read_bytes()
        assert digest(data) == ref["sha256"], f"Normalization dependency changed: {ref['path']}"
        assert len(data) == ref["bytes"]
        return data
    def command_hash(argv):
        return digest(json.dumps(argv, ensure_ascii=False, separators=(",", ":")).encode("utf8"))
    proof_path = scoped(proof_name)
    data = proof_path.read_bytes()
    proof = json.loads(data)
    assert proof["schema_version"] == 1 and proof["status"] == "passed"
    assert proof["kind"] == "raw-JS-to-recorded-universal-newline-text"
    assert proof["compiler_executed"] is proof["runtime_executed"] is False
    for name in ["installed_identical_to_raw", "loader_unchanged", "manifest_preserved", "runtime_preserved"]:
        assert proof[name] is True
    assert proof["postprocessing_performed"] is False
    assert proof["candidate_manifest"]["path"] == engine_ref["path"]
    assert proof["candidate_manifest"]["sha256"] == engine_ref["sha256"]
    assert json.loads(bound(proof["candidate_manifest"])) == engine
    assert proof["generator_manifest"]["path"] == generator_ref["path"]
    assert proof["generator_manifest"]["sha256"] == generator_ref["sha256"]
    bound(proof["generator_manifest"])
    stage = scoped(engine_ref["path"]).parent
    assert scoped(proof["compile_embed_evidence"]["path"]) == stage / "compile-embed-evidence.json"
    evidence = json.loads(bound(proof["compile_embed_evidence"]))
    assert evidence["embedded_data"] == engine["embedded_data"]
    assert evidence["compile_evidence"] == engine["compile_evidence"]
    assert proof["certificate_source"]["path"] == "tools/semantic-text/phase6-js-certificate/certify.py"
    assert proof["provenance_source"]["path"] == "tools/semantic-text/phase6-integration/provenance.py"
    bound(proof["certificate_source"])
    bound(proof["provenance_source"])
    assert scoped(proof["raw_js"]["path"]) == stage / "nethack.js"
    assert scoped(proof["installed_js"]["path"]) == web / "engine/nethack.js"
    raw = bound(proof["raw_js"])
    assert raw == bound(proof["installed_js"])
    raw_text = raw.decode("utf8")
    assert raw_text.encode("utf8") == raw
    assert digest(raw) == runtime["engine/nethack.js"] == engine["artifacts"]["nethack.js"]["sha256"]
    assert len(raw) == engine["artifacts"]["nethack.js"]["bytes"] == 102556
    offsets = [index for index in range(len(raw)-1) if raw[index:index+2] == b"\r\n"]
    normalization = proof["normalization"]
    assert offsets == normalization["crlf_offsets"] == [102502, 102554]
    assert raw.count(b"\r") == normalization["crlf_count"] == 2
    assert normalization["bare_cr_count"] == 0 and normalization["only_crlf_to_lf"] is True
    assert normalization["operation"] == "UTF-8 Path.read_text universal newline conversion"
    normalized = raw.replace(b"\r\n", b"\n")
    assert len(normalized) == normalization["normalized_bytes"] == 102554
    assert digest(normalized) == normalization["normalized_sha256"] == normalization["recorded_sha256"] == engine["embedded_data"]["emitted_js"]["sha256"]
    restored = normalized
    for index, offset in reversed(list(enumerate(offsets))):
        normalized_offset = offset-index
        assert restored[normalized_offset] == 10
        restored = restored[:normalized_offset] + b"\r" + restored[normalized_offset:]
    assert restored == raw
    pattern = r"var __emscripten_fs_load_embedded_files=ptr=>\{do\{.*?\}while\(HEAPU32\[ptr>>2\]\)\};"
    loader = re.findall(pattern, raw_text, re.S)
    normalized_loader = re.findall(pattern, normalized.decode("utf8"), re.S)
    assert len(loader) == len(normalized_loader) == 1 and loader == normalized_loader
    for required in ["var name_addr=HEAPU32[ptr>>2]", "var len=HEAPU32[ptr>>2]", "var content=HEAPU32[ptr>>2]", "HEAP8.subarray(content,content+len)"]:
        assert required in loader[0]
    raw_embedded = proof["raw_embedded_data"]
    assert raw_embedded["emitted_js"]["sha256"] == digest(raw)
    assert digest(loader[0].encode("utf8")) == raw_embedded["emitted_js"]["loader_sha256"] == engine["embedded_data"]["emitted_js"]["loader_sha256"]
    assert raw_embedded["datafile_entry"] == engine["embedded_data"]["datafile_entry"]
    assert raw_embedded["emitted_wasm"] == engine["embedded_data"]["emitted_wasm"]
    assert raw_embedded["runtime_fs_verified"] is False
    assert scoped(proof["wasm"]["path"]) == stage / "nethack.wasm"
    wasm = bound(proof["wasm"])
    assert wasm == (web / "engine/nethack.wasm").read_bytes()
    assert digest(wasm) == runtime["engine/nethack.wasm"] == engine["artifacts"]["nethack.wasm"]["sha256"]
    assert len(wasm) == engine["artifacts"]["nethack.wasm"]["bytes"]
    units = engine["compile_evidence"]["units"]
    assert proof["compile_membership"] == {"units": 177, "unique_sources": 177, "all_passed": True, "exact_compiled_input_membership": True, "command_hashes_validated": True}
    assert len(units) == 177
    expected = {row["path"].replace("\\", "/"): row["sha256"] for row in engine["compiled_input_hashes"]}
    names = [row["source"].replace("\\", "/") for row in units]
    assert len(set(names)) == 177 and set(names) == set(expected)
    for name, unit in zip(names, units):
        assert unit["status"] == "passed" and unit["source_sha256"] == expected[name]
        assert "-c" in unit["argv"] and command_hash(unit["argv"]) == unit["command_sha256"]
    assert command_hash(engine["embedded_data"]["link"]["argv"]) == engine["embedded_data"]["link"]["command_sha256"]
    return {"path": proof_path.relative_to(root).as_posix(), "sha256": digest(data)}
