# Tales of Maj'Eyal / T-Engine 4

**Status: incomplete retained-core Web migration. No playable-game release or Site publication.**

The user confirmed that game processing remains in the original C/Lua, while display, input and environment adapters become Rust. The native source is preserved unchanged in `upstream/`. Rust scalar/SFMT code in `port/` is characterization evidence only, not a replacement gameplay core.

Official stable source: [ToME 1.7.6](https://te4.org/download), tag `tome-1.7.6`, commit `624a67329fe2ad440c5b344785a9c73fcf22ae63`, official repository `https://git.net-core.org/tome/t-engine4.git`.

Acquired the complete official `t-engine4-src-1.7.6.tar.bz2` (500,085,010 bytes), SHA256 `989dea00803f8cdcade024f4647d480bb1ac0d437c254292c07549c272a4680c`. Retained the archive, extracted distribution, official bare tag and separately unpacked engine/base/boot/addon source packages under `upstream/`. No original source or other game was edited.

Provenance audit compares 25,856 Git blobs: 4,019 exact represented-file matches and two `init.lua` metadata-only appends (`version_desc = '1.7.6'`). Remaining unverified blob identities are media, development files and addon `.keep`; gameplay source outside those categories has no unresolved paths. This is not a claim of complete Git/media-tree equivalence.

Code is GPL-3.0-or-later; original media is licensed for ToME use only and is not generally free. Shipped donor-gated addon code also declares GPL, which does not remove donor gating or grant unrelated media rights. Unacquired paid expansions are excluded. Preserve [notices](port/THIRD-PARTY-NOTICES.md) and the exact corresponding source before publication.

Verified milestone:

- Original full Combat.lua runs under the original bundled Lua 5.1.5 C interpreter compiled to WASM; **66 scalar fixtures** match in actual Chrome.
- Rust input/display/platform reference harness, Japanese default, **100 EN/JA semantic IDs**, strict parameters, IME handling and immutable rendering.
- **30 Rust tests**, strict Clippy, WASM compilation; **48,600 C/Rust SFMT outputs** compared across six seeds. The RNG Rust code remains a test comparator.
- **18 actual Chrome checks**: PC/mobile, keyboard/touch, CJK at 200%, IndexedDB reload/resume, deterministic reference-state continuation and corruption rejection.
- **51 lexer/importer assertions**; inventory covers 6,903 physical files / 2,384 Lua files / 7,161 recognized definitions / 30,620 potential texts. Counts are static evidence, not runtime/full-game coverage.

Existing official Japanese catalogues provide 23,404 active registrations (20,221 source/tag pairs). For 14,914 explicit base-game translation-hook callsites, 14,478 have a nonempty Japanese exact-tag match. The reusable source/tag JSON preserves context, argument order and special formatting. It is **not** a completed semantic-ID catalogue. Review reports distinguish missing/empty/ambiguous candidates from proven user-visible gaps.

Start the local reference surface from `port/` with `node web/server.mjs` (`http://127.0.0.1:4186/`). This is a developer reference harness; it cannot start a ToME campaign or load a native game save.

Current gates: full original kernel/package boot; native desktop GL/SDL/thread/browser adapters; draw/FOV/RNG separation; original class-graph saves; complete semantic text integration; real birth/campaign/win/death PC/mobile flows. See [migration gates](port/docs/MIGRATION.md), [mechanics audit](port/docs/MECHANICS-AUDIT.md), and [browser evidence](port/tests/output/evidence.json).

No Git index/commit/push was performed. Parent should coordinate a `tome/`-only checkpoint after reviewing `.gitignore`; keep pristine upstream, compiler caches and giant raw inventories local. No new credentials, billing or security settings were created.
