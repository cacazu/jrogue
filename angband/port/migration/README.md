# Reviewed Angband localization inputs

Pinned upstream is Angband 4.2.6, commit `f3082213b73f3e463e3d0d60bff4b00462beae6e`.

This directory contains successive source-reviewed localization checkpoints, producer bindings, typed parameter schemas, grammar inputs, manifests and immutable reconstruction evidence. Counts and availability stated in an individual historical checkpoint describe that checkpoint, not the current combined game catalog. Current catalog agreement, source connections and remaining branches are recorded in [coverage-audit.json](coverage-audit.json) and [COVERAGE-AUDIT.md](../docs/COVERAGE-AUDIT.md).

The eight newly source-connected families are message recall, second character-sheet matrices, Enter/context menus, look/target prose, chronological gameplay history, knowledge metadata, native character exports and chest-trap messages. These additions preserve the original selected subjects, native ordering and hidden-information boundaries. Representative matching final-engine browser paths now verify the added presentation, pending restore, normal death and original native perception behavior. Final package/dist acceptance remains conditional on the matching guards in `../verification.json` and `../build/package-manifest.json`; representative paths do not establish every producer branch. The last accepted engine and actual passing counts belong to [verification.json](../verification.json), [build/manifest.json](../build/manifest.json) and `../tests/source-integration-evidence/`; they must not be applied to a different binary.

Original review manifests retain their creation-time assessment and C line anchors. Anchors are checked against hash-identified source snapshots because additive browser hooks shifted live lines. Earlier biographies, help, object/monster grammar, lore, spells, combat, state and UI checkpoints remain separate source graphs; the fresh audit supersedes blanket historical claims about current missing producers.

```powershell
node tools/generate-reviewed-catalogs.mjs --check
node migration/verify-review.mjs --check
node --test tests/*integration.test.mjs tests/catalog-wording.test.mjs tests/semantic-view.test.mjs
cargo test --offline --manifest-path rust/Cargo.toml --lib --jobs 1
```

Source ID/placeholder/registry checks and isolated C storage/helper fixtures do not prove every producer branch ran in the final browser. Missing or invalid source identity remains explicit legacy/unbound evidence; no ID is guessed by matching rendered English. External usernames, authored notes, edited biography, inscriptions, filenames and unsent drafts remain opaque user text.

V3 browser saves replay bootstrap and owned platform/input events to the verified pending request. The optional native message/history sidecars retain observed source provenance under original native save/load semantics; original native blocks and layouts are preserved. These are separate contracts with separate acceptance evidence. Browser cached rendering uses copied facts; original native hallucination/perception/animation keeps its shared RNG and processing order.

The corresponding-source ZIP includes reviewed inputs, original data, changed C/Rust adapters, source snapshots, translation JSON, build/check tools and licenses. Complete translation, all-branch presentation acceptance, optional adapters and a normal full campaign remain open. The Web scope is local HTML/Node verification without external publication.
