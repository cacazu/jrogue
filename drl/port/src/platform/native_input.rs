//! Pure browser input conversion for the pinned original DRL/Valkyrie core.
//!
//! This produces the explicit 128-byte `vbrowserio` wire, never gameplay actions.
//! Key codes, SDL pad ordinals and trigger hysteresis come from Valkyrie commit
//! f89735a741a968997656c2d48a003ec569db7f22. Custom bindings remain in Pascal.

use serde::{Deserialize, Serialize};
use unicode_segmentation::UnicodeSegmentation;

pub const PACKET_BYTES: usize = 128;
pub const TEXT_PACKET_BYTES: usize = 63;
pub const MAX_TEXT_BYTES: usize = 4096;
pub const CONSOLE_WIDTH: i32 = 80;
pub const CONSOLE_HEIGHT: i32 = 25;
pub const SHIFT_MASK: u32 = 256;
pub const ALT_MASK: u32 = 512;
pub const CONTROL_MASK: u32 = 1024;
pub const TRIGGER_PRESS_THRESHOLD: i16 = 10_000;
pub const TRIGGER_RELEASE_THRESHOLD: i16 = 8_000;

// Exact Keys32_126 in vioevent.pas. This also normalizes capitals with CapsLock.
const UNSHIFT: &[u8; 95] = b" 1'3457'908=,-./0123456789;;,=./2abcdefghijklmnopqrstuvwxyz[\\]6-`abcdefghijklmnopqrstuvwxyz[\\]`";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Modifiers {
    pub shift: bool,
    pub control: bool,
    pub alt: bool,
}

impl Modifiers {
    fn mask(self) -> u32 {
        (u32::from(self.shift) * SHIFT_MASK)
            | (u32::from(self.control) * CONTROL_MASK)
            | (u32::from(self.alt) * ALT_MASK)
    }
}

/// Copy only these DOM fields; editable targets and IME keys are ignored.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct KeyboardEvent {
    pub key: String,
    pub code: String,
    pub location: u8,
    pub shift_key: bool,
    pub ctrl_key: bool,
    pub alt_key: bool,
    pub meta_key: bool,
    pub is_composing: bool,
    pub repeat: bool,
    pub editable_target: bool,
    pub key_code: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KeyPhase {
    Down,
    Up,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PadDevice {
    Added,
    Removed,
    Remapped,
}

/// Browser DTOs, independent of the original compiler's record layout.
///
/// Mouse coordinates are zero-based console cells, not pixels or map cells.
/// Pad indices/buttons are standard browser Gamepad indices. Triggers use the
/// separate variant so the original analog hysteresis is preserved.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Keyboard {
        phase: KeyPhase,
        event: KeyboardEvent,
    },
    /// Committed text only, after composition has ended and text input is active.
    Text {
        text: String,
    },
    MouseMove {
        x: i32,
        y: i32,
        relative_x: i32,
        relative_y: i32,
        buttons: u16,
        #[serde(default)]
        modifiers: Modifiers,
    },
    MouseButton {
        x: i32,
        y: i32,
        button: u8,
        pressed: bool,
        #[serde(default)]
        modifiers: Modifiers,
    },
    Wheel {
        x: i32,
        y: i32,
        delta_y: f64,
        #[serde(default)]
        modifiers: Modifiers,
    },
    PadAxis {
        which: i32,
        axis: u8,
        value: f64,
    },
    PadButton {
        which: i32,
        button: u8,
        pressed: bool,
    },
    PadTrigger {
        which: i32,
        button: u8,
        value: f64,
        was_down: bool,
    },
    PadDevice {
        which: i32,
        event: PadDevice,
    },
}

/// `captured` controls DOM preventDefault; unrecognized/ignored keys yield none.
/// Trigger state is returned explicitly instead of hidden in a global adapter.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Normalized {
    pub packets: Vec<Vec<u8>>,
    pub captured: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trigger_down: Option<bool>,
}

