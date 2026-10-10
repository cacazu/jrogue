//! Locale projection only. This layer receives no mutable simulation or RNG reference.
pub mod frame;
pub mod native_text;

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

pub type Catalog = BTreeMap<String, String>;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum Parameter {
    /// External player/user text is preserved verbatim, even if it equals an English game term.
    Text(String),
    Number(i64),
    Term(String),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub parameters: BTreeMap<String, Parameter>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DisplayError {
    InvalidJson,
    MissingId(String),
    InvalidTemplate(String),
    PlaceholderMismatch(String),
    ParameterMismatch(String),
    RecursiveTerm(String),
}

impl std::fmt::Display for DisplayError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for DisplayError {}

fn template_parts(text: &str) -> Result<Vec<(bool, String)>, DisplayError> {
    let mut chars = text.chars().peekable();
    let mut parts = Vec::new();
    let mut literal = String::new();
    while let Some(ch) = chars.next() {
        match ch {
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
                    parts.push((false, std::mem::take(&mut literal)));
                }
                let mut name = String::new();
                let mut closed = false;
                for next in chars.by_ref() {
                    if next == '}' {
                        closed = true;
                        break;
                    }
                    if !next.is_ascii_alphanumeric() && next != '_' {
                        return Err(DisplayError::InvalidTemplate(text.into()));
                    }
                    name.push(next);
                }
                if !closed || name.is_empty() {
                    return Err(DisplayError::InvalidTemplate(text.into()));
                }
                parts.push((true, name));
            }
            '}' => return Err(DisplayError::InvalidTemplate(text.into())),
            _ => literal.push(ch),
        }
    }
    if !literal.is_empty() {
        parts.push((false, literal));
    }
    Ok(parts)
}

pub fn placeholders(text: &str) -> Result<BTreeSet<String>, DisplayError> {
    Ok(template_parts(text)?
        .into_iter()
        .filter_map(|(parameter, value)| parameter.then_some(value))
        .collect())
}

/// Fail closed: equal ID sets, syntactically valid templates, equal named placeholders.
pub fn validate_pair(en: &Catalog, ja: &Catalog) -> Result<(), DisplayError> {
    if en.keys().ne(ja.keys()) {
        return Err(DisplayError::MissingId("catalog key sets differ".into()));
    }
    for (id, english) in en {
        let japanese = ja
            .get(id)
            .ok_or_else(|| DisplayError::MissingId(id.clone()))?;
        if placeholders(english)? != placeholders(japanese)? {
            return Err(DisplayError::PlaceholderMismatch(id.clone()));
        }
    }
    Ok(())
}

pub fn catalog_json(json: &str) -> Result<Catalog, DisplayError> {
    struct UniqueCatalog;
    impl<'de> serde::de::Visitor<'de> for UniqueCatalog {
        type Value = Catalog;
        fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str("unique semantic IDs mapped to text")
        }
        fn visit_map<A: serde::de::MapAccess<'de>>(self, mut map: A) -> Result<Catalog, A::Error> {
            let mut catalog = BTreeMap::new();
            while let Some((id, text)) = map.next_entry::<String, String>()? {
                if catalog.insert(id, text).is_some() {
                    return Err(serde::de::Error::custom("duplicate semantic ID"));
                }
            }
            Ok(catalog)
        }
    }
    use serde::de::Deserializer;
    let mut parser = serde_json::Deserializer::from_str(json);
    let value = parser
        .deserialize_map(UniqueCatalog)
        .map_err(|_| DisplayError::InvalidJson)?;
    parser.end().map_err(|_| DisplayError::InvalidJson)?;
    Ok(value)
}

pub fn render(catalog: &Catalog, message: &Message) -> Result<String, DisplayError> {
    let template = catalog
        .get(&message.id)
        .ok_or_else(|| DisplayError::MissingId(message.id.clone()))?;
    let expected = placeholders(template)?;
    let actual = message.parameters.keys().cloned().collect::<BTreeSet<_>>();
    if expected != actual {
        return Err(DisplayError::ParameterMismatch(message.id.clone()));
    }
    let mut rendered = String::new();
    for (is_parameter, value) in template_parts(template)? {
        if !is_parameter {
            rendered.push_str(&value);
            continue;
        }
        match message
            .parameters
            .get(&value)
            .ok_or_else(|| DisplayError::ParameterMismatch(value.clone()))?
        {
            Parameter::Text(text) => rendered.push_str(text),
            Parameter::Number(number) => rendered.push_str(&number.to_string()),
            Parameter::Term(id) => {
                let term = catalog
                    .get(id)
                    .ok_or_else(|| DisplayError::MissingId(id.clone()))?;
                if !placeholders(term)?.is_empty() {
                    return Err(DisplayError::RecursiveTerm(id.clone()));
                }
                for (_, literal) in template_parts(term)? {
                    rendered.push_str(&literal);
                }
            }
        }
    }
    Ok(rendered)
}

/// The count comes from the domain; locale grammar never consumes simulation entropy.
pub fn plural_id(base: &str, count: i64, japanese: bool) -> String {
    format!(
        "{base}.{}",
        if japanese {
            "count"
        } else if count == 1 {
            "one"
        } else {
            "many"
        }
    )
}
