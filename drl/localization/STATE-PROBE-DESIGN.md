# Read-only canonical gameplay witness proposal

This is a source-reviewed design, not an implementation or runtime certificate. It supplements [the current coverage audit](../docs/STATE-PROBE-COVERAGE.md). The existing DRLP/player/RNG probe remains useful but cannot prove complete rendering purity or save/resume equivalence.

The smallest useful addition is one bounded canonical writer with owning-unit field emitters. Start with a clearly marked native partial witness; complete baseline coverage additionally requires a Lua object/function graph and a closed source field ledger. Unsupported, truncated or partial captures must fail a complete-state comparison.

## Proposed boundary

```pascal
function TDRL.EmitReadOnlyState(
  aCapture: TStateCaptureContext
): TStateCaptureResult;

procedure TNode.EmitReadOnlyFields(
  aCapture: TStateCaptureContext
); virtual;
```

The result carries schema, build and ledger identities; captured-section flags; `Complete`; byte count; and a precise failure path. Browser-only exports can begin a capture, return its length, read bounded chunks and release it. Begin captures once into a bounded immutable buffer while the core is paused; chunk reads never revisit live objects. Parent must choose explicit byte/depth/node limits from measured baseline state. Exceeding a limit returns failure, never a shortened equal witness.

Encode fields individually: fixed-width little-endian scalars, declared enum/set bit widths, explicit optional values, length-prefixed original string bytes and exact numeric representations. Exclude raw object/record memory, padding and pointer addresses. Hash outside the original core. Do not call native save writers, gameplay getters, hooks, statistics updates, clock readers or RNG sampling. The existing reviewed RNG stream export may be included unchanged.

## Owning seams

| Owner | Required direct fields and relationships |
|---|---|
| [vnode.pas](../upstream/fpcvalkyrie/src/vnode.pas), declaration near 245 | UID, original ID/name, flags/hooks, registration identity, parent and circular child links. Preserve actual child membership/order. |
| [vluamapnode.pas](../upstream/fpcvalkyrie/src/vluamapnode.pas), near 145; [dflevel.pas](../upstream/drl/src/dflevel.pas), near 139 | Bounds, cell/HP/light bits and tile references in fixed coordinate order; six `TMap` arrays; level metadata/perks; `FActiveBeing` and `FNextNode`. |
| [dfbeing.pas](../upstream/drl/src/dfbeing.pas), near 144; [dfitem.pas](../upstream/drl/src/dfitem.pas), near 61 | Full inherited thing/entity state, each being's action costs/positions/HP/flags/path, individual item-property fields/mods/amounts/prototype. |
| [dfplayer.pas](../upstream/drl/src/dfplayer.pas), near 23, and component owners | Progress, quick slots, kills, traits, inventory/equipment, targeting, multimove/perk queues and direct statistics map/time fields. |
| [drlbase.pas](../upstream/drl/src/drlbase.pas), near 82; [dfdata.pas](../upstream/drl/src/dfdata.pas) | Challenges, module identities/order, scheduler/control state, rule-affecting globals and options. |
| [vuid.pas](../upstream/fpcvalkyrie/src/vuid.pas), near 55 | Policy, last-issued UID, capacity/initial capacity and every indexed store slot. `Count` is not the live-object count. |

Use tagged references: nil, positive UID, named root, or deterministic capture-local object ordinal. UID zero can mean a live unregistered/root node. Build a read-only identity map of known live objects before resolving references; an unknown/stale reference fails instead of being dereferenced. Keep entity definitions and traversal order separate. UID sorting must not erase action order: [level ticking](../upstream/drl/src/dflevel.pas) near 1381 follows the child ring and retains `FNextNode` across callbacks.

## Native capture hazards

