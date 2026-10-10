# Mechanically extracted DRL registries

Static declaration counts are separated from runtime-generated content. See feature-inventory.md for the migration ledger.

| Category | Base game | Core schemas | Classic module | Other |
| --- | ---: | ---: | ---: | ---: |
| ai | 14 | 0 | 0 | 0 |
| award | 0 | 0 | 0 | 0 |
| badge | 147 | 0 | 0 | 0 |
| being | 40 | 0 | 0 | 0 |
| being_group | 0 | 0 | 0 | 0 |
| blueprint | 1 | 24 | 0 | 0 |
| cell | 28 | 0 | 0 | 0 |
| challenge | 15 | 0 | 0 | 0 |
| difficulty | 5 | 0 | 0 | 0 |
| emitter | 0 | 0 | 0 | 0 |
| generator | 11 | 0 | 0 | 0 |
| item | 151 | 0 | 0 | 0 |
| itemset | 4 | 0 | 0 | 0 |
| klass | 4 | 0 | 0 | 0 |
| level | 26 | 0 | 1 | 0 |
| medal | 50 | 0 | 0 | 0 |
| mod_array | 42 | 0 | 0 | 0 |
| perk | 50 | 0 | 0 | 0 |
| rank | 38 | 0 | 0 | 0 |
| requirement | 4 | 0 | 0 | 0 |
| room | 6 | 0 | 0 | 0 |
| trait | 35 | 0 | 0 | 0 |

Anonymous definitions: 35. Generated natural attacks/corpses: 44.

## ai

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| smart_evasive_ai | — | base_game | bin/data/drl/ai.lua:1 |
| smart_hybrid_ai | — | base_game | bin/data/drl/ai.lua:16 |
| charger_ai | — | base_game | bin/data/drl/ai.lua:30 |
| flock_ai | — | base_game | bin/data/drl/ai.lua:45 |
| melee_ranged_ai | — | base_game | bin/data/drl/ai.lua:59 |
| ranged_ai | — | base_game | bin/data/drl/ai.lua:73 |
| sequential_ai | — | base_game | bin/data/drl/ai.lua:87 |
| archvile_ai | — | base_game | bin/data/drl/ai.lua:103 |
| spawner_ai | — | base_game | bin/data/drl/ai.lua:180 |
| angel_ai | — | base_game | bin/data/drl/ai.lua:245 |
| cyberdemon_ai | — | base_game | bin/data/drl/ai.lua:294 |
| jc_ai | — | base_game | bin/data/drl/ai.lua:347 |
| teleboss_ai | — | base_game | bin/data/drl/ai.lua:443 |
| mastermind_ai | — | base_game | bin/data/drl/ai.lua:500 |

## award

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |

