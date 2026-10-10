//! Pure composition of source-selected effect descriptions.
//!
//! The C adapter captures the selected reviewed references and native buffer
//! boundaries once. This module owns that graph; it has no entity, simulation,
//! clock, file, pointer, or random-number interface. Native capacities include
//! the terminating NUL. English lexical output is reviewed ASCII, so clipping
//! at `capacity - 1` reproduces the native byte prefix exactly. Japanese formats
//! the same selected graph without applying those English buffer capacities.

use crate::localization::json::{self, JsonValue as J, Limits};
use crate::text::Locale;
use crate::text_parameters::{MAX_OUTPUT_BYTES, MAX_VALUE_BYTES};
use std::borrow::Cow;
use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

pub const MAX_CAPTURE_BYTES: usize = 128 * 1024;
pub const MAX_NODES: usize = 512;
pub const MAX_DEPTH: usize = 16;
pub const MAX_PARAMETERS: usize = 6;
pub const MAX_NATIVE_BUFFER_BYTES: usize = 65_536;
pub const EMPTY_REFERENCE_ID: &str = "angband.effect_info.grammar.empty";

// A semantic child can be inside a typed parameter, nested graph header, and
// parts array. These JSON representation limits do not reduce the semantic
// sixteen-level limit, which is checked separately before owning the graph.
const MAX_JSON_DEPTH: usize = MAX_DEPTH * 5 + 4;
const MAX_JSON_NODES: usize = MAX_NODES * (MAX_PARAMETERS * 4 + 8) + 8;
const MAX_ID_BYTES: usize = 255;
const MAX_PARAMETER_NAME_BYTES: usize = 63;
const ID_PREFIX: &str = "angband.effect_info.";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EffectDescriptionError {
    InvalidJson(String),
    InvalidCapture(&'static str),
    CaptureByteLimit,
    NodeLimit,
    DepthLimit,
    OutputLimit,
    ParameterTextLimit,
    UnknownIdentity(String),
    Resolver(String),
    NonAsciiEnglish(String),
    UnexpectedEmptyReference(String),
    EmbeddedNul,
}

impl fmt::Display for EffectDescriptionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson(reason) => write!(f, "effect JSON: {reason}"),
            Self::InvalidCapture(reason) => write!(f, "invalid effect capture: {reason}"),
            Self::CaptureByteLimit => f.write_str("effect capture byte limit"),
            Self::NodeLimit => f.write_str("effect graph node limit"),
            Self::DepthLimit => f.write_str("effect graph depth limit"),
            Self::OutputLimit => f.write_str("effect description output limit"),
            Self::ParameterTextLimit => f.write_str("effect parameter text limit"),
            Self::UnknownIdentity(id) => write!(f, "unknown effect identity: {id}"),
            Self::Resolver(reason) => write!(f, "effect reference resolver: {reason}"),
            Self::NonAsciiEnglish(id) => write!(f, "non-ASCII English effect reference: {id}"),
            Self::UnexpectedEmptyReference(id) => {
                write!(f, "undeclared empty effect reference: {id}")
            }
            Self::EmbeddedNul => f.write_str("effect text contains NUL"),
        }
    }
}

impl std::error::Error for EffectDescriptionError {}

/// Values are already composed when the reviewed template resolver sees them.
/// The resolver must check these source types against the entry's declaration,
/// reject an unknown identity, and format its compiled locale template once.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ResolvedEffectParameter {
    Integer(i32),
    LocalizedText(String),
    EffectDescription(String),
}

impl ResolvedEffectParameter {
    #[must_use]
    pub const fn source_type(&self) -> &'static str {
        match self {
            Self::Integer(_) => "integer",
            Self::LocalizedText(_) => "localized_text",
            Self::EffectDescription(_) => "EffectDescription",
        }
    }

    #[must_use]
    pub fn rendered(&self) -> Cow<'_, str> {
        match self {
            Self::Integer(value) => Cow::Owned(value.to_string()),
            Self::LocalizedText(text) | Self::EffectDescription(text) => Cow::Borrowed(text),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum Parameter {
    Integer(i32),
    LocalizedText(Box<Reference>),
    EffectDescription(Box<EffectDescription>),
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct Reference {
    id: String,
    params: BTreeMap<String, Parameter>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum Node {
    Reference(Reference),
    Bounded {
        native_max_bytes: usize,
        parts: Vec<Node>,
    },
}

/// Immutable validated source facts. The private tree cannot be amended after
/// decoding; locale changes only compose these owned nodes again.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EffectDescription {
    parts: Vec<Node>,
}

#[derive(Default)]
struct CaptureBudget {
    nodes: usize,
}

impl CaptureBudget {
    fn enter(&mut self, depth: usize) -> Result<(), EffectDescriptionError> {
        if depth > MAX_DEPTH {
            return Err(EffectDescriptionError::DepthLimit);
        }
        self.nodes += 1;
        if self.nodes > MAX_NODES {
            return Err(EffectDescriptionError::NodeLimit);
        }
        Ok(())
    }
}

fn invalid(reason: &'static str) -> EffectDescriptionError {
    EffectDescriptionError::InvalidCapture(reason)
}

fn required<'a>(value: &'a J, key: &str) -> Result<&'a J, EffectDescriptionError> {
    value.field(key).ok_or_else(|| invalid("missing field"))
}

