# Retained original ToME 1.7.6 bootstrap

Upstream commit: `624a67329fe2ad440c5b344785a9c73fcf22ae63`.
This investigation uses exact Lua sources from the official stable distribution.
The source copies and their hashes are in `source-manifest.json` and
`verified-source-hashes.json`. The driver is an additional GPL-3.0-or-later
input/platform adapter; it contains no substitute Actor, combat, turn, birth,
equipment, quest, or generation implementation.

## Executable driver contract

`real-core-probe.lua` must run in a fresh original Lua 5.1 state after all genuine
T-Engine native Lua registrations and genuine SDL/font/image initialization.
It deliberately fails when `core`, `fs`, `rng`, native version 17, or original
mounts are absent. It is not executable using the earlier scalar-only Lua VM.

Before evaluating the driver, supply:

```lua
__TOME_WEB_SETTINGS = {
  seed = 176,
  player_name = "web_probe_176",
  root_game = "/original/game",
  unpacked_game = "/unpacked/game",
  max_ticks_per_command = 10000,
}
```

The paths refer to browser MEMFS/PhysFS or an isolated native test installation.
Mount the original distribution at `/original/game` including its real
`loader/` and `thirdparty/`. Mount the unpacked original engine/module tree at
`/unpacked/game`. The unpacked tree has **`engines/default`**, plural,
`modules/tome`, and `addons`. Preserve a fresh writable home/profile area under
the permitted test workspace, separate from the user's native game saves.
`game/thirdparty/config.lua` is required; it is absent from the unpacked tree.
The parent native initializer additionally mounts original `bootstrap/` at
`/bootstrap` and the additional driver directory at `/adapter`. The verified
`browser-vfs-inputs.json` uses its actual `/original`, `/unpacked`, `/adapter`
paths, not speculative staging paths.

The driver mounts thirdparty and loader as original platform paths, then executes:

```lua
loadfile("/loader/pre-init.lua")()
loadfile("/loader/init.lua")(
  "te4", "1.7.6", "tome", "web_probe_176", true,
  'no_birth_popup=true;set_addons={};birth_done_script="__TOME_WEB.birth_done()"',
  "default"
)
```

This is the original **seven-argument Lua loader** API. The sixth parameter is
Lua **assignment statements**, executed in `__module_extra_info`, not a table
literal. If invoking the native `main.c` loader path instead, its arguments
also include the native core type and core id before those seven arguments.
The driver executes the Lua loader itself and should not be combined with a
second independent native loader invocation.

Original `engine.init.lua` loads engine classes, settings, actual fonts, input
and profile/save adapters. Its unchanged `util.showMainMenu(true)` dispatches
to the requested `tome` module; no fake main menu or direct Actor constructor
is used. The adapter feeds the existing original Birther defaults after the
original dialog registers. It does not enable cheat mode. A fresh character
name is required so the original overwrite confirmation is never bypassed.
The exact source routes are:

| Original file | Route |
| --- | --- |
| `loader/init.lua:24` | Arguments, engine version selection, module selection |
| `engine/utils.lua:2984` | `showMainMenu(true)` -> `Module:instanciate` |
| `engine/Module.lua:931` | Mount definitions -> `mod.load("init")` -> `M.new()` -> `game:run()` |
| `mod/class/Game.lua:79` | Original Game constructor, original UISet, original interfaces |
| `mod/class/Game.lua:111` | Original run -> original `newGame()` |
| `mod/class/Game.lua:212` | Real Party, Player, GameState and Birther |
| `mod/dialogs/Birther.lua:392` | Actual default Cornac/Berserker descriptor input |
| `mod/dialogs/Birther.lua:305` | Actual validation, descriptor apply, cosmetic apply, birth callback |
| `mod/class/Game.lua:310` | Actual starting-zone change/generation and player resolve |
| `mod/class/Game.lua:338` | Actual `birth_done_script` callback |
| `mod/class/Game.lua:2174` | Original MOVE virtual handlers -> `Player:moveDir` |
| `mod/class/Game.lua:2242` | Original ATTACK_OR_MOVE handlers -> `Player:attackOrMoveDir` |
| `engine/KeyBind.lua:263` | Original virtual handler dispatch |
| `engine/GameTurnBased.lua:43` | Original paused/energy rule dispatch |
| `engine/GameEnergyBased.lua:59` | Original energy, NPC, level, effect, and turn processing |

