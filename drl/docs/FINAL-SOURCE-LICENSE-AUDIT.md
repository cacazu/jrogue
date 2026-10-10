# Final core source and notice audit

Historical read-only review recorded at 2026-10-02 19:49 UTC. This reviews local source selection and notices for the original-core module available at that time; it does not certify gameplay, browser execution or publication. No compiler, Cargo, browser or archive-building process was launched. Only this document was written.

The retained open source licenses cover the selected runtime families. No incompatible open source runtime license was identified in this historical review.

Current disposition: the deployed browser-verified pair remains original core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60` and Rust `54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e`, with 15 primary checks, six separate bounded combat/autorun checks and eight native death/report/profile checks. The historical 13-check/core6b8 milestone is retained separately. Dated notices cover 72 changed upstream GPL files, and [final notice retention](FINAL-NOTICE-RETENTION.json) passes 56 permission files plus exact selected Sun/Arm headers for core20e21. The source selection includes the state-probe tree, exact link evidence/map and selected math notices.

The verified corresponding-source reconstruction baseline is ZIP SHA-256 `881cff21b198f6f9cfe3f24ed9674586d719c18147f1b99978667be64b9b45b2`: **27,630 files / 545,460,758 source bytes**, ZIP **166,497,281 bytes**, matched to original core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`. Every decompressed archive entry passed full hash readback. Fresh whole extraction restored the 26,172-file FPC baseline and verified all 13,776 linked-source mappings; all 23 Cargo packages resolved offline from the restored vendor tree. [The clean-build receipt](SOURCE-CLEAN-BUILD-EVIDENCE.json) verifies a fresh 139-source original-game compile and Rust adapter build without copying game objects or an existing game WASM. External pinned standard compiler/units/libraries were reused; full toolchain bootstrap remains unverified.

The original core rebuild is byte-exact. Rust rebuilt as `dbec616a8d1a9021eb75242121e99b37c45fde280a760cc63518e2730dc3c02e` rather than deployed `54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e`, so the raw receipt retains `result: compiled-artifact-differs`, `clean_compile_verified: true` and `adapter_byte_exact: false`. [The strict adapter audit](CLEAN-RUST-ADAPTER-DIFF.json) passes: all instruction opcodes/locals match, every changed operand/address maps to the same logical data target, and only dependency source-location strings, their lengths, static-address relocations and zero padding account for the 512-byte difference. [Actual clean-pair Chrome](CLEAN-SOURCE-BROWSER-EVIDENCE.json) then passes all 15 primary checks, with [six-image visual QA](CLEAN-SOURCE-VISUAL-QA.json); its measured job peak was **602,259,456 bytes**. This proves the bounded tested reconstructed game flow, not full world/campaign/text coverage.

Historical source milestone: the first nonlaboratory archive for core6b8 contained 27,571 files / 543,888,352 source bytes, ZIP 166,288,072 bytes, SHA-256 `b5ff2c3aa0e2347f31af37ae7742656e2cf06f779afd1b74119cebe420c93aed`. It passed entry hash readback and is retained as earlier evidence, separate from the reconstructed 881/core20e21 baseline.

The coordinator is preparing a final authored recipe/evidence recut containing the corrected workflow helpers, frozen prose/status and added gates/receipts. It preserves the compiled core/source closure and does not yet have an asserted final ZIP identity here. Use the exact [source-bundle receipt](../port/dist/source-bundle.json) for the resulting download; the 881 archive above is the baseline actually reconstructed and tested.

The following audit findings retain their **19:49 UTC historical identities**. Their old laboratory-ZIP/missing-notice observations are not claims about the verified 881 archive or the current notice pool.

## Historically reviewed artifact and evidence

| Item | Independently checked identity or recorded result |
| --- | --- |
| `core-adapted/build/browser-core/drl-core.wasm` | SHA-256 `941236c0fe884dbbf7415855c50d6acf5baaa2ff70cf7f41ce68c534a713a65c` |
| `core-adapted/build/browser-core/drl-core.map` | SHA-256 `9460c3f6b212fb47a93fc14144ecb1e6fe2feb9afd9fb025d21f595e514f4de2` |
| [Final link evidence](../core-adapted/build/browser-core/link-evidence.json) | 2026-10-02 19:37:41 UTC; unchanged source/archive snapshots; 139 resolved compiled-source records; zero unresolved records |
| [Allocator audit](CORE-ALLOCATOR-AUDIT.json) | PASS; 126 selected libc members, six allocator references; no independent libc allocator selected |
| `port/dist/build.json` | Associates the local delivery with the same final core hash |
| [Current source plan](core-source-package-plan.json) | 2026-10-02 19:16:45 UTC; 27,543 files, 535,097,582 input bytes; identifies older core `d6d60f8b953a339bffaa0fcba5cae3bcd73d239022de71d3f0f252255ae29e3d` |

