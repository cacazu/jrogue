//! Platform storage format for an opaque original Angband save payload.
//! C owns all gameplay and RNG state. This layer validates transport metadata,
//! preserves a C-supplied boundary RNG checkpoint and ordered command journal,
//! and never advances or simulates the random number generator.

use crate::input::Command;
use std::fmt;

/// Exact original logic source supported by this first save format.
pub const SOURCE_COMMIT: &str = "f3082213b73f3e463e3d0d60bff4b00462beae6e";
pub const GAME_VERSION: &str = "4.2.6";
pub const ENVELOPE_VERSION: u16 = 2;
pub const LEGACY_ENVELOPE_VERSION: u16 = 1;
/// Version 3 is an independent deterministic-bootstrap transport. Old journals
/// remain direct checkpoints; they are never guessed into replay inputs.
pub const REPLAY_ENVELOPE_VERSION: u16 = 3;
pub const RNG_WORDS: usize = 38;
/// [quick, Rand_value, state_i, z0, z1, z2, STATE[0..31]], supplied by C.
pub type RngSnapshot = [u32; RNG_WORDS];
pub const MAX_PAYLOAD_BYTES: usize = 32 * 1024 * 1024;
pub const MAX_JOURNAL_ENTRIES: usize = 262_144;
const MAGIC: &[u8; 8] = b"ABRSAVE\0";
const LEGACY_HEADER_BYTES: usize = 8 + 2 + 40 + 5 + 4 + 4;
const HEADER_BYTES: usize = LEGACY_HEADER_BYTES + 2;
const ENTRY_BYTES: usize = 12;
pub const MAX_ENVELOPE_BYTES: usize =
    HEADER_BYTES + RNG_WORDS * 4 + MAX_PAYLOAD_BYTES + MAX_JOURNAL_ENTRIES * ENTRY_BYTES + 4;

/// A command sent to C; timing, rendering, and UI animation are excluded.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct JournalEntry {
    pub sequence: u64,
    pub packed_input: u32,
}

/// Lossless storage of the original save plus the command journal.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SaveEnvelope {
    pub payload: Vec<u8>,
    pub journal: Vec<JournalEntry>,
    /// None for legacy schema 1 or an explicitly checkpoint-free schema 2 save.
    pub rng: Option<RngSnapshot>,
}

/// Stable platform errors. Codes are exposed through `ab_rs_save_status`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum SaveError {
    InvalidMagic = 1,
    EnvelopeVersion = 2,
    SourceVersion = 3,
    TooLarge = 4,
    Truncated = 5,
    Checksum = 6,
    InvalidJournal = 7,
    InvalidPointer = 8,
    InvalidRng = 9,
}

impl fmt::Display for SaveError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::InvalidMagic => "invalid Angband save envelope signature",
            Self::EnvelopeVersion => "unsupported save envelope version",
            Self::SourceVersion => "save belongs to a different Angband source version",
            Self::TooLarge => "save exceeds the platform storage limit",
            Self::Truncated => "save length does not match its envelope",
            Self::Checksum => "save checksum does not match",
            Self::InvalidJournal => "save has an invalid command journal",
            Self::InvalidPointer => "save buffer pointer is invalid",
            Self::InvalidRng => "save has an invalid RNG checkpoint",
        })
    }
}
impl std::error::Error for SaveError {}

impl SaveEnvelope {
    /// Encode original bytes without changing any gameplay or RNG state.
    ///
    /// # Errors
    /// Rejects excessive sizes or a nonsequential/invalid command journal.
    pub fn encode(&self) -> Result<Vec<u8>, SaveError> {
        if self.payload.len() > MAX_PAYLOAD_BYTES || self.journal.len() > MAX_JOURNAL_ENTRIES {
            return Err(SaveError::TooLarge);
        }
        validate_journal(&self.journal)?;
        if let Some(rng) = &self.rng {
            validate_rng(rng)?;
        }
        let rng_bytes = if self.rng.is_some() { RNG_WORDS * 4 } else { 0 };
        let mut out = Vec::with_capacity(
            HEADER_BYTES + rng_bytes + self.payload.len() + self.journal.len() * ENTRY_BYTES + 4,
        );
        out.extend_from_slice(MAGIC);
        out.extend_from_slice(&ENVELOPE_VERSION.to_le_bytes());
        out.extend_from_slice(SOURCE_COMMIT.as_bytes());
        out.extend_from_slice(GAME_VERSION.as_bytes());
        out.extend_from_slice(&(self.payload.len() as u32).to_le_bytes());
        out.extend_from_slice(&(self.journal.len() as u32).to_le_bytes());
        out.extend_from_slice(
            &(if self.rng.is_some() {
                RNG_WORDS as u16
            } else {
                0
            })
            .to_le_bytes(),
        );
        if let Some(rng) = &self.rng {
            for word in rng {
                out.extend_from_slice(&word.to_le_bytes());
            }
        }
        out.extend_from_slice(&self.payload);
        for entry in &self.journal {
            out.extend_from_slice(&entry.sequence.to_le_bytes());
            out.extend_from_slice(&entry.packed_input.to_le_bytes());
        }
        out.extend_from_slice(&crc32(&out).to_le_bytes());
        Ok(out)
    }

