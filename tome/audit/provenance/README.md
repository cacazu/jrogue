# Tales of Maj'Eyal 1.7.6 acquisition and license audit

This directory contains a read-only source comparison tool and its generated evidence. It does not modify upstream, a Git index, or another game's files.

## Reproduce the comparison

Run with Node 18 or later and Git on PATH:

```powershell
& 'C:\Program Files\nodejs\node.exe' .\compare-upstream.mjs `
  --repo 'C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\git-tag.git' `
  --source 'C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6' `
  --tag tome-1.7.6 `
  --expected-commit 624a67329fe2ad440c5b344785a9c73fcf22ae63 `
  --out .\results
```

Add `--archive PATH --expected-archive-sha256 989dea00803f8cdcade024f4647d480bb1ac0d437c254292c07549c272a4680c` to verify the downloaded archive independently. `--concurrency 4` is the default. The complete JSON lists every tracked blob, its expected Git object ID, its computed release-file object ID, and comparison status. It also lists every release-only file. The tool hashes file bytes with Git's `blob <length>\0` prefix, rather than comparing timestamps or line-normalized text. Windows executable permissions cannot represent Git's executable bit; the original Git mode remains recorded. Symlink blobs, when present, hash link target bytes rather than followed contents. Missing paths and additional release packaging files are reported explicitly rather than silently omitted.

The release stores engine Lua in `game/engines/te4-1.7.6.teae` and game-module Lua in `game/modules/tome-1.7.6.team`; these are ZIP containers. Absence at a raw Git path is therefore a packaging difference and must not be described as missing source. Add `--supplemental-root 'C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\unpacked'` after those packages have been separately unpacked into their Git-equivalent paths. The audit labels matches from this overlay as `unpacked_release_package`. Unopened graphics/music packages remain explicitly unverified; they must not be counted as matching source or assumed absent from the release.

The module also changes its Lua namespace while packing: Git `game/modules/tome/class`, `dialogs`, `ai`, and other root Lua files become release `game/modules/tome/mod/...`. The comparator checks and records that mapping. Git `game/engines/default/modules/boot/...` maps to the separately shipped `game/modules/boot/(mod/)` paths after boot-package extraction. Each mapped result must still have the exact expected Git blob hash. `results-mapped/audit.json` is the final comparison with those documented mappings; `results-elevated` preserves the raw physical archive comparison and `results-unpacked` preserves the initial comparison before namespace mapping. `summarize-audit.mjs` produces exact component, extension, graphics/music, development-exclusion, and unresolved-code inventories from an audit JSON.

## Official source provenance

- [Official source setup](https://te4.org/wiki/Source_Setup) identifies `http://git.net-core.org/tome/t-engine4.git` as the upstream repository. HTTPS Git read access also succeeded.
- `git ls-remote https://git.net-core.org/tome/t-engine4.git 'refs/tags/*1.7.6*'` returned `624a67329fe2ad440c5b344785a9c73fcf22ae63 refs/tags/tome-1.7.6`.
- [Official downloads](https://te4.org/download) lists 1.7.6 as the latest stable version and links [full source](https://te4.org/dl/t-engine/t-engine4-src-1.7.6.tar.bz2) and [source without music](https://te4.org/dl/t-engine/t-engine4-src-1.7.6-nomusic.tar.bz2).
- [Release announcement](https://forums.te4.org/viewtopic.php?t=53983) is dated June 30, 2023.
- The full source archive HTTP HEAD on October 2, 2026 returned 500,085,010 bytes, Last-Modified `Sun, 15 Dec 2024 18:18:15 GMT`, and ETag `"1dceb112-629531664e7c0"`. The archive's modification date is later than the release announcement. Archive identity and Git tag identity must therefore be recorded separately and compared.
- [Tagged game module metadata](https://git.net-core.org/tome/t-engine4/raw/tome-1.7.6/game/modules/tome/init.lua) declares game and engine versions 1.7.6 and carries GPL version 3 or later notices.

## Code, media, and publication

The [official license page](https://te4.org/license) identifies ToME4 and TE4 as GPL 3.0 software but gives graphical, audio, and music assets a Tales of Maj'Eyal-specific use grant. The tagged [COPYING](https://git.net-core.org/tome/t-engine4/raw/tome-1.7.6/COPYING) is GPL v3; the tagged game code states version 3 or later. The tagged [COPYING-MEDIA](https://git.net-core.org/tome/t-engine4/raw/tome-1.7.6/COPYING-MEDIA) restricts media in `/data/gfx` directories to Tales of Maj'Eyal. Do not describe those media as generally free or GPL-licensed.

Preserve upstream copyright notices, COPYING, COPYING-MEDIA, and [CREDITS](https://git.net-core.org/tome/t-engine4/raw/tome-1.7.6/CREDITS). A source-derived Rust/WASM distribution must provide exact corresponding source and build instructions under GPL-compatible terms. A link only to pristine upstream is insufficient for a modified Rust port. Keep original media within its game-specific grant; independently authored SVG/text visuals, no original music/audio, and separately verified font licensing provide a clear alternative when the port's distribution rights for original media are unresolved. Credits alone are not redistribution permissions.

[Official DLC listings](https://te4.org/tome/dlc) identify Ashes of Urh'Rok, Embers of Rage, and Forbidden Cults as paid expansions. The [FAQ](https://te4.org/tome/faq) distinguishes the base game from expansions. Paid status does not establish a code license. Do not include unacquired DLC or infer that its code is free from the base engine license; inspect the actual acquired addon's license separately.

The actual full source archive also ships four addon ZIPs: `tome-addon-dev.teaa`, `tome-items-vault.teaa`, `tome-possessors.teaa`, and `tome-remote-designer.teaa`. Read-only inspection of their `init.lua` files found GPL version 3 or later notices in all four. Items Vault identifies itself as a donator feature; Possessor Bonus Class declares `dlc = 5`. Their runtime access rules do not make these code notices proprietary. This does not establish unrestricted rights to their media or to separately sold expansions. `addon-licenses.json` preserves the actual notices, addon metadata, and package SHA256 values; `inspect-addon-licenses.ps1` reproduces that inspection without executing package code. Remote Designer additionally preserves MIT-style jGrowl/jQuery UI and BSD-style ACE notices.

The GPL/base-source availability statements do not by themselves establish that every third-party library or bundled font has the same license. The release must retain notices for any such components actually redistributed. The upstream CREDITS identifies artwork, shaders, music, sounds, and several separate font suppliers.
