use super::*;

// Independent hexadecimal fixtures transcribed from the reviewed parent handoff.
const HANDOFF: [(&str, u32, &str); 6] = [
    (
        "core-functional.png",
        641,
        "c65e5adf329a55c47f59da7ad69072ea6b368285ec753c22c0b3a88c69864687",
    ),
    (
        "core-tiles.png",
        85_883,
        "4cd2e9dc1aaf1b0dcfa0bc66a30588eaa088afa6e6ed7119c593e17df80848aa",
    ),
    (
        "overmap-functional.png",
        437,
        "c7e1bc677eed76dcaa9c5742a9b423329852289e13d79dc239b10af358f5e274",
    ),
    (
        "overmap-tiles.png",
        12_645,
        "d818ef6b7f78838d2d14a90bcbe9bb91c1f25d6554c47aadcf1607de71e9b5eb",
    ),
    (
        "tile_config.json",
        1_101_109,
        "63c876e97ed961c21dd964e8ef015dcdd0fd146d4442da757067ffc796a136c7",
    ),
    (
        "tileset.txt",
        114,
        "2b1b58efa64c89a1f743fb8ebfc76b522af610cebef624a8da962219733b0091",
    ),
];

fn words(hex: &str) -> [u32; 8] {
    std::array::from_fn(|index| {
        u32::from_str_radix(&hex[index * 8..index * 8 + 8], 16).unwrap()
    })
}

fn scalar_validation(index: u32, bytes: u32, words: [u32; 8]) -> u32 {
    cdda_v5_validate_asset(
        index, bytes, words[0], words[1], words[2], words[3], words[4], words[5], words[6], words[7],
    )
}

#[test]
fn all_six_handoff_metadata_records_are_accepted_in_required_order() {
    assert_eq!(cdda_v5_policy_version(), 1);
    assert_eq!(cdda_v5_asset_count(), 6);
    for (index, (name, bytes, hex)) in HANDOFF.iter().enumerate() {
        let index_u32 = u32::try_from(index).unwrap();
        assert_eq!(ASSETS[index].name, *name);
        assert_eq!(ASSETS[index].bytes, *bytes);
        assert_eq!(ASSETS[index].digest_words, words(hex));
        assert_eq!(validate_asset(index_u32, *bytes, words(hex)), Ok(()));
        assert_eq!(scalar_validation(index_u32, *bytes, words(hex)), 0);
    }
}

#[test]
fn every_digest_word_bit_and_wrong_word_order_are_rejected() {
    for (index, (_, bytes, hex)) in HANDOFF.iter().enumerate() {
        let index = u32::try_from(index).unwrap();
        let correct = words(hex);
        for word in 0..8 {
            for bit in 0..32 {
                let mut changed = correct;
                changed[word] ^= 1 << bit;
                assert_eq!(
                    validate_asset(index, *bytes, changed),
                    Err(AssetRejection::Digest)
                );
                assert_eq!(scalar_validation(index, *bytes, changed), 3);
            }
        }
        let mut wrong_order = correct;
        wrong_order.reverse();
        assert_eq!(scalar_validation(index, *bytes, wrong_order), 3);
        let wrong_endian = correct.map(u32::swap_bytes);
        assert_eq!(scalar_validation(index, *bytes, wrong_endian), 3);
    }
}

#[test]
fn invalid_lengths_indices_and_rejection_precedence_are_stable() {
    for (index, (_, bytes, hex)) in HANDOFF.iter().enumerate() {
        let index = u32::try_from(index).unwrap();
        for wrong_length in [0, bytes - 1, bytes + 1, u32::MAX] {
            assert_eq!(
                validate_asset(index, wrong_length, words(hex)),
                Err(AssetRejection::Length)
            );
            assert_eq!(scalar_validation(index, wrong_length, words(hex)), 2);
            assert_eq!(scalar_validation(index, wrong_length, [0; 8]), 2);
        }
    }
    for invalid_index in [6, 7, u32::MAX] {
        assert_eq!(
            validate_asset(invalid_index, 0, [0; 8]),
            Err(AssetRejection::Index)
        );
        assert_eq!(scalar_validation(invalid_index, 0, [0; 8]), 1);
    }
    // A valid file must not be accepted at another required position.
    for (index, (_, bytes, hex)) in HANDOFF.iter().enumerate() {
        for other_index in 0..6 {
            if usize::try_from(other_index).unwrap() != index {
                assert_ne!(scalar_validation(other_index, *bytes, words(hex)), 0);
            }
        }
    }
}

#[test]
fn new_profile_policy_has_only_the_three_native_string_options() {
    assert_eq!(cdda_v5_new_profile_option_count(), 3);
    let options = profile_options(ProfilePresence::New);
    assert_eq!(options.len(), 3);
    let expected = [
        (NewProfileOptionKind::Language, "USE_LANG", "ja"),
        (NewProfileOptionKind::Tiles, "TILES", "cdda16_combined_ready"),
        (
            NewProfileOptionKind::OvermapTiles,
            "OVERMAP_TILES",
            "cdda16_combined_ready",
        ),
    ];
    for (index, (kind, name, value)) in expected.iter().enumerate() {
        assert_eq!(
            options[index],
            NewProfileOption {
                kind: *kind,
                name,
                value,
            }
        );
        assert_eq!(
            cdda_v5_new_profile_option_kind(u32::try_from(index).unwrap()),
            *kind as u32
        );
    }
    for invalid_index in [3, 4, u32::MAX] {
        assert_eq!(cdda_v5_new_profile_option_kind(invalid_index), 0);
    }
    assert!(
        options
            .iter()
            .all(|option| !matches!(option.value, "true" | "false"))
    );
}

#[test]
fn restored_profile_has_no_write_instructions_and_repeated_calls_are_pure() {
    // The policy receives presence only: arbitrary restored bytes never enter it.
    let existing_options =
        b"\0USER=QA_Kit_\xe6\x97\xa5\xe6\x9c\xac\r\nTILES=Ultica\r\nUSE_LANG=en\r\n";
    let preserved = *existing_options;
    let assets_before = ASSETS;
    let defaults_before = NEW_PROFILE_OPTIONS;
    for _ in 0..128 {
        assert!(profile_options(ProfilePresence::Existing).is_empty());
        assert_eq!(profile_options(ProfilePresence::New), &defaults_before);
        assert_eq!(*existing_options, preserved);
        for (index, asset) in assets_before.iter().enumerate() {
            assert_eq!(
                scalar_validation(u32::try_from(index).unwrap(), asset.bytes, asset.digest_words),
                0
            );
        }
    }
    assert_eq!(ASSETS, assets_before);
    assert_eq!(NEW_PROFILE_OPTIONS, defaults_before);
}
