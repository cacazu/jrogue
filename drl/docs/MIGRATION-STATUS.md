# DRL migration status

**Original-game local browser milestones passed; complete port remains pending.** The 2026-10-02 22:35–22:36 UTC Chrome run passed 15 primary checks against the actual original Pascal/Lua game, including PC/mobile input, native Save & Quit/Continue and same-open/scrolled Help locale refresh. A separate 22:45–22:46 UTC run passed six bounded combat/autorun checks, and the 23:31–23:32 UTC native death/report/profile run passed eight. The clarified deliverable is HTML with full browser verification through a local Node server; external Sites/deployment is outside scope. Original gameplay remains in Pascal/Lua, while Rust supplies display/input/platform adapters and a delegating logic contract. See [local run instructions](LOCAL-RUN.md).

The earlier 2026-10-02 21:02 UTC 13-check checkpoint used core `6b8e1e78e52ce8d387d1f3b9c39401e5cfd3a88684db321f51a7cf985f544120` with the same Rust adapter. It remains historical evidence; the current receipts below identify core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`.

## Current verified checkpoint

| Evidence | Verified result | Limit |
| --- | --- | --- |
| [Full original-core compile/link](../core-adapted/build/browser-core/link-evidence.json) | Exit 0, 139 compiler-used source records, imports validated, source/archive inputs unchanged; core 6,065,580 bytes | Fresh 139-source clean compilation is verified and the original core rebuild is byte-exact; full toolchain bootstrap is separate. |
| [Actual original-game Chrome](../port/tests/output/original-game/evidence.json) | 15 checks passed, no browser exceptions or recorded localization findings; actual fetched artifact pair and 97 assets captured | Bounded intro/game/save flow, not complete campaign/system coverage. |
| [Observed combat/autorun](ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json) | Six bounded checks passed: zero-delay autorun/Escape, observed doors, visible named targeting/hit, player damage, hostile death/XP/fresh Look | Exact enemy UID/HP and player-kill attribution remain unverified; no full-world/campaign proof. |
| [Fresh source reconstruction](SOURCE-CLEAN-BUILD-EVIDENCE.json) | Whole archive/FPC/mapping/vendor restore; clean 139-source game and Rust builds; core byte-exact | Raw result is `compiled-artifact-differs` for audited Rust source-path/layout differences; external pinned standard prerequisites reused. |
| [Clean-source Chrome](CLEAN-SOURCE-BROWSER-EVIDENCE.json) | Fresh rebuilt core/Rust pair passes the 15 primary checks, with six-image visual review | Bounded primary flow; full world/campaign/text and wider death/profile branches remain open; one separate native death/report/profile flow now passes. |
| [Native death/report/profile](ORIGINAL-DEATH-RUNTIME-EVIDENCE.json) | Eight checks passed: zero HP/Japanese mortem, native profile/score/mortem commits, HOF/menu/profile and fresh-instance exact-file persistence | One bounded death flow; exact killer and wider rank/challenge branches unverified. English report title/footer remain concrete text gaps. |
| [Current Rust test log](../port/tests/output/current-rust-tests-memory.json.stdout.log) | 120 tests passed with current catalogs; current WASM build passed | Adapter/contracts/reference checks are distinct from original gameplay verification. |
| [Canonical localization](../localization/verification.json) | 3,692 equal EN/JA IDs; current compiled Help/fixed-input checkpoint 75 Node contracts; 53 feeling and 36 item-name source-oracle checks | Complete localization remains explicitly false; same-open/scrolled Help refresh is verified; other caches and full text coverage remain open. |
| [Actual native localization fixtures](../localization/native-execution-evidence.json) | Semantic 22, JSON 46, feeling 90, item names 174, history 363: 695 passed | Isolated fixtures are separate from the actual intro-ledger capture verified in the current primary browser run. |
| [Generated-source audit](core-overlay-source-evidence.json) | 353 generated files; four byte-exact rule units and eight reviewed transformed units | Source correspondence is not complete behavioral equivalence. |
| [Actual VTIG geometry](core-geometry-runtime-evidence.json) | CJK padding/clipping, color scopes, offset extents, scrollbar and marker ordering passed | Pins a separate fixture core and earlier Rust adapter. |
| [Final allocator audit](CORE-ALLOCATOR-AUDIT.json) | Matches current core; seven single owners, 126 selected libc objects, six selected references; no independent allocator objects | Static ownership is not every callback's runtime proof. |
| [Historical real Chrome host](../port/tests/output/core-host-browser.json) | 27 host/ABI/VFS/JSPI checks passed | Supporting authored probes, not another 27 current game checks. |

The exact tested pair is:

- Original core: `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`.
- Rust adapter: `54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e`.

The [measured original-core job](../core-adapted/build/browser-core/memory-evidence.json) peaked at **692,613,120 bytes** committed memory, with at least 8,676,200,448 bytes sampled free commit. The [actual browser job](../port/tests/output/original-game-memory.json) peaked at **495,321,088 bytes**, with at least 8,363,606,016 bytes sampled free commit. The parent has released the prior resource hold; serial measured builds are authorized. No current resource blocker is asserted.

## Original-game paths actually exercised

The suite rejects seed 0, creates seed 5489 on the easiest difficulty as Marine with Ironman, and preserves the exact 18-character external name `BrowserMarine_5489`. Original keyboard movement/wait and one mobile touch advance native actions. Inventory/equipment, help PageDown and settings return/apply work; completed `settings.lua` persistence is recorded.

Manual targeting and cancellation preserve action/ammo state. Confirmed pistol fire reduces the magazine from 6 to 5 without reducing reserve 40, and reload restores 6 with reserve 39. This primary check is an empty-tile shot. The separate combat receipt records observed hostile hits/death and XP, without exact enemy UID/HP or player-kill attribution. Mobile checks cover the original 80×25 grid, horizontal scrolling, fit mode and 200% UI font at a 390-pixel viewport.

Fifty replay draws, font/viewport changes, EN/JA switches and non-action views preserve every bounded DRLP field and all original MT bytes. Original Save & Quit closes the native save before browser commit. Fresh page/Rust/Pascal instances execute original Continue, restore the same bounded diagnostic/RNG/name and persist one-use consumed-save deletion. Two fresh native-save loads with the same physical command sequence produce identical bounded diagnostics and RNG continuation. These results do not cover every world/Lua field or every save/profile branch.

Input's 22 Node shell/key/text checks pass. Real-presentation receipts now gate key-down/key-up and bounded text delivery, fixing the earlier welcome-menu failure and truncated external name. Original native editor character policy remains in force. The actual original game now executes production `drl_sleep`/JSPI without experimental flags, SharedArrayBuffer or changed browser security settings.

## Preserved source, architecture and text work

Official stable DRL `0_10_11a` is locked to `a6f965072b3a25b768c91dbced00367f1b57d865`, with matching Valkyrie `f89735a741a968997656c2d48a003ec569db7f22` and official Lua 5.1.5. [Provenance](PROVENANCE.md) and [source lock](source-lock.json) retain acquisition/archive hashes. Pristine upstream and the byte-exact selected `native/` tree remain separate from the generated port. The native manifest contains **305 files / 3,486,100 bytes**, with no modified gameplay files.

The current generated adaptation has **353 files and 131 platform transformations**. Current source notices identify modified GPL upstream files. FMOD/Steam bindings and proprietary DOOM audio are excluded from the browser runtime and selected corresponding source; console output uses silent audio and system fonts. The 22 original ASCII-art files retain CC BY-SA 4.0 attribution.

The verified corresponding-source reconstruction baseline is ZIP SHA-256 `881cff21b198f6f9cfe3f24ed9674586d719c18147f1b99978667be64b9b45b2`: **27,630 files / 545,460,758 source bytes**, ZIP **166,497,281 bytes**, matched to original core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`. Every decompressed archive entry passed full hash readback. Fresh whole extraction restored the 26,172-file FPC baseline and verified all 13,776 linked-source mappings; all 23 Cargo packages resolved offline from the restored vendor tree. [The clean-build receipt](SOURCE-CLEAN-BUILD-EVIDENCE.json) verifies a fresh 139-source original-game compile and Rust adapter build without copying game objects or an existing game WASM. External pinned standard compiler/units/libraries were reused; full toolchain bootstrap remains unverified.

