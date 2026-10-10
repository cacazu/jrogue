//! Safe byte transport around the validated, immutable original-text resolver.
//! No original simulation state, parameters, formatting, RNG, or save data enter it.
use serde::de::{MapAccess, Visitor};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;
use tome_text_kernel::{Callsite, Catalogue, Locale, TextError};

pub const MAX_REQUEST_BYTES: usize = 1024 * 1024;
pub const MAX_OUTPUT_BYTES: usize = 4 * 1024 * 1024;
pub const MAX_STAGE_TOTAL: usize = 64 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stage {
    English,
    Japanese,
    Registry,
    Supplements,
    FormatPolicies,
    Extension,
}
impl Stage {
    pub fn from_code(code: u32) -> Option<Self> {
        match code {
            1 => Some(Self::English),
            2 => Some(Self::Japanese),
            3 => Some(Self::Registry),
            4 => Some(Self::Supplements),
            5 => Some(Self::FormatPolicies),
            6 => Some(Self::Extension),
            _ => None,
        }
    }
    const fn index(self) -> usize {
        match self {
            Self::English => 0,
            Self::Japanese => 1,
            Self::Registry => 2,
            Self::Supplements => 3,
            Self::FormatPolicies => 4,
            Self::Extension => 5,
        }
    }
    const fn limit(self) -> usize {
        match self {
            Self::English => 8 * 1024 * 1024,
            Self::Japanese => 12 * 1024 * 1024,
            Self::Registry => 40 * 1024 * 1024,
            Self::Supplements | Self::Extension => 1024 * 1024,
            Self::FormatPolicies => 256 * 1024,
        }
    }
}

#[derive(Debug, Default)]
pub struct Mailbox {
    bytes: Vec<u8>,
    invalid: bool,
}
impl Mailbox {
    pub fn reset(&mut self) {
        self.bytes.clear();
        self.invalid = false;
    }
    pub fn push_word(&mut self, word: u32, length: u32, limit: usize) -> bool {
        let Ok(count) = usize::try_from(length) else {
            self.invalid = true;
            return false;
        };
        if self.invalid
            || !(1..=4).contains(&count)
            || self.bytes.len().saturating_add(count) > limit
        {
            self.invalid = true;
            return false;
        }
        self.bytes.extend_from_slice(&word.to_le_bytes()[..count]);
        true
    }
    pub fn take(&mut self) -> Result<Vec<u8>, &'static str> {
        if self.invalid {
            self.reset();
            return Err("invalid_mailbox");
        }
        Ok(std::mem::take(&mut self.bytes))
    }
}

