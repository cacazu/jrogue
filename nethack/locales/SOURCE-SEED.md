# Source-message Japanese translation seed

`source-seed.en.json` and `source-seed.ja.json` contain matching exact inventory candidate IDs and real Japanese translations. `source-seed.metadata.json` preserves the source call locations/APIs, English templates, original argument expressions, and printf-derived type contract. `translation-status.json` records exact validated counts and artifact/source hashes. These files are a translation seed; they are not connected to the running C engine.

The source catalogs remain unchanged. `build-source-seed.py` resolves authored rows against exact source file/line/API/literal evidence during offline preparation. It never runs in the browser and supplies no rendered-English reverse lookup. Integrate only by emitting the source ID and typed arguments at the original C output site before formatting.

Calls such as `You`, `You_cant`, `You_hear`, `You_feel`, `Your` and `pline_The` have implicit English helper context. The EN seed preserves the exact literal argument; its helper prefix is recorded separately. Japanese seeds express the intended complete meaning and usually omit the subject. Runtime presentation must treat the helper context as part of the semantic message, rather than append an English prefix to Japanese text.

Printf placeholders retain their exact ordered conversion/width/length signatures. The associated types are inferred from C printf, not a claim that visible entity descriptors have already been implemented. Object/monster/action/body-part/color arguments need source-grounded locale-aware descriptors; arbitrary user names stay literal UTF-8 data. Do not translate hidden identities, rerun hallucination RNG, or count an English-generated argument as complete Japanese coverage.

The seed prioritizes gameplay-facing movement, eating, command menus, dropping/stairs, initial role choices, startup and death/disclosure messages. No measured runtime frequency distribution is claimed. Structural blank rows, unresolved formats, many diagnostics, and incomplete multi-line fragments were left for later review. Source occurrence totals and unique candidate IDs are reported separately; neither is a total of unique player-facing messages.

Regenerate and validate from `nethack` with the bundled standard-library Python script:

```text
python locales/build-source-seed.py
```

Runtime integration remains false, runtime localized-message count is zero, and full Japanese coverage remains false until source instrumentation and actual gameplay validation establish them.
