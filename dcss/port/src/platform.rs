//! Versioned, validated adapters. The JS host persists the opaque UTF-8 envelope.
use crate::{ABI_VERSION, UPSTREAM_COMMIT};
use serde::{Deserialize, Serialize};
use std::fmt;

pub const SAVE_VERSION: u32 = 1;
/// Native envelopes v2 optionally carry a bounded display-only checkpoint.
pub const NATIVE_SAVE_VERSION: u32 = 2;
pub const MAX_SAVE_BYTES: usize = 16 * 1024 * 1024;
pub const MAX_CELLS: usize = 16_384;
pub const MAX_NATIVE_FILES: usize = 512;
pub const MAX_NATIVE_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeFile {
    pub path: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeFileSet {
    pub files: Vec<NativeFile>,
}

impl NativeFileSet {
    /// Validate paths and limits before browser code restores native save bytes.
    /// Native DCSS remains responsible for its own internal save-tag validation.
    pub fn validate(&self) -> Result<(), SaveError> {
        Self::validate_files(&self.files)
    }

    fn validate_files(files: &[NativeFile]) -> Result<(), SaveError> {
        if files.is_empty() || files.len() > MAX_NATIVE_FILES {
            return Err(SaveError::InvalidPayload);
        }
        let mut seen = std::collections::BTreeSet::new();
        let mut total = 0usize;
        for file in files {
            if file.path.len() > 512
                || file.path.contains(['\\', ':'])
                || file.path.chars().any(char::is_control)
                || file
                    .path
                    .split('/')
                    .any(|part| part.is_empty() || part == "." || part == "..")
                || !seen.insert(file.path.clone())
            {
                return Err(SaveError::InvalidPayload);
            }
            total = total
                .checked_add(file.bytes.len())
                .ok_or(SaveError::TooLarge)?;
            if total > MAX_NATIVE_BYTES {
                return Err(SaveError::TooLarge);
            }
        }
        // A file cannot also be a parent directory. Validate the complete set
        // independent of input order, before the host writes any bytes.
        for path in &seen {
            for (offset, _) in path.match_indices('/') {
                if seen.contains(&path[..offset]) {
                    return Err(SaveError::InvalidPayload);
                }
            }
        }
        Ok(())
    }
}

/// Native file bytes plus an optional observation projection. The projection
/// cannot influence C++ save tags, RNG, canonical history, or Lua/message hooks.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeSave {
    pub files: Vec<NativeFile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub semantic: Option<crate::semantic::SemanticCheckpoint>,
}

impl NativeSave {
    pub fn validate(&self) -> Result<(), SaveError> {
        NativeFileSet::validate_files(&self.files)?;
        if let Some(checkpoint) = &self.semantic {
            checkpoint
                .validate()
                .map_err(|_| SaveError::InvalidPayload)?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Cell {
    pub glyph: u32,
    pub foreground: u8,
    pub background: u8,
    /// Exact base plus combining sequence; zero glyph marks a wide continuation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConsoleFrame {
    pub columns: u16,
    pub rows: u16,
    pub cells: Vec<Cell>,
    pub cursor: Option<(u16, u16)>,
}

impl ConsoleFrame {
    pub fn validate(&self) -> Result<(), SaveError> {
        let count = usize::from(self.columns) * usize::from(self.rows);
        if count == 0 || count > MAX_CELLS || self.cells.len() != count {
            return Err(SaveError::InvalidFrame);
        }
        if self
            .cells
            .iter()
            .any(|c| char::from_u32(c.glyph).is_none() || c.foreground > 15 || c.background > 15)
        {
            return Err(SaveError::InvalidFrame);
        }
        for cell in &self.cells {
            if let Some(text) = &cell.text
                && (cell.glyph == 0
                    || text.len() > 4096
                    || text.chars().next().map(u32::from) != Some(cell.glyph)
                    || text.chars().any(char::is_control))
            {
                return Err(SaveError::InvalidFrame);
            }
        }
        if self
            .cursor
            .is_some_and(|(x, y)| x >= self.columns || y >= self.rows)
        {
            return Err(SaveError::InvalidFrame);
        }
        Ok(())
    }
    /// A pure observation; immutable frame bytes cannot change engine state.
    pub fn text(&self) -> Result<String, SaveError> {
        self.validate()?;
        let mut output = String::with_capacity(self.cells.len() + usize::from(self.rows));
        for row in self.cells.chunks(usize::from(self.columns)) {
            for cell in row {
                if let Some(text) = &cell.text {
                    output.push_str(text);
                } else if cell.glyph != 0 {
                    output.push(char::from_u32(cell.glyph).ok_or(SaveError::InvalidFrame)?);
                }
            }
            output.push('\n');
        }
        Ok(output)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SaveError {
    TooLarge,
    InvalidJson,
    Version,
    Source,
    Checksum,
    InvalidFrame,
    InvalidPayload,
}
impl fmt::Display for SaveError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "save validation failed: {self:?}")
    }
}
impl std::error::Error for SaveError {}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    format: String,
    version: u32,
    abi: u32,
    upstream: String,
    kind: String,
    checksum: String,
    payload: String,
}

// FNV-1a only detects accidental corruption. This is not an authenticity check.
fn checksum(bytes: &[u8]) -> String {
    let hash = bytes.iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    });
    format!("{hash:016x}")
}

