# Cataclysm: DDA migration architecture

This project owns only `jrouge/cataclysm-dda`. The existing Rogue, Brogue,
native games, repository root, and other delegated games stay outside its scope.

The user's actual plan was read from
https://chatgpt.com/space/page_2ca2b2b56c0481919dc6359685d3bf4f on 2026-10-02.
Its four layers are **logic, presentation, platform, input**, and it explicitly
requires the latter three in Rust. Browser support has priority; terminal support
is deferred. The user subsequently explicitly confirmed: retain the original
gameplay language and separate presentation, input, and environment adapters in
Rust. This supersedes the initial handoff's Rust-domain wording. No full Rust
gameplay rewrite is part of the active task. The request additionally requires
typed commands/events, deterministic persistence, semantic text
IDs, complete English/Japanese JSON, and desktop/mobile verification.

The user's latest clarification, “WEB公開ってhtml作ってnodeでローカルで検証までだぞ”,
sets the delivery boundary: create HTML and fully verify the game through a Node
server on localhost. External Site creation, deployment and updates are outside
the active scope, even when local completion gates pass. Historical audit and
test evidence remain preserved.

## Layer ownership and dependencies

| Layer | Owns | May depend on | Must not do |
|---|---|---|---|
| Logic/domain | Original C++ mechanics, turns, character/world/inventory/combat and RNG; typed commands/events | Domain data, stable IDs | Browser input, DOM/Canvas, storage, translated prose |
| Input/application | Context-sensitive keyboard, pointer, touch, gamepad to typed commands; application command dispatch | Domain command/observation contracts | Advance turns from repaint, translate names, treat text editing as movement |
| Presentation | Immutable observations to render descriptions; semantic ID + named parameters to localized text | Domain observations and checked en/ja JSON | Consume simulation RNG, mutate knowledge/world, call gameplay actions |
| Platform | WASM ABI, browser input/storage/audio glue, versioned save envelope and adapters | Public input/presentation/application contracts | Implement alternate gameplay rules or silently accept incompatible saves |

The command/application boundary is a responsibility within the input layer,
not a fifth peer layer. A small contract crate may hold shared types without
becoming an extra layer. Original C++ gameplay remains authoritative. A bounded
Rust damage-rule library created before clarification is retained only as
supplementary differential verification; it does not replace native rules.

The original C++ engine and Rust frontend must use explicit
FFI records. They exchange stable IDs, typed parameters, observations, byte
buffers with lengths, and opaque source-tagged snapshots. C++ container layouts,
SDL structs, ownership, exceptions, and locale pointer lifetimes must not leak
into the ABI. Browser JavaScript is limited to host APIs that WASM cannot call
directly; rule decisions and input context remain in Rust.

## Source and fidelity baseline

The baseline is official stable **0.I-1 / Ito-1**, commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. Pristine archive and extracted source
are under `upstream/`; edits and generated artifacts remain outside that tree.
Every acquired blob is checked against the immutable recursive Git tree.

The stable release already has a complete-engine Emscripten target. This is a
baseline to preserve mechanics, not proof of Rust-layer completion. Its upstream
web packaging excludes obsolete mods, MA, Ultica_iso, locales, sounds, and license
files. These exclusions require an explicit manifest; they cannot be called full
content coverage. Its 512 MiB initial heap and 4 GiB maximum also require measured
mobile verification before local completion.

## Determinism and persistence

One command dispatch owns the simulation turn and RNG consumption. Observation,
translation, scrolling, resize, repaint, UI controls, and language switches must
leave both unchanged. A full engine baseline trace must be measured before these
claims are made. Native/WASM differences in the standard library's random
distributions must be recorded rather than assuming equal seeds imply equality.

Upstream `rng.cpp` uses static distribution objects, including a normal
distribution with cached state. A saved engine seed alone is insufficient.
Snapshots must capture the engine state, all distribution caches, world/character
and mod/content IDs, simulation time, command boundary, and any in-progress
interaction necessary for exact resume. The platform envelope validates format
version, port ABI, source commit, byte limits, content checksum, and required RNG
state before restoring. Upstream native save compatibility needs separate tests;
an envelope round trip does not establish it.

## Localization

Source calls and data text are inventoried before migration. Each migrated
emission uses a stable semantic ID with named typed parameters. Presentation
chooses grammar and plural form; domain records contain meaning, not an English
sentence. Semantic IDs cannot be replaced by global string replacement or a hash
of displayed prose. Source locations are provenance metadata, not message IDs.

Inventory includes gettext contexts/plurals, JSON names/descriptions/dialogue,
dynamic item and creature descriptions, errors/help/settings, mods, and UI shell.
Existing upstream Japanese translations are useful licensed source material;
fuzzy/missing translations and placeholder mismatches are explicit backlog, not
complete coverage. External usernames and player text remain literal UTF-8 data.
Japanese is the default; CJK strings require measured width, wrapping, input/IME,
and locale switching checks in the actual browser.

## Incremental gates

1. **Acquisition/audit:** official stable commit, complete blob verification,
   code/data/font/dependency licenses, content/text inventory and provenance.
2. **Faithful baseline:** build/run the full original engine in WASM; record
   new game, survival/combat/crafting/vehicle/dialogue flows and save/resume.
3. **Rust boundaries:** preserve C++ domain rules and connect Rust
   input/presentation/platform through
   typed contracts; measure no turn/RNG changes from render and translation.
4. **Translation:** cover every declared source/data/UI text category with
   semantic en/ja JSON; validate IDs, named parameters, plurals, errors and CJK.
5. **Local completion:** desktop/mobile actual-browser full flows, version/save
   corruption checks, source availability and audited notices, and HTML served
   through a loopback-only Node server. Verify WASM MIME, runtime asset integrity
   and absence of external runtime requests in the actual browser.

`tools/check-local-completion.mjs` writes `completion-gates.json`. Its eleven
gates retain full-engine, four-layer, entire-game semantic translation,
determinism, render-purity, save, desktop/mobile, notices and source requirements.
Notices evidence is `evidence/local-delivery-notices.json`; serving evidence is
`evidence/local-node-delivery.json`. The latter must pass all six checks:
`served_by_node`, `loopback_only`, `html_served`, `wasm_mime_verified`,
`runtime_assets_verified` and `no_external_runtime_requests`. Missing actual-game
evidence blocks completion. No external deployment is a gate or checker action.

Passing a bounded contract or supplementary numeric-rule test counts only for
that milestone.
It does not certify a complete game port. A placeholder or incomplete substitute
cannot be marked as the completed local Cataclysm: DDA game.
