//! Pure presentation of owned semantic captures. No C/game/RNG/storage access.
//! Rust owns UI lifetimes, batches, scalar/stat/spell composition, message order,
//! and locale replacement. The browser renders only the resulting model.

#[path = "localization/json.rs"]
mod json;

use crate::localization::{ReviewCatalog, ReviewError};
use crate::text::{GameCatalog, Locale, parse_flat_json};
use json::{JsonValue as J, Limits};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::ffi::c_char;
use std::fmt::{self, Write};
use std::rc::Rc;

pub const MAX_EVENT_BYTES: usize = 128 * 1024;
pub const MAX_CACHE_BYTES: usize = 4 * 1024 * 1024;
pub const MAX_MODEL_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_WIDGETS: usize = 512;
// Original native interactive viewers append all collected rows before paging.
pub const MAX_OBJECT_LIST_WIDGETS: usize = 2570;
pub const MAX_MONSTER_LIST_WIDGETS: usize = 1255;
const MAX_OBJECT_LIST_CACHE_BYTES: usize = 32 * 1024 * 1024;
const MAX_MONSTER_LIST_CACHE_BYTES: usize = 8 * 1024 * 1024;
fn widget_limit(context: &str) -> usize {
    match context {
        "object-list" => MAX_OBJECT_LIST_WIDGETS,
        "monster-list" => MAX_MONSTER_LIST_WIDGETS,
        _ => MAX_WIDGETS,
    }
}
fn charge_cache(used: &mut [usize; 3], context: &str, amount: usize) -> Result<(), PresentationError> {
    let (index, maximum) = match context {
        "object-list" => (1, MAX_OBJECT_LIST_CACHE_BYTES),
        "monster-list" => (2, MAX_MONSTER_LIST_CACHE_BYTES),
        _ => (0, MAX_CACHE_BYTES),
    };
    used[index] = used[index].checked_add(amount).ok_or(PresentationError::Limit("cache bytes"))?;
    if used[index] > maximum { return Err(PresentationError::Limit("cache bytes")); }
    Ok(())
}

pub const MAX_MESSAGES: usize = 100;
pub const MAX_SCOPE_DEPTH: u8 = 16;
/// Extend this source declaration when a producer gains a new UI context.
pub const UI_CONTEXTS: &[&str] = &[
    "birth", "birth-menu", "birth-race-help", "birth-class-help", "birth-options",
    "name-editor", "history-editor", "character", "sidebar", "status", "spells",
    "descriptions", "help", "inventory", "equipment", "shops", "store", "menus",
    "general-menu", "settings", "knowledge", "knowledge-groups", "knowledge-items", "targeting", "item-menu", "target",
    "quiver", "floor-items", "throwing-items", "store-items", "target-detail",
    "death", "death-menu", "score", "options", "keymap", "visuals", "command", "curse-menu",
    "object-info", "feature-info", "trap-info", "confirmation", "monster-lore", "rune-lore", "shape-lore", "quantity-editor", "choice-dialog", "monster-list", "object-list",
];
const EVENT_LIMITS: Limits = Limits {
    max_bytes: MAX_EVENT_BYTES, max_depth: 32, max_nodes: 8192, max_string_bytes: 32768,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PresentationError {
    Invalid(&'static str), Limit(&'static str), Localization(ReviewError), Catalog(String),
}
impl fmt::Display for PresentationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Invalid(reason) => write!(f, "invalid presentation capture: {reason}"),
            Self::Limit(reason) => write!(f, "presentation limit: {reason}"),
            Self::Localization(error) => error.fmt(f),
            Self::Catalog(error) => write!(f, "invalid presentation catalog: {error}"),
        }
    }
}
impl std::error::Error for PresentationError {}
impl From<ReviewError> for PresentationError {
    fn from(error: ReviewError) -> Self { Self::Localization(error) }
}
impl PresentationError {
    pub fn status(&self) -> u32 {
        match self {
            Self::Invalid(_) => 100, Self::Limit(_) => 101,
            Self::Localization(error) => error.status(), Self::Catalog(_) => 102,
        }
    }
}

/// Formatting receives detached captures; implementations must be pure.
pub trait PresentationFormatter {
    fn event(&self, locale: Locale, json: &str) -> Result<Option<String>, PresentationError>;
    fn legacy(&self, locale: Locale, id: &str) -> Result<Option<String>, PresentationError>;
    fn label(&self, locale: Locale, id: &str) -> Option<&str>;
}

