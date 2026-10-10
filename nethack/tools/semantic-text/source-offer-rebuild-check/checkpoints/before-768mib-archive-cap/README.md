# Source offer closure check

This check is an extraction prerequisite audit, not a rebuild test. It does not run the source composer, compiler, preprocessor, Node, browser, network, or packager. `closure.manifest.json` binds the exact preserved Phase 4 source foundation, private metadata, pristine sources, composer input lock, additional reads, generated native wrapper headers, and the selected portable Rust crate/fixtures/vendor files. The generator and active engine source remain unchanged.

The proposed package must select the actual Phase 6 engine source and include both `--rebuild-input work/phase4/NetHack-5.0.0` and `--rebuild-input work/phase4/semantic-generated`. It must include all three repeatable evidence selections: `--stage-evidence build/phase6 --stage-evidence build/phase6-rust --stage-evidence build/data-consumer-qa/phase6`. The first supplies the composer's `native-recipes.root-review.json`; the second preserves the actual Rust proof, eleven-file source checkpoint, four validation logs and their resource records; the third preserves the separately executed native data-consumer evidence when that gate completes. The packager excludes `target`, `__pycache__`, `node_modules`, browser profiles and screenshots. Its selected Rust source is `tools/semantic-text/phase6-immutable-catalog/rust-copy`; its selected frontend is the tested candidate at `build/phase6/web`. The aliases in an extraction are `engine-source`, `rust` and `web`. The original tool/proposal paths also remain under `tools`, and both foundations remain under `work/phase4`. All paths are relative to the extracted `nethack` project.

From the extracted `nethack` directory, run only this read-only check first:

```powershell
python -X utf8 tools/semantic-text/source-offer-rebuild-check/check.py --package-layout
```

On the original supported Windows SDK layout, the optional presence check is:

```powershell
python -X utf8 tools/semantic-text/source-offer-rebuild-check/check.py --package-layout --sdk C:\Users\kit\emsdk
```

The default check verifies every recorded required file and the composer lock, every selected Rust `include_str!`/`include_bytes!` target, the pinned Lua source file set, the existing Rust proof's exact source/fixture/log bindings, and, when present after extraction, every member hash in `build/packaged-input-manifest.json`. A missing or changed input is a failure. Completed Rust proof inputs are guarded as stable inputs. Ongoing engine/compiler/data/browser outputs are excluded from the source-prerequisite freeze; their final bytes must be captured by the packaged member snapshot. An evidence directory selection alone does not establish that its validation gate passed. The check does not refresh the existing composer lock. `--record` is reserved for the source reviewer; it writes only this audit directory and must not be used to approve a changed extraction.

After the parent's data-consumer gate completed, this prerequisite manifest additionally binds the exact captured inputs `build/data-consumer-qa/phase6/original-consumer.c` and `build/data-consumer-qa/phase6/target-dlb-preprocessed.c`. The evidence selector permits these two source paths specifically; it does not include arbitrary C files from build directories. The source guards also cover the reviewed packager, package auditor, delivery script and `tools/check-phase6-js-syntax.py`, plus the immutable actual-engine source-manifest copy at `build/phase6/source-manifest.json`. Save exclusions use both `.save`/`.sav` suffixes and the complete filename ending `.save.json`; `Path.suffix` alone would miss the latter. This audit reads their source and metadata; it does not run their archive or Node commands, and does not certify the separate native/browser acceptance gates.

`package-layout.aliases.json` captures the exact selected source files before packaging. `--package-layout` checks every `engine-source`, `rust` and `web` alias against those hashes, rejects extra alias files, and verifies the portable Rust source's eight literal fixture targets. It does not require the original `work/phase6` or `build/phase6/web` source paths to exist after extraction. The default mode still verifies original preserved tool/foundation dependency paths; its Lua check prefers the packaged `engine-source` tree. The alias check is intended for a fresh extraction before compilation creates additional files. Capturing an alias snapshot is not an extraction or rebuild test, and WASM/data download artifacts remain outside the corresponding-source archive.

Once that check succeeds, an optional **source-only** preparation replay is:

```powershell
python -X utf8 tools/semantic-text/phase6-integration/build.py --prepare --phase7
```

