# Original Pascal/Lua browser host

`port/web/core-host.mjs` is an ABI transport around the original core. It does
not implement game rules, file/path/descriptor ownership, or a JavaScript
filesystem. `port/src/platform/vfs.rs` owns the isolated virtual filesystem in a
separate Rust WebAssembly instance. The core remains Pascal and Lua.

The host routes each file operation through the existing initialized Rust JSON
request buffer:

```json
{"kind":"file_system","operation":{"op":"stat_path","dir_fd":3,"path":"user/save.sav"}}
```

Responses are `{ "filesystem": { "errno": 0, "value": ... } }`. Nonzero WASI
errno values propagate. There are no Windows paths, host-directory mounts,
permission prompts, or network/socket capabilities in this filesystem.

## WASI preview1

The ABI layouts follow the acquired, pinned official FPC runtime declarations
in `toolchain/fpc-src/rtl/wasicommon/wasiinc/wasitypes.inc` and `wasiprocs.inc`.
The memory boundary refreshes views after growth, validates entire iovec arrays
and output buffers before performing writes, and bounds path, argument,
environment, random, directory, and transfer sizes. Every file read/write is
split into at most 64 KiB Rust requests. 64-bit offsets, cookies, timestamps,
and rights use `BigInt`, including positions beyond JavaScript's exact-number
range. This does not weaken Rust's file or aggregate quotas.

Implemented operations:

- Arguments/environment sizes and UTF-8 NUL-terminated contents.
- Realtime and monotonic clock time/resolution; browser cryptographic random
  bytes, separated from the original gameplay RNG.
- A single descriptor 3 preopen named `/`. The pinned FPC runtime resolves
  original `/data/` and `/user/` paths to paths relative to that descriptor.
  Rust rejects absolute operation paths, traversal beyond the descriptor, and
  invalid paths. The preopen identifies a virtual root, not a Windows root.
- Open/close, stat/fdstat, append flags, byte reads/writes, BigInt seek/tell,
  resize, UTF-8 readdir with preview1 cookies and partial dirents, mkdir, unlink,
  rmdir and rename, all delegated to Rust.
- Byte-preserving stdout/stderr. Stdin is a configured EOF device because the
  original game receives keyboard/text/pointer events through `drl_host`.
- `poll_oneoff` for clock deadlines and immediately available regular-file
  readiness, using suspension for future deadlines. CPU clocks are unsupported.
- Nonbinding `fd_advise`, scheduling yield, and explicit `proc_exit` exceptions.

Explicit `NOTSUP`, recorded in `host.unsupportedImports()`:

`fd_allocate`, `fd_datasync`, `fd_fdstat_set_rights`, `fd_filestat_set_times`,
`fd_pread`, `fd_pwrite`, `fd_renumber`, `fd_sync`, `path_filestat_set_times`,
`path_link`, `path_readlink`, `path_symlink`, `proc_raise`, `sock_accept`,
`sock_recv`, `sock_send`, `sock_shutdown`.

The host does not pretend timestamp changes, durable fsync, links, sockets, or
positional I/O succeeded. Unknown import namespaces, names and nonfunction
imports reject before execution. Unsupported operations appearing in linked
FPC RTL are permitted to instantiate but return `NOTSUP` if actually called.
Virtual stat timestamps/device/inode are zero; link count is one. Rights are
reported for the implemented operations, while open accepts FPC's broader
requested regular-file rights and enforces Rust's read-only assets and
writable/append descriptor policy. The trusted acquired game is the caller;
this is not a general-purpose hostile-module WASI runtime.

## Original-core host packets

The imports match `core-overlay/fpcvalkyrie/src/vbrowserhost.pas`:

- `poll_event(ptr,128,peek)` copies a version 1 event packet produced by the
  injected Rust input adapter; `event_pending()` observes that adapter.
  Pointer event coordinates retain the original console's one-based convention;
  frame/draw coordinates are zero-based. The Rust input adapter performs the
  DOM-cell conversion, and the host copies the typed packet unchanged.
- `sleep(ms)` suspends the original call stack; `now_ms()` is a monotonic
  display/platform clock. Sleeps above 60 seconds reject.
