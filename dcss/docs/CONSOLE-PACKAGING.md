# Reproduce the font-free console payload

The installed `engine/build-jspi` bundle contains 1,448 files and all 143 official vault files. It now includes the single source-selected native Japanese weapon prompt. It omits exactly one unused printable PDF from the frozen 1,449-file console package. The data-only repack preserves its selected candidate's WASM; the earlier one-unit semantic build has its own changed WASM hash. The pristine source, original Asyncify output and complete native-EH baseline retain the original PDF.

The current omission receipt is [console-startup-payload-omission.json](../licenses/console-startup-payload-omission.json). [console-payload-omission.json](../licenses/console-payload-omission.json) records the first font-free baseline package. The separate read-only source/font audit is [console-pdf-audit.json](../licenses/console-pdf-audit.json). The audit predates packaging and intentionally records that it ran no packager or engine. The omission receipts and artifact manifests record the later actual packaging. Neither document alone is runtime proof.

## Exact omission and supported help

Only `docs/quickstart.pdf` is excluded: 80,328 bytes, SHA-256 `07d56a1cd908293a6f556aa2898d616699c035ee2cca6891b75168fa1fba76ab`. `quickstart.md`, generated `quickstart.txt`, `CREDITS.txt` and every vault remain byte-identical to the baseline package.

At the pinned commit, `crawl-ref/source/command.cc:441–452` selects `quickstart.txt` with `^`; `_get_help_section` at `:1321–1358` reads the help table as text. `Makefile:1473–1474` and `util/gen-all.py:90` copy Markdown to the text file. A read-only scan of 2,222 pinned text/code files found no native runtime literal reference to this PDF. `source/util/docs/README.tex:65` recommends printing it. Arbitrary user Lua can still attempt arbitrary filesystem paths; the receipt covers the original ordinary-help route.

The PDF embeds six Type1 font subsets. Five URW subsets contain a GPL notice and a document-embedding exception. The CMSY10 subset identifies ©1997 American Mathematical Society; permission text was not recovered from its embedded header. No proprietary status is asserted. Omitting this unused document avoids distributing that incomplete font audit. The active 1,448-file package has no graphics, audio, font or PDF assets. This statement does not cover the preserved original/legacy 1,449-file outputs.

## Repository-contained commands

Run from the `dcss` repository directory. The current helper is `tools/font_free_startup_package.py`, SHA-256 `52e44e62ea2ed5b8d13de2b862401b2899b3c13fa08df2074257d38b167ec921`; no task-6 authoring path is needed. Use the installed Emscripten **6.0.8** SDK and its Python **3.13.3**; change the SDK variable if the verified installation was relocated.

```powershell
$dcssSdk = 'C:\Users\kit\emsdk'
$dcssPython = Join-Path $dcssSdk 'python\3.13.3_64bit\python.exe'
& $dcssPython .\tools\font_free_startup_package.py --root . --sdk $dcssSdk --check
```

That command is read-only preflight. It checks the fixed incremental candidate `engine/candidates/startup-weapon`, the immutable native-EH baseline, exact transformed source/bridge/formatter receipts, all 333 ordered link objects with 332 reused and one recompiled, original payload `engine/build/data` and exact omission. It requires the reviewed native-exception flags and one-ID schema, rather than accepting arbitrary incremental manifests. Legacy JS-EH artifacts do not satisfy those checks.

To create a separate candidate data package, choose a **new directory below `tools`**:

```powershell
& $dcssPython .\tools\font_free_startup_package.py --root . --sdk $dcssSdk `
  --output .\tools\font-free-startup-package-20261002 --repack
```

The helper rejects an existing output or any output outside its own `tools` directory. Its default output is `tools/generated-startup-font-free`. It never deletes or overwrites `engine/build/data`, baseline objects, pristine source or installed active artifacts. It creates a retained-file `payload` and separate `artifacts` directory. Promotion to `engine/build-jspi` is a distinct reviewed operation after verifying the generated candidate and its runtime evidence; this helper does not promote it.

The older `tools/font_free_console_package.py` remains available for the immutable 333-object baseline at `engine/build-jspi-wasm-eh`. Its default new output is `tools/generated`; its command reproduces the historical baseline font-free package, not the native weapon-prompt candidate. Do not point that older full-object schema validator at the incremental manifest.

Portable one-unit build/package recipes and their 23 corresponding-source files are now installed under `engine/migrations/startup-weapon`. Both independent read-only checks passed without compiling, linking, packaging or running a newly reproduced engine. From `dcss`, the current original candidate can be checked with:

```powershell
& $dcssPython .\engine\migrations\startup-weapon\reproduce-startup.py --root . --check
& $dcssPython .\engine\migrations\startup-weapon\reproduce-font-free-package.py --root . `
  --candidate engine/candidates/startup-weapon --sdk $dcssSdk --check
```

