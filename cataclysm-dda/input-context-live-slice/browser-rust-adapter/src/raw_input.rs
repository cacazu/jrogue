use cdda_live_input_snapshot_consumer::MAX_FIELD_BYTES;
#[derive(Debug, PartialEq, Eq)]
pub enum RawUtf8Error { TooLarge, InvalidUtf8 }
/// External user text is copied exactly. No trim, normalization, translation or IDs.
/// This is a host-provided byte boundary, not proof of original SDL/IME delivery.
pub fn preserve_raw_utf8(bytes: &[u8]) -> Result<String, RawUtf8Error> {
    if bytes.len() > MAX_FIELD_BYTES { return Err(RawUtf8Error::TooLarge); }
    std::str::from_utf8(bytes).map(str::to_owned).map_err(|_| RawUtf8Error::InvalidUtf8)
}
