# Phase 1 owned-byte input observation ABI

Status: **two native C++ translation units compiled; live boundary unconnected;
standalone Rust consumer passed 19 tests**. Only the existing single original-engine thread
may call this ABI. [Actual compile proof](build-plan/cpp-compile/compile-verification.json)
establishes isolated wasm32 translation-unit/type/access validity. Final linking,
producer execution, thread safety, Asyncify scheduling, original exports and the
live host/Rust boundary have not been tested. The
[genuine native Rust proof](build-plan/consumer-verification.json) covers
synthetic JSON/transport fixtures, not this original-engine ABI in operation.

## Four synchronous exports

| Export | Contract |
| --- | --- |
| `uint32_t cdda_browser_snapshot_pin(uint32_t kind)` | Kind `1` pins the most recently published live-input snapshot. Returns an opaque nonzero handle, or `0` for no snapshot, unsupported kind, full pin table, or exhausted handles. |
| `const uint8_t *cdda_browser_snapshot_data(uint32_t handle)` | Read-only bytes for that exact live handle, or null. No NUL-terminator contract. |
| `size_t cdda_browser_snapshot_size(uint32_t handle)` | Exact byte count, or zero for an unknown/released handle. A WASM32 build returns a 32-bit size. |
| `void cdda_browser_snapshot_release(uint32_t handle)` | Releases that exact pin. Unknown and zero handles are ignored. Never releases a different pin. |

The internal C++ context and binding pointers never cross these exports.
Serialization completes before an immutable `shared_ptr<const std::string>` is
published. Each pin shares ownership of those bytes; replacement or clearing of
the latest snapshot does not invalidate existing pins. The table has 16 slots.
Handles increase monotonically and are never recycled; exhaustion fails closed
instead of allowing an old handle to address a later pin. Reads and release do
not poll input, render, advance simulation, read a clock, or use gameplay RNG.
They modify only observer ownership metadata. A host must release every pin.

Each snapshot is limited to 256 KiB, each source string to 16 KiB, actions to
2,048, bindings per action to 128, key sequences to 64 integers, and nesting to
64 scopes. Invalid UTF-8, unsupported enum values, allocation/serialization
failure, counter exhaustion, or unsupported state clears the latest snapshot
and leaves original input running. Existing pins retain their bytes. No limits
truncate a partially valid record into misleading input data.

## Notification

Under Emscripten the C++ publication schedules a microtask, then calls the
optional `globalThis.cddaInputSnapshotAvailable(notice)` function. It does not
invoke that host callback inline during publication. The frozen record has:

```json
{"kind":1,"publicationLow":1,"publicationHigh":0,"availability":1}
```

`publicationLow` and `publicationHigh` are unsigned 32-bit halves of a 64-bit
publication counter. Combine them with `BigInt`, not a lossy JavaScript number.
The producer explicitly applies `low >>> 0` and `high >>> 0`, because WASM i32
import arguments can arrive in JavaScript as negative signed values. A tiny
predeclared import-boundary fixture verifies this normalization; it does not
validate the prepared engine or Rust runtime.
Availability `1` means a publication succeeded; `0` means no tracked wait;
`2` means serialization/allocation validation failed; `3` means unsupported
scope/state or exhausted counters. Scheduling, callback, and diagnostic logging
failures are caught. The native non-Emscripten notification is a no-op.

Notifications can be stale when observed. The future host must order notices by
publication generation, pin/copy synchronously, and compare the copied JSON's
`publication_sequence` with the notification. A mismatch is stale, not evidence
that the older context is still active. Unavailable/unsupported observations
must disable context-dependent helper execution and retain native input.
Microtask ordering across the real Asyncify input suspension remains an actual
engine/browser test requirement.

Publication generation zero with availability `3` is reserved for exhausted
counters and must clear host context-dependent state even if the host's last
generation was greater. It is terminal unavailable state, not an older ready
publication. Pin failure also keeps native input active and must not reuse a
previous snapshot to authorize helper commands.