    /// Validate compatibility, bounds, complete checksum, and command ordering.
    ///
    /// # Errors
    /// Rejects unrecognized versions, malformed/truncated or corrupt bytes,
    /// oversized content, trailing data, and invalid journal entries.
    pub fn decode(bytes: &[u8]) -> Result<Self, SaveError> {
        if bytes.len() > MAX_ENVELOPE_BYTES {
            return Err(SaveError::TooLarge);
        }
        if bytes.len() < LEGACY_HEADER_BYTES + 4 {
            return Err(SaveError::Truncated);
        }
        if &bytes[..8] != MAGIC {
            return Err(SaveError::InvalidMagic);
        }
        let version = u16::from_le_bytes([bytes[8], bytes[9]]);
        if version != ENVELOPE_VERSION && version != LEGACY_ENVELOPE_VERSION {
            return Err(SaveError::EnvelopeVersion);
        }
        if &bytes[10..50] != SOURCE_COMMIT.as_bytes() || &bytes[50..55] != GAME_VERSION.as_bytes() {
            return Err(SaveError::SourceVersion);
        }
        let payload_len = read_u32(bytes, 55) as usize;
        let journal_count = read_u32(bytes, 59) as usize;
        if payload_len > MAX_PAYLOAD_BYTES || journal_count > MAX_JOURNAL_ENTRIES {
            return Err(SaveError::TooLarge);
        }
        let (header_bytes, rng_words) = if version == ENVELOPE_VERSION {
            if bytes.len() < HEADER_BYTES + 4 {
                return Err(SaveError::Truncated);
            }
            let words =
                u16::from_le_bytes([bytes[LEGACY_HEADER_BYTES], bytes[LEGACY_HEADER_BYTES + 1]])
                    as usize;
            if words != 0 && words != RNG_WORDS {
                return Err(SaveError::InvalidRng);
            }
            (HEADER_BYTES, words)
        } else {
            (LEGACY_HEADER_BYTES, 0)
        };
        let payload_start = header_bytes + rng_words * 4;
        let expected_len = payload_start + payload_len + journal_count * ENTRY_BYTES + 4;
        if bytes.len() != expected_len {
            return Err(SaveError::Truncated);
        }
        let checksum_offset = bytes.len() - 4;
        if read_u32(bytes, checksum_offset) != crc32(&bytes[..checksum_offset]) {
            return Err(SaveError::Checksum);
        }
        let rng = if rng_words == RNG_WORDS {
            let mut snapshot = [0; RNG_WORDS];
            for (index, word) in snapshot.iter_mut().enumerate() {
                *word = read_u32(bytes, header_bytes + index * 4);
            }
            validate_rng(&snapshot)?;
            Some(snapshot)
        } else {
            None
        };
        let payload_end = payload_start + payload_len;
        let mut journal = Vec::with_capacity(journal_count);
        for entry in bytes[payload_end..checksum_offset].chunks_exact(ENTRY_BYTES) {
            let sequence = u64::from_le_bytes([
                entry[0], entry[1], entry[2], entry[3], entry[4], entry[5], entry[6], entry[7],
            ]);
            journal.push(JournalEntry {
                sequence,
                packed_input: read_u32(entry, 8),
            });
        }
        validate_journal(&journal)?;
        Ok(Self {
            payload: bytes[payload_start..payload_end].to_vec(),
            journal,
            rng,
        })
    }
}

fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

