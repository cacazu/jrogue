# Review of a help variant preserving all original headers

This is a **separate source-bound design review**, not an implemented alternate patch. The complete prepared `../help-semantic-slice/` remains unchanged, unapplied and honest about its original-header changes. This document does not permit reusing its class-changing code with old headers or old objects.

All source references use official Cataclysm:DDA 0.I-1, commit `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`. `HEADER-FREE-HELP-REVIEW.json` pins 15 actual source/data files and records the exact existing dependency records. Independent read-only review checked private access, native name fallback, context lifetime and key-editor rollback.

## Concrete footprint and source ABI

The proposed bounded variant changes **four original CPP bodies**, adds one separate helper CPP/header and preserves every original header byte, class token definition/layout, inline member and method signature:

| Original TU | Exact responsibility |
|---|---|
| `src/init.cpp` | Replace only the `add("help", &help::load)` registration at 280 with a four-argument registration wrapper that scopes trusted file provenance, then calls the original two-argument `help::load`. |
| `src/help.cpp` | Maintain topic metadata after successful native insertion and reset; observe actual menu/title/topic/grid consumers with original private state and already computed values. |
| `src/input.cpp` | Maintain separate current/basic loaded-name provenance through actual loads, copies, synthesis and deletion, without adding fields to `action_attributes`. |
| `src/input_context.cpp` | Observe names/bindings inside existing friend/member bodies and pair metadata snapshots with actual editor rollback. No new input_context members. |

The additional friend `keybindings_ui` is implemented within `input_context.cpp` (`43–75`, `626–781`), not a separate TU. Its controls perform existing current/basic lazy lookups (`703–707`), name selection (`753`) and descriptions (`765`), with editing delegated to the reviewed context methods; no additional name/table mutation hook or original TU was found.

The proposed new implementation name is `src/cdda_help_semantic_headerfree.cpp`; it is **not present or compiled**. A new separate helper header declares free functions/sidecar records only. Private native tables remain accessed inside their existing owner/friend bodies; no external free helper receives friendship or accesses private fields.

Original `help::load(const JsonObject&, const std::string&)` is defined at `help.cpp:38` and declared at `help.h:25`. The `DynamicDataLoader::add` two-argument adapter at `init.cpp:237–243` explicitly discards both path arguments. The registration wrapper must use the existing four-argument overload, RAII-scope the actual `src`/`base_path`/`full_path`, call unchanged `help::load`, and restore previous scoped provenance on success or exception. A direct caller without this scope gets unconverted native content. `JsonObject::get_source_location()` is not an alternative: that method belongs to the different `TextJsonObject` (`json.h:1092`).

All **438 existing .d records / 12,537,685 bytes** were read without a build. The exact four existing TU records are `help.d`, `init.d`, `input.d`, `input_context.d`, with their bytes/hashes in the JSON evidence. This bounded design therefore plans **4 existing TUs + 1 new TU + full relink**, with zero original-header fanout. This is a source footprint, not compile acceptance. The existing header-changing variant still independently requires the previously recorded 231-TU union. A build must not combine header-changing objects with this alternative.

The live-input overlay also modifies `input_context.cpp`, so a future combined patch must reconcile that original source file. Its existing include/`handle_input` scope hooks are distinct from these planned name/binding/editor hooks. Its new helper CPP remains additional. The presentation snapshot adds `sdltiles.cpp` and its helper; these two source families share no original file. Cosmetic preparation adds `cata_tiles.cpp` and `overmap_ui.cpp` with a header-only helper. If all four bounded variants are implemented exactly as described, the original-source union is **7 TUs**, plus **3 helper TUs** and relink. That is a conditional design count; no combined patch/build was produced.

## Preserve the exact reviewed 14 entries

The existing registry, GNU-verified Japanese bindings, en/ja catalogs and rich programs are reused as reviewed data. This alternative invents no IDs and changes no source texts. Pointers are provenance checks, not positional IDs:

