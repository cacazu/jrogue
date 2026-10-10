//! Rust boundaries for the original Angband 4.2.6 C logic.
//! Four layers follow the user plan: logic (C), presentation (Rust),
//! input/application commands (Rust), and platform (Rust/browser adapters).
//! There is no new game simulation or random number generator in this crate.

pub mod input;
pub mod application_help;
pub mod application_menu;
pub mod combat;
pub mod domain_text;
pub(crate) mod digest;
pub mod death_cause;
pub mod application_text;
pub mod replay;
pub mod replay_bridge;
pub mod history;
pub mod knowledge_text;
pub mod localization;
pub mod naming;
pub mod platform;
pub mod presentation;
pub mod semantic_presentation;
pub mod text;
pub mod text_parameters;

use input::Command;
use platform::{JournalEntry, RngSnapshot, SaveEnvelope, SaveError};
use presentation::Screen;
use std::cell::RefCell;
use text::{GameCatalog, Locale, TextError};

/// Match a source-identified help row against an owned UTF-8 query. Japanese
/// matching uses reviewed rows; return 2 asks C to retain its English matcher.
/// Negative statuses are explicit validation or catalog failures.
///
/// # Safety
/// For a nonzero length, query must point to that many readable initialized
/// bytes for this synchronous call. The caller retains ownership. A null
/// pointer is accepted only for an empty query; no C state or RNG is queried.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_help_match(
    file: u32, line: u32, query: *const u8, len: u32, case_sensitive: u32,
) -> i32 {
    if len as usize > application_help::MAX_QUERY_BYTES ||
        (len != 0 && query.is_null()) || case_sensitive > 1 {
        return application_help::HelpError::InvalidQuery.status();
    }
    let bytes = if len == 0 { &[][..] } else {
        // SAFETY: the caller guarantees a readable span, bounded above before
        // access; u8 has no alignment requirement and this borrow never escapes.
        unsafe { std::slice::from_raw_parts(query, len as usize) }
    };
    let Ok(query) = std::str::from_utf8(bytes) else {
        return application_help::HelpError::InvalidQuery.status();
    };
    application_help::match_status(file, line, query, case_sensitive != 0,
        localization::active_locale())
}

struct Adapter {
    screen: Screen,
    frame: Vec<u8>,
    journal: Vec<JournalEntry>,
    journal_full: bool,
    save_output: Vec<u8>,
    save_status: u32,
    checkpoint_rng: Option<RngSnapshot>,
    restored_rng: Option<RngSnapshot>,
    locale: Locale,
    game_english: Result<GameCatalog, TextError>,
    game_japanese: Result<GameCatalog, TextError>,
    message_output: Vec<u8>,
}
impl Default for Adapter {
    fn default() -> Self {
        Self {
            screen: Screen::default(),
            frame: vec![0],
            journal: Vec::new(),
            journal_full: false,
            save_output: Vec::new(),
            save_status: 0,
            checkpoint_rng: None,
            restored_rng: None,
            locale: Locale::default(),
            game_english: GameCatalog::for_locale(Locale::English),
            game_japanese: GameCatalog::for_locale(Locale::Japanese),
            message_output: vec![0],
        }
    }
}
thread_local! { static ADAPTER: RefCell<Adapter> = RefCell::new(Adapter::default()); }

/// Select English (0) or Japanese (1). Unsupported values select the Japanese
/// default. Presentation, journal, original C game state, and saves are untouched.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_set_locale(locale: u32) {
    let locale = if locale == 0 { Locale::English } else { Locale::Japanese };
    ADAPTER.with(|state| {
        state.borrow_mut().locale = locale;
    });
    localization::set_locale(locale);
}

