# Original C++ RNG platform state adapter

This is a bounded integration milestone for Cataclysm: DDA **0.I-1** at commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. The original C++ core remains
authoritative. This platform hook does not implement a replacement game,
Rust gameplay rules, world serialization, a renderer or browser game loop.

`overlay/src/rng.cpp` retains the **entire original translation unit**. Only six
function-local static distribution declarations become references to the same
default-constructed distribution types in `cdda_rng_distribution_registry`.
The engine remains upstream's function-local `std::minstd_rand0`. Every original
algorithm, parameter object, early return, seeding behavior, helper and draw call
is retained in its original order. `tools/generate.py` hashes the pristine inputs
and proves reversing those six declarations and one added include reproduces
the complete original source after normalizing line endings.

The six original declaration lines are `src/rng.cpp:16`, `22`, `31`, `82`, `88`
and `95`. Exact input/overlay/function hashes and original function line ranges
are in `PROVENANCE.json`; `storage-only.patch` exposes the complete change.

The C byte API in `overlay/src/rng_snapshot.h` captures `rng_get_engine()` and
all six distributions through the actual C++ stream operators. It includes
normal distribution's cached second sample. The inspected installed libc++
22.1.8 chi-square implementation creates a temporary gamma distribution per
draw; it has no persistent hidden gamma/normal cache. All six distribution
states are still required sections. Other standard libraries may implement
different algorithms/caches and are deliberately rejected by this serializer.

Restore parses into temporary engine/distribution objects and verifies the
format, source commit and source hash, full compiler/library ABI, all seven
ordered nonempty length-delimited fields, complete input consumption, canonical
stream encoding, engine range and the original default stored parameters.
Only after every check succeeds are the global engine and registry assigned;
both assignments are statically required to be nonthrowing. Malformed late
fields cannot leave an earlier parsed engine partially restored. Stream or
allocation exceptions become an error status across the C interface.

Use this API on the sole game thread at a quiescent completed-command boundary.
The original global RNG is not thread safe. Application initialization must
establish the original engine before presentation/capture calls; a nonzero
explicit seed gives reproducible new-game runs. Calling `rng_get_engine()` for
the first time retains upstream's clock-based initialization. The immutable
startup seed helper is only used to initialize the engine in this source version;
it is not a mutable draw state. Seed zero remains upstream's no-op, and reseeding
does **not** reset the normal distribution cache.

Capture is read-only once core initialization has occurred: it never invokes an
engine or distribution draw. Query size with `output=NULL, capacity=0`; status
`CDDA_RNG_BUFFER_TOO_SMALL` returns the required byte count. Allocate that many
bytes and capture again. Short output buffers are untouched. The `required`
pointer must be separate from output storage. Byte count excludes a terminator.
The complete opaque capsule is passed to one restore call, rather than restoring
individual pieces. The outer Rust platform contract uses `RngSnapshot.capsule_bytes`
and binds `EngineIdentity.rng_serializer_abi` to the exact string returned by
`cdda_rng_snapshot_abi()`. The outer save checksum supplies corruption detection;
the capsule itself supplies structural/compatibility validation.

The stream format starts with `CDDA-RNG-STREAM/1`, followed by source and ABI
lines, `fields 7`, then `name byte-count\nstate-bytes\n` for `engine`,
`uniform_unsigned`, `uniform_integer`, `uniform_real`, `normal`, `exponential`
and `chi_squared`, and a final `end\n`. Maximum input is 65,536 bytes and each
state section is at most 4,096 bytes. Unknown, duplicate, reordered, missing or
extra sections are rejected. Current serializer support is the tested
Emscripten libc++ **22.1.8** target. ABI stamps include Emscripten and Clang
versions, libc++ version/ABI, language version, type sizes, floating precision,
byte order and faithful floating point flags. C++ stream/distribution formats
and sequences are implementation specific. Saves from native libstdc++, MSVC,
another libc++ version/compiler or incompatible build must fail clearly instead
of silently approximating their random state.

Build every RNG translation unit with `-ffp-contract=off`, without fast math, and
define `CDDA_RNG_BUILD_FP_CONTRACT_OFF=1`. The snapshot translation unit also
requires `-fexceptions`; for a complete build use one compatible exception mode
consistently. Export the four C symbols when integrating into an Emscripten module.
Do not link both pristine and overlaid `rng.cpp`. In an isolated engine checkout,
apply `storage-only.patch` and add the three `rng_snapshot*` files to `src/` and
`rng_snapshot.cpp` to the build inputs. Do not change the pristine acquisition.

The verification suite compiles the complete original `rng.cpp` and the complete
overlay separately, with transparent fixture headers for unrelated dependencies.
It compares exact integer values and double bits across seeds, reversed/full
bounds, uniform/normal/exponential/chi-square draws, cached normal samples,
helpers, local seeded sequences, strings, nonfinite error paths and reseeding.
The adapted sequence deliberately perturbs all draws and reseeds between each
saved continuation, then restores its capsule. Separate tests detect the failure
of engine-only restoration, compare saved continuations, repeat render-like
captures and verify failed input leaves the engine and cache unchanged.

Reproduce with installed trusted tools, one compile job, and the complete
installed standard-library cache in **read-only frozen mode**:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' .\tools\build_verify.py --upstream 'C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\upstream\Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59' --emsdk 'C:\Users\kit\emsdk' --cache 'C:\Users\kit\emsdk\upstream\emscripten\cache' --frozen-cache --node 'C:\Program Files\nodejs\node.exe'
```

`FROZEN_CACHE=True` in task-local config skips cache sanity writes and rejects
missing cache files/writes. No SDK/global config changes, installers or dependency
downloads occur. For an incomplete writable task cache, `EMCC_BATCH_BUILD=0`
avoids Emscripten's oversized Windows batching while `EMCC_CORES=1` keeps one
active compiler. An initial attempt exposed WinError 206 during standard-library
regeneration; the verified frozen installed-cache route avoids it entirely.

Verified: **24,014 output lines** agree exactly across original/adapted `-O0`
and `-O2` and the repeated adapted run. In each optimization mode, **90 restores
reproduce 46,080 continuation values; 2,880 capture pairs consume no RNG;
643 invalid restores leave all state unchanged**. Allocation-fault tests reject
all **16 capture** and **33 restore** failure positions before reaching success;
the ABI/max-size query succeeds even when every allocation is forced to fail.
Warnings are denied for the bounded fixture suite. A separate read-only code
review verified bounds, cache coverage, no-throw FFI and transactional commits.

`evidence/verification.json` contains actual tool identities, compiler commands,
suite counts, exact output and WASM hashes. Text traces and a sample hot-cache
capsule are retained alongside it. Original and adapted `-O0` and `-O2` output
must agree; the adapted `-O0` run is repeated for deterministic verification.
`build/` contains generated fixtures/binaries/config only and is excluded from
source delivery.

`tools/compile_actual_headers.py` additionally compiles both RNG overlay units
against the actual pristine game headers and engine-generated configuration,
without any fixture includes; `evidence/actual-headers.json` records that check.
The unchanged game headers have unused static templates in `enum_traits.h`,
so only that warning category is suppressed for this real-header check.

Remaining integration: wire the
real C++ engine command-complete/save boundaries to Rust/browser FFI, restore
the matching original world save and RNG capsule together, and test full browser
save/resume/render/input flows. This adapter is not a claim that those complete
game or publication milestones have been delivered. See `NOTICE.md` for source
attribution and license obligations.
