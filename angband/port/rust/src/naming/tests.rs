use super::*;
use crate::localization::json::{self,Limits};
use std::collections::BTreeMap;

#[derive(Default)]
struct Fixture { en:BTreeMap<String,String>,ja:BTreeMap<String,String>,rules:BTreeMap<String,(String,String)> }
impl Fixture {
    fn new()->Self {
        let mut out=Self::default();
        let v=json::parse(include_str!("../../../migration/naming-data/grammar.json"),Limits { max_bytes:256*1024,max_depth:16,max_nodes:20_000,max_string_bytes:8192 }).unwrap();
        for rule in v.field("rules").unwrap().as_array().unwrap() {
            let id=rule.field("id").unwrap().as_str().unwrap().to_owned();
            let render=rule.field("render").unwrap();
            out.rules.insert(id.clone(),(render.field("en").unwrap().as_str().unwrap().to_owned(),render.field("ja").unwrap().as_str().unwrap().to_owned()));
            out.en.insert(id.clone(),rule.field("source_english").unwrap().as_str().unwrap().to_owned());
            out.ja.insert(id,render.field("ja").unwrap().as_str().unwrap().to_owned());
        }
        for (id,en,ja) in [
            ("weapon","& Long Sword~","長剣"),("flavored_staff","& # Sta|ff|ves|","{modifier}魔法のスタッフ"),
            ("scroll","& Scroll~ titled #","『{modifier}』と記された巻物"),("book","& Book~ of Magic Spells #","魔法書{modifier}"),
            ("ivory","Ivory","象牙"),("book_title","[Magic for Beginners]","『初歩の魔法』"),
            ("artifact","of Gondolin","ゴンドリン"),("quoted_artifact","'Sting'","つらぬき丸"),
            ("ego","of Slaying","殺戮"),("effect","Healing","治癒"),
            ("rat","rat","ネズミ"),("plural_rats","rats","ネズミ"),
            ("unique","Wormtongue, Agent of Saruman","蛇の舌（サルマンの手先）"),
            ("money","copper","銅貨"),("chest_state","locked","施錠済み"),
        ] { out.en.insert(id.to_owned(),en.to_owned());out.ja.insert(id.to_owned(),ja.to_owned()); }
        out
    }
}
impl NamingCatalog for Fixture {
    fn text(&self,id:&str,l:Locale)->Result<&str,NamingError> { (if l==Locale::English { &self.en } else { &self.ja }).get(id).map(String::as_str).ok_or_else(||NamingError::MissingIdentity(id.to_owned())) }
    fn grammar(&self,role:GrammarRole,l:Locale)->Result<&str,NamingError> { self.rules.get(&role.id()).map(|(en,ja)|if l==Locale::English { en.as_str() } else { ja.as_str() }).ok_or_else(||NamingError::MissingPolicy(role.id())) }
    fn japanese_counter(&self,_:&str)->Result<&str,NamingError> { Ok("本") }
    fn japanese_modifier(&self,id:&str,_:ModifierPurpose)->Result<&str,NamingError> { match id { "ivory"=>Ok("象牙の"),"ego"=>Ok("殺戮の"),_=>self.text(id,Locale::Japanese) } }
    fn artifact_attachment(&self,id:&str)->Result<ArtifactAttachment,NamingError> { Ok(if id=="artifact" { ArtifactAttachment::Of } else { ArtifactAttachment::Quoted }) }
    fn monster_possessive_name(&self,id:&str,l:Locale)->Result<&str,NamingError> { if id=="unique" && l==Locale::Japanese { Ok("蛇の舌") } else { self.text(id,l) } }
    fn monster_plural(&self,id:&str,l:Locale)->Result<Option<&str>,NamingError> { if id=="rat" { Ok(Some(self.text("plural_rats",l)?)) } else { Ok(None) } }
    fn monster_counter(&self,_:&str)->Result<&str,NamingError> { Ok("匹") }
}
fn object(parts:Vec<ObjectPart>)->ObjectCapture { ObjectCapture {mode:0,native_max_bytes:1024,parts} }
fn base(id:&str,plural:bool)->ObjectPart { ObjectPart::Base {name_id:id.to_owned(),modifier:None,plural} }
fn prefix(form:PrefixForm,n:u16)->ObjectPart { ObjectPart::Prefix {form,number:n} }
fn monster(parts:Vec<MonsterPart>)->MonsterCapture { MonsterCapture {mode:0,native_max_bytes:1024,capital:false,parts} }
fn race(id:&str,strip:bool)->MonsterPart { MonsterPart::Race {name_id:id.to_owned(),strip_appositive:strip,plural_form:MonsterPluralForm::Singular} }