## badge

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| technician1 | Technician Bronze Badge | base_game | bin/data/drl/awards.lua:4 |
| technician2 | Technician Silver Badge | base_game | bin/data/drl/awards.lua:11 |
| technician3 | Technician Gold Badge | base_game | bin/data/drl/awards.lua:18 |
| technician4 | Technician Platinum Badge | base_game | bin/data/drl/awards.lua:25 |
| technician5 | Technician Diamond Badge | base_game | bin/data/drl/awards.lua:32 |
| armorer1 | Armorer Bronze Badge | base_game | bin/data/drl/awards.lua:39 |
| armorer2 | Armorer Silver Badge | base_game | bin/data/drl/awards.lua:46 |
| armorer3 | Armorer Gold Badge | base_game | bin/data/drl/awards.lua:53 |
| armorer4 | Armorer Platinum Badge | base_game | bin/data/drl/awards.lua:60 |
| armorer5 | Armorer Diamond Badge | base_game | bin/data/drl/awards.lua:67 |
| heroic1 | Heroic Bronze Badge | base_game | bin/data/drl/awards.lua:74 |
| heroic2 | Heroic Silver Badge | base_game | bin/data/drl/awards.lua:81 |
| heroic3 | Heroic Gold Badge | base_game | bin/data/drl/awards.lua:88 |
| heroic4 | Heroic Platinum Badge | base_game | bin/data/drl/awards.lua:95 |
| heroic5 | Heroic Diamond Badge | base_game | bin/data/drl/awards.lua:102 |
| buac1 | UAC Bronze Badge | base_game | bin/data/drl/awards.lua:366 |
| buac2 | UAC Silver Badge | base_game | bin/data/drl/awards.lua:373 |
| buac3 | UAC Gold Badge | base_game | bin/data/drl/awards.lua:380 |
| buac4 | UAC Platinum Badge | base_game | bin/data/drl/awards.lua:387 |
| buac5 | UAC Diamond Badge | base_game | bin/data/drl/awards.lua:394 |
| buac6 | UAC Angelic Badge | base_game | bin/data/drl/awards.lua:401 |
| veteran1 | Veteran Bronze Badge | base_game | bin/data/drl/awards.lua:410 |
| veteran2 | Veteran Silver Badge | base_game | bin/data/drl/awards.lua:417 |
| veteran3 | Veteran Gold Badge | base_game | bin/data/drl/awards.lua:424 |
| veteran4 | Veteran Platinum Badge | base_game | bin/data/drl/awards.lua:431 |
| veteran5 | Veteran Diamond Badge | base_game | bin/data/drl/awards.lua:438 |
| veteran6 | Veteran Angelic Badge | base_game | bin/data/drl/awards.lua:445 |
| strongman1 | Strongman Bronze Badge | base_game | bin/data/drl/awards.lua:454 |
| strongman2 | Strongman Silver Badge | base_game | bin/data/drl/awards.lua:461 |
| strongman3 | Strongman Gold Badge | base_game | bin/data/drl/awards.lua:468 |
| strongman4 | Strongman Platinum Badge | base_game | bin/data/drl/awards.lua:475 |
| strongman5 | Strongman Diamond Badge | base_game | bin/data/drl/awards.lua:482 |
| strongman6 | Strongman Angelic Badge | base_game | bin/data/drl/awards.lua:489 |
| speedrunner1 | Speedrunner Bronze Badge | base_game | bin/data/drl/awards.lua:498 |
| speedrunner2 | Speedrunner Silver Badge | base_game | bin/data/drl/awards.lua:505 |
| speedrunner3 | Speedrunner Gold Badge | base_game | bin/data/drl/awards.lua:512 |
| speedrunner6 | Speedrunner Angelic Badge | base_game | bin/data/drl/awards.lua:535 |
| elite4 | Elite Platinum Badge | base_game | bin/data/drl/awards.lua:544 |
| elite5 | Elite Diamond Badge | base_game | bin/data/drl/awards.lua:551 |
| elite6 | Elite Angelic Badge | base_game | bin/data/drl/awards.lua:558 |
| demonic4 | Demonic Platinum Badge | base_game | bin/data/drl/awards.lua:567 |
| demonic5 | Demonic Diamond Badge | base_game | bin/data/drl/awards.lua:574 |
| demonic6 | Demonic Angelic Badge | base_game | bin/data/drl/awards.lua:581 |
| lava1 | Lava Bronze Badge | base_game | bin/data/drl/awards.lua:590 |
| lava2 | Lava Silver Badge | base_game | bin/data/drl/awards.lua:597 |
| reaper1 | Reaper Bronze Badge | base_game | bin/data/drl/awards.lua:619 |
| reaper2 | Reaper Silver Badge | base_game | bin/data/drl/awards.lua:626 |
| reaper3 | Reaper Gold Badge | base_game | bin/data/drl/awards.lua:633 |
| reaper4 | Reaper Platinum Badge | base_game | bin/data/drl/awards.lua:640 |
| reaper5 | Reaper Diamond Badge | base_game | bin/data/drl/awards.lua:647 |
| wall1 | Brick Bronze Badge | base_game | bin/data/drl/awards.lua:669 |
| wall2 | Brick Silver Badge | base_game | bin/data/drl/awards.lua:676 |
| skull1 | Skull Bronze Badge | base_game | bin/data/drl/awards.lua:690 |
| skull2 | Skull Silver Badge | base_game | bin/data/drl/awards.lua:697 |
| berserker1 | Berserker Bronze Badge | base_game | bin/data/drl/challenge.lua:13 |
| berserker2 | Berserker Silver Badge | base_game | bin/data/drl/challenge.lua:20 |
| berserker3 | Berserker Gold Badge | base_game | bin/data/drl/challenge.lua:27 |
| berserker4 | Berserker Platinum Badge | base_game | bin/data/drl/challenge.lua:34 |
| berserker5 | Berserker Diamond Badge | base_game | bin/data/drl/challenge.lua:41 |
| berserker6 | Berserker Angelic Badge | base_game | bin/data/drl/challenge.lua:48 |
| marksman1 | Marksman Bronze Badge | base_game | bin/data/drl/challenge.lua:148 |
| marksman2 | Marksman Silver Badge | base_game | bin/data/drl/challenge.lua:155 |
| marksman3 | Marksman Gold Badge | base_game | bin/data/drl/challenge.lua:162 |
| marksman4 | Marksman Platinum Badge | base_game | bin/data/drl/challenge.lua:169 |
| marksman5 | Marksman Diamond Badge | base_game | bin/data/drl/challenge.lua:176 |
| marksman6 | Marksman Angelic Badge | base_game | bin/data/drl/challenge.lua:183 |
| shotgun1 | Shottyman Bronze Badge | base_game | bin/data/drl/challenge.lua:245 |
| shotgun2 | Shottyman Silver Badge | base_game | bin/data/drl/challenge.lua:252 |
| shotgun3 | Shottyman Gold Badge | base_game | bin/data/drl/challenge.lua:259 |
| shotgun4 | Shottyman Platinum Badge | base_game | bin/data/drl/challenge.lua:266 |
| shotgun5 | Shottyman Diamond Badge | base_game | bin/data/drl/challenge.lua:273 |
| shotgun6 | Shottyman Angelic Badge | base_game | bin/data/drl/challenge.lua:280 |
| lightfoot1 | Lightfoot Bronze Badge | base_game | bin/data/drl/challenge.lua:346 |
| lightfoot2 | Lightfoot Silver Badge | base_game | bin/data/drl/challenge.lua:353 |
| lightfoot3 | Lightfoot Gold Badge | base_game | bin/data/drl/challenge.lua:360 |
| lightfoot4 | Lightfoot Platinum Badge | base_game | bin/data/drl/challenge.lua:367 |
| lightfoot5 | Lightfoot Diamond Badge | base_game | bin/data/drl/challenge.lua:374 |
| lightfoot6 | Lightfoot Angelic Badge | base_game | bin/data/drl/challenge.lua:381 |
| impatient1 | Eagerness Bronze Badge | base_game | bin/data/drl/challenge.lua:456 |
| impatient2 | Eagerness Silver Badge | base_game | bin/data/drl/challenge.lua:463 |
| impatient3 | Eagerness Gold Badge | base_game | bin/data/drl/challenge.lua:470 |
| impatient4 | Eagerness Platinum Badge | base_game | bin/data/drl/challenge.lua:477 |
| impatient5 | Eagerness Diamond Badge | base_game | bin/data/drl/challenge.lua:484 |
| impatient6 | Eagerness Angelic Badge | base_game | bin/data/drl/challenge.lua:491 |
| confident1 | Daredevil Bronze Badge | base_game | bin/data/drl/challenge.lua:544 |
| confident2 | Daredevil Silver Badge | base_game | bin/data/drl/challenge.lua:551 |
| confident4 | Daredevil Platinum Badge | base_game | bin/data/drl/challenge.lua:558 |
| purity3 | Inquisitor Gold Badge | base_game | bin/data/drl/challenge.lua:642 |
| purity4 | Inquisitor Platinum Badge | base_game | bin/data/drl/challenge.lua:649 |
| purity5 | Inquisitor Diamond Badge | base_game | bin/data/drl/challenge.lua:656 |
| purity6 | Inquisitor Angelic Badge | base_game | bin/data/drl/challenge.lua:663 |
| redalert1 | Quartermaster Bronze Badge | base_game | bin/data/drl/challenge.lua:712 |
| redalert2 | Quartermaster Silver Badge | base_game | bin/data/drl/challenge.lua:719 |
| redalert3 | Quartermaster Gold Badge | base_game | bin/data/drl/challenge.lua:726 |
| redalert4 | Quartermaster Platinum Badge | base_game | bin/data/drl/challenge.lua:733 |
| redalert5 | Quartermaster Diamond Badge | base_game | bin/data/drl/challenge.lua:740 |
| redalert6 | Quartermaster Angelic Badge | base_game | bin/data/drl/challenge.lua:747 |
| darkness1 | Hunter Bronze Badge | base_game | bin/data/drl/challenge.lua:802 |
| darkness2 | Hunter Silver Badge | base_game | bin/data/drl/challenge.lua:809 |
| darkness3 | Hunter Gold Badge | base_game | bin/data/drl/challenge.lua:816 |
| darkness4 | Hunter Platinum Badge | base_game | bin/data/drl/challenge.lua:823 |
| darkness5 | Hunter Diamond Badge | base_game | bin/data/drl/challenge.lua:830 |
| carnage1 | Destroyer Bronze Badge | base_game | bin/data/drl/challenge.lua:881 |
| carnage2 | Destroyer Silver Badge | base_game | bin/data/drl/challenge.lua:888 |
| carnage3 | Destroyer Gold Badge | base_game | bin/data/drl/challenge.lua:895 |
| carnage4 | Destroyer Platinum Badge | base_game | bin/data/drl/challenge.lua:902 |
| carnage5 | Destroyer Diamond Badge | base_game | bin/data/drl/challenge.lua:909 |
| masochism3 | Masochist Gold Badge | base_game | bin/data/drl/challenge.lua:947 |
| masochism4 | Masochist Platinum Badge | base_game | bin/data/drl/challenge.lua:954 |
| masochism5 | Masochist Diamond Badge | base_game | bin/data/drl/challenge.lua:961 |
| masochism6 | Masochist Angelic Badge | base_game | bin/data/drl/challenge.lua:968 |
| century1 | Centurial Bronze Badge | base_game | bin/data/drl/challenge.lua:1052 |
| century2 | Centurial Silver Badge | base_game | bin/data/drl/challenge.lua:1059 |
| century3 | Centurial Gold Badge | base_game | bin/data/drl/challenge.lua:1066 |
| century4 | Centurial Platinum Badge | base_game | bin/data/drl/challenge.lua:1073 |
| century5 | Centurial Diamond Badge | base_game | bin/data/drl/challenge.lua:1080 |
| century6 | Centurial Angelic Badge | base_game | bin/data/drl/challenge.lua:1087 |
| pacifism1 | Pacifist Bronze Badge | base_game | bin/data/drl/challenge.lua:1231 |
| pacifism2 | Pacifist Silver Badge | base_game | bin/data/drl/challenge.lua:1238 |
| pacifism3 | Pacifist Gold Badge | base_game | bin/data/drl/challenge.lua:1245 |
| pacifism6 | Pacifist Angelic Badge | base_game | bin/data/drl/challenge.lua:1252 |
| everyman3 | Everyman Gold Badge | base_game | bin/data/drl/challenge.lua:1331 |
| everyman4 | Everyman Platinum Badge | base_game | bin/data/drl/challenge.lua:1338 |
| everyman5 | Everyman Diamond Badge | base_game | bin/data/drl/challenge.lua:1345 |
| everyman6 | Everyman Angelic Badge | base_game | bin/data/drl/challenge.lua:1352 |
| confident3 | Daredevil Gold Badge | base_game | bin/data/drl/challenge.lua:1430 |
| confident5 | Daredevil Diamond Badge | base_game | bin/data/drl/challenge.lua:1437 |
| arena1 | Arena Bronze Badge | base_game | bin/data/drl/levels/arena.lua:51 |
| arena2 | Arena Silver Badge | base_game | bin/data/drl/levels/arena.lua:58 |
| arena3 | Arena Gold Badge | base_game | bin/data/drl/levels/arena.lua:65 |
| arena4 | Arena Platinum Badge | base_game | bin/data/drl/levels/arena.lua:72 |
| arena5 | Arena Diamond Badge | base_game | bin/data/drl/levels/arena.lua:79 |
| hellgate1 | Gatekeeper Bronze Badge | base_game | bin/data/drl/levels/boss.lua:3 |
| hellgate2 | Gatekeeper Silver Badge | base_game | bin/data/drl/levels/boss.lua:10 |
| hellgate3 | Gatekeeper Gold Badge | base_game | bin/data/drl/levels/boss.lua:17 |
| hellgate4 | Gatekeeper Platinum Badge | base_game | bin/data/drl/levels/boss.lua:24 |
| hellgate5 | Gatekeeper Diamond Badge | base_game | bin/data/drl/levels/boss.lua:31 |
| death3 | Longinus Gold Badge | base_game | bin/data/drl/levels/fortress.lua:123 |
| death4 | Longinus Platinum Badge | base_game | bin/data/drl/levels/fortress.lua:130 |
| death5 | Longinus Diamond Badge | base_game | bin/data/drl/levels/fortress.lua:137 |
| arachno1 | Arachno Bronze Badge | base_game | bin/data/drl/levels/spider.lua:13 |
| arachno2 | Arachno Silver Badge | base_game | bin/data/drl/levels/spider.lua:20 |
| vaults1 | Scavenger Bronze Badge | base_game | bin/data/drl/levels/vaults.lua:16 |
| vaults2 | Scavenger Silver Badge | base_game | bin/data/drl/levels/vaults.lua:23 |
| vaults3 | Scavenger Gold Badge | base_game | bin/data/drl/levels/vaults.lua:30 |
| vaults4 | Scavenger Platinum Badge | base_game | bin/data/drl/levels/vaults.lua:37 |
| vaults5 | Scavenger Diamond Badge | base_game | bin/data/drl/levels/vaults.lua:44 |

