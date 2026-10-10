// SPDX-License-Identifier: GPL-3.0-or-later
// Adversarial transport examples only; never an alternate game or fake frame.
use super::*;

fn put32(bytes: &mut Vec<u8>, value: u32) { bytes.extend_from_slice(&value.to_le_bytes()); }
fn expected(epoch: u64) -> ExpectedPreparation { ExpectedPreparation { vm_generation: 7, application_epoch: epoch } }
fn wire_header(epoch: u64, events: u32, draws: u32) -> Vec<u8> {
    let mut bytes = b"TMP1".to_vec();
    for value in [1, 64, 9] { put32(&mut bytes, value); }
    bytes.extend_from_slice(&epoch.to_le_bytes());
    for value in [0, events, draws, 65, 40, 6, 1, 1, 1, 0] { put32(&mut bytes, value); }
    bytes
}
fn finish(mut bytes: Vec<u8>) -> Vec<u8> {
    let n = u32::try_from(bytes.len()).unwrap(); bytes[24..28].copy_from_slice(&n.to_le_bytes()); bytes
}
fn one_draw(epoch: u64) -> Vec<u8> {
    let mut bytes = wire_header(epoch, 1, 1);
    for value in [1, 436, 1, 2, 4, 6, 91, 0, 12, 0x84c0, 1, 9] { put32(&mut bytes, value); }
    for value in [0, 0, 800, 600, 0, 0, 800, 600, 1, 0, 0x0302, 0x0303, 1, 0] { put32(&mut bytes, value); }
    for _ in 0..2 { for i in 0..16 { put32(&mut bytes, if i % 5 == 0 { 1.0_f32.to_bits() } else { 0 }); } }
    for i in 0..12 { put32(&mut bytes, if i == 0 { (-0.0_f32).to_bits() } else { 2.0_f32.to_bits() }); }
    for _ in 0..12 { put32(&mut bytes, (-0.25_f32).to_bits()); }
    for _ in 0..24 { put32(&mut bytes, 1.5_f32.to_bits()); }
    for value in [2, 3, 4] { put32(&mut bytes, value); }
    assert_eq!(bytes.len(), 500); finish(bytes)
}
fn seen(epoch: u64) -> Vec<u8> {
    let mut bytes = wire_header(epoch, 1, 0);
    for value in [8, 40, 1, 5, 19, 2, 1, 0x80e1] { put32(&mut bytes, value); }
    bytes.extend_from_slice(&[3, 5, 7, 11, 13, 17, 19, 23]); finish(bytes)
}
fn upload(state: &mut State, bytes: &[u8], epoch: u64) {
    assert_eq!(state.begin(u32::try_from(bytes.len()).unwrap(), expected(epoch)), 1);
    for (index, chunk) in bytes.chunks(4).enumerate() {
        let mut padded = [0; 4]; padded[..chunk.len()].copy_from_slice(chunk);
        assert_eq!(state.write_word(u32::try_from(index * 4).unwrap(), u32::from_le_bytes(padded), u32::try_from(chunk.len()).unwrap()), 1);
    }
}
fn text(state: &State) -> &str { std::str::from_utf8(&state.output).unwrap() }

#[test]
fn initialized_owned_upload_validates_only_after_complete_sequential_coverage() {
    let mut state = State::default(); let bytes = one_draw(41);
    assert_eq!(state.begin(500, expected(41)), 1);
    assert!(state.upload.as_ref().unwrap().bytes.iter().all(|n| *n == 0));
    assert_eq!(state.write_word(4, 0, 4), 0);
    assert_eq!(state.upload.as_ref().unwrap().written, 0);
    assert_eq!(state.write_word(0, u32::from_le_bytes(*b"TMP1"), 3), 0);
    assert_eq!(state.commit(), 0); assert!(state.packet.is_none());
    upload(&mut state, &bytes, 41); assert_eq!(state.commit(), 1); assert_eq!(state.status(), 1);
    assert!(text(&state).contains("\"phase\":\"validated\"")); assert!(text(&state).contains("\"draw_count\":1"));
}

