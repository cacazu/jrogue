# Free Pascal portable compiler capability probe

The official Windows snapshot can compile and run an authored Win64 program on this executor. It cannot compile `wasm32-wasip1` as supplied: the ZIP contains only an i386-hosted x86_64 cross compiler and Win64 units. Both WASI target attempts failed with `Illegal parameter: -Twasip1`. A Windows-hosted WASM compiler/bootstrap and WASM RTL remain prerequisites; they have not been built in this bounded probe.

This is compiler capability evidence, not a DRL implementation or game test. The existing DRL sources, Rust input code, system installation, global PATH and security settings were not changed.

## Acquisition and integrity

The [official development page](https://www.freepascal.org/develop.html) links the [official snapshot tree](https://downloads.freepascal.org/fpc/snapshot/trunk/). Its Win64 Windows ZIP was the smaller listed Windows ZIP candidate (89 MB versus the i386 ZIP's 91 MB). The actual archive is a cross-compiler add-on, not a complete native compiler installation.

| Property | Measured value |
| --- | --- |
| Official ZIP | [fpc-3.3.1.x86_64-win64.built.on.i386-win32.zip](https://downloads.freepascal.org/fpc/snapshot/trunk/x86_64-win64/fpc-3.3.1.x86_64-win64.built.on.i386-win32.zip) |
| Acquisition UTC | 2026-10-02 14:33:34.826 to 14:35:00.202 |
| HTTP | 200; HTTPS effective URL unchanged |
| Server Last-Modified | Fri, 25 Sep 2026 21:44:48 GMT |
| Server ETag | `"589f438-65c55a0157400"` |
| Downloaded bytes | 92,927,032 |
| ZIP SHA-256 | `1b3eec24dd53ada45b5204237602f7a15b0995f9806311b9e24ab4a998ce36f7` |
| Advertised generation/source | 2026-09-25; `843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d` |
| README consistency | Actual before/after responses identical |
| Compiler version query | `3.3.1 2026/09/22 3.3.1-20895-g843eb4a6ac` |
| Executor | Windows NT 10.0.26200, X64 process and OS |

The version query matches the README's source abbreviation. The snapshot URLs are mutable; older responses observed by the audit agent referred to different revisions. The local hash pins these acquired bytes. No publisher signature or separate publisher checksum was found/verified.

The [acquisition manifest](../toolchain/acquisition/fpc-portable-manifest.json) preserves requested/effective URLs, full captured response headers, byte count, SHA-256, UTC times and platform metadata. The raw [before](../toolchain/acquisition/readme-win64-before.txt) and [after](../toolchain/acquisition/readme-win64-after.txt) README responses are retained.

## Archive and executable inspection

Every ZIP entry was checked for rooted paths, traversal outside the extraction directory, colon paths and symlinks before extraction. All 3,750 entries passed; no symlinks were found. Total uncompressed size is 497,582,643 bytes.

The only compiler executable is `bin/i386-win32/ppcrossx64.exe`, 3,725,824 bytes. PE machine `0x014c` confirms an i386 host executable; it runs under this Windows X64 environment. Its SHA-256 is `fc3a8184a70722be726264faac4357fe11851e3edb899be8ced0aea82d4e9cb0`.

The only unit target is `x86_64-win64`. No `ppcrosswasm32.exe`, WASM RTL, compiler source, `fpc.exe` wrapper or GNU make/build-tool executable is bundled. Files whose names contain “wasm” are Win64 bindings/resources and do not constitute a WASM compiler or WASM-target RTL.

Evidence is retained in the [inspection summary](../toolchain/acquisition/fpc-archive-inspection.json), [complete entry list](../toolchain/acquisition/fpc-archive-entries.json), and [compiler PE evidence](../toolchain/acquisition/fpc-compiler-pe-evidence.json). Extraction is under `toolchain/fpc-win64-snapshot/`.

## Actual compiler checks

All compiler invocations used `-n` to ignore default/global compiler configuration. Native compilation supplied the task-local Win64 RTL and task-local output directories explicitly.

| Check | Result |
| --- | --- |
| `-i` | Exit 0; CPU target x86_64; supported OS list contains Win64 and other x86_64 systems, no WASI |
| `-iVDW` | Exit 0; version/source abbreviation as recorded above |
| `-iSP`, `-iSO` | Exit 0; source/host i386 and win32 |
| `-iTP`, `-iTO` | Exit 0; target x86_64 and win64 |
| `-Twasip1 -i` | Exit 1; illegal target parameter |
| Authored native hello compile/run | Both exit 0; prints `DRL FPC portable probe` |
| Authored `-Pwasm32 -Twasip1` hello compile attempt | Exit 1; illegal target parameter; no WASM produced |

The [hello source](../toolchain/probe/hello.pas) is solely a five-line capability sample. Its generated Win64 executable SHA-256 is `54f3d2438c52b7a970dad7768b3c6d2041fcbdb84b7ec983be5a54ceed72d2cb`. It contains no DRL simulation. Exact commands, exit codes, UTC times and stdout/stderr are in [compiler-capability.json](../toolchain/probe/compiler-capability.json), its adjacent logs, and [source/target queries](../toolchain/probe/compiler-source-target-info.json).

## Pinned-source bootstrap evidence and remaining work

Selected official source files were fetched at immutable commit `843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d`; [their acquisition manifest](../toolchain/acquisition/fpc-pinned-source/manifest.json) records URLs, sizes, hashes and response headers. These are reference files, not a complete source checkout.

The [pinned compiler Makefile](https://gitlab.com/freepascal.org/fpc/source/-/raw/843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d/compiler/Makefile.fpc) includes wasm32 CPU build targets and cross-CPU cycles. The [pinned root Makefile](https://gitlab.com/freepascal.org/fpc/source/-/raw/843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d/Makefile.fpc) provides `compiler_cycle` and `crossall`. It accepts starting versions 3.2.2/3.2.0 in its normal version check, with that check conditional on cross-compilation state. This is not proof that snapshot 3.3.1 cannot bootstrap; it means no supported successful bootstrap has been established here.

The [pinned WASI target definition](https://gitlab.com/freepascal.org/fpc/source/-/raw/843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d/compiler/systems/i_wasi.pas) uses `wasip1`, CPU wasm32, and the internal WASI linker by default. It also exposes an external linker; [the external linker implementation](https://gitlab.com/freepascal.org/fpc/source/-/raw/843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d/compiler/systems/t_wasi.pas) invokes `wasm-ld`. Consequently, an external LLD executable is not an unconditional requirement for a pure Pascal hello; linking the Lua C archive still requires an actual compatibility probe.

The concrete next prerequisite milestone is:

1. Acquire a complete pinned official FPC source tree and task-local GNU build tools.
2. Establish an appropriate Windows bootstrap compiler and matching host RTL. The acquired compiler is i386-hosted but includes only Win64 RTL, so it does not supply a complete i386 native bootstrap environment. Building a Win64-hosted compiler first is a candidate inferred from its successful Win64 code generation, not a tested bootstrap result.
3. Build and inspect a Windows-hosted `ppcrosswasm32.exe` plus `wasm32-wasip1` RTL; prove the same authored hello compiles to valid WASM and executes in the chosen WASI/browser host.
4. Only then probe Lua static linking and the original DRL/Valkyrie platform boundary identified in [ORIGINAL-CORE-WASM.md](ORIGINAL-CORE-WASM.md).

The [official current Linux WASI snapshot README](https://downloads.freepascal.org/fpc/snapshot/trunk/wasm32-wasip1/README-fpc-3.3.1.wasm32-wasip1.built.on.x86_64-linux) provides a WASI build recipe, but its host is Linux. It is not evidence of an executable Windows WASM compiler. No cross-bootstrap was executed in this bounded task.

## Notices and reproducibility

The ZIP lacks complete COPYING/license files (the only matching README entry is an IDE readme). The immutable official source [LICENSE](https://gitlab.com/freepascal.org/fpc/source/-/raw/843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d/LICENSE) is retained locally with the compiler GPL text and RTL linking exception; the [RTL copyright header](../toolchain/acquisition/fpc-pinned-source/rtl__inc__systemh.inc) is also retained. Their [license evidence manifest](../toolchain/acquisition/fpc-pinned-source/license-evidence-manifest.json) pins bytes and URLs. Earlier guessed COPYING paths returned 404 and remain recorded as failed lookups. This toolchain is private local build material; no compiler/runtime archive was published.

Task-local scripts record the operations: [acquire-fpc.ps1](../toolchain/acquire-fpc.ps1), [inspect-fpc.ps1](../toolchain/inspect-fpc.ps1), [probe-fpc.ps1](../toolchain/probe-fpc.ps1), [acquire-fpc-evidence.ps1](../toolchain/acquire-fpc-evidence.ps1), and [probe-fpc-source-target.ps1](../toolchain/probe-fpc-source-target.ps1). The inspection script refuses an existing extraction target. Reacquiring a mutable URL is a new acquisition and must preserve this manifest/hash rather than assuming identical bytes.

