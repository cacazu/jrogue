# DRL local HTML and Node workflow

The original Pascal/Lua game runs in a real browser through the local Node workflow. The current primary gate passed **15 checks**, including Japanese default, seeded creation, PC/mobile input, native targeting/fire/reload/settings/save/Continue and same-open/scrolled Help locale refresh. A separate **six-check combat/autorun gate** verifies observed doors/hostile combat and physical Escape cancellation at native RunDelay 0. Complete campaign, translation and full-world verification remain pending. Authenticated clean reconstruction passed using the recorded standard prerequisites: the core is byte-identical, and the Rust diagnostic-path difference is audited and browser-tested. The clarified delivery is local HTML and Node/browser verification; external deployment is outside scope.

This document records the **2026-10-02 22:35–22:36 UTC** primary and **22:45–22:46 UTC** combat/autorun checkpoints. [Original-game evidence](../port/tests/output/original-game/evidence.json) captures the actual fetched artifact hashes and 97 packaged assets:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `port/dist/drl-core.wasm` | 6,065,580 | `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60` |
| `port/dist/drl_web_port.wasm` | 1,665,915 | `54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e` |

The [full-core link receipt](../core-adapted/build/browser-core/link-evidence.json) records 139 compiler-used source records, validated imports and unchanged source/archive inputs. The [measured compiler job](../core-adapted/build/browser-core/memory-evidence.json) peaked at 692,613,120 bytes of committed memory; the [browser job](../port/tests/output/original-game-memory.json) peaked at 495,321,088 bytes. Neither receipt establishes full campaign coverage or a clean source-bundle reconstruction.

## Start the current local game

Run from the DRL task root, or from the corresponding restored DRL tree containing the prepared `port/dist` artifacts:

```powershell
node port/web/server.mjs
```

Open **http://127.0.0.1:4189/game.html**. The server binds loopback and serves `port/dist`; `/` also selects `game.html`. Set `DRL_PORT` before starting if another local port is needed. `index.html` is a byte-identical alias of the verified original-engine HTML.

The automated original-game suite starts its own bounded Node server and one installed Chrome instance:

```powershell
node port/tests/original-game-browser.mjs
```

It rejects laboratory artifacts and records the core, Rust and asset hashes used by that run. Its 15 passing checks cover invalid seed rejection; seed 5489, easiest difficulty, Marine/Ironman and the exact external name `BrowserMarine_5489`; 50 replay draws plus font/viewport/EN-JA changes preserving bounded DRLP fields and all 624 MT words; inventory/equipment/help plus same-open/scrolled Help body/title/fixed-key JA → EN → JA on later native frames; committed settings; physical movement/wait; manual targeting/cancel/fire/reload; 390-pixel mobile touch, scrolling, fit and 200% UI font; original Save & Quit; fresh-page Continue with consumed-save deletion; and two identical command continuations from fresh native-save loads. Browser exceptions and recorded localization findings were empty for these exercised paths.

The pistol check observed magazine `6/6 → 5/6 → 6/6` and reserve `40 → 40 → 39`. That primary check fired at an empty tile. The separate encounter receipt records player damage, named hostile hit/death, increased XP and fresh native Look at a visible corpse; exact enemy UID/HP and player-kill attribution remain unverified. DRLP is a bounded diagnostic, not a full world fingerprint. The actual original intro callback now writes `history.intro.journey` with its unchanged English guard; the exact ledger survives native Exit and fresh Continue. Snapshot version 2 preserves file/root timestamps and their metadata checksums; version 1 snapshots migrate to zero timestamps. Same-open Help refresh and zero-delay keyboard autorun interruption now pass; other cached views, chain-fire/controller interruption, win/campaign flows and wider death/rank branches, wider mechanics and complete translation remain separate gates. See [test coverage](ORIGINAL-GAME-TESTS.md), [flow audit](ORIGINAL-GAME-FLOW-AUDIT.md) and [state coverage](STATE-PROBE-COVERAGE.md).

## Rebuild the pinned artifacts