- Original `TLevel.WriteToStream` assigns `FID := 'default'`; original game saving clears/detaches state and statistics saving reads the clock. None can serve as a diagnostic.
- `TCommand.Create` overloads initialize different fields. `FLastCommand` contains an item pointer and partly initialized/stale fields. The audited native readers use only its command byte; confirm Lua exposure before declaring other fields inactive. Emit reader-proven live fields under a command schema, not the raw record.
- `TStatistics.Update`/`OnSaveFile` mutate wall-time totals. Read `FMap`, `FGameTime` and `FRealTime` directly. Some hash-map lookups mutate lookup caches; use reviewed linear enumeration.
- `TInventory.FChosen` is declared/initialized but had no native reader in this scan. That is a classification candidate, not proof that all Lua/custom readers are absent.
- Apparently visual fields, caches and timers require reader-based classification. Source names do not establish that they are presentation-only.

## Lua graph requirements

An initial diagnostic can use `TLuaSystem.Raw`, `GetLuaIndex`, `lua_rawgeti`, `lua_next` and exact type checks with stack restoration in `finally`. Avoid `TLuaTable` helpers that create/remove registry references. Sort keys by a declared typed encoding, never pointer address or locale formatting. Preserve value types, numeric bits, table aliases and traversal identities; unexpected state reports its exact path.

Scalar/table-only traversal is insufficient for the ordinary game. [Player initialization](../upstream/drl/bin/data/drl/main.lua) near 240–260 creates progress/award/history/episode tables. AI adds arrays and scalar state. `chosen_item` in [core/being.lua](../upstream/drl/bin/data/core/being.lua) near 414 is a registered native object table: `TLuaState.Push(ILuaReferencedObject)` returns that table, whose `__ptr` is lightuserdata. Recognize it as a typed native reference; do not blindly recurse/copy its pointer. `target_area` in [items.lua](../upstream/drl/bin/data/drl/items/items.lua) near 1341 is a cloned area userdata; [vluatools.pas](../upstream/fpcvalkyrie/src/vluatools.pas) near 318–324 and 671–674 allocates/copies `TArea`. Emit reviewed coordinate/area fields through a typed adapter, not opaque userdata bytes.

Functions also matter. [TNode.register_hook](../upstream/fpcvalkyrie/src/vnode.pas) near 1433–1477 stores a validated symbolic registry key; [PushHook](../upstream/fpcvalkyrie/src/vluastate.pas) near 549–580 also accepts direct functions. Prototype registries contain functions, and [core/main.lua](../upstream/drl/bin/data/core/main.lua) near 275–295 composes closures capturing `bp`, `ai_proto` and `func`. [C sequence closures](../upstream/fpcvalkyrie/src/vluasystem.pas) near 1156–1189 capture count plus ordered hook-function upvalues. A prototype ID, C-function tag or `lua_dump` alone therefore cannot witness mutable upvalues or closure order.

Complete baseline support requires an alias/cycle-aware graph with typed native references/values, metatables/environments, function identities and upvalue graphs. Known C implementations need stable source/ABI identities plus their upvalues. Unknown functions/userdata fail closed. The original Lua 5.1 public API lacks shared upvalue-cell identity; the actual browser adapter's newer Lua runtime needs a reviewed identity seam rather than emitting process addresses. Review the native Win64 string-length binding as well: `lua_tolstring` needs an ABI-correct `size_t` pointer; a four-byte length pointer cannot be reused on Win64. No binding change is implemented here.

## Milestones and acceptance

1. Emit direct native fields/order/UID/RNG and expose `Complete=False` until the ledger closes. This improves off-screen terrain/being/item diagnostics without claiming full coverage.
2. Add bounded raw Lua diagnostics with explicit unsupported paths and prove exact stack restoration. Baseline object/area/function cases must not disappear silently.
3. Implement the complete typed graph, then disposition every mutable native field and reachable Lua root from actual readers. Required unknowns include vision/path caches, Lua-visible visual fields, timers, metatable mutations and shared upvalues.
4. Only set `Complete=True` when no gameplay field/root is pending. Capture twice paused; mutate representative terrain/off-screen being/ammo/perk/scheduler/Lua fixtures and require witness changes; repeat render/locale/viewport/non-action-view operations and require gameplay/RNG equality. Treat expected native save-count/wall-time changes separately, then compare resumed continuation with uninterrupted and repeated-load branches.

No emitter, hook, save behavior, source generator or canonical unit was changed by this proposal. Full localization and full-state runtime verification remain incomplete.
