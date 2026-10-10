//! Browser-facing input normalization for official DRL 0.10.11a defaults.
//!
//! Source: chaosforgeorg/drl/src/drlkeybindings.pas, commit
//! a6f965072b3a25b768c91dbced00367f1b57d865 (GPL-2.0-only).
//! All 80 upstream enum entries are represented, including the unbound helpers,
//! legacy actions, and six unnamed mouse compatibility entries. Adapter IDs for
//! unnamed entries are explicitly identified by `upstream_id: None`.
//!
//! Numpad aliases are source-backed by fpcvalkyrie/src/vsdlio.pas lines 118-127
//! at engine commit f89735a741a968997656c2d48a003ec569db7f22.
//! This module never changes simulation state or consumes random numbers.
//! A `Command` mapping records a migration contract; it does not imply that the
//! corresponding original gameplay system has been ported.

use crate::logic::{Command, Coord, Panel};
use serde::{Deserialize, Serialize};

/// Original map dimensions, excluding any messages or status panels.
pub const MAP_WIDTH: u8 = 78;
pub const MAP_HEIGHT: u8 = 20;
/// Complete source-matched English input catalog.
pub const EN_INPUT_JSON: &str = include_str!("../locales/input-en.json");
/// Japanese is the presentation default; IDs remain language independent.
pub const JA_INPUT_JSON: &str = include_str!("../locales/input-ja.json");

/// A browser-normalized key, independent of operating system integer codes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Key {
    Escape,
    Enter,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    Home,
    PageUp,
    End,
    PageDown,
    Space,
    Tab,
    Comma,
    Center,
    Letter(char),
    Digit(u8),
}

/// An exact official key chord. Alt and Meta chords have no official defaults.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct KeyChord {
    pub key: Key,
    pub shift: bool,
    pub control: bool,
}

/// Localized keybinding metadata; strings are looked up by semantic ID.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct KeyBinding {
    pub action: InputAction,
    pub id: &'static str,
    pub upstream_symbol: &'static str,
    pub upstream_id: Option<&'static str>,
    pub group_id: &'static str,
    pub upstream_default: &'static str,
    pub default: Option<KeyChord>,
    pub name_id: &'static str,
    pub description_id: &'static str,
}

