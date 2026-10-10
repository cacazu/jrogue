//! Pure browser input mapping to original ToME key identifiers.
//! This crate cannot access actors, maps, Lua, RNG, gameplay rules, or storage.

use serde::{Deserialize, Serialize};
use tome_core_contracts::VirtualKey;
use tome_core_contracts::ui::{UiCommand, UiKey, UiSnapshot};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KeyInput {
    pub key: String,
    #[serde(default)]
    pub code: String,
    #[serde(default)]
    pub repeat: bool,
    #[serde(default)]
    pub composing: bool,
    #[serde(default)]
    pub ctrl: bool,
    #[serde(default)]
    pub alt: bool,
    #[serde(default)]
    pub meta: bool,
    #[serde(default)]
    pub shift: bool,
    #[serde(default)]
    pub editable: bool,
}

/// Preserve original arrow/keypad movement defaults and leave unrelated input alone.
/// `.` is original RUN, not MOVE_STAY; it is intentionally not remapped to a turn.
#[must_use]
pub fn key_command(input: &KeyInput) -> Option<VirtualKey> {
    if input.repeat
        || input.composing
        || input.ctrl
        || input.alt
        || input.meta
        || input.shift
        || input.editable
    {
        return None;
    }
    match input.code.as_str() {
        "Numpad1" => return Some(VirtualKey::MoveLeftDown),
        "Numpad2" => return Some(VirtualKey::MoveDown),
        "Numpad3" => return Some(VirtualKey::MoveRightDown),
        "Numpad4" => return Some(VirtualKey::MoveLeft),
        "Numpad5" => return Some(VirtualKey::MoveStay),
        "Numpad6" => return Some(VirtualKey::MoveRight),
        "Numpad7" => return Some(VirtualKey::MoveLeftUp),
        "Numpad8" => return Some(VirtualKey::MoveUp),
        "Numpad9" => return Some(VirtualKey::MoveRightUp),
        _ => {}
    }
    match input.key.as_str() {
        "ArrowLeft" => Some(VirtualKey::MoveLeft),
        "ArrowRight" => Some(VirtualKey::MoveRight),
        "ArrowUp" => Some(VirtualKey::MoveUp),
        "ArrowDown" => Some(VirtualKey::MoveDown),
        _ => None,
    }
}

/// A touch control submits an actual original action ID, never a direct coordinate edit.
#[must_use]
pub fn touch_command(key: VirtualKey) -> VirtualKey {
    key
}

/// A modal dialog consumes supported keys through its existing original handlers.
/// Focused component bindings get priority, matching original Dialog:keyEvent.
#[must_use]
pub fn dialog_command(input: &KeyInput, snapshot: &UiSnapshot) -> Option<UiCommand> {
    if input.repeat
        || input.composing
        || input.ctrl
        || input.alt
        || input.meta
        || input.shift
        || input.editable
    {
        return None;
    }
    let key = match input.key.as_str() {
        "Enter" => UiKey::Accept,
        "Escape" => UiKey::Exit,
        "ArrowUp" => UiKey::MoveUp,
        "ArrowDown" => UiKey::MoveDown,
        "ArrowLeft" => UiKey::MoveLeft,
        "ArrowRight" => UiKey::MoveRight,
        _ => return None,
    };
    let top = snapshot.top()?;
    let target = top
        .focused
        .as_ref()
        .and_then(|handle| {
            top.components
                .iter()
                .find(|c| &c.handle == handle && !c.hidden && c.actions.contains(&key))
        })
        .map(|c| c.handle.clone());
    if target.is_none() && !top.actions.contains(&key) {
        return None;
    }
    Some(UiCommand {
        dialog: top.handle.clone(),
        target,
        key,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modal_keys_prioritize_original_component_and_protect_text_entry() {
        let ui = UiSnapshot::from_bytes(br#"{"protocol":1,"stack":[{"handle":"d_1","class_name":"engine.ui.Dialog","bounds":{"x":0,"y":0,"w":100,"h":100},"active":true,"focused":"c_2","actions":["EXIT"],"components":[{"handle":"c_2","class_name":"engine.ui.Button","kind":"button","bounds":{"x":0,"y":0,"w":90,"h":40},"hidden":false,"focused":true,"can_focus":true,"actions":["ACCEPT"]}]}]}"#).expect("UI fixture");
        assert_eq!(
            dialog_command(&key(r#"{"key":"Enter"}"#), &ui),
            Some(UiCommand {
                dialog: "d_1".into(),
                target: Some("c_2".into()),
                key: UiKey::Accept
            })
        );
        assert_eq!(
            dialog_command(&key(r#"{"key":"Escape"}"#), &ui),
            Some(UiCommand {
                dialog: "d_1".into(),
                target: None,
                key: UiKey::Exit
            })
        );
        assert_eq!(
            dialog_command(&key(r#"{"key":"Enter","composing":true}"#), &ui),
            None
        );
        assert_eq!(
            dialog_command(&key(r#"{"key":"Enter","editable":true}"#), &ui),
            None
        );
    }

    fn key(json: &str) -> KeyInput {
        serde_json::from_str(json).expect("fixture")
    }

    #[test]
    fn keyboard_routes_original_defaults_without_fake_wait_or_attack() {
        assert_eq!(
            key_command(&key(r#"{"key":"ArrowLeft"}"#)),
            Some(VirtualKey::MoveLeft)
        );
        assert_eq!(
            key_command(&key(r#"{"key":"Home","code":"Numpad7"}"#)),
            Some(VirtualKey::MoveLeftUp)
        );
        assert_eq!(
            key_command(&key(r#"{"key":"Clear","code":"Numpad5"}"#)),
            Some(VirtualKey::MoveStay)
        );
        for name in [".", "Enter", " ", "w", "Process", "Dead"] {
            assert_eq!(key_command(&key(&format!(r#"{{"key":"{name}"}}"#))), None);
        }
    }

    #[test]
    fn composition_repeat_modifiers_and_editables_never_dispatch_gameplay() {
        for field in [
            "repeat",
            "composing",
            "ctrl",
            "alt",
            "meta",
            "shift",
            "editable",
        ] {
            let input = key(&format!(r#"{{"key":"ArrowRight","{field}":true}}"#));
            assert_eq!(key_command(&input), None);
        }
        assert!(serde_json::from_str::<KeyInput>(r#"{"key":"ArrowUp","life":999}"#).is_err());
        assert!(serde_json::from_str::<KeyInput>(r#"{"repeat":false}"#).is_err());
    }
}
