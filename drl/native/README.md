# Preserved original-language source

The selected gameplay core remains the original DRL FreePascal and Lua source. These files are copied byte-for-byte from the pinned pristine acquisitions; `docs/native-source-manifest.json` records each selected source hash. No gameplay files are modified.

`drl/` contains Pascal source, Lua gameplay/configuration scripts, original text help and licensing. `fpcvalkyrie/` contains the original engine source and MIT notice. `lua-5.1.5/` contains the original C interpreter source and license. The complete pristine checkouts and archives are retained separately under the locally ignored `../upstream/`.

This source selection excludes bundled native DLL/SO executables, FMOD/Steam payloads, audio and graphical binary assets. It is **not yet a compilable browser integration or a complete native distribution**. Some original project files still reference resources from the full upstream tree. Use the pristine source for original baseline builds, with the asset/license constraints documented in `../docs/PROVENANCE.md`.

The Rust numeric/RNG experiment in `../port/` is a reference verification milestone, not the selected replacement for these rules. Next work is an official FPC WASM capability/ABI proof and a thin native-core boundary for Rust display, input and platform adapters.
