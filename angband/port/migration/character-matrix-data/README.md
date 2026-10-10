# Character matrices and source-owned character export

Pinned upstream Angband 4.2.6, commit `f3082213b73f3e463e3d0d60bff4b00462beae6e`.

173 reviewed IDs cover all 86 `ui_entry.txt` label/label5/label2 directives, five actual generated stat labels (STR/INT/WIS/DEX/CON), 46 selected renderer palette states, and export headings/field compositions. The entry lookup uses canonical source identities, never rendered English.

The native loops select known object/player values once. Browser instrumentation starts a row observer around the original renderer. Each of four active backends calls the observer after its original terminal write with its selected palette index and color. The observer copies the resulting terminal glyph and never queries gameplay values, recomputes a combiner or draws a random number. Sustain player-column `vals = 0` and unknown-value guards remain original. Current body.txt has exactly 12 slots in native `abcdefgimnop` order; the player column is `@`.

`write_character_dump` continues writing its original native English file. The browser simultaneously receives a source-owned Japanese semantic export with ordered widgets. Original item names, descriptions, messages, history, death, options and field values feed the graph at existing source calls. Item slot, option-key and retirement wrappers return their original selected result and evaluate the original expression once. The browser creates the UTF-8 downloadable text from Rust-formatted captures after explicit `__export_ready`.

The observer is bounded to 12 current equipment slots, 16 source glyph columns, 256 row identities, 128 remembered field labels and 16,384 export rows. Optional/custom configuration outside those pinned bounds is not claimed. Full game translation remains false. Browser/runtime acceptance belongs to the parent's final matching-engine checks.

The frozen pre-milestone native files and their SHA-256 pins verify that removing only `AB_CHARACTER_MATRIX` blocks and inline annotations recovers every prior byte. Node tests also reject a genuine mutation to the native known-value getter call. No Git operations or unrelated-game writes occur in this subtask.

A saturated row buffer, unsupported selected entry, invalid native glyph bound or missing naming descriptor marks export invalid. An invalid capture emits a localized error and never emits `__export_ready`; partial text is not offered as a complete export.

Read-only integration review exposed and corrected three source issues: capped Adv Exp now projects its original stars branch; the zero-argument stealth rating is held until its original field label arrives; primary first-sheet drawing resets the obsolete second-sheet semantic scope. These changes add no gameplay lookup.

Final completion review: `__export_ready` has exactly one integer parameter, `expected_rows`, equal to the source allocation count (1–16384). The collector must compare the final distinct row ordinal plus one with this count, and the worker must retain any rejected export event until the next `__begin_replace`. This closes rejected or silently unforwarded final-row paths. The original `turns_used.label` group heading uses its existing semantic ID and canonical widget. Current source checks: 23 passed; final integrated compilation and real browser acceptance remain parent-owned.
