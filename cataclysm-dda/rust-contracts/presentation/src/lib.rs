//! Immutable semantic formatting. Browser hosts must display outputs as text nodes.
//! This contract catalog is not the complete upstream game translation catalog.
use cdda_logic_contract::{Observation, ParameterKind, ParameterValue, TextEvent, TextId};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use thiserror::Error;

/// Japanese is the browser default; English is an explicit alternate.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
    En,
    #[default]
    Ja,
}

/// Semantic IDs completely covered by both bounded contract catalogs.
pub const CONTRACT_TEXT_IDS: &[&str] = &[
    "command.north",
    "command.north_east",
    "command.east",
    "command.south_east",
    "command.south",
    "command.south_west",
    "command.west",
    "command.north_west",
    "command.confirm",
    "command.cancel",
    "command.inventory",
    "command.examine",
    "command.pickup",
    "command.pause",
    "command.wait_minutes",
    "command.save_quit",
    "contract.item_summary",
    "term.item.bottle",
    "save.error.version",
    "save.error.source",
    "save.error.abi",
    "save.error.checksum",
    "save.error.rng_incomplete",
    "save.error.format",
    "save.error.size",
    "save.error.boundary",
    "text.error.catalog",
    "text.error.missing_id",
    "text.error.parameters",
    "text.error.term",
];

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawCatalog {
    schema_version: u32,
    locale: Locale,
    entries: BTreeMap<TextId, RawEntry>,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawEntry {
    parameters: BTreeMap<String, ParameterKind>,
    #[serde(default)]
    plural_parameter: Option<String>,
    #[serde(default)]
    one: Option<String>,
    other: String,
}
#[derive(Debug, PartialEq, Eq)]
enum Token {
    Literal(String),
    Parameter(String),
}
#[derive(Debug)]
struct Entry {
    parameters: BTreeMap<String, ParameterKind>,
    plural_parameter: Option<String>,
    one: Option<Vec<Token>>,
    other: Vec<Token>,
}

/// Strict catalog and event errors with semantic user-facing IDs.
#[derive(Debug, Error)]
pub enum TextError {
    #[error("invalid catalog JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("unsupported catalog schema: {0}")]
    Schema(u32),
    #[error("invalid catalog template: {0}")]
    Template(String),
    #[error("English/Japanese catalog ID, parameter or plural parity mismatch: {0}")]
    Parity(String),
    #[error("missing semantic text ID: {0}")]
    MissingId(String),
    #[error("event parameter mismatch: {0}")]
    Parameters(String),
    #[error("a localized term must have no parameters: {0}")]
    Term(String),
}
impl TextError {
    /// IDs are static catalog entries; diagnostic Display strings are for logs.
    #[must_use]
    pub const fn semantic_id(&self) -> &'static str {
        match self {
            Self::MissingId(_) => "text.error.missing_id",
            Self::Parameters(_) => "text.error.parameters",
            Self::Term(_) => "text.error.term",
            Self::Json(_) | Self::Schema(_) | Self::Template(_) | Self::Parity(_) => {
                "text.error.catalog"
            }
        }
    }
}

/// A validated immutable language catalog; no global replacement is performed.
#[derive(Debug)]
pub struct Catalog {
    locale: Locale,
    entries: BTreeMap<TextId, Entry>,
}

impl Catalog {
    /// Load the bounded, reviewed contract catalog.
    pub fn contract(locale: Locale) -> Result<Self, TextError> {
        Self::from_json(match locale {
            Locale::En => include_str!("../../locales/en.json"),
            Locale::Ja => include_str!("../../locales/ja.json"),
        })
    }