| ID | Exact original owner/source |
|---|---|
| `input.keybinding.default.up.name` | `data/raw/keybindings.json /9/name`, category `default`, action `UP` |
| `input.keybinding.pickup.up.name` | Same file `/26/name`, `PICKUP` / `UP` |
| `input.keybinding.bionics.up.name` | Same file `/439/name`, `BIONICS` / `UP` |
| `input.keybinding.default_mode.pause.name` | Same file `/289/name`, `DEFAULTMODE` / `pause` |
| `input.keybinding.default_mode.pickup.name` | Same file `/303/name`, `DEFAULTMODE` / `pickup` |
| `input.keybinding.default_mode.inventory.name` | Same file `/316/name`, `DEFAULTMODE` / `inventory` |
| `input.keybinding.default_mode.help.name` | Same file `/369/name`, `DEFAULTMODE` / `help` |
| `help.core.movement.name` | `data/core/help.json /1/name` |
| `help.core.movement.controls` | Same file `/1/messages/0` |
| `help.core.movement.movement_cost` | Same file `/1/messages/2`; `press_player_data` |
| `help.core.movement.melee` | Same file `/1/messages/3` |
| `help.core.movement.doors` | Same file `/1/messages/4`; `press_open`, `press_close`, `press_smash` |
| `help.core.movement.safe_mode` | Same file `/1/messages/5`; `press_safemode` |
| `ui.help.title` | Both actual title expressions in `help::display_help`, `help.cpp:204` and `278` |

`/1/messages/1` is the native `<HELP_DRAW_DIRECTIONS>` instruction. It stays an immutable `structured_direction_grid`, **without a semantic text ID**. The original nine `action_id` values and ordering are at `help.cpp:78–82`; both alternatives per cell, seven connector rows, short-description intent, blue bound/red `?` unbound and original filters remain as already reviewed in `structured-direction-grid.json`.

The five `press_*` parameters remain **KeyBinding rich nodes**, preserving native event type, signed key sequence, modifier order, enabled state and current/default/missing origin. They must not be recast as `UserText`, flattened translations or assumed keyboard codes. The scalar Rust `RawCatalog` accepts only its existing declared schema; it does not implement this rich type. The current help catalogs preserve legacy press tokens as literal data, while `text-programs.json` describes the separately typed rich program. Real Rust rich-node/key-name/separator rendering remains unconnected.

## Topic identity and actual producer hooks

`get_help()` owns the actual singleton (`help.cpp:32–36`). Its unchanged `load_object` computes `modified_order` with `current_order_start` at 70 after native source offset handling at 61–64; only after successful `try_emplace` at 71–73 may the sidecar store reviewed metadata. Capture the actual raw source order, scoped trusted full path, parsed `translation` name/messages and actual modified order. Mark a topic reviewed only if every existing source-bound guard succeeds. A different/modded/unknown load remains unconverted.

The sidecar is for the canonical loaded singleton, cleared alongside `help_texts` in `reset_instance:48–52`. It must not guess identity for copied/moved public help instances; absent canonical owner metadata means native fallback. Free helpers cannot read private `help_texts` or order state. Existing members pass only actual copied values/metadata from their own access.

The consumer hooks are the actual menu name at `draw_menu:129`, title expressions at 204/278, and selected topic at `display_help:240–268`. A selected-topic scope requests only the reviewed five press actions and nine directions, without input ownership. The grid hook copies the **already computed** `keys` at `get_dir_grid:94`, selecting the same first two native candidates. It does not call a second binding lookup.

For press parameters, the unchanged global `press_x` routes through the actual default-mode `input_context::press_x` (`action.cpp:518–528`). Therefore `action.cpp` need not change. Its member at `input_context.cpp:1244–1271` already owns a copied event vector, removes disabled types, joins native long descriptions with the localized separator and returns the native result. An observational hook can copy those actual events/decisions under the selected-help scope while leaving the original result intact. Scope/reentry/exception failures make semantic observation unavailable. Observer failures never suppress, substitute or retrigger native producer calls.

Prefer these natural consumer hooks over a free observer that calls public lookup methods. Existing `keys_bound_to`, `get_desc`, `get_action_name` and `get_input_for_action` can lead to lazy insertion through `input.cpp:799–807`. The observer must use const `find` and already owned vectors. Existing `input_context` friendship (`input.h:288`) allows that access inside existing member bodies. A scoped early-return probe inside a public method is a possible header-free access mechanism, but this review does **not** recommend or implement it; ordinary native return behavior remains straightforward.

## Exact name provenance lifecycle

Current binding vectors and basic name tables are distinct. Names resolve through `basic_action_contexts` in native `get_action_name:1202–1228`, while current vectors resolve through `action_contexts`. A present local binding entry wins even when its vector is empty. A local empty **name** falls back to the basic default name. Only a **missing basic default action** is synthesized from the current default name; an existing empty basic default stays empty. Return literal action ID when native fallback remains unnamed.

