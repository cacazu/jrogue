//! Presentation-only semantic text resolution for original ToME `_t`/`tformat` hooks.
//! Templates and formatting metadata are returned to Lua; gameplay state and RNG
//! are neither read nor modified. External parameter values remain untouched.

use serde::{Deserialize, Deserializer, Serialize, de};
use std::collections::{BTreeMap, HashMap};
use std::fmt;

#[derive(Debug)]
struct UniqueMap<T>(BTreeMap<String, T>);

impl<'de, T: Deserialize<'de>> Deserialize<'de> for UniqueMap<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct MapVisitor<T>(std::marker::PhantomData<T>);
        impl<'de, T: Deserialize<'de>> de::Visitor<'de> for MapVisitor<T> {
            type Value = UniqueMap<T>;
            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("an object with unique semantic text IDs")
            }
            fn visit_map<A: de::MapAccess<'de>>(
                self,
                mut access: A,
            ) -> Result<Self::Value, A::Error> {
                let mut result = BTreeMap::new();
                while let Some((key, value)) = access.next_entry::<String, T>()? {
                    if result.insert(key.clone(), value).is_some() {
                        return Err(de::Error::custom(format!(
                            "duplicate semantic text ID: {key}"
                        )));
                    }
                }
                Ok(UniqueMap(result))
            }
        }
        deserializer.deserialize_map(MapVisitor(std::marker::PhantomData))
    }
}

/// Locale selection is explicit; Japanese is the product default.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Locale {
    /// Original English templates.
    #[serde(rename = "en_US")]
    English,
    /// Official Japanese templates, with reported English fallback for gaps.
    #[default]
    #[serde(rename = "ja_JP")]
    Japanese,
}

/// Original Lua caller location, used only to select an owning semantic alias.
#[derive(Debug, Default, Clone, Copy)]
pub struct Callsite<'a> {
    /// Lua virtual path or physical path, optionally prefixed by `@`.
    pub file: Option<&'a str>,
    /// Lua `debug.getinfo` current line; this is not part of a semantic ID.
    pub line: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct SourceLocation {
    file: String,
    line: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct PrintfContract {
    safe: bool,
}

#[derive(Debug, Deserialize)]
struct Entry {
    owner: String,
    tag: String,
    japanese_args_order: Vec<usize>,
    special_tokens: Vec<serde_json::Value>,
    printf_contract: PrintfContract,
    source_locations: Vec<SourceLocation>,
}

#[derive(Debug, Deserialize)]
struct Route {
    source: String,
    tag: String,
    default_id: Option<String>,
    aliases: Vec<String>,
    format_ambiguity: bool,
}

#[derive(Debug, Deserialize)]
struct Registry {
    schema_version: u32,
    entries: UniqueMap<Entry>,
    routes: Vec<Route>,
    japanese_configuration: Vec<serde_json::Value>,
}

/// An explicit error prevents invented text or arbitrary context selection.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TextError {
    /// JSON syntax/schema/duplicate ID error.
    InvalidJson(String),
    /// Catalogue or route references disagree.
    InvalidCatalogue(String),
    /// No registered source/tag route exists.
    UnknownSourceTag,
    /// No such semantic ID exists.
    UnknownId,
    /// Caller context is necessary to choose different formatting contracts.
    AmbiguousContext,
}

impl fmt::Display for TextError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson(message) => write!(formatter, "invalid localization JSON: {message}"),
            Self::InvalidCatalogue(message) => {
                write!(formatter, "invalid localization catalogue: {message}")
            }
            Self::UnknownSourceTag => formatter.write_str("unknown original source/tag text route"),
            Self::UnknownId => formatter.write_str("unknown semantic text ID"),
            Self::AmbiguousContext => {
                formatter.write_str("caller context is required for this text route")
            }
        }
    }
}
impl std::error::Error for TextError {}

