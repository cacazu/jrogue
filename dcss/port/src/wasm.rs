//! Small raw WASM JSON ABI. The browser owns allocations until calling release.
const MAX_INPUT: usize = crate::platform::MAX_SAVE_BYTES;

#[unsafe(no_mangle)]
pub extern "C" fn dcss_allocate(length: usize) -> *mut u8 {
    if length == 0 || length > MAX_INPUT {
        return std::ptr::null_mut();
    }
    Box::into_raw(vec![0u8; length].into_boxed_slice()).cast::<u8>()
}

/// # Safety
/// `pointer` must refer to an allocation from dcss_allocate with this length,
/// or the returned output allocation encoded by dcss_request.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn dcss_release(pointer: *mut u8, length: usize) {
    if pointer.is_null() || length == 0 {
        return;
    }
    // SAFETY: the host passes back the same pointer and length it received.
    unsafe {
        drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(
            pointer, length,
        )));
    }
}

/// # Safety
/// `pointer` must be a live readable dcss_allocate allocation of `length` bytes.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn dcss_request(pointer: *const u8, length: usize) -> u64 {
    if pointer.is_null() || length == 0 || length > MAX_INPUT {
        return 0;
    }
    // SAFETY: the host wrote and retained the input allocation specified above.
    let bytes = unsafe { std::slice::from_raw_parts(pointer, length) };
    let output = match std::str::from_utf8(bytes) {
        Ok(text) => crate::application::handle(text),
        Err(_) => "{\"ok\":false,\"value\":{\"error\":\"invalid UTF-8\"}}".into(),
    };
    let length = output.len() as u64;
    let pointer = Box::into_raw(output.into_bytes().into_boxed_slice()).cast::<u8>();
    (length << 32) | u64::from(pointer as u32)
}
