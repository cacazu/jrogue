# Stat, effect, damage and probe semantic messages

Source-integrated milestone:16 original message producers in14 functions across
`effect-handler-attack.c`, `effect-handler-general.c`, `player-util.c` and
`project-player.c`. This owner did not compile the engine or run a browser;
Root coordinates those gates. Complete-game translation is not asserted.

`web-stat-message.[ch]` emits existing typed semantic events before each
unchanged original `msg`/`msgt` call. The original format, arguments, sound,
knowledge changes, damage, rolls and order remain intact. Browser-only tagged
captures strip back to the exact immutable pre-phase function bytes.

The111 EN/JA entries in `migration/stat-message-data` cover the reviewed message
branches, stat lexemes and all56 canonical projection types. Every schema
entry has selected-field or original source-index/line/printf provenance.
`generate.mjs --check` verifies source-derived output; `--provenance-only`
updates metadata while checking that templates/private bindings stay frozen.
`producer-snapshots.json` pins each native function and its SHA256.

Stat messages select the original canonical enum and polarity. Property
adjectives (`smart`, `dextrous`, `healthy`) remain distinct from the separate
projected-stat literals (`bright`, `agile`, `hale`). No `desc_stat` output is
parsed, and that original function still executes exactly once at each call.
Japanese stat lexemes use authored noun forms for natural surrounding grammar.

Projection references select the already-known enum/role at the source gate.
Canonical indices follow `list-elements.h` plus `list-projections.h`, including
the AWAY_SPIRIT/AWAY_EVIL ordering that differs from physical data record order.
All exact-equal blind descriptions share a lexical ID, so an emitted
“something”/“something strange” reference cannot disclose an unprinted attack
identity. Private numeric indices are not present in the JSON event.

Damage suffixes use separate with/without-amount templates. An additive boolean
is set inside each original winning `damage > 0 && show_damage` formatting
branch. The helper receives that captured decision and already-reduced damage;
it does not re-evaluate options, parse `dam_text` or expose an amount when the
original display omitted it. Earthquake hurt messages capture their existing
selected literal branch without rerolling. The native prefix/suffix still
formats through its untouched original path.

Courage messages copy the two immutable monster descriptors immediately after
their original native calls, before heal feedback can yield for More. Both
snapshots are released once at the original function exit. Probe HP is captured
only inside the original visible-monster branch, immediately after its existing
description, with exact hp==1 versus other English grammar. No maximum HP,
hidden identity, extra descriptor or visibility query is added.

The shared Rust descriptor types are `localized_text`, `integer` and
`MonsterDescription`; this phase requires no new Rust grammar type. C helper
status reports invalid source selection/capture rather than looking up English.

Executed checks:

- `node --test tests/stat-message-source.test.mjs`:8/8 passed.
- `node migration/stat-message-data/generate.mjs --check`: passed111 entries,
  five stat identities,56 projections and16 producers.

Still required: Root's measured compilation/link gate, registration of the C
helper and111 reviewed catalog entries, and browser acceptance of stat drain,
sustain/restore/gain, healing courage, breath/blind-hit, damage options,
earthquake/uncursing/exertion, blind summoning and visible probing. Verify
identical original native results/RNG and semantic events through More and
pending-prompt save/resume. Source checks do not substitute for those runs.
