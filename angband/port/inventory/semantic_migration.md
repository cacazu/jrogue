# Semantic text insertion with deterministic Angband rules

The insertion point is the producer of a semantic message, label or name. A
rendered English line is too late: it has already lost entity identity, visibility
rules, number agreement, article choice, fragments, random variant identity and
often the distinction between a proper name and an external player name.

## Four layers and their exact text responsibilities

1. **Domain.** Keep upstream entity keys, ordered data rows, chance/weight tables,
   effect indices, dice expressions, content IDs, knowledge/awareness rules and
   RNG unchanged. Rules decide outcomes and any randomly selected message variant
   exactly once. Return facts and typed references, not an English sentence.
2. **Application.** Commands/use cases consume inputs, advance turns and emit
   `TextEvent { id, args }` or structured state projections. Events preserve the
   visible/known description state at emission time. They also retain message
   type/color/sound, actor/target identity, counts, selected variant and severity.
3. **Presentation.** Resolve stable IDs in `en.json`/`ja.json`, compose names with
   locale grammar, wrap text by display cells, and render. Locale changes cannot
   call the domain, reveal unknown names or advance RNG. English text belongs in
   the English catalog; Japanese is the default locale.
4. **Platform.** Browser input, storage, font/canvas/DOM/audio adapters transport
   commands and display projections. Storage keeps versioned semantic events,
   game state, content-version identity, external names and deterministic RNG.

Source inventories retain every occurrence for review. Freeze identifiers using
meaning and upstream identity, such as:

```json
{
  "angband.command.move.blocked_by_wall": "There is a wall in the way.",
  "angband.monster_spell.shriek.visible": "{actor} makes a high-pitched shriek.",
  "angband.option.rogue_like_commands.label": "Use the roguelike command keyset",
  "angband.monster.filthy_street_urchin.name": "filthy street urchin"
}
```

These are examples of identity shape, not an assertion that these example
entries were inserted. Do not derive a runtime identity from a hash or from a
translated English sentence. A review ledger maps each inventoried location to
one frozen ID, a nontext exclusion with reason, or a generated/structural field.
Repeated concepts can share an ID only when their grammatical role and typed
arguments really match. The extractor's `variant_N` and phrase slugs require
semantic review before acceptance; they are not finalized event names.

## Concrete upstream boundaries

- `message.h` declares `msg(fmt, ...)`, `msgt(type, fmt, ...)` and string-only
  message history. Migrate each semantic producer to a typed event before the
  formatter; retain sound/color type independently. `"%s"` forwarding sites are
  not catalog messages: trace their source, then insert the event at that source.
  The formatter implementations are `message.c:395` and `message.c:428`.
- `mon-desc.c:monster_desc()` handles visibility, pronouns, articles, possessives,
  proper/unique names, descriptive commas and offscreen status. Capture a monster
  name argument with race ID, count, visibility and grammatical role. Do not
  translate an already concatenated `the ...'s` fragment.
- `mon-desc.c:get_mon_name()` and `plural_aux()` select explicit race plurals or
  append English `s/es`. `monster.txt:plural` therefore needs a separate English
  plural form and a Japanese count/name presentation rule, not suffix replacement.
- `obj-desc.c:object_desc()` and `obj_desc_name_format()` combine identification,
  flavors, artifact/ego names, quantities, charges, modifiers, inscriptions and
  English `&`, `~`, `|singular|plural|`, `#` markup. Parse that upstream grammar
  into locale-neutral description fields. Keep unknown, unaware, tried, known,
  store and spoiler modes separate and snapshot the mode in historic messages.
- `mon-spell.c` expands `{name}`, `{pronoun}`, `{target}`, `{type}`, `{oftype}`
  from `monster_spell.txt` and per-race spell overrides. Translate the entire
  selected template with typed actor/target/projection arguments. Preserve
  seen/unseen/miss/save selection and power-cutoff variant. Upstream brace names
  may be converted once to named arguments; parity must be checked after that
  conversion rather than blindly comparing different placeholder grammars.
- `mon-msg.c:get_message_text()` uses `[singular|plural]` and `pain.txt` supplies
  seven pain thresholds per pain type. Capture race/count/pain code and choose a
  locale form in presentation. Retain message aggregation and omit-subject rules.
- `blow_methods.txt:act` contains ordered alternative actions and `{target}`.
  Where upstream selects a random alternative, preserve the alternative ID and
  selection order/count. Translation must not alter the RNG call or select again.
- `player_timed.txt:grade` contains color, maximum, status label, increase message
  and optional decrease message. A one-character label/message can suppress
  output. Keep suppression as a boolean, not as a language-dependent string
  length check. Preserve all 53 effects and threshold boundaries.
