> Superseded source proposal: the shared browser default editor and bounded
> initialization now use pure Rust `application_text`. See
> `../text-input/README.md`; help delegates every key once to that shared seam.
> The bug reproduction below remains source evidence.

# Shared browser input DELETE correction proposal

The help-local browser fix is implemented in `web-help-text.c`; the shared
`ui-input.c` has deliberately not been edited by the help agent. Parent should
apply the following narrow shared browser correction after coordinating its
source/build freeze. This affects name and other string editors using the
default handler as well as help when no custom handler is present.

Accepted original source is `tests/accepted-source-snapshot/ui-input.c:733`,
inside `askfor_aux_keypress()` / `KC_DELETE`:

```c
oshift = utf8_fskip(buf + *curs, 1, NULL);
```

`*curs` is a Unicode scalar index. Just above this branch, original code already
computes `ocurs = utf8_fskip(buf, *curs, NULL)` correctly. Advancing from
`buf + *curs` can choose an earlier scalar than the cursor; the later `memmove`
then overruns a near-full multibyte buffer. Twenty-four `罠` characters occupy
72 bytes. At cursor 23, `ocurs` is byte 69 but old `oshift` is byte 27, producing
a move ending at byte 114, beyond the original 80-byte help allocation.

The smallest browser-only correction uses the already computed source pointer:

```c
/* AB_BROWSER_UTF8_DELETE_BEGIN */
#ifdef __EMSCRIPTEN__
oshift = utf8_fskip(ocurs, 1, buf + *len);
if (!oshift || oshift <= ocurs || oshift > buf + *len) return false;
#else
/* AB_BROWSER_UTF8_DELETE_END */
oshift = utf8_fskip(buf + *curs, 1, NULL);
/* AB_BROWSER_UTF8_DELETE_BEGIN */
#endif
/* AB_BROWSER_UTF8_DELETE_END */
```

Removing only tagged additions reconstructs the original statement exactly.
Native builds retain the original branch. Browser ASCII editing yields exactly
the same string/length/cursor; multibyte DELETE now uses scalar boundaries.
The existing first-time clear-default branch remains above this change.
Before moving bytes, the enclosing browser adapter should also ensure
`*len < buflen` and `buf[*len] == '\0'`; help's local fix performs those checks.
The existing move excludes the terminator and sets the new terminator afterward;
that original behavior may stay intact once both offsets are correctly bounded.

For the complete Rust application input seam, use a pure helper that accepts a
bounded UTF-8 string and scalar cursor and returns byte start/end offsets (or
no-op at end). The C adapter must validate each returned offset against original
`*len` before its move. Such a helper should never receive an English gameplay
descriptor, mutate domain state or draw RNG. That broader API is a follow-up;
it is not required to make the immediate pointer correction safe and should
not hold up the measured first engine build.

Reuse the help regression fixtures in
`tests/help-semantic-integration.test.mjs`: every cursor of ASCII, CJK, mixed
supplementary characters, first-time clear, cursor-at-end, 72-byte Japanese text
with 73/74/80-byte bounds, guard bytes and exact ASCII result. They currently
exercise an independent span contract and source structure, not compiled C.
Parent must additionally execute actual browser name/help DELETE sequences and
verify edit acceptance, no replacement characters, native state/RNG equality
and valid save/resume before claiming shared-editor browser safety.
