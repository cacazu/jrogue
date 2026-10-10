# Cataclysm: DDA inventory tools

Dependency-free Node 18+ tooling. It reads pristine source and writes separate reports. It never executes upstream code, rewrites game strings, or modifies the acquired source.

```powershell
node --test inventory.test.mjs
node inventory.mjs --source '<pristine upstream>' --output '<separate report directory>' --upstream 'https://github.com/CleverRaven/Cataclysm-DDA' --version '0.I-1' --commit '<exact SHA>' --acquisition '<archive provenance>'
node catalog-review.mjs '<pristine upstream>\lang\po\ja.po' '<report directory>'
node feature-manifest.mjs '<pristine upstream>' '<report directory>'
```

`inventory.mjs` hashes every file, counts source physical lines, extracts literal C++ gettext/deferred-translation calls with context/plural/spans, flags nonliteral expressions, inventories every JSON string/typed object, and parses shipped English/Japanese/POT gettext catalogs. Source spans use decoded UTF-16 offsets and one-based lines/columns; SHA-256 uses original file bytes. Editor `.devcontainer` and `.vscode` JSONC is supported; game JSON stays strict.

`catalog-review.mjs` exports the exact missing Japanese catalog entries and preserves source references/context/plurals. Upstream `c-format` printf and known dynamic dialogue-tag differences are separated from lower-confidence review findings. These reports are audit candidates; translators must inspect the call sites before changing a parameter contract.

`feature-manifest.mjs` records every source file and JSON type in a migration backlog, including residual unclassified entries. It uses the actual user-plan layer names: logic, presentation, platform, input. Its filename classifications are recommendations, not proof that an existing engine has those boundaries. It also records upstream Web packaging lines, RNG boundary candidates, and localization parser modules to reconcile.

No regex-based extractor establishes complete runtime text coverage. All JSON string leaves, ambiguous translation expressions and residuals remain visible for that reconciliation. The inventory does not claim a complete port, tested gameplay parity, or publication.