## being

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| former | former human | base_game | bin/data/drl/beings.lua:5 |
| sergeant | former sergeant | base_game | bin/data/drl/beings.lua:30 |
| captain | former captain | base_game | bin/data/drl/beings.lua:57 |
| commando | former commando | base_game | bin/data/drl/beings.lua:83 |
| imp | imp | base_game | bin/data/drl/beings.lua:113 |
| demon | demon | base_game | bin/data/drl/beings.lua:157 |
| lostsoul | lost soul | base_game | bin/data/drl/beings.lua:182 |
| cacodemon | cacodemon | base_game | bin/data/drl/beings.lua:209 |
| knight | hell knight | base_game | bin/data/drl/beings.lua:251 |
| baron | baron of hell | base_game | bin/data/drl/beings.lua:299 |
| arachno | arachnotron | base_game | bin/data/drl/beings.lua:346 |
| pain | pain elemental | base_game | bin/data/drl/beings.lua:389 |
| revenant | revenant | base_game | bin/data/drl/beings.lua:422 |
| mancubus | mancubus | base_game | bin/data/drl/beings.lua:471 |
| arch | arch-vile | base_game | bin/data/drl/beings.lua:519 |
| eformer | elite former human | base_game | bin/data/drl/beings.lua:568 |
| esergeant | elite former sergeant | base_game | bin/data/drl/beings.lua:604 |
| ecaptain | elite former captain | base_game | bin/data/drl/beings.lua:642 |
| ecommando | elite former commando | base_game | bin/data/drl/beings.lua:679 |
| nimp | nightmare imp | base_game | bin/data/drl/beings.lua:718 |
| ndemon | nightmare demon | base_game | bin/data/drl/beings.lua:764 |
| nlostsoul | nightmare soul | base_game | bin/data/drl/beings.lua:788 |
| ncacodemon | nightmare cacodemon | base_game | bin/data/drl/beings.lua:814 |
| nknight | nightmare knight | base_game | bin/data/drl/beings.lua:859 |
| narachno | nightmare arachnotron | base_game | bin/data/drl/beings.lua:910 |
| npain | nightmare elemental | base_game | bin/data/drl/beings.lua:953 |
| nrevenant | nightmare revenant | base_game | bin/data/drl/beings.lua:985 |
| nmancubus | nightmare mancubus | base_game | bin/data/drl/beings.lua:1035 |
| narch | nightmare arch-vile | base_game | bin/data/drl/beings.lua:1087 |
| bruiser | bruiser brother | base_game | bin/data/drl/beings.lua:1138 |
| shambler | shambler | base_game | bin/data/drl/beings.lua:1193 |
| lava_elemental | lava elemental | base_game | bin/data/drl/beings.lua:1253 |
| agony | agony elemental | base_game | bin/data/drl/beings.lua:1319 |
| angel | Angel of Death | base_game | bin/data/drl/beings.lua:1356 |
| cyberdemon | Cyberdemon | base_game | bin/data/drl/beings.lua:1396 |
| mastermind | Spider Mastermind | base_game | bin/data/drl/beings.lua:1451 |
| jc | John Carmack | base_game | bin/data/drl/beings.lua:1510 |
| apostle | Apostle | base_game | bin/data/drl/beings.lua:1569 |
| arenamaster | Arena Master | base_game | bin/data/drl/levels/chained.lua:155 |
| soldier | soldier | base_game | bin/data/drl/main.lua:222 |

## being_group

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |

## blueprint

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| requirement | — | engine_core | bin/data/core/blueprints.lua:1 |
| rank_req | — | engine_core | bin/data/core/blueprints.lua:8 |
| rank | — | engine_core | bin/data/core/blueprints.lua:16 |
| difficulty | — | engine_core | bin/data/core/blueprints.lua:25 |
| trait | — | engine_core | bin/data/core/blueprints.lua:45 |
| klass_trait | — | engine_core | bin/data/core/blueprints.lua:90 |
| klass | — | engine_core | bin/data/core/blueprints.lua:102 |
| medal | — | engine_core | bin/data/core/blueprints.lua:117 |
| badge | — | engine_core | bin/data/core/blueprints.lua:129 |
| award_level | — | engine_core | bin/data/core/blueprints.lua:141 |
| award | — | engine_core | bin/data/core/blueprints.lua:147 |
| perk | — | engine_core | bin/data/core/blueprints.lua:156 |
| ai | — | engine_core | bin/data/core/blueprints.lua:224 |
| being | — | engine_core | bin/data/core/blueprints.lua:235 |
| being_group_entry | — | engine_core | bin/data/core/blueprints.lua:314 |
| being_group | — | engine_core | bin/data/core/blueprints.lua:320 |
| cell | — | engine_core | bin/data/core/blueprints.lua:331 |
| challenge | — | engine_core | bin/data/core/blueprints.lua:367 |
| mod_array | — | engine_core | bin/data/core/blueprints.lua:416 |
| item | — | engine_core | bin/data/core/blueprints.lua:431 |
| itemset | — | engine_core | bin/data/core/blueprints.lua:658 |
| level | — | engine_core | bin/data/core/blueprints.lua:668 |
| room | — | engine_core | bin/data/core/blueprints.lua:698 |
| emitter | — | engine_core | bin/data/core/blueprints.lua:710 |
| generator | — | base_game | bin/data/drl/generators.lua:6 |

## cell

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| floor | floor | base_game | bin/data/drl/cells.lua:18 |
| wall_destroyed | rubble | base_game | bin/data/drl/cells.lua:43 |
| wall | base wall | base_game | bin/data/drl/cells.lua:57 |
| rwall | bloodstone | base_game | bin/data/drl/cells.lua:86 |
| iwall | ice wall | base_game | bin/data/drl/cells.lua:116 |
| cwall | cave wall | base_game | bin/data/drl/cells.lua:138 |
| cfloor | floor | base_game | bin/data/drl/cells.lua:159 |
| gwall | green wall | base_game | bin/data/drl/cells.lua:179 |
| crate | crate | base_game | bin/data/drl/cells.lua:201 |
| ycrate | crate | base_game | bin/data/drl/cells.lua:216 |
| door | closed door | base_game | bin/data/drl/cells.lua:236 |
| odoor | open door | base_game | bin/data/drl/cells.lua:266 |
| ldoor | locked door | base_game | bin/data/drl/cells.lua:300 |
| stairs | down stairs | base_game | bin/data/drl/cells.lua:324 |
| rstairs | down stairs | base_game | bin/data/drl/cells.lua:343 |
| ystairs | down stairs | base_game | bin/data/drl/cells.lua:372 |
| water | water | base_game | bin/data/drl/cells.lua:387 |
| mud | mud | base_game | bin/data/drl/cells.lua:399 |
| acid | acid | base_game | bin/data/drl/cells.lua:411 |
| lava | lava | base_game | bin/data/drl/cells.lua:445 |
| blood | blood | base_game | bin/data/drl/cells.lua:480 |
| bridge | bridge | base_game | bin/data/drl/cells.lua:518 |
| rock | Phobos rock | base_game | bin/data/drl/cells.lua:531 |
| nukecell | a nuke! | base_game | bin/data/drl/cells.lua:541 |
| crate_ammo | crate | base_game | bin/data/drl/cells.lua:555 |
| crate_armor | crate | base_game | bin/data/drl/cells.lua:581 |
| bloodpool | pool of blood | base_game | bin/data/drl/main.lua:143 |
| corpse | bloody corpse | base_game | bin/data/drl/main.lua:154 |

## challenge

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| challenge_aob | Angel of Berserk | base_game | bin/data/drl/challenge.lua:71 |
| challenge_aomr | Angel of Marksmanship | base_game | bin/data/drl/challenge.lua:190 |
| challenge_aosh | Angel of Shotgunnery | base_game | bin/data/drl/challenge.lua:287 |
| challenge_aolt | Angel of Light Travel | base_game | bin/data/drl/challenge.lua:388 |
| challenge_aoi | Angel of Impatience | base_game | bin/data/drl/challenge.lua:498 |
| challenge_aocn | Angel of Confidence | base_game | bin/data/drl/challenge.lua:565 |
| challenge_aop | Angel of Purity | base_game | bin/data/drl/challenge.lua:670 |
| challenge_aora | Angel of Red Alert | base_game | bin/data/drl/challenge.lua:754 |
| challenge_aod | Angel of Darkness | base_game | bin/data/drl/challenge.lua:837 |
| challenge_aomc | Angel of Max Carnage | base_game | bin/data/drl/challenge.lua:916 |
| challenge_aoms | Angel of Masochism | base_game | bin/data/drl/challenge.lua:975 |
| challenge_a100 | Angel of 100 | base_game | bin/data/drl/challenge.lua:1094 |
| challenge_aopc | Angel of Pacifism | base_game | bin/data/drl/challenge.lua:1259 |
| challenge_aohu | Angel of Humanity | base_game | bin/data/drl/challenge.lua:1368 |
| challenge_aooc | Angel of Overconfidence | base_game | bin/data/drl/challenge.lua:1444 |

## difficulty

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| ITYTD | I'm Too Young To Die! | base_game | bin/data/drl/difficulty.lua:3 |
| HNTR | Hey, Not Too Rough | base_game | bin/data/drl/difficulty.lua:16 |
| HMP | Hurt Me Plenty | base_game | bin/data/drl/difficulty.lua:26 |
| UV | Ultra-Violence | base_game | bin/data/drl/difficulty.lua:35 |
| N! | Nightmare! | base_game | bin/data/drl/difficulty.lua:46 |

## emitter

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |

## generator

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| gen_tiled | — | base_game | bin/data/drl/generators.lua:27 |
| gen_maze | — | base_game | bin/data/drl/generators.lua:42 |
| gen_caves | — | base_game | bin/data/drl/generators.lua:76 |
| gen_caves_2 | — | base_game | bin/data/drl/generators.lua:88 |
| gen_arena | — | base_game | bin/data/drl/generators.lua:101 |
| gen_warehouse | — | base_game | bin/data/drl/generators.lua:156 |
| gen_archi | — | base_game | bin/data/drl/generators.lua:191 |
| gen_city | — | base_game | bin/data/drl/generators.lua:204 |
| gen_single | — | base_game | bin/data/drl/generators.lua:241 |
| gen_single_plus | — | base_game | bin/data/drl/generators.lua:300 |
| gen_lava | — | base_game | bin/data/drl/generators.lua:328 |