/// Serializable result passed through a Lua/browser/native platform adapter.
#[derive(Debug, Serialize)]
pub struct ResolvedTemplate<'a> {
    /// Stable catalogue ID selected from the source's actual owning context.
    pub id: &'a str,
    /// Selected template. Parameter values are formatted by the original Lua VM.
    pub template: &'a str,
    /// Original owning definition/module/method context.
    pub owner: &'a str,
    /// Native tag used by original I18N.
    pub tag: &'a str,
    /// Japanese positional argument mapping; empty for English or fallback.
    pub args_order: &'a [usize],
    /// An official translation is absent; the template is explicitly English.
    pub missing_official_japanese: bool,
    /// Original locale-special processing must be delegated to retained Lua.
    pub delegate_native_special: bool,
    /// A known upstream placeholder contract requires retained native formatting.
    pub delegate_native_format_review: bool,
}

/// Immutable presentation catalogue. It has no platform, simulation or RNG hooks.
#[derive(Debug)]
pub struct Catalogue {
    english: BTreeMap<String, String>,
    japanese: BTreeMap<String, Option<String>>,
    entries: BTreeMap<String, Entry>,
    routes: HashMap<(String, String), Route>,
    source_routes: BTreeMap<String, Vec<(String, String)>>,
    japanese_configuration: Vec<serde_json::Value>,
}

impl Catalogue {
    /// Load generated catalogues, rejecting duplicate IDs and invalid references.
    ///
    /// # Errors
    /// Returns [`TextError`] for invalid JSON, incompatible schema, missing keys,
    /// invalid argument indices or duplicate source/tag routes.
    pub fn from_json(english: &str, japanese: &str, registry: &str) -> Result<Self, TextError> {
        let english: UniqueMap<String> = serde_json::from_str(english)
            .map_err(|error| TextError::InvalidJson(error.to_string()))?;
        let japanese: UniqueMap<Option<String>> = serde_json::from_str(japanese)
            .map_err(|error| TextError::InvalidJson(error.to_string()))?;
        let registry: Registry = serde_json::from_str(registry)
            .map_err(|error| TextError::InvalidJson(error.to_string()))?;
        if registry.schema_version != 1 {
            return Err(TextError::InvalidCatalogue(
                "unsupported schema version".into(),
            ));
        }
        if english.0.keys().ne(japanese.0.keys()) || english.0.keys().ne(registry.entries.0.keys())
        {
            return Err(TextError::InvalidCatalogue(
                "English/Japanese/registry ID coverage differs".into(),
            ));
        }
        for (id, entry) in &registry.entries.0 {
            if id.is_empty()
                || !id.bytes().all(|byte| {
                    byte.is_ascii_lowercase()
                        || byte.is_ascii_digit()
                        || matches!(byte, b'_' | b'.')
                })
            {
                return Err(TextError::InvalidCatalogue(format!(
                    "invalid semantic ID: {id}"
                )));
            }
            let template = english.0.get(id).ok_or(TextError::UnknownId)?;
            let count = printf_argument_count(template);
            if entry
                .japanese_args_order
                .iter()
                .any(|index| *index == 0 || *index > count)
            {
                return Err(TextError::InvalidCatalogue(format!(
                    "out-of-range printf argument mapping: {id}"
                )));
            }
            // Lua treats "" as present; official articles and suffixes use it.
            // Only JSON null means an absent Japanese translation.
            if entry.printf_contract.safe && entry.special_tokens.is_empty() {
                if let Some(target) = japanese.0.get(id).and_then(Option::as_ref) {
                    let source_types = printf_parameter_types(template);
                    let target_types = printf_parameter_types(target);
                    let arguments = if entry.japanese_args_order.is_empty() {
                        source_types
                    } else {
                        entry
                            .japanese_args_order
                            .iter()
                            .map(|index| source_types[index - 1])
                            .collect()
                    };
                    if target_types.len() > arguments.len()
                        || target_types
                            .iter()
                            .zip(&arguments)
                            .any(|(target, source)| target != source)
                    {
                        return Err(TextError::InvalidCatalogue(format!(
                            "unsafe printf contract declared safe: {id}"
                        )));
                    }
                }
            }
        }
        let mut routes = HashMap::new();
        let mut source_routes: BTreeMap<String, Vec<(String, String)>> = BTreeMap::new();
        for route in registry.routes {
            if route.aliases.is_empty() {
                return Err(TextError::InvalidCatalogue(
                    "route without owning semantic aliases".into(),
                ));
            }
            for id in &route.aliases {
                let entry = registry.entries.0.get(id).ok_or_else(|| {
                    TextError::InvalidCatalogue(format!("unknown route ID: {id}"))
                })?;
                if english.0.get(id) != Some(&route.source) || entry.tag != route.tag {
                    return Err(TextError::InvalidCatalogue(format!(
                        "route source/tag differs from its semantic ID: {id}"
                    )));
                }
            }
            if route
                .default_id
                .as_ref()
                .is_some_and(|id| !route.aliases.contains(id))
                || route.format_ambiguity && route.default_id.is_some()
            {
                return Err(TextError::InvalidCatalogue(
                    "invalid route default/ambiguity".into(),
                ));
            }
            let key = (route.source.clone(), route.tag.clone());
            source_routes
                .entry(route.source.clone())
                .or_default()
                .push(key.clone());
            if routes.insert(key, route).is_some() {
                return Err(TextError::InvalidCatalogue(
                    "duplicate original source/tag route".into(),
                ));
            }
        }
        Ok(Self {
            english: english.0,
            japanese: japanese.0,
            entries: registry.entries.0,
            routes,
            source_routes,
            japanese_configuration: registry.japanese_configuration,
        })
    }