fn fields<'a>(
    value: &'a J,
    required_keys: &[&str],
    optional_keys: &[&str],
) -> Result<&'a [(String, J)], EffectDescriptionError> {
    let rows = value
        .as_object()
        .ok_or_else(|| invalid("expected object"))?;
    let mut names = BTreeSet::new();
    for (name, _) in rows {
        if !names.insert(name.as_str()) {
            return Err(invalid("duplicate field"));
        }
        if !required_keys.contains(&name.as_str()) && !optional_keys.contains(&name.as_str()) {
            return Err(invalid("unknown field"));
        }
    }
    if required_keys.iter().any(|name| !names.contains(name)) {
        return Err(invalid("missing field"));
    }
    Ok(rows)
}

fn identity(value: &J) -> Result<String, EffectDescriptionError> {
    let id = value
        .as_str()
        .ok_or_else(|| invalid("identity requires string"))?;
    if id.len() > MAX_ID_BYTES
        || !id.starts_with(ID_PREFIX)
        || id.len() == ID_PREFIX.len()
        || id.split('.').any(str::is_empty)
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
    {
        return Err(invalid("effect catalog identity"));
    }
    Ok(id.to_owned())
}

fn parameter_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_PARAMETER_NAME_BYTES
        && name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

fn reference(
    value: &J,
    is_node: bool,
    depth: usize,
    budget: &mut CaptureBudget,
) -> Result<Reference, EffectDescriptionError> {
    budget.enter(depth)?;
    if is_node {
        fields(value, &["kind", "id", "params"], &[])?;
        if required(value, "kind")?.as_str() != Some("ref") {
            return Err(invalid("reference kind"));
        }
    } else {
        fields(value, &["id"], &["params"])?;
    }
    let id = identity(required(value, "id")?)?;
    let rows = match value.field("params") {
        Some(params) => params
            .as_object()
            .ok_or_else(|| invalid("expected parameter map"))?,
        None => &[],
    };
    if rows.len() > MAX_PARAMETERS {
        return Err(invalid("parameter count"));
    }
    let mut params = BTreeMap::new();
    for (name, capture) in rows {
        if !parameter_name(name) || params.contains_key(name) {
            return Err(invalid("parameter name or duplicate"));
        }
        fields(capture, &["type", "value"], &[])?;
        let captured = required(capture, "value")?;
        let parameter = match required(capture, "type")?.as_str() {
            Some("integer") => {
                let number = captured
                    .as_integer()
                    .ok_or_else(|| invalid("expected integer"))?;
                Parameter::Integer(i32::try_from(number).map_err(|_| invalid("native i32 range"))?)
            }
            Some("localized_text") => {
                Parameter::LocalizedText(Box::new(reference(captured, false, depth + 1, budget)?))
            }
            Some("EffectDescription") => {
                Parameter::EffectDescription(Box::new(description(captured, depth + 1, budget)?))
            }
            _ => return Err(invalid("unreviewed parameter type")),
        };
        params.insert(name.clone(), parameter);
    }
    Ok(Reference { id, params })
}

fn parts(
    value: &J,
    depth: usize,
    budget: &mut CaptureBudget,
) -> Result<Vec<Node>, EffectDescriptionError> {
    let rows = value
        .as_array()
        .ok_or_else(|| invalid("expected parts array"))?;
    if rows.is_empty() {
        return Err(invalid("empty parts"));
    }
    if rows.len() > MAX_NODES {
        return Err(EffectDescriptionError::NodeLimit);
    }
    let mut result = Vec::with_capacity(rows.len());
    for row in rows {
        let node = match required(row, "kind")?.as_str() {
            Some("ref") => Node::Reference(reference(row, true, depth, budget)?),
            Some("bounded") => {
                budget.enter(depth)?;
                fields(row, &["kind", "native_max_bytes", "parts"], &[])?;
                let maximum = required(row, "native_max_bytes")?
                    .as_integer()
                    .ok_or_else(|| invalid("native capacity requires integer"))?;
                let maximum =
                    usize::try_from(maximum).map_err(|_| invalid("native capacity range"))?;
                if !(1..=MAX_NATIVE_BUFFER_BYTES).contains(&maximum) {
                    return Err(invalid("native capacity range"));
                }
                Node::Bounded {
                    native_max_bytes: maximum,
                    parts: parts(required(row, "parts")?, depth + 1, budget)?,
                }
            }
            _ => return Err(invalid("unreviewed node kind")),
        };
        result.push(node);
    }
    Ok(result)
}