- `class.txt` has class labels, ten advancement titles each, book labels, spell
  names, effect messages and descriptions. IDs must include class/book/spell role
  rather than indexing all `desc` lines as class descriptions. `old_class.txt`
  is an inactive legacy table and must not silently replace the active 9 classes.
- `terrain.txt`, `trap.txt`, `chest_trap.txt`, `activation.txt`, `projection.txt`,
  `curse.txt`, `object_property.txt`, `player_property.txt`, `realm.txt`,
  `shape.txt`, `brand.txt`, `slay.txt`, `summon.txt` and UI entry tables contain
  additional labels, verbs, lore, death reasons, errors and dynamic fragments.
- `list-options.h`, `list-parser-errors.h`, `list-effects.h`, `list-mon-message.h`,
  `list-stats.h` and other X-macro lists expose natural stable upstream symbols.
  Use those symbols plus a reviewed role for IDs. Internal option names remain
  the unchanged save/preference keys while their displayed descriptions localize.
- `lib/help` has both original and roguelike command sets; `lib/screens` includes
  title, death, crown and retirement art. Preserve help links/control directives
  and map glyphs separately from prose; translating prose does not permit changing
  command hotkeys. All main error/quit/bug-report strings also need reviewed IDs.

## Preserving randomness and generated names

Do not translate `names.txt` seed words, reorder flavor/action/history tables,
change lengths of randomized choices, or invoke the generator in rendering.
Generated scroll titles and random artifact names remain the generated proper
value or receive a separate deterministic display transformation with no RNG.
Birth/history/flavor generation stays in the domain and its selected semantic
identity is stored. Player names, usernames and inscriptions remain user data.

Two additional verified visual hazards are `ui-map.c:41-79`, where the
hallucinatory monster/object helpers call `randint0`, and
`ui-display.c:1435-1470`, where `do_animation()` calls `randint1`, sets monster
attributes and marks redraw flags. Audit all display paths that can call
`randint*`, `rand*`, `Rand_quick` or mutation helpers. Hallucination rendering and
other random visual choices need a dedicated
visual state/seed, advanced by an application event, or a pure deterministic
function of a stored visual seed and cell/frame identity. A gameplay RNG snapshot
must be identical before and after one render, repeated renders and locale swaps.
Do not move random selection to presentation merely because the result is text.
`cave-map.c:305` is the legitimate random wakeup caused by `cave_light()` in the
domain. Removing every RNG call in a map-named file would alter the rules.

There is a verified knowledge mutation in `obj-desc.c:633-637`:
`object_desc()` sets `obj->ego->everseen = true` and
`obj->kind->everseen = true`. The absence of direct RNG calls is insufficient
proof of render purity. Move these changes into the command/use case, then render
an immutable projection. Inspect the other helpers for the same class of change.

## Japanese layout and catalog gates

Upstream uses fixed byte buffers, positional columns and `printf` padding. UTF-8
codepoint counts alone do not measure Japanese display width. Render messages,
menus and descriptions in reflowing UI panels with grapheme-safe clipping and
locale-aware cell width; keep the dungeon's ASCII cell coordinates independent.
Preserve readable fallback fonts and verify kana, kanji, punctuation and long
descriptions at PC and mobile widths. Source byte buffer limits must not split
UTF-8 sequences or drop parameters.

Require these gates for every migrated subsystem:

- Replay the same seed and command trace through English and Japanese builds;
  compare domain state, RNG state, knowledge, energy, outcomes and selected variants.
- Render repeatedly and switch locale without changing the domain/RNG/save state.
- Validate every accepted semantic ID exists in both catalogs; reject missing,
  duplicate and orphan entries. Compare named placeholder names and argument types.
- Preserve conversion width/precision arguments when converting C formatting,
  especially `%.*s`, `%*s`, signed/unsigned/size values and `PRI*` macros.
- Test awareness/flavor, unique/plural/invisible/offscreen monsters, mixed targets,
  articles/possessives, aggregated pain, timed grade suppression, shop owner names,
  spells, equipment, help, errors, settings, death, victory and retirement.
- Save a versioned envelope containing upstream/content commit, port schema,
  deterministic RNG and semantic events. Test old-version rejection or migration,
  roundtrip, restart/resume and locale change without hidden English name coupling.

An exhaustive occurrence scan is a starting audit. Publication as a complete
Japanese Rust port requires the accepted-ID ledger, translated catalogs, actual
producer insertion and complete gameplay/browser tests, which this inventory does
not itself implement.
