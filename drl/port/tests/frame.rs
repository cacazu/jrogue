use drl_web_port::display::frame::{Clip, Error, FRAME_BYTES, Frame, layout_text, text_columns};

fn frame() -> Vec<u8> {
    let mut data = vec![0; FRAME_BYTES];
    data[..4].copy_from_slice(b"DRLF");
    for (offset, value) in [(4, 1_u32), (8, 80), (12, 25), (16, 3), (20, 5), (24, 1)] {
        data[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }
    for i in (32..FRAME_BYTES).step_by(12) {
        data[i..i + 4].copy_from_slice(&u32::from('.').to_le_bytes());
        data[i + 4..i + 8].copy_from_slice(&7_u32.to_le_bytes());
    }
    data
}
#[test]
fn pascal_wire_frame_has_explicit_geometry_palette_and_cursor() {
    let data = frame();
    let frame = Frame::decode(&data).unwrap();
    let projected = frame.project();
    assert_eq!(projected.cursor, Some((3, 5)));
    assert_eq!(projected.glyphs.len(), 2000);
    assert_eq!(projected.glyphs[1999].x, 79);
    assert_eq!(projected.glyphs[1999].y, 24);
    assert_eq!(projected.glyphs[0].foreground, "#aaaaaa");
}
#[test]
fn malformed_wire_frames_are_rejected_before_presenting_any_cells() {
    let original = frame();
    assert_eq!(Frame::decode(&original[..100]), Err(Error::InvalidLength));
    for (offset, value, expected) in [
        (4, 2, Error::UnsupportedVersion),
        (8, 81, Error::InvalidDimensions),
        (16, 80, Error::InvalidCursor),
        (24, 3, Error::InvalidCursor),
        (28, 2, Error::InvalidReserved),
        (32, 0xd800, Error::InvalidGlyph),
        (36, 16, Error::InvalidColor),
    ] {
        let mut broken = original.clone();
        broken[offset..offset + 4].copy_from_slice(&u32::to_le_bytes(value));
        assert_eq!(Frame::decode(&broken), Err(expected));
    }
}
#[test]
fn native_byte_glyphs_use_explicit_cp437_instead_of_utf8_replacement() {
    let mut bytes = frame();
    bytes[28..32].copy_from_slice(&1_u32.to_le_bytes());
    for value in 0..=255_u32 {
        bytes[32..36].copy_from_slice(&value.to_le_bytes());
        let projected = Frame::decode(&bytes).unwrap().project();
        assert_eq!(projected.glyphs[0].columns, 1);
    }
    bytes[32..36].copy_from_slice(&219_u32.to_le_bytes());
    assert_eq!(Frame::decode(&bytes).unwrap().project().glyphs[0].text, "█");
}
#[test]
fn repeated_projection_cannot_mutate_core_frame_or_consume_entropy() {
    let bytes = frame();
    let original = Frame::decode(&bytes).unwrap();
    let projected = original.project();
    for _ in 0..100 {
        assert_eq!(original.project(), projected);
    }
    assert_eq!(original, Frame::decode(&bytes).unwrap());
}
#[test]
fn cjk_wrap_counts_columns_and_preserves_combining_external_names() {
    assert_eq!(text_columns("武器A").unwrap(), 5);
    let clip = Clip {
        x: 2,
        y: 3,
        width: 5,
        height: 2,
    };
    let layout = layout_text("武器Ae\u{301}敵", clip, 15, 0).unwrap();
    assert_eq!(
        layout
            .glyphs
            .iter()
            .map(|g| g.text.as_str())
            .collect::<String>(),
        "武器Ae\u{301}敵"
    );
    assert_eq!(layout.glyphs[0].columns, 2);
    assert_eq!(layout.glyphs[3].text, "e\u{301}");
    assert_eq!((layout.glyphs[3].x, layout.glyphs[3].y), (2, 4));
    assert!(!layout.clipped);
}
#[test]
fn text_bounds_clip_whole_graphemes_and_never_cut_utf8() {
    let clip = Clip {
        x: 0,
        y: 0,
        width: 3,
        height: 1,
    };
    let layout = layout_text("勇者の装備", clip, 14, 0).unwrap();
    assert_eq!(layout.glyphs.len(), 1);
    assert_eq!(layout.glyphs[0].text, "勇");
    assert!(layout.clipped);
    let emoji = layout_text("👩‍🚀", Clip { width: 2, ..clip }, 7, 0).unwrap();
    assert_eq!(emoji.glyphs.len(), 1);
    assert_eq!(emoji.glyphs[0].text, "👩‍🚀");
    assert_eq!(emoji.glyphs[0].columns, 2);
    assert_eq!(layout_text("x\0y", clip, 7, 0), Err(Error::InvalidText));
}

#[test]
fn ignored_carriage_returns_match_measurement_fitting_and_projection() {
    let clip = Clip {
        x: 0,
        y: 0,
        width: 80,
        height: 25,
    };
    assert_eq!(text_columns("a\rb").unwrap(), 2);
    let projected = layout_text("a\rb", clip, 7, 0).unwrap();
    assert_eq!(projected.end_x, 2);
    assert_eq!(
        drl_web_port::display::frame::text_fit("a\rb", 1).unwrap(),
        2
    );
    assert_eq!(
        drl_web_port::display::frame::text_fit("a\r\nb", 80).unwrap(),
        1
    );
    assert_eq!(text_columns("a\r\nb").unwrap(), 1);
}
