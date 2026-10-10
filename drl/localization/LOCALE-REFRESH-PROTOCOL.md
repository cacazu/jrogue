# Bounded Help and fixed-input locale refresh

This slice reprojects an already-open official Help view and fixed input labels. It reuses existing semantic IDs: eight topic titles, 116 help paragraphs, and 16 input IDs covering 23 fixed keyboard/gamepad assignments. Catalog and parameter-contract bytes are unchanged. Other native presentation caches remain pending.

The canonical authoring lives in `locale-refresh-sites.mjs` and its derived `locale-refresh-sites.json`. Twelve guarded edits cover original `drlhelp.pas`, `drlhelpview.pas`, and `drlio.pas`. `generate.mjs` emits the guarded title helper in `drlsemantichelp.pas`. Original source hashes and UTF-16 spans are recorded in the derived report.

Official help keeps its original English `FText`. A successful full line-count/line-byte match stores only its semantic topic index. Presentation block/title accessors resolve the current host language during the existing view update. Unknown or changed help and overridden title metadata retain literal fallback. The topic list, current page, view mode and event/scroll identities are retained.

Known fixed input identifiers now resolve their existing semantic IDs inside `ResolveSub`. Existing `Reconfigure` assignments and command/controller binding behavior stay in their original flow; locale changes do not call `Reconfigure` or rebuild either map. Unknown identifiers and configured bindings use the existing map fallback. The dispatcher uses input identity and keyboard/gamepad mode, never reverse matching translated labels.

The new accessors/dispatcher do not call character/statistics readers, level producers, Lua hooks, constructors, random generators, command-reset routines, event clears or scroll/selection resets. These source properties are backed by the compiled current core and bounded actual-browser proof below; they are not a full-world purity proof.

## Actual browser result and reusable gate

The 2026-10-02 22:35–22:36 UTC [primary receipt](../docs/ORIGINAL-GAME-RUNTIME-EVIDENCE.json) passes 15 checks on core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60` and Rust `54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e`. Two checks execute the same-open and scrolled Help sequences below, including known body/title/fixed-key text on later actual native frames and unchanged DRLP/MT bytes. [The current six-image visual review](../docs/ORIGINAL-GAME-VISUAL-QA.json) includes English Help. This closes the bounded implemented slice, without claiming every topic, mobile refresh, configured binding or other cached view is browser-tested. The prior 13-check/core6b8 milestone did not execute these refresh assertions.

For a later build, use the local Node server and original-game suite with new artifact hashes and source locks; never reuse this receipt for changed artifacts.

1. Start a fresh seeded original game using the existing browser test's seed/name flow. Open Help and the official **Getting started / 始め方** topic. Wait for a complete actual native frame. Retain this same layer/page for all language changes.
2. Record the complete probe packet and its serialized original MT bytes, native frame generation, empty input queue, exact external name, visible topic title, a body paragraph below the heading, and the native fixed-key footer. Capture at least one body string from the existing `help.body.start.*` catalog so a title-only change cannot pass.
3. Set `#language` to `en` and dispatch its existing DOM change event. Send no game key, close/reopen action, constructor request or native refresh export. Wait for an actual native `frameGeneration` later than the recorded generation, then assert the same Help topic has its English body, title and fixed `Up,Down` substitutions. A JavaScript replay/font draw is not a native-frame witness.
4. Use the existing `sameDiagnostic(current.probe, before.probe, label)` helper: compare **all DRLP packet bytes**, not selected decoded fields, and all embedded original MT bytes. The current probe is obtained through `drl_probe_capture` and its buffer/capacity exports. Require the input queue to stay empty, the external name to remain exact, and the same Help topic/page to stay open.
5. Change back to `ja` with the same DOM-only event. Wait for another later actual native frame. Assert the original Japanese body/title and `上,下` footer return; repeat the complete DRLP/MT comparison.
6. Add a scrolled-page repetition where the chosen offset is valid in both layouts. Do not reset scroll or reopen Help during either switch. On returning to Japanese, assert the same visible body anchor/scroll presentation returns. Record any native scrollbar clamp explicitly rather than treating a reset as success.
7. Close/reopen Help after the final switch to catch an asset-lifetime cache regression. Separately retain the fixed-input/configured-binding checks from `locale-refresh.test.mjs`; a configured fire binding must not be rewritten into a translated fixed-arrow label. Repeat the same-page sequence at a mobile viewport using the existing local browser driver when practical.

The existing browser helper currently checks every bounded DRLP field and original MT state; it does not capture the complete world/statistics/visual-RNG/modal state. Preserve that limit in the result. A complete read-only state witness is a separate gate; never substitute `TLevel.WriteToStream`, which changes original level state.

## Lightweight checks

`node localization/verify.mjs --no-native` runs the existing contracts plus six source-backed locale tests. The new cases cover original hashes/spans, every official-help JA → EN → JA projection with unchanged retained bytes, custom/modified fallback, stale fixed-label cache bypass, configured-binding preservation, pure emitted methods, and rejected changed source/catalog contracts.

`node --test localization/history-reader-stack.test.mjs` separately retains the corrected history bridge's five source-backed checks. The authored semantic/feeling/item/history units and their previous native evidence remain unchanged.

These oracles do not execute Pascal or prove the actual CJK/VTIG layout, open-page refresh or full rendering purity. Native compilation and the bounded same-open/scrolled actual browser gate now pass on current core20e21. The reusable gate's close/reopen, additional-topic, mobile-refresh and broader-binding extensions remain separate checks. Inventory/equipment/traits/character, startup/choice arrays, detail/assembly views, messages, hints/targets, plots, confirmations and reports still require their own semantic provenance or pure reprojection work. Do not mark the global locale applied merely because this bounded Help view refreshed.

Final matching source packaging and clean reconstruction remain coordinator-owned gates. The initial 27,571-file source ZIP matched historical core6b8 and predates this compiled slice. Do not label it corresponding source for current core20e21 until the final matching archive receipt exists.
