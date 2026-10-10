//! Replayable observations emitted at reviewed C++ message source sites.
//!
//! Canonical English remains inside the original engine's control path. This
//! schema describes only the accepted message; rendering never executes a pause,
//! joins native history, or invokes Lua/regex hooks again.
use crate::display::Message;
use serde::{Deserialize, Serialize};

/// First bounded source conversion; native save/history has a separate format.
pub const MESSAGE_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GameMessageEvent {
    pub version: u32,
    pub source: String,
    pub upstream: String,
    /// Canonical decimal string, preserving all 64 bits across JavaScript.
    pub sequence: String,
    pub turn: i32,
    pub channel: i32,
    pub param: i32,
    pub colour: u8,
    /// Original message_line decision, after its width rule.
    pub join: bool,
    pub nojoin: bool,
    pub more: bool,
    pub flash: bool,
    /// Original quad-damage shout; replay does not read the duration again.
    pub shout: bool,
    pub message: Message,
}

#[derive(Deserialize)]
struct CannedRegistry {
    commit: String,
    schema_version: u32,
    records: Vec<CannedRecord>,
}

#[derive(Deserialize)]
struct CannedRecord {
    id: String,
    channel_value: i32,
    nojoin: bool,
}

impl GameMessageEvent {
    /// Validate source identity and the exact reviewed, parameter-free slice.
    ///
    /// # Errors
    /// Rejects unknown versions, sources, IDs, channel/flag mismatches, malformed
    /// sequence identities and additional parameters. The catalog separately
    /// checks bilingual ID coverage when the application renders the message.
    pub fn validate(&self) -> Result<(), String> {
        if self.version != MESSAGE_SCHEMA_VERSION
            || self.source != "canned-v1"
            || self.upstream != crate::UPSTREAM_COMMIT
        {
            return Err("unsupported semantic message source or version".into());
        }
        let sequence = self
            .sequence
            .parse::<u64>()
            .map_err(|_| "invalid semantic sequence")?;
        if sequence == 0 || sequence.to_string() != self.sequence {
            return Err("semantic sequence must be a positive canonical decimal u64".into());
        }
        if self.turn < 0 || self.colour > 15 || self.param != 0 {
            return Err("semantic message metadata is outside the reviewed range".into());
        }
        if !self.message.params.is_empty() {
            return Err("canned messages do not accept parameters".into());
        }
        let registry: CannedRegistry = serde_json::from_str(include_str!(
            "../../locales/gameplay/canned-source-map.json"
        ))
        .map_err(|error| format!("invalid embedded canned registry: {error}"))?;
        if registry.commit != crate::UPSTREAM_COMMIT
            || registry.schema_version != MESSAGE_SCHEMA_VERSION
        {
            return Err("embedded canned registry source mismatch".into());
        }
        let record = registry
            .records
            .iter()
            .find(|record| record.id == self.message.id.as_str())
            .ok_or("semantic message ID is not in the reviewed source registry")?;
        if self.channel != record.channel_value || self.nojoin != record.nojoin {
            return Err("semantic channel or nojoin differs from its source receipt".into());
        }
        if self.join && (self.nojoin || self.more) {
            return Err("semantic join contradicts the original control decisions".into());
        }
        Ok(())
    }
}

/// Host-only observation checkpoint. Native save tags and RNG are untouched.
pub const HISTORY_SCHEMA_VERSION: u32 = 1;
pub const MAX_HISTORY_EVENTS: usize = 1000;
pub const MAX_HISTORY_BYTES: usize = 256 * 1024;

/// Session disambiguates the native observer counter after a fresh engine boot.
/// The exact source event sequence is never renumbered.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HistoryEntry {
    pub session: String,
    pub event: GameMessageEvent,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SemanticCheckpoint {
    pub version: u32,
    pub upstream: String,
    /// Current host session; an empty resumed segment is still recorded here.
    pub session: String,
    pub events: Vec<HistoryEntry>,
}

fn positive_u64(text: &str) -> Result<u64, String> {
    let value = text.parse::<u64>().map_err(|_| "invalid history session")?;
    if value == 0 || value.to_string() != text {
        return Err("history session must be a positive canonical decimal u64".into());
    }
    Ok(value)
}