macro_rules! input_registry {
    ($($variant:ident => ($id:literal, $symbol:literal, $upstream:expr,
       $group:literal, $default_text:literal, $chord:expr,
       $name:literal, $description:literal),)*) => {
        /// Exhaustive official input actions, in their original enum order.
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[repr(u8)]
        pub enum InputAction {
            $(#[serde(rename = $id)] $variant,)*
        }
        /// Exhaustive registry, retaining exact original symbols and defaults.
        pub static KEY_BINDINGS: &[KeyBinding] = &[
            $(KeyBinding {
                action: InputAction::$variant, id: $id, upstream_symbol: $symbol,
                upstream_id: $upstream, group_id: $group,
                upstream_default: $default_text, default: $chord,
                name_id: $name, description_id: $description,
            },)*
        ];
    };
}

input_registry! {
    None => ("input_none", "INPUT_NONE", None, "keybindings_adapter", "0", None, "input_none.name", "input_none.description"),
    Escape => ("input_escape", "INPUT_ESCAPE", Some("input_escape"), "keybindings_hidden", "VKEY_ESCAPE", Some(KeyChord { key: Key::Escape, shift: false, control: false }), "input_escape.name", "input_escape.description"),
    Ok => ("input_ok", "INPUT_OK", Some("input_ok"), "keybindings_hidden", "VKEY_ENTER", Some(KeyChord { key: Key::Enter, shift: false, control: false }), "input_ok.name", "input_ok.description"),
    WalkLeft => ("input_walkleft", "INPUT_WALKLEFT", Some("input_walkleft"), "keybindings_movement", "VKEY_LEFT", Some(KeyChord { key: Key::ArrowLeft, shift: false, control: false }), "input_walkleft.name", "input_walkleft.description"),
    WalkRight => ("input_walkright", "INPUT_WALKRIGHT", Some("input_walkright"), "keybindings_movement", "VKEY_RIGHT", Some(KeyChord { key: Key::ArrowRight, shift: false, control: false }), "input_walkright.name", "input_walkright.description"),
    WalkUp => ("input_walkup", "INPUT_WALKUP", Some("input_walkup"), "keybindings_movement", "VKEY_UP", Some(KeyChord { key: Key::ArrowUp, shift: false, control: false }), "input_walkup.name", "input_walkup.description"),
    WalkDown => ("input_walkdown", "INPUT_WALKDOWN", Some("input_walkdown"), "keybindings_movement", "VKEY_DOWN", Some(KeyChord { key: Key::ArrowDown, shift: false, control: false }), "input_walkdown.name", "input_walkdown.description"),
    WalkUpLeft => ("input_walkupleft", "INPUT_WALKUPLEFT", Some("input_walkupleft"), "keybindings_movement", "VKEY_HOME", Some(KeyChord { key: Key::Home, shift: false, control: false }), "input_walkupleft.name", "input_walkupleft.description"),
    WalkUpRight => ("input_walkupright", "INPUT_WALKUPRIGHT", Some("input_walkupright"), "keybindings_movement", "VKEY_PGUP", Some(KeyChord { key: Key::PageUp, shift: false, control: false }), "input_walkupright.name", "input_walkupright.description"),
    WalkDownLeft => ("input_walkdownleft", "INPUT_WALKDOWNLEFT", Some("input_walkdownleft"), "keybindings_movement", "VKEY_END", Some(KeyChord { key: Key::End, shift: false, control: false }), "input_walkdownleft.name", "input_walkdownleft.description"),
    WalkDownRight => ("input_walkdownright", "INPUT_WALKDOWNRIGHT", Some("input_walkdownright"), "keybindings_movement", "VKEY_PGDOWN", Some(KeyChord { key: Key::PageDown, shift: false, control: false }), "input_walkdownright.name", "input_walkdownright.description"),
    Wait => ("input_wait", "INPUT_WAIT", Some("input_wait"), "keybindings_movement", "VKEY_W", Some(KeyChord { key: Key::Letter('w'), shift: false, control: false }), "input_wait.name", "input_wait.description"),
    Run => ("input_run", "INPUT_RUN", Some("input_run"), "keybindings_movement", "VKEY_COMMA", Some(KeyChord { key: Key::Comma, shift: false, control: false }), "input_run.name", "input_run.description"),
    RunLeft => ("input_runleft", "INPUT_RUNLEFT", Some("input_runleft"), "keybindings_running", "VKEY_LEFT + IOKeyCodeShiftMask", Some(KeyChord { key: Key::ArrowLeft, shift: true, control: false }), "input_runleft.name", "input_runleft.description"),
    RunRight => ("input_runright", "INPUT_RUNRIGHT", Some("input_runright"), "keybindings_running", "VKEY_RIGHT + IOKeyCodeShiftMask", Some(KeyChord { key: Key::ArrowRight, shift: true, control: false }), "input_runright.name", "input_runright.description"),
    RunUp => ("input_runup", "INPUT_RUNUP", Some("input_runup"), "keybindings_running", "VKEY_UP + IOKeyCodeShiftMask", Some(KeyChord { key: Key::ArrowUp, shift: true, control: false }), "input_runup.name", "input_runup.description"),
    RunDown => ("input_rundown", "INPUT_RUNDOWN", Some("input_rundown"), "keybindings_running", "VKEY_DOWN + IOKeyCodeShiftMask", Some(KeyChord { key: Key::ArrowDown, shift: true, control: false }), "input_rundown.name", "input_rundown.description"),
    RunUpLeft => ("input_runupleft", "INPUT_RUNUPLEFT", Some("input_runupleft"), "keybindings_running", "VKEY_HOME + IOKeyCodeShiftMask", Some(KeyChord { key: Key::Home, shift: true, control: false }), "input_runupleft.name", "input_runupleft.description"),
    RunUpRight => ("input_runupright", "INPUT_RUNUPRIGHT", Some("input_runupright"), "keybindings_running", "VKEY_PGUP + IOKeyCodeShiftMask", Some(KeyChord { key: Key::PageUp, shift: true, control: false }), "input_runupright.name", "input_runupright.description"),
    RunDownLeft => ("input_rundownleft", "INPUT_RUNDOWNLEFT", Some("input_rundownleft"), "keybindings_running", "VKEY_END + IOKeyCodeShiftMask", Some(KeyChord { key: Key::End, shift: true, control: false }), "input_rundownleft.name", "input_rundownleft.description"),
    RunDownRight => ("input_rundownright", "INPUT_RUNDOWNRIGHT", Some("input_rundownright"), "keybindings_running", "VKEY_PGDOWN + IOKeyCodeShiftMask", Some(KeyChord { key: Key::PageDown, shift: true, control: false }), "input_rundownright.name", "input_rundownright.description"),
    RunWait => ("input_runwait", "INPUT_RUNWAIT", Some("input_runwait"), "keybindings_running", "VKEY_W + IOKeyCodeShiftMask", Some(KeyChord { key: Key::Letter('w'), shift: true, control: false }), "input_runwait.name", "input_runwait.description"),
    TargetLeft => ("input_targetleft", "INPUT_TARGETLEFT", Some("input_targetleft"), "keybindings_target", "VKEY_LEFT + IOKeyCodeCtrlMask", Some(KeyChord { key: Key::ArrowLeft, shift: false, control: true }), "input_targetleft.name", "input_targetleft.description"),
    TargetRight => ("input_targetright", "INPUT_TARGETRIGHT", Some("input_targetright"), "keybindings_target", "VKEY_RIGHT + IOKeyCodeCtrlMask", Some(KeyChord { key: Key::ArrowRight, shift: false, control: true }), "input_targetright.name", "input_targetright.description"),
    TargetUp => ("input_targetup", "INPUT_TARGETUP", Some("input_targetup"), "keybindings_target", "VKEY_UP + IOKeyCodeCtrlMask", Some(KeyChord { key: Key::ArrowUp, shift: false, control: true }), "input_targetup.name", "input_targetup.description"),
    TargetDown => ("input_targetdown", "INPUT_TARGETDOWN", Some("input_targetdown"), "keybindings_target", "VKEY_DOWN + IOKeyCodeCtrlMask", Some(KeyChord { key: Key::ArrowDown, shift: false, control: true }), "input_targetdown.name", "input_targetdown.description"),
    TargetUpLeft => ("input_targetupleft", "INPUT_TARGETUPLEFT", Some("input_targetupleft"), "keybindings_target", "VKEY_HOME + IOKeyCodeCtrlMask", Some(KeyChord { key: Key::Home, shift: false, control: true }), "input_targetupleft.name", "input_targetupleft.description"),
    TargetUpRight => ("input_targetupright", "INPUT_TARGETUPRIGHT", Some("input_targetupright"), "keybindings_target", "VKEY_PGUP + IOKeyCodeCtrlMask", Some(KeyChord { key: Key::PageUp, shift: false, control: true }), "input_targetupright.name", "input_targetupright.description"),
    TargetDownLeft => ("input_targetdownleft", "INPUT_TARGETDOWNLEFT", Some("input_targetdownleft"), "keybindings_target", "VKEY_END + IOKeyCodeCtrlMask", Some(KeyChord { key: Key::End, shift: false, control: true }), "input_targetdownleft.name", "input_targetdownleft.description"),
    TargetDownRight => ("input_targetdownright", "INPUT_TARGETDOWNRIGHT", Some("input_targetdownright"), "keybindings_target", "VKEY_PGDOWN + IOKeyCodeCtrlMask", Some(KeyChord { key: Key::PageDown, shift: false, control: true }), "input_targetdownright.name", "input_targetdownright.description"),
    Action => ("input_action", "INPUT_ACTION", Some("input_action"), "keybindings_actions", "VKEY_SPACE", Some(KeyChord { key: Key::Space, shift: false, control: false }), "input_action.name", "input_action.description"),
    Fire => ("input_fire", "INPUT_FIRE", Some("input_fire"), "keybindings_actions", "VKEY_F", Some(KeyChord { key: Key::Letter('f'), shift: false, control: false }), "input_fire.name", "input_fire.description"),
    Target => ("input_target", "INPUT_TARGET", Some("input_target"), "keybindings_actions", "VKEY_T", Some(KeyChord { key: Key::Letter('t'), shift: false, control: false }), "input_target.name", "input_target.description"),
    TargetNext => ("input_targetnext", "INPUT_TARGETNEXT", Some("input_targetnext"), "keybindings_actions", "VKEY_TAB", Some(KeyChord { key: Key::Tab, shift: false, control: false }), "input_targetnext.name", "input_targetnext.description"),
    Reload => ("input_reload", "INPUT_RELOAD", Some("input_reload"), "keybindings_actions", "VKEY_R", Some(KeyChord { key: Key::Letter('r'), shift: false, control: false }), "input_reload.name", "input_reload.description"),
    Pickup => ("input_pickup", "INPUT_PICKUP", Some("input_pickup"), "keybindings_actions", "VKEY_G", Some(KeyChord { key: Key::Letter('g'), shift: false, control: false }), "input_pickup.name", "input_pickup.description"),
    LookMode => ("input_lookmode", "INPUT_LOOKMODE", Some("input_lookmode"), "keybindings_actions", "VKEY_L", Some(KeyChord { key: Key::Letter('l'), shift: false, control: false }), "input_lookmode.name", "input_lookmode.description"),
    SwapWeapon => ("input_swapweapon", "INPUT_SWAPWEAPON", Some("input_swapweapon"), "keybindings_actions", "VKEY_Z", Some(KeyChord { key: Key::Letter('z'), shift: false, control: false }), "input_swapweapon.name", "input_swapweapon.description"),
    Active => ("input_active", "INPUT_ACTIVE", Some("input_active"), "keybindings_actions", "VKEY_X", Some(KeyChord { key: Key::Letter('x'), shift: false, control: false }), "input_active.name", "input_active.description"),
    Unload => ("input_unload", "INPUT_UNLOAD", Some("input_unload"), "keybindings_actions", "VKEY_U", Some(KeyChord { key: Key::Letter('u'), shift: false, control: false }), "input_unload.name", "input_unload.description"),
    AltPickup => ("input_altpickup", "INPUT_ALTPICKUP", Some("input_altpickup"), "keybindings_actions", "VKEY_G + IOKeyCodeShiftMask", Some(KeyChord { key: Key::Letter('g'), shift: true, control: false }), "input_altpickup.name", "input_altpickup.description"),
    AltFire => ("input_altfire", "INPUT_ALTFIRE", Some("input_altfire"), "keybindings_actions", "VKEY_F + IOKeyCodeShiftMask", Some(KeyChord { key: Key::Letter('f'), shift: true, control: false }), "input_altfire.name", "input_altfire.description"),
    AltTarget => ("input_alttarget", "INPUT_ALTTARGET", Some("input_alttarget"), "keybindings_actions", "VKEY_T + IOKeyCodeShiftMask", Some(KeyChord { key: Key::Letter('t'), shift: true, control: false }), "input_alttarget.name", "input_alttarget.description"),
    AltReload => ("input_altreload", "INPUT_ALTRELOAD", Some("input_altreload"), "keybindings_actions", "VKEY_R + IOKeyCodeShiftMask", Some(KeyChord { key: Key::Letter('r'), shift: true, control: false }), "input_altreload.name", "input_altreload.description"),
    Help => ("input_help", "INPUT_HELP", Some("input_help"), "keybindings_ui", "VKEY_H", Some(KeyChord { key: Key::Letter('h'), shift: false, control: false }), "input_help.name", "input_help.description"),
    Inventory => ("input_inventory", "INPUT_INVENTORY", Some("input_inventory"), "keybindings_ui", "VKEY_I", Some(KeyChord { key: Key::Letter('i'), shift: false, control: false }), "input_inventory.name", "input_inventory.description"),
    Equipment => ("input_equipment", "INPUT_EQUIPMENT", Some("input_equipment"), "keybindings_ui", "VKEY_E", Some(KeyChord { key: Key::Letter('e'), shift: false, control: false }), "input_equipment.name", "input_equipment.description"),
    Traits => ("input_trait", "INPUT_TRAITS", Some("input_trait"), "keybindings_ui", "VKEY_Y", Some(KeyChord { key: Key::Letter('y'), shift: false, control: false }), "input_trait.name", "input_trait.description"),
    PlayerInfo => ("input_playerinfo", "INPUT_PLAYERINFO", Some("input_playerinfo"), "keybindings_ui", "VKEY_P", Some(KeyChord { key: Key::Letter('p'), shift: false, control: false }), "input_playerinfo.name", "input_playerinfo.description"),
    Messages => ("input_messages", "INPUT_MESSAGES", Some("input_messages"), "keybindings_ui", "VKEY_S", Some(KeyChord { key: Key::Letter('s'), shift: false, control: false }), "input_messages.name", "input_messages.description"),
    Assemblies => ("input_assemblies", "INPUT_ASSEMBLIES", Some("input_assemblies"), "keybindings_ui", "VKEY_A", Some(KeyChord { key: Key::Letter('a'), shift: false, control: false }), "input_assemblies.name", "input_assemblies.description"),
    More => ("input_more", "INPUT_MORE", Some("input_more"), "keybindings_ui", "VKEY_M", Some(KeyChord { key: Key::Letter('m'), shift: false, control: false }), "input_more.name", "input_more.description"),
    MoreSelf => ("input_selfmore", "INPUT_MORESELF", Some("input_selfmore"), "keybindings_ui", "VKEY_M + IOKeyCodeShiftMask", Some(KeyChord { key: Key::Letter('m'), shift: true, control: false }), "input_selfmore.name", "input_selfmore.description"),
    QuickKey1 => ("input_quickkey_1", "INPUT_QUICKKEY_1", Some("input_quickkey_1"), "keybindings_helper", "VKEY_1", Some(KeyChord { key: Key::Digit(1), shift: false, control: false }), "input_quickkey_1.name", "input_quickkey_1.description"),
    QuickKey2 => ("input_quickkey_2", "INPUT_QUICKKEY_2", Some("input_quickkey_2"), "keybindings_helper", "VKEY_2", Some(KeyChord { key: Key::Digit(2), shift: false, control: false }), "input_quickkey_2.name", "input_quickkey_2.description"),
    QuickKey3 => ("input_quickkey_3", "INPUT_QUICKKEY_3", Some("input_quickkey_3"), "keybindings_helper", "VKEY_3", Some(KeyChord { key: Key::Digit(3), shift: false, control: false }), "input_quickkey_3.name", "input_quickkey_3.description"),
    QuickKey4 => ("input_quickkey_4", "INPUT_QUICKKEY_4", Some("input_quickkey_4"), "keybindings_helper", "VKEY_4", Some(KeyChord { key: Key::Digit(4), shift: false, control: false }), "input_quickkey_4.name", "input_quickkey_4.description"),
    QuickKey5 => ("input_quickkey_5", "INPUT_QUICKKEY_5", Some("input_quickkey_5"), "keybindings_helper", "VKEY_5", Some(KeyChord { key: Key::Digit(5), shift: false, control: false }), "input_quickkey_5.name", "input_quickkey_5.description"),
    QuickKey6 => ("input_quickkey_6", "INPUT_QUICKKEY_6", Some("input_quickkey_6"), "keybindings_helper", "VKEY_6", Some(KeyChord { key: Key::Digit(6), shift: false, control: false }), "input_quickkey_6.name", "input_quickkey_6.description"),
    QuickKey7 => ("input_quickkey_7", "INPUT_QUICKKEY_7", Some("input_quickkey_7"), "keybindings_helper", "VKEY_7", Some(KeyChord { key: Key::Digit(7), shift: false, control: false }), "input_quickkey_7.name", "input_quickkey_7.description"),
    QuickKey8 => ("input_quickkey_8", "INPUT_QUICKKEY_8", Some("input_quickkey_8"), "keybindings_helper", "VKEY_8", Some(KeyChord { key: Key::Digit(8), shift: false, control: false }), "input_quickkey_8.name", "input_quickkey_8.description"),
    QuickKey9 => ("input_quickkey_9", "INPUT_QUICKKEY_9", Some("input_quickkey_9"), "keybindings_helper", "VKEY_9", Some(KeyChord { key: Key::Digit(9), shift: false, control: false }), "input_quickkey_9.name", "input_quickkey_9.description"),
    SoundToggle => ("input_soundtoggle", "INPUT_SOUNDTOGGLE", Some("input_soundtoggle"), "keybindings_helper", "0", None, "input_soundtoggle.name", "input_soundtoggle.description"),
    MusicToggle => ("input_musictoggle", "INPUT_MUSICTOGGLE", Some("input_musictoggle"), "keybindings_helper", "0", None, "input_musictoggle.name", "input_musictoggle.description"),
    ToggleGrid => ("input_togglegrid", "INPUT_TOGGLEGRID", Some("input_togglegrid"), "keybindings_helper", "0", None, "input_togglegrid.name", "input_togglegrid.description"),
    ExamineNpc => ("input_examinenpc", "INPUT_EXAMINENPC", Some("input_examinenpc"), "keybindings_helper", "0", None, "input_examinenpc.name", "input_examinenpc.description"),
    ExamineItem => ("input_examineitem", "INPUT_EXAMINEITEM", Some("input_examineitem"), "keybindings_helper", "0", None, "input_examineitem.name", "input_examineitem.description"),
    LegacyOpen => ("input_legacyopen", "INPUT_LEGACYOPEN", Some("input_legacyopen"), "keybindings_legacy", "0", None, "input_legacyopen.name", "input_legacyopen.description"),
    LegacyClose => ("input_legacyclose", "INPUT_LEGACYCLOSE", Some("input_legacyclose"), "keybindings_legacy", "0", None, "input_legacyclose.name", "input_legacyclose.description"),
    LegacyDrop => ("input_legacydrop", "INPUT_LEGACYDROP", Some("input_legacydrop"), "keybindings_legacy", "0", None, "input_legacydrop.name", "input_legacydrop.description"),
    LegacyUse => ("input_legacyuse", "INPUT_LEGACYUSE", Some("input_legacyuse"), "keybindings_legacy", "0", None, "input_legacyuse.name", "input_legacyuse.description"),
    LegacySave => ("input_legacysave", "INPUT_LEGACYSAVE", Some("input_legacysave"), "keybindings_legacy", "0", None, "input_legacysave.name", "input_legacysave.description"),
    Quit => ("input_legacyquit", "INPUT_QUIT", Some("input_legacyquit"), "keybindings_legacy", "0", None, "input_legacyquit.name", "input_legacyquit.description"),
    HardQuit => ("input_legacyhardquit", "INPUT_HARDQUIT", Some("input_legacyhardquit"), "keybindings_legacy", "0", None, "input_legacyhardquit.name", "input_legacyhardquit.description"),
    MouseMove => ("input_mousemove", "INPUT_MMOVE", None, "keybindings_adapter", "0", None, "input_mousemove.name", "input_mousemove.description"),
    MouseRight => ("input_mright", "INPUT_MRIGHT", None, "keybindings_adapter", "0", None, "input_mright.name", "input_mright.description"),
    MouseMiddle => ("input_mmiddle", "INPUT_MMIDDLE", None, "keybindings_adapter", "0", None, "input_mmiddle.name", "input_mmiddle.description"),
    MouseLeft => ("input_mleft", "INPUT_MLEFT", None, "keybindings_adapter", "0", None, "input_mleft.name", "input_mleft.description"),
    MouseScrollUp => ("input_mscrup", "INPUT_MSCRUP", None, "keybindings_adapter", "0", None, "input_mscrup.name", "input_mscrup.description"),
    MouseScrollDown => ("input_mscrdown", "INPUT_MSCRDOWN", None, "keybindings_adapter", "0", None, "input_mscrdown.name", "input_mscrdown.description"),
}

/// All keybindings in their official enum order.
#[must_use]
pub fn registry() -> &'static [KeyBinding] {
    KEY_BINDINGS
}

