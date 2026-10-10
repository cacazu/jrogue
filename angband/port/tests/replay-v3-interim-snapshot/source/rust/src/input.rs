//! Input/application boundary. Constants and modifier normalization follow
//! Angband 4.2.6 `src/ui-event.h`; no game command semantics are reimplemented.

/// Bit mask containing a complete Unicode scalar value.
pub const CODE_MASK: u32 = 0x001f_ffff;
/// Modifier field position in the packed FFI value.
pub const MOD_SHIFT_BITS: u32 = 21;
pub const CONTROL: u32 = 1;
pub const SHIFT: u32 = 2;
pub const ALT: u32 = 4;
pub const META: u32 = 8;
pub const KEYPAD: u32 = 16;
pub const MOD_MASK: u32 = CONTROL | SHIFT | ALT | META | KEYPAD;

/// Validated input forwarded to the original C command/event pipeline.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Command {
    pub code: u32,
    pub modifiers: u32,
}

impl Command {
    /// Reject invalid scalars and encode control letters as the C UI expects.
    /// Keypad modifiers are kept intact according to upstream's explicit rule.
    #[must_use]
    pub fn sanitize(mut code: u32, mut modifiers: u32) -> Option<Self> {
        if code == 0 || char::from_u32(code).is_none() {
            return None;
        }
        modifiers &= MOD_MASK;
        if modifiers & KEYPAD == 0 {
            if modifiers & CONTROL != 0
                && ((0x40..=0x5f).contains(&code) || (0x61..=0x7a).contains(&code))
            {
                code &= 0x1f;
                modifiers &= !CONTROL;
            }
            if (1..=0x1f).contains(&code) {
                modifiers &= !CONTROL;
            }
            if (0x21..=0x2f).contains(&code)
                || (0x3a..=0x60).contains(&code)
                || (0x7b..=0x7e).contains(&code)
            {
                modifiers &= !SHIFT;
            }
        }
        // Ctrl-@ is NUL and cannot be distinguished from no input by this ABI.
        if code == 0 {
            return None;
        }
        Some(Self { code, modifiers })
    }

    /// Exact packed value for the C terminal adapter.
    #[must_use]
    pub const fn packed(self) -> u32 {
        self.code | (self.modifiers << MOD_SHIFT_BITS)
    }

    /// Decode an already normalized journal entry, rejecting extra bits.
    #[must_use]
    pub fn from_packed(value: u32) -> Option<Self> {
        let normalized = Self::sanitize(value & CODE_MASK, value >> MOD_SHIFT_BITS)?;
        (normalized.packed() == value).then_some(normalized)
    }
}

/// Map `KeyboardEvent.key` names to the exact upstream special key codes.
/// A single Unicode scalar is accepted verbatim, including external names.
#[must_use]
pub fn browser_key(key: &str, modifiers: u32) -> Option<Command> {
    let code = match key {
        "ArrowDown" => 0x80,
        "ArrowLeft" => 0x81,
        "ArrowRight" => 0x82,
        "ArrowUp" => 0x83,
        "F1" => 0x84,
        "F2" => 0x85,
        "F3" => 0x86,
        "F4" => 0x87,
        "F5" => 0x88,
        "F6" => 0x89,
        "F7" => 0x8a,
        "F8" => 0x8b,
        "F9" => 0x8c,
        "F10" => 0x8d,
        "F11" => 0x8e,
        "F12" => 0x8f,
        "F13" => 0x90,
        "F14" => 0x91,
        "F15" => 0x92,
        "Help" => 0x93,
        "Home" => 0x94,
        "PageUp" => 0x95,
        "End" => 0x96,
        "PageDown" => 0x97,
        "Insert" => 0x98,
        "Pause" => 0x99,
        "Cancel" => 0x9a,
        "Clear" => 0x9b,
        "Enter" => 0x9c,
        "Tab" => 0x9d,
        "Delete" => 0x9e,
        "Backspace" => 0x9f,
        "Escape" => 0xe000,
        other => {
            let mut chars = other.chars();
            let first = chars.next()?;
            if chars.next().is_some() {
                return None;
            }
            u32::from(first)
        }
    };
    Command::sanitize(code, modifiers)
}

/// Typed native terminal delivery. These words are an FFI bridge, never a
/// pointer or a completed-English message. CSS scaling is not a resize.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NativeEvent {
    None,
    Keyboard(Command),
    Mouse { x: u8, y: u8, button: u8, modifiers: u8 },
    Resize { width: u8, height: u8 },
    Button(Command),
}

/// Browser origin preserves committed text/IME scalar ordering without
/// inventing a native text event or translating user input.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct InputOrigin {
    /// 0 keyboard, 1 touch keyboard, 2 committed text, 3 committed IME.
    pub kind: u8,
    pub group: u64,
    pub scalar_index: u32,
    pub scalar_count: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct EventPacket {
    pub event: NativeEvent,
    pub origin: InputOrigin,
}

