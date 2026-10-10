// SPDX-License-Identifier: GPL-2.0-only
// Intentionally standalone as well as a Cargo integration test. This makes the
// numeric migration fixtures runnable before the other port layers are ready.
#[path = "../src/logic/rules.rs"]
mod rules;

use rules::*;

fn armor(armor: i32, durability: u16) -> ItemDefense {
    ItemDefense {
        kind: DefenseKind::Armor,
        armor,
        durability,
        no_degrade: false,
        shield: false,
        no_durability: false,
        no_destroy: false,
    }
}

fn damage(damage: i32, damage_type: DamageType) -> DamageContext {
    DamageContext {
        damage,
        damage_type,
        health: 50,
        maximum_health: 50,
        innate_armor: 0,
        weapon_armor: 0,
        resistance: 0,
        target_armor: None,
        invulnerable: false,
        dying: false,
        self_immune_equipped_source: false,
        illusion_source: false,
        hardy: false,
        hardy_roll: None,
        gib_multiplier: 1.0,
    }
}

fn fire(use_time: u8) -> FireCostContext {
    FireCostContext {
        fire_time: 100,
        melee: false,
        weapon: Some(FireWeapon {
            melee: false,
            use_time,
            fire_cost_multiplier: 1.0,
        }),
        fire_cost_bonus: 0,
        being_fire_cost_multiplier: 1.0,
    }
}

#[test]
fn pascal_round_preserves_positive_and_negative_half_ties() {
    for (value, expected) in [
        (-3.5, -4),
        (-2.5, -2),
        (-1.5, -2),
        (-0.5, 0),
        (0.5, 0),
        (1.5, 2),
        (2.5, 2),
        (3.5, 4),
        (1234.56, 1235),
    ] {
        assert_eq!(pascal_round(value), Ok(expected));
    }
    for integer in -100..100 {
        let rounded = pascal_round(f64::from(integer) + 0.5).unwrap();
        assert_eq!(rounded % 2, 0);
        assert!((f64::from(rounded) - (f64::from(integer) + 0.5)).abs() <= 0.5);
    }
}

#[test]
fn invalid_numeric_values_are_rejected_before_narrowing() {
    assert_eq!(pascal_round(f64::NAN), Err(RuleError::NonFinite));
    assert_eq!(pascal_round(f64::INFINITY), Err(RuleError::NonFinite));
    assert_eq!(
        pascal_round(f64::from(i32::MAX) + 0.5),
        Err(RuleError::Overflow)
    );
    assert_eq!(pascal_round(f64::from(i32::MIN)), Ok(i32::MIN));
    assert_eq!(
        item_protection(armor(4, 1001)),
        Err(RuleError::InvalidDurability)
    );
}

#[test]
fn protection_uses_actual_durability_and_integer_division_bands() {
    for (durability, expected) in [
        (0, 0),
        (1, 1),
        (25, 1),
        (26, 3),
        (49, 3),
        (50, 7),
        (1000, 7),
    ] {
        assert_eq!(item_protection(armor(7, durability)), Ok(expected));
    }
    assert_eq!(item_protection(armor(1, 1)), Ok(1));
    assert_eq!(item_protection(armor(0, 1)), Ok(0));
    let mut boots = armor(7, 26);
    boots.kind = DefenseKind::Boots;
    assert_eq!(item_protection(boots), Ok(3));
    boots.no_degrade = true;
    boots.durability = 0;
    assert_eq!(item_protection(boots), Ok(7));
    boots.no_degrade = false;
    boots.kind = DefenseKind::Other;
    assert_eq!(item_protection(boots), Ok(7));
}

#[test]
fn resistance_does_not_ceil_the_pre_division_fraction() {
    for (durability, expected) in [
        (0, 0),
        (1, 3),
        (25, 3),
        (26, 7),
        (49, 7),
        (50, 15),
        (1000, 15),
    ] {
        assert_eq!(item_resistance(armor(4, durability), 15), Ok(expected));
    }
    assert_eq!(item_resistance(armor(4, 1), 1), Ok(1));
    assert_eq!(item_resistance(armor(4, 0), -25), Ok(-25));
}

