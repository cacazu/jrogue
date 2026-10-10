//! Typed template foundation for source integration of reviewed messages.
//! Source integration does not validate or replace the current browser build.
//! IDs/schemas follow migration/commands-text.json, grounded in cmd-cave.c
//! and cmd-pickup.c. Templates are read from that reviewed manifest in tests.
//! Descriptor identity, grammar, knowledge, and localized naming are resolved
//! separately; completed English descriptions are never generic string inputs.

use crate::text::Locale;
use std::fmt;

pub const MAX_PARAMETERS: usize = 16;
pub const MAX_TEMPLATE_BYTES: usize = 8192;
pub const MAX_VALUE_BYTES: usize = 8192;
pub const MAX_OUTPUT_BYTES: usize = 32768;
pub const MAX_PLACEHOLDER_USES: usize = 128;

/// Descriptor classes have distinct identity/grammar resolution policies.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DescriptorKind {
    ApparentTerrain, TerrainDiagnosticReference, TrapName, MonsterDescription, CapitalizedMonsterDescription,
    KnownObjectDescription, MonsterAggregateSubject, DomainCustomVerbSuffix, DomainCustomCopula, KnowledgeSection, EffectDescription,
    MoneyKindName, DiggingMethod, ObjectFeeling,
    MonsterFeeling, FeelingConjunction, GoldPickupMessage,
    LocalizedText, LocalizedTextList, GeneratedHistory, UnsupportedReviewedType,
}

/// Exactly the three existing C digging branches, without English-string tests.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DiggingMethod { Hands, Weapon, SwapDigger }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FeelingConjunction { Yet, And }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GoldPickupReference {
    SingleKind { gold_amount: i32, money_kind_id: u32 },
    MixedKinds { gold_amount: i32 },
}

/// Disclosed identity or an owned immutable snapshot handle, never English.
/// Monster/object handles must refer to captures of the original observer,
/// visibility, knowledge, exact description flags, and external inscription.
/// They are not live entity IDs or C pointers.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DescriptorReference {
    ApparentTerrain { apparent_feature_id: u32 },
    TerrainDiagnosticNamed { actual_feature_id: u32 },
    TerrainDiagnosticIndex { terrain_index: i32 },
    TrapName { kind_id: u32 },
    MonsterDescription { snapshot_id: u32 },
    CapitalizedMonsterDescription { snapshot_id: u32 },
    KnownObjectDescription { snapshot_id: u32 },
    MonsterAggregateSubject { snapshot_id: u32 },
    DomainCustomVerbSuffix { has_object: bool, number: u8 },
    DomainCustomCopula { has_object: bool, number: u8 },
    KnowledgeSection { part_count: u16 },
    EffectDescription { part_count: u16 },
    MoneyKindName { kind_id: u32 },
    DiggingMethod(DiggingMethod),
    ObjectFeeling { index: u32 },
    MonsterFeeling { index: u32 },
    FeelingConjunction(FeelingConjunction),
    GoldPickupMessage(GoldPickupReference),
    ReviewedCatalog { catalog_index: u32 },
    ReviewedList { first_catalog_index: u32, count: u32 },
    GeneratedHistory { start_chart: u16, choice_count: u16 },
}
impl DescriptorReference {
    #[must_use]
    pub const fn kind(self) -> DescriptorKind {
        match self {
            Self::ApparentTerrain { .. } => DescriptorKind::ApparentTerrain,
            Self::TerrainDiagnosticNamed { .. } | Self::TerrainDiagnosticIndex { .. } => DescriptorKind::TerrainDiagnosticReference,
            Self::TrapName { .. } => DescriptorKind::TrapName,
            Self::MonsterDescription { .. } => DescriptorKind::MonsterDescription,
            Self::CapitalizedMonsterDescription { .. } => DescriptorKind::CapitalizedMonsterDescription,
            Self::KnownObjectDescription { .. } => DescriptorKind::KnownObjectDescription,
            Self::MonsterAggregateSubject { .. } => DescriptorKind::MonsterAggregateSubject,
            Self::DomainCustomVerbSuffix { .. } => DescriptorKind::DomainCustomVerbSuffix,
            Self::DomainCustomCopula { .. } => DescriptorKind::DomainCustomCopula,
            Self::KnowledgeSection { .. } => DescriptorKind::KnowledgeSection,
            Self::EffectDescription { .. } => DescriptorKind::EffectDescription,
            Self::MoneyKindName { .. } => DescriptorKind::MoneyKindName,
            Self::DiggingMethod(_) => DescriptorKind::DiggingMethod,
            Self::ObjectFeeling { .. } => DescriptorKind::ObjectFeeling,
            Self::MonsterFeeling { .. } => DescriptorKind::MonsterFeeling,
            Self::FeelingConjunction(_) => DescriptorKind::FeelingConjunction,
            Self::GoldPickupMessage(_) => DescriptorKind::GoldPickupMessage,
            Self::ReviewedCatalog { .. } => DescriptorKind::LocalizedText,
            Self::ReviewedList { .. } => DescriptorKind::LocalizedTextList,
            Self::GeneratedHistory { .. } => DescriptorKind::GeneratedHistory,
        }
    }
}

