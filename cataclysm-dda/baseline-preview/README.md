# Original C++ engine browser reference

This directory belongs to the Cataclysm: DDA baseline package task. It is a **local reference package** with incomplete Rust frontend and actual-browser verification. Gameplay remains in the original C++ engine at `0.I-1`, commit `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`.

The user's clarification, “WEB公開ってhtml作ってnodeでローカルで検証までだぞ”, makes HTML served and fully verified through Node localhost the delivery goal. External Site creation, deployment or updates are outside the active scope, including after local completion. The real original engine and its 7,938 runtime assets are packaged and served on loopback port 8878. Native Japanese menu startup has passed in Chrome. Gameplay creation, save/resume and revised mobile layout remain incomplete; the first guarded session ended at its 4 GiB owned-memory cap during world creation.

`package-local.mjs` reads the pristine upstream directly and uses the already installed official Emscripten `file_packager.py`. No asset staging copy, source-tree write, dependency installation, CDN import, additional SDK, or independent compiler cache is used. One pack job is allowed. The linked engine and a real compiled Japanese MO are required before packing starts.

Engine selection is explicit. With no engine flags, the tool selects only `engine-build/output` and requires `engine-build/evidence/full-engine-build.json`. Selecting the authorized isolated O1 candidate requires **both** `--engine-dir` and `--engine-evidence`. The only admitted candidate directories are the initial candidate root and its authorized `attempts/attempt-2` retry. Evidence must be that selected attempt's own `evidence/full-engine-build.json`; cross-attempt evidence, archived attempt-1 and other retries are rejected. It never falls back to the original output when the selected candidate or its evidence is absent. Packaging only reads engine inputs; it does not replace original or accepted engine outputs.

```powershell
node .\baseline-preview\package-local.mjs --inventory
node .\baseline-preview\package-local.mjs --preflight --ja-mo .\ja-current\generated\lang\mo\ja\LC_MESSAGES\cataclysm-dda.mo
node .\baseline-preview\verify-shell.mjs
node .\baseline-preview\verify-engine-selection.mjs
```

The O1 candidate keeps the same 438 original objects compiled with `-Os`, changes only link optimization to `-O1`, and retains conservative Asyncify, exceptions, IDBFS and memory settings. The authorized retry has its own plan, run config, frozen config, response, log, evidence and output under `engine-build/candidates/o1-conservative-asyncify/attempts/attempt-2`. For a lightweight retry preflight:

```powershell
$candidateRoot = '.\engine-build\candidates\o1-conservative-asyncify\attempts\attempt-2'
node .\baseline-preview\package-local.mjs --preflight --ja-mo .\ja-current\generated\lang\mo\ja\LC_MESSAGES\cataclysm-dda.mo --engine-dir "$candidateRoot\output" --engine-evidence "$candidateRoot\evidence\full-engine-build.json"
```

The build owner records `run-config.json` before launch and emits `evidence/full-engine-build.json` only after its actual successful link/check stages. The packer requires successful full-engine evidence for the pinned source commit, all 438 units, the unchanged build-manifest hash, and exact JS/WASM sizes and SHA-256 hashes. It also checks the reviewed/actual argv, identical original response bytes, candidate/run/config/log provenance hashes, and the frozen candidate config using the existing shared cache/ports. The finalized 105,004-entry Japanese MO hash is pinned. Missing evidence keeps `engineReady=false`; altered evidence or artifacts is an error. Fixture guard tests exercise those refusals and do not constitute an engine or browser pass.

The first O1 attempt was stopped by its resource guard and has no full-engine pass evidence. Its source-pinned run/config/log and `attempts/attempt-1/evidence/resource-constrained-attempt.json` remain intact in the build owner's immutable attempt-1 archive. The retry requires matching reviewed/executed attempt-2 metadata and separate output/evidence; neither an incomplete WASM file nor earlier constrained evidence permits packaging. A successful retry still needs a new parent-coordinated packing window and actual original-game browser QA.

Before `--package`, the parent must explicitly allocate the shared executor's heavy slot, then set `CDDA_PACKING_SLOT=parent-coordinated` in that process. The script also measures and requires at least 4 GiB free physical RAM and 6 GiB commit headroom before launching file_packager/LZ4. Inventory, preflight and shell checks remain lightweight and do not start compression. Do not set the slot variable merely because time has passed.

Only after the actual engine is linked and the parent allocates the slot:

```powershell
$env:CDDA_PACKING_SLOT = 'parent-coordinated'
$candidateRoot = '.\engine-build\candidates\o1-conservative-asyncify\attempts\attempt-2'
node .\baseline-preview\package-local.mjs --package --ja-mo .\ja-current\generated\lang\mo\ja\LC_MESSAGES\cataclysm-dda.mo --engine-dir "$candidateRoot\output" --engine-evidence "$candidateRoot\evidence\full-engine-build.json"
Remove-Item Env:\CDDA_PACKING_SLOT
```

After the package owner confirms `baseline-preview/web/package-manifest.json` and its runtime files, start the server in one terminal:

```powershell
node .\baseline-preview\serve-local.mjs 8878
```

With the parent's browser resource allocation, start QA in another terminal:

```powershell
node .\browser-qa\session.mjs http://127.0.0.1:8878/
node .\browser-qa\control.mjs '{"op":"capture","name":"desktop-menu"}'
```

