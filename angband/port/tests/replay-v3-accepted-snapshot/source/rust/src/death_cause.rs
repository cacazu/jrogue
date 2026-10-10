//! Owned death provenance from the original winning causal branch.
//! No completed English text, game query, clock, RNG or native pointer is saved.

use crate::localization::{ReviewCatalog, json::{self, JsonValue as J, Limits}};
use crate::text::Locale;
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::fmt;

pub const CAUSE_EXTENSION_ID: &str = "angband.death_cause";
pub const SCORES_EXTENSION_ID: &str = "angband.death_scores";
pub const EXTENSION_VERSION: u16 = 1;
pub const MAX_CAUSE_BYTES: usize = 16 * 1024;
pub const MAX_SCORE_BYTES: usize = 512 * 1024;
/// Exact pinned score.h high_score field sum; C also asserts its native sizeof.
pub const SCORE_RECORD_BYTES: usize = 126;
pub const MAX_SCORE_RECORDS: usize = 100;
pub const MISSING_CAUSE: &str = "interface.death.cause.legacy_unknown";
const CAUSE_LIMITS: Limits = Limits { max_bytes: MAX_CAUSE_BYTES, max_depth: 32, max_nodes: 4096, max_string_bytes: 4096 };
const SCORE_LIMITS: Limits = Limits { max_bytes: MAX_SCORE_BYTES, max_depth: 36, max_nodes: 100_000, max_string_bytes: 4096 };
const EFFECT_IDS: &[&str] = &[
    "domain.shape.bat.effect_message", "domain.shape.warg.effect_message", "domain.shape.vampire.effect_message",
    "angband.player_class.necromancer.book.dark_rituals.spell.shadow_shift.effect.self_damage.death_reason",
    "angband.player_class.necromancer.book.corruption_of_spirit.spell.power_sacrifice.effect.self_damage.death_reason",
    "angband.player_class.necromancer.book.corruption_of_spirit.spell.curse.effect.self_damage.death_reason",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum CauseError {
    InvalidBuffer = 301, InvalidUtf8 = 302, TooLarge = 303, InvalidJson = 304,
    InvalidCause = 305, InvalidCatalog = 306, InvalidScore = 307,
    DuplicateScore = 308, ScoreCapacity = 309,
}
impl fmt::Display for CauseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::InvalidBuffer => "invalid death provenance buffer", Self::InvalidUtf8 => "death provenance is not UTF-8",
            Self::TooLarge => "death provenance exceeds its storage limit", Self::InvalidJson => "invalid death provenance JSON",
            Self::InvalidCause => "invalid source death cause", Self::InvalidCatalog => "death catalog is unavailable",
            Self::InvalidScore => "invalid original score identity", Self::DuplicateScore => "duplicate original score identity",
            Self::ScoreCapacity => "death score provenance exceeds its storage limit",
        })
    }
}
impl std::error::Error for CauseError {}

/// A validated canonical reference; all nested descriptor facts are owned.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cause { bytes: Vec<u8> }
impl Cause { pub fn bytes(&self) -> &[u8] { &self.bytes } }
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ScoreCauses { records: BTreeMap<[u8; SCORE_RECORD_BYTES], Cause> }

thread_local! {
    static CATALOG: Result<ReviewCatalog, crate::localization::ReviewError> = ReviewCatalog::embedded();
    static STATE: RefCell<State> = RefCell::new(State::default());
}
#[derive(Default)]
struct State {
    cause: Option<Cause>, scores: ScoreCauses, output: Vec<u8>, status: u32,
    cause_error: Option<CauseError>,
    preview: Option<([u8; SCORE_RECORD_BYTES], Cause)>,
    /// A failed registration is never concealed by evicting another record.
    scores_overflowed: bool,
}

