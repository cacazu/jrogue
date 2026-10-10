//! Separate checked parameterized content for original dialog projections.
//! Static adapter labels keep their own parameter-free 54-ID contract.

use serde::de::{MapAccess, Visitor};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;
use tome_core_contracts::Locale;
use tome_core_contracts::ui::UiError;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct UiContentEntries(BTreeMap<String, String>);

impl<'de> Deserialize<'de> for UiContentEntries {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct EntriesVisitor;
        impl<'de> Visitor<'de> for EntriesVisitor {
            type Value = UiContentEntries;
            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("unique semantic UI content IDs with valid placeholders")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let mut entries = BTreeMap::new();
                while let Some((id, template)) = map.next_entry::<String, String>()? {
                    let valid_id = id.split('.').all(|part| {
                        !part.is_empty()
                            && part.bytes().all(|byte| {
                                byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_'
                            })
                    });
                    if !valid_id || template.is_empty() || placeholders(&template).is_err() {
                        return Err(serde::de::Error::custom("invalid semantic UI content"));
                    }
                    if entries.insert(id, template).is_some() {
                        return Err(serde::de::Error::custom("duplicate semantic UI content ID"));
                    }
                }
                Ok(UiContentEntries(entries))
            }
        }
        deserializer.deserialize_map(EntriesVisitor)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UiContentCatalog {
    english: UiContentEntries,
    japanese: UiContentEntries,
}

impl UiContentCatalog {
    pub fn from_json(english: &str, japanese: &str) -> Result<Self, UiError> {
        let english: UiContentEntries = serde_json::from_str(english).map_err(|_| UiError::Text)?;
        let japanese: UiContentEntries =
            serde_json::from_str(japanese).map_err(|_| UiError::Text)?;
        if english.0.is_empty() || english.0.keys().ne(japanese.0.keys()) {
            return Err(UiError::Text);
        }
        for (id, template) in &english.0 {
            let target = japanese.0.get(id).ok_or(UiError::Text)?;
            if placeholders(template)? != placeholders(target)? {
                return Err(UiError::Text);
            }
        }
        Ok(Self { english, japanese })
    }

    pub fn embedded() -> Result<Self, UiError> {
        Self::from_json(
            include_str!("../locales/ui-content-en.json"),
            include_str!("../locales/ui-content-ja.json"),
        )
    }

    #[must_use]
    pub fn templates(&self, locale: Locale) -> &BTreeMap<String, String> {
        match locale {
            Locale::En => &self.english.0,
            Locale::Ja => &self.japanese.0,
        }
    }

    /// Host entries may only address declared UI content and preserve its exact
    /// placeholder names/counts. Static labels cannot be overwritten here.
    pub fn validate_overlay(
        &self,
        locale: Locale,
        entries: &UiContentEntries,
    ) -> Result<(), UiError> {
        let declared = self.templates(locale);
        for (id, template) in &entries.0 {
            let original = declared.get(id).ok_or(UiError::Text)?;
            if placeholders(original)? != placeholders(template)? {
                return Err(UiError::Text);
            }
        }
        Ok(())
    }
}

impl UiContentEntries {
    #[must_use]
    pub fn into_entries(self) -> BTreeMap<String, String> {
        self.0
    }
}