/// What is available at this input boundary, independent of gameplay parity.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InputCoverage {
    /// A domain command contract exists; its engine may still be unported.
    CommandAvailable,
    /// No equivalent command has yet been added for this original action.
    NeedsEngineCommand,
    /// This input requires pointer coordinates in addition to the action ID.
    PointerCoordinates,
    /// The upstream sentinel performs no action.
    NoAction,
}

impl InputAction {
    /// Stable source ID, or an explicit adapter ID for an unnamed source entry.
    #[must_use]
    pub fn id(self) -> &'static str {
        self.binding().id
    }

    /// Original default and semantic text IDs.
    #[must_use]
    pub fn binding(self) -> &'static KeyBinding {
        &KEY_BINDINGS[self as usize]
    }

    /// Convert supported semantic actions to the current domain command contract.
    /// Unported actions remain distinct and never silently become another action.
    #[must_use]
    pub fn command(self) -> Option<Command> {
        use InputAction::*;
        Some(match self {
            Escape => Command::Cancel,
            Ok => Command::Confirm,
            WalkLeft => walk(-1, 0, false),
            WalkRight => walk(1, 0, false),
            WalkUp => walk(0, -1, false),
            WalkDown => walk(0, 1, false),
            WalkUpLeft => walk(-1, -1, false),
            WalkUpRight => walk(1, -1, false),
            WalkDownLeft => walk(-1, 1, false),
            WalkDownRight => walk(1, 1, false),
            Wait => Command::Wait { run: false },
            RunLeft => walk(-1, 0, true),
            RunRight => walk(1, 0, true),
            RunUp => walk(0, -1, true),
            RunDown => walk(0, 1, true),
            RunUpLeft => walk(-1, -1, true),
            RunUpRight => walk(1, -1, true),
            RunDownLeft => walk(-1, 1, true),
            RunDownRight => walk(1, 1, true),
            RunWait => Command::Wait { run: true },
            Action => Command::Action,
            Fire => Command::Fire { alternate: false },
            AltFire => Command::Fire { alternate: true },
            Target => Command::Target { alternate: false },
            AltTarget => Command::Target { alternate: true },
            TargetNext => Command::TargetNext,
            Reload => Command::Reload { alternate: false },
            AltReload => Command::Reload { alternate: true },
            Pickup => Command::Pickup { alternate: false },
            AltPickup => Command::Pickup { alternate: true },
            LookMode => Command::Look,
            SwapWeapon => Command::SwapWeapon,
            Active => Command::Active,
            Unload => Command::Unload,
            Help => Command::OpenPanel { panel: Panel::Help },
            Inventory => Command::OpenPanel {
                panel: Panel::Inventory,
            },
            Equipment => Command::OpenPanel {
                panel: Panel::Equipment,
            },
            Traits => Command::OpenPanel {
                panel: Panel::Traits,
            },
            PlayerInfo => Command::OpenPanel {
                panel: Panel::Player,
            },
            Messages => Command::OpenPanel {
                panel: Panel::Messages,
            },
            Assemblies => Command::OpenPanel {
                panel: Panel::Assemblies,
            },
            More => Command::OpenPanel { panel: Panel::More },
            QuickKey1 => Command::QuickKey { slot: 1 },
            QuickKey2 => Command::QuickKey { slot: 2 },
            QuickKey3 => Command::QuickKey { slot: 3 },
            QuickKey4 => Command::QuickKey { slot: 4 },
            QuickKey5 => Command::QuickKey { slot: 5 },
            QuickKey6 => Command::QuickKey { slot: 6 },
            QuickKey7 => Command::QuickKey { slot: 7 },
            QuickKey8 => Command::QuickKey { slot: 8 },
            QuickKey9 => Command::QuickKey { slot: 9 },
            LegacySave => Command::Save,
            None | Run | TargetLeft | TargetRight | TargetUp | TargetDown | TargetUpLeft
            | TargetUpRight | TargetDownLeft | TargetDownRight | MoreSelf | SoundToggle
            | MusicToggle | ToggleGrid | ExamineNpc | ExamineItem | LegacyOpen | LegacyClose
            | LegacyDrop | LegacyUse | Quit | HardQuit | MouseMove | MouseRight | MouseMiddle
            | MouseLeft | MouseScrollUp | MouseScrollDown => return Option::None,
        })
    }

    /// Report incomplete command coverage without losing the original input.
    #[must_use]
    pub fn coverage(self) -> InputCoverage {
        match self {
            Self::None => InputCoverage::NoAction,
            Self::MouseMove
            | Self::MouseRight
            | Self::MouseMiddle
            | Self::MouseLeft
            | Self::MouseScrollUp
            | Self::MouseScrollDown => InputCoverage::PointerCoordinates,
            action if action.command().is_some() => InputCoverage::CommandAvailable,
            _ => InputCoverage::NeedsEngineCommand,
        }
    }
}

