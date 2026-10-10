# Separate authoritative-engine integration plan

This prepares the actual original C++ engine with three bounded observers. It
does not replace gameplay, claim input command ownership, or claim full Rust
rendering or semantic migration. Nothing is compiled, linked or browser-run here.
The accepted Node runtime, pristine source and parent-owned v5 artwork remain
unchanged. External publication is excluded by the current instruction.

`prepare.mjs` verifies the accepted original build and source preparations, then
copies a fresh coherent sibling tree inside this folder. It applies the reviewed
semantic source first and inserts only the exact original read-only input hook
into that generated `input_context.cpp`; removing that hook and include restores
the semantic source byte-for-byte. It also copies the existing raw presentation
observer hook and four real helper translation units. The resulting 973 source
members contain all 964 original `src` members. Original quoted headers resolve
inside this tree; a lone include-path override cannot make class layouts coherent.

All 438 actual original MMD records are read. Changed `help.h`, `input.h` and
`input_context.h` require 231 existing original C++ units to be rebuilt.
`sdltiles.cpp` already belongs to that set. Four new helpers give 235 separate
compile commands and 442 full-engine objects. The 207 remaining original objects
are reusable only while their successful original commands, exact object/log
bytes, all source dependencies and frozen compiler/SDK remain unchanged. The
plan does not reuse the earlier fixture helper objects or link synthetic leaves.

Compilation keeps the original `-Os` flags; the selected proven full link keeps
`-O1`, conservative Asyncify, exceptions, SDL, IDBFS, localization and one worker.
The explicit export list retains `_main` and adds the twelve observer exports.
The three deferred callbacks have distinct names and kinds. Native rendering and
input continue to operate when observations are unavailable.

`FULL-INTEGRATION-PLAN.json` contains the source/evidence pins, full rebuild and
reuse closure, exact ordered arguments, 442-entry response, licenses and next
operations. `SOURCE-STAGING.json` pins every actual staged member.
`combined-source.patch` records all seven changed original files and nine added
files. `validate.mjs` independently rechecks current actual bytes, the MMD split,
reuse safety, merge reversal, compiler argument paths, exports and link order.

The next operation is a reviewed single-command owner adapter using the current
CPP2 same-buffer loader and reviewed `load_guard`/`run_owned` cleanup primitive.
Root releases one compile at a time, after accepted browser priority and fresh
4 GiB physical / 6 GiB exact-commit measurements. Existing 1 GiB job private and
working-set caps, 2 GiB running floors and 180-second deadline stay unchanged.
The old input hook/helper fit those bounds at 368,955,392 / 83,496,960 private
bytes; those measurements do not prove every newly affected original unit fits.

A full link is a separate bounded operation. The actual original link took
229.930 seconds and sampled 3,559,145,472 private / 3,592,372,224 working-set
bytes. The compile-only 1 GiB / 180-second owner cannot run it. This plan proposes
a separately reviewed 4 GiB cap, 2 GiB floor, fresh 6/6 GiB launch gate and finite
600-second deadline. That proposal is not an execution authorization or a claim
that the combined engine will fit. No adapter or full-engine job starts here.

After all real compilation and the separate full link pass, validate the actual
WASM, generated JS, exports and preserved licensing, then stage a separate local
runtime. Real synchronous Rust WASM consumers and observer host callbacks still
need to be connected. Movement-help selection, original binding descriptions
and nested editing have to execute in the actual game. Existing fixtures prove
only their declared bounded scopes. Direct readers still prohibit helper command
authorization; raw text frames omit tiles, minimap, retained canvas and ImGui.
World generation, gameplay, rendering/state/RNG neutrality, save/resume and
desktop/mobile browser flows remain acceptance requirements.

Preparation and validation commands perform no compiler or runtime launch:

```powershell
node --check full-engine-overlay-plan/prepare.mjs
node full-engine-overlay-plan/prepare.mjs
node full-engine-overlay-plan/validate.mjs
```

Preparation refuses an existing candidate/output rather than replacing it.
Retain the exact source commit and CC BY-SA 3.0 notices. A future local runtime
must retain the existing audited upstream/font/library notices and make these
source changes and exact recipes available with its original-source attribution.
