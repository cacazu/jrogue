//! Pure JSON localization. Formatting cannot call or mutate the game engine.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::domain::{
    GameplayEvent, InvalidTextEvent, MAX_ARGUMENTS, MAX_EVENT_DEPTH, MAX_TEXT_BYTES, TextArgument,
    TextEvent, TextId, valid_argument_name as argument_name,
};

/// Maximum JSON catalog size accepted at an adapter boundary.
pub const MAX_CATALOG_BYTES: usize = 16 * 1024 * 1024;
/// Maximum formatted UTF-8 bytes in a single text observation.
pub const MAX_RENDERED_BYTES: usize = 128 * 1024;
/// Bounded envelope size for typed gameplay arguments and frozen public context.
pub const MAX_GAMEPLAY_EVENT_BYTES: usize = 256 * 1024;
/// Per-call work bound, including repeated placeholders and nested expansion.
pub const MAX_FORMAT_EXPANSIONS: usize = 8_192;

const TYPE_INTEGER: u8 = 1;
const TYPE_UNSIGNED: u8 = 2;
const TYPE_TEXT: u8 = 4;
const TYPE_BOOLEAN: u8 = 8;
const TYPE_TEXT_ID: u8 = 16;
const TYPE_EVENT: u8 = 32;
const TYPE_ANY: u8 =
    TYPE_INTEGER | TYPE_UNSIGNED | TYPE_TEXT | TYPE_BOOLEAN | TYPE_TEXT_ID | TYPE_EVENT;

/// Japanese is the default presentation language.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
    #[default]
    Ja,
    En,
}

/// Paired catalogs keyed by stable English semantic IDs.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    pub en: BTreeMap<TextId, String>,
    pub ja: BTreeMap<TextId, String>,
    /// Explicit source-public argument unions for locale-specific grammar.
    /// Without a declaration, EN and JA must use exactly the same names.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub argument_schemas: BTreeMap<TextId, Vec<String>>,
}

impl Catalog {
    /// Parse and validate a catalog, including matching argument schemas.
    ///
    /// # Errors
    /// Returns an error for oversized or malformed JSON, invalid templates,
    /// absent English source IDs, or mismatched EN/JA placeholders.
    pub fn from_json(json: &[u8]) -> Result<Self, FormatError> {
        if json.len() > MAX_CATALOG_BYTES {
            return Err(FormatError::TooLarge);
        }
        let catalog: Self = serde_json::from_slice(json).map_err(|_| FormatError::InvalidJson)?;
        for (id, english) in &catalog.en {
            let source_schema = template_schema(english)?;
            let japanese_schema = catalog
                .ja
                .get(id)
                .map(|text| template_schema(text))
                .transpose()?;
            if let Some(names) = catalog.argument_schemas.get(id) {
                let declared = declared_names(names)?;
                if source_schema.keys().any(|name| !declared.contains(name))
                    || japanese_schema
                        .as_ref()
                        .is_some_and(|schema| schema.keys().any(|name| !declared.contains(name)))
                {
                    return Err(FormatError::ArgumentSchema);
                }
                if let Some(japanese) = &japanese_schema {
                    merge_schemas(&source_schema, japanese)?;
                }
            } else if let Some(japanese) = &japanese_schema
                && !compatible_schema(&source_schema, japanese)
            {
                return Err(FormatError::ArgumentSchema);
            }
        }
        if catalog.ja.keys().any(|id| !catalog.en.contains_key(id)) {
            return Err(FormatError::MissingEnglish);
        }
        if catalog
            .argument_schemas
            .keys()
            .any(|id| !catalog.en.contains_key(id))
        {
            return Err(FormatError::MissingEnglish);
        }
        Ok(catalog)
    }

    fn template(&self, id: &TextId, locale: Locale) -> Result<(&str, bool), FormatError> {
        if locale == Locale::Ja
            && let Some(template) = self.ja.get(id)
        {
            return Ok((template, false));
        }
        self.en
            .get(id)
            .map(|template| (template.as_str(), locale == Locale::Ja))
            .ok_or(FormatError::MissingId)
    }

    /// Format a source-selected immutable event. Fallback is explicitly reported.
    ///
    /// # Errors
    /// Rejects missing IDs, invalid templates/types/arguments, and oversized
    /// text. Native printf specifiers stay in templates; numeric values remain
    /// typed until presentation. User text is never interpreted as a template.
    pub fn render(&self, event: &TextEvent, locale: Locale) -> Result<RenderedText, FormatError> {
        event.validate_tree()?;
        self.render_at_depth(event, &event.id, locale, 0, &mut RenderBudget::default())
    }

    /// Render a native semantic envelope without reproducing any game decision.
    /// Catalogs contain complete helper messages; captured dream/underwater/blind
    /// context selects explicit variant entries. Plain and quoted messages use
    /// their original catalog ID. No completed English text is inspected.
    ///
    /// # Errors
    /// Invalid or absent context/variant entries return errors. Accessibility
    /// qualifiers are retained through `context.location_prefix`, or return an
    /// error if that catalog rule is missing. Raw qualifiers mark JA fallback.
    pub fn render_gameplay(
        &self,
        envelope: &GameplayEvent,
        locale: Locale,
    ) -> Result<RenderedText, FormatError> {
        envelope.event.validate_tree()?;
        let id = envelope
            .context
            .text_id(&envelope.event.id)
            .map_err(|_| FormatError::InvalidContext)?;
        if envelope
            .context
            .quest
            .as_ref()
            .is_some_and(|quest| !quest.is_final || !quest.capture_complete)
        {
            // Original native rows stay visible until their producer and browser
            // have assembled the complete, source-public argument union.
            return Err(FormatError::InvalidContext);
        }
        let mut budget = RenderBudget::default();
        let mut rendered = self.render_at_depth(&envelope.event, &id, locale, 0, &mut budget)?;
        if let Some(location) = &envelope.context.location_prefix {
            let qualified = self.qualify_location(location, &rendered.text, locale, &mut budget)?;
            rendered.text = qualified.text;
            rendered.used_fallback |= qualified.used_fallback || locale == Locale::Ja;
        }
        Ok(rendered)
    }

