use serde::Deserialize;
use std::fmt;

use crate::{MAX_FIELD_BYTES, SOURCE_COMMIT};

/// Explicit expected identity for one original-engine integration build.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BuildIdentity {
    build_id: String,
}

impl BuildIdentity {
    pub fn new(build_id: String) -> Result<Self, IdentityError> {
        if build_id.is_empty() || build_id.len() > MAX_FIELD_BYTES {
            return Err(IdentityError);
        }
        Ok(Self { build_id })
    }

    pub fn build_id(&self) -> &str { &self.build_id }
    pub fn source_commit(&self) -> &'static str { SOURCE_COMMIT }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct IdentityError;
impl fmt::Display for IdentityError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("expected build identity must have 1..=16384 UTF-8 bytes")
    }
}
impl std::error::Error for IdentityError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextPolicy { RawUtf8, NativeContext }

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PreferredKeyboardMode { Keychar, Keycode }

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BindingType { Error, Timeout, KeyboardChar, KeyboardCode, Gamepad, Mouse }

/// Declaration order matches the original keymod_t/std::set order.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Modifier { Ctrl, Alt, Shift }

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BindingOrigin { Context, Default, Missing }

/// Binding metadata, deliberately distinct from an accepted raw input event.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BindingDescriptor {
    pub(crate) event_type: BindingType,
    pub(crate) modifiers: Vec<Modifier>,
    pub(crate) sequence: Vec<i32>,
    pub(crate) text: String,
    pub(crate) edit: String,
    pub(crate) edit_refresh: bool,
}
impl BindingDescriptor {
    pub fn event_type(&self) -> BindingType { self.event_type }
    pub fn modifiers(&self) -> &[Modifier] { &self.modifiers }
    pub fn sequence(&self) -> &[i32] { &self.sequence }
    pub fn text(&self) -> &str { &self.text }
    pub fn edit(&self) -> &str { &self.edit }
    pub fn edit_refresh(&self) -> bool { self.edit_refresh }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RegisteredAction {
    pub(crate) index: u32,
    pub(crate) id: String,
    pub(crate) origin: BindingOrigin,
    pub(crate) bindings: Vec<BindingDescriptor>,
}
impl RegisteredAction {
    pub fn index(&self) -> u32 { self.index }
    pub fn id(&self) -> &str { &self.id }
    pub fn origin(&self) -> BindingOrigin { self.origin }
    pub fn bindings(&self) -> &[BindingDescriptor] { &self.bindings }
}

/// Validated owned data. No public deserialization or mutation bypass exists.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContextSnapshot {
    pub(crate) identity: BuildIdentity,
    pub(crate) publication: u64,
    pub(crate) context_epoch: u64,
    pub(crate) parent_context_epoch: u64,
    pub(crate) depth: u32,
    pub(crate) category: String,
    pub(crate) text_policy: TextPolicy,
    pub(crate) preferred_keyboard_mode: PreferredKeyboardMode,
    pub(crate) effective_timeout_ms: i32,
    pub(crate) registered_any_input: bool,
    pub(crate) coordinate_input_enabled: bool,
    pub(crate) iso_mode: bool,
    pub(crate) actions: Vec<RegisteredAction>,
}
impl ContextSnapshot {
    pub fn identity(&self) -> &BuildIdentity { &self.identity }
    pub fn publication_sequence(&self) -> u64 { self.publication }
    pub fn context_epoch(&self) -> u64 { self.context_epoch }
    pub fn parent_context_epoch(&self) -> u64 { self.parent_context_epoch }
    pub fn depth(&self) -> u32 { self.depth }
    pub fn category(&self) -> &str { &self.category }
    pub fn text_policy(&self) -> TextPolicy { self.text_policy }
    pub fn preferred_keyboard_mode(&self) -> PreferredKeyboardMode { self.preferred_keyboard_mode }
    pub fn effective_timeout_ms(&self) -> i32 { self.effective_timeout_ms }
    pub fn registered_any_input(&self) -> bool { self.registered_any_input }
    pub fn coordinate_input_enabled(&self) -> bool { self.coordinate_input_enabled }
    pub fn iso_mode(&self) -> bool { self.iso_mode }
    pub fn actions(&self) -> &[RegisteredAction] { &self.actions }
    pub fn command_authorization(&self) -> CommandAuthorization {
        CommandAuthorization::Denied(DenialReason::UntrackedNativeReaders)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DenialReason { UntrackedNativeReaders }

/// No Allowed variant exists in this observation-only Phase 1 contract.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CommandAuthorization { Denied(DenialReason) }
