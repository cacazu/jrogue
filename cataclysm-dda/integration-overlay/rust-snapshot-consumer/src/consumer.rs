use crate::{BuildIdentity, CommandAuthorization, ContextSnapshot, CopyError, DenialReason,
    SnapshotError, SnapshotTransport, copy_owned_snapshot, parse_snapshot};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Availability { Unavailable, Ready, SerializationFailure, Unsupported }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NoticeError { UnsupportedKind, UnsupportedAvailability, InvalidZeroGeneration }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Notice {
    publication: u64,
    availability: Availability,
}
impl Notice {
    /// JS must normalize signed WASM i32 import halves with >>> 0 first.
    pub fn from_parts(kind: u32, low: u32, high: u32, availability: u32) -> Result<Self, NoticeError> {
        if kind != 1 { return Err(NoticeError::UnsupportedKind); }
        let availability = match availability {
            0 => Availability::Unavailable,
            1 => Availability::Ready,
            2 => Availability::SerializationFailure,
            3 => Availability::Unsupported,
            _ => return Err(NoticeError::UnsupportedAvailability),
        };
        let publication = (u64::from(high) << 32) | u64::from(low);
        if publication == 0 && availability != Availability::Unsupported {
            return Err(NoticeError::InvalidZeroGeneration);
        }
        Ok(Self { publication, availability })
    }
    pub fn publication_sequence(self) -> u64 { self.publication }
    pub fn availability(self) -> Availability { self.availability }
}

#[derive(Debug)]
pub enum ObservationError<E> {
    Notice(NoticeError),
    Copy(CopyError<E>),
    Snapshot(SnapshotError),
    PublicationMismatch,
    ConflictingNotice,
}

#[derive(Debug)]
pub enum ObservationOutcome<E> {
    Ready,
    Unavailable(Availability),
    Stale,
    TerminalUnavailable,
    Rejected(ObservationError<E>),
}

/// Publication ordering is separate from context epoch ordering. A nested
/// return legitimately restores an older parent epoch with a newer publication.
pub struct SnapshotConsumer {
    identity: BuildIdentity,
    last_notice: Option<Notice>,
    snapshot: Option<ContextSnapshot>,
    terminal: bool,
}
impl SnapshotConsumer {
    pub fn new(identity: BuildIdentity) -> Self {
        Self { identity, last_notice: None, snapshot: None, terminal: false }
    }
    pub fn snapshot(&self) -> Option<&ContextSnapshot> { self.snapshot.as_ref() }
    pub fn terminal_unavailable(&self) -> bool { self.terminal }
    pub fn last_publication_sequence(&self) -> Option<u64> {
        self.last_notice.map(Notice::publication_sequence)
    }
    pub fn command_authorization(&self) -> CommandAuthorization {
        CommandAuthorization::Denied(DenialReason::UntrackedNativeReaders)
    }
    /// Clear presentation state for untracked waits or host transport failures.
    /// Does not reset publication ordering or terminal counter exhaustion.
    pub fn invalidate_observation(&mut self) { self.snapshot = None; }

    pub fn observe_parts<T: SnapshotTransport>(&mut self, kind: u32, low: u32, high: u32,
        availability: u32, transport: &mut T) -> ObservationOutcome<T::Error> {
        match Notice::from_parts(kind, low, high, availability) {
            Ok(notice) => self.observe(notice, transport),
            Err(error) => {
                self.snapshot = None;
                ObservationOutcome::Rejected(ObservationError::Notice(error))
            }
        }
    }

    pub fn observe<T: SnapshotTransport>(&mut self, notice: Notice,
        transport: &mut T) -> ObservationOutcome<T::Error> {
        // Zero/unsupported is terminal even when its number is below last_seen.
        if self.terminal || (notice.publication == 0 && notice.availability == Availability::Unsupported) {
            self.snapshot = None;
            self.terminal = true;
            return ObservationOutcome::TerminalUnavailable;
        }
        if let Some(last) = self.last_notice {
            if notice.publication == last.publication && notice != last {
                self.snapshot = None;
                return ObservationOutcome::Rejected(ObservationError::ConflictingNotice);
            }
            if notice.publication <= last.publication {
                return ObservationOutcome::Stale;
            }
        }
        self.last_notice = Some(notice);
        self.snapshot = None;
        if notice.availability != Availability::Ready {
            return ObservationOutcome::Unavailable(notice.availability);
        }
        let bytes = match copy_owned_snapshot(transport) {
            Ok(bytes) => bytes,
            Err(error) => return ObservationOutcome::Rejected(ObservationError::Copy(error)),
        };
        let snapshot = match parse_snapshot(&bytes, &self.identity) {
            Ok(snapshot) => snapshot,
            Err(error) => return ObservationOutcome::Rejected(ObservationError::Snapshot(error)),
        };
        if snapshot.publication_sequence() != notice.publication {
            return ObservationOutcome::Rejected(ObservationError::PublicationMismatch);
        }
        self.snapshot = Some(snapshot);
        ObservationOutcome::Ready
    }
}