The portable build defaults to a new `engine/candidates/startup-weapon-reproduced` directory. The portable packer defaults to that reproduced candidate and a new child output under the migration directory, while the fixed tool above accepts the current original candidate and writes below `tools`. Neither recipe promotes output. The full native-EH baseline remains mandatory; these recipes reproduce the reviewed one-unit delta and font-free packaging. Read-only success does not claim a fresh clean-machine build or runtime proof for future output.

The helper invokes the official SDK's `tools/file_packager.py`. It replaces only the unique generated preload include, using its matching end marker. Remaining JS prefix/suffix bytes and line endings are preserved; the WASM is copied unchanged. No compilation or link is needed. The auxiliary `dcss-data.js` is a packaging receipt and is already included in `dcss.js`; do not load it a second time. Five authored tiny LF/CRLF loader-boundary tests passed before packaging; those tests did not execute the engine or SDK packager.

This process is byte-preserving for retained payload files and records actual generated hashes. A different SDK/packager, changed source baseline or new engine cannot reuse the 2026-10-02 output hashes as proof.

## Recorded outputs — 2026-10-02

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| Active `dcss.js` | 341781 | `b7ca47bc893ff9677161f9690c95195168116ad9397a4050664607dd338c53e1` |
| Candidate `dcss.wasm`, unchanged by repack | 12618378 | `366ca002895a92cdac5031b469c83008d9e399077661f872513db528a2e92246` |
| Active `dcss.data` | 12521230 | `24a64a7cc59555bffc87225d8b5a79a748de80567cbac8366ba5536b97696fa2` |

The retained sorted-name inventory hash is `0bb3d9daeab40aa12485f758019a9fa8d1107df921a1d71766de0880e227fef2`. The source candidate's original data is 12,601,558 bytes, SHA-256 `45829be50686e2d101666e027d0418f884ef5f34d8bdbded1198ad724da8094d`; its original JS is 341,756 bytes, SHA-256 `4ba0d454b90e58846c51adaf4102c83eea8459e1fd86f27016f6db68df749df5`. The first native-EH baseline and its browser proofs retain their earlier hashes under their own manifests. The current incremental manifest pins the immutable baseline plus the single replacement and all 333 ordered link objects.

## Runtime and source-availability gate

The first font-free artifact and the 17-check 1,449-file ordinary-browser baseline remain historical proofs for their exact hashes. The current native-prompt artifact has its own eight actual Japanese Node smoke checks, five fresh-process resume checks and 18 ordinary-Chrome checks, including bare-root Japanese/CJK startup and bundled quickstart help. Seventeen paired/cross-locale comparisons match all exposed fields and all 45 RNG streams/counts. Four controlled original-engine flows also passed on these exact current hashes: combat8, branch10, death4 and victory4. They are controlled fixtures, not an unassisted complete playthrough. Do not silently transfer earlier browser results. See [STATUS.md](STATUS.md) for the current runtime matrix and remaining Japanese/system checks.

The exact-artifact browser receipt now verifies ordinary quickstart help, startup/input, full checkpoint/reload and following-command determinism, all 45 RNG streams, source-tagged semantic observation, redraw neutrality and terminal handling. Controlled combat/branch/death/victory gates also have current-artifact evidence. Preserve the original PDF and baseline output hashes. Whole-game Japanese coverage, broader system/control paths and native text-entry/locale work remain distinct open gates. `release_ready: false` in the packaging manifest records that the packaging helper made no runtime/release decision; runtime receipts are separate and do not make the incomplete Japanese migration complete.

The full licenses and corresponding modified source/build recipes are local in this `dcss` folder. The localhost server serves browser/runtime directories, not the entire source/license tree. Its official-upstream link is not a matching-source download endpoint for a future hosted binary release. Any later distribution must provide the exact modified corresponding source, third-party notices and reproducible build/package steps. No external Site is involved in the current local HTML/Node scope.
