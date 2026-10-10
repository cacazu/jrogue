//! Pure platform policy for the retained C++ game's local native-v5 tileset.
//!
//! The host hashes exact file bytes with SHA-256, then submits eight big-endian
//! digest words. This module compares the result with the reviewed handoff; it
//! neither performs cryptography nor reads files. Exported calls use only scalar
//! values and do not allocate, accept pointers, mutate state, or access gameplay.

/// Current scalar ABI contract version.
pub const POLICY_VERSION: u32 = 1;

/// Identity of one immutable handoff file, in its required preload order.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AssetIdentity {
    pub name: &'static str,
    pub bytes: u32,
    /// SHA-256 in eight big-endian words, preserving digest byte order.
    pub digest_words: [u32; 8],
}

/// Files from `evidence/native-v5-handoff.json`, not generated engine output.
pub const ASSETS: [AssetIdentity; 6] = [
    AssetIdentity {
        name: "core-functional.png",
        bytes: 641,
        digest_words: [
            0xc65e5adf, 0x329a55c4, 0x7f59da7a, 0xd69072ea, 0x6b368285, 0xec753c22, 0xc0b3a88c,
            0x69864687,
        ],
    },
    AssetIdentity {
        name: "core-tiles.png",
        bytes: 85_883,
        digest_words: [
            0x4cd2e9dc, 0x1aaf1b0d, 0xcfa0bc66, 0xa30588ea, 0xa088afa6, 0xe6ed7119, 0xc593e17d,
            0xf80848aa,
        ],
    },
    AssetIdentity {
        name: "overmap-functional.png",
        bytes: 437,
        digest_words: [
            0xc7e1bc67, 0x7eed76dc, 0xaa9c5742, 0xa9b42332, 0x9852289e, 0x13d79dc2, 0x39b10af3,
            0x58f5e274,
        ],
    },
    AssetIdentity {
        name: "overmap-tiles.png",
        bytes: 12_645,
        digest_words: [
            0xd818ef6b, 0x7f78838d, 0x2d14a90b, 0xcbe9bb91, 0xc1f25d65, 0x54c47aad, 0xcf1607de,
            0x71e9b5eb,
        ],
    },
    AssetIdentity {
        name: "tile_config.json",
        bytes: 1_101_109,
        digest_words: [
            0x63c876e9, 0x7ed961c2, 0x1dd964e8, 0xef015dcd, 0xd0fd146d, 0x4442da75, 0x7067ffc7,
            0x96a136c7,
        ],
    },
    AssetIdentity {
        name: "tileset.txt",
        bytes: 114,
        digest_words: [
            0x2b1b58ef, 0xa64c89a1, 0xf743fb8e, 0xbfc76b52, 0x2af610ce, 0xbef624a8, 0xda962219,
            0x733b0091,
        ],
    },
];

/// Rejection precedence is index, byte length, then digest identity.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum AssetRejection {
    Index = 1,
    Length = 2,
    Digest = 3,
}

/// Validate host-computed metadata against the pinned file identity.
pub fn validate_asset(
    index: u32,
    bytes: u32,
    digest_words: [u32; 8],
) -> Result<(), AssetRejection> {
    let index = usize::try_from(index).map_err(|_| AssetRejection::Index)?;
    let expected = ASSETS.get(index).ok_or(AssetRejection::Index)?;
    if bytes != expected.bytes {
        return Err(AssetRejection::Length);
    }
    if digest_words != expected.digest_words {
        return Err(AssetRejection::Digest);
    }
    Ok(())
}

/// The host must determine profile presence after original C++ IDBFS restore.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProfilePresence {
    Existing,
    New,
}

/// The ABI describes only native string options; boolean defaults stay in C++.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum NewProfileOptionKind {
    Language = 1,
    Tiles = 2,
    OvermapTiles = 3,
}

/// An instruction for a new profile, never an existing-profile migration.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NewProfileOption {
    pub kind: NewProfileOptionKind,
    pub name: &'static str,
    pub value: &'static str,
}

pub const NEW_PROFILE_OPTIONS: [NewProfileOption; 3] = [
    NewProfileOption {
        kind: NewProfileOptionKind::Language,
        name: "USE_LANG",
        value: "ja",
    },
    NewProfileOption {
        kind: NewProfileOptionKind::Tiles,
        name: "TILES",
        value: "cdda16_combined_ready",
    },
    NewProfileOption {
        kind: NewProfileOptionKind::OvermapTiles,
        name: "OVERMAP_TILES",
        value: "cdda16_combined_ready",
    },
];

/// Returns no instructions when original restored options already exist.
pub fn profile_options(profile: ProfilePresence) -> &'static [NewProfileOption] {
    match profile {
        ProfilePresence::Existing => &[],
        ProfilePresence::New => &NEW_PROFILE_OPTIONS,
    }
}

/// Pure scalar version probe.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_v5_policy_version() -> u32 {
    POLICY_VERSION
}

/// Required asset count in the reviewed handoff order.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_v5_asset_count() -> u32 {
    6
}

/// Returns 0 accepted, 1 bad index, 2 bad length, or 3 bad digest.
///
/// The ten scalar arguments are deliberate: the ABI accepts no host pointers.
#[allow(clippy::too_many_arguments)]
#[unsafe(no_mangle)]
pub extern "C" fn cdda_v5_validate_asset(
    index: u32,
    bytes: u32,
    digest_word_0: u32,
    digest_word_1: u32,
    digest_word_2: u32,
    digest_word_3: u32,
    digest_word_4: u32,
    digest_word_5: u32,
    digest_word_6: u32,
    digest_word_7: u32,
) -> u32 {
    match validate_asset(
        index,
        bytes,
        [
            digest_word_0,
            digest_word_1,
            digest_word_2,
            digest_word_3,
            digest_word_4,
            digest_word_5,
            digest_word_6,
            digest_word_7,
        ],
    ) {
        Ok(()) => 0,
        Err(rejection) => rejection as u32,
    }
}

/// Number of native string instructions for a new profile only.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_v5_new_profile_option_count() -> u32 {
    3
}

/// Returns language=1, tiles=2, overmap tiles=3; an invalid index returns 0.
#[unsafe(no_mangle)]
pub extern "C" fn cdda_v5_new_profile_option_kind(index: u32) -> u32 {
    match usize::try_from(index)
        .ok()
        .and_then(|index| NEW_PROFILE_OPTIONS.get(index))
    {
        Some(option) => option.kind as u32,
        None => 0,
    }
}

#[cfg(test)]
mod tests;
