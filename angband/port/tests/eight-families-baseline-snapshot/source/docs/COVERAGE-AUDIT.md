# Current source coverage audit

Pinned upstream: Angband 4.2.6, `f3082213b73f3e463e3d0d60bff4b00462beae6e`.

**Complete translation remains false.** The 7,595 matching EN/JA/schema IDs prove authored catalog agreement, not complete native browser coverage. Raw inventories contain internal identities and other configurations; there is no valid translation-percentage denominator.

| Remaining family | Source and current boundary |
| --- | --- |
| Message recall | `logic/ui-knowledge.c:4045`, `logic/ui-knowledge.c:4098`, `logic/ui-knowledge.c:4131`, `logic/ui-knowledge.c:4223`; Recalled rows, repeat counts, header and native-English search; three navigation/find prompts already have IDs. |
| Second character-sheet matrices | `logic/ui-player.c:475`, `logic/ui-player.c:675`; Known resistance/property/sustain values per equipment slot; 86 compact-label directives lack source-bound catalog projections (not 86 unique names). |
| Enter and context menus | `logic/ui-context.c:1258`; Command categories, nested command rows and mouse menus; Target Selected messages already have IDs. |
| Look and target prose | `logic/ui-target.c:552`, `logic/ui-target.c:637`, `logic/ui-target.c:794`, `logic/ui-target.c:866`, `logic/ui-target.c:993`; Hallucination, condition, trap, pile and terrain composition; names, coordinates and help are partly projected. |
| Chronological gameplay history | `logic/ui-history.c:30`, `logic/ui-history.c:67`, `logic/player-history.c:233`, `logic/player-history.c:257`; Ledger headers, event rows, LOST/navigation and Found/Missed artifacts; birth biography is separately covered. |
| Knowledge metadata | `logic/ui-knowledge.c:1204`, `logic/ui-knowledge.c:1315`, `logic/ui-knowledge.c:1323`, `logic/ui-knowledge.c:1750`; Shape/alive/dead statuses, summary totals and random-artifact seed title; lore/object/rune/shape producer graphs already connected. |
| Native character exports | `logic/ui-player.c:1409`, `logic/ui-player.c:1445`, `logic/ui-player.c:1483`, `logic/ui-player.c:1525`; Dump headings, terminal-derived tables, recalled messages and death prose remain English. |
| Chest-trap trigger messages | `logic/obj-chest.c:561`, `data/gamedata/chest_trap.txt:39`, `data/gamedata/chest_trap.txt:47`, `data/gamedata/chest_trap.txt:56`, `data/gamedata/chest_trap.txt:65`, `data/gamedata/chest_trap.txt:72`, `data/gamedata/chest_trap.txt:80`; Six source records/five distinct trigger messages use unbound msg(trap->msg); chest names, disarm messages and death reasons have separate coverage. |

Current lore, object-info, rune and eight shape producer graphs are connected. Earlier reviews naming those missing endpoints are historical. Runtime acceptance remains tied to the exact built artifact and exercised branches.

The optional sound, tiles, secondary-terminal and gamepad adapters remain absent. Original ASCII English is still visible beside Japanese semantic panels. Normal campaigns, arena and native hallucination need further acceptance; browser cached redraw/locale/resize purity does not prove native perception purity.

Machine-readable evidence: `inventory/coverage-audit.json`.