The adapter hook wraps `engine.Game.registerDialog`, always delegates the full
original method, and selects real Birther defaults through unchanged source
methods. It changes presentation/input automation only. Source code and method
bodies remain pristine. Original module `set_addons={}` selects the base game
for this bounded milestone; it is not a claim that optional addons are ported.

## Bridge and success evidence

`__TOME_WEB.ready` is set exclusively when the original `birth_done_script`
callback executes and a real player, level, and map exist. Look for:

* `TOME_REAL_BIRTH_JSON=...`: original birth callback has completed.
* `TOME_REAL_BOOT_JSON=...`: original loader returned to the adapter.

`__TOME_WEB.snapshot_json()` returns the protocol 1 read-only view agreed with
the Rust display adapter. It reads actual fields and actual map layer tables;
it never draws, calls `updateFOV`/`canSee`, resolves names, or consumes RNG.
This characterization snapshot is **not a savefile**. Its limited visibility
view uses original `seens`/`remembers`; production invisibility and ESP display
still require the original cached visibility policy.

`__TOME_WEB.command_json("MOVE_RIGHT")` and
`__TOME_WEB.command_json("ATTACK_OR_MOVE_RIGHT")` return
`{protocol, command, ticks, before, after}`. All rules run through the actual
original KeyBind and actual `game:tick()`; no coordinates or actor fields are
written by the bridge. `MOVE_STAY` is the actual wait command. A real active
dialog blocks gameplay input instead of being silently dismissed. The host
runaway tick limit fails instead of claiming success.

Verify a real successful move by comparing original coordinates in before/after.
Verify attack when a real source-generated adjacent hostile exists by comparing
the actual enemy life/state and original player energy. A blocked move is not
evidence of a successful move; a command sent without an adjacent target is not
evidence of combat. No move/attack success has been asserted from source reading.

## Concrete native dependencies before Player creation

Retain native original SFMT/rng, FOV/map/pathfinding, noise, serialization,
entity/class references, and filesystem/archive semantics. Retain all actual
Lua definitions loaded by `mod/load.lua`, including talents/effects/stats,
birth, resolvers, inventories, factions, AI, stores, world/party/quests and zone
generation. Retain the real native register calls from `main.c`.

The original Game constructor cannot be reached with only a screen-size stub:
`GameEnergyBased.init` dispatches virtual `self:loaded()` and ToME constructs
its actual Minimalist UISet during the inherited constructor. Mandatory
presentation/environment APIs include actual font metrics, image surfaces,
texture metadata, input handler registration, window/mode queries, settings
filesystem writes, profile initialization, and save-pipe creation. Genuine
font/image objects must exist. Original guarded shader/FBO capabilities can
report unsupported using their documented false/nil paths; that does not
remove mandatory fonts/images. The seven return values of original
`surface:glTexture()` include actual source width/height at positions 6/7.
See the sibling verified native demand map in
`../kernel-bindings-work/lua-map/BOOTSTRAP.md`.

For the first faithful bootstrap milestone the parent is building the original
native bindings and actual SDL/font/image machinery. Rust separation follows
that functioning original baseline. The driver contains no presentation mocks.

## Determinism and remaining proof boundaries

The native RNG binding accepts a nonnegative signed C int; high-bit u32 values
become negative and select the wall-time branch. This driver accepts
`0..2147483647`, seeds the original native RNG once after original pre-init, and
seeds original Lua `math.random` with the same explicit replay seed.

An SFMT-only snapshot is insufficient for a full deterministic save. Original
normalFloat caches `stored/z0/z1` separately and `rng.seed` does not reset that
cache. Original Lua `math.random` delegates to libc `rand`/`srand`, which has
separate hidden state. `math-random-audit.json` records concrete source usage
without claiming runtime reachability or alias completeness. Rendering also
consumes gameplay RNG in original Game shake/flyer paths, and drawing can call
`updateFOV`; those must be isolated before render-purity is claimed.

The driver is a runnable source-faithful bridge awaiting the parent's full
native executable. A syntax pass or early native-contract failure does not
prove real Game/Player creation. The completed earlier scalar kernel proof
also does not prove this bootstrap, campaign, saves, or a full playable port.
