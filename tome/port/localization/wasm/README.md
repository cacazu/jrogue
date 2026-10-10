# Original ToME semantic resolver WASM bridge

Source is ready for the parent's next sequential build slot. This crate connects the validated `localization-kernel-work` catalogue to the actual original C/Lua I18N seam. It contains no simulation, RNG, save graph, gameplay mutation, or parameter formatter. It is not a complete port or evidence of complete campaign runtime text coverage.

`src/lib.rs` provides an importless safe-byte WASM mailbox. `browser/semantic-text-wasm.mjs` streams raw JSON bytes into that mailbox, then performs synchronous immutable lookups. `browser/native-semantic-bridge.mjs` exposes bounded result leases to `native/native_semantic_resolver.c`; that C adapter copies finite result strings and argument order into the existing original Lua state. `lua/native_semantic_options.lua` supplies exact-ID supplemental and policy lookup proxies to the content agent's existing observer. `lua/native_semantic_bootstrap.lua` constructs that observer without replacing require or loading a game.

The immutable base inputs are `../localization-kernel-work/catalogs/en.json`, `ja.json`, and `registry.json`. Their last observed byte sizes were 4,756,417, 5,190,669, and 29,977,169. The validated base contains 24,825 IDs. Keep official Japanese separate from authored supplements so `missing_official_japanese` remains accurate.

Optional final reviewed inputs, once the parent runs the content agent's staged merge, are:

- `../localization-review-work/final-review/ja-supplement-complete.json`: 479 exact reviewed supplemental IDs.
- `../localization-review-work/final-review/format-policy.json`: precisely two authorized UTF-8 string precision adjustments, with their provenance.
- `../localization-review-work/dream-stage/dream-registry-extension.json`: one separate official Japanese reuse ID for the explicit DEATH_DREAM damage-label call.

The dream extension uses a separate catalogue. The exact source/tag route is checked before base fallback; missing extension returns a reason rather than choosing an unrelated dream alias. Its official Japanese reuse keeps `missing_official_japanese=false`. No base catalogue file is changed.

## Parent build and verification

Run from this directory in one parent-monitored slot at a time:

```powershell
& 'C:\Users\kit\.cargo\bin\cargo.exe' test --offline --jobs 1
& 'C:\Users\kit\.cargo\bin\cargo.exe' clippy --offline --all-targets --jobs 1 -- -D warnings
& 'C:\Users\kit\.cargo\bin\cargo.exe' build --offline --release --target wasm32-unknown-unknown --jobs 1
& 'C:\Program Files\nodejs\node.exe' tests/wasm-bridge.test.mjs
& 'C:\Program Files\nodejs\node.exe' tests/wasm-bridge.test.mjs --full-catalog
```

Eight Rust tests are prepared. The JS test loads the actual built WASM, checks split UTF-8 streams, Japanese default, empty Japanese, missing official Japanese, original delegation flags, rejected external parameters, immutable queries, and native-host lease lifetime. Its native registration object is a fixture; actual C/Lua/browser integration still needs a runtime scenario. The full-catalog option streams the actual files and reports loaded counts. It may use the earlier supplement if final files have not been generated, so inspect its status before claiming final 479 coverage.

Compile `native/native_semantic_resolver.c` with the existing native adapter's original Lua include paths and Emscripten flags, and link it into the actual native module. It uses the existing `tome_main_get_state()`. Keep `ccall`, `UTF8ToString`, `lengthBytesUTF8`, and `stringToUTF8` available in Emscripten's runtime; use the existing parent's link/export convention. Its KEEPALIVE exports are `tome_native_semantic_register()` and `tome_native_semantic_last_error()`.

## Browser and original bootstrap ordering

Serve the built `target/wasm32-unknown-unknown/release/tome_text_wasm.wasm`, both browser modules, and JSON inputs through the parent's controlled local server. Suggested host wiring, using parent-assigned URLs:

