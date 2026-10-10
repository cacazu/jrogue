//! Original Angband menu input policy expressed as a pure Rust intent machine.
//!
//! A requested effect stands for one callback at its original C call site.
//! The adapter executes it once, captures the result, and resumes this machine.
//! Rust never reads a C menu, queries a row, draws, or runs a game action itself.
//! Source: Angband 4.2.6 ui-menu.c, pinned upstream f3082213b73f3e463e3d0d60bff4b00462beae6e.

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::fmt;

pub const MAX_ROWS: i32 = 4096;
pub const MAX_POLICY_BYTES: usize = 4096;
pub const MAX_CONTROLLERS: usize = 16;
pub const EVT_NONE: u32 = 0;
pub const EVT_KBRD: u32 = 1;
pub const EVT_MOUSE: u32 = 2;
pub const EVT_RESIZE: u32 = 4;
pub const EVT_ESCAPE: u32 = 0x10;
pub const EVT_MOVE: u32 = 0x20;
pub const EVT_SELECT: u32 = 0x40;
pub const EVT_SWITCH: u32 = 0x80;
pub const ESCAPE: u32 = 0xe000;
pub const KC_ENTER: u32 = 0x9c;
pub const ARROW_LEFT: u32 = 0x81;
pub const ARROW_RIGHT: u32 = 0x82;
pub const MN_REL_TAGS: u32 = 1;
pub const MN_NO_TAGS: u32 = 2;
pub const MN_PVT_TAGS: u32 = 4;
pub const MN_CASELESS_TAGS: u32 = 8;
pub const MN_DBL_TAP: u32 = 16;
pub const MN_NO_ACTION: u32 = 32;
pub const MN_INSCRIP_TAGS: u32 = 64;
pub const MN_KEYMAP_ESC: u32 = 128;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
#[repr(C)]
pub struct Event {
    pub kind: u32, pub code: u32, pub mods: u32,
    pub x: u32, pub y: u32, pub button: u32,
}
impl Event {
    fn abstract_(kind: u32) -> Self { Self { kind, ..Self::default() } }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum Mode { Keyboard = 1, Mouse = 2, Select = 3 }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum Skin { Scroll = 1, Object = 2, Columns = 3 }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C)]
