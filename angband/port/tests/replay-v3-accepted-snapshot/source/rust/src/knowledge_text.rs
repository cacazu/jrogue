//! Immutable, source-reviewed knowledge text and parameter declarations.
//!
//! Canonical data selection, visibility and arithmetic remain in their original
//! C branches. This module never reads game objects, RNG or native buffers.

#[path = "knowledge_sections.rs"]
mod sections;

use crate::localization::json::{self, JsonValue, Limits};
use crate::text::Locale;
use std::collections::BTreeMap;
use std::fmt;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum KnowledgeTextError {
    InvalidJson(String),
    InvalidCatalog(&'static str),
    MissingIdentity(String),
}

impl fmt::Display for KnowledgeTextError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson(value) => write!(f, "knowledge JSON: {value}"),
            Self::InvalidCatalog(value) => write!(f, "invalid knowledge catalog: {value}"),
            Self::MissingIdentity(value) => write!(f, "unknown knowledge identity: {value}"),
        }
    }
}
impl std::error::Error for KnowledgeTextError {}

/// Parameter types are declarations, not English-string classification.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum KnowledgeParameterType {
    LocalizedText,
    KnownObjectDescription,
    SignedInteger,
    Integer,
    LocalizedTextList,
    KnowledgeSection,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReviewedKnowledgeCatalog {
    english: BTreeMap<String, String>,
    japanese: BTreeMap<String, String>,
    parameters: BTreeMap<String, BTreeMap<String, KnowledgeParameterType>>,
}

fn parse(input: &str) -> Result<JsonValue, KnowledgeTextError> {
    json::parse(input, Limits { max_bytes: 4 * 1024 * 1024, max_depth: 4,
        max_nodes: 32_768, max_string_bytes: 8192 })
        .map_err(|error| KnowledgeTextError::InvalidJson(error.to_string()))
}

