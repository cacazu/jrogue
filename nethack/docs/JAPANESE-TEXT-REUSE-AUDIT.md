# Japanese source-text reuse audit

Reviewed 2026-10-02, read-only. The requested path `C:\Users\kit\gameme\jnethack\source` does not exist. The actual adjacent checkout is **`C:\Users\kit\gameme\jnethack\jnethack\source`**. No file in that checkout was changed, no strings were integrated, and no build, browser or network service was started for this audit.

## Finding

The adjacent JNetHack checkout is a substantial, licensed source of Japanese translation candidates. It can accelerate the semantic JSON phase through **offline source pairing**, while retaining the official NetHack 5.0.0 C core as the target. It should be treated as a translation reference, not substituted for the target engine.

The most directly useful scopes are 180 conservative paired message calls, 424 monster-name string slots, 782 object/name/appearance string slots, and 754 Japanese quest text leaves. These are separate lexical candidate counts, not a claim of 2,140 unique, validated runtime messages; duplicates, existing seed overlap, untranslated individual slots, grammar and public-knowledge rules still need review. None of this audit changes the current runtime coverage.

## Identity, instructions and provenance

| Item | Observed value |
|---|---|
| Git HEAD | `25adee135c4bbd43ac8567664f600b565332435c` |
| Local tag description | `v5.0.0-0.2` |
| Origin metadata | `https://github.com/jnethack/jnethack-alpha.git` |
| Engine version | `include/patchlevel.h`: NetHack 5.0.0, edit level 0 |
| Japanization version | `japanese/jpatchlevel.h`: 0.2.0, edit level 0 |
| Release history | `ChangeLog.j` describes the NetHack 5.0.0-based test release on 2026-09-20 and crash fixes on 2026-09-23 |
| Source encoding | The inspected C, headers, Lua and metadata decode as UTF-8; local files often contain doubled CR before LF |

`source/AGENTS.md` explicitly says that English originals and Japanese translations remain in the source for translation work, but that the JNetHack executable itself is Japanese-only. It prescribes `#if 0 /*JP*/` / `#else` / `#endif` for replaced English code, `#if 1 /*JP*/` for additions, and also permits `/*JP:T*/` and a one-line `/*JP ... */` form. `japanese/AGENTS.md` says the new Japanization directory does not use those paired-block markers. Those instructions describe this adjacent source; they do not authorize changes to the official target.

The official release object `16ff59115315917b93185d026aeefea06db9b0f4` is not present in the adjacent Git object database, so a local `merge-base` cannot prove its exact ancestry. Version labels alone are insufficient. Compatibility below is established for specific strings/calls/table keys against the target's preserved official files.

The adjacent checkout has tracked local modifications in seven files: `dat/quest.lua`, `src/rumors.c`, and five `win/win32/*` files. The working quest file contains more Japanese than HEAD. For a reproducible reuse source, read the **HEAD blobs** and record their hashes; do not silently use these uncommitted edits. This audit counted quest translations from `git show HEAD:dat/quest.lua`, not from the dirty working file.

## License and attribution

`READMEj1.txt` states that the Japanization follows the original `dat/license` and that copyright in those parts belongs to the translation authors. It identifies Issei Numata, HAMADA Naoki, Shigehiro Miyashita, Tomoyuki Shiraishi, Kazuhiro FUjieda, Kunedog, Shinkou Awatsu, Takeshi Nishimura, 高田幸治, SHIRAKATA Kentaro, 板倉充洋, 樋口雄一 and Haruko Numata. Current source headers also retain the earlier authors and SHIRAKATA Kentaro's continuation dates. The README's old 3.6.1 wording is a historical notice; it does not make the entire checkout a 3.6.1 engine.

After normalizing CR line endings, the adjacent `dat/license` is identical to the target's official **NetHack General Public License**. Reuse is therefore supported by an explicit Japanization license statement, subject to the same NGPL terms already applicable to the target. Before distributing reused translations:

