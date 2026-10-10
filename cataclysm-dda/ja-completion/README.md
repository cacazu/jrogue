# Japanese catalog completion

This isolated directory completes the audited Japanese catalog gaps for Cataclysm: Dark Days Ahead **0.I-1**, source commit **7b2efa5cea38e4d4d97dd0e63b28b9148623da59**.

**ja-reviewed-patches.json** contains **164 reviewed semantic records**:

- All **142 missing entries**, with nonempty Japanese form 0.
- **18 actual printf or dynamic-tag repairs**.
- **3 reviewed plural warnings** that are valid Japanese count-bearing translations.
- **1 reviewed literal-percent warning** from unformatted help prose.

The four audit reviews are explicitly identified; they are not misreported as defective runtime placeholders. One plural record retains its existing Japanese text; two clarify IFF warning terminology while retaining the supplied count. The help review also fixes an unrelated mistranslation of whether a starting psion needs the Latent Psion trait.

Every record retains the original audited context, English singular, English plural, gettext key, source forms, PO line, references, flags, and translator comments. New semantic IDs describe concepts. **The file is reviewable data, not a runtime adapter:** runtimeConnected is false. The defaultLocale value "ja" expresses this patch bundle's intended locale and does not change the upstream game's setting.

## Source evidence

Exact JSON leaf bindings, with JSON pointers and owner IDs/types when available, exist for **157 records**. Six records instead refer to C++ source call sites. One help record has a source drift warning: the catalog says "this straight", while the current JSON says "this trait". Its original catalog key is preserved; future integration must reconcile that difference rather than silently changing the key.

The pristine catalog's SHA-256 is **a488609d65cf31cb484da27d18e9c0db4186919f64f4a24d4ecf15b8e71a262f**.

Review decisions behind the audit exceptions:

- **src/mattack_actors.cpp:1173** always passes the monster name and warning count.
- **src/turret.cpp:654** always passes the turret name and count; line 659 always passes the count. Japanese uses nplurals=1; plural=0;, so form 0 can use the count-bearing plural signature in all three cases.
- **data/mods/MindOverMatter/help_files.json:41** is help prose with literal 50% and 1%. **src/help.cpp:65–66** loads messages as translations; line 244 obtains line.translated() for display. The source phrase "50% to" was incorrectly treated by the audit as "% to", a printf conversion with a space flag and t length. The existing catalog's c-format flag is retained as original metadata, and the validator allowlists only this exact reviewed paragraph.
- **src/string_formatter.cpp:32** explicitly allows the apostrophe printf flag. The monster-name repair preserves "%1$'s" exactly instead of hard-coding a species.

## Terminology and review

Existing catalog and plain-language translate-dialogue entries ground **エクゾディ**, **ルビク**, **グレートグレイ**, **ベンゼテ**, **キングズランディング**, **アッパーランディング**, **掩体壕**, **別時空／異界**, and the three reward CBM names. Rubik's dialogue uses lightly colloquial おいら／お前さん; explanatory comments guide his invented dialect.

Two independently authored fragments were checked against English text and neighboring official translations. Review corrected an unsupported gold denomination, clarified permanent cyborg handover, and avoided asserting an unsupported camp in the warehouse completion line.

Documented ambiguities remain within the patch records:

- The trader welcome sign's archaic “Come Well Avaunt.”
- Provisional **スキシアン** for Scythean/Scythy; no existing Japanese name was found.
- The “hempen mats” and “crib on the walkway” idioms.
- “A half-score century” means ten centuries, but its translator note says roughly 600 years. Japanese follows the literal English with **千年ほど** and records the conflicting note.
- Anubine's supplied “devil himself” gloss, the unexplained crab-immortality aside, and opaque faerie folklore images.

These are localized review notes, not missing translations. Player, NPC, monster, and other substituted names remain parameters.

## Rebuild and validation

No packages, model/API calls, or paid services are required. From the workspace root:

~~~powershell
node ja-completion/author-a.cjs
node ja-completion/author-repairs.cjs
node ja-completion/build-patches.cjs
node ja-completion/validate.cjs --check-upstream
node ja-completion/test-validator.cjs
~~~

**missing-b.json** is the independently authored second fragment. The builder reads the two audit JSON files under inventory-tools/output and reads the pristine upstream JSON and PO; it writes only within this directory.

**verification.json** records the patch fingerprint, input fingerprints, counts, and validation result. Validation covers exhaustive inventory, immutable source identities, typed and positional printf arguments including dynamic width/precision, exact dynamic tags with multiplicity, brace tokens, action/asterisk markup, line and paragraph breaks, fixed payment annotation, and individually reviewed exceptions. The --check-upstream flag also hashes the pristine PO and re-resolves every recorded JSON pointer.

The validator's focused tests cover typed argument errors, safe positional reordering, dynamic width/precision, repeated tags, and eight deliberately invalid patch mutations. It rejects missing/duplicate records, changed English, copied timer tags, reordered unnumbered arguments, dropped possessives, injected format placeholders in the prose exception, and an unsupported runtime connection claim.

No pristine upstream files, shared Git state, or Site files are changed.

This file is an adaptation of upstream CC BY-SA 3.0 content. Preserve the upstream license, credits, and adaptation attribution when distributing the bundle.
