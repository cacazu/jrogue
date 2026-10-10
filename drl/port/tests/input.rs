use drl_web_port::input::{
    EN_INPUT_JSON, InputAction, InputCoverage, JA_INPUT_JSON, Key, KeyboardEvent, MapPosition,
    PointerEvent, PointerKind, TouchAction, ViewportRect, keyboard, map_position, pointer,
    registry, touch,
};
use drl_web_port::logic::{Command, Coord, Panel};
use std::collections::{BTreeMap, BTreeSet};

const UPSTREAM_KEYS: &str = include_str!("../../upstream/drl/src/drlkeybindings.pas");
const ENGINE_SDL: &str = include_str!("../../upstream/fpcvalkyrie/src/vsdlio.pas");

fn event(key: &str, code: &str) -> KeyboardEvent {
    KeyboardEvent {
        key: key.into(),
        code: code.into(),
        ..KeyboardEvent::default()
    }
}

fn field<'a>(row: &'a str, label: &str) -> &'a str {
    row.split_once(label)
        .expect("upstream field")
        .1
        .split_once('\'')
        .expect("upstream closing quote")
        .0
}

fn official_rows() -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
    UPSTREAM_KEYS
        .lines()
        .filter(|line| line.trim_start().starts_with("(ID:"))
        .map(|line| {
            let default = line
                .split_once("Default:")
                .expect("default")
                .1
                .split_once(';')
                .expect("default separator")
                .0
                .trim();
            (
                field(line, "ID: '"),
                default,
                field(line, "Name: '"),
                field(line, "Description: '"),
            )
        })
        .collect()
}

fn event_from_official_default(default: &str) -> KeyboardEvent {
    let vkey = default.split_whitespace().next().expect("official default");
    let key = match vkey {
        "VKEY_ESCAPE" => "Escape",
        "VKEY_ENTER" => "Enter",
        "VKEY_LEFT" => "ArrowLeft",
        "VKEY_RIGHT" => "ArrowRight",
        "VKEY_UP" => "ArrowUp",
        "VKEY_DOWN" => "ArrowDown",
        "VKEY_HOME" => "Home",
        "VKEY_PGUP" => "PageUp",
        "VKEY_END" => "End",
        "VKEY_PGDOWN" => "PageDown",
        "VKEY_SPACE" => " ",
        "VKEY_TAB" => "Tab",
        "VKEY_COMMA" => ",",
        value => value.strip_prefix("VKEY_").expect("official key"),
    };
    let mut result = event(key, "");
    result.shift_key = default.contains("ShiftMask");
    result.ctrl_key = default.contains("CtrlMask");
    result
}

#[test]
fn registry_covers_every_official_enum_and_named_id_in_original_order() {
    let symbols: Vec<_> = UPSTREAM_KEYS
        .lines()
        .map(str::trim)
        .filter(|line| line.starts_with("INPUT_"))
        .map(|line| line.split([',', ' ', '/']).next().expect("enum symbol"))
        .collect();
    let source = official_rows();
    assert_eq!(source.len(), 80);
    assert_eq!(registry().len(), source.len());
    assert_eq!(symbols.len(), registry().len());
    assert_eq!(
        registry()
            .iter()
            .filter(|b| b.upstream_id.is_some())
            .count(),
        73
    );
    let mut ids = BTreeSet::new();
    for ((binding, original), symbol) in registry().iter().zip(source).zip(symbols) {
        assert_eq!(binding.upstream_symbol, symbol);
        assert_eq!(binding.upstream_id.unwrap_or(""), original.0);
        assert_eq!(binding.upstream_default, original.1);
        assert!(
            ids.insert(binding.id),
            "duplicate semantic ID {}",
            binding.id
        );
        assert_eq!(binding.action.id(), binding.id);
        assert_eq!(binding.action.binding(), binding);
    }
}

#[test]
fn all_61_official_default_chords_decode_to_the_source_semantic_action() {
    let mut count = 0;
    for (binding, original) in registry().iter().zip(official_rows()) {
        if original.1 == "0" {
            assert_eq!(binding.default, None);
        } else {
            let keyboard_event = event_from_official_default(original.1);
            assert_eq!(
                keyboard(&keyboard_event),
                Some(binding.action),
                "{}",
                original.0
            );
            count += 1;
        }
    }
    assert_eq!(count, 61);
}

