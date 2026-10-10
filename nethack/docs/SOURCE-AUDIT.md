# Official NetHack source audit

Audited 2026-10-02. This investigation altered no adjacent game project and executed no downloaded installer.

## Stable version and provenance

The current official stable release is **NetHack 5.0.0**, released **2026-05-02**. The official home page, release page, and official repository agree; 3.6.7 is the previous stable release. The home page also announces corrected 5.0.0 platform binaries on 2026-06-09. Those binary updates should not be confused with a new stable source release.

- Official home: https://www.nethack.org/
- Official source instructions and checksum: https://www.nethack.org/v500/download-src.html
- Official source archive: https://www.nethack.org/download/5.0.0/nethack-500-src.tgz
- Official repository: https://github.com/NetHack/NetHack
- Release tag: `NetHack-5.0.0_Released`
- Release commit: `16ff59115315917b93185d026aeefea06db9b0f4`
- Commit evidence: https://github.com/NetHack/NetHack/commit/16ff59115315917b93185d026aeefea06db9b0f4
- Release notes: https://github.com/NetHack/NetHack/releases/tag/NetHack-5.0.0_Released

Downloaded archive: `C:\Users\kit\Documents\Codex\2026-10-02\task-11\nethack-500-src.tgz`.

Exact downloaded size: **10,793,920 bytes**. SHA-256: **2959b7886aac76185b90aea0c9f80d14343f604de0ae96b3dd2a760f7ab3bde9**, verified against the official source-download page using `Get-FileHash`.

Audit extraction: `official-source-audit/NetHack-5.0.0`. Archive member paths were checked for absolute paths and `..` traversal before extraction. The archive has 1,354 directory/file members and the extracted source has **1,265 regular files totaling 29,061,195 bytes**. Key directories: `src` 132 files / 8,543,358 bytes; `include` 90 / 1,277,203; `dat` 154 / 1,511,327; `sound` 70 / 6,378,362; `win` 176 / 3,276,170; `sys` 298 / 3,193,348. Preserve the verified original archive and unmodified source tree separately from port/build modifications. The archive and Git tag are separate provenance records; byte-for-byte equivalence to a Git checkout was not asserted.

## License and assets

The game license is **NetHack General Public License**, preserved at `dat/license`:
https://raw.githubusercontent.com/NetHack/NetHack/NetHack-5.0.0_Released/dat/license

For a distributed derivative: preserve copyright, license, and warranty notices; include the license; prominently date changed files; license the derivative under identical terms without a license charge. Executables must include complete corresponding machine-readable source, or, for noncommercial distribution, full instructions to obtain it from an appropriate archive. Publish the actual modified source and reproducible build instructions alongside browser artifacts rather than relying only on upstream C source.

The source archive includes sound samples with individual attribution details in `sound/wav/attributions.txt`: CC0 and CC BY 4.0. Preserve author/source/license/modification details for any deployed sample. `sound/wav/README` separately contains old Roland-library recordings with only an uncertain historical copyright claim; keep these in the untouched provenance archive but exclude them from the browser distributable pending verified permission. Use ASCII/CSS presentation initially. Audit Lua's own license when obtaining its source.

## Browser feasibility and prerequisites

NetHack 5.0.0 is C99 and already contains an official WASM/library route. See `Cross-compiling`, section B6, and `sys/libnh/README.md`. On Linux/macOS, configure `sys/unix/setup.sh` with the platform `.500` hints, obtain Lua, then `make CROSS_TO_WASM=1`. Output is under `targets/wasm`. `make WANT_LIBNH=1` produces a native library. The `win/shim` pseudo-windowport supplies callbacks for rendering, menus, prompts, and input. This official C engine with Rust presentation/input/platform adapters matches the user's confirmed architecture; gameplay remains in C.

The tarball's `.gitmodules` lists official Lua and PDCurses repositories, but dependency source is absent from this tarball. Pin required dependencies explicitly. Source-data levels, dungeon definitions, and quest processing use embedded Lua at runtime; do not omit these to produce a reduced game. Saves/bones from earlier NetHack versions are incompatible with 5.0.0.

Observed tools: Git; Node 24.19.0/npm 11.17.0; Rust/cargo 1.98.1; installed Rust targets include `wasm32-unknown-unknown`, `wasm32-unknown-emscripten`, Windows GNU/MSVC. MSVC toolchain directory exists at `C:\BuildTools\VC\Tools\MSVC\14.44.35207`; CMake directory exists at `C:\.tools\cmake`. Emscripten, Python, GNU make, clang, wasm-pack, and wasm-bindgen were not found on the current PATH. Those are PATH observations, not proof of absence elsewhere.

Ordinary sandbox network access to GitHub failed. An auto-reviewed escalation for HTTPS `curl.exe` downloading only the authorized official source into the task workspace succeeded. No credentials or security settings changed.

## Recommended next checks

1. Reuse this verified archive for the owned `nethack` subfolder; preserve all upstream notices and record the exact archive digest and release SHA.
2. Locate existing Emscripten/Unix build tools or use the approved Sites build environment, then build the full upstream reference engine with pinned Lua.
3. Inventory command, mechanics, save, and dynamic-text boundaries against this reference. Define explicit adapter migration phases with behavioral tests; preserve RNG/state exclusively in the original gameplay path.
4. Verify full gameplay, save/load, desktop/mobile input, semantic text IDs with arguments, and Japanese-default catalogs independently. Do not label a partial game or untranslated C wrapper as a completed Japanese port.

## Subsequent architecture clarification

The user explicitly resolved the initial delegation ambiguity: 「ゲーム本体の処理は元の言語で残し、表示・入力・環境依存部分をRustで分離」. The task preserves official C gameplay and separates Rust display/input/platform. Full Rust gameplay migration is outside scope and is not a publication blocker. A tested complete-game private reference phase must disclose unfinished game-text translation; no untested placeholder is published.
