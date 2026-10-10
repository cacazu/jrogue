# Actual Pascal localization fixtures

The five fixture programs link the authored Pascal localization units under `overlay/src/`. They do not execute the original game, Rust renderer or a browser. Node preparation and source tests verify hashes and injection boundaries; native results require the official compiler and the resulting executable. The parent agent owns those measured runs.

Run from the task workspace in PowerShell 7:

```powershell
node localization/prepare-native-probes.mjs
node localization/native-probes-source-test.mjs
& .\localization\run-native-probe.ps1 -Probe semantic
& .\localization\run-native-probe.ps1 -Probe json-contract
& .\localization\run-native-probe.ps1 -Probe feeling
& .\localization\run-native-probe.ps1 -Probe item
& .\localization\run-native-probe.ps1 -Probe history
node localization/record-native-evidence.mjs
```

Each invocation starts one compiler and then one fixture sequentially, with a 60-second process wait and no visible window. Timeout cleanup has a further two-second wait; each output stream has a one-second drain limit. Incomplete cleanup or output is recorded as a failure. It creates a fresh directory under `localization/native-probe-build/`, copies the prepared program byte-for-byte there, and writes compile/run logs plus `result.json`. The result records source, compiler, executable, authored/generated unit and verification hashes; nonzero execution exits remain failures. Every file fixture receives an initially absent path in that fresh directory and deletes only its own file. It cannot use `/user` or a native game save.

The pinned official compiler is `toolchain/fpc-win64-snapshot/bin/i386-win32/ppcrossx64.exe`, with prelaunch SHA-256 `fc3a8184a70722be726264faac4357fe11851e3edb899be8ced0aea82d4e9cb0`. Required Win64 packages are `rtl`, `rtl-objpas`, `rtl-generics`, `rtl-unicode`, `fcl-base` and `fcl-json` under `toolchain/fpc-win64-snapshot/units/x86_64-win64/`; source-only review confirmed them present. The fixtures use the original-engine `-Sc` assignment-operator option, `fpwidestring`, `-FcUTF8` and `SetMultiByteConversionCodePage(CP_UTF8)` for the same tested UTF-8 setup as the parent's mixed Pascal/Lua adapter. No installer or downloaded source program runs during preparation.

| Fixture | Actual Pascal coverage | Fixture boundary |
|---|---|---|
| `native-semantic-probe.pas` | `DRLText`, `DRLEnglishText`, placeholder validation, English bypass, UTF-8 callback bytes, Int64 extrema | Explicit tiny resolver; catalog/browser ABI not exercised |
| `native-json-contract-probe.pas` | Shared production `DRLSemanticValidUTF8` and `DRLSemanticPreflightJSON`; 46 checks | Byte-built malformed UTF-8, all 32 raw string controls, legal whitespace/escapes, invalid escape set |
| `native-feeling-probe.pas` | Actual feeling remember/replay/save/atomic load, guards, exact integer/string parameters, malformed snapshots | Explicit tiny validator/resolver; generated feeling catalog is compiled separately by the original-engine build |
| `native-item-name-probe.pas` | Actual item sidecar plus real generated base/transition catalog and registry; persistent QWord UID, idempotence, bounds, schema/guard/chain rejection | Six canonical Japanese templates in a tiny locale resolver; actual whitelist and store remain production units |
| `native-history-probe.pas` | Actual history sidecar plus real generated validator/projector/registry; original English/index guards, source callbacks, deep copies, bounds and malformed snapshots | In-memory original-history source callbacks; game/Lua history save restoration remains an integration gate |

The item and history fixtures mutate serialized candidates using FCL only to author test input. Rejection goes through the production bounded parser/loader. Their implementation is not the Node sidecar oracle. [Independent source audit](native-fixture-audit.md) records pinned FCL findings and the distinction between source checks and native execution.

The parent retained the pre-fix native JSON failure witness at `native-probe-build/native-json-contract-probe-83106b31212d4a9bb29890ed32ca943d/result.json`: 13 failures in 46 checks. The pinned FCL scanner accepted raw string control bytes 20–31 and backslash-apostrophe. Canonical `drlsemanticfeelings.pas` now adds a bounded, constant-memory string lexical guard before the unchanged FCL structural scan. Its SHA-256 is `e94ec50f63be9e91f4329d320e6d0576143cfa2a65d010c2e0add14971d8125d`; the original unit is archived in `strict-json-proposal/original-drlsemanticfeelings.pas`. Normal runner mode verifies the integrated correction; the parent subsequently ran all 46 native JSON checks successfully.

Generated feeling/history contracts now store `TDRLTextParamKind` and named enum constants, matching actual parameters. The separate item rule `Kind: Byte` represents fixed/prefix/schematic operations, not parameter kinds. All 39 emitted Pascal units have a source audit for duplicate interface/implementation imports.

## Observed native execution

The parent performed these actual native compile/run jobs. Counts come from their executable output, not the Node oracles. Every listed successful result has compile and run exit code zero, an exact fixture source hash and the pinned compiler hash. The JSON and feeling records also pin all four authored and four generated units. The earlier semantic result predates the runner's expanded unit-hash fields; it remains scoped to that exact semantic fixture/executable.

| Fixture | Actual result | Retained result and measured-job log |
|---|---|---|
| Semantic | 22 checks passed | [Result](native-probe-build/native-semantic-probe-33b662c6b1fb41dfb8de3eea64eb3cf0/result.json) |
| Corrected JSON contract | 46 checks, zero failures | [Result](native-probe-build/native-json-contract-probe-752a34498fef4e7ebaaa655e20466cda/result.json), [measured log](native-probe-build/native-json-contract-fixed-memory.json.stdout.log) |
| Feeling sidecar | 90 checks passed | [Result](native-probe-build/native-feeling-probe-1e02745f32514270b3118034c20bb8c2/result.json), [measured log](native-probe-build/native-feeling-memory.json.stdout.log) |
| Item names | 174 checks passed | [Result](native-probe-build/native-item-name-probe-b194f8f80d0d4a5eb2a07c433d5d2599/result.json), [measured log](native-probe-build/native-item-memory.json.stdout.log); original-engine `-Sc` option enabled. |
| History | 363 checks passed, 43 rejected loads | [Result](native-probe-build/native-history-probe-5341dcf3c3d14467a12701f2b3ce7df0/result.json), [measured log](native-probe-build/native-history-memory.json.stdout.log) |

The [historical JSON regression witness](native-probe-build/native-json-contract-probe-83106b31212d4a9bb29890ed32ca943d/result.json) remains unchanged with 13 failures. The corrected result is separate; the failed result is never converted into a pass. JSON/item/history/feeling fixtures establish their own boundary contracts, not the complete original game.

`record-native-evidence.mjs` reconciles these five existing results into `native-execution-evidence.json` and `verification.json`, checking compile/run exits, exact fixture/compiler/executable hashes, stdout and the recorded authored/generated unit hashes. It records 695 native checks and retains the historical failure separately. It never compiles or executes code. Re-run this reconciliation after `verify.mjs --no-native` when preserving these native statuses; the ordinary source verifier writes a fresh source-only report. Any unavailable/mismatched witness makes reconciliation fail rather than inventing a pass.

The current localization checkpoint has 3,675 equal EN/JA IDs, 1,467 guarded patches and 63 passing Node tests. Full localization remains incomplete. Original-game/browser runtime, save/resume integration and PC/mobile browser gameplay gates remain separate from fixture success. Delivery is local HTML plus Node/browser verification; this workflow creates no external Site or deployment.
