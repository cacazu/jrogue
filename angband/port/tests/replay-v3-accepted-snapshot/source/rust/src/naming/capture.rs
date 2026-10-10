//! Strict owned wire decoding. Unknown fields are rejected, including live
//! pointers, hidden entity IDs, and completed-English descriptor strings.

use super::*;
use crate::localization::json::{self, JsonValue as J, Limits};

pub fn parse_object_capture(input: &str) -> Result<ObjectCapture, NamingError> {
    object_from_value(&parse(input)?)
}
pub fn parse_monster_capture(input: &str) -> Result<MonsterCapture, NamingError> {
    monster_from_value(&parse(input)?)
}
fn parse(input: &str) -> Result<J, NamingError> {
    json::parse(input, Limits { max_bytes: MAX_CAPTURE_BYTES, max_depth: 12,
        max_nodes: 2048, max_string_bytes: MAX_LEXEME_BYTES })
        .map_err(|e| NamingError::InvalidJson(e.to_string()))
}
fn fields<'a>(v: &'a J, allowed: &[&str]) -> Result<&'a [(String, J)], NamingError> {
    let values = v.as_object().ok_or(NamingError::InvalidCapture("expected object"))?;
    if values.iter().any(|(k,_)| !allowed.contains(&k.as_str())) {
        return Err(NamingError::InvalidCapture("unknown field"));
    }
    Ok(values)
}
fn value<'a>(v: &'a J, key: &str) -> Result<&'a J, NamingError> {
    v.field(key).ok_or(NamingError::InvalidCapture("missing field"))
}
fn string<'a>(v: &'a J, key: &str) -> Result<&'a str, NamingError> {
    checked_text(value(v, key)?.as_str().ok_or(NamingError::InvalidCapture("expected string"))?)
}
fn boolean(v: &J, key: &str) -> Result<bool, NamingError> {
    value(v, key)?.as_bool().ok_or(NamingError::InvalidCapture("expected boolean"))
}
fn integer(v: &J, key: &str) -> Result<i64, NamingError> {
    value(v, key)?.as_integer().ok_or(NamingError::InvalidCapture("expected integer"))
}
fn u32_field(v: &J, key: &str) -> Result<u32, NamingError> {
    u32::try_from(integer(v, key)?).map_err(|_| NamingError::InvalidCapture("u32 range"))
}
fn i32_field(v: &J, key: &str) -> Result<i32, NamingError> {
    i32::try_from(integer(v, key)?).map_err(|_| NamingError::InvalidCapture("i32 range"))
}
fn identity(v: &J, key: &str) -> Result<String, NamingError> {
    let id = string(v, key)?;
    if id.len() > 255 || !id.starts_with("angband.naming.") ||
        !id.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-')) {
        return Err(NamingError::InvalidCapture("catalog identity"));
    }
    Ok(id.to_owned())
}
fn array<'a>(v: &'a J, key: &str, maximum: usize) -> Result<&'a [J], NamingError> {
    let values = value(v, key)?.as_array().ok_or(NamingError::InvalidCapture("expected array"))?;
    if values.len() > maximum { return Err(NamingError::InvalidCapture("array count")); }
    Ok(values)
}
fn header(v: &J, monster: bool) -> Result<(u32,u32), NamingError> {
    let allowed: &[&str] = if monster { &["schema_version", "complete", "mode", "native_max_bytes", "capital", "parts", "reason"] }
        else { &["schema_version", "complete", "mode", "native_max_bytes", "parts", "reason"] };
    fields(v, allowed)?;
    if u32_field(v, "schema_version")? != CAPTURE_SCHEMA_VERSION { return Err(NamingError::InvalidCapture("schema version")); }
    if !boolean(v, "complete")? {
        fields(v,&["schema_version","complete","reason"])?;
        return Err(NamingError::IncompleteCapture(string(v, "reason")?.to_owned()));
    }
    if v.field("reason").is_some() { return Err(NamingError::InvalidCapture("complete capture has failure reason")); }
    Ok((u32_field(v,"mode")?, u32_field(v,"native_max_bytes")?))
}
fn prefix(form: &str) -> Result<PrefixForm, NamingError> {
    Ok(match form {
        "none" => PrefixForm::None, "no_more" => PrefixForm::NoMore,
        "quantity" => PrefixForm::Quantity, "the" => PrefixForm::The,
        "a" => PrefixForm::A, "an" => PrefixForm::An,
        _ => return Err(NamingError::InvalidCapture("prefix form")),
    })
}
fn reference(v: &J) -> Result<NameReference, NamingError> {
    fields(v, &["name_id", "origin", "text", "display_name", "attachment"])?;
    if v.field("name_id").is_some() {
        if v.field("origin").is_some() || v.field("text").is_some() || v.field("display_name").is_some() || v.field("attachment").is_some() { return Err(NamingError::InvalidCapture("catalog/opaque reference conflict")); }
        return Ok(NameReference::Catalog(identity(v,"name_id")?));
    }
    let text = string(v,"text")?.to_owned();
    Ok(match string(v,"origin")? {
        "generated_scroll_title" => { if v.field("display_name").is_some() || v.field("attachment").is_some() { return Err(NamingError::InvalidCapture("scroll-title fields")); } NameReference::GeneratedScrollTitle(text) },
        "generated_randart_name" => NameReference::GeneratedRandartName { raw:text,display_name:string(v,"display_name")?.to_owned(),attachment:match string(v,"attachment")? {
            "of"=>ArtifactAttachment::Of,"quoted"=>ArtifactAttachment::Quoted,"after"|"literal"=>ArtifactAttachment::After,_=>return Err(NamingError::InvalidCapture("generated artifact attachment")),
        } },
        _ => return Err(NamingError::InvalidCapture("unreviewed generated name origin")),
    })
}
fn suffix_reference(v: &J) -> Result<NameReference, NamingError> {
    // The suffix identity lives directly in its selected-part object.
    let values: Vec<_> = v.as_object().ok_or(NamingError::InvalidCapture("suffix object"))?.iter()
        .filter(|(k,_)| matches!(k.as_str(), "name_id" | "origin" | "text" | "display_name" | "attachment")).cloned().collect();
    reference(&J::Object(values))
}

