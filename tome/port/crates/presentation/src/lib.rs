//! Read-only views and semantic text catalogs for the mechanics workbench.
//! Rendering borrows domain state and cannot consume its random-number generator.

use serde::de::{MapAccess, Visitor};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fmt;
use tome_logic::{Argument, Energy, Parameters, State, rules};

/// Supported display languages. Japanese is the default.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
    #[default]
    Ja,
    En,
}

impl Locale {
    /// Parse a persisted language code; unknown codes do not silently fall back.
    ///
    /// # Errors
    /// Returns an unsupported-language error for any other code.
    pub fn from_code(code: &str) -> Result<Self, CatalogError> {
        match code {
            "ja" => Ok(Self::Ja),
            "en" => Ok(Self::En),
            _ => Err(CatalogError::UnsupportedLocale(code.into())),
        }
    }

    /// The stable storage and HTML language code.
    #[must_use]
    pub const fn code(self) -> &'static str {
        match self {
            Self::Ja => "ja",
            Self::En => "en",
        }
    }
}

/// A catalog or state cannot be presented without a complete semantic translation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CatalogError {
    InvalidJson(String),
    InvalidId(String),
    InvalidTemplate(String),
    MissingId(String),
    MissingParameter { id: String, parameter: String },
    UnexpectedParameter { id: String, parameter: String },
    InvalidNumber { id: String, parameter: String },
    UnsupportedLocale(String),
    CatalogMismatch(String),
    InvalidState(&'static str),
}

impl CatalogError {
    /// A localized, parameter-free user-facing error ID.
    #[must_use]
    pub fn text_id(&self) -> &str {
        match self {
            Self::InvalidState(id) => id,
            Self::UnsupportedLocale(_) => "error.locale",
            _ => "error.localization",
        }
    }
}

impl fmt::Display for CatalogError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson(reason) => write!(f, "invalid catalog JSON: {reason}"),
            Self::InvalidId(id) => write!(f, "invalid semantic text ID: {id}"),
            Self::InvalidTemplate(id) => write!(f, "invalid placeholder syntax in {id}"),
            Self::MissingId(id) => write!(f, "missing semantic text ID: {id}"),
            Self::MissingParameter { id, parameter } => {
                write!(f, "missing parameter {parameter} in {id}")
            }
            Self::UnexpectedParameter { id, parameter } => {
                write!(f, "unexpected parameter {parameter} in {id}")
            }
            Self::InvalidNumber { id, parameter } => {
                write!(f, "non-finite parameter {parameter} in {id}")
            }
            Self::UnsupportedLocale(code) => write!(f, "unsupported locale: {code}"),
            Self::CatalogMismatch(id) => {
                write!(f, "catalog coverage or placeholders differ at {id}")
            }
            Self::InvalidState(id) => write!(f, "domain state validation failed: {id}"),
        }
    }
}

impl std::error::Error for CatalogError {}

#[derive(Clone, Debug)]
enum Token {
    Literal(String),
    Parameter(String),
}

#[derive(Clone, Debug)]
struct Message {
    template: String,
    tokens: Vec<Token>,
    parameters: BTreeSet<String>,
}

struct UniqueEntries(BTreeMap<String, String>);

impl<'de> Deserialize<'de> for UniqueEntries {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct EntriesVisitor;
        impl<'de> Visitor<'de> for EntriesVisitor {
            type Value = UniqueEntries;
            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("an object of unique semantic text IDs and strings")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let mut entries = BTreeMap::new();
                while let Some((id, template)) = map.next_entry::<String, String>()? {
                    if entries.insert(id.clone(), template).is_some() {
                        return Err(serde::de::Error::custom(format!(
                            "duplicate semantic text ID: {id}"
                        )));
                    }
                }
                Ok(UniqueEntries(entries))
            }
        }
        deserializer.deserialize_map(EntriesVisitor)
    }
}

/// A validated catalog. Templates are compiled once; inserted strings are never reparsed.
#[derive(Clone, Debug)]
pub struct Catalog {
    locale: Locale,
    messages: BTreeMap<String, Message>,
}

impl Catalog {
    /// Load the checked-in catalog for a supported locale.
    ///
    /// # Errors
    /// Returns a catalog validation error if the bundled catalog is malformed.
    pub fn builtin(locale: Locale) -> Result<Self, CatalogError> {
        let json = match locale {
            Locale::Ja => include_str!("../locales/ja.json"),
            Locale::En => include_str!("../locales/en.json"),
        };
        Self::from_json(locale, json)
    }

