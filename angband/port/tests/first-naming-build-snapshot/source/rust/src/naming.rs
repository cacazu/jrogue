//! Source-faithful, pure description grammar for owned Angband captures.
//!
//! C chooses each disclosed part inside the original descriptor branches. Rust
//! never rechecks visibility, knowledge, ignore rules, live objects, or RNG.
//! Lexical identities and Japanese grammar come from a reviewed catalog;
//! completed English descriptions are not accepted as a naming input.

mod capture;
mod catalog;
#[cfg(test)]
mod tests;

use crate::text::Locale;
use crate::text_parameters::{CompiledTemplate, Parameter, ParameterKind,
    ParameterSpec, ParameterValue, MAX_OUTPUT_BYTES};
use std::fmt;

pub use capture::{parse_monster_capture, parse_object_capture};
pub use catalog::ReviewedNamingCatalog;
pub(crate) use capture::{monster_from_value, object_from_value};

pub const CAPTURE_SCHEMA_VERSION: u32 = 2;
pub const MAX_CAPTURE_BYTES: usize = 128 * 1024;
pub const MAX_PARTS: usize = 32;
pub const MAX_LEXEME_BYTES: usize = 8192;
pub const MAX_INSCRIPTIONS: usize = 6;
pub const MAX_MODIFIERS: usize = 64;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NamingError {
    InvalidCapture(&'static str), IncompleteCapture(String), InvalidJson(String),
    MissingIdentity(String), MissingPolicy(String), InvalidPattern(&'static str),
    InvalidTemplate(String), TextTooLong, OutputTooLong, NativeUtf8Boundary,
}
impl fmt::Display for NamingError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidCapture(s) => write!(f, "invalid naming capture: {s}"),
            Self::IncompleteCapture(s) => write!(f, "incomplete naming capture: {s}"),
            Self::InvalidJson(s) => write!(f, "invalid naming JSON: {s}"),
            Self::MissingIdentity(s) => write!(f, "missing naming identity: {s}"),
            Self::MissingPolicy(s) => write!(f, "missing naming policy: {s}"),
            Self::InvalidPattern(s) => write!(f, "invalid source name pattern: {s}"),
            Self::InvalidTemplate(s) => write!(f, "invalid naming template: {s}"),
            Self::TextTooLong => f.write_str("naming text exceeds its bound"),
            Self::OutputTooLong => f.write_str("naming output exceeds its bound"),
            Self::NativeUtf8Boundary => f.write_str("native byte truncation splits UTF-8"),
        }
    }
}
impl std::error::Error for NamingError {}

