//! Pure grammar for the already-selected, owned monster reaction subject.
//!
//! C retains queue coalescing, visibility, pain bands, integer damage averaging,
//! spell choice and RNG. This module consumes only facts actually printed by
//! the original subject branch; hidden and omitted subjects contain no race.

use crate::localization::json::{self, JsonValue as J, Limits};
use crate::naming::{GrammarRole, NamingCatalog, NamingError};
use crate::text::Locale;
use crate::text_parameters::{CompiledTemplate, Parameter, ParameterKind,
    ParameterSpec, ParameterValue};
use std::collections::BTreeMap;
use std::fmt;

pub const AGGREGATE_SCHEMA_VERSION:u32=1;
pub const NATIVE_SUBJECT_CAPACITY:usize=60;

#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum AggregatePlural { Singular, Explicit, Regular }
#[derive(Clone,Debug,PartialEq,Eq)]
pub enum AggregateSubject {
    Omitted,
    Hidden { count:i32, offscreen:bool },
    Visible { count:i32, unique:bool, name_id:String, plural_form:AggregatePlural,
        appositive_comma:bool, offscreen:bool },
}
#[derive(Clone,Debug,PartialEq,Eq)]
pub enum CombatError {
    InvalidCapture(&'static str), InvalidJson(String), InvalidCatalog(String),
    Naming(NamingError), Template(String), NativeUtf8Boundary,
}
impl fmt::Display for CombatError {
    fn fmt(&self,f:&mut fmt::Formatter<'_>)->fmt::Result {
        match self {
            Self::InvalidCapture(s)=>write!(f,"invalid combat capture: {s}"),
            Self::InvalidJson(s)=>write!(f,"invalid combat JSON: {s}"),
            Self::InvalidCatalog(s)=>write!(f,"invalid combat catalog: {s}"),
            Self::Naming(e)=>write!(f,"{e}"),Self::Template(s)=>write!(f,"combat template: {s}"),
            Self::NativeUtf8Boundary=>f.write_str("native combat subject truncation splits UTF-8"),
        }
    }
}
impl std::error::Error for CombatError {}
impl From<NamingError> for CombatError { fn from(e:NamingError)->Self{Self::Naming(e)} }

pub trait CombatCatalog {
    fn text(&self,id:&str,locale:Locale)->Result<&str,CombatError>;
}
/// Immutable bilingual declared-field catalog, independent of gameplay state.
pub struct ReviewedCombatCatalog {
    english:BTreeMap<String,String>, japanese:BTreeMap<String,String>,
}
impl ReviewedCombatCatalog {
    pub fn embedded()->Result<Self,CombatError>{
        Self::from_json(include_str!("../../migration/combat-data/en.json"),
            include_str!("../../migration/combat-data/ja.json"))
    }
    pub fn from_json(en:&str,ja:&str)->Result<Self,CombatError>{
        fn dictionary(input:&str)->Result<BTreeMap<String,String>,CombatError>{
            let value=json::parse(input,Limits{max_bytes:2*1024*1024,max_depth:2,
                max_nodes:8192,max_string_bytes:8192}).map_err(|e|CombatError::InvalidJson(e.to_string()))?;
            let rows=value.as_object().ok_or(CombatError::InvalidCatalog("expected dictionary".into()))?;
            rows.iter().map(|(id,value)|{
                if !valid_identity(id,"angband.combat.") { return Err(CombatError::InvalidCatalog(id.clone())); }
                let text=value.as_str().ok_or(CombatError::InvalidCatalog(id.clone()))?;
                if text.contains('\0') {return Err(CombatError::InvalidCatalog(id.clone()));}
                Ok((id.clone(),text.to_owned()))
            }).collect()
        }
        let english=dictionary(en)?;let japanese=dictionary(ja)?;
        if english.keys().ne(japanese.keys()) {return Err(CombatError::InvalidCatalog("EN/JA ID mismatch".into()));}
        Ok(Self{english,japanese})
    }
    #[must_use] pub fn len(&self)->usize{self.english.len()}
    #[must_use] pub fn is_empty(&self)->bool{self.english.is_empty()}
}
impl CombatCatalog for ReviewedCombatCatalog {
    fn text(&self,id:&str,locale:Locale)->Result<&str,CombatError>{
        (match locale {Locale::English=>&self.english,Locale::Japanese=>&self.japanese})
            .get(id).map(String::as_str).ok_or_else(||CombatError::InvalidCatalog(id.to_owned()))
    }
}
fn valid_identity(id:&str,prefix:&str)->bool {
    id.len()<=255 && id.starts_with(prefix) && id.bytes().all(|b|b.is_ascii_alphanumeric()||matches!(b,b'.'|b'_'|b'-'))
}
pub fn parse_aggregate_subject(input:&str)->Result<AggregateSubject,CombatError>{
    let value=json::parse(input,Limits{max_bytes:4096,max_depth:2,max_nodes:32,max_string_bytes:255})
        .map_err(|e|CombatError::InvalidJson(e.to_string()))?;
    aggregate_from_value(&value)
}
pub(crate) fn aggregate_from_value(value:&J)->Result<AggregateSubject,CombatError>{
    fn required<'a>(v:&'a J,k:&str)->Result<&'a J,CombatError>{v.field(k).ok_or(CombatError::InvalidCapture("missing field"))}
    fn text<'a>(v:&'a J,k:&str)->Result<&'a str,CombatError>{required(v,k)?.as_str().ok_or(CombatError::InvalidCapture("expected string"))}
    fn boolean(v:&J,k:&str)->Result<bool,CombatError>{required(v,k)?.as_bool().ok_or(CombatError::InvalidCapture("expected boolean"))}
    let fields=value.as_object().ok_or(CombatError::InvalidCapture("expected object"))?;
    if required(value,"schema_version")?.as_integer()!=Some(i64::from(AGGREGATE_SCHEMA_VERSION)){
        return Err(CombatError::InvalidCapture("schema version"));
    }
    let kind=text(value,"kind")?;
    let allowed:&[&str]=match kind {
        "omitted"=>&["schema_version","kind"],
        "hidden"=>&["schema_version","kind","count","offscreen"],
        "visible"=>&["schema_version","kind","count","unique","name_id","plural_form","appositive_comma","offscreen"],
        _=>return Err(CombatError::InvalidCapture("subject kind")),
    };
    if fields.iter().any(|(k,_)|!allowed.contains(&k.as_str())){return Err(CombatError::InvalidCapture("unknown or undisclosed field"));}
    if kind=="omitted" {return Ok(AggregateSubject::Omitted);}
    let count=i32::try_from(required(value,"count")?.as_integer().ok_or(CombatError::InvalidCapture("expected integer"))?)
        .map_err(|_|CombatError::InvalidCapture("count range"))?;
    if count<=0 {return Err(CombatError::InvalidCapture("nonpositive count"));}
    let offscreen=boolean(value,"offscreen")?;
    if kind=="hidden"{return Ok(AggregateSubject::Hidden{count,offscreen});}
    let name_id=text(value,"name_id")?;
    if !valid_identity(name_id,"angband.naming.monster.race."){return Err(CombatError::InvalidCapture("race lexical identity"));}
    let unique=boolean(value,"unique")?;
    let plural_form=match text(value,"plural_form")? {
        "singular"=>AggregatePlural::Singular,"explicit"=>AggregatePlural::Explicit,"regular"=>AggregatePlural::Regular,
        _=>return Err(CombatError::InvalidCapture("plural form")),
    };
    if (unique||count==1)!=(plural_form==AggregatePlural::Singular){return Err(CombatError::InvalidCapture("selected count/plural branch mismatch"));}
    Ok(AggregateSubject::Visible{count,unique,name_id:name_id.to_owned(),plural_form,
        appositive_comma:boolean(value,"appositive_comma")?,offscreen})
}
fn template(catalog:&impl CombatCatalog,role:&str,locale:Locale,values:&[(&str,&str)]) ->Result<String,CombatError>{
    let id=format!("angband.combat.grammar.{role}");
    let specs:Vec<_>=values.iter().map(|(name,_)|ParameterSpec{name:*name,kind:ParameterKind::Text}).collect();
    let args:Vec<_>=values.iter().map(|(name,value)|Parameter{name:*name,value:ParameterValue::Text(*value)}).collect();
    CompiledTemplate::compile(catalog.text(&id,locale)?,&specs)
        .and_then(|t|t.format(locale,&args)).map_err(|e|CombatError::Template(e.to_string()))
}
fn native_limit(mut output:String)->Result<String,CombatError>{
    if output.len()>=NATIVE_SUBJECT_CAPACITY {
        let limit=NATIVE_SUBJECT_CAPACITY-1;
        if !output.is_char_boundary(limit){return Err(CombatError::NativeUtf8Boundary);}
        output.truncate(limit);
    }
    Ok(output)
}
fn append(output:&mut String,suffix:&str,locale:Locale)->Result<(),CombatError>{
    output.push_str(suffix);
    if locale==Locale::English {*output=native_limit(std::mem::take(output))?;}
    Ok(())
}
/// Reproduces the source's successive 60-byte English writes. Japanese names
/// are reflowed separately and never truncated into a native C output buffer.
pub fn format_aggregate_subject(subject:&AggregateSubject,naming:&impl NamingCatalog,
    combat:&impl CombatCatalog,locale:Locale)->Result<String,CombatError>{
    let (mut result,offscreen)=match subject {
        AggregateSubject::Omitted=>return Ok(String::new()),
        AggregateSubject::Hidden{count,offscreen}=>{
            if *count<=0 {return Err(CombatError::InvalidCapture("nonpositive count"));}
            let text=if *count==1 {template(combat,"subject.hidden.single",locale,&[])?}
                else {template(combat,"subject.hidden.multiple",locale,&[("count",&count.to_string())])?};
            (text,*offscreen)
        }
        AggregateSubject::Visible{count,unique,name_id,plural_form,appositive_comma,offscreen}=>{
            if *count<=0 || (*unique||*count==1)!=(*plural_form==AggregatePlural::Singular){return Err(CombatError::InvalidCapture("selected count/plural branch mismatch"));}
            let name=naming.text(name_id,locale)?;
            let mut text=if *unique{name.to_owned()}
                else if *count==1{template(combat,"subject.visible.single",locale,&[("name",name)])?}
                else {
                    let name=if locale==Locale::English&&*plural_form==AggregatePlural::Explicit {
                        naming.monster_plural(name_id,locale)?.ok_or_else(||CombatError::InvalidCatalog("missing explicit plural".into()))?
                    }else{name};
                    let counter=if locale==Locale::Japanese {naming.monster_counter(name_id)?}else{""};
                    template(combat,"subject.visible.multiple",locale,&[("count",&count.to_string()),("counter",counter),("name",name)])?
                };
            if locale==Locale::English {
                text=native_limit(text)?;
                if *plural_form==AggregatePlural::Regular {
                    let suffix=if text.ends_with('s'){"es"}else{"s"};append(&mut text,suffix,locale)?;
                }
            }
            if *appositive_comma{append(&mut text,naming.grammar(GrammarRole::MonsterComma,locale)?,locale)?;}
            (text,*offscreen)
        }
    };
    if locale==Locale::English{result=native_limit(result)?;}
    if offscreen{append(&mut result,naming.grammar(GrammarRole::MonsterOffscreen,locale)?,locale)?;}
    append(&mut result,combat.text("angband.combat.grammar.subject.separator",locale)?,locale)?;
    Ok(result)
}

