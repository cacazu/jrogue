//! Deterministic damage arithmetic migrated from Cataclysm: DDA 0.I.
//!
//! Derived from upstream commit 7b2efa5cea38e4d4d97dd0e63b28b9148623da59,
//! licensed CC BY-SA 3.0. See `PROVENANCE.json` and `NOTICE.md`.
//! This is a bounded rules library, not a playable game or a complete combat port.

use std::collections::BTreeMap;

/// A data-defined damage type identifier; it does not contain translated text.
#[derive(Debug, Clone, Default, PartialEq, Eq, PartialOrd, Ord)]
pub struct DamageTypeId(pub String);

impl From<&str> for DamageTypeId {
    fn from(value: &str) -> Self {
        Self(value.to_owned())
    }
}

/// The one damage-type property needed by the migrated resistance query.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DamageTypeRegistry {
    no_resist: BTreeMap<DamageTypeId, bool>,
}

impl DamageTypeRegistry {
    /// Registers whether a valid, upstream-defined damage type bypasses resistance.
    pub fn set_no_resist(&mut self, id: DamageTypeId, no_resist: bool) {
        self.no_resist.insert(id, no_resist);
    }

    /// Returns the property for a registered type, or false when absent.
    #[must_use]
    pub fn no_resist(&self, id: &DamageTypeId) -> bool {
        self.no_resist.get(id).copied().unwrap_or(false)
    }
}

/// A barrel damage sample. Length interpretation/interpolation is not migrated.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BarrelDescriptor {
    /// Upstream length unit, millimetres.
    pub length_mm: i32,
    /// Damage at that length.
    pub amount: f32,
}

/// One typed damage component, retaining upstream single-precision arithmetic.
#[derive(Debug, Clone, PartialEq)]
pub struct DamageUnit {
    /// Data identifier of the damage type.
    pub damage_type: DamageTypeId,
    /// Damage before armor.
    pub amount: f32,
    /// Flat armor penetration.
    pub res_pen: f32,
    /// Armor multiplier.
    pub res_mult: f32,
    /// Damage multiplier applied after armor.
    pub damage_multiplier: f32,
    /// Unconditional armor multiplier.
    pub unconditional_res_mult: f32,
    /// Unconditional damage multiplier.
    pub unconditional_damage_mult: f32,
    /// Barrel descriptors retained by merge and relative operations.
    pub barrels: Vec<BarrelDescriptor>,
}

impl DamageUnit {
    /// Creates a unit with the defaults from `src/damage.h:117-135`.
    #[must_use]
    pub fn new(damage_type: DamageTypeId, amount: f32) -> Self {
        Self {
            damage_type,
            amount,
            res_pen: 0.0,
            res_mult: 1.0,
            damage_multiplier: 1.0,
            unconditional_res_mult: 1.0,
            unconditional_damage_mult: 1.0,
            barrels: Vec::new(),
        }
    }

    /// Reproduces upstream `damage_unit::operator==`, including its final-field
    /// typo and omission of barrel data. Use structural `PartialEq` for saves.
    /// Provenance: `src/damage.cpp:294-303`.
    #[must_use]
    pub fn legacy_equal(&self, other: &Self) -> bool {
        self.damage_type == other.damage_type
            && self.amount == other.amount
            && self.res_pen == other.res_pen
            && self.res_mult == other.res_mult
            && self.damage_multiplier == other.damage_multiplier
            && self.unconditional_res_mult == other.unconditional_res_mult
            && self.unconditional_damage_mult == other.unconditional_res_mult
    }

    /// Reproduces `damage_unit::operator*=` (`damage.cpp:541-545`).
    /// The f64 promotion and subsequent f32 rounding match C++ compound assignment.
    pub fn multiply_amount(&mut self, multiplier: f64) {
        self.amount = (f64::from(self.amount) * multiplier) as f32;
    }

    /// Reproduces `damage_unit::operator+=` (`damage.cpp:586-598`).
    /// Upstream intentionally leaves unconditional_res_mult unchanged here.
    pub fn add_relative(&mut self, other: &Self) {
        self.amount += other.amount;
        self.res_pen += other.res_pen;
        self.res_mult += other.res_mult;
        self.damage_multiplier += other.damage_multiplier;
        self.unconditional_damage_mult += other.unconditional_damage_mult;
        for barrel in &mut self.barrels {
            barrel.amount += other.amount;
        }
    }

    fn raw_damage(&self) -> f32 {
        self.amount * self.damage_multiplier * self.unconditional_damage_mult
    }
}