/// A typed localized string whose constructor is available only inside Rust.
/// The future C FFI must resolve a DescriptorReference, never construct this
/// value from a supplied formatted-English string.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ResolvedDescriptor<'a> {
    reference: DescriptorReference,
    locale: Locale,
    text: &'a str,
}
impl<'a> ResolvedDescriptor<'a> {
    /// Only reviewed localized descriptor resolvers may call this constructor.
    /// Locale strings must preserve original C visibility/knowledge/grammar.
    pub(crate) const fn from_catalog(reference: DescriptorReference, locale: Locale, text: &'a str) -> Self {
        Self { reference, locale, text }
    }
    #[must_use]
    pub const fn reference(self) -> DescriptorReference { self.reference }
    #[must_use]
    pub const fn as_str(self) -> &'a str { self.text }
}

/// Separate typed resolution boundary. Implementations use immutable domain
/// snapshots and locale catalogs; they must neither advance RNG nor reveal
/// unknown monster/object information. The localization adapter implements only
/// reviewed catalog/enum/composition cases; full monster/object grammar is open.
pub trait DescriptorResolver {
    fn resolve(&self, reference: DescriptorReference, locale: Locale) -> Result<ResolvedDescriptor<'_>, FormatError>;
}

/// Underlying printable values remain UTF-8 strings or signed integers.
/// Descriptor is a typed string category; bool/float/printf conversions are absent.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ParameterKind {
    Text, Integer, Integer32, SignedInteger, DecimalOnePlace,
    IntegerPadded2, IntegerPadded3,
    Descriptor(DescriptorKind),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ParameterSpec<'a> { pub name: &'a str, pub kind: ParameterKind }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ParameterValue<'a> {
    /// Opaque external text such as a user name, never localized or reparsed.
    Text(&'a str),
    Integer(i64),
    Descriptor(ResolvedDescriptor<'a>),
}
impl ParameterValue<'_> {
    fn kind(self) -> ParameterKind {
        match self {
            Self::Text(_) => ParameterKind::Text,
            Self::Integer(_) => ParameterKind::Integer,
            Self::Descriptor(value) => ParameterKind::Descriptor(value.reference.kind()),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Parameter<'a> { pub name: &'a str, pub value: ParameterValue<'a> }

/// Explicit source/catalog/argument errors; formatting never silently falls back.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum FormatError {
    UnknownId(String),
    InvalidName(String),
    DuplicateSchema(String),
    UnknownPlaceholder(String),
    MissingPlaceholder(String),
    MalformedTemplate { byte_offset: usize },
    MissingParameter(String),
    UnexpectedParameter(String),
    DuplicateParameter(String),
    WrongType { name: String, expected: ParameterKind, actual: ParameterKind },
    IntegerOutOfRange { name: String, value: i64 },
    DescriptorUnavailable(DescriptorReference),
    DescriptorLocale { name: String, expected: Locale, actual: Locale },
    TooManyParameters,
    TooManyPlaceholderUses,
    TemplateTooLong,
    ValueTooLong(String),
    OutputTooLong,
}
impl fmt::Display for FormatError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownId(id) => write!(f, "unknown semantic text ID: {id}"),
            Self::InvalidName(name) => write!(f, "invalid parameter name: {name}"),
            Self::DuplicateSchema(name) => write!(f, "duplicate parameter schema: {name}"),
            Self::UnknownPlaceholder(name) => write!(f, "undeclared template placeholder: {name}"),
            Self::MissingPlaceholder(name) => write!(f, "required placeholder missing from template: {name}"),
            Self::MalformedTemplate { byte_offset } => write!(f, "malformed template brace at byte {byte_offset}"),
            Self::MissingParameter(name) => write!(f, "missing parameter: {name}"),
            Self::UnexpectedParameter(name) => write!(f, "unexpected parameter: {name}"),
            Self::DuplicateParameter(name) => write!(f, "duplicate parameter argument: {name}"),
            Self::WrongType { name, expected, actual } => write!(f, "parameter {name} requires {expected:?}, received {actual:?}"),
            Self::IntegerOutOfRange { name, value } => write!(f, "parameter {name} value {value} is outside signed int32"),
            Self::DescriptorUnavailable(reference) => write!(f, "localized descriptor unavailable: {reference:?}"),
            Self::DescriptorLocale { name, expected, actual } => write!(f, "descriptor {name} requires {expected:?}, received {actual:?}"),
            Self::TooManyParameters => f.write_str("parameter count exceeds 16"),
            Self::TooManyPlaceholderUses => f.write_str("placeholder references exceed 128"),
            Self::TemplateTooLong => f.write_str("template exceeds 8192 UTF-8 bytes"),
            Self::ValueTooLong(name) => write!(f, "parameter {name} exceeds 8192 UTF-8 bytes"),
            Self::OutputTooLong => f.write_str("formatted message exceeds 32768 UTF-8 bytes"),
        }
    }
}
impl std::error::Error for FormatError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Token<'a> { Literal(&'a str), Placeholder(&'a str) }

/// Reviewed immutable template with exact schema/placeholder SET parity.
/// Repeated references to one declared name use the same immutable value.
#[derive(Clone, Debug)]
pub struct CompiledTemplate<'a> {
    source: &'a str,
    schema: &'a [ParameterSpec<'a>],
    tokens: Vec<Token<'a>>,
}
impl<'a> CompiledTemplate<'a> {
    pub fn compile(source: &'a str, schema: &'a [ParameterSpec<'a>]) -> Result<Self, FormatError> {
        if source.len() > MAX_TEMPLATE_BYTES { return Err(FormatError::TemplateTooLong); }
        if schema.len() > MAX_PARAMETERS { return Err(FormatError::TooManyParameters); }
        for (index, spec) in schema.iter().enumerate() {
            if !valid_name(spec.name) { return Err(FormatError::InvalidName(spec.name.to_owned())); }
            if schema[..index].iter().any(|previous| previous.name == spec.name) {
                return Err(FormatError::DuplicateSchema(spec.name.to_owned()));
            }
        }
        let bytes = source.as_bytes();
        let mut cursor = 0;
        let mut literal_start = 0;
        let mut tokens = Vec::new();
        let mut references = 0;
        while cursor < bytes.len() {
            match bytes[cursor] {
                b'{' | b'}' if bytes.get(cursor + 1) == Some(&bytes[cursor]) => {
                    if literal_start < cursor { tokens.push(Token::Literal(&source[literal_start..cursor])); }
                    tokens.push(Token::Literal(if bytes[cursor] == b'{' { "{" } else { "}" }));
                    cursor += 2;
                    literal_start = cursor;
                }
                b'{' => {
                    if literal_start < cursor { tokens.push(Token::Literal(&source[literal_start..cursor])); }
                    let end = source[cursor + 1..].find('}').map(|offset| cursor + 1 + offset)
                        .ok_or(FormatError::MalformedTemplate { byte_offset: cursor })?;
                    let name = &source[cursor + 1..end];
                    if !valid_name(name) { return Err(FormatError::InvalidName(name.to_owned())); }
                    if !schema.iter().any(|spec| spec.name == name) {
                        return Err(FormatError::UnknownPlaceholder(name.to_owned()));
                    }
                    references += 1;
                    if references > MAX_PLACEHOLDER_USES { return Err(FormatError::TooManyPlaceholderUses); }
                    tokens.push(Token::Placeholder(name));
                    cursor = end + 1;
                    literal_start = cursor;
                }
                b'}' => return Err(FormatError::MalformedTemplate { byte_offset: cursor }),
                _ => cursor += 1,
            }
        }
        if literal_start < bytes.len() { tokens.push(Token::Literal(&source[literal_start..])); }
        for spec in schema {
            if !tokens.iter().any(|token| matches!(token, Token::Placeholder(name) if *name == spec.name)) {
                return Err(FormatError::MissingPlaceholder(spec.name.to_owned()));
            }
        }
        Ok(Self { source, schema, tokens })
    }

    #[must_use]
    pub const fn source(&self) -> &'a str { self.source }

    /// Format without changing source, tokens, arguments, descriptors, or domain.
    pub fn format(&self, locale: Locale, parameters: &[Parameter<'_>]) -> Result<String, FormatError> {
        if parameters.len() > MAX_PARAMETERS { return Err(FormatError::TooManyParameters); }
        for (index, parameter) in parameters.iter().enumerate() {
            if !valid_name(parameter.name) { return Err(FormatError::InvalidName(parameter.name.to_owned())); }
            if parameters[..index].iter().any(|previous| previous.name == parameter.name) {
                return Err(FormatError::DuplicateParameter(parameter.name.to_owned()));
            }
            let spec = self.schema.iter().find(|spec| spec.name == parameter.name)
                .ok_or_else(|| FormatError::UnexpectedParameter(parameter.name.to_owned()))?;
            let actual = parameter.value.kind();
            let numeric = actual == ParameterKind::Integer && matches!(spec.kind,
                ParameterKind::Integer32 | ParameterKind::SignedInteger | ParameterKind::DecimalOnePlace |
                ParameterKind::IntegerPadded2 | ParameterKind::IntegerPadded3);
            if spec.kind != actual && !numeric {
                return Err(FormatError::WrongType { name: parameter.name.to_owned(), expected: spec.kind, actual });
            }
            if spec.kind == ParameterKind::Integer32 {
                if let ParameterValue::Integer(value) = parameter.value {
                    if i32::try_from(value).is_err() {
                        return Err(FormatError::IntegerOutOfRange { name: parameter.name.to_owned(), value });
                    }
                }
            }
            let text = match parameter.value {
                ParameterValue::Text(text) => Some(text),
                ParameterValue::Descriptor(value) => {
                    if value.locale != locale {
                        return Err(FormatError::DescriptorLocale { name: parameter.name.to_owned(), expected: locale, actual: value.locale });
                    }
                    Some(value.text)
                }
                ParameterValue::Integer(_) => None,
            };
            if text.is_some_and(|text| text.len() > MAX_VALUE_BYTES) {
                return Err(FormatError::ValueTooLong(parameter.name.to_owned()));
            }
        }
        for spec in self.schema {
            if !parameters.iter().any(|parameter| parameter.name == spec.name) {
                return Err(FormatError::MissingParameter(spec.name.to_owned()));
            }
        }
        let mut output = String::new();
        for token in &self.tokens {
            match token {
                Token::Literal(text) => append_bounded(&mut output, text)?,
                Token::Placeholder(name) => {
                    let parameter = parameters.iter().find(|parameter| parameter.name == *name)
                        .ok_or_else(|| FormatError::MissingParameter((*name).to_owned()))?;
                    match parameter.value {
                        ParameterValue::Text(text) => append_bounded(&mut output, text)?,
                        ParameterValue::Descriptor(value) => append_bounded(&mut output, value.text)?,
                        ParameterValue::Integer(value) => {
                            let kind = self.schema.iter().find(|spec| spec.name == *name)
                                .ok_or_else(|| FormatError::UnknownPlaceholder((*name).to_owned()))?.kind;
                            let rendered = match kind {
                                ParameterKind::SignedInteger => format!("{value:+}"),
                                ParameterKind::IntegerPadded2 => format!("{value:02}"),
                                ParameterKind::IntegerPadded3 => format!("{value:03}"),
                                ParameterKind::DecimalOnePlace => {
                                    let magnitude = value.unsigned_abs();
                                    format!("{}{}.{}", if value < 0 { "-" } else { "" }, magnitude / 10, magnitude % 10)
                                }
                                _ => value.to_string(),
                            };
                            append_bounded(&mut output, &rendered)?;
                        }
                    }
                }
            }
        }
        Ok(output)
    }
}

fn valid_name(name: &str) -> bool {
    let bytes = name.as_bytes();
    (1..=63).contains(&bytes.len()) && bytes[0].is_ascii_lowercase()
        && bytes[1..].iter().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || *byte == b'_')
}
fn append_bounded(output: &mut String, text: &str) -> Result<(), FormatError> {
    if output.len().checked_add(text.len()).is_none_or(|length| length > MAX_OUTPUT_BYTES) {
        return Err(FormatError::OutputTooLong);
    }
    output.push_str(text);
    Ok(())
}

/// The canonical 22 parameterized/composed IDs in commands-text.json:
/// 19 direct callsite envelopes, two nested gold branches, one index fragment.
/// Other reviewed fragment IDs remain in a separate descriptor catalog.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DynamicTextId {
    TerrainInvalidChance, TerrainDiagnosticIndex,
    DigRubbleRemoved, DigFoundTreasure, DigTunnelFinished, DigRubbleProgress,
    DigTerrainProgress, DigRubbleIneffective, DigTerrainFutile,
    TrapDisarmed, TrapDisarmFailed, TrapTriggered, AttackAfraid,
    LevelObjectFeeling, LevelMonsterFeeling, LevelCombined,
    MonsterDrop, MonsterDoorSlam, MonsterLockFiddle,
    GoldSummary, GoldSingleKind, GoldMixedKinds,
}
pub const ALL_DYNAMIC_IDS: [DynamicTextId; 22] = [
    DynamicTextId::TerrainInvalidChance, DynamicTextId::TerrainDiagnosticIndex,
    DynamicTextId::DigRubbleRemoved, DynamicTextId::DigFoundTreasure, DynamicTextId::DigTunnelFinished,
    DynamicTextId::DigRubbleProgress, DynamicTextId::DigTerrainProgress,
    DynamicTextId::DigRubbleIneffective, DynamicTextId::DigTerrainFutile,
    DynamicTextId::TrapDisarmed, DynamicTextId::TrapDisarmFailed, DynamicTextId::TrapTriggered,
    DynamicTextId::AttackAfraid, DynamicTextId::LevelObjectFeeling, DynamicTextId::LevelMonsterFeeling,
    DynamicTextId::LevelCombined, DynamicTextId::MonsterDrop, DynamicTextId::MonsterDoorSlam,
    DynamicTextId::MonsterLockFiddle, DynamicTextId::GoldSummary,
    DynamicTextId::GoldSingleKind, DynamicTextId::GoldMixedKinds,
];