/// Grammar roles are semantic catalog entries, not completed-English keys.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GrammarRole {
    ObjectPrefixNoMore, ObjectPrefixQuantity, ObjectPrefixThe, ObjectPrefixA, ObjectPrefixAn,
    ObjectNoMore, ObjectQuantity, ObjectArtifactOf, ObjectArtifactQuoted,
    ObjectArtifactAfter, ObjectEgo, ObjectOf, ObjectQuoted, ObjectChest,
    ObjectFuel, ObjectDice, ObjectMultiplier, ObjectHitDamage, ObjectBonus,
    ObjectArmorBaseBonus, ObjectArmorBonus, ObjectArmorBase,
    ObjectModsOpen, ObjectModsSeparator, ObjectModsClose, ObjectCharges,
    ObjectCharging, ObjectChargingCount, ObjectInscriptionsOpen,
    ObjectInscriptionsSeparator, ObjectInscriptionsClose, ObjectMoney,
    MonsterArticleThe, MonsterArticleA, MonsterArticleAn, MonsterPossessive, MonsterOffscreen,
    MonsterComma, MonsterListUnique, MonsterListCount,
    MonsterPronoun(u8), MonsterReflexive(Gender),
}
impl GrammarRole {
    #[must_use]
    pub fn id(self) -> String {
        let role=match self {
            Self::ObjectPrefixNoMore=>"object.prefix.no_more",Self::ObjectPrefixQuantity=>"object.prefix.quantity",
            Self::ObjectPrefixThe=>"object.prefix.definite",Self::ObjectPrefixA=>"object.prefix.a",Self::ObjectPrefixAn=>"object.prefix.an",
            Self::ObjectNoMore=>"object.compose.no_more",Self::ObjectQuantity=>"object.compose.quantity",
            Self::ObjectArtifactOf=>"object.compose.artifact_of",Self::ObjectArtifactQuoted=>"object.compose.artifact_quoted",
            Self::ObjectArtifactAfter=>"object.compose.artifact_literal",Self::ObjectEgo=>"object.compose.ego",
            Self::ObjectOf=>"object.compose.aware_kind",Self::ObjectQuoted=>"object.compose.aware_kind_terse",
            Self::ObjectChest=>"object.chest",Self::ObjectFuel=>"object.fuel",Self::ObjectDice=>"object.dice",
            Self::ObjectMultiplier=>"object.multiplier",Self::ObjectHitDamage=>"object.bonus.pair",Self::ObjectBonus=>"object.bonus.single",
            Self::ObjectArmorBaseBonus=>"object.armor.base_bonus",Self::ObjectArmorBonus=>"object.armor.bonus",Self::ObjectArmorBase=>"object.armor.base",
            Self::ObjectModsOpen=>"object.mods.open",Self::ObjectModsSeparator=>"object.mods.separator",Self::ObjectModsClose=>"object.mods.close",
            Self::ObjectCharges=>"object.charges",Self::ObjectCharging=>"object.charging.single",Self::ObjectChargingCount=>"object.charging.count",
            Self::ObjectInscriptionsOpen=>"object.inscriptions.open",Self::ObjectInscriptionsSeparator=>"object.inscriptions.separator",Self::ObjectInscriptionsClose=>"object.inscriptions.close",
            Self::ObjectMoney=>"object.money",Self::MonsterArticleThe=>"monster.article.definite",Self::MonsterArticleA=>"monster.article.a",Self::MonsterArticleAn=>"monster.article.an",
            Self::MonsterPossessive=>"monster.possessive",Self::MonsterOffscreen=>"monster.offscreen",Self::MonsterComma=>"monster.comma",
            Self::MonsterListUnique=>"monster.list.unique",Self::MonsterListCount=>"monster.list.quantity",
            Self::MonsterPronoun(code)=>{
                let gender=match code&0xf0 { 0=>"neuter",0x10=>"male",0x20=>"female",_=>"invalid" };
                let form=match code&7 { 0=>"subject",1=>"object",2=>"possessive",3=>"reflexive",4=>"indefinite_subject",5=>"indefinite_object",6=>"indefinite_possessive",_=>"indefinite_reflexive" };
                return format!("angband.naming.grammar.monster.pronoun.{gender}.{form}");
            }
            Self::MonsterReflexive(gender)=>return Self::MonsterPronoun(match gender { Gender::Neutral=>3,Gender::Male=>0x13,Gender::Female=>0x23 }).id(),
        };
        format!("angband.naming.grammar.{role}")
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Gender { Neutral, Male, Female }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ArtifactAttachment { Of, Quoted, After }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModifierPurpose { Flavor, Ego }

/// A catalog adapter must validate EN/JA identity parity and grammar parameter
/// parity at construction. No method may consult current gameplay state.
pub trait NamingCatalog {
    fn text(&self, id: &str, locale: Locale) -> Result<&str, NamingError>;
    fn grammar(&self, role: GrammarRole, locale: Locale) -> Result<&str, NamingError>;
    /// Japanese base templates contain at most the reviewed `{modifier}` slot.
    fn japanese_counter(&self, base_id: &str) -> Result<&str, NamingError>;
    /// Reviewed flavor/ego phrases have separate .modifier lexical entries.
    fn japanese_modifier(&self, id: &str, purpose: ModifierPurpose) -> Result<&str, NamingError>;
    fn artifact_attachment(&self, id: &str) -> Result<ArtifactAttachment, NamingError>;
    /// Proper names with appositives have a separately reviewed JP endpoint.
    fn monster_possessive_name(&self, id: &str, locale: Locale) -> Result<&str, NamingError>;
    fn monster_plural(&self, id: &str, locale: Locale) -> Result<Option<&str>, NamingError>;
    fn monster_counter(&self, id: &str) -> Result<&str, NamingError>;
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NameReference {
    Catalog(String),
    GeneratedScrollTitle(String),
    GeneratedRandartName { raw: String, display_name: String, attachment: ArtifactAttachment },
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Inscription { Catalog(String), User(String) }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PrefixForm { None, NoMore, Quantity, The, A, An }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SuffixForm { Artifact, Ego, Of, Quoted }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Bonuses {
    HitDamage { hit: i32, damage: i32 }, Hit(i32), Damage(i32), StandardHitPenalty(i32),
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Armor { BaseBonus { base: i32, bonus: i32 }, Bonus(i32), Base(i32) }
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ObjectPart {
    Literal { name: NameReference },
    Money { amount: i32, name_id: String, ignore: bool },
    Prefix { form: PrefixForm, number: u16 },
    Base { name_id: String, modifier: Option<NameReference>, plural: bool },
    Suffix { form: SuffixForm, name: NameReference },
    Chest { name_id: String }, Fuel { turns: i32 },
    Dice { dice: i32, sides: i32 }, Multiplier { value: i32 },
    Bonuses(Bonuses), Armor(Armor), Modifiers(Vec<i32>),
    Charges { value: i32 }, Charging { count: Option<i32> },
    Inscriptions(Vec<Inscription>), StoreAnnotation { name_id: String },
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ObjectCapture {
    pub mode: u32,
    pub native_max_bytes: u32,
    pub parts: Vec<ObjectPart>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MonsterPart {
    Pronoun { code: u8 }, Reflexive { gender: Gender },
    ListPrefix { number: Option<i32> },
    Prefix { form: PrefixForm }, Race { name_id: String, strip_appositive: bool, plural_form: MonsterPluralForm },
    AppositiveComma, Possessive, Offscreen,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MonsterPluralForm { Singular, Explicit, Regular }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MonsterCapture {
    pub mode: u32,
    pub native_max_bytes: u32,
    pub capital: bool,
    pub parts: Vec<MonsterPart>,
}

fn checked_text(text: &str) -> Result<&str, NamingError> {
    if text.len() > MAX_LEXEME_BYTES { return Err(NamingError::TextTooLong); }
    if text.contains('\0') { return Err(NamingError::InvalidCapture("embedded NUL")); }
    Ok(text)
}
fn append(output: &mut String, text: &str) -> Result<(), NamingError> {
    if output.len().checked_add(text.len()).is_none_or(|n| n > MAX_OUTPUT_BYTES) {
        return Err(NamingError::OutputTooLong);
    }
    output.push_str(text); Ok(())
}
fn grammar(catalog: &impl NamingCatalog, role: GrammarRole, locale: Locale,
    values: &[(&str, &str)]) -> Result<String, NamingError> {
    let source = checked_text(catalog.grammar(role, locale)?)?;
    // Reviewed naming grammar declares the union of EN/JA slots: counters are
    // absent from English, and the English charge plural suffix is absent from
    // Japanese. Validate every slot in the selected locale, without translating
    // or reparsing its immutable values. Static punctuation roles are literal.
    if values.is_empty() { return Ok(source.to_owned()); }
    let selected: Vec<_> = values.iter().filter(|(name,_)| source.contains(&format!("{{{name}}}"))).collect();
    let schema: Vec<_> = selected.iter().map(|(name, _)| ParameterSpec {
        name, kind: ParameterKind::Text,
    }).collect();
    let parameters: Vec<_> = selected.iter().map(|(name, text)| Parameter {
        name, value: ParameterValue::Text(text),
    }).collect();
    CompiledTemplate::compile(source, &schema)
        .and_then(|t| t.format(locale, &parameters))
        .map_err(|e| NamingError::InvalidTemplate(e.to_string()))
}

fn inscriptions(catalog: &impl NamingCatalog, locale: Locale, entries: &[&str]) -> Result<String, NamingError> {
    let mut out=grammar(catalog,GrammarRole::ObjectInscriptionsOpen,locale,&[])?;
    let sep=grammar(catalog,GrammarRole::ObjectInscriptionsSeparator,locale,&[])?;
    for (i,text) in entries.iter().enumerate() { if i>0 { append(&mut out,&sep)?; } append(&mut out,checked_text(text)?)?; }
    append(&mut out,&grammar(catalog,GrammarRole::ObjectInscriptionsClose,locale,&[])?)?;
    Ok(out)
}
fn apply_quantity(output: &mut String, pending: &mut Option<(PrefixForm,u16)>, base_id: Option<&str>,
    catalog: &impl NamingCatalog, locale: Locale) -> Result<(),NamingError> {
    if locale != Locale::Japanese { return Ok(()); }
    if let Some((form,number))=pending.take() {
        match form {
            PrefixForm::NoMore => *output=grammar(catalog,GrammarRole::ObjectNoMore,locale,&[("base",output)])?,
            PrefixForm::Quantity => { let counter=checked_text(catalog.japanese_counter(base_id.ok_or(NamingError::InvalidCapture("quantity base"))?)?)?;
                *output=grammar(catalog,GrammarRole::ObjectQuantity,locale,&[("number",&number.to_string()),("counter",counter),("base",output)])?; }
            _=>{}
        }
    }
    Ok(())
}

/// `&`, `~`, `|singular|plural|`, and `#` have exactly obj-desc.c semantics.
/// The modifier is formatted once with no further substitution. Official
/// malformed patterns are rejected rather than producing a partial name.
pub fn format_english_pattern(pattern: &str, modifier: Option<&str>, plural: bool)
    -> Result<String, NamingError> {
    checked_text(pattern)?;
    if let Some(m) = modifier { checked_text(m)?; }
    let bytes = pattern.as_bytes();
    let mut output = String::new();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'&' => {
                while matches!(bytes.get(i), Some(b'&' | b' ')) { i += 1; }
                continue;
            }
            b'~' => {
                if i == 0 { return Err(NamingError::InvalidPattern("leading pluralizer")); }
                if plural { append(&mut output, if matches!(bytes[i - 1], b's' | b'h' | b'x') { "es" } else { "s" })?; }
                i += 1;
            }
            b'|' => {
                let singular_start = i + 1;
                let middle = bytes[singular_start..].iter().position(|&b| b == b'|')
                    .map(|n| singular_start + n).ok_or(NamingError::InvalidPattern("unclosed singular alternative"))?;
                let plural_start = middle + 1;
                let end = bytes[plural_start..].iter().position(|&b| b == b'|')
                    .map(|n| plural_start + n).ok_or(NamingError::InvalidPattern("unclosed plural alternative"))?;
                append(&mut output, if plural { &pattern[plural_start..end] } else { &pattern[singular_start..middle] })?;
                i = end + 1;
            }
            b'#' if modifier.is_some() => {
                append(&mut output, &format_english_pattern(modifier.unwrap_or(""), None, plural)?)?;
                i += 1;
            }
            _ => {
                let c = pattern[i..].chars().next().ok_or(NamingError::InvalidPattern("UTF-8 boundary"))?;
                let end = i + c.len_utf8();
                append(&mut output, &pattern[i..end])?;
                i = end;
            }
        }
    }
    Ok(output)
}

fn name<'a>(catalog: &'a impl NamingCatalog, reference: &'a NameReference, locale: Locale,
    modifier: Option<ModifierPurpose>) -> Result<&'a str, NamingError> {
    checked_text(match reference {
        NameReference::Catalog(id) => match (locale, modifier) {
            (Locale::Japanese, Some(purpose)) => catalog.japanese_modifier(id, purpose)?,
            _ => catalog.text(id, locale)?,
        },
        NameReference::GeneratedScrollTitle(text) => text,
        NameReference::GeneratedRandartName { raw,display_name,.. } => if locale==Locale::English { raw } else { display_name },
    })
}
fn native_limit(mut output: String, max: u32, locale: Locale) -> Result<String, NamingError> {
    if max == 0 || max as usize > MAX_CAPTURE_BYTES { return Err(NamingError::InvalidCapture("native_max_bytes")); }
    if locale == Locale::English {
        let end = (max as usize - 1).min(output.len());
        if !output.is_char_boundary(end) { return Err(NamingError::NativeUtf8Boundary); }
        output.truncate(end);
    }
    Ok(output)
}

impl ObjectCapture {
    /// Validates the producer-selected branch order and mutually exclusive
    /// cases. It cannot and does not validate gameplay knowledge predicates.
    pub fn validate(&self) -> Result<(), NamingError> {
        if self.native_max_bytes == 0 || self.native_max_bytes as usize > MAX_CAPTURE_BYTES {
            return Err(NamingError::InvalidCapture("native_max_bytes"));
        }
        if self.parts.is_empty() || self.parts.len() > MAX_PARTS { return Err(NamingError::InvalidCapture("object part count")); }
        if matches!(self.parts[0], ObjectPart::Literal { .. } | ObjectPart::Money { .. }) {
            return if self.parts.len() == 1 { Ok(()) } else { Err(NamingError::InvalidCapture("early-return object has suffix parts")) };
        }
        let mut previous = 0;
        let mut base = false;
        let mut chest_or_fuel = false;
        let mut charges_or_charging = false;
        for part in &self.parts {
            let order = match part {
                ObjectPart::Prefix { form, number } => {
                    if !matches!((form, number), (PrefixForm::None, _) | (PrefixForm::NoMore, 0) |
                        (PrefixForm::Quantity, 2..) | (PrefixForm::The | PrefixForm::A | PrefixForm::An, 1)) {
                        return Err(NamingError::InvalidCapture("prefix form/quantity"));
                    } 1
                }
                ObjectPart::Base { .. } => { base = true; 2 }
                ObjectPart::Suffix { form, name } => {
                    if matches!(name, NameReference::GeneratedScrollTitle(_)) ||
                        (matches!(name, NameReference::GeneratedRandartName {..}) && *form != SuffixForm::Artifact) {
                        return Err(NamingError::InvalidCapture("suffix origin"));
                    } 3
                }
                ObjectPart::Chest { .. } | ObjectPart::Fuel { .. } => {
                    if chest_or_fuel { return Err(NamingError::InvalidCapture("chest/fuel conflict")); }
                    chest_or_fuel = true; 4
                }
                ObjectPart::Dice { .. } => 5,
                ObjectPart::Multiplier { .. } => 6,
                ObjectPart::Bonuses(_) => 7,
                ObjectPart::Armor(_) => 8,
                ObjectPart::Modifiers(values) => {
                    if values.is_empty() || values.len() > MAX_MODIFIERS || values.iter().enumerate().any(|(i,v)| *v == 0 || values[..i].contains(v)) {
                        return Err(NamingError::InvalidCapture("modifiers must be distinct nonzero selected values"));
                    } 9
                }
                ObjectPart::Charges { .. } | ObjectPart::Charging { .. } => {
                    if charges_or_charging { return Err(NamingError::InvalidCapture("charges/charging conflict")); }
                    charges_or_charging = true; 10
                }
                ObjectPart::Inscriptions(values) => {
                    if values.is_empty() || values.len() > MAX_INSCRIPTIONS { return Err(NamingError::InvalidCapture("inscription count")); } 11
                }
                ObjectPart::StoreAnnotation { .. } => 11,
                ObjectPart::Literal { .. } | ObjectPart::Money { .. } => return Err(NamingError::InvalidCapture("misplaced early-return part")),
            };
            if order <= previous { return Err(NamingError::InvalidCapture("duplicate or out-of-order object part")); }
            previous = order;
        }
        if !base { return Err(NamingError::InvalidCapture("object base missing")); }
        Ok(())
    }
}

/// English is obj-desc.c's selected output, including its CAPITAL no-op.
/// Japanese recomposes those same disclosed facts through catalog grammar.
pub fn format_object(capture: &ObjectCapture, catalog: &impl NamingCatalog, locale: Locale)
    -> Result<String, NamingError> {
    capture.validate()?;
    let mut output = String::new();
    let mut pending_prefix = None;
    let mut base_id = None;
    for part in &capture.parts {
        if !matches!(part,ObjectPart::Prefix {..}|ObjectPart::Base {..}|ObjectPart::Suffix {..}) {
            apply_quantity(&mut output,&mut pending_prefix,base_id,catalog,locale)?;
        }
        match part {
            ObjectPart::Literal { name:reference } => append(&mut output,name(catalog,reference,locale,None)?)?,
            ObjectPart::Money { amount, name_id, ignore } => {
                let number = amount.to_string();
                let money = checked_text(catalog.text(name_id, locale)?)?;
                let ignored=if *ignore { inscriptions(catalog,locale,&[catalog.text("angband.naming.grammar.object.annotation.ignore",locale)?])? } else { String::new() };
                append(&mut output, &grammar(catalog, GrammarRole::ObjectMoney, locale, &[("amount", &number), ("name", money),("ignore",&ignored)])?)?;
            }
            ObjectPart::Prefix { form, number } => {
                if locale == Locale::English {
                    let role=match form { PrefixForm::None=>None,PrefixForm::NoMore=>Some(GrammarRole::ObjectPrefixNoMore),PrefixForm::The=>Some(GrammarRole::ObjectPrefixThe),
                        PrefixForm::A=>Some(GrammarRole::ObjectPrefixA),PrefixForm::An=>Some(GrammarRole::ObjectPrefixAn),PrefixForm::Quantity=>Some(GrammarRole::ObjectPrefixQuantity) };
                    if let Some(role)=role { append(&mut output,&if *form==PrefixForm::Quantity { grammar(catalog,role,locale,&[("number",&number.to_string()),("counter","")])? } else { grammar(catalog,role,locale,&[])? })?; }
                } else { pending_prefix = Some((*form, *number)); }
            }
            ObjectPart::Base { name_id, modifier, plural } => {
                base_id = Some(name_id.as_str());
                let source = checked_text(catalog.text(name_id, locale)?)?;
                let modstr = modifier.as_ref().map(|r| name(catalog, r, locale, Some(ModifierPurpose::Flavor))).transpose()?;
                if locale == Locale::English { append(&mut output, &format_english_pattern(source, modstr, *plural)?)?; }
                else if source.contains("{modifier}") {
                    let value = modstr.ok_or(NamingError::InvalidCapture("Japanese base requires selected modifier"))?;
                    let schema = [ParameterSpec { name: "modifier", kind: ParameterKind::Text }];
                    let args = [Parameter { name: "modifier", value: ParameterValue::Text(value) }];
                    append(&mut output, &CompiledTemplate::compile(source, &schema).and_then(|t| t.format(locale, &args))
                        .map_err(|e| NamingError::InvalidTemplate(e.to_string()))?)?;
                } else { append(&mut output, source)?; }
            }
            ObjectPart::Suffix { form, name: reference } => {
                let suffix = name(catalog, reference, locale, if *form == SuffixForm::Ego { Some(ModifierPurpose::Ego) } else { None })?;
                if locale == Locale::English { append(&mut output, match form { SuffixForm::Of => " of ", SuffixForm::Quoted => " '", _ => " " })?;
                    append(&mut output, suffix)?; if *form == SuffixForm::Quoted { append(&mut output, "'")?; }
                } else {
                    let role = match form {
                        SuffixForm::Artifact => match reference {
                            NameReference::Catalog(id) => match catalog.artifact_attachment(id)? {
                                ArtifactAttachment::Of => GrammarRole::ObjectArtifactOf,
                                ArtifactAttachment::Quoted => GrammarRole::ObjectArtifactQuoted,
                                ArtifactAttachment::After => GrammarRole::ObjectArtifactAfter,
                            },
                            NameReference::GeneratedRandartName {attachment,..} => match attachment {
                                ArtifactAttachment::Of=>GrammarRole::ObjectArtifactOf,ArtifactAttachment::Quoted=>GrammarRole::ObjectArtifactQuoted,
                                ArtifactAttachment::After=>GrammarRole::ObjectArtifactAfter,
                            },
                            _ => return Err(NamingError::InvalidCapture("artifact suffix origin")),
                        },
                        SuffixForm::Ego => GrammarRole::ObjectEgo,
                        SuffixForm::Of => GrammarRole::ObjectOf,
                        SuffixForm::Quoted => GrammarRole::ObjectQuoted,
                    };
                    output = grammar(catalog, role, locale, &[("base", &output), ("suffix", suffix)])?;
                }
            }
            ObjectPart::Chest { name_id } => append(&mut output, &grammar(catalog, GrammarRole::ObjectChest, locale, &[("trap", checked_text(catalog.text(name_id, locale)?)?)])?)?,
            ObjectPart::Fuel { turns } => append(&mut output, &grammar(catalog, GrammarRole::ObjectFuel, locale, &[("turns", &turns.to_string())])?)?,
            ObjectPart::Dice { dice, sides } => append(&mut output, &grammar(catalog, GrammarRole::ObjectDice, locale, &[("dice", &dice.to_string()), ("sides", &sides.to_string())])?)?,
            ObjectPart::Multiplier { value } => append(&mut output, &grammar(catalog, GrammarRole::ObjectMultiplier, locale, &[("multiplier", &value.to_string())])?)?,
            ObjectPart::Bonuses(b) => {
                let text = match b {
                    Bonuses::HitDamage { hit, damage } => grammar(catalog, GrammarRole::ObjectHitDamage, locale, &[("hit", &format!("{hit:+}")), ("damage", &format!("{damage:+}"))])?,
                    Bonuses::Hit(n) | Bonuses::Damage(n) | Bonuses::StandardHitPenalty(n) => grammar(catalog, GrammarRole::ObjectBonus, locale, &[("bonus", &format!("{n:+}"))])?,
                }; append(&mut output, &text)?;
            }
            ObjectPart::Armor(a) => {
                let text = match a {
                    Armor::BaseBonus { base, bonus } => grammar(catalog, GrammarRole::ObjectArmorBaseBonus, locale, &[("armor", &base.to_string()), ("bonus", &format!("{bonus:+}"))])?,
                    Armor::Bonus(n) => grammar(catalog, GrammarRole::ObjectArmorBonus, locale, &[("bonus", &format!("{n:+}"))])?,
                    Armor::Base(n) => grammar(catalog, GrammarRole::ObjectArmorBase, locale, &[("armor", &n.to_string())])?,
                }; append(&mut output, &text)?;
            }
            ObjectPart::Modifiers(values) => {
                append(&mut output,&grammar(catalog,GrammarRole::ObjectModsOpen,locale,&[])?)?;
                let separator=grammar(catalog,GrammarRole::ObjectModsSeparator,locale,&[])?;
                for (i,n) in values.iter().enumerate() { if i>0 { append(&mut output,&separator)?; } append(&mut output,&format!("{n:+}"))?; }
                append(&mut output,&grammar(catalog,GrammarRole::ObjectModsClose,locale,&[])?)?;
            }
            ObjectPart::Charges { value } => append(&mut output, &grammar(catalog,GrammarRole::ObjectCharges,locale,&[("charges",&value.to_string()),("plural_suffix",if *value==1 { "" } else { "s" })])?)?,
            ObjectPart::Charging { count } => append(&mut output, &if let Some(n) = count { grammar(catalog, GrammarRole::ObjectChargingCount, locale, &[("number", &n.to_string())])? }
                else { grammar(catalog, GrammarRole::ObjectCharging, locale, &[])? })?,
            ObjectPart::Inscriptions(entries) => {
                let texts: Result<Vec<_>, _> = entries.iter().map(|entry| match entry {
                    Inscription::Catalog(id) => checked_text(catalog.text(id, locale)?),
                    Inscription::User(text) => checked_text(text),
                }).collect();
                append(&mut output,&inscriptions(catalog,locale,&texts?)?)?;
            }
            ObjectPart::StoreAnnotation { name_id } => append(&mut output,checked_text(catalog.text(name_id,locale)?)?)?,
        }
    }
    apply_quantity(&mut output,&mut pending_prefix,base_id,catalog,locale)?;
    native_limit(output, capture.native_max_bytes, locale)
}

impl MonsterCapture {
    pub fn validate(&self) -> Result<(), NamingError> {
        if self.native_max_bytes == 0 || self.native_max_bytes as usize > MAX_CAPTURE_BYTES || self.parts.is_empty() || self.parts.len() > 7 {
            return Err(NamingError::InvalidCapture("monster bounds"));
        }
        match &self.parts[0] {
            MonsterPart::Pronoun { code } => {
                if !matches!(code, 0x00..=0x07 | 0x10..=0x17 | 0x20..=0x27) || self.parts.len() != 1 { return Err(NamingError::InvalidCapture("pronoun branch")); }
            }
            MonsterPart::Reflexive { .. } => if self.parts.len() != 1 { return Err(NamingError::InvalidCapture("reflexive branch")); },
            MonsterPart::ListPrefix { .. } => {
                if self.parts.len()!=2 || !matches!(self.parts[1],MonsterPart::Race { strip_appositive:false,..}) {
                    return Err(NamingError::InvalidCapture("monster-list branch"));
                }
                if matches!(self.parts[0],MonsterPart::ListPrefix { number:None }) &&
                    !matches!(self.parts[1],MonsterPart::Race { plural_form:MonsterPluralForm::Singular,..}) {
                    return Err(NamingError::InvalidCapture("unique-list plural"));
                }
            }
            _ => {
                let mut previous = 0; let mut race = false;
                for part in &self.parts {
                    let order = match part {
                        MonsterPart::Prefix { form: PrefixForm::None | PrefixForm::The | PrefixForm::A | PrefixForm::An } => 1,
                        MonsterPart::Race { plural_form:MonsterPluralForm::Singular,.. } => { race = true; 2 },
                        MonsterPart::AppositiveComma => 3, MonsterPart::Possessive => 4, MonsterPart::Offscreen => 5,
                        _ => return Err(NamingError::InvalidCapture("named monster part")),
                    };
                    if order <= previous { return Err(NamingError::InvalidCapture("duplicate or out-of-order monster part")); }
                    previous = order;
                }
                if !race { return Err(NamingError::InvalidCapture("monster race missing")); }
            }
        }
        Ok(())
    }
}

pub fn format_monster(capture: &MonsterCapture, catalog: &impl NamingCatalog, locale: Locale)
    -> Result<String, NamingError> {
    capture.validate()?;
    if let [MonsterPart::ListPrefix { number },MonsterPart::Race { name_id,plural_form,.. }]=capture.parts.as_slice() {
        let raw=checked_text(catalog.text(name_id,locale)?)?;
        let name=if *plural_form==MonsterPluralForm::Regular && locale==Locale::English {
            format!("{raw}{}",if raw.ends_with('s') { "es" } else { "s" })
        } else { raw.to_owned() };
        let mut output=if let Some(n)=number {
            let count=if locale==Locale::English { format!("{n:3}") } else { n.to_string() };
            let counter=if locale==Locale::Japanese { catalog.monster_counter(name_id)? } else { "" };
            let mut prefix=grammar(catalog,GrammarRole::MonsterListCount,locale,&[("number",&count),("counter",counter)])?;
            append(&mut prefix,&name)?; prefix
        } else { grammar(catalog,GrammarRole::MonsterListUnique,locale,&[("name",&name)])? };
        if capture.capital && output.as_bytes().first().is_some_and(u8::is_ascii_lowercase) {
            let first=output.as_bytes()[0] as char; output.replace_range(0..1,&first.to_ascii_uppercase().to_string());
        }
        return native_limit(output,capture.native_max_bytes,locale);
    }
    let mut output = String::new();
    for part in &capture.parts {
        match part {
            MonsterPart::Pronoun { code } => append(&mut output, &grammar(catalog, GrammarRole::MonsterPronoun(*code), locale, &[])?)?,
            MonsterPart::Reflexive { gender } => append(&mut output, &grammar(catalog, GrammarRole::MonsterReflexive(*gender), locale, &[])?)?,
            MonsterPart::Prefix { form } => {
                let role=match form { PrefixForm::The=>Some(GrammarRole::MonsterArticleThe),PrefixForm::A=>Some(GrammarRole::MonsterArticleA),PrefixForm::An=>Some(GrammarRole::MonsterArticleAn),_=>None };
                if let Some(role)=role { append(&mut output,&grammar(catalog,role,locale,&[])?)?; }
            }
            MonsterPart::Race { name_id, strip_appositive,.. } => {
                let text = checked_text(if *strip_appositive && locale == Locale::Japanese { catalog.monster_possessive_name(name_id, locale)? }
                    else { catalog.text(name_id, locale)? })?;
                let text = if *strip_appositive && locale == Locale::English {
                    text.find(',').filter(|&i| i < 1024).map_or(text, |i| &text[..i])
                } else { text };
                append(&mut output, text)?;
            }
            MonsterPart::AppositiveComma => append(&mut output, &grammar(catalog, GrammarRole::MonsterComma, locale, &[])?)?,
            MonsterPart::Possessive => append(&mut output, &grammar(catalog, GrammarRole::MonsterPossessive, locale, &[])?)?,
            MonsterPart::Offscreen => append(&mut output, &grammar(catalog, GrammarRole::MonsterOffscreen, locale, &[])?)?,
            MonsterPart::ListPrefix { .. } => return Err(NamingError::InvalidCapture("misplaced list prefix")),
        }
    }
    if capture.capital && let Some(first) = output.as_bytes().first().copied() {
        if first.is_ascii_lowercase() { output.replace_range(0..1, &(first as char).to_ascii_uppercase().to_string()); }
    }
    native_limit(output, capture.native_max_bytes, locale)
}

/// The monster-list producer already discloses uniqueness and quantity.
/// Source list pluralization is deliberately simpler than object patterns.
pub fn format_monster_list(catalog: &impl NamingCatalog, locale: Locale, name_id: &str,
    number: i32, unique: bool, native_max_bytes: u32) -> Result<String, NamingError> {
    let singular = checked_text(catalog.text(name_id, locale)?)?;
    let name = if unique || number == 1 { singular.to_owned() }
        else if let Some(plural) = catalog.monster_plural(name_id, locale)? { checked_text(plural)?.to_owned() }
        else if locale == Locale::English { format!("{singular}{}", if singular.ends_with('s') { "es" } else { "s" }) }
        else { singular.to_owned() };
    let output = if unique { grammar(catalog, GrammarRole::MonsterListUnique, locale, &[("name", &name)])? }
        else {
            let count = if locale == Locale::English { format!("{number:3}") } else { number.to_string() };
            let counter = if locale == Locale::Japanese { catalog.monster_counter(name_id)? } else { "" };
            let mut prefix=grammar(catalog,GrammarRole::MonsterListCount,locale,&[("number",&count),("counter",counter)])?;
            append(&mut prefix,&name)?; prefix
        };
    native_limit(output, native_max_bytes, locale)
}