#[test]
fn exhausted_shield_loses_positive_resistance_even_with_no_degrade() {
    let mut shield = armor(3, 0);
    shield.shield = true;
    shield.no_degrade = true;
    assert_eq!(item_resistance(shield, 100), Ok(0));
    assert_eq!(item_resistance(shield, -20), Ok(-20));
    // GetProtection does not have this shield-specific early exit.
    assert_eq!(item_protection(shield), Ok(3));
}

#[test]
fn resistance_immunity_precedes_cap_and_cancels_other_vulnerability() {
    let mut context = ResistanceContext {
        target: BodyTarget::Torso,
        player: true,
        cap: 75,
        innate: 110,
        weapon: -100,
        target_equipment: -100,
        bonus: -100,
    };
    assert_eq!(total_resistance(context), Ok(100));
    context.innate = -40;
    context.weapon = 100;
    assert_eq!(total_resistance(context), Ok(100));
    context.weapon = -40;
    context.target_equipment = 100;
    assert_eq!(total_resistance(context), Ok(100));
}

#[test]
fn internal_resistance_exits_before_weapon_equipment_and_hook() {
    let mut context = ResistanceContext {
        target: BodyTarget::Internal,
        player: true,
        cap: 75,
        innate: 90,
        weapon: 100,
        target_equipment: 100,
        bonus: 100,
    };
    assert_eq!(total_resistance(context), Ok(75));
    context.player = false;
    assert_eq!(total_resistance(context), Ok(90));
    context.innate = -25;
    assert_eq!(total_resistance(context), Ok(-25));
}

#[test]
fn torso_caps_innate_before_adding_vulnerability_but_feet_do_not() {
    let mut context = ResistanceContext {
        target: BodyTarget::Torso,
        player: true,
        cap: 75,
        innate: 90,
        weapon: -20,
        target_equipment: 0,
        bonus: 0,
    };
    assert_eq!(total_resistance(context), Ok(55));
    context.target = BodyTarget::Feet;
    assert_eq!(total_resistance(context), Ok(70));
    context.weapon = 10;
    assert_eq!(total_resistance(context), Ok(75));
    context.innate = -100;
    context.weapon = 0;
    assert_eq!(total_resistance(context), Ok(-100));
}

#[test]
fn armor_wear_occurs_before_health_and_uses_old_protection() {
    let mut context = damage(10, DamageType::Bullet);
    context.target_armor = Some(armor(4, 50));
    let outcome = resolve_damage(context).unwrap();
    let wear = outcome.armor.unwrap();
    assert_eq!(wear.durability_damage, 6);
    assert_eq!(wear.after.durability, 44);
    assert_eq!((wear.protection_before, wear.protection_after), (4, 2));
    assert_eq!(outcome.health_damage, 6);
    assert_eq!(outcome.health_after, 44);
}

#[test]
fn damage_types_adjust_combined_armor_after_durability_damage() {
    for (kind, effective, hp_damage) in [
        (DamageType::Bullet, 9, 11),
        (DamageType::Melee, 9, 11),
        (DamageType::Shrapnel, 18, 2),
        (DamageType::Plasma, 4, 16),
        (DamageType::Pierce, 4, 16),
        (DamageType::SuperPlasma, 3, 17),
        (DamageType::Cold, 9, 11),
        (DamageType::Poison, 9, 11),
    ] {
        let mut context = damage(20, kind);
        context.innate_armor = 2;
        context.weapon_armor = 3;
        context.target_armor = Some(armor(4, 100));
        let outcome = resolve_damage(context).unwrap();
        assert_eq!(outcome.effective_armor, effective, "{kind:?}");
        assert_eq!(outcome.health_damage, hp_damage, "{kind:?}");
        assert_eq!(outcome.armor.unwrap().durability_damage, 16, "{kind:?}");
    }
}

#[test]
fn acid_doubles_armor_wear_after_resistance() {
    let mut context = damage(20, DamageType::Acid);
    context.resistance = 50;
    context.target_armor = Some(armor(4, 100));
    let outcome = resolve_damage(context).unwrap();
    assert_eq!(outcome.damage_after_resistance, 10);
    assert_eq!(outcome.health_damage, 6);
    assert_eq!(outcome.armor.unwrap().after.durability, 88);
}

