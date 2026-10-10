// Source-derived Tales of Maj'Eyal 1.7.6 scalar-rule migration.
// Copyright (C) 2026 jrogue contributors. GPL-3.0-or-later.
// Original mechanics: Nicolas Casalini and ToME contributors; see source-map.json.
pub mod formulas;
pub mod rng;
pub mod rules;

use rng::Sfmt19937;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const SOURCE_COMMIT: &str = "624a67329fe2ad440c5b344785a9c73fcf22ae63";
pub const RULESET: &str = "tome-1.7.6.scalar-v1";
pub const MAX_EVENTS: usize = 100;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Parameters {
    pub attack: f64,
    pub defense: f64,
    pub damage: f64,
    pub weapon_speed: f64,
    pub speed_bonus: f64,
    pub resist_all: f64,
    pub resist_type: f64,
    pub resist_cap: f64,
    pub actor_speed: f64,
}
impl Default for Parameters {
    fn default() -> Self {
        Self {
            attack: 20.0,
            defense: 15.0,
            damage: 30.0,
            weapon_speed: 1.0,
            speed_bonus: 1.0,
            resist_all: 20.0,
            resist_type: 30.0,
            resist_cap: 70.0,
            actor_speed: 1.0,
        }
    }
}
impl Parameters {
    pub fn validate(&self) -> Result<(), Error> {
        let bounds = [
            (self.attack, -100_000.0, 100_000.0),
            (self.defense, -100_000.0, 100_000.0),
            (self.damage, 0.0, 1_000_000.0),
            (self.weapon_speed, 0.1, 10.0),
            (self.speed_bonus, 0.0, 10.0),
            (self.resist_all, -100.0, 100.0),
            (self.resist_type, -100.0, 100.0),
            (self.resist_cap, 0.0, 100.0),
            (self.actor_speed, 0.1, 10.0),
        ];
        if bounds
            .into_iter()
            .all(|(n, min, max)| n.is_finite() && (min..=max).contains(&n))
        {
            Ok(())
        } else {
            Err(Error::Parameters)
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Argument {
    String(String),
    Number(f64),
    Text(String),
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Event {
    pub id: String,
    pub args: BTreeMap<String, Argument>,
}
impl Event {
    fn new(id: &str, args: &[(&str, Argument)]) -> Self {
        Self {
            id: id.into(),
            args: args.iter().map(|(k, v)| ((*k).into(), v.clone())).collect(),
        }
    }
    pub fn validate(&self) -> Result<(), Error> {
        let expected: &[(&str, bool)] = match self.id.as_str() {
            "event.started" => &[("seed", false)],
            "event.hit" => &[("name", true), ("damage", false)],
            "event.miss" | "event.named" => &[("name", true)],
            "event.tick" => &[("tick", false), ("energy", false)],
            "event.configured" => &[],
            _ => return Err(Error::Parameters),
        };
        if expected.len() != self.args.len() {
            return Err(Error::Parameters);
        }
        for (key, is_string) in expected {
            match self.args.get(*key) {
                Some(Argument::String(s)) if *is_string && valid_name(s) => {}
                Some(Argument::Number(n)) if !is_string && n.is_finite() && n.abs() <= 1e15 => {}
                _ => return Err(Error::Parameters),
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Energy {
    pub base: f64,
    pub active: f64,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct State {
    pub player_name: String,
    pub seed: u32,
    pub tick: u64,
    pub hits: u64,
    pub misses: u64,
    pub energy: Energy,
    pub params: Parameters,
    pub events: Vec<Event>,
    pub rng: Sfmt19937,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    Parameters,
    Name,
    Energy,
    Limit,
}
impl Error {
    pub const fn text_id(self) -> &'static str {
        match self {
            Self::Parameters => "error.parameters",
            Self::Name => "error.name",
            Self::Energy => "error.energy",
            Self::Limit => "error.limit",
        }
    }
}
fn valid_name(name: &str) -> bool {
    !name.trim().is_empty()
        && name.chars().count() <= 80
        && name.len() <= 320
        && !name.chars().any(char::is_control)
}
impl State {
    pub fn new(seed: u32, player_name: String) -> Result<Self, Error> {
        if !valid_name(&player_name) {
            return Err(Error::Name);
        }
        Ok(Self {
            player_name,
            seed,
            tick: 0,
            hits: 0,
            misses: 0,
            energy: Energy {
                base: 0.0,
                active: 1000.0,
            },
            params: Parameters::default(),
            events: vec![Event::new(
                "event.started",
                &[("seed", Argument::Number(f64::from(seed)))],
            )],
            rng: Sfmt19937::new(seed),
        })
    }
    fn emit(&mut self, event: Event) {
        if self.events.len() == MAX_EVENTS {
            self.events.remove(0);
        }
        self.events.push(event);
    }
    pub fn validate(&self) -> Result<(), Error> {
        self.params.validate()?;
        if !valid_name(&self.player_name) {
            return Err(Error::Name);
        }
        if self.tick > 1_000_000_000_000
            || self.hits > 1_000_000_000_000
            || self.misses > 1_000_000_000_000
            || self.events.len() > MAX_EVENTS
            || !self.energy.base.is_finite()
            || !self.energy.active.is_finite()
            || !(0.0..=10_000.0).contains(&self.energy.base)
            || !(0.0..=10_000.0).contains(&self.energy.active)
        {
            return Err(Error::Limit);
        }
        for event in &self.events {
            event.validate()?;
        }
        Ok(())
    }
    pub fn set_params(&mut self, params: Parameters) -> Result<(), Error> {
        params.validate()?;
        self.params = params;
        self.emit(Event::new("event.configured", &[]));
        Ok(())
    }
    pub fn name(&mut self, value: String) -> Result<(), Error> {
        if !valid_name(&value) {
            return Err(Error::Name);
        }
        self.player_name = value;
        self.emit(Event::new(
            "event.named",
            &[("name", Argument::String(self.player_name.clone()))],
        ));
        Ok(())
    }
    /// A scalar-rule sample, not the complete weapon-attack pipeline.
    pub fn strike(&mut self) -> Result<(), Error> {
        if self.energy.active < 1000.0 {
            return Err(Error::Energy);
        }
        if self.hits >= 1_000_000_000_000 || self.misses >= 1_000_000_000_000 {
            return Err(Error::Limit);
        }
        let chance = rules::hit_chance(self.params.attack, self.params.defense, 0.0, 100.0, false);
        // Lua wrapper truncates to int; checkHit already returns a bounded integer.
        let success = self.rng.percent(chance as i32);
        self.energy.active -= 1000.0;
        if success {
            self.hits += 1;
            let resist = rules::combined_resistance(
                self.params.resist_all,
                self.params.resist_type,
                self.params.resist_cap,
                1.0,
            );
            let damage = rules::rescale_damage(self.params.damage) * (1.0 - resist / 100.0);
            self.emit(Event::new(
                "event.hit",
                &[
                    ("name", Argument::String(self.player_name.clone())),
                    ("damage", Argument::Number(damage)),
                ],
            ));
        } else {
            self.misses += 1;
            self.emit(Event::new(
                "event.miss",
                &[("name", Argument::String(self.player_name.clone()))],
            ));
        }
        Ok(())
    }
    /// Preserve threshold/grant semantics of GameEnergyBased.tickLevel.
    /// A ready base callback is acknowledged here without inventing actor effects.
    pub fn advance_tick(&mut self) -> Result<(), Error> {
        if self.tick >= 1_000_000_000_000 {
            return Err(Error::Limit);
        }
        self.tick += 1;
        self.energy.base += 100.0;
        if self.energy.base >= 1000.0 {
            self.energy.base -= 1000.0;
        }
        if self.energy.active < 1000.0 {
            self.energy.active += 100.0 * self.params.actor_speed;
        }
        self.emit(Event::new(
            "event.tick",
            &[
                ("tick", Argument::Number(self.tick as f64)),
                ("energy", Argument::Number(self.energy.active)),
            ],
        ));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deterministic_transition_trace() {
        let mut a = State::new(42, "名 % <タグ>".into()).expect("fixture");
        let mut b = a.clone();
        for _ in 0..100 {
            for state in [&mut a, &mut b] {
                state.strike().expect("ready");
                for _ in 0..10 {
                    state.advance_tick().expect("tick");
                }
            }
        }
        assert_eq!(a, b);
        assert_eq!(a.hits + a.misses, 100);
        assert_eq!(a.events.len(), MAX_EVENTS);
    }
    #[test]
    fn invalid_commands_do_not_mutate_state() {
        let mut s = State::new(1, "探索者".into()).expect("fixture");
        s.strike().expect("ready");
        let before = s.clone();
        assert_eq!(s.strike(), Err(Error::Energy));
        assert_eq!(s, before);
        assert_eq!(s.name("\n".into()), Err(Error::Name));
        assert_eq!(s, before);
        let p = Parameters {
            attack: f64::NAN,
            ..Parameters::default()
        };
        assert_eq!(s.set_params(p), Err(Error::Parameters));
        assert_eq!(s, before);
    }
    #[test]
    fn speed_grants_at_threshold_without_extra_grant() {
        let mut s = State::new(1, "x".into()).expect("fixture");
        s.energy.active = 900.0;
        s.params.actor_speed = 2.0;
        s.advance_tick().expect("tick");
        assert_eq!(s.energy.active, 1100.0);
        s.advance_tick().expect("tick");
        assert_eq!(s.energy.active, 1100.0);
    }
}
