//! Read-only Rust display projection of original C/Lua Actor/Game fields.
//! No core handle, gameplay formulas, RNG, FOV computation, or original save serializer.

use serde::de::{MapAccess, Visitor};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;
use tome_core_contracts::{ContractError, GameSnapshot, Locale, Snapshot};

pub mod ui;
pub mod ui_catalog;

/// Diagnostic view, not the complete original UI or invisibility/ESP rendering policy.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Frame {
    pub locale: Locale,
    pub labels: BTreeMap<String, String>,
    pub ready: bool,
    pub game: Option<GameSnapshot>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DisplayError {
    Contract(ContractError),
    Catalog,
}

impl DisplayError {
    #[must_use]
    pub const fn text_id(self) -> &'static str {
        match self {
            Self::Contract(error) => error.text_id(),
            Self::Catalog => "error.core.catalog",
        }
    }
}

/// Build a frame only from immutable records; there is no path back to the native core.
/// Original names are external source text and remain byte-for-byte unchanged.
///
/// # Errors
/// Rejects invalid native projections or incomplete UI label catalogs.
pub fn render(snapshot: &Snapshot, locale: Locale) -> Result<Frame, DisplayError> {
    snapshot.validate().map_err(DisplayError::Contract)?;
    Ok(Frame {
        locale,
        labels: labels(locale)?,
        ready: snapshot.ready,
        game: snapshot.game.clone(),
    })
}

/// Adapter-only UI text. Upstream content needs its separately inventoried semantic IDs.
///
/// # Errors
/// Rejects malformed catalogs or mismatched adapter-label coverage.
pub fn labels(locale: Locale) -> Result<BTreeMap<String, String>, DisplayError> {
    let ja = parse_labels(include_str!("../locales/ja.json"))?;
    let en = parse_labels(include_str!("../locales/en.json"))?;
    if ja.keys().ne(en.keys()) {
        return Err(DisplayError::Catalog);
    }
    Ok(match locale {
        Locale::Ja => ja,
        Locale::En => en,
    })
}

fn parse_labels(json: &str) -> Result<BTreeMap<String, String>, DisplayError> {
    struct UniqueLabels(BTreeMap<String, String>);
    impl<'de> Deserialize<'de> for UniqueLabels {
        fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
            struct LabelsVisitor;
            impl<'de> Visitor<'de> for LabelsVisitor {
                type Value = UniqueLabels;
                fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                    formatter.write_str("unique parameter-free semantic UI labels")
                }
                fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                    let mut labels = BTreeMap::new();
                    while let Some((id, value)) = map.next_entry::<String, String>()? {
                        let valid_id = id.split('.').all(|part| {
                            !part.is_empty()
                                && part.bytes().all(|byte| {
                                    byte.is_ascii_lowercase()
                                        || byte.is_ascii_digit()
                                        || byte == b'_'
                                })
                        });
                        if !valid_id
                            || value.is_empty()
                            || value.contains('{')
                            || value.contains('}')
                        {
                            return Err(serde::de::Error::custom(
                                "invalid static semantic UI label",
                            ));
                        }
                        if labels.insert(id, value).is_some() {
                            return Err(serde::de::Error::custom("duplicate semantic UI label"));
                        }
                    }
                    Ok(UniqueLabels(labels))
                }
            }
            deserializer.deserialize_map(LabelsVisitor)
        }
    }
    serde_json::from_str::<UniqueLabels>(json)
        .map(|labels| labels.0)
        .map_err(|_| DisplayError::Catalog)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locale_rendering_cannot_create_or_mutate_gameplay() {
        let snapshot = Snapshot::from_bytes(
            br#"{"protocol":1,"ready":false,"game":{"turn":12,"paused":true}}"#,
        )
        .expect("fixture");
        let before = serde_json::to_vec(&snapshot).expect("fixture");
        for locale in [Locale::Ja, Locale::En, Locale::Ja] {
            let frame = render(&snapshot, locale).expect("fixture");
            assert_eq!(frame.game, snapshot.game);
            assert!(!frame.ready);
            assert!(frame.game.expect("original game").player.is_none());
        }
        assert_eq!(serde_json::to_vec(&snapshot).expect("fixture"), before);
    }

    #[test]
    fn adapter_catalogs_have_exact_coverage_and_japanese_default() {
        let ja = labels(Locale::Ja).expect("fixture");
        let en = labels(Locale::En).expect("fixture");
        assert_eq!(Locale::default(), Locale::Ja);
        assert!(ja.keys().eq(en.keys()));
        for id in [
            "ui.core.title",
            "ui.core.diagnostic",
            "ui.core.wait",
            "error.core.protocol",
            "error.core.busy",
        ] {
            assert!(ja.contains_key(id));
        }
        assert_ne!(ja["ui.core.title"], en["ui.core.title"]);
    }

    #[test]
    fn adapter_static_labels_reject_duplicates_and_unhandled_placeholders() {
        for json in [
            r#"{"ui.test":"a","ui.test":"b"}"#,
            r#"{"ui.test":"{name}"}"#,
            r#"{"ui.test":"invalid}"}"#,
            r#"{"":"empty id"}"#,
            r#"{"ui.test":""}"#,
        ] {
            assert_eq!(parse_labels(json), Err(DisplayError::Catalog));
        }
    }
}
