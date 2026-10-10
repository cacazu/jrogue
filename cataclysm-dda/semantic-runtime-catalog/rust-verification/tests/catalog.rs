//! Prepared genuine-consumer checks. No cargo invocation has been authorized
//! during the current engine build window; Node evidence is separate.
use cdda_logic_contract::{ParameterValue, TextEvent, TextId, UPSTREAM_SHA};
use cdda_presentation::{Catalog, Locale, TextError};
use serde_json::{Value, json};
use std::collections::BTreeSet;

const RUNTIME_EN: &str = include_str!("../../output/en.json");
const RUNTIME_JA: &str = include_str!("../../output/ja.json");
const ORIGINAL_EN: &str = include_str!("../../../ja-current/en.json");
const ORIGINAL_JA: &str = include_str!("../../../ja-current/ja.json");
const PROVENANCE: &str = include_str!("../../output/provenance.json");
const BLOCKERS: &str = include_str!("../../output/blockers.json");

fn document(text: &str) -> Value {
    serde_json::from_str(text).expect("checked fixture JSON")
}

fn id(value: &str) -> TextId {
    TextId::new(value).expect("normalized semantic ID")
}

fn literal_fixture(source: &str, locale: &str) -> Catalog {
    // This escaping is confined to adversarial fixtures; actual generated
    // catalogs are loaded directly, without Rust-side transformations.
    let mut escaped = String::new();
    for character in source.chars() {
        escaped.push(character);
        if matches!(character, '{' | '}') {
            escaped.push(character);
        }
    }
    let raw = json!({"schema_version": 1, "locale": locale, "entries": {
        "fixture.literal": {"parameters": {}, "other": escaped}
    }});
    Catalog::from_json(&raw.to_string()).expect("literal brace fixture")
}

#[test]
fn all_315_public_ids_load_and_format_exact_original_text_in_both_locales() {
    let en_raw = document(RUNTIME_EN);
    let ja_raw = document(RUNTIME_JA);
    let en_original = document(ORIGINAL_EN);
    let ja_original = document(ORIGINAL_JA);
    let en = Catalog::from_json(RUNTIME_EN).expect("actual English catalog consumer");
    let ja = Catalog::from_json(RUNTIME_JA).expect("actual Japanese catalog consumer");
    let en_entries = en_raw["entries"].as_object().expect("entries object");
    let ja_entries = ja_raw["entries"].as_object().expect("entries object");
    assert_eq!(en_entries.len(), 315);
    assert_eq!(ja_entries.len(), 315);
    assert_eq!(
        en_entries.keys().collect::<BTreeSet<_>>(),
        ja_entries.keys().collect::<BTreeSet<_>>()
    );
    assert_eq!(en_raw["locale"], "en");
    assert_eq!(ja_raw["locale"], "ja");
    assert_eq!(en_original["source_commit"], UPSTREAM_SHA);
    assert_eq!(ja_original["source_commit"], UPSTREAM_SHA);

    let mut distinct_translations = 0;
    for name in en_entries.keys() {
        let identity = id(name);
        assert_eq!(identity.as_str(), name);
        let event = TextEvent::plain(identity);
        let english = en.format(&event).expect("English literal event");
        let japanese = ja.format(&event).expect("Japanese literal event");
        assert_eq!(
            english.as_bytes(),
            en_original["entries"][name]["text"]
                .as_str()
                .expect("original English")
                .as_bytes(),
            "English identity {name}"
        );
        assert_eq!(
            japanese.as_bytes(),
            ja_original["entries"][name]["text"]
                .as_str()
                .expect("original Japanese")
                .as_bytes(),
            "Japanese identity {name}"
        );
        if english != japanese {
            distinct_translations += 1;
        }
    }
    assert!(distinct_translations > 0, "locales must not be silently interchanged");
}

#[test]
fn all_315_provenance_identities_match_the_exact_existing_public_ids() {
    let provenance = document(PROVENANCE);
    let original = document(ORIGINAL_EN);
    let runtime = document(RUNTIME_EN);
    let records = provenance["entries"].as_array().expect("provenance entries");
    assert_eq!(records.len(), 315);
    assert_eq!(provenance["sourceCommit"], UPSTREAM_SHA);
    let provenance_ids: BTreeSet<_> = records
        .iter()
        .map(|record| record["id"].as_str().expect("provenance ID"))
        .collect();
    let runtime_ids: BTreeSet<_> = runtime["entries"]
        .as_object()
        .expect("runtime entries")
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(provenance_ids.len(), records.len(), "duplicate provenance ID");
    assert_eq!(provenance_ids, runtime_ids, "complete provenance ID coverage");
    for record in records {
        let name = record["id"].as_str().expect("public ID");
        assert!(runtime["entries"].get(name).is_some(), "{name}");
        assert_eq!(record["idMapping"]["inputPublicId"], name);
        assert_eq!(record["idMapping"]["runtimePublicId"], name);
        assert_eq!(record["idMapping"]["unchanged"], true);
        assert_eq!(record["singular"], original["entries"][name]["text"]);
        assert_eq!(record["context"], original["entries"][name]["context"]);
    }
}

