# Source review record

Status: **uncompiled and unconnected**. Two agents reviewed the small proposed
module/hook against pinned original interfaces. This is a source review, not a
C++ compiler check, runtime result, gameplay equivalence result, or release
approval. No active engine build or pristine source was edited.

The reviewed original interfaces are `src/input_context.cpp/.h`,
`src/input.cpp/.h`, and `src/input_enums.h`, pinned in
`SOURCE-PREPARATION.json`. The original `input_context` is already a friend of
`input_manager`. Noncapturing callbacks defined inside its member wait retain
the original private access; no public getters or class-header changes are
needed in this slice. They return internal const views consumed synchronously
by the serializer; internal pointers never cross the four-export ABI.

The native action resolver can insert missing default actions and generate
translated names. The hook therefore uses only const `action_contexts.find`
lookups. A present local action, including an empty binding override, wins;
default bindings are selected only when native precedence would select them.
A missing registered action remains unbound without creating an entry.

Two concrete review corrections were applied:

1. Replaced string-literal default-map searches with the existing
   `default_context_id`. This avoids constructing a temporary `std::string`
   inside the nonthrowing lookup callback.
2. Caught JavaScript notice creation/scheduling, the deferred host callback,
   and logging failures. Host observer errors must not escape into C++ input.

A later source review found that WASM i32 import arguments can reach JavaScript
as signed values despite C++ `uint32_t`. Both notification halves now explicitly
use `>>> 0`. The lightweight source checker executes a 61-byte predeclared WASM
i32-import fixture to demonstrate signed host arguments, then evaluates the
actual small notice expression for 16 combinations of zero, signed maximum,
high-bit minimum, and all bits set. It verifies unsigned halves and exact
BigInt reconstruction. This does not execute prepared C++, Rust, or the engine.

The reviewer re-read those fixes and found no remaining concrete source issue
in that requested scope. Normal nested RAII restoration occurs after original
timeout restoration, and republishes current parent bindings. Owned immutable
pins remain valid across new publications and clears; strict UTF-8, size,
collection, depth, handle, and counter limits fail closed.

The source checker verifies exact upstream hashes, insertion location,
unchanged non-hook bytes, generated files, standard unified-patch application
and reversal entirely in memory, four source ABI declarations/definitions, and
the absence of mutating native resolver calls in the hook. It validates its
patch parser using a corrupted-context rejection case. These checks cannot
detect C++ type/compiler errors, Asyncify/microtask scheduling, untracked native
readers, or real-engine observer side effects. See `ABI.md` for mandatory tests.

The root boundary document preserves the current weather animation gameplay-RNG
release blocker and the user's authorization to isolate cosmetic randomness.
This overlay exports neither RNG state nor save execution and does not resolve
that blocker. It also does not claim that isolated Rust renderer tests establish
original whole-game rendering purity.