/// Diagnostic emitted by upstream's unsupported barrel merge branch.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MergeDiagnostic {
    /// A same-type merge received no new barrel definitions while old ones existed.
    UnsupportedBarrelDefinitions,
}

/// An ordered attack damage instance. No RNG, clock, rendering, or I/O is used.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct DamageInstance {
    /// Unit order remains identical to upstream's vector order.
    pub units: Vec<DamageUnit>,
}

impl DamageInstance {
    /// Adds a component, preserving same-type normalization and upstream quirks.
    /// Provenance: `src/damage.cpp:486-514`; lerp: `cata_utility.h:232-236`.
    pub fn add(&mut self, added: &DamageUnit) -> Option<MergeDiagnostic> {
        let Some(unit) = self
            .units
            .iter_mut()
            .find(|unit| unit.damage_type == added.damage_type)
        else {
            self.units.push(added.clone());
            return None;
        };
        let mult = added.damage_multiplier / unit.damage_multiplier;
        unit.amount += added.amount * mult;
        unit.res_pen += added.res_pen * mult;
        let t = added.damage_multiplier / (added.damage_multiplier + unit.damage_multiplier);
        // Preserve the upstream destination: added.damage_multiplier, not added.res_mult.
        unit.res_mult = (1.0_f32 - t) * unit.res_mult + t * added.damage_multiplier;
        unit.unconditional_res_mult *= added.unconditional_res_mult;
        unit.unconditional_damage_mult *= added.unconditional_damage_mult;
        if added.barrels.is_empty() {
            if unit.barrels.is_empty() {
                unit.barrels.clone_from(&added.barrels);
            } else {
                return Some(MergeDiagnostic::UnsupportedBarrelDefinitions);
            }
        }
        None
    }

    /// Adds every component in order (`damage.cpp:479-484`).
    pub fn add_instance(&mut self, other: &Self) -> Vec<MergeDiagnostic> {
        other
            .units
            .iter()
            .filter_map(|unit| self.add(unit))
            .collect()
    }

    /// Multiplies raw amounts or post-armor multipliers (`damage.cpp:318-333`).
    /// Zero and negative multipliers clear the instance, exactly as upstream.
    pub fn multiply_damage(&mut self, multiplier: f64, pre_armor: bool) {
        if multiplier <= 0.0 {
            self.clear();
        }
        for unit in &mut self.units {
            if pre_armor {
                unit.multiply_amount(multiplier);
            } else {
                unit.damage_multiplier = (f64::from(unit.damage_multiplier) * multiplier) as f32;
            }
        }
    }

    /// Multiplies post-armor multipliers for one type (`damage.cpp:335-342`).
    /// Unlike multiply_damage, a nonpositive multiplier does not clear units.
    pub fn multiply_type_damage(&mut self, multiplier: f64, id: &DamageTypeId) {
        for unit in &mut self.units {
            if &unit.damage_type == id {
                unit.damage_multiplier = (f64::from(unit.damage_multiplier) * multiplier) as f32;
            }
        }
    }

    /// Sums raw damage for one type (`damage.cpp:344-353`).
    #[must_use]
    pub fn type_damage(&self, id: &DamageTypeId) -> f32 {
        let mut result = 0.0_f32;
        for unit in &self.units {
            if &unit.damage_type == id {
                result += unit.raw_damage();
            }
        }
        result
    }

    /// Sums flat penetration for one type (`damage.cpp:355-364`).
    #[must_use]
    pub fn type_arpen(&self, id: &DamageTypeId) -> f32 {
        let mut result = 0.0_f32;
        for unit in &self.units {
            if &unit.damage_type == id {
                result += unit.res_pen;
            }
        }
        result
    }

    /// Sums raw damage in insertion order (`damage.cpp:367-374`).
    #[must_use]
    pub fn total_damage(&self) -> f32 {
        let mut result = 0.0_f32;
        for unit in &self.units {
            result += unit.raw_damage();
        }
        result
    }

    /// Clears all components (`damage.cpp:469-472`).
    pub fn clear(&mut self) {
        self.units.clear();
    }

