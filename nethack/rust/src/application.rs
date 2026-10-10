//! Pure input translation for browser, touch, and gamepad adapters.
//!
//! These functions produce intents without reading or changing game state.

/// The active input contract reported by the game window port.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum InputContext {
    Command = 0,
    Direction = 1,
    Menu = 2,
    More = 3,
    Text = 4,
    YesNo = 5,
}

/// An unrecognized input-context discriminant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InvalidInputContext(pub u32);

impl std::fmt::Display for InvalidInputContext {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "invalid input context: {}", self.0)
    }
}

impl std::error::Error for InvalidInputContext {}

impl TryFrom<u32> for InputContext {
    type Error = InvalidInputContext;

    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::Command),
            1 => Ok(Self::Direction),
            2 => Ok(Self::Menu),
            3 => Ok(Self::More),
            4 => Ok(Self::Text),
            5 => Ok(Self::YesNo),
            _ => Err(InvalidInputContext(value)),
        }
    }
}

impl InputContext {
    const fn accepts_direction(self) -> bool {
        matches!(self, Self::Command | Self::Direction)
    }
}

/// Modifier flags from a browser keyboard event.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Modifiers {
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub meta: bool,
}

/// A byte command or complete Unicode text insertion, ready for the adapter.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandIntent {
    Key(u8),
    TextInsert(String),
}

/// Translate `KeyboardEvent.key` without truncating Unicode or named keys.
///
/// ASCII characters retain the case supplied by the browser. Shift only changes
/// synthetic direction keys; Control applies the ASCII control encoding, and
/// Alt applies NetHack's `M()` high bit after Control. OS Meta shortcuts are
/// ignored. Navigation keys become movement only in command/direction contexts.
#[must_use]
pub fn keycode(key: &str, modifiers: Modifiers, context: InputContext) -> Option<u8> {
    if modifiers.meta {
        return None;
    }

    let code = match key {
        "Escape" => 27,
        "Enter" => 13,
        "Backspace" => 8,
        "Tab" => 9,
        "Delete" => 127,
        "PageUp" if context == InputContext::Menu => b'<',
        "PageDown" if context == InputContext::Menu => b'>',
        "ArrowUp" | "ArrowRight" | "ArrowDown" | "ArrowLeft" | "Home" | "PageUp" | "End"
        | "PageDown"
            if context.accepts_direction() =>
        {
            let direction = match key {
                "ArrowUp" => Direction::North,
                "ArrowRight" => Direction::East,
                "ArrowDown" => Direction::South,
                "ArrowLeft" => Direction::West,
                "Home" => Direction::Northwest,
                "PageUp" => Direction::Northeast,
                "End" => Direction::Southwest,
                "PageDown" => Direction::Southeast,
                _ => return None,
            };
            direction.keycode(modifiers.shift)
        }
        _ if key.len() == 1 && key.is_ascii() => *key.as_bytes().first()?,
        _ => return None,
    };

    let code = if modifiers.ctrl {
        match code {
            b'a'..=b'z' => code - b'a' + 1,
            b'A'..=b'Z' => code - b'A' + 1,
            b'@' | b' ' | b'2' => 0,
            b'3' => 27,
            b'4' => 28,
            b'5' => 29,
            b'6' => 30,
            b'/' | b'-' | b'7' => 31,
            b'8' => 127,
            b'['..=b'_' => code & 0x1f,
            b'?' => 127,
            _ => code,
        }
    } else {
        code
    };

    Some(if modifiers.alt { code | 0x80 } else { code })
}

/// Preserve a browser `beforeinput`/composition payload in a text prompt.
///
/// Keyboard adapters should use this path for committed text, including ASCII,
/// instead of forwarding the same insertion twice through `keycode`.
#[must_use]
pub fn text_insert_intent(text: &str, context: InputContext) -> Option<CommandIntent> {
    (context == InputContext::Text && !text.is_empty())
        .then(|| CommandIntent::TextInsert(text.to_owned()))
}

