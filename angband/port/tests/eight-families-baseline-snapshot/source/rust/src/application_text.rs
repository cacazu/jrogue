//! Pure application policy for Angband 4.2.6's default UTF-8 text editor.
//!
//! The C producer captures one initialized string, byte capacity, scalar cursor
//! and key event. This module returns an owned edit and effects; it never reads
//! engine state, calls a terminal, translates user text or consumes randomness.
//! Source: ui-input.c askfor_aux_keypress and z-util.c utf32_isprint, pinned
//! upstream f3082213b73f3e463e3d0d60bff4b00462beae6e. DELETE intentionally fixes
//! the original scalar-cursor-as-byte-offset error. Other valid-input semantics
//! follow the original, including first-time replacement and ignored modifiers.

use std::fmt;

/// Maximum accepted byte capacity, including the trailing C NUL.
pub const MAX_BUFFER_BYTES: usize = 65_536;
/// Number of u32 words in the versioned adapter effect.
pub const EFFECT_WORDS: usize = 8;
/// Effect wire version.
pub const EFFECT_VERSION: u32 = 1;
/// Native key identities from ui-event.h, not browser or ASCII aliases.
pub const ESCAPE: u32 = 0xe000;
pub const KC_ENTER: u32 = 0x9c;
pub const ARROW_LEFT: u32 = 0x81;
pub const ARROW_RIGHT: u32 = 0x82;
pub const KC_DELETE: u32 = 0x9e;
pub const KC_BACKSPACE: u32 = 0x9f;
/// End this editor invocation, preserving the original caller's accept policy.
pub const DONE: u32 = 1;
/// Execute the original terminal bell once.
pub const BELL: u32 = 2;
/// The returned string differs from the captured string.
pub const CHANGED: u32 = 4;
/// A valid printable scalar could not fit alongside the trailing NUL.
pub const CAPACITY_REFUSED: u32 = 8;

/// An immutable, already-decoded snapshot captured before one original key.
#[derive(Clone, Copy, Debug)]
pub struct Snapshot<'a> {
    pub text: &'a str,
    pub byte_capacity: usize,
    pub scalar_cursor: usize,
    pub first_time: bool,
}

/// The default editor handles code literally and deliberately ignores modifiers.
/// Modifier encoding/coercion remains at the original upstream input producer.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Keypress {
    pub code: u32,
    pub modifiers: u32,
}

/// Owned result that an adapter applies only after validating the full effect.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Edit {
    pub text: String,
    pub scalar_cursor: usize,
    pub scalar_count: usize,
    pub flags: u32,
}

/// Explicit capture errors do not select an unsafe original C fallback.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextInputError {
    InvalidCapacity,
    InvalidBuffer,
    InvalidCursor,
    InvalidModifiers,
}
impl TextInputError {
    /// Stable negative adapter status.
    pub const fn status(self) -> i32 {
        match self {
            Self::InvalidCapacity => -300,
            Self::InvalidBuffer => -301,
            Self::InvalidCursor => -302,
            Self::InvalidModifiers => -303,
        }
    }
}
impl fmt::Display for TextInputError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "text input capture: {self:?}")
    }
}
impl std::error::Error for TextInputError {}

impl Edit {
    /// Stable u32 effect: version, scalar cursor, UTF-8 length, scalar count,
    /// flags, and three reserved zero words. All values are capacity-bounded.
    pub fn effect_words(&self) -> Result<[u32; EFFECT_WORDS], TextInputError> {
        Ok([
            EFFECT_VERSION,
            u32::try_from(self.scalar_cursor).map_err(|_| TextInputError::InvalidCursor)?,
            u32::try_from(self.text.len()).map_err(|_| TextInputError::InvalidBuffer)?,
            u32::try_from(self.scalar_count).map_err(|_| TextInputError::InvalidBuffer)?,
            self.flags,
            0, 0, 0,
        ])
    }
}

