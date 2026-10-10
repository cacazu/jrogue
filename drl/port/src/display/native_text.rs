//! Original-source semantic catalogs. Double braces are named parameters; single
//! braces remain the original VTIG color/control syntax. Values are inserted once.
use super::{Catalog, catalog_json};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
pub const MAX_RENDERED_BYTES: usize = 32_768;

/// Int64 values cross the JS boundary as decimal strings, never JS numbers.
#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    content = "value",
    rename_all = "lowercase",
    deny_unknown_fields
)]
pub enum WireParameter {
    String(String),
    Integer(String),
}

pub fn canonical_integer(text: &str) -> Result<i64, Error> {
    let number = text.parse::<i64>().map_err(|_| Error::Parameters)?;
    if number.to_string() != text {
        return Err(Error::Parameters);
    }
    Ok(number)
}

/// Reject duplicate named parameters before map insertion can overwrite them.
pub fn deserialize_parameters<'de, D>(
    deserializer: D,
) -> Result<BTreeMap<String, WireParameter>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    struct UniqueParameters;
    impl<'de> serde::de::Visitor<'de> for UniqueParameters {
        type Value = BTreeMap<String, WireParameter>;
        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("unique named semantic parameters")
        }
        fn visit_map<M>(self, mut map: M) -> Result<Self::Value, M::Error>
        where
            M: serde::de::MapAccess<'de>,
        {
            let mut values = BTreeMap::new();
            while let Some((name, value)) = map.next_entry::<String, WireParameter>()? {
                if values.len() >= 16 || values.contains_key(&name) {
                    return Err(serde::de::Error::custom(
                        "duplicate or excessive semantic parameters",
                    ));
                }
                values.insert(name, value);
            }
            Ok(values)
        }
    }
    deserializer.deserialize_map(UniqueParameters)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    String,
    Integer,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "lowercase")]
pub enum Parameter {
    String(String),
    Integer(i64),
}
#[derive(Debug, Deserialize)]
struct Contract {
    schema: u32,
    grammar: String,
    parameters: BTreeMap<String, BTreeMap<String, Kind>>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    InvalidCatalog,
    InvalidTemplate,
    MissingId,
    Parameters,
    TooLarge,
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for Error {}

#[derive(Debug)]
enum Part {
    Literal(String),
    Parameter(String),
}
fn parts(text: &str) -> Result<Vec<Part>, Error> {
    if text.len() > MAX_RENDERED_BYTES {
        return Err(Error::TooLarge);
    }
    if text.contains('\0') {
        return Err(Error::InvalidTemplate);
    }
    let mut remaining = text;
    let mut output = Vec::new();
    while let Some(start) = remaining.find("{{") {
        if start != 0 {
            output.push(Part::Literal(remaining[..start].into()));
        }
        remaining = &remaining[start + 2..];
        let end = remaining.find("}}").ok_or(Error::InvalidTemplate)?;
        let name = &remaining[..end];
        if name.len() > 64
            || !name.starts_with(|c: char| c.is_ascii_lowercase())
            || !name
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
        {
            return Err(Error::InvalidTemplate);
        }
        output.push(Part::Parameter(name.into()));
        remaining = &remaining[end + 2..];
    }
    if !remaining.is_empty() {
        output.push(Part::Literal(remaining.into()));
    }
    Ok(output)
}
fn placeholders(text: &str) -> Result<BTreeSet<String>, Error> {
    Ok(parts(text)?
        .into_iter()
        .filter_map(|part| match part {
            Part::Parameter(name) => Some(name),
            _ => None,
        })
        .collect())
}

pub struct Locales {
    english: Catalog,
    japanese: Catalog,
    parameters: BTreeMap<String, BTreeMap<String, Kind>>,
}
impl Locales {
    pub fn load(english: &str, japanese: &str, contract: &str) -> Result<Self, Error> {
        let english = catalog_json(english).map_err(|_| Error::InvalidCatalog)?;
        let japanese = catalog_json(japanese).map_err(|_| Error::InvalidCatalog)?;
        let contract: Contract =
            serde_json::from_str(contract).map_err(|_| Error::InvalidCatalog)?;
        if contract.schema != 1
            || contract.grammar != "native-vtig-markup+double-brace-named-parameters"
            || english.keys().ne(japanese.keys())
            || english.keys().ne(contract.parameters.keys())
        {
            return Err(Error::InvalidCatalog);
        }
        for (id, text) in &english {
            let expected = contract.parameters[id]
                .keys()
                .cloned()
                .collect::<BTreeSet<_>>();
            if placeholders(text)? != expected || placeholders(&japanese[id])? != expected {
                return Err(Error::Parameters);
            }
        }
        Ok(Self {
            english,
            japanese,
            parameters: contract.parameters,
        })
    }
    pub fn compiled() -> Result<Self, Error> {
        Self::load(
            include_str!("../../locales/native-en.json"),
            include_str!("../../locales/native-ja.json"),
            include_str!("../../locales/native-contract.json"),
        )
    }
    pub fn count(&self) -> usize {
        self.english.len()
    }
    pub fn render(
        &self,
        id: &str,
        parameters: &BTreeMap<String, Parameter>,
        english: bool,
    ) -> Result<String, Error> {
        let expected = self.parameters.get(id).ok_or(Error::MissingId)?;
        if parameters.len() > 16 || expected.keys().ne(parameters.keys()) {
            return Err(Error::Parameters);
        }
        for (name, value) in parameters {
            match (expected[name], value) {
                (Kind::String, Parameter::String(text))
                    if text.len() <= MAX_RENDERED_BYTES && !text.contains('\0') => {}
                (Kind::Integer, Parameter::Integer(_)) => {}
                _ => return Err(Error::Parameters),
            }
        }
        let catalog = if english {
            &self.english
        } else {
            &self.japanese
        };
        let mut output = String::new();
        for part in parts(catalog.get(id).ok_or(Error::MissingId)?)? {
            match part {
                Part::Literal(text) => output.push_str(&text),
                Part::Parameter(name) => match &parameters[&name] {
                    Parameter::String(text) => output.push_str(text),
                    Parameter::Integer(value) => output.push_str(&value.to_string()),
                },
            }
            if output.len() > MAX_RENDERED_BYTES {
                return Err(Error::TooLarge);
            }
        }
        Ok(output)
    }
}
