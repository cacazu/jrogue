# Prepared two-TU runner

This is source preparation with eleven light source/filesystem assertions.
Those checks do not load the Windows job guard. The authorized `cpp2-initial`
attempt stopped before any compiler launch on directory-size metadata differences;
its raw evidence is preserved and diagnosed in [METADATA-DIAGNOSIS.md](METADATA-DIAGNOSIS.md).
The separately authorized corrected trial subsequently compiled both translation
units. [Actual compile proof](compile-verification.json) records artifact/MMD
hashes, resource measurements and closed owned jobs. There was no final link or
native producer/Rust/browser execution. Any further trial needs a new parent
reservation; existing outputs are preserved.
Browser recovery retains priority when its fresh 7 GiB physical / 9 GiB exact
commit gate fits. Unrelated applications remain outside runner ownership.

The reviewed files are:

| File | SHA-256 |
| --- | --- |
| `compile-plan.json` | `f5e5f97a1cd2c8540f73675cc3d0bf8fc4cc462d48fa5f55a1b983c2ae1f3f0e` |
| `compile-plan.accepted-source-preparation.json` | `64944ad062935850e922d241ab3b4bfc8215b6cca03f3a5cd95af1914c38063c` |
| `run-compile-window.py` | `0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395` |
| `run-compile-window.source-reviewed-d1716065.py` | `d17160650e884c169d262b535dc6f9716655ceff97eab4a10d54c6f001f6d0d3` |
| `run-compile-window.source-reviewed-90ca1d77.py` | `90ca1d77519b768601eb68dfd179536c21c3d7ceb3c317b91f40968d3f58a88b` |
| `runner-pins.json` | `8af61c2fafff3bb1f7ef33361293893a0a7d150c517c30653ff372e1760274db` |
| `test-runner-source.py` | `bc28bd85e3d6d2ce104160f20fd156d1451d0be2b1d25f28ea03f691cbfcd3e1` |

The current compile manifest corrects only the accepted historical plan's guard
metadata: native physical/exact commit counters, 250 ms sampling, unnamed Windows
job/suspended-root ownership, exact returned-handle cleanup and unrelated-app
ownership. Compile argv, staged sources, dependency/tool pins and thresholds
remain unchanged. `correct-guard-metadata.py` records that one-time correction;
the older preparation generator represents the archived source-plan stage.

The runner reads and validates 207 unique byte-pinned files, including the three
staged source/header files, 144 original non-system MMD dependencies and accepted
baseline objects/logs. Supplemental pins cover official SDK freeze/config/port
implementation, configured Node, seven existing official port recipes, archives
and exact acquisition URL markers. It rejects even present-empty SDK override
variables and inherited compiler include/config paths. The selected SDK config
sets `FROZEN_CACHE = True`; missing variants cannot acquire the SDK cache lock.
No downloads, dependency installation, SDK activation or security changes are
part of this window.

`validate_plan` now reads each plan/pin manifest once, verifies that buffer's
SHA-256, and parses those exact same bytes. The prior reviewed runner and its
three proof JSON files are preserved under `*.source-reviewed-90ca1d77.*`.
That narrow correction changes no flags, thresholds, staging or file-pin set.
The later metadata correction changes only directory `st_size` to `null` in
the shared metadata record producer. Both pre-stage and terminal gates still
compare complete entry membership, mtime, mode, attributes and every regular-file
size; reparse rejection and all 207 byte pins remain enforced. Original `d171…`
runner/proofs and failed raw metadata are preserved unchanged.

The runner loads the reviewed fixed wrapper SHA
`0b04ccd828c52c874169b25336a729553c767b0c3580386e007c33a8a00604fb`
from the same bytes it verifies, with `compile(..., optimize=0)`. It calls that
module's `load_guard` and `run_owned`, using an in-memory adaptation of the
nested historical-helper record and explicitly setting the helper's `PLAN` to
the current accepted C++ plan. It never calls the parser CLI or historical
`run_stage` directly. Historical helper SHA remains
`ae54cce5dbbe2e769d52572528f750b0573ef37fb172cc29db8ab8fa8208a8c3`.

Before each sequential compile, current source/tool pins and frozen-tree
metadata are checked and native exact counters are recaptured. The policy is
fresh 4/6 GiB, 1 GiB kernel hard aggregate job-memory/private cap, a 1 GiB
summed working-set threshold sampled every 250 ms, 2/2 GiB running floors,
180 seconds per TU and one compiler worker. The working-set threshold triggers
owned-job stop; it is not a kernel hard aggregate working-set ceiling.
The fixed outer owner covers setup/query exceptions and retires only its new
job handles or exact returned suspended-root/process handles. The second TU
cannot start after a failed stage or cleanup audit.

Use these source-only commands from the task-8 workspace:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -B 'integration-overlay\build-plan\cpp-compile\run-compile-window.py'
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -B 'integration-overlay\build-plan\cpp-compile\test-runner-source.py'
```

The following exact command completed the corrected compile-only trial. The flag
records a parent reservation; it does not request another user approval. Parent
first confirms no other owned Chrome/compiler job occupies that slot, then
invoked the separately reserved fresh attempt name:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -B 'integration-overlay\build-plan\cpp-compile\run-compile-window.py' --run --parent-released-window --runner-sha256 0ed16674c31ab9335b75c71afc8c73b717398f4cbd56613840ee2266e64ea395 --attempt-name cpp2-corrected-preflight
```

Exact two `-c` argv arrays are retained in `compile-plan.json`. No linking,
Cargo, engine execution or browser execution is included. Any existing owned
compile-check `.o`/`.d` output causes refusal, preserving baseline and previous
attempt artifacts; a retry/output relocation needs a fresh reviewed plan.

Future evidence goes under `execution/<attempt>/`: copies of the reviewed
plan/pin manifest/runner; per-stage exact argv, native counter decisions,
PID/creation identity/job-member resource samples, diagnostic logs, fixed outer
cleanup records, object/MMD archives and hashes, actual byte-pinned non-system
dependency lists, before/after pin and frozen-tree audits, and terminal status.
Driver-launch attempts and returned root creation are recorded separately.
Tree metadata detects size/time/type/attribute or membership changes without
rehashing the roughly 605 MB cache. Directory length is excluded because its
representation varies independently of those invariants; see the measured probes.
Explicit SHA pins prove only those files' byte identity; neither metadata nor
MMD establishes a complete SDK Python import graph or all system headers.

Proofs: [runner-source-validation.json](runner-source-validation.json),
[runner-source-tests.json](runner-source-tests.json) and
[runner-source-review.json](runner-source-review.json). The assertions cover
4/6 and browser 7/9 boundaries, invalid counters, empty SDK overrides, conflicting
pins, wrong plan pin, fixed-primitive call shape and validation-mode guard
isolation. They do not exercise Windows resource enforcement or cleanup.
The added regression also proves single manifest reads and exact verified-buffer
identity at both JSON parser calls.
Metadata regressions normalize all archived 448 directory-size-only differences,
detect directory mtime/mode/attribute changes, and exercise file-size changes,
directory mtime changes and new entries in a fresh owned filesystem fixture.

Before this trial neither TU had an attributed memory peak. The corrected trial
measured fit within the guarded 1 GiB limit for these two compiles; it establishes
source/type/access and Emscripten compile handling only. Linking/exports, native producer execution, Rust host
consumption, save/state/RNG purity and browser/game acceptance remain pending.
