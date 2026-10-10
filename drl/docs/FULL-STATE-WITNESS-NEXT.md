# Complete-state diagnostic next milestone

The verified DRLPv1 probe preserves all serialized original MT words and a bounded set of player/level fields. It is not complete authoritative world state. Actual browser checks certify the observed paused player/menu states and fresh-save continuations only.

A read-only audit of the pinned original and generated source found that native save bytes cannot be reused as a canonical purity fingerprint:

- TDRL.WriteSaveFile (drlbase.pas:1744–1781) updates statistics, detaches the player, writes files and clears the level.
- TLevel.WriteToStream (dflevel.pas:468–496) changes FID to default.
- TLuaMapNode.WriteToStream (vluamapnode.pas:39–45,569) serializes raw being/item pointers.
- TBeing command serialization (dfbeing.pas:313; drlcommand.pas:6–12) contains an item pointer and an AnsiString reference.
- Lua property serialization (vluaext.pas:447–514) uses unsorted lua_next and raw userdata payloads.
- Reading level.data (core/level.lua:527–545) can create player.level_data[level.id].

Keep DRLPv1 unchanged. Implement an independent versioned DRLF writer in the owning units, with explicit little-endian scalar encoding, section lengths, UID/ID references and bounded output. Preserve ordered children/inventory/target lists where order affects simulation; sort primitive Lua table keys, use lua_rawget, restore stack depth in finally and support table graph references. Reject unknown function/thread/userdata/pointer values or overflow until an explicit codec exists.

Required sections are game and challenges/hooks; all six map arrays/cells/occupant UIDs and level state; node ownership/ordered children/raw properties and hooks; full items/mods/equipment; being command scalars and strings; player traits/kill tables/statistics; RNG and UID allocator; targeting, chain fire, last/move/target positions, master dodge, enemies in vision, blood boots, action flags and MultiMove direction/count/path; and mechanics/input-affecting settings.

The native save omits several live fields. Capture at the documented post-PreAction boundary (generated drlbase.pas:492–509), with an explicit phase marker. A generic host sleep may occur mid-action, so it cannot certify complete continuation state.

Exclude wall-clock fields from gameplay equivalence: GameRealTime/ProgramRealTime, statistics real_time/real_time_ms, frame/input timestamps, repeat deadlines and drawing/animation clocks. Keep game/level time and gameplay counters. Account for the documented native save_count increment explicitly. Loading intentionally resets unsaved live fields; compare durable pre-save/resume subsets with documented transition differences, then compare the full live state of two identical fresh restores.

Validation must include 50 captures preserving gameplay bytes/MT/Lua stack/node ownership/statistics; draw/locale/font/viewport/Help purity; identical-command section-by-section equivalence between fresh restores; enemy UID/HP/ammo/damage/kill/map/corpse witnesses; autorun direction/count/path cancellation; and unsupported type/oversize/cycle/reference cases. This design is source-audited, not implemented or runtime-verified.