## item

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| chainsaw | chainsaw | base_game | bin/data/drl/items/eitems.lua:54 |
| bfg9000 | BFG 9000 | base_game | bin/data/drl/items/eitems.lua:84 |
| ublaster | blaster | base_game | bin/data/drl/items/eitems.lua:135 |
| ucpistol | combat pistol | base_game | bin/data/drl/items/eitems.lua:171 |
| uashotgun | assault shotgun | base_game | bin/data/drl/items/eitems.lua:204 |
| upshotgun | plasma shotgun | base_game | bin/data/drl/items/eitems.lua:233 |
| udshotgun | super shotgun | base_game | bin/data/drl/items/eitems.lua:261 |
| ulaser | laser rifle | base_game | bin/data/drl/items/eitems.lua:289 |
| utristar | tristar blaster | base_game | bin/data/drl/items/eitems.lua:326 |
| uminigun | minigun | base_game | bin/data/drl/items/eitems.lua:363 |
| umbazooka | missile launcher | base_game | bin/data/drl/items/eitems.lua:397 |
| unplasma | nuclear plasma rifle | base_game | bin/data/drl/items/eitems.lua:436 |
| unbfg9000 | nuclear BFG 9000 | base_game | bin/data/drl/items/eitems.lua:474 |
| utrans | combat translocator | base_game | bin/data/drl/items/eitems.lua:553 |
| unapalm | napalm launcher | base_game | bin/data/drl/items/eitems.lua:589 |
| uoarmor | onyx armor | base_game | bin/data/drl/items/eitems.lua:624 |
| uparmor | phaseshift armor | base_game | bin/data/drl/items/eitems.lua:641 |
| upboots | phaseshift boots | base_game | bin/data/drl/items/eitems.lua:662 |
| ugarmor | gothic armor | base_game | bin/data/drl/items/eitems.lua:680 |
| ugboots | gothic boots | base_game | bin/data/drl/items/eitems.lua:702 |
| umedarmor | medical armor | base_game | bin/data/drl/items/eitems.lua:744 |
| uduelarmor | duelist armor | base_game | bin/data/drl/items/eitems.lua:766 |
| ubulletarmor | bullet-proof vest | base_game | bin/data/drl/items/eitems.lua:786 |
| uballisticarmor | ballistic vest | base_game | bin/data/drl/items/eitems.lua:804 |
| ueshieldarmor | energy-shielded vest | base_game | bin/data/drl/items/eitems.lua:822 |
| uplasmashield | plasma shield | base_game | bin/data/drl/items/eitems.lua:840 |
| uenergyshield | energy shield | base_game | bin/data/drl/items/eitems.lua:858 |
| ubalshield | ballistic shield | base_game | bin/data/drl/items/eitems.lua:876 |
| uacidboots | acid-proof boots | base_game | bin/data/drl/items/eitems.lua:894 |
| ubloodboots | blood boots | base_game | bin/data/drl/items/eitems.lua:911 |
| umod_firestorm | firestorm weapon pack | base_game | bin/data/drl/items/eitems.lua:930 |
| umod_sniper | sniper weapon pack | base_game | bin/data/drl/items/eitems.lua:987 |
| umod_nano | nano pack | base_game | bin/data/drl/items/eitems.lua:1042 |
| umod_onyx | onyx armor pack | base_game | bin/data/drl/items/eitems.lua:1138 |
| uswpack | shockwave pack | base_game | bin/data/drl/items/eitems.lua:1180 |
| ubskull | blood skull | base_game | bin/data/drl/items/eitems.lua:1202 |
| ufskull | fire skull | base_game | bin/data/drl/items/eitems.lua:1232 |
| uhskull | hatred skull | base_game | bin/data/drl/items/eitems.lua:1261 |
| knife | combat knife | base_game | bin/data/drl/items/items.lua:5 |
| garmor | green armor | base_game | bin/data/drl/items/items.lua:38 |
| barmor | blue armor | base_game | bin/data/drl/items/items.lua:56 |
| rarmor | red armor | base_game | bin/data/drl/items/items.lua:74 |
| sboots | steel boots | base_game | bin/data/drl/items/items.lua:92 |
| pboots | protective boots | base_game | bin/data/drl/items/items.lua:109 |
| psboots | plasteel boots | base_game | bin/data/drl/items/items.lua:129 |
| shglobe | Small Health Globe | base_game | bin/data/drl/items/items.lua:150 |
| bpack | Berserk Pack | base_game | bin/data/drl/items/items.lua:169 |
| iglobe | Invulnerability Globe | base_game | bin/data/drl/items/items.lua:188 |
| scglobe | Supercharge Globe | base_game | bin/data/drl/items/items.lua:205 |
| lhglobe | Large Health Globe | base_game | bin/data/drl/items/items.lua:225 |
| msglobe | Megasphere | base_game | bin/data/drl/items/items.lua:247 |
| map | Computer Map | base_game | bin/data/drl/items/items.lua:270 |
| pmap | Tracking Map | base_game | bin/data/drl/items/items.lua:298 |
| gpack | Light-Amp Goggles | base_game | bin/data/drl/items/items.lua:323 |
| backpack | Backpack | base_game | bin/data/drl/items/items.lua:339 |
| ashard | armor shard | base_game | bin/data/drl/items/items.lua:365 |
| ammo | 10mm ammo | base_game | bin/data/drl/items/items.lua:409 |
| shell | shotgun shell | base_game | bin/data/drl/items/items.lua:424 |
| rocket | rocket | base_game | bin/data/drl/items/items.lua:439 |
| cell | power cell | base_game | bin/data/drl/items/items.lua:454 |
| pammo | 10mm ammo chain | base_game | bin/data/drl/items/items.lua:470 |
| pshell | shell box | base_game | bin/data/drl/items/items.lua:486 |
| procket | rocket box | base_game | bin/data/drl/items/items.lua:502 |
| pcell | power battery | base_game | bin/data/drl/items/items.lua:518 |
| pistol | pistol | base_game | bin/data/drl/items/items.lua:538 |
| shotgun | shotgun | base_game | bin/data/drl/items/items.lua:569 |
| dshotgun | double shotgun | base_game | bin/data/drl/items/items.lua:594 |
| ashotgun | combat shotgun | base_game | bin/data/drl/items/items.lua:626 |
| bazooka | rocket launcher | base_game | bin/data/drl/items/items.lua:657 |
| chaingun | chaingun | base_game | bin/data/drl/items/items.lua:694 |
| plasma | plasma rifle | base_game | bin/data/drl/items/items.lua:727 |
| smed | small med-pack | base_game | bin/data/drl/items/items.lua:764 |
| lmed | large med-pack | base_game | bin/data/drl/items/items.lua:799 |
| phase | phase device | base_game | bin/data/drl/items/items.lua:834 |
| hphase | homing phase device | base_game | bin/data/drl/items/items.lua:860 |
| epack | envirosuit pack | base_game | bin/data/drl/items/items.lua:890 |
| nuke | thermonuclear bomb | base_game | bin/data/drl/items/items.lua:910 |
| mod_power | power mod pack | base_game | bin/data/drl/items/items.lua:969 |
| mod_tech | technical mod pack | base_game | bin/data/drl/items/items.lua:1035 |
| mod_agility | agility mod pack | base_game | bin/data/drl/items/items.lua:1091 |
| mod_bulk | bulk mod pack | base_game | bin/data/drl/items/items.lua:1155 |
| barrel | barrel of fuel | base_game | bin/data/drl/items/items.lua:1226 |
| barrela | barrel of acid | base_game | bin/data/drl/items/items.lua:1251 |
| barreln | barrel of napalm | base_game | bin/data/drl/items/items.lua:1278 |
| tree | Phobos tree | base_game | bin/data/drl/items/items.lua:1307 |
| lever_flood_water | lever | base_game | bin/data/drl/items/items.lua:1324 |
| lever_flood_acid | lever | base_game | bin/data/drl/items/items.lua:1355 |
| lever_flood_lava | lever | base_game | bin/data/drl/items/items.lua:1391 |
| lever_kill | lever | base_game | bin/data/drl/items/items.lua:1426 |
| lever_explode | lever | base_game | bin/data/drl/items/items.lua:1461 |
| lever_walls | lever | base_game | bin/data/drl/items/items.lua:1495 |
| lever_summon | lever | base_game | bin/data/drl/items/items.lua:1535 |
| lever_repair | lever | base_game | bin/data/drl/items/items.lua:1576 |
| lever_medical | lever | base_game | bin/data/drl/items/items.lua:1639 |
| lever_ammo | lever | base_game | bin/data/drl/items/items.lua:1684 |
| schematic_0 | schematics | base_game | bin/data/drl/items/items.lua:1727 |
| schematic_1 | schematics | base_game | bin/data/drl/items/items.lua:1748 |
| schematic_2 | schematics | base_game | bin/data/drl/items/items.lua:1769 |
| lava_element | lava element | base_game | bin/data/drl/items/items.lua:1791 |
| unullpointer | Charch's Null Pointer | base_game | bin/data/drl/items/uitems.lua:78 |
| umodstaff | Hell Staff | base_game | bin/data/drl/items/uitems.lua:113 |
| ubutcher | Butcher's Cleaver | base_game | bin/data/drl/items/uitems.lua:153 |
| umjoll | Mjollnir | base_game | bin/data/drl/items/uitems.lua:178 |
| usubtle | Subtle Knife | base_game | bin/data/drl/items/uitems.lua:237 |
| utrigun | Trigun | base_game | bin/data/drl/items/uitems.lua:286 |
| ujackal | Anti-Freak Jackal | base_game | bin/data/drl/items/uitems.lua:321 |
| umega | Mega Buster | base_game | bin/data/drl/items/uitems.lua:437 |
| uberetta | Grammaton Cleric Beretta | base_game | bin/data/drl/items/uitems.lua:510 |
| usjack | Jackhammer | base_game | bin/data/drl/items/uitems.lua:573 |
| ufshotgun | Frag Shotgun | base_game | bin/data/drl/items/uitems.lua:604 |
| urbazooka | Revenant's Launcher | base_game | bin/data/drl/items/uitems.lua:632 |
| uacid | Acid Spitter | base_game | bin/data/drl/items/uitems.lua:687 |
| ubfg10k | BFG 10K | base_game | bin/data/drl/items/uitems.lua:730 |
| urailgun | Railgun | base_game | bin/data/drl/items/uitems.lua:772 |
| umarmor | Malek's Armor | base_game | bin/data/drl/items/uitems.lua:806 |
| ucarmor | Cybernetic Armor | base_game | bin/data/drl/items/uitems.lua:834 |
| unarmor | Necroarmor | base_game | bin/data/drl/items/uitems.lua:858 |
| umedparmor | Medical Powerarmor | base_game | bin/data/drl/items/uitems.lua:903 |
| ulavaarmor | Lava Armor | base_game | bin/data/drl/items/uitems.lua:944 |
| uenviroboots | Enviroboots | base_game | bin/data/drl/items/uitems.lua:969 |
| unboots | Nyarlaptotep's Boots | base_game | bin/data/drl/items/uitems.lua:988 |
| ushieldarmor | Shielded Armor | base_game | bin/data/drl/items/uitems.lua:1014 |
| uhwpack | Hellwave Pack | base_game | bin/data/drl/items/uitems.lua:1035 |
| aarmor | Angelic Armor | base_game | bin/data/drl/items/uitems.lua:1059 |
| uberarmor | Berserker Armor | base_game | bin/data/drl/items/uitems.lua:1107 |
| udragon | Dragonslayer | base_game | bin/data/drl/items/uitems.lua:1216 |
| lever_spec3 | lever | base_game | bin/data/drl/levels/armory.lua:16 |
| hellportal | Hellgate | base_game | bin/data/drl/levels/boss.lua:45 |
| dis_switch | lever | base_game | bin/data/drl/levels/boss.lua:235 |
| lever_centralprocessing1 | lever | base_game | bin/data/drl/levels/centralprocessing.lua:11 |
| lever_centralprocessing2 | lever | base_game | bin/data/drl/levels/centralprocessing.lua:40 |
| lever_centralprocessing3 | lever | base_game | bin/data/drl/levels/centralprocessing.lua:64 |
| lever_centralprocessing4 | lever | base_game | bin/data/drl/levels/centralprocessing.lua:91 |
| lever_centralprocessing5 | lever | base_game | bin/data/drl/levels/centralprocessing.lua:115 |
| uarenastaff | Arena Master's Staff | base_game | bin/data/drl/levels/chained.lua:12 |
| lever_chain1 | lever | base_game | bin/data/drl/levels/chained.lua:67 |
| lever_chain2 | lever | base_game | bin/data/drl/levels/chained.lua:96 |
| lever_chain3 | lever | base_game | bin/data/drl/levels/chained.lua:125 |
| lever_deimoslab | lever | base_game | bin/data/drl/levels/deimoslab.lua:16 |
| spear | Longinus Spear | base_game | bin/data/drl/levels/fortress.lua:37 |
| uscythe | Azrael's Scythe | base_game | bin/data/drl/levels/fortress.lua:94 |
| lever_limbow | lever | base_game | bin/data/drl/levels/limbo.lua:15 |
| lever_limboe | lever | base_game | bin/data/drl/levels/limbo.lua:41 |
| lever_erebus | lever | base_game | bin/data/drl/levels/mterebus.lua:11 |
| lever_phoboslab1 | lever | base_game | bin/data/drl/levels/phoboslab.lua:11 |
| lever_phoboslab2 | lever | base_game | bin/data/drl/levels/phoboslab.lua:37 |
| lever_toxinrefinery1 | lever | base_game | bin/data/drl/levels/toxinrefinery.lua:11 |
| lever_toxinrefinery2 | lever | base_game | bin/data/drl/levels/toxinrefinery.lua:39 |
| lever_toxinrefinery3 | lever | base_game | bin/data/drl/levels/toxinrefinery.lua:62 |
| stubitem | stubitem | base_game | bin/data/drl/main.lua:165 |
| teleport | teleport | base_game | bin/data/drl/main.lua:177 |

