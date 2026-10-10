//! Pure presentation and strict semantic text rendering for the migrated scope.
//!
//! Catalogs contain no gameplay state. Rendering neither reads a clock nor draws
//! random numbers. The returned text is plain text; browser adapters must insert
//! it using a text node or `textContent`, never as HTML.

use crate::dynamic_text::{self, RenderedText, RunRole};
use serde::de::{self, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;

/// Supported display language. Japanese is the user-facing default.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    /// Japanese.
    #[default]
    Ja,
    /// English.
    En,
}

impl Language {
    /// Stable language code used by browser settings.
    pub const fn code(self) -> &'static str {
        match self {
            Self::Ja => "ja",
            Self::En => "en",
        }
    }
}

/// A semantic identifier such as `storage.saved`; never an English sentence.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(transparent)]
pub struct TextId(String);

impl TextId {
    /// Parse a dotted identifier whose segments use lowercase ASCII names.
    ///
    /// # Errors
    /// Returns [`DisplayError::InvalidId`] for empty, undotted, or invalid IDs.
    pub fn new(id: impl Into<String>) -> Result<Self, DisplayError> {
        let id = id.into();
        if !id.contains('.') || !id.split('.').all(valid_name) {
            return Err(DisplayError::InvalidId(id));
        }
        Ok(Self(id))
    }

    /// Borrow the stable identifier.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for TextId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for TextId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        Self::new(String::deserialize(deserializer)?).map_err(de::Error::custom)
    }
}

/// Language-independent application event with typed JSON parameters.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Message {
    /// Semantic event identifier.
    pub id: TextId,
    /// Named parameters; their types and exact names are checked by the catalog.
    #[serde(default, deserialize_with = "deserialize_parameters")]
    pub params: BTreeMap<String, Value>,
}

impl Message {
    /// Create an event with no parameters.
    ///
    /// # Errors
    /// Returns an error if the identifier is invalid.
    pub fn new(id: impl Into<String>) -> Result<Self, DisplayError> {
        Ok(Self {
            id: TextId::new(id)?,
            params: BTreeMap::new(),
        })
    }

    /// Add a named value. Catalog rendering checks its spelling and value type.
    #[must_use]
    pub fn with(mut self, name: impl Into<String>, value: impl Into<Value>) -> Self {
        self.params.insert(name.into(), value.into());
        self
    }
}

/// Recoverable catalog, identifier, or parameter validation failure.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DisplayError {
    /// A semantic identifier is malformed.
    InvalidId(String),
    /// JSON, template syntax, or a declared parameter schema is malformed.
    InvalidCatalog(String),
    /// A valid semantic identifier is absent from the selected catalog.
    MissingId(String),
    /// A required named parameter was not supplied.
    MissingParameter { id: String, parameter: String },
    /// A supplied named parameter is not declared by the selected entry.
    UnexpectedParameter { id: String, parameter: String },
    /// A value does not match its declared type.
    ParameterType {
        id: String,
        parameter: String,
        expected: &'static str,
    },
    /// A versioned descriptor differs from its source-bound schema.
    DynamicParameter {
        id: String,
        parameter: String,
        reason: String,
    },
    /// Bilingual semantic ID sets or parameter schemas differ.
    CatalogMismatch(String),
}

impl fmt::Display for DisplayError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidId(id) => write!(formatter, "invalid semantic text ID: {id}"),
            Self::InvalidCatalog(reason) => write!(formatter, "invalid text catalog: {reason}"),
            Self::MissingId(id) => write!(formatter, "missing semantic text ID: {id}"),
            Self::MissingParameter { id, parameter } => {
                write!(formatter, "missing parameter {parameter} for {id}")
            }
            Self::UnexpectedParameter { id, parameter } => {
                write!(formatter, "unexpected parameter {parameter} for {id}")
            }
            Self::ParameterType {
                id,
                parameter,
                expected,
            } => write!(
                formatter,
                "parameter {parameter} for {id} must be {expected}"
            ),
            Self::DynamicParameter {
                id,
                parameter,
                reason,
            } => write!(
                formatter,
                "invalid dynamic parameter {parameter} for {id}: {reason}"
            ),
            Self::CatalogMismatch(reason) => write!(formatter, "text catalog mismatch: {reason}"),
        }
    }
}

