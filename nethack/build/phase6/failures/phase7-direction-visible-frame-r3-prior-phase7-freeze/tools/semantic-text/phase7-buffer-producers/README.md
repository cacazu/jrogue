# Phase 7: intermediate public text buffers

This is an isolated, source-only preparation against official NetHack 5.0.0 commit `16ff59115315917b93185d026aeefea06db9b0f4`. Nothing here is applied to the active engine, catalogs, Rust, browser host or compiled artifacts. The original C game remains responsible for gameplay, English formatting, input, state, naming, RNG, filtering, history and sound. The proposed observer owns only presentation descriptors and copies of arguments already selected by original source. Upstream copyright and NGPL notices remain in every generated original source file; new integration code and Japanese authoring here are under the NGPL.

## Exact census

Run the three finite source-only scripts, in order, from the workspace root:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -B -X utf8 nethack/tools/semantic-text/phase7-buffer-producers/census.py
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -B -X utf8 nethack/tools/semantic-text/phase7-buffer-producers/prepare.py
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -B -X utf8 nethack/tools/semantic-text/phase7-buffer-producers/verify-source.py
```

The scripts read the pristine official tree and existing fixed inventories. Writes are confined to this directory. `generated/census-summary.json` records input/source hashes and groups every original producer and unresolved output by API, destination kind, source file and function. Full token spans, exact original argument expressions and declared typed unions are in the detailed JSON files.

| Source evidence | Count | What the count establishes |
|---|---:|---|
| Original core C files scanned | 130 | Every `src/*.c` file in the pinned tree, including files with no formatter |
| Intermediate formatter origins | 1,591 | All original fixed producer-ledger rows are matched to exact source tokens |
| Literal formats / dynamic formats | 1,484 / 107 | Format-derived schema versus a still-unresolved original format choice |
| Dynamic output origins | 963 | The original direct-output census, including lexical declarations/null/inactive paths pending review |
| Previously source-prepared / remaining origins | 63 / 900 | Union of 59 selected-literal and 4 distinct selected-alias source sites; no runtime approval |
| Copy/append/address-builder calls | 2,126 | `Strcpy`, `Strcat`, bounded copies, memory copies, `eos` and related original calls |
| Lexical character-array declarations | 1,236 | Source declaration/scope/capacity candidates, not C type or storage-duration proof |
| Calls passing scope-bound buffers | 4,386 | Explicit original callee/argument operands needing read/write/escape contracts |
| Returned buffers / assignment operands | 66 / 143 | Original local-buffer return and potential alias/copy operands, still unproven |
| Remaining origins with same-declaration formatter candidates | 358 | Scope/order candidates requiring full branch, alias, lifetime and publicness review |
| Rejected same-symbol candidate edges | 707 | Earlier coarse symbol overlaps rejected because declaration/order is different or unproven |

These denominators overlap. One original public message may use several formatter, literal, copy and name producers. They must not be added together to claim message or Japanese coverage. The 900 remaining origins are review candidates, not 900 certified visible messages; file-scope declarations and null menu titles remain distinguishable evidence.

The scope pass fixes a real false association: `src/pickup.c:766` formats the count-selection question into the block-local `qbuf` declared at line 764. The `ynaq(qbuf)`/`ynNaq(qbuf)` question at line 854 uses another `qbuf`, declared at line 850 and built by `safe_qbuf()`. The old same-function symbol overlap linked them. This census rejects that edge and separately records the actual count-question escape to `query_objlist(qbuf, ...)` at line 768. It does not infer that arbitrary symbols with the same spelling share an event.

The scanner is deliberately not a C preprocessor, compiler, points-to analysis or CFG. Declaration candidates cover simple lexical character arrays. Pointer declarations, arbitrary C types/casts/arithmetic, struct fields, opaque aliases, indirect function-pointer calls, partial writes and escaped heap storage remain unproven. A candidate edge cannot issue an event. Every such gap requires a reviewed original producer/copy/consumer contract, or the whole original English remains visible.

## Bounded original source prototype

`generated/prototype` prepares seven formatter branches feeding six original consumer sites in three files. This is useful source-preservation evidence, not an installed port or runtime success.

| Original path | Captured source values | Original delivery |
|---|---|---|
| `cmd.c:536 → 538`, `doc_extcmd_flagstr` | The complete technical key from the original `visctrl(cmd_from_func(do_reqmenu))` call, once | `add_menu_str`, with original menu behavior |
| `cmd.c:4258 → 4259`, `help_dir` | Original already-selected `sym`, promoted to `int`; exact `%c` | `putstr`, original window and attributes |
| `restore.c:1093/1096 → 1098`, `getlev` | The selected `hpid/pid` or `dlvl/lev` scalar pair | `pline1`, only under the original `wizard` gate and `!SFCTOOL` source branch |
| `timeout.c:2053 → 2054`, `wiz_timeout_queue` | Original `svm.moves`, exact `long`/`%ld` | Original wizard diagnostic `putstr` |
| `timeout.c:2104 → 2105` | Original unsigned `u.uswldtim`, exact `%u` | Original conditional wizard diagnostic `putstr` |
| `timeout.c:2109 → 2110` | Original `u.uinvault`, exact `%d` | Original conditional wizard diagnostic `putstr` |

Original expressions, helper calls, predicates, argument bytes/comments, attributes and subsequent control flow are retained. There is no additional `visctrl`, `cmd_from_func`, naming, visibility, gender, knowledge or RNG query. No effectful multi-argument name/RNG case is admitted. The original `Sprintf` is the pinned `(void) sprintf` macro, so wrappers retain void result semantics and invoke that original formatting API exactly once with the captured original C values. The two restore writes remain in their original mutually exclusive branch; `trickery()`, restore state mutations and debug policy are unchanged.

The generator replaces only exact API tokens and inserts an inert local-owner parameter. Every original argument byte remains at its original call site. Source-selected static descriptors identify the original format and consumer; nothing translates by recognizing the completed buffer. Per-file private headers avoid unrelated wrapper definitions in other translation units. Each modified original C file carries a dated `2026-10-02` change notice. Added `#line` resets preserve later original logical `__LINE__` values without changing `__FILE__`. Reversing recorded operations recovers the complete original source bytes, including comments, whitespace and directives.

All seven paired catalog entries retain the full original typed schema and printf conversions. They are separate draft source entries with `runtime_binding_approved:false`. The prototype does not mark any of the 900 remaining origins as runtime-covered.

## Ownership and emission contract

`nh-buffer-producer.h.in` and `.c.in` propose a local `nh_buf_owner`, never a persistent pointer or literal registry. It holds a source-issued static descriptor, copied promoted scalar values, copied public technical string arguments, an exact bounded copy of the original completed buffer, and a monotonic local generation. This initial owner permits four arguments and 256 bytes of output/individual text storage. Original `BUFSZ=256` and `QBUFSZ=128` are checked in the pinned source. Other capacities fail closed. These limits are prototype bounds, not measured runtime memory peaks or an ABI commitment.

1. Before the selected original write, invalidate the old generation and argument slots. Capture only the original full `%s` technical input key or original scalar arguments; preserve the original formatting call with its original pointers/values. Input/output overlap is rejected for metadata. This observer does not repair or alter upstream formatting behavior.
2. After that same original write, require a complete NUL within the proven original char-array capacity and a matching generation. The final boundary is conservatively rejected because void `Sprintf` provides no independent truncation-result evidence. An unknown/invalid argument or missing slot cannot retain a previous event.
3. At the exact reviewed original consumer, require that its pointer equals this local owner's source buffer and its bytes still equal this generation's original copy. This is a stale/overwritten-buffer integrity check, never an English identity lookup. Unknown writes, even writes that would reproduce the same bytes, require an explicit invalidation barrier; equality does not prove ownership.
4. Copy the immutable descriptor/typed arguments into the heap semantic scope before the original window call can Asyncify/yield. Invalidate the local ticket immediately. No borrowed pointer to a temporary event/value is exported. Actual delivery remains the original accepted callback: direct `putstr` is bracketed with `nh_text_emit`; message delivery uses the original one-shot forward/vpline claim; `add_menu_str` uses the original add_menu claim and filters.
5. Missing ownership, OOM, bounds/schema failure, truncation, alias ambiguity or invalid UTF-8 yields the exact original English path. The inner failure cancels pending presentation ownership so it cannot borrow an outer message ID. The original native API still executes. Nested ownership/Asyncify/native callback behavior is not yet compiled or tested for this prototype.

The host must capture the getter synchronously at that actual callback and repaint from frozen events. Rendering cannot call buffer/name producers, original helpers, state getters, predicates or RNG. Original English remains authoritative for core save/history, filtering, sound and input/accelerator bytes. A filtered, suppressed, auto-selected or early-return path emits no new public row or event.

This proposal targets the isolated Phase6 composer's six-field `nh_text_argument`: `name`, `kind`, `text`, signed `int64_t integer`, `event_json`, and `allow_name_capture`. The unsigned wasm32 value is promoted into the same nonnegative `integer` field; there is no separate unsigned field. Technical text and scalar slots explicitly set `allow_name_capture=0`. The composer confirmed that `nh_text_begin` deep-copies argument text/events before the local ticket is invalidated, and native claims match the exact API/emission kind. This is an interface review, not a compiled compatibility result. `generated/prototype/operations.json` contains exact pristine spans and reversible operations; offsets must be mapped to preserved original spans after Phase6. Stale/ambiguous anchors must reject composition rather than using these pristine offsets on an altered file.

## Copy, append, return and interprocedural design

The census includes source operands for these stages; the initial executable source prototype does not implement them. A later generator must admit exact reviewed source operations, not perform blanket formatter substitutions.

**Copy:** capture the incoming owned event before the original destination write/reuse. Preserve the original copy call, count, destination, source and return value exactly once. Issue a new owned destination generation only if the exact source-issued input is still valid, the original source storage and lifetime are certified, the entire intended public input was included, and the result was not clipped or overlapped. Unproven `strncpy` termination, `memcpy` lengths/overlap, same-byte alias writes, raw restored bytes and arbitrary pooled immutable literals invalidate the result. `strcpy`/`strcat` pointer return values and void `Strcpy`/`Strcat` macro semantics must stay distinct.

**Append:** snapshot the original prefix event before the original `eos`/`eos2`-selected write. Forward the original append pointer unchanged; never call `eos` again. Verify that it equals the certified prefix end and that the prefix generation/bytes remain intact. Capture only the original selected tail operands. A full result becomes a source-selected nested composition of the prefix and tail, with the complete original argument union retained. Arbitrary C pointer arithmetic, overwritten prefixes, partial fields, unbound English suffixes or clipping cause whole-English fallback. For example, `botl.c:4542/4544 → 4545` formats a selected status-field label and appends an original count; the field label needs its original public producer descriptor before the whole summary can be localized.

**Returned/escaped buffers:** use an explicit caller-owned returned value or expected-producer ticket tied to the exact original source call and storage generation. Copy its event before `nextobuf`/`nextmbuf`, heap free/realloc, saved-record replacement, reuse, case mutation or stack expiry. A bare pointer copied through a variable cannot certify a name/grammar producer. Pure user-entered proper names require creator provenance; generated descriptive names/ranks require their original selected producer events. Saved/restored English without live source provenance remains English until a separately approved semantic-save contract exists.

**Interprocedural consumer:** the pickup count prompt demonstrates a genuine next target. Source `pickup.c:766` feeds `query_objlist` at line 768; its original `qstr` reaches `end_menu(win,qstr)` at line 1166. Carry a private copied ticket for only that exact caller/input producer and matching original parameter. Keep it inactive while original object filtering, AUTOSELECT_SINGLE, sorting, display-RNG glyph choices, menu rows and possible cockatrice early returns run. Activate it only around the original accepted `end_menu` prompt with its original window; do not tag unrelated item rows or headers. Early exits or a changed/copied/aliased `qstr` invalidate it. No second query of object state, count or names is permitted.

**Precision/width:** preserve every original consumed width/precision/value slot and promoted C type. Numeric formatting keeps the exact specifier, including signedness, width, precision and `%c` byte behavior. For `%.*s`/`%.Ns`, snapshot only the original consumed public byte prefix at the original producer; negative precision means the original full string behavior. Never export the entire hidden suffix, real-name descriptor, true object/species/gender or a clipped-away nested event. Zero precision must not expose a source argument that contributed no public text; no new `%.0s` placeholder may be invented to satisfy grammar. Partial UTF-8 or an uncertified prefix invalidates semantic delivery. If final `snprintf` truncation means the included public slots cannot be proved, retain the whole original English. `%n`, unsupported conversions and unknown printf wrappers keep original effects/return values and remain uninstrumented until a separate contract exists.

## Evidence and outstanding checks

`generated/source-verification.json` records **26 passing source-only checks**: complete fixed denominators, original source/hash/argument spans, the real pickup shadowing regression, deferred interprocedural operand, nested-scope/string/comment fixtures, exact three-file byte recovery, original logical-line preservation, dated modification notices, full typed catalog unions, original macro semantics, single formatting calls and rejection of stale/overlapping/ambiguous source operations. Source checks also verify bounded/overlap/integrity/one-use/OOM guards are present, unknown-buffer name lookup is disabled, and no native name/state/RNG helper is called by the private bridge.

These checks do not execute C. No compiler, allocator canary, ABI, native/WASM, browser, campaign, localization-completeness or acceptance result is claimed. Before any integration, independent source review must resolve every allowed source span and compose it after Phase6 without stale anchors/owner precedence. Then run isolated C/ABI tests for all scalar/character/boundary/OOM/nested tickets, callbacks outside delivery, exact English replay, duplicate/filtered branches, reused pointers, aliases, copied/returned prefixes, all precision/width variants and Asyncify lifetimes. Real browser cases must drive the original commands/menus and confirm accepted native producer IDs, normal/history/input behavior and world/RNG invariance across locale changes/redraws. Synthetic envelopes remain separate evidence. Long campaigns and the 900 unresolved origin paths still need their actual producer contracts and coverage.
