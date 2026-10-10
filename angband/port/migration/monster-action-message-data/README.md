# Source-selected monster action messages

This additive slice covers ten original formatted message callsites at pinned
Angband 4.2.6 commit `f3082213b73f3e463e3d0d60bff4b00462beae6e`.
There are 39 authored English/Japanese semantic IDs. This is a source integration
milestone; engine compilation and real browser acceptance are separate gates.

| Original producer | Source census indices | Capture |
| --- | --- | --- |
| `monster_turn_try_push` | 111 | Original `kill_ok` choice; frozen original actor/target descriptor snapshots before camouflage changes, deletion, or swap |
| `player_kill_monster` | 125 | Original selected ranged or arena death-note source; original descriptor snapshot plus subsequent `my_strcap` consumer |
| `monster_change_shape`, `monster_revert_shape` | 136, 137 | Existing original buffer before race mutation; same reviewed shimmer/change message |
| `py_attack_real` | 172, 173 | Frozen original `MDESC_TARG` target; original punch/hit, winning brand/slay, selected shape blow, no-damage override, quality rows0–6 and show-damage branch |
| `ranged_helper` | 176, 177 | Selected projectile/target descriptors, exact native chosen verb source, native visibility/show-damage/quality branches |
| `steal_player_item` | 98, 99 | Existing split choice and object/actor descriptions; original inventory label computed once before consuming the object |

The original English `msg`/`msgt` calls, key identities, RNG calls, domain queries,
and argument effects remain intact. `AB_MON_ACTION` and `AB_MON_ACTION_INLINE`
annotations reconstruct all six modified files byte for byte against the
accepted local source baseline. New callbacks serialize already selected facts;
they do not call `monster_desc`, `object_desc`, combat rules, or RNG again.

Ranged verb provenance is keyed by the original allocated verb buffer address.
Its initial `hits` source identity is replaced only inside an original winning
`best_mult < mult` branch of `improve_attack_modifier`. The original selected
brand/slay index and `range` fact select existing reviewed lexical endpoints.
Successive original callers retain their order; the last actual replacement
wins. Metadata transfers to the caller's local buffer before the allocated
buffer is freed, and is discarded at the end of each ranged iteration. No
completed English verb string is inspected. Private indices are not emitted.

The new `CapitalizedMonsterDescription` parameter uses this exact value shape:

```json
{
  "schema_version": 2,
  "subject": { "schema_version": 2 },
  "capitalize": true
}
```

`subject` is the full existing original `MonsterDescription` v2 snapshot, not the
abbreviated example above. It is frozen immediately after the original native
descriptor, refreshed after an original shape reversion when appropriate, and
kept through `notice_stuff`. Rust applies the recorded consumer capitalization
after resolving that snapshot. It must not query the current monster again.

Ranged death notes and the three attack-effect producers (`TAP_UNLIFE`, `CURSE`,
and `JUMP_AND_BITE`) carry an active source-correlated pointer and reviewed role
around the original `mon_take_hit` invocation. `CURSE` preserves its original
`display_dam` decision and already computed integer; the numeric fact is emitted
only for the original displayed-damage branch. The arena literal is correlated
through its original argument evaluation and cleared on return. An arbitrary
or external note remains explicitly unsupported; it is never translated by an
English lookup. Original project death notes of length at most one are excluded
by the existing branch, with their messages still owned by `project_m`.

When the original show-damage branch is absent, no damage parameter is emitted.
The three quality endpoints bind the actual original `ranged_hit_types` rows;
both existing callers pass that same static table. User names, inscriptions,
and other opaque values retain the existing naming descriptor provenance.

Root integration must register `web-monster-action-message.c`, these two locale
catalogs and schema, and the new capitalization descriptor resolver. Existing
`ab_knowledge_brand_id`/`ab_knowledge_slay_id` and naming snapshot APIs are reused.
The shared variadic dynamic-message serializer and `attack_result` layout are
unchanged.

The eight source checks cover catalog placeholder contracts, all eight exact
original callsite bindings, six-file byte preservation, source-selected verb
ordering/transfer, death provenance/capitalization, single original gear-label
evaluation, numeric visibility, effect-note roles, and quality-table identity. They establish
source structure and preservation; they do not execute the C engine or prove
browser behavior. No full-game translation claim is made by this slice.

The melee path stores the original source identity in the same bounded16-slot
verb metadata table. It starts with the actual `punch` or `hit` assignment,
accepts only replacements made by each original winning brand/slay branch, then
records the original shape choice before `while(choice--)` consumes its index.
The original `randint0` is evaluated once. All29 bundled blows across8 shapes
retain their reversed parser-linked-list ordinals;10 brand records and11 slay
records resolve12 distinct lexical endpoints.41 finite canonical lexical IDs
select reviewed Japanese case morphology, never native English buffer bytes.
Unknown customized data identities are rejected explicitly.

The seven original melee table rows include ordinary/no-damage outcomes and all
five critical qualities, including the distinct `*GREAT*` and `*SUPERB*` rows.
The original show-damage formatting expression is evaluated once and records
only its actual branch. No damage parameter is emitted for hidden damage.
Unlike the death consumer, melee has no capitalization consumer; its descriptor
keeps the original `MDESC_TARG` flags and visibility facts. Its owned snapshot
and verb metadata are released at both early returns and immediately before
original mutable pre-damage side effects. No later monster/object query occurs.

The source tests now include complete melee data bindings, original conditional
argument evaluation, all shape ordinals, quality selection, and every metadata
lifetime. Peer additive annotations are composed on both sides of each original
byte comparison. Compilation and real melee/browser/RNG acceptance remain
parent-owned gates; source checks alone do not establish those outcomes.

The four selected ranged brand lexemes `shock`, `poison`, `zap`, and `sicken`
now reuse the finite source-authored case table: the first three use Japanese
に, and the last uses の. Other selected brands retain を. Two new ranged
case grammars preserve the original reviewed English template exactly. All37
previous EN/JA values remain unchanged and are pinned in
`catalog-before-ranged-cases.json`; no native C source, selection, or RNG changes
are involved in this refinement. Unknown canonical lexemes remain unsupported.
