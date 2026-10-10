# Narrow remaining Rust formatting plan

The actual five parser tests and Clippy have passed. The Rust files currently use compact source formatting. The parent explicitly directed skipping a known-difference format check during that completed window. Formatting has **not** been executed, and there is no automatic retry or additional compiler reservation.

Only `rust/src/lib.rs` and `rust/src/tests.rs` may be reformatted. Keep the original C++ producer/header/patch, fixtures, catalogs, historical `SOURCE-REVIEW.md` and accepted execution archive unchanged. The current test/lock comments were updated only after success; exact accepted copies remain archived.

The exact formatter commands, using the pinned installed Cargo executable and the actual isolated manifest, are:

```powershell
& 'C:\Users\kit\.rustup\toolchains\1.98.1-x86_64-pc-windows-gnu\bin\cargo.exe' fmt --manifest-path 'C:\Users\kit\Documents\Codex\2026-10-02\task-8\presentation-snapshot-overlay\rust\Cargo.toml' --all
& 'C:\Users\kit\.rustup\toolchains\1.98.1-x86_64-pc-windows-gnu\bin\cargo.exe' fmt --manifest-path 'C:\Users\kit\Documents\Codex\2026-10-02\task-8\presentation-snapshot-overlay\rust\Cargo.toml' --all -- --check
```

Those lines specify the child commands; **do not execute them unguarded**. Before execution, prepare a separately reviewed apply stage through the already reviewed `run_owned` owner/unchanged shared job guard. Its command allowlist adds only `cargo fmt ... --all`; parent release, exact tool/plan pins, nonoptimized x64 Python, fresh 4/6 GiB counters, 1 GiB caps, 2/2 GiB floors, 180-second timeout and owned-handle cleanup remain identical. Admit changed source fingerprints only for the two listed Rust files; all other protected inputs must remain byte-identical. Preserve before/after bytes and the formatter diff in a new owned attempt directory. The present runner permits only **format check**, not a mutating apply stage.

Then refresh the source/lock/runner plan pins and record a new reviewed plan hash. Run the existing read-only format-check stage under a fresh guarded reservation. Because Rust source bytes changed, repeat the **same five** actual parser tests and Clippy sequentially with offline/locked Cargo, one job/test thread and the original resource limits. An unchanged-body/comment/format diff does not authorize changing tests, decoder behavior, width rules or adding lint suppressions. Stop on any failure; do not start original C++, a browser or a second job.

The current preparer and canonical follow-up parser plan now pin the corrected test/lock comments. The accepted earlier plan remains in the immutable execution archive at its original hash; the follow-up plan has not been executed and needs a new parent reservation. All Cargo package/dependency records remain the same single std-only package. A separately reviewed mutating formatter stage is still required before using those follow-up checks. No resolver/network/install is needed.
