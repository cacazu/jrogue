//! Incremental migration substrate, not a playable DRL campaign.
//! The four public layers follow the user's plan: logic, display, input, platform.
//! Derived DRL rule/source notices: Copyright (c) 2002-2025 Kornel Kisielewicz.
//! Licensed under GPL 2.0. RNG has the separate notices in licenses/.
pub mod display;
pub mod input;
pub mod logic;
pub mod platform;
pub mod verification;

#[cfg(target_arch = "wasm32")]
mod wasm;

pub const SOURCE_COMMIT: &str = "a6f965072b3a25b768c91dbced00367f1b57d865";
pub const ENGINE_COMMIT: &str = "f89735a741a968997656c2d48a003ec569db7f22";