    /// Parse and validate names/types/placeholders before any rendering.
    pub fn from_json(json: &str) -> Result<Self, TextError> {
        let raw: RawCatalog = serde_json::from_str(json)?;
        if raw.schema_version != 1 {
            return Err(TextError::Schema(raw.schema_version));
        }
        let mut entries = BTreeMap::new();
        for (id, entry) in raw.entries {
            if entry.parameters.keys().any(|name| !valid_parameter(name)) {
                return Err(TextError::Template(format!(
                    "{}: invalid parameter name",
                    id.as_str()
                )));
            }
            if raw.locale == Locale::Ja && (entry.one.is_some() || entry.plural_parameter.is_some())
            {
                return Err(TextError::Template(format!(
                    "{}: Japanese count is invariant",
                    id.as_str()
                )));
            }
            if let Some(name) = &entry.plural_parameter {
                if entry.parameters.get(name) != Some(&ParameterKind::Count) || entry.one.is_none()
                {
                    return Err(TextError::Template(format!(
                        "{}: plural parameter must be a count",
                        id.as_str()
                    )));
                }
            }
            let other = tokenize(&entry.other)?;
            validate_placeholders(&other, &entry.parameters, id.as_str())?;
            let one = entry.one.as_deref().map(tokenize).transpose()?;
            if let Some(tokens) = &one {
                validate_placeholders(tokens, &entry.parameters, id.as_str())?;
            }
            entries.insert(
                id,
                Entry {
                    parameters: entry.parameters,
                    plural_parameter: entry.plural_parameter,
                    one,
                    other,
                },
            );
        }
        Ok(Self {
            locale: raw.locale,
            entries,
        })
    }

    /// Require both languages to cover exactly the contract IDs and argument types.
    /// English plural variants are permitted while Japanese is count-invariant.
    pub fn validate_contract_pair(en: &Self, ja: &Self) -> Result<(), TextError> {
        let expected: BTreeSet<_> = CONTRACT_TEXT_IDS.iter().copied().collect();
        let en_ids: BTreeSet<_> = en.entries.keys().map(TextId::as_str).collect();
        let ja_ids: BTreeSet<_> = ja.entries.keys().map(TextId::as_str).collect();
        if en.locale != Locale::En
            || ja.locale != Locale::Ja
            || en_ids != expected
            || ja_ids != expected
        {
            return Err(TextError::Parity("bounded ID set or locale".into()));
        }
        for (id, entry) in &en.entries {
            if ja
                .entries
                .get(id)
                .is_none_or(|other| entry.parameters != other.parameters)
            {
                return Err(TextError::Parity(id.as_str().into()));
            }
        }
        Ok(())
    }

    /// Format typed named arguments once, preserving arbitrary user text verbatim.
    /// The returned string is plain text, never HTML; use DOM textContent.
    pub fn format(&self, event: &TextEvent) -> Result<String, TextError> {
        let entry = self.entry(&event.id)?;
        if event.parameters.len() != entry.parameters.len()
            || entry.parameters.iter().any(|(name, kind)| {
                event
                    .parameters
                    .get(name)
                    .is_none_or(|value| value.kind() != *kind)
            })
        {
            return Err(TextError::Parameters(event.id.as_str().into()));
        }
        let plural_count = entry.plural_parameter.as_ref().and_then(|name| {
            if let Some(ParameterValue::Count(count)) = event.parameters.get(name) {
                Some(*count)
            } else {
                None
            }
        });
        let tokens = self.tokens(entry, plural_count);
        let mut output = String::new();
        for token in tokens {
            match token {
                Token::Literal(text) => output.push_str(text),
                Token::Parameter(name) => match event.parameters.get(name) {
                    Some(ParameterValue::UserText(value)) => output.push_str(value),
                    Some(ParameterValue::Count(value)) => output.push_str(&value.to_string()),
                    Some(ParameterValue::Term { id, count }) => {
                        output.push_str(&self.term(id, *count)?)
                    }
                    None => return Err(TextError::Parameters(name.clone())),
                },
            }
        }
        Ok(output)
    }