    fn render_at_depth(
        &self,
        event: &TextEvent,
        id: &TextId,
        locale: Locale,
        depth: usize,
        budget: &mut RenderBudget,
    ) -> Result<RenderedText, FormatError> {
        budget.expand()?;
        if depth > MAX_EVENT_DEPTH {
            return Err(FormatError::TooDeep);
        }
        if event.args.len() > MAX_ARGUMENTS {
            return Err(FormatError::TooLarge);
        }
        let (template, fallback) = self.template(id, locale)?;
        let english = self.en.get(id).ok_or(FormatError::MissingId)?;
        let mut source_schema = template_schema(english)?;
        if let Some(japanese) = self.ja.get(id) {
            let japanese_schema = template_schema(japanese)?;
            if !self.argument_schemas.contains_key(id)
                && !compatible_schema(&source_schema, &japanese_schema)
            {
                return Err(FormatError::ArgumentSchema);
            }
            source_schema = merge_schemas(&source_schema, &japanese_schema)?;
        }
        let expected: BTreeSet<&str> = if let Some(names) = self.argument_schemas.get(id) {
            declared_names(names)?
        } else {
            source_schema.keys().copied().collect()
        };
        let supplied: BTreeSet<&str> = event.args.keys().map(String::as_str).collect();
        if expected != supplied {
            return Err(FormatError::ArgumentSchema);
        }
        for (name, allowed) in source_schema {
            let value = event.args.get(name).ok_or(FormatError::ArgumentSchema)?;
            if argument_type(value) & allowed == 0 {
                return Err(FormatError::ArgumentType);
            }
        }
        if event
            .args
            .values()
            .any(|value| matches!(value, TextArgument::Text(text) if text.len() > MAX_TEXT_BYTES))
        {
            return Err(FormatError::TooLarge);
        }
        let mut used_fallback = fallback;
        let text = substitute(template, |placeholder| {
            budget.expand()?;
            let arg = event
                .args
                .get(placeholder.name)
                .ok_or(FormatError::ArgumentSchema)?;
            if let Some(spec) = placeholder.spec {
                let width = resolve_width(spec.width, &event.args)?;
                let precision = resolve_precision(spec.precision, &event.args)?;
                let left = spec.flags.left || width.1;
                let literal = match spec.conversion {
                    Conversion::Text => match arg {
                        TextArgument::Text(text) => {
                            if text.len() > MAX_TEXT_BYTES {
                                return Err(FormatError::TooLarge);
                            }
                            text.clone()
                        }
                        TextArgument::TextId(id) => {
                            self.resolve_reference(id, locale, &mut used_fallback)?
                        }
                        TextArgument::Event(event) => self.resolve_event(
                            event,
                            locale,
                            depth + 1,
                            budget,
                            &mut used_fallback,
                        )?,
                        _ => return Err(FormatError::ArgumentType),
                    },
                    Conversion::Character => character_byte(arg)?,
                    _ => return format_integer(arg, spec, width.0, precision, left),
                };
                let literal = match spec.conversion {
                    Conversion::Text => truncate_utf8(literal, precision),
                    _ => literal,
                };
                return pad_text(literal, width.0, left);
            }
            match arg {
                TextArgument::Text(text) => {
                    if text.len() > MAX_TEXT_BYTES {
                        return Err(FormatError::TooLarge);
                    }
                    Ok(text.clone())
                }
                TextArgument::Integer(value) => Ok(value.to_string()),
                TextArgument::Unsigned(value) => Ok(value.to_string()),
                TextArgument::Boolean(value) => Ok(value.to_string()),
                TextArgument::TextId(id) => self.resolve_reference(id, locale, &mut used_fallback),
                TextArgument::Event(event) => {
                    self.resolve_event(event, locale, depth + 1, budget, &mut used_fallback)
                }
            }
        })?;
        Ok(RenderedText {
            text,
            locale,
            used_fallback,
        })
    }

    fn resolve_event(
        &self,
        event: &TextEvent,
        locale: Locale,
        depth: usize,
        budget: &mut RenderBudget,
        used_fallback: &mut bool,
    ) -> Result<String, FormatError> {
        let rendered = self.render_at_depth(event, &event.id, locale, depth, budget)?;
        *used_fallback |= rendered.used_fallback;
        Ok(rendered.text)
    }

    fn qualify_location(
        &self,
        location: &str,
        body: &str,
        locale: Locale,
        budget: &mut RenderBudget,
    ) -> Result<RenderedText, FormatError> {
        let id = TextId::try_from("context.location_prefix".to_owned())
            .map_err(|_| FormatError::InvalidContext)?;
        let (template, used_fallback) = self.template(&id, locale)?;
        let expected = BTreeSet::from(["location", "text"]);
        for candidate in [
            self.en.get(&id).ok_or(FormatError::MissingId)?.as_str(),
            template,
        ] {
            let schema = template_schema(candidate)?;
            if schema.keys().copied().collect::<BTreeSet<_>>() != expected
                || schema.values().any(|allowed| *allowed != TYPE_ANY)
            {
                return Err(FormatError::ArgumentSchema);
            }
        }
        if let Some(names) = self.argument_schemas.get(&id)
            && declared_names(names)? != expected
        {
            return Err(FormatError::ArgumentSchema);
        }
        let text = substitute(template, |placeholder| {
            budget.expand()?;
            if placeholder.spec.is_some() {
                return Err(FormatError::InvalidFormatSpec);
            }
            // The body is trusted output bounded to 128 KiB, not a captured
            // source literal. Preserve that output bound during composition.
            match placeholder.name {
                "location" => Ok(location.to_owned()),
                "text" => Ok(body.to_owned()),
                _ => Err(FormatError::ArgumentSchema),
            }
        })?;
        Ok(RenderedText {
            text,
            locale,
            used_fallback,
        })
    }

    fn resolve_reference(
        &self,
        id: &TextId,
        locale: Locale,
        used_fallback: &mut bool,
    ) -> Result<String, FormatError> {
        let (template, fallback) = self.template(id, locale)?;
        *used_fallback |= fallback;
        // Entity IDs are already-public names, not effect lookups. Their templates
        // deliberately carry no arguments. Composed names use a bounded event
        // argument instead of looking up hidden engine objects.
        let english = self.en.get(id).ok_or(FormatError::MissingId)?;
        if !template_schema(english)?.is_empty()
            || !template_schema(template)?.is_empty()
            || self
                .argument_schemas
                .get(id)
                .is_some_and(|names| !names.is_empty())
        {
            return Err(FormatError::ArgumentSchema);
        }
        substitute(template, |_| Err(FormatError::ArgumentSchema))
    }
}

/// Rendering result keeps diagnostic coverage separate from visible text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderedText {
    pub text: String,
    pub locale: Locale,
    pub used_fallback: bool,
}

/// Recoverable catalog/event errors.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormatError {
    InvalidJson,
    MissingId,
    MissingEnglish,
    InvalidTemplate,
    ArgumentSchema,
    ArgumentType,
    InvalidFormatSpec,
    InvalidCharacter,
    InvalidContext,
    TooDeep,
    TooLarge,
}

