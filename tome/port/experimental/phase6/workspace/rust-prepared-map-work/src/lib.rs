// SPDX-License-Identifier: GPL-3.0-or-later
//! Pure, owned decoding of the source-derived TMP1 observation protocol.
//!
//! Original C/Lua prepares a frame once. This crate never calls that VM, reads a
//! live map, resolves an entity name, calculates FOV, samples time or uses RNG.
//! TMP1 omits essential rendering state. Decoding it never authorizes rendering.
#![forbid(unsafe_code)]

use std::{error::Error, fmt};

pub const MAX_PACKET_BYTES: usize = 64 * 1024 * 1024;
const MAX_DECODED_BYTES: usize = 128 * 1024 * 1024;
const MAX_EXACT_EPOCH: u64 = (1_u64 << 53) - 1;
const KNOWN_FLAGS: u32 = 1023;
const REQUIRED_TMP1_GAPS: u32 = 1 | 8;
const GL_TRIANGLES: u32 = 4;
const GL_BGRA: u32 = 0x80e1;

/// Actual process-local GL names; these are deliberately not immutable leases.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NativeTextureId(pub u32);
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NativeProgramId(pub u32);
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NativeFramebufferId(pub u32);

/// Supplied by the host after an exclusive preparation and before native release.
/// VM generations must come from the host lifecycle, not from a reused pointer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExpectedPreparation {
    pub vm_generation: u64,
    pub application_epoch: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Header {
    pub flags: u32,
    pub application_epoch: u64,
    pub packet_bytes: u32,
    pub event_count: u32,
    pub batch_count: u32,
    pub map_width: u32,
    pub map_height: u32,
    pub native_zdepth: u32,
    pub original_keyframes: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SourceSlot {
    pub sequence: u32,
    pub native_layer: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct QuadSource {
    pub native_layer: i32,
    pub cell_x: i32,
    pub cell_y: i32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ObservedGlState {
    pub active_unit_2d_texture: NativeTextureId,
    pub cached_program: NativeProgramId,
    pub cached_framebuffer: NativeFramebufferId,
    pub active_texture_unit: u32,
    pub capture_flags_at_batch: u32,
    pub viewport: [i32; 4],
    pub scissor_box: [i32; 4],
    pub blend_enabled: bool,
    pub scissor_enabled: bool,
    pub blend_factors: [u32; 4],
    /// Exact source column-major values; the decoder does not transpose them.
    pub modelview: [f32; 16],
    pub projection: [f32; 16],
}

/// An immutable copy of one actual native batch, not a complete WebGL command.
/// UV/color values are not clamped and source quads are never sorted by layer.
#[derive(Debug, PartialEq)]
pub struct ObservedDrawCommand {
    slot: SourceSlot,
    state: ObservedGlState,
    vertices: Box<[f32]>,
    texture_coordinates: Box<[f32]>,
    colors: Box<[f32]>,
    source_quads: Box<[QuadSource]>,
}

impl ObservedDrawCommand {
    pub fn slot(&self) -> SourceSlot { self.slot }
    pub fn state(&self) -> &ObservedGlState { &self.state }
    pub fn vertices(&self) -> &[f32] { &self.vertices }
    pub fn texture_coordinates(&self) -> &[f32] { &self.texture_coordinates }
    pub fn colors(&self) -> &[f32] { &self.colors }
    pub fn source_quads(&self) -> &[QuadSource] { &self.source_quads }
    pub fn vertex_count(&self) -> usize { self.vertices.len() / 2 }
}

#[derive(Debug, PartialEq, Eq)]
pub struct SeenTextureCopy {
    slot: SourceSlot,
    native_texture: NativeTextureId,
    width: u32,
    height: u32,
    bgra: Box<[u8]>,
}
impl SeenTextureCopy {
    pub fn slot(&self) -> SourceSlot { self.slot }
    pub fn native_texture(&self) -> NativeTextureId { self.native_texture }
    pub fn dimensions(&self) -> (u32, u32) { (self.width, self.height) }
    pub fn bgra(&self) -> &[u8] { &self.bgra }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarkerKind { ObjectBegin, ObjectEnd, ZBegin, ZEnd, NativeFovBegin, NativeFovEnd }

#[derive(Debug, PartialEq)]
// Keep metadata inline: the decoder budgets the entire Event allocation.
// Boxing draws would add a separate allocation outside that accounting.
#[allow(clippy::large_enum_variant)]
pub enum Event {
    Draw(ObservedDrawCommand),
    Marker { slot: SourceSlot, kind: MarkerKind },
    Seen(SeenTextureCopy),
}

/// Validated protocol structure and ownership, with retained semantic gaps.
#[derive(Debug, PartialEq)]
pub struct OwnedPacket {
    preparation: ExpectedPreparation,
    header: Header,
    events: Box<[Event]>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DecodeError { pub byte_offset: usize, pub reason: &'static str }
impl fmt::Display for DecodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "map packet at byte {}: {}", self.byte_offset, self.reason)
    }
}
impl Error for DecodeError {}

fn reject(byte_offset: usize, reason: &'static str) -> DecodeError {
    DecodeError { byte_offset, reason }
}

struct Reader<'a> { bytes: &'a [u8], at: usize, base: usize }
impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], DecodeError> {
        let end = self.at.checked_add(n).ok_or_else(|| reject(self.base + self.at, "length overflow"))?;
        let result = self.bytes.get(self.at..end).ok_or_else(|| reject(self.base + self.at, "truncated field"))?;
        self.at = end;
        Ok(result)
    }
    fn u32(&mut self) -> Result<u32, DecodeError> {
        let value = self.take(4)?;
        Ok(u32::from_le_bytes([value[0], value[1], value[2], value[3]]))
    }
    fn i32(&mut self) -> Result<i32, DecodeError> {
        let value = self.take(4)?;
        Ok(i32::from_le_bytes([value[0], value[1], value[2], value[3]]))
    }
    fn u64(&mut self) -> Result<u64, DecodeError> {
        let value = self.take(8)?;
        Ok(u64::from_le_bytes([value[0], value[1], value[2], value[3], value[4], value[5], value[6], value[7]]))
    }
    fn f32(&mut self) -> Result<f32, DecodeError> {
        let offset = self.base + self.at;
        let value = f32::from_bits(self.u32()?);
        if !value.is_finite() { return Err(reject(offset, "nonfinite original float")); }
        Ok(value)
    }
    fn boolean(&mut self) -> Result<bool, DecodeError> {
        let offset = self.base + self.at;
        match self.u32()? { 0 => Ok(false), 1 => Ok(true), _ => Err(reject(offset, "invalid boolean")) }
    }
    fn floats(&mut self, n: usize) -> Result<Box<[f32]>, DecodeError> {
        let bytes = n.checked_mul(4).ok_or_else(|| reject(self.base + self.at, "float byte overflow"))?;
        if bytes > self.bytes.len().saturating_sub(self.at) { return Err(reject(self.base + self.at, "truncated float array")); }
        let mut result = Vec::new();
        result.try_reserve_exact(n).map_err(|_| reject(self.base + self.at, "float allocation failed"))?;
        for _ in 0..n { result.push(self.f32()?); }
        Ok(result.into_boxed_slice())
    }
    fn i32s<const N: usize>(&mut self) -> Result<[i32; N], DecodeError> {
        let mut values = [0; N];
        for value in &mut values { *value = self.i32()?; }
        Ok(values)
    }
    fn u32s<const N: usize>(&mut self) -> Result<[u32; N], DecodeError> {
        let mut values = [0; N];
        for value in &mut values { *value = self.u32()?; }
        Ok(values)
    }
    fn matrix(&mut self) -> Result<[f32; 16], DecodeError> {
        let mut values = [0.0; 16];
        for value in &mut values { *value = self.f32()?; }
        Ok(values)
    }
    fn exhausted(&self) -> Result<(), DecodeError> {
        if self.at != self.bytes.len() { return Err(reject(self.base + self.at, "trailing record bytes")); }
        Ok(())
    }
}

