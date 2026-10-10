//! Uncompiled source preparation: immutable input observation, never commands.
//! The original C++ engine owns gameplay, rendering, input consumption and RNG.
#![forbid(unsafe_code)]

mod consumer;
mod model;
mod transport;
mod wire;

pub use consumer::{Availability, Notice, NoticeError, ObservationError, ObservationOutcome, SnapshotConsumer};
pub use model::{BindingDescriptor, BindingOrigin, BindingType, BuildIdentity, CommandAuthorization,
    ContextSnapshot, DenialReason, IdentityError, Modifier, PreferredKeyboardMode,
    RegisteredAction, TextPolicy};
pub use transport::{CopyError, SnapshotTransport, copy_owned_snapshot};
pub use wire::{SnapshotError, parse_snapshot};

pub const SOURCE_COMMIT: &str = "7b2efa5cea38e4d4d97dd0e63b28b9148623da59";
pub const MAX_SNAPSHOT_BYTES: usize = 256 * 1024;
pub const MAX_FIELD_BYTES: usize = 16 * 1024;
pub const MAX_ACTIONS: usize = 2048;
pub const MAX_BINDINGS_PER_ACTION: usize = 128;
pub const MAX_KEY_SEQUENCE: usize = 64;
pub const MAX_SCOPE_DEPTH: u32 = 64;

