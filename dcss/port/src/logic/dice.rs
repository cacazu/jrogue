//! Integer dice and random helpers migrated from DCSS 0.34.1 `random.cc`.
//! Upstream commit: `1eebc1a2892e1c89776a0d7a10691f8dac8d9796`.
//! Copyright 1997-2025 Linley Henzell, DCSS developers and contributors.
//! SPDX-License-Identifier: GPL-2.0-or-later
//!
//! The random stream is an explicit argument: draw order remains upstream's,
//! while rendering cannot implicitly draw through process-global RNG state.
//! Numeric preconditions rule out C++ signed-overflow/zero-division UB; normal
//! upstream inputs retain exact results, including negative `random2` bounds.

use super::rng::PcgRng;
use serde::{Deserialize, Serialize};

/// DCSS `dice_def`; non-positive dimensions roll zero, as upstream specifies.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DiceDef {
    pub num: i32,
    pub size: i32,
}

impl DiceDef {
    /// Construct a dice description without drawing randomness.
    #[must_use]
    pub const fn new(num: i32, size: i32) -> Self {
        Self { num, size }
    }

    /// Roll these dice through the supplied simulation stream.
    pub fn roll(self, rng: &mut PcgRng) -> i32 {
        roll_dice(rng, self.num, self.size)
    }
}

/// Exact upstream `roll_dice`; invalid dimensions consume no RNG.
///
/// # Panics
/// Panics if the maximum positive sum exceeds `i32`, outside defined C++ input.
pub fn roll_dice(rng: &mut PcgRng, num: i32, size: i32) -> i32 {
    if num <= 0 || size <= 0 {
        return 0;
    }
    assert!(i64::from(num) * i64::from(size) <= i64::from(i32::MAX));
    let mut result = num;
    for _ in 0..num {
        result += rng.random2(size);
    }
    result
}

/// Upstream deterministic dice mean uses integer division, rounded toward zero.
pub fn maybe_roll_dice(rng: &mut PcgRng, num: i32, size: i32, random: bool) -> i32 {
    if random {
        roll_dice(rng, num, size)
    } else {
        i32::try_from((i64::from(num) + i64::from(num) * i64::from(size)) / 2)
            .expect("dice mean must fit in i32")
    }
}

/// Choose upstream damage dice, optionally randomizing the die size rounding.
pub fn calc_dice(rng: &mut PcgRng, num_dice: i32, max_damage: i32, random: bool) -> DiceDef {
    if num_dice <= 1 {
        DiceDef::new(1, max_damage)
    } else if max_damage <= num_dice {
        DiceDef::new(max_damage, 1)
    } else if random {
        DiceDef::new(num_dice, div_rand_round(rng, max_damage, num_dice))
    } else {
        DiceDef::new(num_dice, max_damage / num_dice)
    }
}

/// Divide and use one `random2(den)` only when the remainder is nonzero.
/// `den` must be positive, as required by migrated gameplay callers.
pub fn div_rand_round(rng: &mut PcgRng, num: i32, den: i32) -> i32 {
    assert!(den > 0);
    let remainder = num % den;
    num / den + i32::from(remainder != 0 && rng.random2(den) < remainder)
}

/// Upstream integer ceiling helper, preserving its signed-input semantics.
#[must_use]
pub fn div_round_up(num: i32, den: i32) -> i32 {
    assert!(den > 0);
    num / den + i32::from(num % den != 0)
}

/// Exact upstream nearest helper, including its integer half-denominator.
/// This deliberately preserves the release's `den == 1` behavior.
#[must_use]
pub fn div_round_near(num: i32, den: i32) -> i32 {
    assert!(den > 0);
    num / den + i32::from(num % den >= den / 2)
}

/// Upstream coin flip: false for zero, true for one.
pub fn coinflip(rng: &mut PcgRng) -> bool {
    rng.random2(2) != 0
}

