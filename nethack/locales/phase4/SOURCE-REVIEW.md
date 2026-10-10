# Phase four source review

This directory contains separate source proposals and review inputs. It does not
modify the frozen phase-three catalog, pristine source, native engine, browser
files, or Git. The current delivery scope is local HTML with Node/browser
verification; publication is outside that scope.

`reviewed-translations.json` supplies 38 whole-message translations, 58
source-selected literal fragments, and three original-helper variants.
`reviewed-dynamic-translations.json` adds four source-resolved messages, seven
fragments, and two helper variants. These are 112 distinct paired EN/JA keys.
Their metadata retains the original arguments, printf contracts, C locations,
source snippets, pinned Japanese evidence, authorship, and NGPL provenance.

Fourteen literal messages have direct original public argument contracts. The
other 24 require identities for literals selected at the original C producer.
The four dynamic origins require identities for the original selected format
and argument literals. When those identities are unavailable, preserve the
exact native English. A renderer must not select by completed English text or
call a native naming, state, grammar, or RNG function again.

Examples of reviewed fidelity decisions:

- `apply.c` deliberately uses `You` for “hear nothing special”, so that message
  receives no invented `You_hear` underwater/dream branch.
- Original `%c` punctuation remains an integer byte with `%c` formatting. It
  does not become the fork's Japanese string argument.
- Restore displays the original numeric level, including possible nonpositive
  depth; the Japanese template does not assume an underground floor.
- The empty bottle/lamp result stays “中身は空だった。” without computing the
  extra object-class fact from a fork branch.
- Figurine conversion says it turns to flesh. It does not import a separate
  claim that petrification was removed.
- The camera possessive, towel RNG result, mostly-dead grammar and artifact
  glow composition remain deferred until their original public producers have
  explicit capture contracts. Fork-only `digests`, additional `j/m` values,
  and unconditional `shk_embellish` calls are rejected.

The dynamic review resolves the immutable `hollow_str`, `whistle_str` and
`alt_whistle_str` declarations in official `src/apply.c`. Four native origins
produce four message IDs; the magic whistle has two source-selected formats.
The original `Deaf` format choice and each original argument choice must occur
once in C. Two other inventory entries are a null menu title and a function
declaration, rather than visible gameplay messages. The welcome composite and
hallucination color call need additional original producer context.

`integration-plan.json` is the engine handoff. It contains exact original sites,
argument expressions, types/specifiers, required descriptor identities, raw
visible fallback slots, reviewed rejections, and the verification sequence.
No proposed ID has runtime approval yet. `reviewed-verification.json` records
128 passed source-contract checks and hashes of all 12 unchanged protected
phase-three inputs. These checks do not replace C/Lua compilation, original
versus instrumented state/RNG comparison, Rust formatting, Node checks, or
browser locale/repaint/input/save/load verification.

| Source scope | Exact count |
| --- | ---: |
| Core distinct literal message IDs | 5,984 |
| Frozen core message IDs with JA catalog templates | 771 |
| New reviewed literal IDs | 38 |
| Source-template IDs if the new literal proposal is integrated | 809 |
| Core literal IDs still without JA templates after that proposal | 5,175 |
| All-tree literal IDs still without JA templates | 5,599 |
| Remaining pinned-pair IDs awaiting individual review | 997 |
| Core dynamic lexical candidates | 963 |
| Reviewed dynamic origin sites with resolved format proposals | 4 |
| Reviewed nonmessage dynamic candidates | 2 |
| Reviewed dynamic candidates missing producer context | 2 |
| Dynamic candidates still unreviewed | 955 |
| New runtime-verified message IDs | 0 |

The counts are source-template and lexical-review counts. They do not establish
complete Japanese gameplay. Public name/grammar producers and other dat/help,
rumor, lore and menu surfaces also need emission and language verification.

All remaining category-C authoring work is partitioned into three disjoint
inputs, retaining file ownership:

| Input | Distinct IDs | Official call sites | Files |
| --- | ---: | ---: | ---: |
| `category-c-batch-1.json` | 161 | 163 | 20 |
| `category-c-batch-2.json` | 161 | 162 | 19 |
| `category-c-batch-3.json` | 161 | 163 | 21 |

