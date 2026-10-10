# Attribution and source

Cataclysm: Dark Days Ahead is developed by the Cataclysm: DDA contributors.
The authoritative upstream is <https://github.com/CleverRaven/Cataclysm-DDA>.
This adapter derives from stable **0.I-1**, commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`:

- [Original rng.cpp](https://github.com/CleverRaven/Cataclysm-DDA/blob/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/src/rng.cpp)
- [Original rng.h](https://github.com/CleverRaven/Cataclysm-DDA/blob/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/src/rng.h)
- [Original clamp helper](https://github.com/CleverRaven/Cataclysm-DDA/blob/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/src/cata_utility.h#L222)

The original source and this derived adapter are licensed under
[Creative Commons Attribution-ShareAlike 3.0 Unported](https://creativecommons.org/licenses/by-sa/3.0/).
The exact upstream license notice is preserved in `LICENSE-UPSTREAM.txt`.
Preserve this attribution, identify modifications, and retain the same license
when distributing this derivative. Provide the overlay, generator, provenance
and original-source link alongside any deployed derived binary.

Modifications: six function-local C++ distribution objects are placed in a
capturable registry with identical default constructors; their original function
calls and algorithms remain intact. A separate C byte API serializes and
transactionally restores the engine and all six distributions. The repository
retains pristine upstream separately. This folder's `reference/original_rng.cpp`
and `fixtures/include/rng.h` are exact byte copies of their two original inputs.

Test fixtures supply only isolated calendar/unit representations, unused coordinate
forward declarations, a diagnostic counter and an assertion macro. The clamp
helper is unchanged original source. They are verification scaffolding and must
not be used as the real game's calendar, units, coordinates or diagnostics.
No graphics, sounds, game data or other bundled assets are included in this
bounded adapter; their licenses remain part of the whole-port publication audit.

The already-installed Emscripten/LLVM toolchain and its standard-library archives
are used for verification. They are external build tools and are not relicensed
by this notice or distributed in this adapter's source deliverable.
