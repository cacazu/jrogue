//! Pure help application policy over pinned, source-identified rows.
//! No engine/RNG/storage/browser access. FFI pointer validation belongs to lib.rs.
// SPDX-License-Identifier: GPL-2.0-only

use crate::text::{parse_flat_json, Locale};
use std::collections::BTreeMap;
use std::fmt;
use std::ops::Range;
use std::sync::OnceLock;

pub const HELP_CORPUS_SHA256: &str = "aa621305fcc0a152215da1c69ca6a1c67139fc44115c95fd79a3c62a276fc00f";
pub const MAX_QUERY_BYTES: usize = 79;
pub const MAX_ROW_BYTES: usize = 32768;
pub const FILES: &[(&str, usize)] = &[
    ("index.txt", 20), ("commands.txt", 73), ("r_comm.txt", 74),
    ("r_index.txt", 20), ("symbols.txt", 91),
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HelpError {
    UnknownFile, InvalidLogicalLine, InvalidQuery, InvalidCatalog(&'static str),
}
impl HelpError {
    pub fn status(&self) -> i32 {
        match self {
            Self::UnknownFile => -200, Self::InvalidLogicalLine => -201,
            Self::InvalidQuery => -202, Self::InvalidCatalog(_) => -203,
        }
    }
}
impl fmt::Display for HelpError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownFile => f.write_str("unknown bundled help source"),
            Self::InvalidLogicalLine => f.write_str("invalid help logical line"),
            Self::InvalidQuery => f.write_str("invalid help query"),
            Self::InvalidCatalog(reason) => write!(f, "invalid help catalog: {reason}"),
        }
    }
}
impl std::error::Error for HelpError {}

#[derive(Clone, Debug)]
struct Row { id: String, english: String, japanese: String }

/// Producer lookup is canonical file ordinal plus original logical line.
/// The TSV binds that identity to reviewed topic/action/symbol IDs.
#[derive(Clone, Debug)]
pub struct HelpCatalog { rows: Vec<Vec<Row>> }

impl HelpCatalog {
    pub fn embedded() -> Result<Self, HelpError> {
        Self::from_sources(
            include_str!("../../migration/help-data/en.json"),
            include_str!("../../migration/help-data/ja.json"),
            include_str!("../../migration/help-data/row-bindings.tsv"),
        )
    }

    pub fn from_sources(english: &str, japanese: &str, bindings: &str) -> Result<Self, HelpError> {
        let parse = |source| -> Result<BTreeMap<String, String>, HelpError> {
            let pairs = parse_flat_json(source).map_err(|_| HelpError::InvalidCatalog("JSON"))?;
            let mut map = BTreeMap::new();
            for (id, value) in pairs {
                if map.insert(id, value).is_some() { return Err(HelpError::InvalidCatalog("duplicate ID")); }
            }
            Ok(map)
        };
        let english = parse(english)?;
        let japanese = parse(japanese)?;
        if english.keys().ne(japanese.keys()) { return Err(HelpError::InvalidCatalog("locale ID set")); }
        let mut rows = vec![Vec::new(); FILES.len()];
        for binding in bindings.lines() {
            let mut parts = binding.split('\t');
            let filename = parts.next().ok_or(HelpError::InvalidCatalog("filename"))?;
            let logical = parts.next().and_then(|value| value.parse::<usize>().ok())
                .ok_or(HelpError::InvalidCatalog("logical line"))?;
            let id = parts.next().ok_or(HelpError::InvalidCatalog("semantic ID"))?;
            if parts.next().is_some() || id.is_empty() || id.len() > 127 ||
                !id.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'.' | b'_')) {
                return Err(HelpError::InvalidCatalog("binding fields"));
            }
            let file = file_ordinal(filename).ok_or(HelpError::InvalidCatalog("unknown source"))?;
            if logical != rows[file].len() || logical >= FILES[file].1 {
                return Err(HelpError::InvalidCatalog("binding order/count"));
            }
            let english = literal_row(english.get(id).ok_or(HelpError::InvalidCatalog("English row"))?)?;
            let japanese = literal_row(japanese.get(id).ok_or(HelpError::InvalidCatalog("Japanese row"))?)?;
            rows[file].push(Row { id: id.to_owned(), english, japanese });
        }
        if rows.iter().zip(FILES).any(|(rows, (_, count))| rows.len() != *count) {
            return Err(HelpError::InvalidCatalog("incomplete row coverage"));
        }
        Ok(Self { rows })
    }

    pub fn row(&self, file: usize, logical: usize, locale: Locale) -> Result<&str, HelpError> {
        let row = self.rows.get(file).ok_or(HelpError::UnknownFile)?
            .get(logical).ok_or(HelpError::InvalidLogicalLine)?;
        Ok(match locale { Locale::English => &row.english, Locale::Japanese => &row.japanese })
    }
    pub fn semantic_id(&self, file: usize, logical: usize) -> Result<&str, HelpError> {
        Ok(&self.rows.get(file).ok_or(HelpError::UnknownFile)?
            .get(logical).ok_or(HelpError::InvalidLogicalLine)?.id)
    }
    pub fn matches(&self, file: usize, logical: usize, query: &str,
        case_sensitive: bool, locale: Locale) -> Result<bool, HelpError> {
        validate_query(query)?;
        let row = self.row(file, logical, locale)?;
        if query.is_empty() { return Ok(true); }
        Ok(!match_ranges(row, query, case_sensitive).is_empty())
    }
    /// No wrap: the C adapter supplies the already-clamped original scan start.
    pub fn find_forward(&self, file: usize, start: usize, query: &str,
        case_sensitive: bool, locale: Locale) -> Result<Option<usize>, HelpError> {
        let rows = self.rows.get(file).ok_or(HelpError::UnknownFile)?;
        if start > rows.len() { return Err(HelpError::InvalidLogicalLine); }
        validate_query(query)?;
        for logical in start..rows.len() {
            if self.matches(file, logical, query, case_sensitive, locale)? { return Ok(Some(logical)); }
        }
        Ok(None)
    }
}

