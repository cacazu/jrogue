// SPDX-License-Identifier: GPL-3.0-or-later
// These are wire-protocol adversarial examples, never simulated game fixtures.
// The parent must separately supply actual browser-captured native packet bytes.
use super::*;

fn put32(bytes: &mut Vec<u8>, n: u32) { bytes.extend_from_slice(&n.to_le_bytes()); }
fn patch32(bytes: &mut [u8], at: usize, n: u32) { bytes[at..at + 4].copy_from_slice(&n.to_le_bytes()); }
fn put_float(bytes: &mut Vec<u8>, n: f32) { put32(bytes, n.to_bits()); }
fn expected() -> ExpectedPreparation { ExpectedPreparation { vm_generation: 7, application_epoch: 41 } }

fn header(flags: u32, events: u32, batches: u32) -> Vec<u8> {
    let mut b = b"TMP1".to_vec();
    for n in [1, 64, flags] { put32(&mut b, n); }
    b.extend_from_slice(&41_u64.to_le_bytes());
    for n in [0, events, batches, 65, 40, 6, 1, 1, 1, 0] { put32(&mut b, n); }
    assert_eq!(b.len(), 64);
    b
}
fn finish(mut b: Vec<u8>) -> Vec<u8> {
    let length = u32::try_from(b.len()).expect("bounded test input");
    patch32(&mut b, 24, length);
    b
}
fn marker(bytes: &mut Vec<u8>, kind: u32, sequence: u32, layer: u32) {
    for n in [kind, 16, sequence, layer] { put32(bytes, n); }
}

// Independent encoding follows the schema offsets, not calls to decoder helpers.
// Two source quads can share a batch across selected native layers; retaining
// their actual per-quad order is essential and their layer differs from prefix.
fn two_quad_example() -> Vec<u8> {
    let mut b = header(9, 1, 1);
    for n in [1, 640, 1, 2] { put32(&mut b, n); } // 232 + 204*2
    for n in [4, 12, 91, 0, 12, 0x84c0, 2, 9] { put32(&mut b, n); }
    for n in [0, 0, 800, 600, 0, 0, 800, 600, 1, 0, 0x0302, 0x0303, 1, 0] { put32(&mut b, n); }
    for _ in 0..2 { for n in 0..16 { put_float(&mut b, if n % 5 == 0 { 1.0 } else { 0.0 }); } }
    for n in 0..24 { put_float(&mut b, if n == 0 { -0.0 } else { f32::from(u16::try_from(n).unwrap()) }); }
    for n in 0..24 { put_float(&mut b, if n == 0 { -0.25 } else { 1.25 }); }
    for _ in 0..48 { put_float(&mut b, 1.5); }
    for n in [1, 3, 4, 2, 3, 4] { put32(&mut b, n); }
    assert_eq!(b.len(), 64 + 640);
    finish(b)
}

#[test]
fn preserves_exact_original_geometry_uv_color_transform_and_source_order() {
    let packet = OwnedPacket::decode(two_quad_example(), expected()).unwrap();
    let draw = packet.observed_draw_commands().next().unwrap();
    assert_eq!(draw.vertex_count(), 12);
    assert_eq!(draw.vertices()[0].to_bits(), (-0.0_f32).to_bits());
    assert_eq!(draw.texture_coordinates()[0].to_bits(), (-0.25_f32).to_bits());
    assert_eq!(draw.texture_coordinates()[1].to_bits(), 1.25_f32.to_bits());
    assert_eq!(draw.colors()[0].to_bits(), 1.5_f32.to_bits());
    assert_eq!(draw.slot(), SourceSlot { sequence: 1, native_layer: 2 });
    assert_eq!(draw.source_quads(), &[QuadSource { native_layer: 1, cell_x: 3, cell_y: 4 }, QuadSource { native_layer: 2, cell_x: 3, cell_y: 4 }]);
    assert_eq!(draw.state().active_unit_2d_texture, NativeTextureId(91));
    assert_eq!(draw.state().cached_framebuffer, NativeFramebufferId(12));
    assert_eq!(draw.state().modelview[0].to_bits(), 1.0_f32.to_bits());
}

