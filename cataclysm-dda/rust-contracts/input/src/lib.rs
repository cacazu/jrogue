//! Pure input conversion. It has no engine instance, clock, storage or RNG.
use cdda_logic_contract::{Command, Direction, GameAction, UiAction};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use thiserror::Error;

/// Full pristine upstream fixture; unknown/unsupported actions are not invented.
pub const UPSTREAM_KEYBINDINGS: &str = include_str!("../../fixtures/keybindings.json");

/// The selected upstream input context, not a global key replacement table.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InputContext {
    DefaultMode,
    Menu,
    CharacterName,
}

/// Browser KeyboardEvent data after the host selects the active game surface.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BrowserKey {
    pub key: String,
    pub code: String,
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub meta: bool,
    pub repeat: bool,
    pub composing: bool,
}

/// Typed virtual controls resolve to observed upstream action IDs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "control", content = "direction", rename_all = "snake_case")]
pub enum TouchControl {
    Direction(Direction),
    Confirm,
    Cancel,
    Inventory,
    Examine,
    Pickup,
    Pause,
    WaitMinutes,
    SaveQuit,
}

/// W3C standard gamepad button indices; nonstandard layouts require calibration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "control", content = "value", rename_all = "snake_case")]
pub enum StandardGamepad {
    Button(u8),
    Direction(Direction),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Modifier {
    Shift,
    Ctrl,
    Alt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
enum InputMethod {
    KeyboardAny,
    KeyboardChar,
    KeyboardCode,
    Gamepad,
    Mouse,
}

#[derive(Debug, Deserialize)]
struct Binding {
    input_method: InputMethod,
    #[serde(deserialize_with = "single_or_sequence")]
    key: String,
    #[serde(default, rename = "mod")]
    modifiers: BTreeSet<Modifier>,
}
#[derive(Debug, Deserialize)]
struct Entry {
    id: String,
    category: Option<String>,
    #[serde(default)]
    bindings: Vec<Binding>,
}

/// Upstream binding parse errors are surfaced rather than silently defaulted.
#[derive(Debug, Error)]
pub enum InputError {
    #[error("invalid upstream keybindings JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("ambiguous supported input: {0}")]
    Ambiguous(String),
}

/// Bounded supported bindings read from the actual upstream data file.
#[derive(Debug)]
pub struct Bindings {
    entries: Vec<Entry>,
}

impl Bindings {
    /// Read the bundled pristine stable source fixture.
    pub fn stable() -> Result<Self, InputError> {
        Self::from_json(UPSTREAM_KEYBINDINGS)
    }
    /// Allows a future bridge to supply the upstream-resolved user keybindings.
    /// This milestone does not implement the upstream layered override loader.
    pub fn from_json(json: &str) -> Result<Self, InputError> {
        Ok(Self {
            entries: serde_json::from_str(json)?,
        })
    }

    fn selected<'a>(&'a self, id: &str, category: &str) -> Option<&'a Entry> {
        self.entries
            .iter()
            .find(|entry| entry.id == id && entry.category.as_deref() == Some(category))
            .or_else(|| {
                self.entries
                    .iter()
                    .find(|entry| entry.id == id && entry.category.is_none())
            })
    }