impl fmt::Display for FormatError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidJson => "invalid localization JSON",
            Self::MissingId => "missing semantic text identifier",
            Self::MissingEnglish => "Japanese catalog identifier has no English source",
            Self::InvalidTemplate => "invalid localization template",
            Self::ArgumentSchema => "text arguments do not match template",
            Self::ArgumentType => "typed argument does not match source printf conversion",
            Self::InvalidFormatSpec => "unsupported or invalid printf template specification",
            Self::InvalidCharacter => "native character byte cannot be rendered as ASCII text",
            Self::InvalidContext => "invalid frozen gameplay text context",
            Self::TooDeep => "semantic event nesting exceeds limits",
            Self::TooLarge => "localization text exceeds limits",
        })
    }
}

impl std::error::Error for FormatError {}

#[derive(Default)]
struct RenderBudget {
    expansions: usize,
}

impl RenderBudget {
    fn expand(&mut self) -> Result<(), FormatError> {
        self.expansions = self.expansions.saturating_add(1);
        if self.expansions > MAX_FORMAT_EXPANSIONS {
            return Err(FormatError::TooLarge);
        }
        Ok(())
    }
}

impl From<InvalidTextEvent> for FormatError {
    fn from(error: InvalidTextEvent) -> Self {
        match error {
            InvalidTextEvent::TooDeep => Self::TooDeep,
            InvalidTextEvent::TooLarge => Self::TooLarge,
            InvalidTextEvent::ArgumentName => Self::ArgumentSchema,
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
struct PrintfFlags {
    left: bool,
    plus: bool,
    space: bool,
    alternate: bool,
    zero: bool,
}

#[derive(Debug, Clone, Copy)]
enum FieldSize<'a> {
    Constant(usize),
    Argument(&'a str),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum IntegerLength {
    Default,
    Byte,
    Short,
    Long,
    LongLong,
    Max,
    Size,
    Difference,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Conversion {
    Signed,
    Unsigned,
    Octal,
    HexLower,
    HexUpper,
    Text,
    Character,
}

#[derive(Debug, Clone, Copy)]
struct PrintfSpec<'a> {
    flags: PrintfFlags,
    width: Option<FieldSize<'a>>,
    precision: Option<FieldSize<'a>>,
    length: IntegerLength,
    conversion: Conversion,
}

#[derive(Debug, Clone, Copy)]
struct Placeholder<'a> {
    name: &'a str,
    spec: Option<PrintfSpec<'a>>,
}

fn argument_type(value: &TextArgument) -> u8 {
    match value {
        TextArgument::Integer(_) => TYPE_INTEGER,
        TextArgument::Unsigned(_) => TYPE_UNSIGNED,
        TextArgument::Text(_) => TYPE_TEXT,
        TextArgument::Boolean(_) => TYPE_BOOLEAN,
        TextArgument::TextId(_) => TYPE_TEXT_ID,
        TextArgument::Event(_) => TYPE_EVENT,
    }
}

fn template_schema(template: &str) -> Result<BTreeMap<&str, u8>, FormatError> {
    if template.len() > MAX_TEXT_BYTES {
        return Err(FormatError::TooLarge);
    }
    let mut schema = BTreeMap::new();
    visit_template(template, |placeholder| {
        let allowed = match placeholder.spec.map(|spec| spec.conversion) {
            None => TYPE_ANY,
            Some(Conversion::Signed) => TYPE_INTEGER,
            Some(
                Conversion::Unsigned
                | Conversion::Octal
                | Conversion::HexLower
                | Conversion::HexUpper,
            ) => TYPE_UNSIGNED,
            Some(Conversion::Text) => TYPE_TEXT | TYPE_TEXT_ID | TYPE_EVENT,
            Some(Conversion::Character) => TYPE_INTEGER | TYPE_UNSIGNED,
        };
        add_constraint(&mut schema, placeholder.name, allowed)?;
        if let Some(spec) = placeholder.spec {
            for field in [spec.width, spec.precision].into_iter().flatten() {
                if let FieldSize::Argument(name) = field {
                    add_constraint(&mut schema, name, TYPE_INTEGER)?;
                }
            }
        }
        Ok(String::new())
    })?;
    Ok(schema)
}

fn add_constraint<'a>(
    schema: &mut BTreeMap<&'a str, u8>,
    name: &'a str,
    allowed: u8,
) -> Result<(), FormatError> {
    let value = schema.entry(name).or_insert(TYPE_ANY);
    *value &= allowed;
    if *value == 0 {
        return Err(FormatError::ArgumentType);
    }
    Ok(())
}

fn compatible_schema(english: &BTreeMap<&str, u8>, japanese: &BTreeMap<&str, u8>) -> bool {
    english.len() == japanese.len()
        && english
            .iter()
            .all(|(name, allowed)| japanese.get(name).is_some_and(|other| allowed & other != 0))
}

fn declared_names(names: &[String]) -> Result<BTreeSet<&str>, FormatError> {
    if names.len() > MAX_ARGUMENTS || names.iter().any(|name| !argument_name(name)) {
        return Err(FormatError::ArgumentSchema);
    }
    let declared: BTreeSet<&str> = names.iter().map(String::as_str).collect();
    if declared.len() != names.len() {
        return Err(FormatError::ArgumentSchema);
    }
    Ok(declared)
}

fn merge_schemas<'a>(
    english: &BTreeMap<&'a str, u8>,
    japanese: &BTreeMap<&'a str, u8>,
) -> Result<BTreeMap<&'a str, u8>, FormatError> {
    let mut schema = english.clone();
    for (name, allowed) in japanese {
        add_constraint(&mut schema, name, *allowed)?;
    }
    Ok(schema)
}

fn placeholder(text: &str) -> Result<Placeholder<'_>, FormatError> {
    let (name, suffix) = match text.split_once(':') {
        Some((name, spec)) => (name, Some(spec)),
        None => (text, None),
    };
    if !argument_name(name) {
        return Err(FormatError::InvalidTemplate);
    }
    Ok(Placeholder {
        name,
        spec: suffix.map(parse_printf_spec).transpose()?,
    })
}