#[test]
fn every_truncation_is_rejected_without_partial_packet() {
    let bytes = two_quad_example();
    for cut in 0..bytes.len() {
        assert!(OwnedPacket::decode(bytes[..cut].to_vec(), expected()).is_err(), "accepted cut {cut}");
    }
}

#[test]
fn rejects_stale_epoch_and_unsealed_or_unknown_protocol() {
    let bytes = two_quad_example();
    assert!(OwnedPacket::decode(bytes.clone(), ExpectedPreparation { application_epoch: 42, ..expected() }).is_err());
    assert!(OwnedPacket::decode(bytes.clone(), ExpectedPreparation { vm_generation: 0, ..expected() }).is_err());
    for (at, value) in [(4, 2), (8, 68), (12, 9 | 1024), (52, 2), (56, 0), (60, 1)] {
        let mut altered = bytes.clone();
        patch32(&mut altered, at, value);
        assert!(OwnedPacket::decode(altered, expected()).is_err(), "accepted header {at}");
    }
}

#[test]
fn rejects_nonfinite_and_overflow_counts_at_real_geometry_offsets() {
    let bytes = two_quad_example();
    // First modelview float: header64 + prefix16 + fixed field offset88.
    // First vertex: header64 + prefix16 + fixed payload216.
    for at in [168, 296] {
        for bits in [f32::INFINITY.to_bits(), f32::NEG_INFINITY.to_bits(), f32::NAN.to_bits()] {
            let mut altered = bytes.clone(); patch32(&mut altered, at, bits);
            assert!(OwnedPacket::decode(altered, expected()).is_err());
        }
    }
    for (at, value) in [(28, u32::MAX), (68, u32::MAX), (84, 30006), (104, 1), (76, 6), (108, 0), (92, 1)] {
        let mut altered = bytes.clone(); patch32(&mut altered, at, value);
        assert!(OwnedPacket::decode(altered, expected()).is_err(), "accepted count/layer {at}");
    }
}

#[test]
fn accepts_actual_callback_slot_order_but_cannot_authorize_foreign_gl() {
    let mut bytes = header(9 | 2 | 512, 6, 0);
    for (kind, sequence) in [(2, 1), (3, 2), (4, 3), (5, 4), (6, 5), (7, 6)] { marker(&mut bytes, kind, sequence, 5); }
    let packet = OwnedPacket::decode(finish(bytes), expected()).unwrap();
    assert_eq!(packet.events().len(), 6);
    assert!(!packet.full_renderer_ready());
    assert_eq!(packet.require_full_replay().unwrap_err().capture_flags, 523);
}

#[test]
fn rejects_missing_mismatched_and_reordered_original_callback_returns() {
    for kinds in [[2, 5], [2, 4], [3, 2], [6, 3]] {
        let mut bytes = header(9 | 2 | 512, 2, 0);
        marker(&mut bytes, kinds[0], 1, 5); marker(&mut bytes, kinds[1], 2, 5);
        assert!(OwnedPacket::decode(finish(bytes), expected()).is_err());
    }
    let mut bytes = header(9 | 2, 2, 0);
    marker(&mut bytes, 2, 1, 4); marker(&mut bytes, 3, 2, 5);
    assert!(OwnedPacket::decode(finish(bytes), expected()).is_err());
}

#[test]
fn native_tail_fov_cannot_precede_another_source_callback() {
    let mut bytes = header(9 | 2 | 512, 4, 0);
    for (kind, sequence) in [(6, 1), (7, 2), (2, 3), (3, 4)] { marker(&mut bytes, kind, sequence, 5); }
    assert!(OwnedPacket::decode(finish(bytes), expected()).is_err());
    let mut bytes = header(9 | 512, 2, 0);
    marker(&mut bytes, 6, 1, 4); marker(&mut bytes, 7, 2, 4);
    assert!(OwnedPacket::decode(finish(bytes), expected()).is_err());
}

