# Independent Rust/browser boundary review

Reviewed the migration boundary on 2026-10-02: `port/src/{application,input,platform,wasm}.rs`,
the parameter rendering in `port/src/display.rs`, and
`web/{app,core-debug,storage}.mjs`. Production files were not changed by the
reviewer. This review covers the verification interface and native save adapter;
it does not establish full gameplay or gameplay-localization coverage.

All three findings below are closed by the independent rebuilt-WASM retest
recorded at the end of this document. The initial findings are retained as the
before-change evidence.

The retained independent probe is `tests/review/probe.mjs`; its evidence is
`tests/review/probe-results.json` and `probe-results.initial.json`. It instantiated the built WASM with
official emsdk Node `v24.19.0`. The initial reviewed WASM SHA-256 was
`b9d754419eef20f1206c2a722114588abe7212f540652496bc3fc2d47a68c530`.
The probe runs no native game and does not touch browser storage.

## Findings

### B1 — Medium: seed event loses 64-bit precision across the JS interface

`application::execute(Command::Seed)` originally placed the `u64` seed in
`rng.seed.params.seed` as a JSON number. `web/app.mjs::call` uses `JSON.parse`,
and `redrawLabels` later resubmits those messages to render them in another
language. This converts the exact seed to a JavaScript Number before rendering.

Reproduced against the reviewed WASM:

| Input seed | First Japanese text | English message after JS roundtrip |
|---|---|---|
| `9007199254740993` | `乱数のシード：9007199254740993` | `Random-number seed: 9007199254740992` |
| `18446744073709551615` | `乱数のシード：18446744073709551615` | Rejected: `parameter seed for rng.seed must be an unsigned integer` |

The opaque session string preserves the original RNG state; this finding affects
semantic event fidelity and language switching. Use a validated decimal-text
parameter for the seed at the JS interface, preserving the exact value in both
catalogs. Add a browser-style message roundtrip test for `2^53 + 1` and `u64::MAX`.

At the initial review, the root implementer had changed the source event to
decimal text; rebuilt-WASM confirmation was still pending. See the closure below.

### B2 — Medium: native files may conflict with required directories

`NativeFileSet::validate` rejects duplicate files and unsafe path components,
but the reviewed implementation accepts both `a` and `a/b` as regular files.
Both `pack_native` and `unpack_native` reported success for these paths in either
order. `core-debug.mjs::restoreFiles` then creates parent directories and writes
each regular file. A path cannot be both a regular file and the directory needed
for its descendant, so restoration fails after it has begun writing files.

Reject a native file set when any complete file path is an ancestor of another
file path. Check this before the host receives files or starts writes. Add both
ordering variants to the validation tests. This is a restore-consistency defect;
the existing traversal checks still prevent these files escaping `/persist`.

### B3 — Low: verification counter overflow policy differs by command

An externally supplied opaque session with `draws == rng.count == u64::MAX`
passes the reviewed validation. The probe found:

| Command | Result |
|---|---|
| `sample` | Normal error: `draw count overflow`; no returned session |
| `dice(count=1, sides=2)` | Success; draw count wraps to `0` |
| `dice(count=1, sides=1)` | Success; draw count stays at `u64::MAX`, since no RNG draw occurs |

No WASM panic or trap occurred. PCG's internal diagnostic counter intentionally
uses the upstream unsigned wrapping semantics. The inconsistency is in the
verification application, whose `sample` command uses checked addition while
`dice` copies the PCG counter. Choose one application policy and test it for
caller-supplied sessions. No global session is mutated by a rejected command;
the host retains its previous opaque session when no session is returned.

## Verified behavior

- Changing envelope version, ABI, source commit, payload kind or checksum is
  rejected before the payload is used. FNV-1a is explicitly documented as an
  accidental-corruption check, not proof of origin.
- Native file traversal (`../escape`) and duplicate complete paths are rejected.
  Validation also rejects absolute paths, drive separators, backslashes,
  control characters, empty components and dot components before native writes.
  These conclusions concern browser MEMFS paths, not a Windows filesystem adapter.
- Frame validation rejects zero dimensions, invalid Unicode scalar values,
  colors outside `0..=15`, out-of-range cursors, and incorrect cell counts.
  Frame observation has immutable inputs and no RNG access.
- The actual browser request wrapper keeps its input allocation alive until
  the request returns, reads the current `memory.buffer` after potential memory
  growth, and releases both exact pointer/byte-length pairs in `finally`.
  A normal failed application response follows the same release path.
- Zero-length and greater-than-16-MiB allocations return a null pointer.
  Two thousand repeated input requests used 4,040 allocations and 4,040 releases
  including setup/probes, with memory remaining at 1,310,720 bytes (20 pages).
- The raw ABI requires trusted host ownership of live allocations. Its unsafe
  pointer functions are not self-validating handles; the reviewed `call` wrapper
  satisfies their contract. Arbitrary pointer calls were not exercised as a
  substitute for reviewing the real wrapper.
- IndexedDB saving waits for transaction completion before reporting success;
  error/abort paths reject and close the database connection.

## Remaining verification

The initial B1/B2 retests and B3 policy check have now passed. The review did not
run the full native engine, inspect native DCSS save-tag parsing, test engine
startup-data discovery, or establish complete-game save/resume. Those checks
remain with the full-engine work and publication gates.

## Independent closure after the root fixes

Retested the rebuilt `build/boundary.wasm` with SHA-256
`7d54c8db241ae65832e287b0c41a83645b1ba661a2021ac953fe17c8a92fc0e2`
using official emsdk Node `v24.19.0`. The probe now contains executable regression
assertions, and the run exited successfully. Before-change evidence is retained
at `.build/boundary-review/probe-results.before-fixes.json`; current evidence is
`.build/boundary-review/probe-results.json`.

| Finding | Independent verification | Status |
|---|---|---|
| B1 | `2^53 + 1` and `u64::MAX` remain exact decimal strings in `value.seed` and `rng.seed` parameters after JS parsing and English re-rendering. | Closed |
| B2 | Both `a` / `a/b` orderings are rejected during packing and during unpacking of crafted envelopes with valid checksums. | Closed |
| B3 | `sample` and two-sided dice both wrap the diagnostic counter from `u64::MAX` to `0` and return identical next RNG state. One-sided dice consume no draw and retain `u64::MAX`. No trap occurs. | Closed |

The strict decimal parameter check rejects padded, signed, whitespace-prefixed,
fractional, empty and overflowing strings, as well as a numeric JSON value.
Ordinary unsigned parameters still reject numeric strings; the change does not
weaken their type checks. Envelope metadata rejection and malformed-frame
rejection also continue to pass.

The final probe records 32 checks/setup observations plus a passing regression
assertion record. Its 2,000-request allocation stress section, including preceding
setup/check requests, counted 4,060 allocations and 4,060 releases. Memory stayed
at 1,310,720 bytes (20 pages). No production files were modified by either the
initial review or this independent retest. These results close the three
boundary findings only; full-engine and localization publication gates remain
separate.
