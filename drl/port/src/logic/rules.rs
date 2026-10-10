// SPDX-License-Identifier: GPL-2.0-only
//! Pure, incremental ports of DRL 0.10.11a numeric rules.
//!
//! Source: chaosforgeorg/doomrl a6f965072b3a25b768c91dbced00367f1b57d865.
//! Hook bonuses and random outcomes are supplied by the caller. This module does
//! not implement hook orchestration, map mutation, or the full game. It never
//! accesses rendering, browser APIs, clocks, or RNG. The damage helper covers
//! numeric effects when the intervening armor hook does not mutate relevant state.
//!
//! `Single` variables retain an explicit f32 assignment at each source assignment;
//! `Real` calculations use f64 for the Windows 64-bit source target. Round uses
//! ties-to-even, not Rust's `round` (which rounds ties away from zero). Native
//! Pascal differential verification remains a separate migration gate.

use std::error::Error;
use std::fmt;

/// Action cost constants from dfdata.pas:281–283.
pub const ACTION_COST: i32 = 1000;

/// A rejected numeric input; valid upstream states are never silently clamped.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuleError {
    NonFinite,
    Overflow,
    InvalidDurability,
    InvalidHealth,
    InvalidDice,
    InvalidAmmo,
    MissingAmmo,
    MissingHardyRoll,
    InvalidHardyRoll,
}

impl fmt::Display for RuleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::NonFinite => "non-finite numeric rule input",
            Self::Overflow => "numeric rule result exceeds the source integer range",
            Self::InvalidDurability => "durability is outside the upstream 0..1000 range",
            Self::InvalidHealth => "health must be nonnegative and maximum health positive",
            Self::InvalidDice => "dice values do not match the supplied dice definition",
            Self::InvalidAmmo => "weapon ammo exceeds its capacity",
            Self::MissingAmmo => "a non-automatic reload needs an ammo source",
            Self::MissingHardyRoll => "the hardy rule requires one supplied RLongInt(2) result",
            Self::InvalidHardyRoll => "hardy roll must be zero or one",
        })
    }
}

impl Error for RuleError {}

fn integer(value: i64) -> Result<i32, RuleError> {
    i32::try_from(value).map_err(|_| RuleError::Overflow)
}

fn finite(value: f64) -> Result<f64, RuleError> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(RuleError::NonFinite)
    }
}

fn single(value: f64) -> Result<f32, RuleError> {
    let value = finite(value)? as f32;
    if value.is_finite() {
        Ok(value)
    } else {
        Err(RuleError::Overflow)
    }
}

/// Free Pascal Round semantics under its default nearest rounding mode.
///
/// Returns an error for non-finite values or results outside signed LongInt.
pub fn pascal_round(value: f64) -> Result<i32, RuleError> {
    let value = finite(value)?.round_ties_even();
    if value < f64::from(i32::MIN) || value > f64::from(i32::MAX) {
        return Err(RuleError::Overflow);
    }
    // The range check above makes this narrowing conversion explicit and safe.
    Ok(value as i32)
}

/// Body targets retain dfdata.pas:126's upstream order.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum BodyTarget {
    Internal,
    Torso,
    Feet,
}

/// Damage types retain dfdata.pas:129's upstream order (including its spelling).
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum DamageType {
    Bullet,
    Melee,
    Pierce,
    Shrapnel,
    Acid,
    Fire,
    Cold,
    Poison,
    Plasma,
    SuperPlasma,
    IgnoreArmor,
}

impl DamageType {
    /// Lua resistance property used by dfbeing.pas:2167–2178.
    pub const fn resistance_key(self) -> Option<&'static str> {
        match self {
            Self::Bullet => Some("bullet"),
            Self::Melee => Some("melee"),
            Self::Pierce => Some("pierce"),
            Self::Shrapnel => Some("shrapnel"),
            Self::Acid => Some("acid"),
            Self::Fire => Some("fire"),
            Self::Cold => Some("cold"),
            Self::Poison => Some("poison"),
            Self::Plasma | Self::SuperPlasma => Some("plasma"),
            Self::IgnoreArmor => None,
        }
    }
}

/// Only armor and boots use the durability protection bands.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DefenseKind {
    Armor,
    Boots,
    Other,
}

/// One item's numeric defense state; no names or user-facing text are stored here.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ItemDefense {
    pub kind: DefenseKind,
    pub armor: i32,
    pub durability: u16,
    pub no_degrade: bool,
    pub shield: bool,
    pub no_durability: bool,
    pub no_destroy: bool,
}

