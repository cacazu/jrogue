# Cataclysm: DDA damage domain milestone

This is a tested, bounded Rust migration of the actual stable 0.I damage arithmetic
at upstream commit `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`.
It is a rules library, not a playable Cataclysm port. There is no replacement
miniature game, UI loop, or unrelated simulation in this deliverable.

**Supplementary verification research only.** The user's confirmed architecture
preserves the original-language C++ gameplay core, with Rust owning presentation,
input and platform adapters. The original C++ core remains authoritative; this
completed comparison library does not replace or integrate into the active core.

The crate has no third-party dependencies or unsafe code. Its Rust domain owns
typed damage IDs, ordered damage components, resistance state and deterministic
rules. It has no renderer, browser API, clock, or random-number generator. The
`damage-vectors` executable and `tools` directory are verification adapters only.

| Migrated behavior | Exact upstream provenance |
|---|---|
| Unit defaults and numeric field layout | `src/damage.h:109-138` |
| Unit compatibility equality | `src/damage.cpp:294-303` |
| Add/merge damage units and instances | `src/damage.cpp:479-514` |
| Global pre/post armor scaling | `src/damage.cpp:318-333` |
| Type-specific scaling | `src/damage.cpp:335-342` |
| Type damage, penetration, total damage sums | `src/damage.cpp:344-374` |
| Clear and empty queries | `src/damage.cpp:469-477` |
| Unit amount scaling | `src/damage.cpp:541-545` |
| Unit and instance relative modifiers | `src/damage.cpp:586-629` |
| Instance compatibility equality | `src/damage.cpp:536-539` |
| Resistance set/query and no_resist behavior | `src/damage.cpp:715-723` |
| Effective resistance after penetration/multipliers | `src/damage.cpp:724-728` |
| Resistance compatibility comparison | `src/damage.cpp:730-739` |
| Resistance scaling/division | `src/damage.cpp:741-757` |
| Resistance addition | `src/damage.h:233-239` |
| Single-precision interpolation used by damage merge | `src/cata_utility.h:232-236` |

`PROVENANCE.json` records file SHA-256 values and exact extracted block hashes.
The generated `reference/damage_reference.cpp` contains unchanged original
functions, original struct declarations and the original interpolation template.
Only type registry identity, unused type declarations, millimetre storage and
debug-message capture use transparent fixture scaffolding. The fixture is
compiled by the already-installed official Emscripten SDK and executed in Node.

The differential suite compares native Rust debug and release builds against the
original C++ functions compiled to WebAssembly. It compares every finite value,
infinity and signed zero by f32 bits; NaNs are compared by class because payloads
and sign bits are not portable between native hardware and WebAssembly. It also
compares component order, barrel data, merge diagnostics and compatibility
equality results. Inputs cover ordinary attacks, 128 deterministic generated
sequences, boundary penetration, no_resist, relative modifiers, pre/post armor
scaling, same-type merges, barrel branches, zero multipliers, subnormals,
overflow/underflow and division by zero. `evidence/verification.json` is the
machine-readable result, and all inputs/outputs are retained alongside it.

Verified result: **9 unit tests passed; 6,556 state snapshots across 15,051
commands matched**, with all 6,563 output lines identical between original
C++ WASM, native Rust debug, native Rust release and a repeated release run.
Formatting and Clippy with warnings denied passed. Toolchains were Rust 1.98.1,
Emscripten 6.0.8 and Node 24.19.0. The WebAssembly fixture SHA-256 is
`a156e7655daabacc3c0205071e133b74040bc377b29916378f8b3234b060cf63`.

Upstream quirks are preserved deliberately:

- Merge interpolation uses the added **damage** multiplier as its destination.
- Unit equality compares unconditional damage multiplier to the other unit's
  unconditional armor multiplier, and does not inspect barrels.
- Resistance comparison accepts a matching subset of the left-hand values.
- Relative unit addition does not add unconditional armor multiplier.
- Unsupported barrel merge logging is exposed as a typed diagnostic without
  adding a presentation dependency.
- A nonpositive global multiplier clears the attack; a type multiplier does not.
- C++ `std::max` behavior retains first-argument NaN and negative zero.

Compatibility equality lives in `legacy_equal` / `legacy_contains_equal`.
Rust `PartialEq` compares the stored structures. The named compatibility methods
are used when researching the behavior of upstream operators; this research
does not authorize replacing those operators in the preserved C++ gameplay core.
The registry is passed explicitly. This milestone does not validate complete
upstream data IDs or replace the upstream generic factory.

Remaining functionality is explicit: applying armor coverage/material/item rolls;
body-part and creature damage/HP; hit/dodge/block/critical rolls; melee/ranged
attack workflows; damage over time; effect-on-condition callbacks; data loaders,
inheritance and proportional JSON modifiers; barrel-length interpolation;
monster/item constructors; dealt-damage aggregation; skills; calendar; RNG and
complete RNG snapshots; world state and saves; commands/events integration;
text/localization; rendering/input/storage/audio; browser game flows and hosting.
Those systems remain in pristine upstream. Under the confirmed architecture,
their C++ implementation stays authoritative and requires the real engine build
and Rust browser/presentation/input/platform integration. This supplementary
crate is not an implementation of those outstanding game or browser flows.

The source files `skill.cpp`, `rng.cpp` and `calendar.cpp` were inspected to select
this coherent milestone; their mechanics are not counted as migrated.

Reproduce on this Windows executor from this directory:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' .\tools\build_reference.py --upstream 'C:\Users\kit\gameme\jnethack\jrouge\cataclysm-dda\upstream\Cataclysm-DDA-7b2efa5cea38e4d4d97dd0e63b28b9148623da59' --emsdk 'C:\Users\kit\emsdk'
& 'C:\Users\kit\.cargo\bin\cargo.exe' fmt
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' .\tools\verify_differential.py --node 'C:\Program Files\nodejs\node.exe' --cargo 'C:\Users\kit\.cargo\bin\cargo.exe'
```

The Emscripten cache stays under `build/emcache`; it never shares another agent's
cache. All builds use installed toolchains and cached dependencies (there are
none), with no installers or dependency downloads. Attribution and CC BY-SA 3.0
terms are in `NOTICE.md` and the exact upstream `LICENSE.txt`.