This command clones the protected foundation into `work/phase6` and writes derived source/catalog files. Run it only in a fresh extraction, before modifying those derived files. If an earlier Phase 6 tree already exists, its ownership hashes must match. The original target utility's regenerated `include/date.h` is accepted only when its exact bytes match the target-data certificate; other changes cause the composer to stop. The builder substitutes its `ROOT` with the extracted script's project root at execution time, so the generated builder does not require the original workspace path. The unused Phase 7 census command still refers to the original external audit directory; it is not needed by this replay, which consumes certified prototype operations and the packaged pristine source instead.

The additional `provenance.py` observer uses the Python standard library to record actual source/header/object and embed/link boundaries. Its optional previous compile evidence is not a substitute for object files: a fresh extraction regenerates them. `target-macros.c` reads the project's packaged configuration headers and the installed SDK's Emscripten header; target macro values require execution of the compiled observer and are not asserted by this source-only check. `target-data.cjs` has no new npm dependency. These helpers and the generated JSON evidence fall under the existing `tools` and `build/phase6` package selections.

An actual build additionally requires the installed matching Emscripten 6.0.8 distribution, its Python 3.13.3 and Node 24.19.0 directory layout, installed Rust 1.98 with the `wasm32-unknown-emscripten` standard library, and the builder's hardcoded installed WinLibs UCRT GCC path. The archive contains Rust vendored dependencies and original native helper sources; it does not contain SDKs, compiler binaries, precompiled native helpers, or a warm SDK cache. Missing bundled Lua or its pinned manifest can cause the existing setup routine to attempt a download; the check fails before recommending an offline build when those inputs are absent or mismatched.

After installing those prerequisites and releasing an appropriate build slot, these are the relevant commands, **not executed by this audit**:

```powershell
$env:EM_CONFIG = 'C:\Users\kit\emsdk\.emscripten'
$env:EMSDK = 'C:\Users\kit\emsdk'
$env:PATH = 'C:\Users\kit\emsdk\upstream\emscripten;' + $env:PATH
$env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = '1'
Push-Location tools/semantic-text/phase6-immutable-catalog/rust-copy
cargo build --offline --locked --release --jobs 1 --target wasm32-unknown-emscripten
Pop-Location
python -X utf8 tools/semantic-text/phase6-integration/build.py --build --phase7 --registered-catalog --sdk C:\Users\kit\emsdk --rust-lib tools/semantic-text/phase6-immutable-catalog/rust-copy/target/wasm32-unknown-emscripten/release/libnethack_layers.a --web-source tools/semantic-text/phase6-immutable-catalog/host-overlay
```

Target makedefs regenerates offsets using the original target libc and original inputs; copying old CRLF offsets or converting generated files by text replacement is insufficient. Date-dependent generated data, absolute diagnostic source paths, SDK versions, and cold-cache system-library builds prevent a claim of byte-identical binaries from these commands alone. A successful source closure check also does not prove the complete Japanese text scope or native/browser runtime behavior.

`source-builtins.inventory.json` inventories all actual `__LINE__`/`__FILE__` code tokens in the 130 pristine core C files, plus header definitions and their original consumers. It records current combined source physical/presumed locations independently. Header definitions are not counted as executed preprocessor expansions. A local Phase 7 `#line` directive does not certify preservation of source locations changed by earlier phases.

`runtime-notices.audit.json` records a separate read-only comparison against the original installed SDK and Rust notice files. The existing bundle preserves fourteen runtime artifacts, including twelve whole original files, forty-six distinct musl comment blocks at 124 recorded source occurrences, and the original dlmalloc notice. All twenty-two notice files for the eleven vendored Rust dependencies are present in both the canonical and selected portable source trees. The audit script has machine-specific original provenance paths; it is not required by the portable extraction check and does not modify the notice bundle.

The selected Rust input static library contains archive members named `compiler_builtins`. Neither installed Rust copyright HTML inventory names that component. This leaves a component-specific attribution mapping unresolved; generic license text or the Emscripten compiler-rt notices do not establish that mapping. Archive header inspection does not prove which members survive the separate final WASM link. This report records source facts and does not make a rights or license compatibility determination.