fn valid_identity(id: &str) -> bool {
    id.starts_with("angband.knowledge.") && id.len() <= 255 &&
        id.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

impl ReviewedKnowledgeCatalog {
    /// Load checked-in immutable dictionaries; no external input or game state.
    pub fn embedded() -> Result<Self, KnowledgeTextError> {
        Self::from_json(include_str!("../../migration/knowledge-text-data/en.json"),
            include_str!("../../migration/knowledge-text-data/ja.json"),
            include_str!("../../migration/knowledge-text-data/schema.json"))
    }

    /// Reject mismatched identities, unknown parameter types and nontext values.
    pub fn from_json(en: &str, ja: &str, schema: &str) -> Result<Self, KnowledgeTextError> {
        fn dictionary(input: &str) -> Result<BTreeMap<String, String>, KnowledgeTextError> {
            let value = parse(input)?;
            let fields = value.as_object().ok_or(KnowledgeTextError::InvalidCatalog("expected dictionary"))?;
            fields.iter().map(|(id, text)| {
                if !valid_identity(id) { return Err(KnowledgeTextError::InvalidCatalog("identity syntax")); }
                let text = text.as_str().ok_or(KnowledgeTextError::InvalidCatalog("expected text"))?;
                if text.contains('\0') { return Err(KnowledgeTextError::InvalidCatalog("embedded NUL")); }
                Ok((id.clone(), text.to_owned()))
            }).collect()
        }
        let english = dictionary(en)?;
        let japanese = dictionary(ja)?;
        if english.keys().ne(japanese.keys()) {
            return Err(KnowledgeTextError::InvalidCatalog("EN/JA identities differ"));
        }
        let schema = parse(schema)?;
        let rows = schema.as_object().ok_or(KnowledgeTextError::InvalidCatalog("expected schema"))?;
        let parameters: BTreeMap<String, BTreeMap<String, KnowledgeParameterType>> = rows.iter().map(|(id, value)| {
            if !valid_identity(id) { return Err(KnowledgeTextError::InvalidCatalog("schema identity syntax")); }
            let fields = value.as_object().ok_or(KnowledgeTextError::InvalidCatalog("expected parameter map"))?;
            let params = fields.iter().map(|(name, kind)| {
                if name.is_empty() || !name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') {
                    return Err(KnowledgeTextError::InvalidCatalog("parameter name syntax"));
                }
                let kind = match kind.as_str() {
                    Some("localized_text") => KnowledgeParameterType::LocalizedText,
                    Some("KnownObjectDescription") => KnowledgeParameterType::KnownObjectDescription,
                    Some("signed_integer") => KnowledgeParameterType::SignedInteger,
                    Some("integer") => KnowledgeParameterType::Integer,
                    Some("localized_text_list") => KnowledgeParameterType::LocalizedTextList,
                    Some("KnowledgeSection") => KnowledgeParameterType::KnowledgeSection,
                    _ => return Err(KnowledgeTextError::InvalidCatalog("unknown parameter type")),
                };
                Ok((name.clone(), kind))
            }).collect::<Result<BTreeMap<_, _>, _>>()?;
            Ok((id.clone(), params))
        }).collect::<Result<_, _>>()?;
        if english.keys().ne(parameters.keys()) {
            return Err(KnowledgeTextError::InvalidCatalog("schema identities differ"));
        }
        Ok(Self { english, japanese, parameters })
    }

    #[must_use]
    pub fn len(&self) -> usize { self.english.len() }
    #[must_use]
    pub fn is_empty(&self) -> bool { self.english.is_empty() }

    /// Return source-reviewed text; nested parameters are resolved by the
    /// existing strict semantic presentation adapter, never by game queries.
    pub fn text(&self, id: &str, locale: Locale) -> Result<&str, KnowledgeTextError> {
        let dictionary = match locale { Locale::English => &self.english, Locale::Japanese => &self.japanese };
        dictionary.get(id).map(String::as_str)
            .ok_or_else(|| KnowledgeTextError::MissingIdentity(id.to_owned()))
    }

    /// Expose exact reviewed parameter declarations to the FFI registry.
    pub fn parameter_schema(&self, id: &str) -> Result<&BTreeMap<String, KnowledgeParameterType>, KnowledgeTextError> {
        self.parameters.get(id).ok_or_else(|| KnowledgeTextError::MissingIdentity(id.to_owned()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn complete_source_catalog_has_exact_declared_fields() {
        let catalog = ReviewedKnowledgeCatalog::embedded().unwrap();
        assert_eq!(catalog.len(), 1153);
        assert!(!catalog.is_empty());
        assert_eq!(catalog.parameter_schema("angband.knowledge.object_property.notice.sustain_glow").unwrap()["name"],
            KnowledgeParameterType::KnownObjectDescription);
    }
    #[test]
    fn resistance_and_uncertainty_preserve_source_meaning() {
        let catalog = ReviewedKnowledgeCatalog::embedded().unwrap();
        assert_eq!(catalog.text("angband.knowledge.grammar.rune.description.resist", Locale::Japanese).unwrap(),
            "このアイテムはあなたの{element}耐性に影響する。");
        assert!(catalog.text("angband.knowledge.monster.the_tarrasque.description", Locale::Japanese).unwrap().contains("噂"));
    }
    #[test]
    fn invalid_ids_unknown_types_and_extra_schema_fields_are_rejected() {
        let valid = r#"{"angband.knowledge.test":"test"}"#;
        assert!(ReviewedKnowledgeCatalog::from_json(valid, "{}", "{}").is_err());
        assert!(ReviewedKnowledgeCatalog::from_json(valid, valid, r#"{"angband.knowledge.test":{"name":"hidden_game_state"}}"#).is_err());
        assert!(ReviewedKnowledgeCatalog::from_json(valid, valid, r#"{"angband.knowledge.test":{},"angband.knowledge.extra":{}}"#).is_err());
        assert!(ReviewedKnowledgeCatalog::from_json(r#"{"bad":"text"}"#, r#"{"bad":"text"}"#, r#"{"bad":{}}"#).is_err());
    }
    #[test]
    fn locale_selection_is_pure_and_unknown_fields_fail_closed() {
        let catalog = ReviewedKnowledgeCatalog::embedded().unwrap();
        let before = catalog.clone();
        let id = "angband.knowledge.rune.combat.to_a.name";
        assert_eq!(catalog.text(id, Locale::English).unwrap(), "enchantment to armor");
        assert_eq!(catalog.text(id, Locale::Japanese).unwrap(), "防御力の強化");
        assert_eq!(catalog, before);
        assert!(catalog.text("angband.knowledge.monster.hidden.description", Locale::Japanese).is_err());
    }
}