Node, the recorded official FPC compiler/RTL, LLVM/WASI inputs, Rust 1.98.1 and the installed `wasm32-unknown-unknown` target are required. `DRL_LLVM_BIN` selects compatible LLVM tools; the current default is the user's `emsdk/upstream/bin`. Preserve the source/license manifests. These commands use the acquired toolchains and need no installer, external deployment or new credentials.

Run source preparation first:

```powershell
node tools/integrate-locales.mjs
node tools/sync-game-credit.mjs
node tools/adapt-core.mjs
node tools/test-core-overlay.mjs
node tools/build-browser-core.mjs --plan
```

The current preparation receipt checks all 353 generated files and 131 recorded platform transformations against the preserved sources and guarded semantic patches. The Help/config/getter changes are compiled in the current core; any later source changes need new preparation/compile/browser receipts. The native source tree stays unchanged. The canonical catalogs contain 3,692 matching English/Japanese IDs; that count does not close the remaining text audit.

Compile and verify serially, with the existing Lua bridge/archive inputs retained:

```powershell
Push-Location port
try {
  cargo fmt --manifest-path Cargo.toml --check
  cargo clippy --manifest-path Cargo.toml --offline --locked --all-targets -j 1 -- -D warnings
  cargo test --manifest-path Cargo.toml --offline --locked -j 1
  cargo build --manifest-path Cargo.toml --offline --locked --release --target wasm32-unknown-unknown -j 1
} finally {
  Pop-Location
}
Copy-Item -LiteralPath port/target/wasm32-unknown-unknown/release/drl_web_port.wasm -Destination port/dist/drl_web_port.wasm -Force
node tools/build-browser-core.mjs --build
Copy-Item -LiteralPath core-adapted/build/browser-core/drl-core.wasm -Destination port/dist/drl-core.wasm -Force
node tools/prepare-core-dist.mjs
node port/tests/original-game-browser.mjs
```

Cargo runs from `port` so it discovers restored `port/.cargo/config.toml` and its `../vendor` directory; using only `--manifest-path` from the task root does not establish that discovery. The current build wrapper follows this directory rule.

The current Rust test job passed **120 tests** with the current catalogs, and the current Rust WASM build passed. [Test log](../port/tests/output/current-rust-tests-memory.json.stdout.log) and [WASM build receipt](../port/tests/output/current-wasm-memory.json) record those runs. Strict Clippy and rustfmt passed for the updated Rust timestamp source. The [timestamp evidence](PLATFORM-TIMESTAMP-EVIDENCE.json) records 37 passing host/storage checks and one separately skipped Chrome capability fixture. Rebuilt artifacts require a new matching browser receipt; do not reuse the hashes above as evidence for a later build. `port/build.ps1` now delegates to the original-engine build workflow; `port/start.ps1` starts Node. The source archive remains a separate verified packaging step.

For measured heavy jobs, the existing helper records Windows JobObject peak commit, descendant processes and sampled headroom:

```powershell
.\tools\measure-job.ps1 -Executable (Get-Command node.exe).Source `
  -JobArguments @('port/tests/original-game-browser.mjs') `
  -Evidence 'port/tests/output/original-game-memory.json'
```

Run compiler, linker, Cargo and browser jobs one at a time under parent coordination.

## Supporting runtime probes

The authored host capability suite passed **27/27 checks** in installed Chrome 154, including JSPI continuation, mixed Lua/Pascal callbacks, real Rust VFS/C stdio and fresh-instance IndexedDB restore. [Host evidence](../port/tests/output/core-host-browser.json) belongs to its recorded earlier artifacts; it is supporting capability evidence rather than another 27 full-game checks. The current 15-check primary original-game run exercises production `drl_sleep` without experimental browser flags, SharedArrayBuffer or changed browser security settings.

The actual adapted VTIG geometry fixture passed translated CJK padding/clipping, color scopes, offset glyph extents, scrollbar and mouse-marker ordering. [Geometry evidence](core-geometry-runtime-evidence.json) pins its fixture core and earlier Rust adapter. Reproduce it separately:

