//! Strict immutable presentation boundary for the preserved Pascal core.
//! The DRLF wire frame is copied from core memory before decoding. Text overlays
//! retain UTF-8 and are laid out in Rust instead of the original byte glyph path.
use serde::{Deserialize, Serialize};
use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthStr;

pub const WIDTH: u32 = 80;
pub const HEIGHT: u32 = 25;
pub const FRAME_BYTES: usize = 32 + WIDTH as usize * HEIGHT as usize * 12;
pub const MAX_TEXT_BYTES: usize = 65_536;

pub const PALETTE: [&str; 16] = [
    "#000000", "#0000aa", "#00aa00", "#00aaaa", "#aa0000", "#aa00aa", "#aa5500", "#aaaaaa",
    "#555555", "#5555ff", "#55ff55", "#55ffff", "#ff5555", "#ff55ff", "#ffff55", "#ffffff",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    InvalidLength,
    InvalidMagic,
    UnsupportedVersion,
    InvalidDimensions,
    InvalidCursor,
    InvalidReserved,
    InvalidGlyph,
    InvalidColor,
    InvalidText,
    InvalidClip,
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for Error {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cell {
    pub glyph: char,
    pub foreground: u8,
    pub background: u8,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    cells: Vec<Cell>,
    /// Zero-based coordinates; Pascal's one-based cursor is adapted at its seam.
    cursor: Option<(u32, u32)>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Glyph {
    pub x: u32,
    pub y: u32,
    pub columns: u32,
    pub text: String,
    pub foreground: String,
    pub background: String,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Projection {
    pub width: u32,
    pub height: u32,
    pub cursor: Option<(u32, u32)>,
    pub glyphs: Vec<Glyph>,
    pub commands: Vec<DrawOperation>,
}
fn u32_at(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(
        bytes[offset..offset + 4]
            .try_into()
            .expect("validated fixed-size frame"),
    )
}

impl Frame {
    pub fn decode(bytes: &[u8]) -> Result<Self, Error> {
        if bytes.len() != FRAME_BYTES {
            return Err(Error::InvalidLength);
        }
        if &bytes[..4] != b"DRLF" {
            return Err(Error::InvalidMagic);
        }
        if u32_at(bytes, 4) != 1 {
            return Err(Error::UnsupportedVersion);
        }
        if u32_at(bytes, 8) != WIDTH || u32_at(bytes, 12) != HEIGHT {
            return Err(Error::InvalidDimensions);
        }
        let flags = u32_at(bytes, 28);
        if flags > 1 {
            return Err(Error::InvalidReserved);
        }
        let x = u32_at(bytes, 16) as i32;
        let y = u32_at(bytes, 20) as i32;
        let visible = u32_at(bytes, 24);
        if visible > 1 {
            return Err(Error::InvalidCursor);
        }
        let cursor = if visible == 1 {
            if !(0..WIDTH as i32).contains(&x) || !(0..HEIGHT as i32).contains(&y) {
                return Err(Error::InvalidCursor);
            }
            Some((x as u32, y as u32))
        } else {
            None
        };
        let mut cells = Vec::with_capacity((WIDTH * HEIGHT) as usize);
        for offset in (32..FRAME_BYTES).step_by(12) {
            let scalar = u32_at(bytes, offset);
            let glyph = if flags == 1 {
                cp437(scalar)?
            } else if scalar == 0 {
                ' '
            } else {
                char::from_u32(scalar).ok_or(Error::InvalidGlyph)?
            };
            if glyph.is_control() || (flags == 0 && glyph.to_string().width() != 1) {
                return Err(Error::InvalidGlyph);
            }
            let foreground = u32_at(bytes, offset + 4);
            let background = u32_at(bytes, offset + 8);
            if foreground > 15 || background > 15 {
                return Err(Error::InvalidColor);
            }
            cells.push(Cell {
                glyph,
                foreground: foreground as u8,
                background: background as u8,
            });
        }
        Ok(Self { cells, cursor })
    }
    pub fn project(&self) -> Projection {
        Projection {
            width: WIDTH,
            height: HEIGHT,
            cursor: self.cursor,
            glyphs: self
                .cells
                .iter()
                .enumerate()
                .map(|(i, cell)| Glyph {
                    x: i as u32 % WIDTH,
                    y: i as u32 / WIDTH,
                    columns: 1,
                    text: cell.glyph.to_string(),
                    foreground: PALETTE[usize::from(cell.foreground)].into(),
                    background: PALETTE[usize::from(cell.background)].into(),
                })
                .collect(),
            commands: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DrawOperation {
    Glyph(Glyph),
    Clear {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
        background: String,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WireCommand {
    pub header: Vec<u8>,
    pub text: Vec<u8>,
}
#[derive(Debug, Clone, Copy)]
struct Rectangle {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}
impl Rectangle {
    fn read(bytes: &[u8], offset: usize) -> Result<Self, Error> {
        let rect = Self {
            x: u32_at(bytes, offset) as i32,
            y: u32_at(bytes, offset + 4) as i32,
            width: u32_at(bytes, offset + 8),
            height: u32_at(bytes, offset + 12),
        };
        if !(-4096..=4096).contains(&rect.x)
            || !(-4096..=4096).contains(&rect.y)
            || rect.width > 4096
            || rect.height > 4096
        {
            return Err(Error::InvalidClip);
        }
        Ok(rect)
    }
    fn intersection(self, other: Self) -> Option<Self> {
        let x = self.x.max(other.x).max(0);
        let y = self.y.max(other.y).max(0);
        let right = (self.x + self.width as i32)
            .min(other.x + other.width as i32)
            .min(WIDTH as i32);
        let bottom = (self.y + self.height as i32)
            .min(other.y + other.height as i32)
            .min(HEIGHT as i32);
        (right > x && bottom > y).then_some(Self {
            x,
            y,
            width: (right - x).max(0) as u32,
            height: (bottom - y).max(0) as u32,
        })
    }
    fn contains(self, x: i32, y: i32, columns: u32) -> bool {
        x >= self.x
            && y >= self.y
            && x + columns as i32 <= self.x + self.width as i32
            && y < self.y + self.height as i32
    }
}
pub const COLOR_NONE: u32 = 0xefff_ffff;
struct Painter<'a> {
    ops: &'a mut Vec<DrawOperation>,
    styles: &'a mut [(u8, u8)],
    clip: Rectangle,
    overflow: &'a mut bool,
}
impl Painter<'_> {
    fn glyph(&mut self, x: i32, y: i32, columns: u32, mut text: String, fg: u32, bg: u32) {
        if !self.clip.contains(x, y, columns) {
            return;
        }
        if self.ops.len() >= 16_384 {
            *self.overflow = true;
            return;
        }
        let index = y as usize * WIDTH as usize + x as usize;
        let (_, old_bg) = self.styles[index];
        let (fg, bg) = if bg == COLOR_NONE {
            if fg == COLOR_NONE {
                return;
            }
            if fg & 0xf0 != 0 {
                ((fg & 15) as u8, ((fg >> 4) & 15) as u8)
            } else {
                ((fg & 15) as u8, old_bg)
            }
        } else if fg == COLOR_NONE {
            text = " ".into();
            (0, (bg & 15) as u8)
        } else {
            ((fg & 15) as u8, (bg & 15) as u8)
        };
        for i in index..index + columns as usize {
            self.styles[i] = (fg, bg);
        }
        self.ops.push(DrawOperation::Glyph(Glyph {
            x: x as u32,
            y: y as u32,
            columns,
            text,
            foreground: PALETTE[usize::from(fg)].into(),
            background: PALETTE[usize::from(bg)].into(),
        }));
    }
    fn clear(&mut self, area: Rectangle, bg: u32) {
        for y in area.y..area.y + area.height as i32 {
            for x in area.x..area.x + area.width as i32 {
                if *self.overflow {
                    return;
                }
                let (fg, old_bg) = self.styles[y as usize * WIDTH as usize + x as usize];
                self.glyph(
                    x,
                    y,
                    1,
                    " ".into(),
                    if bg == COLOR_NONE { u32::from(fg) } else { 7 },
                    if bg == COLOR_NONE {
                        u32::from(old_bg)
                    } else {
                        bg
                    },
                );
            }
        }
    }
}

/// Preserve the ordered original text/clear/frame/border/ruler/bar instructions;
/// interpret glyph encoding, clipping and UTF-8 layout in Rust, never JavaScript.
pub fn project_with_commands(bytes: &[u8], commands: &[WireCommand]) -> Result<Projection, Error> {
    let text_bytes = commands
        .iter()
        .try_fold(0_usize, |total, command| {
            total.checked_add(command.text.len())
        })
        .ok_or(Error::InvalidLength)?;
    if commands.len() > 1024 || text_bytes > MAX_TEXT_BYTES {
        return Err(Error::InvalidLength);
    }
    let frame = Frame::decode(bytes)?;
    let mut styles: Vec<_> = frame
        .cells
        .iter()
        .map(|c| (c.foreground, c.background))
        .collect();
    let mut projection = frame.project();
    let ops = &mut projection.commands;
    let mut overflow = false;
    for command in commands {
        let header = &command.header;
        if header.len() != 64 {
            return Err(Error::InvalidLength);
        }
        if u32_at(header, 0) != 1 {
            return Err(Error::UnsupportedVersion);
        }
        let kind = u32_at(header, 4);
        if kind > 5 || u32_at(header, 52) > 1 || u32_at(header, 56) != 0 || u32_at(header, 60) != 0
        {
            return Err(Error::InvalidReserved);
        }
        let area = Rectangle::read(header, 8)?;
        let clipping = Rectangle::read(header, 24)?;
        let colors = [u32_at(header, 40), u32_at(header, 44), u32_at(header, 48)];
        if colors
            .iter()
            .any(|color| *color > 255 && *color != COLOR_NONE)
        {
            return Err(Error::InvalidColor);
        }
        let [fg, bg, xc] = colors;
        let native = u32_at(header, 52) == 1;
        let text = if native {
            command
                .text
                .iter()
                .map(|b| cp437(u32::from(*b)))
                .collect::<Result<String, _>>()?
        } else {
            std::str::from_utf8(&command.text)
                .map_err(|_| Error::InvalidText)?
                .into()
        };
        let glyphs: Vec<char> = if kind == 0 {
            text_columns(&text)?;
            Vec::new()
        } else {
            let glyphs: Vec<char> = text.chars().collect();
            let required = match kind {
                1 => 0,
                2 | 3 => 8,
                4 => 2,
                5 => 3,
                _ => unreachable!(),
            };
            if glyphs.len() != required
                || glyphs
                    .iter()
                    .any(|c| c.is_control() || c.to_string().width() != 1)
            {
                return Err(Error::InvalidGlyph);
            }
            glyphs
        };
        let screen = Rectangle {
            x: 0,
            y: 0,
            width: WIDTH,
            height: HEIGHT,
        };
        let Some(clip) = clipping.intersection(screen) else {
            continue;
        };
        let mut painter = Painter {
            ops,
            styles: &mut styles,
            clip,
            overflow: &mut overflow,
        };
        if kind == 0 {
            let mut x = area.x;
            let mut y = area.y;
            for cluster in text.graphemes(true) {
                if cluster == "\r" {
                    continue;
                }
                if cluster == "\n" || cluster == "\r\n" {
                    x = area.x;
                    y += 1;
                    continue;
                }
                let columns = if native {
                    1
                } else {
                    cluster.width_cjk().max(1) as u32
                };
                if x + columns as i32 > clip.x + clip.width as i32 {
                    x = area.x;
                    y += 1;
                }
                if y >= clip.y + clip.height as i32 {
                    break;
                }
                let text = if cluster.width_cjk() == 0 {
                    format!("\u{25cc}{cluster}")
                } else {
                    cluster.into()
                };
                painter.glyph(x, y, columns, text, fg, bg);
                x += columns as i32;
            }
        } else {
            let Some(area_clip) = area.intersection(clip) else {
                continue;
            };
            if kind == 1 || kind == 2 {
                painter.clear(area_clip, bg);
            }
            if kind == 1 {
                if overflow {
                    return Err(Error::InvalidLength);
                }
                continue;
            }
            let right = area.x + area.width as i32 - 1;
            let bottom = area.y + area.height as i32 - 1;
            if kind == 4 || kind == 5 {
                let glyph = if kind == 5 {
                    glyphs[2]
                } else if area.width == 1 {
                    glyphs[1]
                } else {
                    glyphs[0]
                };
                for y in area_clip.y..area_clip.y + area_clip.height as i32 {
                    for x in area_clip.x..area_clip.x + area_clip.width as i32 {
                        painter.glyph(x, y, 1, glyph.into(), if kind == 5 { xc } else { fg }, bg);
                    }
                }
                if kind == 5 {
                    painter.glyph(area.x, area.y, 1, glyphs[0].into(), fg, bg);
                    painter.glyph(right, bottom, 1, glyphs[1].into(), fg, bg);
                }
            } else {
                for x in area_clip.x..area_clip.x + area_clip.width as i32 {
                    painter.glyph(x, area.y, 1, glyphs[0].into(), fg, bg);
                    painter.glyph(x, bottom, 1, glyphs[1].into(), fg, bg);
                }
                for y in area_clip.y..area_clip.y + area_clip.height as i32 {
                    painter.glyph(area.x, y, 1, glyphs[2].into(), fg, bg);
                    painter.glyph(right, y, 1, glyphs[3].into(), fg, bg);
                }
                for (x, y, glyph) in [
                    (area.x, area.y, glyphs[4]),
                    (right, area.y, glyphs[5]),
                    (area.x, bottom, glyphs[6]),
                    (right, bottom, glyphs[7]),
                ] {
                    painter.glyph(x, y, 1, glyph.into(), fg, bg);
                }
            }
        }
        if overflow {
            return Err(Error::InvalidLength);
        }
    }
    Ok(projection)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Clip {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TextLayout {
    pub glyphs: Vec<Glyph>,
    pub end_x: u32,
    pub end_y: u32,
    pub clipped: bool,
}

/// CJK width follows Unicode East Asian display width; grapheme clusters keep
/// external names, combining marks, emoji and UTF-8 intact. Native style/substitution
/// parsing happens before this function; this boundary takes literal display text.
pub fn text_columns(text: &str) -> Result<u32, Error> {
    if text.len() > MAX_TEXT_BYTES
        || text
            .chars()
            .any(|c| c.is_control() && c != '\n' && c != '\r')
    {
        return Err(Error::InvalidText);
    }
    u32::try_from(
        text.split('\n')
            .map(|line| {
                line.graphemes(true)
                    .filter(|cluster| *cluster != "\r")
                    .map(|g| g.width_cjk().max(1))
                    .sum::<usize>()
            })
            .max()
            .unwrap_or(0),
    )
    .map_err(|_| Error::InvalidText)
}

/// Return bytes of the longest complete grapheme prefix that fits a column budget.
/// VTIG's original-language controller can use this result without slicing UTF-8.
pub fn text_fit(text: &str, max_columns: u32) -> Result<usize, Error> {
    text_columns(text)?;
    let mut used = 0_u32;
    let mut end = 0;
    for (offset, cluster) in text.grapheme_indices(true) {
        if cluster.contains('\n') {
            break;
        }
        if cluster == "\r" {
            end = offset + cluster.len();
            continue;
        }
        let columns = u32::try_from(cluster.width_cjk())
            .map_err(|_| Error::InvalidText)?
            .max(1);
        if used
            .checked_add(columns)
            .is_none_or(|sum| sum > max_columns)
        {
            break;
        }
        used += columns;
        end = offset + cluster.len();
    }
    Ok(end)
}

pub fn layout_text(
    text: &str,
    clip: Clip,
    foreground: u8,
    background: u8,
) -> Result<TextLayout, Error> {
    text_columns(text)?;
    if clip.width == 0
        || clip.height == 0
        || clip.x.checked_add(clip.width).is_none_or(|x| x > WIDTH)
        || clip.y.checked_add(clip.height).is_none_or(|y| y > HEIGHT)
    {
        return Err(Error::InvalidClip);
    }
    if foreground > 15 || background > 15 {
        return Err(Error::InvalidColor);
    }
    let mut x = clip.x;
    let mut y = clip.y;
    let right = clip.x + clip.width;
    let bottom = clip.y + clip.height;
    let mut glyphs = Vec::new();
    let mut clipped = false;
    for cluster in text.graphemes(true) {
        if cluster == "\r" {
            continue;
        }
        if cluster == "\n" || cluster == "\r\n" {
            x = clip.x;
            y += 1;
            continue;
        }
        let raw_columns = u32::try_from(cluster.width_cjk()).map_err(|_| Error::InvalidText)?;
        let columns = raw_columns.max(1);
        if columns > clip.width {
            clipped = true;
            continue;
        }
        if x + columns > right {
            x = clip.x;
            y += 1;
        }
        if y >= bottom {
            clipped = true;
            break;
        }
        if raw_columns == 0 {
            // A leading standalone combining mark has no placement in a cell grid.
            // Retain it with a dotted-circle base rather than dropping user text.
            glyphs.push(Glyph {
                x,
                y,
                columns: 1,
                text: format!("\u{25cc}{cluster}"),
                foreground: PALETTE[usize::from(foreground)].into(),
                background: PALETTE[usize::from(background)].into(),
            });
            x += 1;
            continue;
        }
        glyphs.push(Glyph {
            x,
            y,
            columns,
            text: cluster.into(),
            foreground: PALETTE[usize::from(foreground)].into(),
            background: PALETTE[usize::from(background)].into(),
        });
        x += columns;
    }
    Ok(TextLayout {
        glyphs,
        end_x: x,
        end_y: y.min(bottom),
        clipped,
    })
}

fn cp437(value: u32) -> Result<char, Error> {
    const CONTROLS: &str = " ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼";
    const HIGH: &str = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u{a0}";
    match value {
        0..=31 => CONTROLS
            .chars()
            .nth(value as usize)
            .ok_or(Error::InvalidGlyph),
        32..=126 => char::from_u32(value).ok_or(Error::InvalidGlyph),
        127 => Ok('⌂'),
        128..=255 => HIGH
            .chars()
            .nth(value as usize - 128)
            .ok_or(Error::InvalidGlyph),
        _ => Err(Error::InvalidGlyph),
    }
}