- Preserve the applicable NetHack and JNetHack author/copyright/no-warranty notices and the full NGPL.
- Identify imported translations as JNetHack-derived, and distinguish later adaptations from the original translators' work. Do not label borrowed translations as wholly Codex-authored.
- Add prominent change/date notices for adapted source or generated translation artifacts, with notices in a retained sidecar where the JSON format cannot contain comments.
- Extend the corresponding-source bundle and notices with the pinned reuse inputs, extraction/adaptation script and per-entry provenance. Keep the derivative distribution under the identical NGPL terms.

No proprietary art, audio, installers or executables are needed for this text reuse. No license change has been made by this audit.

## Countable source scopes

| Scope | Static finding | Pairing route |
|---|---|---|
| Core C message producers | 131 adjacent `src/*.c` files; 2,832 `#if 0` JP/JP:T blocks with `#else`, of which 2,616 Japanese branches contain Japanese characters | Paired original/translated branches, not rendered output |
| Conservative single calls | 920 one-call literal pairs with the same recognized sink; 180 retain identical argument expressions and ordered printf tokens, with the entire English call found in the same official source file | Bind to an official call-site semantic ID and typed arguments |
| Literal-only subset | 45 of those 180 have no printf substitutions; 135 are formatted | Review helper prefixes and full message grammar even for the literal subset |
| Monster definitions | All 394 `MON` records match official enum keys; equal name-slot cardinality yields 424 name strings, including gender variants | Stable monster enum + name field, preserving native visibility/naming decisions |
| Object definitions | 482 literal-bearing records match official enum keys and string-slot cardinality; 782 name/appearance string slots | Stable source record + name/appearance field; includes generic classes and 20 extra scroll-label records |
| Tracked quest data | 1,132 string leaf paths match official `questtext`; 942 are visible text/synopsis/array paths, of which 754 contain Japanese | Original Lua role/message/field/array path, e.g. `Arc.firsttime.text` |
| Quest limits | 323 translated `text` fields and 431 translated array items span common + all 13 roles; 188 matched visible leaves remain English, and two official string leaf paths are absent | Review every unmatched/English path; do not declare complete quest coverage |

The C count intentionally accepts only simple complete single-call branches for a small sink set (`pline`, `pline_The`, `You`, `Your`, `You_hear`, `You_feel`, `You_see`, `You_cant`, `There`, `verbalize`, `Norep`, `raw_printf`). It respects nested preprocessor blocks, rejects `#elif` alternatives for this count, removes comments/whitespace while preserving string tokens, requires identical non-format arguments and printf token order, and checks the English call against the same preserved official file. Complex paired blocks, changed helper APIs/argument expressions and the inline comment form can yield additional candidates after a stronger parser and manual review. The figures are conservative scope estimates, not generated catalogs or an exhaustive parser certification.

Entity counts came from balanced macro calls and their final stable enum identifiers, with name/appearance slots paired across the two source files. They do not certify equivalence of every non-text table field or establish that those entity labels are currently localized in the browser. Quest counts came from a static Lua table/string tokenizer, not Lua execution; `output` mode and fallback-control strings were excluded from the visible-text count.

## Concrete examples

| Source identity | Official English | JNetHack Japanese |
|---|---|---|
| `src/apply.c`, paired `pline` call near adjacent line 3607 | `Oh wow, man: Fractals!` | `ワーォ！フラクタル模様だ！` |
| `src/apply.c`, paired `pline` call near adjacent line 1787 | `To attach candles, apply them instead of the %s.` | `ろうそくを取り付けるには，%sではなくろうそくを使ってください．` |
| `GIANT_ANT` monster name | `giant ant` | `巨大蟻` |
| `GOBLIN` monster name | `goblin` | `ゴブリン` |
| `DAGGER` object name | `dagger` | `短剣` |
| `POT_HEALING` name / base appearance | `healing` / `purple-red` | `回復の薬` / `赤紫色の` |
| `Arc.firsttime.text` opening | `You are suddenly in familiar surroundings.` | `あなたは突然見覚えのある場所にいた．` |
| `Val.gotit.synopsis` | `[You must return %o to %l.]` | Still English in the tracked Japanese source |