impl ItemDefense {
    fn validate(self) -> Result<(), RuleError> {
        if self.durability > 1000 {
            Err(RuleError::InvalidDurability)
        } else {
            Ok(())
        }
    }
}

/// TItem.GetProtection, dfitem.pas:300–313.
pub fn item_protection(item: ItemDefense) -> Result<i32, RuleError> {
    item.validate()?;
    if item.armor == 0 || item.no_degrade || item.kind == DefenseKind::Other {
        return Ok(item.armor);
    }
    Ok(match item.durability {
        0 => 0,
        1..=25 => (item.armor / 4).max(1),
        26..=49 => (item.armor / 2).max(1),
        _ => item.armor,
    })
}

/// TItem.GetResistance, dfitem.pas:315–331.
///
/// Negative resistance stays negative at every durability. Upstream's Ceil is
/// applied after integer div, so 15 resistance at 25 durability becomes 3, not 4.
pub fn item_resistance(item: ItemDefense, resistance: i32) -> Result<i32, RuleError> {
    item.validate()?;
    if resistance <= 0 {
        return Ok(resistance);
    }
    if item.shield && item.durability == 0 {
        return Ok(0);
    }
    if item.no_degrade || item.kind == DefenseKind::Other {
        return Ok(resistance);
    }
    Ok(match item.durability {
        0 => 0,
        1..=25 => (resistance / 4).max(1),
        26..=49 => (resistance / 2).max(1),
        _ => resistance,
    })
}

/// Inputs to TBeing.getTotalResistance after item durability and Lua hooks.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ResistanceContext {
    pub target: BodyTarget,
    pub player: bool,
    pub cap: i32,
    pub innate: i32,
    pub weapon: i32,
    pub target_equipment: i32,
    pub bonus: i32,
}

/// TBeing.getTotalResistance, dfbeing.pas:2081–2109, including early exits.
pub fn total_resistance(context: ResistanceContext) -> Result<i32, RuleError> {
    if context.innate >= 100 {
        return Ok(100);
    }
    let innate = if context.player && context.target != BodyTarget::Feet {
        context.innate.min(context.cap)
    } else {
        context.innate
    };
    if context.target == BodyTarget::Internal {
        return Ok(innate);
    }
    if context.weapon >= 100 {
        return Ok(100);
    }
    if context.target_equipment >= 100 {
        return Ok(100);
    }
    let combined = i64::from(innate)
        + i64::from(context.weapon)
        + i64::from(context.target_equipment)
        + i64::from(context.bonus);
    integer(combined.min(i64::from(context.cap)))
}

/// Inputs to ApplyDamage's numeric section after attacker/being receive hooks.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DamageContext {
    pub damage: i32,
    pub damage_type: DamageType,
    pub health: i32,
    pub maximum_health: i32,
    pub innate_armor: i32,
    /// Upstream reads weapon.Armor directly, without durability reduction.
    pub weapon_armor: i32,
    pub resistance: i32,
    /// Only torso armor or boots; Internal damage supplies None.
    pub target_armor: Option<ItemDefense>,
    pub invulnerable: bool,
    pub dying: bool,
    pub self_immune_equipped_source: bool,
    pub illusion_source: bool,
    pub hardy: bool,
    /// Supplied RLongInt(2), requested only when `needs_hardy_roll` is true.
    pub hardy_roll: Option<u8>,
    /// Product of the active being and source item's post-hook gib multipliers.
    pub gib_multiplier: f32,
}

/// Why health damage stopped. Armor may already have taken damage.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DamagePrevention {
    NegativeDamage,
    Invulnerable,
    Dying,
    SelfImmune,
    Illusion,
    Shield,
    Resistance,
    Hardy,
}

/// All numeric effects on one armor item, in upstream operation order.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ArmorDamage {
    pub before: ItemDefense,
    pub after: ItemDefense,
    pub durability_damage: i32,
    pub protection_before: i32,
    pub protection_after: i32,
    pub destroyed: bool,
}

/// Result of the pure damage calculation; application code applies these effects.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DamageOutcome {
    pub damage_after_resistance: i32,
    pub effective_armor: i32,
    pub armor: Option<ArmorDamage>,
    pub health_damage: i32,
    pub health_after: i32,
    pub killed: bool,
    pub overkill: bool,
    pub overkill_threshold: Option<i32>,
    pub prevention: Option<DamagePrevention>,
    pub hardy_roll_used: bool,
}

