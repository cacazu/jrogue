# Read existing visibility decisions without changing gameplay

The UI adapter must read decisions prepared by the original game. A raw tile's existence, past exploration or distance does not authorize exposing its current actor. This is a bounded source map, not complete replacement of the native map renderer.

`engine/Map.lua:211–220` stores cells at `z=x+y*map.w`, with `map.map[z]`, `seens[z]`, `infovs[z]`, `has_seens[z]`, `remembers[z]` and `lites[z]`. After original logical preparation:

| Existing field | Meaning and restriction |
| --- | --- |
| `seens[z]` | Current visible/sensed strength. It includes original ESP/detection/party visibility; it does not alone resolve stealth/invisibility of every actor on the tile. |
| `infovs[z]` | Current geometric FOV/LOS marker. Lit visibility and special sensing have separate rules. |
| `has_seens[z]` | Historical exploration. Never expose a present actor based only on this field. |
| `remembers[z]` | Remembered terrain/map state. Not current actor visibility. |
| `lites[z]` | Existing light state. Does not replace the original actor visibility decision. |
| `map.actor_player` | Current native map viewer actor. Do not assume every map is viewed by the same party member. |

Read raw tables/fields with their existing values. Calling the map table as a coordinate accessor is normally a lookup, but a stricter view can use `rawget` and the existing `map.map[z]` to avoid metatable callbacks. Never call `apply`, `applyLite`, `applyESP`, `cleanFOV`, `updateMap`, `canSee` or `playerFOV` from the view exporter.

`engine/interface/ActorFOV.lua:34` holds `actor.fov.actors` and `actors_dist` candidate/distance caches. These are not cached invisibility/ESP decisions. `mod/class/Actor.lua:7491` stores actual visibility decisions in `viewer.can_see_cache[target][context]={result,chance}`:

- `"nil/nil"` is the ordinary `canSee(target)` context.
- `"false/0"` is the context used by `engine/Map.lua:694` for ESP's default parameters.

Keep those contexts distinct and read only existing entries. Missing entries mean the UI has no accepted decision; it must not fill one by calling `canSee()` or infer visibility from chance. `canSeeNoCache()` at Actor 7421 performs invisibility/stealth checks and consumes RNG at 7465,7470,7473; `canSee()` allocates/updates caches and invokes native `actor._mo:onSeen()` at 7505. Arcane Eye can explicitly set ordinary cache true at `mod/class/Player.lua:618`.

The original map renderer has additional native actor display/onSeen state. A cache-only UI projection can hide valid special cases until those are mapped; do not claim complete visibility mechanics based on this limited field list. Keep the original baseline renderer available until the new exporter matches it across ESP, Arcane Eye, darkness, blindness, stealth, invisible actors, party sensing, remembered terrain and viewer changes.

Original `Player:playerFOV()` at 550 includes trap-known memory, detection, senses, Arcane Eye effects, party FOV, light and combat-entry callbacks. It must run as original logical preparation in gameplay context; `render_boundary.lua` provides the source-stage scheduling seam. Serialize the accepted view only after its pending original tick-end callbacks drain.
