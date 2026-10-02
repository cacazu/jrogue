# jrouge

This repository currently contains the source code of Brogue: Community Edition 1.15.1 in `brogue/`.

- Upstream: https://github.com/tmewett/BrogueCE
- Source release: https://github.com/tmewett/BrogueCE/releases/tag/v1.15.1
- License: GNU Affero General Public License v3; see `brogue/LICENSE.txt`.
- Build instructions: see `brogue/BUILD.md`.

Original copyright and license notices are retained. The SDL port now supports
English/Japanese display switching while the game data, recordings, and diagnostic
output remain in English.

English text catalogs are available in [`brogue/locales/`](brogue/locales/README.md),
including game text, diagnostic text (kept in English), and non-translatable
internal strings. The display dictionary is compiled from all five Japanese category catalogs,
`display.json`, and `composed.json`. Source coverage and actual item/monster
descriptions across all three variants are audited without screen automation.
See the locale README for usage and verification.
