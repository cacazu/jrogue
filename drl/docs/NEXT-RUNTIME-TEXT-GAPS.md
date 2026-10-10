# Next original-game runtime text gaps

This source review was first prepared read-only during the 2026-10-02 geometry/full-core capture. The authorized 17-ID/three-projection batch is implemented in canonical localization and compiled into the current core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`. With Rust `54931a8c74f5dbeb304f2da397d90e9463d8033586cd49f766d0335d20bdfd5e`, the 22:35–22:36 UTC primary run passed 15 checks, including startup, first-floor hint/manual-target text and same-open/scrolled Help refresh. The separate 22:45–22:46 UTC combat/autorun run passed six bounded checks. Neither traverses every producer in this batch. Delivery is local HTML served by Node and verified in a real browser; there is no external deployment step.

The earlier 2026-10-02 21:02 UTC 13-check checkpoint used core `6b8e1e78e52ce8d387d1f3b9c39401e5cfd3a88684db321f51a7cf985f544120` with the same Rust adapter. It remains historical evidence; the current receipts below identify core `20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60`.

The review baseline contained 3,675 paired EN/JA IDs and 1,467 guarded patches across 74 checked original files. The new batch contains 3,692 paired IDs and 1,559 guarded patches over the same 74 originals, including deterministic dated modification notices in all 72 changed upstream GPL Pascal/Lua files. Actual earlier native fixture evidence covers semantic text (22), strict JSON (46), feeling metadata (90), item names (174), and history (363) checks; the corresponding semantic/sidecar unit hashes remain unchanged. Those isolated results do not establish full game text coverage; the later browser receipt separately records the subset of producers actually traversed.

## Source and guard convention

The reviewed original is DRL `0_10_11a`, commit `a6f965072b3a25b768c91dbced00367f1b57d865`. Paths below are relative to `upstream/drl/`. Ranges are zero-based, end-exclusive UTF-16 offsets in UTF-8-decoded source, matching the localization scanner/generator convention. SHA-256 values are over original file bytes. Implementations must verify both the whole-file hash and the exact selected expression before applying a splice; translated/rendered text must never serve as a source matcher.

| Original file | SHA-256 |
| --- | --- |
| `src/drlbase.pas` | `5e8c6007bbf6ae53c371a150d2f3d1d16ed1a3844ffa65ec05f974aa2824df57` |
| `src/drlhudviews.pas` | `77ac611f0ae43331b5840d33e044b0fb255950991aadeacfcc7dcd9dbff6b7b3` |
| `src/drlplayerview.pas` | `e24c72e29c5ea701af06bfb2c96bf43f52b3b2b5457b0191535010de2d6789e6` |
| `src/dfdata.pas` | `346395d359820361e1ce7708c169c9404b0f6614ef6634f889dbd33f05f955ae` |
| `bin/data/drl/main.lua` | `ad11f523e3d92c03b2229fa0f5d56def89df885a6eb87e87febb2f4e6ee5d364` |
| `bin/data/drl/levels/intro.lua` | `0b2bc16f7302e1c435a79ee31ce825da2edfc8dc88bcbbe27bb5b4d3d122fbdc` |

The missing original producers below require **17 new IDs** (five target titles, four startup getters, eight tutorial hints) and **three additional presentation projections** using existing semantic APIs/catalogs (empty equipment slots, character-panel feeling, scroll-swap item description). This count describes only the reviewed next runtime path, not all remaining source text.

The established native catalog grammar uses `{{named}}` parameters and preserves VTIG single-brace style scopes, numeric format tokens, and `{$input_*}`/`{$controller_*}` substitutions. A substitution token is engine markup, not a new semantic parameter. All new entries below have `parameters: {}` except the two explicitly typed version templates. The English fallback must reproduce the original evaluated English result, including newline semantics and trailing newlines in Lua long strings.

## Target titles: five missing producers, two covered dynamic modes

All five missing literals are in `TDRL.HandleFireCommand`/`HandleUsableCommand`, not in the generic HUD renderer. At the initial review, `core-adapted/drl/src/drlbase.pas` still contained them at lines 836, 842–844, and 889. The compiled 6b8 historical checkpoint introduced the guarded semantic projections shown below, retained by current core 20e21. The original literal spans below include Pascal quotes.

| Original line and range | Proposed ID | Exact English fallback | Proposed Japanese |
| --- | --- | --- | --- |
| 820 `[27285,27306)` | `view.target.fire` | `Choose fire target:` | `射撃対象を選択:` |
| 826 `[27460,27490)` | `view.target.chain.initial` | `Alternate fire ({Ginitial}):` | `特殊射撃（{G初動}）:` |
| 827 `[27527,27557)` | `view.target.chain.warming` | `Alternate fire ({Ywarming}):` | `特殊射撃（{Y回転上昇}）:` |
| 828 `[27594,27621)` | `view.target.chain.full` | `Alternate fire ({Rfull}):` | `特殊射撃（{R最大回転}）:` |
| 873 `[28920,28936)` | `view.target.use` | `Choose target:` | `対象を選択:` |

For example, splice only the original title literal:

```pascal
iFireTitle := DRLText('view.target.fire', 'Choose fire target:');
0      : iFireTitle := DRLText('view.target.chain.initial', 'Alternate fire ({Ginitial}):');
1      : iFireTitle := DRLText('view.target.chain.warming', 'Alternate fire ({Ywarming}):');
2..255 : iFireTitle := DRLText('view.target.chain.full', 'Alternate fire ({Rfull}):');
IO.PushLayer(TTargetModeView.Create(aItem, COMMAND_USE,
  DRLText('view.target.use', 'Choose target:'),
  iRange+1, iLimitRange, FTargeting.List, 0));
