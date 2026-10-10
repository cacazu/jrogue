# Next original C++ / Rust boundary milestone

Status: source-reviewed proposal, not an implemented engine bridge. This document
was written while the original-engine Asyncify build had the reserved heavy-work
slot. No compilation, packing, browser execution, original-source edit, or Git
operation was performed for this proposal.

The gameplay engine remains original C++, pinned to Cataclysm: DDA **0.I-1**,
commit `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. References below are to the
actual pristine `src/` files at that commit. Changes belong in a separately
recorded integration overlay, with a reversible patch and source hashes.

## What is connected now

`rust-browser-bridge` runs the existing Rust input and presentation crates in
real WASM. It formats the 27 browser-shell messages plus 29 static contract
entries and resolves a bounded set of helper controls. It has no engine handle
or host imports. The baseline owner has prepared its shell hooks; full-engine
browser validation remains separate.

Its `menu` context is supplied by the shell, rather than the original engine.
It emits observed default native keys and leaves physical keyboard/IME/text
input and unsupported keys on the original SDL path. It does not obtain live
registered actions, layered user bindings, native observations, native world
save bytes, or an RNG capsule from the complete engine. The Rust `EngineBridge`
trait and versioned `platform` envelope have no complete-engine implementation.
The original-C++ RNG adapter is verified in isolated fixtures; the inspected
`engine-build/build-engine.mjs` has no RNG snapshot or browser-boundary exports.
None of these facts establishes a complete Rust renderer or deterministic
whole-game save/resume.

## Exact source entry points

| Original source | Actual behavior | Proposed attachment |
| --- | --- | --- |
| `main.cpp:856–864` | Opens the original main menu, then loops on `do_turn()`. | Publish top-level phase changes; retain this loop. Do not export a browser-callable `do_turn` function. |
| `input_context.h:40–144` | Category/registered-action state is internal. Context stack, public category/action getters, and `allow_text_entry` are under `__ANDROID__`. | The Phase 1 member-defined hook supplies const internal views using existing private access and input-manager friendship, without changing class headers. Do not assume the Android stack exists in the browser. |
| `input_context.cpp:434–492` | `handle_input(timeout)` polls `inp_mngr`, resolves registered actions, handles global language/help behavior, and restores timeout. | A scoped context publication around this actual input wait, including restoration after nested waits and all exits. |
| `input_context.cpp:140–154` and `input.cpp:754–822` | `input_to_action` uses `get_input_for_action(action, category)`; its resolver lazily inserts missing default actions. | Observe the same local/default precedence with a const lookup in the original `action_contexts` table. Preserve empty local overrides and report missing actions as unbound without creating entries. |
| `string_input_popup.cpp:110–136, 468–507` | `STRING_INPUT`, keychar mode, `TEXT.CONFIRM`/`TEXT.QUIT`, raw UTF-8 editing and original history/confirmation. | Mark this recognized context as raw text; retain the original editing and IME path. Generic UI `CONFIRM` is not the source action `TEXT.CONFIRM`. |
| `game.cpp:2563–2594` | `handle_mouseview` calls `ctxt.handle_input`, mutates live-view state, and can redraw while processing mouse movement. | Record accepted input/timeout events. Never call this function from an observation getter. |
| `handle_action.cpp:244–455, 3089 onward` | `get_player_input` includes animation preparation; `handle_action` also handles automatic movement, activities, and nested menus. | Publish bounded receipts after original action handling; distinguish user input, automatic progression, timeout, and UI-only input. |
| `do_turn.cpp:455–779` | Advances world systems and time, and may execute several actions before a turn completes. | Publish a completed-turn receipt at existing return points. A command, input event, and turn are separate counters. |
| `game.cpp:4172–4211`; `ui_manager.cpp:358–468`; `sdltiles.cpp:539–567` | Native draw updates caches/callbacks and presents SDL output. | Preserve native rendering first. Observation reads must not call these functions. |
| `game.cpp:3481–3695`; `savegame.cpp:84–154` | A native save spans character, maps, factions/missions/NPCs, UI state, and other files; the displayed JSON serializer is only one part. | Queue a checkpoint at a supported engine boundary, then pair a complete unchanged native file set with the RNG capsule. |
| `game.cpp:3204–3384` | Native load initializes a world, reads multiple components, runs load events/EOCs, and rebuilds caches. | Restore RNG only after successful native reconstruction and before any resumed input/turn processing. In-place whole-world rollback is not supplied by this API. |
| `main.cpp:575–615`; `filesystem.cpp:60–63, 176–178` | Original C++ owns IDBFS mounting; native file operations request an asynchronous, coalesced `syncfs(false)`. | Coordinate persistence completion and a checkpoint-generation commit. Preserve sole mount ownership. |

The source-prepared phase-one hook now constructs internal read-only views in
`input_context::handle_input`, whose existing friendship permits const access
to `input_manager::action_contexts`. Its non-capturing callbacks retain that
member's access rights; no public/Android-only accessor or class-header change
is required for this first slice. The views' pointers never cross FFI.
`input_enums.h` defines the original event type,
modifier set, key sequence, mouse coordinates, and UTF-8 `text`/`edit` fields.
Copy their meaning into explicitly versioned owned records. The Android-only
`allow_text_entry` flag cannot be used as a browser-wide text policy. Initially
recognize only the inspected `STRING_INPUT` producer; leave unknown contexts
on the native path until their producers are reviewed.

## Release blocker: weather animation consumes the gameplay RNG while waiting

The complete inspected call path is:

```text
main.cpp:864                   while (!do_turn())
  do_turn.cpp:588              g->handle_action()
    handle_action.cpp:3120     get_player_input(action), when no auto/menu branch
      handle_action.cpp:244    game::get_player_input
        ANIMATIONS enabled; weather symbol present; ANIMATION_RAIN enabled
        ctxt.set_timeout(125) at handle_action.cpp:334
        do/while animation loop at handle_action.cpp:347–440
          handle_action.cpp:360
            rng(iStart.x, iEnd.x - 1)
            rng(iStart.y, iEnd.y - 1) for each candidate weather drop
              rng.cpp:20–26: static uniform integer distribution
                rng_get_engine(), rng.cpp:201–205: shared gameplay engine
          ui_manager::redraw_invalidated(), handle_action.cpp:437
          game::handle_mouseview(ctxt, action), game.cpp:2563–2594
            ctxt.handle_input(), game.cpp:2568
              input_context.cpp:444: inp_mngr.get_input_event(...)
                sdltiles.cpp:3926–4007: SDL clock/polling/delay and TIMEOUT
          continue after TIMEOUT according to user_turn timing/options
