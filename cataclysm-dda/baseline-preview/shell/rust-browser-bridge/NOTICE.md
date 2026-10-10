# Sources, changes, and licenses

Cataclysm: Dark Days Ahead contributors:
https://github.com/CleverRaven/Cataclysm-DDA

The original stable source is 0.I-1, commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. Its code and data are licensed
under Creative Commons Attribution-ShareAlike 3.0 Unported. The pristine
upstream license is copied as `LICENSE-UPSTREAM.txt`; retain upstream credits,
all applicable attribution, and share-alike licensing for derived components.

This 2026 browser adaptation retains the C++ engine and adds a bounded Rust
input/presentation WASM bridge. Rust source-backed bindings are supplied by the
existing `rust-contracts` crates. The new browser shell strings originate in
the local `baseline-preview/shell/locales` en/ja JSON catalogs; changes convert
their parameter schema into strict Rust presentation events, without replacing
English substrings globally. Source acquisition and exact catalog hashes are
recorded in `evidence/catalog-provenance.json`.

This component and its JSON/JS adaptation are made available under
CC BY-SA 3.0. Corresponding source, build scripts, Cargo.lock, and original
source identity must accompany distribution through the project source
repository. The original source is available at the repository above at the
exact recorded commit.

Cached Cargo dependency licenses and their original notices are copied by
`package-dist.mjs`, including build-time proc-macro dependencies for completeness.
Rust crates retain their own MIT, Apache-2.0, Unlicense, and Unicode licenses.
Rust's standard library retains MIT/Apache-2.0 terms. No proprietary game assets,
optional external sound packs, installers, or additional credentials are
introduced by this component.
