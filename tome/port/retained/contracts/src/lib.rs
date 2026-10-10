//! Read-only projection contracts for the retained ToME 1.7.6 C/Lua core.
//! These records are not mutable actors, gameplay state, or save files.
//! Lua owns the complete class graph, userdata, map/FOV caches, and native RNG.

use serde::{Deserialize, Serialize};

pub mod ui;

pub const PROTOCOL: u32 = 1;
pub const MAX_SNAPSHOT_BYTES: usize = 16 * 1024 * 1024;
pub const MAX_MAP_CELLS: usize = 1_048_576;

/// A constrained transport of original `game.key:triggerVirtual` identifiers.
/// Additional actions require the actual native handler and input route to be verified.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum VirtualKey {
    MoveLeft,
    MoveRight,
    MoveUp,
    MoveDown,
    MoveLeftUp,
    MoveRightUp,
    MoveLeftDown,
    MoveRightDown,
    MoveStay,
    AttackOrMoveLeft,
    AttackOrMoveRight,
    AttackOrMoveUp,
    AttackOrMoveDown,
    AttackOrMoveLeftUp,
    AttackOrMoveRightUp,
    AttackOrMoveLeftDown,
    AttackOrMoveRightDown,
}

impl VirtualKey {
    /// Exactly the original native key identifier, never Lua source code.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::MoveLeft => "MOVE_LEFT",
            Self::MoveRight => "MOVE_RIGHT",
            Self::MoveUp => "MOVE_UP",
            Self::MoveDown => "MOVE_DOWN",
            Self::MoveLeftUp => "MOVE_LEFT_UP",
            Self::MoveRightUp => "MOVE_RIGHT_UP",
            Self::MoveLeftDown => "MOVE_LEFT_DOWN",
            Self::MoveRightDown => "MOVE_RIGHT_DOWN",
            Self::MoveStay => "MOVE_STAY",
            Self::AttackOrMoveLeft => "ATTACK_OR_MOVE_LEFT",
            Self::AttackOrMoveRight => "ATTACK_OR_MOVE_RIGHT",
            Self::AttackOrMoveUp => "ATTACK_OR_MOVE_UP",
            Self::AttackOrMoveDown => "ATTACK_OR_MOVE_DOWN",
            Self::AttackOrMoveLeftUp => "ATTACK_OR_MOVE_LEFT_UP",
            Self::AttackOrMoveRightUp => "ATTACK_OR_MOVE_RIGHT_UP",
            Self::AttackOrMoveLeftDown => "ATTACK_OR_MOVE_LEFT_DOWN",
            Self::AttackOrMoveRightDown => "ATTACK_OR_MOVE_RIGHT_DOWN",
        }
    }
}

/// Display language affects Rust UI only, never original actor names or gameplay.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
    #[default]
    Ja,
    En,
}

/// A direct, read-only projection supplied by the live original Lua instance.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Snapshot {
    pub protocol: u32,
    pub ready: bool,
    #[serde(default)]
    pub game: Option<GameSnapshot>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GameSnapshot {
    #[serde(default)]
    pub turn: Option<u64>,
    #[serde(default)]
    pub paused: Option<bool>,
    #[serde(default)]
    pub player: Option<ActorSnapshot>,
    #[serde(default)]
    pub level: Option<LevelSnapshot>,
}

/// Field names preserve `engine.Actor` and `mod.class.Actor`; no Rust recomputation.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActorSnapshot {
    pub uid: u64,
    pub name: String,
    #[serde(default)]
    pub x: Option<i32>,
    #[serde(default)]
    pub y: Option<i32>,
    #[serde(default)]
    pub level: Option<u32>,
    #[serde(default)]
    pub life: Option<f64>,
    #[serde(default)]
    pub max_life: Option<f64>,
    #[serde(default)]
    pub energy: Option<EnergySnapshot>,
    #[serde(default, rename = "energyBase")]
    pub energy_base: Option<f64>,
    #[serde(default)]
    pub dead: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnergySnapshot {
    pub value: f64,
    #[serde(rename = "mod")]
    pub modifier: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LevelSnapshot {
    #[serde(default)]
    pub level: Option<u32>,
    pub map: MapSnapshot,
}

/// Zero-indexed row-major map projection; each layer remains a separate original entity.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MapSnapshot {
    pub w: u32,
    pub h: u32,
    pub cells: Vec<CellSnapshot>,
}