fn parse_printf_spec(text: &str) -> Result<PrintfSpec<'_>, FormatError> {
    if text.len() > 256 || !text.starts_with('%') {
        return Err(FormatError::InvalidFormatSpec);
    }
    let bytes = text.as_bytes();
    let mut cursor = 1;
    let mut flags = PrintfFlags::default();
    while let Some(byte) = bytes.get(cursor) {
        match byte {
            b'-' => flags.left = true,
            b'+' => flags.plus = true,
            b' ' => flags.space = true,
            b'#' => flags.alternate = true,
            b'0' => flags.zero = true,
            _ => break,
        }
        cursor += 1;
    }
    let width = parse_field(text, &mut cursor)?;
    let precision = if bytes.get(cursor) == Some(&b'.') {
        cursor += 1;
        Some(parse_field(text, &mut cursor)?.unwrap_or(FieldSize::Constant(0)))
    } else {
        None
    };
    let tail = &text[cursor..];
    let (length, consumed) = if tail.starts_with("hh") {
        (IntegerLength::Byte, 2)
    } else if tail.starts_with("ll") {
        (IntegerLength::LongLong, 2)
    } else {
        match bytes.get(cursor) {
            Some(b'h') => (IntegerLength::Short, 1),
            Some(b'l') => (IntegerLength::Long, 1),
            Some(b'j') => (IntegerLength::Max, 1),
            Some(b'z') => (IntegerLength::Size, 1),
            Some(b't') => (IntegerLength::Difference, 1),
            _ => (IntegerLength::Default, 0),
        }
    };
    cursor += consumed;
    let conversion = match bytes.get(cursor) {
        Some(b'd' | b'i') => Conversion::Signed,
        Some(b'u') => Conversion::Unsigned,
        Some(b'o') => Conversion::Octal,
        Some(b'x') => Conversion::HexLower,
        Some(b'X') => Conversion::HexUpper,
        Some(b's') => Conversion::Text,
        Some(b'c') => Conversion::Character,
        _ => return Err(FormatError::InvalidFormatSpec),
    };
    if cursor + 1 != bytes.len() {
        return Err(FormatError::InvalidFormatSpec);
    }
    if matches!(conversion, Conversion::Text | Conversion::Character)
        && (length != IntegerLength::Default
            || flags.plus
            || flags.space
            || flags.alternate
            || flags.zero
            || conversion == Conversion::Character && precision.is_some())
    {
        return Err(FormatError::InvalidFormatSpec);
    }
    Ok(PrintfSpec {
        flags,
        width,
        precision,
        length,
        conversion,
    })
}

fn parse_field<'a>(
    text: &'a str,
    cursor: &mut usize,
) -> Result<Option<FieldSize<'a>>, FormatError> {
    let bytes = text.as_bytes();
    if bytes.get(*cursor) == Some(&b'*') {
        *cursor += 1;
        if bytes.get(*cursor) != Some(&b'[') {
            return Err(FormatError::InvalidFormatSpec);
        }
        let start = *cursor + 1;
        let end = text[start..]
            .find(']')
            .map(|offset| start + offset)
            .ok_or(FormatError::InvalidFormatSpec)?;
        let name = &text[start..end];
        if !argument_name(name) {
            return Err(FormatError::InvalidFormatSpec);
        }
        *cursor = end + 1;
        return Ok(Some(FieldSize::Argument(name)));
    }
    let start = *cursor;
    while bytes.get(*cursor).is_some_and(u8::is_ascii_digit) {
        *cursor += 1;
    }
    if start == *cursor {
        return Ok(None);
    }
    let value = text[start..*cursor]
        .parse::<usize>()
        .map_err(|_| FormatError::TooLarge)?;
    if value > MAX_RENDERED_BYTES {
        return Err(FormatError::TooLarge);
    }
    Ok(Some(FieldSize::Constant(value)))
}

fn resolve_width(
    field: Option<FieldSize<'_>>,
    args: &BTreeMap<String, TextArgument>,
) -> Result<(usize, bool), FormatError> {
    match field {
        None => Ok((0, false)),
        Some(FieldSize::Constant(value)) => Ok((value, false)),
        Some(FieldSize::Argument(name)) => {
            let Some(TextArgument::Integer(value)) = args.get(name) else {
                return Err(FormatError::ArgumentType);
            };
            let magnitude =
                usize::try_from(value.unsigned_abs()).map_err(|_| FormatError::TooLarge)?;
            if magnitude > MAX_RENDERED_BYTES {
                return Err(FormatError::TooLarge);
            }
            Ok((magnitude, *value < 0))
        }
    }
}

fn resolve_precision(
    field: Option<FieldSize<'_>>,
    args: &BTreeMap<String, TextArgument>,
) -> Result<Option<usize>, FormatError> {
    match field {
        None => Ok(None),
        Some(FieldSize::Constant(value)) => Ok(Some(value)),
        Some(FieldSize::Argument(name)) => {
            let Some(TextArgument::Integer(value)) = args.get(name) else {
                return Err(FormatError::ArgumentType);
            };
            if *value < 0 {
                return Ok(None);
            }
            let value = usize::try_from(*value).map_err(|_| FormatError::TooLarge)?;
            if value > MAX_RENDERED_BYTES {
                return Err(FormatError::TooLarge);
            }
            Ok(Some(value))
        }
    }
}

fn character_byte(arg: &TextArgument) -> Result<String, FormatError> {
    // printf %c casts its promoted integer to unsigned char. Values are not
    // Unicode scalar indexes. Non-ASCII bytes stay an explicit native fallback
    // until their source encoding has a dedicated platform text contract.
    let byte = match arg {
        TextArgument::Integer(value) => value.to_le_bytes()[0],
        TextArgument::Unsigned(value) => value.to_le_bytes()[0],
        _ => return Err(FormatError::ArgumentType),
    };
    if byte == 0 || !byte.is_ascii() {
        return Err(FormatError::InvalidCharacter);
    }
    Ok(char::from(byte).to_string())
}

fn truncate_utf8(mut text: String, precision: Option<usize>) -> String {
    if let Some(precision) = precision {
        let mut end = precision.min(text.len());
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        text.truncate(end);
    }
    text
}

fn pad_text(text: String, width: usize, left: bool) -> Result<String, FormatError> {
    let padding = width.saturating_sub(text.len());
    if text.len().saturating_add(padding) > MAX_RENDERED_BYTES {
        return Err(FormatError::TooLarge);
    }
    let spaces = " ".repeat(padding);
    Ok(if left { text + &spaces } else { spaces + &text })
}

