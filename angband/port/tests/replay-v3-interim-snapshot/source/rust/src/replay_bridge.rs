//! Synchronous owning bridge for the version-3 replay model.
//!
//! Setup ABI: `prepare(identity,128,kind,seed,load_mode,native,native_len,
//! rng,rng_words,environment,environment_len)` and
//! `unwrap(envelope,len,identity,128)` return 0 or ReplayError 40..46.
//! kind 0=new/1=loaded; load_mode 0=legacy plain/1=checkpoint native.
//! Checkpoint native alone installs the full 38-word restored RNG consumed by
//! main-web.c's existing checkpoint path. A plain native load never enables it.
//! Bootstrap getters return owned bytes, kind, seed and load mode, valid until
//! the next prepare/unwrap/reset. No setup pointer is retained.
//!
//! `pending_set(words,packet_count,context,context_len)` copies 16 words per
//! nonempty event plus the exact browser draft/context before SAVE or FLUSH.
//! Failure permanently poisons recording, but live waits and flushes continue.
//! Target getters return owned pending words/context only after all wait,
//! native observation, screen, semantic and extension evidence matches.
//! Their pointers remain valid until the next prepare/unwrap/reset, and must
//! be copied by JS before another call or an Asyncify yield.
//!
//! C runtime ABI is exactly web-replay-environment.h: wait modes 0=live,
//! 1=recorded, 2=matched target now live, 3=mismatch; environment begin modes
//! 0=live, 1=recorded facts, 2=mismatch. Other operations return 0 or 40..46.
//! Environment output is invalidated by the next begin/commit. `next` copies
//! one recorded event once; `commit` checks its actual native dispatch result.
//! SAVE uses the existing shared ab_rs_save_len/status/output, never a stale
//! native save. Save is unavailable if any required snapshot fails or exceeds
//! bounds. Legacy v1/v2 envelopes remain handled by their original APIs.
//!
//! Caller contract: all nonempty input spans are readable and initialized;
//! u32 spans are aligned; output spans are writable and do not alias inputs,
//! bridge-owned getters, or any Rust allocation. Pointer arithmetic, null,
//! alignment and length checks precede access, but allocation validity cannot
//! be proved by Rust from a raw C pointer. Calls are synchronous and nonreentrant;
//! no borrow, input pointer or output pointer survives an Asyncify yield.
//! Evidence is locale-independent: canonical native cells and owned semantic
//! source facts, never Japanese/English rendered text, plus all54 native words
//! in LE order, length framed and domain separated before SHA-256. No RNG,
//! filesystem, clock, simulation or repaint occurs here.

use crate::input::{EventPacket, NativeEvent};
use crate::localization::json::{self, JsonValue, Limits};
use crate::platform::{validate_rng, RngSnapshot};
use crate::replay::{self, Bootstrap, BootstrapKind, Extension, Identity, NativeLoadMode,
    Recorder, ReplayCursor, ReplayEnvelope, ReplayError, Target, WaitAction};
use std::cell::RefCell;
use std::ffi::c_char;

const EVENT_WORDS: usize = 16;
const IDENTITY_BYTES: usize = 128;
const MAX_SITE: usize = 128;
const MAX_DRAFT: usize = 64 * 1024;
const EVIDENCE_DOMAIN: &[u8] = b"angband.replay.wait.evidence.v1\0";
type Observation = [u32; replay::NATIVE_WAIT_WORDS];

