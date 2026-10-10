These adapters prepare acceptance of an isolated Phase6/7 runtime. They have not run against it. The historical Phase3 and Phase4/5 runtimes, reports, failures, screenshots and configuration hashes remain unchanged.

Root must finish the frozen full-engine build, then run the separate original-data-consumer gate:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 tools/semantic-text/data-consumer-qa/run-phase6.py --run --run-name phase6
```

Root creates `build/phase6/data-consumer-binding.json` only after that gate passes. The binding requires `status: "passed"`, `candidate_engine_wasm_sha256`, `engine_manifest_sha256`, `archive_sha256`, `consumer_report_sha256`, `generator_manifest_sha256`, and `datafile_expected_actual_bytes`. The probe is a separate WASM program. Its SHA does not stand for the full engine; the binding identifies the exact embedded `nhdat`, target flags/headers and original reader scope. Encyclopedia reader execution and exhaustive coverage of all 148 assets remain pending.

After the completed build and reader gate, these commands hash files without loading a game:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 tests/prepare-phase6-acceptance-config.py
```

Config preparation refuses to overwrite an existing frozen config and requires a fresh report directory under `build/phase6`. Choose a new `--output` and `--report-directory` for any rerun or changed artifact. Each suite exclusively reserves its own report and artifact targets before creating an engine or browser. The loader verifies 11 runtime files, all actual compiled C/Lua sources and headers, final engine/source/data manifests, inherited and new source-owner metadata, the public-appearance ledger, and optional Phase7 plan/adapters. It rejects an unbound native ID or conflicting original call. The reader also pins the exact consumer preparation, separate probe CJS/WASM binaries, raw archive, target macros and flags, shared headers, original reader bodies, every unique successful compiler unit, and the actual WASM-embedded archive/table plus its JS loader. It rehashes all bound inputs at completion. A configuration grants no execution permission.

Only after Root grants the serial slot and all prior jobs are closed, set the task-specific guard and run each owned tree separately from the `nethack` directory:

```powershell
$env:NETHACK_PARENT_SERIAL_SLOT = 'phase6'
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 tools/run-monitored.py --cwd . --report build/phase6/acceptance/compiled-resources.json --log build/phase6/acceptance/compiled.log --minimum-free-gib 2 -- 'C:\Program Files\nodejs\node.exe' --max-old-space-size=128 tools/semantic-text/phase6-immutable-catalog/tests/registered-catalog-wasm.mjs --stage-config build/phase6/acceptance-config.json
```

Drain the boundary tree and obtain the next parent slot before normal browser acceptance:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 tools/run-monitored.py --cwd . --report build/phase6/acceptance/browser-resources.json --log build/phase6/acceptance/browser.log --minimum-free-gib 2 -- 'C:\Program Files\nodejs\node.exe' --max-old-space-size=128 tests/browser-host-phase6-browser.mjs --stage-config build/phase6/acceptance-config.json
```

Drain that Node/server/Chrome tree before the next command. The monitor takes a fresh physical **and** commit headroom measurement before every tree:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 tools/run-monitored.py --cwd . --report build/phase6/acceptance/native-name-resources.json --log build/phase6/acceptance/native-name.log --minimum-free-gib 2 -- 'C:\Program Files\nodejs\node.exe' --max-old-space-size=128 tests/browser-host-phase6-name-producers.mjs --stage-config build/phase6/acceptance-config.json
Remove-Item Env:NETHACK_PARENT_SERIAL_SLOT
```

The normal suite retains the existing 18 stages, including all 13 roles, PC and fresh mobile touch input, native save/fresh-instance restore, and score/log hydration. It receives the exact staged app response without lifecycle instrumentation. Native callback observation remains explicit test instrumentation.

The native suite retains 10 name/getlin/hallucination stages, adds same-page native save/restore catalog lifecycle coverage, and adds three optional Phase7 native stages when enabled. It uses original `-X`, native wishing/apply/drink/lookup commands and original `accessiblemsg,cmdassist` options. It neither authorizes `-D` nor writes game fields, wizard policy, RNG, host accounts or production startup. Quest, accessibility qualifier, impossible ownership and the five wizard-gated Phase7 branches remain pending unless an actual accepted native fixture proves them.

