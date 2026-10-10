# DRL original-source semantic presentation overlay

This is a reproducible Pascal/Lua presentation overlay against official DRL `0_10_11a`, commit `a6f965072b3a25b768c91dbced00367f1b57d865`. It preserves original gameplay, English domain names, registry IDs, mechanics-sensitive comparisons and native save fields. This checkpoint is **not complete DRL localization**. Full original-game compilation and browser execution remain integration gates; the parent agent owns measured native fixture runs.

Requested delivery is local HTML plus Node/browser verification. No external Site creation, deployment or access changes are performed or authorized here. Pristine `upstream/`, `native/`, Rust `port/` and other games are owned separately and remain untouched by this task.

## Reproduce and review

```powershell
node localization/curate.mjs
node localization/verify.mjs --no-native
```

`curate.mjs` is reviewed authoring source; it writes canonical `en.json`, `ja.json`, `contract.json` and source-locked `manifest.json`. `generate.mjs` checks original bytes/SHA-256, exact UTF-16 source offsets, original snippets and nonoverlapping patches before writing `localization/overlay`. It refuses pristine upstream and its ancestors as output. Run curation deliberately when reviewing changes; ordinary integration may use `node localization/generate.mjs`.

Verified checkpoint: **3,675 equal EN/JA IDs, 1,467 patches, 74 checked original files**, of which 72 have changes. There are 1,194 patches with canonical semantic IDs; support/helper seams and read locks are separate. Counts describe reviewed source coverage, not whole-game completion. Eleven semantic Pascal units are emitted in addition to adapted original files.

| Catalog domain | IDs |
|---|---:|
| Original-game presentation, including 173 reused input IDs | 3,592 |
| Separate browser UI | 67 |
| Pascal/Lua ABI adapter diagnostics | 6 |
| Lua semantic adapter diagnostics | 7 |
| C browser-platform diagnostics | 3 |

## Implemented source surface

- All 28 visible setting pairs, choices, settings views/reset/restart/apply/capture hints; original IDs/defaults/ranges retained. All 73 nonempty input action pairs, 16 controller pairs, front/main/in-game menus and typed compatibility/seed/mod diagnostics.
- All eight help bodies: 116 semantic paragraphs, all 463 original nonempty lines, controls, sample map, historical disclaimers, attribution, URLs and external usernames retained. The loader guards the entire original English line sequence; edited/custom help stays verbatim.
- 1,428 registry fields across 667 records: names/descriptions, default/explicit being plurals, generated corpses/natural attacks, traits, perks, awards, ranks, challenges, stories and assembly requirements. Four nonliteral requirement fields have all eight original branches implemented. English Name/Desc fields stay unchanged; unknown/overridden fields retain original fallback.
- 517 directly reviewed presentation message calls: 405 Lua and 112 Pascal, including complete special-level/plot/combat/reload/target/look/pickup/action variants. The complete inventory has 540 calls: ten unshipped debug/classic calls and thirteen retained generic dispatch or separately reviewed producer seams are individually listed in `migration-plan.json`.
- Guarded original views/indexed terminology and description boxes preserve getters, resistance calculations and eager conditional evaluation. CJK padding measures resolved text without cropping UTF-8 bytes.
- `padding-sites.json` accounts for all 80 original `Padded` calls in four display/report units. Sixty-six use the parent `VTIG_Padded` adapter, four already use reviewed column-safe projections, and nine numeric plus one empty field retain original padding. Inventory description clipping uses browser-only column measurement; the exact original native byte-clipping branch remains. Catalog text, identities, English domain fields and native save producers are unchanged. The source checks do not certify the new adapter's actual browser geometry.
- 175 mortem templates plus archived-score projection. Archive decoding uses finite source alternatives, original challenge abbreviations and whole-value guards; unknown/custom records stay verbatim. Original score XML/result descriptions/player identities/timestamps stay original.
- 83 executable history producers (81 Lua, two Pascal), 525 IDs and 466 contextual registry projections. Two commented old calls and the method declaration are excluded. Original history append arguments, `@1`, capitalization and saved English remain unchanged.
- Item presentation captures 44 original assembly assignments, one overcharge assignment and six schematic producers. There are 46 templates, 297 whitelist rules (including 252 schematic variants) and 172 base names. Both `nuclear BFG 9000` comparisons stay English. Three unique weapon mode groups change statistics without renaming.

## Text contract and layout

`en.json`/`ja.json` are flat semantic-ID-to-text maps. `contract.json` has schema 1, grammar `native-vtig-markup+double-brace-named-parameters` and typed named parameters. Only double braces interpolate:

```json
{"menu.save.version.engine":"セーブのエンジンバージョン：{!{{version}}}"}
```

Single-brace VTIG styles and live controls keep their grammar, including `{R...}`, `{!...}` and `{$input_ok}`. String parameters remain verbatim, never recursively translated or interpreted as IDs. Signed Int64 values cross the browser boundary as canonical decimal strings. `DRLEnglishText` reconstructs original English without changing the locale callback.

The `drlsemantictext.pas` callback is a Pascal function type, not a stable foreign C ABI. Parent marshals typed records into Rust `NativeText`; Japanese must be selected before constructing presentation metadata. Locale changes must refresh display metadata without resetting game/settings state. Actual UTF-8/grapheme/column behavior depends on the parent VTIG/Rust adapter and remains an unrun native/browser gate.

