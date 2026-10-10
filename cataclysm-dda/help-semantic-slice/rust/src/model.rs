//! Owned presentation data. No binding descriptor is an accepted input command.
use serde::Deserialize;

/// Exact original enum identity; character codes and physical key codes stay distinct.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BindingType { Error, Timeout, KeyboardChar, KeyboardCode, Gamepad, Mouse }
/// Ordering matches original keymod_t/std::set; observers validate uniqueness/order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Modifier { Ctrl, Alt, Shift }
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BindingOrigin { Context, Default, Missing }

/// Source metadata shared conceptually with the independent live-context observer.
/// This family wraps it separately with presentation policy, never authorization.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RawBindingDescriptor {
    pub event_type: BindingType,
    pub modifiers: Vec<Modifier>,
    pub sequence: Vec<i32>,
    pub text: String,
    pub edit: String,
    pub edit_refresh: bool,
}
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RawPresentationBinding {
    pub native: RawBindingDescriptor,
    pub enabled_for_presentation: bool,
    pub single_printable: bool,
}

/// Immutable validated copy with no engine-memory or mutable-state handle.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PresentationBinding(pub(crate) RawPresentationBinding);
impl PresentationBinding {
    pub fn event_type(&self) -> BindingType { self.0.native.event_type }
    pub fn modifiers(&self) -> &[Modifier] { &self.0.native.modifiers }
    pub fn sequence(&self) -> &[i32] { &self.0.native.sequence }
    pub fn text(&self) -> &str { &self.0.native.text }
    pub fn edit(&self) -> &str { &self.0.native.edit }
    pub fn edit_refresh(&self) -> bool { self.0.native.edit_refresh }
    pub fn enabled_for_presentation(&self) -> bool { self.0.enabled_for_presentation }
    pub fn single_printable(&self) -> bool { self.0.single_printable }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RawBindingObservation {
    pub category: String,
    pub action: String,
    pub origin: BindingOrigin,
    pub bindings: Vec<RawPresentationBinding>,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeyBinding {
    pub(crate) category: String,
    pub(crate) action: String,
    pub(crate) origin: BindingOrigin,
    pub(crate) bindings: Vec<PresentationBinding>,
}
impl KeyBinding {
    pub fn category(&self) -> &str { &self.category }
    pub fn action(&self) -> &str { &self.action }
    pub fn origin(&self) -> BindingOrigin { self.origin }
    pub fn bindings(&self) -> &[PresentationBinding] { &self.bindings }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GridRole { NorthWest, North, NorthEast, West, Pause, East, SouthWest, South, SouthEast }
impl GridRole {
    pub const ORDERED: [Self; 9] = [Self::NorthWest, Self::North, Self::NorthEast,
        Self::West, Self::Pause, Self::East, Self::SouthWest, Self::South, Self::SouthEast];
    pub const fn action(self) -> &'static str {
        match self {
            Self::NorthWest => "LEFTUP", Self::North => "UP", Self::NorthEast => "RIGHTUP",
            Self::West => "LEFT", Self::Pause => "pause", Self::East => "RIGHT",
            Self::SouthWest => "LEFTDOWN", Self::South => "DOWN", Self::SouthEast => "RIGHTDOWN",
        }
    }
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RawGridCell {
    pub role: GridRole,
    pub action: String,
    pub row: u8,
    pub column: u8,
    pub alternatives: [Option<RawPresentationBinding>; 2],
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RawGrid {
    pub category: String,
    pub cells: [RawGridCell; 9],
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GridCell {
    pub(crate) role: GridRole,
    pub(crate) action: String,
    pub(crate) row: u8,
    pub(crate) column: u8,
    pub(crate) alternatives: [Option<PresentationBinding>; 2],
}
impl GridCell {
    pub fn role(&self) -> GridRole { self.role }
    pub fn action(&self) -> &str { &self.action }
    pub fn row(&self) -> u8 { self.row }
    pub fn column(&self) -> u8 { self.column }
    pub fn alternatives(&self) -> &[Option<PresentationBinding>; 2] { &self.alternatives }
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StructuredDirectionGrid { pub(crate) cells: Vec<GridCell> }
impl StructuredDirectionGrid {
    pub fn cells(&self) -> &[GridCell] { &self.cells }
    pub fn category(&self) -> &'static str { "DEFAULTMODE" }
    pub fn alternatives_per_cell(&self) -> usize { 2 }
    pub fn command_authorization(&self) -> CommandAuthorization { CommandAuthorization::Denied }
}

/// No Allowed variant exists. This source-preparation milestone only observes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommandAuthorization { Denied }