impl SemanticCheckpoint {
    #[must_use]
    pub fn empty() -> Self {
        Self {
            version: HISTORY_SCHEMA_VERSION,
            upstream: crate::UPSTREAM_COMMIT.into(),
            session: "1".into(),
            events: Vec::new(),
        }
    }

    /// Validate all entries before any display, native FS, or storage mutation.
    /// Render both locales to reject unsupported parameter schemas as well.
    ///
    /// # Errors
    /// Rejects unknown schemas/sources, oversized data, invalid event descriptors,
    /// and reordered/duplicate identities within a host session.
    pub fn validate(&self) -> Result<(), String> {
        if self.version != HISTORY_SCHEMA_VERSION || self.upstream != crate::UPSTREAM_COMMIT {
            return Err("unsupported semantic history version or source".into());
        }
        if self.events.len() > MAX_HISTORY_EVENTS
            || serde_json::to_vec(self)
                .map_err(|error| error.to_string())?
                .len()
                > MAX_HISTORY_BYTES
        {
            return Err("semantic history exceeds its bounded checkpoint limit".into());
        }
        let current = positive_u64(&self.session)?;
        let catalogs = [
            crate::display::Catalog::embedded(crate::display::Language::Ja)
                .map_err(|error| error.to_string())?,
            crate::display::Catalog::embedded(crate::display::Language::En)
                .map_err(|error| error.to_string())?,
        ];
        let mut previous = None;
        for entry in &self.events {
            let session = positive_u64(&entry.session)?;
            if session > current {
                return Err("semantic history event belongs to a future host session".into());
            }
            entry.event.validate()?;
            let sequence = entry
                .event
                .sequence
                .parse::<u64>()
                .map_err(|_| "invalid event sequence")?;
            if previous.is_some_and(|identity| (session, sequence) <= identity) {
                return Err("semantic history identities were repeated or reordered".into());
            }
            for catalog in &catalogs {
                catalog
                    .render(&entry.event.message)
                    .map_err(|error| error.to_string())?;
            }
            previous = Some((session, sequence));
        }
        Ok(())
    }

