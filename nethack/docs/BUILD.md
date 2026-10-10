# Build and source download

The delivered browser artifacts contain the complete official C game, pinned Lua and Rust presentation/input/platform adapters. They do not depend on an old JNetHack fork. All original sources are under `upstream/NetHack-5.0.0`; build changes happen in ignored `work/` and are documented in `build/upstream-adapter.patch` and `build/source-changes.json`.

## Existing Windows toolchain

The build uses the existing official Emscripten 6.0.8 SDK at `C:\Users\kit\emsdk`, Rust 1.98.1 with `wasm32-unknown-emscripten`, and the installed Winlibs GCC for native makedefs/data-librarian utilities. No downloaded installer is executed; no SDK global activation or security change is required. SDK/cache variables are scoped to the build process. The script's `--help` lists supported options and tool paths.

From the project directory, build the adapter first:

```powershell
Set-Location rust
& 'C:\Users\kit\.cargo\bin\cargo.exe' build --offline --locked --release --target wasm32-unknown-emscripten
Set-Location ..
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' tools/build-upstream.py
```

`rust/.cargo/config.toml` points only this project at the exact vendored sources; original license files are included. The official Lua 5.4.8 source is downloaded only if absent and must match SHA-256 `4f18ddae154e793e46eeab727c59ef1c0c0c2b744e7b94219710d76f530629ae`. Dependency provenance is in `build/dependencies.json` and `build/rust-dependencies.json`.

The complete corresponding-source download includes both pristine source code under `upstream/NetHack-5.0.0` and the actual generated/modified engine source under `engine-source`, together with Lua, Rust dependencies, scripts, lockfile, catalogs and notices. Unused sound recordings and compiled build tools are excluded. Rebuild from the archive's `nethack/` directory with the commands above. A native compiler and installed official SDK/toolchain are prerequisites; they are not bundled game assets.

## Local browser

The dependency-free static server under `tools/`/`tests/` serves the `web/` directory. The page opens directly to character setup and play. Use the original game commands; saving uses the official **save-and-quit** boundary. It does not snapshot a suspended Asyncify stack. A completed save is retained for export even if persistent browser storage fails.

## Sites publication

The owner uses the official Sites workflow from an isolated checkout at `.sites-runtime/checkout`, which is ignored and is never copied into the shared repository's Git metadata. `tools/prepare-site.py` prepares only this project's source and copies the tested `web/` files byte-for-byte to the isolated checkout's supported static `out/` directory. No compiler or browser is launched by this staging step. Publication requires the real game to pass its browser checks and a corresponding-source download to be present; a loading placeholder is not published. Native deployment status and URL are recorded in `delivery.json` after terminal success.