Category C originally contains 513 rows and 508 distinct official IDs. The
batches exclude 21 already reviewed IDs, two reviewed deferrals, and two frozen
IDs. Their exact union is the remaining 483 IDs; files and IDs never overlap
between authors. Each input includes full English named templates, all original
call-site argument expressions and nearby source context, exact printf types,
source literal positions, required helper variants, and pinned Japanese
evidence. They contain no approved or blank Japanese translations. Authors
write only the assigned `category-c-batch-N.authored.json` fragment and flag
unproved public producer contracts rather than inventing them.

Regeneration uses the existing emsdk Python, with UTF-8 enabled:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 nethack/locales/phase4/build-reviewed-translations.py
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 nethack/locales/phase4/build-reviewed-dynamic.py
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 nethack/locales/phase4/verify-reviewed-translations.py
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 nethack/locales/phase4/partition-category-c.py
```

The dynamic builder reads only pinned JNetHack Git blobs, not its dirty working
tree. Every metadata file has canonical
`provenance.jnethack.pinned_commit/imported_paths`; notices generation can accept
it as additional provenance. The existing source-pair review manifest already
covers the imported paths in these proposals and author inputs.

## Additional source authoring checkpoint

The three category-C authors completed 483 official-equivalent whole Japanese
frames covering 488 original call sites. The remaining two category-B and 65
category-D frames were authored from official English, including cases where
the Japanese fork's additional facts or queries were rejected. Each separate
authored fragment now has a read-only verification report and normalized
source handoff; the frozen catalog is unchanged.

| Stable new fragment scope | IDs | Call sites | Literal records | Helper variants |
| --- | ---: | ---: | ---: | ---: |
| Category C, three batches | 483 | 488 | 1,234 inline plus 93 table | 76 |
| Category B | 2 | 2 | 2 | 2 |
| Category D | 65 | 70 | 159 | 4 |
| Prepared-English numeric batch | 20 | 20 | 0 | 0 |
| Total | 570 | 580 | 1,395 inline plus 93 table | 82 |

These are Japanese source frames, not approved native emissions. Twenty-two C
entries have explicitly justified English-only agreement omissions and retain
their complete original argument union. At least 337 stable frames require
original public name or grammar producer contracts; source-selected literal
branches also need actual capture evidence. Category A's 447 frames are still
being finalized separately. Neither draft A output nor this checkpoint
establishes complete Japanese.

Numeric source authoring retains each original numeric/character contract.
Official `%zu` and `size_t` remain unchanged in C and source evidence. The
prepared catalog's `%u` form is explicitly limited to wasm32 `uint32` size_t;
native 64-bit size_t must not be truncated or accepted under that rule. `%c`
continues to use the original promoted integer ASCII byte. Non-ASCII values
require the exact native fallback until a separately proven contract exists.

`english-primary-batches.json` freezes a disjoint source authoring queue from
the engine's source preparation metadata, SHA-256
`8ef2abf214a1e459803bbbaddae8c171aa830fb875c1f488d931f685515dd10f`.
Prepared and frozen sources cover 5,000 of 5,984 core literal IDs; 984 IDs still
lack native source preparation. After excluding frozen IDs, the 38 reviewed
literal proposals and all 997 paired authoring queue IDs, the remaining queue
contains 3,196 IDs: 1,636 without arguments, 20 numeric-only and 1,540 with text
or mixed arguments. The numeric batch above is complete; the other 14 queues
remain source translation work. Root owns the first zero-argument batch.

Combining the 570 stable new authored frames with the existing 38 literal
proposals and 771 frozen message templates gives 1,379 distinct source frames.
The other 4,605 core literal IDs still need whole-message Japanese authoring at
this checkpoint. This arithmetic describes source text, not runtime coverage
or localization of every argument. Dynamic origins, help/menu/lore/data text,
and public entity-name composition remain separate coverage obligations.

Read-only validation of an authored prepared-English queue uses:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 nethack/locales/phase4/verify-authored-batches.py --input nethack/locales/phase4/english-primary-numeric-only-batch-1.json
```

The validator checks original IDs/sites/source hashes, every typed union and
printf suffix, literal token positions, required helper variants, explicit
grammar omissions, runtime-false guards and all 12 frozen-input hashes. It does
not prove Japanese meaning or producer branch/lifetime/overwrite dataflow and
does not execute C, Lua, Rust, Node or a browser. New runtime approvals remain
zero in all artifacts owned here.