/// Validate control fields without changing or generating any RNG values.
pub fn validate_rng(snapshot: &RngSnapshot) -> Result<(), SaveError> {
    if snapshot[0] > 1 || snapshot[2] >= 32 {
        return Err(SaveError::InvalidRng);
    }
    Ok(())
}

fn validate_journal(journal: &[JournalEntry]) -> Result<(), SaveError> {
    for (index, entry) in journal.iter().enumerate() {
        if entry.sequence != index as u64 || Command::from_packed(entry.packed_input).is_none() {
            return Err(SaveError::InvalidJournal);
        }
    }
    Ok(())
}

/// Standard IEEE CRC-32 for accidental storage corruption detection.
/// This is not an authentication mechanism.
#[must_use]
pub fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = !0_u32;
    for byte in bytes {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            crc = (crc >> 1) ^ (0xedb8_8320_u32 & 0_u32.wrapping_sub(crc & 1));
        }
    }
    !crc
}

#[cfg(test)]
mod tests {
    use super::*;
    fn envelope() -> SaveEnvelope {
        SaveEnvelope {
            payload: vec![0, 255, 7, 0, 41, 42],
            journal: vec![JournalEntry {
                sequence: 0,
                packed_input: Command::sanitize(64, 0).unwrap().packed(),
            }],
            rng: None,
        }
    }
    #[test]
    fn deterministic_roundtrip_preserves_all_original_payload_bytes() {
        let expected = envelope();
        let one = expected.encode().unwrap();
        assert_eq!(one, expected.encode().unwrap());
        assert_eq!(SaveEnvelope::decode(&one).unwrap(), expected);
        assert_eq!(crc32(b"123456789"), 0xcbf4_3926);
    }
    #[test]
    fn source_and_envelope_version_mismatches_are_rejected() {
        let mut bytes = envelope().encode().unwrap();
        bytes[8] = 3;
        assert_eq!(
            SaveEnvelope::decode(&bytes),
            Err(SaveError::EnvelopeVersion)
        );
        let mut bytes = envelope().encode().unwrap();
        bytes[10] = b'x';
        assert_eq!(SaveEnvelope::decode(&bytes), Err(SaveError::SourceVersion));
        let mut bytes = envelope().encode().unwrap();
        bytes[54] = b'7';
        assert_eq!(SaveEnvelope::decode(&bytes), Err(SaveError::SourceVersion));
    }
    #[test]
    fn corruption_truncation_trailing_bytes_and_size_attacks_are_rejected() {
        let mut bytes = envelope().encode().unwrap();
        bytes[HEADER_BYTES] ^= 1;
        assert_eq!(SaveEnvelope::decode(&bytes), Err(SaveError::Checksum));
        bytes.pop();
        assert_eq!(SaveEnvelope::decode(&bytes), Err(SaveError::Truncated));
        let mut bytes = envelope().encode().unwrap();
        bytes.push(0);
        assert_eq!(SaveEnvelope::decode(&bytes), Err(SaveError::Truncated));
        bytes[55..59].copy_from_slice(&u32::MAX.to_le_bytes());
        assert_eq!(SaveEnvelope::decode(&bytes), Err(SaveError::TooLarge));
    }
    #[test]
    fn journal_requires_normalized_inputs_and_contiguous_sequence() {
        let mut bad = envelope();
        bad.journal[0].sequence = 4;
        assert_eq!(bad.encode(), Err(SaveError::InvalidJournal));
        bad.journal[0].sequence = 0;
        bad.journal[0].packed_input = 0xd800;
        assert_eq!(bad.encode(), Err(SaveError::InvalidJournal));
    }

    fn full_rng() -> RngSnapshot {
        let mut rng = std::array::from_fn(|index| (index as u32).wrapping_mul(0x01020304));
        rng[0] = 1;
        rng[1] = 0x01234567;
        rng[2] = 31;
        rng
    }

    fn refresh_checksum(bytes: &mut [u8]) {
        let offset = bytes.len() - 4;
        let checksum = crc32(&bytes[..offset]);
        bytes[offset..].copy_from_slice(&checksum.to_le_bytes());
    }

