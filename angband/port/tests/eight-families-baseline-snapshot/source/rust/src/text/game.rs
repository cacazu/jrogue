//! Static game messages are selected by reviewed semantic IDs in C callsites.
//! Completed English strings are never used as lookup keys or replaced.

use super::{Locale, TextError, parse_flat_json, placeholder_names};
use std::collections::BTreeMap;

// This module lives in rust/src/text, so three parents reach angband-port.
pub const GAME_EN_JSON: &str = include_str!("../../../locales/game-en.json");
pub const GAME_JA_JSON: &str = include_str!("../../../locales/game-ja.json");

/// The deliberately bounded, parameter-free game message migration.
#[derive(Clone, Debug)]
pub struct GameCatalog {
    entries: BTreeMap<String, String>,
}

impl GameCatalog {
    /// Load the source-grounded static message catalog for one locale.
    pub fn for_locale(locale: Locale) -> Result<Self, TextError> {
        Self::from_json(match locale {
            Locale::English => GAME_EN_JSON,
            Locale::Japanese => GAME_JA_JSON,
        })
    }

    /// Read exactly the top-level `messages` object, leaving coverage metadata
    /// separate. Reject duplicate IDs, malformed text, and any placeholders.
    pub fn from_json(json: &str) -> Result<Self, TextError> {
        let messages = messages_object(json)?;
        let mut entries = BTreeMap::new();
        for (id, value) in parse_flat_json(messages)? {
            if !id.starts_with("game.")
                || id.len() > 127
                || !id.bytes().all(|byte| {
                    byte.is_ascii_lowercase()
                        || byte.is_ascii_digit()
                        || byte == b'.'
                        || byte == b'_'
                })
            {
                return Err(TextError::UnknownId(id));
            }
            if !placeholder_names(&value)?.is_empty() || value.contains('\0') || value.contains('%')
            {
                return Err(TextError::InvalidPlaceholder(id));
            }
            if entries.insert(id.clone(), value).is_some() {
                return Err(TextError::DuplicateId(id));
            }
        }
        Ok(Self { entries })
    }

    /// Resolve an exact source ID, with an explicit error for an unknown ID.
    pub fn message(&self, id: &str) -> Result<&str, TextError> {
        self.entries
            .get(id)
            .map(String::as_str)
            .ok_or_else(|| TextError::UnknownId(id.to_owned()))
    }

