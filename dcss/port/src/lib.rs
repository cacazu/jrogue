//! DCSS 0.34.1 boundary migration. This crate is not a replacement game engine.
pub mod application;
pub mod display;
pub mod dynamic_text;
pub mod input;
pub mod logic;
pub mod platform;
pub mod semantic;
#[cfg(target_arch = "wasm32")]
mod wasm;

pub const UPSTREAM_COMMIT: &str = "1eebc1a2892e1c89776a0d7a10691f8dac8d9796";
pub const UPSTREAM_VERSION: &str = "0.34.1";
pub const ABI_VERSION: u32 = 1;
