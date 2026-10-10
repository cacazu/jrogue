//! Pure versioned save envelopes. Upstream C++ state remains opaque.
//! This library neither captures/restores C++ state nor accesses browser storage.
use cdda_logic_contract::{Observation, PORT_ABI, UPSTREAM_SHA};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

/// Version of this wrapper, distinct from the original CDDA save format.
pub const ENVELOPE_VERSION: u32 = 1;
/// A format discriminator preventing accidental import of unrelated saves.
pub const SAVE_FORMAT: &str = "CDDA-BROWSER-OPAQUE";

/// Required section names in the original C++ transactional RNG capsule.
/// The C++ capsule decoder validates these; Rust does not reserialize RNG internals.
pub const RNG_REQUIRED_SECTIONS: [&str; 7] = [
    "engine",
    "uniform_unsigned",
    "uniform_integer",
    "uniform_real",
    "normal",
    "exponential",
    "chi_squared",
];

/// One opaque capsule produced by the coordinated original-C++ capture hook.
/// It includes the engine, all six distributions and compiler/library identity.
/// Its complete validation and atomic restore remain authoritative in C++.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RngSnapshot {
    pub capsule_bytes: Vec<u8>,
}

/// Opaque original upstream save and exact capture boundary.
/// This is not a Rust model of CDDA world state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Snapshot {
    pub upstream_save_bytes: Vec<u8>,
    pub rng: RngSnapshot,
    pub observation: Observation,
}

/// Saves at unsupported coroutine/menu boundaries need a future bridge-specific protocol.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SaveBoundary {
    CommandComplete,
    UnsupportedSuspension,
}

/// Binary and RNG serializer identity matter even when upstream source SHA agrees.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngineIdentity {
    pub engine_build_id: String,
    pub rng_serializer_abi: String,
}

/// Limits are explicit because original world saves may be large.
/// JSON byte arrays can be larger than their underlying payload.
#[derive(Debug, Clone, Copy)]
pub struct SaveLimits {
    pub encoded_bytes: usize,
    pub upstream_bytes: usize,
    pub rng_bytes: usize,
}
impl Default for SaveLimits {
    fn default() -> Self {
        Self {
            encoded_bytes: 128 * 1024 * 1024,
            upstream_bytes: 64 * 1024 * 1024,
            rng_bytes: 1024 * 1024,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    format: String,
    version: u32,
    upstream_sha: String,
    port_abi: String,
    engine_identity: EngineIdentity,
    boundary: SaveBoundary,
    snapshot: Snapshot,
    checksum_sha256: String,
}

/// Save errors expose semantic IDs for English/Japanese user-facing formatting.
#[derive(Debug, Error)]
pub enum SaveError {
    #[error("invalid save JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("unsupported browser save format")]
    Format,
    #[error("unsupported browser save version: {0}")]
    Version(u32),
    #[error("save source SHA does not match the selected upstream")]
    Source,
    #[error("save port ABI or engine/RNG serializer identity does not match")]
    Abi,
    #[error("save checksum mismatch")]
    Checksum,
    #[error("upstream transactional RNG capsule is absent")]
    IncompleteRng,
    #[error("save size exceeds configured limits")]
    Size,
    #[error("save is not captured at a supported command-complete boundary")]
    Boundary,
    #[error("invalid engine identity")]
    Identity,
}
impl SaveError {
    /// Typed errors are presented using these IDs rather than the log Display text.
    #[must_use]
    pub const fn semantic_id(&self) -> &'static str {
        match self {
            Self::Version(_) => "save.error.version",
            Self::Source => "save.error.source",
            Self::Abi | Self::Identity => "save.error.abi",
            Self::Checksum => "save.error.checksum",
            Self::IncompleteRng => "save.error.rng_incomplete",
            Self::Size => "save.error.size",
            Self::Boundary => "save.error.boundary",
            Self::Json(_) | Self::Format => "save.error.format",
        }
    }
}

#[derive(Serialize)]
struct CheckedPayload<'a> {
    format: &'a str,
    version: u32,
    upstream_sha: &'a str,
    port_abi: &'a str,
    engine_identity: &'a EngineIdentity,
    boundary: SaveBoundary,
    snapshot: &'a Snapshot,
}