## Copy protocol for the future host

1. Ignore unsupported kinds or older notification generations.
2. Call pin with kind `1`. A zero handle is an unavailable result.
3. In `try/finally`, read data and size. Require a nonzero pointer, a positive
   size no larger than 262,144, and `size <= heap.byteLength - pointer` after
   checking that the pointer is within the current heap view. Resolve the
   current `Module.HEAPU8`; a cached view may be detached after heap growth.
4. Immediately copy `Module.HEAPU8.slice(pointer, pointer + size)` into an owned
   JS byte array. Do not retain the original view or cross an asynchronous
   boundary while borrowing it. Release the pin in `finally` even on failure.
5. Decode with a fatal UTF-8 decoder. Validate the schema, source commit, build
   identity, field bounds/types, and matching publication generation before
   supplying owned records to Rust. The future Rust API must accept owned
   copied data and expose no borrowed engine memory.

This protocol is not integrated host code and has no browser acceptance result.

## Snapshot schema

The interface discriminator is `cdda-live-input-snapshot/1`; `schema_version`
is `1`. Required fields are:

| Field | Source and meaning |
| --- | --- |
| `source_commit`, `engine_build_id` | Pinned upstream identity and required integration build macro. |
| `publication_sequence`, `context_epoch`, `parent_context_epoch` | Unsigned decimal strings preserving all 64 bits; parent `"0"` denotes no parent. A restored parent's epoch stays the same but its publication generation increases. |
| `depth`, `phase` | Tracked nesting depth and literal `"input_wait"`. |
| `category` | Exact original `input_context::category`; never translated. |
| `text_policy` | Exact `STRING_INPUT` yields `"raw_utf8"`; all other categories yield `"native_context"`. This is recognition only, not a complete classification of every text editor. |
| `preferred_keyboard_mode` | Original context preference, `"keychar"` or `"keycode"`. It does not claim the effective SDL mode after a platform capability fallback. |
| `effective_timeout_ms` | Current original input-manager timeout after this wait's setup. |
| `registered_any_input`, `coordinate_input_enabled`, `iso_mode` | Original context flags. Coordinate values are not exported. |
| `binding_authority` | Literal `"original_action_contexts_const_lookup"`. |
| `actions` | Ordered original registered action list. Entries contain index, exact action `id`, origin, and effective binding descriptors. |

Binding origin is `"context"`, `"default"`, or `"missing"`. Lookup follows
the original resolver's precedence: a present local action wins even if its
vector is explicitly empty; only absent local actions fall back to the default
context. A missing default action is exported with an empty vector and
`"missing"`, without creating a native entry. Observation must not call
`get_input_for_action`/`get_action_attributes`, because the latter can insert
missing default entries and translate names.

A binding descriptor carries the original event type (`error`, `timeout`,
`keyboard_char`, `keyboard_code`, `gamepad`, or `mouse`), modifier names in
source set order, integer `sequence`, and exact UTF-8 `text`, `edit`, and boolean
`edit_refresh`. These are source binding records, not a just-accepted raw input
event. They do not include live pointer coordinates, map targets, translated
key names, semantic text parameters, or gameplay state.

## Scoped attachment and restoration

The hook runs after the original wait sets its timeout and before it resets
`next_action.type`. Its RAII scope serializes registered actions with const
table lookups. Scope exit occurs after the original normal timeout restoration.
A nested scope restores and republishes its parent using current bindings, so
changes made by a nested keybinding editor are observed without stale pointers.
The outermost scope exit clears availability. Original exception behavior is
unchanged: the scope restores observer nesting during unwinding, but does not
add a missing native timeout-restoration exception guarantee.

Publication occurs on tracked wait entry and nested return, not each SDL poll.
Direct input readers are not tracked. Original action resolution, isometric
direction transformations, keycode capability fallback, `TEXT.CONFIRM`, raw
name editing, physical keyboard events, and input consumption remain C++ work.
No action is sent or discarded by this snapshot. Uppercase `S` save/quit,
`.` pause, and `|` wait remain native behavior; the current bounded Rust helper
must not reinterpret them using this unconnected observer.

