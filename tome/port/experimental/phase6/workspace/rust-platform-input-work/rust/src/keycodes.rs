// SPDX-License-Identifier: GPL-3.0-or-later
// SDL2 2.32.10 SDL_scancode.h / SDL_keycode.h and Emscripten backend.
// Scancode is physical; keycode is the separate unshifted secondary binding.
pub fn scancode(code: &str) -> Option<u32> {
    if let Some(letter) = code.strip_prefix("Key") {
        let bytes = letter.as_bytes();
        if bytes.len() == 1 && bytes[0].is_ascii_uppercase() {
            return Some(u32::from(bytes[0] - b'A') + 4);
        }
    }
    if let Some(digit) = code.strip_prefix("Digit") {
        let bytes = digit.as_bytes();
        if bytes.len() == 1 && bytes[0].is_ascii_digit() {
            return Some(if bytes[0] == b'0' { 39 } else { u32::from(bytes[0] - b'1') + 30 });
        }
    }
    if let Some(number) = code.strip_prefix('F').and_then(|s| s.parse::<u32>().ok())
        && code == format!("F{number}") {
            if (1..=12).contains(&number) { return Some(57 + number); }
            if (13..=24).contains(&number) { return Some(91 + number); }
    }
    Some(match code {
        "Enter" => 40, "Escape" => 41, "Backspace" => 42, "Tab" => 43, "Space" => 44,
        "Minus" => 45, "Equal" => 46, "BracketLeft" => 47, "BracketRight" => 48,
        "Backslash" => 49, "Semicolon" => 51, "Quote" => 52, "Backquote" => 53,
        "Comma" => 54, "Period" => 55, "Slash" => 56, "CapsLock" => 57,
        "PrintScreen" => 70, "ScrollLock" => 71, "Pause" => 72, "Insert" => 73,
        "Home" => 74, "PageUp" => 75, "Delete" => 76, "End" => 77, "PageDown" => 78,
        "ArrowRight" => 79, "ArrowLeft" => 80, "ArrowDown" => 81, "ArrowUp" => 82,
        "NumLock" => 83, "NumpadDivide" => 84, "NumpadMultiply" => 85,
        "NumpadSubtract" => 86, "NumpadAdd" => 87, "NumpadEnter" => 88,
        "Numpad1" => 89, "Numpad2" => 90, "Numpad3" => 91, "Numpad4" => 92,
        "Numpad5" => 93, "Numpad6" => 94, "Numpad7" => 95, "Numpad8" => 96,
        "Numpad9" => 97, "Numpad0" => 98, "NumpadDecimal" => 99,
        "IntlBackslash" => 100, "ContextMenu" => 101, "Power" => 102,
        "NumpadEqual" => 103, "Help" => 117, "Select" => 119,
        "Again" => 121, "Undo" => 122, "Cut" => 123, "Copy" => 124,
        "Paste" => 125, "Find" => 126, "AudioVolumeMute" => 127,
        "AudioVolumeUp" => 128, "AudioVolumeDown" => 129, "NumpadComma" => 133,
        "IntlRo" => 135, "KanaMode" => 136, "IntlYen" => 137,
        "Convert" => 138, "NonConvert" => 139, "Lang1" => 144, "Lang2" => 145,
        "Lang3" => 146, "Lang4" => 147, "Lang5" => 148,
        "ControlLeft" => 224, "ShiftLeft" => 225, "AltLeft" => 226, "MetaLeft" => 227,
        "ControlRight" => 228, "ShiftRight" => 229, "AltRight" => 230, "MetaRight" => 231,
        "MediaTrackNext" => 258, "MediaTrackPrevious" => 259, "MediaStop" => 260,
        "MediaPlayPause" => 261, "MediaSelect" => 263, "LaunchMail" => 265,
        "LaunchApp2" => 266, "LaunchApp1" => 267, "BrowserSearch" => 268,
        "BrowserHome" => 269, "BrowserBack" => 270, "BrowserForward" => 271,
        "BrowserStop" => 272, "BrowserRefresh" => 273, "BrowserFavorites" => 274,
        "BrightnessDown" => 275, "BrightnessUp" => 276, "Eject" => 281, "Sleep" => 282,
        _ => return None,
    })
}