For startup lifecycle observation, the native suite uses a **test-only CDP Fetch response overlay**. It verifies the original `app.mjs` bytes/SHA and one insertion anchor before replacing that response. The report records exact observer source, insertion, original and served overlay hashes/bytes. No staged file is written. The ccall wrapper forwards the original `this`, argument list, return value and thrown exception with `Reflect.apply`; it observes only module serial, export names, handles, lengths, kinds/locales and lifecycle results. Ended-game catalogs remain available for history; both release explicitly before same-page replacement, and the next module registers two fresh module-local catalogs.

Each stress/invariance loop retains the complete original history and performs exactly 100 transitions in ten bounded batches. The earliest expected EN/JA paints and ended-history paints are separately guarded and recorded; they are not included in those 100. The shared preparation compares control values, check states, carets and active-control identity before either first baseline paint. It compares full DOM, translation/fallback metadata, control values/selections, canvas pixels and scroll position against the two locale baselines on every transition. Immutable captured records, cached full frame, input queue/total and C/world/RNG checksums must remain identical. The only ccall export allowed during repaint is `nh_rust_format_registered`; registration and release occur outside repaint. Reports include measured total/batch times and actual call counts. These are end-to-end locale rendering plus full DOM/canvas/history comparisons, not formatter-only latency. There is no legacy comparator or speedup claim.

The unknown glass-orb assertion requires the exact emitted public alias `nethack.public.appearance.glass_orb.97eda687ce`, nested Japanese appearance and exact original English. It rejects `crystal_ball`, `source_enum`, `otyp`, hidden name-index or knowledge fields in the nested public wire. Private original source IDs appear only in offline ledger evidence. Protected hallucinated naming requires either the exact source-certified public random-name descriptor or the exact original C public English row with an actual NULL descriptor; neither branch may query native naming or RNG during repaint.

Native QUESTION semantics are eligible only for the original `shim_yn_function` callback with window `-1`. Alternate `yn_menu`/`shim_end_menu` output retains complete original English until its actual source-owned menu window is certified. The separate approved `getlin/-1` path is unchanged. Numeric wrong-callback/window and outside-scope getter probes must return pointer zero.

The compiled boundary adapter has 32 grouped source-prepared cases and starts one module without gameplay. It verifies catalog ownership, registered/stateless equivalence, exact typed/nested/quest bounds and no-write canaries. Its results do not prove native callback association. Every revised acceptance config requires fresh parent-authorized syntax, compiled ABI and browser runs; earlier preserved results remain bound to their original test-source hashes.

For this frozen build, the compiler-output and installed JS are byte-identical. The embedded-data collector recorded a UTF-8 text hash after Python normalized exactly two CRLF pairs; its raw artifact record retains the actual served-byte hash. The separate `js-certificate-normalization-proof.json` binds both records without editing either artifact or manifest. The acceptance readers require the exact two offsets, strict UTF-8, reversible CRLF conversion, unchanged loader bytes/hash and complete manifest/compile/WASM/source bindings. Any other mismatch fails. This is a collector-hash certificate, not runtime postprocessing.

Owned invariance normalizes only the intentional `select#locale.value` change. Every exact paint, both baseline paints, and all measured transitions separately require its real value to equal the requested locale; the full per-locale DOM snapshot retains that real value. Every other control value, check state, caret, control ID/tag/type and focus remains exact. The first executed normal-suite failure is preserved under `build/phase6/failures/normal-locale-contract-r1`; it is a test-contract false positive and remains a failed historical run.

The hallucinated-name check accepts only one of two source-certified paths: an exact nested public random-table name, or an actual NULL descriptor preserving the complete original English message. A nonnull malformed or unproved descriptor fails. The fixed-seed baby gray dragon fixture excludes the previously observed kitten ID only for that observed draw; a legal future random choice may coincide with a target name. The general privacy proof binds the original once-selected display-RNG/pmname pointer, eight exact compiled function slices, the unchanged no-query bridge and label table, and the existing 24 source checks. The checks retain exact EN/JA output, strict typed unions, no private fields, getter expiry,100 locale transitions and branch-specific ended-history replay. Runtime fallback is reported unverified when only the public random-name branch was exercised.
