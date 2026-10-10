# Source-bound Japanese help

All five bundled Angband 4.2.6 help documents are covered at commit
`f3082213b73f3e463e3d0d60bff4b00462beae6e`: `index.txt`, `commands.txt`,
`r_comm.txt`, `r_index.txt`, `symbols.txt`. The catalog has **278 native logical
rows: 229 text and 49 blank/underline layout rows**, **10 original visible UI
templates**, and **13 separately reviewed browser action labels**: **301 semantic
IDs**, rather than 301 independent prose translations. Detailed external
ReadTheDocs content and arbitrary external files are excluded.

EN/JA JSON uses named-placeholder templates, while the manifest records exact
original English/C calls and physical/logical anchors separately. Text IDs name
reviewed topics, command action pairs and symbol roles, for example
`help.original.command.aim_wand_and_activate` and
`help.index.reference.manual_link`. Numeric positions are separate bindings or
explicit layout identities. Literal `{`/`}` keys use `{{`/`}}` escaping.
Japanese rows reflow in a separate panel; original fixed ASCII C buffers and
English help assets are unchanged.

## Provenance and native behavior

Original RST rules remain intact: a `.. ` directive begins a skipped block,
including its continuation and its terminating spaces/tabs-only or empty line.
Remaining lines, including ordinary blank/underline rows, count from zero.
Both index files have 20 logical rows from 23 physical lines; lines 21–23 are
skipped. Original menu keys/filenames remain unchanged: `a` selects
`commands.txt`/`r_comm.txt`, and `b` selects `symbols.txt`.

The generator pins each source SHA-256. All five files were independently
compared byte for byte with pristine upstream `lib/help` assets. Ordered corpus
SHA-256: `aa621305fcc0a152215da1c69ca6a1c67139fc44115c95fd79a3c62a276fc00f`.
Generated `logic/web-help-data.h` and `row-bindings.tsv` bind the same canonical
filename/ordinal and original logical index to reviewed semantic IDs. Runtime
code never searches/replaces completed English to choose a translation.

Removing **18 `AB_HELP_PURE` blocks and 10 `AB_HELP_BRANCH` ranges** reconstructs
accepted `ui-help.c` exactly, SHA-256
`fe40ef1707faaea9997df9d1410909cb1f2484bb8bfe7f343d4a5308ea7acd56`.
Branch tags retain the original search expression and original
`askfor_aux(..., NULL)` calls in native branches. Original parser identities,
menu recursion, tags, paging arithmetic, keys and return values remain intact.

## Japanese matching and highlighting

`rust/src/application_help.rs` owns pure matching over pinned EN/JA rows.
`HelpCatalog::embedded()` validates locale IDs, ordered complete source bindings
and static brace grammar. `matches()`/`find_forward()` select canonical
file/logical identity, then search only that locale. They read no game state,
RNG, browser or storage.

The original C forward scan/RST/pager control flow remains active. A validated
bundled Japanese row asks Rust whether it matches. Valid English requests
return status 2 and select the original `strstr(lc_buf, find)` path. Arbitrary
files also retain their native behavior, with an explicitly unsupported
semantic document. Invalid Rust captures return negative status and do not
silently search English as if it were Japanese.

Case-insensitive matching uses Unicode scalar lowercase, with no normalization,
transliteration or full case-fold equivalence. Queries retain the native
79-byte maximum; original prompt width may reduce the usable capacity. Empty
query matches the next accepted row. There is no added wrap: original C passes
its original clamped scan start.

`highlight_runs(text, query, case_sensitive)` returns owned
`HighlightRun { text, highlighted }` values concatenating to the exact original
localized text. Scalar boundaries remain valid when lowercase expands a scalar
(e.g. `İ`); overlapping/adjacent original ranges merge. Empty/invalid queries
leave text unhighlighted. Rust presentation applies runs only to original
help document rows, not action labels, title, prompt or opaque editor input.
The generic DOM only renders supplied text/mark runs and performs no matching
or Unicode range conversion.

## Navigation and committed IME input

Thirteen new reviewed browser action labels dispatch captured original keys:
`k`, `j`, `-`, Space, `7`, `1`, `/`, `&`, `#`, `%`, `!`, ESC, `?`.
ESC is the actual `logic/ui-event.h:173` constant `0xE000` (57344), not ASCII
27. Each action records and verifies its exact native key branch or macro
source; no translated text determines activation identity. Index choice
rows capture `a`/`b`. Rust/DOM never derive keys from translated prose. New
navigation rows begin after each source file's logical count, so they cannot
replace an original visible row. ESC returns from a nested file or exits the
main help; `?` propagates closure through the original recursive return path.

