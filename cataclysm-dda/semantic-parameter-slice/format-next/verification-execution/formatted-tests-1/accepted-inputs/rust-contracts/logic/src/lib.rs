//! Boundary types only. The original C++ engine retains all simulation and RNG.
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;

/// Exact stable source identity; no moving branch is accepted by saves.
pub const UPSTREAM_SHA: &str = "7b2efa5cea38e4d4d97dd0e63b28b9148623da59";
/// The browser/Rust contract, not an upstream save version.
pub const PORT_ABI: &str = "cdda-browser-contract/1";

/// Screen-relative directions. C++ owns map/isometric direction transforms.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    North,
    NorthEast,
    East,
    SouthEast,
    South,
    SouthWest,
    West,
    NorthWest,
}

impl Direction {
    /// The identifier returned by stable `src/action.cpp::action_ident`.
    #[must_use]
    pub const fn upstream_id(self) -> &'static str {
        match self {
            Self::North => "UP",
            Self::NorthEast => "RIGHTUP",
            Self::East => "RIGHT",
            Self::SouthEast => "RIGHTDOWN",
            Self::South => "DOWN",
            Self::SouthWest => "LEFTDOWN",
            Self::West => "LEFT",
            Self::NorthWest => "LEFTUP",
        }
    }
    /// All eight observed upstream movement actions in clockwise order.
    pub const ALL: [Self; 8] = [
        Self::North,
        Self::NorthEast,
        Self::East,
        Self::SouthEast,
        Self::South,
        Self::SouthWest,
        Self::West,
        Self::NorthWest,
    ];
}

/// A bounded, source-backed action set; this is not the complete CDDA action set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "action", content = "direction", rename_all = "snake_case")]
pub enum GameAction {
    Move(Direction),
    Pause,
    WaitMinutes,
    Inventory,
    Examine,
    Pickup,
    SaveQuit,
}
impl GameAction {
    /// Preserve upstream distinction between a one-turn pause and the wait menu.
    #[must_use]
    pub const fn upstream_id(self) -> &'static str {
        match self {
            Self::Move(d) => d.upstream_id(),
            Self::Pause => "pause",
            Self::WaitMinutes => "wait",
            Self::Inventory => "inventory",
            Self::Examine => "examine",
            Self::Pickup => "pickup",
            Self::SaveQuit => "save",
        }
    }
    /// Parse only identifiers actually observed in the stable source.
    #[must_use]
    pub fn from_upstream_id(id: &str) -> Option<Self> {
        for direction in Direction::ALL {
            if direction.upstream_id() == id {
                return Some(Self::Move(direction));
            }
        }
        match id {
            "pause" => Some(Self::Pause),
            "wait" => Some(Self::WaitMinutes),
            "inventory" => Some(Self::Inventory),
            "examine" => Some(Self::Examine),
            "pickup" => Some(Self::Pickup),
            "save" => Some(Self::SaveQuit),
            _ => None,
        }
    }
}

/// UI commands must never be mistaken for gameplay turns.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "action", content = "direction", rename_all = "snake_case")]
pub enum UiAction {
    Navigate(Direction),
    Confirm,
    Cancel,
}

/// An application command routed to the retained engine or the current UI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum Command {
    Game(GameAction),
    Ui(UiAction),
    UserText(String),
}

/// An application use-case implemented by the future upstream bridge only.
/// No implementation in this milestone invents CDDA simulation behavior.
pub trait EngineBridge {
    /// Preserve the actual upstream bridge error type.
    type Error: std::error::Error;
    /// Only this boundary may cause a C++ simulation/RNG transition.
    fn apply(&mut self, command: Command) -> Result<Observation, Self::Error>;
    /// Copy an already computed observation without advancing simulation.
    fn observe(&self) -> Observation;
}

/// Validated semantic identifiers, independent of English prose or source hashes.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct TextId(String);

/// Invalid IDs are rejected while reading both events and catalogs.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
#[error("invalid semantic text identifier: {0}")]
pub struct InvalidTextId(pub String);

impl TryFrom<String> for TextId {
    type Error = InvalidTextId;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.is_empty()
            || value.len() > 160
            || value.split('.').any(|part| {
                part.is_empty()
                    || !part.as_bytes()[0].is_ascii_lowercase()
                    || !part
                        .bytes()
                        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
            })
        {
            return Err(InvalidTextId(value));
        }
        Ok(Self(value))
    }
}
impl From<TextId> for String {
    fn from(id: TextId) -> Self {
        id.0
    }
}
impl TextId {
    /// Construct a validated dotted identifier.
    pub fn new(value: impl Into<String>) -> Result<Self, InvalidTextId> {
        Self::try_from(value.into())
    }
    /// Borrow the semantic ID, never the localized text.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Named parameter types prevent raw English entity names entering localization.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ParameterKind {
    UserText,
    Count,
    Term,
}

/// User-provided text stays verbatim; dynamic entity names resolve by term ID.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "snake_case")]
pub enum ParameterValue {
    UserText(String),
    Count(u64),
    Term { id: TextId, count: u64 },
}
impl ParameterValue {
    /// The type expected by the catalog schema.
    #[must_use]
    pub const fn kind(&self) -> ParameterKind {
        match self {
            Self::UserText(_) => ParameterKind::UserText,
            Self::Count(_) => ParameterKind::Count,
            Self::Term { .. } => ParameterKind::Term,
        }
    }
}

/// A semantic message and its named typed arguments, never a printf program.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TextEvent {
    pub id: TextId,
    pub parameters: BTreeMap<String, ParameterValue>,
}
impl TextEvent {
    /// An event with no arguments, suitable for a static action label.
    #[must_use]
    pub fn plain(id: TextId) -> Self {
        Self {
            id,
            parameters: BTreeMap::new(),
        }
    }
}

/// Immutable text observations prepared by C++ at an engine boundary.
/// This deliberately omits world state, map data, timers and RNG internals.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Observation {
    pub revision: u64,
    pub upstream_turn: i64,
    pub messages: Vec<TextEvent>,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn semantic_ids_are_not_english_sentences_or_hashes() {
        assert!(TextId::new("action.save_quit").is_ok());
        for bad in [
            "",
            "Save and quit",
            "message..invalid",
            "abc.%s",
            ".item",
            "action.0",
        ] {
            assert!(TextId::new(bad).is_err(), "{bad}");
        }
    }
    #[test]
    fn every_supported_action_round_trips_exact_upstream_identifier() {
        for action in Direction::ALL.map(GameAction::Move).into_iter().chain([
            GameAction::Pause,
            GameAction::WaitMinutes,
            GameAction::Inventory,
            GameAction::Examine,
            GameAction::Pickup,
            GameAction::SaveQuit,
        ]) {
            assert_eq!(
                GameAction::from_upstream_id(action.upstream_id()),
                Some(action)
            );
        }
        assert_eq!(GameAction::from_upstream_id("move_n"), None);
        assert_ne!(GameAction::Pause, GameAction::WaitMinutes);
    }
}
