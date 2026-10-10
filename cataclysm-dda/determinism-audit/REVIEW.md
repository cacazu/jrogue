# Independent source review

Reviewed `README.md` and `FINDINGS.json` against the retained pristine
Cataclysm: DDA 0.I-1 sources at commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`.

The original 86 cited references independently passed exact SHA-256 and
range-anchor checks across 34 source files. The four subsequently added
option/timeout references also passed those checks. No build, browser,
standard-library-internal review, large scan, engine mutation or Git operation
was performed. This review does not establish full-game determinism.

## Verified focused claims

- `distribution.cpp:43-111,137-205` owns uniform, binomial and Poisson
  distributions in shared content objects. `overmap.cpp:1900,2054-2057` owns
  and samples one. The audit correctly leaves persistent stochastic cache
  coverage unverified; this source alone proves neither a cache nor
  statelessness in the installed libc++ implementation.
- `weather_gen.cpp:162-179` consumes global RNG and maintains the separate
  static `current_winddir`. `overmap_ui.cpp:238-256` invokes it on weather-cache
  misses. `savegame.cpp:1593-1626` saves the manager's direction but does not
  serialize or restore that generator static. `weather.cpp:921` can choose a
  direction override instead, and `weather.cpp:560-592` makes forecast calls
  that leave the generator's wind history changed. A saved manager direction
  is therefore not a proven replacement.
- `options.cpp:1639-1642` and `options.h:276-281` establish the source default
  `TURN_DURATION=0`, range 0 through 10 and step 0.05. At zero,
  `handle_action.cpp:214-215` returns zero elapsed move cost and the ordinary
  input loop does not end merely because of a realtime turn timeout. Above
  0.005, elapsed time affects move cost and can end that loop. The actual
  `ACTION_TIMEOUT` case at `handle_action.cpp:2312-2316` pauses the player only
  when `check_safe_mode_allowed(false)` succeeds. This is an enabled option,
  subject to native Safe Mode rules; no current browser profile was inspected.
- Autosave source defaults are enabled, 50 simulation turns and five real
  minutes (`options.cpp:1649-1666`). Native triggering uses a calendar cadence
  plus the realtime minimum (`do_turn.cpp:533-537`, `game.cpp:13528-13534`),
  with `quicksave` also skipping a save if its move counter is zero
  (`game.cpp:13479-13483`). Save events occur before the file-writing success
  check, and load can consume RNG and activate native logic. The audit's
  conditional event-EOC wording is appropriately bounded by its excluded
  data/mod scope.
- With the sound backend disabled, the no-op stub at `sounds.cpp:2005-2007`
  does not suppress evaluation of `weather.cpp:417,423-426` arguments.
  `rng.cpp:42-44` confirms that `random_direction()` calls global
  `rng_float`. The weather hearing/message conditions still gate these calls;
  this is not a claim that every turn draws audio RNG. Hearing, clustering
  and uncertain sound-marker locations remain gameplay or information
  mechanics outside the media backend.

## Follow-ups for checkpoint completeness

The reviewed findings contain no contradiction in these focused claims. Three
source details should be explicit before treating the proposed auxiliary state
as complete:

1. The overmap weather cache is static, including its
   `last_weather_display` marker (`overmap_ui.cpp:241-253`). Saving and restoring
   RNG plus `current_winddir` alone does not reproduce whether a subsequent
   same-turn UI query is a hit or miss. Either retain/reconstruct the exact
   cache state, establish a tested canonical checkpoint/invalidation boundary,
   or remove this native side effect through the explicitly reviewed preview
   separation. The existing audit already calls for reviewing cache lifetime;
   this is a concrete checkpoint requirement rather than a proven divergence
   in a tested game run.
2. `weather_generator::get_weather_conditions(const w_point&)` temporarily
   overwrites the manager's `weather_precise` while evaluating content
   conditions, then restores it on normal return
   (`weather_gen.cpp:190-221`). It is another reason to prohibit this helper
   as an observation getter. No exception-path or data-condition purity proof
   was performed here; do not assume the `const` method is read-only.
3. `weather.h:214-217` also owns `weather_precise`, `wind_direction_override`,
   `windspeed_override` and `weather_override`. The inspected weather
   serializer does not include those fields, while update logic reads them
   (`weather.cpp:905-922`). Review their compatible reconstruction or include
   the required authoritative state in the versioned checkpoint. This review
   does not assert that every missing cache must be serialized, or that every
   fresh native load necessarily diverges; the sufficiency of native
   reconstruction remains unverified.

Default timed turns being disabled does not remove the source-confirmed
cosmetic RNG, weather-preview, blocking-activity polling or save-event
dependencies. Full-engine continuation and render-purity gates remain open.

## Final expanded-reference status

The revised audit contains 24 findings and 95 references. Only the five newly
added references were checked in this follow-up: `weather.h:211-223`,
`weather.cpp:901-924`, `weather_gen.cpp:190-222`,
`savegame.cpp:1593-1626` and `handle_action.cpp:2312-2316`. All five passed
independent exact source SHA-256 and range-anchor validation. Combined with
the earlier 90-reference review, all 95 current references have passed those
bounded checks; the earlier checks were not rerun.

The added weather finding and latest README now preserve the distinction
between authoritative state, derived caches and unverified reconstruction.
The default/enabled timed-turn distinction and Safe Mode condition are
accurate. A minor wording refinement was sent to the audit owner: describe the
existing adapter as the "six-helper RNG capsule" in the first executable gate
instead of an unqualified "complete RNG capsule", so its tested scope cannot
be confused with whole-engine random-state completeness.

No broader scan, build, browser run or engine change was performed in this
follow-up. The audit's reported 198 source/categorization checks are its own
curation result; this independent review establishes the 95 source reference
hash/anchor checks and focused source interpretation only. Runtime
continuation and publication remain unverified.
