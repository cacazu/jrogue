//! Minimal borrowed-buffer C ABI for the browser platform adapter.
//!
//! All pointers stay in the current Wasm instance. The caller owns input and
//! output allocations and must not overlap them. No Rust allocation ownership
//! crosses the ABI. Errors use negative values; successful buffer functions
//! return the required byte count, excluding any terminator.

use std::{ptr, slice, str};

use crate::application::{
    DirectionLayout, InputContext, Modifiers, direction_keycode, direction_keycode_for_layout,
    keycode,
};
use crate::domain::{GameplayEvent, MAX_TEXT_BYTES, TextEvent};
use crate::platform::{MAX_ENVELOPE_BYTES, MAX_SAVE_BYTES, unwrap_save, wrap_save};
use crate::presentation::{
    Catalog, Locale, MAX_CATALOG_BYTES, MAX_GAMEPLAY_EVENT_BYTES, RenderedText,
};

/// A null pointer was supplied for a nonempty buffer.
pub const ERROR_POINTER: i32 = -1;
/// Invalid context, locale, modifiers, key, or direction.
pub const ERROR_INPUT: i32 = -2;
/// Invalid event/catalog/template or missing semantic ID.
pub const ERROR_FORMAT: i32 = -3;
/// Invalid or incompatible save envelope.
pub const ERROR_SAVE: i32 = -4;
/// Input is not valid UTF-8.
pub const ERROR_UTF8: i32 = -5;
/// Input or output exceeds the API's documented size bound.
pub const ERROR_LIMIT: i32 = -6;

/// Return the version of this borrowed-buffer API.
#[unsafe(no_mangle)]
pub extern "C" fn nh_rust_abi_version() -> u32 {
    1
}

/// Return the default locale: 0 is Japanese and 1 is English.
#[unsafe(no_mangle)]
pub extern "C" fn nh_rust_default_locale() -> u32 {
    0
}

/// Convert an event.key string into a single original NetHack command byte.
/// Modifier bits: Ctrl=1, Alt=2, Shift=4, operating-system Meta=8.
///
/// # Safety
/// `key_ptr` must be readable for `key_len` bytes throughout the call, or null
/// only when length is zero. The caller may not mutate the borrowed bytes.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nh_rust_keycode(
    key_ptr: *const u8,
    key_len: usize,
    modifiers: u32,
    context: u32,
) -> i32 {
    if modifiers & !15 != 0 {
        return ERROR_INPUT;
    }
    // SAFETY: the caller supplies readable key bytes as documented above.
    let bytes = match unsafe { read_bytes(key_ptr, key_len, 128) } {
        Ok(bytes) => bytes,
        Err(error) => return error,
    };
    let key = match str::from_utf8(bytes) {
        Ok(key) => key,
        Err(_) => return ERROR_UTF8,
    };
    let context = match InputContext::try_from(context) {
        Ok(context) => context,
        Err(_) => return ERROR_INPUT,
    };
    let modifiers = Modifiers {
        ctrl: modifiers & 1 != 0,
        alt: modifiers & 2 != 0,
        shift: modifiers & 4 != 0,
        meta: modifiers & 8 != 0,
    };
    keycode(key, modifiers, context).map_or(ERROR_INPUT, i32::from)
}

/// Convert one of eight adjacent touch/gamepad directions into an original key.
/// Coordinates increase east and south. Run is 0 or 1; only command/direction
/// contexts accept movement. Other values are rejected without advancing turns.
#[unsafe(no_mangle)]
pub extern "C" fn nh_rust_direction(dx: i32, dy: i32, run: u32, context: u32) -> i32 {
    if run > 1 {
        return ERROR_INPUT;
    }
    let context = match InputContext::try_from(context) {
        Ok(context) => context,
        Err(_) => return ERROR_INPUT,
    };
    direction_keycode(dx, dy, run != 0, context).map_or(ERROR_INPUT, i32::from)
}

/// Convert a device direction using the official engine's current input layout.
/// Layout: 0=vi, 1=number-pad, 2=phone-pad, 3=QWERTZ. Run is 0 or 1.
/// The platform reports the engine option; this function never changes it.
#[unsafe(no_mangle)]
pub extern "C" fn nh_rust_direction_pad(
    dx: i32,
    dy: i32,
    run: u32,
    context: u32,
    layout: u32,
) -> i32 {
    if run > 1 {
        return ERROR_INPUT;
    }
    let context = match InputContext::try_from(context) {
        Ok(context) => context,
        Err(_) => return ERROR_INPUT,
    };
    let layout = match DirectionLayout::from_code(layout) {
        Some(layout) => layout,
        None => return ERROR_INPUT,
    };
    direction_keycode_for_layout(dx, dy, run != 0, context, layout).map_or(ERROR_INPUT, i32::from)
}

