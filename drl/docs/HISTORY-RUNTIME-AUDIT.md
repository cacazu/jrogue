# History runtime audit — 2026-10-02

The empty history sidecar has a concrete integration cause: the authored history reader selects an array-path overload whose numeric first-key implementation addresses the preceding Lua stack slot. The narrowly authorized correction uses the scalar Variant-key overload. It changes presentation metadata lookup only.

This audit and its source-backed stack oracle execute no compiler, native binary, browser, game, save serializer, or gameplay hook. Actual confirmation on the corrected original engine belongs to the coordinating agent.

## Runtime observation and inspected versions

The coordinating agent reported 11 passing original Chrome scenarios on core SHA-256 `e13315d480a34b6903e12f686a809b43ca2e55c6508464dd05c4263defd3fd98` and Rust SHA-256 `c6715af823749d5365547d52a202f51903561966affc73284f8860e89505ac27`. That run's saved `/user/drl.presentation-history.json` contained `records:[]`. These are parent-provided runtime observations; this audit did not repeat those scenarios.

The relevant pre-correction source hashes are:

| File | SHA-256 |
| --- | --- |
| Authored localization/lua-semantic-adapter.pas | f8c68ee11e43bf792cc1fdc3b9c16aae0d3c56e4746c4a3bc9f4335158551729 |
| Canonical localization/overlay/src/drlio.pas | 98d78f29a19bae0b7c24a5a72fdaf3793f3f371bed9e61c91f67f46f9be36329 |
| Adapted core-adapted/drl/src/drlio.pas | a0ab3664455aa9a2030c8a2dd3f7f5b50454af92d2295e9986689ea4b984bf20 |
| Upstream/adapted fpcvalkyrie/src/vluatable.pas | fe6af4c808f3392ce46d08d9426bc71d117c68a89c346676114620c6df3e0205 |
| Upstream/adapted fpcvalkyrie/src/vluaext.pas | 2889cc6d7bcae827ad5fdb82346644642545d5f5bd99b50c04683f88ce572927 |
| Authored/adapted drlsemantichistory.pas | a4f53ffdfa936a377ac5161f25d8dcb54116709137600cc8159ce8753b24b0d0 |
| Generated drlsemantichistorycatalog.pas | e363c7f0264d916b688c9696de64e166e7bd6e985c0984473a9b8892588eea58 |

The original DRL commit remains `a6f965072b3a25b768c91dbced00367f1b57d865`; the Valkyrie pin remains `f89735a741a968997656c2d48a003ec569db7f22`. Pristine source bytes are unchanged.

## Producer, object path, count and registration

In the inspected adapted sources:

- `bin/data/drl/main.lua:247` initializes the player's `history` property with `self:add_property("history", {})`.
- `bin/data/core/player.lua:84–89` appends to `self.__props.history` with `table.insert`, substitutes `@1` with the original English level label, and uppercases an initial lowercase letter.
- `bin/data/drl/levels/intro.lua:215–216` preserves the original `player:add_history("He started his journey on the surface of Phobos.")`, then calls `ui.remember_semantic_history("history.intro.journey", exactEnglish, {})`. This sentence has no `@1` and already starts uppercase, so the resulting English guard matches exactly.
- `TDRLLua.RegisterPlayer` installs the actual player object as global `player`; `TPlayer` invokes that registration. The reader's `LuaSystem.GetTable(['player','__props','history'])` follows string keys to the same object property.
- `TLuaTable.GetSize` at `vluatable.pas:679–684` pushes that table and uses `lua_objlen`. This is the original dense-array length, not an enumeration of metadata fields.
- Adapted `drlio.pas:1743–1744` registers both history UI functions. `RegisterLuaAPI:1770–1775` assigns both original-history source callbacks.
- `drlsemantichistorycatalog.pas:58` contains the exact intro ID, English sentence and zero parameters. Its initialization assigns the validator and parameter projector.

There is no missing intro registry entry, wrong English template, absent callback registration, or deliberate semantic-record reset between the original intro append and its capture.

## Exact failing stack path

The pre-correction assignment is authored at `lua-semantic-adapter.pas:176`, canonical overlay `drlio.pas:1440`, and then adapted `drlio.pas:1465`:

```pascal
Value := History.GetValue([DWord(aIndex)]);
```

This chooses `TLuaTable.GetValue(array of const)` at `vluatable.pas:771–777`. The three-argument remember callback leaves these argument slots on the Lua stack:

| Slot | Value |
| --- | --- |
| 1 | history.intro.journey |
| 2 | original English sentence |
| 3 | empty typed-parameter table |
| 4 | history table pushed by TLuaTable.Push |
| 5 | numeric key pushed for the lookup |

`vlua_getpath:581` converts its initial `-1` history-table index to absolute index 4. The numeric branch of `vlua_getvarrecfield:208–210` then pushes the key and calls `lua_gettable(L, idx-1)`. Because the index is already positive, this selects slot 3, the parameter table, rather than slot 4.

Key 1 is absent from the empty parameter table. `vlua_getpath:606–609` sees nil and returns false; `TLuaTable.GetValue:774` raises. The authored reader's catch at `:183–185` returns false. The failure occurs before `VarIsStr(Value)`. `DRLRememberCurrentSemanticHistory` consequently returns false without adding a record; the original Lua producer ignores that Boolean.

A nonempty preceding table could instead return an unrelated string, which the exact English guard would reject. At a native validation call with no Lua arguments, the same old numeric path would attempt index 0. No claim is made here about the native Lua error behavior for that invalid index; it is an additional reason to exercise save/load validation after the correction.