    fn entry(&self, id: &TextId) -> Result<&Entry, TextError> {
        self.entries
            .get(id)
            .ok_or_else(|| TextError::MissingId(id.as_str().into()))
    }
    fn tokens<'a>(&self, entry: &'a Entry, count: Option<u64>) -> &'a [Token] {
        if self.locale == Locale::En && count == Some(1) {
            entry.one.as_deref().unwrap_or(&entry.other)
        } else {
            &entry.other
        }
    }
    fn term(&self, id: &TextId, count: u64) -> Result<String, TextError> {
        let entry = self.entry(id)?;
        if !entry.parameters.is_empty() {
            return Err(TextError::Term(id.as_str().into()));
        }
        let mut text = String::new();
        for token in self.tokens(entry, Some(count)) {
            match token {
                Token::Literal(value) => text.push_str(value),
                Token::Parameter(_) => return Err(TextError::Term(id.as_str().into())),
            }
        }
        Ok(text)
    }
}

fn valid_parameter(name: &str) -> bool {
    !name.is_empty()
        && name.as_bytes()[0].is_ascii_lowercase()
        && name
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
}
fn validate_placeholders(
    tokens: &[Token],
    parameters: &BTreeMap<String, ParameterKind>,
    id: &str,
) -> Result<(), TextError> {
    let used: BTreeSet<_> = tokens
        .iter()
        .filter_map(|token| match token {
            Token::Parameter(name) => Some(name.as_str()),
            Token::Literal(_) => None,
        })
        .collect();
    let expected: BTreeSet<_> = parameters.keys().map(String::as_str).collect();
    if used == expected {
        Ok(())
    } else {
        Err(TextError::Template(format!(
            "{id}: placeholder/schema mismatch"
        )))
    }
}
fn tokenize(template: &str) -> Result<Vec<Token>, TextError> {
    let mut tokens = Vec::new();
    let mut literal = String::new();
    let mut chars = template.chars().peekable();
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
                let mut name = String::new();
                let mut closed = false;
                for ch in chars.by_ref() {
                    if ch == '}' {
                        closed = true;
                        break;
                    }
                    name.push(ch);
                }
                if !closed || !valid_parameter(&name) {
                    return Err(TextError::Template("invalid named placeholder".into()));
                }
                tokens.push(Token::Parameter(name));
            }
            '}' => return Err(TextError::Template("unmatched closing brace".into())),
            value => literal.push(value),
        }
    }
    if !literal.is_empty() {
        tokens.push(Token::Literal(literal));
    }
    Ok(tokens)
}

/// Plain text frame. Its data is observation-derived and cannot advance C++.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Frame {
    pub revision: u64,
    pub upstream_turn: i64,
    pub lines: Vec<String>,
}