    /// Convert one browser key without reading or mutating any engine state.
    /// IME composition and automatic repeats are left to explicit host handling.
    pub fn keyboard(
        &self,
        context: InputContext,
        key: &BrowserKey,
    ) -> Result<Option<Command>, InputError> {
        if key.composing || key.repeat || key.meta {
            return Ok(None);
        }
        if context == InputContext::CharacterName {
            if key.ctrl || key.alt {
                return Ok(None);
            }
            return Ok(match key.key.as_str() {
                "Enter" => Some(Command::Ui(UiAction::Confirm)),
                "Escape" => Some(Command::Ui(UiAction::Cancel)),
                text if text.chars().count() == 1 => Some(Command::UserText(text.to_owned())),
                _ => None,
            });
        }
        let mut modifiers = BTreeSet::new();
        if key.shift {
            modifiers.insert(Modifier::Shift);
        }
        if key.ctrl {
            modifiers.insert(Modifier::Ctrl);
        }
        if key.alt {
            modifiers.insert(Modifier::Alt);
        }
        let char_key = match key.key.as_str() {
            "ArrowUp" => "UP",
            "ArrowRight" => "RIGHT",
            "ArrowDown" => "DOWN",
            "ArrowLeft" => "LEFT",
            "Escape" => "ESC",
            "Enter" => {
                if key.code == "NumpadEnter" {
                    "KEYPAD_ENTER"
                } else {
                    "RETURN"
                }
            }
            " " => "SPACE",
            value => value,
        };
        // Unicode keyboard_char already contains Shift's text transformation.
        let mut char_modifiers = modifiers.clone();
        if key.key.chars().count() == 1 {
            char_modifiers.remove(&Modifier::Shift);
        }
        let code_key = browser_code(key);
        let mut result = None;
        for (id, command) in supported(context) {
            let category = if context == InputContext::DefaultMode {
                "DEFAULTMODE"
            } else {
                "default"
            };
            if let Some(entry) = self.selected(id, category) {
                let matches = entry
                    .bindings
                    .iter()
                    .any(|binding| match binding.input_method {
                        InputMethod::KeyboardChar => {
                            binding.key == char_key && binding.modifiers == char_modifiers
                        }
                        InputMethod::KeyboardCode => {
                            code_key.as_deref() == Some(binding.key.as_str())
                                && binding.modifiers == modifiers
                        }
                        InputMethod::KeyboardAny => {
                            (binding.key == char_key && binding.modifiers == char_modifiers)
                                || (code_key.as_deref() == Some(binding.key.as_str())
                                    && binding.modifiers == modifiers)
                        }
                        InputMethod::Gamepad | InputMethod::Mouse => false,
                    });
                if matches {
                    insert_unique(&mut result, command, char_key)?;
                }
            }
        }
        Ok(result)
    }

    /// Convert a calibrated standard gamepad control using observed JOY bindings.
    pub fn gamepad(
        &self,
        context: InputContext,
        control: StandardGamepad,
    ) -> Result<Option<Command>, InputError> {
        if context == InputContext::CharacterName {
            return Ok(None);
        }
        let key = match control {
            StandardGamepad::Direction(direction) => match direction {
                Direction::North => "JOY_UP",
                Direction::NorthEast => "JOY_RIGHTUP",
                Direction::East => "JOY_RIGHT",
                Direction::SouthEast => "JOY_RIGHTDOWN",
                Direction::South => "JOY_DOWN",
                Direction::SouthWest => "JOY_LEFTDOWN",
                Direction::West => "JOY_LEFT",
                Direction::NorthWest => "JOY_LEFTUP",
            }
            .to_owned(),
            StandardGamepad::Button(index) if index <= 30 => format!("JOY_{index}"),
            StandardGamepad::Button(_) => return Ok(None),
        };
        let mut result = None;
        for (id, command) in supported(context) {
            let category = if context == InputContext::DefaultMode {
                "DEFAULTMODE"
            } else {
                "default"
            };
            if let Some(entry) = self.selected(id, category) {
                if entry.bindings.iter().any(|binding| {
                    binding.input_method == InputMethod::Gamepad && binding.key == key
                }) {
                    insert_unique(&mut result, command, &key)?;
                }
            }
        }
        Ok(result)
    }