enum Session { Disabled, Live(Recorder), Replay(ReplayCursor) }
struct HostPending { packets: Vec<EventPacket>, context: Vec<u8> }
struct EnvironmentRequest { site: String, kind: u32 }
struct Bridge {
    session: Session,
    status: u32,
    replay_failure: Option<ReplayError>,
    last_wait: Option<Observation>,
    next: Option<EventPacket>,
    next_taken: bool,
    pending: Option<HostPending>,
    environment_request: Option<EnvironmentRequest>,
    environment_output: Vec<u8>,
    target_pending: Vec<u32>,
    target_context: Vec<u8>,
    target_ready: bool,
    largest_text_group: u64,
}
impl Default for Bridge {
    fn default() -> Self { Self { session: Session::Disabled, status: 0, replay_failure: None,
        last_wait: None, next: None, next_taken: false, pending: None,
        environment_request: None, environment_output: Vec::new(),
        target_pending: Vec::new(), target_context: Vec::new(), target_ready: false,
        largest_text_group: 0 } }
}
impl Bridge {
    fn fail(&mut self, error: ReplayError) -> u32 {
        self.status = error as u32;
        match &mut self.session {
            Session::Live(recorder) => { recorder.failure.get_or_insert(error); },
            Session::Replay(_) => { self.replay_failure.get_or_insert(error); },
            Session::Disabled => {},
        }
        error as u32
    }
    fn bootstrap(&self) -> Option<&Bootstrap> {
        match &self.session { Session::Live(value) => Some(&value.bootstrap),
            Session::Replay(value) => Some(&value.envelope.bootstrap), Session::Disabled => None }
    }
    fn is_replay(&self) -> bool { matches!(self.session, Session::Replay(_)) }
    fn wait(&mut self, words: Observation, digest: [u8; 32]) -> Result<u32, ReplayError> {
        if let Some(error) = self.replay_failure { return Err(error); }
        if self.next.is_some() || self.environment_request.is_some() { return Err(ReplayError::Order); }
        self.pending = None;
        self.last_wait = Some(words);
        match &mut self.session {
            Session::Disabled => Ok(0),
            Session::Live(recorder) => { recorder.enter_wait(digest)?; Ok(0) },
            Session::Replay(cursor) => match cursor.enter_wait(digest)? {
                WaitAction::Recorded { event, .. } => {
                    self.next = Some(event); self.next_taken = false; Ok(1)
                },
                WaitAction::Target => {
                    cursor.verify_target_observation(&words)?;
                    let expected = &cursor.envelope.target.extensions;
                    let actual = snapshot_extensions()?;
                    if !same_extensions(&actual, expected) { return Err(ReplayError::Mismatch); }
                    validate_extensions(expected)?;
                    let largest_text_group=envelope_text_group(&cursor.envelope);
                    if validate_context(&cursor.envelope.target.browser_context)?<=largest_text_group {
                        return Err(ReplayError::Order);
                    }
                    let pending = cursor.envelope.target.pending.iter()
                        .flat_map(|packet| packet.words()).collect();
                    let context = cursor.envelope.target.browser_context.clone();
                    // Both extension owners validate before either is installed.
                    restore_extensions(expected)?;
                    let Session::Replay(cursor) = std::mem::replace(&mut self.session, Session::Disabled)
                        else { return Err(ReplayError::Order); };
                    self.session = Session::Live(cursor.into_recorder()?);
                    self.target_pending = pending; self.target_context = context;
                    self.largest_text_group=largest_text_group;
                    self.target_ready = true; Ok(2)
                },
            },
        }
    }
    fn commit(&mut self, packet: EventPacket, result: i32) -> Result<(), ReplayError> {
        if let Some(error) = self.replay_failure { return Err(error); }
        let outcome = match &mut self.session {
            Session::Disabled => Ok(()),
            Session::Live(recorder) => recorder.commit(packet, result),
            Session::Replay(cursor) => {
                if !self.next_taken || self.next != Some(packet) { return Err(ReplayError::Order); }
                cursor.commit(packet, result)
            },
        };
        if outcome.is_ok() || !self.is_replay() {
            self.largest_text_group=self.largest_text_group.max(packet.origin.group);
            self.next = None; self.next_taken = false; self.last_wait = None; self.pending = None;
        }
        outcome
    }
    fn flush(&mut self) -> Result<(), ReplayError> {
        if let Some(error) = self.replay_failure { return Err(error); }
        if matches!(self.session, Session::Disabled) { return Ok(()); }
        let pending = self.pending.take().ok_or(ReplayError::CaptureFailed)?;
        match &mut self.session {
            Session::Disabled => Ok(()),
            Session::Live(recorder) => {
                self.largest_text_group=self.largest_text_group.max(packet_text_group(&pending.packets));
                recorder.flush(pending.packets)
            },
            Session::Replay(cursor) => {
                // During catch-up input is gated. Original discarded packets
                // are already owned by the journal, not delivered to native C.
                if !pending.packets.is_empty() { return Err(ReplayError::Mismatch); }
                cursor.flush().map(|_| ())
            },
        }
    }
    fn save(&self) -> Result<Vec<u8>, ReplayError> {
        let Session::Live(recorder) = &self.session else { return Err(ReplayError::Order); };
        if let Some(error) = recorder.failure { return Err(error); }
        let wait = recorder.pending().ok_or(ReplayError::Order)?;
        let words = self.last_wait.ok_or(ReplayError::Order)?;
        let pending = self.pending.as_ref().ok_or(ReplayError::CaptureFailed)?;
        let extensions = snapshot_extensions()?;
        recorder.save(Target { wait, native_observation: words, pending: pending.packets.clone(),
            browser_context: pending.context.clone(), extensions })
    }
    fn aliases_output(&self, start: usize, len: usize) -> bool {
        let overlaps = |pointer: usize, size: usize| {
            size != 0 && start < pointer.saturating_add(size) && pointer < start.saturating_add(len)
        };
        overlaps(self.environment_output.as_ptr() as usize, self.environment_output.len()) ||
        overlaps(self.target_pending.as_ptr() as usize, self.target_pending.len() * 4) ||
        overlaps(self.target_context.as_ptr() as usize, self.target_context.len()) ||
        self.bootstrap().is_some_and(|b| overlaps(b.native.as_ptr() as usize,b.native.len()) ||
            overlaps(b.environment.as_ptr() as usize,b.environment.len()))
    }
}
thread_local! { static BRIDGE: RefCell<Bridge> = RefCell::new(Bridge::default()); }

