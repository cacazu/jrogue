# Licenses and corresponding source

This adapter/reference milestone is GPL-3.0-or-later. Original ToME/T-Engine notices are preserved in `licenses/COPYING`, `licenses/CREDITS`, `reference/lua/source/Combat.lua` and the retained upstream distribution. Original code copyright belongs to Nicolas Casalini and its contributors.

SFMT is separately BSD licensed (Mutsuo Saito, Makoto Matsumoto, Hiroshima University). Its notice and original-wrapper attribution are retained under `reference/rng/`. Rust SFMT/formula code is test characterization, not a proposed rewrite of the user's gameplay core.

Lua 5.1.5 has its own permissive license in the retained source `src/lua/COPYRIGHT`. The compiled proof uses that unchanged interpreter, an unchanged full Combat.lua module and local CLI/file-read test adapters. Emscripten-generated JavaScript retains the Emscripten MIT/license header. Rust dependencies use their declared MIT/Apache licenses; Cargo.lock pins their source versions.

The official distribution's graphical/audio/music media is licensed for Tales of Maj'Eyal use only; see `licenses/COPYING-MEDIA` and https://te4.org/license. Do not describe those assets as generally free or reuse them in other games. The actual retained local ToME application reads the original graphics and Japanese font packages on demand. Original packages remain only in the pristine upstream tree. The older scalar reference surface uses system fonts and authored CSS.

All four shipped addon code metadata files declare GPL-3.0-or-later, including donor-gated Possessors and Items Vault. This does not remove their donor gating or independently license their media. Paid expansions are not acquired or included by this task. Remote Designer includes separate third-party web-library notices, retained in the original package and audited separately.

Before any future binary/Site distribution, provide the exact corresponding retained C/Lua sources, Rust adapter sources, local modifications and reproducible build instructions under the applicable licenses. The local official archive/tag acquisition and byte comparisons are recorded in `../audit/provenance`. A matching GPL source bundle must accompany any eventual WASM game release. No game release or Site URL is claimed here.