    /// Touch is a new presentation adapter for the same typed upstream actions.
    /// Confirm/cancel are UI-only, never fabricated gameplay turns.
    #[must_use]
    pub fn touch(&self, context: InputContext, control: TouchControl) -> Option<Command> {
        match (context, control) {
            (InputContext::DefaultMode, TouchControl::Direction(d)) => {
                Some(Command::Game(GameAction::Move(d)))
            }
            (InputContext::Menu, TouchControl::Direction(d)) => {
                Some(Command::Ui(UiAction::Navigate(d)))
            }
            (InputContext::Menu | InputContext::CharacterName, TouchControl::Confirm) => {
                Some(Command::Ui(UiAction::Confirm))
            }
            (InputContext::Menu | InputContext::CharacterName, TouchControl::Cancel) => {
                Some(Command::Ui(UiAction::Cancel))
            }
            (InputContext::DefaultMode, TouchControl::Inventory) => {
                Some(Command::Game(GameAction::Inventory))
            }
            (InputContext::DefaultMode, TouchControl::Examine) => {
                Some(Command::Game(GameAction::Examine))
            }
            (InputContext::DefaultMode, TouchControl::Pickup) => {
                Some(Command::Game(GameAction::Pickup))
            }
            (InputContext::DefaultMode, TouchControl::Pause) => {
                Some(Command::Game(GameAction::Pause))
            }
            (InputContext::DefaultMode, TouchControl::WaitMinutes) => {
                Some(Command::Game(GameAction::WaitMinutes))
            }
            (InputContext::DefaultMode, TouchControl::SaveQuit) => {
                Some(Command::Game(GameAction::SaveQuit))
            }
            _ => None,
        }
    }
}

fn insert_unique(
    result: &mut Option<Command>,
    command: Command,
    key: &str,
) -> Result<(), InputError> {
    if let Some(existing) = result.as_ref() {
        if *existing != command {
            return Err(InputError::Ambiguous(key.to_owned()));
        }
    } else {
        *result = Some(command);
    }
    Ok(())
}

fn browser_code(key: &BrowserKey) -> Option<String> {
    let special = match key.code.as_str() {
        "Numpad1" => "KEYPAD_1",
        "Numpad2" => "KEYPAD_2",
        "Numpad3" => "KEYPAD_3",
        "Numpad4" => "KEYPAD_4",
        "Numpad5" => "KEYPAD_5",
        "Numpad6" => "KEYPAD_6",
        "Numpad7" => "KEYPAD_7",
        "Numpad8" => "KEYPAD_8",
        "Numpad9" => "KEYPAD_9",
        "NumpadDecimal" => "KEYPAD_PERIOD",
        "NumpadEnter" => "KEYPAD_ENTER",
        "ArrowUp" => "UP",
        "ArrowDown" => "DOWN",
        "ArrowLeft" => "LEFT",
        "ArrowRight" => "RIGHT",
        "Enter" => "RETURN",
        "Escape" => "ESC",
        "Space" => "SPACE",
        "Backslash" => "\\",
        _ => {
            return if key.key.is_ascii() && key.key.len() == 1 {
                Some(key.key.to_ascii_lowercase())
            } else {
                None
            };
        }
    };
    Some(special.to_owned())
}

fn supported(context: InputContext) -> Vec<(&'static str, Command)> {
    let mut commands: Vec<_> = Direction::ALL
        .into_iter()
        .map(|direction| {
            (
                direction.upstream_id(),
                if context == InputContext::DefaultMode {
                    Command::Game(GameAction::Move(direction))
                } else {
                    Command::Ui(UiAction::Navigate(direction))
                },
            )
        })
        .collect();
    if context == InputContext::DefaultMode {
        commands.extend(
            [
                GameAction::Pause,
                GameAction::WaitMinutes,
                GameAction::Inventory,
                GameAction::Examine,
                GameAction::Pickup,
                GameAction::SaveQuit,
            ]
            .map(|a| (a.upstream_id(), Command::Game(a))),
        );
    } else {
        commands.extend([
            ("CONFIRM", Command::Ui(UiAction::Confirm)),
            ("QUIT", Command::Ui(UiAction::Cancel)),
        ]);
    }
    commands
}