fn walk(dx: i8, dy: i8, run: bool) -> Command {
    Command::Walk { dx, dy, run }
}

/// A minimal DTO copied from a browser KeyboardEvent plus editable-target state.
/// Event strings are retained verbatim; no localization is applied to user text.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
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

/// Decode exact official defaults. The caller prevents the browser default only
/// when an action is returned. Composing/IME, editable targets and Alt/Meta
/// shortcuts are left to the browser. Keyboard repeat is retained in the DTO
/// and accepted: scheduling repeated turns belongs to the application layer.
///
/// Numpad `code`/`location` are retained, and the verified upstream SDL keypad
/// aliases are applied regardless of NumLock. Numpad5 maps to VKEY_CENTER, which
/// has no default binding. Top-row digits retain their quickkey meaning.
/// No vi movement aliases are invented by this source-only port.
#[must_use]
pub fn keyboard(event: &KeyboardEvent) -> Option<InputAction> {
    if event.editable_target
        || event.is_composing
        || event.key_code == 229
        || event.alt_key
        || event.meta_key
    {
        return None;
    }
    let key = normalize_key(event)?;
    let chord = KeyChord {
        key,
        shift: event.shift_key,
        control: event.ctrl_key,
    };
    KEY_BINDINGS
        .iter()
        .find(|entry| entry.default == Some(chord))
        .map(|entry| entry.action)
}