#[cfg(test)] mod tests {
    use super::*;
    use crate::naming::ReviewedNamingCatalog;
    fn catalogs()->(ReviewedNamingCatalog,ReviewedCombatCatalog){(ReviewedNamingCatalog::embedded().unwrap(),ReviewedCombatCatalog::embedded().unwrap())}
    #[test] fn complete_declared_catalog_has_bilingual_parity(){let c=ReviewedCombatCatalog::embedded().unwrap();assert_eq!(c.len(),670);}
    #[test] fn hidden_subject_never_accepts_identity_or_unique(){
        for extra in [",\"name_id\":\"angband.naming.monster.race.orc.name\"",",\"unique\":true",",\"race_index\":10"]{
            let json=format!("{{\"schema_version\":1,\"kind\":\"hidden\",\"count\":2,\"offscreen\":false{extra}}}");
            assert!(parse_aggregate_subject(&json).is_err());
        }
    }
    #[test] fn hidden_and_omitted_subjects_preserve_disclosed_count(){
        let (n,c)=catalogs();let s=AggregateSubject::Hidden{count:3,offscreen:true};
        assert_eq!(format_aggregate_subject(&s,&n,&c,Locale::English).unwrap(),"3 monsters (offscreen) ");
        assert_eq!(format_aggregate_subject(&s,&n,&c,Locale::Japanese).unwrap(),"3体のモンスター（画面外）");
        assert_eq!(format_aggregate_subject(&AggregateSubject::Omitted,&n,&c,Locale::Japanese).unwrap(),"");
    }
    #[test] fn hidden_singular_and_rendering_are_immutable(){
        let(n,c)=catalogs();let s=AggregateSubject::Hidden{count:1,offscreen:false};let saved=s.clone();
        assert_eq!(format_aggregate_subject(&s,&n,&c,Locale::English).unwrap(),"It ");
        assert_eq!(format_aggregate_subject(&s,&n,&c,Locale::Japanese).unwrap(),"それ");assert_eq!(s,saved);
    }
    #[test] fn count_and_schema_and_duplicate_fields_reject(){
        for input in [r#"{"schema_version":2,"kind":"omitted"}"#,r#"{"schema_version":1,"kind":"omitted","count":1}"#,
            r#"{"schema_version":1,"kind":"hidden","count":0,"offscreen":false}"#,
            r#"{"schema_version":1,"kind":"hidden","count":2147483648,"offscreen":false}"#,
            r#"{"schema_version":1,"kind":"hidden","count":1,"count":2,"offscreen":false}"#]{assert!(parse_aggregate_subject(input).is_err());}
    }
    #[test] fn incomplete_or_live_subject_shape_fails(){
        assert!(parse_aggregate_subject(r#"{"schema_version":1,"kind":"visible","count":1,"race_pointer":123}"#).is_err());
        assert!(parse_aggregate_subject(r#"{"schema_version":1,"kind":"omitted","english":"Orc"}"#).is_err());
    }
    #[test] fn selected_explicit_plural_and_authored_counter(){
        let(n,c)=catalogs();let s=AggregateSubject::Visible{count:2,unique:false,
            name_id:"angband.naming.monster.race.red_hatted_elf.name".into(),plural_form:AggregatePlural::Explicit,
            appositive_comma:false,offscreen:false};
        assert_eq!(format_aggregate_subject(&s,&n,&c,Locale::English).unwrap(),"2 red-hatted elves ");
        let ja=format_aggregate_subject(&s,&n,&c,Locale::Japanese).unwrap();
        assert!(ja.starts_with("2人の"));assert!(!ja.contains("elf"));
    }
    #[test] fn unique_subject_is_not_a_unique_list_prefix(){
        let(n,c)=catalogs();let s=AggregateSubject::Visible{count:1,unique:true,
            name_id:"angband.naming.monster.race.wormtongue_agent_of_saruman.name".into(),plural_form:AggregatePlural::Singular,
            appositive_comma:true,offscreen:true};
        assert_eq!(format_aggregate_subject(&s,&n,&c,Locale::English).unwrap(),"Wormtongue, Agent of Saruman, (offscreen) ");
        let ja=format_aggregate_subject(&s,&n,&c,Locale::Japanese).unwrap();
        assert!(!ja.contains("[U]"));assert!(!ja.contains('、'));assert!(ja.ends_with("（画面外）"));
    }
    #[test] fn native_limit_uses_bytes_and_never_splits_utf8(){
        assert_eq!(native_limit("x".repeat(70)).unwrap().len(),59);
        assert!(matches!(native_limit(format!("{}あ","x".repeat(58))),Err(CombatError::NativeUtf8Boundary)));
    }
    #[test] fn selected_plural_metadata_is_required_not_recomputed(){
        let json=r#"{"schema_version":1,"kind":"visible","count":2,"unique":false,"name_id":"angband.naming.monster.race.red_hatted_elf.name","plural_form":"singular","appositive_comma":false,"offscreen":false}"#;
        assert!(parse_aggregate_subject(json).is_err());
    }
    #[test] fn catalog_unknown_ids_and_duplicate_or_mismatched_keys_fail(){
        let c=ReviewedCombatCatalog::embedded().unwrap();assert!(c.text("angband.combat.unknown",Locale::Japanese).is_err());
        assert!(ReviewedCombatCatalog::from_json(r#"{"angband.combat.a":"a","angband.combat.a":"b"}"#,"{}").is_err());
        assert!(ReviewedCombatCatalog::from_json(r#"{"angband.combat.a":"a"}"#,"{}").is_err());
    }
    #[test] fn every_reviewed_template_matches_declared_named_parameter_set(){
        let c=ReviewedCombatCatalog::embedded().unwrap();
        let schema=json::parse(include_str!("../../migration/combat-data/schema.json"),Limits{
            max_bytes:2*1024*1024,max_depth:16,max_nodes:40000,max_string_bytes:8192}).unwrap();
        let entries=schema.field("entries").unwrap().as_object().unwrap();assert_eq!(entries.len(),c.len());
        for (id,entry) in entries {
            let params=entry.field("parameters").unwrap().as_array().unwrap();
            let specs:Vec<_>=params.iter().map(|p|ParameterSpec{name:p.field("name").unwrap().as_str().unwrap(),kind:ParameterKind::Text}).collect();
            for locale in [Locale::English,Locale::Japanese]{
                CompiledTemplate::compile(c.text(id,locale).unwrap(),&specs).unwrap();
            }
        }
    }
}
