# Final source provenance findings

Official stable tag: `tome-1.7.6`, commit `624a67329fe2ad440c5b344785a9c73fcf22ae63`.

Downloaded archive: 500,085,010 bytes; independently recomputed SHA256 `989dea00803f8cdcade024f4647d480bb1ac0d437c254292c07549c272a4680c` matches acquisition provenance. The original archive and extracted tree were read only. The Git index, shared root, and other games were not modified by this audit.

Every one of the 25,856 Git tracked blobs was compared or explicitly reported. With documented release ZIP namespace mappings, 4,019 blobs match exactly; two `init.lua` blobs differ only by appended `version_desc = '1.7.6'` release metadata. Exact differences and source/release copies are preserved in `results-mapped/diffs`. Among matches are 2,269 Lua files, 202 C files, 15 C++ files, and 256 C/C++ headers.

The 21,835 paths left unverified are 21,623 files in graphics trees, 49 in music trees, 162 development exclusions, and `game/addons/.keep`. The original graphics/music ZIPs remain acquired and preserved but were not opened for this comparison. Some graphics-tree entries are Lua particle/shader presentation source; the report does not pretend they have been verified. No unresolved Lua/code path remains outside graphics/music and development trees. This is not a claim that the entire release archive is byte-for-byte identical to the whole Git tree.

The archive contains nine files with no raw Git path: four addon ZIPs, the engine ZIP, the boot module ZIP, and the ToME source/graphics/music ZIPs. Their exact names and sizes appear in the audit's `archiveOnly` list. ZIP packaging and the `mod/` module namespace are recorded, not mislabeled as unavailable source.

The canonical evidence is `results-mapped/audit.json`; `results-mapped/findings.json` provides component/extension counts and exact exclusions. `results-elevated` preserves the physical archive comparison before any ZIP overlay; `results-unpacked` preserves the intermediate namespace-free comparison. `compare-upstream.mjs`, `summarize-audit.mjs`, and `diff-mismatches.mjs` reproduce those results with Node and Git without third-party dependencies. `README.md` documents invocation, primary official URLs, and license/publication conditions.

The four shipped addon metadata files all carry GPL version 3 or later notices, including the donor feature Items Vault and the DLC-gated Possessor Bonus Class. Their code must not be described as closed/proprietary merely because access is gated. Media remains under the ToME-specific grant. `addon-licenses.json` preserves actual notices and package hashes; Remote Designer includes MIT-style and BSD-style third-party notices. Separately sold and unacquired Ashes of Urh'Rok, Embers of Rage, and Forbidden Cults were not audited or included.
