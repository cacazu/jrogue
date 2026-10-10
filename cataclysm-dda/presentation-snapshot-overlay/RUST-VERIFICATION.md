# Actual isolated Rust parser verification

The current formatted owned parser passed **Cargo fmt check, the same five tests, and Clippy with warnings denied** in the single reserved sequential window. `RUST-FORMATTED-VERIFICATION.json` is the current result. Fixtures remain synthetic; original C++/live FFI/WASM/browser acceptance remains unverified.

| Formatted stage | Owned-root creation UTC | Duration | Job peak private bytes | Result |
|---|---|---:|---:|---|
| Cargo fmt check | 2026-10-02 20:52:58.238 | 0.333 s | 9,437,184 | Passed |
| Same five parser tests | 2026-10-02 20:53:39.289 | 1.307 s | 152,313,856 | 5 passed; 0 failed/ignored/filtered |
| Clippy, warnings denied | 2026-10-02 20:53:58.938 | 0.797 s | 147,427,328 | Passed |

The exact accepted formatted plan is `091048a51f400baae8a3190673c937b5bf7bdeafe0b0a90d88094df1aafe3c57`; `build-plan/execution/native-tests-formatted-1/accepted-inputs/` preserves its exact bytes and eighteen inputs. Current `lib.rs` is `6a27bcde658ee7d5dd1bc1444129329c1697baf568b5025d8dd3711ed296f59c`; `tests.rs` is `9a24e33cd2f0d1a304fc43d070ebea2ae1a8dc93a061bbe7d14ee0ec83866f0c`. Root approved the ordinary rustfmt diff before those two source copies. No Rust source changed after these checks.

Each stage independently passed the unchanged fresh 4/6 GiB launch gate, 1 GiB owned caps, 2/2 GiB running floors and 180-second timeout. Tests and Clippy used offline/locked Cargo, one job and one test thread; fmt check used the same pinned Rustfmt configuration and offline environment. All protected inputs remained unchanged during each stage; all owned jobs/PIDs/process handles closed with no cleanup errors. Root-creation timestamps are derived from exact original FILETIME decimals, not rounded JavaScript numbers; raw identity/resource records are hashed and preserved without rewriting. No retry or additional compiler/browser/C++ launch occurred.

## Before formatting

The following table and JSON describe the earlier source bytes and window; these metrics have not been relabeled as formatted-run results.

The five existing tests of the real std-only owned parser **passed**, followed by **Clippy `--lib --tests -- -D warnings`**. The fixture frames are synthetic source-bound binary records, not output observed from compiled C++ or a browser.

| Reserved stage | Duration | Owned job peak private bytes | Result |
|---|---:|---:|---|
| Five host Rust parser tests | 1.044 s | 151,928,832 | 5 passed; 0 failed/ignored/filtered |
| Clippy, warnings denied | 0.800 s | 148,320,256 | Passed |

Both commands used offline/locked Cargo, one Cargo job and one test thread, an isolated target/Cargo-home, the installed pinned x86_64 Windows GNU Rust toolchain, a fresh 4 GiB physical / 6 GiB exact commit-headroom launch gate, 1 GiB owned private/working-set caps, 2/2 GiB running floors and the 180-second sampled timeout. Every owned job was closed, remaining owned PID/handle lists are empty, and explicit Popen root-handle cleanup succeeded. No input/fixture/lock/protected C++ bytes changed during either stage.

`RUST-VERIFICATION.json` references hashed raw commands, logs, resource samples, PID/creation identities and cleanup evidence. The exact accepted plan hash is `f3e281b9b899989d026a03b1c8e346dfe202809144540fbada4cea71ca7d37cd`; runner hash is `0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb`. The original shared helper remains untouched at `ae54cce5dbbe2e769d52572528f750b0573ef37fb172cc29db8ab8fa8208a8c3`. An outer owner fixes its setup/query-error cleanup gaps while preserving its exercised execution/resource checks.

`build-plan/execution/native-tests-1/accepted-inputs/` retains all fourteen exact inputs plus the exact accepted plan. The older `SOURCE-CHECKS.json`, `SOURCE-PREPARATION.json` and `SOURCE-REVIEW.md` remain historical source-preparation evidence. After that earlier verification, only tests/lock **comments** were updated; the subsequent reviewed formatting and repeated checks are recorded above. `RUST-VERIFICATION.json` remains unchanged. `FORMAT-NEXT.md` now records the completed workcopy workflow; its previous instructions and this document's preformat bytes are archived in `format-window/`.

The C++ helper/patch remains unapplied/uncompiled. No native producer parity, live C++→Rust/FFI, actual WASM target, browser, input ownership, full canvas, full semantic coverage or whole-game render-purity acceptance is established by these tests. No browser/server, original engine compile/link, Git, credentials, installed tools/cache or external publication was changed.
