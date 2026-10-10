use drl_web_port::{
    display::{self, DisplayError, Message, Parameter},
    logic::rng::GameRng,
    platform::{self, SaveError},
};
use std::collections::BTreeMap;

#[test]
fn declared_locale_ids_and_named_placeholders_match() {
    let en = display::catalog_json(include_str!("../locales/en.json")).unwrap();
    let ja = display::catalog_json(include_str!("../locales/ja.json")).unwrap();
    display::validate_pair(&en, &ja).unwrap();
    let mut changed = ja.clone();
    changed.insert("lab.last_value".into(), "値：{wrong}".into());
    assert_eq!(
        display::validate_pair(&en, &changed),
        Err(DisplayError::PlaceholderMismatch("lab.last_value".into()))
    );
    changed.remove("lab.last_value");
    assert!(display::validate_pair(&en, &changed).is_err());
}

#[test]
fn catalog_rejects_duplicate_ids_and_trailing_json() {
    assert!(display::catalog_json(r#"{"same":"first","same":"second"}"#).is_err());
    assert!(display::catalog_json(r#"{"one":"first"} {}"#).is_err());
    assert!(display::catalog_json(r#"{"number":1}"#).is_err());
}

#[test]
fn username_and_markup_are_external_data_not_translation_keys() {
    let ja = display::catalog_json(include_str!("../locales/ja.json")).unwrap();
    for name in ["pistol", "太郎👩‍🚀", "{count}<script>%s%n"] {
        let message = Message {
            id: "message.player".into(),
            parameters: BTreeMap::from([("name".into(), Parameter::Text(name.into()))]),
        };
        assert_eq!(
            display::render(&ja, &message).unwrap(),
            format!("プレイヤー：{name}")
        );
    }
}

#[test]
fn display_fails_on_missing_or_malformed_ids_without_fallback() {
    let catalog = BTreeMap::from([
        ("broken".into(), "{count".into()),
        ("escape".into(), "{{escaped}} {value}".into()),
    ]);
    let message = Message {
        id: "missing".into(),
        parameters: BTreeMap::new(),
    };
    assert!(matches!(
        display::render(&catalog, &message),
        Err(DisplayError::MissingId(_))
    ));
    assert!(display::placeholders("{count").is_err());
    assert!(display::placeholders("{a-b}").is_err());
    assert!(display::placeholders("}").is_err());
    let message = Message {
        id: "escape".into(),
        parameters: BTreeMap::from([("value".into(), Parameter::Text("{x}".into()))]),
    };
    assert_eq!(
        display::render(&catalog, &message).unwrap(),
        "{escaped} {x}"
    );
}

#[test]
fn renderer_does_not_change_simulation_rng_and_locale_reorders_parameters() {
    let rng = GameRng::seeded(777);
    let state = rng.snapshot();
    let en = BTreeMap::from([("damage".into(), "{actor} hits {target} for {damage}".into())]);
    let ja = BTreeMap::from([(
        "damage".into(),
        "{target} に {actor} が {damage} のダメージ".into(),
    )]);
    let message = Message {
        id: "damage".into(),
        parameters: BTreeMap::from([
            ("actor".into(), Parameter::Text("日本語名".into())),
            ("target".into(), Parameter::Text("enemy".into())),
            ("damage".into(), Parameter::Number(9)),
        ]),
    };
    display::validate_pair(&en, &ja).unwrap();
    for _ in 0..100 {
        display::render(&en, &message).unwrap();
        display::render(&ja, &message).unwrap();
    }
    assert_eq!(rng.snapshot(), state);
    assert_eq!(
        display::render(&ja, &message).unwrap(),
        "enemy に 日本語名 が 9 のダメージ"
    );
}

#[test]
fn checkpoint_roundtrip_preserves_unicode_and_future_rng_stream() {
    let mut rng = GameRng::seeded(2002);
    for _ in 0..623 {
        rng.next_u32();
    }
    let saved = platform::encode(&("名👩‍🚀", rng.snapshot())).unwrap();
    let (name, state): (String, drl_web_port::logic::rng::RngState) =
        platform::decode(&saved).unwrap();
    assert_eq!(name, "名👩‍🚀");
    let mut restored = GameRng::restore(state).unwrap();
    for _ in 0..1000 {
        assert_eq!(rng.next_u32(), restored.next_u32());
    }
}

#[test]
fn checkpoint_rejects_version_provenance_corruption_and_native_save() {
    let saved = platform::encode(&vec![1_u32, 2, 3]).unwrap();
    for (field, value, expected) in [
        (
            "version",
            serde_json::json!(2),
            SaveError::UnsupportedVersion,
        ),
        (
            "source_commit",
            serde_json::json!("other"),
            SaveError::SourceMismatch,
        ),
        (
            "engine_commit",
            serde_json::json!("other"),
            SaveError::EngineMismatch,
        ),
        (
            "format",
            serde_json::json!("native"),
            SaveError::WrongFormat,
        ),
        (
            "payload",
            serde_json::json!("[2,3,4]"),
            SaveError::ChecksumMismatch,
        ),
    ] {
        let mut value_json: serde_json::Value = serde_json::from_str(&saved).unwrap();
        value_json[field] = value;
        assert_eq!(
            platform::decode::<Vec<u32>>(&value_json.to_string()),
            Err(expected)
        );
    }
    assert_eq!(
        platform::decode::<Vec<u32>>("DRL native binary"),
        Err(SaveError::InvalidJson)
    );
    assert_eq!(
        platform::decode::<Vec<u32>>(&" ".repeat(platform::MAX_SAVE_BYTES + 1)),
        Err(SaveError::TooLarge)
    );
}

#[test]
fn plural_is_a_locale_projection_of_explicit_count() {
    assert_eq!(display::plural_id("item.ammo", 1, false), "item.ammo.one");
    assert_eq!(display::plural_id("item.ammo", 0, false), "item.ammo.many");
    assert_eq!(display::plural_id("item.ammo", 2, false), "item.ammo.many");
    assert_eq!(display::plural_id("item.ammo", 1, true), "item.ammo.count");
}