/// Validate and copy committed UTF-8 text for an explicit text-input context.
/// Free text is literal, including braces and percent signs; embedded NUL is
/// rejected because the official C text adapter uses NUL-terminated strings.
/// Empty completed text is valid. This function does not submit engine input.
/// Query/copy behavior is the same as [`nh_rust_format`].
///
/// # Safety
/// Input must be readable and immutable for its length; output must be writable
/// for its capacity. The input and output allocations must not overlap.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nh_rust_text_insert(
    text_ptr: *const u8,
    text_len: usize,
    context: u32,
    output_ptr: *mut u8,
    output_cap: usize,
) -> i32 {
    if InputContext::try_from(context) != Ok(InputContext::Text) {
        return ERROR_INPUT;
    }
    // SAFETY: the caller provides readable immutable input bytes.
    let bytes = match unsafe { read_bytes(text_ptr, text_len, MAX_TEXT_BYTES) } {
        Ok(bytes) => bytes,
        Err(error) => return error,
    };
    if str::from_utf8(bytes).is_err() {
        return ERROR_UTF8;
    }
    if bytes.contains(&0) {
        return ERROR_INPUT;
    }
    // SAFETY: the caller supplies a nonoverlapping writable output range.
    unsafe { write_output(bytes, output_ptr, output_cap) }
}

fn locale(value: u32) -> Result<Locale, i32> {
    match value {
        0 => Ok(Locale::Ja),
        1 => Ok(Locale::En),
        _ => Err(ERROR_INPUT),
    }
}

/// Format a typed event with JSON `{"en":{...},"ja":{...}}` catalogs.
/// Query required bytes with null output and zero capacity, then call again with
/// sufficient space. An undersized output is untouched. No NUL is appended.
///
/// # Safety
/// Input pointers must be readable for their lengths and immutable for this
/// call. Output must be writable for `output_cap` bytes unless capacity is zero.
/// Input and output allocations must not overlap.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nh_rust_format(
    catalog_ptr: *const u8,
    catalog_len: usize,
    event_ptr: *const u8,
    event_len: usize,
    language: u32,
    output_ptr: *mut u8,
    output_cap: usize,
) -> i32 {
    let language = match locale(language) {
        Ok(language) => language,
        Err(error) => return error,
    };
    // SAFETY: both borrowed immutable input ranges are provided by the caller.
    let catalog_bytes = match unsafe { read_bytes(catalog_ptr, catalog_len, MAX_CATALOG_BYTES) } {
        Ok(bytes) => bytes,
        Err(error) => return error,
    };
    // SAFETY: the event range satisfies the same caller lifetime requirements.
    let event_bytes = match unsafe { read_bytes(event_ptr, event_len, MAX_TEXT_BYTES) } {
        Ok(bytes) => bytes,
        Err(error) => return error,
    };
    let catalog = match Catalog::from_json(catalog_bytes) {
        Ok(catalog) => catalog,
        Err(_) => return ERROR_FORMAT,
    };
    let event: TextEvent = match serde_json::from_slice(event_bytes) {
        Ok(event) => event,
        Err(_) => return ERROR_FORMAT,
    };
    let rendered = match catalog.render(&event, language) {
        Ok(rendered) => rendered,
        Err(_) => return ERROR_FORMAT,
    };
    // SAFETY: the caller owns a nonoverlapping writable output buffer.
    unsafe { write_output(rendered.text.as_bytes(), output_ptr, output_cap) }
}

