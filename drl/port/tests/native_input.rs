use drl_web_port::platform::native_input::{
    ALT_MASK, CONSOLE_HEIGHT, CONSOLE_WIDTH, CONTROL_MASK, InputError, KeyPhase, KeyboardEvent,
    MAX_TEXT_BYTES, Modifiers, Normalized, PACKET_BYTES, PadDevice, Request, SHIFT_MASK,
    TEXT_PACKET_BYTES, normalize,
};
use unicode_segmentation::UnicodeSegmentation;

const KEY_CONSTANTS: &str = include_str!("../../upstream/fpcvalkyrie/src/vioevent.inc");
const KEY_IMPLEMENTATION: &str = include_str!("../../upstream/fpcvalkyrie/src/vioevent.pas");
const PAD_IMPLEMENTATION: &str = include_str!("../../upstream/fpcvalkyrie/src/viopadstate.pas");
const SDL_IMPLEMENTATION: &str = include_str!("../../upstream/fpcvalkyrie/src/vsdlio.pas");

fn word(packet: &[u8], index: usize) -> u32 {
    u32::from_le_bytes(packet[index * 4..index * 4 + 4].try_into().unwrap())
}

fn signed_word(packet: &[u8], index: usize) -> i32 {
    i32::from_le_bytes(packet[index * 4..index * 4 + 4].try_into().unwrap())
}

fn single(result: &Normalized) -> &[u8] {
    assert!(result.captured);
    assert_eq!(result.packets.len(), 1);
    let packet = &result.packets[0];
    assert_eq!(packet.len(), PACKET_BYTES);
    assert_eq!(word(packet, 0), 1);
    packet
}

fn keyboard(key: &str, code: &str) -> Request {
    Request::Keyboard {
        phase: KeyPhase::Down,
        event: KeyboardEvent {
            key: key.into(),
            code: code.into(),
            ..Default::default()
        },
    }
}

fn key_event(request: &mut Request) -> &mut KeyboardEvent {
    let Request::Keyboard { event, .. } = request else {
        panic!("keyboard request")
    };
    event
}

fn source_key(name: &str) -> u32 {
    KEY_CONSTANTS
        .lines()
        .find_map(|line| {
            let (key, value) = line.split_once('=')?;
            (key.trim() == name).then(|| value.trim().trim_end_matches(';').parse().unwrap())
        })
        .unwrap_or_else(|| panic!("missing original key {name}"))
}

// Read the pinned Pascal literal, including #39 and doubled quote escapes.
fn source_unshift_table() -> Vec<u8> {
    let literal = KEY_IMPLEMENTATION
        .split_once("const Keys32_126 =")
        .unwrap()
        .1
        .split_once("function Unshift")
        .unwrap()
        .0;
    let bytes = literal.as_bytes();
    let mut result = Vec::new();
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'\'' => {
                index += 1;
                while index < bytes.len() {
                    if bytes[index] == b'\'' {
                        index += 1;
                        if bytes.get(index) == Some(&b'\'') {
                            result.push(b'\'');
                            index += 1;
                            continue;
                        }
                        break;
                    }
                    result.push(bytes[index]);
                    index += 1;
                }
            }
            b'#' => {
                index += 1;
                let start = index;
                while bytes.get(index).is_some_and(u8::is_ascii_digit) {
                    index += 1;
                }
                result.push(literal[start..index].parse().unwrap());
            }
            _ => index += 1,
        }
    }
    result
}

#[test]
fn explicit_wire_is_little_endian_and_does_not_serialize_native_records() {
    let mut request = keyboard("g", "KeyG");
    let event = key_event(&mut request);
    event.ctrl_key = true;
    event.repeat = true;
    let result = normalize(&request).unwrap();
    let packet = single(&result);
    assert_eq!(
        &packet[0..24],
        &[
            1, 0, 0, 0, 1, 0, 0, 0, b'g', 0, 0, 0, b'g', 0, 0, 0, 0, 4, 0, 0, 3, 0, 0, 0,
        ]
    );
    assert!(packet[24..].iter().all(|byte| *byte == 0));
    assert_eq!(result.trigger_down, None);
}