pub fn encode<T: Serialize>(kind: &str, value: &T) -> Result<String, SaveError> {
    encode_version(kind, SAVE_VERSION, value)
}

fn encode_version<T: Serialize>(kind: &str, version: u32, value: &T) -> Result<String, SaveError> {
    let payload = serde_json::to_string(value).map_err(|_| SaveError::InvalidPayload)?;
    if payload.len() > MAX_SAVE_BYTES / 2 {
        return Err(SaveError::TooLarge);
    }
    let envelope = Envelope {
        format: "dcss-rust-boundary".into(),
        version,
        abi: ABI_VERSION,
        upstream: UPSTREAM_COMMIT.into(),
        kind: kind.into(),
        checksum: checksum(payload.as_bytes()),
        payload,
    };
    let text = serde_json::to_string(&envelope).map_err(|_| SaveError::InvalidJson)?;
    if text.len() > MAX_SAVE_BYTES {
        return Err(SaveError::TooLarge);
    }
    Ok(text)
}

pub fn decode<T: for<'de> Deserialize<'de>>(kind: &str, text: &str) -> Result<T, SaveError> {
    if text.len() > MAX_SAVE_BYTES {
        return Err(SaveError::TooLarge);
    }
    let envelope: Envelope = serde_json::from_str(text).map_err(|_| SaveError::InvalidJson)?;
    if envelope.format != "dcss-rust-boundary"
        || envelope.version != SAVE_VERSION
        || envelope.abi != ABI_VERSION
        || envelope.kind != kind
    {
        return Err(SaveError::Version);
    }
    if envelope.upstream != UPSTREAM_COMMIT {
        return Err(SaveError::Source);
    }
    if envelope.checksum != checksum(envelope.payload.as_bytes()) {
        return Err(SaveError::Checksum);
    }
    serde_json::from_str(&envelope.payload).map_err(|_| SaveError::InvalidPayload)
}

/// Encode only after both native file paths and every semantic descriptor pass.
pub fn encode_native(value: &NativeSave) -> Result<String, SaveError> {
    value.validate()?;
    encode_version("native-dcss-file-set-v2", NATIVE_SAVE_VERSION, value)
}

