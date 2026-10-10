# Preserved DRL core dependency licenses

The preserved Pascal/Lua browser route can use open source dependencies, provided its release carries the actual notices and corresponding source. ChaosForge's engine MIT notice does not relicense bundled interfaces, proprietary SDKs or native runtime binaries. This audit examines the pinned files and the newly built WASI dependencies; it does not certify a final game artifact that has not yet linked successfully.

Audit date: 2026-10-02. DRL commit `a6f965072b3a25b768c91dbced00367f1b57d865`; fpcvalkyrie commit `f89735a741a968997656c2d48a003ec569db7f22`; FPC commit `843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d`. The earlier [native selection](native-source-manifest.json) omitted **28 Pascal/include files**: all 27 files in `fpcvalkyrie/libs/`, plus `fpcvalkyrie/lua/lua.pas`. The [machine audit](../toolchain/acquisition/dependency-licenses/core-dependency-license-audit.json) records their individual SHA-256 hashes, sizes, notice matches and selection status. No original source was modified or copied into the native selection by this audit.

## Actual binding files

Each row below was inspected in the pinned engine tree. None contains a separate permission/license header. The observed root license is [MIT, copyright 2016 ChaosForge](../upstream/fpcvalkyrie/LICENSE). The external notice column identifies additional provenance or permissions to retain/review; it does not assert that the runtime is bundled or that an external grant covers every Pascal translation.

| Relative engine file | Interface | File-specific notice and treatment |
| --- | --- | --- |
| `libs/vfmodconst.inc` | FMOD | No notice; proprietary SDK provenance unresolved; exclude unused interface from published browser subset. |
| `libs/vfmodlibrary.pas` | FMOD 2.2.23 | `FMOD_VERSION=$00020223`; loads FMOD native library; same restriction. |
| `libs/vfmodtypes.inc` | FMOD | No notice; same restriction. |
| `libs/vgl15calls.inc` | OpenGL 1.5 | No notice; retain engine MIT and any applicable Khronos header notice if derived. |
| `libs/vgl15types.inc` | OpenGL 1.5 | No notice; same treatment. |
| `libs/vgl15vars.inc` | OpenGL 1.5 | No notice; same treatment. |
| `libs/vgl21calls.inc` | OpenGL 2.1 | No notice; same treatment. |
| `libs/vgl21types.inc` | OpenGL 2.1 | No notice; same treatment. |
| `libs/vgl21vars.inc` | OpenGL 2.1 | No notice; same treatment. |
| `libs/vgl33calls.inc` | OpenGL 3.3 | No notice; same treatment. |
| `libs/vgl33types.inc` | OpenGL 3.3 | No notice; same treatment. |
| `libs/vgl33vars.inc` | OpenGL 3.3 | No notice; same treatment. |
| `libs/vgl3library.pas` | OpenGL loader | No notice; loads OS OpenGL library; no OS driver/runtime redistribution is implied. |
| `libs/vluaconst.inc` | Lua 5.1 | Line 4 has the 1994-2006 Tecgraf/PUC-Rio copyright constant; preserve it and the actual Lua 5.1.5 MIT notice. |
| `libs/vlualibrary.pas` | Lua 5.1 | No permission header; includes the Lua constant/types; statically links `lua5.1.a` unless configured dynamically. |
| `libs/vluatypes.inc` | Lua 5.1 | No notice; preserve engine and Lua notices. |
| `libs/vsdl3const.inc` | SDL 3 | No notice; preserve engine and applicable SDL zlib notice. |
| `libs/vsdl3library.pas` | SDL 3.2.20 | Version constants specify 3.2.20; preserve engine and applicable SDL zlib notice. |
| `libs/vsdl3types.inc` | SDL 3 | No notice; the metadata copyright property is an API constant, not a license grant. |
| `libs/vsdl3imagelibrary.pas` | SDL_image 3.2.4 | No notice; preserve engine and applicable SDL_image zlib notice. |
| `libs/vsdl3mixerlibrary.pas` | SDL_mixer 3.1.0 prerelease | No notice; native mixer excluded; exact translated-header revision not established. |
| `libs/vsteamconst.inc` | Steamworks | No notice; no Valve SDK redistribution grant observed; exclude unused browser interface. |
| `libs/vsteamlibrary.pas` | Steam API 1.62 | Explicit 1.62 comment; loads Steam API native library; same treatment. |
| `libs/vsteamtypes.inc` | Steamworks | No notice; result-code names mentioning licenses are API constants, not permission. |
| `libs/vstormconst.inc` | StormLib | No notice; retain engine MIT and applicable upstream StormLib MIT if derived. |
| `libs/vstormlibrary.pas` | StormLib loader | No notice; loads StormLib native library, which is not included in the browser route. |
| `libs/vstormtypes.inc` | StormLib | No notice; same treatment. |
| `lua/lua.pas` | Older Lua 5.1 binding | Line 36 has the 1994-2006 Tecgraf/PUC-Rio copyright constant; preserve it and the actual Lua MIT notice if distributed. |
| `src/vcursesconsole.pas` | ncurses renderer | No permission header; root engine MIT; FPC ncurses binding has its own retained notice below. |
| `src/vcursesio.pas` | ncurses input | No permission header; same treatment. |