```

Keep the original `iChainFire` case, item flags, target/range calculations, `COMMAND_FIRE`/`COMMAND_ALTFIRE` selection, and all empty `iFireTitle` sentinels unchanged. The Japanese term `特殊射撃` matches existing alt-fire labels; `回転上昇`/`最大回転` describe the existing chain-fire stages without changing them.

The two composed alternate-mode expressions are already migrated:

| Original producer | Existing semantic binding |
| --- | --- |
| `drlbase.pas:782`, `'Choose target ('+iItem.GetAltFireName+'):'` | `view.target.choose-alt-mode`, `mode:string` from `DRLViewItemPerkText(iItem, Hook_OnAltFire, 'short', iItem.GetAltFireName)` |
| `drlbase.pas:832`, `'Fire target ({L'+iItem.GetAltFireName+'}):'` | `view.target.fire-alt-mode`, same guarded perk projection |

Keep the typed perk lookup and its English guard; a custom hook/mode without reviewed registry metadata must retain the original supplied text. Do not add a second translation around these two existing bindings.

`drlhudviews.pas:301–323` takes `aActionName`, stores it in `FActionName`, computes `FNameLen := VTIG_Length(aActionName)`, and draws the stored value. This is an appropriate generic dispatch/cache seam. Translate the producers before the constructor; do not inspect or globally replace English values inside `FActionName`. Its type signature and the width measurement can stay unchanged.

## Startup: four untranslated getter outputs

These Lua expressions still return original English directly. `TMainMenuView` caches `GetFirstText`, `GetMOTD`, `GetLogoBox`, and `GetLogoText` into `FFirst`, `FMOTD`, `FIntro1`, and `FIntro2` and later paints those values. Wrapping the exact Lua producer retains that interface and avoids matching cached rendered strings.

| Original line and full expression range | Proposed ID | Parameters |
| --- | --- | --- |
| 644 `[22628,22710)` | `startup.motd` | `{}` |
| 653 `[22800,22917)` | `startup.logo-box` | `version: string = VERSION_MODULE` |
| 661 `[22958,23620)` | `startup.logo-text` | `version: string = VERSION_ENGINE` |
| 703 `[24162,24852)` | `startup.first-run` | `{}` |

Replace the guarded return expression with `ui.semantic_text(id, englishTemplate, typedParameters)`. For the version templates, replace the original single concatenation with `{{version}}` in EN/JA and supply the original variable once:

```lua
return ui.semantic_text("startup.logo-box", englishTemplate,
  {{name="version",kind="string",value=VERSION_MODULE}})
