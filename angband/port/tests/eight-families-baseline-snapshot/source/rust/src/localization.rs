//! Source integration of reviewed EN/JA templates and owned typed captures.
//! Catalog availability is not a claim that every source hook or descriptor
//! grammar is integrated, tested, or present in the current accepted WASM.

pub(crate) mod json;

use crate::text::{Locale, parse_flat_json};
use crate::text_parameters::{CompiledTemplate, DescriptorKind as D, DescriptorReference as R,
    DiggingMethod, DynamicTemplateCatalog, DynamicTextId, FeelingConjunction, FormatError, GoldPickupReference, Parameter,
    ParameterKind as K, ParameterSpec, ParameterValue, ResolvedDescriptor, MAX_PARAMETERS,
    MAX_VALUE_BYTES};
use json::{JsonValue as J, Limits};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::ffi::c_char;
use std::fmt;

pub const REVIEW_EN_JSON: &str = include_str!("../../locales/review-en.json");
pub const REVIEW_JA_JSON: &str = include_str!("../../locales/review-ja.json");
pub const REVIEW_SCHEMA_JSON: &str = include_str!("../../locales/review-schema.json");
pub const MAX_EVENT_BYTES: usize = 128 * 1024;
const MAX_CATALOG_BYTES: usize = 8 * 1024 * 1024;
const MAX_RECURSION: usize = 8;
const EVENT_LIMITS: Limits = Limits { max_bytes: MAX_EVENT_BYTES, max_depth: 32, max_nodes: 8192, max_string_bytes: MAX_VALUE_BYTES };
const SCHEMA_LIMITS: Limits = Limits { max_bytes: MAX_CATALOG_BYTES, max_depth: 32, max_nodes: 300_000, max_string_bytes: 32768 };

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ReviewError {
    Format(FormatError), Json(String), Catalog(String), UnsupportedType(String),
    InvalidCapture(String), InvalidBuffer, InvalidUtf8, EmbeddedNul, RecursionLimit,
}
impl fmt::Display for ReviewError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Format(error) => error.fmt(f), Self::Json(error) => write!(f, "invalid semantic JSON: {error}"),
            Self::Catalog(error) => write!(f, "invalid reviewed catalog: {error}"),
            Self::UnsupportedType(kind) => write!(f, "reviewed descriptor integration unavailable: {kind}"),
            Self::InvalidCapture(error) => write!(f, "invalid typed capture: {error}"),
            Self::InvalidBuffer => f.write_str("invalid foreign span/pointer/alignment"),
            Self::InvalidUtf8 => f.write_str("foreign span is not valid UTF-8"),
            Self::EmbeddedNul => f.write_str("embedded NUL is not permitted in C text"),
            Self::RecursionLimit => f.write_str("semantic reference recursion exceeds 8"),
        }
    }
}
impl std::error::Error for ReviewError {}
impl From<FormatError> for ReviewError { fn from(error: FormatError) -> Self { Self::Format(error) } }
impl ReviewError {
    pub fn status(&self) -> u32 {
        match self {
            Self::Format(error) => match error {
                FormatError::UnknownId(_) => 1, FormatError::InvalidName(_) => 2,
                FormatError::DuplicateSchema(_) => 3, FormatError::UnknownPlaceholder(_) => 4,
                FormatError::MissingPlaceholder(_) => 5, FormatError::MalformedTemplate { .. } => 6,
                FormatError::MissingParameter(_) => 7, FormatError::UnexpectedParameter(_) => 8,
                FormatError::DuplicateParameter(_) => 9, FormatError::WrongType { .. } => 10,
                FormatError::IntegerOutOfRange { .. } => 11, FormatError::DescriptorUnavailable(_) => 12,
                FormatError::DescriptorLocale { .. } => 13, FormatError::TooManyParameters => 14,
                FormatError::TooManyPlaceholderUses => 15, FormatError::TemplateTooLong => 16,
                FormatError::ValueTooLong(_) => 17, FormatError::OutputTooLong => 18,
            },
            Self::InvalidBuffer => 19, Self::InvalidUtf8 => 20, Self::EmbeddedNul => 21,
            Self::Catalog(_) => 24, Self::Json(_) => 25, Self::UnsupportedType(_) => 26,
            Self::InvalidCapture(_) => 27, Self::RecursionLimit => 28,
        }
    }
}

#[derive(Clone, Debug)]
struct OwnedSpec { name: String, canonical_type: String, kind: K }
#[derive(Clone, Debug)]
struct Entry { english: String, japanese: String, parameters: Vec<OwnedSpec>, index: u32, native_output_max_bytes: Option<usize> }
#[derive(Clone, Debug)]
pub struct ReviewCatalog { entries: BTreeMap<String, Entry> }
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Coverage { pub templates: usize, pub static_templates: usize, pub primitive_templates: usize, pub descriptor_templates: usize }

fn parameter_kind(kind: &str) -> K {
    match kind {
        "integer" => K::Integer, "int32" => K::Integer32, "signed_integer" => K::SignedInteger,
        "decimal_one_place" => K::DecimalOnePlace,
        "character_name" | "verbatim_user_text" | "canonical_identity" | "display_token" |
        "opaque_file_path" | "opaque_build_identity" | "opaque_calendar_date" | "opaque_parser_token" | "numeric_expression" | "canonical_key" => K::Text,
        "localized_text" => K::Descriptor(D::LocalizedText),
        "localized_text_list" => K::Descriptor(D::LocalizedTextList),
        "ApparentTerrain" => K::Descriptor(D::ApparentTerrain),
        "TerrainDiagnosticReference" => K::Descriptor(D::TerrainDiagnosticReference),
        "TrapName" => K::Descriptor(D::TrapName), "MonsterDescription" => K::Descriptor(D::MonsterDescription),
        "CapitalizedMonsterDescription" => K::Descriptor(D::CapitalizedMonsterDescription),
        "KnownObjectDescription" => K::Descriptor(D::KnownObjectDescription),
        "MonsterAggregateSubject" => K::Descriptor(D::MonsterAggregateSubject),
        "DomainCustomVerbSuffix" => K::Descriptor(D::DomainCustomVerbSuffix),
        "DomainCustomCopula" => K::Descriptor(D::DomainCustomCopula),
        "KnowledgeSection" => K::Descriptor(D::KnowledgeSection),
        "EffectDescription" => K::Descriptor(D::EffectDescription),
        "GeneratedHistory" => K::Descriptor(D::GeneratedHistory),
        "MoneyKindName" => K::Descriptor(D::MoneyKindName), "DiggingMethod" => K::Descriptor(D::DiggingMethod),
        "ObjectFeeling" => K::Descriptor(D::ObjectFeeling), "MonsterFeeling" => K::Descriptor(D::MonsterFeeling),
        "FeelingConjunction" => K::Descriptor(D::FeelingConjunction), "GoldPickupMessage" => K::Descriptor(D::GoldPickupMessage),
        _ => K::Descriptor(D::UnsupportedReviewedType),
    }
}
fn object(value: &J) -> Result<&[(String, J)], ReviewError> { value.as_object().ok_or_else(|| ReviewError::InvalidCapture("expected object".into())) }
fn fields(value: &J, allowed: &[&str]) -> Result<(), ReviewError> {
    for (name, _) in object(value)? {
        if !allowed.contains(&name.as_str()) { return Err(ReviewError::InvalidCapture(format!("unexpected field {name}"))); }
    }
    Ok(())
}
fn required<'a>(value: &'a J, name: &str) -> Result<&'a J, ReviewError> {
    value.field(name).ok_or_else(|| ReviewError::InvalidCapture(format!("missing field {name}")))
}
fn string<'a>(value: &'a J, field: &str) -> Result<&'a str, ReviewError> {
    value.as_str().ok_or_else(|| ReviewError::InvalidCapture(format!("{field} requires UTF-8 string")))
}
fn integer(value: &J, field: &str) -> Result<i64, ReviewError> {
    value.as_integer().ok_or_else(|| ReviewError::InvalidCapture(format!("{field} requires integer")))
}
fn int32(value: &J, field: &str) -> Result<i32, ReviewError> {
    let value = integer(value, field)?;
    i32::try_from(value).map_err(|_| FormatError::IntegerOutOfRange { name: field.to_owned(), value }.into())
}
fn checked_string(value: &str) -> Result<(), ReviewError> {
    if value.contains('\0') { return Err(ReviewError::EmbeddedNul); }
    if value.len() > MAX_VALUE_BYTES { return Err(FormatError::ValueTooLong("capture".into()).into()); }
    Ok(())
}
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 127 && id.as_bytes().iter().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

