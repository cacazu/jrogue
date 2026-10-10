# Cataclysm: DDA Rust boundary milestone

This is an implemented, tested boundary milestone for the retained original C++ game. It is not a complete Rust port, a playable game, a browser frontend, or a published Site.

The verified plan maps the four layers to **logic / presentation / platform / input**. The complete original C++ game retains all gameplay rules and RNG. Rust is limited to presentation, platform, input, and typed boundary data. This workspace supplies separate, acyclic Rust crates for the boundary:

| Crate | Implemented responsibility | Dependency |
| --- | --- | --- |
| `cdda-logic-contract` | Typed source-backed commands, immutable observations, semantic text IDs and parameters, an unimplemented `EngineBridge` trait | serde, thiserror |
| `cdda-input` | Pure keyboard, typed touch and calibrated gamepad conversion; current-context routing and IME commit segments | logic contract |
| `cdda-presentation` | Immutable plain-text frames; strict named typed English/Japanese JSON formatting | logic contract |
| `cdda-platform` | Versioned opaque original-save/RNG envelope, source/ABI/build identity, SHA-256 validation and explicit limits | logic contract; input/presentation only in tests |

There is no simulation implementation, RNG generator, clock, browser object or operating-system I/O in these crates. Only an eventual `EngineBridge::apply` implementation may advance the retained game. Input and rendering accept no engine handle. The platform snapshot carries original bytes rather than inventing a simplified Rust world.

## Original source and license

