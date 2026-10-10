The gate executes NetHack 5.0.0's original data consumers against the actual packaged archive, using the same target flags and generated headers as the Phase4 engine. Its default mode only prepares source, hashes, headers, and byte offsets. The parent owns the sole compiler and Node slot.

From the `nethack` staging directory, after the parent confirms a fresh resource gate and drained browser/compiler jobs:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 tools/semantic-text/data-consumer-qa/prepare.py --run --run-name phase4
```

The parent wraps this command with `tools/run-monitored.py`. The script itself enforces one Emscripten/Binaryen worker and disables Windows expanded batch commands. Exit 0 means every consumer assertion passed; exit 2 means the process completed and found data parity failures. Compilation or execution failure retains its command and output log. Use a fresh run name for another execution; existing execution evidence is never overwritten.

The source gate is precise:

- Original `src/dlb.c` is compiled in full. Its `lib_dlb_fgets` CR normalization is controlled by the actual target preprocessor, whose complete macro output and preprocessed function are retained.
- Original `init_oracles`, `outoracle`, `init_rumors`, `get_rnd_line`, and `unpadline` are extracted byte-for-byte from the pinned pristine `src/rumors.c`. Their original source coordinates and SHA-256 hashes are recorded. Original `hacklib.c`, `alloc.c`, and utility `panic.c` are compiled in full.
- Only the actual `/nhdat` is embedded. Each open must resolve through the archive, never external `fgets`. Its complete bytes are copied unchanged to the isolated build directory. All 148 packaged members and the six generated text files retain their actual hashes.
- Original oracle header count, all 21 paragraph offsets, and the additional EOF offset are parsed by the original consumer. Each indexed paragraph is selected once, including the special first paragraph. The original `COLNO - 1` read limit, original window emissions, original state decrement, and original random-selection call are observed.
- Original rumor headers and physical true/false boundaries are retained. Every one of the 1,602 stored random records is selected through original `get_rnd_line`: 787 rumors, 374 bogus monster lines, 46 engravings, and 395 epitaphs, including generator defaults. Its exact selected byte position, original RNG-call count, decrypted content, and original underscore unpadding are verified.

The fixture substitutes only isolated game-global fields, window output sinks, a counting deterministic selection callback, and terminal assertion/open failures. No live game, presentation, save, world state, or gameplay RNG is linked. Expected byte-format decoding is an independent calculation; actual plaintext is emitted by original compiled `xcrypt`. Expected LF output calculations never write or replace data bytes. This gate proves the specified consumers and target macros, not the full gameplay campaign or encyclopedia reader.

The existing native Windows `makedefs` files contain CRLF, and their physical offsets are valid for those bytes. Replacing CRLF bytes would invalidate those offsets. Correct generation must use original `makedefs` compiled for the actual WASM target, fed untouched original input bytes, to recompute the complete output, padding, counts, offsets, and EOF markers. The isolated Phase6 implementation is in `../phase6-integration/build.py` and `../phase6-integration/target-data.cjs`; it invokes original `-drhs123v` and exports the resulting binary MEMFS files. It leaves pristine upstream and frozen Phase4 unchanged.

After the parent generates and packages the Phase6 assets, rerun this same original consumer gate with the new archive:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 tools/semantic-text/data-consumer-qa/run-phase6.py --run --run-name phase6
```

`run-phase6.py` binds actual Phase6 working headers and target flags. It requires the executed original generator manifest, all seven original generator C hashes, all seven untouched official data input hashes, pre-generation header hashes, compiled utility JS/WASM hashes, exact output hashes, LF bytes for all six generated assets, and byte equality between those outputs and actual packaged members. It also certifies all physical encyclopedia index/count/EOF records while leaving encyclopedia reader runtime parity explicitly unproved.

Before accepting generation, verify every actual consumer assertion and the engine's embedded archive hash. Any text producer metadata using old file offsets must be regenerated and bound to the new asset hashes.

The root-serialized Phase4 execution completed 4,859 assertions with 1,647 failures. Read-only `analyze-phase4.py` reconciles every failure: 21 oracle delimiter failures, 1,602 retained-CR/unpadding failures, and 24 sampled selection positions changing the original one-call padlength test to ten calls. Headers, physical offsets, selection ranges, oracle state changes, and source bindings pass. The actual target macros are UNIX/DLBLIB/CROSS_TO_WASM true and WIN32/MSDOS/_WIN32 false; original reader CR normalization is absent. Original oracle 0 emits 120 lines instead of 12. Frozen execution evidence remains under `build/data-consumer-qa/phase4`; the diagnosis is `build/data-consumer-qa/phase4-analysis.json`.
