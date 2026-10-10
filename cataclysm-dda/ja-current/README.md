# Current-source Japanese additions

The official stable source at `0.I-1`, commit `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`, contains 539 marked gettext keys absent from its bundled Japanese PO. Three reviewed chunks cover all 539 keys (180/180/179). Their source contexts, English strings, plural alternatives, references and exact JSON bindings are retained. Existing Japanese terminology is used where available; external/model names and dynamic placeholders are preserved.

`compile-current.mjs` verifies the immutable original PO, each assigned record, key uniqueness, source binding preservation, typed printf arguments, tags, braces, dialogue markers and paragraph breaks. It applies 163 source-current earlier reviewed patches, excludes one stale patch, merges the 539 additions, and compiles exactly 105,003 officially extracted current keys to GNU MO. The source tree and original PO remain unchanged. Japanese has one plural form; current-source English plural alternatives are recorded separately.

```powershell
node ja-current/compile-current.mjs <pristine-root>/lang/po/ja.po
& 'C:\Program Files\Git\usr\bin\msgunfmt.exe' --output-file=ja-current/generated/gnu-roundtrip.po ja-current/generated/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo
```

`en.json` and `ja.json` contain the 539 reviewed source-companion records with explicit printf parameter positions/types. `semantic-id-registry.json` replaces 180 inherited candidate IDs with reviewed public IDs, retains source aliases, and verifies all 539 IDs against the Rust grammar without changing their text or bindings. `apply-semantic-registry.mjs --check` verifies that application; repeated application is byte-identical. Future compiler runs use the same registry.

These companion files still require conversion to the Rust runtime's typed parameter/template schema, and the original C++ runtime uses its gettext bridge. The full game has outstanding semantic ID collisions, positional/generated texts, dynamic expressions and unmarked/runtime text checks. Zero missing marked gettext keys is not a claim that the entire semantic ID conversion or runtime translation is complete.

The added translations and tools follow Cataclysm: DDA's CC BY-SA 3.0 license. Upstream translator credits and source notices are preserved in the pristine source and runtime notice package.
