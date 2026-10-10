# Phase6 integration compatibility review

The frozen Phase6 proposals fit the existing Rust JSON/formatting ABI. No production Rust API change is required. This directory contains an unchanged source copy of the current Rust crate, explicit catalog projections, ten additional test cases, and source-only verification evidence. The Rust cases have not been compiled, formatted, linted, or executed. Native capture, stack behavior, lifetime canaries, window routing, and browser behavior still require the parent's gated compilation and runtime checks.

The official gameplay remains NetHack 5.0.0 C at commit `16ff59115315917b93185d026aeefea06db9b0f4`. The Rust layer formats captured public observations and cannot query or change C gameplay, RNG, input, or state. Current Rust, canonical catalogs, upstream sources, active Phase4 inputs, and historical checkpoints remain unchanged.

## Required integration corrections

1. The frozen native getter proposal appends `exit_nhwindows` acceptance after the generic `NH_TEXT_RAW && raw && window == -1` branch. Consequently a raw-print callback also matches that exit scope. The integration copy must recognize the exit API before generic RAW routing and return JSON only for `shim_exit_nhwindows/-1`; every other callback/window must return null. This is a source contract mismatch, not an observed runtime leak. The composer was informed; this directory does not edit the frozen proposal.
2. Native wrappers use the Phase4 six-field `nh_text_argument` aggregate, including `allow_name_capture`. Integrate with the extended Phase4 header/core. The canonical earlier five-field header is unsuitable for those six-field initializers. The field is C-private and does not cross Rust FFI.
3. Helper and monster source-review catalog envelopes contain provenance/status fields rejected by Rust's `deny_unknown_fields`. Project only `en`, `ja`, and optional `argument_schemas`. Only 320 enabled helper descriptors are projected; the ambiguous gill remains unbound. Do not weaken the Rust parser or manufacture Japanese text for deferred entries.
4. Two native IDs already occur in the baseline catalog. Both English templates are identical. Deduplicate only exact source templates, retain baseline Japanese, and validate the added explicit source unions. Reject conflicting duplicates. The prepared combined fixture has 3,842 English IDs and 3,407 Japanese IDs; this count is a source fixture count, not native translation coverage.

## Actual boundary contracts

`GameplayContext.api` is an ASCII identifier of at most 64 bytes, rather than a closed API enum. The plain variant accepts `panic`, `panic1`, `config_error_add`, `livelog_printf`, `dump_forward_putstr`, and `exit_nhwindows` already. The existing narrow dream/underwater/blind/quoted helper whitelist remains unchanged. Rust context has no general window field: C authorizes the actual emitting callback/window before returning the envelope. Unknown context fields remain errors.

| Original public route | Required C callback/window | Frozen semantic context |
| --- | --- | --- |
| panic/panic1 final output | raw_print or raw_print_bold, -1 | plain; original complete final message only |
| accepted config error | putstr, WIN_MESSAGE | plain; source-selected label/line/punctuation recipe |
| accepted game log display | putstr, the actual show_gamelog window | plain; captured original turn and accepted stored event |
| dump forwarding | putstr, actual forwarded window, only when forwarding occurs | plain; file-only output has no public event |
| exit_nhwindows | shim_exit_nhwindows, -1 exclusively | plain; requires correction above |
| monster/object/helper argument | nested in an already accepted parent emission | `{type:"event",value:{id,args}}`, no additional context |

The WASM C/Rust boundary remains UTF-8 JSON plus pointer/length/output-capacity arguments. On wasm32, C `size_t` and Rust `usize` agree; numeric return values are i32. No C producer struct or borrowed struct field is exported to Rust. Native C formal types are checked as int32/uint32 (WASM long32) before copied numeric JSON; Rust can retain its existing i64/u64 wire contract for other public adapters.

Source identifiers must satisfy the actual Rust grammar: lower-case English segments, with a narrowly allowed terminal ten-hex fingerprint, maximum 160 bytes. Argument names admit ASCII letters in either case followed by alphanumerics/underscore, maximum 64 bytes; quest modifier names retain their upper-case suffixes. No renaming or English reverse lookup is needed.

