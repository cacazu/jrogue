# Cataclysm: Dark Days Ahead upstream audit

Verified on 2026-10-02. This is a read-only provenance and licensing audit. It does not claim that a Rust port or browser deployment is complete, and no upstream code was executed.

## Stable provenance

The official repository is [CleverRaven/Cataclysm-DDA](https://github.com/CleverRaven/Cataclysm-DDA). GitHub's [latest stable endpoint](https://github.com/CleverRaven/Cataclysm-DDA/releases/latest) resolves to [Ito-1, tag 0.I-1](https://github.com/CleverRaven/Cataclysm-DDA/releases/tag/0.I-1). The API reports `prerelease: false`, `draft: false`, publication `2026-09-20T10:46:58Z`. The official [downloads page](https://cataclysmdda.org/releases/) still identifies the stable family as 0.I Ito. Use the newer point release.

- Immutable commit: `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`.
- Commit record: https://api.github.com/repos/CleverRaven/Cataclysm-DDA/commits/0.I-1
- Immutable source ZIP: https://github.com/CleverRaven/Cataclysm-DDA/archive/7b2efa5cea38e4d4d97dd0e63b28b9148623da59.zip
- Immutable source TAR.GZ: https://github.com/CleverRaven/Cataclysm-DDA/archive/7b2efa5cea38e4d4d97dd0e63b28b9148623da59.tar.gz
- Direct codeload TAR.GZ: https://codeload.github.com/CleverRaven/Cataclysm-DDA/tar.gz/7b2efa5cea38e4d4d97dd0e63b28b9148623da59

The saved recursive tree response has `truncated: false`, 10,886 entries, 9,921 regular blobs totaling 938,215,541 uncompressed bytes, and zero gitlink/submodule entries. `.gitattributes` has no LFS filters. The archive therefore captures the complete tracked upstream tree, including code, game data, bundled graphics, bundled Basic sounds, and PO translation sources. It does not include Git history, build toolchains, external sound packs, or dependencies downloaded during builds. Archive byte count and SHA-256 must be recorded by the acquiring agent after download; they are not inferred from tree totals.

The stable Japanese `lang/po/ja.po` blob is 32,023,187 bytes. This confirms substantial existing localization data, but says nothing by itself about current text coverage or semantic-ID readiness.

## Main license and publication

The immutable [README](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/README.md) and [LICENSE.txt](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/LICENSE.txt) license game code and content under **Creative Commons Attribution-ShareAlike 3.0 Unported**, except files carrying other notices. Redistribution and modification are permitted, including commercial use.

For the derived Rust port and Japanese adaptations, preserve author/title attribution, upstream URI, copyright and disclaimer notices, identify changes, and supply the license text or link. License the adaptation under the same license or a permitted later BY-SA license. Do not add terms or technological restrictions that remove recipients' licensed rights; attribution must not imply endorsement. These conditions come from [CC BY-SA 3.0 legal code, sections 3(b) and 4](https://creativecommons.org/licenses/by-sa/3.0/legalcode).

CC BY-SA itself is not a GPL-style corresponding-source mandate. The user separately requires source availability: distribute the actual Rust source and acquisition/build provenance, alongside immutable upstream source and preserved third-party notices. Any dependencies with explicit source obligations must be assessed independently.

## Fonts

| Bundled font | License | Concrete obligation |
| --- | --- | --- |
| `data/font/Terminus.ttf` and `VecTerminus12Medium.otf` | SIL OFL 1.1 | Retain copyright and OFL notice; fonts remain OFL; modified fonts must avoid reserved names absent written permission; cannot sell the font alone. |
| `data/font/Roboto-Medium.ttf` | Apache 2.0 | Preserve license and applicable notices; mark modified files if modified. |
| `data/font/unifont.ttf` | SIL OFL 1.1 and GPL 2+ with font embedding exception, as stated upstream | Preserve licensing and font copyright metadata. Keep fonts unchanged for the first publication, and include the full relevant font notices. |

Evidence: immutable [font inventory and project license](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/LICENSE.txt), [Terminus/Vecterminus OFL notice](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/LICENSE-OFL-Terminus-Font.txt), [Roboto Apache notice](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/LICENSE-Apache-Robot-Font.txt), and [Unifoundry's licensing statement](https://www.unifoundry.com/unifont/index.html). Filename capitalization and the historical `Robot` typo in the license filename differ from prose; use the actual tracked filenames.

## Graphics and audio boundaries

Bundled `gfx` assets fall under the project CC BY-SA 3.0 grant, subject to their specific notices. Preserve each `tileset.txt`, `gfx/MshockXotto+/Credit.txt`, and existing credits; many tilesets refer to individual-sprite author records in the [CDDA-Tilesets repository](https://github.com/I-am-Erk/CDDA-Tilesets). [MSXotto+](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/gfx/MshockXotto%2B/tileset.txt) and [ChibiUltica](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/gfx/ChibiUltica/tileset.txt) explicitly identify their DCSS-sheet sprites as CC0. [UltiCa](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/gfx/UltimateCataclysm/tileset.txt) identifies Yar/I-am-Erk tree contributions. Keep attribution accessible from the web game.

Do not acquire the fuller paid Mushroom Dream tileset as if it were freely licensed: the [tileset maintainers](https://github.com/I-am-Erk/CDDA-Tilesets) distinguish its restrictive Patreon edition from the old BY-SA stub. The immutable DDA source tree contains no Mushroom Dream files. A permitted initial renderer can use glyphs plus unchanged bundled fonts or the tracked RetroDays assets.

The stable source contains only `data/sound/Basic/menu_error.ogg`, `menu_move.ogg`, and their configuration, covered by the project's content grant. Native sound releases fetch an additional pack using an unpinned `git clone` of [Fris0uman/CDDA-Soundpacks](https://github.com/Fris0uman/CDDA-Soundpacks), per the immutable [release workflow](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/.github/workflows/release.yml).

That external pack has a [CC BY-SA 4.0 wrapper license](https://raw.githubusercontent.com/Fris0uman/CDDA-Soundpacks/main/LICENSE.txt), per-file CC0/CC BY SFX credits, and CO.AG music used through a [permission email](https://raw.githubusercontent.com/Fris0uman/CDDA-Soundpacks/main/CO.AG_authorisation.txt). The music permission requires a game-description credit to CO.AG; it is not an unambiguous blanket standardized CC license for all tracks and all derivative uses. Avoid relabeling the entire pack as project BY-SA. For the first publication, use bundled Basic sounds or separately audited CC0 effects; full-pack inclusion needs an immutable pack version plus retained per-file credits and review of the actual music scope.

## Vendored dependencies

The main LICENSE lists Catch (Boost), PLF List/Colony (zlib), getpost (MIT), libbacktrace (BSD), and Zstandard (BSD). Reconcile that list with actual compiled inputs. Additional explicit tracked notices include [Dear ImGui MIT](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/src/third-party/imgui/LICENSE.txt), [Unicode Pinyin data](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/src/third-party/pinyin/LICENSE), [Zstandard BSD](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/src/third-party/zstd/LICENSE), [Flatbuffers Apache 2.0 header](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/src/third-party/flatbuffers/flatbuffers.h), and [ImTui's MIT license](https://raw.githubusercontent.com/ggerganov/imtui/master/LICENSE). Preserve inline stb and wcwidth notices too if those components are included in a C++ bridge. The port should emit a dependency bill of materials from its actual build, rather than assume the top-level license enumerates every component. A standalone Rust reimplementation need not ship unused upstream test/editor dependencies.

## Existing browser build, and limits

There is a **real full-game upstream Emscripten target**, rather than only the separately named JSON formatter target. The immutable [build script](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/build-scripts/build-emscripten.sh) pins Emscripten 3.1.51 and invokes `make NATIVE=emscripten ... cataclysm-tiles.js`. The [CI workflow](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/.github/workflows/emscripten.yml) assembles a `play-cdda` artifact.

The [Makefile](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/Makefile) enables SDL2, SDL image/TTF, Asyncify, IDBFS, BigInt and WebGL 2, with 512 MB initial and 4 GB maximum memory. Browser/mobile memory limits must be measured in actual tests.

The [web preparation script](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/build-scripts/prepare-web.sh) explicitly excludes obsolete mods, the MA mod, and Ultica_iso. It does not copy `lang`, sound packs, or LICENSE files. An unchanged upstream web bundle therefore cannot prove complete system/localization coverage or satisfy all publication notices. It can provide a faithful C++ reference/bridge milestone, but **does not by itself meet the requested four-layer Rust migration**.

The [browser shell](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/7b2efa5cea38e4d4d97dd0e63b28b9148623da59/build-data/web/index.html) declares English, includes English controls, and imports FileSaver.js and JSZip from CDNs. It offers ZIP save export. A Japanese default browser interface needs explicit shell translations and coverage tests; any retained external dependencies need pinned acquisition and notices. Save export alone is not evidence of deterministic save compatibility or mobile input correctness.

## Evidence files

`github-latest-release.json`, `github-stable-commit.json`, `github-stable-tree.json`, and `raw/` retain the fetched official metadata and selected immutable license/build/text files. No archive hash is claimed here. No shared repository writes, Git operations, installer runs, compilation, or Site publication were performed by this audit agent.
