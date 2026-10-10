//! Pending consumers of bytes produced by the actual C++ snapshot module.
//! Native callbacks are synthetic and command ownership remains denied.

#[cfg(test)]
mod tests {
    use std::{fs, path::PathBuf};

    use cdda_live_input_snapshot_consumer::{
        BindingOrigin, BuildIdentity, CommandAuthorization, ContextSnapshot, DenialReason,
        PreferredKeyboardMode, TextPolicy, parse_snapshot,
    };

    fn identity() -> BuildIdentity {
        BuildIdentity::new(include_str!("../../module-build-id.txt").trim().to_owned())
            .expect("pinned compilecheck identity")
    }

    fn bytes(name: &str) -> Vec<u8> {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../execution/wasm-results")
            .join(format!("{name}.json"));
        // Fail if genuine native fixtures were not produced; no model JSON fallback.
        fs::read(path).expect("actual WASM native fixture output required")
    }

    fn snapshot(name: &str) -> ContextSnapshot {
        parse_snapshot(&bytes(name), &identity()).expect("actual module/schema compatibility")
    }

    #[test]
    fn actual_module_json_is_accepted_at_all_prepared_boundaries() {
        for name in ["root", "nested", "restored", "string-input", "boundary-14",
                     "boundary-15", "boundary-16", "boundary-17", "boundary-18"] {
            let value = snapshot(name);
            assert_eq!(value.identity(), &identity());
            assert_eq!(value.command_authorization(),
                       CommandAuthorization::Denied(DenialReason::UntrackedNativeReaders));
        }
        assert_eq!(snapshot("boundary-14").category().len(), 16384);
        assert_eq!(snapshot("boundary-15").actions().len(), 2048);
        assert_eq!(snapshot("boundary-16").actions()[0].bindings().len(), 128);
        assert_eq!(snapshot("boundary-17").actions()[0].bindings()[0].sequence().len(), 64);
    }

    #[test]
    fn native_controls_cjk_and_raw_username_match_frozen_rust_rules() {
        let value = snapshot("root");
        assert_eq!(value.actions()[0].bindings()[0].text(), "山田 <player>\\\"\n\t\0");
        assert_eq!(value.actions()[0].bindings()[0].edit(), "編集中");
        assert_eq!(value.actions()[1].origin(), BindingOrigin::Missing);
        assert_eq!(value.actions()[2].origin(), BindingOrigin::Default);
        assert_eq!(snapshot("boundary-18").category(), "quote\" slash\\ nul\0 end");
        let raw = snapshot("string-input");
        assert_eq!(raw.text_policy(), TextPolicy::RawUtf8);
        assert_eq!(raw.preferred_keyboard_mode(), PreferredKeyboardMode::Keychar);
        assert_eq!(raw.actions()[0].bindings()[0].text(), value.actions()[0].bindings()[0].text());
    }

    #[test]
    fn actual_restoration_and_owned_old_records_remain_distinct() {
        let root = snapshot("root");
        let nested = snapshot("nested");
        let restored = snapshot("restored");
        assert_eq!(root.category(), "FIXTURE_ROOT");
        assert_eq!(nested.parent_context_epoch(), root.context_epoch());
        assert_eq!(restored.context_epoch(), root.context_epoch());
        assert_eq!(restored.category(), "FIXTURE_ROOT_CHANGED");
        assert_eq!(restored.actions()[0].bindings()[0].sequence(), &[122]);
        assert!(root.publication_sequence() < nested.publication_sequence());
        assert!(nested.publication_sequence() < restored.publication_sequence());
        assert_eq!(root.actions()[0].bindings()[0].sequence(), &[97, 13]);
    }

    #[test]
    fn frozen_consumer_rejects_invalid_utf8_size_and_identity() {
        let data = bytes("root");
        let wrong = BuildIdentity::new("different-fixture-build".to_owned()).unwrap();
        assert!(parse_snapshot(&data, &wrong).is_err());
        assert!(parse_snapshot(&[0xc0, 0xaf], &identity()).is_err());
        assert!(parse_snapshot(&vec![b' '; 262145], &identity()).is_err());
    }
}
