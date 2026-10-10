# Retained Tales of Maj'Eyal 1.7.6 native boundary

The original C/Lua gameplay remains the gameplay kernel. These files register the original modules, expose the original main state to a browser platform driver, and snapshot previously inaccessible original Gaussian cache state. They do not implement a replacement Actor, Game, map, combat, RNG algorithm, campaign, or birth sequence. The earlier Rust formulas are characterization fixtures only.

## Original registration and bootstrap

`retained_registry.c` opens every ordinary module in the exact `src/main.c:1228-1251` sequence, including the repeated bit module. Its declarations must resolve to the real upstream implementations. Registration uses `lua_cpcall` to report errors rather than hiding missing modules. Optional Steam/Discord source branches are omitted for the offline browser platform.

The original `src/core_lua.c:4102` registration creates `core.display`, `core.mouse`, `core.key`, `core.game`, `core.zlib`, global `rng` and `bresenham`, and the actual userdata classes. `core.game.VERSION` is the original core API version 17. SFMT, FOV, struct packing, map data/visibility/path behavior, Lua serialization and ToME rules must stay original. Map also includes display resources; replacing the entire map module with a rendering stub would omit simulation behavior.

`tome_initialize_original_globals` establishes the real `__uids` table and `__SELFEXE` value. Mount original virtual paths, initialize native platform services, register modules, initialize globals, then execute original `/bootstrap/boot.lua`. A caller can execute `/loader/pre-init.lua` and `/loader/init.lua` via the registry helpers, or execute the sibling's actual bootstrap driver, which performs those loader phases itself. Do not invoke both paths.

`tome_run_original_loader` accepts the original loader's seven Lua arguments: engine, version, module, save name, new-game boolean, extra-info assignment source, and optional profile. `game/loader/init.lua:32-38` executes extra-info assignment source in its private environment. Use trusted assignments such as `no_birth_popup=true;set_addons={};birth_done_script="__TOME_WEB.birth_done()"`; a bare table literal fails that parser. This trusted testing entry is not an interface for arbitrary browser-provided Lua.

## Original main accessors and scheduler

`make_main_platform_overlay.py` appends one include to pristine `src/main.c`. The generated original body is byte-identical, including the private static Lua pointer, `on_event`, `on_tick`, and `define_core`. Compile the generated file with `-Dmain=tome_desktop_main` and replace the original main object in the browser link; do not link both.

The exports are:

| Function | Behavior |
| --- | --- |
| `tome_main_get_state()` | Read original private Lua state pointer. |
| `tome_main_attach_state(state)` | Attach a non-null fresh real state; refuse replacing a different live state. |
| `tome_main_initialize_core_metadata()` | Preserve existing valid metadata, or perform original `calloc`, assign existing `define_core`, and invoke original `define("te4core",-1,...)`. |
| `tome_platform_drain_input(budget,result)` | Forward real SDL input events to original `on_event`. Original handled events wake simulation. Return any non-input event unchanged for the host; never tick or draw. |
| `tome_platform_step_original()` | Dispatch original `on_tick` at most once under original active/paused/exit/current-game gates. |

The driver must initialize the real SDL/TTF/image/GL/PhysFS services and handle returned window/timer/audio/quit/redraw events. `src/main.c:621-635` calls original `current_game:tick`; `1704-1727` establishes the input wake and loop gates. Never copy movement, energy, attacks or Actor mutation into Rust input code.

Original Game construction already reaches native fonts, image surfaces, texture metadata and the actual Minimalist UI. `lua-map/BOOTSTRAP.md` gives source paths and line numbers. Shader/FBO optional branches exist upstream; image dimensions and font metrics are required by real constructors and cannot be arbitrary placeholders. Surface `glTexture` returns seven values, with source width/height in indices 6/7.

## Gaussian cache preservation