```js
import { createSemanticTextWasm } from './semantic-text-wasm.mjs';
import { installNativeSemanticBridge } from './native-semantic-bridge.mjs';

const response = await fetch(urls.semanticWasm);
if (!response.ok) throw new Error('Semantic WASM fetch failed');
const resolver = await createSemanticTextWasm(await response.arrayBuffer(), {
  english: urls.english,
  japanese: urls.japanese,
  registry: urls.registry,
  supplements: urls.reviewedSupplements,
  formatPolicies: urls.reviewedFormatPolicies,
  extension: urls.dreamExtension,
}, { expectedIds: urls.dreamExtension ? 24826 : 24825 });

// Parent creates actual native module and mounts original inputs/adapters first.
if (native.ccall('tome_native_init', 'number', [], []) !== 1) throw new Error('Native init failed');
const semanticHost = installNativeSemanticBridge(native, resolver);
// Parent's existing Lua driver installs the observer below before original start.
if (native.ccall('tome_native_start', 'number', [], []) !== 1) throw new Error('Native start failed');
```

The Rust instance must be ready before native registration. Original init must have created its Lua state before registration. Registration and observer construction must precede original config/I18N/definition loading. Mount these source files under explicit parent-selected adapter paths: this directory's two Lua helpers, `../localization-kernel-work/lua/semantic_i18n.lua`, and `../localization-native-plan-work/native_i18n_install.lua`.

Construct the observer at the existing driver before its current `require` wrapper and before original pre-init:

```lua
assert(settings.locale_preferences_ready == true)
local semantic_observer = assert(loadfile(settings.semantic_bootstrap))().new{
  semantic_path=settings.semantic_module,
  options_path=settings.semantic_options,
  observer_path=settings.semantic_observer,
  preferences={ready=true,preferred_locale=settings.preferred_locale},
  callbacks={trace_limit=128},
}
```

In that already-owned wrapper, immediately after `local result = original_require(module_name)`, add `semantic_observer:on_required(module_name, result)`. Keep the original wrapper's remaining hooks and returned `result`. This source handoff does not edit `bootstrap-work/real-core-probe.lua`, duplicate original pre-init/loader, or create another require wrapper.

The platform must actually hydrate saved locale or establish a fresh profile before asserting readiness; the boolean is a contract, not a substitute for hydration. Japanese is the fresh-profile default. A saved original English setting stays authoritative. Read actual native locale at every resolve call. Original LanguageSelect saves and reboots the VM; re-register callbacks and create a new observer for every new original Lua state. The immutable Rust catalogue may be reused.

The observer exposes `coverage_snapshot()`. Capture its counters, bounded unknown/delegate events, actual locale, missing-official provenance, and sampled IDs after birth/dialog/movement/save/load scenarios. Source IDs and fixture tests alone do not establish full runtime coverage. The content agent's Player-only name presentation protection must remain in its observer; no global username-string exemption exists here.

## Byte and callback contracts

Stage reset codes are 1 English (8 MiB), 2 Japanese (12 MiB), 3 registry (40 MiB), 4 supplements (1 MiB), 5 policies (256 KiB), and 6 extension (1 MiB). Combined raw inputs are capped at 64 MiB. Append little-endian packed `u32` words with a byte count of 1 through 4, finish each stage, and initialize once. Raw staged strings are released after successful parsing. Duplicate IDs, invalid UTF-8, unknown supplemental IDs, changed printf/markup contracts, and unapproved policy fields fail initialization. Failed or concurrent browser initialization cannot reuse partial stages; create another WASM instance.

Exports are `tome_text_stage_reset`, `tome_text_stage_word`, `tome_text_stage_finish`, `tome_text_initialize`, `tome_text_request_reset`, `tome_text_request_word`, `tome_text_request`, `tome_text_output_len`, and `tome_text_output_word`. All use scalar values; no raw guest-memory writes or pointer imports are exposed. Requests are capped at 1 MiB and output at 4 MiB.

