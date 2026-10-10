# Angband 4.2.6 source, gameplay and text inventory

Source: pristine `angband/upstream/angband-4.2.6` at commit
`f3082213b73f3e463e3d0d60bff4b00462beae6e`. This directory contains only a
read-only extractor and its audit outputs. It changes no upstream/game files.

Run with the trusted local Python interpreter:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' '.\inventory.py'
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' '.\analyze_inventory.py'
```

`summary.json` is authoritative for the latest completed run. The files are:

| File | What it preserves |
| --- | --- |
| `source_strings.jsonl` | Every lexical string occurrence in all C, header, Objective-C, include and Windows resource source files; raw fragments, exact path/lines/columns/offsets, decoded concatenation, containing function, invocation/argument context, placeholder syntax, conservative visibility classification. |
| `source_functions.jsonl` | Lexically identified top-level function definitions with file and line spans. This is an index, not a compiler callgraph. |
| `xmacro_text_candidates.jsonl` | Text from source X-macro tables, retaining the upstream enum symbol and argument role for semantic IDs. |
| `gamedata_directives.jsonl` | Every noncomment data directive in all 45 `lib/gamedata/*.txt` files, including numerical rules, maps, identities, procedural name seeds and text. |
| `gamedata_text_candidates.jsonl` | Selected display/name/message segments with owning record, book/spell/grade/power-cutoff context; joined description fragments retain original spaces and locations. Legacy `old_class.txt` is marked inactive. |
| `documentation_blocks.jsonl` | Source documentation, manual, help, screen-art and text blocks, retaining locations and markup. |
| `native_resource_text.jsonl` | XML/property-list/interface resources, including native menu labels; binary resources are flagged for native inspection. |
| `binary_source_resource_manifest.json` | Native binary assets, compiled interface resources and the binary Word document, with sizes/hashes and explicit format/license review flags; no text-extraction claim. |
| `source_file_manifest.json` | SHA-256 and size of every input file actually scanned. |
| `feature_inventory.json` | Gameplay/content census and source-module evidence. |
| `critical_boundaries.json` | Exact code snippets/locations for message, naming, RNG, save and rendering boundaries. |
| `verification.json` | Audit consistency checks and unresolved review counts. |
| `semantic_migration.md` | Concrete semantic text/event migration rules and test requirements. |

The inventory includes tests, Borg and all native platforms so no branch is
silently dropped. The subsystem and classification fields let the Web port
review its actual enabled configuration separately. Build-system diagnostics,
copyright comments and binary assets are outside the literal-text extractor;
their licenses and distribution obligations require the separate license audit.

Every proposed ID is explicitly `needs_semantic_review`. Occurrence coverage
does not mean every string is visible, translated, or has an accepted semantic
identity. No runtime string replacement, hash identity or Japanese catalog is
claimed here. Parser symbols, asset paths and user/player names are retained.