All 139 final compiled-source paths are represented by the existing selection or its linked-source mappings. That is path coverage, not an assertion that the old plan's bytes correspond to the final module. Comparing the plan hashes against the final link snapshot found 28 differing packaged inputs. Eight are compiled adapted source files: `dfhof.pas`, `drlmainmenuview.pas`, `drlmoreview.pas`, `drlplayerview.pas`, `drl_c_allocator.pas`, `drl_lua_varargs.pas`, `vbrowserconsole.pas` and `vtig.pas`. Other differences include generated manifests, localization inputs and authored probes. A fresh plan is required.

## Historical corrections identified before source delivery

1. **Add dated modification notices to changed GPL source files.** [DRL GPL-2.0 section 2(a)](../upstream/drl/LICENSE) requires modified files to carry prominent notices identifying the change and its date. The reviewed adapted `drl/src/dfhof.pas` and `drl/src/drlplayerview.pas` retain the original copyright header without such a notice. Modified `drl/bin/data/drl/main.lua` starts with code and likewise lacks one; its bytes differ from pristine upstream. The aggregate adaptation/localization records identify changes but do not put a dated notice into these files. Add a deterministic Pascal or Lua comment to changed GPL files during generation, retain original notices, then take a fresh build/source snapshot. No notice is needed on unchanged pristine copies merely because they are packaged.

2. **Replace the laboratory source ZIP and regenerate its identity.** The existing `port/dist/source.zip` is 85,128 bytes with 36 entries under `drl-rust-migration/`. Read-only ZIP inspection found no original core, adapted core, Lua C, linked runtime sources or `SOURCE-BUNDLE.json`. Nevertheless, `port/web/game.html` links to it as corresponding source. Use the current [original-core planner](../tools/package-core-source.mjs) and [verified streaming writer](../tools/write-core-source-zip.ps1) after source changes settle. The fresh `source-bundle.json` must identify the exact final module, and the downloadable ZIP must contain that plan's selected source. The writer already rejects changed input hashes; the old plan must not be reused. Existing upstream links supplement the package; they do not provide this adapted core's complete source.

3. **Include the forthcoming state-probe source and recipes.** At the recorded audit, the planner's explicit tree list omitted `experiments/state-probe`. Its current 14 authored files are absent from the old plan: eight owner includes (`dfbeing`, `dfdata`, `dfplayer`, `drlbase`, `drlmultimove`, `vpath`, `vrandom`, `vrltools`), `drlstatewriter.pas`, `drlcontrolcapture.pas`, `platform-state-witness.mjs`, its test, `rng-fixture.lpr` and `writer-fixture.lpr`. The root subsequently added this tree to source packaging and checkpoint selection; regenerate the plan to capture it. None is a compiled record in the reviewed module, so this omission does not retroactively invalidate the current module's 139-source coverage. The selection fix supplies the offered generation inputs and diagnostic recipes when those authored seams are integrated.

4. **Finish the selected-math notice record.** The retained musl `COPYRIGHT` describes third-party math authors, but the current notice pool does not contain the exact selected Sun permission notices. The reviewed ZIP also lacks those sources. Preserve the headers listed below with the binary/source delivery, either through complete corresponding source that actually accompanies it or a selected-math notice file. A notice file beside the game makes the grant explicit even when recipients do not open the source ZIP. Arm's MIT family is covered by the retained musl MIT text and its Arm attribution; preserving the individual source headers is still the clearest exact-object record. The corrected source plan already selects the full pinned math source tree, so no new source acquisition is needed.

5. **Include final link evidence in the source manifest or archive.** `tree('core-adapted')` excludes its `build` directory. The planner reads `link-evidence.json` into limited `core` metadata but does not package that JSON or `drl-core.map`. Its manifest contains archive hashes and compiled-source records, but not the final C archive-member list. Retain the map/evidence or a compact selected-member/source/notice mapping associated with the final core hash. This fulfills the project's [source-release packaging contract](source-release-plan.md); a link map is not, by itself, a separately required GPL source file.

The new audit document itself will be picked up by the existing `docs` tree selection when the plan is regenerated. `port/licenses/core/manifest.json` currently remains `final_link_map_reviewed:false`; [package-core-notices.mjs](../tools/package-core-notices.mjs) also hard-codes that state. Complete the selected-object record and refresh delivery copies without treating the allocator audit alone as a license audit.

## Actual selected C source families

Direct map parsing found these archive members. An archive passed on the command line is not assumed to contribute code merely because it is available.

