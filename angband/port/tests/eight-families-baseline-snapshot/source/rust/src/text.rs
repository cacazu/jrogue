//! Semantic IDs for browser frontend messages and source-grounded static game
//! messages. Neither bounded catalog claims complete original game coverage.

mod game;
pub use game::{GAME_EN_JSON, GAME_JA_JSON, GameCatalog};

use std::fmt;

pub const EN_JSON: &str = include_str!("../catalogs/en.json");
pub const JA_JSON: &str = include_str!("../catalogs/ja.json");

/// Japanese is the frontend default; original user names are opaque parameters.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Locale {
    English,
    #[default]
    Japanese,
}

/// Complete typed semantic ID set for this deliberately bounded frontend.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextId {
    SiteTitle,
    Loading,
    Ready,
    SaveSaved,
    SaveRestored,
    SaveMissing,
    SaveInvalid,
    SaveIncompatible,
    InputHelp,
    PlayerWelcome,
}

pub const ALL_IDS: [TextId; 10] = [
    TextId::SiteTitle,
    TextId::Loading,
    TextId::Ready,
    TextId::SaveSaved,
    TextId::SaveRestored,
    TextId::SaveMissing,
    TextId::SaveInvalid,
    TextId::SaveIncompatible,
    TextId::InputHelp,
    TextId::PlayerWelcome,
];

impl TextId {
    #[must_use]
    pub const fn key(self) -> &'static str {
        match self {
            Self::SiteTitle => "site.title",
            Self::Loading => "status.loading",
            Self::Ready => "status.ready",
            Self::SaveSaved => "save.saved",
            Self::SaveRestored => "save.restored",
            Self::SaveMissing => "save.missing",
            Self::SaveInvalid => "save.invalid",
            Self::SaveIncompatible => "save.incompatible",
            Self::InputHelp => "input.help",
            Self::PlayerWelcome => "player.welcome",
        }
    }

    /// Resolve an ID explicitly; unknown IDs never fall back to unrelated text.
    pub fn parse(key: &str) -> Result<Self, TextError> {
        ALL_IDS
            .into_iter()
            .find(|id| id.key() == key)
            .ok_or_else(|| TextError::UnknownId(key.to_owned()))
    }

    fn parameters(self) -> &'static [&'static str] {
        match self {
            Self::SaveSaved | Self::SaveRestored | Self::PlayerWelcome => &["name"],
            Self::SaveInvalid => &["reason"],
            Self::SaveIncompatible => &["version", "commit"],
            Self::SiteTitle | Self::Loading | Self::Ready | Self::SaveMissing | Self::InputHelp => {
                &[]
            }
        }
    }
}

/// Explicit catalog/format error rather than silent source-string replacement.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TextError {
    InvalidJson,
    UnknownId(String),
    DuplicateId(String),
    MissingId(String),
    InvalidPlaceholder(String),
    MissingParameter(String),
    UnexpectedParameter(String),
    DuplicateParameter(String),
}
impl fmt::Display for TextError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for TextError {}

/// A validated semantic catalog loaded from a flat JSON string map.
#[derive(Clone, Debug)]
pub struct Catalog {
    entries: Vec<(TextId, String)>,
}

impl Catalog {
    /// Load the shipped catalog; malformed source remains an explicit error.
    pub fn for_locale(locale: Locale) -> Result<Self, TextError> {
        Self::from_json(match locale {
            Locale::English => EN_JSON,
            Locale::Japanese => JA_JSON,
        })
    }

    /// Verify complete frontend ID coverage and exact placeholder sets.
    pub fn from_json(json: &str) -> Result<Self, TextError> {
        let raw = parse_flat_json(json)?;
        let mut entries = Vec::with_capacity(ALL_IDS.len());
        for (key, template) in raw {
            let id = TextId::parse(&key)?;
            if entries.iter().any(|(previous, _)| *previous == id) {
                return Err(TextError::DuplicateId(key));
            }
            let placeholders = placeholder_names(&template)?;
            if placeholders.len() != id.parameters().len()
                || id
                    .parameters()
                    .iter()
                    .any(|required| !placeholders.iter().any(|name| name == required))
            {
                return Err(TextError::InvalidPlaceholder(key));
            }
            entries.push((id, template));
        }
        for id in ALL_IDS {
            if !entries.iter().any(|(present, _)| *present == id) {
                return Err(TextError::MissingId(id.key().to_owned()));
            }
        }
        Ok(Self { entries })
    }

