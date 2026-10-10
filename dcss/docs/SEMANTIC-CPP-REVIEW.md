# Canned-message C++ source adapter review

This source-only change observes the originating `canned_msg` print sites in
official DCSS 0.34.1, commit `1eebc1a2892e1c89776a0d7a10691f8dac8d9796`.
It retains the canonical English messaging route and adds 45 semantic IDs for
37 canned enums across 40 original print calls. Other gameplay messages remain
unconverted. This is not evidence of a complete Japanese port or a rebuilt,
tested browser release.

The reviewed checkout bytes of `upstream/crawl-ref/source/message.cc` have
SHA-256 `63d0aa5d84e3f82301fb948d0f4e4c80bc113971aa273ade7ae539c8844a4784`.
`locales/gameplay/canned-source-map.json` records the original enums, branches,
English formats, channels, controls and source receipts. The patch tool requires
the exact pinned source, exact 45-ID agreement, empty parameters, original
source calls, channel values and `nojoin` flags.

## Source boundary and ordering

`tools/apply-semantic-patches.py` inlines `engine/semantic-canned.inc` into
the generated work-copy `message.cc`. It does not add an include under
`engine/work/crawl-ref/source` or modify a header. Each original canned print is
wrapped in an RAII scope containing its static semantic ID. The scope covers
only that print. `learned_something_new(HINT_YOU_RESIST)` and all nine
`crawl_state.cancel_cmd_repeat()` calls stay after their original print calls.

The original appearance branch evaluates `player_has_feet()` once. A local
boolean binds that original result at the print site and supplies both its
semantic branch ID and the original English argument. The mutation, claws,
tentacles and HP-casting predicates retain their original evaluation order and
short-circuit branches. Semantic branch selection adds no gameplay predicate
evaluation. The `which_message` enum comparison used for empty-handed ID
selection is a scalar comparison, not an extra player-state query.

At `_mpr` entry, the pending descriptor is taken and cleared before its
existing UI RNG guard, crash check, message preparation, tees or Lua hooks.
This matters because `prepare_message` can interrupt an activity and produce
nested messages before the explicit `c_message` hook. Nested ordinary messages
cannot inherit the outer canned ID. Nested canned messages accept and emit
their own IDs at their own buffer acceptance points. The outer local ID remains
available afterward. RAII restores the previous pending pointer on scope exit.

The observation call occurs immediately after the original `buffer.add(msg)`
returns, before `_mpr`'s pre-I/O return and its final error interrupt, `more`
and flash handling. The canonical raw dump, stderr, message suppression,
notes/interruption patterns, message-color mappings, tees, Lua `c_message`,
join/more/flash checks, capitalization, language filtering and buffer operations
retain their original arguments and ordering. No Japanese text is passed into
those controls or native history.

The quad-damage predicate is bound once at the original `fs.all_caps()` branch.
The same boolean controls canonical capitalization and the observer's `shout`
flag. It is captured before language filtering and any `buffer.add` suspension;
the adapter does not reread player state after nested input or messages.

## Typed host contract

The Emscripten-only weak declaration is:

```cpp
extern "C" void dcss_semantic_canned(
    const char *id, int turn, int channel, int param, int colour,
    bool join, bool nojoin, bool more, bool flash, bool shout);
```

The observer receives the incoming `message_line`'s turn, channel and param;
`msg.join` after the original message constructor's width rule; the original
`nojoin`; the original requested more/flash flags; and the captured shout flag.
`colour_msg(colour) & 15` is the original pure color mapping's base palette
value. This subset's original channels are PLAIN=0, PROMPT=2, WARN=6 and
EXAMINE_FILTER=24, with param=0. Parameters are empty because contextual
appearance, body-part and HP-casting variants have distinct reviewed IDs.

The platform owns JSON serialization, sequence numbers and the callback to
JavaScript. It must catch observer failures before they can escape into the
engine and must not synchronously reenter the engine. The source observer is
optional when absent and is a no-op on native builds. No callback replay,
simulation calls, RNG draws, translated-string matching, or global string
replacement is added. Build-time classification uses exact pinned print sites;
runtime identity originates in their C++ branches.

## Acceptance is not native history

