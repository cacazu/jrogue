use std::{fmt, marker::PhantomData};
use serde::{Deserialize, Deserializer, de::{self, SeqAccess, Visitor}};

use crate::{BindingDescriptor, BindingOrigin, BindingType, BuildIdentity, ContextSnapshot,
    MAX_ACTIONS, MAX_BINDINGS_PER_ACTION, MAX_FIELD_BYTES, MAX_KEY_SEQUENCE,
    MAX_SCOPE_DEPTH, MAX_SNAPSHOT_BYTES, Modifier, PreferredKeyboardMode, RegisteredAction,
    SOURCE_COMMIT, TextPolicy};

#[derive(Debug)]
pub enum SnapshotError {
    ByteLimit,
    InvalidUtf8(std::str::Utf8Error),
    Json(serde_json::Error),
    IdentityMismatch(&'static str),
    InvalidRecord(&'static str),
}
impl fmt::Display for SnapshotError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ByteLimit => f.write_str("input snapshot exceeds byte limit"),
            Self::InvalidUtf8(_) => f.write_str("input snapshot is not valid UTF-8"),
            Self::Json(_) => f.write_str("input snapshot JSON/schema is invalid"),
            Self::IdentityMismatch(field) => write!(f, "input snapshot identity mismatch: {field}"),
            Self::InvalidRecord(field) => write!(f, "input snapshot record is invalid: {field}"),
        }
    }
}
impl std::error::Error for SnapshotError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::InvalidUtf8(error) => Some(error),
            Self::Json(error) => Some(error),
            _ => None,
        }
    }
}

struct BoundedText(String);
impl<'de> Deserialize<'de> for BoundedText {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct TextVisitor;
        impl Visitor<'_> for TextVisitor {
            type Value = BoundedText;
            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("a UTF-8 string with at most 16384 bytes")
            }
            fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
                if value.len() > MAX_FIELD_BYTES {
                    return Err(E::custom("input snapshot string byte limit"));
                }
                Ok(BoundedText(value.to_owned()))
            }
            fn visit_string<E: de::Error>(self, value: String) -> Result<Self::Value, E> {
                if value.len() > MAX_FIELD_BYTES {
                    return Err(E::custom("input snapshot string byte limit"));
                }
                Ok(BoundedText(value))
            }
        }
        deserializer.deserialize_string(TextVisitor)
    }
}

struct DecimalU64(u64);
impl<'de> Deserialize<'de> for DecimalU64 {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct CounterVisitor;
        impl Visitor<'_> for CounterVisitor {
            type Value = DecimalU64;
            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("a canonical unsigned decimal u64 string")
            }
            fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
                if value.is_empty() || value.len() > 20 ||
                    !value.bytes().all(|byte| byte.is_ascii_digit()) ||
                    (value.len() > 1 && value.starts_with('0')) {
                    return Err(E::custom("noncanonical input snapshot counter"));
                }
                value.parse::<u64>().map(DecimalU64)
                    .map_err(|_| E::custom("input snapshot counter exceeds u64"))
            }
        }
        deserializer.deserialize_str(CounterVisitor)
    }
}