#[test]
fn all_224_blocked_ids_fail_closed_and_default_locale_is_japanese() {
    let en = Catalog::from_json(RUNTIME_EN).expect("en");
    let ja = Catalog::from_json(RUNTIME_JA).expect("ja");
    let blockers = document(BLOCKERS);
    let blocked = blockers["records"].as_array().expect("blocker records");
    assert_eq!(blocked.len(), 224);
    let blocked_ids: BTreeSet<_> = blocked
        .iter()
        .map(|record| record["id"].as_str().expect("blocked ID"))
        .collect();
    let runtime_raw = document(RUNTIME_EN);
    let runtime_ids: BTreeSet<_> = runtime_raw["entries"]
        .as_object()
        .expect("runtime entries")
        .keys()
        .map(String::as_str)
        .collect();
    let original_en = document(ORIGINAL_EN);
    let original_ja = document(ORIGINAL_JA);
    let original_ids: BTreeSet<_> = original_en["entries"]
        .as_object()
        .expect("original English entries")
        .keys()
        .map(String::as_str)
        .collect();
    let original_ja_ids: BTreeSet<_> = original_ja["entries"]
        .as_object()
        .expect("original Japanese entries")
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(blocked_ids.len(), blocked.len(), "duplicate blocker ID");
    assert!(blocked_ids.is_disjoint(&runtime_ids));
    assert_eq!(runtime_ids.union(&blocked_ids).copied().collect::<BTreeSet<_>>(), original_ids);
    assert_eq!(original_ids, original_ja_ids);
    assert_eq!(Locale::default(), Locale::Ja);
    for record in blocked {
        let name = record["id"].as_str().expect("blocked ID");
        let event = TextEvent::plain(id(name));
        for catalog in [&en, &ja] {
            let error = catalog.format(&event).expect_err("blocked ID must remain absent");
            assert!(matches!(&error, TextError::MissingId(missing) if missing == name));
            assert_eq!(error.semantic_id(), "text.error.missing_id");
        }
    }
    // Catalog::format has no implicit cross-locale fallback API. A consumer
    // must retain this missing-ID result; any future fallback needs its own
    // explicit host policy and tests rather than a fabricated success here.
    let missing = TextEvent::plain(id("fixture.absent"));
    assert!(matches!(en.format(&missing), Err(TextError::MissingId(_))));
    assert!(matches!(ja.format(&missing), Err(TextError::MissingId(_))));
}

#[test]
fn actual_formatter_roundtrips_adversarial_literal_braces_utf8_and_whitespace() {
    for source in [
        "",
        "{",
        "}",
        "{}",
        "{{}}",
        "{not_parameter}",
        "{{user}}",
        "}unbalanced{",
        "猫{名前}\n  文🌸 }",
        "e\u{301}% 日本語  ",
    ] {
        for locale in ["en", "ja"] {
            let catalog = literal_fixture(source, locale);
            let actual = catalog
                .format(&TextEvent::plain(id("fixture.literal")))
                .expect("escaped literal");
            assert_eq!(actual.as_bytes(), source.as_bytes(), "{locale}: {source:?}");
        }
    }
}

#[test]
fn actual_consumer_rejects_extra_parameters_for_every_prepared_literal() {
    let raw = document(RUNTIME_EN);
    let entries = raw["entries"].as_object().expect("entries object");
    let en = Catalog::from_json(RUNTIME_EN).expect("en");
    let ja = Catalog::from_json(RUNTIME_JA).expect("ja");
    for name in entries.keys() {
        let mut event = TextEvent::plain(id(name));
        event.parameters.insert(
            "guessed_role".into(),
            ParameterValue::UserText("external {name} %s 猫".into()),
        );
        assert!(matches!(en.format(&event), Err(TextError::Parameters(_))));
        assert!(matches!(ja.format(&event), Err(TextError::Parameters(_))));
    }
}

#[test]
fn actual_consumer_rejects_unknown_schema_fields_and_unescaped_templates() {
    for template in ["{", "}", "{user", "{0}", "{user:>2}", "{name\n}"] {
        let raw = json!({"schema_version": 1, "locale": "en", "entries": {
            "fixture.literal": {"parameters": {}, "other": template}
        }});
        assert!(Catalog::from_json(&raw.to_string()).is_err(), "{template:?}");
    }
    let mut raw = document(RUNTIME_EN);
    raw["source_commit"] = json!(UPSTREAM_SHA);
    assert!(Catalog::from_json(&raw.to_string()).is_err());
    let raw = json!({"schema_version": 1, "locale": "en", "entries": {
        "fixture.literal": {"parameters": {}, "other": "text", "context": "old gettext"}
    }});
    assert!(Catalog::from_json(&raw.to_string()).is_err());
    for invalid in ["a\n", "a.2", "a.%s", "a.猫", "A"] {
        assert!(TextId::new(invalid).is_err(), "{invalid:?}");
    }
}

#[test]
fn actual_json_loader_rejects_unpaired_surrogate_escapes() {
    for escaped in [r"\ud800", r"\udfff", r"prefix\ud800suffix"] {
        let raw = format!(
            r#"{{"schema_version":1,"locale":"en","entries":{{"fixture.literal":{{"parameters":{{}},"other":"{escaped}"}}}}}}"#
        );
        assert!(Catalog::from_json(&raw).is_err(), "{escaped}");
    }
}
