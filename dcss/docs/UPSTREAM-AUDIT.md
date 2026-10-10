# DCSS upstream, source and publication audit

Audit date: 2026-10-02. Scope: Dungeon Crawl Stone Soup only.

## Selected upstream

The official download page identifies **0.34.1** as the latest stable release. The selected tagged source is `crawl/crawl`, commit **`1eebc1a2892e1c89776a0d7a10691f8dac8d9796`**, release title “0.34.1: Bugfix release”; the release announcement is dated 2026-03-15 and labels the version 20260314.

Primary references: [official downloads](https://crawl.develz.org/download.htm), [official repository](https://github.com/crawl/crawl), [release](https://github.com/crawl/crawl/releases/tag/0.34.1), [exact commit](https://github.com/crawl/crawl/commit/1eebc1a2892e1c89776a0d7a10691f8dac8d9796).

The source was acquired by the DCSS task owner into `dcss/upstream`, separately from modified port/build files. This audit never executes upstream game scripts. `tools/inventory.mjs` reads tracked source as data and captures exact Git object IDs, worktree SHA-256 values, sizes and dependency pins. Acquisition command/time evidence belongs in the owner's provenance record; this document does not invent a download archive checksum or claim a signed release.

The initial clone has 11,063 tracked superproject blobs totalling 70,420,254 bytes. A Git clone of the superproject alone does **not** include the dependency source: it references 11 pinned submodules. All 11 were subsequently initialized by the owner. Their 6,789 tracked blobs total 181,750,209 bytes, for **17,852 files / 252,170,463 tracked bytes** overall. Every dependency HEAD matches its gitlink and all source worktrees were clean at audit time. `inventory/summary.json` records each actual dependency commit, whether it matches its pin, source size, file count and clean status. `inventory/files.json` and `inventory/submodule-files.json` provide per-file acquisition evidence. These sizes exclude Git metadata and generated build products.

## User plan read from the actual Page

The [ローグライク一般化計画 Page](https://chatgpt.com/space/page_2ca2b2b56c0481919dc6359685d3bf4f) was successfully read through the authorized Pages connector on 2026-10-02. Its title hash at read time was `c442146f3ddc16c303dd765518297b8c031a96bb3ccfbf5aa61295ab2bf34379`; reported sequence was 675. No Page was edited.

The Page specifies logic, display, platform and input layers; replace text output in logic with IDs and render per-ID JSON translations. It explicitly assigns Rust to display, platform and input, prioritizes a web browser, defers a terminal, and requests keyboard/mouse before smartphone/gamepad interfaces. It identifies the existing `C:\Users\kit\gameme\jnethack\jrouge` folder and requires license verification before modification/publication. It does not itself require rewriting the gameplay engine into Rust. Retaining official C++ gameplay during a phased Rust boundary migration fits that plan and preserves fidelity, provided the delivered state honestly describes which boundaries have been converted.

Existing Rogue reference documents read: `rogue-nihon/docs/RUST-LAYERS-TEST-ja.md` and `rogue-nihon/docs/SEMANTIC-SCHEMA-ja.md`. Their semantic entity descriptors and scope-limited verification are useful patterns; their completion claims do not establish anything about DCSS.

## Code and dependencies

Upstream `LICENSE` and `crawl-ref/source/debian/copyright` identify the game as **GPL-2.0-or-later**. Modification and publication are permitted under its terms. Keep copyright notices, the license and disclaimers; identify modified files and modification dates; give browser executable recipients equivalent access to the complete corresponding source and build scripts. A pristine upstream link by itself does not supply source for a modified port. The published bundle should offer its matching modified source, pinned dependency sources and build instructions from the same delivery location.

| Component | Verified license evidence in pristine source | Publication treatment |
|---|---|---|
| Game engine, data, authored descriptions | `LICENSE`; `crawl-ref/source/debian/copyright` | Retain GPL-2.0-or-later notices and source availability |
| PCG RNG | `crawl-ref/source/pcg.cc` header | Apache-2.0-derived portions and MIT-derived bounded-rand portions; preserve both provenance notices; choose a compatible GPL version for the aggregate |
| JSON implementation | `crawl-ref/source/json.cc`, `json.h` | MIT/Expat notices |
| Worley noise | `crawl-ref/source/worley.cc`, `worley.h` | MIT/Expat notices |
| Perlin noise | `crawl-ref/source/perlin.cc`, `perlin.h` | Public domain/CC0 per root notice |
| Domino contributions | `crawl-ref/source/debian/copyright` | BSD-2-Clause notices |
| Platform contributions | `crawl-ref/source/platform.h`; Debian copyright | BSD-3-Clause notices |
| Catch2 testing source | `crawl-ref/source/catch2-tests/catch_amalgamated.*` | BSL-1.0 notices if distributed |
| Lua 5.4.8 | `contrib/lua/src/lua.h` final copyright block; `docs/license/lualicense.txt` | MIT notices, core runtime dependency |
| SQLite amalgamation 3.8.8 | `contrib/sqlite/sqlite3.c`; `sqlite3.h` | Public-domain dedication; retain supplied source header |
| zlib 1.2.8 | `contrib/zlib/zlib.h` | zlib license; origin/alteration marking and notice retention |
| PCRE 8 | `contrib/pcre/LICENCE` | BSD-3-Clause; optional regular-expression backend |
| LuaJIT | `contrib/luajit/COPYRIGHT` | MIT plus embedded third-party notices; optional alternative, unused by default Lua build |
| FreeType | `contrib/freetype/docs/LICENSE.TXT`, `FTL.TXT`, `GPLv2.TXT` | Choice of FTL or GPL-2.0-or-later; choose and retain appropriate notices if used |
| libpng | `contrib/libpng/LICENSE`; header notices prevail on mismatch | libpng license notices if used |
| SDL2, SDL2_image, SDL2_mixer | Each submodule `COPYING.txt` | zlib-style licenses in these pinned versions; do not infer obsolete LGPL from stale root README |
| Webtiles vendor scripts | Individual files under `webserver/*/scripts/contrib/`; SimpleBar headers | Mixed MIT/BSD/zlib notices; inspect actually shipped files |

Paths beginning `contrib/` in the table are relative to `crawl-ref/source`; paths beginning `docs/` are relative to `crawl-ref`.

Two concrete inconsistencies require file-level notices to remain intact. Root `LICENSE` summarizes `inflate.js` as zlib, but the pinned file's own header gives a three-clause BSD notice and JZlib provenance. Root README refers to SDL LGPL, whereas the pinned SDL2-family `COPYING.txt` files use zlib-style terms. The audit records these differences rather than silently rewriting upstream licensing claims.

The PCG Apache/MIT split deserves an explicit aggregate license choice. Upstream allows GPL version 2 or later; choosing GPLv3 for the complete published derivative is available where Apache-2.0 compatibility requires it. Do not replace third-party file notices with a single blanket license.

## Bundled artwork, fonts and audio

The root license says the majority of tiles are CC0 but warns that older artwork has complex licensing. `crawl-ref/source/rltiles/license.txt` describes parts inherited from public-domain RLTiles; this is not proof that every bundled PNG is public domain. The official [crawl/tiles README](https://github.com/crawl/tiles/blob/master/README.md), [artist approvals](https://github.com/crawl/tiles/blob/master/ARTISTS.md) and [unknown-license exclusions](https://github.com/crawl/tiles/blob/master/TILES_UNDER_UNKNOWN_LICENSE.md) distinguish eligible exports from excluded assets. That exclusion list includes older unidentified-owner tiles and NetHack-derived felid tiles. The list is historical and path changes prevent treating a filename-only comparison as a complete clearance audit.

**Permitted initial alternative:** a browser ASCII/grid presentation using ordinary characters and CSS, with no copied upstream tile images, upstream logo/icon, bundled font or audio. This avoids including unresolved artwork in the publication while leaving pristine source available for audit. If graphical tiles are added later, ship only a documented allowlist traced to approved CC0 exports or newly authored assets, with replacement glyphs for anything unresolved. A full upstream tiles directory cannot be labelled entirely free/CC0 on the present evidence.

The pinned fonts submodule contains DejaVu `.ttf`, `.woff` and `.woff2` files but no license file. The [official DejaVu license](https://dejavu-fonts.github.io/License.html) permits redistribution with the Bitstream/Arev copyright and permission notices, restricts reserved names for modified fonts and selling the fonts by themselves. Include applicable notices before bundling those files. Use the browser/system CJK font stack initially. Audio support can accept user-provided files; this does not confer publication rights to arbitrary audio. Audit every audio asset actually included before shipping it.

## Official build requirements and browser distinction

Evidence: `crawl-ref/INSTALL.md`, `crawl-ref/source/Makefile`, `Makefile.obj`, `contrib/Makefile` and `.gitmodules`.

The documented build requires GNU make, a C++11 compiler, Perl, Python 3 with PyYAML and shell utilities. Core runtime dependencies are Lua 5.4, SQLite and zlib. The normal Unix console build uses ncursesw. PCRE is optional; the Makefile chooses it on some platforms. Flex/bison are optional where the checked-in generated level parser suffices. Python generates monster, species, background, form and configuration headers; Perl generates artefact, command and Lua tag tables. The dependencies must remain complete during migration: eliminating Lua would remove vault generation and scripting, and eliminating SQLite/zlib would change data/save behavior.

`WEBTILES=y` builds the original native Webtiles backend/client architecture. It does **not** mean that the entire game engine has become WebAssembly or can run offline in a static Site. A standalone WASM build needs a browser console backend, input suspension/resume, virtual filesystem/data preloading, persistence and adaptations to native OS calls. `NO_NCURSES` alone supplies no replacement console renderer. Compiling a few engine modules is not a full-game build milestone.

## Scope and unresolved publication conditions

Source acquisition and the principal engine/dependency license mapping are complete for the selected version. Optional media submodules also bundle codec sources and example media, whose individual notices must be retained if distributed; the principal-library table is not an exhaustive clearance of those optional payloads. The candidate inventory is a migration planning input, not completed Japanese localization or gameplay parity. Its limitations are recorded in `inventory/summary.json` and `FEATURE-AND-TEXT-INVENTORY.md`.

Publication remains contingent on the owner's matching build, faithful gameplay integration, full required semantic coverage, source availability bundle and browser verification. This audit does not authorize calling a scaffold a complete port and does not provide a Site URL or deployment result.
