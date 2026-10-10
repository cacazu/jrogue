//! Deterministic DCSS 0.34.1 PCG and persistent stream migration.
//!
//! Source: `crawl-ref/source/{pcg.cc,random.cc,rng-type.h,branch-type.h}` at
//! commit `1eebc1a2892e1c89776a0d7a10691f8dac8d9796`.
//! DCSS-derived stream management is GPL-2.0-or-later. PCG initialization and
//! output derive from Melissa O'Neill's (c) 2014 Apache-2.0 implementation;
//! bounded sampling derives from her (c) 2018 MIT implementation of Daniel
//! Lemire's algorithm. Preserve these notices and the accompanying licenses.

use serde::{Deserialize, Serialize};

/// DCSS's default sequence, not the sequence used in a generic PCG example.
pub const DEFAULT_SEQUENCE: u64 = 2_305_843_009_213_693_951;
/// `NUM_BRANCHES` for the pinned release's default `TAG_MAJOR_VERSION == 34`.
/// Includes obsolete save-compatible branches; removing them changes seeding.
pub const NUM_BRANCHES: usize = 40;
/// Five general streams, followed by one stream per branch (`LEVELGEN == 5`).
pub const NUM_RNGS: usize = 5 + NUM_BRANCHES;

/// PCG XSH RR 64/32, with the exact DCSS initialization and draw counting.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PcgRng {
    state: u64,
    increment: u64,
    count: u64,
}

impl PcgRng {
    /// Initialize a stream; the top bit of `sequence` is discarded upstream.
    #[must_use]
    pub fn new(seed: u64, sequence: u64) -> Self {
        let mut rng = Self {
            state: 0,
            increment: sequence.wrapping_shl(1) | 1,
            count: 0,
        };
        rng.next_u32();
        rng.state = rng.state.wrapping_add(seed);
        rng.next_u32();
        rng.count = 0;
        rng
    }

    /// Initialize the default stream, matching `PcgRNG(uint64_t)`.
    #[must_use]
    pub fn from_seed(seed: u64) -> Self {
        Self::new(seed, DEFAULT_SEQUENCE)
    }

    /// Validate a restored snapshot before accepting it as simulation state.
    #[must_use]
    pub const fn is_valid(&self) -> bool {
        self.increment & 1 == 1
    }

    /// Reject invalid restored state before any gameplay draw.
    /// The diagnostic is for application validation, not player-facing text.
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.is_valid() {
            Ok(())
        } else {
            Err("PCG increment must be odd")
        }
    }

    /// Current internal state. This is not a random draw.
    #[must_use]
    pub const fn state(&self) -> u64 {
        self.state
    }

    /// Odd PCG increment, already derived from the constructor's sequence.
    #[must_use]
    pub const fn increment(&self) -> u64 {
        self.increment
    }

    /// Count of 32-bit draws since initialization or the upstream-format load.
    #[must_use]
    pub const fn count(&self) -> u64 {
        self.count
    }

    /// Draw a 32-bit value, advancing state with explicit unsigned wrapping.
    pub fn next_u32(&mut self) -> u32 {
        let old_state = self.state;
        self.count = self.count.wrapping_add(1);
        self.state = old_state
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(self.increment | 1);
        // Both narrowing conversions intentionally retain low bits like C++.
        let xorshifted = (((old_state >> 18) ^ old_state) >> 27) as u32;
        let rotation = (old_state >> 59) as u32;
        xorshifted.rotate_right(rotation)
    }

    /// Draw high then low words, matching DCSS's ordered `get_uint64()`.
    pub fn next_u64(&mut self) -> u64 {
        (u64::from(self.next_u32()) << 32) | u64::from(self.next_u32())
    }

    /// Sample `[0, range)`, matching the upstream rejection algorithm exactly.
    /// A direct bound of zero returns zero but consumes one draw upstream.
    pub fn bounded_u32(&mut self, range: u32) -> u32 {
        let mut product = u64::from(self.next_u32()) * u64::from(range);
        let mut low = product as u32;
        if low < range {
            let mut threshold = range.wrapping_neg();
            if threshold >= range {
                threshold -= range;
                if threshold >= range {
                    threshold %= range;
                }
            }
            while low < threshold {
                product = u64::from(self.next_u32()) * u64::from(range);
                low = product as u32;
            }
        }
        (product >> 32) as u32
    }

    /// DCSS `random2`: bounds <= 1 return zero and consume no random state.
    pub fn random2(&mut self, max: i32) -> i32 {
        if max <= 1 {
            0
        } else {
            self.bounded_u32(max as u32) as i32
        }
    }

    /// Observe the next word without advancing simulation state.
    #[must_use]
    pub fn peek_u32(&self) -> u32 {
        self.clone().next_u32()
    }

    /// Observe the next two words without advancing simulation state.
    #[must_use]
    pub fn peek_u64(&self) -> u64 {
        self.clone().next_u64()
    }

    /// Exact IEEE-754 construction used by DCSS `random_real`, in `[0, 1)`.
    pub fn random_real(&mut self) -> f64 {
        let value = 0x3ff0_0000_0000_0000 | (self.next_u64() & 0x000f_ffff_ffff_ffff);
        f64::from_bits(value) - 1.0
    }

    /// Native DCSS's two signed save words. Bit patterns are preserved.
    /// Native DCSS omits the diagnostic draw counter from these words.
    #[must_use]
    pub fn upstream_words(&self) -> [i64; 2] {
        [self.state as i64, self.increment as i64]
    }

    /// Restore native DCSS RNG save words, resetting its unsaved draw counter.
    /// Returns `None` when the stored PCG increment is invalid.
    #[must_use]
    pub fn from_upstream_words(words: [i64; 2]) -> Option<Self> {
        let rng = Self {
            state: words[0] as u64,
            increment: words[1] as u64,
            count: 0,
        };
        rng.is_valid().then_some(rng)
    }
}

