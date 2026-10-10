//! Semantic observations exposed by the gameplay engine, without hidden state.

use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

/// Maximum bytes in an English semantic identifier.
pub const MAX_TEXT_ID_BYTES: usize = 160;
/// Maximum typed arguments in an event.
pub const MAX_ARGUMENTS: usize = 64;
/// Maximum bytes in a public, untranslated free-text argument.
pub const MAX_TEXT_BYTES: usize = 65_536;
/// Root depth is zero; eight nested semantic name events are accepted.
pub const MAX_EVENT_DEPTH: usize = 8;
/// Aggregate bounds also apply to arguments unused by a locale template.
pub const MAX_EVENT_NODES: usize = 512;
pub const MAX_EVENT_ARGUMENTS: usize = 4_096;
pub const MAX_EVENT_TEXT_BYTES: usize = 256 * 1024;

/// A stable English semantic identifier, independent of displayed language.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct TextId(String);

impl TextId {
    /// Borrow the validated identifier.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for TextId {
    type Error = InvalidTextId;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        let last_segment_index = value.split('.').count().saturating_sub(1);
        let valid = !value.is_empty()
            && value.len() <= MAX_TEXT_ID_BYTES
            && value.split('.').enumerate().all(|(index, segment)| {
                // Existing source IDs end in a ten-digit lowercase hexadecimal
                // fingerprint. That terminal segment may begin with a digit;
                // earlier segments remain readable English semantic names.
                let terminal_hash = index > 0
                    && index == last_segment_index
                    && segment.len() == 10
                    && segment
                        .bytes()
                        .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'));
                let mut bytes = segment.bytes();
                terminal_hash
                    || (matches!(bytes.next(), Some(b'a'..=b'z'))
                        && bytes.all(|byte| {
                            byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_'
                        }))
            });
        if valid {
            Ok(Self(value))
        } else {
            Err(InvalidTextId)
        }
    }
}

impl From<TextId> for String {
    fn from(value: TextId) -> Self {
        value.0
    }
}

impl fmt::Display for TextId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// An identifier is empty, too long, or not an English semantic key.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InvalidTextId;

impl fmt::Display for InvalidTextId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("invalid semantic text identifier")
    }
}

impl std::error::Error for InvalidTextId {}

/// An already selected public value. No object pointer or private effect index
/// crosses this boundary. User names, wishes, labels, and fruit remain literal
/// UTF-8 strings, including percent signs and braces.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "type",
    content = "value",
    rename_all = "snake_case",
    deny_unknown_fields
)]
pub enum TextArgument {
    Text(String),
    Integer(i64),
    Unsigned(u64),
    Boolean(bool),
    TextId(TextId),
    /// An already-public name composition, never an engine object reference.
    Event(Box<TextEvent>),
}

/// An immutable gameplay or application observation captured at the source
/// output call, after the engine has selected names and random descriptions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TextEvent {
    pub id: TextId,
    #[serde(default)]
    pub args: BTreeMap<String, TextArgument>,
}

impl TextEvent {
    /// Validate the complete owned event tree before any locale selects slots.
    ///
    /// # Errors
    /// Rejects excessive depth, aggregate size, per-event arguments, literal
    /// string sizes, and invalid argument names, including unused union values.
    pub fn validate_tree(&self) -> Result<(), InvalidTextEvent> {
        self.validate_at_depth(0, &mut EventBudget::default())
    }

    fn validate_at_depth(
        &self,
        depth: usize,
        budget: &mut EventBudget,
    ) -> Result<(), InvalidTextEvent> {
        if depth > MAX_EVENT_DEPTH {
            return Err(InvalidTextEvent::TooDeep);
        }
        budget.nodes = budget.nodes.saturating_add(1);
        budget.arguments = budget.arguments.saturating_add(self.args.len());
        if self.args.len() > MAX_ARGUMENTS
            || budget.nodes > MAX_EVENT_NODES
            || budget.arguments > MAX_EVENT_ARGUMENTS
        {
            return Err(InvalidTextEvent::TooLarge);
        }
        budget.add_text(self.id.as_str().len())?;
        for (name, argument) in &self.args {
            if !valid_argument_name(name) {
                return Err(InvalidTextEvent::ArgumentName);
            }
            budget.add_text(name.len())?;
            match argument {
                TextArgument::Text(text) => {
                    if text.len() > MAX_TEXT_BYTES {
                        return Err(InvalidTextEvent::TooLarge);
                    }
                    budget.add_text(text.len())?;
                }
                TextArgument::TextId(id) => budget.add_text(id.as_str().len())?,
                TextArgument::Event(event) => event.validate_at_depth(depth + 1, budget)?,
                TextArgument::Integer(_) | TextArgument::Unsigned(_) | TextArgument::Boolean(_) => {
                }
            }
        }
        Ok(())
    }
}