Official upstream: [CleverRaven/Cataclysm-DDA](https://github.com/CleverRaven/Cataclysm-DDA/tree/7b2efa5cea38e4d4d97dd0e63b28b9148623da59), stable **0.I-1 (Ito-1)**, exact commit `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`.

The pristine source supplied by the coordinating agent is under:

`C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\upstream\Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59`

Three complete upstream files were copied byte-for-byte for reproducible contract checks:

| File | SHA-256 |
| --- | --- |
| `fixtures/keybindings.json` | `5b55b23960b42f52249398254a7557303a0987ce6a7f5a23f0f39ef1e00be3b3` |
| `fixtures/action.cpp` | `dad9b0a62e0f08aa2cdcf72d81f600a608ee248a6013c8c8ff974af0fbe14f99` |
| `fixtures/input.h` | `56d8db0e9fdf18c07620ddf23fb690bca05fed8f5d4ef3218ed5678174e58416` |

The original CDDA contributors retain attribution. The copied fixture files are unmodified, and new files in this milestone use the same **Creative Commons Attribution-ShareAlike 3.0 Unported** license. See `LICENSE-UPSTREAM.txt`. No font, tileset, audio, proprietary assets or installer is bundled in this milestone. Cargo dependency license declarations are recorded in `verification/dependency-licenses.json`; their upstream licenses remain applicable.

## Supported input

Eight movement directions use the exact `action_ident` identifiers (`UP`, `RIGHTUP`, `RIGHT`, `RIGHTDOWN`, `DOWN`, `LEFTDOWN`, `LEFT`, `LEFTUP`). The original C++ engine still owns isometric/map orientation and all movement rules.

The current bounded game actions are **move, pause, wait minutes, inventory, examine, pickup, save and quit**. Pause (`.` / `5`) is distinct from long wait (`|`). Save-and-quit requires uppercase `S`; lowercase `s` is not aliased to it. The source has no default quicksave binding, so none is fabricated. Menu navigation, confirm and cancel are distinct UI commands. In name-entry mode, `q`, `Q`, Japanese characters and committed IME strings remain user text.

Bindings are loaded from the actual stable JSON, with category-specific entries selected before global entries. Scalar keys and singleton key arrays are supported; multi-key sequences are rejected explicitly. Only the bounded actions are dispatched. Touch controls resolve to existing upstream action types. Gamepad input uses observed JOY IDs and assumes the host has calibrated the physical device. No gamepad confirm/cancel button is invented where the default source has no binding.

Browser automatic repeats and in-progress IME composition are filtered; the eventual host must supply repeat timing and commit/edit events. This workspace does not implement the upstream preference/override loader, every upstream UI category, text-caret editing, all CDDA actions, or actual DOM/gamepad polling.

## Semantic texts

Both `locales/en.json` and `locales/ja.json` cover **30 contract IDs**, including action labels and user-facing save/text errors. IDs are human-readable semantic names such as `command.inventory` and `save.error.version`, independent of English prose, file lines or hashes. Japanese is the default.

`TextEvent` carries an ID plus named, typed parameters: user text, count, or a localized term ID/count. The formatter checks exact parameter names/types and template placeholders. It substitutes each value once, preserves external usernames verbatim and never reinterprets inserted text as a template. English term singular/plural forms and Japanese count-invariant terms are tested. The bottle/item-summary catalog entries are explicit formatter fixtures, not invented game mechanics.

Frames are plain text and must be attached to browser **text nodes/textContent**, never interpreted as HTML. Rendering only borrows the immutable observation and catalog. The contract includes no map renderer or CJK layout measurements.

Coverage is complete only for this bounded 30-ID contract catalog. The upstream game text inventory, dynamic item names, grammatical variants, every help/error/settings screen and the full upstream Japanese PO catalog are not migrated by this milestone.

## Save contract

Envelope version 1 binds the exact source commit, `cdda-browser-contract/1` port ABI, engine-build identity, RNG-serializer ABI and command-complete capture boundary. It wraps opaque original save bytes, semantic observations and an opaque RNG snapshot.

Stable `src/rng.cpp` contains six static standard-library distribution instances: unsigned integer, integer, real, normal, exponential and chi-squared. The coordinated C++ RNG adapter captures one opaque capsule containing seven named length-delimited sections: engine plus all six distributions. In particular, cached normal/chi-squared variates cannot be replaced by an engine seed.

Rust wraps the complete capsule unchanged and checks its presence, size, serializer/build identity and checksum. The original C++ capsule decoder remains authoritative for inner schema/source/compiler/libc++ identity, required-section validity and transactional restoration. There is no split Rust restore or double serialization of RNG internals. The bridge must still compare capture/restore against original-game reference runs. The format is pinned to a specific build/serializer identity to avoid claiming cross-standard-library portability.

SHA-256 covers all envelope identity, boundary, state, RNG and observation data. Size limits and unsupported schema/version/source/ABI/build/checksum/boundary/incomplete-RNG cases are rejected before bytes are exposed for restoration. The checksum detects corruption; it is not an authenticity signature. The C++ bridge must additionally validate original save semantics.

No connection to the upstream capture/restore hook, IndexedDB adapter, replay engine or native-save compatibility is implemented in these Rust crates. Tests deliberately use marked opaque fixture bytes. They prove wrapper preservation and contract purity, not deterministic execution or faithful resume of the full original game.

## Verification and next integration step

Run the serial checks using installed tools and cached pinned dependencies:

```powershell
powershell -NoProfile -File .\verify.ps1
```

The script uses one compilation job, runs formatting, clippy, native tests and a `wasm32-unknown-unknown` compile check, and records command exit codes, test counts, licenses and source hashes under `verification/`. Native tests cover all supported source bindings, context and case distinctions, deterministic input transcripts, named placeholder/type parity, user-text preservation, language plurals, repeated read-only rendering, unchanged opaque RNG/save bytes, and save rejection paths.

A WASM compile check establishes target compatibility only; there is no JavaScript export adapter, browser execution or live game integration. Before a playable publication, connect the actual upstream C++ command/observation/text/save hooks, implement storage/input/rendering adapters, migrate the complete semantic catalogs, and compare original state/RNG/transcripts across real PC/mobile game flows and save/resume. No Site, Git index, commit or shared-root file was written by this task.