#[test]
fn navigation_control_and_function_keys_match_the_original_constants() {
    let rows = [
        ("Backspace", "VKEY_BACK"),
        ("Tab", "VKEY_TAB"),
        ("Enter", "VKEY_ENTER"),
        ("PageUp", "VKEY_PGUP"),
        ("PageDown", "VKEY_PGDOWN"),
        ("End", "VKEY_END"),
        ("Home", "VKEY_HOME"),
        ("ArrowLeft", "VKEY_LEFT"),
        ("ArrowUp", "VKEY_UP"),
        ("ArrowRight", "VKEY_RIGHT"),
        ("ArrowDown", "VKEY_DOWN"),
        ("Delete", "VKEY_DELETE"),
        ("Insert", "VKEY_INSERT"),
        ("Escape", "VKEY_ESCAPE"),
    ];
    for (dom, original) in rows {
        let result = normalize(&keyboard(dom, dom)).unwrap();
        let packet = single(&result);
        assert_eq!(word(packet, 2), source_key(original), "{dom}");
        assert_eq!(word(packet, 3), 0);
    }
    for index in 1..=12 {
        let name = format!("F{index}");
        let result = normalize(&keyboard(&name, &name)).unwrap();
        assert_eq!(
            word(single(&result), 2),
            source_key(&format!("VKEY_{name}"))
        );
    }
}

#[test]
fn every_printable_ascii_unshifts_using_the_actual_source_table() {
    let source = source_unshift_table();
    assert_eq!(source.len(), 95);
    for ascii in 32_u8..=126 {
        let value = char::from(ascii).to_string();
        let result = normalize(&keyboard(&value, "")).unwrap();
        let packet = single(&result);
        let native = source[usize::from(ascii - 32)];
        assert_eq!(word(packet, 2), u32::from(native), "{value}");
        assert_eq!(word(packet, 3), u32::from(ascii), "{value}");
        assert_eq!(
            word(packet, 4),
            if native == ascii { 0 } else { SHIFT_MASK }
        );
    }
}

#[test]
fn custom_binding_modifiers_and_capslock_printable_semantics_are_preserved() {
    let mut request = keyboard("A", "KeyA");
    let event = key_event(&mut request);
    event.ctrl_key = true;
    event.alt_key = true;
    let result = normalize(&request).unwrap();
    let packet = single(&result);
    assert_eq!(word(packet, 2), u32::from(b'a'));
    assert_eq!(word(packet, 3), u32::from(b'A'));
    assert_eq!(word(packet, 4), SHIFT_MASK | ALT_MASK | CONTROL_MASK);
    // No conversion to a default gameplay action: even unbound/custom chords survive.
    assert!(normalize(&keyboard("q", "KeyQ")).unwrap().captured);
}

#[test]
fn keypad_identity_wins_over_numlock_and_top_row_digits_remain_printable() {
    let names = [
        "VKEY_END",
        "VKEY_DOWN",
        "VKEY_PGDOWN",
        "VKEY_LEFT",
        "VKEY_CENTER",
        "VKEY_RIGHT",
        "VKEY_HOME",
        "VKEY_UP",
        "VKEY_PGUP",
    ];
    for (offset, original) in names.into_iter().enumerate() {
        let digit = offset + 1;
        for key in [digit.to_string(), "ArrowLeft".into()] {
            let request = keyboard(&key, &format!("Numpad{digit}"));
            let result = normalize(&request).unwrap();
            assert_eq!(word(single(&result), 2), source_key(original));
            assert_eq!(word(single(&result), 3), 0);
        }
        let result = normalize(&keyboard(&digit.to_string(), &format!("Digit{digit}"))).unwrap();
        assert_eq!(
            word(single(&result), 2),
            u32::from(b'0') + u32::try_from(digit).unwrap()
        );
    }
    assert_eq!(
        word(
            single(&normalize(&keyboard("Enter", "NumpadEnter")).unwrap()),
            2
        ),
        13
    );
    for code in ["Numpad0", "NumpadDecimal", "NumpadAdd", "NumpadDivide"] {
        assert_eq!(
            normalize(&keyboard("0", code)).unwrap(),
            Normalized::default()
        );
    }
    assert!(SDL_IMPLEMENTATION.contains("SDLK_KP_5           : Result := VKEY_CENTER;"));
}

#[test]
fn keyup_and_repeat_flags_have_the_original_types_and_bounds() {
    let mut request = keyboard("ArrowUp", "ArrowUp");
    key_event(&mut request).repeat = true;
    let result = normalize(&request).unwrap();
    assert_eq!(word(single(&result), 1), 1);
    assert_eq!(word(single(&result), 5), 3);
    let Request::Keyboard { phase, .. } = &mut request else {
        unreachable!()
    };
    *phase = KeyPhase::Up;
    let result = normalize(&request).unwrap();
    assert_eq!(word(single(&result), 1), 2);
    assert_eq!(word(single(&result), 5), 0);
}

