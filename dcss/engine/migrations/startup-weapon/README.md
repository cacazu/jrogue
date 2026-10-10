This is source-only staging for installation at `dcss/engine/migrations/startup-weapon`. Neither recipe has compiled, linked, packaged, promoted, or run a new engine. The parent owns installation and any later execution slot.

`inputs` contains byte-preserved reviewed source receipts, original and patched C++/library files, the Rust formatter, and original/staged host snapshots. `audit` contains the exact executed one-unit builder (`fed917abb533ec1eb62102b6a376fc7724643a6c3ac05ecdbf3a84dca90803f7`) and exact executed font-free packer (`52e44e62ea2ed5b8d13de2b862401b2899b3c13fa08df2074257d38b167ec921`). These audit copies retain their historical absolute paths and are evidence, rather than the portable entry points. `candidate-audit` duplicates those two audit files for the parent to install as `engine/candidates/startup-weapon/audit`; it does not change the candidate's compiled source, object, data, or manifest.

The entry points are `reproduce-startup.py` and `reproduce-font-free-package.py`. They resolve all migration inputs/audit and engine sources/caches from the DCSS folder. The external dependency is the official installed Emscripten 6.0.8 SDK; `--sdk` selects its path. This workflow targets the existing Windows executor. It requires the preserved full native-EH baseline in `engine/work-wasm-eh` and `engine/build-jspi-wasm-eh`, including its exact 333 sources, objects, fingerprint sidecars, manifest and artifacts. This one-unit recipe is not a replacement for the full baseline builder and does not rebuild missing or changed baseline objects.

The build recipe accepts `--root`, `--patch`, `--out` and `--sdk`. Installed defaults use the containing DCSS folder, adjacent `inputs`, and a separate `engine/candidates/startup-weapon-reproduced` output. A moved DCSS folder rebases only the original reviewed include/link root paths before checking the same canonical header/compiler fingerprint. The original manifest and all source/object hashes remain pinned. The manifest retains original baseline flags alongside the actual replacement compile flags. Output must be a new child of `engine/candidates`; an existing completed candidate is preserved. Exactly one `newgame.cc` is compiled and one path in the 333-object link order is replaced. Existing native baseline, current startup candidate, active artifacts and upstream remain unchanged.

From the installed migration directory, run read-only preflight:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' '.\reproduce-startup.py' --check
```

Adding `--build` is the explicit later compilation/link operation. It uses one compiler worker and one Binaryen worker. Launch it hidden and attach `tools/engine-memory-monitor.ps1` to its root process; run no native engine or browser concurrently.

The packaging recipe accepts `--root`, `--candidate`, `--sdk` and `--output`. Its default candidate is the new reproduced candidate. It accepts only the exact original candidate or a candidate recording the reviewed reproduction helper, exact immutable 333-row baseline, one replacement at index 170, complete ordered link/response provenance, fixed startup source/library/Rust/catalog pins, and the original complete 1,449-file payload. It preserves 1,448 files and omits only the pinned unused `docs/quickstart.pdf`. WASM is copied unchanged; only the official generated data-loader body changes. Candidate-relative corresponding source paths remain explicitly tied to the preserved source candidate.

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' '.\reproduce-font-free-package.py' --check
# Only after successful build/check and a separately assigned packaging slot:
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' '.\reproduce-font-free-package.py' --repack
```

For a check/repack of the original executed startup candidate, pass `--candidate engine/candidates/startup-weapon`. Packaging requires a nonexistent output child beneath this migration directory and refuses overwriting. It never installs or promotes output. Exact original candidate output hashes remain pinned; a reproduced candidate's new manifest/outputs are accepted only through the explicit reviewed reproduction contract and must receive new runtime evidence.

The synchronous formatter is preflighted in both languages before native factory creation. Host snapshots are review inputs; the parent must retain current Worker lifecycle changes when integrating. Native language is fixed for a session. Acceptance of any new artifact still requires actual English/Japanese frames, controls, all 45 RNG streams/counts, redraw/formatting purity and native save/resume tests. Full game localization is unfinished. Scope is local HTML, Node and real browser verification; no Site or external publication is authorized.

`prepare-reproduction-builder.py` and `prepare-reproduction-package.py` record the bounded source derivations from the exact audit helpers. They generate recipe source only and are not execution prerequisites after installation. `inventory.json` records the delivered byte hashes. The unchanged full native baseline and the explicit patched unit/library provide corresponding game source alongside these reproduction instructions.
