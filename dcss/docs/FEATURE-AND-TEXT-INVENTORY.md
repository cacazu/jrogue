# DCSS feature and text migration inventory

Version: 0.34.1, source commit `1eebc1a2892e1c89776a0d7a10691f8dac8d9796`.

This catalog covers the full selected upstream tree for planning. It is not a claim that these systems have been ported or translated. `inventory/features.json` lists the source records and enum tokens; enum totals include compatibility records, sentinels and conditional branches. Active gameplay counts must come from generated/preprocessed data and menu reachability, not token counts.

## Feature parity catalog

Paths below are relative to `upstream/crawl-ref/source` unless otherwise stated. A milestone must preserve every row or explicitly report the remaining system and its tests. Retaining the complete upstream engine keeps the systems available; browser parity still needs verification at each host boundary.

| System | Actual source/data evidence | Behavior to preserve and verify |
|---|---|---|
| Start/resume/menu, names and seeded games | `startup.cc`, `newgame.cc`, `ng-input.cc`, `ng-setup.cc`, `outer-menu.cc` | Character selection, Unicode user name, random/recommended selections, seed, resume, abort/back |
| Species and starting backgrounds | `dat/species/*.yaml`, `dat/jobs/*.yaml`, `ng-restr.cc`, `ng-wanderer.cc` | Species stats/aptitudes/mutations, valid combinations, equipment, Wanderer randomization |
| Player state/stat progression | `player.cc`, `player-stats.cc`, `player-reacts.cc`, `player-notices.cc` | HP/MP, attributes, resistances, movement/action costs, level gains and deaths |
| Skills/training | `skills.cc`, `skill-menu.cc`, `exercise.cc`, `skill-type.h` | Training allocation, manual/automatic controls, costs, cross-training, targets and menus |
| Main command loop and delays | `main.cc`, `command.cc`, `command-type.h`, `delay.cc`, `state.cc` | Turn ordering, command cancellation, prompts, multi-turn actions, interruption |
| Movement/doors/stairs | `movement.cc`, `stairs.cc`, `feature.cc`, `terrain.cc` | Eight directions, blocked cells, actions versus movement, stair transitions, terrain effects |
| Melee and ranged combat | `attack.cc`, `melee-attack.cc`, `ranged-attack.cc`, `fight.cc`, `beam.cc` | Accuracy/damage/brands, player and monster actions, projectiles, area effects, auxiliary attacks |
| Monster definitions and population | `dat/mons/*.yaml`, `mon-pick.cc`, `mon-place.cc`, `monster.cc` | All generated definitions, branch spawn tables, bands, unique and summoned monsters |
| Monster AI and relationships | `mon-act.cc`, `mon-behv.cc`, `mon-pathfind.cc`, `attitude-change.cc`, `mon-transit.cc` | Hostile/friendly behavior, fleeing, pathing, ally orders, travel across levels |
| Monster abilities/spells/statuses | `mon-abil.cc`, `mon-cast.cc`, `mon-ench.cc`, `mon-spell.h` | Spell selection, special behavior, enchantments, aura and death effects |
| Visibility and map knowledge | `los.cc`, `actor-los.cc`, `map-knowledge.cc`, `view.cc`, `viewchar.cc` | LOS, unseen information, invisibility, remembered terrain, hallucination behavior |
| World generation, branches and vaults | `dungeon.cc`, `branch-data.h`, `branch-type.h`, `dgn-*.cc`, `dat/des/**/*.des` | Branch layout, entrances, vault selection, procedural maps, special branch rules |
| Lua level and client logic | `dlua.cc`, `clua.cc`, `l-*.cc`, `dat/dlua/`, `dat/clua/` | Vault interpreter, events/markers, scripting APIs, user macros; avoid removing Lua to simplify builds |
| Abyss/Pandemonium/Hells | `abyss.cc`, `lev-pand.cc`, `branch-data.h`, `dat/des/branches/` | Dynamic regeneration, travel/exit rules, runes, branch effects and timers |
| Delve generation algorithm | `dgn-delve.cc` | Procedural level-generation behavior and constraints; this is not a separate game mode |
| Rune/Orb/win loop | `orb.cc`, `stairs.cc`, `branch-data.h`, `end.cc` | Rune requirements, Zot access, Orb pickup/return pressure, successful escape, end flow |
| Item generation/identification | `makeitem.cc`, `items.cc`, `item-prop.cc`, `known-items.cc` | Subtypes, randomized appearances, unknown versus known properties, quantities |
| Inventory/equipment | `invent.cc`, `item-use.cc`, `player-equip.cc`, `quiver.cc`, `adjust.cc` | Pickup/drop, slots, wield/wear/remove, inscriptions, quiver, inaccessible equipment |
| Consumables and evocations | `potion.cc`, `item-use.cc`, `evoke.cc`, `acquire.cc` | Potions, scrolls, wands, rechargeable evokers, acquirement and confirmation prompts |
| Artefacts and randarts | `artefact.cc`, `art-data.txt`, `art-func.h` | Fixed artefacts, random properties/names, hidden properties and equipment effects |
| Spellbooks/memorization/casting | `spl-book.cc`, `spl-cast.cc`, `spl-*.cc`, `spell-type.h` | All spells, schools, costs, failure, targeters, cancel/confirmation, generated descriptions |
| Shapeshifting/forms | `transform.cc`, `dat/forms/*.yaml`, `form-data.h` generated | Talismans, requirements, form resistances/stats/equipment and transformation transitions |
| Mutations/durations/statuses | `mutation.cc`, `mutation-data.h`, `duration-data.h`, `status.cc` | Species and gained mutations, transient effects, immunity, status summaries |
| Gods/piety/conduct/wrath | `religion.cc`, `god-*.cc`, `god-type.h`, `piety-info.cc` | Worship choice, piety, gifts, sacrifices, passive effects, abilities, abandonment/wrath |
| Shops and gold | `shopping.cc`, `dat/des/` shop vaults | Buy/search/shopping list, prices, quantities, gold totals and confirmations |
| Traps/clouds/environment/noise | `traps.cc`, `cloud.cc`, `areas.cc`, `shout.cc`, `bloodspatter.cc` | Traps, clouds, terrain/auras, noise/alerting and ownership for damage/deaths |
| Search/explore/travel | `travel.cc`, `stash.cc`, `exclude.cc`, `nearby-danger.cc` | Autoexplore, interruption, interlevel travel, exclusions, stash search and safety prompts |
| Targeting and action menus | `directn.cc`, `target.cc`, `precision-menu.cc`, `menu.cc`, `prompt.cc` | Valid targets, cycle targets, aiming, mouse equivalence, cancellation, yes/no and more prompts |
| Names/plurals/grammar | `item-name.cc`, `mon-info.cc`, `mon-util.cc`, `english.cc`, `stringutil.cc` | Known-name rules, count/plural, articles/possessives, entity visibility and user-assigned names |
| Descriptions/help/tutorial/hints | `describe*.cc`, `lookup-help.cc`, `hints.cc`, `dat/descript/`, `dat/database/help.txt`, `FAQ.txt` | Item/monster/spell/god help, tutorial lessons, hints, commands and contextual errors |
| All player-facing messages | `message.cc`, `message-stream.cc`, `dat/database/`, calls across `.cc` files | Channel, parameters, ordering, message history, prompts and dynamic speech grammar |
| Configuration/macros/keymaps | `initfile.cc`, `game-options.cc`, `macro.cc`, `dat/defaults/`, `options_guide.txt` under docs | Settings UI/errors, rc parsing, option keys distinct from translated labels, macros |
| Save/load/version/ghosts | `files.cc`, `tags.cc`, `tag-version.h`, `package.cc`, `ghost.cc`, `dat/dist_bones/` | Native compatibility, complete state, RNG streams, corruption handling, suspend/resume, ghost data |
| Scores/morgue/notes/death | `hiscores.cc`, `chardump.cc`, `notes.cc`, `kills.cc`, `ouch.cc`, `end.cc` | Death and victory summary, score formatting, character dump, notes, kill attribution |
| Sprint/tutorial/arena/wizard | `arena.cc`, `hints.cc`, `wiz-*.cc`, `dat/des/sprint/`, `dat/des/tutorial/` | Separate modes and tools; do not market absent modes as part of complete parity |
| Browser platform/input/storage | `cio.cc`, `libunix.cc`, `libw32c.cc`, `output.cc`, `tileweb.cc`, `tileweb-text.cc`, proposed Rust adapters | Full-screen/menu rendering, key/mouse/mobile/gamepad routes, CJK, resize, persistence and import/export |
| Reproducibility/testing | `random.cc`, `pcg.cc`, `rng-type.h`, `ctest.cc`, `catch2-tests/`, upstream `test/` | Same seed/commands yield same state, rendering does not consume gameplay RNG, save/load equivalence |

