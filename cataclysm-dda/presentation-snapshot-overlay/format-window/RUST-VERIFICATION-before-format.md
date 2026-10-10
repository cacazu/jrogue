# Actual isolated Rust parser verification

The five existing tests of the real std-only owned parser **passed**, followed by **Clippy `--lib --tests -- -D warnings`**. The fixture frames are synthetic source-bound binary records, not output observed from compiled C++ or a browser.

| Reserved stage | Duration | Owned job peak private bytes | Result |
|---|---:|---:|---|
| Five host Rust parser tests | 1.044 s | 151,928,832 | 5 passed; 0 failed/ignored/filtered |
| Clippy, warnings denied | 0.800 s | 148,320,256 | Passed |

Both commands used offline/locked Cargo, one Cargo job and one test thread, an isolated target/Cargo-home, the installed pinned x86_64 Windows GNU Rust toolchain, a fresh 4 GiB physical / 6 GiB exact commit-headroom launch gate, 1 GiB owned private/working-set caps, 2/2 GiB running floors and the 180-second sampled timeout. Every owned job was closed, remaining owned PID/handle lists are empty, and explicit Popen root-handle cleanup succeeded. No input/fixture/lock/protected C++ bytes changed during either stage.

`RUST-VERIFICATION.json` references hashed raw commands, logs, resource samples, PID/creation identities and cleanup evidence. The exact accepted plan hash is `f3e281b9b899989d026a03b1c8e346dfe202809144540fbada4cea71ca7d37cd`; runner hash is `0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb`. The original shared helper remains untouched at `ae54cce5dbbe2e769d52572528f750b0573ef37fb172cc29db8ab8fa8208a8c3`. An outer owner fixes its setup/query-error cleanup gaps while preserving its exercised execution/resource checks.

`build-plan/execution/native-tests-1/accepted-inputs/` retains all fourteen exact inputs plus the exact accepted plan. The older `SOURCE-CHECKS.json`, `SOURCE-PREPARATION.json` and `SOURCE-REVIEW.md` remain historical source-preparation evidence. After successful verification, only the current tests/lock **comments** were updated to remove stale pending-execution claims; tested Rust behavior is unchanged. Future run pins must be refreshed before use. `FORMAT-NEXT.md` describes the narrow remaining formatting window.

The C++ helper/patch remains unapplied/uncompiled. No native producer parity, live C++→Rust/FFI, actual WASM target, browser, input ownership, full canvas, full semantic coverage or whole-game render-purity acceptance is established by these tests. No browser/server, original engine compile/link, Git, credentials, installed tools/cache or external publication was changed.
