# Retained ToME C/Lua migration

**The four-layer migration is incomplete.** The actual original game boots in Chrome, creates a Cornac/Berserker in Trollmire, and saves and reloads its original Game/World archives. Original C/Lua gameplay remains in `../upstream`. Rust owns the tested display projections, input and platform boundaries. The Rust calculation/SFMT modules are separate source-derived characterization fixtures.

Start the actual local application from this `port` directory:

```powershell
node kernel/bootstrap/run-local.mjs
```

It serves `http://127.0.0.1:4187/play-browser.html` with Japanese by default. The save action uses the original serializer and IndexedDB; the resume link starts a fresh document and restores the saved Japanese setting. Modes `save`, `ui`, `semantic`, `original`, and `retained` select diagnostic surfaces with `--mode`. Original media stream from `../upstream` through an 8 MiB range cache, without a second asset archive. This deliverable is local HTML + Node with actual browser verification. No external Site was created or deployed.

The retained build compiles all 127 original C/C++ translation units and bundled dependencies, and links the actual original engine to WebAssembly. Compound SFMT/Gaussian/libc replay checks pass 435,171 assertions. A further 90,630 actual original-Lua assertions verify gameplay/visual bank independence, both-bank continuation, atomic corruption rejection and reentry guards. Named banks are not activated in the production bootstrap yet. Real birth reached level 1, HP 132 and the original 65×40 map. The baseline original renderer draws real assets. Actual full Game/World saves pass 24 browser checks, including durable IndexedDB reload, all 565 ZIP-member CRCs, corruption/version rejection and matching state/ticks/full RNG for two subsequent commands. One genuine original popup passes 50 Rust/PC/mobile checks. Complete campaign, pure Rust map rendering and all dialogs remain unfinished. Execution proceeds as one measured job at a time.

`retained/` contains the production Rust input, display and environment workspace. It consumes copied observations and delegates commands to the actual C/Lua engine. Its Rust crates contain no gameplay rules or RNG. Original fields and virtual commands are mapped in its README.

`localization/` contains 24,826 semantic English/Japanese IDs, original-I18N contract guards and 479 reviewed Japanese supplements. Actual Japanese birth/font/CJK/external-name/text routing passes 16 browser checks. The observed 977 unmapped input identities include 953 already localized Japanese inputs and 24 English labels; complete runtime text coverage remains unfinished. The retained Rust source passes 22 tests and Clippy with warnings denied; release WASM and three JavaScript ABI/session contracts are verified. Current served-artifact hashes and resource evidence are recorded with each browser scenario.

The combined Japanese application passes 47 genuine save/resume checks: two original durable generations, independent Game/World ZIP CRC validation, the real Japanese font, external player name protection, exact 2,588-byte RNG restoration, and two matching post-frame command continuations. This evidence covers the finite bridge observation, with only original loaded Entity UID remapping normalized. It does not establish whole-graph equivalence or complete campaign compatibility.

The older root Cargo workspace, `web/` and reference distributions demonstrate original Lua/C scalar methods and reference-state saves. They cannot boot the campaign or accept native ToME saves; the local command above selects the actual retained engine.

The original-language scalar probe can be regenerated with `reference/lua/build_replay.py`; it reads the acquired official source under `../upstream/t-engine4-src-1.7.6` and the existing Emscripten SDK. The retained native build plan and measured compile/link evidence are under `kernel/`. Original Lua, Combat source and GPL/BSD notices must accompany distribution. See [architecture](docs/ARCHITECTURE.md) and [remaining migration gates](docs/MIGRATION.md).