#[test]
fn ime_editable_meta_and_os_shortcuts_do_not_reach_the_core() {
    for condition in 0..4 {
        let mut request = keyboard("f", "KeyF");
        let event = key_event(&mut request);
        match condition {
            0 => event.is_composing = true,
            1 => event.editable_target = true,
            2 => event.meta_key = true,
            _ => event.key_code = 229,
        }
        assert_eq!(normalize(&request).unwrap(), Normalized::default());
    }
    for key in ["Tab", "Escape", "F4", " ", "ArrowLeft", "ArrowRight"] {
        let mut request = keyboard(key, key);
        key_event(&mut request).alt_key = true;
        assert!(!normalize(&request).unwrap().captured);
    }
    for key in [
        "r", "R", "l", "t", "w", "n", "p", "s", "f", "d", "o", "h", "j", "k", "Tab", "F4", "+",
        "=", "-", "_", "0",
    ] {
        let mut request = keyboard(key, "");
        key_event(&mut request).ctrl_key = true;
        assert!(!normalize(&request).unwrap().captured, "Ctrl+{key}");
    }
    for key in ["ArrowLeft", "ArrowUp", "Home", "End", "PageUp", "PageDown"] {
        let mut request = keyboard(key, key);
        key_event(&mut request).ctrl_key = true;
        let result = normalize(&request).unwrap();
        assert_eq!(word(single(&result), 4), CONTROL_MASK);
    }
    for key in ["Dead", "Process", "Shift", "Meta", "あ", "😀", "F13"] {
        assert_eq!(
            normalize(&keyboard(key, "")).unwrap(),
            Normalized::default()
        );
    }
    let mut invalid = keyboard("f", "KeyF");
    key_event(&mut invalid).key = "f".repeat(65);
    assert_eq!(normalize(&invalid), Err(InputError::InvalidKeyboard));
}

#[test]
fn committed_cjk_combining_and_astral_text_is_lossless_and_grapheme_safe() {
    let text = format!(
        "{}{}{}",
        "日本語e\u{301}".repeat(8),
        "👨‍👩‍👧‍👦".repeat(6),
        "😀終端"
    );
    let result = normalize(&Request::Text { text: text.clone() }).unwrap();
    assert!(result.captured);
    assert!(result.packets.len() > 1);
    let boundaries: Vec<usize> = text
        .grapheme_indices(true)
        .map(|(index, _)| index)
        .chain(std::iter::once(text.len()))
        .collect();
    let mut restored = Vec::new();
    for packet in result.packets {
        assert_eq!(packet.len(), PACKET_BYTES);
        assert_eq!(word(&packet, 1), 10);
        assert_eq!(word(&packet, 2), 0);
        assert_eq!(word(&packet, 3), 0);
        let length = usize::try_from(word(&packet, 15)).unwrap();
        assert!(length <= TEXT_PACKET_BYTES && length > 0);
        assert!(std::str::from_utf8(&packet[64..64 + length]).is_ok());
        restored.extend_from_slice(&packet[64..64 + length]);
        assert!(boundaries.contains(&restored.len()));
        assert!(packet[64 + length..].iter().all(|byte| *byte == 0));
    }
    assert_eq!(String::from_utf8(restored).unwrap(), text);
}

#[test]
fn exact_text_bounds_and_invalid_clusters_are_rejected_atomically() {
    let exact = normalize(&Request::Text {
        text: "a".repeat(63),
    })
    .unwrap();
    assert_eq!(word(single(&exact), 15), 63);
    let overflow = normalize(&Request::Text {
        text: "a".repeat(64),
    })
    .unwrap();
    assert_eq!(overflow.packets.len(), 2);
    assert_eq!(word(&overflow.packets[1], 15), 1);
    assert_eq!(
        normalize(&Request::Text {
            text: String::new()
        })
        .unwrap(),
        Normalized::default()
    );
    assert_eq!(
        normalize(&Request::Text {
            text: "a".repeat(MAX_TEXT_BYTES + 1)
        }),
        Err(InputError::TextTooLarge)
    );
    let oversized = format!("abc{}{}", "e", "\u{301}".repeat(32));
    assert_eq!(
        normalize(&Request::Text { text: oversized }),
        Err(InputError::GraphemeTooLarge)
    );
    for text in ["bad\0text", "bad\ntext", "bad\rtext", "bad\ttext", "\u{7f}"] {
        assert_eq!(
            normalize(&Request::Text { text: text.into() }),
            Err(InputError::InvalidText)
        );
    }
}

