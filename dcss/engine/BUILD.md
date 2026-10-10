# Reproduce installed DCSS V2

Official DCSS0.34.1 is pinned to `1eebc1a2892e1c89776a0d7a10691f8dac8d9796`, with11 pinned submodules. Pristine upstream and original native source are retained. Installed V2 is served at http://127.0.0.1:4186/. Historical source and recovery receipts remain; obsolete backup copies of DATA/WASM that exactly match retained runtime files have been removed. Current runtimes, corresponding source, compiler caches and the full native-EH baseline objects below are retained for execution and rebuilding. Historical receipts describe the original complete backups, whose paths are no longer full runnable bundles.

## Environment and full baseline

Official Emscripten6.0.8 at `C:\Users\kit\emsdk`, SDK Python3.13.3 and SDK Node24.19 are the executed tools. Rust dependencies are locked/offline. Git Perl and pinned PyYAML under engine/python are retained prerequisites. No new installer or credentials were used.

Native-EH baseline `engine/build-jspi-wasm-eh` from `engine/work-wasm-eh` retains original `-fwasm-exceptions` flags including `-DWIZARD`. All333 units include Lua/SQLite/zlib/parser/lexer/generated vault metadata. Baseline manifest SHA `984f8a0abb84db4b6ccea02219b9059b435e1ff96a7dcb818e9c1c0413cf1834`. The alternate Asyncify runtime at `engine/build` is also retained because the browser can select it. Full-graph entry points, from dcss:

The full DATA copy is retained at `engine/build-jspi-wasm-eh/dcss.data`, and the font-free DATA copy at `engine/build-jspi/dcss.data`. Historical native-EH WASM copies with SHA `432ba14e7903ff3678c2c19342917c240f3dc82ce62a121acd7bb9e127671c1e` match `engine/build-jspi-wasm-eh/dcss.wasm`. The complete `engine/history/jspi-js-eh-20261002` bundle is retained because the promotion/recovery helper explicitly uses it.

```powershell
$dcssPython = 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe'
& $dcssPython -X utf8 .\tools\engine-build-jspi-eh.py --check
& $dcssPython -X utf8 .\tools\engine-build-jspi-eh.py --build
```

The official SDK, pinned original source/submodules, generated headers and diagnostic prerequisites are required. These entry points and retained baseline objects do not prove a clean-machine bootstrap or reconstruction of missing objects.

## Installed corresponding-source recipe

`engine/migrations/startup-text-v2` contains the reviewed helper, contract and inputs. Installed contract SHA `3c85c5e3fa78ca223823e822e4a6d8de0b57e47828d2ec306bb94d4cb25a788c`; builder SHA `eac4ce9b861931a685c36b2aa411250a4ab319665e153a7816d798ed3ea3d938`. The actual installed checks used these installed inputs, without task-6 patch paths. From installed dcss:

```powershell
$dcssPython = 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe'
$dcssRoot = (Get-Location).Path
$dcssRecipe = Join-Path $dcssRoot 'engine/migrations/startup-text-v2'
$dcssInputs = Join-Path $dcssRecipe 'inputs'
$dcssContract = Join-Path $dcssRecipe 'source-contract.final.json'
$dcssContractSha = '3c85c5e3fa78ca223823e822e4a6d8de0b57e47828d2ec306bb94d4cb25a788c'
& $dcssPython -X utf8 (Join-Path $dcssRecipe 'build-candidate.py') --check --root $dcssRoot --patch $dcssInputs --assets-root $dcssRoot --contract $dcssContract --contract-sha256 $dcssContractSha
& $dcssPython -X utf8 (Join-Path $dcssRecipe 'package-font-free.py') --check --root $dcssRoot --patch $dcssInputs --assets-root $dcssRoot --contract $dcssContract --contract-sha256 $dcssContractSha --builder-sha256 eac4ce9b861931a685c36b2aa411250a4ab319665e153a7816d798ed3ea3d938
```

Both actual `--check` calls exited0 with empty stderr. Receipt `bec2d44e47d274e11fa87a028e4fd733017d334c12b032517801d101aff38c04` records exact argv and raw-log hashes. First default-context Permission13 baseline-read failures are retained; the successful sandbox-context retry changed no ACL or security policy. The checks compile nothing, start no engine/browser and do not make a clean-machine claim.

The builder verifies all333 baseline source/object/header/generated/flags/compiler receipts and ordered graph. Only zero-based170 `newgame.cc` and181 `output.cc` are replaced, with exact source inverses and unchanged includes. The private synchronous formatter is a link-only library override; public headers and compiler flags are unchanged. Actual V2 reused331 objects, compiled those two units, and linked the complete engine. For a new build, use the helper's reviewed explicit `--build` operation with a fresh `--out`; preserve the actual existing outputs and all receipts. Do not silently replace missing baseline objects.

## Separate font-free repack

`package-font-free.py --check` validates exact candidate/full1,449 payload pins. Its reviewed `--repack` operation preserves WASM and writes fresh JS/data, omitting only unused `docs/quickstart.pdf`. It never promotes. Retain the pristine PDF and full original payload.

