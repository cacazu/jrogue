//! Production adapter for pinned lexical naming identities and reviewed roles.
//! Binding indices are provenance; rendering receives selected semantic IDs.

use super::*;
use crate::localization::json::{self,JsonValue as J,Limits};
use std::collections::{BTreeMap,BTreeSet};

const SOURCE_COMMIT:&str="f3082213b73f3e463e3d0d60bff4b00462beae6e";
const CATALOG_LIMITS:Limits=Limits {max_bytes:8*1024*1024,max_depth:24,max_nodes:150_000,max_string_bytes:MAX_LEXEME_BYTES};
#[derive(Clone,Debug)]
struct Rule {en:String,ja:String}
#[derive(Clone,Debug)]
pub struct ReviewedNamingCatalog {
    en:BTreeMap<String,String>,ja:BTreeMap<String,String>,rules:BTreeMap<String,Rule>,
    counters:BTreeMap<String,String>,flavor_modifiers:BTreeMap<String,String>,ego_modifiers:BTreeMap<String,String>,
    book_titles:BTreeSet<String>,artifacts:BTreeMap<String,ArtifactAttachment>,
    possessives:BTreeMap<String,String>,plurals:BTreeMap<String,Option<String>>,
    monster_counters:BTreeMap<String,String>,
}
impl ReviewedNamingCatalog {
    pub fn embedded()->Result<Self,NamingError> {
        Self::from_json(include_str!("../../../migration/naming-data/en.json"),
            include_str!("../../../migration/naming-data/ja.json"),
            include_str!("../../../migration/naming-data/grammar.json"),
            include_str!("../../../migration/naming-data/source-bindings.json"))
    }
    /// All JSON is checked before the adapter is made available. EN/JA have
    /// identical IDs. Naming grammar's declared slots are a locale union: each
    /// rendered locale must use a valid subset, for example Japanese counters.
    pub fn from_json(en:&str,ja:&str,grammar:&str,bindings:&str)->Result<Self,NamingError> {
        let en=flat(en)?;let ja=flat(ja)?;
        if !en.keys().eq(ja.keys()) { return Err(NamingError::InvalidCapture("naming EN/JA identity parity")); }
        let mut out=Self {en,ja,rules:BTreeMap::new(),counters:BTreeMap::new(),flavor_modifiers:BTreeMap::new(),ego_modifiers:BTreeMap::new(),book_titles:BTreeSet::new(),
            artifacts:BTreeMap::new(),possessives:BTreeMap::new(),plurals:BTreeMap::new(),monster_counters:BTreeMap::new()};
        let g=parse(grammar)?;
        if int(&g,"schema_version")?!=1 { return Err(NamingError::InvalidCapture("naming grammar schema")); }
        for r in rows(&g,"rules")? {
            let id=text(r,"id")?.to_owned();let rendered=field(r,"render")?;
            let en=text(rendered,"en")?.to_owned();let ja=text(rendered,"ja")?.to_owned();
            let parameters=field(r,"parameters")?.as_object().ok_or(NamingError::InvalidCapture("grammar parameters"))?;
            if parameters.iter().any(|(_,kind)| !matches!(kind.as_str(),Some("integer"|"signed_integer"|"localized_text"|"display_token"|"inscription"))) {
                return Err(NamingError::InvalidCapture("grammar parameter kind"));
            }
            for template in [&en,&ja] {
                if !parameters.is_empty() {
                    let schema:Vec<_>=parameters.iter().filter(|(name,_)|template.contains(&format!("{{{name}}}")))
                        .map(|(name,_)|ParameterSpec {name,kind:ParameterKind::Text}).collect();
                    CompiledTemplate::compile(template,&schema).map_err(|e|NamingError::InvalidTemplate(e.to_string()))?;
                }
            }
            if out.rules.insert(id.clone(),Rule {en,ja}).is_some() { return Err(NamingError::InvalidCapture("duplicate grammar identity")); }
            if let Some(c)=r.field("counter_id") { out.counters.insert(id,c.as_str().ok_or(NamingError::InvalidCapture("counter identity"))?.to_owned()); }
        }
        let b=parse(bindings)?;
        if int(&b,"schema_version")?!=1 || text(&b,"upstream_commit")?!=SOURCE_COMMIT { return Err(NamingError::InvalidCapture("naming source/version mismatch")); }
        // Shared effect words may have category-dependent counters. Keep only
        // unambiguous lexical policies; actual generic base roles carry theirs.
        let mut ambiguous=BTreeSet::new();
        for group in ["object_kinds","object_bases"] { for r in rows(&b,group)? {
            // The pinned gold base has no native name: object_base_name leaves
            // its caller buffer untouched. It is not a fabricated lexical ID.
            let Some(id)=r.field("name_id").and_then(J::as_str) else {continue};
            let counter=text(r,"counter_id")?;
            if let Some(previous)=out.counters.get(id) { if previous!=counter { ambiguous.insert(id.to_owned()); } }
            else {out.counters.insert(id.to_owned(),counter.to_owned());}
            if group=="object_kinds" && r.field("tval_key").and_then(J::as_str).is_some_and(|k|k.ends_with("book")) {out.book_titles.insert(id.to_owned());}
        } }
        for id in ambiguous {out.counters.remove(&id);}
        for group in ["flavors","egos"] {for r in rows(&b,group)? {
            if let (Some(id),Some(modifier))=(r.field("name_id").and_then(J::as_str),r.field("modifier_id").and_then(J::as_str)) {
                let target=if group=="flavors" {&mut out.flavor_modifiers}else{&mut out.ego_modifiers};
                if let Some(old)=target.insert(id.to_owned(),modifier.to_owned()) {if old!=modifier {return Err(NamingError::InvalidCapture("ambiguous modifier policy"));}}
                // C may emit the already selected attributive endpoint instead
                // of the noun endpoint; both retain the reviewed role purpose.
                target.insert(modifier.to_owned(),modifier.to_owned());
            }
        }}
        for r in rows(&b,"artifacts")? {
            let attachment=match text(r,"attachment")? {"of"=>ArtifactAttachment::Of,"quoted"=>ArtifactAttachment::Quoted,"literal"|"after"=>ArtifactAttachment::After,
                _=>return Err(NamingError::InvalidCapture("artifact attachment policy"))};
            let id=text(r,"name_id")?.to_owned();
            if let Some(old)=out.artifacts.insert(id,attachment) {if old!=attachment {return Err(NamingError::InvalidCapture("ambiguous artifact attachment"));}}
        }
        for r in rows(&b,"monster_races")? {
            let Some(id)=r.field("name_id").and_then(J::as_str) else {continue};
            let possessive=text(r,"possessive_name_id")?;
            out.possessives.insert(id.to_owned(),possessive.to_owned());
            out.possessives.insert(possessive.to_owned(),possessive.to_owned());
            let plural=r.field("plural_id").and_then(J::as_str).map(str::to_owned);
            out.plurals.insert(id.to_owned(),plural.clone());
            let counter=text(r,"counter_id")?.to_owned();
            out.monster_counters.insert(id.to_owned(),counter.clone());
            out.monster_counters.insert(possessive.to_owned(),counter.clone());
            out.plurals.entry(possessive.to_owned()).or_insert(None);
            if let Some(plural)=plural {out.monster_counters.insert(plural,counter);}
        }
        out.validate_identities()?;Ok(out)
    }
    fn validate_identities(&self)->Result<(),NamingError> {
        for id in self.counters.values().chain(self.flavor_modifiers.values()).chain(self.ego_modifiers.values()).chain(self.possessives.values()).chain(self.monster_counters.values()).chain(self.plurals.values().filter_map(Option::as_ref)) {
            if !self.en.contains_key(id) {return Err(NamingError::MissingIdentity(id.clone()));}
        }
        for id in self.rules.keys() {if !self.en.contains_key(id) {return Err(NamingError::MissingIdentity(id.clone()));}}
        Ok(())
    }
    #[must_use]
    pub fn len(&self)->usize {self.en.len()}
    #[must_use]
    pub fn is_empty(&self)->bool {self.en.is_empty()}
    pub fn ids(&self)->impl Iterator<Item=&str> {self.en.keys().map(String::as_str)}
}
impl NamingCatalog for ReviewedNamingCatalog {
    fn text(&self,id:&str,locale:Locale)->Result<&str,NamingError> {
        (if locale==Locale::English {&self.en}else{&self.ja}).get(id).map(String::as_str).ok_or_else(||NamingError::MissingIdentity(id.to_owned()))
    }
    fn grammar(&self,role:GrammarRole,locale:Locale)->Result<&str,NamingError> {
        self.rules.get(&role.id()).map(|r|if locale==Locale::English {r.en.as_str()}else{r.ja.as_str()}).ok_or_else(||NamingError::MissingPolicy(role.id()))
    }
    fn japanese_counter(&self,base_id:&str)->Result<&str,NamingError> {
        self.text(self.counters.get(base_id).ok_or_else(||NamingError::MissingPolicy(format!("counter:{base_id}")))?,Locale::Japanese)
    }
    fn japanese_modifier(&self,id:&str,purpose:ModifierPurpose)->Result<&str,NamingError> {
        let modifiers=match purpose {ModifierPurpose::Flavor=>&self.flavor_modifiers,ModifierPurpose::Ego=>&self.ego_modifiers};
        if let Some(modifier)=modifiers.get(id) {self.text(modifier,Locale::Japanese)}
        else if purpose==ModifierPurpose::Flavor && self.book_titles.contains(id) {self.text(id,Locale::Japanese)}
        else {Err(NamingError::MissingPolicy(format!("modifier:{id}")))}
    }
    fn artifact_attachment(&self,id:&str)->Result<ArtifactAttachment,NamingError> {
        self.artifacts.get(id).copied().ok_or_else(||NamingError::MissingPolicy(format!("artifact:{id}")))
    }
    fn monster_possessive_name(&self,id:&str,locale:Locale)->Result<&str,NamingError> {
        self.text(self.possessives.get(id).ok_or_else(||NamingError::MissingPolicy(format!("possessive:{id}")))?,locale)
    }
    fn monster_plural(&self,id:&str,locale:Locale)->Result<Option<&str>,NamingError> {
        self.plurals.get(id).ok_or_else(||NamingError::MissingPolicy(format!("plural:{id}")))?.as_ref().map(|id|self.text(id,locale)).transpose()
    }
    fn monster_counter(&self,id:&str)->Result<&str,NamingError> {
        self.text(self.monster_counters.get(id).ok_or_else(||NamingError::MissingPolicy(format!("monster counter:{id}")))?,Locale::Japanese)
    }
}
fn parse(input:&str)->Result<J,NamingError> {json::parse(input,CATALOG_LIMITS).map_err(|e|NamingError::InvalidJson(e.to_string()))}
fn flat(input:&str)->Result<BTreeMap<String,String>,NamingError> {
    let j=parse(input)?;let object=j.as_object().ok_or(NamingError::InvalidCapture("flat naming catalog"))?;
    object.iter().map(|(id,v)|Ok((id.clone(),checked_text(v.as_str().ok_or(NamingError::InvalidCapture("lexeme string"))?)?.to_owned()))).collect()
}
fn field<'a>(v:&'a J,key:&str)->Result<&'a J,NamingError> {v.field(key).ok_or(NamingError::InvalidCapture("catalog field missing"))}
fn text<'a>(v:&'a J,key:&str)->Result<&'a str,NamingError> {field(v,key)?.as_str().ok_or(NamingError::InvalidCapture("catalog string"))}
fn int(v:&J,key:&str)->Result<i64,NamingError> {field(v,key)?.as_integer().ok_or(NamingError::InvalidCapture("catalog integer"))}
fn rows<'a>(v:&'a J,key:&str)->Result<&'a [J],NamingError> {field(v,key)?.as_array().ok_or(NamingError::InvalidCapture("catalog record array"))}
