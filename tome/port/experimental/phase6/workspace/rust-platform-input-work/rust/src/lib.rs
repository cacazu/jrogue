// SPDX-License-Identifier: GPL-3.0-or-later
//! Physical input transport only. No actor state, gameplay rules, simulation or RNG.
mod keycodes;
mod mailbox;
mod types;
pub use types::*;
pub use mailbox::{tome_physical_input_reset, tome_physical_input_word,
    tome_physical_input_request, tome_physical_input_output_len, tome_physical_input_output_word};
use std::collections::BTreeMap;

const TEXT_LIMIT: usize = 16 * 1024;
// Match the native packet validator before any physical-state mutation.
const WHEEL_LIMIT: f64 = 100_000.0;
#[derive(Clone, Copy)]
struct HeldKey { keycode: i32 }

#[derive(Default)]
pub struct Mapper {
    keys: BTreeMap<u32, HeldKey>,
    buttons: BTreeMap<u8, (i32, i32)>,
}

impl Mapper {
    fn modifiers(&self, observed: Modifiers) -> u32 {
        let physical = self.keys.keys().fold(0, |mask, scan| mask | keycodes::modifier_bit(*scan));
        let mut mask = physical;
        for (active, group, fallback) in [(observed.ctrl,0xc0,0x40),
            (observed.shift,3,1),(observed.alt,0x300,0x100),(observed.meta,0xc00,0x400)] {
            if active && physical & group == 0 { mask |= fallback; }
        }
        if observed.caps_lock { mask |= 0x2000; }
        if observed.num_lock { mask |= 0x1000; }
        if observed.alt_graph { mask |= 0x4000; }
        if observed.scroll_lock { mask |= 0x8000; }
        mask
    }

    pub fn map(&mut self, input: Input) -> Mapped {
        match input {
            Input::Key { owned_focus, editable, phase, key, code, repeat, composing,
                modifiers, legacy_key_code, location } => {
                if key.len() > 256 || code.len() > 64 || key.contains('\0') || code.contains('\0') || location > 3 {
                    return Mapped::error("input.error.key");
                }
                let Some(scan) = keycodes::scancode(&code) else { return Mapped::default(); };
                // A held physical key always releases, including after focus/IME transitions.
                if phase == Phase::Up {
                    if let Some(held) = self.keys.remove(&scan) {
                        return Mapped::owned(vec![Packet::Key { down: false, scancode: scan,
                            keycode: held.keycode, modifiers: self.modifiers(modifiers), repeat: false }]);
                    }
                    return Mapped::default();
                }
                if !owned_focus || editable || composing || reserved(&code, &key, modifiers) {
                    return Mapped::default();
                }
                let keycode = keycodes::keycode(scan, &key, legacy_key_code, location);
                let repeat = repeat || self.keys.contains_key(&scan);
                self.keys.insert(scan, HeldKey { keycode });
                let mut mapped = Mapped::owned(vec![Packet::Key { down: true, scancode: scan, keycode,
                    modifiers: self.modifiers(modifiers), repeat }]);
                // Pinned SDL Emscripten handler permits the default action when
                // text input is enabled except navigation/function/control keys.
                // Committed UTF-8 must arrive from the later text/input event;
                // canceling an ordinary keydown would suppress that event.
                mapped.prevent_default = modifiers.ctrl || matches!(scan,42|43|79..=82|58..=69|104..=115);
                mapped
            }
            Input::Text { owned_focus, text, modifiers } => {
                if !owned_focus { return Mapped::default(); }
                if !valid_text(&text) { return Mapped::error("input.error.text"); }
                if text.is_empty() { return Mapped::default(); }
                Mapped::owned(vec![Packet::Text { text, modifiers: self.modifiers(modifiers) }])
            }
            Input::Composition { owned_focus, text, start, length } => {
                if !owned_focus { return Mapped::default(); }
                if !valid_text(&text) || start.checked_add(length).is_none() {
                    return Mapped::error("input.error.composition");
                }
                // Browser UTF-16 selection units remain opaque. Never emit SDL_TEXTEDITING.
                Mapped { handled: true, composition: Some(Preedit { text, start, length }),
                    ..Mapped::default() }
            }
            Input::MouseMotion { owned_focus, point, relative, movement_x, movement_y, buttons, modifiers } => {
                if !owned_focus { return Mapped::default(); }
                let Ok((px,py)) = point.pixels() else { return Mapped::error("input.error.coordinates"); };
                let position = if relative {
                    let x = pixel(movement_x * f64::from(point.window_width) / point.rect.width);
                    let y = pixel(movement_y * f64::from(point.window_height) / point.rect.height);
                    match (x,y) { (Some(x),Some(y)) => (x,y), _ => return Mapped::error("input.error.coordinates") }
                } else { (px,py) };
                let mask = self.modifiers(modifiers);
                // Recover missed releases; never manufacture an unseen button-down from motion.
                let released: Vec<u8> = self.buttons.keys().copied().filter(|button| buttons & dom_bit(*button) == 0).collect();
                let mut packets = Vec::new();
                for button in released {
                    self.buttons.remove(&button);
                    packets.push(Packet::MouseButton { down: false, button, x:px, y:py, modifiers:mask });
                }
                for position in self.buttons.values_mut() { *position = (px,py); }
                packets.push(Packet::MouseMotion { relative, x:position.0, y:position.1, modifiers:mask });
                Mapped::owned(packets)
            }
            Input::MouseButton { owned_focus, phase, button, point, modifiers } => {
                let Some(button) = sdl_button(button) else { return Mapped::error("input.error.button"); };
                if !owned_focus && !(phase == Phase::Up && self.buttons.contains_key(&button)) {
                    return Mapped::default();
                }
                let (x,y) = match point.pixels() {
                    Ok(p) => p,
                    Err(()) if phase == Phase::Up => match self.buttons.get(&button).copied() {
                        Some(p) => p, None => return Mapped::error("input.error.coordinates") },
                    Err(()) => return Mapped::error("input.error.coordinates"),
                };
                let down = phase == Phase::Down;
                for position in self.buttons.values_mut() { *position = (x,y); }
                if down { self.buttons.insert(button,(x,y)); }
                else if self.buttons.remove(&button).is_none() { return Mapped::default(); }
                Mapped::owned(vec![Packet::MouseButton { down, button, x,y, modifiers:self.modifiers(modifiers) }])
            }
            Input::Wheel { owned_focus, point, delta_x, delta_y, delta_mode, modifiers } => {
                if !owned_focus { return Mapped::default(); }
                let Ok((mouse_x,mouse_y)) = point.pixels() else { return Mapped::error("input.error.coordinates"); };
                let scale = match delta_mode { 0 => 0.01, 1 => 1.0/3.0, 2 => 80.0,
                    _ => return Mapped::error("input.error.wheel") };
                let x = delta_x * scale;
                let y = -delta_y * scale;
                if !x.is_finite() || !y.is_finite() || x.abs() > WHEEL_LIMIT || y.abs() > WHEEL_LIMIT {
                    return Mapped::error("input.error.wheel");
                }
                for position in self.buttons.values_mut() { *position = (mouse_x,mouse_y); }
                Mapped::owned(vec![Packet::Wheel { x:x as f32, y:y as f32, mouse_x,mouse_y,
                    modifiers:self.modifiers(modifiers) }])
            }
            Input::Blur {} => self.blur(),
        }
    }

