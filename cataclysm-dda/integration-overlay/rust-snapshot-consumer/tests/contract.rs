//! Pending tests. Written as executable Rust, but not compiled/run in preparation.
use cdda_live_input_snapshot_consumer::*;
use serde_json::{Value, json};

const BUILD: &str = "source-fixture-only-not-an-engine-build";
const BASE: &[u8] = include_bytes!("../fixtures/base-context.json");
const TEXT: &[u8] = include_bytes!("../fixtures/text-context.json");
const ALL_TYPES: &[u8] = include_bytes!("../fixtures/all-binding-types.json");

fn identity() -> BuildIdentity { BuildIdentity::new(BUILD.to_owned()).unwrap() }
fn base_value() -> Value { serde_json::from_slice(BASE).unwrap() }
fn encode(value: &Value) -> Vec<u8> { serde_json::to_vec(value).unwrap() }
fn parse(value: &Value) -> Result<ContextSnapshot, SnapshotError> { parse_snapshot(&encode(value), &identity()) }
fn notice(publication: u64, status: u32) -> Notice {
    Notice::from_parts(1,u32::try_from(publication & 0xffff_ffff).unwrap(),
        u32::try_from(publication >> 32).unwrap(),status).unwrap()
}
fn context_bytes(publication: u64, epoch: u64, parent: u64, depth: u32) -> Vec<u8> {
    let mut value = base_value();
    value["publication_sequence"] = json!(publication.to_string());
    value["context_epoch"] = json!(epoch.to_string());
    value["parent_context_epoch"] = json!(parent.to_string());
    value["depth"] = json!(depth);
    encode(&value)
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum FailAt { Pin, Data, Size, Copy }
struct FakeTransport {
    bytes: Vec<u8>, handle: u32, address: u32, heap: u64,
    length_override: Option<u32>, copied_override: Option<Vec<u8>>,
    fail: Option<FailAt>, releases: Vec<u32>, pins: usize,
}
impl FakeTransport {
    fn new(bytes: Vec<u8>) -> Self {
        Self { bytes, handle:7, address:32, heap:1 << 20, length_override:None,
            copied_override:None, fail:None, releases:Vec::new(), pins:0 }
    }
}
impl SnapshotTransport for FakeTransport {
    type Error = &'static str;
    fn snapshot_pin(&mut self, kind: u32) -> Result<u32, Self::Error> {
        assert_eq!(kind,1);
        self.pins += 1;
        if self.fail == Some(FailAt::Pin) { Err("pin") } else { Ok(self.handle) }
    }
    fn snapshot_data(&mut self, handle: u32) -> Result<u32, Self::Error> {
        assert_eq!(handle,self.handle);
        if self.fail == Some(FailAt::Data) { Err("data") } else { Ok(self.address) }
    }
    fn snapshot_size(&mut self, handle: u32) -> Result<u32, Self::Error> {
        assert_eq!(handle,self.handle);
        if self.fail == Some(FailAt::Size) { Err("size") }
        else { Ok(self.length_override.unwrap_or(u32::try_from(self.bytes.len()).unwrap())) }
    }
    fn heap_length(&self) -> u64 { self.heap }
    fn copy_owned(&mut self, address: u32, _length: u32) -> Result<Vec<u8>, Self::Error> {
        assert_eq!(address,self.address);
        if self.fail == Some(FailAt::Copy) { Err("copy") }
        else { Ok(self.copied_override.clone().unwrap_or_else(|| self.bytes.clone())) }
    }
    fn snapshot_release(&mut self, handle: u32) { self.releases.push(handle); }
}

#[test]
fn exact_native_key_distinctions_and_empty_origins_survive() {
    let snapshot = parse_snapshot(BASE,&identity()).unwrap();
    assert_eq!(snapshot.publication_sequence(),9_007_199_254_740_993);
    assert_eq!(snapshot.actions()[0].id(),"pause");
    assert_eq!(snapshot.actions()[0].bindings()[0].sequence(),[46]);
    assert_eq!(snapshot.actions()[1].id(),"wait");
    assert_eq!(snapshot.actions()[1].bindings()[0].sequence(),[124]);
    assert_eq!(snapshot.actions()[2].id(),"save");
    assert_eq!(snapshot.actions()[2].bindings()[0].sequence(),[83]);
    assert_eq!(snapshot.actions()[2].bindings()[1].sequence(),[115]);
    assert_eq!(snapshot.actions()[2].bindings()[1].modifiers(),[Modifier::Shift]);
    assert_eq!(snapshot.actions()[3].origin(),BindingOrigin::Context);
    assert!(snapshot.actions()[3].bindings().is_empty());
    assert_eq!(snapshot.actions()[4].origin(),BindingOrigin::Missing);
    assert!(snapshot.actions()[4].bindings().is_empty());
    assert_eq!(snapshot.command_authorization(),
        CommandAuthorization::Denied(DenialReason::UntrackedNativeReaders));
}

#[test]
fn owned_text_binding_records_preserve_unicode_without_becoming_live_events() {
    let mut bytes = TEXT.to_vec();
    let snapshot = parse_snapshot(&bytes,&identity()).unwrap();
    bytes.fill(0);
    let binding = &snapshot.actions()[0].bindings()[0];
    assert_eq!(snapshot.category(),"STRING_INPUT");
    assert_eq!(snapshot.text_policy(),TextPolicy::RawUtf8);
    assert_eq!(snapshot.preferred_keyboard_mode(),PreferredKeyboardMode::Keychar);
    assert_eq!(snapshot.actions()[0].id(),"TEXT.CONFIRM");
    assert_eq!(binding.text(),"kit_日本🙂");
    assert_eq!(binding.edit(),"編集中");
    assert!(binding.edit_refresh());
}

#[test]
fn all_source_event_types_and_i32_sequences_remain_distinct() {
    let snapshot = parse_snapshot(ALL_TYPES,&identity()).unwrap();
    assert_eq!(snapshot.publication_sequence(),u64::MAX);
    let bindings = snapshot.actions()[0].bindings();
    assert_eq!(bindings.iter().map(BindingDescriptor::event_type).collect::<Vec<_>>(),
        [BindingType::Error,BindingType::Timeout,BindingType::KeyboardChar,
         BindingType::KeyboardCode,BindingType::Gamepad,BindingType::Mouse]);
    assert!(bindings[0].sequence().is_empty());
    assert_eq!(bindings[2].sequence(),[0,i32::MIN,i32::MAX]);
    assert_eq!(bindings[3].modifiers(),[Modifier::Ctrl,Modifier::Alt,Modifier::Shift]);
}

#[test]
fn repeated_owned_parsing_is_deterministic() {
    let expected = parse_snapshot(BASE,&identity()).unwrap();
    for _ in 0..64 { assert_eq!(parse_snapshot(BASE,&identity()).unwrap(),expected); }
    // This checks the owned Rust parser, not original-engine draw/RNG purity.
}

#[test]
fn schema_source_build_and_unknown_fields_fail_closed() {
    for (field,replacement) in [
        ("schema_version",json!(2)),("interface",json!("other/1")),
        ("source_commit",json!("0000000000000000000000000000000000000000")),
        ("engine_build_id",json!("different-build"))] {
        let mut value = base_value(); value[field] = replacement;
        assert!(matches!(parse(&value),Err(SnapshotError::IdentityMismatch(_))));
    }
    let mut value = base_value(); value["live_event"] = json!(true);
    assert!(matches!(parse(&value),Err(SnapshotError::Json(_))));
    let mut value = base_value(); value["actions"][0]["bindings"][0]["mouse_pos"] = json!([1,2]);
    assert!(matches!(parse(&value),Err(SnapshotError::Json(_))));
}

#[test]
fn counters_require_lossless_canonical_u64_strings() {
    for invalid in [json!(9_007_199_254_740_993_u64),json!("01"),json!("+1"),
        json!("-1"),json!(""),json!("1e2"),json!("18446744073709551616")] {
        let mut value = base_value(); value["publication_sequence"] = invalid;
        assert!(matches!(parse(&value),Err(SnapshotError::Json(_))));
    }
    let mut value = base_value(); value["publication_sequence"] = json!("0");
    assert!(matches!(parse(&value),Err(SnapshotError::InvalidRecord(_))));
}

#[test]
fn duplicate_json_fields_and_invalid_utf8_are_rejected() {
    let text = std::str::from_utf8(BASE).unwrap().replacen("\"schema_version\": 1",
        "\"schema_version\": 1, \"schema_version\": 1",1);
    assert!(matches!(parse_snapshot(text.as_bytes(),&identity()),Err(SnapshotError::Json(_))));
    assert!(matches!(parse_snapshot(&[0xff,0xfe],&identity()),Err(SnapshotError::InvalidUtf8(_))));
    let mut value = base_value(); value["category"] = json!("bad"); value["text_policy"] = json!("raw_utf8");
    assert!(matches!(parse(&value),Err(SnapshotError::InvalidRecord(_))));
}

#[test]
fn utf8_field_limits_count_bytes_and_snapshot_limit_precedes_json_parse() {
    let mut value = base_value(); value["category"] = json!("a".repeat(MAX_FIELD_BYTES));
    assert!(parse(&value).is_ok());
    value["category"] = json!("日".repeat(MAX_FIELD_BYTES/3+1));
    assert!(matches!(parse(&value),Err(SnapshotError::Json(_))));
    assert!(matches!(parse_snapshot(&vec![b' ';MAX_SNAPSHOT_BYTES+1],&identity()),Err(SnapshotError::ByteLimit)));
}

#[test]
fn action_binding_sequence_and_modifier_limits_are_enforced() {
    let base = base_value();
    let mut value = base.clone();
    value["actions"] = Value::Array((0..=MAX_ACTIONS).map(|index| {
        json!({"index":index,"id":"fixture","origin":"missing","bindings":[]})
    }).collect());
    assert!(matches!(parse(&value),Err(SnapshotError::Json(_))));
    let mut value = base.clone();
    value["actions"][0]["bindings"] = Value::Array(vec![base["actions"][0]["bindings"][0].clone();MAX_BINDINGS_PER_ACTION+1]);
    assert!(matches!(parse(&value),Err(SnapshotError::Json(_))));
    let mut value = base.clone(); value["actions"][0]["bindings"][0]["sequence"] = json!(vec![1;MAX_KEY_SEQUENCE+1]);
    assert!(matches!(parse(&value),Err(SnapshotError::Json(_))));
    for invalid in [json!(["shift","ctrl"]),json!(["ctrl","ctrl"])] {
        let mut value = base.clone(); value["actions"][0]["bindings"][0]["modifiers"] = invalid;
        assert!(matches!(parse(&value),Err(SnapshotError::InvalidRecord(_))));
    }
    let mut value = base; value["actions"][0]["bindings"][0]["sequence"] = json!([2147483648_i64]);
    assert!(matches!(parse(&value),Err(SnapshotError::Json(_))));
}

#[test]
fn action_order_and_empty_local_override_are_not_replaced_by_a_map() {
    let mut value = base_value(); value["actions"][4]["id"] = json!("pause");
    let parsed = parse(&value).unwrap();
    assert_eq!(parsed.actions()[0].id(),parsed.actions()[4].id());
    assert_eq!(parsed.actions()[0].index(),0);
    assert_eq!(parsed.actions()[4].index(),4);
    value["actions"][4]["bindings"] = value["actions"][0]["bindings"].clone();
    assert!(matches!(parse(&value),Err(SnapshotError::InvalidRecord(_))));
    let mut value = base_value(); value["actions"][0]["index"] = json!(3);
    assert!(matches!(parse(&value),Err(SnapshotError::InvalidRecord(_))));
}

#[test]
fn depth_and_parent_epoch_relationships_are_validated() {
    for (depth,parent,epoch) in [(0,"0","7"),(65,"0","7"),(1,"6","7"),
        (2,"0","7"),(2,"7","7"),(2,"8","7"),(1,"0","0")] {
        let mut value = base_value(); value["depth"] = json!(depth);
        value["parent_context_epoch"] = json!(parent); value["context_epoch"] = json!(epoch);
        assert!(matches!(parse(&value),Err(SnapshotError::InvalidRecord(_))));
    }
    // The pinned producer consumes at least one publication per new context.
    let mut value = base_value(); value["publication_sequence"] = json!("3");
    value["context_epoch"] = json!("7");
    assert!(matches!(parse(&value),Err(SnapshotError::InvalidRecord(_))));
}

#[test]
fn every_successful_pin_is_released_on_all_transport_error_paths() {
    for fail in [FailAt::Pin,FailAt::Data,FailAt::Size,FailAt::Copy] {
        let mut transport = FakeTransport::new(BASE.to_vec()); transport.fail = Some(fail);
        assert!(matches!(copy_owned_snapshot(&mut transport),Err(CopyError::Transport(_))));
        assert_eq!(transport.releases,if fail == FailAt::Pin { vec![] } else { vec![7] });
    }
    let mut transport = FakeTransport::new(BASE.to_vec()); transport.handle = 0;
    assert_eq!(copy_owned_snapshot(&mut transport),Err(CopyError::Unavailable));
    assert!(transport.releases.is_empty());
}

#[test]
fn pointer_size_overflow_and_owned_copy_mismatch_fail_and_release() {
    for (address,heap) in [(0,1024),(100,105),(u32::MAX,1_u64<<32),(32,1_u64<<33)] {
        let mut transport = FakeTransport::new(vec![0;10]); transport.address = address; transport.heap = heap;
        assert_eq!(copy_owned_snapshot(&mut transport),Err(CopyError::InvalidRange));
        assert_eq!(transport.releases,[7]);
    }
    for length in [0,u32::try_from(MAX_SNAPSHOT_BYTES+1).unwrap()] {
        let mut transport = FakeTransport::new(BASE.to_vec()); transport.length_override = Some(length);
        assert_eq!(copy_owned_snapshot(&mut transport),Err(CopyError::InvalidSize));
        assert_eq!(transport.releases,[7]);
    }
    let mut transport = FakeTransport::new(BASE.to_vec()); transport.copied_override = Some(vec![]);
    assert_eq!(copy_owned_snapshot(&mut transport),Err(CopyError::OwnedLengthMismatch));
    assert_eq!(transport.releases,[7]);
}

#[test]
fn high_bit_notice_halves_remain_lossless() {
    for low in [0,0x7fff_ffff,0x8000_0000,u32::MAX] {
        for high in [0,0x7fff_ffff,0x8000_0000,u32::MAX] {
            let status = if low == 0 && high == 0 { 3 } else { 1 };
            let notice = Notice::from_parts(1,low,high,status).unwrap();
            assert_eq!(notice.publication_sequence(),(u64::from(high)<<32)|u64::from(low));
        }
    }
    assert_eq!(Notice::from_parts(1,0,0,1),Err(NoticeError::InvalidZeroGeneration));
    assert_eq!(Notice::from_parts(2,1,0,1),Err(NoticeError::UnsupportedKind));
}

#[test]
fn nested_return_restores_old_epoch_with_new_publication_and_bindings() {
    let mut consumer = SnapshotConsumer::new(identity());
    let mut transport = FakeTransport::new(context_bytes(10,1,0,1));
    assert!(matches!(consumer.observe(notice(10,1),&mut transport),ObservationOutcome::Ready));
    transport.bytes = context_bytes(11,2,1,2);
    assert!(matches!(consumer.observe(notice(11,1),&mut transport),ObservationOutcome::Ready));
    assert_eq!(consumer.snapshot().unwrap().context_epoch(),2);
    let mut restored: Value = serde_json::from_slice(&context_bytes(12,1,0,1)).unwrap();
    restored["actions"][0]["bindings"][0]["sequence"] = json!([42]);
    transport.bytes = encode(&restored);
    assert!(matches!(consumer.observe(notice(12,1),&mut transport),ObservationOutcome::Ready));
    assert_eq!(consumer.snapshot().unwrap().context_epoch(),1);
    assert_eq!(consumer.snapshot().unwrap().actions()[0].bindings()[0].sequence(),[42]);
    assert!(matches!(consumer.observe(notice(13,0),&mut transport),ObservationOutcome::Unavailable(Availability::Unavailable)));
    assert!(consumer.snapshot().is_none());
    assert_eq!(transport.releases,[7,7,7]);
}

#[test]
fn stale_duplicates_do_not_repin_but_equal_conflicts_clear_state() {
    let mut consumer = SnapshotConsumer::new(identity());
    let mut transport = FakeTransport::new(context_bytes(10,1,0,1));
    consumer.observe(notice(10,1),&mut transport);
    assert!(matches!(consumer.observe(notice(9,0),&mut transport),ObservationOutcome::Stale));
    assert!(matches!(consumer.observe(notice(10,1),&mut transport),ObservationOutcome::Stale));
    assert_eq!(transport.pins,1);
    assert!(consumer.snapshot().is_some());
    assert!(matches!(consumer.observe(notice(10,0),&mut transport),
        ObservationOutcome::Rejected(ObservationError::ConflictingNotice)));
    assert!(consumer.snapshot().is_none());
}

#[test]
fn generation_mismatch_and_parse_failure_release_pin_and_clear_old_state() {
    let mut consumer = SnapshotConsumer::new(identity());
    let mut transport = FakeTransport::new(context_bytes(10,1,0,1));
    consumer.observe(notice(10,1),&mut transport);
    transport.bytes = context_bytes(12,2,1,2);
    assert!(matches!(consumer.observe(notice(11,1),&mut transport),
        ObservationOutcome::Rejected(ObservationError::PublicationMismatch)));
    assert!(consumer.snapshot().is_none());
    transport.bytes = vec![0xff];
    assert!(matches!(consumer.observe(notice(12,1),&mut transport),
        ObservationOutcome::Rejected(ObservationError::Snapshot(_))));
    assert_eq!(transport.releases,[7,7,7]);
    assert!(consumer.snapshot().is_none());
}

#[test]
fn zero_unsupported_is_sticky_terminal_before_stale_comparison() {
    let mut consumer = SnapshotConsumer::new(identity());
    let mut transport = FakeTransport::new(context_bytes(10,1,0,1));
    consumer.observe(notice(10,1),&mut transport);
    assert!(matches!(consumer.observe(notice(0,3),&mut transport),ObservationOutcome::TerminalUnavailable));
    transport.bytes = context_bytes(11,2,0,1);
    assert!(matches!(consumer.observe(notice(11,1),&mut transport),ObservationOutcome::TerminalUnavailable));
    assert!(consumer.terminal_unavailable());
    assert!(consumer.snapshot().is_none());
    assert_eq!(transport.pins,1);
}

#[test]
fn errors_and_valid_observations_never_authorize_commands() {
    let mut consumer = SnapshotConsumer::new(identity());
    let mut transport = FakeTransport::new(context_bytes(10,1,0,1));
    consumer.observe(notice(10,1),&mut transport);
    let denied = CommandAuthorization::Denied(DenialReason::UntrackedNativeReaders);
    assert_eq!(consumer.command_authorization(),denied);
    assert_eq!(consumer.snapshot().unwrap().command_authorization(),denied);
    assert!(matches!(consumer.observe_parts(2,11,0,1,&mut transport),
        ObservationOutcome::Rejected(ObservationError::Notice(_))));
    assert!(consumer.snapshot().is_none());
    assert_eq!(consumer.command_authorization(),denied);
    assert_eq!(transport.pins,1);
}