/// `seen` and `remembered` are copied from native map state, never calculated in Rust.
/// This diagnostic projection is not a production invisibility/ESP visibility policy.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CellSnapshot {
    pub x: u32,
    pub y: u32,
    pub seen: bool,
    pub remembered: bool,
    #[serde(default)]
    pub terrain: Option<EntitySnapshot>,
    #[serde(default)]
    pub actor: Option<EntitySnapshot>,
    #[serde(default)]
    pub object: Option<EntitySnapshot>,
    #[serde(default)]
    pub trap: Option<EntitySnapshot>,
}

/// Original `engine.Entity` fields, copied without dynamic-name or display callbacks.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EntitySnapshot {
    pub uid: u64,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub display: Option<String>,
    #[serde(default)]
    pub color_r: Option<f64>,
    #[serde(default)]
    pub color_g: Option<f64>,
    #[serde(default)]
    pub color_b: Option<f64>,
}

/// Observation returned by the original Lua bridge after original key/turn handling.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CommandTrace {
    pub protocol: u32,
    pub command: VirtualKey,
    pub ticks: u64,
    pub before: Snapshot,
    pub after: Snapshot,
}

impl CommandTrace {
    /// Decode an original-core command observation without applying its gameplay in Rust.
    ///
    /// # Errors
    /// Rejects oversized, malformed, incompatible, or invalid projections.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, ContractError> {
        if bytes.len() > MAX_SNAPSHOT_BYTES {
            return Err(ContractError::Bytes);
        }
        let trace: Self = serde_json::from_slice(bytes).map_err(|_| ContractError::Json)?;
        if trace.protocol != PROTOCOL {
            return Err(ContractError::Protocol);
        }
        trace.before.validate()?;
        trace.after.validate()?;
        Ok(trace)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContractError {
    Bytes,
    Json,
    Protocol,
    Map,
    Number,
    Ready,
}

impl ContractError {
    #[must_use]
    pub const fn text_id(self) -> &'static str {
        match self {
            Self::Bytes => "error.core.bytes",
            Self::Json => "error.core.json",
            Self::Protocol => "error.core.protocol",
            Self::Map => "error.core.map",
            Self::Number => "error.core.number",
            Self::Ready => "error.core.not_ready",
        }
    }
}

