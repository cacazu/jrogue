//! Bounded browser input and shell text, with the original C++ engine authoritative.
//! This module cannot access an engine, RNG, simulation clock, DOM or filesystem.
use cdda_input::{Bindings, InputContext, StandardGamepad, TouchControl};
use cdda_logic_contract::{
    Command, Direction, GameAction, ParameterValue, TextEvent, TextId, UiAction,
};
use cdda_presentation::Catalog;
use std::{cell::RefCell, collections::BTreeMap, sync::OnceLock};

mod text_ids;
pub use text_ids::TEXT_IDS;

const MAX_REASON_BYTES: usize = 65_536;
static BINDINGS: OnceLock<Result<Bindings, String>> = OnceLock::new();
static JA: OnceLock<Result<Catalog, String>> = OnceLock::new();
static EN: OnceLock<Result<Catalog, String>> = OnceLock::new();

#[derive(Default)]
struct Scratch {
    reason: String,
    output: String,
}
thread_local! {
    static SCRATCH: RefCell<Scratch> = RefCell::new(Scratch::default());
}

fn bindings() -> Option<&'static Bindings> {
    BINDINGS
        .get_or_init(|| Bindings::stable().map_err(|error| error.to_string()))
        .as_ref()
        .ok()
}
fn catalog(locale: u32) -> Option<&'static Catalog> {
    let (storage, json) = match locale {
        0 => (&JA, include_str!("../locales/ja.json")),
        1 => (&EN, include_str!("../locales/en.json")),
        _ => return None,
    };
    storage
        .get_or_init(|| Catalog::from_json(json).map_err(|error| error.to_string()))
        .as_ref()
        .ok()
}
fn context(value: u32) -> Option<InputContext> {
    match value {
        0 => Some(InputContext::DefaultMode),
        1 => Some(InputContext::Menu),
        2 => Some(InputContext::CharacterName),
        _ => None,
    }
}
fn direction(value: u32) -> Option<Direction> {
    usize::try_from(value)
        .ok()
        .and_then(|index| Direction::ALL.get(index).copied())
}
fn touch_control(value: u32) -> Option<TouchControl> {
    match value {
        1..=8 => direction(value - 1).map(TouchControl::Direction),
        9 => Some(TouchControl::Confirm),
        10 => Some(TouchControl::Cancel),
        11 => Some(TouchControl::Inventory),
        12 => Some(TouchControl::Examine),
        13 => Some(TouchControl::Pickup),
        14 => Some(TouchControl::Pause),
        15 => Some(TouchControl::WaitMinutes),
        16 => Some(TouchControl::SaveQuit),
        _ => None,
    }
}

/// Wire keys are documented native keyboard inputs, not engine action injection.
/// The original engine still selects its real active context and user bindings.
fn wire_key(command: &Command) -> u32 {
    match command {
        Command::Game(GameAction::Move(d)) | Command::Ui(UiAction::Navigate(d)) => match d {
            Direction::North => 1,
            Direction::NorthEast => 2,
            Direction::East => 3,
            Direction::SouthEast => 4,
            Direction::South => 5,
            Direction::SouthWest => 6,
            Direction::West => 7,
            Direction::NorthWest => 8,
        },
        Command::Ui(UiAction::Confirm) => 9,
        Command::Ui(UiAction::Cancel) => 10,
        Command::Game(GameAction::Inventory) => 11,
        Command::Game(GameAction::Examine) => 12,
        Command::Game(GameAction::Pickup) => 13,
        Command::Game(GameAction::Pause) => 14,
        Command::Game(GameAction::WaitMinutes) => 15,
        Command::Game(GameAction::SaveQuit) => 16,
        Command::UserText(_) => 0,
    }
}

// SAFETY: Every export uses a unique cdda_bridge_ symbol in a standalone WASM
// module. Arguments are numeric values, validated before use. No raw pointer is
// accepted or dereferenced. These unsafe attributes only control symbol names.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_abi_version() -> u32 {
    1
}

/// Number of compiled semantic IDs, independently checked by the host manifest.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_text_count() -> usize {
    TEXT_IDS.len()
}

/// Read-only static semantic ID address; zero for an invalid index.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_text_id_ptr(index: u32) -> usize {
    usize::try_from(index)
        .ok()
        .and_then(|index| TEXT_IDS.get(index))
        .map_or(0, |id| id.as_ptr() as usize)
}

/// Byte length of a static semantic ID; zero for an invalid index.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_text_id_len(index: u32) -> usize {
    usize::try_from(index)
        .ok()
        .and_then(|index| TEXT_IDS.get(index))
        .map_or(0, |id| id.len())
}

/// Load immutable source-backed bindings and strict catalogs before host use.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_init() -> u32 {
    u32::from(bindings().is_some() && catalog(0).is_some() && catalog(1).is_some())
}

