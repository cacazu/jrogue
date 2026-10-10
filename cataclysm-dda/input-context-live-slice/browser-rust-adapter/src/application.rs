use cdda_live_input_snapshot_consumer::{Availability, BuildIdentity, CopyError, NoticeError,
    ObservationError, ObservationOutcome, SnapshotConsumer, SnapshotTransport};
use crate::{presentation, preserve_raw_utf8, RawUtf8Error};
/// Identity is supplied once by the explicitly pinned host manifest, never a native packet.
pub struct BrowserInputConsumer { consumer: SnapshotConsumer, expected: BuildIdentity }
fn availability(value: Availability) -> &'static str { match value {
    Availability::Unavailable=>"unavailable",Availability::Ready=>"ready",
    Availability::SerializationFailure=>"serialization_failure",Availability::Unsupported=>"unsupported" } }
fn rejection<E>(value: ObservationError<E>) -> &'static str { match value {
    ObservationError::Notice(NoticeError::UnsupportedKind)=>"ui.input.observation.unsupported_kind",
    ObservationError::Notice(NoticeError::UnsupportedAvailability)=>"ui.input.observation.unsupported_availability",
    ObservationError::Notice(NoticeError::InvalidZeroGeneration)=>"ui.input.observation.invalid_generation",
    ObservationError::Copy(CopyError::Transport(_))=>"ui.input.observation.transport_error",
    ObservationError::Copy(CopyError::Unavailable)=>"ui.input.observation.unavailable",
    ObservationError::Copy(CopyError::InvalidSize)=>"ui.input.observation.invalid_size",
    ObservationError::Copy(CopyError::InvalidRange)=>"ui.input.observation.invalid_range",
    ObservationError::Copy(CopyError::OwnedLengthMismatch)=>"ui.input.observation.length_mismatch",
    ObservationError::Snapshot(_)=>"ui.input.observation.invalid_snapshot",
    ObservationError::PublicationMismatch=>"ui.input.observation.publication_mismatch",
    ObservationError::ConflictingNotice=>"ui.input.observation.conflicting_notice" } }
impl BrowserInputConsumer {
    pub fn new(expected: BuildIdentity) -> Self { Self { consumer: SnapshotConsumer::new(expected.clone()), expected } }
    pub fn observe<T: SnapshotTransport>(&mut self, kind: u32, low: u32, high: u32,
        availability_word: u32, transport: &mut T) -> Vec<u8> {
        let (outcome, availability, error_id)=match self.consumer.observe_parts(kind,low,high,availability_word,transport) {
            ObservationOutcome::Ready=>("ready",Some("ready"),None),
            ObservationOutcome::Stale=>("stale",None,None),
            ObservationOutcome::Unavailable(value)=>("unavailable",Some(availability(value)),None),
            ObservationOutcome::TerminalUnavailable=>("terminal_unavailable",Some("unsupported"),None),
            ObservationOutcome::Rejected(error)=>("rejected",None,Some(rejection(error))),
        };
        self.response(outcome, availability, error_id)
    }
    pub(crate) fn response(&mut self, outcome: &str, availability: Option<&str>, error_id: Option<&str>) -> Vec<u8> {
        match presentation::snapshot_response(&self.consumer,self.expected.build_id(),outcome,availability,error_id) {
            Some(bytes)=>bytes,
            None=>{
                self.consumer.invalidate_observation();
                presentation::snapshot_response(&self.consumer,self.expected.build_id(),"rejected",None,
                    Some("ui.input.observation.response_too_large")).expect("bounded unavailable response")
            }
        }
    }
    pub fn invalidate(&mut self) -> Vec<u8> { self.consumer.invalidate_observation();self.response("invalidated",None,None) }
    pub fn preserve_user_bytes(&self, bytes: &[u8]) -> Result<Vec<u8>, RawUtf8Error> {
        Ok(presentation::raw_response(preserve_raw_utf8(bytes)?,self.expected.build_id()))
    }
}
