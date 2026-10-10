# Resumed authoritative-engine work

Source remains Cataclysm:DDA 0.I-1, commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. Gameplay remains in original C++.
This increment is incomplete; complete gameplay, semantic-ID migration,
determinism, render purity, save compatibility and PC/mobile browser flows are open.

The unchanged original runtime remains at <http://127.0.0.1:8878/>.
The independent v5 variant is at <http://127.0.0.1:8878/v5/index.html>.
No external hosting or Git operations were performed.

## Verified boundaries

- `input-context-live-slice/ORIGINAL-CONTEXT-VERIFICATION.json`: fifteen WASM
  cases execute selected byte-exact original `input_context`/manager definitions
  with official headers, the genuine original string interner and read-only hook.
  Twenty-four exact native JSON records result. Hardware polling and nested menu
  drawing are scripted leaves. This is not execution of the complete original
  input UI or game. Five genuine Rust tests then consume all twenty-four exact
  records, with 540 protected inputs unchanged and exact owned resources closed;
  see `ORIGINAL-CONTEXT-RUST-VERIFICATION.json`. Browser Rust consumption remains
  unconnected. Command authorization remains denied for untracked native
  readers. Snapshot records contain context/binding metadata; raw user input has
  its own transport and must not be translated.
- `semantic-display-live-slice/COMPILE-VERIFICATION.json`: six actual C++ units
  compile. Original help/input/context, semantic helper/transport, and real-loader
  fixture compile with all 1,210 protected inputs unchanged. The producer has not
  yet linked/executed or reached Rust/browser consumers. Native gettext rendering
  remains authoritative during this transition.
- `v5-runtime-integration/`: five genuine Rust tests, formatting, Clippy and the
  dependency-free WASM build pass. The 1,392-byte module exports immutable asset
  validation and three native string defaults. Actual WASM passes 1,567 ABI
  assertions and accepts all six pinned parent files. Fifteen host checks and
  five generated restore-hook checks pass; filesystem/sync/MO callbacks in those
  restore checks are explicit doubles. All seventeen actual localhost files
  match delivered byte hashes; the fetched WASM validates the fetched assets.
  Original engine/index/package bytes are unchanged. Original C++ still owns
  options scanning, image rendering, IDBFS, gameplay and RNG. Browser rendering
  and actual profile restoration have not been verified for this variant.

## Next original-engine build

`full-engine-overlay-plan/` prepares a coherent source tree and exact dependency
closure: 231 existing units plus four new helpers require compiling; 207 original
objects may be reused after command/dependency verification. The resulting link
has 442 objects and preserves the proven conservative `-O1` Asyncify link.
Source plan preparation is not a completed build.

The separate v2 candidate adds the three authorized cosmetic draw changes in
`cata_tiles.cpp` and `overmap_ui.cpp`; both units already belong to the 231-unit
rebuild set. The v1 tree is retained byte-for-byte. Removing those cosmetic
draws changes the shared original RNG sequence, so modified-build gameplay
replays require fresh evidence. Original native saves remain authoritative;
no independent RNG capsule or replacement save format is introduced.

The original-input records are context and binding metadata, not translated
user payloads. A separate synchronous observation fixture is being prepared
to connect the actual original producer and Rust WASM transport. That fixture
will not establish SDL/IME delivery, an Asyncify waiting context, or a full
game command boundary. The accepted native input proof remains unchanged.

The successful original link used 3,559,145,472 bytes privately and 229.930
seconds, so a 1 GiB/180-second compile owner cannot run it. A separate reviewed
link owner and fresh resource check are required. No original runtime is replaced
by an unfinished candidate.

The fresh browser assessment at 2026-10-03T00:19:41.0781338Z measured
5,962,932,224 available physical bytes and 10,151,190,528 exact commit headroom.
The unchanged 7/9 GiB gate fails on physical availability. The single accepted
browser candidate remains unconsumed. No other task/process was stopped.

Source/build proofs preserve CC BY-SA upstream and dependency/font notices.
Parent v5 artwork is copied with its exact NOTICE; no blanket OSS grant for that
artwork is inferred. It remains a local asset set and does not cover every dynamic
sprite, mod, season or overlay.