#[derive(Debug)]
struct UniqueSupplements(BTreeMap<String, String>);
impl<'de> Deserialize<'de> for UniqueSupplements {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct UniqueVisitor;
        impl<'de> Visitor<'de> for UniqueVisitor {
            type Value = UniqueSupplements;
            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("unique reviewed semantic ID/string supplements")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let mut values = BTreeMap::new();
                while let Some((id, value)) = map.next_entry::<String, String>()? {
                    if values.insert(id, value).is_some() {
                        return Err(serde::de::Error::custom("duplicate supplement ID"));
                    }
                }
                Ok(UniqueSupplements(values))
            }
        }
        deserializer.deserialize_map(UniqueVisitor)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FormatPolicy {
    pub semantic_id: String,
    pub kind: String,
    pub review_status: String,
    pub source: String,
    pub tag: String,
    pub target: String,
    pub argument_index: usize,
    pub source_specifiers: Vec<String>,
    pub target_specifiers: Vec<String>,
    pub source_types: Vec<String>,
    pub target_types: Vec<String>,
    pub delegate_native_format_review: bool,
    pub argument_order: String,
    pub native_special_and_effective_order_checks_required: bool,
    pub removed_layout: RemovedLayout,
    pub source_locations: Vec<serde_json::Value>,
    pub review_basis: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RemovedLayout {
    pub left_justification: bool,
    pub minimum_byte_width: u32,
    pub byte_precision: u32,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PolicyFile {
    schema_version: u32,
    source_commit: String,
    default_action: String,
    policies: UniquePolicies,
}
#[derive(Debug)]
struct UniquePolicies(BTreeMap<String, FormatPolicy>);
impl<'de> Deserialize<'de> for UniquePolicies {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct PolicyVisitor;
        impl<'de> Visitor<'de> for PolicyVisitor {
            type Value = UniquePolicies;
            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("unique reviewed format policy IDs")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let mut values = BTreeMap::new();
                while let Some((id, value)) = map.next_entry::<String, FormatPolicy>()? {
                    if values.insert(id, value).is_some() {
                        return Err(serde::de::Error::custom("duplicate format policy ID"));
                    }
                }
                Ok(UniquePolicies(values))
            }
        }
        deserializer.deserialize_map(PolicyVisitor)
    }
}
const DREAM_ID: &str = "game.modules.tome.data.timed_effects.other.effect.death_dream.method.on_timeout.property.damage_label";
const DREAM_TAG: &str = "effect damage label death_dream";
const SOURCE_COMMIT: &str = "624a67329fe2ad440c5b344785a9c73fcf22ae63";
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ExtensionFile {
    schema_version: u32,
    source_commit: String,
    english: UniqueSupplements,
    japanese: UniqueSupplements,
    registry: Box<serde_json::value::RawValue>,
    provenance: serde_json::Value,
}
fn parse_extension(json: &str, base: &Catalogue) -> Result<Catalogue, &'static str> {
    let file: ExtensionFile = serde_json::from_str(json).map_err(|_| "invalid_extension")?;
    if file.schema_version != 1
        || file.source_commit != SOURCE_COMMIT
        || file.english.0.len() != 1
        || file.japanese.0.len() != 1
        || file.english.0.get(DREAM_ID).map(String::as_str) != Some("dream")
        || file.japanese.0.get(DREAM_ID).map(String::as_str) != Some("夢")
        || !matches!(
            base.resolve_id(DREAM_ID, Locale::English),
            Err(TextError::UnknownId)
        )
        || file.provenance["translation"] != "official_nil_fallback_reuse"
    {
        return Err("invalid_extension_contract");
    }
    let en = serde_json::to_string(&file.english.0).map_err(|_| "invalid_extension")?;
    let ja = serde_json::to_string(&file.japanese.0).map_err(|_| "invalid_extension")?;
    let registry: serde_json::Value =
        serde_json::from_str(file.registry.get()).map_err(|_| "invalid_extension")?;
    if registry["entries"].as_object().map_or(0, |map| map.len()) != 1
        || registry["routes"].as_array().map_or(0, Vec::len) != 1
        || registry["routes"][0]["source"] != "dream"
        || registry["routes"][0]["tag"] != DREAM_TAG
        || registry["routes"][0]["default_id"] != DREAM_ID
        || registry["entries"][DREAM_ID]["tag"] != DREAM_TAG
    {
        return Err("invalid_extension_contract");
    }
    Catalogue::from_json(&en, &ja, file.registry.get()).map_err(|_| "invalid_extension_contract")
}
fn policy_matches(id: &str, policy: &FormatPolicy, source: &str, target: &str) -> bool {
    let expected = match id {
        "game.modules.tome.mod.class.uiset.classicplayerdisplay.method.display.maketexturebar.tformat.parameter" => {
            Some(("%-8.8s:", "%s：", 1))
        }
        "game.modules.tome.mod.dialogs.charactersheet.method.drawdialog.tformat.parameter_parameter_parameter" => {
            Some(("%s%-8.8s: #00ff00#%s ", "%s%s： #00ff00#%s ", 2))
        }
        _ => None,
    };
    let Some((expected_source, expected_target, argument)) = expected else {
        return false;
    };
    let source_tokens = printf_tokens(source);
    let target_tokens = printf_tokens(target);
    policy.kind == "removeByteStringPrecision"
        && policy.semantic_id == id
        && policy.review_status == "reviewed"
        && policy.tag == "tformat"
        && !policy.delegate_native_format_review
        && policy.argument_order == "preserved"
        && policy.native_special_and_effective_order_checks_required
        && policy.removed_layout.left_justification
        && policy.removed_layout.minimum_byte_width == 8
        && policy.removed_layout.byte_precision == 8
        && !policy.review_basis.trim().is_empty()
        && policy.source == source
        && policy.target == target
        && source == expected_source
        && target == expected_target
        && policy.argument_index == argument
        && policy
            .source_specifiers
            .iter()
            .map(String::as_str)
            .eq(source_tokens.iter().copied())
        && policy
            .target_specifiers
            .iter()
            .map(String::as_str)
            .eq(target_tokens.iter().copied())
        && policy.source_types.len() == source_tokens.len()
        && policy.source_types.iter().all(|t| t == "s")
        && policy.target_types == policy.source_types
        && markup_tokens(source) == markup_tokens(target)
}