## Presentation sidecars and parent integration

These units change no original fields or RNG. They close writes before completion, reject unknown schemas/IDs/kinds, bound text/file/depth/record counts and load atomically. Missing/rejected metadata retains original English. All schemas are version 1.

| API | Default file | Format and identity |
|---|---|---|
| `DRLClearSemanticFeelings`, `DRLSaveSemanticFeelings`, `DRLLoadSemanticFeelings` | `/user/drl.presentation.json` | `drl.semantic-feelings`; exact combined English guard and typed event records |
| `DRLClearSemanticItemNames`, `DRLSaveSemanticItemNames`, `DRLLoadSemanticItemNames` | `/user/drl.presentation-items.json` | `drl.semantic-item-names`; canonical QWord UID string, prototype ID, base English and guarded transitions |
| `DRLClearSemanticHistory`, `DRLSaveSemanticHistory`, `DRLLoadSemanticHistory` | `/user/drl.presentation-history.json` | `drl.semantic-history`; canonical positive Int64 index string, ID/template, exact original English guard and original typed params |

History root fields are exactly `schema`, `format`, `records`; record fields are `index`, `id`, `english`, `originalEnglish`, `params`; parameter fields are `name`, `kind`, `value`. Kinds are `string`/`integer`; values are strings. Limits: 4,096 records, 16 params, 32,768 text bytes, 1 MiB per JSON file. `semanticHistorySidecarSchema` in `history-presentation.mjs` specifies this contract. Generated `drlsemantichistorycatalog` installs a validator and pure presentation projector.

The overlay installs read-only `DRLSemanticHistorySource(index,outEnglish)` and `DRLSemanticHistoryCurrentSource(outIndex,outEnglish)` over actual `player.__props.history`. `ui.remember_semantic_history` captures after unchanged append; `ui.presentation_history` checks the exact original entry before replay. No additional hooks or RNG calls are introduced.

Parent owns browser-only native save/load/reset wires. Close original game save first, write all sidecars before destructive level clearing and the existing final save witness, then load metadata only after successful non-crash native restore. Clear at reset/new player/load entry; retain item records on floor transitions. Each save failure has a Japanese diagnostic stating the original game was saved. Never use `Level.WriteToStream` as a purity probe: original serialization mutates its level ID.

## Checks and remaining scope

`verification.json`/`tests-output/` record **63 passing Node tests, 53 feeling oracle checks and 36 item-name oracle checks**. Checks cover original English/source roundtrips, hash/offset mutations, deterministic generation, typed placeholders/controls, exact Int64/QWord values, getter/RNG preservation, eleven lexical units, registry/help guards and audit inclusion. All 39 emitted Pascal units have zero duplicate interface/implementation imports. History additionally proves 1,050 EN/JA renders, 148 English reconstructions, 34 overlay reversals, three source mutations and 83 offset mutations. These are source/Node proofs, **not execution of Pascal sidecars or the original game**.

[Native fixture instructions](native-probes.md) describe five harnesses that link the actual Pascal units, their pinned compiler/package dependencies and isolated file paths. The parent ran **22 semantic, 46 corrected JSON, 90 feeling, 174 item-name and 363 history checks successfully**, including 43 rejected history loads. `native-execution-evidence.json` and `verification.json` record checked artifact hashes and scopes; `record-native-evidence.mjs` reproducibly reconciles the existing results without executing native code. The original pre-fix JSON diagnostic showing 13 failures remains unchanged. Complete original-game/browser integration remains a separate gate.

`text-dispositions.json` accounts for 13,759 literals, 5,009 document lines, 753 dynamic producer candidates and 72 previously unrecognized files. Covered source regions do not imply every contained literal was translated. Explicit role review proves 3,074 key/identity/path/schema/glyph/layout roles across 142 files and resolves 332 UI/fragment discovery false positives. **544 visible/composed and 5,949 unknown literal candidates, plus 659 dynamic producers, remain pending.** All source hashes/offsets remain reviewable.

Concrete gaps: five English message-color match patterns need semantic event styling; some typed Lua item nouns still use prototype guards after item renames; arbitrary deeper historical item aspect chains need immutable captured provenance; custom hooks/modules, unresolved roles, native platform/error paths and actual local PC/mobile browser full-game/save/resume tests remain. Finite history item projection falls back to English for unmatched/deeper/custom chains.

`unrecognized-files-audit.json` classifies all 72 files with bytes/hashes/source consumers: 15 text, 40 PNG, four ELF64, seven PE32+, two BMP, three ICO and one Win32 resource. None is in the current raw-console browser asset allowlist. All 32 original DRL graphics PNGs have WAD/source evidence; painted/opaque text uncertainty remains, with no blanket OCR absence claim. Three visual reviews confirm original branding/signature material; native resource has no string table. No asset translations are claimed.

Source overlay/translations follow original GPL-2.0 obligations. Historical notices/audio attribution are preserved and create no new distribution rights. No proprietary audio/native binary payload is added here. Full localization, native runtime contracts and actual local browser verification remain necessary before marking the requested local game complete.
