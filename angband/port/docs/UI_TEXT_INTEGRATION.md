# Angband UI text integration

The browser-only UI producers are source-connected to the reviewed semantic catalog. This is an incremental localization milestone, not a complete Angband translation or evidence that every producer has run in a browser. The pinned source is Angband 4.2.6, commit `f3082213b73f3e463e3d0d60bff4b00462beae6e`.

`logic/web-ui-text.[ch]` captures semantic presentation facts from the existing UI producers in `ui-birth.c`, `ui-player.c`, `ui-display.c`, `ui-input.c`, and `ui-options.c`. Each original file contains removable `AB_UI_PURE` Emscripten blocks. The original milestone had 236 pure blocks; four additional history provenance hooks now bring that UI total to 240. Native reconstruction removes those blocks and the separately reviewed root/interface wrappers, restoring all five accepted files byte-for-byte, including the accepted mixed line endings in `ui-display.c`. Original terminal English, terminal byte-column layout, command keys, domain/parser records, visibility predicates, calculations, and native control flow remain intact.

## Producer coverage

The ledger below counts distinct reviewed IDs appearing at authored producers or in a canonical domain-identity registry. Registry coverage is source evidence; it does not establish that every branch has been exercised at runtime.

| Reviewed category | IDs | Source-supported IDs |
| --- | ---: | ---: |
| Birth dynamic prompts and help | 15 | 15 |
| Birth option labels/actions/state | 28 | 28 |
| Character sheet used during birth | 65 | 65 |
| Birth static prompts/menu actions | 30 | 30 |
| Domain data display endpoints | 194 | 194 |
| Stat notation | 4 | 4 |
| Projection templates | 9 | 9 |
| Sidebar/topbar | 51 | 49 |
| Compact status | 17 | 17 |
| **Birth/sidebar review total** | **413** | **411** |
| Independently reviewed race/class/rank endpoints | **110** | **110** |

The two intentionally unused IDs are `ui.sidebar.speed.fast.label` and `ui.sidebar.speed.slow.label`. Producers emit the reviewed whole Fast/Slow templates with their original numeric delta or integer-tenths multiplier instead of emitting redundant English fragments. All IDs remain available in the catalog.

The 110 character endpoints are 11 race names, 9 class names and 90 level-rank titles. They bind to `ridx`, `cidx` and the original rank slot. The helper also maps 9 shape records, 4 realm identities, 25 terrain identities, 40 trap records to their 16 original visible-label aliases, 71 timed effect/grade records, 41 ordinary player/object properties, 25 element components, 3 generated element-property templates, 15 birth option enums, and the long/compact healthy/drained stat label variants. Normal shape is registered for completeness; the native title producer does not display it as a changed shape.

Trap aliases preserve the native generic label. No hidden trap identity is sent to the renderer. The level-feeling producer supplies only the existing visible restricted tokens (`?`, `*`, `$`, decimal 0 through 10); it does not expose hidden raw strength. Monster health bars, equippy glyphs and other language-neutral terminal graphics remain on the original canvas, with no extra monster HP or knowledge capture.

## Typed presentation boundary

The shared C serializer sends synchronous owned events to the Rust review formatter, then to the browser host:

```text
{schema_version: 1, id, params, channel: "ui", context, widget,
 severity: 0, sound: -1}
```

Parameters retain the exact reviewed schema type. `integer` and `signed_integer` carry JSON integers; Rust adds the original explicit plus sign for nonnegative signed values. `decimal_one_place` carries signed integer tenths, without floating point. A `localized_text` value contains a reviewed ID and optional nested typed parameters, never completed English. The one authored list style, `birth_realm_conjunction`, preserves the native visible realm order; English joins without an Oxford comma and Japanese joins with `、`. Stat notation uses typed original numbers; Rust applies the reviewed two-/three-digit minimum padding for values above 18.

Names and positively edited history are opaque strings escaped by the shared UTF-8 JSON writer. Canonical option keys remain unchanged ASCII domain identifiers. Dynamic values do not pass through global text substitution, English-string matching, extra book scans or repeated object/monster description functions. Temporary realm-list facts are copied synchronously before the original native list is freed. The host must copy the synchronous event/result before the serializer releases its buffer.

The bridge admits at most 16 top-level parameters and depth 4; authored calls use at most 3 formatter parameters, with shallow nested references. The shared serializer caps packets at 128 KiB. No Japanese text is inserted into a fixed C buffer. Browser Rust text and DOM layout carry Japanese reflow independently of the original ASCII terminal columns.