The original core rebuild is byte-exact. Rust rebuilt as `dbec616a8d1a9021eb75242121e99b37c45fde280a760cc63518e2730dc3c02e` rather than deployed `54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e`, so the raw receipt retains `result: compiled-artifact-differs`, `clean_compile_verified: true` and `adapter_byte_exact: false`. [The strict adapter audit](CLEAN-RUST-ADAPTER-DIFF.json) passes: all instruction opcodes/locals match, every changed operand/address maps to the same logical data target, and only dependency source-location strings, their lengths, static-address relocations and zero padding account for the 512-byte difference. [Actual clean-pair Chrome](CLEAN-SOURCE-BROWSER-EVIDENCE.json) then passes all 15 primary checks, with [six-image visual QA](CLEAN-SOURCE-VISUAL-QA.json); its measured job peak was **602,259,456 bytes**. This proves the bounded tested reconstructed game flow, not full world/campaign/text coverage.

Historical source milestone: the first nonlaboratory archive for core6b8 contained 27,571 files / 543,888,352 source bytes, ZIP 166,288,072 bytes, SHA-256 `b5ff2c3aa0e2347f31af37ae7742656e2cf06f779afd1b74119cebe420c93aed`. It passed entry hash readback and is retained as earlier evidence, separate from the reconstructed 881/core20e21 baseline.

