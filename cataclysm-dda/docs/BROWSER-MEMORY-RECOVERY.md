# Measured original-engine browser recovery

This is a local reference-runtime investigation, not a completed Rust port or
full-game acceptance. Preserve the same original engine, all runtime assets,
Japanese catalog and package notices. Do not stop unrelated processes, change
system configuration, lower the running memory floors, or restart repeatedly.

## Observed boundaries

The first Chrome session exceeded its 4 GiB owned-private cap during native
custom-world Enter work: 4,536,401,920 bytes private, with both system floors passing.
The catalog mmap adapter subsequently passed in the real original Japanese
menu. The native SDL startup size adapter preserved a 640 by 384 framebuffer.

The clean desktop retry retained a 5 GiB owned-private cap and 2 GiB physical
and commit floors. Its preparation snapshot at 19:30:37 UTC showed 6.52 GiB
physical and 7.99 GiB commit headroom. These were **not the actual launch
values**: the final pre-spawn check at 19:30:59 UTC showed 5.725 GiB physical
and 6.501 GiB commit headroom. Both passed the earlier 4/6 GiB launch gate.

Custom creation stopped at 19:32:54.205 UTC with 3,578,896,384 bytes owned
private, 2,078,232,576 bytes available physical and 2,574,352,384 bytes commit
headroom. Only the physical floor triggered. No native exception, WASM
allocation error or target crash was observed; the recorded CDP closure
followed controlled termination. All eight owned Chrome identities exited.

Actual pre-data observations were 512 MiB WASM linear memory, 10,548,896 bytes
used JavaScript heap and 182,784,871 bytes CDP backing storage. The native page
thread held synchronous work after custom-world Enter, so allocation-step heap/linear-memory
values were unavailable. Global drawdown is not attributed entirely to Chrome.

The actual launch-to-stop drawdowns were 3.789 GiB physical and 4.104 GiB
commit. These are censored observations: loading had not completed. Adding the
unchanged 2 GiB floors and a 1 GiB operational margin gives observed lower
bounds of 6.789 GiB physical and 7.104 GiB commit. The next candidate requires
a **fresh 7 GiB physical / 9 GiB exact-commit launch gate**, measured after
package hashing immediately before spawn. It retains the **5 GiB private cap
and 2 GiB running floors**. This gate is not a guarantee that the game fits.

At 19:34:57 UTC, after teardown, 7,183,306,752 bytes physical and
8,846,643,200 bytes commit were available: approximately 6.69/8.24 GiB, below
the proposed launch gate. See `evidence/resource-after-browser-floor-stop.json`.
No owned compiler or Chrome remained; the existing loopback server was retained.

## Package ownership findings

The generated packager retains one 116,219,695-byte compressed asset buffer.
Its Uint8Array and LZ4 file nodes share the backing buffer. The two cached
chunks are only small views; the package does not retain another complete
decompressed dataset. Streamed download chunks temporarily coexist with the
assembled buffer and become unreachable after resolution. Browser image/audio
preload plugins are disabled in this package.

Japanese materialization can avoid one transient 20,214,890-byte copy by giving
MEMFS ownership of the read buffer. The final MEMFS copy and original native
MAP_SHARED mmap copy remain required; native translation pointers reference
the mapped bytes. Detaching/freeing that mapping would corrupt the catalog.
These small bounds do not explain or promise removal of the multi-GiB spike.
No asset, game system or native data input is removed to fit a budget.

## One conditional compilation-mode candidate

The official [V8 compilation-pipeline documentation](https://v8.dev/docs/wasm-compilation-pipeline)
describes lazy baseline compilation and background optimization of hot
functions. It documents a baseline-only experimental configuration. Such a
configuration could avoid optimizing-compiler intermediate representations;
that is an inference, not a measured cause or guaranteed saving in this game.

Current official [V8 flag definitions](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/flags/flag-definitions.h)
(reported source blob `4e616c82d0a3e871704ac6fa493bcd024ec6c40d`)
define `liftoff_only` to enable Liftoff and disable both Wasm tier-up modes.
The installed Chrome reports V8 15.4.80.20; the exact matching public source
tag was unavailable. The current source is therefore not claimed as an exact
installed-version pin. Unknown-flag diagnostics must reject the candidate.

Prepare an explicit, allowlisted isolated QA mode using one Chrome argument:
`--js-flags=--liftoff-only --wasm-lazy-compilation`. Record it alongside the
browser identity, actual pre-spawn resources and unchanged package hashes.
This alters compilation strategy only; it does not enable JSPI, replace legacy
exceptions, modify source/asset bytes, relax browser isolation or change the
product's default configuration. Execution may be slower, and native clock/
render/RNG coupling remains an independent unverified completion requirement.

After source/syntax checks and package-audit completion, start this **one**
candidate only if the fresh 7/9 GiB gate passes. Desktop creation, gameplay
input and native save/resume come first; mobile emulation follows. On a cap,
floor or engine failure, preserve exact stage/evidence and stop. Do not raise
limits or automatically start another profile. Continue low-load source work
while waiting for resources; elapsed time does not authorize a weaker gate.

## Source-stage clarification

The immutable early reports describe data loading, but subsequent pinned source
review locates custom-world selection before game setup. `main_menu.cpp:1003`
calls `pick_world` before `g->setup` at line1015; a fresh custom choice reaches
`worldfactory.cpp` world-generation UI first. Without a captured native stack or
completed world UI screenshot, the allocation cannot be assigned to game-data
loading, a particular compiler pass, ImGui, fonts or textures. Current status
therefore records native custom-world Enter work with cause unverified.

Startup already calls `g->load_core_data` before the visible main menu
(`main_menu.cpp:532`). The distinction above concerns later game/world setup;
it does not assert that startup loaded no data. No native failure stack exists.
