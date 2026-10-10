# Source review and pending validation

This library is **uncompiled, unexecuted, and unconnected**. Root reviewed the
small `consumer.rs`, `transport.rs`, and `wire.rs` sources and found ownership,
RAII release, publication/epoch ordering, and strict identity/schema validation
consistent in that review. This is not a compiler or runtime result.

Concrete producer-dependent assumptions are documented in source and tests:

- The original observer assigns one context epoch per tracked scope entry and
  consumes at least one publication per entry, including unavailable entries.
  Parent restoration and serialization failure consume additional publications.
  Thus ready `context_epoch <= publication_sequence`; the pending epoch test
  rejects a counterexample. Epochs themselves can decrease on parent restoration.
- A child's nonzero parent epoch predates its own epoch, and depth one has parent
  zero. A zero context/publication cannot produce ready schema records.
- `keymod_t` order in the pinned `input_enums.h` is ctrl, alt, shift and the
  source uses `std::set`; source-order/unique modifiers are enforced.
- Present local empty bindings stay empty. Missing actions have empty vectors.
  No duplicate-action-ID guarantee is assumed; order and indices are preserved.
- The original observer explicitly normalizes both notification halves with
  `>>> 0`. The independent 61-byte i32-import fixture demonstrates why this is
  needed; it does not execute this Rust crate or the C++ observer.

Nineteen pending Rust tests cover identity/schema failures, duplicate/unknown
fields, UTF-8 and byte/list bounds, lossless counters, all binding types, raw
text ownership, empty origins, source order, epoch structure, pin release and
range errors, nested restore, stale/conflicting notices, generation mismatch,
terminal exhaustion, and unconditional command denial. Zero were executed.

Three synthetic fixtures and exact reused dependency records passed only the
Node fixture/provenance validator. It cannot detect Rust typing, borrow-checker,
Serde implementation, formatting, or Clippy failures. Cargo offline/locked
resolution, compilation, all Rust tests, and an actual cross-module adapter
remain required. A host trap/panic or process abort is not covered by the trait's
normal `Result`-error release guarantee; the release adapter must not panic.

The complete original-engine snapshot acceptance list remains in `../ABI.md`.
No isolated parser or mocked transport result proves real native-context
coverage, gameplay/renderer purity, native save behavior, or weather RNG isolation.
