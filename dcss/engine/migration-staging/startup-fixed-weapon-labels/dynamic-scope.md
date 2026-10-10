# Dynamic startup source scope

The fixed eleven-ID stage excludes every composition below. References are to
pinned DCSS 0.34.1 upstream `crawl-ref/source/newgame.cc`, SHA-256
`b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c`.
Catalog membership supplies reviewed text/parameter shapes; it does not prove a
native binding or its consumers have been localized.

| Source boundary | Concrete behavior to retain in a future binding |
| --- | --- |
| `_welcome`, lines 167–189 | Eight variants from name empty/nonempty and species/job unknown/known: empty, unnamed job, unnamed species, unnamed species+job, named only, named job, named species, named species+job. Preserve typed values and punctuation; choose the ID from native branches rather than parsing the finished English sentence. |
| Welcome consumer 1, line 1177 | `UINewGameMenu` formats welcome in BROWN, then appends YELLOW `Please select your background.` or `species.`. Localizing `_welcome` affects both character menus and still leaves this additional sentence to bind separately. |
| Welcome consumer 2, line 1828 | `_prompt_weapon` creates a BROWN welcome Text before the separate CYAN weapon prompt. It has no appended newline in this Text. |
| Welcome consumer 3, line 2203 | `_prompt_gamemode_map` writes BROWN welcome plus newline; optional `Options.seed_from_rc` uses exact `PRIu64`, then a CYAN lessons/maps prompt. A central `_welcome` change affects all three consumers. |
| Name title, lines 581–586 | `_choose_name` chops canonical species to width 79 before testing `is_vowel(specs[0])`; select `startup.name.character.a` or `.an` from that original English branch. Human selects `a`, Octopode selects `an`; the job does not choose the article. Both JA templates can match while their EN source identities stay distinct. |
| Reroll title, lines 358–363 | `_reroll_random` repeats the same `You are a%s…` and vowel logic. The reviewed `startup.name.character.output` receipt covers `_choose_name`, not this second consumer. A global literal replacement would widen scope and needs a separate source receipt. |
| Seed title, lines 841–843 | `startup.seed.title` is dynamic in compiled `Version::Long`; the popup is reached for custom-seed play. Keep the native version value and trailing newline. |
| Weapon base/row, lines 1699–1779 | Legal choices come from native weapon restriction and possible job upgrades. Unarmed row selects `claws` using `species::has_claws`, otherwise `unarmed`; real weapons use `weapon_base_name`. Alphabetic hotkeys are native `'a' + i` and stay independent of display names. |
| Aptitude suffix, lines 1766–1767 | `species_apt(choice.skill, ng.species)` uses original `(%+d apt)`: positive **and zero** have `+`; negative has `-`. Route nonnegative values to the unsigned catalog variant and negative values to the signed variant without absolute-value/sign loss. |
| Previous weapon, lines 1795–1805 | The Tab row exists only when `_fixup_weapon` yields a known default. Random and recommended are sentinel branches; ordinary names come from `weapon_base_name`. Default `WPN_UNARMED` explicitly says `unarmed` even when the current choice row says `claws`. Reusing the row's localized claw name would change this source distinction. |

Seed text and seed control need separate review. `_keyfun_seed_input` accepts
ASCII digits, selected control/edit keys, backspace and exits; it deliberately
excludes Enter from ordinary TextEntry processing. Begin/clear/daily remain
`CK_ENTER`, `-`, `d`; focus cycling remains Tab/Shift-Tab. Initial seed display
uses `PRIu64`, clipboard parsing uses `SCNu64` under `USE_TILE_LOCAL`, and final
input parsing at lines 990–1001 writes a `uint64_t` into `Options.seed` and
`choice.seed`. Preserve decimal text or a checked integer representation across
JS/Rust; `18446744073709551615` cannot pass through JavaScript `Number` exactly.
Zero still means random. Presentation work must preserve the source's current
overflow/clamping and cancellation behavior. Daily seeds use native `localtime`
with `%Y%m%d`; replacing that with a UTC date changes the day boundary.

The seed footer has four compile-time catalog paths from independent
`USE_TILE_LOCAL` clipboard instructions and `SEEDING_UNRELIABLE` warning guards.
The pre-generation toggle is hidden under `DGAMELAUNCH`; its checked state and
`Options.pregen_dungeon` effects stay native. Name prompts likewise depend on
`!DGAMELAUNCH` and an empty chosen name; CLI/rc choices can bypass these widgets.
Keep input values, save filename validation, prompt conditions and control
callbacks separate from translated text.

Weapon row CJK integration cannot be inferred from UTF-8 ABI success. Native
width uses `strwidth(choice.label)` and `chop_string(..., max_text_width, true)`;
localized display names must be supplied before width/alignment decisions are
reviewed. Test narrow and wide CJK, combining clusters and the raw zero-valued
continuation cells in actual native frames, while retaining WHITE/LIGHTGREY
restriction colours, good/bad highlight colours, row order and native IDs.
JavaScript string length and UTF-8 byte length are neither native cell width.
Species/job/entity naming and maximum response/buffer sizes need their own
parameter/source coverage before any of these dynamic IDs enter the bridge.

A future runtime gate should cover all eight welcome variants at all three
consumers, both name-article branches and the separate reroll title, high u64
seeds plus zero/clear/daily/cancel, all footer build branches, aptitude
negative/zero/positive, and every default branch including claw-bearing
unarmed species. Compare JA/EN controls, raw CJK frames, exact save bytes and all
native RNG streams. The fixed-label source/mock tests establish none of those
dynamic native runtime outcomes.
A dynamic bridge also needs a distinct reviewed contract. The current private
fixed-text helper treats every `length <= 0` as failure and remains valid for
all eleven reviewed nonempty outputs. The concrete scope limit is its exact
ID whitelist and empty `{}` parameter schema. Dynamic descriptors require
source-bound parameter schemas and reviewed entity references while keeping
native condition/identity selection; do not use arbitrary lookup by a runtime
English string. The `startup.welcome.empty` variant names the absence of
name/species/job identity parameters. `_welcome` still returns `Welcome.`
(JA `ようこそ。`), rather than empty bytes.
