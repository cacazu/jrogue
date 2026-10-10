//! Single-threaded JSON ABI: JS copies requests into an initialized owned buffer.
//! No native pointers, process capabilities, or game state are exposed.
use crate::{
    display::{frame, native_text},
    input,
    platform::{native_input, vfs},
    verification::Verification,
};
use serde::Deserialize;
use serde_json::json;
use std::cell::RefCell;
use std::collections::BTreeMap;

const CAPACITY: usize = 1_048_576;
struct Host {
    buffer: Vec<u8>,
    output: Vec<u8>,
    session: Option<Verification>,
    filesystem: vfs::FileSystem,
    native_locales: Option<native_text::Locales>,
}
thread_local! {
    static HOST: RefCell<Host> = RefCell::new(Host { buffer: vec![0; CAPACITY], output: Vec::new(), session: Verification::new(5489).ok(), filesystem: vfs::FileSystem::new(), native_locales: native_text::Locales::compiled().ok() });
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum Request {
    Reset {
        seed: u32,
    },
    Draw,
    Dice {
        number: u32,
        sides: u32,
    },
    Redraw {
        english: bool,
    },
    Keyboard {
        event: input::KeyboardEvent,
    },
    Save,
    Load {
        envelope: String,
    },
    FileSystem {
        operation: vfs::Operation,
    },
    NativeText {
        id: String,
        #[serde(deserialize_with = "native_text::deserialize_parameters")]
        parameters: BTreeMap<String, native_text::WireParameter>,
        #[serde(default)]
        english: bool,
    },
    NativeInput {
        event: native_input::Request,
    },
    Frame {
        bytes: Vec<u8>,
        #[serde(default)]
        commands: Vec<frame::WireCommand>,
    },
}

// SAFETY: unique ABI symbols, intentionally public; pointers refer only to this
// module's stable initialized byte buffers and are used by the single-threaded host.
#[unsafe(no_mangle)]
pub extern "C" fn drl_request_pointer() -> usize {
    HOST.with(|host| host.borrow_mut().buffer.as_mut_ptr() as usize)
}
#[unsafe(no_mangle)]
pub extern "C" fn drl_request_capacity() -> usize {
    CAPACITY
}
#[unsafe(no_mangle)]
pub extern "C" fn drl_output_pointer() -> usize {
    HOST.with(|host| host.borrow().output.as_ptr() as usize)
}
#[unsafe(no_mangle)]
pub extern "C" fn drl_output_length() -> usize {
    HOST.with(|host| host.borrow().output.len())
}

#[unsafe(no_mangle)]
pub extern "C" fn drl_text_columns(length: usize) -> i32 {
    HOST.with(|host| {
        let host = host.borrow();
        if length > CAPACITY {
            return -1;
        }
        std::str::from_utf8(&host.buffer[..length])
            .ok()
            .and_then(|text| frame::text_columns(text).ok())
            .and_then(|n| i32::try_from(n).ok())
            .unwrap_or(-1)
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn drl_text_fit(length: usize, max_columns: u32) -> i32 {
    HOST.with(|host| {
        let host = host.borrow();
        if length > CAPACITY {
            return -1;
        }
        std::str::from_utf8(&host.buffer[..length])
            .ok()
            .and_then(|text| frame::text_fit(text, max_columns).ok())
            .and_then(|n| i32::try_from(n).ok())
            .unwrap_or(-1)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn drl_dispatch(length: usize) -> u32 {
    HOST.with(|host| {
        let mut host = host.borrow_mut();
        let response = if length > CAPACITY { json!({"error_id":"lab.invalid_save"}) } else {
            let request = serde_json::from_slice::<Request>(&host.buffer[..length]);
            let request = match request {
                Ok(Request::FileSystem { operation }) => {
                    let response = json!({"filesystem":vfs::execute(&mut host.filesystem, operation)});
                    host.output = serde_json::to_vec(&response).unwrap_or_default();
                    return 1;
                }
                Ok(Request::NativeText { id, parameters, english }) => {
                    let parameters: Result<BTreeMap<_,_>,native_text::Error> = parameters.into_iter().map(|(name, value)| Ok((name, match value {
                        native_text::WireParameter::String(text) => native_text::Parameter::String(text),
                        native_text::WireParameter::Integer(value) => native_text::Parameter::Integer(native_text::canonical_integer(&value)?),
                    }))).collect();
                    let rendered = parameters.ok().and_then(|params| host.native_locales.as_ref().and_then(|locales| locales.render(&id, &params, english).ok()));
                    let successful = rendered.is_some();
                    host.output = serde_json::to_vec(&json!({"semantic":{"text":rendered}})).unwrap_or_default();
                    return u32::from(successful);
                }
                Ok(Request::NativeInput { event }) => {
                    let normalized = native_input::normalize(&event).ok();
                    let successful = normalized.is_some();
                    host.output = serde_json::to_vec(&json!({"input":normalized})).unwrap_or_default();
                    return u32::from(successful);
                }
                Ok(Request::Frame { bytes, commands }) => {
                    let projected = frame::project_with_commands(&bytes, &commands).ok();
                    let successful = projected.is_some();
                    host.output = serde_json::to_vec(&json!({"presentation":projected})).unwrap_or_default();
                    return u32::from(successful);
                }
                other => other,
            };
            if let Some(session) = host.session.as_mut() {
                match request {
                    Err(_) => json!({"error_id":"lab.invalid_save"}),
                    Ok(request) => {
                        let mut envelope = None;
                        let mut english = false;
                        let mut error = None;
                        match request {
                            Request::Reset { seed } => session.reset(seed),
                            Request::Draw => { session.draw(); }
                            Request::Dice { number, sides } => { if session.dice(number, sides).is_err() { error = Some("lab.invalid_save"); } }
                            Request::Redraw { english: chosen } => english = chosen,
                            Request::Keyboard { event } => { if let Some(action) = input::keyboard(&event) { session.observe_input(action.id()); } }
                            Request::Save => match session.save() { Ok(text) => envelope = Some(text), Err(_) => error = Some("lab.invalid_save") },
                            Request::Load { envelope } => { if session.restore(&envelope).is_err() { error = Some("lab.invalid_save"); } }
                            Request::FileSystem { .. } | Request::NativeText { .. } | Request::NativeInput { .. } | Request::Frame { .. } => unreachable!("adapter requests dispatch outside the reference session"),
                        }
                        if let Some(error_id) = error { json!({"error_id":error_id}) } else {
                            match session.labels(english) {
                                Ok(labels) => json!({"checkpoint":session.checkpoint(),"labels":labels,"save":envelope}),
                                Err(_) => json!({"error_id":"lab.runtime_error"}),
                            }
                        }
                    }
                }
            } else { json!({"error_id":"lab.runtime_error"}) }
        };
        host.output = serde_json::to_vec(&response).unwrap_or_else(|_| b"{\"error_id\":\"lab.runtime_error\"}".to_vec());
        u32::from(response.get("error_id").is_none())
    })
}
