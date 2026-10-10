# Cataclysm: DDA — Japanese Web migration

This directory is an incremental migration of the real **Cataclysm: Dark Days
Ahead 0.I-1 (Ito-1)** source, not a substitute game. **The full Rust/browser port
and local browser verification are not complete.** The original native game and other
titles in the shared repository are outside this directory's scope.

The user's clarification, “WEB公開ってhtml作ってnodeでローカルで検証までだぞ”,
defines delivery as HTML served and fully verified through Node on localhost.
External Site creation, deployment, or updates are outside the active request,
including after local completion. Historical audit and test records are retained.

Official upstream: https://github.com/CleverRaven/Cataclysm-DDA

Stable source commit: `7b2efa5cea38e4d4d97dd0e63b28b9148623da59`

The complete 246,881,123-byte official source ZIP is retained separately in
`upstream/`. Its SHA-256 is
`5814398ae9cd5887a5a078ff36f3da62314e1f5a501f12242a0d3dc1d4872693`.
Every one of the 9,921 tracked source/asset files matches the immutable official
Git tree (938,215,541 uncompressed bytes; no missing, changed, or extra files).
See `acquisition.json` and `upstream-integrity.json` for measured evidence.

The verified user plan specifies logic, presentation, platform, and input layers.
The user explicitly confirmed that gameplay remains in the original language;
the latter three layers are separated in Rust. Read [ARCHITECTURE.md](docs/ARCHITECTURE.md)
for layer ownership, save/RNG requirements, and local completion gates.

## Current work

The resumed increment is recorded in [RESUMED-LOCAL-MILESTONES.md](docs/RESUMED-LOCAL-MILESTONES.md).
The separate v5 variant is served at <http://127.0.0.1:8878/v5/index.html>.
Its seventeen HTTP files and real Rust asset policy pass; actual engine rendering,
world/game/save and mobile verification remain open. Fifteen selected original
input-method cases produce twenty-four native records; six help-related C++ units
compile. These bounded proofs do not complete the four-layer migration.

- `audit/`: official stable release, source, licenses, bundled assets, and browser
  build evidence. Main code/content are CC BY-SA 3.0; fonts and dependencies have
  separate notices. External sound packs are not acquired or assumed freely
  redistributable under one license.
- `inventory-tools/`: reproducible source, gameplay/data/text, PO plural and
  placeholder inventory. Large generated inventories are local artifacts.
- `rust-contracts/`: typed domain contracts plus Rust input, presentation, and
  platform crates. Coverage applies only to the implemented contracts until an
  actual original-engine bridge connects them.
- `domain-milestone/`: supplementary damage/resistance verification research with original-function
  provenance and C++/WASM differential verification. It is not the complete
  combat system or an alternate game loop, and does not replace the original core.
- `engine-build/`: trusted official full-engine Emscripten build harness, generated
  overlays, reproducible source enumeration, compiler manifest, and actual logs.
  No generated files are written into pristine upstream.
- `ja-completion/`: reviewed patches for missing and defective upstream Japanese
  translations. Patch completion alone does not establish runtime semantic-ID
  migration or entire-game JSON coverage.
- `catalog-reconcile/`: official JSON parsers and GNU xgettext establish 105,003
  current marked keys; an independent check verifies all 539 addition records,
  613 exact JSON pointers and 1,899 terminology references against pristine source.
- `ja-current/`: 539 reviewed current-source additions and matching source-companion
  English/Japanese JSON. These companion files are not the Rust runtime catalog:
  a reviewed registry normalizes 180 inherited candidates, so all 539 public IDs
  pass the Rust grammar. Their printf/plural metadata still needs conversion to
  typed events. The current MO covers all 105,003 marked keys, applies
  163 current earlier patches, and passes an independent GNU gettext round trip.
  Dynamic/unmarked text and the entire-game semantic migration remain open.
