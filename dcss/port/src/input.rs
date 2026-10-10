//! Browser input -> the exact console key codes in upstream cio.h.
//! No simulation, storage, rendering or random generator is reachable here.
use serde::{Deserialize, Serialize};

pub const CK_UP: i32 = -254;
pub const CK_DOWN: i32 = -253;
pub const CK_LEFT: i32 = -252;
pub const CK_RIGHT: i32 = -251;
const MODIFIER_OFFSET: i32 = 11;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
pub struct Modifiers {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub meta: bool,
    pub composing: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Context {
    Command,
    Text,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum InputAction {
    Key(i32),
    Text(String),
    Ignore,
}

/// Translate an individual key. The engine retains command meaning and timing.
pub fn translate(key: &str, modifiers: Modifiers, context: Context) -> InputAction {
    if modifiers.alt || modifiers.meta || modifiers.composing {
        return InputAction::Ignore;
    }
    let base = match key {
        "ArrowUp" => Some(CK_UP),
        "ArrowDown" => Some(CK_DOWN),
        "ArrowLeft" => Some(CK_LEFT),
        "ArrowRight" => Some(CK_RIGHT),
        "Insert" => Some(-250),
        "Home" => Some(-249),
        "End" => Some(-248),
        "PageUp" => Some(-246),
        "PageDown" => Some(-245),
        _ => None,
    };
    if let Some(base) = base {
        let group = i32::from(modifiers.shift) + 2 * i32::from(modifiers.ctrl);
        return InputAction::Key(base + group * MODIFIER_OFFSET);
    }
    let group = i32::from(modifiers.shift) + 2 * i32::from(modifiers.ctrl);
    let control = match key {
        "Enter" => Some(if group == 0 { 13 } else { -210 + group * 5 }),
        "Backspace" => Some(if group == 0 { 8 } else { -209 + group * 5 }),
        "Escape" => Some(if group == 0 { 27 } else { -208 + group * 5 }),
        "Delete" => Some(if group == 0 { -255 } else { -207 + group * 5 }),
        " " => Some(if group == 0 { 32 } else { -206 + group * 5 }),
        "Tab" => Some(if group == 0 { 9 } else { -244 + group * 11 }),
        _ => None,
    };
    if let Some(code) = control {
        return InputAction::Key(code);
    }
    let mut chars = key.chars();
    match (chars.next(), chars.next()) {
        (Some(c), None) if c.is_ascii() && !c.is_ascii_control() => {
            let byte = c as u8;
            if modifiers.ctrl {
                return if byte.is_ascii_alphabetic() {
                    InputAction::Key(i32::from(byte.to_ascii_uppercase() & 31))
                } else {
                    InputAction::Ignore
                };
            }
            InputAction::Key(i32::from(byte))
        }
        (Some(_), None) if context == Context::Text && !modifiers.ctrl => {
            InputAction::Text(key.to_owned())
        }
        _ => InputAction::Ignore,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MouseEvent {
    pub column: u16,
    pub row: u16,
    pub button: u8,
}

pub fn mouse(column: i32, row: i32, button: u8, columns: u16, rows: u16) -> Option<MouseEvent> {
    let column = u16::try_from(column).ok()?;
    let row = u16::try_from(row).ok()?;
    if column >= columns || row >= rows || !(1..=3).contains(&button) {
        return None;
    }
    Some(MouseEvent {
        column,
        row,
        button,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn keycodes_match_compiled_official_header() {
        let reference: serde_json::Value =
            serde_json::from_str(include_str!("../../tests/reference_rng.json"))
                .expect("official fixture");
        for (key, shift, ctrl, name) in [
            ("ArrowUp", false, false, "CK_UP"),
            ("ArrowDown", false, false, "CK_DOWN"),
            ("ArrowLeft", false, false, "CK_LEFT"),
            ("ArrowRight", false, false, "CK_RIGHT"),
            ("ArrowUp", true, false, "CK_SHIFT_UP"),
            ("ArrowUp", false, true, "CK_CTRL_UP"),
            ("ArrowUp", true, true, "CK_CTRL_SHIFT_UP"),
            ("Home", false, false, "CK_HOME"),
            ("Tab", true, false, "CK_SHIFT_TAB"),
            ("Tab", false, true, "CK_CTRL_TAB"),
        ] {
            let code = i32::try_from(reference["keys"][name].as_i64().expect("compiled code"))
                .expect("i32 code");
            assert_eq!(
                translate(
                    key,
                    Modifiers {
                        shift,
                        ctrl,
                        ..Modifiers::default()
                    },
                    Context::Command
                ),
                InputAction::Key(code)
            );
        }
    }
    #[test]
    fn keys_match_upstream_enumeration() {
        assert_eq!(
            translate("ArrowUp", Modifiers::default(), Context::Command),
            InputAction::Key(-254)
        );
        assert_eq!(
            translate(
                "ArrowUp",
                Modifiers {
                    shift: true,
                    ..Modifiers::default()
                },
                Context::Command
            ),
            InputAction::Key(-243)
        );
        assert_eq!(
            translate(
                "ArrowUp",
                Modifiers {
                    ctrl: true,
                    ..Modifiers::default()
                },
                Context::Command
            ),
            InputAction::Key(-232)
        );
        assert_eq!(
            translate(
                "ArrowUp",
                Modifiers {
                    ctrl: true,
                    shift: true,
                    ..Modifiers::default()
                },
                Context::Command
            ),
            InputAction::Key(-221)
        );
        assert_eq!(
            translate(
                "Enter",
                Modifiers {
                    ctrl: true,
                    ..Modifiers::default()
                },
                Context::Command
            ),
            InputAction::Key(-200)
        );
        assert_eq!(
            translate(
                "S",
                Modifiers {
                    ctrl: true,
                    ..Modifiers::default()
                },
                Context::Command
            ),
            InputAction::Key(19)
        );
    }
    #[test]
    fn ime_and_unicode_cannot_be_game_commands() {
        assert_eq!(
            translate("あ", Modifiers::default(), Context::Command),
            InputAction::Ignore
        );
        assert_eq!(
            translate("あ", Modifiers::default(), Context::Text),
            InputAction::Text("あ".into())
        );
        assert_eq!(
            translate(
                "a",
                Modifiers {
                    composing: true,
                    ..Modifiers::default()
                },
                Context::Text
            ),
            InputAction::Ignore
        );
        assert_eq!(
            translate(
                "h",
                Modifiers {
                    alt: true,
                    ..Modifiers::default()
                },
                Context::Command
            ),
            InputAction::Ignore
        );
    }
    #[test]
    fn mouse_coordinates_are_checked() {
        assert!(mouse(-1, 0, 1, 80, 24).is_none());
        assert!(mouse(80, 0, 1, 80, 24).is_none());
        assert_eq!(mouse(79, 23, 1, 80, 24).map(|e| e.column), Some(79));
    }
}