    /// Number of registered semantic IDs.
    #[must_use]
    pub fn len(&self) -> usize {
        self.entries.len()
    }
    /// Whether no semantic IDs are registered.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
    /// Original Japanese font, CJK wrapping and artifact-name configuration.
    #[must_use]
    pub fn japanese_configuration(&self) -> &[serde_json::Value] {
        &self.japanese_configuration
    }

    /// Resolve an already-known semantic ID; Japanese is selected explicitly.
    ///
    /// # Errors
    /// Returns [`TextError::UnknownId`] for unregistered IDs.
    pub fn resolve_id(&self, id: &str, locale: Locale) -> Result<ResolvedTemplate<'_>, TextError> {
        let (stored_id, entry) = self.entries.get_key_value(id).ok_or(TextError::UnknownId)?;
        let english = self.english.get(id).ok_or(TextError::UnknownId)?;
        let japanese = self.japanese.get(id).and_then(Option::as_ref);
        let selected_japanese = locale == Locale::Japanese && japanese.is_some();
        Ok(ResolvedTemplate {
            id: stored_id,
            template: if selected_japanese {
                japanese.map_or(english.as_str(), String::as_str)
            } else {
                english
            },
            owner: &entry.owner,
            tag: &entry.tag,
            args_order: if selected_japanese {
                &entry.japanese_args_order
            } else {
                &[]
            },
            missing_official_japanese: locale == Locale::Japanese && japanese.is_none(),
            delegate_native_special: selected_japanese && !entry.special_tokens.is_empty(),
            delegate_native_format_review: selected_japanese && !entry.printf_contract.safe,
        })
    }

    /// Resolve an original `_t`/`tformat` call without changing its source string.
    /// Exact tags win. Unknown-tag fallback is allowed only when all known tag
    /// variants resolve to the same template and formatting contract.
    ///
    /// # Errors
    /// Returns [`TextError`] for unmapped sources or ambiguous caller context.
    pub fn resolve(
        &self,
        source: &str,
        tag: &str,
        callsite: Callsite<'_>,
        locale: Locale,
    ) -> Result<ResolvedTemplate<'_>, TextError> {
        let key = (source.to_owned(), tag.to_owned());
        if let Some(route) = self.routes.get(&key) {
            return self.resolve_route(route, callsite, locale);
        }
        let keys = self
            .source_routes
            .get(source)
            .ok_or(TextError::UnknownSourceTag)?;
        let mut selected = None;
        for key in keys {
            let route = self.routes.get(key).ok_or(TextError::UnknownSourceTag)?;
            let resolved = self.resolve_route(route, callsite, locale)?;
            if let Some(previous) = &selected {
                let previous: &ResolvedTemplate<'_> = previous;
                if previous.template != resolved.template
                    || previous.args_order != resolved.args_order
                    || previous.delegate_native_special != resolved.delegate_native_special
                    || previous.delegate_native_format_review
                        != resolved.delegate_native_format_review
                {
                    return Err(TextError::AmbiguousContext);
                }
            } else {
                selected = Some(resolved);
            }
        }
        selected.ok_or(TextError::UnknownSourceTag)
    }

    fn resolve_route(
        &self,
        route: &Route,
        callsite: Callsite<'_>,
        locale: Locale,
    ) -> Result<ResolvedTemplate<'_>, TextError> {
        let normalized = callsite.file.map(|file| {
            file.trim_start_matches('@')
                .replace('\\', "/")
                .trim_start_matches('/')
                .to_owned()
        });
        let mut matches = Vec::new();
        if let Some(file) = &normalized {
            for id in &route.aliases {
                let entry = self.entries.get(id).ok_or(TextError::UnknownId)?;
                for location in &entry.source_locations {
                    if location.file == *file
                        || location.file.ends_with(&format!("/{file}"))
                        || file.ends_with(&format!("/{}", location.file))
                    {
                        let distance = match (callsite.line, location.line) {
                            (Some(a), Some(b)) => a.abs_diff(b),
                            _ => u32::MAX,
                        };
                        matches.push((distance, id));
                    }
                }
            }
        }
        matches.sort_by(|(a_distance, a_id), (b_distance, b_id)| {
            a_distance.cmp(b_distance).then_with(|| a_id.cmp(b_id))
        });
        if let Some((_, id)) = matches.first() {
            return self.resolve_id(id, locale);
        }
        self.resolve_id(
            route
                .default_id
                .as_deref()
                .ok_or(TextError::AmbiguousContext)?,
            locale,
        )
    }
}