fn description(
    value: &J,
    depth: usize,
    budget: &mut CaptureBudget,
) -> Result<EffectDescription, EffectDescriptionError> {
    fields(value, &["schema_version", "parts"], &[])?;
    if required(value, "schema_version")?.as_integer() != Some(1) {
        return Err(invalid("schema version"));
    }
    Ok(EffectDescription {
        parts: parts(required(value, "parts")?, depth, budget)?,
    })
}

#[derive(Default)]
struct WireBudget {
    bytes: usize,
    nodes: usize,
}

impl WireBudget {
    fn add(&mut self, count: usize) -> Result<(), EffectDescriptionError> {
        self.bytes = self
            .bytes
            .checked_add(count)
            .ok_or(EffectDescriptionError::CaptureByteLimit)?;
        if self.bytes > MAX_CAPTURE_BYTES {
            return Err(EffectDescriptionError::CaptureByteLimit);
        }
        Ok(())
    }

    fn string(&mut self, text: &str) -> Result<(), EffectDescriptionError> {
        if text.len() > MAX_CAPTURE_BYTES {
            return Err(EffectDescriptionError::CaptureByteLimit);
        }
        self.add(2)?;
        for ch in text.chars() {
            self.add(match ch {
                '"' | '\\' => 2,
                '\0'..='\u{1f}' => 6,
                _ => ch.len_utf8(),
            })?;
        }
        Ok(())
    }

    fn visit(&mut self, value: &J, depth: usize) -> Result<(), EffectDescriptionError> {
        if depth > MAX_JSON_DEPTH {
            return Err(EffectDescriptionError::DepthLimit);
        }
        self.nodes += 1;
        if self.nodes > MAX_JSON_NODES {
            return Err(EffectDescriptionError::NodeLimit);
        }
        match value {
            J::Null => self.add(4),
            J::Bool(value) => self.add(if *value { 4 } else { 5 }),
            J::Integer(value) => self.add(value.to_string().len()),
            J::String(value) => self.string(value),
            J::Array(rows) => {
                self.add(2)?;
                self.add(rows.len().saturating_sub(1))?;
                for row in rows {
                    self.visit(row, depth + 1)?;
                }
                Ok(())
            }
            J::Object(rows) => {
                self.add(2)?;
                self.add(rows.len().saturating_sub(1))?;
                for (key, row) in rows {
                    self.string(key)?;
                    self.add(1)?;
                    self.visit(row, depth + 1)?;
                }
                Ok(())
            }
        }
    }
}

impl EffectDescription {
    /// Decode owned source facts, including nested typed effect graphs.
    ///
    /// # Errors
    /// Rejects malformed/duplicate/unknown fields, foreign or empty identities,
    /// unreviewed parameter kinds, non-i32 integers, and all capture limits.
    /// Catalog membership is checked by the reviewed resolver during rendering.
    pub fn from_json(input: &str) -> Result<Self, EffectDescriptionError> {
        if input.len() > MAX_CAPTURE_BYTES {
            return Err(EffectDescriptionError::CaptureByteLimit);
        }
        let value = json::parse(
            input,
            Limits {
                max_bytes: MAX_CAPTURE_BYTES,
                max_depth: MAX_JSON_DEPTH,
                max_nodes: MAX_JSON_NODES,
                max_string_bytes: MAX_ID_BYTES,
            },
        )
        .map_err(|error| EffectDescriptionError::InvalidJson(error.to_string()))?;
        Self::from_value(&value)
    }

    pub(crate) fn from_value(value: &J) -> Result<Self, EffectDescriptionError> {
        WireBudget::default().visit(value, 0)?;
        description(value, 1, &mut CaptureBudget::default())
    }

