//! Prepared genuine Rust Catalog tests. Cargo has not been run for this slice.
use cdda_logic_contract::{ParameterValue, TextEvent, TextId, UPSTREAM_SHA};
use cdda_presentation::{Catalog, Locale, TextError};
use cdda_source_plural_slice_verification::{DISPATCH_ID, FrozenNativeSelector, term_event};
use serde_json::Value;
use std::collections::BTreeSet;

const EN: &str = include_str!("../../output/en.json");
const JA: &str = include_str!("../../output/ja.json");
const INVENTORY: &str = include_str!("../../output/consumer-inventory.json");
const ORIGINAL_EN: &str = include_str!("../../../ja-current/en.json");
const ORIGINAL_JA: &str = include_str!("../../../ja-current/ja.json");

fn document(text: &str) -> Value {
    serde_json::from_str(text).expect("prepared JSON")
}
fn id(value: &str) -> TextId {
    TextId::new(value).expect("unchanged public ID")
}

#[test]
fn genuine_catalog_loads_all155_terms_and_one_distinct_internal_dispatcher() {
    Catalog::from_json(EN).expect("English genuine consumer");
    Catalog::from_json(JA).expect("Japanese genuine consumer");
    let en = document(EN);
    let ja = document(JA);
    let original = document(ORIGINAL_EN);
    let original_ja = document(ORIGINAL_JA);
    let en_entries = en["entries"].as_object().expect("entries");
    let ja_entries = ja["entries"].as_object().expect("entries");
    assert_eq!(en_entries.len(), 156);
    assert_eq!(en_entries.keys().collect::<BTreeSet<_>>(), ja_entries.keys().collect::<BTreeSet<_>>());
    assert_eq!(en["locale"], "en");
    assert_eq!(ja["locale"], "ja");
    assert_eq!(original["source_commit"], UPSTREAM_SHA);
    assert_eq!(original_ja["source_commit"], UPSTREAM_SHA);
    assert!(en_entries.contains_key(DISPATCH_ID));
    assert!(ja_entries.contains_key(DISPATCH_ID));
    assert!(original["entries"].get(DISPATCH_ID).is_none());
    assert!(original_ja["entries"].get(DISPATCH_ID).is_none());
    let inventory = document(INVENTORY);
    let records = inventory["records"].as_array().expect("inventory records");
    let record_ids: BTreeSet<_> = records.iter()
        .map(|record| record["id"].as_str().expect("ID"))
        .collect();
    let public_ids: BTreeSet<_> = en_entries.keys().map(String::as_str)
        .filter(|name| *name != DISPATCH_ID)
        .collect();
    assert_eq!(record_ids.len(), 155);
    assert_eq!(record_ids.len(), records.len(), "duplicate inventory ID");
    assert_eq!(record_ids, public_ids, "complete public term coverage");
    assert_eq!(Locale::default(), Locale::Ja);
    assert_eq!(document(INVENTORY)["sourceCommit"], UPSTREAM_SHA);
}

#[test]
fn all155_native_one_other_forms_and_japanese_invariance_format_exactly() {
    let en = Catalog::from_json(EN).expect("en");
    let ja = Catalog::from_json(JA).expect("ja");
    let inventory = document(INVENTORY);
    let records = inventory["records"].as_array().expect("records");
    let original_en = document(ORIGINAL_EN);
    let original_ja = document(ORIGINAL_JA);
    assert_eq!(records.len(), 155);
    for record in records {
        let name = record["id"].as_str().expect("ID");
        assert_eq!(record["en"], original_en["entries"][name]["text"]);
        assert_eq!(record["ja"], original_ja["entries"][name]["text"]);
        assert_eq!(record["sourcePluralVariants"][0], original_en["entries"][name]["plural"]);
        assert_eq!(record["context"], original_en["entries"][name]["context"]);
        assert_eq!(record["context"], original_ja["entries"][name]["context"]);
        assert_eq!(record["idMapping"]["inputPublicId"], name);
        assert_eq!(record["idMapping"]["runtimePublicId"], name);
        assert_eq!(record["idMapping"]["unchanged"], true);
        let one = term_event(id(name), FrozenNativeSelector::One).expect("one event");
        let other = term_event(id(name), FrozenNativeSelector::Other).expect("other event");
        assert_eq!(en.format(&one).expect("one"), record["en"].as_str().expect("singular"));
        assert_eq!(en.format(&other).expect("other"), record["sourcePluralVariants"][0].as_str().expect("plural"));
        for event in [&one, &other] {
            assert_eq!(ja.format(event).expect("invariant Japanese"), record["ja"].as_str().expect("Japanese"));
        }
    }
}