/// Return 0 for fully localized text, 1 for explicit English fallback, or a
/// negative format error. This companion diagnostic does not modify game state.
///
/// # Safety
/// Both input ranges must be readable and immutable for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nh_rust_format_fallback(
    catalog_ptr: *const u8,
    catalog_len: usize,
    event_ptr: *const u8,
    event_len: usize,
    language: u32,
) -> i32 {
    let language = match locale(language) {
        Ok(language) => language,
        Err(error) => return error,
    };
    // SAFETY: the caller provides the catalog's readable immutable range.
    let catalog_bytes = match unsafe { read_bytes(catalog_ptr, catalog_len, MAX_CATALOG_BYTES) } {
        Ok(bytes) => bytes,
        Err(error) => return error,
    };
    // SAFETY: the caller provides the event's readable immutable range.
    let event_bytes = match unsafe { read_bytes(event_ptr, event_len, MAX_TEXT_BYTES) } {
        Ok(bytes) => bytes,
        Err(error) => return error,
    };
    let catalog = match Catalog::from_json(catalog_bytes) {
        Ok(catalog) => catalog,
        Err(_) => return ERROR_FORMAT,
    };
    let event: TextEvent = match serde_json::from_slice(event_bytes) {
        Ok(event) => event,
        Err(_) => return ERROR_FORMAT,
    };
    match catalog.render(&event, language) {
        Ok(rendered) => i32::from(rendered.used_fallback),
        Err(_) => ERROR_FORMAT,
    }
}

/// Render an immutable native gameplay envelope from a separate gameplay
/// catalog. The envelope is `{event:{id,args},context:{api,helperVariant,...}}`.
/// Context selects explicit locale-owned catalog variants; it does not query
/// the game. The v1 direct-event formatting functions remain available.
/// Query/copy behavior is the same as [`nh_rust_format`].
///
/// # Safety
/// Both input ranges must be readable and immutable for their declared lengths.
/// Output must be writable for its capacity, and inputs/output must not overlap.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nh_rust_format_gameplay(
    catalog_ptr: *const u8,
    catalog_len: usize,
    envelope_ptr: *const u8,
    envelope_len: usize,
    language: u32,
    output_ptr: *mut u8,
    output_cap: usize,
) -> i32 {
    let language = match locale(language) {
        Ok(language) => language,
        Err(error) => return error,
    };
    // SAFETY: the caller provides the catalog's readable immutable range.
    let catalog_bytes = match unsafe { read_bytes(catalog_ptr, catalog_len, MAX_CATALOG_BYTES) } {
        Ok(bytes) => bytes,
        Err(error) => return error,
    };
    // SAFETY: the caller provides the captured envelope's immutable range.
    let envelope_bytes =
        match unsafe { read_bytes(envelope_ptr, envelope_len, MAX_GAMEPLAY_EVENT_BYTES) } {
            Ok(bytes) => bytes,
            Err(error) => return error,
        };
    let rendered = match render_gameplay_json(catalog_bytes, envelope_bytes, language) {
        Ok(rendered) => rendered,
        Err(error) => return error,
    };
    // SAFETY: the caller owns a separate writable output allocation.
    unsafe { write_output(rendered.text.as_bytes(), output_ptr, output_cap) }
}

/// Return 0 for localized gameplay text, 1 for explicit fallback, or a negative
/// format error. A raw accessibility location qualifier marks Japanese fallback
/// even when the message body is translated; it is never silently discarded.
///
/// # Safety
/// Both input ranges must be readable and immutable throughout this call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nh_rust_format_gameplay_fallback(
    catalog_ptr: *const u8,
    catalog_len: usize,
    envelope_ptr: *const u8,
    envelope_len: usize,
    language: u32,
) -> i32 {
    let language = match locale(language) {
        Ok(language) => language,
        Err(error) => return error,
    };
    // SAFETY: the caller provides the catalog's readable immutable range.
    let catalog_bytes = match unsafe { read_bytes(catalog_ptr, catalog_len, MAX_CATALOG_BYTES) } {
        Ok(bytes) => bytes,
        Err(error) => return error,
    };
    // SAFETY: the caller provides the captured envelope's immutable range.
    let envelope_bytes =
        match unsafe { read_bytes(envelope_ptr, envelope_len, MAX_GAMEPLAY_EVENT_BYTES) } {
            Ok(bytes) => bytes,
            Err(error) => return error,
        };
    match render_gameplay_json(catalog_bytes, envelope_bytes, language) {
        Ok(rendered) => i32::from(rendered.used_fallback),
        Err(error) => error,
    }
}

fn render_gameplay_json(
    catalog_bytes: &[u8],
    envelope_bytes: &[u8],
    language: Locale,
) -> Result<RenderedText, i32> {
    let catalog = Catalog::from_json(catalog_bytes).map_err(|_| ERROR_FORMAT)?;
    let envelope: GameplayEvent =
        serde_json::from_slice(envelope_bytes).map_err(|_| ERROR_FORMAT)?;
    catalog
        .render_gameplay(&envelope, language)
        .map_err(|_| ERROR_FORMAT)
}