    /// Compose only this cached graph. The callback receives already rendered,
    /// strictly typed values; it does not resolve nested effect graphs again.
    ///
    /// # Errors
    /// Propagates unknown-ID/schema/template errors from the reviewed resolver;
    /// rejects NUL, unreviewed English Unicode, undeclared empty references,
    /// and the existing 8192-byte parameter/32768-byte output text limits.
    pub fn render<F>(
        &self,
        locale: Locale,
        resolver: &mut F,
    ) -> Result<String, EffectDescriptionError>
    where
        F: FnMut(
            &str,
            &BTreeMap<String, ResolvedEffectParameter>,
        ) -> Result<String, EffectDescriptionError>,
    {
        render_parts(&self.parts, locale, None, resolver)
    }
}

fn render_reference<F>(
    reference: &Reference,
    locale: Locale,
    resolver: &mut F,
) -> Result<String, EffectDescriptionError>
where
    F: FnMut(
        &str,
        &BTreeMap<String, ResolvedEffectParameter>,
    ) -> Result<String, EffectDescriptionError>,
{
    let mut params = BTreeMap::new();
    for (name, parameter) in &reference.params {
        let value = match parameter {
            Parameter::Integer(number) => ResolvedEffectParameter::Integer(*number),
            Parameter::LocalizedText(child) => {
                let text = render_reference(child, locale, resolver)?;
                if text.len() > MAX_VALUE_BYTES {
                    return Err(EffectDescriptionError::ParameterTextLimit);
                }
                ResolvedEffectParameter::LocalizedText(text)
            }
            Parameter::EffectDescription(child) => {
                let text = child.render(locale, resolver)?;
                if text.len() > MAX_VALUE_BYTES {
                    return Err(EffectDescriptionError::ParameterTextLimit);
                }
                ResolvedEffectParameter::EffectDescription(text)
            }
        };
        params.insert(name.clone(), value);
    }
    let text = resolver(&reference.id, &params)?;
    if text.len() > MAX_OUTPUT_BYTES {
        return Err(EffectDescriptionError::OutputLimit);
    }
    if text.contains('\0') {
        return Err(EffectDescriptionError::EmbeddedNul);
    }
    if locale == Locale::English && !text.is_ascii() {
        return Err(EffectDescriptionError::NonAsciiEnglish(
            reference.id.clone(),
        ));
    }
    if text.is_empty() && reference.id != EMPTY_REFERENCE_ID {
        return Err(EffectDescriptionError::UnexpectedEmptyReference(
            reference.id.clone(),
        ));
    }
    Ok(text)
}

fn render_parts<F>(
    parts: &[Node],
    locale: Locale,
    native_capacity: Option<usize>,
    resolver: &mut F,
) -> Result<String, EffectDescriptionError>
where
    F: FnMut(
        &str,
        &BTreeMap<String, ResolvedEffectParameter>,
    ) -> Result<String, EffectDescriptionError>,
{
    let mut output = String::new();
    for part in parts {
        let text = match part {
            Node::Reference(reference) => render_reference(reference, locale, resolver)?,
            Node::Bounded {
                native_max_bytes,
                parts,
            } => {
                let capacity = (locale == Locale::English).then_some(native_max_bytes - 1);
                render_parts(parts, locale, capacity, resolver)?
            }
        };
        if let Some(capacity) = native_capacity {
            // Every English reference has been verified ASCII before reaching
            // this branch. Even at capacity zero every reference is resolved,
            // so clipping never conceals an unknown identity or bad parameter.
            let count = text.len().min(capacity.saturating_sub(output.len()));
            if output
                .len()
                .checked_add(count)
                .is_none_or(|size| size > MAX_OUTPUT_BYTES)
            {
                return Err(EffectDescriptionError::OutputLimit);
            }
            let prefix = text
                .get(..count)
                .ok_or_else(|| invalid("native prefix is not ASCII"))?;
            output.push_str(prefix);
        } else {
            if output
                .len()
                .checked_add(text.len())
                .is_none_or(|size| size > MAX_OUTPUT_BYTES)
            {
                return Err(EffectDescriptionError::OutputLimit);
            }
            output.push_str(&text);
        }
    }
    Ok(output)
}

