# Original-engine determinism source audit

This is a lightweight source review of Cataclysm: DDA **0.I-1**, commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. It adds no engine code and runs no
compiler, browser, game, package operation or Git command. The original C++
gameplay remains authoritative. It supplies concrete work for the existing
[RNG adapter](../rng-adapter/README.md) and
[C++/Rust boundary proposal](../docs/CPP-RUST-BOUNDARY-NEXT.md); it does not pass
whole-game determinism, render purity or save/resume gates.

The six-object RNG capsule is necessary but insufficient evidence for those
gates. Additional verified source paths consume gameplay RNG during drawing,
and weather evolution owns a separate static wind-history value that native
save does not serialize. Real elapsed time is also an intentional gameplay
input when the timed-turn option is enabled.

## Reproducible inventory and limits

`scan-source.mjs` reads only the immediate pinned `src/*.cpp`, `*.h`, `*.hpp`
and `*.c` files: **840 files, 21,656,277 bytes**. It masks comments and ordinary,
character and raw string literals while preserving offsets/newlines, then
records matching identifiers with file, exact line/column, source SHA-256,
source line, raw preprocessor context, and whether the translation unit is
listed in the existing browser build manifest. Header inclusion and conditional
compilation are not inferred from that boolean.

The resulting **4,036 lexical occurrences** comprise 2,980 RNG interface
matches, 857 simulation-calendar references, 130 clock-pattern matches, 30
distribution-type matches, 21 standard random algorithms, 14 engine/entropy
type matches and four C/OS-random-pattern matches. These counts include
declarations and overloads, and are **not executed draw counts**. In particular,
the four `rand`/`random` matches are the math parser's `rand` wrapper and
`om_direction::random`; both call the game's RNG. `e.time()` and a member
initializer named `time` are clock-pattern false positives. No actual libc
`rand`/`srand`, OS entropy API or `random_device` was found in this bounded scope.

`curate-findings.mjs` records **24 reviewed findings and 95 source references**,
checks each reference against the scanned original hash and an exact range
anchor, and asserts the current relevant build flags. It also records every
`current_winddir` reference across this scope, which occurs only in
`weather_gen.cpp` and `weather_gen.h`.

The lightweight checks passed **845 lexical checks and 198 source/categorization
checks**. They do not compile C++, evaluate preprocessor branches, resolve an
AST, prove an exhaustive call graph, inspect standard-library internals, or
scan data/mod EOC bindings, third-party/generated sources or tests. They cannot
establish runtime reachability for every retained lexical match. Existing
isolated RNG tests were read, not rerun or broadened by this task.

Deliverables:

* `occurrences.jsonl`: deterministic sorted raw occurrence inventory.
* `SOURCE-MANIFEST.json`: SHA-256/size for every scoped original file.
* `FINDINGS.json`: reviewed classifications, function/line/hash references,
  gate implications and proposed changes; original code is not copied.
* `SCAN-EVIDENCE.json` and `REVIEW-EVIDENCE.json`: actual source-check counts,
  artifact hashes and explicit unverified runtime flags.
* `REVIEW.md`: independent bounded source review; `VERIFY-EVIDENCE.json`:
  actual identical-source regeneration result, tool identity and delivery hashes.

Reproduce with the trusted installed Node tool, from this task's staging root:

```powershell
node .\determinism-audit\scan-source.mjs
node .\determinism-audit\curate-findings.mjs
node .\determinism-audit\verify-audit.mjs
```

Outputs contain no wall-clock values. `verify-audit.mjs` verifies syntax,
regenerates the five source inventory/finding products, requires byte-identical
hashes, and records the installed Node version. The scripts read acquisition/build metadata and
write only this audit directory. They neither apply overlays nor alter the
currently running original-engine link.

## Random-state ownership