#[test]
fn official_letters_keep_their_actual_drl_meaning_without_vi_aliases() {
    assert_eq!(keyboard(&event("h", "KeyH")), Some(InputAction::Help));
    assert_eq!(keyboard(&event("y", "KeyY")), Some(InputAction::Traits));
    assert_eq!(keyboard(&event("w", "KeyW")), Some(InputAction::Wait));
    assert_eq!(keyboard(&event(" ", "Space")), Some(InputAction::Action));
    assert_eq!(keyboard(&event(",", "Comma")), Some(InputAction::Run));
    for key in ["j", "k", "b", "n", ".", ">", "?", ":"] {
        assert_eq!(keyboard(&event(key, "")), None, "unexpected alias {key}");
    }
    // CapsLock alone does not imply the Shift modifier.
    assert_eq!(keyboard(&event("F", "KeyF")), Some(InputAction::Fire));
}

#[test]
fn modifiers_are_exact_and_browser_shortcuts_are_preserved() {
    let mut input = event("ArrowLeft", "ArrowLeft");
    input.shift_key = true;
    assert_eq!(keyboard(&input), Some(InputAction::RunLeft));
    input.shift_key = false;
    input.ctrl_key = true;
    assert_eq!(keyboard(&input), Some(InputAction::TargetLeft));
    input.shift_key = true;
    assert_eq!(keyboard(&input), None);
    for (alt, meta) in [(true, false), (false, true), (true, true)] {
        let input = KeyboardEvent {
            alt_key: alt,
            meta_key: meta,
            ..event("f", "KeyF")
        };
        assert_eq!(keyboard(&input), None);
    }
    let save_shortcut = KeyboardEvent {
        ctrl_key: true,
        ..event("s", "KeyS")
    };
    assert_eq!(keyboard(&save_shortcut), None);
    let alternate = KeyboardEvent {
        shift_key: true,
        ..event("F", "KeyF")
    };
    assert_eq!(keyboard(&alternate), Some(InputAction::AltFire));
}

#[test]
fn numpad_aliases_match_the_engine_driver_under_both_numlock_states() {
    let aliases = [
        (1, "End", "VKEY_END", Some(InputAction::WalkDownLeft)),
        (2, "ArrowDown", "VKEY_DOWN", Some(InputAction::WalkDown)),
        (
            3,
            "PageDown",
            "VKEY_PGDOWN",
            Some(InputAction::WalkDownRight),
        ),
        (4, "ArrowLeft", "VKEY_LEFT", Some(InputAction::WalkLeft)),
        (5, "Clear", "VKEY_CENTER", None),
        (6, "ArrowRight", "VKEY_RIGHT", Some(InputAction::WalkRight)),
        (7, "Home", "VKEY_HOME", Some(InputAction::WalkUpLeft)),
        (8, "ArrowUp", "VKEY_UP", Some(InputAction::WalkUp)),
        (9, "PageUp", "VKEY_PGUP", Some(InputAction::WalkUpRight)),
    ];
    for (digit, navigation_key, original_vkey, action) in aliases {
        let symbol = format!("SDLK_KP_{digit}");
        let source_alias = ENGINE_SDL
            .lines()
            .find_map(|line| {
                let (left, right) = line.split_once(':')?;
                if left.trim() != symbol {
                    return None;
                }
                Some(right.split_once(":=")?.1.trim().trim_end_matches(';'))
            })
            .expect("official SDL keypad alias");
        assert_eq!(source_alias, original_vkey);
        for key in [navigation_key.to_string(), digit.to_string()] {
            let keypad = KeyboardEvent {
                location: 3,
                ..event(&key, &format!("Numpad{digit}"))
            };
            assert_eq!(keyboard(&keypad), action, "NumLock-dependent text {key}");
            assert_eq!(keypad.location, 3);
            assert_eq!(keypad.code, format!("Numpad{digit}"));
        }
        let top_row = event(&digit.to_string(), &format!("Digit{digit}"));
        assert_eq!(
            keyboard(&top_row).expect("quickslot").command(),
            Some(Command::QuickKey { slot: digit })
        );
    }
    let home = KeyboardEvent {
        location: 3,
        ctrl_key: true,
        ..event("7", "Numpad7")
    };
    assert_eq!(keyboard(&home), Some(InputAction::TargetUpLeft));
    let northeast = KeyboardEvent {
        location: 3,
        shift_key: true,
        ..event("9", "Numpad9")
    };
    assert_eq!(keyboard(&northeast), Some(InputAction::RunUpRight));
    assert_eq!(
        keyboard(&event("Enter", "NumpadEnter")),
        Some(InputAction::Ok)
    );
    assert_eq!(keyboard(&event(",", "NumpadComma")), None);
    assert_eq!(keyboard(&event("0", "Numpad0")), None);
}

