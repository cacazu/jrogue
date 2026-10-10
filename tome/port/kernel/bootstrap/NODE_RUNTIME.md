# Local retained-engine Node and browser workflow

This work prepares local HTML + Node verification of ToME 1.7.6. The latest user scope permits local browser verification only. There is no external deployment, Site publication, account setup, or source upload in this workflow. The parent owns every build, test, server launch, browser launch, and process monitor.

The gameplay core remains the original C/Lua source at upstream commit `624a67329fe2ad440c5b344785a9c73fcf22ae63`. The official source archive SHA256 is `989dea00803f8cdcade024f4647d480bb1ac0d437c254292c07549c272a4680c`. These new JavaScript files are platform adapters, not replacement rules or replacement fonts/images.

## Files and native ABI

- `node_runtime_harness.mjs`: the real Emscripten NODEFS launch adapter. Original sources and archives remain host files. Read-only mounts reject writing, truncation, creation, renaming, and source symlinks. `/persist` maps to an isolated task-workspace home, never to native ToME saves.
- `original_range_server.mjs`: exports `async createTomeServer(options={})`, returning an unlistened Node HTTP server. The caller must bind it to `127.0.0.1` and close it. It reads the exact VFS manifest, indexes file metadata, and streams requested file ranges directly from original host files. It does not copy archives, preload data, execute upstream code, or expose arbitrary workspace paths.
- `browser_vfs_mounts.mjs`: exports `async mountOriginalInputs(module, manifestURL='/vfs-manifest.json', options={})`. Mount this before native initialization. The function creates read-only source metadata nodes and performs demand range reads with a global 8 MiB cache and 256 KiB chunks by default. Original PhysFS retains ZIP decoding and archive mounting.
- `original-browser-boot.html`: a diagnostic local host for the actual SDL canvas and retained native initialization/loader/birth flow. It reports `window.tomeNativeBootReport` and exposes `window.tomeNativeProbe.command('MOVE_STAY')` for subsequent actual-command checks.
- `run-local.mjs`: a loopback-only portable launch entry. In this workspace it finds the existing native build. When staged beneath `tome/port/kernel/bootstrap`, it defaults to `port/dist/native`, `port/dist/retained`, and `port/retained/browser`. All paths can be overridden explicitly; source manifest paths resolve relative to the manifest file.

The linked module must be an ES6 modular factory at `native-core-work/browser-build/tome-native.mjs`, with its existing `.wasm` alongside it. It must export actual classic Emscripten `FS`, `NODEFS`, and `ccall`; Node support requires `-lnodefs.js`. The parent reports that this full native link now succeeds and that the actual NODEFS mount-only check returned nine mounts and zero asset bytes preloaded. No child-run runtime result is claimed here.

Native entry points from the inspected `native_browser_init.c` are:

| Function | Return / ownership |
|---|---|
| `tome_native_init()` | Integer `1` on success; initializes actual SDL/GL, fonts, PNG, PhysFS, native Lua modules, and original earliest bootstrap. |
| `tome_native_start()` | Integer `1` on success; executes `/adapter/real-core-probe.lua`, including actual pre-init and loader exactly once. |
| `tome_native_last_error()` | Borrowed C error string; `ccall(...,'string',...)` copies it. |
| `tome_native_snapshot()` | Borrowed C JSON response; copy/parse immediately before another response call. |
| `tome_native_command(command)` | Same response ownership; routes an approved original virtual key through actual Lua gameplay. |

The parent has added optional `tome_native_draw_baseline()->int` for original effectful redraw, checked for a successful return. There is no inspected public SDL event-drain or independent simulation-tick entry point. The diagnostic HTML does not invent one. Reaching an original player/map is a bootstrap milestone; it does not establish a playable campaign, original UI painting, save/resume, audio, localization coverage, or complete PC/mobile compatibility.

## Exact local commands for the parent

From `C:\Users\kit\Documents\Codex\2026-10-02\task-10`:

```powershell
& 'C:\Program Files\nodejs\node.exe' bootstrap-work/node_runtime_harness.mjs --mounts-only
& 'C:\Program Files\nodejs\node.exe' bootstrap-work/node_runtime_harness.mjs --command MOVE_STAY
& 'C:\Program Files\nodejs\node.exe' native-core-work/browser_probe.mjs --server-module bootstrap-work/original_range_server.mjs --entry /index.html --output native-core-work/browser-source-probe --report-expression window.tomeNativeBootReport --deadline-ms 180000
```