/// Return zero for unsupported context/control or an initialization error.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_touch(context_id: u32, control_id: u32) -> u32 {
    let Some((bindings, context, control)) = bindings()
        .zip(context(context_id))
        .zip(touch_control(control_id))
        .map(|((bindings, context), control)| (bindings, context, control))
    else {
        return 0;
    };
    bindings
        .touch(context, control)
        .as_ref()
        .map_or(0, wire_key)
}

/// Convert only stable observed JOY button bindings; unsupported buttons return 0.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_gamepad_button(context_id: u32, button: u32) -> u32 {
    let Some((bindings, context, button)) = bindings()
        .zip(context(context_id))
        .zip(u8::try_from(button).ok())
        .map(|((bindings, context), button)| (bindings, context, button))
    else {
        return 0;
    };
    bindings
        .gamepad(context, StandardGamepad::Button(button))
        .ok()
        .flatten()
        .as_ref()
        .map_or(0, wire_key)
}

/// Direction indices are clockwise: north=0 through north-west=7.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_gamepad_direction(context_id: u32, direction_id: u32) -> u32 {
    let Some((bindings, context, direction)) = bindings()
        .zip(context(context_id))
        .zip(direction(direction_id))
        .map(|((bindings, context), direction)| (bindings, context, direction))
    else {
        return 0;
    };
    bindings
        .gamepad(context, StandardGamepad::Direction(direction))
        .ok()
        .flatten()
        .as_ref()
        .map_or(0, wire_key)
}

/// Clear the private formatter scratch area. This never changes engine state.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_text_reset() {
    SCRATCH.with_borrow_mut(|scratch| {
        scratch.reason.clear();
        scratch.output.clear();
    });
}

/// Append one validated Unicode scalar; no UTF-8 input pointer is required.
/// Status: 0=success, 1=invalid scalar, 2=the 64 KiB text limit would be exceeded.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_text_push_scalar(value: u32) -> u32 {
    let Some(character) = char::from_u32(value) else {
        return 1;
    };
    SCRATCH.with_borrow_mut(|scratch| {
        if scratch.reason.len() + character.len_utf8() > MAX_REASON_BYTES {
            return 2;
        }
        scratch.reason.push(character);
        0
    })
}

/// Format one strict shell/static control entry. Counts arrive as u64 halves.
/// Status: 0=success, 1=bad locale, 2=bad text ID, 3=invalid catalog/event.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_text_prepare(
    locale: u32,
    text_index: u32,
    first_low: u32,
    first_high: u32,
    second_low: u32,
    second_high: u32,
) -> u32 {
    SCRATCH.with_borrow_mut(|scratch| {
        scratch.output.clear();
        let Some(catalog) = catalog(locale) else {
            return 1;
        };
        let Some(id) = usize::try_from(text_index)
            .ok()
            .and_then(|index| TEXT_IDS.get(index))
        else {
            return 2;
        };
        let Ok(text_id) = TextId::new(*id) else {
            return 3;
        };
        let first = u64::from(first_low) | (u64::from(first_high) << 32);
        let second = u64::from(second_low) | (u64::from(second_high) << 32);
        let parameters = match *id {
            "runtime.preparing" => BTreeMap::from([
                ("completed".into(), ParameterValue::Count(first)),
                ("total".into(), ParameterValue::Count(second)),
            ]),
            "save.exported" => BTreeMap::from([
                ("count".into(), ParameterValue::Count(first)),
                ("bytes".into(), ParameterValue::Count(second)),
            ]),
            "runtime.failure" | "save.failed" => BTreeMap::from([(
                "reason".into(),
                ParameterValue::UserText(scratch.reason.clone()),
            )]),
            _ => BTreeMap::new(),
        };
        match catalog.format(&TextEvent {
            id: text_id,
            parameters,
        }) {
            Ok(text) => {
                scratch.output = text;
                0
            }
            Err(_) => 3,
        }
    })
}

/// A read-only address into this module's memory, valid until the next text call.
/// Hosts must bounds-check and copy the bytes immediately; never write through it.
/// No Rust raw-pointer read or dereference occurs here.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_text_ptr() -> usize {
    SCRATCH.with_borrow(|scratch| scratch.output.as_ptr() as usize)
}