#[test]
fn corrupt_checksumless_protocol_cannot_activate_or_expose_a_partial_packet() {
    let mut bytes = one_draw(41); bytes[64] = 99;
    let mut state = State::default(); upload(&mut state, &bytes, 41);
    assert_eq!(state.commit(), 0); assert_eq!(state.failure.code, 4); assert!(state.packet.is_none());
    assert_eq!(state.draw(0), 0); assert_eq!(state.output_kind, 0); assert!(state.output.is_empty());
    assert_eq!(state.status(), 1); assert!(text(&state).contains("\"phase\":\"rejected\""));
    assert!(text(&state).contains("\"full_renderer_ready\":false"));
}

#[test]
fn stale_or_invalid_expected_identity_rejects_before_replacing_valid_owned_packet() {
    let mut state = State::default(); upload(&mut state, &one_draw(41), 41); assert_eq!(state.commit(), 1);
    let before = format!("{:?}", state.packet);
    for identity in [expected(41), expected(40), ExpectedPreparation { vm_generation: 0, ..expected(42) }, expected(1_u64 << 53)] {
        assert_eq!(state.begin(500, identity), 0); assert_eq!(format!("{:?}", state.packet), before);
    }
    assert_eq!(state.begin(u32::MAX, expected(42)), 0);
    assert_eq!(format!("{:?}", state.packet), before);
}

#[test]
fn actual_geometry_words_preserve_float_bits_layer_cell_and_unclamped_values() {
    let mut state = State::default(); upload(&mut state, &one_draw(41), 41); assert_eq!(state.commit(), 1);
    assert_eq!(state.draw(0), 1); assert!(text(&state).contains("\"array_word_counts\":[12,12,24,3]"));
    assert_eq!(state.draw_words(0, 1, 0, 2), 1); assert_eq!(state.output_kind, 2);
    assert_eq!(state.output_word(0), (-0.0_f32).to_bits()); assert_eq!(state.output_word(4), 2.0_f32.to_bits());
    assert_eq!(state.draw_words(0, 2, 0, 1), 1); assert_eq!(state.output_word(0), (-0.25_f32).to_bits());
    assert_eq!(state.draw_words(0, 3, 0, 1), 1); assert_eq!(state.output_word(0), 1.5_f32.to_bits());
    assert_eq!(state.draw_words(0, 4, 0, 3), 1);
    assert_eq!((state.output_word(0), state.output_word(4), state.output_word(8)), (2, 3, 4));
}

#[test]
fn exact_seen_bytes_and_zero_padded_final_output_word_remain_owned() {
    let mut state = State::default(); upload(&mut state, &seen(41), 41); assert_eq!(state.commit(), 1);
    assert_eq!(state.event(0), 1); assert!(text(&state).contains("\"format\":\"BGRA\""));
    assert_eq!(state.seen_bytes(0, 1, 5), 1); assert_eq!(state.output, [5, 7, 11, 13, 17]);
    assert_eq!(state.output_word(0), u32::from_le_bytes([5, 7, 11, 13]));
    assert_eq!(state.output_word(4), 17); assert_eq!(state.output_word(5), 0);
}

#[test]
fn invalid_views_clear_stale_output_without_mutating_actual_validated_commands() {
    let mut state = State::default(); upload(&mut state, &one_draw(41), 41); assert_eq!(state.commit(), 1);
    let before = format!("{:?}", state.packet);
    for (kind, start, count) in [(0, 0, 1), (1, 12, 1), (1, u32::MAX, 2), (1, 0, 4097), (1, 0, 0)] {
        assert_eq!(state.draw(0), 1); assert_eq!(state.draw_words(0, kind, start, count), 0);
        assert_eq!(state.output_kind, 0); assert!(state.output.is_empty()); assert_eq!(format!("{:?}", state.packet), before);
    }
    assert_eq!(state.event(u32::MAX), 0); assert_eq!(state.draw(u32::MAX), 0); assert_eq!(state.seen_bytes(0, 0, 4), 0);
    assert_eq!(format!("{:?}", state.packet), before);
}