fn format_integer(
    arg: &TextArgument,
    spec: PrintfSpec<'_>,
    width: usize,
    precision: Option<usize>,
    left: bool,
) -> Result<String, FormatError> {
    let (magnitude, negative) = if spec.conversion == Conversion::Signed {
        let TextArgument::Integer(value) = arg else {
            return Err(FormatError::ArgumentType);
        };
        let bytes = value.to_le_bytes();
        let value = match spec.length {
            IntegerLength::Byte => i64::from(i8::from_le_bytes([bytes[0]])),
            IntegerLength::Short => i64::from(i16::from_le_bytes([bytes[0], bytes[1]])),
            _ => *value,
        };
        (value.unsigned_abs(), value < 0)
    } else {
        let TextArgument::Unsigned(value) = arg else {
            return Err(FormatError::ArgumentType);
        };
        let bytes = value.to_le_bytes();
        let value = match spec.length {
            IntegerLength::Byte => u64::from(bytes[0]),
            IntegerLength::Short => u64::from(u16::from_le_bytes([bytes[0], bytes[1]])),
            _ => *value,
        };
        (value, false)
    };
    let mut digits = match spec.conversion {
        Conversion::Octal => format!("{magnitude:o}"),
        Conversion::HexLower => format!("{magnitude:x}"),
        Conversion::HexUpper => format!("{magnitude:X}"),
        _ => magnitude.to_string(),
    };
    if magnitude == 0 && precision == Some(0) {
        digits.clear();
    }
    if let Some(precision) = precision {
        digits = "0".repeat(precision.saturating_sub(digits.len())) + &digits;
    }
    let mut prefix = String::new();
    if spec.conversion == Conversion::Signed {
        if negative {
            prefix.push('-');
        } else if spec.flags.plus {
            prefix.push('+');
        } else if spec.flags.space {
            prefix.push(' ');
        }
    }
    if spec.flags.alternate {
        match spec.conversion {
            Conversion::Octal if !digits.starts_with('0') => prefix.push('0'),
            Conversion::HexLower if magnitude != 0 => prefix.push_str("0x"),
            Conversion::HexUpper if magnitude != 0 => prefix.push_str("0X"),
            _ => {}
        }
    }
    let length = prefix.len().saturating_add(digits.len());
    let padding = width.saturating_sub(length);
    if length.saturating_add(padding) > MAX_RENDERED_BYTES {
        return Err(FormatError::TooLarge);
    }
    if left {
        return Ok(prefix + &digits + &" ".repeat(padding));
    }
    if spec.flags.zero && precision.is_none() {
        return Ok(prefix + &"0".repeat(padding) + &digits);
    }
    Ok(" ".repeat(padding) + &prefix + &digits)
}

fn substitute<'a>(
    template: &'a str,
    resolve: impl FnMut(Placeholder<'a>) -> Result<String, FormatError>,
) -> Result<String, FormatError> {
    visit_template(template, resolve)
}