This table separates native Webtiles from the requested standalone WASM browser path. Native Webtiles remains evidence of upstream browser interfaces, but its Python server process, account stack and native engine cannot be silently substituted for an offline Rust/WASM build.

## Candidate text artifacts

Run from `dcss`:

```powershell
node tools/inventory.mjs
```

The tool emits compressed JSONL occurrence inventories, with source path, line, character offset, source-location discovery fingerprint, exact raw text, decoded C text, printf placeholder candidates and conservative classification. It never rewrites source, registers runtime semantic IDs or creates translations.

| Artifact in `docs/inventory/` | Coverage | Candidate count |
|---|---|---:|
| `cpp-literals.jsonl.gz` | Non-comment quoted/raw C/C++ literals in tracked superproject files | 45,636 |
| `script-literals.jsonl.gz` | Conservative candidates from Lua/JS/Python/Perl, including possible comments | 11,572 |
| `resource-lines.jsonl.gz` | Every nonempty line in selected text resources, including comments/headings/directives/map rows | 354,490 |
| `database-blocks.jsonl.gz` | Full `%%%%` description/speech blocks with lookup key separately recorded | 17,960 |
| `features.json` | YAML feature records, source enum tokens and vault files | Source catalog |
| `files.json` / `submodule-files.json` | All tracked source file sizes, Git object IDs and worktree SHA-256 | Acquisition/coverage evidence |
| `summary.json` | Exact pins/sizes/counts/artifact hashes and explicit completeness limits | Audit record |
| `license-notices.json` | License and attribution receipts discovered by filename in game/dependency sources | Notice catalog |

