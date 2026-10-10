//! Single-threaded non-shared WASM instance. Host imports never enter Rust again.
//! Native addresses refer exclusively to the original C++ heap. Rust allocations
//! are separate; the host bounds-checks both current memories on each copy.
use std::cell::RefCell;
use cdda_live_input_snapshot_consumer::{BuildIdentity, SnapshotTransport, MAX_FIELD_BYTES, MAX_SNAPSHOT_BYTES};
use crate::{BrowserInputConsumer, presentation};
#[link(wasm_import_module = "cdda_observer_host")]
unsafe extern "C" {
    fn snapshot_pin(kind: u32) -> u32;
    fn snapshot_data(handle: u32) -> u32;
    fn snapshot_size(handle: u32) -> u32;
    fn native_heap_length() -> u64;
    fn copy_to_rust(native_address: u32, rust_destination: u32, length: u32) -> u32;
    fn snapshot_release(handle: u32);
}
struct NativeTransport;
impl SnapshotTransport for NativeTransport {
    type Error = ();
    fn snapshot_pin(&mut self, kind: u32) -> Result<u32, ()> { Ok(unsafe { snapshot_pin(kind) }) }
    fn snapshot_data(&mut self, handle: u32) -> Result<u32, ()> { Ok(unsafe { snapshot_data(handle) }) }
    fn snapshot_size(&mut self, handle: u32) -> Result<u32, ()> { Ok(unsafe { snapshot_size(handle) }) }
    fn heap_length(&self) -> u64 { unsafe { native_heap_length() } }
    fn copy_owned(&mut self, address: u32, length: u32) -> Result<Vec<u8>, ()> {
        if length == 0 || length as usize > MAX_SNAPSHOT_BYTES { return Err(()); }
        let mut bytes = vec![0; length as usize];
        let copied = unsafe { copy_to_rust(address, bytes.as_mut_ptr() as u32, length) };
        if copied != length { return Err(()); }
        Ok(bytes)
    }
    fn snapshot_release(&mut self, handle: u32) { unsafe { snapshot_release(handle) }; }
}
struct State { consumer: Option<BrowserInputConsumer>, identity_scratch: Vec<u8>, raw_scratch: Vec<u8>, response: Vec<u8> }
impl State {
    fn new() -> Self { Self { consumer: None, identity_scratch: vec![0;MAX_FIELD_BYTES], raw_scratch: vec![0;MAX_FIELD_BYTES], response: presentation::not_initialized() } }
}
thread_local! { static STATE: RefCell<State> = RefCell::new(State::new()); }
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_abi_version() -> u32 { 1 }
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_identity_buffer_data() -> u32 { STATE.with(|s| { let mut state=s.borrow_mut();if state.consumer.is_some(){0}else{state.identity_scratch.as_mut_ptr() as u32} }) }
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_identity_buffer_capacity() -> u32 { STATE.with(|s|if s.borrow().consumer.is_some(){0}else{MAX_FIELD_BYTES as u32}) }
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_raw_buffer_data() -> u32 { STATE.with(|s| { let mut state=s.borrow_mut();if state.consumer.is_none(){0}else{state.raw_scratch.as_mut_ptr() as u32} }) }
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_raw_buffer_capacity() -> u32 { STATE.with(|s|if s.borrow().consumer.is_none(){0}else{MAX_FIELD_BYTES as u32}) }
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_initialize_build_id(length: u32) -> u32 {
    STATE.with(|s| {
        let mut state=s.borrow_mut();
        if state.consumer.is_some() || length == 0 || length as usize > state.identity_scratch.len() { return 0; }
        let Ok(text)=std::str::from_utf8(&state.identity_scratch[..length as usize]) else { return 0; };
        let Ok(identity)=BuildIdentity::new(text.to_owned()) else { return 0; };
        let mut consumer=BrowserInputConsumer::new(identity);
        state.response=consumer.response("initialized",None,None); state.consumer=Some(consumer); state.identity_scratch.fill(0); 1
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_observe(kind: u32, low: u32, high: u32, availability: u32) {
    STATE.with(|s| { let mut state=s.borrow_mut();
        state.response=match state.consumer.as_mut() {
            Some(consumer)=>consumer.observe(kind,low,high,availability,&mut NativeTransport),
            None=>presentation::not_initialized() };
    });
}
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_invalidate() { STATE.with(|s| {
    let mut state=s.borrow_mut();state.response=match state.consumer.as_mut() {
        Some(consumer)=>consumer.invalidate(),None=>presentation::not_initialized() };
}); }
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_accept_raw_utf8(length: u32) -> u32 { STATE.with(|s| {
    let mut state=s.borrow_mut();
    if length as usize > state.raw_scratch.len() { return 0; }
    let response=match state.consumer.as_ref() {
        Some(consumer)=>consumer.preserve_user_bytes(&state.raw_scratch[..length as usize]),
        None=>return 0 };
    match response { Ok(bytes)=>{state.response=bytes;1},Err(_)=>0 }
}); }
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_view_data() -> u32 { STATE.with(|s|s.borrow().response.as_ptr() as u32) }
#[unsafe(no_mangle)]
pub extern "C" fn cdda_input_view_size() -> u32 { STATE.with(|s|s.borrow().response.len() as u32) }
