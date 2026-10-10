//! Explicit initialization of immutable catalogs; no repaint-time cache writes.
use std::collections::BTreeMap;
use std::sync::Arc;

use crate::presentation::{Catalog, FormatError, MAX_CATALOG_BYTES};

pub const MAX_REGISTERED_CATALOGS: usize = 8;
/// Bound on accepted source bytes, not a claim about allocator/heap size.
pub const MAX_REGISTERED_SOURCE_BYTES: usize = 32 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegistryError {
    Format(FormatError),
    Capacity,
    InvalidHandle,
    HandleExhausted,
}

struct RegisteredCatalog {
    catalog: Arc<Catalog>,
    source_bytes: usize,
}

pub struct CatalogRegistry {
    entries: BTreeMap<u32, RegisteredCatalog>,
    next_handle: u32,
    source_bytes: usize,
}

impl Default for CatalogRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl CatalogRegistry {
    pub const fn new() -> Self {
        Self {
            entries: BTreeMap::new(),
            next_handle: 1,
            source_bytes: 0,
        }
    }

    /// Parse and validate once at an explicit initialization/replacement boundary.
    pub fn register(&mut self, json: &[u8]) -> Result<u32, RegistryError> {
        if json.len() > MAX_CATALOG_BYTES {
            return Err(RegistryError::Format(FormatError::TooLarge));
        }
        if self.entries.len() >= MAX_REGISTERED_CATALOGS
            || json.len() > MAX_REGISTERED_SOURCE_BYTES.saturating_sub(self.source_bytes)
        {
            return Err(RegistryError::Capacity);
        }
        if self.next_handle > i32::MAX as u32 {
            return Err(RegistryError::HandleExhausted);
        }
        let catalog = Catalog::from_json(json).map_err(RegistryError::Format)?;
        let handle = self.next_handle;
        // Handles never repeat within this instance, including after release.
        self.next_handle += 1;
        self.entries.insert(
            handle,
            RegisteredCatalog {
                catalog: Arc::new(catalog),
                source_bytes: json.len(),
            },
        );
        self.source_bytes += json.len();
        Ok(handle)
    }

    /// Borrow immutable ownership; render never inserts, reparses, or changes entries.
    pub fn snapshot(&self, handle: u32) -> Result<Arc<Catalog>, RegistryError> {
        self.entries
            .get(&handle)
            .map(|entry| Arc::clone(&entry.catalog))
            .ok_or(RegistryError::InvalidHandle)
    }