#[test]
fn mouse_cells_modifiers_motion_and_button_bits_match_native_ordinals() {
    let request = Request::MouseMove {
        x: 79,
        y: 24,
        relative_x: -2,
        relative_y: 1,
        buttons: 31,
        modifiers: Modifiers {
            shift: true,
            control: true,
            alt: false,
        },
    };
    let result = normalize(&request).unwrap();
    let packet = single(&result);
    assert_eq!(word(packet, 1), 3);
    assert_eq!(word(packet, 6), 80);
    assert_eq!(word(packet, 7), 25);
    assert_eq!(signed_word(packet, 8), -2);
    assert_eq!(signed_word(packet, 9), 1);
    assert_eq!(word(packet, 11), 15);
    assert_eq!(word(packet, 4), SHIFT_MASK | CONTROL_MASK);
    for (dom, native) in [(0, 1), (1, 2), (2, 3), (3, 0), (4, 0)] {
        for pressed in [false, true] {
            let request = Request::MouseButton {
                x: 0,
                y: 0,
                button: dom,
                pressed,
                modifiers: Default::default(),
            };
            let result = normalize(&request).unwrap();
            let packet = single(&result);
            assert_eq!(word(packet, 1), if pressed { 4 } else { 5 });
            assert_eq!(word(packet, 10), native);
            assert_eq!(word(packet, 5), u32::from(pressed));
            assert_eq!((word(packet, 6), word(packet, 7)), (1, 1));
        }
    }
}

#[test]
fn outside_console_pointer_and_nonfinite_wheel_do_not_make_commands() {
    for (x, y) in [(-1, 0), (0, -1), (CONSOLE_WIDTH, 0), (0, CONSOLE_HEIGHT)] {
        let request = Request::MouseButton {
            x,
            y,
            button: 0,
            pressed: true,
            modifiers: Default::default(),
        };
        assert_eq!(normalize(&request).unwrap(), Normalized::default());
    }
    for (delta, native) in [(-1.0, 4), (1.0, 5)] {
        let request = Request::Wheel {
            x: 12,
            y: 10,
            delta_y: delta,
            modifiers: Default::default(),
        };
        let result = normalize(&request).unwrap();
        assert_eq!(word(single(&result), 1), 4);
        assert_eq!(word(single(&result), 10), native);
    }
    let zero = Request::Wheel {
        x: 0,
        y: 0,
        delta_y: 0.0,
        modifiers: Default::default(),
    };
    assert_eq!(normalize(&zero).unwrap(), Normalized::default());
    let bad = Request::Wheel {
        x: 0,
        y: 0,
        delta_y: f64::NAN,
        modifiers: Default::default(),
    };
    assert_eq!(normalize(&bad), Err(InputError::InvalidPointer));
    let bad = Request::MouseMove {
        x: 0,
        y: 0,
        relative_x: 0,
        relative_y: 0,
        buttons: 32,
        modifiers: Default::default(),
    };
    assert_eq!(normalize(&bad), Err(InputError::InvalidPointer));
}

#[test]
fn standard_gamepad_buttons_remap_to_sdl_without_treating_triggers_as_digital() {
    let rows = [
        (0, 0),
        (1, 1),
        (2, 2),
        (3, 3),
        (4, 9),
        (5, 10),
        (8, 4),
        (9, 6),
        (10, 7),
        (11, 8),
        (12, 11),
        (13, 12),
        (14, 13),
        (15, 14),
        (16, 5),
    ];
    for (browser, native) in rows {
        for pressed in [true, false] {
            let result = normalize(&Request::PadButton {
                which: 3,
                button: browser,
                pressed,
            })
            .unwrap();
            let packet = single(&result);
            assert_eq!(word(packet, 1), if pressed { 7 } else { 8 });
            assert_eq!(word(packet, 10), native);
            assert_eq!(word(packet, 13), 3);
            assert_eq!(word(packet, 5), u32::from(pressed));
        }
    }
    for button in [6, 7, 17, 255] {
        assert_eq!(
            normalize(&Request::PadButton {
                which: 0,
                button,
                pressed: true
            }),
            Err(InputError::UnsupportedPadButton)
        );
    }
}

