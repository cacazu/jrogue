# Engine verification status

Pinned upstream: DCSS 0.34.1,
`1eebc1a2892e1c89776a0d7a10691f8dac8d9796`.

The complete 333-unit console core has compiled and linked to Emscripten 6.0.8.
The current usable bundle starts a seeded official game, advances official
commands, and preserves all 45 persistent PCG streams during 25 cached redraws.
The complete official data pack contains all 143 vault source files.

The first save-resume check exposed an incomplete platform checkpoint: native
`save_game(false)` does not save the current level on non-Android builds. The
bridge now saves Lua persistence and the current level before the player chunks.
Readiness checks exclude startup, level entry, and dead players. These changes
are pending rebuilt runtime validation; the previous resume evidence records a
failure and must not be presented as a pass.

The pending build also restores upstream's default `-DWIZARD` configuration,
including wizard and explore modes, and adds exact UTF-8 combining sequences
alongside scalar-zero wide-character continuation markers. Its flag/header/source
content cache has 272 of 333 units retained. The build is paused under the parent
coordinator's memory hold. No new compiler, linker, or game instance is running.

After the shared build slot is released, finish the remaining cached compilation,
link the pending source, rerun `engine-smoke.cjs`, and run `engine-resume.cjs`.
The resume test uses sequential processes and excludes regenerable descriptions
and vault caches from player transport. It compares player fields and exact PCG
state/sequence values, then three further official turns; unsaved diagnostic draw
counts are compared only within a running instance.

This is an engine integration milestone. English console output remains a
development surface until complete semantic text catalogs and Japanese
presentation are integrated and verified by the parent task. No publication
readiness or complete Japanese port is asserted here.