fn exact_fields(value: &J, expected: &[&str]) -> Result<(), CauseError> {
    let fields = value.as_object().ok_or(CauseError::InvalidCause)?;
    if fields.len() != expected.len() || fields.iter().any(|(name, _)| !expected.contains(&name.as_str())) {
        return Err(CauseError::InvalidCause);
    }
    Ok(())
}
fn cause_schema(id: &str) -> Option<&'static [(&'static str, &'static str)]> {
    match id {
        "interface.death.cause.monster" => Some(&[("monster", "MonsterDescription")]),
        "interface.death.cause.object" => Some(&[("object", "KnownObjectDescription")]),
        "interface.death.cause.trap" => Some(&[("trap", "TrapName")]),
        "interface.death.cause.source_effect" => Some(&[("effect", "localized_text")]),
        "interface.death.cause.poison" | "interface.death.cause.wound" | "interface.death.cause.starvation" |
        "interface.death.cause.earthquake" | "interface.death.cause.failed_uncursing" |
        "interface.death.cause.stat_drain" | "interface.death.cause.banishment" |
        "interface.death.cause.mass_banishment" | "interface.death.cause.over_exertion" |
        "interface.death.cause.lava" | "interface.death.cause.chest_needle" |
        "interface.death.cause.chest_explosion" | "interface.death.cause.yourself" |
        "interface.death.cause.bug" | "interface.death.cause.retired" | "interface.death.cause.winner" |
        "interface.death.cause.saved" | "interface.death.cause.alive" | "interface.death.cause.cheat_death" |
        "interface.death.cause.preview" | "interface.death.cause.legacy_unknown" |
        "interface.death.cause.capture_unavailable" => Some(&[]),
        _ => None,
    }
}
fn validate_value(value: &J) -> Result<Cause, CauseError> {
    exact_fields(value, &["id", "params"])?;
    let id = value.field("id").and_then(J::as_str).ok_or(CauseError::InvalidCause)?;
    let schema = cause_schema(id).ok_or(CauseError::InvalidCause)?;
    let params = value.field("params").ok_or(CauseError::InvalidCause)?;
    let names: Vec<_> = schema.iter().map(|(name, _)| *name).collect();
    exact_fields(params, &names)?;
    for (name, kind) in schema {
        let capture = params.field(name).ok_or(CauseError::InvalidCause)?;
        exact_fields(capture, &["type", "value"])?;
        if capture.field("type").and_then(J::as_str) != Some(*kind) { return Err(CauseError::InvalidCause); }
        if *kind == "localized_text" {
            let source = capture.field("value").and_then(J::as_str).ok_or(CauseError::InvalidCause)?;
            if !EFFECT_IDS.contains(&source) { return Err(CauseError::InvalidCause); }
        }
    }
    let reference = canonical(value);
    if reference.len() > MAX_CAUSE_BYTES { return Err(CauseError::TooLarge); }
    let event = format!("{{\"schema_version\":1,{}", &reference[1..]);
    CATALOG.with(|catalog| {
        let catalog = catalog.as_ref().map_err(|_| CauseError::InvalidCatalog)?;
        for locale in [Locale::English, Locale::Japanese] {
            catalog.event(locale, &event).map_err(|_| CauseError::InvalidCause)?;
        }
        Ok(())
    })?;
    Ok(Cause { bytes: reference.into_bytes() })
}
/// Validate source identity, exact typed grammar and both locale renderers.
pub fn validate_cause(bytes: &[u8]) -> Result<Cause, CauseError> {
    if bytes.len() > MAX_CAUSE_BYTES { return Err(CauseError::TooLarge); }
    let input = std::str::from_utf8(bytes).map_err(|_| CauseError::InvalidUtf8)?;
    let value = json::parse(input, CAUSE_LIMITS).map_err(|_| CauseError::InvalidJson)?;
    validate_value(&value)
}
pub fn snapshot_cause() -> Result<Option<Vec<u8>>, CauseError> {
    STATE.with(|state| { let state=state.borrow(); if let Some(error)=state.cause_error { return Err(error); }
        Ok(state.cause.as_ref().map(|cause| cause.bytes.clone())) })
}
/// Install a proved BASE extension before native load; never install TARGET
/// evidence before replay. Absence clears stale provenance without guessing.
pub fn restore_cause(bytes: Option<&[u8]>) -> Result<(), CauseError> {
    let cause = bytes.map(validate_cause).transpose()?;
    STATE.with(|state| { let mut state=state.borrow_mut(); state.cause = cause; state.cause_error=None; });
    Ok(())
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes { out.push(DIGITS[(byte >> 4) as usize] as char); out.push(DIGITS[(byte & 15) as usize] as char); }
    out
}
fn score_identity(text: &str) -> Result<[u8; SCORE_RECORD_BYTES], CauseError> {
    if text.len() != SCORE_RECORD_BYTES * 2 { return Err(CauseError::InvalidScore); }
    fn digit(byte: u8) -> Result<u8, CauseError> {
        match byte { b'0'..=b'9' => Ok(byte - b'0'), b'a'..=b'f' => Ok(byte - b'a' + 10), _ => Err(CauseError::InvalidScore) }
    }
    let mut record = [0; SCORE_RECORD_BYTES];
    for (out, pair) in record.iter_mut().zip(text.as_bytes().chunks_exact(2)) { *out = digit(pair[0])? * 16 + digit(pair[1])?; }
    Ok(record)
}
fn encode_scores(scores: &ScoreCauses) -> Result<Vec<u8>, CauseError> {
    if scores.records.len() > MAX_SCORE_RECORDS { return Err(CauseError::ScoreCapacity); }
    let mut out = String::from("{\"schema_version\":1,\"records\":[");
    for (index, (record, cause)) in scores.records.iter().enumerate() {
        if index != 0 { out.push(','); }
        out.push_str("{\"record\":\""); out.push_str(&hex(record)); out.push_str("\",\"cause\":");
        let reference = std::str::from_utf8(cause.bytes()).map_err(|_| CauseError::InvalidUtf8)?;
        out.push_str(reference); out.push('}');
        if out.len() > MAX_SCORE_BYTES { return Err(CauseError::ScoreCapacity); }
    }
    out.push_str("]}");
    if out.len() > MAX_SCORE_BYTES { return Err(CauseError::ScoreCapacity); }
    Ok(out.into_bytes())
}
pub fn validate_scores(bytes: &[u8]) -> Result<ScoreCauses, CauseError> {
    if bytes.len() > MAX_SCORE_BYTES { return Err(CauseError::TooLarge); }
    let input = std::str::from_utf8(bytes).map_err(|_| CauseError::InvalidUtf8)?;
    let value = json::parse(input, SCORE_LIMITS).map_err(|_| CauseError::InvalidJson)?;
    exact_fields(&value, &["schema_version", "records"])?;
    if value.field("schema_version").and_then(J::as_integer) != Some(1) { return Err(CauseError::InvalidScore); }
    let records = value.field("records").and_then(J::as_array).ok_or(CauseError::InvalidScore)?;
    if records.len() > MAX_SCORE_RECORDS { return Err(CauseError::ScoreCapacity); }
    let mut scores = ScoreCauses::default();
    for record in records {
        exact_fields(record, &["record", "cause"])?;
        let key = score_identity(record.field("record").and_then(J::as_str).ok_or(CauseError::InvalidScore)?)?;
        let cause = validate_value(record.field("cause").ok_or(CauseError::InvalidCause)?)?;
        if scores.records.insert(key, cause).is_some() { return Err(CauseError::DuplicateScore); }
    }
    encode_scores(&scores)?;
    Ok(scores)
}
pub fn snapshot_scores() -> Result<Option<Vec<u8>>, CauseError> {
    STATE.with(|state| {
        let state = state.borrow();
        if state.scores_overflowed { return Err(CauseError::ScoreCapacity); }
        if state.scores.records.is_empty() { return Ok(None); }
        encode_scores(&state.scores).map(Some)
    })
}
pub fn restore_scores(bytes: Option<&[u8]>) -> Result<(), CauseError> {
    let scores = bytes.map(validate_scores).transpose()?.unwrap_or_default();
    STATE.with(|state| { let mut state = state.borrow_mut(); state.scores = scores; state.scores_overflowed = false; state.preview=None; });
    Ok(())
}
pub fn reset() { STATE.with(|state| { *state.borrow_mut() = State::default(); }); }

