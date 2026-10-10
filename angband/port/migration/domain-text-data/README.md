# Original domain data text

Pinned Angband 4.2.6 commit: `f3082213b73f3e463e3d0d60bff4b00462beae6e`.
The authoritative full commit is also stored in every generated manifest.

This catalog has 1,059 actual data text endpoints, five native custom grammar
endpoints, and five source-reviewed composition templates. All 1,069 have
reviewed English/Japanese JSON and matching typed placeholders.
The original data files remain byte-for-byte intact. Eleven pristine source hashes
cover the nine data files and the terrain/timed canonical enum declarations.

| Data | Native records | Runtime endpoints |
| --- | ---: | ---: |
| Object kinds | 375 | 161 |
| Activations | 163 | 164 |
| Player timed effects | 53 | 275 |
| Traps | 40 | 128 |
| Terrain | 25 | 81 |
| Shapes | 9 | 41 |
| Curses | 27 | 61 |
| Artifacts | 138 | 143 |
| Ego items | 107 | 5 |

`inventory.json` records each declared field and its original source lines.
`bindings.json` maps native canonical indices and field/grade/blow slots to IDs.
`source-manifest.json` adds reviewed Japanese, typed capture contracts, consumer
sites, and the two declared fields ignored by the actual native parser.
`schema.json` and the two flat locale files are ready for the root-owned catalog
registry. The numbered authoring files are offline review inputs; game runtime
must select the semantic ID by the captured native identity, never English text.

Important native behavior:

- Activation and curse arrays reverse the input linked-list order. Curse index
  1 is `air swing`, and index 27 is `vulnerability`.
- Shape blow lists also prepend records. Their runtime ordinal reverses source
  order, and duplicate verbs preserve their distinct weighted branches.
- The werewolf `effect-msg` precedes its first effect. The original parser
  ignores it, so the runtime catalog excludes it explicitly.
- Timed grade name/up slots of one character are native null sentinels. Optional
  absent down slots remain absent. FOOD grade 6 ends with an empty optional down
  token: native `strtok` omits it and leaves `down_msg` null. Its declared text and
  reviewed Japanese remain in ignored-field evidence, with no runtime endpoint.
- Artifact `alt_msg` takes precedence over activation text only after the original
  activation and its default message have both passed the non-null gate.
- `{name}` and `{kind}` copy the already generated complete naming capture. They
  use the original prefix/base and aware-kind branches respectively. Null objects
  use the reviewed `hands` literal identity. `{s}` and `{is}` use original object
  presence/count predicates, with Japanese suffix/copula output intentionally
  empty. These are grammar slots, not unreviewed English string parameters.
- Terrain look prefixes/prepositions and shape blow verbs are grammatical
  fragments. The locale-aware enclosing composition must preserve source-selected
  identities and Japanese word order. The native source data is not rewritten.
- Every artifact description (138), actual alternate activation message (5),
  object-kind description (141), and supplied ego description (5) is covered.
  The 102 ego records without prose have no invented description.

Lightweight source-only checks:

```powershell
node migration/domain-text-data/extract.mjs
node migration/domain-text-data/build.mjs
node --test migration/domain-text-data/catalog.test.mjs
```

These verify catalog/source identity and coverage. Runtime C producers, custom
grammar resolver integration, and real browser behavior are coordinated by the
root agent and are not claimed as completed by this catalog.
