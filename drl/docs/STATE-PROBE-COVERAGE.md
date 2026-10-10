# Original-state verification coverage

The current `drlbrowserprobe.pas` export is a bounded diagnostic, not a complete world snapshot. Its 128-byte DRLP header records game state/seed/difficulty, player position/HP/experience/score/class/depth/inventory size, and level time/boss/empty state. The following bytes are the original MT RNG index and all 624 words, captured through the read-only `GameRNG.WriteToStream`. Browser comparisons check all those bytes. They do not prove that every mutable game field stayed unchanged.

## Missing state

| Source | State beyond the current probe |
| --- | --- |
| `dflevel.pas`, `vluamapnode.pas`, `dfmap.pas` | Terrain/cell flags and explored/visible state; level map/episode records; status, danger and accuracy modifiers; native English IDs/feeling; markers, perks and decals; ordered entity membership; active-being and next-node scheduler position. |
| `dfbeing.pas`, `dfthing.pas`, `vluaentitynode.pas`, `vnode.pas` | Every non-player being; IDs/UIDs/flags/hooks; health/armor and decay; speed/action costs and command state; target/move/last positions; chain fire, knockback, death/AI/path state; perks; original Lua `__props` and `__hooks` state. |
| `dfitem.pas`, `drlinventory.pas` | Each item and its ordered owner/parent, equipped slot and children; prototype/UID/English name; full item properties, ammunition/amount/durability/mods; ownership and quick-slot relationships. Inventory count alone cannot detect these changes. |
| `dfplayer.pas`, `drltraits.pas`, `drlstatistics.pas`, `vrltools.pas` | Traits/master constraints, kills, nuke state, inventory capacity, quick slots, dodge and experience factors, game statistics, history and player progress. |
| `drlbase.pas`, `vuid.pas` | Challenges/Archangel flags, win/crash state, modules, next UID/store policy, automatic movement/target state, scheduler/control fields and other episode metadata. |

Some sprite/animation/timing fields are presentation state, while some apparently visual fields also affect original rules. Classify each field from its actual readers before excluding it. Do not infer that a field is harmless from its name.

## Serialization hazards

`TDRL.WriteSaveFile` is destructive: it invokes `Player.Statistics.OnSaveFile`, serializes and detaches the player, closes the stream, and clears the level. `TStatistics.OnSaveFile` increases `save_count` and accumulates wall-clock time. It must never be called merely to capture a diagnostic.

`TLevel.WriteToStream` also **assigns `FID := 'default'` before inherited serialization and does not restore it**. Original saving clears that level afterwards. Even a memory-stream call to this method would alter the live game and invalidate rendering-purity tests.

`TNode.WriteToStream` traverses Lua `__props` and `__hooks` through `LuaSystem.State.SubTableToStream`. Item/being/player serialization inherits this operation. It is therefore not a substitute for an independently reviewed read-only field traversal. Lua stack restoration, key ordering, unsupported values/functions/cycles and metamethod behavior must be checked before using those helpers for canonical state capture.

Native save records contain raw Pascal records. Padding, enum/set widths, pointer-containing cache fields and floating-point representations make a byte copy of arbitrary object memory unsuitable as a stable canonical snapshot. Pointer addresses must never enter the fingerprint.

## Required stronger witness

Add browser-only read-only emitters in the units that own private/protected state. Emit a versioned canonical diagnostic separately from native saving. Use fixed-width little-endian scalars, length-prefixed original UTF-8 strings, declared enum/set encodings and explicit optional values. Include all gameplay entities and relations, tile coordinates in a fixed order, and the full original RNG stream. Keep entity traversal/scheduler order explicit; sorting everything by UID would hide a changed action order. Encode references by UID, with a separate next-UID/store witness.

Lua custom-state capture must walk existing raw tables without running hooks, sampling RNG or reading the clock; canonicalize keys and numeric bits and restore the exact stack top. Unsupported/cyclic/function state must produce an explicit failed diagnostic, never silently disappear. A source field ledger must distinguish persisted gameplay, transient rule state and permitted presentation state.

Bound capture size and stream chunks through an authored read-only export. Hashing can happen outside the original core after capture. A failed/truncated witness must fail the check rather than compare equal. Keep the current small DRLP/RNG capture as a fast diagnostic while the complete witness is developed.

## Runtime checks still required

- Capture twice while the original core is paused; require identical canonical gameplay bytes and RNG and unchanged Lua stack/native state.
- Render repeatedly, switch locale/font/viewport, open non-action views, and replay draw commands; require the complete gameplay witness unchanged. Presentation caches may change only within the reviewed separate witness.
- Mutate representative source-derived fixture fields in terrain, an off-screen being, ammo/durability, a perk, scheduler order and Lua custom state; confirm each changes the witness without drawing.
- For Save & Quit, verify original expected `save_count`/wall-time effects separately. Compare the persisted gameplay continuation after resume against an uninterrupted branch using the declared native save semantics; do not demand that all pre-save statistics remain equal.
- Run two fresh native-save loads with identical physical commands, including combat, and compare complete gameplay/RNG witnesses. Verify UID relationships, scheduler order and all collected fields survive the intended save boundary.

This is a source audit of the bounded witness and its missing state. The current 2026-10-02 22:35–22:36 UTC browser checkpoint passes 15 primary checks on core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60` and Rust `54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e`; its same-open/scrolled Help refresh, replay/font/viewport and save/Continue comparisons cover complete bounded DRLP and original MT bytes. The separate six-check encounter/autorun gate records visible combat and native zero-delay Escape cancellation, including twenty later stable native frames. Neither implements the complete witness above. One serial measured DRL heavy job at a time is authorized.

The earlier 2026-10-02 21:02 UTC 13-check checkpoint used core `6b8e1e78e52ce8d387d1f3b9c39401e5cfd3a88684db321f51a7cf985f544120` with the same Rust adapter. It remains historical evidence; the current receipts below identify core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`.

Compiled `drl_probe_run_delay` and `drl_probe_multimove_active` getters independently corroborate platform delay and automatic-move activity in the current interruption gate. They do not change DRLP v1 into a complete world witness. Exact enemy UID/HP, player-kill attribution, complete Lua/world/scheduler/queue/statistics state and all relevant RNG streams remain uncovered.
The [next full-state witness audit](FULL-STATE-WITNESS-NEXT.md) defines the source-derived closure work and requires a certified capture phase after original `PreAction` preparation, not an arbitrary suspended modal phase. Native serialization cannot serve as the pure witness: saving changes statistics, detaches the player and clears the level; `TLevel.WriteToStream` mutates `FID`; raw record layouts include pointer-bearing fields; Lua serialization uses formats and table order unsuitable for canonical comparison. Owner-local read-only capture must explicitly cover these fields, raw Lua state and ordered scheduler/entity relations without hooks, RNG or clock sampling.