fn initial_prevention(context: DamageContext) -> Option<DamagePrevention> {
    if context.damage < 0 {
        Some(DamagePrevention::NegativeDamage)
    } else if context.invulnerable {
        Some(DamagePrevention::Invulnerable)
    } else if context.dying {
        Some(DamagePrevention::Dying)
    } else if context.self_immune_equipped_source {
        Some(DamagePrevention::SelfImmune)
    } else if context.illusion_source {
        Some(DamagePrevention::Illusion)
    } else {
        None
    }
}

fn resisted_damage(context: DamageContext) -> Result<(i32, i32), RuleError> {
    let resistance = if context.damage_type == DamageType::IgnoreArmor {
        0
    } else {
        context.resistance
    };
    let damage = if resistance >= 100 {
        0
    } else if resistance != 0 {
        pascal_round(f64::from(context.damage) * ((100.0 - f64::from(resistance)) / 100.0))?.max(1)
    } else {
        context.damage
    };
    Ok((damage, resistance))
}

fn effective_armor(context: DamageContext) -> Result<i32, RuleError> {
    let protection = context
        .target_armor
        .map(item_protection)
        .transpose()?
        .unwrap_or(0);
    let armor = integer(
        i64::from(context.innate_armor) + i64::from(context.weapon_armor) + i64::from(protection),
    )?;
    match context.damage_type {
        DamageType::Shrapnel => integer(i64::from(armor) * 2),
        DamageType::Plasma | DamageType::Pierce => Ok(armor / 2),
        DamageType::SuperPlasma => Ok(armor / 3),
        _ => Ok(armor),
    }
}

/// True exactly when ApplyDamage would consume RLongInt(2), after armor damage.
///
/// A shield with positive prior durability exits before the hardy branch.
pub fn needs_hardy_roll(context: DamageContext) -> Result<bool, RuleError> {
    if initial_prevention(context).is_some() {
        return Ok(false);
    }
    let (damage, resistance) = resisted_damage(context)?;
    if resistance >= 100 || context.damage_type == DamageType::IgnoreArmor || !context.hardy {
        return Ok(false);
    }
    if context
        .target_armor
        .is_some_and(|armor| armor.shield && armor.durability > 0)
    {
        return Ok(false);
    }
    Ok(damage <= effective_armor(context)?)
}

/// Numeric ApplyDamage, dfbeing.pas:2111–2305.
///
/// Hooks, messages, blood, death orchestration, and inventory mutation belong to
/// the application layer. Hook-triggered state changes must be reflected in the
/// supplied context. The intervening armor OnReceiveDamage hook is not executed
/// here: this helper assumes it does not change armor flags/durability or the
/// being's relevant state. Such items need staged application integration before
/// this result can be applied. Immunity still damages armor and IgnoreArmor still
/// damages durability in this upstream version.
pub fn resolve_damage(context: DamageContext) -> Result<DamageOutcome, RuleError> {
    if context.health < 0 || context.maximum_health <= 0 {
        return Err(RuleError::InvalidHealth);
    }
    finite(f64::from(context.gib_multiplier))?;
    let mut outcome = DamageOutcome {
        damage_after_resistance: context.damage,
        effective_armor: 0,
        armor: None,
        health_damage: 0,
        health_after: context.health,
        killed: false,
        overkill: false,
        overkill_threshold: None,
        prevention: initial_prevention(context),
        hardy_roll_used: false,
    };
    if outcome.prevention.is_some() {
        return Ok(outcome);
    }
    let (damage, resistance) = resisted_damage(context)?;
    outcome.damage_after_resistance = damage;

    if let Some(before) = context.target_armor {
        let protection_before = item_protection(before)?;
        let mut durability_damage =
            integer((i64::from(damage) - i64::from(protection_before)).max(1))?;
        if context.damage_type == DamageType::Acid && resistance < 100 {
            durability_damage = integer(i64::from(durability_damage) * 2)?;
        }
        if before.no_durability {
            durability_damage = 0;
        }
        let mut after = before;
        after.durability =
            u16::try_from((i64::from(before.durability) - i64::from(durability_damage)).max(0))
                .map_err(|_| RuleError::Overflow)?;
        let shield_absorbs = before.shield && before.durability > 0;
        outcome.armor = Some(ArmorDamage {
            before,
            after,
            durability_damage,
            protection_before,
            protection_after: item_protection(after)?,
            // The shield early return occurs before the destroy check.
            destroyed: !shield_absorbs && after.durability == 0 && !before.no_destroy,
        });
        if shield_absorbs {
            outcome.prevention = Some(DamagePrevention::Shield);
            return Ok(outcome);
        }
    }
    if resistance >= 100 {
        outcome.prevention = Some(DamagePrevention::Resistance);
        return Ok(outcome);
    }
    outcome.effective_armor = effective_armor(context)?;
    if context.damage_type != DamageType::IgnoreArmor {
        if needs_hardy_roll(context)? {
            outcome.hardy_roll_used = true;
            match context.hardy_roll {
                None => return Err(RuleError::MissingHardyRoll),
                Some(1) => {
                    outcome.prevention = Some(DamagePrevention::Hardy);
                    return Ok(outcome);
                }
                Some(0) => (),
                Some(_) => return Err(RuleError::InvalidHardyRoll),
            }
        }
        outcome.health_damage =
            integer((i64::from(damage) - i64::from(outcome.effective_armor)).max(1))?;
    } else {
        outcome.health_damage = damage;
    }
    let mut threshold = match context.damage_type {
        DamageType::Fire => {
            integer(i64::from(context.maximum_health) + i64::from(context.maximum_health / 2))?
        }
        DamageType::Acid | DamageType::Plasma | DamageType::Pierce => {
            integer(i64::from(context.maximum_health) * 2)?
        }
        DamageType::SuperPlasma => context.maximum_health,
        _ => integer(i64::from(context.maximum_health) * 4)?,
    };
    let forced_overkill = context.gib_multiplier >= 10.0;
    if !forced_overkill && context.gib_multiplier > 1.0 {
        let dividend = single(f64::from(threshold))?;
        threshold = pascal_round(f64::from(single(
            f64::from(dividend) / f64::from(context.gib_multiplier),
        )?))?
        .max(1);
    }
    outcome.overkill_threshold = Some(threshold);
    outcome.health_after =
        integer((i64::from(context.health) - i64::from(outcome.health_damage)).max(0))?;
    outcome.killed = outcome.health_after == 0;
    outcome.overkill = outcome.killed && (outcome.health_damage >= threshold || forced_overkill);
    Ok(outcome)
}

