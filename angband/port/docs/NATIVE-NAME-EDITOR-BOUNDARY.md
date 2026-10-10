# Original character-name input bound

The original Angband 4.2.6 name editor accepts **24 UTF8 input bytes** at its normal birth and `C` then `c` rename prompt. Its underlying player-name array has32 bytes, but the original editor also clamps its buffer against column80.

This was checked independently against the pristine source at upstream commit `f3082213b73f3e463e3d0d60bff4b00462beae6e` in `C:\Users\kit\gameme\jnethack\jrouge\angband\upstream\angband-4.2.6\src` and the current annotated source. Both retain the same prompt and restriction.

| Original source operation | Result |
| --- | --- |
| `option.h`: `PLAYER_NAME_LEN` is32 | Birth uses `char name[PLAYER_NAME_LEN]`; rename uses `char namebuf[32]`. |
| `ui-input.c get_character_name()`: prints `Enter a name for your character (* for a random name): ` | The ASCII prompt has55 cells/bytes and leaves the native terminal cursor at x55. |
| `get_character_name()` calls `askfor_aux_ext(buf, buflen, get_name_keypress, handle_name_mouse)` | The original supplied buffer length is32. |
| `askfor_aux_ext()`: `if (x + len > 80) len = 80 - x;` | At x55, effective length becomes25. This remains a hard80-column restriction even in a100-column browser terminal. |
| Editor reserves the trailingNUL and receives effective length25 | At most24 UTF8 bytes fit. The browser text editor receives this same effective capacity. |

The earlier fixture `Presentation 日本語 QA` was25 UTF8 bytes (19 Unicode scalars). The captured native value `Presentation 日本語 Q` was24 bytes. Loss of the finalASCII `A` is exactly the original bound; the later character sheet's13-cell overlapping-panel display cannot explain or repair input clipping.

The replacement fixture `Presentation "日本語"` is exactly24 UTF8 bytes. Its quotes and Japanese text must remain opaque through original birth, original rename, source capture, EN/JA presentation, save/resume, and UTF8 export. Its first13 native cells remain `Presentation `, so the test still distinguishes the full source-owned name from the original clipped sheet display.

[browser-presentation-remaining.mjs](../tests/browser-presentation-remaining.mjs) asserts the complete24-byte name and explicitly reads `presentation.input_max_bytes === 24` at the actual `C`/`c` editor wait, with native cursor `[55,0]`. A published31-byte limit at this wait would be incorrect presentation metadata even though the native editor itself correctly enforces24. No original C processing or clamp should change to accommodate the fixture.

This document records source provenance and the test contract. Browser acceptance requires the parent's measured run; it does not assert an unexecuted pass.
