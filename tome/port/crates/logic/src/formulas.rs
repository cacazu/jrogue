// SPDX-License-Identifier: GPL-3.0-or-later
// Source-derived translation of selected Tales of Maj'Eyal 1.7.6 rules.
// Upstream copyright (C) 2009-2019 Nicolas Casalini.
//! Pure scalar characterization of official Tome 1.7.6 rules.
//!
//! This module is an incomplete migration milestone, not a game engine.
//! It intentionally accepts already-resolved combat inputs: talent callbacks,
//! hook order, equipment, statuses, visibility and damage projection remain
//! upstream responsibilities. It never draws random numbers or renders.
//! Browser/application boundaries must reject non-finite numeric inputs.

/// Official `Combat:checkHit`, lines 337-350, without its RNG draw.
/// Tutorial combat forces bounds to 0-100. The unused upstream `factor` and
/// `p` parameters do not affect this version's chance.
#[must_use]
pub fn hit_chance(accuracy: f64, defense: f64, minimum: f64, maximum: f64, tutorial: bool) -> f64 {
    let (minimum, maximum) = if tutorial {
        (0.0, 100.0)
    } else {
        (minimum, maximum)
    };
    let chance = (50.0 + 2.5 * (accuracy.max(0.0) - defense.max(0.0))).ceil();
    // Match util.bound, including its ordered comparisons.
    bound(chance, minimum, maximum)
}

/// Official `Combat:rescaleCombatStats`, lines 1477-1496, defaults 20 and 1.
#[must_use]
pub fn rescale_combat_stats(raw: f64) -> f64 {
    rescale(raw, 20.0, 1.0)
}

/// Stat contribution in `Combat:combatDamage`, line 1703 (45, 1/3).
#[must_use]
pub fn rescale_weapon_stats(weighted_raw_stats: f64) -> f64 {
    rescale(weighted_raw_stats, 45.0, 1.0 / 3.0)
}

fn rescale(raw: f64, interval: f64, step: f64) -> f64 {
    // Non-finite values are invalid input; propagate without an endless loop.
    if !raw.is_finite() {
        return raw;
    }
    let mut result = raw;
    let mut shift = 1.0 + step;
    let mut tier = interval;
    let mut base = interval;
    loop {
        let next = tier + (raw - base) / shift;
        if next < result {
            result = next;
            base += interval * shift;
            tier += interval;
            shift += step;
        } else {
            return result.floor();
        }
    }
}

/// Official `Combat:rescaleDamage`, lines 1467-1470.
#[must_use]
pub fn rescale_damage(damage: f64) -> f64 {
    if damage <= 0.0 {
        damage
    } else {
        damage.powf(1.04)
    }
}

/// Official `Combat:combatDamagePower`, lines 1708-1714.
/// This is the branch without the Form and Function talent bonus.
#[must_use]
pub fn weapon_damage_power(raw_weapon_damage: f64, add: f64) -> f64 {
    let power = (raw_weapon_damage + add).max(1.0);
    ((power / 10.0).sqrt() - 1.0) * 0.5 + 1.0
}

/// Same rule with the Form and Function bonus applied after the minimum.
/// Official `Combat:combatDamagePower`, line 1712; order matters for debuffs.
#[must_use]
pub fn weapon_damage_power_with_talent(
    raw_weapon_damage: f64,
    add: f64,
    form_and_function_bonus: f64,
) -> f64 {
    let power = (raw_weapon_damage + add).max(1.0) + form_and_function_bonus;
    ((power / 10.0).sqrt() - 1.0) * 0.5 + 1.0
}

/// Official `Combat:combatDamage`, lines 1700-1704.
/// Physical power is already rescaled; weighted stats are still raw.
/// `training_increase` is a fraction, e.g. 0.4 for +40%.
#[must_use]
pub fn base_weapon_damage(
    physical_power: f64,
    weighted_raw_stats: f64,
    weapon_power: f64,
    training_increase: f64,
) -> f64 {
    rescale_damage(
        0.3 * (physical_power + rescale_weapon_stats(weighted_raw_stats))
            * weapon_power
            * (1.0 + training_increase),
    )
}

/// Official `Combat:combatTalentPhysicalDamage`, lines 1771-1775.
/// Effective talent level includes mastery. Power is already rescaled.
/// The upstream argument called `max` is the pre-rescale normalization target.
#[must_use]
pub fn physical_talent_damage(
    effective_talent_level: f64,
    physical_power: f64,
    base: f64,
    maximum: f64,
) -> f64 {
    let modifier = maximum / ((base + 100.0) * ((5.0_f64.sqrt() - 1.0) * 0.8 + 1.0));
    rescale_damage(
        (base + physical_power) * ((effective_talent_level.sqrt() - 1.0) * 0.8 + 1.0) * modifier,
    )
}