#[cfg(test)]
mod tests {
    use super::*;
    fn key(value: &str, code: &str) -> BrowserKey {
        BrowserKey {
            key: value.into(),
            code: code.into(),
            shift: false,
            ctrl: false,
            alt: false,
            meta: false,
            repeat: false,
            composing: false,
        }
    }
    #[test]
    fn observed_keys_have_context_and_case_sensitive_parity() {
        let b = Bindings::stable().expect("pristine JSON");
        for (character, direction, digit) in [
            ("k", Direction::North, "8"),
            ("u", Direction::NorthEast, "9"),
            ("l", Direction::East, "6"),
            ("n", Direction::SouthEast, "3"),
            ("j", Direction::South, "2"),
            ("b", Direction::SouthWest, "1"),
            ("h", Direction::West, "4"),
            ("y", Direction::NorthWest, "7"),
        ] {
            for event in [
                key(character, ""),
                key(digit, ""),
                key("Unidentified", &format!("Numpad{digit}")),
            ] {
                assert_eq!(
                    b.keyboard(InputContext::DefaultMode, &event)
                        .expect("unambiguous"),
                    Some(Command::Game(GameAction::Move(direction)))
                );
                assert_eq!(
                    b.keyboard(InputContext::Menu, &event).expect("unambiguous"),
                    Some(Command::Ui(UiAction::Navigate(direction)))
                );
            }
        }
        for (character, action) in [
            (".", GameAction::Pause),
            ("5", GameAction::Pause),
            ("|", GameAction::WaitMinutes),
            ("i", GameAction::Inventory),
            ("e", GameAction::Examine),
            ("g", GameAction::Pickup),
        ] {
            assert_eq!(
                b.keyboard(InputContext::DefaultMode, &key(character, ""))
                    .expect("key"),
                Some(Command::Game(action))
            );
        }
        let mut save = key("S", "KeyS");
        save.shift = true;
        assert_eq!(
            b.keyboard(InputContext::DefaultMode, &save).expect("save"),
            Some(Command::Game(GameAction::SaveQuit))
        );
        assert_eq!(
            b.keyboard(InputContext::DefaultMode, &key("s", "KeyS"))
                .expect("s"),
            None
        );
        assert_eq!(
            b.keyboard(InputContext::DefaultMode, &key("w", "KeyW"))
                .expect("w"),
            None
        );
        assert_eq!(
            b.keyboard(InputContext::DefaultMode, &key("Enter", "Enter"))
                .expect("enter"),
            None
        );
    }
    #[test]
    fn gamepad_uses_existing_joy_ids_without_inventing_confirm_binding() {
        let b = Bindings::stable().expect("pristine JSON");
        for direction in Direction::ALL {
            assert_eq!(
                b.gamepad(
                    InputContext::DefaultMode,
                    StandardGamepad::Direction(direction)
                )
                .expect("joy"),
                Some(Command::Game(GameAction::Move(direction)))
            );
        }
        assert_eq!(
            b.gamepad(InputContext::DefaultMode, StandardGamepad::Button(5))
                .expect("joy"),
            Some(Command::Game(GameAction::Inventory))
        );
        assert_eq!(
            b.gamepad(InputContext::DefaultMode, StandardGamepad::Button(7))
                .expect("joy"),
            Some(Command::Game(GameAction::Pause))
        );
        assert_eq!(
            b.gamepad(InputContext::Menu, StandardGamepad::Button(0))
                .expect("joy"),
            None
        );
    }
    #[test]
    fn user_text_composition_and_repeat_do_not_become_gameplay() {
        let b = Bindings::stable().expect("pristine JSON");
        for value in ["q", "Q", "猫", "%", "{"] {
            assert_eq!(
                b.keyboard(InputContext::CharacterName, &key(value, ""))
                    .expect("name"),
                Some(Command::UserText(value.into()))
            );
        }
        let mut composed = key("猫", "");
        composed.composing = true;
        assert_eq!(
            b.keyboard(InputContext::DefaultMode, &composed)
                .expect("ime"),
            None
        );
        let mut repeated = key("k", "KeyK");
        repeated.repeat = true;
        assert_eq!(
            b.keyboard(InputContext::DefaultMode, &repeated)
                .expect("repeat"),
            None
        );
        let mut shortcut = key("i", "KeyI");
        shortcut.ctrl = true;
        assert_eq!(
            b.keyboard(InputContext::DefaultMode, &shortcut)
                .expect("ctrl"),
            None
        );
    }
    #[test]
    fn keyboard_touch_and_gamepad_transcripts_are_deterministic() {
        let b = Bindings::stable().expect("pristine JSON");
        let input = [key("k", "KeyK"), key("i", "KeyI"), key(".", "Period")];
        let convert = || {
            input
                .iter()
                .map(|event| b.keyboard(InputContext::DefaultMode, event).expect("key"))
                .collect::<Vec<_>>()
        };
        let expected = vec![
            Some(Command::Game(GameAction::Move(Direction::North))),
            Some(Command::Game(GameAction::Inventory)),
            Some(Command::Game(GameAction::Pause)),
        ];
        assert_eq!(convert(), expected);
        assert_eq!(convert(), expected);
        let touch: Vec<_> = [
            TouchControl::Direction(Direction::North),
            TouchControl::Inventory,
            TouchControl::Pause,
        ]
        .into_iter()
        .map(|event| b.touch(InputContext::DefaultMode, event))
        .collect();
        let joy: Vec<_> = [
            StandardGamepad::Direction(Direction::North),
            StandardGamepad::Button(5),
            StandardGamepad::Button(7),
        ]
        .into_iter()
        .map(|event| b.gamepad(InputContext::DefaultMode, event).expect("joy"))
        .collect();
        assert_eq!(touch, expected);
        assert_eq!(joy, expected);
        // These assertions prove conversion only; no upstream simulation is run.
    }
}

