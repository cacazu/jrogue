use crate::MAX_SNAPSHOT_BYTES;

/// Synchronous adapter to the ORIGINAL module's four snapshot exports.
///
/// Addresses refer to that module's heap, never to this crate's memory. A safe
/// JS adapter must resolve the current original heap on every copy, recheck the
/// range, return owned bytes, and invoke no engine input/draw/RNG operations.
/// No await, raw pointer borrow, or retained original heap view is permitted.
pub trait SnapshotTransport {
    type Error;
    fn snapshot_pin(&mut self, kind: u32) -> Result<u32, Self::Error>;
    fn snapshot_data(&mut self, handle: u32) -> Result<u32, Self::Error>;
    fn snapshot_size(&mut self, handle: u32) -> Result<u32, Self::Error>;
    fn heap_length(&self) -> u64;
    fn copy_owned(&mut self, address: u32, length: u32) -> Result<Vec<u8>, Self::Error>;
    /// Maps to the C++ void release export; implementations must not panic.
    fn snapshot_release(&mut self, handle: u32);
}

#[derive(Debug, PartialEq, Eq)]
pub enum CopyError<E> {
    Transport(E),
    Unavailable,
    InvalidSize,
    InvalidRange,
    OwnedLengthMismatch,
}

struct PinGuard<'a, T: SnapshotTransport> {
    transport: &'a mut T,
    handle: u32,
}
impl<T: SnapshotTransport> Drop for PinGuard<'_, T> {
    fn drop(&mut self) {
        self.transport.snapshot_release(self.handle);
    }
}

/// Releases every successful pin after a synchronous owned copy or any error.
/// Parsing occurs only after release. No exported C++ context pointer is read.
pub fn copy_owned_snapshot<T: SnapshotTransport>(transport: &mut T) -> Result<Vec<u8>, CopyError<T::Error>> {
    let handle = transport.snapshot_pin(1).map_err(CopyError::Transport)?;
    if handle == 0 {
        return Err(CopyError::Unavailable);
    }
    let guard = PinGuard { transport, handle };
    let address = guard.transport.snapshot_data(handle).map_err(CopyError::Transport)?;
    let length = guard.transport.snapshot_size(handle).map_err(CopyError::Transport)?;
    if length == 0 || u64::from(length) > MAX_SNAPSHOT_BYTES as u64 {
        return Err(CopyError::InvalidSize);
    }
    let heap_length = guard.transport.heap_length();
    let address_u64 = u64::from(address);
    if address == 0 || heap_length > (1_u64 << 32) || address_u64 >= heap_length ||
        u64::from(length) > heap_length - address_u64 {
        return Err(CopyError::InvalidRange);
    }
    // The adapter must resolve/check its current heap again inside copy_owned.
    let bytes = guard.transport.copy_owned(address, length).map_err(CopyError::Transport)?;
    if u64::try_from(bytes.len()).ok() != Some(u64::from(length)) {
        return Err(CopyError::OwnedLengthMismatch);
    }
    Ok(bytes)
}