impl ReviewCatalog {
    pub fn embedded() -> Result<Self, ReviewError> { Self::from_json(REVIEW_EN_JSON, REVIEW_JA_JSON, REVIEW_SCHEMA_JSON) }
    pub fn from_json(en: &str, ja: &str, schema: &str) -> Result<Self, ReviewError> {
        fn flat(json: &str) -> Result<BTreeMap<String, String>, ReviewError> {
            if json.len() > MAX_CATALOG_BYTES { return Err(ReviewError::Catalog("flat catalog byte limit".into())); }
            let mut output = BTreeMap::new();
            for (id, text) in parse_flat_json(json).map_err(|error| ReviewError::Catalog(error.to_string()))? {
                if !valid_id(&id) { return Err(ReviewError::Catalog(format!("invalid ID {id}"))); }
                checked_string(&text)?;
                if output.insert(id.clone(), text).is_some() { return Err(ReviewError::Catalog(format!("duplicate ID {id}"))); }
            }
            Ok(output)
        }
        let mut english = flat(en)?;
        let mut japanese = flat(ja)?;
        if english.keys().ne(japanese.keys()) { return Err(ReviewError::Catalog("English/Japanese key mismatch".into())); }
        let schema = json::parse(schema, SCHEMA_LIMITS).map_err(|error| ReviewError::Catalog(error.to_string()))?;
        if schema.field("schema_version").and_then(J::as_integer) != Some(1) { return Err(ReviewError::Catalog("unsupported schema version".into())); }
        let records = schema.field("entries").and_then(J::as_object).ok_or_else(|| ReviewError::Catalog("entries object missing".into()))?;
        if records.is_empty() || records.len() > 8192 { return Err(ReviewError::Catalog("entry count limit".into())); }
        if records.len() != english.len() { return Err(ReviewError::Catalog("schema/template key mismatch".into())); }
        let mut entries = BTreeMap::new();
        for (id, record) in records {
            let en = english.remove(id).ok_or_else(|| ReviewError::Catalog(format!("missing English ID {id}")))?;
            let ja = japanese.remove(id).ok_or_else(|| ReviewError::Catalog(format!("missing Japanese ID {id}")))?;
            let specs = record.field("parameters").and_then(J::as_array).ok_or_else(|| ReviewError::Catalog(format!("missing parameters {id}")))?;
            if specs.len() > MAX_PARAMETERS { return Err(FormatError::TooManyParameters.into()); }
            let mut parameters = Vec::new();
            for spec in specs {
                let name = string(required(spec, "name")?, "name")?.to_owned();
                let canonical_type = string(required(spec, "type")?, "type")?.to_owned();
                let kind = match (id.as_str(), name.as_str()) {
                    ("player.stat.notation.above_18", "bonus") | ("player.stat.notation.above_100", "bonus") => {
                        if canonical_type != "integer" { return Err(ReviewError::Catalog(format!("stat notation requires integer fact for {id}"))); }
                        if id == "player.stat.notation.above_18" { K::IntegerPadded2 } else { K::IntegerPadded3 }
                    }
                    _ => parameter_kind(&canonical_type),
                };
                parameters.push(OwnedSpec { name, kind, canonical_type });
            }
            if let Ok(dynamic) = DynamicTextId::parse(id) {
                let expected = dynamic.schema();
                if expected.len() != parameters.len() || expected.iter().zip(&parameters).any(|(expected, actual)| expected.name != actual.name || expected.kind != actual.kind) {
                    return Err(ReviewError::Catalog(format!("canonical typed schema changed for {id}")));
                }
            }
            let native_output_max_bytes = match (id.as_str(), record.field("native_output_max_bytes")) {
                ("ui.residual.note.say" | "ui.residual.note.action" | "ui.residual.note.plain", Some(value)) if value.as_integer() == Some(86) => Some(86),
                ("ui.residual.note.say" | "ui.residual.note.action" | "ui.residual.note.plain", _) => return Err(ReviewError::Catalog("note requires exact source display budget 90-1-3".into())),
                (_, None) => None,
                (_, Some(_)) => return Err(ReviewError::Catalog("display budget outside source note contract".into())),
            };
            let borrowed: Vec<_> = parameters.iter().map(|spec| ParameterSpec { name: &spec.name, kind: spec.kind }).collect();
            CompiledTemplate::compile(&en, &borrowed)?;
            CompiledTemplate::compile(&ja, &borrowed)?;
            let index = u32::try_from(entries.len()).map_err(|_| ReviewError::Catalog("index overflow".into()))?;
            if entries.insert(id.clone(), Entry { english: en, japanese: ja, parameters, index, native_output_max_bytes }).is_some() {
                return Err(ReviewError::Catalog(format!("duplicate schema ID {id}")));
            }
        }
        Ok(Self { entries })
    }
    pub fn coverage(&self) -> Coverage {
        let mut coverage = Coverage { templates: self.entries.len(), ..Coverage::default() };
        for entry in self.entries.values() {
            if entry.parameters.is_empty() { coverage.static_templates += 1; }
            else if entry.parameters.iter().any(|spec| matches!(spec.kind, K::Descriptor(_))) { coverage.descriptor_templates += 1; }
            else { coverage.primitive_templates += 1; }
        }
        coverage
    }
    fn entry(&self, id: &str) -> Result<&Entry, ReviewError> {
        self.entries.get(id).ok_or_else(|| FormatError::UnknownId(id.to_owned()).into())
    }
    pub fn static_message(&self, locale: Locale, id: &str) -> Result<String, ReviewError> {
        self.format_node(locale, id, &[], 0)
    }
    pub fn event(&self, locale: Locale, json: &str) -> Result<String, ReviewError> {
        let event = json::parse(json, EVENT_LIMITS).map_err(|error| ReviewError::Json(error.to_string()))?;
        fields(&event, &["schema_version", "id", "params", "channel", "context", "widget", "severity", "sound"])?;
        if required(&event, "schema_version")?.as_integer() != Some(1) { return Err(ReviewError::InvalidCapture("unsupported event schema".into())); }
        if let Some(channel) = event.field("channel") {
            if !matches!(channel.as_str(), Some("message" | "ui")) { return Err(ReviewError::InvalidCapture("invalid channel".into())); }
        }
        for name in ["context", "widget"] {
            if let Some(value) = event.field(name) { let value = string(value, name)?; if value.len() > 127 { return Err(ReviewError::InvalidCapture(format!("{name} too long"))); } checked_string(value)?; }
        }
        for name in ["severity", "sound"] { if let Some(value) = event.field(name) { int32(value, name)?; } }
        let id = string(required(&event, "id")?, "id")?;
        if !valid_id(id) { return Err(FormatError::UnknownId(id.to_owned()).into()); }
        self.format_node(locale, id, object(required(&event, "params")?)?, 0)
    }
    fn format_node(&self, locale: Locale, id: &str, arguments: &[(String, J)], depth: usize) -> Result<String, ReviewError> {
        if depth > MAX_RECURSION { return Err(ReviewError::RecursionLimit); }
        if arguments.len() > MAX_PARAMETERS { return Err(FormatError::TooManyParameters.into()); }
        let entry = self.entry(id)?;
        for (name, _) in arguments { if !entry.parameters.iter().any(|spec| &spec.name == name) { return Err(FormatError::UnexpectedParameter(name.clone()).into()); } }
        let mut resolved = Vec::new();
        for spec in &entry.parameters {
            let capture = arguments.iter().find(|(name, _)| name == &spec.name)
                .ok_or_else(|| FormatError::MissingParameter(spec.name.clone()))?.1.clone();
            resolved.push(self.resolve(locale, id, spec, &capture, depth + 1)?);
        }
        let schema: Vec<_> = entry.parameters.iter().map(|spec| ParameterSpec { name: &spec.name, kind: spec.kind }).collect();
        let values: Vec<_> = entry.parameters.iter().zip(&resolved).map(|(spec, value)| Parameter {
            name: &spec.name,
            value: match value {
                ResolvedValue::Text(value) => ParameterValue::Text(value),
                ResolvedValue::Integer(value) => ParameterValue::Integer(*value),
                ResolvedValue::Descriptor(reference, value) => ParameterValue::Descriptor(ResolvedDescriptor::from_catalog(*reference, locale, value)),
            },
        }).collect();
        let template = match locale { Locale::English => &entry.english, Locale::Japanese => &entry.japanese };
        let mut output = CompiledTemplate::compile(template, &schema)?.format(locale, &values)?;
        if let Some(maximum) = entry.native_output_max_bytes {
            let mut end = maximum.min(output.len());
            while !output.is_char_boundary(end) { end -= 1; }
            output.truncate(end);
        }
        if output.contains('\0') { return Err(ReviewError::EmbeddedNul); }
        Ok(output)
    }
    fn reference(&self, locale: Locale, value: &J, depth: usize) -> Result<(u32, String), ReviewError> {
        match value {
            J::String(id) => Ok((self.entry(id)?.index, self.static_message(locale, id)?)),
            J::Object(_) => {
                fields(value, &["id", "params"])?;
                let id = string(required(value, "id")?, "id")?;
                let args = match value.field("params") { Some(args) => object(args)?, None => &[] };
                Ok((self.entry(id)?.index, self.format_node(locale, id, args, depth)?))
            }
            _ => Err(ReviewError::InvalidCapture("localized text requires semantic ID reference".into())),
        }
    }
    fn resolve(&self, locale: Locale, id: &str, spec: &OwnedSpec, capture: &J, depth: usize) -> Result<ResolvedValue, ReviewError> {
        fields(capture, &["type", "value", "origin"])?;
        let wire = string(required(capture, "type")?, "type")?;
        let value = required(capture, "value")?;
        let expected = spec.canonical_type.as_str();
        let compatible = wire == expected || match expected {
            "integer" | "signed_integer" => matches!(wire, "int32" | "integer"),
            "character_name" | "verbatim_user_text" | "canonical_identity" | "opaque_file_path" | "opaque_build_identity" | "opaque_calendar_date" | "opaque_parser_token" => wire == "opaque_text",
            "localized_text" => wire == "text_id", "localized_text_list" => wire == "text_id_list",
            _ => false,
        };
        if !compatible { return Err(ReviewError::InvalidCapture(format!("{} requires {expected}, received {wire}", spec.name))); }
        if let Some(origin) = capture.field("origin") {
            if expected != "verbatim_user_text" || origin.as_str() != Some("user") { return Err(ReviewError::UnsupportedType("generated/unknown history provenance".into())); }
        }
        match expected {
            "int32" => Ok(ResolvedValue::Integer(i64::from(int32(value, &spec.name)?))),
            "integer" | "signed_integer" | "decimal_one_place" => {
                let number = integer(value, &spec.name)?;
                if wire == "int32" { int32(value, &spec.name)?; }
                Ok(ResolvedValue::Integer(number))
            }
            "character_name" | "verbatim_user_text" | "canonical_identity" | "display_token" |
            "opaque_file_path" | "opaque_build_identity" | "opaque_calendar_date" | "opaque_parser_token" | "numeric_expression" | "canonical_key" => {
                let text = string(value, &spec.name)?;
                checked_string(text)?;
                if expected == "opaque_parser_token" && text.len() > 1023 {
                    return Err(ReviewError::InvalidCapture("parser token exceeds original bounded field".into()));
                }
                if expected == "canonical_key" && !(text.len() == 1 && text.as_bytes()[0].is_ascii() && (32..=126).contains(&text.as_bytes()[0])) {
                    return Err(ReviewError::InvalidCapture("canonical key requires one original printable ASCII byte".into()));
                }
                if expected == "opaque_calendar_date" && (text.is_empty() || text.len() > 32 || !text.bytes().all(|byte| (32..=126).contains(&byte))) {
                    return Err(ReviewError::InvalidCapture("calendar date requires bounded original printable ASCII".into()));
                }
                if expected == "numeric_expression" && (text.is_empty() || text.len() > 64 || !text.bytes().all(|byte| byte.is_ascii_digit() || matches!(byte, b'd' | b'D' | b'+' | b'-' | b'(' | b')' | b' '))) {
                    return Err(ReviewError::InvalidCapture("unreviewed numeric-expression syntax".into()));
                }
                if expected == "canonical_identity" && (text.is_empty() || text.len() > 127 || !text.as_bytes().iter().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))) {
                    return Err(ReviewError::InvalidCapture("invalid canonical parser identity".into()));
                }
                if expected == "display_token" && !(matches!(text, "?" | "*" | "$") || text.parse::<u8>().is_ok_and(|n| n <= 10 && text == n.to_string())) {
                    return Err(ReviewError::InvalidCapture("unreviewed display token".into()));
                }
                Ok(ResolvedValue::Text(text.to_owned()))
            }
            "localized_text" => { let (catalog_index, text) = self.reference(locale, value, depth)?; Ok(ResolvedValue::Descriptor(R::ReviewedCatalog { catalog_index }, text)) }
            "localized_text_list" => self.list(locale, id, value, depth),
            "DiggingMethod" => {
                let (method, key) = match string(value, "DiggingMethod")? {
                    "hands" => (DiggingMethod::Hands, "game.dig.method.hands"),
                    "weapon" => (DiggingMethod::Weapon, "game.dig.method.weapon"),
                    "swap_digger" => (DiggingMethod::SwapDigger, "game.dig.method.swap_digger"),
                    _ => return Err(ReviewError::InvalidCapture("unknown digging method".into())),
                };
                Ok(ResolvedValue::Descriptor(R::DiggingMethod(method), self.static_message(locale, key)?))
            }
            "ApparentTerrain" | "TrapName" | "MoneyKindName" => {
                fields(value, &["name_id"])?;
                let name = string(required(value, "name_id")?, "name_id")?;
                let prefix = match expected { "ApparentTerrain" => "terrain.", "TrapName" => "trap.label.", _ => "money." };
                if !name.starts_with(prefix) || (expected != "TrapName" && !name.ends_with(".name")) { return Err(ReviewError::InvalidCapture(format!("wrong {expected} catalog family"))); }
                let entry = self.entry(name)?;
                let reference = match expected { "ApparentTerrain" => R::ApparentTerrain { apparent_feature_id: entry.index }, "TrapName" => R::TrapName { kind_id: entry.index }, _ => R::MoneyKindName { kind_id: entry.index } };
                Ok(ResolvedValue::Descriptor(reference, self.static_message(locale, name)?))
            }
            "TerrainDiagnosticReference" => {
                fields(value, &["name_id", "terrain_index"])?;
                let (reference, text) = if let Some(index) = value.field("terrain_index") {
                    if value.field("name_id").is_some() { return Err(ReviewError::InvalidCapture("diagnostic terrain variants overlap".into())); }
                    let index = int32(index, "terrain_index")?;
                    let args = vec![("terrain_index".into(), typed_integer(index))];
                    (R::TerrainDiagnosticIndex { terrain_index: index }, self.format_node(locale, "game.terrain.diagnostic.index", &args, depth)?)
                } else {
                    let name = string(required(value, "name_id")?, "name_id")?;
                    if !name.starts_with("terrain.") || !name.ends_with(".name") { return Err(ReviewError::InvalidCapture("wrong diagnostic terrain family".into())); }
                    (R::TerrainDiagnosticNamed { actual_feature_id: self.entry(name)?.index }, self.static_message(locale, name)?)
                };
                Ok(ResolvedValue::Descriptor(reference, text))
            }
            "ObjectFeeling" | "MonsterFeeling" => self.feeling(locale, id, expected, value),
            "FeelingConjunction" => {
                let (conjunction, key) = match string(value, "FeelingConjunction")? { "and" => (FeelingConjunction::And, "game.level.feeling.join.and"), "yet" => (FeelingConjunction::Yet, "game.level.feeling.join.yet"), _ => return Err(ReviewError::InvalidCapture("unknown feeling conjunction".into())) };
                Ok(ResolvedValue::Descriptor(R::FeelingConjunction(conjunction), self.static_message(locale, key)?))
            }
            "GoldPickupMessage" => self.gold(locale, value, depth),
            "GeneratedHistory" => self.generated_history(locale, value),
            "MonsterAggregateSubject" => self.monster_aggregate(locale, value),
            "DomainCustomVerbSuffix" | "DomainCustomCopula" => self.domain_custom_grammar(locale, expected, value),
            "KnowledgeSection" => self.knowledge_section(locale, value, depth),
            "EffectDescription" => self.effect_description(locale, value),
            "CapitalizedMonsterDescription" => self.capitalized_monster(locale, value),
            "MonsterDescription" | "KnownObjectDescription" => self.naming(locale, expected, value),
            _ => Err(ReviewError::UnsupportedType(expected.into())),
        }
    }
    fn effect_description(&self, locale: Locale, value: &J) -> Result<ResolvedValue, ReviewError> {
        use crate::effect_description::{EffectDescription, EffectDescriptionError};
        let descriptor = EffectDescription::from_value(value)
            .map_err(|error| ReviewError::InvalidCapture(error.to_string()))?;
        let count = required(value, "parts")?.as_array()
            .ok_or_else(|| ReviewError::InvalidCapture("effect requires ordered parts".into()))?.len();
        let part_count = u16::try_from(count).map_err(|_| ReviewError::InvalidCapture("effect part count".into()))?;
        let text = descriptor.render(locale, &mut |id, parameters| {
            self.effect_reference(locale, id, parameters)
                .map_err(|error| EffectDescriptionError::Resolver(error.to_string()))
        }).map_err(|error| ReviewError::InvalidCapture(error.to_string()))?;
        Ok(ResolvedValue::Descriptor(R::EffectDescription { part_count }, text))
    }
    fn effect_reference(&self, locale: Locale, id: &str,
        arguments: &BTreeMap<String, crate::effect_description::ResolvedEffectParameter>) -> Result<String, ReviewError> {
        use crate::effect_description::ResolvedEffectParameter as E;
        let entry = self.entry(id)?;
        for name in arguments.keys() {
            if !entry.parameters.iter().any(|spec| &spec.name == name) {
                return Err(FormatError::UnexpectedParameter(name.clone()).into());
            }
        }
        let mut resolved = Vec::with_capacity(entry.parameters.len());
        for spec in &entry.parameters {
            let value = arguments.get(&spec.name).ok_or_else(|| FormatError::MissingParameter(spec.name.clone()))?;
            if value.source_type() != spec.canonical_type {
                return Err(ReviewError::InvalidCapture(format!("{} requires {}, received {}",spec.name,spec.canonical_type,value.source_type())));
            }
            resolved.push(match value {
                E::Integer(number) => ResolvedValue::Integer(i64::from(*number)),
                // The strict owned effect graph has already resolved these
                // child references. Preserve their text as a typed value;
                // never interpret it as an ID or re-scan template braces.
                E::LocalizedText(text) => {
                    checked_string(text)?;
                    ResolvedValue::Descriptor(R::ReviewedCatalog { catalog_index: entry.index }, text.clone())
                }
                E::EffectDescription(text) => {
                    checked_string(text)?;
                    ResolvedValue::Descriptor(R::EffectDescription { part_count: 0 }, text.clone())
                }
            });
        }
        let schema: Vec<_> = entry.parameters.iter().map(|spec| ParameterSpec {name:&spec.name,kind:spec.kind}).collect();
        let values: Vec<_> = entry.parameters.iter().zip(&resolved).map(|(spec,value)| Parameter {
            name:&spec.name, value:match value {
                ResolvedValue::Integer(number) => ParameterValue::Integer(*number),
                ResolvedValue::Descriptor(reference,text) => ParameterValue::Descriptor(ResolvedDescriptor::from_catalog(*reference,locale,text)),
                ResolvedValue::Text(text) => ParameterValue::Text(text),
            },
        }).collect();
        let template = match locale {Locale::English=>&entry.english,Locale::Japanese=>&entry.japanese};
        let text = CompiledTemplate::compile(template,&schema)?.format(locale,&values)?;
        if text.contains('\0') {return Err(ReviewError::EmbeddedNul);}
        Ok(text)
    }
    fn capitalized_monster(&self, locale: Locale, value: &J) -> Result<ResolvedValue, ReviewError> {
        fields(value, &["schema_version", "subject", "capitalize"])?;
        if required(value, "schema_version")?.as_integer() != Some(2) || required(value, "capitalize")?.as_bool() != Some(true) {
            return Err(ReviewError::InvalidCapture("source capitalization requires v2 and true".into()));
        }
        let ResolvedValue::Descriptor(_, mut text) = self.naming(locale, "MonsterDescription", required(value, "subject")?)? else {
            return Err(ReviewError::InvalidCapture("capitalization requires owned monster subject".into()));
        };
        // Mirror the selected native my_strcap consumer after description.
        // ASCII case is source grammar; UTF-8 and Japanese scalars are intact.
        if let Some(first) = text.as_bytes().first().copied().filter(u8::is_ascii_lowercase) {
            text.replace_range(0..1, &(first as char).to_ascii_uppercase().to_string());
        }
        Ok(ResolvedValue::Descriptor(R::CapitalizedMonsterDescription { snapshot_id: 0 }, text))
    }
    fn knowledge_section(&self, locale: Locale, value: &J, depth: usize) -> Result<ResolvedValue, ReviewError> {
        use crate::knowledge_text::{KnowledgeTextError, ReviewedKnowledgeCatalog};
        let parts = required(value, "ordered_parts")?.as_array()
            .ok_or_else(|| ReviewError::InvalidCapture("knowledge requires ordered parts".into()))?;
        let part_count = u16::try_from(parts.len()).map_err(|_| ReviewError::InvalidCapture("knowledge part count".into()))?;
        thread_local! { static KNOWLEDGE: Result<ReviewedKnowledgeCatalog, KnowledgeTextError> = ReviewedKnowledgeCatalog::embedded(); }
        let text = KNOWLEDGE.with(|catalog| {
            let catalog = catalog.as_ref().map_err(|error| ReviewError::Catalog(error.to_string()))?;
            catalog.render_section(value, locale, &mut |reference| {
                self.reference(locale, reference, depth + 1).map(|(_, text)| text)
                    .map_err(|error| KnowledgeTextError::InvalidJson(error.to_string()))
            }).map_err(|error| ReviewError::InvalidCapture(error.to_string()))
        })?;
        Ok(ResolvedValue::Descriptor(R::KnowledgeSection { part_count }, text))
    }
    fn domain_custom_grammar(&self, locale: Locale, kind: &str, value: &J) -> Result<ResolvedValue, ReviewError> {
        use crate::domain_text::{CustomGrammarRole, CustomObjectFacts};
        fields(value, &["has_object", "number"])?;
        let has_object = required(value, "has_object")?.as_bool()
            .ok_or_else(|| ReviewError::InvalidCapture("has_object requires boolean".into()))?;
        let number = integer(required(value, "number")?, "number")?;
        let facts = CustomObjectFacts::new(has_object, number)
            .map_err(|error| ReviewError::InvalidCapture(format!("invalid custom grammar facts: {error:?}")))?;
        let role = if kind == "DomainCustomVerbSuffix" { CustomGrammarRole::VerbSuffix } else { CustomGrammarRole::Copula };
        let reference = if kind == "DomainCustomVerbSuffix" {
            R::DomainCustomVerbSuffix { has_object, number: number as u8 }
        } else { R::DomainCustomCopula { has_object, number: number as u8 } };
        Ok(ResolvedValue::Descriptor(reference, self.static_message(locale, facts.source_id(role))?))
    }
    fn monster_aggregate(&self, locale: Locale, value: &J) -> Result<ResolvedValue, ReviewError> {
        use crate::combat::{ReviewedCombatCatalog, aggregate_from_value, format_aggregate_subject};
        use crate::naming::ReviewedNamingCatalog;
        let capture = aggregate_from_value(value)
            .map_err(|error| ReviewError::InvalidCapture(error.to_string()))?;
        thread_local! {
            static CATALOGS: Result<(ReviewedNamingCatalog, ReviewedCombatCatalog), String> =
                ReviewedNamingCatalog::embedded().map_err(|error| error.to_string())
                    .and_then(|naming| ReviewedCombatCatalog::embedded()
                        .map(|combat| (naming, combat)).map_err(|error| error.to_string()));
        }
        let text = CATALOGS.with(|catalogs| {
            let (naming, combat) = catalogs.as_ref()
                .map_err(|error| ReviewError::Catalog(error.clone()))?;
            format_aggregate_subject(&capture, naming, combat, locale)
                .map_err(|error| ReviewError::InvalidCapture(error.to_string()))
        })?;
        Ok(ResolvedValue::Descriptor(R::MonsterAggregateSubject { snapshot_id: 0 }, text))
    }
    fn naming(&self, locale: Locale, kind: &str, value: &J) -> Result<ResolvedValue, ReviewError> {
        use crate::naming::{NamingError, ReviewedNamingCatalog, format_monster, format_object,
            monster_from_value, object_from_value};
        // Version 1 captured handles cannot establish selected name grammar.
        // Retain their explicit unsupported result, never reinterpret them.
        if value.field("schema_version").is_none() || value.field("schema_version").and_then(J::as_integer) == Some(1) {
            return Err(ReviewError::UnsupportedType(format!("legacy {kind} capture")));
        }
        let capture_error = |error: NamingError| match error {
            NamingError::IncompleteCapture(reason) => ReviewError::UnsupportedType(reason),
            _ => ReviewError::InvalidCapture(error.to_string()),
        };
        thread_local! { static NAMING: Result<ReviewedNamingCatalog, NamingError> = ReviewedNamingCatalog::embedded(); }
        let (reference, text) = NAMING.with(|catalog| -> Result<(R, String), ReviewError> {
            let catalog = catalog.as_ref().map_err(|error| ReviewError::Catalog(error.to_string()))?;
            if kind == "MonsterDescription" {
                let capture = monster_from_value(value).map_err(capture_error)?;
                let text = format_monster(&capture, catalog, locale).map_err(capture_error)?;
                Ok((R::MonsterDescription { snapshot_id: 0 }, text))
            } else {
                let capture = object_from_value(value).map_err(capture_error)?;
                capture.validate().map_err(capture_error)?;
                if let [crate::naming::ObjectPart::Literal { name: crate::naming::NameReference::Catalog(id) }] = capture.parts.as_slice() {
                    if id == "domain.custom_message.hands" {
                        return Ok((R::KnownObjectDescription { snapshot_id: 0 }, self.static_message(locale, id)?));
                    }
                }
                let text = format_object(&capture, catalog, locale).map_err(capture_error)?;
                Ok((R::KnownObjectDescription { snapshot_id: 0 }, text))
            }
        })?;
        Ok(ResolvedValue::Descriptor(reference, text))
    }
    fn generated_history(&self, locale: Locale, value: &J) -> Result<ResolvedValue, ReviewError> {
        use crate::history::{GeneratedHistory, HistoryCatalog, HistoryChoice, MAX_CHOICES};
        fields(value, &["grammar_version", "catalog_sha256", "start_chart", "choices"])?;
        let bounded_u16 = |value: &J, name: &str| -> Result<u16, ReviewError> {
            u16::try_from(integer(value, name)?).map_err(|_| ReviewError::InvalidCapture(format!("{name} outside u16")))
        };
        let grammar_version = u32::try_from(integer(required(value, "grammar_version")?, "grammar_version")?)
            .map_err(|_| ReviewError::InvalidCapture("history grammar version outside u32".into()))?;
        let catalog_sha256 = string(required(value, "catalog_sha256")?, "catalog_sha256")?.to_owned();
        let start_chart = bounded_u16(required(value, "start_chart")?, "start_chart")?;
        let choices = required(value, "choices")?.as_array().ok_or_else(|| ReviewError::InvalidCapture("history choices require an array".into()))?;
        if choices.is_empty() || choices.len() > MAX_CHOICES {
            return Err(ReviewError::InvalidCapture("history choice count outside bound".into()));
        }
        let mut selected = Vec::with_capacity(choices.len());
        for choice in choices {
            fields(choice, &["chart", "cutoff"])?;
            selected.push(HistoryChoice { chart: bounded_u16(required(choice, "chart")?, "chart")?,
                cutoff: bounded_u16(required(choice, "cutoff")?, "cutoff")? });
        }
        let choice_count = u16::try_from(selected.len()).map_err(|_| ReviewError::InvalidCapture("history choice count outside u16".into()))?;
        let capture = GeneratedHistory { grammar_version, catalog_sha256, start_chart, choices: selected };
        thread_local! { static HISTORY: Result<HistoryCatalog, crate::history::HistoryError> = HistoryCatalog::embedded(); }
        let output = HISTORY.with(|catalog| {
            let catalog = catalog.as_ref().map_err(|error| ReviewError::Catalog(error.to_string()))?;
            catalog.render(&capture, locale).map_err(|error| ReviewError::InvalidCapture(error.to_string()))
        })?;
        Ok(ResolvedValue::Descriptor(R::GeneratedHistory { start_chart, choice_count }, output))
    }
    fn list(&self, locale: Locale, id: &str, value: &J, depth: usize) -> Result<ResolvedValue, ReviewError> {
        let (ids, disjunction) = match value {
            J::Array(ids) if id == "birth.class.learns_realms" => (ids.as_slice(), false),
            J::Object(_) => {
                fields(value, &["ids", "style"])?;
                let disjunction = match (required(value, "style")?.as_str(), id) {
                    (Some("birth_realm_conjunction"), "birth.class.learns_realms") => false,
                    (Some("realm_spell_disjunction"), "realm.message.study.more_realms" | "realm.message.study.none_remaining") => true,
                    _ => return Err(ReviewError::UnsupportedType("localized list style".into())),
                };
                (required(value, "ids")?.as_array().ok_or_else(|| ReviewError::InvalidCapture("ids requires array".into()))?, disjunction)
            }
            _ => return Err(ReviewError::InvalidCapture("locale list requires ordered semantic references".into())),
        };
        if ids.is_empty() || ids.len() > 16 { return Err(ReviewError::InvalidCapture("realm list count".into())); }
        let mut output = String::new();
        let mut first = 0;
        for (position, value) in ids.iter().enumerate() {
            let key = match value { J::String(key) => key.as_str(), J::Object(_) => string(required(value, "id")?, "id")?, _ => return Err(ReviewError::InvalidCapture("realm requires semantic ID".into())) };
            let family = key.strip_prefix("magic.realm.").and_then(|tail| tail.split_once('.'));
            let valid = family.is_some_and(|(realm, form)| {
                matches!(realm, "arcane" | "divine" | "nature" | "shadow") &&
                if disjunction { matches!(form, "spell_noun_singular" | "spell_noun_plural") } else { form == "name" }
            });
            if !valid { return Err(ReviewError::InvalidCapture("wrong realm catalog family".into())); }
            let (index, text) = self.reference(locale, value, depth)?;
            if position == 0 { first = index; }
            else { output.push_str(match locale {
                Locale::Japanese if disjunction && position + 1 == ids.len() => "または",
                Locale::Japanese => "、",
                Locale::English if disjunction && position + 1 == ids.len() => " or ",
                Locale::English if position + 1 == ids.len() => " and ",
                Locale::English => ", ",
            }); }
            if output.len().checked_add(text.len()).is_none_or(|length| length > MAX_VALUE_BYTES) { return Err(FormatError::ValueTooLong("realms".into()).into()); }
            output.push_str(&text);
        }
        Ok(ResolvedValue::Descriptor(R::ReviewedList { first_catalog_index: first, count: ids.len() as u32 }, output))
    }
    fn feeling(&self, locale: Locale, id: &str, kind: &str, value: &J) -> Result<ResolvedValue, ReviewError> {
        fields(value, &["grade", "context"])?;
        let grade = int32(required(value, "grade")?, "grade")?;
        let context = string(required(value, "context")?, "context")?;
        let expected_context = match id { "game.level.feeling.object" => "embedded_clause", "game.level.feeling.monster" => "standalone_clause", "game.level.feeling.combined" => "combined_clause", _ => return Err(ReviewError::InvalidCapture("feeling outside reviewed envelope".into())) };
        if context != expected_context { return Err(ReviewError::InvalidCapture("feeling clause context mismatch".into())); }
        const OBJECT: [&str; 11] = ["ordinary", "wondrous", "superb", "excellent", "very_good", "good", "worthwhile", "uninteresting", "few", "junk", "cobwebs"];
        const MONSTER: [&str; 10] = ["uncertain", "death_omens", "murderous", "terribly_dangerous", "anxious", "nervous", "not_too_risky", "reasonably_safe", "sheltered", "peaceful"];
        let names = if kind == "ObjectFeeling" { &OBJECT[..] } else { &MONSTER[..] };
        let grade = usize::try_from(grade).ok().filter(|grade| *grade < names.len()).ok_or_else(|| ReviewError::InvalidCapture("feeling grade out of range".into()))?;
        let family = if kind == "ObjectFeeling" { "object" } else { "monster" };
        let key = format!("game.level.feeling.{family}.{}", names[grade]);
        let reference = if kind == "ObjectFeeling" { R::ObjectFeeling { index: grade as u32 } } else { R::MonsterFeeling { index: grade as u32 } };
        Ok(ResolvedValue::Descriptor(reference, self.static_message(locale, &key)?))
    }
    fn gold(&self, locale: Locale, value: &J, depth: usize) -> Result<ResolvedValue, ReviewError> {
        fields(value, &["variant", "gold_amount", "treasure"])?;
        let amount = int32(required(value, "gold_amount")?, "gold_amount")?;
        let mut args = vec![("gold_amount".into(), typed_integer(amount))];
        let (reference, id) = match string(required(value, "variant")?, "variant")? {
            "single_kind" => {
                let treasure = required(value, "treasure")?;
                fields(treasure, &["name_id"])?;
                let name = string(required(treasure, "name_id")?, "name_id")?;
                if !name.starts_with("money.") || !name.ends_with(".name") { return Err(ReviewError::InvalidCapture("wrong money catalog family".into())); }
                let money_kind_id = self.entry(name)?.index;
                args.push(("treasure".into(), J::Object(vec![("type".into(), J::String("MoneyKindName".into())), ("value".into(), treasure.clone())])));
                (GoldPickupReference::SingleKind { gold_amount: amount, money_kind_id }, "game.pickup.gold.single_kind")
            }
            "mixed_kinds" => {
                if value.field("treasure").is_some() { return Err(ReviewError::InvalidCapture("mixed money branch discloses a kind".into())); }
                (GoldPickupReference::MixedKinds { gold_amount: amount }, "game.pickup.gold.mixed_kinds")
            }
            _ => return Err(ReviewError::InvalidCapture("unknown gold composition branch".into())),
        };
        Ok(ResolvedValue::Descriptor(R::GoldPickupMessage(reference), self.format_node(locale, id, &args, depth)?))
    }
}
impl DynamicTemplateCatalog for ReviewCatalog {
    fn template(&self, locale: Locale, id: DynamicTextId) -> Result<&str, FormatError> {
        let entry = self.entries.get(id.key()).ok_or_else(|| FormatError::UnknownId(id.key().into()))?;
        Ok(match locale { Locale::English => &entry.english, Locale::Japanese => &entry.japanese })
    }
}
enum ResolvedValue { Text(String), Integer(i64), Descriptor(R, String) }
fn typed_integer(value: i32) -> J { J::Object(vec![("type".into(), J::String("int32".into())), ("value".into(), J::Integer(i64::from(value)))]) }

