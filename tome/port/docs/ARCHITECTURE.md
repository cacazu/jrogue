# ToME 1.7.6 incremental migration

The actual original game boots in Chrome and accepts native wait/movement. Original full Game/World saves and fresh-page deterministic continuation pass a baseline browser scenario. Japanese native text/font integration and one original Rust-projected dialog also pass actual PC/mobile scenarios. Full Rust presentation and whole-campaign coverage remain incremental work. Web delivery is HTML and local Node/browser verification; external publication is outside scope.

The user explicitly confirmed through the coordinating parent: gameplay remains in the original language; Rust separates display, input and environment adapters. The actual Page names these four layers: logic, display, platform, input. Original C/Lua remains the production gameplay core. The Rust scalar formulas/SFMT are isolated characterization fixtures for differential verification; they are not a replacement gameplay core or a commitment to rewriting ToME.

| Layer | Production implementation | Responsibility |
|---|---|---|
| Logic/domain | Original C/Lua under `../upstream`, compiled to native WASM through reviewed platform seams | Original actors, generation, energy/turns, combat, AI, talents, quests, graphs and serializers |
| Input/application | `retained/input` and copied protocol contracts | Physical keyboard/touch mapping and typed original command dispatch; no gameplay formulas |
| Display/presentation | `retained/display` and `localization` Rust crates | Immutable observations and semantic EN/JA IDs/parameters; complete map/dialog presentation remains pending |
| Platform | `retained/environment`, native C bindings and browser adapters | Single-flight transport, original runtime lifecycle, demand-read media and isolated browser storage/audio/input/graphics boundaries |

Dependencies flow inward. The Rust display crate receives only immutable domain references. Pure Rust projection/locale requests perform no original native calls and cannot advance simulation or consume its RNG. Original rendering and screenshot callbacks remain effectful baseline preparation until their ordered production separation is complete. External player names remain data and are never translated or interpreted as markup.

Actual PC/mobile tests prove zero native calls and unchanged original observation plus complete singleton RNG during pure Rust status/locale rendering. Original gameplay actions execute through the retained Lua driver's original KeyBind and tick loop. Original drawing remains an explicitly effectful comparison/preparation path.

Complete presentation needs ordered preparation followed by immutable Rust replay. Original map callbacks, native-tail FOV and particle cleanup are interleaved. Meteor cleanup changes damage, stun, terrain and RNG, so every original operation must retain its relative source slot. The audit and guarded seams are under `kernel/mechanics`.

Original archives use demand HTTP ranges and an 8 MiB cache. Graphics/music archives are neither preloaded nor copied for each layer. The runtime home is isolated from native originals. Actual full Game/World graph ZIPs and their versioned 2,588-byte singleton RNG sidecar commit together in one IDBFS generation before the native gate is released. Fresh-page loading preserves original World/Game/deferred-callback ordering and restores RNG after original settling. The successful baseline comparison normalizes only the original Entity UID remapping in its finite observation; it does not prove every campaign state or production render barrier.

The older root Cargo workspace and reference surface characterize scalar formulas/SFMT and sampled-state saves. They remain comparison fixtures. Production gameplay and native saves use the original C/Lua core.