- `semantic-runtime-catalog/`: 315 reviewed literal entries in the actual Rust
  catalog schema, with 224 source-bound exclusions for plural, parameter,
  snippet, rich-text and dialogue behavior. Fourteen Node suites and all seven genuine Rust catalog-consumer tests pass;
  live original-engine production and whole-game consumption remain pending.
- `semantic-plural-slice/`: 155 unchanged public plural-term IDs with 200 native
  source bindings and the real Japanese MO. Fourteen Node tests check 2,500
  modeled formats; all five genuine Rust tests and the standalone wasm32 C++
  selector fixture pass. Live native name assembly/FFI remain pending.
- `semantic-parameter-slice/`: three source-bound message programs preserve typed
  term parameters and exact locale output. Eleven Node checks and seven genuine
  Rust catalog tests pass; package formatting and Clippy with warnings denied also pass.
  Nine parameter exclusions remain explicit; loaded
  native term identities, original producers and live FFI are unconnected.
- `rng-adapter/`: original C++ algorithm-preserving state adapter, with engine
  and its six `rng.cpp` distribution states captured/restored transactionally. Original
  comparisons, malformed states and allocation failures are verified separately
  from full-game integration.
- `determinism-audit/`: 840 source files and 24 reviewed findings identify
  additional rendering, weather, distribution and clock/save boundaries.
  Its 1,043 checks validate source evidence; full-game continuation remains
  unverified.
- `cosmetic-purity-overlay/`: separation of three cosmetic draws in two CPP files,
  with pure C++/Rust helpers and 3,676 Node assertions. Five genuine std-only
  Rust helper tests pass. The separate `native-cosmetic-parity/` packet now passes
  23 actual C++/Rust cross-language checks with complete captured-stream equality.
  Live original callers, original RNG/save continuation and full render purity
  remain unverified.
- `full-engine-overlay-plan/`: the authoritative v2 source plan preserves 231
  original recompilations, four fresh observer helpers and 207 baseline objects.
  The reviewed serial rebuild is in progress; the final 442-object link and
  actual-game observer acceptance remain pending.
- `baseline-preview/`: full original-engine local browser package tooling;
  preserves every bundled data/gfx asset, Japanese fonts and required notices.
  Audio is disabled in this reference; the Rust audio adapter, full Rust renderer
  and actual full-game browser verification remain incomplete.
- `rust-browser-bridge/`: actual bounded Rust WASM input/presentation integration
  tools, with original C++ gameplay authoritative. Full context/render/storage
  ownership must still be proven in the game.
- `browser-qa/`: isolated real-Chrome gameplay evidence harness. Preparation or
  isolated WASM tests do not constitute passing full gameplay flows.
- `integration-overlay/`: reversible, source-pinned live input-context snapshot
  preparation. Its 1,206 checks include source/patch construction and a tiny
  isolated WASM notification-boundary fixture. The C++ module and separate
  Rust snapshot consumer are separately scoped: both actual C++ translation
  units compile and its 19 genuine Rust tests pass against synthetic transport.
  The actual compiled snapshot module also passes 29 isolated WASM ABI checks
  and emits nine exact native JSON fixtures; four additional Rust tests consume
  those native bytes successfully. The current formatted fixture also passes
  package formatting and Clippy with warnings denied; the original proof is preserved.
  Its callback contexts are synthetic and live command ownership remains denied.
  Full-engine linking, original input-handler execution, and the live connection
  remain pending real-engine tests.
- `help-semantic-slice/`: 14 exact English/Japanese help and keybinding entries,
  typed key references and direction-grid data, plus a source-only C++/Rust
  adapter. Its 1,763 checks pass; compilation and actual consumers are pending.
- `presentation-snapshot-overlay/`: source-pinned, reversible text-submission
  observation plus an owned Rust binary parser. Its 445 lightweight checks, all
  five genuine Rust parser tests, standard format check, and Clippy with warnings denied pass.
  The current formatted-source proof is `RUST-FORMATTED-VERIFICATION.json`; the
  earlier proof remains preserved separately. Original
  C++ compilation and live consumption remain pending. Tiles, minimap,
  ImGui, semantic emission and full screen composition remain unresolved.