| Selected archive | Members | Source/notice treatment |
| --- | ---: | --- |
| `drl-lua-bridge.a` | `bridge.o` | Authored adapter source, recipes and manifests are selected under `experiments/lua-wasi`; retain its integrated GPL release treatment. |
| `lua5.1.a` | 24 Lua objects | Pristine Lua source is included from the native selection, prepared/modified C under `experiments/lua-wasi/lua-src`; exact Lua 5.1.5 MIT notice is retained. |
| `libc.a` | 126 | Exact WASI libc source pin `2e6fb9d8ee0cdf9e431fbcabe8af3115de000a13`; musl MIT/inherited notices and cloudlibc BSD notice are retained. Selected math specifics follow. |
| `libsetjmp.a` | `rt.c.obj` | Exact WASI setjmp source and wasi-libc/musl licensing envelope are retained. |
| `libclang_rt.builtins.a` | `multi3.c.obj` | Exact compiler-rt source pin `895aa2c896ada719451be2e3673c83da8ddf1141`; source and full Apache-with-LLVM-exceptions license are selected. The retained text includes the embedded-object and GPLv2 conflict provisions. |
| `libwasi-emulated-process-clocks.a` | none found in this map | Its source/build recipe is still conservatively supplied; no extra embedded member is asserted. |

The selected Sun math files are under `upstream/wasi-libc/libc-top-half/musl/src/math/`:

- Copyright 1993: `__cos.c`, `__rem_pio2.c`, `__rem_pio2_large.c`, `__sin.c`, `acos.c`, `asin.c`, `atan.c`, `atan2.c`, `cos.c`, `expm1.c`, `log10.c`, `sin.c`, `tan.c`.
- Copyright 2004: `__tan.c`.
- Each of these files preserves the Sun permission grant requiring preservation of its notice; `__rem_pio2.c` also credits Bruce D. Evans's optimization.

Selected Arm MIT headers, copyright 2018, are `exp.c`, `exp_data.c`, `log.c`, `log_data.c`, `pow.c`, `pow_data.c`. The other selected math files carry no separate copyright grant at their beginning and fall under the retained musl envelope; this statement does not replace source preservation.

The reviewed selection has no `qsort.c.obj`, TRE `regcomp.c.obj`/`regexec.c.obj`, `fts.c.obj`, or independent `dlmalloc.c.obj`. Therefore, no missing embedded qsort/TRE/fts/dlmalloc notice is inferred from their mere presence in the SDK. Their retained notices and full upstream source are conservative extras.

## Source and notice coverage present at the historical review

The generator supplies the pinned full FPC source companion, exact linked mutable RTL/package sources under `linked-source/`, the original/adapted Pascal and Lua code, browser/Rust source, source locks, build/restore scripts, all 23 locked Cargo archives and matching Rust library source/notices. Source restoration is part of the offered recipe; this review did not run a clean rebuild or extraction. Preserve the existing runtime-source mappings rather than replacing them with only the unmodified FPC archive.

The notice pool already retains DRL GPL-2.0, ChaosForge/Valkyrie MIT, Lua MIT, MT19937, FPC modified-LGPL and exception texts, imported LazUtils/Unicode and Paszlib notices, musl/cloudlibc/WASI licenses, compiler-rt's complete exceptions, Rust crate and standard-library notices. Optional native library notices in that pool do not mean those native libraries were embedded.

The six FMOD/Steam SDK-derived binding files are explicitly excluded by both adaptation and source selection. No FMOD/Steam runtime was selected by the reviewed C map. Original ASCII files are source-selected separately; the delivery includes the full CC BY-SA 4.0 text, ChaosForge/upstream links and actual UTF-8 credits for Derek Yu and Łukasz Śliwiński. The packaged ASCII files are identified as unmodified. No additional proprietary-asset restriction was established by this review.

At the historical review, the required corrections were change/date notices, the authored probe tree, selected math grants, and regenerated plan/archive identities. The later source archives and final-notice receipt address those recorded deficiencies. The 881/core20e21 baseline now has full entry readback, fresh reconstruction, clean game/Rust builds, conclusive adapter-difference audit and actual clean-pair primary Chrome evidence. Final authored recipe/evidence recut and coherent source links remain; full toolchain bootstrap, full world/campaign/text and wider death/profile/rank branches remain separate and incomplete. One exercised native death/report/profile/storage flow now passes eight actual checks.

[The actual native death/report/profile receipt](ORIGINAL-DEATH-RUNTIME-EVIDENCE.json) passed **eight checks at 2026-10-02 23:31–23:32 UTC** on deployed core20e21/Rust54931. A bounded observed-door/hostile route and physical waits reached zero HP and the Japanese death prompt; native `DSFinished` produced the mortem with the exact full external character name and Japanese body/version markers. Native memorial writing changed and committed mortem, profile and score files. The hall of fame respected its original 17-byte name field. The original flow returned to the Japanese menu with no live player and opened the player profile; fresh original instances reloaded the exact persisted native files, score and profile, then returned to the Japanese menu. This closes that exercised death/report/profile/storage flow, not every death/rank/challenge branch or exact killer attribution.

The death receipt preserves concrete localization findings: the native `Post mortem` title (`drlbase.pas:1583`) and footer `<上,下> scroll, <左,右> pages, <Enter,Escape> exit` (`drlpagedview.pas:68`) retain English text. The known Japanese death/mortem phase guards pass independently; complete localization, full-world state, campaign/win/challenge coverage and exact killer attribution remain false/unverified. Screenshot capture is recorded by the actual receipt; independent visual review remains a separate record.
