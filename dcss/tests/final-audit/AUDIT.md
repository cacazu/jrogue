Read-only final DCSS audit passed 54 byte/schema/evidence checks. No engine, browser, WASM or build ran; installed files were not written.

The saved real core browser receipt passes 18 checks, protocol mocks 88 (44+19+16+9), paired native smoke 8+8, native resume 5+5+5, independent locale comparison 17 and explicit reference adapter 9. Final controlled combat/branch/death/victory pass 8/10/4/4 entries; the 26 entries contain 15 distinct check strings with repeated lifecycle/shared fixture checks. These are different scopes and are not an aggregate whole-game coverage count.

Current manifest SHA256: 19c869720e0624222171c17eb19ceb9b784aebf67fe5ce66133028ae5775d900. All preserved paired native receipts and final embedded browser build use the same actual current JS/WASM/data and Rust boundary hashes. Source is official DCSS 0.34.1 commit 1eebc1a2892e1c89776a0d7a10691f8dac8d9796.

See audit.json for exact absolute paths, hashes, counts, screenshots and concrete gaps; see controlled-flows-review.json for the separate final flow audit.

- Gameplay remains the official C++ engine behind Rust/browser adapters; these receipts do not prove complete Rust migration or complete Japanese text integration. Native startup display covers startup.weapon.prompt only, with locale pinned per session.
- Final combat/branch/death/victory flows use genuine native wizard/DLua fixture preparation. They prove the exercised native control/exit paths, not an ordinary complete campaign or exhaustive mechanics coverage.
- Current manifest still records candidate_only:true, release_ready:false and runtime_tests:"pending for final JS/data; this helper never starts the engine". Saved final receipts now provide actual narrower runtime evidence; the manifest status fields alone cannot establish release readiness.
- Native save restoration serializes PCG state/increment words, not diagnostic draw counters. Matching-locale phase comparisons include all counts; do not describe the browser branch-restore fixture as persisting instrumentation counters.
- Final controlled-flow receipts pin the native manifest and original source receipts but do not save historical Worker/core-debug hashes. Current host files match the saved 88-check protocol hashes; that establishes current identity, not a missing per-flow historical host hash.