/// Render accepts shared references only, with no simulation/RNG/clock handle.
pub fn render(observation: &Observation, catalog: &Catalog) -> Result<Frame, TextError> {
    Ok(Frame {
        revision: observation.revision,
        upstream_turn: observation.upstream_turn,
        lines: observation
            .messages
            .iter()
            .map(|event| catalog.format(event))
            .collect::<Result<_, _>>()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn id(value: &str) -> TextId {
        TextId::new(value).expect("valid test ID")
    }
    fn summary(user: &str, count: u64) -> TextEvent {
        TextEvent {
            id: id("contract.item_summary"),
            parameters: BTreeMap::from([
                ("user".into(), ParameterValue::UserText(user.into())),
                ("count".into(), ParameterValue::Count(count)),
                (
                    "item".into(),
                    ParameterValue::Term {
                        id: id("term.item.bottle"),
                        count,
                    },
                ),
            ]),
        }
    }
    #[test]
    fn all_contract_ids_and_typed_placeholders_match_in_both_languages() {
        let en = Catalog::contract(Locale::En).expect("English catalog");
        let ja = Catalog::contract(Locale::Ja).expect("Japanese catalog");
        Catalog::validate_contract_pair(&en, &ja).expect("exact complete contract coverage");
        assert_eq!(Locale::default(), Locale::Ja);
        for name in CONTRACT_TEXT_IDS
            .iter()
            .filter(|name| **name != "contract.item_summary")
        {
            assert!(
                !en.format(&TextEvent::plain(id(name)))
                    .expect("entry")
                    .is_empty()
            );
            assert!(
                !ja.format(&TextEvent::plain(id(name)))
                    .expect("entry")
                    .is_empty()
            );
        }
    }
    #[test]
    fn english_terms_pluralize_and_japanese_is_count_invariant() {
        let en = Catalog::contract(Locale::En).expect("en");
        let ja = Catalog::contract(Locale::Ja).expect("ja");
        assert_eq!(
            en.format(&summary("Alice", 1)).expect("one"),
            "Alice: 1 bottle"
        );
        assert_eq!(
            en.format(&summary("Alice", 2)).expect("other"),
            "Alice: 2 bottles"
        );
        assert_eq!(
            en.format(&summary("Alice", 0)).expect("zero"),
            "Alice: 0 bottles"
        );
        assert_eq!(
            ja.format(&summary("Alice", 1)).expect("ja"),
            "Alice：瓶 × 1"
        );
        assert_eq!(
            ja.format(&summary("Alice", 2)).expect("ja"),
            "Alice：瓶 × 2"
        );
    }
    #[test]
    fn usernames_are_never_translated_or_interpreted_as_templates() {
        let ja = Catalog::contract(Locale::Ja).expect("ja");
        let user = "Alice猫{%s}<script>雪</script>";
        assert_eq!(
            ja.format(&summary(user, 2)).expect("safe"),
            format!("{user}：瓶 × 2")
        );
    }
    #[test]
    fn render_is_pure_and_preserves_observation_and_turn() {
        let ja = Catalog::contract(Locale::Ja).expect("ja");
        let observation = Observation {
            revision: 9,
            upstream_turn: 42,
            messages: vec![summary("猫", 2)],
        };
        let original = observation.clone();
        let first = render(&observation, &ja).expect("render");
        for _ in 0..100 {
            assert_eq!(render(&observation, &ja).expect("render"), first);
        }
        assert_eq!(observation, original);
        assert_eq!(first.upstream_turn, 42);
    }
    #[test]
    fn missing_extra_wrong_typed_and_unknown_parameters_fail_closed() {
        let en = Catalog::contract(Locale::En).expect("en");
        let mut event = summary("Alice", 1);
        event.parameters.remove("count");
        assert!(matches!(en.format(&event), Err(TextError::Parameters(_))));
        let mut event = summary("Alice", 1);
        event
            .parameters
            .insert("extra".into(), ParameterValue::Count(2));
        assert!(matches!(en.format(&event), Err(TextError::Parameters(_))));
        let mut event = summary("Alice", 1);
        event
            .parameters
            .insert("count".into(), ParameterValue::UserText("1".into()));
        assert!(matches!(en.format(&event), Err(TextError::Parameters(_))));
        assert!(matches!(
            en.format(&TextEvent::plain(id("missing.entry"))),
            Err(TextError::MissingId(_))
        ));
    }
    #[test]
    fn malformed_catalog_placeholders_and_japanese_plural_forms_fail() {
        for template in ["{count}", "{user", "{0}", "}x", "{user:>2}"] {
            let json = serde_json::json!({"schema_version":1,"locale":"en","entries":{"contract.test":{
                "parameters":{"user":"user_text"},"other":template}}});
            assert!(Catalog::from_json(&json.to_string()).is_err(), "{template}");
        }
        let json = r#"{"schema_version":1,"locale":"ja","entries":{"contract.test":{"parameters":{},"one":"瓶","other":"瓶"}}}"#;
        assert!(Catalog::from_json(json).is_err());
        assert_eq!(
            tokenize("{{user}}").expect("escape"),
            vec![Token::Literal("{user}".into())]
        );
    }
}