/// Wrap official engine save bytes in a pinned-source JSON envelope.
/// Query/copy behavior is the same as [`nh_rust_format`].
///
/// # Safety
/// Payload must be readable for its length; output must be writable for its
/// capacity. Buffers must remain valid and must not overlap throughout the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nh_rust_save_wrap(
    payload_ptr: *const u8,
    payload_len: usize,
    output_ptr: *mut u8,
    output_cap: usize,
) -> i32 {
    // SAFETY: the caller provides a valid immutable engine payload.
    let payload = match unsafe { read_bytes(payload_ptr, payload_len, MAX_SAVE_BYTES) } {
        Ok(payload) => payload,
        Err(error) => return error,
    };
    let json = match wrap_save(payload) {
        Ok(json) => json,
        Err(_) => return ERROR_SAVE,
    };
    // SAFETY: the caller provides a nonoverlapping writable output range.
    unsafe { write_output(&json, output_ptr, output_cap) }
}

/// Validate an entire save before exposing its opaque engine payload.
/// A corrupt or incompatible save never writes output. Query/copy behavior is
/// the same as [`nh_rust_format`].
///
/// # Safety
/// JSON must be readable for its length; output must be writable for its
/// capacity. Buffers must remain valid and must not overlap throughout the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nh_rust_save_unwrap(
    json_ptr: *const u8,
    json_len: usize,
    output_ptr: *mut u8,
    output_cap: usize,
) -> i32 {
    // SAFETY: the caller provides a valid immutable envelope buffer.
    let json = match unsafe { read_bytes(json_ptr, json_len, MAX_ENVELOPE_BYTES) } {
        Ok(json) => json,
        Err(error) => return error,
    };
    let payload = match unwrap_save(json) {
        Ok(payload) => payload,
        Err(_) => return ERROR_SAVE,
    };
    // SAFETY: the caller provides a nonoverlapping writable output range.
    unsafe { write_output(&payload, output_ptr, output_cap) }
}

/// # Safety
/// For nonzero length, pointer must reference valid immutable bytes whose
/// lifetime is at least the caller's use of the returned slice.
unsafe fn read_bytes<'a>(
    pointer: *const u8,
    length: usize,
    maximum: usize,
) -> Result<&'a [u8], i32> {
    if length > maximum || length > isize::MAX as usize {
        return Err(ERROR_LIMIT);
    }
    if length == 0 {
        return Ok(&[]);
    }
    if pointer.is_null() {
        return Err(ERROR_POINTER);
    }
    // SAFETY: nonnull and bounded; the caller guarantees validity and lifetime.
    Ok(unsafe { slice::from_raw_parts(pointer, length) })
}

