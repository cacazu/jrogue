"""Verify isolated source shape/provenance only; Rust/JS execution is gated."""
from pathlib import Path
import hashlib
import json
import re
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


class ProposalSourceContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = json.loads((HERE / "preparation.json").read_text(encoding="utf-8"))

    def test_protected_inputs_unchanged(self):
        for relative, expected in self.report["protected_input_sha256"].items():
            self.assertEqual(hashlib.sha256((ROOT / relative).read_bytes()).hexdigest(), expected, relative)

    def test_all_existing_stateless_ffi_bytes_and_exports_preserved(self):
        original = (ROOT / "rust/src/ffi.rs").read_bytes()
        isolated = (HERE / "rust-copy/src/ffi.rs").read_bytes()
        self.assertTrue(isolated.startswith(original))
        self.assertEqual(len(original), self.report["existing_stateless_ffi_prefix_bytes"])
        exports = re.findall(rb'pub (?:unsafe )?extern "C" fn ([a-z0-9_]+)', original)
        for name in exports:
            self.assertEqual(isolated.count(b'fn ' + name + b'('), 1)

    def test_no_new_dependency_or_core_formatter_changes(self):
        for relative in ["Cargo.toml", "Cargo.lock", "src/application.rs", "src/domain.rs", "src/platform.rs", "src/presentation.rs"]:
            self.assertEqual((ROOT / "rust" / relative).read_bytes(), (HERE / "rust-copy" / relative).read_bytes(), relative)

    def test_registry_validation_occurs_at_explicit_register_only(self):
        source = (HERE / "registered_catalog.rs.in").read_text(encoding="utf-8").split("#[cfg(test)]")[0]
        self.assertEqual(source.count("Catalog::from_json"), 1)
        snapshot = source[source.index("pub fn snapshot"):source.index("pub fn release")]
        self.assertNotIn("insert", snapshot)
        self.assertNotIn("from_json", snapshot)
        self.assertIn("&self", snapshot)
        self.assertIn("Arc::clone", snapshot)

    def test_registered_render_does_not_parse_or_mutate_catalog(self):
        source = (HERE / "ffi-additions.rs.in").read_text(encoding="utf-8").split("#[cfg(test)]")[0]
        render = source[source.index("pub unsafe extern \"C\" fn nh_rust_format_registered"):]
        self.assertNotIn("Catalog::from_json", render)
        self.assertNotIn(".register(", render)
        self.assertNotIn(".release(", render)
        self.assertIn("registry.snapshot(handle)", render)
        self.assertIn("catalog.render(&event, language)", render)
        self.assertIn("catalog.render_gameplay(&envelope, language)", render)

    def test_only_three_pure_host_calls_exist(self):
        source = (HERE / "registered-catalog-host.mjs").read_text(encoding="utf-8")
        calls = re.findall(r"\.ccall\('([^']+)'", source)
        self.assertEqual(sorted(calls), sorted(self.report["additive_exports"]))
        self.assertIn("module !== this.#module", source)
        self.assertIn("this.#disposed", source)
        self.assertIn("this.#rendering", source)
        self.assertIn("finally", source)
        self.assertNotIn("JSON.stringify", source)

    def test_new_c_abi_matches_rust_pointer_length_and_fallback_shape(self):
        header = (HERE / "registered-catalog.h").read_text(encoding="utf-8")
        source = (HERE / "ffi-additions.rs.in").read_text(encoding="utf-8")
        self.assertIn("const uint8_t *event", header)
        self.assertIn("size_t event_length", header)
        self.assertIn("uint8_t *fallback", header)
        self.assertIn("event_ptr: *const u8, event_len: usize, kind: u32", source)
        self.assertIn("fallback_ptr: *mut u8", source)

    def test_undersized_output_does_not_write_status(self):
        source = (HERE / "ffi-additions.rs.in").read_text(encoding="utf-8").split("#[cfg(test)]")[0]
        self.assertIn("output_cap >= rendered.text.len()", source)
        self.assertIn("result >= 0 && !output_ptr.is_null()", source)
        self.assertIn("!fallback_ptr.is_null()", source)

    def test_prepared_test_cases_and_measurements_have_honest_status(self):
        self.assertFalse(self.report["compiler_executed"])
        self.assertFalse(self.report["runtime_executed"])
        self.assertFalse(self.report["speedup_claimed"])
        self.assertEqual((HERE / "registered_catalog.rs.in").read_text(encoding="utf-8").count("#[test]"), 6)
        self.assertEqual((HERE / "ffi-additions.rs.in").read_text(encoding="utf-8").count("#[test]"), 2)
        self.assertEqual(self.report["baseline_measurements_reported_by_parent_and_browser_owner"]["nested_name_stateless_formatter_calls"], 28200)

    def test_host_overlay_preserves_native_capture_and_typed_serializers(self):
        old = (ROOT / "web/shim-host.mjs").read_text(encoding="utf-8")
        new = (HERE / "host-overlay/shim-host.mjs").read_text(encoding="utf-8")
        before = old[:old.index("export class RustLayers")]
        self.assertEqual(new[:new.index("export class RustLayers")], "import {RegisteredCatalog} from './registered-catalog-host.mjs';\n" + before)
        self.assertEqual(old[old.index("export const SHIM_CALLBACKS"):], new[new.index("export const SHIM_CALLBACKS"):])
        self.assertIn("serializeGameplayEnvelope(owned)", new)
        self.assertIn("serializeTextEvent(event)", new)

    def test_host_overlay_preserves_input_methods_and_display_sources(self):
        old = (ROOT / "web/shim-host.mjs").read_text(encoding="utf-8")
        new = (HERE / "host-overlay/shim-host.mjs").read_text(encoding="utf-8")
        start = "  keycode(key, modifiers, context = 0)"
        end = "export const SHIM_CALLBACKS"
        self.assertEqual(old[old.index(start):old.index(end)], new[new.index(start):new.index(end)])
        for name in ["dom-ui.mjs", "save-store.mjs", "index.html", "style.css", "browser-ui.json", "gameplay-core.json"]:
            self.assertEqual((ROOT / "web" / name).read_bytes(), (HERE / "host-overlay" / name).read_bytes(), name)

    def test_host_overlay_initializes_explicitly_and_disposes_before_replacement(self):
        app = (HERE / "host-overlay/app.mjs").read_text(encoding="utf-8")
        self.assertLess(app.index("layers.dispose()"), app.index("module = await factory"))
        self.assertLess(app.index("new RustLayers"), app.index("ui.bind(host,layers)"))
        source = (HERE / "host-overlay/shim-host.mjs").read_text(encoding="utf-8")
        start = source.index("  format(id, args")
        end = source.index("  keycode(key, modifiers", start)
        self.assertNotIn("new RegisteredCatalog", source[start:end])
        self.assertNotIn("nh_rust_catalog_register", source[start:end])

    def test_host_overlay_checkpoint_matches_its_actual_source_hashes(self):
        report = json.loads((HERE / "host-preparation.json").read_text(encoding="utf-8"))
        for name, expected in report["web_source_input_sha256"].items():
            self.assertEqual(hashlib.sha256((ROOT / "web" / name).read_bytes()).hexdigest(), expected)
        for name, expected in report["overlay_sha256"].items():
            self.assertEqual(hashlib.sha256((HERE / "host-overlay" / name).read_bytes()).hexdigest(), expected)
        self.assertFalse(report["javascript_executed"])

    def test_portable_vendor_copy_matches_all_eleven_locked_canonical_packages(self):
        self.assertEqual(len(self.report["portable_vendor_packages"]), 11)
        config = (HERE / "rust-copy/.cargo/config.toml").read_text(encoding="utf-8")
        self.assertIn('directory = "vendor"', config)
        self.assertNotIn("C:", config)
        for relative, expected in self.report["canonical_vendor_file_sha256"].items():
            original = ROOT / "rust/vendor" / relative
            copy = HERE / "rust-copy/vendor" / relative
            self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(), expected, relative)
            self.assertEqual(hashlib.sha256(copy.read_bytes()).hexdigest(), expected, relative)

    def test_all_literal_include_bytes_and_include_str_paths_resolve_in_portable_copy(self):
        source = (HERE / "locales/gameplay-core.json").read_bytes()
        self.assertEqual(source, (ROOT / "locales/gameplay-core.json").read_bytes())
        found = 0
        for path in (HERE / "rust-copy").rglob("*.rs"):
            for match in re.finditer(r'include_(?:bytes|str)!\s*\(\s*"([^"\n]+)"\s*\)', path.read_text(encoding="utf-8")):
                include = (path.parent / match.group(1)).resolve()
                self.assertTrue(include.is_relative_to(HERE), str(include))
                self.assertTrue(include.is_file(), str(include))
                found += 1
        self.assertGreaterEqual(found, 10)


if __name__ == "__main__":
    unittest.main(verbosity=2)