pub fn file_ordinal(filename: &str) -> Option<usize> {
    FILES.iter().position(|(canonical, _)| *canonical == filename)
}
fn validate_query(query: &str) -> Result<(), HelpError> {
    if query.len() > MAX_QUERY_BYTES || query.contains('\0') { Err(HelpError::InvalidQuery) } else { Ok(()) }
}
fn literal_row(source: &str) -> Result<String, HelpError> {
    if source.len() > MAX_ROW_BYTES || source.contains('\0') { return Err(HelpError::InvalidCatalog("row size")); }
    let mut out = String::with_capacity(source.len());
    let mut characters = source.chars();
    while let Some(character) = characters.next() {
        if matches!(character, '{' | '}') && characters.next() != Some(character) {
            return Err(HelpError::InvalidCatalog("non-static row template"));
        }
        out.push(character);
    }
    Ok(out)
}

static EMBEDDED: OnceLock<Result<HelpCatalog, HelpError>> = OnceLock::new();
/// Return 2 only for valid English source requests, selecting the original C
/// strstr path. Arbitrary files are excluded by the C adapter before this call.
pub fn match_status(file: u32, logical: u32, query: &str,
    case_sensitive: bool, locale: Locale) -> i32 {
    let result = (|| {
        validate_query(query)?;
        let file = usize::try_from(file).map_err(|_| HelpError::UnknownFile)?;
        let logical = usize::try_from(logical).map_err(|_| HelpError::InvalidLogicalLine)?;
        let catalog = EMBEDDED.get_or_init(HelpCatalog::embedded).as_ref().map_err(Clone::clone)?;
        catalog.row(file, logical, locale)?;
        if locale == Locale::English { return Ok(2); }
        Ok(i32::from(catalog.matches(file, logical, query, case_sensitive, locale)?))
    })();
    result.unwrap_or_else(|error: HelpError| error.status())
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HighlightRun { pub text: String, pub highlighted: bool }

#[derive(Clone, Copy)]
struct FoldSpan { folded_start: usize, folded_end: usize, original_start: usize, original_end: usize }

/// Unicode scalar lowercase, not normalization/transliteration. Original scalar
/// boundaries are retained even when lowercase expands a scalar (e.g. U+0130).
fn folded(text: &str, case_sensitive: bool) -> (String, Vec<FoldSpan>) {
    let mut out = String::with_capacity(text.len());
    let mut spans = Vec::with_capacity(text.chars().count());
    for (start, character) in text.char_indices() {
        let folded_start = out.len();
        if case_sensitive { out.push(character); } else { out.extend(character.to_lowercase()); }
        spans.push(FoldSpan { folded_start, folded_end: out.len(), original_start: start,
            original_end: start + character.len_utf8() });
    }
    (out, spans)
}

fn match_ranges(text: &str, query: &str, case_sensitive: bool) -> Vec<Range<usize>> {
    if query.is_empty() || text.is_empty() { return Vec::new(); }
    let (folded_text, spans) = folded(text, case_sensitive);
    let folded_query = if case_sensitive { query.to_owned() } else { query.to_lowercase() };
    let mut cursor = 0;
    let mut ranges: Vec<Range<usize>> = Vec::new();
    while cursor < folded_text.len() {
        let Some(relative) = folded_text[cursor..].find(&folded_query) else { break; };
        let start = cursor + relative;
        let end = start + folded_query.len();
        let first = spans.iter().find(|span| span.folded_end > start);
        let last = spans.iter().rev().find(|span| span.folded_start < end);
        if let (Some(first), Some(last)) = (first, last) {
            let range = first.original_start..last.original_end;
            if let Some(previous) = ranges.last_mut().filter(|previous| previous.end >= range.start) {
                previous.end = previous.end.max(range.end);
            } else { ranges.push(range); }
        }
        cursor = end;
    }
    ranges
}

/// Owned runs for a generic renderer. Matching, Unicode range conversion and
/// composition stay in Rust; the DOM only renders supplied text/mark spans.
/// Invalid/oversized captures produce one unchanged, unhighlighted run.
pub fn highlight_runs(text: &str, query: &str, case_sensitive: bool) -> Vec<HighlightRun> {
    let plain = || vec![HighlightRun { text: text.to_owned(), highlighted: false }];
    if text.len() > MAX_ROW_BYTES || text.contains('\0') || validate_query(query).is_err() || query.is_empty() {
        return plain();
    }
    let ranges = match_ranges(text, query, case_sensitive);
    if ranges.is_empty() { return plain(); }
    let mut runs = Vec::new();
    let mut cursor = 0;
    for range in ranges {
        if cursor < range.start { runs.push(HighlightRun { text: text[cursor..range.start].to_owned(), highlighted: false }); }
        runs.push(HighlightRun { text: text[range.clone()].to_owned(), highlighted: true });
        cursor = range.end;
    }
    if cursor < text.len() { runs.push(HighlightRun { text: text[cursor..].to_owned(), highlighted: false }); }
    runs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn immutable_rows_resolve_semantic_ids_and_match_only_selected_locale() {
        let catalog = HelpCatalog::embedded().unwrap();
        assert_eq!(catalog.semantic_id(1, 17).unwrap(), "help.original.command.aim_wand_and_activate");
        assert!(catalog.matches(1, 20, "罠", false, Locale::Japanese).unwrap());
        assert!(!catalog.matches(1, 20, "罠", false, Locale::English).unwrap());
        assert!(catalog.matches(1, 20, "DISARM", false, Locale::English).unwrap());
        assert!(!catalog.matches(1, 20, "DISARM", true, Locale::English).unwrap());
        assert_eq!(catalog.find_forward(1, 0, "罠", false, Locale::Japanese).unwrap(), Some(20));
        assert_eq!(catalog.find_forward(1, 21, "罠", false, Locale::Japanese).unwrap(), Some(39));
        assert_eq!(catalog.find_forward(1, 73, "罠", false, Locale::Japanese).unwrap(), None);
        assert!(matches!(catalog.row(5, 0, Locale::Japanese), Err(HelpError::UnknownFile)));
        assert!(matches!(catalog.row(1, 73, Locale::Japanese), Err(HelpError::InvalidLogicalLine)));
    }

    #[test]
    fn corpus_source_boundaries_brace_glyphs_and_ffi_status_are_explicit() {
        let catalog = HelpCatalog::embedded().unwrap();
        for (file, (_, count)) in FILES.iter().enumerate() {
            for logical in 0..*count {
                assert!(catalog.semantic_id(file, logical).unwrap().starts_with("help."));
                assert!(catalog.matches(file, logical, "", true, Locale::Japanese).unwrap());
            }
        }
        assert!(catalog.row(4, 52, Locale::Japanese).unwrap().contains("{ 弾・矢・ボルト"));
        assert_eq!(match_status(1, 17, "杖", false, Locale::Japanese), 1);
        assert_eq!(match_status(1, 17, "does not occur", false, Locale::Japanese), 0);
        assert_eq!(match_status(1, 17, "wand", false, Locale::English), 2);
        assert_eq!(match_status(9, 17, "wand", false, Locale::English), -200);
        assert_eq!(match_status(1, 99, "wand", false, Locale::English), -201);
        assert_eq!(match_status(1, 17, "a\0b", false, Locale::Japanese), -202);
        assert_eq!(match_status(1, 17, &"a".repeat(80), false, Locale::Japanese), -202);
        let bad = include_str!("../../migration/help-data/row-bindings.tsv").replacen("\t0\t", "\t1\t", 1);
        assert!(HelpCatalog::from_sources(include_str!("../../migration/help-data/en.json"), include_str!("../../migration/help-data/ja.json"), &bad).is_err());
    }

    #[test]
    fn highlight_runs_preserve_every_original_scalar_and_merge_expansion_matches() {
        let text = "罠 abc ABC 罠🌸";
        let runs = highlight_runs(text, "罠", false);
        assert_eq!(runs.iter().map(|run| run.text.as_str()).collect::<String>(), text);
        assert_eq!(runs.iter().filter(|run| run.highlighted).map(|run| run.text.as_str()).collect::<Vec<_>>(), ["罠", "罠"]);
        assert_eq!(highlight_runs(text, "abc", false).iter().filter(|run| run.highlighted).map(|run| run.text.as_str()).collect::<Vec<_>>(), ["abc", "ABC"]);
        assert_eq!(highlight_runs(text, "abc", true).iter().filter(|run| run.highlighted).map(|run| run.text.as_str()).collect::<Vec<_>>(), ["abc"]);
        assert_eq!(highlight_runs("İİ", "i", false), [HighlightRun { text: "İİ".into(), highlighted: true }]);
        assert_eq!(highlight_runs("aaa", "aa", true), [HighlightRun { text: "aa".into(), highlighted: true }, HighlightRun { text: "a".into(), highlighted: false }]);
        assert_eq!(highlight_runs("🌸", "🌸", true), [HighlightRun { text: "🌸".into(), highlighted: true }]);
        for query in ["", "not present", "x\0y"] {
            assert_eq!(highlight_runs(text, query, false), [HighlightRun { text: text.into(), highlighted: false }]);
        }
    }
}