/// Inputs to getMoveCost. Equipment modifiers follow TEqSlot iteration order.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MoveCostContext<'a> {
    pub move_time: u8,
    pub equipment_move_modifiers: &'a [i32],
    pub move_bonus: i32,
    pub flying: bool,
    /// Source uses the being's current cell, rather than the destination cell.
    pub current_cell_move_cost: f32,
}

/// TBeing.getMoveCost, dfbeing.pas:2717–2734.
pub fn movement_cost(context: MoveCostContext<'_>) -> Result<i32, RuleError> {
    let mut modifier = single(f64::from(context.move_time) / 100.0)?;
    for &equipment in context.equipment_move_modifiers {
        if equipment != 0 {
            modifier = single(f64::from(modifier) * ((100.0 - f64::from(equipment)) / 100.0))?;
        }
    }
    if context.move_bonus != 0 {
        modifier = single(f64::from(modifier) * ((100.0 - f64::from(context.move_bonus)) / 100.0))?;
    }
    if !context.flying {
        modifier = single(f64::from(modifier) * f64::from(context.current_cell_move_cost))?;
    }
    // Integer * Single has a Single result before Round promotes its argument.
    pascal_round(f64::from(single(
        f64::from(ACTION_COST) * f64::from(modifier),
    )?))
}

/// Selected weapon data for one firing-cost evaluation.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FireWeapon {
    pub melee: bool,
    pub use_time: u8,
    pub fire_cost_multiplier: f32,
}

/// Bonuses must be evaluated using the final weapon (including unarmed melee).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FireCostContext {
    pub fire_time: u8,
    pub melee: bool,
    pub weapon: Option<FireWeapon>,
    pub fire_cost_bonus: i32,
    pub being_fire_cost_multiplier: f32,
}

/// TBeing.getFireCost's nested getWeaponFireCost, dfbeing.pas:2740–2752.
///
/// The 0.1 floor precedes the hook multipliers; hooks may lower cost below 100.
pub fn fire_cost(context: FireCostContext) -> Result<i32, RuleError> {
    let weapon = context
        .weapon
        .filter(|weapon| !context.melee || weapon.melee);
    let mut modifier = f32::from(weapon.map_or(10, |weapon| weapon.use_time));
    modifier = single(f64::from(modifier) * (f64::from(context.fire_time) / 1000.0))?;
    if context.fire_cost_bonus != 0 {
        modifier = single(
            f64::from(modifier) * ((100.0 - f64::from(context.fire_cost_bonus)) / 100.0).max(0.1),
        )?;
    }
    modifier = modifier.max(0.1);
    modifier = single(f64::from(modifier) * f64::from(context.being_fire_cost_multiplier))?;
    if let Some(weapon) = weapon {
        modifier = single(f64::from(modifier) * f64::from(weapon.fire_cost_multiplier))?;
    }
    pascal_round(f64::from(single(
        f64::from(ACTION_COST) * f64::from(modifier),
    )?))
}

