//! Versioned, bounded checkpoint transport. Native DRL binary saves are not this format.
//! Storage adapters must acknowledge a checkpoint only after their transaction commits.
pub mod native_input;
pub mod vfs;

use crate::{ENGINE_COMMIT, SOURCE_COMMIT};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use sha2::{Digest, Sha256};

pub const FORMAT: &str = "drl-rust-migration-checkpoint";
pub const VERSION: u32 = 1;
pub const MAX_SAVE_BYTES: usize = 1_048_576;

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    format: String,
    version: u32,
    source_commit: String,
    engine_commit: String,
    payload: String,
    sha256: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SaveError {
    TooLarge,
    InvalidJson,
    WrongFormat,
    UnsupportedVersion,
    SourceMismatch,
    EngineMismatch,
    ChecksumMismatch,
    InvalidPayload,
}

impl std::fmt::Display for SaveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for SaveError {}

fn checksum(payload: &str) -> String {
    format!("{:x}", Sha256::digest(payload.as_bytes()))
}

pub fn encode<T: Serialize>(state: &T) -> Result<String, SaveError> {
    let payload = serde_json::to_string(state).map_err(|_| SaveError::InvalidPayload)?;
    if payload.len() > MAX_SAVE_BYTES {
        return Err(SaveError::TooLarge);
    }
    let sha256 = checksum(&payload);
    let text = serde_json::to_string(&Envelope {
        format: FORMAT.into(),
        version: VERSION,
        source_commit: SOURCE_COMMIT.into(),
        engine_commit: ENGINE_COMMIT.into(),
        payload,
        sha256,
    })
    .map_err(|_| SaveError::InvalidJson)?;
    if text.len() > MAX_SAVE_BYTES {
        return Err(SaveError::TooLarge);
    }
    Ok(text)
}

pub fn decode<T: DeserializeOwned>(text: &str) -> Result<T, SaveError> {
    if text.len() > MAX_SAVE_BYTES {
        return Err(SaveError::TooLarge);
    }
    let envelope: Envelope = serde_json::from_str(text).map_err(|_| SaveError::InvalidJson)?;
    if envelope.format != FORMAT {
        return Err(SaveError::WrongFormat);
    }
    if envelope.version != VERSION {
        return Err(SaveError::UnsupportedVersion);
    }
    if envelope.source_commit != SOURCE_COMMIT {
        return Err(SaveError::SourceMismatch);
    }
    if envelope.engine_commit != ENGINE_COMMIT {
        return Err(SaveError::EngineMismatch);
    }
    if envelope.sha256.len() != 64 || checksum(&envelope.payload) != envelope.sha256 {
        return Err(SaveError::ChecksumMismatch);
    }
    serde_json::from_str(&envelope.payload).map_err(|_| SaveError::InvalidPayload)
}
