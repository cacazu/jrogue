# Browser command checkpoint

This supplements the actual Angband 4.2.6 save format. It does not replace the
C domain rules with a separate simulation. The source commit is
`f3082213b73f3e463e3d0d60bff4b00462beae6e`.

## Versioned formats

The outer browser record is schema 1 with SHA-256 and source/version metadata.
Its opaque binary is Rust `ABRSAVE` envelope schema 2, with a CRC, normalized
input journal and optional 38-word C RNG checkpoint. Rust still decodes envelope
schema 1, which has no exact RNG checkpoint and follows native load semantics.

Browser-native `monsters` and `chunks` blocks are version 2: their monster
records include a per-slot presence byte. Saving preserves holes and `midx`
instead of compacting the live C array and changing descending AI execution
order. Version 1 readers remain for legacy native data.

A final `web-checkpoint` block, version 1, stores explicitly enumerated state
omitted by the native format. These browser save files cannot be loaded by
unmodified native Angband 4.2.6, which rejects unknown block types/versions.

## Supported boundary and restoration

The adapter accepts a save only while awaiting a human game command, with no
executing command, nested menu, queued commands, repeat/run/rest/path sequence,
pending derived update, or fixed spell target. Command item references must
resolve to live gear ordinals or cave object indices; stale pointers are
rejected without dereferencing them. Original internal nonidle autosaves emit
an inactive checkpoint block and are not accepted as exact browser checkpoints.

The extension enumerates current, known and stored chunks; square features,
flags and light; noise and scent heatmaps; monster targets, visibility/range
caches and learned player flags; group leaders and exact member order; race
population; complete learned monster lore; derived player state; target
history; and private command-repeat and resting-history state. Readers validate
dimensions, source constants, slot/reference indices, list sizes, booleans,
and stat-table indices. No raw pointers or platform-dependent structs are saved.

Loading reconstructs shop/home stock in serialized order without sales-time
recharge or merging. It hydrates the UI without performing level entry/search
again, combining the pack, clamping energy, or recomputing saved FOV/lore. Saved
known gear/cave/store objects are retained; static curse knowledge is rederived
from the same immutable data. The full RNG snapshot is applied once after
startup and before the next human command.

The browser comparison checks both town and first-dungeon uninterrupted versus
resumed traces, including original command repeat. It then compares every
serialized native block. Read the actual results in `tests/browser-evidence/`;
these tests are not evidence for every combat, spell, arena, rest or end-game
scenario.

## Remaining limits

Native message history still has its original 80-message/127-byte load limits.
Terminal input and paused C prompt continuations, UI trackees/preferences,
separate lore/profile/score files outside the enumerated checkpoint, and visual
animation state are not arbitrary process snapshots. Stale last-command item
references can prevent a save until a supported command replaces that history.
Custom gamedata or object mutations outside the pinned source are unsupported.

Rust/browser redraw only paints a cached immutable frame. Original C display
functions still contain RNG and knowledge side effects; complete presentation
separation and broader differential tests remain separate migration work.
