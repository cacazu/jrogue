//! Source-only help consumer preparation; it has not been compiled or connected.
//! C++ selects topics, bindings, enabled event types, and grid alternatives.
//! Rust reads owned observations and catalog-owned token programs only.
mod model;
pub use model::{BindingOrigin, BindingType, CommandAuthorization, GridCell, GridRole,
    KeyBinding, Modifier, PresentationBinding, StructuredDirectionGrid};

use cdda_logic_contract::{ParameterKind, TextEvent, TextId};
use cdda_presentation::{Catalog, Locale, TextError};
use model::*;
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
use thiserror::Error;

pub const SOURCE_COMMIT: &str = "7b2efa5cea38e4d4d97dd0e63b28b9148623da59";
pub const INTERFACE: &str = "cdda-help-observation/1";
pub const MAX_OBSERVATION_BYTES: usize = 262_144;
pub const TEXT_IDS: [&str; 14] = [
    "input.keybinding.default.up.name", "input.keybinding.pickup.up.name",
    "input.keybinding.bionics.up.name", "input.keybinding.default_mode.pause.name",
    "input.keybinding.default_mode.pickup.name", "input.keybinding.default_mode.inventory.name",
    "input.keybinding.default_mode.help.name", "help.core.movement.name",
    "help.core.movement.controls", "help.core.movement.movement_cost",
    "help.core.movement.melee", "help.core.movement.doors",
    "help.core.movement.safe_mode", "ui.help.title",
];
const BLOCK_IDS: [Option<&str>; 6] = [Some("help.core.movement.controls"), None,
    Some("help.core.movement.movement_cost"), Some("help.core.movement.melee"),
    Some("help.core.movement.doors"), Some("help.core.movement.safe_mode")];