fn normalize_key(event: &KeyboardEvent) -> Option<Key> {
    // Exact SDLKeyToIOKeyCode aliases from the pinned upstream vsdlio.pas.
    // Physical keypad identity wins over NumLock-dependent browser key text.
    let keypad = match event.code.as_str() {
        "Numpad1" => Some(Key::End),
        "Numpad2" => Some(Key::ArrowDown),
        "Numpad3" => Some(Key::PageDown),
        "Numpad4" => Some(Key::ArrowLeft),
        "Numpad5" => Some(Key::Center),
        "Numpad6" => Some(Key::ArrowRight),
        "Numpad7" => Some(Key::Home),
        "Numpad8" => Some(Key::ArrowUp),
        "Numpad9" => Some(Key::PageUp),
        "NumpadEnter" => Some(Key::Enter),
        _ => None,
    };
    if keypad.is_some() || event.code.starts_with("Numpad") {
        return keypad;
    }
    let key = match event.key.as_str() {
        "Escape" => Key::Escape,
        "Enter" => Key::Enter,
        "ArrowLeft" => Key::ArrowLeft,
        "ArrowRight" => Key::ArrowRight,
        "ArrowUp" => Key::ArrowUp,
        "ArrowDown" => Key::ArrowDown,
        "Home" => Key::Home,
        "PageUp" => Key::PageUp,
        "End" => Key::End,
        "PageDown" => Key::PageDown,
        " " => Key::Space,
        "Tab" => Key::Tab,
        "," => Key::Comma,
        text if text.len() == 1 => {
            let value = text.as_bytes()[0];
            if value.is_ascii_alphabetic() {
                Key::Letter(char::from(value.to_ascii_lowercase()))
            } else if (b'1'..=b'9').contains(&value)
                && event.location != 3
                && !event.code.starts_with("Numpad")
            {
                Key::Digit(value - b'0')
            } else {
                return None;
            }
        }
        _ => return None,
    };
    Some(key)
}