fn mutate<T>(operation: impl FnOnce(&mut Bridge) -> Result<T, ReplayError>) -> Result<T, ReplayError> {
    BRIDGE.with(|bridge| {
        let mut bridge = bridge.try_borrow_mut().map_err(|_| ReplayError::CaptureFailed)?;
        match operation(&mut bridge) { Ok(value) => Ok(value), Err(error) => { bridge.fail(error); Err(error) } }
    })
}
fn poison(error: ReplayError) -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow_mut().map(|mut bridge| bridge.fail(error))
        .unwrap_or(ReplayError::CaptureFailed as u32))
}
fn status(result: Result<(), ReplayError>) -> u32 { result.err().map_or(0, |error| error as u32) }
fn span(pointer: usize, len: usize, alignment: usize) -> Result<(), ReplayError> {
    if len == 0 { return Ok(()); }
    if pointer == 0 || pointer % alignment != 0 || len > isize::MAX as usize ||
        pointer.checked_add(len).is_none_or(|end| end > isize::MAX as usize) {
        return Err(ReplayError::Malformed);
    }
    #[cfg(target_arch = "wasm32")]
    {
        let end=pointer.checked_add(len).ok_or(ReplayError::Malformed)?;
        let memory_bytes=(core::arch::wasm32::memory_size(0)as u64)*65_536;
        memory_extent(end,memory_bytes)?;
    }
    Ok(())
}
#[cfg(any(test,target_arch="wasm32"))]
fn memory_extent(end:usize,memory_bytes:u64)->Result<(),ReplayError> {
    if end as u64>memory_bytes {Err(ReplayError::Malformed)} else {Ok(())}
}
fn aliases_adapter_output(start: usize, len: usize) -> Result<bool, ReplayError> {
    crate::ADAPTER.with(|state| {
        let state=state.try_borrow().map_err(|_| ReplayError::CaptureFailed)?;
        let overlaps=|pointer:usize,size:usize| size!=0 && start<pointer.saturating_add(size) &&
            pointer<start.saturating_add(len);
        Ok(overlaps(state.save_output.as_ptr()as usize,state.save_output.len()) ||
            overlaps(state.frame.as_ptr()as usize,state.frame.len()) ||
            overlaps(state.message_output.as_ptr()as usize,state.message_output.len()))
    })
}
unsafe fn copy_bytes(pointer: *const u8, len: u32, cap: usize) -> Result<Vec<u8>, ReplayError> {
    let len = len as usize;
    if len > cap { return Err(ReplayError::Bounds); }
    span(pointer as usize,len,1)?;
    if len == 0 { return Ok(Vec::new()); }
    // SAFETY: checked range/null above; the synchronous caller guarantees the
    // initialized allocation. Copy completes before any mutable runtime borrow.
    Ok(unsafe { std::slice::from_raw_parts(pointer,len) }.to_vec())
}
unsafe fn copy_words(pointer: *const u32, len: u32, cap: usize) -> Result<Vec<u32>, ReplayError> {
    let len = len as usize;
    if len > cap { return Err(ReplayError::Bounds); }
    let bytes = len.checked_mul(4).ok_or(ReplayError::Bounds)?;
    span(pointer as usize,bytes,4)?;
    if len == 0 { return Ok(Vec::new()); }
    // SAFETY: aligned bounded synchronous readable span required by caller.
    Ok(unsafe { std::slice::from_raw_parts(pointer,len) }.to_vec())
}
unsafe fn copy_site(pointer: *const c_char) -> Result<String, ReplayError> {
    span(pointer as usize,1,1)?;
    let mut bytes = Vec::with_capacity(MAX_SITE);
    for index in 0..=MAX_SITE {
        let address=(pointer as usize).checked_add(index).ok_or(ReplayError::Malformed)?;
        span(address,1,1)?;
        // SAFETY: caller provides a readable terminated C string no longer than
        // MAX_SITE; scan stops at its NUL, never retaining the borrowed pointer.
        let byte = unsafe { *pointer.cast::<u8>().add(index) };
        if byte == 0 {
            if bytes.is_empty() { return Err(ReplayError::Malformed); }
            return String::from_utf8(bytes).map_err(|_| ReplayError::Malformed);
        }
        if index == MAX_SITE || !(byte.is_ascii_alphanumeric() || b"._-".contains(&byte)) {
            return Err(ReplayError::Malformed);
        }
        bytes.push(byte);
    }
    Err(ReplayError::Malformed)
}
fn identity(bytes: &[u8]) -> Result<Identity, ReplayError> {
    if bytes.len() != IDENTITY_BYTES { return Err(ReplayError::Identity); }
    let mut result = [[0;32];4];
    for (output,input) in result.iter_mut().zip(bytes.chunks_exact(32)) { output.copy_from_slice(input); }
    Ok(Identity(result))
}
fn parse_object(bytes: &[u8], cap: usize) -> Result<JsonValue, ReplayError> {
    let text = std::str::from_utf8(bytes).map_err(|_| ReplayError::Malformed)?;
    let value = json::parse(text,Limits { max_bytes:cap,max_depth:32,max_nodes:262_144,
        max_string_bytes:cap }).map_err(|_| ReplayError::Malformed)?;
    if value.as_object().is_none() { return Err(ReplayError::Malformed); }
    Ok(value)
}
fn fields(value: &JsonValue, expected: &[&str]) -> Result<(), ReplayError> {
    let entries = value.as_object().ok_or(ReplayError::Malformed)?;
    if entries.len() != expected.len() || entries.iter().any(|(name,_)| !expected.contains(&name.as_str())) {
        return Err(ReplayError::Malformed);
    }
    Ok(())
}
fn unsigned(value: Option<&JsonValue>) -> Result<u32, ReplayError> {
    value.and_then(JsonValue::as_integer).and_then(|n| u32::try_from(n).ok()).ok_or(ReplayError::Malformed)
}
fn validate_environment(bytes: &[u8]) -> Result<(), ReplayError> {
    let value = parse_object(bytes,replay::MAX_ENVIRONMENT)?;
    if value.field("schema_version").and_then(JsonValue::as_integer) != Some(1) { return Err(ReplayError::Malformed); }
    // The worker additionally validates exact isolated FS paths, file schema,
    // base64 sizes, timestamps and installation before starting native code.
    Ok(())
}
fn validate_context(bytes: &[u8]) -> Result<u64, ReplayError> {
    let value = parse_object(bytes,replay::MAX_CONTEXT)?;
    fields(&value,&["schema_version","next_group","draft"])?;
    if value.field("schema_version").and_then(JsonValue::as_integer) != Some(1) { return Err(ReplayError::Malformed); }
    let group = value.field("next_group").and_then(JsonValue::as_array).ok_or(ReplayError::Malformed)?;
    if group.len()!=2 { return Err(ReplayError::Malformed); }
    let next_group=u64::from(unsigned(group.first())?) | (u64::from(unsigned(group.get(1))?)<<32);
    if next_group==0 {return Err(ReplayError::Order);}
    let draft = value.field("draft").ok_or(ReplayError::Malformed)?;
    fields(draft,&["text","composing","selectionStart","selectionEnd","selectionDirection","focused"])?;
    let text = draft.field("text").and_then(JsonValue::as_str).ok_or(ReplayError::Malformed)?;
    if text.len() > MAX_DRAFT { return Err(ReplayError::Bounds); }
    if text.contains('\0') {return Err(ReplayError::Malformed);}
    let start = unsigned(draft.field("selectionStart"))?;
    let end = unsigned(draft.field("selectionEnd"))?;
    if start>end || end as usize > text.encode_utf16().count() { return Err(ReplayError::Malformed); }
    if draft.field("composing").and_then(JsonValue::as_bool).is_none() ||
        draft.field("focused").and_then(JsonValue::as_bool).is_none() ||
        !matches!(draft.field("selectionDirection").and_then(JsonValue::as_str),Some("none"|"forward"|"backward")) {
        return Err(ReplayError::Malformed);
    }
    Ok(next_group)
}
fn packet_text_group(packets:&[EventPacket])->u64 {
    packets.iter().map(|packet|packet.origin.group).max().unwrap_or(0)
}
fn envelope_text_group(envelope:&ReplayEnvelope)->u64 {
    envelope.entries.iter().fold(packet_text_group(&envelope.target.pending),|max,entry| {
        max.max(match &entry.outcome {
            replay::Outcome::Poll {event,..}=>event.origin.group,
            replay::Outcome::Flush {discarded}=>packet_text_group(discarded),
            replay::Outcome::Environment {..}=>0,
        })
    })
}
fn packets(words: &[u32]) -> Result<Vec<EventPacket>, ReplayError> {
    if words.len()%EVENT_WORDS!=0 || words.len()/EVENT_WORDS>replay::MAX_PENDING { return Err(ReplayError::Bounds); }
    words.chunks_exact(EVENT_WORDS).map(|words| {
        let packet = EventPacket::from_words(words).ok_or(ReplayError::InvalidInput)?;
        if matches!(packet.event,NativeEvent::None) { return Err(ReplayError::InvalidInput); }
        Ok(packet)
    }).collect()
}
fn validate_extensions(values: &[Extension]) -> Result<(), ReplayError> {
    let mut seen = Vec::new();
    for value in values {
        if value.version!=crate::death_cause::EXTENSION_VERSION || seen.contains(&value.id.as_str()) {
            return Err(ReplayError::Malformed);
        }
        seen.push(value.id.as_str());
        match value.id.as_str() {
            crate::death_cause::CAUSE_EXTENSION_ID => { crate::death_cause::validate_cause(&value.bytes).map_err(|_| ReplayError::Malformed)?; },
            crate::death_cause::SCORES_EXTENSION_ID => { crate::death_cause::validate_scores(&value.bytes).map_err(|_| ReplayError::Malformed)?; },
            _ => return Err(ReplayError::Malformed),
        }
    }
    Ok(())
}
fn snapshot_extensions() -> Result<Vec<Extension>, ReplayError> {
    let cause = crate::death_cause::snapshot_cause().map_err(|_| ReplayError::CaptureFailed)?;
    let scores = crate::death_cause::snapshot_scores().map_err(|_| ReplayError::CaptureFailed)?;
    let mut values = Vec::new();
    for (id,bytes) in [(crate::death_cause::CAUSE_EXTENSION_ID,cause),(crate::death_cause::SCORES_EXTENSION_ID,scores)] {
        if let Some(bytes) = bytes { values.push(Extension { id:id.into(),version:crate::death_cause::EXTENSION_VERSION,bytes }); }
    }
    validate_extensions(&values)?;
    Ok(values)
}
fn restore_extensions(values: &[Extension]) -> Result<(), ReplayError> {
    validate_extensions(values)?;
    let find = |id| values.iter().find(|value| value.id==id).map(|value| value.bytes.as_slice());
    crate::death_cause::restore_cause(find(crate::death_cause::CAUSE_EXTENSION_ID)).map_err(|_| ReplayError::CaptureFailed)?;
    crate::death_cause::restore_scores(find(crate::death_cause::SCORES_EXTENSION_ID)).map_err(|_| ReplayError::CaptureFailed)?;
    Ok(())
}
fn same_extensions(left: &[Extension], right: &[Extension]) -> bool {
    left.len()==right.len() && left.iter().all(|item| right.iter().any(|other| other==item))
}
fn evidence_digest(words: &Observation, frame: &[u8], semantic: &[u8]) -> [u8;32] {
    let mut native = [0u8;replay::NATIVE_WAIT_WORDS*4];
    for (word,bytes) in words.iter().zip(native.chunks_exact_mut(4)) { bytes.copy_from_slice(&word.to_le_bytes()); }
    let frame_len = (frame.len() as u64).to_le_bytes();
    let semantic_len = (semantic.len() as u64).to_le_bytes();
    crate::digest::sha256(&[EVIDENCE_DOMAIN,&native,&frame_len,frame,&semantic_len,semantic])
}
fn current_digest(words: &Observation) -> Result<[u8;32], ReplayError> {
    let frame = crate::ADAPTER.with(|state| state.try_borrow().map(|state| state.screen.snapshot().encode_json())
        .map_err(|_| ReplayError::CaptureFailed))?;
    let semantic = crate::semantic_presentation::source_evidence().map_err(|_| ReplayError::CaptureFailed)?;
    Ok(evidence_digest(words,frame.as_bytes(),&semantic))
}
fn install_native_rng(base: &Bootstrap) -> Result<(), ReplayError> {
    crate::ADAPTER.with(|state| {
        let mut state = state.try_borrow_mut().map_err(|_| ReplayError::CaptureFailed)?;
        state.restored_rng = if base.native_load_mode==NativeLoadMode::CheckpointNative { base.loaded_boundary_rng } else { None };
        state.checkpoint_rng = None; state.save_output.clear(); state.save_status=0; Ok(())
    })
}

