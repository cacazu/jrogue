# Help transport cdda-help-observation/1

Four C exports pin/data/size/release provide up to four immutable owned UTF-8 JSON
records. Engine-thread-only; handle 0 means unavailable/full/reentrant/exhausted.
Handles are monotonically increasing u32 values and never reused. Pointer/size
are read-only and exact until release. Invalid/released handles return null/zero;
unknown release is a no-op. No async borrowed pointers, commands or engine state
cross this transport. Bounds: 262144 JSON bytes, 16384 field bytes, 128 bindings,
64 signed i32 codes, three ordered modifiers, six blocks, nine grid cells and two
nullable alternatives. Source/build/schema and seven text-role IDs are exact.

Schema matches help-semantic-slice/ABI.md and its existing Rust parser. Binding
type serializes as native.event_type, default_context origin as default. Five
named key observations remain distinct from scalar TextEvent parameters. Names,
edit strings and externally supplied literal text preserve UTF-8/control bytes
with JSON escaping. Invalid UTF-8 or shape invalidates latest, without truncation.

Deferred kind-3 notice: {publicationLow,publicationHigh,availability}, unsigned
u32 words. 1 means pin bytes available (including an unavailable wire envelope),
2 means transport/current unavailable, 3 with zero publication means terminal.
Initial attach can issue publication 0 / availability 2. An unavailable wire
record omits title/topic/source/file/blocks. Serialization failure keeps the last
valid publication word, clears latest and sends availability 2. Allocation-free
producer failure also clears latest through the failure sink. Source sequence
regression or exhaustion is terminal until module reload; older pins still live.

Host compares publication via BigInt, ignores old valid notices, permits copying
newer latest bytes for an older deferred notice, and clears current on pin/copy,
identity/parser failure. It uses the current heap view after exports, subtraction
bounds and release in finally. Synchronous callback or result-getter reentry is
rejected and also rejects outer acceptance. The real synchronous Rust parser is
required; pure JavaScript fixture callbacks are not a semantic consumer.

No exports are present in the current reference engine; this ABI has compiled source evidence but remains unlinked and unconnected.