#[derive(Default)]
struct EventBudget {
    nodes: usize,
    arguments: usize,
    text_bytes: usize,
}

impl EventBudget {
    fn add_text(&mut self, bytes: usize) -> Result<(), InvalidTextEvent> {
        self.text_bytes = self.text_bytes.saturating_add(bytes);
        if self.text_bytes > MAX_EVENT_TEXT_BYTES {
            return Err(InvalidTextEvent::TooLarge);
        }
        Ok(())
    }
}

pub(crate) fn valid_argument_name(name: &str) -> bool {
    let mut bytes = name.bytes();
    name.len() <= 64
        && matches!(bytes.next(), Some(b'a'..=b'z' | b'A'..=b'Z'))
        && bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

/// Invalid public event structure, independent of any selected locale.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvalidTextEvent {
    TooDeep,
    TooLarge,
    ArgumentName,
}

impl fmt::Display for InvalidTextEvent {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::TooDeep => "semantic event nesting exceeds limits",
            Self::TooLarge => "semantic event exceeds limits",
            Self::ArgumentName => "invalid semantic argument name",
        })
    }
}

impl std::error::Error for InvalidTextEvent {}

/// A helper branch already selected by the original C message call. The Rust
/// presentation layer never consults blindness, awareness, hearing, or RNG.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HelperVariant {
    #[default]
    Plain,
    Dream,
    Underwater,
    Blind,
    Quoted,
}

/// Public message context frozen at an actual native output callback.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GameplayContext {
    pub api: String,
    #[serde(rename = "helperVariant", default)]
    pub helper_variant: HelperVariant,
    /// Already computed accessibility `dirstr`, without the following colon.
    /// This raw public qualifier must remain visible until it is localized.
    #[serde(rename = "locationPrefix", default)]
    pub location_prefix: Option<String>,
    /// Original native quest conversion metadata; diagnostic text is never a
    /// semantic lookup key. The browser owns complete output-group assembly.
    #[serde(default)]
    pub quest: Option<QuestContext>,
}

/// Which selected Lua quest field produced an actual native output group.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QuestField {
    Text,
    Item,
}

/// Frozen original quest conversion facts, without replaying substitutions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuestContext {
    pub sequence: u32,
    pub line_index: u32,
    pub line_count: u32,
    #[serde(rename = "final")]
    pub is_final: bool,
    pub capture_complete: bool,
    pub window: i32,
    pub resolved_section: String,
    pub resolved_message_id: String,
    pub item_index: u32,
    pub field: QuestField,
    pub source_template: String,
    pub decoded_line: String,
}

impl QuestContext {
    fn valid(&self) -> bool {
        self.sequence != 0
            && (1..=4_096).contains(&self.line_count)
            && self.line_index < self.line_count
            && self.is_final == (self.line_index + 1 == self.line_count)
            && match self.field {
                QuestField::Text => self.item_index == 0,
                QuestField::Item => self.item_index != 0,
            }
            && [&self.resolved_section, &self.resolved_message_id]
                .into_iter()
                .all(|text| {
                    !text.is_empty() && text.len() <= MAX_TEXT_ID_BYTES && !text.contains('\0')
                })
            && [&self.source_template, &self.decoded_line]
                .into_iter()
                .all(|text| text.len() <= MAX_TEXT_BYTES && !text.contains('\0'))
    }
}

/// Immutable semantic gameplay envelope captured before native printf output.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GameplayEvent {
    pub event: TextEvent,
    pub context: GameplayContext,
}