/// Official `Combat:combatArmorHardiness`, line 1358, after talent resolution.
#[must_use]
pub fn armor_hardiness(armor_hardiness_bonus: f64, talent_bonus: f64, breached: bool) -> f64 {
    bound(30.0 + armor_hardiness_bonus + talent_bonus, 0.0, 100.0)
        * if breached { 0.5 } else { 1.0 }
}

/// Official `Combat:attackTargetWith`, lines 511 and 570-571.
/// Input damage is after the upstream damage-range roll/deflection hooks.
/// Critical strikes and talent multipliers are applied after this function.
#[must_use]
pub fn melee_damage_after_armor(
    damage: f64,
    armor: f64,
    armor_penetration: f64,
    hardiness_percent: f64,
) -> f64 {
    let protected = bound(hardiness_percent / 100.0, 0.0, 1.0);
    let effective_armor = (armor - armor_penetration).max(0.0);
    (damage * protected - effective_armor).max(0.0) + damage * (1.0 - protected)
}

/// Official `Combat:attackTargetWith`, lines 574-576, supplied crit result.
/// This excludes counterstrike, classification and DamageType projection.
#[must_use]
pub fn melee_damage_after_multipliers(
    after_armor: f64,
    critical_multiplier: f64,
    attack_multiplier: f64,
) -> f64 {
    after_armor * critical_multiplier * attack_multiplier
}

/// Official `Combat:combatSpeed`, lines 1439-1441.
#[must_use]
pub fn weapon_action_speed(weapon_speed: f64, physical_speed: f64, add: f64) -> f64 {
    weapon_speed / (physical_speed + add).max(0.4)
}

/// Official `Combat:getTierDiff`, lines 325-328.
#[must_use]
pub fn cross_tier_duration(power: f64, save: f64) -> f64 {
    ((power.floor() / 20.0).ceil().max(1.0) - (save.floor() / 20.0).ceil().max(1.0)).max(0.0)
}

/// Official `Combat:combatGetResist`, lines 2310-2321, after resolving type.
/// For type `all`, pass typed resistance 0. `cap` is cap.all+cap[type].
#[must_use]
pub fn resistance_percent(all: f64, typed: f64, cap: f64, forced_percent: f64) -> f64 {
    let a = (all / 100.0).min(1.0);
    let b = (typed / 100.0).min(1.0);
    bound(100.0 * (1.0 - (1.0 - a) * (1.0 - b)), -100.0, cap) * forced_percent / 100.0
}

/// Official `Combat:combatGetResistPen`, base/straight path, lines 2326-2328.
/// Highest-penetration and Umbral Agility branches must be resolved separately.
#[must_use]
pub fn resistance_penetration_percent(all: f64, typed: f64) -> f64 {
    (all + typed).min(70.0)
}

/// Official default DamageType projector, damage_types.lua lines 367-373.
/// Penetration affects only positive resistance and is capped here at 0-100.
#[must_use]
pub fn damage_after_resistance(damage: f64, resistance: f64, penetration: f64) -> f64 {
    let penetration = bound(penetration, 0.0, 100.0);
    let resistance = if resistance > 0.0 {
        resistance * (100.0 - penetration) / 100.0
    } else {
        resistance
    };
    if resistance >= 100.0 {
        0.0
    } else if resistance <= -100.0 {
        damage * 2.0
    } else {
        damage * ((100.0 - resistance) / 100.0)
    }
}

/// Official `GameEnergyBased:tickLevel`, lines 124-129.
/// The grant is conditional; an actor already ready gets no additional energy.
/// This does not invoke actor behavior, advance base energy, or consume energy.
#[must_use]
pub fn energy_after_tick(
    current: f64,
    threshold: f64,
    per_tick: f64,
    energy_modifier: f64,
    global_speed: f64,
) -> f64 {
    if current < threshold {
        current + per_tick * energy_modifier * global_speed
    } else {
        current
    }
}

/// Official `engine.Actor:useEnergy`, lines 479-482, scalar subtraction.
#[must_use]
pub fn energy_after_action(current: f64, cost: f64) -> f64 {
    current - cost
}

