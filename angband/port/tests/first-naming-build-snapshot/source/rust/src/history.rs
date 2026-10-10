//! Locale grammar over source-identified, already-selected birth-history choices.
//! This module has no RNG, engine state, English-string parsing, FFI or unsafe code.
//! Native English remains in the C domain; edited history is outside this grammar.

use crate::text::{Locale, parse_flat_json};
use std::collections::BTreeMap;
use std::fmt;

/// The grammar version represented by captured metadata.
pub const GRAMMAR_VERSION: u32 = 1;
/// SHA-256 of the pristine upstream history.txt bytes, independent of translated text.
pub const CATALOG_SHA256: &str = "0b5a3079af72bcdd9eb782f02551fb329ea026dabd88dfc831c03e2d7bf00ebf";
/// Bounds captured provenance before any descriptor lookup or rendering.
pub const MAX_CHOICES: usize = 32;
const MAX_RENDER_BYTES: usize = 32768;
const EN_JSON: &str = include_str!("../../migration/history-data/en.json");
const JA_JSON: &str = include_str!("../../migration/history-data/ja.json");

/// Canonical selected history entry, distinct from the RNG roll that selected it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HistoryChoice {
    /// Original history chart identity.
    pub chart: u16,
    /// Original entry's inclusive roll cutoff; unique within its chart.
    pub cutoff: u16,
}

/// Versioned captured choices. Completed English is deliberately absent.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GeneratedHistory {
    /// Must equal [`GRAMMAR_VERSION`].
    pub grammar_version: u32,
    /// Must equal [`CATALOG_SHA256`].
    pub catalog_sha256: String,
    /// The original player race's starting chart.
    pub start_chart: u16,
    /// Ordered entries selected once by the original C generation.
    pub choices: Vec<HistoryChoice>,
}

/// Explicit grammar/capture failure; callers must not replace it with native English.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HistoryError {
    Version,
    Corpus,
    ChoiceCount,
    StartChart,
    UnknownChoice(HistoryChoice),
    BrokenChain,
    DuplicateChart,
    MissingText(String),
    InvalidCatalog,
    InvalidTemplate,
    OutputLimit,
}
impl fmt::Display for HistoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Version => f.write_str("unsupported history grammar version"),
            Self::Corpus => f.write_str("history source corpus differs"),
            Self::ChoiceCount => f.write_str("invalid history choice count"),
            Self::StartChart => f.write_str("unknown history starting chart"),
            Self::UnknownChoice(choice) => write!(f, "unknown history choice {}:{}", choice.chart, choice.cutoff),
            Self::BrokenChain => f.write_str("history choices do not form a complete source chain"),
            Self::DuplicateChart => f.write_str("history source chart repeats"),
            Self::MissingText(id) => write!(f, "missing history text ID {id}"),
            Self::InvalidCatalog => f.write_str("invalid history catalog"),
            Self::InvalidTemplate => f.write_str("invalid history statement template"),
            Self::OutputLimit => f.write_str("history rendering exceeds its output bound"),
        }
    }
}
impl std::error::Error for HistoryError {}

#[derive(Clone, Copy, Debug)]
struct Record { chart: u16, cutoff: u16, successor: u16, id: &'static str }
include!("history_data.rs");
const GRAMMAR_IDS: &[&str] = &[
    "history.grammar.human_parentage", "history.grammar.elven_parentage",
    "history.grammar.hobbit_parentage", "history.grammar.gnome_parentage",
    "history.grammar.dwarf_parentage", "history.grammar.half_orc_parentage",
    "history.grammar.half_troll_parentage", "history.grammar.kobold_litter",
    "history.grammar.kobold_parents", "history.grammar.human_appearance",
    "history.grammar.elven_appearance", "history.grammar.dwarf_appearance",
    "history.grammar.half_troll_appearance", "history.grammar.kobold_appearance",
];

/// Immutable per-locale history atoms and complete statement templates.
#[derive(Clone, Debug)]
pub struct HistoryCatalog { english: BTreeMap<String, String>, japanese: BTreeMap<String, String> }
impl HistoryCatalog {
    /// Parse the bundled reviewed JSON catalogs; no game data or RNG is read.
    ///
    /// # Errors
    /// Returns [`HistoryError::InvalidCatalog`] for malformed, duplicate, extra,
    /// missing or mismatched IDs. No partially parsed catalog is returned.
    pub fn embedded() -> Result<Self, HistoryError> { Self::from_json(EN_JSON, JA_JSON) }