    /// Interpolate named parameters once. Values are copied verbatim, so names
    /// containing Japanese, English, or braces are never translated/reparsed.
    pub fn format(&self, id: TextId, parameters: &[(&str, &str)]) -> Result<String, TextError> {
        for (index, (name, _)) in parameters.iter().enumerate() {
            if !id.parameters().contains(name) {
                return Err(TextError::UnexpectedParameter((*name).to_owned()));
            }
            if parameters[..index]
                .iter()
                .any(|(previous, _)| previous == name)
            {
                return Err(TextError::DuplicateParameter((*name).to_owned()));
            }
        }
        for required in id.parameters() {
            if !parameters.iter().any(|(name, _)| name == required) {
                return Err(TextError::MissingParameter((*required).to_owned()));
            }
        }
        let template = self
            .entries
            .iter()
            .find(|(present, _)| *present == id)
            .map(|(_, text)| text.as_str())
            .ok_or_else(|| TextError::MissingId(id.key().to_owned()))?;
        let mut out = String::with_capacity(template.len());
        let mut remaining = template;
        while let Some(start) = remaining.find('{') {
            out.push_str(&remaining[..start]);
            let end = remaining[start + 1..]
                .find('}')
                .ok_or_else(|| TextError::InvalidPlaceholder(id.key().to_owned()))?
                + start
                + 1;
            let name = &remaining[start + 1..end];
            let value = parameters
                .iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| *value)
                .ok_or_else(|| TextError::MissingParameter(name.to_owned()))?;
            out.push_str(value);
            remaining = &remaining[end + 1..];
        }
        out.push_str(remaining);
        Ok(out)
    }

    /// Format an external semantic ID, making unknown IDs explicit.
    pub fn format_key(&self, key: &str, parameters: &[(&str, &str)]) -> Result<String, TextError> {
        self.format(TextId::parse(key)?, parameters)
    }
}

fn placeholder_names(template: &str) -> Result<Vec<&str>, TextError> {
    let mut out = Vec::new();
    let mut remaining = template;
    while let Some(start) = remaining.find('{') {
        if remaining[..start].contains('}') {
            return Err(TextError::InvalidPlaceholder(template.to_owned()));
        }
        let end = remaining[start + 1..]
            .find('}')
            .ok_or_else(|| TextError::InvalidPlaceholder(template.to_owned()))?
            + start
            + 1;
        let name = &remaining[start + 1..end];
        if name.is_empty()
            || !name
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
            || out.contains(&name)
        {
            return Err(TextError::InvalidPlaceholder(template.to_owned()));
        }
        out.push(name);
        remaining = &remaining[end + 1..];
    }
    if remaining.contains('}') {
        return Err(TextError::InvalidPlaceholder(template.to_owned()));
    }
    Ok(out)
}

// Intentionally bounded JSON parser: catalogs are one object of string keys and
// string values. Nested values/numbers/arrays are rejected, not partially read.
pub(crate) fn parse_flat_json(json: &str) -> Result<Vec<(String, String)>, TextError> {
    let mut parser = JsonStrings {
        chars: json.chars().peekable(),
    };
    parser.take('{')?;
    let mut entries = Vec::new();
    parser.space();
    if parser.chars.peek() == Some(&'}') {
        parser.chars.next();
    } else {
        loop {
            let key = parser.string()?;
            parser.take(':')?;
            let value = parser.string()?;
            entries.push((key, value));
            parser.space();
            match parser.chars.next() {
                Some(',') => {}
                Some('}') => break,
                _ => return Err(TextError::InvalidJson),
            }
        }
    }
    parser.space();
    if parser.chars.next().is_some() {
        return Err(TextError::InvalidJson);
    }
    Ok(entries)
}

