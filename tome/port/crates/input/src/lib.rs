//! Application commands and pure input mapping for the scalar mechanics workbench.
//! This layer owns no browser APIs, rendering, storage, or random-number generator.

use serde::{Deserialize, Serialize};
use tome_logic::{Error, Parameters, State};

/// A complete, typed request to the application layer.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Command {
    /// Run one source-derived scalar attack sample.
    Strike,
    /// Advance one source-derived energy tick.
    Tick,
    /// Replace all formula parameters after domain validation.
    Configure { params: Parameters },
    /// Set the external player name without translating it.
    Name { value: String },
    /// Restart the sample with the current name and default parameters.
    Reset { seed: u32 },
}

impl<'de> Deserialize<'de> for Command {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        // Empty struct variants validate the entire object. Serde's internally
        // tagged unit variants otherwise ignore extra fields even with deny_unknown_fields.
        #[derive(Deserialize)]
        #[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
        enum WireCommand {
            Strike {},
            Tick {},
            Configure { params: Parameters },
            Name { value: String },
            Reset { seed: u32 },
        }
        Ok(match WireCommand::deserialize(deserializer)? {
            WireCommand::Strike {} => Self::Strike,
            WireCommand::Tick {} => Self::Tick,
            WireCommand::Configure { params } => Self::Configure { params },
            WireCommand::Name { value } => Self::Name { value },
            WireCommand::Reset { seed } => Self::Reset { seed },
        })
    }
}

/// Parse the browser adapter's JSON request without accepting unrecognized fields.
///
/// # Errors
/// Returns a JSON error for malformed, unknown, or incomplete commands.
pub fn parse_command(json: &str) -> Result<Command, serde_json::Error> {
    serde_json::from_str(json)
}

/// Apply a request through validated domain operations.
///
/// # Errors
/// Returns the domain's semantic error on invalid parameters, names, or energy.
pub fn apply(state: &mut State, command: Command) -> Result<(), Error> {
    match command {
        Command::Strike => state.strike(),
        Command::Tick => state.advance_tick(),
        Command::Configure { params } => state.set_params(params),
        Command::Name { value } => state.name(value),
        Command::Reset { seed } => {
            let replacement = State::new(seed, state.player_name.clone())?;
            *state = replacement;
            Ok(())
        }
    }
}

/// Facts the browser adapter provides for a keyboard event.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct KeyContext {
    /// IME composition is in progress.
    pub composing: bool,
    /// This is an operating-system key repeat.
    pub repeat: bool,
    /// Control modifier is down.
    pub ctrl: bool,
    /// Alt modifier is down.
    pub alt: bool,
    /// Meta/Command modifier is down.
    pub meta: bool,
    /// Focus is inside a text entry or editable element.
    pub editable: bool,
}

/// A browser key event represented without any platform dependency.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KeyInput {
    pub key: String,
    #[serde(default)]
    pub composing: bool,
    #[serde(default)]
    pub repeat: bool,
    #[serde(default)]
    pub ctrl: bool,
    #[serde(default)]
    pub alt: bool,
    #[serde(default)]
    pub meta: bool,
    #[serde(default)]
    pub editable: bool,
}

impl KeyInput {
    /// Combine the platform key name and its relevant event context.
    #[must_use]
    pub fn new(key: String, context: KeyContext) -> Self {
        Self {
            key,
            composing: context.composing,
            repeat: context.repeat,
            ctrl: context.ctrl,
            alt: context.alt,
            meta: context.meta,
            editable: context.editable,
        }
    }
}

/// Map one keyboard key to an application command without intercepting text entry.
#[must_use]
pub fn key_command(input: &KeyInput) -> Option<Command> {
    if input.composing || input.repeat || input.ctrl || input.alt || input.meta || input.editable {
        return None;
    }
    match input.key.as_str() {
        " " | "Space" | "Spacebar" | "Enter" => Some(Command::Strike),
        "." => Some(Command::Tick),
        _ => None,
    }
}

/// Map an accessible button or touch target's action to the same typed command.
#[must_use]
pub fn touch_command(action: &str) -> Option<Command> {
    match action {
        "strike" => Some(Command::Strike),
        "tick" => Some(Command::Tick),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keyboard_mapping_preserves_ime_shortcuts_and_text_entry() {
        assert_eq!(
            key_command(&KeyInput::new("Enter".into(), KeyContext::default())),
            Some(Command::Strike)
        );
        assert_eq!(
            key_command(&KeyInput::new(".".into(), KeyContext::default())),
            Some(Command::Tick)
        );
        for context in [
            KeyContext {
                composing: true,
                ..KeyContext::default()
            },
            KeyContext {
                repeat: true,
                ..KeyContext::default()
            },
            KeyContext {
                ctrl: true,
                ..KeyContext::default()
            },
            KeyContext {
                alt: true,
                ..KeyContext::default()
            },
            KeyContext {
                meta: true,
                ..KeyContext::default()
            },
            KeyContext {
                editable: true,
                ..KeyContext::default()
            },
        ] {
            assert_eq!(key_command(&KeyInput::new("Enter".into(), context)), None);
            assert_eq!(key_command(&KeyInput::new(".".into(), context)), None);
        }
        assert_eq!(
            key_command(&KeyInput::new("Process".into(), KeyContext::default())),
            None
        );
        assert_eq!(
            key_command(&KeyInput::new("Dead".into(), KeyContext::default())),
            None
        );
        let input: KeyInput = serde_json::from_str(r#"{"key":"Enter"}"#).expect("fixture");
        assert_eq!(key_command(&input), Some(Command::Strike));
        assert!(serde_json::from_str::<KeyInput>(r#"{"repeat":true}"#).is_err());
    }

    #[test]
    fn json_commands_reject_unknown_fields_actions_and_incomplete_configurations() {
        assert_eq!(
            parse_command(r#"{"action":"strike"}"#).expect("fixture"),
            Command::Strike
        );
        assert!(parse_command(r#"{"action":"strike","seed":1}"#).is_err());
        assert!(parse_command(r#"{"action":"tick","repeat":true}"#).is_err());
        assert!(parse_command(r#"{"action":"unknown"}"#).is_err());
        assert!(parse_command(r#"{"action":"reset","seed":-1}"#).is_err());
        assert!(parse_command(r#"{"action":"configure","params":{"attack":20}}"#).is_err());
    }

    #[test]
    fn invalid_application_requests_preserve_state() {
        let mut state = State::new(4, "冒険者".into()).expect("fixture");
        let before = state.clone();
        assert_eq!(
            apply(&mut state, Command::Name { value: "\n".into() }),
            Err(Error::Name)
        );
        assert_eq!(state, before);
        let invalid = Parameters {
            damage: -1.0,
            ..Parameters::default()
        };
        assert_eq!(
            apply(&mut state, Command::Configure { params: invalid }),
            Err(Error::Parameters)
        );
        assert_eq!(state, before);
    }

    #[test]
    fn reset_restores_seeded_state_and_preserves_external_name() {
        let name = "Kit {seed} 日本語";
        let mut state = State::new(4, name.into()).expect("fixture");
        apply(&mut state, Command::Strike).expect("ready");
        apply(&mut state, Command::Reset { seed: 9 }).expect("reset");
        assert_eq!(state, State::new(9, name.into()).expect("fixture"));
        assert_eq!(touch_command("tick"), Some(Command::Tick));
        assert_eq!(touch_command("reset"), None);
    }
}
