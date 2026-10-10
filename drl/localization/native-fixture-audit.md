# Source-only native fixture audit

Reviewed the authored semantic probe, feeling harness and frozen semantic/feeling units against official FPC commit `843eb4a6ac1e7c995c0af626c88639e4b1aeaf0d`. No compiler, Cargo, browser, server or Git commands were run. No canonical catalog or Pascal implementation was edited. These are source findings; actual native/WASI execution remains with the root agent.

## Findings requiring adapter/harness follow-up

1. **Pinned FCL `joStrict` does not reject all raw JSON string controls.** `toolchain/fpc-src/packages/fcl-json/src/jsonscanner.pp:565` identifies bytes `#0..#31`, but line 614 rejects only `Sp^ < #20` (decimal 20). Consequently raw U+0014 through U+001F inside a quoted string pass that check. `drlsemanticfeelings.pas:95` deliberately allows non-NUL ASCII in decoded text, so the UTF8 validator does not close the JSON lexical gap. Test raw `#20` and `#31` inside an otherwise valid quoted JSON string through the exported `DRLSemanticPreflightJSON`. Escaped `\u0014`/`\u001f` are different: they are valid JSON escapes and may remain permitted decoded text.
2. **Pinned FCL accepts the non-JSON escape backslash-apostrophe under `joStrict`.** `jsonscanner.pp:546` includes apostrophe in `SimpleEscapes_Spell`; lines 596–605 accept it without consulting `joStrict`. Add that exact invalid escape fixture, since an arbitrary `\q` test misses it. A narrow adapter lexical check can reject unescaped string bytes below 32 and the invalid escape set before FCL parsing, while preserving valid whitespace outside strings. The official source should remain pristine.
3. **Valid JSON whitespace must remain accepted.** FCL scanner lines 234–253 accept space, tab, CR and LF; reader lines 201–207 skip trailing whitespace before strict EOF validation. The current feeling harness correctly rejects a *second root* (`Saved + '{}'`), and does not currently contain an invalid whitespace-rejection assertion. Add positive leading, inter-token and trailing whitespace cases. Do not use a compact-serialization expectation as a parse-validity rule.
4. **`GetJSON` is not the sidecar's parser contract.** `jsonparser.pp:83–87,104–107` creates the helper parser with `joSingle` and optional `joUTF8`, without `joStrict`; full trailing-input validation occurs only with `joStrict` and without `joSingle`. Harnesses must mirror `TJSONParser.Create(data, [joUTF8, joStrict])`, as the feeling unit already does.

## Harness interpretation and missing measurements

`semantic-probe.pas` has 17 ASCII `DRLText` checks. It does not load JSON, persist files, exercise non-ASCII codepages, test `DRLEnglishText` bypass with an installed resolver, or establish native/WASI feeling behavior. Its successful run should be reported at that scope.

The exported `nativePascalHarness` has 16 malformed-load fixtures and 24 other direct `Check` sites; each malformed fixture performs four checks (88 checks if the entire path succeeds). It covers deep copies, guard mismatch, language fallback, failed-load disabling, exact Int64 minimum, and a valid quoted/backslash/newline/Japanese/astral external-name round trip. It does not count checks in its output.

Its rejection fixtures do not isolate every named cause:

- The raw surrogate fixture is not JSON independently of UTF8 validity. Add direct `DRLSemanticValidUTF8` assertions with byte-built overlong, stray-continuation, surrogate, truncated and out-of-range sequences.
- Escaped NUL and surrogate fixtures modify an integer parameter; canonical Int64 validation would reject those values even if Unicode validation were absent. Add malformed string-parameter fixtures and/or direct UTF8 assertions.
- Add native positive/negative Int64 maximum and minimum boundaries, valid whitespace, empty snapshot, resolver exception/invalid output fallback, record/parameter/text aggregate bounds, and the two FCL lexical gaps above. The current Node oracle has broader cases, but source regex/oracle success does not execute Pascal.
- Construct raw bytes with `SetLength` plus ordinal indexing and assert their byte length/values when isolating UTF8 behavior; this avoids relying on numeric-character literal/codepage conversion semantics.

The schema mutations use the exact text `"schema" : 1`. This is correct for the standalone pinned FCL default: `fpjson.pp:638` uses `SpacedQuoted = ('" : ', ' : ')`, class booleans default false and initialization calls `DetermineElementQuotes` at line 4320. The harness explicitly checks that each fixture differs from `Saved`, so a serializer configuration change fails as a fixture no-op rather than silently testing a valid file. A token-aware mutation or an explicit compressed/uncompressed fixture would be more portable if a harness is embedded in a process that changes global `TJSONData.CompressedJSON`.

## Codepages and available packages

Win64 RTL already initializes its Windows string conversion manager (`rtl/win64/system.pp:446–447`). `fpwidestring` is not inherently a missing Win64 dependency. WASI initializes the default manager (`rtl/wasicommon/system.pp:519`); its default ANSI/Unicode conversions in `rtl/inc/ustrings.inc:71–109` do not provide full Unicode conversion. A WASI harness that explicitly tests those conversions should initialize `fpwidestring`. Its direct dependencies `unicodedata` and `charset` are already in the RTL; it does not directly require `rtl-unicode` or `unicodeducet`. Add a Unicode package path only for an explicit harness import requiring it.