#[test]
fn repeated_reads_and_unsupported_replay_leave_packet_unchanged() {
    let mut state = State::default(); upload(&mut state, &one_draw(41), 41); assert_eq!(state.commit(), 1);
    let before = format!("{:?}", state.packet); assert_eq!(state.status(), 1); let status = state.output.clone();
    for _ in 0..100 {
        assert_eq!(state.status(), 1); assert_eq!(state.output, status);
        let before_bytes = state.output.clone(); let before_kind = state.output_kind;
        for index in (0..state.output.len()).step_by(4) { let _ = state.output_word(u32::try_from(index).unwrap()); }
        assert_eq!(state.output, before_bytes); assert_eq!(state.output_kind, before_kind);
        assert_eq!(tome_map_wasm_full_replay(), 0); assert_eq!(format!("{:?}", state.packet), before);
    }
}

#[test]
fn release_discards_only_owned_display_storage_and_never_reuses_an_old_epoch() {
    let mut state = State::default(); upload(&mut state, &one_draw(41), 41); assert_eq!(state.commit(), 1);
    assert_eq!(state.release(), 1); assert!(state.packet.is_none()); assert!(state.upload.is_none());
    assert_eq!(state.output_kind, 0); assert_eq!(state.draw(0), 0); assert_eq!(state.begin(500, expected(41)), 0);
    upload(&mut state, &one_draw(42), 42); assert_eq!(state.commit(), 1);
}

#[test]
fn exact_u64_identity_and_json_escaping_are_preserved_without_js_integer_loss() {
    assert_eq!(halves(0x12345678, 0x87654321), 0x8765432112345678);
    let epoch = (1_u64 << 40) + 41; let mut state = State::default(); let bytes = one_draw(epoch);
    let identity = ExpectedPreparation { vm_generation: u64::MAX, application_epoch: epoch };
    assert_eq!(state.begin(500, identity), 1);
    for (index, chunk) in bytes.chunks_exact(4).enumerate() {
        assert_eq!(state.write_word(u32::try_from(index * 4).unwrap(), u32::from_le_bytes(chunk.try_into().unwrap()), 4), 1);
    }
    assert_eq!(state.commit(), 1); assert_eq!(state.status(), 1);
    assert!(text(&state).contains("\"vm_generation\":\"18446744073709551615\""));
    let mut out = Json::new().unwrap(); out.quoted("a\"b\\c\n\u{1}").unwrap();
    assert_eq!(std::str::from_utf8(&out.finish()).unwrap(), "\"a\\\"b\\\\c\\n\\u0001\"");
}

#[test]
fn exported_numeric_abi_round_trip_uses_no_input_or_output_pointer() {
    STATE.with(|state| *state.borrow_mut() = State::default());
    let bytes = one_draw(41); assert_eq!(tome_map_wasm_begin(500, 41, 0, 7, 0), 1);
    for (index, chunk) in bytes.chunks_exact(4).enumerate() {
        assert_eq!(tome_map_wasm_write_word(u32::try_from(index * 4).unwrap(), u32::from_le_bytes(chunk.try_into().unwrap()), 4), 1);
    }
    assert_eq!(tome_map_wasm_commit(), 1); assert_eq!(tome_map_wasm_status(), 1); assert_eq!(tome_map_wasm_output_kind(), 1);
    let n = tome_map_wasm_output_len(); assert!(n > 0 && n <= 16384);
    let mut copied = Vec::new();
    for at in (0..n).step_by(4) { copied.extend_from_slice(&tome_map_wasm_output_word(at).to_le_bytes()); }
    copied.truncate(usize::try_from(n).unwrap()); assert!(std::str::from_utf8(&copied).unwrap().contains("\"full_renderer_ready\":false"));
    assert_eq!(tome_map_wasm_full_replay(), 0); assert_eq!(tome_map_wasm_error_code(), 0); assert_eq!(tome_map_wasm_release(), 1);
}
