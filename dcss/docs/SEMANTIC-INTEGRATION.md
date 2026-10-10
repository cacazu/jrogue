# DCSS semantic source integration — 2026-10-02

The source conversion is now built into the complete engine and Rust boundary.
This remains an incomplete Japanese game. Forty Rust tests and Clippy pass; an
initial original-engine smoke exercised one genuine canned route. Actual browser
integration and native resume are blocked by measured module-creation memory.
See [STATUS.md](STATUS.md) and `tests/runtime-evidence.json` for current evidence.

## Actual edited boundary

The first engine conversion covers every `canned_message_type` identity:
37 identities, 40 original print sites and 45 expanded render IDs. The registry
and EN/JA JSON retain exact enum/case/call receipts, context predicates, channels
and original English. It is a bounded source denominator, not a percentage of
the game's translation. The [45-row review](CANNED-MESSAGES-REVIEW.md) records
the Japanese decisions and the source conditions.

`tools/apply-semantic-patches.py` derives a separate `engine/work/crawl-ref/source/message.cc`
from recognized pinned source. Its checked-in `engine/semantic-canned.inc` is
inlined into that `.cc`; no header or `.inc` is added under the engine source
directory. `tools/engine-build.py` applies it before source fingerprints on both
normal and `--skip-prepare` builds. The pristine upstream is never patched.

At each original canned branch, a scoped descriptor identifies the whole
message before formatting. `_mpr` consumes that descriptor at entry, before
`prepare_message`, interrupt hooks or `c_message` can recurse. It retains the
original English path exactly once for notes, activity interruption, channel
colour, mute checks, Lua, rc regexes, language transforms, buffers, pauses and
native history. Crashed or muted early returns produce no semantic event.
Existing command cancellation and hint calls stay in their original positions.

After `buffer.add` completes, an optional adapter callback observes the accepted
message. The stream describes completed accepted emissions; native buffer
merging, deferred flush, temporary rollback and history exclusions remain native
engine behavior. The semantic panel does not replace the native message window
or claim an identical native history. `buffer.add` itself may flush/suspend
before the observation. Actual trace-order and pause tests remain required.

The C++ platform callback copies JSON to Emscripten `dcss_host_semantic`.
The library observes only when `dcssSemantic` is supplied. Observer/diagnostic
exceptions are contained and cannot throw back into gameplay. The Worker
forwards a copied observation; the main thread validates and renders it through
Rust `application::Command::GameMessage`. Rejected localization observations use
a separate counted diagnostic and do not terminate canonical engine play.

## Versioned observation

`port/src/semantic.rs::GameMessageEvent` checks:

- schema version `1`, source `canned-v1` and the exact upstream commit;
- positive canonical decimal `u64` sequence, retaining all bits in browser JSON;
- original turn, channel and channel parameter, base colour and control flags;
- exact source-registry ID/channel/caller-nojoin match, with no parameters;
- no contradictory join/nojoin/force-more metadata.

`join` is the original `message_line.join` after its original canonical width rule.
`more` and `flash` record already chosen control decisions; Rust never executes
them. `shout` snapshots the original quad-damage branch: pure English rendering
uses uppercase, while the Japanese panel preserves the text with strong visual
emphasis. Locale redraw does not reread player durations.

The copied `Message` has a durable ID and an empty parameter map. No formatted
English is used to detect meaning. No enemy identity, unknown item property,
generated name, external username or inscription is introduced by this slice.
The source's feet/body/HP-casting predicates choose whole reviewed variants.

`web/semantic-log.mjs` retains at most 200 session events and validates monotonically
increasing exact sequences. It returns independent copies; redraws and locale
changes render the same observations without a C++ command. The browser uses
plain `textContent`, keyed history nodes and a separate announcer for only new
accepted events. Locale redraws do not reannounce the entire retained history.
The current native console remains available with unconverted English prose.