/// Dual fire averages already rounded individual costs with integer div.
///
/// Call only after upstream canDualWield/canDualWieldMelee and secondary ammo
/// checks, and never when a weapon override is in effect (dfbeing.pas:2754–2759).
pub fn dual_fire_cost(
    primary: FireCostContext,
    secondary: FireCostContext,
) -> Result<i32, RuleError> {
    integer((i64::from(fire_cost(primary)?) + i64::from(fire_cost(secondary)?)) / 2)
}

/// Selected weapon inputs for reload cost.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ReloadWeapon {
    pub melee: bool,
    pub reload_time: u8,
    pub reload_cost_multiplier: f32,
}

/// TBeing.getReloadCost, dfbeing.pas:2762–2771. No minimum-cost clamp is present.
pub fn reload_cost(
    weapon: Option<ReloadWeapon>,
    reload_time: u8,
    being_multiplier: f32,
) -> Result<i32, RuleError> {
    let Some(weapon) = weapon.filter(|weapon| !weapon.melee) else {
        return Ok(ACTION_COST);
    };
    let mut modifier = f64::from(weapon.reload_time) / 10.0;
    modifier *= f64::from(reload_time) / 100.0;
    // Both GetBonusMul functions return Single, so their product is Single.
    let hook_product =
        single(f64::from(being_multiplier) * f64::from(weapon.reload_cost_multiplier))?;
    modifier *= f64::from(hook_product);
    pascal_round(f64::from(ACTION_COST) * modifier)
}

/// One selected stack or ammo pack. Later stacks represent FInv.SeekStack order.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AmmoSupply {
    pub amount: u32,
    pub pack: bool,
}

/// Numeric result of Reload; application code performs destruction and messages.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReloadOutcome {
    pub ammo_after: u8,
    pub action_cost: i32,
    /// Amount consumed from each supply, in order. Zero means unvisited.
    pub consumed: Vec<u32>,
}

/// Ammo transfer and pack cost from TBeing.Reload, dfbeing.pas:1407–1458.
///
/// A normal reload can span exhausted stacks, spending its cost once. A pack
/// costs `reload_cost div 5` and never continues into a later stack. Preconditions
/// such as manually reloadable/ranged/full checks stay in ActionReload.
pub fn reload_transfer(
    ammo: u8,
    capacity: u8,
    single_round: bool,
    automatic: bool,
    cost: i32,
    supplies: &[AmmoSupply],
) -> Result<ReloadOutcome, RuleError> {
    if ammo > capacity || (single_round && !automatic && ammo == capacity) {
        return Err(RuleError::InvalidAmmo);
    }
    let mut outcome = ReloadOutcome {
        ammo_after: ammo,
        action_cost: cost,
        consumed: vec![0; supplies.len()],
    };
    if automatic {
        outcome.ammo_after = capacity;
        return Ok(outcome);
    }
    if supplies.is_empty() {
        return Err(RuleError::MissingAmmo);
    }
    for (index, supply) in supplies.iter().enumerate() {
        let space = if single_round {
            1
        } else {
            u32::from(capacity - outcome.ammo_after)
        };
        let transfer = supply.amount.min(space);
        outcome.consumed[index] = transfer;
        outcome.ammo_after = u8::try_from(u32::from(outcome.ammo_after) + transfer)
            .map_err(|_| RuleError::Overflow)?;
        outcome.action_cost = if supply.pack { cost / 5 } else { cost };
        if supply.pack || single_round || outcome.ammo_after == capacity || transfer < supply.amount
        {
            break;
        }
    }
    Ok(outcome)
}

/// TBeing.getUseCost/getWearCost: being time times item time, default item time 10.
pub fn use_or_wear_cost(being_time: u8, item_time: Option<u8>) -> i32 {
    i32::from(being_time) * i32::from(item_time.unwrap_or(10))
}