Original `src/core_lua.c:3873-3899` uses three static cached locals in `rng.normalFloat`: `stored`, `z0`, `z1`. `rng.seed:3717-3724` intentionally leaves this cache unchanged. Saving SFMT alone therefore cannot restore the next normalFloat result.

`make_core_state_overlay.py` relocates exactly those three unchanged declarations to file scope and appends `tome_normal_snapshot.inc`. It reverses the relocation to verify reconstruction of every original byte. The RNG algorithm and seed semantics remain unchanged. Use generated `core_lua_rng_state.c` instead of the original core object. The SFMT wrapper from `native-core-work` likewise replaces the original SFMT object; never link both implementations.

Gaussian schema 1 is 36 explicit little-endian bytes: `TOMENORM` magic, version, stored flag, exact IEEE-754 z0/z1 bits, and an FNV checksum for accidental corruption detection. Size/write/validate/restore functions preserve original possible non-finite values, because upstream's Box-Muller input can produce them. Restore validates its entire envelope before any mutation. A combined save must validate both Gaussian and SFMT envelopes before restoring either; record both between original commands. This state envelope is not an original `.teag` savefile or a security authentication mechanism.

`TOME_RNG_CHARACTERIZATION` exposes only a test registrar for the **actual original** static `rnglib` table. Production does not compile this conditional export. `test_original_gaussian.c` and `build_gaussian_test.py` exercise actual Lua callback execution, 24 checkpoints with 1,000 mixed draws each, odd cached-pair reseeding and unchanged SFMT after a cached draw, and atomic rejection of malformed envelopes. The runner uses the original Lua/PhysFS archives and original SFMT; it provides no missing-symbol mock implementation.

## Verified and pending

Additional bounded audit in `native-random-candidates.json` confirms actual `math.random` use in Infinite Dungeon room/building parameters and artifact costs. Original `src/lua/lmathlib.c:184,210` delegates to libc `rand/srand`, separately from SFMT. `make_libc_rng_overlay.py` appends a 28-byte little-endian schema 1 seed snapshot to the exact SDK 6.0.8 musl `rand.c`; its original body is byte-identical and full `musl-COPYRIGHT` is retained. The `tome_libc_rng_snapshot_*` API preserves its default state, algorithm, conversions and seed behavior. `tome_combined_rng_restore` validates all three immutable components before restoring any. The characterization test also runs actual original Lua `math.random` callbacks and verifies that malformed Gaussian/libc components preserve all three states.

This combined boundary still requires quiescent execution: original particles use shared SFMT (`src/particles.c:40`), noise construction/lazy wavelet generation uses SFMT (`libtcod_import/noise_c.c:97,103,680`), and WFC seeds its local generator from SFMT (`src/wfc/lua_wfc.cpp:95`). Wait for original worker generation and particle updates before capturing/restoring. Existing original draw side effects must be accounted for before a pure Rust rendering boundary is claimed.

`platform-compile-results.json` records successful actual Emscripten compilation of the append-only original main with its renamed desktop entry and the strict-warning platform drain. `generated/main-overlay-provenance.json` verifies exact original-body bytes. The Gaussian production overlay compiled against actual SDL2/image/TTF/libpng/vorbis headers with the same warnings as the original source. `generated/overlay-provenance.json` verifies exact reversible original reconstruction.

The Gaussian executable test is prepared, but its build/run was held until the parent releases the shared host memory hold. Full native linking, real campaign boot/birth, browser input, actual rendering, original save/load graph compatibility, persistence and localization are separate integration milestones. No complete game or publishable browser build is claimed here.

## License and provenance

Retained source is official T-Engine/Tales of Maj'Eyal 1.7.6, Nicolas Casalini, GPL-3.0-or-later where stated in the source headers. Original SFMT carries its own upstream BSD license; retain it. These local adapters carry GPL-3.0-or-later identifiers. Archive acquisition/source tag/asset restrictions are recorded by the parent and source audit. No original source archive or shared repository file was modified by this work.