    #[test]
    fn schema_two_preserves_full_rng_words_and_unmodified_native_payload() {
        let mut expected = envelope();
        expected.rng = Some(full_rng());
        let bytes = expected.encode().unwrap();
        assert_eq!(&bytes[8..10], &2_u16.to_le_bytes());
        assert_eq!(
            &bytes[LEGACY_HEADER_BYTES..HEADER_BYTES],
            &38_u16.to_le_bytes()
        );
        let exact_rng_bytes: Vec<u8> = full_rng().into_iter().flat_map(u32::to_le_bytes).collect();
        assert_eq!(
            &bytes[HEADER_BYTES..HEADER_BYTES + RNG_WORDS * 4],
            exact_rng_bytes
        );
        let payload_start = HEADER_BYTES + RNG_WORDS * 4;
        assert_eq!(
            &bytes[payload_start..payload_start + expected.payload.len()],
            expected.payload
        );
        assert_eq!(SaveEnvelope::decode(&bytes).unwrap(), expected);
        assert_eq!(bytes, expected.encode().unwrap());
    }

    #[test]
    fn schema_two_checksum_covers_the_complete_rng_checkpoint() {
        let mut save = envelope();
        save.rng = Some(full_rng());
        let original = save.encode().unwrap();
        for word in 0..RNG_WORDS {
            let mut corrupted = original.clone();
            corrupted[HEADER_BYTES + word * 4] ^= 1;
            assert_eq!(SaveEnvelope::decode(&corrupted), Err(SaveError::Checksum));
        }
    }

    #[test]
    fn schema_two_rejects_bad_rng_lengths_and_control_fields() {
        let mut save = envelope();
        let mut invalid = full_rng();
        invalid[0] = 2;
        save.rng = Some(invalid);
        assert_eq!(save.encode(), Err(SaveError::InvalidRng));
        invalid = full_rng();
        invalid[2] = 32;
        save.rng = Some(invalid);
        assert_eq!(save.encode(), Err(SaveError::InvalidRng));
        save.rng = Some(full_rng());
        let original = save.encode().unwrap();
        for count in [1_u16, 37, 39, u16::MAX] {
            let mut bytes = original.clone();
            bytes[LEGACY_HEADER_BYTES..HEADER_BYTES].copy_from_slice(&count.to_le_bytes());
            refresh_checksum(&mut bytes);
            assert_eq!(SaveEnvelope::decode(&bytes), Err(SaveError::InvalidRng));
        }
        for (index, value) in [(0, 2_u32), (2, 32)] {
            let mut bytes = original.clone();
            let offset = HEADER_BYTES + index * 4;
            bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
            refresh_checksum(&mut bytes);
            assert_eq!(SaveEnvelope::decode(&bytes), Err(SaveError::InvalidRng));
        }
        let mut no_rng = envelope().encode().unwrap();
        no_rng[LEGACY_HEADER_BYTES..HEADER_BYTES].copy_from_slice(&38_u16.to_le_bytes());
        refresh_checksum(&mut no_rng);
        assert_eq!(SaveEnvelope::decode(&no_rng), Err(SaveError::Truncated));
    }

    #[test]
    fn legacy_schema_one_keeps_original_payload_and_journal_without_rng_metadata() {
        let expected = envelope();
        let bytes = legacy_fixture(&expected.payload, &expected.journal);
        assert_eq!(SaveEnvelope::decode(&bytes).unwrap(), expected);
        assert_eq!(SaveEnvelope::decode(&bytes).unwrap().rng, None);
        let mut corrupted = bytes;
        corrupted[LEGACY_HEADER_BYTES] ^= 1;
        assert_eq!(SaveEnvelope::decode(&corrupted), Err(SaveError::Checksum));
    }
}

// Independent reproduction of the already-shipped schema 1 fixture layout.
// Only tests use this writer; production always emits schema 2.
#[cfg(test)]
pub(crate) fn legacy_fixture(payload: &[u8], journal: &[JournalEntry]) -> Vec<u8> {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(MAGIC);
    bytes.extend_from_slice(&LEGACY_ENVELOPE_VERSION.to_le_bytes());
    bytes.extend_from_slice(SOURCE_COMMIT.as_bytes());
    bytes.extend_from_slice(GAME_VERSION.as_bytes());
    bytes.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    bytes.extend_from_slice(&(journal.len() as u32).to_le_bytes());
    bytes.extend_from_slice(payload);
    for entry in journal {
        bytes.extend_from_slice(&entry.sequence.to_le_bytes());
        bytes.extend_from_slice(&entry.packed_input.to_le_bytes());
    }
    bytes.extend_from_slice(&crc32(&bytes).to_le_bytes());
    bytes
}
