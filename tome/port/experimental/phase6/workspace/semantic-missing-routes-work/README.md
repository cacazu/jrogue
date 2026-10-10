# Twenty original display routes — source candidate

This folder owns a source-only candidate for the 24 ASCII identities in the
actual Japanese native registration trace. It writes only this folder. Original
ToME 1.7.6 source, current base/dream catalogue, native binaries and browser
proofs remain unchanged.

`candidate/semantic-route-delta.json` adds **20** exact semantic IDs with original
English labels, separate authored Japanese supplements, empty parameter lists,
unchanged native tags and producer/consumer provenance. `candidate/en.json` and
`ja.json` have exactly the same 20 IDs. `ja-base.json` contains 20 null values so
the existing resolver keeps `missing_official_japanese` accurate. The authoring
is recorded as a supplement, not an official Japanese translation.

The reviewed terminology keeps the official `ハーブ物：`, `ルーン：` and `力の源：`
prefixes, `フェイズドア`, `地形読み`, `ライトニング`, `遅行毒`, `インビジブル` and activation
vocabulary. `translation-review.json` records exact official related source
lines/hashes and the reasoning for each new label. There are no format parameters
in these 20 finite names; no username, object item-name parameter, native plural
rule or description is replaced.

The eleven legacy inscriptions remain excluded from drop tables and retained
for original compatibility and occasional NPC use. The hidden generated
`Activate Object` base remains distinct from its already translated visible
`display_name` and keeps the original `T_ACTIVATE_OBJECT_<n>` identities.

## Exact reversible original leaves

`candidate/overlay/game/engines/default/engine/interface/ActorTalents.lua` changes
only the original line 88 `t.name = _t(t.name, "talent name")` into direct literal
branches guarded by the **already finalized** native `short_name` and the exact
original English value. All ID generation, registration, descriptions, rules,
callbacks and RNG calls remain byte-identical outside that single splice.

`candidate/overlay/game/engines/default/engine/Faction.lua` changes only original
line 40. Its Players branch requires native `short_name == "players"` and exact
`name == "Players"`; all other factions use the unchanged native call. It does
not affect an external actor/player name named Players.

Both derived files retain the original GPL notice. Their adjacent `.patch`
files and `source-manifest.json` record exact before/after bytes. Reversing the
single splice reconstructs the original SHA-256. The candidate index enumerates
124 stable native short names: 50 activations, 66 legacy inscription slots,
seven other talents and one builtin faction. Slot numbers are identity suffixes,
not localization format parameters, and are never translated or regenerated.

## Parent integration contract

Current Rust `Stage::Extension` is restricted to the original reviewed
one-ID DEATH_DREAM extension. Do not pass this new delta to that loader. Keep the
existing dream input as stage 6 and the existing two CJK policies as stage 5.

`mergeReviewedDelta()` in `merge-delta.mjs` is a checked object-based loader
candidate for small integration fixtures. It rejects existing ID/source route
collisions and EN/JA/registry/placeholder mismatches, creates fresh objects and
retains every base semantic value, original Japanese configuration, route,
supplement and metadata. The actual base is 24,825 IDs, plus the existing
separate dream ID. Selecting this delta would produce 24,845 base IDs plus one
dream ID, and 499 authored supplements instead of 479.

For actual catalogue preparation, `prepare-merged-catalogs.mjs` uses
`stream-merge.mjs` to copy the base JSON in 64 KiB chunks and insert only these
20 keys/routes. It verifies reviewed whole-file SHA-256 before selecting each
new file. It avoids materializing the 30 MB registry object. Outputs are fresh
`merged-candidate/{english,japanese,registry,supplements}.json`; unsuccessful
`.partial` files remain unselected. The CLI has not been run against the whole
catalogue in this source-only delegation. The parent should monitor that job
before selecting its outputs.

**The exact guard is required.** The current generic resolver can fall back from
an unknown tag to another tag for the same source. Adding a `Heat/talent name`
route alone could then affect a `Heat/entity name` lookup. Before registering
the actual native semantic bridge, install
`applyExactRouteGuard(resolver, routeIndex, { variant: "overlay" })` on its
actual `SemanticTextWasm` resolver object. The guard accepts these new sources
only at their exact original tag and matching recorded overlay file/line. Use
`variant: "original"` only when mounting the pristine original consumers. It
rejects mismatched tags, contexts, filenames, missing lines and stale lines with
`unknown_source_tag`, which the existing native adapter delegates to original
`_t`. Other catalogue sources are untouched. Do not route native calls through
raw `resolver.request()`, which bypasses this wrapper. Explicit known semantic
ID requests are separate from raw source lookup.

Mounting a derived leaf and selecting the matching index variant must happen
before the first `engine.interface.ActorTalents`/`engine.Faction` require in a
fresh VM. Because the overlay shifts original line numbers, regenerate the
source/VFS manifests rather than claiming an old proof covers it. Existing
catalogue locations remain valid for unaffected single-alias routes, but all
actual native localization regression tests and save/load identity checks are
still required.

## Four unfinished names and 953 repeated Japanese inputs

`unfinished-placeholder-policy.json` retains the exact four upstream names
`azdadazdazdazd`, `ervevev`, `zeczczeczec` and `Indiscernible Anatomyblabla`.
They are excluded from the active 20-route delta. Their descriptions do not
establish intended finished names or finished gameplay implementations, and
observed registration does not establish current player learnability. No
replacement talent, mechanical completion or new gameplay name is invented.
These four Japanese label semantics remain unresolved.

`already-japanese-policy.json` records the 953 repeated Japanese inputs and
877 exact official target equalities. It adds zero translations and performs no
reverse-Japanese/global replacement. Any future decorated terrain, evolution,
object/randart or effect route needs original producer identity/parameters.

## Source verification

Run only the lightweight source checks in this delegated scope:

```powershell
& 'C:\Program Files\nodejs\node.exe' --max-old-space-size=64 semantic-missing-routes-work/prepare-candidates.mjs
& 'C:\Program Files\nodejs\node.exe' --max-old-space-size=64 semantic-missing-routes-work/test-source-candidates.mjs
```

The generator passes 41,434 structural/source assertions, streams all 20,617
base routes and 23,404 official Japanese registrations, and checks the pristine
source hashes before/after. The lightweight fixture suite currently passes
572 assertions for exact ID coverage, missing-official status, byte-exact patch
reversal, base preservation, duplicate-key/ID/source rejection, wrong-tag/name
context protection, guard reversal and streamed JSON insertion across UTF-8
chunk boundaries. This is **not** Lua syntax execution, Rust/WASM validation,
native game/RNG verification, browser coverage or full-campaign translation
coverage. Parent integration and runtime validation remain required.
