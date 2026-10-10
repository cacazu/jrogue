# Bounded source-pinned consumer window

The explicitly released window completed: seven genuine literal-catalog
Rust tests, five genuine plural-term Rust tests, and the standalone wasm32
C++ selector fixture all passed. Exact arguments, environment overrides,
PID/creation-time identities, counters, stdout/stderr and cleanup are in
`execution/`; `consumer-results.json` is the compact verified result.
`consumer-build-plan.json` remains the original pre-execution plan.

The native Cargo stages took 25.914 and 24.672 seconds, with Windows-job
private-memory peaks of 296,656,896 and 297,185,280 bytes. The fixture compiled
in 2.309 seconds at 75,173,888 bytes and ran in 0.296 seconds at 38,531,072
bytes. All stages ended with zero owned job members. Estimates are superseded
by these measured values; future cache/tool changes can alter them.

Both standalone locks were prepared from the verified root lock and accepted
by actual Cargo `--offline --locked`. All 13 registry archives match their
lock checksums. `dependency-source-audit.json` independently compared all
595 regular archive files (6,110,443 bytes) with the existing unpacked source
cache without extraction, installation or cache writes. The existing path
crates and catalog/source/lock bytes were pinned before and after execution.

The exact compiler/test arguments are documented in the plan, rather than
run directly without the guard. The released run used:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' semantic-runtime-catalog/run-consumer-window.py --parent-released-window
```

Cargo uses the installed GNU 1.98.1 toolchain and self-contained native
linker, `--offline --locked --jobs 1`, explicit native target, isolated
targets, `--test catalog` / `--test plural`, and `--test-threads=1`. Codegen
units are 1, debug information and incremental compilation are disabled,
and inherited wrappers/flags are cleared. Registry versions do not resolve
or download during the run. The SDK fixture uses installed Python/emcc,
`-std=c++17 -O0 -g0 -ffp-contract=off -fexceptions -Wall -Wextra -Werror`,
Node-only runtime, assertions enabled, one SDK/Binaryen worker, and the owned
config with `FROZEN_CACHE = True`. Verbose compiler/linker logs pin selected
frozen archives and wasm32 Clang 24.0.0git.

The initial sandbox blocked clang spawning with permission denied before
compilation. Its failed attempt is retained. Parent-authorized scoped SDK
escalation retried only the two native stages under the same guard:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' semantic-runtime-catalog/run-consumer-window.py --parent-released-window --start-stage native-cpp-selector-fixture-build --attempt-name native-retry
```

No ACL, security or global SDK changes were made. Future compiler runs need
a new parent reservation; the command-line release flag alone is not new
authorization. Each stage recaptures at least 4 GiB physical and 6 GiB exact
commit headroom immediately before launch. Exact Windows performance commit
pages provide the commit limit minus committed total, rather than an
available-pagefile approximation. Each root starts suspended, is pinned by
PID/creation time, enters a fresh owned Windows job, then resumes. That job
enforces a 1 GiB hard private-memory limit; the monitor also requires a
1 GiB summed working-set cap and 2 GiB physical/commit running floors. Stage
timeout is 180 seconds. Membership and identity, not process names, govern
any teardown. No unrelated process or existing source/cache is stopped or
removed.

The reviewed changes strengthened unique-ID/partition coverage, source-form
comparisons, malformed typed operands, contextual native conversions,
non-liquid/variant and extreme unsigned quantities, caller-route fixtures
and assertion-enabled builds. Source inspection found no API compile errors;
the actual successful builds now establish that result.

These results establish real Rust catalog consumption for two independent
prepared subsets. The C++ functions remain source-mirrored standalone
fixtures. Original engine producer identity, live selector freezing, FFI,
dynamic name assembly, fallback, browser flows and whole-game render/RNG
purity remain open. No live semantic migration or whole-game completion flag
is inferred from these passes.
