# Third-party notices for the DCSS migration

The pristine upstream checkout is Dungeon Crawl Stone Soup 0.34.1,
commit `1eebc1a2892e1c89776a0d7a10691f8dac8d9796` from
<https://github.com/crawl/crawl>. Copyright 1997-2025 Linley Henzell, the
development team and contributors; see `upstream/crawl-ref/CREDITS.txt`.
DCSS source is GPL-2.0-or-later with the component exceptions documented in
`upstream/LICENSE`. The new Rust boundary is distributed under GPL-3.0-or-later.
The original license notices and unmodified source remain in `upstream/`.

## PCG initialization and output

The Rust translation in `port/src/logic/rng.rs` derives from the exact pinned
`crawl-ref/source/pcg.cc` implementation. DCSS's constructor and 32-bit output
derive from Melissa O'Neill's minimal PCG implementation:

- Copyright (c) 2014 Melissa O'Neill <oneill@pcg-random.org>.
- Apache License, Version 2.0; complete text: `licenses/Apache-2.0.txt`.
- Original source: <https://github.com/imneme/pcg-c-basic/blob/master/pcg_basic.c>.
- License acquired from
  <https://raw.githubusercontent.com/imneme/pcg-c-basic/master/LICENSE.txt>.
- Acquired license SHA-256:
  `b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1`.

The translated Rust uses explicit wrapping arithmetic and a rotate operation;
these changes preserve DCSS's unsigned arithmetic and output. It passes random
state explicitly instead of accessing a process-global active generator.

## Bounded PCG sampling

DCSS's bounded sampling derives from an implementation by Melissa E. O'Neill
of Daniel Lemire's multiplication and rejection algorithm:

- Copyright (c) 2018 Melissa E. O'Neill.
- MIT License; copyright and complete permission/warranty text:
  `licenses/PCG-MIT.txt`.
- Original source and license header:
  <https://github.com/imneme/bounded-rands/blob/master/bounded32.cpp>.
- License header acquired from
  <https://raw.githubusercontent.com/imneme/bounded-rands/master/bounded32.cpp>.
- Extracted license SHA-256:
  `a3aeba829b87ebca561c9c6357c56e2352d95ec1a0427644617b97a328fc1a76`.

The reference harness copies selected official DCSS function bodies without
modifying their algorithms. It changes their build dependencies to standalone
standard-library definitions for differential testing. Its generated source
retains the original PCG copyright and license notice. Provenance and input
file hashes are included in `tests/reference_rng.json`.

## Scope of this notice

These notices cover the migrated random and dice helpers and their test
reference. Bundled upstream artwork and other dependencies retain their own
licenses and require the separate release inventory before distribution.

## Additional distribution and runtime notices — 2026-10-02

The following receipts extend the original RNG-focused scope above. They cover
the current locked Rust boundary and installed standard-runtime sources used
for the separate C++ engine and Rust WASM artifacts. They preserve third-party
terms; they do not replace individual upstream copyright notices.