fn printf_argument_count(template: &str) -> usize {
    printf_parameter_types(template).len()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ParameterType {
    Number,
    String,
}

fn printf_parameter_types(template: &str) -> Vec<ParameterType> {
    let bytes = template.as_bytes();
    let mut index = 0;
    let mut parameters = Vec::new();
    while index < bytes.len() {
        if bytes[index] != b'%' {
            index += 1;
            continue;
        }
        index += 1;
        if bytes.get(index) == Some(&b'%') {
            index += 1;
            continue;
        }
        while index < bytes.len()
            && (bytes[index].is_ascii_digit() || b"-+ #0.$".contains(&bytes[index]))
        {
            index += 1;
        }
        if let Some(byte) = bytes
            .get(index)
            .filter(|byte| b"cdiouxXeEfgGqsaA".contains(byte))
        {
            parameters.push(if b"sq".contains(byte) {
                ParameterType::String
            } else {
                ParameterType::Number
            });
            index += 1;
        }
    }
    parameters
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Catalogue {
        Catalogue::from_json(r#"{"tome.ui.accept":"Accept %s","tome.quest.accept":"Accept %s","tome.ui.gap":"Missing"}"#, r#"{"tome.ui.accept":"%sを受諾","tome.quest.accept":"%sを承諾","tome.ui.gap":null}"#, r#"{"schema_version":1,"japanese_configuration":[],"entries":{"tome.ui.accept":{"owner":"UI","tag":"_t","japanese_args_order":[],"special_tokens":[],"printf_contract":{"safe":true},"source_locations":[{"file":"game/modules/tome/mod/dialogs/UI.lua","line":10}]},"tome.quest.accept":{"owner":"quest","tag":"quest","japanese_args_order":[],"special_tokens":[],"printf_contract":{"safe":true},"source_locations":[]},"tome.ui.gap":{"owner":"UI","tag":"_t","japanese_args_order":[],"special_tokens":[],"printf_contract":{"safe":true},"source_locations":[]}},"routes":[{"source":"Accept %s","tag":"_t","default_id":"tome.ui.accept","aliases":["tome.ui.accept"],"format_ambiguity":false},{"source":"Accept %s","tag":"quest","default_id":"tome.quest.accept","aliases":["tome.quest.accept"],"format_ambiguity":false},{"source":"Missing","tag":"_t","default_id":"tome.ui.gap","aliases":["tome.ui.gap"],"format_ambiguity":false}]}"#).expect("valid fixture")
    }
    #[test]
    fn exact_tag_and_external_parameters_remain_distinct() {
        let catalog = fixture();
        let resolved = catalog
            .resolve(
                "Accept %s",
                "_t",
                Callsite {
                    file: Some("@/mod/dialogs/UI.lua"),
                    line: Some(10),
                },
                Locale::Japanese,
            )
            .expect("registered source");
        assert_eq!(resolved.id, "tome.ui.accept");
        assert_eq!(resolved.template, "%sを受諾");
        assert!(resolved.args_order.is_empty());
        assert_eq!(
            catalog
                .resolve("Accept %s", "quest", Callsite::default(), Locale::Japanese)
                .expect("tagged source")
                .template,
            "%sを承諾"
        );
    }
    #[test]
    fn missing_official_translation_is_explicit() {
        let catalog = fixture();
        let resolved = catalog
            .resolve_id("tome.ui.gap", Locale::Japanese)
            .expect("known ID");
        assert_eq!(resolved.template, "Missing");
        assert!(resolved.missing_official_japanese);
    }
    #[test]
    fn physical_path_selects_owner_when_no_default_is_permitted() {
        let mut catalog = fixture();
        catalog
            .routes
            .get_mut(&("Accept %s".to_owned(), "_t".to_owned()))
            .expect("fixture route")
            .default_id = None;
        let resolved = catalog
            .resolve(
                "Accept %s",
                "_t",
                Callsite {
                    file: Some("@C:/source/game/modules/tome/mod/dialogs/UI.lua"),
                    line: Some(10),
                },
                Locale::Japanese,
            )
            .expect("physical path identifies an actual source owner");
        assert_eq!(resolved.id, "tome.ui.accept");
    }
    #[test]
    fn conflicting_unknown_tag_needs_original_context() {
        assert!(matches!(
            fixture().resolve(
                "Accept %s",
                "unknown",
                Callsite::default(),
                Locale::Japanese
            ),
            Err(TextError::AmbiguousContext)
        ));
    }
    #[test]
    fn duplicate_ids_are_rejected_before_last_write_can_hide_them() {
        assert!(
            matches!(Catalogue::from_json(r#"{"same":"a","same":"b"}"#, "{}", "{}"), Err(TextError::InvalidJson(message)) if message.contains("duplicate semantic"))
        );
    }
    #[test]
    fn printf_escaping_and_numeric_specifiers_are_counted() {
        assert_eq!(printf_argument_count("%% %02d %+0.2f %s %q"), 4);
    }
    #[test]
    fn official_empty_translation_is_present_and_does_not_fall_back() {
        let catalog = Catalogue::from_json(
            r#"{"tome.grammar.article":"an"}"#,
            r#"{"tome.grammar.article":""}"#,
            r#"{"schema_version":1,"japanese_configuration":[],"entries":{"tome.grammar.article":{"owner":"grammar.article","tag":"_t","japanese_args_order":[],"special_tokens":[],"printf_contract":{"safe":true},"source_locations":[]}},"routes":[{"source":"an","tag":"_t","default_id":"tome.grammar.article","aliases":["tome.grammar.article"],"format_ambiguity":false}]}"#,
        )
        .expect("valid official empty translation");
        let resolved = catalog
            .resolve_id("tome.grammar.article", Locale::Japanese)
            .expect("present semantic article");
        assert_eq!(resolved.template, "");
        assert!(!resolved.missing_official_japanese);
        assert_eq!(
            catalog
                .resolve_id("tome.grammar.article", Locale::English)
                .expect("original English article")
                .template,
            "an"
        );
    }
    #[test]
    fn full_original_catalogue_routes_and_en_ja_keys_are_valid() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("catalogs");
        let catalog = Catalogue::from_json(
            &std::fs::read_to_string(root.join("en.json")).expect("generated en"),
            &std::fs::read_to_string(root.join("ja.json")).expect("generated ja"),
            &std::fs::read_to_string(root.join("registry.json")).expect("generated registry"),
        )
        .expect("full catalogue contract");
        assert!(catalog.len() >= 20_221);
        assert_eq!(catalog.japanese_configuration().len(), 3);
        for route in catalog.routes.values() {
            for id in &route.aliases {
                assert_eq!(
                    catalog
                        .resolve_id(id, Locale::English)
                        .expect("all original IDs")
                        .template,
                    route.source
                );
            }
        }
        let berserker = catalog
            .resolve(
                "Berserker",
                "birth descriptor name",
                Callsite::default(),
                Locale::Japanese,
            )
            .expect("actual birth text");
        assert_eq!(berserker.template, "狂戦士");
        assert!(!berserker.missing_official_japanese);
    }
}