/// # Safety
/// Nonzero capacity requires a valid writable output allocation, and bytes may
/// not overlap that allocation. No bytes are written when capacity is too small.
unsafe fn write_output(bytes: &[u8], output: *mut u8, capacity: usize) -> i32 {
    let length = match i32::try_from(bytes.len()) {
        Ok(length) => length,
        Err(_) => return ERROR_LIMIT,
    };
    if capacity > isize::MAX as usize {
        return ERROR_LIMIT;
    }
    if capacity > 0 && output.is_null() {
        return ERROR_POINTER;
    }
    if bytes.len() > capacity || bytes.is_empty() {
        return length;
    }
    // SAFETY: caller owns sufficient nonoverlapping output, and checked length
    // is no greater than the declared writable capacity.
    unsafe { ptr::copy_nonoverlapping(bytes.as_ptr(), output, bytes.len()) };
    length
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn null_nonempty_input_and_invalid_context_are_rejected() {
        // SAFETY: invalid null input is rejected before any dereference.
        let invalid_null = unsafe { nh_rust_keycode(ptr::null(), 1, 0, 0) };
        assert_eq!(invalid_null, ERROR_POINTER);
        // SAFETY: the static single-byte key is readable for one byte.
        let invalid_context = unsafe { nh_rust_keycode(b"h".as_ptr(), 1, 0, 99) };
        assert_eq!(invalid_context, ERROR_INPUT);
        assert_eq!(nh_rust_direction(1, -1, 0, 0), i32::from(b'u'));
        assert_eq!(nh_rust_direction(1, -1, 0, 4), ERROR_INPUT);
    }

    #[test]
    fn query_and_short_buffer_do_not_write_and_full_buffer_roundtrips() {
        let payload = b"\0binary\xffsave";
        // SAFETY: payload is readable, and null/zero is a documented size query.
        let needed =
            unsafe { nh_rust_save_wrap(payload.as_ptr(), payload.len(), ptr::null_mut(), 0) };
        assert!(needed > 0);
        let mut short = [0xaa; 4];
        // SAFETY: payload and the separate four-byte output are valid allocations.
        assert_eq!(
            // SAFETY: the payload is immutable and short is a separate output.
            unsafe {
                nh_rust_save_wrap(
                    payload.as_ptr(),
                    payload.len(),
                    short.as_mut_ptr(),
                    short.len(),
                )
            },
            needed
        );
        assert_eq!(short, [0xaa; 4]);
        let mut envelope = vec![0; usize::try_from(needed).expect("positive size")];
        // SAFETY: separate output has exactly the previously queried capacity.
        assert_eq!(
            // SAFETY: the payload and queried-capacity output do not overlap.
            unsafe {
                nh_rust_save_wrap(
                    payload.as_ptr(),
                    payload.len(),
                    envelope.as_mut_ptr(),
                    envelope.len(),
                )
            },
            needed
        );
        let mut restored = vec![0; payload.len()];
        // SAFETY: complete envelope is readable and separate output is large enough.
        assert_eq!(
            // SAFETY: envelope and restored are valid separate allocations.
            unsafe {
                nh_rust_save_unwrap(
                    envelope.as_ptr(),
                    envelope.len(),
                    restored.as_mut_ptr(),
                    restored.len(),
                )
            },
            i32::try_from(payload.len()).expect("test length")
        );
        assert_eq!(restored, payload);
    }

    #[test]
    fn invalid_save_does_not_touch_output() {
        let mut output = [0xaa; 16];
        // SAFETY: both valid buffers are nonoverlapping; malformed JSON is data.
        assert_eq!(
            // SAFETY: both buffers are allocated and have declared capacities.
            unsafe { nh_rust_save_unwrap(b"{}".as_ptr(), 2, output.as_mut_ptr(), output.len()) },
            ERROR_SAVE
        );
        assert_eq!(output, [0xaa; 16]);
    }

    #[test]
    fn utf8_format_buffers_count_bytes_and_report_fallback() {
        let catalog = r#"{"en":{"ui.greeting":"Hello {name}","ui.pending":"Pending"},"ja":{"ui.greeting":"こんにちは {name}"}}"#.as_bytes();
        let event =
            r#"{"id":"ui.greeting","args":{"name":{"type":"text","value":"猫 % {name} 🐈"}}}"#
                .as_bytes();
        let expected = "こんにちは 猫 % {name} 🐈".as_bytes();
        // SAFETY: immutable inputs are valid; null/zero is the size query.
        let count = unsafe {
            nh_rust_format(
                catalog.as_ptr(),
                catalog.len(),
                event.as_ptr(),
                event.len(),
                0,
                ptr::null_mut(),
                0,
            )
        };
        assert_eq!(count, i32::try_from(expected.len()).expect("test size"));
        let mut bytes = vec![0; expected.len()];
        // SAFETY: all ranges are valid, independent, and exactly sized.
        let copied = unsafe {
            nh_rust_format(
                catalog.as_ptr(),
                catalog.len(),
                event.as_ptr(),
                event.len(),
                0,
                bytes.as_mut_ptr(),
                bytes.len(),
            )
        };
        assert_eq!(copied, count);
        assert_eq!(bytes, expected);
        // SAFETY: the catalog and event are readable immutable slices.
        let fallback = unsafe {
            nh_rust_format_fallback(
                catalog.as_ptr(),
                catalog.len(),
                event.as_ptr(),
                event.len(),
                0,
            )
        };
        assert_eq!(fallback, 0);
        let pending = br#"{"id":"ui.pending"}"#;
        // SAFETY: both immutable input ranges have the declared lengths.
        let fallback = unsafe {
            nh_rust_format_fallback(
                catalog.as_ptr(),
                catalog.len(),
                pending.as_ptr(),
                pending.len(),
                0,
            )
        };
        assert_eq!(fallback, 1);
    }

    #[test]
    fn text_boundary_keeps_utf8_literal_and_rejects_nul_and_wrong_context() {
        let text = "日本語 %s {name} 🐈".as_bytes();
        let mut output = vec![0; text.len()];
        // SAFETY: text and the equally-sized output are independent valid buffers.
        let length = unsafe {
            nh_rust_text_insert(
                text.as_ptr(),
                text.len(),
                4,
                output.as_mut_ptr(),
                output.len(),
            )
        };
        assert_eq!(length, i32::try_from(text.len()).expect("test size"));
        assert_eq!(output, text);
        let mut canary = [0xaa; 8];
        // SAFETY: malformed data is in a valid input slice and output is separate.
        let nul = unsafe {
            nh_rust_text_insert(b"x\0y".as_ptr(), 3, 4, canary.as_mut_ptr(), canary.len())
        };
        assert_eq!(nul, ERROR_INPUT);
        // SAFETY: the invalid UTF-8 byte and separate output are valid allocations.
        let invalid_utf8 = unsafe {
            nh_rust_text_insert(b"\xff".as_ptr(), 1, 4, canary.as_mut_ptr(), canary.len())
        };
        assert_eq!(invalid_utf8, ERROR_UTF8);
        // SAFETY: valid text is readable; rejected context never writes output.
        let wrong_context = unsafe {
            nh_rust_text_insert(
                text.as_ptr(),
                text.len(),
                0,
                canary.as_mut_ptr(),
                canary.len(),
            )
        };
        assert_eq!(wrong_context, ERROR_INPUT);
        assert_eq!(canary, [0xaa; 8]);
        // SAFETY: null/zero is an empty completed text and a size query.
        let empty = unsafe { nh_rust_text_insert(ptr::null(), 0, 4, ptr::null_mut(), 0) };
        assert_eq!(empty, 0);
    }

    #[test]
    fn gameplay_envelope_ffi_preserves_native_character_punctuation_and_context() {
        let catalog = r#"{"en":{"game.ouch.0123456789":"You feel pain{arg_1:%c}","variant.dream.game.ouch.0123456789":"You dream that you feel pain{arg_1:%c}"},"ja":{"game.ouch.0123456789":"痛みを感じる{arg_1:%c}","variant.dream.game.ouch.0123456789":"夢の中で痛みを感じる{arg_1:%c}"}}"#.as_bytes();
        let envelope = br#"{"event":{"id":"game.ouch.0123456789","args":{"arg_1":{"type":"integer","value":33}}},"context":{"api":"You_feel","helperVariant":"dream","locationPrefix":null}}"#;
        let expected = "夢の中で痛みを感じる!".as_bytes();
        let mut output = vec![0; expected.len()];
        // SAFETY: independent immutable inputs and exact-sized output are valid.
        let length = unsafe {
            nh_rust_format_gameplay(
                catalog.as_ptr(),
                catalog.len(),
                envelope.as_ptr(),
                envelope.len(),
                0,
                output.as_mut_ptr(),
                output.len(),
            )
        };
        assert_eq!(length, i32::try_from(expected.len()).expect("test size"));
        assert_eq!(output, expected);
        // SAFETY: both immutable input ranges have their declared lengths.
        let fallback = unsafe {
            nh_rust_format_gameplay_fallback(
                catalog.as_ptr(),
                catalog.len(),
                envelope.as_ptr(),
                envelope.len(),
                0,
            )
        };
        assert_eq!(fallback, 0);
    }

    #[test]
    fn gameplay_ffi_rejects_incomplete_quest_capture_without_writing_output() {
        let catalog = br#"{"en":{"quest.complete":"{name}"},"ja":{"quest.complete":"{name}"},"argument_schemas":{"quest.complete":["name"]}}"#;
        let envelope = br#"{"event":{"id":"quest.complete","args":{"name":{"type":"text","value":"public name"}}},"context":{"api":"putstr","quest":{"sequence":1,"lineIndex":0,"lineCount":1,"final":true,"captureComplete":false,"window":2,"resolvedSection":"Wiz","resolvedMessageId":"assignquest","itemIndex":0,"field":"text","sourceTemplate":"%n","decodedLine":"public name"}}}"#;
        let mut output = [0xa5; 32];
        // SAFETY: all immutable inputs and the separate writable canary buffer
        // are valid allocations with their exact declared lengths.
        let result = unsafe {
            nh_rust_format_gameplay(
                catalog.as_ptr(),
                catalog.len(),
                envelope.as_ptr(),
                envelope.len(),
                0,
                output.as_mut_ptr(),
                output.len(),
            )
        };
        assert_eq!(result, ERROR_FORMAT);
        assert_eq!(output, [0xa5; 32]);
        // SAFETY: the same immutable catalog/envelope ranges remain valid.
        let fallback = unsafe {
            nh_rust_format_gameplay_fallback(
                catalog.as_ptr(),
                catalog.len(),
                envelope.as_ptr(),
                envelope.len(),
                0,
            )
        };
        assert_eq!(fallback, ERROR_FORMAT);
    }
}