pub(crate) fn object_from_value(v: &J) -> Result<ObjectCapture, NamingError> {
    let (mode,native_max_bytes) = header(v,false)?;
    let mut parts = Vec::new();
    for part in array(v,"parts",MAX_PARTS)? {
        let kind = string(part,"kind")?;
        parts.push(match kind {
            "literal" => { fields(part,&["kind","name_id","origin","text"])?;
                // The native NULL-object custom-message branch shares this
                // one reviewed identity with the domain catalog. Accept it
                // only as the original sole literal shape, never as a kind,
                // modifier, monster identity or arbitrary domain fallback.
                let name = if part.field("name_id").and_then(J::as_str) == Some("domain.custom_message.hands") {
                    if mode != 0 || native_max_bytes != 1024 || part.field("origin").is_some() || part.field("text").is_some() {
                        return Err(NamingError::InvalidCapture("null-object hands shape"));
                    }
                    NameReference::Catalog("domain.custom_message.hands".to_owned())
                } else { suffix_reference(part)? };
                if matches!(name,NameReference::GeneratedRandartName {..}) {return Err(NamingError::InvalidCapture("literal generated origin"));}
                ObjectPart::Literal {name}
            }
            "money" => { fields(part,&["kind","amount","name_id","ignore"])?; ObjectPart::Money {
                amount:i32_field(part,"amount")?,name_id:identity(part,"name_id")?,ignore:boolean(part,"ignore")?,
            } }
            "prefix" => { fields(part,&["kind","form","number"])?; ObjectPart::Prefix {
                form:prefix(string(part,"form")?)?,number:if part.field("number").is_some() {
                    u16::try_from(integer(part,"number")?).map_err(|_| NamingError::InvalidCapture("quantity range"))?
                } else { match prefix(string(part,"form")?)? { PrefixForm::Quantity=>return Err(NamingError::InvalidCapture("quantity missing")),PrefixForm::NoMore=>0,_=>1 } },
            } }
            "base" => { fields(part,&["kind","name_id","modifier","plural"])?;
                let modifier = part.field("modifier").map(reference).transpose()?;
                if matches!(modifier,Some(NameReference::GeneratedRandartName {..})) { return Err(NamingError::InvalidCapture("base modifier origin")); }
                ObjectPart::Base { name_id:identity(part,"name_id")?, modifier, plural:boolean(part,"plural")? }
            }
            "suffix" => { fields(part,&["kind","form","name_id","origin","text","display_name","attachment"])?; ObjectPart::Suffix {
                form:match string(part,"form")? { "artifact"=>SuffixForm::Artifact,"ego"=>SuffixForm::Ego,"of"=>SuffixForm::Of,"quoted"=>SuffixForm::Quoted,
                    _=>return Err(NamingError::InvalidCapture("suffix form")) }, name:suffix_reference(part)?,
            } }
            "chest" => { fields(part,&["kind","name_id"])?; ObjectPart::Chest { name_id:identity(part,"name_id")? } }
            "fuel" => { fields(part,&["kind","turns"])?; ObjectPart::Fuel { turns:i32_field(part,"turns")? } }
            "dice" => { fields(part,&["kind","dice","sides"])?; ObjectPart::Dice { dice:i32_field(part,"dice")?,sides:i32_field(part,"sides")? } }
            "multiplier" => { fields(part,&["kind","value"])?; ObjectPart::Multiplier { value:i32_field(part,"value")? } }
            "bonuses" => { let form = string(part,"form")?; ObjectPart::Bonuses(match form {
                "hit_damage" => { fields(part,&["kind","form","hit","damage"])?; Bonuses::HitDamage { hit:i32_field(part,"hit")?, damage:i32_field(part,"damage")? } }
                "hit" => { fields(part,&["kind","form","hit"])?; Bonuses::Hit(i32_field(part,"hit")?) }
                "damage" => { fields(part,&["kind","form","damage"])?; Bonuses::Damage(i32_field(part,"damage")?) }
                "standard_hit_penalty" => { fields(part,&["kind","form","value"])?; Bonuses::StandardHitPenalty(i32_field(part,"value")?) }
                _ => return Err(NamingError::InvalidCapture("bonus form")),
            }) }
            "armor" => { let form = string(part,"form")?; ObjectPart::Armor(match form {
                "base_bonus" => { fields(part,&["kind","form","base","bonus"])?; Armor::BaseBonus { base:i32_field(part,"base")?,bonus:i32_field(part,"bonus")? } }
                "bonus" => { fields(part,&["kind","form","bonus"])?; Armor::Bonus(i32_field(part,"bonus")?) }
                "base" => { fields(part,&["kind","form","base"])?; Armor::Base(i32_field(part,"base")?) }
                _ => return Err(NamingError::InvalidCapture("armor form")),
            }) }
            "modifiers" => { fields(part,&["kind","values"])?; ObjectPart::Modifiers(array(part,"values",MAX_MODIFIERS)?.iter()
                .map(|v| v.as_integer().and_then(|n| i32::try_from(n).ok()).ok_or(NamingError::InvalidCapture("modifier i32"))).collect::<Result<_,_>>()?) }
            "charges" => { fields(part,&["kind","value"])?; ObjectPart::Charges { value:i32_field(part,"value")? } }
            "charging" => { fields(part,&["kind","count"])?; ObjectPart::Charging { count:part.field("count").map(|_| i32_field(part,"count")).transpose()? } }
            "inscriptions" => { fields(part,&["kind","entries"])?;
                let entries = array(part,"entries",MAX_INSCRIPTIONS)?.iter().map(|v| {
                    fields(v,&["name_id","origin","text"])?;
                    if v.field("name_id").is_some() {
                        if v.field("origin").is_some() || v.field("text").is_some() { return Err(NamingError::InvalidCapture("inscription reference conflict")); }
                        Ok(Inscription::Catalog(identity(v,"name_id")?))
                    } else {
                        if string(v,"origin")? != "user" { return Err(NamingError::InvalidCapture("inscription origin")); }
                        Ok(Inscription::User(string(v,"text")?.to_owned()))
                    }
                }).collect::<Result<_,_>>()?;
                ObjectPart::Inscriptions(entries)
            }
            "store_annotation" => { fields(part,&["kind","name_id"])?; ObjectPart::StoreAnnotation { name_id:identity(part,"name_id")? } }
            _ => return Err(NamingError::InvalidCapture("unknown object part")),
        });
    }
    let capture=ObjectCapture { mode,native_max_bytes,parts }; capture.validate()?; Ok(capture)
}

