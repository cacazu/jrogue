# Exact source catalog reconciliation

This bounded audit uses Cataclysm: DDA **0.I-1**, commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. It does not modify or compile
the gameplay engine and does not claim that runtime localization or the web
port is complete.

`reconcile.py` imports the official `lang/string_extractor` modules with Python
bytecode writes disabled. It calls the original `write_text` implementation and
streams each emitted `Message`, rather than recreating the game's translation
heuristics. The include order and exclusions follow `lang/update_pot.sh`.
The installed GNU **xgettext 0.22** extracts C++ with the same keywords and
`src/*.cpp src/*.h` scope. No new dependencies are needed; `polib`'s POT exporter
is bypassed. A read-only AST resolver maps actual official parser subscript
arguments to their JSON fields, including repeated single-character strings.

The executed extraction covers 6,125 JSON files, 85,861 top-level objects and
135,074 translation occurrences. All 98 official parser modules are imported;
there are no unknown JSON types, parser exceptions, or JSON decoding errors.
Upstream deliberately uses dummy parsers for 14,766 objects and ignores 48
untyped objects. This proves the official marked-translation scope, not all
unmarked text or runtime reachability.

The source has **105,003 distinct context/singular keys**: 93,512 from JSON and
11,881 from C++, with 390 shared keys. The bundled Japanese PO contains 104,633
active keys, including 169 keys absent from the current official extraction.
The exact current-source deficit is **539 keys**: 525 JSON and 14 C++ keys.
The existing 164 reviewed patches contain 157 current JSON keys, six current
C++ keys and one stale key. The stale psionic-help patch says “take this
straight”; the current source says “take this trait”.

Use these deliverables:

- `output/current-source-gaps.json`: all 539 exact missing keys, current
  context/plural variants, JSON/C++ references, semantic binding candidates and
  nearby translated terminology. `current-source-gaps-{1,2,3}.json` partition
  the same records into 180, 180 and 179 keys. Regeneration preserves assigned
  record indices.
- `output/current-source-key-manifest.jsonl`: all 105,003 source-current keys
  for catalog/MO compilation. It retains plural alternatives and current source
  bindings; it does not import stale PO keys. Multiple source plurals are flagged
  instead of silently declared equivalent.
- `output/source-plural-reviews.json`: 15 distinct explicit source-versus-PO
  plural mismatches and seven implicit-plural reviews. Japanese has one plural
  form, but English JSON must retain each definition's actual plural.
- `output/patch-source-reconciliation.jsonl`: current/stale status for each old
  patch. `stale-ja-catalog-keys.jsonl` retains the 169 catalog-only keys for audit.
- `output/semantic-definition-candidates.jsonl`: 92,174 unique, uncollided
  definition/field ID candidates. IDs use upstream type, definition identifiers,
  field paths and gettext contexts. They are not English-text hashes. Review
  remains necessary for 36,073 positional occurrences, anonymous definitions,
  540 parser-generated strings and 386 distinct colliding ID candidates.
- `output/dynamic-cpp-unresolved.jsonl`: all 185 nonliteral C++ expressions,
  explicitly requiring definition/callsite tracing.
- `output/summary.json`, `compact-summary.json` and `verification.json`: counts,
  exact tool/parser/catalog fingerprints and verification evidence.

The 13,899 earlier inventoried literal C++ occurrences reconcile as 13,894
officially extracted occurrences and five valid test-only calls outside the
official POT scope. They are not scanner false positives. No missing runtime
literal is explained away by those five calls.

Run sequentially from the task workspace with the installed Python:

```powershell
$catalogPython = 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe'
& $catalogPython -X utf8 catalog-reconcile\reconcile.py
& $catalogPython -X utf8 catalog-reconcile\summarize.py
& $catalogPython -X utf8 catalog-reconcile\handoff.py
& $catalogPython -X utf8 catalog-reconcile\verify.py
```

Eleven tests verify collector fidelity against original `write_text`, official
item and gendered-dialogue parsing, exact and ambiguous bindings, generated
category strings, default-string variables, PO parsing, plural distinctions,
definition-based IDs and the official file exclusions. The final verifier checks
fingerprints, source corpus uniqueness, all chunk boundaries, all 539 missing
keys and the test-only C++ distinction. Large reproducible JSONL/POT outputs are
ignored by this subfolder's `.gitignore`; compact review artifacts remain
available.