## itemset

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| gothic | Gothic Arms | base_game | bin/data/drl/items/eitems.lua:4 |
| phaseshift | Phaseshift Suit | base_game | bin/data/drl/items/eitems.lua:34 |
| angelic | Angelic Attire | base_game | bin/data/drl/items/uitems.lua:3 |
| inquisitor | Inquisitor Set | base_game | bin/data/drl/items/uitems.lua:26 |

## klass

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| marine | Marine | base_game | bin/data/drl/klass.lua:3 |
| scout | Scout | base_game | bin/data/drl/klass.lua:60 |
| technician | Technician | base_game | bin/data/drl/klass.lua:105 |
| soldat | Soldier | base_game | bin/data/drl/klass.lua:150 |

## level

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| abyssal_plains | Abyssal Plains | base_game | bin/data/drl/levels/abyssal.lua:3 |
| hells_arena | Hell's Arena | base_game | bin/data/drl/levels/arena.lua:3 |
| hells_armory | Hell's Armory | base_game | bin/data/drl/levels/armory.lua:3 |
| hellgate | Phobos Anomaly | base_game | bin/data/drl/levels/boss.lua:38 |
| tower_of_babel | Tower of Babel | base_game | bin/data/drl/levels/boss.lua:179 |
| dis | Dis | base_game | bin/data/drl/levels/boss.lua:228 |
| hell_fortress | Hell Fortress | base_game | bin/data/drl/levels/boss.lua:329 |
| halls_of_carnage | Halls of Carnage | base_game | bin/data/drl/levels/carnage.lua:3 |
| central_processing | Central Processing | base_game | bin/data/drl/levels/centralprocessing.lua:3 |
| the_chained_court | The Chained Court | base_game | bin/data/drl/levels/chained.lua:3 |
| containment_area | Containment Area | base_game | bin/data/drl/levels/containment.lua:3 |
| deimos_lab | Deimos Lab | base_game | bin/data/drl/levels/deimoslab.lua:3 |
| unholy_cathedral | Unholy Cathedral | base_game | bin/data/drl/levels/fortress.lua:3 |
| house_of_pain | House of Pain | base_game | bin/data/drl/levels/house.lua:3 |
| intro | Phobos Base Entry | base_game | bin/data/drl/levels/intro.lua:3 |
| the_lava_pits | The Lava Pits | base_game | bin/data/drl/levels/lavapits.lua:3 |
| limbo | Limbo | base_game | bin/data/drl/levels/limbo.lua:3 |
| military_base | Military Base | base_game | bin/data/drl/levels/milibase.lua:3 |
| the_mortuary | The Mortuary | base_game | bin/data/drl/levels/mortuary.lua:3 |
| mt_erebus | Mt. Erebus | base_game | bin/data/drl/levels/mterebus.lua:3 |
| phobos_lab | Phobos Lab | base_game | bin/data/drl/levels/phoboslab.lua:3 |
| city_of_skulls | City of Skulls | base_game | bin/data/drl/levels/skulls.lua:3 |
| spiders_lair | Spider's Lair | base_game | bin/data/drl/levels/spider.lua:3 |
| toxin_refinery | Toxin Refinery | base_game | bin/data/drl/levels/toxinrefinery.lua:3 |
| the_vaults | The Vaults | base_game | bin/data/drl/levels/vaults.lua:3 |
| the_wall | The Wall | base_game | bin/data/drl/levels/wall.lua:3 |
| phobos_arena | Phobos Arena | bundled_classic | bin/modules/classic.module/data/phobos_arena.lua:1 |