/// Resolve an exact reviewed static game semantic ID to localized UTF-8.
/// The NUL-terminated output is valid until the next message call on this
/// thread. Unknown IDs produce an explicit `[missing text ID: ...]` diagnostic.
///
/// # Safety
/// `id` must be null or point to a readable NUL-terminated string of at most
/// 127 bytes. Trusted C source literals satisfy this contract. Invalid UTF-8
/// produces a visible diagnostic; no completed-English-string lookup occurs.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_message(id: *const std::ffi::c_char) -> *const std::ffi::c_char {
    // SAFETY: the C caller supplies a valid bounded NUL-terminated ID literal.
    let id = unsafe { read_message_id(id) };
    ADAPTER.with(|state| {
        let mut state = state.borrow_mut();
        let message = match id {
            Some(ref id) => {
                let catalog = match state.locale {
                    Locale::English => &state.game_english,
                    Locale::Japanese => &state.game_japanese,
                };
                match catalog {
                    Ok(catalog) => match catalog.message(id) {
                        Ok(message) => message.to_owned(),
                        Err(_) => format!("[missing text ID: {id}]"),
                    },
                    Err(error) => format!("[invalid game catalog: {error}]"),
                }
            }
            None => "[missing text ID: <invalid>]".to_owned(),
        };
        state.message_output = message.into_bytes();
        state.message_output.push(0);
        state.message_output.as_ptr().cast()
    })
}

unsafe fn read_message_id(id: *const std::ffi::c_char) -> Option<String> {
    if id.is_null() {
        return None;
    }
    let mut bytes = Vec::with_capacity(64);
    for offset in 0..128 {
        // SAFETY: the caller guarantees a live NUL-terminated span with at most
        // 127 non-NUL bytes; the terminator is read before any later address.
        let byte = unsafe { *id.add(offset) } as u8;
        if byte == 0 {
            return String::from_utf8(bytes).ok();
        }
        bytes.push(byte);
    }
    None
}

/// Clear the fixed terminal. This does not reset input or save history.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_clear() {
    ADAPTER.with(|state| state.borrow_mut().screen.clear());
}

/// Copy an already accepted native logical size. CSS/font changes never call
/// this function. Invalid sizes preserve the complete cached terminal.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_resize(width: u32, height: u32) -> u32 {
    ADAPTER.with(|state| if state.borrow_mut().screen.resize(width as usize,height as usize) {0} else {1})
}

/// Copy the visible part of a C `wchar_t` span into the terminal.
///
/// # Safety
/// For `n > 0`, `s` must point to `n` initialized aligned `u32` values that
/// remain readable for this call. The C WASM ABI uses 32-bit `wchar_t`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_text(x: i32, y: i32, n: i32, color: i32, s: *const u32) {
    let (width,height) = ADAPTER.with(|state|state.borrow().screen.dimensions());
    if n <= 0
        || y < 0
        || y >= height as i32
        || x >= width as i32
        || s.is_null()
        || (s as usize) % 4 != 0
    {
        return;
    }
    let start = (-i64::from(x)).max(0);
    if start >= i64::from(n) {
        return;
    }
    let visible_x = x.max(0);
    let count = (i64::from(n) - start).min(width as i64 - i64::from(visible_x)) as usize;
    // SAFETY: the caller guarantees n readable u32 values. start/count are
    // clipped within that span; only the visible portion (at most 255) is read.
    let text = unsafe { std::slice::from_raw_parts(s.add(start as usize), count) };
    ADAPTER.with(|state| {
        state
            .borrow_mut()
            .screen
            .text(visible_x, y, u32::try_from(color).unwrap_or(0), text)
    });
}

/// Clear a clipped horizontal terminal span.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_wipe(x: i32, y: i32, n: i32) {
    ADAPTER.with(|state| state.borrow_mut().screen.wipe(x, y, n));
}

/// Set a terminal cursor, hiding it for out-of-range coordinates.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_cursor(x: i32, y: i32) {
    ADAPTER.with(|state| state.borrow_mut().screen.cursor(x, y));
}

/// Return UTF-8 JSON terminated by NUL. The pointer remains valid until the
/// next `ab_rs_frame` on this thread; the browser must copy it synchronously.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_frame() -> *const u8 {
    ADAPTER.with(|state| {
        let mut state = state.borrow_mut();
        state.frame = state.screen.snapshot().encode_json().into_bytes();
        state.frame.push(0);
        state.frame.as_ptr()
    })
}

