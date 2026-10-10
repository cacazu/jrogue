# Full upstream browser engine build

This directory builds the actual Cataclysm: Dark Days Ahead 0.I-1 engine, preserving its C++ gameplay core. It is the original WASM/SDL baseline for integration with the Rust presentation, input and platform layers.

The requested completion target is HTML/browser use with Node localhost verification. This build is a local reference milestone; it does not create or deploy an external Site and does not establish that the Rust and semantic-text integration is complete.

Upstream commit: `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`.

The full original engine linked successfully on 2026-10-02 at 18:59:40 UTC. All 438 source units (412 C++, 26 C) are present. The selected local reference is `candidates/o1-conservative-asyncify/attempts/attempt-2/output/cataclysm-tiles.js` with its sibling WASM. `../evidence/full-engine-build.json` is the canonical evidence and verifies the successful attempt's artifact and provenance hashes. `completePort` and `runtimeBrowserVerified` remain false until the separate integration and real-browser checks pass.

The WASM is 134,832,388 bytes, SHA256 `3db7de7161c00e711828e219b148a376f15297c5fd6ee1213b14d10228a7f666`. The JS is 498,522 bytes, SHA256 `8e41e1903f220bbaf8831a215de66427b166741ca19f2fa01edc0995e0cc74b5`. Binary validation and generated JavaScript syntax passed; the seven official port archives and 17 actually linked SDK archives have recorded provenance. These artifacts contain no packaged gameplay data and are not an accepted playable game directory.

The source tree remains pristine at `C:/Users/kit/gameme/jnethack/jrouge/cataclysm-dda/upstream/Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. All generated headers, objects, downloaded compiler ports, logs, and output go into this directory. The installed official Emscripten SDK is read without global activation or installation.

Run from the task workspace:

```powershell
node .\engine-build\build-engine.mjs --probe
node .\engine-build\build-engine.mjs --compile
```

The original `build-engine.mjs --link` uses `-Os`. That attempt remained CPU-active without exposed internal progress for 12,852.557 seconds and ended only after the parent explicitly authorized termination of its verified owned optimizer. Its logs, 438 objects and 42,382,436-byte pre-optimization WASM remain preserved. Do not automatically repeat that link. The successful selected attempt reuses the same objects and changes only the link optimization to `-O1`, retaining conservative Asyncify, all default imports and indirect calls, exceptions, SDL, IDBFS and localization. No Asyncify include/exclude/ignore-indirect shortcut or JSPI switch was used.

The first `-O1` attempt stopped at its candidate-only resource guard when exact commit headroom fell below 2 GiB. Its 17 files are preserved byte-for-byte under `candidates/o1-conservative-asyncify/attempts/attempt-1`, with a hash manifest. After the original optimizer was authorized-ended, the one authorized exclusive retry completed in 229.930 seconds (Emscripten driver 228.347 seconds). Its 39 resource samples recorded peak owned private memory of 3,559,145,472 bytes and minimum physical/commit headroom of 3,167,236,096/4,554,752,000 bytes. All observed retry process identities ended. Sampled peaks and optimizer CPU observations do not establish exact per-pass timing; the SDK did not expose it. `attempt-2/evidence/terminal-resource-stage-report.json` records these limits and measurements.

The retry runner is a once-only, parent-coordinated operation with fresh 4 GiB physical and 6 GiB exact commit launch gates, one Emscripten/Binaryen/linker worker, and a 5-second candidate-only guard. It was not rerun after success. `attempt-2/link-candidate.json` and `run-config.json` retain identical reviewed/executed arguments; corrected historical original-PID metadata and its unchanged startup bytes have separate hashes.

Compilation resumes from completed object files. `CDDA_BUILD_JOBS` controls concurrent compilation (default 1, to bound memory on the shared executor); `EMCC_CORES` also defaults to 1 for compiler ports and system libraries. Do not reuse objects after changing compilation flags or the pinned source; use a new isolated build directory.

This shared executor caps source jobs at 2. Two jobs require at least 4 GiB free RAM at startup; the second worker also pauses before dispatching another file whenever free RAM falls below 4 GiB. Reuse and linking require a successful recorded result and exact matching compile arguments, so interrupted or incompatible objects are rejected.

`EMCC_BATCH_BUILD=0` uses the SDK's supported one-input-per-command mode to avoid Windows `WinError 206` in large one-job system-library builds. `-Wl,--threads=1` bounds wasm-ld and `BINARYEN_CORES=1` bounds subsequent optimization. Any standard archives copied from the same installed official SDK cache are recorded, with source/destination hashes, in `copied-sdk-archives.json`; global SDK files are read only.

`build-manifest.json` captures all source files and flags, compiler versions, original recipe hashes and differences from GNU Make. `logs/*.log` capture exact commands and compiler output. `compile-results.json` records translation-unit results.

Run `node .\engine-build\verify-port-provenance.mjs` to verify the seven task-local port archives against the official installed SDK recipes' SHA512 checksums. `dependency-provenance.json` records exact upstream acquisition URLs, recipe hashes, archive sizes and SHA256/SHA512 values. `dependency-license-manifest.json` records the retained dependency license notices.

The official recipe pins Emscripten 3.1.51. The installed SDK is 6.0.8. This difference must be called out in results. The build preserves SDL2, PNG image loading, TTF/CJK support, exceptions, Asyncify, IDBFS, localization, FlatBuffers and Zstd. The original web recipe does not enable SDL_mixer sound.

The compiler macro probe showed that SDK 6.0.8 supplies only `__EMSCRIPTEN__`, while this release gates its browser implementation on the old `EMSCRIPTEN` macro. The compatibility flag `-DEMSCRIPTEN` explicitly restores the original browser path. Objects compiled before this flag are archived separately and must not be linked into the browser build.

The upstream engine still uses its original C++ rules, translated English keys, gettext MO files and native save format. Compiling it alone does not implement semantic JSON text IDs, the four-layer boundary, Rust presentation/input/platform adapters, render purity or versioned boundary save compatibility. Those are separate integration milestones. No replacement Rust gameplay implementation is assumed.

The packaging owner must include upstream gameplay data, audited tile assets/fonts and Japanese `lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo`, set `USE_LANG=ja` for a new profile, retain code and asset attribution, and validate startup, character creation, play, save/resume, PC and mobile input in a real browser served by Node on localhost before local completion. No game data is embedded by the link command; it uses the separate official file-packager approach.

Two translation units (`veh_interact.cpp`, `veh_shape.cpp`) exhausted Windows commit while two source workers ran. Both compiled unchanged with one worker on retry (23.27 s and 7.82 s). The preserved *-two-worker-oom.log files distinguish this host resource event from SDK/source incompatibility. Continue with one worker and inspect free virtual memory as well as physical RAM before linking.
