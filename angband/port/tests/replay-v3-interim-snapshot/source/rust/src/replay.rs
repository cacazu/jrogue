//! Version 3 owns a reproducible bootstrap and ordered platform outcomes.
//! This module never calls C, advances RNG, paints, or accesses the filesystem.
//! Root's FFI copies spans, supplies cached-frame/context SHA-256 evidence and
//! gates external effects while the original C stack is reconstructed.

use crate::input::{EventPacket, NativeEvent};
use crate::platform::{crc32, validate_rng, RngSnapshot, GAME_VERSION, SOURCE_COMMIT};
use std::fmt;
use std::collections::BTreeMap;

pub const VERSION: u16 = 3;
pub const MAX_ENVELOPE: usize = 40 * 1024 * 1024;
pub const MAX_NATIVE: usize = 16 * 1024 * 1024;
pub const MAX_ENVIRONMENT: usize = 4 * 1024 * 1024;
pub const MAX_JOURNAL_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_EVENTS: usize = 262_144;
pub const MAX_CONTEXT: usize = 8 * 1024 * 1024;
pub const MAX_EXTENSIONS: usize = 1024 * 1024;
pub const MAX_PENDING: usize = 256;
pub const MAX_ENVIRONMENT_FACT: usize = 8192;
pub const NATIVE_WAIT_WORDS: usize = 54;
const MAGIC: &[u8; 8] = b"ABRSAVE\0";