/// Actual map rectangle in CSS client coordinates. Supply the map area only,
/// excluding headers/status panels; device-pixel scaling is already accounted
/// for by the browser's client coordinates and getBoundingClientRect().
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct ViewportRect {
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
}

/// Zero-based visual map position; convert explicitly to one-based domain Coord.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MapPosition {
    pub x: u8,
    pub y: u8,
}

impl MapPosition {
    /// Convert a valid visual position to the original one-based domain map.
    /// Invalid externally constructed positions are rejected.
    #[must_use]
    pub fn coord(self) -> Option<Coord> {
        if self.x >= MAP_WIDTH || self.y >= MAP_HEIGHT {
            return None;
        }
        Some(Coord {
            x: i16::from(self.x) + 1,
            y: i16::from(self.y) + 1,
        })
    }
}

/// Convert finite CSS client coordinates to a map cell, with half-open edges.
/// Invalid rectangles, NaNs, infinities and positions outside the map are rejected.
#[must_use]
pub fn map_position(rect: ViewportRect, client_x: f64, client_y: f64) -> Option<MapPosition> {
    if ![
        rect.left,
        rect.top,
        rect.width,
        rect.height,
        client_x,
        client_y,
    ]
    .iter()
    .all(|v| v.is_finite())
        || rect.width <= 0.0
        || rect.height <= 0.0
    {
        return None;
    }
    let relative_x = client_x - rect.left;
    let relative_y = client_y - rect.top;
    if !(0.0..rect.width).contains(&relative_x) || !(0.0..rect.height).contains(&relative_y) {
        return None;
    }
    let x = (relative_x / rect.width * f64::from(MAP_WIDTH)).floor();
    let y = (relative_y / rect.height * f64::from(MAP_HEIGHT)).floor();
    // Arithmetic rounding at the far edge must not leak an out-of-map coordinate.
    if x >= f64::from(MAP_WIDTH) || y >= f64::from(MAP_HEIGHT) {
        return None;
    }
    Some(MapPosition {
        x: x as u8,
        y: y as u8,
    })
}

