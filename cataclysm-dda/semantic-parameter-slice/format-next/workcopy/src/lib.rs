//! Unconnected source-bound event adapter; no native lookup or gameplay calls.
//! Caller must resolve an observed loaded-definition binding to an existing ID.
//! TextId validates syntax; it does not attest native owner/lifecycle identity.
use cdda_logic_contract::{InvalidTextId, ParameterValue, TextEvent, TextId};
use std::collections::BTreeMap;

pub const PROFESSION: &str = "cdda.character_creation.profession.requirement_completed";
pub const SCENARIO: &str = "cdda.character_creation.scenario.requirement_completed";
pub const FAULT: &str = "cdda.core.fault.fault_blade_cracked.description";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequirementSurface {
    Profession,
    Scenario,
}

/// Bind the original achievement translation leaf. Native green color and
/// surrounding assembly remain outside this plain-text catalog program.
pub fn requirement_event(
    surface: RequirementSurface,
    observed_achievement_name: TextId,
) -> Result<TextEvent, InvalidTextId> {
    term_event(
        match surface {
            RequirementSurface::Profession => PROFESSION,
            RequirementSurface::Scenario => SCENARIO,
        },
        "achievement_name",
        observed_achievement_name,
    )
}

/// Bind the original base itype::nname(1) leaf. This deliberately receives no
/// item instance, variant name, tname result, quantity calculation or RNG.
pub fn fault_event(observed_item_type_name: TextId) -> Result<TextEvent, InvalidTextId> {
    term_event(FAULT, "item_type_name", observed_item_type_name)
}

fn term_event(
    message: &str,
    parameter: &str,
    observed_leaf: TextId,
) -> Result<TextEvent, InvalidTextId> {
    Ok(TextEvent {
        id: TextId::new(message)?,
        parameters: BTreeMap::from([(
            parameter.to_owned(),
            ParameterValue::Term {
                id: observed_leaf,
                count: 1,
            },
        )]),
    })
}

#[cfg(test)]
mod tests;