fn canonical(value: &J) -> String {
    fn string(value: &str, out: &mut String) {
        out.push('"');
        for c in value.chars() { match c {
            '"' => out.push_str("\\\""), '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"), '\r' => out.push_str("\\r"), '\t' => out.push_str("\\t"),
            c if c < ' ' => { use std::fmt::Write; let _ = write!(out, "\\u{:04x}", c as u32); }
            c => out.push(c),
        } }
        out.push('"');
    }
    fn append(value: &J, out: &mut String) { match value {
        J::Null => out.push_str("null"), J::Bool(value) => out.push_str(if *value { "true" } else { "false" }),
        J::Integer(value) => out.push_str(&value.to_string()), J::String(value) => string(value, out),
        J::Array(values) => { out.push('['); for (i, value) in values.iter().enumerate() { if i != 0 { out.push(','); } append(value, out); } out.push(']'); }
        J::Object(fields) => { let mut fields: Vec<_> = fields.iter().collect(); fields.sort_by(|a,b| a.0.cmp(&b.0)); out.push('{'); for (i, (name, value)) in fields.into_iter().enumerate() { if i != 0 { out.push(','); } string(name, out); out.push(':'); append(value, out); } out.push('}'); }
    } }
    let mut out = String::new(); append(value, &mut out); out
}
unsafe fn owned_input(ptr: *const u8, len: u32, max: usize) -> Result<Vec<u8>, CauseError> {
    if len as usize > max { return Err(CauseError::TooLarge); }
    if len == 0 { return Ok(Vec::new()); }
    if ptr.is_null() { return Err(CauseError::InvalidBuffer); }
    // SAFETY: FFI callers supply readable initialized len bytes. The length
    // cap and null guard precede access; the owned copy precedes state borrows.
    Ok(unsafe { std::slice::from_raw_parts(ptr, len as usize) }.to_vec())
}