fn digest(envelope: &Envelope) -> Result<String, SaveError> {
    let payload = CheckedPayload {
        format: &envelope.format,
        version: envelope.version,
        upstream_sha: &envelope.upstream_sha,
        port_abi: &envelope.port_abi,
        engine_identity: &envelope.engine_identity,
        boundary: envelope.boundary,
        snapshot: &envelope.snapshot,
    };
    let canonical = serde_json::to_vec(&payload)?;
    Ok(format!("{:x}", Sha256::digest(canonical)))
}
fn valid_identity(identity: &EngineIdentity) -> bool {
    [&identity.engine_build_id, &identity.rng_serializer_abi]
        .into_iter()
        .all(|value| {
            !value.is_empty() && value.len() <= 256 && !value.chars().any(char::is_control)
        })
}
fn validate_snapshot(snapshot: &Snapshot, limits: SaveLimits) -> Result<(), SaveError> {
    if snapshot.upstream_save_bytes.is_empty() {
        return Err(SaveError::Format);
    }
    if snapshot.upstream_save_bytes.len() > limits.upstream_bytes {
        return Err(SaveError::Size);
    }
    if snapshot.rng.capsule_bytes.is_empty() {
        return Err(SaveError::IncompleteRng);
    }
    if snapshot.rng.capsule_bytes.len() > limits.rng_bytes {
        return Err(SaveError::Size);
    }
    Ok(())
}

/// Encode only snapshots from a supported upstream command boundary.
/// No C++ mutation, RNG sampling, storage write or browser call takes place.
/// The checksum detects accidental corruption; it is not a signature.
pub fn encode(
    snapshot: Snapshot,
    identity: EngineIdentity,
    boundary: SaveBoundary,
    limits: SaveLimits,
) -> Result<Vec<u8>, SaveError> {
    if !valid_identity(&identity) {
        return Err(SaveError::Identity);
    }
    if boundary != SaveBoundary::CommandComplete {
        return Err(SaveError::Boundary);
    }
    validate_snapshot(&snapshot, limits)?;
    let mut envelope = Envelope {
        format: SAVE_FORMAT.into(),
        version: ENVELOPE_VERSION,
        upstream_sha: UPSTREAM_SHA.into(),
        port_abi: PORT_ABI.into(),
        engine_identity: identity,
        boundary,
        snapshot,
        checksum_sha256: String::new(),
    };
    envelope.checksum_sha256 = digest(&envelope)?;
    let bytes = serde_json::to_vec(&envelope)?;
    if bytes.len() > limits.encoded_bytes {
        return Err(SaveError::Size);
    }
    Ok(bytes)
}

