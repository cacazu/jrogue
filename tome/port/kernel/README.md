# Original C/Lua kernel integration

The original official 1.7.6 source remains pristine under `../../upstream`. All 127 original C/C++ translation units compiled with the existing Emscripten 6.0.8 SDK: 23 kernel units and 104 bundled dependency units. Build results are in `native/full-build-results.json`; exact Premake source expansion is in `build-plan/output/`.

The faithful static-archive link identified eleven missing graphics functions. Authored browser implementations and real-WebGL test HTML are in `build-plan/graphics-adapter/`. Their object/contract verification does not establish real game startup or real WebGL fidelity. Link and browser verification are pending the parent task's shared-memory release.

`bindings/` registers the original native modules, adds append-only main-state accessors, and exposes original RNG state. The Gaussian overlay relocates three static variables without changing RNG algorithms or seed behavior. The SDK musl wrapper preserves the exact libc `rand`/`srand` implementation used by Lua `math.random`. Complete restore validates SFMT, Gaussian cache and libc envelopes before mutation. It must occur only while all original RNG consumers are quiescent.

`bootstrap/real-core-probe.lua` drives the actual loader, Game, Player and Birther methods. It requests original default Cornac/Berserker descriptors and original movement/attack virtual commands. It contains no replacement actors, generation, combat, or turn rules. It is syntax-verified with original Lua 5.1; actual character birth and commands are still unproven.

`native/native_browser_init.c` initializes real SDL/font/image/GL/PhysFS services and calls those retained bindings. This comparison bootstrap keeps original graphics while Rust integration consumes immutable observations. Its new link and browser run are pending. The production Rust adapter workspace is `../retained/`.

The exact VFS manifest includes genuine fonts/UI and compressed ToME graphics/music archives (450,441,318 bytes for those two archives alone). The only Lua compatibility overlay removes the audited unused FFI import from AsciiMap in an isolated build copy. Upstream files and native saves are never modified.

Still required: original browser boot/birth/commands, complete graphics fidelity and visibility, native dialogs/actions, visual RNG/FOV separation, native object-graph saves and deterministic resume, complete semantic-ID/Japanese coverage, campaign and PC/mobile verification, and private Site publication with corresponding source and notices. No Site or playable-game claim is made.