/// Sanitize and journal a browser event, then return code in bits 0..20 and
/// upstream modifiers in bits 21..25. Zero means rejected/no input.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_input(code: u32, mods: u32) -> u32 {
    let Some(command) = Command::sanitize(code, mods) else {
        return 0;
    };
    let packed = command.packed();
    ADAPTER.with(|state| {
        let mut state = state.borrow_mut();
        if state.journal.len() < platform::MAX_JOURNAL_ENTRIES {
            let sequence = state.journal.len() as u64;
            state.journal.push(JournalEntry {
                sequence,
                packed_input: packed,
            });
        } else {
            // Gameplay still receives input. Saving reports explicit overflow
            // instead of silently persisting an incomplete replay journal.
            state.journal_full = true;
        }
    });
    packed
}

/// Start a new command journal for a newly created character.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_journal_reset() {
    ADAPTER.with(|state| {
        let mut state = state.borrow_mut();
        state.journal.clear();
        state.journal_full = false;
        state.checkpoint_rng = None;
        state.restored_rng = None;
    });
}

/// Wrap original C save bytes for browser persistence; return null on error.
/// Call `ab_rs_save_len` to obtain the output size and `ab_rs_save_status` for
/// an error code. Output is valid until the next wrap/unwrap on this thread.
///
/// # Safety
/// For nonzero `len`, `bytes` must reference that many initialized readable
/// bytes. It may alias the previous output, which is copied before replacement.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_save_wrap(bytes: *const u8, len: u32) -> *const u8 {
    // SAFETY: the caller supplies a readable span; buffer checks apply first.
    let payload = unsafe { copy_input(bytes, len, platform::MAX_PAYLOAD_BYTES) };
    ADAPTER.with(|state| {
        let mut state = state.borrow_mut();
        let result = payload.and_then(|payload| {
            if state.journal_full {
                return Err(SaveError::TooLarge);
            }
            SaveEnvelope {
                payload,
                journal: state.journal.clone(),
                rng: state.checkpoint_rng,
            }
            .encode()
        });
        if result.is_ok() {
            state.checkpoint_rng = None;
        }
        store_save_result(&mut state, result)
    })
}

/// Validate a saved envelope, restore the journal, and return original C bytes.
/// Null means the caller must not pass any bytes to the C save loader.
///
/// # Safety
/// For nonzero `len`, `bytes` must reference that many initialized readable
/// bytes. It may alias the previous output, which is copied before replacement.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_save_unwrap(bytes: *const u8, len: u32) -> *const u8 {
    // SAFETY: the caller supplies a readable span; buffer checks apply first.
    let data = unsafe { copy_input(bytes, len, platform::MAX_ENVELOPE_BYTES) };
    ADAPTER.with(|state| {
        let mut state = state.borrow_mut();
        // A rejected or legacy envelope must never expose a previous save's
        // checkpoint for restoration into an unrelated newly loaded character.
        state.restored_rng = None;
        state.checkpoint_rng = None;
        let result = data
            .and_then(|data| SaveEnvelope::decode(&data))
            .map(|save| {
                state.journal = save.journal;
                state.journal_full = false;
                state.restored_rng = save.rng;
                save.payload
            });
        store_save_result(&mut state, result)
    })
}

/// Number of output bytes from the latest successful save wrap/unwrap.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_save_len() -> u32 {
    ADAPTER.with(|state| state.borrow().save_output.len() as u32)
}

/// Zero for success, or the stable `SaveError` discriminant after failure.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_save_status() -> u32 {
    ADAPTER.with(|state| state.borrow().save_status)
}