    /// Parse explicitly supplied catalogs, for isolated verification.
    ///
    /// # Errors
    /// Rejects incomplete identity coverage, mismatched locales, NUL text and
    /// text exceeding the bounded renderer's limit.
    pub fn from_json(english: &str, japanese: &str) -> Result<Self, HistoryError> {
        fn flat(json: &str) -> Result<BTreeMap<String, String>, HistoryError> {
            if json.len() > 1024 * 1024 { return Err(HistoryError::InvalidCatalog); }
            let mut output = BTreeMap::new();
            for (id, text) in parse_flat_json(json).map_err(|_| HistoryError::InvalidCatalog)? {
                if text.contains('\0') || text.len() > MAX_RENDER_BYTES || output.insert(id, text).is_some() {
                    return Err(HistoryError::InvalidCatalog);
                }
            }
            Ok(output)
        }
        let english = flat(english)?;
        let japanese = flat(japanese)?;
        let expected_count = HISTORY_RECORDS.len() + GRAMMAR_IDS.len() + 1;
        if english.len() != expected_count || english.keys().ne(japanese.keys()) {
            return Err(HistoryError::InvalidCatalog);
        }
        for id in HISTORY_RECORDS.iter().map(|record| record.id).chain(GRAMMAR_IDS.iter().copied())
            .chain(std::iter::once("player.sheet.generated_history.value")) {
            if !english.contains_key(id) { return Err(HistoryError::InvalidCatalog); }
        }
        Ok(Self { english, japanese })
    }

    fn text(&self, id: &str, locale: Locale) -> Result<&str, HistoryError> {
        let catalog = match locale { Locale::English => &self.english, Locale::Japanese => &self.japanese };
        catalog.get(id).map(String::as_str).ok_or_else(|| HistoryError::MissingText(id.to_owned()))
    }