/// A pinned upstream branch ordinal, including historical compatibility slots.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BranchId(usize);

impl BranchId {
    /// Construct only an ordinal present in the pinned branch enum.
    #[must_use]
    pub fn new(index: usize) -> Option<Self> {
        (index < NUM_BRANCHES).then_some(Self(index))
    }
    /// Original DCSS branch ordinal.
    #[must_use]
    pub const fn index(self) -> usize {
        self.0
    }
}

/// Persistent upstream RNG role. Temporary subgenerators remain explicit PCGs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamId {
    Gameplay,
    Ui,
    SystemSpecific,
    Spare2,
    Spare3,
    Branch(BranchId),
}

impl StreamId {
    /// Position in the upstream persistent stream vector.
    #[must_use]
    pub const fn index(self) -> usize {
        match self {
            Self::Gameplay => 0,
            Self::Ui => 1,
            Self::SystemSpecific => 2,
            Self::Spare2 => 3,
            Self::Spare3 => 4,
            Self::Branch(branch) => 5 + branch.0,
        }
    }
}

/// All 45 persistent streams, seeded from a master in upstream vector order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RngStreams {
    streams: Vec<PcgRng>,
}

impl RngStreams {
    /// Match `rng::seed(uint64_t)` and `_do_seeding`: four master draws each.
    #[must_use]
    pub fn seeded(seed: u64) -> Self {
        let mut master = PcgRng::from_seed(seed);
        let streams = (0..NUM_RNGS)
            .map(|_| {
                let state = master.next_u64();
                let sequence = master.next_u64();
                PcgRng::new(state, sequence)
            })
            .collect();
        Self { streams }
    }

    /// Validate every restored stream and the release-specific stream count.
    #[must_use]
    pub fn is_valid(&self) -> bool {
        self.streams.len() == NUM_RNGS && self.streams.iter().all(PcgRng::is_valid)
    }