/// Eight directions in screen coordinates: positive x is east, positive y south.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    North,
    Northeast,
    East,
    Southeast,
    South,
    Southwest,
    West,
    Northwest,
}

/// The current public movement option, reported by the official engine.
/// Phone-pad and QWERTZ variants preserve `number_pad` option modes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum DirectionLayout {
    Vi = 0,
    NumberPad = 1,
    PhonePad = 2,
    Qwertz = 3,
}

impl DirectionLayout {
    /// Validate a layout code received from the platform adapter.
    #[must_use]
    pub const fn from_code(value: u32) -> Option<Self> {
        match value {
            0 => Some(Self::Vi),
            1 => Some(Self::NumberPad),
            2 => Some(Self::PhonePad),
            3 => Some(Self::Qwertz),
            _ => None,
        }
    }
}

impl Direction {
    /// Translate an adjacent-cell delta; neutral/out-of-range deltas are ignored.
    #[must_use]
    pub const fn from_delta(dx: i32, dy: i32) -> Option<Self> {
        match (dx, dy) {
            (0, -1) => Some(Self::North),
            (1, -1) => Some(Self::Northeast),
            (1, 0) => Some(Self::East),
            (1, 1) => Some(Self::Southeast),
            (0, 1) => Some(Self::South),
            (-1, 1) => Some(Self::Southwest),
            (-1, 0) => Some(Self::West),
            (-1, -1) => Some(Self::Northwest),
            _ => None,
        }
    }

    /// NetHack's vi movement key, uppercased when running is requested.
    #[must_use]
    pub const fn keycode(self, run: bool) -> u8 {
        let code = match self {
            Self::North => b'k',
            Self::Northeast => b'u',
            Self::East => b'l',
            Self::Southeast => b'n',
            Self::South => b'j',
            Self::Southwest => b'b',
            Self::West => b'h',
            Self::Northwest => b'y',
        };
        if run { code.to_ascii_uppercase() } else { code }
    }

    /// Preserve official `cmd.c` movement option mappings. Number-pad running
    /// uses NetHack's Meta high bit; alphabetic running uses uppercase letters.
    #[must_use]
    pub const fn keycode_for_layout(self, run: bool, layout: DirectionLayout) -> u8 {
        let code = match layout {
            DirectionLayout::Vi => self.keycode(false),
            DirectionLayout::Qwertz => match self {
                Self::Northwest => b'z',
                _ => self.keycode(false),
            },
            DirectionLayout::NumberPad => match self {
                Self::North => b'8',
                Self::Northeast => b'9',
                Self::East => b'6',
                Self::Southeast => b'3',
                Self::South => b'2',
                Self::Southwest => b'1',
                Self::West => b'4',
                Self::Northwest => b'7',
            },
            DirectionLayout::PhonePad => match self {
                Self::North => b'2',
                Self::Northeast => b'3',
                Self::East => b'6',
                Self::Southeast => b'9',
                Self::South => b'8',
                Self::Southwest => b'7',
                Self::West => b'4',
                Self::Northwest => b'1',
            },
        };
        if !run {
            return code;
        }
        match layout {
            DirectionLayout::NumberPad | DirectionLayout::PhonePad => code | 0x80,
            DirectionLayout::Vi | DirectionLayout::Qwertz => code.to_ascii_uppercase(),
        }
    }
}

/// Translate touch/gamepad deltas only when the game requests movement.
#[must_use]
pub fn direction_keycode(dx: i32, dy: i32, run: bool, context: InputContext) -> Option<u8> {
    if !context.accepts_direction() {
        return None;
    }
    Direction::from_delta(dx, dy).map(|direction| direction.keycode(run))
}

/// Translate a device direction using the engine's current public option mode.
#[must_use]
pub fn direction_keycode_for_layout(
    dx: i32,
    dy: i32,
    run: bool,
    context: InputContext,
    layout: DirectionLayout,
) -> Option<u8> {
    if !context.accepts_direction() {
        return None;
    }
    Direction::from_delta(dx, dy).map(|direction| direction.keycode_for_layout(run, layout))
}

