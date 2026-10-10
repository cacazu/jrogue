# Original-core source packaging

The verified original-game build records 139 compiled-source entries, unchanged source/archive snapshots and a checked final link map. The source planner retains the selected original code, guarded recipes, generated adaptations, permitted ASCII art, pinned dependency sources and license notices. It checks every compiled-source entry against that selection.

The initial matching source archive for core `6b8e1e78e52ce8d387d1f3b9c39401e5cfd3a88684db321f51a7cf985f544120` contains 27,571 source files / 543,888,352 uncompressed bytes. Its ZIP is 166,288,072 bytes, SHA-256 `b5ff2c3aa0e2347f31af37ae7742656e2cf06f779afd1b74119cebe420c93aed`. Every input was hashed before and after copying; every decompressed entry was hashed before the archive replaced the older laboratory bundle. The measured job peaked at 401,641,472 commit bytes, with minimum commit headroom of 6,253,871,104 bytes. Later builds must supply their own matching `port/dist/source-bundle.json` receipt.

Plan and package from the owning user's checkout:

```powershell
node tools/package-core-source.mjs --plan
node tools/package-core-source.mjs --package
```

The generated plan contains executor input paths and is excluded from Git. Keep Git ownership checks enabled; no global trust exception is needed. The PowerShell7 writer streams ZIP entries, validates confined paths and source hashes, and performs complete archive readback. `port/tools/package-source.mjs` belongs to the older reference laboratory and must not replace the original-game bundle.

Verify and retain a new extraction with the authored verifier:

```powershell
pwsh -NoProfile -File tools/verify-source-bundle.ps1 -Restore -Evidence docs/fresh-source-restore.json
```

The verifier rejects unexpected paths, symlinks, duplicate names, entry sizes and hashes before extraction. It creates a unique directory under the user's local temporary directory and retains it. The optional restore executes only the verified authored extraction script, never acquired upstream build code. It expands the pinned FPC baseline (28,142 archive entries / 350,348,786 bytes), applies the exact linked-source mappings, restores all 23 Cargo packages and verifies the restored mappings. Actual fresh-restore receipts, when present, distinguish extraction from a clean compilation.

For manual restoration from an already verified, fresh extraction:

```powershell
pwsh -NoProfile -File tools/restore-core-source-inputs.ps1
Set-Location port
cargo metadata --offline --locked --format-version 1 --no-deps
```

Cargo must run from `port` to discover the restored `port/.cargo/config.toml`; its `../vendor` path points to the extracted vendor directory. The current local build wrapper uses that working directory. The initial archive named above predates this wrapper correction, so its manual Cargo steps should also run from `port`.

A clean game-source compilation needs the pinned external FPC compiler, RTL/package units, Lua archives, LLVM tools, WASI sysroot/builtins and Rust toolchain. These executables and archives are deliberately absent from the source bundle. Supply the recorded tool identities and compile fresh game objects; copying a previous game's objects or WASM is not a clean build. A full toolchain bootstrap is a separate gate. The source planner's dependency Git checks require original checkouts and are not necessary for compiling an extracted source bundle.

The immutable official FPC source companion contains 422 object fixtures and one archive (2,776,818 bytes), mainly compiler tests and three PalmOS objects. This declared exception retains the exact official source ZIP; these fixtures are not game-runtime downloads. FMOD/Steam SDK bindings, native runtime binaries, audio and unreviewed fonts are excluded from the game/source selection.

The retained notice pool has 56 files / 2,445,322 bytes, including the 20 selected Sun/Arm math headers. [Final notice retention](FINAL-NOTICE-RETENTION.json) binds that review to the checked link map; [allocator audit](CORE-ALLOCATOR-AUDIT.json) records selected libc members and allocator ownership. Rust library permissions, crate notices, GPL source notices and CC BY-SA ASCII-art attribution accompany the HTML build. Complete campaign, translation and full-world verification remain distinct from static source/notice retention.

The user's requested workflow is local HTML served with Node and verified in a real browser. No external Site, deployment, billing or credentials are part of this checkpoint. Full-port completion remains false.

The later core20e source checkpoint was fully extracted into a fresh directory: 27,630 files, 545,460,758 source bytes, all 26,172 FPC baseline files and 13,776 linked-source mappings. Twenty-three locked Cargo packages resolved offline with an empty Cargo home. Both components compiled from fresh game inputs; no prior game objects or WASM were copied. The original139 compiled sources produced the byte-identical core20e. The Rust adapter compiled successfully but differs because vendored dependency paths are embedded in panic diagnostics; the isolated freshly built pair also passed all15 actual Chrome checks. [Clean compile receipt](SOURCE-CLEAN-BUILD-EVIDENCE.json), [isolated browser receipt](CLEAN-SOURCE-BROWSER-EVIDENCE.json) and [Rust difference audit](CLEAN-RUST-ADAPTER-DIFF.json) distinguish these claims. Recorded external standard compilers/units/libraries were reused; a full toolchain bootstrap remains unverified.

The final source package adds corrected reconstruction helpers, death/profile gates and current receipts to that core20e archive, preserving all compiled-source and source-mapping identities. Its exact archive size/hash are in the adjacent runtime `source-bundle.json`; the complete ZIP writer hashes every source before and after writing and checks every decompressed entry before replacement. [Final package plan](core-source-package-plan.json) records the restricted authored-file delta. This is source-availability and reproducibility evidence, not a full campaign/world/translation completion claim.
