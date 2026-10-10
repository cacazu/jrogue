# Japanese MO memory ownership and lifetime

Read-only diagnosis of the current baseline shell and the exact installed Emscripten 6.0.8 runtime. Only this note was written. No shell, package, engine, assets, browser, compiler, server, or packing operation was changed or launched. The `m10-performance` skill was applied to separate source allocation estimates from measured browser memory.

The finalized Japanese MO is **20,214,890 bytes (19.2784 MiB)**, SHA256 `336dc66ccd4d1e828832a38756cddcc165e0f1af917f546752b5655ff02705e7`. There is a safe, small copy reduction available with `canOwn: true`. It does not remove the native translation mapping or explain the multi-GiB allocation jump during game creation.

## Current copy chain

Current shell reference: `shell/baseline-shell.js:110–132`, `prepareJapaneseCatalog`; its caller waits at 151 before returning control to original C++ after the initial IDBFS restore.

| Storage | Exact source behavior | Lifetime / payload |
| --- | --- | --- |
| Shared compressed asset archive | Actual data loader line 937 assigns its download view into `compressedData.data`, and line 939 calls `LZ4.loadPackage(..., false)`. Each asset node references this same object. | **116,219,695 bytes** retained for the whole runtime asset package, including a shared 4,096-byte decompression cache. This is not a separate 20 MiB decompressed MO. |
| First `FS.readFile` result A | `libfs.js:1422–1437` allocates `new Uint8Array(stat.size)` and fills it through the file's stream reader. `liblz4.js:133–178` decompresses bounded chunks into that supplied buffer. | **20,214,890 bytes**, independent of both the archive and WASM memory. The shell's `const bytes` remains used through its final diagnostics statement. |
| First SHA256 input snapshot | The shell calls `crypto.subtle.digest` at 115–117. The WebCrypto algorithm takes a snapshot of the supplied bytes before asynchronous digest work. | A logical **20,214,890-byte** input snapshot; the exact Chrome allocation strategy and reclamation timing were not measured. The resulting SHA256 ArrayBuffer is only 32 bytes. |
| MEMFS file contents B | At shell 121–122 the LZ4 file is unlinked and rewritten. `libfs.js:1442–1447` passes undefined `opts.canOwn` into MEMFS. A fresh first write in `libmemfs.js:289–291` uses `buffer.slice`, making a distinct copy. | **20,214,890 bytes** retained by the MEMFS node for subsequent original-engine file opens and translation loads. |
| Second `FS.readFile` result C | Shell 126 reads the newly materialized path again. This follows the same `libfs.js` allocation, now filled from MEMFS. | Another **20,214,890 bytes**, temporary verification input. |
| Second SHA256 input snapshot | Shell 126 hashes C using the same digest helper. | Another logical **20,214,890-byte** snapshot while that digest runs. |
| Original native mapping D | Original `mmap_file.cpp:221–222` requests **MAP_SHARED**, read-only. `libmemfs.js:315–346` cannot directly map an independent JS ArrayBuffer, so it allocates WASM memory and copies the file with `HEAP8.set`. | Payload N, allocation rounded to **20,250,624 bytes (309 × 65,536)** in the actual generated runtime's `mmapAlloc`, `cataclysm-tiles.js:1013–1017`; alignment/allocator metadata is additional. |

