//! Byte transport and observation cache for an original C/Lua core owned by the browser host.
//! Rust emits original key identifiers and receives immutable native projections.
//! It never advances turns, executes Lua, computes rules/RNG, or serializes native userdata.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tome_core_contracts::ui::{UiCommand, UiError, UiSnapshot, UiTrace};
use tome_core_contracts::{CommandTrace, ContractError, Locale, Snapshot, VirtualKey};
use tome_core_display::ui::{UiFrame, render_ui};
use tome_core_display::ui_catalog::{UiContentCatalog, UiContentEntries};
use tome_core_display::{Frame, labels, render};
use tome_core_input::{KeyInput, dialog_command, key_command, touch_command};

pub const MAX_INPUT_BYTES: usize = 16 * 1024;

/// The browser host must fulfill this call using the original live C/Lua instance.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CoreCall {
    Snapshot,
    Command(VirtualKey),
    UiSnapshot,
    UiCommand,
}

impl CoreCall {
    /// Host ABI discriminator: 1 = snapshot_json(), 2 = command_json(original key).
    #[must_use]
    pub const fn kind(self) -> u32 {
        match self {
            Self::Snapshot => 1,
            Self::Command(_) => 2,
            Self::UiSnapshot => 3,
            Self::UiCommand => 4,
        }
    }

