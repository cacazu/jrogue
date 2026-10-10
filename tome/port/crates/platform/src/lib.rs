// Copyright (C) 2026 jrogue contributors. GPL-3.0-or-later.
use serde::{Deserialize, Serialize};
use tome_input::{Command, KeyInput};
use tome_logic::{RULESET, SOURCE_COMMIT, State};
use tome_presentation::{Locale, render};

const FORMAT: &str = "jrogue.tome.rules";
const SCHEMA: u32 = 1;
pub const MAX_BYTES: usize = 1_048_576;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SaveError {
    Format,
    Version,
    Source,
    Checksum,
    Invalid,
    Limit,
}
impl SaveError {
    pub const fn text_id(self) -> &'static str {
        match self {
            Self::Format => "error.save.format",
            Self::Version => "error.save.version",
            Self::Source => "error.save.source",
            Self::Checksum => "error.save.checksum",
            Self::Invalid | Self::Limit => "error.save.invalid",
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    format: String,
    schema: u32,
    source_commit: String,
    ruleset: String,
    checksum: String,
    payload: State,
}
// Accidental-corruption check, not authentication or protection against editing.
fn checksum(bytes: &[u8]) -> String {
    let hash = bytes.iter().fold(0xcbf2_9ce4_8422_2325u64, |h, b| {
        (h ^ u64::from(*b)).wrapping_mul(0x100_0000_01b3)
    });
    format!("fnv1a64:{hash:016x}")
}
pub fn save(state: &State) -> Result<String, SaveError> {
    state.validate().map_err(|_| SaveError::Invalid)?;
    let payload = serde_json::to_vec(state).map_err(|_| SaveError::Invalid)?;
    let e = Envelope {
        format: FORMAT.into(),
        schema: SCHEMA,
        source_commit: SOURCE_COMMIT.into(),
        ruleset: RULESET.into(),
        checksum: checksum(&payload),
        payload: state.clone(),
    };
    let text = serde_json::to_string(&e).map_err(|_| SaveError::Invalid)?;
    if text.len() > MAX_BYTES {
        return Err(SaveError::Limit);
    }
    Ok(text)
}
pub fn load(text: &str) -> Result<State, SaveError> {
    if text.len() > MAX_BYTES {
        return Err(SaveError::Limit);
    }
    let e: Envelope = serde_json::from_str(text).map_err(|_| SaveError::Invalid)?;
    if e.format != FORMAT {
        return Err(SaveError::Format);
    }
    if e.schema != SCHEMA {
        return Err(SaveError::Version);
    }
    if e.source_commit != SOURCE_COMMIT || e.ruleset != RULESET {
        return Err(SaveError::Source);
    }
    let bytes = serde_json::to_vec(&e.payload).map_err(|_| SaveError::Invalid)?;
    if e.checksum != checksum(&bytes) {
        return Err(SaveError::Checksum);
    }
    e.payload.validate().map_err(|_| SaveError::Invalid)?;
    Ok(e.payload)
}

pub struct Runtime {
    pub state: State,
    pub locale: Locale,
}
impl Default for Runtime {
    fn default() -> Self {
        Self {
            state: State::new(42, "探索者".into()).expect("constant valid initial state"),
            locale: Locale::Ja,
        }
    }
}
#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
enum Request {
    View {},
    Command { command: Command },
    Key { input: KeyInput },
    Touch { action: String },
    Locale { locale: Locale },
    Save {},
    Load { save: String },
}
impl Runtime {
    pub fn request(&mut self, text: &str) -> String {
        let mut error = None;
        let mut exported_save = None;
        let mut handled = false;
        let request = if text.len() > MAX_BYTES {
            None
        } else {
            serde_json::from_str::<Request>(text).ok()
        };
        match request {
            None => error = Some("error.request"),
            Some(Request::View {}) => {}
            Some(Request::Command { command }) => {
                if let Err(e) = tome_input::apply(&mut self.state, command) {
                    error = Some(e.text_id());
                }
            }
            Some(Request::Key { input }) => {
                if let Some(command) = tome_input::key_command(&input) {
                    handled = true;
                    if let Err(e) = tome_input::apply(&mut self.state, command) {
                        error = Some(e.text_id());
                    }
                }
            }
            Some(Request::Touch { action }) => {
                if let Some(command) = tome_input::touch_command(&action) {
                    handled = true;
                    if let Err(e) = tome_input::apply(&mut self.state, command) {
                        error = Some(e.text_id());
                    }
                }
            }
            Some(Request::Locale { locale }) => self.locale = locale,
            Some(Request::Save {}) => match save(&self.state) {
                Ok(s) => exported_save = Some(s),
                Err(e) => error = Some(e.text_id()),
            },
            Some(Request::Load { save }) => match load(&save) {
                Ok(s) => self.state = s,
                Err(e) => error = Some(e.text_id()),
            },
        }
        let view = render(&self.state, self.locale);
        match view {
            Ok(view)=>serde_json::to_string(&serde_json::json!({"ok":error.is_none(),"handled":handled,"error_id":error,"view":view,"save":exported_save}))
                .expect("finite validated response"),
            Err(_)=>"{\"ok\":false,\"error_id\":\"error.request\"}".into(),
        }
    }
}

// No raw pointers cross this first ABI. Export names are reserved for this module.
// The unsafe attributes control linkage only; all memory accesses remain checked.
#[cfg(target_arch = "wasm32")]
#[allow(unsafe_code)]
mod wasm {
    use super::*;
    use std::cell::RefCell;
    thread_local! {
        static HOST:RefCell<Runtime>=RefCell::new(Runtime::default());
        static INPUT:RefCell<Vec<u8>>=const {RefCell::new(Vec::new())};
        static OUTPUT:RefCell<Vec<u8>>=const {RefCell::new(Vec::new())};
        static OVERFLOW:RefCell<bool>=const {RefCell::new(false)};
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_input_reset() {
        INPUT.with(|v| v.borrow_mut().clear());
        OVERFLOW.with(|v| *v.borrow_mut() = false);
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_input_byte(byte: u32) {
        INPUT.with(|v| {
            let mut v = v.borrow_mut();
            if v.len() < MAX_BYTES && byte <= 255 {
                v.push(byte as u8);
            } else {
                OVERFLOW.with(|o| *o.borrow_mut() = true);
            }
        });
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_request() {
        let input = INPUT.with(|v| v.borrow().clone());
        let overflow = OVERFLOW.with(|v| *v.borrow());
        let response = match std::str::from_utf8(&input) {
            Ok(text) if !overflow => HOST.with(|h| h.borrow_mut().request(text)),
            _ => HOST.with(|h| h.borrow_mut().request("")),
        };
        OUTPUT.with(|v| *v.borrow_mut() = response.into_bytes());
        tome_input_reset();
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_output_len() -> u32 {
        OUTPUT.with(|v| v.borrow().len() as u32)
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_output_byte(index: u32) -> u32 {
        OUTPUT.with(|v| v.borrow().get(index as usize).map_or(0, |b| u32::from(*b)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn save_resume_is_deterministic_at_refill_boundaries() {
        let mut original = State::new(624, "日本語 % {name} <script>".into()).expect("fixture");
        for _ in 0..70 {
            original.strike().expect("ready");
            for _ in 0..10 {
                original.advance_tick().expect("tick");
            }
        }
        let text = save(&original).expect("save");
        let mut restored = load(&text).expect("load");
        assert_eq!(original, restored);
        for _ in 0..300 {
            for s in [&mut original, &mut restored] {
                s.strike().expect("ready");
                for _ in 0..10 {
                    s.advance_tick().expect("tick");
                }
            }
        }
        assert_eq!(original, restored);
    }
    #[test]
    fn reject_version_source_checksum_and_bad_json() {
        let original = State::new(42, "x".into()).expect("fixture");
        let text = save(&original).expect("save");
        let mut v: serde_json::Value = serde_json::from_str(&text).expect("json");
        for (field, value, expected) in [
            ("schema", serde_json::json!(2), SaveError::Version),
            (
                "source_commit",
                serde_json::json!("unknown"),
                SaveError::Source,
            ),
            ("checksum", serde_json::json!("bad"), SaveError::Checksum),
        ] {
            let mut changed = v.clone();
            changed[field] = value;
            assert_eq!(load(&changed.to_string()), Err(expected));
        }
        v["payload"]["player_name"] = serde_json::json!("other");
        assert_eq!(load(&v.to_string()), Err(SaveError::Checksum));
        assert_eq!(load("{"), Err(SaveError::Invalid));
        assert_eq!(load(&"x".repeat(MAX_BYTES + 1)), Err(SaveError::Limit));
    }
    #[test]
    fn malformed_rng_rejected_even_when_checksum_recomputed() {
        let text = save(&State::new(1, "x".into()).expect("fixture")).expect("save");
        let mut v: serde_json::Value = serde_json::from_str(&text).expect("json");
        v["payload"]["rng"] = serde_json::json!({});
        assert_eq!(load(&v.to_string()), Err(SaveError::Invalid));
    }
    #[test]
    fn view_locale_and_invalid_request_preserve_domain() {
        let mut runtime = Runtime::default();
        let before = runtime.state.clone();
        for request in [
            "{\"op\":\"view\"}",
            "{\"op\":\"locale\",\"locale\":\"en\"}",
            "{\"op\":\"locale\",\"locale\":\"ja\"}",
            "{\"op\":\"save\"}",
            "invalid",
        ] {
            runtime.request(request);
            assert_eq!(runtime.state, before);
        }
    }

    #[test]
    fn strict_unit_requests_and_input_context_do_not_advance() {
        let mut runtime = Runtime::default();
        let before = runtime.state.clone();
        for request in [
            r#"{"op":"view","extra":true}"#,
            r#"{"op":"save","extra":true}"#,
            r#"{"op":"key","input":{"key":"Enter","composing":true}}"#,
        ] {
            runtime.request(request);
            assert_eq!(runtime.state, before);
        }
    }
}