struct BoundedVec<T, const LIMIT: usize>(Vec<T>);
impl<'de, T: Deserialize<'de>, const LIMIT: usize> Deserialize<'de> for BoundedVec<T, LIMIT> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct ListVisitor<T, const LIMIT: usize>(PhantomData<T>);
        impl<'de, T: Deserialize<'de>, const LIMIT: usize> Visitor<'de> for ListVisitor<T, LIMIT> {
            type Value = BoundedVec<T, LIMIT>;
            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "a list with at most {LIMIT} entries")
            }
            fn visit_seq<A: SeqAccess<'de>>(self, mut source: A) -> Result<Self::Value, A::Error> {
                let mut values = Vec::with_capacity(source.size_hint().unwrap_or(0).min(LIMIT));
                while let Some(value) = source.next_element::<T>()? {
                    if values.len() == LIMIT {
                        return Err(de::Error::custom("input snapshot collection limit"));
                    }
                    values.push(value);
                }
                Ok(BoundedVec(values))
            }
        }
        deserializer.deserialize_seq(ListVisitor::<T, LIMIT>(PhantomData))
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawBinding {
    #[serde(rename = "type")]
    event_type: BindingType,
    modifiers: BoundedVec<Modifier, 3>,
    sequence: BoundedVec<i32, MAX_KEY_SEQUENCE>,
    text: BoundedText,
    edit: BoundedText,
    edit_refresh: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawAction {
    index: u32,
    id: BoundedText,
    origin: BindingOrigin,
    bindings: BoundedVec<RawBinding, MAX_BINDINGS_PER_ACTION>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawSnapshot {
    schema_version: u32,
    interface: BoundedText,
    source_commit: BoundedText,
    engine_build_id: BoundedText,
    publication_sequence: DecimalU64,
    context_epoch: DecimalU64,
    parent_context_epoch: DecimalU64,
    depth: u32,
    phase: BoundedText,
    category: BoundedText,
    text_policy: TextPolicy,
    preferred_keyboard_mode: PreferredKeyboardMode,
    effective_timeout_ms: i32,
    registered_any_input: bool,
    coordinate_input_enabled: bool,
    iso_mode: bool,
    binding_authority: BoundedText,
    actions: BoundedVec<RawAction, MAX_ACTIONS>,
}

/// Parses bounded bytes into fully owned validated records. No engine calls.
pub fn parse_snapshot(bytes: &[u8], identity: &BuildIdentity) -> Result<ContextSnapshot, SnapshotError> {
    if bytes.len() > MAX_SNAPSHOT_BYTES {
        return Err(SnapshotError::ByteLimit);
    }
    let text = std::str::from_utf8(bytes).map_err(SnapshotError::InvalidUtf8)?;
    let raw: RawSnapshot = serde_json::from_str(text).map_err(SnapshotError::Json)?;
    if raw.schema_version != 1 || raw.interface.0 != "cdda-live-input-snapshot/1" {
        return Err(SnapshotError::IdentityMismatch("schema/interface"));
    }
    if raw.source_commit.0 != SOURCE_COMMIT {
        return Err(SnapshotError::IdentityMismatch("source_commit"));
    }
    if raw.engine_build_id.0 != identity.build_id() {
        return Err(SnapshotError::IdentityMismatch("engine_build_id"));
    }
    if raw.phase.0 != "input_wait" ||
        raw.binding_authority.0 != "original_action_contexts_const_lookup" {
        return Err(SnapshotError::InvalidRecord("phase/binding_authority"));
    }
    // Pinned producer: constructor allocates one context epoch, then publishes
    // or marks unavailable (both consume a publication). Nested restoration
    // and serialization failure can consume more publications, never fewer.
    // Hence a ready context epoch cannot exceed its publication; restored
    // parent epochs may still be lower than previously observed child epochs.
    if raw.publication_sequence.0 == 0 || raw.context_epoch.0 == 0 ||
        raw.context_epoch.0 > raw.publication_sequence.0 {
        return Err(SnapshotError::InvalidRecord("publication/context_epoch"));
    }
    if !(1..=MAX_SCOPE_DEPTH).contains(&raw.depth) ||
        (raw.depth == 1) != (raw.parent_context_epoch.0 == 0) ||
        raw.parent_context_epoch.0 >= raw.context_epoch.0 {
        return Err(SnapshotError::InvalidRecord("depth/parent_context_epoch"));
    }
    let expected_policy = if raw.category.0 == "STRING_INPUT" {
        TextPolicy::RawUtf8
    } else {
        TextPolicy::NativeContext
    };
    if raw.text_policy != expected_policy {
        return Err(SnapshotError::InvalidRecord("text_policy"));
    }
    let mut actions = Vec::with_capacity(raw.actions.0.len());
    for (index, action) in raw.actions.0.into_iter().enumerate() {
        let expected_index = u32::try_from(index)
            .map_err(|_| SnapshotError::InvalidRecord("action index overflow"))?;
        if action.index != expected_index ||
            (action.origin == BindingOrigin::Missing && !action.bindings.0.is_empty()) ||
            (raw.category.0 == "default" && action.origin == BindingOrigin::Context) {
            return Err(SnapshotError::InvalidRecord("action index/origin"));
        }
        let mut bindings = Vec::with_capacity(action.bindings.0.len());
        for binding in action.bindings.0 {
            if binding.modifiers.0.windows(2).any(|pair| pair[0] >= pair[1]) {
                return Err(SnapshotError::InvalidRecord("modifier source order/uniqueness"));
            }
            bindings.push(BindingDescriptor {
                event_type: binding.event_type,
                modifiers: binding.modifiers.0,
                sequence: binding.sequence.0,
                text: binding.text.0,
                edit: binding.edit.0,
                edit_refresh: binding.edit_refresh,
            });
        }
        actions.push(RegisteredAction {
            index: action.index, id: action.id.0, origin: action.origin, bindings,
        });
    }
    Ok(ContextSnapshot {
        identity: identity.clone(), publication: raw.publication_sequence.0,
        context_epoch: raw.context_epoch.0, parent_context_epoch: raw.parent_context_epoch.0,
        depth: raw.depth, category: raw.category.0, text_policy: raw.text_policy,
        preferred_keyboard_mode: raw.preferred_keyboard_mode,
        effective_timeout_ms: raw.effective_timeout_ms,
        registered_any_input: raw.registered_any_input,
        coordinate_input_enabled: raw.coordinate_input_enabled, iso_mode: raw.iso_mode, actions,
    })
}