impl GameplayContext {
    /// Select an explicit catalog variant from frozen native context.
    ///
    /// # Errors
    /// Rejects malformed API names, incompatible helper branches, oversized
    /// location qualifiers, and variant identifiers beyond the identifier bound.
    pub fn text_id(&self, original: &TextId) -> Result<TextId, InvalidGameplayContext> {
        let mut api_bytes = self.api.bytes();
        if self.api.len() > 64
            || !matches!(api_bytes.next(), Some(b'a'..=b'z' | b'A'..=b'Z' | b'_'))
            || !api_bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
            || self
                .location_prefix
                .as_ref()
                .is_some_and(|text| text.len() > MAX_TEXT_BYTES || text.contains('\0'))
            || self.quest.as_ref().is_some_and(|quest| !quest.valid())
        {
            return Err(InvalidGameplayContext);
        }
        let prefix = match (self.api.as_str(), self.helper_variant) {
            (_, HelperVariant::Plain) => return Ok(original.clone()),
            ("verbalize" | "verbalize1", HelperVariant::Quoted) => return Ok(original.clone()),
            ("You_feel" | "You_hear" | "You_hear1" | "You_see", HelperVariant::Dream) => {
                "variant.dream."
            }
            ("You_hear" | "You_hear1", HelperVariant::Underwater) => "variant.underwater.",
            ("You_see", HelperVariant::Blind) => "variant.blind.",
            _ => return Err(InvalidGameplayContext),
        };
        TextId::try_from(format!("{prefix}{original}")).map_err(|_| InvalidGameplayContext)
    }
}

/// Invalid frozen semantic context; callers retain exact native fallback text.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InvalidGameplayContext;

impl fmt::Display for InvalidGameplayContext {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("invalid frozen gameplay text context")
    }
}

impl std::error::Error for InvalidGameplayContext {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semantic_ids_validate_english_keys_and_reject_ambiguous_keys() {
        for valid in ["game.you_hit", "entity.orc", "ui.save.v1"] {
            assert!(TextId::try_from(valid.to_owned()).is_ok());
        }
        for invalid in ["", ".game", "game..hit", "Game.hit", "game.命中", "game.%s"] {
            assert!(TextId::try_from(invalid.to_owned()).is_err());
        }
    }

