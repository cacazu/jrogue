// SPDX-License-Identifier: GPL-3.0-or-later
// SFMT algorithm derived from src/SFMT.c, src/SFMT.h and
// src/SFMT-params19937.h in the official T-Engine 4 1.7.6 source archive.
// Copyright (C) 2006, 2007 Mutsuo Saito, Makoto Matsumoto and Hiroshima
// University. SFMT is under the new BSD license; see SFMT-LICENSE.txt.
// Range/normal wrappers derived from src/core_lua.c, Copyright (C)
// 2009-2018 Nicolas Casalini, GPL-3.0-or-later. See ATTRIBUTION.md.

//! Scalar SFMT19937 matching T-Engine 4 1.7.6 on little-endian targets.
//!
//! State is owned by a simulation, with no global generator or clock.
//! JSON includes the complete 624-word state and cursor, validated on load.
//! Rendering must receive immutable domain state and never this generator.
//! Methods reproduce upstream behavior for inputs whose C arithmetic is
//! defined; overflowing signed ranges are rejected explicitly.

use serde::{Deserialize, Serialize};
use std::fmt;

const BLOCKS: usize = 156;
const WORDS: usize = BLOCKS * 4;
const POS1: usize = 122;
const MASK: [u32; 4] = [0xdfff_ffef, 0xddfe_cb7f, 0xbffa_ffff, 0xbfff_fff6];
const PARITY: [u32; 4] = [1, 0, 0, 0x13c9_e684];
const VERSION: u32 = 1;

/// A validated, serializable SFMT19937 stream.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "RawState")]
pub struct Sfmt19937 {
    algorithm_version: u32,
    state: Vec<[u32; 4]>,
    index: usize,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawState {
    algorithm_version: u32,
    state: Vec<[u32; 4]>,
    index: usize,
}

/// Invalid RNG state or input outside upstream's defined signed arithmetic.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RngError {
    /// A future or otherwise unsupported serialized algorithm version.
    UnsupportedVersion(u32),
    /// State must contain exactly 156 four-word blocks.
    InvalidStateLength(usize),
    /// The next word must be at index 0 through 624, inclusive.
    InvalidCursor(usize),
    /// All-zero state is an invalid absorbing generator state.
    ZeroState,
    /// The inclusive interval width cannot be represented by a C signed int.
    RangeOverflow,
    /// Upstream's result would overflow a signed 32-bit integer.
    ResultOverflow,
    /// A negative die size has no defined signed result in the port API.
    NegativeDieSize,
    /// The average requires a positive draw count and ordered bounds.
    InvalidAverage,
}

impl fmt::Display for RngError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedVersion(v) => write!(f, "unsupported SFMT state version {v}"),
            Self::InvalidStateLength(n) => {
                write!(f, "SFMT state has {n} blocks; expected {BLOCKS}")
            }
            Self::InvalidCursor(i) => write!(f, "SFMT state cursor {i} exceeds {WORDS}"),
            Self::ZeroState => f.write_str("SFMT state is all zero"),
            Self::RangeOverflow => {
                f.write_str("inclusive RNG span overflows a signed 32-bit integer")
            }
            Self::ResultOverflow => f.write_str("RNG result overflows a signed 32-bit integer"),
            Self::NegativeDieSize => f.write_str("RNG die size is negative"),
            Self::InvalidAverage => {
                f.write_str("RNG average needs ordered bounds and a positive count")
            }
        }
    }
}

impl std::error::Error for RngError {}

impl TryFrom<RawState> for Sfmt19937 {
    type Error = RngError;

    fn try_from(raw: RawState) -> Result<Self, Self::Error> {
        if raw.algorithm_version != VERSION {
            return Err(RngError::UnsupportedVersion(raw.algorithm_version));
        }
        if raw.state.len() != BLOCKS {
            return Err(RngError::InvalidStateLength(raw.state.len()));
        }
        if raw.index > WORDS {
            return Err(RngError::InvalidCursor(raw.index));
        }
        if raw.state.iter().flatten().all(|&word| word == 0) {
            return Err(RngError::ZeroState);
        }
        Ok(Self {
            algorithm_version: raw.algorithm_version,
            state: raw.state,
            index: raw.index,
        })
    }
}