impl DynamicTextId {
    #[must_use]
    pub const fn key(self) -> &'static str {
        match self {
            Self::TerrainInvalidChance => "game.dig.error.invalid_chance",
            Self::TerrainDiagnosticIndex => "game.terrain.diagnostic.index",
            Self::DigRubbleRemoved => "game.dig.rubble.removed",
            Self::DigFoundTreasure => "game.dig.treasure.found",
            Self::DigTunnelFinished => "game.dig.tunnel.finished",
            Self::DigRubbleProgress => "game.dig.rubble.progress",
            Self::DigTerrainProgress => "game.dig.terrain.progress",
            Self::DigRubbleIneffective => "game.dig.rubble.ineffective",
            Self::DigTerrainFutile => "game.dig.terrain.futile",
            Self::TrapDisarmed => "game.trap.disarm.success",
            Self::TrapDisarmFailed => "game.trap.disarm.failure",
            Self::TrapTriggered => "game.trap.disarm.triggered",
            Self::AttackAfraid => "game.move.attack.afraid",
            Self::LevelObjectFeeling => "game.level.feeling.object",
            Self::LevelMonsterFeeling => "game.level.feeling.monster",
            Self::LevelCombined => "game.level.feeling.combined",
            Self::MonsterDrop => "game.monster.command.drop",
            Self::MonsterDoorSlam => "game.monster.command.door.slam",
            Self::MonsterLockFiddle => "game.monster.command.door.lock",
            Self::GoldSummary => "game.pickup.gold.summary",
            Self::GoldSingleKind => "game.pickup.gold.single_kind",
            Self::GoldMixedKinds => "game.pickup.gold.mixed_kinds",
        }
    }
    pub fn parse(key: &str) -> Result<Self, FormatError> {
        ALL_DYNAMIC_IDS.into_iter().find(|id| id.key() == key)
            .ok_or_else(|| FormatError::UnknownId(key.to_owned()))
    }
    #[must_use]
    pub fn schema(self) -> &'static [ParameterSpec<'static>] {
        use DescriptorKind as D;
        use ParameterKind as P;
        match self {
            Self::TerrainInvalidChance => &[ParameterSpec { name: "terrain", kind: P::Descriptor(D::TerrainDiagnosticReference) }],
            Self::TerrainDiagnosticIndex => &[ParameterSpec { name: "terrain_index", kind: P::Integer32 }],
            Self::DigRubbleRemoved | Self::DigFoundTreasure | Self::DigTunnelFinished |
            Self::DigRubbleProgress | Self::DigRubbleIneffective => &[ParameterSpec { name: "digging_method", kind: P::Descriptor(D::DiggingMethod) }],
            Self::DigTerrainProgress => &[
                ParameterSpec { name: "terrain", kind: P::Descriptor(D::ApparentTerrain) },
                ParameterSpec { name: "digging_method", kind: P::Descriptor(D::DiggingMethod) },
            ],
            Self::DigTerrainFutile => &[
                ParameterSpec { name: "digging_method", kind: P::Descriptor(D::DiggingMethod) },
                ParameterSpec { name: "terrain", kind: P::Descriptor(D::ApparentTerrain) },
            ],
            Self::TrapDisarmed | Self::TrapDisarmFailed | Self::TrapTriggered => &[ParameterSpec { name: "trap", kind: P::Descriptor(D::TrapName) }],
            Self::AttackAfraid | Self::MonsterDoorSlam | Self::MonsterLockFiddle => &[ParameterSpec { name: "monster", kind: P::Descriptor(D::MonsterDescription) }],
            Self::LevelObjectFeeling => &[ParameterSpec { name: "object_feeling", kind: P::Descriptor(D::ObjectFeeling) }],
            Self::LevelMonsterFeeling => &[ParameterSpec { name: "monster_feeling", kind: P::Descriptor(D::MonsterFeeling) }],
            Self::LevelCombined => &[
                ParameterSpec { name: "monster_feeling", kind: P::Descriptor(D::MonsterFeeling) },
                ParameterSpec { name: "conjunction", kind: P::Descriptor(D::FeelingConjunction) },
                ParameterSpec { name: "object_feeling", kind: P::Descriptor(D::ObjectFeeling) },
            ],
            Self::MonsterDrop => &[
                ParameterSpec { name: "monster", kind: P::Descriptor(D::MonsterDescription) },
                ParameterSpec { name: "object", kind: P::Descriptor(D::KnownObjectDescription) },
            ],
            Self::GoldSummary => &[ParameterSpec { name: "gold_message", kind: P::Descriptor(D::GoldPickupMessage) }],
            Self::GoldSingleKind => &[
                ParameterSpec { name: "gold_amount", kind: P::Integer32 },
                ParameterSpec { name: "treasure", kind: P::Descriptor(D::MoneyKindName) },
            ],
            Self::GoldMixedKinds => &[ParameterSpec { name: "gold_amount", kind: P::Integer32 }],
        }
    }
}

