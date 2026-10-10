//! Native-core command contracts and reference verification experiments.
//! The user's selected gameplay core remains Pascal/Lua; these Rust numeric checks
//! are not a replacement game. No browser, storage, or locale dependencies.
pub mod rng;
pub mod rules;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Coord {
    pub x: i16,
    pub y: i16,
}

impl Coord {
    /// The original map uses one-based coordinates, dfdata.pas MaxX=78 MaxY=20.
    pub fn is_map_coord(self) -> bool {
        (1..=78).contains(&self.x) && (1..=20).contains(&self.y)
    }
}

/// Stable semantic actions; browser key codes never enter the domain.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Command {
    Walk { dx: i8, dy: i8, run: bool },
    Wait { run: bool },
    Action,
    Fire { alternate: bool },
    Target { alternate: bool },
    TargetNext,
    Reload { alternate: bool },
    Pickup { alternate: bool },
    Look,
    SwapWeapon,
    Active,
    Unload,
    QuickKey { slot: u8 },
    OpenPanel { panel: Panel },
    Confirm,
    Cancel,
    Save,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Panel {
    Help,
    Inventory,
    Equipment,
    Traits,
    Player,
    Messages,
    Assemblies,
    More,
}

impl Command {
    pub fn validate(&self) -> bool {
        match self {
            Self::Walk { dx, dy, .. } => {
                (-1..=1).contains(dx) && (-1..=1).contains(dy) && (*dx != 0 || *dy != 0)
            }
            Self::QuickKey { slot } => (1..=9).contains(slot),
            _ => true,
        }
    }
}