fn parse_draw(r: &mut Reader<'_>, slot: SourceSlot, header: Header) -> Result<ObservedDrawCommand, DecodeError> {
    if r.u32()? != GL_TRIANGLES { return Err(reject(r.base, "unsupported draw mode")); }
    let vertices = usize::try_from(r.u32()?).map_err(|_| reject(r.base + 4, "vertex count overflow"))?;
    if vertices == 0 || vertices % 6 != 0 || vertices > 30000 { return Err(reject(r.base + 4, "invalid original batch vertex count")); }
    let texture = NativeTextureId(r.u32()?);
    let program = NativeProgramId(r.u32()?);
    let framebuffer = NativeFramebufferId(r.u32()?);
    let active_texture_unit = r.u32()?;
    let quads = usize::try_from(r.u32()?).map_err(|_| reject(r.base + 24, "quad count overflow"))?;
    if quads != vertices / 6 { return Err(reject(r.base + 24, "quad and vertex counts differ")); }
    let flags = r.u32()?;
    if flags & !KNOWN_FLAGS != 0 || flags & !header.flags != 0 || flags & REQUIRED_TMP1_GAPS != REQUIRED_TMP1_GAPS
        || (program.0 != 0 && flags & 4 == 0) {
        return Err(reject(r.base + 28, "inconsistent batch flags"));
    }
    let viewport = r.i32s()?;
    let scissor_box = r.i32s()?;
    if viewport[2] < 0 || viewport[3] < 0 || scissor_box[2] < 0 || scissor_box[3] < 0 {
        return Err(reject(r.base + 32, "negative GL box dimensions"));
    }
    let state = ObservedGlState {
        active_unit_2d_texture: texture, cached_program: program, cached_framebuffer: framebuffer,
        active_texture_unit, capture_flags_at_batch: flags, viewport, scissor_box,
        blend_enabled: r.boolean()?, scissor_enabled: r.boolean()?, blend_factors: r.u32s()?,
        modelview: r.matrix()?, projection: r.matrix()?,
    };
    let position_count = vertices.checked_mul(2).ok_or_else(|| reject(r.base, "position count overflow"))?;
    let color_count = vertices.checked_mul(4).ok_or_else(|| reject(r.base, "color count overflow"))?;
    let positions = r.floats(position_count)?;
    let texture_coordinates = r.floats(position_count)?;
    let colors = r.floats(color_count)?;
    let mut source_quads = Vec::new();
    source_quads.try_reserve_exact(quads).map_err(|_| reject(r.base + r.at, "quad allocation failed"))?;
    let mut previous_quad_layer = -1;
    for _ in 0..quads {
        let source = QuadSource { native_layer: r.i32()?, cell_x: r.i32()?, cell_y: r.i32()? };
        if source.native_layer < 0 || u32::try_from(source.native_layer).unwrap_or(u32::MAX) >= header.native_zdepth
            || source.cell_x < 0 || u32::try_from(source.cell_x).unwrap_or(u32::MAX) >= header.map_width
            || source.cell_y < 0 || u32::try_from(source.cell_y).unwrap_or(u32::MAX) >= header.map_height {
            return Err(reject(r.base + r.at - 12, "source quad lies outside the original map"));
        }
        if source.native_layer < previous_quad_layer || source.native_layer > slot.native_layer {
            return Err(reject(r.base + r.at - 12, "source quad layer violates native traversal order"));
        }
        previous_quad_layer = source.native_layer;
        source_quads.push(source);
    }
    Ok(ObservedDrawCommand { slot, state, vertices: positions, texture_coordinates, colors, source_quads: source_quads.into_boxed_slice() })
}

