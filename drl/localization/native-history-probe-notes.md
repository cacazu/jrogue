This source-only harness runs the actual `drlsemantichistory` store and generated
`drlsemantichistorycatalog` validator/projector. It was not compiled or executed
by its author because the coordinating agent owns the sequential native jobs.

Compile `native-history-probe.pas` with the coordinator's native Win64 FPC
snapshot. Unit search paths must include `localization` and
`localization/overlay/src`, plus that snapshot's `rtl-unicode`, `fcl-base`, and
`fcl-json` packages. The generated catalog additionally uses
`drlsemanticregistry`; the store uses `drlsemanticfeelings` for strict UTF8 and
JSON preflight. No Lua library, original player object, game loop, or browser is
required.

Run with exactly one argument: an initially absent isolated temporary JSON file.
The probe refuses an existing file or directory. Every write and delete targets
that exact argument; it does not use `/user` or a game save path. Successful
execution prints a JSON object with native check and rejected-load counts and
removes the temporary file.

Fixtures keep original English history in memory and install read-only indexed
and current-entry callbacks. The semantic resolver uses actual canonical EN/JA
IDs and delegates interpolation to `DRLEnglishText`; registry and overcharge
projection run through the actual generated units. UTF8 initialization follows
the root mixed probe: `fpwidestring`, `{$codepage utf8}`,
`SetMultiByteConversionCodePage(CP_UTF8)`, and byte-copy literal helpers.

Coverage includes remember/replay, caller parameter mutation, signed Int64
extrema, opaque CJK/emoji/percent/braces parameters, exact original index/text
guards, clear/save/load, closed file handles, failed saves before truncation,
atomic rejected loads, missing callbacks/files, changed projector output, and
malformed resolver UTF8. There are 31 structured JSON mutation fixtures plus
duplicate fields, trailing documents/bytes, truncation, empty files, invalid raw
UTF8, excessive nesting, more than one MiB, and more than 4096 records. The shared
JSON preflight also imposes a token bound, so large record fixtures may reject
there before reaching the store's decoded-record count check.

Source lexical checks and ten canonical Japanese fixture comparisons passed.
Those checks do not establish native compilation or runtime success. Full item
aspect-chain provenance and the real Lua adapter/save lifecycle remain separate
integration work.