fn special(scan: u32) -> i32 { (1_i32 << 30) | i32::try_from(scan).unwrap_or(0) }

// Every non-UNKNOWN entry of pinned emscripten_keycode_table (indices 0..222).
// Unknown nonzero legacy codes stay UNKNOWN, exactly as the original backend.
pub fn keycode(scan: u32, key: &str, legacy: u32, location: u8) -> i32 {
    if legacy == 0 { return modern_keycode(scan, key); }
    let value = match legacy {
        3 => special(155), 6 => special(117), 8 => 8, 9 => 9, 12 => special(93), 13 => 13,
        16 => special(225), 17 => special(224), 18 => special(226), 19 => special(72),
        20 => special(57), 27 => 27, 32 => 32, 33 => special(75), 34 => special(78),
        35 => special(77), 36 => special(74), 37 => special(80), 38 => special(82),
        39 => special(79), 40 => special(81), 45 => special(73), 46 => 127,
        48..=57 => i32::try_from(legacy).unwrap_or(0), 59 | 186 => 59,
        60 | 220 => 92, 61 | 187 => 61, 63 | 173 | 189 => 45,
        65..=90 => i32::try_from(legacy + 32).unwrap_or(0), 91 => special(227),
        93 => special(101), 96 => special(98), 97..=105 => special(legacy - 8),
        106 | 170 => special(85), 107 => special(87), 109 => special(86),
        110 => special(99), 111 => special(84), 112..=123 => special(legacy - 54),
        124..=135 => special(legacy - 20), 144 => special(83), 145 => special(71),
        160 | 192 => 96, 163 => special(204), 171 | 221 => 93,
        174 | 182 => special(129), 175 | 183 => special(128), 176 => special(258),
        177 => special(259), 179 => special(261), 181 => special(262),
        188 => 44, 190 => 46, 191 => 47, 219 => 91, 222 => 39, _ => 0,
    };
    if location == 2 {
        if [special(224), special(225), special(226), special(227)].contains(&value) {
            return value + 4;
        }
    } else if location == 3 {
        return match value {
            48 => special(98), 49..=57 => special(u32::try_from(value + 40).unwrap_or(0)),
            13 => special(88), 127 => special(99),
            v if v == special(73) => special(98), v if v == special(77) => special(89),
            v if v == special(81) => special(90), v if v == special(78) => special(91),
            v if v == special(80) => special(92), v if v == special(79) => special(94),
            v if v == special(74) => special(95), v if v == special(82) => special(96),
            v if v == special(75) => special(97), _ => value,
        };
    }
    value
}

fn modern_keycode(scan: u32, key: &str) -> i32 {
    let ascii = match scan {
        4..=29 => {
            let bytes = key.as_bytes();
            if bytes.len() == 1 && bytes[0].is_ascii_alphabetic() {
                bytes[0].to_ascii_lowercase()
            } else { b'a' + u8::try_from(scan - 4).unwrap_or(0) }
        }
        30..=38 => b'1' + u8::try_from(scan - 30).unwrap_or(0), 39 => b'0',
        40 => 13, 41 => 27, 42 => 8, 43 => 9, 44 => 32,
        45 => b'-', 46 => b'=', 47 => b'[', 48 => b']', 49 | 100 => b'\\',
        51 => b';', 52 => b'\'', 53 => b'`', 54 => b',', 55 => b'.', 56 => b'/',
        76 => 127,
        _ => return (1_i32 << 30) | i32::try_from(scan).unwrap_or(0),
    };
    i32::from(ascii)
}

pub fn modifier_bit(scan: u32) -> u32 {
    match scan { 224 => 0x40, 225 => 1, 226 => 0x100, 227 => 0x400,
        228 => 0x80, 229 => 2, 230 => 0x200, 231 => 0x800, _ => 0 }
}
