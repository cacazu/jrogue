//! Original dialog/component observations and typed callback identifiers.
//! Opaque handles name adapter metadata; they never reconstruct native objects.

use crate::{MAX_SNAPSHOT_BYTES, PROTOCOL};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UiKey {
    Accept,
    Exit,
    MoveUp,
    MoveDown,
    MoveLeft,
    MoveRight,
}

impl UiKey {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Accept => "ACCEPT",
            Self::Exit => "EXIT",
            Self::MoveUp => "MOVE_UP",
            Self::MoveDown => "MOVE_DOWN",
            Self::MoveLeft => "MOVE_LEFT",
            Self::MoveRight => "MOVE_RIGHT",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UiCommand {
    pub dialog: String,
    #[serde(default)]
    pub target: Option<String>,
    pub key: UiKey,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum UiArgument {
    External { value: String },
    Number { value: f64 },
    Text { id: String },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum UiText {
    Semantic {
        id: String,
        args: BTreeMap<String, UiArgument>,
    },
    External {
        value: String,
    },
    /// Missing provenance is explicit. It must not become an English-string lookup.
    Unresolved {
        source: String,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UiBounds {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UiItem {
    pub index: u32,
    pub text: UiText,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UiComponent {
    pub handle: String,
    pub class_name: String,
    pub kind: String,
    pub bounds: UiBounds,
    pub hidden: bool,
    pub focused: bool,
    pub can_focus: bool,
    #[serde(default)]
    pub input_blocked_until: Option<f64>,
    #[serde(default)]
    pub text: Option<UiText>,
    #[serde(default)]
    pub items: Vec<UiItem>,
    #[serde(default)]
    pub selection: Option<u32>,
    #[serde(default)]
    pub scroll: Option<f64>,
    #[serde(default)]
    pub actions: Vec<UiKey>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DialogView {
    pub handle: String,
    pub class_name: String,
    pub bounds: UiBounds,
    pub active: bool,
    #[serde(default)]
    pub title: Option<UiText>,
    #[serde(default)]
    pub input_blocked_until: Option<f64>,
    #[serde(default)]
    pub focused: Option<String>,
    #[serde(default)]
    pub actions: Vec<UiKey>,
    #[serde(default)]
    pub components: Vec<UiComponent>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UiSnapshot {
    pub protocol: u32,
    pub stack: Vec<DialogView>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UiTrace {
    pub protocol: u32,
    pub command: UiCommand,
    pub after: UiSnapshot,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UiError {
    Bytes,
    Json,
    Protocol,
    Shape,
    Number,
    Stale,
    Modal,
    Text,
}
impl UiError {
    #[must_use]
    pub const fn text_id(self) -> &'static str {
        match self {
            Self::Bytes => "error.core.bytes",
            Self::Json => "error.core.json",
            Self::Protocol => "error.core.protocol",
            Self::Shape => "error.ui.shape",
            Self::Number => "error.core.number",
            Self::Stale => "error.ui.stale",
            Self::Modal => "error.ui.modal",
            Self::Text => "error.ui.text",
        }
    }
}

fn handle_valid(handle: &str) -> bool {
    !handle.is_empty()
        && handle.len() <= 80
        && handle
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
}
fn bounds_valid(bounds: &UiBounds) -> bool {
    [bounds.x, bounds.y, bounds.w, bounds.h]
        .iter()
        .all(|v| v.is_finite())
        && bounds.w >= 0.0
        && bounds.h >= 0.0
}
fn text_valid(text: &UiText) -> bool {
    match text {
        UiText::Semantic { id, args } => {
            !id.is_empty()
                && args.values().all(|arg| match arg {
                    UiArgument::Number { value } => value.is_finite(),
                    UiArgument::Text { id } => !id.is_empty(),
                    UiArgument::External { .. } => true,
                })
        }
        UiText::External { .. } | UiText::Unresolved { .. } => true,
    }
}

impl UiSnapshot {
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, UiError> {
        if bytes.len() > MAX_SNAPSHOT_BYTES {
            return Err(UiError::Bytes);
        }
        let snapshot: Self = serde_json::from_slice(bytes).map_err(|_| UiError::Json)?;
        snapshot.validate()?;
        Ok(snapshot)
    }
    pub fn validate(&self) -> Result<(), UiError> {
        if self.protocol != PROTOCOL {
            return Err(UiError::Protocol);
        }
        if self.stack.len() > 128 {
            return Err(UiError::Shape);
        }
        let mut handles = BTreeSet::new();
        for (index, dialog) in self.stack.iter().enumerate() {
            if !handle_valid(&dialog.handle)
                || !handles.insert(&dialog.handle)
                || dialog.active != (index + 1 == self.stack.len())
                || dialog.components.len() > 4096
            {
                return Err(UiError::Shape);
            }
            if !bounds_valid(&dialog.bounds)
                || dialog.input_blocked_until.is_some_and(|v| !v.is_finite())
            {
                return Err(UiError::Number);
            }
            if dialog.title.as_ref().is_some_and(|v| !text_valid(v)) {
                return Err(UiError::Text);
            }
            for component in &dialog.components {
                if !handle_valid(&component.handle)
                    || !handles.insert(&component.handle)
                    || component.items.len() > 65536
                {
                    return Err(UiError::Shape);
                }
                if !bounds_valid(&component.bounds)
                    || component.scroll.is_some_and(|v| !v.is_finite())
                    || component
                        .input_blocked_until
                        .is_some_and(|v| !v.is_finite())
                {
                    return Err(UiError::Number);
                }
                if component.text.as_ref().is_some_and(|v| !text_valid(v))
                    || component.items.iter().enumerate().any(|(i, item)| {
                        usize::try_from(item.index).ok() != Some(i + 1) || !text_valid(&item.text)
                    })
                {
                    return Err(UiError::Text);
                }
            }
            if dialog
                .focused
                .as_ref()
                .is_some_and(|handle| !dialog.components.iter().any(|c| &c.handle == handle))
            {
                return Err(UiError::Shape);
            }
        }
        Ok(())
    }
    #[must_use]
    pub fn top(&self) -> Option<&DialogView> {
        self.stack.last()
    }
    pub fn validate_command(&self, command: &UiCommand) -> Result<(), UiError> {
        let top = self.top().ok_or(UiError::Stale)?;
        if top.handle != command.dialog {
            return Err(UiError::Stale);
        }
        let actions = if let Some(target) = &command.target {
            let c = top
                .components
                .iter()
                .find(|c| &c.handle == target && !c.hidden)
                .ok_or(UiError::Stale)?;
            &c.actions
        } else {
            &top.actions
        };
        if !actions.contains(&command.key) {
            return Err(UiError::Stale);
        }
        Ok(())
    }
}

impl UiTrace {
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, UiError> {
        if bytes.len() > MAX_SNAPSHOT_BYTES {
            return Err(UiError::Bytes);
        }
        let trace: Self = serde_json::from_slice(bytes).map_err(|_| UiError::Json)?;
        if trace.protocol != PROTOCOL {
            return Err(UiError::Protocol);
        }
        trace.after.validate()?;
        Ok(trace)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn original_ui_shape_and_live_top_action_identity_are_checked() {
        let bytes = br#"{"protocol":1,"stack":[{"handle":"d_1","class_name":"engine.ui.Dialog","bounds":{"x":0,"y":0,"w":100,"h":100},"active":true,"actions":["EXIT"],"components":[{"handle":"c_2","class_name":"engine.ui.List","kind":"list","bounds":{"x":0,"y":0,"w":90,"h":40},"hidden":false,"focused":true,"can_focus":true,"selection":1,"items":[],"actions":["ACCEPT"]}]}]}"#;
        let mut snapshot =
            UiSnapshot::from_bytes(bytes).expect("original empty list may retain selection 1");
        let command = UiCommand {
            dialog: "d_1".into(),
            target: Some("c_2".into()),
            key: UiKey::Accept,
        };
        assert_eq!(snapshot.validate_command(&command), Ok(()));
        snapshot.stack[0].components[0].hidden = true;
        assert_eq!(snapshot.validate_command(&command), Err(UiError::Stale));
        snapshot.stack[0].active = false;
        assert_eq!(snapshot.validate(), Err(UiError::Shape));
        assert_eq!(
            UiSnapshot::from_bytes(br#"{"protocol":1,"stack":[]}"#)
                .expect("empty stack")
                .top(),
            None
        );
    }
}