    /// Explicit teardown. An already acquired immutable snapshot can finish safely.
    pub fn release(&mut self, handle: u32) -> Result<(), RegistryError> {
        let entry = self
            .entries
            .remove(&handle)
            .ok_or(RegistryError::InvalidHandle)?;
        self.source_bytes -= entry.source_bytes;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{GameplayEvent, TextEvent};
    use crate::presentation::Locale;

    const CATALOG: &[u8] = r#"{"en":{"test.message":"{value:%ld}","test.raw":"{raw}"},"ja":{"test.message":"値{value:%ld}"}}"#.as_bytes();

    #[test]
    fn malformed_catalog_does_not_consume_handle_or_registry_capacity() {
        let mut registry = CatalogRegistry::new();
        assert!(registry.register(b"{}").is_err());
        assert!(registry.entries.is_empty());
        assert_eq!(registry.next_handle, 1);
        assert_eq!(registry.source_bytes, 0);
        assert_eq!(registry.register(CATALOG), Ok(1));
    }

    #[test]
    fn released_handles_never_alias_and_snapshots_own_their_lifetime() {
        let mut registry = CatalogRegistry::new();
        let handle = registry.register(CATALOG).expect("register");
        let held = registry.snapshot(handle).expect("snapshot");
        registry.release(handle).expect("release");
        assert!(matches!(
            registry.snapshot(handle),
            Err(RegistryError::InvalidHandle)
        ));
        assert_eq!(registry.release(handle), Err(RegistryError::InvalidHandle));
        assert_eq!(registry.register(CATALOG), Ok(2));
        let event: TextEvent = serde_json::from_str(
            r#"{"id":"test.message","args":{"value":{"type":"integer","value":31}}}"#,
        )
        .expect("event");
        assert_eq!(
            held.render(&event, Locale::Ja)
                .expect("owned after release")
                .text,
            "値31"
        );
    }

    #[test]
    fn initialization_owns_source_and_no_render_changes_registry() {
        let mut registry = CatalogRegistry::new();
        let mut json = CATALOG.to_vec();
        let handle = registry.register(&json).expect("register");
        json.fill(0);
        let catalog = registry.snapshot(handle).expect("snapshot");
        let event: TextEvent = serde_json::from_str(
            r#"{"id":"test.message","args":{"value":{"type":"integer","value":-17}}}"#,
        )
        .expect("event");
        let before = (
            registry.entries.len(),
            registry.next_handle,
            registry.source_bytes,
        );
        for _ in 0..100 {
            assert_eq!(
                catalog.render(&event, Locale::Ja).expect("render").text,
                "値-17"
            );
        }
        assert_eq!(
            before,
            (
                registry.entries.len(),
                registry.next_handle,
                registry.source_bytes
            )
        );
    }

    #[test]
    fn immutable_and_stateless_paths_are_equivalent_in_both_locales_and_fallback() {
        let mut registry = CatalogRegistry::new();
        let handle = registry.register(CATALOG).expect("register");
        let registered = registry.snapshot(handle).expect("snapshot");
        for json in [
            r#"{"id":"test.message","args":{"value":{"type":"integer","value":9223372036854775807}}}"#,
            r#"{"id":"test.raw","args":{"raw":{"type":"text","value":"100% {value:%s} 猫"}}}"#,
        ] {
            let event: TextEvent = serde_json::from_str(json).expect("event");
            for locale in [Locale::Ja, Locale::En] {
                let expected = Catalog::from_json(CATALOG)
                    .expect("stateless parse")
                    .render(&event, locale)
                    .expect("stateless render");
                let actual = registered
                    .render(&event, locale)
                    .expect("registered render");
                assert_eq!(
                    (actual.text, actual.locale, actual.used_fallback),
                    (expected.text, expected.locale, expected.used_fallback)
                );
            }
        }
        let envelope: GameplayEvent = serde_json::from_str(r#"{"event":{"id":"test.message","args":{"value":{"type":"integer","value":31}}},"context":{"api":"panic","helperVariant":"plain"}}"#).expect("envelope");
        for locale in [Locale::Ja, Locale::En] {
            let expected = Catalog::from_json(CATALOG)
                .expect("stateless parse")
                .render_gameplay(&envelope, locale)
                .expect("stateless render");
            let actual = registered
                .render_gameplay(&envelope, locale)
                .expect("registered render");
            assert_eq!(
                (actual.text, actual.locale, actual.used_fallback),
                (expected.text, expected.locale, expected.used_fallback)
            );
        }
    }

    #[test]
    fn stale_zero_and_exhausted_handles_fail_closed() {
        let mut registry = CatalogRegistry::new();
        assert!(matches!(
            registry.snapshot(0),
            Err(RegistryError::InvalidHandle)
        ));
        assert_eq!(registry.release(0), Err(RegistryError::InvalidHandle));
        registry.next_handle = i32::MAX as u32;
        assert_eq!(registry.register(CATALOG), Ok(i32::MAX as u32));
        registry.release(i32::MAX as u32).expect("release max");
        assert_eq!(
            registry.register(CATALOG),
            Err(RegistryError::HandleExhausted)
        );
    }

    #[test]
    fn catalog_count_and_source_byte_budgets_are_explicit() {
        let mut registry = CatalogRegistry::new();
        for _ in 0..MAX_REGISTERED_CATALOGS {
            registry.register(CATALOG).expect("within capacity");
        }
        assert_eq!(registry.register(CATALOG), Err(RegistryError::Capacity));
        registry.release(1).expect("free one");
        assert!(registry.register(CATALOG).is_ok());
        let mut bytes = CatalogRegistry::new();
        bytes.source_bytes = MAX_REGISTERED_SOURCE_BYTES;
        assert_eq!(bytes.register(CATALOG), Err(RegistryError::Capacity));
        assert_eq!(
            bytes.register(&vec![0; MAX_CATALOG_BYTES + 1]),
            Err(RegistryError::Format(FormatError::TooLarge))
        );
    }
}