#[test]
fn japanese_ime_composition_never_emits_game_actions() {
    for key in [
        "f",
        "Enter",
        "ArrowLeft",
        "Process",
        "Dead",
        "変換",
        "無変換",
        "あ",
    ] {
        let composing = KeyboardEvent {
            is_composing: true,
            ..event(key, "KeyF")
        };
        assert_eq!(keyboard(&composing), None);
        let legacy_composing = KeyboardEvent {
            key_code: 229,
            ..event(key, "KeyF")
        };
        assert_eq!(keyboard(&legacy_composing), None);
    }
    for key in ["あ", "Ｆ", "玩家", "😀", "Process", "Dead"] {
        assert_eq!(keyboard(&event(key, "KeyF")), None);
    }
}

#[test]
fn focused_form_controls_are_left_to_the_browser() {
    for key in ["Enter", "Escape", "Tab", "ArrowLeft", " ", "f", "1"] {
        let focused = KeyboardEvent {
            editable_target: true,
            ..event(key, "")
        };
        assert_eq!(keyboard(&focused), None);
    }
}

#[test]
fn dto_roundtrip_retains_unicode_external_text_and_browser_metadata() {
    let input = KeyboardEvent {
        key: "Kit_田中🙂é".into(),
        code: "Unidentified".into(),
        location: 3,
        is_composing: true,
        repeat: true,
        ..KeyboardEvent::default()
    };
    let before = input.clone();
    let serialized = serde_json::to_string(&input).expect("serialize event");
    let restored: KeyboardEvent = serde_json::from_str(&serialized).expect("deserialize event");
    assert_eq!(restored, before);
    assert_eq!(restored.key, "Kit_田中🙂é");
    assert_eq!(keyboard(&restored), None);
    assert_eq!(input, before);
}

#[test]
fn decoder_accepts_browser_camelcase_dto_and_is_pure() {
    let input: KeyboardEvent = serde_json::from_str(
        r#"{"key":"F","code":"KeyF","shiftKey":true,"ctrlKey":false,"altKey":false,"metaKey":false,"location":0,"isComposing":false,"repeat":true,"editableTarget":false,"keyCode":70}"#
    ).expect("browser DTO");
    let before = input.clone();
    for _ in 0..100 {
        assert_eq!(keyboard(&input), Some(InputAction::AltFire));
    }
    assert_eq!(input, before);
}

#[test]
fn unported_actions_remain_distinct_and_never_become_wrong_commands() {
    for action in [
        InputAction::Run,
        InputAction::TargetLeft,
        InputAction::TargetRight,
        InputAction::TargetUp,
        InputAction::TargetDown,
        InputAction::TargetUpLeft,
        InputAction::TargetUpRight,
        InputAction::TargetDownLeft,
        InputAction::TargetDownRight,
        InputAction::MoreSelf,
        InputAction::SoundToggle,
        InputAction::MusicToggle,
        InputAction::ToggleGrid,
        InputAction::ExamineNpc,
        InputAction::ExamineItem,
        InputAction::LegacyOpen,
        InputAction::LegacyClose,
        InputAction::LegacyDrop,
        InputAction::LegacyUse,
        InputAction::Quit,
        InputAction::HardQuit,
    ] {
        assert_eq!(action.command(), None);
        assert_eq!(action.coverage(), InputCoverage::NeedsEngineCommand);
    }
    assert_eq!(InputAction::None.coverage(), InputCoverage::NoAction);
    assert_eq!(
        InputAction::MouseLeft.coverage(),
        InputCoverage::PointerCoordinates
    );
    assert_eq!(InputAction::LegacySave.command(), Some(Command::Save));
    assert_eq!(
        InputAction::Help.command(),
        Some(Command::OpenPanel { panel: Panel::Help })
    );
    assert_eq!(InputAction::Traits.id(), "input_trait");
    assert_eq!(InputAction::MoreSelf.id(), "input_selfmore");
    for binding in registry() {
        if let Some(command) = binding.action.command() {
            assert!(command.validate(), "{}", binding.id);
        }
    }
}

