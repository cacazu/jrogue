use cdda_live_input_snapshot_consumer::{BindingOrigin, BindingType, Modifier,
    PreferredKeyboardMode, SnapshotConsumer, TextPolicy, SOURCE_COMMIT};
use serde_json::{json, Value};
use crate::MAX_RESPONSE_BYTES;
fn deny() -> Value { json!({"kind":"denied","reason":"UntrackedNativeReaders"}) }
fn binding_type(value: BindingType) -> &'static str {
    match value { BindingType::Error=>"error", BindingType::Timeout=>"timeout",
        BindingType::KeyboardChar=>"keyboard_char", BindingType::KeyboardCode=>"keyboard_code",
        BindingType::Gamepad=>"gamepad", BindingType::Mouse=>"mouse" }
}
pub fn snapshot_response(consumer: &SnapshotConsumer, expected: &str, outcome: &str, availability: Option<&str>, error_id: Option<&str>) -> Option<Vec<u8>> {
    let snapshot = consumer.snapshot().map(|s| {
        let actions: Vec<Value> = s.actions().iter().map(|a| {
            let bindings: Vec<Value> = a.bindings().iter().map(|b| {
                let modifiers: Vec<&str> = b.modifiers().iter().map(|m| match m {
                    Modifier::Ctrl=>"ctrl", Modifier::Alt=>"alt", Modifier::Shift=>"shift" }).collect();
                json!({"type":binding_type(b.event_type()),"modifiers":modifiers,
                    "sequence":b.sequence(),"text":b.text(),"edit":b.edit(),"edit_refresh":b.edit_refresh()})
            }).collect();
            json!({"index":a.index(),"action_id":a.id(),"binding_origin":match a.origin() {
                BindingOrigin::Context=>"context",BindingOrigin::Default=>"default",BindingOrigin::Missing=>"missing"},
                "bindings":bindings})
        }).collect();
        json!({"engine_build_id":s.identity().build_id(),"publication_sequence":s.publication_sequence().to_string(),
            "context_epoch":s.context_epoch().to_string(),"parent_context_epoch":s.parent_context_epoch().to_string(),
            "depth":s.depth(),"category":s.category(),"effective_timeout_ms":s.effective_timeout_ms(),
            "text_policy":match s.text_policy(){TextPolicy::RawUtf8=>"raw_utf8",TextPolicy::NativeContext=>"native_context"},
            "preferred_keyboard_mode":match s.preferred_keyboard_mode(){PreferredKeyboardMode::Keychar=>"keychar",PreferredKeyboardMode::Keycode=>"keycode"},
            "registered_any_input":s.registered_any_input(),"coordinate_input_enabled":s.coordinate_input_enabled(),
            "iso_mode":s.iso_mode(),"actions":actions})
    });
    let bytes = serde_json::to_vec(&json!({"interface":"cdda-rust-input-view/1","schema_version":1,
        "source_commit":SOURCE_COMMIT,"engine_build_id":expected,"outcome":outcome,"availability":availability,"error_text_id":error_id,"snapshot":snapshot,
        "last_publication_sequence":consumer.last_publication_sequence().map(|n|n.to_string()),
        "terminal_unavailable":consumer.terminal_unavailable(),"command_authorization":deny()})).ok()?;
    (bytes.len() <= MAX_RESPONSE_BYTES).then_some(bytes)
}
pub fn raw_response(raw: String, expected: &str) -> Vec<u8> {
    serde_json::to_vec(&json!({"interface":"cdda-rust-raw-utf8/1","schema_version":1,
        "source_commit":SOURCE_COMMIT,"engine_build_id":expected,"source":"host_provided_bytes","raw_utf8":raw,
        "command_authorization":deny()})).expect("bounded validated raw UTF-8 serialization")
}
pub fn not_initialized() -> Vec<u8> {
    serde_json::to_vec(&json!({"interface":"cdda-rust-input-view/1","schema_version":1,
        "source_commit":SOURCE_COMMIT,"outcome":"not_initialized","snapshot":null,
        "terminal_unavailable":false,"last_publication_sequence":null,"command_authorization":deny()}))
        .expect("fixed denied response")
}
