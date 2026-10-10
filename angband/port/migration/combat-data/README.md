# Monster combat text source bindings

The pristine input is Angband 4.2.6, commit
`f3082213b73f3e463e3d0d60bff4b00462beae6e`. `source-manifest.json`
records the SHA-256, size, field locations, unmodified source text and private
canonical aliases. `generate.py --assemble` extracts declared text fields and
validates all authored Japanese IDs and named parameter sets. It executes no
engine code.

The catalog contains 652 declared text IDs and 18 composition roles: 240
singular/plural reaction forms, 213 spell messages, 111 spell lore descriptions,
13 save messages, 33 blow actions, 19 blow lore descriptions and 23 projection
lash descriptions. Repeated visible templates coalesce within their lexical
role; private spell/power/race aliases do not appear in runtime events.

Every source tag occurrence has its own parameter, such as `name_0` and
`name_1`. C must copy the description produced by that original occurrence
immediately after its native `monster_desc` call. Leading capitalization and
the source-following punctuation select native modes before localization.
Rust receives the selected v2 owned description, rather than live monster
pointers, a completed English string or instructions to repeat visibility
checks. Targets and lash types are nested semantic references. Optional
`oftype` is a reviewed composition reference, empty when the original branch
prints nothing; Japanese places that phrase before the whip noun.

Aggregate reaction subjects use `MonsterAggregateSubject`, schema version 1.
An omitted subject contains only `schema_version` and `kind`. A hidden subject
additionally contains the already displayed `count` and `offscreen` flag. A
visible subject additionally contains `unique`, a disclosed `name_id`, the
selected `plural_form`, `appositive_comma` and `offscreen`. Hidden subjects
exclude race, sex and unique information. The Rust parser rejects extra fields,
duplicate keys, nonpositive counts and inconsistent selected plural branches.
English applies the original successive writes to a 60-byte subject buffer;
Japanese uses reviewed counters and separate reflow. The source's damage
averaging result is captured once where it is printed and is not recomputed by
Rust.

Successful save messages are emitted only inside the original successful
saving-throw branch, after its existing random draw. Unseen spell attacks on
another monster, empty alternate messages and absent optional lash labels emit
no invented content. The action selected by `monster_blow_method_action` must
use its existing single `randint0` draw; the parser reverses source action order
when building its linked list. Translation must not select a second action.

Japanese inputs are `reaction-ja.json`, `blow-projection-ja.json` and
`spell-ja.json`. The complete assembled dictionaries are `en.json` and
`ja.json`; `schema.json` declares the typed parameters. `ja.partial.json` is an
intermediate review artifact and is not an application catalog.

Catalog coverage is distinct from connected producers. Source hooks now connect
240 reaction forms, 213 spell templates, 13 successful-save templates, 33 blow
actions and 23 lash labels, plus their composition roles. The 111 spell lore and
19 blow lore IDs are registered for `ab_combat_text_id(selected_field_pointer)`
but their lore UI producers are not claimed connected in this phase.

`logic/web-combat.[ch]` registers immutable parsed source pointers by the exact
canonical aliases in `web-combat-data.h`. The runtime performs pointer equality,
not English text matching. Blow parser keys are canonical identities; its
direct-access array starts at index 1, and each action list reverses source
order. Registry capacity is 1,024 entries for 566 pinned source records. Parsed
data lives for the engine session; the binding reset API must be called before
any future in-process data reload that could reuse allocated addresses. Assets
must remain the pinned, verified corpus or obtain a new reviewed mapping.

Each complete semantic JSON value is owned and bounded by the common 128 KiB
event builder. Spell descriptors are copied per original occurrence. Blow
display owns an actor snapshot before the action helper and takes ownership of
the helper's nested action reference before native text allocation/More/free.
Callbacks use the existing `ab_rs_review_event`/`ab_host_semantic_event` ABI;
there are no new Rust exports. Rendering and locale changes do not consult
engine state, RNG or storage.

`hook_source.py --check` reconstructs all three pre-hook files byte-for-byte,
including prior static/dynamic wrappers and mixed CRLF. `verify.py` passed 16
source-only contract checks. The parent ran 136/136 native Rust tests, including
the aggregate module's 12 tests. These new combat C hooks remain uncompiled at
this source checkpoint; engine/WASM and browser validation are still required.

Derived Angband source/data and translation changes use GPL-2.0-only under the
upstream dual-license choice. Upstream copyright notices remain in the pristine
source and modified C files.