/// Accept legacy v1 saves without history, and strictly validated native v2.
///
/// # Errors
/// Rejects corrupt/future envelopes and checkpoints before engine creation.
pub fn decode_native(text: &str) -> Result<NativeSave, SaveError> {
    if text.len() > MAX_SAVE_BYTES {
        return Err(SaveError::TooLarge);
    }
    let envelope: Envelope = serde_json::from_str(text).map_err(|_| SaveError::InvalidJson)?;
    if envelope.format != "dcss-rust-boundary" || envelope.abi != ABI_VERSION {
        return Err(SaveError::Version);
    }
    if !matches!(
        (envelope.version, envelope.kind.as_str()),
        (SAVE_VERSION, "native-dcss-file-set-v1")
            | (NATIVE_SAVE_VERSION, "native-dcss-file-set-v2")
    ) {
        return Err(SaveError::Version);
    }
    if envelope.upstream != UPSTREAM_COMMIT {
        return Err(SaveError::Source);
    }
    if envelope.payload.len() > MAX_SAVE_BYTES / 2 {
        return Err(SaveError::TooLarge);
    }
    if envelope.checksum != checksum(envelope.payload.as_bytes()) {
        return Err(SaveError::Checksum);
    }
    let native = if envelope.version == SAVE_VERSION {
        let legacy: NativeFileSet =
            serde_json::from_str(&envelope.payload).map_err(|_| SaveError::InvalidPayload)?;
        NativeSave {
            files: legacy.files,
            semantic: None,
        }
    } else {
        serde_json::from_str(&envelope.payload).map_err(|_| SaveError::InvalidPayload)?
    };
    native.validate()?;
    Ok(native)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_files_reject_path_escape_duplicates_and_preserve_bytes() {
        let native = NativeFileSet {
            files: vec![NativeFile {
                path: "名前.cs".into(),
                bytes: vec![0, 127, 255],
            }],
        };
        assert!(native.validate().is_ok());
        let saved = encode("native-dcss-file-set-v1", &native).expect("native envelope");
        let loaded: NativeFileSet =
            decode("native-dcss-file-set-v1", &saved).expect("native decode");
        assert_eq!(loaded, native);
        for path in [
            "../Player.cs",
            "/Player.cs",
            "C:/Player.cs",
            "a\\Player.cs",
            "a/./Player.cs",
        ] {
            assert!(
                NativeFileSet {
                    files: vec![NativeFile {
                        path: path.into(),
                        bytes: vec![]
                    }]
                }
                .validate()
                .is_err()
            );
        }
        let mut duplicate = native.clone();
        duplicate.files.push(native.files[0].clone());
        assert!(duplicate.validate().is_err());
    }
    #[test]
    fn native_files_reject_file_directory_conflicts_in_either_order() {
        for paths in [["a", "a/b"], ["a/b", "a"], ["a/b/c", "a/b"]] {
            let files = paths
                .into_iter()
                .map(|path| NativeFile {
                    path: path.into(),
                    bytes: vec![1],
                })
                .collect();
            assert_eq!(
                NativeFileSet { files }.validate(),
                Err(SaveError::InvalidPayload)
            );
        }
        let files = ["a/file.cs", "ab/file.cs"]
            .into_iter()
            .map(|path| NativeFile {
                path: path.into(),
                bytes: vec![1],
            })
            .collect();
        assert!(NativeFileSet { files }.validate().is_ok());
    }
    #[test]
    fn future_save_and_source_and_corruption_rejected() {
        let text = encode("test", &vec![1, 2, 3]).expect("test save");
        assert_eq!(
            decode::<Vec<u32>>("test", &text).expect("test decode"),
            vec![1, 2, 3]
        );
        let mut v: serde_json::Value = serde_json::from_str(&text).expect("json");
        v["version"] = 2.into();
        assert_eq!(
            decode::<Vec<u32>>("test", &v.to_string()),
            Err(SaveError::Version)
        );
        v["version"] = 1.into();
        v["upstream"] = "different".into();
        assert_eq!(
            decode::<Vec<u32>>("test", &v.to_string()),
            Err(SaveError::Source)
        );
        v["upstream"] = UPSTREAM_COMMIT.into();
        v["payload"] = "[9,2,3]".into();
        assert_eq!(
            decode::<Vec<u32>>("test", &v.to_string()),
            Err(SaveError::Checksum)
        );
        assert!(decode::<Vec<u32>>("other-kind", &text).is_err());
    }
    #[test]
    fn observation_does_not_mutate() {
        let frame = ConsoleFrame {
            columns: 2,
            rows: 1,
            cells: vec![
                Cell {
                    glyph: 64,
                    foreground: 15,
                    background: 0,
                    text: None,
                };
                2
            ],
            cursor: None,
        };
        let before = frame.clone();
        for _ in 0..50 {
            assert_eq!(frame.text().expect("frame"), "@@\n");
        }
        assert_eq!(frame, before);
        let mut invalid = frame;
        invalid.cells[0].glyph = 0xd800;
        assert_eq!(invalid.validate(), Err(SaveError::InvalidFrame));
    }
    #[test]
    fn cjk_wide_continuation_and_combining_sequence_are_preserved_exactly() {
        let mut frame = ConsoleFrame {
            columns: 2,
            rows: 1,
            cells: vec![
                Cell {
                    glyph: u32::from('か'),
                    foreground: 15,
                    background: 0,
                    text: Some("か\u{3099}".into()),
                },
                Cell {
                    glyph: 0,
                    foreground: 15,
                    background: 0,
                    text: None,
                },
            ],
            cursor: None,
        };
        assert_eq!(frame.text().unwrap(), "か\u{3099}\n");
        let before = frame.clone();
        assert_eq!(frame.text().unwrap(), before.text().unwrap());
        assert_eq!(frame, before);
        frame.cells[0].text = Some("が".into());
        assert_eq!(frame.validate(), Err(SaveError::InvalidFrame));
        frame.cells[0].text = Some("か\n".into());
        assert_eq!(frame.validate(), Err(SaveError::InvalidFrame));
    }
    #[test]
    fn native_v2_history_and_legacy_v1_preserve_identical_file_bytes() {
        let files = vec![NativeFile {
            path: "saves/Player.cs".into(),
            bytes: vec![0, 127, 255],
        }];
        let legacy = encode(
            "native-dcss-file-set-v1",
            &NativeFileSet {
                files: files.clone(),
            },
        )
        .expect("legacy save");
        let old = decode_native(&legacy).expect("legacy import");
        assert_eq!(old.files, files);
        assert_eq!(old.semantic, None);
        let native = NativeSave {
            files,
            semantic: Some(crate::semantic::SemanticCheckpoint::empty()),
        };
        let saved = encode_native(&native).expect("v2");
        let loaded = decode_native(&saved).expect("v2 import");
        assert_eq!(loaded, native);
        let envelope: serde_json::Value = serde_json::from_str(&saved).expect("envelope");
        assert_eq!(envelope["version"], 2);
        assert_eq!(envelope["kind"], "native-dcss-file-set-v2");
    }

    #[test]
    fn native_history_is_validated_before_pack_or_restore() {
        let native = NativeSave {
            files: vec![NativeFile {
                path: "saves/Player.cs".into(),
                bytes: vec![1, 2, 3],
            }],
            semantic: Some(crate::semantic::SemanticCheckpoint::empty()),
        };
        let saved = encode_native(&native).expect("save");
        let mut envelope: serde_json::Value = serde_json::from_str(&saved).expect("envelope");
        envelope["version"] = 3.into();
        assert_eq!(
            decode_native(&envelope.to_string()),
            Err(SaveError::Version)
        );
        envelope["version"] = 2.into();
        let mut payload = serde_json::to_value(&native).expect("payload");
        payload["semantic"]["version"] = 2.into();
        let invalid_payload = payload.to_string();
        envelope["checksum"] = checksum(invalid_payload.as_bytes()).into();
        envelope["payload"] = invalid_payload.into();
        assert_eq!(
            decode_native(&envelope.to_string()),
            Err(SaveError::InvalidPayload)
        );
        let mut invalid = native;
        invalid.semantic.as_mut().expect("history").version = 2;
        assert_eq!(encode_native(&invalid), Err(SaveError::InvalidPayload));
    }
}