#[test]
fn resistance_rounds_half_ties_to_even_and_keeps_minimum_damage() {
    let mut context = damage(5, DamageType::Fire);
    context.resistance = 50;
    assert_eq!(resolve_damage(context).unwrap().damage_after_resistance, 2);
    context.damage = 7;
    assert_eq!(resolve_damage(context).unwrap().damage_after_resistance, 4);
    context.damage = 0;
    assert_eq!(resolve_damage(context).unwrap().health_damage, 1);
    context.damage = 10;
    context.resistance = -50;
    assert_eq!(resolve_damage(context).unwrap().health_damage, 15);
}

#[test]
fn complete_immunity_still_wears_armor_once_and_does_not_double_acid_wear() {
    let mut context = damage(20, DamageType::Acid);
    context.resistance = 100;
    context.target_armor = Some(armor(4, 100));
    context.hardy = true;
    assert!(!needs_hardy_roll(context).unwrap());
    let outcome = resolve_damage(context).unwrap();
    assert_eq!(outcome.prevention, Some(DamagePrevention::Resistance));
    assert_eq!(outcome.armor.unwrap().durability_damage, 1);
    assert_eq!(outcome.health_after, 50);
    assert!(!outcome.hardy_roll_used);
}

#[test]
fn ignore_armor_bypasses_resistance_and_hardy_but_still_wears_equipment() {
    let mut context = damage(20, DamageType::IgnoreArmor);
    context.resistance = 100;
    context.innate_armor = 100;
    context.target_armor = Some(armor(4, 100));
    context.hardy = true;
    assert!(!needs_hardy_roll(context).unwrap());
    let outcome = resolve_damage(context).unwrap();
    assert_eq!(outcome.health_damage, 20);
    assert_eq!(outcome.armor.unwrap().after.durability, 84);
    context.damage = 0;
    let outcome = resolve_damage(context).unwrap();
    assert_eq!(outcome.health_damage, 0);
    assert_eq!(outcome.armor.unwrap().durability_damage, 1);
}

#[test]
fn shield_absorbs_the_hit_that_exhausts_it_before_destroy_check() {
    let mut context = damage(100, DamageType::Plasma);
    let mut shield = armor(3, 2);
    shield.shield = true;
    context.target_armor = Some(shield);
    let outcome = resolve_damage(context).unwrap();
    assert_eq!(outcome.prevention, Some(DamagePrevention::Shield));
    assert_eq!(outcome.health_after, 50);
    assert_eq!(outcome.armor.unwrap().after.durability, 0);
    assert!(!outcome.armor.unwrap().destroyed);
    context.target_armor = Some(outcome.armor.unwrap().after);
    let next_hit = resolve_damage(context).unwrap();
    assert!(next_hit.armor.unwrap().destroyed);
    assert!(next_hit.killed);
}

#[test]
fn no_destroy_and_no_durability_flags_have_distinct_effects() {
    let mut context = damage(20, DamageType::Bullet);
    let mut item = armor(4, 1);
    item.no_destroy = true;
    context.target_armor = Some(item);
    let wear = resolve_damage(context).unwrap().armor.unwrap();
    assert_eq!(wear.after.durability, 0);
    assert!(!wear.destroyed);
    item.no_durability = true;
    context.target_armor = Some(item);
    let wear = resolve_damage(context).unwrap().armor.unwrap();
    assert_eq!(wear.after.durability, 1);
    assert_eq!(wear.durability_damage, 0);
}

#[test]
fn hardy_requests_one_supplied_coin_only_for_damage_at_or_below_effective_armor() {
    let mut context = damage(3, DamageType::Bullet);
    context.target_armor = Some(armor(4, 100));
    context.hardy = true;
    assert!(needs_hardy_roll(context).unwrap());
    assert_eq!(resolve_damage(context), Err(RuleError::MissingHardyRoll));
    context.hardy_roll = Some(1);
    let outcome = resolve_damage(context).unwrap();
    assert_eq!(outcome.prevention, Some(DamagePrevention::Hardy));
    assert_eq!(outcome.armor.unwrap().durability_damage, 1);
    assert!(outcome.hardy_roll_used);
    context.hardy_roll = Some(0);
    assert_eq!(resolve_damage(context).unwrap().health_damage, 1);
    context.hardy_roll = Some(2);
    assert_eq!(resolve_damage(context), Err(RuleError::InvalidHardyRoll));
    context.damage = 5;
    context.hardy_roll = None;
    assert!(!needs_hardy_roll(context).unwrap());
    assert!(!resolve_damage(context).unwrap().hardy_roll_used);
}