Use separate owned `(category, action) → reviewed source identity or unconverted` sidecars for current/basic names, with fail-closed observation if metadata is incomplete. Do not infer identity by matching the translated output string. Required hooks are:

| Native source | Required metadata behavior |
|---|---|
| `input_manager::load`, `input.cpp:273–275` | Invalidate old provenance **before** any named `action.read`; bind only after successful parsing of the reviewed trusted source. `translation::deserialize` can mutate context/cache before throwing, so a failed read is not assumed atomic. A binding-only object preserves existing name provenance. Later binding parse failure must match the actual successful native name assignment, rather than invent rollback. |
| `input_manager::init`, `181` | Invalidate basic provenance before the potentially throwing native `basic_action_contexts = action_contexts`; install a copied metadata map only after that assignment succeeds, before user preferences load at 183. Native init does not clear tables; repeated init must not blindly reset current metadata while native names remain. |
| Legacy import `input.cpp:210` | Mirror the actual category erase `action_contexts[action_id].clear()`; do not silently reinterpret it as DEFAULTMODE. |
| `get_action_attributes`, `799–807` | A newly synthesized current **or basic** default name follows the actual **current default** source (or becomes unconverted/literal). Do not assign by destination category. |
| `get_or_create_event_list`, `832–839` | A newly created local name follows actual current-default source; binding append alone preserves name identity. |
| `remove_input_for_action`, `857–868` | Remove provenance when the actual action entry is erased. Clearing only `input_events` at 870 preserves the name. |
| `clear_conflicting_keybindings`, `input_context.cpp:108–132` | Removing only event vector elements preserves names. |
| `action_reset`, `824–874` | It recreates event lists/adds basic **events**, not basic action attributes/names. Creation still derives its name from current default via `get_or_create_event_list`. Do not copy basic label provenance merely because reset was selected. |
| `action_remove`, `894–900` | Snapshot current metadata alongside `old_action_contexts`; restore it exactly when the native tables swap back on conflict-resolution failure at 900. |
| `display_menu`, `975` / `1121` | Snapshot current metadata alongside native tables and restore only on actual declined-changes swap. Save failure at 1115–1118 keeps current native changes and must keep current metadata. |

Existing `get_action_name` can emit semantic identity at its **actual chosen native return** after original selection/synthesis; no new public member is needed. Every semantic emission must also verify full raw `translation` equality (`translation.cpp:400–404`) against its stored reviewed source value, including context; comparing translated display output is insufficient. Future observer getters must const-find the native tables and use the exact missing-versus-empty rules, not rerun mutating native lookup. Synthesis propagates the chosen current-default identity unchanged, even if the destination category differs. Native save serializes bindings/IDs/categories rather than names, so ordinary binding-only reloads preserve name provenance.

All present explicit context name overrides remain `explicit_unconverted_context_name_override` for this bounded 14-entry variant. Nonempty `register_action(action,name):187–202` replaces an override; empty/unnamed registration preserves it. Context copy/move/destruction and non-Android assignment are implicit; Android assignment/destructor are inline in the original header, and header constructors assign category. A persistent pointer-keyed override sidecar cannot reliably follow these operations or allocator address reuse with all headers untouched. Native names stay authoritative; this bounded variant does not fabricate semantic identity for explicit overrides. The earlier prepared variant retains its explicit semantic registration/member solution as a distinct option.

## Remaining concrete acceptance work

Implement/review the new helper and the exact four CPP hooks, including paired rollback and partial-load failure behavior, before generating a separate reversible patch. The previous six-file patch cannot simply omit its headers. Source-pin and exact forward/reverse checks must cover this **new** patch and verify all original headers remain byte-identical.

Actual key-name/description/separator semantic producers, immutable bounded serialization/pins, owned Rust rich-program consumer connection, native/semantic UI association, nested key-editor/Asyncify scope behavior and original native fallback remain open. Manager implicit copying/replacement is also an unresolved provenance lifecycle boundary; the bounded contract targets the actual singleton manager and must fail closed for untracked instances/replacement. These are presentation observations, not accepted input, turn receipts or command authorization. Compile native/Rust consumers and test actual Japanese help/menu/editor, context collisions, local-empty unbinding, reload, reset, conflict rollback, save failure and native full-game flows in the browser on PC/mobile. No compiler, Cargo, browser, server, heavy job or external publication was run for this review.
