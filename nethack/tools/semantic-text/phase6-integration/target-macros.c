/* Added 2026-10-02: actual target compiler macro observation; NGPL. */
#include "config.h"
#include "dlb.h"
#include <emscripten/emscripten.h>

EMSCRIPTEN_KEEPALIVE const char *nh_build_target_macros(void) {
    return "{"
#ifdef UNIX
        "\"UNIX\":1"
#else
        "\"UNIX\":0"
#endif
#ifdef MSDOS
        ",\"MSDOS\":1"
#else
        ",\"MSDOS\":0"
#endif
#ifdef WIN32
        ",\"WIN32\":1"
#else
        ",\"WIN32\":0"
#endif
#ifdef _WIN32
        ",\"_WIN32\":1"
#else
        ",\"_WIN32\":0"
#endif
#ifdef CROSS_TO_WASM
        ",\"CROSS_TO_WASM\":1"
#else
        ",\"CROSS_TO_WASM\":0"
#endif
#ifdef CROSSCOMPILE
        ",\"CROSSCOMPILE\":1"
#else
        ",\"CROSSCOMPILE\":0"
#endif
#ifdef CROSSCOMPILE_TARGET
        ",\"CROSSCOMPILE_TARGET\":1"
#else
        ",\"CROSSCOMPILE_TARGET\":0"
#endif
#ifdef __EMSCRIPTEN__
        ",\"__EMSCRIPTEN__\":1"
#else
        ",\"__EMSCRIPTEN__\":0"
#endif
#ifdef DLBLIB
        ",\"DLBLIB\":1"
#else
        ",\"DLBLIB\":0"
#endif
        "}";
}