/// Validate all identity/version/checksum/size fields before exposing opaque bytes.
/// The caller must still validate and restore the original C++ save format.
/// This function does not establish semantic compatibility of the upstream save.
pub fn decode(
    bytes: &[u8],
    expected_identity: &EngineIdentity,
    limits: SaveLimits,
) -> Result<Snapshot, SaveError> {
    if bytes.len() > limits.encoded_bytes {
        return Err(SaveError::Size);
    }
    if !valid_identity(expected_identity) {
        return Err(SaveError::Identity);
    }
    let envelope: Envelope = serde_json::from_slice(bytes)?;
    if envelope.format != SAVE_FORMAT {
        return Err(SaveError::Format);
    }
    if envelope.version != ENVELOPE_VERSION {
        return Err(SaveError::Version(envelope.version));
    }
    if envelope.upstream_sha != UPSTREAM_SHA {
        return Err(SaveError::Source);
    }
    if envelope.port_abi != PORT_ABI || envelope.engine_identity != *expected_identity {
        return Err(SaveError::Abi);
    }
    if envelope.boundary != SaveBoundary::CommandComplete {
        return Err(SaveError::Boundary);
    }
    validate_snapshot(&envelope.snapshot, limits)?;
    if envelope.checksum_sha256.len() != 64 || envelope.checksum_sha256 != digest(&envelope)? {
        return Err(SaveError::Checksum);
    }
    Ok(envelope.snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;
    use cdda_input::{Bindings, InputContext, TouchControl};
    use cdda_logic_contract::{Direction, TextEvent, TextId};
    use cdda_presentation::{Catalog, Locale, render};

    // Deliberately marked fixture bytes; no claim these are real C++ snapshots.
    fn identity() -> EngineIdentity {
        EngineIdentity {
            engine_build_id: "unit-test-fixture-only".into(),
            rng_serializer_abi: "fixture/1".into(),
        }
    }
    fn snapshot() -> Snapshot {
        Snapshot {
            upstream_save_bytes: vec![0, 1, 255, 42],
            rng: RngSnapshot {
                capsule_bytes: vec![1, 2, 3],
            },
            observation: Observation {
                revision: 12,
                upstream_turn: 1440,
                messages: vec![TextEvent::plain(
                    TextId::new("command.inventory").expect("ID"),
                )],
            },
        }
    }
    fn bytes() -> Vec<u8> {
        encode(
            snapshot(),
            identity(),
            SaveBoundary::CommandComplete,
            SaveLimits::default(),
        )
        .expect("fixture encode")
    }
    fn tamper(field: &str, value: serde_json::Value) -> Vec<u8> {
        let mut json: serde_json::Value = serde_json::from_slice(&bytes()).expect("JSON");
        json[field] = value;
        serde_json::to_vec(&json).expect("JSON")
    }
    #[test]
    fn envelope_round_trip_preserves_opaque_state_rng_and_semantic_observation() {
        let original = snapshot();
        let encoded = bytes();
        assert_eq!(
            decode(&encoded, &identity(), SaveLimits::default()).expect("decode"),
            original
        );
        assert_eq!(encoded, bytes());
        assert_eq!(
            decode(&encoded, &identity(), SaveLimits::default())
                .expect("decode")
                .rng,
            original.rng
        );
    }
    #[test]
    fn versions_source_abi_build_serializer_and_boundary_are_checked() {
        let limits = SaveLimits::default();
        assert!(matches!(
            decode(&tamper("version", 99.into()), &identity(), limits),
            Err(SaveError::Version(99))
        ));
        assert!(matches!(
            decode(
                &tamper("upstream_sha", "other-source".into()),
                &identity(),
                limits
            ),
            Err(SaveError::Source)
        ));
        assert!(matches!(
            decode(&tamper("port_abi", "other-abi".into()), &identity(), limits),
            Err(SaveError::Abi)
        ));
        assert!(matches!(
            decode(&tamper("format", "unrelated".into()), &identity(), limits),
            Err(SaveError::Format)
        ));
        assert!(matches!(
            decode(
                &tamper("boundary", "unsupported_suspension".into()),
                &identity(),
                limits
            ),
            Err(SaveError::Boundary)
        ));
        let mut other = identity();
        other.engine_build_id = "different-compiler".into();
        assert!(matches!(
            decode(&bytes(), &other, limits),
            Err(SaveError::Abi)
        ));
        let mut other = identity();
        other.rng_serializer_abi = "fixture/2".into();
        assert!(matches!(
            decode(&bytes(), &other, limits),
            Err(SaveError::Abi)
        ));
    }
    #[test]
    fn state_rng_and_observation_corruption_all_fail_the_checksum() {
        let limits = SaveLimits::default();
        for mutate in 0..3 {
            let mut json: serde_json::Value = serde_json::from_slice(&bytes()).expect("JSON");
            match mutate {
                0 => json["snapshot"]["upstream_save_bytes"][0] = 19.into(),
                1 => json["snapshot"]["rng"]["capsule_bytes"][0] = 19.into(),
                _ => json["snapshot"]["observation"]["upstream_turn"] = 19.into(),
            }
            assert!(matches!(
                decode(
                    &serde_json::to_vec(&json).expect("JSON"),
                    &identity(),
                    limits
                ),
                Err(SaveError::Checksum)
            ));
        }
        assert!(matches!(
            decode(&tamper("checksum_sha256", "00".into()), &identity(), limits),
            Err(SaveError::Checksum)
        ));
    }
    #[test]
    fn incomplete_rng_and_unsupported_capture_are_rejected_before_storage() {
        let mut state = snapshot();
        state.rng.capsule_bytes.clear();
        assert!(matches!(
            encode(
                state,
                identity(),
                SaveBoundary::CommandComplete,
                SaveLimits::default()
            ),
            Err(SaveError::IncompleteRng)
        ));
        assert!(matches!(
            encode(
                snapshot(),
                identity(),
                SaveBoundary::UnsupportedSuspension,
                SaveLimits::default()
            ),
            Err(SaveError::Boundary)
        ));
    }
    #[test]
    fn malformed_extra_fields_and_size_limits_are_rejected() {
        assert!(matches!(
            decode(b"{broken", &identity(), SaveLimits::default()),
            Err(SaveError::Json(_))
        ));
        let mut json: serde_json::Value = serde_json::from_slice(&bytes()).expect("JSON");
        json["unknown"] = true.into();
        assert!(matches!(
            decode(
                &serde_json::to_vec(&json).expect("JSON"),
                &identity(),
                SaveLimits::default()
            ),
            Err(SaveError::Json(_))
        ));
        assert!(matches!(
            decode(
                &bytes(),
                &identity(),
                SaveLimits {
                    encoded_bytes: 2,
                    ..SaveLimits::default()
                }
            ),
            Err(SaveError::Size)
        ));
        assert!(matches!(
            encode(
                snapshot(),
                identity(),
                SaveBoundary::CommandComplete,
                SaveLimits {
                    upstream_bytes: 2,
                    ..SaveLimits::default()
                }
            ),
            Err(SaveError::Size)
        ));
        assert!(matches!(
            encode(
                snapshot(),
                identity(),
                SaveBoundary::CommandComplete,
                SaveLimits {
                    rng_bytes: 2,
                    ..SaveLimits::default()
                }
            ),
            Err(SaveError::Size)
        ));
    }
    #[test]
    fn input_and_repeated_render_leave_opaque_rng_and_save_bytes_unchanged() {
        let state = snapshot();
        let before = bytes();
        let bindings = Bindings::stable().expect("source fixture");
        let ja = Catalog::contract(Locale::Ja).expect("catalog");
        for _ in 0..100 {
            let _command = bindings.touch(
                InputContext::DefaultMode,
                TouchControl::Direction(Direction::North),
            );
            let _frame = render(&state.observation, &ja).expect("render");
        }
        let after = encode(
            state,
            identity(),
            SaveBoundary::CommandComplete,
            SaveLimits::default(),
        )
        .expect("encode");
        assert_eq!(before, after);
        // No EngineBridge implementation is involved: this proves contract purity.
    }
    #[test]
    fn every_save_error_has_a_localized_semantic_id() {
        let en = Catalog::contract(Locale::En).expect("en");
        let ja = Catalog::contract(Locale::Ja).expect("ja");
        for error in [
            SaveError::Format,
            SaveError::Version(2),
            SaveError::Source,
            SaveError::Abi,
            SaveError::Checksum,
            SaveError::IncompleteRng,
            SaveError::Size,
            SaveError::Boundary,
            SaveError::Identity,
        ] {
            let event = TextEvent::plain(TextId::new(error.semantic_id()).expect("ID"));
            assert!(!en.format(&event).expect("en error").is_empty());
            assert!(!ja.format(&event).expect("ja error").is_empty());
        }
    }
}