#[derive(Debug, Error)]
pub enum HelpError {
    #[error("invalid help JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid help catalog: {0}")]
    Catalog(#[from] TextError),
    #[error("help source/build/schema identity mismatch")]
    Identity,
    #[error("help observation exceeds a checked bound")]
    Bounds,
    #[error("help observation shape or source policy mismatch")]
    Shape,
    #[error("help publication is not a canonical unsigned decimal string")]
    Publication,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CatalogInput {
    schema_version: u32,
    locale: Locale,
    entries: BTreeMap<TextId, EntryInput>,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct EntryInput {
    parameters: BTreeMap<String, ParameterKind>,
    other: String,
    #[serde(default)] one: Option<String>,
    #[serde(default)] plural_parameter: Option<String>,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum ProgramNode {
    Literal { value: String },
    KeyBinding { parameter: String, category: String, action: String, description: String,
        color: String, empty_binding_text: String },
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ProgramParameter { kind: String, category: String, action: String }
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Program { parameters: BTreeMap<String, ProgramParameter>, nodes: Vec<ProgramNode> }
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ProgramsInput {
    interface: String,
    schema_version: u32,
    source_commit: String,
    catalogs_schema: u32,
    status: String,
    locales: BTreeMap<String, BTreeMap<TextId, Program>>,
}

/// Two immutable current-schema catalogs and checked rich-text token programs.
#[derive(Debug)]
pub struct HelpCatalogs {
    en: Catalog,
    ja: Catalog,
    en_programs: BTreeMap<TextId, Program>,
    ja_programs: BTreeMap<TextId, Program>,
}
fn expected_actions(id: &str) -> &'static [&'static str] {
    match id {
        "help.core.movement.movement_cost" => &["player_data"],
        "help.core.movement.doors" => &["open", "close", "smash"],
        "help.core.movement.safe_mode" => &["safemode"],
        _ => &[],
    }
}
fn expected_ids() -> BTreeSet<&'static str> { TEXT_IDS.into_iter().collect() }
fn parse_catalog(bytes: &str, locale: Locale) -> Result<Catalog, HelpError> {
    let raw: CatalogInput = serde_json::from_str(bytes)?;
    if raw.schema_version != 1 || raw.locale != locale { return Err(HelpError::Identity); }
    if raw.entries.keys().map(TextId::as_str).collect::<BTreeSet<_>>() != expected_ids()
        || raw.entries.values().any(|entry| !entry.parameters.is_empty()
            || entry.one.is_some() || entry.plural_parameter.is_some()
            || entry.other.len() > 16_384) { return Err(HelpError::Shape); }
    Ok(Catalog::from_json(bytes)?)
}
fn validate_programs(catalog: &Catalog, programs: &BTreeMap<TextId, Program>) -> Result<(), HelpError> {
    if programs.keys().map(TextId::as_str).collect::<BTreeSet<_>>() != expected_ids() {
        return Err(HelpError::Shape);
    }
    for (id, program) in programs {
        let expected: BTreeMap<_, _> = expected_actions(id.as_str()).iter()
            .map(|action| (format!("press_{action}"), *action)).collect();
        if program.nodes.len() > 32 || program.parameters.len() != expected.len()
            || program.parameters.iter().any(|(name, parameter)|
                parameter.kind != "key_binding" || parameter.category != "DEFAULTMODE"
                || expected.get(name).is_none_or(|action| *action != parameter.action.as_str())) {
            return Err(HelpError::Shape);
        }
        let mut reconstructed = String::new();
        let mut used = BTreeSet::new();
        for node in &program.nodes {
            match node {
                ProgramNode::Literal { value } => {
                    // This parser accepts only catalog-owned, already reviewed literal text.
                    if value.len() > 16_384 || value.contains("<press_") { return Err(HelpError::Shape); }
                    reconstructed.push_str(value);
                }
                ProgramNode::KeyBinding { parameter, category, action, description, color, empty_binding_text } => {
                    if category != "DEFAULTMODE" || description != "long" || color != "light_blue"
                        || !empty_binding_text.is_empty()
                        || expected.get(parameter).is_none_or(|expected| *expected != action.as_str()) {
                        return Err(HelpError::Shape);
                    }
                    used.insert(parameter.as_str());
                    reconstructed.push_str(&format!("<press_{action}>"));
                }
            }
        }
        if used != program.parameters.keys().map(String::as_str).collect::<BTreeSet<_>>()
            || reconstructed != catalog.format(&TextEvent::plain(id.clone()))? {
            return Err(HelpError::Shape);
        }
    }
    Ok(())
}
impl HelpCatalogs {
    /// Parse source-bound en/ja with the existing real Rust Catalog parser.
    /// This source function has not yet been compiled/executed in Rust.
    pub fn from_embedded() -> Result<Self, HelpError> {
        let en = parse_catalog(include_str!("../../locales/en.json"), Locale::En)?;
        let ja = parse_catalog(include_str!("../../locales/ja.json"), Locale::Ja)?;
        let mut raw: ProgramsInput = serde_json::from_str(include_str!("../../text-programs.json"))?;
        if raw.interface != "cdda-help-rich-program/1" || raw.schema_version != 1
            || raw.catalogs_schema != 1 || raw.source_commit != SOURCE_COMMIT
            || raw.status != "source_prepared_uncompiled_unconnected" || raw.locales.len() != 2 {
            return Err(HelpError::Identity);
        }
        let en_programs = raw.locales.remove("en").ok_or(HelpError::Shape)?;
        let ja_programs = raw.locales.remove("ja").ok_or(HelpError::Shape)?;
        validate_programs(&en, &en_programs)?;
        validate_programs(&ja, &ja_programs)?;
        Ok(Self { en, ja, en_programs, ja_programs })
    }
    fn catalog(&self, locale: Locale) -> &Catalog { match locale { Locale::En => &self.en, Locale::Ja => &self.ja } }
    fn programs(&self, locale: Locale) -> &BTreeMap<TextId, Program> { match locale { Locale::En => &self.en_programs, Locale::Ja => &self.ja_programs } }
    /// Format one of the fourteen exact entries with no scalar or user-text arguments.
    pub fn format_plain(&self, id: TextId, locale: Locale) -> Result<String, HelpError> {
        if !TEXT_IDS.contains(&id.as_str()) || !expected_actions(id.as_str()).is_empty() { return Err(HelpError::Shape); }
        Ok(self.catalog(locale).format(&TextEvent::plain(id))?)
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawKeyParameter { name: String, value: RawBindingObservation }
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawText { id: TextId, key_parameters: Vec<RawKeyParameter> }
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum RawBlock { Text { text: RawText }, StructuredDirectionGrid { grid: RawGrid } }
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawEnvelope {
    interface: String,
    schema_version: u32,
    source_commit: String,
    engine_build_id: String,
    publication_sequence: String,
    available: bool,
    #[serde(default)] title: Option<RawText>,
    #[serde(default)] topic_name: Option<RawText>,
    #[serde(default)] loaded_source: Option<String>,
    #[serde(default)] loaded_file: Option<String>,
    #[serde(default)] blocks: Option<Vec<RawBlock>>,
}
#[derive(Debug, Clone, PartialEq, Eq)]
struct OwnedText { id: TextId, key_parameters: BTreeMap<String, KeyBinding> }
#[derive(Debug, Clone, PartialEq, Eq)]
enum OwnedBlock { Text(OwnedText), Grid(StructuredDirectionGrid) }
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HelpObservation {
    publication: u64,
    build_id: String,
    title: OwnedText,
    topic_name: OwnedText,
    loaded_source: String,
    loaded_file: String,
    blocks: Vec<OwnedBlock>,
}
impl HelpObservation {
    pub fn publication_sequence(&self) -> u64 { self.publication }
    pub fn build_id(&self) -> &str { &self.build_id }
    pub fn loaded_source(&self) -> &str { &self.loaded_source }
    pub fn loaded_file(&self) -> &str { &self.loaded_file }
    pub fn command_authorization(&self) -> CommandAuthorization { CommandAuthorization::Denied }
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HelpPublication { Unavailable { publication: u64 }, Available(HelpObservation) }

fn validate_binding(raw: RawPresentationBinding) -> Result<PresentationBinding, HelpError> {
    if raw.native.sequence.len() > 64 || raw.native.modifiers.len() > 3
        || raw.native.text.len() > 16_384 || raw.native.edit.len() > 16_384
        || raw.native.modifiers.windows(2).any(|pair| pair[0] >= pair[1]) {
        return Err(HelpError::Bounds);
    }
    Ok(PresentationBinding(raw))
}
fn validate_key(raw: RawBindingObservation, expected_action: &str) -> Result<KeyBinding, HelpError> {
    if raw.category != "DEFAULTMODE" || raw.action != expected_action || raw.bindings.len() > 128
        || raw.origin == BindingOrigin::Missing && !raw.bindings.is_empty() { return Err(HelpError::Shape); }
    Ok(KeyBinding { category: raw.category, action: raw.action, origin: raw.origin,
        bindings: raw.bindings.into_iter().map(validate_binding).collect::<Result<_, _>>()? })
}
fn validate_text(raw: RawText, expected_id: &str) -> Result<OwnedText, HelpError> {
    if raw.id.as_str() != expected_id || raw.key_parameters.len() != expected_actions(expected_id).len() { return Err(HelpError::Shape); }
    let expected: BTreeMap<_, _> = expected_actions(expected_id).iter().map(|action| (format!("press_{action}"), *action)).collect();
    let mut keys = BTreeMap::new();
    for parameter in raw.key_parameters {
        let action = expected.get(&parameter.name).ok_or(HelpError::Shape)?;
        let binding = validate_key(parameter.value, action)?;
        if keys.insert(parameter.name, binding).is_some() { return Err(HelpError::Shape); }
    }
    Ok(OwnedText { id: raw.id, key_parameters: keys })
}
fn validate_grid(raw: RawGrid) -> Result<StructuredDirectionGrid, HelpError> {
    if raw.category != "DEFAULTMODE" { return Err(HelpError::Shape); }
    let mut cells = Vec::with_capacity(9);
    for (index, cell) in raw.cells.into_iter().enumerate() {
        if cell.role != GridRole::ORDERED[index] || cell.action != cell.role.action()
            || usize::from(cell.row) != index / 3 || usize::from(cell.column) != index % 3
            || cell.alternatives[0].is_none() && cell.alternatives[1].is_some() { return Err(HelpError::Shape); }
        let mut alternatives = [None, None];
        for (slot, binding) in cell.alternatives.into_iter().enumerate() {
            if let Some(raw) = binding {
                let binding = validate_binding(raw)?;
                if !matches!(binding.event_type(), BindingType::KeyboardChar | BindingType::KeyboardCode)
                    || !binding.enabled_for_presentation() || !binding.single_printable()
                    || binding.sequence().len() != 1 || !binding.modifiers().is_empty()
                    || binding.sequence().first().is_none_or(|code| *code < 0 || *code >= 255 || *code == 32) {
                    return Err(HelpError::Shape);
                }
                alternatives[slot] = Some(binding);
            }
        }
        cells.push(GridCell { role: cell.role, action: cell.action, row: cell.row, column: cell.column, alternatives });
    }
    Ok(StructuredDirectionGrid { cells })
}
fn parse_publication(value: &str) -> Result<u64, HelpError> {
    if value.is_empty() || value.len() > 20 || value.bytes().any(|byte| !byte.is_ascii_digit())
        || value.len() > 1 && value.starts_with('0') { return Err(HelpError::Publication); }
    value.parse().map_err(|_| HelpError::Publication)
}

/// Read copied UTF-8 JSON for one exact integration build; original memory is never borrowed.
/// Transport serialization/pin exports and real-engine invocation remain unimplemented.
pub fn parse_owned_help(bytes: &[u8], expected_build_id: &str) -> Result<HelpPublication, HelpError> {
    if bytes.is_empty() || bytes.len() > MAX_OBSERVATION_BYTES { return Err(HelpError::Bounds); }
    let raw: RawEnvelope = serde_json::from_slice(bytes)?;
    if expected_build_id.is_empty() || expected_build_id.len() > 16_384 || raw.interface != INTERFACE
        || raw.schema_version != 1 || raw.source_commit != SOURCE_COMMIT
        || raw.engine_build_id != expected_build_id { return Err(HelpError::Identity); }
    let publication = parse_publication(&raw.publication_sequence)?;
    if !raw.available {
        if raw.title.is_some() || raw.topic_name.is_some() || raw.loaded_source.is_some()
            || raw.loaded_file.is_some() || raw.blocks.is_some() { return Err(HelpError::Shape); }
        return Ok(HelpPublication::Unavailable { publication });
    }
    if publication == 0 { return Err(HelpError::Publication); }
    let title = validate_text(raw.title.ok_or(HelpError::Shape)?, "ui.help.title")?;
    let topic_name = validate_text(raw.topic_name.ok_or(HelpError::Shape)?, "help.core.movement.name")?;
    let loaded_source = raw.loaded_source.ok_or(HelpError::Shape)?;
    let loaded_file = raw.loaded_file.ok_or(HelpError::Shape)?;
    if loaded_source.len() > 16_384 || loaded_file.len() > 16_384 { return Err(HelpError::Bounds); }
    let raw_blocks = raw.blocks.ok_or(HelpError::Shape)?;
    if raw_blocks.len() != 6 { return Err(HelpError::Shape); }
    let mut blocks = Vec::with_capacity(6);
    for (expected, block) in BLOCK_IDS.into_iter().zip(raw_blocks) {
        blocks.push(match (expected, block) {
            (Some(id), RawBlock::Text { text }) => OwnedBlock::Text(validate_text(text, id)?),
            (None, RawBlock::StructuredDirectionGrid { grid }) => OwnedBlock::Grid(validate_grid(grid)?),
            _ => return Err(HelpError::Shape),
        });
    }
    Ok(HelpPublication::Available(HelpObservation { publication, build_id: raw.engine_build_id,
        title, topic_name, loaded_source, loaded_file, blocks }))
}

/// A typed pending key-name node; no event sequence is turned into a gameplay command.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RenderedPart {
    Text(String),
    KeyBinding { parameter: String, value: KeyBinding, description: KeyDescription, color: HelpColor },
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyDescription { Long, Short }
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HelpColor { LightBlue, Red }
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RenderedBlock { Paragraph(Vec<RenderedPart>), DirectionGrid(StructuredDirectionGrid) }
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderedHelp {
    pub title: String,
    pub topic_name: String,
    pub blocks: Vec<RenderedBlock>,
    pub key_name_renderer_pending: bool,
}
fn render_text(text: &OwnedText, locale: Locale, catalogs: &HelpCatalogs) -> Result<Vec<RenderedPart>, HelpError> {
    let program = catalogs.programs(locale).get(&text.id).ok_or(HelpError::Shape)?;
    let mut parts = Vec::with_capacity(program.nodes.len());
    for node in &program.nodes {
        parts.push(match node {
            ProgramNode::Literal { value } => RenderedPart::Text(value.clone()),
            ProgramNode::KeyBinding { parameter, .. } => {
                let mut value = text.key_parameters.get(parameter).ok_or(HelpError::Shape)?.clone();
                // Original press_x keeps all enabled event types and original ordering.
                value.bindings.retain(PresentationBinding::enabled_for_presentation);
                RenderedPart::KeyBinding { parameter: parameter.clone(), value,
                    description: KeyDescription::Long, color: HelpColor::LightBlue }
            }
        });
    }
    Ok(parts)
}
/// Format prose from an immutable observation. Key glyph/name rendering remains pending.
/// There is no simulation, RNG, native input, clock, storage, or engine handle here.
pub fn render_help(observation: &HelpObservation, locale: Locale, catalogs: &HelpCatalogs) -> Result<RenderedHelp, HelpError> {
    let blocks = observation.blocks.iter().map(|block| match block {
        OwnedBlock::Text(text) => Ok(RenderedBlock::Paragraph(render_text(text, locale, catalogs)?)),
        OwnedBlock::Grid(grid) => Ok(RenderedBlock::DirectionGrid(grid.clone())),
    }).collect::<Result<_, HelpError>>()?;
    Ok(RenderedHelp { title: catalogs.format_plain(observation.title.id.clone(), locale)?,
        topic_name: catalogs.format_plain(observation.topic_name.id.clone(), locale)?,
        blocks, key_name_renderer_pending: true })
}