/// See the module's synchronous pointer and ownership contract.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_replay_prepare(
    identity_ptr:*const u8,identity_len:u32,kind:u32,seed:u32,load_mode:u32,
    native_ptr:*const u8,native_len:u32,rng_ptr:*const u32,rng_words:u32,
    environment_ptr:*const u8,environment_len:u32,
) -> u32 {
    let setup = (|| {
        // SAFETY: bounded initialized caller spans; every value is owned before
        // touching runtime state, including a previously returned getter span.
        let id = identity(&unsafe { copy_bytes(identity_ptr,identity_len,IDENTITY_BYTES) }?)?;
        let native = unsafe { copy_bytes(native_ptr,native_len,replay::MAX_NATIVE) }?;
        let environment = unsafe { copy_bytes(environment_ptr,environment_len,replay::MAX_ENVIRONMENT) }?;
        validate_environment(&environment)?;
        let kind = match kind { 0=>BootstrapKind::NewGame,1=>BootstrapKind::LoadedGame,_=>return Err(ReplayError::Malformed) };
        let native_load_mode = match load_mode { 0=>NativeLoadMode::LegacyPlain,1=>NativeLoadMode::CheckpointNative,_=>return Err(ReplayError::Malformed) };
        let loaded_boundary_rng = match rng_words {
            0=>None,38=>{ let words=unsafe { copy_words(rng_ptr,rng_words,38) }?;
                let rng:RngSnapshot=words.try_into().map_err(|_| ReplayError::Malformed)?;
                validate_rng(&rng).map_err(|_| ReplayError::Malformed)?;Some(rng) },
            _=>return Err(ReplayError::Malformed),
        };
        if (kind==BootstrapKind::NewGame && (!native.is_empty() || loaded_boundary_rng.is_some() || native_load_mode!=NativeLoadMode::LegacyPlain)) ||
            (kind==BootstrapKind::LoadedGame && native.is_empty()) ||
            (native_load_mode==NativeLoadMode::CheckpointNative && loaded_boundary_rng.is_none()) ||
            (native_load_mode==NativeLoadMode::LegacyPlain && loaded_boundary_rng.is_some()) { return Err(ReplayError::Malformed); }
        let extensions = snapshot_extensions()?;
        Ok((id,Bootstrap { kind,native_load_mode,seed,post_init_rng:None,loaded_boundary_rng,native,environment,extensions }))
    })();
    match setup {
        Ok((id,base)) => status(mutate(|bridge| {
            install_native_rng(&base)?;
            *bridge=Bridge { session:Session::Live(Recorder::new(id,base)),..Bridge::default() };Ok(())
        })),
        Err(error)=>poison(error),
    }
}

