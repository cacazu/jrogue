// Five tests and Clippy passed in the isolated host Rust run; fixtures are synthetic.
use super::*;
const BUILD:&str="source-fixture-not-engine-build";
const FRAME:&[u8]=include_bytes!("../../fixtures/raw-border-cjk.bin");
const EMPTY:&[u8]=include_bytes!("../../fixtures/empty-submit-batch.bin");

#[test]
fn owned_raw_borders_cjk_and_damage_survive() {
    let frame=parse(FRAME,BUILD).expect("source fixture");
    assert_eq!(frame.publication(),9_223_372_045_444_710_399);
    assert!(!frame.full_canvas_complete());
    assert_eq!(frame.input_authority(),InputAuthority::NativeOnly);
    assert_eq!(frame.windows().len(),2);
    let rows=frame.windows()[0].rows();
    assert!(rows[0].touched());assert!(!rows[1].touched());
    for (index,cell) in rows[0].cells().iter().enumerate(){
        assert_eq!(cell.raw_bytes(),&[0xa0+u8::try_from(index).expect("fixture index")]);
        assert_eq!(cell.first_codepoint(),0xfffd);assert_eq!(cell.native_width(),1);assert!(cell.ascii_lines());
    }
    assert_eq!(rows[1].cells()[0].raw_bytes(),"猫".as_bytes());
    assert_eq!(rows[1].cells()[0].native_width(),2);assert!(rows[1].cells()[1].raw_bytes().is_empty());
    assert_eq!(rows[1].cells()[2].raw_bytes(),"a\u{301}".as_bytes());
    assert_eq!(rows[1].cells()[9].native_width(),1); // pinned mk_wcwidth emoji behavior
    assert_eq!(rows[1].cells()[10].raw_bytes(),b" ");
    assert_eq!(frame.windows()[1].erase_origin(),[12,40]);
    assert_eq!(frame.windows()[1].glyph_offset(),[9,34]);
}

#[test]
fn identity_version_complete_canvas_and_lengths_reject() {
    assert_eq!(parse(FRAME,"different-build"),Err(Error::Identity));
    let mut mutated=FRAME.to_vec();mutated[4]=2;assert_eq!(parse(&mutated,BUILD),Err(Error::Version));
    let mut mutated=FRAME.to_vec();mutated[6]=1;assert_eq!(parse(&mutated,BUILD),Err(Error::Format));
    let mut mutated=FRAME.to_vec();mutated.extend([0]);assert_eq!(parse(&mutated,BUILD),Err(Error::Trailing));
    for length in [0,3,7,16,55,60,FRAME.len()-1] { assert!(parse(&FRAME[..length],BUILD).is_err()); }
}

#[test]
fn empty_submission_batch_is_not_a_blank_complete_screen() {
    let frame=parse(EMPTY,BUILD).expect("empty source fixture");
    assert!(frame.windows().is_empty());assert!(!frame.full_canvas_complete());
}

#[test]
fn immutable_owned_snapshot_survives_source_mutation() {
    let mut input=FRAME.to_vec();let first=parse(&input,BUILD).expect("source fixture");
    let original=first.clone();input.fill(0);
    assert_eq!(first,original);
    for _ in 0..32 {assert_eq!(parse(FRAME,BUILD).expect("repeat"),original);}
}

#[test]
fn native_invalid_prefix_and_line_decisions_are_preserved() {
    for (bytes,expected) in [(&[0xa0][..],0xfffd),(&[0xc0,0x80][..],0xfffd),
        (&[0xed,0xa0,0x80][..],0xfffd),(&[0xe7,0x8c,0xab][..],0x732b)] {
        assert_eq!(native_first_codepoint(bytes),expected);
    }
    assert_eq!(native_line_decision(0x2502,0xe2,false),(false,0xa0));
    assert_eq!(native_line_decision(0x2502,0xe2,true),(true,0xa0));
    assert_eq!(native_line_decision(0xfffd,0xa0,false),(true,0xa0));
}
