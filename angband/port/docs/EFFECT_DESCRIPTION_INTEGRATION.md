# Effect description source integration

This phase connects the native `effects-info.c` description/menu graph to owned
semantic facts and English/Japanese catalogs. It is source-connected and awaits
the parent's measured C/WASM build and browser gate. It does not claim complete
game translation or completed runtime acceptance.

The official source is Angband 4.2.6, commit
`f3082213b73f3e463e3d0d60bff4b00462beae6e`. GPL-2.0-only is the selected
redistribution license. The separate pristine upstream tree remains untouched;
six exact official source files are pinned under the migration directory for
review and line provenance, retaining their copyright/license notices.

## Captured producer graph

The inventory covers 112 EFFECT records, 108 nonempty description fields,
93 nonempty menu fields and all 20 EFINFO format cases. The 423 bilingual IDs
include source-selected projection/player/lash fields, player timed names,
stat names, summon descriptions, dice arithmetic grammar, healing minimum,
device-skill/average damage clauses, conjunctions, menu actions, five object
usage prefixes, shape-change prefix, and the caller's statement terminator.

The adapter observes the original values at their actual formatting arguments.
Every original arithmetic expression, dice evaluation/roll, knowledge check,
concatenation branch, textblock allocation/free, color loop and terminal call
runs in its original order once. Completed English buffers are never parsed or
matched. Buffer/textblock addresses are private temporary identity keys only;
JSON owns copied IDs and selected numeric facts before callbacks or frees.

Native RANDOM/SELECT groups retain their actual specialized condensed-breath
path and recursive alternative path. Recursive child captures flatten into
their parent; no replay of effects or additional dice calculation is needed.
The parent receives source-selected separators, including the breath Oxford
comma and the fallback alternative list without it.

Both external native description callers are connected: known non-activation
object use information and shape-change lore. Effect selection rows/default
prompt are connected through the original menu producer. Custom menu prompts
use the existing immutable source-pointer registry; absent provenance produces
an explicit unsupported marker and preserves the original terminal output.

## Strict owned descriptor

`EffectDescription` has this shape:

```json
{"schema_version":1,"parts":[
  {"kind":"bounded","native_max_bytes":250,"parts":[
    {"kind":"ref","id":"angband.effect_info.description.damage","params":{
      "dice":{"type":"EffectDescription","value":{"schema_version":1,"parts":[
        {"kind":"bounded","native_max_bytes":20,"parts":[
          {"kind":"ref","id":"angband.effect_info.grammar.dice.base","params":{
            "base":{"type":"integer","value":25}}}]}]}}}}]}]}
```

Refs allow only the reviewed effect namespace and declared `integer`,
`localized_text`, or recursive `EffectDescription` parameters. Native capacities
include their NUL byte. English clips each exact selected buffer group to N-1
ASCII bytes; Japanese reflows the same facts independently. The only deliberate
empty lexical reference is `angband.effect_info.grammar.empty`, also used for
native absent `%s` fields. Unknown IDs/types or failed capture remain explicit
unsupported output rather than a partially localized sentence.

The C helper bounds buffers to 64, outstanding textblock results to 32, prefix
identities to 16, event wire bytes to 128KiB and semantic parts to 512. Captures
are released after child append or external handoff and reset at the next
outer producer. Rust parsing/composition is parent-owned in
`rust/src/effect_description.rs` and has no C pointers, entities or RNG API.

## Three approved presentation fixes

The original MOVE_ATTACK, MELEE_BLOWS and SWEEP description strings use `%d`
despite EFINFO_DICE passing `char dice_string[20]`. That is an upstream varargs
type error. The browser adapter selects corrected `%s` templates by the exact
three EF enums and passes the already-computed original dice string once.
It changes no effect count, rule, arithmetic or RNG call. The separate native
path and pristine sources keep the original bytes. These corrections are
documented separately from the additive source reconstruction proof.

Other native quirks are retained: MON_TIMED_INC prints the player-timed field
selected by its subtype, LASH prints subtype as length, no-dice nodes may
inherit a prior random value, CLEAR_VALUE clears the shared flag only, and
raw-next pointers select main-chain punctuation even when later nodes have no
visible description.

## Evidence and pending gate

`producer-snapshots.json` pins ten accepted original functions and line endings.
Removing only AB_EFFECT annotations reconstructs those bytes exactly.
`source-manifest.json`, `schema.json` and `upstream-source-lock.json` pin original
templates, exact native lines/data fields and the explicit three fixes.

The independent corpus scan finds a maximum of 14 linked effects. Full i32-width
numeric/longest-family bounds are 3,577 bytes in English and 4,964 in Japanese,
below the existing 8KiB parameter limit. The wire-depth bound is 18, semantic
node bound 464 and capture bound 29,696 bytes. See `bounds-evidence.json`.

Run the lightweight source gate with Node:

```text
node migration/effect-description-data/generate.mjs --check
node migration/effect-description-data/measure-bounds.mjs --check
node --test tests/effect-description-source.test.mjs
```

No compiler, browser, Git operation or external publication was run by this
source task. The concise spell preview uses a separate `get_spell_info` producer,
not `effect_describe`; that next source seam is being audited separately.