/// Browser pointer kinds that have an original compatibility action.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PointerKind {
    Move,
    Down,
    Wheel,
}

/// Browser pointer event DTO. Touch map taps use button 0 and PointerKind::Down.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointerEvent {
    pub kind: PointerKind,
    pub client_x: f64,
    pub client_y: f64,
    pub button: i16,
    pub delta_y: f64,
}

/// A pointer action with its required map coordinate, preserving source semantics.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PointerInput {
    pub action: InputAction,
    pub position: MapPosition,
}

/// Decode pointer compatibility actions without moving, firing, or simulating.
#[must_use]
pub fn pointer(event: &PointerEvent, rect: ViewportRect) -> Option<PointerInput> {
    let position = map_position(rect, event.client_x, event.client_y)?;
    let action = match event.kind {
        PointerKind::Move => InputAction::MouseMove,
        PointerKind::Down => match event.button {
            0 => InputAction::MouseLeft,
            1 => InputAction::MouseMiddle,
            2 => InputAction::MouseRight,
            _ => return None,
        },
        PointerKind::Wheel if event.delta_y.is_finite() && event.delta_y < 0.0 => {
            InputAction::MouseScrollUp
        }
        PointerKind::Wheel if event.delta_y.is_finite() && event.delta_y > 0.0 => {
            InputAction::MouseScrollDown
        }
        PointerKind::Wheel => return None,
    };
    Some(PointerInput { action, position })
}

