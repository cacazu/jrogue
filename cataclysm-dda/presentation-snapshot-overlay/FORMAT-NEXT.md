# Completed narrow Rust formatting window

Formatting and follow-up verification are complete. The previous preparation instructions are preserved byte-for-byte in `format-window/FORMAT-NEXT-before-completion.md`; their mutating Cargo-fmt proposal was superseded by the parent-approved workcopy workflow.

1. Archive exact `lib.rs`/`tests.rs`, then run pinned standard rustfmt only on colocated owned workcopies under the reserved Windows job guard. Preview passed once; actual source and fixtures stayed unchanged.
2. Review the normal diff and candidate hashes. Root approved ordinary whitespace/line/trailing-comma changes with literals and synthetic fixture bytes preserved. Copy only those exact two candidate buffers after before/archive/current-input/hash checks. No C++ or fixture bytes changed.
3. Refresh pins and the curated manifest; preserve the exact actually-used copier separately from its later source-only rollback-reporting correction. No second copy occurred.
4. Execute once, sequentially: read-only Cargo fmt check, the same five actual owned-parser tests, and Clippy with warnings denied. All passed under fresh 4/6 GiB gates, 1 GiB owned caps, 2/2 GiB floors and 180-second limits; inputs stayed unchanged and owned jobs/handles closed.

`RUST-FORMATTED-VERIFICATION.json` records the exact accepted plan `091048a51f400baae8a3190673c937b5bf7bdeafe0b0a90d88094df1aafe3c57`, sources, commands, timestamps, resource counters and hashed raw logs. Its accepted-input archive preserves eighteen inputs plus the plan. `RUST-VERIFICATION.json` and preformat archives remain unchanged historical evidence. The accepted plan remains the immutable pre-run specification; the current result is recorded separately.

The next acceptance milestone is actual coordinated C++ producer/FFI/WASM and browser integration. These synthetic Rust fixture tests establish none of native producer parity, input ownership, full canvas, full semantic coverage or whole-game rendering purity. No further compiler/browser window is reserved by this completed proof; Node localhost remains the only WEB scope.
