# Version 3 pending-prompt replay: source integration

Status: source integrated and lightweight transport checks passed. This phase
has **not** been compiled or accepted in a real browser by this owner. Root
coordinates the single measured Rust/WASM build and subsequent browser gate.
The previous accepted WASM is separate evidence; it does not validate v3.
This milestone is local HTML plus Node only, with no external publication.

## What is implemented

`rust/src/replay.rs` owns a checked v3 codec, complete bootstrap, ordered
platform journal, pending target and failure-atomic replay cursor. It records
every returned native terminal request, including nonblocking empty polls,
the actual native enqueue result, accepted-delivery ordinal, discarded flush
queue and source-identified clock/filesystem outcomes. Empty host checks
inside one still-pending blocking request are not separate native returns.
It never invokes C, draws, accesses files or advances RNG.

`rust/src/input.rs` describes normalized keyboard, mouse, logical resize and
native button events, with owned text/IME group metadata. `platform.rs` keeps
v1/v2 decoding unchanged and names the independent v3 version. The new bridge
in `replay_bridge.rs` is owned by the Rust bridge agent. It copies all FFI
spans synchronously and computes wait evidence from all54 native words,
current cached Rust cells and canonical semantic source facts. Rendered
English/Japanese strings do not enter the evidence digest.

`main-web.c` captures all38 post-init RNG words before birth, enters a replay
wait before dispatch, dispatches exactly one original native event, then
commits its actual result. A verified target callback runs only after the
Rust borrow is released. V3 saves serialize owned replay state at that same
pending request; they do not invoke `savefile_save`, redraw, descriptors or RNG.
The original stable-boundary native writer remains the disabled-replay path.

`web-replay-environment.[ch]` supplies the original result once in live mode
and recorded owned facts in replay mode. Twelve audited source calls cover
seasonal monster selection, RNG initialization and temporary-name RNG,
death/retirement, score dates and default output filenames. Central
`file_exists`/`file_newer` seams validate the original path arguments and
selected boolean outcome. There is no global Date override or sleep change.

`web/worker.js`, `library.js` and `protocol.js` implement the owning transport.
Before `ab_run`, the worker snapshots mutable isolated MEMFS under `/data/user`,
`/data/save`, `/data/panic`, `/data/scores`, `/tmp` and `/home`; the native
`/data/save/browser` bootstrap payload is carried separately. Directory order,
file bytes, permissions and integer timestamps are retained. Incoming snapshots
are fully validated before any MEMFS mutation. Packaged gameplay data is
identified by the build data digest and cannot be replaced by environment paths.

Catch-up rejects live input/save requests and suppresses outward frames,
state, presentation, logs and persistence while rebuilding Rust caches. At
the exact verified target, the worker copies the saved queue and opaque draft,
restores the next text-group counter, reads the current pure Rust frame, then
exposes ready/frame/state/presentation/draft. It does not request a C redraw.

## Bootstrap and compatibility

New games use their chosen seed, full post-init RNG and pre-run MEMFS overlay.
Loaded games retain their complete original native payload and original load
mode: legacy plain loads never install a checkpoint RNG; checkpoint loads
reinstall the validated original38 words through the existing native checkpoint
path. A legacy key-only journal is not guessed into a timed continuation.

V1/v2 remains directly readable at its original envelope cap. A fresh native
load whose payload fits16MiB becomes the explicit starting point for later v3
capture. Larger otherwise-readable legacy native payloads keep their direct
legacy load path; they cannot acquire the approved bounded v3 bootstrap.
Failed v3 prepare/unwrap aborts start and never falls back to a legacy decoder.

The complete bootstrap prefix remains the anchor. No optimized native save
anchor is enabled: native writers omit ancillary UI/config state and can
disturb gameplay, viewport, messages and RNG ordering.

## Transport contract

The manifest `replayIdentity` must contain exactly four64-hex digests, ordered
engine WASM, packaged data, Rust input source and semantic-presentation source.
They cross the ABI as128 owned bytes.

