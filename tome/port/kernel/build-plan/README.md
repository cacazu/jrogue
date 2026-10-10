# Exact original C-kernel Emscripten dependency plan

The machine-readable plan is `output/emcc-build-manifest.json`. `output/sources-ready.json` is the smaller compile-input manifest; `objectPlan` records every source's absolute path, compiler, include paths, project-specific definitions, flags, and unique object destination. `output/archive-link-plan.json` records the original static-library grouping and link order. `output/source-list.txt` records all source paths. `output/lua-registry.json` records actual native initialization order and source implementations. `output/include-inventory.json` records direct and transitive source include evidence; raw preprocessor branches are explicitly not treated as selected requirements.

The plan reads actual `premake4.lua`, `build/options.lua`, and `build/te4core.lua`, verifies every selected pattern exists in those definitions, expands against acquired source, and records source hashes. No Premake/Lua/game code or repository installer runs. Outputs are isolated under this directory.

```powershell
& 'C:\Program Files\nodejs\node.exe' .\make-build-manifest.mjs `
  --source 'C:\Users\kit\gameme\jnethack\jrouge\tome\upstream\t-engine4-src-1.7.6' `
  --emsdk 'C:\Users\kit\emsdk' `
  --out .\output
```

Use `--sources-only true` to generate source/flag input without the later header/registry scan. Compile C translation units with `emcc`, the WFC C++ translation unit with `em++ -std=c++11`, and link with `em++`. Do not compile the entire C source list as C++.

| Original project | Translation units |
|---|---:|
| TEngine, all original `src/*.c` | 23 |
| PhysFS, bundled zlib, archivers, Unix/POSIX platform | 27 |
| Lua default interpreter | 30 |
| LuaSocket Unix branch | 13 |
| FOV | 1 |
| LPeg | 5 |
| LuaProfiler | 5 |
| libtcod import | 1 |
| Expat | 5 |
| LXP | 1 |
| Lua MD5 | 4 |
| Lua zlib binding | 2 |
| Lua BitOp | 1 |
| bzip2 | 7 |
| WFC, C++ | 1 |
| utf8proc | 1 |
| **Total** | **127: 126 C + 1 C++** |

The upstream option defaults to LuaJIT2; this plan explicitly selects the architecture-independent default interpreter. Its 30 files contain no Lua/luac CLI. Optional Steam, Discord library, Awesomium, CEF, native Mac/Windows platform sources, and LuaJIT projects are excluded. `discord-te4.c` remains in the exact kernel wildcard but is disabled by an unset `DISCORD_TE4`; `web.c` remains an original core wrapper even though optional browser-engine projects are excluded.

The original core version definition is `TE4CORE_VERSION=17`. Preserve original common `GLEW_STATIC` and release `NDEBUG=1`, kernel `TENGINE_HOME_PATH=".t-engine"`, PhysFS `PHYSFS_SUPPORTS_ZIP`, and Expat `HAVE_MEMMOVE`; scoped definitions are supplied per translation unit. Common includes are the ten source directories listed in the manifest. Root's measured full-core probe uses `SELFEXE_LINUX` and `_GNU_SOURCE`; those diagnostic target selectors are recorded separately from original build definitions. Root reported successful compilation of all **127 original translation units**, comprising 23 core files and 104 mandatory dependencies, with Emscripten 6.0.8. The absent SDK `GL/glx.h` path is not described as a compiler blocker: original compilation passed.

Build each of the fifteen dependency projects as a normal static archive with `emar rcs`; link those archives with the 23 kernel objects. Do not eagerly link every dependency object or enable `--whole-archive`: core and LuaSocket both provide `auxiliar` symbols, and the upstream Premake build relies on lazy archive extraction. Root's faithful archive link then reported exactly eleven unavailable graphics-platform symbols. The independently authored adapter under `graphics-adapter/` supplies them, along with a replacement for the installed SDK's runtime-aborting texture-size query. Its objects compile; combined engine link and real browser execution remain parent-owned evidence.

The existing SDK snapshot is Emscripten 6.0.8. Its cache contains SDL2, SDL_image, SDL_ttf, OpenGL/GLU, OpenAL, libpng, Vorbis, POSIX socket and pthread headers. The [official settings reference](https://emscripten.org/docs/tools_reference/settings_reference.html) documents SDL2/image/TTF and libpng/Vorbis/Ogg ports; the manifest supplies matching flags. Bundled zlib already comes from the PhysFS project, so avoid adding another directly compiled zlib implementation. Native Windows/OpenGL shared-library link flags do not apply to browser output.

`probe-physfs-platform.mjs` performs only preprocessing with the installed standard Clang target. `output/physfs-platform-probe.json` proves `wasm32-unknown-emscripten` defines `unix`, `__unix`, `__unix__`, and `__EMSCRIPTEN__`; unchanged `physfs_platforms.h` consequently selects `PHYSFS_PLATFORM_UNIX` and `PHYSFS_PLATFORM_POSIX`. Compile `platform/unix.c` and `platform/posix.c`; no false `__linux__` define or platform-header patch is required. Set `PHYSFS_NO_CDROM_SUPPORT` for the browser's non-disc platform. `PHYSFS_NO_THREAD_SUPPORT` is optional only after verifying all users are single-threaded; native kernel workers presently exist.

Native Lua initialization calls `lua_open`, then `luaL_openlibs`, then 23 unconditional module opens: PhysFS, core, FOV, socket, MIME, struct, profiler, bit, LPeg, LXP, MD5, map, particles, sound, noise, diamond-square, shaders, serial, profile, zlib, bit again, wait, WFC. The repeated bit initialization is preserved in the evidence. Discord is a separate conditional open. Bundled `lauxlib.c` is modified to load files through PhysFS, so this is not an interchangeable stock Lua library without its filesystem dependency.

Compile success and browser behavior are separate evidence. Source-confirmed remaining boundaries include `main.c:1585`'s native loop, `main.c:1587`'s `SDL_WaitEvent`, GL texture readback in `core_lua.c`, native audio/particle/profile/serial worker services, native executable-path discovery, embedded-web dynamic loaders, and socket service integration. Root owns the actual full dependency compile/link report. Desktop [OpenGL emulation is incomplete](https://emscripten.org/docs/porting/multimedia_and_graphics/OpenGL-support.html); browser responsiveness needs an [asynchronous runtime loop](https://emscripten.org/docs/porting/emscripten-runtime-environment.html), workers need the applicable [pthread integration](https://emscripten.org/docs/porting/pthreads.html), and network services need [browser-supported networking](https://emscripten.org/docs/porting/networking.html). The manifest labels these as source/runtime requirements rather than invented compiler failures.