The formatting-call example retains `xname(obj)` in both branches. Its future `%s` argument must carry the public object name/appearance selected by the official core, with localization at the typed argument boundary. It is not permission to expose the object's hidden real identity.

## Safe extraction route and limits

1. Pin the adjacent HEAD and retain the precise translation source blobs, notices and hashes. Keep the official target archive and commit unchanged.
2. Match English source producers to official source call sites, entities by stable source enum/field, and quests by original Lua semantic path. Reject unmatched or ambiguous cases. Do not match completed runtime English sentences.
3. Assign or reuse the target's English semantic IDs and record official source locations, JNetHack source locations, translation authorship and argument schemas. Convert printf/quest substitutions deliberately to the existing `{id,args}` contract.
4. Validate English/Japanese key sets, typed placeholder compatibility, UTF-8 escapes, plural/helper-prefix grammar and source-call evidence; review adapted translations with their surrounding logic.
5. Instrument official C/Lua **text emission** before English formatting. Keep RNG choices, turn consumption, native visibility and naming decisions in the original core. Then test Japanese prompts, entity knowledge, save/restore and redraw invariance in actual gameplay.

This route must not import Japanization gameplay patches, Japanese-only wish/genocide input handling, CP932/EUC conversion or the byte-oriented `jlib.c`/`jconj.c` helpers wholesale. `You`/`You_feel` and similar helpers have implicit language-dependent prefixes; identical printf order alone does not establish complete sentence compatibility. Quest `%p`, `%H`, `%o` and related codes use the original quest substitution grammar, not C printf, and require dedicated semantic argument handling. Object appearance labels must follow the core's shuffled appearance mapping and knowledge flags, independently of undiscovered object type.

Other data has uneven coverage: inspected `rumors.tru`, `rumors.fal`, `epitaph.txt` and `data.base` contain no Japanese characters. `engrave.txt`, `oracles.txt` and `help` contain Japanese, but `help` still advertises a 3.6 explanation. Treat those as review references, not aligned 5.0.0 replacements. The adjacent README itself acknowledges remaining untranslated portions and Windows/tty-only support.

The current browser still exposes game prose as `upstream.untranslated`; adding source candidates does not itself localize runtime output. Existing authored seed counts must not be combined with this audit's slot counts without checking overlap. Full Japanese completion remains a producer-instrumentation, argument-localization, grammar and runtime-verification task.

## Fingerprints for future reuse

These hashes identify inspected raw local files; CR-normalized content was used only for comparisons. The quest HEAD hash identifies the tracked blob separately from the dirty working file.

| Input | SHA-256 |
|---|---|
| `READMEj1.txt` | `ea9098fa735f411e3b2f31ed9c475a950f5ebf09ff553b39e15947db25ed108e` |
| `dat/license` | `4852f6ab1ab1159e7811a954a6216a9b4cd734303e92eff588d34bd21c04d525` |
| `include/monsters.h` | `7718a9c5d3c99c1045b834296075b0055d0ec2d2ae4259781faba67a639c4f26` |
| `include/objects.h` | `300aac1455f862f290db5d4c4e5a64eebec61c176f68b1b192811f522be645c4` |
| `dat/quest.lua` at HEAD | `78b537c2cd2cbcc0fd2f0831881ba970f08e5c12937b5dd94063c1cd81af6c83` |
| `dat/quest.lua` working snapshot, excluded from candidate count | `dc957d4758b62f2e81dd9d0df566f11404a1aa574d30574391717a03f7026b5f` |

Only this audit document was added for the reuse investigation. Integrating and distributing any of these translations is separate work requiring the provenance, notice, source-package and runtime steps above.