## medal

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| killall | Medal of Prejudice | base_game | bin/data/drl/awards.lua:111 |
| killfew | Medal of Pacifism | base_game | bin/data/drl/awards.lua:119 |
| shotguns | Shotgunnery Cross | base_game | bin/data/drl/awards.lua:127 |
| pistols | Marksmanship Cross | base_game | bin/data/drl/awards.lua:136 |
| knives | Malicious Knives Cross | base_game | bin/data/drl/awards.lua:145 |
| fist | Sunrise Iron Fist | base_game | bin/data/drl/awards.lua:154 |
| zen | Zen Master's Cross | base_game | bin/data/drl/awards.lua:164 |
| uac1 | UAC Star (bronze cluster) | base_game | bin/data/drl/awards.lua:174 |
| uac2 | UAC Star (silver cluster) | base_game | bin/data/drl/awards.lua:181 |
| uac3 | UAC Star (gold cluster) | base_game | bin/data/drl/awards.lua:189 |
| icarus1 | Minor Icarus Cross | base_game | bin/data/drl/awards.lua:197 |
| icarus2 | Major Icarus Cross | base_game | bin/data/drl/awards.lua:205 |
| gambler | Gambler's Shield | base_game | bin/data/drl/awards.lua:214 |
| aurora | Aurora Medallion | base_game | bin/data/drl/awards.lua:221 |
| explorer | Explorer Pin | base_game | bin/data/drl/awards.lua:228 |
| conqueror | Conqueror Pin | base_game | bin/data/drl/awards.lua:235 |
| competn1 | Compet-n Silver Cross | base_game | bin/data/drl/awards.lua:243 |
| competn2 | Compet-n Gold Cross | base_game | bin/data/drl/awards.lua:251 |
| competn3 | Compet-n Platinum Cross | base_game | bin/data/drl/awards.lua:260 |
| fallout1 | Fallout Gold Cross | base_game | bin/data/drl/awards.lua:269 |
| fallout2 | Fallout Platinum Cross | base_game | bin/data/drl/awards.lua:277 |
| fallout3 | Klear Cross | base_game | bin/data/drl/awards.lua:286 |
| ironskull1 | Iron Skull | base_game | bin/data/drl/awards.lua:296 |
| untouchable1 | Untouchable Pin | base_game | bin/data/drl/awards.lua:304 |
| untouchable2 | Untouchable Medal | base_game | bin/data/drl/awards.lua:312 |
| untouchable3 | Untouchable Cross | base_game | bin/data/drl/awards.lua:322 |
| experience1 | Experience Medal | base_game | bin/data/drl/awards.lua:332 |
| experience2 | Experience Cross | base_game | bin/data/drl/awards.lua:339 |
| purple | Purple Heart | base_game | bin/data/drl/awards.lua:348 |
| mortuary | Grim Reaper's Pin | base_game | bin/data/drl/awards.lua:604 |
| mortuary2 | Angelic Pin | base_game | bin/data/drl/awards.lua:611 |
| armory1 | Hell Armorer Pin | base_game | bin/data/drl/awards.lua:654 |
| armory2 | Shambler's Head | base_game | bin/data/drl/awards.lua:661 |
| everysoldier | Every Soldier's Medal | base_game | bin/data/drl/awards.lua:683 |
| cyberdemon1 | Cyberdemon's Head | base_game | bin/data/drl/beings.lua:1390 |
| mastermind1 | Mastermind's Brain | base_game | bin/data/drl/beings.lua:1445 |
| dragonslayer2 | Apostle Insignia | base_game | bin/data/drl/beings.lua:1562 |
| gargulec1 | Gargulec Medal | base_game | bin/data/drl/challenge.lua:55 |
| gargulec2 | Gargulec Cross | base_game | bin/data/drl/challenge.lua:62 |
| dervis | Dervis' Medallion | base_game | bin/data/drl/challenge.lua:1045 |
| thomas | Thomas's Medal | base_game | bin/data/drl/challenge.lua:1359 |
| cleric | Grammaton Cleric Cross | base_game | bin/data/drl/items/uitems.lua:471 |
| dragonslayer | Gutts' Heart | base_game | bin/data/drl/items/uitems.lua:1134 |
| dragonslayed | Gutts' Sorrow | base_game | bin/data/drl/items/uitems.lua:1142 |
| chessmaster1 | Chessmaster's Token | base_game | bin/data/drl/levels/arena.lua:13 |
| chessmaster2 | Chessmaster's Cross | base_game | bin/data/drl/levels/arena.lua:20 |
| hellchampion | Hell Champion Medal | base_game | bin/data/drl/levels/arena.lua:28 |
| hellchampion2 | Hell Arena Key | base_game | bin/data/drl/levels/arena.lua:35 |
| hellchampion3 | Hell Arena Pwnage Medal | base_game | bin/data/drl/levels/arena.lua:43 |
| everyspider | Spider-Killer Cross | base_game | bin/data/drl/levels/spider.lua:27 |

## mod_array

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| chainsword | chainsword | base_game | bin/data/drl/assemblies.lua:5 |
| pblade | piercing blade | base_game | bin/data/drl/assemblies.lua:19 |
| speedloader | speedloader pistol | base_game | bin/data/drl/assemblies.lua:34 |
| elephant | elephant gun | base_game | bin/data/drl/assemblies.lua:48 |
| gatling | gatling gun | base_game | bin/data/drl/assemblies.lua:62 |
| micro | micro launcher | base_game | bin/data/drl/assemblies.lua:77 |
| tarmor | tactical armor | base_game | bin/data/drl/assemblies.lua:94 |
| tboots | tactical boots | base_game | bin/data/drl/assemblies.lua:119 |
| nanofiber | nanofiber armor | base_game | bin/data/drl/assemblies.lua:143 |
| high | high power weapon | base_game | bin/data/drl/assemblies.lua:164 |
| power | power armor | base_game | bin/data/drl/assemblies.lua:187 |
| tshotgun | tactical shotgun | base_game | bin/data/drl/assemblies.lua:229 |
| plate | tower shield | base_game | bin/data/drl/assemblies.lua:248 |
| fparmor | fireproof armor | base_game | bin/data/drl/assemblies.lua:269 |
| fpboots | fireproof boots | base_game | bin/data/drl/assemblies.lua:287 |
| balarmor | ballistic armor | base_game | bin/data/drl/assemblies.lua:303 |
| plasmatic | plasmatic shrapnel | base_game | bin/data/drl/assemblies.lua:323 |
| gboots | grappling boots | base_game | bin/data/drl/assemblies.lua:340 |
| grarmor | grappling armor | base_game | bin/data/drl/assemblies.lua:354 |
| lavboots | lava boots | base_game | bin/data/drl/assemblies.lua:371 |
| double | double chainsaw | base_game | bin/data/drl/assemblies.lua:389 |
| tacticalrl | tactical rocket launcher | base_game | bin/data/drl/assemblies.lua:404 |
| storm | storm bolter pistol | base_game | bin/data/drl/assemblies.lua:419 |
| rifle | assault rifle | base_game | bin/data/drl/assemblies.lua:443 |
| energy | energy pistol | base_game | bin/data/drl/assemblies.lua:465 |
| assault | burst cannon | base_game | bin/data/drl/assemblies.lua:487 |
| vbfg9000 | VBFG9000 | base_game | bin/data/drl/assemblies.lua:509 |
| envboots | environmental boots | base_game | bin/data/drl/assemblies.lua:535 |
| fireshield | fire shield | base_game | bin/data/drl/assemblies.lua:557 |
| nanoskin | nanofiber skin armor | base_game | bin/data/drl/assemblies.lua:578 |
| gravity | antigrav boots | base_game | bin/data/drl/assemblies.lua:610 |
| hyperblaster | hyperblaster | base_game | bin/data/drl/assemblies.lua:624 |
| fdshotgun | focused double shotgun | base_game | bin/data/drl/assemblies.lua:642 |
| nanomanufacture | nanomanufacture ammo | base_game | bin/data/drl/assemblies.lua:663 |
| nsharpnel | nano-shrapnel | base_game | bin/data/drl/assemblies.lua:685 |
| demolition | demolition ammo | base_game | bin/data/drl/assemblies.lua:707 |
| cybernano | cybernano armor | base_game | bin/data/drl/assemblies.lua:733 |
| biggest | biggest fucking gun | base_game | bin/data/drl/assemblies.lua:751 |
| ripper | ripper | base_game | bin/data/drl/assemblies.lua:777 |
| cerboots | cerberus boots | base_game | bin/data/drl/assemblies.lua:793 |
| cerarmor | cerberus armor | base_game | bin/data/drl/assemblies.lua:812 |
| mother | Mother-In-Law | base_game | bin/data/drl/assemblies.lua:831 |