    /// Reports whether the instance has components (`damage.cpp:474-477`).
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.units.is_empty()
    }

    /// Applies upstream JSON-relative arithmetic to existing types only.
    /// Provenance: `src/damage.cpp:600-629`.
    pub fn add_relative(&mut self, other: &Self) {
        for unit in &mut self.units {
            for added in &other.units {
                if added.damage_type != unit.damage_type {
                    continue;
                }
                let mut relative = added.clone();
                for value in [
                    &mut relative.res_mult,
                    &mut relative.damage_multiplier,
                    &mut relative.unconditional_res_mult,
                    &mut relative.unconditional_damage_mult,
                ] {
                    if *value == 1.0 {
                        *value = 0.0;
                    }
                }
                unit.add_relative(&relative);
            }
        }
    }

    /// Reproduces upstream instance equality using upstream unit equality.
    /// Provenance: `src/damage.cpp:536-539`.
    #[must_use]
    pub fn legacy_equal(&self, other: &Self) -> bool {
        self.units.len() == other.units.len()
            && self
                .units
                .iter()
                .zip(&other.units)
                .all(|(a, b)| a.legacy_equal(b))
    }
}

/// Resistance values; the ordered map gives stable snapshots independent of hashing.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Resistances {
    /// Stored resistances, before the damage type's no_resist flag is applied.
    pub values: BTreeMap<DamageTypeId, f32>,
}

impl Resistances {
    /// Sets one resistance (`damage.cpp:715-718`).
    pub fn set_resist(&mut self, id: DamageTypeId, amount: f32) {
        self.values.insert(id, amount);
    }

    /// Gets a resistance, respecting no_resist (`damage.cpp:719-723`).
    #[must_use]
    pub fn type_resist(&self, id: &DamageTypeId, registry: &DamageTypeRegistry) -> f32 {
        match self.values.get(id) {
            Some(&amount) if !registry.no_resist(id) => amount,
            _ => 0.0,
        }
    }

    /// Computes armor after penetration and both multipliers (`damage.cpp:724-728`).
    #[must_use]
    pub fn effective_resist(&self, unit: &DamageUnit, registry: &DamageTypeRegistry) -> f32 {
        let after_penetration = self.type_resist(&unit.damage_type, registry) - unit.res_pen;
        // C++ std::max keeps a first-argument NaN and negative zero. f32::max does not.
        let remaining = if after_penetration < 0.0 {
            0.0
        } else {
            after_penetration
        };
        remaining * unit.res_mult * unit.unconditional_res_mult
    }

    /// Adds resistance entries (`src/damage.h:233-239`).
    pub fn add(&mut self, other: &Self) {
        for (id, &amount) in &other.values {
            *self.values.entry(id.clone()).or_default() += amount;
        }
    }

    /// Tests upstream's asymmetric subset equality (`damage.cpp:730-739`).
    #[must_use]
    pub fn legacy_contains_equal(&self, other: &Self) -> bool {
        other
            .values
            .iter()
            .all(|(id, value)| self.values.get(id) == Some(value))
    }

    /// Produces multiplied resistance entries (`damage.cpp:741-748`).
    #[must_use]
    pub fn multiplied(&self, multiplier: f32) -> Self {
        Self {
            values: self
                .values
                .iter()
                .map(|(id, value)| (id.clone(), value * multiplier))
                .collect(),
        }
    }