| Original source and function | Actual ownership and checkpoint implication |
| --- | --- |
| `rng.cpp:13–38,80–98,201–214`; RNG helpers/`rng_get_engine` | One persistent `minstd_rand0` engine plus six helper distribution objects. The existing storage-only capsule covers these, including normal's cached sample. It is still absent from the active full-engine build. |
| `rng.cpp:162–177`; `rng_sequence` | A local `minstd_rand0` and integer distribution, entirely reconstructed from the argument seed. It is used for vehicle damage ordering at `vehicle.cpp:8153`. It does not need an additional surviving engine in a completed-command capsule. |
| `text_snippets.cpp:260–329`; snippet selection overloads | Two local `mt19937` instances. The unseeded API obtains its seed through global `rng_bits`; the explicit-seed API uses its argument. Retain selected snippet identity/seed and exact target algorithm. These are not independent clock-seeded persistent engines. |
| `distribution.cpp:43–111,137–205`; distribution implementations | Uniform, binomial and Poisson members in shared `int_distribution` objects, outside the six-object registry; `overmap.cpp:1900,2054–2057` owns/samples one through a placement rule. Their possible persistent sample caches require an exact libc++ review/continuation proof before the capsule is declared complete. This audit does **not** assert that a cache exists. |
| `explosion.cpp:415–484`, `field.cpp:81–89`, `weather_gen.cpp:225–245` | Temporary Poisson, exponential and discrete distributions draw directly from the global engine for real shrapnel/decay/wind mechanics. Their local objects die before a completed-command checkpoint. Preserve algorithms and target ABI rather than replacing them with the six helper distributions. |
| Twenty `std::shuffle` sites | All twenty use `rng_get_engine`; the separate twenty-first is audio below. Engine capture covers engine mutation. The exact standard-library algorithm, parameters and source-specific input ordering still matter. No general claim that containers are nondeterministic follows. |
| `sdlsound.cpp:433–460`; `play_music` | A separate persistent clock-seeded playlist engine affects audio. Its `SDL_SOUND` body is inactive in the current browser build. Future audio work needs distinct cosmetic state; this engine is not presently a missing active gameplay RNG field. |

Startup has two clock sources: CLI seed defaults to `time(nullptr)`
(`main.cpp:273`) and lazy engine initialization calls high-resolution clock
(`rng.cpp:194–205`). `main.cpp:779` reseeds with the resolved CLI integer;
`--seed` text is hashed with `djb2_hash` (`main.cpp:292–298`). Zero intentionally
does nothing, and reseeding does not reset the normal cache. Deterministic
startup therefore binds a resolved nonzero seed **and** actual initialized
capsule, initialization order, build/content/options identity. The saved
`game::seed` is a world/weather seed drawn at `start_game` (`game.cpp:902`),
not the current engine state.

## Rendering and input paths that consume gameplay RNG

| Verified source path | Required separation or immutable record |
| --- | --- |
| `game::get_player_input`, `handle_action.cpp:329–440` | Candidate rain coordinates consume global RNG on timed animation iterations. Preserve full input/timeout/viewport traces for the reference. A pure observation must never call this wait function. |
| `cata_tiles::draw_from_id_string_internal`, `cata_tiles.cpp:2881–2883` | WEATHER tiles call global `rng_bits` even before the later multiple-sprite check. Separating rain-coordinate RNG alone leaves this draw in native rendering. Freeze the selected sprite or use explicit cosmetic state. |
| `overmap_ui::draw_ascii`, `overmap_ui.cpp:684–694,729–744` | NPC/follower colors sharing a tile are selected with global `one_in` while overlays blink. Freeze visible color selection or use reviewed cosmetic state. |
| `cata_tiles::draw_om`, `sdltiles.cpp:885–893` | Debug monster-group display chooses a representative with global RNG. This is a compiled feature branch, conditional on the debug overlay; it is not evidence that every ordinary redraw enters it. |
| `scrollingcombattext::add`, `output.cpp:3062–3102` | When `ANIMATION_SCT` is enabled, message-direction cosmetics use global `one_in`. These occur on message addition, not every redraw. `test_mode` skips them, so fixtures using it omit this source consumption. |
| `game::portal_storm_query`, `game.cpp:1651–1688` | A popup color draws globally, while the same function changes activity distraction state. Isolate the color only; keep the actual query/ignore mechanics in the original application flow. |
| Snippet expansion/`parse_tags`/dynamic lines, `text_snippets.cpp:238–329`, `npctalk.cpp:2348–2352,2426–2437,8748` | Text emission may select snippets, punctuation or branches through gameplay RNG. Rust formatting must receive already-selected semantic variant IDs and evaluated parameters. Redraw or language change must not rerun native text selection. |