/// Exact engine/data/input/semantic-capture contract digests, supplied by Root.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Identity(pub [[u8; 32]; 4]);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BootstrapKind { NewGame, LoadedGame }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NativeLoadMode { LegacyPlain, CheckpointNative }

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Extension {
    pub id: String,
    pub version: u16,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Bootstrap {
    pub kind: BootstrapKind,
    pub native_load_mode: NativeLoadMode,
    pub seed: u32,
    pub post_init_rng: Option<RngSnapshot>,
    pub loaded_boundary_rng: Option<RngSnapshot>,
    pub native: Vec<u8>,
    /// Root-validated isolated mutable FS/environment snapshot, never code.
    pub environment: Vec<u8>,
    pub extensions: Vec<Extension>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WaitMarker {
    pub request: u64,
    /// Number of successful platform deliveries before this request.
    pub delivery: u64,
    /// SHA-256 over native observation + cached cells + owned semantic facts.
    pub digest: [u8; 32],
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Outcome {
    Poll { wait: WaitMarker, event: EventPacket, native_result: i32 },
    Flush { discarded: Vec<EventPacket> },
    /// Stable source site and typed owned result. C validates result shape.
    Environment { site: String, kind: u32, facts: Vec<u8> },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry { pub sequence: u64, pub outcome: Outcome }

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Target {
    pub wait: WaitMarker,
    /// schema, wait, scan, command, saved-depth, width,height, offsets, queue
    /// length, generated, turn,depth,hp,x,y, then the 38 original RNG words.
    pub native_observation: [u32; NATIVE_WAIT_WORDS],
    pub pending: Vec<EventPacket>,
    /// Owned cached presentation/draft facts; never installed before catch-up.
    pub browser_context: Vec<u8>,
    pub extensions: Vec<Extension>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReplayEnvelope {
    pub identity: Identity,
    pub bootstrap: Bootstrap,
    pub entries: Vec<Entry>,
    pub target: Target,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum ReplayError {
    Malformed = 40, Bounds = 41, Identity = 42, Order = 43,
    Mismatch = 44, CaptureFailed = 45, InvalidInput = 46,
}
impl fmt::Display for ReplayError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Malformed => "invalid replay envelope", Self::Bounds => "replay exceeds storage bounds",
            Self::Identity => "replay belongs to a different engine contract", Self::Order => "invalid replay order",
            Self::Mismatch => "replay diverged from the saved continuation", Self::CaptureFailed => "replay capture is unavailable",
            Self::InvalidInput => "invalid typed terminal input",
        })
    }
}
impl std::error::Error for ReplayError {}

fn valid_packet(packet: EventPacket, queued: bool) -> Result<(), ReplayError> {
    if EventPacket::from_words(&packet.words()) != Some(packet) ||
        (queued && matches!(packet.event, NativeEvent::None)) { return Err(ReplayError::InvalidInput); }
    Ok(())
}
fn valid_extensions(values: &[Extension]) -> Result<usize, ReplayError> {
    if values.len() > 16 { return Err(ReplayError::Bounds); }
    let mut total = 0usize;
    for (i, value) in values.iter().enumerate() {
        let cap = match (value.id.as_str(), value.version) {
            ("angband.death_cause", 1) => 16 * 1024,
            ("angband.death_scores", 1) => 512 * 1024,
            _ => return Err(ReplayError::Malformed),
        };
        if value.bytes.len() > cap || std::str::from_utf8(&value.bytes).is_err() ||
            values[..i].iter().any(|v| v.id == value.id) { return Err(ReplayError::Malformed); }
        total = total.checked_add(value.bytes.len()).ok_or(ReplayError::Bounds)?;
    }
    if total > MAX_EXTENSIONS { return Err(ReplayError::Bounds); }
    Ok(total)
}
pub(crate) fn valid_observation(words: &[u32; NATIVE_WAIT_WORDS]) -> Result<(), ReplayError> {
    if words[0] != 1 || words[1] > 1 || words[3] > 1 || words[4] > 255 ||
        words[5] == 0 || words[5] > 255 || words[6] == 0 || words[6] > 255 ||
        words[9] > 512 || words[10] > 1 { return Err(ReplayError::Malformed); }
    let mut rng = [0; 38]; rng.copy_from_slice(&words[16..]);
    validate_rng(&rng).map_err(|_| ReplayError::Malformed)
}
fn entry_size(entry: &Entry) -> Result<usize, ReplayError> {
    Ok(9 + match &entry.outcome {
        Outcome::Poll { event, native_result, .. } => {
            valid_packet(*event, false)?;
            if !(-1..=1).contains(native_result) ||
                (matches!(event.event, NativeEvent::None) && *native_result != 0) {
                return Err(ReplayError::Malformed);
            }
            48 + 64 + 4
        },
        Outcome::Flush { discarded } => {
            if discarded.len() > MAX_PENDING { return Err(ReplayError::Bounds); }
            for packet in discarded { valid_packet(*packet, true)?; }
            4 + discarded.len() * 64
        },
        Outcome::Environment { site, kind, facts } => {
            if site.is_empty() || site.len() > 128 || !site.bytes().all(|c| c.is_ascii_alphanumeric() || b"._-".contains(&c)) ||
                !(1..=6).contains(kind) || facts.len() > MAX_ENVIRONMENT_FACT { return Err(ReplayError::Malformed); }
            let known = match (*kind, site.as_str()) {
                (1, "mon_make.get_mon_num.time" | "z_rand.Rand_init.time" | "z_rand.Rand_simple.time" |
                    "player_util.death_knowledge.time" | "ui_death.display_exit_screen.time" | "ui_input.get_file_text.time") => facts.len() == 8,
                (2, "mon_make.get_mon_num.localtime" | "score.build_score.localtime" | "ui_input.get_file_text.localtime") => facts.len() == 36,
                (3, "ui_death.display_exit_screen.ctime") => !facts.is_empty() && facts.len() <= 128 && facts.last() == Some(&0) &&
                    !facts[..facts.len()-1].contains(&0) && std::str::from_utf8(&facts[..facts.len()-1]).is_ok(),
                (4, "z_rand.Rand_init.pid" | "z_rand.Rand_simple.pid") => facts.len() == 4,
                (5, "z_file.file_exists") => valid_fs_facts(facts, 1),
                (6, "z_file.file_newer") => valid_fs_facts(facts, 2),
                _ => false,
            };
            if !known { return Err(ReplayError::Malformed); }
            4 + site.len() + 4 + 4 + facts.len()
        },
    })
}
fn valid_fs_facts(facts: &[u8], paths: usize) -> bool {
    if facts.len() < paths + 1 || facts.last().is_none_or(|v| *v > 1) { return false; }
    let body = &facts[..facts.len()-1];
    body.last() == Some(&0) && body.iter().filter(|v| **v == 0).count() == paths &&
        body.split(|v| *v == 0).take(paths).all(|path| path.len() < 4096 && std::str::from_utf8(path).is_ok())
}
fn ordered_text(packet: EventPacket, groups: &mut BTreeMap<u64, (u8, u32, u32)>, newest: &mut u64) -> Result<(), ReplayError> {
    let origin = packet.origin;
    if origin.kind < 2 { return Ok(()); }
    if let Some((kind, count, next)) = groups.get_mut(&origin.group) {
        if *kind != origin.kind || *count != origin.scalar_count || *next != origin.scalar_index { return Err(ReplayError::Order); }
        *next = next.checked_add(1).ok_or(ReplayError::Order)?;
    } else {
        if origin.group <= *newest || origin.scalar_index != 0 { return Err(ReplayError::Order); }
        *newest = origin.group;
        groups.insert(origin.group, (origin.kind, origin.scalar_count, 1));
    }
    Ok(())
}

impl ReplayEnvelope {
    pub fn validate(&self) -> Result<(), ReplayError> {
        let base = &self.bootstrap;
        let Some(rng) = base.post_init_rng else { return Err(ReplayError::CaptureFailed); };
        validate_rng(&rng).map_err(|_| ReplayError::Malformed)?;
        if base.native.len() > MAX_NATIVE || base.environment.len() > MAX_ENVIRONMENT ||
            self.entries.len() > MAX_EVENTS || self.target.pending.len() > MAX_PENDING ||
            self.target.browser_context.len() > MAX_CONTEXT { return Err(ReplayError::Bounds); }
        match base.kind {
            BootstrapKind::NewGame if !base.native.is_empty() || base.loaded_boundary_rng.is_some() || base.native_load_mode != NativeLoadMode::LegacyPlain => return Err(ReplayError::Malformed),
            BootstrapKind::LoadedGame if base.native.is_empty() || (base.native_load_mode == NativeLoadMode::CheckpointNative && base.loaded_boundary_rng.is_none()) => return Err(ReplayError::CaptureFailed),
            _ => {},
        }
        if let Some(rng) = base.loaded_boundary_rng { validate_rng(&rng).map_err(|_| ReplayError::Malformed)?; }
        if valid_extensions(&base.extensions)?.checked_add(valid_extensions(&self.target.extensions)?).ok_or(ReplayError::Bounds)? > MAX_EXTENSIONS {
            return Err(ReplayError::Bounds);
        }
        valid_observation(&self.target.native_observation)?;
        std::str::from_utf8(&self.target.browser_context).map_err(|_| ReplayError::Malformed)?;
        for packet in &self.target.pending { valid_packet(*packet, true)?; }
        let mut request = 0u64; let mut delivery = 0u64; let mut bytes = 0usize;
        let mut groups = BTreeMap::new(); let mut newest_group = 0;
        for (sequence, entry) in self.entries.iter().enumerate() {
            if entry.sequence != sequence as u64 { return Err(ReplayError::Order); }
            bytes = bytes.checked_add(entry_size(entry)?).ok_or(ReplayError::Bounds)?;
            if bytes > MAX_JOURNAL_BYTES { return Err(ReplayError::Bounds); }
            if let Outcome::Poll { wait, event, native_result } = &entry.outcome {
                ordered_text(*event, &mut groups, &mut newest_group)?;
                if wait.request != request || wait.delivery != delivery { return Err(ReplayError::Order); }
                request = request.checked_add(1).ok_or(ReplayError::Order)?;
                if !matches!(event.event, NativeEvent::None) && *native_result == 0 { delivery = delivery.checked_add(1).ok_or(ReplayError::Order)?; }
            }
            if let Outcome::Flush { discarded } = &entry.outcome {
                for event in discarded { ordered_text(*event, &mut groups, &mut newest_group)?; }
            }
        }
        for event in &self.target.pending { ordered_text(*event, &mut groups, &mut newest_group)?; }
        if self.target.wait.request != request || self.target.wait.delivery != delivery { return Err(ReplayError::Order); }
        Ok(())
    }

    pub fn encode(&self) -> Result<Vec<u8>, ReplayError> {
        self.validate()?;
        let mut out = Writer(Vec::new());
        out.raw(MAGIC)?; out.u16(VERSION)?; out.raw(SOURCE_COMMIT.as_bytes())?; out.raw(GAME_VERSION.as_bytes())?;
        for digest in self.identity.0 { out.raw(&digest)?; }
        out.u8(if self.bootstrap.kind == BootstrapKind::NewGame { 0 } else { 1 })?;
        out.u8(if self.bootstrap.native_load_mode == NativeLoadMode::LegacyPlain { 0 } else { 1 })?;
        out.u32(self.bootstrap.seed)?; out.rng(self.bootstrap.post_init_rng)?; out.rng(self.bootstrap.loaded_boundary_rng)?;
        out.blob(&self.bootstrap.native)?; out.blob(&self.bootstrap.environment)?; out.extensions(&self.bootstrap.extensions)?;
        out.u32(u32::try_from(self.entries.len()).map_err(|_| ReplayError::Bounds)?)?;
        for entry in &self.entries {
            out.u64(entry.sequence)?;
            match &entry.outcome {
                Outcome::Poll { wait, event, native_result } => {
                    out.u8(1)?; out.marker(*wait)?; out.packet(*event)?; out.u32(*native_result as u32)?;
                },
                Outcome::Flush { discarded } => { out.u8(2)?; out.packets(discarded)?; },
                Outcome::Environment { site, kind, facts } => { out.u8(3)?; out.blob(site.as_bytes())?; out.u32(*kind)?; out.blob(facts)?; },
            }
        }
        out.marker(self.target.wait)?;
        for word in self.target.native_observation { out.u32(word)?; }
        out.packets(&self.target.pending)?; out.blob(&self.target.browser_context)?; out.extensions(&self.target.extensions)?;
        out.u32(crc32(&out.0))?;
        Ok(out.0)
    }

    pub fn decode(bytes: &[u8], expected: Identity) -> Result<Self, ReplayError> {
        if bytes.len() > MAX_ENVELOPE { return Err(ReplayError::Bounds); }
        if bytes.len() < 8 + 2 + 40 + 5 + 128 + 4 { return Err(ReplayError::Malformed); }
        let end = bytes.len() - 4;
        let checksum = u32::from_le_bytes(bytes[end..].try_into().map_err(|_| ReplayError::Malformed)?);
        if crc32(&bytes[..end]) != checksum { return Err(ReplayError::Malformed); }
        let mut input = Reader { bytes: &bytes[..end], position: 0 };
        if input.take(8)? != MAGIC || input.u16()? != VERSION || input.take(40)? != SOURCE_COMMIT.as_bytes() ||
            input.take(5)? != GAME_VERSION.as_bytes() { return Err(ReplayError::Identity); }
        let mut digests = [[0; 32]; 4]; for digest in &mut digests { digest.copy_from_slice(input.take(32)?); }
        let identity = Identity(digests); if identity != expected { return Err(ReplayError::Identity); }
        let kind = match input.u8()? { 0 => BootstrapKind::NewGame, 1 => BootstrapKind::LoadedGame, _ => return Err(ReplayError::Malformed) };
        let native_load_mode = match input.u8()? { 0 => NativeLoadMode::LegacyPlain, 1 => NativeLoadMode::CheckpointNative, _ => return Err(ReplayError::Malformed) };
        let seed = input.u32()?; let post_init_rng = input.rng()?; let loaded_boundary_rng = input.rng()?;
        let native = input.blob(MAX_NATIVE)?; let environment = input.blob(MAX_ENVIRONMENT)?; let extensions = input.extensions()?;
        let count = input.count(MAX_EVENTS)?;
        // Check a minimum encoded entry size before reserving from untrusted counts.
        if count > input.remaining() / 13 { return Err(ReplayError::Malformed); }
        let mut entries = Vec::new(); let journal_start = input.position;
        for _ in 0..count {
            let sequence = input.u64()?;
            let outcome = match input.u8()? {
                1 => Outcome::Poll { wait: input.marker()?, event: input.packet()?, native_result: input.u32()? as i32 },
                2 => Outcome::Flush { discarded: input.packets()? },
                3 => {
                    let site = String::from_utf8(input.blob(128)?).map_err(|_| ReplayError::Malformed)?;
                    let kind = input.u32()?; let facts = input.blob(MAX_ENVIRONMENT_FACT)?;
                    Outcome::Environment { site, kind, facts }
                },
                _ => return Err(ReplayError::Malformed),
            };
            if input.position - journal_start > MAX_JOURNAL_BYTES { return Err(ReplayError::Bounds); }
            entries.push(Entry { sequence, outcome });
        }
        let wait = input.marker()?; let mut native_observation = [0; NATIVE_WAIT_WORDS];
        for word in &mut native_observation { *word = input.u32()?; }
        let pending = input.packets()?; let browser_context = input.blob(MAX_CONTEXT)?; let target_extensions = input.extensions()?;
        if input.remaining() != 0 { return Err(ReplayError::Malformed); }
        let result = Self { identity, bootstrap: Bootstrap { kind, native_load_mode, seed, post_init_rng, loaded_boundary_rng, native, environment, extensions },
            entries, target: Target { wait, native_observation, pending, browser_context, extensions: target_extensions } };
        result.validate()?; Ok(result)
    }
}

struct Writer(Vec<u8>);
impl Writer {
    fn raw(&mut self, bytes: &[u8]) -> Result<(), ReplayError> {
        if self.0.len().checked_add(bytes.len()).ok_or(ReplayError::Bounds)? > MAX_ENVELOPE { return Err(ReplayError::Bounds); }
        self.0.extend_from_slice(bytes); Ok(())
    }
    fn u8(&mut self, v: u8) -> Result<(), ReplayError> { self.raw(&[v]) }
    fn u16(&mut self, v: u16) -> Result<(), ReplayError> { self.raw(&v.to_le_bytes()) }
    fn u32(&mut self, v: u32) -> Result<(), ReplayError> { self.raw(&v.to_le_bytes()) }
    fn u64(&mut self, v: u64) -> Result<(), ReplayError> { self.raw(&v.to_le_bytes()) }
    fn blob(&mut self, v: &[u8]) -> Result<(), ReplayError> { self.u32(u32::try_from(v.len()).map_err(|_| ReplayError::Bounds)?)?; self.raw(v) }
    fn rng(&mut self, rng: Option<RngSnapshot>) -> Result<(), ReplayError> { self.u8(u8::from(rng.is_some()))?; if let Some(rng) = rng { for word in rng { self.u32(word)?; } } Ok(()) }
    fn marker(&mut self, v: WaitMarker) -> Result<(), ReplayError> { self.u64(v.request)?; self.u64(v.delivery)?; self.raw(&v.digest) }
    fn packet(&mut self, v: EventPacket) -> Result<(), ReplayError> { for word in v.words() { self.u32(word)?; } Ok(()) }
    fn packets(&mut self, values: &[EventPacket]) -> Result<(), ReplayError> { self.u32(u32::try_from(values.len()).map_err(|_| ReplayError::Bounds)?)?; for value in values { self.packet(*value)?; } Ok(()) }
    fn extensions(&mut self, values: &[Extension]) -> Result<(), ReplayError> { self.u32(u32::try_from(values.len()).map_err(|_| ReplayError::Bounds)?)?; for value in values { self.blob(value.id.as_bytes())?; self.u16(value.version)?; self.blob(&value.bytes)?; } Ok(()) }
}
struct Reader<'a> { bytes: &'a [u8], position: usize }
impl<'a> Reader<'a> {
    fn remaining(&self) -> usize { self.bytes.len() - self.position }
    fn take(&mut self, count: usize) -> Result<&'a [u8], ReplayError> { let end = self.position.checked_add(count).ok_or(ReplayError::Bounds)?; let value = self.bytes.get(self.position..end).ok_or(ReplayError::Malformed)?; self.position = end; Ok(value) }
    fn u8(&mut self) -> Result<u8, ReplayError> { Ok(self.take(1)?[0]) }
    fn u16(&mut self) -> Result<u16, ReplayError> { Ok(u16::from_le_bytes(self.take(2)?.try_into().map_err(|_| ReplayError::Malformed)?)) }
    fn u32(&mut self) -> Result<u32, ReplayError> { Ok(u32::from_le_bytes(self.take(4)?.try_into().map_err(|_| ReplayError::Malformed)?)) }
    fn u64(&mut self) -> Result<u64, ReplayError> { Ok(u64::from_le_bytes(self.take(8)?.try_into().map_err(|_| ReplayError::Malformed)?)) }
    fn count(&mut self, cap: usize) -> Result<usize, ReplayError> { let count = usize::try_from(self.u32()?).map_err(|_| ReplayError::Bounds)?; if count > cap { return Err(ReplayError::Bounds); } Ok(count) }
    fn blob(&mut self, cap: usize) -> Result<Vec<u8>, ReplayError> { let count = self.count(cap)?; Ok(self.take(count)?.to_vec()) }
    fn rng(&mut self) -> Result<Option<RngSnapshot>, ReplayError> { match self.u8()? { 0 => Ok(None), 1 => { let mut rng = [0; 38]; for word in &mut rng { *word = self.u32()?; } Ok(Some(rng)) }, _ => Err(ReplayError::Malformed) } }
    fn marker(&mut self) -> Result<WaitMarker, ReplayError> { let request = self.u64()?; let delivery = self.u64()?; let mut digest = [0; 32]; digest.copy_from_slice(self.take(32)?); Ok(WaitMarker { request, delivery, digest }) }
    fn packet(&mut self) -> Result<EventPacket, ReplayError> { let mut words = [0; 16]; for word in &mut words { *word = self.u32()?; } EventPacket::from_words(&words).ok_or(ReplayError::InvalidInput) }
    fn packets(&mut self) -> Result<Vec<EventPacket>, ReplayError> { let count = self.count(MAX_PENDING)?; if count > self.remaining() / 64 { return Err(ReplayError::Malformed); } let mut out = Vec::with_capacity(count); for _ in 0..count { out.push(self.packet()?); } Ok(out) }
    fn extensions(&mut self) -> Result<Vec<Extension>, ReplayError> { let count = self.count(16)?; let mut out = Vec::new(); let mut total = 0usize; for _ in 0..count { let id = String::from_utf8(self.blob(128)?).map_err(|_| ReplayError::Malformed)?; let version = self.u16()?; let bytes = self.blob(512 * 1024)?; total = total.checked_add(bytes.len()).ok_or(ReplayError::Bounds)?; if total > MAX_EXTENSIONS { return Err(ReplayError::Bounds); } out.push(Extension { id, version, bytes }); } valid_extensions(&out)?; Ok(out) }
}

/// Live capture never changes simulation. After failure Root keeps input live
/// but must reject saves; it cannot silently replace the lost prefix.
pub struct Recorder {
    pub identity: Identity, pub bootstrap: Bootstrap, entries: Vec<Entry>,
    bytes: usize, request: u64, delivery: u64, pending: Option<WaitMarker>,
    pub failure: Option<ReplayError>,
}
impl Recorder {
    pub fn new(identity: Identity, bootstrap: Bootstrap) -> Self { Self { identity, bootstrap, entries: Vec::new(), bytes: 0, request: 0, delivery: 0, pending: None, failure: None } }
    pub fn enter_wait(&mut self, digest: [u8; 32]) -> Result<WaitMarker, ReplayError> {
        if self.pending.is_some() { self.failure = Some(ReplayError::Order); return Err(ReplayError::Order); }
        let marker = WaitMarker { request: self.request, delivery: self.delivery, digest }; self.pending = Some(marker); Ok(marker)
    }
    fn append(&mut self, outcome: Outcome) -> Result<(), ReplayError> {
        if let Some(error) = self.failure { return Err(error); }
        let entry = Entry { sequence: self.entries.len() as u64, outcome };
        let size = match entry_size(&entry) { Ok(size) => size, Err(error) => { self.failure = Some(error); return Err(error); } };
        let Some(bytes) = self.bytes.checked_add(size) else { self.failure = Some(ReplayError::Bounds); return Err(ReplayError::Bounds); };
        if bytes > MAX_JOURNAL_BYTES || self.entries.len() >= MAX_EVENTS { self.failure = Some(ReplayError::Bounds); return Err(ReplayError::Bounds); }
        self.entries.push(entry); self.bytes = bytes; Ok(())
    }
    pub fn commit(&mut self, event: EventPacket, native_result: i32) -> Result<(), ReplayError> {
        let wait = self.pending.take().ok_or(ReplayError::Order)?;
        self.request = self.request.checked_add(1).ok_or(ReplayError::Order)?;
        if !matches!(event.event, NativeEvent::None) && native_result == 0 { self.delivery = self.delivery.checked_add(1).ok_or(ReplayError::Order)?; }
        self.append(Outcome::Poll { wait, event, native_result })
    }
    pub fn flush(&mut self, discarded: Vec<EventPacket>) -> Result<(), ReplayError> { self.append(Outcome::Flush { discarded }) }
    pub fn environment(&mut self, site: String, kind: u32, facts: Vec<u8>) -> Result<(), ReplayError> { self.append(Outcome::Environment { site, kind, facts }) }
    pub fn save(&self, target: Target) -> Result<Vec<u8>, ReplayError> {
        if let Some(error) = self.failure { return Err(error); }
        if self.pending != Some(target.wait) { return Err(ReplayError::Order); }
        ReplayEnvelope { identity: self.identity, bootstrap: self.bootstrap.clone(), entries: self.entries.clone(), target }.encode()
    }
    pub fn pending(&self) -> Option<WaitMarker> { self.pending }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WaitAction { Recorded { event: EventPacket, native_result: i32 }, Target }

/// Consume exact source requests. A mismatch leaves the cursor unchanged.
pub struct ReplayCursor { pub envelope: ReplayEnvelope, position: usize, request: u64, delivery: u64, waiting: bool }
impl ReplayCursor {
    pub fn new(envelope: ReplayEnvelope) -> Result<Self, ReplayError> { envelope.validate()?; Ok(Self { envelope, position: 0, request: 0, delivery: 0, waiting: false }) }
    pub fn enter_wait(&mut self, digest: [u8; 32]) -> Result<WaitAction, ReplayError> {
        if self.waiting { return Err(ReplayError::Order); }
        let marker = WaitMarker { request: self.request, delivery: self.delivery, digest };
        if self.position == self.envelope.entries.len() {
            if marker != self.envelope.target.wait { return Err(ReplayError::Mismatch); }
            return Ok(WaitAction::Target);
        }
        match &self.envelope.entries[self.position].outcome {
            Outcome::Poll { wait, event, native_result } if *wait == marker => {
                self.waiting = true; Ok(WaitAction::Recorded { event: *event, native_result: *native_result })
            },
            _ => Err(ReplayError::Mismatch),
        }
    }
    pub fn commit(&mut self, event: EventPacket, native_result: i32) -> Result<(), ReplayError> {
        if !self.waiting { return Err(ReplayError::Order); }
        match &self.envelope.entries[self.position].outcome {
            Outcome::Poll { event: expected, native_result: result, .. } if *expected == event && *result == native_result => {
                self.request += 1; if !matches!(event.event, NativeEvent::None) && native_result == 0 { self.delivery += 1; }
                self.position += 1; self.waiting = false; Ok(())
            },
            _ => Err(ReplayError::Mismatch),
        }
    }
    pub fn flush(&mut self) -> Result<Vec<EventPacket>, ReplayError> {
        if self.waiting { return Err(ReplayError::Order); }
        match self.envelope.entries.get(self.position).map(|entry| &entry.outcome) {
            Some(Outcome::Flush { discarded }) => { let result = discarded.clone(); self.position += 1; Ok(result) },
            _ => Err(ReplayError::Mismatch),
        }
    }
    pub fn environment(&mut self, site: &str, kind: u32) -> Result<Vec<u8>, ReplayError> {
        if self.waiting { return Err(ReplayError::Order); }
        match self.envelope.entries.get(self.position).map(|entry| &entry.outcome) {
            Some(Outcome::Environment { site: expected, kind: expected_kind, facts }) if site == expected && kind == *expected_kind => {
                let result = facts.clone(); self.position += 1; Ok(result)
            },
            _ => Err(ReplayError::Mismatch),
        }
    }
    /// Environment BEGIN peeks. C validates path/result shape before COMMIT;
    /// an invalid fact must not consume the saved source operation.
    pub fn peek_environment(&self, site: &str, kind: u32) -> Result<Vec<u8>, ReplayError> {
        if self.waiting { return Err(ReplayError::Order); }
        match self.envelope.entries.get(self.position).map(|entry| &entry.outcome) {
            Some(Outcome::Environment { site: expected, kind: expected_kind, facts }) if site == expected && kind == *expected_kind => Ok(facts.clone()),
            _ => Err(ReplayError::Mismatch),
        }
    }
    pub fn commit_environment(&mut self, site: &str, kind: u32, facts: &[u8]) -> Result<(), ReplayError> {
        if self.peek_environment(site, kind)?.as_slice() != facts { return Err(ReplayError::Mismatch); }
        self.position += 1; Ok(())
    }
    /// At the target, continue capture using the intact original bootstrap.
    /// Target metadata must already have been validated by each owning module.
    pub fn into_recorder(self) -> Result<Recorder, ReplayError> {
        if self.waiting || self.position != self.envelope.entries.len() { return Err(ReplayError::Order); }
        let bytes = self.envelope.entries.iter().try_fold(0usize, |n, e| n.checked_add(entry_size(e)?).ok_or(ReplayError::Bounds))?;
        let wait = self.envelope.target.wait;
        Ok(Recorder { identity: self.envelope.identity, bootstrap: self.envelope.bootstrap, entries: self.envelope.entries,
            bytes, request: self.request, delivery: self.delivery, pending: Some(wait), failure: None })
    }
    pub fn verify_target_observation(&self, words: &[u32]) -> Result<(), ReplayError> {
        if self.position != self.envelope.entries.len() || words != self.envelope.target.native_observation {
            return Err(ReplayError::Mismatch);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::input::{Command, InputOrigin};
    fn packet(code: u32) -> EventPacket { EventPacket { event: NativeEvent::Keyboard(Command::sanitize(code,0).unwrap()), origin: InputOrigin::default() } }
    fn marker(request: u64, delivery: u64, byte: u8) -> WaitMarker { WaitMarker { request, delivery, digest: [byte;32] } }
    fn sample() -> ReplayEnvelope {
        let mut observation = [0;54]; observation[0]=1;observation[1]=1;observation[5]=100;observation[6]=32;
        ReplayEnvelope { identity: Identity([[7;32];4]), bootstrap: Bootstrap { kind: BootstrapKind::NewGame,native_load_mode:NativeLoadMode::LegacyPlain,seed:123,
            post_init_rng:Some([0;38]),loaded_boundary_rng:None,native:Vec::new(),environment:b"{}".to_vec(),extensions:Vec::new() },
            entries:vec![Entry { sequence:0,outcome:Outcome::Poll { wait:marker(0,0,1),event:EventPacket { event:NativeEvent::None,origin:InputOrigin::default() },native_result:0 } },
                Entry { sequence:1,outcome:Outcome::Poll { wait:marker(1,0,2),event:packet(b'6'.into()),native_result:0 } }],
            target:Target { wait:marker(2,1,3),native_observation:observation,pending:vec![packet(0x1f409)],browser_context:b"{}".to_vec(),extensions:Vec::new() } }
    }
    #[test]
    fn version3_roundtrip_preserves_zero_poll_unicode_rng_and_pending_order() {
        let value=sample();let bytes=value.encode().unwrap();assert_eq!(bytes,value.encode().unwrap());
        assert_eq!(ReplayEnvelope::decode(&bytes,value.identity).unwrap(),value);
        assert_eq!(u16::from_le_bytes([bytes[8],bytes[9]]),3);
    }
    #[test]
    fn corrupt_truncated_trailing_and_foreign_contract_are_rejected() {
        let value=sample();let bytes=value.encode().unwrap();
        let mut corrupt=bytes.clone();corrupt[100]^=1;assert_eq!(ReplayEnvelope::decode(&corrupt,value.identity),Err(ReplayError::Malformed));
        assert!(ReplayEnvelope::decode(&bytes[..bytes.len()-1],value.identity).is_err());
        let mut trailing=bytes.clone();trailing.push(0);assert!(ReplayEnvelope::decode(&trailing,value.identity).is_err());
        assert_eq!(ReplayEnvelope::decode(&bytes,Identity([[8;32];4])),Err(ReplayError::Identity));
    }
    #[test]
    fn rejected_enqueue_does_not_increment_delivery_ordinal() {
        let mut value=sample();if let Outcome::Poll { native_result,.. }=&mut value.entries[1].outcome { *native_result=1; }
        value.target.wait.delivery=0;assert!(value.validate().is_ok());value.target.wait.delivery=1;
        assert_eq!(value.validate(),Err(ReplayError::Order));
    }
    #[test]
    fn omitted_zero_poll_and_wrong_native_result_cannot_silently_resume() {
        let value=sample();let mut cursor=ReplayCursor::new(value.clone()).unwrap();
        assert_eq!(cursor.enter_wait([2;32]),Err(ReplayError::Mismatch));
        let WaitAction::Recorded { event,native_result }=cursor.enter_wait([1;32]).unwrap() else { panic!() };
        assert_eq!(cursor.commit(event,1),Err(ReplayError::Mismatch));cursor.commit(event,native_result).unwrap();
        let WaitAction::Recorded { event,native_result }=cursor.enter_wait([2;32]).unwrap() else { panic!() };
        cursor.commit(event,native_result).unwrap();assert_eq!(cursor.enter_wait([3;32]).unwrap(),WaitAction::Target);
        let mut wrong=value.target.native_observation;wrong[13]=12;
        assert_eq!(cursor.verify_target_observation(&wrong),Err(ReplayError::Mismatch));
        cursor.verify_target_observation(&value.target.native_observation).unwrap();
        let resumed=cursor.into_recorder().unwrap();assert_eq!(resumed.save(value.target.clone()).unwrap(),value.encode().unwrap());
    }
    #[test]
    fn environment_peek_and_failed_commit_leave_next_source_operation_intact() {
        let mut value=sample();value.entries.insert(0,Entry { sequence:0,outcome:Outcome::Environment {
            site:"z_file.file_exists".into(),kind:5,facts:b"/data/user/test\0\x01".to_vec() } });
        for (i,entry) in value.entries.iter_mut().enumerate() { entry.sequence=i as u64; }
        let mut cursor=ReplayCursor::new(value).unwrap();let facts=cursor.peek_environment("z_file.file_exists",5).unwrap();
        assert_eq!(cursor.commit_environment("z_file.file_exists",5,b"wrong"),Err(ReplayError::Mismatch));
        assert_eq!(cursor.peek_environment("z_file.file_exists",5).unwrap(),facts);
        cursor.commit_environment("z_file.file_exists",5,&facts).unwrap();assert!(cursor.enter_wait([1;32]).is_ok());
    }
    #[test]
    fn ime_scalar_reordering_group_reuse_and_queue_none_are_rejected() {
        let mut value=sample();let mut first=packet(0x65e5);first.origin=InputOrigin { kind:3,group:1,scalar_index:0,scalar_count:2 };
        let mut second=packet(0x672c);second.origin=InputOrigin { scalar_index:1,..first.origin };
        if let Outcome::Poll { event,.. }=&mut value.entries[1].outcome { *event=first; }
        value.target.pending=vec![second];assert!(value.validate().is_ok());
        value.target.pending[0].origin.scalar_index=0;assert_eq!(value.validate(),Err(ReplayError::Order));
        value.target.pending=vec![EventPacket { event:NativeEvent::None,origin:InputOrigin::default() }];
        assert_eq!(value.validate(),Err(ReplayError::InvalidInput));
    }
    #[test]
    fn failed_capture_and_extension_bounds_never_fall_back_to_stale_save() {
        let value=sample();let mut recorder=Recorder::new(value.identity,value.bootstrap.clone());
        assert!(recorder.environment("unknown.site".into(),1,vec![0;8]).is_err());
        assert_eq!(recorder.failure,Some(ReplayError::Malformed));
        recorder.enter_wait(value.target.wait.digest).unwrap();assert!(recorder.save(value.target).is_err());
        let mut value=sample();value.target.extensions.push(Extension { id:"angband.death_cause".into(),version:1,bytes:vec![b'x';16*1024+1] });
        assert!(value.validate().is_err());
    }
    #[test]
    fn malformed_length_cannot_allocate_from_a_forged_count() {
        let value=sample();let mut bytes=value.encode().unwrap();
        // Native length follows header+identity+kind+seed+post-init RNG+absent loaded RNG.
        let offset=55+128+1+1+4+1+38*4+1;
        bytes[offset..offset+4].copy_from_slice(&u32::MAX.to_le_bytes());
        let end=bytes.len()-4;let checksum=crc32(&bytes[..end]);bytes[end..].copy_from_slice(&checksum.to_le_bytes());
        assert_eq!(ReplayEnvelope::decode(&bytes,value.identity),Err(ReplayError::Bounds));
    }
}
