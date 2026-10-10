# Angband browser host

This host runs the original Angband 4.2.6 engine in a dedicated worker. Japanese is the default language. The original ASCII terminal still contains English; Rust renders source-selected Japanese messages, panels and export rows separately. The catalog and source hooks do not establish complete translation.

The eight added presentation families are source-connected. Representative matching final-engine browser checks now cover their selected native paths, exact pending-input restore and complete Japanese character download. Final package/dist acceptance remains conditional on `../verification.json` and `../build/package-manifest.json`; these paths do not establish complete branch coverage. Current source endpoints and remaining branches are in [coverage-audit.json](../migration/coverage-audit.json); [verification.json](../verification.json) identifies the last accepted artifact.

## Run

After the engine build generates `../build/game.js`, `game.wasm` and `game.data`, run `node web/server.mjs` from the port root and open `http://127.0.0.1:4173/web/`. To select another loopback port, pass `--port=4193`. The server supplies the WASM MIME type and rejects hidden files, directory traversal, unsupported executable types and symlinks outside the served directory. `npm test` in `web` runs isolated host checks.

## Input and presentation

The worker imports `../build/game.js` and starts the original engine through async `ab_run`. It copies native state, source-selected semantic events and terminal cells into Rust-owned presentation. The browser draws cached results; repaint, font/viewport changes and locale changes do not request native simulation or another RNG draw.

Keyboard/modifier and mouse events follow the original `ui-event.h` policies. Bound context-menu selection forwards the selected native coordinates and mouse policy. Native command eligibility and hidden information stay authoritative. A separate text form handles Unicode/IME text and preserves opaque names, notes and unsent drafts. Touch controls submit the same original engine input. In the standard keyset, the touch wait button sends `,` (`CMD_HOLD`); `.` starts running.

Pure cached rendering is distinct from original native drawing. Hallucination/perception and multihued animation retain their original shared RNG calls and order relative to monster/world processing. Native continuation must replay exactly; it is not made pure by removing or substituting those original calls.

## Versioned persistence

The browser stores an opaque Rust envelope in IndexedDB with version, upstream/build identity, length and checksum. V3 owns the complete bootstrap, ordered returned native/platform/input events, pending input queue, text-group metadata and opaque draft. At supported pending requests, saving serializes this owned replay state without invoking the native writer, redrawing or consuming RNG.

Resume validates the envelope and exact engine/data/input/presentation identity before starting. The worker restores the validated bootstrap environment, rebuilds the original process by replay, suppresses outward frames/input/save activity during catch-up, then exposes the copied state/frame/source presentation and draft at the verified target. V3 does not serialize a suspended C stack or treat its journal as a native savefile.

Legacy v1/v2 decoding and original native bootstrap loads have separate bounded paths. Optional native `web-msg-recall` and `web-gamehist` blocks preserve source provenance with original queue/ledger load semantics; absent blocks remain explicit legacy text and malformed sidecars reject atomically. They do not replace browser v3 replay. See [CHECKPOINT.md](../docs/CHECKPOINT.md) for the distinction from historical native block comparisons.

Envelope, environment, pending queue and draft limits are version-specific and checked in `protocol.js` and Rust. Persistence operations are serialized; a failed load/import does not replace the previous stored save. Export/import carries the versioned envelope unchanged, and incompatible identity or corrupted bytes are rejected. Character creation and unsupported waits retain explicit save restrictions; supported nested prompts are reconstructed by v3.

## Browser verification

`window.__angbandTest` exposes copied state/frame, source presentation and diagnostics for integration evidence. Real keyboard, mouse, text/IME and touch controls must also be tested. Compare every native fact and all 38 RNG words across cached repaint/font/viewport/locale changes, and compare uninterrupted versus saved/restored continuation at supported pending waits. Mobile acceptance also checks page overflow and scrolling within the terminal viewport.

The measured parent gate includes `browser-smoke.mjs --final --review`, `browser-gameflows.mjs`, `browser-victory.mjs`, `wasm-descriptor-probe.mjs`, `browser-normal-play.mjs`, `browser-presentation-remaining.mjs` and `browser-native-perception.mjs`, plus the packaged browser run and isolated C fixtures. Their accepted result paths and exact engine matching are collected by `tools/verification-report.mjs` after package acceptance. A failed, pending or different-engine run cannot update accepted verification.

Normal-play evidence uses ordinary original commands. Wizard endgame and native-perception fixtures are explicitly unranked and do not establish a normal complete100-level campaign. Unit checks, helper fixtures and representative browser paths also do not establish all native branches or complete Japanese coverage. The current scope is local HTML served with Node; no external publication is performed.
