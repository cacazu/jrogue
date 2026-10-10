//! Versioned save envelopes around opaque official-engine bytes.
//!
//! CRC32 detects accidental corruption; it is not authentication or encryption.
//! No engine state is changed until a caller has received a validated payload.

use std::fmt;

use serde::{Deserialize, Serialize};

/// Pinned official gameplay release.
pub const ENGINE_VERSION: &str = "5.0.0";
/// Official upstream release commit.
pub const ENGINE_COMMIT: &str = "16ff59115315917b93185d026aeefea06db9b0f4";
/// Browser shim ABI. Raw upstream saves from other ABIs are not accepted.
pub const ENGINE_ABI: &str = "nethack-shim-5.0.0-v1";
/// Application envelope schema version.
pub const SAVE_VERSION: u32 = 1;
/// Maximum opaque save payload, before hex encoding.
pub const MAX_SAVE_BYTES: usize = 16 * 1024 * 1024;
/// JSON envelope bound includes the maximum hex payload and metadata.
pub const MAX_ENVELOPE_BYTES: usize = MAX_SAVE_BYTES * 2 + 4096;
const SAVE_FORMAT: &str = "jrogue.nethack.save";

/// Engine/source metadata must match before restore.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineIdentity {
    pub version: String,
    pub commit: String,
    pub abi: String,
}

impl Default for EngineIdentity {
    fn default() -> Self {
        Self {
            version: ENGINE_VERSION.to_owned(),
            commit: ENGINE_COMMIT.to_owned(),
            abi: ENGINE_ABI.to_owned(),
        }
    }
}

/// A platform-agnostic, bounded JSON save file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SaveEnvelope {
    pub format: String,
    pub version: u32,
    pub engine: EngineIdentity,
    pub encoding: String,
    pub payload_len: usize,
    pub checksum: Checksum,
    pub payload: String,
}

/// Explicit checksum scheme for future envelope migration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Checksum {
    pub algorithm: String,
    pub value: String,
}

/// Recoverable invalid or incompatible save errors.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SaveError {
    Empty,
    TooLarge,
    InvalidJson,
    IncompatibleFormat,
    IncompatibleVersion,
    IncompatibleEngine,
    InvalidEncoding,
    InvalidLength,
    InvalidChecksum,
}

impl fmt::Display for SaveError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Empty => "empty engine save payload",
            Self::TooLarge => "save exceeds size limits",
            Self::InvalidJson => "invalid save JSON",
            Self::IncompatibleFormat => "incompatible save envelope format",
            Self::IncompatibleVersion => "incompatible save envelope version",
            Self::IncompatibleEngine => "incompatible engine source or ABI",
            Self::InvalidEncoding => "invalid save payload encoding",
            Self::InvalidLength => "save payload length mismatch",
            Self::InvalidChecksum => "save checksum mismatch",
        })
    }
}

impl std::error::Error for SaveError {}

/// Wrap opaque bytes captured by the official engine's save boundary.
///
/// # Errors
/// Rejects empty or oversized bytes. Does not establish that the opaque bytes
/// are a logical engine checkpoint; the engine adapter owns that responsibility.
pub fn wrap_save(payload: &[u8]) -> Result<Vec<u8>, SaveError> {
    if payload.is_empty() {
        return Err(SaveError::Empty);
    }
    if payload.len() > MAX_SAVE_BYTES {
        return Err(SaveError::TooLarge);
    }
    let envelope = SaveEnvelope {
        format: SAVE_FORMAT.to_owned(),
        version: SAVE_VERSION,
        engine: EngineIdentity::default(),
        encoding: "hex".to_owned(),
        payload_len: payload.len(),
        checksum: Checksum {
            algorithm: "crc32".to_owned(),
            value: format!("{:08x}", crc32(payload)),
        },
        payload: encode_hex(payload),
    };
    serde_json::to_vec(&envelope).map_err(|_| SaveError::InvalidJson)
}

/// Validate the entire envelope before returning any restorable engine bytes.
///
/// # Errors
/// Rejects malformed JSON, unknown fields, incompatible version/source/ABI,
/// noncanonical hex, inconsistent lengths, and mismatching CRC32.
pub fn unwrap_save(json: &[u8]) -> Result<Vec<u8>, SaveError> {
    if json.len() > MAX_ENVELOPE_BYTES {
        return Err(SaveError::TooLarge);
    }
    let envelope: SaveEnvelope =
        serde_json::from_slice(json).map_err(|_| SaveError::InvalidJson)?;
    if envelope.format != SAVE_FORMAT {
        return Err(SaveError::IncompatibleFormat);
    }
    if envelope.version != SAVE_VERSION {
        return Err(SaveError::IncompatibleVersion);
    }
    if envelope.engine != EngineIdentity::default() {
        return Err(SaveError::IncompatibleEngine);
    }
    if envelope.encoding != "hex" || envelope.checksum.algorithm != "crc32" {
        return Err(SaveError::InvalidEncoding);
    }
    if envelope.payload_len == 0 {
        return Err(SaveError::Empty);
    }
    if envelope.payload_len > MAX_SAVE_BYTES {
        return Err(SaveError::TooLarge);
    }
    let hex_len = envelope
        .payload_len
        .checked_mul(2)
        .ok_or(SaveError::TooLarge)?;
    if envelope.payload.len() != hex_len {
        return Err(SaveError::InvalidLength);
    }
    let payload = decode_hex(&envelope.payload)?;
    if envelope.checksum.value != format!("{:08x}", crc32(&payload)) {
        return Err(SaveError::InvalidChecksum);
    }
    Ok(payload)
}

