# Canonical spell text source integration

The reviewed browser-only hooks in `logic/ui-spell.c` and
`logic/web-spell-text.[ch]` connect **356 character catalog endpoints**:
30 class/book labels, 163 spell names and 163 descriptions. The UI agent owns
the 110 race/class/title endpoints. Three self-damage death-cause endpoints
remain unconnected; they require effect/death/history producer descriptors.

Bindings use the pinned class `cidx`, class-local book `bidx` and class-wide
spell `sidx`, preserving original parser strings and record/effect order.
They do not compare spell names, descriptions or rendered English. The
selected book is resolved from the original collector's first spell index,
without another object description or gameplay lookup.

The retained menu chooses readable/valid books and spells with its original
callbacks. Row names and numeric values follow the original illegible gate.
An illegible row emits only the actual selection key, controlled state enum and
color; it clears the name and withholds level, mana and failure chance.
Descriptions follow the original `show_description` switch, including its
original behavior for forgotten/untried spells. No extra knowledge predicate
or hidden core state is exported. Failure chance is captured from the one
original `spell_chance()` call. Original `get_spell_info()` and effect-summary
calls remain unchanged.

The shared owned event writer emits schema version 1, channel `ui`, context
`spells`, severity 0 and sound -1. Catalog values have no parameters; they are
formatted by the existing direct Rust semantic ID route. Control events have
empty IDs and bypass Rust formatting:

| Widget | Payload / meaning |
|---|---|
| `book` | Selected class/book name ID |
| `row.<sidx>.name` | Visible spell name ID |
| `description` | Selected visible description ID |
| `__spell_row:<sidx>` | `key`, `state`: `display_token`; `color`: integer; readable rows also `level`, `mana`, `fail`: integer |
| `__begin_replace` / `__begin_patch` / `__end` | Owned UI batches; empty parameters |
| `__clear:row.<sidx>.name` / `__clear:description` | Clear absent visible slots |
| `__reset` | Discard spell context after the menu closes |

State tokens are exactly `illegible`, `forgotten`, `worked`, `untried`,
`unknown`, `difficult`. The ASCII key is copied from the original
`m->selections[oid]`; hooks do not assign new keys. Scalars and string bytes are
copied into bounded owned JSON before synchronous callbacks return. The host
must replace each row's metadata rather than merging omitted illegible fields.

Lightweight checks verify all 30/163 canonical mappings and 356 distinct IDs,
exact native source parity against `tests/accepted-source-snapshot/ui-spell.c`,
the unchanged original rule-query call counts, typed metadata and gates, and
absence of RNG, knowledge mutation or completed-English lookup in the new
helper. They do **not** compile C, execute Angband or test a browser. Add
`web-spell-text.c` to the browser build source list before building; native
builds exclude its definitions and retain the original C English path.

Remaining scope is explicit: generic headers/prompts/errors, realm noun/plural
grammar, worked average-damage/type text, shared book object article/count/base
grammar and effect death/history causes are unconnected. The original worked
spell information still invokes `dice_roll()` in `player-spell.c`; preserving
that original call is not proof of full UI/RNG separation. The new helper adds
no simulation/RNG work. CJK wrapping and actual desktop/mobile, save/resume,
knowledge, full-game and publication acceptance require later integration and
tests. This source milestone is not complete game localization.