    /// Borrow one stream without affecting any other role's state.
    pub fn stream_mut(&mut self, role: StreamId) -> &mut PcgRng {
        &mut self.streams[role.index()]
    }
    /// Borrow one stream read-only, for save or purity checks.
    #[must_use]
    pub fn stream(&self, role: StreamId) -> &PcgRng {
        &self.streams[role.index()]
    }
    /// Gameplay stream convenience accessor.
    pub fn gameplay_mut(&mut self) -> &mut PcgRng {
        self.stream_mut(StreamId::Gameplay)
    }
    /// UI stream convenience accessor; separate from gameplay.
    pub fn ui_mut(&mut self) -> &mut PcgRng {
        self.stream_mut(StreamId::Ui)
    }
    /// Level generation stream for a validated branch ordinal.
    pub fn branch_mut(&mut self, branch: BranchId) -> &mut PcgRng {
        self.stream_mut(StreamId::Branch(branch))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pcg_and_all_persistent_streams_match_compiled_upstream() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../../tests/reference_rng.json")).unwrap();
        assert_eq!(fixture["num_branches"].as_u64(), Some(NUM_BRANCHES as u64));
        assert_eq!(fixture["num_rngs"].as_u64(), Some(NUM_RNGS as u64));
        for case in fixture["pcg"].as_array().unwrap() {
            let seed = case["seed"].as_str().unwrap().parse().unwrap();
            let sequence = case["sequence"].as_str().unwrap().parse().unwrap();
            let mut rng = PcgRng::new(seed, sequence);
            for expected in case["raw"].as_array().unwrap() {
                assert_eq!(u64::from(rng.next_u32()), expected.as_u64().unwrap());
            }
            assert_eq!(
                rng.state(),
                case["state"].as_str().unwrap().parse::<u64>().unwrap()
            );
            assert_eq!(
                rng.increment(),
                case["increment"].as_str().unwrap().parse::<u64>().unwrap()
            );
            assert_eq!(rng.count(), case["count"].as_u64().unwrap());
            for draw in case["bounded"].as_array().unwrap() {
                assert_eq!(
                    u64::from(rng.bounded_u32(draw["bound"].as_u64().unwrap() as u32)),
                    draw["value"].as_u64().unwrap()
                );
                assert_eq!(rng.count(), draw["count"].as_u64().unwrap());
            }
            assert_eq!(
                rng.next_u64().to_string(),
                case["next_u64"].as_str().unwrap()
            );
        }
        for case in fixture["streams"].as_array().unwrap() {
            let mut streams = RngStreams::seeded(case["seed"].as_str().unwrap().parse().unwrap());
            for (index, expected) in case["values"].as_array().unwrap().iter().enumerate() {
                let rng = &mut streams.streams[index];
                assert_eq!(rng.state().to_string(), expected["state"].as_str().unwrap());
                assert_eq!(
                    rng.increment().to_string(),
                    expected["increment"].as_str().unwrap()
                );
                for value in expected["raw"].as_array().unwrap() {
                    assert_eq!(u64::from(rng.next_u32()), value.as_u64().unwrap());
                }
            }
        }
    }

    #[test]
    fn degenerate_random2_bounds_and_peeks_do_not_consume_state() {
        let mut rng = PcgRng::from_seed(42);
        let initial = rng.clone();
        for bound in [i32::MIN, -1, 0, 1] {
            assert_eq!(rng.random2(bound), 0);
        }
        assert_eq!(rng.peek_u32(), initial.peek_u32());
        assert_eq!(rng.peek_u64(), initial.peek_u64());
        assert_eq!(rng, initial);
        assert_eq!(rng.bounded_u32(0), 0);
        assert_eq!(rng.count(), 1);
    }

    #[test]
    fn json_and_native_rng_word_roundtrips_resume_exactly() {
        let mut original = PcgRng::from_seed(u64::MAX);
        for _ in 0..37 {
            original.bounded_u32(2_147_483_649);
        }
        let saved = serde_json::to_string(&original).unwrap();
        let mut restored: PcgRng = serde_json::from_str(&saved).unwrap();
        assert!(restored.is_valid());
        let mut native = PcgRng::from_upstream_words(original.upstream_words()).unwrap();
        assert_eq!(native.count(), 0);
        for _ in 0..128 {
            let next = original.next_u32();
            assert_eq!(restored.next_u32(), next);
            assert_eq!(native.next_u32(), next);
        }
        let invalid: PcgRng =
            serde_json::from_str(r#"{"state":1,"increment":2,"count":0}"#).unwrap();
        assert!(!invalid.is_valid());
        assert!(PcgRng::from_upstream_words([1, 2]).is_none());
    }

    #[test]
    fn ui_and_branch_draws_leave_gameplay_unchanged() {
        let mut streams = RngStreams::seeded(42);
        let gameplay = streams.stream(StreamId::Gameplay).clone();
        for _ in 0..100 {
            streams.ui_mut().next_u64();
            streams
                .branch_mut(BranchId::new(NUM_BRANCHES - 1).unwrap())
                .next_u32();
        }
        assert_eq!(streams.stream(StreamId::Gameplay), &gameplay);
        assert!(streams.is_valid());
        assert!(BranchId::new(NUM_BRANCHES).is_none());
        let mut invalid = streams;
        invalid.streams.pop();
        assert!(!invalid.is_valid());
    }

    #[test]
    fn all_persistent_streams_resume_after_json_restore() {
        let mut original = RngStreams::seeded(0x0123_4567_89ab_cdef);
        for index in 0..NUM_RNGS {
            for _ in 0..index {
                original.streams[index].bounded_u32(2_147_483_649);
            }
        }
        let saved = serde_json::to_vec(&original).unwrap();
        let mut restored: RngStreams = serde_json::from_slice(&saved).unwrap();
        assert!(restored.is_valid());
        assert_eq!(restored, original);
        for index in 0..NUM_RNGS {
            for _ in 0..32 {
                assert_eq!(
                    restored.streams[index].next_u64(),
                    original.streams[index].next_u64()
                );
            }
        }
    }
}