An event is emitted once per accepted `_mpr` call, including native repeated
messages that merge into a previous row or messages joined on a line. Its turn
belongs to that incoming call; a merged native row may retain an older turn.
Messages dropped by the crashed-game return or the muted post-I/O return emit
nothing. A muted message before I/O initialization still reaches the native
buffer, so it is observed.

`buffer.add` may flush an earlier row and wait at a capacity-triggered more
prompt before returning. The observer is therefore after that wait, not before
every possible screen flush. More/flash fields describe canonical requests,
not proof that the final effect ran: original I/O and `_pre_more` gates still
apply. A nested accepted message can precede its enclosing event in the stream.

PROMPT and EXAMINE_FILTER channels can be accepted without being retained in
native history. Native temporary-message rollback cannot retract an already
observed side-panel event. Native save/load and history replay bypass these
originating `_mpr` calls and do not reconstruct semantic events. The converted
side panel is a live observation stream; the native console and history remain
the canonical route. A later history migration needs explicit transaction,
merge and persistence semantics rather than treating these events as replay.

## Verification and build impact

The tool's strict inverse check removes all 40 generated print wrappers,
restores the one feet binding and requires the complete `canned_msg` region to
equal normalized pristine bytes. An independent reviewer repeated that check:
the recovered region SHA-256 is
`4d6f0dccf7730c13b3654da7bab69a072994a4482ffa89ce61b17720b2b87dfb`.
Lightweight source checks also verified unchanged counts of the feet predicate
and quad-damage read, exact canonical arguments/branches, the 45-ID source map,
and callback placement. These are source checks; no compiler or engine was run
for this adapter during the shared memory hold.

Isolated temporary-tree checks passed for read-only bytes/mtime preservation,
application, repeat-application idempotence, exact prior-helper recognition,
and refusal of unrelated work edits, catalog channel drift and pristine source
drift. Those tests did not modify installed upstream or engine work.

The helper SHA-256 is
`960b1e0f26fd550a3075fe7a89649de78ed9dfe44afdf7207f52788d6b0196c8`.
The generated checkout-style CRLF `message.cc` SHA-256 is
`9c41e9df70218c0c78eb1a038c74d36284632e345a74cc616e555961d5e9b443`;
its normalized LF review preview is
`e770350a28a4805d8a8fa8fa085ff6d80af105e12529b84eabd9726b1b7c1a8c`.

Default invocation is read-only. Run from the installed game directory:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' tools/apply-semantic-patches.py --check
```

The builder invokes the same tool with `--apply` after preparation, including
the skip-prepare route, and before calculating compiler fingerprints. Applying
changes only recognized pristine/current generated `message.cc` bytes. A prior
helper variant is recognized only when its embedded helper hash and exact
regeneration both match. Unrelated work-copy edits cause refusal; pristine
upstream is always read-only.

The initial installed `--check` recognized pristine work and reported a pending
change. The parent subsequently performed coordinated `--check`, `--apply`,
`--check` calls. The installed work copy is now `current-patch`, has the CRLF
SHA-256 above, and reports `would_change=false` on the final check. This is an
applied source change, not a rebuilt engine artifact.

The source observer invalidates only `message.cc`; the platform host callback
also changes `platform_console.cc`. No header or `.inc` is placed in the work
source tree, so the canonical common/header fingerprint stays
`93d1d71b561e14f07589a24bc59598fac3960b95832a80d1fb3629f98a7e1042`.
The previously measured full graph has 333 source units.
Read-only cache accounting before application found 272 valid units and 61
outstanding units. The canned adapter invalidates the existing `message.cc`
object, leaving 271 valid and 62 outstanding units. The platform unit was
already outstanding, so the new host callback does not invalidate an additional
currently valid object.

Historical link memory
was approximately 1.8 GiB and one engine runtime approximately 1.5 GiB; these are
earlier measurements, not new runs. Compilation, linking and browser/engine
regression tests remain gated by the parent memory hold. Required follow-up is
to compile the changed source units, finish outstanding default-WIZARD units,
link once, then test suppression, nested messages, repeats, more prompts,
shout, native save/resume determinism and worker/browser delivery sequentially.