[Lua 5.1.5 COPYRIGHT](../upstream/lua-5.1.5/COPYRIGHT) grants MIT permission, copyright 1994-2012 Lua.org, PUC-Rio. Keep that complete notice with the WASM/source release; the older constant in the Pascal interfaces is not a replacement. The authored integer-width and allocator adapters must also be included in the corresponding build source.

The official [SDL 3.2.20 notice](https://raw.githubusercontent.com/libsdl-org/SDL/release-3.2.20/LICENSE.txt) and [SDL_image 3.2.4 notice](https://raw.githubusercontent.com/libsdl-org/SDL_image/release-3.2.4/LICENSE.txt) are zlib licenses: retain their notices in source distributions, mark altered source and do not misrepresent origin. These release notices were downloaded and hashed. SDL_mixer's [current notice](https://raw.githubusercontent.com/libsdl-org/SDL_mixer/main/LICENSE.txt) is also zlib, but this does not establish the exact prerelease header used for the pinned Pascal interface. Native SDL libraries and their codec dependencies are excluded from the browser build.

The [current Khronos OpenGL header](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Registry/main/api/GL/glcorearb.h) uses an MIT notice; this confirms a permitted source for API declarations but does not establish the derivation of the older Pascal declarations. The [official StormLib notice](https://raw.githubusercontent.com/ladislav-zezula/StormLib/master/LICENSE) is MIT, copyright 1999-2013 Ladislav Zezula. Neither runtime is needed for a Rust browser display/input platform.

FMOD is a concrete native dependency restriction. Its [EULA](https://www.fmod.com/legal), updated 2026-08-14, restricts redistribution of SDK files; native engine redistribution is conditional and requires attribution. No FMOD SDK/runtime grant was acquired here. The Pascal binding's root MIT notice cannot establish rights to SDK-derived content. The browser release should exclude FMOD SDK files, binaries and unused binding declarations, and use its own silent/audio adapter. If a translated FMOD interface must be published, resolve its provenance and permission first.

Steamworks' [official SDK page](https://partner.steamgames.com/doc/sdk) distinguishes API headers from redistributable native binaries and describes Steam features as optional apart from uploading to Steam. It does not supply an open source license for the SDK, and no Valve agreement was acquired. Exclude Valve SDK/runtime payloads and unused Steam declarations from the browser distribution. This finding concerns that optional integration; it does not block the standalone browser route.

The actual FPC `packages/ncurses/src/ncurses.pp` contains a complete permissive notice, copyright 1998-2012,2013 Free Software Foundation, with an additional restriction on using the copyright holders' names in promotion. It explicitly links `ncursesw` and C. Preserve this notice if that binding is distributed. No ncurses package/runtime was built into the WASI toolchain milestone.

## Compiled Pascal runtime and packages

The FPC compiler is GPL v2 according to the pinned source. Compiling the game does not by itself put compiler code into it. The RTL/package license has a separate independent-module linking exception. The complete texts are present at `rtl/COPYING.txt` (LGPL 2.1), `rtl/COPYING.FPC` and `packages/COPYING.FPC`; [retained copies and hashes](../toolchain/acquisition/dependency-licenses/core-dependency-license-audit.json) are available outside the generated build tree. Keep per-file version/exception notices where they differ from this general package statement.

| Built WASI component | Actual source notice |
| --- | --- |
| RTL, including WASI startup/System/SysUtils/Classes | Modified library GPL with independent-module exception; per-file authors/notices remain. |
| `rtl-objpas` | FPC `COPYING.FPC` references; preserve source notices. |
| `rtl-generics` | FPC/NewPascal notices, including Maciej Izak and DaThoX; references `COPYING.FPC`. |
| `rtl-unicode` | Mixed FPC and imported LazUtils notices; see below. |
| `rtl-extra` | FPC runtime/package exception; preserve source notices. |
| `hash` | FPC authors and `COPYING.FPC`; SHA1 includes FPC 2009-2014. |
| `paszlib` | Original zlib plus Pascal translation zlib-style notices, and FPC exception on wrapper units. |
| `fcl-base` | FPC component-library notices and `COPYING.FPC`. |
| `fcl-xml` | FPC component-library notices; DOM includes Sebastian Guenther 1999-2000 and Sergei Gorelkin 2006. |

The exception allows linking independent modules under their own licenses; it does not remove license duties for modified library source. Any adapted FPC startup or runtime source must retain its notices and be supplied with the build recipe. Distributing the compiler executable or an RTL/package source bundle has its own obligations, even when the browser does not download those development tools.

`rtl-unicode/src/inc/graphemebreakproperty.pp` explicitly states Library GPL v2-or-later plus the independent-module exception, copyright 2021 Nikolay Nikolov. `rtl/objpas/unicodedata.pas` has Inoussa Ouedraogo's 2013 library-GPL notice with an object/library source-distribution exception. `rtl-unicode/src/inc/utf8utils.pp` says it is from LazUtils and references `COPYING.modifiedLGPL.txt`; it also identifies UnicodeData.txt as a table source. The referenced [Lazarus modified-LGPL notice](https://raw.githubusercontent.com/fpc/Lazarus/main/COPYING.modifiedLGPL.txt) and library-GPL-v2 text were acquired, hashed and retained. The exact imported LazUtils source revision is not established; these current external text copies explain the referenced exception, not a new source pin.

The [Unicode data license](https://www.unicode.org/license.txt) permits redistribution with the copyright/permission notice in copies or associated documentation. Keep a Unicode notice if data-derived units survive the final link. The acquired current notice is Unicode License v3, copyright 1991-2026; the final unit inventory must identify the data version and preserve any older notice already carried by its generated data/source. The engine MIT notice cannot replace Unicode attribution.

For Paszlib, `zbase.pas` carries original zlib copyright 1995-1998 Jean-loup Gailly and Mark Adler, and Pascal translation copyright 1998 Jacques Nomssi Nzali. The package readme's legal section extends the translator notice to 1998,1999,2000 and provides the three zlib-style conditions. `zstream.pp` separately references `COPYING.FPC`, copyright 2007 Daniel Mantione. Retain both permission texts and distinguish their units; do not label the entire package solely LGPL or solely zlib.

## Actual WASI SDK 34 dependencies

The Lua ABI experiment acquired official SDK34 sysroot and compiler-rt archives, documented in [toolchain-acquisition.json](../experiments/lua-wasi/toolchain-acquisition.json). The [official SDK git tree](../toolchain/acquisition/dependency-licenses/wasi-sdk-34-tree.json) pins the component source revisions below. The [download manifest](../toolchain/acquisition/dependency-licenses/manifest.json) records exact URLs, byte counts, SHA-256 hashes and HTTP status for the acquired notices. Hashes of tag/current-branch notice downloads identify the retrieved text; they are not asserted to be immutable Git commit pins.

| Component | Exact source identity and license envelope |
| --- | --- |
| WASI SDK34 build files | Commit `5a0bf653a1a06e1c18867567c5937006d3394a69`; Apache 2.0 with LLVM exceptions. |
| wasi-libc | Submodule `2e6fb9d8ee0cdf9e431fbcabe8af3115de000a13`; root offers Apache 2.0 with LLVM exceptions, Apache 2.0 or MIT; inherited component notices remain. |
| LLVM/compiler-rt builtins | Submodule `895aa2c896ada719451be2e3673c83da8ddf1141`; Apache 2.0 with LLVM exceptions; retained file also describes the legacy NCSA/MIT license. |
| GNU config build helper | Submodule `f992bcc08219edb283d2ab31dd3871a4a0e8220e`; build helper, not shown to be embedded in the browser WASM. |

The actual C and mixed-Pascal experiment link commands select `libc.a`, `libsetjmp.a`, `libwasi-emulated-process-clocks.a` and `libclang_rt.builtins.a`. They do not select C++ libraries. The sysroot is development material rather than a file to publish with the browser. Its archives can embed these separately licensed components:

| libc component | Retained primary notice and required distinction |
| --- | --- |
| musl | MIT, Rich Felker and listed contributors; COPYRIGHT lists additional permissive math, regex, sort and other source notices. Keep the full notice, plus applicable per-object notices. |
| cloudlibc | BSD 2-Clause; keep copyright, conditions and disclaimer in distributed documentation/materials. |
| dlmalloc | Doug Lea's public-domain/CC0 notice in exact `dlmalloc/src/malloc.c`. |
| emmalloc, if selected | MIT/NCSA Emscripten notice in exact `emmalloc/emmalloc.c`; not assumed to be selected merely because available. |
| musl-fts, if linked | BSD 3-Clause, copyright 1989,1993 Regents of the University of California; keep notice and nonendorsement term. |
| WASM setjmp runtime | Exact `libc-top-half/musl/src/setjmp/wasm32/rt.c`, selected by the pinned CMake file; no separate permission header; retain wasi-libc/musl licensing envelope. |

Use the offered MIT option for wasi-libc's own contributions while retaining these original third-party notices. Compiler-rt's [exact license](https://raw.githubusercontent.com/llvm/llvm-project/895aa2c896ada719451be2e3673c83da8ddf1141/compiler-rt/LICENSE.TXT) includes both an embedded-compiler-object exception and an explicit provision addressing conflicts when combined with GPLv2. Therefore, this dependency is not treated as an ordinary Apache-2.0-only GPLv2 blocker. Retaining the complete acquired license in the release notices is the straightforward conservative packaging choice.

## Release requirements and remaining evidence

The local HTML/WASM deliverable should supply DRL's GPL-v2 license and complete corresponding source for the original/adapted Pascal/Lua core and integrated browser glue, with build scripts, source locks and modification notices. Retain ChaosForge engine MIT, actual Lua MIT, applicable FPC/LazUtils exceptions, Paszlib notices and selected WASI third-party notices. Provide source access beside the locally delivered game. External Sites/deployment is outside the user's clarified scope.

Exclude proprietary audio/Steam SDKs and native binaries, unreviewed upstream sound/music/fonts, and unrelated commercial game assets. Rust display/input/storage/audio adapters with system fonts and authored or cleared content provide the permitted alternative. The separate [provenance and asset audit](PROVENANCE.md) governs game graphics/audio; this document adds core/toolchain dependencies.

The final game link map and publication bundle remain unreviewed here. Before deploying the game, use that map to list the actual selected Pascal units and C archive members, append their file-specific notices (notably musl math/regex/sort if present), and verify the source/notices bundle against the deployed WASM hash. If optional FMOD or Valve SDK-derived interfaces are included, their unresolved provenance must first be addressed or the interface replaced/excluded. No overall open-source-core license incompatibility was established by this audit, and no game deployment is asserted.