impl Normalized {
    fn one(packet: Vec<u8>) -> Self {
        Self {
            packets: vec![packet],
            captured: true,
            trigger_down: None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InputError {
    InvalidKeyboard,
    InvalidPointer,
    InvalidGamepad,
    InvalidAxis,
    UnsupportedPadButton,
    InvalidText,
    TextTooLarge,
    GraphemeTooLarge,
}

impl std::fmt::Display for InputError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::InvalidKeyboard => "invalid keyboard fields",
            Self::InvalidPointer => "invalid pointer fields",
            Self::InvalidGamepad => "invalid gamepad index",
            Self::InvalidAxis => "invalid gamepad axis or value",
            Self::UnsupportedPadButton => "unsupported standard gamepad button",
            Self::InvalidText => "text contains a forbidden control character",
            Self::TextTooLarge => "committed text exceeds the request bound",
            Self::GraphemeTooLarge => "one grapheme exceeds the native text packet",
        })
    }
}

impl std::error::Error for InputError {}

/// Normalize without reading or changing gameplay, platform state, or RNG.
///
/// # Errors
/// Rejects malformed/beyond-bound DTOs and text that cannot fit losslessly into
/// whole-grapheme native packets. Out-of-console pointers and unsupported DOM
/// keys are ignored, with `captured=false`.
pub fn normalize(request: &Request) -> Result<Normalized, InputError> {
    match request {
        Request::Keyboard { phase, event } => keyboard(*phase, event),
        Request::Text { text: value } => text(value),
        Request::MouseMove {
            x,
            y,
            relative_x,
            relative_y,
            buttons,
            modifiers,
        } => {
            if *buttons > 31
                || !(-CONSOLE_WIDTH..=CONSOLE_WIDTH).contains(relative_x)
                || !(-CONSOLE_HEIGHT..=CONSOLE_HEIGHT).contains(relative_y)
            {
                return Err(InputError::InvalidPointer);
            }
            let Some(mut header) = pointer_header(3, *x, *y, *modifiers) else {
                return Ok(Normalized::default());
            };
            header[8] = signed(*relative_x);
            header[9] = signed(*relative_y);
            // DOM left/right/middle = bits0/1/2; native unknown/left/middle/right
            // = bits0/1/2/3. Extra browser buttons retain native UNKNOWN.
            header[11] = (((*buttons & 1) << 1)
                | ((*buttons & 2) << 2)
                | (*buttons & 4)
                | u16::from(*buttons & 24 != 0))
            .into();
            Ok(Normalized::one(packet(header, &[])))
        }
        Request::MouseButton {
            x,
            y,
            button,
            pressed,
            modifiers,
        } => {
            let native_button = match button {
                0 => 1,
                1 => 2,
                2 => 3,
                3 | 4 => 0,
                _ => return Err(InputError::InvalidPointer),
            };
            let kind = if *pressed { 4 } else { 5 };
            let Some(mut header) = pointer_header(kind, *x, *y, *modifiers) else {
                return Ok(Normalized::default());
            };
            header[5] = u32::from(*pressed);
            header[10] = native_button;
            Ok(Normalized::one(packet(header, &[])))
        }
        Request::Wheel {
            x,
            y,
            delta_y,
            modifiers,
        } => {
            if !delta_y.is_finite() {
                return Err(InputError::InvalidPointer);
            }
            let Some(mut header) = pointer_header(4, *x, *y, *modifiers) else {
                return Ok(Normalized::default());
            };
            if *delta_y == 0.0 {
                return Ok(Normalized::default());
            }
            header[5] = 1;
            header[10] = if *delta_y < 0.0 { 4 } else { 5 };
            Ok(Normalized::one(packet(header, &[])))
        }
        Request::PadAxis { which, axis, value } => {
            validate_pad(*which)?;
            if *axis > 3 {
                return Err(InputError::InvalidAxis);
            }
            let value = axis_value(*value, false)?;
            Ok(Normalized::one(pad_axis(*which, *axis, value)))
        }
        Request::PadButton {
            which,
            button,
            pressed,
        } => {
            validate_pad(*which)?;
            let native_button = standard_pad_button(*button)?;
            Ok(Normalized::one(pad_button(*which, native_button, *pressed)))
        }
        Request::PadTrigger {
            which,
            button,
            value,
            was_down,
        } => {
            validate_pad(*which)?;
            let (axis, native_button) = match button {
                6 => (4, 26),
                7 => (5, 27),
                _ => return Err(InputError::UnsupportedPadButton),
            };
            let value = axis_value(*value, true)?;
            let down = if *was_down {
                value >= TRIGGER_RELEASE_THRESHOLD
            } else {
                value > TRIGGER_PRESS_THRESHOLD
            };
            let mut result = Normalized::one(pad_axis(*which, axis, value));
            if down != *was_down {
                result.packets.push(pad_button(*which, native_button, down));
            }
            result.trigger_down = Some(down);
            Ok(result)
        }
        Request::PadDevice { which, event } => {
            validate_pad(*which)?;
            let mut header = event_header(9);
            header[2] = match event {
                PadDevice::Added => 0,
                PadDevice::Removed => 1,
                PadDevice::Remapped => 2,
            };
            header[13] = signed(*which);
            Ok(Normalized::one(packet(header, &[])))
        }
    }
}

