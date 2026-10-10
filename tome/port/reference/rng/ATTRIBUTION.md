# ToME SFMT domain migration

This module translates the scalar little-endian SFMT19937 implementation in the
official **T-Engine 4 1.7.6** source archive into safe Rust. It preserves the seed
initialization, period certification, 128-bit recurrence, word cursor, real1
conversion, and mask/rejection bounded draws. It is a bounded migration module,
not a claim that the ToME engine or gameplay has been fully ported.

Upstream reference paths:

- `src/SFMT.c`: scalar recurrence, seed initialization, `gen_rand32`, `rand_div`.
- `src/SFMT.h`: `genrand_real1` and `genrand_real` conversions.
- `src/SFMT-params.h` and `src/SFMT-params19937.h`: exponent and parameters.
- `src/core_lua.c:3637`: Lua RNG wrappers; `rng_range` at 3659,
  `rng_normal` at 3814, and normal-distribution table at 3755.

SFMT source headers credit **Mutsuo Saito, Makoto Matsumoto and Hiroshima
University**, copyright 2006, 2007, and explicitly apply the **new BSD license**.
`SFMT-LICENSE.txt` retains the full BSD license obtained from the SFMT maintainers'
official repository at
<https://raw.githubusercontent.com/MersenneTwister-Lab/SFMT/master/LICENSE.txt>.
That current license also retains the maintainers' 2012 credits; the T-Engine
source headers themselves carry the 2006/2007 credits.

The Lua wrappers and normal-distribution table are derived from
`src/core_lua.c`, copyright **2009–2018 Nicolas Casalini**, distributed under
**GPL version 3 or later**. The combined Rust module and reference wrapper driver
are distributed under **GPL-3.0-or-later**, retaining the SFMT BSD notices.
The integrating project must distribute GPL license text and corresponding
source under its existing source-availability arrangement.

The test harness includes the untouched upstream `SFMT.c` at compile time.
`normal_table.h` is extracted directly from upstream, with only the dimension
macro expanded to 256. `verify.ps1` builds it with the installed official
Emscripten SDK and runs that WebAssembly program through the SDK's Node runtime.
No upstream file is changed, and no native game executable is launched.

## Deliberate scope boundaries

- `init_by_array`, bulk fill operations, and 64-bit SFMT outputs are not migrated
  by this first module. The ToME Lua wrappers use `init_gen_rand`/`gen_rand32`.
- `rng.normalFloat` is not migrated here. Its upstream process-global cached
  Box–Muller spare and platform-dependent transcendental math require an
  explicit state design and cross-target differential tests before use.
- Negative `rng.seed` uses wall-clock time upstream; callers must obtain any
  entropy in the platform layer and pass an explicit seed into domain state.
- Safe Rust rejects integer intervals and arithmetic outside upstream's defined
  signed C domain. `dice` rejects negative sides; `average` requires ordered
  bounds and a positive count. These cases must remain explicit application
  errors rather than silently inventing new RNG mechanics.
- `percent` receives a signed integer, matching upstream's Lua-to-C coercion,
  and **always consumes a draw**, including percentages at or beyond 0/100.
  Equal `range` bounds, nonpositive integer-normal deviation, and bounds 0/1
  consume no draw. `float` coerces input bounds to f32 before its f64 output.

## Integration

Copy `rng.rs` into the logic crate and put `fixtures/sfmt19937-reference.json`
in a `fixtures` directory beside it, preserving the relative test include.
The logic crate requires serde with derive; tests require serde_json. Domain
state owns one `Sfmt19937`, while presentation receives only immutable state.
Serialized algorithm version 1 stores 156 four-word blocks and the cursor;
load rejects unknown versions, bad lengths/cursors, all-zero state, and extra
fields. This is a new port save schema, not a decoder for upstream saves.

## Verification

Six reference seeds cover 2,000 raw words each (including refill boundaries
624, 1248 and 1872), 1,300 bitwise-real1 conversions, 1,000 bounded draws,
1,000 reversed/equal/negative range cases, and 1,000 integer-normal cases.
Another 300 mixed wrapper iterations per seed verify call/chance/percent/
float/dice/average output and stream consumption. Save/resume tests straddle
refill boundaries and compare a further 1,300 words after each restored cursor.
Run `verify.ps1` to regenerate the fixtures from the pristine source and run
the offline Rust tests. Source/fixture hashes and actual results are recorded
in `verification.json` once the check has completed successfully.
