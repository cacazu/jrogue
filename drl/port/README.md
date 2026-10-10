# DRL browser adapters — in progress

The target is the official DRL 0.10.11a Pascal/Lua game with Rust display, input and platform boundaries. The user's clarified delivery is **HTML and full browser verification through local Node**, with external deployment outside scope. Current original-core execution and complete Japanese coverage remain unverified.

- `logic`: command contracts and reference checks around the preserved original Pascal/Lua engine.
- `display`: immutable frame/draw decoding, semantic English/Japanese JSON and CJK layout.
- `input`: original action/key mappings, pointer/touch/controller and IME/focus boundaries.
- `platform`: bounded VFS, versioned native-file browser envelopes, typed text adapters and IndexedDB transaction completion.

The coherent source catalog has 3,675 EN/JA IDs. It is not a full localization claim: the original source-role audit, dynamic noun/aspect connections, message colors and native/runtime checks still have explicit gaps. Original name/save values and external names remain English/verbatim as appropriate.

`web/game.html` is the authored original-game entry. `web/server.mjs` serves prepared `dist` through loopback Node. After the current native core and Rust adapter are built and verified:

```powershell
# From the DRL root
node port/web/server.mjs
# Open http://127.0.0.1:4189/game.html
node port/tests/original-game-browser.mjs
```

The original-game suite has nine self-tests but has not yet run the game. UI/host lightweight contracts passed; older 69 Rust and seven browser checks concern the reference laboratory. The parent resource hold still blocks the current compiler/link/browser gates.

Follow [LOCAL-RUN.md](../docs/LOCAL-RUN.md) for the serial mixed-runtime, current Rust, native geometry and original-core build sequence. `build.ps1` and `tests/browser.mjs` are the earlier laboratory workflow; they do not establish original-game completion and must not overwrite the final original-game build/source package.

Pristine acquisitions are separate in `../upstream`, locally ignored. Original DRL code is GPL 2.0; engine/Lua and additional dependencies retain their actual notices. Original ASCII art retains CC BY-SA 4.0. Browser packaging excludes unresolved SDK bindings, native binaries, restricted audio and unreviewed fonts. See [provenance](../docs/PROVENANCE.md), [licenses](../docs/CORE-DEPENDENCY-LICENSES.md) and `licenses/`.