/// TItem.getShotCost, dfitem.pas:627–634.
///
/// Without a being parent, upstream ignores both aShots and the hook multiplier.
/// A being-owned weapon receives a minimum *total* cost of 1, even with 0 shots.
pub fn shot_cost(
    base_cost: i32,
    shots: i32,
    being_ammo_multiplier: Option<f32>,
) -> Result<i32, RuleError> {
    let base = base_cost.max(1);
    if let Some(multiplier) = being_ammo_multiplier {
        let product = integer(i64::from(shots) * i64::from(base))?;
        let product = single(f64::from(product))?;
        Ok(pascal_round(f64::from(single(
            f64::from(product) * f64::from(multiplier),
        )?))?
        .max(1))
    } else {
        Ok(base)
    }
}

/// TBeing.getKnockMod, dfbeing.pas:2796–2807; modifiers multiply, not add.
pub fn equipment_knock_modifier(equipment_modifiers: &[i32]) -> Result<i32, RuleError> {
    let mut modifier = 100.0;
    for &equipment in equipment_modifiers {
        if equipment != 0 {
            modifier *= (100.0 + f64::from(equipment)) / 100.0;
        }
    }
    pascal_round(modifier)
}

/// Inputs to the distance calculation in Knockback, before map collision checks.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct KnockbackContext {
    pub strength: f32,
    /// Upstream specifically tests direction.code != 0, not a nonzero vector.
    pub direction_code_nonzero: bool,
    pub immune: bool,
    pub equipment_modifier: i32,
    pub body_bonus: i32,
}

/// TBeing.Knockback, dfbeing.pas:2680–2689; floor precedes body bonus subtraction.
pub fn knockback_strength(context: KnockbackContext) -> Result<i32, RuleError> {
    finite(f64::from(context.strength))?;
    if context.strength <= 0.0 || !context.direction_code_nonzero || context.immune {
        return Ok(0);
    }
    let scaled =
        single(f64::from(context.strength) * (f64::from(context.equipment_modifier) / 100.0))?;
    let floored = finite(f64::from(scaled))?.floor();
    if floored < f64::from(i32::MIN) || floored > f64::from(i32::MAX) {
        return Err(RuleError::Overflow);
    }
    Ok(integer(i64::from(floored as i32) - i64::from(context.body_bonus))?.max(0))
}

/// Collision-limited distance from precomputed map emptiness, nearest cell first.
///
/// The caller computes EF_NOBEINGS + EF_NOBLOCK/EF_NOBLOCKFLY for each cell. An
/// omitted cell is treated as the end of the known path, never as empty space.
pub fn knockback_distance(strength: i32, empty_cells: &[bool]) -> usize {
    empty_cells
        .iter()
        .take(usize::try_from(strength.max(0)).unwrap_or(0))
        .take_while(|&&empty| empty)
        .count()
}

/// ApplyMul, dfdata.pas:754–758; percentage bonus 0 is an exact fast path.
pub fn apply_percentage_modifier(base: i32, modifier: i32) -> Result<i32, RuleError> {
    if modifier == 0 {
        return Ok(base);
    }
    pascal_round(((100.0 + f64::from(modifier)) / 100.0) * f64::from(base))
}

/// Roll, dfdata.pas:741–751. 3, 4, 17 and 18 override the input statistic.
pub fn roll_check_from_sum(statistic: i32, three_d6_sum: u8) -> Result<i32, RuleError> {
    match three_d6_sum {
        3 => Ok(30),
        4 => Ok(20),
        17 => Ok(-20),
        18 => Ok(-30),
        5..=16 => integer(i64::from(statistic) - i64::from(three_d6_sum)),
        _ => Err(RuleError::InvalidDice),
    }
}

/// Pure TDiceRoll.Roll evaluation from already supplied die results.
///
/// Valkyrie vrltools.pas:1102–1105 adds the bonus to RNG.Dice(count, sides).
/// The RNG consumes RDWord(sides) + 1 per die, except sides 0 or 1, which
/// consume no RNG (vrandom.pas:182–190). An empty zero-sided roll adds only bonus.
pub fn dice_total(sides: u8, rolls: &[u8], bonus: i32) -> Result<i32, RuleError> {
    if (sides == 0 && !rolls.is_empty()) || rolls.iter().any(|&roll| roll == 0 || roll > sides) {
        return Err(RuleError::InvalidDice);
    }
    let sum = rolls
        .iter()
        .try_fold(i64::from(bonus), |sum, &roll| {
            sum.checked_add(i64::from(roll))
        })
        .ok_or(RuleError::Overflow)?;
    integer(sum)
}
