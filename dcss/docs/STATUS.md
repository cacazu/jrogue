# DCSS installed V2 status — 2026-10-03

V2 is installed and served at http://127.0.0.1:4186/ after its final ten fresh Chrome cases passed. Actual promotion preserved V1, installed corresponding source, and verified served bytes and isolation headers. Both installed read-only recipe checks passed. This record keeps installed V2 distinct from private future V3.

## Source and coverage

Official DCSS 0.34.1 is pinned to `1eebc1a2892e1c89776a0d7a10691f8dac8d9796`, from [crawl/crawl](https://github.com/crawl/crawl), with 11 pinned submodules. Acquisition recorded 17,852 tracked files and 252,170,463 bytes. Pristine upstream, original native source and unrelated games remain intact. Complete C++ rules and 45 persistent PCG streams remain authoritative; Rust separates logic contracts, application/input, display and platform. See [ARCHITECTURE.md](ARCHITECTURE.md).

The EN/JA catalogs contain 456 IDs each: 409 without parameters and 47 with parameters (32 scalar, 15 structured). The native whitelist contains 45 display IDs: 34 without parameters, 11 with parameters. Categories are 11 fixed startup controls, 12 startup variants and 22 HUD labels; the startup variants include an empty-parameter welcome. These 45 IDs map to 36 source-site IDs and 32 original expression receipt spans, not 45 physical C++ call sites. Five assigned startup descriptions are invisible in the console menu. Weapon-row names, claws and unarmed remain English; `startup.weapon.row` is prepared but unwired. Separate 803 monster-base IDs are not embedded coverage. These counts do not measure whole-game Japanese completeness.

## Installed V2 artifact pins

Installed root: `C:\Users\kit\gameme\jnethack\jrouge\dcss`. These installed pins match the browser-verified trial; the private V3 boundary is recorded separately below.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `engine/build-jspi/dcss.js` | 356,834 | `8ab83b8a45337b7533095b3f79c02d82a6586b013e4216a4062e132c8250e6ba` |
| `engine/build-jspi/dcss.wasm` | 12,630,409 | `d3349cf35f5703c817dc3dc278b16fab162ad6f22af0d4cddf65f66fcd99fcea` |
| `engine/build-jspi/dcss.data` | 12,521,230 | `24a64a7cc59555bffc87225d8b5a79a748de80567cbac8366ba5536b97696fa2` |
| `engine/build-jspi/manifest.json` | 286,802 | `0c2f3173a001f88900efa123207cc9168e3e5abcc1dff519f6f587405b1d9513` |
| `build/boundary.wasm` | 1,730,911 | `4085de458f89f9a1e3471d6f0bb55519bb8464818afb7660fcc67d6a6d01c8e1` |

FIFO coordinator SHA-256: `0946f78a49d743215dc0314424645434082b1caa4fe6321775db0b3e0ab2c02d`. Shared formatter bridge: `9022a9315843100420ee3126a7d0932fe63c57ff7ee33c16092eb8ef25a56567`; library: `0979aa461f79006587e5c38c04a74a4a677d6632848ef85109b8b61672ad37fa`. Reviewed source contract: `3c85c5e3fa78ca223823e822e4a6d8de0b57e47828d2ec306bb94d4cb25a788c`.

## Actual verification

| Gate | Recorded result |
|---|---|
| Rust | fmt, 63 tests, offline/locked all-target Clippy with warnings denied, release WASM: PASS. |
| Real Rust formatter | 470 probes: PASS. |
| Complete native build | 331 verified objects reused, units 170/181 compiled, all 333 linked: PASS. |
| Font-free package | 1,448 original payload files and all 143 vaults retained: PASS. Only unused quickstart PDF omitted; pristine PDF retained. |
| Native Node matrix | Six actual runs, 36 assertions: PASS. |
| Locale parity | 17 comparisons: PASS. |
| Authored lightweight suites | 129 checks: PASS. Includes the ten save-reservation checks. |
| Independent FIFO models | Seven separate mocks: PASS. |
| Integrated repeat placement | 13 checks: PASS. Repeats the existing FIFO 3 and reservation 10 at the integrated placement; not additive to 129. |
| Final Chrome matrix | Ten fresh cases, all exit 0, 62 check labels: PASS. |

Final Chrome label is `browser-v2-matrix-20261002-final-r3`. Actual execution was 2026-10-02 UTC; parent session 9789 ended exit 0. Aggregate SHA-256 is `0e8ba1ff7441622f8f5b649142cfb1e2954e29ab97df938c4abe665fa0332bc7`; input-pins SHA-256 is `07885bb0619137d9e77695ce44b6c9f4a6c9b82805d8f3622fe6b3a3240c4d4b`. Counts are core 23; four named/unnamed JA/EN startup cases, one each; combat 8; branch 10; death 4; victory 4; reference 9. These labels are not a sum of every individual assertion executed by the system. Named JA/EN startup cases reach genuine external-name welcome menus and X cancellation. Unnamed JA/EN cases complete character creation,save and typed quit. Eight dynamic/controlled results expose empty runtimeErrors arrays; core/reference omit that field. Five expected Emscripten Async exit(0) completion console notices are retained; no blanket zero-console-errors claim is made. NativeCore.error=null is separately tested.

The branch/save/restore witness preserved the old `(session 1, native sequence 1)` and established resumed session 2 with baseline sequence 0. A new `game.canned.no_spells` observation `(2,1)` was accepted. No original event was replayed into C++ on restore. Native comparisons check recorded exported state, ordered 45 PCG states/increments and checkpoint witnesses; they are not a parser of every C++ save field.

Visual review receipt `dcss-light-work/r4-visual-review.json` is pinned to `170a2e7f26536544b74dec2dd6db04375d81c520ad785dabb621a08ecdf4026d`. The parent inspected fresh desktop, 390px, death and victory PNGs. Japanese HUD captions are readable. Actor title/species, weapon/quiver/place/welcome and endings remain English. At 390px outer controls wrap cleanly; the fixed native terminal pans horizontally and vertically, HUD starts off the right edge and controls remain reachable through page scrolling. Death/victory use controlled WIZARD fixtures and original ending screens. Physical mobile, IME and an unassisted campaign remain unverified.

## Actual installation and separate V3 gate

Parent operation-d completed exit0 on 2026-10-03. Receipt SHA `a3f61d629643d3a671fc35645d1a3683474e7014008867e9a7bd780a0583deb7` records installed/resumed status and preserved `engine/history/text-v2-promotion-63dab3fbe5cd49d693634d99b3d8fccd`. The inventory has160 entries,118 changed and42 retained;115 source operations and4 bundle operations include retained DATA and must not be summed as119 changed files.

Recorded owned Node PID50252, created `2026-10-03T00:57:25.3912843Z`, owns127.0.0.1:4186. After promotion page HTTP200/3510bytes and manifest HTTP200/286802bytes matched manifest `0c2f3173a001f88900efa123207cc9168e3e5abcc1dff519f6f587405b1d9513`; COOP=same-origin and COEP=require-corp. This docs stage did not start or query the server.

Installed build-candidate.py and package-font-free.py `--check` both exited0 with empty stderr, receipt `bec2d44e47d274e11fa87a028e4fd733017d334c12b032517801d101aff38c04`. They use installed migration inputs, without task-6 patches. The first default-context Permission13 read failures are retained; the successful retry changed no ACL or security policy. These are source-recipe checks, not a C++ rebuild or clean-machine bootstrap. Independent post-install read-only review accepted2583 checks/541 hashed paths, receipt `38a7155c41e876a2158f8b8c7aaa4959585aca89c3d4f41ceb3f183a5076ac08`.

The actual installed postinstall-smoke-a core run passed all23 original labels with ordinary Chrome compilation/tier-up, separate from the pre-promotion ten-case/62-label matrix. Owned SDK Node18276 exited0; raw evidence SHA87e9c7852a6de998755355bb25aadd9a860e79e7bee309dd183fbb0516675aea and seal SHA c159ce25c6c633e55e70d7107ba5d894c6a9884eae81aee2ebfd40c16da6a50b pin this result. It verifies45 PCG streams, logical resume and the next wait, excluding only diagnostic count/draws. One expected async status0 console notice is retained; runtimeErrors is absent, so no global zero-console claim is made. The original harness partial-canned scope wording is retained; actual V2 scope is45 native display IDs with broad English text remaining.

Private V3 attempt H actually passed fmt,75 Rust tests with0 failures, offline/locked all-target Clippy with warnings denied, and release WASM. Verifier receipt `4f53573c3aed9f5c71a82db3290797962c8e18c4dd2a381a7b7497c3f7a0c054` and raw75-test output establish this result. Its boundary is1,916,243bytes/SHA `c0a1f65bf3bac63add8a1056877903a51b901384ef92f652f36781506bcf142c`, private and uninstalled. The installed V2 boundary remains4085/1,730,911bytes and its actual Rust gate remains63 tests.

Failures A/B preceded Cargo; C lacked a nested WinPS5 cmdlet; D omitted the original RNG fixture and ran zero tests; E ran75 with68 passed7 failed due to two canonical fixture literals; F ran75 with74 passed1 failed because its malformed-surrogate mutation was a no-op; G failed fmt before tests. H corrected only reviewed test fixtures and formatting, preserving production code and original128/RNG69 inputs. All prior raw evidence is retained. The parent actual-gate seal SHA `7ac603c27d249c26e60de732d1916fe09afd8a83de342bf188b2b276354afd78` confirms the completed raw receipts. Its initial base135-as-aggregate456 metadata assertion failure is retained separately; all seven merged catalogs actually total456 and are byte-identical to V2.

**PENDING_V3_NATIVE_AND_BROWSER_GATES**: canned45/native-row sidecar has not been compiled or exercised in the original engine/browser in this evidence snapshot. Known mixed-descriptor, fake-language and legacy-row rendering gaps remain. See [V4-SOURCE-PLAN.md](V4-SOURCE-PLAN.md).

This milestone is local HTML/Node/Chrome. No external Site, physical-device result, unassisted campaign or complete Japanese port is claimed. Preserve GPL corresponding source and asset/library notices; [BUILD.md](../engine/BUILD.md) records the executed recipe and limits.


The parent also visually inspected fresh installed desktop and390x844 screenshots: Japanese HUD captions and wrapper controls are readable; original English actor/title/species/weapon/quiver/place/welcome remains. The mobile wrapper wraps cleanly, map is visible, native terminal pans horizontally/vertically, HUD is offscreen to the right, and lower controls are below the fold. This is desktop emulation, not physical-mobile or native IME evidence.