    fn blur(&mut self) -> Mapped {
        let keys = std::mem::take(&mut self.keys);
        let mut sides = keys.keys().fold(0,|mask,scan| mask | keycodes::modifier_bit(*scan));
        let mut packets = Vec::new();
        for (scancode,held) in keys {
            sides &= !keycodes::modifier_bit(scancode);
            packets.push(Packet::Key { down:false,scancode,keycode:held.keycode,modifiers:sides,repeat:false });
        }
        for (button,(x,y)) in std::mem::take(&mut self.buttons) {
            packets.push(Packet::MouseButton { down:false,button,x,y,modifiers:0 });
        }
        let mut output = Mapped::owned(packets);
        output.prevent_default = false;
        output.composition = Some(Preedit { text:String::new(),start:0,length:0 });
        output
    }
}

impl Point {
    fn pixels(self) -> Result<(i32,i32),()> {
        let rect=self.rect;
        if [self.client_x,self.client_y,rect.left,rect.top,rect.width,rect.height].iter().any(|v| !v.is_finite())
            || rect.width<=0.0 || rect.height<=0.0 || self.window_width==0 || self.window_height==0
            || self.window_width>i32::MAX as u32 || self.window_height>i32::MAX as u32 { return Err(()); }
        let x=pixel((self.client_x-rect.left)*f64::from(self.window_width)/rect.width).ok_or(())?;
        let y=pixel((self.client_y-rect.top)*f64::from(self.window_height)/rect.height).ok_or(())?;
        Ok((x,y))
    }
}
fn pixel(value:f64)->Option<i32> {
    if !value.is_finite() || value<f64::from(i32::MIN) || value>f64::from(i32::MAX) { None }
    else { Some(value.trunc() as i32) }
}
fn valid_text(text:&str)->bool { text.len()<=TEXT_LIMIT && !text.chars().any(char::is_control) }
fn sdl_button(button:i16)->Option<u8> {
    if (0..=15).contains(&button) { u8::try_from(button+1).ok() } else { None }
}
fn dom_bit(button:u8)->u16 { match button { 1=>1,2=>4,3=>2,4..=16=>1_u16<<(button-1),_=>0 } }
fn reserved(code:&str,key:&str,mods:Modifiers)->bool {
    mods.meta || matches!(code,"MetaLeft"|"MetaRight"|"F5"|"F12")
        || (mods.ctrl && (matches!(code,"KeyL"|"KeyW"|"KeyR"|"KeyT"|"KeyN"|"KeyP")
            || matches!(key.to_ascii_lowercase().as_str(),"l"|"w"|"r"|"t"|"n"|"p")))
}

#[cfg(test)]
mod tests;