#[test]
fn gamepad_axis_has_full_signed_range_and_no_adapter_deadzone() {
    for (value, expected) in [(-1.0, -32768), (0.0, 0), (0.01, 328), (1.0, 32767)] {
        for axis in 0..4 {
            let result = normalize(&Request::PadAxis {
                which: 0,
                axis,
                value,
            })
            .unwrap();
            let packet = single(&result);
            assert_eq!(word(packet, 1), 6);
            assert_eq!(word(packet, 2), u32::from(axis));
            assert_eq!(signed_word(packet, 12), expected);
        }
    }
    for value in [f64::INFINITY, f64::NAN, -1.01, 1.01] {
        assert_eq!(
            normalize(&Request::PadAxis {
                which: 0,
                axis: 0,
                value
            }),
            Err(InputError::InvalidAxis)
        );
    }
    assert_eq!(
        normalize(&Request::PadAxis {
            which: -1,
            axis: 0,
            value: 0.0
        }),
        Err(InputError::InvalidGamepad)
    );
    assert_eq!(
        normalize(&Request::PadAxis {
            which: 32,
            axis: 0,
            value: 0.0
        }),
        Err(InputError::InvalidGamepad)
    );
    assert_eq!(
        normalize(&Request::PadAxis {
            which: 0,
            axis: 4,
            value: 0.0
        }),
        Err(InputError::InvalidAxis)
    );
}

#[test]
fn trigger_hysteresis_matches_strict_native_boundaries_and_axis_event_order() {
    assert!(PAD_IMPLEMENTATION.contains("VPAD_TRIGGER_PRESS_THRESHOLD   = 10000;"));
    assert!(PAD_IMPLEMENTATION.contains("VPAD_TRIGGER_RELEASE_THRESHOLD = 8000;"));
    assert!(PAD_IMPLEMENTATION.contains("aAxisEvent.Value > VPAD_TRIGGER_PRESS_THRESHOLD"));
    assert!(PAD_IMPLEMENTATION.contains("aAxisEvent.Value < VPAD_TRIGGER_RELEASE_THRESHOLD"));
    for (button, axis, native_button) in [(6, 4, 26), (7, 5, 27)] {
        for (value, before, after, transition) in [
            (10_000, false, false, None),
            (10_001, false, true, Some(7)),
            (8_000, true, true, None),
            (7_999, true, false, Some(8)),
            (9_000, true, true, None),
            (9_000, false, false, None),
        ] {
            let request = Request::PadTrigger {
                which: 1,
                button,
                value: f64::from(value) / 32_767.0,
                was_down: before,
            };
            let result = normalize(&request).unwrap();
            assert_eq!(result.trigger_down, Some(after));
            assert_eq!(word(&result.packets[0], 1), 6);
            assert_eq!(word(&result.packets[0], 2), axis);
            assert_eq!(signed_word(&result.packets[0], 12), value);
            match transition {
                Some(kind) => {
                    assert_eq!(result.packets.len(), 2);
                    assert_eq!(word(&result.packets[1], 1), kind);
                    assert_eq!(word(&result.packets[1], 10), native_button);
                    assert_eq!(word(&result.packets[1], 5), u32::from(after));
                }
                None => assert_eq!(result.packets.len(), 1),
            }
        }
    }
}

#[test]
fn device_events_preserve_native_ordinals_and_normalization_is_repeatable() {
    for (event, native) in [
        (PadDevice::Added, 0),
        (PadDevice::Removed, 1),
        (PadDevice::Remapped, 2),
    ] {
        let request = Request::PadDevice { which: 2, event };
        let result = normalize(&request).unwrap();
        assert_eq!(word(single(&result), 1), 9);
        assert_eq!(word(single(&result), 2), native);
        assert_eq!(normalize(&request).unwrap(), result);
    }
    let request = Request::Text {
        text: "外部ユーザー名😀".into(),
    };
    assert_eq!(normalize(&request), normalize(&request));
}

#[test]
fn json_dto_rejects_unknown_and_wrong_type_fields() {
    let keyboard: Request = serde_json::from_str(
        r#"{"kind":"keyboard","phase":"down","event":{"key":"f","code":"KeyF"}}"#,
    )
    .unwrap();
    assert!(normalize(&keyboard).unwrap().captured);
    let pointer: Request =
        serde_json::from_str(r#"{"kind":"mouse_button","x":0,"y":0,"button":0,"pressed":true}"#)
            .unwrap();
    assert!(normalize(&pointer).unwrap().captured);
    for value in [
        r#"{"kind":"keyboard","phase":"down","event":{"key":"f","code":"KeyF","extra":1}}"#,
        r#"{"kind":"text","text":"abc","translate":true}"#,
        r#"{"kind":"pad_axis","which":0,"axis":0,"value":"1"}"#,
        r#"{"kind":"mouse_button","x":80.5,"y":0,"button":0,"pressed":true}"#,
    ] {
        assert!(serde_json::from_str::<Request>(value).is_err(), "{value}");
    }
}
