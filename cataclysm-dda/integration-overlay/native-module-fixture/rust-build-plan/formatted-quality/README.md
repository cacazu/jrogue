# Formatted native-byte consumer verification

The isolated `cdda-snapshot-native-fixture-consumer` package passed package-only formatting validation, the same four Rust consumer tests, and package-only Clippy with warnings denied. These are quality checks of the existing four tests; the retest adds zero distinct consumer tests.

The tests load nine exact JSON byte records previously emitted by the actual compiled snapshot module with explicitly synthetic callback contexts. They check the frozen Rust consumer's bounds, immutable records and restoration, rejection rules, CJK/control text and raw usernames. Native input handlers, action-context lookup, gameplay ownership and live engine integration remain unverified. Command ownership remains `Denied(UntrackedNativeReaders)`.

| Stage | Seconds | Peak owned private bytes | Maximum sampled working set bytes |
| --- | ---: | ---: | ---: |
| Package formatting check | 0.557 | 8,724,480 | 19,341,312 |
| Same four native-byte consumer tests | 18.372 | 297,467,904 | 250,445,824 |
| Package Clippy, warnings denied | 5.369 | 293,052,416 | 274,268,160 |

The [compact proof](formatted-quality-verification.json) pins the terminal, logs, metrics, cleanup, nine native records, the newly executed test binary and four accepted formatted source/config copies. It preserves exact observed FILETIME digits as strings. All 577 protected inputs stayed unchanged; each of the three jobs has empty remaining PID, job-handle and error arrays, and its exact returned root process handle was closed.

The supported owned rustfmt configuration contains edition 2024 and Unix newlines. The separately preserved preview config and its stable-tool warning remain historical evidence. Root reviewed the preview's exact diff and authorized only the current `lib.rs` copy from `e286ee35…` to `0b7004be…`. The initial unformatted test binary, 32 accepted copies and initial proofs were retained. This window used only the new `formatted-quality/target`.

The source preparation is pinned by [quality-plan.json](quality-plan.json), [run-quality-window.py](run-quality-window.py), [default source validation](runner-source-validation.json) and [ten pure guard checks](runner-source-tests.json). Eight pure checks reuse the preserved report protocol; two reject reusing the initial target and changing package formatting to workspace scope. These source checks do not count as new gameplay or runtime consumer tests.

A mistyped launcher hash was rejected before creating an attempt directory or loading the guard. [That rejection](launcher-token-rejection.json) is retained. Root separately authorized the corrected token read directly from accepted validation; exactly one actual three-stage window ran. It used offline locked dependencies, one worker/thread, fresh 4/6 GiB launch checks, browser priority at 7/9 GiB, 1 GiB owned private/working-set limits, 2 GiB running floors and 180 seconds per stage. No retry or further execution is authorized by this evidence.