pub struct Facts {
    pub mode: u32, pub skin: u32,
    pub cursor: i32, pub top: i32, pub count: i32,
    pub col: i32, pub row: i32, pub width: i32, pub page_rows: i32,
    pub flags: u32, pub notify: u32,
    pub has_get_tag: u32, pub has_context: u32,
    /// menu_select's invocation-local MN_NO_ACTION flag and iteration-start
    /// cursor, captured before its original refresh/inkey_ex calls.
    pub no_action: u32, pub previous_cursor: i32,
}
impl Facts {
    fn validate(&self) -> Result<(), MenuError> {
        if !(1..=3).contains(&self.mode) || !(1..=3).contains(&self.skin)
            || !(0..=MAX_ROWS).contains(&self.count) || !(1..=MAX_ROWS).contains(&self.page_rows)
            || !(1..=MAX_ROWS).contains(&self.width) || self.flags > 255
            || self.has_get_tag > 1 || self.has_context > 1 || self.no_action > 1
            || !(-MAX_ROWS..=MAX_ROWS * 2).contains(&self.cursor)
            || !(-MAX_ROWS..=MAX_ROWS * 2).contains(&self.top)
            || !(-MAX_ROWS..=MAX_ROWS).contains(&self.col) || !(-MAX_ROWS..=MAX_ROWS).contains(&self.row) {
            return Err(MenuError::InvalidFacts);
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Policy {
    pub selections: Option<Vec<u8>>, pub cmd_keys: Option<Vec<u8>>, pub switch_keys: Option<Vec<u8>>,
    pub inscriptions: Option<[u8; 10]>,
}
impl Policy {
    fn validate(&self, facts: Facts) -> Result<(), MenuError> {
        for bytes in [&self.selections, &self.cmd_keys, &self.switch_keys].into_iter().flatten() {
            if bytes.len() > MAX_POLICY_BYTES || bytes.contains(&0) { return Err(MenuError::InvalidPolicy); }
        }
        if facts.flags & MN_INSCRIP_TAGS != 0 && self.inscriptions.is_none() { return Err(MenuError::InvalidPolicy); }
        Ok(())
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MenuError { InvalidFacts, InvalidPolicy, InvalidInput, InvalidReply, InvalidHandle, Limit, DegenerateColumns, NotPending }
impl fmt::Display for MenuError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { write!(f, "menu controller: {self:?}") }
}
impl std::error::Error for MenuError {}

/// Effect opcodes shared with the C adapter. Cursor/top must be synchronized
/// before running the requested original callback. Effect/event are values.
pub const OP_SKIN_TAG: u32 = 1;
pub const OP_ROW_TAG: u32 = 2;
pub const OP_VALIDITY: u32 = 3;
pub const OP_DIRECTION: u32 = 4;
pub const OP_ACTION: u32 = 5;
pub const OP_CONTEXT: u32 = 6;
pub const OP_REFRESH: u32 = 7;
pub const OP_RESIZE: u32 = 8;
pub const OP_TERM_WIDTH: u32 = 9;
pub const OP_DONE: u32 = 10;
pub const RESULT_RETURN: u32 = 1;
pub const RESULT_EAT: u32 = 2;
pub const RESULT_MOUSE_HANDLED: u32 = 4;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C)]
pub struct Effect {
    pub op: u32, pub argument: i32, pub cursor: i32, pub top: i32,
    pub event: Event, pub result: u32,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Reply {
    /// Native callback scalar: validity/tag/direction/handled/terminal width.
    pub value: i32,
    /// Modified outgoing event after a context hook; unused for other effects.
    pub event: Event,
    /// Current native values after the one callback, including callback changes.
    pub facts: Facts,
    /// Copy the policies after the same callback, because native handlers may
    /// change which later command/switch/selection keys are accepted.
    pub policy: Policy,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Stage {
    PreMouseAction, PreCommandAction, SwitchAction, Tag { index: i32, skin: bool },
    TagValidity { index: i32 }, Direction, AnyValid { direction: i32, index: i32 },
    MoveValidity { direction: i32 }, MouseWidth, MouseValidity { index: i32 },
    Context, Refresh, SelectedAction, Resize, Done,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Controller {
    facts: Facts, policy: Policy, input: Event, output: Event, original_cursor: i32,
    normalized_tag_key: u8, navigation_count: i32, stage: Stage, effect: Effect,
    eat: bool, mouse_handled: bool,
}
fn uppercase(byte: u8) -> u8 { byte.to_ascii_uppercase() }
fn matches_c_string(bytes: &Option<Vec<u8>>, code: u32) -> bool {
    bytes.as_ref().is_some_and(|bytes| (code as u8) == 0 || bytes.contains(&(code as u8)))
}
fn direction_delta(direction: i32) -> (i32, i32) {
    match direction { 1 => (-1, 1), 2 => (0, 1), 3 => (1, 1), 4 => (-1, 0),
        6 => (1, 0), 7 => (-1, -1), 8 => (0, -1), 9 => (1, -1), _ => (0, 0) }
}
impl Controller {
    pub fn new(facts: Facts, policy: Policy, input: Event) -> Result<Self, MenuError> {
        Self::with_output(facts, policy, input, Event::default())
    }
    pub fn with_output(facts: Facts, policy: Policy, input: Event, output: Event) -> Result<Self, MenuError> {
        facts.validate()?; policy.validate(facts)?;
        if input.mods > 31 || input.x > 255 || input.y > 255 || input.button > 255
            || (facts.mode == Mode::Keyboard as u32 && input.kind != EVT_KBRD)
            || (facts.mode == Mode::Mouse as u32 && input.kind != EVT_MOUSE) { return Err(MenuError::InvalidInput); }
        let mut controller = Self {
            facts, policy, input, output, original_cursor: if facts.mode == Mode::Select as u32 { facts.previous_cursor } else { facts.cursor },
            normalized_tag_key: input.code as u8, navigation_count: facts.count, stage: Stage::Done,
            effect: Effect { op: OP_DONE, argument: 0, cursor: facts.cursor, top: facts.top, event: Event::default(), result: 0 },
            eat: false, mouse_handled: false,
        };
        controller.route_input()?;
        Ok(controller)
    }
    pub fn effect(&self) -> Effect { self.effect }
    pub fn facts(&self) -> Facts { self.facts }
    fn request(&mut self, stage: Stage, op: u32, argument: i32, event: Event) {
        self.stage = stage;
        self.effect = Effect { op, argument, cursor: self.facts.cursor, top: self.facts.top, event, result: 0 };
    }
    fn select_mode(&self) -> bool { self.facts.mode == Mode::Select as u32 }
    fn no_action(&self) -> bool { self.facts.no_action != 0 }
    fn route_input(&mut self) -> Result<(), MenuError> {
        match self.input.kind {
            EVT_MOUSE if self.select_mode() && !self.no_action() => self.request(Stage::PreMouseAction, OP_ACTION, 0, self.input),
            EVT_MOUSE => self.mouse()?,
            EVT_KBRD if self.select_mode() && !self.no_action() && matches_c_string(&self.policy.cmd_keys, self.input.code) => self.request(Stage::PreCommandAction, OP_ACTION, 0, self.input),
            EVT_KBRD => self.after_command_action()?,
            EVT_RESIZE if self.select_mode() => self.request(Stage::Resize, OP_RESIZE, 0, self.input),
            _ => self.after_navigation(),
        }
        Ok(())
    }
    fn after_command_action(&mut self) -> Result<(), MenuError> {
        if self.select_mode() && !self.no_action() && matches_c_string(&self.policy.switch_keys, self.input.code) {
            self.request(Stage::SwitchAction, OP_ACTION, 0, self.input);
        } else { self.keyboard()?; }
        Ok(())
    }
    fn keyboard(&mut self) -> Result<(), MenuError> {
        self.navigation_count = self.facts.count;
        self.normalized_tag_key = if self.facts.flags & MN_CASELESS_TAGS != 0 { uppercase(self.input.code as u8) } else { self.input.code as u8 };
        if self.facts.flags & MN_INSCRIP_TAGS != 0 && self.normalized_tag_key.is_ascii_digit() {
            if let Some(key) = self.policy.inscriptions.map(|values| values[usize::from(self.normalized_tag_key - b'0')]).filter(|key| *key != 0) { self.normalized_tag_key = key; }
        }
        if self.facts.flags & MN_NO_TAGS != 0 { self.known_key()?; }
        else if self.facts.flags & MN_REL_TAGS != 0 {
            if self.navigation_count > 0 { self.request(Stage::Tag { index: 0, skin: true }, OP_SKIN_TAG, 0, self.input); }
            else { self.known_key()?; }
        } else if self.policy.selections.is_some() && self.facts.flags & MN_PVT_TAGS == 0 {
            let index = self.policy.selections.as_ref().and_then(|bytes| bytes.iter().position(|byte|
                (if self.facts.flags & MN_CASELESS_TAGS != 0 { uppercase(*byte) } else { *byte }) == self.normalized_tag_key));
            if let Some(index) = index { self.request(Stage::TagValidity { index: i32::try_from(index).map_err(|_| MenuError::Limit)? }, OP_VALIDITY, i32::try_from(index).map_err(|_| MenuError::Limit)?, self.input); }
            else { self.known_key()?; }
        } else if self.facts.has_get_tag != 0 && self.navigation_count > 0 { self.request(Stage::Tag { index: 0, skin: false }, OP_ROW_TAG, 0, self.input); }
        else { self.known_key()?; }
        Ok(())
    }
    fn known_key(&mut self) -> Result<(), MenuError> {
        if self.input.code == ESCAPE { self.output.kind = EVT_ESCAPE; self.after_navigation(); }
        else if self.navigation_count <= 0 { self.eat = true; self.after_navigation(); }
        else if self.input.code == u32::from(b' ') {
            if self.facts.page_rows < self.navigation_count {
                self.facts.cursor += self.facts.page_rows;
                if self.facts.cursor >= self.navigation_count - 1 { self.facts.cursor = 0; }
                self.facts.top = self.facts.cursor;
                self.output.kind = EVT_MOVE;
            } else { self.eat = true; }
            self.after_navigation();
        } else if self.input.code == KC_ENTER { self.output.kind = EVT_SELECT; self.after_navigation(); }
        else { self.request(Stage::Direction, OP_DIRECTION, i32::from(self.facts.flags & MN_KEYMAP_ESC != 0), self.input); }
        Ok(())
    }
    fn mouse(&mut self) -> Result<(), MenuError> {
        let x = i32::try_from(self.input.x).map_err(|_| MenuError::InvalidInput)?;
        let y = i32::try_from(self.input.y).map_err(|_| MenuError::InvalidInput)?;
        let inside = x >= self.facts.col && x < self.facts.col + self.facts.width
            && y >= self.facts.row && y < self.facts.row + self.facts.page_rows;
        if self.input.button == 2 || (!inside && x < self.facts.col) { self.output.kind = EVT_ESCAPE; self.mouse_handled = true; self.after_navigation(); }
        else if !inside { self.context_or_finish(); }
        else if self.facts.skin == Skin::Columns as u32 { self.request(Stage::MouseWidth, OP_TERM_WIDTH, 0, self.input); }
        else {
            let index = (y - self.facts.row + self.facts.top).min(self.facts.count - 1);
            self.request(Stage::MouseValidity { index }, OP_VALIDITY, index, self.input);
        }
        Ok(())
    }
    fn context_or_finish(&mut self) {
        if self.facts.has_context != 0 { self.request(Stage::Context, OP_CONTEXT, 0, self.output); }
        else { self.mouse_handled = self.output.kind != EVT_NONE; self.after_navigation(); }
    }
    fn process_direction(&mut self, direction: i32) {
        let (dx, dy) = direction_delta(direction);
        match self.facts.skin {
            value if value == Skin::Scroll as u32 || value == Skin::Object as u32 => {
                if dx != 0 && dy != 0 { self.output = Event::default(); }
                else if dx != 0 {
                    self.output = if value == Skin::Object as u32 { Event { kind: EVT_SWITCH, code: if dx < 0 { ARROW_LEFT } else { ARROW_RIGHT }, ..Event::default() } }
                        else { Event::abstract_(if dx < 0 { EVT_ESCAPE } else { EVT_SELECT }) };
                } else if dy != 0 { self.facts.cursor += dy; self.output = Event::abstract_(EVT_MOVE); }
            }
            _ => {
                let rows = self.facts.page_rows;
                let count = self.facts.count;
                let cols = (count + rows - 1) / rows;
                self.facts.cursor += dx * rows + dy;
                if self.facts.cursor > count { self.facts.cursor %= rows; }
                else if self.facts.cursor < 0 { self.facts.cursor += rows * cols; }
                self.output = Event::abstract_(EVT_MOVE);
            }
        }
        if self.output.kind == EVT_MOVE { self.request(Stage::MoveValidity { direction }, OP_VALIDITY, self.facts.cursor, self.input); }
        else { self.after_navigation(); }
    }
    fn after_navigation(&mut self) {
        if !self.select_mode() { self.done(self.output, if self.eat { RESULT_EAT } else { 0 } | if self.mouse_handled { RESULT_MOUSE_HANDLED } else { 0 }); }
        else if self.original_cursor != self.facts.cursor { self.request(Stage::Refresh, OP_REFRESH, 0, self.output); }
        else { self.after_refresh(); }
    }
    fn after_refresh(&mut self) {
        if self.output.kind == EVT_SELECT && !self.no_action() { self.request(Stage::SelectedAction, OP_ACTION, 0, self.output); }
        else { self.finish_iteration(); }
    }
    fn finish_iteration(&mut self) {
        let notify = self.facts.notify | EVT_SELECT | EVT_ESCAPE | EVT_SWITCH;
        if notify & self.output.kind != 0 { self.done(self.output, RESULT_RETURN); }
        else if notify & self.input.kind != 0 { self.done(self.input, RESULT_RETURN); }
        else { self.done(self.input, 0); }
    }
    fn done(&mut self, event: Event, result: u32) {
        self.request(Stage::Done, OP_DONE, 0, event); self.effect.result = result;
    }
    /// Each reply is consumed once. No callback result is recomputed in Rust.
    pub fn resume(&mut self, reply: Reply) -> Result<(), MenuError> {
        if self.stage == Stage::Done { return Err(MenuError::NotPending); }
        reply.facts.validate()?; reply.policy.validate(reply.facts)?;
        if reply.facts.mode != self.facts.mode
            || reply.facts.no_action != self.facts.no_action || reply.facts.notify != self.facts.notify
            || reply.facts.previous_cursor != self.facts.previous_cursor { return Err(MenuError::InvalidReply); }
        let previous = self.clone();
        self.facts = reply.facts;
        self.policy = reply.policy.clone();
        let result = self.resume_inner(reply);
        if result.is_err() { *self = previous; }
        result
    }
    fn resume_inner(&mut self, reply: Reply) -> Result<(), MenuError> {
        match self.stage {
            Stage::PreMouseAction => if reply.value != 0 { self.done(self.input, 0); } else { self.mouse()?; },
            Stage::PreCommandAction => if reply.value != 0 { self.done(self.input, 0); } else { self.after_command_action()?; },
            Stage::SwitchAction => self.done(self.input, RESULT_RETURN),
            Stage::Tag { index, skin } => {
                let tag = reply.value as u8;
                let tag = if self.facts.flags & MN_CASELESS_TAGS != 0 { uppercase(tag) } else { tag };
                if tag != 0 && tag == self.normalized_tag_key {
                    let index = if skin { index + self.facts.top } else { index };
                    self.request(Stage::TagValidity { index }, OP_VALIDITY, index, self.input);
                } else if index + 1 < self.navigation_count { self.request(Stage::Tag { index: index + 1, skin }, if skin { OP_SKIN_TAG } else { OP_ROW_TAG }, index + 1, self.input); }
                else { self.known_key()?; }
            }
            Stage::TagValidity { index } => {
                if reply.value != 0 { self.output.kind = if self.facts.flags & MN_DBL_TAP == 0 || index == self.facts.cursor { EVT_SELECT } else { EVT_MOVE }; self.facts.cursor = index; self.after_navigation(); }
                else { self.known_key()?; }
            }
            Stage::Direction => {
                if reply.value == ESCAPE as i32 { self.output.kind = EVT_ESCAPE; self.after_navigation(); }
                else if reply.value == 0 { self.after_navigation(); }
                else if (1..=9).contains(&reply.value) && reply.value != 5 {
                    self.request(Stage::AnyValid { direction: reply.value, index: 0 }, OP_VALIDITY, 0, self.input);
                } else { return Err(MenuError::InvalidReply); }
            }
            Stage::AnyValid { direction, index } => {
                if reply.value != 0 { self.process_direction(direction); }
                else if index + 1 < self.navigation_count { self.request(Stage::AnyValid { direction, index: index + 1 }, OP_VALIDITY, index + 1, self.input); }
                else { self.after_navigation(); }
            }
            Stage::MoveValidity { direction } => {
                if reply.value != 0 { self.after_navigation(); }
                else {
                    if self.facts.cursor > self.navigation_count - 1 { self.facts.cursor = 0; }
                    else if self.facts.cursor < 0 { self.facts.cursor = self.navigation_count - 1; }
                    else { self.facts.cursor += direction_delta(direction).1; }
                    self.request(Stage::MoveValidity { direction }, OP_VALIDITY, self.facts.cursor, self.input);
                }
            }
            Stage::MouseWidth => {
                let rows = self.facts.page_rows;
                let cols = (self.facts.count + rows - 1) / rows;
                if cols == 0 { return Err(MenuError::DegenerateColumns); }
                let x = self.input.x as i32;
                let mut col_width = 23;
                if col_width * cols > reply.value - x { col_width = (reply.value - x) / cols; }
                if col_width == 0 { return Err(MenuError::DegenerateColumns); }
                let index = (self.input.y as i32 - self.facts.row + rows * ((x - self.facts.col) / col_width)).max(0).min(self.facts.count - 1);
                self.request(Stage::MouseValidity { index }, OP_VALIDITY, index, self.input);
            }
            Stage::MouseValidity { index } => {
                if reply.value != 0 { self.output.kind = if index == self.facts.cursor || self.facts.flags & MN_DBL_TAP == 0 { EVT_SELECT } else { EVT_MOVE }; self.facts.cursor = index; self.mouse_handled = true; self.after_navigation(); }
                else { self.context_or_finish(); }
            }
            Stage::Context => { self.output = reply.event; self.mouse_handled = reply.value != 0; self.after_navigation(); }
            Stage::Refresh => self.after_refresh(),
            Stage::SelectedAction => if reply.value != 0 { self.done(self.input, 0); } else { self.finish_iteration(); },
            Stage::Resize => self.after_navigation(),
            Stage::Done => return Err(MenuError::NotPending),
        }
        Ok(())
    }
}

/// Match original display_scrolling/object_skin_display margin and clamping.
/// Columns do not modify top. This is pure presentation state, with no draw.
pub fn display_top(skin: Skin, cursor: i32, top: i32, count: i32, rows: i32) -> Result<i32, MenuError> {
    if !(0..=MAX_ROWS).contains(&count) || !(1..=MAX_ROWS).contains(&rows) { return Err(MenuError::InvalidFacts); }
    if skin == Skin::Columns { return Ok(top); }
    let mut top = top;
    if cursor <= top && top > 0 { top = cursor - 1; }
    if cursor >= top + rows - 1 { top = cursor - (rows - 1) + 1; }
    Ok(top.min(count - rows).max(0))
}

/// Bounded borrowed C byte spans are copied before any callback can execute.
/// `present=0` is distinct from the empty, present C string.
#[derive(Clone, Copy)]
#[repr(C)]
pub struct ByteSpan { pub bytes: *const u8, pub len: u32, pub present: u32 }
#[derive(Clone, Copy)]
#[repr(C)]
pub struct PolicySpans {
    pub selections: ByteSpan, pub cmd_keys: ByteSpan, pub switch_keys: ByteSpan, pub inscriptions: ByteSpan,
}
#[derive(Clone, Copy)]
#[repr(C)]
pub struct ReplyCapture { pub value: i32, pub event: Event, pub facts: Facts, pub policy: PolicySpans }
unsafe fn copy_span(span: ByteSpan, maximum: usize) -> Result<Option<Vec<u8>>, MenuError> {
    if span.present == 0 { return Ok(None); }
    let length = usize::try_from(span.len).map_err(|_| MenuError::Limit)?;
    if span.present != 1 || length > maximum || (length != 0 && span.bytes.is_null()) { return Err(MenuError::InvalidPolicy); }
    if length == 0 { return Ok(Some(Vec::new())); }
    // SAFETY: the FFI adapter supplies length initialized bytes for this call;
    // the span is bounded and copied before returning or requesting effects.
    Ok(Some(unsafe { std::slice::from_raw_parts(span.bytes, length) }.to_vec()))
}
unsafe fn copy_policy(spans: PolicySpans) -> Result<Policy, MenuError> {
    // SAFETY: spans originate from the initialized C PolicySpans argument.
    let selections = unsafe { copy_span(spans.selections, MAX_POLICY_BYTES) }?;
    // SAFETY: same bounded initialized C argument contract.
    let cmd_keys = unsafe { copy_span(spans.cmd_keys, MAX_POLICY_BYTES) }?;
    // SAFETY: same bounded initialized C argument contract.
    let switch_keys = unsafe { copy_span(spans.switch_keys, MAX_POLICY_BYTES) }?;
    // SAFETY: inscriptions are either absent or the original ten-byte array.
    let inscriptions = unsafe { copy_span(spans.inscriptions, 10) }?.map(|bytes|
        <[u8;10]>::try_from(bytes).map_err(|_| MenuError::InvalidPolicy)).transpose()?;
    Ok(Policy { selections, cmd_keys, switch_keys, inscriptions })
}
struct Registry { next: u32, controllers: BTreeMap<u32, Controller>, output: Effect, status: u32 }
impl Default for Registry {
    fn default() -> Self { Self { next: 1, controllers: BTreeMap::new(),
        output: Effect { op: OP_DONE, argument: 0, cursor: 0, top: 0, event: Event::default(), result: 0 }, status: 0 } }
}
fn error_status(error: MenuError) -> u32 {
    match error { MenuError::InvalidFacts => 200, MenuError::InvalidPolicy => 201,
        MenuError::InvalidInput => 202, MenuError::InvalidReply => 203, MenuError::InvalidHandle => 204,
        MenuError::Limit => 205, MenuError::DegenerateColumns => 206, MenuError::NotPending => 207 }
}
thread_local! { static REGISTRY: RefCell<Registry> = RefCell::new(Registry::default()); }
impl Registry {
    fn effect(&mut self, result: Result<Effect, MenuError>) -> *const Effect {
        match result { Ok(effect) => { self.output = effect; self.status = 0; &self.output },
            Err(error) => { self.status = error_status(error); std::ptr::null() } }
    }
}
/// Create an independent resumable controller. Handle 0 signals an error.
/// Nested native actions can open their own controller without resetting a
/// suspended outer menu. Locale changes never call or reset this registry.
/// # Safety
/// facts, spans, input and output must point to initialized matching repr(C) values;
/// every present span must contain its stated initialized readable bytes.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_menu_open(facts: *const Facts, spans: *const PolicySpans, input: *const Event, output: *const Event) -> u32 {
    let controller = if facts.is_null() || spans.is_null() || input.is_null() || output.is_null() { Err(MenuError::InvalidFacts) }
    else {
        // SAFETY: the adapter guarantees initialized matching repr(C) values.
        let facts = unsafe { facts.read_unaligned() };
        // SAFETY: the same contract covers PolicySpans and its bounded spans.
        let policy = unsafe { copy_policy(spans.read_unaligned()) };
        // SAFETY: the same contract covers the original captured event value.
        let input = unsafe { input.read_unaligned() };
        // SAFETY: the same contract covers the caller's initial outgoing event.
        let output = unsafe { output.read_unaligned() };
        policy.and_then(|policy| Controller::with_output(facts, policy, input, output))
    };
    REGISTRY.with(|registry| {
        let mut registry = registry.borrow_mut();
        if registry.controllers.len() >= MAX_CONTROLLERS { registry.status = error_status(MenuError::Limit); return 0; }
        match controller {
            Ok(controller) => {
                let mut handle = registry.next.max(1);
                while registry.controllers.contains_key(&handle) { handle = handle.wrapping_add(1).max(1); }
                registry.next = handle.wrapping_add(1).max(1);
                registry.controllers.insert(handle, controller); registry.status = 0; handle
            }
            Err(error) => { registry.status = error_status(error); 0 }
        }
    })
}
/// Read the pending owned intent. Copy it before executing a callback: a nested
/// controller may reuse this output slot. Pointer lives until the next effect,
/// reply or top query on the same thread. No controller is mutated by this read.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_menu_effect(handle: u32) -> *const Effect {
    REGISTRY.with(|registry| { let mut registry = registry.borrow_mut();
        let result = registry.controllers.get(&handle).map(Controller::effect).ok_or(MenuError::InvalidHandle);
        registry.effect(result) })
}
/// Resume once with the captured result of the pending original callback.
/// # Safety
/// reply must point to one initialized matching repr(C) ReplyCapture, including
/// all readable bounded policy spans, for this call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_menu_reply(handle: u32, reply: *const ReplyCapture) -> *const Effect {
    if reply.is_null() { return REGISTRY.with(|registry| registry.borrow_mut().effect(Err(MenuError::InvalidReply))); }
    // SAFETY: the adapter supplies one initialized matching repr(C) ReplyCapture.
    let reply = unsafe { reply.read_unaligned() };
    // SAFETY: its policy spans are initialized readable synchronous spans.
    let policy = unsafe { copy_policy(reply.policy) };
    REGISTRY.with(|registry| {
        let mut registry = registry.borrow_mut();
        let result = policy.and_then(|policy| registry.controllers.get_mut(&handle).ok_or(MenuError::InvalidHandle)
            .and_then(|controller| controller.resume(Reply { value: reply.value, event: reply.event, facts: reply.facts, policy }).map(|()| controller.effect())));
        registry.effect(result)
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_menu_close(handle: u32) -> u32 {
    REGISTRY.with(|registry| { let mut registry = registry.borrow_mut();
        if registry.controllers.remove(&handle).is_some() { registry.status = 0; 1 }
        else { registry.status = error_status(MenuError::InvalidHandle); 0 } })
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_menu_status() -> u32 { REGISTRY.with(|registry| registry.borrow().status) }
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_menu_top(skin: u32, cursor: i32, top: i32, count: i32, rows: i32) -> i32 {
    REGISTRY.with(|registry| {
        let mut registry = registry.borrow_mut();
        let skin = match skin { 1 => Ok(Skin::Scroll), 2 => Ok(Skin::Object), 3 => Ok(Skin::Columns), _ => Err(MenuError::InvalidFacts) };
        match skin.and_then(|skin| display_top(skin, cursor, top, count, rows)) {
            Ok(top) => { registry.status = 0; top }, Err(error) => { registry.status = error_status(error); top }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn facts(mode: Mode) -> Facts { Facts { mode: mode as u32, skin: Skin::Scroll as u32, cursor: 0, top: 0, count: 4,
        col: 4, row: 3, width: 40, page_rows: 3, flags: 0, notify: 0, has_get_tag: 0, has_context: 0, no_action: 0, previous_cursor: 0 } }
    fn key(code: u32) -> Event { Event { kind: EVT_KBRD, code, ..Event::default() } }
    fn respond(controller: &mut Controller, value: i32) { controller.resume(Reply { value, event: Event::default(), facts: controller.facts(), policy: controller.policy.clone() }).unwrap(); }
    #[test]
    fn tags_precede_escape_enter_and_direction_and_hidden_rows_are_selectable() {
        let policy = Policy { selections: Some(vec![0]), ..Policy::default() };
        assert!(Controller::new(facts(Mode::Keyboard), policy, key(ESCAPE)).is_err());
        let policy = Policy { selections: Some(b"ab".to_vec()), ..Policy::default() };
        let mut controller = Controller::new(facts(Mode::Keyboard), policy, key(u32::from(b'b'))).unwrap();
        assert_eq!(controller.effect().op, OP_VALIDITY); assert_eq!(controller.effect().argument, 1);
        respond(&mut controller, 2);
        assert_eq!(controller.effect().event.kind, EVT_SELECT); assert_eq!(controller.facts().cursor, 1);
        assert_eq!(controller.effect().result, 0);
    }
    #[test]
    fn relative_private_caseless_and_inscription_tags_keep_original_search_order() {
        let mut state = facts(Mode::Keyboard); state.flags = MN_REL_TAGS | MN_CASELESS_TAGS | MN_INSCRIP_TAGS; state.top = 2;
        let mut inscriptions = [0;10]; inscriptions[1] = b'A';
        let mut controller = Controller::new(state, Policy { inscriptions: Some(inscriptions), ..Policy::default() }, key(u32::from(b'1'))).unwrap();
        assert_eq!(controller.effect().op, OP_SKIN_TAG); respond(&mut controller, i32::from(b'b')); respond(&mut controller, i32::from(b'a'));
        assert_eq!(controller.effect().argument, 3); respond(&mut controller, 1); assert_eq!(controller.facts().cursor, 3);
        let mut state = facts(Mode::Keyboard); state.flags = MN_PVT_TAGS; state.has_get_tag = 1;
        let mut controller = Controller::new(state, Policy { selections: Some(b"a".to_vec()), ..Policy::default() }, key(u32::from(b'a'))).unwrap();
        assert_eq!(controller.effect().op, OP_ROW_TAG);
        for _ in 0..state.count { respond(&mut controller, i32::from(b'z')); }
        assert_eq!(controller.effect().op, OP_DIRECTION);
    }
    #[test]
    fn empty_menus_eat_enter_but_escape_is_retained_and_space_wraps_before_last_row() {
        let mut state = facts(Mode::Keyboard); state.count = 0;
        assert_eq!(Controller::new(state, Policy::default(), key(KC_ENTER)).unwrap().effect().result, RESULT_EAT);
        assert_eq!(Controller::new(state, Policy::default(), key(ESCAPE)).unwrap().effect().event.kind, EVT_ESCAPE);
        let controller = Controller::new(facts(Mode::Keyboard), Policy::default(), key(u32::from(b' '))).unwrap();
        assert_eq!(controller.facts().cursor, 0); assert_eq!(controller.facts().top, 0); assert_eq!(controller.effect().event.kind, EVT_MOVE);
    }
    #[test]
    fn direction_requests_follow_native_validity_scans_and_wrap_invalid_rows() {
        let mut controller = Controller::new(facts(Mode::Keyboard), Policy::default(), key(0x83)).unwrap();
        assert_eq!(controller.effect().op, OP_DIRECTION); respond(&mut controller, 8);
        assert_eq!(controller.effect().argument, 0); respond(&mut controller, 0);
        assert_eq!(controller.effect().argument, 1); respond(&mut controller, 1);
        assert_eq!(controller.effect().argument, -1); respond(&mut controller, 0);
        assert_eq!(controller.effect().argument, 3); respond(&mut controller, 0);
        assert_eq!(controller.effect().argument, 2); respond(&mut controller, 1);
        assert_eq!(controller.facts().cursor, 2); assert_eq!(controller.effect().event.kind, EVT_MOVE);
    }
    #[test]
    fn diagonals_scroll_horizontal_object_switch_and_column_off_by_one_match_original() {
        let mut controller = Controller::new(facts(Mode::Keyboard), Policy::default(), key(0x83)).unwrap();
        respond(&mut controller, 9); respond(&mut controller, 1); assert_eq!(controller.effect().event.kind, EVT_NONE);
        let mut state = facts(Mode::Keyboard); state.skin = Skin::Object as u32;
        let mut controller = Controller::new(state, Policy::default(), key(ARROW_LEFT)).unwrap();
        respond(&mut controller, 4); respond(&mut controller, 1); assert_eq!(controller.effect().event, Event { kind: EVT_SWITCH, code: ARROW_LEFT, ..Event::default() });
        state.skin = Skin::Columns as u32; state.cursor = 1;
        let mut controller = Controller::new(state, Policy::default(), key(ARROW_RIGHT)).unwrap();
        respond(&mut controller, 6); respond(&mut controller, 1);
        assert_eq!(controller.effect().argument, 4); respond(&mut controller, 0);
        assert_eq!(controller.effect().argument, 0); respond(&mut controller, 1); assert_eq!(controller.facts().cursor, 0);
    }
    #[test]
    fn mouse_right_back_context_double_tap_and_columns_use_original_geometry() {
        let right = Event { kind: EVT_MOUSE, button: 2, ..Event::default() };
        assert_eq!(Controller::new(facts(Mode::Mouse), Policy::default(), right).unwrap().effect().event.kind, EVT_ESCAPE);
        let mut state = facts(Mode::Mouse); state.flags = MN_DBL_TAP;
        let input = Event { kind: EVT_MOUSE, x: 5, y: 4, button: 1, ..Event::default() };
        let mut controller = Controller::new(state, Policy::default(), input).unwrap();
        assert_eq!(controller.effect().argument, 1); respond(&mut controller, 1); assert_eq!(controller.effect().event.kind, EVT_MOVE);
        state.has_context = 1; let mut controller = Controller::new(state, Policy::default(), Event { x: 100, ..input }).unwrap();
        assert_eq!(controller.effect().op, OP_CONTEXT);
        controller.resume(Reply { value: 1, event: Event::abstract_(EVT_SWITCH), facts: state, policy: controller.policy.clone() }).unwrap();
        assert_eq!(controller.effect().event.kind, EVT_SWITCH); assert_eq!(controller.effect().result, RESULT_MOUSE_HANDLED);
        state.skin = Skin::Columns as u32; state.count = 12;
        let mut controller = Controller::new(state, Policy::default(), Event { x: 30, ..input }).unwrap();
        assert_eq!(controller.effect().op, OP_TERM_WIDTH); respond(&mut controller, 100);
        assert_eq!(controller.effect().argument, 4);
    }
    #[test]
    fn menu_iteration_preserves_action_switch_refresh_selection_and_notification_order() {
        let state = facts(Mode::Select);
        let policy = Policy { selections: Some(b"ab".to_vec()), cmd_keys: Some(b"b".to_vec()), switch_keys: Some(b"b".to_vec()), ..Policy::default() };
        let mut controller = Controller::new(state, policy, key(u32::from(b'b'))).unwrap();
        assert_eq!(controller.effect().op, OP_ACTION); respond(&mut controller, 0);
        assert_eq!(controller.effect().op, OP_ACTION); respond(&mut controller, 0);
        assert_eq!(controller.effect().event.kind, EVT_KBRD); assert_eq!(controller.effect().result, RESULT_RETURN);
        let mut controller = Controller::new(state, Policy { selections: Some(b"ab".to_vec()), ..Policy::default() }, key(u32::from(b'b'))).unwrap();
        respond(&mut controller, 1); assert_eq!(controller.effect().op, OP_REFRESH); respond(&mut controller, 0);
        assert_eq!(controller.effect().op, OP_ACTION); assert_eq!(controller.effect().event.kind, EVT_SELECT); respond(&mut controller, 0);
        assert_eq!(controller.effect().event.kind, EVT_SELECT); assert_eq!(controller.effect().result, RESULT_RETURN);
        let mut state = state; state.notify = EVT_KBRD;
        let mut controller = Controller::new(state, Policy::default(), key(u32::from(b'z'))).unwrap(); respond(&mut controller, 0);
        assert_eq!(controller.effect().event.kind, EVT_KBRD); assert_eq!(controller.effect().result, RESULT_RETURN);
    }
    #[test]
    fn handled_actions_continue_without_notification_and_no_action_still_returns_selection() {
        let mut controller = Controller::new(facts(Mode::Select), Policy::default(), key(KC_ENTER)).unwrap();
        assert_eq!(controller.effect().op, OP_ACTION); respond(&mut controller, 1); assert_eq!(controller.effect().result, 0);
        let mut state = facts(Mode::Select); state.flags = MN_NO_ACTION; state.no_action = 1;
        let controller = Controller::new(state, Policy { switch_keys: Some(vec![KC_ENTER as u8]), ..Policy::default() }, key(KC_ENTER)).unwrap();
        assert_eq!(controller.effect().op, OP_DONE); assert_eq!(controller.effect().event.kind, EVT_SELECT); assert_eq!(controller.effect().result, RESULT_RETURN);
        let mut controller = Controller::new(facts(Mode::Select), Policy::default(), Event { kind: EVT_RESIZE, ..Event::default() }).unwrap();
        assert_eq!(controller.effect().op, OP_RESIZE); respond(&mut controller, 0); assert_eq!(controller.effect().result, 0);
    }
    #[test]
    fn invalid_replies_are_transactional_and_owned_policy_has_no_locale_reset() {
        let mut controller = Controller::new(facts(Mode::Keyboard), Policy::default(), key(0x83)).unwrap();
        let before = controller.clone();
        assert!(controller.resume(Reply { value: 99, event: Event::default(), facts: controller.facts(), policy: controller.policy.clone() }).is_err()); assert_eq!(controller, before);
        let mut source = b"ab".to_vec(); let policy = Policy { selections: Some(source.clone()), ..Policy::default() };
        let controller = Controller::new(facts(Mode::Keyboard), policy, key(u32::from(b'b'))).unwrap(); source[1] = b'z';
        assert_eq!(controller.effect().argument, 1);
    }
    #[test]
    fn display_top_matches_scroll_margin_and_column_lifetime() {
        assert_eq!(display_top(Skin::Scroll, 4, 0, 10, 4).unwrap(), 2);
        assert_eq!(display_top(Skin::Object, 1, 3, 10, 4).unwrap(), 0);
        assert_eq!(display_top(Skin::Columns, 4, 7, 10, 4).unwrap(), 7);
    }
    #[test]
    fn callback_policy_mutation_changes_later_switch_branch_and_initial_out_is_retained() {
        let state = facts(Mode::Select);
        let mut controller = Controller::new(state, Policy { cmd_keys: Some(b"x".to_vec()), ..Policy::default() }, key(u32::from(b'x'))).unwrap();
        controller.resume(Reply { value: 0, event: Event::default(), facts: state,
            policy: Policy { switch_keys: Some(b"x".to_vec()), ..Policy::default() } }).unwrap();
        assert_eq!(controller.effect().op, OP_ACTION); respond(&mut controller, 0); assert_eq!(controller.effect().result, RESULT_RETURN);
        let output = Event { kind: EVT_NONE, code: 1234, mods: 3, x: 12, y: 13, button: 4 };
        let controller = Controller::with_output(facts(Mode::Keyboard), Policy::default(), key(ESCAPE), output).unwrap();
        assert_eq!(controller.effect().event, Event { kind: EVT_ESCAPE, ..output });
    }
    #[test]
    fn callback_skin_changes_are_observed_and_nested_ffi_controllers_do_not_reset_each_other() {
        let state = facts(Mode::Select);
        let mut controller = Controller::new(state, Policy { cmd_keys: Some(b"x".to_vec()), ..Policy::default() }, key(u32::from(b'x'))).unwrap();
        let changed = Facts { skin: Skin::Object as u32, ..state };
        controller.resume(Reply { value: 0, event: Event::default(), facts: changed, policy: Policy::default() }).unwrap();
        assert_eq!(controller.effect().op, OP_DIRECTION); respond(&mut controller, 4); respond(&mut controller, 1);
        assert_eq!(controller.effect().event.kind, EVT_SWITCH);
        let absent = ByteSpan { bytes: std::ptr::null(), len: 0, present: 0 };
        let spans = PolicySpans { selections: absent, cmd_keys: absent, switch_keys: absent, inscriptions: absent };
        let keyboard = facts(Mode::Keyboard); let input = key(ARROW_RIGHT); let output = Event::default();
        // SAFETY: the pointers refer to these initialized live local values and
        // all byte spans are absent; each FFI function copies synchronously.
        let outer = unsafe { ab_rs_menu_open(&keyboard, &spans, &input, &output) };
        // SAFETY: the same initialized live local values remain valid.
        let inner = unsafe { ab_rs_menu_open(&keyboard, &spans, &key(ESCAPE), &output) };
        assert!(outer != 0 && inner != 0 && outer != inner);
        // SAFETY: each returned pointer references the registry's live output;
        // copying it immediately avoids aliasing the next effect call.
        let outer_effect = unsafe { *ab_rs_menu_effect(outer) };
        // SAFETY: the registered inner handle yields the same live output slot.
        let inner_effect = unsafe { *ab_rs_menu_effect(inner) };
        assert_eq!(inner_effect.event.kind, EVT_ESCAPE);
        assert_eq!(ab_rs_menu_close(inner), 1);
        // SAFETY: the outer registered controller remains alive and unchanged.
        assert_eq!(unsafe { *ab_rs_menu_effect(outer) }, outer_effect);
        assert_eq!(ab_rs_menu_close(outer), 1);
    }
}