    /// Render complete statements from canonical captured choices.
    ///
    /// # Errors
    /// Rejects different versions/corpora, unknown or incomplete source chains,
    /// repeated charts, absent IDs, malformed templates and oversized output.
    pub fn render(&self, history: &GeneratedHistory, locale: Locale) -> Result<String, HistoryError> {
        let records = validated_records(history)?;
        let mut output = String::new();
        if locale == Locale::English {
            // Native fragments include the exact original spaces/punctuation.
            for record in &records { append(&mut output, self.text(record.id, locale)?)?; }
            return Ok(output);
        }
        let selected: BTreeMap<u16, &Record> = records.into_iter().map(|record| (record.chart, record)).collect();
        let atom = |chart| -> Result<&str, HistoryError> {
            let record = selected.get(&chart).ok_or(HistoryError::BrokenChain)?;
            self.text(record.id, locale)
        };
        let statement = |id: &str, params: &[(&str, u16)]| -> Result<String, HistoryError> {
            let values: Result<Vec<(&str, &str)>, HistoryError> = params.iter().map(|(name, chart)| Ok((*name, atom(*chart)?))).collect();
            compose(self.text(id, locale)?, &values?)
        };
        // Each plan accounts for every selected source fragment exactly once.
        // Reordering occurs at statement roles, never by matching English text.
        match history.start_chart {
            1 | 4 => {
                if history.start_chart == 4 { append(&mut output, atom(4)?)?; }
                append(&mut output, &statement("history.grammar.human_parentage", &[("child",1),("parent",2)])?)?;
                append(&mut output, atom(3)?)?;
                // Call inline to avoid holding a mutable borrow across statements.
                append(&mut output, &statement("history.grammar.human_appearance", &[("eyes",50),("texture",51),("hair",52),("complexion",53)])?)?;
            }
            5 | 7 => {
                let lineage = if history.start_chart == 5 {6} else {8};
                append(&mut output, &statement("history.grammar.elven_parentage", &[("child",history.start_chart),("lineage",lineage),("parent",9)])?)?;
                append(&mut output, &statement("history.grammar.elven_appearance", &[("eyes",54),("texture",55),("hair_and_complexion",56)])?)?;
            }
            10 | 13 => {
                let (grammar, parent) = if history.start_chart == 10 { ("history.grammar.hobbit_parentage",11) } else { ("history.grammar.gnome_parentage",14) };
                append(&mut output, &statement(grammar, &[("child",history.start_chart),("parent",parent)])?)?;
                append(&mut output, atom(3)?)?;
                append(&mut output, &statement("history.grammar.human_appearance", &[("eyes",50),("texture",51),("hair",52),("complexion",53)])?)?;
            }
            16 => {
                append(&mut output, &statement("history.grammar.dwarf_parentage", &[("child",16),("parent",17)])?)?;
                append(&mut output, atom(18)?)?;
                append(&mut output, &statement("history.grammar.dwarf_appearance", &[("eyes",57),("texture",58),("hair",59),("beard",60),("complexion",61)])?)?;
            }
            19 => {
                append(&mut output, &statement("history.grammar.half_orc_parentage", &[("orc_parent",19),("acknowledgement",20),("adoptive_parent",2)])?)?;
                append(&mut output, atom(3)?)?;
                append(&mut output, &statement("history.grammar.human_appearance", &[("eyes",50),("texture",51),("hair",52),("complexion",53)])?)?;
            }
            21 => {
                append(&mut output, &statement("history.grammar.half_troll_parentage", &[("troll_parent",21),("profession",22)])?)?;
                append(&mut output, &statement("history.grammar.half_troll_appearance", &[("eyes",62),("texture",63),("hair",64),("skin_color",65),("skin_condition",66)])?)?;
            }
            23 => {
                append(&mut output, &statement("history.grammar.kobold_litter", &[("litter_relation",23),("litter",24)])?)?;
                append(&mut output, &statement("history.grammar.kobold_parents", &[("father",25),("mother",26)])?)?;
                append(&mut output, &statement("history.grammar.kobold_appearance", &[("eyes",67),("hide",68),("teeth",69)])?)?;
            }
            _ => return Err(HistoryError::StartChart),
        }
        Ok(output)
    }
}
fn append(output: &mut String, text: &str) -> Result<(), HistoryError> {
    if output.len().checked_add(text.len()).is_none_or(|length| length > MAX_RENDER_BYTES) { return Err(HistoryError::OutputLimit); }
    output.push_str(text); Ok(())
}
fn validated_records(history: &GeneratedHistory) -> Result<Vec<&'static Record>, HistoryError> {
    if history.grammar_version != GRAMMAR_VERSION { return Err(HistoryError::Version); }
    if history.catalog_sha256 != CATALOG_SHA256 { return Err(HistoryError::Corpus); }
    if history.choices.is_empty() || history.choices.len() > MAX_CHOICES { return Err(HistoryError::ChoiceCount); }
    if !matches!(history.start_chart,1|4|5|7|10|13|16|19|21|23) { return Err(HistoryError::StartChart); }
    let mut expected = history.start_chart;
    let mut records = Vec::with_capacity(history.choices.len());
    for choice in &history.choices {
        let record = HISTORY_RECORDS.iter().find(|record| record.chart == choice.chart && record.cutoff == choice.cutoff)
            .ok_or(HistoryError::UnknownChoice(*choice))?;
        if record.chart != expected { return Err(HistoryError::BrokenChain); }
        if records.iter().any(|seen: &&Record| seen.chart == record.chart) { return Err(HistoryError::DuplicateChart); }
        records.push(record); expected = record.successor;
    }
    if expected != 0 { return Err(HistoryError::BrokenChain); }
    Ok(records)
}
fn compose(template: &str, values: &[(&str, &str)]) -> Result<String, HistoryError> {
    let mut output = String::new();
    let mut tail = template;
    let mut used = vec![false; values.len()];
    while let Some(open) = tail.find('{') {
        let literal = &tail[..open];
        if literal.contains('}') { return Err(HistoryError::InvalidTemplate); }
        append(&mut output,literal)?;
        tail = &tail[open+1..];
        let close = tail.find('}').ok_or(HistoryError::InvalidTemplate)?;
        let name = &tail[..close];
        let index = values.iter().position(|(key,_)| *key == name).ok_or(HistoryError::InvalidTemplate)?;
        if used[index] { return Err(HistoryError::InvalidTemplate); }
        used[index] = true; append(&mut output,values[index].1)?;
        tail = &tail[close+1..];
    }
    if tail.contains('}') || used.iter().any(|used| !used) { return Err(HistoryError::InvalidTemplate); }
    append(&mut output,tail)?; Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn captured(start: u16, pairs: &[(u16,u16)]) -> GeneratedHistory {
        GeneratedHistory { grammar_version: GRAMMAR_VERSION, catalog_sha256: CATALOG_SHA256.to_owned(), start_chart:start,
            choices:pairs.iter().map(|(chart,cutoff)| HistoryChoice {chart:*chart,cutoff:*cutoff}).collect() }
    }
    #[test]
    fn human_statement_reorders_parent_before_child_and_retains_native_english() -> Result<(),HistoryError> {
        let catalog = HistoryCatalog::embedded()?;
        let history = captured(1,&[(1,100),(2,100),(3,80),(50,60),(51,70),(52,70),(53,90)]);
        assert_eq!(catalog.render(&history,Locale::English)?,"You are the first child of a Royal Blood Line.  You are a credit to the family.  You have brown eyes, straight brown hair, and a fair complexion.");
        assert_eq!(catalog.render(&history,Locale::Japanese)?,"あなたは王族の第一子です。あなたは一族の誇りです。あなたは茶色の目と、まっすぐな茶色の髪、色白の肌をしています。");
        Ok(())
    }
    #[test]
    fn every_canonical_entry_renders_in_a_complete_race_history() -> Result<(),HistoryError> {
        let catalog = HistoryCatalog::embedded()?;
        let starts = [1,4,5,7,10,13,16,19,21,23];
        for chosen in HISTORY_RECORDS {
            let mut covered = false;
            for start in starts {
                let mut chart = start;
                let mut pairs = Vec::new();
                while chart != 0 {
                    let record = if chart == chosen.chart { chosen } else { HISTORY_RECORDS.iter().find(|record|record.chart==chart).ok_or(HistoryError::BrokenChain)? };
                    pairs.push((record.chart,record.cutoff));chart=record.successor;
                }
                if pairs.iter().any(|(chart,_)|*chart==chosen.chart) {
                    let history = captured(start,&pairs);
                    let english = catalog.render(&history,Locale::English)?;
                    let japanese = catalog.render(&history,Locale::Japanese)?;
                    assert!(!english.is_empty() && !japanese.is_empty());
                    assert!(!japanese.contains('{') && japanese.ends_with('。'));
                    covered = true;break;
                }
            }
            assert!(covered,"{}",chosen.id);
        }
        Ok(())
    }
    #[test]
    fn corrupted_or_incomplete_provenance_never_renders() -> Result<(),HistoryError> {
        let catalog = HistoryCatalog::embedded()?;
        let valid = captured(5,&[(5,60),(6,40),(9,40),(54,85),(55,75),(56,75)]);
        assert!(catalog.render(&valid,Locale::Japanese).is_ok());
        let mut invalid=valid.clone();invalid.grammar_version=2;
        assert_eq!(catalog.render(&invalid,Locale::Japanese),Err(HistoryError::Version));
        invalid=valid.clone();invalid.catalog_sha256.clear();
        assert_eq!(catalog.render(&invalid,Locale::Japanese),Err(HistoryError::Corpus));
        invalid=valid.clone();invalid.choices.pop();
        assert_eq!(catalog.render(&invalid,Locale::Japanese),Err(HistoryError::BrokenChain));
        invalid=valid.clone();invalid.choices[1].cutoff=41;
        assert!(matches!(catalog.render(&invalid,Locale::Japanese),Err(HistoryError::UnknownChoice(_))));
        invalid=valid.clone();invalid.choices.swap(0,1);
        assert_eq!(catalog.render(&invalid,Locale::Japanese),Err(HistoryError::BrokenChain));
        assert_eq!(catalog.render(&valid,Locale::Japanese)?,catalog.render(&valid,Locale::Japanese)?);
        Ok(())
    }
}
