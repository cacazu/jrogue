# Bounded Rust browser WASM bridge

This module runs the existing `cdda-input` and `cdda-presentation` Rust crates in
an actual `wasm32-unknown-unknown` runtime. The original Cataclysm: DDA C++ engine
at `7b2efa5cea38e4d4d97dd0e63b28b9148623da59` remains authoritative for gameplay,
input contexts, user keybindings, save files, rendering, and RNG.

The implemented boundary covers eight touch directions, six gameplay helper
actions, confirm/cancel in supported UI contexts, observed source-backed JOY
bindings, all 27 existing browser shell messages, and 29 static contract labels
and errors. Japanese is the default. English/Japanese strings and parameters
come from JSON; Rust performs strict semantic formatting. Unicode external text
is passed as validated scalar values, preserved verbatim, and returned as plain
UTF-8 text. The host must display it with `textContent`.

This is a bounded integration component. It does not port the game's map UI,
its complete localization catalog, settings, dialogs, or gameplay to Rust.
Runtime verification here uses Node WebAssembly. Full-engine browser and mobile
validation must be performed by the owning browser integration task.

Run `powershell -NoProfile -File .\verify.ps1` in this directory. It uses only
cached Cargo dependencies, offline/locked builds, and one compiler job. The
script measures owned build process working sets and host free RAM. Then run
`node package-dist.mjs` to stage the verified WASM, host module, manifest, and
license notices under `dist/` for the original browser package.

The source catalog conversion is reproducible through `prepare-catalogs.mjs`.
It preserves the exact current baseline shell strings, assigns typed count and
external-text parameters, verifies en/ja parity, and records source hashes.
`contract.item_summary` is excluded because it is an unrelated contract fixture.
The compiled semantic ID list is independently compared against the host JSON
manifest before the bridge is made available.

The retained C++ engine receives native keyboard events through its existing
SDL path. `resolveHelperKey` must only be used for helper buttons. Physical
keyboard events, IME composition, and the text-input form remain native input;
in particular, usernames and uppercase/lowercase characters are never mapped
through a gameplay table. Unsupported helpers return the original key with an
explicit `original-cpp-native-key` marker.

The baseline currently has no authoritative engine context export. Passing
`menu` for its existing helpers is conservative: arrow/confirm/cancel mappings
are resolved by Rust, and the period/Tab helpers retain their existing native
key behavior. Actual contexts must be supplied by the original engine before
claiming context-aware gameplay or gamepad integration. User keybinding overrides
also remain the original engine's responsibility: this bridge emits observed
stable default keys, rather than bypassing overrides by injecting actions.

See [INTEGRATION.md](INTEGRATION.md) for precise hooks and [ABI.md](ABI.md) for
the scalar ABI and pointer lifetime audit. No original source, existing contract
crate, baseline shell, Site, or Git index is changed by this component.
