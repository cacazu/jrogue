//! The presentation layer receives cells from Angband's terminal hooks.
//! It has no access to the C game state, random number generator, or storage.

use std::fmt::Write;

/// Default terminal columns. Logical resizing is separate from CSS scaling.
pub const WIDTH: usize = 100;
/// Default terminal rows.
pub const HEIGHT: usize = 32;
pub const MAX_DIMENSION: usize = 255;

/// An original terminal code point and Angband palette index.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Cell {
    pub codepoint: u32,
    pub color: u32,
}

const EMPTY: Cell = Cell {
    codepoint: 32,
    color: 0,
};

/// An owned immutable frame for the browser to render.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Snapshot {
    pub width: usize,
    pub height: usize,
    pub cells: Vec<Cell>,
    pub cursor: Option<(usize, usize)>,
}

/// Mutable terminal adapter; gameplay never lives in this type.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Screen {
    frame: Snapshot,
}

impl Default for Screen {
    fn default() -> Self {
        Self {
            frame: Snapshot {
                width: WIDTH, height: HEIGHT,
                cells: vec![EMPTY; WIDTH * HEIGHT],
                cursor: None,
            },
        }
    }
}

impl Screen {
    pub fn dimensions(&self) -> (usize, usize) { (self.frame.width, self.frame.height) }

    /// Validate before allocation, preserve the overlapping native cells, and
    /// clear added space. C alone decides whether a logical resize is accepted.
    pub fn resize(&mut self, width: usize, height: usize) -> bool {
        if width == 0 || height == 0 || width > MAX_DIMENSION || height > MAX_DIMENSION {
            return false;
        }
        let Some(count) = width.checked_mul(height) else { return false; };
        let mut cells = vec![EMPTY; count];
        for row in 0..height.min(self.frame.height) {
            let count = width.min(self.frame.width);
            cells[row * width..row * width + count]
                .copy_from_slice(&self.frame.cells[row * self.frame.width..row * self.frame.width + count]);
        }
        self.frame.cursor = self.frame.cursor.filter(|&(x,y)| x < width && y < height);
        self.frame.width = width; self.frame.height = height; self.frame.cells = cells;
        true
    }
    /// Clear terminal cells and the visible cursor.
    pub fn clear(&mut self) {
        self.frame.cells.fill(EMPTY);
        self.frame.cursor = None;
    }

    /// Copy a Unicode scalar span, clipping it to the current terminal.
    /// Invalid scalar values are visibly replaced rather than dropped.
    pub fn text(&mut self, x: i32, y: i32, color: u32, text: &[u32]) {
        let Ok(row) = usize::try_from(y) else { return };
        if row >= self.frame.height {
            return;
        }
        for (offset, &codepoint) in text.iter().enumerate() {
            let col = i64::from(x) + i64::try_from(offset).unwrap_or(i64::MAX);
            if !(0..self.frame.width as i64).contains(&col) {
                continue;
            }
            self.frame.cells[row * self.frame.width + col as usize] = Cell {
                codepoint: char::from_u32(codepoint).map_or(0xfffd, u32::from),
                color,
            };
        }
    }

    /// Wipe a horizontal span, clipping to the terminal.
    pub fn wipe(&mut self, x: i32, y: i32, n: i32) {
        let Ok(row) = usize::try_from(y) else { return };
        if row >= self.frame.height || n <= 0 {
            return;
        }
        let start = i64::from(x).clamp(0, self.frame.width as i64) as usize;
        let end = (i64::from(x) + i64::from(n)).clamp(0, self.frame.width as i64) as usize;
        if start < end {
            self.frame.cells[row * self.frame.width + start..row * self.frame.width + end].fill(EMPTY);
        }
    }

    /// Set a visible cursor; coordinates outside the screen hide it.
    pub fn cursor(&mut self, x: i32, y: i32) {
        self.frame.cursor = match (usize::try_from(x), usize::try_from(y)) {
            (Ok(x), Ok(y)) if x < self.frame.width && y < self.frame.height => Some((x, y)),
            _ => None,
        };
    }

