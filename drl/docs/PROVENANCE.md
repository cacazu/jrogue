# DRL provenance and redistribution boundary

This checkpoint records acquired source and its licensing boundary. Preserve the original FreePascal/Lua gameplay core; Rust provides display/input/platform adapters and reference verification only. It does not establish a complete browser adaptation or authorize publication of the current verification surface. Last updated: 2026-10-02.

## Locked upstream inputs

| Input | Official source | Immutable revision | Locally reported SHA-256 |
| --- | --- | --- | --- |
| DRL | [chaosforgeorg/drl](https://github.com/chaosforgeorg/drl) | Latest non-prerelease [0_10_11a](https://github.com/chaosforgeorg/drl/releases/tag/0_10_11a), commit `a6f965072b3a25b768c91dbced00367f1b57d865` | Git archive: `a79b5606bfec57babcba724a47bfcf1b5b71bb0f1d90719904a910af17af5c82` |
| FPC Valkyrie | [chaosforgeorg/fpcvalkyrie](https://github.com/chaosforgeorg/fpcvalkyrie) | Matching engine tag [0_10_11](https://github.com/chaosforgeorg/fpcvalkyrie/tree/0_10_11), commit `f89735a741a968997656c2d48a003ec569db7f22` | Git archive: `0ac9ecdeeee938cc8f37baaffc3b6b6838bd6066da479abf7df9d0111dade3c2` |
| Lua | [Official Lua 5.1.5 tarball](https://www.lua.org/ftp/lua-5.1.5.tar.gz) | Version `5.1.5` | Downloaded archive: `2640fc56a795f29d28ef15e13c34a47e223960b0240e8cb0a82d9b0738695333` |

DRL release metadata reports publication at **2026-08-24T20:12:27Z**. The official repository tree was independently inspected at the exact commit; the archive digests above were supplied by the implementation owner after local acquisition. They are recorded as measured owner evidence, not a second independent hash check by the documentation task. Lua was initially extracted without execution; its original C runtime subsequently passed authored WASI ABI/error/coroutine probes in Node and Chrome. No upstream installer or unknown executable was run for the audit.

The DRL tree snapshot is nontruncated: **274 files / 33,607,601 bytes**, with **55 Pascal files / 928,959 bytes** and **83 Lua files / 825,844 bytes**. These are repository file sizes, not compressed archive sizes. There are no gitlinks or `.gitmodules`; FPC Valkyrie is separately acquired. Core/module engine and save version declarations are `0.10.11`. The README's version `0.10.0` wording is stale.

The upstream [CI workflow](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/.github/workflows/ci.yml) checks out mutable Valkyrie `development`. This project locks an explicit matching release tag instead. That is an auditable input choice, not proof that the official release binary used exactly this engine revision. The native recipe requires Free Pascal/Lazarus and Lua 5.1; it can build WAD rules from source.

Pristine acquisitions remain separate from adapted source and Rust display/input/platform code. The destination is the existing local workspace `C:\Users\kit\gameme\jnethack\jrouge\drl`; its spelling is intentional. The initial checkpoint was copied and hash verified; continuing original-core integration changes still require synchronization. Other games and the shared Git index are outside this task's ownership.

## License boundary

| Material | License/evidence | Distribution decision |
| --- | --- | --- |
| DRL Pascal/Lua code | [README](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/README.md) grants GPL 2.0; [LICENSE](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/LICENSE) supplies the terms. | Preserve notices and document changes. The original-core browser adaptation and distributed WASM need GPL-compatible licensing and accessible complete corresponding source, including build scripts. Do not assert a later-version grant without supporting notices. |
| Original and additional graphics | Derek Yu and Łukasz Śliwiński; CC BY-SA 4.0 in README and [graphics LICENSE](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/bin/data/drl/graphics/LICENSE). | Only vetted art is eligible. Retain attribution/license/source links and changes; adaptations share alike. Trademark rights are not granted. |
| FPC Valkyrie | [MIT](https://raw.githubusercontent.com/chaosforgeorg/fpcvalkyrie/0_10_11/LICENSE), copyright ChaosForge. | Preserve its notice if code is reused. |
| Lua | [MIT](https://www.lua.org/license.html). | Preserve exact bundled version notices if shipped; source extraction alone does not mean the browser port bundles Lua. |
| Original MIDI and sounds | [Manual credits](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/bin/manual.txt) name id Software. No general open-asset grant was found. | Excluded from public repository and browser output. |
| HQ audio and special-level tracks | Manual credits Sonic Clang and Per Kristian Risvik as used with permission; Simon Volpert tracks have no separate open grant in audited notices. | Excluded until a suitable downstream grant is established. |
| FMOD and Steam native binaries | Upstream itself contains `fmod64.dll`, `libfmod.so`, `steam_api64.dll` and `libsteam_api.so`. [FMOD licensing](https://www.fmod.com/licensing) treats distribution as project licensed. | Excluded from public repository and browser output. No new FMOD/Steam license, account or billing setup is authorized. |
| Other native binary/font payloads | Exact third-party grants require separate inspection. | Browser system/CJK fonts and native-free adapters avoid shipping unreviewed payloads. |

The full native package's [installer notice](https://raw.githubusercontent.com/chaosforgeorg/drl/0_10_11a/install/install_license.txt) retains a freeware redistribution condition requiring the author to be informed. That notice is not a substitute for the code's GPL grant or a blanket open license for audio. This project does not redistribute the original native binary package or contact upstream without explicit authorization.

The source repository's four audio directories contain placeholder readmes rather than audio files. Its CI imports audio from earlier `0_10_9a` release ZIPs. The gameplay/rules source is available, but the entire multimedia/runtime bundle is not an entirely free source distribution.

The permitted browser alternative preserves mechanics with ASCII/CSS/canvas and system fonts, silent audio or newly authored tones, and optional vetted CC BY-SA graphics. Removing restricted audio does not excuse removing gameplay systems. Pristine archives and trees, including proprietary binaries, must stay ignored/private. The final source/build package should contain adapted original Pascal/Valkyrie/Lua source, Lua C runtime where bundled, Rust display/input/platform code, translations, licenses, tests and reproducible build scripts. A blanket public commit of pristine upstream would redistribute excluded binaries.

## Recorded evidence and current limits

`source-lock.json` records the machine-readable baseline. The source audit has REST snapshots (`drl-pinned-tree.json`, `drl-release-and-dependency.json`) and selected plain-text source/notices in `audit-input/`. The sanitized `native/` baseline preserves 305 original Pascal/Lua/C/help/license files (3,486,100 bytes), with zero gameplay modifications; [native-source-manifest.json](native-source-manifest.json) records hashes. Pristine acquisition hashes are available; no native original run, full-game comparison, original-core browser gameplay test or deployed Site has been established at this checkpoint. The implementation owner reports 69 passing Rust laboratory tests, a built laboratory WASM and seven Chrome desktop/mobile adapter checks; these are reference/adapter checks, not original-core completion. Earlier tool stalls recovered. [ORIGINAL-CORE-WASM.md](ORIGINAL-CORE-WASM.md) records the remaining compiler/runtime/ABI gate and official sources.
