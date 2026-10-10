Phase 4/5 acceptance is prepared as source only. It has not executed against a
new compiled candidate. The historical edec runtime, 95 browser/boundary checks,
and formatted Rust 49-test evidence remain separate and unchanged.

Root first installs and freezes the isolated candidate under `build/phase4/web`.
The actual host fetch path and `--catalog-path` must agree. Prepare its explicit
hash config after that build, from the `nethack` working directory:

```powershell
python tests/prepare-phase45-acceptance-config.py --catalog-path gameplay-core.json
```

This lightweight preparation hashes ten runtime files and the source message /
diagnostic metadata. It does not load WASM or authorize a heavy runtime job.
Root separately grants the measured browser slot after checking at least 2 GiB
of free physical and commit headroom. Use `tools/run-monitored.py` with distinct
resource-report/log paths under `build/phase4/acceptance`, running these suites
serially and draining the first Chrome/server tree before starting the next:

```powershell
node --max-old-space-size=128 tests/browser-host-phase45-browser.mjs --stage-config build/phase4/acceptance-config.json
node --max-old-space-size=128 tests/browser-host-phase45-name-producers.mjs --stage-config build/phase4/acceptance-config.json
```

The first preserves the full normal-adventure 18-stage suite: all 13 native
roles, actual source IDs and Japanese/English replay, C state/RNG/input invariance,
PC/mobile input, native save/fresh restore, and score/log persistence. The second
preserves the ten original explore-mode stages and strengthens the unknown glass
orb to require an actual nested `definite` article recipe and translated public
appearance, exact native English, and no visible hidden crystal-ball name.

The explore startup additionally exercises original `/` then `?` lookup. Its
native getlin event must own the pinned `src/pager.c:1844` source ID; Japanese
prompt replay, exact English, a literal UTF-8 draft, and 100 active-prompt repaints
must preserve C state/RNG, consumed input and the draft. Cancelling uses the
original Escape response. Native wishes retain their dynamic English prompt
fallback; they are not among the eleven static getlin seeds.

The scripts collect possible impossible/quest/accessibility descriptors but keep
their proof flags false. Observation alone does not prove diagnostic ownership,
quest paragraph grouping, or preserved public coordinate prefixes. No native
impossible error is forced, no world/RNG/C fields are edited, and original debug
authorization/sysconf/getuid are unchanged. Additional authentic source-reachable
fixtures are required for those claims. The adapter rejects missing or changed
hashes before launching Chrome and rechecks runtime/config/metadata at the end.
Candidate reports and screenshots stay under the configured acceptance directory;
the historical reports are never their default output.