## Real-engine acceptance still required

- Build/export verification against the complete isolated original source copy;
  all four exports callable, expected schema/build identity, native input works.
- Read the real map/context tables before and after observation. Local empty
  override, default fallback, and missing registered actions retain exact native
  precedence and sizes; no name translation or lazy insertion occurs.
- Open nested help/keybinding waits, edit bindings, cancel/confirm, and return.
  Parent epoch, updated binding vectors, original timeout, and no stale scope
  are observed on normal exits; exception behavior is assessed explicitly.
- Exercise original `STRING_INPUT` with Japanese, emoji, raw usernames, IME,
  `TEXT.CONFIRM`/`TEXT.QUIT`, and keychar/keycode platform fallback.
- Hold pins across replacement and clear, fill/release slots, probe unknown
  handles, force bounded failures, and grow the WASM heap. Old owned bytes stay
  valid and observer errors cannot escape into the original wait.
- Capture original turn state, RNG engine/distribution capsule and action
  tables before/after repeated observer copies. Observation alone changes none
  of them. Separately assess the already identified weather/input-wait RNG
  issue: normal animated engine waits still advance gameplay RNG, so this test
  does not establish whole-game draw purity.

No item in this acceptance list has been executed for this overlay.

## Rust consumer source addendum

[rust-snapshot-consumer](rust-snapshot-consumer/README.md) supplies an isolated
reusable library with a genuine Rust owned parser. `BuildIdentity` pins the
expected build, `parse_snapshot` validates the exact schema/source identity and
bounds, and private `ContextSnapshot`/`RegisteredAction`/`BindingDescriptor`
records expose read-only accessors. Unknown/duplicate JSON fields, numeric or
noncanonical decimal counters, inconsistent epoch structures, incorrectly
ordered modifiers, and nonempty missing bindings are rejected.

`SnapshotTransport` models the four original-module exports with synchronous
`snapshot_pin`, `snapshot_data`, `snapshot_size`, `snapshot_release`, plus
`heap_length` and an owned `copy_owned` adapter. Address/size are WASM32 integers,
not Rust pointers. `copy_owned_snapshot` validates the original heap range and
uses a pin guard to release every successful pin on normal/error exits before
parsing. The adapter must recheck the current original heap during the copy;
no direct raw-pointer FFI or browser implementation is supplied.

`Notice::from_parts` consumes normalized u32 halves. `SnapshotConsumer` orders
by publication, accepts a restored parent's older epoch at a newer publication,
ignores older/equal repeats, and clears state on equal contradictory notices,
new copy/parser/generation failures, unavailable notices, and invalid raw notice
parts. Zero generation with availability `3` is sticky terminal state. Creating
a replacement tracker requires a fresh explicit engine instance. Pinned copies
remain historical observation data and never authorize commands.

`command_authorization` always returns `Denied(UntrackedNativeReaders)`; the
type has no allowed variant. C++ owns input consumption, gameplay, rendering,
and RNG. This is not a renderer or connected WASM frontend migration.

The crate reuses exact existing serde/serde_json lock records. Actual native
Cargo `--offline --locked` acceptance, compilation and **all 19 tests passed**
in the separately reserved one-worker window. Current evidence is
[build-plan/consumer-verification.json](build-plan/consumer-verification.json).
It establishes strict owned parsing, fake-transport pin release and notice
state handling; it does not establish native serialization, real exports or
host/current-heap copying. Formatter/Clippy checks and runtime ABI integration
remain pending. Source review also identifies missing exact-copy-length,
high-bit/end-of-heap success, heap-growth and exact-limit acceptance assertions.
The three synthetic schema fixtures and historical 218 Node assertions remain
recorded in `SOURCE-PREPARATION.json`; those older assertions did not execute
Rust and are preserved as preparation provenance.