impl Sfmt19937 {
    /// Matches upstream `init_gen_rand(seed)` including period certification.
    #[must_use]
    pub fn new(seed: u32) -> Self {
        let mut state = vec![[0; 4]; BLOCKS];
        state[0][0] = seed;
        for i in 1..WORDS {
            let previous = state[(i - 1) / 4][(i - 1) % 4];
            state[i / 4][i % 4] = 1_812_433_253_u32
                .wrapping_mul(previous ^ (previous >> 30))
                .wrapping_add(i as u32);
        }
        let parity = state[0]
            .iter()
            .zip(PARITY)
            .fold(0, |acc, (&word, mask)| acc ^ (word & mask).count_ones())
            & 1;
        if parity == 0 {
            // PARITY[0] has bit zero set, so upstream fixes this bit first.
            state[0][0] ^= 1;
        }
        Self {
            algorithm_version: VERSION,
            state,
            index: WORDS,
        }
    }

    /// Matches upstream `gen_rand32()` and consumes one 32-bit output.
    pub fn next_u32(&mut self) -> u32 {
        if self.index == WORDS {
            self.refill();
            self.index = 0;
        }
        let output = self.state[self.index / 4][self.index % 4];
        self.index += 1;
        output
    }

    /// Matches `genrand_real1()`: both zero and one are possible.
    pub fn real1(&mut self) -> f64 {
        f64::from(self.next_u32()) * (1.0 / 4_294_967_295.0)
    }

    /// Matches upstream mask/rejection `rand_div`, yielding `[0, bound)`.
    /// Bounds zero and one return zero without consuming the stream.
    pub fn rand_div(&mut self, bound: u32) -> u32 {
        if bound <= 1 {
            return 0;
        }
        let mut used = bound;
        used |= used >> 1;
        used |= used >> 2;
        used |= used >> 4;
        used |= used >> 8;
        used |= used >> 16;
        loop {
            let value = self.next_u32() & used;
            if value < bound {
                return value;
            }
        }
    }

    /// Matches Lua `rng.range(x,y)` / two-argument `rng(x,y)`.
    /// Reversed bounds are swapped, and equal bounds consume no output.
    ///
    /// # Errors
    /// Rejects intervals whose inclusive width overflows upstream's C `int`.
    pub fn range(&mut self, x: i32, y: i32) -> Result<i32, RngError> {
        let low = x.min(y);
        let high = x.max(y);
        let width = high
            .checked_sub(low)
            .and_then(|v| v.checked_add(1))
            .ok_or(RngError::RangeOverflow)?;
        // width is positive and at most i32::MAX, so the result fits i32.
        Ok(low + self.rand_div(width as u32) as i32)
    }

    /// Matches Lua one-argument `rng(x)`, including the C signed-to-unsigned
    /// conversion of negative arguments. This conversion is intentional.
    pub fn call(&mut self, x: i32) -> u32 {
        self.rand_div(x as u32)
    }

    /// Matches Lua `rng.chance(x)`, including no draw when `x` is zero or one.
    pub fn chance(&mut self, x: i32) -> bool {
        self.rand_div(x as u32) == 0
    }

    /// Matches Lua `rng.percent(x)`; always rolls, even for 0% or 100%.
    pub fn percent(&mut self, x: i32) -> bool {
        (self.rand_div(100) as i32) < x
    }

    /// Matches Lua `rng.float(min,max)`, including its f32 argument coercion.
    pub fn float(&mut self, x: f64, y: f64) -> f64 {
        let x = f64::from(x as f32);
        let y = f64::from(y as f32);
        let (low, high) = if x < y { (x, y) } else { (y, x) };
        f64::from(self.next_u32()) * ((high - low) / 4_294_967_295.0) + low
    }

    /// Matches Lua `rng.dice(count,sides)` for nonnegative die sizes.
    /// A nonpositive count consumes no output; zero sides produce ones.
    ///
    /// # Errors
    /// Rejects negative sides or an overflowing signed result.
    pub fn dice(&mut self, count: i32, sides: i32) -> Result<i32, RngError> {
        if count <= 0 {
            return Ok(0);
        }
        if sides < 0 {
            return Err(RngError::NegativeDieSize);
        }
        // Validate the maximum result before touching the RNG.
        count
            .checked_mul(sides.max(1))
            .ok_or(RngError::ResultOverflow)?;
        let mut total = 0;
        for _ in 0..count {
            total += 1 + self.rand_div(sides as u32) as i32;
        }
        Ok(total)
    }