The combined derivative distribution uses **GPL-3.0-or-later**. The original
DCSS core remains identified as GPL-2.0-or-later, which permits selecting version
3 for this distribution. Its original notices remain intact. GNU documents
Apache-2.0 compatibility with GPLv3 in its
[license list](https://www.gnu.org/licenses/license-list.en.html#apache2).
The complete, unmodified GPLv3 text is `licenses/GPL-3.0.txt`, downloaded as data
from [GNU](https://www.gnu.org/licenses/gpl-3.0.txt), SHA-256
`3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`.

### Locked Rust dependencies

Exact versions and crate archive checksums come from `port/Cargo.lock`; the
installed archive checksum was checked against the lock for all 11 packages.
Verbatim package notices are under `licenses/rust/crates/<name>-<version>/`.

| Scope | Exact locked packages | Declared terms |
|---|---|---|
| Runtime-capable WASM serialization/formatting dependencies | serde 1.0.229; serde_core 1.0.229; serde_json 1.0.151; itoa 1.0.18 | MIT OR Apache-2.0 |
| Runtime-capable byte search | memchr 2.8.3 | Unlicense OR MIT; MIT is available for this distribution |
| Runtime-capable floating-point formatting | zmij 1.0.23 | MIT |
| Compile-only derive/procedural-macro dependencies | serde_derive 1.0.229; proc-macro2 1.0.107; quote 1.0.47; syn 3.0.6 | MIT OR Apache-2.0 |
| Compile-only Unicode identifier data used by procedural macros | unicode-ident 1.0.26 | (MIT OR Apache-2.0) AND Unicode-3.0 |

Runtime-capable identifies dependency-graph scope; it does not assert that every
package symbol survives optimization. Macro crates execute during compilation,
and their crate libraries are not browser runtime dependencies in this build.
Their notices are retained for the reproducible source/build package.

Rust is installed as 1.98.1, commit
`48a229ceaefd4985c50990b14116b6d856af0985`, GNU Windows host, with the boundary
targeting `wasm32-unknown-unknown`. The installed standard-library-specific
copyright report is preserved verbatim as `licenses/rust/COPYRIGHT-library.html`;
its named license support texts are in `licenses/rust/licenses/`. This report
covers additional library components/targets as well as the selected WASM
target. The compiler-wide 15 MB report and compiler binaries are not included.

### Installed Emscripten standard runtime

The engine targets `wasm32-emscripten` with installed Emscripten **6.0.8**.
The [official Emscripten license documentation](https://emscripten.org/docs/introducing_emscripten/emscripten_license.html)
describes the project's MIT/NCSA terms and separate bundled-runtime notices.
Receipts here come from the installed 6.0.8 sources, rather than the current
development documentation's version.

| Component | Preserved receipt under `licenses/emscripten/` |
|---|---|
| Emscripten generated JS/runtime support, including the Node path-code notice | `LICENSE.txt`, `AUTHORS.txt` |
| musl C runtime, aggregate MIT terms and subsidiary origins | `musl-COPYRIGHT.txt` |
| Portable musl math/regex/other subsidiary copyright and permission comments | `musl-PORTABLE-SOURCE-NOTICES.txt` |
| LLVM C++ standard library and historical notices | `libcxx-LICENSE.txt`, `libcxx-CREDITS.txt` |
| LLVM C++ ABI/exception support and historical notices | `libcxxabi-LICENSE.txt`, `libcxxabi-CREDITS.txt` |
| LLVM compiler runtime builtins/support | `compiler-rt-LICENSE.txt`, `compiler-rt-CREDITS.txt` |
| LLVM unwind support, conservatively retained for exception configurations | `libunwind-LICENSE.txt` |
| LLVM libc replacement functions, conservatively retained for target/configuration variants | `llvm-libc-LICENSE.txt` |
| SDK default dlmalloc allocator, public-domain/CC0 provenance | `dlmalloc-NOTICES.txt` |

LLVM component receipts retain Apache-2.0 with LLVM exceptions and their
historical terms. The musl aggregate explicitly refers to individual math and
regex notices; portable-source notice comments are retained separately for that
reason. No linked-symbol membership map is claimed for the conservative musl,
libunwind or LLVM libc receipts.

`licenses/runtime-packaging.json` records each copied receipt's exact source,
scope, byte count and SHA-256, package expressions/checksums, installed SDK
versions and any missing receipts. `tools/package-runtime-notices.mjs` reproduces
this text-only package from the existing installations. Changes to Cargo.lock,
toolchain versions or build options require refreshing it.

This package copies no SDK/compiler binaries, installers, external fonts,
artwork, audio, optional SDL/media codecs or unrelated example assets. Native
build tools such as Python, Perl and PyYAML are compile-only tooling; installing
or shipping those executables is outside this notice package. The existing
upstream license receipts and attribution/source-availability obligations
remain applicable to the official core and its linked Lua/SQLite/zlib sources.

## Native-Wasm-EH and font-free active package — 2026-10-02

The complete engine now uses JSPI with native WebAssembly exceptions. The SDK
selects libc++abi's native exception storage/personality and libunwind's
`Unwind-wasm.c`; the existing LLVM copyright, Apache-2.0/LLVM-exception and
historical receipts remain preserved. This configuration added no newly
identified license family. `licenses/runtime-verification.json` records 44
verified receipts, 1,899,267 bytes, no missing receipt and no installed-source
mismatch. Receipt coverage is not a final optimized-symbol membership map.

The currently installed 1,448-file console payload contains no graphics,
audio, font or PDF assets. It retains all 143 official vault files, Markdown
and text help, and credits. It omits only the 80,328-byte printable
`docs/quickstart.pdf`, SHA-256
`07d56a1cd908293a6f556aa2898d616699c035ee2cca6891b75168fa1fba76ab`.
That PDF remains intact in pristine source and the original/legacy
1,449-file artifacts. Those legacy data artifacts embed six font subsets;
the no-font statement applies only to the new 1,448-file payload. Five URW
subsets contain an embedding exception. Permission for the CMSY10 subset was
not recovered from its embedded header; no proprietary status is asserted.
Supported native help reads `quickstart.txt`, which is retained unchanged.

The exact audit and first omission/package records are
`licenses/console-pdf-audit.json` and
`licenses/console-payload-omission.json`. The current native weapon-prompt
candidate has its own `licenses/console-startup-payload-omission.json` and
matching incremental source/formatter/bridge receipts. Repository-contained
data reproduction steps are in
[CONSOLE-PACKAGING.md](docs/CONSOLE-PACKAGING.md). Each data-only operation
preserves its selected candidate's WASM; the preceding one-unit semantic
source change has a new WASM hash. New JS/WASM/data combinations require their
own runtime evidence; original baseline results are not silently reused.
The current font-free native-prompt output has separate actual Node smoke/resume,
18-check ordinary-Chrome and 17 paired/cross-locale observation receipts.
Original quickstart text/help and its copyright notice remain intact; its
physical-key browser help route is verified on this exact data package.

The complete local `dcss` folder retains pristine upstream, modified work
source/patch scripts, Rust, browser source, build/package steps and notices.
Any future binary distribution must provide the matching modified
corresponding source and applicable notices. An upstream-only link does not
provide the source for this derivative. The current localhost server does
not expose the whole source/license tree, and no external hosted Site or
source-download endpoint has been created. Local execution and a passing
catalog slice do not establish complete Japanese migration.