/// Upstream conditional randomness, with no draws in the deterministic branch.
pub fn maybe_random2(rng: &mut PcgRng, max: i32, random: bool) -> i32 {
    if max <= 1 {
        0
    } else if random {
        rng.random2(max)
    } else {
        max / 2
    }
}

/// Upstream random or mean division; positive denominator is required.
pub fn maybe_random2_div(rng: &mut PcgRng, nom: i32, denom: i32, random: bool) -> i32 {
    assert!(denom > 0);
    if nom <= 0 {
        0
    } else if random {
        rng.random2(
            nom.checked_add(denom)
                .expect("random bound must fit in i32"),
        ) / denom
    } else {
        nom / 2 / denom
    }
}

/// Inclusive integer range, consuming no RNG for a single-valued range.
pub fn random_range(rng: &mut PcgRng, low: i32, high: i32) -> i32 {
    assert!(low <= high);
    let span =
        i32::try_from(i64::from(high) - i64::from(low) + 1).expect("range span must fit in i32");
    low + rng.random2(span)
}

/// Upstream averaged distribution: first bound `max`, all later `max + 1`.
/// Positive `rolls` and a representable `max + 1`/sum are required.
pub fn random2avg(rng: &mut PcgRng, max: i32, rolls: i32) -> i32 {
    assert!(rolls > 0);
    let mut sum = i64::from(rng.random2(max));
    for _ in 0..rolls - 1 {
        sum += i64::from(rng.random2(max.checked_add(1).expect("average bound must fit in i32")));
    }
    i32::try_from(sum / i64::from(rolls)).expect("average must fit in i32")
}

/// Minimum of the upstream draws; `rolls <= 1` still draws once upstream.
pub fn random2min(rng: &mut PcgRng, max: i32, rolls: i32) -> i32 {
    let mut result = rng.random2(max);
    for _ in 1..rolls {
        result = result.min(rng.random2(max));
    }
    result
}

/// Maximum of the upstream draws; `rolls <= 1` still draws once upstream.
pub fn random2max(rng: &mut PcgRng, max: i32, rolls: i32) -> i32 {
    let mut result = rng.random2(max);
    for _ in 1..rolls {
        result = result.max(rng.random2(max));
    }
    result
}

/// Upstream probability helper, consuming no draw for impossible/certain events.
pub fn x_chance_in_y(rng: &mut PcgRng, x: i32, y: i32) -> bool {
    if x <= 0 {
        false
    } else if x >= y {
        true
    } else {
        rng.random2(y) < x
    }
}

/// Upstream `one_chance_in`; a bound <= 1 succeeds without consuming a draw.
pub fn one_chance_in(rng: &mut PcgRng, denominator: i32) -> bool {
    rng.random2(denominator) == 0
}

/// Upstream low-biased distribution, sampling the exact ordered probabilities.
pub fn biased_random2(rng: &mut PcgRng, max: i32, n: i32) -> i32 {
    assert!(n >= 2);
    for index in 0..max {
        let denominator = n
            .checked_add(max)
            .and_then(|v| v.checked_sub(1 + index))
            .expect("biased bound must fit in i32");
        if x_chance_in_y(rng, n, denominator) {
            return index;
        }
    }
    0
}

/// Upstream decimal probability, using PCG's exact IEEE-754 random construction.
pub fn decimal_chance(rng: &mut PcgRng, probability: f64) -> bool {
    rng.random_real() < probability
}