/// Deliver a complete IME/paste segment in name-entry mode, without translating it.
/// Editing/caret behavior remains in the future browser/upstream text-input bridge.
#[must_use]
pub fn committed_text(context: InputContext, value: &str) -> Option<Command> {
    if context != InputContext::CharacterName
        || value.is_empty()
        || value.chars().any(char::is_control)
    {
        return None;
    }
    Some(Command::UserText(value.to_owned()))
}

#[cfg(test)]
mod source_parity_tests {
    use super::*;
    #[test]
    fn input_action_identifiers_match_the_pristine_cpp_switch() {
        let source = include_str!("../../fixtures/action.cpp");
        for action in Direction::ALL.map(GameAction::Move).into_iter().chain([
            GameAction::Pause,
            GameAction::WaitMinutes,
            GameAction::Inventory,
            GameAction::Examine,
            GameAction::Pickup,
            GameAction::SaveQuit,
        ]) {
            assert!(
                source.contains(&format!("return \"{}\";", action.upstream_id())),
                "{}",
                action.upstream_id()
            );
        }
        let input_header = include_str!("../../fixtures/input.h");
        for name in [
            "JOY_UP",
            "JOY_DOWN",
            "JOY_LEFT",
            "JOY_RIGHT",
            "JOY_RIGHTUP",
            "JOY_LEFTDOWN",
            "JOY_5",
            "JOY_7",
        ] {
            assert!(
                input_header.contains(&format!("constexpr int {name}")),
                "{name}"
            );
        }
    }
    #[test]
    fn every_supported_upstream_default_binding_has_adapter_parity() {
        let table = Bindings::stable().expect("fixture");
        for (identifier, expected) in supported(InputContext::DefaultMode) {
            let entry = table
                .selected(identifier, "DEFAULTMODE")
                .expect("source-backed entry");
            for binding in &entry.bindings {
                match binding.input_method {
                    InputMethod::Gamepad => {
                        let event = match binding.key.as_str() {
                            "JOY_UP" => StandardGamepad::Direction(Direction::North),
                            "JOY_RIGHTUP" => StandardGamepad::Direction(Direction::NorthEast),
                            "JOY_RIGHT" => StandardGamepad::Direction(Direction::East),
                            "JOY_RIGHTDOWN" => StandardGamepad::Direction(Direction::SouthEast),
                            "JOY_DOWN" => StandardGamepad::Direction(Direction::South),
                            "JOY_LEFTDOWN" => StandardGamepad::Direction(Direction::SouthWest),
                            "JOY_LEFT" => StandardGamepad::Direction(Direction::West),
                            "JOY_LEFTUP" => StandardGamepad::Direction(Direction::NorthWest),
                            button => StandardGamepad::Button(
                                button
                                    .strip_prefix("JOY_")
                                    .expect("JOY")
                                    .parse()
                                    .expect("button"),
                            ),
                        };
                        assert_eq!(
                            table
                                .gamepad(InputContext::DefaultMode, event)
                                .expect("joy"),
                            Some(expected.clone())
                        );
                    }
                    InputMethod::Mouse => {
                        panic!("supported default source bindings unexpectedly gained mouse input")
                    }
                    InputMethod::KeyboardAny
                    | InputMethod::KeyboardChar
                    | InputMethod::KeyboardCode => {
                        let (logical, physical) = match binding.key.as_str() {
                            "UP" => ("ArrowUp".to_owned(), "ArrowUp".to_owned()),
                            "DOWN" => ("ArrowDown".to_owned(), "ArrowDown".to_owned()),
                            "LEFT" => ("ArrowLeft".to_owned(), "ArrowLeft".to_owned()),
                            "RIGHT" => ("ArrowRight".to_owned(), "ArrowRight".to_owned()),
                            "KEYPAD_PERIOD" => (".".to_owned(), "NumpadDecimal".to_owned()),
                            key if key.starts_with("KEYPAD_") => {
                                ("Unidentified".to_owned(), format!("Numpad{}", &key[7..]))
                            }
                            "s" if binding.modifiers.contains(&Modifier::Shift) => {
                                ("S".to_owned(), "KeyS".to_owned())
                            }
                            "\\" if binding.modifiers.contains(&Modifier::Shift) => {
                                ("|".to_owned(), "Backslash".to_owned())
                            }
                            other => (other.to_owned(), String::new()),
                        };
                        let key = BrowserKey {
                            key: logical,
                            code: physical,
                            shift: binding.modifiers.contains(&Modifier::Shift),
                            ctrl: binding.modifiers.contains(&Modifier::Ctrl),
                            alt: binding.modifiers.contains(&Modifier::Alt),
                            meta: false,
                            repeat: false,
                            composing: false,
                        };
                        assert_eq!(
                            table
                                .keyboard(InputContext::DefaultMode, &key)
                                .expect("key"),
                            Some(expected.clone()),
                            "{identifier}: {binding:?}"
                        );
                    }
                }
            }
        }
    }
    #[test]
    fn ime_commit_keeps_the_full_unicode_username_segment() {
        assert_eq!(
            committed_text(InputContext::CharacterName, "猫のAlice{%s}"),
            Some(Command::UserText("猫のAlice{%s}".into()))
        );
        assert_eq!(committed_text(InputContext::DefaultMode, "猫"), None);
        assert_eq!(committed_text(InputContext::CharacterName, "\n"), None);
    }
}