fn keyboard(phase: KeyPhase, event: &KeyboardEvent) -> Result<Normalized, InputError> {
    if event.key.len() > 64
        || event.code.len() > 32
        || event.location > 3
        || event.key_code > 65_535
    {
        return Err(InputError::InvalidKeyboard);
    }
    if event.editable_target
        || event.is_composing
        || event.key_code == 229
        || browser_reserved(event)
    {
        return Ok(Normalized::default());
    }
    let Some((code, ascii, inferred_shift)) = key_fields(event) else {
        return Ok(Normalized::default());
    };
    let down = phase == KeyPhase::Down;
    let mut header = event_header(if down { 1 } else { 2 });
    header[2] = u32::from(code);
    header[3] = u32::from(ascii);
    header[4] = Modifiers {
        shift: event.shift_key || inferred_shift,
        control: event.ctrl_key,
        alt: event.alt_key,
    }
    .mask();
    header[5] = u32::from(down) | (u32::from(down && event.repeat) * 2);
    Ok(Normalized::one(packet(header, &[])))
}

fn browser_reserved(event: &KeyboardEvent) -> bool {
    if event.meta_key
        || (event.alt_key
            && matches!(
                event.key.as_str(),
                "Tab" | "Escape" | "F4" | " " | "ArrowLeft" | "ArrowRight"
            ))
    {
        return true;
    }
    if !event.ctrl_key || event.alt_key {
        return false;
    }
    if matches!(
        event.key.as_str(),
        "Tab" | "F4" | "+" | "=" | "-" | "_" | "0"
    ) {
        return true;
    }
    event.key.len() == 1
        && matches!(
            event.key.as_bytes()[0].to_ascii_lowercase(),
            b'r' | b'l'
                | b't'
                | b'w'
                | b'n'
                | b'p'
                | b's'
                | b'f'
                | b'd'
                | b'o'
                | b'h'
                | b'j'
                | b'k'
        )
}

fn key_fields(event: &KeyboardEvent) -> Option<(u8, u8, bool)> {
    let keypad = match event.code.as_str() {
        "Numpad1" => Some(16),
        "Numpad2" => Some(21),
        "Numpad3" => Some(15),
        "Numpad4" => Some(18),
        "Numpad5" => Some(24),
        "Numpad6" => Some(20),
        "Numpad7" => Some(17),
        "Numpad8" => Some(19),
        "Numpad9" => Some(14),
        "NumpadEnter" => Some(13),
        _ => None,
    };
    if let Some(code) = keypad {
        return Some((code, 0, false));
    }
    // Other keypad keys are not aliases in the pinned original SDL driver.
    if event.code.starts_with("Numpad") || event.location == 3 {
        return None;
    }
    let named = match event.key.as_str() {
        "Backspace" => Some(8),
        "Tab" => Some(9),
        "Enter" => Some(13),
        "PageUp" => Some(14),
        "PageDown" => Some(15),
        "End" => Some(16),
        "Home" => Some(17),
        "ArrowLeft" => Some(18),
        "ArrowUp" => Some(19),
        "ArrowRight" => Some(20),
        "ArrowDown" => Some(21),
        "Delete" => Some(22),
        "Insert" => Some(23),
        "Escape" => Some(27),
        "F1" => Some(131),
        "F2" => Some(132),
        "F3" => Some(133),
        "F4" => Some(134),
        "F5" => Some(135),
        "F6" => Some(136),
        "F7" => Some(137),
        "F8" => Some(138),
        "F9" => Some(139),
        "F10" => Some(140),
        "F11" => Some(141),
        "F12" => Some(142),
        _ => None,
    };
    if let Some(code) = named {
        return Some((code, 0, false));
    }
    if event.key.len() == 1 {
        let ascii = event.key.as_bytes()[0];
        if (32..=126).contains(&ascii) {
            let code = UNSHIFT[usize::from(ascii - 32)];
            return Some((code, ascii, code != ascii));
        }
    }
    None
}