    /// Parse a catalog and reject duplicate IDs and malformed placeholders.
    ///
    /// # Errors
    /// Returns an error for invalid JSON, semantic IDs, or placeholder syntax.
    pub fn from_json(locale: Locale, json: &str) -> Result<Self, CatalogError> {
        let UniqueEntries(entries) = serde_json::from_str(json)
            .map_err(|error| CatalogError::InvalidJson(error.to_string()))?;
        let mut messages = BTreeMap::new();
        for (id, template) in entries {
            if !valid_id(&id) {
                return Err(CatalogError::InvalidId(id));
            }
            let (tokens, parameters) = parse_template(&id, &template)?;
            messages.insert(
                id,
                Message {
                    template,
                    tokens,
                    parameters,
                },
            );
        }
        Ok(Self { locale, messages })
    }

    /// Resolve exactly the declared parameters of one semantic text ID.
    /// External strings are inserted unchanged; Text arguments resolve another text ID.
    ///
    /// # Errors
    /// Rejects missing IDs, missing or excess parameters, and non-finite numbers.
    pub fn translate(
        &self,
        id: &str,
        args: &BTreeMap<String, Argument>,
    ) -> Result<String, CatalogError> {
        let message = self
            .messages
            .get(id)
            .ok_or_else(|| CatalogError::MissingId(id.into()))?;
        for parameter in &message.parameters {
            if !args.contains_key(parameter) {
                return Err(CatalogError::MissingParameter {
                    id: id.into(),
                    parameter: parameter.clone(),
                });
            }
        }
        for parameter in args.keys() {
            if !message.parameters.contains(parameter) {
                return Err(CatalogError::UnexpectedParameter {
                    id: id.into(),
                    parameter: parameter.clone(),
                });
            }
        }
        let mut resolved = BTreeMap::new();
        for (parameter, argument) in args {
            let value = match argument {
                Argument::String(value) => value.clone(),
                Argument::Text(nested_id) => self.translate(nested_id, &BTreeMap::new())?,
                Argument::Number(value) => {
                    if !value.is_finite() {
                        return Err(CatalogError::InvalidNumber {
                            id: id.into(),
                            parameter: parameter.clone(),
                        });
                    }
                    display_number(*value)
                }
            };
            resolved.insert(parameter, value);
        }
        let mut text = String::with_capacity(message.template.len());
        for token in &message.tokens {
            match token {
                Token::Literal(value) => text.push_str(value),
                Token::Parameter(parameter) => {
                    let value =
                        resolved
                            .get(parameter)
                            .ok_or_else(|| CatalogError::MissingParameter {
                                id: id.into(),
                                parameter: parameter.clone(),
                            })?;
                    text.push_str(value);
                }
            }
        }
        Ok(text)
    }

    /// Return all parameter-free UI labels, including help, errors, and settings.
    #[must_use]
    pub fn labels(&self) -> BTreeMap<String, String> {
        self.messages
            .iter()
            .filter(|(_, message)| message.parameters.is_empty())
            .map(|(id, message)| (id.clone(), message.template.clone()))
            .collect()
    }

    /// Format a count with explicit semantic singular/plural IDs.
    ///
    /// # Errors
    /// Returns a missing ID or parameter error if a count message is incomplete.
    pub fn count(&self, stem: &str, count: u64) -> Result<String, CatalogError> {
        let form = if self.locale == Locale::En && count == 1 {
            "one"
        } else {
            "other"
        };
        let id = format!("{stem}.{form}");
        // Counts are inserted as decimal strings, preserving every u64 digit.
        let args = BTreeMap::from([("count".into(), Argument::String(count.to_string()))]);
        self.translate(&id, &args)
    }
}

fn valid_id(id: &str) -> bool {
    id.split('.')
        .all(|part| !part.is_empty() && valid_parameter(part))
}

fn valid_parameter(parameter: &str) -> bool {
    let mut chars = parameter.chars();
    matches!(chars.next(), Some('a'..='z' | '_'))
        && chars.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '_'
        })
}