struct Runtime { catalog: Result<ReviewCatalog, ReviewError>, locale: Locale, output: Vec<u8>, error: Vec<u8>, status: u32 }
impl Default for Runtime { fn default() -> Self { Self { catalog: ReviewCatalog::embedded(), locale: Locale::default(), output: vec![0], error: vec![0], status: 0 } } }
thread_local! { static REVIEW: RefCell<Runtime> = RefCell::new(Runtime::default()); }
pub(crate) fn set_locale(locale: Locale) { REVIEW.with(|runtime| runtime.borrow_mut().locale = locale); }
pub(crate) fn active_locale() -> Locale { REVIEW.with(|runtime| runtime.borrow().locale) }
fn store(runtime: &mut Runtime, result: Result<String, ReviewError>) -> *const c_char {
    match result {
        Ok(output) => { runtime.output = output.into_bytes(); runtime.output.push(0); runtime.error.clear(); runtime.error.push(0); runtime.status = 0; runtime.output.as_ptr().cast() }
        Err(error) => { runtime.status = error.status(); runtime.output.clear(); runtime.error = error.to_string().replace('\0', "\\0").into_bytes(); runtime.error.push(0); std::ptr::null() }
    }
}
unsafe fn copy_span(bytes: *const u8, len: u32, max: usize) -> Result<String, ReviewError> {
    let len = len as usize;
    if len == 0 || len > max || bytes.is_null() || (bytes as usize).checked_add(len).is_none() || len > isize::MAX as usize { return Err(ReviewError::InvalidBuffer); }
    // SAFETY: caller guarantees this bounded span is allocated, initialized,
    // readable, and live for this synchronous call; u8 has alignment one.
    let span = unsafe { std::slice::from_raw_parts(bytes, len) };
    let input = std::str::from_utf8(span).map_err(|_| ReviewError::InvalidUtf8)?;
    if input.contains('\0') { return Err(ReviewError::EmbeddedNul); }
    Ok(input.to_owned())
}