The browser console package contains1,448 original files, all143 vaults, help and credits. It contains no tiles, audio, fonts or PDF; Canvas uses system fonts. Preserve code and asset notices separately. Installed JS SHA `8ab83b8a45337b7533095b3f79c02d82a6586b013e4216a4062e132c8250e6ba`; native WASM `d3349cf35f5703c817dc3dc278b16fab162ad6f22af0d4cddf65f66fcd99fcea`; DATA `24a64a7cc59555bffc87225d8b5a79a748de80567cbac8366ba5536b97696fa2`; manifest `0c2f3173a001f88900efa123207cc9168e3e5abcc1dff519f6f587405b1d9513`.

## Executed V2 gates and remaining scope

Actual installed V2 provenance is Rust63/fmt/offline-locked test/Clippy-all-targets-Dwarnings/release; boundary1,730,911bytes/SHA `4085de458f89f9a1e3471d6f0bb55519bb8464818afb7660fcc67d6a6d01c8e1`. Real formatter470, native six runs/36 assertions and locale17 passed. Catalog456 means base135+species94+jobs66+canned45+startup51+HUD22+dynamic43, merged with duplicate-ID rejection; monster803 is separate/unembedded. Parameter-free409 and parameterized47 (scalar32/structured15) describe catalog registration, not whole-game translation.

Native45 display IDs map36 source-site IDs/32 original expression spans. Categories11 fixed controls/12 startup variants/22 HUD include34 parameter-free and11 parameterized IDs; five assigned descriptions are invisible. Weapon-row names/claws/unarmed and actor/species/weapon/quiver/place/welcome/endings retain English.

Authored lightweight129 includes reservation10; independent7 is separate; integrated-placement13 repeats existingFIFO3/reservation10 and is not additive. Ten fresh Chrome cases all exited0,62 labels, aggregate `0e8ba1ff7441622f8f5b649142cfb1e2954e29ab97df938c4abe665fa0332bc7`, runlabel `browser-v2-matrix-20261002-final-r3`, actualOctober2UTC. Named JA/EN cases reach external-name welcome menus and X cancellation; unnamed JA/EN cases complete creation/save/typed quit. Eight receipts expose empty runtimeErrors; core/reference omit that field. Five expected Async exit(0) completion notices are retained.

The actual installed postinstall-smoke-a core run passed all23 original labels with ordinary Chrome compilation/tier-up, separate from the pre-promotion ten-case/62-label matrix. Owned SDK Node18276 exited0; raw evidence SHA87e9c7852a6de998755355bb25aadd9a860e79e7bee309dd183fbb0516675aea and seal SHA c159ce25c6c633e55e70d7107ba5d894c6a9884eae81aee2ebfd40c16da6a50b pin this result. It verifies45 PCG streams, logical resume and the next wait, excluding only diagnostic count/draws. One expected async status0 console notice is retained; runtimeErrors is absent, so no global zero-console claim is made. The original harness partial-canned scope wording is retained; actual V2 scope is45 native display IDs with broad English text remaining.

## Private V3 gate is separate

Actual attempt H passed75 Rust tests with0 failures, fmt, offline/locked Clippy with warnings denied and release WASM. Private boundary1,916,243bytes/SHA `c0a1f65bf3bac63add8a1056877903a51b901384ef92f652f36781506bcf142c` is uninstalled; V2 remains63/4085. The guarded recipe copied42 inputs, including original V2 `tests/reference_rng.json`935,717bytes/SHA `1aeee49b12a7684251eb38d3fe4994e9cde6affc8eb426f619dc18d3ca22bc81`. Original128/RNG69 freezes and all actual A–G failures remain intact; reviewed fixes change only test fixtures and formatting.

**PENDING_V3_NATIVE_AND_BROWSER_GATES**: native canned/history compilation, byte-identical original save/45-PCG comparisons, native-row capture/restore/Ctrl-P and browser flows have not passed at this evidence cutoff. Known repeat/mixed-descriptor/fake-language/legacy-row rendering gaps remain. Do not use a Rust pass as evidence of native rendering.

## Licensing and publication

Upstream GPL-2.0-or-later; new Rust/tools GPL-3.0-or-later; combined GPL-3.0-or-later. Retain bundled-library/PCG/Rust/Emscripten-LLVM notices and matching modified C++/Rust/JS, source-origin receipts/inverses, dependency/data pins and actual recipes. Upstream URL alone is insufficient corresponding source; the local asset server does not automatically expose the full source bundle. Current scope is local HTML/Node/Chrome, without external Sites, new credentials or billing changes.


The parent also visually inspected fresh installed desktop and390x844 screenshots: Japanese HUD captions and wrapper controls are readable; original English actor/title/species/weapon/quiver/place/welcome remains. The mobile wrapper wraps cleanly, map is visible, native terminal pans horizontally/vertically, HUD is offscreen to the right, and lower controls are below the fold. This is desktop emulation, not physical-mobile or native IME evidence.