    /// Stable sorted IDs used for coverage comparisons.
    pub fn ids(&self) -> impl Iterator<Item = &str> {
        self.entries.keys().map(String::as_str)
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

// The outer file has arbitrary nested metadata. This structural scanner tracks
// brackets and quoted strings, including escaped quotes, instead of searching
// for an English string or the first textual occurrence of "messages".
fn messages_object(json: &str) -> Result<&str, TextError> {
    let bytes = json.as_bytes();
    let mut cursor = 0;
    skip_space(bytes, &mut cursor);
    take(bytes, &mut cursor, b'{')?;
    let mut messages = None;
    skip_space(bytes, &mut cursor);
    if bytes.get(cursor) == Some(&b'}') {
        return Err(TextError::MissingId("messages".into()));
    }
    loop {
        skip_space(bytes, &mut cursor);
        let key_start = cursor;
        cursor = string_end(bytes, cursor)?;
        // Reuse the strict JSON string decoder for escaped top-level keys.
        let decoded = parse_flat_json(&format!("{{\"key\":{}}}", &json[key_start..cursor]))?;
        let key = &decoded[0].1;
        skip_space(bytes, &mut cursor);
        take(bytes, &mut cursor, b':')?;
        skip_space(bytes, &mut cursor);
        let value_start = cursor;
        cursor = value_end(bytes, cursor)?;
        if key == "messages" {
            if messages.is_some() {
                return Err(TextError::DuplicateId("messages".into()));
            }
            if bytes.get(value_start) != Some(&b'{') {
                return Err(TextError::InvalidJson);
            }
            messages = Some(&json[value_start..cursor]);
        }
        skip_space(bytes, &mut cursor);
        match bytes.get(cursor) {
            Some(b',') => {
                cursor += 1;
            }
            Some(b'}') => {
                cursor += 1;
                break;
            }
            _ => return Err(TextError::InvalidJson),
        }
    }
    skip_space(bytes, &mut cursor);
    if cursor != bytes.len() {
        return Err(TextError::InvalidJson);
    }
    messages.ok_or_else(|| TextError::MissingId("messages".into()))
}

fn skip_space(bytes: &[u8], cursor: &mut usize) {
    while bytes
        .get(*cursor)
        .is_some_and(|byte| matches!(byte, b' ' | b'\n' | b'\r' | b'\t'))
    {
        *cursor += 1;
    }
}

fn take(bytes: &[u8], cursor: &mut usize, expected: u8) -> Result<(), TextError> {
    if bytes.get(*cursor) != Some(&expected) {
        return Err(TextError::InvalidJson);
    }
    *cursor += 1;
    Ok(())
}

fn string_end(bytes: &[u8], start: usize) -> Result<usize, TextError> {
    if bytes.get(start) != Some(&b'"') {
        return Err(TextError::InvalidJson);
    }
    let mut cursor = start + 1;
    while let Some(&byte) = bytes.get(cursor) {
        match byte {
            b'"' => return Ok(cursor + 1),
            b'\\' => {
                cursor += 1;
                match bytes.get(cursor) {
                    Some(b'"' | b'\\' | b'/' | b'b' | b'f' | b'n' | b'r' | b't') => {}
                    Some(b'u') => {
                        let digits = bytes
                            .get(cursor + 1..cursor + 5)
                            .ok_or(TextError::InvalidJson)?;
                        if !digits.iter().all(u8::is_ascii_hexdigit) {
                            return Err(TextError::InvalidJson);
                        }
                        cursor += 4;
                    }
                    _ => return Err(TextError::InvalidJson),
                }
            }
            0..=0x1f => return Err(TextError::InvalidJson),
            _ => {}
        }
        cursor += 1;
    }
    Err(TextError::InvalidJson)
}

fn value_end(bytes: &[u8], start: usize) -> Result<usize, TextError> {
    match bytes.get(start) {
        Some(b'"') => string_end(bytes, start),
        Some(b'{' | b'[') => {
            let mut stack = vec![bytes[start]];
            let mut cursor = start + 1;
            while let Some(&byte) = bytes.get(cursor) {
                match byte {
                    b'"' => {
                        cursor = string_end(bytes, cursor)?;
                        continue;
                    }
                    b'{' | b'[' => stack.push(byte),
                    b'}' | b']' => {
                        let expected = if byte == b'}' { b'{' } else { b'[' };
                        if stack.pop() != Some(expected) {
                            return Err(TextError::InvalidJson);
                        }
                        if stack.is_empty() {
                            return Ok(cursor + 1);
                        }
                    }
                    _ => {}
                }
                cursor += 1;
            }
            Err(TextError::InvalidJson)
        }
        Some(_) => {
            let mut cursor = start;
            while let Some(byte) = bytes.get(cursor) {
                if matches!(byte, b',' | b'}' | b']') {
                    break;
                }
                cursor += 1;
            }
            if cursor == start {
                Err(TextError::InvalidJson)
            } else {
                Ok(cursor)
            }
        }
        None => Err(TextError::InvalidJson),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reviewed_game_catalogs_have_equal_44_ids_and_no_parameters() {
        let en = GameCatalog::for_locale(Locale::English).unwrap();
        let ja = GameCatalog::for_locale(Locale::Japanese).unwrap();
        assert_eq!(en.len(), 44);
        assert_eq!(ja.len(), 44);
        assert_eq!(en.ids().collect::<Vec<_>>(), ja.ids().collect::<Vec<_>>());
        for id in en.ids() {
            for catalog in [&en, &ja] {
                let message = catalog.message(id).unwrap();
                assert!(!message.is_empty());
                assert!(placeholder_names(message).unwrap().is_empty());
                assert!(!message.contains('%'));
            }
        }
        assert_eq!(
            en.message("game.stairs.up.missing").unwrap(),
            "I see no up staircase here."
        );
        assert_eq!(
            ja.message("game.stairs.up.missing").unwrap(),
            "ここには上り階段が見当たらない。"
        );
    }

    #[test]
    fn game_lookup_is_by_semantic_id_and_unknown_ids_are_explicit() {
        let catalog = GameCatalog::for_locale(Locale::Japanese).unwrap();
        assert_eq!(
            catalog.message("game.not.reviewed"),
            Err(TextError::UnknownId("game.not.reviewed".into()))
        );
        assert_eq!(
            catalog.message("I see no up staircase here."),
            Err(TextError::UnknownId("I see no up staircase here.".into()))
        );
        let formatted = r#"{"_meta":{},"messages":{"game.test":"{name}"}}"#;
        assert!(matches!(
            GameCatalog::from_json(formatted),
            Err(TextError::InvalidPlaceholder(_))
        ));
    }

    #[test]
    fn messages_scanner_ignores_nested_keys_strings_and_escaped_braces() {
        let json = r#"{"_meta":{"messages":{"fake":"not selected"},"note":"} \"messages\": {", "nested":[{"x":"[}]"}]},"messages":{"game.test":"Correct."}}"#;
        assert_eq!(
            GameCatalog::from_json(json)
                .unwrap()
                .message("game.test")
                .unwrap(),
            "Correct."
        );
        let escaped_key = r#"{"_meta":{},"message\u0073":{"game.test":"Correct."}}"#;
        assert_eq!(
            GameCatalog::from_json(escaped_key)
                .unwrap()
                .message("game.test")
                .unwrap(),
            "Correct."
        );
        assert!(matches!(
            GameCatalog::from_json(r#"{"messages":{},"messages":{}}"#),
            Err(TextError::DuplicateId(_))
        ));
        assert!(matches!(
            GameCatalog::from_json(r#"{"_meta":{"x":[}},"messages":{}}"#),
            Err(TextError::InvalidJson)
        ));
        assert!(matches!(
            GameCatalog::from_json(r#"{"messages":{"game.test":"A"}} trailing"#),
            Err(TextError::InvalidJson)
        ));
    }
}
