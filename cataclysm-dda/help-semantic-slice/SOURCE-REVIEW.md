# Independent source review

A separate read-only agent reviewed the prepared C++ overlay/catalogs against
the actual pinned upstream, then read the new Rust source against the actual
`rust-contracts` APIs. It invoked no compiler, cargo, browser, build or Git
operation and made no file edits. This is source review, not runtime acceptance.

Three concrete findings were corrected:

1. Original `get_action_attributes(..., true)` synthesizes a **missing** basic
   default name using `get_default_action_name`, which reads the current default
   action table. The const observer now reads that same fallback without creating
   a basic entry. An existing basic empty name is still treated differently from
   an absent basic action.
2. `register_action_semantic` initially accepted any of the seven known IDs with
   any action/nonempty translation. Metadata assignment now requires the exact
   reviewed ID, category, action and raw translation object. Ordinary native
   registration still succeeds, with unsupported mismatches classified as legacy.
3. The Rust grid validator initially trusted the copied `single_printable` flag
   for negative/255/space codes. It now also checks the necessary native numeric
   constraints `0 <= code < 255` and `code != 32`, without reimplementing the
   locale-dependent C `isprint` decision.

The reviewer confirmed original explicit name overrides, category-local empty
binding precedence, original grid selection and the four-argument loader route.
Default `cata_path()` arguments preserve old two-argument direct loader calls as
legacy, and the declaration includes the complete path type. No obvious Rust
compile/API mismatch was found by reading; this does not establish compilation.

`SOURCE-CHECKS.json` records **1,763 lightweight Node assertions** passing after
these corrections. Fourteen original source files remain pinned, all thirteen
JSON text bindings plus both C++ title callsites are exact, all fourteen Japanese
strings match the existing GNU-verified MO/PO, and the prepared nine-file patch
applies/reverses byte-exactly in memory.

The artifact remains `source_prepared_uncompiled_unconnected`. The patch was not
applied to actual source or active engine files. Whole-engine/Rust compilation,
typed serializer/host integration, native key-name rendering, differential
consumer behavior, and real local desktop/mobile browser help/input/save flows
are still required.
