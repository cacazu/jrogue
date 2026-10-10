# Japanese gameplay: remaining local verification

Updated 2026-10-02, using actual reports through 18:00 UTC. Delivery now means local HTML with Node/browser tests. Existing external Site publication and audience are historical and remain unchanged.

## Completed checkpoints

The serial 173-unit official C/Lua build passed in 189.465 seconds. Initial native Rust tests passed 49/49 before formatting; formatting and strict offline Clippy passed. The formatted Rust release has been aligned and relinked, and the formatted native retest passed 49/49. Node then passed **67/67** checks on the installed WASM: 47 pure/mock, six compiled platform and 14 compiled semantic checks. See [STATUS.md](STATUS.md) for exact reports, hashes and measured resources.

Installed WASM SHA-256 is `edec818a055454895c9d70cad5358ac211792f636bf7e517eeb7a911e660fc59`. The frozen 3,026-pair gameplay catalog SHA-256 is `c79fe2a3e4b74811bf83c28e6defb63d44b25fb9a610b1931f055b88d11337d4`; metadata SHA-256 is `c726171075c851e0eb7a916b9d2dbceeb1a8e8a6214e3e0f026b10a8d06fd647`. Instrumentation covers 771 message IDs at 786 source sites, 755 public quest descriptors and initial ordinary visible monster/object names. Unsupported compositions and 188 history-only quest synopses retain original English.

The compiled boundary is verified. Live native semantic association, Japanese browser gameplay and full Japanese coverage are not verified. Synthetic formatter envelopes do not establish knowledge-sensitive capture or native producer correctness. The earlier source-only machine-readable checkpoint remains dated until final acceptance status is refreshed.

## Remaining serialized acceptance

1. Verify actual native producer emission against the installed source/artifact hashes. Check ID/argument association after original filtering, helper prefixes, nested emissions, accepted quest groups and public names. Unknown object types, mimics, blind/distant observation, stale buffers and unsupported compositions must expose only the same public information as original output. Original gameplay/name/RNG operations must still execute exactly once.
2. With compiler processes drained and fresh physical/commit headroom checked, run one owned local browser/server at a time. Use the existing all-role integration regression and add actual Japanese producer/name/quest assertions. Exercise all 13 roles, native commands/prompts, PC and mobile controls, real wait/movement, native save-and-quit/fresh restore and final score/log persistence on this new bundle. Repeated language changes and redraws must preserve native hero/world/RNG checksums and consumed-input count.
3. Verify the complete immutable-row quest contract in real callbacks. A paragraph may replace only its exact contiguous accepted original rows with a complete conflict-free public argument union. Missing/filtered/duplicate rows, incompatible attributes or helper context, unsupported qualifiers and formatter errors must display every exact original English row. Native saved history remains the original individual English events.
4. Record the actual browser result, screenshot review, runtime/source hashes, resource measurements and final owned-process cleanup separately from historical phase 2 and synthetic boundary evidence. A failure must remain visible in status; repair and rerun the affected gate before claiming Japanese browser acceptance.
5. Continue broader text-producer coverage. The initial 771-message integration is not full Japanese gameplay. The broader inventory includes 5,984 distinct resolved C text IDs plus dynamic, Lua/data and document surfaces. Complete source-based EN/JA coverage and native visible-name grammar in documented tested phases, keeping unknown/unsupported strings explicit English fallbacks. A source inventory alone cannot establish full mechanics parity or exhaustive campaign coverage.
6. Refresh final machine-readable verification and the exact corresponding-source package/build instructions, retaining NGPL and translation author notices. Deliver and review the owned `nethack` folder locally. Do not change unrelated games or stage/push the shared root Git. No external Site publication or audience change follows this step.

For repeatable local serving, from `nethack/` run:

```sh
node tools/serve-integration.mjs
```

Open **http://127.0.0.1:3000/** and use Ctrl+C to stop. Local IndexedDB saves are origin-scoped. The Node compiled verifier is `node --max-old-space-size=128 tests/browser-host-semantic-compiled-verify.mjs`; its passing report is [browser-semantic-compiled-verification.json](../build/browser-semantic-compiled-verification.json). It runs serially with at most one WASM instance and does not start native gameplay, a browser or a server. Repeating checks is warranted after changes or unresolved failures, not as a substitute for the missing native/browser acceptance.

## Resource and fidelity boundaries

Owned compiler/browser jobs are serialized through the parent's resource gate. Cargo, Emscripten and Binaryen use one job and release codegen units are limited in the task environment; global SDK/security/Cargo settings are unchanged. The initial engine build measured 386.01 MiB kernel-accounted job peak commit and 408.79 MiB sampled process-tree working set. Formatted release alignment/relink measured 359.41 MiB job commit and 380.62 MiB sampled working set; the final Rust test measured 394.11/349.47 MiB respectively. Sampling is not an upper-bound guarantee and unrelated process memory is separate.

The game domain remains original official C. Rust owns the reviewed application/input, presentation and platform boundaries. Semantic IDs come from exact source producers and frozen public arguments, never rendered-English reverse matching or fresh hidden-state/name queries during redraw. Preserve original English filtering/history/sound behavior and original save processing. Keep no-rendering-state/RNG claims scoped to the actual tested evidence.

The historical owner-private English reference at https://jrogue-nethack-500.poromin.chatgpt.site used Site commit `6cf359dc5e615093aacdac09804cebc3909af6a3`. Its 17 actual browser passes and 29 boundary passes remain in [reference-phase2-verification.json](../build/reference-phase2-verification.json); they do not verify this Japanese build. Its audience and deployment remain untouched.
