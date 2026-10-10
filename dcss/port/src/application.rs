//! Commands/events for verified migration components and upstream console boundaries.
//! This module does not simulate a partial dungeon or claim a full DCSS game.
use crate::display::{Catalog, Language, Message};
use crate::input::{self, Context, Modifiers};
use crate::logic::rng::{PcgRng, RngStreams};
use crate::platform::{self, ConsoleFrame};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VerificationSession {
    pub seed: u64,
    pub player: String,
    pub rng: PcgRng,
    pub draws: u64,
}

impl VerificationSession {
    fn validate(&self) -> Result<(), String> {
        if self.player.len() > 1024 {
            return Err("player name is too long".into());
        }
        if self.draws != self.rng.count() {
            return Err("draw count does not match RNG state".into());
        }
        self.rng.validate().map_err(|error| error.to_string())
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
pub enum Command {
    PackNative {
        files: Vec<platform::NativeFile>,
        #[serde(default)]
        semantic: Option<crate::semantic::SemanticCheckpoint>,
    },
    UnpackNative {
        save: String,
    },
    Seed {
        seed: String,
        player: String,
    },
    Sample {
        session: String,
    },
    Dice {
        session: String,
        count: u32,
        sides: u32,
    },
    Save {
        session: String,
    },
    Load {
        save: String,
    },
    Key {
        key: String,
        modifiers: Modifiers,
        text_mode: bool,
    },
    Mouse {
        column: i32,
        row: i32,
        button: u8,
        columns: u16,
        rows: u16,
    },
    Frame {
        frame: ConsoleFrame,
    },
    Text {
        message: Message,
    },
    TextRuns {
        message: Message,
    },
    GameMessage {
        event: crate::semantic::GameMessageEvent,
    },
    SemanticCheckpoint {
        #[serde(default)]
        checkpoint: Option<crate::semantic::SemanticCheckpoint>,
        #[serde(default)]
        resume: bool,
    },
    Catalog,
}

#[derive(Debug, Deserialize)]
pub struct Request {
    pub language: String,
    #[serde(flatten)]
    pub command: Command,
}

#[derive(Debug, Serialize)]
pub struct Response {
    pub ok: bool,
    pub value: Value,
    pub session: Option<String>,
    pub messages: Vec<Message>,
    pub text: Vec<String>,
}

fn session_decode(text: &str) -> Result<VerificationSession, String> {
    if text.len() > platform::MAX_SAVE_BYTES / 2 {
        return Err("session is too large".into());
    }
    let session: VerificationSession = serde_json::from_str(text).map_err(|e| e.to_string())?;
    session.validate()?;
    Ok(session)
}

fn session_encode(session: &VerificationSession) -> Result<String, String> {
    serde_json::to_string(session).map_err(|e| e.to_string())
}

fn event(id: &str, params: &[(&str, Value)]) -> Result<Message, String> {
    let mut message = Message::new(id).map_err(|e| e.to_string())?;
    for (name, value) in params {
        message = message.with(*name, value.clone());
    }
    Ok(message)
}

fn execute(command: Command) -> Result<(Value, Option<String>, Vec<Message>), String> {
    let mut events = Vec::new();
    let result = match command {
        Command::PackNative { files, semantic } => {
            let native = platform::NativeSave { files, semantic };
            let save = platform::encode_native(&native).map_err(|e| e.to_string())?;
            (
                json!({"save":save}),
                None,
                vec![event("status.native_saved", &[])?],
            )
        }
        Command::UnpackNative { save } => {
            let native = platform::decode_native(&save).map_err(|e| e.to_string())?;
            (
                serde_json::to_value(native).map_err(|e| e.to_string())?,
                None,
                vec![event("status.native_loaded", &[])?],
            )
        }
        Command::Seed { seed, player } => {
            let seed = seed
                .parse::<u64>()
                .map_err(|_| "seed must be an unsigned 64-bit integer")?;
            let mut streams = RngStreams::seeded(seed);
            let session = VerificationSession {
                seed,
                player,
                rng: streams.gameplay_mut().clone(),
                draws: 0,
            };
            session.validate()?;
            events.push(event("rng.seed", &[("seed", json!(seed.to_string()))])?);
            events.push(event(
                "status.player",
                &[("player", json!(session.player))],
            )?);
            (
                json!({"seed":seed.to_string(),"draws":0}),
                Some(session_encode(&session)?),
                events,
            )
        }
        Command::Sample { session } => {
            let mut session = session_decode(&session)?;
            let value = session.rng.next_u32();
            session.draws = session.rng.count();
            events.push(event("rng.sample", &[("value", json!(value))])?);
            (
                json!({"value":value,"draws":session.draws.to_string()}),
                Some(session_encode(&session)?),
                events,
            )
        }
        Command::Dice {
            session,
            count,
            sides,
        } => {
            if !(1..=1000).contains(&count) || !(1..=1_000_000).contains(&sides) {
                return Err("dice parameters are outside the verified range".into());
            }
            let mut session = session_decode(&session)?;
            // Same order as random.cc::roll_dice: count + sum(random2(sides)).
            let mut result = count;
            for _ in 0..count {
                result = result
                    .checked_add(
                        u32::try_from(
                            session
                                .rng
                                .random2(i32::try_from(sides).map_err(|e| e.to_string())?),
                        )
                        .map_err(|e| e.to_string())?,
                    )
                    .ok_or("dice result overflow")?;
            }
            session.draws = session.rng.count();
            events.push(event(
                "dice.result",
                &[
                    ("count", json!(count)),
                    ("sides", json!(sides)),
                    ("result", json!(result)),
                ],
            )?);
            (
                json!({"result":result,"draws":session.draws.to_string()}),
                Some(session_encode(&session)?),
                events,
            )
        }
        Command::Save { session } => {
            let session = session_decode(&session)?;
            let save = platform::encode("migration-verification-v1", &session)
                .map_err(|e| e.to_string())?;
            (
                json!({"save":save}),
                None,
                vec![event("status.saved", &[])?],
            )
        }
        Command::Load { save } => {
            let session: VerificationSession =
                platform::decode("migration-verification-v1", &save).map_err(|e| e.to_string())?;
            session.validate()?;
            (
                json!({"seed":session.seed.to_string(),"draws":session.draws.to_string()}),
                Some(session_encode(&session)?),
                vec![event("status.loaded", &[])?],
            )
        }
        Command::Key {
            key,
            modifiers,
            text_mode,
        } => (
            serde_json::to_value(input::translate(
                &key,
                modifiers,
                if text_mode {
                    Context::Text
                } else {
                    Context::Command
                },
            ))
            .map_err(|e| e.to_string())?,
            None,
            events,
        ),
        Command::Mouse {
            column,
            row,
            button,
            columns,
            rows,
        } => (
            serde_json::to_value(input::mouse(column, row, button, columns, rows))
                .map_err(|e| e.to_string())?,
            None,
            events,
        ),
        Command::Frame { frame } => {
            let text = frame.text().map_err(|e| e.to_string())?;
            (json!({"frame":frame,"plain":text}), None, events)
        }
        Command::GameMessage { event } => {
            event.validate()?;
            let message = event.message.clone();
            (json!({"event": event}), None, vec![message])
        }
        Command::Text { message } | Command::TextRuns { message } => {
            (Value::Null, None, vec![message])
        }
        Command::SemanticCheckpoint { checkpoint, resume } => {
            let checkpoint = match checkpoint {
                Some(checkpoint) => {
                    checkpoint.validate()?;
                    if resume {
                        checkpoint.resumed()?
                    } else {
                        checkpoint
                    }
                }
                None => crate::semantic::SemanticCheckpoint::empty(),
            };
            let messages = checkpoint
                .events
                .iter()
                .map(|entry| entry.event.message.clone())
                .collect();
            (json!({"checkpoint":checkpoint}), None, messages)
        }
        Command::Catalog => (Value::Null, None, events),
    };
    Ok(result)
}

pub fn handle(text: &str) -> String {
    let operation = (|| -> Result<Response, String> {
        if text.len() > platform::MAX_SAVE_BYTES {
            return Err("request is too large".into());
        }
        let request: Request = serde_json::from_str(text).map_err(|e| e.to_string())?;
        let language = match request.language.as_str() {
            "ja" => Language::Ja,
            "en" => Language::En,
            _ => return Err("unsupported language".into()),
        };
        let catalog = Catalog::embedded(language).map_err(|e| e.to_string())?;
        let is_catalog = matches!(&request.command, Command::Catalog);
        let is_text_runs = matches!(&request.command, Command::TextRuns { .. });
        let shouts: Vec<bool> = match &request.command {
            Command::GameMessage { event } => vec![event.shout],
            Command::SemanticCheckpoint {
                checkpoint: Some(checkpoint),
                ..
            } => checkpoint
                .events
                .iter()
                .map(|entry| entry.event.shout)
                .collect(),
            _ => Vec::new(),
        };
        let (mut value, session, messages) = execute(request.command)?;
        if is_catalog {
            let mut labels = serde_json::Map::new();
            for id in catalog.ids() {
                if let Ok(text) = catalog.render_id(id) {
                    labels.insert(id.to_owned(), json!(text));
                }
            }
            value = Value::Object(labels);
        }
        if is_text_runs {
            let message = messages.first().ok_or("text_runs requires a message")?;
            value = serde_json::to_value(
                catalog
                    .render_runs(message)
                    .map_err(|error| error.to_string())?,
            )
            .map_err(|error| error.to_string())?;
        }
        let mut text = Vec::with_capacity(messages.len());
        for (index, message) in messages.iter().enumerate() {
            let rendered = catalog.render(message).map_err(|e| e.to_string())?;
            text.push(
                if shouts.get(index).copied().unwrap_or(false) && language == Language::En {
                    rendered.to_uppercase()
                } else {
                    rendered
                },
            );
        }
        Ok(Response {
            ok: true,
            value,
            session,
            messages,
            text,
        })
    })();
    let response = match operation {
        Ok(response) => response,
        Err(reason) => Response {
            ok: false,
            value: json!({"error":reason}),
            session: None,
            messages: Vec::new(),
            text: Vec::new(),
        },
    };
    match serde_json::to_string(&response) {Ok(text)=>text,Err(_)=>"{\"ok\":false,\"value\":{\"error\":\"serialization failed\"},\"session\":null,\"messages\":[],\"text\":[]}".into()}
}

#[cfg(test)]
mod tests {
    use super::*;
    fn call(value: Value) -> Value {
        serde_json::from_str(&handle(&value.to_string())).expect("response JSON")
    }
    #[test]
    fn maximum_seed_event_roundtrips_through_browser_json_and_both_languages() {
        let maximum = u64::MAX.to_string();
        let started = call(json!({"op":"seed","language":"ja","seed":maximum,"player":"test"}));
        assert_eq!(started["ok"], true);
        assert_eq!(started["value"]["seed"], maximum);
        let event = &started["messages"][0];
        assert_eq!(event["params"]["seed"], maximum);
        for language in ["en", "ja"] {
            let rendered = call(json!({"op":"text","language":language,"message":event}));
            assert_eq!(rendered["ok"], true);
            assert!(
                rendered["text"][0]
                    .as_str()
                    .expect("seed text")
                    .contains(&maximum)
            );
        }
    }
    #[test]
    fn verification_draw_counter_wraps_like_the_original_for_sample_and_dice() {
        let started = call(json!({"op":"seed","language":"ja","seed":"42","player":"test"}));
        let mut session: Value =
            serde_json::from_str(started["session"].as_str().expect("session")).expect("JSON");
        session["draws"] = json!(u64::MAX);
        session["rng"]["count"] = json!(u64::MAX);
        let sample = call(json!({"op":"sample","language":"ja","session":session.to_string()}));
        let dice = call(
            json!({"op":"dice","language":"ja","session":session.to_string(),"count":1,"sides":2}),
        );
        for response in [sample, dice] {
            assert_eq!(response["ok"], true);
            assert_eq!(response["value"]["draws"], "0");
        }
    }
    #[test]
    fn language_does_not_change_draws_and_names_remain_external() {
        let ja = call(json!({"op":"seed","language":"ja","seed":"42","player":"名前 Alice 😀"}));
        assert_eq!(ja["ok"], true);
        let en = call(json!({"op":"seed","language":"en","seed":"42","player":"名前 Alice 😀"}));
        assert_eq!(ja["session"], en["session"]);
        let name = ja["text"][1].as_str().expect("player label");
        assert!(name.contains("名前 Alice 😀"));
        let a = call(json!({"op":"sample","language":"ja","session":ja["session"]}));
        let b = call(json!({"op":"sample","language":"en","session":en["session"]}));
        assert_eq!(a["value"], b["value"]);
        assert_eq!(a["session"], b["session"]);
    }
    #[test]
    fn save_resumes_exact_next_draw() {
        let started = call(
            json!({"op":"seed","language":"ja","seed":"18446744073709551615","player":"test"}),
        );
        let first = call(json!({"op":"sample","language":"ja","session":started["session"]}));
        let saved = call(json!({"op":"save","language":"ja","session":first["session"]}));
        assert_eq!(saved["ok"], true);
        let loaded = call(json!({"op":"load","language":"ja","save":saved["value"]["save"]}));
        assert_eq!(loaded["ok"], true);
        let a = call(json!({"op":"sample","language":"ja","session":first["session"]}));
        let b = call(json!({"op":"sample","language":"ja","session":loaded["session"]}));
        assert_eq!(a["session"], b["session"]);
        assert_eq!(a["value"], b["value"]);
    }
    #[test]
    fn history_restore_is_quiet_bilingual_and_starts_a_new_host_segment() {
        let checkpoint = crate::semantic::SemanticCheckpoint::empty();
        let result = call(
            json!({"op":"semantic_checkpoint","language":"ja","checkpoint":checkpoint,"resume":true}),
        );
        assert_eq!(result["ok"], true);
        assert_eq!(result["value"]["checkpoint"]["session"], "2");
        assert_eq!(result["messages"], json!([]));
        assert_eq!(result["text"], json!([]));
        let legacy = call(
            json!({"op":"semantic_checkpoint","language":"en","checkpoint":null,"resume":true}),
        );
        assert_eq!(legacy["ok"], true);
        assert_eq!(legacy["value"]["checkpoint"]["session"], "1");
    }

    #[test]
    fn native_pack_rejects_future_history_without_returning_a_save() {
        let invalid = json!({
            "op":"pack_native", "language":"ja",
            "files":[{"path":"saves/Player.cs","bytes":[0,255]}],
            "semantic":{"version":2,"upstream":crate::UPSTREAM_COMMIT,"session":"1","events":[]}
        });
        let result = call(invalid);
        assert_eq!(result["ok"], false);
        assert!(result["value"].get("save").is_none());
    }

    #[test]
    fn text_runs_exposes_owned_dynamic_runs_and_preserves_legacy_text_response() {
        let message = json!({
            "id":"startup.dynamic.species_name",
            "params":{"species":{
                "kind":"entity_label","version":1,"upstream":crate::UPSTREAM_COMMIT,
                "domain":"species","id":"species.sp_human.name","form":"name"
            }}
        });
        for (language, expected) in [("ja", "人間"), ("en", "Human")] {
            let runs = call(json!({"op":"text_runs","language":language,"message":message}));
            assert_eq!(runs["ok"], true, "{runs}");
            assert_eq!(runs["value"]["text"], expected);
            assert_eq!(runs["text"][0], expected);
            assert_eq!(runs["value"]["runs"][0]["role"], "entity_label");
            assert_eq!(runs["value"]["runs"][0]["text"], expected);
            assert_eq!(runs["messages"][0], message);
            let legacy = call(json!({"op":"text","language":language,"message":message}));
            assert_eq!(legacy["ok"], true);
            assert_eq!(legacy["value"], Value::Null);
            assert_eq!(legacy["text"], runs["text"]);
        }
    }

    #[test]
    fn text_runs_rejects_unreviewed_dynamic_entity_descriptors() {
        let baseline = json!({
            "id":"startup.dynamic.species_name",
            "params":{"species":{
                "kind":"entity_label","version":1,"upstream":crate::UPSTREAM_COMMIT,
                "domain":"species","id":"species.sp_human.name","form":"name"
            }}
        });
        let changes = [
            ("domain", json!("job")),
            ("id", json!("species.sp_human.abbrev")),
            ("version", json!(2)),
            ("upstream", json!("different")),
            ("surplus", json!(true)),
        ];
        for (name, value) in changes {
            let mut message = baseline.clone();
            message["params"]["species"][name] = value;
            let result = call(json!({"op":"text_runs","language":"ja","message":message}));
            assert_eq!(result["ok"], false, "{result}");
        }
    }
}