// Additive proposal only. The existing stateless v1 functions stay unchanged.
use crate::registered_catalog::{CatalogRegistry, RegistryError};
use std::sync::Mutex;

/// Invalid/released module-local immutable catalog handle.
pub const ERROR_CATALOG_HANDLE: i32 = -7;
/// The catalog registry lock was poisoned; no recovery or partial lookup.
pub const ERROR_CATALOG_REGISTRY: i32 = -8;
static REGISTERED_CATALOGS: Mutex<CatalogRegistry> = Mutex::new(CatalogRegistry::new());

fn registry_error(error: RegistryError) -> i32 {
    match error {
        RegistryError::Format(_) => ERROR_FORMAT,
        RegistryError::Capacity | RegistryError::HandleExhausted => ERROR_LIMIT,
        RegistryError::InvalidHandle => ERROR_CATALOG_HANDLE,
    }
}

/// Register a fully validated immutable catalog at explicit initialization.
/// Returns a positive, non-repeating module-local handle, or a negative error.
/// Rust owns the parsed copy; the input allocation may be freed immediately.
///
/// # Safety
/// Input must be readable and immutable for its length during this call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nh_rust_catalog_register(pointer: *const u8, length: usize) -> i32 {
    // SAFETY: the caller provides a readable immutable borrowed input range.
    let bytes = match unsafe { read_bytes(pointer, length, MAX_CATALOG_BYTES) } {
        Ok(bytes) => bytes,
        Err(error) => return error,
    };
    let mut registry = match REGISTERED_CATALOGS.lock() {
        Ok(registry) => registry,
        Err(_) => return ERROR_CATALOG_REGISTRY,
    };
    match registry.register(bytes) {
        Ok(handle) => handle as i32,
        Err(error) => registry_error(error),
    }
}

