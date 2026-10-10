use crate::{accept_npc_color, weather_seed, NpcCollisionFrame, WeatherFrame};

/// Applies only the original collision branch. Initial insertion, filters,
/// population increments, order and duplicate policy remain native concerns.
#[must_use]
pub fn collision_color<T: Eq + Copy>(current: T, candidate: T, frame: &NpcCollisionFrame) -> T {
    if current != candidate && accept_npc_color(frame) {
        candidate
    } else {
        current
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub struct StaticWeatherChoices {
    pub seed: u32,
    pub loc_rand: u32,
    pub foreground: Option<usize>,
    pub background: Option<usize>,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum WeightError {
    NativeTotalOverflow,
}

impl std::fmt::Display for WeightError {
    fn fmt(&self, out: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        out.write_str("native weighted-list total exceeds i32::MAX")
    }
}

impl std::error::Error for WeightError {}

// Exact unsigned-32 lookup3 arithmetic at native cata_tiles.cpp:2920–2937.
fn native_static_location_mix(seed: u32) -> u32 {
    let mut a = seed;
    let mut b = seed.wrapping_neg();
    let mut c = seed.wrapping_mul(seed);
    c = (c ^ b).wrapping_sub(b.rotate_left(14));
    a = (a ^ c).wrapping_sub(c.rotate_left(11));
    b = (b ^ a).wrapping_sub(a.rotate_left(25));
    c = (c ^ b).wrapping_sub(b.rotate_left(16));
    a = (a ^ c).wrapping_sub(c.rotate_left(4));
    b = (b ^ a).wrapping_sub(a.rotate_left(14));
    (c ^ b).wrapping_sub(b.rotate_left(24))
}

fn native_weighted_index(weights: &[u32], loc_rand: u32) -> Result<Option<usize>, WeightError> {
    let total = weights.iter().try_fold(0_u32, |total, weight| {
        total.checked_add(*weight).filter(|value| *value <= i32::MAX as u32)
    }).ok_or(WeightError::NativeTotalOverflow)?;
    if total == 0 {
        return Ok(None);
    }
    if weights.len() == 1 {
        return Ok(Some(0));
    }
    // Native weighted_int_list::pick_ent is randi % total + 1, then
    // accumulated_weight >= picked (or the equivalent precalculated array).
    let picked = loc_rand % total + 1;
    let mut accumulated = 0_u32;
    for (index, weight) in weights.iter().enumerate() {
        accumulated += weight;
        if accumulated >= picked {
            return Ok(Some(index));
        }
    }
    // Positive checked total guarantees a hit above.
    unreachable!("positive weighted total must select an object")
}

/// Nonanimated native selection only. The caller must supply observed,
/// nonnegative weights in native object order. No clock-based animation,
/// texture loading, rotation or drawing is implemented in this consumer.
///
/// # Errors
/// Returns NativeTotalOverflow when a weight total would exceed native int.
pub fn static_weather_choices(frame: &WeatherFrame<'_>, foreground_weights: &[u32],
    background_weights: &[u32]) -> Result<StaticWeatherChoices, WeightError> {
    let seed = weather_seed(frame);
    let loc_rand = if foreground_weights.len() > 1 || background_weights.len() > 1 {
        native_static_location_mix(seed)
    } else {
        0
    };
    Ok(StaticWeatherChoices {
        seed,
        loc_rand,
        foreground: native_weighted_index(foreground_weights, loc_rand)?,
        background: native_weighted_index(background_weights, loc_rand)?,
    })
}
