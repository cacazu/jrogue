# NetHack browser work: notices and source availability

This is a modified browser integration around NetHack 5.0.0, not an official NetHack Team release. Integration work began 2026-10-02. No warranty is provided. Original copyright and license notices remain in the untouched source distribution.

## NetHack

NetHack is distributed under the **NetHack General Public License (NGPL)**. The complete, unmodified license is at [`upstream/NetHack-5.0.0/dat/license`](upstream/NetHack-5.0.0/dat/license). It must accompany any distributed executable or derivative. Integration and derivative changes in this project are available under the same terms at no license charge. Changes to upstream files must carry a prominent change/date notice and be reproducible from checked-in scripts/patches.

Original source: https://www.nethack.org/download/5.0.0/nethack-500-src.tgz . Original archive checksum, release commit and every preserved file's SHA-256 are recorded in `provenance.json`. The original archive and complete extracted distribution are retained locally in `archives/` and `upstream/`. The archive and unused audio recordings (including encoded `.uu` recordings) are excluded from ordinary Git tracking and Site distribution; source code and original attribution/license texts remain included.

Browser distribution includes a downloadable corresponding-source archive containing the actual modified source, upstream C source, pinned Lua source, Rust/JavaScript source, lockfile, build scripts and patches. The browser's license/source links resolve locally to these packaged files. Private publication preserves this source availability.

## Lua

The official game uses Lua 5.4.8 for dungeon, level and quest content. Its exact official source URL and checksum are recorded in `build/dependencies.json`; its original MIT notice is in `licenses/Lua-5.4.8-MIT.txt` and the bundled original `lua.h`. Dependency downloading is source-only; no installer is required.

## Japanese translation text

The Japanese semantic catalog reuses reviewed translation text from JNetHack 5.0.0-0.2, pinned to commit `25adee135c4bbd43ac8567664f600b565332435c` of https://github.com/jnethack/jnethack-alpha . Its original `READMEj1.txt` states that the Japanization follows the NetHack General Public License and that copyright belongs to the listed translation authors. The complete original README, license and exact source notice blocks are preserved in [`licenses/jnethack/`](licenses/jnethack/), with Git blob identifiers and checksums in `PROVENANCE.json`.

Only pinned translation text, labels and quest templates are reused. This integration continues to use the official NetHack C gameplay sources; it does not import the fork's gameplay changes or dirty working-tree files. Catalog metadata identifies reused translations and authored additions. Changes made on 2026-10-02 include semantic IDs, typed presentation templates, helper grammar and additional Japanese translations, distributed under the NGPL. Source catalog presence is not a claim that every text producer has been integrated or verified in the browser.

## Visuals and sound

The initial browser presentation uses the engine's ASCII glyphs and CSS, with no new third-party art. The immutable source retains upstream sounds and attribution metadata for provenance. Browser artifacts exclude sounds: `sound/wav/attributions.txt` includes both CC0 and CC BY material, and `sound/wav/README` contains some legacy recordings with insufficient rights evidence. No such recording is shipped by this integration.

## Toolchain and Rust dependencies

The compiler and SDK executables are build tools. Their linked runtime code and generated JavaScript are distributed with this game and retain their original notices in [`licenses/runtime/`](licenses/runtime/). Emscripten 6.0.8 provides MIT/NCSA runtime and glue code (including its original Node path-code notice), musl libc's MIT and separately attributed implementation notices, LLVM compiler-rt/libc's Apache 2.0 with LLVM exceptions, and the default dlmalloc 2.8.6 allocator's original public-domain notice. Rust 1.98.1's complete original standard-library copyright inventory, embedded dependency notices, and Apache/MIT/Unicode/BSD/LLVM license texts are included. [`licenses/RUNTIME-PROVENANCE.json`](licenses/RUNTIME-PROVENANCE.json) records the installed source path, version, byte count and checksum of each copied original notice; it also identifies exact original musl comment blocks. Target-specific notice inventories do not imply every listed object was linked.

Rust dependency versions are fixed in `rust/Cargo.lock`; all 11 dependencies are vendored offline in `rust/vendor/`, including their original license/notice texts. `build/rust-dependencies.json` records the exact package versions, registry checksums, declared licenses and notice-file hashes. The corresponding-source package includes these files and the runtime notices. No new paid service, credential or global security setting is required.