#[test]
fn shield_and_initial_preventions_do_not_request_hardy_coin() {
    let mut context = damage(1, DamageType::Bullet);
    context.innate_armor = 100;
    context.hardy = true;
    let mut shield = armor(4, 100);
    shield.shield = true;
    context.target_armor = Some(shield);
    assert!(!needs_hardy_roll(context).unwrap());
    assert_eq!(
        resolve_damage(context).unwrap().prevention,
        Some(DamagePrevention::Shield)
    );
    context.target_armor = None;
    context.invulnerable = true;
    assert!(!needs_hardy_roll(context).unwrap());
}

#[test]
fn initial_preventions_leave_armor_and_health_untouched() {
    for reason in [
        DamagePrevention::NegativeDamage,
        DamagePrevention::Invulnerable,
        DamagePrevention::Dying,
        DamagePrevention::SelfImmune,
        DamagePrevention::Illusion,
    ] {
        let mut context = damage(10, DamageType::Bullet);
        context.target_armor = Some(armor(4, 100));
        match reason {
            DamagePrevention::NegativeDamage => context.damage = -1,
            DamagePrevention::Invulnerable => context.invulnerable = true,
            DamagePrevention::Dying => context.dying = true,
            DamagePrevention::SelfImmune => context.self_immune_equipped_source = true,
            DamagePrevention::Illusion => context.illusion_source = true,
            _ => unreachable!(),
        }
        let outcome = resolve_damage(context).unwrap();
        assert_eq!(outcome.prevention, Some(reason));
        assert_eq!(outcome.health_after, 50);
        assert!(outcome.armor.is_none());
    }
}

#[test]
fn overkill_thresholds_use_maximum_health_and_damage_type_not_current_health() {
    for (kind, threshold) in [
        (DamageType::Bullet, 20),
        (DamageType::Fire, 7),
        (DamageType::Acid, 10),
        (DamageType::Plasma, 10),
        (DamageType::Pierce, 10),
        (DamageType::SuperPlasma, 5),
    ] {
        let mut context = damage(threshold, kind);
        context.health = 1;
        context.maximum_health = 5;
        let outcome = resolve_damage(context).unwrap();
        assert_eq!(outcome.overkill_threshold, Some(threshold));
        assert!(outcome.killed && outcome.overkill);
        context.damage = threshold - 1;
        assert!(!resolve_damage(context).unwrap().overkill);
    }
}

#[test]
fn gib_multiplier_rounds_threshold_and_forced_overkill_requires_death() {
    let mut context = damage(4, DamageType::Fire);
    context.maximum_health = 5;
    context.health = 1;
    context.gib_multiplier = 2.0;
    let outcome = resolve_damage(context).unwrap();
    assert_eq!(outcome.overkill_threshold, Some(4)); // Round((5 + 5 div 2) / 2).
    assert!(outcome.overkill);
    context.gib_multiplier = 10.0;
    context.damage = 1;
    assert!(resolve_damage(context).unwrap().overkill);
    context.health = 2;
    assert!(!resolve_damage(context).unwrap().overkill);
}

#[test]
fn movement_multiplies_equipment_bonus_and_current_cell_in_source_order() {
    let context = MoveCostContext {
        move_time: 100,
        equipment_move_modifiers: &[-20, 10],
        move_bonus: 10,
        flying: false,
        current_cell_move_cost: 1.5,
    };
    assert_eq!(movement_cost(context), Ok(1458));
    assert_eq!(
        movement_cost(MoveCostContext {
            flying: true,
            ..context
        }),
        Ok(972)
    );
    let ordinary = MoveCostContext {
        equipment_move_modifiers: &[],
        move_bonus: 0,
        current_cell_move_cost: 1.0,
        ..context
    };
    assert_eq!(movement_cost(ordinary), Ok(1000));
    assert_eq!(
        movement_cost(MoveCostContext {
            move_bonus: 100,
            ..ordinary
        }),
        Ok(0)
    );
}

#[test]
fn single_result_before_round_preserves_a_half_tie_at_small_action_cost() {
    // Integer * Single is Single in FPC. Promoting the 0.0055f32 modifier to
    // Double before multiplying by 1000 incorrectly changes this from 6 to 5.
    let context = MoveCostContext {
        move_time: 1,
        equipment_move_modifiers: &[45],
        move_bonus: 0,
        flying: false,
        current_cell_move_cost: 1.0,
    };
    assert_eq!(movement_cost(context), Ok(6));
    assert_eq!(shot_cost(1000, 1, Some(0.0055)), Ok(6));
}

