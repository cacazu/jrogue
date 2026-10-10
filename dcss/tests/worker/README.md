# Worker protocol verification

The four `.cjs` files are exact preserved independent stub scripts. They read
the actual DCSS host sources, with mocked C++ engine, Worker and IndexedDB
boundaries. Their original source paths are `dcss/web/...`.

From the DCSS folder, run `node tests/worker-protocol.mjs`. The runner resolves
the containing repository as their working directory. All four scripts passed,
along with JavaScript syntax checks: 27 protocol/cache checks. Hash manifests
pin the reviewed host and test sources.

These tests verify Asyncify suspension ordering, copied immutable observations,
combining sequences, exact cache-directory filtering, native byte transport,
Rust pack/unpack calls, IndexedDB commit completion and failure propagation.
They do not load the real engine or establish native save compatibility,
gameplay completeness, physical-device memory limits, or publication readiness.