The digest snapshot requirement is specified by [W3C WebCrypto, digest method](https://www.w3.org/TR/webcrypto/#SubtleCrypto-method-digest). That contract supports a conservative source budget; it does not establish a measured Chrome resident-memory copy count.

Before C++ resumes, post-write verification can overlap A + B + C and a second digest snapshot: **4N = 80,859,560 bytes (77.1137 MiB)** of logical MO buffers. Earlier completed digest storage and dead objects may await reclamation, and cryptographic/allocator overhead is unspecified. Thus this is a source-derived overlap estimate, not an exact peak/RSS bound. Native D is subsequently created when C++ loads the catalog; it is not part of that pre-resume four-buffer sequence. After preparation returns and temporary JS buffers are collected, B plus D remain: **40,465,514 bytes** of file/mapping storage before translation index overhead, the archive, and allocator costs.

## Safe first reduction: transfer the read buffer to MEMFS

For the shell owner to review, the minimal change is:

```js
FS.writeFile(JAPANESE_MO, bytes, { canOwn: true });
```

`libmemfs.js:252–288` documents ownership transfer and assigns `node.contents = buffer.subarray(...)`; this shares A's backing ArrayBuffer rather than creating B's slice. `FS_fileDataToTypedArray` in the generated runtime at 1344–1352 preserves this existing Uint8Array. The actual emitted MEMFS writer at 1243–1267 confirms the same branch.

This is safe here because `FS.readFile` has created a whole-file, standalone, non-HEAP Uint8Array; the newly recreated file is empty and written at position zero; the finalized MO is immutable; and the caller need not mutate, clear, detach, transfer, or repurpose that byte range after handing it to FS. Reading its byte length for diagnostics is harmless. Do not replace this buffer with a subarray of the compressed package: that would retain the whole package backing store and would not contain decompressed MO bytes.

With the existing independent second read/hash preserved, this avoids **one N-byte allocation and one N-byte transient overlap**: the conceptual verification overlap becomes 3N rather than 4N. It does **not** reduce the final retained MEMFS N or native mapping D. Normal WASM memory growth is compatible because A is a standalone JS ArrayBuffer. In contrast, the installed `libmemfs.js:269–276` forcibly disables ownership of a HEAP-backed view under `ALLOW_MEMORY_GROWTH`, since growth can invalidate those views.

An additional, separately reviewed option is to hash a validated MEMFS file-content view for the post-write verification rather than allocate C with another `FS.readFile`. Require the actual file node's typed contents, used size, view boundaries, file stat, and mmap-capable MEMFS identity to match the pinned complete artifact; retain the same SHA256 check over all N bytes. A zero-copy subarray is sufficient. This would remove another N-byte temporary allocation while retaining the digest snapshot and complete byte verification. It depends on the pinned MEMFS implementation and needs explicit component/browser evidence. Keep the public FS read fallback for an unknown node implementation. This note has not implemented or tested that optional path.

## Native lifetime and release boundaries

`TranslationDocument` stores a shared pointer to its `mmap_file` (`translation_document.h:35–47`). Its constructor maps the complete file (`translation_document.cpp:63–83`), records raw `data`, and keeps original/translated string offsets. `GetString` at 49–52 returns a pointer directly into the mapped bytes; original and translated accessors at 197–216 do the same. Those bytes must remain valid throughout all lookups.

The translation manager retains document objects in `translation_manager_impl.h:16–18`. `LoadDocuments` resets and rebuilds them (`translation_manager_impl.cpp:130–159`); `Reset` destroys existing documents at 85–90. Language changes either reset or load the new language at 109–122. Native `local_translation_cache<const char *>`, `translation_cache.h:73–94`, can retain pointers into the active mapping and uses language generation to refresh them. The shell has no authority to free D after startup, a menu screenshot, or a hash check.

Original readonly `mmap_file` closes its file descriptor after successfully mapping (`mmap_file.cpp:328–332`), while retaining the map through its shared implementation. Its final implementation destructor calls `munmap` (`mmap_file.cpp:233–246`). Installed `system/lib/libc/emscripten_mmap.c:52–89` removes the mapping and releases allocated WASM memory with `emscripten_builtin_free`; its mapping descriptor is tracked at 105–150. The emitted `__munmap_js` at `cataclysm-tiles.js:5631–5644` converts expected filesystem errors to errno, allowing the C release path to proceed. This establishes allocator reuse after document destruction, not shrinking the browser's WASM linear-memory buffer or immediate reduction of process private memory.

Retain B at the original `/lang/mo/ja/LC_MESSAGES/cataclysm-dda.mo` path. Unlinking it after the initial native load could leave D readable temporarily, but later original language changes/catalog reloads still need a readable mmap-capable file. Replacing B with the original LZ4 node reintroduces the missing mmap support. Mutating/truncating B, forcibly releasing D, or dropping catalog entries is not a safe reduction. A native zero-copy filesystem mapping would require a separate adapter with explicit ownership, growth, mmap/munmap, reopen, and lifetime tests; `canOwn: true` alone does not create it.

The shared compressed archive cannot be freed when the MO is materialized. `liblz4.js:33–42` installs all 7,938 files with shared `compressedData` references, and `read` later uses its offsets/data. Removing one node leaves the archive needed by all other gameplay assets. Its two cached decompressed chunks are **2 × 2,048 = 4,096 bytes**, views into the archive's reserved cache area (`liblz4.js:26–31`; `third_party/mini-lz4.js:276,320–323`). Clearing archive/data/cache objects would break original asset access.

## Native indexing and graphics are separate allocations

The native catalog parser does not copy every full string into a second document-sized text buffer. It stores offsets: `translation_document.cpp:119–156` reserves original offsets and a vector of per-string translated-offset vectors. On wasm32, the original-offset payload is approximately **105,004 × 4 = 420,016 bytes**, plus the outer translated-vector storage, per-entry allocations/plural offsets, capacity and allocator overhead. `translation_manager_impl.cpp:148–158` separately builds an unordered hash index. Its measured allocation size has not been captured. These retained index objects are beyond the N-byte file-copy table.

There is no universal browser image/font preload in this package: the actual data loader calls `LZ4.loadPackage(..., false)`. Its optional plugin decoding path at `liblz4.js:49–64` is therefore bypassed. Original native font loading uses `TTF_OpenFontIndex` (`sdl_font.cpp:298–302`), and tile loading uses the native atlas and texture path (`cata_tiles.cpp:466–530,597–624`), including several color-filter variants. Their retained texture/font memory needs its own measured attribution. No fonts, tilesets, text, mods, or content should be removed to make the MO buffer accounting appear smaller.

## What the existing browser evidence actually measured

Read archived attempt `browser-qa/output/2026-10-02T19-30-37-264Z`, not a new live session. Its `REPORT.md`, `evidence.json`, and `memory-guard.json` record:

- At **19:31:26.564 UTC**, before full native data creation: WASM linear memory **536,870,912 bytes**, CDP used JS heap **10,548,896 bytes**, total JS heap **20,754,432 bytes**, and backing storage **182,784,871 bytes**. These metrics cover the page/runtime, not identified MO objects. JS heap/backing storage/WASM and OS private bytes are different measures and must not be summed as equivalent resident allocations.
- Last sample before the allocation step, **19:32:35.257 UTC**: owned Chrome private **1,238,962,176 bytes**, physical available **5,492,322,304**, commit available **6,442,418,176**.
- At the stop, **19:32:54.2055332 UTC**: owned Chrome private **3,578,896,384 bytes**, physical available **2,078,232,576**, commit available **2,574,352,384**. The physical floor of 2 GiB triggered; the 5 GiB owned-private cap did not. The owned-tree difference is **2,339,934,208 bytes**, much larger than a single MO buffer. There was no allocation-step page heap sample because creation held the execution thread.

Those observations do not attribute the multi-GiB creation growth to translations, graphics, world data, compilation, or a particular allocator. Removing one 19.2784 MiB transient MO copy is justified by exact source ownership, but is not evidence that the resource-blocked gameplay flow will fit. Preserve the existing guard and incomplete status. If a future parent-authorized run is made, compare pre/post-materialization JS backing storage, pre/post-native catalog linear memory, and the same full creation step while retaining every asset, translation, and verification check.
