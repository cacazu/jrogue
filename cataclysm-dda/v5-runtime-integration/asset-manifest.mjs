// Pinned parent-owned Combined Ready release. These are asset identities,
// not English gameplay text or translated IDs.
export const TILESET_ID = 'cdda16_combined_ready';
export const TILESET_DIRECTORY = '/gfx/CDDA16_Combined_Ready';
export const SOURCE_COMMIT = '7b2efa5cea38e4d4d97dd0e63b28b9148623da59';
export const ASSETS = Object.freeze([
  { name: 'core-functional.png', bytes: 641, sha256: 'c65e5adf329a55c47f59da7ad69072ea6b368285ec753c22c0b3a88c69864687', width: 128, height: 32 },
  { name: 'core-tiles.png', bytes: 85883, sha256: '4cd2e9dc1aaf1b0dcfa0bc66a30588eaa088afa6e6ed7119c593e17df80848aa', width: 128, height: 3472 },
  { name: 'overmap-functional.png', bytes: 437, sha256: 'c7e1bc677eed76dcaa9c5742a9b423329852289e13d79dc239b10af358f5e274', width: 128, height: 16 },
  { name: 'overmap-tiles.png', bytes: 12645, sha256: 'd818ef6b7f78838d2d14a90bcbe9bb91c1f25d6554c47aadcf1607de71e9b5eb', width: 128, height: 400 },
  { name: 'tile_config.json', bytes: 1101109, sha256: '63c876e97ed961c21dd964e8ef015dcdd0fd146d4442da757067ffc796a136c7' },
  { name: 'tileset.txt', bytes: 114, sha256: '2b1b58efa64c89a1f743fb8ebfc76b522af610cebef624a8da962219733b0091' }
].map(Object.freeze));
