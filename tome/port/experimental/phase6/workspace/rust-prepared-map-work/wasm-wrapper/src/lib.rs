// SPDX-License-Identifier: GPL-3.0-or-later
//! Owned byte/word ABI over the frozen pure TMP1 decoder. No native imports.
//! Original frame preparation stays in another WASM instance, outside this ABI.
//! Export attributes provide ABI names; no function body dereferences pointers
//! or performs unsafe memory access. Host input is copied into initialized u8s.
#![deny(unsafe_op_in_unsafe_fn)]

use std::{cell::RefCell, fmt::{self, Write}};
use tome_observed_map_packet::{Event, ExpectedPreparation, MarkerKind, ObservedDrawCommand, OwnedPacket, MAX_PACKET_BYTES};

const MAX_OUTPUT_BYTES: usize = 16384;
const MAX_OUTPUT_WORDS: usize = MAX_OUTPUT_BYTES / 4;
const MAX_EXACT_EPOCH: u64 = (1_u64 << 53) - 1;

#[derive(Clone, Copy, Default)]
struct Failure { code: u32, byte_offset: Option<usize>, reason: &'static str }
struct Upload { bytes: Vec<u8>, written: usize, expected: ExpectedPreparation }
#[derive(Default)]
struct State {
    upload: Option<Upload>, packet: Option<OwnedPacket>, output: Vec<u8>, output_kind: u32,
    failure: Failure, last_accepted_epoch: u64,
}

struct Json { text: String }
impl Json {
    fn new() -> Result<Self, ()> {
        let mut text = String::new();
        text.try_reserve(2048).map_err(|_| ())?;
        Ok(Self { text })
    }
    fn quoted(&mut self, value: &str) -> fmt::Result {
        self.write_char('"')?;
        for c in value.chars() {
            match c {
                '"' => self.write_str("\\\"")?, '\\' => self.write_str("\\\\")?,
                '\n' => self.write_str("\\n")?, '\r' => self.write_str("\\r")?, '\t' => self.write_str("\\t")?,
                c if c < ' ' => write!(self, "\\u{:04x}", u32::from(c))?, c => self.write_char(c)?,
            }
        }
        self.write_char('"')
    }
    fn matrix(&mut self, value: &[f32; 16]) -> fmt::Result {
        self.write_char('[')?;
        for (i, n) in value.iter().enumerate() { if i != 0 { self.write_char(',')?; } write!(self, "{n}")?; }
        self.write_char(']')
    }
    fn finish(self) -> Vec<u8> { self.text.into_bytes() }
}
impl Write for Json {
    fn write_str(&mut self, value: &str) -> fmt::Result {
        if self.text.len().checked_add(value.len()).is_none_or(|n| n > MAX_OUTPUT_BYTES) { return Err(fmt::Error); }
        self.text.try_reserve(value.len()).map_err(|_| fmt::Error)?;
        self.text.push_str(value); Ok(())
    }
}

fn marker_code(kind: MarkerKind) -> u32 {
    match kind { MarkerKind::ObjectBegin => 2, MarkerKind::ObjectEnd => 3, MarkerKind::ZBegin => 4,
        MarkerKind::ZEnd => 5, MarkerKind::NativeFovBegin => 6, MarkerKind::NativeFovEnd => 7 }
}
fn draw_json(out: &mut Json, draw: &ObservedDrawCommand, index: usize) -> fmt::Result {
    let slot = draw.slot(); let gl = draw.state();
    write!(out, "{{\"kind\":1,\"draw_index\":{index},\"source_sequence\":{},\"native_layer_at_flush\":{},\"vertex_count\":{},\"quad_count\":{},\"array_word_counts\":[{},{},{},{}],\"full_renderer_ready\":false,\"gl\":{{\"active_unit_2d_texture\":{},\"cached_program\":{},\"cached_framebuffer\":{},\"active_texture_unit\":{},\"capture_flags_at_batch\":{},\"viewport\":{:?},\"scissor_box\":{:?},\"blend_enabled\":{},\"scissor_enabled\":{},\"blend_factors\":{:?},\"modelview\":",
        slot.sequence, slot.native_layer, draw.vertex_count(), draw.source_quads().len(), draw.vertices().len(),
        draw.texture_coordinates().len(), draw.colors().len(), draw.source_quads().len() * 3,
        gl.active_unit_2d_texture.0, gl.cached_program.0, gl.cached_framebuffer.0, gl.active_texture_unit,
        gl.capture_flags_at_batch, gl.viewport, gl.scissor_box, gl.blend_enabled, gl.scissor_enabled, gl.blend_factors)?;
    out.matrix(&gl.modelview)?; out.write_str(",\"projection\":")?; out.matrix(&gl.projection)?;
    out.write_str("}}")
}

impl State {
    fn fail(&mut self, code: u32, reason: &'static str, byte_offset: Option<usize>) -> i32 {
        self.output.clear(); self.output_kind = 0;
        self.failure = Failure { code, reason, byte_offset }; 0
    }
    fn begin(&mut self, length: u32, expected: ExpectedPreparation) -> i32 {
        let Ok(length) = usize::try_from(length) else { return self.fail(1, "input length does not fit platform", None); };
        if !(64..=MAX_PACKET_BYTES).contains(&length) || expected.vm_generation == 0 || expected.application_epoch == 0
            || expected.application_epoch > MAX_EXACT_EPOCH || expected.application_epoch <= self.last_accepted_epoch {
            return self.fail(1, "invalid bounded input or preparation identity", None);
        }
        if self.upload.is_some() { return self.fail(2, "another owned upload is incomplete", None); }
        let mut bytes = Vec::new();
        if bytes.try_reserve_exact(length).is_err() { return self.fail(6, "input allocation failed", None); }
        bytes.resize(length, 0); // Initialized owned bytes; no raw-pointer input.
        self.packet = None; self.output.clear(); self.output_kind = 0; self.failure = Failure::default();
        self.upload = Some(Upload { bytes, written: 0, expected }); 1
    }
    fn write_word(&mut self, offset: u32, word: u32, valid_bytes: u32) -> i32 {
        let Some(upload) = self.upload.as_mut() else { return self.fail(2, "no owned upload is active", None); };
        let Ok(offset) = usize::try_from(offset) else { return self.fail(3, "word offset does not fit platform", None); };
        let Ok(count) = usize::try_from(valid_bytes) else { return self.fail(3, "word count does not fit platform", None); };
        let remaining = upload.bytes.len().saturating_sub(upload.written);
        if offset != upload.written || count == 0 || count != remaining.min(4) { return self.fail(3, "upload words must cover the exact next bytes", Some(offset)); }
        upload.bytes[offset..offset + count].copy_from_slice(&word.to_le_bytes()[..count]);
        upload.written += count; self.failure = Failure::default(); 1
    }
    fn commit(&mut self) -> i32 {
        let Some(upload) = self.upload.take() else { return self.fail(2, "no owned upload is active", None); };
        if upload.written != upload.bytes.len() { return self.fail(2, "owned upload has missing bytes", Some(upload.written)); }
        match OwnedPacket::decode(upload.bytes, upload.expected) {
            Ok(packet) => {
                self.last_accepted_epoch = packet.preparation().application_epoch;
                self.packet = Some(packet); self.failure = Failure::default(); self.output.clear(); self.output_kind = 0; 1
            }
            Err(error) => { self.packet = None; self.fail(4, error.reason, Some(error.byte_offset)) }
        }
    }
    fn accept_output(&mut self, kind: u32, bytes: Result<Vec<u8>, ()>) -> i32 {
        match bytes {
            Ok(bytes) if bytes.len() <= MAX_OUTPUT_BYTES => {
                self.output = bytes; self.output_kind = kind; 1
            }
            _ => self.fail(6, "bounded output allocation or formatting failed", None),
        }
    }
    fn status_bytes(&self) -> Result<Vec<u8>, ()> {
        let mut out = Json::new()?;
        let phase = if self.upload.is_some() { "uploading" } else if self.packet.is_some() { "validated" }
            else if self.failure.code != 0 { "rejected" } else { "idle" };
        write!(out, "{{\"protocol\":1,\"phase\":\"{phase}\",\"full_renderer_ready\":false,\"renderer_support\":\"unsupported_tmp1\",\"error_code\":{},\"error_reason\":", self.failure.code).map_err(|_| ())?;
        out.quoted(self.failure.reason).map_err(|_| ())?;
        if let Some(offset) = self.failure.byte_offset { write!(out, ",\"error_byte_offset\":{offset}").map_err(|_| ())?; }
        if let Some(upload) = &self.upload {
            write!(out, ",\"input_bytes\":{},\"written_bytes\":{},\"epoch\":{},\"vm_generation\":\"{}\"",
                upload.bytes.len(), upload.written, upload.expected.application_epoch, upload.expected.vm_generation).map_err(|_| ())?;
        }
        if let Some(packet) = &self.packet {
            let h = packet.header(); let expected = packet.preparation();
            write!(out, ",\"epoch\":{},\"vm_generation\":\"{}\",\"capture_flags\":{},\"packet_bytes\":{},\"event_count\":{},\"draw_count\":{},\"map\":{{\"width\":{},\"height\":{},\"native_zdepth\":{}}},\"original_keyframes\":{}",
                h.application_epoch, expected.vm_generation, h.flags, h.packet_bytes, h.event_count, h.batch_count,
                h.map_width, h.map_height, h.native_zdepth, h.original_keyframes).map_err(|_| ())?;
        }
        out.write_char('}').map_err(|_| ())?; Ok(out.finish())
    }
    fn status(&mut self) -> i32 { let result = self.status_bytes(); self.accept_output(1, result) }
    fn draw_bytes(&self, index: usize) -> Result<Vec<u8>, ()> {
        let draw = self.packet.as_ref().ok_or(())?.observed_draw_commands().nth(index).ok_or(())?;
        let mut out = Json::new()?; draw_json(&mut out, draw, index).map_err(|_| ())?; Ok(out.finish())
    }
    fn draw(&mut self, index: u32) -> i32 {
        let Ok(index) = usize::try_from(index) else { return self.fail(5, "draw index does not fit platform", None); };
        let result = self.draw_bytes(index);
        if result.is_err() { return self.fail(5, "draw index or metadata is unavailable", None); }
        self.accept_output(1, result)
    }
    fn event_bytes(&self, index: usize) -> Result<Vec<u8>, ()> {
        let packet = self.packet.as_ref().ok_or(())?; let event = packet.events().get(index).ok_or(())?;
        let mut out = Json::new()?;
        match event {
            Event::Draw(draw) => {
                let draw_index = packet.events()[..index].iter().filter(|e| matches!(e, Event::Draw(_))).count();
                draw_json(&mut out, draw, draw_index).map_err(|_| ())?;
            }
            Event::Marker { slot, kind } => write!(out, "{{\"kind\":{},\"event_index\":{index},\"source_sequence\":{},\"native_layer\":{},\"full_renderer_ready\":false}}",
                marker_code(*kind), slot.sequence, slot.native_layer).map_err(|_| ())?,
            Event::Seen(seen) => {
                let (width, height) = seen.dimensions(); let slot = seen.slot();
                write!(out, "{{\"kind\":8,\"event_index\":{index},\"source_sequence\":{},\"native_layer\":{},\"native_texture\":{},\"width\":{width},\"height\":{height},\"format\":\"BGRA\",\"byte_count\":{},\"full_renderer_ready\":false}}",
                    slot.sequence, slot.native_layer, seen.native_texture().0, seen.bgra().len()).map_err(|_| ())?;
            }
        }
        Ok(out.finish())
    }
    fn event(&mut self, index: u32) -> i32 {
        let Ok(index) = usize::try_from(index) else { return self.fail(5, "event index does not fit platform", None); };
        let result = self.event_bytes(index);
        if result.is_err() { return self.fail(5, "event index or metadata is unavailable", None); }
        self.accept_output(1, result)
    }
    fn draw_word_bytes(&self, index: usize, kind: u32, start: usize, count: usize) -> Result<Vec<u8>, ()> {
        let draw = self.packet.as_ref().ok_or(())?.observed_draw_commands().nth(index).ok_or(())?;
        let total = match kind { 1 => draw.vertices().len(), 2 => draw.texture_coordinates().len(), 3 => draw.colors().len(),
            4 => draw.source_quads().len().checked_mul(3).ok_or(())?, _ => return Err(()) };
        let end = start.checked_add(count).ok_or(())?;
        if count == 0 || count > MAX_OUTPUT_WORDS || end > total { return Err(()); }
        let mut bytes = Vec::new(); bytes.try_reserve_exact(count.checked_mul(4).ok_or(())?).map_err(|_| ())?;
        for i in start..end {
            let word = match kind {
                1 => draw.vertices()[i].to_bits(), 2 => draw.texture_coordinates()[i].to_bits(), 3 => draw.colors()[i].to_bits(),
                _ => { let q = draw.source_quads()[i / 3]; let value = match i % 3 { 0 => q.native_layer, 1 => q.cell_x, _ => q.cell_y };
                    u32::from_le_bytes(value.to_le_bytes()) }
            };
            bytes.extend_from_slice(&word.to_le_bytes());
        }
        Ok(bytes)
    }
    fn draw_words(&mut self, index: u32, kind: u32, start: u32, count: u32) -> i32 {
        let converted = (usize::try_from(index), usize::try_from(start), usize::try_from(count));
        let (Ok(index), Ok(start), Ok(count)) = converted else { return self.fail(5, "array range does not fit platform", None); };
        let result = self.draw_word_bytes(index, kind, start, count);
        if result.is_err() { return self.fail(5, "actual draw array range is unavailable", None); }
        self.accept_output(2, result)
    }
    fn seen_byte_copy(&self, index: usize, start: usize, count: usize) -> Result<Vec<u8>, ()> {
        let packet = self.packet.as_ref().ok_or(())?;
        let Some(Event::Seen(seen)) = packet.events().get(index) else { return Err(()); };
        if count == 0 || count > MAX_OUTPUT_BYTES { return Err(()); }
        let slice = seen.bgra().get(start..start.checked_add(count).ok_or(())?).ok_or(())?;
        let mut bytes = Vec::new(); bytes.try_reserve_exact(count).map_err(|_| ())?; bytes.extend_from_slice(slice); Ok(bytes)
    }
    fn seen_bytes(&mut self, index: u32, start: u32, count: u32) -> i32 {
        let converted = (usize::try_from(index), usize::try_from(start), usize::try_from(count));
        let (Ok(index), Ok(start), Ok(count)) = converted else { return self.fail(5, "seen range does not fit platform", None); };
        let result = self.seen_byte_copy(index, start, count);
        if result.is_err() { return self.fail(5, "actual seen byte range is unavailable", None); }
        self.accept_output(2, result)
    }
    fn output_word(&self, offset: u32) -> u32 {
        let Ok(offset) = usize::try_from(offset) else { return 0; };
        if self.output_kind == 0 || offset >= self.output.len() { return 0; }
        let mut word = [0_u8; 4];
        let count = (self.output.len() - offset).min(4);
        word[..count].copy_from_slice(&self.output[offset..offset + count]); u32::from_le_bytes(word)
    }
    fn release(&mut self) -> i32 {
        self.upload = None; self.packet = None; self.output.clear(); self.output_kind = 0; self.failure = Failure::default(); 1
    }
}

thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }
fn mutate(call: impl FnOnce(&mut State) -> i32) -> i32 {
    STATE.with(|state| match state.try_borrow_mut() { Ok(mut owned) => call(&mut owned), Err(_) => 0 })
}
fn read(call: impl FnOnce(&State) -> u32) -> u32 {
    STATE.with(|state| match state.try_borrow() { Ok(owned) => call(&owned), Err(_) => 0 })
}
fn halves(low: u32, high: u32) -> u64 { u64::from(low) | (u64::from(high) << 32) }

