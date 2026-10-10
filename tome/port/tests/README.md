# Verification scope

`browser.mjs` launches Chrome with a new temporary test profile and a loopback server. It tests original Lua/C scalar fixtures and the Rust adapter reference harness on PC/mobile viewports, actual keyboard/touch input, CJK layout at 200%, immutable locale rendering, IndexedDB save/reload, deterministic continuation and corruption rejection. It records exact artifact SHA256 values, browser version and screenshots in `output/`.

These checks do not boot a ToME campaign, test native ToME object-graph saves, or establish complete gameplay/text coverage. The original scalar checkHit fixture uses a controlled percentile stub; original SFMT is checked separately against untouched C through the reference RNG harness.

Rust tests additionally cover strict commands, JSON catalog/placeholder parity, external names, explicit version/source save rejection and RNG stream/state validation. The C/Rust SFMT fixture tests compare 48,600 outputs across six seeds and refill boundaries. Rust numerical rules are characterization fixtures; the user's original-language gameplay architecture remains unchanged.