- `optimizer-diagnosis/`: exact flags, versions, input structure and resource
  observations for the long original-engine link. The separate-output conservative
  link `-O1` candidate ran for 249.926 seconds, then its required memory guard
  stopped it when commit headroom fell below 2 GiB. After preserving its input,
  objects and diagnostics, the verified original optimizer was ended under
  parent authorization to release memory for one exclusive same-mode retry.
  The exclusive same-object retry succeeded in 229.930 seconds: JS syntax,
  WASM validation and artifact/provenance hashes pass. The 134,832,388-byte WASM
  and 498,522-byte JS are a complete original-engine reference. Browser gameplay
  and complete Rust/semantic integration remain pending.
  A raw Chrome JSPI probe passes 16 checks, while source analysis leaves the
  original exception/callback bridge unverified for JSPI.

Run `node tools/check-local-completion.mjs .` to inspect completion readiness.
It writes `completion-gates.json` and returns exit code 2 while any required
actual-game evidence is absent. Bounded unit or differential tests do not satisfy
complete gameplay, original RNG/render purity, versioned save/resume, full
semantic translation, or desktop/mobile browser flows. The old checker filename
remains a compatibility wrapper; historical `publication-gates.json` is retained.

Local delivery additionally requires `evidence/local-node-delivery.json` to
verify Node serving, loopback binding, HTML delivery, WASM MIME type, runtime
asset integrity, and absence of external runtime requests. Audited notices and
available port source are recorded in `evidence/local-delivery-notices.json`.

## Local serve and browser verification

The original-engine package is ready and is currently served through Node at
http://127.0.0.1:8878/ from this requested game folder. After the earlier staging
server exited, the same source and manifest pins were checked and localhost
service restored here; see `evidence/local-server-restoration.json`. The package
has been independently verified at
`baseline-preview/web`; see `evidence/local-runtime-handoff.json`. Its 121 files include every
bundled runtime data/gfx asset, the pinned Japanese catalog, and 60 notices.
The engine and catalog hashes are recorded in `progress.json` and the package
manifest. This is an original C++ reference with a bounded Rust browser shell;
complete Rust input/presentation/platform ownership remains pending.

Actual Chrome verified the native Japanese menu, help and literal text input.
Two diagnosed adapters fix the compressed-filesystem MO mmap boundary and
preserve native SDL logical dimensions before CSS viewport fitting. Native
custom-world Enter work exceeded the first session's 4 GiB Chrome budget while system
memory remained above its floors. The clean 5 GiB retry then hit the unchanged 2 GiB physical-memory floor
during native custom-world Enter work. Its actual fresh launch values were
5.725 GiB physical and 6.501 GiB commit headroom, lower than the preparation
snapshot. Both browser sessions closed cleanly. Full gameplay, save continuation
and mobile gates remain unverified.

A source-backed compilation-mode candidate remains unconsumed under a strengthened
7 GiB physical / 9 GiB commit launch gate, with unchanged 5 GiB owned-private
cap and 2 GiB system floors. The mandatory-counter and process-identity guard fix
passed its isolated actual Node probe before another real browser run. Earlier private sums remain
logged observations; their old null-counter path could undercount totals. Read [BROWSER-MEMORY-RECOVERY.md](docs/BROWSER-MEMORY-RECOVERY.md)
for exact measurements, package ownership, bounds and conditional recovery.
No unconditional browser restart is running.

Verify the selected engine/package and serve locally:

```powershell
node .\baseline-preview\verify-shell.mjs
node .\baseline-preview\verify-package.mjs
node .\baseline-preview\serve-local.mjs 8878
node .\tools\check-local-completion.mjs .
```

Read [browser-qa/README.md](browser-qa/README.md) for resource-gated isolated
Chrome verification. A menu capture alone does not satisfy gameplay/save/mobile
completion. Package or compiler recovery must preserve existing source/evidence,
use one heavy job and pass fresh resource gates; unrelated jobs are not stopped.
The active request authorizes Node localhost only and no external deployment.