struct JsonStrings<'a> {
    chars: std::iter::Peekable<std::str::Chars<'a>>,
}
impl JsonStrings<'_> {
    fn space(&mut self) {
        while self
            .chars
            .peek()
            .is_some_and(|ch| matches!(ch, ' ' | '\n' | '\r' | '\t'))
        {
            self.chars.next();
        }
    }
    fn take(&mut self, expected: char) -> Result<(), TextError> {
        self.space();
        if self.chars.next() == Some(expected) {
            Ok(())
        } else {
            Err(TextError::InvalidJson)
        }
    }
    fn hex4(&mut self) -> Result<u32, TextError> {
        let mut value = 0;
        for _ in 0..4 {
            value = value * 16
                + self
                    .chars
                    .next()
                    .and_then(|ch| ch.to_digit(16))
                    .ok_or(TextError::InvalidJson)?;
        }
        Ok(value)
    }
    fn string(&mut self) -> Result<String, TextError> {
        self.take('"')?;
        let mut out = String::new();
        loop {
            match self.chars.next().ok_or(TextError::InvalidJson)? {
                '"' => return Ok(out),
                '\\' => match self.chars.next().ok_or(TextError::InvalidJson)? {
                    '"' => out.push('"'),
                    '\\' => out.push('\\'),
                    '/' => out.push('/'),
                    'b' => out.push('\u{8}'),
                    'f' => out.push('\u{c}'),
                    'n' => out.push('\n'),
                    'r' => out.push('\r'),
                    't' => out.push('\t'),
                    'u' => {
                        let first = self.hex4()?;
                        let codepoint = if (0xd800..=0xdbff).contains(&first) {
                            if self.chars.next() != Some('\\') || self.chars.next() != Some('u') {
                                return Err(TextError::InvalidJson);
                            }
                            let second = self.hex4()?;
                            if !(0xdc00..=0xdfff).contains(&second) {
                                return Err(TextError::InvalidJson);
                            }
                            0x10000 + (first - 0xd800) * 0x400 + second - 0xdc00
                        } else {
                            first
                        };
                        out.push(char::from_u32(codepoint).ok_or(TextError::InvalidJson)?);
                    }
                    _ => return Err(TextError::InvalidJson),
                },
                control if control < '\u{20}' => return Err(TextError::InvalidJson),
                character => out.push(character),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn both_json_catalogs_cover_all_frontend_ids_and_exact_placeholders() {
        for locale in [Locale::English, Locale::Japanese] {
            let catalog = Catalog::for_locale(locale).unwrap();
            for id in ALL_IDS {
                let params: Vec<_> = id
                    .parameters()
                    .iter()
                    .map(|name| (*name, "value"))
                    .collect();
                assert!(!catalog.format(id, &params).unwrap().is_empty());
            }
        }
        assert_eq!(Locale::default(), Locale::Japanese);
    }
    #[test]
    fn external_names_are_preserved_and_parameter_values_are_not_reparsed() {
        let name = "Alice 龍🐉 {name}";
        assert_eq!(
            Catalog::for_locale(Locale::Japanese)
                .unwrap()
                .format(TextId::PlayerWelcome, &[("name", name)])
                .unwrap(),
            "ようこそ、Alice 龍🐉 {name}。"
        );
        assert_eq!(
            Catalog::for_locale(Locale::English)
                .unwrap()
                .format(TextId::PlayerWelcome, &[("name", name)])
                .unwrap(),
            "Welcome, Alice 龍🐉 {name}."
        );
    }
    #[test]
    fn unknown_ids_and_missing_extra_duplicate_parameters_are_explicit() {
        let catalog = Catalog::for_locale(Locale::Japanese).unwrap();
        assert_eq!(
            catalog.format_key("monster.not.in.frontend", &[]),
            Err(TextError::UnknownId("monster.not.in.frontend".into()))
        );
        assert_eq!(
            catalog.format(TextId::SaveSaved, &[]),
            Err(TextError::MissingParameter("name".into()))
        );
        assert_eq!(
            catalog.format(TextId::SaveSaved, &[("name", "A"), ("extra", "B")]),
            Err(TextError::UnexpectedParameter("extra".into()))
        );
        assert_eq!(
            catalog.format(TextId::SaveSaved, &[("name", "A"), ("name", "B")]),
            Err(TextError::DuplicateParameter("name".into()))
        );
    }
    #[test]
    fn broken_coverage_and_placeholder_mismatches_fail_before_use() {
        let bad = EN_JSON.replace("\"save.saved\": \"Saved {name}.\",", "");
        assert!(matches!(
            Catalog::from_json(&bad),
            Err(TextError::MissingId(_))
        ));
        let bad = JA_JSON.replace("{name}", "{wrong}");
        assert!(matches!(
            Catalog::from_json(&bad),
            Err(TextError::InvalidPlaceholder(_))
        ));
        assert_eq!(
            parse_flat_json("{\"x\":\"\\uD83D\\uDC09\"}").unwrap(),
            vec![("x".into(), "🐉".into())]
        );
        assert_eq!(
            parse_flat_json("{\"x\":\"\\uD800\"}"),
            Err(TextError::InvalidJson)
        );
        assert_eq!(parse_flat_json("{\"x\":1}"), Err(TextError::InvalidJson));
    }
}
