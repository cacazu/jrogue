# DRL browser source and notices

This working bundle preserves the DRL 0.10.11a Pascal/Lua gameplay implementation. It is an integration candidate awaiting full-game verification; it has not been published.

DRL code is copyright Kornel Kisielewicz / ChaosForge, GPL 2.0. FPC Valkyrie is copyright ChaosForge, MIT. Lua 5.1.5 is copyright Lua.org / PUC-Rio, MIT. The original MT19937 implementation retains its separate BSD notice. Full copies of these notices accompany this directory.

Original ASCII art is covered by the upstream README's CC BY-SA 4.0 art grant. Original art and sprites are credited to Derek Yu; modifications and additions to Łukasz Śliwiński. The packaged 22 ASCII files retain their original bytes. The CC BY-SA license requires attribution and share alike for adaptations, and does not grant trademark rights. The original source and credit record are available at https://github.com/chaosforgeorg/drl/tree/0_10_11a .

The selected compiled Free Pascal RTL/packages carry modified library GPL terms with the independent-module exception, with separate Paszlib/zlib and imported LazUtils/Unicode notices. The exact WASI libc components retain MIT/BSD and inherited musl notices; compiler-rt carries Apache 2.0 with LLVM exceptions. The Rust Unicode width/segmentation crates retain their MIT/Apache notices and applicable Unicode data notices. The final linked object inventory selects the corresponding notices before publication; the source audit is in `docs/CORE-DEPENDENCY-LICENSES.md`.

Browser display/input/storage adapters, narrow original-language presentation/platform seams, and Japanese catalogs are modifications. They do not relicense upstream material. Original audio, FMOD, Steam, native runtimes, unreviewed fonts and closed commercial game assets are excluded from the browser bundle.

The published game must provide complete corresponding source beside the WASM, including original/adapted Pascal/Lua, Lua C, Rust, modified runtime/startup, source locks and build scripts. The current reference-laboratory `source.zip` is insufficient for that game release and must be replaced and verified before publication. No completed game release or source-package review is asserted here.