#[test]
fn source_boundary_fixture_categories_0_1_2_negative_min_and_max_select_exact_forms() {
    let en = Catalog::from_json(EN).expect("en");
    let ja = Catalog::from_json(JA).expect("ja");
    let inventory = document(INVENTORY);
    // Categories are fixture inputs; actual C++ selector execution is a
    // separate prepared native fixture and remains pending.
    let fixtures = [
        (0, FrozenNativeSelector::Other),
        (1, FrozenNativeSelector::One),
        (2, FrozenNativeSelector::Other),
        (-1, FrozenNativeSelector::Other),
        (i32::MIN, FrozenNativeSelector::Other),
        (i32::MAX, FrozenNativeSelector::Other),
    ];
    for record in inventory["records"].as_array().expect("records") {
        for (native_int, selector) in fixtures {
            let event = term_event(id(record["id"].as_str().expect("ID")), selector).expect("fixture");
            let expected = if native_int == 1 { &record["en"] } else { &record["sourcePluralVariants"][0] };
            assert_eq!(en.format(&event).expect("English"), expected.as_str().expect("expected"));
            assert_eq!(ja.format(&event).expect("Japanese"), record["ja"].as_str().expect("Japanese"));
        }
    }
}

#[test]
fn original_irregular_plural_and_liquid_versus_variant_frozen_categories_are_preserved() {
    let en = Catalog::from_json(EN).expect("en");
    let monster = id("cdda.mod.aftershock_exoplanet.monster.mon_old_imaginifer_laser.name");
    assert_eq!(en.format(&term_event(monster, FrozenNativeSelector::Other).expect("event")).expect("irregular plural"), "velites");
    let radio = id("cdda.core.item.balthazar_radio.name");
    // Synthetic phase fixtures bind actual forms to the producer's frozen
    // decision, not a claim that this particular radio is a liquid.
    let liquid_frozen_one = term_event(radio.clone(), FrozenNativeSelector::One).expect("liquid");
    let variant_quantity_two = term_event(radio, FrozenNativeSelector::Other).expect("variant");
    assert_eq!(en.format(&liquid_frozen_one).expect("liquid"), "modified radio");
    assert_eq!(en.format(&variant_quantity_two).expect("variant"), "modified radios");
}

#[test]
fn public_plain_events_do_not_silently_claim_an_external_selector_or_missing_fallback() {
    let en = Catalog::from_json(EN).expect("en");
    let ja = Catalog::from_json(JA).expect("ja");
    let inventory = document(INVENTORY);
    for record in inventory["records"].as_array().expect("records") {
        let plain = TextEvent::plain(id(record["id"].as_str().expect("ID")));
        assert_eq!(en.format(&plain).expect("plain has no count"), record["sourcePluralVariants"][0].as_str().expect("other"));
    }
    let missing = term_event(id("fixture.absent"), FrozenNativeSelector::One).expect("event");
    let recursive = term_event(id(DISPATCH_ID), FrozenNativeSelector::One).expect("event");
    let first = inventory["records"][0]["id"].as_str().expect("first ID");
    let valid = term_event(id(first), FrozenNativeSelector::One).expect("event");
    let mut missing_parameter = valid.clone();
    missing_parameter.parameters.clear();
    let mut extra_parameter = valid.clone();
    extra_parameter.parameters.insert("extra".into(), ParameterValue::Count(1));
    let mut wrong_count = valid.clone();
    wrong_count.parameters.insert("leaf".into(), ParameterValue::Count(1));
    let mut wrong_user = valid;
    wrong_user.parameters.insert("leaf".into(), ParameterValue::UserText("external user".into()));
    for catalog in [&en, &ja] {
        assert!(matches!(catalog.format(&missing), Err(TextError::MissingId(name)) if name == "fixture.absent"));
        assert!(matches!(catalog.format(&recursive), Err(TextError::Term(name)) if name == DISPATCH_ID));
        for malformed in [&missing_parameter, &extra_parameter, &wrong_count, &wrong_user] {
            assert!(matches!(catalog.format(malformed), Err(TextError::Parameters(name)) if name == DISPATCH_ID));
        }
    }
}