/// Capture the complete C RNG at a quiescent game boundary for the next
/// successful save wrap. Word order is [quick, Rand_value, state_i, z0, z1,
/// z2, STATE[0..31]]. Return 0 success, 8 invalid pointer/alignment, or 9
/// invalid length/control fields. These return codes do not change save_status.
///
/// # Safety
/// For len=38, values must be null or point to 38 initialized aligned u32
/// values readable during this synchronous call. C retains RNG ownership.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_checkpoint_rng(values: *const u32, len: u32) -> u32 {
    let result = if len as usize != platform::RNG_WORDS {
        Err(SaveError::InvalidRng)
    } else if values.is_null() || (values as usize) % 4 != 0 {
        Err(SaveError::InvalidPointer)
    } else {
        let mut snapshot = [0; platform::RNG_WORDS];
        // SAFETY: the C caller promises 38 readable aligned u32 values. Length
        // and pointer checks occur before constructing or copying the span.
        let values = unsafe { std::slice::from_raw_parts(values, platform::RNG_WORDS) };
        snapshot.copy_from_slice(values);
        platform::validate_rng(&snapshot).map(|()| snapshot)
    };
    ADAPTER.with(|state| {
        let mut state = state.borrow_mut();
        match result {
            Ok(snapshot) => {
                state.checkpoint_rng = Some(snapshot);
                0
            }
            Err(error) => {
                state.checkpoint_rng = None;
                error as u32
            }
        }
    })
}

/// Copy a validated snapshot from the last unwrap exactly once. The C caller
/// applies it after native-load startup and before the next gameplay command.
/// Return 0 copied, 1 absent (including schema 1), 8 invalid pointer/alignment,
/// or 9 invalid output length. A failed output check preserves the snapshot.
/// These direct return codes do not change ab_rs_save_status.
///
/// # Safety
/// For len=38, out must be null or point to a unique writable aligned span of
/// 38 u32 values. It must not alias Rust adapter state during this call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_take_restored_rng(out: *mut u32, len: u32) -> u32 {
    if len as usize != platform::RNG_WORDS {
        return SaveError::InvalidRng as u32;
    }
    if out.is_null() || (out as usize) % 4 != 0 {
        return SaveError::InvalidPointer as u32;
    }
    ADAPTER.with(|state| {
        let mut state = state.borrow_mut();
        let Some(snapshot) = state.restored_rng else {
            return 1;
        };
        // SAFETY: the C caller promises a unique writable aligned 38-u32
        // output. snapshot is a detached local array and cannot overlap out.
        unsafe {
            std::ptr::copy_nonoverlapping(snapshot.as_ptr(), out, platform::RNG_WORDS);
        }
        state.restored_rng = None;
        0
    })
}

unsafe fn copy_input(bytes: *const u8, len: u32, max: usize) -> Result<Vec<u8>, SaveError> {
    let len = len as usize;
    if len > max {
        return Err(SaveError::TooLarge);
    }
    if len == 0 {
        return Ok(Vec::new());
    }
    if bytes.is_null() {
        return Err(SaveError::InvalidPointer);
    }
    // SAFETY: public callers promise a readable len-byte buffer. len is bounded
    // by max (under 40 MiB) before reading, and u8 requires no alignment.
    Ok(unsafe { std::slice::from_raw_parts(bytes, len) }.to_vec())
}