fn single_or_sequence<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum KeyField {
        Scalar(String),
        Sequence(Vec<String>),
    }
    match KeyField::deserialize(deserializer)? {
        KeyField::Scalar(key) => Ok(key),
        KeyField::Sequence(mut keys) if keys.len() == 1 => Ok(keys.remove(0)),
        KeyField::Sequence(_) => Err(serde::de::Error::custom(
            "multi-key sequence needs an upstream input bridge",
        )),
    }
}

#[cfg(test)]
mod sequence_tests {
    use super::*;
    #[test]
    fn singleton_sequence_is_preserved_and_multi_key_input_is_not_partially_dispatched() {
        let json = r#"[{"id":"inventory","category":"DEFAULTMODE","bindings":[{"input_method":"keyboard_any","key":["i"]}]}]"#;
        let table = Bindings::from_json(json).expect("singleton supported");
        let key = BrowserKey {
            key: "i".into(),
            code: "KeyI".into(),
            shift: false,
            ctrl: false,
            alt: false,
            meta: false,
            repeat: false,
            composing: false,
        };
        assert_eq!(
            table
                .keyboard(InputContext::DefaultMode, &key)
                .expect("input"),
            Some(Command::Game(GameAction::Inventory))
        );
        let sequence = r#"[{"id":"inventory","category":"DEFAULTMODE","bindings":[{"input_method":"keyboard_any","key":["i","g"]}]}]"#;
        assert!(Bindings::from_json(sequence).is_err());
    }
}