/// Byte length (not a Unicode character count) of the prepared UTF-8 output.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_bridge_text_len() -> usize {
    SCRATCH.with_borrow(|scratch| scratch.output.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use cdda_input::BrowserKey;
    use cdda_presentation::Locale;

    const KEYS: [&str; 16] = [
        "ArrowUp",
        "u",
        "ArrowRight",
        "n",
        "ArrowDown",
        "b",
        "ArrowLeft",
        "y",
        "Enter",
        "Escape",
        "i",
        "e",
        "g",
        ".",
        "|",
        "S",
    ];
    fn format(locale: u32, name: &str, first: u64, second: u64, reason: &str) -> String {
        let index = TEXT_IDS
            .iter()
            .position(|id| *id == name)
            .expect("known ID");
        cdda_bridge_text_reset();
        for character in reason.chars() {
            assert_eq!(cdda_bridge_text_push_scalar(u32::from(character)), 0);
        }
        assert_eq!(
            cdda_bridge_text_prepare(
                locale,
                index as u32,
                first as u32,
                (first >> 32) as u32,
                second as u32,
                (second >> 32) as u32
            ),
            0
        );
        SCRATCH.with_borrow(|scratch| scratch.output.clone())
    }

    #[test]
    fn emitted_keys_resolve_to_the_same_actual_stable_command() {
        let bindings = bindings().expect("source bindings");
        for context_id in 0..=1 {
            let context = context(context_id).expect("context");
            for control_id in 1..=16 {
                let control = touch_control(control_id).expect("control");
                let expected = bindings.touch(context, control);
                let wire = cdda_bridge_touch(context_id, control_id);
                let Some(command) = expected else {
                    assert_eq!(wire, 0);
                    continue;
                };
                let key = KEYS[(wire - 1) as usize];
                let event = BrowserKey {
                    key: key.into(),
                    code: key.into(),
                    shift: key == "S" || key == "|",
                    ctrl: false,
                    alt: false,
                    meta: false,
                    repeat: false,
                    composing: false,
                };
                assert_eq!(
                    bindings.keyboard(context, &event).expect("unambiguous"),
                    Some(command)
                );
            }
        }
    }
    #[test]
    fn pause_wait_save_case_and_unsupported_values_are_distinct() {
        assert_eq!(cdda_bridge_touch(0, 14), 14);
        assert_eq!(cdda_bridge_touch(0, 15), 15);
        assert_eq!(cdda_bridge_touch(0, 16), 16);
        assert_eq!(KEYS[13], ".");
        assert_eq!(KEYS[14], "|");
        assert_eq!(KEYS[15], "S");
        for (context, control) in [
            (3, 1),
            (u32::MAX, 1),
            (0, 0),
            (0, 17),
            (0, u32::MAX),
            (2, 1),
        ] {
            assert_eq!(cdda_bridge_touch(context, control), 0);
        }
        assert_eq!(cdda_bridge_gamepad_button(0, 5), 11);
        assert_eq!(cdda_bridge_gamepad_button(0, 7), 14);
        assert_eq!(cdda_bridge_gamepad_button(1, 0), 0);
        assert_eq!(cdda_bridge_gamepad_button(0, u32::MAX), 0);
    }
    #[test]
    fn shell_catalog_formats_unicode_and_full_width_counts_without_replacement() {
        assert_eq!(cdda_bridge_init(), 1);
        assert_eq!(format(0, "command.save_quit", 0, 0, ""), "保存して終了");
        assert_eq!(
            format(1, "runtime.preparing", 3, 8, ""),
            "Preparing assets (3/8)…"
        );
        let reason = "Alice猫🦀{%s}<script>姓名</script>\0";
        assert_eq!(
            format(0, "runtime.failure", 0, 0, reason),
            format!("起動に失敗しました: {reason}")
        );
        assert_eq!(
            format(1, "save.exported", u64::MAX, u64::MAX, ""),
            format!("Exported {} files ({} bytes).", u64::MAX, u64::MAX)
        );
    }
    #[test]
    fn invalid_scalar_length_and_stale_output_fail_closed() {
        format(0, "command.confirm", 0, 0, "");
        assert_eq!(cdda_bridge_text_prepare(7, 0, 0, 0, 0, 0), 1);
        assert_eq!(cdda_bridge_text_len(), 0);
        assert_eq!(cdda_bridge_text_prepare(0, u32::MAX, 0, 0, 0, 0), 2);
        assert_eq!(cdda_bridge_text_push_scalar(0xd800), 1);
        assert_eq!(cdda_bridge_text_push_scalar(0x110000), 1);
        cdda_bridge_text_reset();
        for _ in 0..MAX_REASON_BYTES / 4 {
            assert_eq!(cdda_bridge_text_push_scalar(u32::from('🦀')), 0);
        }
        assert_eq!(cdda_bridge_text_push_scalar(u32::from('a')), 2);
    }
    #[test]
    fn repeated_inputs_and_rendering_are_stable_without_an_engine_handle() {
        let expected = format(0, "runtime.preparing", 7, 9, "");
        for _ in 0..100 {
            assert_eq!(format(0, "runtime.preparing", 7, 9, ""), expected);
            for direction in 0..8 {
                assert_eq!(cdda_bridge_gamepad_direction(0, direction), direction + 1);
            }
        }
        // Formatting receives scalar values and private scratch text only.
        // Original C++ observations, turns and RNG cannot be accessed here.
        assert_eq!(Locale::default(), Locale::Ja);
    }
}