Each event is16u32 words:
`kind, code, mods, x, y, button, width, height, origin, groupLo, groupHi,
scalarIndex, scalarCount, 0, 0, 0`.
Kinds are0empty,1keyboard,2mouse,3logical resize and4native button. Keyboard
facts must already satisfy the source normalization contract. Mouse uses
byte-grid coordinates and four-bit button/modifiers; resize is1..255 each.
Text/IME origin2/3 commits are atomic groups of native keyboard scalars, with
nonzero64-bit group identity and exact scalar index/count. External text is
opaque and never translated. Overflow rejects the entire group and retains
the user's draft.

Browser context is exact JSON:
`{schema_version:1,next_group:[lo,hi],draft:{text,composing,selectionStart,
selectionEnd,selectionDirection,focused}}`. Selections use DOM UTF16 offsets;
committed delivery uses Unicode scalars. JSON contains no floats or pointers.
The bridge validates group high-water ordering. Pending snapshots are copied
before SAVE and FLUSH. A JS validation/allocation failure explicitly poisons
Rust capture rather than installing an assumed empty queue.

Setup ABI (status0 or ReplayError40..46):

- `ab_rs_replay_prepare(identity,128,kind,seed,nativeLoadMode,native,nativeLen,
  rng,rngWords,environment,environmentLen)`.
- `ab_rs_replay_unwrap(envelope,len,identity,128)`.
- Bootstrap getters `kind`, `seed`, `native_load_mode`, `native_data/len` and
  `environment_data/len`, all prefixed `ab_rs_replay_bootstrap_`.
- `ab_rs_replay_pending_set(words,packetCount,context,contextLen)`.
- Verified target getters `ab_rs_replay_target_pending_data/count` and
  `ab_rs_replay_target_context_data/len`.

Runtime declarations are in `web-replay-environment.h`. Wait modes0live,
1recorded,2verified target now live,3mismatch. Environment BEGIN peeks;
COMMIT consumes only the exact source site/type/facts. Host callbacks are
`ab_host_event`, `ab_host_sync_pending` and `ab_host_replay_target`.
No Rust borrow or external buffer pointer survives a callback or Asyncify yield.

Death-cause and retained-score metadata are independently validated v1
extensions, installed from the bootstrap before running and compared/restored
at the verified target. Missing imported provenance stays explicit; a failed
new causal capture blocks a new save.

## Bounds and checks

Total v3 envelope40MiB; native bootstrap16MiB; initial environment4MiB;
journal8MiB and262144 entries; browser context8MiB; aggregate extensions1MiB;
pending queue256 events; individual text/draft64KiB UTF8. Environment has at
most16384 entries and normalized paths shorter than4096 UTF8 bytes. Every
overflow refuses new saving and keeps previous persisted state; there is no
silent truncation or prefix eviction. Root measures actual runtime memory.

Executed by this owner:

- `node --test tests/replay-source-integration.test.mjs`:10/10 passed.
- `node --check` for worker, library and protocol: passed.

The Node suite exercises native call preservation, source-only FFI alignment,
zero-event schema, identity/caps, keyboard/mouse/resize rejection, supplementary
Unicode, whole-group overflow, catch-up effect gating, copied pending queue and
draft, verified-target restoration and isolated filesystem validation.
Rust model/bridge test sources are present; Root owns their execution gate.

Replay-only stripping reconstructs exact pinned pre-phase bytes in mon-make,
z-rand, score and z-file. All12 original clock call expressions remain exact
in their native conditional branch. Later authorized domain/death/check/editor
hooks changed the other three files after these snapshots; their owners must
compose their own reconstructions. A separate newline-parity issue in those
later phases was reported to Root and their owners, not normalized away here.

Still required: measured Rust/WASM compilation, engine export/link checks,
and browser uninterrupted-versus-resumed comparisons at birth/editor/nested
prompts/More/store/help/options/target/death. Compare full RNG, cached cells,
source context, metadata and subsequent identical inputs; include queued flush,
mouse/resize/text/IME, seasonal clocks/timezone changes, panic/overwrite,
hallucination/animation and manual viewport. Until those pass this is an
integrated source milestone, not accepted complete pending-prompt resume.