fn visit_template<'a>(
    template: &'a str,
    mut resolve: impl FnMut(Placeholder<'a>) -> Result<String, FormatError>,
) -> Result<String, FormatError> {
    let mut output = String::with_capacity(template.len());
    let mut offset = 0;
    while offset < template.len() {
        let tail = &template[offset..];
        match tail.as_bytes()[0] {
            b'{' if tail.starts_with("{{") => {
                output.push('{');
                offset += 2;
            }
            b'}' if tail.starts_with("}}") => {
                output.push('}');
                offset += 2;
            }
            b'{' => {
                let end = tail.find('}').ok_or(FormatError::InvalidTemplate)?;
                output.push_str(&resolve(placeholder(&tail[1..end])?)?);
                offset += end + 1;
            }
            b'}' => return Err(FormatError::InvalidTemplate),
            _ => {
                let end = tail.find(['{', '}']).unwrap_or(tail.len());
                output.push_str(&tail[..end]);
                offset += end;
            }
        }
        if output.len() > MAX_RENDERED_BYTES {
            return Err(FormatError::TooLarge);
        }
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn catalog() -> Catalog {
        Catalog::from_json(r#"{"en":{"game.you_hit":"You hit {monster} for {damage}; {label}.","entity.orc":"orc","ui.only_english":"Source {{text}}"},"ja":{"game.you_hit":"{monster}に{damage}のダメージ。{label}。","entity.orc":"オーク"}}"#.as_bytes()).expect("test catalog")
    }

    #[test]
    fn japanese_typed_args_and_arbitrary_utf8_remain_literal() {
        let event: TextEvent = serde_json::from_str(r#"{"id":"game.you_hit","args":{"monster":{"type":"text_id","value":"entity.orc"},"damage":{"type":"integer","value":4},"label":{"type":"text","value":"100% {自由} 🐈"}}}"#).expect("test event");
        let rendered = catalog().render(&event, Locale::default()).expect("render");
        assert_eq!(rendered.text, "オークに4のダメージ。100% {自由} 🐈。");
        assert!(!rendered.used_fallback);
        assert_eq!(
            catalog().render(&event, Locale::En).expect("render").text,
            "You hit orc for 4; 100% {自由} 🐈."
        );
    }

    #[test]
    fn fallback_is_explicit_and_missing_ids_are_errors() {
        let event: TextEvent = serde_json::from_str(r#"{"id":"ui.only_english"}"#).expect("event");
        let rendered = catalog().render(&event, Locale::Ja).expect("fallback");
        assert_eq!(rendered.text, "Source {text}");
        assert!(rendered.used_fallback);
        let missing: TextEvent =
            serde_json::from_str(r#"{"id":"game.not_in_catalog"}"#).expect("event");
        assert_eq!(
            catalog().render(&missing, Locale::Ja),
            Err(FormatError::MissingId)
        );
    }

    #[test]
    fn invalid_templates_missing_or_extra_args_are_rejected() {
        assert_eq!(
            Catalog::from_json(br#"{"en":{"ui.test":"{count}"},"ja":{"ui.test":"{name}"}}"#)
                .unwrap_err(),
            FormatError::ArgumentSchema
        );
        assert_eq!(
            Catalog::from_json(br#"{"en":{"ui.test":"broken {"},"ja":{}}"#).unwrap_err(),
            FormatError::InvalidTemplate
        );
        let event: TextEvent = serde_json::from_str(
            r#"{"id":"ui.only_english","args":{"oops":{"type":"integer","value":1}}}"#,
        )
        .expect("event");
        assert_eq!(
            catalog().render(&event, Locale::Ja),
            Err(FormatError::ArgumentSchema)
        );
    }

    #[test]
    fn repeated_rendering_is_deterministic_without_mutating_events() {
        let event: TextEvent = serde_json::from_str(r#"{"id":"ui.only_english"}"#).expect("event");
        let before = event.clone();
        let catalog = catalog();
        for _ in 0..100 {
            assert_eq!(
                catalog.render(&event, Locale::Ja).expect("render").text,
                "Source {text}"
            );
        }
        assert_eq!(event, before);
    }

    fn same_template_catalog(template: &str) -> Catalog {
        let json = serde_json::json!({"en":{"game.test":template},"ja":{"game.test":template}});
        Catalog::from_json(&serde_json::to_vec(&json).expect("catalog JSON")).expect("catalog")
    }

    #[test]
    fn typed_printf_integer_flags_width_precision_and_radices_match_native_examples() {
        let catalog =
            same_template_catalog("[{arg_1:%+06ld}] [{arg_2:%#08x}] [{arg_3:%03o}] [{arg_4:%.0i}]");
        let event: TextEvent = serde_json::from_str(r#"{"id":"game.test","args":{"arg_1":{"type":"integer","value":-42},"arg_2":{"type":"unsigned","value":42},"arg_3":{"type":"unsigned","value":9},"arg_4":{"type":"integer","value":0}}}"#).expect("event");
        assert_eq!(
            catalog.render(&event, Locale::En).expect("printf").text,
            "[-00042] [0x00002a] [011] []"
        );
        let exact = same_template_catalog("{arg_1:%lld}/{arg_2:%llu}");
        let extremes: TextEvent = serde_json::from_str(r#"{"id":"game.test","args":{"arg_1":{"type":"integer","value":-9223372036854775808},"arg_2":{"type":"unsigned","value":18446744073709551615}}}"#).expect("exact numeric event");
        assert_eq!(
            exact.render(&extremes, Locale::En).expect("printf").text,
            "-9223372036854775808/18446744073709551615"
        );
    }

    #[test]
    fn dynamic_width_and_precision_use_separate_signed_arguments_and_bounds() {
        let catalog = same_template_catalog("[{arg_3:%*[arg_1].*[arg_2]s}]");
        let mut event: TextEvent = serde_json::from_str(r#"{"id":"game.test","args":{"arg_1":{"type":"integer","value":-8},"arg_2":{"type":"integer","value":3},"arg_3":{"type":"text","value":"abcdef"}}}"#).expect("event");
        assert_eq!(
            catalog.render(&event, Locale::En).expect("printf").text,
            "[abc     ]"
        );
        event
            .args
            .insert("arg_2".to_owned(), TextArgument::Integer(-1));
        assert_eq!(
            catalog.render(&event, Locale::En).expect("printf").text,
            "[abcdef  ]"
        );
        event
            .args
            .insert("arg_1".to_owned(), TextArgument::Integer(i64::MIN));
        assert_eq!(
            catalog.render(&event, Locale::En),
            Err(FormatError::TooLarge)
        );
        event
            .args
            .insert("arg_1".to_owned(), TextArgument::Unsigned(8));
        assert_eq!(
            catalog.render(&event, Locale::En),
            Err(FormatError::ArgumentType)
        );
    }

    #[test]
    fn native_character_conversion_casts_to_byte_and_does_not_print_decimal_integer() {
        let catalog = same_template_catalog("ouch{arg_1:%c}");
        for (value, expected) in [
            (33, "ouch!"),
            (46, "ouch."),
            (289, "ouch!"),
            (-223, "ouch!"),
        ] {
            let event = TextEvent {
                id: TextId::try_from("game.test".to_owned()).expect("id"),
                args: BTreeMap::from([("arg_1".to_owned(), TextArgument::Integer(value))]),
            };
            assert_eq!(
                catalog.render(&event, Locale::En).expect("character").text,
                expected
            );
        }
        for value in [0, 128, -1] {
            let event = TextEvent {
                id: TextId::try_from("game.test".to_owned()).expect("id"),
                args: BTreeMap::from([("arg_1".to_owned(), TextArgument::Integer(value))]),
            };
            assert_eq!(
                catalog.render(&event, Locale::En),
                Err(FormatError::InvalidCharacter)
            );
        }
    }

    #[test]
    fn text_precision_never_splits_utf8_and_free_text_is_never_a_format_string() {
        let catalog = same_template_catalog("[{arg_1:%5.3s}] {arg_2:%s}");
        let event: TextEvent = serde_json::from_str(r#"{"id":"game.test","args":{"arg_1":{"type":"text","value":"猫abcd"},"arg_2":{"type":"text","value":"100% %n {damage} 🐈"}}}"#).expect("event");
        assert_eq!(
            catalog.render(&event, Locale::Ja).expect("UTF-8").text,
            "[  猫] 100% %n {damage} 🐈"
        );
        let short = same_template_catalog("[{arg_1:%.2s}]");
        let event: TextEvent = serde_json::from_str(
            r#"{"id":"game.test","args":{"arg_1":{"type":"text","value":"猫"}}}"#,
        )
        .expect("event");
        assert_eq!(short.render(&event, Locale::En).expect("UTF-8").text, "[]");
    }

    #[test]
    fn catalog_format_types_and_unsupported_native_side_effects_are_rejected() {
        for spec in [
            "%n",
            "%p",
            "%f",
            "%ls",
            "%*s",
            "%1$d",
            "%+s",
            "%999999999999999999999d",
        ] {
            let json = serde_json::json!({"en":{"game.test":format!("{{arg_1:{spec}}}")},"ja":{}});
            assert!(
                Catalog::from_json(&serde_json::to_vec(&json).expect("JSON")).is_err(),
                "{spec}"
            );
        }
        let incompatible = br#"{"en":{"game.test":"{arg_1:%s}"},"ja":{"game.test":"{arg_1:%d}"}}"#;
        assert_eq!(
            Catalog::from_json(incompatible).unwrap_err(),
            FormatError::ArgumentSchema
        );
    }

    #[test]
    fn declared_source_union_preserves_different_english_and_japanese_quest_grammar() {
        let catalog = Catalog::from_json(r#"{"en":{"quest.challenge":"{quest_nemesis_modifier_a} challenges you."},"ja":{"quest.challenge":"{quest_nemesis}が挑んでくる。"},"argument_schemas":{"quest.challenge":["quest_nemesis_modifier_a","quest_nemesis"]}}"#.as_bytes()).expect("declared catalog");
        let mut event: TextEvent = serde_json::from_str(r#"{"id":"quest.challenge","args":{"quest_nemesis_modifier_a":{"type":"text","value":"the Dark One"},"quest_nemesis":{"type":"text","value":"暗黒の魔術師"}}}"#).expect("public captured values");
        assert_eq!(
            catalog.render(&event, Locale::En).expect("English").text,
            "the Dark One challenges you."
        );
        assert_eq!(
            catalog.render(&event, Locale::Ja).expect("Japanese").text,
            "暗黒の魔術師が挑んでくる。"
        );
        event.args.remove("quest_nemesis");
        assert_eq!(
            catalog.render(&event, Locale::En),
            Err(FormatError::ArgumentSchema)
        );
        assert!(
            Catalog::from_json(br#"{"en":{"quest.test":"{name}"},"ja":{"quest.test":"{other}"}}"#)
                .is_err()
        );
        assert!(Catalog::from_json(br#"{"en":{"quest.test":"{name}"},"ja":{},"argument_schemas":{"quest.test":["other"]}}"#).is_err());
    }

    fn contextual_catalog() -> Catalog {
        Catalog::from_json(r#"{"en":{"game.hear.0123456789":"You hear a sound.","variant.dream.game.hear.0123456789":"You dream that you hear a sound.","variant.underwater.game.hear.0123456789":"You barely hear a sound.","context.location_prefix":"{location}: {text}"},"ja":{"game.hear.0123456789":"音が聞こえる。","variant.dream.game.hear.0123456789":"音が聞こえる夢を見る。","variant.underwater.game.hear.0123456789":"音がかすかに聞こえる。","context.location_prefix":"{location}：{text}"}}"#.as_bytes()).expect("context catalog")
    }

    #[test]
    fn frozen_helper_variants_use_explicit_catalog_entries_without_state_or_prefix_duplication() {
        let catalog = contextual_catalog();
        let envelope: GameplayEvent = serde_json::from_str(r#"{"event":{"id":"game.hear.0123456789"},"context":{"api":"You_hear","helperVariant":"dream"}}"#).expect("captured context");
        let before = envelope.clone();
        for _ in 0..100 {
            assert_eq!(
                catalog
                    .render_gameplay(&envelope, Locale::En)
                    .expect("English")
                    .text,
                "You dream that you hear a sound."
            );
            assert_eq!(
                catalog
                    .render_gameplay(&envelope, Locale::Ja)
                    .expect("Japanese")
                    .text,
                "音が聞こえる夢を見る。"
            );
        }
        assert_eq!(envelope, before);
        let missing: GameplayEvent = serde_json::from_str(r#"{"event":{"id":"game.hear.0123456789"},"context":{"api":"You_see","helperVariant":"blind"}}"#).expect("captured context");
        assert_eq!(
            catalog.render_gameplay(&missing, Locale::Ja),
            Err(FormatError::MissingId)
        );
    }

    #[test]
    fn captured_accessibility_qualifier_is_preserved_and_never_counted_as_translated() {
        let catalog = contextual_catalog();
        let envelope: GameplayEvent = serde_json::from_str(r#"{"event":{"id":"game.hear.0123456789"},"context":{"api":"You_hear","helperVariant":"plain","locationPrefix":"north 100% {where}"}}"#).expect("captured qualifier");
        let english = catalog
            .render_gameplay(&envelope, Locale::En)
            .expect("English");
        assert_eq!(english.text, "north 100% {where}: You hear a sound.");
        assert!(!english.used_fallback);
        let japanese = catalog
            .render_gameplay(&envelope, Locale::Ja)
            .expect("Japanese");
        assert_eq!(japanese.text, "north 100% {where}：音が聞こえる。");
        assert!(japanese.used_fallback);
    }

    #[test]
    fn generated_gameplay_catalog_has_valid_ids_typed_templates_and_explicit_public_unions() {
        let catalog = Catalog::from_json(include_bytes!("../../locales/gameplay-core.json"))
            .expect("generated source-bound catalog");
        assert!(catalog.en.len() >= 2_859);
        assert!(catalog.ja.len() >= 2_515);
        assert!(
            catalog
                .en
                .contains_key(&TextId::try_from("context.location_prefix".to_owned()).expect("id"))
        );
    }

    #[test]
    fn nested_public_name_events_use_locale_grammar_and_keep_custom_text_literal() {
        let catalog = Catalog::from_json(r#"{"en":{"game.hit":"You hit {target:%s}.","name.invisible":"invisible {name}","name.custom":"{name} called {label}","entity.orc":"orc"},"ja":{"game.hit":"{target:%s}を殴った。","name.invisible":"透明な{name}","name.custom":"{label}という{name}","entity.orc":"オーク"}}"#.as_bytes()).expect("name grammar");
        let event: TextEvent = serde_json::from_str(r#"{"id":"game.hit","args":{"target":{"type":"event","value":{"id":"name.invisible","args":{"name":{"type":"event","value":{"id":"name.custom","args":{"name":{"type":"text_id","value":"entity.orc"},"label":{"type":"text","value":"100% {custom} 🐈"}}}}}}}}}"#).expect("public name tree");
        let before = event.clone();
        assert_eq!(
            catalog.render(&event, Locale::En).expect("English").text,
            "You hit invisible orc called 100% {custom} 🐈."
        );
        let japanese = catalog.render(&event, Locale::Ja).expect("Japanese");
        assert_eq!(
            japanese.text,
            "透明な100% {custom} 🐈というオークを殴った。"
        );
        assert!(!japanese.used_fallback);
        assert_eq!(event, before);
    }

    #[test]
    fn nested_fallback_propagates_and_full_width_numeric_values_remain_exact() {
        let catalog = Catalog::from_json(r#"{"en":{"game.hit":"{target}","name.quantity":"{count:%llu} {name}","entity.unknown":"source name"},"ja":{"game.hit":"対象：{target}","name.quantity":"{count:%llu}体の{name}"}}"#.as_bytes()).expect("partial name catalog");
        let event: TextEvent = serde_json::from_str(r#"{"id":"game.hit","args":{"target":{"type":"event","value":{"id":"name.quantity","args":{"count":{"type":"unsigned","value":18446744073709551615},"name":{"type":"text_id","value":"entity.unknown"}}}}}}"#).expect("exact nested payload");
        let rendered = catalog.render(&event, Locale::Ja).expect("nested fallback");
        assert_eq!(rendered.text, "対象：18446744073709551615体のsource name");
        assert!(rendered.used_fallback);
        let serialized = serde_json::to_string(&event).expect("serialize");
        assert!(serialized.contains("18446744073709551615"));
        assert_eq!(
            serde_json::from_str::<TextEvent>(&serialized).expect("round trip"),
            event
        );
    }

    #[test]
    fn text_id_leaf_cannot_bypass_declared_source_arguments_in_another_locale() {
        let catalog = Catalog::from_json(br#"{"en":{"game.hit":"{target}","quest.name":"{source_name}"},"ja":{"game.hit":"{target}","quest.name":"localized name"},"argument_schemas":{"quest.name":["source_name"]}}"#).expect("explicit source union");
        let event: TextEvent = serde_json::from_str(
            r#"{"id":"game.hit","args":{"target":{"type":"text_id","value":"quest.name"}}}"#,
        )
        .expect("leaf reference");
        assert_eq!(
            catalog.render(&event, Locale::Ja),
            Err(FormatError::ArgumentSchema)
        );
    }

    #[test]
    fn rendering_rejects_depth_nine_before_selecting_locale_or_unused_union_slots() {
        let catalog = Catalog::from_json(br#"{"en":{"name.wrap":"{name}","name.leaf":"leaf","quest.only":"complete"},"ja":{"name.wrap":"{name}","name.leaf":"leaf","quest.only":"complete"},"argument_schemas":{"quest.only":["unused"]}}"#).expect("bounded catalog");
        let mut event: TextEvent = serde_json::from_str(r#"{"id":"name.leaf"}"#).expect("leaf");
        for _ in 0..MAX_EVENT_DEPTH {
            event = TextEvent {
                id: TextId::try_from("name.wrap".to_owned()).expect("id"),
                args: BTreeMap::from([("name".to_owned(), TextArgument::Event(Box::new(event)))]),
            };
        }
        assert_eq!(
            catalog
                .render(&event, Locale::Ja)
                .expect("depth eight")
                .text,
            "leaf"
        );
        let unused = TextEvent {
            id: TextId::try_from("quest.only".to_owned()).expect("id"),
            args: BTreeMap::from([("unused".to_owned(), TextArgument::Event(Box::new(event)))]),
        };
        assert_eq!(
            catalog.render(&unused, Locale::Ja),
            Err(FormatError::TooDeep)
        );
    }

    #[test]
    fn incomplete_quest_groups_and_missing_union_values_never_replace_native_text() {
        let catalog = Catalog::from_json(r#"{"en":{"quest.challenge":"{quest_nemesis_modifier_a} challenges you."},"ja":{"quest.challenge":"{quest_nemesis}が挑んでくる。"},"argument_schemas":{"quest.challenge":["quest_nemesis_modifier_a","quest_nemesis"]}}"#.as_bytes()).expect("quest union");
        let mut envelope: GameplayEvent = serde_json::from_str(r#"{"event":{"id":"quest.challenge","args":{"quest_nemesis_modifier_a":{"type":"text","value":"the Dark One"},"quest_nemesis":{"type":"text","value":"暗黒の魔術師"}}},"context":{"api":"putstr","quest":{"sequence":9,"lineIndex":0,"lineCount":2,"final":false,"captureComplete":false,"window":2,"resolvedSection":"Wiz","resolvedMessageId":"nemesis_wantsit","itemIndex":0,"field":"text","sourceTemplate":"%na challenges you.","decodedLine":"the Dark One challenges you."}}}"#).expect("captured quest row");
        assert_eq!(
            catalog.render_gameplay(&envelope, Locale::Ja),
            Err(FormatError::InvalidContext)
        );
        let quest = envelope.context.quest.as_mut().expect("quest");
        quest.line_index = 1;
        quest.is_final = true;
        assert_eq!(
            catalog.render_gameplay(&envelope, Locale::Ja),
            Err(FormatError::InvalidContext)
        );
        envelope
            .context
            .quest
            .as_mut()
            .expect("quest")
            .capture_complete = true;
        let before = envelope.clone();
        assert_eq!(
            catalog
                .render_gameplay(&envelope, Locale::Ja)
                .expect("complete quest")
                .text,
            "暗黒の魔術師が挑んでくる。"
        );
        assert_eq!(envelope, before);
        envelope.event.args.remove("quest_nemesis");
        assert_eq!(
            catalog.render_gameplay(&envelope, Locale::En),
            Err(FormatError::ArgumentSchema)
        );
    }

    #[test]
    fn empty_repeated_nested_names_cannot_exceed_the_format_work_budget() {
        let repeated = "{name}".repeat(8);
        let json = serde_json::json!({"en":{"name.wrap":repeated,"name.leaf":""},"ja":{"name.wrap":repeated,"name.leaf":""}});
        let catalog =
            Catalog::from_json(&serde_json::to_vec(&json).expect("JSON")).expect("name grammar");
        let mut event: TextEvent =
            serde_json::from_str(r#"{"id":"name.leaf"}"#).expect("empty public leaf");
        for _ in 0..MAX_EVENT_DEPTH {
            event = TextEvent {
                id: TextId::try_from("name.wrap".to_owned()).expect("id"),
                args: BTreeMap::from([("name".to_owned(), TextArgument::Event(Box::new(event)))]),
            };
        }
        assert_eq!(event.validate_tree(), Ok(()));
        assert_eq!(
            catalog.render(&event, Locale::Ja),
            Err(FormatError::TooLarge)
        );
    }

    #[test]
    fn undeclared_shared_arguments_obey_both_locale_type_constraints() {
        let catalog = Catalog::from_json(
            br#"{"en":{"game.count":"{count}"},"ja":{"game.count":"{count:%d}"}}"#,
        )
        .expect("compatible integer subset");
        let event: TextEvent = serde_json::from_str(
            r#"{"id":"game.count","args":{"count":{"type":"boolean","value":true}}}"#,
        )
        .expect("incorrect wire type");
        assert_eq!(
            catalog.render(&event, Locale::En),
            Err(FormatError::ArgumentType)
        );
        assert_eq!(
            catalog.render(&event, Locale::Ja),
            Err(FormatError::ArgumentType)
        );
    }

    #[test]
    fn accessibility_composition_preserves_the_full_rendered_body_size_bound() {
        let catalog = Catalog::from_json(br#"{"en":{"game.long":"{first}{second}","context.location_prefix":"{location}: {text}"},"ja":{"game.long":"{first}{second}","context.location_prefix":"{location}: {text}"}}"#).expect("qualifier rule");
        let envelope: GameplayEvent = serde_json::from_value(serde_json::json!({
            "event":{"id":"game.long","args":{
                "first":{"type":"text","value":"a".repeat(33_000)},
                "second":{"type":"text","value":"b".repeat(33_000)}
            }},
            "context":{"api":"pline","locationPrefix":"north"}
        }))
        .expect("public arguments within per-string bounds");
        let rendered = catalog
            .render_gameplay(&envelope, Locale::Ja)
            .expect("body above 64 KiB");
        assert_eq!(rendered.text.len(), 66_007);
        assert!(rendered.text.starts_with("north: a"));
        assert!(rendered.text.ends_with(&"b".repeat(33_000)));
        assert!(rendered.used_fallback);
    }
}