Current bounds are catalog 16 MiB, gameplay envelope 256 KiB, output 128 KiB, individual text 64 KiB, 64 arguments/event, root depth zero through nested depth eight, 512 event nodes, 4,096 aggregate arguments, and 8,192 formatting expansions. Source projections fit those catalog/ID/argument limits. The object sequence has at most 25 nested parts plus `original`, giving 26 arguments, with flat sibling composition rather than increasing depth per prefix. C's 4,096-byte name-event registry and source BUFSZ buffers remain stricter producer bounds; exceeding any producer or Rust bound retains the whole original English output.

`Catalog.argument_schemas` declares the full source-public union. Both locales may use different subsets, but events must supply exactly that union and merged source/target typed slots remain checked even when the chosen locale omits them. Nested events propagate fallback. Raw public names requiring untranslated fragments must use an explicitly English-only nested event recipe; ordinary player text remains opaque text. Braces and percent characters in text are never templates. `%c` retains source byte/ASCII semantics; invalid high-byte output fails formatting rather than inventing a Unicode character.

## Ownership and original evaluation review

Helper/pronoun producers own their inline JSON in a returned struct. The expected-helper scope captures the original selected return once, checks its pointer and copied bytes, and closes before returning. Keep that owning struct alive as a wrapper formal until `nh_text_begin` synchronously copies its JSON/text. A pointer into a returned temporary must never escape. Original table selection, visibility predicates, and `pronoun_gender` calls, including their original Hallu RNG, remain once at the same source expression. Scope reentry/threading/nonlocal-exit cleanup still needs runtime evidence.

Monster producers copy source-certified public pieces into bounded owned snapshots before pooled-buffer reuse. Creator-certified custom-name events, original shopkeeper/ghost results, original adjective bytes, pointer generation, and completed-output integrity gate every descriptor. Unknown rank/priest/deity/custom provenance remains whole English. The bridge does not certify arbitrary field pointers or static literals as names and does not rerun `is_mplayer`, hallucination selection, name functions, or RNG. Capitalization/article wrappers preserve the original call and byte-integrity checks.

Object producers capture the existing public base before overwrite, retain its source generation and buffer-range epoch, and collect only pieces selected by original printed branches. Numeric hooks return the original quantity/enchantment/charge/content values; original helper arguments and RNG are not replayed. Original final bytes must equal the captured prefix/base/suffix composition. Pool reuse, generation overflow, moved offsets, missing provenance, clipping, unsupported erosion/price/custom changes, or extra bytes invalidate the complete event. This object proposal was authored by this reviewer, so its ownership review is a self-review; the separately recorded `/root/jp_batch2` read-only review is the independent source review. Neither proves executed C behavior.

Native scopes clone event JSON and text synchronously. Config label/line/punctuation events are copied before local buffers or scopes expire; original vsnprintf/config logic runs once. Game-log sidecars own their stored text/event and are bound only to the original accepted node; pointer reuse and cleanup fail closed. Save/load persistence of those sidecars is documented, not implemented, so restored logs remain explicit English fallback. File-only/filtered/suppressed/truncated outputs never gain a public event. The private nested-event copier reads only the known valid C envelope writer, with byte and brace/quote bounds; it is not a replacement for the strict Rust parser.

## Evidence and next gate

`compatibility-preparation.json` binds every frozen proposal input, all protected Rust/canonical input hashes, unchanged copied Rust source hashes, projected fixture counts, and test-source hashes. `source-verification.json` records the actual lightweight Python source checks. The prepared Rust test source checks new API compatibility, rejected helper spoofing/unknown fields, explicit metadata projection, full catalog parsing, 26-argument flat object composition, exact numeric types, full omitted-plural union, nested fallback, and native English-only fallback.

The isolated crate is `rust-copy/Cargo.toml`. Its only config adaptation points at the existing read-only offline vendor directory; it has no newly downloaded dependency or global configuration change. After the parent's resource gate, run its native tests using a task-local target directory, then test the combined C build and callback/window/lifetime canaries. A test-source fixture is not evidence that a native producer executed correctly or that Japanese binding is approved.