/// Source-equivalent printability plus the utf32_to_utf8 scalar validity bound.
/// This deliberately is not Rust char::is_control or a locale-dependent test:
/// upstream accepts combining marks and private-use planes, excludes variation
/// selectors, and treats currently-unassigned planes 4 through 14 as unprintable.
pub fn keycode_is_printable(code: u32) -> bool {
    if code == ESCAPE || char::from_u32(code).is_none() { return false; }
    let plane = code >> 16;
    if (4..=14).contains(&plane) || code & 0xfffe == 0xfffe { return false; }
    if plane != 0 { return true; }
    !((code <= 0x1f)
        || (0x7f..=0x9f).contains(&code)
        || (0xfdd0..=0xfdef).contains(&code)
        || (0xfe00..=0xfe0f).contains(&code)
        || code == 0xfeff
        || (0xfff9..=0xfffb).contains(&code))
}

fn scalar_byte_offset(text: &str, cursor: usize, count: usize) -> Option<usize> {
    if cursor == count { Some(text.len()) }
    else { text.char_indices().nth(cursor).map(|(offset, _)| offset) }
}

/// Choose the trailing NUL position for a bounded initial default prefix.
/// The adapter reads at most capacity-1 bytes, ending earlier at the first NUL.
/// An incomplete final UTF-8 scalar caused by that bound is removed; malformed
/// bytes earlier in the prefix are rejected. The original ASCII truncation is
/// byte-identical and no byte beyond the captured prefix is inspected.
///
/// # Errors
/// Rejects invalid capacities, oversized/NUL-containing prefixes and malformed
/// UTF-8 other than a single incomplete sequence at the captured end.
pub fn truncate_prefix(prefix: &[u8], byte_capacity: usize) -> Result<usize, TextInputError> {
    if !(1..=MAX_BUFFER_BYTES).contains(&byte_capacity) {
        return Err(TextInputError::InvalidCapacity);
    }
    if prefix.len() >= byte_capacity || prefix.contains(&0) {
        return Err(TextInputError::InvalidBuffer);
    }
    match std::str::from_utf8(prefix) {
        Ok(_) => Ok(prefix.len()),
        Err(error) if error.error_len().is_none() => Ok(error.valid_up_to()),
        Err(_) => Err(TextInputError::InvalidBuffer),
    }
}

