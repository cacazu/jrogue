//! Consumers of exact bytes from selected original C++ input-context members.
//! Scripted hardware/menu leaves remain separate from real browser/gameplay.
#![forbid(unsafe_code)]

#[cfg(test)]
mod tests {
    use std::{fs, path::PathBuf};

    use cdda_live_input_snapshot_consumer::{
        BindingOrigin, BuildIdentity, CommandAuthorization, ContextSnapshot, DenialReason, Modifier,
        PreferredKeyboardMode, RegisteredAction, TextPolicy, parse_snapshot,
    };

    const COUNTS: [usize; 15] = [1, 1, 1, 1, 2, 1, 3, 3, 1, 1, 1, 1, 1, 6, 0];

    fn identity() -> BuildIdentity {
        BuildIdentity::new(
            include_str!("../../continuation-interner/module-build-id.txt")
                .trim()
                .to_owned(),
        )
            .expect("accepted original snapshot object identity")
    }

    fn bytes(case: usize, wait: usize) -> Vec<u8> {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../continuation-interner/execution/wasm-results")
            .join(format!("case-{case:02}-wait-{wait:02}.json"));
        // Missing actual original-class outputs fail; no modeled JSON fallback.
        fs::read(path).expect("actual selected-original-class native record required")
    }

    fn snapshot(case: usize, wait: usize) -> ContextSnapshot {
        parse_snapshot(&bytes(case, wait), &identity())
            .expect("actual original record/schema compatibility")
    }

    fn action<'a>(value: &'a ContextSnapshot, id: &str) -> &'a RegisteredAction {
        value
            .actions()
            .iter()
            .find(|action| action.id() == id)
            .expect("actual original action ID")
    }

    #[test]
    fn all_actual_original_records_parse_owned_and_never_authorize_commands() {
        let mut count = 0;
        for (case, waits) in COUNTS.into_iter().enumerate() {
            for wait in 0..waits {
                let bytes = bytes(case + 1, wait);
                let value =
                    parse_snapshot(&bytes, &identity()).expect("actual original record accepted");
                drop(bytes);
                assert_eq!(value.identity(), &identity());
                assert_eq!(
                    value.command_authorization(),
                    CommandAuthorization::Denied(DenialReason::UntrackedNativeReaders)
                );
                assert_eq!(action(&value, "toggle_language_to_en").bindings().len(), 0);
                count += 1;
            }
        }
        assert_eq!(count, 24);
    }

    #[test]
    fn actual_original_lookup_preserves_local_empty_default_and_native_insertion_boundary() {
        let local = snapshot(1, 0);
        assert_eq!(action(&local, "OPEN").origin(), BindingOrigin::Context);
        assert_eq!(action(&local, "OPEN").bindings()[0].sequence(), &[113]);
        assert_eq!(action(&local, "PAUSE").origin(), BindingOrigin::Default);
        assert_eq!(
            action(&local, "LOCAL_EMPTY").origin(),
            BindingOrigin::Context
        );
        assert_eq!(action(&local, "LOCAL_EMPTY").bindings().len(), 0);
        assert_eq!(
            action(&local, "MISSING_NATIVE_ACTION").origin(),
            BindingOrigin::Missing
        );
        let before_help_lookup = snapshot(8, 0);
        let after_nested_help = snapshot(8, 2);
        assert_eq!(
            action(&before_help_lookup, "MISSING_NATIVE_ACTION").origin(),
            BindingOrigin::Missing
        );
        assert_eq!(
            action(&after_nested_help, "MISSING_NATIVE_ACTION").origin(),
            BindingOrigin::Default
        );
        assert_eq!(
            action(&after_nested_help, "MISSING_NATIVE_ACTION").bindings().len(),
            0
        );
    }

    #[test]
    fn actual_nested_parent_epoch_restores_current_bindings_and_help_timeout() {
        for case in [7, 8] {
            let root = snapshot(case, 0);
            let nested = snapshot(case, 1);
            let restored = snapshot(case, 2);
            assert_eq!(nested.category(), "KEYBINDINGS");
            assert_eq!(nested.depth(), 2);
            assert_eq!(nested.parent_context_epoch(), root.context_epoch());
            assert_eq!(restored.context_epoch(), root.context_epoch());
            assert_eq!(restored.depth(), 1);
            assert!(root.publication_sequence() < nested.publication_sequence());
            assert!(nested.publication_sequence() < restored.publication_sequence());
            assert_eq!(nested.effective_timeout_ms(), 7);
            assert_eq!(
            restored.effective_timeout_ms(),
            if case == 7 { 9 } else { -1 }
        );
            assert_eq!(action(&root, "OPEN").bindings()[0].sequence(), &[113]);
            assert_eq!(
            action(&restored, "OPEN").bindings()[0].sequence(),
            if case == 7 { &[114][..] } else { &[113][..] }
        );
        }
    }

    #[test]
    fn actual_string_input_policy_modifier_ids_and_context_flags_remain_native() {
        let raw = snapshot(9, 0);
        assert_eq!(raw.category(), "STRING_INPUT");
        assert_eq!(raw.text_policy(), TextPolicy::RawUtf8);
        assert_eq!(
            raw.preferred_keyboard_mode(),
            PreferredKeyboardMode::Keychar
        );
        assert_eq!(action(&raw, "TEXT.CONFIRM").bindings()[0].sequence(), &[13]);
        // This ABI describes bindings/context, not the last raw input event.
        // Actual raw username bytes were checked by original C++/Node separately.
        assert_eq!(action(&raw, "TEXT.CONFIRM").bindings()[0].text(), "");
        assert_eq!(
            action(&snapshot(10, 0), "OPEN").bindings()[0].modifiers(),
            &[Modifier::Ctrl, Modifier::Shift]
        );
        assert!(snapshot(11, 0).registered_any_input());
        assert!(snapshot(11, 0).coordinate_input_enabled());
        assert_eq!(snapshot(6, 0).effective_timeout_ms(), 0);
        assert_eq!(snapshot(12, 0).effective_timeout_ms(), 41);
        assert_eq!(snapshot(13, 0).effective_timeout_ms(), 9);
    }

    #[test]
    fn actual_repeated_observation_records_are_equal_and_owned() {
        let expected = snapshot(14, 0);
        for wait in 1..6 {
            assert_eq!(snapshot(14, wait), expected);
            assert_eq!(bytes(14, wait), bytes(14, 0));
        }
        let first_poll = snapshot(5, 0);
        let second_poll = snapshot(5, 1);
        assert_eq!(first_poll, second_poll);
    }
}