fn store_save_result(state: &mut Adapter, result: Result<Vec<u8>, SaveError>) -> *const u8 {
    match result {
        Ok(output) => {
            state.save_output = output;
            state.save_status = 0;
            state.save_output.as_ptr()
        }
        Err(error) => {
            state.save_output.clear();
            state.save_status = error as u32;
            std::ptr::null()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn help_ffi_validates_owned_query_before_access_and_preserves_english_fallback() {
        ab_rs_set_locale(1);
        // SAFETY: all invalid pointers are rejected before access; the empty
        // query permits null, and valid queries below are live UTF-8 spans.
        unsafe {
            assert_eq!(ab_rs_help_match(0, 0, std::ptr::null(), 1, 0), -202);
            assert_eq!(ab_rs_help_match(0, 0, std::ptr::null(), 80, 0), -202);
            assert_eq!(ab_rs_help_match(0, 0, std::ptr::null(), 0, 2), -202);
            assert_eq!(ab_rs_help_match(0, 0, std::ptr::null(), 0, 0), 1);
            assert_eq!(ab_rs_help_match(u32::MAX, 0, std::ptr::null(), 0, 0), -200);
            let invalid = [0xff];
            assert_eq!(ab_rs_help_match(0, 0, invalid.as_ptr(), 1, 0), -202);
            ab_rs_set_locale(0);
            let query = b"wand";
            assert_eq!(ab_rs_help_match(1, 17, query.as_ptr(), 4, 0), 2);
        }
        ab_rs_set_locale(1);
    }

    #[test]
    fn runtime_locale_changes_localized_source_ids_without_mutating_game_transport() {
        ab_rs_journal_reset();
        ab_rs_input(64, 0);
        ab_rs_clear();
        ab_rs_cursor(3, 4);
        let before = ADAPTER.with(|state| {
            let state = state.borrow();
            (
                state.screen.snapshot(),
                state.journal.clone(),
                state.journal_full,
            )
        });
        let id = c"game.stairs.up.missing";
        ab_rs_set_locale(0);
        // SAFETY: id is a live NUL-terminated source ID; returned pointer is
        // valid until the next ab_rs_message and is read synchronously.
        let en = unsafe { std::ffi::CStr::from_ptr(ab_rs_message(id.as_ptr())) }
            .to_str()
            .unwrap()
            .to_owned();
        ab_rs_set_locale(1);
        // SAFETY: the same bounded C string and synchronous output contract.
        let ja = unsafe { std::ffi::CStr::from_ptr(ab_rs_message(id.as_ptr())) }
            .to_str()
            .unwrap()
            .to_owned();
        assert_eq!(en, "I see no up staircase here.");
        assert_eq!(ja, "ここには上り階段が見当たらない。");
        let unknown = c"game.unknown";
        // SAFETY: unknown is a live bounded NUL-terminated test ID.
        let message = unsafe { std::ffi::CStr::from_ptr(ab_rs_message(unknown.as_ptr())) }
            .to_str()
            .unwrap();
        assert_eq!(message, "[missing text ID: game.unknown]");
        let after = ADAPTER.with(|state| {
            let state = state.borrow();
            (
                state.screen.snapshot(),
                state.journal.clone(),
                state.journal_full,
            )
        });
        assert_eq!(before, after);
        // No C gameplay/RNG state is available to either localization function.
    }

    #[test]
    fn ffi_renderer_and_save_platform_are_used_end_to_end() {
        ab_rs_clear();
        let chars = [64, 0x9f8d];
        // SAFETY: chars is an aligned live two-element u32 array.
        unsafe {
            ab_rs_text(0, 0, 2, 4, chars.as_ptr());
        }
        let pointer = ab_rs_frame();
        // SAFETY: ab_rs_frame returns NUL-terminated JSON valid until next frame.
        let frame = unsafe { std::ffi::CStr::from_ptr(pointer.cast()) }
            .to_str()
            .unwrap();
        assert!(frame.contains("\"cells\":[[64,4],[40845,4]"));
        ab_rs_journal_reset();
        assert_eq!(
            ab_rs_input(0x1f409, input::ALT),
            0x1f409 | (input::ALT << 21)
        );
        let original_save = [0_u8, 255, 14, 12];
        // SAFETY: original_save is a live initialized byte span.
        let wrapped =
            unsafe { ab_rs_save_wrap(original_save.as_ptr(), original_save.len() as u32) };
        assert!(!wrapped.is_null());
        assert_eq!(ab_rs_save_status(), 0);
        // SAFETY: the returned output length is valid until wrap/unwrap.
        let saved =
            unsafe { std::slice::from_raw_parts(wrapped, ab_rs_save_len() as usize) }.to_vec();
        let decoded = SaveEnvelope::decode(&saved).unwrap();
        assert_eq!(decoded.journal.len(), 1);
        // SAFETY: saved is a live initialized byte span.
        let restored = unsafe { ab_rs_save_unwrap(saved.as_ptr(), saved.len() as u32) };
        assert!(!restored.is_null());
        // SAFETY: the returned output length is valid until wrap/unwrap.
        assert_eq!(
            unsafe { std::slice::from_raw_parts(restored, ab_rs_save_len() as usize) },
            original_save
        );
    }

    #[test]
    fn ffi_clips_before_pointer_access_and_rejects_invalid_save_buffers() {
        // SAFETY: no span is dereferenced for out-of-bounds text/null buffers.
        unsafe {
            ab_rs_text(100, 0, 4, 0, std::ptr::null());
        }
        // SAFETY: copy_input rejects null before dereferencing this span.
        let output = unsafe { ab_rs_save_wrap(std::ptr::null(), 4) };
        assert!(output.is_null());
        assert_eq!(ab_rs_save_status(), SaveError::InvalidPointer as u32);
    }

    #[test]
    fn ffi_rng_checkpoint_restores_once_and_legacy_saves_have_no_checkpoint() {
        ab_rs_journal_reset();
        let mut rng: RngSnapshot = std::array::from_fn(|index| index as u32 * 0x01020304);
        rng[0] = 0;
        rng[1] = 0xfedcba98;
        rng[2] = 7;
        // SAFETY: rng is an initialized aligned 38-word array.
        assert_eq!(unsafe { ab_rs_checkpoint_rng(rng.as_ptr(), 38) }, 0);
        let original = [4_u8, 0, 255, 3];
        // SAFETY: original is a live initialized byte array.
        let wrapped = unsafe { ab_rs_save_wrap(original.as_ptr(), original.len() as u32) };
        assert!(!wrapped.is_null());
        // SAFETY: wrap output is valid until the next wrap/unwrap call.
        let encoded =
            unsafe { std::slice::from_raw_parts(wrapped, ab_rs_save_len() as usize) }.to_vec();
        let decoded = SaveEnvelope::decode(&encoded).unwrap();
        assert_eq!(decoded.rng, Some(rng));
        assert_eq!(decoded.payload, original);
        // SAFETY: encoded is a live initialized envelope span.
        assert!(!unsafe { ab_rs_save_unwrap(encoded.as_ptr(), encoded.len() as u32) }.is_null());
        let mut out = [0_u32; platform::RNG_WORDS];
        // SAFETY: out is unique writable storage. An invalid len/null output is
        // rejected before access and must preserve the pending snapshot.
        assert_eq!(unsafe { ab_rs_take_restored_rng(out.as_mut_ptr(), 37) }, 9);
        assert_eq!(
            unsafe { ab_rs_take_restored_rng(std::ptr::null_mut(), 38) },
            8
        );
        assert_eq!(unsafe { ab_rs_take_restored_rng(out.as_mut_ptr(), 38) }, 0);
        assert_eq!(out, rng);
        assert_eq!(unsafe { ab_rs_take_restored_rng(out.as_mut_ptr(), 38) }, 1);
        let legacy = platform::legacy_fixture(&original, &[]);
        // SAFETY: encoded is a live initialized schema 2 envelope. Leave its
        // restored RNG pending to prove legacy unwrap clears previous metadata.
        assert!(!unsafe { ab_rs_save_unwrap(encoded.as_ptr(), encoded.len() as u32) }.is_null());
        // SAFETY: legacy is a valid live schema 1 envelope span; out remains a
        // unique writable aligned 38-word array.
        assert!(!unsafe { ab_rs_save_unwrap(legacy.as_ptr(), legacy.len() as u32) }.is_null());
        assert_eq!(unsafe { ab_rs_take_restored_rng(out.as_mut_ptr(), 38) }, 1);
        assert_eq!(ab_rs_save_status(), 0);
        let mut invalid = rng;
        invalid[0] = 2;
        // SAFETY: invalid is still an initialized aligned 38-word array; only
        // its semantic control field is intentionally outside the allowed range.
        assert_eq!(unsafe { ab_rs_checkpoint_rng(invalid.as_ptr(), 38) }, 9);
    }
}