The coordinator is preparing a final authored recipe/evidence recut containing the corrected workflow helpers, frozen prose/status and added gates/receipts. It preserves the compiled core/source closure and does not yet have an asserted final ZIP identity here. Use the exact [source-bundle receipt](../port/dist/source-bundle.json) for the resulting download; the 881 archive above is the baseline actually reconstructed and tested.

The current compiled semantic checkpoint covers **74 pinned files, 1,567 guarded patches and 1,211 direct sites**, with 75 Node contracts and unchanged 3,692-ID catalogs. Same-open/scrolled Help and fixed labels refresh in actual native frames on the current artifact. The remaining source audit records **535 visible/composed literal candidates**, **5,939 ambiguous literal-role candidates** and **658 dynamic producer candidates**. These are review queues, not a count of visible untranslated messages. All 72 previously unrecognized files have dispositions. Original English gameplay/save values and external identities remain intact; display uses semantic IDs and typed parameters.

Actual history capture is repaired: the scalar Variant-key lookup reads the original Lua history table. The actual intro ledger preserves its English guard across native Exit and fresh Continue. [Timestamp storage evidence](PLATFORM-TIMESTAMP-EVIDENCE.json) covers strict 64-bit metadata, snapshot version 2 and version 1 migration. Complete prepared-string locale refresh and all remaining text dispositions remain open.

The source-built official FPC wasm32 compiler, both WASI RTL exception configurations and eight packages pass their recorded builds. Four additional `fcl-json` runtime units compile as a bounded subset. Lua/Pascal shared allocator, fixed C-varargs, C stdio and JSPI continuations have supporting actual Node/Chrome evidence. See [FPC toolchain](FPC-WASM-BUILD.md), [Lua/WASI ABI](LUA-WASI-ABI.md) and [core boundary](CORE-BRIDGE.md). Full-core compilation and the old welcome-screen input gate are closed at this checkpoint.

## Four-layer target with original-language logic

| Layer | Owns | Boundary |
| --- | --- | --- |
| Logic: original Pascal/Lua | DRL/Valkyrie state, RNG, scheduling, combat/AI/generation/content/challenges/progression/save behavior and original Lua callbacks | Preserve gameplay in its original languages; review necessary build/platform/control-flow seams against upstream. Rust reference formulas are not replacement systems. |
| Display: Rust | Frame/command projection, semantic text resolution, CJK layout and browser panels/map presentation | Drawing must not mutate game state, advance simulation time or consume gameplay RNG. Full-world purity remains to prove. |
| Input: Rust | Keyboard/mouse/touch/controller mapping, focus and event/command delivery | Native controllers validate gameplay; mapping does not reproduce game rules or mutate state directly. |
| Platform: Rust/browser glue | WASM host/ABI, VFS/storage, timers and permitted audio services | Explicit ownership across memories, versioned persistence and bounded IO; restricted native runtimes/assets remain excluded. |

