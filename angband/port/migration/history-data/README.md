# Source-identified generated biography

This catalog and the isolated Rust grammar cover every active fragment in the pinned Angband 4.2.6 `history.txt`: 165 entries in 44 charts. Fourteen complete-statement templates and one generated-history projection bring the catalog to 180 semantic IDs. The pristine source commit is `f3082213b73f3e463e3d0d60bff4b00462beae6e`; the history corpus SHA-256 is `0b5a3079af72bcdd9eb782f02551fb329ea026dabd88dfc831c03e2d7bf00ebf`.

`build_catalog.py` reads the original data and retains exact English fragments, including their trailing spaces, cutoffs, successor chart and source lines. Authored IDs describe the semantic role and choice. Numeric chart/cutoff identities remain independent domain keys. Japanese catalog values are grammar components: parentage, family reputation, lineage, litter size, parent professions and appearance facts. The complete statement plans reorder those components for Japanese. They do not translate a completed English biography or reroll a choice. English rendering concatenates the selected original fragments byte-for-byte.

## Producer provenance

The original `get_history()` performs its existing `randint1(100)` selection and `string_append()` operations unchanged. Twelve tagged browser-only additions in `player-birth.c` capture the already selected chart/cutoff, validate it against the pinned successor and source phrase, and attach presentation metadata after native generation. Original C reconstructed after removing those blocks is byte-identical to the accepted snapshot.

Browser-only POD metadata accompanies `birther` snapshots, so reroll, previous-roll swapping and quickstart copy the provenance alongside the original history pointer/copy. No additional pointer owns or frees the native biography. The UI random-finish path generates its biography before several queued race/class commands, which also generate histories. Its provenance therefore tags the actual `CMD_HISTORY_CHOICE` queue slot and that command's owned string allocation. The edited-history producer tags the same slot explicitly. Applying the command consumes the tag. The metadata never guesses the origin by finding an English phrase in an existing string.

Origins are mutually exclusive:

| Value | Origin | Browser presentation |
| ---: | --- | --- |
| 0 | Unknown, including old saves without metadata | Untranslated draft remains available; translated profile value clears as unsupported |
| 1 | Captured generated history | Versioned source choices pass to the Rust grammar |
| 2 | Positively authored change | Original opaque text passes unchanged |

Accepting the original editor text unchanged preserves its known generated or authored origin. A positive edit becomes authored. Unknown unchanged content stays unknown. User-authored text never enters the generated-history grammar. The older UI edited flag remains a compatibility signal and does not authorize formatted output. The generated C event contains only `grammar_version`, `catalog_sha256`, `start_chart` and ordered `{chart,cutoff}` choices. It contains no completed English.

`web-history.c` checks the selected source phrase only to validate immutable corpus identity, then verifies the complete chain and binding to native biography bytes. That integrity check is separate from translation selection. A modified corpus or stale/mismatched native string loses generated provenance rather than using the wrong Japanese biography.

## Save block v1

Root integration adds a separate browser-only optional block named `web-biography`, version 1. Before any native load attempt, root calls `ab_history_reset_all()` so an old save cannot inherit provenance from a previously loaded character. Missing legacy blocks remain unknown; their original biography bytes are retained by the original player loader. Existing browser checkpoint/native block versions stay unchanged.

All fields use explicit little-endian primitives, with no C struct or pointer dump:

| Offset | Field |
| ---: | --- |
| 0 | u32 wire version = 1 |
| 4 | u32 grammar version = 1 |
| 8 | u8 origin |
| 9 | three zero reserved bytes |
| 12 | u16 start chart |
| 14 | u16 choice count, at most 32 |
| 16 | 32-byte pristine history corpus SHA-256 |
| 48 | u32 native biography byte length |
| 52 | u32 FNV-1a binding of native biography bytes |
| 56 | count pairs of u16 chart and u16 cutoff |
| 56 + 4 × count | u32 FNV-1a checksum of preceding payload bytes |

The payload is exactly `60 + 4 × count` bytes. It is intrinsically aligned because the original loader includes external four-byte padding in its buffer. The new reader checks `ab_web_save_bytes_remaining()` before every byte read, rejects unsupported versions/origins, nonzero reserved bytes, malformed counts, extra/truncated spans, wrong corpus, wrong checksum, invalid chains, wrong race starting chart or mismatched native history. It stages its metadata and commits only after complete validation. Unknown origin requires zero start/count/text binding; authored origin requires zero start/count and an exact opaque native-text binding.

The longest generated history in the pinned corpus is 221 ASCII bytes. Original manual editing accepts at most 239 bytes. Both fit the original `rd_player()` 250-byte biography buffer. Arbitrary longer external biographies retain the original native limitation; an old save does not contain enough provenance to reconstruct or translate them. This extension does not change that native domain format.

Original native Angband cannot read the additional browser-only save blocks. Browser version-compatible loading handles the new block and old payloads without that block. Root retains the original native block-byte comparison and treats this new block as an explicit additional payload.

## Rust formatter API

`rust/src/history.rs` is separate from the existing localization adapter. Root adds `pub mod history` and the `GeneratedHistory` descriptor parser/resolver.

```text
HistoryCatalog::embedded() -> Result<HistoryCatalog, HistoryError>
HistoryCatalog::render(&GeneratedHistory, Locale) -> Result<String, HistoryError>
GeneratedHistory {
  grammar_version: u32,
  catalog_sha256: String,
  start_chart: u16,
  choices: Vec<HistoryChoice { chart: u16, cutoff: u16 }>
}
```

The UI projection ID is `player.sheet.generated_history.value`; its `history` parameter has type `GeneratedHistory`. The module validates grammar version, corpus, bounds, exact canonical entries, source successor order and complete termination before rendering. Its immutable JSON catalogs and generated `history_data.rs` graph are included directly. There is no RNG, FFI, unsafe code, engine mutation or fallback to native English on an invalid generated descriptor.

## Source-only verification

Run from `angband-port`:

```text
C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe migration/history-data/build_catalog.py --check
node --test tests/history-semantic-integration.test.mjs
node --test tests/ui-semantic-integration.test.mjs
```

The catalog check and 7 history tests passed; the updated 9 UI tests also passed. They prove exact source coverage, source hashes/lines/IDs, placeholder agreement, complete-plan participation for every one of the 165 entries, exact English recomposition, Japanese golden statements, birth/native RNG source parity, explicit command provenance and generated/authored/unknown formatter routing. Independent wire-contract fixtures reject every truncation point plus version, corpus, count, reserved-byte, text, selection and checksum corruption.

These are source/artifact tests; their independent byte-contract examples do not execute the C reader. Three Rust unit tests are provided for exact English/Japanese output, all canonical entries and invalid captures, but were not compiled or run by this agent. Parent-owned engine/Rust builds and browser checks must verify actual reroll/previous/quickstart, save/load, corrupted block rejection, RNG equality and Japanese layout before marking this runtime-complete. General game localization and publication are outside this catalog's coverage.