/// Apply one original default-editor key to an immutable valid snapshot.
///
/// # Errors
/// Rejects a zero/excessive capacity, embedded NUL, overflowing initial text,
/// scalar cursor beyond the string, or modifiers outside the native u8 field.
/// Capacity refusal is an ordinary effect (without a bell), not an error.
pub fn edit(snapshot: Snapshot<'_>, key: Keypress) -> Result<Edit, TextInputError> {
    if !(1..=MAX_BUFFER_BYTES).contains(&snapshot.byte_capacity) {
        return Err(TextInputError::InvalidCapacity);
    }
    if snapshot.text.len() >= snapshot.byte_capacity || snapshot.text.contains('\0') {
        return Err(TextInputError::InvalidBuffer);
    }
    let original_count = snapshot.text.chars().count();
    if snapshot.scalar_cursor > original_count { return Err(TextInputError::InvalidCursor); }
    if key.modifiers > u32::from(u8::MAX) { return Err(TextInputError::InvalidModifiers); }

    let mut text = snapshot.text.to_owned();
    let mut cursor = snapshot.scalar_cursor;
    let mut flags = 0;
    match key.code {
        ESCAPE => { cursor = 0; flags |= DONE; }
        KC_ENTER => { cursor = original_count; flags |= DONE; }
        ARROW_LEFT => {
            if snapshot.first_time { cursor = 0; }
            else { cursor = cursor.saturating_sub(1); }
        }
        ARROW_RIGHT => {
            if snapshot.first_time { cursor = original_count; }
            else if cursor < original_count { cursor += 1; }
        }
        KC_BACKSPACE | KC_DELETE => {
            if snapshot.first_time {
                text.clear(); cursor = 0;
            } else if (key.code == KC_BACKSPACE && cursor != 0)
                || (key.code == KC_DELETE && cursor < original_count) {
                let remove_cursor = if key.code == KC_BACKSPACE { cursor - 1 } else { cursor };
                let start = scalar_byte_offset(&text, remove_cursor, original_count)
                    .ok_or(TextInputError::InvalidCursor)?;
                let end = scalar_byte_offset(&text, remove_cursor + 1, original_count)
                    .ok_or(TextInputError::InvalidCursor)?;
                text.replace_range(start..end, "");
                if key.code == KC_BACKSPACE { cursor -= 1; }
            }
        }
        code => {
            if !keycode_is_printable(code) {
                flags |= BELL;
            } else {
                let scalar = char::from_u32(code).ok_or(TextInputError::InvalidBuffer)?;
                if snapshot.first_time { text.clear(); cursor = 0; }
                // Capacity includes NUL, exactly as the original *len+n_enc >= buflen.
                if scalar.len_utf8() >= snapshot.byte_capacity - text.len() {
                    flags |= CAPACITY_REFUSED;
                } else {
                    let count = if snapshot.first_time { 0 } else { original_count };
                    let byte_cursor = scalar_byte_offset(&text, cursor, count)
                        .ok_or(TextInputError::InvalidCursor)?;
                    text.insert(byte_cursor, scalar);
                    cursor += 1;
                }
            }
        }
    }
    if text != snapshot.text { flags |= CHANGED; }
    Ok(Edit { scalar_count: text.chars().count(), text, scalar_cursor: cursor, flags })
}

// AB_TEXT_FFI_BOUNDARY: pointer adapters are separate from the pure reducer.

fn checked_span(pointer: *const u8, length: usize) -> Result<std::ops::Range<usize>, TextInputError> {
    if length != 0 && pointer.is_null() { return Err(TextInputError::InvalidBuffer); }
    if length > isize::MAX as usize { return Err(TextInputError::InvalidBuffer); }
    let start = pointer as usize;
    let end = start.checked_add(length).ok_or(TextInputError::InvalidBuffer)?;
    #[cfg(target_arch = "wasm32")]
    {
        let memory_bytes = (core::arch::wasm32::memory_size(0) as u64) * 65_536;
        if end as u64 > memory_bytes { return Err(TextInputError::InvalidBuffer); }
    }
    Ok(start..end)
}

fn spans_overlap(left: &std::ops::Range<usize>, right: &std::ops::Range<usize>) -> bool {
    !left.is_empty() && !right.is_empty() && left.start < right.end && right.start < left.end
}

fn aligned_words(pointer: *mut u32, count: usize) -> Result<std::ops::Range<usize>, TextInputError> {
    if (pointer as usize) % std::mem::align_of::<u32>() != 0 {
        return Err(TextInputError::InvalidBuffer);
    }
    let length = count.checked_mul(std::mem::size_of::<u32>()).ok_or(TextInputError::InvalidBuffer)?;
    checked_span(pointer.cast(), length)
}

