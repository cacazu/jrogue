// SPDX-License-Identifier: GPL-3.0-or-later
//! Versioned, source-bound labels. This module never reads native state, RNG or a clock.
//! Identity/visibility decisions are supplied at their original native source site.
//! Unknown information has no field in the corresponding hidden descriptor variant.
use crate::display::{Language, TextId};
use serde::de;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_json::Value;
use std::fmt;

pub const SCHEMA_VERSION: u32 = 1;
pub const MAX_EXTERNAL_BYTES: usize = 1024;
pub const MAX_RICH_RUNS: usize = 64;
pub const MAX_RENDER_BYTES: usize = 65_536;

/// Version1 cannot be constructed by deserializing an unsupported version.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct VersionOne;
impl Serialize for VersionOne {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_u32(SCHEMA_VERSION)
    }
}
impl<'de> Deserialize<'de> for VersionOne {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        if u32::deserialize(deserializer)? != SCHEMA_VERSION {
            return Err(de::Error::custom("unsupported dynamic text schema"));
        }
        Ok(Self)
    }
}

/// Wire numbers are always canonical decimal strings, including u64::MAX.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DecimalU64(u64);
impl DecimalU64 {
    pub const fn new(value: u64) -> Self {
        Self(value)
    }
    pub const fn get(self) -> u64 {
        self.0
    }
}
impl Serialize for DecimalU64 {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.0.to_string())
    }
}
impl<'de> Deserialize<'de> for DecimalU64 {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let text = String::deserialize(deserializer)?;
        if text.is_empty()
            || text.len() > 20
            || (text != "0" && text.starts_with('0'))
            || !text.bytes().all(|byte| byte.is_ascii_digit())
        {
            return Err(de::Error::custom("quantity is not a canonical decimal u64"));
        }
        text.parse::<u64>()
            .map(Self)
            .map_err(|_| de::Error::custom("quantity exceeds u64"))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntityDomain {
    Species,
    Job,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntityForm {
    Name,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EntityLabel {
    version: VersionOne,
    upstream: String,
    domain: EntityDomain,
    id: TextId,
    form: EntityForm,
}
impl EntityLabel {
    /// Create a source-registry name reference; rendering still validates the ID/domain.
    pub fn name(domain: EntityDomain, id: TextId) -> Self {
        Self {
            version: VersionOne,
            upstream: crate::UPSTREAM_COMMIT.into(),
            domain,
            id,
            form: EntityForm::Name,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActorForm {
    Name,
    PossessiveName,
    Subject,
    PossessivePronoun,
    Reflexive,
    Object,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PronounGender {
    Neuter,
    Masculine,
    Feminine,
    Player,
    Plural,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActorVisibility {
    External,
    Player,
    Unseen,
    Seen,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "visibility", rename_all = "snake_case", deny_unknown_fields)]
pub enum ActorIdentity {
    External {
        name: String,
    },
    Player {},
    Unseen {},
    Seen {
        base_id: TextId,
        gender: PronounGender,
    },
}
impl ActorIdentity {
    fn visibility(&self) -> ActorVisibility {
        match self {
            Self::External { .. } => ActorVisibility::External,
            Self::Player {} => ActorVisibility::Player,
            Self::Unseen {} => ActorVisibility::Unseen,
            Self::Seen { .. } => ActorVisibility::Seen,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActorLabel {
    version: VersionOne,
    upstream: String,
    form: ActorForm,
    identity: ActorIdentity,
}
impl ActorLabel {
    /// External names are literal data and never become catalog IDs or templates.
    ///
    /// # Errors
    /// Rejects empty names, controls or names exceeding the descriptor byte limit.
    pub fn external(name: String) -> Result<Self, DynamicError> {
        external_name(&name)?;
        Ok(Self {
            version: VersionOne,
            upstream: crate::UPSTREAM_COMMIT.into(),
            form: ActorForm::Name,
            identity: ActorIdentity::External { name },
        })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ItemClass {
    Wand,
    Potion,
    Scroll,
    Amulet,
    Ring,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ItemVisibility {
    Base,
    Appearance,
    Identified,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ItemForm {
    BaseName,
    Name,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "visibility", rename_all = "snake_case", deny_unknown_fields)]
pub enum ItemIdentity {
    Base { class: ItemClass },
    Appearance { appearance_id: TextId },
    Identified { identity_id: TextId },
}
impl ItemIdentity {
    fn visibility(&self) -> ItemVisibility {
        match self {
            Self::Base { .. } => ItemVisibility::Base,
            Self::Appearance { .. } => ItemVisibility::Appearance,
            Self::Identified { .. } => ItemVisibility::Identified,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ItemLabel {
    version: VersionOne,
    upstream: String,
    identity: ItemIdentity,
    form: ItemForm,
    count: DecimalU64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Quantity {
    version: VersionOne,
    upstream: String,
    value: DecimalU64,
}
impl Quantity {
    pub fn new(value: u64) -> Self {
        Self {
            version: VersionOne,
            upstream: crate::UPSTREAM_COMMIT.into(),
            value: DecimalU64::new(value),
        }
    }
    pub const fn value(&self) -> u64 {
        self.value.get()
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BindingOrigin {
    FixedUi,
    NativeResolved,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CommandRef {
    version: VersionOne,
    upstream: String,
    command: TextId,
    binding: BindingOrigin,
    token: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RunStyle {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    colour: Option<u8>,
    #[serde(default)]
    emphasis: bool,
}
impl RunStyle {
    fn validate(&self) -> Result<(), DynamicError> {
        if self.colour.is_some_and(|colour| colour > 15) {
            return Err(DynamicError::Invalid("run colour outside native palette"));
        }
        Ok(())
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RunRole {
    Literal,
    Parameter,
    ExternalName,
    EntityLabel,
    ActorLabel,
    ItemLabel,
    Quantity,
    CommandToken,
    LineBreak,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct TextRun {
    text: String,
    style: RunStyle,
    role: RunRole,
}
impl TextRun {
    pub fn text(&self) -> &str {
        &self.text
    }
    pub fn style(&self) -> &RunStyle {
        &self.style
    }
    pub const fn role(&self) -> RunRole {
        self.role
    }
}
/// An owned immutable snapshot. Callers can read or consume it, never alter its runs.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct RenderedText {
    text: String,
    runs: Vec<TextRun>,
}
impl RenderedText {
    pub fn text(&self) -> &str {
        &self.text
    }
    pub fn runs(&self) -> &[TextRun] {
        &self.runs
    }
    pub fn into_text(self) -> String {
        self.text
    }
    pub(crate) fn literal(text: String, role: RunRole) -> Result<Self, DynamicError> {
        if text.len() > MAX_RENDER_BYTES || text.contains('\0') {
            return Err(DynamicError::Invalid("invalid or oversized output text"));
        }
        if text.is_empty() {
            return Ok(Self::default());
        }
        Ok(Self {
            text: text.clone(),
            runs: vec![TextRun {
                text,
                style: RunStyle::default(),
                role,
            }],
        })
    }
    pub(crate) fn append(&mut self, other: &Self) -> Result<(), DynamicError> {
        let size = self
            .text
            .len()
            .checked_add(other.text.len())
            .ok_or(DynamicError::Invalid("output size overflow"))?;
        if size > MAX_RENDER_BYTES {
            return Err(DynamicError::Invalid("output byte limit exceeded"));
        }
        self.text.push_str(&other.text);
        self.runs.extend(other.runs.iter().cloned());
        Ok(())
    }
    fn style(mut self, style: &RunStyle) -> Result<Self, DynamicError> {
        style.validate()?;
        for run in &mut self.runs {
            run.style = style.clone();
        }
        Ok(self)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum RichRun {
    Label {
        id: TextId,
        #[serde(default)]
        style: RunStyle,
    },
    Entity {
        label: EntityLabel,
        #[serde(default)]
        style: RunStyle,
    },
    Actor {
        label: ActorLabel,
        #[serde(default)]
        style: RunStyle,
    },
    Item {
        label: ItemLabel,
        #[serde(default)]
        style: RunStyle,
    },
    Quantity {
        label: Quantity,
        #[serde(default)]
        style: RunStyle,
    },
    Command {
        label: CommandRef,
        #[serde(default)]
        style: RunStyle,
    },
    ExternalName {
        name: String,
        #[serde(default)]
        style: RunStyle,
    },
    Break {},
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RichText {
    version: VersionOne,
    upstream: String,
    runs: Vec<RichRun>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum DynamicParameter {
    EntityLabel(EntityLabel),
    ActorLabel(ActorLabel),
    ItemLabel(ItemLabel),
    Quantity(Quantity),
    CommandRef(CommandRef),
    RichText(RichText),
}
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum ParameterSchema {
    EntityLabel {
        version: VersionOne,
        domain: EntityDomain,
        form: EntityForm,
    },
    ActorLabel {
        version: VersionOne,
        visibility: ActorVisibility,
        form: ActorForm,
    },
    ItemLabel {
        version: VersionOne,
        visibility: ItemVisibility,
        form: ItemForm,
    },
    Quantity {
        version: VersionOne,
    },
    CommandRef {
        version: VersionOne,
        command: TextId,
        binding: BindingOrigin,
    },
    RichText {
        version: VersionOne,
    },
}
pub trait LabelResolver {
    fn label(&self, id: &str) -> Result<String, DynamicError>;
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DynamicError {
    Invalid(&'static str),
}
impl fmt::Display for DynamicError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Invalid(reason) => formatter.write_str(reason),
        }
    }
}
impl std::error::Error for DynamicError {}

fn source(upstream: &str) -> Result<(), DynamicError> {
    if upstream != crate::UPSTREAM_COMMIT {
        return Err(DynamicError::Invalid("dynamic text source mismatch"));
    }
    Ok(())
}
fn external_name(name: &str) -> Result<(), DynamicError> {
    if name.is_empty() || name.len() > MAX_EXTERNAL_BYTES || name.chars().any(char::is_control) {
        return Err(DynamicError::Invalid("invalid external name"));
    }
    Ok(())
}
fn registry() -> Result<Value, DynamicError> {
    let value: Value = serde_json::from_str(include_str!("../../locales/dynamic/source-map.json"))
        .map_err(|_| DynamicError::Invalid("dynamic registry malformed"))?;
    if value["schema_version"] != 1 || value["commit"] != crate::UPSTREAM_COMMIT {
        return Err(DynamicError::Invalid("dynamic registry source mismatch"));
    }
    Ok(value)
}
fn records<'a>(value: &'a Value, name: &str) -> Result<&'a [Value], DynamicError> {
    value[name]
        .as_array()
        .map(Vec::as_slice)
        .ok_or(DynamicError::Invalid("source registry records unavailable"))
}
fn registered_entity(label: &EntityLabel) -> Result<(), DynamicError> {
    source(&label.upstream)?;
    let map: Value = serde_json::from_str(include_str!("../../locales/entities/source-map.json"))
        .map_err(|_| DynamicError::Invalid("entity registry malformed"))?;
    if map["commit"] != crate::UPSTREAM_COMMIT {
        return Err(DynamicError::Invalid("entity registry source mismatch"));
    }
    let domain = match label.domain {
        EntityDomain::Species => "species",
        EntityDomain::Job => "job",
    };
    if !records(&map, "records")?
        .iter()
        .any(|record| record["kind"] == domain && record["name_id"] == label.id.as_str())
    {
        return Err(DynamicError::Invalid("unregistered entity name/domain"));
    }
    Ok(())
}
fn entity(
    label: &EntityLabel,
    resolver: &impl LabelResolver,
) -> Result<RenderedText, DynamicError> {
    registered_entity(label)?;
    RenderedText::literal(resolver.label(label.id.as_str())?, RunRole::EntityLabel)
}
fn registered_monster(id: &TextId) -> Result<(), DynamicError> {
    let map: Value = serde_json::from_str(include_str!(
        "../../locales/entities/monsters-source-map.json"
    ))
    .map_err(|_| DynamicError::Invalid("actor registry malformed"))?;
    if map["commit"] != crate::UPSTREAM_COMMIT {
        return Err(DynamicError::Invalid("actor registry source mismatch"));
    }
    if !records(&map, "records")?.iter().any(|record| {
        record["name_id"] == id.as_str() && record["naming_policy"] == "base_name_only"
    }) {
        return Err(DynamicError::Invalid(
            "unregistered plain actor base identity",
        ));
    }
    Ok(())
}
fn actor(label: &ActorLabel, resolver: &impl LabelResolver) -> Result<RenderedText, DynamicError> {
    source(&label.upstream)?;
    if let ActorIdentity::External { name } = &label.identity {
        if label.form != ActorForm::Name {
            return Err(DynamicError::Invalid(
                "external names require literal name form",
            ));
        }
        external_name(name)?;
        return RenderedText::literal(name.clone(), RunRole::ExternalName);
    }
    if let ActorIdentity::Seen { base_id, .. } = &label.identity {
        registered_monster(base_id)?;
    }
    let id = match label.form {
        ActorForm::Name => match &label.identity {
            ActorIdentity::Unseen {} => "monster.naming.unobserved.name".to_owned(),
            ActorIdentity::Player {} => "dynamic.actor.player.subject".to_owned(),
            ActorIdentity::Seen { base_id, .. } => base_id.as_str().to_owned(),
            ActorIdentity::External { .. } => {
                return Err(DynamicError::Invalid("external form mismatch"));
            }
        },
        ActorForm::PossessiveName => match &label.identity {
            ActorIdentity::Unseen {} => "monster.naming.unobserved_possessive.name".to_owned(),
            ActorIdentity::Player {} => "dynamic.actor.player.possessive".to_owned(),
            _ => {
                return Err(DynamicError::Invalid(
                    "possessive actor base form is not registered",
                ));
            }
        },
        form => {
            let gender = match &label.identity {
                ActorIdentity::Unseen {} => PronounGender::Neuter,
                ActorIdentity::Player {} => PronounGender::Player,
                ActorIdentity::Seen { gender, .. } => *gender,
                ActorIdentity::External { .. } => {
                    return Err(DynamicError::Invalid("external pronoun forbidden"));
                }
            };
            let group = match gender {
                PronounGender::Neuter => "neuter",
                PronounGender::Masculine => "masculine",
                PronounGender::Feminine => "feminine",
                PronounGender::Player => "player",
                PronounGender::Plural => "plural",
            };
            let suffix = match form {
                ActorForm::Subject => "subject",
                ActorForm::PossessivePronoun => "possessive",
                ActorForm::Reflexive => "reflexive",
                ActorForm::Object => "object",
                _ => return Err(DynamicError::Invalid("actor grammar mismatch")),
            };
            format!("dynamic.actor.{group}.{suffix}")
        }
    };
    RenderedText::literal(resolver.label(&id)?, RunRole::ActorLabel)
}
fn item(label: &ItemLabel, resolver: &impl LabelResolver) -> Result<RenderedText, DynamicError> {
    source(&label.upstream)?;
    if label.count.get() == 0 {
        return Err(DynamicError::Invalid("item count must be positive"));
    }
    let id = match &label.identity {
        ItemIdentity::Base { class } => {
            if label.form != ItemForm::BaseName {
                return Err(DynamicError::Invalid(
                    "base visibility requires base-name form",
                ));
            }
            let key = match class {
                ItemClass::Wand => "wand",
                ItemClass::Potion => "potion",
                ItemClass::Scroll => "scroll",
                ItemClass::Amulet => "amulet",
                ItemClass::Ring => "ring",
            };
            // Original DESC_BASENAME explicitly suppresses stack pluralization.
            format!("dynamic.item.base.{key}.name")
        }
        ItemIdentity::Appearance { appearance_id }
        | ItemIdentity::Identified {
            identity_id: appearance_id,
        } => {
            if label.form != ItemForm::Name {
                return Err(DynamicError::Invalid(
                    "known/appearance item requires registered name form",
                ));
            }
            let map = registry()?;
            let visibility = if matches!(&label.identity, ItemIdentity::Appearance { .. }) {
                "appearance"
            } else {
                "identified"
            };
            if !records(&map, "item_forms")?.iter().any(|record| {
                record["id"] == appearance_id.as_str() && record["visibility"] == visibility
            }) {
                return Err(DynamicError::Invalid("item form is not source registered"));
            }
            appearance_id.as_str().to_owned()
        }
    };
    RenderedText::literal(resolver.label(&id)?, RunRole::ItemLabel)
}
fn quantity(label: &Quantity) -> Result<RenderedText, DynamicError> {
    source(&label.upstream)?;
    RenderedText::literal(label.value.get().to_string(), RunRole::Quantity)
}
fn command(label: &CommandRef) -> Result<RenderedText, DynamicError> {
    source(&label.upstream)?;
    if label.token.is_empty() || label.token.len() > 64 || label.token.chars().any(char::is_control)
    {
        return Err(DynamicError::Invalid("invalid command token"));
    }
    let map = registry()?;
    let record = records(&map, "commands")?
        .iter()
        .find(|record| record["id"] == label.command.as_str())
        .ok_or(DynamicError::Invalid("unregistered command identity"))?;
    let valid = match label.binding {
        BindingOrigin::FixedUi => record["fixed_token"] == label.token,
        BindingOrigin::NativeResolved => record["native_resolved"] == true,
    };
    if !valid {
        return Err(DynamicError::Invalid("command binding source mismatch"));
    }
    RenderedText::literal(label.token.clone(), RunRole::CommandToken)
}
fn rich(label: &RichText, resolver: &impl LabelResolver) -> Result<RenderedText, DynamicError> {
    source(&label.upstream)?;
    if label.runs.len() > MAX_RICH_RUNS {
        return Err(DynamicError::Invalid("too many rich text runs"));
    }
    let map = registry()?;
    let mut output = RenderedText::default();
    for run in &label.runs {
        let rendered = match run {
            RichRun::Label { id, style } => {
                if !records(&map, "rich_labels")?
                    .iter()
                    .any(|label| label == id.as_str())
                {
                    return Err(DynamicError::Invalid("rich label is not source registered"));
                }
                RenderedText::literal(resolver.label(id.as_str())?, RunRole::Literal)?
                    .style(style)?
            }
            RichRun::Entity { label, style } => entity(label, resolver)?.style(style)?,
            RichRun::Actor { label, style } => actor(label, resolver)?.style(style)?,
            RichRun::Item { label, style } => item(label, resolver)?.style(style)?,
            RichRun::Quantity { label, style } => quantity(label)?.style(style)?,
            RichRun::Command { label, style } => command(label)?.style(style)?,
            RichRun::ExternalName { name, style } => {
                external_name(name)?;
                RenderedText::literal(name.clone(), RunRole::ExternalName)?.style(style)?
            }
            RichRun::Break {} => RenderedText::literal("\n".into(), RunRole::LineBreak)?,
        };
        output.append(&rendered)?;
    }
    Ok(output)
}
impl ParameterSchema {
    pub const fn is_quantity(&self) -> bool {
        matches!(self, Self::Quantity { .. })
    }
    /// Validate shape, source, role and information boundary before producing owned runs.
    ///
    /// # Errors
    /// Reports a static reason; hidden item/actor identities are never echoed.
    pub fn render(
        &self,
        value: &Value,
        _language: Language,
        resolver: &impl LabelResolver,
    ) -> Result<RenderedText, DynamicError> {
        let parameter: DynamicParameter = serde_json::from_value(value.clone())
            .map_err(|_| DynamicError::Invalid("dynamic descriptor shape/version invalid"))?;
        match (self, parameter) {
            (Self::EntityLabel { domain, form, .. }, DynamicParameter::EntityLabel(label))
                if *domain == label.domain && *form == label.form =>
            {
                entity(&label, resolver)
            }
            (
                Self::ActorLabel {
                    visibility, form, ..
                },
                DynamicParameter::ActorLabel(label),
            ) if *visibility == label.identity.visibility() && *form == label.form => {
                actor(&label, resolver)
            }
            (
                Self::ItemLabel {
                    visibility, form, ..
                },
                DynamicParameter::ItemLabel(label),
            ) if *visibility == label.identity.visibility() && *form == label.form => {
                item(&label, resolver)
            }
            (Self::Quantity { .. }, DynamicParameter::Quantity(label)) => quantity(&label),
            (
                Self::CommandRef {
                    command: expected,
                    binding,
                    ..
                },
                DynamicParameter::CommandRef(label),
            ) if expected == &label.command && *binding == label.binding => command(&label),
            (Self::RichText { .. }, DynamicParameter::RichText(label)) => rich(&label, resolver),
            _ => Err(DynamicError::Invalid(
                "dynamic descriptor role/domain/form mismatch",
            )),
        }
    }
    /// # Errors
    /// Rejects non-quantity descriptors, source mismatch or noncanonical counts.
    pub fn quantity_one(&self, value: &Value) -> Result<bool, DynamicError> {
        if !self.is_quantity() {
            return Err(DynamicError::Invalid("quantity schema required"));
        }
        let DynamicParameter::Quantity(label) =
            serde_json::from_value::<DynamicParameter>(value.clone())
                .map_err(|_| DynamicError::Invalid("quantity descriptor shape/version invalid"))?
        else {
            return Err(DynamicError::Invalid("quantity descriptor required"));
        };
        source(&label.upstream)?;
        Ok(label.value.get() == 1)
    }
}

#[cfg(test)]
pub(crate) fn test_parameter(_id: &str, name: &str) -> Value {
    use serde_json::json;
    match name {
        "species" => {
            json!({"kind":"entity_label","version":1,"upstream":crate::UPSTREAM_COMMIT,"domain":"species","id":"species.sp_human.name","form":"name"})
        }
        "job" => {
            json!({"kind":"entity_label","version":1,"upstream":crate::UPSTREAM_COMMIT,"domain":"job","id":"job.job_fighter.name","form":"name"})
        }
        "player_name" => {
            json!({"kind":"actor_label","version":1,"upstream":crate::UPSTREAM_COMMIT,"form":"name","identity":{"visibility":"external","name":"境界のAlice{job}"}})
        }
        "quantity" => {
            json!({"kind":"quantity","version":1,"upstream":crate::UPSTREAM_COMMIT,"value":"18446744073709551615"})
        }
        "item" => {
            json!({"kind":"item_label","version":1,"upstream":crate::UPSTREAM_COMMIT,"identity":{"visibility":"base","class":"potion"},"form":"base_name","count":"2"})
        }
        "command" => {
            json!({"kind":"command_ref","version":1,"upstream":crate::UPSTREAM_COMMIT,"command":"command.display_spells","binding":"native_resolved","token":"Ctrl+P"})
        }
        "content" => {
            json!({"kind":"rich_text","version":1,"upstream":crate::UPSTREAM_COMMIT,"runs":[{"kind":"external_name","name":"名前{species}<red>"}]})
        }
        _ => panic!("unreviewed dynamic test parameter"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::display::{Catalog, Message};
    use serde_json::json;

    fn header(kind: &str) -> Value {
        json!({"kind":kind,"version":1,"upstream":crate::UPSTREAM_COMMIT})
    }
    fn descriptor(kind: &str, fields: Value) -> Value {
        let mut value = header(kind);
        for (name, field) in fields.as_object().expect("fixture object") {
            value[name] = field.clone();
        }
        value
    }
    fn schema(kind: &str, fields: Value) -> Value {
        let mut value = json!({"kind":kind,"version":1});
        for (name, field) in fields.as_object().expect("fixture schema") {
            value[name] = field.clone();
        }
        value
    }
    fn custom(language: Language, parameter: Value) -> Catalog {
        let mut catalog: Value = serde_json::from_str(match language {
            Language::En => include_str!("../../locales/dynamic/en.json"),
            Language::Ja => include_str!("../../locales/dynamic/ja.json"),
        })
        .expect("reviewed labels");
        catalog["test.value"] = json!({"text":"{value}","params":{"value":parameter}});
        // Exact source-grounded plain orc base is available only in this bounded fixture.
        catalog["monster.mons_orc.name"] = json!(if language == Language::En {
            "orc"
        } else {
            "オーク"
        });
        Catalog::from_json(language, &catalog.to_string()).expect("fixture catalog")
    }
    fn render(
        catalog: &Catalog,
        value: Value,
    ) -> Result<RenderedText, crate::display::DisplayError> {
        catalog.render_runs(&Message::new("test.value").expect("id").with("value", value))
    }

    #[test]
    fn genuine_species_job_welcome_render_through_catalog_and_keep_external_literal() {
        let name = "愛{species}<color=red>";
        for (language, species, job) in [
            (Language::En, "Human", "Fighter"),
            (Language::Ja, "人間", "戦士"),
        ] {
            let catalog = Catalog::embedded(language).expect("embedded");
            let species_message = Message::new("startup.dynamic.species_name")
                .expect("id")
                .with("species", test_parameter("", "species"));
            let rendered = catalog.render_runs(&species_message).expect("source name");
            assert_eq!(rendered.text(), species);
            assert_eq!(rendered.runs()[0].role(), RunRole::EntityLabel);
            let job_message = Message::new("startup.dynamic.job_name")
                .expect("id")
                .with("job", test_parameter("", "job"));
            assert_eq!(catalog.render(&job_message).expect("job"), job);
            let message = Message::new("startup.dynamic.welcome.named_species_job")
                .expect("id")
                .with("species", test_parameter("", "species"))
                .with("job", test_parameter("", "job"))
                .with(
                    "player_name",
                    descriptor(
                        "actor_label",
                        json!({"form":"name","identity":{"visibility":"external","name":name}}),
                    ),
                );
            let before = serde_json::to_string(&message).expect("message");
            let first = catalog.render_runs(&message).expect("welcome");
            assert!(first.text().contains(name));
            assert_eq!(
                first
                    .runs()
                    .iter()
                    .filter(|run| run.role() == RunRole::ExternalName)
                    .count(),
                1
            );
            assert!(first.runs().iter().any(|run| run.text() == name));
            for _ in 0..50 {
                assert_eq!(catalog.render_runs(&message).expect("repeat"), first);
            }
            assert_eq!(serde_json::to_string(&message).expect("after"), before);
        }
    }
    #[test]
    fn all_eight_welcome_states_and_article_choice_are_real_typed_catalog_entries() {
        for language in [Language::En, Language::Ja] {
            let catalog = Catalog::embedded(language).expect("embedded");
            for variant in [
                "empty",
                "named_only",
                "named_job",
                "named_species",
                "named_species_job",
                "unnamed_job",
                "unnamed_species",
                "unnamed_species_job",
            ] {
                let mut message =
                    Message::new(format!("startup.dynamic.welcome.{variant}")).expect("id");
                if variant.contains("species") {
                    message = message.with("species", test_parameter("", "species"));
                }
                if variant.contains("job") {
                    message = message.with("job", test_parameter("", "job"));
                }
                if variant.starts_with("named_") {
                    message = message.with("player_name", test_parameter("", "player_name"));
                }
                assert!(!catalog.render(&message).expect("branch").is_empty());
            }
            for article in ["a", "an"] {
                let message = Message::new(format!("startup.dynamic.character.{article}"))
                    .expect("id")
                    .with("species", test_parameter("", "species"))
                    .with("job", test_parameter("", "job"));
                let text = catalog.render(&message).expect("article branch");
                if language == Language::En {
                    assert!(text.starts_with(&format!("You are {article} ")));
                }
            }
        }
    }
    #[test]
    fn entity_role_version_source_identity_and_surplus_are_rejected() {
        let catalog = Catalog::embedded(Language::Ja).expect("embedded");
        let good = test_parameter("", "species");
        for (key, bad) in [
            ("domain", json!("job")),
            ("version", json!(2)),
            ("upstream", json!("wrong")),
            ("id", json!("species.sp_human.abbrev")),
            ("id", json!("species.sp_unknown.name")),
            ("form", json!("abbrev")),
            ("extra", json!(true)),
        ] {
            let mut value = good.clone();
            value[key] = bad;
            assert!(
                catalog
                    .render(
                        &Message::new("startup.dynamic.species_name")
                            .expect("id")
                            .with("species", value)
                    )
                    .is_err(),
                "field {key}"
            );
        }
        assert!(
            catalog
                .render(
                    &Message::new("startup.dynamic.species_name")
                        .expect("id")
                        .with("species", "Human")
                )
                .is_err()
        );
    }
    #[test]
    fn recursively_duplicate_descriptor_keys_cannot_be_erased_by_value_deserialization() {
        for params in [
            r#"{"species":{"kind":"entity_label","kind":"entity_label","version":1}}"#,
            r#"{"species":{"identity":{"visibility":"external","name":"a","name":"b"}}}"#,
            r#"{"species":1,"species":2}"#,
        ] {
            let text = format!(r#"{{"id":"startup.dynamic.species_name","params":{params}}}"#);
            assert!(serde_json::from_str::<Message>(&text).is_err());
        }
    }
    #[test]
    fn decimal_quantity_supports_full_u64_and_explicit_bilingual_plural_rules() {
        let quantity_schema = schema("quantity", json!({}));
        for language in [Language::En, Language::Ja] {
            let catalog=Catalog::from_json(language,&json!({"test.quantity":{"one":"{n} item","other":"{n} items","params":{"n":quantity_schema}}}).to_string()).expect("plural");
            for count in [0, 1, 2, u64::MAX] {
                let value = descriptor("quantity", json!({"value":count.to_string()}));
                let text = catalog
                    .render(&Message::new("test.quantity").expect("id").with("n", value))
                    .expect("quantity");
                assert_eq!(
                    text,
                    format!(
                        "{count} {}",
                        if language == Language::En && count == 1 {
                            "item"
                        } else {
                            "items"
                        }
                    )
                );
            }
        }
        let catalog = custom(Language::En, quantity_schema);
        for invalid in [
            json!(1),
            json!("01"),
            json!("-1"),
            json!("+1"),
            json!("1.0"),
            json!("18446744073709551616"),
            json!(""),
        ] {
            assert!(render(&catalog, descriptor("quantity", json!({"value":invalid}))).is_err());
        }
        let maximum = DecimalU64::new(u64::MAX);
        assert_eq!(
            serde_json::to_string(&maximum).expect("serialize"),
            "\"18446744073709551615\""
        );
        assert_eq!(
            serde_json::from_str::<DecimalU64>("\"18446744073709551615\"").expect("restore"),
            maximum
        );
    }
    #[test]
    fn base_item_count_preserves_original_singular_without_hidden_identity_fields() {
        let item_schema = schema(
            "item_label",
            json!({"visibility":"base","form":"base_name"}),
        );
        for (language, expected) in [
            (Language::En, ["wand", "potion", "scroll", "amulet", "ring"]),
            (Language::Ja, ["ワンド", "薬", "巻物", "護符", "指輪"]),
        ] {
            let catalog = custom(language, item_schema.clone());
            for (class, name) in ["wand", "potion", "scroll", "amulet", "ring"]
                .into_iter()
                .zip(expected)
            {
                for count in [1, 2, u64::MAX] {
                    let value = descriptor(
                        "item_label",
                        json!({"identity":{"visibility":"base","class":class},"form":"base_name","count":count.to_string()}),
                    );
                    assert_eq!(render(&catalog, value).expect("base").text(), name);
                }
            }
            let mut bad = descriptor(
                "item_label",
                json!({"identity":{"visibility":"base","class":"potion","subtype":"healing"},"form":"base_name","count":"1"}),
            );
            assert!(render(&catalog, bad.clone()).is_err());
            bad["identity"]
                .as_object_mut()
                .expect("identity")
                .remove("subtype");
            bad["count"] = json!("0");
            assert!(render(&catalog, bad).is_err());
        }
    }
    #[test]
    fn unknown_item_visibility_never_accepts_true_identity_or_reveals_it_in_errors() {
        let catalog = custom(
            Language::En,
            schema(
                "item_label",
                json!({"visibility":"appearance","form":"name"}),
            ),
        );
        let secret = "item.secret_cure.name";
        for identity in [
            json!({"visibility":"appearance","appearance_id":"item.appearance.red.name","identity_id":secret}),
            json!({"visibility":"appearance","appearance_id":secret}),
            json!({"visibility":"identified","identity_id":secret}),
        ] {
            let error = render(
                &catalog,
                descriptor(
                    "item_label",
                    json!({"identity":identity,"form":"name","count":"1"}),
                ),
            )
            .expect_err("unregistered")
            .to_string();
            assert!(!error.contains(secret));
        }
    }
    #[test]
    fn unseen_actor_forces_source_generic_and_neuter_forms_with_no_hidden_fields() {
        for (language, name, subject) in [
            (Language::En, "something", "it"),
            (Language::Ja, "何か", "それ"),
        ] {
            let catalog = custom(
                language,
                schema("actor_label", json!({"visibility":"unseen","form":"name"})),
            );
            assert_eq!(
                render(
                    &catalog,
                    descriptor(
                        "actor_label",
                        json!({"form":"name","identity":{"visibility":"unseen"}})
                    )
                )
                .expect("generic")
                .text(),
                name
            );
            let subject_catalog = custom(
                language,
                schema(
                    "actor_label",
                    json!({"visibility":"unseen","form":"subject"}),
                ),
            );
            assert_eq!(
                render(
                    &subject_catalog,
                    descriptor(
                        "actor_label",
                        json!({"form":"subject","identity":{"visibility":"unseen"}})
                    )
                )
                .expect("neuter")
                .text(),
                subject
            );
            for extra in [
                json!({"visibility":"unseen","base_id":"monster.mons_orc.name"}),
                json!({"visibility":"unseen","gender":"masculine"}),
            ] {
                assert!(
                    render(
                        &catalog,
                        descriptor("actor_label", json!({"form":"name","identity":extra}))
                    )
                    .is_err()
                );
            }
        }
    }
    #[test]
    fn visible_actor_pronouns_are_explicit_and_protected_identities_stay_unregistered() {
        let catalog = custom(
            Language::En,
            schema(
                "actor_label",
                json!({"visibility":"seen","form":"reflexive"}),
            ),
        );
        let value = descriptor(
            "actor_label",
            json!({"form":"reflexive","identity":{"visibility":"seen","base_id":"monster.mons_orc.name","gender":"plural"}}),
        );
        assert_eq!(
            render(&catalog, value.clone()).expect("plural").text(),
            "themself"
        );
        for id in [
            "monster.mons_player_ghost.name",
            "monster.mons_player_illusion.name",
            "monster.mons_pandemonium_lord.name",
            "monster.mons_player.name",
        ] {
            let mut bad = value.clone();
            bad["identity"]["base_id"] = json!(id);
            assert!(render(&catalog, bad).is_err());
        }
    }
    #[test]
    fn external_names_are_literal_bounded_and_cannot_request_pronouns() {
        let catalog = custom(
            Language::Ja,
            schema(
                "actor_label",
                json!({"visibility":"external","form":"name"}),
            ),
        );
        let name = "Alice{value}<red>あ";
        assert_eq!(
            render(
                &catalog,
                descriptor(
                    "actor_label",
                    json!({"form":"name","identity":{"visibility":"external","name":name}})
                )
            )
            .expect("literal")
            .text(),
            name
        );
        for name in [
            "".to_owned(),
            "a\0b".into(),
            "a\nb".into(),
            "x".repeat(MAX_EXTERNAL_BYTES + 1),
        ] {
            assert!(ActorLabel::external(name).is_err());
        }
        let pronoun = custom(
            Language::En,
            schema(
                "actor_label",
                json!({"visibility":"external","form":"subject"}),
            ),
        );
        assert!(
            render(
                &pronoun,
                descriptor(
                    "actor_label",
                    json!({"form":"subject","identity":{"visibility":"external","name":"Alice"}})
                )
            )
            .is_err()
        );
    }
    #[test]
    fn actual_native_command_binding_is_preserved_without_using_default_english_key() {
        let parameter = schema(
            "command_ref",
            json!({"command":"command.display_spells","binding":"native_resolved"}),
        );
        for language in [Language::En, Language::Ja] {
            let catalog = custom(language, parameter.clone());
            for token in ["I", "Ctrl+P", "あ"] {
                let value = descriptor(
                    "command_ref",
                    json!({"command":"command.display_spells","binding":"native_resolved","token":token}),
                );
                assert_eq!(render(&catalog, value).expect("binding").text(), token);
            }
            for token in ["", "\n", "\0"] {
                assert!(render(&catalog,descriptor("command_ref",json!({"command":"command.display_spells","binding":"native_resolved","token":token}))).is_err());
            }
        }
        let fixed = custom(
            Language::En,
            schema(
                "command_ref",
                json!({"command":"key.enter","binding":"fixed_ui"}),
            ),
        );
        // A physical control enum alone does not authorize its display-token spelling.
        // Fixed UI bindings remain unavailable until an exact display source is registered.
        assert!(
            render(
                &fixed,
                descriptor(
                    "command_ref",
                    json!({"command":"key.enter","binding":"fixed_ui","token":"Enter"})
                )
            )
            .is_err()
        );
        assert!(
            render(
                &fixed,
                descriptor(
                    "command_ref",
                    json!({"command":"key.enter","binding":"fixed_ui","token":"Return"})
                )
            )
            .is_err()
        );
    }
    #[test]
    fn rich_runs_are_owned_source_bound_typed_and_palette_limited() {
        let catalog = custom(Language::En, schema("rich_text", json!({})));
        let runs = json!([
            {"kind":"label","id":"dynamic.actor.player.subject","style":{"colour":2,"emphasis":true}},
            {"kind":"break"},
            {"kind":"external_name","name":"外{n}<red>"},
            {"kind":"quantity","label":{"version":1,"upstream":crate::UPSTREAM_COMMIT,"value":"18446744073709551615"}},
            {"kind":"command","label":{"version":1,"upstream":crate::UPSTREAM_COMMIT,"command":"command.display_spells","binding":"native_resolved","token":"Ctrl+P"}}
        ]);
        let value = descriptor("rich_text", json!({"runs":runs}));
        let before = value.to_string();
        let result = render(&catalog, value.clone()).expect("rich");
        assert_eq!(result.text(), "you\n外{n}<red>18446744073709551615Ctrl+P");
        assert_eq!(result.runs().len(), 5);
        assert_eq!(result.runs()[0].style().colour, Some(2));
        assert_eq!(result.runs()[2].role(), RunRole::ExternalName);
        assert_eq!(result.runs()[3].role(), RunRole::Quantity);
        assert_eq!(result.runs()[4].role(), RunRole::CommandToken);
        for _ in 0..50 {
            assert_eq!(render(&catalog, value.clone()).expect("repeat"), result);
        }
        assert_eq!(value.to_string(), before);
        for runs in [
            json!([{"kind":"literal","text":"English fallback"}]),
            json!([{"kind":"label","id":"dynamic.actor.player.subject","style":{"colour":16}}]),
            json!([{"kind":"label","id":"unregistered.label"}]),
            json!((0..65).map(|_| json!({"kind":"break"})).collect::<Vec<_>>()),
        ] {
            assert!(render(&catalog, descriptor("rich_text", json!({"runs":runs}))).is_err());
        }
    }
    #[test]
    fn internally_tagged_empty_variants_reject_surplus_without_erasing_evidence() {
        for visibility in ["player", "unseen"] {
            let catalog = custom(
                Language::En,
                schema(
                    "actor_label",
                    json!({"visibility":visibility,"form":"subject"}),
                ),
            );
            let good = descriptor(
                "actor_label",
                json!({"form":"subject","identity":{"visibility":visibility}}),
            );
            assert_eq!(
                render(&catalog, good.clone())
                    .expect("strict empty identity")
                    .text(),
                if visibility == "player" { "you" } else { "it" }
            );
            for (field, hidden) in [
                ("base_id", json!("monster.mons_orc.name")),
                ("gender", json!("masculine")),
                ("name", json!("secret_actor")),
                ("extra", json!(true)),
            ] {
                let mut bad = good.clone();
                bad["identity"][field] = hidden;
                let error = render(&catalog, bad)
                    .expect_err("surplus identity rejected")
                    .to_string();
                assert!(!error.contains("secret_actor"));
            }
        }
        let rich_catalog = custom(Language::En, schema("rich_text", json!({})));
        let good = descriptor("rich_text", json!({"runs":[{"kind":"break"}]}));
        assert_eq!(
            render(&rich_catalog, good.clone())
                .expect("strict line break")
                .text(),
            "\n"
        );
        for (field, surplus) in [
            ("text", json!("secret_line")),
            ("label", json!({"name":"secret_line"})),
            ("style", json!({})),
            ("extra", json!(true)),
        ] {
            let mut bad = good.clone();
            bad["runs"][0][field] = surplus;
            let error = render(&rich_catalog, bad)
                .expect_err("surplus break rejected")
                .to_string();
            assert!(!error.contains("secret_line"));
        }
    }

    #[test]
    fn output_bound_is_checked_without_partial_success() {
        let catalog = custom(Language::En, schema("rich_text", json!({})));
        let runs = (0..64)
            .map(|_| json!({"kind":"external_name","name":"x".repeat(1024)}))
            .chain(std::iter::once(json!({"kind":"break"})))
            .collect::<Vec<_>>();
        assert!(render(&catalog, descriptor("rich_text", json!({"runs":runs}))).is_err());
        let mut text =
            RenderedText::literal("x".repeat(MAX_RENDER_BYTES), RunRole::Literal).expect("limit");
        assert!(
            text.append(&RenderedText::literal("x".into(), RunRole::Literal).expect("one"))
                .is_err()
        );
        assert_eq!(text.text().len(), MAX_RENDER_BYTES);
    }
}

#[cfg(test)]
#[path = "dynamic_text_requests.rs"]
mod actual_request_tests;