The four occurrence inventories overlap intentionally: resource lines also occur inside database blocks. Counts must not be summed as unique strings, translated strings or player-visible messages. The heuristic “likely player text” count includes source prose and is not proof of UI reachability. Dependency source is hashed for availability but excluded from the game's candidate translation inventory.

Binary images/fonts are not text candidates. Macro expansions, data-generated dynamic grammar and format assembly require runtime/AST review beyond this lexical discovery. C/C++ adjacent string literals are separate records; review their assembled message together. Script extraction is deliberately conservative and is not a complete Lua/JS parser.

## Semantic conversion rules

Assign durable semantic IDs at the originating call or data definition, for example `combat.melee.hit`, `inventory.pickup`, `spell.cast.failure`, `prompt.confirm.attack_friendly`, `help.command.autoexplore`. A SHA, line number or complete English phrase is a discovery locator, not a semantic runtime ID. Preserve the original English template in `en.json` and add the Japanese template under the same ID in `ja.json`.

Emit typed events with named parameters rather than formatted English. Pass entity descriptors carrying subtype, count, visible identification properties, article/role, hallucinated identity and equipment state. The presentation layer formats names/plurals per locale from those fields. Never reveal unidentified properties through translated names. Proper nouns authored by the game need an explicit terminology decision; external player/user-assigned names stay byte-for-byte UTF-8 user input.

Preserve speech markup, random choice/weights and lookup identifiers in `dat/database` separately from translated output. Translation must not change the RNG draw count or the selection of a speech variant. Preserve vault map layout, Lua identifiers, rc setting keys and generated enum names: these are executable/data identifiers, even when they look like ordinary English.

All formatting belongs in presentation. CJK line breaking and visible width differ from the original console's byte/ASCII width; track logical cells and render Japanese prose separately so translated message length cannot change game turns, prompt input position or RNG.

## Completion gates

1. Every player-visible occurrence is reviewed as semantic text, entity name, user input, machine identifier, upstream-only developer text or intentionally excluded inactive compatibility text, with evidence. An empty/missing Japanese value is incomplete, not a fallback success.
2. Registered semantic IDs exactly match both catalogs; placeholder names/types match and are exercised. Dynamic names, plurals, help, settings, errors, death/victory and all prompts are included.
3. All game systems remain the official implementation until a replacement passes behavioral comparison. A restricted demonstration level does not establish branch/spell/god/monster parity.
4. Deterministic state/RNG probes match for English/Japanese and before/after repeated rendering. Save envelopes include version/source/ABI, engine state and presentation/input checkpoint as required, with tested mismatch/corruption handling.
5. Real desktop/mobile browser flows cover start, menus, gameplay, targeting/inventory/spells, interrupted prompts, save/reload/resume, death and a complete seeded victory path. Inspect CJK layout and touch controls at mobile sizes.
6. The user defines WEB delivery as local HTML plus Node and real-browser verification. Include matching source, licenses/notices, exact artifact hashes, reproducible local run/test commands and the loopback URL. External Sites creation/deployment is out of scope. An incomplete development path must not be presented as the completed Japanese game.

At inventory creation, none of these gates is established by this document. The task owner's build and local runtime records must supply the later evidence.
