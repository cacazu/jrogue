# Read-only verification review

A separate agent inspected the adapter, source generator, tests, installed
libc++ stream implementations and recorded artifact/output hashes without
changing files, executing builds or writing caches.

The review confirmed 64 KiB total / 4 KiB section bounds, all seven required
states, temporary parsing before nonthrowing assignments, and the absence of
persistent hidden chi-square/gamma caches in the pinned libc++ implementation.
It identified two resource-failure issues in the initial draft: lazy allocated
ABI identity could unwind across the C boundary, and unchecked ostream badbit
could allow a truncated capsule to be reported as successful.

Both issues are corrected. The ABI is a compile-time static character literal,
all four C++ exports are `noexcept`, serializer streams throw on failbit/badbit,
and the decoder throws on badbit while normal malformed-input failbit returns
an invalid-state status. Allocation-countdown tests exercise every real standard
library allocation failure position through eventual success. They verify
untouched output on capture failure and unchanged engine plus hot/cold normal
cache on restore failure. The final narrow review found no further concrete
defect. Updated O0/O2 verification then passed with warnings denied.

Review also confirmed the initial capture must follow application-owned engine
initialization. Capture draws no RNG; first `rng_get_engine()` retains upstream's
clock seeding behavior. That initialization precondition is documented in
`README.md`. Original function provenance includes digit-bearing `djb2_hash`.

Both overlay translation units additionally compiled against actual pristine
game headers without fixture includes; the independent evidence is
`evidence/actual-headers.json`. Full engine linking, Rust/browser FFI boundaries
and browser game flows remain separate integration work.