The original index documents `=`, `+`, `_`, but pinned `ui-help.c` has no
handlers for them. This concrete upstream discrepancy stays in source notes;
no controls silently implement those keys.

The browser default `askfor_aux_keypress()` now delegates one immutable UTF-8
snapshot to pure Rust `application_text`; help calls that shared handler exactly
once. It retains original first-time, literal key/modifier and byte-capacity
mechanics. DELETE corrects the pinned native scalar/byte offset bug: with 24 CJK
characters and cursor 23, the old move ends at byte 114, beyond the actual 80-byte
query buffer. Scalar-safe Rust spans preserve ASCII results and include the
original terminator bound. Browser default initialization also truncates at a
complete scalar boundary. See `../text-input/README.md` for the full contract.
Prompt/draft patches commit before input waits, and drafts clear on accept/cancel.
Navigation rows and menu activations are disabled during editing, when their
original keys instead mean input.

The existing browser text-entry form accepts ordinary browser/IME composition.
Its submit handler sends committed Unicode scalars through the existing bounded
key queue. There is no extra game command or IME parser. The native editor still
requires Enter/ESC to accept/cancel after text submission. Query text is external
input copied verbatim, not a translated game descriptor. This is a source-ready
IME seam; actual PC/mobile composition and acceptance require root's browser
checks.

## Root integration

Build `logic/web-help-text.c`; include its header and generated
`web-help-data.h`. Merge this EN/JA catalog/manifest into normal reviewed locale
and schema generation. Register `application_help` and this C ABI:

```
int32_t ab_rs_help_match(uint32_t file_ordinal, uint32_t logical_line,
    const uint8_t *query, uint32_t query_length, uint32_t case_sensitive);
```

The adapter checks pointer bounds, UTF-8, length <=79 and bool flag, then calls
`application_help::match_status(file, line, query, flag != 0, localization::active_locale())`.
Return 0/1 for a Japanese match, 2 for valid English/native fallback;
file/line/query/catalog errors are -200/-201/-202/-203. Empty length is allowed.
The getter reads existing Rust UI locale, not the engine.

Template types `opaque_file_path`/`opaque_build_identity` retain filename and
product/version punctuation exactly. Caption is a nested reviewed
`localized_text` reference, not completed English. Context `help` uses existing
scope, reset, unsupported, clear, row and input controls. Control-only
`__help_page` contains precisely these eight facts:

| Parameter | Type |
| --- | --- |
| filename | opaque_file_path |
| first, total, page_capacity | integer |
| menu, case_sensitive | boolean |
| find_query, highlight_query | verbatim_user_text |

Controls bypass text formatting; callbacks copy strings synchronously. Query
facts reflect lowercase conversion already done by native C. Original document
rows emit only after RST/search gates and inside the original viewport. Failed
search starts no replacement page. An unknown document begins replacement
before unsupported status, so old bundled rows cannot leak into it.

## Evidence and current limits

```
python migration/help-data/build_catalog.py --check
node --test tests/help-semantic-integration.test.mjs
```

Ten help source checks pass: source hashes/native byte parity, complete anchors,
RST rules, semantic IDs/placeholders/literal keys, exact C calls, capture order,
original-English fallback, UTF-8 delegation, immutable matching bindings,
original navigation codes, disabled actions during editing, and multibyte
DELETE/guard/ASCII-equivalence regression fixtures. Three Rust unit
tests are provided for locale-specific scanning, invalid captures/corpus,
Unicode expansions/highlighting and exact text preservation. **This agent ran
no compiler, engine build, Rust test, browser or deployment.** Root owns compiled
and real-browser acceptance before reporting these features verified. Parent's
`tests/source-integration-evidence/rust-native-review.log` confirms all three
help Rust tests passed in its 136/136 native run; this agent only read that log.
Current
scope is local HTML/Node browser; no external Site publication.

Shared terminology: Dragon Fly `トンボ`, Icky-Thing `ベトベト`, Xaren `ザレン`,
Quylthulg `クイルスルグ`, Ainu `アイヌ`, Zephyr Hound `ゼファーハウンド`, terrain
`瓦礫`/`守りの刻印`, and devices `魔法の杖`/`ロッド`/`スタッフ`. Original
attribution/source availability obligations remain with the enclosing project.
Additive helper, generator, tests and translations use GPL-2.0-only.