/// Produce the same movement intent for a touch control as for a keyboard.
#[must_use]
pub fn touch_direction_intent(
    dx: i32,
    dy: i32,
    run: bool,
    context: InputContext,
) -> Option<CommandIntent> {
    direction_keycode(dx, dy, run, context).map(CommandIntent::Key)
}

/// Semantic gamepad buttons, independent of device-specific button numbers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GamepadButton {
    Confirm,
    Cancel,
    Wait,
    Inventory,
    Pickup,
    Search,
    StairsDown,
    StairsUp,
}

/// A gamepad adapter's discrete button or already-quantized directional event.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GamepadInput {
    Button(GamepadButton),
    Direction { direction: Direction, run: bool },
}

/// Translate a gamepad event without treating menu directions as selections.
///
/// Confirm/cancel are accepted in every prompt; action buttons require command
/// context. The adapter is responsible for edge/repeat timing and stick deadzones.
#[must_use]
pub fn gamepad_intent(input: GamepadInput, context: InputContext) -> Option<CommandIntent> {
    let code = match input {
        GamepadInput::Direction { direction, run } => {
            if !context.accepts_direction() {
                return None;
            }
            direction.keycode(run)
        }
        GamepadInput::Button(GamepadButton::Confirm) => 13,
        GamepadInput::Button(GamepadButton::Cancel) => 27,
        GamepadInput::Button(button) => {
            if context != InputContext::Command {
                return None;
            }
            match button {
                GamepadButton::Wait => b'.',
                GamepadButton::Inventory => b'i',
                GamepadButton::Pickup => b',',
                GamepadButton::Search => b's',
                GamepadButton::StairsDown => b'>',
                GamepadButton::StairsUp => b'<',
                GamepadButton::Confirm | GamepadButton::Cancel => return None,
            }
        }
    };
    Some(CommandIntent::Key(code))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_ascii_byte_and_control_encoding_is_preserved() {
        let plain = Modifiers::default();
        let ctrl = Modifiers {
            ctrl: true,
            ..plain
        };
        for byte in 0u8..=127 {
            let key = char::from(byte).to_string();
            assert_eq!(keycode(&key, plain, InputContext::Command), Some(byte));
        }
        for index in 0u8..26 {
            for byte in [b'a' + index, b'A' + index] {
                let key = char::from(byte).to_string();
                assert_eq!(keycode(&key, ctrl, InputContext::Command), Some(index + 1));
            }
        }
        for (key, expected) in [
            ("@", 0),
            (" ", 0),
            ("2", 0),
            ("[", 27),
            ("\\", 28),
            ("]", 29),
            ("^", 30),
            ("_", 31),
            ("/", 31),
            ("?", 127),
        ] {
            assert_eq!(keycode(key, ctrl, InputContext::Command), Some(expected));
        }
    }

    #[test]
    fn official_numberpad_phonepad_and_qwertz_options_keep_direction_and_run() {
        for (dx, dy, normal, phone) in [
            (-1, 0, b'4', b'4'),
            (-1, -1, b'7', b'1'),
            (0, -1, b'8', b'2'),
            (1, -1, b'9', b'3'),
            (1, 0, b'6', b'6'),
            (1, 1, b'3', b'9'),
            (0, 1, b'2', b'8'),
            (-1, 1, b'1', b'7'),
        ] {
            for (layout, expected) in [
                (DirectionLayout::NumberPad, normal),
                (DirectionLayout::PhonePad, phone),
            ] {
                assert_eq!(
                    direction_keycode_for_layout(dx, dy, false, InputContext::Command, layout),
                    Some(expected)
                );
                assert_eq!(
                    direction_keycode_for_layout(dx, dy, true, InputContext::Command, layout),
                    Some(expected | 0x80)
                );
                assert_eq!(
                    direction_keycode_for_layout(dx, dy, false, InputContext::Menu, layout),
                    None
                );
            }
        }
        assert_eq!(
            direction_keycode_for_layout(
                -1,
                -1,
                false,
                InputContext::Command,
                DirectionLayout::Qwertz
            ),
            Some(b'z')
        );
        assert_eq!(
            direction_keycode_for_layout(
                -1,
                -1,
                true,
                InputContext::Command,
                DirectionLayout::Qwertz
            ),
            Some(b'Z')
        );
        assert_eq!(DirectionLayout::from_code(99), None);
    }

    const NONE: Modifiers = Modifiers {
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
    };

    #[test]
    fn contexts_reject_unknown_ffi_discriminants() {
        let contexts = [
            InputContext::Command,
            InputContext::Direction,
            InputContext::Menu,
            InputContext::More,
            InputContext::Text,
            InputContext::YesNo,
        ];
        for (value, expected) in (0_u32..).zip(contexts) {
            assert_eq!(InputContext::try_from(value), Ok(expected));
        }
        for invalid in [6, 255, u32::MAX] {
            assert_eq!(
                InputContext::try_from(invalid),
                Err(InvalidInputContext(invalid))
            );
        }
    }

    #[test]
    fn browser_ascii_preserves_case_punctuation_and_special_keys() {
        for (key, expected) in [
            ("a", b'a'),
            ("A", b'A'),
            (">", b'>'),
            ("?", b'?'),
            (" ", b' '),
            ("Escape", 27),
            ("Enter", 13),
            ("Backspace", 8),
            ("Tab", 9),
            ("Delete", 127),
        ] {
            assert_eq!(keycode(key, NONE, InputContext::Command), Some(expected));
        }
        assert_eq!(
            keycode(
                "a",
                Modifiers {
                    shift: true,
                    ..NONE
                },
                InputContext::Command
            ),
            Some(b'a')
        );
        for ignored in [
            "",
            "Shift",
            "Control",
            "Alt",
            "Meta",
            "Dead",
            "Unidentified",
            "F1",
            "é",
            "🦉",
            "ab",
        ] {
            assert_eq!(
                keycode(ignored, NONE, InputContext::Command),
                None,
                "{ignored}"
            );
        }
    }

    #[test]
    fn control_meta_and_alt_follow_terminal_encoding() {
        let ctrl = Modifiers { ctrl: true, ..NONE };
        for (key, expected) in [
            ("a", 1),
            ("A", 1),
            ("z", 26),
            ("Z", 26),
            ("@", 0),
            ("/", 31),
            ("[", 27),
            ("\\", 28),
            ("]", 29),
            ("^", 30),
            ("_", 31),
            ("?", 127),
        ] {
            assert_eq!(keycode(key, ctrl, InputContext::Command), Some(expected));
        }
        assert_eq!(
            keycode("x", Modifiers { alt: true, ..NONE }, InputContext::Command),
            Some(b'x' | 0x80)
        );
        assert_eq!(
            keycode(
                "x",
                Modifiers {
                    ctrl: true,
                    alt: true,
                    ..NONE
                },
                InputContext::Command
            ),
            Some(24 | 0x80)
        );
        assert_eq!(
            keycode(
                "x",
                Modifiers {
                    meta: true,
                    ctrl: true,
                    alt: true,
                    ..NONE
                },
                InputContext::Command
            ),
            None
        );
    }

    #[test]
    fn movement_keys_respect_each_prompt_context() {
        let navigation = [
            ("ArrowLeft", b'h'),
            ("ArrowDown", b'j'),
            ("ArrowUp", b'k'),
            ("ArrowRight", b'l'),
            ("Home", b'y'),
            ("PageUp", b'u'),
            ("End", b'b'),
            ("PageDown", b'n'),
        ];
        for context in [InputContext::Command, InputContext::Direction] {
            for (key, expected) in navigation {
                assert_eq!(keycode(key, NONE, context), Some(expected));
                assert_eq!(
                    keycode(
                        key,
                        Modifiers {
                            shift: true,
                            ..NONE
                        },
                        context
                    ),
                    Some(expected.to_ascii_uppercase())
                );
            }
        }
        for context in [
            InputContext::Menu,
            InputContext::More,
            InputContext::Text,
            InputContext::YesNo,
        ] {
            for (key, _) in navigation {
                let expected = match (context, key) {
                    (InputContext::Menu, "PageUp") => Some(b'<'),
                    (InputContext::Menu, "PageDown") => Some(b'>'),
                    _ => None,
                };
                assert_eq!(keycode(key, NONE, context), expected);
            }
            assert_eq!(keycode("y", NONE, context), Some(b'y'));
        }
    }

    #[test]
    fn text_insertion_preserves_utf8_and_composition_payloads() {
        let text = "Zoë 東京 🦉 e\u{301}";
        assert_eq!(
            text_insert_intent(text, InputContext::Text),
            Some(CommandIntent::TextInsert(text.to_owned()))
        );
        assert_eq!(text_insert_intent("", InputContext::Text), None);
        for context in [
            InputContext::Command,
            InputContext::Direction,
            InputContext::Menu,
            InputContext::More,
            InputContext::YesNo,
        ] {
            assert_eq!(text_insert_intent(text, context), None);
        }
    }

    #[test]
    fn touch_and_gamepad_cover_all_directions_and_reject_neutral() {
        for (dx, dy, expected) in [
            (0, -1, b'k'),
            (1, -1, b'u'),
            (1, 0, b'l'),
            (1, 1, b'n'),
            (0, 1, b'j'),
            (-1, 1, b'b'),
            (-1, 0, b'h'),
            (-1, -1, b'y'),
        ] {
            let direction = Direction::from_delta(dx, dy).expect("valid adjacent direction");
            for context in [InputContext::Command, InputContext::Direction] {
                assert_eq!(
                    touch_direction_intent(dx, dy, false, context),
                    Some(CommandIntent::Key(expected))
                );
                assert_eq!(
                    gamepad_intent(
                        GamepadInput::Direction {
                            direction,
                            run: true
                        },
                        context
                    ),
                    Some(CommandIntent::Key(expected.to_ascii_uppercase()))
                );
            }
            for context in [
                InputContext::Menu,
                InputContext::More,
                InputContext::Text,
                InputContext::YesNo,
            ] {
                assert_eq!(direction_keycode(dx, dy, false, context), None);
                assert_eq!(
                    gamepad_intent(
                        GamepadInput::Direction {
                            direction,
                            run: false
                        },
                        context
                    ),
                    None
                );
            }
        }
        for (dx, dy) in [(0, 0), (2, 0), (0, -2), (i32::MIN, i32::MAX)] {
            assert_eq!(
                direction_keycode(dx, dy, false, InputContext::Command),
                None
            );
        }
    }

    #[test]
    fn gamepad_actions_do_not_select_menu_items() {
        for (button, expected) in [
            (GamepadButton::Wait, b'.'),
            (GamepadButton::Inventory, b'i'),
            (GamepadButton::Pickup, b','),
            (GamepadButton::Search, b's'),
            (GamepadButton::StairsDown, b'>'),
            (GamepadButton::StairsUp, b'<'),
        ] {
            assert_eq!(
                gamepad_intent(GamepadInput::Button(button), InputContext::Command),
                Some(CommandIntent::Key(expected))
            );
            for context in [
                InputContext::Direction,
                InputContext::Menu,
                InputContext::More,
                InputContext::Text,
                InputContext::YesNo,
            ] {
                assert_eq!(gamepad_intent(GamepadInput::Button(button), context), None);
            }
        }
        for context in [
            InputContext::Command,
            InputContext::Direction,
            InputContext::Menu,
            InputContext::More,
            InputContext::Text,
            InputContext::YesNo,
        ] {
            assert_eq!(
                gamepad_intent(GamepadInput::Button(GamepadButton::Confirm), context),
                Some(CommandIntent::Key(13))
            );
            assert_eq!(
                gamepad_intent(GamepadInput::Button(GamepadButton::Cancel), context),
                Some(CommandIntent::Key(27))
            );
        }
    }
}