/// Convenience adapter for the root-owned reviewed descriptor resolver.
pub(crate) fn format_effect_description<F>(
    value: &J,
    locale: Locale,
    resolver: &mut F,
) -> Result<String, EffectDescriptionError>
where
    F: FnMut(
        &str,
        &BTreeMap<String, ResolvedEffectParameter>,
    ) -> Result<String, EffectDescriptionError>,
{
    EffectDescription::from_value(value)?.render(locale, resolver)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn leaf(id: &str) -> String {
        format!(r#"{{"kind":"ref","id":"angband.effect_info.fixture.{id}","params":{{}}}}"#)
    }

    fn graph(parts: &str) -> String {
        format!(r#"{{"schema_version":1,"parts":[{parts}]}}"#)
    }

    fn bounded(capacity: usize, parts: &str) -> String {
        format!(r#"{{"kind":"bounded","native_max_bytes":{capacity},"parts":[{parts}]}}"#)
    }

    fn render(
        capture: &str,
        locale: Locale,
        texts: &[(&str, &str)],
    ) -> Result<String, EffectDescriptionError> {
        EffectDescription::from_json(capture)?.render(locale, &mut |id, params| {
            if !params.is_empty() {
                return Err(EffectDescriptionError::Resolver(
                    "unexpected fixture parameters".into(),
                ));
            }
            texts
                .iter()
                .find(|(key, _)| *key == id)
                .map(|(_, text)| (*text).to_owned())
                .ok_or_else(|| EffectDescriptionError::UnknownIdentity(id.to_owned()))
        })
    }

    #[test]
    fn native_capacity_counts_nul_and_clips_a_group_after_source_ordered_join() {
        let capture = graph(&format!(
            "{},{}",
            bounded(8, &format!("{},{}", leaf("left"), leaf("right"))),
            leaf("suffix")
        ));
        let texts = [
            ("angband.effect_info.fixture.left", "12345"),
            ("angband.effect_info.fixture.right", "67890"),
            ("angband.effect_info.fixture.suffix", "end"),
        ];
        assert_eq!(
            render(&capture, Locale::English, &texts).unwrap(),
            "1234567end"
        );
        assert_eq!(
            render(&graph(&bounded(1, &leaf("left"))), Locale::English, &texts).unwrap(),
            ""
        );
    }

    #[test]
    fn nested_buffers_clip_at_each_original_native_boundary() {
        let inner = bounded(5, &leaf("number"));
        let capture = graph(&bounded(
            8,
            &format!("{},{inner},{}", leaf("prefix"), leaf("suffix")),
        ));
        let texts = [
            ("angband.effect_info.fixture.number", "123456789"),
            ("angband.effect_info.fixture.prefix", "ab"),
            ("angband.effect_info.fixture.suffix", "ZXY"),
        ];
        assert_eq!(
            render(&capture, Locale::English, &texts).unwrap(),
            "ab1234Z"
        );
    }

    #[test]
    fn captured_dice_buffer_twenty_is_composed_before_description_buffer_two_fifty() {
        // A nested typed graph preserves the original dice_string[20] boundary
        // before insertion into the already-selected description[250] template.
        let dice_node = r#"{"kind":"ref","id":"angband.effect_info.grammar.dice.base_roll","params":{"base":{"type":"integer","value":2147483647},"dice":{"type":"integer","value":2147483647},"sides":{"type":"integer","value":9}}}"#;
        let dice = graph(&bounded(20, dice_node));
        let desc = format!(
            r#"{{"kind":"ref","id":"angband.effect_info.description.damage","params":{{"dice":{{"type":"EffectDescription","value":{dice}}}}}}}"#
        );
        let capture = EffectDescription::from_json(&graph(&bounded(250, &desc))).unwrap();
        let before = capture.clone();
        for locale in [Locale::English, Locale::Japanese, Locale::English] {
            let mut calls = Vec::new();
            let text = capture
                .render(locale, &mut |id, params| {
                    calls.push(id.to_owned());
                    match id {
                        "angband.effect_info.grammar.dice.base_roll" => {
                            for parameter in params.values() {
                                assert_eq!(parameter.source_type(), "integer");
                            }
                            Ok(format!(
                                "{}+{}d{}",
                                params["base"].rendered(),
                                params["dice"].rendered(),
                                params["sides"].rendered()
                            ))
                        }
                        "angband.effect_info.description.damage" => {
                            assert_eq!(params["dice"].source_type(), "EffectDescription");
                            Ok(match locale {
                                Locale::English => format!(
                                    "does {} damage to the player",
                                    params["dice"].rendered()
                                ),
                                Locale::Japanese => format!(
                                    "プレイヤーに{}のダメージを与える",
                                    params["dice"].rendered()
                                ),
                            })
                        }
                        _ => Err(EffectDescriptionError::UnknownIdentity(id.into())),
                    }
                })
                .unwrap();
            assert_eq!(
                calls,
                [
                    "angband.effect_info.grammar.dice.base_roll",
                    "angband.effect_info.description.damage"
                ]
            );
            assert_eq!(
                text,
                match locale {
                    Locale::English => "does 2147483647+21474836 damage to the player",
                    Locale::Japanese => "プレイヤーに2147483647+2147483647d9のダメージを与える",
                }
            );
            assert_eq!(capture, before);
        }
    }

    #[test]
    fn japanese_keeps_selected_unicode_and_reflows_without_native_byte_clipping() {
        let capture = graph(&bounded(
            2,
            &format!("{},{}", leaf("effect"), leaf("separator")),
        ));
        let texts = [
            ("angband.effect_info.fixture.effect", "炎と冷気への耐性"),
            ("angband.effect_info.fixture.separator", "。"),
        ];
        assert_eq!(
            render(&capture, Locale::Japanese, &texts).unwrap(),
            "炎と冷気への耐性。"
        );
        assert!(matches!(
            render(&capture, Locale::English, &texts),
            Err(EffectDescriptionError::NonAsciiEnglish(_))
        ));
    }

    #[test]
    fn integer_and_localized_parameters_arrive_already_resolved_with_exact_source_types() {
        let capture = graph(
            r#"{"kind":"ref","id":"angband.effect_info.fixture.heal","params":{"amount":{"type":"integer","value":250},"effect":{"type":"localized_text","value":{"id":"angband.effect_info.fixture.hitpoints"}}}}"#,
        );
        let output = EffectDescription::from_json(&capture)
            .unwrap()
            .render(Locale::Japanese, &mut |id, params| match id {
                "angband.effect_info.fixture.hitpoints" => Ok("ヒットポイント".into()),
                "angband.effect_info.fixture.heal" => {
                    assert_eq!(params["amount"], ResolvedEffectParameter::Integer(250));
                    assert_eq!(params["amount"].source_type(), "integer");
                    assert_eq!(params["effect"].source_type(), "localized_text");
                    Ok(format!(
                        "{}を{}回復する",
                        params["effect"].rendered(),
                        params["amount"].rendered()
                    ))
                }
                _ => Err(EffectDescriptionError::UnknownIdentity(id.into())),
            })
            .unwrap();
        assert_eq!(output, "ヒットポイントを250回復する");
    }

    #[test]
    fn native_i32_boundaries_are_retained_and_other_scalar_types_are_rejected() {
        let capture = |number: &str| {
            graph(&format!(
                r#"{{"kind":"ref","id":"angband.effect_info.fixture.amount","params":{{"amount":{{"type":"integer","value":{number}}}}}}}"#
            ))
        };
        for value in ["-2147483648", "2147483647", "0"] {
            assert!(EffectDescription::from_json(&capture(value)).is_ok());
        }
        for value in [
            "-2147483649",
            "2147483648",
            "1.0",
            "1e2",
            "true",
            "null",
            "\"250\"",
        ] {
            assert!(
                EffectDescription::from_json(&capture(value)).is_err(),
                "{value}"
            );
        }
    }

    #[test]
    fn references_reject_hidden_state_raw_strings_foreign_ids_and_unknown_fields() {
        for node in [
            r#"{"kind":"literal","text":"deals damage"}"#,
            r#"{"kind":"ref","id":"","params":{}}"#,
            r#"{"kind":"ref","id":"angband.naming.effect.fire","params":{}}"#,
            r#"{"kind":"ref","id":"angband.effect_info.","params":{}}"#,
            r#"{"kind":"ref","id":"angband.effect_info..fire","params":{}}"#,
            r#"{"kind":"ref","id":"angband.effect_info.fixture.fire","params":{},"pointer":42}"#,
            r#"{"kind":"ref","id":"angband.effect_info.fixture.fire"}"#,
            r#"{"kind":"ref","id":"angband.effect_info.fixture.fire","params":{"effect":{"type":"localized_text","value":"fire"}}}"#,
            r#"{"kind":"ref","id":"angband.effect_info.fixture.fire","params":{"effect":{"type":"opaque_name","value":"Alice"}}}"#,
            r#"{"kind":"ref","id":"angband.effect_info.fixture.fire","params":{"effect":{"type":"integer","value":1,"entity_index":7}}}"#,
        ] {
            assert!(
                EffectDescription::from_json(&graph(node)).is_err(),
                "{node}"
            );
        }
        let wrong_version =
            graph(&leaf("fire")).replace("\"schema_version\":1", "\"schema_version\":2");
        assert!(EffectDescription::from_json(&wrong_version).is_err());
        assert!(EffectDescription::from_json(r#"{"schema_version":1,"parts":[]}"#).is_err());
        assert!(
            EffectDescription::from_json(r#"{"schema_version":1,"parts":[],"complete":true}"#)
                .is_err()
        );
    }

    #[test]
    fn duplicate_fields_and_more_than_six_parameters_fail_before_resolution() {
        let duplicate = graph(
            r#"{"kind":"ref","id":"angband.effect_info.fixture.fire","id":"angband.effect_info.fixture.ice","params":{}}"#,
        );
        assert!(EffectDescription::from_json(&duplicate).is_err());
        let capture = |count: usize| {
            let params = (0..count)
                .map(|i| format!(r#""p{i}":{{"type":"integer","value":{i}}}"#))
                .collect::<Vec<_>>()
                .join(",");
            graph(&format!(
                r#"{{"kind":"ref","id":"angband.effect_info.fixture.amount","params":{{{params}}}}}"#
            ))
        };
        assert!(EffectDescription::from_json(&capture(6)).is_ok());
        assert!(EffectDescription::from_json(&capture(7)).is_err());
    }

    #[test]
    fn capacity_and_schema_bounds_reject_coercion_and_allow_native_endpoints() {
        for capacity in [1, 20, 32, 50, 80, 120, 200, 250, 65_536] {
            assert!(
                EffectDescription::from_json(&graph(&bounded(capacity, &leaf("fire")))).is_ok()
            );
        }
        for capacity in ["0", "-1", "65537", "20.0", "true", "\"20\""] {
            let node = format!(
                r#"{{"kind":"bounded","native_max_bytes":{capacity},"parts":[{}]}}"#,
                leaf("fire")
            );
            assert!(
                EffectDescription::from_json(&graph(&node)).is_err(),
                "{capacity}"
            );
        }
    }

    #[test]
    fn clipping_never_hides_unknown_references_or_invalid_nested_parameters() {
        let capture = graph(&bounded(
            1,
            &format!("{},{}", leaf("known"), leaf("unknown")),
        ));
        let texts = [("angband.effect_info.fixture.known", "known")];
        assert_eq!(
            render(&capture, Locale::English, &texts),
            Err(EffectDescriptionError::UnknownIdentity(
                "angband.effect_info.fixture.unknown".into()
            ))
        );
        let bad = graph(&bounded(
            1,
            r#"{"kind":"ref","id":"angband.effect_info.fixture.fire","params":{"effect":{"type":"localized_text","value":{"id":"game.hidden"}}}}"#,
        ));
        assert!(EffectDescription::from_json(&bad).is_err());
    }

    #[test]
    fn only_the_reviewed_empty_grammar_can_resolve_to_empty_text() {
        let capture = graph(&format!(
            r#"{{"kind":"ref","id":"{EMPTY_REFERENCE_ID}","params":{{}}}}"#
        ));
        for locale in [Locale::English, Locale::Japanese] {
            assert_eq!(
                render(&capture, locale, &[(EMPTY_REFERENCE_ID, "")]).unwrap(),
                ""
            );
            assert!(matches!(
                render(
                    &graph(&leaf("other")),
                    locale,
                    &[("angband.effect_info.fixture.other", "")]
                ),
                Err(EffectDescriptionError::UnexpectedEmptyReference(_))
            ));
        }
        assert_eq!(
            render(
                &graph(&leaf("nul")),
                Locale::English,
                &[("angband.effect_info.fixture.nul", "a\0b")]
            ),
            Err(EffectDescriptionError::EmbeddedNul)
        );
    }

    #[test]
    fn full_capture_byte_limit_includes_whitespace_and_owned_values_are_bounded() {
        let mut maximum = graph(&leaf("fire"));
        maximum.extend(std::iter::repeat_n(' ', MAX_CAPTURE_BYTES - maximum.len()));
        assert!(EffectDescription::from_json(&maximum).is_ok());
        maximum.push(' ');
        assert_eq!(
            EffectDescription::from_json(&maximum),
            Err(EffectDescriptionError::CaptureByteLimit)
        );
        let mut value = J::Object(vec![(
            "oversize".into(),
            J::String("x".repeat(MAX_CAPTURE_BYTES)),
        )]);
        assert_eq!(
            EffectDescription::from_value(&value),
            Err(EffectDescriptionError::CaptureByteLimit)
        );
        value = J::Object(vec![
            ("schema_version".into(), J::Integer(1)),
            ("schema_version".into(), J::Integer(1)),
            ("parts".into(), J::Array(vec![])),
        ]);
        assert!(EffectDescription::from_value(&value).is_err());
    }

    #[test]
    fn node_count_is_shared_across_nested_parameter_graphs() {
        let leaves = |count: usize| {
            (0..count)
                .map(|_| leaf("fire"))
                .collect::<Vec<_>>()
                .join(",")
        };
        assert!(EffectDescription::from_json(&graph(&leaves(512))).is_ok());
        assert_eq!(
            EffectDescription::from_json(&graph(&leaves(513))),
            Err(EffectDescriptionError::NodeLimit)
        );
        let child = graph(&leaves(512));
        let parent = graph(&format!(
            r#"{{"kind":"ref","id":"angband.effect_info.fixture.parent","params":{{"effect":{{"type":"EffectDescription","value":{child}}}}}}}"#
        ));
        assert_eq!(
            EffectDescription::from_json(&parent),
            Err(EffectDescriptionError::NodeLimit)
        );
    }

    #[test]
    fn semantic_depth_is_shared_across_bounds_localized_refs_and_description_parameters() {
        let bounds = |count: usize| {
            let mut node = leaf("fire");
            for _ in 1..count {
                node = bounded(250, &node);
            }
            graph(&node)
        };
        assert!(EffectDescription::from_json(&bounds(16)).is_ok());
        assert_eq!(
            EffectDescription::from_json(&bounds(17)),
            Err(EffectDescriptionError::DepthLimit)
        );
        let mut node = leaf("fire");
        for i in 1..16 {
            node = if i % 2 == 0 {
                format!(
                    r#"{{"kind":"ref","id":"angband.effect_info.fixture.parent","params":{{"effect":{{"type":"EffectDescription","value":{}}}}}}}"#,
                    graph(&node)
                )
            } else {
                bounded(250, &node)
            };
        }
        assert!(EffectDescription::from_json(&graph(&node)).is_ok());
        assert_eq!(
            EffectDescription::from_json(&graph(&bounded(250, &node))),
            Err(EffectDescriptionError::DepthLimit)
        );
        let wrap = |value: J| {
            J::Object(vec![
                (
                    "id".into(),
                    J::String("angband.effect_info.fixture.parent".into()),
                ),
                (
                    "params".into(),
                    J::Object(vec![(
                        "effect".into(),
                        J::Object(vec![
                            ("type".into(), J::String("localized_text".into())),
                            ("value".into(), value),
                        ]),
                    )]),
                ),
            ])
        };
        let capture = |reference: J| {
            let J::Object(mut fields) = reference else {
                panic!("fixture reference object")
            };
            fields.push(("kind".into(), J::String("ref".into())));
            J::Object(vec![
                ("schema_version".into(), J::Integer(1)),
                ("parts".into(), J::Array(vec![J::Object(fields)])),
            ])
        };
        let mut reference = J::Object(vec![
            (
                "id".into(),
                J::String("angband.effect_info.fixture.fire".into()),
            ),
            ("params".into(), J::Object(vec![])),
        ]);
        for _ in 1..16 {
            reference = wrap(reference);
        }
        assert!(EffectDescription::from_value(&capture(reference.clone())).is_ok());
        assert_eq!(
            EffectDescription::from_value(&capture(wrap(reference))),
            Err(EffectDescriptionError::DepthLimit)
        );
    }

    #[test]
    fn existing_output_and_parameter_limits_are_retained_without_a_global_increase() {
        let capture = graph(&format!("{},{}", leaf("left"), leaf("right")));
        let output = "x".repeat(MAX_OUTPUT_BYTES / 2);
        assert_eq!(
            render(
                &capture,
                Locale::English,
                &[
                    ("angband.effect_info.fixture.left", &output),
                    ("angband.effect_info.fixture.right", &output)
                ]
            )
            .unwrap()
            .len(),
            MAX_OUTPUT_BYTES
        );
        let longer = format!("{output}x");
        assert_eq!(
            render(
                &capture,
                Locale::English,
                &[
                    ("angband.effect_info.fixture.left", &output),
                    ("angband.effect_info.fixture.right", &longer)
                ]
            ),
            Err(EffectDescriptionError::OutputLimit)
        );
        let child = graph(&leaf("value"));
        let capture = graph(&format!(
            r#"{{"kind":"ref","id":"angband.effect_info.fixture.parent","params":{{"effect":{{"type":"EffectDescription","value":{child}}}}}}}"#
        ));
        for length in [MAX_VALUE_BYTES, MAX_VALUE_BYTES + 1] {
            let result = EffectDescription::from_json(&capture).unwrap().render(
                Locale::English,
                &mut |id, params| {
                    if id.ends_with(".value") {
                        Ok("x".repeat(length))
                    } else {
                        Ok(params["effect"].rendered().into_owned())
                    }
                },
            );
            if length == MAX_VALUE_BYTES {
                assert_eq!(result.unwrap().len(), length);
            } else {
                assert_eq!(result, Err(EffectDescriptionError::ParameterTextLimit));
            }
        }
    }
}