// Export attributes only. All bodies operate on initialized owned Rust storage.
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_begin(length: u32, epoch_low: u32, epoch_high: u32, generation_low: u32, generation_high: u32) -> i32 {
    mutate(|state| state.begin(length, ExpectedPreparation { application_epoch: halves(epoch_low, epoch_high), vm_generation: halves(generation_low, generation_high) }))
}
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_write_word(offset: u32, word: u32, valid_bytes: u32) -> i32 { mutate(|state| state.write_word(offset, word, valid_bytes)) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_commit() -> i32 { mutate(State::commit) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_release() -> i32 { mutate(State::release) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_status() -> i32 { mutate(State::status) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_event(index: u32) -> i32 { mutate(|state| state.event(index)) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_draw(index: u32) -> i32 { mutate(|state| state.draw(index)) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_draw_words(index: u32, kind: u32, start: u32, count: u32) -> i32 { mutate(|state| state.draw_words(index, kind, start, count)) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_seen_bytes(index: u32, start: u32, count: u32) -> i32 { mutate(|state| state.seen_bytes(index, start, count)) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_output_kind() -> u32 { read(|state| state.output_kind) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_output_len() -> u32 { read(|state| u32::try_from(state.output.len()).unwrap_or(0)) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_output_word(offset: u32) -> u32 { read(|state| state.output_word(offset)) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_error_code() -> u32 { read(|state| state.failure.code) }
#[unsafe(no_mangle)]
pub extern "C" fn tome_map_wasm_full_replay() -> i32 { 0 }

#[cfg(test)] mod tests;
