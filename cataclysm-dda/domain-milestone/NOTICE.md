This Rust damage-rules milestone is an adaptation of Cataclysm: Dark Days Ahead,
by the Cataclysm: DDA contributors, derived from official upstream commit
`7b2efa5cea38e4d4d97dd0e63b28b9148623da59` (stable 0.I).

Upstream repository: https://github.com/CleverRaven/Cataclysm-DDA

Original source for this adaptation:
https://github.com/CleverRaven/Cataclysm-DDA/tree/7b2efa5cea38e4d4d97dd0e63b28b9148623da59

The migrated code and unchanged upstream excerpts are offered under Creative
Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0):
https://creativecommons.org/licenses/by-sa/3.0/

Changes: original C++ damage component, attack damage instance, and resistance
arithmetic translated into a dependency-free Rust rules library; explicit
registry injection, deterministic snapshot ordering, and typed merge diagnostics
replace factory lookup, unordered snapshot traversal, and debug logging.
Legacy arithmetic and equality quirks are preserved in named compatibility methods.
This completed translation is retained as supplementary verification research.
The user's confirmed production architecture preserves the original C++ gameplay
core; this library does not replace the active core.
No game assets, fonts, or sound packs are included in this bounded milestone.
The copied upstream LICENSE.txt retains its original notices; their presence
does not imply those assets are bundled here.

The retained differential WebAssembly fixture links the installed Emscripten
runtime and C/C++ standard libraries. Their unchanged license notices are in
`licenses/`: Emscripten (MIT / University of Illinois NCSA), musl (MIT plus
retained component notices), and libc++, libc++abi and compiler-rt (Apache 2.0
with LLVM exceptions and retained historical notices). The SDK dlmalloc
implementation is by Doug Lea and released to the public domain / CC0; the
Emscripten modifications remain covered by the Emscripten notices. These
licenses apply to their own runtime components, separately from the CDDA
source adaptation's CC BY-SA 3.0 terms.

See PROVENANCE.json for exact source files, line ranges, and hashes. Retain this
attribution, license identification/link, modification notice, and source access
when redistributing this adaptation; adaptations must remain under the same or
an allowed compatible license. No upstream endorsement is implied.