fn text(value: &str) -> Result<Normalized, InputError> {
    if value.len() > MAX_TEXT_BYTES {
        return Err(InputError::TextTooLarge);
    }
    // Original single-line text editors receive printable committed text only.
    if value.chars().any(char::is_control) {
        return Err(InputError::InvalidText);
    }
    if value.is_empty() {
        return Ok(Normalized::default());
    }
    let mut packets = Vec::new();
    let mut start = 0;
    let mut end = 0;
    for (offset, grapheme) in value.grapheme_indices(true) {
        if grapheme.len() > TEXT_PACKET_BYTES {
            return Err(InputError::GraphemeTooLarge);
        }
        if offset + grapheme.len() - start > TEXT_PACKET_BYTES {
            packets.push(text_packet(&value.as_bytes()[start..end]));
            start = offset;
        }
        end = offset + grapheme.len();
    }
    packets.push(text_packet(&value.as_bytes()[start..end]));
    Ok(Normalized {
        packets,
        captured: true,
        trigger_down: None,
    })
}

fn text_packet(value: &[u8]) -> Vec<u8> {
    let mut header = event_header(10);
    // The caller proved <=63 bytes, hence a lossless widening through u8.
    header[15] = u32::from(u8::try_from(value.len()).expect("bounded native text packet"));
    packet(header, value)
}

fn pointer_header(kind: u32, x: i32, y: i32, modifiers: Modifiers) -> Option<[u32; 16]> {
    if !(0..CONSOLE_WIDTH).contains(&x) || !(0..CONSOLE_HEIGHT).contains(&y) {
        return None;
    }
    let mut header = event_header(kind);
    header[4] = modifiers.mask();
    header[6] = signed(x + 1);
    header[7] = signed(y + 1);
    Some(header)
}

fn validate_pad(which: i32) -> Result<(), InputError> {
    if (0..32).contains(&which) {
        Ok(())
    } else {
        Err(InputError::InvalidGamepad)
    }
}

fn standard_pad_button(button: u8) -> Result<u8, InputError> {
    match button {
        0..=3 => Ok(button),
        4 => Ok(9),
        5 => Ok(10),
        8 => Ok(4),
        9 => Ok(6),
        10 => Ok(7),
        11 => Ok(8),
        12 => Ok(11),
        13 => Ok(12),
        14 => Ok(13),
        15 => Ok(14),
        16 => Ok(5),
        _ => Err(InputError::UnsupportedPadButton),
    }
}

fn axis_value(value: f64, trigger: bool) -> Result<i16, InputError> {
    let minimum = if trigger { 0.0 } else { -1.0 };
    if !value.is_finite() || !(minimum..=1.0).contains(&value) {
        return Err(InputError::InvalidAxis);
    }
    let scale = if value < 0.0 { 32_768.0 } else { 32_767.0 };
    // Finite closed-range validation proves the rounded value fits i16.
    Ok((value * scale).round() as i16)
}

fn pad_axis(which: i32, axis: u8, value: i16) -> Vec<u8> {
    let mut header = event_header(6);
    header[2] = u32::from(axis);
    header[12] = signed(i32::from(value));
    header[13] = signed(which);
    packet(header, &[])
}

fn pad_button(which: i32, button: u8, pressed: bool) -> Vec<u8> {
    let mut header = event_header(if pressed { 7 } else { 8 });
    header[5] = u32::from(pressed);
    header[10] = u32::from(button);
    header[13] = signed(which);
    packet(header, &[])
}

fn event_header(kind: u32) -> [u32; 16] {
    let mut header = [0; 16];
    header[0] = 1;
    header[1] = kind;
    header
}

fn signed(value: i32) -> u32 {
    u32::from_le_bytes(value.to_le_bytes())
}

fn packet(header: [u32; 16], text: &[u8]) -> Vec<u8> {
    let mut bytes = vec![0; PACKET_BYTES];
    for (index, value) in header.into_iter().enumerate() {
        bytes[index * 4..index * 4 + 4].copy_from_slice(&value.to_le_bytes());
    }
    bytes[64..64 + text.len()].copy_from_slice(text);
    bytes
}