/// Explicit teardown. Releasing twice or using a stale handle is an error.
/// Handles belong to this Wasm instance and must never cross instance changes.
#[unsafe(no_mangle)]
pub extern "C" fn nh_rust_catalog_release(handle: u32) -> i32 {
    let mut registry = match REGISTERED_CATALOGS.lock() {
        Ok(registry) => registry,
        Err(_) => return ERROR_CATALOG_REGISTRY,
    };
    match registry.release(handle) {
        Ok(()) => 0,
        Err(error) => registry_error(error),
    }
}

/// Render against an initialized immutable catalog. Kind 0=TextEvent,
/// kind 1=GameplayEvent; language 0=JA,1=EN. Successful full output also writes
/// optional fallback byte 0/1. No terminator. Query or undersized output leaves
/// output and fallback byte untouched. No registry insertion or catalog parse.
/// A reusable 128KiB host output buffer allows text+fallback in one render.
///
/// # Safety
/// Input must be readable/immutable. Nonzero output capacity requires writable
/// output. A nonnull fallback pointer requires one writable byte. All input,
/// output and fallback allocations must be disjoint for the entire call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nh_rust_format_registered(
    handle: u32,
    event_ptr: *const u8,
    event_len: usize,
    kind: u32,
    language: u32,
    output_ptr: *mut u8,
    output_cap: usize,
    fallback_ptr: *mut u8,
) -> i32 {
    let language = match locale(language) {
        Ok(language) => language,
        Err(error) => return error,
    };
    let limit = match kind {
        0 => MAX_TEXT_BYTES,
        1 => MAX_GAMEPLAY_EVENT_BYTES,
        _ => return ERROR_INPUT,
    };
    // SAFETY: caller owns the readable immutable event range.
    let bytes = match unsafe { read_bytes(event_ptr, event_len, limit) } {
        Ok(bytes) => bytes,
        Err(error) => return error,
    };
    let catalog = {
        let registry = match REGISTERED_CATALOGS.lock() {
            Ok(registry) => registry,
            Err(_) => return ERROR_CATALOG_REGISTRY,
        };
        match registry.snapshot(handle) {
            Ok(catalog) => catalog,
            Err(error) => return registry_error(error),
        }
    };
    // Owned Arc protects an in-flight render from explicit concurrent release.
    // Drop the lock before formatting; immutable formatting cannot update it.
    let rendered = if kind == 0 {
        let event: TextEvent = match serde_json::from_slice(bytes) {
            Ok(event) => event,
            Err(_) => return ERROR_FORMAT,
        };
        catalog.render(&event, language)
    } else {
        let envelope: GameplayEvent = match serde_json::from_slice(bytes) {
            Ok(event) => event,
            Err(_) => return ERROR_FORMAT,
        };
        catalog.render_gameplay(&envelope, language)
    };
    let rendered = match rendered {
        Ok(rendered) => rendered,
        Err(_) => return ERROR_FORMAT,
    };
    // SAFETY: caller supplies disjoint output allocation, as for the v1 ABI.
    let result = unsafe { write_output(rendered.text.as_bytes(), output_ptr, output_cap) };
    if result >= 0
        && !output_ptr.is_null()
        && output_cap >= rendered.text.len()
        && !fallback_ptr.is_null()
    {
        // SAFETY: nonnull separate one-byte writable allocation is caller-owned.
        unsafe { ptr::write(fallback_ptr, u8::from(rendered.used_fallback)) };
    }
    result
}

