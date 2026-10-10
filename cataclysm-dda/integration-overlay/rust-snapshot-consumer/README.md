# Rust immutable input snapshot consumer preparation

**Rust compilation and runtime pending. Unconnected to both WASM modules.**
This standalone reusable library consumes the exact Phase 1 C++ snapshot
schema. It does not change `rust-browser-bridge`, its existing compiled artifacts
or source hashes, the original engine, or the baseline shell. Original C++ keeps
canonical gameplay, input consumption, rendering, save operations, and RNG.

The genuine Rust implementation includes:

- `parse_snapshot`: fatal UTF-8, strict schema/field/enum decoding, exact pinned
  upstream commit and expected build identity, bounded owned strings/lists,
  decimal-string `u64` counters, ordered actions, empty binding origins, source
  modifier order, and structural epoch validation.
- `ContextSnapshot`, `RegisteredAction`, `BindingDescriptor`: private owned
  records with read-only accessors. Validated snapshots have no public
  deserialization or mutation bypass. Binding text/edit fields are preserved
  exactly; these are metadata, not accepted raw text events or usernames.
- `SnapshotTransport` and `copy_owned_snapshot`: a synchronous safe adapter
  contract for the four original-module exports, checked WASM32 heap ranges,
  immediate owned copy, and RAII release on success/error before parsing.
- `Notice` and `SnapshotConsumer`: lossless unsigned notice halves, publication
  ordering independent of restored parent epochs, stale/equal conflict handling,
  clear-on-new-error behavior, and sticky terminal zero-generation exhaustion.
- `command_authorization`: always `Denied(UntrackedNativeReaders)`. This slice
  has no allowed-command variant and never maps or executes native actions.

`STRING_INPUT` recognition preserves `raw_utf8` metadata. It does not replace
native `TEXT.CONFIRM`/`TEXT.QUIT`, effective SDL keyboard-mode fallback, IME,
coordinates, or text editing. `.` pause, `|` wait, uppercase `S` save/quit,
unregistered native actions and physical input retain their original behavior.
Typed metadata cannot prove that an untracked SDL/ImGui reader is inactive.

## Prepared dependencies and fixtures

The only direct dependencies are the existing exact cached versions
`serde = 1.0.229` and `serde_json = 1.0.151`. `prepare-fixtures.mjs` copies
their registry package closure byte-for-byte from `rust-contracts/Cargo.lock`
into the standalone prepared lock. No Cargo resolver, dependency download,
compiler, Rust formatter, or Rust test runner was invoked. Actual offline/locked
Cargo verification is pending.

The three JSON fixtures are **synthetic schema examples, not engine captures**.
They deliberately include source-backed action IDs/key distinctions, empty local
and missing origins, raw UTF-8 binding metadata, all six event types, signed
32-bit sequences, a counter above `2^53`, and `u64::MAX`. Their reduced binding
lists do not inventory all native bindings. Fixture text is not a live user
input event; no source gameplay translation consumer is connected.

```powershell
node integration-overlay/rust-snapshot-consumer/prepare-fixtures.mjs
node integration-overlay/rust-snapshot-consumer/validate-fixtures.mjs
```

The Node validator checks only fixture shape/provenance and source properties.
It does not run or substitute for the Rust parser/tests. Results and pending test
names are in `SOURCE-PREPARATION.json`; lock provenance is in
`DEPENDENCY-PREPARATION.json`.

## Required later build and integration

After the reserved heavy original-engine work finishes, use a separate target
directory and one job for the first offline/locked Cargo check/test. Run formatter
and Clippy, then execute all pending tests before considering this crate tested.
Do not infer real-engine behavior from its synthetic transport tests.

The first pending test command is:

```powershell
cargo test --manifest-path integration-overlay/rust-snapshot-consumer/Cargo.toml --offline --locked --jobs 1 --target-dir integration-overlay/rust-snapshot-consumer/target-isolated
```

This command has not been run. The prepared lock must be validated by Cargo;
source/fixture validation does not substitute for dependency resolution.

An adapter still needs to connect the original module's exported snapshot API
to `SnapshotTransport`. On every copy it must resolve the current ORIGINAL
`Module.HEAPU8`, recheck the range, return a newly owned byte vector, and release
the exact handle synchronously. Engine heap addresses do not address this Rust
module's memory. This crate intentionally contains no raw-pointer FFI, imported
engine symbols, JavaScript bindings, or WASM export surface. A safe host adapter
and an explicit owned-byte call into a separately built Rust module are future
work, with their own tested ABI. The transport trait is source design rather
than a live browser implementation.

Install the notification callback before original-engine startup. Create one
consumer per engine instance using the exact expected integration build ID.
Normalize JavaScript import halves to unsigned values before `Notice` decoding.
Release/copy before awaiting. Clear observation for untracked waits and host
errors; never use historical pinned bytes to authorize input. A terminal
counter-exhaustion consumer is replaced only for an explicitly fresh engine
instance, not reset to accept older notices from the same engine.

Then test the patched original engine's real nested waits, binding edits, raw
Unicode/IME, pins across heap growth, and observer purity with full native state
and RNG evidence. That acceptance remains open. The original weather/input-wait
gameplay-RNG issue remains a release blocker. See [ABI.md](../ABI.md) and
[CPP-RUST-BOUNDARY-NEXT.md](../../docs/CPP-RUST-BOUNDARY-NEXT.md).

This source is CC BY-SA 3.0; retain [NOTICE.md](../NOTICE.md) and
[LICENSE-UPSTREAM.txt](../LICENSE-UPSTREAM.txt) with corresponding source.