    #[test]
    fn unknown_event_fields_and_invalid_ids_are_rejected_before_use() {
        assert!(
            serde_json::from_str::<TextEvent>(r#"{"id":"game.hit","args":{},"effect_index":5}"#)
                .is_err()
        );
        assert!(serde_json::from_str::<TextEvent>(r#"{"id":"ゲーム.hit"}"#).is_err());
    }

    #[test]
    fn exact_source_ids_allow_only_a_terminal_ten_hex_fingerprint() {
        for id in [
            "nethack.message.attack.pline.hit.0123456789",
            "variant.dream.nethack.message.attack.pline.hit.5a1234bcde",
        ] {
            assert!(TextId::try_from(id.to_owned()).is_ok());
        }
        for id in [
            "0123456789",
            "game.0123",
            "game.012345678z",
            "game.0123456789.extra",
            "game.0123456789.0123456789",
            "game.5ABCDEF123",
        ] {
            assert!(TextId::try_from(id.to_owned()).is_err());
        }
    }

    #[test]
    fn gameplay_context_uses_only_captured_helper_variants() {
        let envelope: GameplayEvent = serde_json::from_str(r#"{"event":{"id":"game.hear.0123456789"},"context":{"api":"You_hear","helperVariant":"underwater","locationPrefix":null}}"#).expect("event");
        assert_eq!(
            envelope
                .context
                .text_id(&envelope.event.id)
                .expect("context")
                .as_str(),
            "variant.underwater.game.hear.0123456789"
        );
        let invalid: GameplayEvent = serde_json::from_str(r#"{"event":{"id":"game.hear.0123456789"},"context":{"api":"pline","helperVariant":"blind"}}"#).expect("event");
        assert!(invalid.context.text_id(&invalid.event.id).is_err());
        assert!(serde_json::from_str::<GameplayEvent>(r#"{"event":{"id":"game.hear"},"context":{"api":"pline","helperVariant":"plain","privateEffect":1}}"#).is_err());
    }

    fn empty_event() -> TextEvent {
        TextEvent {
            id: TextId::try_from("name.public".to_owned()).expect("id"),
            args: BTreeMap::new(),
        }
    }

    #[test]
    fn nested_event_depth_counts_the_root_as_zero() {
        let mut event = empty_event();
        for _ in 0..MAX_EVENT_DEPTH {
            event = TextEvent {
                id: event.id.clone(),
                args: BTreeMap::from([("name".to_owned(), TextArgument::Event(Box::new(event)))]),
            };
        }
        assert_eq!(event.validate_tree(), Ok(()));
        let too_deep = TextEvent {
            id: event.id.clone(),
            args: BTreeMap::from([("name".to_owned(), TextArgument::Event(Box::new(event)))]),
        };
        assert_eq!(too_deep.validate_tree(), Err(InvalidTextEvent::TooDeep));
    }

    #[test]
    fn event_node_and_argument_budgets_apply_across_siblings() {
        let mut nodes = empty_event();
        for branch in 0..8 {
            let mut child = empty_event();
            let leaves = if branch == 7 { 55 } else { 64 };
            for leaf in 0..leaves {
                child.args.insert(
                    format!("leaf_{leaf}"),
                    TextArgument::Event(Box::new(empty_event())),
                );
            }
            nodes.args.insert(
                format!("branch_{branch}"),
                TextArgument::Event(Box::new(child)),
            );
        }
        assert_eq!(nodes.validate_tree(), Ok(())); // Exactly 512 event nodes.
        let Some(TextArgument::Event(last)) = nodes.args.get_mut("branch_7") else {
            panic!("branch");
        };
        last.args.insert(
            "leaf_55".to_owned(),
            TextArgument::Event(Box::new(empty_event())),
        );
        assert_eq!(nodes.validate_tree(), Err(InvalidTextEvent::TooLarge));

        let mut arguments = empty_event();
        for branch in 0..64 {
            let mut child = empty_event();
            if branch != 63 {
                for slot in 0..64 {
                    child
                        .args
                        .insert(format!("arg_{slot}"), TextArgument::Integer(0));
                }
            }
            arguments.args.insert(
                format!("branch_{branch}"),
                TextArgument::Event(Box::new(child)),
            );
        }
        assert_eq!(arguments.validate_tree(), Ok(())); // Exactly 4096 slots.
        let Some(TextArgument::Event(last)) = arguments.args.get_mut("branch_63") else {
            panic!("branch");
        };
        last.args
            .insert("extra".to_owned(), TextArgument::Integer(0));
        assert_eq!(arguments.validate_tree(), Err(InvalidTextEvent::TooLarge));
    }

    #[test]
    fn total_utf8_budget_counts_ids_names_and_unselected_literal_values() {
        let mut event = empty_event();
        let overhead = event.id.as_str().len() + 4 * "arg_0".len();
        for index in 0..4 {
            let bytes = if index == 3 {
                MAX_TEXT_BYTES - overhead
            } else {
                MAX_TEXT_BYTES
            };
            event.args.insert(
                format!("arg_{index}"),
                TextArgument::Text("x".repeat(bytes)),
            );
        }
        assert_eq!(event.validate_tree(), Ok(()));
        let Some(TextArgument::Text(last)) = event.args.get_mut("arg_3") else {
            panic!("text");
        };
        last.push('x');
        assert_eq!(event.validate_tree(), Err(InvalidTextEvent::TooLarge));
        let mut invalid_name = empty_event();
        invalid_name
            .args
            .insert("%private".to_owned(), TextArgument::Integer(0));
        assert_eq!(
            invalid_name.validate_tree(),
            Err(InvalidTextEvent::ArgumentName)
        );
    }

    #[test]
    fn frozen_quest_metadata_has_strict_types_and_line_identity() {
        let mut context: QuestContext = serde_json::from_str(r#"{"sequence":1,"lineIndex":1,"lineCount":2,"final":true,"captureComplete":true,"window":-1,"resolvedSection":"Arc","resolvedMessageId":"assignquest","itemIndex":0,"field":"text","sourceTemplate":"%n challenges you.","decodedLine":"the Dark One challenges you."}"#).expect("quest metadata");
        assert!(context.valid());
        context.is_final = false;
        assert!(!context.valid());
        context.is_final = true;
        context.line_count = 4_097;
        assert!(!context.valid());
        context.line_count = 2;
        context.sequence = 0;
        assert!(!context.valid());
        context.sequence = 1;
        context.field = QuestField::Item;
        assert!(!context.valid());
        context.item_index = 1;
        assert!(context.valid());
        assert!(serde_json::from_str::<QuestContext>(r#"{"sequence":1,"lineIndex":0,"lineCount":1,"final":true,"captureComplete":true,"window":0,"resolvedSection":"Arc","resolvedMessageId":"assignquest","itemIndex":0,"field":"text","sourceTemplate":"","decodedLine":"","hiddenState":0}"#).is_err());
    }
}
