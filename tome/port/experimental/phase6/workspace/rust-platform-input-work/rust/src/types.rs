// SPDX-License-Identifier: GPL-3.0-or-later
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Modifiers {
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
    pub meta: bool,
    pub caps_lock: bool,
    pub num_lock: bool,
    pub alt_graph: bool,
    pub scroll_lock: bool,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Rect { pub left: f64, pub top: f64, pub width: f64, pub height: f64 }

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Point {
    pub client_x: f64,
    pub client_y: f64,
    pub rect: Rect,
    pub window_width: u32,
    pub window_height: u32,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Phase { Down, Up }

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Input {
    Key { owned_focus: bool, editable: bool, phase: Phase, key: String, code: String,
        repeat: bool, composing: bool, modifiers: Modifiers,
        #[serde(default)] legacy_key_code: u32, #[serde(default)] location: u8 },
    Text { owned_focus: bool, text: String, modifiers: Modifiers },
    Composition { owned_focus: bool, text: String, start: u32, length: u32 },
    MouseMotion { owned_focus: bool, point: Point, relative: bool, movement_x: f64,
        movement_y: f64, buttons: u16, modifiers: Modifiers },
    MouseButton { owned_focus: bool, phase: Phase, button: i16, point: Point, modifiers: Modifiers },
    Wheel { owned_focus: bool, point: Point, delta_x: f64, delta_y: f64, delta_mode: u8,
        modifiers: Modifiers },
    Blur {},
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Packet {
    Key { down: bool, scancode: u32, keycode: i32, modifiers: u32, repeat: bool },
    Text { text: String, modifiers: u32 },
    MouseMotion { relative: bool, x: i32, y: i32, modifiers: u32 },
    MouseButton { down: bool, button: u8, x: i32, y: i32, modifiers: u32 },
    Wheel { x: f32, y: f32, mouse_x: i32, mouse_y: i32, modifiers: u32 },
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Preedit { pub text: String, pub start: u32, pub length: u32 }

#[derive(Debug, Default, Serialize, PartialEq)]
pub struct Mapped {
    pub handled: bool,
    pub prevent_default: bool,
    pub stop_propagation: bool,
    pub packets: Vec<Packet>,
    pub composition: Option<Preedit>,
    pub error_id: Option<&'static str>,
}

impl Mapped {
    pub fn owned(packets: Vec<Packet>) -> Self {
        Self { handled: true, prevent_default: true, stop_propagation: true,
            packets, ..Self::default() }
    }
    pub fn error(id: &'static str) -> Self { Self { error_id: Some(id), ..Self::default() } }
}
