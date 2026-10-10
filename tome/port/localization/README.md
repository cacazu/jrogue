# Original-runtime semantic localization kernel

This directory provides a presentation resolver for retained ToME 1.7.6 C/Lua gameplay. It connects to the original `engine.I18N` `_t` and `string.tformat` seam. Gameplay state, native RNG, save data and externally supplied parameter values remain outside the resolver.

The parent has generated `catalogs/en.json`, `catalogs/ja.json` and `catalogs/registry.json`. `catalog-build-result.json` records the current semantic ID, source/tag route, complete literal hook, missing official Japanese and collision counts. Nested expression literals are excluded. Final source locator mapping regeneration and structural verification are owned by the parent; see `CHECKPOINT.json` for the reviewed snapshot and remaining integration work. These counts establish known source-hook catalogue coverage, not full reachable gameplay or browser coverage.

`build-catalogs.mjs` derives explicit IDs from the owning original module/file, talent/entity/birth definition, method/property, native tag and message role. It resolves case, markup, format and layout variants explicitly. It never replaces strings or rewrites original Lua. Generated English and Japanese JSON use identical ID sets; missing official Japanese targets are `null`, with an explicit missing report. Source/tag routing retains catalogue and Lua source locators.

The Rust `tome-text-kernel` crate validates ID/key coverage, duplicate IDs, route references and argument indices. It returns a semantic ID, selected template, original argument order and native delegation flags. It leaves printf execution with the original Lua VM. `Locale::Japanese` is the default; English fallback is reported through `missing_official_japanese`.

## Retained Lua integration

Install `lua/semantic_i18n.lua` after `engine.I18N` loads and before ToME definition/UI initialization. `M.install(api)` requires `api.resolve(source, tag, file, line)` to return the same result as Rust `Catalogue::resolve`, or `nil, reason` for unmapped/ambiguous routes. Original `_t` and `string.tformat` handlers are retained for fallback and special processors. `_nt` remains unchanged.

`M.catalogue(en, ja, registry, options)` is a portable Lua implementation of the same registry contract. The platform supplies JSON decoding; this allows integration before a Rust-to-Lua native callback is available. Its Japanese default and `set_locale` must synchronize original native locale state with `options.sync_native_locale`, so delegated special formatting uses the original locale flags. Preserve original locale loading and apply the generated Japanese font, character-wrapping and artifact-name configuration through their existing native APIs.

Pass `options.native_i18n` as the retained `engine.I18N` module/instance, or supply `api.native_contract = M.native_contracts(I18N)` when using the Rust resolver. This bridge reads `I18N:getLocalesData()` at each call. The original runtime is authoritative for the shared `"nil"` fallback bucket, effective argument order, source-wide special gate and whole-tag metadata resets. Catalogue declaration metadata alone cannot reconstruct locale load history. Mismatches delegate to the saved original handler, and delegated formatting uses the saved original `_t` throughout. Errors restore the delegation guard before propagating. The standalone resolver can reject ambiguous tags; the installed wrapper then preserves original last-registration fallback.

For example:

```lua
local api = Semantic.catalogue(en, ja, registry, {
  native_i18n = I18N,
  sync_native_locale = function(locale) I18N:setLocale(locale) end,
})
local installed = Semantic.install(api)
```

The separate authored supplement may deliberately provide text absent from native catalogues. Enable such overrides only for reviewed IDs through `allow_native_template_override(result)`; official catalogue entries continue to follow active native translations. External parameter values are passed unchanged. JSON null sentinel objects represent missing translations. Empty Japanese strings are valid present translations: upstream uses them for articles, pronouns and suffixes, so both resolvers preserve them without English fallback or a missing flag.

Normal `tformat` uses the mapped template with the original positional argument permutation. Native special processors and reviewed upstream format contracts delegate to the saved original formatter. Parameters such as external usernames pass through untouched.

## Commands

```powershell
node .\build-catalogs.mjs --self-test
node .\build-catalogs.mjs --inventory ..\inventory-work\inventory-output --output .
cargo test --offline
cargo clippy --offline --all-targets -- -D warnings
cargo fmt --check
```

Executable Lua seam fixture uses the existing trusted official Lua 5.1.5 WASM CLI:

```powershell
$env:TOME_TEXT_TEST_ROOT = (Get-Location).Path.Replace('\', '/')
$env:TOME_I18N_SOURCE = 'C:/path/to/unpacked/game/engines/default/engine/I18N.lua'
node ..\lua-work\build\lua.js .\lua\test_semantic_i18n.lua
```

That fixture loads the entire unchanged original `I18N.lua`, stubbing only engine class/module setup. Its 30 checks verify actual Berserker Japanese text, exact/default tags, valid empty Japanese translations, native last-registration fallback, argument reordering and metadata resets, source-wide special processing, unchanged external names, explicit missing translations, locale switching, RNG independence, physical source path aliases, error guard restoration and uninstall restoration. `direct-literal-hooks.mjs --self-test` separately passes 12 complete-source-expression checks.

## Independent bounded audits and supplement

`audit-ja-metadata.mjs` streams all 23,404 active Japanese registrations and reads their original call lines, buffering multiline strings with a 256 KiB guard. `ja-metadata-audit.json` verifies all 23,404 calls with zero metadata mismatches: the actual Japanese files supply no fourth argument-order argument and no fifth special argument. Empty declaration metadata was therefore preserved correctly. The audit used a 48 MiB old-space cap, a 1 MiB young generation and sampled 83,275,776 bytes of RSS.

The historical reference inventory labelled empty targets as untranslated; its preserved source/target values were correct. `inventory-work/analyze-locales.mjs` now classifies official empty targets as present native translations. Its 21 parser assertions and syntax check pass; full reference-report regeneration was not run during this bounded review. Current production missing status comes from the corrected parent-owned catalogue build, not those historical gap labels.

`audit-section-paths.mjs` checks 1,430 distinct catalogue/section pairs against actual source files. All 1,429 physical sections exist; `.always_merge` is the sole ownerless sentinel. `section-path-audit.json` records the exact mappings and sampled 56,573,952 bytes RSS. Module virtual prefixes map into `mod/` except `data/` or an already explicit `mod/`; the engine package prefix is removed before mapping core code/data or its bundled boot module. Addon sections retain their own physical namespace.

`supplements/debug-main/{en.json,ja.json,manifest.json}` contains 28 authored, context-labelled Japanese translations for the original DebugMain runtime dialog. These have separate provenance and have not been merged into the official Japanese catalogue. Every complete hook literal, original line, semantic owner, printf specifier and missing-official-translation status was verified. The supplement builder streamed all 23,404 official Japanese registrations, found zero existing nonempty source matches and sampled 58,081,280 bytes RSS. This supplements the debug/cheat interface only; original unhooked debug logs and normal campaign coverage remain separate work.

## Provenance and scope

Generated translations originate from official 1.7.6 Japanese Lua catalogues. Code/data are distributed with upstream GPL obligations and source locators; keep original notices and `COPYING`. Font assets have separate licences and are not copied by this kernel. Donor addon text remains namespaced with its source; including catalogue records does not enable or authorize those addon game features.

Missing official translations and reviewed formatting contracts are explicit remaining localization work. Full retained-engine browser execution and integration belong to the bootstrap/platform task.
