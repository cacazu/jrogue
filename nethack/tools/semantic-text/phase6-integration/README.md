# Isolated Phase6 source/build handoff

Added 2026-10-02. NGPL notices and original NetHack headers are retained. The
official commit is `16ff59115315917b93185d026aeefea06db9b0f4` (NetHack 5.0.0).
Current runtime, canonical Rust and the failed Phase4 candidate are read-only.

`prepare.py` composes the preserved Phase4/5 source with reviewed owning helper
values, public monster/object compositions and native panic/config/chronicle/
dump/exit owner hooks. Every appearance label emitted by the new source uses a
public phrase alias; its stem and hash depend only on the already selected
visible description. All 326 slots share 257 phrase aliases. Missing/conflicting
Japanese remains English fallback; bare property translations cannot replace a
legacy full-name recipe without the original public class connector/noun.

`--phase7-buffers` is optional. It adds seven reviewed technical/scalar buffer
branches and six consumers with explicit local tickets. Original operation
offsets are mapped only through unique preserved byte contexts. Stale,
overlapping or ambiguous operations fail. It does not cover the 900 remaining
dynamic-origin contracts. Resource observers and restored semantic chronicle
provenance are not included.

Source-only preparation and checks, from the shared workspace:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' nethack/tools/semantic-text/phase6-integration/prepare.py --freeze-inputs --prepare --phase7
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' nethack/tools/semantic-text/phase6-integration/check.py
```

The explicit freeze records reviewed source hashes; a later mutation is rejected
before any compiler. Parent-owned final Rust formatting/checks may require a
lock refresh and the Python source check, without another C prepare. The
generated manifest and catalog live in `work/phase6/semantic-generated`.

After the parent releases the single heavy-job slot and has at least 2 GiB of
physical and commit headroom, the exact staged build is:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' nethack/tools/semantic-text/phase6-integration/build.py --build --sdk 'C:\Users\kit\emsdk' --rust-lib nethack/build/phase6-rust/target/wasm32-unknown-emscripten/release/libnethack_layers.a --web-source nethack/tools/semantic-text/phase6-immutable-catalog/host-overlay --registered-catalog --phase7-buffers
```

This forces one outer/compiler job, task-local `EMCC_CORES=1`,
`BINARYEN_CORES=1`, `EMCC_BATCH_BUILD=0` on Windows and Rust codegen-units 1.
It has 177 C/Lua engine units with the optional buffer bridge. Native utilities
and seven-source target makedefs compile sequentially. A cold isolated SDK cache
can additionally compile 1,075 libc and 184 compiler-builtins inputs. Peak
memory has not been measured by this source preparation.

The target data generator is the unchanged original makedefs compiled for the
actual WASM target. It processes original inputs with documented `-drhs123v`,
recomputes counts/offsets, and exports raw MEMFS bytes. It never replaces CR
bytes in an existing offset-bearing file. Its manifest binds all seven utility
C sources, seven original data inputs, pre-generation headers, JS/WASM utility,
actual target flags and eight generated files including date.h/options.

The original Phase4 archive is confirmed defective under the actual UNIX/WASM
consumer: all 21 oracle delimiter checks fail, plus 1,602 plaintext/unpadding
and 24 sampled retry differences. Fresh LF bytes alone do not establish data
parity. After the staged build, the parent must repeat the exact original
consumer gate from the `nethack` directory:

```powershell
& 'C:\Users\kit\emsdk\python\3.13.3_64bit\python.exe' -X utf8 tools/semantic-text/data-consumer-qa/run-phase6.py --run --run-name phase6
```

Artifacts are isolated in `build/phase6`; local browser root is
`build/phase6/web`, whose `gameplay-core.json` is copied from the exact selected
merged catalog. No hosting/publishing/Git action occurs. Final manifests bind
actual compiled source/header/Rust/frontend hashes, changed upstream and added
source paths, original adapter patch, Lua and target data. Packaging maps
`work/phase6/NetHack-5.0.0` to `engine-source`.

Source checks establish source contracts only. Compiler/linker checks, new data
consumer parity, real browser input/save/load/name/helper/buffer/error paths and
locale/repaint gameplay/RNG invariance remain acceptance gates. The catalog has
9,618 English and 5,687 Japanese entries with this proposal; these totals are
not a complete-translation claim or the 5,984 static/963 dynamic C denominator.

The isolated QUESTION getter accepts the original `shim_yn_function` callback
only at sentinel window `-1`; other negative values are not aliases. The
separate approved `getlin` callback keeps its exact source-owned contract.
Alternate native `yn_menu` question output remains complete original English
until a producer records its actual native menu window. No getter guesses a
window or accepts `shim_end_menu` for an unbound QUESTION. Original yn logic,
filters, response bytes and emitted rows are unchanged.

The second real compile failure exposed an integration spelling mismatch:
`P_NAME` had been mapped to an invented uppercase owning name, while the
reviewed weapon-local macro is `nh_phase6_p_name_value`. The explicit mapping
now uses that exact frozen spelling. No function wrapper, global alias or
prototype is added. Declaration guards cover all 333 owning consumers: every
macro stays adjacent to its original declaration, weapon-local ownership is
checked before each use, and all other producers retain their original
`hack.h` owner. Original P_NAME branch-specific argument/index evaluations and
its selected `martial_bonus()` call remain unchanged.