/// Fisher-Yates order from DCSS `random.h::shuffle_array`; length <= `i32::MAX`.
pub fn shuffle<T>(rng: &mut PcgRng, values: &mut [T]) {
    let mut n = values.len();
    assert!(n <= i32::MAX as usize);
    while n > 1 {
        let index = rng.random2(n as i32) as usize;
        n -= 1;
        values.swap(index, n);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn helpers_match_compiled_upstream_results_and_draw_counts() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../../tests/reference_rng.json")).unwrap();
        for case in fixture["helpers"].as_array().unwrap() {
            let mut rng = PcgRng::from_seed(case["seed"].as_str().unwrap().parse().unwrap());
            for operation in case["operations"].as_array().unwrap() {
                let parameters: Vec<i32> = operation["params"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|v| v.as_i64().unwrap() as i32)
                    .collect();
                let result = match operation["name"].as_str().unwrap() {
                    "random2" => rng.random2(parameters[0]),
                    "roll_dice" => roll_dice(&mut rng, parameters[0], parameters[1]),
                    "random2avg" => random2avg(&mut rng, parameters[0], parameters[1]),
                    "random2min" => random2min(&mut rng, parameters[0], parameters[1]),
                    "random2max" => random2max(&mut rng, parameters[0], parameters[1]),
                    "div_rand_round" => div_rand_round(&mut rng, parameters[0], parameters[1]),
                    "div_round_up" => div_round_up(parameters[0], parameters[1]),
                    "div_round_near" => div_round_near(parameters[0], parameters[1]),
                    "random_range" => random_range(&mut rng, parameters[0], parameters[1]),
                    "maybe_random2" => maybe_random2(&mut rng, parameters[0], parameters[1] != 0),
                    "maybe_random2_div" => maybe_random2_div(
                        &mut rng,
                        parameters[0],
                        parameters[1],
                        parameters[2] != 0,
                    ),
                    "maybe_roll_dice" => {
                        maybe_roll_dice(&mut rng, parameters[0], parameters[1], parameters[2] != 0)
                    }
                    "x_chance_in_y" => {
                        i32::from(x_chance_in_y(&mut rng, parameters[0], parameters[1]))
                    }
                    "one_chance_in" => i32::from(one_chance_in(&mut rng, parameters[0])),
                    "biased_random2" => biased_random2(&mut rng, parameters[0], parameters[1]),
                    "coinflip" => i32::from(coinflip(&mut rng)),
                    "calc_dice" => {
                        let dice =
                            calc_dice(&mut rng, parameters[0], parameters[1], parameters[2] != 0);
                        assert_eq!(dice.num, operation["num"].as_i64().unwrap() as i32);
                        dice.size
                    }
                    "random_real" => {
                        assert_eq!(
                            rng.random_real().to_bits().to_string(),
                            operation["bits"].as_str().unwrap()
                        );
                        0
                    }
                    other => panic!("unrecognized upstream fixture operation: {other}"),
                };
                assert_eq!(
                    i64::from(result),
                    operation["result"].as_i64().unwrap(),
                    "{operation}"
                );
                assert_eq!(
                    rng.count(),
                    operation["count"].as_u64().unwrap(),
                    "{operation}"
                );
            }
        }
    }

    #[test]
    fn invalid_or_single_sided_dice_preserve_draw_state() {
        let mut rng = PcgRng::from_seed(42);
        let initial = rng.clone();
        for dice in [DiceDef::new(-1, 6), DiceDef::new(3, 0), DiceDef::new(0, 6)] {
            assert_eq!(dice.roll(&mut rng), 0);
        }
        assert_eq!(DiceDef::new(42, 1).roll(&mut rng), 42);
        assert_eq!(rng, initial);
    }

    #[test]
    fn deterministic_helper_branches_consume_no_draws() {
        let mut rng = PcgRng::from_seed(999);
        let initial = rng.clone();
        assert_eq!(maybe_random2(&mut rng, 9, false), 4);
        assert_eq!(maybe_roll_dice(&mut rng, 3, 6, false), 10);
        assert_eq!(maybe_random2_div(&mut rng, 27, 3, false), 4);
        assert_eq!(calc_dice(&mut rng, 3, 17, false), DiceDef::new(3, 5));
        assert_eq!(div_rand_round(&mut rng, 12, 3), 4);
        assert!(!x_chance_in_y(&mut rng, 0, 10));
        assert!(x_chance_in_y(&mut rng, 10, 10));
        assert_eq!(rng, initial);
    }
}