fn parse_template(
    id: &str,
    template: &str,
) -> Result<(Vec<Token>, BTreeSet<String>), CatalogError> {
    let mut tokens = Vec::new();
    let mut parameters = BTreeSet::new();
    let bytes = template.as_bytes();
    let mut cursor = 0;
    let mut literal_start = 0;
    while cursor < bytes.len() {
        match bytes[cursor] {
            b'{' => {
                if cursor > literal_start {
                    tokens.push(Token::Literal(template[literal_start..cursor].into()));
                }
                let parameter_start = cursor + 1;
                let close = template[parameter_start..]
                    .find('}')
                    .map(|offset| parameter_start + offset)
                    .ok_or_else(|| CatalogError::InvalidTemplate(id.into()))?;
                let parameter = &template[parameter_start..close];
                if !valid_parameter(parameter) {
                    return Err(CatalogError::InvalidTemplate(id.into()));
                }
                tokens.push(Token::Parameter(parameter.into()));
                parameters.insert(parameter.into());
                cursor = close + 1;
                literal_start = cursor;
            }
            b'}' => return Err(CatalogError::InvalidTemplate(id.into())),
            _ => cursor += 1,
        }
    }
    if literal_start < template.len() {
        tokens.push(Token::Literal(template[literal_start..].into()));
    }
    Ok((tokens, parameters))
}

fn display_number(value: f64) -> String {
    let text = format!("{value:.2}");
    let text = text.trim_end_matches('0').trim_end_matches('.');
    if text == "-0" {
        "0".into()
    } else {
        text.into()
    }
}

/// Require exact EN/JA coverage and parameter sets before release.
///
/// # Errors
/// Returns the first missing text ID or changed placeholder set.
pub fn validate_catalogs() -> Result<(), CatalogError> {
    let ja = Catalog::builtin(Locale::Ja)?;
    let en = Catalog::builtin(Locale::En)?;
    for id in ja.messages.keys().chain(en.messages.keys()) {
        let matched = match (ja.messages.get(id), en.messages.get(id)) {
            (Some(left), Some(right)) => left.parameters == right.parameters,
            _ => false,
        };
        if !matched {
            return Err(CatalogError::CatalogMismatch(id.clone()));
        }
    }
    Ok(())
}

/// Pure scalar formula values for the current validated parameters.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct FormulaView {
    pub hit_chance: f64,
    pub rescaled_damage: f64,
    pub combat_speed: f64,
    pub resistance: f64,
    pub damage_after_resistance: f64,
}

/// A fully localized browser view of the bounded mechanics workbench.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct View {
    pub locale: Locale,
    pub labels: BTreeMap<String, String>,
    pub source_commit: &'static str,
    pub ruleset: &'static str,
    pub player_name: String,
    pub seed: u32,
    pub tick: u64,
    pub hits: u64,
    pub misses: u64,
    pub hit_status: String,
    pub miss_status: String,
    pub energy: Energy,
    pub params: Parameters,
    pub formula: FormulaView,
    pub events: Vec<String>,
}