impl EventPacket {
    /// Parse the exact 16-word C bridge. Unknown/reserved fields are rejected.
    #[must_use]
    pub fn from_words(words: &[u32]) -> Option<Self> {
        if words.len() != 16 || words[13..].iter().any(|v| *v != 0) {
            return None;
        }
        let origin = InputOrigin {
            kind: u8::try_from(words[8]).ok()?,
            group: u64::from(words[9]) | (u64::from(words[10]) << 32),
            scalar_index: words[11], scalar_count: words[12],
        };
        if origin.kind > 3 || (origin.kind < 2 &&
            (origin.group != 0 || origin.scalar_index != 0 || origin.scalar_count != 0)) ||
            (origin.kind >= 2 && (origin.group == 0 || origin.scalar_count == 0 ||
                origin.scalar_count > 65_536 || origin.scalar_index >= origin.scalar_count)) {
            return None;
        }
        let key = || {
            if words[1] > CODE_MASK || words[2] > 31 { return None; }
            Command::from_packed(words[1] | (words[2] << MOD_SHIFT_BITS))
        };
        let event = match words[0] {
            0 if words.iter().all(|v| *v == 0) => NativeEvent::None,
            1 | 4 if words[3..8].iter().all(|v| *v == 0) => {
                let command = key()?;
                if words[0] == 1 { NativeEvent::Keyboard(command) }
                else { NativeEvent::Button(command) }
            }
            2 if words[1] == 0 && words[2] <= 15 && words[5] <= 15 &&
                words[6] == 0 && words[7] == 0 && origin.kind < 2 => NativeEvent::Mouse {
                    x: u8::try_from(words[3]).ok()?, y: u8::try_from(words[4]).ok()?,
                    button: u8::try_from(words[5]).ok()?, modifiers: u8::try_from(words[2]).ok()?,
                },
            3 if words[1..6].iter().all(|v| *v == 0) && origin.kind == 0 &&
                words[6] != 0 && words[7] != 0 => NativeEvent::Resize {
                    width: u8::try_from(words[6]).ok()?, height: u8::try_from(words[7]).ok()?,
                },
            _ => return None,
        };
        Some(Self { event, origin })
    }

    #[must_use]
    pub fn words(self) -> [u32; 16] {
        let mut out = [0; 16];
        match self.event {
            NativeEvent::None => {},
            NativeEvent::Keyboard(command) | NativeEvent::Button(command) => {
                out[0] = if matches!(self.event, NativeEvent::Keyboard(_)) { 1 } else { 4 };
                out[1] = command.code; out[2] = command.modifiers;
            },
            NativeEvent::Mouse { x, y, button, modifiers } => {
                out[0] = 2; out[2] = u32::from(modifiers); out[3] = u32::from(x);
                out[4] = u32::from(y); out[5] = u32::from(button);
            },
            NativeEvent::Resize { width, height } => {
                out[0] = 3; out[6] = u32::from(width); out[7] = u32::from(height);
            },
        }
        out[8] = u32::from(self.origin.kind);
        out[9] = self.origin.group as u32; out[10] = (self.origin.group >> 32) as u32;
        out[11] = self.origin.scalar_index; out[12] = self.origin.scalar_count;
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn actual_upstream_special_keys_are_used() {
        assert_eq!(browser_key("ArrowUp", 0).unwrap().code, 0x83);
        assert_eq!(browser_key("Enter", 0).unwrap().code, 0x9c);
        assert_eq!(browser_key("Escape", 0).unwrap().code, 0xe000);
        assert_eq!(browser_key("F15", 0).unwrap().code, 0x92);
        assert_eq!(browser_key("Dead", 0), None);
        assert_eq!(browser_key("Shift", 0), None);
    }
    #[test]
    fn modifier_normalization_matches_ui_event_contract() {
        assert_eq!(
            browser_key("s", CONTROL).unwrap(),
            Command {
                code: 19,
                modifiers: 0
            }
        );
        assert_eq!(
            browser_key("@", SHIFT | ALT).unwrap(),
            Command {
                code: 64,
                modifiers: ALT
            }
        );
        assert_eq!(
            browser_key("1", KEYPAD | CONTROL | SHIFT)
                .unwrap()
                .modifiers,
            19
        );
        assert_eq!(Command::sanitize(0xd800, 0), None);
        assert_eq!(Command::sanitize(0x110000, 0), None);
    }
    #[test]
    fn packing_preserves_supplementary_unicode_and_validates_journals() {
        let command = browser_key("龍", ALT | META).unwrap();
        assert_eq!(Command::from_packed(command.packed()), Some(command));
        let command = browser_key("🐉", 0).unwrap();
        assert_eq!(command.code, 0x1f409);
        assert_eq!(Command::from_packed(command.packed()), Some(command));
        assert_eq!(Command::from_packed(1 << 31), None);
    }
}