fn parse_seen(r: &mut Reader<'_>, slot: SourceSlot) -> Result<SeenTextureCopy, DecodeError> {
    let native_texture = NativeTextureId(r.u32()?);
    let width = r.u32()?;
    let height = r.u32()?;
    if width == 0 || height == 0 || r.u32()? != GL_BGRA { return Err(reject(r.base, "invalid original seen texture")); }
    let length_u64 = u64::from(width).checked_mul(u64::from(height)).and_then(|n| n.checked_mul(4))
        .ok_or_else(|| reject(r.base + 4, "seen byte count overflow"))?;
    let length = usize::try_from(length_u64).map_err(|_| reject(r.base + 4, "seen byte count does not fit platform"))?;
    if length > MAX_PACKET_BYTES { return Err(reject(r.base + 4, "seen texture exceeds packet budget")); }
    let bytes = r.take(length)?;
    let mut bgra = Vec::new();
    bgra.try_reserve_exact(length).map_err(|_| reject(r.base + r.at, "seen allocation failed"))?;
    bgra.extend_from_slice(bytes);
    Ok(SeenTextureCopy { slot, native_texture, width, height, bgra: bgra.into_boxed_slice() })
}

impl OwnedPacket {
    /// Copies exact floats/colors/UVs and source metadata into immutable owned arrays.
    ///
    /// # Errors
    /// Rejects malformed lengths, unknown protocol fields, stale expected epochs,
    /// invalid original lifecycle counts, nonfinite data and incomplete ledgers.
    /// Missing renderer capabilities remain explicit accepted diagnostic flags.
    pub fn decode(bytes: Vec<u8>, expected: ExpectedPreparation) -> Result<Self, DecodeError> {
        if !(64..=MAX_PACKET_BYTES).contains(&bytes.len()) { return Err(reject(0, "packet length outside bounded protocol")); }
        if expected.vm_generation == 0 || expected.application_epoch == 0 || expected.application_epoch > MAX_EXACT_EPOCH {
            return Err(reject(0, "invalid host preparation identity"));
        }
        let mut r = Reader { bytes: &bytes, at: 0, base: 0 };
        if r.take(4)? != b"TMP1" || r.u32()? != 1 || r.u32()? != 64 { return Err(reject(0, "unknown map packet protocol")); }
        let flags = r.u32()?;
        if flags & !KNOWN_FLAGS != 0 || flags & REQUIRED_TMP1_GAPS != REQUIRED_TMP1_GAPS { return Err(reject(12, "invalid TMP1 flags")); }
        let application_epoch = r.u64()?;
        if application_epoch != expected.application_epoch { return Err(reject(16, "stale original preparation epoch")); }
        let header = Header {
            flags, application_epoch, packet_bytes: r.u32()?, event_count: r.u32()?, batch_count: r.u32()?,
            map_width: r.u32()?, map_height: r.u32()?, native_zdepth: r.u32()?, original_keyframes: r.i32()?,
        };
        if usize::try_from(header.packet_bytes).ok() != Some(bytes.len()) { return Err(reject(24, "header packet length differs")); }
        if header.map_width == 0 || header.map_height == 0 || header.native_zdepth == 0
            || header.map_width > i32::MAX as u32 || header.map_height > i32::MAX as u32 || header.native_zdepth > i32::MAX as u32 {
            return Err(reject(36, "invalid original map dimensions"));
        }
        if r.u32()? != 1 || r.u32()? != 1 || r.u32()? != 0 { return Err(reject(52, "original map lifecycle did not seal exactly once")); }
        let max_events = (bytes.len() - 64) / 16;
        let count = usize::try_from(header.event_count).map_err(|_| reject(28, "event count does not fit platform"))?;
        if count > max_events { return Err(reject(28, "event count exceeds available bytes")); }
        // Arrays occupy no more than their encoded payload; additionally budget
        // typed event storage before reserving it. Input bytes coexist until return.
        let decoded_bound = count.checked_mul(std::mem::size_of::<Event>()).and_then(|n| n.checked_add(bytes.len()))
            .ok_or_else(|| reject(28, "decoded storage estimate overflow"))?;
        if decoded_bound > MAX_DECODED_BYTES { return Err(reject(28, "decoded storage exceeds bounded budget")); }
        let mut events = Vec::new();
        events.try_reserve_exact(count).map_err(|_| reject(28, "event allocation failed"))?;
        let mut pending: Option<(MarkerKind, i32)> = None;
        let (mut batches, mut seen_count, mut fov_slots, mut callback_slots) = (0_u32, 0_u32, 0_u32, 0_u32);
        let mut previous_slot_layer = -1;
        let mut previous_draw_layer = -1;
        for index in 0..header.event_count {
            let start = r.at;
            let kind = r.u32()?;
            let record_bytes = usize::try_from(r.u32()?).map_err(|_| reject(start + 4, "record count overflow"))?;
            if record_bytes < 16 { return Err(reject(start + 4, "record shorter than prefix")); }
            let slot = SourceSlot { sequence: r.u32()?, native_layer: r.i32()? };
            if slot.sequence != index + 1 { return Err(reject(start + 8, "source order is discontinuous")); }
            if slot.native_layer < 0 || u32::try_from(slot.native_layer).unwrap_or(u32::MAX) >= header.native_zdepth {
                return Err(reject(start + 12, "invalid selected native layer"));
            }
            if slot.native_layer < previous_slot_layer { return Err(reject(start + 12, "native layer traversal moved backward")); }
            previous_slot_layer = slot.native_layer;
            if seen_count != 0 { return Err(reject(start, "event follows final native seen copy")); }
            if fov_slots != 0 && kind != 7 && kind != 8 { return Err(reject(start, "event follows native-tail FOV source slot")); }
            if matches!(kind, 6 | 7) && u32::try_from(slot.native_layer).ok() != Some(header.native_zdepth - 1) {
                return Err(reject(start + 12, "native-tail FOV slot is not at final native layer"));
            }
            let payload = r.take(record_bytes - 16)?;
            let mut p = Reader { bytes: payload, at: 0, base: start + 16 };
            let event = match kind {
                1 => {
                    if pending.is_some() { return Err(reject(start, "native batch inside uncaptured callback slot")); }
                    batches += 1;
                    let draw = parse_draw(&mut p, slot, header)?;
                    if draw.source_quads.first().is_some_and(|source| source.native_layer < previous_draw_layer) {
                        return Err(reject(start, "source quad traversal moved backward across batches"));
                    }
                    if let Some(source) = draw.source_quads.last() { previous_draw_layer = source.native_layer; }
                    Event::Draw(draw)
                }
                2..=7 => {
                    let marker = match kind {
                        2 => MarkerKind::ObjectBegin, 3 => MarkerKind::ObjectEnd,
                        4 => MarkerKind::ZBegin, 5 => MarkerKind::ZEnd,
                        6 => MarkerKind::NativeFovBegin, _ => MarkerKind::NativeFovEnd,
                    };
                    match marker {
                        MarkerKind::ObjectBegin | MarkerKind::ZBegin | MarkerKind::NativeFovBegin => {
                            if pending.is_some() { return Err(reject(start, "nested original callback source slot")); }
                            if marker == MarkerKind::NativeFovBegin { fov_slots += 1; } else { callback_slots += 1; }
                            pending = Some((marker, slot.native_layer));
                        }
                        end => {
                            let begin = match end { MarkerKind::ObjectEnd => MarkerKind::ObjectBegin, MarkerKind::ZEnd => MarkerKind::ZBegin, _ => MarkerKind::NativeFovBegin };
                            if pending != Some((begin, slot.native_layer)) { return Err(reject(start, "unmatched original callback source slot")); }
                            pending = None;
                        }
                    }
                    Event::Marker { slot, kind: marker }
                }
                8 => {
                    if pending.is_some() { return Err(reject(start, "seen copy before callback completion")); }
                    if u32::try_from(slot.native_layer).ok() != Some(header.native_zdepth - 1) {
                        return Err(reject(start + 12, "final seen copy is not at final native layer"));
                    }
                    seen_count += 1;
                    Event::Seen(parse_seen(&mut p, slot)?)
                }
                _ => return Err(reject(start, "unknown original event kind")),
            };
            p.exhausted()?;
            events.push(event);
        }
        r.exhausted()?;
        if batches != header.batch_count || pending.is_some() || fov_slots > 1 { return Err(reject(28, "incomplete native event ledger")); }
        if (fov_slots != 0) != (header.flags & 512 != 0) || (callback_slots != 0 && header.flags & 2 == 0) {
            return Err(reject(12, "source slot observations differ from flags"));
        }
        Ok(Self { preparation: expected, header, events: events.into_boxed_slice() })
    }

    pub fn preparation(&self) -> ExpectedPreparation { self.preparation }
    pub fn header(&self) -> Header { self.header }
    pub fn events(&self) -> &[Event] { &self.events }
    pub fn observed_draw_commands(&self) -> impl Iterator<Item = &ObservedDrawCommand> {
        self.events.iter().filter_map(|event| match event { Event::Draw(draw) => Some(draw), _ => None })
    }
    /// Always false: a validated observation has no complete renderer authority.
    pub fn full_renderer_ready(&self) -> bool { false }
    /// Native IDs cannot be converted into resource leases by assertion or URL.
    /// TMP1 does not contain the data needed to construct a production frame.
    pub fn require_full_replay(&self) -> Result<(), ReplayRejection> {
        Err(ReplayRejection { capture_flags: self.header.flags })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReplayRejection { pub capture_flags: u32 }
impl fmt::Display for ReplayRejection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "TMP1 lacks immutable resource versions, full GL/uniform state, foreign draws and enclosing presentation commands (flags {})", self.capture_flags)
    }
}
impl Error for ReplayRejection {}

#[cfg(test)]
mod tests;