## perk

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| tired | — | base_game | bin/data/drl/affects.lua:3 |
| running | — | base_game | bin/data/drl/affects.lua:16 |
| berserk | — | base_game | bin/data/drl/affects.lua:49 |
| inv | — | base_game | bin/data/drl/affects.lua:94 |
| enviro | — | base_game | bin/data/drl/affects.lua:122 |
| light | — | base_game | bin/data/drl/affects.lua:151 |
| event_ice | Frozen Hell | base_game | bin/data/drl/events.lua:4 |
| event_perma | Bulwark | base_game | bin/data/drl/events.lua:29 |
| event_alarm | Alarm | base_game | bin/data/drl/events.lua:46 |
| event_deadly_air | Deadly Air | base_game | bin/data/drl/events.lua:63 |
| event_nuke | Armed Nuke | base_game | bin/data/drl/events.lua:98 |
| event_flood_acid | Acid Flood | base_game | bin/data/drl/events.lua:118 |
| event_flood_lava | Lava Flood | base_game | bin/data/drl/events.lua:144 |
| event_flood_blood | Blood Flood | base_game | bin/data/drl/events.lua:172 |
| event_targeted | Targeted | base_game | bin/data/drl/events.lua:200 |
| event_explosion | Bombardment | base_game | bin/data/drl/events.lua:251 |
| event_explosion_lava | Lava Bombardment | base_game | bin/data/drl/events.lua:279 |
| event_darkness | Pitch Black | base_game | bin/data/drl/events.lua:307 |
| perk_utrans_hit | — | base_game | bin/data/drl/items/eitems.lua:520 |
| perk_utrans_altfire |  | base_game | bin/data/drl/items/eitems.lua:531 |
| perk_umedarmor | — | base_game | bin/data/drl/items/eitems.lua:721 |
| perk_unullpointer_hit | — | base_game | bin/data/drl/items/uitems.lua:63 |
| perk_ubutcher_kill | — | base_game | bin/data/drl/items/uitems.lua:141 |
| perk_usubtle_altfire |  | base_game | bin/data/drl/items/uitems.lua:210 |
| perk_uni_trigun_altreload | — | base_game | bin/data/drl/items/uitems.lua:263 |
| perk_umega_kill | — | base_game | bin/data/drl/items/uitems.lua:359 |
| perk_uberetta_altreload | — | base_game | bin/data/drl/items/uitems.lua:478 |
| perk_uberetta_kill | — | base_game | bin/data/drl/items/uitems.lua:543 |
| perk_usjack_altreload | — | base_game | bin/data/drl/items/uitems.lua:552 |
| perk_uacid | — | base_game | bin/data/drl/items/uitems.lua:666 |
| perk_umedparmor | — | base_game | bin/data/drl/items/uitems.lua:880 |
| perk_ulavaarmor | — | base_game | bin/data/drl/items/uitems.lua:924 |
| perk_uberarmor | — | base_game | bin/data/drl/items/uitems.lua:1079 |
| perk_udragon | — | base_game | bin/data/drl/items/uitems.lua:1150 |
| perk_udragon_altfire | — | base_game | bin/data/drl/items/uitems.lua:1187 |
| perk_spear_altfire | — | base_game | bin/data/drl/levels/fortress.lua:16 |
| perk_uscythe_altfire | — | base_game | bin/data/drl/levels/fortress.lua:67 |
| perk_cursed |  | base_game | bin/data/drl/perks.lua:4 |
| perk_altfire_throw |  | base_game | bin/data/drl/perks.lua:22 |
| perk_altfire_rocketjump |  | base_game | bin/data/drl/perks.lua:49 |
| perk_altfire_single |  | base_game | bin/data/drl/perks.lua:95 |
| perk_altfire_aimed |  | base_game | bin/data/drl/perks.lua:128 |
| perk_altfire_chainfire |  | base_game | bin/data/drl/perks.lua:171 |
| perk_altreload_full |  | base_game | bin/data/drl/perks.lua:204 |
| perk_altreload_nuke |  | base_game | bin/data/drl/perks.lua:223 |
| perk_altreload_overcharge |  | base_game | bin/data/drl/perks.lua:252 |
| perk_pump_action | — | base_game | bin/data/drl/perks.lua:284 |
| perk_weapon_recharge | — | base_game | bin/data/drl/perks.lua:352 |
| perk_armor_recharge | — | base_game | bin/data/drl/perks.lua:388 |
| perk_necrocharge | — | base_game | bin/data/drl/perks.lua:425 |

## rank

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| skill | Private | base_game | bin/data/drl/ranks.lua:80 |
| skill | Private FC | base_game | bin/data/drl/ranks.lua:86 |
| skill | Lance Corporal | base_game | bin/data/drl/ranks.lua:92 |
| skill | Corporal | base_game | bin/data/drl/ranks.lua:100 |
| skill | Sergeant | base_game | bin/data/drl/ranks.lua:108 |
| skill | Sergeant Major | base_game | bin/data/drl/ranks.lua:117 |
| skill | Warrant Officer | base_game | bin/data/drl/ranks.lua:126 |
| skill | 2nd Lieutenant | base_game | bin/data/drl/ranks.lua:135 |
| skill | 1st Lieutenant | base_game | bin/data/drl/ranks.lua:144 |
| skill | Captain | base_game | bin/data/drl/ranks.lua:153 |
| skill | Major | base_game | bin/data/drl/ranks.lua:162 |
| skill | Lt. Colonel | base_game | bin/data/drl/ranks.lua:171 |
| skill | Colonel | base_game | bin/data/drl/ranks.lua:180 |
| skill | Br. General | base_game | bin/data/drl/ranks.lua:190 |
| skill | Mjr General | base_game | bin/data/drl/ranks.lua:199 |
| skill | Lt. General | base_game | bin/data/drl/ranks.lua:208 |
| skill | General | base_game | bin/data/drl/ranks.lua:217 |
| skill | Marshal | base_game | bin/data/drl/ranks.lua:227 |
| skill | Chaos Major | base_game | bin/data/drl/ranks.lua:236 |
| skill | Chaos Lt. Colonel | base_game | bin/data/drl/ranks.lua:244 |
| skill | Chaos Colonel | base_game | bin/data/drl/ranks.lua:252 |
| skill | Chaos Br. General | base_game | bin/data/drl/ranks.lua:260 |
| skill | Chaos Mjr General | base_game | bin/data/drl/ranks.lua:268 |
| skill | Chaos Lt. General | base_game | bin/data/drl/ranks.lua:276 |
| skill | Chaos General | base_game | bin/data/drl/ranks.lua:284 |
| skill | Chaos Marshal | base_game | bin/data/drl/ranks.lua:292 |
| skill | No-Life King | base_game | bin/data/drl/ranks.lua:300 |
| exp | Human | base_game | bin/data/drl/ranks.lua:310 |
| exp | Former Human | base_game | bin/data/drl/ranks.lua:316 |
| exp | Imp | base_game | bin/data/drl/ranks.lua:322 |
| exp | Demon | base_game | bin/data/drl/ranks.lua:331 |
| exp | Cacodemon | base_game | bin/data/drl/ranks.lua:341 |
| exp | Mancubus | base_game | bin/data/drl/ranks.lua:351 |
| exp | Hell Knight | base_game | bin/data/drl/ranks.lua:361 |
| exp | Hell Baron | base_game | bin/data/drl/ranks.lua:371 |
| exp | Arch-Vile | base_game | bin/data/drl/ranks.lua:381 |
| exp | Cyberdemon | base_game | bin/data/drl/ranks.lua:391 |
| exp | Apostle | base_game | bin/data/drl/ranks.lua:400 |

## requirement

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| kill_total | — | base_game | bin/data/drl/ranks.lua:3 |
| kill_melee | — | base_game | bin/data/drl/ranks.lua:21 |
| kill_pistol | — | base_game | bin/data/drl/ranks.lua:39 |
| aquire_badges | — | base_game | bin/data/drl/ranks.lua:57 |

## room

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| lever_room | — | base_game | bin/data/drl/rooms.lua:3 |
| teleport_room | — | base_game | bin/data/drl/rooms.lua:43 |
| ammo_room | — | base_game | bin/data/drl/rooms.lua:61 |
| basain_room | — | base_game | bin/data/drl/rooms.lua:99 |
| warehouse_room | — | base_game | bin/data/drl/rooms.lua:123 |
| vault_room | — | base_game | bin/data/drl/rooms.lua:134 |

## trait

| ID / ordered type | Display name | Scope | Source |
| --- | --- | --- | --- |
| trait_marine |  | base_game | bin/data/drl/traits.lua:3 |
| ironman | Ironman | base_game | bin/data/drl/traits.lua:11 |
| finesse | Finesse | base_game | bin/data/drl/traits.lua:29 |
| hellrunner | Hellrunner | base_game | bin/data/drl/traits.lua:41 |
| nails | Tough as nails | base_game | bin/data/drl/traits.lua:57 |
| bitch | Son of a bitch | base_game | bin/data/drl/traits.lua:72 |
| gun | Son of a gun | base_game | bin/data/drl/traits.lua:88 |
| reloader | Reloader | base_game | bin/data/drl/traits.lua:114 |
| eagle | Eagle Eye | base_game | bin/data/drl/traits.lua:126 |
| brute | Brute | base_game | bin/data/drl/traits.lua:138 |
| juggler | Juggler | base_game | bin/data/drl/traits.lua:164 |
| berserker | Berserker | base_game | bin/data/drl/traits.lua:177 |
| dualgunner | Dualgunner | base_game | bin/data/drl/traits.lua:231 |
| dodgemaster | Dodgemaster | base_game | bin/data/drl/traits.lua:249 |
| intuition | Intuition | base_game | bin/data/drl/traits.lua:262 |
| whizkid | Whizkid | base_game | bin/data/drl/traits.lua:299 |
| badass | Badass | base_game | bin/data/drl/traits.lua:312 |
| shottyman | Shottyman | base_game | bin/data/drl/traits.lua:329 |
| triggerhappy | Triggerhappy | base_game | bin/data/drl/traits.lua:352 |
| blademaster | Blademaster | base_game | bin/data/drl/traits.lua:373 |
| vampyre | Vampyre | base_game | bin/data/drl/traits.lua:392 |
| malicious | Malicious Blades | base_game | bin/data/drl/traits.lua:412 |
| bulletdance | Bullet Dance | base_game | bin/data/drl/traits.lua:452 |
| gunkata | Gun Kata | base_game | bin/data/drl/traits.lua:480 |
| sharpshooter | Sharpshooter | base_game | bin/data/drl/traits.lua:523 |
| armydead | Army of the Dead | base_game | bin/data/drl/traits.lua:565 |
| shottyhead | Shottyhead | base_game | bin/data/drl/traits.lua:579 |
| fireangel | Fireangel | base_game | bin/data/drl/traits.lua:597 |
| ammochain | Ammochain | base_game | bin/data/drl/traits.lua:612 |
| cateye | Cateye | base_game | bin/data/drl/traits.lua:632 |
| entrenchment | Entrenchment | base_game | bin/data/drl/traits.lua:645 |
| survivalist | Survivalist | base_game | bin/data/drl/traits.lua:671 |
| runningman | Running Man | base_game | bin/data/drl/traits.lua:686 |
| gunrunner | Gunrunner | base_game | bin/data/drl/traits.lua:700 |
| scavenger | Scavenger | base_game | bin/data/drl/traits.lua:729 |

## Anonymous and generated definitions