/// Rejects legacy envelopes here: their original decoder remains available.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_replay_unwrap(bytes:*const u8,len:u32,id_ptr:*const u8,id_len:u32) -> u32 {
    let setup = (|| {
        // SAFETY: copied synchronously under the documented input contract.
        let bytes=unsafe { copy_bytes(bytes,len,replay::MAX_ENVELOPE) }?;
        let id=identity(&unsafe { copy_bytes(id_ptr,id_len,IDENTITY_BYTES) }?)?;
        let envelope=ReplayEnvelope::decode(&bytes,id)?;
        validate_environment(&envelope.bootstrap.environment)?;
        if validate_context(&envelope.target.browser_context)?<=envelope_text_group(&envelope) {
            return Err(ReplayError::Order);
        }
        validate_extensions(&envelope.bootstrap.extensions)?;
        validate_extensions(&envelope.target.extensions)?;
        let cursor=ReplayCursor::new(envelope)?;
        Ok(cursor)
    })();
    match setup {
        Ok(cursor)=>status(mutate(|bridge| {
            restore_extensions(&cursor.envelope.bootstrap.extensions)?;
            install_native_rng(&cursor.envelope.bootstrap)?;
            *bridge=Bridge { session:Session::Replay(cursor),..Bridge::default() };Ok(())
        })),
        Err(error)=>poison(error),
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_enabled() -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().map(|bridge| u32::from(!matches!(bridge.session,Session::Disabled))).unwrap_or(1))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_status() -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().map(|bridge| bridge.status).unwrap_or(ReplayError::CaptureFailed as u32))
}
/// Explicit session teardown; do not reset while native C is running.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_reset() -> u32 {
    status(mutate(|bridge| { *bridge=Bridge::default();
        crate::ADAPTER.with(|state| { let mut state=state.try_borrow_mut().map_err(|_| ReplayError::CaptureFailed)?;
            state.restored_rng=None;state.checkpoint_rng=None;state.save_output.clear();state.save_status=0;Ok(()) }) }))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_bootstrap_kind() -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().ok().and_then(|bridge| bridge.bootstrap().map(|b| match b.kind {BootstrapKind::NewGame=>0,BootstrapKind::LoadedGame=>1})).unwrap_or(u32::MAX))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_bootstrap_seed() -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().ok().and_then(|bridge| bridge.bootstrap().map(|b| b.seed)).unwrap_or(0))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_bootstrap_native_load_mode() -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().ok().and_then(|bridge| bridge.bootstrap().map(|b| match b.native_load_mode {NativeLoadMode::LegacyPlain=>0,NativeLoadMode::CheckpointNative=>1})).unwrap_or(u32::MAX))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_bootstrap_native_data() -> *const u8 {
    BRIDGE.with(|bridge| bridge.try_borrow().ok().and_then(|bridge| bridge.bootstrap().map(|b| b.native.as_ptr())).unwrap_or(std::ptr::null()))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_bootstrap_native_len() -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().ok().and_then(|bridge| bridge.bootstrap().map(|b| b.native.len() as u32)).unwrap_or(0))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_bootstrap_environment_data() -> *const u8 {
    BRIDGE.with(|bridge| bridge.try_borrow().ok().and_then(|bridge| bridge.bootstrap().map(|b| b.environment.as_ptr())).unwrap_or(std::ptr::null()))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_bootstrap_environment_len() -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().ok().and_then(|bridge| bridge.bootstrap().map(|b| b.environment.len() as u32)).unwrap_or(0))
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_replay_bootstrap_rng(pointer:*const u32,len:u32) -> u32 {
    let was_replay=BRIDGE.with(|bridge| bridge.try_borrow().map(|b| b.is_replay()).unwrap_or(true));
    let result=(|| {
        if len!=38 { return Err(ReplayError::Malformed); }
        // SAFETY: caller supplies exactly38 aligned readable words.
        let words=unsafe { copy_words(pointer,len,38) }?;
        let rng:RngSnapshot=words.try_into().map_err(|_| ReplayError::Malformed)?;
        validate_rng(&rng).map_err(|_| ReplayError::Malformed)?;
        mutate(|bridge| match &mut bridge.session {
            Session::Disabled=>Ok(()),
            Session::Live(recorder)=>{
                if recorder.bootstrap.post_init_rng.is_some() { return Err(ReplayError::Order); }
                recorder.bootstrap.post_init_rng=Some(rng);Ok(())
            },
            Session::Replay(cursor)=>if cursor.envelope.bootstrap.post_init_rng==Some(rng) {Ok(())} else {Err(ReplayError::Mismatch)},
        })
    })();
    if let Err(error)=result { poison(error); if was_replay {return error as u32;} }
    0 // A capture failure blocks saving; it never changes ordinary live setup.
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_replay_wait(pointer:*const u32,len:u32) -> u32 {
    if ab_rs_replay_enabled()==0 { return 0; }
    let result=(|| {
        if len!=replay::NATIVE_WAIT_WORDS as u32 { return Err(ReplayError::Malformed); }
        // SAFETY: caller supplies exactly54 aligned readable words.
        let words:Observation=unsafe { copy_words(pointer,len,replay::NATIVE_WAIT_WORDS) }?
            .try_into().map_err(|_| ReplayError::Malformed)?;
        replay::valid_observation(&words)?;
        let digest=current_digest(&words)?;
        mutate(|bridge| bridge.wait(words,digest))
    })();
    match result { Ok(mode)=>mode,Err(error)=>{
        poison(error);BRIDGE.with(|bridge| bridge.try_borrow().map(|b| if b.is_replay(){3}else{0}).unwrap_or(3))
    } }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_replay_next(output:*mut u32,len:u32) -> u32 {
    status(mutate(|bridge| {
        if len!=EVENT_WORDS as u32 { return Err(ReplayError::Malformed); }
        span(output as usize,EVENT_WORDS*4,4)?;
        if bridge.aliases_output(output as usize,EVENT_WORDS*4) ||
            aliases_adapter_output(output as usize,EVENT_WORDS*4)? { return Err(ReplayError::Malformed); }
        if bridge.next_taken { return Err(ReplayError::Order); }
        let packet=bridge.next.ok_or(ReplayError::Order)?;
        let words=packet.words();
        // SAFETY: writable aligned caller allocation, nonaliasing checked for
        // exposed bridge buffers; stack words and runtime borrow never escape.
        unsafe { std::ptr::copy_nonoverlapping(words.as_ptr(),output,EVENT_WORDS); }
        bridge.next_taken=true;Ok(())
    }))
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_replay_validate_event(pointer:*const u32,len:u32) -> u32 {
    let result=(|| {
        if len!=EVENT_WORDS as u32 { return Err(ReplayError::InvalidInput); }
        // SAFETY: synchronous caller-readable16-word span, bounded and aligned.
        let words=unsafe { copy_words(pointer,len,EVENT_WORDS) }?;
        EventPacket::from_words(&words).ok_or(ReplayError::InvalidInput)?;Ok(())
    })();
    if let Err(error)=result { return poison(error); }0
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_replay_commit(pointer:*const u32,len:u32,native_result:i32) -> u32 {
    let result=(|| {
        if len!=EVENT_WORDS as u32 || !(-1..=1).contains(&native_result) { return Err(ReplayError::InvalidInput); }
        // SAFETY: copied caller-readable aligned event; no retained C pointer.
        let words=unsafe { copy_words(pointer,len,EVENT_WORDS) }?;
        let packet=EventPacket::from_words(&words).ok_or(ReplayError::InvalidInput)?;
        if matches!(packet.event,NativeEvent::None)&&native_result!=0 { return Err(ReplayError::InvalidInput); }
        mutate(|bridge| bridge.commit(packet,native_result))
    })();
    match result {Ok(())=>0,Err(error)=>poison(error)}
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_replay_pending_set(pointer:*const u32,count:u32,context:*const u8,context_len:u32) -> u32 {
    let result=(|| {
        if count as usize>replay::MAX_PENDING { return Err(ReplayError::Bounds); }
        let len=count.checked_mul(EVENT_WORDS as u32).ok_or(ReplayError::Bounds)?;
        // SAFETY: both spans copied before runtime mutation, bounded above.
        let words=unsafe { copy_words(pointer,len,replay::MAX_PENDING*EVENT_WORDS) }?;
        let packets=packets(&words)?;
        let context=unsafe { copy_bytes(context,context_len,replay::MAX_CONTEXT) }?;
        let next_group=validate_context(&context)?;
        mutate(|bridge| {
            let high_water=if bridge.is_replay() {0}else{bridge.largest_text_group};
            if next_group<=high_water.max(packet_text_group(&packets)) {return Err(ReplayError::Order);}
            bridge.pending=Some(HostPending {packets,context});Ok(())
        })
    })();
    match result {Ok(())=>0,Err(error)=>poison(error)}
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_flush() -> u32 {
    let was_replay=BRIDGE.with(|bridge| bridge.try_borrow().map(|b| b.is_replay()).unwrap_or(true));
    match mutate(Bridge::flush) {Ok(())=>0,Err(error)=>if was_replay {error as u32}else{0}}
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_save() -> *const u8 {
    let result=mutate(|bridge| bridge.save());
    let result=crate::ADAPTER.with(|state| {
        let mut state=state.try_borrow_mut().map_err(|_| ReplayError::CaptureFailed)?;
        match result {
            Ok(bytes)=>{state.save_output=bytes;state.save_status=0;Ok(state.save_output.as_ptr())},
            Err(error)=>{state.save_output.clear();state.save_status=error as u32;Err(error)},
        }
    });
    match result {Ok(pointer)=>pointer,Err(error)=>{poison(error);std::ptr::null()}}
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_target_pending_data() -> *const u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().map(|b| if b.target_ready {b.target_pending.as_ptr()}else{std::ptr::null()}).unwrap_or(std::ptr::null()))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_target_pending_count() -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().map(|b| if b.target_ready {(b.target_pending.len()/EVENT_WORDS)as u32}else{0}).unwrap_or(0))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_target_context_data() -> *const u8 {
    BRIDGE.with(|bridge| bridge.try_borrow().map(|b| if b.target_ready {b.target_context.as_ptr()}else{std::ptr::null()}).unwrap_or(std::ptr::null()))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_target_context_len() -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().map(|b| if b.target_ready {b.target_context.len()as u32}else{0}).unwrap_or(0))
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_replay_environment_begin(site:*const c_char,kind:u32) -> u32 {
    let result=(|| {
        // SAFETY: bounded source-site C string is copied before runtime borrow.
        let site=unsafe { copy_site(site) }?;
        if !(1..=6).contains(&kind) { return Err(ReplayError::Malformed); }
        mutate(|bridge| {
            if let Some(error)=bridge.replay_failure {return Err(error);}
            if bridge.environment_request.is_some() {return Err(ReplayError::Order);}
            bridge.environment_output.clear();
            let mode=match &bridge.session {
                Session::Disabled=>return Ok(0),Session::Live(_)=>0,
                Session::Replay(cursor)=>{bridge.environment_output=cursor.peek_environment(&site,kind)?;1},
            };
            bridge.environment_request=Some(EnvironmentRequest {site,kind});Ok(mode)
        })
    })();
    match result {Ok(mode)=>mode,Err(error)=>{
        poison(error);BRIDGE.with(|bridge| bridge.try_borrow().map(|b|if b.is_replay(){2}else{0}).unwrap_or(2))
    }}
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_environment_data() -> *const u8 {
    BRIDGE.with(|bridge| bridge.try_borrow().map(|b|b.environment_output.as_ptr()).unwrap_or(std::ptr::null()))
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_replay_environment_len() -> u32 {
    BRIDGE.with(|bridge| bridge.try_borrow().map(|b|b.environment_output.len()as u32).unwrap_or(0))
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_replay_environment_commit(site:*const c_char,kind:u32,facts:*const u8,len:u32) -> u32 {
    let result=(|| {
        // SAFETY: copy facts FIRST; facts may point at our exposed environment
        // output, which this operation invalidates only after the owned copy.
        let facts=unsafe { copy_bytes(facts,len,replay::MAX_ENVIRONMENT_FACT) }?;
        let site=unsafe { copy_site(site) }?;
        mutate(|bridge| {
            if let Some(error)=bridge.replay_failure {return Err(error);}
            if matches!(bridge.session,Session::Disabled) {return Ok(());}
            let request=bridge.environment_request.as_ref().ok_or(ReplayError::Order)?;
            if request.site!=site || request.kind!=kind {return Err(ReplayError::Mismatch);}
            let result=match &mut bridge.session {
                Session::Disabled=>Ok(()),Session::Live(recorder)=>recorder.environment(site,kind,facts),
                Session::Replay(cursor)=>cursor.commit_environment(&site,kind,&facts),
            };
            if result.is_ok() || !bridge.is_replay() {bridge.environment_request=None;bridge.environment_output.clear();}
            result
        })
    })();
    match result {Ok(())=>0,Err(error)=>poison(error)}
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::input::{Command,InputOrigin};
    fn context()->Vec<u8> { br#"{"schema_version":1,"next_group":[1,0],"draft":{"text":"","composing":false,"selectionStart":0,"selectionEnd":0,"selectionDirection":"none","focused":false}}"#.to_vec() }
    fn observation()->Observation { let mut v=[0;54];v[0]=1;v[1]=1;v[5]=100;v[6]=32;v }
    fn packet()->EventPacket {EventPacket {event:NativeEvent::Keyboard(Command::sanitize(0x65e5,0).unwrap()),origin:InputOrigin::default()} }
    fn bootstrap()->Bootstrap {Bootstrap {kind:BootstrapKind::NewGame,native_load_mode:NativeLoadMode::LegacyPlain,seed:17,
        post_init_rng:Some([0;38]),loaded_boundary_rng:None,native:Vec::new(),environment:br#"{"schema_version":1,"files":[]}"#.to_vec(),extensions:Vec::new()} }
    fn live()->Bridge {Bridge {session:Session::Live(Recorder::new(Identity([[1;32];4]),bootstrap())),..Bridge::default()} }
    #[test]
    fn digest_changes_for_rng_cells_semantic_and_framed_boundaries() {
        let words=observation();let original=evidence_digest(&words,b"cells",b"facts");
        let mut changed=words;changed[17]=1;
        assert_ne!(original,evidence_digest(&changed,b"cells",b"facts"));
        assert_ne!(original,evidence_digest(&words,b"cellS",b"facts"));
        assert_ne!(original,evidence_digest(&words,b"cells",b"factS"));
        assert_ne!(evidence_digest(&words,b"ab",b"c"),evidence_digest(&words,b"a",b"bc"));
        assert_eq!(original,evidence_digest(&words,b"cells",b"facts"));
    }
    #[test]
    fn identity_is_exact_four_contracts_and_wrong_length_fails() {
        let bytes=(0..128).map(|i|i as u8).collect::<Vec<_>>();let id=identity(&bytes).unwrap();
        assert_eq!(id.0[0][0],0);assert_eq!(id.0[3][31],127);
        assert_eq!(identity(&bytes[..127]),Err(ReplayError::Identity));
    }
    #[test]
    fn span_rejects_null_alignment_overflow_without_dereference() {
        assert!(span(0,1,1).is_err());assert!(span(3,64,4).is_err());
        assert!(span(usize::MAX-1,64,1).is_err());assert!(span(0,0,4).is_ok());
    }
    #[test]
    fn linear_memory_end_is_checked_before_any_read_or_write() {
        assert!(memory_extent(65_536,65_536).is_ok());
        assert_eq!(memory_extent(65_537,65_536),Err(ReplayError::Malformed));
        assert_eq!(memory_extent(1,0),Err(ReplayError::Malformed));
        assert!(memory_extent(0,0).is_ok());
    }
    #[test]
    fn context_preserves_unicode_and_validates_utf16_selection() {
        let text=String::from_utf8(context()).unwrap().replace("\"text\":\"\"","\"text\":\"日🐉\"")
            .replace("\"selectionEnd\":0","\"selectionEnd\":3");
        assert!(validate_context(text.as_bytes()).is_ok());
        assert!(validate_context(text.replace("\"selectionEnd\":3","\"selectionEnd\":4").as_bytes()).is_err());
        assert!(validate_context(br#"{"schema_version":1,"schema_version":1}"#).is_err());
    }
    #[test]
    fn context_unknown_fields_bad_direction_and_fraction_fail() {
        let text=String::from_utf8(context()).unwrap();
        assert!(validate_context(text.replace("\"focused\":false","\"focused\":false,\"extra\":1").as_bytes()).is_err());
        assert!(validate_context(text.replace("\"none\"","\"sideways\"").as_bytes()).is_err());
        assert!(validate_context(text.replace("\"selectionEnd\":0","\"selectionEnd\":0.5").as_bytes()).is_err());
    }
    #[test]
    fn context_group_zero_and_draft_nul_are_rejected() {
        let text=String::from_utf8(context()).unwrap();
        assert_eq!(validate_context(text.replace("[1,0]","[0,0]").as_bytes()),Err(ReplayError::Order));
        assert!(validate_context(text.replace("\"text\":\"\"","\"text\":\"\\u0000\"").as_bytes()).is_err());
    }
    #[test]
    fn text_group_high_water_includes_rejected_polls_flush_and_target_pending() {
        let mut event=packet();event.origin=InputOrigin {kind:3,group:7,scalar_index:0,scalar_count:1};
        let envelope=ReplayEnvelope {identity:Identity([[1;32];4]),bootstrap:bootstrap(),
            entries:vec![replay::Entry {sequence:0,outcome:replay::Outcome::Poll {
                wait:replay::WaitMarker {request:0,delivery:0,digest:[0;32]},event,native_result:1}}],
            target:Target {wait:replay::WaitMarker {request:1,delivery:0,digest:[1;32]},native_observation:observation(),
                pending:Vec::new(),browser_context:context(),extensions:Vec::new()} };
        assert_eq!(envelope_text_group(&envelope),7);
        assert!(validate_context(&envelope.target.browser_context).unwrap()<=envelope_text_group(&envelope));
    }
    #[test]
    fn pending_requires_nonempty_valid_typed_events_and_keeps_order() {
        assert_eq!(packets(&[0;16]),Err(ReplayError::InvalidInput));
        let words=packet().words();assert_eq!(packets(&words).unwrap(),vec![packet()]);
        let mut reserved=words;reserved[15]=1;assert_eq!(packets(&reserved),Err(ReplayError::InvalidInput));
        assert!(packets(&words[..15]).is_err());
    }
    #[test]
    fn target_only_transitions_after_digest_and_full_native_match() {
        crate::death_cause::reset();
        let mut recorder=live();let words=observation();recorder.wait(words,[3;32]).unwrap();
        recorder.pending=Some(HostPending {packets:vec![packet()],context:context()});
        let bytes=recorder.save().unwrap();let envelope=ReplayEnvelope::decode(&bytes,Identity([[1;32];4])).unwrap();
        let mut replay=Bridge {session:Session::Replay(ReplayCursor::new(envelope.clone()).unwrap()),..Bridge::default()};
        let mut wrong=words;wrong[13]=99;
        assert_eq!(replay.wait(wrong,[3;32]),Err(ReplayError::Mismatch));assert!(!replay.target_ready);
        assert_eq!(replay.wait(words,[4;32]),Err(ReplayError::Mismatch));assert!(!replay.target_ready);
        assert_eq!(replay.wait(words,[3;32]),Ok(2));assert!(replay.target_ready);
        assert_eq!(replay.target_pending,packet().words());assert_eq!(replay.target_context,context());
        assert!(matches!(replay.session,Session::Live(_)));
    }
    #[test]
    fn no_pending_snapshot_prevents_save_and_flush_capture() {
        crate::death_cause::reset();let mut bridge=live();bridge.wait(observation(),[1;32]).unwrap();
        assert_eq!(bridge.save(),Err(ReplayError::CaptureFailed));
        assert_eq!(bridge.flush(),Err(ReplayError::CaptureFailed));
    }
    #[test]
    fn poisoned_recording_continues_poll_delivery_but_cannot_save() {
        let mut bridge=live();bridge.fail(ReplayError::Bounds);
        assert_eq!(bridge.wait(observation(),[1;32]),Ok(0));
        assert_eq!(bridge.commit(packet(),0),Err(ReplayError::Bounds));
        assert_eq!(bridge.wait(observation(),[2;32]),Ok(0));
        bridge.pending=Some(HostPending {packets:Vec::new(),context:context()});
        assert_eq!(bridge.save(),Err(ReplayError::Bounds));
    }
    #[test]
    fn invalid_extensions_never_install_or_disappear() {
        let unknown=Extension {id:"unknown".into(),version:1,bytes:b"{}".to_vec()};
        assert_eq!(validate_extensions(&[unknown]),Err(ReplayError::Malformed));
        let malformed=Extension {id:crate::death_cause::CAUSE_EXTENSION_ID.into(),version:1,bytes:b"{}".to_vec()};
        assert_eq!(validate_extensions(&[malformed]),Err(ReplayError::Malformed));
    }
    #[test]
    fn native_load_mode_never_restores_rng_for_plain_payload() {
        let mut base=bootstrap();base.kind=BootstrapKind::LoadedGame;base.native=vec![9];base.loaded_boundary_rng=Some([0;38]);
        base.native_load_mode=NativeLoadMode::LegacyPlain;install_native_rng(&base).unwrap();
        crate::ADAPTER.with(|state|assert_eq!(state.borrow().restored_rng,None));
        base.native_load_mode=NativeLoadMode::CheckpointNative;install_native_rng(&base).unwrap();
        crate::ADAPTER.with(|state|assert_eq!(state.borrow().restored_rng,Some([0;38])));
        crate::ADAPTER.with(|state|state.borrow_mut().restored_rng=None);
    }
    #[test]
    fn getters_alias_detection_includes_environment_and_target_buffers() {
        let mut bridge=live();bridge.environment_output=b"facts".to_vec();bridge.target_pending=packet().words().to_vec();
        assert!(bridge.aliases_output(bridge.environment_output.as_ptr()as usize,1));
        assert!(bridge.aliases_output(bridge.target_pending.as_ptr()as usize,64));
        assert!(!bridge.aliases_output(1,1));
    }
}