#[test]
fn native_layers_preserve_traversal_without_forbidding_real_cross_layer_batches() {
    let original = two_quad_example();
    assert!(OwnedPacket::decode(original.clone(), expected()).is_ok());
    // Quad metadata starts after fixed216 and actual arrays384, absolute680.
    for (at, layer) in [(680, 3), (692, 0)] {
        let mut altered = original.clone(); patch32(&mut altered, at, layer);
        assert!(OwnedPacket::decode(altered, expected()).is_err());
    }
    let mut bytes = header(9 | 2, 4, 0);
    for (kind, sequence, layer) in [(2, 1, 2), (3, 2, 2), (4, 3, 1), (5, 4, 1)] { marker(&mut bytes, kind, sequence, layer); }
    assert!(OwnedPacket::decode(finish(bytes), expected()).is_err());
    let mut bytes = header(9, 2, 2);
    bytes.extend_from_slice(&original[64..]); bytes.extend_from_slice(&original[64..]);
    patch32(&mut bytes, 712, 2); // actual sequence of second record
    patch32(&mut bytes, 1320, 2); // next batch starts at previous source layer
    assert!(OwnedPacket::decode(finish(bytes.clone()), expected()).is_ok());
    patch32(&mut bytes, 1320, 1); // a later batch cannot return to earlier layer
    assert!(OwnedPacket::decode(finish(bytes), expected()).is_err());
}

#[test]
fn owns_actual_seen_bgra_bytes_without_recomputing_or_reordering_channels() {
    let mut bytes = header(9, 1, 0);
    for n in [8, 40, 1, 5, 19, 2, 1, 0x80e1] { put32(&mut bytes, n); }
    bytes.extend_from_slice(&[3, 5, 7, 11, 13, 17, 19, 23]);
    let packet = OwnedPacket::decode(finish(bytes), expected()).unwrap();
    let Event::Seen(seen) = &packet.events()[0] else { panic!("expected wire seen record") };
    assert_eq!(seen.native_texture(), NativeTextureId(19));
    assert_eq!(seen.dimensions(), (2, 1));
    assert_eq!(seen.bgra(), &[3, 5, 7, 11, 13, 17, 19, 23]);
    assert_eq!(seen.slot().native_layer, 5);
}

#[test]
fn seen_texture_is_final_and_extreme_dimensions_fail_before_allocation() {
    let mut bytes = header(9 | 2, 2, 0);
    for n in [8, 36, 1, 5, 19, 1, 1, 0x80e1, 0] { put32(&mut bytes, n); }
    marker(&mut bytes, 2, 2, 5);
    assert!(OwnedPacket::decode(finish(bytes), expected()).is_err());
    let mut bytes = header(9, 1, 0);
    for n in [8, 32, 1, 5, 19, u32::MAX, u32::MAX, 0x80e1] { put32(&mut bytes, n); }
    assert!(OwnedPacket::decode(finish(bytes), expected()).is_err());
}

#[test]
fn repeated_pure_reads_and_replay_rejection_leave_owned_packet_identical() {
    let packet = OwnedPacket::decode(two_quad_example(), expected()).unwrap();
    let before = format!("{packet:?}");
    for _ in 0..100 {
        let sum: usize = packet.observed_draw_commands().map(|draw| draw.vertices().len() + draw.colors().len()).sum();
        assert_eq!(sum, 72);
        assert!(packet.require_full_replay().is_err());
        assert_eq!(packet.preparation(), expected());
    }
    assert_eq!(format!("{packet:?}"), before);
}

#[test]
fn error_flags_remain_visible_and_do_not_become_successful_renderer_authority() {
    let mut bytes = two_quad_example();
    patch32(&mut bytes, 12, 9 | 16 | 32 | 64 | 128 | 256);
    let packet = OwnedPacket::decode(bytes, expected()).unwrap();
    assert_eq!(packet.header().flags, 505);
    assert!(packet.require_full_replay().is_err());
    assert!(!packet.full_renderer_ready());
}