These commands are execution instructions, not tests executed by this sub-agent. The parent should use its existing sequential memory/process monitor. The browser probe owns the HTTP server, binds it to `127.0.0.1` on an ephemeral port, launches one actual Chrome process tree, records evidence, and closes both.

The parent now reports a successful actual original birth in 28.5 seconds: Cornac/Berserker, original player UID 2394, HP 132, position `(0,10)`, Trollmire map `65 x 40`, and zero recorded errors. Original effectful redraw produced the inspected game image. This is the parent's runtime evidence; this sub-agent did not execute it.

For a manual local server, the parent can run:

```powershell
& 'C:\Program Files\nodejs\node.exe' bootstrap-work/run-local.mjs --port 4187
```

From the staged shared `tome/port` directory, the equivalent command is `node kernel/bootstrap/run-local.mjs --port 4187`. `--port 0` selects an ephemeral port and prints its exact URL. The CLI rejects invalid ports, verifies the existing native files, reports address-in-use failures, and handles shutdown signals. It always binds `127.0.0.1`; there is no public-host option.

`createTomeServer({manifest,nativeBuildRoot,rustBrowserRoot,staticRoot,retainedBuildRoot})` continues to return an unlistened server for the monitored probe. Static/native/Rust/retained code routes are confined to their respective explicit roots, allowing the staged port directories without exposing arbitrary task or repository files. The CLI `startTomeServer` supplies the loopback listener. Relative physical source/overlay inputs are resolved against the manifest directory, not the process working directory.

## Read-only browser diagnostics

After the actual boot report completes, `window.tomeNativeProbe` provides:

| API | Exact behavior |
|---|---|
| `snapshot()` | Existing summary of the copied original native snapshot. |
| `snapshotRaw()` | Full parsed original native snapshot, including original map/player fields. No draw, rule step, or state setter. |
| `rngSnapshot()` | Copied actual `tome_native_rng_snapshot_hex()` string: 5,176 hexadecimal characters covering SFMT, cached Gaussian values, and libc RNG. No restore method is exposed. |
| `await command(id)` | Original `command`, `ticks`, `before`, and `after` fields plus a copied diagnostic `report`. It performs no implicit redraw. Original errors reject the call and remain in the report. |
| `drawBaseline()` | Explicit optional actual original redraw. Reports `original-effectful-baseline`; it can alter FOV/visual RNG and is excluded from snapshot purity checks. |
| `saveFiles({exportBytes:false})` | Actual `/persist` file/directory metadata, sorted for inspection. `exportBytes:true` includes actual file bytes in base64. No save operation or resume is fabricated. |
| `saveFile(path)` | Actual regular file bytes in base64 beneath `/persist`, with symlink/traversal rejection and metadata checks for a changed file. |
| `readSourceRange(path,start,length)` | Up to 1 MiB of indexed original bytes read through actual browser FS, returned as base64 with source URL/ETag for comparison to an HTTP range fetch. |

UI buttons and keyboard input call the original command, then explicitly call original redraw for the diagnostic display. Direct probe commands remain separate from drawing so the parent can measure gameplay RNG independently. Save inspection exports are raw guest-filesystem diagnostics; they do not establish an atomic generation, version compatibility, or a successful original load/resume.

`original-browser-scenario.mjs` exports `async runScenario({call,evaluate,evidence,output})` for the parent's monitored CDP probe. Append `--scenario-module bootstrap-work/original-browser-scenario.mjs` to the existing `browser_probe.mjs` command; use the equivalent `kernel/bootstrap` path after staging. The scenario observes eight repeated full snapshots and combined RNG exports, verifies actual wait and safe cardinal movement, then sends a real CDP keypad event and mobile touch to the diagnostic controls. Host `commandDispatchCount`/`commandCount` telemetry counts actual native bridge invocations and successful responses; it does not claim native SDL queue processing.

Before those gameplay commands, the scenario reads the actual completed `character.teac` from `/persist`, retains its exact bytes as `initial-character.teac`, and parses ZIP central/local headers in Node. It supports the original stored/deflated members, verifies every CRC32 and uncompressed size, and requires the genuine `mod.class.Party` main header plus its referenced `mod.class.Player` member without evaluating saved Lua. The parent's original archive contains that Party graph, six members, and 8,464 bytes; an initial character archive must not be relabeled as a Player main or a complete Game save. Limits are 4 MiB compressed archive, 16 MiB total inflated members, and 512 entries. It also compares 512-byte header/middle/tail samples from the genuine code and gfx archives through browser FS versus exact HTTP 206, including byte values above 127. A failed check records its concrete evidence and returns `passed:false`.