/// # Safety
/// For nonzero len, ptr supplies that many initialized readable bytes until
/// this call returns. No pointer or slice escapes; bytes are copied first.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_death_commit(ptr: *const u8, len: u32) -> u32 {
    let result = unsafe { owned_input(ptr, len, MAX_CAUSE_BYTES) }.and_then(|bytes| validate_cause(&bytes));
    STATE.with(|state| { let mut state = state.borrow_mut(); match result {
        Ok(cause) => { state.cause = Some(cause); state.cause_error=None; state.status = 0; 0 }
        Err(error) => { state.cause = None; state.cause_error=Some(error); state.status = error as u32; error as u32 }
    } })
}
/// Drop current provenance when native recovery cancels lethal damage. Score
/// records and their original identity remain independent.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_death_clear() { STATE.with(|state| { let mut state = state.borrow_mut(); state.cause = None; state.cause_error=None; state.status = 0; }); }
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_death_status() -> u32 { STATE.with(|state| state.borrow().status) }
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_death_len() -> u32 { STATE.with(|state| state.borrow().output.len().saturating_sub(1) as u32) }
/// Returned reference is NUL-terminated and valid until the next cause/score
/// getter on this thread. Consumers must copy it before any callback.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_death_current() -> *const u8 {
    STATE.with(|state| { let mut state = state.borrow_mut(); let cause = state.cause.as_ref().map(|cause| cause.bytes.clone());
        let missing=if state.cause_error.is_some() { "interface.death.cause.capture_unavailable" } else { MISSING_CAUSE };
        state.output = cause.unwrap_or_else(|| format!("{{\"id\":\"{missing}\",\"params\":{{}}}}").into_bytes());
        state.output.push(0); state.output.as_ptr()
    })
}
/// # Safety
/// record supplies exactly 126 readable initialized bytes for this call.
/// flag0 selects the source preview cause; flag1 selects current provenance.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_death_score_bind(record: *const u8, len: u32, current: u32) -> u32 {
    if len as usize != SCORE_RECORD_BYTES || current > 1 { return CauseError::InvalidScore as u32; }
    let bytes = match unsafe { owned_input(record, len, SCORE_RECORD_BYTES) } { Ok(bytes) => bytes, Err(error) => return error as u32 };
    let mut key = [0; SCORE_RECORD_BYTES]; key.copy_from_slice(&bytes);
    let preview = if current == 0 { match validate_cause(br#"{"id":"interface.death.cause.preview","params":{}}"#) { Ok(cause) => Some(cause), Err(error) => return error as u32 } } else { None };
    STATE.with(|state| { let mut state = state.borrow_mut(); let cause = if current == 0 { preview } else { state.cause.clone() };
        let Some(cause) = cause else { return 0; };
        if current==0 { state.preview=Some((key,cause)); state.status=0; return 0; }
        if state.scores.records.len() >= MAX_SCORE_RECORDS && !state.scores.records.contains_key(&key) {
            state.scores_overflowed = true; state.status = CauseError::ScoreCapacity as u32; return state.status;
        }
        // A candidate is checked before publishing it; never evict old scores.
        let mut candidate = state.scores.clone(); candidate.records.insert(key, cause);
        if let Err(error) = encode_scores(&candidate) { state.scores_overflowed = true; state.status = error as u32; return state.status; }
        state.scores = candidate; state.status = 0; 0
    })
}
/// Retain only records present in the array produced by the original native
/// highscore_add. This follows native ranking/retention without recomputing it.
/// It is explicit provenance synchronization, never capacity-driven eviction.
/// # Safety
/// records supplies count*126 initialized readable bytes during this call;
/// count<=100. The bounded owned copy precedes any state mutation.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_death_scores_retain(records:*const u8,count:u32)->u32 {
    if count as usize>MAX_SCORE_RECORDS { return CauseError::ScoreCapacity as u32; }
    let bytes=match unsafe { owned_input(records,count*SCORE_RECORD_BYTES as u32,MAX_SCORE_RECORDS*SCORE_RECORD_BYTES) } { Ok(bytes)=>bytes,Err(error)=>return error as u32 };
    let keys:Vec<[u8;SCORE_RECORD_BYTES]>=bytes.chunks_exact(SCORE_RECORD_BYTES).map(|row|{let mut key=[0;SCORE_RECORD_BYTES];key.copy_from_slice(row);key}).collect();
    STATE.with(|state| { let mut state=state.borrow_mut();state.scores.records.retain(|key,_|keys.contains(key)); });
    0
}
/// # Safety
/// record supplies exactly126 readable initialized bytes; output follows the
/// same lifetime as ab_rs_death_current. Identity is full record bytes only.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_death_score(record: *const u8, len: u32) -> *const u8 {
    if len as usize != SCORE_RECORD_BYTES { return std::ptr::null(); }
    let bytes = match unsafe { owned_input(record, len, SCORE_RECORD_BYTES) } { Ok(bytes) => bytes, Err(_) => return std::ptr::null() };
    let mut key = [0; SCORE_RECORD_BYTES]; key.copy_from_slice(&bytes);
    STATE.with(|state| { let mut state = state.borrow_mut();
        state.output = state.scores.records.get(&key).or_else(||state.preview.as_ref().filter(|(record,_)|record==&key).map(|(_,cause)|cause)).map(|cause| cause.bytes.clone()).unwrap_or_else(|| format!("{{\"id\":\"{MISSING_CAUSE}\",\"params\":{{}}}}").into_bytes());
        state.output.push(0); state.output.as_ptr()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    const POISON: &[u8] = br#"{"id":"interface.death.cause.poison","params":{}}"#;
    #[test]
    fn canonical_cause_roundtrip_owns_bytes_and_normalizes_json_field_order() {
        let cause = validate_cause(br#"{ "params": {}, "id": "interface.death.cause.poison" }"#).unwrap();
        assert_eq!(cause.bytes(), POISON);
        let mut source = POISON.to_vec(); restore_cause(Some(&source)).unwrap(); source.fill(b'!');
        assert_eq!(snapshot_cause(), Ok(Some(POISON.to_vec()))); restore_cause(None).unwrap(); assert_eq!(snapshot_cause(), Ok(None));
    }
    #[test]
    fn strict_cause_rejects_foreign_ids_unknown_fields_parameters_and_english_fallback() {
        for bytes in [br#"{"id":"interface.death.cause.no_such_cause","params":{}}"#.as_slice(),
            br#"{"id":"interface.death.cause.poison","params":{},"english":"poison"}"#,
            br#"{"id":"interface.death.cause.poison","params":{"damage":{"type":"integer","value":1}}}"#,
            br#"{"id":"interface.death.cause.monster","params":{"monster":{"type":"opaque_text","value":"a dragon"}}}"#,
            br#"{"id":"interface.death.cause.source_effect","params":{"effect":{"type":"localized_text","value":"base.player.race.human"}}}"#] {
            assert!(validate_cause(bytes).is_err());
        }
    }
    #[test]
    fn failed_restore_is_atomic_and_legacy_absence_clears_stale_cause() {
        restore_cause(Some(POISON)).unwrap(); assert!(restore_cause(Some(b"wrong")).is_err());
        assert_eq!(snapshot_cause(), Ok(Some(POISON.to_vec()))); restore_cause(None).unwrap(); assert_eq!(snapshot_cause(), Ok(None));
    }
    #[test]
    fn scores_use_all_original_record_bytes_and_roundtrip_without_text_lookup() {
        let cause = validate_cause(POISON).unwrap(); let mut scores = ScoreCauses::default();
        let first = [0;SCORE_RECORD_BYTES]; let mut second = first; second[SCORE_RECORD_BYTES-1] = 1;
        scores.records.insert(first, cause.clone()); scores.records.insert(second, cause);
        assert_eq!(validate_scores(&encode_scores(&scores).unwrap()).unwrap(), scores);
        assert_ne!(hex(&first), hex(&second));
    }
    #[test]
    fn scores_reject_duplicates_version_changes_and_bad_record_bytes() {
        let row = format!("{{\"record\":\"{}\",\"cause\":{}}}", hex(&[0;SCORE_RECORD_BYTES]), std::str::from_utf8(POISON).unwrap());
        assert_eq!(validate_scores(format!("{{\"schema_version\":1,\"records\":[{row},{row}]}}").as_bytes()), Err(CauseError::DuplicateScore));
        assert!(validate_scores(b"{\"schema_version\":2,\"records\":[]}").is_err());
        assert!(score_identity(&"x".repeat(SCORE_RECORD_BYTES*2)).is_err());
        assert!(score_identity(&"0".repeat(SCORE_RECORD_BYTES*2-1)).is_err());
        assert!(score_identity(&"0".repeat(128*2)).is_err());
    }
    #[test]
    fn ffi_commits_copy_before_borrow_and_invalid_input_clears_previous_cause() {
        // SAFETY: POISON is a live initialized static byte span for this call.
        assert_eq!(unsafe { ab_rs_death_commit(POISON.as_ptr(),POISON.len() as u32) }, 0);
        // SAFETY: null nonempty input is rejected before dereferencing it.
        assert_eq!(unsafe { ab_rs_death_commit(std::ptr::null(),4) }, CauseError::InvalidBuffer as u32);
        assert_eq!(snapshot_cause(),Err(CauseError::InvalidBuffer));
    }
    #[test]
    fn no_eviction_hides_score_capacity_failure_from_snapshot() {
        reset(); restore_cause(Some(POISON)).unwrap();
        for i in 0..=MAX_SCORE_RECORDS { let mut record = [0;SCORE_RECORD_BYTES]; record[0] = i as u8;
            // SAFETY: record supplies an initialized126-byte array during call.
            let status = unsafe { ab_rs_death_score_bind(record.as_ptr(),SCORE_RECORD_BYTES as u32,1) };
            assert_eq!(status, if i == MAX_SCORE_RECORDS { CauseError::ScoreCapacity as u32 } else { 0 });
        }
        assert_eq!(STATE.with(|state|state.borrow().scores.records.len()),MAX_SCORE_RECORDS);
        assert_eq!(snapshot_scores(),Err(CauseError::ScoreCapacity)); reset();
    }
    #[test]
    fn preview_records_remain_ephemeral_and_native_retention_is_explicit() {
        reset();restore_cause(Some(POISON)).unwrap();
        for i in 0..150_u8 {let mut record=[0;SCORE_RECORD_BYTES];record[0]=i;
            // SAFETY: record supplies126 initialized bytes throughout the call.
            assert_eq!(unsafe {ab_rs_death_score_bind(record.as_ptr(),SCORE_RECORD_BYTES as u32,0)},0);
        }
        assert_eq!(snapshot_scores(),Ok(None));
        let first=[1;SCORE_RECORD_BYTES];let second=[2;SCORE_RECORD_BYTES];
        // SAFETY: both arrays supply126 initialized readable bytes.
        assert_eq!(unsafe {ab_rs_death_score_bind(first.as_ptr(),SCORE_RECORD_BYTES as u32,1)},0);
        assert_eq!(unsafe {ab_rs_death_score_bind(second.as_ptr(),SCORE_RECORD_BYTES as u32,1)},0);
        assert_eq!(unsafe {ab_rs_death_scores_retain(second.as_ptr(),1)},0);
        let snapshot=snapshot_scores().unwrap().unwrap();let restored=validate_scores(&snapshot).unwrap();
        assert_eq!(restored.records.len(),1);assert!(restored.records.contains_key(&second));reset();
    }
}
