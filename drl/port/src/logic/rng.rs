//! Exact TRNG algorithms from FPC Valkyrie 0_10_11, src/vrandom.pas.
//! MT19937 notices are retained in licenses/MT19937.txt.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RngState {
    pub words: Vec<u32>,
    pub index: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GameRng {
    words: [u32; 624],
    index: usize,
}

impl GameRng {
    pub fn seeded(seed: u32) -> Self {
        let mut words = [0; 624];
        words[0] = seed;
        for i in 1..624 {
            words[i] = 1_812_433_253_u32
                .wrapping_mul(words[i - 1] ^ (words[i - 1] >> 30))
                .wrapping_add(i as u32);
        }
        Self { words, index: 624 }
    }

    pub fn snapshot(&self) -> RngState {
        RngState {
            words: self.words.to_vec(),
            index: self.index,
        }
    }

    pub fn restore(state: RngState) -> Result<Self, &'static str> {
        if state.index > 624 {
            return Err("rng index exceeds 624");
        }
        let words = state
            .words
            .try_into()
            .map_err(|_| "rng state must contain 624 words")?;
        Ok(Self {
            words,
            index: state.index,
        })
    }

    fn twist(&mut self) {
        // In-place loop ordering matches the original, including the wrapped second part.
        for i in 0..624 {
            let value = (self.words[i] & 0x8000_0000) | (self.words[(i + 1) % 624] & 0x7fff_ffff);
            self.words[i] = self.words[(i + 397) % 624]
                ^ (value >> 1)
                ^ if value & 1 != 0 { 0x9908_b0df } else { 0 };
        }
        self.index = 0;
    }

    pub fn next_u32(&mut self) -> u32 {
        if self.index >= 624 {
            self.twist();
        }
        let mut value = self.words[self.index];
        self.index += 1;
        value ^= value >> 11;
        value ^= (value << 7) & 0x9d2c_5680;
        value ^= (value << 15) & 0xefc6_0000;
        value ^ (value >> 18)
    }

    /// Preserves the legacy modulo branch for ranges <= 65536; changing its
    /// statistical bias would change every existing seed's gameplay sequence.
    pub fn bounded(&mut self, range: u32) -> u32 {
        if range == 0 {
            return 0;
        }
        if range <= 0x1_0000 {
            return self.next_u32() % range;
        }
        if range.is_power_of_two() {
            return self.next_u32() & (range - 1);
        }
        let cardinality = 1_u64 << 32;
        let limit = cardinality - cardinality % u64::from(range);
        loop {
            let value = self.next_u32();
            if u64::from(value) < limit {
                return value % range;
            }
        }
    }

    pub fn inclusive(&mut self, min: u32, max: u32) -> u32 {
        if min >= max {
            return min;
        }
        let span = u64::from(max) - u64::from(min) + 1;
        if span == 1_u64 << 32 {
            self.next_u32()
        } else {
            min + self.bounded(span as u32)
        }
    }

    pub fn dice(&mut self, number: u32, sides: u32) -> u32 {
        if number == 0 || sides == 0 {
            return 0;
        }
        if sides == 1 {
            return number;
        }
        (0..number).fold(0_u32, |sum, _| sum.wrapping_add(self.bounded(sides) + 1))
    }

    pub fn unit_f32(&mut self) -> f32 {
        (self.next_u32() >> 8) as f32 * (1.0 / 16_777_216.0)
    }

    pub fn range_f32(&mut self, range: f32) -> f32 {
        if range <= 0.0 || range.is_nan() {
            return 0.0;
        }
        let unit = self.unit_f32();
        if unit == 0.0 {
            return 0.0;
        }
        let value = (f64::from(unit) * f64::from(range)) as f32;
        if value < range {
            value
        } else {
            f32::from_bits(range.to_bits() - 1)
        }
    }

    pub fn inclusive_f32(&mut self, min: f32, max: f32) -> f32 {
        if max <= min || max.is_nan() || min.is_nan() {
            return min;
        }
        let value = self.next_u32() >> 8;
        if value == 0 {
            return min;
        }
        if value == 0xff_ffff {
            return max;
        }
        (f64::from(min) + (f64::from(max) - f64::from(min)) * (f64::from(value) / 16_777_215.0))
            as f32
    }

    pub fn unit_f64(&mut self) -> f64 {
        let high = self.next_u32() >> 5;
        let low = self.next_u32() >> 6;
        (f64::from(high) * 67_108_864.0 + f64::from(low)) * (1.0 / 9_007_199_254_740_992.0)
    }

    pub fn next_u64(&mut self) -> u64 {
        (u64::from(self.next_u32()) << 32) | u64::from(self.next_u32())
    }
    pub fn next_i32(&mut self) -> i32 {
        i32::from_ne_bytes(self.next_u32().to_ne_bytes())
    }
    pub fn next_i64(&mut self) -> i64 {
        i64::from_ne_bytes(self.next_u64().to_ne_bytes())
    }
    pub fn bounded_i32(&mut self, range: i32) -> i32 {
        if range <= 0 {
            0
        } else {
            self.bounded(range as u32) as i32
        }
    }
    pub fn inclusive_i32(&mut self, min: i32, max: i32) -> i32 {
        if min >= max {
            return min;
        }
        let span = (i64::from(max) - i64::from(min) + 1) as u64;
        let offset = if span == 1_u64 << 32 {
            self.next_u32()
        } else {
            self.bounded(span as u32)
        };
        (i64::from(min) + i64::from(offset)) as i32
    }
}