    /// UTF-8 command identifier; snapshot requests have an empty payload.
    #[must_use]
    pub const fn bytes(self) -> &'static [u8] {
        match self {
            Self::Snapshot => b"",
            Self::Command(key) => key.as_str().as_bytes(),
            Self::UiSnapshot | Self::UiCommand => b"",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
enum InputRequest {
    Key {
        input: KeyInput,
    },
    Touch {
        key: VirtualKey,
    },
    Snapshot {},
    Locale {
        locale: Locale,
    },
    View {},
    UiSnapshot {},
    Ui {
        command: UiCommand,
    },
    UiKey {
        input: KeyInput,
    },
    UiCatalog {
        locale: Locale,
        entries: UiContentEntries,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AdapterError {
    Request,
    Busy,
    NotReady,
    NoSnapshot,
    Response,
    CoreFailed,
    Contract(ContractError),
    Display(tome_core_display::DisplayError),
    Ui(UiError),
}

impl AdapterError {
    #[must_use]
    pub const fn text_id(self) -> &'static str {
        match self {
            Self::Request => "error.core.request",
            Self::Busy => "error.core.busy",
            Self::NotReady => "error.core.not_ready",
            Self::NoSnapshot => "error.core.no_snapshot",
            Self::Response => "error.core.response",
            Self::CoreFailed => "error.core.failed",
            Self::Contract(error) => error.text_id(),
            Self::Display(error) => error.text_id(),
            Self::Ui(error) => error.text_id(),
        }
    }
}

/// UI response. A pending call is a transport request, not evidence the game advanced.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Response {
    pub handled: bool,
    pub locale: Locale,
    pub labels: BTreeMap<String, String>,
    pub pending_kind: u32,
    pub error_id: Option<&'static str>,
    pub view: Option<Frame>,
    pub ui: Option<UiFrame>,
}

/// Only transport/UI state and copies of observations; no original gameplay state lives here.
#[derive(Debug, Default)]
pub struct Adapter {
    locale: Locale,
    snapshot: Option<Snapshot>,
    pending: Option<CoreCall>,
    trace: Option<CommandTrace>,
    ui_snapshot: Option<UiSnapshot>,
    ui_command: Option<UiCommand>,
    ui_catalog_ja: BTreeMap<String, String>,
    ui_catalog_en: BTreeMap<String, String>,
}

impl Adapter {
    #[must_use]
    pub const fn pending(&self) -> Option<CoreCall> {
        self.pending
    }

    #[must_use]
    pub const fn snapshot(&self) -> Option<&Snapshot> {
        self.snapshot.as_ref()
    }

    #[must_use]
    pub const fn trace(&self) -> Option<&CommandTrace> {
        self.trace.as_ref()
    }

    #[must_use]
    pub fn pending_bytes(&self) -> Vec<u8> {
        if self.pending == Some(CoreCall::UiCommand) {
            self.ui_command
                .as_ref()
                .and_then(|command| serde_json::to_vec(command).ok())
                .unwrap_or_default()
        } else {
            self.pending
                .map_or_else(Vec::new, |call| call.bytes().to_vec())
        }
    }

    fn ui_catalog(&self) -> Result<BTreeMap<String, String>, AdapterError> {
        let mut catalog = labels(self.locale).map_err(AdapterError::Display)?;
        let declared = UiContentCatalog::embedded().map_err(AdapterError::Ui)?;
        let templates = declared.templates(self.locale);
        if templates.keys().any(|id| catalog.contains_key(id)) {
            return Err(AdapterError::Ui(UiError::Text));
        }
        catalog.extend(
            templates
                .iter()
                .map(|(id, value)| (id.clone(), value.clone())),
        );
        let content = match self.locale {
            Locale::Ja => &self.ui_catalog_ja,
            Locale::En => &self.ui_catalog_en,
        };
        catalog.extend(
            content
                .iter()
                .map(|(id, value)| (id.clone(), value.clone())),
        );
        Ok(catalog)
    }

    /// Decode UI input into one pending original-core call or a pure view/language change.
    /// Unknown keys remain unhandled so the browser does not hijack ordinary input.
    pub fn request(&mut self, bytes: &[u8]) -> Response {
        if bytes.len() > MAX_INPUT_BYTES {
            return self.response(false, Some(AdapterError::Request));
        }
        let request = match serde_json::from_slice::<InputRequest>(bytes) {
            Ok(request) => request,
            Err(_) => return self.response(false, Some(AdapterError::Request)),
        };
        let result = match request {
            InputRequest::View {} => {
                if self.snapshot.is_some() {
                    Ok(false)
                } else {
                    Err(AdapterError::NoSnapshot)
                }
            }
            InputRequest::Locale { locale } => {
                self.locale = locale;
                Ok(false)
            }
            InputRequest::Snapshot {} => self.queue(CoreCall::Snapshot).map(|()| false),
            InputRequest::Key { input } => {
                if self
                    .ui_snapshot
                    .as_ref()
                    .is_some_and(|ui| ui.top().is_some())
                {
                    self.queue_dialog_key(&input)
                } else {
                    match key_command(&input) {
                        Some(key) => self.queue_command(key),
                        None => Ok(false),
                    }
                }
            }
            InputRequest::Touch { key } => self.queue_command(touch_command(key)),
            InputRequest::UiSnapshot {} => self.queue(CoreCall::UiSnapshot).map(|()| false),
            InputRequest::Ui { command } => self.queue_ui(command),
            InputRequest::UiKey { input } => self.queue_dialog_key(&input),
            InputRequest::UiCatalog { locale, entries } => UiContentCatalog::embedded()
                .map_err(AdapterError::Ui)
                .and_then(|catalog| {
                    catalog
                        .validate_overlay(locale, &entries)
                        .map_err(AdapterError::Ui)?;
                    match locale {
                        Locale::Ja => self.ui_catalog_ja.extend(entries.into_entries()),
                        Locale::En => self.ui_catalog_en.extend(entries.into_entries()),
                    }
                    Ok(false)
                }),
        };
        match result {
            Ok(handled) => self.response(handled, None),
            Err(error) => self.response(false, Some(error)),
        }
    }

    fn queue(&mut self, call: CoreCall) -> Result<(), AdapterError> {
        if self.pending.is_some() {
            return Err(AdapterError::Busy);
        }
        self.pending = Some(call);
        Ok(())
    }

    fn queue_command(&mut self, key: VirtualKey) -> Result<bool, AdapterError> {
        if self
            .ui_snapshot
            .as_ref()
            .is_some_and(|ui| ui.top().is_some())
        {
            return Err(AdapterError::Ui(UiError::Modal));
        }
        let snapshot = self.snapshot.as_ref().ok_or(AdapterError::NotReady)?;
        if !snapshot.ready || !snapshot.has_world() {
            return Err(AdapterError::NotReady);
        }
        self.queue(CoreCall::Command(key))?;
        Ok(true)
    }

    fn queue_dialog_key(&mut self, input: &KeyInput) -> Result<bool, AdapterError> {
        let Some(ui) = self.ui_snapshot.as_ref() else {
            return Ok(false);
        };
        match dialog_command(input, ui) {
            Some(command) => self.queue_ui(command),
            None => Ok(false),
        }
    }

    fn queue_ui(&mut self, command: UiCommand) -> Result<bool, AdapterError> {
        let ui = self
            .ui_snapshot
            .as_ref()
            .ok_or(AdapterError::Ui(UiError::Stale))?;
        ui.validate_command(&command).map_err(AdapterError::Ui)?;
        render_ui(ui, &self.ui_catalog()?).map_err(AdapterError::Ui)?;
        self.queue(CoreCall::UiCommand)?;
        self.ui_command = Some(command);
        Ok(true)
    }

    /// Receive the original snapshot or command trace and cache only validated observations.
    /// The original core already executed the call: invalid responses never trigger a retry.
    pub fn accept_core_response(&mut self, bytes: &[u8]) -> Response {
        let Some(call) = self.pending.take() else {
            return self.response(false, Some(AdapterError::Response));
        };
        let result = match call {
            CoreCall::Snapshot => Snapshot::from_bytes(bytes)
                .map(|snapshot| {
                    self.snapshot = Some(snapshot);
                    self.trace = None;
                })
                .map_err(AdapterError::Contract),
            CoreCall::Command(key) => CommandTrace::from_bytes(bytes)
                .map_err(AdapterError::Contract)
                .and_then(|trace| {
                    if trace.command != key {
                        return Err(AdapterError::Response);
                    }
                    self.snapshot = Some(trace.after.clone());
                    self.trace = Some(trace);
                    Ok(())
                }),
            CoreCall::UiSnapshot => UiSnapshot::from_bytes(bytes)
                .map(|ui| self.ui_snapshot = Some(ui))
                .map_err(AdapterError::Ui),
            CoreCall::UiCommand => {
                let pending = self.ui_command.take();
                UiTrace::from_bytes(bytes)
                    .map_err(AdapterError::Ui)
                    .and_then(|trace| {
                        if pending.as_ref() != Some(&trace.command) {
                            return Err(AdapterError::Response);
                        }
                        self.ui_snapshot = Some(trace.after);
                        Ok(())
                    })
            }
        };
        self.response(false, result.err())
    }

    /// Report a native failure without rolling back, replaying, or replacing its state.
    pub fn core_failed(&mut self) -> Response {
        self.pending = None;
        self.ui_command = None;
        self.response(false, Some(AdapterError::CoreFailed))
    }

    fn response(&self, handled: bool, mut error: Option<AdapterError>) -> Response {
        let labels = match labels(self.locale) {
            Ok(labels) => labels,
            Err(display_error) => {
                error = Some(AdapterError::Display(display_error));
                BTreeMap::new()
            }
        };
        let view = match &self.snapshot {
            Some(snapshot) => match render(snapshot, self.locale) {
                Ok(frame) => Some(frame),
                Err(display_error) => {
                    error = Some(AdapterError::Display(display_error));
                    None
                }
            },
            None => None,
        };
        let ui = match &self.ui_snapshot {
            Some(snapshot) => match self
                .ui_catalog()
                .and_then(|catalog| render_ui(snapshot, &catalog).map_err(AdapterError::Ui))
            {
                Ok(frame) => Some(frame),
                Err(ui_error) => {
                    if error.is_none() {
                        error = Some(ui_error);
                    }
                    None
                }
            },
            None => None,
        };
        Response {
            handled,
            locale: self.locale,
            labels,
            pending_kind: self.pending.map_or(0, CoreCall::kind),
            error_id: error.map(AdapterError::text_id),
            view,
            ui,
        }
    }
}

/// A bounded safe byte mailbox; no raw pointers or foreign-memory lifetimes.
#[derive(Debug, Default)]
pub struct ByteMailbox {
    bytes: Vec<u8>,
    invalid: bool,
}

impl ByteMailbox {
    pub fn reset(&mut self) {
        self.bytes.clear();
        self.invalid = false;
    }

    pub fn push(&mut self, byte: u32, limit: usize) -> bool {
        if self.invalid || self.bytes.len() >= limit {
            self.invalid = true;
            return false;
        }
        match u8::try_from(byte) {
            Ok(byte) => {
                self.bytes.push(byte);
                true
            }
            Err(_) => {
                self.invalid = true;
                false
            }
        }
    }

    /// Consume once. Invalid/oversized requests fail without leaking a partial payload.
    pub fn take(&mut self) -> Result<Vec<u8>, AdapterError> {
        if self.invalid {
            self.reset();
            return Err(AdapterError::Request);
        }
        Ok(std::mem::take(&mut self.bytes))
    }
}

// Export names are ABI attributes only; this module contains no unsafe memory operations.
// The host owns both the original C/Lua runtime and its linear-memory pointers.
#[cfg(target_arch = "wasm32")]
#[allow(unsafe_code)]
mod wasm {
    use super::*;
    use std::cell::RefCell;
    use tome_core_contracts::MAX_SNAPSHOT_BYTES;

    thread_local! {
        static ADAPTER: RefCell<Adapter> = RefCell::new(Adapter::default());
        static INPUT: RefCell<ByteMailbox> = RefCell::new(ByteMailbox::default());
        static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    }

    fn output(response: &Response) {
        let bytes = serde_json::to_vec(response).unwrap_or_else(|_| {
            br#"{"handled":false,"error_id":"error.core.json","pending_kind":0}"#.to_vec()
        });
        OUTPUT.with(|out| *out.borrow_mut() = bytes);
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn tome_adapter_input_reset() {
        INPUT.with(|input| input.borrow_mut().reset());
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn tome_adapter_input_byte(byte: u32) -> u32 {
        u32::from(INPUT.with(|input| input.borrow_mut().push(byte, MAX_SNAPSHOT_BYTES)))
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn tome_adapter_request() -> u32 {
        let bytes = INPUT.with(|input| input.borrow_mut().take());
        ADAPTER.with(|adapter| {
            let mut adapter = adapter.borrow_mut();
            let response = match bytes {
                Ok(bytes) => adapter.request(&bytes),
                Err(error) => adapter.response(false, Some(error)),
            };
            output(&response);
            response.pending_kind
        })
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn tome_adapter_pending_kind() -> u32 {
        ADAPTER.with(|adapter| adapter.borrow().pending().map_or(0, CoreCall::kind))
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn tome_adapter_pending_len() -> u32 {
        ADAPTER.with(|adapter| {
            adapter
                .borrow()
                .pending_bytes()
                .len()
                .try_into()
                .unwrap_or(0)
        })
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn tome_adapter_pending_byte(index: u32) -> u32 {
        ADAPTER.with(|adapter| {
            adapter
                .borrow()
                .pending_bytes()
                .get(usize::try_from(index).unwrap_or(usize::MAX))
                .copied()
                .map_or(256, u32::from)
        })
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn tome_adapter_core_result() {
        let bytes = INPUT.with(|input| input.borrow_mut().take());
        ADAPTER.with(|adapter| {
            let mut adapter = adapter.borrow_mut();
            let response = match bytes {
                Ok(bytes) => adapter.accept_core_response(&bytes),
                Err(_) => adapter.core_failed(),
            };
            output(&response);
        });
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn tome_adapter_core_failed() {
        ADAPTER.with(|adapter| output(&adapter.borrow_mut().core_failed()));
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn tome_adapter_output_len() -> u32 {
        OUTPUT.with(|out| u32::try_from(out.borrow().len()).unwrap_or(0))
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn tome_adapter_output_byte(index: u32) -> u32 {
        OUTPUT.with(|out| {
            usize::try_from(index)
                .ok()
                .and_then(|index| out.borrow().get(index).copied())
                .map_or(256, u32::from)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tome_core_contracts::PROTOCOL;

    #[test]
    fn declared_native_dialog_catalogue_renders_both_locales_without_core_calls_or_name_translation()
     {
        let mut adapter = Adapter::default();
        let external = "wolf {character_name} <script> 日本語";
        let world = observation(12, external);
        start(&mut adapter, &world);
        let native = serde_json::json!({"protocol":1,"stack":[{
            "handle":"d_1","class_name":"engine.ui.Dialog","bounds":{"x":0,"y":0,"w":640,"h":240},"active":true,"actions":["EXIT"],
            "title":{"kind":"semantic","id":"ui.roundtrip.title","args":{}},
            "components":[{"handle":"c_2","class_name":"engine.ui.Textzone","kind":"text","bounds":{"x":0,"y":0,"w":640,"h":140},"hidden":false,"focused":false,"can_focus":false,
                "text":{"kind":"semantic","id":"ui.roundtrip.body","args":{"character_name":{"kind":"external","value":external}}},"actions":[]},
                {"handle":"c_3","class_name":"engine.ui.Button","kind":"button","bounds":{"x":0,"y":150,"w":100,"h":40},"hidden":false,"focused":true,"can_focus":true,
                "text":{"kind":"semantic","id":"ui.roundtrip.yes","args":{}},"actions":["ACCEPT"]},
                {"handle":"c_4","class_name":"engine.ui.Button","kind":"button","bounds":{"x":120,"y":150,"w":100,"h":40},"hidden":false,"focused":false,"can_focus":true,
                "text":{"kind":"semantic","id":"ui.roundtrip.no","args":{}},"actions":["ACCEPT"]}],"focused":"c_3"}]});
        let bytes = serde_json::to_vec(&native).expect("native projection fixture");
        let expected_ui = UiSnapshot::from_bytes(&bytes).expect("validated native UI fixture");
        adapter.request(br#"{"op":"ui_snapshot"}"#);
        let japanese = adapter.accept_core_response(&bytes);
        assert_eq!(japanese.error_id, None);
        assert_eq!(japanese.labels.len(), 54);
        assert_eq!(
            japanese.ui.expect("Japanese original dialog").dialogs[0].components[0].text,
            Some(format!("{external}でプレイを続けますか？"))
        );
        let english = adapter.request(br#"{"op":"locale","locale":"en"}"#);
        assert_eq!(english.error_id, None);
        assert_eq!(
            english.ui.expect("English original dialog").dialogs[0].components[0].text,
            Some(format!("Continue playing as {external}?"))
        );
        assert_eq!(adapter.pending(), None);
        assert_eq!(adapter.snapshot(), Some(&world));
        assert_eq!(adapter.ui_snapshot.as_ref(), Some(&expected_ui));
    }

    #[test]
    fn host_ui_catalogues_reject_duplicate_ids_wrong_parameters_and_static_label_overrides() {
        let mut adapter = Adapter::default();
        let world = observation(12, "wolf");
        start(&mut adapter, &world);
        let before = adapter.ui_catalog().expect("declared catalogue");
        assert_eq!(before.len(), 58);
        for request in [
            br#"{"op":"ui_catalog","locale":"ja","entries":{"ui.roundtrip.body":"{username}"}}"#
                .as_slice(),
            br#"{"op":"ui_catalog","locale":"ja","entries":{"ui.core.title":"replacement"}}"#
                .as_slice(),
            br#"{"op":"ui_catalog","locale":"ja","entries":{"ui.unbound.content":"unreviewed"}}"#
                .as_slice(),
        ] {
            assert_eq!(adapter.request(request).error_id, Some("error.ui.text"));
            assert_eq!(
                adapter.ui_catalog().expect("catalogue remained intact"),
                before
            );
        }
        assert_eq!(adapter.request(br#"{"op":"ui_catalog","locale":"ja","entries":{"ui.roundtrip.yes":"A","ui.roundtrip.yes":"B"}}"#).error_id, Some("error.core.request"));
        assert_eq!(
            adapter.ui_catalog().expect("catalogue remained intact"),
            before
        );
        assert_eq!(adapter.pending(), None);
        assert_eq!(adapter.snapshot(), Some(&world));
    }

    #[test]
    fn original_dialog_actions_use_opaque_transport_without_actor_mutation() {
        let mut adapter = Adapter::default();
        let world = observation(12, "external name");
        start(&mut adapter, &world);
        adapter.request(br#"{"op":"ui_snapshot"}"#);
        let ui = br#"{"protocol":1,"stack":[{"handle":"d_1","class_name":"engine.ui.Dialog","bounds":{"x":0,"y":0,"w":100,"h":100},"active":true,"focused":"c_2","actions":["EXIT"],"components":[{"handle":"c_2","class_name":"engine.ui.Button","kind":"button","bounds":{"x":0,"y":0,"w":90,"h":40},"hidden":false,"focused":true,"can_focus":true,"text":{"kind":"semantic","id":"ui.dialog.yes","args":{}},"actions":["ACCEPT"]}]}]}"#;
        assert_eq!(adapter.accept_core_response(ui).error_id, None);
        assert_eq!(
            adapter
                .request(br#"{"op":"touch","key":"MOVE_STAY"}"#)
                .error_id,
            Some("error.ui.modal")
        );
        assert!(
            adapter
                .request(br#"{"op":"key","input":{"key":"Enter"}}"#)
                .handled
        );
        assert_eq!(adapter.pending(), Some(CoreCall::UiCommand));
        assert_eq!(
            serde_json::from_slice::<UiCommand>(&adapter.pending_bytes())
                .expect("command")
                .key,
            tome_core_contracts::ui::UiKey::Accept
        );
        assert_eq!(adapter.snapshot(), Some(&world));
        let trace = br#"{"protocol":1,"command":{"dialog":"d_1","target":"c_2","key":"ACCEPT"},"after":{"protocol":1,"stack":[]}}"#;
        assert_eq!(adapter.accept_core_response(trace).error_id, None);
        assert_eq!(adapter.snapshot(), Some(&world));
        assert_eq!(adapter.pending(), None);
    }

    fn observation(turn: u64, name: &str) -> Snapshot {
        let json = serde_json::json!({
            "protocol":1,"ready":true,
            "game":{"turn":turn,"paused":true,
                "player":{"uid":71,"name":name,"x":0,"y":0,"level":1,
                    "life":100.0,"max_life":100.0,"energy":{"value":1000.0,"mod":1.0},"energyBase":0.0},
                "level":{"level":1,"map":{"w":1,"h":1,"cells":[
                    {"x":0,"y":0,"seen":true,"remembered":true,
                        "terrain":{"uid":17,"name":"floor","display":".","color_r":255}}
                ]}}
            }
        });
        Snapshot::from_bytes(&serde_json::to_vec(&json).expect("fixture")).expect("fixture")
    }

    fn start(adapter: &mut Adapter, snapshot: &Snapshot) {
        adapter.request(br#"{"op":"snapshot"}"#);
        let response =
            adapter.accept_core_response(&serde_json::to_vec(snapshot).expect("fixture"));
        assert_eq!(response.error_id, None);
    }

    #[test]
    fn commands_are_only_original_key_bytes_and_do_not_predict_actor_transitions() {
        let mut adapter = Adapter::default();
        let snapshot = observation(21, "外部 {name} <script>");
        start(&mut adapter, &snapshot);
        let before = adapter.snapshot().cloned();
        let response = adapter.request(br#"{"op":"key","input":{"key":"ArrowRight"}}"#);
        assert!(response.handled);
        assert_eq!(
            adapter.pending(),
            Some(CoreCall::Command(VirtualKey::MoveRight))
        );
        assert_eq!(adapter.pending().expect("pending").bytes(), b"MOVE_RIGHT");
        assert_eq!(adapter.snapshot().cloned(), before);
        assert_eq!(
            response
                .view
                .expect("view")
                .game
                .expect("game")
                .player
                .expect("player")
                .name,
            "外部 {name} <script>"
        );
    }

    #[test]
    fn recorded_original_core_responses_replay_identically_in_adapter_only() {
        // Synthetic protocol fixtures exercise transport. They are not evidence of native gameplay.
        let first = observation(21, "player");
        let next = observation(31, "player");
        let trace = CommandTrace {
            protocol: PROTOCOL,
            command: VirtualKey::MoveStay,
            ticks: 10,
            before: first.clone(),
            after: next.clone(),
        };
        let bytes = serde_json::to_vec(&trace).expect("fixture");
        let mut left = Adapter::default();
        let mut right = Adapter::default();
        for adapter in [&mut left, &mut right] {
            start(adapter, &first);
            let response = adapter.request(br#"{"op":"touch","key":"MOVE_STAY"}"#);
            assert!(response.handled);
            assert_eq!(adapter.accept_core_response(&bytes).error_id, None);
        }
        assert_eq!(left.snapshot(), right.snapshot());
        assert_eq!(left.trace(), right.trace());
        assert_eq!(left.snapshot(), Some(&next));
    }

    #[test]
    fn view_locale_and_unhandled_keys_never_request_original_gameplay() {
        let mut adapter = Adapter::default();
        let snapshot = observation(12, "日本語の外部名");
        start(&mut adapter, &snapshot);
        for request in [
            br#"{"op":"view"}"#.as_slice(),
            br#"{"op":"locale","locale":"en"}"#.as_slice(),
            br#"{"op":"locale","locale":"ja"}"#.as_slice(),
            br#"{"op":"key","input":{"key":"ArrowRight","composing":true}}"#.as_slice(),
            br#"{"op":"key","input":{"key":"Enter"}}"#.as_slice(),
        ] {
            let response = adapter.request(request);
            assert!(!response.handled);
            assert_eq!(adapter.pending(), None);
            assert_eq!(adapter.snapshot(), Some(&snapshot));
        }
    }

    #[test]
    fn malformed_busy_mismatched_and_native_failure_never_fake_or_retry_gameplay() {
        let mut adapter = Adapter::default();
        assert_eq!(
            adapter
                .request(br#"{"op":"touch","key":"MOVE_LEFT"}"#)
                .error_id,
            Some("error.core.not_ready")
        );
        let snapshot = observation(5, "player");
        start(&mut adapter, &snapshot);
        for request in [
            br#"{"op":"view","extra":true}"#.as_slice(),
            br#"{"op":"touch","key":"game.player.life=999"}"#.as_slice(),
        ] {
            assert_eq!(
                adapter.request(request).error_id,
                Some("error.core.request")
            );
        }
        adapter.request(br#"{"op":"touch","key":"MOVE_LEFT"}"#);
        assert_eq!(
            adapter.request(br#"{"op":"snapshot"}"#).error_id,
            Some("error.core.busy")
        );
        let wrong = CommandTrace {
            protocol: 1,
            command: VirtualKey::MoveRight,
            ticks: 1,
            before: snapshot.clone(),
            after: observation(6, "player"),
        };
        assert_eq!(
            adapter
                .accept_core_response(&serde_json::to_vec(&wrong).expect("fixture"))
                .error_id,
            Some("error.core.response")
        );
        assert_eq!(adapter.snapshot(), Some(&snapshot));
        assert_eq!(adapter.pending(), None);
        adapter.request(br#"{"op":"touch","key":"MOVE_LEFT"}"#);
        assert_eq!(adapter.core_failed().error_id, Some("error.core.failed"));
        assert_eq!(adapter.snapshot(), Some(&snapshot));
        assert_eq!(adapter.pending(), None);
    }

    #[test]
    fn safe_byte_mailbox_rejects_overflow_invalid_bytes_and_partial_requests() {
        let mut mailbox = ByteMailbox::default();
        assert!(mailbox.push(65, 1));
        assert!(!mailbox.push(66, 1));
        assert_eq!(mailbox.take(), Err(AdapterError::Request));
        assert!(!mailbox.push(256, 4));
        assert_eq!(mailbox.take(), Err(AdapterError::Request));
        assert!(mailbox.push(66, 4));
        assert_eq!(mailbox.take().expect("fixture"), b"B");
        assert_eq!(mailbox.take().expect("empty"), b"");
    }
}
