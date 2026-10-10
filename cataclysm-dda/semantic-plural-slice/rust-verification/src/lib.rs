//! Unconnected test adapter for raw native plural leaves, not gameplay logic.
//! Original C++ must freeze its selector after phase/caller/type conversion.
use cdda_logic_contract::{InvalidTextId, ParameterValue, TextEvent, TextId};
use std::collections::BTreeMap;

/// Internal test binder, deliberately distinct from every upstream public ID.
pub const DISPATCH_ID: &str = "cdda_internal_test.native_plural_leaf_dispatch";

/// Frozen `native_n == 1` decision from the original English/JA producer.
/// This is a selector category, not a displayed quantity or a Rust integer cast.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FrozenNativeSelector {
    One,
    Other,
}

/// Bind an unchanged source ID through the existing typed Term API.
/// The synthetic parameter is explicitly an adapter operand, not an inferred
/// printf role. Count1/0 represent the frozen selector for these two locales.
///
/// # Errors
/// Returns an ID error if the internal binder constant becomes invalid.
pub fn term_event(
    leaf: TextId,
    selector: FrozenNativeSelector,
) -> Result<TextEvent, InvalidTextId> {
    Ok(TextEvent {
        id: TextId::new(DISPATCH_ID)?,
        parameters: BTreeMap::from([(
            "leaf".into(),
            ParameterValue::Term {
                id: leaf,
                count: match selector {
                    FrozenNativeSelector::One => 1,
                    FrozenNativeSelector::Other => 0,
                },
            },
        )]),
    })
}
