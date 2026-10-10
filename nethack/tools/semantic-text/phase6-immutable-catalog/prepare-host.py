"""Prepare a complete isolated browser-source overlay; no current host mutation."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT / "web"
OUTPUT = HERE / "host-overlay"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def once(source, old, new):
    if source.count(old) != 1:
        raise ValueError("host source anchor missing/ambiguous: " + old[:80])
    return source.replace(old, new, 1)


def prepare():
    names = ["app.mjs", "browser-ui.json", "dom-ui.mjs", "gameplay-core.json", "index.html",
             "save-store.mjs", "shim-host.mjs", "style.css"]
    inputs = {name: (SOURCE / name).read_bytes() for name in names}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, data in inputs.items():
        (OUTPUT / name).write_bytes(data)
    source = inputs["shim-host.mjs"].decode("utf-8")
    constructor = '''  constructor(module, catalog) {
    this.module = module;
    this.catalogBytes = new TextEncoder().encode(JSON.stringify(catalog));
    this.catalogPtr = module._malloc(this.catalogBytes.length);
    module.HEAPU8.set(this.catalogBytes, this.catalogPtr);
    this.gameplayCatalog = null;
    this.gameplayCatalogBytes = null;
    this.gameplayCatalogPtr = 0;
  }'''
    constructor_new = '''  constructor(module, catalog) {
    this.module = module;
    const json = JSON.stringify(catalog);
    this.catalogBytes = new TextEncoder().encode(json);
    this.uiRegistered = new RegisteredCatalog(module,json);
    this.gameplayRegistered = null;
    this.gameplayCatalog = null;
    this.gameplayCatalogBytes = null;
  }'''
    source = once(source, constructor, constructor_new)
    allocation = '''    const pointer = this.module._malloc(Math.max(1,bytes.length));
    if (!pointer) throw new Error('Could not allocate gameplay catalog');
    this.module.HEAPU8.set(bytes,pointer);
    if (this.gameplayCatalogPtr) this.module._free(this.gameplayCatalogPtr);
    this.gameplayCatalog = Object.freeze({...owned,en:Object.freeze(owned.en),ja:Object.freeze(owned.ja)});
    this.gameplayCatalogBytes = bytes;
    this.gameplayCatalogPtr = pointer;'''
    replacement = '''    const candidate = new RegisteredCatalog(this.module,JSON.stringify(owned));
    try { this.gameplayRegistered?.dispose(this.module); }
    catch (error) { candidate.dispose(this.module); throw error; }
    this.gameplayRegistered = candidate;
    this.gameplayCatalog = Object.freeze({...owned,en:Object.freeze(owned.en),ja:Object.freeze(owned.ja)});
    this.gameplayCatalogBytes = bytes;'''
    source = once(source, allocation, replacement)
    begin = source.index("  format(id, args = {}, locale = 'ja') {", source.index("export class RustLayers"))
    end = source.index("  keycode(key, modifiers, context = 0)", begin)
    old_render = source[begin:end]
    render = '''  format(id, args = {}, locale = 'ja') {
    const typed = Object.fromEntries(Object.entries(args).map(([key,value]) => [key,{type:Number.isInteger(value) ? 'integer' : 'text',value}]));
    return this.renderTyped({id,args:typed},locale).text;
  }
  formatEvent(event,locale = 'ja') {
    if (!this.gameplayRegistered) throw new Error('Gameplay catalog is not loaded');
    const owned = immutableGameplayEnvelope(event);
    return this.gameplayRegistered.renderJSON(this.module,serializeGameplayEnvelope(owned),locale,1);
  }
  renderTyped(event,locale = 'ja') {
    return this.uiRegistered.renderJSON(this.module,serializeTextEvent(event),locale,0);
  }
  dispose() {
    const gameplay = this.gameplayRegistered;
    this.gameplayRegistered = null;
    try { gameplay?.dispose(this.module); }
    finally { this.uiRegistered.dispose(this.module); }
  }
'''
    source = source[:begin] + render + source[end:]
    source = "import {RegisteredCatalog} from './registered-catalog-host.mjs';\n" + source
    (OUTPUT / "shim-host.mjs").write_text(source, encoding="utf-8", newline="\n")
    (OUTPUT / "registered-catalog-host.mjs").write_bytes((HERE / "registered-catalog-host.mjs").read_bytes())
    app = inputs["app.mjs"].decode("utf-8")
    app = once(app, "async function createEngine() {\n  phase = 'loading';", '''async function createEngine() {
  // Release adapter-owned resources before replacing the original Wasm instance.
  if (layers) { layers.dispose(); layers = null; ui.layers = null; ui.host = null; }
  phase = 'loading';''')
    old_probe = "const gameplayFormatterAvailable = typeof module._nh_rust_format_gameplay === 'function' && typeof module._nh_rust_format_gameplay_fallback === 'function';"
    app = once(app, old_probe, "const gameplayFormatterAvailable = typeof module._nh_rust_catalog_register === 'function' && typeof module._nh_rust_catalog_release === 'function' && typeof module._nh_rust_format_registered === 'function';")
    (OUTPUT / "app.mjs").write_text(app, encoding="utf-8", newline="\n")
    for name, data in inputs.items():
        if (SOURCE / name).read_bytes() != data:
            raise ValueError("active browser input changed during preparation")
    report = {"schema_version":1,"status":"source-overlay-prepared-unexecuted",
        "compiler_executed":False,"javascript_executed":False,"browser_executed":False,
        "current_web_inputs_unchanged":True,
        "web_source_input_sha256":{name:digest(data) for name,data in inputs.items()},
        "overlay_sha256":{p.name:digest(p.read_bytes()) for p in sorted(OUTPUT.iterdir()) if p.is_file()},
        "replaced_stateless_render_segment_sha256":digest(old_render.encode()),
        "semantic_serializers_and_capture_source_preserved":True,
        "catalog_fixture_notice":"Copied gameplay-core.json is the canonical old fixture; Phase6 composer must explicitly replace it with its selected merged catalog before runtime QA.",
        "lifecycle":"Initialization before ui.bind/native play; explicit dispose before module replacement; retain ended-game catalog for immutable history repaint."}
    (HERE / "host-preparation.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
    return report


if __name__ == "__main__":
    result = prepare()
    print(json.dumps({"status":result["status"],"files":len(result["overlay_sha256"]),"current_web_inputs_unchanged":True}))
