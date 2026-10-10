//! The workbench's public scalar-rule names. The full source-derived functions
//! and exact upstream provenance remain in `formulas`.
pub use crate::formulas::weapon_action_speed as combat_speed;
pub use crate::formulas::{hit_chance, rescale_damage};
/// UI multiplier form of upstream's `force_use_resist` percentage.
/// A fraction of 1 means 100% of the resolved resistance.
pub fn combined_resistance(all: f64, typed: f64, cap: f64, force_fraction: f64) -> f64 {
    crate::formulas::resistance_percent(all, typed, cap, force_fraction * 100.0)
}
