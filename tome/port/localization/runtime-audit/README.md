# Observed native translation lookups

This is a read-only classification of `scenario.coverageBefore` from the actual
Japanese browser proof. It does not add translations or change the native
translation adapter. `reviewed-summary.json` records the exact proof hash,
original source hashes and consumer/producer locators. The detailed per-key
report is `unknown-callsite-classification.json`.

The captured snapshot has 977 source/tag/file/line/reason keys and 1,450
occurrences. No keys were omitted or source strings truncated. Of these keys,
953 already contain Japanese. In 877 cases the input exactly equals a shipped
Japanese translation target. These are observations of second lookups, not 953
new untranslated English texts; equality does not prove translation quality or
justify reverse string replacement.

| Consumer family | Keys | Occurrences |
| --- | ---: | ---: |
| Japanese effect labels reentered into `_t` | 590 | 611 |
| Japanese talent-type labels reentered into `_t` | 266 | 295 |
| Japanese object/randart names | 92 | 411 |
| Decorated Japanese evolution talent labels | 4 | 4 |
| Decorated Japanese terrain name | 1 | 1 |
| English talent labels | 23 | 127 |
| Builtin `Players` faction label | 1 | 1 |

All 24 ASCII source/tag pairs lack both an official English-source registration
and a current semantic route. Every pair has an actual producer locator in the
report. Twenty labels have meaningful original names requiring reviewed exact
semantic display routes and Japanese terminology. Four `malleable-body.lua`
labels contain upstream placeholder text; their intended label policy remains a
concrete review question. Registration alone does not establish player access.
Eleven inscription labels explicitly belong to the legacy section retained for
compatibility and occasional NPC use.

`Activate Object` is a particularly sensitive generated talent name.
`ActorObjectUse.lua:73` supplies the seed for `T_ACTIVATE_OBJECT_<n>` at lines
78–82; lines 259–262 assign the generated ID and `short_name` before `newTalent`.
Changing the constant would alter gameplay/save identities. Its template is
hidden and already supplies translated activation display text. Any new route
must operate on the native display lookup while preserving the identity seed.
The builtin `Players` faction also derives its internal `short_name` before
translating its display name. External actor/player names remain untouched.

Next work should retain producer IDs and composition parameters at registration
and dynamic object/randart/terrain/evolution seams. This snapshot contains no
help consumer and does not establish campaign or full dynamic-help coverage.
These observed runtime gaps are separate from the 479 supplemented static IDs.

Reproduce after the parent's browser job finishes:

```powershell
& 'C:\Program Files\nodejs\node.exe' --max-old-space-size=64 unknown-runtime-audit-work/audit-unknown-runtime.mjs
```

The script streams JSONL inventories and registry routes, writes only its own
directory, and rejects a proof modified during its scan. The latest run sampled
107,356,160 bytes of RSS; it executed no gameplay, RNG, builds or tests.
