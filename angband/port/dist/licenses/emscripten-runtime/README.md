# Emscripten runtime notices

These files were copied from the installed Emscripten **6.0.8** SDK at
`C:\Users\kit\emsdk\upstream\emscripten`. They accompany runtime code and
JavaScript support emitted for the Angband browser build. Original notice files
remain unchanged; `provenance.json` records their source paths, sizes, and
verified SHA-256 hashes.

| Notice folder | Component and retained terms |
| --- | --- |
| `emscripten` | Emscripten project license and authors, covering its own runtime/glue and pthread adapters; MIT or University of Illinois/NCSA terms. |
| `musl` | The bundled libc/math umbrella copyright, contributors, and MIT terms, with additional third-party source notices. |
| `compiler-rt` | Compiler runtime builtins; complete LLVM license with exceptions and bundled legacy terms. |
| `libunwind` | Unwind support component; complete installed LLVM runtime license. |
| `libcxxabi` | C++ ABI runtime component; complete installed license and available credits. |
| `libcxx` | C++ standard runtime component; complete installed license and available credits. |
| `llvm-libc` | LLVM libc helper component; complete installed license. |

The musl umbrella copyright identifies permissively licensed third-party math
sources and the qsort implementation, with their terms in individual files.
`musl/math-and-qsort-NOTICES.txt` retains their verbatim leading notice/comment
blocks from 113 generic math, complex, and qsort source files. Source paths are
included for attribution. It supplements `musl/COPYRIGHT`.

This collection retains notices for relevant installed runtime components. It
does not assert that every source file or every object from a listed component
survives the final link. Including C++ runtime notices does not introduce C++
application code into Angband. Runtime member retention was not determined by
this legal-only audit; no build, linker, browser, or test jobs were run.

The LLVM component files preserve the supplied Apache 2.0 LLVM exceptions,
including the text concerning compiled portions and GPLv2 combinations. The
existing game and Rust-runtime notices remain separate. These notice additions
do not modify the engine or SDK, and the distribution/source archive should
include this directory.