```

The animation draws RNG values **before** filtering candidate drops by map
visibility/creatures. Merely looking at a source-backed weather effect can
therefore alter the later gameplay RNG sequence without a new user command.
`user_turn` (`handle_action.cpp:193–242`) reads `steady_clock`, `TURN_DURATION`,
`ANIMATION_DELAY`, and `BLINK_SPEED`. The input loop also advances scrolling
combat text and clears/toggles animations. `sdltiles.cpp:3926` is not a passive
input getter: it starts/stops text input, refreshes native windows when needed,
polls events, reads SDL ticks, and delays.

Consequently, current action-only replay and whole-game render/RNG neutrality
remain release blockers. A pure Rust redraw of an already-owned snapshot is a
narrower property and can be verified first. Do not obtain that snapshot by
calling `get_player_input`, `handle_mouseview`, `handle_input`, `get_input_event`,
`game::draw`, or a redraw callback. Do not label existing isolated Rust/adapter
tests as equivalent to this whole-game path.

The first integration must preserve this original behavior and record native
timeout/animation iterations as part of its reference trace. Reproducing a
trace requires the same seed, content/options, viewport, input events, and
native timeout schedule; the same list of movement keys is insufficient.
Changing cosmetic RNG ownership or consuming weather RNG once per command
would change the original sequence. The requested render/RNG isolation
authorizes separating cosmetic randomness. Record that design decision and
the reference-trace difference, with differential evidence for the preserved
gameplay rules.
Disabling animations is only a bounded test configuration, not proof for the
normal feature-enabled release.

## Minimal proposed original-C++ interface

Start with owned immutable records; do not expose an execution API in milestone
one. Add an isolated `browser_boundary.h/.cpp` that contains a bounded snapshot
registry and monotonically increasing context/event/observation generations.
The module catches allocation/serialization failures and leaves native input
and gameplay working even when a sidecar snapshot cannot be published.

The smallest useful outbound records are:

* `InputContextSnapshot`: ABI/source/build identity, generation, parent context
  generation/depth, waiting state, exact category, preferred keyboard mode,
  explicit text policy, registered source action IDs, and effective binding
  records copied using the native resolver's **const** table lookup order.
* `EngineEventSnapshot`: event sequence, command/turn sequence, phase, the actual
  accepted source action ID or timeout/raw-input classification, and a bounded
  set of already-computed observations. No translated action description is
  collected with `get_desc`/`get_action_name`.

Publish a context immediately before the original wait at
`input_context::handle_input`; restore the previous published context with a
scope guard after nested help/text dialogs and on exceptions. A permanent
category assignment from a context constructor is insufficient because
construction, registration, copying, and actual waiting occur at different
times. Instrument unknown/direct native readers separately as they are found;
mark an unreviewed wait as unsupported rather than carrying stale `DEFAULTMODE`.

Use opaque numeric snapshot handles and checked scalar exports, for example:

```c
// Proposed, not currently implemented/exported. Names avoid the Rust ABI prefix.
uint32_t cdda_browser_snapshot_pin(uint32_t kind);     // 0 = unavailable
const uint8_t *cdda_browser_snapshot_data(uint32_t handle);
size_t cdda_browser_snapshot_size(uint32_t handle);
void cdda_browser_snapshot_release(uint32_t handle);
```

Pinned bytes remain unchanged until release. Host JS checks/copies a buffer
from the C++ module's memory into Rust's separate memory, then releases it.
Both sides reject unknown versions, oversized records, invalid UTF-8, duplicate
fields/IDs, and invalid indices. No C++ vector, `input_context*`, SDL event
struct, borrowed `std::string`, exception, or native object address reaches
Rust. Scalar epochs larger than u32 use explicit low/high halves; do not rely
on JavaScript Numbers preserving arbitrary u64 values.

The only callback needed initially is `snapshot_available(kind, generation)`.
It schedules a host notification after publication; it never invokes a game
command, native draw, input poll, storage operation, or Rust renderer inline.
Getters read only the published byte buffer. Test them while the original
Asyncify input wait is suspended; they must be synchronous leaf operations
that cannot unwind/resume the simulation coroutine.

After that boundary passes, add a bounded queued helper submission:

```c
// Proposed phase two; not a direct call to handle_action/do_turn.
int cdda_browser_submit_action(uint32_t epoch_low, uint32_t epoch_high,
                              uint32_t registered_action_index,
                              uint32_t request_id);
