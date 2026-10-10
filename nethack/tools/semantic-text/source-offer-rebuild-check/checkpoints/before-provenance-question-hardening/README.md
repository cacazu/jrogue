# Source offer closure check

This check is an extraction prerequisite audit, not a rebuild test. It does not run the source composer, compiler, preprocessor, Node, browser, network, or packager. `closure.manifest.json` binds the exact preserved Phase 4 source foundation, private metadata, pristine sources, composer input lock, additional reads, generated native wrapper headers, and the selected portable Rust crate/fixtures/vendor files. The generator and active engine source remain unchanged.

The proposed package must select the actual Phase 6 engine source and include both `--rebuild-input work/phase4/NetHack-5.0.0` and `--rebuild-input work/phase4/semantic-generated`. It must also include `--stage-evidence build/phase6`, because the composer consumes `build/phase6/native-recipes.root-review.json`. Its selected Rust source is `tools/semantic-text/phase6-immutable-catalog/rust-copy`; its reviewed frontend source is the sibling `host-overlay` directory. All paths are relative to the extracted `nethack` project.

From the extracted `nethack` directory, run only this read-only check first:

```powershell
python -X utf8 tools/semantic-text/source-offer-rebuild-check/check.py
```

On the original supported Windows SDK layout, the optional presence check is:

```powershell
python -X utf8 tools/semantic-text/source-offer-rebuild-check/check.py --sdk C:\Users\kit\emsdk
```

The default check verifies every recorded required file and the composer lock, every selected Rust `include_str!`/`include_bytes!` target, the pinned Lua source file set, and, when present after extraction, every member hash in `build/packaged-input-manifest.json`. A missing or changed input is a failure. It does not refresh the existing composer lock. `--record` is reserved for the source reviewer; it writes only this audit directory and must not be used to approve a changed extraction.

Once that check succeeds, an optional **source-only** preparation replay is:

```powershell
python -X utf8 tools/semantic-text/phase6-integration/build.py --prepare --phase7
```

This command clones the protected foundation into `work/phase6` and writes derived source/catalog files. Run it only in a fresh extraction, before modifying those derived files. If an earlier Phase 6 tree already exists, its ownership hashes must match; unknown changes cause the composer to stop. The builder substitutes its `ROOT` with the extracted script's project root at execution time, so the generated builder does not require the original workspace path. The unused Phase 7 census command still refers to the original external audit directory; it is not needed by this replay, which consumes certified prototype operations and the packaged pristine source instead.

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