    /// Start a fresh observer segment without changing any native event or tag.
    ///
    /// # Errors
    /// Rejects invalid checkpoints and host-session exhaustion instead of wrap.
    pub fn resumed(&self) -> Result<Self, String> {
        self.validate()?;
        let session = positive_u64(&self.session)?
            .checked_add(1)
            .ok_or("semantic history host session exhausted")?;
        let mut next = self.clone();
        next.session = session.to_string();
        Ok(next)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::display::{Catalog, Language};
    use serde_json::json;

    fn example() -> GameMessageEvent {
        serde_json::from_value(json!({
            "version":1, "source":"canned-v1", "upstream":crate::UPSTREAM_COMMIT,
            "sequence":"18446744073709551615", "turn":42, "channel":0,
            "param":0, "colour":7, "join":true, "nojoin":false,
            "more":false, "flash":false, "shout":false,
            "message":{"id":"game.canned.nothing_happens","params":{}}
        }))
        .expect("fixture")
    }

    #[test]
    fn semantic_rendering_is_an_immutable_observation_in_both_languages() {
        let event = example();
        event.validate().expect("reviewed event");
        let before = serde_json::to_string(&event).expect("snapshot");
        for language in [Language::Ja, Language::En] {
            let catalog = Catalog::embedded(language).expect("catalog");
            for _ in 0..50 {
                assert!(!catalog.render(&event.message).expect("text").is_empty());
            }
        }
        assert_eq!(serde_json::to_string(&event).expect("snapshot"), before);
        assert_eq!(event.sequence, u64::MAX.to_string());
    }

    #[test]
    fn every_reviewed_canned_event_roundtrips_through_the_application() {
        let registry: serde_json::Value = serde_json::from_str(include_str!(
            "../../locales/gameplay/canned-source-map.json"
        ))
        .expect("registry");
        let records = registry["records"].as_array().expect("records");
        assert_eq!(records.len(), 45);
        for (index, record) in records.iter().enumerate() {
            let mut event = example();
            event.sequence = (index + 1).to_string();
            event.message = Message::new(record["id"].as_str().expect("ID")).expect("ID");
            event.channel =
                i32::try_from(record["channel_value"].as_i64().expect("channel")).expect("range");
            event.nojoin = record["nojoin"].as_bool().expect("flag");
            event.join = !event.nojoin;
            for language in ["en", "ja"] {
                for shout in [false, true] {
                    event.shout = shout;
                    let request = json!({"op":"game_message", "language":language, "event":event});
                    let response: serde_json::Value =
                        serde_json::from_str(&crate::application::handle(&request.to_string()))
                            .expect("response");
                    assert_eq!(response["ok"], true, "{}", response);
                    assert_eq!(
                        response["value"]["event"],
                        serde_json::to_value(&event).expect("event")
                    );
                    let displayed = response["text"][0].as_str().expect("text");
                    if language == "en" {
                        let original = record["english"].as_str().expect("original");
                        assert_eq!(
                            displayed,
                            if shout {
                                original.to_uppercase()
                            } else {
                                original.to_owned()
                            }
                        );
                    } else {
                        assert!(!displayed.is_empty());
                    }
                }
            }
        }
    }

    #[test]
    fn semantic_source_identity_and_control_flags_are_checked() {
        let baseline = example();
        let mutations: [fn(&mut GameMessageEvent); 10] = [
            |event| event.version = 2,
            |event| event.source = "raw-text".into(),
            |event| event.upstream = "another-engine".into(),
            |event| event.sequence = "01".into(),
            |event| event.sequence = "18446744073709551616".into(),
            |event| event.channel = 6,
            |event| event.nojoin = true,
            |event| event.more = true,
            |event| event.param = 1,
            |event| {
                event.message.params.insert("text".into(), json!("English"));
            },
        ];
        for mutate in mutations {
            let mut event = baseline.clone();
            mutate(&mut event);
            assert!(event.validate().is_err());
        }
        let mut value = serde_json::to_value(baseline).expect("value");
        value["unreviewed"] = json!(true);
        assert!(serde_json::from_value::<GameMessageEvent>(value).is_err());
    }
    #[test]
    fn checkpoint_retains_exact_native_sequences_across_host_sessions() {
        let mut first = example();
        first.sequence = u64::MAX.to_string();
        let mut next = example();
        next.sequence = "1".into();
        let checkpoint = SemanticCheckpoint {
            version: 1,
            upstream: crate::UPSTREAM_COMMIT.into(),
            session: "2".into(),
            events: vec![
                HistoryEntry {
                    session: "1".into(),
                    event: first,
                },
                HistoryEntry {
                    session: "2".into(),
                    event: next,
                },
            ],
        };
        checkpoint.validate().expect("two exact source streams");
        let before = serde_json::to_string(&checkpoint).expect("checkpoint");
        let resumed = checkpoint.resumed().expect("next host segment");
        assert_eq!(resumed.session, "3");
        assert_eq!(resumed.events, checkpoint.events);
        assert_eq!(
            serde_json::to_string(&checkpoint).expect("unchanged"),
            before
        );
    }

    #[test]
    fn checkpoint_rejects_corrupt_future_reordered_and_unbounded_history() {
        let baseline = SemanticCheckpoint {
            events: vec![HistoryEntry {
                session: "1".into(),
                event: example(),
            }],
            ..SemanticCheckpoint::empty()
        };
        let mutations: [fn(&mut SemanticCheckpoint); 8] = [
            |value| value.version = 2,
            |value| value.upstream = "different".into(),
            |value| value.session = "01".into(),
            |value| value.events[0].session = "2".into(),
            |value| value.events[0].event.source = "raw-string".into(),
            |value| value.events.push(value.events[0].clone()),
            |value| {
                value.events[0]
                    .event
                    .message
                    .params
                    .insert("unexpected".into(), json!(1));
            },
            |value| value.events = vec![value.events[0].clone(); MAX_HISTORY_EVENTS + 1],
        ];
        for mutate in mutations {
            let mut value = baseline.clone();
            mutate(&mut value);
            assert!(value.validate().is_err());
        }
        let exhausted = SemanticCheckpoint {
            session: u64::MAX.to_string(),
            ..baseline
        };
        assert!(exhausted.resumed().is_err());
        let mut extra = serde_json::to_value(SemanticCheckpoint::empty()).expect("fixture");
        extra["rendered_text"] = json!("must not be persisted");
        assert!(serde_json::from_value::<SemanticCheckpoint>(extra).is_err());
    }
}