```

It only validates and enqueues. The original input wait consumes the request
on the game thread, rejects a stale context/action/binding generation, and
routes through the original action-resolution/special-action path. Do not call
`game::handle_action` from an exported JavaScript callback. Initially construct
one original `input_event` using a supported effective binding, so language/help
handling and context restrictions remain original. Unbound, multi-key, unknown,
raw-text, and coordinate actions stay native until specifically supported.
Never turn `.`, `|`, or uppercase `S` into another action. Never translate an
external username or route text/IME events through gameplay controls.

## Next bounded executable milestone: live context to Rust control renderer

Milestone one adds the four snapshot exports and scoped publications only.
It does not add save execution, a replacement game loop, or a full tile renderer.
Implement this after the reserved original-engine build is finished:

1. Produce a reversible Phase 1 integration overlay for `input_context.cpp`
   and the small boundary translation unit/header, without original class-header
   changes. Prepare accepted-event hooks in `handle_action.cpp`/`do_turn.cpp`
   as a later separate slice. Apply to a complete isolated port source copy;
   quoted sibling-header lookup makes an `-I` overlay alone insufficient for
   later class-header replacements. Rebuild affected dependencies instead of
   blindly reusing original objects. Preserve the pristine source and full
   original C++ gameplay. Add only the required objects/exports to the bounded
   integration build; do not silently reuse an incompatible prior object.
2. Extend Rust input to read the **actual** context/binding DTO. Recognize
   `DEFAULTMODE`, reviewed menu contexts, and `STRING_INPUT` explicitly. Keep
   all unsupported contexts and event types on the original native path.
3. Let Rust presentation render an original-engine-driven control/prompt sidecar
   from the immutable DTO, using the existing `command.*` semantic IDs for the
   covered actions. Enable/disable the controls using registered-action data.
   Native map, menus, and dialogs remain visible and authoritative. This is a
   concrete advance beyond a shell-supplied context, not a claim that they have
   migrated to Rust. Coordinate the first actual gameplay-text consumer with
   [SEMANTIC-TEXT-INTEGRATION.md](SEMANTIC-TEXT-INTEGRATION.md): its 14 entries
   comprise seven category-scoped keybinding names, six Movement help title/prose
   entries, and the C++ Help heading, plus a structured direction grid. Their
   owned records need the proposed typed keybinding/rich-text parameters and
   semantic IDs; transport must preserve the original loader override precedence.
4. Leave the original SDL renderer active for differential comparison. The next
   tile-render milestone must export stable visible tile/entity IDs, lighting,
   remembered/explored visibility, orientation/overlays, and an explicit visual
   animation phase at a reviewed preparation boundary. `game::draw` updates
   map/visibility caches and callbacks, so it cannot simply be relabeled a pure
   observation getter. Snapshot consumers must not query hidden map/creature
   state or change game knowledge.

An intermediate **terrain draw-backend** milestone can be made concrete before
the complete semantic tile renderer. Observe the existing prepared render output
at `cata_tiles::draw_sprite_at` (`cata_tiles.cpp:2971 onward`): the original code
has already selected a sprite index, lighting/memory variant, destination
rectangle, rotation, and flips before `texture::render_copy_ex`. Record these
resolved values using stable asset/atlas IDs, ordered commands, viewport/clip
metadata, and an explicit frame generation. Never send an `SDL_Texture*` or
renderer pointer. Seal the record at the existing native presentation boundary
`refresh_display` (`sdltiles.cpp:539–567`); Rust then draws that copied immutable
frame with platform-provided textures, without calling back into C++.

This first terrain slice retains the original C++ sprite-selection and layout
decisions. It advances the Rust drawing backend and supports pixel/geometry
comparison against original SDL output, but does not finish Rust presentation.
Preserve isometric rotation, lighting/memory variants, layering and offsets,
including negative offsets. Later export semantic visible-world records to move
these presentation decisions into Rust with source-grounded tests.

For original text windows, `sdltiles.cpp:1235`'s `draw_window` reads `cursecell`
text/colors and mutates touched-line flags. A future observer must copy before
those flags are cleared and retain ordered window composition, CJK cell width,
font/fallback identity, and clipping. A dirty-line delta must carry its basis
frame and be materialized into an immutable complete frame before repeated
Rust redraw tests; it cannot be presented as a self-contained frame. Semantic
text/parameters remain the separate reviewed consumer milestone above. No
observer may request another native redraw to regenerate missing bytes.

Milestone-one acceptance criteria:

* A real complete-engine browser run exports different authoritative snapshots
  for the main menu, loaded-game `DEFAULTMODE`, nested help/menu, and a Japanese
  `STRING_INPUT` name field; leaving a nested dialog restores the parent epoch.
  Constructor-only and stale-context snapshots fail the test.
* Snapshot publication observes actual layered user bindings. Remap one covered
  movement key in the original keybinding UI and verify the next exported DTO
  and Rust control state reflect it. No default-table equivalence is assumed.
* Native controls still complete their original game/UI flows; arbitrary keys,
  unknown contexts, IME composition, Japanese names, `s` versus `S`, period,
  and wait-menu `|` retain original meaning.
* Repeatedly render the **same copied snapshot** in Rust, resize its surface,
  and switch en/ja without any C++ execution/poll/draw callback. The copied
  record and output stay stable; a full-engine RNG capsule captured at a guarded
  quiescent boundary stays unchanged. If the complete RNG adapter has not been
  linked and guarded, report this RNG criterion as unverified.
* An instrumented original/reference engine and the observer-overlay engine
  receive an identical full event/timeout/viewport/options trace. Compare
  accepted actions, world observations, native-save contents after normalized
  platform-only timestamps, and complete RNG capsules. Include animated rainy
  weather and repeated input timeouts. The observer must add zero draws and
  zero world/turn transitions. This comparison preserves native animation
  consumption; it does not establish action-only determinism.
* Snapshot bounds/UTF-8/handle-lifetime errors and allocation failure cannot
  corrupt the engine or discard native input. Browser diagnostics state the
  bounded scope; full-render/save/publication gates remain open.

## Native save plus RNG: later boundary, not an extra JSON file claim

The minimal checkpoint addition is a queued
`cdda_browser_checkpoint_request(expected_epoch, request_id)` and an immutable
completion record. The request is fulfilled only on the game thread at an
explicit supported command-complete boundary. Initially support a plain
movement/pause flow without a nested modal, active long-running activity,
automatic movement, or an unsupported coroutine suspension. Expand coverage
only with native save/resume evidence for each additional flow.

`game::save()` returns a bool and spans many files. `game::quicksave()`
(`game.cpp:13479–13503`) returns void, can skip unchanged state, and does not
propagate `save()` failure; it is not a checkpoint-success signal. The JSON in
`game::serialize_json` is not the complete native world save. `window.game_unsaved`
is a browser-close prompt flag, not a durability or transaction receipt.

Capture and commit protocol:

1. Enter a guarded checkpoint phase; defer new commands, native timeout/animation
   progress, and automatic activity progression. Do not reenter suspended
   Asyncify gameplay from JavaScript. Run the original native save at this
   supported boundary and require `game::save()` success. Retain its save-event
   semantics, including any reviewed mutations; do not invoke save to obtain a
   supposedly pure renderer observation.
2. Once all native save operations finish, copy the **complete** native file set,
   preserving binary bytes, Unicode paths, compressed saves, world/mod metadata,
   maps, player and companion files. Bind the set to a generation/file manifest
   and capture the full RNG capsule before any resumed native computation.
   Verify the saved set and capsule describe the same guarded boundary.
3. Link exactly one `rng.cpp`: the reversible storage-only RNG overlay, plus
   `rng_snapshot.cpp` and its headers. Export the existing
   `cdda_rng_snapshot_capture`, `restore`, `abi`, and `max_bytes` functions from
   `rng-adapter/overlay/src/rng_snapshot.h`. The engine and six distributions
   must match the tested compiler/library/floating-point ABI. Capturing only a
   seed or `minstd_rand0` state loses the normal distribution cache.
4. Give Rust `platform::encode` real native bytes, one opaque capsule, actual
   observation/boundary, source/build/content identity, and exact serializer ABI.
   Specify the native **file-set container**; `upstream_save_bytes` currently has
   no full-file-set producer/consumer. Its default limits are 64 MiB native,
   128 MiB encoded, and 1 MiB RNG; detect/measure genuine world sizes and report
   a limit failure rather than dropping files.
5. Await actual persistence completion. Original IDBFS owns its mount and
   coalesces file sync requests; a successful native save or scheduled
   `setFsNeedsSync()` is not a completed checkpoint. Use a separate versioned
   generation record and commit the new record plus its active-generation marker
   in one browser storage transaction. Keep the previous committed generation
   until success. Do not claim cross-file atomicity from the existence of a
   `syncfs(false)` callback alone. Coordinate original sync activity so a failed
   partial working-directory save cannot replace the last recoverable checkpoint.
6. Return a checkpoint receipt only after that commit. Quota, native-write,
   checksum, capsule, sync, and interruption failures leave the prior committed
   generation available and report a semantic error. Source/build/serializer
   incompatibility must fail visibly; do not approximate its RNG.

Restore protocol and current gaps:

* Rust validates envelope/source/build/content identity, limits, paths, checksums,
  and the entire file-set manifest before exposing it to native loading. Reject
  absolute/traversal paths, duplicate paths, missing files, and incompatible
  content. Existing Rust envelope checks are useful but are fixture-only and
  do not establish native-file semantic validity or a storage transaction.
* The current RNG adapter's `restore_impl` (`rng_snapshot.cpp:192–230`) parses
  seven sections into candidate objects before a nonthrowing engine/distribution
  commit. It makes RNG restore transactional **by itself**. It has no public
  validation-without-commit API. A full restore coordinator needs a factored
  validate/prepare operation or a fresh isolated candidate runtime; calling
  `restore` merely to validate would already mutate live RNG.
* Reconstruct the native world through the reviewed `game::load(save_t)` path,
  including `game_load` events, EOCs, and cache initialization. Restore the saved
  capsule **after** successful reconstruction, before another turn, animation
  wait, or input context begins. Load-time draws must not advance the final saved
  continuation. A fresh isolated runtime is the initial safe restoration target:
  destroy it on failure and retain the old runtime/committed checkpoint. The
  current global C++ world loader is not an in-place transactional restore.
  An iframe/worker candidate or equivalent runtime isolation also needs explicit
  ownership of SDL input, audio, and the original IDBFS mount; the current global
  `Module` shell does not already supply this lifecycle.
* Prove whole-game continuation using a real native save: same pinned build and
  content, successful load, complete capsule equality, then identical subsequent
  event/timeout traces through movement, inventory/combat, and waiting. Inject
  late native-write failure, corrupt a late capsule field, fail storage commit,
  interrupt/reload the page, and exceed quota/size. Verify previous checkpoint
  recoverability and absence of partial live-world/RNG application.

Full publication remains blocked until these real-engine requirements pass.
An isolated RNG capsule test, a Rust envelope round trip, a browser native-file
export, and a stable shell redraw are separate pieces of evidence; none is a
complete native-save plus RNG transaction.

Semantic gameplay text emission, dynamic names, and catalog consumers are covered
by [SEMANTIC-TEXT-INTEGRATION.md](SEMANTIC-TEXT-INTEGRATION.md). This boundary
provides owned IDs and typed parameters prepared on the C++ side. It must not
translate strings, rerun dialogue tags, select names, consume RNG, or advance
simulation while copying/formatting an observation.