/// Catalog loading and descriptor fragments remain separate from the generic
/// formatter. The real JSON catalog adapter is not integrated in this phase.
pub trait DynamicTemplateCatalog {
    fn template(&self, locale: Locale, id: DynamicTextId) -> Result<&str, FormatError>;
}

pub fn format_message(
    locale: Locale, id: DynamicTextId, catalog: &impl DynamicTemplateCatalog,
    parameters: &[Parameter<'_>],
) -> Result<String, FormatError> {
    CompiledTemplate::compile(catalog.template(locale, id)?, id.schema())?.format(locale, parameters)
}
pub fn format_message_key(
    locale: Locale, key: &str, catalog: &impl DynamicTemplateCatalog,
    parameters: &[Parameter<'_>],
) -> Result<String, FormatError> {
    format_message(locale, DynamicTextId::parse(key)?, catalog, parameters)
}

#[cfg(test)]
mod tests {
    use super::*;
    const NAME_SCHEMA: [ParameterSpec<'static>; 1] = [ParameterSpec { name: "name", kind: ParameterKind::Text }];
    fn text<'a>(name: &'a str, value: &'a str) -> Parameter<'a> { Parameter { name, value: ParameterValue::Text(value) } }

    struct ManifestEntry {
        id: DynamicTextId,
        english: String,
        japanese: String,
        parameters: Vec<(String, String)>,
    }
    struct ManifestCatalog { entries: Vec<ManifestEntry> }
    #[derive(Default)]
    struct JsonObjectFixture {
        strings: Vec<(String, String)>,
        children: Vec<JsonObjectFixture>,
    }
    impl JsonObjectFixture {
        fn field(&self, name: &str) -> Option<&str> {
            self.strings.iter().find(|(key, _)| key == name).map(|(_, value)| value.as_str())
        }
    }
    fn skip_space(bytes: &[u8], mut cursor: usize) -> usize {
        while bytes.get(cursor).is_some_and(u8::is_ascii_whitespace) { cursor += 1; }
        cursor
    }
    fn string_end(bytes: &[u8], start: usize) -> usize {
        let mut cursor = start + 1;
        while cursor < bytes.len() {
            match bytes[cursor] {
                b'\\' => cursor += 2,
                b'"' => return cursor + 1,
                _ => cursor += 1,
            }
        }
        panic!("unterminated JSON string in reviewed fixture")
    }
    fn decode_string(raw: &str) -> String {
        crate::text::parse_flat_json(&format!("{{\"value\":{raw}}}")).unwrap().pop().unwrap().1
    }
    impl ManifestCatalog {
        /// Test-only structural scanner: strings/escapes and nested object
        /// ownership are preserved; decoded strings use the existing JSON parser.
        /// This is not a production manifest/catalog adapter.
        fn reviewed_fixture() -> Self {
            let json = include_str!("../../migration/commands-text.json");
            let bytes = json.as_bytes();
            let mut stack: Vec<JsonObjectFixture> = Vec::new();
            let mut entries = Vec::new();
            let mut cursor = 0;
            while cursor < bytes.len() {
                match bytes[cursor] {
                    b'{' => { stack.push(JsonObjectFixture::default()); cursor += 1; }
                    b'}' => {
                        let object = stack.pop().expect("fixture object nesting");
                        if let Some(key) = object.field("id") {
                            if let Ok(id) = DynamicTextId::parse(key) {
                                entries.push(ManifestEntry {
                                    id,
                                    english: object.field("english").unwrap().to_owned(),
                                    japanese: object.field("japanese").unwrap().to_owned(),
                                    parameters: object.children.iter().filter_map(|child| {
                                        Some((child.field("name")?.to_owned(), child.field("type")?.to_owned()))
                                    }).collect(),
                                });
                            }
                        }
                        if let Some(parent) = stack.last_mut() { parent.children.push(object); }
                        cursor += 1;
                    }
                    b'"' => {
                        let key_end = string_end(bytes, cursor);
                        let colon = skip_space(bytes, key_end);
                        if bytes.get(colon) == Some(&b':') {
                            let value_start = skip_space(bytes, colon + 1);
                            if bytes.get(value_start) == Some(&b'"') {
                                let value_end = string_end(bytes, value_start);
                                let key = decode_string(&json[cursor..key_end]);
                                let value = decode_string(&json[value_start..value_end]);
                                stack.last_mut().expect("fixture property object").strings.push((key, value));
                                cursor = value_end;
                                continue;
                            }
                        }
                        cursor = key_end;
                    }
                    _ => cursor += 1,
                }
            }
            assert!(stack.is_empty());
            Self { entries }
        }
    }
    impl DynamicTemplateCatalog for ManifestCatalog {
        fn template(&self, locale: Locale, id: DynamicTextId) -> Result<&str, FormatError> {
            let entry = self.entries.iter().find(|entry| entry.id == id)
                .ok_or_else(|| FormatError::UnknownId(id.key().to_owned()))?;
            Ok(match locale { Locale::English => &entry.english, Locale::Japanese => &entry.japanese })
        }
    }

    #[test]
    fn canonical_manifest_ids_types_and_both_locale_placeholder_sets_match() {
        let catalog = ManifestCatalog::reviewed_fixture();
        assert_eq!(ALL_DYNAMIC_IDS.len(), 22);
        assert_eq!(catalog.entries.len(), ALL_DYNAMIC_IDS.len());
        for id in ALL_DYNAMIC_IDS {
            assert_eq!(DynamicTextId::parse(id.key()).unwrap(), id);
            let matches: Vec<_> = catalog.entries.iter().filter(|entry| entry.id == id).collect();
            assert_eq!(matches.len(), 1);
            let expected: Vec<_> = id.schema().iter().map(|spec| {
                let kind = match spec.kind {
                    ParameterKind::Integer32 => "int32".to_owned(),
                    ParameterKind::Integer => "integer".to_owned(),
                    ParameterKind::SignedInteger => "signed_integer".to_owned(),
                    ParameterKind::DecimalOnePlace => "decimal_one_place".to_owned(),
                    ParameterKind::IntegerPadded2 => "integer_minimum_width_2".to_owned(),
                    ParameterKind::IntegerPadded3 => "integer_minimum_width_3".to_owned(),
                    ParameterKind::Text => "opaque_external_text".to_owned(),
                    ParameterKind::Descriptor(kind) => format!("{kind:?}"),
                };
                (spec.name.to_owned(), kind)
            }).collect();
            assert_eq!(matches[0].parameters, expected, "{}", id.key());
            for locale in [Locale::English, Locale::Japanese] {
                assert!(CompiledTemplate::compile(catalog.template(locale, id).unwrap(), id.schema()).is_ok(), "{}", id.key());
            }
        }
    }

    #[test]
    fn unknown_semantic_ids_never_use_completed_english_lookup() {
        let catalog = ManifestCatalog::reviewed_fixture();
        assert_eq!(format_message_key(Locale::Japanese, "game.unknown", &catalog, &[]), Err(FormatError::UnknownId("game.unknown".into())));
        assert!(matches!(DynamicTextId::parse("You failed to disarm the pit."), Err(FormatError::UnknownId(_))));
    }

    #[test]
    fn escaped_braces_repeated_references_and_opaque_names_are_preserved() {
        let template = CompiledTemplate::compile("{{{name}}} / {name}", &NAME_SCHEMA).unwrap();
        let name = "Alice 花🌸 {name} 100%";
        let params = [text("name", name)];
        assert_eq!(template.format(Locale::Japanese, &params).unwrap(), "{Alice 花🌸 {name} 100%} / Alice 花🌸 {name} 100%");
        assert_eq!(params, [text("name", name)]);
        assert_eq!(template.source(), "{{{name}}} / {name}");
    }

    #[test]
    fn duplicate_schema_and_unknown_missing_placeholders_are_explicit() {
        let duplicate = [NAME_SCHEMA[0], NAME_SCHEMA[0]];
        assert!(matches!(CompiledTemplate::compile("{name}", &duplicate), Err(FormatError::DuplicateSchema(name)) if name == "name"));
        assert!(matches!(CompiledTemplate::compile("{extra}", &NAME_SCHEMA), Err(FormatError::UnknownPlaceholder(name)) if name == "extra"));
        assert!(matches!(CompiledTemplate::compile("{{name}}", &NAME_SCHEMA), Err(FormatError::MissingPlaceholder(name)) if name == "name"));
        assert!(matches!(CompiledTemplate::compile("{name", &NAME_SCHEMA), Err(FormatError::MalformedTemplate { .. })));
        assert!(matches!(CompiledTemplate::compile("{name}}", &NAME_SCHEMA), Err(FormatError::MalformedTemplate { .. })));
        assert!(matches!(CompiledTemplate::compile("{名前}", &NAME_SCHEMA), Err(FormatError::InvalidName(_))));
    }

    #[test]
    fn argument_missing_extra_duplicate_and_wrong_type_are_explicit() {
        let template = CompiledTemplate::compile("{name}", &NAME_SCHEMA).unwrap();
        assert_eq!(template.format(Locale::Japanese, &[]), Err(FormatError::MissingParameter("name".into())));
        assert_eq!(template.format(Locale::Japanese, &[text("extra", "x")]), Err(FormatError::UnexpectedParameter("extra".into())));
        assert_eq!(template.format(Locale::Japanese, &[text("name", "x"), text("name", "y")]), Err(FormatError::DuplicateParameter("name".into())));
        assert!(matches!(template.format(Locale::Japanese, &[Parameter { name: "name", value: ParameterValue::Integer(2) }]), Err(FormatError::WrongType { .. })));
    }

    #[test]
    fn signed_integer_extremes_are_formatted_without_overflow_or_coercion() {
        let schema = [ParameterSpec { name: "amount", kind: ParameterKind::Integer }];
        let template = CompiledTemplate::compile("金貨{amount}枚", &schema).unwrap();
        for value in [i64::MIN, -1, 0, 1, i64::MAX] {
            assert_eq!(template.format(Locale::Japanese, &[Parameter { name: "amount", value: ParameterValue::Integer(value) }]).unwrap(), format!("金貨{value}枚"));
        }
    }

    #[test]
    fn canonical_int32_parameters_reject_out_of_range_values() {
        let catalog = ManifestCatalog::reviewed_fixture();
        for value in [i64::from(i32::MIN), -1, 0, 1, i64::from(i32::MAX)] {
            assert!(format_message(Locale::English, DynamicTextId::GoldMixedKinds, &catalog, &[Parameter { name: "gold_amount", value: ParameterValue::Integer(value) }]).is_ok());
        }
        for value in [i64::from(i32::MIN) - 1, i64::from(i32::MAX) + 1] {
            assert_eq!(format_message(Locale::English, DynamicTextId::GoldMixedKinds, &catalog, &[Parameter { name: "gold_amount", value: ParameterValue::Integer(value) }]), Err(FormatError::IntegerOutOfRange { name: "gold_amount".into(), value }));
        }
    }

    #[test]
    fn source_integer_padding_is_minimum_width_and_preserves_signed_values() {
        for (kind, width) in [(ParameterKind::IntegerPadded2, 2), (ParameterKind::IntegerPadded3, 3)] {
            let schema = [ParameterSpec { name: "bonus", kind }];
            let template = CompiledTemplate::compile("18/{bonus}", &schema).unwrap();
            for value in [0_i64, 1, 9, 99, 100, 101, -1, i64::MIN, i64::MAX] {
                let actual = template.format(Locale::English, &[Parameter { name: "bonus", value: ParameterValue::Integer(value) }]).unwrap();
                let expected_number = match (width, value) {
                    (2, 0) => "00".to_owned(), (2, 1) => "01".to_owned(), (2, 9) => "09".to_owned(),
                    (3, 0) => "000".to_owned(), (3, 1) => "001".to_owned(), (3, 9) => "009".to_owned(),
                    (3, 99) => "099".to_owned(), (3, -1) => "-01".to_owned(),
                    _ => value.to_string(),
                };
                assert_eq!(actual, format!("18/{expected_number}"));
            }
        }
    }

    #[test]
    fn descriptor_schema_rejects_raw_english_and_cross_locale_strings() {
        let catalog = ManifestCatalog::reviewed_fixture();
        assert!(matches!(format_message(Locale::Japanese, DynamicTextId::TrapDisarmed, &catalog, &[text("trap", "pit")]), Err(FormatError::WrongType { .. })));
        let reference = DescriptorReference::TrapName { kind_id: 7 };
        let english = ResolvedDescriptor::from_catalog(reference, Locale::English, "pit");
        let parameter = Parameter { name: "trap", value: ParameterValue::Descriptor(english) };
        assert!(matches!(format_message(Locale::Japanese, DynamicTextId::TrapDisarmed, &catalog, &[parameter]), Err(FormatError::DescriptorLocale { .. })));
        let wrong_class = ResolvedDescriptor::from_catalog(DescriptorReference::MoneyKindName { kind_id: 7 }, Locale::Japanese, "金貨");
        assert!(matches!(format_message(Locale::Japanese, DynamicTextId::TrapDisarmed, &catalog, &[Parameter { name: "trap", value: ParameterValue::Descriptor(wrong_class) }]), Err(FormatError::WrongType { .. })));
    }

    #[test]
    fn localized_descriptors_and_named_parameter_reordering_are_immutable() {
        let catalog = ManifestCatalog::reviewed_fixture();
        let terrain = ResolvedDescriptor::from_catalog(DescriptorReference::ApparentTerrain { apparent_feature_id: 7 }, Locale::Japanese, "花崗岩の壁");
        let method = ResolvedDescriptor::from_catalog(DescriptorReference::DiggingMethod(DiggingMethod::Hands), Locale::Japanese, "素手で");
        let parameters = [Parameter { name: "digging_method", value: ParameterValue::Descriptor(method) }, Parameter { name: "terrain", value: ParameterValue::Descriptor(terrain) }];
        let first = format_message(Locale::Japanese, DynamicTextId::DigTerrainProgress, &catalog, &parameters).unwrap();
        let second = format_message(Locale::Japanese, DynamicTextId::DigTerrainProgress, &catalog, &parameters).unwrap();
        assert_eq!(first, "花崗岩の壁を素手で掘り進めている。");
        assert_eq!(first, second);
        assert_eq!(parameters[0].value, ParameterValue::Descriptor(method));
        assert_eq!(terrain.as_str(), "花崗岩の壁");
    }

    #[test]
    fn gold_summary_requires_typed_branch_composition_and_preserves_source_plural() {
        let catalog = ManifestCatalog::reviewed_fixture();
        let message = format_message(Locale::English, DynamicTextId::GoldMixedKinds, &catalog, &[Parameter { name: "gold_amount", value: ParameterValue::Integer(1) }]).unwrap();
        assert_eq!(message, "You have found 1 gold pieces worth of treasures.");
        assert!(matches!(format_message(Locale::English, DynamicTextId::GoldSummary, &catalog, &[text("gold_message", &message)]), Err(FormatError::WrongType { .. })));
        let composed = ResolvedDescriptor::from_catalog(DescriptorReference::GoldPickupMessage(GoldPickupReference::MixedKinds { gold_amount: 1 }), Locale::English, &message);
        assert_eq!(format_message(Locale::English, DynamicTextId::GoldSummary, &catalog, &[Parameter { name: "gold_message", value: ParameterValue::Descriptor(composed) }]).unwrap(), message);
    }

    #[test]
    fn apparent_and_diagnostic_terrain_have_separate_types() {
        let catalog = ManifestCatalog::reviewed_fixture();
        let diagnostic = ResolvedDescriptor::from_catalog(DescriptorReference::TerrainDiagnosticNamed { actual_feature_id: 7 }, Locale::English, "granite wall");
        let method = ResolvedDescriptor::from_catalog(DescriptorReference::DiggingMethod(DiggingMethod::Hands), Locale::English, "with your hands");
        assert!(matches!(format_message(Locale::English, DynamicTextId::DigTerrainProgress, &catalog, &[Parameter { name: "terrain", value: ParameterValue::Descriptor(diagnostic) }, Parameter { name: "digging_method", value: ParameterValue::Descriptor(method) }]), Err(FormatError::WrongType { .. })));
        let fragment = format_message(Locale::English, DynamicTextId::TerrainDiagnosticIndex, &catalog, &[Parameter { name: "terrain_index", value: ParameterValue::Integer(9) }]).unwrap();
        assert_eq!(fragment, "Terrain index 9");
        let index = ResolvedDescriptor::from_catalog(DescriptorReference::TerrainDiagnosticIndex { terrain_index: 9 }, Locale::English, &fragment);
        assert_eq!(format_message(Locale::English, DynamicTextId::TerrainInvalidChance, &catalog, &[Parameter { name: "terrain", value: ParameterValue::Descriptor(index) }]).unwrap(), "Terrain index 9 has misconfigured digging chance; please report this bug.");
    }

    #[test]
    fn bounded_formatting_rejects_large_templates_values_and_outputs() {
        assert!(matches!(CompiledTemplate::compile(&"x".repeat(MAX_TEMPLATE_BYTES + 1), &[]), Err(FormatError::TemplateTooLong)));
        let template = CompiledTemplate::compile("{name}", &NAME_SCHEMA).unwrap();
        let large = "x".repeat(MAX_VALUE_BYTES + 1);
        assert_eq!(template.format(Locale::English, &[text("name", &large)]), Err(FormatError::ValueTooLong("name".into())));
        let repeated = CompiledTemplate::compile("{name}{name}{name}{name}{name}", &NAME_SCHEMA).unwrap();
        let maximum = "x".repeat(MAX_VALUE_BYTES);
        assert_eq!(repeated.format(Locale::English, &[text("name", &maximum)]), Err(FormatError::OutputTooLong));
        assert!(matches!(CompiledTemplate::compile(&"{name}".repeat(MAX_PLACEHOLDER_USES + 1), &NAME_SCHEMA), Err(FormatError::TooManyPlaceholderUses)));
    }
}