Session/application use cases remain in the original core or a thin delegating bridge. They are not a second gameplay implementation. The public Rust modules are `logic`, `display`, `input` and `platform`.

## Remaining stages and closure evidence

| Stage | Current milestone and remaining work | Evidence required to close |
| --- | --- | --- |
| Source/content ledger | Static feature ledger exists; finish text/dynamic-producer dispositions and connect feature entries to actual execution. | Every upstream system/player-visible producer explained; no unexplained omission. |
| Toolchain/ABI/source closure | 881 matching source archive/full readback, fresh whole restore, offline vendors, clean original-game/Rust builds, adapter diff audit and clean-pair primary Chrome pass. | Final authored recipe/evidence recut and coherent destination; full toolchain bootstrap remains unverified. |
| Simulation/state witness | Original seeded intro/actions execute; bounded DRLP and all MT words are stable in presentation checks. Partial additional witness prototype exists. | Read-only complete world/entity/item/terrain/scheduler/Lua/queue coverage and deterministic native/source comparisons. |
| Combat/AI | Manual targeting/cancel/fire/reload and a bounded visible encounter with player damage, named hit, hostile death/XP/fresh Look pass. | Exact enemy UID/HP and player-kill attribution; representative melee/ranged/AI/armor/resistance/explosion/alternate-fire boundaries. |
| World/campaign | Original intro Lua/map executes. Full normal/alternate campaigns, special levels, bosses, wins and wider death/rank branches remain. | Complete reachable original content/hooks and recorded seeded flows/endings. |
| Character/content | Easiest difficulty, Marine/Ironman and initial inventory execute. Other classes/difficulties/traits/items/mods/challenges/unlocks remain. | Representative registry/callback paths and constraints tested; executable hooks retained. |
| Commands/profile | Movement/wait, inventory/equipment/help/settings, targeting/fire/reload and actual zero-delay keyboard autorun/Escape pass. The native death/mortem/HOF/profile persistence flow also passes. Chain-fire/controller cancellation, advanced actions and wider ranks/awards/profile branches remain. | Wider valid/invalid native commands, held-input interruption and persistent metagame flows. |
| Localization | 3,692-ID catalogs/native fixtures and actual same-open/scrolled Help/fixed-key refresh pass. Broader history presentation, other caches and source review queues remain open. | Equal keys/placeholders plus actual complete-flow text coverage and explained retained English; external names preserved. |
| Save/load | Original Save & Quit, fresh Continue, one-use deletion and bounded deterministic continuation pass. Full-world/native compatibility/profile/recovery branches remain. | Uninterrupted/resumed world equivalence and explicit version/error/import/export/compatibility coverage. |
| Presentation/platform | Japanese default, PC/mobile touch/layout and settings persistence pass on current artifacts. Broader focus/IME/controller/modal/layout paths remain. | Actual desktop/mobile browser evidence plus complete render purity and no native dependency leakage. |
| Full regression | Current 15-check primary and six-check combat/autorun gates pass alongside supporting fixtures. Full mechanics/difficulty/challenge/win and wider death/profile regression remain; one separate eight-check native death/report/profile gate passes. | Tests tied to feature ledger, final visual QA and complete game flows on exact final artifacts. |
| Local delivery | Loopback Node server defaults `/` to `game.html`. Final own-DRL source/dist sync and parent Git checkpoint remain. | Exact destination hashes, final locally verified HTML/WASM/source/licenses and run instructions. External deployment is outside scope. |

## Baseline feature coverage to preserve