/// Dedicated reviewed-static lookup. NULL means explicit status/error; no
/// English fallback. Successful UTF-8/NUL output lasts until the next review
/// static/event call on this thread, independently of old message/save/frame.
/// # Safety
/// Nonzero id_len requires id to reference initialized readable bytes live for
/// this call; arbitrary foreign allocation validity cannot be checked by Rust.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_review_static(id: *const u8, id_len: u32) -> *const c_char {
    // SAFETY: public caller supplies readable source ID bytes; bounds checked.
    let input = unsafe { copy_span(id, id_len, 127) };
    REVIEW.with(|runtime| {
        let mut runtime = runtime.borrow_mut();
        let result = input.and_then(|id| runtime.catalog.as_ref().map_err(Clone::clone)?.static_message(runtime.locale, &id));
        store(&mut runtime, result)
    })
}
/// Format one schema_version=1 owned semantic event with params:{name:{type,value}}.
/// Returns NULL on unsupported descriptors or malformed inputs. The producer
/// must copy the result synchronously and retain original engine behavior.
/// # Safety
/// json must reference json_len initialized readable bytes during the call.
/// No raw C entity pointer is accepted inside the JSON; all captures are owned.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ab_rs_review_event(json: *const u8, json_len: u32) -> *const c_char {
    // SAFETY: producer supplies copied, readable bounded UTF-8 JSON bytes.
    let input = unsafe { copy_span(json, json_len, MAX_EVENT_BYTES) };
    REVIEW.with(|runtime| {
        let mut runtime = runtime.borrow_mut();
        let result = input.and_then(|json| runtime.catalog.as_ref().map_err(Clone::clone)?.event(runtime.locale, &json));
        store(&mut runtime, result)
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_review_status() -> u32 { REVIEW.with(|runtime| runtime.borrow().status) }
/// Developer diagnostic pointer; status/error accessors do not invalidate it.
#[unsafe(no_mangle)]
pub extern "C" fn ab_rs_review_error() -> *const c_char { REVIEW.with(|runtime| runtime.borrow().error.as_ptr().cast()) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn custom_domain_grammar_preserves_null_zero_and_count_predicates() {
        let catalog = fixture(r#"{"test.message":"{suffix}/{copula}"}"#,
            r#"{"test.message":"{suffix}/{copula}"}"#,
            r#"[{"name":"suffix","type":"DomainCustomVerbSuffix"},{"name":"copula","type":"DomainCustomCopula"}]"#).unwrap();
        // A real embedded catalog supplies the selected static grammar IDs;
        // the fixture establishes type declarations without accepting text.
        assert_eq!(catalog.coverage().descriptor_templates, 1);
        let catalog = ReviewCatalog::embedded().unwrap();
        for (has_object, number, suffix, copula) in [(false,0,"","are"),(true,0,"","is"),(true,1,"s","is"),(true,255,"","are")] {
            let value = J::Object(vec![("has_object".into(),J::Bool(has_object)),("number".into(),J::Integer(number))]);
            let ResolvedValue::Descriptor(_, text) = catalog.domain_custom_grammar(Locale::English,"DomainCustomVerbSuffix",&value).unwrap() else {panic!("descriptor expected")};
            assert_eq!(text,suffix);
            let ResolvedValue::Descriptor(_, text) = catalog.domain_custom_grammar(Locale::English,"DomainCustomCopula",&value).unwrap() else {panic!("descriptor expected")};
            assert_eq!(text,copula);
            let ResolvedValue::Descriptor(_, text) = catalog.domain_custom_grammar(Locale::Japanese,"DomainCustomCopula",&value).unwrap() else {panic!("descriptor expected")};
            assert_eq!(text,"");
        }
        for (has_object, number) in [(false,1),(true,-1),(true,256)] {
            let value = J::Object(vec![("has_object".into(),J::Bool(has_object)),("number".into(),J::Integer(number))]);
            assert!(catalog.domain_custom_grammar(Locale::English,"DomainCustomCopula",&value).is_err());
        }
    }
    #[test]
    fn null_object_hands_are_one_shared_source_identity_and_reject_extra_parts() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let params = r#"{"object":{"type":"KnownObjectDescription","value":{"schema_version":2,"mode":0,"native_max_bytes":1024,"parts":[{"kind":"literal","name_id":"domain.custom_message.hands"}],"complete":true}}}"#;
        let capture = event("naming.object.description",params);
        assert_eq!(catalog.event(Locale::English,&capture).unwrap(),"hands");
        assert_eq!(catalog.event(Locale::Japanese,&capture).unwrap(),"両手");
        let extra = capture.replace("\"name_id\":\"domain.custom_message.hands\"}","\"name_id\":\"domain.custom_message.hands\"},{\"kind\":\"fuel\",\"turns\":1}");
        assert!(catalog.event(Locale::Japanese,&extra).is_err());
        assert!(catalog.event(Locale::Japanese,&capture.replace("domain.custom_message.hands","domain.custom_message.copula.singular")).is_err());
    }
    #[test]
    fn generated_history_event_validates_complete_source_chain_and_locale_reordering() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let choices = r#"[{"chart":1,"cutoff":100},{"chart":2,"cutoff":100},{"chart":3,"cutoff":80},{"chart":50,"cutoff":60},{"chart":51,"cutoff":70},{"chart":52,"cutoff":70},{"chart":53,"cutoff":90}]"#;
        let parameters = format!(r#"{{"history":{{"type":"GeneratedHistory","value":{{"grammar_version":1,"catalog_sha256":"{}","start_chart":1,"choices":{choices}}}}}}}"#, crate::history::CATALOG_SHA256);
        let capture = event("player.sheet.generated_history.value", &parameters);
        assert_eq!(catalog.event(Locale::English, &capture).unwrap(), "You are the first child of a Royal Blood Line.  You are a credit to the family.  You have brown eyes, straight brown hair, and a fair complexion.");
        assert_eq!(catalog.event(Locale::Japanese, &capture).unwrap(), "あなたは王族の第一子です。あなたは一族の誇りです。あなたは茶色の目と、まっすぐな茶色の髪、色白の肌をしています。");
        for broken in [capture.replace("\"grammar_version\":1", "\"grammar_version\":2"),
            capture.replace(crate::history::CATALOG_SHA256, "different-corpus"),
            capture.replace("\"cutoff\":80", "\"cutoff\":81"),
            capture.replace("\"start_chart\":1", "\"start_chart\":-1")] {
            assert_eq!(catalog.event(Locale::Japanese, &broken).unwrap_err().status(), 27);
        }
    }
    #[test]
    fn v2_name_events_use_selected_owned_parts_and_reject_hidden_or_incomplete_facts() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let monster = r#"{"monster":{"type":"MonsterDescription","value":{"schema_version":2,"complete":true,"mode":0,"native_max_bytes":80,"capital":false,"parts":[{"kind":"prefix","form":"the"},{"kind":"race","name_id":"angband.naming.monster.race.kobold.name","strip_appositive":false}]}}}"#;
        let capture = event("game.move.attack.afraid", monster);
        assert_eq!(catalog.event(Locale::English, &capture).unwrap(), "You are too afraid to attack the kobold!");
        assert_eq!(catalog.event(Locale::Japanese, &capture).unwrap(), "恐ろしくてコボルドを攻撃できない！");
        assert_eq!(catalog.event(Locale::Japanese, &capture.replace("\"complete\":true", "\"complete\":false")).unwrap_err().status(), 27);
        let unavailable = event("naming.monster.description", r#"{"monster":{"type":"MonsterDescription","value":{"schema_version":2,"complete":false,"reason":"NoDescriptorSnapshot"}}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &unavailable).unwrap_err().status(), 26);
        let injected = capture.replace("\"capital\":false", "\"capital\":false,\"entity_pointer\":1234");
        assert_eq!(catalog.event(Locale::Japanese, &injected).unwrap_err().status(), 27);
    }
    #[test]
    fn source_capitalization_owns_its_subject_and_preserves_japanese_utf8() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let subject = r#"{"schema_version":2,"complete":true,"mode":0,"native_max_bytes":80,"capital":false,"parts":[{"kind":"prefix","form":"the"},{"kind":"race","name_id":"angband.naming.monster.race.kobold.name","strip_appositive":false}]}"#;
        let capture = format!(r#"{{"schema_version":2,"subject":{subject},"capitalize":true}}"#);
        let value = json::parse(&capture, EVENT_LIMITS).unwrap();
        let ResolvedValue::Descriptor(reference, english) = catalog.capitalized_monster(Locale::English, &value).unwrap() else { panic!("descriptor expected") };
        assert_eq!(reference.kind(), D::CapitalizedMonsterDescription);
        assert_eq!(english, "The kobold");
        let ResolvedValue::Descriptor(_, japanese) = catalog.capitalized_monster(Locale::Japanese, &value).unwrap() else { panic!("descriptor expected") };
        assert_eq!(japanese, "コボルド");
        for broken in [capture.replace("\"capitalize\":true", "\"capitalize\":false"),
            capture.replace("\"complete\":true", "\"complete\":false"),
            capture.replace("\"capitalize\":true", "\"capitalize\":true,\"entity_pointer\":1")] {
            assert!(catalog.capitalized_monster(Locale::English, &json::parse(&broken, EVENT_LIMITS).unwrap()).is_err());
        }
    }
    #[test]
    fn parser_tokens_are_opaque_and_bound_by_utf8_bytes() {
        let catalog = fixture(r#"{"test.message":"{token}"}"#, r#"{"test.message":"{token}"}"#,
            r#"[{"name":"token","type":"opaque_parser_token"}]"#).unwrap();
        for token in [String::new(), "field{not_template}".into(), "界".repeat(341)] {
            let parameters = format!(r#"{{"token":{{"type":"opaque_text","value":"{token}"}}}}"#);
            assert_eq!(catalog.event(Locale::Japanese, &event("test.message", &parameters)).unwrap(), token);
        }
        let parameters = format!(r#"{{"token":{{"type":"opaque_parser_token","value":"{}"}}}}"#, "界".repeat(342));
        assert_eq!(catalog.event(Locale::Japanese, &event("test.message", &parameters)).unwrap_err().status(), 27);
    }
    #[test]
    fn file_build_identities_are_opaque_while_command_keys_are_source_bounded() {
        let catalog = fixture(r#"{"test.message":"{path} {build} {key}"}"#,
            r#"{"test.message":"{path} {build} {key}"}"#,
            r#"[{"name":"path","type":"opaque_file_path"},{"name":"build","type":"opaque_build_identity"},{"name":"key","type":"canonical_key"}]"#).unwrap();
        let capture = event("test.message", r#"{"path":{"type":"opaque_file_path","value":"保存/{name}%/game.sav"},"build":{"type":"opaque_build_identity","value":"Angband 4.2.6"},"key":{"type":"canonical_key","value":"A"}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &capture).unwrap(), "保存/{name}%/game.sav Angband 4.2.6 A");
        assert_eq!(catalog.event(Locale::Japanese, &capture.replace("\"value\":\"A\"", "\"value\":\"AB\"")).unwrap_err().status(), 27);
    }
    fn fixture(en: &str, ja: &str, specs: &str) -> Result<ReviewCatalog, ReviewError> {
        let schema = format!("{{\"schema_version\":1,\"entries\":{{\"test.message\":{{\"parameters\":{specs}}}}}}}");
        ReviewCatalog::from_json(en, ja, &schema)
    }
    fn event(id: &str, params: &str) -> String { format!("{{\"schema_version\":1,\"id\":\"{id}\",\"params\":{params}}}") }

    #[test]
    fn embedded_catalog_matches_generated_key_coverage_and_real_template_schemas() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let schema = json::parse(REVIEW_SCHEMA_JSON, SCHEMA_LIMITS).unwrap();
        let declared = schema.field("catalog_entries").unwrap().as_integer().unwrap() as usize;
        let coverage = catalog.coverage();
        assert!(declared >= 930);
        assert_eq!(coverage.templates, declared);
        assert_eq!(coverage.templates, coverage.static_templates + coverage.primitive_templates + coverage.descriptor_templates);
        assert_eq!(schema.field("complete_game_translation").unwrap().as_bool(), Some(false));
        for id in catalog.entries.keys() {
            if catalog.entry(id).unwrap().parameters.is_empty() {
                assert!(catalog.static_message(Locale::English, id).is_ok(), "{id}");
                assert!(catalog.static_message(Locale::Japanese, id).is_ok(), "{id}");
            }
        }
    }

    #[test]
    fn catalog_duplicate_missing_keys_and_placeholder_schema_drift_fail_explicitly() {
        let specs = r#"[{"name":"name","type":"character_name"}]"#;
        assert!(fixture(r#"{"test.message":"{name}","test.message":"x"}"#, r#"{"test.message":"{name}"}"#, specs).is_err());
        assert!(fixture(r#"{"test.message":"{name}"}"#, r#"{"other.id":"{name}"}"#, specs).is_err());
        assert!(matches!(fixture(r#"{"test.message":"{name}"}"#, r#"{"test.message":"{extra}"}"#, specs), Err(ReviewError::Format(FormatError::UnknownPlaceholder(_)))));
        assert!(matches!(fixture(r#"{"test.message":"{name}"}"#, r#"{"test.message":"nothing"}"#, specs), Err(ReviewError::Format(FormatError::MissingPlaceholder(_)))));
    }

    #[test]
    fn integer_aliases_explicit_sign_and_decimal_tenths_preserve_source_policy() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let attack = event("birth.skill.attack", r#"{"melee":{"type":"int32","value":5},"shoot":{"type":"int32","value":0},"throw":{"type":"int32","value":-3}}"#);
        assert_eq!(catalog.event(Locale::English, &attack).unwrap(), "Hit/Shoot/Throw: +5/+0/-3\n");
        let burden = event("player.sheet.burden.value", r#"{"weight":{"type":"decimal_one_place","value":-25}}"#);
        assert_eq!(catalog.event(Locale::English, &burden).unwrap(), "-2.5 lb");
        let float = event("player.sheet.burden.value", r#"{"weight":{"type":"decimal_one_place","value":2.5}}"#);
        assert_eq!(catalog.event(Locale::English, &float).unwrap_err().status(), 25);
        let overflow = event("game.pickup.gold.mixed_kinds", r#"{"gold_amount":{"type":"int32","value":2147483648}}"#);
        assert_eq!(catalog.event(Locale::English, &overflow).unwrap_err().status(), 11);
    }

    #[test]
    fn stat_notation_uses_source_id_policy_without_completed_c_strings() {
        let catalog = ReviewCatalog::embedded().unwrap();
        for (id, value, expected) in [
            ("player.stat.notation.above_18", 1, "18/01"),
            ("player.stat.notation.above_18", 9, "18/09"),
            ("player.stat.notation.above_18", 99, "18/99"),
            ("player.stat.notation.above_100", 100, "18/100"),
            ("player.stat.notation.above_100", 101, "18/101"),
            ("player.stat.notation.above_100", 1000, "18/1000"),
        ] {
            let json = event(id, &format!("{{\"bonus\":{{\"type\":\"int32\",\"value\":{value}}}}}"));
            for locale in [Locale::English, Locale::Japanese] {
                assert_eq!(catalog.event(locale, &json).unwrap(), expected);
            }
        }
        let overweight = event("player.sheet.overweight.value", r#"{"whole":{"type":"int32","value":1},"fraction":{"type":"int32","value":2}}"#);
        assert_eq!(catalog.event(Locale::English, &overweight).unwrap(), "1.2 lb");
    }

    #[test]
    fn external_unicode_and_user_history_are_opaque_and_generated_provenance_is_explicit() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let name = event("player.sheet.name.value", r#"{"name":{"type":"opaque_text","value":"Alice 花🌸 {name} 100%"}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &name).unwrap(), "Alice 花🌸 {name} 100%");
        let history = event("birth.history.edited_content", r#"{"history":{"type":"verbatim_user_text","origin":"user","value":"My {history} 花"}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &history).unwrap(), "My {history} 花");
        let generated = event("birth.history.edited_content", r#"{"history":{"type":"verbatim_user_text","origin":"generated","value":"You are the son of..."}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &generated).unwrap_err().status(), 26);
    }

    #[test]
    fn nested_localized_ids_resolve_semantic_components_without_english_lookup() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let nested = event("birth.ability.line", r#"{"ability":{"type":"text_id","value":{"id":"player.ability.element.resistance.name","params":{"element":{"type":"text_id","value":"element.fire.name"}}}}}"#);
        let english = catalog.event(Locale::English, &nested).unwrap();
        assert_eq!(english, format!("\n{} Resistance", catalog.static_message(Locale::English, "element.fire.name").unwrap()));
        let japanese = catalog.event(Locale::Japanese, &nested).unwrap();
        assert_ne!(english, japanese);
        let wrong = event("birth.ability.line", r#"{"ability":{"type":"text_id","value":"Fire Resistance"}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &wrong).unwrap_err().status(), 1);
    }

    #[test]
    fn reviewed_realm_list_keeps_order_no_oxford_comma_and_locale_joining() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let list = event("birth.class.learns_realms", r#"{"realms":{"type":"text_id_list","value":{"style":"birth_realm_conjunction","ids":["magic.realm.arcane.name","magic.realm.divine.name","magic.realm.nature.name"]}}}"#);
        let names: Vec<_> = ["magic.realm.arcane.name", "magic.realm.divine.name", "magic.realm.nature.name"].into_iter().map(|id| catalog.static_message(Locale::English, id).unwrap()).collect();
        assert_eq!(catalog.event(Locale::English, &list).unwrap(), format!("\nLearns {}, {} and {} magic", names[0], names[1], names[2]));
        let japanese = catalog.event(Locale::Japanese, &list).unwrap();
        assert_eq!(japanese.matches('、').count(), 2);
        let wrong = event("birth.class.learns_realms", r#"{"realms":{"type":"text_id_list","value":{"style":"guessed_style","ids":["magic.realm.arcane.name"]}}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &wrong).unwrap_err().status(), 26);
    }

    #[test]
    fn selected_note_display_budget_preserves_opaque_utf8_and_refuses_other_ids() {
        let en=r#"{"ui.residual.note.plain":"{text}"}"#;
        let ja=r#"{"ui.residual.note.plain":"{text}"}"#;
        let schema=r#"{"schema_version":1,"entries":{"ui.residual.note.plain":{"parameters":[{"name":"text","type":"verbatim_user_text"}],"native_output_max_bytes":86}}}"#;
        let catalog=ReviewCatalog::from_json(en,ja,schema).unwrap();
        for (body,expected) in [("a".repeat(100),"a".repeat(86)),("界".repeat(30),"界".repeat(28)),(format!("{}界", "x".repeat(85)),"x".repeat(85))] {
            let args=vec![("text".to_owned(),J::Object(vec![("type".to_owned(),J::String("verbatim_user_text".to_owned())),("value".to_owned(),J::String(body))]))];
            for locale in [Locale::English,Locale::Japanese] { assert_eq!(catalog.format_node(locale,"ui.residual.note.plain",&args,0).unwrap(),expected); }
        }
        assert!(ReviewCatalog::from_json(en,ja,&schema.replace("86","87")).is_err());
        assert!(ReviewCatalog::from_json(en,ja,&schema.replace(",\"native_output_max_bytes\":86","")).is_err());
        assert!(ReviewCatalog::from_json(&en.replace("ui.residual.note.plain","test.message"),&ja.replace("ui.residual.note.plain","test.message"),&schema.replace("ui.residual.note.plain","test.message")).is_err());
    }

    #[test]
    fn owned_effect_graph_uses_typed_templates_and_native_nested_bounds() {
        let en = r#"{"angband.effect_info.test.outer":"{description}","angband.effect_info.test.turns":"{count} turns","angband.effect_info.test.noun":"fire","angband.effect_info.test.join":"{description} or {noun}"}"#;
        let ja = r#"{"angband.effect_info.test.outer":"{description}","angband.effect_info.test.turns":"{count}ターン","angband.effect_info.test.noun":"炎","angband.effect_info.test.join":"{noun}または{description}"}"#;
        let schema = r#"{"schema_version":1,"entries":{"angband.effect_info.test.outer":{"parameters":[{"name":"description","type":"EffectDescription"}]},"angband.effect_info.test.turns":{"parameters":[{"name":"count","type":"integer"}]},"angband.effect_info.test.noun":{"parameters":[]},"angband.effect_info.test.join":{"parameters":[{"name":"description","type":"EffectDescription"},{"name":"noun","type":"localized_text"}]}}}"#;
        let catalog = ReviewCatalog::from_json(en,ja,schema).unwrap();
        let capture = r#"{"schema_version":1,"parts":[{"kind":"ref","id":"angband.effect_info.test.join","params":{"description":{"type":"EffectDescription","value":{"schema_version":1,"parts":[{"kind":"bounded","native_max_bytes":6,"parts":[{"kind":"ref","id":"angband.effect_info.test.turns","params":{"count":{"type":"integer","value":12}}}]}]}},"noun":{"type":"localized_text","value":{"id":"angband.effect_info.test.noun","params":{}}}}}]}"#;
        let value = json::parse(capture,EVENT_LIMITS).unwrap();
        let ResolvedValue::Descriptor(reference,english) = catalog.effect_description(Locale::English,&value).unwrap() else {panic!("effect descriptor expected")};
        assert_eq!(reference.kind(),D::EffectDescription);
        assert_eq!(english,"12 tu or fire");
        let ResolvedValue::Descriptor(_,japanese) = catalog.effect_description(Locale::Japanese,&value).unwrap() else {panic!("effect descriptor expected")};
        assert_eq!(japanese,"炎または12ターン");
        for _ in 0..4 {
            let ResolvedValue::Descriptor(_,text) = catalog.effect_description(Locale::English,&value).unwrap() else {unreachable!()};
            assert_eq!(text,english);
        }
        let bad = capture.replace("angband.effect_info.test.turns","angband.effect_info.test.missing");
        assert!(catalog.effect_description(Locale::Japanese,&json::parse(&bad,EVENT_LIMITS).unwrap()).is_err());
        let wrong = r#"{"schema_version":1,"parts":[{"kind":"ref","id":"angband.effect_info.test.turns","params":{"count":{"type":"localized_text","value":{"id":"angband.effect_info.test.noun","params":{}}}}}]}"#;
        assert!(catalog.effect_description(Locale::English,&json::parse(wrong,EVENT_LIMITS).unwrap()).is_err());
    }

    #[test]
    fn source_realm_disjunction_preserves_order_plural_facts_and_scope() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let keys = ["magic.realm.shadow.spell_noun_plural", "magic.realm.nature.spell_noun_singular", "magic.realm.arcane.spell_noun_plural"];
        for count in 1..=3 {
            let ids = keys[..count].iter().map(|key| format!("\"{key}\"")).collect::<Vec<_>>().join(",");
            let capture = format!(r#"{{"style":"realm_spell_disjunction","ids":[{ids}]}}"#);
            let value = json::parse(&capture, EVENT_LIMITS).unwrap();
            for locale in [Locale::English, Locale::Japanese] {
                let words: Vec<_> = keys[..count].iter().map(|key| catalog.static_message(locale,key).unwrap()).collect();
                let expected = match (locale,count) {
                    (_,1) => words[0].clone(),
                    (Locale::English,2) => format!("{} or {}",words[0],words[1]),
                    (Locale::English,3) => format!("{}, {} or {}",words[0],words[1],words[2]),
                    (Locale::Japanese,2) => format!("{}または{}",words[0],words[1]),
                    (Locale::Japanese,3) => format!("{}、{}または{}",words[0],words[1],words[2]),
                    _ => unreachable!(),
                };
                for id in ["realm.message.study.more_realms","realm.message.study.none_remaining"] {
                    let ResolvedValue::Descriptor(_,text) = catalog.list(locale,id,&value,0).unwrap() else { panic!("list expected") };
                    assert_eq!(text,expected);
                }
            }
            assert!(catalog.list(Locale::English,"birth.class.learns_realms",&value,0).is_err());
            let wrong = capture.replace(".spell_noun_plural", ".name");
            assert!(catalog.list(Locale::English,"realm.message.study.more_realms",&json::parse(&wrong,EVENT_LIMITS).unwrap(),0).is_err());
        }
        let too_many = format!(r#"{{"style":"realm_spell_disjunction","ids":[{}]}}"#, vec![format!("\"{}\"",keys[0]);17].join(","));
        assert!(catalog.list(Locale::English,"realm.message.study.more_realms",&json::parse(&too_many,EVENT_LIMITS).unwrap(),0).is_err());
    }

    #[test]
    fn terrain_diagnostic_and_trap_names_use_distinct_reviewed_catalog_families() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let trap = event("game.trap.disarm.success", r#"{"trap":{"type":"TrapName","value":{"name_id":"trap.label.pit"}}}"#);
        assert_eq!(catalog.event(Locale::English, &trap).unwrap(), "You have disarmed the pit.");
        let wrong = event("game.trap.disarm.success", r#"{"trap":{"type":"TrapName","value":{"name_id":"terrain.granite.name"}}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &wrong).unwrap_err().status(), 27);
        let diagnostic = event("game.dig.error.invalid_chance", r#"{"terrain":{"type":"TerrainDiagnosticReference","value":{"terrain_index":9}}}"#);
        assert_eq!(catalog.event(Locale::English, &diagnostic).unwrap(), "Terrain index 9 has misconfigured digging chance; please report this bug.");
        let tunnel = event("game.dig.terrain.progress", r#"{"terrain":{"type":"ApparentTerrain","value":{"name_id":"terrain.granite.name"}},"digging_method":{"type":"DiggingMethod","value":"hands"}}"#);
        assert_eq!(catalog.event(Locale::English, &tunnel).unwrap(), "You tunnel into the granite wall with your hands.");
    }

    #[test]
    fn feeling_grade_context_and_conjunction_preserve_disclosure_shape() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let monster = event("game.level.feeling.monster", r#"{"monster_feeling":{"type":"MonsterFeeling","value":{"grade":1,"context":"standalone_clause"}}}"#);
        assert_eq!(catalog.event(Locale::English, &monster).unwrap(), "Omens of death haunt this place.");
        let combined = event("game.level.feeling.combined", r#"{"monster_feeling":{"type":"MonsterFeeling","value":{"grade":1,"context":"combined_clause"}},"conjunction":{"type":"FeelingConjunction","value":"yet"},"object_feeling":{"type":"ObjectFeeling","value":{"grade":10,"context":"combined_clause"}}}"#);
        assert_eq!(catalog.event(Locale::English, &combined).unwrap(), "Omens of death haunt this place, yet there is naught but cobwebs here.");
        let wrong = event("game.level.feeling.object", r#"{"object_feeling":{"type":"ObjectFeeling","value":{"grade":1,"context":"standalone_clause"}}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &wrong).unwrap_err().status(), 27);
    }

    #[test]
    fn gold_owned_composition_preserves_amount_branch_and_source_plural() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let mixed = event("game.pickup.gold.summary", r#"{"gold_message":{"type":"GoldPickupMessage","value":{"variant":"mixed_kinds","gold_amount":1}}}"#);
        assert_eq!(catalog.event(Locale::English, &mixed).unwrap(), "You have found 1 gold pieces worth of treasures.");
        let single = event("game.pickup.gold.summary", r#"{"gold_message":{"type":"GoldPickupMessage","value":{"variant":"single_kind","gold_amount":50,"treasure":{"name_id":"money.copper.name"}}}}"#);
        let money = catalog.static_message(Locale::Japanese, "money.copper.name").unwrap();
        assert!(catalog.event(Locale::Japanese, &single).unwrap().contains(&money));
        let disclosure = event("game.pickup.gold.summary", r#"{"gold_message":{"type":"GoldPickupMessage","value":{"variant":"mixed_kinds","gold_amount":1,"treasure":{"name_id":"money.copper.name"}}}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &disclosure).unwrap_err().status(), 27);
    }

    #[test]
    fn unavailable_monster_and_known_object_grammar_never_falls_back_to_english() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let hidden = event("game.move.attack.afraid", r#"{"monster":{"type":"MonsterDescription","value":{"kind":"hidden","pronoun":"it","capital":false,"offscreen":false}}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &hidden).unwrap_err().status(), 26);
        let english = event("game.move.attack.afraid", r#"{"monster":{"type":"opaque_text","value":"the Ancient Dragon"}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &english).unwrap_err().status(), 27);
        let object = event("game.monster.command.drop", r#"{"monster":{"type":"MonsterDescription","value":{"kind":"visible","race_index":7}},"object":{"type":"KnownObjectDescription","value":{"complete":false}}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &object).unwrap_err().status(), 26);
    }

    #[test]
    fn strict_events_reject_unknown_duplicate_missing_extra_and_bad_token_inputs() {
        let catalog = ReviewCatalog::embedded().unwrap();
        let unknown_field = r#"{"schema_version":1,"id":"player.sheet.name.value","params":{},"injected":true}"#;
        assert_eq!(catalog.event(Locale::Japanese, unknown_field).unwrap_err().status(), 27);
        let duplicate = event("player.sheet.name.value", r#"{"name":{"type":"opaque_text","value":"a"},"name":{"type":"opaque_text","value":"b"}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &duplicate).unwrap_err().status(), 25);
        assert_eq!(catalog.event(Locale::Japanese, &event("player.sheet.name.value", "{}")).unwrap_err().status(), 7);
        let extra = event("player.sheet.name.value", r#"{"name":{"type":"opaque_text","value":"a"},"extra":{"type":"opaque_text","value":"b"}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &extra).unwrap_err().status(), 8);
        let token = event("ui.status.level_feeling.summary", r#"{"danger":{"type":"display_token","value":"10"},"treasure":{"type":"display_token","value":"?"}}"#);
        assert!(catalog.event(Locale::Japanese, &token).is_ok());
        let bad_token = event("ui.status.level_feeling.summary", r#"{"danger":{"type":"display_token","value":"secret"},"treasure":{"type":"display_token","value":"?"}}"#);
        assert_eq!(catalog.event(Locale::Japanese, &bad_token).unwrap_err().status(), 27);
    }

    #[test]
    fn review_ffi_is_pure_for_legacy_transport_and_uses_independent_buffers() {
        crate::ab_rs_set_locale(1);
        crate::ab_rs_journal_reset();
        crate::ab_rs_input(64, 0);
        let original = [4_u8, 0, 255, 3];
        // SAFETY: original is initialized readable bytes; known source literals
        // are live NUL-terminated IDs and returned pointers are copied now.
        unsafe { crate::ab_rs_save_wrap(original.as_ptr(), original.len() as u32); }
        unsafe { crate::ab_rs_message(c"game.stairs.up.missing".as_ptr()); }
        crate::ab_rs_frame();
        let before = crate::ADAPTER.with(|state| {
            let state = state.borrow();
            (state.screen.snapshot(), state.journal.clone(), state.save_output.clone(), state.message_output.clone(), state.frame.clone(), state.checkpoint_rng, state.restored_rng)
        });
        let json = event("player.sheet.name.value", r#"{"name":{"type":"opaque_text","value":"Alice 花"}}"#);
        // SAFETY: json is an initialized live UTF-8 span; output read before
        // another review call. Null/oversized spans are rejected before access.
        let pointer = unsafe { ab_rs_review_event(json.as_ptr(), json.len() as u32) };
        assert!(!pointer.is_null());
        assert_eq!(unsafe { std::ffi::CStr::from_ptr(pointer) }.to_str().unwrap(), "Alice 花");
        assert_eq!(ab_rs_review_status(), 0);
        let after = crate::ADAPTER.with(|state| {
            let state = state.borrow();
            (state.screen.snapshot(), state.journal.clone(), state.save_output.clone(), state.message_output.clone(), state.frame.clone(), state.checkpoint_rng, state.restored_rng)
        });
        assert_eq!(before, after);
        assert!(unsafe { ab_rs_review_event(std::ptr::null(), 4) }.is_null());
        assert_eq!(ab_rs_review_status(), 19);
        assert!(unsafe { ab_rs_review_static(b"unknown.id".as_ptr(), 10) }.is_null());
        assert_eq!(ab_rs_review_status(), 1);
        assert!(unsafe { std::ffi::CStr::from_ptr(ab_rs_review_error()) }.to_str().unwrap().contains("unknown.id"));
    }
}