This session projection is **not persisted semantic history**. Native saves and
canonical native history bytes remain unchanged. Resume starts a fresh semantic
session. A complete semantic-history checkpoint/schema remains a release gate.
Native `fake_lang` settings also remain canonical engine behavior; the Japanese
semantic panel has not implemented those optional transforms or their UI-RNG
effects. Rendering never reruns them.

## Lightweight evidence and limits

- Canned checker: 45 bilingual IDs, 37 enums, 40 print sites, three pristine
  source hashes and 30 positive/negative source/schema probes passed.
- Independent catalog review: 135 exact line receipts, original conditional
  English, Japanese meaning, channels/nojoin and zero-parameter schemas passed.
- `tests/semantic-protocol.mjs`: 16 host/projection checks passed. These cover
  exact maximum sequence, copied events, optional observers, observer exceptions,
  Worker forwarding, continued input/state inspection after diagnostics, bounded
  history, redraw/language purity and rejection/reordering behavior.
- The existing Worker protocol fixtures still pass all 27 checks.
- JavaScript syntax and Rust source parsing/format checks passed.
- All three new Rust regression tests pass as part of the 40-test run, including
  all 45 IDs through the application in both languages and shout states.

The Node host/projection checks use stubs and a display mock. They do not execute
the original C++ engine, the new Rust implementation, WASM or a browser. The
rebuilt Rust boundary now passes 40 tests and actual adapter Chrome checks.
The complete C++ artifact includes this conversion; an initial eight-check smoke
passed a genuine source event and all 45 persistent RNG observations. Full-engine
browser, exhaustive emitter/control and restored-save parity remain unverified.

## Startup catalog preparation

A separate reviewed first slice adds **51 bilingual IDs for 37 selected source
output sites**, spanning opening/welcome, name, seed and weapon-choice UI.
The startup checker verifies four pinned source hashes, 160 reused species/job
references, ten source-control ranges and 40 assertions. Four retained outputs are explicitly classified: the external player-name
echo, two generated decimal seed echoes, and the ordinary weapon-name dependency.
The data echoes remain unchanged; ordinary weapon naming is an open translation
requirement. None is translated by string replacement.

The current Rust source embeds those catalogs alongside the 131 adapter IDs,
160 species/job IDs and 45 canned IDs: **387 IDs per language**. Startup catalog
availability is not native menu conversion. Native startup has no semantic
emitter yet, and dynamic entity references require the declared descriptor
contract. General weapon names, native menus, rich spans and full startup
coverage remain open. See [STARTUP-TEXT-REVIEW.md](STARTUP-TEXT-REVIEW.md).

## Next execution conditions

The parent released the blanket hold. The complete engine includes the source
observer, default WIZARD, full checkpoint and CJK cluster changes. Rust was also
rebuilt and tested. Continue one stage at a time with process-tree measurements.
Current Asyncify module creation peaked near 12 GiB private memory in Node; one
compilation task and baseline-only mode did not reduce it. A separate supported
JSPI artifact is under evaluation. Do not rerun the same pressured configuration
or count a diagnostic browser compiler flag as ordinary-user startup evidence.

Compare patched versus canonical traces for all canned variants: muted/crashed
suppression, recursive interrupt and Lua messages, channels, joining, repeat
condensing, force-more, temporary messages, hints/cancellation and all 45 RNG
streams. Extend the passing Rust tests with PC/mobile source-ID rendering, CJK emphasis,
screen-reader announcement timing, storage/resume and English control matching.

Continue startup source conversion and the other phases in
[SEMANTIC-MIGRATION-BACKLOG.md](SEMANTIC-MIGRATION-BACKLOG.md). Dynamic names,
HUD/status, movement/combat/inventory, spells/religion, resources/help/errors,
settings and lifecycle are still open. The user clarified that the deliverable is local HTML with Node/browser
verification only, with no external deployment. Full gameplay/save/browser/
Japanese/licensing gates remain required; this panel alone cannot complete them.