#[test]
fn weapon_fire_cost_uses_tenths_of_seconds() {
    assert_eq!(fire_cost(fire(10)), Ok(1000));
    assert_eq!(fire_cost(fire(6)), Ok(600));
    assert_eq!(fire_cost(fire(15)), Ok(1500));
    assert_eq!(
        fire_cost(FireCostContext {
            fire_time: 80,
            ..fire(10)
        }),
        Ok(800)
    );
    assert_eq!(
        fire_cost(FireCostContext {
            fire_cost_bonus: 20,
            ..fire(10)
        }),
        Ok(800)
    );
}

#[test]
fn fire_floor_precedes_hook_multipliers_and_non_melee_weapon_becomes_unarmed() {
    let context = FireCostContext {
        fire_cost_bonus: 200,
        being_fire_cost_multiplier: 0.5,
        ..fire(1)
    };
    assert_eq!(fire_cost(context), Ok(50));
    let mut melee = FireCostContext {
        melee: true,
        ..fire(20)
    };
    assert_eq!(fire_cost(melee), Ok(1000));
    melee.weapon.as_mut().unwrap().melee = true;
    assert_eq!(fire_cost(melee), Ok(2000));
    melee.weapon = None;
    assert_eq!(fire_cost(melee), Ok(1000));
}

#[test]
fn dual_fire_averages_rounded_costs_then_truncates_integer_division() {
    let primary = FireCostContext {
        fire_cost_bonus: 1,
        ..fire(11)
    };
    let secondary = fire(10);
    assert_eq!(fire_cost(primary), Ok(1089));
    assert_eq!(dual_fire_cost(primary, secondary), Ok(1044));
}

#[test]
fn reload_has_no_fire_style_minimum_and_missing_or_melee_weapon_costs_1000() {
    let weapon = ReloadWeapon {
        melee: false,
        reload_time: 12,
        reload_cost_multiplier: 1.0,
    };
    assert_eq!(reload_cost(Some(weapon), 100, 1.0), Ok(1200));
    assert_eq!(reload_cost(Some(weapon), 80, 0.5), Ok(480));
    assert_eq!(reload_cost(Some(weapon), 100, 0.0), Ok(0));
    assert_eq!(reload_cost(None, 1, 0.0), Ok(1000));
    assert_eq!(
        reload_cost(
            Some(ReloadWeapon {
                melee: true,
                ..weapon
            }),
            1,
            0.0
        ),
        Ok(1000)
    );
    assert_eq!(use_or_wear_cost(80, None), 800);
    assert_eq!(use_or_wear_cost(80, Some(7)), 560);
}

#[test]
fn normal_reload_crosses_exhausted_stacks_without_spending_cost_twice() {
    let supplies = [
        AmmoSupply {
            amount: 3,
            pack: false,
        },
        AmmoSupply {
            amount: 10,
            pack: false,
        },
        AmmoSupply {
            amount: 100,
            pack: false,
        },
    ];
    let outcome = reload_transfer(2, 10, false, false, 1200, &supplies).unwrap();
    assert_eq!(outcome.ammo_after, 10);
    assert_eq!(outcome.consumed, vec![3, 5, 0]);
    assert_eq!(outcome.action_cost, 1200);
    let outcome = reload_transfer(2, 10, true, false, 1200, &supplies).unwrap();
    assert_eq!(outcome.ammo_after, 3);
    assert_eq!(outcome.consumed, vec![1, 0, 0]);
    assert_eq!(outcome.action_cost, 1200);
}

#[test]
fn pack_reload_spends_one_fifth_and_never_continues_to_later_stack() {
    let supplies = [
        AmmoSupply {
            amount: 3,
            pack: true,
        },
        AmmoSupply {
            amount: 100,
            pack: false,
        },
    ];
    let outcome = reload_transfer(2, 10, false, false, 1004, &supplies).unwrap();
    assert_eq!(outcome.ammo_after, 5);
    assert_eq!(outcome.consumed, vec![3, 0]);
    assert_eq!(outcome.action_cost, 200);
    let automatic = reload_transfer(2, 10, false, true, 1004, &[]).unwrap();
    assert_eq!((automatic.ammo_after, automatic.action_cost), (10, 1004));
    assert_eq!(
        reload_transfer(2, 10, false, false, 1000, &[]),
        Err(RuleError::MissingAmmo)
    );
    assert_eq!(
        reload_transfer(11, 10, false, false, 1000, &supplies),
        Err(RuleError::InvalidAmmo)
    );
}