#[cfg(test)]
mod registered_ffi_tests {
    use super::*;
    const CATALOG: &[u8] = br#"{"en":{"test.raw":"{raw}"},"ja":{}}"#;
    const EVENT: &[u8] = br#"{"id":"test.raw","args":{"raw":{"type":"text","value":"100% {x}"}}}"#;

    #[test]
    fn full_single_call_text_and_fallback_equal_stateless_query_copy() {
        // SAFETY: static input bytes remain valid and immutable.
        let handle = unsafe { nh_rust_catalog_register(CATALOG.as_ptr(), CATALOG.len()) };
        assert!(handle > 0);
        let mut output = [0xabu8; 64];
        let mut fallback = 0xabu8;
        // SAFETY: static input and separate owned output/status allocations.
        let size = unsafe {
            nh_rust_format_registered(
                handle as u32,
                EVENT.as_ptr(),
                EVENT.len(),
                0,
                0,
                output.as_mut_ptr(),
                output.len(),
                &mut fallback,
            )
        };
        assert_eq!(size, 8);
        assert_eq!(&output[..8], b"100% {x}");
        assert_eq!(fallback, 1);
        assert!(output[8..].iter().all(|byte| *byte == 0xab));
        // SAFETY: immutable static inputs; null output/zero capacity query.
        let old_size = unsafe {
            nh_rust_format(
                CATALOG.as_ptr(),
                CATALOG.len(),
                EVENT.as_ptr(),
                EVENT.len(),
                0,
                ptr::null_mut(),
                0,
            )
        };
        assert_eq!(size, old_size);
        assert_eq!(
            // SAFETY: readable immutable static inputs only.
            unsafe {
                nh_rust_format_fallback(
                    CATALOG.as_ptr(),
                    CATALOG.len(),
                    EVENT.as_ptr(),
                    EVENT.len(),
                    0,
                )
            },
            i32::from(fallback)
        );
        assert_eq!(nh_rust_catalog_release(handle as u32), 0);
    }

    #[test]
    fn undersized_or_rejected_call_leaves_output_and_status_canaries_untouched() {
        // SAFETY: static readable immutable catalog.
        let handle = unsafe { nh_rust_catalog_register(CATALOG.as_ptr(), CATALOG.len()) };
        assert!(handle > 0);
        let mut output = [0xabu8; 3];
        let mut fallback = 0xabu8;
        assert_eq!(
            // SAFETY: independent readable input and writable small output/status.
            unsafe {
                nh_rust_format_registered(
                    handle as u32,
                    EVENT.as_ptr(),
                    EVENT.len(),
                    0,
                    0,
                    output.as_mut_ptr(),
                    output.len(),
                    &mut fallback,
                )
            },
            8
        );
        assert_eq!(output, [0xab; 3]);
        assert_eq!(fallback, 0xab);
        assert_eq!(nh_rust_catalog_release(handle as u32), 0);
        assert_eq!(
            // SAFETY: same valid buffers; stale handle is rejected before writing.
            unsafe {
                nh_rust_format_registered(
                    handle as u32,
                    EVENT.as_ptr(),
                    EVENT.len(),
                    0,
                    0,
                    output.as_mut_ptr(),
                    output.len(),
                    &mut fallback,
                )
            },
            ERROR_CATALOG_HANDLE
        );
        assert_eq!(output, [0xab; 3]);
        assert_eq!(fallback, 0xab);
    }
}
