# Verified local Angband milestone

This record summarizes verification.json, the machine acceptance authority. All current checks target the exact same Angband 4.2.6 engine; source and packaged engine hashes match. The original gameplay remains C under the actual plan; Rust owns the separated input/application/presentation/save responsibilities described in MIGRATION.md.

- Rust: 239 passed.
- Node/source: 172 passed.
- Actual WASM descriptors: 54 passed.
- Chrome PC/mobile viewport and input: 30 passed.
- Additional store/item/spell/throw-save/death flows: 24 passed.
- Original wizard-assisted Sauron/Morgoth winner, crown, retirement and debug-score rejection: 13 passed; this is unranked evidence rather than a normal campaign.
- Packaged local HTML browser checks: 30 passed.

There are 7,595 matching reviewed English/Japanese/schema IDs. Complete translation remains false; see COVERAGE-AUDIT.md for the eight concrete presentation families and optional adapters. Browser cached repaint/locale/resize preserves the original full RNG snapshot; native hallucination/perception separation remains further work.

The package includes matching GPL source and notices, including all 109 required immutable source-test fixtures. The source archive SHA-256 is 97d5398ae30d12c6d5c36f0f52d7c26fe0cb3c8f94bd3bc869edb51e0a5f274c (12,485,978 bytes). The WASM SHA-256 is 476e7636d26f91524ea275380d0162895db34478ff1979bece0a382a6f6addf6.

User-defined Web scope: HTML with local Node verification. Start node web/server.mjs and open http://127.0.0.1:4173/web/. No external deployment was performed for this milestone. A historical publication metadata record is retained separately in the task workspace.

Heavy jobs were sequential and measured at 20ms intervals; no job was stopped for commit exhaustion. Exact resource records are in tests/source-integration-evidence/*-resources.json. Sampling may miss shorter peaks.
