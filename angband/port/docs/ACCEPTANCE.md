# Angband local runtime acceptance

This record describes matching final-engine runtime evidence. `verification.json` is the authority for the complete local milestone: package/source guards and the packaged-browser run must also pass before `milestoneVerified` is true. Original Angband gameplay remains C under the actual plan; Rust owns the separated input/application/presentation/save responsibilities in `MIGRATION.md`.

Read the pinned upstream, build timestamp, source fingerprint and exact JavaScript/WASM/game-data hashes from `../build/manifest.json`. Read the corresponding-source ZIP hash/size and retained fixture inventory from `../build/package-manifest.json`; hashes are referenced rather than embedded in a source archive containing this document. Final verification rejects failed, pending, unstable or different-engine evidence.

| Matching source/runtime evidence | Passed |
| --- | ---: |
| Rust | 257 |
| Node/source | 274 |
| Actual compiled WASM descriptors | 54 |
| Chrome PC/mobile viewport and input | 30 |
| Additional store/item/spell/throw-save/death flows | 24 |
| Ordinary original-command play through natural native death | 11 |
| Remaining presentation, pending restore and Japanese TXT download | 27 |
| Original native hallucination and multihued animation fixture | 13 |
| Wizard-assisted Sauron/Morgoth winner, crown, retirement and score rejection | 13 |

The packaged local HTML run and complete package acceptance are recorded separately in `verification.json` and `build/package-manifest.json`; source/runtime rows alone do not claim the whole packaged milestone is verified.

The ordinary play run uses no wizard commands, cheats, native memory writes or synthetic native state. It enters a normally generated first dungeon, exercises actual combat and exact saved/restored continuation, and reaches original fatal HP and death UI. Its maximum depth is one; it does not establish a long campaign or normal complete100-level victory. Both the endgame and native-perception fixtures are explicitly wizard-assisted and unranked.

The remaining-presentation run verifies original recall/count/header/navigation/Japanese search, second-sheet known matrices and pending restore, native keyboard/mouse context selection, selected look prose, chronological birth/user-note rows, known-monster metadata, and a complete source-bound Japanese UTF-8 character download containing the full opaque name/note. Cached redraw/locale changes do not repeat the download. These are representative source-selected paths, not every conditional producer branch.

The native-perception fixture preserves pristine original perception processing and shared RNG calls. Original hallucination redraw consumes native RNG and replays exactly. Original multihued animation keeps its order before monster processing; total-turn RNG also includes monster/world effects. Cached browser repaint/font/viewport/locale changes remain pure over copied facts and all 38 RNG words. No original game processing is removed to obtain purity.

Bounded isolated actual-C evidence remains separate:

- History serializer/sidecar/custom-formatter fixture: 3,441 checks, 1,328 strict-prefix rejections, 240 actual native formatter ordinals and 21 current input pins. Original `z-form.c`, `z-util.c` and `z-virt.c` execute unchanged. The unsupported `%zu` widget format rejects, and the source observer's supported `%lu` preserves typed row metadata. Rust review and message-storage boundaries are explicit stubs.
- Recall fixture: 2 tests use the original native queue/save/load, ownership/coalescing/eviction and all 38 RNG fields. Formatter/platform-I/O boundaries retain their documented fixture scope; current input/output pins must match.
- Look fixture: 386,910 assertions across 22,528 condition cases, 625 coordinate cases and eight contracts. The semantic sink and naming allocator are mocked; no full game/browser runs in this fixture.

The reviewed EN/JA/schema catalogs have 8,197 identical keys. Eight requested presentation families are source-connected; authored catalog agreement and executed sample paths do not establish complete translation. Current remaining endpoints and limits belong to `../migration/coverage-audit.json` and `COVERAGE-AUDIT.md`, superseding historical missing-family lists.

V3 saves reconstruct the original process from bootstrap and owned platform/input events at supported pending waits, preserving native facts, all 38 RNG words, source/cache evidence and opaque drafts. Optional native recall/history provenance sidecars have separate bounded storage proofs; original native blocks remain unchanged. Missing provenance is explicit legacy/opaque text, malformed sidecars reject atomically, and incomplete Japanese exports reject. Usernames, custom notes, edited biography, inscriptions and external names remain untranslated.

Original English ASCII output remains visible alongside Japanese semantic panels, and the native English character-file output remains intact. Unexecuted matrix/context/look/history/knowledge/export/chest variants, negative capacity and legacy paths, custom data, optional sound/tiles/secondary-terminal/gamepad adapters, arena and normal long campaigns remain limits. `completeRequestedPort`, `completeCoverage` and normal `complete100Levels` stay false.

The user-defined Web scope is local HTML served with Node at `http://127.0.0.1:4173/web/`. No external publication is performed. GPL corresponding source, original copyright/license notices and dependency notices remain part of the package. Heavy jobs are serialized and sampled at 20ms; brief peaks may be missed. Matching measured records and exact final counts remain in `tests/source-integration-evidence/` and `verification.json`.