/// Explicit touch control intent. Mobile controls use semantic actions, never
/// fabricated keyboard events; directions are constrained to the eight neighbors.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TouchAction {
    Move { dx: i8, dy: i8, run: bool },
    Wait { run: bool },
    Action,
    Fire { alternate: bool },
    Target { alternate: bool },
    Reload { alternate: bool },
    Pickup { alternate: bool },
    Inventory,
    Equipment,
    Help,
    Confirm,
    Cancel,
}

/// Map a touch control to its original semantic action. Invalid directions fail.
#[must_use]
pub fn touch(action: TouchAction) -> Option<InputAction> {
    use InputAction as A;
    Some(match action {
        TouchAction::Move { dx, dy, run } => match (dx, dy, run) {
            (-1, 0, false) => A::WalkLeft,
            (1, 0, false) => A::WalkRight,
            (0, -1, false) => A::WalkUp,
            (0, 1, false) => A::WalkDown,
            (-1, -1, false) => A::WalkUpLeft,
            (1, -1, false) => A::WalkUpRight,
            (-1, 1, false) => A::WalkDownLeft,
            (1, 1, false) => A::WalkDownRight,
            (-1, 0, true) => A::RunLeft,
            (1, 0, true) => A::RunRight,
            (0, -1, true) => A::RunUp,
            (0, 1, true) => A::RunDown,
            (-1, -1, true) => A::RunUpLeft,
            (1, -1, true) => A::RunUpRight,
            (-1, 1, true) => A::RunDownLeft,
            (1, 1, true) => A::RunDownRight,
            _ => return None,
        },
        TouchAction::Wait { run: false } => A::Wait,
        TouchAction::Wait { run: true } => A::RunWait,
        TouchAction::Action => A::Action,
        TouchAction::Fire { alternate: false } => A::Fire,
        TouchAction::Fire { alternate: true } => A::AltFire,
        TouchAction::Target { alternate: false } => A::Target,
        TouchAction::Target { alternate: true } => A::AltTarget,
        TouchAction::Reload { alternate: false } => A::Reload,
        TouchAction::Reload { alternate: true } => A::AltReload,
        TouchAction::Pickup { alternate: false } => A::Pickup,
        TouchAction::Pickup { alternate: true } => A::AltPickup,
        TouchAction::Inventory => A::Inventory,
        TouchAction::Equipment => A::Equipment,
        TouchAction::Help => A::Help,
        TouchAction::Confirm => A::Ok,
        TouchAction::Cancel => A::Escape,
    })
}
