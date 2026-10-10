# CDDA 16x16 asset handoff

This is the intended interchange format for a future asset adapter, not an
installed or tested new tileset. The original-engine reference build retains all
upstream graphics. New assets belong to the separately coordinated asset task;
no engine source or pristine upstream file needs to change to prepare them.

The source contract is Cataclysm: DDA 0.I-1, commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`, `doc/TILESET.md` and
`src/cata_tiles.cpp`. Upstream code/content attribution and CC BY-SA 3.0 notices
remain required; new art needs its own author, origin and redistribution terms.

## Native compiled tileset

A self-contained import directory contains `tileset.txt`, `tile_config.json`,
PNG atlas files, an asset/source-ID manifest and license/attribution files.
`tileset.txt` names the package and points to its JSON and main atlas. Use a
distinct package name so that the bundled tilesets remain available.

```text
NAME: jrogue_16
VIEW: Jrogue 16x16
JSON: tile_config.json
TILESET: atlas.png
```

```json
{
  "tile_info": [{"width": 16, "height": 16, "pixelscale": 1, "iso": false}],
  "tiles-new": [{
    "file": "atlas.png",
    "tiles": [
      {"id": "unknown", "fg": 0},
      {"id": "player_male", "fg": 1},
      {"id": "player_female", "fg": 2}
    ]
  }]
}
```

This example demonstrates the schema only. It is not an asset coverage claim.
Each real entity entry uses an actual stable source ID, including terrain,
furniture, items, monsters, fields, traps and vehicle/character overlays.
Translations and display names never serve as tile IDs. Native gender,
seasonal, intensity and equipment variants retain the source's suffix/prefix
conventions. Connected terrain retains `multitile`/`additional_tiles` variants;
weighted alternatives and rotations retain their separate native semantics.

Each PNG dimension is a multiple of 16. The first atlas starts at offset zero;
its index is `column + row * (atlas_width / 16)`. Later atlases use the engine's
cumulative sprite offset. For the first handoff, a single atlas avoids accidental
index-offset disagreement. Do not resize larger sprites and describe the result
as native 16x16 pixel art.

The compositing source described in `doc/TILESET.md` uses sprite root names;
the **compiled runtime** configuration above uses numeric atlas indices. Keep
that distinction explicit when generating the final adapter.

## Required manifest and acceptance evidence

Record each native entity ID, art ID, atlas filename, row/column/index, dimensions,
author/origin/license and SHA-256. Record aliases and missing IDs explicitly.
Preserve the game's original visibility/knowledge and overlay order; an asset
adapter must not choose undiscovered or otherwise hidden entities.

Before selecting the new tileset, verify PNG dimensions, every index bound,
duplicate IDs, variant/overlay mappings, hashes and redistribution notices. Then
measure actual original-engine startup, map objects, character equipment,
rotation/connectivity, zoom and Japanese layout in the browser. A Rust renderer
must consume immutable presentation records; texture choice and redraw must not
advance the original gameplay RNG. No new tileset is selected or published until
these consumer checks pass.

## Authoritative final v5 handoff

Use `assets-16px/HANDOFF-native-v5.txt` and `native-v5/`, delivered by the
separate asset owner. V4 is historical. The verified ZIP is 61,224,462 bytes,
SHA-256 `48baf542ea2432a38bca94cba79829ebe5519622293f51a8d17719ee1dbaa6d6`.
`evidence/native-v5-handoff.json` records independently checked ZIP and selected
file hashes, PNG dimensions, upstream identity and notice.

The selected native NAME is `cdda16_combined_ready`; preload all six files from
`native-v5/tileset/CDDA16_Combined_Ready` together: `tileset.txt`,
`tile_config.json`, `core-tiles.png`, `core-functional.png`, `overmap-tiles.png`
and `overmap-functional.png`. Their combined encoded size is 1,200,829 bytes.
Preserve all original graphics and user preferences; use a separate optional
tileset selection during verification before changing any default.

The handoff has 1,926 main images plus 46 auxiliary images, covering 19,521
visible static IDs with shared visual families included. The 326 source-backed
nonvisual/development candidates are excluded from artwork completion counts.
Individual models, seasons, vision states, mods and dynamic overlays are not
all complete. Gallery/atlas checks by the asset owner are not game-rendering
acceptance; map, overmap, movement, layers and fallback must be checked in the
actual original engine after world/game/save recovery.

The new sprites are original user-requested artwork, with no copied upstream
sprites according to their NOTICE. Retain that notice and source attribution;
it does not declare a blanket open-source grant for all new art. External
publication is outside the active request. The runtime package is unchanged
and v5 game rendering remains unverified.