Cosmetic separation is explicitly user-authorized. It changes the subsequent
native global sequence, so the overlay must record that choice and demonstrate
preserved gameplay rules against a feature-enabled reference. Disabling
animations/SCT or using `test_mode` is useful for a bounded test, not proof of
the complete release behavior.

Two apparent display helpers deserve stronger treatment. On an overmap weather
cache miss, `overmap_ui::get_weather_at_point` (`overmap_ui.cpp:238–256`) calls
`weather_generator::get_weather_conditions(location,time,seed)`
(`weather_gen.cpp:182–187`), which calls `get_weather`. Despite `const`, that
function draws globally for wind power and direction and changes the static
`weather_generator::current_winddir` (`weather_gen.cpp:42,162–179`). Cache hits
skip this work, so UI query order/cache lifetime can change both RNG consumption
and wind history. Do not use these helpers as pure snapshot getters.

Native weather save writes `weather_manager.winddirection`
(`savegame.cpp:1593–1626`), but none of the scoped references persists or
restores `weather_generator.current_winddir`. Restoring the RNG capsule alone
does not demonstrate wind-state continuation. The saved manager direction is
not a demonstrated substitute: direction overrides and forecast calls can
separate it from the static generator value. Add a source-bound, versioned
authoritative auxiliary-state field and restore it after successful native
reconstruction. Review UI preview call sites separately from actual weather
evolution; retain simulation wind rules rather than changing every call to
`get_weather` into cosmetic randomness.

`current_winddir` is a concrete gap, not a complete auxiliary-state census.
`weather_precise`, wind direction/speed overrides and `weather_override`
(`weather.h:214–217`) are absent from the shown native weather serializer;
`update_weather` reads those overrides (`weather.cpp:901–924`). The condition
evaluator temporarily replaces `weather_precise` while evaluating content
conditions, restoring it on normal return (`weather_gen.cpp:190–222`). Review
each field as authoritative history/override or derived cache, then prove its
reconstruction rule; this audit does not require blindly serializing every
cache. The process-static overmap weather cache and its last-turn value also
affect whether a repeated UI query draws after restoring a fresh runtime at
the same calendar turn. Capturing one extra integer alone cannot finish this
coverage review.

Some visual differences do not consume global RNG: tile idle animation phase
uses steady clock (`cata_tiles.cpp:2939–2956`), minimap phase uses SDL ticks
(`pixel_minimap.cpp:68–75`), and monster sprite selection uses a pointer-derived
seed (`cata_tiles.cpp:2887`). The inspected latter affects sprite variants, not
simulation entropy. Initial Rust draw records should freeze phase and resolved
variant; later semantic rendering needs stable visible entity IDs and a
defined hash. Player names remain literal external text.

## Real time, native saves and continuation

`TURN_DURATION` defaults to **0**, with a 0..10 range and 0.05 step
(`options.cpp:1639–1642`, overload signature `options.h:276–281`). This fresh
profile default disables realtime turn progression. The general option and
native `handle_action`/`do_turn` bodies are compiled in this browser build,
without a native-OS-only guard; the source review does not verify a browser
profile's current value. Persisted user settings can enable the option.

`user_turn::moves_elapsed` (`handle_action.cpp:193–220`) turns elapsed real
milliseconds into extra move cost when `TURN_DURATION > 0.005`.
`game::handle_action` subtracts that cost for non-timeout actions
(`handle_action.cpp:3284–3286`); native idle input timeouts also consult its
`has_timeout_elapsed` result (`handle_action.cpp:432–449`).
`ACTION_TIMEOUT` pauses the player only when
`check_safe_mode_allowed(false)` succeeds (`handle_action.cpp:2312–2316`),
so Safe Mode remains part of the behavior to preserve. Blocking-activity
input polling separately uses a
100 ms rate limit (`do_turn.cpp:607–616`). These are actual option/input
mechanics. Preserve them as explicit platform inputs and record/replay the
clock-derived costs/poll decisions. A test with timed turns disabled has a
narrower scope.