fn rect() -> ViewportRect {
    ViewportRect {
        left: 100.0,
        top: 50.0,
        width: 780.0,
        height: 200.0,
    }
}

#[test]
fn map_coordinates_use_css_rect_and_half_open_edges() {
    assert_eq!(
        map_position(rect(), 100.0, 50.0),
        Some(MapPosition { x: 0, y: 0 })
    );
    assert_eq!(
        map_position(rect(), 879.999, 249.999),
        Some(MapPosition { x: 77, y: 19 })
    );
    assert_eq!(
        map_position(rect(), 110.0, 60.0),
        Some(MapPosition { x: 1, y: 1 })
    );
    for (x, y) in [(99.99, 50.0), (100.0, 49.99), (880.0, 50.0), (100.0, 250.0)] {
        assert_eq!(map_position(rect(), x, y), None);
    }
    assert_eq!(
        MapPosition { x: 0, y: 0 }.coord(),
        Some(Coord { x: 1, y: 1 })
    );
    assert_eq!(
        MapPosition { x: 77, y: 19 }.coord(),
        Some(Coord { x: 78, y: 20 })
    );
    assert_eq!(MapPosition { x: 78, y: 19 }.coord(), None);
    assert_eq!(MapPosition { x: 77, y: 20 }.coord(), None);
}

#[test]
fn responsive_mobile_rect_and_device_pixel_scaling_do_not_change_the_cell() {
    let desktop = ViewportRect {
        left: 0.0,
        top: 0.0,
        width: 780.0,
        height: 200.0,
    };
    let mobile = ViewportRect {
        left: 17.0,
        top: 31.0,
        width: 390.0,
        height: 100.0,
    };
    assert_eq!(
        map_position(desktop, 390.0, 100.0),
        Some(MapPosition { x: 39, y: 10 })
    );
    assert_eq!(
        map_position(mobile, 212.0, 81.0),
        Some(MapPosition { x: 39, y: 10 })
    );
    // Coordinates are CSS pixels, independent of the canvas backing pixel ratio.
    let narrow = ViewportRect {
        left: 0.0,
        top: 0.0,
        width: 312.0,
        height: 80.0,
    };
    assert_eq!(
        map_position(narrow, 156.0, 40.0),
        Some(MapPosition { x: 39, y: 10 })
    );
}

#[test]
fn invalid_rectangles_and_nonfinite_pointer_coordinates_are_rejected() {
    for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        assert_eq!(map_position(rect(), value, 100.0), None);
        assert_eq!(map_position(rect(), 200.0, value), None);
        assert_eq!(
            map_position(
                ViewportRect {
                    left: value,
                    ..rect()
                },
                200.0,
                100.0
            ),
            None
        );
        assert_eq!(
            map_position(
                ViewportRect {
                    height: value,
                    ..rect()
                },
                200.0,
                100.0
            ),
            None
        );
    }
    for width in [0.0, -1.0] {
        assert_eq!(
            map_position(ViewportRect { width, ..rect() }, 200.0, 100.0),
            None
        );
    }
    let overflowing = ViewportRect {
        left: -f64::MAX,
        width: f64::MAX,
        ..rect()
    };
    assert_eq!(map_position(overflowing, f64::MAX, 100.0), None);
}

#[test]
fn pointer_buttons_and_wheels_keep_coordinates_and_original_compat_semantics() {
    let mut input = PointerEvent {
        kind: PointerKind::Down,
        client_x: 125.0,
        client_y: 85.0,
        button: 0,
        delta_y: 0.0,
    };
    for (button, action) in [
        (0, InputAction::MouseLeft),
        (1, InputAction::MouseMiddle),
        (2, InputAction::MouseRight),
    ] {
        input.button = button;
        let decoded = pointer(&input, rect()).expect("mouse button");
        assert_eq!(decoded.action, action);
        assert_eq!(decoded.position, MapPosition { x: 2, y: 3 });
        assert_eq!(decoded.action.command(), None);
    }
    input.button = 3;
    assert_eq!(pointer(&input, rect()), None);
    input.kind = PointerKind::Move;
    assert_eq!(
        pointer(&input, rect()).expect("move").action,
        InputAction::MouseMove
    );
    input.kind = PointerKind::Wheel;
    input.delta_y = -0.1;
    assert_eq!(
        pointer(&input, rect()).expect("scroll").action,
        InputAction::MouseScrollUp
    );
    input.delta_y = 1.0;
    assert_eq!(
        pointer(&input, rect()).expect("scroll").action,
        InputAction::MouseScrollDown
    );
    for delta in [0.0, f64::NAN, f64::INFINITY] {
        input.delta_y = delta;
        assert_eq!(pointer(&input, rect()), None);
    }
    input.kind = PointerKind::Down;
    input.button = 0;
    input.client_x = 880.0;
    assert_eq!(pointer(&input, rect()), None);
}