#[test]
fn source_pattern_regular_and_special_plurals() {
    for (raw,single,plural) in [("& Cutlass~","Cutlass","Cutlasses"),("& Torch~","Torch","Torches"),("& Box~","Box","Boxes"),("& kni|fe|ves|","knife","knives"),("& Sta|ff|ves|","Staff","Staves")] {
        assert_eq!(format_english_pattern(raw,None,false).unwrap(),single);
        assert_eq!(format_english_pattern(raw,None,true).unwrap(),plural);
    }
}
#[test]
fn pattern_modifier_is_recursive_but_not_replaced_globally() {
    assert_eq!(format_english_pattern("& # Wand~",Some("Ash~"),true).unwrap(),"Ashes Wands");
    assert_eq!(format_english_pattern("& # #",Some("#"),false).unwrap(),"# #");
    assert_eq!(format_english_pattern("& 巻物~",None,false).unwrap(),"巻物");
}
#[test]
fn malformed_pattern_is_explicit() {
    assert!(format_english_pattern("~",None,true).is_err());
    assert!(format_english_pattern("kni|fe|ves",None,true).is_err());
}
#[test]
fn all_source_pronoun_branches_and_capitalization() {
    let c=Fixture::new();
    let source=[ ["it","it","its","itself","something","something","something's","itself"],
        ["he","him","his","himself","someone","someone","someone's","himself"],
        ["she","her","her","herself","someone","someone","someone's","herself"] ];
    for (gender,forms) in source.iter().enumerate() { for (form,wanted) in forms.iter().enumerate() {
        let mut capture=monster(vec![MonsterPart::Pronoun {code:(gender*16+form) as u8}]);
        assert_eq!(format_monster(&capture,&c,Locale::English).unwrap(),*wanted);
        assert!(!format_monster(&capture,&c,Locale::Japanese).unwrap().is_empty());
        capture.capital=true;
        let mut expected=wanted.to_string();expected.replace_range(0..1,&wanted[..1].to_ascii_uppercase());
        assert_eq!(format_monster(&capture,&c,Locale::English).unwrap(),expected);
    } }
}
#[test]
fn reflexive_gender_branches_are_owned_facts() {
    let c=Fixture::new();
    for (gender,word) in [(Gender::Neutral,"itself"),(Gender::Male,"himself"),(Gender::Female,"herself")] {
        assert_eq!(format_monster(&monster(vec![MonsterPart::Reflexive {gender}]),&c,Locale::English).unwrap(),word);
    }
}
#[test]
fn monster_name_appositive_possessive_offscreen_order() {
    let c=Fixture::new();let x=monster(vec![race("unique",true),MonsterPart::AppositiveComma,MonsterPart::Possessive,MonsterPart::Offscreen]);
    assert_eq!(format_monster(&x,&c,Locale::English).unwrap(),"Wormtongue,'s (offscreen)");
    assert_eq!(format_monster(&x,&c,Locale::Japanese).unwrap(),"蛇の舌の（画面外）");
    let x=monster(vec![MonsterPart::Prefix {form:PrefixForm::The},race("rat",false),MonsterPart::Possessive]);
    assert_eq!(format_monster(&x,&c,Locale::English).unwrap(),"the rat's");
    assert_eq!(format_monster(&x,&c,Locale::Japanese).unwrap(),"ネズミの");
}
#[test]
fn hidden_pronoun_cannot_carry_a_race_or_offscreen_part() {
    assert!(monster(vec![MonsterPart::Pronoun {code:0},race("rat",false)]).validate().is_err());
    assert!(monster(vec![MonsterPart::Pronoun {code:0},MonsterPart::Offscreen]).validate().is_err());
    assert!(monster(vec![MonsterPart::Pronoun {code:0x08}]).validate().is_err());
}
#[test]
fn object_flavor_known_effect_and_japanese_order() {
    let c=Fixture::new();let x=object(vec![prefix(PrefixForm::An,1),ObjectPart::Base {name_id:"flavored_staff".into(),modifier:Some(NameReference::Catalog("ivory".into())),plural:false},
        ObjectPart::Suffix {form:SuffixForm::Of,name:NameReference::Catalog("effect".into())},ObjectPart::Charges {value:2}]);
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"an Ivory Staff of Healing (2 charges)");
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"治癒の象牙の魔法のスタッフ（残り2回）");
}
#[test]
fn artifact_ego_and_terse_suffixes_remain_distinct() {
    let c=Fixture::new();
    for (form,id,en,ja) in [(SuffixForm::Artifact,"artifact","Long Sword of Gondolin","ゴンドリンの長剣"),
        (SuffixForm::Artifact,"quoted_artifact","Long Sword 'Sting'","長剣『つらぬき丸』"),
        (SuffixForm::Ego,"ego","Long Sword of Slaying","殺戮の長剣"),
        (SuffixForm::Quoted,"effect","Long Sword 'Healing'","治癒の長剣")] {
        let x=object(vec![base("weapon",false),ObjectPart::Suffix {form,name:NameReference::Catalog(id.into())}]);
        assert_eq!(format_object(&x,&c,Locale::English).unwrap(),en);assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),ja);
    }
}
#[test]
fn alternate_quantity_and_known_plural_are_independent() {
    let c=Fixture::new();let x=object(vec![prefix(PrefixForm::Quantity,7),base("weapon",false),ObjectPart::Dice {dice:2,sides:5}]);
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"7 Long Sword (2d5)");
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"7本の長剣（2d5）");
    let x=object(vec![prefix(PrefixForm::NoMore,0),base("weapon",true)]);
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"no more Long Swords");
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"長剣はもうない");
}
#[test]
fn full_known_combat_modifiers_and_inscription_order() {
    let c=Fixture::new();let x=object(vec![base("weapon",false),ObjectPart::Dice {dice:2,sides:5},ObjectPart::Multiplier {value:4},
        ObjectPart::Bonuses(Bonuses::HitDamage {hit:3,damage:-2}),ObjectPart::Armor(Armor::BaseBonus {base:5,bonus:0}),
        ObjectPart::Modifiers(vec![2,-3]),ObjectPart::Charging {count:Some(4)},ObjectPart::Inscriptions(vec![Inscription::User("user 日本語{keep}~".into()),
            Inscription::Catalog("angband.naming.grammar.object.annotation.cursed".into()),Inscription::Catalog("angband.naming.grammar.object.annotation.unknown".into())])]);
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"Long Sword (2d5) (x4) (+3,-2) [5,+0] <+2, -3> (4 charging) {user 日本語{keep}~, cursed, ??}");
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"長剣（2d5）（x4）（+3,-2）［5,+0］〈+2、-3〉（4本充填中）｛user 日本語{keep}~、呪われている、??｝");
}
#[test]
fn single_bonus_and_armor_forms_preserve_signs() {
    let c=Fixture::new();
    for b in [Bonuses::Hit(-2),Bonuses::Damage(-2),Bonuses::StandardHitPenalty(-2)] {
        assert_eq!(format_object(&object(vec![base("weapon",false),ObjectPart::Bonuses(b)]),&c,Locale::English).unwrap(),"Long Sword (-2)");
    }
    for (a,wanted) in [(Armor::Base(5),"Long Sword [5]"),(Armor::Bonus(0),"Long Sword [+0]")] {
        assert_eq!(format_object(&object(vec![base("weapon",false),ObjectPart::Armor(a)]),&c,Locale::English).unwrap(),wanted);
    }
}
#[test]
fn fuel_chest_single_charge_and_single_recharge() {
    let c=Fixture::new();
    for (part,en) in [(ObjectPart::Fuel {turns:500},"Long Sword (500 turns)"),(ObjectPart::Chest {name_id:"chest_state".into()},"Long Sword (locked)"),
        (ObjectPart::Charges {value:1},"Long Sword (1 charge)"),(ObjectPart::Charging {count:None},"Long Sword (charging)")] {
        assert_eq!(format_object(&object(vec![base("weapon",false),part]),&c,Locale::English).unwrap(),en);
    }
}
#[test]
fn source_capital_flag_is_an_object_noop() {
    let c=Fixture::new();let mut x=object(vec![prefix(PrefixForm::A,1),base("weapon",false)]);x.mode=0x80;
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"a Long Sword");
}
#[test]
fn early_return_money_and_unknown_have_no_extra_systems() {
    let c=Fixture::new();let x=object(vec![ObjectPart::Money {amount:153,name_id:"money".into(),ignore:true}]);
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"153 gold pieces worth of copper {ignore}");
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"153ゴールド相当の銅貨｛無視｝");
    let x=object(vec![ObjectPart::Literal {name:NameReference::Catalog("angband.naming.grammar.object.unknown.prefixed".into())}]);
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"an unknown item");
    assert!(object(vec![x.parts[0].clone(),ObjectPart::Charges {value:3}]).validate().is_err());
}
#[test]
fn generated_scroll_title_and_book_modifier_are_preserved() {
    let c=Fixture::new();let x=object(vec![ObjectPart::Base {name_id:"scroll".into(),modifier:Some(NameReference::GeneratedScrollTitle("\"abra cadabra\"".into())),plural:true}]);
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"Scrolls titled \"abra cadabra\"");
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"『\"abra cadabra\"』と記された巻物");
    let x=object(vec![ObjectPart::Base {name_id:"book".into(),modifier:Some(NameReference::Catalog("book_title".into())),plural:false}]);
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"Book of Magic Spells [Magic for Beginners]");
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"魔法書『初歩の魔法』");
}
#[test]
fn selected_parts_never_recompute_modifiers_or_knowledge() {
    assert!(object(vec![base("weapon",false),ObjectPart::Modifiers(vec![2,2])]).validate().is_err());
    assert!(object(vec![base("weapon",false),ObjectPart::Modifiers(vec![0])]).validate().is_err());
    assert!(object(vec![base("weapon",false),ObjectPart::Charges {value:1},ObjectPart::Charging {count:None}]).validate().is_err());
    assert!(object(vec![ObjectPart::Dice {dice:1,sides:2},base("weapon",false)]).validate().is_err());
}
#[test]
fn native_byte_limit_is_separate_from_japanese_reflow() {
    let c=Fixture::new();let mut x=object(vec![base("weapon",false)]);x.native_max_bytes=5;
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"Long");
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"長剣");
    let mut x=object(vec![ObjectPart::Inscriptions(vec![Inscription::User("日本語".into())])]);
    x.parts.insert(0,base("weapon",false));x.native_max_bytes=14;
    assert_eq!(format_object(&x,&c,Locale::English),Err(NamingError::NativeUtf8Boundary));
}
#[test]
fn pure_rendering_does_not_change_capture_or_depend_on_locale_order() {
    let c=Fixture::new();let x=object(vec![prefix(PrefixForm::Quantity,3),base("weapon",true),ObjectPart::Inscriptions(vec![Inscription::User("Alice☆".into())])]);
    let copy=x.clone();let en=format_object(&x,&c,Locale::English).unwrap();
    let ja=format_object(&x,&c,Locale::Japanese).unwrap();
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),en);assert!(ja.contains("Alice☆"));assert_eq!(x,copy);
}
#[test]
fn monster_list_uses_explicit_or_regular_plural_and_native_count_width() {
    let c=Fixture::new();assert_eq!(format_monster_list(&c,Locale::English,"rat",2,false,1024).unwrap(),"  2 rats");
    assert_eq!(format_monster_list(&c,Locale::Japanese,"rat",2,false,1024).unwrap(),"2匹のネズミ");
    let x=monster(vec![MonsterPart::ListPrefix {number:Some(2)},MonsterPart::Race {name_id:"plural_rats".into(),strip_appositive:false,plural_form:MonsterPluralForm::Explicit}]);
    assert_eq!(format_monster(&x,&c,Locale::English).unwrap(),"  2 rats");
    let x=monster(vec![MonsterPart::ListPrefix {number:None},race("unique",false)]);
    assert_eq!(format_monster(&x,&c,Locale::English).unwrap(),"[U] Wormtongue, Agent of Saruman");
}
#[test]
fn strict_wire_parser_accepts_owned_static_and_opaque_facts() {
    let raw=r#"{"schema_version":2,"complete":true,"mode":64,"native_max_bytes":80,"parts":[{"kind":"prefix","form":"a"},{"kind":"base","name_id":"angband.naming.object.kind.long_sword.name","plural":false},{"kind":"inscriptions","entries":[{"origin":"user","text":"Alice☆{x}"}]}]}"#;
    let x=parse_object_capture(raw).unwrap();assert_eq!(x.parts.len(),3);
    assert_eq!(x.parts[2],ObjectPart::Inscriptions(vec![Inscription::User("Alice☆{x}".into())]));
}
#[test]
fn strict_wire_parser_rejects_hidden_fields_duplicates_and_type_coercions() {
    let raw=r#"{"schema_version":2,"complete":true,"mode":0,"native_max_bytes":80,"capital":false,"parts":[{"kind":"pronoun","code":0,"race_index":51}]}"#;
    assert!(parse_monster_capture(raw).is_err());
    assert!(parse_monster_capture(r#"{"schema_version":2,"schema_version":2}"#).is_err());
    assert!(parse_monster_capture(r#"{"schema_version":2,"complete":true,"mode":0,"native_max_bytes":80,"capital":false,"parts":[{"kind":"pronoun","code":"0"}]}"#).is_err());
}
#[test]
fn failed_capture_and_missing_catalog_never_fallback_to_english() {
    assert_eq!(parse_object_capture(r#"{"schema_version":2,"complete":false,"reason":"CaptureCapacity"}"#),Err(NamingError::IncompleteCapture("CaptureCapacity".into())));
    let c=Fixture::new();assert!(matches!(format_object(&object(vec![base("unknown",false)]),&c,Locale::Japanese),Err(NamingError::MissingIdentity(_))));
}
#[test]
fn parser_bounds_and_invalid_origins_are_explicit() {
    let raw=r#"{"schema_version":2,"complete":true,"mode":0,"native_max_bytes":80,"parts":[{"kind":"base","name_id":"angband.naming.object.kind.long_sword.name","plural":false,"modifier":{"origin":"completed_english","text":"a sword"}}]}"#;
    assert!(parse_object_capture(raw).is_err());
    let too_long=" ".repeat(MAX_CAPTURE_BYTES+1);assert!(matches!(parse_object_capture(&too_long),Err(NamingError::InvalidJson(_))));
    assert!(object(vec![prefix(PrefixForm::Quantity,1),base("weapon",false)]).validate().is_err());
}
#[test]
fn kind_raw_flavor_and_generated_titles_are_literal_lexemes() {
    let c=Fixture::new();let x=object(vec![ObjectPart::Literal {name:NameReference::GeneratedScrollTitle("\"abc 日本語\"".into())}]);
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"\"abc 日本語\"");
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"\"abc 日本語\"");
    let x=object(vec![ObjectPart::Literal {name:NameReference::Catalog("ivory".into())}]);
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"象牙");
}
#[test]
fn generated_artifacts_keep_proper_text_and_selected_attachment() {
    let c=Fixture::new();
    for (raw,bare,attachment,en,ja) in [("of OpaqueName","OpaqueName",ArtifactAttachment::Of,"Long Sword of OpaqueName","OpaqueNameの長剣"),
        ("'OpaqueName'","OpaqueName",ArtifactAttachment::Quoted,"Long Sword 'OpaqueName'","長剣『OpaqueName』")] {
        let x=object(vec![base("weapon",false),ObjectPart::Suffix {form:SuffixForm::Artifact,name:NameReference::GeneratedRandartName {raw:raw.into(),display_name:bare.into(),attachment}}]);
        assert_eq!(format_object(&x,&c,Locale::English).unwrap(),en);assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),ja);
    }
}
#[test]
fn store_annotations_are_not_regular_inscriptions() {
    let c=Fixture::new();let x=object(vec![base("weapon",false),ObjectPart::StoreAnnotation {name_id:"angband.naming.grammar.object.store.unseen".into()}]);
    assert_eq!(format_object(&x,&c,Locale::English).unwrap(),"Long Sword {unseen}");
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"長剣｛未判明｝");
    let mut invalid=x;invalid.parts.push(ObjectPart::Inscriptions(vec![Inscription::User("hi".into())]));assert!(invalid.validate().is_err());
}