The cardinal movement filter recognizes the exact original floor name/glyph pairs, including `old road` with `=` from `GRASS_ROAD_DIRT`. Original Trollmire uses that road at its entrance; accepting only `.` grass incorrectly rejected a legitimate road neighbor. The scenario records all four actual adjacent snapshot cells and cache counts before choosing a visible, unoccupied, trap-free floor. It does not calculate FOV or inspect undisclosed terrain to select the action. Original `engine.Map` uses the existing `x + y * w` table index for `map`, `seens`, and `remembers`; no evidence justified replacing those cache reads.

The driver optionally constructs the reviewed semantic observer from explicit mounted settings before the existing require hook and original pre-init. It calls `observer:on_required` immediately after each original require returns. `bridge.localization_json()` exposes the observer's actual status and coverage through a separate diagnostic envelope; the gameplay snapshot schema is unchanged. Without `semantic_bootstrap`, it returns `enabled:false` and loads no localization observer. The caller must establish fresh-profile or hydrated locale readiness and register the actual Rust resolver before enabling this path.

Scenario artifacts are `scenario-evidence.json`, the exact initial character ZIP, and `mobile-scenario.png`. The scenario restores desktop viewport metrics before returning. These are diagnostic checks; original effectful redraw and incomplete initial character-save coverage remain explicit limitations. The sub-agent prepares this module without running it; the parent owns syntax checks and the actual sequential browser execution.

The server exports `/native/tome-native.mjs`, `/native/tome-native.wasm`, `/vfs-manifest.json`, explicit `/vfs/...` source files, and reviewed `/rust/...` browser modules. It accepts `GET` and `HEAD` only. There is no upload/write API. Range requests return exact `206`, `Content-Range`, `Content-Length`, `Accept-Ranges: bytes`, and an ETag. Input changes after indexing are rejected. No compression or COOP/COEP/security-policy changes are introduced.

## Actual VFS and memory behavior

`browser-vfs-inputs.json` is the authoritative fourteen-input mapping. Prefixes are frozen at `/original/bootstrap`, `/original/game`, `/unpacked/game`, and `/adapter`. Original initialization changes the working directory to `/original`; the game loader subsequently mounts the unchanged engine/module trees and original graphical/music ZIPs. The genuine shipped `/original/game/addons` directory is present because original `bootstrap/boot.lua:41` unconditionally resolves `/addons/`; addon activation remains the original loader's decision. The genuine 35,042,860-byte `tome-1.7.6.team` code archive is required for unchanged `Module:listModules` discovery: an unpacked archive has `mod/init.lua`, while original developer-directory discovery requires `init.lua` directly beneath the candidate directory.

The graphical archive is 306,444,978 bytes; the music archive is 143,996,340 bytes. Their combined 450,441,318 bytes remain existing host files. Node uses actual `NODEFS` positioned reads; the browser server streams ranges, while the browser adapter retains at most its configured range-cache limit. Metadata nodes do not contain archive data. Asynchronous endpoint verification reads one byte per large file, then discards it; no whole file or package is preloaded. Original PNG/font decoding, Lua/native allocations, textures, ZIP inflation, and browser request buffers still consume additional memory and must be measured by the parent.

The recorded `AsciiMap.lua` source overlay removes an unused top-level `require 'ffi'`. The overlay is a separate file selected at that exact VFS leaf; pristine upstream files remain untouched. The driver delegates unchanged `Module:loadDefinition` and selected `mod.load('setup')`, then mounts the separate `/original/game/build-overlay` tree at `/` so the audited `/mod/class/AsciiMap.lua` leaf retains precedence over newly mounted archive source. It does not change the original module definition, archive discovery, additional teams, or gameplay functions. No mock FFI, font, image, gameplay actor, descriptor, RNG, or SDL object is supplied.

The separate exact engine platform leaf is `mechanics-audit-work/generated/engine/SavefilePipe.lua` (11,388 bytes; SHA256 `3fb1cb1682b70e2549c1f32b3b82c0d2bb9505e53447062476b27b1bd06671a2`). It preserves the original save loop while pumping the actual browser serial queue inside `forceWait`, with real readiness/error guards and original completion/callback ownership. Only this file is exposed at `/original/game/engine-overlay/engine/SavefilePipe.lua`; the sibling opt-in Game overlay is excluded. The driver mounts its parent overlay tree before calling the first original `require('engine.SavefilePipe')`, since engine initialization/I18N can load this class before ToME module setup. A cached class causes a clear failure instead of a late ineffective patch. The native pump exports must exist; this does not fabricate a successful save or resume.

