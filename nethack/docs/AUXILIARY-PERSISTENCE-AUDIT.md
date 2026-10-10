# Native auxiliary persistence audit

Read-only source/compiled-configuration audit on 2026-10-02 for the pinned NetHack 5.0.0 commit `16ff59115315917b93185d026aeefea06db9b0f4`. This establishes the browser file allowlist; it does not establish that an actual death, bones creation/consumption, or score restore has passed browser integration tests.

The actual builder flags were supplied to Emscripten's preprocessor with `hack.h`. The macro output is recorded locally at `build/source-check/compiled-file-macros.json`. The target defines UNIX and `HACKDIR="/"`; WIN32, VMS and PREFIXES_IN_USE are absent. `src/files.c:354` returns the basename unchanged when PREFIXES_IN_USE is absent, and `sys/libnh/libnhmain.c:169,463` changes the working directory to HACKDIR. BONESPREFIX=3 and SCOREPREFIX=5 therefore do not select other directories. Native auxiliary files are root files in this build.

`RECORD="record"`, `LOGFILE="logfile"`, and `XLOGFILE="xlogfile"` are compiled. Persist exactly `/record`, `/logfile`, `/xlogfile`, and the committed bones filenames described below. Hydrate them before native main and capture the complete allowlisted filesystem snapshot at native `onExit`, after score/log writes have finished. Replacing a complete snapshot must retain the deletion of bones consumed during an adventure. Never merge only newly present files into an older snapshot.

`LIVELOGFILE="livelog"` is also compiled, but `src/sys.c:63` initializes `sysopt.livelog=LL_NONE`, and the packaged sysconf does not enable it. The browser allowlist deliberately excludes `/livelog`; if that optional native feature is enabled later, its persistence must be added explicitly. DUMPLOG is not compiled. Panic diagnostics, lockfiles, ongoing level files and temporary bone files are outside the allowlist.

## Committed bones grammar

`src/files.c:set_bonesfile_name` (lines 769–810) builds `bon`, an optional single digit pool number, the dungeon bone identifier, `0` or the role's three-letter quest filecode, and a dot followed by the numeric dungeon level or special-level bone identifier. The optional pool digit is `(unsigned)ubirthday % min(bones_pools,10)` and is used only when BONES_POOLS>1. `src/sys.c:62` defaults the setting to 0 and the pinned sysconf leaves BONES_POOLS commented out. The current default therefore generates no pool digit, while the allowlist accepts the full pinned function's 0–9 pool form.

There is no `.bones`, `.Z`, or `.gz` suffix in this target: COMPRESS and ZLIB_COMP are absent, and the compiled external save-conversion hook is a no-op. There is no UID, player name, custom fruit name, race, gender, or explorer/debug name in a committed bones basename. Custom fruit information is native bonefile content. Discover mode cannot create bones (`src/bones.c:382`); wizard mode uses the same basename function.

Use this anchored, case-sensitive basename expression, then prefix the accepted basename with `/`:

```regex
^bon[0-9]?(?:D0\.(?:[1-9]|[12][0-9]|3[0-2]|[ROB])|G0\.(?:[1-9]|[12][0-9]|3[0-2]|[VJBAXYOFG])|M0\.(?:[1-9]|[12][0-9]|3[0-2]|T)|Q(?:Arc|Bar|Cav|Hea|Kni|Mon|Pri|Ran|Rog|Sam|Tou|Val|Wiz)\.(?:[1-9]|[12][0-9]|3[0-2]|L))$
```

The numeric arm is bounded by compiled MAXLEVEL=32, rather than depending on a particular generated dungeon's depth. Native `no_bones_level` additionally rejects special levels with no bone tag, bottom levels, multiway branch levels below level 1, and the invocation level. Endgame depth and portals also prevent creation. The filename allowlist does not duplicate those gameplay decisions.

The actual `dat/dungeon.lua` bone tags yield these persisted families:

| Dungeon | Prefix | Special suffixes with bones |
| --- | --- | --- |
| Dungeons of Doom | `bonD0.` | `R`, `O`, `B` |
| Gehennom | `bonG0.` | `V`, `J`, `B`, `A`, `X`, `Y`, `O`, `F`, `G` |
| Gnomish Mines | `bonM0.` | `T` |
| Quest | `bonQ{role}.` | `L` |

The role codes are exactly Arc, Bar, Cav, Hea, Kni, Mon, Pri, Ran, Rog, Sam, Tou, Val, Wiz (`src/role.c`). Sokoban and Tutorial have no dungeon bone tag. Fort Ludios has K tags but its sole level is a bottom level. Vlad's Tower has dungeon T but all its special levels lack bone tags. All Elemental Planes levels lack special bone tags. Those unreachable bones families are excluded.

Examples accepted: `bonD0.5`, `bonM0.T`, `bonQVal.L`, `bon3D0.5`. Examples rejected: `bonD0.05`, `bonM0.E` (minend has no bones in 5.0.0), `bonQWiz.goal`, `bonD0.5.bones`, `bonD0.5.Z`, `0player.bn`, `record_lock`, `../record`.

`set_bonestemp_name` (lines 812–831) replaces the live lock file's suffix with `.bn`. `create_bonesfile` writes that temporary file; `commit_bonesfile` (lines 915–938) renames it to the name returned by `set_bonesfile_name`. Persist only the latter. Transient lock/level files must never be restored into a new module.

## Required platform verification

The allowlist and lifecycle choices above are source evidence. The release owner still needs a real native quit/death score lifecycle test and auxiliary storage failure tests. A consumed bonefile must remain deleted after a new page/module; a failed write must preserve an exportable complete pending snapshot and must not silently discard or overwrite the previous stored snapshot. Cross-tab adventures require a separate conflict policy if supported. Browser storage eviction and closing a live adventure before a native completed save/exit remain limitations of local browser persistence.