/// Synchronously format one bounded editor snapshot into distinct output spans.
/// All validation and owned edit construction precede the first output write.
/// Negative statuses leave both output and effect unchanged.
///
/// # Safety
/// On native targets, each nonempty input span must refer to initialized readable
/// bytes and each output span must refer to live writable allocated storage for
/// this call; integer range checks cannot prove native allocation provenance.
/// On wasm32, spans must additionally be inside the current linear memory.
/// `text` is allowed to be null only for length zero. `output` has exactly
/// `output_capacity` writable bytes, and `effect` has exactly eight aligned
/// writable u32 words. These three spans must not overlap; aliases are rejected
/// before access. The C caller retains all ownership; no borrow escapes the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_text_edit(
    text: *const u8, length: u32, capacity: u32, cursor: u32, code: u32,
    modifiers: u32, first_time: u32, output: *mut u8, output_capacity: u32,
    effect: *mut u32, effect_words: u32,
) -> i32 {
    let result = (|| -> Result<(), TextInputError> {
        let capacity = usize::try_from(capacity).map_err(|_| TextInputError::InvalidCapacity)?;
        let length = usize::try_from(length).map_err(|_| TextInputError::InvalidBuffer)?;
        if !(1..=MAX_BUFFER_BYTES).contains(&capacity) { return Err(TextInputError::InvalidCapacity); }
        if length >= capacity || first_time > 1
            || usize::try_from(output_capacity).ok() != Some(capacity)
            || usize::try_from(effect_words).ok() != Some(EFFECT_WORDS) {
            return Err(TextInputError::InvalidBuffer);
        }
        if modifiers > u32::from(u8::MAX) { return Err(TextInputError::InvalidModifiers); }
        let input_range = checked_span(text, length)?;
        let output_range = checked_span(output.cast_const(), capacity)?;
        let effect_range = aligned_words(effect, EFFECT_WORDS)?;
        if spans_overlap(&input_range, &output_range) || spans_overlap(&input_range, &effect_range)
            || spans_overlap(&output_range, &effect_range) { return Err(TextInputError::InvalidBuffer); }
        let bytes = if length == 0 { &[][..] } else {
            // SAFETY: bounded nonnull range validated above; the caller supplies
            // initialized readable bytes, and no output has yet been accessed.
            unsafe { std::slice::from_raw_parts(text, length) }
        };
        let original = std::str::from_utf8(bytes).map_err(|_| TextInputError::InvalidBuffer)?.to_owned();
        let edited = edit(Snapshot { text: &original, byte_capacity: capacity,
            scalar_cursor: usize::try_from(cursor).map_err(|_| TextInputError::InvalidCursor)?,
            first_time: first_time != 0 }, Keypress { code, modifiers })?;
        let words = edited.effect_words()?;
        if edited.text.len() >= capacity { return Err(TextInputError::InvalidBuffer); }
        // SAFETY: all output spans are live, bounded, aligned and mutually
        // disjoint by the caller contract and checks. The owned Rust string and
        // words are complete before this first write; no fallible step follows.
        unsafe {
            std::ptr::copy_nonoverlapping(edited.text.as_ptr(), output, edited.text.len());
            output.add(edited.text.len()).write(0);
            std::ptr::copy_nonoverlapping(words.as_ptr(), effect, EFFECT_WORDS);
        }
        Ok(())
    })();
    match result { Ok(()) => 0, Err(error) => error.status() }
}