```

Zero-parameter getters use `{}` as the third argument. `englishTemplate` in this proposal means the exact reviewed source result, not a new global Lua variable. The generator should emit the actual quoted/long-string template at the call site. Preserve the original Lua long-string leading-newline rule and trailing newline.

The exact MOTD English fallback is:

```text
{BSupport the game by buying the {LDRL expansion} at {Ljupiterhellclassic.com}!}
```

Proposed JA:

```text
{B{Ljupiterhellclassic.com}で{LDRL 拡張版}を購入して、ゲームを支援してください！}
```

This retains the upstream commercial expansion attribution/link. It does not import expansion assets or imply that the expansion is free.

The logo-box English template is:

```text
{rDRL version {R{{version}}}
by {RKornel Kisielewicz}
graphics by {RDerek Yu}
and {RLukasz Sliwinski}}
```

Proposed JA:

```text
{rDRL バージョン {R{{version}}}
制作：{RKornel Kisielewicz}
グラフィック：{RDerek Yu}
および {RLukasz Sliwinski}}
```

The logo-text English template is the original `[22958,23620)` expression with only `VERSION_ENGINE` parameterized. It contains the original engine version, coding/music/SFX credits, three release-change bullets, links, and confirm token. Proposed complete JA:

```text
{rDRL エンジン : {y{{version}}}
追加コード：{ytehtmi}、{yGame Hunter}、{yshark20061}、{yadd}、{ybrisbang}
音楽：{ySonic Clang}（リミックス）、{ySimon Volpert}（特別フロア）
高品質効果音：{yPer Kristian Risvik}
前バージョンからの主な変更（全一覧は{yversion.txt}を参照）
{R  * UI と操作性を大幅に変更し、多くの新しい視覚効果を追加！
  * brisbang 制作の新しい L4 特別フロアと、2 種類の新しい環境液体！
  * 激怒の仕組み、同士討ち、ナイトメアの新種など、細かな変更も多数！
  
{B facebook.com/ChaosForge  x.com/chaosforge_org  discord.gg/jupiterhell}
                                       <{y{$input_ok}}>で続行...}
```

Keep the trailing newline. Author/contributor identities, URLs, engine/module versions, and `version.txt` remain verbatim. `GetLogoTexture()` returns internal texture key `"logo"`; it must not be localized. The separate Pascal `RenderASCIILogo` artwork is not one of these prose getters and remains unchanged.

The first-run English template is the original `[24162,24852)` long-string value, including the historical title spelling `D**m the Roguelike`, all three URLs, X handles, paragraph breaks, confirm token, and trailing newline. Proposed complete JA:

```text
{y{RD**m the Roguelike}へようこそ！

DRLを初めて起動しました。私がこのローグライクを作って楽しんだのと同じくらい、皆さんにも楽しんでもらえれば幸いです。

このゲームは（再び？）活発に開発中です。バグを修正し、新機能を追加して、更新のたびに改良しているので、必ず最新バージョンを使ってください。最新版は DRL のウェブサイトで入手できます：

{Bhttps://drl.chaosforge.org/}

ゲームを楽しめたら、Discord やフォーラムにも参加してください：

{Bhttp://discord.gg/jupiterhell}
{Bhttp://forum.chaosforge.org/}

X（{B@chaosforge_org}/{B@epyoncf}）でも私をフォローできます。

<{L{$input_ok}}>で続行...}
```

These are translations of pinned upstream statements, not a current release/link audit. The `FFirst` 70-by-23 and requested `FIntro2` 77-by-12 VTIG rectangles require actual Japanese browser geometry checks after integration. Independent source calculation shows the latter clips to 11 effective rows at y=14 on an 80-by-25 canvas; the proposed Japanese uses all 11 with a normal Enter binding. Its original 39-space confirm indentation leaves 27 columns for the binding. Longer/custom bindings may wrap into a clipped row and need a reviewed layout adjustment; do not truncate a UTF-8 byte string or omit credits. This calculation is not a browser measurement. The initial `DRLを` wording avoids an orphaned ASCII word under VTIG's last-space wrap rule.

## First-floor hints: eight missing bodies

All eight literal bodies are still passed directly to `ui.set_hint` in the original and frozen overlay. Use the prefix `message.tutorial.intro.` followed by the suffix below. All have `parameters: {}`; braces are VTIG styles/input substitutions, not named parameters. Splice only the quoted literal into `ui.semantic_text(id, exactEnglish, {})` and leave the original `ui.set_hint` call, predicate ordering, position/experience/ammo checks, and hint-clearing `ui.set_hint("")` calls unchanged.

| Line and quoted-literal range | ID suffix | Exact English fallback | Proposed Japanese |
| --- | --- | --- | --- |
| 226 `[6596,6689)` | `move-controller` | `Hint : hold left joy for direction, press <{!{$controller_gameplay_move}}> to confirm move!` | `ヒント：左スティックを倒して方向を選び、<{!{$controller_gameplay_move}}>で移動を確定！` |
| 228 `[6717,6768)` | `move-keyboard` | `Hint : use {!numpad} or {!arrows} to move around!` | `ヒント：{!テンキー}または{!矢印キー}で移動！` |
| 231 `[6818,6873)` | `menu-help` | `Hint : press <{!{$input_menu}}> for menu and {!Help}!` | `ヒント：<{!{$input_menu}}>でメニューを開き、{!ヘルプ}を参照！` |
| 233 `[6915,6971)` | `hide-hints` | `Hint : you can turn off hints in the {!Settings} menu!` | `ヒント：{!設定}メニューでヒントを非表示にできます！` |
| 236 `[7055,7109)` | `fire` | `Hint : press <{!{$input_fire}}> to fire your weapon!` | `ヒント：<{!{$input_fire}}>で武器を撃つ！` |
| 239 `[7193,7251)` | `reload` | `Hint : press <{!{$input_reload}}> to reload your weapon!` | `ヒント：<{!{$input_reload}}>で武器をリロード！` |
| 243 `[7326,7391)` | `pickup` | `Hint : press <{!{$input_pickup}}> to get items from the ground!` | `ヒント：<{!{$input_pickup}}>で床のアイテムを拾う！` |
| 247 `[7492,7547)` | `stairs` | `Hint : press <{!{$input_action}}> to move downstairs!` | `ヒント：<{!{$input_action}}>で階段を下りる！` |

Example:

```lua
ui.set_hint(ui.semantic_text("message.tutorial.intro.fire",
  "Hint : press <{!{$input_fire}}> to fire your weapon!", {}))
```

## Three existing-catalog projections still missing at consumers

| Original producer and guard | Proposed narrow presentation change | English fallback rule |
| --- | --- | --- |
| `drlplayerview.pas:803`, `[25733,25767)`, `iEntry.Name  := SlotName( iSlot );` | `DRLViewSlotName(iSlot, SlotName(iSlot))`, explicit `TEqSlot` dispatch to existing `mortem.slot.armor`, `.weapon`, `.boots`, `.prepared`, `.relic` | Evaluate the original `SlotName` once; use the matching exact original catalog value as a guard, otherwise retain it verbatim. Do not change `dfdata.SlotName`. |
| `drlplayerview.pas:1035`, `[34781,34859)`, `FCharacter[1].Push( Format( '  Level feel   : {!%s}', [DRL.Level.Feeling] ) );` | The label is already `view.level.feeling`; change only its current parameter to `DRLStringParam('feeling', DRLRepeatSemanticFeeling(DRL.Level.Feeling))` and add the necessary `drlsemanticfeelings` dependency once. | Existing helper uses full original English Feeling guard. Missing, incompatible, or rejected old-save presentation metadata falls back to original English; do not mutate `Feeling` or invoke its producer hooks again. |
| `drlhudviews.pas:562`, `[15421,15468)`, `IO.HintOverlay := FArray[ FIndex ].Description;` | `IO.HintOverlay := FArray[ FIndex ].PresentationDescription;` | Existing item helper preserves `Description` evaluation and original English suffix, uses UID/prototype/name guards, and returns original English when its prefix/aspect metadata does not match. Leave domain `Name`/`Description` and saved bytes intact. |

`DRLViewSlotName` is now generated as a local presentation helper in `drlplayerview`. Its five enum branches reuse the existing zero-parameter slot entries, whose English values are the exact original bracketed strings. In current baseline gameplay four slots are visible; `efRelic` is additionally visible when `ModuleOption_RelicSlot` is enabled. The original loop, slot flags, empty-slot test, order, and disabled relic behavior are preserved. No string comparison determines which enum branch is selected; the comparison within an enum branch is solely an exact English fallback guard.

The feeling row is a **parameter-producer gap**, not an untranslated label. Its already-present `view.level.feeling` contract is `feeling:string`. The scroll-swap row is an **item presentation seam gap**, not a new registry translation. Its current adapted consumer also still uses `.Description` at line 564. Deeper arbitrary historical item-aspect chains and unreviewed custom-hook names remain separately dispositioned; switching this consumer does not prove their coverage.

## Audited visible paths already covered

English literals below are retained fallbacks/domain identity, not additional missing baseline translations:

| Runtime path | Reviewed frozen binding |
| --- | --- |
| Main menu Continue, New game, Help, Settings, exit and reports | `menu.main.*` wraps the original constants at `VTIG_Selectable`; constants remain English as exact fallbacks. |
| In-game Continue, Help, Settings, Save & Quit | `view.menu.*` at their actual menu consumers. |
| New-game type names/descriptions and seeded-game prompts | `NewGameText` selects explicit `menu.new.*` IDs; seed/title/error bindings use `menu.seed.*`. |
| Class picker and character class description/name | `DRLRegistryText('klass', id, 'base_game', 'name'/'desc', original)`; internal class IDs and mechanics remain unchanged. |
| Character-name entry title and prompt | `menu.name.title`/`menu.name.prompt`. Player input, configured names and `drl.GetRandomName` identities stay verbatim. |
| Help topic labels and all eight original help bodies | `help.*` topic/body bindings and data overlay already present. This review found no additional untranslated baseline help body. |
| Settings names, descriptions, enum values, hints and errors | Existing curated settings bindings; review the actual transformed consumer rather than counting original fallback literals as gaps. |
| Inventory/equipment/trait titles, actions, selection hints, warnings, item descriptions | Existing `view.inventory.*`, `view.equipment.*`, `view.traits.*` and typed registry/item presentation helpers; the three consumer gaps above remain explicit exceptions. |
| HUD look/run/melee/direction prompts, More/confirm prompts, scroll-wield instruction, no-weapon warnings and self-target warning | `view.hud.*`, `message.weapons-*`, and `message.suicide-constructive`; `FPrompt`/`FActionName` are generic caches. |
| HUD health/experience/weapon labels and `none`, level and boss names | `view.hud.health-labels`, `.percent-health-labels`, `.none`, and exact registry/name projection; level/boss width uses the same resolved `iDesc`. |
| Original `drl.OnLoaded` welcome and `plot.lua` plot screens | Existing `ui.semantic_text` wrappers. Release outro is `message.game.victory.release-outro` with `version:string`; do not wrap it again. |

The current platform adaptation already applies a Unicode-column prefix to the HUD weapon description and positions ammo using `VTIG_Length` under `DRL_WASM`; the canonical overlay's retained native `Copy(...,42)` branch alone is not evidence of a browser omission. This source review does not claim actual VTIG/browser geometry correctness.

`difficulty.desc_unlock` is a custom-module extension seam: the pinned baseline sets only the empty default, and no official difficulty supplies English prose there. Its raw dynamic lookup remains an explicit custom-text disposition rather than a fabricated missing baseline sentence. Custom modules, external names, native platform diagnostics, and unused/debug/classic content require their existing separate scope accounting.

## Implementation and verification handoff

The batch is authored by `localization/runtime-path-sites.mjs`, recorded in `runtime-path-sites.json`, and integrated through `curate.mjs`. It includes 19 new producer/consumer patches, one amendment to the existing feeling expression, and one enum-helper insertion; the existing import seam gains the required feeling unit without a duplicate dependency. `modification-notices.mjs/json` adds 72 deterministic GPL-2.0 §2(a) dated Pascal/Lua comment patches, preserving original headers and pristine sources. Existing browser-only `game.credit` keeps its ID/zero-parameter contract and now contains copyright attribution plus license/source text, separate from the 17 original-game IDs.

Canonical catalogs remain authoritative. The parent must re-mirror them byte-identically into Rust/UI and regenerate its adaptation only after the catalog/contract/manifest snapshot is coherent. Generated `core-adapted` files were not edited here.

Source checks should reject a changed original hash, changed selected expression, unknown/missing ID, duplicate parameter, invalid kind, placeholder mismatch, or modified VTIG/input tokens; English evaluation must round-trip at every new producer. Test each version variable as a string, newline/trailing-newline fidelity, all five original chain/target branches, all eight ordered tutorial hint branches, slot enum selection (including relic disabled/enabled), feeling guard fallback/resume, and item UID/prototype/name fallback. These checks must also show that original branch predicates, commands, RNG calls, hooks, external identities, and save fields were not modified.

Parent-owned actual runtime checks must then traverse fresh welcome and intro, continue into main menu/newgame/seed/difficulty/class/name/trait selection, first-floor movement/fire/reload/pickup/stairs hints, normal/chain/usable target screens, inventory/equipment empty slots, character feeling, scroll-swap, help/settings, and save/resume. Confirm Japanese text and complete UTF-8 graphemes on desktop/mobile with real input; inspect the fixed welcome/credit rectangles and all styled chain stages. Existing locale-rendered cached traits/menu data need an explicit refresh test if runtime language switching is offered. Until those checks and broader role/dynamic-producer dispositions pass, full original-game localization remains incomplete.

Lightweight Node source/contract tests for this batch passed **69 tests**, plus **53 feeling** and **36 item-name** oracle checks. The subsequent Help/fixed-key refresh batch passes 75 Node contracts, retains all 3,692 IDs and records 1,567 guarded patches. It is compiled in core 20e21 and actual same-open/scrolled Help refresh passes the current 15-check receipt. All 39 emitted Pascal units pass the source dependency audit with zero duplicate interface/implementation imports. Prior native fixture evidence is reconciled by unchanged unit hashes; its 695 actual checks and the historical 13-failure pre-fix JSON witness are retained. No new native execution, compilation, browser execution, publication, or Git operation was performed by this localization task. The parent-owned historical 13-check receipt closed the actual intro-history capture defect; the current 15-check receipt retains that nonempty-ledger/Exit/Continue proof and adds bounded Help refresh. It does not close full text coverage or all runtime paths listed above.

The light verification commands used were `node localization/curate.mjs`, `node localization/verify.mjs --no-native`, and `node localization/record-native-evidence.mjs`. The last command reads existing parent-produced evidence and never executes native code. Source checks include lossless original fallback roundtrips, exact hashes/ranges, altered-source rejection, typed version values, input/color token symmetry, newline fidelity, unchanged targeting/hint branches, untouched identities/ASCII art, explicit enum/fallback dispatch, feeling replay binding, item-description projection, and dated comment/header preservation.

Historical frozen catalogs/manifest for the original 17-ID handoff (catalogs/contract remain unchanged; manifests and verification change with later refresh work):

| File | SHA-256 |
| --- | --- |
| `localization/en.json` | `a2adef9b5172b9138c325c4c80b89de9a9e8f0a0b982bf9e1179c5aebf871e79` |
| `localization/ja.json` | `3b22b7f0e7fa8e034d1729f51363a419900d20ef5813a8c76b543cf595fb2b17` |
| `localization/contract.json` | `0a969acd9ff71d415d0f07924a21db69d2888079408795a7667087b62560fa34` |
| `localization/manifest.json` | `ac6d8eff451d4ce156d7eeaccd834b5a638035d5ce7bd8adec3c03c5798af1a0` |
| `localization/verification.json` | `03075af2a7b32eb0ec2224d4a4b9123acd8f405851aa064f87f2578adf7333c9` |

## Additional reviewed gaps outside this implemented batch

Abandon invokes `drl.GetQuitMessage` and prepends an untranslated quip to an already translated confirmation. `main.lua:801–810` contains ten fixed table entries; line 812, `[27257,27305)`, still executes exactly `return messages[core.visual_random(#(messages))]`. Proposed zero-parameter `message.quit.*` IDs are `demon-around-corner`, `imps-overrun-system`, `boss-deathmatch`, `bloodbath`, `prefer-internet`, `demons-to-roast`, `internet-worse`, `boring-programs`, `see-if-i-care`, and `next-time-toast`. These are pending, not included in the 17 IDs. A future seam must preserve table order and exactly one original visual RNG draw, then resolve only the selected finite positional ID; no random draw may be introduced in rendering.

The original `drlplotview.pas:53,65` uses byte `Length(FMessage)` for reveal completion and the 80% skip threshold. This is a geometry/behavior review requirement for Japanese plot text, not a new missing plot translation. The existing plot producer wrappers remain covered. The geometry owner should review the exact intended reveal unit and threshold before changing them, and retain a source/runtime witness.

Fresh original-source accounting retains **535 visible/composed** and **5,939 ambiguous-role** literal candidates, plus **658 dynamic-producer** candidates. These are pending candidates, not a claim that each is painted English. The separate message-call inventory is unchanged: 540 calls, 517 reviewed direct calls (405 Lua / 112 Pascal), 10 excluded unshipped debug/classic calls, and 13 generic/producer seams with explicit dispositions. The eight hint producers and four startup getters above are separately inventoried presentation producers, not additional migrated `ui.msg` calls. All 72 originally unscanned binary/support files have evidence-backed hashes/format dispositions; that audit does not claim OCR or translation of embedded pixels.

Broader literal/role, dynamic-name, custom-hook, native-platform and complete-game-flow dispositions remain open, including deeper historical item-aspect chains. This incremental checkpoint does not assert complete Japanese/full-game coverage.

The Help/fixed-input refresh, browser `RunDelay = 0` override and read-only delay/MultiMove getters are compiled in the current core. The primary 15-check receipt verifies the same open official Help body/title/fixed keys through Japanese → English → Japanese on later native frames, including the scrolled page, with unchanged DRLP/MT bytes. The separate six-check combat/autorun receipt verifies native zero delay, physical Shift+Right followed by Escape, inactive MultiMove and twenty stable later native frames. Other cached views, messages, plots and reports still need semantic refresh work.
