# Current formatted Catalog consumer evidence

The exact root-reviewed Rustfmt bytes in the two owned Rust files passed package-only `cargo fmt --check`, the same seven actual Catalog tests, and `cargo clippy --lib --tests -- -D warnings` in the single reserved `formatted-tests-1` window. No retries or source edits occurred. These repeat the existing seven tests and add no distinct test names.

| Stage | UTC root start | Duration | Exact owned peak private |
| --- | --- | --- | --- |
| Format check | 2026-10-02 22:14:31.772 | 0.789 s | 9,187,328 B |
| Seven Catalog tests | 2026-10-02 22:14:33.544 | 2.555 s | 177,946,624 B |
| Clippy | 2026-10-02 22:14:37.194 | 5.833 s | 294,772,736 B |

All 708 protected source/cache/evidence fingerprints stayed unchanged. Across the stages, observed free physical memory remained at least 6,219,591,680 bytes and exact commit headroom at least 8,361,021,440 bytes. Each stage ended with no owned PIDs or job handles; every exact returned root process handle was explicitly closed and no cleanup error was recorded. Final cleanup evidence was written at 2026-10-02 22:14:43.024 UTC. No further compiler, formatter or browser launch followed.

`RUST-FORMATTED-VERIFICATION.json` pins the 32 accepted input copies, 15 original raw stage artifacts, current source bytes, exact decimal FILETIMEs, commands, samples and cleanup evidence. The accepted plan is `2e954759294b91d6dd9d7ccedcd8622bd69a9b1c825da6d32fde688d7c53954d`; the reviewed runner is `1fe1a94cb0e740dfa8040335facd3bf1706c16adc04472667dd96de45ebc55ac`. `RUST-VERIFICATION.json` and `FORMAT-PREVIEW-VERIFICATION.json` retain their original bytes as historical acceptance evidence. The old `RUST-VERIFICATION.md` is preserved as a pinned pre-window account.

The three source-bound named-parameter templates and their English/Japanese JSON catalogs remain unchanged. The existing Catalog parser and formatter were exercised with synthetic leaf choices. Original C++ producer registration, definition ownership/overrides, typed FFI, nine retained rich/keybinding/recursive-name exclusions, runtime/browser consumption and full game flows remain unresolved.
