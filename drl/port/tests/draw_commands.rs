use drl_web_port::display::frame::{
    COLOR_NONE, DrawOperation, Error, FRAME_BYTES, WireCommand, project_with_commands,
};

fn frame() -> Vec<u8> {
    let mut bytes = vec![0; FRAME_BYTES];
    bytes[..4].copy_from_slice(b"DRLF");
    for (offset, value) in [(4, 1_u32), (8, 80), (12, 25)] {
        bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }
    for offset in (32..FRAME_BYTES).step_by(12) {
        bytes[offset..offset + 4].copy_from_slice(&u32::from('.').to_le_bytes());
        bytes[offset + 4..offset + 8].copy_from_slice(&7_u32.to_le_bytes());
    }
    bytes
}
fn draw(kind: u32, text: &[u8], area: [u32; 4], colors: [u32; 3], encoding: u32) -> WireCommand {
    let mut header = vec![0; 64];
    for (i, value) in [
        1, kind, area[0], area[1], area[2], area[3], 0, 0, 80, 25, colors[0], colors[1], colors[2],
        encoding, 0, 0,
    ]
    .into_iter()
    .enumerate()
    {
        header[i * 4..i * 4 + 4].copy_from_slice(&value.to_le_bytes());
    }
    WireCommand {
        header,
        text: text.to_vec(),
    }
}
#[test]
fn ordered_draws_preserve_native_color_none_and_japanese_columns() {
    let commands = [
        draw(1, &[], [0, 0, 5, 1], [COLOR_NONE, 4, COLOR_NONE], 1),
        draw(
            0,
            "武器A".as_bytes(),
            [0, 0, 5, 1],
            [15, COLOR_NONE, COLOR_NONE],
            0,
        ),
    ];
    let projected = project_with_commands(&frame(), &commands).unwrap();
    let DrawOperation::Glyph(first) = &projected.commands[5] else {
        panic!("expected literal glyph")
    };
    assert_eq!(first.text, "武");
    assert_eq!(first.columns, 2);
    assert_eq!(first.background, "#aa0000");
    let DrawOperation::Glyph(last) = projected.commands.last().unwrap() else {
        panic!("expected literal glyph")
    };
    assert_eq!(last.x, 4);
    assert_eq!(last.text, "A");
}
#[test]
fn native_border_bytes_and_utf8_labels_have_explicit_encoding() {
    let commands = [
        draw(
            3,
            &[196, 196, 179, 179, 218, 191, 192, 217],
            [1, 1, 5, 3],
            [14, 0, 0],
            1,
        ),
        draw(0, &[30], [2, 2, 1, 1], [15, 0, 0], 1),
    ];
    let projected = project_with_commands(&frame(), &commands).unwrap();
    let DrawOperation::Glyph(last) = projected.commands.last().unwrap() else {
        panic!("expected glyph")
    };
    assert_eq!(last.text, "▲");
    assert_eq!(last.columns, 1);
    let wrong = [draw(0, &[0xff], [0, 0, 1, 1], [15, 0, 0], 0)];
    assert_eq!(
        project_with_commands(&frame(), &wrong),
        Err(Error::InvalidText)
    );
}
#[test]
fn overdraw_budget_rejects_frame_without_unbounded_allocation() {
    let commands = vec![draw(1, &[], [0, 0, 80, 25], [0, 0, 0], 1); 100];
    assert_eq!(
        project_with_commands(&frame(), &commands),
        Err(Error::InvalidLength)
    );
}

#[test]
fn original_bar_finishes_at_bottom_right_of_rectangular_area() {
    let commands = [draw(5, b"<>-", [2, 3, 4, 3], [15, 0, 7], 1)];
    let projected = project_with_commands(&frame(), &commands).unwrap();
    let DrawOperation::Glyph(last) = projected.commands.last().unwrap() else {
        panic!("expected endpoint glyph")
    };
    assert_eq!((last.x, last.y, last.text.as_str()), (5, 5, ">"));
}

#[test]
fn offscreen_commands_still_validate_utf8_and_border_arity() {
    let mut text = draw(0, &[0xff], [90, 90, 1, 1], [15, 0, 0], 0);
    for (index, value) in [90_u32, 90, 1, 1].into_iter().enumerate() {
        text.header[24 + index * 4..28 + index * 4].copy_from_slice(&value.to_le_bytes());
    }
    let bad_text = [text];
    assert_eq!(
        project_with_commands(&frame(), &bad_text),
        Err(Error::InvalidText)
    );
    let bad_border = [draw(3, b"short", [90, 90, 5, 3], [15, 0, 0], 1)];
    assert_eq!(
        project_with_commands(&frame(), &bad_border),
        Err(Error::InvalidGlyph)
    );
}