impl Snapshot {
    /// Decode a bounded projection; this does not reconstruct native objects.
    ///
    /// # Errors
    /// Rejects invalid JSON/schema, protocol versions, map topology, and non-finite values.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, ContractError> {
        if bytes.len() > MAX_SNAPSHOT_BYTES {
            return Err(ContractError::Bytes);
        }
        let snapshot: Self = serde_json::from_slice(bytes).map_err(|_| ContractError::Json)?;
        snapshot.validate()?;
        Ok(snapshot)
    }

    /// Validate projection integrity without inventing gameplay bounds or modifying fields.
    ///
    /// # Errors
    /// Rejects unknown protocol, malformed maps, missing ready-world fields, or non-finite numbers.
    pub fn validate(&self) -> Result<(), ContractError> {
        if self.protocol != PROTOCOL {
            return Err(ContractError::Protocol);
        }
        if self.ready && !self.has_world() {
            return Err(ContractError::Ready);
        }
        if let Some(game) = &self.game {
            if game.turn.is_some_and(|turn| turn > 9_007_199_254_740_991) {
                return Err(ContractError::Number);
            }
            if let Some(actor) = &game.player {
                if ![actor.life, actor.max_life, actor.energy_base]
                    .into_iter()
                    .flatten()
                    .all(f64::is_finite)
                {
                    return Err(ContractError::Number);
                }
                if let Some(energy) = &actor.energy
                    && (!energy.value.is_finite() || !energy.modifier.is_finite())
                {
                    return Err(ContractError::Number);
                }
            }
            if let Some(level) = &game.level {
                let map = &level.map;
                let count = u64::from(map.w)
                    .checked_mul(u64::from(map.h))
                    .and_then(|n| usize::try_from(n).ok())
                    .ok_or(ContractError::Map)?;
                if map.w == 0 || map.h == 0 || count > MAX_MAP_CELLS || count != map.cells.len() {
                    return Err(ContractError::Map);
                }
                let width = usize::try_from(map.w).map_err(|_| ContractError::Map)?;
                for (index, cell) in map.cells.iter().enumerate() {
                    if usize::try_from(cell.x).ok() != Some(index % width)
                        || usize::try_from(cell.y).ok() != Some(index / width)
                    {
                        return Err(ContractError::Map);
                    }
                    for entity in [&cell.terrain, &cell.actor, &cell.object, &cell.trap]
                        .into_iter()
                        .flatten()
                    {
                        if ![entity.color_r, entity.color_g, entity.color_b]
                            .into_iter()
                            .flatten()
                            .all(f64::is_finite)
                        {
                            return Err(ContractError::Number);
                        }
                    }
                }
            }
        }
        Ok(())
    }

    /// Whether the native projection contains the original player and level/map.
    #[must_use]
    pub fn has_world(&self) -> bool {
        self.game
            .as_ref()
            .is_some_and(|game| game.player.is_some() && game.level.is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bootstrap_projection_does_not_invent_an_actor_or_map() {
        let snapshot = Snapshot::from_bytes(br#"{"protocol":1,"ready":false}"#).expect("fixture");
        assert_eq!(snapshot.game, None);
        assert!(!snapshot.has_world());
        assert_eq!(
            Snapshot::from_bytes(br#"{"protocol":1,"ready":true}"#),
            Err(ContractError::Ready)
        );
    }

    #[test]
    fn retained_source_key_names_are_exact_and_not_executable_lua() {
        assert_eq!(VirtualKey::MoveStay.as_str(), "MOVE_STAY");
        assert_eq!(
            VirtualKey::AttackOrMoveLeftUp.as_str(),
            "ATTACK_OR_MOVE_LEFT_UP"
        );
        assert_eq!(
            serde_json::to_string(&VirtualKey::MoveRightDown).expect("fixture"),
            "\"MOVE_RIGHT_DOWN\""
        );
        assert!(serde_json::from_str::<VirtualKey>("\"WAIT\"").is_err());
        assert!(serde_json::from_str::<VirtualKey>("\"game.player.life=999\"").is_err());
        for key in [
            VirtualKey::MoveLeft,
            VirtualKey::MoveRight,
            VirtualKey::MoveUp,
            VirtualKey::MoveDown,
            VirtualKey::MoveLeftUp,
            VirtualKey::MoveRightUp,
            VirtualKey::MoveLeftDown,
            VirtualKey::MoveRightDown,
            VirtualKey::MoveStay,
            VirtualKey::AttackOrMoveLeft,
            VirtualKey::AttackOrMoveRight,
            VirtualKey::AttackOrMoveUp,
            VirtualKey::AttackOrMoveDown,
            VirtualKey::AttackOrMoveLeftUp,
            VirtualKey::AttackOrMoveRightUp,
            VirtualKey::AttackOrMoveLeftDown,
            VirtualKey::AttackOrMoveRightDown,
        ] {
            assert_eq!(
                serde_json::to_string(&key).expect("fixture"),
                format!("\"{}\"", key.as_str())
            );
        }
    }

    #[test]
    fn schema_rejects_wrong_protocol_map_topology_and_gameplay_save_payloads() {
        assert_eq!(
            Snapshot::from_bytes(br#"{"protocol":2,"ready":false}"#),
            Err(ContractError::Protocol)
        );
        assert_eq!(
            Snapshot::from_bytes(br#"{"protocol":1,"ready":false,"rng":[]}"#),
            Err(ContractError::Json)
        );
        let missing =
            br#"{"protocol":1,"ready":false,"game":{"level":{"map":{"w":1,"h":1,"cells":[]}}}}"#;
        assert_eq!(Snapshot::from_bytes(missing), Err(ContractError::Map));
        let duplicate = br#"{"protocol":1,"ready":false,"game":{"level":{"map":{"w":2,"h":1,"cells":[{"x":0,"y":0,"seen":false,"remembered":false},{"x":0,"y":0,"seen":false,"remembered":false}]}}}}"#;
        assert_eq!(Snapshot::from_bytes(duplicate), Err(ContractError::Map));
    }

    #[test]
    fn actual_energy_field_names_survive_projection_without_speed_or_energy_rules() {
        let bytes = br#"{"protocol":1,"ready":false,"game":{"player":{"uid":9,"name":"external","energy":{"value":-12.5,"mod":0.25},"energyBase":123.5}}}"#;
        let snapshot = Snapshot::from_bytes(bytes).expect("fixture");
        let player = snapshot.game.expect("game").player.expect("player");
        assert_eq!(
            player.energy,
            Some(EnergySnapshot {
                value: -12.5,
                modifier: 0.25
            })
        );
        assert_eq!(player.energy_base, Some(123.5));
        let mut invalid = player.clone();
        invalid.life = Some(f64::NAN);
        let snapshot = Snapshot {
            protocol: 1,
            ready: false,
            game: Some(GameSnapshot {
                turn: None,
                paused: None,
                player: Some(invalid),
                level: None,
            }),
        };
        assert_eq!(snapshot.validate(), Err(ContractError::Number));
    }
}
