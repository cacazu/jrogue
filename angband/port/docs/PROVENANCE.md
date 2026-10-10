# Angband 4.2.6 acquisition

Verified on 2026-10-02 against the official release and source tree.

- Official project: https://github.com/angband/angband
- Stable release: https://github.com/angband/angband/releases/tag/4.2.6
- Stable source commit: `f3082213b73f3e463e3d0d60bff4b00462beae6e`
- Annotated tag object: `091bd608ced492a4dc53d59cab17e14a001121c6` (unsigned)
- Source archive: https://github.com/angband/angband/releases/download/4.2.6/Angband-4.2.6.tar.gz
- Archive bytes: 25,932,904
- Archive SHA-256: `8c0ffa2b85d74bd0cc273752f61c0440dba93323cd790be460f90c8dced7cbf4`
- Pristine archive and detached source checkout: `../upstream/`
- Port source is separate from the pristine checkout. No upstream installer,
  configure script, downloaded binary game, or asset installer was executed.
  Compilation uses the existing Rust and Emscripten standard toolchains.

The full archive contains 1,104 files and 36,702,728 unpacked bytes. Its C
and header sources include optional Borg, tests, and native platform frontends.
All source and bundled assets remain in the pristine archive. The browser
build packages gameplay data, help, customization, and ASCII screens only.

The shared repository is https://github.com/cacazu/jrogue. Its established
local directory remains `C:\Users\kit\gameme\jnethack\jrouge`; this task owns
only the `angband` child. No shared-root Git index, commit, or push is performed.

## License decisions

The engine is distributed under its GPL version 2 option, retaining all
upstream per-file copyright and alternative Angband-license statements.
See the copied `licenses/copying.rst` and `licenses/GPL-2.0.txt`.

The browser uses ASCII and system fonts. It does not package tiles, bundled
fonts, or sounds. Shockbolt tiles are Angband-specific, no-fee distribution;
modification and reuse outside Angband require permission. They must not become
generic shared multi-game assets. Gervais tiles require CC BY 3.0 attribution;
Dubtrain sounds require CC BY 4.0 attribution. The pinned copying document
describes Adam Bolt permissions and GPL font agreements; a current upstream
clarification issue is open: https://github.com/angband/angband/issues/6608.

Before distributing a downloadable browser build, provide matching modified
C and Rust sources, catalogs, gameplay data, build scripts, and notices. An
upstream-only source link does not cover this port. Private hosting does not
remove the obligations applicable to distributed binaries.

The build toolchain is Rust 1.98.1 and Emscripten 6.0.8, whose SDK checkout is
`aeb67926e7de656da38bc807d83050af93578758`. The installed Rust library copyright
inventory and its complete referenced license directory are preserved in
`licenses/rust-runtime/`; the Emscripten runtime notice is preserved as
`licenses/EMSCRIPTEN-LICENSE.txt`. These notices accompany the static binary
and its corresponding source package. No new toolchain install was needed.

`licenses/emscripten-runtime/` additionally preserves the installed SDK's
Emscripten/musl/LLVM runtime terms and credits, including the per-source math
notices referenced by musl's copyright file. Its provenance JSON verifies the
copied original files with SHA-256; its README distinguishes the runtime
families from a complete linked dependency analysis. Rust compiler-builtins
and libm source notices are preserved alongside the Rust library notices.