The native globals are:

- `__TOME_SEMANTIC_RESOLVE(source, tag, file, line, actual_locale)` returns `{id,template,owner,tag,args_order,missing_official_japanese,delegate_native_special,delegate_native_format_review}` or `nil,reason`.
- `__TOME_SEMANTIC_SUPPLEMENT(id)` returns a reviewed Japanese string, including a valid empty string, or `nil,reason`.
- `__TOME_SEMANTIC_FORMAT_POLICY(id)` returns only one of the two reviewed exact policies, including `semantic_id` and the required native protection flag, or `nil,reason`.

The resolved base template and flags remain unchanged by supplements. The existing native observer applies an exact-ID/template allowlist. Rust validates both two approved policy owners and their exact English/Japanese targets; C projects only the fields that the original seam needs. Provenance stays in the immutable Rust policy store. Special formatting, effective active native argument order, and saved original `tformat` remain controlled by `semantic_i18n.lua` and actual I18N. JS/Rust never receive or translate external parameter values, nor call `string.format`.

The native host permits at most 32 simultaneous result leases. C copies strings before releasing them. Unknown or ambiguous source/tag/callsite returns a stable reason; the original formatter remains the fallback. Actual native compilation, real browser latency/memory, VM-reboot re-registration, real dialog text coverage, and full campaign coverage are pending parent verification.

## Actual-source browser scenario

The parent reported eight Rust tests, clippy, release WASM, fixture transport, and the full 24,826-ID catalogue passing after the narrow percentage-prose fix. `source-contract-diagnosis.json` preserves the two exact source/target/ID mismatches from the initial scanner: the `_t` Global Speed and Vim prose contains literal percentages, not native `tformat` conversions. `tests/percentage-prose-fixture.json` copies those reviewed source pairs exactly and the eighth test checks successful initialization plus preservation of genuine `% g`, `% s`, `%s`, `%f`, and `%%` contracts. Both exact precision policy guards remain unchanged.

Serve `browser/native-semantic-browser.html` as `/semantic/native-semantic-browser.html`, the corresponding entry/session `.mjs` modules under `/semantic/`, and the existing original mount module at `/bootstrap/browser_vfs_mounts.mjs`. The native factory stays `/native/tome-native.mjs`. The entry initializes the real Rust catalogue, creates its own native factory/MEMFS, verifies the pre-init profile is empty, mounts actual original inputs, calls actual init/register/fresh-profile opt-in, supplies `bat` through the original pre-birth name configuration export, and starts the original loader. Newly created original init directories are allowed after the empty-profile check; no previous profile is loaded or deleted.

Mount `lua/native_semantic_diagnostics.lua` at `/adapter/localization/native_semantic_diagnostics.lua`. The parent-owned driver's `localization_json()` must include `diagnostics=diagnostic_module.collect(semantic_observer)` alongside its existing `status` and `coverage`. The helper uses actual post-birth `FontPackage:list/getFont`, original resources, player name getter, actual `string.tformat`, and active original I18N tables. It never creates actors, alters their fields, changes locale tables, or invokes rendering/RNG. It changes localization telemetry through real text calls, so it is separate from immutable simulation snapshots. Empty native Lua arrays may encode as `{}`; the scenario handles that representation.

Run the parent's existing browser probe with entry `/semantic/native-semantic-browser.html` and scenario module `localization-wasm-work/browser/native-semantic-scenario.mjs`. This source scenario requires actual Japanese birth/font state, both exact CJK precision results with unchanged arguments, external `bat` name/NPC translation separation, observed semantic telemetry, state/RNG preservation across diagnostic queries, one actual original wait, zero dangling result leases, and PC/mobile screenshots. Special/order probes use only existing active native metadata and compare saved original formatter output to retained semantic formatter output. A native path with no active source is explicitly unobserved; no locale metadata is manufactured. The original effectful draw is comparison-only, and the scenario does not claim complete UI or campaign coverage.