#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
enum Request {
    Resolve {
        source: String,
        tag: String,
        #[serde(default)]
        file: Option<String>,
        #[serde(default)]
        line: Option<u32>,
        #[serde(default)]
        locale: Locale,
    },
    ResolveId {
        id: String,
        #[serde(default)]
        locale: Locale,
    },
    Supplement {
        id: String,
    },
    FormatPolicy {
        id: String,
    },
    Status {},
}

#[derive(Debug, Serialize)]
pub struct Status {
    pub ok: bool,
    pub ready: bool,
    pub ids: usize,
    pub base_ids: usize,
    pub extension_ids: usize,
    pub supplements: usize,
    pub format_policies: usize,
    pub default_locale: &'static str,
}

#[derive(Debug, Default)]
pub struct TextHost {
    catalogue: Option<Catalogue>,
    extension: Option<Catalogue>,
    supplements: BTreeMap<String, String>,
    format_policies: BTreeMap<String, FormatPolicy>,
    staged: [Option<String>; 6],
    stage: Option<Stage>,
    input: Mailbox,
}
impl TextHost {
    pub fn status(&self) -> Status {
        let base_ids = self.catalogue.as_ref().map_or(0, Catalogue::len);
        let extension_ids = self.extension.as_ref().map_or(0, Catalogue::len);
        Status {
            ok: true,
            ready: self.catalogue.is_some(),
            ids: base_ids + extension_ids,
            base_ids,
            extension_ids,
            supplements: self.supplements.len(),
            format_policies: self.format_policies.len(),
            default_locale: "ja_JP",
        }
    }
    pub fn stage_reset(&mut self, code: u32) -> Result<(), &'static str> {
        if self.catalogue.is_some() {
            return Err("already_initialized");
        }
        self.stage = Stage::from_code(code);
        self.input.reset();
        self.stage.ok_or("invalid_stage").map(|_| ())
    }
    pub fn stage_word(&mut self, word: u32, length: u32) -> bool {
        let Some(stage) = self.stage else {
            return false;
        };
        self.input.push_word(word, length, stage.limit())
    }
    pub fn stage_finish(&mut self) -> Result<(), &'static str> {
        let stage = self.stage.take().ok_or("invalid_stage")?;
        let bytes = self.input.take()?;
        let text = String::from_utf8(bytes).map_err(|_| "invalid_utf8")?;
        let other_bytes: usize = self
            .staged
            .iter()
            .enumerate()
            .filter(|(index, _)| *index != stage.index())
            .filter_map(|(_, text)| text.as_ref())
            .map(String::len)
            .sum();
        if other_bytes.saturating_add(text.len()) > MAX_STAGE_TOTAL {
            return Err("initialization_bytes_exceeded");
        }
        self.staged[stage.index()] = Some(text);
        Ok(())
    }
    pub fn initialize(&mut self) -> Result<(), &'static str> {
        if self.catalogue.is_some() {
            return Err("already_initialized");
        }
        if self.stage.is_some() {
            return Err("unfinished_stage");
        }
        let en = self.staged[0].as_deref().ok_or("missing_english")?;
        let ja = self.staged[1].as_deref().ok_or("missing_japanese")?;
        let registry = self.staged[2].as_deref().ok_or("missing_registry")?;
        let catalogue = Catalogue::from_json(en, ja, registry).map_err(|error| reason(&error))?;
        let supplements = self.staged[3]
            .as_deref()
            .map(|json| {
                serde_json::from_str::<UniqueSupplements>(json).map_err(|_| "invalid_supplements")
            })
            .transpose()?
            .map_or_else(BTreeMap::new, |map| map.0);
        let policies = self.staged[4]
            .as_deref()
            .map(|json| {
                serde_json::from_str::<PolicyFile>(json).map_err(|_| "invalid_format_policies")
            })
            .transpose()?;
        if policies.as_ref().is_some_and(|file| {
            file.schema_version != 1
                || file.source_commit != SOURCE_COMMIT
                || file.default_action != "preserve_exact_native_format_contract"
                || file.policies.0.len() > 2
        }) {
            return Err("invalid_format_policies");
        }
        let policies = policies.map_or_else(BTreeMap::new, |file| file.policies.0);
        for (id, policy) in &policies {
            let source = catalogue
                .resolve_id(id, Locale::English)
                .map_err(|_| "unknown_policy_id")?;
            let target = supplements.get(id).ok_or("policy_without_supplement")?;
            if !policy_matches(id, policy, source.template, target) {
                return Err("invalid_format_policy_contract");
            }
        }
        for (id, japanese) in &supplements {
            let english = catalogue
                .resolve_id(id, Locale::English)
                .map_err(|_| "unknown_supplement_id")?;
            // These are source-preserving reviewed supplements. Base JA metadata
            // remains immutable and keeps official-missing/special/review flags.
            if (printf_tokens_for(english.template, english.tag)
                != printf_tokens_for(japanese, english.tag)
                || markup_tokens(english.template) != markup_tokens(japanese))
                && !policies
                    .get(id)
                    .is_some_and(|policy| policy_matches(id, policy, english.template, japanese))
            {
                return Err("supplement_token_contract");
            }
        }
        let extension = self.staged[5]
            .as_deref()
            .map(|json| parse_extension(json, &catalogue))
            .transpose()?;
        self.catalogue = Some(catalogue);
        self.extension = extension;
        self.supplements = supplements;
        self.format_policies = policies;
        self.staged = Default::default(); // release raw 40 MiB inputs after parsing
        Ok(())
    }
    pub fn request(&self, bytes: &[u8]) -> Vec<u8> {
        if bytes.len() > MAX_REQUEST_BYTES {
            return error_json("request_bytes_exceeded");
        }
        let request = match serde_json::from_slice::<Request>(bytes) {
            Ok(request) => request,
            Err(_) => return error_json("invalid_request"),
        };
        if let Request::Status {} = request {
            return json_bytes(&self.status());
        }
        let Some(catalogue) = &self.catalogue else {
            return error_json("resolver_not_ready");
        };
        match request {
            Request::Resolve {
                source,
                tag,
                file,
                line,
                locale,
            } => {
                let selected = if source == "dream" && tag == DREAM_TAG {
                    let Some(extension) = self.extension.as_ref() else {
                        return error_json("contextual_extension_not_loaded");
                    };
                    extension
                } else {
                    catalogue
                };
                let result = selected.resolve(
                    &source,
                    &tag,
                    Callsite {
                        file: file.as_deref(),
                        line,
                    },
                    locale,
                );
                match result {
                    Ok(result) => json_bytes(&serde_json::json!({"ok":true,"result":result})),
                    Err(error) => error_json(reason(&error)),
                }
            }
            Request::ResolveId { id, locale } => match (if id == DREAM_ID {
                self.extension.as_ref().unwrap_or(catalogue)
            } else {
                catalogue
            })
            .resolve_id(&id, locale)
            {
                Ok(result) => json_bytes(&serde_json::json!({"ok":true,"result":result})),
                Err(error) => error_json(reason(&error)),
            },
            Request::Supplement { id } => {
                json_bytes(&serde_json::json!({"ok":true,"supplement":self.supplements.get(&id)}))
            }
            Request::FormatPolicy { id } => {
                json_bytes(&serde_json::json!({"ok":true,"policy":self.format_policies.get(&id)}))
            }
            Request::Status {} => unreachable!("status was handled without a catalogue"),
        }
    }
}
fn reason(error: &TextError) -> &'static str {
    match error {
        TextError::InvalidJson(_) => "invalid_json",
        TextError::InvalidCatalogue(_) => "invalid_catalogue",
        TextError::UnknownSourceTag => "unknown_source_tag",
        TextError::UnknownId => "unknown_semantic_id",
        TextError::AmbiguousContext => "ambiguous_owner_format_context",
    }
}
fn json_bytes<T: Serialize>(value: &T) -> Vec<u8> {
    match serde_json::to_vec(value) {
        Ok(bytes) if bytes.len() <= MAX_OUTPUT_BYTES => bytes,
        _ => error_json("output_bytes_exceeded"),
    }
}
fn error_json(reason: &str) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!({"ok":false,"reason":reason}))
        .unwrap_or_else(|_| br#"{"ok":false,"reason":"json_encode"}"#.to_vec())
}
fn printf_tokens(text: &str) -> Vec<&str> {
    printf_tokens_for(text, "tformat")
}
fn printf_tokens_for<'a>(text: &'a str, tag: &str) -> Vec<&'a str> {
    let bytes = text.as_bytes();
    let mut result = Vec::new();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] != b'%' {
            index += 1;
            continue;
        }
        let start = index;
        index += 1;
        if bytes.get(index) == Some(&b'%') {
            index += 1;
            result.push(&text[start..index]);
            continue;
        }
        while bytes
            .get(index)
            .is_some_and(|byte| byte.is_ascii_digit() || b"-+ #0.*$".contains(byte))
        {
            index += 1;
        }
        if bytes
            .get(index)
            .is_some_and(|byte| b"cdiouxXeEfgGqsaA".contains(byte))
        {
            index += 1;
            let token = &text[start..index];
            // Source-reviewed _t prose such as "200% global speed" has no
            // native formatter. Match the merger's narrow percentage rule;
            // tformat conversions and literal %% remain strictly checked.
            let percentage_prose = tag != "tformat"
                && start > 0
                && bytes[start - 1].is_ascii_digit()
                && token.contains(' ');
            if !percentage_prose {
                result.push(token);
            }
        }
    }
    result
}
fn markup_tokens(text: &str) -> Vec<&str> {
    let mut result = Vec::new();
    let mut offset = 0;
    while let Some(start) = text[offset..].find('#').map(|index| index + offset) {
        let Some(end) = text[start + 1..].find('#').map(|index| index + start + 1) else {
            break;
        };
        let name = &text[start + 1..end];
        let tag = !name.is_empty()
            && (name.bytes().all(|b| b.is_ascii_alphabetic() || b == b'_')
                || name.len() == 6 && name.bytes().all(|b| b.is_ascii_hexdigit())
                || name.starts_with('{') && name.ends_with('}'));
        if tag {
            result.push(&text[start..=end]);
            offset = end + 1;
        } else {
            offset = start + 1;
        }
    }
    result
}