    /// Produces divided resistance entries (`damage.cpp:750-757`).
    /// Zero is allowed to preserve upstream IEEE infinity/NaN semantics.
    #[must_use]
    pub fn divided(&self, divisor: f32) -> Self {
        Self {
            values: self
                .values
                .iter()
                .map(|(id, value)| (id.clone(), value / divisor))
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn armor_penetration_and_no_resist_obey_upstream_rules() {
        let id = DamageTypeId::from("bash");
        let mut registry = DamageTypeRegistry::default();
        let mut resistance = Resistances::default();
        resistance.set_resist(id.clone(), 12.0);
        let mut unit = DamageUnit::new(id.clone(), 8.0);
        unit.res_pen = 4.0;
        unit.res_mult = 0.5;
        unit.unconditional_res_mult = 0.75;
        assert_eq!(resistance.effective_resist(&unit, &registry), 3.0);
        unit.res_pen = 30.0;
        assert_eq!(resistance.effective_resist(&unit, &registry), 0.0);
        unit.res_pen = 0.0;
        registry.set_no_resist(id, true);
        assert_eq!(resistance.effective_resist(&unit, &registry), 0.0);
    }

    #[test]
    fn merge_preserves_upstream_interpolation_destination() {
        let id = DamageTypeId::from("cut");
        let mut initial = DamageUnit::new(id.clone(), 10.0);
        initial.res_mult = 0.25;
        let mut added = DamageUnit::new(id, 3.0);
        added.damage_multiplier = 2.0;
        added.res_mult = 0.1;
        let mut instance = DamageInstance::default();
        instance.add(&initial);
        instance.add(&added);
        assert_eq!(instance.units.len(), 1);
        assert_eq!(instance.total_damage(), 16.0);
        let t = 2.0_f32 / 3.0;
        assert_eq!(instance.units[0].res_mult, (1.0_f32 - t) * 0.25 + t * 2.0);
    }

    #[test]
    fn rules_are_deterministic_and_queries_do_not_mutate_state() {
        let mut instance = DamageInstance::default();
        let registry = DamageTypeRegistry::default();
        let resistances = Resistances::default();
        for id in ["bash", "cut", "heat"] {
            instance.add(&DamageUnit::new(DamageTypeId::from(id), 7.25));
        }
        let before = instance.clone();
        for _ in 0..100 {
            assert_eq!(instance.total_damage(), 21.75);
            for unit in &instance.units {
                assert_eq!(resistances.effective_resist(unit, &registry), 0.0);
            }
        }
        assert_eq!(instance, before);
        let mut repeat = before.clone();
        instance.multiply_damage(1.375, false);
        repeat.multiply_damage(1.375, false);
        assert_eq!(instance, repeat);
    }

    #[test]
    fn clear_and_type_scaling_have_distinct_upstream_semantics() {
        let id = DamageTypeId::from("bash");
        let mut instance = DamageInstance::default();
        instance.add(&DamageUnit::new(id.clone(), 7.0));
        instance.multiply_type_damage(0.0, &id);
        assert!(!instance.is_empty());
        assert_eq!(instance.total_damage(), 0.0);
        instance.multiply_damage(0.0, false);
        assert!(instance.is_empty());
    }

    #[test]
    fn relative_changes_apply_only_existing_types_and_skip_default_multipliers() {
        let mut instance = DamageInstance::default();
        instance.add(&DamageUnit::new(DamageTypeId::from("cut"), 7.0));
        let mut relative = DamageInstance::default();
        relative.add(&DamageUnit::new(DamageTypeId::from("cut"), 2.0));
        relative.add(&DamageUnit::new(DamageTypeId::from("heat"), 5.0));
        instance.add_relative(&relative);
        assert_eq!(instance.units.len(), 1);
        assert_eq!(instance.total_damage(), 9.0);
        assert_eq!(instance.units[0].unconditional_res_mult, 1.0);
    }

    #[test]
    fn legacy_equality_quirks_are_not_silently_fixed() {
        let mut unit = DamageUnit::new(DamageTypeId::from("cut"), 3.0);
        unit.unconditional_damage_mult = 2.0;
        assert_eq!(unit, unit.clone());
        assert!(!unit.legacy_equal(&unit));
        let mut subset = Resistances::default();
        subset.set_resist(DamageTypeId::from("cut"), 2.0);
        let mut superset = subset.clone();
        superset.set_resist(DamageTypeId::from("bash"), 4.0);
        assert!(superset.legacy_contains_equal(&subset));
        assert!(!subset.legacy_contains_equal(&superset));
    }

    #[test]
    fn zero_multiplier_merge_keeps_ieee_behavior() {
        let mut unit = DamageUnit::new(DamageTypeId::from("cut"), 3.0);
        unit.damage_multiplier = 0.0;
        let mut instance = DamageInstance::default();
        instance.add(&unit);
        instance.add(&unit);
        assert!(instance.units[0].amount.is_nan());
        assert!(instance.units[0].res_mult.is_nan());
    }

    #[test]
    fn nonnegative_valid_armor_is_monotone_in_penetration() {
        let id = DamageTypeId::from("bash");
        let registry = DamageTypeRegistry::default();
        for armor in 0..100 {
            let mut resistance = Resistances::default();
            resistance.set_resist(id.clone(), armor as f32);
            let mut previous = f32::INFINITY;
            for penetration in 0..120 {
                let mut unit = DamageUnit::new(id.clone(), 1.0);
                unit.res_pen = penetration as f32;
                let current = resistance.effective_resist(&unit, &registry);
                assert!(current >= 0.0 && current <= previous);
                previous = current;
            }
        }
    }

    #[test]
    fn effective_resist_retains_cpp_nan_and_negative_zero() {
        let id = DamageTypeId::from("bash");
        let registry = DamageTypeRegistry::default();
        let mut resistance = Resistances::default();
        let unit = DamageUnit::new(id.clone(), 1.0);
        resistance.set_resist(id.clone(), f32::NAN);
        assert!(resistance.effective_resist(&unit, &registry).is_nan());
        resistance.set_resist(id, -0.0);
        assert_eq!(
            resistance.effective_resist(&unit, &registry).to_bits(),
            (-0.0_f32).to_bits()
        );
    }
}