The diagnostic HTML optionally calls the parent's exported `tome_native_draw_baseline` after real readiness and commands. It labels this `original-effectful-baseline`: original drawing can mutate FOV/RNG. Snapshot purity checks must call the snapshot directly without invoking that draw path. The period key remains unsupported by this diagnostic input adapter because original period means RUN; only the original numeric-keypad-five wait key and explicit wait button route `MOVE_STAY`.

Browser `/persist` currently uses session MEMFS. Node `/persist` uses a newly isolated real host directory. A browser IDBFS populate/flush lifecycle, retained native serialization, version compatibility, and compound RNG restoration must be integrated and tested before save/resume is claimed.

## Concrete graphics and range boundaries

`tome_native_init` creates an actual SDL OpenGL window/context before it initializes PhysFS or Lua. Ordinary Node has no browser canvas/WebGL context; its full engine launch can therefore fail at the SDL window/context stage. A successful mount-only check proves real lazy source access, not game bootstrap. This adapter supplies no graphics mock.

The official SDK `FS.createLazyFile` implementation explicitly aborts on the browser main thread, uses worker synchronous `arraybuffer` XHR, falls back to whole-file reads in Node, and retains every loaded chunk. It also downloads a whole file if range support, length, or identity encoding is missing. Those concrete behaviors make it unsuitable for the present main-canvas/no-preload baseline.

The new adapter instead uses worker synchronous `arraybuffer` XHR when it is actually running in a worker. On the main thread it uses synchronous XHR with `text/plain; charset=x-user-defined`, leaves `responseType` unset, and reconstructs bytes with `charCodeAt(i) & 255`. Exact byte lengths, range headers, ETag, and identity encoding are checked. This main-thread transport still requires actual browser verification; synchronous reads block the UI and cannot be described as a finished interactive transport.

Large-file endpoints are verified asynchronously before native reads. An HTTP `200` fallback is rejected and canceled before its full body is consumed. Demand reads require exact HTTP `206`; missing/recompressed/mismatched ranges fail instead of silently preloading a 450 MB package. File `mmap` is explicitly unsupported by this initial browser adapter; if the actual runtime requests it, the resulting concrete call site must be implemented without replacing original rules.

Moving the retained engine into a worker requires adding the `worker` environment to the link and testing genuine SDL/OffscreenCanvas support. The present link targets `web,node`. If the retained SDL engine cannot run in that worker, an asynchronous native platform IO seam such as Asyncify/JSPI is a separate integration task. A main-thread asynchronous `fetch` cannot by itself satisfy the current synchronous C/PhysFS reads.

## Parent verification plan

1. Run the mount-only actual WASM/NODEFS check, then the actual browser source-backed bootstrap. Save the source commit, phase, native errors, original player/map summary, cache peak, and total range traffic. Real birth requires the original birth callback, a numeric original player UID, and an actual map.
2. Compare browser transport bytes with async `fetch` reference bytes for the original ZIP header/tail and a real font file; include values above `0x7f` and the full byte range. A byte mismatch fails the platform milestone before gameplay conclusions.
3. Exercise original `MOVE_STAY` and safe adjacent `MOVE_*` through the UI, keyboard, and mobile touch buttons. Confirm actual before/after energy/turn/player state and rejected pending dialogs. Use an actual reachable original NPC and `ATTACK_OR_MOVE_*` for attack verification; a movement key alone is not an attack proof.
4. Repeat with desktop keyboard and mobile viewport/touch input, inspect CJK text/overflow, and compare Rust adapter read-only projections to actual native snapshots. Do not send simultaneous original SDL keyboard events and adapter virtual commands for the same action.
5. Verify snapshot/render calls consume no gameplay RNG or simulation steps; the original presentation currently has known RNG/FOV interactions requiring explicit separation. Complete original dialog flows, birth choices, gameplay loops, versioned native save/load, and compound RNG restoration before a full browser port claim.

All original code licenses and asset notices remain with their existing source trees and archives. This local adapter does not imply permission to redistribute every bundled asset. The parent's existing license/provenance audit remains authoritative.
