# VTIG UTF-8 browser presentation adapter

This is a presentation overlay for the preserved Pascal/Lua game. It does not
replace gameplay, RNG, hooks, modal continuations, selection, or input dispatch.
The pristine and selected native `vtig.pas` remain unchanged.

The pinned upstream file is `native/fpcvalkyrie/src/vtig.pas`, SHA-256
`509ebaae8da6fc8e4c9afcaa1a449e60ed52ba9437452065089fd85d660e4d4c`.
`experiments/vtig-cjk/prepare.mjs` checks that hash and generates
`core-overlay/fpcvalkyrie/src/vtig.pas`. The overlay selects the new text walker
only under `DRL_WASM`; the original walker is retained in the other branch.
`tools/adapt-core.mjs` copies this overlay into `core-adapted`.
`experiments/vtig-cjk/patch-manifest.json` records the resulting hashes.

## Literal text ABI

The core imports synchronous functions from the `drl_host` module. These functions
must copy the requested bytes out of Pascal memory into Rust's initialized request
buffer before calling Rust. They must not retain pointers, consume RNG, or mutate
game state. The original Pascal VTIG parser resolves native controls first.

| Pascal import | Rust export after copying bytes | Result |
| --- | --- | --- |
| `text_columns(ptr, byte_length) -> i32` | `drl_text_columns(byte_length)` | CJK display columns, or a negative error |
| `text_fit(ptr, byte_length, max_columns) -> i32` | `drl_text_fit(byte_length, max_columns)` | Whole-grapheme UTF-8 prefix byte count, or a negative error |

`text_fit` returns bytes, not character or column counts. The Pascal adapter calls
`text_columns` on that prefix to determine cursor advance. For example, `日本語`
has nine UTF-8 bytes and six columns; fitting it into five columns returns six
bytes (`日本`) and advances four columns. Literal runs sent to these functions
exclude native VTIG controls and newlines. CR is ignored and LF advances one row.
`VTIG_Length` retains its original sum-of-visible-columns contract, with one
column counted per LF; it does not become a maximum-row-width function.

The raw VTIG draw-command wire is owned by the browser bridge. The 64-byte header
contains sixteen little-endian u32 words: version, kind, area x/y/w/h, clip x/y/w/h,
FG, BG, XC, text encoding, and two reserved words. Area and clip positions are
zero-based on this wire. The text pointer/length is separate. UTF-8 literal
commands explicitly set `TextEncoding=0`; `VTIG_RenderChar` explicitly sets
`TextEncoding=1` for original CP437 byte glyphs. Border/frame glyphs also use the
bridge's explicit CP437 encoding. Invalid UTF-8 is an error, not a byte-glyph
fallback. Draw-command rectangles and glyph encoding are never inferred from text.

## Preserved controls and layout behavior

Native color/style tags, `{0}` indexed parameters, `{$name}` callbacks, `|N`
cut-and-pad, `|-N` cut-only, and `|+N` pad-only remain Pascal responsibilities.
Substitution IDs and window IDs are unchanged. Rust receives resolved literal
UTF-8 only. Integer parameter measurement is explicit and matches rendering.
Unspecified widths leave the value intact. The browser measurement adapter also
corrects the upstream zero-width measurement of an unqualified `{0}` tag.

Cuts respect whole grapheme boundaries. An odd three-column cut of `日本語`
therefore retains `日` (two columns); cut-and-pad adds a space to reach three,
while cut-only remains two. The local cut budget passes through nested parameters.
Truncation still scans closing color controls so styles do not leak into following
labels. The global teletype limit affects visible drawing without moving subsequent
layout positions backward, following the original display contract.

ASCII words retain space-based wrapping. Runs containing non-ASCII text wrap at
whole grapheme boundaries. Row advancement resets X to the native clip's left
edge; rendering stops at its bottom. A wide cluster that cannot fit the entire
row terminates that segment safely rather than looping or emitting broken bytes.
Center/right alignment and automatic window sizing use the adapted `VTIG_Length`
through the original VTIG call sites.

The public `VTIG_PrefixColumns(text, columns)` function, with an optional indexed
parameter-array overload, replaces display-only byte `Copy` call sites. It expands
native substitution/width controllers for display, preserves color controls,
counts only their visible text, clips whole graphemes, and closes styles introduced
before a cut. It does not translate external values. `DRL_WASM` selects this path;
the native fallback retains byte `Copy` behavior. The original browser bridge owns
the HUD/inventory call-site patches, not the VTIG overlay generator.

## Verification status

`experiments/vtig-cjk/probe.pas` exercises the actual VTIG unit, using only authored
labels and the browser adapters. Its first official FPC wasm32/WASI compilation
reached upstream `vluasystem.pas` and failed with compiler internal error
`2021091801` at line 386 (the upstream Lua formatted-varargs dependency). The
matching exnref RTL/package units were found; this is not a UTF-8 parsing error.
The Lua bridge team owns that call-site adaptation.

`prepare-harness.mjs` extracts the exact upstream style/width helpers plus the
exact new text adapter into an authored contract probe. Its drawing context and
draw list are mocks, which are explicitly recorded in `harness-manifest.json`.
`build.ps1 -Contract` compiles that smaller probe with the same official compiler
and exnref RTL. `run-node.mjs` connects its imports to the actual Rust WASM exports,
checks twelve measurements, six markup-prefix cases and fourteen rendered row
groups, and checks an unchanged Rust
checkpoint. This does not certify original game execution. Compile/runtime
results are reported only by generated evidence files after execution.

At this checkpoint new compiler/link/browser jobs are held by the parent to keep
shared Windows memory and CPU bounded. JavaScript syntax checks and both source
generators pass. The contract probe has not yet been compiled or executed, and
no successful CJK runtime result is claimed here.

After the hold is released, run:

```powershell
./experiments/vtig-cjk/build.ps1 -Contract
node experiments/vtig-cjk/run-node.mjs
# After the Lua call-site adaptation and original browser bridge are generated:
./experiments/vtig-cjk/build.ps1
node experiments/vtig-cjk/run-node.mjs --actual
```

## Remaining limits

- Japanese wrapping has whole-grapheme/CJK-column safety but no kinsoku or UAX #14
  punctuation rules yet. This is not a complete Japanese typography claim.
- A one-column clip cannot display a two-column cluster and stops that segment.
- Combining sequences interrupted by a native color control are separate literal
  runs, so grapheme composition across style boundaries is not guaranteed.
- The original `VTIG_Input` text buffer, caret, deletion, clipboard filtering and
  default permitted name characters remain byte/ASCII based. This text-rendering
  overlay does not claim Japanese IME name editing; a separate typed input adapter
  is required if that behavior is added.
- Only the parameter types originally rendered by VTIG (Char, AnsiString, Integer)
  are supported. Semantic text IDs and translations are owned by the localization
  layer and are not generated by this adapter.
- Actual menu/campaign layout, mobile scaling and original save/resume flows still
  require integration and real-browser verification by the root task.
- Display call sites outside VTIG require auditing: upstream `drlio.pas`
  line 948 positions the level name with byte `Length`, line 976 centers a boss
  name with byte `Length`, and `drlplayerview.pas` line 756 truncates an entry name
  with byte `Copy(..., 1, 47)`. These need presentation-column/prefix adapters
  before Japanese dynamic names are considered layout-safe. The browser bridge
  agent has added guarded `VTIG_Length` / `VTIG_PrefixColumns` patches for these
  and the HUD description prefix. Their runtime layout remains unverified.