fn bound(value: f64, minimum: f64, maximum: f64) -> f64 {
    if value < minimum {
        minimum
    } else if value > maximum {
        maximum
    } else {
        value
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() <= 1e-10 * expected.abs().max(1.0),
            "{actual} != {expected}"
        );
    }

    #[test]
    fn hit_chance_preserves_ceil_caps_and_tutorial() {
        for (attack, defense, min, max, tutorial, expected) in [
            (20.0, 20.0, 0.0, 100.0, false, 50.0),
            (20.1, 20.0, 0.0, 100.0, false, 51.0),
            (-3.0, -1.0, 0.0, 100.0, false, 50.0),
            (0.0, 100.0, 5.0, 95.0, false, 5.0),
            (100.0, 0.0, 5.0, 95.0, false, 95.0),
            (100.0, 0.0, 5.0, 95.0, true, 100.0),
        ] {
            close(hit_chance(attack, defense, min, max, tutorial), expected);
        }
    }

    #[test]
    fn combat_stat_breakpoints_follow_raw_cost_tiers() {
        for (raw, expected) in [
            (-2.5, -3.0),
            (0.0, 0.0),
            (19.0, 19.0),
            (20.0, 20.0),
            (21.0, 20.0),
            (59.0, 39.0),
            (60.0, 40.0),
            (61.0, 40.0),
            (120.0, 60.0),
            (200.0, 80.0),
        ] {
            close(rescale_combat_stats(raw), expected);
        }
        close(rescale_weapon_stats(45.0), 45.0);
        close(rescale_weapon_stats(105.0), 90.0);
    }

    #[test]
    fn damage_sqrt_power_and_high_end_rescale_match_source() {
        close(weapon_damage_power(10.0, 0.0), 1.0);
        close(weapon_damage_power(40.0, 0.0), 1.5);
        close(weapon_damage_power(90.0, 0.0), 2.0);
        close(weapon_damage_power(-20.0, 0.0), 0.658113883008419);
        close(weapon_damage_power_with_talent(-20.0, 0.0, 9.0), 1.0);
        close(rescale_damage(-10.0), -10.0);
        close(rescale_damage(100.0), 120.22644346174131);
        close(
            physical_talent_damage(5.0, 100.0, 0.0, 100.0),
            120.22644346174131,
        );
        close(base_weapon_damage(100.0, 0.0, 1.0, 0.0), 34.37210302945672);
    }

    #[test]
    fn hardiness_limits_armor_reduction_before_multipliers() {
        close(armor_hardiness(0.0, 0.0, false), 30.0);
        close(armor_hardiness(100.0, 0.0, true), 50.0);
        close(melee_damage_after_armor(100.0, 30.0, 10.0, 30.0), 80.0);
        close(melee_damage_after_armor(100.0, 200.0, 0.0, 30.0), 70.0);
        close(melee_damage_after_armor(100.0, 200.0, 0.0, 100.0), 0.0);
        close(melee_damage_after_armor(100.0, 10.0, 30.0, 30.0), 100.0);
        close(melee_damage_after_multipliers(80.0, 1.5, 2.0), 240.0);
    }

    #[test]
    fn resistance_uses_multiplicative_combination_and_cap() {
        close(resistance_percent(20.0, 30.0, 70.0, 100.0), 44.0);
        close(resistance_percent(100.0, 30.0, 70.0, 100.0), 70.0);
        close(resistance_percent(-200.0, 0.0, 70.0, 100.0), -100.0);
        close(resistance_percent(20.0, 30.0, 70.0, 50.0), 22.0);
        close(resistance_penetration_percent(20.0, 80.0), 70.0);
        close(damage_after_resistance(100.0, 50.0, 50.0), 75.0);
        close(damage_after_resistance(100.0, -50.0, 50.0), 150.0);
        close(damage_after_resistance(100.0, -200.0, 100.0), 200.0);
    }

    #[test]
    fn energy_grant_is_conditional_and_global_speed_scales_only_grant() {
        close(energy_after_tick(900.0, 1000.0, 100.0, 1.0, 1.5), 1050.0);
        close(energy_after_tick(1000.0, 1000.0, 100.0, 1.0, 2.0), 1000.0);
        close(energy_after_tick(-100.0, 1000.0, 100.0, 0.5, 1.0), -50.0);
        close(energy_after_action(1050.0, 1000.0), 50.0);
        close(weapon_action_speed(1.0, 0.0, 0.0), 2.5);
        close(cross_tier_duration(61.0, 20.0), 3.0);
        close(cross_tier_duration(20.0, 61.0), 0.0);
    }
}