    /// Matches Lua `rng.avg(x,y,count)` for ordered bounds and positive count.
    /// The upstream default draw count is two.
    ///
    /// # Errors
    /// Rejects reversed bounds, a nonpositive count, or a signed span overflow.
    pub fn average(&mut self, x: i32, y: i32, count: i32) -> Result<f64, RngError> {
        if count <= 0 || x > y {
            return Err(RngError::InvalidAverage);
        }
        let width = y
            .checked_sub(x)
            .and_then(|v| v.checked_add(1))
            .ok_or(RngError::RangeOverflow)?;
        let mut total = 0.0;
        for _ in 0..count {
            total += f64::from(x + self.rand_div(width as u32) as i32);
        }
        Ok(total / f64::from(count))
    }

    /// Matches Lua `rng.normal(mean,stand)` using its 256-entry table.
    /// Standard deviations below one return `mean` without consuming output.
    ///
    /// # Errors
    /// Rejects inputs for which the original Windows C multiplication or
    /// signed addition/subtraction can overflow, before touching the RNG.
    pub fn normal(&mut self, mean: i32, stand: i32) -> Result<i32, RngError> {
        if stand < 1 {
            return Ok(mean);
        }
        let max_product = stand.checked_mul(255).ok_or(RngError::ResultOverflow)?;
        let max_offset = max_product / 64;
        mean.checked_sub(max_offset)
            .ok_or(RngError::ResultOverflow)?;
        mean.checked_add(max_offset)
            .ok_or(RngError::ResultOverflow)?;
        let probability = self.rand_div(32768);
        let mut low = 0;
        let mut high = RANDNOR_TABLE.len();
        while low < high {
            let mid = (low + high) >> 1;
            if u32::from(RANDNOR_TABLE[mid]) < probability {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        let offset = (stand * low as i32) / 64;
        if self.rand_div(100) < 50 {
            Ok(mean - offset)
        } else {
            Ok(mean + offset)
        }
    }

    fn refill(&mut self) {
        let mut r1 = self.state[BLOCKS - 2];
        let mut r2 = self.state[BLOCKS - 1];
        for i in 0..BLOCKS {
            let b = self.state[(i + POS1) % BLOCKS];
            let next = recurse(self.state[i], b, r1, r2);
            self.state[i] = next;
            r1 = r2;
            r2 = next;
        }
    }
}

fn recurse(a: [u32; 4], b: [u32; 4], c: [u32; 4], d: [u32; 4]) -> [u32; 4] {
    // Explicit little-endian 128-bit byte shifts, independent of host endian.
    let left = [
        a[0] << 8,
        (a[1] << 8) | (a[0] >> 24),
        (a[2] << 8) | (a[1] >> 24),
        (a[3] << 8) | (a[2] >> 24),
    ];
    let right = [
        (c[0] >> 8) | (c[1] << 24),
        (c[1] >> 8) | (c[2] << 24),
        (c[2] >> 8) | (c[3] << 24),
        c[3] >> 8,
    ];
    std::array::from_fn(|i| a[i] ^ left[i] ^ ((b[i] >> 11) & MASK[i]) ^ right[i] ^ (d[i] << 18))
}

// Copied without numerical changes from core_lua.c:3755-3792.
const RANDNOR_TABLE: [u16; 256] = [
    206, 613, 1022, 1430, 1838, 2245, 2652, 3058, 3463, 3867, 4271, 4673, 5075, 5475, 5874, 6271,
    6667, 7061, 7454, 7845, 8234, 8621, 9006, 9389, 9770, 10148, 10524, 10898, 11269, 11638, 12004,
    12367, 12727, 13085, 13440, 13792, 14140, 14486, 14828, 15168, 15504, 15836, 16166, 16492,
    16814, 17133, 17449, 17761, 18069, 18374, 18675, 18972, 19266, 19556, 19842, 20124, 20403,
    20678, 20949, 21216, 21479, 21738, 21994, 22245, 22493, 22737, 22977, 23213, 23446, 23674,
    23899, 24120, 24336, 24550, 24759, 24965, 25166, 25365, 25559, 25750, 25937, 26120, 26300,
    26476, 26649, 26818, 26983, 27146, 27304, 27460, 27612, 27760, 27906, 28048, 28187, 28323,
    28455, 28585, 28711, 28835, 28955, 29073, 29188, 29299, 29409, 29515, 29619, 29720, 29818,
    29914, 30007, 30098, 30186, 30272, 30356, 30437, 30516, 30593, 30668, 30740, 30810, 30879,
    30945, 31010, 31072, 31133, 31192, 31249, 31304, 31358, 31410, 31460, 31509, 31556, 31601,
    31646, 31688, 31730, 31770, 31808, 31846, 31882, 31917, 31950, 31983, 32014, 32044, 32074,
    32102, 32129, 32155, 32180, 32205, 32228, 32251, 32273, 32294, 32314, 32333, 32352, 32370,
    32387, 32404, 32420, 32435, 32450, 32464, 32477, 32490, 32503, 32515, 32526, 32537, 32548,
    32558, 32568, 32577, 32586, 32595, 32603, 32611, 32618, 32625, 32632, 32639, 32645, 32651,
    32657, 32662, 32667, 32672, 32677, 32682, 32686, 32690, 32694, 32698, 32702, 32705, 32708,
    32711, 32714, 32717, 32720, 32722, 32725, 32727, 32729, 32731, 32733, 32735, 32737, 32739,
    32740, 32742, 32743, 32745, 32746, 32747, 32748, 32749, 32750, 32751, 32752, 32753, 32754,
    32755, 32756, 32757, 32757, 32758, 32758, 32759, 32760, 32760, 32761, 32761, 32761, 32762,
    32762, 32763, 32763, 32763, 32764, 32764, 32764, 32764, 32765, 32765, 32765, 32765, 32766,
    32766, 32766, 32766, 32767,
];

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn fixture() -> Value {
        serde_json::from_str(include_str!("fixtures/sfmt19937-reference.json")).unwrap()
    }

    #[test]
    fn matches_c_words_and_real1_across_multiple_refill_boundaries() {
        for row in fixture()["seeds"].as_array().unwrap() {
            let seed = row["seed"].as_u64().unwrap() as u32;
            let mut rng = Sfmt19937::new(seed);
            for (index, word) in row["words"].as_array().unwrap().iter().enumerate() {
                assert_eq!(
                    rng.next_u32(),
                    word.as_u64().unwrap() as u32,
                    "seed {seed}, draw {index}"
                );
            }
            let mut rng = Sfmt19937::new(seed);
            for (index, bits) in row["real1_bits"].as_array().unwrap().iter().enumerate() {
                let expected = u64::from_str_radix(bits.as_str().unwrap(), 16).unwrap();
                assert_eq!(
                    rng.real1().to_bits(),
                    expected,
                    "seed {seed}, real1 draw {index}"
                );
            }
        }
    }

    #[test]
    fn matches_c_mask_rejection_and_lua_range_normal_wrappers() {
        for row in fixture()["seeds"].as_array().unwrap() {
            let seed = row["seed"].as_u64().unwrap() as u32;
            let mut rng = Sfmt19937::new(seed);
            for draw in row["bounded"].as_array().unwrap() {
                let bound = draw[0].as_u64().unwrap() as u32;
                assert_eq!(rng.rand_div(bound), draw[1].as_u64().unwrap() as u32);
            }
            let mut rng = Sfmt19937::new(seed);
            for draw in row["range"].as_array().unwrap() {
                assert_eq!(
                    rng.range(
                        draw[0].as_i64().unwrap() as i32,
                        draw[1].as_i64().unwrap() as i32
                    )
                    .unwrap(),
                    draw[2].as_i64().unwrap() as i32
                );
            }
            let mut rng = Sfmt19937::new(seed);
            for draw in row["normal"].as_array().unwrap() {
                assert_eq!(
                    rng.normal(
                        draw[0].as_i64().unwrap() as i32,
                        draw[1].as_i64().unwrap() as i32
                    )
                    .unwrap(),
                    draw[2].as_i64().unwrap() as i32
                );
            }
        }
    }

    #[test]
    fn json_save_resumes_exact_stream_before_at_and_after_refills() {
        for cursor in [0, 1, 623, 624, 625, 1248, 1249, 2000] {
            let mut original = Sfmt19937::new(0xdead_beef);
            for _ in 0..cursor {
                original.next_u32();
            }
            let saved = serde_json::to_string(&original).unwrap();
            let mut resumed: Sfmt19937 = serde_json::from_str(&saved).unwrap();
            assert_eq!(original, resumed);
            for _ in 0..1300 {
                assert_eq!(original.next_u32(), resumed.next_u32());
            }
        }
    }

    #[test]
    fn matches_c_mixed_lua_wrappers_and_their_draw_consumption() {
        fn integer(value: &Value) -> i32 {
            value.as_i64().unwrap() as i32
        }
        fn bits(value: &Value) -> u64 {
            u64::from_str_radix(value.as_str().unwrap(), 16).unwrap()
        }
        for row in fixture()["seeds"].as_array().unwrap() {
            let seed = row["seed"].as_u64().unwrap() as u32;
            let mut rng = Sfmt19937::new(seed);
            for (i, draw) in row["wrappers"].as_array().unwrap().iter().enumerate() {
                let d = &draw["call"];
                assert_eq!(
                    rng.call(integer(&d[0])),
                    d[1].as_u64().unwrap() as u32,
                    "seed {seed}, call {i}"
                );
                let d = &draw["chance"];
                assert_eq!(
                    rng.chance(integer(&d[0])),
                    integer(&d[1]) != 0,
                    "seed {seed}, chance {i}"
                );
                let d = &draw["percent"];
                assert_eq!(
                    rng.percent(integer(&d[0])),
                    integer(&d[1]) != 0,
                    "seed {seed}, percent {i}"
                );
                let d = &draw["float"];
                assert_eq!(
                    rng.float(d[0].as_f64().unwrap(), d[1].as_f64().unwrap())
                        .to_bits(),
                    bits(&d[2]),
                    "seed {seed}, float {i}"
                );
                let d = &draw["dice"];
                assert_eq!(
                    rng.dice(integer(&d[0]), integer(&d[1])).unwrap(),
                    integer(&d[2]),
                    "seed {seed}, dice {i}"
                );
                let d = &draw["average"];
                assert_eq!(
                    rng.average(integer(&d[0]), integer(&d[1]), integer(&d[2]))
                        .unwrap()
                        .to_bits(),
                    bits(&d[3]),
                    "seed {seed}, average {i}"
                );
            }
        }
    }

    #[test]
    fn rejects_incompatible_or_corrupt_state() {
        let valid = serde_json::to_value(Sfmt19937::new(1234)).unwrap();
        for (field, value) in [
            ("algorithm_version", serde_json::json!(2)),
            ("index", serde_json::json!(625)),
            ("state", serde_json::json!([])),
        ] {
            let mut malformed = valid.clone();
            malformed[field] = value;
            assert!(serde_json::from_value::<Sfmt19937>(malformed).is_err());
        }
        let mut malformed = valid.clone();
        malformed["state"] = serde_json::json!(vec![[0u32; 4]; BLOCKS]);
        assert!(serde_json::from_value::<Sfmt19937>(malformed).is_err());
        let mut malformed = valid;
        malformed["unknown"] = serde_json::json!(true);
        assert!(serde_json::from_value::<Sfmt19937>(malformed).is_err());
    }

    #[test]
    fn trivial_ranges_do_not_advance_but_percent_and_float_do() {
        let mut rng = Sfmt19937::new(1);
        let start = rng.clone();
        assert_eq!(rng.rand_div(0), 0);
        assert_eq!(rng.rand_div(1), 0);
        assert_eq!(rng.range(-8, -8), Ok(-8));
        assert_eq!(rng.normal(3, 0), Ok(3));
        assert!(rng.chance(1));
        assert_eq!(rng.dice(5, 0), Ok(5));
        assert_eq!(rng, start);
        assert!(!rng.percent(0));
        assert_ne!(rng, start);
        let after_percent = rng.clone();
        assert_eq!(rng.float(4.0, 4.0), 4.0);
        assert_ne!(rng, after_percent);
    }

    #[test]
    fn invalid_inputs_do_not_consume_rng() {
        let mut rng = Sfmt19937::new(1);
        let start = rng.clone();
        assert_eq!(rng.range(i32::MIN, i32::MAX), Err(RngError::RangeOverflow));
        assert_eq!(rng.normal(i32::MAX, 2), Err(RngError::ResultOverflow));
        assert_eq!(rng.normal(0, i32::MAX), Err(RngError::ResultOverflow));
        assert_eq!(rng.dice(i32::MAX, 2), Err(RngError::ResultOverflow));
        assert_eq!(rng.average(0, 2, 0), Err(RngError::InvalidAverage));
        assert_eq!(rng, start);
    }
}