`TJSONStringType` is `UTF8String` (`fpjson.pp:66`), and the scanner with `joUTF8` emits UTF8 bytes directly. Pure typed UTF8 JSON parsing does not by itself prove that `fpwidestring` is needed. Conversely, assigning JSON `AsString` directly to ordinary `AnsiString` on Win64 can transcode UTF8 to the active ANSI codepage. Keep the authored byte-copy seam: `ReadString` calls `ByteString(data.AsString)`, JSON insertion copies bytes into `TJSONStringType`, and serialization returns `RawByteString`. The feeling harness's `B` helper and `{$codepage utf8}` preserve its source literals. Adding `fpwidestring` alone is not a replacement for those byte-preserving conversions.

Available read-only package evidence:

- Win64: `toolchain/fpc-win64-snapshot/units/x86_64-win64/{rtl,rtl-objpas,fcl-base,fcl-json,rtl-unicode}`. `fpjson`, `jsonscanner`, `jsonreader`, `jsonparser` PPUs and objects exist in `fcl-json`; `fpwidestring`, `unicodedata`, `charset`, `classes`, `sysutils` exist in `rtl`.
- Current WASM exceptions: `toolchain/rtl-exnref` and `toolchain/packages-exnref/{rtl-objpas,rtl-unicode,fcl-base,fcl-json}/units/wasm32-wasip1`. All four JSON PPUs/objects exist; `build-evidence.json` records exit 0, compiler hash `5ac9eaad7c3276872ac0bd9f832c010214cec41562d3116b2d455be14028aa15`, and official source hashes matching the reviewed files.
- A branchful `fcl-json/units/wasm32-wasip1` directory has no built target units. Do not mix current-exception JSON PPUs with branchful RTL. For the demonstrated package set select `-CTwasmexceptions` and the separate current-exception tree.

## Root-owned sequential command recipe (not executed here)

Use an isolated output directory per target and argument arrays; `-n` prevents accidental global FPC configuration. The following compiles the current authored feeling fixture; emit its Pascal source with the existing lightweight `--emit-native` option first. The paths are relative to the task workspace and should be resolved to absolute paths by the root's command wrapper.

```powershell
# Win64: use matching snapshot packages, with no WASI units in the search path.
$fixtureArgs = @(
  '-n', '-Twin64', '-Futoolchain/fpc-win64-snapshot/units/x86_64-win64/rtl',
  '-Futoolchain/fpc-win64-snapshot/units/x86_64-win64/rtl-objpas',
  '-Futoolchain/fpc-win64-snapshot/units/x86_64-win64/fcl-base',
  '-Futoolchain/fpc-win64-snapshot/units/x86_64-win64/fcl-json',
  '-Futoolchain/fpc-win64-snapshot/units/x86_64-win64/rtl-unicode',
  '-Fulocalization', '-FU<isolated-win64-output>',
  '-o<isolated-win64-output>/feeling_sidecar_harness.exe', '<emitted-fixture.pas>'
)
& 'toolchain/fpc-win64-snapshot/bin/i386-win32/ppcrossx64.exe' @fixtureArgs
# Run only after successful compile; pass one fresh task-local JSON filename.

# WASI current exceptions: never add the branchful RTL/package directories.
$fixtureArgs = @(
  '-n', '-Twasip1', '-CTwasmexceptions', '-Futoolchain/rtl-exnref',
  '-Futoolchain/packages-exnref/rtl-objpas/units/wasm32-wasip1',
  '-Futoolchain/packages-exnref/rtl-unicode/units/wasm32-wasip1',
  '-Futoolchain/packages-exnref/fcl-base/units/wasm32-wasip1',
  '-Futoolchain/packages-exnref/fcl-json/units/wasm32-wasip1',
  '-Fulocalization', '-FU<isolated-wasi-output>',
  '-o<isolated-wasi-output>/feeling_sidecar_harness.wasm', '<emitted-fixture.pas>'
)
& 'toolchain/fpc-src/compiler/ppcwasm32.exe' @fixtureArgs
```

The existing `toolchain/wasm-probe/run.mjs` supplies empty WASI arguments and no filesystem preopens, so it cannot run this file harness unchanged. A root-owned runner needs `args: ['feeling_sidecar_harness', '/user/fixture.json']` and `preopens: { '/user': '<fresh isolated local fixture directory>' }`, and must check process exit/stdout plus file cleanup. This is a fixture directory, not the real game save directory.

## Reviewed baseline hashes

These hashes identify the units at the time of this review; a later parent-owned lexical guard fix requires fresh hashes and measured execution.

| File | SHA-256 |
| --- | --- |
| `localization/semantic-probe.pas` | `3897ca97dda39fad7dabba28458b0f24636b15733cc26b4bdfea680d6091c23e` |
| `localization/feeling-sidecar-test.mjs` | `05d5b19fb4d806acca6a00b87285628b1e20790e72762e66a3c48397e62ab2ce` |
| `localization/drlsemantictext.pas` | `a8c2522e41ff3ed812b3cb1f4690e808d547b1b0543aa915a6ef6c418f62f6d3` |
| `localization/drlsemanticfeelings.pas` | `361aee5f2f59c8e93bcb9dabd16d92ce9eecbd20c8c955ebccf9646e15246828` |
| Official `fpjson.pp` | `2439fd578dade787f2e6b10ee3dab3f891235d9682803659831ab468ee99fc70` |
| Official `jsonscanner.pp` | `534199b729f2f1a67a7986b5ffd71ecdce58400a45c0e85946ad39185d3fb286` |
| Official `jsonreader.pp` | `ce8197d42cd9105ffc76dafa58ff5cdca431c99a6d6c652f4bedf2a4310c277f` |
| Official `jsonparser.pp` | `d8aa85c486428341b8cffc1965e3c0e5506fac381aa6b4e7de960329f1a992e6` |

Authored `drlsemantictext.pas` and `drlsemanticfeelings.pas` matched their corresponding frozen overlay units byte-for-byte during this review.
