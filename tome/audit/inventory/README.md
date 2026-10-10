# ToME static source inventory

`inventory-tome.mjs` uses Node standard libraries and reads source without executing Lua. Output must be outside the pristine upstream tree.

```powershell
node .\inventory-tome.mjs --self-test
node .\inventory-tome.mjs --source C:\path\to\t-engine4-src-1.7.6 --version 1.7.6 --output .\inventory-output
node .\inventory-tome.mjs --source C:\path\to\t-engine4-src-1.7.6 --source C:\path\to\unpacked --version 1.7.6 --output .\inventory-output
```

The lexer supports line/long comments, Lua quoted strings and escape sequences, long strings with arbitrary equals delimiters, and source line/column locators. Definition callsites and field/call evidence drive classification. The scanner retains all literals separately from potential text so internal identifiers and assets are not claimed as translation coverage.

Official archives may store module/engine Lua inside ZIP-format `.team`, `.teae`, or `.teaa` containers. Unpack those into separate source trees using a trusted archive tool, preserving their original containers, and supply each non-overlapping root with a repeated `--source`. The report includes root IDs for reproducible locators; roots nested inside another source root are rejected to avoid duplicate counts.

Semantic ID suggestions use declaration identity or file/call context. They require stable naming review, and `occurrence_N` suffixes are temporary review aids. No text hashes are offered as semantic IDs. Printf placeholders and T-Engine markup are recorded for future translation validation.

`--self-test` checks comment exclusion, quoted/long string escapes, locators/context, nested definition fields, argument position, placeholder extraction, and malformed source diagnostics. Full inventory counts are not available until the official source is extracted and scanned.

`analyze-locales.mjs` statically parses active upstream `locale`, `section`, and `t(source,target,tag,args_order,special)` registrations; it never executes localization code. Run after the inventory:

```powershell
node .\analyze-locales.mjs --source C:\path\to\unpacked --inventory .\inventory-output --output .\inventory-output
```

It retains Japanese source/tag maps with all registrations and catalogue locators, argument order/special tokens, Japanese random-name/font/line-break flags, duplicate/conflicting mappings, exact source gap records, and potential semantic-context reuse matches. Identical English targets are explicitly marked for review instead of claimed as translations. Static source matches and inferred context suggestions do not establish complete localization or replace the need to make stable semantic key decisions during each actual ported feature.
