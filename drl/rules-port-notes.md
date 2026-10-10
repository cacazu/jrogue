# DRL numeric rules migration

This is an incremental port of selected numeric rules from DRL 0.10.11a. It is not a complete game or campaign port. The Rust module has no browser, renderer, clock, storage, or random generator dependency. Application code supplies resolved hook values and deterministic random outcomes, then applies the returned effects.

Pristine sources used:

- `upstream/drl`, chaosforgeorg/doomrl commit `a6f965072b3a25b768c91dbced00367f1b57d865`.
- `upstream/fpcvalkyrie`, chaosforgeorg/fpcvalkyrie commit `f89735a741a968997656c2d48a003ec569db7f22`.

Implementation: `port/src/logic/rules.rs`. Fixtures: `port/tests/rules.rs`.

## Source mapping

| Rust API | Pinned source | Preserved behavior |
| --- | --- | --- |
| `BodyTarget`, `DamageType` | `dfdata.pas:126–129` | Enumeration order; `Sharpnel` spelling in Pascal maps to `Shrapnel` in Rust. |
| `ACTION_COST` | `dfdata.pas:281–283` | Reload, movement, and fire each start at 1000. |
| `item_protection` | `dfitem.pas:300–313` | Durability 0 / 1–25 / 26–49 / 50–1000; integer division; nodegrade. |
| `item_resistance` | `dfitem.pas:315–331` | Negative resistance persists; shield at zero durability loses positive resistance before nodegrade; Ceil occurs after integer division. |
| `total_resistance` | `dfbeing.pas:2081–2109` | Innate/item immunity early exits; Internal bypasses equipment/hooks; player torso innate cap; final cap after equipment. |
| `resolve_damage`, `needs_hardy_roll` | `dfbeing.pas:2111–2305` | Post-hook numeric damage and ordered armor/HP effects; explicit hardy coin requirement; overkill thresholds. |
| `movement_cost` | `dfbeing.pas:2717–2734` | Multiplicative slot modifiers; move bonus; current cell cost; flying bypass. |
| `fire_cost`, `dual_fire_cost` | `dfbeing.pas:2736–2760` | Unarmed fallback; bonus floor; clamp before multipliers; rounded individual costs then integer average. |
| `reload_cost` | `dfbeing.pas:2762–2771` | Missing/melee weapon fallback; no minimum-cost clamp; both hook multipliers. |
| `reload_transfer` | `dfbeing.pas:1407–1458` | Single-round reload; automatic reload; exhausted stack continuation; ammo pack costs integer `cost div 5` and stops continuation. |
| `use_or_wear_cost` | `dfbeing.pas:2774–2787` | Item time defaults to 10 and multiplies being time. |
| `shot_cost` | `dfitem.pas:627–634` | Shots/multiplier apply only for a being parent; minimum total ammo cost 1. |
| `equipment_knock_modifier` | `dfbeing.pas:2796–2807` | Equipment knock modifiers multiply rather than add. |
| `knockback_strength`, `knockback_distance` | `dfbeing.pas:2673–2714` | Direction-code check; immunity; floor after scaling, then body bonus; stop at first blocked cell. |
| `apply_percentage_modifier` | `dfdata.pas:754–758` | Exact modifier-zero fast path; rounded percentage scaling. |
| `roll_check_from_sum` | `dfdata.pas:741–751` | 3/4/17/18 on 3d6 override the statistic with +30/+20/−20/−30. |
| `dice_total` | Valkyrie `vrltools.pas:1102–1105`; `vrandom.pas:182–190` | Already supplied dice plus bonus; zero-sided/zero-count and one-sided dice need no RNG calls in the upstream generator. |

## Non-obvious fixtures

The fixtures deliberately retain upstream behavior that a redesign could accidentally change:

- Armor protection is measured before durability damage. A 4-protection armor at durability 50 hit for 10 takes 6 durability and 6 HP damage; its resulting protection is 2 for the next hit.
- Complete resistance still takes at least 1 armor durability. Acid immunity does not double that point.
- A shield with positive prior durability absorbs the hit that exhausts it and returns before destruction. A later hit at durability zero can destroy it.
- IgnoreArmor bypasses resistance/HP protection/hardy, while still damaging equipment durability.
- A zero incoming damage value is accepted upstream. Nonzero resistance or normal armor processing can raise health damage to 1. IgnoreArmor with zero damage stays zero.
- A 15 resistance value at durability 25 becomes 3, because integer `div 4` precedes Ceil.
- Hardy requires its random coin only when damage is at or below effective armor, after the shield/immunity exits. The caller must query `needs_hardy_roll` and consume exactly one bounded RNG result for that branch.
- A pack reload with cost 1004 spends 200. Multiple ordinary stacks spend the reload cost once.

## Numeric compatibility boundary

Free Pascal [Round documentation](https://www.freepascal.org/docs-html/rtl/system/round.html) specifies nearest integer with half ties to even. Rust uses `round_ties_even` with explicit finite/range checks.

The selected arithmetic profile is Windows x64: source Single variables are f32 and Real intermediates are f64. The [Free Pascal compiler type checker](https://github.com/fpc/FPCSource/blob/release_3_2_2/compiler/nadd.pas#L135) selects the existing real operand type for integer × real expressions, and [its x64 default](https://github.com/fpc/FPCSource/blob/release_3_2_2/compiler/nadd.pas#L1326) is Double for integer division. The Rust port preserves Single assignment boundaries and Single results before Round in movement, firing, ammo costs, and gib division.

These are source-derived reference fixtures, not a live differential run against compiled Pascal. Exact compiler-version/optimization/FPU-profile differential verification is still required before claiming complete numerical parity across original platforms. Overflow and invalid durability inputs are rejected rather than reproducing undefined/uninitialized or overflowing upstream states.

## Integration responsibilities still unported

Damage hooks can mutate state, delete items/beings, or make the target invulnerable. The application layer must run these in upstream order and supply the resulting state. The damage resolver currently assumes the intervening armor OnReceiveDamage hook does not change relevant state. Armor items that mutate flags/durability/being state in that hook require splitting the application operation at that hook and retaining the pre-hook protection snapshot; applying this one-shot numeric result to such an item would be premature. This module does not implement hooks, kill callbacks, blood effects, sounds, messages, inventory destruction, the full canDualWield checks, map occupancy queries, or the RNG algorithm. A damage result reports destruction and HP changes; it does not mutate an inventory or emit text.

When integrating knockback, compute the occupancy flags using EF_NOBEINGS and the correct walking/flying blocking flag, then supply ordered emptiness values. Displace/post-displace hooks are outside these helpers. The being's current cell is used for actual movement action cost; the separate source pathfinder heuristic is not represented here.

`RuleError` Display strings are internal diagnostics. Presentation must map each variant to a semantic text ID before showing an error to the player. There are no player names, item names, translated strings, or rendered strings in numeric state.

## Verification

The integration fixture file can also compile directly with `rustc --edition 2024 --test port/tests/rules.rs`; it deliberately imports only the rules module. This allows verification while the other layers are being integrated.

Verified on the local Windows executor using the installed Rust toolchain: rustfmt completed; the standalone Rust fixture executable reported **34 passed, 0 failed** in 0.01 seconds. The tests include a precision-boundary regression where a Single result of `0.0055 × 1000` becomes 5.5 and Round returns 6; premature Double promotion would incorrectly return 5. Default sandbox execution stalled, so the authorized compiler/check run used the approved outside-sandbox executor with its output executable in the writable Temp directory.

Full native Pascal differential, full game flows, campaign content, and browser acceptance are outside this numeric milestone and remain completion gates for the enclosing game task.