- `frame(ptr,24032)` copies the 80 × 25 DRLF frame with its 32-byte header and
  12-byte original CP437 cells. `draw_command(header,64,text,len)` copies typed
  drawing commands in their emitted order. Rust owns projection and CJK layout.
- `text_columns(ptr,len)` and `text_fit(ptr,len,columns)` copy UTF-8 into
  Rust's initialized ABI buffer and invoke its CJK width/prefix exports directly.
  No JavaScript width tables or substring clipping are used.
- `text_input(enabled)` and `title(ptr,len)` forward explicit platform/display
  callbacks. Optional rumble reports unsupported hardware with a false result.
- `resolve_text(req,len,out,capacity)` routes typed `native_text` semantic
  requests to the Rust catalog. Capacity zero returns the required byte length;
  a second call copies at most 32768 UTF-8 bytes. A too-small output returns -1
  without partial output. Missing IDs/parameters fail; no English fallback or
  global string substitution occurs. `setLanguage('ja'|'en')` selects only
  presentation locale, Japanese by default. External names pass as parameters.

The bridge callbacks are explicit requirements. Missing input/frame/title
callbacks throw rather than silently dropping required behavior.

## Synchronous original control flow in an asynchronous browser

The standard JSPI API wraps ordinary imports with
`new WebAssembly.Suspending(callback)` and the ordinary `_start` export with
`WebAssembly.promising(instance.exports._start)`. This keeps the original
Pascal/Lua call stack and modal continuations while the browser handles events.
The generated FPC `_start_promising` export uses an older suspender-argument
proposal and is deliberately not called. [V8's current JSPI documentation](https://v8.dev/blog/jspi)
describes the import/export wrapper and the browser event-loop requirement.

The host feature-detects both standard APIs. A browser lacking them fails with
an explicit compatibility error before a suspending core starts. No identity
polyfill, blocking main-thread wait, SharedArrayBuffer, cross-origin isolation,
browser security setting, or experimental flag is introduced. No Asyncify
fallback is claimed without a separately transformed and tested artifact.

## Native-file storage

`createCoreStorage()` captures writable Rust files only at a paused original
core seam, after the game has produced its native save file. It preserves those
bytes; the storage snapshot does not serialize replacement game state or claim
native save compatibility independently of the original loader.

IndexedDB stores a version 1 `drl-original-core-files` snapshot with a pinned
caller-supplied source/core identity, bounded paths/entries/bytes and a SHA256
digest per entry. Save resolves only after the transaction commits. Restore
validates identity, layout, quotas and checksums before creating a fresh Rust
platform, mounts verified immutable assets, replays the mutable files in 64 KiB
chunks and returns the candidate only when every operation succeeds. The
caller selects this candidate before starting a fresh Pascal instance.
`readSnapshot()` returns null when no committed snapshot exists; `restore()`
reports a typed `no_save` error for that normal first-run condition. Failed
restores leave the current platform untouched. Immutable assets and native
descriptor cursors are not copied into the snapshot.

## Verification

Commands from the task root:

```powershell
node --test --test-name-pattern='mock' port/tests/core-host.test.mjs
node --test port/tests/core-host.test.mjs
$env:DRL_HOST_BROWSER='1'
node --test port/tests/core-host.test.mjs
```

The nine injected-mock ABI/storage contract tests passed on 2026-10-02 UTC.
They verify memory guards, 64-bit preservation, semantic locale/parameters,
transaction completion, checksum rejection, source identity and fresh-candidate
failure behavior and precreated writable-directory collisions, absent saves and CJK-helper delegation. These are transport tests, not original gameplay tests.

The real Rust/Chrome suite is authored and awaiting the shared Windows heavy-job
hold and the updated Rust WebAssembly build. It will exercise the actual Rust
VFS and the official-source FPC `hello-exnref.wasm`, `suspend.wasm`, and `filesystem.wasm` probes,
including native absolute-path file operations and directory enumeration,
plus preserved Pascal stack/heap/streams across suspension and exception
recovery after resume. It also loads the separate authored mixed
`experiments/lua-wasi/mixed-build/mixed-probe-jspi.wasm` probe to verify the
critical Lua → Pascal → host sleep continuation and protected callback error
recovery through this production Rust VFS host. Its evidence is written to
`port/tests/output/core-host-browser.json`; no pass is claimed until executed.
The host alone is not a playable DRL build or a published Site.