/// Select a complete UTF-8 boundary from the same bounded native default prefix.
/// Errors leave the single output word unchanged; the C adapter applies NUL only
/// after this function succeeds.
///
/// # Safety
/// `prefix` must have `length` initialized readable bytes (or may be null for an
/// empty span). `terminator` must be live aligned writable u32 storage. On native
/// targets the caller guarantees allocation provenance; on wasm32 both spans
/// are checked against current linear memory. Spans must not overlap. Captured
/// bytes and returned offset are consumed synchronously; no borrow escapes.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_text_truncate(
    prefix: *const u8, length: u32, capacity: u32, terminator: *mut u32,
) -> i32 {
    let result = (|| -> Result<(), TextInputError> {
        let capacity = usize::try_from(capacity).map_err(|_| TextInputError::InvalidCapacity)?;
        let length = usize::try_from(length).map_err(|_| TextInputError::InvalidBuffer)?;
        if !(1..=MAX_BUFFER_BYTES).contains(&capacity) { return Err(TextInputError::InvalidCapacity); }
        if length >= capacity { return Err(TextInputError::InvalidBuffer); }
        let input_range = checked_span(prefix, length)?;
        let output_range = aligned_words(terminator, 1)?;
        if spans_overlap(&input_range, &output_range) { return Err(TextInputError::InvalidBuffer); }
        let bytes = if length == 0 { &[][..] } else {
            // SAFETY: caller supplies the initialized bounded input range;
            // checked_span rejected null, overflow and wasm out-of-memory spans.
            unsafe { std::slice::from_raw_parts(prefix, length) }
        };
        let end = truncate_prefix(bytes, capacity)?;
        let end = u32::try_from(end).map_err(|_| TextInputError::InvalidBuffer)?;
        // SAFETY: aligned live writable distinct word validated above; every
        // fallible validation/UTF-8 operation finished before this only write.
        unsafe { terminator.write(end); }
        Ok(())
    })();
    match result { Ok(()) => 0, Err(error) => error.status() }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn apply(text: &str, cursor: usize, capacity: usize, code: u32, first: bool) -> Edit {
        edit(Snapshot { text, byte_capacity: capacity, scalar_cursor: cursor, first_time: first },
            Keypress { code, modifiers: 0 }).unwrap()
    }

    #[test]
    fn first_time_controls_accept_cancel_move_clear_or_replace_exactly() {
        assert_eq!(apply("Default", 0, 16, KC_ENTER, true).scalar_cursor, 7);
        let esc = apply("Default", 4, 16, ESCAPE, true);
        assert_eq!((esc.text.as_str(), esc.scalar_cursor, esc.flags), ("Default", 0, DONE));
        assert_eq!(apply("Default", 4, 16, ARROW_LEFT, true).scalar_cursor, 0);
        assert_eq!(apply("Default", 0, 16, ARROW_RIGHT, true).scalar_cursor, 7);
        for code in [KC_BACKSPACE, KC_DELETE] {
            assert_eq!(apply("Default", 4, 16, code, true).text, "");
        }
        assert_eq!(apply("Default", 4, 16, u32::from('罠'), true).text, "罠");
        let invalid = apply("Default", 4, 16, 0x94, true); // Home has no native action.
        assert_eq!((invalid.text.as_str(), invalid.scalar_cursor, invalid.flags), ("Default", 4, BELL));
    }

    #[test]
    fn every_unicode_delete_and_backspace_cursor_preserves_valid_text_and_bounds() {
        for text in ["abcd", "罠龍日本", "A罠😀𠀀Z", "e\u{301}中", "罠罠罠罠罠罠罠罠罠罠罠罠罠罠罠罠罠罠罠罠罠罠罠罠"] {
            let scalars: Vec<char> = text.chars().collect();
            for cursor in 0..=scalars.len() {
                for code in [KC_DELETE, KC_BACKSPACE] {
                    let mut expected = scalars.clone();
                    let removed = if code == KC_DELETE && cursor < expected.len() { Some(cursor) }
                        else if code == KC_BACKSPACE && cursor > 0 { Some(cursor - 1) } else { None };
                    if let Some(index) = removed { expected.remove(index); }
                    let result = apply(text, cursor, text.len() + 1, code, false);
                    assert_eq!(result.text, expected.iter().collect::<String>());
                    assert!(result.text.len() < text.len() + 1);
                    assert_eq!(result.scalar_cursor, if code == KC_BACKSPACE && removed.is_some() { cursor - 1 } else { cursor });
                    assert_eq!(result.scalar_count, expected.len());
                    assert_eq!(result.effect_words().unwrap()[5..], [0, 0, 0]);
                }
            }
        }
    }

    #[test]
    fn insertion_capacity_counts_utf8_bytes_and_first_time_replacement_is_not_rolled_back() {
        assert_eq!(apply("A😀Z", 1, 10, u32::from('罠'), false).text, "A罠😀Z");
        let full = apply("A😀Z", 1, 9, u32::from('罠'), false);
        assert_eq!((full.text.as_str(), full.flags), ("A😀Z", CAPACITY_REFUSED));
        let first = apply("xx", 1, 3, u32::from('罠'), true);
        assert_eq!((first.text.as_str(), first.scalar_cursor, first.flags), ("", 0, CAPACITY_REFUSED | CHANGED));
        assert_eq!(apply("", 0, 1, u32::from('x'), false).flags, CAPACITY_REFUSED);
    }

    #[test]
    fn literal_modifier_and_unicode_printability_policy_match_pinned_source() {
        let snapshot = Snapshot { text: "A", byte_capacity: 8, scalar_cursor: 1, first_time: false };
        for modifiers in [0, 1, 2, 4, 8, 16, 255] {
            assert_eq!(edit(snapshot, Keypress { code: u32::from('x'), modifiers }).unwrap().text, "Ax");
        }
        for code in [0, 1, 27, 0x7f, 0x80, 0x9a, 0xd800, 0xdfff, 0xfdd0, 0xfdef,
            0xfe00, 0xfe0f, 0xfeff, 0xfff9, 0xfffb, 0xfffe, 0x1ffff, 0x40000, 0xe0000, 0x10ffff, 0x110000, 0x1000020] {
            assert!(!keycode_is_printable(code), "{code:x}");
        }
        for code in [0x20, 0xa0, 0x301, 0x200d, 0xe001, 0xf8ff, 0x1f600, 0x20000, 0x3fffd, 0xf0000, 0x10fffd] {
            assert!(keycode_is_printable(code), "{code:x}");
        }
        assert_eq!(apply("A", 1, 8, 1, false).flags, BELL);
    }

    #[test]
    fn invalid_captures_return_errors_and_valid_effect_words_are_bounded() {
        let valid = Snapshot { text: "罠", byte_capacity: 4, scalar_cursor: 1, first_time: false };
        let key = Keypress { code: KC_ENTER, modifiers: 0 };
        assert_eq!(edit(Snapshot { byte_capacity: 0, ..valid }, key), Err(TextInputError::InvalidCapacity));
        assert_eq!(edit(Snapshot { byte_capacity: MAX_BUFFER_BYTES + 1, ..valid }, key), Err(TextInputError::InvalidCapacity));
        assert_eq!(edit(Snapshot { byte_capacity: 3, ..valid }, key), Err(TextInputError::InvalidBuffer));
        assert_eq!(edit(Snapshot { text: "x\0", ..valid }, key), Err(TextInputError::InvalidBuffer));
        assert_eq!(edit(Snapshot { scalar_cursor: 2, ..valid }, key), Err(TextInputError::InvalidCursor));
        assert_eq!(edit(valid, Keypress { modifiers: 256, ..key }), Err(TextInputError::InvalidModifiers));
        assert_eq!(edit(valid, key).unwrap().effect_words().unwrap(), [1, 1, 3, 1, DONE, 0, 0, 0]);
    }

    #[test]
    fn default_truncation_preserves_ascii_and_never_splits_cjk_or_supplementary_scalars() {
        for text in ["Default name", "日本語の名前", "A😀罠𠀀Z", "e\u{301}中"] {
            for end in 0..=text.len() {
                let prefix = &text.as_bytes()[..end];
                let expected = (0..=end).rev().find(|position| text.is_char_boundary(*position)).unwrap();
                let actual = truncate_prefix(prefix, end + 1).unwrap();
                assert_eq!(actual, expected);
                assert!(std::str::from_utf8(&prefix[..actual]).is_ok());
                if text.is_ascii() { assert_eq!(actual, end); }
            }
        }
        assert_eq!(truncate_prefix(&[b'A', 0xff], 3), Err(TextInputError::InvalidBuffer));
        assert_eq!(truncate_prefix(&[0xe0, 0x80], 3), Err(TextInputError::InvalidBuffer));
        assert_eq!(truncate_prefix(b"A\0", 3), Err(TextInputError::InvalidBuffer));
        assert_eq!(truncate_prefix(b"ABC", 3), Err(TextInputError::InvalidBuffer));
        assert_eq!(truncate_prefix(&[], 1), Ok(0));
    }

    #[test]
    fn native_ascii_byte_editor_matches_every_key_at_every_cursor_and_capacity_boundary() {
        // Independent original C byte operations, restricted to ASCII where
        // the original DELETE scalar-as-byte error has no observable effect.
        fn native(text: &str, cursor: usize, capacity: usize, code: u32, first: bool) -> (String, usize, u32) {
            let mut bytes = text.as_bytes().to_vec();
            let mut cursor = cursor;
            let mut flags = 0;
            match code {
                ESCAPE => { cursor = 0; flags |= DONE; }
                KC_ENTER => { cursor = bytes.len(); flags |= DONE; }
                ARROW_LEFT => { if first { cursor = 0; } else if cursor > 0 { cursor -= 1; } }
                ARROW_RIGHT => { if first { cursor = bytes.len(); } else if cursor < bytes.len() { cursor += 1; } }
                KC_DELETE | KC_BACKSPACE => {
                    if first { bytes.clear(); cursor = 0; }
                    else if code == KC_BACKSPACE && cursor > 0 { bytes.remove(cursor - 1); cursor -= 1; }
                    else if code == KC_DELETE && cursor < bytes.len() { bytes.remove(cursor); }
                }
                0x20..=0x7e => {
                    if first { bytes.clear(); cursor = 0; }
                    if bytes.len() + 1 >= capacity { flags |= CAPACITY_REFUSED; }
                    else { bytes.insert(cursor, u8::try_from(code).unwrap()); cursor += 1; }
                }
                _ => { flags |= BELL; }
            }
            let result = String::from_utf8(bytes).unwrap();
            if result != text { flags |= CHANGED; }
            (result, cursor, flags)
        }
        for text in ["", "A", "abcd"] {
            for capacity in [text.len() + 1, text.len() + 2, text.len() + 8] {
                for cursor in 0..=text.len() {
                    for first in [false, true] {
                        for code in (0..=0x9f).chain([ESCAPE]) {
                            let original = native(text, cursor, capacity, code, first);
                            let actual = apply(text, cursor, capacity, code, first);
                            assert_eq!((actual.text, actual.scalar_cursor, actual.flags), original,
                                "text={text:?} capacity={capacity} cursor={cursor} first={first} code={code:x}");
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn ffi_unicode_edit_writes_owned_output_once_with_effect_and_canary_guards() {
        let original = "罠".repeat(24);
        let mut output = [0xa5_u8; 90];
        let mut words = [0xfeed_beef_u32; 10];
        // SAFETY: initialized readable original and live distinct writable
        // output[8..82]/words[1..9], with matching lengths and aligned words.
        let status = unsafe { ab_rs_text_edit(original.as_ptr(), 72, 74, 23,
            KC_DELETE, 0, 0, output.as_mut_ptr().add(8), 74, words.as_mut_ptr().add(1), 8) };
        assert_eq!(status, 0);
        assert_eq!(&words[1..9], &[1, 23, 69, 23, CHANGED, 0, 0, 0]);
        assert_eq!(&output[..8], &[0xa5; 8]);
        assert_eq!(&output[82..], &[0xa5; 8]);
        assert_eq!(output[77], 0);
        assert_eq!(std::str::from_utf8(&output[8..77]).unwrap(), "罠".repeat(23));
        assert_eq!((words[0], words[9]), (0xfeed_beef, 0xfeed_beef));
    }

    #[test]
    fn ffi_invalid_null_flags_alignment_alias_and_utf8_leave_both_outputs_unchanged() {
        let text = b"A";
        let invalid = [0xff_u8];
        let mut output = [0xa5_u8; 16];
        let mut words = [0xfeed_beef_u32; EFFECT_WORDS];
        let cases = [
            (std::ptr::null(), 1, 16, 0, 0, 16, 8),
            (text.as_ptr(), 1, 0, 0, 0, 16, 8),
            (text.as_ptr(), 1, 16, 2, 0, 16, 8),
            (text.as_ptr(), 1, 16, 0, 256, 16, 8),
            (text.as_ptr(), 1, 16, 0, 0, 15, 8),
            (text.as_ptr(), 1, 16, 0, 0, 16, 7),
            (invalid.as_ptr(), 1, 16, 0, 0, 16, 8),
        ];
        for (input, length, capacity, first, modifiers, out_capacity, count) in cases {
            // SAFETY: invalid counts/null are rejected before access; other
            // inputs are initialized one-byte locals and outputs live/disjoint.
            let status = unsafe { ab_rs_text_edit(input, length, capacity, 0, KC_ENTER,
                modifiers, first, output.as_mut_ptr(), out_capacity, words.as_mut_ptr(), count) };
            assert!(status < 0);
            assert_eq!(output, [0xa5; 16]);
            assert_eq!(words, [0xfeed_beef; EFFECT_WORDS]);
        }
        let mut aliased = [b'A'; 16];
        // SAFETY: alias is deliberately invalid and checked before read/write.
        let status = unsafe { ab_rs_text_edit(aliased.as_ptr(), 1, 16, 0, KC_ENTER,
            0, 0, aliased.as_mut_ptr(), 16, words.as_mut_ptr(), 8) };
        assert_eq!(status, TextInputError::InvalidBuffer.status());
        assert_eq!(aliased, [b'A'; 16]);
        let unaligned = (words.as_mut_ptr().cast::<u8>()).wrapping_add(1).cast::<u32>();
        // SAFETY: deliberately misaligned output is rejected before any access.
        assert!(unsafe { ab_rs_text_edit(text.as_ptr(), 1, 16, 0, KC_ENTER,
            0, 0, output.as_mut_ptr(), 16, unaligned, 8) } < 0);
        // SAFETY: output/effect overlap is detected before read/write.
        assert!(unsafe { ab_rs_text_edit(text.as_ptr(), 1, 16, 0, KC_ENTER,
            0, 0, words.as_mut_ptr().cast(), 16, words.as_mut_ptr(), 8) } < 0);
        assert_eq!(output, [0xa5; 16]);
        assert_eq!(words, [0xfeed_beef; EFFECT_WORDS]);
        let overflow = (usize::MAX - 1) as *const u8;
        assert!(checked_span(overflow, 4).is_err());
    }

    #[test]
    fn ffi_truncate_empty_partial_complete_and_invalid_prefix_are_transactional() {
        let text = "A😀罠";
        for end in 0..=text.len() {
            let mut terminator = u32::MAX;
            // SAFETY: initialized bounded text prefix and distinct aligned live
            // output word; the adapter owns neither across this synchronous call.
            let status = unsafe { ab_rs_text_truncate(text.as_ptr(), end as u32,
                end as u32 + 1, &mut terminator) };
            assert_eq!(status, 0);
            assert!(text.is_char_boundary(terminator as usize));
            assert!(terminator as usize <= end);
        }
        let invalid = [b'A', 0xff];
        let mut terminator = 0xfeed_beef;
        // SAFETY: initialized readable invalid UTF-8 and valid distinct output.
        assert!(unsafe { ab_rs_text_truncate(invalid.as_ptr(), 2, 3, &mut terminator) } < 0);
        assert_eq!(terminator, 0xfeed_beef);
        // SAFETY: empty prefix may be null, with aligned writable output.
        assert_eq!(unsafe { ab_rs_text_truncate(std::ptr::null(), 0, 1, &mut terminator) }, 0);
        assert_eq!(terminator, 0);
        let mut alias = [0x4141_4141_u32; 2];
        // SAFETY: deliberately overlapping input/output is rejected before access.
        assert!(unsafe { ab_rs_text_truncate(alias.as_ptr().cast(), 1, 2, alias.as_mut_ptr()) } < 0);
        assert_eq!(alias, [0x4141_4141; 2]);
    }
}