    /// Take a detached snapshot; subsequent terminal updates cannot alter it.
    pub fn snapshot(&self) -> Snapshot {
        self.frame.clone()
    }
}

impl Snapshot {
    /// Pure stable JSON with numeric code points, palette indices, and cursor.
    /// ASCII, CJK, and supplementary Unicode are preserved exactly.
    #[must_use]
    pub fn encode_json(&self) -> String {
        let mut out = String::with_capacity(self.cells.len() * 10 + 80);
        let _ = write!(out, "{{\"width\":{},\"height\":{},\"cursor\":", self.width, self.height);
        if let Some((x, y)) = self.cursor {
            let _ = write!(out, "[{x},{y}]");
        } else {
            out.push_str("null");
        }
        out.push_str(",\"cells\":[");
        for (index, cell) in self.cells.iter().enumerate() {
            if index != 0 {
                out.push(',');
            }
            let _ = write!(out, "[{},{}]", cell.codepoint, cell.color);
        }
        out.push_str("]}");
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logical_resize_preserves_overlap_clips_cursor_and_rejects_before_mutation() {
        let mut screen = Screen::default();
        screen.text(99,31,7,&[u32::from('龍')]); screen.cursor(99,31);
        let detached = screen.snapshot();
        assert!(screen.resize(120,40));
        assert_eq!(screen.snapshot().cells[31*120+99].codepoint,u32::from('龍'));
        assert_eq!(screen.snapshot().cells[39*120+119],EMPTY);
        assert!(screen.resize(80,24)); assert_eq!(screen.snapshot().cursor,None);
        let before = screen.clone();
        for (width,height) in [(0,24),(80,0),(256,24),(80,256),(usize::MAX,usize::MAX)] {
            assert!(!screen.resize(width,height)); assert_eq!(screen,before);
        }
        assert_eq!(detached.width,100); assert_eq!(detached.cells[3199].codepoint,u32::from('龍'));
        assert!(screen.resize(255,255)); screen.text(254,254,2,&[64]);
        assert_eq!(screen.snapshot().cells[65024].codepoint,64);
        assert!(screen.snapshot().encode_json().starts_with("{\"width\":255,\"height\":255,"));
    }

    #[test]
    fn immutable_rendering_does_not_change_terminal_or_detached_snapshot() {
        let mut screen = Screen::default();
        screen.text(0, 0, 4, &[u32::from('@'), u32::from('龍'), 0x1f409]);
        screen.cursor(2, 0);
        let snapshot = screen.snapshot();
        let before = screen.clone();
        let one = snapshot.encode_json();
        let two = snapshot.encode_json();
        assert_eq!(one, two);
        assert_eq!(screen, before);
        assert!(one.starts_with(
            "{\"width\":100,\"height\":32,\"cursor\":[2,0],\"cells\":[[64,4],[40845,4],[128009,4]"
        ));
        screen.clear();
        assert_eq!(snapshot.cells[0].codepoint, 64);
    }

    #[test]
    fn clipping_handles_negative_and_extreme_coordinates() {
        let mut screen = Screen::default();
        screen.text(-1, 0, 2, &[65, 66, 67]);
        screen.text(99, 31, 3, &[68, 69]);
        screen.text(i32::MAX, i32::MAX, 1, &[70]);
        assert_eq!(
            screen.snapshot().cells[0],
            Cell {
                codepoint: 66,
                color: 2
            }
        );
        assert_eq!(screen.snapshot().cells[3199].codepoint, 68);
        screen.wipe(-1, 0, 2);
        assert_eq!(screen.snapshot().cells[0], EMPTY);
        assert_eq!(screen.snapshot().cells[1].codepoint, 67);
        screen.wipe(i32::MAX, 0, i32::MAX);
    }

    #[test]
    fn invalid_scalars_are_replaced_and_outside_cursor_is_hidden() {
        let mut screen = Screen::default();
        screen.text(0, 0, 1, &[0xd800, 0x110000]);
        screen.cursor(-1, 1);
        assert_eq!(screen.snapshot().cursor, None);
        assert_eq!(screen.snapshot().cells[0].codepoint, 0xfffd);
    }
}