const TINY_EN:&str=r#"{"angband.naming.object.kind.item.name":"& Item~","angband.naming.grammar.counter.ko":"","angband.naming.grammar.object.compose.quantity":"{number} {base}"}"#;
const TINY_JA:&str=r#"{"angband.naming.object.kind.item.name":"品物","angband.naming.grammar.counter.ko":"個","angband.naming.grammar.object.compose.quantity":"{number}{counter}の{base}"}"#;
const TINY_GRAMMAR:&str=r#"{"schema_version":1,"rules":[{"id":"angband.naming.grammar.counter.ko","parameters":{},"render":{"en":"","ja":"個"}},{"id":"angband.naming.grammar.object.compose.quantity","parameters":{"number":"integer","counter":"localized_text","base":"localized_text"},"render":{"en":"{number} {base}","ja":"{number}{counter}の{base}"}}]}"#;
const TINY_BINDINGS:&str=r#"{"schema_version":1,"upstream_commit":"f3082213b73f3e463e3d0d60bff4b00462beae6e","object_kinds":[{"name_id":"angband.naming.object.kind.item.name","counter_id":"angband.naming.grammar.counter.ko","tval_key":"food"}],"object_bases":[{"name_id":null,"counter_id":"angband.naming.grammar.counter.ko"}],"flavors":[],"egos":[],"artifacts":[],"monster_races":[]}"#;
#[test]
fn production_catalog_validates_union_slots_and_null_native_base() {
    let c=ReviewedNamingCatalog::from_json(TINY_EN,TINY_JA,TINY_GRAMMAR,TINY_BINDINGS).unwrap();
    assert_eq!(c.len(),3);assert_eq!(c.japanese_counter("angband.naming.object.kind.item.name").unwrap(),"個");
    let x=object(vec![prefix(PrefixForm::Quantity,2),base("angband.naming.object.kind.item.name",true)]);
    assert_eq!(format_object(&x,&c,Locale::Japanese).unwrap(),"2個の品物");
}
#[test]
fn production_catalog_rejects_identity_parity_and_duplicate_keys() {
    assert!(ReviewedNamingCatalog::from_json(TINY_EN,"{}",TINY_GRAMMAR,TINY_BINDINGS).is_err());
    assert!(ReviewedNamingCatalog::from_json(r#"{"x":"a","x":"b"}"#,"{}",TINY_GRAMMAR,TINY_BINDINGS).is_err());
}
#[test]
fn production_catalog_rejects_unreviewed_slots_and_source_versions() {
    let bad_grammar=r#"{"schema_version":1,"rules":[{"id":"angband.naming.grammar.object.compose.quantity","parameters":{"number":"integer"},"render":{"en":"{undeclared}","ja":"{number}"}}]}"#;
    assert!(ReviewedNamingCatalog::from_json(TINY_EN,TINY_JA,bad_grammar,TINY_BINDINGS).is_err());
    let bad_bindings=r#"{"schema_version":1,"upstream_commit":"wrong"}"#;
    assert!(ReviewedNamingCatalog::from_json(TINY_EN,TINY_JA,TINY_GRAMMAR,bad_bindings).is_err());
}
#[test]
fn entire_reviewed_lexical_corpus_and_grammar_constructs() {
    let c=ReviewedNamingCatalog::embedded().unwrap();
    assert!(c.len()>2000);
    for id in c.ids() {
        assert!(c.text(id,Locale::English).is_ok());assert!(c.text(id,Locale::Japanese).is_ok());
        if id.starts_with("angband.naming.object.kind.") || id.starts_with("angband.naming.object.base.") {
            let en=c.text(id,Locale::English).unwrap();
            format_english_pattern(en,None,false).unwrap();format_english_pattern(en,None,true).unwrap();
        }
    }
}
#[test]
fn production_catalog_accepts_selected_modifier_endpoint_and_counter() {
    let c=ReviewedNamingCatalog::embedded().unwrap();
    let raw=r#"{"schema_version":2,"complete":true,"mode":64,"native_max_bytes":80,"parts":[{"kind":"prefix","form":"quantity","number":2},{"kind":"base","name_id":"angband.naming.grammar.object.basename.staff.flavored","plural":true,"modifier":{"name_id":"angband.naming.object.flavor.ivory.modifier"}}]}"#;
    let capture=parse_object_capture(raw).unwrap();
    assert_eq!(format_object(&capture,&c,Locale::English).unwrap(),"2 Ivory Staves");
    let ja=format_object(&capture,&c,Locale::Japanese).unwrap();
    assert!(ja.starts_with("2本の"));assert!(!ja.contains("Ivory"));
}
#[test]
fn production_catalog_selected_stem_never_needs_full_appositive_identity() {
    let c=ReviewedNamingCatalog::embedded().unwrap();
    let raw=r#"{"schema_version":2,"complete":true,"mode":2,"native_max_bytes":80,"capital":false,"parts":[{"kind":"race","name_id":"angband.naming.monster.race.wormtongue.possessive_name","strip_appositive":false},{"kind":"possessive"}]}"#;
    let capture=parse_monster_capture(raw).unwrap();
    assert_eq!(format_monster(&capture,&c,Locale::English).unwrap(),"Wormtongue's");
    assert_eq!(format_monster(&capture,&c,Locale::Japanese).unwrap(),"蛇の舌の");
}
