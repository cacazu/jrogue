# Movement help semantic slice — source preparation

This folder prepares the exact **14 textual entries and one structured direction
grid** selected in `docs/SEMANTIC-TEXT-INTEGRATION.md`, against official CDDA
**0.I-1**, commit `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`.
It is **uncompiled and unconnected**. The original C++ help/keybinding rendering
still uses gettext. This folder does not establish fourteen migrated runtime
consumers, complete game translation, or completed browser gameplay.

`locales/en.json` and `locales/ja.json` use the actual existing Rust
`Catalog::from_json` schema, with no extra provenance fields. All fourteen
entries have empty scalar `parameters`; five native `<press_ACTION>` references
are preserved exactly as catalog-owned content tokens. They are converted into
explicit **KeyBinding** nodes by `text-programs.json`, with separate named typed
observations. They never enter `ParameterValue::UserText`, and the existing
scalar formatter is not presented as a key-name or rich-text renderer.

The Japanese strings are copied byte-for-byte from the current MO and checked
against the existing independent GNU `msgunfmt` PO. MO SHA-256 is
`336dc66ccd4d1e828832a38756cddcc165e0f1af917f546752b5655ff02705e7`.
No PO/MO compilation, extraction, original translation changes, or global
English-string replacements were performed.

The seven keybinding IDs distinguish `default/UP`, `PICKUP/UP`, `BIONICS/UP`,
and `DEFAULTMODE/{pause,pickup,inventory,help}`. The Movement topic has six text
IDs: its name plus controls, movement cost, melee, doors and safe-mode prose.
`ui.help.title` binds both original C++ title callsites. JSON array pointers in
`registry.json` are provenance, not public identity. The direction sentinel has
**no invented semantic text ID**.

## Prepared C++ producer overlay

`help-semantic-overlay.patch` modifies six original files in an isolated
preparation and adds three C++ files. It has not been applied to the pristine
source, active link, port copy, or existing bridge.

- `input_manager::load` attaches an optional name ID only for the exact reviewed
  official file/category/action/raw-name owner. User-supplied replacement names
  clear the metadata; nameless binding preferences retain the native name.
- `get_semantic_action_name` preserves explicit overrides, **basic** name tables,
  local empty-name fallback, native missing-basic fallback to the **current**
  default name, and final literal action ID. All lookup uses `find`; it does not
  synthesize missing native entries or call translation.
- `observe_semantic_bindings` observes the **current** key tables. A present
  local action wins even when its binding vector is empty. It copies exact
  event type, modifier order, signed key sequence, text/edit and edit-refresh.
  Presentation flags are held separately from that native metadata.
- The help loader receives the real file path through the existing
  four-argument `DynamicDataLoader::add` route. Default unknown paths preserve
  older two-argument direct calls as legacy. The Movement metadata requires the
  exact owner file and untranslated translation-object values. Original
  topic/mod ordering and duplicate-order checks remain in C++.
- Original name and selected-help consumers emit owned observations before
  their existing gettext rendering. Selected help is published only in its
  scope and cleared on exit. The original navigation/scrolling branch remains
  active.

These are **observer hooks**, not a replacement of the native UI. The sink
callbacks are internal C++ source interfaces with borrowed callback lifetime;
a future host must copy records immediately. There is no JSON serializer,
pin/export integration, Asyncify delivery, or actual Rust invocation in this
patch. The integration build must define the exact
`CDDA_BROWSER_INPUT_SNAPSHOT_BUILD_ID` string.

The separate `integration-overlay/live-input-snapshot.patch` also changes
`input_context.cpp`. Both patches are independently pinned to pristine source;
they require a coordinated merge in a complete isolated source copy. This slice
also changes headers, so all affected header dependencies must be rebuilt using
their matching sibling headers. Reusing original objects or supplying a lone
`-I` overlay is insufficient.

## Immutable direction and text data

The grid preserves the original nine `movearray` positions, two alternatives
per cell, exact ASCII connector/newline layout, native `DEFAULTMODE` bindings,
and missing-key `?`/red styling. C++ selects the first two **enabled keyboard**
bindings with one printable code and no modifiers, in native binding order.
Rust does not infer arrow-key/gamepad glyphs, rotate world/isometric directions,
or collapse character codes into physical key codes.

`rust/` contains a source-only owned observation parser and pure presentation
consumer using the real existing Rust catalog parser. It validates source,
build, schema, publication, bounds, semantic roles, native IDs and typed key
dependencies. It emits Japanese/English prose plus typed pending key-name
nodes and immutable grid cells. **Native short/long key-description rendering
and the localized binding separator remain pending**; the output explicitly
sets `key_name_renderer_pending: true`. External/user-provided text is never
parsed as these template programs.

No observed binding authorizes a command. Direct SDL/ImGui/native readers
bypassing `input_context::handle_input` remain untracked. This selected-topic
family is separate from the live-context snapshot and cannot resolve that
coverage gap. No new producer/consumer calls game input, advances a turn,
queries gameplay RNG, chooses snippets, or loads/saves world state. Actual
whole-engine render/RNG purity still needs measurement, including the known
native weather/input-wait RNG path.

## Checks and remaining local acceptance

Run the small source preparation and validation with an explicit pristine root:

```powershell
node help-semantic-slice/prepare.mjs <PRISTINE_UPSTREAM_ROOT>
node help-semantic-slice/generate-overlay.mjs <PRISTINE_UPSTREAM_ROOT>
node help-semantic-slice/validate.mjs <PRISTINE_UPSTREAM_ROOT>
```

`SOURCE-CHECKS.json` reports exact source/text/schema/token bindings, GNU-verified
Japanese parity, direction/action/layout policy, and byte-exact in-memory
forward/reverse patch checks. Small policy fixtures exercise local-empty
bindings, basic/current name distinctions, missing/default fallback and the
distinct `.` pause, `|` wait and uppercase `S` save bindings. These are Node
**source-preparation checks**, not native C++ execution or Rust acceptance.

Remaining work is concrete:

1. Compile the coordinated isolated C++ overlay and this Rust crate; exercise
   original loaders/name consumers with preferences, overrides, reload and mods.
2. Implement the bounded typed JSON transport and host ownership rules, connect
   the real selected help/keybinding consumers to Rust, and implement native
   key-description/long-binding separator semantics in the chosen locale.
3. Differentially compare original English and Rust English on real loaded
   records, including bound/unbound keys and exact direction-grid formatting.
4. In the full local browser game, open Movement help/keybindings, edit keys,
   return from nested UI, switch locale, scroll/resize, and inspect Japanese
   CJK layout on desktop and mobile viewports. Record actual turn/RNG invariance
   and native save/resume behavior. No such browser test has run for this slice.

Local full-game completion remains the goal. This folder performs no Sites
creation, deployment or hosting operation.