fn encode_hex(payload: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut hex = String::with_capacity(payload.len() * 2);
    for byte in payload {
        hex.push(char::from(DIGITS[usize::from(byte >> 4)]));
        hex.push(char::from(DIGITS[usize::from(byte & 15)]));
    }
    hex
}

fn decode_hex(hex: &str) -> Result<Vec<u8>, SaveError> {
    fn digit(byte: u8) -> Result<u8, SaveError> {
        match byte {
            b'0'..=b'9' => Ok(byte - b'0'),
            b'a'..=b'f' => Ok(byte - b'a' + 10),
            _ => Err(SaveError::InvalidEncoding),
        }
    }
    let mut payload = Vec::with_capacity(hex.len() / 2);
    for pair in hex.as_bytes().as_chunks::<2>().0 {
        payload.push((digit(pair[0])? << 4) | digit(pair[1])?);
    }
    Ok(payload)
}

/// Standard reflected IEEE CRC32, implemented locally to keep dependencies
/// pinned to the already-cached serialization crates.
#[must_use]
pub fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = u32::MAX;
    for byte in bytes {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            let mask = 0u32.wrapping_sub(crc & 1);
            crc = (crc >> 1) ^ (0xedb8_8320 & mask);
        }
    }
    !crc
}

#[cfg(test)]
mod tests {
    use super::*;

    fn modify_save(change: impl FnOnce(&mut serde_json::Value)) -> Vec<u8> {
        let bytes = wrap_save(&[0, 1, 127, 128, 255, 4]).expect("wrap");
        let mut value: serde_json::Value = serde_json::from_slice(&bytes).expect("JSON");
        change(&mut value);
        serde_json::to_vec(&value).expect("JSON")
    }

    #[test]
    fn save_roundtrip_preserves_arbitrary_binary_and_ieee_checksum_vector() {
        let bytes: Vec<u8> = (0..=255).collect();
        assert_eq!(
            unwrap_save(&wrap_save(&bytes).expect("wrap")).expect("unwrap"),
            bytes
        );
        assert_eq!(crc32(b"123456789"), 0xcbf4_3926);
    }

    #[test]
    fn malformed_and_unknown_fields_are_rejected() {
        assert_eq!(unwrap_save(b"{broken"), Err(SaveError::InvalidJson));
        assert_eq!(
            unwrap_save(&modify_save(|v| v["extra"] = true.into())),
            Err(SaveError::InvalidJson)
        );
        assert_eq!(
            unwrap_save(&modify_save(|v| v["engine"]["extra"] = true.into())),
            Err(SaveError::InvalidJson)
        );
    }

    #[test]
    fn incompatible_engine_source_abi_and_schema_are_rejected() {
        assert_eq!(
            unwrap_save(&modify_save(|v| v["engine"]["commit"] = "old".into())),
            Err(SaveError::IncompatibleEngine)
        );
        assert_eq!(
            unwrap_save(&modify_save(|v| v["engine"]["abi"] = "native-x64".into())),
            Err(SaveError::IncompatibleEngine)
        );
        assert_eq!(
            unwrap_save(&modify_save(|v| v["version"] = 2.into())),
            Err(SaveError::IncompatibleVersion)
        );
        assert_eq!(
            unwrap_save(&modify_save(|v| v["format"] = "other".into())),
            Err(SaveError::IncompatibleFormat)
        );
    }

    #[test]
    fn corrupt_truncated_and_unbounded_payloads_are_rejected() {
        assert_eq!(
            unwrap_save(&modify_save(|v| v["payload"] = "ff017f80ff04".into())),
            Err(SaveError::InvalidChecksum)
        );
        assert_eq!(
            unwrap_save(&modify_save(|v| v["payload"] = "0".into())),
            Err(SaveError::InvalidLength)
        );
        assert_eq!(
            unwrap_save(&modify_save(|v| v["payload"] = "zz017f80ff04".into())),
            Err(SaveError::InvalidEncoding)
        );
        assert_eq!(
            unwrap_save(&modify_save(
                |v| v["payload_len"] = (MAX_SAVE_BYTES + 1).into()
            )),
            Err(SaveError::TooLarge)
        );
        assert_eq!(wrap_save(&[]), Err(SaveError::Empty));
    }
}