pub(crate) fn monster_from_value(v: &J) -> Result<MonsterCapture, NamingError> {
    let (mode,native_max_bytes) = header(v,true)?;
    let capital=boolean(v,"capital")?;
    let mut parts=Vec::new();
    for part in array(v,"parts",7)? {
        parts.push(match string(part,"kind")? {
            "pronoun" => { fields(part,&["kind","code"])?; MonsterPart::Pronoun {
                code:u8::try_from(integer(part,"code")?).map_err(|_| NamingError::InvalidCapture("pronoun code range"))?,
            } }
            "reflexive" => { fields(part,&["kind","gender"])?; MonsterPart::Reflexive { gender:match string(part,"gender")? {
                "neutral"=>Gender::Neutral,"male"=>Gender::Male,"female"=>Gender::Female,_=>return Err(NamingError::InvalidCapture("gender")),
            } } }
            "prefix" => { fields(part,&["kind","form"])?; MonsterPart::Prefix { form:prefix(string(part,"form")?)? } }
            "race" => { fields(part,&["kind","name_id","strip_appositive","plural_form"])?; MonsterPart::Race {
                name_id:identity(part,"name_id")?,strip_appositive:boolean(part,"strip_appositive")?,plural_form:match part.field("plural_form") {
                    None=>MonsterPluralForm::Singular,Some(v)=>match v.as_str() { Some("singular")=>MonsterPluralForm::Singular,Some("explicit")=>MonsterPluralForm::Explicit,Some("regular")=>MonsterPluralForm::Regular,_=>return Err(NamingError::InvalidCapture("plural form")) },
                },
            } }
            "list_prefix" => { fields(part,&["kind","form","number"])?; MonsterPart::ListPrefix { number:match string(part,"form")? {
                "unique"=>{ if part.field("number").is_some() { return Err(NamingError::InvalidCapture("unique list count")); } None },
                "count"=>Some(i32_field(part,"number")?),_=>return Err(NamingError::InvalidCapture("list prefix form")),
            } } }
            "appositive_comma" => { fields(part,&["kind"])?; MonsterPart::AppositiveComma }
            "possessive" => { fields(part,&["kind"])?; MonsterPart::Possessive }
            "offscreen" => { fields(part,&["kind"])?; MonsterPart::Offscreen }
            _ => return Err(NamingError::InvalidCapture("unknown monster part")),
        });
    }
    let capture=MonsterCapture { mode,native_max_bytes,capital,parts }; capture.validate()?; Ok(capture)
}