#[test]
fn touch_directions_and_actions_map_to_the_same_semantic_commands() {
    for dx in -1..=1 {
        for dy in -1..=1 {
            for run in [false, true] {
                let decoded = touch(TouchAction::Move { dx, dy, run });
                if dx == 0 && dy == 0 {
                    assert_eq!(decoded, None);
                } else {
                    assert_eq!(
                        decoded.expect("direction").command(),
                        Some(Command::Walk { dx, dy, run })
                    );
                }
            }
        }
    }
    assert_eq!(
        touch(TouchAction::Move {
            dx: 2,
            dy: 0,
            run: false
        }),
        None
    );
    assert_eq!(
        touch(TouchAction::Move {
            dx: i8::MIN,
            dy: 1,
            run: true
        }),
        None
    );
    assert_eq!(
        touch(TouchAction::Wait { run: true }),
        Some(InputAction::RunWait)
    );
    assert_eq!(
        touch(TouchAction::Fire { alternate: true }),
        Some(InputAction::AltFire)
    );
    assert_eq!(
        touch(TouchAction::Pickup { alternate: true }),
        Some(InputAction::AltPickup)
    );
    assert_eq!(touch(TouchAction::Action), Some(InputAction::Action));
    assert_eq!(touch(TouchAction::Cancel), Some(InputAction::Escape));
    assert_eq!(touch(TouchAction::Confirm), Some(InputAction::Ok));
}

fn placeholders(text: &str) -> BTreeSet<&str> {
    let mut names = BTreeSet::new();
    let mut remainder = text;
    while let Some((_, after_open)) = remainder.split_once('{') {
        let (name, after_close) = after_open.split_once('}').expect("unclosed placeholder");
        assert!(!name.is_empty(), "empty placeholder");
        names.insert(name);
        remainder = after_close;
    }
    names
}

#[test]
fn english_and_japanese_catalogs_cover_all_names_descriptions_groups_and_placeholders() {
    let en: BTreeMap<String, String> = serde_json::from_str(EN_INPUT_JSON).expect("English JSON");
    let ja: BTreeMap<String, String> = serde_json::from_str(JA_INPUT_JSON).expect("Japanese JSON");
    assert_eq!(en.len(), 173);
    assert_eq!(en.keys().collect::<Vec<_>>(), ja.keys().collect::<Vec<_>>());
    for (id, english) in &en {
        let japanese = &ja[id];
        assert!(!english.is_empty(), "empty English {id}");
        assert!(!japanese.is_empty(), "empty Japanese {id}");
        assert_eq!(placeholders(english), placeholders(japanese), "{id}");
    }
    for (binding, (_, _, name, description)) in registry().iter().zip(official_rows()) {
        assert!(en.contains_key(binding.name_id));
        assert!(ja.contains_key(binding.description_id));
        assert!(en.contains_key(binding.group_id));
        if binding.upstream_id.is_some() {
            assert_eq!(en[binding.name_id], name);
            assert_eq!(en[binding.description_id], description);
        }
    }
    assert_eq!(ja["input_trait.name"], "特性画面");
    assert_eq!(ja["input_assemblies.name"], "組立レシピ画面");
}

#[test]
fn semantic_action_serialization_uses_exact_ids_including_irregular_upstream_ids() {
    for binding in registry() {
        let json = serde_json::to_string(&binding.action).expect("serialize action");
        assert_eq!(json, format!("\"{}\"", binding.id));
        let restored: InputAction = serde_json::from_str(&json).expect("deserialize action");
        assert_eq!(restored, binding.action);
    }
    assert!(matches!(
        registry()[3].default.expect("left").key,
        Key::ArrowLeft
    ));
}