The game URL is `http://127.0.0.1:8878/`; the QA control endpoint is loopback port 8890. Follow `browser-qa/README.md` for actual game flows, CJK inspection, desktop/mobile input and original save/reload/resume. Menu capture alone does not establish full-game completion. Run `node .\tools\check-local-completion.mjs .` for the eleven evidence gates; absence of actual evidence returns exit code 2. Local Node serving evidence belongs in `evidence/local-node-delivery.json`, and audited notices/source evidence belongs in `evidence/local-delivery-notices.json`.

The runtime bundle contains **every file in upstream `data` and `gfx`**, including all bundled mods, obsolete mods, MA and Ultica_iso. The upstream preparation script's exclusions are not inherited. `lang/json` and the selected Japanese MO are included. Translation source PO files remain in the pristine full source tree; they are not runtime assets. Bundled Basic audio files are preserved, but this reference engine is compiled without `SDL_SOUND`; it must not be described as a full sound build.

The package manifest records `selectedEngine.engineDir`, evidence path/hash, build/source provenance, selected artifact hashes and the candidate's actual `-O1` link provenance. These evidence/config/response/log files are also copied into `notices/selected-engine`. The manifest retains `referenceOnly=true`, `completePort=false` and browser acceptance pending. This candidate is a local original-engine reference until real gameplay, callback and save/resume QA passes; packaging does not accept it as the complete port. All 7,938 runtime entries, the reviewed MO, verified Rust bridge and existing notices are retained.

The original C++ `main.cpp` creates `/home/web_user/.cataclysm-dda`, mounts IDBFS and restores it. The shell observes the existing `FS.syncfs` operation. After the initial restore, it creates only a missing new-profile `config/options.json` with `USE_LANG=ja`, persists it, then resumes the original callback. It never mounts IDBFS again or overrides an existing options file. Browser-shell language controls affect only shell text; the engine's own options retain authority over its language.

The original gettext reader uses native mmap, which installed LZ4FS does not support. Actual Chrome verified that the compressed catalog's bytes match the pinned SHA-256 but its native mmap returns ENODEV. Before native startup resumes, the shell verifies the catalog and materializes only that same file in MEMFS, whose mmap adapter supports the original consumer. It verifies its bytes again and exposes the result in diagnostics. Native Japanese menu startup then passed with an existing IDBFS profile. Engine, translations and compressed package bytes are unchanged.

Canvas CSS dimensions remain unset until the original SDL window emits `menuready`. This preserves SDL's intrinsic 1×1 creation probe, preventing viewport CSS from taking ownership of its logical framebuffer. After startup, the shell changes only the canvas's displayed CSS size. A separate game-screen range control selects 25–150% scale, ↔ fits an overview, and adjacent arrows pan the scrollable viewport without sending native game commands. The default scale preserves at least 75% of the original pixels for CJK readability. The VM regression checks preserve the backing dimensions and input boundary; actual portrait/landscape, mobile-first startup and native pointer mapping still require browser evidence.

Upstream `data/fontdata.json` provides Terminus followed by unifont fallback for all four font roles; the unmodified fonts are included. Shell controls use system fonts. The shell's English and Japanese text uses explicit IDs in JSON and placeholder parity is checked. This does **not** establish gameplay semantic-ID integration or complete game translation coverage.

The verified `rust-browser-bridge` WASM now formats all 27 shell messages and resolves only the explicit helper buttons in the conservative `menu` context. Its ABI/scope/default language are exposed in diagnostics. Physical keyboard events, IME flow and text-form submissions remain on the original SDL path. Unsupported helper keys retain their original native key. This is a bounded Rust integration; full-game map rendering, dialogs, settings, contextual input and the complete gameplay text catalog have not migrated through it. The pinned WASM hash is `0dadaa2a2d1f133b39f0ee3265c9ba65d4a601c6ce274ae6d4b83f1b40d9d835`.

Save export uses a local Blob containing a versioned JSON container (`cdda-original-files`, version 1), each unchanged native file encoded in base64. It downloads locally and sends no save data to a server. It does not claim a new gameplay save format or compatibility across engine releases. Upstream IDBFS persistence remains the save/resume mechanism.

`window.cddaBaselineDiagnostics` records runtime readiness, `menuready`, dependency progress, the initial persistence restore, whether Japanese defaults were seeded, sync errors, and bounded engine logs. Input helper buttons emit keyboard events into the actual original SDL runtime. They implement no rules; full mobile input and Japanese text entry remain browser validation gates.

The package preserves root licenses, bundled asset credits/tileset notices, tracked vendored notices and notices for the actual compiler ports. The main project and added shell use CC BY-SA 3.0. Fonts and compiled libraries retain their individual licenses. `attribution.html`, `notice-manifest.json`, `package-manifest.json` and the immutable source link make attribution and build provenance reviewable. Full source and port source must remain available with local delivery.

The standalone LZ4 package needs `FS_createPath`, `addRunDependency`, `removeRunDependency` and `LZ4` in addition to the shell's `FS` export. In the installed SDK 6.0.8, `tools/link.py` automatically adds the filesystem methods when `FORCE_FILESYSTEM` is set and adds `LZ4` when `LZ4` is set; the engine link recipe enables both. This was checked in the actual installed SDK. The loopback-only server refuses to start before an actual package manifest exists and serves WASM with its correct MIME type.

The package includes the verified bridge runtime, dependency notices and provenance. The shell verifier uses that actual Rust WASM to check all 54 English/Japanese message outputs, then checks its helper routing and the original filesystem boundary. Parent owns actual browser QA and the remaining full-game Rust migration. This task prepares the reference shell and package for Node localhost verification; external hosting is outside the requested delivery scope.
