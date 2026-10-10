//! Pure boundaries around the official NetHack gameplay engine.
//!
//! This crate does not implement NetHack rules, own gameplay state, or use RNG.
//! Platform adapters validate opaque engine saves; presentation consumes semantic
//! events; application input converts device events into explicit command intents.

#![deny(unsafe_op_in_unsafe_fn)]
#![deny(clippy::correctness)]

pub mod application;
pub mod domain;
pub mod ffi;
pub mod platform;
pub mod presentation;

/// Explicit immutable catalog initialization (isolated proposal).
pub mod registered_catalog;