#[test]
fn ammo_multiplier_applies_to_total_only_for_a_being_owned_weapon() {
    assert_eq!(shot_cost(2, 3, Some(0.5)), Ok(3));
    assert_eq!(shot_cost(2, 3, None), Ok(2));
    assert_eq!(shot_cost(0, 0, Some(0.0)), Ok(1));
    assert_eq!(shot_cost(1, 5, Some(0.5)), Ok(2));
    assert_eq!(shot_cost(1, 7, Some(0.5)), Ok(4));
}

#[test]
fn knockback_equipment_modifiers_multiply_rather_than_add() {
    assert_eq!(equipment_knock_modifier(&[]), Ok(100));
    assert_eq!(equipment_knock_modifier(&[-50, -50]), Ok(25));
    assert_eq!(equipment_knock_modifier(&[-50, 50]), Ok(75));
    assert_eq!(equipment_knock_modifier(&[-100, 50]), Ok(0));
}

#[test]
fn knockback_floors_after_equipment_then_subtracts_body_bonus() {
    let context = KnockbackContext {
        strength: 5.9,
        direction_code_nonzero: true,
        immune: false,
        equipment_modifier: 50,
        body_bonus: 1,
    };
    assert_eq!(knockback_strength(context), Ok(1));
    assert_eq!(
        knockback_strength(KnockbackContext {
            body_bonus: 3,
            ..context
        }),
        Ok(0)
    );
    assert_eq!(
        knockback_strength(KnockbackContext {
            immune: true,
            ..context
        }),
        Ok(0)
    );
    assert_eq!(
        knockback_strength(KnockbackContext {
            direction_code_nonzero: false,
            ..context
        }),
        Ok(0)
    );
    assert_eq!(
        knockback_strength(KnockbackContext {
            strength: 0.0,
            ..context
        }),
        Ok(0)
    );
    assert_eq!(knockback_distance(4, &[true, true, false, true]), 2);
    assert_eq!(knockback_distance(1, &[true, true]), 1);
    assert_eq!(knockback_distance(3, &[false, true, true]), 0);
}

#[test]
fn percentage_modifier_and_three_d6_extremes_preserve_upstream_rules() {
    assert_eq!(apply_percentage_modifier(5, 50), Ok(8));
    assert_eq!(apply_percentage_modifier(3, 50), Ok(4));
    assert_eq!(apply_percentage_modifier(i32::MAX, 0), Ok(i32::MAX));
    for (sum, expected) in [(3, 30), (4, 20), (17, -20), (18, -30)] {
        assert_eq!(roll_check_from_sum(-100, sum), Ok(expected));
        assert_eq!(roll_check_from_sum(100, sum), Ok(expected));
    }
    assert_eq!(roll_check_from_sum(10, 10), Ok(0));
    assert_eq!(roll_check_from_sum(10, 11), Ok(-1));
    assert_eq!(roll_check_from_sum(10, 2), Err(RuleError::InvalidDice));
    assert_eq!(dice_total(6, &[1, 6, 3], 2), Ok(12));
    assert_eq!(dice_total(0, &[], 2), Ok(2));
    assert_eq!(dice_total(1, &[1, 1, 1], 2), Ok(5));
    assert_eq!(dice_total(6, &[7], 0), Err(RuleError::InvalidDice));
}

#[test]
fn resistance_keys_and_enum_order_match_lua_constants() {
    assert_eq!(BodyTarget::Internal as u8, 0);
    assert_eq!(BodyTarget::Feet as u8, 2);
    assert_eq!(DamageType::IgnoreArmor as u8, 10);
    assert_eq!(DamageType::Shrapnel.resistance_key(), Some("shrapnel"));
    assert_eq!(DamageType::Plasma.resistance_key(), Some("plasma"));
    assert_eq!(DamageType::SuperPlasma.resistance_key(), Some("plasma"));
    assert_eq!(DamageType::IgnoreArmor.resistance_key(), None);
}