impl Error for DisplayError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
enum ParameterKind {
    Text,
    Decimal,
    Unsigned,
    Integer,
    Number,
    Boolean,
    Quantity,
}

impl ParameterKind {
    const fn description(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Decimal => "a canonical unsigned 64-bit decimal string",
            Self::Unsigned => "an unsigned integer",
            Self::Integer => "an integer",
            Self::Number => "a number",
            Self::Boolean => "a boolean",
            Self::Quantity => "a nonnegative integer quantity",
        }
    }

    fn accepts(self, value: &Value) -> bool {
        match self {
            Self::Text => value.is_string(),
            Self::Decimal => value.as_str().is_some_and(|text| {
                !text.is_empty()
                    && text.bytes().all(|byte| byte.is_ascii_digit())
                    && (text == "0" || !text.starts_with('0'))
                    && text.parse::<u64>().is_ok()
            }),
            Self::Unsigned | Self::Quantity => value.as_u64().is_some(),
            Self::Integer => value.as_i64().is_some() || value.as_u64().is_some(),
            Self::Number => value.is_number(),
            Self::Boolean => value.is_boolean(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(untagged)]
enum ParameterSchema {
    Scalar(ParameterKind),
    Dynamic(dynamic_text::ParameterSchema),
}
impl ParameterSchema {
    fn is_quantity(&self) -> bool {
        matches!(self, Self::Scalar(ParameterKind::Quantity))
            || matches!(self, Self::Dynamic(schema) if schema.is_quantity())
    }
    fn one(&self, value: &Value) -> Result<bool, dynamic_text::DynamicError> {
        match self {
            Self::Scalar(ParameterKind::Quantity) => Ok(value.as_u64() == Some(1)),
            Self::Dynamic(schema) => schema.quantity_one(value),
            _ => Err(dynamic_text::DynamicError::Invalid(
                "plural quantity schema mismatch",
            )),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct WireTemplate {
    text: String,
    params: BTreeMap<String, ParameterSchema>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct WirePlural {
    one: String,
    other: String,
    params: BTreeMap<String, ParameterSchema>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum WireEntry {
    Plain(String),
    Template(WireTemplate),
    Plural(WirePlural),
}

struct WireCatalog(BTreeMap<String, WireEntry>);

impl<'de> Deserialize<'de> for WireCatalog {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct CatalogVisitor;

        impl<'de> Visitor<'de> for CatalogVisitor {
            type Value = WireCatalog;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("an object of unique semantic text IDs")
            }

            fn visit_map<M>(self, mut map: M) -> Result<Self::Value, M::Error>
            where
                M: MapAccess<'de>,
            {
                let mut entries = BTreeMap::new();
                while let Some((id, entry)) = map.next_entry::<String, WireEntry>()? {
                    if entries.insert(id.clone(), entry).is_some() {
                        return Err(de::Error::custom(format!("duplicate text ID: {id}")));
                    }
                }
                Ok(WireCatalog(entries))
            }
        }

        deserializer.deserialize_map(CatalogVisitor)
    }
}

#[derive(Clone, Debug)]
enum Token {
    Literal(String),
    Parameter(String),
}

#[derive(Clone, Debug)]
struct Template {
    tokens: Vec<Token>,
}

impl Template {
    fn parse(
        id: &str,
        text: &str,
        parameters: &BTreeMap<String, ParameterSchema>,
    ) -> Result<Self, DisplayError> {
        if text.is_empty() {
            return Err(invalid_catalog(id, "empty text"));
        }
        let mut chars = text.chars().peekable();
        let mut literal = String::new();
        let mut tokens = Vec::new();
        let mut placeholders = BTreeSet::new();
        while let Some(character) = chars.next() {
            match character {
                '{' if chars.peek() == Some(&'{') => {
                    chars.next();
                    literal.push('{');
                }
                '}' if chars.peek() == Some(&'}') => {
                    chars.next();
                    literal.push('}');
                }
                '{' => {
                    if !literal.is_empty() {
                        tokens.push(Token::Literal(std::mem::take(&mut literal)));
                    }
                    let mut parameter = String::new();
                    let mut closed = false;
                    for next in chars.by_ref() {
                        if next == '}' {
                            closed = true;
                            break;
                        }
                        parameter.push(next);
                    }
                    if !closed || !valid_name(&parameter) {
                        return Err(invalid_catalog(id, "invalid placeholder syntax"));
                    }
                    placeholders.insert(parameter.clone());
                    tokens.push(Token::Parameter(parameter));
                }
                '}' => return Err(invalid_catalog(id, "unmatched closing brace")),
                other => literal.push(other),
            }
        }
        if !literal.is_empty() {
            tokens.push(Token::Literal(literal));
        }
        let declared: BTreeSet<_> = parameters.keys().cloned().collect();
        if placeholders != declared {
            return Err(invalid_catalog(
                id,
                "placeholders do not match declared parameters",
            ));
        }
        Ok(Self { tokens })
    }

    fn render(
        &self,
        params: &BTreeMap<String, RenderedText>,
    ) -> Result<RenderedText, dynamic_text::DynamicError> {
        let mut rendered = RenderedText::default();
        for token in &self.tokens {
            match token {
                Token::Literal(text) => {
                    rendered.append(&RenderedText::literal(text.clone(), RunRole::Literal)?)?
                }
                Token::Parameter(name) => {
                    let value = params.get(name).ok_or(dynamic_text::DynamicError::Invalid(
                        "validated parameter missing",
                    ))?;
                    rendered.append(value)?;
                }
            }
        }
        Ok(rendered)
    }
}

#[derive(Clone, Debug)]
enum EntryText {
    Single(Template),
    Plural { one: Template, other: Template },
}

#[derive(Clone, Debug)]
struct Entry {
    text: EntryText,
    params: BTreeMap<String, ParameterSchema>,
}

/// Validated, immutable presentation catalog for one language.
#[derive(Clone, Debug)]
pub struct Catalog {
    language: Language,
    entries: BTreeMap<TextId, Entry>,
}

impl Catalog {
    /// Parse and validate a catalog without silently accepting unknown fields.
    ///
    /// # Errors
    /// Rejects invalid JSON, duplicate IDs, invalid IDs, malformed templates, and
    /// placeholder/schema mismatches. Both plural forms must use the same schema.
    pub fn from_json(language: Language, json: &str) -> Result<Self, DisplayError> {
        let wire: WireCatalog = serde_json::from_str(json)
            .map_err(|error| DisplayError::InvalidCatalog(error.to_string()))?;
        if wire.0.is_empty() {
            return Err(DisplayError::InvalidCatalog("empty catalog".to_owned()));
        }
        let mut entries = BTreeMap::new();
        for (id, wire_entry) in wire.0 {
            let text_id = TextId::new(id.clone())?;
            let (text, params) = match wire_entry {
                WireEntry::Plain(text) => {
                    let params = BTreeMap::new();
                    (
                        EntryText::Single(Template::parse(&id, &text, &params)?),
                        params,
                    )
                }
                WireEntry::Template(template) => {
                    let text =
                        EntryText::Single(Template::parse(&id, &template.text, &template.params)?);
                    (text, template.params)
                }
                WireEntry::Plural(plural) => {
                    if !plural
                        .params
                        .get("n")
                        .is_some_and(ParameterSchema::is_quantity)
                    {
                        return Err(invalid_catalog(
                            id.as_str(),
                            "plural entries require quantity n",
                        ));
                    }
                    let text = EntryText::Plural {
                        one: Template::parse(&id, &plural.one, &plural.params)?,
                        other: Template::parse(&id, &plural.other, &plural.params)?,
                    };
                    (text, plural.params)
                }
            };
            if params.keys().any(|name| !valid_name(name)) {
                return Err(invalid_catalog(&id, "invalid parameter name"));
            }
            entries.insert(text_id, Entry { text, params });
        }
        Ok(Self { language, entries })
    }

    /// Load the checked-in catalog for this migration milestone.
    ///
    /// # Errors
    /// Returns an error if a checked-in JSON catalog fails validation.
    pub fn embedded(language: Language) -> Result<Self, DisplayError> {
        let json = match language {
            Language::Ja => include_str!("../../locales/ja.json"),
            Language::En => include_str!("../../locales/en.json"),
        };
        let mut catalog = Self::from_json(language, json)?;
        let extra_json = match language {
            Language::Ja => [
                include_str!("../../locales/entities/species.ja.json"),
                include_str!("../../locales/entities/jobs.ja.json"),
                include_str!("../../locales/gameplay/canned.ja.json"),
                include_str!("../../locales/startup/ja.json"),
                include_str!("../../locales/hud/ja.json"),
                include_str!("../../locales/dynamic/ja.json"),
            ],
            Language::En => [
                include_str!("../../locales/entities/species.en.json"),
                include_str!("../../locales/entities/jobs.en.json"),
                include_str!("../../locales/gameplay/canned.en.json"),
                include_str!("../../locales/startup/en.json"),
                include_str!("../../locales/hud/en.json"),
                include_str!("../../locales/dynamic/en.json"),
            ],
        };
        for json in extra_json {
            let entities = Self::from_json(language, json)?;
            for (id, entry) in entities.entries {
                if catalog.entries.insert(id, entry).is_some() {
                    return Err(DisplayError::CatalogMismatch("duplicate catalog ID".into()));
                }
            }
        }
        Ok(catalog)
    }

    /// The selected presentation language.
    pub const fn language(&self) -> Language {
        self.language
    }

    /// Borrow every covered semantic identifier in stable sorted order.
    pub fn ids(&self) -> impl Iterator<Item = &str> {
        self.entries.keys().map(TextId::as_str)
    }

    /// Check complete bilingual ID parity and matching parameter signatures.
    ///
    /// # Errors
    /// Rejects missing IDs, different parameter kinds, or different plural shapes.
    pub fn validate_pair(first: &Self, second: &Self) -> Result<(), DisplayError> {
        let first_ids: BTreeSet<_> = first.entries.keys().collect();
        let second_ids: BTreeSet<_> = second.entries.keys().collect();
        if first_ids != second_ids {
            let missing_from_first: Vec<_> = second_ids
                .difference(&first_ids)
                .map(|id| id.as_str())
                .collect();
            let missing_from_second: Vec<_> = first_ids
                .difference(&second_ids)
                .map(|id| id.as_str())
                .collect();
            return Err(DisplayError::CatalogMismatch(format!(
                "missing from {}: {}; missing from {}: {}",
                first.language.code(),
                missing_from_first.join(", "),
                second.language.code(),
                missing_from_second.join(", ")
            )));
        }
        for (id, first_entry) in &first.entries {
            let Some(second_entry) = second.entries.get(id) else {
                return Err(DisplayError::CatalogMismatch(id.to_string()));
            };
            let first_plural = matches!(first_entry.text, EntryText::Plural { .. });
            let second_plural = matches!(second_entry.text, EntryText::Plural { .. });
            if first_entry.params != second_entry.params || first_plural != second_plural {
                return Err(DisplayError::CatalogMismatch(format!(
                    "different parameter schema for {id}"
                )));
            }
        }
        Ok(())
    }

    /// Render a semantic event to plain text, preserving arbitrary user names.
    ///
    /// English uses `one` for quantity 1 and `other` for every other quantity.
    /// Japanese always uses `other`, because Japanese has no English plural rule.
    ///
    /// # Errors
    /// Rejects absent IDs, absent or surplus parameters, null/structured values,
    /// and parameter values that do not match the entry's schema.
    pub fn render(&self, message: &Message) -> Result<String, DisplayError> {
        Ok(self.render_runs(message)?.into_text())
    }

    /// Render owned immutable text/runs. No input descriptor or control is modified.
    ///
    /// # Errors
    /// Rejects wrong scalar types, descriptor/source/version/domain/visibility
    /// mismatches, surplus fields, unregistered identities and output overflow.
    pub fn render_runs(&self, message: &Message) -> Result<RenderedText, DisplayError> {
        let id = message.id.as_str();
        let entry = self
            .entries
            .get(&message.id)
            .ok_or_else(|| DisplayError::MissingId(id.to_owned()))?;
        for parameter in message.params.keys() {
            if !entry.params.contains_key(parameter) {
                return Err(DisplayError::UnexpectedParameter {
                    id: id.to_owned(),
                    parameter: parameter.clone(),
                });
            }
        }
        let mut values = BTreeMap::new();
        for (parameter, schema) in &entry.params {
            let value =
                message
                    .params
                    .get(parameter)
                    .ok_or_else(|| DisplayError::MissingParameter {
                        id: id.to_owned(),
                        parameter: parameter.clone(),
                    })?;
            let rendered = match schema {
                ParameterSchema::Scalar(kind) => {
                    if !kind.accepts(value) {
                        return Err(DisplayError::ParameterType {
                            id: id.to_owned(),
                            parameter: parameter.clone(),
                            expected: kind.description(),
                        });
                    }
                    let text = value
                        .as_str()
                        .map_or_else(|| value.to_string(), str::to_owned);
                    RenderedText::literal(text, RunRole::Parameter)
                }
                ParameterSchema::Dynamic(schema) => schema.render(value, self.language, self),
            }
            .map_err(|error| DisplayError::DynamicParameter {
                id: id.to_owned(),
                parameter: parameter.clone(),
                reason: error.to_string(),
            })?;
            values.insert(parameter.clone(), rendered);
        }
        let one = self.language == Language::En
            && entry
                .params
                .get("n")
                .zip(message.params.get("n"))
                .is_some_and(|(schema, value)| schema.one(value).unwrap_or(false));
        let template = match &entry.text {
            EntryText::Single(template) => template,
            EntryText::Plural { one: template, .. } if one => template,
            EntryText::Plural { other, .. } => other,
        };
        template
            .render(&values)
            .map_err(|error| DisplayError::DynamicParameter {
                id: id.to_owned(),
                parameter: "output".into(),
                reason: error.to_string(),
            })
    }

    /// Render a label that declares no parameters.
    ///
    /// # Errors
    /// Returns an error if the ID is malformed, absent, or requires parameters.
    pub fn render_id(&self, id: &str) -> Result<String, DisplayError> {
        self.render(&Message::new(id)?)
    }
}

impl dynamic_text::LabelResolver for Catalog {
    fn label(&self, id: &str) -> Result<String, dynamic_text::DynamicError> {
        // Do not echo an unavailable hidden identity in public error output.
        self.render_id(id)
            .map_err(|_| dynamic_text::DynamicError::Invalid("registered label unavailable"))
    }
}

/// Preserve JSON duplicate-key evidence before serde_json::Value could discard it.
struct StrictValue(Value);
impl<'de> Deserialize<'de> for StrictValue {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct StrictVisitor;
        impl<'de> Visitor<'de> for StrictVisitor {
            type Value = StrictValue;
            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("JSON with unique object keys")
            }
            fn visit_bool<E: de::Error>(self, value: bool) -> Result<Self::Value, E> {
                Ok(StrictValue(value.into()))
            }
            fn visit_i64<E: de::Error>(self, value: i64) -> Result<Self::Value, E> {
                Ok(StrictValue(value.into()))
            }
            fn visit_u64<E: de::Error>(self, value: u64) -> Result<Self::Value, E> {
                Ok(StrictValue(value.into()))
            }
            fn visit_f64<E: de::Error>(self, value: f64) -> Result<Self::Value, E> {
                let number = serde_json::Number::from_f64(value)
                    .ok_or_else(|| E::custom("non-finite JSON number"))?;
                Ok(StrictValue(Value::Number(number)))
            }
            fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
                Ok(StrictValue(value.into()))
            }
            fn visit_string<E: de::Error>(self, value: String) -> Result<Self::Value, E> {
                Ok(StrictValue(value.into()))
            }
            fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
                Ok(StrictValue(Value::Null))
            }
            fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
                Ok(StrictValue(Value::Null))
            }
            fn visit_seq<M: SeqAccess<'de>>(
                self,
                mut sequence: M,
            ) -> Result<Self::Value, M::Error> {
                let mut values = Vec::new();
                while let Some(value) = sequence.next_element::<StrictValue>()? {
                    values.push(value.0);
                }
                Ok(StrictValue(Value::Array(values)))
            }
            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let mut values = serde_json::Map::new();
                while let Some((key, value)) = map.next_entry::<String, StrictValue>()? {
                    if values.insert(key, value.0).is_some() {
                        return Err(de::Error::custom("duplicate parameter object field"));
                    }
                }
                Ok(StrictValue(Value::Object(values)))
            }
        }
        deserializer.deserialize_any(StrictVisitor)
    }
}
fn deserialize_parameters<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<BTreeMap<String, Value>, D::Error> {
    let StrictValue(value) = StrictValue::deserialize(deserializer)?;
    match value {
        Value::Object(values) => Ok(values.into_iter().collect()),
        _ => Err(de::Error::custom("parameters must be an object")),
    }
}