/// Build a translated view without modifying simulation, event history, or RNG.
///
/// # Errors
/// Rejects invalid domain state and incomplete or malformed catalog text.
pub fn render(state: &State, locale: Locale) -> Result<View, CatalogError> {
    state
        .validate()
        .map_err(|error| CatalogError::InvalidState(error.text_id()))?;
    let catalog = Catalog::builtin(locale)?;
    let params = &state.params;
    let hit_chance = rules::hit_chance(params.attack, params.defense, 0.0, 100.0, false);
    let rescaled_damage = rules::rescale_damage(params.damage);
    let combat_speed = rules::combat_speed(params.weapon_speed, params.speed_bonus, 0.0);
    let resistance = rules::combined_resistance(
        params.resist_all,
        params.resist_type,
        params.resist_cap,
        1.0,
    );
    let events = state
        .events
        .iter()
        .map(|event| catalog.translate(&event.id, &event.args))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(View {
        locale,
        labels: catalog.labels(),
        source_commit: tome_logic::SOURCE_COMMIT,
        ruleset: tome_logic::RULESET,
        player_name: state.player_name.clone(),
        seed: state.seed,
        tick: state.tick,
        hits: state.hits,
        misses: state.misses,
        hit_status: catalog.count("status.hits", state.hits)?,
        miss_status: catalog.count("status.misses", state.misses)?,
        energy: state.energy.clone(),
        params: state.params.clone(),
        formula: FormulaView {
            hit_chance,
            rescaled_damage,
            combat_speed,
            resistance,
            damage_after_resistance: rescaled_damage * (1.0 - resistance / 100.0),
        },
        events,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checked_in_catalogs_have_exact_ids_and_placeholder_coverage() {
        validate_catalogs().expect("EN and JA catalogs match");
        assert_eq!(Locale::default(), Locale::Ja);
        assert_eq!(Locale::from_code("ja").expect("fixture"), Locale::Ja);
        assert!(Locale::from_code("unknown").is_err());
        let ja = Catalog::builtin(Locale::Ja).expect("fixture");
        for id in [
            "error.parameters",
            "error.name",
            "error.energy",
            "error.limit",
            "error.localization",
        ] {
            assert!(ja.translate(id, &BTreeMap::new()).is_ok());
        }
    }

    #[test]
    fn placeholder_contracts_are_strict_and_external_names_are_unchanged() {
        let catalog = Catalog::builtin(Locale::Ja).expect("fixture");
        let name = "Kit {damage} <script> 日本語";
        let mut args = BTreeMap::from([
            ("name".into(), Argument::String(name.into())),
            ("damage".into(), Argument::Number(12.5)),
        ]);
        let text = catalog.translate("event.hit", &args).expect("fixture");
        assert!(text.contains(name));
        assert!(text.contains("12.5"));
        args.remove("damage");
        assert!(matches!(
            catalog.translate("event.hit", &args),
            Err(CatalogError::MissingParameter { .. })
        ));
        args.insert("damage".into(), Argument::Number(2.0));
        args.insert("extra".into(), Argument::String("x".into()));
        assert!(matches!(
            catalog.translate("event.hit", &args),
            Err(CatalogError::UnexpectedParameter { .. })
        ));
        assert!(matches!(
            catalog.translate("missing.id", &BTreeMap::new()),
            Err(CatalogError::MissingId(_))
        ));
    }

    #[test]
    fn semantic_names_and_plural_forms_follow_locale() {
        let ja = Catalog::builtin(Locale::Ja).expect("fixture");
        let en = Catalog::builtin(Locale::En).expect("fixture");
        let args = BTreeMap::from([(
            "name".into(),
            Argument::Text("name.target.training_dummy".into()),
        )]);
        assert_eq!(
            ja.translate("event.miss", &args).expect("fixture"),
            "訓練用標的の攻撃は外れました。"
        );
        assert_eq!(en.count("status.hits", 1).expect("fixture"), "1 hit");
        assert_eq!(en.count("status.hits", 2).expect("fixture"), "2 hits");
        assert_eq!(ja.count("status.hits", 1).expect("fixture"), "命中：1回");
        assert_eq!(
            ja.count("status.hits", u64::MAX).expect("fixture"),
            format!("命中：{}回", u64::MAX)
        );
    }

    #[test]
    fn malformed_duplicate_templates_and_non_finite_numbers_are_rejected() {
        for json in [
            r#"{"label.test":"{unfinished"}"#,
            r#"{"label.test":"bad}"}"#,
            r#"{"label.test":"{nested{value}}"}"#,
            r#"{"label.test":"{Bad}"}"#,
            r#"{"label.test":"{0}"}"#,
            r#"{"label.test":"x","label.test":"y"}"#,
        ] {
            assert!(Catalog::from_json(Locale::Ja, json).is_err(), "{json}");
        }
        let catalog = Catalog::builtin(Locale::Ja).expect("fixture");
        let args = BTreeMap::from([("seed".into(), Argument::Number(f64::NAN))]);
        assert!(matches!(
            catalog.translate("event.started", &args),
            Err(CatalogError::InvalidNumber { .. })
        ));
    }

    #[test]
    fn repeated_locale_rendering_preserves_serialized_state_and_random_stream() {
        let mut state = State::new(73, "外部ユーザー {seed}".into()).expect("fixture");
        state.strike().expect("ready");
        let before = serde_json::to_string(&state).expect("fixture");
        let mut unrendered = state.clone();
        for _ in 0..4 {
            let ja = render(&state, Locale::Ja).expect("fixture");
            let en = render(&state, Locale::En).expect("fixture");
            assert_eq!(ja.player_name, "外部ユーザー {seed}");
            assert_eq!(ja.formula, en.formula);
            assert_ne!(ja.labels["app.warning"], en.labels["app.warning"]);
        }
        assert_eq!(serde_json::to_string(&state).expect("fixture"), before);
        for _ in 0..10 {
            state.advance_tick().expect("tick");
            unrendered.advance_tick().expect("tick");
        }
        state.strike().expect("ready");
        unrendered.strike().expect("ready");
        assert_eq!(state, unrendered);
    }
}