## UI lifetime

The owned contexts are `birth`, `birth-menu`, `birth-race-help`, `birth-class-help`, `birth-options`, `name-editor`, `history-editor`, `character`, `sidebar` and `status`. Widgets have stable slot identities, so repeat draws replace the same visible facts. Same-context nested drawing scopes reuse a batch. Scope controls have an empty semantic ID and bypass Rust formatting:

| Control | Meaning |
| --- | --- |
| `__begin_replace` / `__begin_patch` | Begin a bounded visible update |
| `__end` | Commit the pending update |
| `__reset` | End that visible context and discard stale widgets |
| `__clear:<slot>` | Clear a hidden or unavailable slot/group |
| `__value:<slot>` | Attach an original integer or signed-integer fact to its reviewed label |
| `__input:<slot>` | Show an untranslated opaque editing draft |
| `__unsupported:<slot>` | Clear a value whose semantic grammar/provenance is unavailable |

`ab_ui_scope_commit()` commits the pending batch while keeping the logical context active for live callbacks. Name editing commits before `askfor_aux_ext`; birth options commit before `menu_select`. Each ends and resets on completion or cancel. Other owned prompts/history/menu scopes finish their short draw batch before waiting for input. Leaving birth resets all birth/help/editor/character contexts. Priority-hidden sidebar groups and unavailable SP values clear stale slots.

## History and remaining coverage

Generated history is now source-connected through a separate [history-data milestone](../migration/history-data/README.md): 165 source fragments, 14 complete-statement grammars and one generated-history projection. Original C selection/text remain unchanged; versioned chart/cutoff provenance accompanies reroll, previous-roll and quickstart snapshots and a separate optional save block. The Rust grammar composes complete Japanese statements from captured source facts and preserves exact English concatenation. Compilation and browser execution remain parent-owned verification.

The initial `__input:history` is an untranslated editable draft, even for generated history; that control never invokes the formatter or proves authored origin. The character projection now uses authoritative, native-text-validated generated/authored/unknown provenance. Only a positive edit becomes opaque authored history; unchanged known provenance is preserved, and unknown old saves clear the translated profile value. The former UI-only edited flag no longer authorizes output. No completed English is passed as a generated descriptor.

The ordered realm grammar is now connected at source. Rich highlighted help spans and independently colored level-feeling tokens are not yet represented as structured spans in the reflow panel; the original terminal retains them. Full help/manual content, general option pages, character ability-browser descriptions, object/monster name grammars, other unrelated text producers remain outside this milestone. The reviewed data/parser identities and native names are unchanged. No claim is made that the entire game or all 413 reviewed IDs are runtime-localized.

## Validation

Run from `angband-port`:

```text
node --test tests/ui-semantic-integration.test.mjs
node migration/verify-review.mjs --check birth-and-sidebar.json
```

The final source-only run passed 9 of 9 tests. It verifies accepted native byte parity, no added RNG/domain writes/descriptor calls/hidden monster facts, all identity registries, all reviewed gamedata hashes, typed nested/list transport, blocking-input lifecycle, and validated generated/authored/unknown history provenance. The strict review verifier passed all 413 exact provenance entries and 110 independent character endpoints using hash-identified accepted C snapshots for historical line anchors.

Engine compilation, linking, Rust execution, browser desktop/mobile flow, actual Japanese layout, save/RNG equality and input/resume are parent-owned follow-up checks. The current user-authorized web scope is the local HTML/Node browser workflow; no external Site publishing occurs in this milestone. These source tests do not substitute for those checks. The parent has approved one measured, single-concurrency incremental engine/Rust-WASM build after the source freeze; build time should be measured on this Windows executor rather than inferred from the registry count.

The coordinating executor subsequently completed that build and real Chrome
acceptance: Japanese birth options commit before blocking input; an external
Japanese name survives editing; all five original stat rows and their signed
bonuses render in the reflow table; and original Mage spell names, descriptions,
level, mana and failure values appear in Japanese panels. Town and dungeon
continuations compared all 22 native save blocks and all 38 WELL words, and 20
cached redraw/locale operations preserved simulation state. The final engine
hash and current browser results in verification.json identify the tested
artifacts. This representative acceptance does not prove every reviewed UI
producer ran and does not complete the remaining original UI migration.