fn valid_name(name: &str) -> bool {
    let mut bytes = name.bytes();
    matches!(bytes.next(), Some(b'a'..=b'z'))
        && bytes.all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
}

fn invalid_catalog(id: &str, reason: &str) -> DisplayError {
    DisplayError::InvalidCatalog(format!("{id}: {reason}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn checked_in_catalogs_have_complete_matching_coverage() {
        let en = Catalog::embedded(Language::En).unwrap();
        let ja = Catalog::embedded(Language::Ja).unwrap();
        Catalog::validate_pair(&en, &ja).unwrap();
        assert!(en.ids().count() >= 60);
        for id in en.ids() {
            let text_id = TextId::new(id).unwrap();
            let entry = en.entries.get(&text_id).unwrap();
            let params = entry
                .params
                .iter()
                .map(|(name, kind)| {
                    let value = match kind {
                        ParameterSchema::Dynamic(_) => {
                            crate::dynamic_text::test_parameter(id, name)
                        }
                        ParameterSchema::Scalar(kind) => match kind {
                            ParameterKind::Text => json!("猫<script>{n}</script>"),
                            ParameterKind::Decimal => json!("18446744073709551615"),
                            ParameterKind::Unsigned | ParameterKind::Quantity => json!(2),
                            ParameterKind::Integer => json!(-2),
                            ParameterKind::Number => json!(2.5),
                            ParameterKind::Boolean => json!(true),
                        },
                    };
                    (name.clone(), value)
                })
                .collect();
            let message = Message {
                id: text_id,
                params,
            };
            assert!(!en.render(&message).unwrap().is_empty(), "{id}");
            assert!(!ja.render(&message).unwrap().is_empty(), "{id}");
        }
    }

    #[test]
    fn japanese_is_the_default_language() {
        assert_eq!(Language::default(), Language::Ja);
        assert_eq!(
            serde_json::to_string(&Language::default()).unwrap(),
            "\"ja\""
        );
    }
    #[test]
    fn decimal_parameters_preserve_full_u64_and_reject_noncanonical_values() {
        for language in [Language::Ja, Language::En] {
            let catalog = Catalog::embedded(language).unwrap();
            for decimal in ["0", "9007199254740993", "18446744073709551615"] {
                let message = Message::new("rng.seed").unwrap().with("seed", decimal);
                assert!(catalog.render(&message).unwrap().contains(decimal));
            }
            for value in [
                json!(42),
                json!(""),
                json!("01"),
                json!("+1"),
                json!("-1"),
                json!("18446744073709551616"),
            ] {
                let message = Message::new("rng.seed").unwrap().with("seed", value);
                assert!(matches!(
                    catalog.render(&message),
                    Err(DisplayError::ParameterType { .. })
                ));
            }
        }
    }

    #[test]
    fn user_name_is_preserved_and_is_never_reinterpreted_as_template_or_html() {
        let catalog = Catalog::embedded(Language::Ja).unwrap();
        let player = "Alice 猫 <img src=x onerror=evil()> {seed} & '";
        let message = Message::new("status.player")
            .unwrap()
            .with("player", player);
        assert_eq!(
            catalog.render(&message).unwrap(),
            format!("プレイヤー：{player}")
        );
    }

    #[test]
    fn rendering_is_repeatable_and_does_not_mutate_message_or_catalog() {
        let catalog = Catalog::embedded(Language::En).unwrap();
        let message = Message::new("rng.sample").unwrap().with("value", u64::MAX);
        let before = serde_json::to_string(&message).unwrap();
        let first = catalog.render(&message).unwrap();
        for _ in 0..50 {
            assert_eq!(catalog.render(&message).unwrap(), first);
        }
        assert_eq!(serde_json::to_string(&message).unwrap(), before);
    }

    #[test]
    fn missing_semantic_ids_fail_instead_of_showing_english_fallbacks() {
        let catalog = Catalog::embedded(Language::Ja).unwrap();
        assert_eq!(
            catalog.render_id("unmigrated.monster_name").unwrap_err(),
            DisplayError::MissingId("unmigrated.monster_name".to_owned())
        );
    }

    #[test]
    fn missing_and_unexpected_parameters_fail() {
        let catalog = Catalog::embedded(Language::En).unwrap();
        assert!(matches!(
            catalog.render(&Message::new("rng.seed").unwrap()),
            Err(DisplayError::MissingParameter { .. })
        ));
        let surplus = Message::new("rng.seed")
            .unwrap()
            .with("seed", 1)
            .with("player", "Alice");
        assert!(matches!(
            catalog.render(&surplus),
            Err(DisplayError::UnexpectedParameter { .. })
        ));
    }

    #[test]
    fn numeric_strings_and_structured_values_are_rejected() {
        let catalog = Catalog::embedded(Language::En).unwrap();
        for value in [
            json!("1"),
            json!(-1),
            json!(1.5),
            json!(null),
            json!([1]),
            json!({"x":1}),
        ] {
            let message = Message::new("rng.sample").unwrap().with("value", value);
            assert!(matches!(
                catalog.render(&message),
                Err(DisplayError::ParameterType { .. })
            ));
        }
    }

    #[test]
    fn english_quantity_forms_and_japanese_counting_are_explicit() {
        let en = Catalog::embedded(Language::En).unwrap();
        let ja = Catalog::embedded(Language::Ja).unwrap();
        for (n, expected) in [
            (0, "Preview 0 samples"),
            (1, "Preview 1 sample"),
            (2, "Preview 2 samples"),
        ] {
            let message = Message::new("rng.preview").unwrap().with("n", n);
            assert_eq!(en.render(&message).unwrap(), expected);
            assert_eq!(ja.render(&message).unwrap(), format!("{n} 件の乱数を確認"));
        }
    }

    #[test]
    fn quantity_must_be_a_nonnegative_integer() {
        let catalog = Catalog::embedded(Language::En).unwrap();
        for value in [json!(-1), json!(1.1), json!("1")] {
            let message = Message::new("rng.preview").unwrap().with("n", value);
            assert!(matches!(
                catalog.render(&message),
                Err(DisplayError::ParameterType { .. })
            ));
        }
    }

    #[test]
    fn japanese_never_uses_the_english_one_category() {
        let catalog = Catalog::from_json(
            Language::Ja,
            r#"{"rng.preview":{"one":"wrong {n}","other":"{n} 件","params":{"n":"quantity"}}}"#,
        )
        .unwrap();
        let message = Message::new("rng.preview").unwrap().with("n", 1);
        assert_eq!(catalog.render(&message).unwrap(), "1 件");
    }

    #[test]
    fn invalid_ids_fail_on_construction_and_deserialization() {
        for invalid in [
            "",
            "label",
            "App.title",
            "app..title",
            "app.title-text",
            ".title",
            "app.1title",
            "app.名前",
        ] {
            assert!(TextId::new(invalid).is_err(), "{invalid}");
            assert!(
                serde_json::from_value::<TextId>(json!(invalid)).is_err(),
                "{invalid}"
            );
        }
    }

    #[test]
    fn catalogs_reject_duplicate_ids_unknown_fields_and_invalid_placeholders() {
        for json in [
            r#"{"app.title":"first","app.title":"second"}"#,
            r#"{"app.title":{"text":"Title","params":{},"html":true}}"#,
            r#"{"rng.seed":{"text":"Seed {seed}","params":{}}}"#,
            r#"{"rng.seed":{"text":"Seed","params":{"seed":"unsigned"}}}"#,
            r#"{"app.title":"Title {"}"#,
            r#"{"app.title":"Title }"}"#,
            r#"{"app.title":"Title {bad name}"}"#,
            r#"{"rng.preview":{"one":"{n} sample","other":"{n} samples","params":{"n":"number"}}}"#,
            r#"{"rng.preview":{"one":"one","other":"{n} samples","params":{"n":"quantity"}}}"#,
        ] {
            assert!(Catalog::from_json(Language::En, json).is_err(), "{json}");
        }
    }

    #[test]
    fn catalog_pair_rejects_missing_ids_and_type_mismatches() {
        let en = Catalog::from_json(
            Language::En,
            r#"{"rng.seed":{"text":"{seed}","params":{"seed":"unsigned"}}}"#,
        )
        .unwrap();
        let missing = Catalog::from_json(Language::Ja, r#"{"app.title":"題名"}"#).unwrap();
        let mismatch = Catalog::from_json(
            Language::Ja,
            r#"{"rng.seed":{"text":"{seed}","params":{"seed":"text"}}}"#,
        )
        .unwrap();
        assert!(Catalog::validate_pair(&en, &missing).is_err());
        assert!(Catalog::validate_pair(&en, &mismatch).is_err());
    }

    #[test]
    fn escaped_braces_are_catalog_literals_and_parameters_are_substituted_once() {
        let catalog = Catalog::from_json(
            Language::En,
            r#"{"help.syntax":{"text":"{{name}} = {name}; {name}","params":{"name":"text"}}}"#,
        )
        .unwrap();
        let message = Message::new("help.syntax").unwrap().with("name", "{name}");
        assert_eq!(catalog.render(&message).unwrap(), "{name} = {name}; {name}");
    }

    #[test]
    fn message_round_trip_preserves_semantic_id_and_parameter_types() {
        let message = Message::new("dice.result")
            .unwrap()
            .with("count", 3)
            .with("sides", 6)
            .with("result", 11);
        let serialized = serde_json::to_string(&message).unwrap();
        let decoded: Message = serde_json::from_str(&serialized).unwrap();
        assert_eq!(decoded, message);
    }
}
