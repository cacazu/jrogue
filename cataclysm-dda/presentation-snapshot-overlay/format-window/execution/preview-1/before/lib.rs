//! Source-only owned parser for actual CDDA SDL text-window observations.
//! This observes raw presentation data, not semantic text IDs or game state.
//! No drawing, engine call, input, RNG, clock, platform API, or FFI is supplied.
#![forbid(unsafe_code)]

const SOURCE_COMMIT: &[u8; 40] = b"7b2efa5cea38e4d4d97dd0e63b28b9148623da59";
const MAX_BYTES: usize = 4 * 1024 * 1024;
const MAX_CELL_BYTES: usize = 4096;
const MAX_CELLS: usize = 65536;
const MAX_WINDOWS: usize = 64;
const MAX_AXIS: i32 = 1024;

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum Error { Format, Version, Identity, Bounds, Truncated, Trailing, DerivedCell }

impl std::fmt::Display for Error {
    fn fmt(&self, out: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(out, "invalid native text observation: {self:?}")
    }
}
impl std::error::Error for Error {}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum FontRole { Ui, Map, Overmap, Unknown }
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum InputAuthority { NativeOnly }

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cell {
    raw_bytes: Vec<u8>, foreground: i16, background: i16,
    first_codepoint: u32, native_width: i32, ascii_lines: bool, line_id: u8,
}
impl Cell {
    /// Original legacy line bytes may be invalid UTF-8; never force lossy decode.
    pub fn raw_bytes(&self) -> &[u8] { &self.raw_bytes }
    pub const fn foreground(&self) -> i16 { self.foreground }
    pub const fn background(&self) -> i16 { self.background }
    pub const fn first_codepoint(&self) -> u32 { self.first_codepoint }
    pub const fn native_width(&self) -> i32 { self.native_width }
    pub const fn ascii_lines(&self) -> bool { self.ascii_lines }
    pub const fn line_id(&self) -> u8 { self.line_id }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Row { touched: bool, cells: Vec<Cell> }
impl Row {
    pub const fn touched(&self) -> bool { self.touched }
    pub fn cells(&self) -> &[Cell] { &self.cells }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowSubmission {
    role: FontRole, cell_origin: [i32; 2], shape: [i32; 2], cursor: [i32; 2],
    font_metrics: [i32; 2], glyph_offset: [i32; 2], native_clip_size: [i32; 2],
    scaling_factor: i32, inuse: bool, draw: bool, ascii_lines_option: bool,
    window_foreground: i16, window_background: i16, palette: [[u8; 4]; 16], rows: Vec<Row>,
}
impl WindowSubmission {
    pub const fn role(&self) -> FontRole { self.role }
    pub const fn cell_origin(&self) -> [i32; 2] { self.cell_origin }
    pub const fn shape(&self) -> [i32; 2] { self.shape }
    pub const fn cursor(&self) -> [i32; 2] { self.cursor }
    pub const fn font_metrics(&self) -> [i32; 2] { self.font_metrics }
    pub const fn glyph_offset(&self) -> [i32; 2] { self.glyph_offset }
    pub const fn native_clip_size(&self) -> [i32; 2] { self.native_clip_size }
    pub const fn scaling_factor(&self) -> i32 { self.scaling_factor }
    pub const fn inuse(&self) -> bool { self.inuse }
    pub const fn draw(&self) -> bool { self.draw }
    pub const fn ascii_lines_option(&self) -> bool { self.ascii_lines_option }
    pub const fn window_colors(&self) -> [i16; 2] { [self.window_foreground, self.window_background] }
    pub fn palette(&self) -> &[[u8; 4]; 16] { &self.palette }
    pub fn rows(&self) -> &[Row] { &self.rows }
    /// Native erase origin differs from glyph offset for map/overmap fonts.
    /// Widened multiplication reports that observed geometric relationship;
    /// this is not a Canvas coordinate conversion or native overflow guarantee.
    pub fn erase_origin(&self) -> [i64; 2] {
        [i64::from(self.cell_origin[0]) * i64::from(self.font_metrics[0]),
         i64::from(self.cell_origin[1]) * i64::from(self.font_metrics[1])]
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Snapshot { publication: u64, build_id: String, windows: Vec<WindowSubmission> }
impl Snapshot {
    pub const fn publication(&self) -> u64 { self.publication }
    pub fn build_id(&self) -> &str { &self.build_id }
    pub fn windows(&self) -> &[WindowSubmission] { &self.windows }
    pub const fn full_canvas_complete(&self) -> bool { false }
    pub const fn input_authority(&self) -> InputAuthority { InputAuthority::NativeOnly }
}

struct Reader<'a> { bytes: &'a [u8], at: usize }
impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Self { Self { bytes, at: 0 } }
    fn take(&mut self, size: usize) -> Result<&'a [u8], Error> {
        let end = self.at.checked_add(size).ok_or(Error::Bounds)?;
        let value = self.bytes.get(self.at..end).ok_or(Error::Truncated)?;
        self.at = end; Ok(value)
    }
    fn byte(&mut self) -> Result<u8, Error> { Ok(self.take(1)?[0]) }
    fn bool(&mut self) -> Result<bool, Error> {
        match self.byte()? { 0 => Ok(false), 1 => Ok(true), _ => Err(Error::Format) }
    }
    fn short(&mut self) -> Result<i16, Error> {
        let data: [u8; 2] = self.take(2)?.try_into().map_err(|_| Error::Truncated)?;
        Ok(i16::from_le_bytes(data))
    }
    fn u32(&mut self) -> Result<u32, Error> {
        let data: [u8; 4] = self.take(4)?.try_into().map_err(|_| Error::Truncated)?;
        Ok(u32::from_le_bytes(data))
    }
    fn i32(&mut self) -> Result<i32, Error> {
        let data: [u8; 4] = self.take(4)?.try_into().map_err(|_| Error::Truncated)?;
        Ok(i32::from_le_bytes(data))
    }
    fn u64(&mut self) -> Result<u64, Error> {
        let data: [u8; 8] = self.take(8)?.try_into().map_err(|_| Error::Truncated)?;
        Ok(u64::from_le_bytes(data))
    }
    fn size(&mut self, maximum: usize) -> Result<usize, Error> {
        let size = usize::try_from(self.u32()?).map_err(|_| Error::Bounds)?;
        if size > maximum { Err(Error::Bounds) } else { Ok(size) }
    }
    fn finished(&self) -> bool { self.at == self.bytes.len() }
}

// Exact first-codepoint rules from pinned catacharset.cpp:20–98, including
// legacy invalid bytes and the original overlong/underflow handling. Width
// tables remain native; this does not substitute Rust Unicode normalization.
fn native_first_codepoint(raw: &[u8]) -> u32 {
    let Some(&first) = raw.first() else { return 0; };
    let second = raw.get(1).copied().unwrap_or(0); // native std::string trailing NUL
    let mut left = 0_usize;
    let mut overlong = false;
    let mut codepoint = 0xfffd_u32;
    if first >= 0xfc {
        if first & 0xfe == 0xfc { overlong = first == 0xfc && second & 0xfc == 0x80;
            codepoint = u32::from(first & 1); left = 5; }
    } else if first >= 0xf8 {
        if first & 0xfc == 0xf8 { overlong = first == 0xf8 && second & 0xf8 == 0x80;
            codepoint = u32::from(first & 3); left = 4; }
    } else if first >= 0xf0 {
        if first & 0xf8 == 0xf0 { overlong = first == 0xf0 && second & 0xf0 == 0x80;
            codepoint = u32::from(first & 7); left = 3; }
    } else if first >= 0xe0 {
        if first & 0xf0 == 0xe0 { overlong = first == 0xe0 && second & 0xe0 == 0x80;
            codepoint = u32::from(first & 15); left = 2; }
    } else if first >= 0xc0 {
        if first & 0xe0 == 0xc0 { overlong = first & 0xde == 0xc0;
            codepoint = u32::from(first & 31); left = 1; }
    } else if first & 0x80 == 0 { codepoint = u32::from(first); }
    let mut at = 1_usize;
    while left > 0 && at < raw.len() {
        let byte = raw[at];
        if byte & 0xc0 != 0x80 { codepoint = 0xfffd; break; }
        codepoint = (codepoint << 6) | u32::from(byte & 0x3f);
        at += 1; left -= 1;
    }
    if overlong || left > 0 || (0xd800..=0xdfff).contains(&codepoint) ||
        codepoint == 0xfffe || codepoint == 0xffff || codepoint > 0x10ffff { 0xfffd } else { codepoint }
}

fn native_line_decision(codepoint: u32, first_byte: u8, option: bool) -> (bool, u8) {
    let id = match codepoint {
        0x2502 => 0xa0, 0x2500 => 0xa1, 0x2514 => 0xa2, 0x250c => 0xa3,
        0x2510 => 0xa4, 0x2518 => 0xa5, 0x251c => 0xa6, 0x2534 => 0xa7,
        0x2524 => 0xa8, 0x252c => 0xa9, 0x253c => 0xaa,
        0xfffd => return (true, first_byte),
        _ => return (false, first_byte),
    };
    (option, id)
}

fn parse_cell(reader: &mut Reader<'_>, lines_option: bool) -> Result<Cell, Error> {
    let size = reader.size(MAX_CELL_BYTES)?;
    let raw_bytes = reader.take(size)?.to_vec();
    let foreground = reader.short()?;
    let background = reader.short()?;
    let first_codepoint = reader.u32()?;
    let native_width = reader.i32()?;
    let ascii_lines = reader.bool()?;
    let line_id = reader.byte()?;
    let expected_codepoint = native_first_codepoint(&raw_bytes);
    let (expected_lines, expected_id) = native_line_decision(expected_codepoint,
        raw_bytes.first().copied().unwrap_or(0), lines_option);
    if first_codepoint != expected_codepoint || ascii_lines != expected_lines || line_id != expected_id ||
        (raw_bytes.is_empty() && native_width != 0) ||
        (!raw_bytes.is_empty() && first_codepoint == 0xfffd && native_width != 1) ||
        (raw_bytes.as_slice() == b" " && native_width != 1) {
        return Err(Error::DerivedCell);
    }
    Ok(Cell { raw_bytes, foreground, background, first_codepoint, native_width, ascii_lines, line_id })
}

fn parse_window(reader: &mut Reader<'_>, cells_seen: &mut usize) -> Result<WindowSubmission, Error> {
    let role = match reader.u32()? { 1 => FontRole::Ui, 2 => FontRole::Map, 3 => FontRole::Overmap,
        4 => FontRole::Unknown, _ => return Err(Error::Format) };
    let mut fields = [0_i32; 13];
    for field in &mut fields { *field = reader.i32()?; }
    let [x,y,width,height,cursor_x,cursor_y,font_width,font_height,offset_x,offset_y,clip_x,clip_y,scale] = fields;
    if !(1..=MAX_AXIS).contains(&width) || !(1..=MAX_AXIS).contains(&height) ||
        font_width <= 0 || font_height <= 0 || clip_x <= 0 || clip_y <= 0 || scale <= 0 {
        return Err(Error::Bounds);
    }
    let width_size = usize::try_from(width).map_err(|_| Error::Bounds)?;
    let height_size = usize::try_from(height).map_err(|_| Error::Bounds)?;
    let count = width_size.checked_mul(height_size).ok_or(Error::Bounds)?;
    *cells_seen = (*cells_seen).checked_add(count).filter(|value| *value <= MAX_CELLS).ok_or(Error::Bounds)?;
    let inuse = reader.bool()?;
    let draw = reader.bool()?;
    let ascii_lines_option = reader.bool()?;
    if reader.byte()? != 0 { return Err(Error::Format); }
    let window_foreground = reader.short()?;
    let window_background = reader.short()?;
    let mut palette = [[0_u8; 4]; 16];
    for color in &mut palette { color.copy_from_slice(reader.take(4)?); }
    let mut rows = Vec::with_capacity(height_size);
    for _ in 0..height_size {
        let touched = reader.bool()?;
        let mut cells = Vec::with_capacity(width_size);
        for _ in 0..width_size { cells.push(parse_cell(reader, ascii_lines_option)?); }
        rows.push(Row { touched, cells });
    }
    Ok(WindowSubmission { role, cell_origin:[x,y], shape:[width,height], cursor:[cursor_x,cursor_y],
        font_metrics:[font_width,font_height], glyph_offset:[offset_x,offset_y], native_clip_size:[clip_x,clip_y],
        scaling_factor:scale, inuse, draw, ascii_lines_option, window_foreground, window_background, palette, rows })
}

/// Copy a bounded original-module byte observation into immutable owned records.
/// The input must already be copied from a pin before any asynchronous boundary.
/// Historical snapshots grant no input authority and are not complete frames.
///
/// # Errors
/// Rejects invalid format/identity/version, caps, malformed derived cells,
/// truncated records and trailing bytes. Raw cell bytes need not be UTF-8.
pub fn parse(bytes: &[u8], expected_build_id: &str) -> Result<Snapshot, Error> {
    if bytes.len() > MAX_BYTES || expected_build_id.is_empty() || expected_build_id.len() > 256 {
        return Err(Error::Bounds);
    }
    let mut reader = Reader::new(bytes);
    if reader.take(4)? != b"CDTP" { return Err(Error::Format); }
    if reader.short()? != 1 { return Err(Error::Version); }
    if reader.short()? != 0 { return Err(Error::Format); } // full canvas is unsupported
    let publication = reader.u64()?;
    if publication == 0 { return Err(Error::Format); }
    if reader.take(40)? != SOURCE_COMMIT { return Err(Error::Identity); }
    let build_size = reader.size(256)?;
    let build_id = std::str::from_utf8(reader.take(build_size)?).map_err(|_| Error::Identity)?;
    if build_id != expected_build_id { return Err(Error::Identity); }
    let windows_size = reader.size(MAX_WINDOWS)?;
    let mut windows = Vec::with_capacity(windows_size);
    let mut cells_seen = 0_usize;
    for _ in 0..windows_size {
        let record_size = reader.size(MAX_BYTES)?;
        let mut record = Reader::new(reader.take(record_size)?);
        windows.push(parse_window(&mut record, &mut cells_seen)?);
        if !record.finished() { return Err(Error::Trailing); }
    }
    if !reader.finished() { return Err(Error::Trailing); }
    Ok(Snapshot { publication, build_id: build_id.to_owned(), windows })
}

#[cfg(test)]
mod tests;
