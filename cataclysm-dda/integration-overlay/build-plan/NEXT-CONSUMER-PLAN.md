# Native snapshot and cosmetic Rust consumers

This retains the source-only plan prepared before compilation.
`next-consumer-build-plan.json` contains exact commands, unchanged
source/fixture/lock hashes, cached dependency pins, test names and remaining
fidelity gates.

The subsequent explicit reservation completed successfully: **19/19
snapshot and 5/5 cosmetic tests passed**. Both prepared locks were accepted
offline/locked, all source/fixture/lock fingerprints stayed unchanged, and
both owned jobs ended empty/closed. Current scoped proof is
`consumer-verification.json` and
`../../cosmetic-purity-overlay/build-plan/consumer-verification.json`.
Snapshot compilation/testing took 23.414 seconds at 296,194,048 peak private
bytes; std-only helpers took 1.044 seconds at 143,798,272 bytes. The following
plan is retained as pre-execution provenance. Future runs need a new slot.

The first stage targets the actual existing
`integration-overlay/rust-snapshot-consumer/Cargo.toml`, auto integration
target `contract`: 19 tests. Its prepared lock has the same 11 exact registry
packages previously checksum/source-verified for the successful semantic
consumers. Actual acceptance of this standalone lock is pending. It depends
only on serde/serde_json, not the shared `rust-contracts` packages.

The second stage targets `cosmetic-purity-overlay/build-plan/Cargo.toml` with
`--lib`: five tests. The owned manifest preserves the existing std-only
manifest except for redirecting the library path to the unchanged real
`../rust/src/lib.rs`. Its owned lock has one local package and zero registry
packages. This keeps new lock, target and evidence files in `build-plan`
without editing the original crate or helper/test sources. It is not a
different implementation or a mocked replacement.

Both commands use the exact installed GNU native Cargo/rustc/linker paths,
`--offline --locked --jobs 1`, `--target x86_64-pc-windows-gnu`, isolated
owned target directories, and `--test-threads=1`. One codegen unit, no debug
information and no incremental compilation bound load. The proposed
entrypoint after a new explicit release is:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' integration-overlay/build-plan/run-next-consumers.py --parent-released-window
```

The wrapper imports the hash-pinned Windows job/identity guard already
exercised by the genuine 315-literal/155-plural tests. It verifies source and
cached archive hashes before execution and source hashes afterward. Each
stage needs fresh 4 GiB physical / 6 GiB exact commit headroom, enforces a
1 GiB owned-job private cap and summed working-set cap, keeps 2 GiB physical
and commit running floors, and times out at 180 seconds. Only its suspended,
identity-pinned root and OS-owned descendants can be terminated. No browser,
compiler or unrelated process is stopped to obtain headroom. The release
flag alone does not authorize a new window.

Estimated unmeasured durations are 20–40 seconds for the snapshot crate with
a fresh target and 1–10 seconds for the std-only helpers. A private peak below
400 MiB is an estimate based on the preceding actual serde/syn jobs, not a
guarantee. The hard cap and gates decide whether execution continues.

Independent source review found no concrete Rust compile/API/path error.
The following meaningful coverage gaps remain; the current plan preserves
source and does not silently claim that compilation fixes them:

- Snapshot `FakeTransport::copy_owned` ignores the requested length. Exact
  length, successful high-bit addresses, exact heap-end acceptance and live
  current-heap growth/recheck behavior need explicit tests.
- Parser limit tests reject limit-plus-one inputs, but do not establish
  acceptance at every exact action/binding/key-sequence/depth limit.
- Cosmetic tests do not assert Followers results, exact NPC-key goldens or
  the third empty-ID weather golden. Complete native/Rust fixture-set parity
  requires an actual harness calling `cpp/cdda_presentation_hash.h`.

Successful execution would establish actual standalone Rust parser,
ownership/RAII, notice-state and pure-helper behavior against the prepared
synthetic tests. Both crates remain outside shared-layer/live-engine
consumption. Original C++ serialization and four exports, host copy/heap
growth, Asyncify/nested waits, native binding precedence, native helper and
real caller parity, weighted/animated rendering, authoritative-state/RNG
purity and browser/game flows remain pending. No existing source, public
catalog, upstream checkout or gameplay is changed by this preparation.