| Category | ID / array index | Source |
| --- | --- | --- |
| being_group | array 1 (base_game) | bin/data/drl/beings.lua:1658 |
| being_group | array 2 (base_game) | bin/data/drl/beings.lua:1669 |
| being_group | array 3 (base_game) | bin/data/drl/beings.lua:1679 |
| being_group | array 4 (base_game) | bin/data/drl/beings.lua:1690 |
| being_group | array 5 (base_game) | bin/data/drl/beings.lua:1701 |
| being_group | array 6 (base_game) | bin/data/drl/beings.lua:1712 |
| being_group | array 7 (base_game) | bin/data/drl/beings.lua:1723 |
| being_group | array 8 (base_game) | bin/data/drl/beings.lua:1733 |
| being_group | array 9 (base_game) | bin/data/drl/beings.lua:1744 |
| being_group | array 10 (base_game) | bin/data/drl/beings.lua:1753 |
| being_group | array 11 (base_game) | bin/data/drl/beings.lua:1766 |
| being_group | array 12 (base_game) | bin/data/drl/beings.lua:1778 |
| being_group | array 13 (base_game) | bin/data/drl/beings.lua:1788 |
| being_group | array 14 (base_game) | bin/data/drl/beings.lua:1798 |
| being_group | array 15 (base_game) | bin/data/drl/beings.lua:1808 |
| being_group | array 16 (base_game) | bin/data/drl/beings.lua:1821 |
| being_group | array 17 (base_game) | bin/data/drl/beings.lua:1831 |
| being_group | array 18 (base_game) | bin/data/drl/beings.lua:1841 |
| being_group | array 19 (base_game) | bin/data/drl/beings.lua:1851 |
| being_group | array 20 (base_game) | bin/data/drl/beings.lua:1861 |
| being_group | array 21 (base_game) | bin/data/drl/beings.lua:1870 |
| being_group | array 22 (base_game) | bin/data/drl/beings.lua:1881 |
| being_group | array 23 (base_game) | bin/data/drl/beings.lua:1891 |
| being_group | array 24 (base_game) | bin/data/drl/beings.lua:1903 |
| being_group | array 25 (base_game) | bin/data/drl/beings.lua:1914 |
| being_group | array 26 (base_game) | bin/data/drl/beings.lua:1925 |
| being_group | array 27 (base_game) | bin/data/drl/beings.lua:1934 |
| being_group | array 28 (base_game) | bin/data/drl/beings.lua:1944 |
| being_group | array 29 (base_game) | bin/data/drl/beings.lua:1954 |
| being_group | array 30 (base_game) | bin/data/drl/beings.lua:1964 |
| being_group | array 31 (base_game) | bin/data/drl/beings.lua:1974 |
| being_group | array 32 (base_game) | bin/data/drl/beings.lua:1984 |
| being_group | array 33 (base_game) | bin/data/drl/beings.lua:1994 |
| being_group | array 34 (base_game) | bin/data/drl/beings.lua:2005 |
| being_group | array 35 (base_game) | bin/data/drl/beings.lua:2015 |
| cell | formercorpse | bin/data/drl/beings.lua:5 → bin/data/core/main.lua:register_corpse |
| cell | sergeantcorpse | bin/data/drl/beings.lua:30 → bin/data/core/main.lua:register_corpse |
| cell | captaincorpse | bin/data/drl/beings.lua:57 → bin/data/core/main.lua:register_corpse |
| cell | commandocorpse | bin/data/drl/beings.lua:83 → bin/data/core/main.lua:register_corpse |
| item | nat_imp | bin/data/drl/beings.lua:113 → bin/data/core/main.lua:register_being |
| cell | impcorpse | bin/data/drl/beings.lua:113 → bin/data/core/main.lua:register_corpse |
| cell | demoncorpse | bin/data/drl/beings.lua:157 → bin/data/core/main.lua:register_corpse |
| item | nat_cacodemon | bin/data/drl/beings.lua:209 → bin/data/core/main.lua:register_being |
| cell | cacodemoncorpse | bin/data/drl/beings.lua:209 → bin/data/core/main.lua:register_corpse |
| item | nat_knight | bin/data/drl/beings.lua:251 → bin/data/core/main.lua:register_being |
| cell | knightcorpse | bin/data/drl/beings.lua:251 → bin/data/core/main.lua:register_corpse |
| item | nat_baron | bin/data/drl/beings.lua:299 → bin/data/core/main.lua:register_being |
| cell | baroncorpse | bin/data/drl/beings.lua:299 → bin/data/core/main.lua:register_corpse |
| item | nat_arachno | bin/data/drl/beings.lua:346 → bin/data/core/main.lua:register_being |
| cell | arachnocorpse | bin/data/drl/beings.lua:346 → bin/data/core/main.lua:register_corpse |
| item | nat_revenant | bin/data/drl/beings.lua:422 → bin/data/core/main.lua:register_being |
| cell | revenantcorpse | bin/data/drl/beings.lua:422 → bin/data/core/main.lua:register_corpse |
| item | nat_mancubus | bin/data/drl/beings.lua:471 → bin/data/core/main.lua:register_being |
| cell | mancubuscorpse | bin/data/drl/beings.lua:471 → bin/data/core/main.lua:register_corpse |
| item | nat_arch | bin/data/drl/beings.lua:519 → bin/data/core/main.lua:register_being |
| item | nat_nimp | bin/data/drl/beings.lua:718 → bin/data/core/main.lua:register_being |
| cell | nimpcorpse | bin/data/drl/beings.lua:718 → bin/data/core/main.lua:register_corpse |
| cell | ndemoncorpse | bin/data/drl/beings.lua:764 → bin/data/core/main.lua:register_corpse |
| item | nat_ncacodemon | bin/data/drl/beings.lua:814 → bin/data/core/main.lua:register_being |
| cell | ncacodemoncorpse | bin/data/drl/beings.lua:814 → bin/data/core/main.lua:register_corpse |
| item | nat_nknight | bin/data/drl/beings.lua:859 → bin/data/core/main.lua:register_being |
| cell | nknightcorpse | bin/data/drl/beings.lua:859 → bin/data/core/main.lua:register_corpse |
| item | nat_narachno | bin/data/drl/beings.lua:910 → bin/data/core/main.lua:register_being |
| cell | narachnocorpse | bin/data/drl/beings.lua:910 → bin/data/core/main.lua:register_corpse |
| item | nat_nrevenant | bin/data/drl/beings.lua:985 → bin/data/core/main.lua:register_being |
| cell | nrevenantcorpse | bin/data/drl/beings.lua:985 → bin/data/core/main.lua:register_corpse |
| item | nat_nmancubus | bin/data/drl/beings.lua:1035 → bin/data/core/main.lua:register_being |
| cell | nmancubuscorpse | bin/data/drl/beings.lua:1035 → bin/data/core/main.lua:register_corpse |
| item | nat_narch | bin/data/drl/beings.lua:1087 → bin/data/core/main.lua:register_being |
| item | nat_bruiser | bin/data/drl/beings.lua:1138 → bin/data/core/main.lua:register_being |
| cell | bruisercorpse | bin/data/drl/beings.lua:1138 → bin/data/core/main.lua:register_corpse |
| item | nat_shambler | bin/data/drl/beings.lua:1193 → bin/data/core/main.lua:register_being |
| cell | shamblercorpse | bin/data/drl/beings.lua:1193 → bin/data/core/main.lua:register_corpse |
| item | nat_lava_elemental | bin/data/drl/beings.lua:1253 → bin/data/core/main.lua:register_being |
| cell | cyberdemoncorpse | bin/data/drl/beings.lua:1396 → bin/data/core/main.lua:register_corpse |
| item | nat_mastermind | bin/data/drl/beings.lua:1451 → bin/data/core/main.lua:register_being |
| cell | mastermindcorpse | bin/data/drl/beings.lua:1451 → bin/data/core/main.lua:register_corpse |
| item | nat_apostle | bin/data/drl/beings.lua:1569 → bin/data/core/main.lua:register_being |
| item | nat_arenamaster | bin/data/drl/levels/chained.lua:155 → bin/data/core/main.lua:register_being |

## Inactive declarations inside long comments

These are source material, not live game registrations.

| Category | ID | Display name | Source |
| --- | --- | --- | --- |
| badge | speedrunner4 | Speedrunner Platinum Badge | bin/data/drl/awards.lua:520 |
| badge | speedrunner5 | Speedrunner Diamond Badge | bin/data/drl/awards.lua:527 |
| challenge | challenge_aocq | Angel of Conquest | bin/data/drl/challenge.lua:1542 |
| badge | haste1 | Runner Bronze Badge | bin/data/drl/challenge.lua:1582 |
| badge | haste2 | Runner Silver Badge | bin/data/drl/challenge.lua:1589 |
| badge | haste3 | Runner Gold Badge | bin/data/drl/challenge.lua:1596 |
| challenge | challenge_aoh | Angel of Haste | bin/data/drl/challenge.lua:1603 |
| challenge | challenge_aodd | Angel of D&D | bin/data/drl/challenge.lua:1666 |
| challenge | challenge_aopw | Angel of Power | bin/data/drl/challenge.lua:1692 |
| level | the_asmos_den | The Asmos Den | bin/data/drl/levels/asmosden.lua:5 |
| being | hellmaster | Hell Incarnate | bin/data/drl/levels/asmosden.lua:15 |
| item | uhellwrap | hellish wrapping | bin/data/drl/levels/asmosden.lua:76 |
| trait | regenerator | Regenerator | bin/data/drl/traits.lua:543 |