struct Catalogs {
    reviewed: ReviewCatalog,
    english: GameCatalog,
    japanese: GameCatalog,
    labels_en: BTreeMap<String, String>,
    labels_ja: BTreeMap<String, String>,
}
impl Catalogs {
    fn embedded() -> Result<Self, PresentationError> {
        let labels = |source| parse_flat_json(source).map(|pairs| pairs.into_iter().collect())
            .map_err(|error| PresentationError::Catalog(error.to_string()));
        Ok(Self {
            reviewed: ReviewCatalog::embedded()?,
            english: GameCatalog::for_locale(Locale::English).map_err(|error| PresentationError::Catalog(error.to_string()))?,
            japanese: GameCatalog::for_locale(Locale::Japanese).map_err(|error| PresentationError::Catalog(error.to_string()))?,
            labels_en: labels(include_str!("../../web/i18n/en.json"))?,
            labels_ja: labels(include_str!("../../web/i18n/ja.json"))?,
        })
    }
}
impl PresentationFormatter for Catalogs {
    fn event(&self, locale: Locale, json: &str) -> Result<Option<String>, PresentationError> {
        match self.reviewed.event(locale, json) {
            Ok(text) => Ok(Some(text)),
            // Explicitly unavailable descriptor grammar stays unavailable.
            Err(error) if matches!(error.status(), 12 | 26) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }
    fn legacy(&self, locale: Locale, id: &str) -> Result<Option<String>, PresentationError> {
        let catalog = match locale { Locale::English => &self.english, Locale::Japanese => &self.japanese };
        if let Ok(text) = catalog.message(id) { return Ok(Some(text.to_owned())); }
        match self.reviewed.static_message(locale, id) {
            Ok(text) => Ok(Some(text)),
            Err(error) if error.status() == 1 => Ok(None),
            Err(error) => Err(error.into()),
        }
    }
    fn label(&self, locale: Locale, id: &str) -> Option<&str> {
        match locale { Locale::English => &self.labels_en, Locale::Japanese => &self.labels_ja }.get(id).map(String::as_str)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum Control {
    BeginReplace, BeginPatch, End, Reset, Clear(String), Value(String), Input(String),
    SpellRow(u16), Row(u16), Action(String), HelpPage, Unsupported(String),
}
#[derive(Clone, Debug, PartialEq, Eq)]
struct Capture {
    json: String, event: J, id: String, context: String, widget: String,
    message: bool, control: Option<Control>,
}
fn source_key(value: &str, max: usize) -> bool {
    !value.is_empty() && value.len() <= max && value.bytes().all(|byte|
        byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-' | b':'))
}
fn field_string<'a>(event: &'a J, field: &str) -> Result<&'a str, PresentationError> {
    event.field(field).and_then(J::as_str).ok_or(PresentationError::Invalid("missing string field"))
}
fn parameter<'a>(event: &'a J, name: &str) -> Option<&'a J> { event.field("params")?.field(name) }
fn scalar(value: &J) -> Option<String> {
    let kind = value.field("type")?.as_str()?;
    if !matches!(kind, "integer" | "signed_integer" | "int32") { return None; }
    let value = value.field("value")?.as_integer()?;
    Some(if kind == "signed_integer" && value >= 0 { format!("+{value}") } else { value.to_string() })
}
fn opaque(value: &J) -> Option<&str> {
    if !matches!(value.field("type")?.as_str()?, "character_name" | "verbatim_user_text") { return None; }
    let value = value.field("value")?.as_str()?;
    (value.len() <= 32768 && !value.contains('\0')).then_some(value)
}
impl Capture {
    fn parse(input: &str) -> Result<Self, PresentationError> {
        let event = json::parse(input, EVENT_LIMITS).map_err(|_| PresentationError::Invalid("bounded JSON"))?;
        let fields = event.as_object().ok_or(PresentationError::Invalid("event object"))?;
        if fields.iter().any(|(name, _)| !["schema_version", "id", "params", "channel", "context", "widget", "severity", "sound"].contains(&name.as_str())) {
            return Err(PresentationError::Invalid("unknown envelope field"));
        }
        if event.field("schema_version").and_then(J::as_integer) != Some(1) { return Err(PresentationError::Invalid("schema version")); }
        let id = field_string(&event, "id")?.to_owned();
        let context = field_string(&event, "context")?.to_owned();
        let widget = field_string(&event, "widget")?.to_owned();
        let channel = field_string(&event, "channel")?;
        let message = channel == "message";
        if !matches!(channel, "message" | "ui") || !source_key(&context, 63) || !source_key(&widget, 127) {
            return Err(PresentationError::Invalid("channel/context/widget"));
        }
        if !message && !UI_CONTEXTS.contains(&context.as_str()) { return Err(PresentationError::Invalid("undeclared UI context")); }
        let params = event.field("params").and_then(J::as_object).ok_or(PresentationError::Invalid("parameters object"))?;
        if params.len() > 16 { return Err(PresentationError::Limit("parameters")); }
        let mut control = None;
        if id.is_empty() {
            if message { return Err(PresentationError::Invalid("message control")); }
            control = Some(match widget.as_str() {
                "__begin_replace" => Control::BeginReplace, "__begin_patch" => Control::BeginPatch,
                "__end" => Control::End, "__reset" => Control::Reset,
                "__help_page" => {
                    if context != "help" || params.len() != 8 { return Err(PresentationError::Invalid("help page context/fields")); }
                    for (name, value) in params {
                        let kind = value.field("type").and_then(J::as_str);
                        let valid = match name.as_str() {
                            "filename" => kind == Some("opaque_file_path") && value.field("value").and_then(J::as_str)
                                .is_some_and(|filename| ["index.txt", "commands.txt", "r_comm.txt", "r_index.txt", "symbols.txt"].contains(&filename)),
                            "first" | "total" => kind == Some("integer") && value.field("value").and_then(J::as_integer).is_some_and(|value| (0..=100000).contains(&value)),
                            "page_capacity" => kind == Some("integer") && value.field("value").and_then(J::as_integer).is_some_and(|value| (1..=4096).contains(&value)),
                            "menu" | "case_sensitive" => kind == Some("boolean") && value.field("value").and_then(J::as_bool).is_some(),
                            "find_query" | "highlight_query" => kind == Some("verbatim_user_text") && value.field("value").and_then(J::as_str).is_some_and(|value| value.len() <= 79 && !value.contains('\0')),
                            _ => false,
                        };
                        if !valid { return Err(PresentationError::Invalid("help page fact")); }
                    }
                    Control::HelpPage
                }
                value => {
                    let (prefix, slot) = value.split_once(':').ok_or(PresentationError::Invalid("control widget"))?;
                    if !source_key(slot, 100) { return Err(PresentationError::Invalid("control slot")); }
                    match prefix {
                        "__clear" => Control::Clear(slot.to_owned()),
                        "__unsupported" => Control::Unsupported(slot.to_owned()),
                        "__value" => {
                            if parameter(&event, "number").and_then(scalar).is_none() { return Err(PresentationError::Invalid("numeric fact")); }
                            Control::Value(slot.to_owned())
                        }
                        "__input" => {
                            if parameter(&event, "text").and_then(opaque).is_none() { return Err(PresentationError::Invalid("opaque input")); }
                            if let Some(maximum) = parameter(&event, "max_bytes") {
                                if !matches!(maximum.field("type").and_then(J::as_str),Some("integer" | "int32")) ||
                                    !maximum.field("value").and_then(J::as_integer).is_some_and(|value| (0..=65536).contains(&value)) {
                                    return Err(PresentationError::Invalid("input byte limit"));
                                }
                            }
                            Control::Input(slot.to_owned())
                        }
                        "__spell_row" => Control::SpellRow(slot.parse().map_err(|_| PresentationError::Invalid("spell row index"))?),
                        "__row" | "__action" => {
                            for (name, value) in params {
                                let kind = value.field("type").and_then(J::as_str);
                                let valid = match name.as_str() {
                                    "key" => kind == Some("display_token") && value.field("value").and_then(J::as_str).is_some_and(|key| key.len() <= 32 && !key.contains('\0')),
                                    "selected" => kind == Some("boolean") && value.field("value").and_then(J::as_bool).is_some(),
                                    "color" => kind == Some("integer") && value.field("value").and_then(J::as_integer).is_some_and(|value| (0..29).contains(&value)),
                                    "activation_key" => kind == Some("integer") && value.field("value").and_then(J::as_integer).is_some_and(|value| (1..=0x10ffff).contains(&value) && !(0xd800..=0xdfff).contains(&value)),
                                    _ => false,
                                };
                                if !valid { return Err(PresentationError::Invalid("row metadata")); }
                            }
                            if prefix == "__action" {
                                if parameter(&event, "activation_key").is_none() { return Err(PresentationError::Invalid("action activation")); }
                                Control::Action(slot.to_owned())
                            } else { Control::Row(slot.parse().map_err(|_| PresentationError::Invalid("row index"))?) }
                        }
                        _ => return Err(PresentationError::Invalid("control widget")),
                    }
                }
            });
        } else if !source_key(&id, 127) || !id.contains('.') || !id.starts_with(|character: char| character.is_ascii_lowercase()) {
            return Err(PresentationError::Invalid("semantic ID"));
        }
        Ok(Self { json: input.to_owned(), event, id, context, widget, message, control })
    }
}

type Widgets = Vec<Rc<Capture>>;
#[derive(Clone, Debug, PartialEq, Eq)]
struct Scope { context: String, widgets: Widgets }
#[derive(Clone, Debug, PartialEq, Eq)]
struct Batch { depth: u8, widgets: Widgets }
#[derive(Clone, Debug, PartialEq, Eq)]
struct BatchFrame { begin: Rc<Capture>, retained: Widgets }
#[derive(Clone, Debug, PartialEq, Eq)]
enum Timeline { Legacy(String), Semantic(Rc<Capture>) }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct StateFacts { pub turn: i64, pub depth: i64, pub hp: i64, pub maxhp: i64 }

/// All retained events are detached immutable allocations. Mutations replace
/// handles transactionally, so snapshots can never alias a later update.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PresentationCache {
    scopes: Vec<Scope>, pending: BTreeMap<String, Batch>, messages: VecDeque<Rc<Capture>>,
    timeline: VecDeque<Timeline>, legacy_ids: VecDeque<String>, state: Option<StateFacts>,
    batch_stack: Vec<BatchFrame>, state_source: Option<String>,
}
fn clear_slot(widgets: &mut Widgets, slot: &str) {
    widgets.retain(|packet| {
        if let Some(Control::Action(name)) = &packet.control {
            if slot == name || slot.strip_prefix("action.") == Some(name.as_str()) { return false; }
        }
        let widget = packet.widget.strip_prefix("__value:").or_else(|| packet.widget.strip_prefix("__input:"))
            .or_else(|| packet.widget.strip_prefix("__unsupported:")).unwrap_or(&packet.widget);
        widget != slot && !widget.strip_prefix(slot).is_some_and(|tail| tail.starts_with('.'))
    });
}
fn upsert(widgets: &mut Widgets, packet: Rc<Capture>) -> Result<(), PresentationError> {
    if let Some(previous) = widgets.iter_mut().find(|previous| previous.widget == packet.widget) { *previous = packet; }
    else {
        if widgets.len() >= widget_limit(&packet.context) { return Err(PresentationError::Limit("widgets per scope")); }
        widgets.push(packet);
    }
    Ok(())
}
#[derive(Default)]
struct EvidenceCaptures { indices: BTreeMap<String, usize>, json: Vec<String> }
impl EvidenceCaptures {
    fn capture(&mut self, capture: &Capture) -> usize {
        if let Some(index) = self.indices.get(&capture.json) { return *index; }
        let index = self.json.len();
        self.indices.insert(capture.json.clone(), index);
        self.json.push(capture.json.clone());
        index
    }
    fn widgets(&mut self, widgets: &Widgets) -> Vec<usize> {
        widgets.iter().map(|capture| self.capture(capture)).collect()
    }
}
fn evidence_indices(out: &mut String, indices: &[usize]) {
    out.push('[');
    for (position, index) in indices.iter().enumerate() {
        if position != 0 { out.push(','); }
        let _ = write!(out, "{index}");
    }
    out.push(']');
}
impl PresentationCache {
    pub fn reset(&mut self) { *self = Self::default(); }
    /// Deterministic source-only replay evidence. Captures keep the exact owned
    /// original JSON; repeated references use a canonical first-use table.
    /// Formatting, locale, output diagnostics, and missing-ID lists are absent.
    pub(crate) fn source_evidence(&self) -> Result<Vec<u8>, PresentationError> {
        self.check_capacity()?;
        let mut captures = EvidenceCaptures::default();
        let scopes = self.scopes.iter().map(|scope| (scope.context.as_str(), captures.widgets(&scope.widgets))).collect::<Vec<_>>();
        let pending = self.pending.iter().map(|(context, batch)| (context.as_str(), batch.depth, captures.widgets(&batch.widgets))).collect::<Vec<_>>();
        let stack = self.batch_stack.iter().map(|frame| (captures.capture(&frame.begin), captures.widgets(&frame.retained))).collect::<Vec<_>>();
        let messages = self.messages.iter().map(|capture| captures.capture(capture)).collect::<Vec<_>>();
        let timeline = self.timeline.iter().map(|entry| match entry {
            Timeline::Legacy(id) => (Some(id.as_str()), None),
            Timeline::Semantic(capture) => (None, Some(captures.capture(capture))),
        }).collect::<Vec<_>>();
        let mut out = String::from("{\"schema_version\":1,\"state\":");
        if let Some(source) = &self.state_source { quoted(&mut out, source); } else { out.push_str("null"); }
        out.push_str(",\"scopes\":[");
        for (position, (context, widgets)) in scopes.iter().enumerate() {
            if position != 0 { out.push(','); }
            out.push_str("{\"context\":"); quoted(&mut out, context);
            out.push_str(",\"events\":"); evidence_indices(&mut out, widgets); out.push('}');
        }
        out.push_str("],\"pending\":[");
        for (position, (context, depth, widgets)) in pending.iter().enumerate() {
            if position != 0 { out.push(','); }
            out.push_str("{\"context\":"); quoted(&mut out, context);
            let _ = write!(out, ",\"depth\":{depth},\"events\":");
            evidence_indices(&mut out, widgets); out.push('}');
        }
        out.push_str("],\"batch_stack\":[");
        for (position, (begin, retained)) in stack.iter().enumerate() {
            if position != 0 { out.push(','); }
            let _ = write!(out, "{{\"begin\":{begin},\"retained\":");
            evidence_indices(&mut out, retained); out.push('}');
        }
        out.push_str("],\"messages\":"); evidence_indices(&mut out, &messages);
        out.push_str(",\"timeline\":[");
        for (position, (legacy, semantic)) in timeline.iter().enumerate() {
            if position != 0 { out.push(','); }
            if let Some(id) = legacy { out.push_str("{\"legacy\":"); quoted(&mut out, id); out.push('}'); }
            else if let Some(index) = semantic { let _ = write!(out, "{{\"event\":{index}}}"); }
        }
        out.push_str("],\"legacy_ids\":[");
        for (position, id) in self.legacy_ids.iter().enumerate() {
            if position != 0 { out.push(','); }
            quoted(&mut out, id);
        }
        out.push_str("],\"captures\":[");
        for (position, source) in captures.json.iter().enumerate() {
            if position != 0 { out.push(','); }
            quoted(&mut out, source);
            if out.len() > MAX_MODEL_BYTES { return Err(PresentationError::Limit("source evidence bytes")); }
        }
        out.push_str("]}");
        if out.len() > MAX_MODEL_BYTES { return Err(PresentationError::Limit("source evidence bytes")); }
        Ok(out.into_bytes())
    }
    fn check_capacity(&self) -> Result<(), PresentationError> {
        let mut seen = BTreeSet::new();
        let mut used = [0_usize; 3];
        let fixed = self.legacy_ids.iter().map(String::len).sum::<usize>()
            .checked_add(self.state_source.as_ref().map_or(0, String::len))
            .ok_or(PresentationError::Limit("cache bytes"))?;
        charge_cache(&mut used, "", fixed)?;
        for frame in &self.batch_stack {
            let handles = frame.retained.len().checked_add(1)
                .and_then(|count| count.checked_mul(std::mem::size_of::<Rc<Capture>>()))
                .ok_or(PresentationError::Limit("cache bytes"))?;
            charge_cache(&mut used, &frame.begin.context, handles)?;
        }
        for packet in self.scopes.iter().flat_map(|scope| &scope.widgets)
            .chain(self.pending.values().flat_map(|batch| &batch.widgets)).chain(self.messages.iter())
            .chain(self.timeline.iter().filter_map(|entry| if let Timeline::Semantic(packet) = entry { Some(packet) } else { None }))
            .chain(self.batch_stack.iter().flat_map(|frame| std::iter::once(&frame.begin).chain(frame.retained.iter()))) {
            if seen.insert(Rc::as_ptr(packet) as usize) {
                // Charge raw JSON and its owned parsed string representation once.
                let owned_bytes = packet.json.len().checked_mul(2).ok_or(PresentationError::Limit("cache bytes"))?;
                let context = if packet.message { "" } else { packet.context.as_str() };
                charge_cache(&mut used, context, owned_bytes)?;
            }
        }
        Ok(())
    }
    fn scope_mut(&mut self, context: &str) -> &mut Widgets {
        if let Some(index) = self.scopes.iter().position(|scope| scope.context == context) { return &mut self.scopes[index].widgets; }
        self.scopes.push(Scope { context: context.to_owned(), widgets: Vec::new() });
        &mut self.scopes.last_mut().expect("just pushed scope").widgets
    }
    fn apply(&mut self, packet: Rc<Capture>) -> Result<bool, PresentationError> {
        if packet.message {
            self.messages.push_back(Rc::clone(&packet));
            self.timeline.push_back(Timeline::Semantic(packet));
            if self.messages.len() > MAX_MESSAGES { self.messages.pop_front(); }
            if self.timeline.len() > MAX_MESSAGES { self.timeline.pop_front(); }
            return Ok(true);
        }
        let context = packet.context.clone();
        match &packet.control {
            Some(Control::BeginReplace | Control::BeginPatch) => {
                let retained = self.pending.get(&context).map(|batch| batch.widgets.clone())
                    .or_else(|| self.scopes.iter().find(|scope| scope.context == context).map(|scope| scope.widgets.clone()))
                    .unwrap_or_default();
                if let Some(batch) = self.pending.get_mut(&context) {
                    if batch.depth >= MAX_SCOPE_DEPTH { return Err(PresentationError::Limit("scope depth")); }
                    batch.depth += 1;
                } else {
                    let widgets = if packet.control == Some(Control::BeginPatch) {
                        self.scopes.iter().find(|scope| scope.context == context).map_or_else(Vec::new, |scope| scope.widgets.clone())
                    } else { Vec::new() };
                    self.pending.insert(context, Batch { depth: 1, widgets });
                }
                self.batch_stack.push(BatchFrame { begin: packet, retained });
                return Ok(false);
            }
            Some(Control::End) => {
                if let Some(index) = self.batch_stack.iter().rposition(|frame| frame.begin.context == context) {
                    self.batch_stack.remove(index);
                }
                if let Some(batch) = self.pending.get_mut(&context) {
                    batch.depth -= 1;
                    if batch.depth == 0 {
                        let batch = self.pending.remove(&context).expect("existing pending batch");
                        *self.scope_mut(&context) = batch.widgets;
                        return Ok(true);
                    }
                }
                return Ok(false);
            }
            Some(Control::Reset) => {
                self.scopes.retain(|scope| scope.context != context);
                self.pending.remove(&context);
                self.batch_stack.retain(|frame| frame.begin.context != context);
                return Ok(true);
            }
            _ => {}
        }
        let pending = self.pending.contains_key(&context);
        let widgets = if pending { &mut self.pending.get_mut(&context).expect("checked pending batch").widgets } else { self.scope_mut(&context) };
        match &packet.control {
            Some(Control::Clear(slot)) => clear_slot(widgets, slot),
            Some(Control::Unsupported(slot)) => { clear_slot(widgets, slot); upsert(widgets, packet)?; }
            _ => { upsert(widgets, packet)?; }
        }
        Ok(!pending)
    }
    /// Returns whether the visible presentation changed. Batch events are
    /// retained immediately but become visible only at their matching end.
    pub fn accept(&mut self, json: &str, formatter: &impl PresentationFormatter, locale: Locale) -> Result<bool, PresentationError> {
        let packet = Capture::parse(json)?;
        if !packet.id.is_empty() { let _ = formatter.event(locale, &packet.json)?; }
        let mut candidate = self.clone();
        let changed = candidate.apply(Rc::new(packet))?;
        candidate.check_capacity()?;
        *self = candidate;
        Ok(changed)
    }
    pub fn message(&mut self, id: &str, formatter: &impl PresentationFormatter, locale: Locale) -> Result<(), PresentationError> {
        if !source_key(id, 127) || !id.contains('.') { return Err(PresentationError::Invalid("legacy ID")); }
        let _ = formatter.legacy(locale, id)?;
        self.timeline.push_back(Timeline::Legacy(id.to_owned()));
        self.legacy_ids.push_back(id.to_owned());
        if self.timeline.len() > MAX_MESSAGES { self.timeline.pop_front(); }
        if self.legacy_ids.len() > MAX_MESSAGES { self.legacy_ids.pop_front(); }
        Ok(())
    }
    /// Normal command boundaries invalidate temporary menus, including any
    /// unfinished batch. Persistent sidebar/status facts remain owned.
    pub fn command_boundary(&mut self) -> bool {
        let before = self.scopes.len() + self.pending.len();
        self.scopes.retain(|scope| matches!(scope.context.as_str(), "sidebar" | "status"));
        self.pending.retain(|context, _| matches!(context.as_str(), "sidebar" | "status"));
        self.batch_stack.retain(|frame| matches!(frame.begin.context.as_str(), "sidebar" | "status"));
        before != self.scopes.len() + self.pending.len()
    }
    /// Copy already emitted C state facts. No C/RNG lookup or simulated rules.
    pub fn state(&mut self, input: &str) -> Result<bool, PresentationError> {
        let state = json::parse(input, EVENT_LIMITS).map_err(|_| PresentationError::Invalid("state JSON"))?;
        let number = |name| state.field(name).and_then(J::as_integer).ok_or(PresentationError::Invalid("state scalar"));
        let facts = StateFacts { turn: number("turn")?, depth: number("depth")?, hp: number("hp")?, maxhp: number("maxhp")? };
        let generated = state.field("generated").and_then(J::as_bool).ok_or(PresentationError::Invalid("state generated flag"))?;
        let command = state.field("command").and_then(J::as_bool).ok_or(PresentationError::Invalid("state command flag"))?;
        let changed = self.state != Some(facts);
        self.state = Some(facts);
        self.state_source = Some(input.to_owned());
        Ok((generated && command && self.command_boundary()) || changed)
    }
    pub fn snapshot(&self, formatter: &impl PresentationFormatter, locale: Locale) -> Result<PresentationSnapshot, PresentationError> {
        let mut sections = Vec::new();
        let mut scopes = Vec::new();
        for scope in &self.scopes {
            let packets = scope.widgets.iter().map(|capture| packet(capture, formatter, locale)).collect::<Result<Vec<_>, _>>()?;
            let blocks = compose_scope(&scope.context, &packets, formatter, locale);
            if !blocks.is_empty() {
                sections.push(Section {
                    key: scope.context.clone(), heading: formatter.label(locale, &match scope.context.as_str() {
                        "rune-lore" => "semantic.context.rune_lore".to_owned(),
                        "shape-lore" => "semantic.context.shape_lore".to_owned(),
                        "quantity-editor" => "semantic.context.quantity_editor".to_owned(),
                        "choice-dialog" => "semantic.context.choice_dialog".to_owned(),
                        "monster-list" => "semantic.context.monster_list".to_owned(),
                        "object-list" => "semantic.context.object_list".to_owned(),
                        _ => format!("semantic.context.{}", scope.context),
                    }).unwrap_or("").to_owned(), blocks,
                });
            }
            scopes.push(DiagnosticScope { context: scope.context.clone(), widgets: packets });
        }
        let captured_messages = self.messages.iter().map(|capture| packet(capture, formatter, locale)).collect::<Result<Vec<_>, _>>()?;
        let mut messages = Vec::new();
        let mut missing_ids = Vec::new();
        for entry in &self.timeline {
            let (id, text) = match entry {
                Timeline::Legacy(id) => {
                    let text = formatter.legacy(locale, id)?;
                    if text.is_none() && !missing_ids.contains(id) { missing_ids.push(id.clone()); }
                    (id.clone(), text)
                }
                Timeline::Semantic(capture) => (capture.id.clone(), formatter.event(locale, &capture.json)?),
            };
            if let Some(text) = text { messages.push(MessageLine { id, text }); }
        }
        if messages.len() > 4 { messages.drain(..messages.len() - 4); }
        let state_summary = self.state.map_or_else(String::new, |state| {
            let mut summary = label(formatter, locale, "state.summary");
            for (name, value) in [("turn", state.turn), ("depth", state.depth), ("hp", state.hp), ("maxhp", state.maxhp)] {
                summary = summary.replace(&format!("{{{name}}}"), &value.to_string());
            }
            summary
        });
        let input_max_bytes = scopes.iter().rev().flat_map(|scope| scope.widgets.iter().rev())
            .find(|packet| matches!(&packet.capture.control,Some(Control::Input(_))))
            .and_then(|packet| parameter(&packet.capture.event,"max_bytes"))
            .and_then(|value| value.field("value")).and_then(J::as_integer)
            .and_then(|value| u32::try_from(value).ok());
        Ok(PresentationSnapshot { locale, state_summary, sections, messages, scopes, captured_messages, input_max_bytes, legacy_ids: self.legacy_ids.iter().cloned().collect(), missing_ids })
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Packet { capture: Rc<Capture>, pub text: Option<String>, pub locale: Locale }
fn packet(capture: &Rc<Capture>, formatter: &impl PresentationFormatter, locale: Locale) -> Result<Packet, PresentationError> {
    Ok(Packet { capture: Rc::clone(capture), text: if capture.id.is_empty() { None } else { formatter.event(locale, &capture.json)? }, locale })
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Block {
    Paragraph { key: String, text: String, selected: bool, color: Option<u8>, activation_key: Option<u32>, runs: Vec<crate::application_help::HighlightRun> },
    Table { key: String, class_name: String, headers: Vec<String>, rows: Vec<Vec<String>> },
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Section { pub key: String, pub heading: String, pub blocks: Vec<Block> }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MessageLine { pub id: String, pub text: String }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiagnosticScope { pub context: String, pub widgets: Vec<Packet> }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PresentationSnapshot {
    pub locale: Locale, pub state_summary: String, pub sections: Vec<Section>, pub messages: Vec<MessageLine>,
    pub scopes: Vec<DiagnosticScope>, pub captured_messages: Vec<Packet>,
    pub legacy_ids: Vec<String>, pub missing_ids: Vec<String>, pub input_max_bytes: Option<u32>,
}
fn find<'a>(packets: &'a [Packet], widget: &str) -> Option<&'a Packet> { packets.iter().find(|packet| packet.capture.widget == widget) }
fn label(formatter: &impl PresentationFormatter, locale: Locale, id: &str) -> String { formatter.label(locale, id).unwrap_or("").to_owned() }
fn stat_label(widget: &str) -> Option<&str> {
    let suffix = widget.strip_prefix("stat.")?;
    let (index, field) = suffix.split_once('.')?;
    (field == "label" && matches!(index, "0" | "1" | "2" | "3" | "4")).then_some(widget.strip_suffix(".label")?).filter(|value| !value.is_empty())
}
fn compose_scope(context: &str, packets: &[Packet], formatter: &impl PresentationFormatter, locale: Locale) -> Vec<Block> {
    let mut blocks = Vec::new();
    let help_page = (context == "help").then(|| find(packets, "__help_page")).flatten();
    let highlight_query = help_page.and_then(|packet| parameter(&packet.capture.event, "highlight_query")).and_then(opaque).unwrap_or("");
    let case_sensitive = help_page.and_then(|packet| parameter(&packet.capture.event, "case_sensitive")).and_then(|value| value.field("value")).and_then(J::as_bool).unwrap_or(false);
    let stat_labels = if context == "character" { packets.iter().filter(|packet| packet.text.is_some() && stat_label(&packet.capture.widget).is_some()).collect::<Vec<_>>() } else { Vec::new() };
    let stat_headers = ["self", "race_bonus", "class_bonus", "equipment_bonus", "best"];
    if !stat_labels.is_empty() {
        let mut headers = vec![String::new()];
        headers.extend(stat_headers.iter().map(|widget| find(packets, widget).and_then(|packet| packet.text.clone()).unwrap_or_default()));
        headers.push(label(formatter, locale, "semantic.stat.current"));
        let mut rows = Vec::new();
        for item in &stat_labels {
            let prefix = stat_label(&item.capture.widget).unwrap_or("");
            let mut row = vec![item.text.clone().unwrap_or_default()];
            for field in ["self", "race", "class", "equipment", "best", "current"] {
                let widget = format!("{prefix}.{field}");
                row.push(find(packets, &widget).and_then(|packet| packet.text.clone()).or_else(||
                    find(packets, &format!("__value:{widget}")).and_then(|packet| parameter(&packet.capture.event, "number")).and_then(scalar)).unwrap_or_default());
            }
            rows.push(row);
        }
        blocks.push(Block::Table { key: "stats".to_owned(), class_name: "semantic-stats".to_owned(), headers, rows });
    }
    for item in packets {
        let widget = &item.capture.widget;
        if !stat_labels.is_empty() && (stat_headers.contains(&widget.as_str()) ||
            widget.strip_prefix("stat.").and_then(|value| value.split_once('.')).is_some_and(|(index, field)| matches!(index, "0" | "1" | "2" | "3" | "4") && matches!(field, "label" | "self" | "best" | "current"))) { continue; }
        let mut text = if matches!(&item.capture.control, Some(Control::Input(_))) {
            parameter(&item.capture.event, "text").and_then(opaque).map(str::to_owned)
        } else if !item.capture.id.is_empty() { item.text.clone() } else { None };
        let Some(mut text_value) = text.take() else { continue; };
        if context == "history-editor" && matches!(&item.capture.control, Some(Control::Input(_))) {
            let heading = label(formatter, locale, "semantic.history.draft");
            if !heading.is_empty() { text_value = format!("{heading}: {text_value}"); }
        }
        let scalar_widget = format!("__value:{widget}");
        let base_scalar = format!("__value:{}", widget.strip_suffix(".label").unwrap_or(widget));
        if let Some(number) = find(packets, &scalar_widget).or_else(|| find(packets, &base_scalar))
            .and_then(|packet| parameter(&packet.capture.event, "number")).and_then(scalar) {
            let _ = write!(text_value, " {number}");
        }
        if let Some(index) = widget.strip_prefix("row.").and_then(|value| value.strip_suffix(".name"))
            .filter(|index| !index.is_empty() && index.bytes().all(|byte| byte.is_ascii_digit())) {
            if let Some(metadata) = find(packets, &format!("__spell_row:{index}")) {
                let token = |name| parameter(&metadata.capture.event, name).filter(|parameter| parameter.field("type").and_then(J::as_str) == Some("display_token"))?.field("value")?.as_str();
                if let Some(key) = token("key").filter(|key| key.len() == 1 && key.as_bytes()[0].is_ascii_graphic()) { text_value = format!("{key}) {text_value}"); }
                if let Some(state) = token("state").filter(|state| ["forgotten", "worked", "untried", "unknown", "difficult"].contains(state)) {
                    let label = label(formatter, locale, &format!("semantic.spell.state.{state}"));
                    if !label.is_empty() { let _ = write!(text_value, " · {label}"); }
                }
                for field in ["level", "mana", "fail"] {
                    if let Some(number) = parameter(&metadata.capture.event, field).and_then(scalar) {
                        let label = label(formatter, locale, &format!("semantic.spell.{field}"));
                        let _ = write!(text_value, " · {label} {number}{}", if field == "fail" { "%" } else { "" });
                    }
                }
            }
        }
        let mut selected = false;
        let mut color = None;
        let mut activation_key = None;
        if let Some(index) = widget.strip_prefix("row:").or_else(|| widget.strip_prefix("row.").and_then(|value| value.split_once('.')).map(|(index, _)| index))
            .filter(|index| !index.is_empty() && index.bytes().all(|byte| byte.is_ascii_digit())) {
            if let Some(metadata) = find(packets, &format!("__row:{index}")) {
                if let Some(key) = parameter(&metadata.capture.event, "key").and_then(|value| value.field("value")).and_then(J::as_str).filter(|key| !key.is_empty()) { text_value = format!("{key}) {text_value}"); }
                selected = parameter(&metadata.capture.event, "selected").and_then(|value| value.field("value")).and_then(J::as_bool).unwrap_or(false);
                color = parameter(&metadata.capture.event, "color").and_then(|value| value.field("value")).and_then(J::as_integer).and_then(|value| u8::try_from(value).ok());
                activation_key = parameter(&metadata.capture.event, "activation_key").and_then(|value| value.field("value")).and_then(J::as_integer).and_then(|value| u32::try_from(value).ok());
            }
        }
        if let Some(name) = widget.strip_prefix("action.").and_then(|value| value.strip_suffix(".label")) {
            if let Some(metadata) = find(packets, &format!("__action:{name}")) {
                selected = parameter(&metadata.capture.event, "selected").and_then(|value| value.field("value")).and_then(J::as_bool).unwrap_or(false);
                color = parameter(&metadata.capture.event, "color").and_then(|value| value.field("value")).and_then(J::as_integer).and_then(|value| u8::try_from(value).ok());
                activation_key = parameter(&metadata.capture.event, "activation_key").and_then(|value| value.field("value")).and_then(J::as_integer).and_then(|value| u32::try_from(value).ok());
            }
        }
        // Only source-reviewed document rows participate in native help highlighting.
        // Navigation projections share row metadata but are not document text.
        let document_row = context == "help" && widget.starts_with("row:") &&
            ["help.index.", "help.roguelike_index.", "help.original.", "help.roguelike.", "help.symbols."].iter().any(|prefix| item.capture.id.starts_with(prefix));
        let runs = if document_row && !highlight_query.is_empty() {
            crate::application_help::highlight_runs(&text_value, highlight_query, case_sensitive)
        } else { Vec::new() };
        blocks.push(Block::Paragraph { key: widget.clone(), text: text_value, selected, color, activation_key, runs });
    }
    blocks
}

fn quoted(out: &mut String, text: &str) {
    out.push('"');
    for character in text.chars() {
        match character {
            '"' => out.push_str("\\\""), '\\' => out.push_str("\\\\"), '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"), '\t' => out.push_str("\\t"),
            value if value < '\u{20}' => { let _ = write!(out, "\\u{:04x}", u32::from(value)); },
            value => out.push(value),
        }
    }
    out.push('"');
}
fn strings(out: &mut String, values: &[String]) {
    out.push('['); for (index, value) in values.iter().enumerate() { if index > 0 { out.push(','); } quoted(out, value); } out.push(']');
}
fn locale_key(locale: Locale) -> &'static str { match locale { Locale::English => "en", Locale::Japanese => "ja" } }
fn encode_packet(out: &mut String, packet: &Packet) {
    out.push_str("{\"event\":"); out.push_str(&packet.capture.json); out.push_str(",\"json\":"); quoted(out, &packet.capture.json);
    out.push_str(",\"locale\":"); quoted(out, locale_key(packet.locale)); out.push_str(",\"text\":");
    if let Some(text) = &packet.text { quoted(out, text); } else { out.push_str("null"); } out.push('}');
}
impl PresentationSnapshot {
    pub fn encode_json(&self) -> Result<String, PresentationError> {
        let mut out = String::with_capacity(4096);
        out.push_str("{\"schema_version\":1,\"locale\":"); quoted(&mut out, locale_key(self.locale)); out.push_str(",\"state_summary\":"); quoted(&mut out, &self.state_summary); let _ = write!(out, ",\"input_max_bytes\":{}", self.input_max_bytes.map_or_else(|| "null".to_owned(),|value|value.to_string())); out.push_str(",\"sections\":[");
        for (index, section) in self.sections.iter().enumerate() {
            if index > 0 { out.push(','); } out.push_str("{\"key\":"); quoted(&mut out, &section.key); out.push_str(",\"heading\":"); quoted(&mut out, &section.heading); out.push_str(",\"blocks\":[");
            for (index, block) in section.blocks.iter().enumerate() {
                if index > 0 { out.push(','); }
                match block {
                    Block::Paragraph { key, text, selected, color, activation_key, runs } => {
                        out.push_str("{\"kind\":\"paragraph\",\"key\":"); quoted(&mut out, key); out.push_str(",\"text\":"); quoted(&mut out, text);
                        let _ = write!(out, ",\"selected\":{selected},\"color\":{},\"activation_key\":{}", color.map_or_else(|| "null".to_owned(), |value| value.to_string()), activation_key.map_or_else(|| "null".to_owned(), |value| value.to_string()));
                        if !runs.is_empty() {
                            out.push_str(",\"runs\":[");
                            for (index, run) in runs.iter().enumerate() {
                                if index > 0 { out.push(','); }
                                out.push_str("{\"text\":"); quoted(&mut out, &run.text);
                                let _ = write!(out, ",\"highlighted\":{}}}", run.highlighted);
                            }
                            out.push(']');
                        }
                        out.push('}');
                    }
                    Block::Table { key, class_name, headers, rows } => {
                        out.push_str("{\"kind\":\"table\",\"key\":"); quoted(&mut out, key); out.push_str(",\"class_name\":"); quoted(&mut out, class_name); out.push_str(",\"headers\":"); strings(&mut out, headers); out.push_str(",\"rows\":[");
                        for (index, row) in rows.iter().enumerate() { if index > 0 { out.push(','); } strings(&mut out, row); } out.push_str("]}");
                    }
                }
            }
            out.push_str("]}");
        }
        out.push_str("],\"messages\":[");
        for (index, message) in self.messages.iter().enumerate() { if index > 0 { out.push(','); } out.push_str("{\"id\":"); quoted(&mut out, &message.id); out.push_str(",\"text\":"); quoted(&mut out, &message.text); out.push('}'); }
        out.push_str("],\"message_ids\":"); strings(&mut out, &self.legacy_ids); out.push_str(",\"missing_ids\":"); strings(&mut out, &self.missing_ids);
        out.push_str(",\"semantic\":{\"scopes\":[");
        for (index, scope) in self.scopes.iter().enumerate() {
            if index > 0 { out.push(','); } out.push_str("{\"context\":"); quoted(&mut out, &scope.context); out.push_str(",\"widgets\":[");
            for (index, packet) in scope.widgets.iter().enumerate() { if index > 0 { out.push(','); } encode_packet(&mut out, packet); } out.push_str("]}");
        }
        out.push_str("],\"messages\":[");
        for (index, packet) in self.captured_messages.iter().enumerate() { if index > 0 { out.push(','); } encode_packet(&mut out, packet); } out.push_str("]}}");
        if out.len() > MAX_MODEL_BYTES { return Err(PresentationError::Limit("encoded model bytes")); }
        Ok(out)
    }
}

struct Runtime { cache: PresentationCache, catalogs: Result<Catalogs, PresentationError>, locale: Locale, output: Vec<u8>, status: u32 }
impl Default for Runtime {
    fn default() -> Self { Self { cache: PresentationCache::default(), catalogs: Catalogs::embedded(), locale: Locale::Japanese, output: vec![0], status: 0 } }
}
thread_local! { static RUNTIME: RefCell<Runtime> = RefCell::new(Runtime::default()); }
/// Replay callers receive owned source bytes, never the localized output span.
pub(crate) fn source_evidence() -> Result<Vec<u8>, PresentationError> {
    RUNTIME.with(|runtime| runtime.try_borrow()
        .map_err(|_| PresentationError::Invalid("presentation runtime busy"))?
        .cache.source_evidence())
}
impl Runtime {
    fn snapshot(&self) -> Result<String, PresentationError> { self.cache.snapshot(self.catalogs.as_ref().map_err(Clone::clone)?, self.locale)?.encode_json() }
    fn finish(&mut self, result: Result<bool, PresentationError>) -> *const c_char {
        match result.and_then(|changed| if changed { self.snapshot().map(Some) } else { Ok(None) }) {
            Ok(Some(output)) => { self.output = output.into_bytes(); self.output.push(0); self.status = 0; self.output.as_ptr().cast() }
            Ok(None) => { self.status = 0; std::ptr::null() }
            Err(error) => { self.status = error.status(); self.output.clear(); std::ptr::null() }
        }
    }
}
unsafe fn input<'a>(bytes: *const u8, len: u32, max: usize) -> Result<&'a str, PresentationError> {
    let len = usize::try_from(len).map_err(|_| PresentationError::Limit("foreign span"))?;
    if bytes.is_null() || len == 0 || len > max || len > isize::MAX as usize { return Err(PresentationError::Invalid("foreign span")); }
    // SAFETY: FFI callers guarantee this readable initialized synchronous span.
    let bytes = unsafe { std::slice::from_raw_parts(bytes, len) };
    let text = std::str::from_utf8(bytes).map_err(|_| PresentationError::Invalid("UTF-8"))?;
    if text.contains('\0') { return Err(PresentationError::Invalid("embedded NUL")); }
    Ok(text)
}
/// Consume an owned copy of one original semantic capture. Null with status 0
/// means a pending batch has not yet changed the visible model.
/// # Safety
/// For nonzero len, bytes must point to len initialized readable bytes for the
/// duration of this call and must not alias this module's previous output.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_present_event(bytes: *const u8, len: u32) -> *const c_char {
    // SAFETY: caller promises the bounded initialized readable input span.
    let capture = unsafe { input(bytes, len, MAX_EVENT_BYTES) }.map(str::to_owned);
    RUNTIME.with(|runtime| {
        let mut runtime = runtime.borrow_mut();
        let previous = runtime.cache.clone();
        let Runtime { cache, catalogs, locale, .. } = &mut *runtime;
        let result = capture.and_then(|capture| cache.accept(&capture, catalogs.as_ref().map_err(Clone::clone)?, *locale));
        let output = runtime.finish(result);
        if runtime.status != 0 { runtime.cache = previous; }
        output
    })
}
/// Queue a source semantic ID in original callback order.
/// # Safety
/// bytes must point to len initialized readable ID bytes (1..127) during this
/// call, and must not alias this module's previous output.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_present_message(bytes: *const u8, len: u32) -> *const c_char {
    // SAFETY: caller promises the bounded initialized readable ID span.
    let id = unsafe { input(bytes, len, 127) }.map(str::to_owned);
    RUNTIME.with(|runtime| {
        let mut runtime = runtime.borrow_mut();
        let previous = runtime.cache.clone();
        let Runtime { cache, catalogs, locale, .. } = &mut *runtime;
        let result = id.and_then(|id| cache.message(&id, catalogs.as_ref().map_err(Clone::clone)?, *locale).map(|()| true));
        let output = runtime.finish(result);
        if runtime.status != 0 { runtime.cache = previous; }
        output
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_present_boundary(generated: u32, command: u32) -> *const c_char {
    RUNTIME.with(|runtime| { let mut runtime = runtime.borrow_mut(); let changed = generated != 0 && command != 0 && runtime.cache.command_boundary(); runtime.finish(Ok(changed)) })
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_present_locale(locale: u32) -> *const c_char {
    RUNTIME.with(|runtime| {
        let mut runtime = runtime.borrow_mut(); let previous = runtime.locale;
        runtime.locale = if locale == 0 { Locale::English } else { Locale::Japanese };
        let output = runtime.finish(Ok(true));
        if runtime.status != 0 { runtime.locale = previous; }
        output
    })
}
/// Copy the already emitted original state and compose its localized summary.
/// # Safety
/// bytes must point to len initialized readable UTF-8 JSON bytes for this call
/// and must not alias this module's previous output buffer.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_present_state(bytes: *const u8, len: u32) -> *const c_char {
    // SAFETY: the adapter supplies the already emitted bounded state JSON.
    let state = unsafe { input(bytes, len, MAX_EVENT_BYTES) }.map(str::to_owned);
    RUNTIME.with(|runtime| {
        let mut runtime = runtime.borrow_mut(); let previous = runtime.cache.clone();
        let result = state.and_then(|state| runtime.cache.state(&state));
        let output = runtime.finish(result);
        if runtime.status != 0 { runtime.cache = previous; }
        output
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_present_reset() -> *const c_char {
    RUNTIME.with(|runtime| { let mut runtime = runtime.borrow_mut(); runtime.cache.reset(); runtime.finish(Ok(true)) })
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_present_status() -> u32 { RUNTIME.with(|runtime| runtime.borrow().status) }

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture;
    impl PresentationFormatter for Fixture {
        fn event(&self, locale: Locale, json: &str) -> Result<Option<String>, PresentationError> {
            let capture = Capture::parse(json)?;
            Ok((capture.id != "test.unavailable").then(|| format!("{}:{}", locale_key(locale), capture.id)))
        }
        fn legacy(&self, locale: Locale, id: &str) -> Result<Option<String>, PresentationError> { Ok(Some(format!("{}:{id}", locale_key(locale)))) }
        fn label(&self, _: Locale, id: &str) -> Option<&str> {
            match id {
                "state.summary" => Some("{turn}/{depth}/{hp}/{maxhp}"),
                "semantic.spell.level" => Some("semantic.spell.level"),
                "semantic.spell.mana" => Some("semantic.spell.mana"),
                "semantic.spell.fail" => Some("semantic.spell.fail"),
                "semantic.spell.state.untried" => Some("semantic.spell.state.untried"),
                "semantic.stat.current" => Some("semantic.stat.current"),
                _ => None,
            }
        }
    }
    fn event(context: &str, widget: &str, id: &str, params: &str) -> String {
        format!(r#"{{"schema_version":1,"id":"{id}","channel":"ui","context":"{context}","widget":"{widget}","params":{params}}}"#)
    }
    fn add(cache: &mut PresentationCache, context: &str, widget: &str, id: &str, params: &str) -> bool {
        cache.accept(&event(context, widget, id, params), &Fixture, Locale::Japanese).unwrap()
    }
    #[test]
    fn replay_evidence_keeps_exact_pending_sources_and_ignores_locale_formatting() {
        let mut cache = PresentationCache::default();
        let original = event("inventory", "row.0.name", "test.object", "{}");
        cache.accept(&original, &Fixture, Locale::Japanese).unwrap();
        add(&mut cache, "inventory", "__begin_patch", "", "{}");
        add(&mut cache, "inventory", "row.1.name", "test.second", "{}");
        add(&mut cache, "help", "__begin_replace", "", "{}");
        add(&mut cache, "inventory", "__begin_replace", "", "{}");
        let evidence = cache.source_evidence().unwrap();
        let parsed = json::parse(std::str::from_utf8(&evidence).unwrap(), Limits {
            max_bytes: MAX_MODEL_BYTES, max_depth: 32, max_nodes: 32768, max_string_bytes: MAX_EVENT_BYTES,
        }).unwrap();
        assert_eq!(parsed.field("batch_stack").unwrap().as_array().unwrap().len(), 3);
        assert!(parsed.field("captures").unwrap().as_array().unwrap().iter().any(|value| value.as_str() == Some(original.as_str())));
        let _ = cache.snapshot(&Fixture, Locale::English).unwrap();
        let _ = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        assert_eq!(cache.source_evidence().unwrap(), evidence);
        assert!(cache.accept(&event("inventory", "__row:0", "", r#"{"activation_key":{"type":"integer","value":55296}}"#), &Fixture, Locale::Japanese).is_err());
        assert_eq!(cache.source_evidence().unwrap(), evidence);
        add(&mut cache, "inventory", "__end", "", "{}");
        assert_ne!(cache.source_evidence().unwrap(), evidence);
        assert_eq!(cache.batch_stack.len(), 2);
        cache.command_boundary();
        assert!(cache.batch_stack.is_empty());
    }
    #[test]
    fn replay_evidence_includes_state_flags_and_retained_message_order() {
        let mut cache = PresentationCache::default();
        cache.state(r#"{"turn":1,"depth":0,"hp":3,"maxhp":3,"generated":false,"command":false}"#).unwrap();
        let before = cache.source_evidence().unwrap();
        cache.state(r#"{"turn":1,"depth":0,"hp":3,"maxhp":3,"generated":true,"command":false}"#).unwrap();
        assert_ne!(cache.source_evidence().unwrap(), before);
        cache.message("test.first", &Fixture, Locale::Japanese).unwrap();
        cache.accept(r#"{"schema_version":1,"id":"test.dynamic","channel":"message","context":"command","widget":"log","params":{}}"#, &Fixture, Locale::Japanese).unwrap();
        cache.message("test.last", &Fixture, Locale::Japanese).unwrap();
        let evidence = String::from_utf8(cache.source_evidence().unwrap()).unwrap();
        assert!(evidence.contains(r#""timeline":[{"legacy":"test.first"},{"event":0},{"legacy":"test.last"}]"#));
        assert!(!evidence.contains("ja:"));
        assert!(!evidence.contains("missing_ids"));
    }
    #[test]
    fn batches_are_atomic_nested_and_command_boundary_clears_unfinished_ui() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "birth-menu", "old", "test.old", "{}");
        let detached = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        assert!(!add(&mut cache, "birth-menu", "__begin_replace", "", "{}"));
        assert!(!add(&mut cache, "birth-menu", "new", "test.new", "{}"));
        assert!(!add(&mut cache, "birth-menu", "__begin_patch", "", "{}"));
        assert!(!add(&mut cache, "birth-menu", "__end", "", "{}"));
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap(), detached);
        assert!(add(&mut cache, "birth-menu", "__end", "", "{}"));
        assert_ne!(cache.snapshot(&Fixture, Locale::Japanese).unwrap(), detached);
        add(&mut cache, "sidebar", "race", "test.race", "{}");
        add(&mut cache, "birth-menu", "__begin_replace", "", "{}");
        assert!(cache.command_boundary());
        assert_eq!(cache.scopes.len(), 1);
        assert!(cache.pending.is_empty());
        assert!(detached.encode_json().unwrap().contains("test.old"));
    }
    #[test]
    fn rejected_events_preserve_cache_and_unsupported_clears_stale_descriptions() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "descriptions", "object", "test.object", "{}");
        let before = cache.clone();
        assert!(cache.accept(&event("undeclared", "object", "test.object", "{}"), &Fixture, Locale::Japanese).is_err());
        assert_eq!(cache, before);
        add(&mut cache, "descriptions", "__unsupported:object", "", "{}");
        assert!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().sections.is_empty());
        add(&mut cache, "descriptions", "object", "test.unavailable", "{}");
        assert!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().sections.is_empty());
    }
    #[test]
    fn spell_and_scalar_composition_belongs_to_rust_and_locale_does_not_mutate_captures() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "spells", "row.0.name", "test.spell", "{}");
        add(&mut cache, "spells", "__spell_row:0", "", r#"{"key":{"type":"display_token","value":"a"},"state":{"type":"display_token","value":"untried"},"level":{"type":"integer","value":1},"mana":{"type":"integer","value":2},"fail":{"type":"integer","value":17}}"#);
        add(&mut cache, "sidebar", "hp", "test.hp", "{}");
        add(&mut cache, "sidebar", "__value:hp", "", r#"{"number":{"type":"signed_integer","value":4}}"#);
        let before = cache.clone();
        let japanese = cache.snapshot(&Fixture, Locale::Japanese).unwrap().encode_json().unwrap();
        let english = cache.snapshot(&Fixture, Locale::English).unwrap().encode_json().unwrap();
        assert!(japanese.contains("a) ja:test.spell · semantic.spell.state.untried · semantic.spell.level 1 · semantic.spell.mana 2 · semantic.spell.fail 17%"));
        assert!(japanese.contains("ja:test.hp +4"));
        assert!(english.contains("a) en:test.spell"));
        assert_eq!(cache, before);
        assert_eq!(japanese, cache.snapshot(&Fixture, Locale::Japanese).unwrap().encode_json().unwrap());
    }
    #[test]
    fn opaque_names_and_history_preserve_unicode_quotes_and_newlines() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "name-editor", "__input:name", "", r#"{"text":{"type":"character_name","value":"山田 \"QA\" 🐉"}}"#);
        add(&mut cache, "history-editor", "__input:draft", "", r#"{"text":{"type":"verbatim_user_text","value":"一行\n二行"}}"#);
        let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        let encoded = snapshot.encode_json().unwrap();
        assert!(encoded.contains("山田 \\\"QA\\\" 🐉"));
        assert!(encoded.contains("一行\\n二行"));
        assert!(json::parse(&encoded, Limits { max_bytes: MAX_MODEL_BYTES, max_depth: 32, max_nodes: 8192, max_string_bytes: MAX_EVENT_BYTES }).is_ok());
    }
    #[test]
    fn native_list_capacity_preserves_all_rows_and_rejects_one_more_atomically() {
        for (context, maximum) in [("object-list", MAX_OBJECT_LIST_WIDGETS), ("monster-list", MAX_MONSTER_LIST_WIDGETS), ("inventory", MAX_WIDGETS)] {
            let mut cache = PresentationCache::default();
            for index in 0..maximum {
                add(&mut cache, context, &format!("row.{index}.label"), "test.object", "{}");
            }
            let before = cache.clone();
            assert!(cache.accept(&event(context, &format!("row.{maximum}.label"), "test.object", "{}"), &Fixture, Locale::Japanese).is_err());
            assert_eq!(cache,before);
            let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
            assert_eq!(snapshot.sections[0].blocks.len(), maximum);
            assert!(snapshot.encode_json().is_ok());
        }
    }
    #[test]
    fn native_list_byte_allowance_does_not_expand_other_scope_limits() {
        let mut cache = PresentationCache::default();
        let params = format!(r#"{{"text":{{"type":"verbatim_user_text","value":"{}"}}}}"#, "x".repeat(16384));
        for index in 0..140 {
            add(&mut cache, "object-list", &format!("row.{index}.label"), "test.object", &params);
        }
        assert!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().encode_json().is_ok());
        let mut rejected = false;
        for index in 0..200 {
            let before = cache.clone();
            if cache.accept(&event("help", &format!("row:{index}"), "test.help", &params), &Fixture, Locale::Japanese).is_err() {
                assert_eq!(cache,before);
                rejected = true;
                break;
            }
        }
        assert!(rejected);
        assert_eq!(cache.scopes.iter().find(|scope|scope.context=="object-list").unwrap().widgets.len(),140);
    }
    #[test]
    fn source_lists_preserve_order_sort_action_locale_purity_and_scope_lifetime() {
        let mut cache = PresentationCache::default();
        for context in ["monster-list", "object-list"] {
            add(&mut cache, context, "__begin_replace", "", "{}");
            add(&mut cache, context, "row.0.label", "test.sort", "{}");
            add(&mut cache, context, "__row:0", "", r#"{"activation_key":{"type":"integer","value":120}}"#);
            add(&mut cache, context, "row.1.label", "test.header", "{}");
            add(&mut cache, context, "row.2.label", "test.first", "{}");
            add(&mut cache, context, "row.3.label", "test.second", "{}");
            add(&mut cache, context, "__end", "", "{}");
        }
        let before = cache.clone();
        let japanese = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        let english = cache.snapshot(&Fixture, Locale::English).unwrap();
        assert_eq!(japanese.sections.len(), 2);
        for section in &japanese.sections {
            assert_eq!(section.blocks.iter().map(|block| match block {Block::Paragraph {key,..}=>key.as_str(), _=>panic!("list is not a paragraph")}).collect::<Vec<_>>(), ["row.0.label","row.1.label","row.2.label","row.3.label"]);
            let Block::Paragraph {activation_key,text,..} = &section.blocks[0] else {unreachable!()};
            assert_eq!(*activation_key, Some(120));
            assert_eq!(text,"ja:test.sort");
        }
        let Block::Paragraph {text,..} = &english.sections[0].blocks[2] else {unreachable!()};
        assert_eq!(text,"en:test.first");
        assert_eq!(cache,before);
        add(&mut cache, "monster-list", "__reset", "", "{}");
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().sections.len(), 1);
        assert_eq!(japanese.sections.len(), 2);
    }
    #[test]
    fn quantity_input_limit_projects_owned_six_byte_bound_and_json_integer() {
        let mut cache = PresentationCache::default();
        assert!(!add(&mut cache, "quantity-editor", "__begin_replace", "", "{}"));
        assert!(!add(&mut cache, "quantity-editor", "__input:value", "", r#"{"text":{"type":"verbatim_user_text","value":"1"},"max_bytes":{"type":"integer","value":6}}"#));
        assert!(add(&mut cache, "quantity-editor", "__end", "", "{}"));
        let before = cache.clone();
        for locale in [Locale::Japanese, Locale::English] {
            let snapshot = cache.snapshot(&Fixture, locale).unwrap();
            assert_eq!(snapshot.input_max_bytes, Some(6));
            let encoded = snapshot.encode_json().unwrap();
            let decoded = json::parse(&encoded, EVENT_LIMITS).unwrap();
            assert_eq!(decoded.field("input_max_bytes").and_then(J::as_integer), Some(6));
            assert_eq!(cache, before);
        }
    }
    #[test]
    fn uncapped_input_and_empty_cache_project_explicit_json_null() {
        let mut cache = PresentationCache::default();
        for with_input in [false, true] {
            if with_input {
                add(&mut cache, "quantity-editor", "__input:value", "", r#"{"text":{"type":"verbatim_user_text","value":"1"}}"#);
            }
            let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
            assert_eq!(snapshot.input_max_bytes, None);
            let encoded = snapshot.encode_json().unwrap();
            let decoded = json::parse(&encoded, EVENT_LIMITS).unwrap();
            assert_eq!(decoded.field("input_max_bytes"), Some(&json::parse("null", EVENT_LIMITS).unwrap()));
        }
    }
    #[test]
    fn input_byte_limit_accepts_zero_ceiling_and_existing_integer_alias() {
        let mut cache = PresentationCache::default();
        for (kind, maximum) in [("integer", 0), ("integer", 65536), ("int32", 6)] {
            let params = format!(r#"{{"text":{{"type":"verbatim_user_text","value":""}},"max_bytes":{{"type":"{kind}","value":{maximum}}}}}"#);
            add(&mut cache, "quantity-editor", "__input:value", "", &params);
            assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().input_max_bytes, Some(maximum));
        }
    }
    #[test]
    fn invalid_input_byte_limits_reject_atomically_without_replacing_active_input() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "quantity-editor", "__input:value", "", r#"{"text":{"type":"verbatim_user_text","value":"1"},"max_bytes":{"type":"integer","value":6}}"#);
        let before = cache.clone();
        let evidence = cache.source_evidence().unwrap();
        for maximum in [
            r#"{"type":"verbatim_user_text","value":6}"#,
            r#"{"type":"signed_integer","value":6}"#,
            r#"{"type":"integer","value":"6"}"#,
            r#"{"type":"integer","value":-1}"#,
            r#"{"type":"integer","value":65537}"#,
            r#"{"type":"integer","value":false}"#,
            r#"{"type":"integer","value":null}"#,
            r#"{"type":"integer","value":6.5}"#,
            "null",
        ] {
            let params = format!(r#"{{"text":{{"type":"verbatim_user_text","value":"changed"}},"max_bytes":{maximum}}}"#);
            assert!(cache.accept(&event("quantity-editor", "__input:value", "", &params), &Fixture, Locale::Japanese).is_err(), "accepted {maximum}");
            assert_eq!(cache, before);
            assert_eq!(cache.source_evidence().unwrap(), evidence);
            assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().input_max_bytes, Some(6));
        }
    }
    #[test]
    fn latest_uncapped_input_masks_older_limit_and_scope_close_removes_it() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "quantity-editor", "__input:value", "", r#"{"text":{"type":"verbatim_user_text","value":"1"},"max_bytes":{"type":"integer","value":6}}"#);
        let detached = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        add(&mut cache, "name-editor", "__input:name", "", r#"{"text":{"type":"character_name","value":"山田"}}"#);
        let latest = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        assert_eq!(latest.input_max_bytes, None);
        let encoded = latest.encode_json().unwrap();
        assert_eq!(json::parse(&encoded, EVENT_LIMITS).unwrap().field("input_max_bytes"), Some(&json::parse("null", EVENT_LIMITS).unwrap()));
        add(&mut cache, "name-editor", "__reset", "", "{}");
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().input_max_bytes, Some(6));
        add(&mut cache, "quantity-editor", "__reset", "", "{}");
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().input_max_bytes, None);
        assert_eq!(detached.input_max_bytes, Some(6));
    }
    #[test]
    fn input_limit_replacement_clear_and_command_boundary_follow_capture_lifetime() {
        let mut cache = PresentationCache::default();
        let limited = r#"{"text":{"type":"verbatim_user_text","value":"1"},"max_bytes":{"type":"integer","value":6}}"#;
        let unlimited = r#"{"text":{"type":"verbatim_user_text","value":"2"}}"#;
        add(&mut cache, "quantity-editor", "__input:value", "", limited);
        add(&mut cache, "quantity-editor", "__input:value", "", unlimited);
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().input_max_bytes, None);
        add(&mut cache, "quantity-editor", "__input:value", "", limited);
        assert!(!add(&mut cache, "quantity-editor", "__begin_replace", "", "{}"));
        assert!(!add(&mut cache, "quantity-editor", "__input:value", "", unlimited));
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().input_max_bytes, Some(6));
        assert!(add(&mut cache, "quantity-editor", "__end", "", "{}"));
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().input_max_bytes, None);
        add(&mut cache, "quantity-editor", "__input:value", "", limited);
        add(&mut cache, "quantity-editor", "__clear:value", "", "{}");
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().input_max_bytes, None);
        add(&mut cache, "quantity-editor", "__input:value", "", limited);
        assert!(cache.command_boundary());
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().input_max_bytes, None);
        add(&mut cache, "quantity-editor", "__input:value", "", limited);
        cache.reset();
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().input_max_bytes, None);
    }
    #[test]
    fn spell_preview_rows_preserve_source_order_locale_purity_and_explicit_patch_clear() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "spells", "row.0.name", "test.spell", "{}");
        add(&mut cache, "spells", "__spell_row:0", "", r#"{"key":{"type":"display_token","value":"a"},"state":{"type":"display_token","value":"worked"},"level":{"type":"integer","value":1},"mana":{"type":"integer","value":2},"fail":{"type":"integer","value":17}}"#);
        // This fixture supplies localized output; source-selected graph construction belongs to the producer.
        add(&mut cache, "spells", "row.0.info", "angband.effect_info.spell_preview.description", "{}");
        add(&mut cache, "spells", "row.1.name", "test.next_spell", "{}");
        let before = cache.clone();
        let japanese = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        let english = cache.snapshot(&Fixture, Locale::English).unwrap();
        assert_eq!(japanese.sections[0].blocks.len(), 3);
        for (snapshot, locale) in [(&japanese, "ja"), (&english, "en")] {
            let Block::Paragraph { key, text, .. } = &snapshot.sections[0].blocks[0] else { panic!("missing name") };
            assert_eq!(key, "row.0.name");
            assert!(text.starts_with(&format!("a) {locale}:test.spell")));
            let Block::Paragraph { key, text, .. } = &snapshot.sections[0].blocks[1] else { panic!("missing preview") };
            assert_eq!(key, "row.0.info");
            assert_eq!(text, &format!("{locale}:angband.effect_info.spell_preview.description"));
            let Block::Paragraph { key, .. } = &snapshot.sections[0].blocks[2] else { panic!("missing next name") };
            assert_eq!(key, "row.1.name");
        }
        assert_eq!(cache, before);
        add(&mut cache, "spells", "__begin_patch", "", "{}");
        add(&mut cache, "spells", "__spell_row:0", "", r#"{"state":{"type":"display_token","value":"untried"}}"#);
        add(&mut cache, "spells", "__clear:row.0.info", "", "{}");
        assert_eq!(cache.snapshot(&Fixture, Locale::Japanese).unwrap(), japanese);
        add(&mut cache, "spells", "__end", "", "{}");
        let next = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        assert_eq!(next.sections[0].blocks.len(), 2);
        assert!(next.scopes[0].widgets.iter().all(|packet| packet.capture.widget != "row.0.info"));
        assert_eq!(japanese.sections[0].blocks.len(), 3);
    }
    #[test]
    fn original_static_and_typed_messages_keep_order_and_reformat_owned_events_only() {
        let mut cache = PresentationCache::default();
        cache.message("test.first", &Fixture, Locale::Japanese).unwrap();
        let message = r#"{"schema_version":1,"id":"test.dynamic","channel":"message","context":"command","widget":"log","params":{}}"#;
        cache.accept(message, &Fixture, Locale::Japanese).unwrap();
        cache.message("test.last", &Fixture, Locale::Japanese).unwrap();
        let japanese = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        assert_eq!(japanese.messages.iter().map(|line| line.id.as_str()).collect::<Vec<_>>(), ["test.first", "test.dynamic", "test.last"]);
        let before = cache.clone();
        let english = cache.snapshot(&Fixture, Locale::English).unwrap();
        assert_eq!(english.messages[1].text, "en:test.dynamic");
        assert_eq!(cache, before);
    }
    #[test]
    fn spell_replacement_removes_unreadable_metadata_and_reset_removes_scope() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "spells", "row.0.name", "test.spell", "{}");
        add(&mut cache, "spells", "__spell_row:0", "", r#"{"level":{"type":"integer","value":1},"mana":{"type":"integer","value":2},"fail":{"type":"integer","value":17}}"#);
        add(&mut cache, "spells", "__begin_patch", "", "{}");
        add(&mut cache, "spells", "__clear:row.0.name", "", "{}");
        add(&mut cache, "spells", "__spell_row:0", "", r#"{"state":{"type":"display_token","value":"illegible"}}"#);
        add(&mut cache, "spells", "__end", "", "{}");
        let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        assert!(snapshot.sections.is_empty());
        let metadata = snapshot.scopes[0].widgets.iter().find(|packet| packet.capture.widget == "__spell_row:0").unwrap();
        assert_eq!(metadata.capture.event.field("params").unwrap().as_object().unwrap().len(), 1);
        add(&mut cache, "spells", "__reset", "", "{}");
        assert!(cache.scopes.is_empty());
    }
    #[test]
    fn stat_table_owns_all_five_rows_and_numeric_bonus_columns() {
        let mut cache = PresentationCache::default();
        for index in 0..5 {
            add(&mut cache, "character", &format!("stat.{index}.label"), "test.stat", "{}");
            for field in ["self", "best", "current"] { add(&mut cache, "character", &format!("stat.{index}.{field}"), "test.value", "{}"); }
            for field in ["race", "class", "equipment"] {
                add(&mut cache, "character", &format!("__value:stat.{index}.{field}"), "", r#"{"number":{"type":"signed_integer","value":-2}}"#);
            }
        }
        let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        let Block::Table { rows, headers, .. } = &snapshot.sections[0].blocks[0] else { panic!("missing stat table") };
        assert_eq!(headers.len(), 7);
        assert_eq!(rows.len(), 5);
        assert_eq!(&rows[0][2..5], ["-2", "-2", "-2"]);
        assert_eq!(snapshot.sections[0].blocks.len(), 1);
    }
    #[test]
    fn source_menu_rows_preserve_selection_palette_and_activation_facts() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "inventory", "row.0.name", "test.object", "{}");
        add(&mut cache, "inventory", "__row:0", "", r#"{"key":{"type":"display_token","value":"a"},"selected":{"type":"boolean","value":true},"color":{"type":"integer","value":9},"activation_key":{"type":"integer","value":97}}"#);
        let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        let Block::Paragraph { text, selected, color, activation_key, .. } = &snapshot.sections[0].blocks[0] else { panic!("missing menu row") };
        assert_eq!(text, "a) ja:test.object");
        assert!(*selected);
        assert_eq!(*color, Some(9));
        assert_eq!(*activation_key, Some(97));
        let before = cache.clone();
        assert!(cache.accept(&event("inventory", "__row:0", "", r#"{"activation_key":{"type":"integer","value":55296}}"#), &Fixture, Locale::Japanese).is_err());
        assert_eq!(cache, before);
    }
    #[test]
    fn emitted_state_summary_and_boundary_are_owned_and_invalid_state_is_transactional() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "spells", "name", "test.spell", "{}");
        assert!(cache.state(r#"{"turn":51,"depth":1,"hp":7,"maxhp":10,"generated":true,"command":true,"rng":[123,456]}"#).unwrap());
        assert!(cache.scopes.is_empty());
        let before = cache.clone();
        let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        assert_eq!(snapshot.state_summary, "51/1/7/10");
        assert!(cache.state(r#"{"turn":52,"depth":1,"hp":7,"maxhp":10,"generated":true}"#).is_err());
        assert_eq!(cache, before);
        assert_eq!(cache.snapshot(&Fixture, Locale::English).unwrap().state_summary, "51/1/7/10");
        assert_eq!(cache, before);
    }
    #[test]
    fn bundled_help_page_owns_opaque_queries_without_inventing_display_prose() {
        let mut cache = PresentationCache::default();
        let params = r#"{"filename":{"type":"opaque_file_path","value":"commands.txt"},"first":{"type":"integer","value":0},"total":{"type":"integer","value":20},"page_capacity":{"type":"integer","value":16},"menu":{"type":"boolean","value":false},"case_sensitive":{"type":"boolean","value":true},"find_query":{"type":"verbatim_user_text","value":"山田 {hero}"},"highlight_query":{"type":"verbatim_user_text","value":"<spell>"}}"#;
        add(&mut cache, "help", "__help_page", "", params);
        add(&mut cache, "help", "row:0", "test.help.line", "{}");
        let before = cache.clone();
        let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        assert_eq!(snapshot.sections[0].blocks.len(), 1);
        assert!(snapshot.encode_json().unwrap().contains("山田 {hero}"));
        assert!(cache.accept(&event("help", "__help_page", "", &params.replace("commands.txt", "user-private.txt")), &Fixture, Locale::Japanese).is_err());
        assert_eq!(cache, before);
        add(&mut cache, "help", "__begin_replace", "", "{}");
        add(&mut cache, "help", "__unsupported:document", "", "{}");
        add(&mut cache, "help", "__end", "", "{}");
        assert!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().sections.is_empty());
    }
    #[test]
    fn help_highlights_and_activation_are_owned_source_rows_without_mutating_cached_queries() {
        let mut cache = PresentationCache::default();
        let params = r#"{"filename":{"type":"opaque_file_path","value":"index.txt"},"first":{"type":"integer","value":0},"total":{"type":"integer","value":20},"page_capacity":{"type":"integer","value":16},"menu":{"type":"boolean","value":true},"case_sensitive":{"type":"boolean","value":false},"find_query":{"type":"verbatim_user_text","value":""},"highlight_query":{"type":"verbatim_user_text","value":"HELP"}}"#;
        add(&mut cache, "help", "__help_page", "", params);
        add(&mut cache, "help", "row:0", "help.index.menu.commands", "{}");
        add(&mut cache, "help", "__row:0", "", r#"{"activation_key":{"type":"integer","value":97}}"#);
        add(&mut cache, "help", "row:20", "help.navigation.next_page", "{}");
        let before = cache.clone();
        let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        let Block::Paragraph { text, runs, activation_key, .. } = &snapshot.sections[0].blocks[0] else { panic!("missing help row") };
        assert_eq!(*activation_key, Some(97));
        assert_eq!(runs.iter().map(|run| run.text.as_str()).collect::<String>(), *text);
        assert_eq!(runs.iter().filter(|run| run.highlighted).map(|run| run.text.as_str()).collect::<Vec<_>>(), ["help"]);
        let Block::Paragraph { runs, .. } = &snapshot.sections[0].blocks[1] else { panic!("missing navigation row") };
        assert!(runs.is_empty());
        let english = cache.snapshot(&Fixture, Locale::English).unwrap();
        let Block::Paragraph { text, runs, .. } = &english.sections[0].blocks[0] else { panic!("missing English help row") };
        assert!(text.starts_with("en:"));
        assert_eq!(runs.iter().map(|run| run.text.as_str()).collect::<String>(), *text);
        assert_eq!(cache, before);
        assert!(snapshot.encode_json().unwrap().contains("\"highlighted\":true"));
    }
    #[test]
    fn source_action_controls_reformat_and_clear_without_changing_menu_rows() {
        let mut cache = PresentationCache::default();
        add(&mut cache, "throwing-items", "row.17.name", "test.object", "{}");
        add(&mut cache, "throwing-items", "action.equipment.label", "test.switch", "{}");
        add(&mut cache, "throwing-items", "__action:equipment", "", r#"{"activation_key":{"type":"integer","value":47}}"#);
        let before = cache.clone();
        let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        let Block::Paragraph { activation_key, .. } = &snapshot.sections[0].blocks[1] else { panic!("missing action") };
        assert_eq!(*activation_key, Some(47));
        let _ = cache.snapshot(&Fixture, Locale::English).unwrap();
        assert_eq!(cache, before);
        add(&mut cache, "throwing-items", "__clear:action.equipment", "", "{}");
        let snapshot = cache.snapshot(&Fixture, Locale::Japanese).unwrap();
        assert_eq!(snapshot.sections[0].blocks.len(), 1);
        assert_eq!(snapshot.sections[0].blocks[0], before.snapshot(&Fixture, Locale::Japanese).unwrap().sections[0].blocks[0]);
        assert!(cache.accept(&event("throwing-items", "__action:equipment", "", "{}"), &Fixture, Locale::Japanese).is_err());
    }
    #[test]
    fn finite_scope_nesting_widgets_and_cache_bytes_reject_without_mutation() {
        let mut cache = PresentationCache::default();
        for _ in 0..MAX_SCOPE_DEPTH { add(&mut cache, "help", "__begin_replace", "", "{}"); }
        let before = cache.clone();
        assert!(cache.accept(&event("help", "__begin_replace", "", "{}"), &Fixture, Locale::Japanese).is_err());
        assert_eq!(cache, before);
        cache.reset();
        let params = format!(r#"{{"text":{{"type":"verbatim_user_text","value":"{}"}}}}"#, "x".repeat(31000));
        let mut rejected = false;
        for index in 0..200 {
            let previous = cache.clone();
            if cache.accept(&event("help", &format!("__input:line.{index}"), "", &params), &Fixture, Locale::Japanese).is_err() {
                assert_eq!(cache, previous); rejected = true; break;
            }
        }
        assert!(rejected);
        assert!(cache.snapshot(&Fixture, Locale::Japanese).unwrap().encode_json().is_ok());
    }
}