// Export attributes establish ABI names only. This module has no raw-pointer
// dereference, native-memory reference, imported JS callback or unsafe operation.
#[cfg(target_arch = "wasm32")]
#[allow(unsafe_code)]
mod wasm {
    use super::*;
    use std::cell::RefCell;
    thread_local! {
        static HOST: RefCell<TextHost> = RefCell::new(TextHost::default());
        static REQUEST: RefCell<Mailbox> = RefCell::new(Mailbox::default());
        static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    }
    fn output(bytes: Vec<u8>) {
        OUTPUT.with(|output| *output.borrow_mut() = bytes);
    }
    fn mutation_result(result: Result<(), &'static str>) -> u32 {
        match result {
            Ok(()) => {
                output(HOST.with(|host| json_bytes(&host.borrow().status())));
                1
            }
            Err(reason) => {
                output(error_json(reason));
                0
            }
        }
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_text_stage_reset(kind: u32) -> u32 {
        mutation_result(HOST.with(|host| host.borrow_mut().stage_reset(kind)))
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_text_stage_word(word: u32, length: u32) -> u32 {
        u32::from(HOST.with(|host| host.borrow_mut().stage_word(word, length)))
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_text_stage_finish() -> u32 {
        mutation_result(HOST.with(|host| host.borrow_mut().stage_finish()))
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_text_initialize() -> u32 {
        mutation_result(HOST.with(|host| host.borrow_mut().initialize()))
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_text_request_reset() {
        REQUEST.with(|input| input.borrow_mut().reset());
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_text_request_word(word: u32, length: u32) -> u32 {
        u32::from(REQUEST.with(|input| {
            input
                .borrow_mut()
                .push_word(word, length, MAX_REQUEST_BYTES)
        }))
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_text_request() {
        output(match REQUEST.with(|input| input.borrow_mut().take()) {
            Ok(bytes) => HOST.with(|host| host.borrow().request(&bytes)),
            Err(reason) => error_json(reason),
        });
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_text_output_len() -> u32 {
        OUTPUT.with(|output| output.borrow().len().try_into().unwrap_or(0))
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn tome_text_output_word(offset: u32) -> u32 {
        OUTPUT.with(|output| {
            let output = output.borrow();
            let offset = usize::try_from(offset).unwrap_or(usize::MAX);
            let mut word = [0; 4];
            for (index, byte) in word.iter_mut().enumerate() {
                *byte = offset
                    .checked_add(index)
                    .and_then(|index| output.get(index))
                    .copied()
                    .unwrap_or(0);
            }
            u32::from_le_bytes(word)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn stage(host: &mut TextHost, kind: u32, bytes: &[u8]) {
        host.stage_reset(kind).expect("stage");
        for chunk in bytes.chunks(4) {
            let mut word = [0; 4];
            word[..chunk.len()].copy_from_slice(chunk);
            assert!(host.stage_word(
                u32::from_le_bytes(word),
                chunk.len().try_into().expect("word length")
            ));
        }
        host.stage_finish().expect("UTF-8 stage");
    }
    fn fixture(supplements: Option<&str>) -> TextHost {
        let mut host = TextHost::default();
        let en =
            r#"{"fixture.accept":"Accept %s","fixture.article":"an","fixture.gap":"Missing %s"}"#;
        let ja = r#"{"fixture.accept":"%sを承諾","fixture.article":"","fixture.gap":null}"#;
        let entries = serde_json::json!({
            "fixture.accept":{"owner":"UI","tag":"_t","japanese_args_order":[],"special_tokens":[],"printf_contract":{"safe":true},"source_locations":[{"file":"game/modules/tome/mod/dialogs/UI.lua","line":10}]},
            "fixture.article":{"owner":"grammar","tag":"_t","japanese_args_order":[],"special_tokens":[],"printf_contract":{"safe":true},"source_locations":[]},
            "fixture.gap":{"owner":"UI","tag":"_t","japanese_args_order":[],"special_tokens":[],"printf_contract":{"safe":true},"source_locations":[]},
        });
        let registry = serde_json::json!({"schema_version":1,"entries":entries,"japanese_configuration":[],"routes":[
            {"source":"Accept %s","tag":"_t","default_id":"fixture.accept","aliases":["fixture.accept"],"format_ambiguity":false},
            {"source":"an","tag":"_t","default_id":"fixture.article","aliases":["fixture.article"],"format_ambiguity":false},
            {"source":"Missing %s","tag":"_t","default_id":"fixture.gap","aliases":["fixture.gap"],"format_ambiguity":false},
        ]});
        stage(&mut host, 1, en.as_bytes());
        stage(&mut host, 2, ja.as_bytes());
        stage(
            &mut host,
            3,
            &serde_json::to_vec(&registry).expect("registry"),
        );
        if let Some(supplements) = supplements {
            stage(&mut host, 4, supplements.as_bytes());
        }
        host
    }
    fn response(host: &TextHost, bytes: &[u8]) -> serde_json::Value {
        serde_json::from_slice(&host.request(bytes)).expect("finite response")
    }
    #[test]
    fn packed_mailbox_rejects_partial_overflow_and_invalid_stage_utf8() {
        let mut mailbox = Mailbox::default();
        assert!(mailbox.push_word(u32::from_le_bytes(*b"ABCD"), 4, 4));
        assert!(!mailbox.push_word(65, 1, 4));
        assert_eq!(mailbox.take(), Err("invalid_mailbox"));
        assert!(!mailbox.push_word(65, 5, 8));
        assert_eq!(mailbox.take(), Err("invalid_mailbox"));
        let mut host = TextHost::default();
        host.stage_reset(1).expect("stage");
        assert!(host.stage_word(0xff, 1));
        assert_eq!(host.stage_finish(), Err("invalid_utf8"));
        assert_eq!(host.initialize(), Err("missing_english"));
    }
    #[test]
    fn japanese_default_empty_template_and_english_locale_use_original_metadata() {
        let mut host = fixture(None);
        host.initialize().expect("valid fixture");
        let ja = response(&host,br#"{"op":"resolve","source":"Accept %s","tag":"_t","file":"@/mod/dialogs/UI.lua","line":10}"#);
        assert_eq!(ja["result"]["template"], "%sを承諾");
        assert_eq!(ja["result"]["id"], "fixture.accept");
        assert_eq!(
            response(&host, br#"{"op":"resolve_id","id":"fixture.article"}"#)["result"]["template"],
            ""
        );
        assert_eq!(
            response(
                &host,
                br#"{"op":"resolve_id","id":"fixture.accept","locale":"en_US"}"#
            )["result"]["template"],
            "Accept %s"
        );
        assert_eq!(
            response(&host, br#"{"op":"resolve_id","id":"fixture.gap"}"#)["result"]["missing_official_japanese"],
            true
        );
    }
    #[test]
    fn supplement_lookup_does_not_erase_missing_official_provenance() {
        let mut host = fixture(Some(r#"{"fixture.gap":"%sが不足"}"#));
        host.initialize().expect("reviewed supplement");
        let base = response(&host, br#"{"op":"resolve_id","id":"fixture.gap"}"#);
        assert_eq!(base["result"]["template"], "Missing %s");
        assert_eq!(base["result"]["missing_official_japanese"], true);
        assert_eq!(
            response(&host, br#"{"op":"supplement","id":"fixture.gap"}"#)["supplement"],
            "%sが不足"
        );
        assert_eq!(
            response(&host, br#"{"op":"supplement","id":"unknown"}"#)["supplement"],
            serde_json::Value::Null
        );
        let mut bad = fixture(Some(r#"{"fixture.gap":"%dが不足"}"#));
        assert_eq!(bad.initialize(), Err("supplement_token_contract"));
        let mut duplicate = fixture(Some(r#"{"fixture.gap":"%s","fixture.gap":"%s"}"#));
        assert_eq!(duplicate.initialize(), Err("invalid_supplements"));
    }
    #[test]
    fn immutable_requests_and_failed_reinitialization_preserve_catalogue() {
        let mut host = fixture(None);
        host.initialize().expect("fixture");
        let before = serde_json::to_vec(&host.status()).expect("status");
        for _ in 0..3 {
            assert_eq!(
                response(
                    &host,
                    br#"{"op":"resolve","source":"external username","tag":"_t"}"#
                )["reason"],
                "unknown_source_tag"
            );
            assert_eq!(
                response(
                    &host,
                    br#"{"op":"resolve_id","id":"fixture.accept","external":true}"#
                )["reason"],
                "invalid_request"
            );
        }
        assert_eq!(host.initialize(), Err("already_initialized"));
        assert_eq!(host.stage_reset(1), Err("already_initialized"));
        assert_eq!(serde_json::to_vec(&host.status()).expect("status"), before);
        assert!(host.staged.iter().all(Option::is_none));
    }
    #[test]
    fn reviewed_tokens_preserve_printf_escapes_precision_and_markup() {
        assert_eq!(
            printf_tokens("%% %-8.8s %0.2f"),
            vec!["%%", "%-8.8s", "%0.2f"]
        );
        assert_eq!(
            markup_tokens("#{italic}##LIGHT_BLUE#URL#LAST##{normal}#"),
            vec!["#{italic}#", "#LIGHT_BLUE#", "#LAST#", "#{normal}#"]
        );
        assert_ne!(printf_tokens("%-8.8s"), printf_tokens("%s"));
        assert!(printf_tokens_for("200% global speed, 100% speed, 50% of Vim", "_t").is_empty());
        assert_eq!(
            printf_tokens_for("200%s %% %s", "_t"),
            vec!["%s", "%%", "%s"]
        );
        assert_eq!(printf_tokens_for("50% of Vim", "tformat"), vec!["% o"]);
    }
    #[test]
    fn exact_reviewed_global_speed_and_vim_percentage_prose_initializes() {
        let rows: Vec<serde_json::Value> =
            serde_json::from_str(include_str!("../tests/percentage-prose-fixture.json"))
                .expect("exact source-reviewed tooltip fixtures");
        assert_eq!(rows.len(), 2);
        let mut english = serde_json::Map::new();
        let mut japanese = serde_json::Map::new();
        let mut supplements = serde_json::Map::new();
        let mut entries = serde_json::Map::new();
        let mut routes = vec![];
        for row in rows {
            let id = row["id"].as_str().expect("semantic ID");
            assert_eq!(row["tag"], "_t");
            english.insert(id.into(), row["source"].clone());
            japanese.insert(id.into(), serde_json::Value::Null);
            supplements.insert(id.into(), row["target"].clone());
            entries.insert(id.into(), serde_json::json!({"owner":id,"tag":"_t","japanese_args_order":[],"special_tokens":[],"printf_contract":{"safe":true},"source_locations":[]}));
            routes.push(serde_json::json!({"source":row["source"],"tag":"_t","default_id":id,"aliases":[id],"format_ambiguity":false}));
        }
        let registry = serde_json::json!({"schema_version":1,"japanese_configuration":[],"entries":entries,"routes":routes});
        let mut host = TextHost::default();
        for (kind, value) in [
            (1, serde_json::Value::Object(english)),
            (2, serde_json::Value::Object(japanese)),
            (3, registry),
            (4, serde_json::Value::Object(supplements)),
        ] {
            stage(&mut host, kind, &serde_json::to_vec(&value).expect("stage"));
        }
        host.initialize()
            .expect("literal percentage prose preserves the reviewed native _t contract");
        assert_eq!(host.status().supplements, 2);
        assert_eq!(printf_tokens_for("% g % s", "tformat"), vec!["% g", "% s"]);
        assert_eq!(
            printf_tokens_for("Count %s; ratio %0.2f%%", "_t"),
            vec!["%s", "%0.2f", "%%"]
        );
    }
    #[test]
    fn only_exact_two_reviewed_cjk_precision_policies_are_accepted() {
        let id = "game.modules.tome.mod.class.uiset.classicplayerdisplay.method.display.maketexturebar.tformat.parameter";
        let mut policy = FormatPolicy {
            semantic_id: id.into(),
            kind: "removeByteStringPrecision".into(),
            review_status: "reviewed".into(),
            source: "%-8.8s:".into(),
            tag: "tformat".into(),
            target: "%s：".into(),
            argument_index: 1,
            source_specifiers: vec!["%-8.8s".into()],
            target_specifiers: vec!["%s".into()],
            source_types: vec!["s".into()],
            target_types: vec!["s".into()],
            delegate_native_format_review: false,
            argument_order: "preserved".into(),
            native_special_and_effective_order_checks_required: true,
            removed_layout: RemovedLayout {
                left_justification: true,
                minimum_byte_width: 8,
                byte_precision: 8,
            },
            source_locations: vec![],
            review_basis: "Exact reviewed UTF-8 resource layout".into(),
        };
        assert!(policy_matches(id, &policy, "%-8.8s:", "%s："));
        assert!(!policy_matches("unreviewed.id", &policy, "%-8.8s:", "%s："));
        policy.argument_index = 2;
        assert!(!policy_matches(id, &policy, "%-8.8s:", "%s："));
    }
    #[test]
    fn contextual_dream_delta_is_separate_and_exact_route_first() {
        let mut host = fixture(None);
        let delta = serde_json::json!({"schema_version":1,"source_commit":SOURCE_COMMIT,
            "english":{DREAM_ID:"dream"},"japanese":{DREAM_ID:"夢"},
            "registry":{"schema_version":1,"japanese_configuration":[],"entries":{DREAM_ID:{"owner":"effect.death_dream.damage_label","tag":DREAM_TAG,"japanese_args_order":[],"special_tokens":[],"printf_contract":{"safe":true},"source_locations":[]}},
                "routes":[{"source":"dream","tag":DREAM_TAG,"default_id":DREAM_ID,"aliases":[DREAM_ID],"format_ambiguity":false}]},
            "provenance":{"translation":"official_nil_fallback_reuse"}});
        stage(&mut host, 6, &serde_json::to_vec(&delta).expect("delta"));
        host.initialize().expect("separate approved delta");
        let request = serde_json::to_vec(
            &serde_json::json!({"op":"resolve","source":"dream","tag":DREAM_TAG}),
        )
        .expect("request");
        let result = response(&host, &request);
        assert_eq!(result["result"]["id"], DREAM_ID);
        assert_eq!(result["result"]["template"], "夢");
        assert_eq!(result["result"]["missing_official_japanese"], false);
        assert_eq!(host.status().base_ids, 3);
        assert_eq!(host.status().extension_ids, 1);
        assert_eq!(
            response(
                &host,
                br#"{"op":"resolve","source":"dream","tag":"unrelated"}"#
            )["reason"],
            "unknown_source_tag"
        );
        let mut no_delta = fixture(None);
        no_delta.initialize().expect("base");
        assert_eq!(
            response(&no_delta, &request)["reason"],
            "contextual_extension_not_loaded"
        );
    }
}
