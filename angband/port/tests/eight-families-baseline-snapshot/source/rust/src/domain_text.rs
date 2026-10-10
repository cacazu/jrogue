//! Pure selection of source-reviewed native custom-message grammar.
//! Descriptors arrive from their original C formatting branch; this module
//! never observes gameplay objects, C buffers, English text, RNG or storage.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CustomGrammarRole { VerbSuffix, Copula }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CustomGrammarError { CountOutOfRange, CountWithoutObject }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CustomObjectFacts { has_object: bool, number: u8 }

impl CustomObjectFacts {
    /// Capture uses the original object's uint8 number, or zero for NULL.
    /// No singular/plural decision is inferred from a rendered descriptor.
    pub fn new(has_object: bool, number: i64) -> Result<Self, CustomGrammarError> {
        let number = u8::try_from(number).map_err(|_| CustomGrammarError::CountOutOfRange)?;
        if !has_object && number != 0 { return Err(CustomGrammarError::CountWithoutObject); }
        Ok(Self { has_object, number })
    }

    /// Return an immutable catalog identity; the review catalog owns text in
    /// both locales, including deliberately empty Japanese grammar fragments.
    pub fn source_id(self, role: CustomGrammarRole) -> &'static str {
        match role {
            CustomGrammarRole::VerbSuffix if self.has_object && self.number == 1 => "domain.custom_message.verb.singular",
            CustomGrammarRole::VerbSuffix => "domain.custom_message.verb.plural",
            CustomGrammarRole::Copula if self.has_object && self.number <= 1 => "domain.custom_message.copula.singular",
            CustomGrammarRole::Copula => "domain.custom_message.copula.plural",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn original_zero_item_predicates_are_distinct_and_not_normalized() {
        let zero = CustomObjectFacts::new(true, 0).unwrap();
        assert_eq!(zero.source_id(CustomGrammarRole::VerbSuffix), "domain.custom_message.verb.plural");
        assert_eq!(zero.source_id(CustomGrammarRole::Copula), "domain.custom_message.copula.singular");
    }
    #[test]
    fn null_object_uses_plural_native_grammar_without_inventing_a_descriptor() {
        let facts = CustomObjectFacts::new(false, 0).unwrap();
        assert_eq!(facts.source_id(CustomGrammarRole::VerbSuffix), "domain.custom_message.verb.plural");
        assert_eq!(facts.source_id(CustomGrammarRole::Copula), "domain.custom_message.copula.plural");
    }
    #[test]
    fn original_uint8_count_domain_retains_single_and_plural_boundaries() {
        for count in 0..=255 {
            let facts = CustomObjectFacts::new(true, count).unwrap();
            assert_eq!(facts.source_id(CustomGrammarRole::VerbSuffix).ends_with("singular"), count == 1);
            assert_eq!(facts.source_id(CustomGrammarRole::Copula).ends_with("singular"), count <= 1);
        }
    }
    #[test]
    fn malformed_or_undisclosed_count_metadata_is_rejected() {
        assert_eq!(CustomObjectFacts::new(true, -1), Err(CustomGrammarError::CountOutOfRange));
        assert_eq!(CustomObjectFacts::new(true, 256), Err(CustomGrammarError::CountOutOfRange));
        assert_eq!(CustomObjectFacts::new(false, 1), Err(CustomGrammarError::CountWithoutObject));
    }
}