Autosave defaults **on, 50 simulation turns, at least 5 real minutes**
(`options.cpp:1649–1666`), with both conditions required. It combines
simulation-turn cadence (`do_turn.cpp:533–537`) with a
wall-clock minimum interval (`game.cpp:13528–13534`). Before writing files,
`game::save` emits `game_save` with elapsed and total real playtime
(`game.cpp:3653–3666`, `event.h:748–753`). These event payloads feed native
stats, and `eoc_events::notify` can activate configured event EOCs
(`effect_on_condition.cpp:526–582`). No data/mod binding was scanned here, so
the audit makes no claim about particular default save/load EOCs. Nonetheless,
the source interface means real playtime cannot automatically be normalized
away as harmless file metadata. Save is not a pure read, and its event occurs
even if a later file write fails.

Native saves persist simulation calendar and many gameplay records
(`savegame.cpp:84–154`), plus the world seed in master JSON
(`savegame.cpp:1557–1582,1695–1719`). There is no global engine/distribution
stream serialization or RNG reseed in those inspected serializers. Native load
can draw when a monster lacks a newly required special-attack cooldown
(`savegame_json.cpp:2556–2563`), then run passives, `game_load`, existing-character
EOCs and cache rebuilding (`game.cpp:3360–3379`). Restore auxiliary state and
the capsule after successful compatible reconstruction, before resumed native
computation. A capsule cannot undo a world mutation from incompatible content
or a load event; use a candidate runtime and a tested coordinated checkpoint.

Sound-source randomness must also be classified by actual behavior. AI sound
clustering, deafening/pain, awakening and uncertain sound-marker placement
(`sounds.cpp:365–394,578–638,728–769`) are retained gameplay/information
mechanics outside `SDL_SOUND`. Do not move all sound RNG to cosmetics. The
disabled backend still evaluates an unguarded `random_direction()` argument
in `weather_sound` (`weather.cpp:409–428`) before entering its no-op stub
(`sounds.cpp:1998–2007`). `SOUND=0` is not proof that all audio-related call sites
draw zero RNG. Future audio work should isolate media-only pitch/playlist/
direction choices while preserving hearing and message rules.

Other inspected timers are categorized narrowly: world timestamp, archive file
time and graveyard naming are metadata; perf/debug clocks are diagnostics;
recipe/pathfinding clocks schedule progress and input cancellation; Android
touch timers and MinGW thread fallback code are separately guarded paths.
Cancellation and progress-driven native redraw side effects still need event
traces when exercised. Normalize only demonstrated platform metadata, retain
simulation calendar/playtime semantics, and do not infer a generic failure from
every clock or unordered container.

## Next executable gates

1. Integrate the existing six-helper RNG capsule and exact serializer ABI into an
   isolated original-engine build. Add ABI-specific proof for persistent
   content-distribution objects and capture authoritative wind-history state.
2. Record actual accepted actions, timeouts, viewport/options, timed-turn costs,
   save triggers and clock-derived event payloads. First compare observer-only
   overlay versus the unmodified engine on identical full traces.
3. Isolate reviewed cosmetic draws with an explicit reference-sequence change.
   Export already-selected dialogue, tile, overmap color, SCT, sound-marker and
   animation records; repeated Rust rendering must not call native simulation,
   input polling, native redraw or text/weather preparation.
4. Coordinate unchanged complete native files, auxiliary state and capsule at
   one guarded save boundary; require actual storage generation commit. Restore
   through a compatible candidate runtime, then compare real continuation for
   world/weather, combat/inventory, hearing, enabled animations/overmap displays,
   timed turns and save/reload, including late failures.

No item above is reported as executed or passed by this audit. Full-game and
publication gates remain open.

The official source is [CleverRaven/Cataclysm-DDA at the pinned commit](https://github.com/CleverRaven/Cataclysm-DDA/tree/7b2efa5cea38e4d4d97dd0e63b28b9148623da59).
The existing acquisition retains the pristine upstream and its license/notices.
This audit contains original explanatory text and short source anchors; it
does not redistribute a modified game or bundled asset package.
