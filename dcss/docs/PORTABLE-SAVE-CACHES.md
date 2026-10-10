# Portable native-save cache transport

This change affects Worker save enumeration only. It omits these exact
directories below the engine's /persist filesystem root:

| Worker relative path | Engine absolute path | Source-derived content |
| --- | --- | --- |
| saves/db | /persist/saves/db | Compiled text databases and lock files |
| saves/des | /persist/saves/des | Compiled map definitions, indexes, Lua preludes and lock files |

The filter checks that each exact path is a directory. It does not exclude
other directories with similar names, arbitrary .db/.des files, files whose
whole relative path is saves/db or saves/des, or any other native state.
Enumeration keeps all remaining paths and bytes unchanged. Neither enumeration
nor save transport removes the cache directories from the live engine FS.
Restoring a validated native pack still uses the existing Rust source/ABI/path/
checksum/size checks. The complete immutable engine data remains in the engine
bundle; this transport filter does not edit or remove it.

## Pinned source evidence

The pristine upstream Git HEAD was read and verified as DCSS 0.34.1 commit
1eebc1a2892e1c89776a0d7a10691f8dac8d9796. These anchors are in
upstream/crawl-ref/source relative to the dcss project root:

| Source anchor | What it establishes |
| --- | --- |
| files.cc:686, savedir_versioned_path | Cache paths are below Options.save_dir; VERSIONED_CACHE_DIR selects a separate version directory when enabled. |
| database.cc:169, _db_cache_path | Text DB caches use savedir_versioned_path("db/" + db). |
| database.cc:211, TextDB::init | Missing/outdated databases enter _regenerate_db and reopen the result. |
| database.cc:243, TextDB::_needs_update | Compares mandatory source-file timestamps with the cached TIMESTAMP. |
| database.cc:300, TextDB::_regenerate_db | Regeneration creates the DB directory and reads the original text data inputs. |
| maps.cc:1261, _des_cache_dir | Map caches use savedir_versioned_path("des"). |
| maps.cc:1389, _load_map_cache | Missing or invalid map cache/index causes a cache-load failure. |
| maps.cc:1469, _write_map_cache | Parsed definitions produce map cache/prelude/index files. |
| maps.cc:1483, _parse_maps | Cache-load failure reparses the original .des source and writes the cache. |
| mapdef.cc:2471, map_def::load | Lazily loaded definitions need regenerated .dsc content available before use. |

The exact /persist/saves/db and /persist/saves/des paths above come from the
current portable bundle's parent-reported read-only FS inspection. The filter
deliberately does not generalize to versioned cache directories or future
layouts. A changed engine configuration requires a new source/layout review.

## Why transport was blocked

The parent reported this read-only initial-game filesystem measurement:

| Content | Files | Bytes |
| --- | ---: | ---: |
| Native .cs package | 1 | 33,775 |
| Native .prf preferences | 1 | 180 |
| saves/db source caches | 22 | 1,903,616 |
| saves/des source caches | 553 | 9,191,365 |
| Total | 577 | 11,128,936 |

Transporting every file exceeds the existing Rust native-envelope bounds of
512 files and 8 MiB. This exact cache filter keeps those bounds unchanged.
The initial measurement above was supplied by the parent; it was not repeated
by this Worker-only task.

## Validation and pending gate

worker-protocol-evidence/cache-filter.cjs is a Node built-in stub test against
the actual Worker host. It verifies a 577-file count fixture, preserving all
33,955 native fixture bytes and omitting only the 575 cache fixtures. Cache
fixtures use small synthetic bytes, not the measured 11 MiB cache payload.
Additional fixtures verify exact directory matching, nested/near-match path
retention, regular files with the two exact names, byte preservation, unchanged
live FS, and identical filtering for files() and save(). The earlier Worker,
main-thread and timer-order protocol stubs and both syntax checks also pass.

These stubs do not run DCSS and do not verify regeneration or native resume.
Before claiming native-save portability, the parent must complete sequential
resume with omitted caches against the full rebuilt engine and immutable data:
confirm successful database/map cache regeneration, preserved native state and
all PCG streams at the same suspended input point, and equal subsequent command
results. The existing bounded pack must also successfully round-trip the real
filtered files. No native engine, engine build or Chrome was executed for this
cache-filter change.