```powershell
node tools/probe-core.mjs native-geometry
node tools/build-browser-core.mjs --plan --geometry
node tools/build-browser-core.mjs --build --geometry
node experiments/vtig-cjk/run-geometry.mjs
```

The mixed runtime's source/ABI prerequisites and commands are documented in [LUA-WASI-ABI.md](LUA-WASI-ABI.md). The four required official `fcl-json` runtime units compiled successfully; [their build receipt](../toolchain/packages-exnref/fcl-json/units/wasm32-wasip1/build-evidence.json) records the bounded runtime subset.

## Delivery still to close

Preserve the recorded DRL/Valkyrie/Lua licenses, permitted ASCII-art attribution and matching source. Restricted FMOD/Steam binaries, DOOM audio and unreviewed native fonts are excluded from the browser output; this console build uses silent audio and system fonts. The historical initial corresponding-source ZIP replaced the laboratory bundle for core 6b8: **27,571 files / 543,888,352 uncompressed bytes**, ZIP **166,288,072 bytes**, SHA-256 `b5ff2c3aa0e2347f31af37ae7742656e2cf06f779afd1b74119cebe420c93aed`, for core `6b8e1e78e52ce8d387d1f3b9c39401e5cfd3a88684db321f51a7cf985f544120`. All entries passed decompressed hash readback. A retained fresh tree has an authenticated complete-source/FPC mapping result; Cargo vendor verification and clean compilation remain separate. That archive predates the now-verified Help/config/getter changes and the Cargo working-directory correction. The core20e archive has complete hash readback and verified clean reconstruction. Its final download binds that unchanged compiled-source closure to corrected workflow, evidence and metadata; the adjacent archive receipt gives the exact identity. See [source packaging](SOURCE-PACKAGING.md) and [the archive receipt](../port/dist/source-bundle.json). See [source packaging](SOURCE-PACKAGING.md), [original-core boundary](CORE-BRIDGE.md) and [migration status](MIGRATION-STATUS.md).

Deliver the exact locally tested HTML/WASM, source/artifact hashes, browser screenshots/results, licenses and complete corresponding source to the parent. The separate shared `drl` destination still needs the final coherent sync and the parent's coordinated Git checkpoint. Preserve other games.

The Help/fixed-input refresh, browser `RunDelay = 0` override and read-only delay/MultiMove getters are compiled in the current core. The primary 15-check receipt verifies the same open official Help body/title/fixed keys through Japanese → English → Japanese on later native frames, including the scrolled page, with unchanged DRLP/MT bytes. The separate six-check combat/autorun receipt verifies native zero delay, physical Shift+Right followed by Escape, inactive MultiMove and twenty stable later native frames. Other cached views, messages, plots and reports still need semantic refresh work.

The earlier 2026-10-02 21:02 UTC 13-check checkpoint used core `6b8e1e78e52ce8d387d1f3b9c39401e5cfd3a88684db321f51a7cf985f544120` with the same Rust adapter. It remains historical evidence; the current receipts below identify core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`.

After the primary suite creates its checksummed native-save fixture, run the bounded encounter/interruption suite serially:

```powershell
node port/tests/original-combat-browser.mjs --mode=all
```

[The separate combat/autorun receipt](ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json) passed six bounded checks on the same current pair. Physical movement and three observed native doors acquired a visible hostile; original named targeting and two pistol shots produced ammo consumption and a named hit, player damage was observed, and a named hostile death was followed by increased XP and fresh native Look at the still-visible corpse tile. The receipt does not establish exact enemy UID/HP or player-kill attribution, full-world equivalence, broader combat mechanics or a campaign.

The freshly reconstructed core and Rust adapter also passed the isolated15-check Chrome suite. [The clean-build record](SOURCE-CLEAN-BUILD-EVIDENCE.json) retains exact compiler prerequisites and source hashes; the Rust panic-path difference is audited separately. After generating the alive-save fixture, the native death/report/profile gate is run serially with `node port/tests/original-death-browser.mjs`. It uses native movement and harmless waits, records concrete English report title/footer gaps, and checks production storage across fresh native instances. Full-world, win/challenge and wider text coverage remain separate.
