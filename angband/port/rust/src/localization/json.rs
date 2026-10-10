//! Bounded pure JSON parser for reviewed schemas and owned semantic captures.
//! Integer values only: decimal fractions and exponents are never coerced.

use std::fmt;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum JsonValue {
    Null,
    Bool(bool),
    Integer(i64),
    String(String),
    Array(Vec<JsonValue>),
    Object(Vec<(String, JsonValue)>),
}
impl JsonValue {
    pub(crate) fn as_object(&self) -> Option<&[(String, Self)]> { if let Self::Object(v) = self { Some(v) } else { None } }
    pub(crate) fn as_array(&self) -> Option<&[Self]> { if let Self::Array(v) = self { Some(v) } else { None } }
    pub(crate) fn as_str(&self) -> Option<&str> { if let Self::String(v) = self { Some(v) } else { None } }
    pub(crate) fn as_integer(&self) -> Option<i64> { if let Self::Integer(v) = self { Some(*v) } else { None } }
    pub(crate) fn as_bool(&self) -> Option<bool> { if let Self::Bool(v) = self { Some(*v) } else { None } }
    pub(crate) fn field(&self, name: &str) -> Option<&Self> { self.as_object()?.iter().find(|(key, _)| key == name).map(|(_, value)| value) }
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Limits {
    pub max_bytes: usize,
    pub max_depth: usize,
    pub max_nodes: usize,
    pub max_string_bytes: usize,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct JsonError { pub byte_offset: usize, pub reason: &'static str }
impl fmt::Display for JsonError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { write!(f, "JSON byte {}: {}", self.byte_offset, self.reason) }
}
impl std::error::Error for JsonError {}

pub(crate) fn parse(input: &str, limits: Limits) -> Result<JsonValue, JsonError> {
    let mut parser = Parser { input, cursor: 0, nodes: 0, limits };
    if input.len() > limits.max_bytes { return Err(parser.error("input byte limit")); }
    let value = parser.value(0)?;
    parser.space();
    if parser.cursor != input.len() { return Err(parser.error("trailing data")); }
    Ok(value)
}
struct Parser<'a> { input: &'a str, cursor: usize, nodes: usize, limits: Limits }
impl Parser<'_> {
    fn error(&self, reason: &'static str) -> JsonError { JsonError { byte_offset: self.cursor, reason } }
    fn byte(&self) -> Option<u8> { self.input.as_bytes().get(self.cursor).copied() }
    fn space(&mut self) { while matches!(self.byte(), Some(b' ' | b'\r' | b'\n' | b'\t')) { self.cursor += 1; } }
    fn take(&mut self, byte: u8) -> bool { if self.byte() == Some(byte) { self.cursor += 1; true } else { false } }
    fn value(&mut self, depth: usize) -> Result<JsonValue, JsonError> {
        self.space();
        if depth > self.limits.max_depth { return Err(self.error("depth limit")); }
        self.nodes += 1;
        if self.nodes > self.limits.max_nodes { return Err(self.error("node limit")); }
        match self.byte() {
            Some(b'"') => self.string().map(JsonValue::String),
            Some(b'{') => {
                self.cursor += 1;
                self.space();
                let mut values = Vec::new();
                if self.take(b'}') { return Ok(JsonValue::Object(values)); }
                loop {
                    self.space();
                    let key = self.string()?;
                    if values.iter().any(|(old, _)| old == &key) { return Err(self.error("duplicate object key")); }
                    self.space();
                    if !self.take(b':') { return Err(self.error("expected colon")); }
                    let value = self.value(depth + 1)?;
                    values.push((key, value));
                    self.space();
                    if self.take(b'}') { break; }
                    if !self.take(b',') { return Err(self.error("expected comma or object end")); }
                }
                Ok(JsonValue::Object(values))
            }
            Some(b'[') => {
                self.cursor += 1;
                self.space();
                let mut values = Vec::new();
                if self.take(b']') { return Ok(JsonValue::Array(values)); }
                loop {
                    values.push(self.value(depth + 1)?);
                    self.space();
                    if self.take(b']') { break; }
                    if !self.take(b',') { return Err(self.error("expected comma or array end")); }
                }
                Ok(JsonValue::Array(values))
            }
            Some(b'n') => { self.literal("null")?; Ok(JsonValue::Null) }
            Some(b't') => { self.literal("true")?; Ok(JsonValue::Bool(true)) }
            Some(b'f') => { self.literal("false")?; Ok(JsonValue::Bool(false)) }
            Some(b'-' | b'0'..=b'9') => self.integer().map(JsonValue::Integer),
            _ => Err(self.error("expected JSON value")),
        }
    }
    fn literal(&mut self, literal: &str) -> Result<(), JsonError> {
        if !self.input[self.cursor..].starts_with(literal) { return Err(self.error("invalid literal")); }
        self.cursor += literal.len();
        Ok(())
    }
    fn integer(&mut self) -> Result<i64, JsonError> {
        let start = self.cursor;
        self.take(b'-');
        if self.take(b'0') {
            if matches!(self.byte(), Some(b'0'..=b'9')) { return Err(self.error("leading zero")); }
        } else {
            if !matches!(self.byte(), Some(b'1'..=b'9')) { return Err(self.error("invalid integer")); }
            while matches!(self.byte(), Some(b'0'..=b'9')) { self.cursor += 1; }
        }
        if matches!(self.byte(), Some(b'.' | b'e' | b'E')) { return Err(self.error("non-integer number unsupported")); }
        self.input[start..self.cursor].parse().map_err(|_| self.error("integer out of range"))
    }
    fn string(&mut self) -> Result<String, JsonError> {
        if !self.take(b'"') { return Err(self.error("expected string")); }
        let mut output = String::new();
        loop {
            match self.byte() {
                Some(b'"') => { self.cursor += 1; return Ok(output); }
                Some(b'\\') => {
                    self.cursor += 1;
                    let escaped = self.byte().ok_or_else(|| self.error("unterminated escape"))?;
                    self.cursor += 1;
                    match escaped {
                        b'"' => output.push('"'), b'\\' => output.push('\\'), b'/' => output.push('/'),
                        b'b' => output.push('\u{8}'), b'f' => output.push('\u{c}'), b'n' => output.push('\n'), b'r' => output.push('\r'), b't' => output.push('\t'),
                        b'u' => {
                            let first = self.hex_word()?;
                            let code = if (0xd800..=0xdbff).contains(&first) {
                                if !self.take(b'\\') || !self.take(b'u') { return Err(self.error("missing low surrogate")); }
                                let second = self.hex_word()?;
                                if !(0xdc00..=0xdfff).contains(&second) { return Err(self.error("invalid low surrogate")); }
                                0x10000 + ((u32::from(first) - 0xd800) << 10) + (u32::from(second) - 0xdc00)
                            } else if (0xdc00..=0xdfff).contains(&first) { return Err(self.error("unpaired low surrogate")); }
                            else { u32::from(first) };
                            output.push(char::from_u32(code).ok_or_else(|| self.error("invalid Unicode scalar"))?);
                        }
                        _ => return Err(self.error("unknown escape")),
                    }
                }
                Some(0..=0x1f) => return Err(self.error("unescaped control character")),
                Some(_) => {
                    let character = self.input[self.cursor..].chars().next().ok_or_else(|| self.error("invalid string"))?;
                    self.cursor += character.len_utf8();
                    output.push(character);
                }
                None => return Err(self.error("unterminated string")),
            }
            if output.len() > self.limits.max_string_bytes { return Err(self.error("string byte limit")); }
        }
    }
    fn hex_word(&mut self) -> Result<u16, JsonError> {
        let mut value = 0_u16;
        for _ in 0..4 {
            let digit = match self.byte() {
                Some(b'0'..=b'9') => u16::from(self.byte().unwrap_or_default() - b'0'),
                Some(b'a'..=b'f') => u16::from(self.byte().unwrap_or_default() - b'a' + 10),
                Some(b'A'..=b'F') => u16::from(self.byte().unwrap_or_default() - b'A' + 10),
                _ => return Err(self.error("invalid Unicode escape")),
            };
            value = value * 16 + digit;
            self.cursor += 1;
        }
        Ok(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn limits() -> Limits { Limits { max_bytes: 4096, max_depth: 8, max_nodes: 128, max_string_bytes: 512 } }
    #[test]
    fn unicode_and_owned_nested_values_parse_exactly() {
        let json = r#"{"name":"花\uD83C\uDF38","values":[-9223372036854775808,9223372036854775807,true,null]}"#;
        let value = parse(json, limits()).unwrap();
        assert_eq!(value.field("name").unwrap().as_str(), Some("花🌸"));
        assert_eq!(value.field("values").unwrap().as_array().unwrap()[0].as_integer(), Some(i64::MIN));
        assert_eq!(value.field("values").unwrap().as_array().unwrap()[2].as_bool(), Some(true));
    }
    #[test]
    fn duplicate_keys_and_malformed_or_noninteger_json_are_rejected() {
        for json in [r#"{"x":1,"x":2}"#, r#"{"x":{"y":0,"y":1}}"#, "[1,]", "{\"x\":1,}", "01", "-", "+1", "1.0", "1e2", "9223372036854775808", "true false", r#""\uD800""#, r#""\uDC00""#, r#""\uD800\u1234""#, "\"\n\""] {
            assert!(parse(json, limits()).is_err(), "{json}");
        }
    }
    #[test]
    fn independent_bounds_reject_before_unbounded_recursion_or_allocation() {
        let mut bounded = limits();
        bounded.max_bytes = 2;
        assert!(parse("null", bounded).is_err());
        bounded = limits(); bounded.max_depth = 1;
        assert!(parse("[[[0]]]", bounded).is_err());
        bounded = limits(); bounded.max_nodes = 2;
        assert!(parse("[0,1]", bounded).is_err());
        bounded = limits(); bounded.max_string_bytes = 2;
        assert!(parse("\"花\"", bounded).is_err());
    }
}
