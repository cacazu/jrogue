# Future fixed weapon texts

This separate source-only stage extends the reviewed one-ID candidate to eleven
empty-parameter IDs: the existing weapon prompt, five fixed control labels and
five fixed description assignments. The installed game and current one-ID
candidate remain unchanged. `prepare.mjs` and `source-receipts.json` are maintained
by the parent; these tests and notes do not regenerate or edit them.

| Control | Visible label ID suffix | Description ID suffix | Native input/action |
| --- | --- | --- | --- |
| Recommended | `recommended.label` | `recommended.description` | `+`, `M_VIABLE` / `WPN_VIABLE` |
| Aptitudes | `aptitudes.label` | `aptitudes.description` | `%`, `M_APTITUDES` |
| Help | `help.label` | `help.description` | `?`, `M_HELP` |
| Random | `random.label` | `random.description` | `*`, `WPN_RANDOM` |
| Back | `back.label` | `back.description` | `CK_BKSP`, `M_ABORT` |

All suffixes above have prefix `startup.weapon.`. Labels stay BROWN and their
hotkey/action fields stay separate from their display text. The prompt stays
CYAN. These widgets are constructed only when a weapon popup is required; jobs
without a choice, species without grasping, one legal weapon, or an already
resolved weapon skip the popup through the original native branches.

The five descriptions are assigned to `MenuButton::description`. They are **not
shown in the current console weapon popup**: neither its main nor sub menu gets
a `descriptions` Switcher. `OuterMenu::add_button` renders WHITE wrapped
descriptions only when that Switcher exists. Localizing those assignments adds
no new description pane or input behavior.

`engine/newgame.cc` changes only this private fixed-text helper and the eleven
source bindings. Non-Emscripten builds return their exact canonical English
arguments. Emscripten uses the existing 512-byte caller buffer and native
`end(1)` error route. `engine/library.js` accepts only these IDs, `{}` and exact
reviewed EN/JA strings. `web/startup-text.mjs` checks all eleven catalog/source
bindings and executes **22 EN/JA preflight calls per bridge** before returning.
Dynamic rows, weapon names, aptitude suffixes, previous-choice labels, welcome,
name and seed composition remain original. [dynamic-scope.md](dynamic-scope.md)
records their concrete source traps.

Run the isolated tests with the installed assets read-only:

```powershell
& 'C:\Users\kit\emsdk\node\24.19.0_64bit\node.exe' --max-old-space-size=64 'C:\Users\kit\Documents\Codex\2026-10-02\task-6\dcss-startup-work\next-fixed-weapon-labels\tests.test.mjs'
```

**99 source/mock checks pass.** They verify three exact byte inversions to the
current candidate, restoration of the native unit to pinned upstream, exact
source/catalog/condition/hotkey bindings, description visibility, both languages
for all eleven caller-buffer writes, exact UTF-8 byte lengths/NUL/sentinels,
strict ABI/ID/parameter/response rejection, invalid UTF-8/descriptor/aliasing,
release cleanup, memory growth/reentrancy, formatter and diagnostic failure,
real asset checksum rejection, and isolated source identity/site/params
rejection. Success and checksum tests use real SHA-256. Three source-contract
rejection tests stub the digest dependency to isolate the subsequent source
validation rather than failing earlier at checksum validation.

The tests execute the staged production bridge JavaScript and library import
with mock ABI exports backed by `WebAssembly.Memory`. No WASM module, engine,
browser, SDK or build runs. Nine pinned source/catalog/current-candidate files
are checked unchanged at completion. Native helper failure behavior is checked
in source; C++ execution, actual 22-call Rust preflight, both-language native
frames/controls and save/RNG parity remain parent runtime gates. This future
slice is not approved for deployment by these mock results.
