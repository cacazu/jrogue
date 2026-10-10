//! Source-prepared tests. Run only after the parent's compiler/resource gate.
//! Synthetic events test formatter contracts; they do not prove native capture.

use std::collections::BTreeMap;

use nethack_layers::domain::{
    GameplayContext, GameplayEvent, HelperVariant, TextArgument, TextEvent, TextId,
};
use nethack_layers::presentation::{Catalog, FormatError, Locale};

const NEW_NATIVE_APIS: [&str; 6] = [
    "panic",
    "panic1",
    "config_error_add",
    "livelog_printf",
    "dump_forward_putstr",
    "exit_nhwindows",
];

fn id(value: &str) -> TextId {
    TextId::try_from(value.to_owned()).expect("source semantic ID")
}

fn context(api: &str, helper_variant: HelperVariant) -> GameplayContext {
    GameplayContext {
        api: api.to_owned(),
        helper_variant,
        location_prefix: None,
        quest: None,
    }
}

fn event(key: &str, args: impl IntoIterator<Item = (&'static str, TextArgument)>) -> TextEvent {
    TextEvent {
        id: id(key),
        args: args
            .into_iter()
            .map(|(key, value)| (key.to_owned(), value))
            .collect(),
    }
}

fn text(value: &str) -> TextArgument {
    TextArgument::Text(value.to_owned())
}

fn object_catalog() -> Catalog {
    Catalog::from_json(include_bytes!("../fixtures/object.json")).expect("object source projection")
}

#[test]
fn native_plain_apis_need_no_new_enum_or_abi() {
    let original = id("test.native.message");
    for api in NEW_NATIVE_APIS {
        assert_eq!(
            context(api, HelperVariant::Plain).text_id(&original),
            Ok(original.clone())
        );
    }
}

#[test]
fn new_native_apis_cannot_impersonate_helper_variants() {
    let original = id("test.native.message");
    for api in NEW_NATIVE_APIS {
        for variant in [
            HelperVariant::Dream,
            HelperVariant::Underwater,
            HelperVariant::Blind,
            HelperVariant::Quoted,
        ] {
            assert!(context(api, variant).text_id(&original).is_err());
        }
    }
    assert!(
        context("You_hear", HelperVariant::Underwater)
            .text_id(&original)
            .is_ok()
    );
    assert!(
        context("You_see", HelperVariant::Blind)
            .text_id(&original)
            .is_ok()
    );
    assert_eq!(
        context("verbalize", HelperVariant::Quoted).text_id(&original),
        Ok(original)
    );
}

#[test]
fn malformed_api_or_window_metadata_cannot_cross_the_rust_context_boundary() {
    let original = id("test.native.message");
    for api in ["", "panic-1", "panic\0", "panic raw", "エラー", "0panic"] {
        assert!(
            context(api, HelperVariant::Plain)
                .text_id(&original)
                .is_err()
        );
    }
    assert!(
        context(&"p".repeat(65), HelperVariant::Plain)
            .text_id(&original)
            .is_err()
    );
    let old: GameplayEvent =
        serde_json::from_str(r#"{"event":{"id":"test.native.message"},"context":{"api":"panic"}}"#)
            .expect("default plain remains compatible");
    assert_eq!(old.context.helper_variant, HelperVariant::Plain);
    assert!(
        serde_json::from_str::<GameplayEvent>(
            r#"{"event":{"id":"test.native.message"},"context":{"api":"panic","window":-1}}"#
        )
        .is_err()
    );
}

#[test]
fn source_review_metadata_is_not_a_runtime_catalog() {
    assert!(matches!(
        Catalog::from_json(include_bytes!("../fixtures/monster-source-metadata.json")),
        Err(FormatError::InvalidJson)
    ));
    Catalog::from_json(include_bytes!("../fixtures/monster.json"))
        .expect("explicit projection accepted");
    Catalog::from_json(include_bytes!("../fixtures/helper.json"))
        .expect("enabled reviewed leaf projection accepted");
}

#[test]
fn all_frozen_projected_recipes_fit_the_actual_catalog_parser() {
    let catalog = Catalog::from_json(include_bytes!("../fixtures/combined.json"))
        .expect("combined source-only fixture");
    assert!(catalog.en.len() > 3_800);
    assert_eq!(
        catalog.argument_schemas[&id("nethack.name.object.public.sequence_25")].len(),
        26
    );
}

#[test]
fn maximum_object_sequence_is_flat_and_preserves_the_full_native_union() {
    let mut catalog = object_catalog();
    let leaf = id("test.public.part");
    catalog.en.insert(leaf.clone(), "piece".to_owned());
    catalog.ja.insert(leaf.clone(), "断片".to_owned());
    let mut args = BTreeMap::from([("original".to_owned(), text("exact original whole English"))]);
    for index in 1..=25 {
        args.insert(
            format!("part_{index}"),
            TextArgument::Event(Box::new(TextEvent {
                id: leaf.clone(),
                args: BTreeMap::new(),
            })),
        );
    }
    let mut root = TextEvent {
        id: id("nethack.name.object.public.sequence_25"),
        args,
    };
    assert_eq!(root.validate_tree(), Ok(()));
    assert_eq!(
        catalog.render(&root, Locale::En).expect("EN").text,
        "exact original whole English"
    );
    let japanese = catalog.render(&root, Locale::Ja).expect("JA");
    assert_eq!(japanese.text, "断片".repeat(25));
    assert!(!japanese.used_fallback);
    root.args.remove("original");
    assert_eq!(
        catalog
            .render(&root, Locale::Ja)
            .expect_err("union missing original"),
        FormatError::ArgumentSchema
    );
}

#[test]
fn object_numeric_payloads_keep_source_printf_types_and_values() {
    let catalog = object_catalog();
    let quantity = event(
        "nethack.name.object.public.quantity",
        [
            ("original", text("27 ")),
            ("value", TextArgument::Integer(27)),
        ],
    );
    assert_eq!(
        catalog
            .render(&quantity, Locale::Ja)
            .expect("quantity")
            .text,
        "27 "
    );
    let enchantment = event(
        "nethack.name.object.public.enchantment",
        [
            ("original", text("+3 ")),
            ("value", TextArgument::Integer(3)),
        ],
    );
    assert_eq!(
        catalog
            .render(&enchantment, Locale::Ja)
            .expect("enchantment")
            .text,
        "+3 "
    );
    let charges = event(
        "nethack.name.object.public.charges",
        [
            ("original", text(" (2:9)")),
            ("recharged", TextArgument::Integer(2)),
            ("charges", TextArgument::Integer(9)),
        ],
    );
    assert_eq!(
        catalog.render(&charges, Locale::Ja).expect("charges").text,
        "（2:9）"
    );
    let invalid = event(
        "nethack.name.object.public.quantity",
        [("original", text("27 ")), ("value", text("27"))],
    );
    assert_eq!(
        catalog
            .render(&invalid, Locale::En)
            .expect_err("JA-only numeric argument still typed"),
        FormatError::ArgumentType
    );
}

#[test]
fn omitted_english_plural_still_requires_the_exact_source_union() {
    let catalog = object_catalog();
    let mut count = event(
        "nethack.name.object.public.content_count",
        [
            ("original", text(" (3 items)")),
            ("count", TextArgument::Integer(3)),
            ("english_plural", text("s")),
        ],
    );
    assert_eq!(
        catalog.render(&count, Locale::Ja).expect("count").text,
        "（中身 3 点）"
    );
    count.args.remove("english_plural");
    assert_eq!(
        catalog
            .render(&count, Locale::Ja)
            .expect_err("unobserved source union"),
        FormatError::ArgumentSchema
    );
}

#[test]
fn nested_raw_public_names_propagate_explicit_fallback_without_interpreting_text() {
    let mut catalog =
        Catalog::from_json(include_bytes!("../fixtures/monster.json")).expect("monster");
    catalog
        .en
        .insert(id("test.raw.public"), "{original}".to_owned());
    let raw = event(
        "test.raw.public",
        [("original", text("player {arg_1:%s} 100% 🐈"))],
    );
    let called = event(
        "nethack.name.monster.phase6.called",
        [
            ("original", text("whole native English")),
            ("name", TextArgument::Event(Box::new(raw))),
            ("kind", text("猫")),
        ],
    );
    let rendered = catalog
        .render(&called, Locale::Ja)
        .expect("nested public name");
    assert_eq!(rendered.text, "player {arg_1:%s} 100% 🐈という猫");
    assert!(rendered.used_fallback);
}

#[test]
fn native_untranslated_recipe_keeps_exact_english_and_reports_fallback() {
    let catalog = Catalog::from_json(include_bytes!("../fixtures/native.json"))
        .expect("native source-only catalog");
    let envelope = GameplayEvent {
        event: event(
            "nethack.native.config.line",
            [("number", TextArgument::Integer(31))],
        ),
        context: context("config_error_add", HelperVariant::Plain),
    };
    let rendered = catalog
        .render_gameplay(&envelope, Locale::Ja)
        .expect("explicit English fallback");
    assert_eq!(rendered.text, "Line 31: ");
    assert!(rendered.used_fallback);
}