fn placeholders(template: &str) -> Result<BTreeMap<&str, usize>, UiError> {
    let mut result = BTreeMap::new();
    let mut rest = template;
    while let Some(start) = rest.find('{') {
        if rest[..start].contains('}') {
            return Err(UiError::Text);
        }
        let end = rest[start + 1..].find('}').ok_or(UiError::Text)? + start + 1;
        let name = &rest[start + 1..end];
        if name.is_empty()
            || !name
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
        {
            return Err(UiError::Text);
        }
        *result.entry(name).or_insert(0) += 1;
        rest = &rest[end + 1..];
    }
    if rest.contains('}') {
        return Err(UiError::Text);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ui::resolve_text;
    use tome_core_contracts::ui::{UiArgument, UiText};

    #[test]
    fn declared_dialog_content_has_exact_coverage_and_bilingual_parameter_contract() {
        let catalog = UiContentCatalog::embedded().expect("reviewed native dialog catalogue");
        let ids = [
            "ui.roundtrip.body",
            "ui.roundtrip.no",
            "ui.roundtrip.title",
            "ui.roundtrip.yes",
        ];
        for locale in [Locale::Ja, Locale::En] {
            assert!(catalog.templates(locale).keys().map(String::as_str).eq(ids));
            assert_eq!(
                placeholders(&catalog.templates(locale)["ui.roundtrip.body"]).expect("contract"),
                BTreeMap::from([("character_name", 1)])
            );
            let labels = crate::labels(locale).expect("unchanged static labels");
            assert_eq!(labels.len(), 54);
            assert!(ids.iter().all(|id| !labels.contains_key(*id)));
        }
        for (english, japanese) in [
            (r#"{"ui.x":"A","ui.x":"B"}"#, r#"{"ui.x":"C"}"#),
            (r#"{"ui.x":"{name}"}"#, r#"{"ui.y":"{name}"}"#),
            (r#"{"ui.x":"{name}"}"#, r#"{"ui.x":"{other}"}"#),
            (r#"{"ui.x":"{name}{name}"}"#, r#"{"ui.x":"{name}"}"#),
            (r#"{"ui.x":"{name}"}"#, r#"{"ui.x":"{name"}"#),
            (r#"{"ui.x":"A"}"#, r#"{"ui.x":"{nested{key}}"}"#),
            (r#"{"ui.X":"A"}"#, r#"{"ui.X":"B"}"#),
        ] {
            assert_eq!(
                UiContentCatalog::from_json(english, japanese),
                Err(UiError::Text)
            );
        }
    }

    #[test]
    fn real_dialog_content_preserves_external_names_and_rejects_missing_excess_args() {
        let catalog = UiContentCatalog::embedded().expect("catalogue");
        let external = "wolf {character_name} <script> 日本語";
        let args = BTreeMap::from([(
            "character_name".into(),
            UiArgument::External {
                value: external.into(),
            },
        )]);
        let text = UiText::Semantic {
            id: "ui.roundtrip.body".into(),
            args: args.clone(),
        };
        assert_eq!(
            resolve_text(&text, catalog.templates(Locale::Ja)),
            Ok(format!("{external}でプレイを続けますか？"))
        );
        assert_eq!(
            resolve_text(&text, catalog.templates(Locale::En)),
            Ok(format!("Continue playing as {external}?"))
        );
        assert_eq!(
            resolve_text(
                &UiText::Semantic {
                    id: "ui.roundtrip.body".into(),
                    args: BTreeMap::new()
                },
                catalog.templates(Locale::Ja)
            ),
            Err(UiError::Text)
        );
        let mut excess = args;
        excess.insert(
            "unused".into(),
            UiArgument::External {
                value: "external".into(),
            },
        );
        assert_eq!(
            resolve_text(
                &UiText::Semantic {
                    id: "ui.roundtrip.body".into(),
                    args: excess
                },
                catalog.templates(Locale::Ja)
            ),
            Err(UiError::Text)
        );
        let static_override: UiContentEntries =
            serde_json::from_str(r#"{"ui.core.title":"replacement"}"#).expect("well formed");
        assert_eq!(
            catalog.validate_overlay(Locale::Ja, &static_override),
            Err(UiError::Text)
        );
        let wrong_parameter: UiContentEntries =
            serde_json::from_str(r#"{"ui.roundtrip.body":"{username}"}"#).expect("well formed");
        assert_eq!(
            catalog.validate_overlay(Locale::Ja, &wrong_parameter),
            Err(UiError::Text)
        );
    }
}