The schema-2 [feature ledger](../feature-inventory.json) records 26 active maps, 15 challenges, 35 traits, 40 beings, 151 explicit items plus 21 generated natural attacks, 28 explicit cells plus 23 generated corpses, 42 assemblies and 35 being groups. It covers 22 categories, 73 hook types and 13 inactive definitions. These are source findings, not a statement that registering data executes every associated hook.

The full ledger includes worlds/campaign/special levels/bosses; timed combat/movement/AI; terrain/fluids/status; inventory/gear/modding; traits/classes/difficulties/challenges; records/unlocks; menus/help/settings/input; and dynamic text. The preserved original engine supplies these systems, but their browser reachability and behavior still need the required evidence.

## Local completion gates

The original task closes only when all of these have recorded results:

1. Every gameplay ledger entry is preserved and reviewed, with no toy substitute or undisclosed missing system.
2. Complete English/Japanese semantic catalogs and source dispositions pass ID/key/placeholder checks and actual-flow text verification.
3. Full-state deterministic gameplay/RNG, rendering purity, versioned save compatibility and complete game flows pass.
4. Final desktop/mobile input, CJK layout and save/resume are verified on the exact final artifacts.
5. Restricted runtime/assets are excluded, with licenses, attribution and complete corresponding source supplied and clean reconstruction verified.
6. Final HTML runs through the documented Node loopback server, the separate `drl` destination is hash-verified and the parent receives the final evidence.

The remaining work is complete localization and other cached-view refresh, whole-state purity, broader combat/campaign/metagame regression, exact combat attribution, final authored source/evidence recut and local delivery. The old compiler-source-record and welcome-screen input failures are closed; the 15 primary, six bounded combat/autorun and eight native death/report/profile checks do not close the full task. No DRL Site has been created.

The Help/fixed-input refresh, browser `RunDelay = 0` override and read-only delay/MultiMove getters are compiled in the current core. The primary 15-check receipt verifies the same open official Help body/title/fixed keys through Japanese → English → Japanese on later native frames, including the scrolled page, with unchanged DRLP/MT bytes. The separate six-check combat/autorun receipt verifies native zero delay, physical Shift+Right followed by Escape, inactive MultiMove and twenty stable later native frames. Other cached views, messages, plots and reports still need semantic refresh work.

[The separate combat/autorun receipt](ORIGINAL-COMBAT-RUNTIME-EVIDENCE.json) passed six bounded checks on the same current pair. Physical movement and three observed native doors acquired a visible hostile; original named targeting and two pistol shots produced ammo consumption and a named hit, player damage was observed, and a named hostile death was followed by increased XP and fresh native Look at the still-visible corpse tile. The receipt does not establish exact enemy UID/HP or player-kill attribution, full-world equivalence, broader combat mechanics or a campaign.

[The actual native death/report/profile receipt](ORIGINAL-DEATH-RUNTIME-EVIDENCE.json) passed **eight checks at 2026-10-02 23:31–23:32 UTC** on deployed core20e21/Rust54931. A bounded observed-door/hostile route and physical waits reached zero HP and the Japanese death prompt; native `DSFinished` produced the mortem with the exact full external character name and Japanese body/version markers. Native memorial writing changed and committed mortem, profile and score files. The hall of fame respected its original 17-byte name field. The original flow returned to the Japanese menu with no live player and opened the player profile; fresh original instances reloaded the exact persisted native files, score and profile, then returned to the Japanese menu. This closes that exercised death/report/profile/storage flow, not every death/rank/challenge branch or exact killer attribution.

The death receipt preserves concrete localization findings: the native `Post mortem` title (`drlbase.pas:1583`) and footer `<上,下> scroll, <左,右> pages, <Enter,Escape> exit` (`drlpagedview.pas:68`) retain English text. The known Japanese death/mortem phase guards pass independently; complete localization, full-world state, campaign/win/challenge coverage and exact killer attribution remain false/unverified. Screenshot capture is recorded by the actual receipt; independent visual review remains a separate record.

Independent [death-flow visual review](ORIGINAL-DEATH-VISUAL-QA.json) also records concrete English profile rank requirements/time units and high-score death-description text. These supplement the automated title/footer findings; complete translation remains false.
