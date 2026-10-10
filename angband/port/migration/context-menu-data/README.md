# Context menus: source integration

The original Angband 4.2.6 context and Enter menu paths are preserved. The new source annotations observe the original row construction and native visible-row callback; they never choose or execute a gameplay command.

The reviewed catalog contains 218 IDs: 70 mouse context-label forms, 122 possible command rows (121 in the standard build and one optional Borg row), 16 command-list name fields, and 10 prompt/composition/status entries. Six command-list names are visible root categories. The remaining ten are internal nested-list identities and are retained unchanged by the original lookup path; their catalog entries do not imply additional native rows are displayed. Nine debug category rows and every nested debug command are covered by the command-row mappings.

`source-manifest.json` supplies `entries` with English, reviewed Japanese, typed parameters, and exact producer references. `command-bindings.inc` maps the original command arrays by list pointer identity and array ordinal. It does not compare runtime English text, invoke prerequisites, or select commands.

`native-parity.mjs` exports `reconstructContext()` for composed source verification. All 187 explicitly marked fragments reconstruct `producer-snapshot.c` byte-for-byte. After removing that snapshot's existing static-message annotations and accounting for its pre-existing Windows CRLF, the result is the pinned upstream `ui-context.c`; the upstream snapshot SHA-256 is `19fdca516d09963f38e412c101cd7c7dee825fdd0a997cd97abceeac9c7f87d8`.

## Shared integration

- Register `logic/web-context-menu.c` in the existing C adapter build and merge this manifest's entries into the reviewed EN/JA/schema catalogs. No new FFI exports are required.
- Register `context-menu.0` through `context-menu.7` and the `context-floor` prompt scope. The existing `ab_if_menu_bind()` and projector API own begin/replace/end/reset events.
- `__context_row:<oid>` is a control with exactly 12 parameters: integer `x`, `y`, `valid`, `depth`, `flags`, `count`, `top`, `col`, `row`, `width`, `page_rows`, and boolean `cursor`. `x=active.col`; `y=active.row+oid-top`. Coordinates are emitted only for the native visible view and fit 0..255. The assigned menus use the scrolling skin without filters.
- Original validity values are invalid=0, valid=1, hidden=2. Hidden rows never reach the existing visible-row callback. Only valid rows should receive a browser action. Reuse `__row:<oid>` selection/key/color metadata, and enqueue a single original mouse event (`button=1`, `mods=0`) at the owned coordinates. Do not run commands, confirmation hooks, object allowances, or nested-menu callbacks directly from the browser.
- Preserve native flags, including `MN_DBL_TAP=16` and `MN_NO_ACTION=32`. The native menu controller determines whether a click moves the cursor, selects a row, or is consumed. The root command menu and recursive nested menus still use their private original callbacks and escape policy.
- Scope owners close before the original dynamic menu free or command-menu return. They clear the corresponding scope, release owned naming JSON, and remove the transient menu identity. Native parent menu refresh restores the parent's semantic rows after a child escapes. Original command confirmation, inventory capacity, charges, inscription allowance, shop/stash mapping, and Drop All behavior are unchanged.
- Enter rows copy `keypress_to_readable()` output after the single original formatting call and project it after the original row callback finishes. The alternate mouse command list copies the original two-byte shortcut while constructing the native row. Shortcut text is an opaque display token; label text is a semantic reference.
- Named cave/object headers copy the just-produced original naming snapshot. Terrain headers reuse `ab_look_selected_feature_id()` and `ab_look_selected_feature_prefix_id()` immediately after `square_apparent_name()`, composing the existing `angband.look.subject.terrain` descriptor. No second square query or descriptor call is added.

## Validation

`node --test tests/context-menu.test.mjs` passes 13 source/parameter/ownership/policy tests; the independent mouse adapter suite passes 7 tests. Prior two-file Emscripten syntax checks passed for both browser and original native preprocessor branches at the exact pre-mapping hashes recorded in `source-evidence.json`. The current observer revision and its source checks are recorded in `shortcut-contract.json`; matching compiler and integrated browser checks remain with the parent before runtime coverage can be marked complete.
## Native shortcut token contract

`shortcut-contract.json` records the scoped `context.command.row` / `shortcut` contract and exact current source hashes. The wrapper is a literal ` (` plus a nonempty source-selected key token plus `)`, bounded to 18 UTF-8 bytes by Enter's original 16-byte readable-key buffer. Its reachable grammar is one printable ASCII byte, a caret followed by one of `@adefgloprstvwxz`, or the unbracketed named token `Tab`. `UN_KTRL(0)` is `@`, so the mouse list's zero-key placeholder is `^@`; Enter omits a zero-key shortcut. All other `display_token` parameters retain their narrow existing validation.

The rogue mouse list's Fire-nearest key is the native byte `KC_TAB=0x9d`, which is not standalone UTF-8. The owned observer now maps only that exact one-byte key to `Tab` before constructing JSON. This uses the selected numeric key identity and the same readable token used by Enter. It leaves original terminal rendering and command input intact and adds no key lookup, formatting call, gameplay query or RNG call. The new source contract test executes the exact observer predicate with native byte arrays, rejects broader matching, and verifies native reconstruction and source hashes.

The earlier two-branch syntax evidence in `source-evidence.json` predates this observer-only mapping; its helper hash remains explicit historical evidence. Compiler/browser verification of the new helper revision belongs to the parent's integrated checks.
