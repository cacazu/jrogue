//! A source migration verification harness. This deliberately has no pretend game loop.
use crate::{
    display::{self, Catalog, Message, Parameter},
    logic::rng::{GameRng, RngState},
    platform,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Checkpoint {
    pub seed: u32,
    pub rng: RngState,
    pub draws: u64,
    pub last_value: Option<u32>,
    pub last_input_id: Option<String>,
}

pub struct Verification {
    rng: GameRng,
    seed: u32,
    draws: u64,
    last_value: Option<u32>,
    last_input_id: Option<String>,
    en: Catalog,
    ja: Catalog,
}

impl Verification {
    pub fn new(seed: u32) -> Result<Self, display::DisplayError> {
        let mut en = display::catalog_json(include_str!("../locales/en.json"))?;
        let mut ja = display::catalog_json(include_str!("../locales/ja.json"))?;
        en.extend(display::catalog_json(include_str!(
            "../locales/input-en.json"
        ))?);
        ja.extend(display::catalog_json(include_str!(
            "../locales/input-ja.json"
        ))?);
        display::validate_pair(&en, &ja)?;
        Ok(Self {
            rng: GameRng::seeded(seed),
            seed,
            draws: 0,
            last_value: None,
            last_input_id: None,
            en,
            ja,
        })
    }
    pub fn checkpoint(&self) -> Checkpoint {
        Checkpoint {
            seed: self.seed,
            rng: self.rng.snapshot(),
            draws: self.draws,
            last_value: self.last_value,
            last_input_id: self.last_input_id.clone(),
        }
    }
    pub fn reset(&mut self, seed: u32) {
        self.rng = GameRng::seeded(seed);
        self.seed = seed;
        self.draws = 0;
        self.last_value = None;
        self.last_input_id = None;
    }
    pub fn draw(&mut self) -> u32 {
        let value = self.rng.next_u32();
        self.draws += 1;
        self.last_value = Some(value);
        value
    }
    pub fn dice(&mut self, number: u32, sides: u32) -> Result<u32, &'static str> {
        if number > 4096 || sides > 1_000_000_000 {
            return Err("dice request exceeds verification limits");
        }
        // The harness counts logical draws for dice only; range rejection can consume extra MT words.
        let value = self.rng.dice(number, sides);
        if number != 0 && sides > 1 {
            self.draws += u64::from(number);
        }
        self.last_value = Some(value);
        Ok(value)
    }
    pub fn observe_input(&mut self, id: &str) {
        self.last_input_id = Some(id.into());
    }
    pub fn save(&self) -> Result<String, platform::SaveError> {
        platform::encode(&self.checkpoint())
    }
    pub fn restore(&mut self, envelope: &str) -> Result<(), platform::SaveError> {
        let state: Checkpoint = platform::decode(envelope)?;
        if state.draws > 1_000_000_000
            || state
                .last_input_id
                .as_ref()
                .is_some_and(|id| id.len() > 100 || !self.ja.contains_key(&format!("{id}.name")))
        {
            return Err(platform::SaveError::InvalidPayload);
        }
        let rng = GameRng::restore(state.rng).map_err(|_| platform::SaveError::InvalidPayload)?;
        self.rng = rng;
        self.seed = state.seed;
        self.draws = state.draws;
        self.last_value = state.last_value;
        self.last_input_id = state.last_input_id;
        Ok(())
    }
    pub fn catalog(&self, english: bool) -> &Catalog {
        if english { &self.en } else { &self.ja }
    }
    /// Rust owns both static and parameterized presentation. The DOM adapter only inserts text.
    pub fn labels(&self, english: bool) -> Result<Catalog, display::DisplayError> {
        let mut labels = BTreeMap::new();
        for id in self
            .catalog(english)
            .keys()
            .filter(|id| id.starts_with("lab."))
        {
            let parameters = match id.as_str() {
                "lab.last_value" => BTreeMap::from([(
                    "value".into(),
                    self.last_value.map_or_else(
                        || Parameter::Text("—".into()),
                        |value| Parameter::Number(i64::from(value)),
                    ),
                )]),
                "lab.draw_count" => {
                    BTreeMap::from([("count".into(), Parameter::Text(self.draws.to_string()))])
                }
                "lab.command" => {
                    let text = match self.last_input_id.as_ref() {
                        Some(id) => self
                            .catalog(english)
                            .get(&format!("{id}.name"))
                            .cloned()
                            .ok_or_else(|| display::DisplayError::MissingId(id.clone()))?,
                        None => "—".into(),
                    };
                    BTreeMap::from([("command".into(), Parameter::Text(text))])
                }
                _ => BTreeMap::new(),
            };
            labels.insert(id.clone(), self.render(english, id, parameters)?);
        }
        Ok(labels)
    }
    pub fn render(
        &self,
        english: bool,
        id: &str,
        parameters: BTreeMap<String, Parameter>,
    ) -> Result<String, display::DisplayError> {
        display::render(
            self.catalog(english),
            &Message {
                id: id.into(),
                parameters,
            },
        )
    }
}