An empty accepted-record array is valid in `ValidateRecords`: the assigned-validator check passes and there are no records to validate. `DRLSaveSemanticHistory` can therefore write a valid schema-1 document with `records:[]`. File presence, valid JSON and save completion alone do not demonstrate history capture.

The semantic parameter reader has a separate numeric `GetTable` path. Its pushed table can alias the original parameter argument immediately below it, unlike this history lookup. That path is not changed by this fix; no broad correction of Valkyrie's mechanics-facing table helpers is included.

## Save, Detach and restore audit

Adapted `TDRL.WriteSaveFile:1796–1822` performs the original player serialization, `Player.Detach`, original level/particle serialization, and closes the native save stream. It then saves the three presentation sidecars before `FLevel.Clear` and the final browser save witness.

`TNode.WriteToStream` at `vnode.pas:549–577` serializes the registered `__props` subtable through `SubTableToStream`. The table-to-stream helper traverses keys/values; it does not clear the original history. Thus the native save retains the original English history.

`TNode.Detach` at `vnode.pas:647–662` unlinks a node's parent/sibling ownership pointers. It does not unregister its Lua object, alter `FLuaIndex`, clear `__props`, destroy the player, or erase history. The original global player remains available for sidecar validation after the native stream closes.

`DRLSaveSemanticHistory:258–264` validates the current records against the source callback before opening the destination. A failed source validation cannot successfully serialize populated records as an empty array; it returns false before creating the file. The observed successful empty ledger is consistent with zero accepted records from the failed intro callback.

On load, adapted `drlbase.pas:1656` clears presentation records at entry. Successful non-crash loading reconstructs the player at `:1699`, level at `:1706`, closes the input stream, then calls `DRLLoadSemanticHistory` at `:1727`. This restore ordering is compatible with checking the restored original English history. Crash saves deliberately omit presentation metadata and retain the existing English fallback behavior.

Do not use `TLevel.WriteToStream` for a read-only probe: its original implementation changes the level ID during save. The narrow correction needs no save reorder, extra serialization, replayed OnEnter hook, or RNG call.

## Authorized narrow correction

The authored bridge now uses:

```pascal
Value := History.GetValue(Variant(aIndex));
```

This explicitly selects `TLuaTable.GetValue(const aKey: Variant)` at `vluatable.pas:754–761`: push the history table, push the scalar key, `lua_rawget(-2)`, convert the result and reset the stack. It does not use the array-path numeric helper.

The existing `aIndex > Int64(Count)` check bounds accepted positive indices to a DWord count. `vlua_pushvariant:112–135` converts numeric variants through Double; every index within that bound is exactly representable. There is no signed LongInt narrowing.

The single existing `bridge-support` manifest replacement is refreshed from the authored snippet using its pinned original source anchor and unchanged UTF-16 offsets. No semantic IDs, EN/JA values, parameter contracts, native English producers, history-store schema, validators, modified-file dates, gameplay decisions or original upstream helper implementations change.

Post-correction source hashes:

| File | SHA-256 |
| --- | --- |
| localization/lua-semantic-adapter.pas | 546fbeaf76cbba9a069fcceced6ab5ad5cd97e642bc20208be46e2cf39b902c8 |
| localization/manifest.json | 13f31772481a4c48178ced5238051cace377af6fd06813b3df9d8b2d08f40d1e |
| localization/overlay/src/drlio.pas | df33a96241a8f53cf864894e0b4f4e6858f93594c62ea1e2029ea430f80d0cf5 |

## Verification boundaries and next runtime assertions

`localization/history-reader-stack.test.mjs` is a source-backed stack oracle, not execution of Pascal or Lua. It pins the actual upstream helper hashes, derives their lookup indices, checks the generated bridge against the authored snippet, and tests:

1. The current scalar-key source selects the raw-key API.
2. Three-argument capture succeeds; the previous array-key expression fails with empty parameters.
3. A decoy preceding parameter table cannot impersonate history.
4. Zero-argument native validation selects history and restores the stack.
5. DWord boundaries remain exact and rejected indices leave arguments unchanged.

Run it with `node --test localization/history-reader-stack.test.mjs`. The five checks passed. The existing localization suite also checks original source hashes, injection offsets, reproducible overlay bytes and explicit registry IDs. Manifest-dependent role-review/disposition provenance is refreshed without changing role decisions or counts.

The previously executed native history fixture has 363 passing checks, including 43 rejected metadata loads. It tests the actual store and generated whitelist/projector, but its `OriginalSource` and `CurrentSource` functions read a fixture array; it does not invoke the original game's `TLuaTable` reader. That scoped result remains valid for unchanged units and does not cover this integration failure.

Required actual-engine follow-up, owned by the coordinator:

- Regenerate the adapted core from the corrected guarded overlay, rebuild serially, and pin the resulting source/module hashes.
- Start a fresh normal intro, preserve the original append, save once, and assert the saved sidecar contains an index `"1"` record with ID `history.intro.journey`, the exact English template/guard, and empty `params`.
- Resume that save in a fresh browser instance. Compare the accepted semantic record and original English history guard, then save again and assert the record remains identical.
- Exercise a later history event with typed parameters, with no replay of intro/hooks, and assert the earlier record remains present and the new index/parameters match the original history.
- Confirm Japanese history projection and English fallback for compatible old/missing/empty metadata. Retain malformed/unknown metadata rejection and save-failure diagnostics.
- Where a callback-level native probe is added, call the real reader with stack depths 3 and 0, an empty/decoy parameter table, and verify the Lua top before/after. Use read-only property/RNG observations rather than original level serialization.

A successful nonempty intro/save/fresh-resume assertion on the rebuilt original core remains pending. Full-game localization completeness remains false.
