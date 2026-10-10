//! Source-only presentation calculation for the three pinned native cosmetic
//! RNG consumers. No world access, input, clock, RNG engine, storage, or FFI.
//! Native and Rust compilation, integration and runtime verification are pending.
#![forbid(unsafe_code)]

mod selection;
pub use selection::{collision_color, static_weather_choices, StaticWeatherChoices, WeightError};

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub struct WeatherFrame<'a> {
    pub resolved_tile_id: &'a str,
    pub tile_position: [i32; 3],
    pub screen_position: [i32; 2],
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
#[repr(u32)]
pub enum NpcPass {
    Nearby = 1,
    Followers = 2,
}

/// One already-admitted collision in native loop order. The signed chance is
/// supplied *after* the native size_t->int conversion; this crate does not cast
/// a size_t or increment a population count. Duplicate followers stay admitted.
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub struct NpcCollisionFrame {
    pub origin: [i32; 3],
    pub cursor: [i32; 3],
    pub position: [i32; 3],
    pub npc_id: i32,
    pub native_chance: i32,
    pub pass: NpcPass,
}

const OFFSET: u32 = 2166136261;
const PRIME: u32 = 16777619;
const MIX_A: u32 = 0x7feb352d;
const MIX_B: u32 = 0x846ca68b;
const STRIDE: u32 = 0x9e3779b9;

fn avalanche(mut value: u32) -> u32 {
    value ^= value >> 16;
    value = value.wrapping_mul(MIX_A);
    value ^= value >> 15;
    value = value.wrapping_mul(MIX_B);
    value ^ (value >> 16)
}

fn append_byte(value: u32, byte: u8) -> u32 {
    (value ^ u32::from(byte)).wrapping_mul(PRIME)
}

fn append_word(mut value: u32, word: u32) -> u32 {
    for byte in word.to_le_bytes() {
        value = append_byte(value, byte);
    }
    value
}

fn append_text(mut value: u32, text: &str) -> u32 {
    // usize is at most u64 on the native/browser targets under review.
    for byte in (text.len() as u64).to_le_bytes() {
        value = append_byte(value, byte);
    }
    for &byte in text.as_bytes() {
        value = append_byte(value, byte);
    }
    value
}

fn append_position(mut value: u32, position: &[i32]) -> u32 {
    for component in position {
        // Preserve the two's-complement canonical word, including negatives.
        value = append_word(value, u32::from_le_bytes(component.to_le_bytes()));
    }
    value
}

#[must_use]
pub fn weather_seed(frame: &WeatherFrame<'_>) -> u32 {
    let mut value = append_text(OFFSET, "cdda.presentation.weather.v1");
    value = append_text(value, frame.resolved_tile_id);
    value = append_position(value, &frame.tile_position);
    value = append_position(value, &frame.screen_position);
    avalanche(value)
}

fn npc_key(frame: &NpcCollisionFrame) -> u32 {
    let mut value = append_text(OFFSET, "cdda.presentation.npc-color.v1");
    value = append_position(value, &frame.origin);
    value = append_position(value, &frame.cursor);
    value = append_position(value, &frame.position);
    value = append_word(value, u32::from_le_bytes(frame.npc_id.to_le_bytes()));
    value = append_word(value, u32::from_le_bytes(frame.native_chance.to_le_bytes()));
    value = append_word(value, frame.pass as u32);
    avalanche(value)
}

fn bounded_word(key: u32, bound: std::num::NonZeroU32) -> u32 {
    let bound = bound.get();
    let threshold = bound.wrapping_neg() % bound;
    let mut ordinal = 0_u32;
    loop {
        let word = avalanche(key.wrapping_add(ordinal.wrapping_mul(STRIDE)));
        if word >= threshold {
            return word % bound;
        }
        ordinal = ordinal.wrapping_add(1);
    }
}

/// Same acceptance predicate as native one_in(int): chance<=1 succeeds;
/// otherwise choose the zero residue of [0, chance-1]. This deterministic
/// frame hash is not a claim of stochastic uniformity over world inputs.
#[must_use]
pub fn accept_npc_color(frame: &NpcCollisionFrame) -> bool {
    if frame.native_chance <= 1 {
        return true;
    }
    let chance_word = u32::from_le_bytes(frame.native_chance.to_le_bytes());
    // Positive native_chance > 1 above proves the NonZeroU32 invariant.
    let bound = std::num::NonZeroU32::new(chance_word).expect("positive native chance");
    bounded_word(npc_key(frame), bound) == 0
}

#[cfg(test)]
mod tests;
