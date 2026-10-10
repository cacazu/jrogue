//! Source-only browser observation adapter; C++ retains original gameplay.
//! No command authorization, simulation, RNG, input consumption or draw calls.
#![deny(unsafe_code)]
mod application;
mod presentation;
mod raw_input;
#[cfg(target_arch = "wasm32")]
#[allow(unsafe_code)] // Narrow WASM imports/export linkage only; no raw Rust dereferences.
mod platform;
pub use application::BrowserInputConsumer;
pub use raw_input::{RawUtf8Error, preserve_raw_utf8};
pub const MAX_RESPONSE_BYTES: usize = 2 * cdda_live_input_snapshot_consumer::MAX_SNAPSHOT_BYTES + 4096;
