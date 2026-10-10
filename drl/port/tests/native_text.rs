use drl_web_port::display::native_text::{
    Error, Locales, Parameter, WireParameter, canonical_integer, deserialize_parameters,
};
use std::collections::BTreeMap;

#[test]
fn every_curated_native_id_and_typed_placeholder_is_validated() {
    let locales = Locales::compiled().unwrap();
    let english: BTreeMap<String, String> =
        serde_json::from_str(include_str!("../locales/native-en.json")).unwrap();
    assert_eq!(locales.count(), english.len());
    assert!(locales.count() >= 432);
    let contract: serde_json::Value =
        serde_json::from_str(include_str!("../locales/native-contract.json")).unwrap();
    for id in english.keys() {
        let parameters = contract["parameters"][id]
            .as_object()
            .unwrap()
            .iter()
            .map(|(name, kind)| {
                (
                    name.clone(),
                    if kind == "integer" {
                        Parameter::Integer(17)
                    } else {
                        Parameter::String("外部名{{uninterpreted}}".into())
                    },
                )
            })
            .collect();
        for english in [true, false] {
            assert!(locales.render(id, &parameters, english).is_ok(), "{id}");
        }
    }
}
#[test]
fn original_color_markup_and_named_values_remain_distinct() {
    let locales = Locales::compiled().unwrap();
    let params = BTreeMap::from([("seed".into(), Parameter::Integer(4_294_967_295))]);
    assert_eq!(
        locales.render("menu.seed.value", &params, true).unwrap(),
        "Seed: {!4294967295}"
    );
    assert!(
        locales
            .render("menu.seed.value", &params, false)
            .unwrap()
            .contains("{!4294967295}")
    );
    let external = "{{seed}}{Rname} DoomRL 日本語";
    let params = BTreeMap::from([("mods".into(), Parameter::String(external.into()))]);
    assert_eq!(
        locales
            .render("menu.save.mods.current", &params, true)
            .unwrap(),
        format!("Current IDs   : {{!{external}}}")
    );
}
#[test]
fn unknown_ids_types_and_extra_parameters_fail_without_english_fallback() {
    let locales = Locales::compiled().unwrap();
    assert_eq!(
        locales.render("game.unknown", &BTreeMap::new(), false),
        Err(Error::MissingId)
    );
    assert_eq!(
        locales.render("menu.seed.value", &BTreeMap::new(), false),
        Err(Error::Parameters)
    );
    let params = BTreeMap::from([("seed".into(), Parameter::String("1".into()))]);
    assert_eq!(
        locales.render("menu.seed.value", &params, false),
        Err(Error::Parameters)
    );
    let params = BTreeMap::from([("seed".into(), Parameter::Integer(i64::MIN))]);
    assert_eq!(
        locales.render("menu.seed.value", &params, true).unwrap(),
        format!("Seed: {{!{}}}", i64::MIN)
    );
}

#[test]
fn semantic_wire_rejects_duplicate_names_extra_fields_and_noncanonical_int64() {
    #[derive(serde::Deserialize)]
    struct Request {
        #[serde(deserialize_with = "deserialize_parameters")]
        parameters: BTreeMap<String, WireParameter>,
    }
    let good: Request = serde_json::from_str(
        r#"{"parameters":{"number":{"kind":"integer","value":"-9223372036854775808"}}}"#,
    )
    .unwrap();
    assert_eq!(good.parameters.len(), 1);
    for value in [
        r#"{"parameters":{"x":{"kind":"string","value":"a"},"x":{"kind":"string","value":"b"}}}"#,
        r#"{"parameters":{"x":{"kind":"string","value":"a","extra":1}}}"#,
        r#"{"parameters":{"x":{"kind":"integer","value":17}}}"#,
    ] {
        assert!(serde_json::from_str::<Request>(value).is_err());
    }
    for text in ["+1", "01", "-0", "9223372036854775808", ""] {
        assert_eq!(canonical_integer(text), Err(Error::Parameters));
    }
    assert_eq!(canonical_integer("-9223372036854775808"), Ok(i64::MIN));
}

#[test]
fn native_display_does_not_return_embedded_nul_or_exceed_pascal_capacity() {
    let locales = Locales::compiled().unwrap();
    let parameters = BTreeMap::from([("mods".into(), Parameter::String("x\0y".into()))]);
    assert_eq!(
        locales.render("menu.save.mods.current", &parameters, false),
        Err(Error::Parameters)
    );
    let parameters = BTreeMap::from([("mods".into(), Parameter::String("x".repeat(32_768)))]);
    assert_eq!(
        locales.render("menu.save.mods.current", &parameters, false),
        Err(Error::TooLarge)
    );
}
